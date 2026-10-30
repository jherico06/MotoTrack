// ─── AUTHENTICATION & USER DATABASE (SUPABASE AUTH + OTP + RBAC) ─────────────
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { appStorage } from '../system/storageAdapter.js';
import { supabase, supabaseManager } from '../../lib/supabase.js';
import { userService, ADMIN_USER, CUSTOMER_USER, ADMIN_SECRET_KEY } from '../staff/userService.js';
import { adminSecurityService } from './adminSecurityService.js';
import { emailService } from '../notifications/emailService.js';
import { notificationService } from '../notifications/notificationService.js';
import { APP_CONFIG } from '../../config';
import { APP_ROLES } from '../../constants/roles.js';
import { LEGACY_MECHANIC_BLOCKED_MESSAGE } from '../../utils/permissions.js';

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

function getGoogleRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${window.location.pathname || '/'}`;
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return Linking.createURL('auth-callback');
  }
  return Linking.createURL('auth-callback', { scheme: 'mototrack' });
}

function isLanExpoGoRedirect(url) {
  return typeof url === 'string' && /exp:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(url);
}

let oauthCallbackInFlight = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        const current = this.getCurrentUser();
        if (current && (current.id === userId || current.user_id === userId)) {
          this.setCurrentUser({
            ...current,
            ...(res.user || {}),
            must_change_password: false,
          });
        }
      } catch (_e) {}
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

  /**
   * Send 6-Digit OTP for Password Reset / Recovery (Admin & Customer)
   */
  async requestPasswordResetOtp({ email }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid registered email address.' };
    }

    let targetUser = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('user_id, name, email, status')
          .ilike('email', cleanEmail)
          .maybeSingle();
        if (data) targetUser = data;
      } catch (_e) {}
    }

    if (!targetUser) {
      try {
        const all = await userService.getAllUsers();
        targetUser = (all || []).find((u) => String(u.email || '').toLowerCase() === cleanEmail);
      } catch (_e) {}
    }

    if (!targetUser && cleanEmail === ADMIN_USER.email.toLowerCase()) {
      targetUser = ADMIN_USER;
    }

    if (!targetUser) {
      return {
        success: false,
        error: 'No account found with that email address.',
      };
    }

    if (targetUser.status === 'disabled' || targetUser.status === 'inactive') {
      return {
        success: false,
        error: 'This account is disabled. Please contact the store administrator.',
      };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const otpId = 'otp-reset-' + Date.now();

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
        console.warn('Supabase password reset OTP insert note:', e);
      }
    }

    try {
      await emailService.sendOtpEmail({
        email: cleanEmail,
        otpCode,
        name: targetUser.name || 'MotoTrack User',
      });
    } catch (err) {
      console.warn('Password reset email dispatch warning:', err);
    }

    try {
      appStorage.setItem(
        STORAGE_KEYS.PENDING_OTP + '_reset',
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
      message: `A 6-digit password reset code has been sent to ${cleanEmail}.`,
    };
  },

  /**
   * Verify Password Reset OTP and update the user's password in Supabase
   */
  async confirmPasswordResetOtp({ email, otp, newPassword }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    const cleanNewPwd = String(newPassword || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: 'Please enter the 6-digit verification code.' };
    }

    const strength = this.validatePasswordStrength(cleanNewPwd);
    if (!strength.isStrong) {
      return {
        success: false,
        error: strength.feedback || 'Please choose a stronger password.',
      };
    }

    let isOtpValid = false;

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
          if (expiresAtMs > Date.now()) {
            isOtpValid = true;
            await supabase
              .from('otp_verifications')
              .update({ verified: true })
              .eq('id', record.id);
          }
        }
      } catch (e) {
        console.warn('Supabase reset OTP verification error:', e);
      }
    }

    if (!isOtpValid) {
      try {
        const pendingRaw = appStorage.getItem(STORAGE_KEYS.PENDING_OTP + '_reset');
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (
            String(pending.email || '').toLowerCase() === cleanEmail &&
            pending.otpCode === cleanOtp &&
            new Date(pending.expiresAt).getTime() > Date.now()
          ) {
            isOtpValid = true;
          }
        }
      } catch (_e) {}
    }

    if (!isOtpValid) {
      return {
        success: false,
        error: 'Invalid or expired verification code. Please check your code and try again.',
      };
    }

    const resetRes = await userService.resetPasswordByEmail(cleanEmail, cleanNewPwd);
    if (!resetRes?.success) {
      return resetRes;
    }

    try {
      appStorage.removeItem(STORAGE_KEYS.PENDING_OTP + '_reset');
      emailService.sendNotification({
        title: 'MotoTrack Security Alert: Password Reset Completed',
        message:
          'Your account password was reset using a 6-digit email verification code. If this was not you, contact support immediately.',
        type: 'security',
        userId: resetRes.user?.user_id || resetRes.user?.id,
      });
    } catch (_e) {}

    return resetRes;
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
    if (res.success && res.user?.role === APP_ROLES.MECHANIC) {
      // Mechanic is a retired role: legacy accounts can no longer sign in.
      try {
        if (supabase) await supabase.auth.signOut();
      } catch (_e) {}
      return { success: false, error: LEGACY_MECHANIC_BLOCKED_MESSAGE };
    }
    if (res.success) {
      if (res.user?.role === 'admin') {
        adminSecurityService.lockSession(res.user);
      }
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
      return {
        success: false,
        error: 'Google sign-in is unavailable because the database client is not configured.',
      };
    }

    const redirectUrl = getGoogleRedirectUrl();
    const oauthOptions = {
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    };

    // ─── 1. WEB BROWSER FLOW ───
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      try {
        const { data, error } = await client.auth.signInWithOAuth(oauthOptions);

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
          window.location.assign(data.url);
          return { success: true, redirecting: true };
        }
        return { success: false, error: 'Could not start Google sign-in.' };
      } catch (err) {
        console.warn('Supabase OAuth Google initialization error (web):', err);
        return { success: false, error: err?.message || 'Failed to initialize Google sign in' };
      }
    }

    // ─── 2. MOBILE REACT NATIVE / EXPO FLOW ───
    if (Platform.OS !== 'web') {
      try {
        WebBrowser.maybeCompleteAuthSession();
        console.log('[Google Auth Mobile] Starting OAuth flow with redirectUrl:', redirectUrl);

        const { data, error } = await client.auth.signInWithOAuth(oauthOptions);

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

        console.log('[Google Auth Mobile] Opening auth session...', redirectUrl);
        let capturedUrl = null;
        const linkSub = Linking.addEventListener('url', ({ url }) => {
          if (url && (url.includes('code=') || url.includes('access_token=') || url.includes('error='))) {
            capturedUrl = url;
            try {
              WebBrowser.dismissBrowser();
            } catch (_e) {}
          }
        });

        let authResponse;
        try {
          // Never use openBrowserAsync on iOS — Safari tries to load localhost/LAN
          // and shows "couldn't connect to the server".
          authResponse = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
          if (!capturedUrl) {
            await sleep(800);
          }
        } finally {
          linkSub?.remove?.();
        }

        console.log('[Google Auth Mobile] WebBrowser result type:', authResponse?.type, 'captured:', Boolean(capturedUrl));

        const callbackUrl = capturedUrl || (authResponse?.type === 'success' ? authResponse.url : null);
        if (callbackUrl) {
          return await this.handleOAuthCallbackUrl(callbackUrl);
        }

        const pending = await this.waitForPendingGoogleCallback();
        if (pending?.success) return pending;

        if (isLanExpoGoRedirect(redirectUrl)) {
          return {
            success: false,
            error:
              'iPhone cannot open your computer address after Google login. Stop Expo, run npx expo start --tunnel, reload Expo Go, then add the new exp://…exp.direct Redirect URL in Supabase.',
          };
        }

        if (authResponse?.type === 'cancel' || authResponse?.type === 'dismiss') {
          return {
            success: false,
            cancelled: true,
            error:
              'Google sign-in was closed before the app got the result. In Supabase → Authentication → URL Configuration, add this exact Redirect URL: ' +
              redirectUrl,
          };
        }

        return {
          success: false,
          error:
            'Google sign-in did not return to the app. Add this Redirect URL in Supabase: ' + redirectUrl,
        };
      } catch (err) {
        console.error('[Google Auth Mobile] Error in mobile sign in:', err);
        return { success: false, error: err?.message || 'Mobile Google sign-in failed' };
      }
    }

    return {
      success: false,
      error: 'Google sign-in could not be started on this device.',
    };
  },

  async waitForPendingGoogleCallback(timeoutMs = 2500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (oauthCallbackInFlight) {
        try {
          const res = await oauthCallbackInFlight;
          if (res?.success) return res;
        } catch (_e) {}
      }
      const existing = this.getCurrentUser();
      if (existing?.auth_provider === 'google') {
        return { success: true, user: existing };
      }
      await sleep(120);
    }
    return null;
  },

  async handleOAuthCallbackUrl(url) {
    if (oauthCallbackInFlight) {
      return oauthCallbackInFlight;
    }
    oauthCallbackInFlight = this.completeOAuthCallbackUrl(url).finally(() => {
      oauthCallbackInFlight = null;
    });
    return oauthCallbackInFlight;
  },

  async completeOAuthCallbackUrl(url) {
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
    if (supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .ilike('email', googleEmail)
          .maybeSingle();
        if (data) {
          existingRecord = {
            ...data,
            id: data.user_id || data.id,
            user_id: data.user_id || data.id,
          };
        }
      } catch (_e) {}
    }
    if (!existingRecord) {
      try {
        const allUsers = await userService.getAllUsers();
        existingRecord = (allUsers || []).find(
          (user) => (user.email || '').toLowerCase() === googleEmail
        );
      } catch (_e) {}
    }

    let safeUser;
    if (existingRecord) {
      const { password: _pwd, ...restExisting } = existingRecord;
      safeUser = {
        ...restExisting,
        id: existingRecord.id || existingRecord.user_id || u.id,
        user_id: existingRecord.user_id || existingRecord.id || u.id,
        name: existingRecord.name || fullName,
        email: googleEmail,
        role: existingRecord.role || 'user',
        avatar: existingRecord.avatar || avatarUrl,
        auth_provider: 'google',
      };
      try {
        await userService.updateUser(safeUser.id, {
          name: safeUser.name,
          avatar: safeUser.avatar,
        });
      } catch (_e) {}
      if (safeUser.role === 'admin') {
        adminSecurityService.lockSession(safeUser);
      }
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
    if (!APP_CONFIG.demo.enableDemoLogins) {
      return {
        success: false,
        error: 'Google demo sign-in is disabled. Use email and password, or enable Google in Supabase Authentication.',
      };
    }
    const safeUser = {
      id: 'usr-google-demo',
      user_id: 'usr-google-demo',
      name: 'Google Rider',
      email: 'rider.google@gmail.com',
      role: 'user',
      phone: '',
      address: '',
      avatar: null,
      auth_provider: 'google-demo',
    };
    this.setCurrentUser(safeUser);
    return {
      success: true,
      demo: true,
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
    adminSecurityService.lockSession(safeUser);
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
