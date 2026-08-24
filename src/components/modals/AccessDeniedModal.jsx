import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';

export default function AccessDeniedModal({
  visible,
  onClose,
  onNavigateToLogin,
}) {
  const { currentUser } = useAuth();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxWidth: 440, alignItems: 'center', textAlign: 'center' }]}>
          <BootstrapIcon name="shield-lock-fill" size={44} color="#f59e0b" style={{ marginBottom: 10 }} />
          <Text style={{ fontSize: 19, fontWeight: '900', color: '#0F172A', marginBottom: 8 }}>
            Admin Privileges Required
          </Text>
          <Text style={{ fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
            Your current account ({currentUser?.name || 'Customer'}) is a standard Customer account. Only authorized store administrators can access the Admin Console, modify pricing, upload pictures, and manage inventory.
          </Text>

          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: '#0C6258', width: '100%', marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
            onPress={() => {
              onClose?.();
              onNavigateToLogin?.();
            }}
          >
            <BootstrapIcon name="shield-lock-fill" size={14} color="#FFFFFF" />
            <Text style={[styles.checkoutBtnText, { color: '#FFFFFF' }]}>Sign In as Store Admin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: '#F1F5F9', width: '100%', marginTop: 0 }]}
            onPress={onClose}
          >
            <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13.5 }}>
              Cancel & Stay on Store
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
