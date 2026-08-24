import React from 'react';
import { View, Text, TouchableOpacity, Image, Modal, Platform } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';

export default function ProfileModal({
  visible,
  onClose,
  onNavigateToOrders,
  onNavigateToWishlist,
  onNavigateToAdmin,
}) {
  const { currentUser, logout } = useAuth();
  const { wishlistCount } = useWishlist();

  if (!currentUser) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BootstrapIcon name="person-circle" size={18} color="#0C6258" />
              <Text style={styles.modalTitle}>User Account & Settings</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.avatarWrap, { width: 64, height: 64, borderRadius: 32 }]}>
              <Image
                source={{
                  uri:
                    currentUser.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
                }}
                style={styles.avatarImg}
              />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 8 }}>
              {currentUser.name || currentUser.fullName}
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B' }}>
              {currentUser.email}
            </Text>
            <View
              style={{
                backgroundColor: currentUser.role === 'admin' ? '#F3F7F6' : '#F1F5F9',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 10,
                marginTop: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <BootstrapIcon
                name={currentUser.role === 'admin' ? 'shield-lock-fill' : 'person-fill'}
                size={12}
                color={currentUser.role === 'admin' ? '#0C6258' : '#475569'}
              />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  color: currentUser.role === 'admin' ? '#0C6258' : '#475569',
                }}
              >
                {currentUser.role === 'admin' ? 'Store Administrator' : 'Customer Account'}
              </Text>
            </View>
          </View>

          {/* Direct Link to My Orders */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
            ]}
            onPress={() => {
              onClose?.();
              onNavigateToOrders?.();
            }}
          >
            <BootstrapIcon name="box-seam-fill" size={14} color="#0C6258" />
            <Text style={{ color: '#0C6258', fontWeight: '800', fontSize: 13.5 }}>
              View My Orders & Tracking
            </Text>
          </TouchableOpacity>

          {/* Direct Link to Wishlist */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
            ]}
            onPress={() => {
              onClose?.();
              onNavigateToWishlist?.();
            }}
          >
            <BootstrapIcon name="heart-fill" size={14} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13.5 }}>
              View Saved Favorites ({wishlistCount})
            </Text>
          </TouchableOpacity>

          {/* Admin console button (Web only) */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                { backgroundColor: '#0C6258', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
              ]}
              onPress={() => {
                onClose?.();
                onNavigateToAdmin?.();
              }}
            >
              <BootstrapIcon name="shield-lock-fill" size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Admin Dashboard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: '#F1F5F9', marginTop: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
            onPress={() => {
              logout();
              onClose?.();
            }}
          >
            <BootstrapIcon name="box-arrow-right" size={14} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 14 }}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
