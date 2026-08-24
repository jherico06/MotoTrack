import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [redirectReason, setRedirectReason] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Load saved user session on mount
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

  const demoCustomerLogin = () => {
    const res = authService.demoCustomerLogin();
    if (res.success) {
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
    redirectReason,
    setRedirectReason,
    isLoadingAuth,
    validatePasswordStrength,
    sendSignupOtp,
    verifySignupOtp,
    login,
    loginCustomer,
    loginAdmin,
    demoCustomerLogin,
    adminLogin,
    register,
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
