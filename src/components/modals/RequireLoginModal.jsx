import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, Pressable } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

/**
 * RequireLoginModal
 * Clean, prominent prompt displayed when guest users attempt to:
 * - Order products (Buy Now / Add to Cart / Checkout)
 * - Book pit/service appointments
 * - Access the 3D Customizer
 * - Access protected modules (Garage, Orders, Profile, etc.)
 */
export default function RequireLoginModal({
  visible = false,
  onClose,
  onNavigateToLogin,
  onNavigateToRegister,
  title = 'Sign In Required',
  message = 'Please log in first to access this feature, manage your motorcycles, and track your orders.',
  actionLabel = 'Sign In to Continue',
  feature = 'general',
}) {
  const { isDarkMode = false, tokens } = useTheme?.() || {};

  if (!visible) return null;

  const getFeatureIcon = () => {
    switch (feature) {
      case 'order':
        return 'bag-check-fill';
      case 'book':
        return 'calendar2-check-fill';
      case 'customize':
        return 'tools';
      case 'garage':
        return 'speedometer2';
      case 'orders':
        return 'receipt';
      default:
        return 'lock-fill';
    }
  };

  const handleSignIn = () => {
    onClose?.();
    onNavigateToLogin?.();
  };

  const handleRegister = () => {
    onClose?.();
    if (typeof onNavigateToRegister === 'function') {
      onNavigateToRegister();
    } else {
      onNavigateToLogin?.({ mode: 'register' });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDarkMode ? (tokens?.bgCard || '#1E293B') : '#FFFFFF',
              borderColor: isDarkMode ? (tokens?.border || '#334155') : '#E2E8F0',
            },
          ]}
          onPress={(e) => {
            // Prevent clicks inside modal from closing
            e?.stopPropagation?.();
          }}
        >
          {/* Close button */}
          <TouchableOpacity
            style={[
              styles.closeBtn,
              { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
            ]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close sign in prompt"
          >
            <BootstrapIcon name="x" size={20} color={isDarkMode ? '#CBD5E1' : '#64748B'} />
          </TouchableOpacity>

          {/* Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED',
                borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
              },
            ]}
          >
            <BootstrapIcon name={getFeatureIcon()} size={24} color="#EA580C" />
          </View>

          {/* Title & Body */}
          <Text
            style={[
              styles.modalTitle,
              { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.modalMessage,
              { color: isDarkMode ? '#94A3B8' : '#475569' },
            ]}
          >
            {message}
          </Text>

          {/* Quick Value Props Banner */}
          <View
            style={[
              styles.benefitsBox,
              {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                borderColor: isDarkMode ? '#334155' : '#EEF2F6',
              },
            ]}
          >
            <View style={styles.benefitRow}>
              <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
              <Text style={[styles.benefitText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                Real-time pit booking telemetry & order status
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
              <Text style={[styles.benefitText, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                Save motorcycles to your garage for instant fitment check
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            {/* Primary Sign In Button */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSignIn}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <BootstrapIcon name="box-arrow-in-right" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{actionLabel}</Text>
            </TouchableOpacity>

            {/* Secondary Register Button */}
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                  backgroundColor: isDarkMode ? 'transparent' : '#FFFFFF',
                },
              ]}
              onPress={handleRegister}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create New Account"
            >
              <BootstrapIcon
                name="person-plus"
                size={15}
                color={isDarkMode ? '#E2E8F0' : '#1E293B'}
              />
              <Text
                style={[
                  styles.secondaryBtnText,
                  { color: isDarkMode ? '#E2E8F0' : '#1E293B' },
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>

            {/* Dismiss / Browse as Guest */}
            <TouchableOpacity
              style={styles.tertiaryBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tertiaryBtnText,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                Continue Browsing
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
        cursor: 'default',
      },
    }),
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.select({ web: "'Inter', sans-serif" }),
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
    fontFamily: Platform.select({ web: "'Inter', sans-serif" }),
    paddingHorizontal: 8,
  },
  benefitsBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    fontFamily: Platform.select({ web: "'Inter', sans-serif" }),
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    height: 44,
    borderRadius: 10,
    cursor: 'pointer',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
      },
    }),
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.select({ web: "'Inter', sans-serif" }),
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    cursor: 'pointer',
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: Platform.select({ web: "'Inter', sans-serif" }),
  },
  tertiaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    cursor: 'pointer',
  },
  tertiaryBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: Platform.select({ web: "'Inter', sans-serif" }),
  },
});

