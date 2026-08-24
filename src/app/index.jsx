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
} from '../pages';

import { Platform, View, Text, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../components/common';
import ErrorBoundary from '../components/common/ErrorBoundary';
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
      * {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      }
      body, html {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      input, button, select, textarea {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
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
    `;
    document.head.appendChild(style);
  }
}

function MainAppRouter() {
  const getInitialScreen = () => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('screen') || window.location.hash.replace('#', '');
      if (['login', 'signup', 'admin', 'garage', 'orders', 'wishlist', 'shop'].includes(s)) {
        return s;
      }
    }
    return 'shop';
  };

  const [currentScreen, setCurrentScreen] = useState(getInitialScreen);
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { addToCart, cartItemCount, cartTotal, showToast } = useCart();

  // Screen Routing: ONLY Admin Dashboard is restricted to Web
  if (currentScreen === 'admin') {
    if (Platform.OS !== 'web') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F6F8FC', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, maxWidth: 440, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F7F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <BootstrapIcon name="laptop" size={30} color="#0C6258" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8 }}>
              Web Browser Exclusive
            </Text>
            <Text style={{ fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              The MotoTrack Store Administrator Console is exclusively accessible via Web Browser. Please open MotoTrack in your web browser.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#0C6258', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              onPress={() => setCurrentScreen('shop')}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="arrow-left" size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Return to Store</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <AdminDashboard
        onNavigateToStore={() => setCurrentScreen('shop')}
        onLogout={() => {
          logout();
          setCurrentScreen('shop');
        }}
      />
    );
  }

  if (currentScreen === 'login') {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          if (user.role === 'admin' && Platform.OS === 'web') {
            setCurrentScreen('admin');
          } else {
            setCurrentScreen('shop');
          }
        }}
        onNavigateToSignUp={() => setCurrentScreen('signup')}
        onNavigateToStore={() => setCurrentScreen('shop')}
      />
    );
  }

  if (currentScreen === 'signup') {
    return (
      <SignUpPage
        onSignUpSuccess={(user) => {
          if (user.role === 'admin' && Platform.OS === 'web') {
            setCurrentScreen('admin');
          } else {
            setCurrentScreen('shop');
          }
        }}
        onNavigateToLogin={() => setCurrentScreen('login')}
        onNavigateToStore={() => setCurrentScreen('shop')}
      />
    );
  }

  if (currentScreen === 'wishlist') {
    return (
      <WishlistPage
        onAddToCart={(product, qty) => addToCart(product, qty)}
        onNavigateToStore={() => setCurrentScreen('shop')}
        onNavigateToOrders={() => {
          if (!currentUser) {
            setRedirectReason('Please sign in to view your order history.');
            setCurrentScreen('login');
          } else {
            setCurrentScreen('orders');
          }
        }}
        onNavigateToGarage={() => setCurrentScreen('garage')}
        onNavigateToLogin={() => setCurrentScreen('login')}
        onNavigateToProfile={() => {
          if (!currentUser) {
            setCurrentScreen('login');
          } else {
            setCurrentScreen('shop');
          }
        }}
        onNavigateToAdmin={() => setCurrentScreen('admin')}
      />
    );
  }

  if (currentScreen === 'orders') {
    return (
      <OrderPage
        onAddToCart={(product, qty) => addToCart(product, qty)}
        onNavigateToStore={() => setCurrentScreen('shop')}
        onNavigateToWishlist={() => setCurrentScreen('wishlist')}
        onNavigateToGarage={() => setCurrentScreen('garage')}
        onNavigateToLogin={() => setCurrentScreen('login')}
        onNavigateToProfile={() => {
          if (!currentUser) {
            setCurrentScreen('login');
          } else {
            setCurrentScreen('shop');
          }
        }}
        onNavigateToAdmin={() => setCurrentScreen('admin')}
      />
    );
  }

  if (currentScreen === 'garage') {
    return (
      <GaragePage
        onNavigateToStore={() => setCurrentScreen('shop')}
        onNavigateToWishlist={() => setCurrentScreen('wishlist')}
        onNavigateToOrders={() => setCurrentScreen('orders')}
        onNavigateToLogin={() => {
          setRedirectReason('Please sign in to book your garage appointment.');
          setCurrentScreen('login');
        }}
        onNavigateToProfile={() => {
          if (!currentUser) {
            setCurrentScreen('login');
          } else {
            setCurrentScreen('shop');
          }
        }}
        onNavigateToAdmin={() => setCurrentScreen('admin')}
      />
    );
  }

  // Default: Main Shop Page
  return (
    <ShopPage
      onNavigateToScreen={(screen) => setCurrentScreen(screen)}
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
