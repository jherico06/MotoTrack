// ─── AUTHENTICATION & USER DATABASE (SUPABASE AUTH + OTP + RBAC) ─────────────
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { appStorage } from './storageAdapter';
import { supabase, supabaseManager } from './supabaseClient';
import { userService, ADMIN_USER, CUSTOMER_USER, ADMIN_SECRET_KEY } from './userService';
import { adminSecurityService } from './adminSecurityService';
import { emailService } from './emailService';
import { notificationService } from './notificationService';
import { APP_CONFIG } from '../config';

const STORAGE_KEYS = {
  CURRENT_USER: 'mototrack_current_session',
  PENDING_OTP: 'mototrack_pending_otp_verification',
};

/**
 * Universal extraction of OAuth query and hash fragment parameters
 * Handles custom schemes (e.g. mototrack://, exp://) and standard URLs
 */
export function extractAuthParamsFromUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return {};
  const params = {};
  try {
    const hashIndex = urlString.indexOf('#');
    if (hashIndex !== -1) {
      const hashString = urlString.substring(hashIndex + 1);
      const hashPairs = hashString.split('&');
      for (const pair of hashPairs) {
        if (!pair) continue;
        const [k, ...v] = pair.split('=');
        if (k) {
          const val = v.join('=');
          try {
            params[decodeURIComponent(k.trim())] = decodeURIComponent(val.replace(/\+/g, ' '));
          } catch (_e) {
            params[k.trim()] = val;
          }
        }
      }
    }
    const queryIndex = urlString.indexOf('?');
    if (queryIndex !== -1) {
      const queryPart =
        hashIndex > queryIndex
          ? urlString.substring(queryIndex + 1, hashIndex)
          : urlString.substring(queryIndex + 1);
      const queryPairs = queryPart.split('&');
      for (const pair of queryPairs) {
        if (!pair) continue;
        const [k, ...v] = pair.split('=');
        if (k) {
          const val = v.join('=');
          try {
            params[decodeURIComponent(k.trim())] = decodeURIComponent(val.replace(/\+/g, ' '));
          } catch (_e) {
            params[k.trim()] = val;
          }
        }
      }
    }
  } catch (_err) {
    console.warn('[extractAuthParamsFromUrl] Error parsing auth params:', _err);
  }
  return params;
}

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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry
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
      } catch (e) {
        console.warn('Supabase OTP record error:', e);
      }
    }

    // Dispatch transactional email with the 6-digit OTP code to user's Gmail
    try {
      await emailService.sendOtpEmail({ email: cleanEmail, otpCode, name });
    } catch (err) {
      console.warn('Email dispatch warning:', err);
    }

    // 2. Cache in storage for fallback verification
    try {
      appStorage.setItem(
        STORAGE_KEYS.PENDING_OTP,
        JSON.stringify({
          email: cleanEmail,
          otpCode,
          expiresAt,
        })
      );
    } catch (_e) {}

    return {
      success: true,
      email: cleanEmail,
      expiresAt,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your email inbox (or spam folder).`,
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
          const expiresAtMs = new Date(record.expires_at).getTime();
          const createdAtMs = new Date(record.created_at || 0).getTime();
          const nowMs = Date.now();

          // Robust check: valid if expires_at is future OR created within last 20 minutes (prevents timezone/clock skew issues)
          const isFresh =
            expiresAtMs > nowMs ||
            (createdAtMs > 0 && Math.abs(nowMs - createdAtMs) < 20 * 60 * 1000) ||
            Math.abs(nowMs - expiresAtMs) < 15 * 60 * 1000;

          if (isFresh) {
            isOtpValid = true;
            // Mark as verified
            await supabase.from('otp_verifications').update({ verified: true }).eq('id', record.id);
          } else {
            console.warn('[AuthService] OTP record found but deemed expired:', {
              expiresAtMs,
              createdAtMs,
              nowMs,
            });
          }
        }
      } catch (e) {
        console.warn('Supabase OTP verification check error:', e);
      }

      // 1b. Also verify with native Supabase Auth OTP verification
      if (!isOtpValid) {
        try {
          const authOtpRes = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanOtp,
            type: 'email',
          });
          if (!authOtpRes.error && authOtpRes.data?.user) {
            isOtpValid = true;
          } else {
            const signupVerifyRes = await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanOtp,
              type: 'signup',
            });
            if (!signupVerifyRes.error && signupVerifyRes.data?.user) {
              isOtpValid = true;
            }
          }
        } catch (_authErr) {}
      }
    }

    // 2. Fallback check local pending OTP
    if (!isOtpValid) {
      try {
        const pendingRaw = appStorage.getItem(STORAGE_KEYS.PENDING_OTP);
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (pending.email.toLowerCase() === cleanEmail && pending.otpCode === cleanOtp) {
            isOtpValid = true;
          }
        }
      } catch (_e) {}
    }

    if (!isOtpValid) {
      return {
        success: false,
        error: 'Invalid verification code. Please check your code and try again.',
      };
    }

    // 3. Create user in Supabase
    const { name, phone, address, password, isAdmin = false, adminKey = '' } = registrationData;

    if (isAdmin) {
      if (adminKey.trim() !== ADMIN_SECRET_KEY) {
        return {
          success: false,
          error: 'Invalid Admin Security Key. Please contact MotoTrack support.',
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
        supabase.auth
          .signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: { name, phone, address, role: isAdmin ? 'admin' : 'user' },
            },
          })
          .catch(() => {});
      }

      const { password: _, ...safeUser } = res.user;
      this.setCurrentUser(safeUser);

      if (!isAdmin && notificationService?.notifyAdminCustomerRegistered) {
        try {
          notificationService.notifyAdminCustomerRegistered({
            customerName: safeUser.name,
            email: safeUser.email,
            phone: safeUser.phone,
          });
        } catch (_e) {}
      }

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
    } catch (_e) {
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
    } catch (_e) {}
  },

  async updateProfile(userId, updates) {
    const res = await userService.updateProfile(userId, updates);
    if (res.success && res.user) {
      const { password: _, ...safeUser } = res.user;
      this.setCurrentUser(safeUser);
      return { success: true, user: safeUser };
    }
    return res;
  },

  async changeEmail(userId, { newEmail, currentPassword }) {
    const res = await userService.changeEmail(userId, { newEmail, currentPassword });
    if (res.success && res.user) {
      this.setCurrentUser(res.user);
      try {
        emailService.sendNotification({
          title: 'MotoTrack Security Alert: Email Address Updated',
          message: `Your account email address was changed to ${newEmail}. If you did not make this change, please contact support immediately.`,
          type: 'security',
          userId: userId,
        });
      } catch (_e) {}
    }
    return res;
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const res = await userService.changePassword(userId, { currentPassword, newPassword });
    if (res.success) {
      try {
        emailService.sendNotification({
          title: 'MotoTrack Security Alert: Password Updated',
          message:
            'Your account password has been successfully updated. If this was not you, please secure your account immediately.',
          type: 'security',
          userId: userId,
        });
      } catch (_e) {}
    }
    return res;
  },

  async getAccountLogs(userId) {
    return await userService.getAccountLogs(userId);
  },

  async logAccountActivity(userId, action, description, metadata = {}) {
    return await userService.logAccountActivity(userId, action, description, metadata);
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
      } catch (_e) {}
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

  async loginRider(identifier, password) {
    return await this.login(identifier, password, 'rider');
  },

  async loginCustomer(email, password) {
    return await this.login(email, password, null);
  },

  async loginWithGoogle() {
    const client = supabase || supabaseManager?.getClient();
    if (!client) {
      return await this.loginWithGoogleSimulated();
    }

    // ─── 1. WEB BROWSER FLOW ───
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      try {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          const errMsg = error.message || '';
          if (
            errMsg.toLowerCase().includes('not enabled') ||
            errMsg.toLowerCase().includes('unsupported provider')
          ) {
            return {
              success: false,
              notEnabled: true,
              error:
                'Google OAuth is not enabled yet in your Supabase project dashboard (vtbdmurblidtdghaotne). Enable Google in Authentication > Providers.',
            };
          }
          return { success: false, error: errMsg };
        }

        if (data?.url) {
          // Immediately redirect browser to Google consent screen
          window.location.href = data.url;
          return { success: true, redirecting: true };
        }
      } catch (err) {
        console.warn('Supabase OAuth Google initialization error (web):', err);
        return { success: false, error: err?.message || 'Failed to initialize Google sign in' };
      }
    }

    // ─── 2. MOBILE REACT NATIVE / EXPO FLOW ───
    if (Platform.OS !== 'web') {
      try {
        WebBrowser.maybeCompleteAuthSession();

        // In Expo Go: exp://<ip>:<port>/--/auth-callback
        // In Standalone/build: mototrack://auth-callback
        const redirectUrl = Linking.createURL('auth-callback');
        console.log('[Google Auth Mobile] Starting OAuth flow with redirectUrl:', redirectUrl);

        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          const errMsg = error.message || '';
          console.warn('[Google Auth Mobile] signInWithOAuth error:', errMsg);
          if (
            errMsg.toLowerCase().includes('not enabled') ||
            errMsg.toLowerCase().includes('unsupported provider')
          ) {
            return {
              success: false,
              notEnabled: true,
              error:
                'Google OAuth is not enabled yet in your Supabase project dashboard (vtbdmurblidtdghaotne). Enable Google in Authentication > Providers.',
            };
          }
          return { success: false, error: errMsg };
        }

        if (!data?.url) {
          return { success: false, error: 'Could not obtain Google authentication URL from Supabase.' };
        }

        console.log('[Google Auth Mobile] Opening in-app browser session...');
        const authResponse = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        console.log('[Google Auth Mobile] WebBrowser result type:', authResponse?.type);

        if (authResponse.type === 'cancel' || authResponse.type === 'dismiss') {
          return { success: false, cancelled: true, message: 'Google sign-in was cancelled.' };
        }

        if (authResponse.type === 'success' && authResponse.url) {
          return await this.handleOAuthCallbackUrl(authResponse.url);
        }

        return { success: false, error: 'Google sign-in was interrupted.' };
      } catch (err) {
        console.error('[Google Auth Mobile] Error in mobile sign in:', err);
        return { success: false, error: err?.message || 'Mobile Google sign-in failed' };
      }
    }

    // Fallback simulation
    return await this.loginWithGoogleSimulated();
  },

  async handleOAuthCallbackUrl(url) {
    const client = supabase || supabaseManager?.getClient();
    if (!client || !url) {
      return { success: false, error: 'Authentication service unavailable or missing URL.' };
    }

    try {
      const params = extractAuthParamsFromUrl(url);

      if (params.error || params.error_description) {
        return {
          success: false,
          error: params.error_description || params.error || 'Authentication failed',
        };
      }

      let sessionUser = null;

      // 1. PKCE Authorization Code Exchange
      if (params.code) {
        console.log('[Google Auth Callback] Exchanging authorization code for session...');
        const { data, error } = await client.auth.exchangeCodeForSession(params.code);
        if (error) {
          console.warn('[Google Auth Callback] exchangeCodeForSession error:', error.message);
          return { success: false, error: error.message };
        }
        sessionUser = data?.session?.user;
      }
      // 2. Implicit access_token & refresh_token fragments
      else if (params.access_token) {
        console.log('[Google Auth Callback] Setting session from token fragments...');
        const { data, error } = await client.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token || '',
        });
        if (error) {
          console.warn('[Google Auth Callback] setSession error:', error.message);
          return { success: false, error: error.message };
        }
        sessionUser = data?.session?.user;
      }

      // If user is not yet resolved from session, fetch directly
      if (!sessionUser) {
        const { data: userData } = await client.auth.getUser();
        sessionUser = userData?.user;
      }
      if (!sessionUser) {
        const { data: sessionData } = await client.auth.getSession();
        sessionUser = sessionData?.session?.user;
      }

      if (!sessionUser) {
        return { success: false, error: 'Failed to retrieve authenticated user details.' };
      }

      const safeUser = await this.syncOAuthUser(sessionUser);
      this.setCurrentUser(safeUser);

      try {
        await this.logAccountActivity(safeUser.id, 'oauth_google_login', 'User signed in via Google account');
      } catch (_e) {}

      return {
        success: true,
        user: safeUser,
      };
    } catch (err) {
      console.error('[Google Auth Callback] Error processing callback URL:', err);
      return { success: false, error: err?.message || 'Error completing Google sign-in' };
    }
  },

  async syncOAuthUser(sessionUser) {
    if (!sessionUser) return null;
    const u = sessionUser;
    const googleEmail = (u.email || '').toLowerCase();
    const fullName =
      u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Google Rider';
    const avatarUrl =
      u.user_metadata?.avatar_url ||
      u.user_metadata?.picture ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';

    let existingRecord = null;
    try {
      const allUsers = await userService.getAllUsers();
      existingRecord = (allUsers || []).find((user) => (user.email || '').toLowerCase() === googleEmail);
    } catch (_e) {}

    let safeUser;
    if (existingRecord) {
      safeUser = {
        ...existingRecord,
        id: existingRecord.id || existingRecord.user_id || u.id,
        name: existingRecord.name || fullName,
        email: googleEmail,
        role: existingRecord.role || 'user',
        avatar: existingRecord.avatar || avatarUrl,
        auth_provider: 'google',
      };
      try {
        await userService.updateUser(safeUser.id, safeUser);
      } catch (_e) {}
    } else {
      const createRes = await userService.createUser({
        name: fullName,
        email: googleEmail,
        role: 'user',
        avatar: avatarUrl,
        phone: u.phone || '',
        address: '',
        password: `OAuth_${(u.id || '').substring(0, 8)}!Secure`,
      });
      if (createRes.success && createRes.user) {
        safeUser = { ...createRes.user, auth_provider: 'google' };
      } else {
        safeUser = {
          id: u.id,
          user_id: u.id,
          name: fullName,
          email: googleEmail,
          role: 'user',
          avatar: avatarUrl,
          phone: u.phone || '',
          address: '',
          auth_provider: 'google',
        };
      }
    }

    return safeUser;
  },

  async loginWithGoogleSimulated() {
    const googleEmail = 'rider.google@gmail.com';
    let userRecord = null;
    try {
      const all = await userService.getAllUsers();
      userRecord = (all || []).find((u) => (u.email || '').toLowerCase() === googleEmail);
    } catch (_e) {}

    if (!userRecord) {
      const createRes = await userService.createUser({
        name: 'Google Rider',
        email: googleEmail,
        phone: '+63 917 888 7766',
        address: 'BGC, Taguig, Metro Manila',
        role: 'user',
        avatar:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        password: 'GoogleOAuth2026!SecureAuth',
      });
      if (createRes.success && createRes.user) {
        userRecord = createRes.user;
      } else {
        userRecord = {
          id: 'usr-google-demo',
          name: 'Google Rider',
          email: googleEmail,
          role: 'user',
          phone: '+63 917 888 7766',
          address: 'BGC, Taguig, Metro Manila',
          avatar:
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        };
      }
    }

    const { password: _, ...safeUser } = userRecord;
    this.setCurrentUser(safeUser);
    try {
      await this.logAccountActivity(safeUser.id, 'oauth_google_login', 'User signed in via Google account');
    } catch (_e) {}

    return {
      success: true,
      user: safeUser,
    };
  },

  demoCustomerLogin() {
    if (!APP_CONFIG.demo.enableDemoLogins) {
      return { success: false, error: 'Demo logins are disabled in this environment.' };
    }
    const { password: _, ...safeUser } = CUSTOMER_USER;
    this.setCurrentUser(safeUser);
    return {
      success: true,
      user: safeUser,
    };
  },

  adminLogin() {
    if (!APP_CONFIG.demo.enableDemoLogins) {
      return { success: false, error: 'Demo logins are disabled in this environment.' };
    }
    const { password: _, ...safeUser } = ADMIN_USER;
    this.setCurrentUser(safeUser);
    return {
      success: true,
      user: safeUser,
    };
  },

  async register({ name, email, phone, address, password, isAdmin = false, adminKey = '' }) {
    if (isAdmin) {
      if (adminKey.trim() !== ADMIN_SECRET_KEY) {
        return {
          success: false,
          error: 'Invalid Admin Security Key. Please contact MotoTrack support.',
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

      if (!isAdmin && notificationService?.notifyAdminCustomerRegistered) {
        try {
          notificationService.notifyAdminCustomerRegistered({
            customerName: safeUser.name,
            email: safeUser.email,
            phone: safeUser.phone,
          });
        } catch (_e) {}
      }

      return { success: true, user: safeUser };
    }

    return res;
  },

  logout() {
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    try {
      adminSecurityService.lockSession();
      // Clear mock notifications and bookings from local storage to prevent bleed-over to new accounts
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('@mototrack_user_notifications');
        window.localStorage.removeItem('@mototrack_garage_bookings');
      }
    } catch (_e) {}
    this.setCurrentUser(null);
    return { success: true };
  },
};
