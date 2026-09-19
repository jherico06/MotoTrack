import React, { useState, useEffect } from 'react';
import { AuthProvider, CartProvider, WishlistProvider, useAuth, useCart, useWishlist } from '../context';
import {
  ShopPage,
  LoginPage,
  SignUpPage,
  OrderPage,
  GaragePage,
  WishlistPage,
  AdminDashboard,
  CustomizerPage,
  ProfilePage,
  NotificationsPage,
  DeliveryConfirmPage,
  RiderRunPage,
  RiderDashboard,
} from '../pages';

import { Platform, View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { BootstrapIcon } from '../components/common';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { adminSecurityService } from '../services/adminSecurityService';
import { authService } from '../services/authService';
import {
  useFonts,
  Manrope_200ExtraLight,
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

// Global Mobile Font Defaults for React Native Text & TextInput
if (Platform.OS !== 'web') {
  try {
    if (Text.defaultProps == null) Text.defaultProps = {};
    Text.defaultProps.style = [{ fontFamily: 'Manrope' }, Text.defaultProps.style];
  } catch (_e) {}

  try {
    if (TextInput.defaultProps == null) TextInput.defaultProps = {};
    TextInput.defaultProps.style = [{ fontFamily: 'Manrope' }, TextInput.defaultProps.style];
  } catch (_e) {}
}

// Global Web Font Injection for Manrope & Bootstrap Icons
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.title = 'MotoTrack - Motorparts and Accessories';
  if (!document.getElementById('bootstrap-icons-cdn')) {
    const bsLink = document.createElement('link');
    bsLink.id = 'bootstrap-icons-cdn';
    bsLink.rel = 'stylesheet';
    bsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
    document.head.appendChild(bsLink);
  }
  if (!document.getElementById('manrope-google-font')) {
    const link = document.createElement('link');
    link.id = 'manrope-google-font';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }
  if (!document.getElementById('manrope-global-styles')) {
    const style = document.createElement('style');
    style.id = 'manrope-global-styles';
    style.innerHTML = `
      * {
        font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      html, body {
        font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      input, button, select, textarea, div, span, p, a, label {
        font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
      /* Modern subtle scrollbar */
      ::-webkit-scrollbar {
        width: 7px;
        height: 7px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.4);
        border-radius: 9999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(100, 116, 139, 0.6);
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
        return 'orders';
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
      if (['login', 'signup', 'admin', 'garage', 'wishlist', 'shop', 'customizer', 'profile', 'notifications', 'orders', 'confirm-delivery', 'rider-run', 'rider-dashboard'].includes(s)) {
        return s;
      }
    } catch (_e) {}
    return 'shop';
  };

  const [currentScreen, setCurrentScreen] = useState(getInitialScreen);
  const [customizerProduct, setCustomizerProduct] = useState(null);
  const [profileInitialTab, setProfileInitialTab] = useState(() => {
    try {
      const { screen: s } = parsePublicRoute();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (s === 'orders' || tab === 'orders') return 'orders';
        if (tab) return tab;
      }
    } catch (_e) {}
    return 'overview';
  });
  const [allowMobileAdmin, setAllowMobileAdmin] = useState(false);
  const { currentUser, logout, adminLogin, redirectReason, setRedirectReason } = useAuth();
  const { addToCart, cartItemCount, cartTotal, showToast } = useCart();
  const { wishlistCount } = useWishlist();

  const navigateScreen = (screen) => {
    setCurrentScreen(screen);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.pushState) {
      try {
        const url = new URL(window.location.href);
        if (screen === 'shop') {
          url.searchParams.delete('screen');
          url.searchParams.delete('token');
        } else {
          url.searchParams.set('screen', screen);
        }
        if (screen !== 'rider-run' && screen !== 'confirm-delivery') {
          url.searchParams.delete('token');
        }
        window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
      } catch (_e) {}
    }
  };

  const handleNavigateToProfile = (tab = 'overview') => {
    if (!currentUser) {
      setRedirectReason(
        tab === 'orders'
          ? 'Please sign in to view your orders in your Customer Dashboard.'
          : 'Please sign in to view your Customer Dashboard.'
      );
      navigateScreen('login');
    } else {
      setProfileInitialTab(tab);
      navigateScreen('profile');
    }
  };

  const handleAuthSuccess = (user) => {
    const resolvedRole = user?.role || authService.getCurrentUser()?.role || currentUser?.role;
    if (resolvedRole === 'admin') {
      navigateScreen('admin');
    } else if (resolvedRole === 'rider') {
      navigateScreen('rider-dashboard');
    } else {
      navigateScreen('shop');
    }
  };

  const handleLogout = () => {
    try {
      adminSecurityService.lockSession();
    } catch (_e) {}
    const wasRider = currentUser?.role === 'rider';
    logout();
    navigateScreen(wasRider ? 'login' : 'shop');
    showToast('Logged out successfully');
  };

  // â”€â”€â”€ STRICT ENVIRONMENT SEPARATION â”€â”€â”€
  // 1. Admin accounts can ONLY access the Admin Dashboard
  useEffect(() => {
    if (
      currentUser?.role === 'admin' &&
      currentScreen !== 'admin' &&
      currentScreen !== 'confirm-delivery' &&
      currentScreen !== 'rider-run'
    ) {
      navigateScreen('admin');
    }
  }, [currentUser, currentScreen]);

  useEffect(() => {
    if (
      currentUser?.role === 'rider' &&
      currentScreen !== 'rider-dashboard' &&
      currentScreen !== 'rider-run' &&
      currentScreen !== 'confirm-delivery'
    ) {
      navigateScreen('rider-dashboard');
    }
  }, [currentUser, currentScreen]);

  // 2. If user is already authenticated and on login/signup, route appropriately
  useEffect(() => {
    if (currentUser && (currentScreen === 'login' || currentScreen === 'signup')) {
      if (currentUser.role === 'admin') {
        navigateScreen('admin');
      } else if (currentUser.role === 'rider') {
        navigateScreen('rider-dashboard');
      } else if (!redirectReason) {
        navigateScreen('shop');
      }
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
    if (!currentUser && (currentScreen === 'profile' || currentScreen === 'orders')) {
      navigateScreen('shop');
    }
  }, [currentUser, currentScreen]);

  // Authenticated rider dashboard
  if (currentUser?.role === 'rider') {
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
  if (currentUser?.role === 'admin') {
    return (
      <AdminDashboard
        onNavigateToStore={() => {
          // Admin accounts cannot access the customer storefront.
          // Leaving the admin console signs out the admin session cleanly.
          adminSecurityService.lockSession();
          logout();
          navigateScreen('shop');
          showToast('Signed out of Admin Console. Switched to Store.');
        }}
        onLogout={() => {
          adminSecurityService.lockSession();
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
              <BootstrapIcon name="display" size={30} color="#0C6258" />
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
                backgroundColor: '#0C6258',
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
    if (currentUser.role !== 'admin') {
      return (
        <ShopPage
          onNavigateToScreen={(screen, params) => {
            if (params?.product) {
              setCustomizerProduct(params.product);
            }
            if (screen === 'profile') {
              handleNavigateToProfile(params?.tab || 'overview');
            } else if (screen === 'orders') {
              navigateScreen('orders');
            } else {
              navigateScreen(screen);
            }
          }}
        />
      );
    }

    return (
      <AdminDashboard
        onNavigateToStore={() => {
          adminSecurityService.lockSession();
          navigateScreen('shop');
        }}
        onLogout={() => {
          adminSecurityService.lockSession();
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
        onNavigateToOrders={() => navigateScreen('orders')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToLogin={() => navigateScreen('login')}
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab)}
        onNavigateToCustomizer={() => navigateScreen('customizer')}
        onNavigateToCustomize={() => navigateScreen('customizer')}
        onNavigateToAdmin={() => navigateScreen('admin')}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === 'orders') {
    if (!currentUser) {
      setRedirectReason('Please sign in to view your orders.');
      navigateScreen('login');
      return null;
    }
    return (
      <OrderPage
        currentUser={currentUser}
        onNavigateToStore={() => navigateScreen('shop')}
        onNavigateToWishlist={() => navigateScreen('wishlist')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToCustomizer={() => navigateScreen('customizer')}
        onNavigateToCustomize={() => navigateScreen('customizer')}
        onNavigateToLogin={() => navigateScreen('login')}
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab)}
        onNavigateToAdmin={() => navigateScreen('admin')}
        onAddToCart={(product, qty) => addToCart(product, qty)}
        onOpenCart={() => setIsCartOpen(true)}
        cartItemCount={cartItemCount}
        wishlistCount={wishlistCount}
        showToast={showToast}
      />
    );
  }

  if (currentScreen === 'garage') {
    return (
      <GaragePage
        onNavigateToStore={() => navigateScreen('shop')}
        onNavigateToWishlist={() => navigateScreen('wishlist')}
        onNavigateToOrders={() => navigateScreen('orders')}
        onNavigateToCustomizer={() => navigateScreen('customizer')}
        onNavigateToCustomize={() => navigateScreen('customizer')}
        onNavigateToLogin={() => {
          setRedirectReason('Please sign in to book your garage appointment.');
          navigateScreen('login');
        }}
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab)}
        onNavigateToAdmin={() => navigateScreen('admin')}
        onOpenCart={() => setIsCartOpen(true)}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === 'customizer') {
    return (
      <CustomizerPage
        initialSelectedProduct={customizerProduct}
        onNavigateToStore={() => navigateScreen('shop')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToWishlist={() => navigateScreen('wishlist')}
        onNavigateToOrders={() => navigateScreen('orders')}
        onNavigateToLogin={() => {
          setRedirectReason('Please sign in to book your customized build.');
          navigateScreen('login');
        }}
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab)}
        onNavigateToAdmin={() => navigateScreen('admin')}
        onOpenCart={() => setIsCartOpen(true)}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <ProfilePage
        initialTab={profileInitialTab}
        onNavigateToStore={() => navigateScreen('shop')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToOrders={() => navigateScreen('orders')}
        onNavigateToWishlist={() => navigateScreen('wishlist')}
        onNavigateToCustomizer={() => navigateScreen('customizer')}
        onNavigateToAdmin={() => navigateScreen('admin')}
        onNavigateToLogin={() => navigateScreen('login')}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === 'notifications') {
    return (
      <NotificationsPage
        onNavigateBack={() => navigateScreen('shop')}
        onNavigateToOrders={() => navigateScreen('orders')}
        onNavigateToGarage={() => navigateScreen('garage')}
        onNavigateToShop={() => navigateScreen('shop')}
        onNavigateToAdmin={() => navigateScreen('admin')}
      />
    );
  }

  // Default: Main Shop Page (Storefront)
  return (
    <ShopPage
      onNavigateToScreen={(screen, params) => {
        if (params?.product) {
          setCustomizerProduct(params.product);
        }
        if (screen === 'profile') {
          handleNavigateToProfile(params?.tab || 'overview');
        } else if (screen === 'orders') {
          navigateScreen('orders');
        } else {
          navigateScreen(screen);
        }
      }}
    />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope: Manrope_400Regular,
    'Manrope-ExtraLight': Manrope_200ExtraLight,
    'Manrope-Light': Manrope_300Light,
    'Manrope-Regular': Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Manrope-Bold': Manrope_700Bold,
    'Manrope-ExtraBold': Manrope_800ExtraBold,
    Manrope_200ExtraLight,
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    // Aliases for backwards compatibility
    Inter: Manrope_400Regular,
    'Inter-Regular': Manrope_400Regular,
    'Inter-Light': Manrope_300Light,
    'Inter-Medium': Manrope_500Medium,
    'Inter-SemiBold': Manrope_600SemiBold,
    'Inter-Bold': Manrope_700Bold,
    'Inter-ExtraBold': Manrope_800ExtraBold,
    Poppins: Manrope_400Regular,
    'Poppins-Regular': Manrope_400Regular,
    'Poppins-Light': Manrope_300Light,
    'Poppins-Medium': Manrope_500Medium,
    'Poppins-SemiBold': Manrope_600SemiBold,
    'Poppins-Bold': Manrope_700Bold,
    'Poppins-ExtraBold': Manrope_800ExtraBold,
  });

  return (
    <ErrorBoundary>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <View style={styles.rootContainer}>
              <MainAppRouter />
            </View>
          </CartProvider>
        </WishlistProvider>
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

