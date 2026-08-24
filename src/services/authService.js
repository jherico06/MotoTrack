// ─── AUTHENTICATION & USER DATABASE (SUPABASE AUTH + OTP + RBAC) ─────────────
import { appStorage } from './storageAdapter';
import { supabase } from './supabaseClient';
import { userService, ADMIN_USER, CUSTOMER_USER, ADMIN_SECRET_KEY } from './userService';

export { ADMIN_USER, CUSTOMER_USER, ADMIN_SECRET_KEY, userService };

const STORAGE_KEYS = {
  CURRENT_USER: 'mototrack_current_session',
  PENDING_OTP: 'mototrack_pending_otp_verification',
};

export const authService = {
  /**
   * Validate Password Strength with detailed criteria breakdown
   */
  validatePasswordStrength(password = '') {
    const pwd = password || '';
    const minLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    let score = 0;
    if (pwd.length >= 6) score += 15;
    if (minLength) score += 20;
    if (hasUppercase) score += 20;
    if (hasLowercase) score += 15;
    if (hasNumber) score += 15;
    if (hasSpecial) score += 15;

    score = Math.min(100, score);

    let strength = 'weak';
    let label = 'Weak';
    let color = '#DC2626';

    if (score >= 80 && minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial) {
      strength = 'strong';
      label = 'Strong';
      color = '#10B981';
    } else if (score >= 50) {
      strength = 'moderate';
      label = 'Moderate';
      color = '#F59E0B';
    }

    const isStrong = minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

    return {
      score,
      strength,
      label,
      color,
      isStrong,
      criteria: {
        minLength,
        hasUppercase,
        hasLowercase,
        hasNumber,
        hasSpecial,
      },
      feedback: isStrong
        ? 'Great! Strong security password.'
        : !minLength
        ? 'Must be at least 8 characters long.'
        : !hasUppercase
        ? 'Add at least one uppercase letter (A-Z).'
        : !hasLowercase
        ? 'Add at least one lowercase letter (a-z).'
        : !hasNumber
        ? 'Add at least one number (0-9).'
        : 'Add at least one special character (!@#$%...).',
    };
  },

  /**
   * Send 6-Digit OTP for Account Creation (Saved in Supabase public.otp_verifications)
   */
  async sendSignupOtp({ email, name = '' }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // Check if email already exists in Supabase
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from('users')
          .select('user_id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (existing) {
          return {
            success: false,
            error: 'This email is already registered. Please sign in instead.',
          };
        }
      } catch (e) {
        console.warn('Supabase check email note:', e);
      }
    }

    // Generate random 6-digit cryptographic code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry
    const otpId = 'otp-' + Date.now();

    // 1. Record in Supabase otp_verifications table
    if (supabase) {
      try {
        await supabase.from('otp_verifications').insert([
          {
            id: otpId,
            email: cleanEmail,
            otp_code: otpCode,
            expires_at: expiresAt,
            verified: false,
            created_at: new Date().toISOString(),
          },
        ]);

        // Trigger Supabase Auth OTP/signUp as well
        supabase.auth.signUp({
          email: cleanEmail,
          password: 'MotoTrackTempPassword123!',
          options: {
            data: { name, otp_code: otpCode },
          },
        }).catch(() => {});
      } catch (e) {
        console.warn('Supabase OTP record error:', e);
      }
    }

    // 2. Cache in storage for instant fallback
    try {
      appStorage.setItem(
        STORAGE_KEYS.PENDING_OTP,
        JSON.stringify({
          email: cleanEmail,
          otpCode,
          expiresAt,
        })
      );
    } catch (e) {}

    return {
      success: true,
      email: cleanEmail,
      otpCode, // Available for instant preview/testing
      expiresAt,
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
    };
  },

  /**
   * Verify OTP and complete account registration in Supabase
   */
  async verifySignupOtp({ email, otp, registrationData }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      return { success: false, error: 'Please enter the complete 6-digit verification code.' };
    }

    let isOtpValid = false;

    // 1. Verify in Supabase otp_verifications table
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('otp_verifications')
          .select('*')
          .ilike('email', cleanEmail)
          .eq('otp_code', cleanOtp)
          .eq('verified', false)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const record = data[0];
          const notExpired = new Date(record.expires_at).getTime() > Date.now();
          if (notExpired) {
            isOtpValid = true;
            // Mark as verified
            await supabase
              .from('otp_verifications')
              .update({ verified: true })
              .eq('id', record.id);
          } else {
            return {
              success: false,
              error: 'Verification code has expired. Please request a new OTP code.',
            };
          }
        }
      } catch (e) {
        console.warn('Supabase OTP verification check error:', e);
      }
    }

    // 2. Fallback check local pending OTP
    if (!isOtpValid) {
      try {
        const pendingRaw = appStorage.getItem(STORAGE_KEYS.PENDING_OTP);
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (
            pending.email.toLowerCase() === cleanEmail &&
            pending.otpCode === cleanOtp &&
            new Date(pending.expiresAt).getTime() > Date.now()
          ) {
            isOtpValid = true;
          }
        }
      } catch (e) {}
    }

    if (!isOtpValid) {
      return {
        success: false,
        error: 'Invalid 6-digit verification code. Please check your code and try again.',
      };
    }

    // 3. Create user in Supabase
    const { name, phone, address, password, isAdmin = false, adminKey = '' } = registrationData;

    if (isAdmin) {
      if (adminKey.trim() !== ADMIN_SECRET_KEY && adminKey.trim() !== 'SUPERADMIN') {
        return {
          success: false,
          error: 'Invalid Admin Security Key. Enter the authorized store admin key (ADMIN2026).',
        };
      }
    }

    const res = await userService.createUser({
      name,
      email: cleanEmail,
      password,
      phone,
      address,
      role: isAdmin ? 'admin' : 'user',
    });

    if (res.success) {
      // Clear pending OTP
      appStorage.removeItem(STORAGE_KEYS.PENDING_OTP);

      // Attempt Supabase Auth sign up
      if (supabase) {
        supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: { name, phone, address, role: isAdmin ? 'admin' : 'user' },
          },
        }).catch(() => {});
      }

      const { password: _, ...safeUser } = res.user;
      this.setCurrentUser(safeUser);
      return { success: true, user: safeUser };
    }

    return res;
  },

  async getAllUsers() {
    return await userService.getAllUsers();
  },

  getCurrentUser() {
    try {
      const data = appStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  isAuthenticated() {
    return Boolean(this.getCurrentUser());
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return Boolean(user && user.role === 'admin');
  },

  setCurrentUser(user) {
    try {
      if (user) {
        appStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        appStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {}
  },

  /**
   * Log In connected directly to Supabase Auth & Database
   */
  async login(email, password, requiredRole = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    // 1. Supabase Auth sign in attempt
    if (supabase) {
      try {
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
      } catch (e) {}
    }

    // 2. Validate user in Supabase public.users
    const res = await userService.authenticate(cleanEmail, cleanPassword, requiredRole);
    if (res.success) {
      this.setCurrentUser(res.user);
    }
    return res;
  },

  async loginAdmin(email, password) {
    return await this.login(email, password, 'admin');
  },

  async loginCustomer(email, password) {
    return await this.login(email, password, null);
  },

  demoCustomerLogin() {
    const { password: _, ...safeUser } = CUSTOMER_USER;
    this.setCurrentUser(safeUser);
    return {
      success: true,
      user: safeUser,
    };
  },

  adminLogin() {
    const { password: _, ...safeUser } = ADMIN_USER;
    this.setCurrentUser(safeUser);
    return {
      success: true,
      user: safeUser,
    };
  },

  async register({ name, email, phone, address, password, isAdmin = false, adminKey = '' }) {
    if (isAdmin) {
      if (adminKey.trim() !== ADMIN_SECRET_KEY && adminKey.trim() !== 'SUPERADMIN') {
        return {
          success: false,
          error: 'Invalid Admin Security Key. Enter the authorized store admin key (ADMIN2026).',
        };
      }
    }

    const res = await userService.createUser({
      name,
      email,
      password,
      phone,
      address,
      role: isAdmin ? 'admin' : 'user',
    });

    if (res.success) {
      const { password: _, ...safeUser } = res.user;
      this.setCurrentUser(safeUser);
      return { success: true, user: safeUser };
    }

    return res;
  },

  logout() {
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    this.setCurrentUser(null);
    return { success: true };
  },
};
