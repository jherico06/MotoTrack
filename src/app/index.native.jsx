import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  AuthProvider,
  CartProvider,
  WishlistProvider,
  ThemeProvider,
  useTheme,
  useAuth,
  useCart,
} from '../context';
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
  BackHandler,
  LogBox,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useFonts } from 'expo-font';
import { BootstrapIcon } from '../components/common';
import RequireLoginModal from '../components/modals/RequireLoginModal.jsx';
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
import { GoogleSansFlex_200ExtraLight } from '@expo-google-fonts/google-sans-flex/200ExtraLight';
import { GoogleSansFlex_300Light } from '@expo-google-fonts/google-sans-flex/300Light';
import { GoogleSansFlex_400Regular } from '@expo-google-fonts/google-sans-flex/400Regular';
import { GoogleSansFlex_500Medium } from '@expo-google-fonts/google-sans-flex/500Medium';
import { GoogleSansFlex_600SemiBold } from '@expo-google-fonts/google-sans-flex/600SemiBold';
import { GoogleSansFlex_700Bold } from '@expo-google-fonts/google-sans-flex/700Bold';
import { GoogleSansFlex_800ExtraBold } from '@expo-google-fonts/google-sans-flex/800ExtraBold';

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

// Enforce Google Sans Flex on native mobile as the default font across Text & TextInput
try {
  if (Text.defaultProps == null) {
    Text.defaultProps = {};
  }
  Text.defaultProps.style = [{ fontFamily: 'GoogleSansFlex' }, Text.defaultProps.style];

  if (TextInput.defaultProps == null) {
    TextInput.defaultProps = {};
  }
  TextInput.defaultProps.style = [{ fontFamily: 'GoogleSansFlex' }, TextInput.defaultProps.style];
} catch (_e) {}

// Freeze JS re-renders of hidden cached tabs while keeping them mounted for 0ms tab switching.
const MemoTabLayer = memo(
  function TabLayer({ children }) {
    return children;
  },
  (prev, next) => !prev.isActive && !next.isActive
);
MemoTabLayer.displayName = 'MemoTabLayer';

const CORE_TAB_SCREENS = ['shop', 'garage', 'services', 'appointments', 'customizer', 'profile', 'orders'];

function toCanonicalTab(screen) {
  if (screen === 'services') return 'garage';
  if (screen === 'orders') return 'profile';
  if (screen === 'appointments') return 'appointments';
  return screen;
}

function parsePublicRoute(url) {
  const out = { screen: '', token: '' };
  if (!url) return out;
  try {
    const normalized = String(url).replace(/^exp:\/\//i, 'http://');
    const u = new URL(normalized, 'https://mototrack.local');
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
      if (s === 'orders' || s === 'notifications') return 'profile';
      if (s === 'confirm-delivery') return 'confirm-delivery';
      if (s === 'rider-run') return 'rider-run';
      if (s === 'rider-login') return 'login';
      if (s === 'rider-dashboard') return 'rider-dashboard';
      if (['login', 'signup', 'admin', 'garage', 'wishlist', 'shop', 'customizer', 'profile', 'notifications', 'confirm-delivery', 'rider-run', 'rider-dashboard'].includes(s)) {
        const savedUser = authService.getCurrentUser();
        const protectedInitialScreens = ['profile', 'orders', 'notifications'];
        if (!savedUser && protectedInitialScreens.includes(s)) {
          return 'shop';
        }
        return s;
      }
    } catch (_e) {}
    return 'shop';
  };

  const [currentScreen, setCurrentScreen] = useState(getInitialScreen);
  const [customizerProduct, setCustomizerProduct] = useState(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [, setIsCartOpen] = useState(false);
  const [garageParams, setGarageParams] = useState(null);
  const [appointmentParams, setAppointmentParams] = useState(null);
  const [profileInitialTab, setProfileInitialTab] = useState({ tab: 'garage', key: 0 });
  const [publicRouteToken, setPublicRouteToken] = useState('');

  const [visitedScreens, setVisitedScreens] = useState(() => {
    const s = getInitialScreen();
    const canonical = toCanonicalTab(s);
    return new Set(['shop', canonical]);
  });

  const lastActiveTabRef = useRef('shop');

  const markTabVisited = useCallback((screen) => {
    if (!CORE_TAB_SCREENS.includes(screen)) return;
    const canonical = toCanonicalTab(screen);
    lastActiveTabRef.current = canonical;
    setVisitedScreens((prev) => {
      if (prev.has(canonical)) return prev;
      const next = new Set(prev);
      next.add(canonical);
      return next;
    });
  }, []);

  const [allowMobileAdmin, setAllowMobileAdmin] = useState(false);
  const { currentUser, logout, redirectReason, setRedirectReason } = useAuth();
  const { addToCart, showToast } = useCart();

  const [requireLoginModal, setRequireLoginModal] = useState({
    visible: false,
    title: 'Sign In Required',
    message: 'Please log in first or create an account to access this feature.',
    actionLabel: 'Sign In to Continue',
    feature: 'general',
  });

  const promptRequireLogin = useCallback(({
    title = 'Sign In Required',
    message = 'Please log in first or create an account to access this feature.',
    actionLabel = 'Sign In to Continue',
    feature = 'general',
  } = {}) => {
    setRequireLoginModal({
      visible: true,
      title,
      message,
      actionLabel,
      feature,
    });
  }, []);

  const closeRequireLoginModal = useCallback(() => {
    setRequireLoginModal((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    systemSettingsService.fetchRemoteSettings();
  }, []);

  const handleNavigateToProfileRef = useRef(null);

  const navigateScreen = useCallback((screen, params = null) => {
    if (screen === 'orders') {
      handleNavigateToProfileRef.current?.('orders');
      return;
    }
    if (screen === 'notifications') {
      handleNavigateToProfileRef.current?.('notifications');
      return;
    }
    if (screen === 'profile') {
      handleNavigateToProfileRef.current?.(params?.tab || 'garage');
      return;
    }
    if (!currentUser && screen === 'appointments') {
      promptRequireLogin({
        title: 'Sign In to View Appointments',
        message: 'Please log in first to view your service appointments and live status tracking.',
        actionLabel: 'Sign In to View Appointments',
        feature: 'appointments',
      });
      return;
    }
    if (screen === 'garage') {
      setGarageParams(params);
    }
    if (screen === 'appointments') {
      setAppointmentParams(params);
    }
    if (params?.product) {
      if (screen === 'customizer') {
        setCustomizerProduct(params.product);
      } else if (screen === 'product-details') {
        setSelectedProductDetails(params.product);
      }
    }
    markTabVisited(screen);
    setCurrentScreen(screen);
  }, [currentUser, markTabVisited, promptRequireLogin]);

  const handleNavigateToProfile = useCallback((tab = 'garage') => {
    const tabName = typeof tab === 'object' && tab !== null ? tab.tab : tab;
    if (tabName === 'appointments' || tabName === 'bookings') {
      navigateScreen('appointments');
      return;
    }
    if (!currentUser) {
      if (tabName === 'orders') {
        promptRequireLogin({
          title: 'Sign In to View Orders',
          message: 'Please log in first to view your order history, delivery telemetry, and live tracking.',
          actionLabel: 'Sign In to View Orders',
          feature: 'orders',
        });
      } else if (tabName === 'garage') {
        promptRequireLogin({
          title: 'Sign In to Access Garage',
          message: 'Please log in first to view your motorcycle fleet, check parts fitment, and manage specs.',
          actionLabel: 'Sign In to Access Garage',
          feature: 'garage',
        });
      } else if (tabName === 'notifications') {
        promptRequireLogin({
          title: 'Sign In for Notifications',
          message: 'Please log in first to view order updates, service alerts, and promotions.',
          actionLabel: 'Sign In to View Notifications',
          feature: 'general',
        });
      } else {
        promptRequireLogin({
          title: 'Sign In Required',
          message: 'Please log in first to view and manage your account profile.',
          actionLabel: 'Sign In to View Profile',
          feature: 'general',
        });
      }
      return;
    }
    markTabVisited('profile');
    setProfileInitialTab({ tab: tabName, key: Date.now() });
    setCurrentScreen('profile');
  }, [currentUser, markTabVisited, navigateScreen, promptRequireLogin]);

  handleNavigateToProfileRef.current = handleNavigateToProfile;

  const handleAuthSuccess = (user) => {
    const resolvedUser = user || authService.getCurrentUser() || currentUser;
    if (mustChangeStaffPassword(resolvedUser)) {
      navigateScreen('force-change-password');
      return;
    }
    navigateScreen(homeScreenForRole(resolvedUser?.role));
  };

  const handleLogout = useCallback(() => {
    try {
      adminSecurityService.lockSession(currentUser);
    } catch (_e) {}
    const wasRider = isRider(currentUser);
    logout();
    navigateScreen(wasRider ? 'login' : 'shop');
    showToast('Logged out successfully');
  }, [currentUser, logout, navigateScreen, showToast]);

  // Android hardware back button handling for smoother native navigation
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (requireLoginModal.visible) {
        closeRequireLoginModal();
        return true;
      }
      if (['product-details', 'wishlist', 'notifications', 'login', 'signup'].includes(currentScreen)) {
        const backTarget = lastActiveTabRef.current || 'shop';
        setCurrentScreen(backTarget);
        return true;
      }
      if (CORE_TAB_SCREENS.includes(currentScreen) && toCanonicalTab(currentScreen) !== 'shop') {
        navigateScreen('shop');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [currentScreen, navigateScreen, requireLoginModal.visible, closeRequireLoginModal]);

  // Strict environment separation for Admin & Rider sessions
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
  }, [currentUser, currentScreen, navigateScreen]);

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
  }, [currentUser, currentScreen, navigateScreen]);

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
  }, [currentUser, currentScreen, redirectReason, navigateScreen]);

  // Deep links / scanned QR (Expo Go / native)
  useEffect(() => {
    const applyUrl = (url) => {
      const { screen, token } = parsePublicRoute(url);
      if (screen === 'rider-run' || screen === 'confirm-delivery') {
        if (token) setPublicRouteToken(token);
        setCurrentScreen(screen);
      }
    };
    ExpoLinking.getInitialURL()
      .then((url) => applyUrl(url))
      .catch(() => {});
    const sub = ExpoLinking.addEventListener('url', (event) => applyUrl(event?.url));
    return () => {
      try {
        sub?.remove?.();
      } catch (_e) {}
    };
  }, []);

  // If user logs out or session ends while on protected screen, return to storefront
  useEffect(() => {
    if (!currentUser) {
      const protectedScreens = ['profile', 'orders', 'appointments'];
      if (protectedScreens.includes(currentScreen)) {
        const t = setTimeout(() => {
          navigateScreen('shop');
          promptRequireLogin({
            title: 'Sign In Required',
            message: 'Please log in first or create an account to access that section.',
            actionLabel: 'Sign In to Continue',
            feature: 'general',
          });
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, [currentUser, currentScreen, navigateScreen, promptRequireLogin]);

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

  if (isRider(currentUser)) {
    if (currentScreen === 'confirm-delivery') {
      return (
        <DeliveryConfirmPage
          token={publicRouteToken}
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

  if (isMechanic(currentUser)) {
    const leaveBlockedAccount = () => {
      logout();
      navigateScreen('login');
    };
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#F3F4F6',
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
              fontWeight: '700',
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
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser && currentScreen === 'rider-dashboard') {
    return (
      <LoginPage
        onLoginSuccess={handleAuthSuccess}
        onNavigateToSignUp={() => navigateScreen('signup')}
        onNavigateToStore={() => navigateScreen('shop')}
      />
    );
  }

  if (currentScreen === 'rider-run') {
    return <RiderRunPage token={publicRouteToken} />;
  }

  if (currentScreen === 'confirm-delivery') {
    return (
      <DeliveryConfirmPage
        token={publicRouteToken}
        onDone={() => navigateScreen('shop')}
      />
    );
  }

  if (isAdmin(currentUser)) {
    return (
      <AdminDashboard
        onNavigateToStore={() => {
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

  if (currentScreen === 'admin') {
    if (!allowMobileAdmin) {
      return (
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: '#F3F4F6',
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
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
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
                fontWeight: '700',
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
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Open Mobile Admin Console</Text>
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
              <Text style={{ color: '#475569', fontWeight: '600', fontSize: 14 }}>Return to Store</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (!currentUser) {
      return (
        <LoginPage
          onLoginSuccess={handleAuthSuccess}
          onNavigateToSignUp={() => navigateScreen('signup')}
          onNavigateToStore={() => navigateScreen('shop')}
        />
      );
    }

    if (!isAdmin(currentUser)) {
      return (
        <ShopPage
          onNavigateToScreen={(screen, params) => navigateScreen(screen, params)}
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

  if (currentScreen === 'staff-verify') {
    return (
      <StaffVerifyEmailPage
        initialEmail=""
        onBackToLogin={() => navigateScreen('login')}
        onVerified={() => {
          showToast('Email verified. Check your inbox for temporary login credentials.');
          navigateScreen('login');
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

  // Keep core tab shell mounted (hidden with display: 'none' while viewing overlay screens)
  // so navigating back from Wishlist / Notifications / Product Details never remounts all tabs.
  const isOverlayScreen =
    currentScreen === 'wishlist' ||
    currentScreen === 'notifications' ||
    currentScreen === 'product-details';

  const activeTabScreen =
    currentScreen === 'services'
      ? 'garage'
      : currentScreen === 'appointments'
      ? 'appointments'
      : currentScreen === 'orders'
      ? 'profile'
      : currentScreen === 'profile'
      ? 'profile'
      : currentScreen === 'garage'
      ? 'garage'
      : currentScreen === 'customizer'
      ? 'customizer'
      : 'shop';

  const isShopActive = !isOverlayScreen && activeTabScreen === 'shop';
  const isGarageActive = !isOverlayScreen && activeTabScreen === 'garage';
  const isAppointmentsActive = !isOverlayScreen && activeTabScreen === 'appointments';
  const isCustomizerActive = !isOverlayScreen && activeTabScreen === 'customizer';
  const isProfileActive = !isOverlayScreen && activeTabScreen === 'profile';

  return (
    <View style={tabShellStyles.container}>
      {/* Persistent Cached Tab Layers (display: 'none' on inactive skips Android layout & draw) */}
      <View
        style={[
          tabShellStyles.tabShellHost,
          isOverlayScreen ? tabShellStyles.tabInactive : tabShellStyles.tabActive,
        ]}
      >
        {/* 1. Shop Screen */}
        {visitedScreens.has('shop') && (
          <View
            key="tab-layer-shop"
            style={[
              tabShellStyles.tabLayer,
              isShopActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
            ]}
            pointerEvents={isShopActive ? 'auto' : 'none'}
          >
            <MemoTabLayer isActive={isShopActive}>
              <ShopPage
                onNavigateToWishlist={() => navigateScreen('wishlist')}
                onRequireLogin={promptRequireLogin}
                onNavigateToScreen={navigateScreen}
              />
            </MemoTabLayer>
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
          >
            <MemoTabLayer isActive={isGarageActive}>
              <GaragePage
                activeView="book"
                onNavigateToStore={() => navigateScreen('shop')}
                onNavigateToWishlist={() => navigateScreen('wishlist')}
                onNavigateToOrders={() => handleNavigateToProfile('orders')}
                onNavigateToAppointments={(b) => navigateScreen('appointments', b ? { booking: b } : null)}
                onNavigateToGarage={() => navigateScreen('garage')}
                onNavigateToCustomizer={() => navigateScreen('customizer')}
                onNavigateToCustomize={() => navigateScreen('customizer')}
                onNavigateToLogin={() => {
                  setRedirectReason('Please sign in to book your garage appointment.');
                  navigateScreen('login');
                }}
                onRequireLogin={promptRequireLogin}
                onNavigateToProfile={(tab) => handleNavigateToProfile(tab || 'profile')}
                onNavigateToAdmin={() => navigateScreen('admin')}
                onOpenCart={() => setIsCartOpen(true)}
                onLogout={handleLogout}
                initialSearchQuery={garageParams?.search || garageParams?.searchQuery || ''}
              />
            </MemoTabLayer>
          </View>
        )}

        {/* 2b. Dedicated Appointments Screen */}
        {visitedScreens.has('appointments') && (
          <View
            key="tab-layer-appointments"
            style={[
              tabShellStyles.tabLayer,
              isAppointmentsActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
            ]}
            pointerEvents={isAppointmentsActive ? 'auto' : 'none'}
          >
            <MemoTabLayer isActive={isAppointmentsActive}>
              <GaragePage
                activeView="appointments"
                selectedBookingInitial={appointmentParams?.booking}
                onNavigateToStore={() => navigateScreen('shop')}
                onNavigateToWishlist={() => navigateScreen('wishlist')}
                onNavigateToOrders={() => handleNavigateToProfile('orders')}
                onNavigateToAppointments={() => navigateScreen('appointments')}
                onNavigateToGarage={() => navigateScreen('garage')}
                onNavigateToCustomizer={() => navigateScreen('customizer')}
                onNavigateToCustomize={() => navigateScreen('customizer')}
                onNavigateToLogin={() => {
                  setRedirectReason('Please sign in to view your garage appointments.');
                  navigateScreen('login');
                }}
                onRequireLogin={promptRequireLogin}
                onNavigateToProfile={(tab) => handleNavigateToProfile(tab || 'profile')}
                onNavigateToAdmin={() => navigateScreen('admin')}
                onOpenCart={() => setIsCartOpen(true)}
                onLogout={handleLogout}
                initialSearchQuery={garageParams?.search || ''}
              />
            </MemoTabLayer>
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
          >
            <MemoTabLayer isActive={isCustomizerActive}>
              <CustomizerPage
                initialSelectedProduct={customizerProduct}
                onNavigateToStore={() => navigateScreen('shop')}
                onNavigateToGarage={() => navigateScreen('garage')}
                onNavigateToAppointments={() => navigateScreen('appointments')}
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
                onRequireLogin={promptRequireLogin}
              />
            </MemoTabLayer>
          </View>
        )}

        {/* 4. Profile Screen (Garage Fleet, Orders, More Menu) */}
        {visitedScreens.has('profile') && (
          <View
            key="tab-layer-profile"
            style={[
              tabShellStyles.tabLayer,
              isProfileActive ? tabShellStyles.tabActive : tabShellStyles.tabInactive,
            ]}
            pointerEvents={isProfileActive ? 'auto' : 'none'}
          >
            <MemoTabLayer isActive={isProfileActive}>
              <ProfilePage
                initialTab={profileInitialTab}
                onNavigateToStore={() => navigateScreen('shop')}
                onNavigateToGarage={(params) => params?.tab === 'appointments' ? navigateScreen('appointments') : navigateScreen('garage')}
                onNavigateToAppointments={() => navigateScreen('appointments')}
                onNavigateToOrders={() => handleNavigateToProfile('orders')}
                onNavigateToWishlist={() => navigateScreen('wishlist')}
                onNavigateToCustomizer={() => navigateScreen('customizer')}
                onNavigateToAdmin={() => navigateScreen('admin')}
                onNavigateToLogin={() => navigateScreen('login')}
                onNavigateToProductDetails={(product) => navigateScreen('product-details', { product })}
                onLogout={handleLogout}
              />
            </MemoTabLayer>
          </View>
        )}
      </View>

      {/* Stack / Overlay Screens */}
      {currentScreen === 'wishlist' && (
        <View style={tabShellStyles.overlayScreen}>
          <WishlistPage
            onAddToCart={(product, qty) => addToCart(product, qty)}
            onNavigateToStore={() => navigateScreen('shop')}
            onNavigateToOrders={() => handleNavigateToProfile('orders')}
            onNavigateToGarage={() => navigateScreen('garage')}
            onNavigateToAppointments={() => navigateScreen('appointments')}
            onNavigateToLogin={() => navigateScreen('login')}
            onNavigateToProfile={(tab) => handleNavigateToProfile(tab || 'profile')}
            onNavigateToCustomizer={() => navigateScreen('customizer')}
            onNavigateToCustomize={() => navigateScreen('customizer')}
            onNavigateToAdmin={() => navigateScreen('admin')}
            onNavigateToWishlist={() => navigateScreen('wishlist')}
            onNavigateToProductDetails={(product) => navigateScreen('product-details', { product })}
            onNavigateToScreen={navigateScreen}
            onLogout={handleLogout}
          />
        </View>
      )}

      {currentScreen === 'notifications' && (
        <View style={tabShellStyles.overlayScreen}>
          <NotificationsPage
            onNavigateBack={() => navigateScreen(lastActiveTabRef.current || 'shop')}
            onNavigateToOrders={() => handleNavigateToProfile('orders')}
            onNavigateToGarage={() => navigateScreen('garage')}
            onNavigateToShop={() => navigateScreen('shop')}
            onNavigateToAdmin={() => navigateScreen('admin')}
          />
        </View>
      )}

      {currentScreen === 'product-details' && (
        <View style={tabShellStyles.overlayScreen}>
          <ProductDetailsPage
            product={selectedProductDetails}
            onNavigateBack={() => navigateScreen(lastActiveTabRef.current || 'shop')}
            onNavigateToStore={() => navigateScreen('shop')}
            onNavigateToWishlist={() => navigateScreen('wishlist')}
            onNavigateToOrders={() => handleNavigateToProfile('orders')}
            onNavigateToScreen={navigateScreen}
            onNavigateToAppointments={() => navigateScreen('appointments')}
            onNavigateToLogin={() => navigateScreen('login')}
            onRequireLogin={promptRequireLogin}
          />
        </View>
      )}

      <RequireLoginModal
        visible={requireLoginModal.visible}
        title={requireLoginModal.title}
        message={requireLoginModal.message}
        actionLabel={requireLoginModal.actionLabel}
        feature={requireLoginModal.feature}
        onClose={closeRequireLoginModal}
        onNavigateToLogin={(opts) => {
          closeRequireLoginModal();
          navigateScreen('login', opts);
        }}
        onNavigateToRegister={() => {
          closeRequireLoginModal();
          navigateScreen('signup');
        }}
      />
    </View>
  );
}

function MainAppContainer() {
  const { isDarkMode } = useTheme();
  return (
    <View
      style={[
        styles.rootContainer,
        { backgroundColor: isDarkMode ? '#0F1412' : '#F3F4F6' },
      ]}
    >
      <MainAppRouter />
    </View>
  );
}

export default function App() {
  useFonts({
    GoogleSansFlex: GoogleSansFlex_400Regular,
    'Google Sans Flex': GoogleSansFlex_400Regular,
    'GoogleSansFlex-ExtraLight': GoogleSansFlex_200ExtraLight,
    'GoogleSansFlex-Light': GoogleSansFlex_300Light,
    'GoogleSansFlex-Regular': GoogleSansFlex_400Regular,
    'GoogleSansFlex-Medium': GoogleSansFlex_500Medium,
    'GoogleSansFlex-SemiBold': GoogleSansFlex_600SemiBold,
    'GoogleSansFlex-Bold': GoogleSansFlex_700Bold,
    'GoogleSansFlex-ExtraBold': GoogleSansFlex_800ExtraBold,
    GoogleSansFlex_200ExtraLight,
    GoogleSansFlex_300Light,
    GoogleSansFlex_400Regular,
    GoogleSansFlex_500Medium,
    GoogleSansFlex_600SemiBold,
    GoogleSansFlex_700Bold,
    GoogleSansFlex_800ExtraBold,
    Inter: GoogleSansFlex_400Regular,
    'Inter-ExtraLight': GoogleSansFlex_200ExtraLight,
    'Inter-Light': GoogleSansFlex_300Light,
    'Inter-Regular': GoogleSansFlex_400Regular,
    'Inter-Medium': GoogleSansFlex_500Medium,
    'Inter-SemiBold': GoogleSansFlex_600SemiBold,
    'Inter-Bold': GoogleSansFlex_700Bold,
    'Inter-ExtraBold': GoogleSansFlex_800ExtraBold,
    PlusJakartaSans: GoogleSansFlex_400Regular,
    'Plus Jakarta Sans': GoogleSansFlex_400Regular,
    'PlusJakartaSans-Regular': GoogleSansFlex_400Regular,
    'PlusJakartaSans-Medium': GoogleSansFlex_500Medium,
    'PlusJakartaSans-SemiBold': GoogleSansFlex_600SemiBold,
    'PlusJakartaSans-Bold': GoogleSansFlex_700Bold,
    Manrope: GoogleSansFlex_400Regular,
    Poppins: GoogleSansFlex_400Regular,
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
    backgroundColor: '#F3F4F6',
  },
});

const tabShellStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  tabShellHost: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tabLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlayScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tabActive: {
    display: 'flex',
    zIndex: 2,
  },
  tabInactive: {
    display: 'none',
    zIndex: -1,
  },
});
