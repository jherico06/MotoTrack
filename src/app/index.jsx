import React, { useState, useEffect } from 'react';
import { AuthProvider, CartProvider, WishlistProvider, useAuth, useCart } from '../context';
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
} from '../pages';

import { Platform, View, Text, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../components/common';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { adminSecurityService } from '../services/adminSecurityService';
import { authService } from '../services/authService';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';

// Global Web Font Injection for Poppins & Bootstrap Icons
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.title = 'D,Blockchain Motorparts and Accessories';
  if (!document.getElementById('bootstrap-icons-cdn')) {
    const bsLink = document.createElement('link');
    bsLink.id = 'bootstrap-icons-cdn';
    bsLink.rel = 'stylesheet';
    bsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
    document.head.appendChild(bsLink);
  }
  if (!document.getElementById('poppins-google-font')) {
    const link = document.createElement('link');
    link.id = 'poppins-google-font';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&display=swap';
    document.head.appendChild(link);
  }
  if (!document.getElementById('poppins-global-styles')) {
    const style = document.createElement('style');
    style.id = 'poppins-global-styles';
    style.innerHTML = `
      html, body {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      input, button, select, textarea, div, span, p, a, label {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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

function MainAppRouter() {
  const getInitialScreen = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const s = params.get('screen') || window.location.hash.replace('#', '');
        if (s === 'orders') {
          return 'profile';
        }
        if (['login', 'signup', 'admin', 'garage', 'wishlist', 'shop', 'customizer', 'profile', 'notifications'].includes(s)) {
          return s;
        }
      } catch (_e) {}
    }
    return 'shop';
  };

  const [currentScreen, setCurrentScreen] = useState(getInitialScreen);
  const [customizerProduct, setCustomizerProduct] = useState(null);
  const [profileInitialTab, setProfileInitialTab] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const s = params.get('screen') || window.location.hash.replace('#', '');
        const tab = params.get('tab');
        if (s === 'orders' || tab === 'orders') return 'orders';
        if (tab) return tab;
      } catch (_e) {}
    }
    return 'profile';
  });
  const [allowMobileAdmin, setAllowMobileAdmin] = useState(false);
  const { currentUser, logout, adminLogin, redirectReason, setRedirectReason } = useAuth();
  const { addToCart, cartItemCount, cartTotal, showToast } = useCart();

  const navigateScreen = (screen) => {
    setCurrentScreen(screen);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.pushState) {
      try {
        const url = new URL(window.location.href);
        if (screen === 'shop') {
          url.searchParams.delete('screen');
        } else {
          url.searchParams.set('screen', screen);
        }
        window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
      } catch (_e) {}
    }
  };

  const handleNavigateToProfile = (tab = 'profile') => {
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
    } else {
      navigateScreen('shop');
    }
  };

  const handleLogout = () => {
    try {
      adminSecurityService.lockSession();
    } catch (_e) {}
    logout();
    navigateScreen('shop');
    showToast('Logged out successfully');
  };

  // â”€â”€â”€ STRICT ENVIRONMENT SEPARATION â”€â”€â”€
  // 1. Admin accounts can ONLY access the Admin Dashboard
  useEffect(() => {
    if (currentUser?.role === 'admin' && currentScreen !== 'admin') {
      navigateScreen('admin');
    }
  }, [currentUser, currentScreen]);

  // 2. If user is already authenticated and on login/signup, route appropriately
  useEffect(() => {
    if (currentUser && (currentScreen === 'login' || currentScreen === 'signup')) {
      if (currentUser.role === 'admin') {
        navigateScreen('admin');
      } else if (!redirectReason) {
        navigateScreen('shop');
      }
    }
  }, [currentUser, currentScreen, redirectReason]);

  // Listen to browser URL changes (back/forward or external navigation)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const handlePopState = () => {
        const s = getInitialScreen();
        setCurrentScreen(s);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        if (typeof window.removeEventListener === 'function') {
          window.removeEventListener('popstate', handlePopState);
        }
      };
    }
  }, []);

  // If user logs out or session ends while on protected screen (profile, orders), return to storefront
  useEffect(() => {
    if (!currentUser && (currentScreen === 'profile' || currentScreen === 'orders')) {
      navigateScreen('shop');
    }
  }, [currentUser, currentScreen]);

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
              handleNavigateToProfile(params?.tab || 'profile');
            } else if (screen === 'orders') {
              handleNavigateToProfile('orders');
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
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
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
      setRedirectReason('Please sign in to view your orders in your Customer Dashboard.');
      navigateScreen('login');
      return null;
    }
    handleNavigateToProfile('orders');
    return null;
  }

  if (currentScreen === 'garage') {
    return (
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
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab)}
        onNavigateToAdmin={() => navigateScreen('admin')}
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
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
        onNavigateToLogin={() => {
          setRedirectReason('Please sign in to book your customized build.');
          navigateScreen('login');
        }}
        onNavigateToProfile={(tab) => handleNavigateToProfile(tab)}
        onNavigateToAdmin={() => navigateScreen('admin')}
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
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
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
        onNavigateToOrders={() => handleNavigateToProfile('orders')}
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
          handleNavigateToProfile(params?.tab || 'profile');
        } else if (screen === 'orders') {
          handleNavigateToProfile('orders');
        } else {
          navigateScreen(screen);
        }
      }}
    />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins: Poppins_400Regular,
    'Poppins-Light': Poppins_300Light,
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Poppins-Black': Poppins_900Black,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
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

