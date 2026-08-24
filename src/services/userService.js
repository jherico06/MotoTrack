// ─── USER DATABASE SERVICE (SUPABASE PRIMARY SOURCE OF TRUTH) ─────────────────
import { supabase } from './supabaseClient';
import { appStorage } from './storageAdapter';

export const ADMIN_USER = {
  id: 'usr-admin-01',
  user_id: 'usr-admin-01',
  name: 'Store Administrator',
  email: 'admin@mototrack.com',
  password: 'admin123',
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
  name: 'Maurin Jherico',
  email: 'jherico.maurin@gmail.com',
  password: 'password123',
  phone: '(+63) 965 829 4141',
  address: 'Purok Avocado 4 Inoburan, City of Naga, Cebu, Inoburan, Naga City, Cebu, Philippines',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
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

export const ADMIN_SECRET_KEY = 'ADMIN2026';

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
    } catch (e) {}
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
              avatar:
                u.avatar ||
                (u.role === 'admin'
                  ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                  : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'),
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
  async createUser({ name, email, password, phone = '', address = '', role = 'user', avatar = '' }) {
    const normalizedEmail = (email || '').trim().toLowerCase();

    // Check if already in Supabase
    if (supabase) {
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('user_id, email')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (existingUser) {
          return { success: false, error: 'This email is already registered in Supabase. Please sign in instead.' };
        }
      } catch (e) {
        console.warn('Supabase email check note:', e);
      }
    }

    const userId = 'usr-' + Date.now();
    const customerId = role !== 'admin' ? 'cust-' + Date.now() : null;

    const newUser = {
      id: userId,
      user_id: userId,
      customer_id: customerId,
      name: (name || '').trim(),
      email: normalizedEmail,
      password,
      phone: (phone || '').trim(),
      address: (address || 'Metro Manila, Philippines').trim(),
      role: role || 'user',
      status: 'active',
      avatar:
        avatar ||
        (role === 'admin'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'),
      memberSince: 'Today',
      orders: [],
    };

    // Save to Supabase Cloud Database (users + customers + addresses)
    if (supabase) {
      try {
        const { error: userError } = await supabase.from('users').insert([
          {
            user_id: newUser.user_id,
            name: newUser.name,
            email: newUser.email,
            password: newUser.password,
            phone: newUser.phone,
            address: newUser.address,
            role: newUser.role,
            status: 'active',
            avatar: newUser.avatar,
            member_since: newUser.memberSince,
          },
        ]);

        if (userError) {
          console.warn('Supabase user insert error:', userError);
        } else if (role !== 'admin' && customerId) {
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
      }
    }

    // Save locally
    const localUsers = this.getLocalUsers();
    const updatedUsers = [newUser, ...localUsers.filter((u) => u.email.toLowerCase() !== normalizedEmail)];
    this.saveLocalUsers(updatedUsers);

    return { success: true, user: newUser };
  }

  // ─── UPDATE USER ROLE (PROMOTE / DEMOTE) ───
  async updateUserRole(id, newRole) {
    if (supabase) {
      try {
        await supabase.from('users').update({ role: newRole }).or(`user_id.eq.${id},id.eq.${id}`);
      } catch (e) {}
    }

    let localUsers = this.getLocalUsers();
    localUsers = localUsers.map((u) => ((u.id === id || u.user_id === id) ? { ...u, role: newRole } : u));
    this.saveLocalUsers(localUsers);

    return { success: true };
  }

  // ─── DELETE USER ACCOUNT ───
  async deleteUser(id) {
    const userId = String(id).trim();
    if (supabase) {
      try {
        try { await supabase.from('notifications').delete().eq('user_id', userId); } catch (e) {}
        try { await supabase.from('carts').delete().eq('user_id', userId); } catch (e) {}
        try { await supabase.from('customers').delete().eq('user_id', userId); } catch (e) {}
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
  async authenticate(email, password, requiredRole = null) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!normalizedEmail || !cleanPassword) {
      return { success: false, error: 'Please provide both email and password.' };
    }

    // 1. Check Supabase users table
    if (supabase) {
      try {
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*, customers(customer_id, contact_number)')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (!error && dbUser) {
          if (dbUser.password !== cleanPassword && dbUser.password !== password) {
            return { success: false, error: 'Incorrect password. Please verify your credentials.' };
          }

          if (requiredRole && dbUser.role !== requiredRole) {
            if (requiredRole === 'admin') {
              return {
                success: false,
                error: 'Access Denied: This account is a Customer account. Only authorized Store Administrators can access the Admin Dashboard.',
              };
            }
          }

          const custInfo = Array.isArray(dbUser.customers) && dbUser.customers[0] ? dbUser.customers[0] : null;
          const user = {
            id: dbUser.user_id || dbUser.id,
            user_id: dbUser.user_id || dbUser.id,
            customer_id: custInfo ? custInfo.customer_id : null,
            name: dbUser.name,
            email: dbUser.email,
            phone: dbUser.phone || (custInfo ? custInfo.contact_number : '') || '',
            address: dbUser.address || '',
            role: dbUser.role || 'user',
            status: dbUser.status || 'active',
            avatar:
              dbUser.avatar ||
              (dbUser.role === 'admin'
                ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'),
            memberSince: dbUser.member_since || '2026',
            orders: [],
          };

          return { success: true, user };
        }
      } catch (e) {
        console.warn('Supabase direct auth note:', e);
      }
    }

    // 2. Fallback to local users list
    const users = await this.getAllUsers();
    let user = users.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (!user) {
      if (normalizedEmail === CUSTOMER_USER.email.toLowerCase()) {
        user = CUSTOMER_USER;
      } else if (normalizedEmail === ADMIN_USER.email.toLowerCase()) {
        user = ADMIN_USER;
      }
    }

    if (!user) {
      return { success: false, error: 'No account found with this email. Please sign up for an account.' };
    }

    if (user.password !== password && user.password !== cleanPassword) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    if (requiredRole && user.role !== requiredRole) {
      if (requiredRole === 'admin') {
        return {
          success: false,
          error: 'Access Denied: This account is a Customer account. Only authorized Store Administrators can access the Admin Dashboard.',
        };
      }
    }

    const { password: _, ...safeUser } = user;
    return { success: true, user: safeUser };
  }
}

export const userService = new UserService();
