import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';

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
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxWidth: 460, alignItems: 'center', textAlign: 'center' }]}>
          <BootstrapIcon name="shield-lock-fill" size={44} color="#0C6258" style={{ marginBottom: 10 }} />
          <Text style={{ fontSize: 19, fontWeight: '900', color: '#0F172A', marginBottom: 8 }}>
            Admin Privileges Required
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            Your current account ({currentUser?.name || currentUser?.email || 'Customer'}) is a Customer account. The Admin Dashboard is reserved for Store Administrators to manage inventory, products, orders, and garage bookings.
          </Text>

          {/* Quick One-Click Switch to Admin */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              {
                backgroundColor: '#0C6258',
                width: '100%',
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              },
            ]}
            onPress={handleInstantAdminSwitch}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="shield-check" size={16} color="#FFFFFF" />
            <Text style={[styles.checkoutBtnText, { color: '#FFFFFF' }]}>
              Switch to Store Admin (One-Click)
            </Text>
          </TouchableOpacity>

          {/* Sign In with Another Account */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              {
                backgroundColor: '#F1F5F9',
                width: '100%',
                marginTop: 0,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              },
            ]}
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
