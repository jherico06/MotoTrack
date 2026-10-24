import React, { useState, useEffect } from 'react';
import { AuthProvider, CartProvider, WishlistProvider, ThemeProvider, useTheme, useAuth, useCart, useWishlist } from '../context';
import {
  ShopPage,
  LoginPage,
  SignUpPage,
  GaragePage,
  WishlistPage,
  AdminDashboard,
  CustomizerPage,
  ProfilePage,
  NotificationsPage,
  DeliveryConfirmPage,
  RiderRunPage,
  RiderDashboard,
  ProductDetailsPage,
  StaffVerifyEmailPage,
  ForceChangePasswordPage,
} from '../pages';

import {
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  StatusBar as RNStatusBar,
  LogBox,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { BootstrapIcon } from '../components/common';
import CartModal from '../components/modals/CartModal.jsx';
import ErrorBoundary from '../components/common/ErrorBoundary.jsx';
import { adminSecurityService } from '../services/auth/adminSecurityService.js';
import { authService } from '../services/auth/authService.js';
import { systemSettingsService } from '../services/system/systemSettingsService.js';
import { APP_ROLES } from '../constants/roles.js';
import {
  LEGACY_MECHANIC_BLOCKED_MESSAGE,
  homeScreenForRole,
  isAdmin,
  isMechanic,
  isRider,
  mustChangeStaffPassword,
} from '../utils/permissions.js';
import {
  useFonts,
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

// Configure Android status bar to be translucent edge-to-edge
if (Platform.OS === 'android') {
  try {
    RNStatusBar.setTranslucent(true);
    RNStatusBar.setBackgroundColor('transparent');
  } catch (_e) {}
}

// Suppress LogBox developer warning popups on mobile screen
LogBox.ignoreLogs([
  'Text.defaultProps',
  'TextInput.defaultProps',
  'Sending `onAnimatedValueUpdate`',
]);
LogBox.ignoreAllLogs(true);

// Enforce Plus Jakarta Sans as the default font across all React Native Text & TextInput elements
try {
  if (Text.defaultProps == null) {
    Text.defaultProps = {};
  }
  Text.defaultProps.style = [{ fontFamily: 'PlusJakartaSans' }, Text.defaultProps.style];

  if (TextInput.defaultProps == null) {
    TextInput.defaultProps = {};
  }
  TextInput.defaultProps.style = [{ fontFamily: 'PlusJakartaSans' }, TextInput.defaultProps.style];
} catch (_e) {}

// Global Web Font Injection for Plus Jakarta Sans & Bootstrap Icons
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const initSet = systemSettingsService.getSettings();
  document.title = initSet?.storeName
    ? `${initSet.storeName}${initSet.storeTagline ? ' - ' + initSet.storeTagline : ''}`
    : 'MotoTrack - Motorparts and Accessories';
  if (!document.getElementById('bootstrap-icons-cdn')) {
    const bsLink = document.createElement('link');
    bsLink.id = 'bootstrap-icons-cdn';
    bsLink.rel = 'stylesheet';
    bsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
    document.head.appendChild(bsLink);
  }
  if (!document.getElementById('plus-jakarta-google-font')) {
    const link = document.createElement('link');
    link.id = 'plus-jakarta-google-font';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap';
    document.head.appendChild(link);
  }
  if (!document.getElementById('plus-jakarta-global-styles')) {
    const style = document.createElement('style');
    style.id = 'plus-jakarta-global-styles';
    style.innerHTML = `
      *, *::before, *::after {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      html, body, #root, #__next, [data-reactroot] {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      div, span, p, a, button, input, textarea, select, label, h1, h2, h3, h4, h5, h6,
      [class*="css-text"], [class*="r-fontFamily"], [dir="auto"], [dir] {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      /* Ensure React Native Web inner text elements always use Plus Jakarta Sans */
      [class*="r-fontFamily-"] {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      code, pre, kbd, samp, .font-mono, [data-font="mono"], [style*="monospace"] {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        font-feature-settings: "tnum" 1, "zero" 1 !important;
      }
      .bi {
        font-family: 'bootstrap-icons' !important;
        speak: none;
        font-style: normal;
        font-weight: normal;
        font-variant: normal;
        text-transform: none;
        line-height: 1;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      /* Modern subtle orange scrollbar matching brand */
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #EA580C;
        border-radius: 9999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #C2410C;
      }
      ::-webkit-scrollbar-corner {
        background: transparent;
      }
      ::-webkit-scrollbar-button {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      html, body, #root, #__next, [data-reactroot], * {
        scrollbar-width: thin;
        scrollbar-color: #EA580C transparent;
      }
      /* Subtle custom scrollbars for table containers */
      [data-table-scroll="true"]::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      [data-table-scroll="true"]::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.03);
        border-radius: 9999px;
      }
      [data-table-scroll="true"]::-webkit-scrollbar-thumb {
        background: #EA580C;
        border-radius: 9999px;
      }
      [data-table-scroll="true"]::-webkit-scrollbar-thumb:hover {
        background: #C2410C;
      }
      /* Utility to hide scrollbar if specifically requested */
      .no-scrollbar::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      .no-scrollbar {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      /* Hide native browser password reveal eye (Edge / IE / Chromium) & clear buttons */
      input::-ms-reveal,
      input::-ms-clear {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      input::-webkit-contacts-auto-fill-button,
      input::-webkit-credentials-auto-fill-button {
        visibility: hidden !important;
        display: none !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        margin: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function parsePublicRoute(url) {
  const out = { screen: '', token: '' };
  if (!url && Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    url = window.location.href;
  }
  if (!url) return out;
  try {
    const normalized = String(url).replace(/^exp:\/\//i, 'http://');
    const u = new URL(normalized, Platform.OS === 'web' ? window.location.origin : 'https://mototrack.local');
    const hash = String(u.hash || '').replace(/^#\/?/, '');
    const hashQuery = hash.includes('=') || hash.includes('?') ? hash.replace(/^\?/, '') : '';
    const params = new URLSearchParams(u.search);
    const hashParams = new URLSearchParams(hashQuery);
    out.screen = params.get('screen') || hashParams.get('screen') || '';
    out.token = params.get('token') || hashParams.get('token') || '';
    if (!out.screen && (hash === 'rider-run' || hash === 'confirm-delivery')) out.screen = hash;
    if (!out.screen && ['wishlist', 'garage', 'customizer', 'shop', 'profile', 'orders', 'admin', 'login', 'signup'].includes(hash)) {
      out.screen = hash;
    }
    return out;
  } catch (_e) {}
  try {
    const parsed = ExpoLinking.parse(String(url));
    const q = parsed?.queryParams || {};
    out.screen = String(q.screen || '');
    out.token = String(q.token || '');
  } catch (_e) {}
  return out;
}

function MainAppRouter() {
  const getInitialScreen = () => {
    try {
      const { screen: s } = parsePublicRoute();
      if (s === 'orders') {
        return 'profile';
      }
      if (s === 'notifications') {
        return 'profile';
      }
      if (s === 'confirm-delivery') {
        return 'confirm-delivery';
      }
      if (s === 'rider-run') {
        return 'rider-run';
      }
      // Old rider-login links open the shared app login
      if (s === 'rider-login') {
        return 'login';
      }
      if (s === 'rider-dashboard') {
        return 'rider-dashboard';
      }
      if (['login', 'signup', 'admin', 'garage', 'wishlist', 'shop', 'customizer', 'profile', 'notifications', 'confirm-delivery', 'rider-run', 'rider-dashboard'].includes(s)) {
        return s;
      }
    } catch (_e) {}
    return 'shop';
  };

  const [currentScreen, setCurrentScreen] = useState(getInitialScreen);
  const [customizerProduct, setCustomizerProduct] = useState(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState(() => {
    try {
      const { screen: s } = parsePublicRoute();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (s === 'orders' || tab === 'orders') return { tab: 'orders', key: 1 };
        if (s === 'notifications' || tab === 'notifications') return { tab: 'notifications', key: 1 };
        if (tab) return { tab, key: 1 };
      }
    } catch (_e) {}
    return { tab: 'overview', key: 0 };
  });

  const [visitedScreens, setVisitedScreens] = useState(() => {
    const s = getInitialScreen();
    const canonical = s === 'services' ? 'garage' : s === 'orders' ? 'profile' : s;
    return new Set(['shop', canonical]);
  });

  useEffect(() => {
    if (['shop', 'garage', 'services', 'customizer', 'profile', 'orders'].includes(currentScreen)) {
      const canonical = currentScreen === 'services' ? 'garage' : currentScreen === 'orders' ? 'profile' : currentScreen;
      setVisitedScreens((prev) => {
        if (prev.has(canonical)) return prev;
        const next = new Set(prev);
        next.add(canonical);
        return next;
      });
    }
  }, [currentScreen]);

  const [allowMobileAdmin, setAllowMobileAdmin] = useState(false);
  const { currentUser, logout, adminLogin, redirectReason, setRedirectReason } = useAuth();
  const { addToCart, cartItemCount, cartTotal, showToast } = useCart();
  const { wishlistCount } = useWishlist();

  useEffect(() => {
    const applyBrandMeta = (s) => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        if (s?.storeName) {
          document.title = `${s.storeName}${s.storeTagline ? ' - ' + s.storeTagline : ''}`;
        }
        if (s?.storeLogoUrl) {
          try {
            let favicon = document.querySelector("link[rel*='icon']");
            if (!favicon) {
              favicon = document.createElement('link');
              favicon.rel = 'shortcut icon';
              document.head.appendChild(favicon);
            }
            favicon.href = s.storeLogoUrl;
          } catch (_e) {}
        }
      }
    };

    applyBrandMeta(systemSettingsService.getSettings());
    systemSettingsService.fetchRemoteSettings();
    const unsub = systemSettingsService.subscribe(applyBrandMeta);
    // Downpayment expiry is handled by Postgres pg_cron only
    // (expire_unpaid_downpayment_bookings). Do NOT poll that RPC from the client —
    // it flooded Supabase API/log ingestion when every open tab called it.
    return unsub;
  }, []);

  const navigateScreen = (screen, params = null) => {
    if (screen === 'orders') {
      handleNavigateToProfile('orders');
      return;
    }
    if (screen === 'notifications') {
      handleNavigateToProfile('notifications');
      return;
    }
    if (screen === 'profile') {
      handleNavigateToProfile(params?.tab || 'overview');
      return;
    }
    if (params?.product) {
      if (screen === 'customizer') {
        setCustomizerProduct(params.product);
      } else if (screen === 'product-details') {
        setSelectedProductDetails(params.product);
      }
    }
    setCurrentScreen(screen);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.pushState) {
      try {
        const url = new URL(window.location.href);
        if (screen === 'shop') {
          url.searchParams.delete('screen');
          url.searchParams.delete('token');
          url.searchParams.delete('tab');
        } else {
          url.searchParams.set('screen', screen);
        }
        if (screen !== 'profile') {
          url.searchParams.delete('tab');
        }
        if (screen !== 'rider-run' && screen !== 'confirm-delivery') {
          url.searchParams.delete('token');
        }
        window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
      } catch (_e) {}
    }
  };

  const handleNavigateToProfile = (tab = 'overview') => {
    const tabName = typeof tab === 'object' && tab !== null ? tab.tab : tab;
    if (!currentUser && tabName !== 'orders' && tabName !== 'garage') {
      setRedirectReason(
        tabName === 'notifications'
          ? 'Please sign in to view your notifications in your Customer Dashboard.'
          : 'Please sign in to view your Customer Dashboard.'
      );
      navigateScreen('login');
    } else {
      setProfileInitialTab({ tab: tabName, key: Date.now() });
      setCurrentScreen('profile');
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.pushState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('screen', 'profile');
          if (tabName && tabName !== 'overview') {
            url.searchParams.set('tab', tabName);
          } else {
            url.searchParams.delete('tab');
          }
          url.searchParams.delete('token');
          window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
        } catch (_e) {}
      }
    }
  };

  const handleAuthSuccess = (user) => {
    const resolvedUser = user || authService.getCurrentUser() || currentUser;
    if (mustChangeStaffPassword(resolvedUser)) {
      navigateScreen('force-change-password');
      return;
    }
    navigateScreen(homeScreenForRole(resolvedUser?.role));
  };

  const handleLogout = () => {
    try {
      adminSecurityService.lockSession(currentUser);
    } catch (_e) {}
    const wasRider = isRider(currentUser);
    logout();
    navigateScreen(wasRider ? 'login' : 'shop');
    showToast('Logged out successfully');
  };

  // â”€â”€â”€ STRICT ENVIRONMENT SEPARATION â”€â”€â”€
  // 1. Admin accounts can ONLY access the Admin Dashboard
  useEffect(() => {
    if (
      isAdmin(currentUser) &&
      currentScreen !== 'admin' &&
      currentScreen !== 'confirm-delivery' &&
      currentScreen !== 'rider-run'
    ) {
      const t = setTimeout(() => navigateScreen('admin'), 0);
      return () => clearTimeout(t);
    }
  }, [currentUser, currentScreen]);

  useEffect(() => {
    if (
      isRider(currentUser) &&
      currentScreen !== 'rider-dashboard' &&
      currentScreen !== 'rider-run' &&
      currentScreen !== 'confirm-delivery'
    ) {
      const t = setTimeout(() => navigateScreen('rider-dashboard'), 0);
      return () => clearTimeout(t);
    }
  }, [currentUser, currentScreen]);

  // Mechanic is a retired role: legacy mechanic sessions are blocked (see "Account unavailable" below).
  // There is no mechanic-dashboard route; ?screen=mechanic-dashboard falls back to the storefront.

  // 2. If user is already authenticated and on login/signup, route appropriately
  useEffect(() => {
    if (
      currentUser &&
      !isMechanic(currentUser) &&
      (currentScreen === 'login' || currentScreen === 'signup')
    ) {
      const t = setTimeout(() => {
        const next = homeScreenForRole(currentUser.role);
        if (next !== 'shop' || !redirectReason) {
          navigateScreen(next);
        }
      }, 0);
      return () => clearTimeout(t);
    }
  }, [currentUser, currentScreen, redirectReason]);

  // Deep links / scanned QR (web + Expo Go) should open rider/confirm screens
  useEffect(() => {
    const applyUrl = (url) => {
      const { screen, token } = parsePublicRoute(url);
      if (screen === 'rider-run' || screen === 'confirm-delivery') {
        setCurrentScreen(screen);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && token) {
          try {
            const next = new URL(window.location.href);
            next.searchParams.set('screen', screen);
            next.searchParams.set('token', token);
            window.history.replaceState({}, '', next.pathname + next.search);
          } catch (_e) {}
        }
      }
    };
    ExpoLinking.getInitialURL()
      .then((url) => applyUrl(url))
      .catch(() => {});
    const sub = ExpoLinking.addEventListener('url', (event) => applyUrl(event?.url));
    const handlePopState = () => {
      const s = getInitialScreen();
      setCurrentScreen(s);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
    }
    return () => {
      try {
        sub?.remove?.();
      } catch (_e) {}
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, []);

  // If user logs out or session ends while on protected screen (profile, orders), return to storefront
  useEffect(() => {
    const rawTab = typeof profileInitialTab === 'object' && profileInitialTab !== null ? profileInitialTab.tab : profileInitialTab;
    if (!currentUser && currentScreen === 'profile' && rawTab !== 'orders') {
      const t = setTimeout(() => navigateScreen('shop'), 0);
      return () => clearTimeout(t);
    }
  }, [currentUser, currentScreen, profileInitialTab]);

  // Staff must change temporary password before accessing role dashboards
  if (mustChangeStaffPassword(currentUser)) {
    return (
      <ForceChangePasswordPage
        onCompleted={() => {
          showToast('Password updated. Welcome to MotoTrack.');
          const role = authService.getCurrentUser()?.role || currentUser.role;
          navigateScreen(role === APP_ROLES.RIDER ? 'rider-dashboard' : homeScreenForRole(role));
        }}
        onLogout={() => {
          logout();
          navigateScreen('login');
        }}
      />
    );
  }

  // Authenticated rider dashboard
  if (isRider(currentUser)) {
    // Packing-label QR deep link opens Confirm Delivery inside the app (not the browser tab alone).
    if (currentScreen === 'confirm-delivery') {
      const parsed = parsePublicRoute();
      return (
        <DeliveryConfirmPage
          token={parsed.token}
          onDone={() => {
            navigateScreen('rider-dashboard');
            showToast('Back to My Deliveries');
          }}
        />
      );
    }
    return (
      <RiderDashboard
        onLogout={() => {
          logout();
          navigateScreen('login');
          showToast('Rider logged out');
        }}
      />
    );
  }

  // Legacy mechanic accounts: the role was retired, so never render any dashboard.
  if (isMechanic(currentUser)) {
    const leaveBlockedAccount = () => {
      logout();
      navigateScreen('login');
    };
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#F6F8FC',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 32,
            maxWidth: 460,
            width: '100%',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#FEF2F2',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <BootstrapIcon name="person-x-fill" size={30} color="#DC2626" />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '900',
              color: '#0F172A',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Account unavailable
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {LEGACY_MECHANIC_BLOCKED_MESSAGE}
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#EA580C',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 14,
              width: '100%',
              alignItems: 'center',
            }}
            onPress={leaveBlockedAccount}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Unauthenticated riders use the shared Login page (same as customers/admins)
  if (!currentUser && currentScreen === 'rider-dashboard') {
    return (
      <LoginPage
        onLoginSuccess={handleAuthSuccess}
        onNavigateToSignUp={() => navigateScreen('signup')}
        onNavigateToStore={() => navigateScreen('shop')}
      />
    );
  }

  // Public rider dashboard (no login) — temporary access token
  if (currentScreen === 'rider-run') {
    const parsed = parsePublicRoute();
    return <RiderRunPage token={parsed.token} />;
  }

  // Public rider confirmation (no login) — after hooks
  if (currentScreen === 'confirm-delivery') {
    const parsed = parsePublicRoute();
    return (
      <DeliveryConfirmPage
        token={parsed.token}
        onDone={() => navigateScreen('shop')}
      />
    );
  }

  // â”€â”€â”€ ADMIN ENVIRONMENT: ADMIN CAN ONLY ACCESS THE ADMIN DASHBOARD â”€â”€â”€
  if (isAdmin(currentUser)) {
    return (
      <AdminDashboard
        onNavigateToStore={() => {
          // Admin accounts cannot access the customer storefront.
          // Leaving the admin console signs out the admin session cleanly.
          adminSecurityService.lockSession(currentUser);
          logout();
          navigateScreen('shop');
          showToast('Signed out of Admin Console. Switched to Store.');
        }}
        onLogout={() => {
          adminSecurityService.lockSession(currentUser);
          logout();
          navigateScreen('shop');
          showToast('Admin logged out successfully');
        }}
      />
    );
  }

  // Screen Routing: ONLY Admin Dashboard is restricted to Web and Admin role
  if (currentScreen === 'admin') {
    if (Platform.OS !== 'web' && !allowMobileAdmin) {
      return (
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: '#F6F8FC',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 32,
              maxWidth: 460,
              width: '100%',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              ...(Platform.OS === 'web'
                ? { boxShadow: '0 8px 16px rgba(15, 23, 42, 0.08)' }
                : {
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                  }),
              elevation: 6,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#EFF6FF',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <BootstrapIcon name="display" size={30} color="#EA580C" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '900',
                color: '#0F172A',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Desktop Console Recommended
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: '#64748B',
                textAlign: 'center',
                lineHeight: 20,
                marginBottom: 24,
              }}
            >
              The MotoTrack Store Administrator Console is best viewed on a desktop browser, but you can also proceed to manage orders, inventory, and bookings on mobile.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#EA580C',
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 14,
                width: '100%',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 10,
              }}
              onPress={() => setAllowMobileAdmin(true)}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="shield-lock-fill" size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Open Mobile Admin Console</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: '#F1F5F9',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 14,
                width: '100%',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={() => navigateScreen('shop')}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="arrow-left" size={14} color="#475569" />
              <Text style={{ color: '#475569', fontWeight: '800', fontSize: 14 }}>Return to Store</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // If not authenticated, render the standard login page
    if (!currentUser) {
      return (
        <LoginPage
          onLoginSuccess={handleAuthSuccess}
          onNavigateToSignUp={() => navigateScreen('signup')}
          onNavigateToStore={() => navigateScreen('shop')}
        />
      );
    }

    // Role Check: If user is authenticated but not an admin, they can't access this dashboard.
    if (!isAdmin(currentUser)) {
      return (
        <ShopPage
          onNavigateToScreen={(screen, params) => {
            if (params?.product) {
              setCustomizerProduct(params.product);
            }
            if (screen === 'profile') {
              handleNavigateToProfile(params?.tab || 'overview');
            } else if (screen === 'orders') {
              handleNavigateToProfile('orders');
            } else if (screen === 'notifications') {
              handleNavigateToProfile('notifications');
            } else {
              navigateScreen(screen, params);
            }
          }}
        />
      );
    }

    return (
      <AdminDashboard
        onNavigateToStore={() => {
          adminSecurityService.lockSession(currentUser);
          navigateScreen('shop');
        }}
        onLogout={() => {
          adminSecurityService.lockSession(currentUser);
          logout();
          navigateScreen('shop');
        }}
      />
    );
  }

  if (currentScreen === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleAuthSuccess}
        onNavigateToSignUp={() => navigateScreen('signup')}
        onNavigateToStore={() => navigateScreen('shop')}
      />
    );
  }

  if (currentScreen === 'staff-verify') {
    let initialEmail = '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        initialEmail = window.sessionStorage?.getItem('mototrack_staff_verify_email') || '';
      } catch (_e) {}
    }
    return (
      <StaffVerifyEmailPage
        initialEmail={initialEmail}
        onBackToLogin={() => navigateScreen('login')}
        onVerified={() => {
          showToast('Email verified. Check your inbox for temporary login credentials.');
          navigateScreen('login');
        }}
      />
    );
  }

  if (currentScreen === 'signup') {
    return (
      <SignUpPage
        onLoginSuccess={handleAuthSuccess}
        onSignUpSuccess={handleAuthSuccess}
        onNavigateToLogin={() => navigateScreen('login')}
        onNavigateToStore={() => navigateScreen('shop')}
      />
    );
  }

  if (currentScreen === 'wishlist') {
    return (
      <WishlistPage
        onAddToCart={(product, qty) => addToCart(product, qty)}
        onNavigateToStore={() => navigateScreen('shop')}
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToLogin={() => navigateScreen('login')}
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab || 'profile')}
        onNavigateToCustomizer={() => navigateScreen('customizer')}
        onNavigateToCustomize={() => navigateScreen('customizer')}
        onNavigateToAdmin={() => navigateScreen('admin')}
        onNavigateToWishlist={() => navigateScreen('wishlist')}
        onNavigateToProductDetails={(product) => navigateScreen('product-details', { product })}
        onNavigateToScreen={(screen, params) => navigateScreen(screen, params)}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === 'notifications') {
    if (Platform.OS === 'web') {
      return (
        <ProfilePage
          initialTab="notifications"
          onNavigateToStore={() => navigateScreen('shop')}
          onNavigateToGarage={() => navigateScreen('garage')}
          onNavigateToOrders={() => handleNavigateToProfile('orders')}
          onNavigateToWishlist={() => navigateScreen('wishlist')}
          onNavigateToCustomizer={() => navigateScreen('customizer')}
          onNavigateToAdmin={() => navigateScreen('admin')}
          onNavigateToLogin={() => navigateScreen('login')}
          onLogout={handleLogout}
        />
      );
    }
    return (
      <NotificationsPage
        onNavigateBack={() => navigateScreen('shop')}
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToShop={() => navigateScreen('shop')}
        onNavigateToAdmin={() => navigateScreen('admin')}
      />
    );
  }

  if (currentScreen === 'product-details') {
    return (
      <ProductDetailsPage
        product={selectedProductDetails}
        onNavigateBack={() => navigateScreen('shop')}
        onNavigateToStore={() => navigateScreen('shop')}
        onNavigateToWishlist={() => navigateScreen('wishlist')}
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
        onNavigateToLogin={() => navigateScreen('login')}
      />
    );
  }

  // ─── CORE CUSTOMER TABS (Persistent Tab Container with 0-latency instant switching) ───
  const activeTabScreen =
    currentScreen === 'services'
      ? 'garage'
      : currentScreen === 'orders'
      ? 'profile'
      : currentScreen === 'profile'
      ? 'profile'
      : currentScreen === 'garage'
      ? 'garage'
      : currentScreen === 'customizer'
      ? 'customizer'
      : 'shop';

  const isShopActive = activeTabScreen === 'shop';
  const isGarageActive = activeTabScreen === 'garage';
  const isCustomizerActive = activeTabScreen === 'customizer';
  const isProfileActive = activeTabScreen === 'profile';

  return (
    <View style={tabShellStyles.container}>
      {/* 1. Shop Screen */}
      {visitedScreens.has('shop') && (
        <View
          key="tab-layer-shop"
          style={[
            tabShellStyles.tabLayer,
            isShopActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
          ]}
          pointerEvents={isShopActive ? 'auto' : 'none'}
          aria-hidden={!isShopActive}
        >
          <ShopPage
            onNavigateToWishlist={() => navigateScreen('wishlist')}
            onNavigateToScreen={(screen, params) => {
              if (params?.product) {
                if (screen === 'customizer') {
                  setCustomizerProduct(params.product);
                } else if (screen === 'product-details') {
                  setSelectedProductDetails(params.product);
                }
              }
              if (screen === 'profile') {
                handleNavigateToProfile(params?.tab || 'profile');
              } else if (screen === 'orders') {
                handleNavigateToProfile('orders');
              } else if (screen === 'wishlist') {
                navigateScreen('wishlist');
              } else {
                navigateScreen(screen, params);
              }
            }}
          />
        </View>
      )}

      {/* 2. Services Screen (Garage / Pit Bay Booking) */}
      {visitedScreens.has('garage') && (
        <View
          key="tab-layer-garage"
          style={[
            tabShellStyles.tabLayer,
            isGarageActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
          ]}
          pointerEvents={isGarageActive ? 'auto' : 'none'}
          aria-hidden={!isGarageActive}
        >
          <GaragePage
            onNavigateToStore={() => navigateScreen('shop')}
            onNavigateToWishlist={() => navigateScreen('wishlist')}
            onNavigateToOrders={() => handleNavigateToProfile('orders')}
            onNavigateToCustomizer={() => navigateScreen('customizer')}
            onNavigateToCustomize={() => navigateScreen('customizer')}
            onNavigateToLogin={() => {
              setRedirectReason('Please sign in to book your garage appointment.');
              navigateScreen('login');
            }}
            onNavigateToProfile={(tab) => handleNavigateToProfile(tab || 'profile')}
            onNavigateToAdmin={() => navigateScreen('admin')}
            onOpenCart={() => setIsCartOpen(true)}
            onLogout={handleLogout}
          />
        </View>
      )}

      {/* 3. Customizer Screen */}
      {visitedScreens.has('customizer') && (
        <View
          key="tab-layer-customizer"
          style={[
            tabShellStyles.tabLayer,
            isCustomizerActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
          ]}
          pointerEvents={isCustomizerActive ? 'auto' : 'none'}
          aria-hidden={!isCustomizerActive}
        >
          <CustomizerPage
            initialSelectedProduct={customizerProduct}
            onNavigateToStore={() => navigateScreen('shop')}
            onNavigateToGarage={() => navigateScreen('garage')}
            onNavigateToWishlist={() => navigateScreen('wishlist')}
            onNavigateToOrders={() => handleNavigateToProfile('orders')}
            onNavigateToLogin={() => {
              setRedirectReason('Please sign in to book your customized build.');
              navigateScreen('login');
            }}
            onNavigateToProfile={(tab) => handleNavigateToProfile(tab || 'profile')}
            onNavigateToAdmin={() => navigateScreen('admin')}
            onOpenCart={() => setIsCartOpen(true)}
            onLogout={handleLogout}
          />
        </View>
      )}

      {/* 4. Profile Screen (Customer Garage Fleet, Orders, More Menu, Bookings) */}
      {visitedScreens.has('profile') && (
        <View
          key="tab-layer-profile"
          style={[
            tabShellStyles.tabLayer,
            isProfileActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
          ]}
          pointerEvents={isProfileActive ? 'auto' : 'none'}
          aria-hidden={!isProfileActive}
        >
          <ProfilePage
            initialTab={profileInitialTab}
            onNavigateToStore={() => navigateScreen('shop')}
            onNavigateToGarage={() => navigateScreen('garage')}
            onNavigateToOrders={() => handleNavigateToProfile('orders')}
            onNavigateToWishlist={() => navigateScreen('wishlist')}
            onNavigateToCustomizer={() => navigateScreen('customizer')}
            onNavigateToAdmin={() => navigateScreen('admin')}
            onNavigateToLogin={() => navigateScreen('login')}
            onNavigateToProductDetails={(product) => navigateScreen('product-details', { product })}
            onLogout={handleLogout}
          />
        </View>
      )}
    </View>
  );
}

function MainAppContainer() {
  const { isDarkMode } = useTheme();
  return (
    <View
      style={[
        styles.rootContainer,
        { backgroundColor: isDarkMode ? '#0F1412' : '#F8FAFC' },
      ]}
    >
      <MainAppRouter />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    // Plus Jakarta Sans (Primary Application Font)
    PlusJakartaSans: PlusJakartaSans_400Regular,
    'Plus Jakarta Sans': PlusJakartaSans_400Regular,
    'PlusJakartaSans-ExtraLight': PlusJakartaSans_200ExtraLight,
    'PlusJakartaSans-Light': PlusJakartaSans_300Light,
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_200ExtraLight,
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    // Native aliases mapped to Plus Jakarta Sans for instant adoption
    Manrope: PlusJakartaSans_400Regular,
    'Manrope-ExtraLight': PlusJakartaSans_200ExtraLight,
    'Manrope-Light': PlusJakartaSans_300Light,
    'Manrope-Regular': PlusJakartaSans_400Regular,
    'Manrope-Medium': PlusJakartaSans_500Medium,
    'Manrope-SemiBold': PlusJakartaSans_600SemiBold,
    'Manrope-Bold': PlusJakartaSans_700Bold,
    'Manrope-ExtraBold': PlusJakartaSans_800ExtraBold,
    Manrope_200ExtraLight,
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter: PlusJakartaSans_400Regular,
    'Inter-Regular': PlusJakartaSans_400Regular,
    'Inter-Light': PlusJakartaSans_300Light,
    'Inter-Medium': PlusJakartaSans_500Medium,
    'Inter-SemiBold': PlusJakartaSans_600SemiBold,
    'Inter-Bold': PlusJakartaSans_700Bold,
    'Inter-ExtraBold': PlusJakartaSans_800ExtraBold,
    Poppins: PlusJakartaSans_400Regular,
    'Poppins-Regular': PlusJakartaSans_400Regular,
    'Poppins-Light': PlusJakartaSans_300Light,
    'Poppins-Medium': PlusJakartaSans_500Medium,
    'Poppins-SemiBold': PlusJakartaSans_600SemiBold,
    'Poppins-Bold': PlusJakartaSans_700Bold,
    'Poppins-ExtraBold': PlusJakartaSans_800ExtraBold,
  });

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <WishlistProvider>
            <CartProvider>
              <MainAppContainer />
            </CartProvider>
          </WishlistProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' } : {}),
    backgroundColor: '#F8FAFC',
  },
});

const tabShellStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  tabLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  tabActive: Platform.OS === 'web'
    ? {
        opacity: 1,
        zIndex: 2,
        visibility: 'visible',
      }
    : {
        display: 'flex',
      },
  tabInactive: Platform.OS === 'web'
    ? {
        opacity: 0,
        zIndex: -1,
        visibility: 'hidden',
      }
    : {
        display: 'none',
      },
});

