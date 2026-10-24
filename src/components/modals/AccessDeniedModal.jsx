import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AccessDeniedModal({ visible, onClose, onNavigateToLogin, onNavigateToAdmin }) {
  const { currentUser, adminLogin, logout, setRedirectReason } = useAuth();

  const handleInstantAdminSwitch = () => {
    if (adminLogin) {
      adminLogin();
    }
    onClose?.();
    if (onNavigateToAdmin) {
      onNavigateToAdmin();
    }
  };

  const handleManualAdminLogin = () => {
    logout();
    setRedirectReason?.('Please sign in with your Store Administrator account.');
    onClose?.();
    onNavigateToLogin?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            {
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: 24,
            },
          ]}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="shield-lock-fill" size={17} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#0F172A' }}>
                  Admin Privileges Required
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                  Store administrator verification
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="x-lg" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontSize: 13.5,
              color: '#64748B',
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            Your current account ({currentUser?.name || currentUser?.email || 'Customer'}) is a Customer account. The Admin Dashboard is reserved for Store Administrators to manage inventory, products, orders, and garage bookings.
          </Text>

          {/* Quick One-Click Switch to Admin */}
          <TouchableOpacity
            style={{
              backgroundColor: '#EA580C',
              width: '100%',
              paddingVertical: 13,
              borderRadius: 14,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#EA580C',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 2,
            }}
            onPress={handleInstantAdminSwitch}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="shield-check" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
              Switch to Store Admin (One-Click)
            </Text>
          </TouchableOpacity>

          {/* Sign In with Another Account */}
          <TouchableOpacity
            style={{
              backgroundColor: '#F1F5F9',
              width: '100%',
              paddingVertical: 13,
              borderRadius: 14,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
            onPress={handleManualAdminLogin}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="box-arrow-in-right" size={14} color="#475569" />
            <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13.5 }}>
              Sign In with Admin Credentials
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 10,
              width: '100%',
              alignItems: 'center',
            }}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 13 }}>
              Cancel & Stay on Store
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
