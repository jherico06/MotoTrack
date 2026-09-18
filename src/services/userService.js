// ─── USER DATABASE SERVICE (SUPABASE PRIMARY SOURCE OF TRUTH) ─────────────────
import { supabase } from './supabaseClient';
import { appStorage } from './storageAdapter';
import { hashPassword, isHashed, verifyPassword } from '../utils/hash';
// Re-exported from central config so the admin secret key is env-driven (.env)
export { ADMIN_SECRET_KEY } from '../config';

export const ADMIN_USER = {
  id: 'usr-admin-01',
  user_id: 'usr-admin-01',
  name: 'Store Administrator',
  email: 'admin@mototrack.com',
  password: hashPassword('admin123', 'admin@mototrack.com'),
  phone: '(+63) 917 999 0001',
  address: 'MotoTrack HQ, 100 Superbike Blvd, Bonifacio Global City, Taguig, Metro Manila 1634',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  role: 'admin',
  status: 'active',
  memberSince: '2024',
  orders: [],
};

export const CUSTOMER_USER = {
  id: 'usr-customer-01',
  user_id: 'usr-customer-01',
  customer_id: 'cust-01',
  name: 'Alex Rider',
  email: 'alex.rider@mototrack.com',
  password: hashPassword('password123', 'alex.rider@mototrack.com'),
  phone: '(+63) 917 555 0192',
  address: '742 Evergreen Terrace, Naga City, Cebu, Philippines',
  avatar: null,
  role: 'user',
  status: 'active',
  memberSince: '2024',
  orders: [
    {
      id: 'ord-8921',
      order_id: 'ord-8921',
      date: 'Aug 10, 2026',
      total: '1145.00',
      items: 'Akrapovič Titanium Slip-On Racing Exhaust (x1), Brembo 19RCS (x1)',
      status: 'Delivered',
    },
  ],
};

const STORAGE_KEYS = {
  USERS: 'mototrack_users_db',
  CURRENT_USER: 'mototrack_current_session',
};

class UserService {
  constructor() {
    this.initDatabase();
  }

  initDatabase() {
    try {
      const existing = appStorage.getItem(STORAGE_KEYS.USERS);
      if (!existing) {
        const initialDB = [CUSTOMER_USER, ADMIN_USER];
        appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialDB));
      } else {
        const users = JSON.parse(existing);
        if (!users.some((u) => u.email?.toLowerCase() === ADMIN_USER.email.toLowerCase())) {
          users.push(ADMIN_USER);
          appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      }
    } catch (_e) {}
  }

  getLocalUsers() {
    try {
      const data = appStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [CUSTOMER_USER, ADMIN_USER];
    } catch (e) {
      return [CUSTOMER_USER, ADMIN_USER];
    }
  }

  saveLocalUsers(users) {
    try {
      appStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {}
  }

  // ─── GET ALL USERS (FROM SUPABASE PRIMARY) ───
  async getAllUsers() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*, customers(customer_id, contact_number)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped = data.map((u) => {
            const custInfo = Array.isArray(u.customers) && u.customers[0] ? u.customers[0] : null;
            return {
              id: u.user_id || u.id,
              user_id: u.user_id || u.id,
              customer_id: custInfo ? custInfo.customer_id : null,
              name: u.name,
              email: u.email,
              password: u.password,
              phone: u.phone || (custInfo ? custInfo.contact_number : '') || '',
              address: u.address || '',
              role: u.role || 'user',
              status: u.status || 'active',
              username: u.username || '',
              avatar: u.avatar || null,
              memberSince: u.member_since || '2026',
              orders: [],
            };
          });

          this.saveLocalUsers(mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('Supabase fetch users note:', e);
      }
    }
    return this.getLocalUsers();
  }

  // ─── CREATE NEW USER IN SUPABASE DATABASE & LOCAL CACHE ───
  async createUser({
    name,
    email,
    password,
    phone = '',
    address = '',
    role = 'user',
    avatar = '',
    username = '',
    status = 'active',
  }) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const accountStatus = String(status || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const safeRole = role === 'admin' || role === 'rider' ? role : 'user';

    // Check if already in Supabase
    if (supabase) {
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('user_id, email')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (existingUser) {
          if (safeRole === 'rider') {
            return {
              success: false,
              error: 'That email already belongs to another account. Use a unique rider email.',
            };
          }
          const updatedPwd = hashPassword(password || '', normalizedEmail);
          await supabase
            .from('users')
            .update({
              password: updatedPwd,
              name: (name || '').trim(),
              phone: (phone || '').trim(),
              address: (address || 'Metro Manila, Philippines').trim(),
              status: 'active',
            })
            .eq('user_id', existingUser.user_id);

          const updatedLocalUser = {
            id: existingUser.user_id,
            user_id: existingUser.user_id,
            name: (name || '').trim(),
            email: normalizedEmail,
            username: normalizedUsername,
            password: updatedPwd,
            phone: (phone || '').trim(),
            address: (address || 'Metro Manila, Philippines').trim(),
            role: role || 'user',
            status: 'active',
            avatar: avatar || '',
            memberSince: 'Today',
            orders: [],
          };

          this.saveLocalUsers([
            updatedLocalUser,
            ...this.getLocalUsers().filter((u) => u.email.toLowerCase() !== normalizedEmail),
          ]);

          return { success: true, user: updatedLocalUser };
        }
      } catch (e) {
        console.warn('Supabase email check note:', e);
      }
    }

    if (normalizedUsername && supabase) {
      try {
        const { data: existingUsername } = await supabase
          .from('users')
          .select('user_id')
          .ilike('username', normalizedUsername)
          .maybeSingle();
        if (existingUsername) {
          return { success: false, error: 'That username is already in use.' };
        }
      } catch (_e) {}
    }

    const userId = (safeRole === 'rider' ? 'usr-rider-' : 'usr-') + Date.now();
    const customerId = safeRole === 'admin' || safeRole === 'rider' ? null : 'cust-' + Date.now();

    const newUser = {
      id: userId,
      user_id: userId,
      customer_id: customerId,
      name: (name || '').trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashPassword(password || '', normalizedEmail),
      phone: (phone || '').trim(),
      address: (address || 'Metro Manila, Philippines').trim(),
      role: safeRole,
      status: accountStatus,
      avatar: avatar || null,
      memberSince: 'Today',
      orders: [],
    };

    // Save to Supabase Cloud Database (users + customers + addresses)
    if (!supabase) {
      if (safeRole === 'rider') {
        return {
          success: false,
          error: 'Database is not connected. Rider accounts must be saved in Supabase.',
        };
      }
    } else {
      try {
        const userRow = {
          user_id: newUser.user_id,
          name: newUser.name,
          email: newUser.email,
          username: newUser.username || null,
          password: newUser.password,
          phone: newUser.phone,
          address: newUser.address,
          role: newUser.role,
          status: accountStatus,
          avatar: newUser.avatar,
          member_since: newUser.memberSince,
        };
        let { error: userError } = await supabase.from('users').insert([userRow]);
        if (userError && /username/i.test(String(userError.message || ''))) {
          const { username: _u, ...withoutUsername } = userRow;
          const retry = await supabase.from('users').insert([withoutUsername]);
          userError = retry.error;
        }

        if (userError) {
          console.warn('Supabase user insert error:', userError);
          return { success: false, error: userError.message || 'Could not create the user account.' };
        } else if (safeRole !== 'admin' && safeRole !== 'rider' && customerId) {
          await supabase.from('customers').insert([
            {
              customer_id: customerId,
              user_id: newUser.user_id,
              name: newUser.name,
              email: newUser.email,
              contact_number: newUser.phone,
            },
          ]);

          if (newUser.address) {
            await supabase.from('addresses').insert([
              {
                address_id: 'addr-' + Date.now(),
                customer_id: customerId,
                label: 'Default Delivery',
                full_address: newUser.address,
                is_default: true,
              },
            ]);
          }
        }
      } catch (e) {
        console.warn('Supabase user creation error:', e);
        if (safeRole === 'rider') {
          return { success: false, error: e?.message || 'Could not create the rider login account.' };
        }
      }
    }

    // Save locally
    const localUsers = this.getLocalUsers();
    const updatedUsers = [newUser, ...localUsers.filter((u) => u.email.toLowerCase() !== normalizedEmail)];
    this.saveLocalUsers(updatedUsers);

    return { success: true, user: newUser };
  }

  async updateRiderAccount(userId, { name, phone, status, username, email, password }) {
    const id = String(userId || '').trim();
    if (!id) return { success: false, error: 'User id is required.' };
    const payload = {};
    if (name !== undefined) payload.name = String(name || '').trim();
    if (phone !== undefined) payload.phone = String(phone || '').trim();
    if (status !== undefined) payload.status = String(status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    if (username !== undefined) payload.username = String(username || '').trim().toLowerCase() || null;
    if (email !== undefined) payload.email = String(email || '').trim().toLowerCase();

    const localUsers = this.getLocalUsers();
    const existing = localUsers.find((u) => u.id === id || u.user_id === id);
    const saltEmail = payload.email || existing?.email || '';
    if (password) payload.password = hashPassword(String(password).trim(), saltEmail);

    if (!supabase) {
      return {
        success: false,
        error: 'Database is not connected. Rider accounts must be saved in Supabase.',
      };
    }

    try {
      let { error } = await supabase.from('users').update(payload).eq('user_id', id);
      if (error && /username/i.test(String(error.message || ''))) {
        const { username: _u, ...withoutUsername } = payload;
        const retry = await supabase.from('users').update(withoutUsername).eq('user_id', id);
        error = retry.error;
      }
      if (error) {
        return { success: false, error: error.message || 'Could not update the rider login account.' };
      }
    } catch (e) {
      console.warn('Supabase updateRiderAccount:', e);
      return { success: false, error: e?.message || 'Could not update the rider login account.' };
    }

    const next = localUsers.map((u) =>
      u.id === id || u.user_id === id ? { ...u, ...payload, role: 'rider' } : u
    );
    this.saveLocalUsers(next);
    return { success: true, user: next.find((u) => u.id === id || u.user_id === id) };
  }

  // ─── UPDATE USER PROFILE (NAME, PHONE, ADDRESS, AVATAR) ───
  async updateProfile(id, { name, phone, address, avatar }) {
    const userId = String(id).trim();
    const cleanName = name !== undefined ? name.trim() : undefined;
    const cleanPhone = phone !== undefined ? phone.trim() : undefined;
    const cleanAddress = address !== undefined ? address.trim() : undefined;

    // 1. Update in Supabase
    if (supabase) {
      try {
        const updatePayload = {};
        if (cleanName !== undefined) updatePayload.name = cleanName;
        if (cleanPhone !== undefined) updatePayload.phone = cleanPhone;
        if (cleanAddress !== undefined) updatePayload.address = cleanAddress;
        if (avatar !== undefined) updatePayload.avatar = avatar;

        await supabase.from('users').update(updatePayload).or(`user_id.eq.${userId},id.eq.${userId}`);

        // Update customers table
        const custPayload = {};
        if (cleanName !== undefined) custPayload.name = cleanName;
        if (cleanPhone !== undefined) custPayload.contact_number = cleanPhone;
        if (Object.keys(custPayload).length > 0) {
          await supabase.from('customers').update(custPayload).eq('user_id', userId);
        }

        // Update addresses table
        if (cleanAddress !== undefined) {
          const { data: cust } = await supabase
            .from('customers')
            .select('customer_id')
            .eq('user_id', userId)
            .maybeSingle();
          if (cust?.customer_id) {
            const { data: existingAddr } = await supabase
              .from('addresses')
              .select('address_id')
              .eq('customer_id', cust.customer_id)
              .limit(1);
            if (existingAddr && existingAddr.length > 0) {
              await supabase
                .from('addresses')
                .update({ full_address: cleanAddress })
                .eq('address_id', existingAddr[0].address_id);
            } else {
              await supabase.from('addresses').insert([
                {
                  address_id: 'addr-' + Date.now(),
                  customer_id: cust.customer_id,
                  label: 'Primary Delivery',
                  full_address: cleanAddress,
                  is_default: true,
                },
              ]);
            }
          }
        }
      } catch (e) {
        console.warn('Supabase updateProfile error:', e);
      }
    }

    // 2. Update in Local Storage Cache
    let localUsers = this.getLocalUsers();
    let updatedUser = null;

    localUsers = localUsers.map((u) => {
      if (u.id === userId || u.user_id === userId) {
        updatedUser = {
          ...u,
          ...(cleanName !== undefined && { name: cleanName }),
          ...(cleanPhone !== undefined && { phone: cleanPhone }),
          ...(cleanAddress !== undefined && { address: cleanAddress }),
          ...(avatar !== undefined && { avatar }),
        };
        return updatedUser;
      }
      return u;
    });

    if (!updatedUser) {
      updatedUser = {
        id: userId,
        user_id: userId,
        name: cleanName || 'Customer',
        phone: cleanPhone || '',
        address: cleanAddress || '',
        avatar: avatar || '',
      };
      localUsers.push(updatedUser);
    }

    this.saveLocalUsers(localUsers);

    try {
      this.logAccountActivity(userId, 'PROFILE_UPDATED', 'Updated profile information and delivery address');
    } catch (_e) {}

    return { success: true, user: updatedUser };
  }

  // ─── LOG ACCOUNT ACTIVITY / SECURITY AUDIT ───
  async logAccountActivity(userId, action, description, metadata = {}) {
    const uid = String(userId || '').trim();
    if (!uid) return;

    const logEntry = {
      log_id: 'log-' + Math.floor(100000 + Math.random() * 900000),
      user_id: uid,
      action: action, // 'EMAIL_CHANGED' | 'PASSWORD_CHANGED' | 'PROFILE_UPDATED' | 'LOGIN_SUCCESS' | 'ORDER_PLACED'
      description: description,
      metadata: metadata,
      ip_address: '127.0.0.1 (Local)',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'MotoTrack App',
      created_at: new Date().toISOString(),
    };

    // 1. Write to local storage cache
    try {
      const storageKey = `mototrack_account_logs_${uid}`;
      const existing = appStorage.getItem(storageKey);
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(logEntry);
      // Keep up to 50 logs
      appStorage.setItem(storageKey, JSON.stringify(list.slice(0, 50)));
    } catch (_e) {}

    // 2. Write to Supabase if connected
    if (supabase) {
      try {
        await supabase.from('account_logs').insert([
          {
            user_id: uid,
            action: action,
            description: description,
            metadata: metadata,
            ip_address: '127.0.0.1',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'MotoTrack App',
          },
        ]);
      } catch (_e) {}
    }

    return logEntry;
  }

  // ─── GET ACCOUNT LOGS ───
  async getAccountLogs(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return [];

    let logs = [];

    // Try Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('account_logs')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && Array.isArray(data) && data.length > 0) {
          logs = data;
        }
      } catch (_e) {}
    }

    // Merge / fallback to local storage
    try {
      const storageKey = `mototrack_account_logs_${uid}`;
      const existing = appStorage.getItem(storageKey);
      if (existing) {
        const localList = JSON.parse(existing);
        const map = new Map();
        [...logs, ...localList].forEach((item) => {
          const key = item.log_id || `${item.created_at}-${item.action}`;
          if (!map.has(key)) map.set(key, item);
        });
        logs = Array.from(map.values());
      }
    } catch (_e) {}

    // If still empty, supply initial default registration log
    if (logs.length === 0) {
      const defaultLog = {
        log_id: 'log-init',
        user_id: uid,
        action: 'ACCOUNT_CREATED',
        description: 'Account created and verified on MotoTrack platform',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      };
      logs = [defaultLog];
    }

    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return logs;
  }

  // ─── CHANGE EMAIL ───
  async changeEmail(userId, { newEmail, currentPassword }) {
    const uid = String(userId || '').trim();
    const cleanNewEmail = (newEmail || '').trim().toLowerCase();
    const cleanCurrentPwd = (currentPassword || '').trim();

    if (!uid) return { success: false, error: 'User ID is required' };
    if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid new email address.' };
    }
    if (!cleanCurrentPwd) {
      return { success: false, error: 'Please enter your current password to authorize email change.' };
    }

    // 1. Verify current password
    let currentUser = null;
    let storedPwd = null;

    if (supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .or(`user_id.eq.${uid},id.eq.${uid}`)
          .maybeSingle();
        if (data) {
          currentUser = data;
          storedPwd = data.password;
        }
      } catch (_e) {}
    }

    if (!currentUser) {
      const localUsers = this.getLocalUsers();
      currentUser = localUsers.find((u) => u.id === uid || u.user_id === uid);
      if (currentUser) storedPwd = currentUser.password;
    }

    if (!currentUser) {
      return { success: false, error: 'User account not found.' };
    }

    const currentEmail = (currentUser.email || '').toLowerCase();
    if (currentEmail === cleanNewEmail) {
      return { success: false, error: 'New email cannot be the same as your current email.' };
    }

    const isCurrentPwdValid =
      verifyPassword(cleanCurrentPwd, storedPwd, currentEmail) || storedPwd === cleanCurrentPwd;
    if (!isCurrentPwdValid) {
      return { success: false, error: 'Incorrect current password. Verification failed.' };
    }

    // 2. Check if new email is already taken by another account
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from('users')
          .select('user_id')
          .ilike('email', cleanNewEmail)
          .neq('user_id', uid)
          .maybeSingle();
        if (existing) {
          return { success: false, error: 'This email is already registered to another account.' };
        }
      } catch (_e) {}
    }

    const localConflict = this.getLocalUsers().find(
      (u) => u.id !== uid && u.user_id !== uid && u.email?.toLowerCase() === cleanNewEmail
    );
    if (localConflict) {
      return { success: false, error: 'This email is already in use.' };
    }

    // 3. Compute new password hash salted with the new email
    const newPasswordHash = hashPassword(cleanCurrentPwd, cleanNewEmail);

    // 4. Update in Supabase
    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({
            email: cleanNewEmail,
            password: newPasswordHash,
            updated_at: new Date().toISOString(),
          })
          .or(`user_id.eq.${uid},id.eq.${uid}`);

        await supabase
          .from('customers')
          .update({ email: cleanNewEmail, updated_at: new Date().toISOString() })
          .eq('user_id', uid);

        // Supabase Auth update if user has auth session
        supabase.auth.updateUser({ email: cleanNewEmail }).catch(() => {});
      } catch (e) {
        console.warn('Supabase changeEmail error:', e);
      }
    }

    // 5. Update local cache
    let updatedSafeUser = null;
    const localUsers = this.getLocalUsers().map((u) => {
      if (u.id === uid || u.user_id === uid) {
        const updated = {
          ...u,
          email: cleanNewEmail,
          password: newPasswordHash,
        };
        updatedSafeUser = updated;
        return updated;
      }
      return u;
    });
    this.saveLocalUsers(localUsers);

    // Log the event
    await this.logAccountActivity(uid, 'EMAIL_CHANGED', `Changed primary email to ${cleanNewEmail}`, {
      oldEmail: currentEmail,
      newEmail: cleanNewEmail,
    });

    const { password: _, ...safeUser } = updatedSafeUser || { ...currentUser, email: cleanNewEmail };
    return { success: true, user: safeUser };
  }

  // ─── CHANGE PASSWORD ───
  async changePassword(userId, { currentPassword, newPassword }) {
    const uid = String(userId || '').trim();
    const cleanCurrentPwd = (currentPassword || '').trim();
    const cleanNewPwd = (newPassword || '').trim();

    if (!uid) return { success: false, error: 'User ID is required' };
    if (!cleanCurrentPwd) {
      return { success: false, error: 'Please enter your current password.' };
    }
    if (!cleanNewPwd) {
      return { success: false, error: 'Please enter a new password.' };
    }
    if (cleanNewPwd.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }
    if (cleanCurrentPwd === cleanNewPwd) {
      return { success: false, error: 'New password cannot be the same as your current password.' };
    }

    // 1. Verify current password
    let currentUser = null;
    let storedPwd = null;

    if (supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .or(`user_id.eq.${uid},id.eq.${uid}`)
          .maybeSingle();
        if (data) {
          currentUser = data;
          storedPwd = data.password;
        }
      } catch (_e) {}
    }

    if (!currentUser) {
      const localUsers = this.getLocalUsers();
      currentUser = localUsers.find((u) => u.id === uid || u.user_id === uid);
      if (currentUser) storedPwd = currentUser.password;
    }

    if (!currentUser) {
      return { success: false, error: 'User account not found.' };
    }

    const currentEmail = (currentUser.email || '').toLowerCase();
    const isCurrentPwdValid =
      verifyPassword(cleanCurrentPwd, storedPwd, currentEmail) || storedPwd === cleanCurrentPwd;
    if (!isCurrentPwdValid) {
      return { success: false, error: 'Incorrect current password. Verification failed.' };
    }

    // 2. Hash new password
    const newPasswordHash = hashPassword(cleanNewPwd, currentEmail);

    // 3. Update in Supabase
    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({
            password: newPasswordHash,
            updated_at: new Date().toISOString(),
          })
          .or(`user_id.eq.${uid},id.eq.${uid}`);

        // Update in Supabase Auth
        supabase.auth.updateUser({ password: cleanNewPwd }).catch(() => {});
      } catch (e) {
        console.warn('Supabase changePassword error:', e);
      }
    }

    // 4. Update local cache
    const localUsers = this.getLocalUsers().map((u) => {
      if (u.id === uid || u.user_id === uid) {
        return {
          ...u,
          password: newPasswordHash,
        };
      }
      return u;
    });
    this.saveLocalUsers(localUsers);

    // Log the event
    await this.logAccountActivity(uid, 'PASSWORD_CHANGED', 'Password changed successfully');

    return { success: true };
  }

  // ─── UPDATE USER ROLE (PROMOTE / DEMOTE) ───
  async updateUserRole(id, newRole) {
    if (supabase) {
      try {
        await supabase.from('users').update({ role: newRole }).or(`user_id.eq.${id},id.eq.${id}`);
      } catch (e) {}
    }

    let localUsers = this.getLocalUsers();
    localUsers = localUsers.map((u) => (u.id === id || u.user_id === id ? { ...u, role: newRole } : u));
    this.saveLocalUsers(localUsers);

    return { success: true };
  }

  // ─── UPDATE USER STATUS (ACTIVE / DISABLED) ───
  async updateUserStatus(id, newStatus) {
    const userId = String(id).trim();
    if (supabase) {
      try {
        await supabase.from('users').update({ status: newStatus }).or(`user_id.eq.${userId},id.eq.${userId}`);
      } catch (e) {
        console.warn('Supabase updateUserStatus note:', e);
      }
    }

    let localUsers = this.getLocalUsers();
    localUsers = localUsers.map((u) =>
      u.id === userId || u.user_id === userId ? { ...u, status: newStatus } : u
    );
    this.saveLocalUsers(localUsers);

    return { success: true };
  }

  // ─── DELETE USER ACCOUNT ───
  async deleteUser(id) {
    const userId = String(id).trim();
    if (supabase) {
      try {
        try {
          await supabase.from('notifications').delete().eq('user_id', userId);
        } catch (e) {}
        try {
          await supabase.from('carts').delete().eq('user_id', userId);
        } catch (e) {}
        try {
          await supabase.from('customers').delete().eq('user_id', userId);
        } catch (e) {}
        await supabase.from('users').delete().or(`user_id.eq.${userId},id.eq.${userId}`);
      } catch (e) {
        console.warn('Supabase delete user error:', e);
      }
    }

    let localUsers = this.getLocalUsers();
    localUsers = localUsers.filter((u) => u.id !== userId && u.user_id !== userId);
    this.saveLocalUsers(localUsers);

    return { success: true };
  }

  // ─── AUTHENTICATE USER DIRECTLY FROM SUPABASE ───
  async authenticate(identifier, password, requiredRole = null) {
    const rawIdentifier = (identifier || '').trim();
    const normalizedEmail = rawIdentifier.toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!normalizedEmail || !cleanPassword) {
      return { success: false, error: 'Please provide both username/email and password.' };
    }

    const finishUser = async (user) => {
      if (!user) {
        return { success: false, error: 'No account found with this email or username.' };
      }
      if (user.status === 'disabled' || user.status === 'inactive') {
        return {
          success: false,
          error:
            user.role === 'rider'
              ? 'Your rider account is Inactive. Contact the store administrator.'
              : 'Account Disabled: Your account has been temporarily deactivated by a store administrator. Please contact MotoTrack support.',
        };
      }

      let riderRow = null;
      if (user.role === 'rider' || requiredRole === 'rider') {
        try {
          if (supabase) {
            const { data } = await supabase
              .from('riders')
              .select('id, account_status, username, email, user_id')
              .or(
                [
                  user.id ? `user_id.eq.${user.id}` : null,
                  user.username ? `username.ilike.${user.username}` : null,
                  `email.ilike.${user.email || normalizedEmail}`,
                ]
                  .filter(Boolean)
                  .join(',')
              )
              .maybeSingle();
            riderRow = data || null;
          }
        } catch (_e) {}
        if (!riderRow) {
          try {
            const raw = appStorage.getItem('mototrack_riders_list');
            const list = raw ? JSON.parse(raw) : [];
            riderRow = (Array.isArray(list) ? list : []).find(
              (r) =>
                r.userId === user.id ||
                r.user_id === user.id ||
                String(r.username || '').toLowerCase() === String(user.username || normalizedEmail).toLowerCase() ||
                String(r.email || '').toLowerCase() === String(user.email || '').toLowerCase()
            );
          } catch (_e) {}
        }
        const accountStatus = String(riderRow?.account_status || riderRow?.accountStatus || 'Active');
        if (accountStatus.toLowerCase() === 'inactive') {
          return {
            success: false,
            error: 'Your rider account is Inactive. Contact the store administrator.',
          };
        }
        if (riderRow) {
          user = {
            ...user,
            rider_id: riderRow.id,
            username: riderRow.username || user.username,
            account_status: accountStatus,
          };
        }
      }

      if (user.role === 'rider' && requiredRole && requiredRole !== 'rider') {
        return {
          success: false,
          error:
            requiredRole === 'admin'
              ? 'Rider accounts cannot access the Admin Dashboard. Sign in on the mobile app to open My Deliveries.'
              : 'This is a Rider account. Sign in on the MotoTrack app to open the Rider Dashboard.',
        };
      }
      if (requiredRole === 'rider' && user.role !== 'rider') {
        return {
          success: false,
          error: 'Only rider accounts can sign in here. Use the customer or admin login instead.',
        };
      }
      if (requiredRole === 'admin' && user.role !== 'admin') {
        return {
          success: false,
          error:
            user.role === 'rider'
              ? 'Rider accounts cannot access the Admin Dashboard. Sign in on the mobile app to open My Deliveries.'
              : 'Access Denied: This account is a Customer account. Only authorized Store Administrators can access the Admin Dashboard.',
        };
      }

      const { password: _pwd, ...safeUser } = user;
      try {
        this.logAccountActivity(user.id || user.user_id, 'LOGIN_SUCCESS', 'Logged in successfully');
      } catch (_e) {}
      return { success: true, user: safeUser };
    };

    // 1. Check Supabase users table (email or username)
    if (supabase) {
      try {
        let dbUser = null;
        const withUsername = await supabase
          .from('users')
          .select('*, customers(customer_id, contact_number)')
          .or(`email.ilike.${normalizedEmail},username.ilike.${normalizedEmail}`)
          .maybeSingle();
        if (!withUsername.error && withUsername.data) {
          dbUser = withUsername.data;
        } else {
          const byEmail = await supabase
            .from('users')
            .select('*, customers(customer_id, contact_number)')
            .ilike('email', normalizedEmail)
            .maybeSingle();
          if (!byEmail.error && byEmail.data) dbUser = byEmail.data;
        }

        if (!dbUser && requiredRole === 'rider') {
          const { data: riderRow } = await supabase
            .from('riders')
            .select('*')
            .or(`username.ilike.${normalizedEmail},email.ilike.${normalizedEmail}`)
            .maybeSingle();
          if (riderRow?.user_id) {
            const { data: linked } = await supabase
              .from('users')
              .select('*, customers(customer_id, contact_number)')
              .eq('user_id', riderRow.user_id)
              .maybeSingle();
            if (linked) dbUser = linked;
          }
        }

        if (dbUser) {
          const storedPwd = dbUser.password;
          const salt = String(dbUser.email || normalizedEmail).toLowerCase();
          const pwdValid =
            verifyPassword(cleanPassword, storedPwd, salt) || storedPwd === password;
          if (!pwdValid) {
            return { success: false, error: 'Incorrect password. Please verify your credentials.' };
          }

          if (storedPwd && !isHashed(storedPwd)) {
            try {
              await supabase
                .from('users')
                .update({ password: hashPassword(cleanPassword, salt) })
                .eq('user_id', dbUser.user_id || dbUser.id);
            } catch (e) {}
          }

          const custInfo =
            Array.isArray(dbUser.customers) && dbUser.customers[0] ? dbUser.customers[0] : null;
          const user = {
            id: dbUser.user_id || dbUser.id,
            user_id: dbUser.user_id || dbUser.id,
            customer_id: custInfo ? custInfo.customer_id : null,
            name: dbUser.name,
            email: dbUser.email,
            username: dbUser.username || '',
            phone: dbUser.phone || (custInfo ? custInfo.contact_number : '') || '',
            address: dbUser.address || '',
            role: dbUser.role || 'user',
            status: dbUser.status || 'active',
            avatar: dbUser.avatar || null,
            memberSince: dbUser.member_since || '2026',
            orders: [],
          };
          return finishUser(user);
        }
      } catch (e) {
        console.warn('Supabase direct auth note:', e);
      }
    }

    // 2. Fallback to local users list
    const users = await this.getAllUsers();
    let user = users.find(
      (u) =>
        u.email?.toLowerCase() === normalizedEmail ||
        String(u.username || '').toLowerCase() === normalizedEmail
    );

    if (!user) {
      try {
        const raw = appStorage.getItem('mototrack_riders_list');
        const list = raw ? JSON.parse(raw) : [];
        const rider = (Array.isArray(list) ? list : []).find(
          (r) =>
            String(r.username || '').toLowerCase() === normalizedEmail ||
            String(r.email || '').toLowerCase() === normalizedEmail
        );
        if (rider?.userId || rider?.user_id) {
          user = users.find((u) => u.id === rider.userId || u.user_id === rider.userId || u.id === rider.user_id);
        }
      } catch (_e) {}
    }

    if (!user) {
      if (normalizedEmail === CUSTOMER_USER.email.toLowerCase()) {
        user = CUSTOMER_USER;
      } else if (normalizedEmail === ADMIN_USER.email.toLowerCase()) {
        user = ADMIN_USER;
      }
    }

    if (!user) {
      return { success: false, error: 'No account found with this email or username.' };
    }

    const storedPwd = user.password;
    const salt = String(user.email || normalizedEmail).toLowerCase();
    const pwdValid = verifyPassword(cleanPassword, storedPwd, salt) || storedPwd === password;
    if (!pwdValid) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    if (storedPwd && !isHashed(storedPwd)) {
      const upgradedHash = hashPassword(cleanPassword, salt);
      this.saveLocalUsers(
        this.getLocalUsers().map((u) =>
          u.id === user.id || u.user_id === user.id ? { ...u, password: upgradedHash } : u
        )
      );
      user = { ...user, password: upgradedHash };
    }

    return finishUser(user);
  }
}

export const userService = new UserService();
