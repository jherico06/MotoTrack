import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return authService.getCurrentUser();
    } catch (_e) {
      return null;
    }
  });
  const [redirectReason, setRedirectReason] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Sync saved user session on mount, Supabase OAuth redirect, and across tabs
  useEffect(() => {
    try {
      const saved = authService.getCurrentUser();
      if (saved) {
        setCurrentUser(saved);
      }
    } catch (e) {
      console.warn('Error loading user session:', e);
    } finally {
      setIsLoadingAuth(false);
    }

    // Helper to sync Supabase Google OAuth session into app state.
    // Must not run other Supabase calls inside onAuthStateChange — that deadlocks
    // the auth lock and Google web login never finishes.
    const syncGoogleSession = (sessionUser) => {
      if (!sessionUser) return;
      setTimeout(() => {
        void (async () => {
          try {
            const safeUser = await authService.syncOAuthUser(sessionUser);
            if (!safeUser) return;
            authService.setCurrentUser(safeUser);
            setCurrentUser(safeUser);
            setRedirectReason('');

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              const publicScreen = params.get('screen');
              const keepPublic =
                publicScreen === 'rider-run' ||
                publicScreen === 'confirm-delivery' ||
                publicScreen === 'rider-dashboard';
              const hash = String(window.location.hash || '');
              const isOAuthCallback =
                hash.includes('access_token') ||
                hash.includes('id_token') ||
                hash.includes('error=') ||
                window.location.search.includes('code=');
              if (isOAuthCallback && !keepPublic) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            }
          } catch (e) {
            console.warn('Google session sync failed:', e);
          }
        })();
      }, 0);
    };

    // Listen for Supabase OAuth redirect (Google Sign In callback)
    let authListenerUnsub = null;
    if (supabase) {
      try {
        const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
          if (
            (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
            session?.user
          ) {
            syncGoogleSession(session.user);
          }
        });
        authListenerUnsub = authSub?.subscription?.unsubscribe;
      } catch (err) {
        console.warn('Supabase auth state change listener error:', err);
      }
    }

    // 3. Mobile Deep Link Listener for OAuth callback
    let linkingSub = null;
    if (Platform.OS !== 'web') {
      const handleDeepLink = async (event) => {
        const url = event?.url;
        if (url && (url.includes('code=') || url.includes('access_token='))) {
          const res = await authService.handleOAuthCallbackUrl(url);
          if (res?.success && res.user) {
            setCurrentUser(res.user);
            setRedirectReason('');
          }
        }
      };

      linkingSub = Linking.addEventListener('url', handleDeepLink);

      Linking.getInitialURL().then((url) => {
        if (url && (url.includes('code=') || url.includes('access_token='))) {
          handleDeepLink({ url });
        }
      });
    }

    const handleStorage = (e) => {
      if (e.key === 'mototrack_current_session') {
        try {
          const user = e.newValue ? JSON.parse(e.newValue) : null;
          setCurrentUser(user);
        } catch (_err) {
          setCurrentUser(null);
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', handleStorage);
      return () => {
        authListenerUnsub?.();
        linkingSub?.remove?.();
        if (typeof window.removeEventListener === 'function') {
          window.removeEventListener('storage', handleStorage);
        }
      };
    }

    return () => {
      authListenerUnsub?.();
      linkingSub?.remove?.();
    };
  }, []);

  const validatePasswordStrength = (password) => {
    return authService.validatePasswordStrength(password);
  };

  const sendSignupOtp = async ({ email, name }) => {
    return await authService.sendSignupOtp({ email, name });
  };

  const verifySignupOtp = async ({ email, otp, registrationData }) => {
    const res = await authService.verifySignupOtp({ email, otp, registrationData });
    if (res.success) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const login = async (email, password, requiredRole = null) => {
    const res = await authService.login(email, password, requiredRole);
    if (res.success) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const loginCustomer = async (email, password) => {
    return await login(email, password, null);
  };

  const loginAdmin = async (email, password) => {
    return await login(email, password, 'admin');
  };

  const loginRider = async (identifier, password) => {
    return await login(identifier, password, 'rider');
  };

  const demoCustomerLogin = () => {
    const res = authService.demoCustomerLogin();
    if (res.success) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const loginWithGoogle = async () => {
    const res = await authService.loginWithGoogle();
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const loginWithGoogleSimulated = async () => {
    const res = await authService.loginWithGoogleSimulated();
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const adminLogin = () => {
    const res = authService.adminLogin();
    if (res.success) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const register = async (params) => {
    const res = await authService.register(params);
    if (res.success) {
      setCurrentUser(res.user);
      setRedirectReason('');
    }
    return res;
  };

  const updateProfile = async (updates) => {
    if (!currentUser) return { success: false, error: 'No active session' };
    const userId = currentUser.id || currentUser.user_id;
    const res = await authService.updateProfile(userId, updates);
    if (res.success && res.user) {
      setCurrentUser(res.user);
    }
    return res;
  };

  const changeEmail = async ({ newEmail, currentPassword }) => {
    if (!currentUser) return { success: false, error: 'No active session' };
    const userId = currentUser.id || currentUser.user_id;
    const res = await authService.changeEmail(userId, { newEmail, currentPassword });
    if (res.success && res.user) {
      setCurrentUser(res.user);
    }
    return res;
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    if (!currentUser) return { success: false, error: 'No active session' };
    const userId = currentUser.id || currentUser.user_id;
    return await authService.changePassword(userId, { currentPassword, newPassword });
  };

  const getAccountLogs = async () => {
    if (!currentUser) return [];
    const userId = currentUser.id || currentUser.user_id;
    return await authService.getAccountLogs(userId);
  };

  const logAccountActivity = async (action, description, metadata = {}) => {
    if (!currentUser) return null;
    const userId = currentUser.id || currentUser.user_id;
    return await authService.logAccountActivity(userId, action, description, metadata);
  };

  const logout = () => {
    authService.logout();
    setCurrentUser(null);
    setRedirectReason('');
  };

  const value = {
    currentUser,
    setCurrentUser,
    isAuthenticated: Boolean(currentUser),
    isAdmin: Boolean(currentUser && currentUser.role === 'admin'),
    isRider: Boolean(currentUser && currentUser.role === 'rider'),
    redirectReason,
    setRedirectReason,
    isLoadingAuth,
    validatePasswordStrength,
    sendSignupOtp,
    verifySignupOtp,
    login,
    loginCustomer,
    loginAdmin,
    loginRider,
    demoCustomerLogin,
    loginWithGoogle,
    loginWithGoogleSimulated,
    adminLogin,
    register,
    updateProfile,
    changeEmail,
    changePassword,
    getAccountLogs,
    logAccountActivity,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
