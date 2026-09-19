import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon';
import ConfirmModal from '../modals/ConfirmModal';
import { ANDROID_TOP_INSET } from '../../utils/safeArea';

export default function UserProfileDropdown({
  currentUser,
  isOpen,
  onClose,
  onNavigateToProfile,
  onNavigateToTrack,
  onNavigateToSettings,
  onNavigateToNotifications,
  onNavigateToAdmin,
  onLogout,
  onNavigateToDashboard,
  onNavigateToOrders,
  isMobile = false,
  align = 'right',
  topOffset,
}) {
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  if (!currentUser) return null;
  if (!isOpen && !isLogoutConfirmOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  const isUploadedAvatar = Boolean(
    currentUser?.avatar &&
    typeof currentUser.avatar === 'string' &&
    (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:image'))
  );

  const dropdownContent = (
    <>
      {/* User Quick Header */}
      <View style={styles.userHeaderRow}>
        {isUploadedAvatar ? (
          <Image
            source={{ uri: currentUser.avatar || currentUser.photoUri }}
            style={styles.avatarImg}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#DDE2E8',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#CBD5E1',
            }}
          >
            <BootstrapIcon name="person-fill" size={26} color="#64748B" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {currentUser.name || currentUser.fullName || 'Rider Account'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {currentUser.email || 'rider@mototrack.ph'}
          </Text>
          {isAdmin ? (
            <View style={[styles.roleBadge, styles.roleBadgeAdmin]}>
              <BootstrapIcon
                name="shield-lock-fill"
                size={11}
                color="#0C6258"
              />
              <Text style={[styles.roleBadgeText, styles.roleBadgeTextAdmin]}>
                Store Administrator
              </Text>
            </View>
          ) : (
            <View style={styles.roleBadge}>
              <BootstrapIcon
                name="person-fill"
                size={10}
                color="#64748B"
              />
              <Text style={styles.roleBadgeText}>
                Customer Account
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Choices Menu */}
      <View style={styles.menuList}>
        {/* 1. My Dashboard */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            onClose();
            if (onNavigateToDashboard) {
              onNavigateToDashboard('overview');
            } else if (onNavigateToProfile) {
              onNavigateToProfile('overview');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#E7F5F3' }]}>
            <BootstrapIcon name="speedometer2" size={15} color="#0C6258" />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuTitle}>My Dashboard</Text>
            <Text style={styles.menuSub}>Orders, garage bookings & rider stats</Text>
          </View>
          <BootstrapIcon name="chevron-right" size={12} color="#CBD5E1" />
        </TouchableOpacity>

        {/* 2. My Orders (Customer Dashboard) */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            onClose();
            if (onNavigateToOrders) {
              onNavigateToOrders();
            } else if (onNavigateToDashboard) {
              onNavigateToDashboard('orders');
            } else if (onNavigateToProfile) {
              onNavigateToProfile('orders');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#F0FDF4' }]}>
            <BootstrapIcon name="receipt" size={15} color="#0C6258" />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuTitle}>My Orders</Text>
            <Text style={styles.menuSub}>Track packages & purchase history</Text>
          </View>
          <BootstrapIcon name="chevron-right" size={12} color="#CBD5E1" />
        </TouchableOpacity>

        {/* 3. Settings */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            onClose();
            onNavigateToSettings?.();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
            <BootstrapIcon name="gear-fill" size={15} color="#475569" />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuTitle}>Settings</Text>
            <Text style={styles.menuSub}>Security, password & preferences</Text>
          </View>
          <BootstrapIcon name="chevron-right" size={12} color="#CBD5E1" />
        </TouchableOpacity>

        {/* 4. Notifications */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            onClose();
            onNavigateToNotifications?.();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#FEF2F2' }]}>
            <BootstrapIcon name="bell-fill" size={15} color="#E11D48" />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuTitle}>Notifications</Text>
            <Text style={styles.menuSub}>Orders, garage updates & alerts</Text>
          </View>
          <BootstrapIcon name="chevron-right" size={12} color="#CBD5E1" />
        </TouchableOpacity>

        {/* 5. Admin Dashboard (Admin Only) */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemAdmin]}
            onPress={() => {
              onClose();
              onNavigateToAdmin?.();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#D1ECE6' }]}>
              <BootstrapIcon name="shield-lock-fill" size={15} color="#0C6258" />
            </View>
            <View style={styles.menuTextWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.menuTitle, { color: '#0C6258' }]}>Admin Dashboard</Text>
                <View style={styles.adminChip}>
                  <Text style={styles.adminChipText}>CONSOLE</Text>
                </View>
              </View>
              <Text style={styles.menuSub}>Orders, inventory & garage slots</Text>
            </View>
            <BootstrapIcon name="chevron-right" size={12} color="#0C6258" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.divider} />

      {/* 6. Log Out */}
      <TouchableOpacity
        style={styles.logoutItem}
        onPress={() => {
          onClose();
          setIsLogoutConfirmOpen(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
          <BootstrapIcon name="box-arrow-right" size={15} color="#DC2626" />
        </View>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      {/* Mobile Modal Overlay */}
      {(isMobile || Platform.OS !== 'web') ? (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View
              style={[
                styles.mobileBackdrop,
                { paddingTop: topOffset ?? (Platform.OS === 'ios' ? 104 : 76 + ANDROID_TOP_INSET) },
              ]}
            >
              <TouchableWithoutFeedback
                onPress={(e) => {
                  if (e && e.stopPropagation) e.stopPropagation();
                }}
              >
                <View
                  style={[
                    styles.dropdownContainer,
                    styles.dropdownContainerMobile,
                    align === 'left' ? { alignSelf: 'flex-start' } : { alignSelf: 'flex-end' },
                  ]}
                >
                  {dropdownContent}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : (
        /* Desktop Web Dropdown */
        isOpen && (
          <>
            {/* Click-outside backdrop */}
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={styles.backdrop} />
            </TouchableWithoutFeedback>

            {/* Floating Dropdown Card */}
            <View
              style={[
                styles.dropdownContainer,
                align === 'left' ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' },
              ]}
            >
              {dropdownContent}
            </View>
          </>
        )
      )}

      {/* Center Log Out Confirmation Modal */}
      <ConfirmModal
        visible={isLogoutConfirmOpen}
        title="Log Out Confirmation"
        message="Are you sure you want to log out of your MotoTrack account?"
        confirmText="Log Out"
        cancelText="Stay Logged In"
        type="danger"
        confirmIcon="box-arrow-right"
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          onLogout?.();
        }}
        onCancel={() => {
          setIsLogoutConfirmOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    backgroundColor: 'transparent',
  },
  mobileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    paddingHorizontal: 16,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    width: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    zIndex: 9999,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  dropdownContainerMobile: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 'auto',
    marginTop: 0,
    width: '100%',
    maxWidth: 310,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 20,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#0C6258',
    backgroundColor: '#F1F5F9',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeAdmin: {
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  roleBadgeTextAdmin: {
    color: '#0C6258',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  menuList: {
    paddingVertical: 4,
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  menuItemAdmin: {
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  menuSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  adminChip: {
    backgroundColor: '#0C6258',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 2,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
});
