import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getAdminStyles, getAdminThemeTokens } from '../styles/web/admin.web.styles';
import { appStorage } from '../services/storageAdapter';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { garageService } from '../services/garageService';
import { orderService } from '../services/orderService';
import { notificationService } from '../services/notificationService';
import { BootstrapIcon, BrandLogo } from '../components/common';
import { LiveOrderTrackingMapModal, ConfirmModal, RegisterMotorcycleModal } from '../components/modals';
import { motorcycleService } from '../services/motorcycleService';
import { pickImageFromFile } from '../utils/imagePickerHelper';

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu' },
  { label: 'East Poblacion, Naga', address: 'MotoTrack Hub, East Poblacion, City of Naga, Cebu' },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu' },
  { label: 'BGC Central, Taguig', address: '7th Ave & 28th St, Bonifacio Global City, Taguig' },
];

const MOTORCYCLE_BRANDS = ['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW', 'KTM', 'Triumph'];

export default function ProfilePage({
  initialTab = 'overview',
  onNavigateToStore,
  onNavigateToGarage,
  onNavigateToOrders,
  onNavigateToWishlist,
  onNavigateToCustomizer,
  onNavigateToAdmin,
  onNavigateToLogin,
  onLogout,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isMobile = windowWidth < 768;
  const isSmallMobile = windowWidth < 480;

  const { currentUser, updateProfile, changePassword, changeEmail, getAccountLogs, logout } = useAuth();
  const { showToast: cartShowToast, addToCart } = useCart();
  const { wishlistCount } = useWishlist();

  // ─── DARK MODE STATE (Matching Admin Console) ───
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        appStorage.setItem('mototrack_customer_dark_mode', String(next));
      } catch (_e) {}
      return next;
    });
  };

  const tokens = useMemo(() => getAdminThemeTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => getAdminStyles(isDarkMode), [isDarkMode]);

  // ─── ACTIVE NAVIGATION TAB ───
  // ─── ACTIVE NAVIGATION TAB ───
  // 'overview' | 'garage' | 'orders' | 'bookings' | 'profile' | 'notifications' | 'settings'
  const [activeTab, setActiveTab] = useState(() => {
    if (
      initialTab === 'orders' ||
      initialTab === 'bookings' ||
      initialTab === 'garage' ||
      initialTab === 'settings' ||
      initialTab === 'notifications' ||
      initialTab === 'profile'
    ) {
      return initialTab;
    }
    return 'overview';
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Profile Form State
  const [name, setName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [bikeBrand, setBikeBrand] = useState(currentUser?.bikeBrand || 'Yamaha');
  const [bikeModel, setBikeModel] = useState(currentUser?.bikeModel || 'NMAX 155');
  const [bikePlate, setBikePlate] = useState(currentUser?.bikePlate || 'NM-4892');
  const [bikeOdo, setBikeOdo] = useState(currentUser?.bikeOdo || '12,400 km');
  const [isSaving, setIsSaving] = useState(false);

  // Security Form State
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Motorcycle Fleet State ("My Garage")
  const [motorcycles, setMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [isMotorcycleModalOpen, setIsMotorcycleModalOpen] = useState(false);
  const [editingMotorcycle, setEditingMotorcycle] = useState(null);
  const [isDeleteBikeModalOpen, setIsDeleteBikeModalOpen] = useState(false);
  const [bikeToDelete, setBikeToDelete] = useState(null);

  // Data lists
  const [bookings, setBookings] = useState(() => {
    if (currentUser?.email || currentUser?.id || currentUser?.name || currentUser?.fullName) {
      return garageService.getUserBookings(
        currentUser.email,
        currentUser.id,
        currentUser.name || currentUser.fullName
      ) || [];
    }
    return [];
  });
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState(() => notificationService.getNotifications(currentUser?.id));
  const [accountLogs, setAccountLogs] = useState([]);
  const [bookingFilter, setBookingFilter] = useState('All'); // 'All' | 'Active' | 'Completed' | 'Cancelled'
  const [orderFilter, setOrderFilter] = useState('All'); // 'All' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'
  const [isOrderFilterDropdownOpen, setIsOrderFilterDropdownOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('All'); // 'All' | 'order' | 'booking' | 'security'
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Live Tracking Modal State
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  // Cancellation Warning Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Logout Confirmation Modal State
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // In-page Toast
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    if (cartShowToast) cartShowToast(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleUserLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      logout?.();
      showToast('Logged out successfully');
      onNavigateToStore?.();
    }
  };

  const isUploadedAvatar = Boolean(
    currentUser?.avatar &&
    typeof currentUser.avatar === 'string' &&
    !currentUser.avatar.includes('photo-1535713875002') &&
    !currentUser.avatar.includes('photo-1534528741775') &&
    !currentUser.avatar.includes('ui-avatars.com')
  );

  const handleUploadAvatar = async () => {
    try {
      const res = await pickImageFromFile();
      if (res && res.uri) {
        if (typeof updateProfile === 'function') {
          await updateProfile({ avatar: res.uri });
          showToast('✓ Profile picture updated!');
        }
      }
    } catch (e) {
      console.warn('Upload avatar error:', e);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      if (typeof updateProfile === 'function') {
        await updateProfile({ avatar: null });
        showToast('Profile photo removed. Default avatar restored.');
      }
    } catch (e) {
      console.warn('Remove avatar error:', e);
    }
  };

  // Sync state on user change
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
      if (currentUser.bikeBrand) setBikeBrand(currentUser.bikeBrand);
      if (currentUser.bikeModel) setBikeModel(currentUser.bikeModel);
      if (currentUser.bikePlate) setBikePlate(currentUser.bikePlate);
      if (currentUser.bikeOdo) setBikeOdo(currentUser.bikeOdo);
    }
  }, [currentUser]);

  // Subscriptions & Data Loading
  useEffect(() => {
    let unsubGarage = () => {};
    let unsubNotif = () => {};

    const syncCustomerBookings = () => {
      if (currentUser?.email || currentUser?.id || currentUser?.name || currentUser?.fullName) {
        const userBks = garageService.getUserBookings(
          currentUser.email,
          currentUser.id,
          currentUser.name || currentUser.fullName
        );
        setBookings(Array.isArray(userBks) ? userBks : []);
      } else {
        setBookings([]);
      }
    };

    syncCustomerBookings();

    try {
      if (typeof garageService?.subscribeBookings === 'function') {
        unsubGarage = garageService.subscribeBookings(syncCustomerBookings);
      } else if (typeof garageService?.subscribe === 'function') {
        unsubGarage = garageService.subscribe(syncCustomerBookings);
      }
    } catch (_e) {}

    const handleCustomBookingEvent = () => syncCustomerBookings();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('mototrack_bookings_updated', handleCustomBookingEvent);
    }

    try {
      if (typeof notificationService?.subscribe === 'function') {
        unsubNotif = notificationService.subscribe(() => {
          setNotifications(notificationService.getNotifications(currentUser?.id) || []);
        });
      }
    } catch (_e) {}

    try {
      orderService
        .getUserOrders(
          currentUser?.id || currentUser?.user_id,
          currentUser?.customer_id,
          currentUser?.name,
          currentUser
        )
        .then((list) => setOrders(Array.isArray(list) ? list : []))
        .catch(() => setOrders([]));
    } catch (_e) {
      setOrders([]);
    }

    if (currentUser?.id && typeof getAccountLogs === 'function') {
      getAccountLogs(currentUser.id).then((logs) => {
        if (Array.isArray(logs)) setAccountLogs(logs);
      });
    }

    let unsubMoto = () => {};
    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsubMoto = motorcycleService.subscribe((list) => {
          setMotorcycles([...list]);
        });
      }
      setMotorcycles(motorcycleService.getMotorcycles(currentUser?.id) || []);
    } catch (_e) {}

    return () => {
      try {
        unsubGarage?.();
        unsubNotif?.();
        unsubMoto?.();
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('mototrack_bookings_updated', handleCustomBookingEvent);
        }
      } catch (_e) {}
    };
  }, [currentUser]);

  // Calculations & KPIs
  const primaryMotorcycle = useMemo(() => {
    const list = Array.isArray(motorcycles) ? motorcycles : [];
    return list.find((m) => m.is_primary) || list[0] || null;
  }, [motorcycles]);

  const activeBookings = useMemo(() => {
    return (Array.isArray(bookings) ? bookings : []).filter(
      (b) => b.status !== 'Cancelled' && b.status !== 'Completed'
    );
  }, [bookings]);

  const activeOrders = useMemo(() => {
    return (Array.isArray(orders) ? orders : []).filter(
      (o) => o.status !== 'Cancelled' && o.status !== 'Delivered'
    );
  }, [orders]);

  const totalSpent = useMemo(() => {
    return (Array.isArray(orders) ? orders : [])
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (Number(o.grandTotal || o.total) || 0), 0);
  }, [orders]);

  const unreadNotifCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (n) => n.status === 'unread' || !n.read
    ).length;
  }, [notifications]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    let list = Array.isArray(orders) ? orders : [];
    if (orderFilter !== 'All') {
      list = list.filter((o) => (o.status || '').toLowerCase() === orderFilter.toLowerCase());
    }
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.id || '').toLowerCase().includes(q) ||
          (o.items || []).some((item) => String(item.name || '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, orderFilter, orderSearchQuery]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    if (bookingFilter === 'All') return list;
    if (bookingFilter === 'Active') return list.filter((b) => b.status !== 'Cancelled' && b.status !== 'Completed');
    if (bookingFilter === 'Completed') return list.filter((b) => b.status === 'Completed');
    if (bookingFilter === 'Cancelled') return list.filter((b) => b.status === 'Cancelled');
    return list;
  }, [bookings, bookingFilter]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    if (notifFilter === 'All') return list;
    return list.filter((n) => (n.type || '').toLowerCase() === notifFilter.toLowerCase());
  }, [notifications, notifFilter]);

  // Handlers
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name');
      return;
    }
    setIsSaving(true);
    try {
      const res = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        bikeBrand,
        bikeModel: bikeModel.trim(),
        bikePlate: bikePlate.trim(),
        bikeOdo: bikeOdo.trim(),
      });
      if (res?.success) {
        showToast('✓ Rider profile successfully updated!');
      } else {
        showToast(res?.error || 'Failed to update profile.');
      }
    } catch (_e) {
      showToast('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      showToast('Please fill in all password fields');
      return;
    }
    if (newPwd.length < 8) {
      showToast('New password must be at least 8 characters');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('New passwords do not match');
      return;
    }
    setIsSavingPwd(true);
    try {
      const res = await changePassword(currentUser?.id, { currentPassword: currentPwd, newPassword: newPwd });
      if (res?.success) {
        showToast('✓ Password updated successfully!');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        showToast(res?.error || 'Current password incorrect.');
      }
    } catch (_e) {
      showToast('Failed to change password.');
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showToast('Please enter a valid email address');
      return;
    }
    if (!emailPwd) {
      showToast('Please enter your current password to confirm');
      return;
    }
    setIsSavingEmail(true);
    try {
      const res = await changeEmail(currentUser?.id, { newEmail: newEmail.trim(), currentPassword: emailPwd });
      if (res?.success) {
        showToast('✓ Account email updated successfully!');
        setNewEmail('');
        setEmailPwd('');
      } else {
        showToast(res?.error || 'Could not update email.');
      }
    } catch (_e) {
      showToast('Failed to update email address.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleConfirmCancelBooking = () => {
    if (!bookingToCancel) return;
    try {
      if (typeof garageService?.cancelBooking === 'function') {
        garageService.cancelBooking(bookingToCancel.id);
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingToCancel.id ? { ...b, status: 'Cancelled' } : b))
      );
      showToast('Service appointment cancelled.');
    } catch (_e) {
      showToast('Failed to cancel appointment.');
    } finally {
      setIsCancelModalOpen(false);
      setBookingToCancel(null);
    }
  };

  // ─── MOTORCYCLE FLEET HANDLERS ───
  const handleOpenAddMotorcycle = () => {
    setEditingMotorcycle(null);
    setIsMotorcycleModalOpen(true);
  };

  const handleOpenEditMotorcycle = (bike) => {
    setEditingMotorcycle(bike);
    setIsMotorcycleModalOpen(true);
  };

  const handleSaveMotorcycle = async (motoData) => {
    try {
      if (motoData.motorcycle_id) {
        await motorcycleService.updateMotorcycle(motoData.motorcycle_id, motoData);
        showToast(`✓ Updated ${motoData.brand} ${motoData.model}`);
      } else {
        const res = await motorcycleService.addMotorcycle({
          ...motoData,
          user_id: currentUser?.id || 'usr-rider-01',
          customer_id: currentUser?.customerId || 'cust-demo-01',
          customer_email: currentUser?.email || '',
        });
        if (res?.warning) {
          showToast(`✓ Registered in Garage (${res.warning})`);
        } else {
          showToast(`✓ Registered ${motoData.brand} ${motoData.model} to Supabase Garage!`);
        }
      }

      // If marked as primary, keep rider profile in sync
      if (motoData.is_primary) {
        setBikeBrand(motoData.brand);
        setBikeModel(motoData.model);
        setBikePlate(motoData.plate_number);
        setBikeOdo(motoData.odometer);
        if (typeof updateProfile === 'function') {
          updateProfile({
            bikeBrand: motoData.brand,
            bikeModel: motoData.model,
            bikePlate: motoData.plate_number,
            bikeOdo: motoData.odometer,
          }).catch(() => {});
        }
      }
    } catch (err) {
      showToast('Could not save motorcycle: ' + (err.message || 'Error'));
    }
  };

  const handleSetPrimaryBike = async (bike) => {
    try {
      await motorcycleService.setPrimaryMotorcycle(bike.motorcycle_id, currentUser?.id);
      setBikeBrand(bike.brand);
      setBikeModel(bike.model);
      setBikePlate(bike.plate_number);
      setBikeOdo(bike.odometer);
      if (typeof updateProfile === 'function') {
        updateProfile({
          bikeBrand: bike.brand,
          bikeModel: bike.model,
          bikePlate: bike.plate_number,
          bikeOdo: bike.odometer,
        }).catch(() => {});
      }
      showToast(`★ ${bike.brand} ${bike.model} is now your primary ride!`);
    } catch (_e) {
      showToast('Could not set primary ride.');
    }
  };

  const handlePromptDeleteBike = (bike) => {
    setBikeToDelete(bike);
    setIsDeleteBikeModalOpen(true);
  };

  const handleConfirmDeleteBike = async () => {
    if (!bikeToDelete) return;
    try {
      await motorcycleService.deleteMotorcycle(bikeToDelete.motorcycle_id);
      showToast(`Motorcycle ${bikeToDelete.brand} ${bikeToDelete.model} removed from garage.`);
    } catch (_e) {
      showToast('Failed to remove motorcycle.');
    } finally {
      setIsDeleteBikeModalOpen(false);
      setBikeToDelete(null);
    }
  };

  const navTitles = {
    overview: 'Rider Dashboard',
    garage: 'My Garage & Fleet',
    orders: 'My Orders & Deliveries',
    bookings: 'Garage Pit Appointments',
    profile: 'Rider & Bike Profile',
    notifications: 'Notifications & Alerts',
    settings: 'Security & Settings',
  };

  const navIcons = {
    overview: 'speedometer2',
    garage: 'wrench-adjustable',
    orders: 'receipt',
    bookings: 'calendar-check-fill',
    profile: 'person-vcard-fill',
    notifications: 'bell-fill',
    settings: 'shield-lock-fill',
  };

  const userDisplayName = currentUser?.name || currentUser?.fullName || 'Rider';
  const userInitials = (userDisplayName.charAt(0) || 'R').toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bgMain }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Floating Toast Notification */}
      {toastMessage ? (
        <View
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            zIndex: 99999,
            backgroundColor: '#0C6258',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 14,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>{toastMessage}</Text>
        </View>
      ) : null}

      <View style={styles.adminLayout}>
        {/* ───────────────────────────────────────────────────────────── */}
        {/* 1. LEFT SIDEBAR (DESKTOP)                                     */}
        {/* ───────────────────────────────────────────────────────────── */}
        {isDesktop && (
          <View style={styles.sidebar}>
            {/* Brand Logo Header */}
            <View style={styles.sidebarBrandRow}>
              <TouchableOpacity
                onPress={onNavigateToStore}
                style={{ flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.8}
              >
                <BrandLogo
                  size={36}
                  textColor={tokens.textPrimary}
                  accentColor="#DC2626"
                />
              </TouchableOpacity>
            </View>

            {/* Scrollable Navigation Items */}
            <ScrollView
              style={styles.sidebarNavScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* Customer Profile Box */}
              <View style={styles.adminProfileBox}>
                <View
                  style={[
                    styles.adminAvatarCircle,
                    {
                      backgroundColor: isUploadedAvatar ? '#0C6258' : '#DDE2E8',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isUploadedAvatar ? 0 : 1.5,
                      borderColor: '#CBD5E1',
                    },
                  ]}
                >
                  {isUploadedAvatar ? (
                    <Image
                      source={{ uri: currentUser.avatar || currentUser.photoUri }}
                      style={{ width: 42, height: 42, borderRadius: 21 }}
                    />
                  ) : (
                    <BootstrapIcon name="person-fill" size={24} color="#64748B" />
                  )}
                  <View style={styles.onlineIndicator} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileNameText} numberOfLines={1}>
                    {userDisplayName}
                  </Text>
                  <Text style={styles.profileRoleText} numberOfLines={1}>
                    {currentUser?.email || 'Rider Account'}
                  </Text>
                </View>
              </View>

              {/* SECTION: Rider Navigation */}
              <Text style={styles.navHeading}>My Account</Text>
              <View style={styles.sidebarNavList}>
                {/* 1. Overview */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'overview' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('overview')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="grid-1x2-fill"
                      size={16}
                      color={activeTab === 'overview' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeTab === 'overview' && styles.sidebarNavLabelActive]}>
                    Overview
                  </Text>
                </TouchableOpacity>

                {/* 2. My Garage (Fleet) */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'garage' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('garage')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="wrench-adjustable"
                      size={16}
                      color={activeTab === 'garage' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeTab === 'garage' && styles.sidebarNavLabelActive]}>
                    My Garage
                  </Text>
                  {motorcycles.length > 0 && (
                    <View
                      style={[
                        styles.sidebarCountBadge,
                        { backgroundColor: '#0C6258' },
                        activeTab === 'garage' && styles.sidebarCountBadgeActive,
                      ]}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' }}>
                        {motorcycles.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 3. My Orders */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'orders' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('orders')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="receipt"
                      size={16}
                      color={activeTab === 'orders' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeTab === 'orders' && styles.sidebarNavLabelActive]}>
                    My Orders
                  </Text>
                  {orders.length > 0 && (
                    <View
                      style={[
                        styles.sidebarCountBadge,
                        activeTab === 'orders' && styles.sidebarCountBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sidebarCountText,
                          activeTab === 'orders' && styles.sidebarCountTextActive,
                        ]}
                      >
                        {orders.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 3. Garage Bookings */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'bookings' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('bookings')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="calendar-check-fill"
                      size={16}
                      color={activeTab === 'bookings' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeTab === 'bookings' && styles.sidebarNavLabelActive]}>
                    Garage Pit Bays
                  </Text>
                  {activeBookings.length > 0 && (
                    <View
                      style={[
                        styles.sidebarCountBadge,
                        { backgroundColor: '#0C6258' },
                        activeTab === 'bookings' && styles.sidebarCountBadgeActive,
                      ]}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' }}>
                        {activeBookings.length} Active
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 4. Rider & Bike Profile */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'profile' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('profile')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="person-vcard-fill"
                      size={16}
                      color={activeTab === 'profile' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeTab === 'profile' && styles.sidebarNavLabelActive]}>
                    Rider Profile
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SECTION: Preferences & Security */}
              <Text style={styles.navHeading}>Preferences</Text>
              <View style={styles.sidebarNavList}>
                {/* 5. Notifications */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'notifications' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('notifications')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="bell-fill"
                      size={16}
                      color={activeTab === 'notifications' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.sidebarNavLabel,
                      activeTab === 'notifications' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Alerts & Updates
                  </Text>
                  {unreadNotifCount > 0 && (
                    <View
                      style={{
                        backgroundColor: '#DC2626',
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>
                        {unreadNotifCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 6. Settings & Security */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeTab === 'settings' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveTab('settings')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="shield-lock-fill"
                      size={16}
                      color={activeTab === 'settings' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeTab === 'settings' && styles.sidebarNavLabelActive]}>
                    Security & Password
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Sidebar Bottom Footer */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={onNavigateToStore}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="arrow-left" size={13} color="#0C6258" />
                <Text style={styles.quickStoreBtnText}>Return to Store</Text>
              </TouchableOpacity>

              <View style={styles.sidebarStatusRow}>
                <View style={styles.statusDotGreen} />
                <Text style={styles.sidebarStatusText}>Rider Account Synced</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.logoutSidebarBtn,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
                ]}
                onPress={handleUserLogout}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="box-arrow-right" size={14} color="#DC2626" />
                <Text style={styles.logoutSidebarText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 2. MAIN CONTENT AREA                                          */}
        {/* ───────────────────────────────────────────────────────────── */}
        <View style={[styles.mainContentArea, { backgroundColor: '#F8FAFC' }]}>
          {/* Top Content Header Bar */}
          <View
            style={[
              styles.topContentBar,
              { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' },
              !isDesktop && { paddingHorizontal: isSmallMobile ? 12 : 16, paddingVertical: 12 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#E7F5F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon
                  name={navIcons[activeTab] || 'speedometer2'}
                  size={16}
                  color="#0C6258"
                />
              </View>
              <Text style={[styles.pageBreadcrumbTitle, !isDesktop && { fontSize: isSmallMobile ? 15 : 17 }]}>
                {navTitles[activeTab] || 'Customer Console'}
              </Text>
            </View>

            <View style={[styles.topActionsRow, { gap: 8 }]}>
              {activeTab === 'garage' && (
                <TouchableOpacity
                  style={[styles.addBtnPrimary, { paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={handleOpenAddMotorcycle}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-circle-fill" size={13} color="#FFFFFF" />
                  <Text style={[styles.addBtnPrimaryText, { fontSize: 12.5 }]}>
                    {isSmallMobile ? 'Register' : 'Register Motorcycle'}
                  </Text>
                </TouchableOpacity>
              )}

              {!isDesktop && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#E7F5F3',
                    paddingHorizontal: isSmallMobile ? 10 : 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                  }}
                  onPress={onNavigateToStore}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="arrow-left" size={12} color="#0C6258" />
                  <BootstrapIcon name="shop" size={13} color="#0C6258" />
                  {!isSmallMobile && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0C6258' }}>Store</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Mobile Tab Selector for screens < 1024px */}
          {!isDesktop && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                backgroundColor: '#FFFFFF',
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
                paddingVertical: 8,
              }}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
            >
              {[
                { id: 'overview', label: 'Overview', icon: 'speedometer2' },
                { id: 'garage', label: `My Garage (${motorcycles.length})`, icon: 'wrench-adjustable' },
                { id: 'orders', label: 'Orders', icon: 'receipt' },
                { id: 'bookings', label: 'Pit Bays', icon: 'calendar-check-fill' },
                { id: 'profile', label: 'Profile', icon: 'person-vcard-fill' },
                { id: 'notifications', label: 'Alerts', icon: 'bell-fill' },
                { id: 'settings', label: 'Security', icon: 'shield-lock-fill' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isActive ? '#0C6258' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isActive ? '#0C6258' : '#E2E8F0',
                    }}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon
                      name={tab.icon}
                      size={13}
                      color={isActive ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? '800' : '600',
                        color: isActive ? '#FFFFFF' : '#334155',
                      }}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Main Scrollable Canvas */}
          <ScrollView
            contentContainerStyle={[
              styles.mainScroll,
              { maxWidth: 1200, width: '100%', alignSelf: 'center' },
              isDesktop && { padding: 28, paddingBottom: 120 },
              isTablet && { padding: 20, paddingBottom: 120 },
              isMobile && { padding: 14, paddingBottom: 110 },
            ]}
            showsVerticalScrollIndicator={true}
          >
            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 1: OVERVIEW                                           */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <View>
                {/* 4 KPI Stats Grid (Matching Admin Stat Cards) */}
                <View style={styles.statsGrid}>
                  {/* Card 1: Total Orders */}
                  <TouchableOpacity
                    style={[styles.statCard, styles.statCardTealAccent]}
                    onPress={() => setActiveTab('orders')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="receipt" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Orders Placed</Text>
                    <Text style={styles.statValue}>{orders.length}</Text>
                    <Text style={styles.statSub}>
                      {activeOrders.length > 0 ? `${activeOrders.length} active in delivery` : 'All deliveries completed'}
                    </Text>
                  </TouchableOpacity>

                  {/* Card 2: Active Garage Bookings */}
                  <TouchableOpacity
                    style={[styles.statCard, styles.statCardWarningAccent]}
                    onPress={() => setActiveTab('bookings')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7' }]}>
                      <BootstrapIcon name="calendar-check" size={18} color="#D97706" />
                    </View>
                    <Text style={styles.statLabel}>Garage Bookings</Text>
                    <Text style={styles.statValue}>{activeBookings.length}</Text>
                    <Text style={styles.statSub}>
                      {bookings.length} total scheduled PMS/repairs
                    </Text>
                  </TouchableOpacity>

                  {/* Card 3: Wishlist Saved */}
                  <TouchableOpacity
                    style={[styles.statCard, styles.statCardDangerAccent]}
                    onPress={onNavigateToWishlist}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2' }]}>
                      <BootstrapIcon name="heart-fill" size={18} color="#DC2626" />
                    </View>
                    <Text style={styles.statLabel}>Saved Wishlist</Text>
                    <Text style={styles.statValue}>{wishlistCount || 0}</Text>
                    <Text style={styles.statSub}>Components ready for bag</Text>
                  </TouchableOpacity>

                  {/* Card 4: Total Spent */}
                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' }]}>
                      <BootstrapIcon name="wallet2" size={18} color="#2563EB" />
                    </View>
                    <Text style={styles.statLabel}>Total Spend</Text>
                    <Text style={styles.statValue}>₱{Number(totalSpent).toLocaleString()}</Text>
                    <Text style={styles.statSub}>Verified purchases & tuning</Text>
                  </View>
                </View>

                {/* Split Two-Column Activity Cards */}
                <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 20, marginBottom: 20 }}>
                  {/* Left Column: Recent Orders Card */}
                  <View style={[styles.sectionCard, { flex: 1, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <BootstrapIcon name="box-seam-fill" size={18} color="#0C6258" />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                          Recent Orders
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setActiveTab('orders')} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0C6258' }}>View All ({orders.length}) →</Text>
                      </TouchableOpacity>
                    </View>

                    {orders.length === 0 ? (
                      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                        <BootstrapIcon name="cart3" size={32} color={tokens.textMuted} />
                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.textPrimary, marginTop: 8 }}>
                          No Orders Yet
                        </Text>
                        <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
                          Explore genuine racing parts & components.
                        </Text>
                        <TouchableOpacity
                          style={[styles.addBtnPrimary, { marginTop: 14 }]}
                          onPress={onNavigateToStore}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.addBtnPrimaryText}>Browse Catalog</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {orders.slice(0, 3).map((ord) => (
                          <View
                            key={ord.id}
                            style={{
                              backgroundColor: tokens.bgSub,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              borderRadius: 14,
                              padding: 14,
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                                {ord.itemsSummary || (Array.isArray(ord.items) && ord.items.length > 0 ? ord.items.map((i) => typeof i === 'string' ? i : (i?.name || i?.product_name || 'Item')).join(', ') : 'Motorcycle Performance Equipment')}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: ord.status === 'Delivered' ? '#D1FAE5' : ord.status === 'Cancelled' ? '#FEE2E2' : '#FEF3C7',
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
                                    color: ord.status === 'Delivered' ? '#065F46' : ord.status === 'Cancelled' ? '#991B1B' : '#92400E',
                                  }}
                                >
                                  {ord.status || 'Processing'}
                                </Text>
                              </View>
                            </View>

                            <Text style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 8 }}>
                              {ord.items?.length || 1} items • Total: ₱{Number(ord.grandTotal || ord.total || 0).toLocaleString()} • {ord.paymentMethod || 'COD'}
                            </Text>

                            <TouchableOpacity
                              style={{
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderWidth: 1,
                                borderColor: tokens.border,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                              onPress={() => {
                                setSelectedOrderForTracking(ord);
                                setIsLiveTrackingOpen(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="geo-alt-fill" size={12} color="#0C6258" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0C6258' }}>
                                Track Order Live
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Right Column: Next Garage Appointment Card */}
                  <View style={[styles.sectionCard, { flex: 1, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <BootstrapIcon name="tools" size={17} color="#0C6258" />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                          Garage Pit Bay Slots
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setActiveTab('bookings')} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0C6258' }}>Manage ({bookings.length}) →</Text>
                      </TouchableOpacity>
                    </View>

                    {activeBookings.length === 0 ? (
                      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                        <BootstrapIcon name="calendar-x" size={32} color={tokens.textMuted} />
                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.textPrimary, marginTop: 8 }}>
                          No Active Appointments
                        </Text>
                        <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
                          Need PMS tune-up, dyno test, or tire fitting?
                        </Text>
                        <TouchableOpacity
                          style={[styles.addBtnPrimary, { marginTop: 14 }]}
                          onPress={onNavigateToGarage}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.addBtnPrimaryText}>Book a Service Slot</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {activeBookings.slice(0, 2).map((bk) => (
                          <View
                            key={bk.id}
                            style={{
                              backgroundColor: tokens.bgSub,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              borderRadius: 14,
                              padding: 16,
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                              <Text style={{ fontSize: 13.5, fontWeight: '800', color: tokens.textPrimary }}>
                                {bk.service_title || bk.serviceName || 'Motorcycle Maintenance'}
                              </Text>
                              <View style={{ backgroundColor: '#D1ECE6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0C6258' }}>
                                  {bk.category || 'PMS'}
                                </Text>
                              </View>
                            </View>

                            <Text style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>
                              📅 {bk.appointment_date} • ⏰ {bk.time_slot}
                            </Text>
                            <Text style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 10 }}>
                              📍 {bk.branch || 'MotoTrack Flagship Central Hub'}
                            </Text>

                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  paddingVertical: 7,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                }}
                                onPress={() => setActiveTab('bookings')}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                                  View Details
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#FEE2E2',
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                }}
                                onPress={() => {
                                  setBookingToCancel(bk);
                                  setIsCancelModalOpen(true);
                                }}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                                  Cancel
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Section: My Garage Fleet Spotlight */}
                <View style={[styles.sectionCard, { marginTop: 20 }]}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: '#D1ECE6',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="wrench-adjustable" size={18} color="#0C6258" />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: tokens.textPrimary }}>
                            My Garage Fleet
                          </Text>
                          <View
                            style={{
                              backgroundColor: '#0C6258',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                              {motorcycles.length} {motorcycles.length === 1 ? 'Motorcycle' : 'Motorcycles'}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                          Registered rides with customized specs, mileage logs, and pit booking profiles
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          backgroundColor: tokens.bgSub,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onPress={() => setActiveTab('garage')}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: tokens.textPrimary }}>
                          Manage Garage Fleet →
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.addBtnPrimary, { paddingVertical: 8, paddingHorizontal: 14 }]}
                        onPress={handleOpenAddMotorcycle}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-circle-fill" size={13} color="#FFFFFF" />
                        <Text style={[styles.addBtnPrimaryText, { fontSize: 12.5 }]}>Register Motorcycle</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {motorcycles.length === 0 ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <BootstrapIcon name="tools" size={32} color={tokens.textMuted} />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: tokens.textPrimary, marginTop: 8 }}>
                        No Motorcycle Registered in My Garage Yet
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
                        Add your ride to easily book pit appointments and verify part fitments.
                      </Text>
                      <TouchableOpacity
                        style={[styles.addBtnPrimary, { marginTop: 12 }]}
                        onPress={handleOpenAddMotorcycle}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.addBtnPrimaryText}>+ Register Your Motorcycle</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14, flexWrap: 'wrap' }}>
                      {motorcycles.slice(0, 2).map((bike) => (
                        <View
                          key={bike.motorcycle_id}
                          style={{
                            flex: 1,
                            minWidth: 280,
                            backgroundColor: tokens.bgSub,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: bike.is_primary ? '#0C6258' : tokens.border,
                            overflow: 'hidden',
                          }}
                        >
                          <View style={{ position: 'relative', height: 110, backgroundColor: '#0F172A' }}>
                            <Image
                              source={{ uri: bike.photo_url }}
                              style={{ width: '100%', height: '100%', opacity: 0.88 }}
                              resizeMode="cover"
                            />
                            <View
                              style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                flexDirection: 'row',
                                gap: 6,
                              }}
                            >
                              {bike.is_primary && (
                                <View
                                  style={{
                                    backgroundColor: '#0C6258',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>
                                    ★ Primary Ride
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View
                              style={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                backgroundColor: '#FFFFFF',
                                borderWidth: 1.5,
                                borderColor: '#0C6258',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 6,
                                shadowColor: '#000',
                                shadowOpacity: 0.15,
                                shadowRadius: 3,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 }}>
                                {bike.plate_number}
                              </Text>
                            </View>
                          </View>

                          <View style={{ padding: 14 }}>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: tokens.textPrimary }}>
                              {bike.brand} {bike.model}
                            </Text>
                            {bike.nickname ? (
                              <Text style={{ fontSize: 11.5, color: '#0C6258', fontWeight: '700', marginTop: 1 }}>
                                "{bike.nickname}"
                              </Text>
                            ) : null}

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                              <View style={{ backgroundColor: tokens.bgCard, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.textPrimary }}>
                                  ⚡ {bike.engine_cc} cc
                                </Text>
                              </View>
                              <View style={{ backgroundColor: tokens.bgCard, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.textPrimary }}>
                                  📅 {bike.year}
                                </Text>
                              </View>
                              <View style={{ backgroundColor: tokens.bgCard, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.textPrimary }}>
                                  🛣️ {bike.odometer || '0 km'}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  backgroundColor: '#0C6258',
                                  paddingVertical: 7,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                }}
                                onPress={onNavigateToGarage}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                  Book Pit Service
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={{
                                  backgroundColor: tokens.bgCard,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onPress={() => handleOpenEditMotorcycle(bike)}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                                  Edit
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB: MY GARAGE (FLEET MANAGEMENT)                         */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'garage' && (
              <View>
                {/* Fleet Overview Stat Cards */}
                <View style={[styles.statsGrid, { marginBottom: 20 }]}>
                  {/* Stat 1: Total Fleet */}
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="tools" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Garage Fleet</Text>
                    <Text style={styles.statValue}>{motorcycles.length}</Text>
                    <Text style={styles.statSub}>Registered vehicles</Text>
                  </View>

                  {/* Stat 2: Primary Ride */}
                  <View style={[styles.statCard, styles.statCardWarningAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7' }]}>
                      <BootstrapIcon name="star-fill" size={18} color="#D97706" />
                    </View>
                    <Text style={styles.statLabel}>Primary Ride</Text>
                    <Text style={[styles.statValue, { fontSize: 16 }]} numberOfLines={1}>
                      {primaryMotorcycle ? `${primaryMotorcycle.brand} ${primaryMotorcycle.model}` : 'None'}
                    </Text>
                    <Text style={styles.statSub}>
                      {primaryMotorcycle ? `Plate: ${primaryMotorcycle.plate_number}` : 'No default bike set'}
                    </Text>
                  </View>

                  {/* Stat 3: Active Pit Bookings */}
                  <TouchableOpacity
                    style={[styles.statCard, styles.statCardSuccessAccent]}
                    onPress={() => setActiveTab('bookings')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(12, 98, 88, 0.15)' : '#D1ECE6' }]}>
                      <BootstrapIcon name="calendar-check" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Pit Bay Bookings</Text>
                    <Text style={styles.statValue}>{activeBookings.length}</Text>
                    <Text style={styles.statSub}>Scheduled PMS & repairs</Text>
                  </TouchableOpacity>

                  {/* Stat 4: Service Readiness */}
                  <View style={[styles.statCard, styles.statCardDangerAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                      <BootstrapIcon name="shield-check" size={18} color="#10B981" />
                    </View>
                    <Text style={styles.statLabel}>Status</Text>
                    <Text style={[styles.statValue, { color: '#059669', fontSize: 17 }]}>
                      Track & Road Ready
                    </Text>
                    <Text style={styles.statSub}>All profiles verified</Text>
                  </View>
                </View>

                {/* Empty State or Motorcycles Cards Grid */}
                {motorcycles.length === 0 ? (
                  <View style={[styles.sectionCard, { paddingVertical: 48, alignItems: 'center' }]}>
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: '#D1ECE6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <BootstrapIcon name="tools" size={32} color="#0C6258" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: tokens.textPrimary }}>
                      Your Garage is Currently Empty
                    </Text>
                    <Text
                      style={{
                        fontSize: 13.5,
                        color: tokens.textMuted,
                        textAlign: 'center',
                        maxWidth: 440,
                        marginTop: 6,
                        lineHeight: 20,
                      }}
                    >
                      Register your motorcycle to get personalized part compatibility alerts, track maintenance odometer intervals, and book priority pit bay appointments with 1 click.
                    </Text>
                    <TouchableOpacity
                      style={[styles.addBtnPrimary, { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12 }]}
                      onPress={handleOpenAddMotorcycle}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="plus-circle-fill" size={16} color="#FFFFFF" />
                      <Text style={[styles.addBtnPrimaryText, { fontSize: 14 }]}>
                        Register Your First Motorcycle
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      flexWrap: 'wrap',
                      gap: 20,
                    }}
                  >
                    {motorcycles.map((bike) => {
                      return (
                        <View
                          key={bike.motorcycle_id}
                          style={{
                            flex: isDesktop ? 1 : undefined,
                            minWidth: isDesktop ? 360 : '100%',
                            maxWidth: isDesktop ? 540 : '100%',
                            backgroundColor: tokens.bgCard,
                            borderRadius: 18,
                            borderWidth: 1.5,
                            borderColor: bike.is_primary ? '#0C6258' : tokens.border,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: isDarkMode ? 0.35 : 0.06,
                            shadowRadius: 12,
                            elevation: 4,
                          }}
                        >
                          {/* Image Banner Header */}
                          <View style={{ position: 'relative', height: 170, backgroundColor: '#0F172A' }}>
                            <Image
                              source={{ uri: bike.photo_url }}
                              style={{ width: '100%', height: '100%', opacity: 0.88 }}
                              resizeMode="cover"
                            />
                            {/* Gradient tint */}
                            <View
                              style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.25)',
                              }}
                            />

                            {/* Top Badges */}
                            <View
                              style={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                flexDirection: 'row',
                                gap: 8,
                                alignItems: 'center',
                              }}
                            >
                              {bike.is_primary ? (
                                <View
                                  style={{
                                    backgroundColor: '#0C6258',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.3,
                                    shadowRadius: 4,
                                  }}
                                >
                                  <BootstrapIcon name="star-fill" size={11} color="#FBBF24" />
                                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
                                    Primary Ride
                                  </Text>
                                </View>
                              ) : null}

                              {bike.nickname ? (
                                <View
                                  style={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                    paddingHorizontal: 9,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '700' }}>
                                    "{bike.nickname}"
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Philippine License Plate Badge */}
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 12,
                                right: 12,
                                backgroundColor: '#FFFFFF',
                                borderWidth: 2,
                                borderColor: '#0C6258',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 3,
                                shadowColor: '#000',
                                shadowOpacity: 0.25,
                                shadowRadius: 6,
                                elevation: 4,
                                alignItems: 'center',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 8.5,
                                  fontWeight: '800',
                                  color: '#0C6258',
                                  letterSpacing: 1.5,
                                  textTransform: 'uppercase',
                                }}
                              >
                                REGISTRATION
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '900',
                                  color: '#0F172A',
                                  letterSpacing: 1,
                                }}
                              >
                                {bike.plate_number}
                              </Text>
                            </View>
                          </View>

                          {/* Card Content Body */}
                          <View style={{ padding: 18 }}>
                            {/* Brand & Model Title */}
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '800',
                                color: '#0C6258',
                                textTransform: 'uppercase',
                                letterSpacing: 0.8,
                              }}
                            >
                              {bike.brand}
                            </Text>
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight: '900',
                                color: tokens.textPrimary,
                                marginTop: 2,
                              }}
                            >
                              {bike.model}
                            </Text>

                            {/* Specifications Grid Chips */}
                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                gap: 8,
                                marginTop: 14,
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor: tokens.bgSub,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <BootstrapIcon name="speedometer2" size={12} color="#0C6258" />
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                                  {bike.engine_cc} cc
                                </Text>
                              </View>

                              <View
                                style={{
                                  backgroundColor: tokens.bgSub,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <BootstrapIcon name="calendar-event" size={12} color="#0C6258" />
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                                  {bike.year}
                                </Text>
                              </View>

                              <View
                                style={{
                                  backgroundColor: tokens.bgSub,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <BootstrapIcon name="geo-alt" size={12} color="#0C6258" />
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                                  {bike.odometer || '0 km'}
                                </Text>
                              </View>

                              {bike.color ? (
                                <View
                                  style={{
                                    backgroundColor: tokens.bgSub,
                                    borderWidth: 1,
                                    borderColor: tokens.border,
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                >
                                  <BootstrapIcon name="palette-fill" size={12} color="#0C6258" />
                                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                                    {bike.color}
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            {/* VIN Number (if set) */}
                            {bike.vin_number ? (
                              <View style={{ marginTop: 10 }}>
                                <Text style={{ fontSize: 11, color: tokens.textMuted }}>
                                  Chassis / VIN: <Text style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontWeight: '700', color: tokens.textPrimary }}>{bike.vin_number}</Text>
                                </Text>
                              </View>
                            ) : null}

                            {/* Tuning & Modifications Note */}
                            {bike.notes ? (
                              <View
                                style={{
                                  backgroundColor: tokens.bgSub,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  borderRadius: 10,
                                  padding: 10,
                                  marginTop: 12,
                                  flexDirection: 'row',
                                  gap: 8,
                                  alignItems: 'flex-start',
                                }}
                              >
                                <BootstrapIcon name="gear-wide-connected" size={14} color="#0C6258" />
                                <Text style={{ fontSize: 11.5, color: tokens.textSecondary, flex: 1, lineHeight: 16 }}>
                                  {bike.notes}
                                </Text>
                              </View>
                            ) : null}

                            {/* Card Footer Actions */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginTop: 16,
                                paddingTop: 14,
                                borderTopWidth: 1,
                                borderTopColor: tokens.border,
                                flexWrap: 'wrap',
                              }}
                            >
                              {/* Book Service Action */}
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  minWidth: 120,
                                  backgroundColor: '#0C6258',
                                  paddingVertical: 9,
                                  paddingHorizontal: 12,
                                  borderRadius: 10,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                }}
                                onPress={onNavigateToGarage}
                                activeOpacity={0.8}
                              >
                                <BootstrapIcon name="calendar-plus-fill" size={13} color="#FFFFFF" />
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                  Book Pit Service
                                </Text>
                              </TouchableOpacity>

                              {/* Make Primary Action (if not already primary) */}
                              {!bike.is_primary && (
                                <TouchableOpacity
                                  style={{
                                    backgroundColor: tokens.bgSub,
                                    borderWidth: 1,
                                    borderColor: tokens.border,
                                    paddingVertical: 9,
                                    paddingHorizontal: 12,
                                    borderRadius: 10,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                  onPress={() => handleSetPrimaryBike(bike)}
                                  activeOpacity={0.8}
                                >
                                  <BootstrapIcon name="star" size={13} color="#D97706" />
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                                    Set Primary
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {/* Edit Action */}
                              <TouchableOpacity
                                style={{
                                  backgroundColor: tokens.bgSub,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                  paddingVertical: 9,
                                  paddingHorizontal: 12,
                                  borderRadius: 10,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                onPress={() => handleOpenEditMotorcycle(bike)}
                                activeOpacity={0.8}
                              >
                                <BootstrapIcon name="pencil-square" size={13} color={tokens.textPrimary} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                                  Edit
                                </Text>
                              </TouchableOpacity>

                              {/* Remove Action */}
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#FEE2E2',
                                  paddingVertical: 9,
                                  paddingHorizontal: 10,
                                  borderRadius: 10,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onPress={() => handlePromptDeleteBike(bike)}
                                activeOpacity={0.8}
                              >
                                <BootstrapIcon name="trash3-fill" size={13} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 2: MY ORDERS                                          */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'orders' && (
              <View>
                {/* 4 Orders KPI Metrics Row (Customer Order Telemetry) */}
                <View style={[styles.statsGrid, { marginBottom: 20 }]}>
                  {/* Metric 1: Total Orders Placed */}
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="bag-check-fill" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Total Orders Placed</Text>
                    <Text style={styles.statValue}>{orders.length}</Text>
                    <Text style={styles.statSub}>Full order telemetry history</Text>
                  </View>

                  {/* Metric 2: Awaiting COD Approval */}
                  <View style={[styles.statCard, styles.statCardWarningAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7' }]}>
                      <BootstrapIcon name="shield-lock-fill" size={18} color="#D97706" />
                    </View>
                    <Text style={styles.statLabel}>Awaiting COD Approval</Text>
                    <Text style={[styles.statValue, { color: '#D97706' }]}>
                      {orders.filter((o) => (o.status || '').toLowerCase().includes('pending') || (o.status || '').toLowerCase().includes('approval')).length}
                    </Text>
                    <Text style={styles.statSub}>Pending backoffice verification</Text>
                  </View>

                  {/* Metric 3: Active Dispatches */}
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' }]}>
                      <BootstrapIcon name="truck" size={18} color="#2563EB" />
                    </View>
                    <Text style={styles.statLabel}>Active Dispatches</Text>
                    <Text style={[styles.statValue, { color: '#2563EB' }]}>
                      {orders.filter((o) => ['processing', 'shipped', 'in transit'].includes((o.status || '').toLowerCase())).length}
                    </Text>
                    <Text style={styles.statSub}>Out for packing or courier transit</Text>
                  </View>

                  {/* Metric 4: Total Order Value */}
                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                      <BootstrapIcon name="cash-stack" size={18} color="#16A34A" />
                    </View>
                    <Text style={styles.statLabel}>Total Order Value</Text>
                    <Text style={[styles.statValue, { color: '#16A34A' }]}>
                      ₱{orders.reduce((acc, o) => acc + Number(o.grandTotal || o.total || 0), 0).toLocaleString()}
                    </Text>
                    <Text style={styles.statSub}>Combined checkout expenditure</Text>
                  </View>
                </View>

                {/* Orders Header & Filter Controls */}
                <View style={[styles.sectionCard, { zIndex: isOrderFilterDropdownOpen ? 1000 : 10, marginBottom: 20 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: tokens.textPrimary }}>
                      Order History ({orders.length})
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Category Dropdown */}
                      <View style={{ position: 'relative', zIndex: 1000 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: orderFilter !== 'All' ? '#D1ECE6' : (isDarkMode ? '#1E293B' : '#FFFFFF'),
                            borderWidth: 1.5,
                            borderColor: orderFilter !== 'All' ? '#0C6258' : tokens.border,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            height: 38,
                            cursor: 'pointer',
                          }}
                          onPress={() => setIsOrderFilterDropdownOpen((prev) => !prev)}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon
                            name="grid-fill"
                            size={12}
                            color={orderFilter !== 'All' ? '#0C6258' : tokens.textMuted}
                          />
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: orderFilter !== 'All' ? '800' : '600',
                              color: orderFilter !== 'All' ? '#0C6258' : tokens.textPrimary,
                            }}
                          >
                            {orderFilter === 'All' ? 'Category: All' : `Category: ${orderFilter}`}
                          </Text>
                          <BootstrapIcon
                            name={isOrderFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                            size={11}
                            color={orderFilter !== 'All' ? '#0C6258' : tokens.textMuted}
                          />
                        </TouchableOpacity>

                        {/* Dropdown Floating Menu */}
                        {isOrderFilterDropdownOpen && (
                          <>
                            <TouchableOpacity
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 999,
                                cursor: 'default',
                              }}
                              onPress={() => setIsOrderFilterDropdownOpen(false)}
                              activeOpacity={1}
                            />
                            <View
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 6,
                                minWidth: 190,
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: tokens.border,
                                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.16)',
                                paddingVertical: 6,
                                zIndex: 1000,
                                overflow: 'hidden',
                              }}
                            >
                              {[
                                { key: 'All', label: 'All Categories' },
                                { key: 'Processing', label: 'Processing' },
                                { key: 'Shipped', label: 'Shipped' },
                                { key: 'Delivered', label: 'Delivered' },
                                { key: 'Cancelled', label: 'Cancelled' },
                              ].map((item) => {
                                const isActive = orderFilter === item.key;
                                const count =
                                  item.key === 'All'
                                    ? (orders || []).length
                                    : (orders || []).filter(
                                        (o) => (o.status || '').toLowerCase() === item.key.toLowerCase()
                                      ).length;

                                return (
                                  <TouchableOpacity
                                    key={item.key}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingHorizontal: 14,
                                      paddingVertical: 9,
                                      backgroundColor: isActive
                                        ? (isDarkMode ? 'rgba(12, 98, 88, 0.25)' : '#F0FDF4')
                                        : 'transparent',
                                      cursor: 'pointer',
                                    }}
                                    onPress={() => {
                                      setOrderFilter(item.key);
                                      setIsOrderFilterDropdownOpen(false);
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <View
                                        style={{
                                          width: 7,
                                          height: 7,
                                          borderRadius: 4,
                                          backgroundColor: isActive
                                            ? '#0C6258'
                                            : item.key === 'Processing'
                                            ? '#F59E0B'
                                            : item.key === 'Shipped'
                                            ? '#3B82F6'
                                            : item.key === 'Delivered'
                                            ? '#10B981'
                                            : item.key === 'Cancelled'
                                            ? '#EF4444'
                                            : tokens.border,
                                        }}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isActive ? '800' : '600',
                                          color: isActive ? '#0C6258' : tokens.textPrimary,
                                        }}
                                      >
                                        {item.label}
                                      </Text>
                                    </View>
                                    <View
                                      style={{
                                        backgroundColor: isActive
                                          ? '#D1ECE6'
                                          : isDarkMode
                                          ? '#334155'
                                          : '#F1F5F9',
                                        paddingHorizontal: 7,
                                        paddingVertical: 2,
                                        borderRadius: 10,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontWeight: '800',
                                          color: isActive ? '#0C6258' : tokens.textMuted,
                                        }}
                                      >
                                        {count}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </>
                        )}
                      </View>

                      {/* Quick Search */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: tokens.bgSub,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          paddingHorizontal: 10,
                          height: 38,
                          minWidth: 220,
                          gap: 8,
                        }}
                      >
                        <BootstrapIcon name="search" size={13} color={tokens.textMuted} />
                        <TextInput
                          style={{ flex: 1, color: tokens.textPrimary, fontSize: 12.5 }}
                          placeholder="Search by ID or Part..."
                          placeholderTextColor={tokens.textMuted}
                          value={orderSearchQuery}
                          onChangeText={setOrderSearchQuery}
                        />
                        {orderSearchQuery ? (
                          <TouchableOpacity onPress={() => setOrderSearchQuery('')}>
                            <BootstrapIcon name="x" size={15} color={tokens.textMuted} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Orders List */}
                {filteredOrders.length === 0 ? (
                  <View style={[styles.sectionCard, { alignItems: 'center', paddingVertical: 40 }]}>
                    <BootstrapIcon name="inbox" size={40} color={tokens.textMuted} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary, marginTop: 12 }}>
                      No matching orders found
                    </Text>
                    <Text style={{ fontSize: 13, color: tokens.textMuted, marginTop: 4 }}>
                      Browse genuine high-performance motorcycle accessories in the store.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 14 }}>
                    {filteredOrders.map((o) => (
                      <View key={o.id} style={styles.sectionCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                          <View>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: tokens.textPrimary }}>
                              Order #{o.id}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 2 }}>
                              Placed on {o.orderDate || o.createdAt || 'Recent'}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={{
                                backgroundColor: o.status === 'Delivered' ? '#D1FAE5' : o.status === 'Cancelled' ? '#FEE2E2' : '#FEF3C7',
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: '800',
                                  color: o.status === 'Delivered' ? '#065F46' : o.status === 'Cancelled' ? '#991B1B' : '#92400E',
                                }}
                              >
                                {o.status || 'Processing'}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={[styles.addBtnPrimary, { paddingVertical: 7, paddingHorizontal: 12 }]}
                              onPress={() => {
                                setSelectedOrderForTracking(o);
                                setIsLiveTrackingOpen(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="geo-alt-fill" size={12} color="#FFFFFF" />
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                Track Live
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Order Items Breakdown */}
                        <View style={{ backgroundColor: tokens.bgSub, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                          {(o.items || []).map((item, idx) => (
                            <View
                              key={idx}
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingVertical: 6,
                                borderBottomWidth: idx === (o.items.length - 1) ? 0 : 1,
                                borderBottomColor: tokens.border,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                {item.image ? (
                                  <Image source={{ uri: item.image }} style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#FFFFFF' }} />
                                ) : (
                                  <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                    <BootstrapIcon name="box-seam" size={16} color="#64748B" />
                                  </View>
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }} numberOfLines={1}>
                                    {item.name}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: tokens.textMuted }}>
                                    Qty: {item.quantity || 1} • ₱{Number(item.price || 0).toLocaleString()} each
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.textPrimary }}>
                                ₱{(Number(item.price || 0) * (item.quantity || 1)).toLocaleString()}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                            Payment: <Text style={{ fontWeight: '700', color: tokens.textPrimary }}>{o.paymentMethod || 'COD'}</Text> • Total: <Text style={{ fontWeight: '900', color: '#0C6258', fontSize: 14 }}>₱{Number(o.grandTotal || o.total || 0).toLocaleString()}</Text>
                          </Text>

                          {typeof addToCart === 'function' && o.items && o.items.length > 0 && (
                            <TouchableOpacity
                              style={{
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderWidth: 1,
                                borderColor: tokens.border,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}
                              onPress={() => {
                                o.items.forEach((it) => addToCart(it, it.quantity || 1));
                                showToast('Added items back to shopping bag!');
                              }}
                            >
                              <BootstrapIcon name="arrow-repeat" size={12} color="#0C6258" />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0C6258' }}>Buy Again</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 3: GARAGE BOOKINGS                                    */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'bookings' && (
              <View>
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: tokens.textPrimary }}>
                      Service & Tuning Slots ({bookings.length})
                    </Text>

                    <TouchableOpacity style={styles.addBtnPrimary} onPress={onNavigateToGarage} activeOpacity={0.85}>
                      <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>Book New Pit Bay</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Filter Pills */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['All', 'Active', 'Completed', 'Cancelled'].map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={{
                          backgroundColor: bookingFilter === f ? '#0C6258' : tokens.bgSub,
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: bookingFilter === f ? '#0C6258' : tokens.border,
                        }}
                        onPress={() => setBookingFilter(f)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: bookingFilter === f ? '800' : '600',
                            color: bookingFilter === f ? '#FFFFFF' : tokens.textSecondary,
                          }}
                        >
                          {f}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {filteredBookings.length === 0 ? (
                  <View style={[styles.sectionCard, { alignItems: 'center', paddingVertical: 40 }]}>
                    <BootstrapIcon name="calendar-x" size={40} color={tokens.textMuted} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary, marginTop: 12 }}>
                      No service bookings found
                    </Text>
                    <Text style={{ fontSize: 13, color: tokens.textMuted, marginTop: 4 }}>
                      Reserve a master technician pit bay for PMS, diagnostics, or dyno runs.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 14 }}>
                    {filteredBookings.map((b) => (
                      <View key={b.id} style={styles.sectionCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                          <View>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary }}>
                              {b.service_title || b.serviceName || 'Motorcycle Maintenance'}
                            </Text>
                            <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                              Booking ID: {b.id} • Category: {b.category || 'PMS'}
                            </Text>
                          </View>

                          <View
                            style={{
                              backgroundColor: b.status === 'Cancelled' ? '#FEE2E2' : b.status === 'Completed' ? '#D1FAE5' : '#FEF3C7',
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '800',
                                color: b.status === 'Cancelled' ? '#991B1B' : b.status === 'Completed' ? '#065F46' : '#92400E',
                              }}
                            >
                              {b.status || 'Active'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ backgroundColor: tokens.bgSub, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                            <View style={{ minWidth: 160 }}>
                              <Text style={{ fontSize: 11, color: tokens.textMuted, textTransform: 'uppercase' }}>Date & Time</Text>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, marginTop: 2 }}>
                                {b.appointment_date} @ {b.time_slot}
                              </Text>
                            </View>

                            <View style={{ minWidth: 180 }}>
                              <Text style={{ fontSize: 11, color: tokens.textMuted, textTransform: 'uppercase' }}>Branch & Pit</Text>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, marginTop: 2 }}>
                                {b.branch || 'Central Hub'}
                              </Text>
                            </View>

                            <View style={{ minWidth: 160 }}>
                              <Text style={{ fontSize: 11, color: tokens.textMuted, textTransform: 'uppercase' }}>Vehicle</Text>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, marginTop: 2 }}>
                                {b.bike_brand || bikeBrand} {b.bike_model || bikeModel} ({b.plate_number || bikePlate})
                              </Text>
                            </View>
                          </View>
                        </View>

                        {b.status !== 'Cancelled' && b.status !== 'Completed' && (
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                            <TouchableOpacity
                              style={{
                                backgroundColor: '#FEE2E2',
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderRadius: 8,
                              }}
                              onPress={() => {
                                setBookingToCancel(b);
                                setIsCancelModalOpen(true);
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>
                                Cancel Slot
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 4: RIDER & BIKE PROFILE                               */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <View className="flex flex-col gap-6" style={{ gap: isSmallMobile ? 16 : 24 }}>
                {/* 1. Rider Personal Information Card */}
                <View
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm"
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      padding: isSmallMobile ? 14 : isMobile ? 18 : 24,
                    },
                  ]}
                >
                  {/* Card Header with Status Badge */}
                  <View
                    className="flex flex-row items-center justify-between pb-4 mb-5 border-b border-slate-100 flex-wrap gap-2"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: isSmallMobile ? 14 : 20,
                      paddingBottom: isSmallMobile ? 12 : 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <View className="flex flex-row items-center gap-3" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          backgroundColor: '#E7F5F3',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="person-badge-fill" size={17} color="#0C6258" />
                      </View>
                      <Text
                        className="text-[17px] font-extrabold text-slate-900 tracking-tight"
                        style={{ fontSize: isSmallMobile ? 15 : 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}
                      >
                        Rider Personal Information
                      </Text>
                    </View>

                    <View
                      className="flex flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#ECFDF5',
                        paddingHorizontal: 9,
                        paddingVertical: 3.5,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                      }}
                    >
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                      <Text
                        className="text-[11px] font-bold text-emerald-700"
                        style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}
                      >
                        Active Account
                      </Text>
                    </View>
                  </View>

                  {/* Profile Avatar Bar - Responsive Flex */}
                  <View
                    className="flex rounded-xl bg-slate-50 border border-slate-200/80 mb-5"
                    style={{
                      flexDirection: isSmallMobile ? 'column' : 'row',
                      alignItems: isSmallMobile ? 'flex-start' : 'center',
                      gap: isSmallMobile ? 12 : 16,
                      marginBottom: isSmallMobile ? 16 : 22,
                      padding: isSmallMobile ? 12 : 16,
                      backgroundColor: '#F8FAFC',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <View
                      className="rounded-full bg-slate-200 items-center justify-center border-2 border-teal-600 overflow-hidden shadow-sm"
                      style={{
                        width: isSmallMobile ? 56 : 64,
                        height: isSmallMobile ? 56 : 64,
                        borderRadius: isSmallMobile ? 28 : 32,
                        backgroundColor: '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: '#0C6258',
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                        elevation: 2,
                        flexShrink: 0,
                      }}
                    >
                      {isUploadedAvatar ? (
                        <Image
                          source={{ uri: currentUser?.avatar || currentUser?.photoUri }}
                          style={{
                            width: isSmallMobile ? 56 : 64,
                            height: isSmallMobile ? 56 : 64,
                            borderRadius: isSmallMobile ? 28 : 32,
                          }}
                        />
                      ) : (
                        <BootstrapIcon name="person-fill" size={isSmallMobile ? 32 : 36} color="#64748B" />
                      )}
                    </View>

                    <View className="flex-1" style={{ flex: 1, gap: 3, width: isSmallMobile ? '100%' : 'auto' }}>
                      <Text
                        className="font-extrabold text-slate-900"
                        style={{ fontSize: isSmallMobile ? 15 : 16, fontWeight: '800', color: '#0F172A' }}
                      >
                        {name || userDisplayName}
                      </Text>
                      <Text
                        className="text-xs text-slate-500"
                        style={{ fontSize: 12, color: '#64748B' }}
                      >
                        {currentUser?.email || (phone ? `Phone: ${phone}` : 'MotoTrack Rider')}
                      </Text>
                      <View
                        className="flex flex-row flex-wrap gap-2 mt-2"
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}
                      >
                        <TouchableOpacity
                          className="flex flex-row items-center gap-1.5 bg-[#0C6258] hover:bg-teal-700 px-3 py-1.5 rounded-lg"
                          style={{
                            backgroundColor: '#0C6258',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          onPress={handleUploadAvatar}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="camera-fill" size={12} color="#FFFFFF" />
                          <Text className="text-white text-xs font-bold" style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' }}>
                            {isUploadedAvatar ? 'Change Photo' : 'Upload Photo'}
                          </Text>
                        </TouchableOpacity>

                        {isUploadedAvatar && (
                          <TouchableOpacity
                            className="flex flex-row items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg"
                            style={{
                              backgroundColor: '#FEE2E2',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              borderWidth: 1,
                              borderColor: '#FCA5A5',
                            }}
                            onPress={handleRemoveAvatar}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="trash3" size={11} color="#DC2626" />
                            <Text className="text-red-600 text-xs font-bold" style={{ color: '#DC2626', fontSize: 11.5, fontWeight: '700' }}>
                              Remove
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Form Fields: Responsive 2-column for Name & Phone */}
                  <View className="flex flex-col gap-4" style={{ gap: 14 }}>
                    <View
                      style={{
                        flexDirection: windowWidth >= 640 ? 'row' : 'column',
                        gap: 12,
                      }}
                    >
                      <View className="flex-1" style={{ flex: 1 }}>
                        <Text
                          className="text-xs font-bold text-slate-700 mb-1.5"
                          style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}
                        >
                          Full Name
                        </Text>
                        <TextInput
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                          style={{
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            color: '#0F172A',
                            fontSize: 13.5,
                          }}
                          value={name}
                          onChangeText={setName}
                          placeholder="Your full name"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View className="flex-1" style={{ flex: 1 }}>
                        <Text
                          className="text-xs font-bold text-slate-700 mb-1.5"
                          style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}
                        >
                          Phone Number
                        </Text>
                        <TextInput
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                          style={{
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            color: '#0F172A',
                            fontSize: 13.5,
                          }}
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="+63 917 123 4567"
                          placeholderTextColor="#94A3B8"
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    {/* Delivery Address */}
                    <View>
                      <Text
                        className="text-xs font-bold text-slate-700 mb-1.5"
                        style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}
                      >
                        Delivery Address
                      </Text>
                      <TextInput
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 min-h-[64px]"
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          color: '#0F172A',
                          fontSize: 13.5,
                          minHeight: 64,
                          textAlignVertical: 'top',
                        }}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Complete street address, barangay, city, province..."
                        placeholderTextColor="#94A3B8"
                        multiline
                      />

                      {/* Clean Address Preset Chips */}
                      <View
                        className="flex flex-row flex-wrap items-center gap-2 mt-2.5"
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        <View
                          className="flex flex-row items-center gap-1 mr-1"
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 }}
                        >
                          <BootstrapIcon name="geo-alt-fill" size={11} color="#0C6258" />
                          <Text
                            className="text-[11px] font-bold text-slate-400"
                            style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}
                          >
                            Quick Select:
                          </Text>
                        </View>
                        {ADDRESS_PRESETS.map((p, idx) => {
                          const isCurrent = address === p.address;
                          return (
                            <TouchableOpacity
                              key={idx}
                              className={`px-3 py-1 rounded-full border transition-all ${
                                isCurrent
                                  ? 'bg-[#0C6258] border-[#0C6258]'
                                  : 'bg-slate-50 border-slate-200 hover:border-teal-500'
                              }`}
                              style={{
                                backgroundColor: isCurrent ? '#0C6258' : '#F8FAFC',
                                borderWidth: 1,
                                borderColor: isCurrent ? '#0C6258' : '#E2E8F0',
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 16,
                              }}
                              onPress={() => setAddress(p.address)}
                              activeOpacity={0.75}
                            >
                              <Text
                                className={`text-[11px] font-bold ${
                                  isCurrent ? 'text-white' : 'text-teal-800'
                                }`}
                                style={{
                                  fontSize: 11,
                                  color: isCurrent ? '#FFFFFF' : '#0C6258',
                                  fontWeight: isCurrent ? '700' : '600',
                                }}
                              >
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </View>

                {/* 2. Motorcycle Specifications Card */}
                <View
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm"
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      padding: isSmallMobile ? 14 : isMobile ? 18 : 24,
                    },
                  ]}
                >
                  {/* Card Header with Active Ride Summary */}
                  <View
                    className="flex flex-row items-center justify-between pb-4 mb-5 border-b border-slate-100 flex-wrap gap-2"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: isSmallMobile ? 14 : 20,
                      paddingBottom: isSmallMobile ? 12 : 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <View className="flex flex-row items-center gap-3" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          backgroundColor: '#E7F5F3',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="speedometer2" size={17} color="#0C6258" />
                      </View>
                      <Text
                        className="text-[17px] font-extrabold text-slate-900 tracking-tight"
                        style={{ fontSize: isSmallMobile ? 15 : 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}
                      >
                        Motorcycle Specifications
                      </Text>
                    </View>

                    <View
                      className="flex flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#F0FDFA',
                        paddingHorizontal: 9,
                        paddingVertical: 3.5,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: '#CCFBF1',
                      }}
                    >
                      <BootstrapIcon name="check2-circle" size={12} color="#0C6258" />
                      <Text
                        className="text-[11.5px] font-bold text-teal-700"
                        style={{ fontSize: 11.5, fontWeight: '700', color: '#0C6258' }}
                      >
                        {bikeBrand} {bikeModel ? `• ${bikeModel}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View className="flex flex-col gap-5" style={{ gap: 16 }}>
                    {/* Brand Selector - Responsive Wrap Grid */}
                    <View>
                      <Text
                        className="text-xs font-bold text-slate-700 mb-2"
                        style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 8 }}
                      >
                        Motorcycle Brand
                      </Text>
                      <View
                        className="flex flex-row flex-wrap gap-2"
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                      >
                        {MOTORCYCLE_BRANDS.map((b) => {
                          const isSelected = bikeBrand === b;
                          return (
                            <TouchableOpacity
                              key={b}
                              className={`px-3.5 py-1.5 rounded-xl border transition-all ${
                                isSelected
                                  ? 'bg-[#0C6258] border-[#0C6258] shadow-sm shadow-teal-700/30'
                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              }`}
                              style={{
                                backgroundColor: isSelected ? '#0C6258' : '#F8FAFC',
                                paddingHorizontal: 14,
                                paddingVertical: 7,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: isSelected ? '#0C6258' : '#E2E8F0',
                                shadowColor: isSelected ? '#0C6258' : 'transparent',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isSelected ? 0.2 : 0,
                                shadowRadius: 3,
                                elevation: isSelected ? 2 : 0,
                              }}
                              onPress={() => setBikeBrand(b)}
                              activeOpacity={0.8}
                            >
                              <Text
                                className={`text-xs font-bold ${
                                  isSelected ? 'text-white font-extrabold' : 'text-slate-700'
                                }`}
                                style={{
                                  fontSize: 12,
                                  fontWeight: isSelected ? '800' : '600',
                                  color: isSelected ? '#FFFFFF' : '#0F172A',
                                }}
                              >
                                {b}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Specifications Responsive Grid:
                        - Desktop & Tablet (>= 768px): 3 columns in a row
                        - Mobile (480px - 767px): Model top, Plate & Odo 2-column row
                        - Small Mobile (< 480px): 3 stacked items
                    */}
                    {windowWidth >= 768 ? (
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1.2 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Model / Variant
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikeModel}
                            onChangeText={setBikeModel}
                            placeholder="e.g. NMAX 155 V2 / Ninja 400"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Plate Number
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikePlate}
                            onChangeText={setBikePlate}
                            placeholder="e.g. NM-4892"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Odometer
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikeOdo}
                            onChangeText={setBikeOdo}
                            placeholder="e.g. 12,500 km"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      </View>
                    ) : windowWidth >= 480 ? (
                      <View style={{ flexDirection: 'column', gap: 12 }}>
                        <View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Model / Variant
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikeModel}
                            onChangeText={setBikeModel}
                            placeholder="e.g. NMAX 155 V2 / Ninja 400"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                              Plate Number
                            </Text>
                            <TextInput
                              style={{
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                color: '#0F172A',
                                fontSize: 13.5,
                              }}
                              value={bikePlate}
                              onChangeText={setBikePlate}
                              placeholder="e.g. NM-4892"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                              Odometer
                            </Text>
                            <TextInput
                              style={{
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                color: '#0F172A',
                                fontSize: 13.5,
                              }}
                              value={bikeOdo}
                              onChangeText={setBikeOdo}
                              placeholder="e.g. 12,500 km"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'column', gap: 12 }}>
                        <View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Model / Variant
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikeModel}
                            onChangeText={setBikeModel}
                            placeholder="e.g. NMAX 155 V2 / Ninja 400"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>

                        <View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Plate Number
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikePlate}
                            onChangeText={setBikePlate}
                            placeholder="e.g. NM-4892"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>

                        <View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Odometer
                          </Text>
                          <TextInput
                            style={{
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              color: '#0F172A',
                              fontSize: 13.5,
                            }}
                            value={bikeOdo}
                            onChangeText={setBikeOdo}
                            placeholder="e.g. 12,500 km"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      </View>
                    )}

                    {/* Bottom Action Row - Responsive Stacking */}
                    <View
                      style={{
                        flexDirection: windowWidth >= 640 ? 'row' : 'column',
                        alignItems: windowWidth >= 640 ? 'center' : 'stretch',
                        justifyContent: 'space-between',
                        marginTop: 10,
                        paddingTop: 16,
                        borderTopWidth: 1,
                        borderTopColor: '#F1F5F9',
                        gap: 12,
                      }}
                    >
                      <View
                        className="flex flex-row items-center gap-1.5"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: windowWidth >= 640 ? 'flex-start' : 'center',
                          gap: 6,
                          order: windowWidth >= 640 ? 1 : 2,
                        }}
                      >
                        <BootstrapIcon name="shield-check" size={14} color="#0C6258" />
                        <Text
                          className="text-xs text-slate-500"
                          style={{ fontSize: 12, color: '#64748B', textAlign: windowWidth >= 640 ? 'left' : 'center' }}
                        >
                          Auto-syncs across garage bookings and order dispatches
                        </Text>
                      </View>

                      <TouchableOpacity
                        className="flex flex-row items-center justify-center gap-2 bg-[#0C6258] hover:bg-teal-700 px-6 py-3 rounded-xl shadow-md shadow-teal-800/20 active:scale-95 transition-all"
                        style={[
                          styles.addBtnPrimary,
                          {
                            paddingVertical: 11,
                            paddingHorizontal: 22,
                            justifyContent: 'center',
                            borderRadius: 10,
                            order: windowWidth >= 640 ? 2 : 1,
                          },
                        ]}
                        onPress={handleSaveProfile}
                        disabled={isSaving}
                        activeOpacity={0.85}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <BootstrapIcon name="check-circle-fill" size={14} color="#FFFFFF" />
                            <Text className="text-white text-sm font-bold" style={styles.addBtnPrimaryText}>
                              Save Changes
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 5: NOTIFICATIONS                                      */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <View>
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: tokens.textPrimary }}>
                      Alerts & Messages ({notifications.length})
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {['All', 'order', 'booking', 'security'].map((f) => (
                        <TouchableOpacity
                          key={f}
                          style={{
                            backgroundColor: notifFilter === f ? '#0C6258' : tokens.bgSub,
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: notifFilter === f ? '#0C6258' : tokens.border,
                          }}
                          onPress={() => setNotifFilter(f)}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: notifFilter === f ? '800' : '600',
                              color: notifFilter === f ? '#FFFFFF' : tokens.textSecondary,
                              textTransform: 'capitalize',
                            }}
                          >
                            {f}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {filteredNotifications.length === 0 ? (
                    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                      <BootstrapIcon name="bell-slash" size={36} color={tokens.textMuted} />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: tokens.textPrimary, marginTop: 10 }}>
                        No notifications
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {filteredNotifications.map((n) => (
                        <View
                          key={n.id}
                          style={{
                            backgroundColor: tokens.bgSub,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            borderRadius: 12,
                            padding: 14,
                            flexDirection: 'row',
                            gap: 12,
                            alignItems: 'flex-start',
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: n.type === 'order' ? '#EFF6FF' : n.type === 'booking' ? '#FEF3C7' : '#FEE2E2',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <BootstrapIcon
                              name={n.type === 'order' ? 'bag-check-fill' : n.type === 'booking' ? 'tools' : 'shield-exclamation'}
                              size={16}
                              color={n.type === 'order' ? '#2563EB' : n.type === 'booking' ? '#D97706' : '#DC2626'}
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: tokens.textPrimary }}>
                              {n.title}
                            </Text>
                            <Text style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 3, lineHeight: 18 }}>
                              {n.message}
                            </Text>
                            <Text style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
                              {n.timestamp || n.created_at || 'Just now'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 6: SECURITY & SETTINGS                                */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
              <View>
                {/* Change Password Card */}
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <BootstrapIcon name="key-fill" size={18} color="#0C6258" />
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                        Change Password
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                        Keep your rider account secured with strong authentication
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textSecondary, marginBottom: 6 }}>
                        Current Password
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: tokens.bgSub,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          borderRadius: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          color: tokens.textPrimary,
                          fontSize: 13,
                        }}
                        value={currentPwd}
                        onChangeText={setCurrentPwd}
                        secureTextEntry
                        placeholder="••••••••"
                        placeholderTextColor={tokens.textMuted}
                      />
                    </View>

                    <View style={{ flexDirection: windowWidth >= 640 ? 'row' : 'column', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textSecondary, marginBottom: 6 }}>
                          New Password
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: tokens.bgSub,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            borderRadius: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            color: tokens.textPrimary,
                            fontSize: 13,
                          }}
                          value={newPwd}
                          onChangeText={setNewPwd}
                          secureTextEntry
                          placeholder="Min 8 characters"
                          placeholderTextColor={tokens.textMuted}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textSecondary, marginBottom: 6 }}>
                          Confirm New Password
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: tokens.bgSub,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            borderRadius: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            color: tokens.textPrimary,
                            fontSize: 13,
                          }}
                          value={confirmPwd}
                          onChangeText={setConfirmPwd}
                          secureTextEntry
                          placeholder="Re-enter password"
                          placeholderTextColor={tokens.textMuted}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.addBtnPrimary,
                        {
                          marginTop: 6,
                          alignSelf: isSmallMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'center',
                        },
                      ]}
                      onPress={handleChangePassword}
                      disabled={isSavingPwd}
                      activeOpacity={0.85}
                    >
                      {isSavingPwd ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.addBtnPrimaryText}>Update Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Change Email Card */}
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <BootstrapIcon name="envelope-check-fill" size={18} color="#0C6258" />
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                        Account Email Address
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                        Currently signed in as: {currentUser?.email || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: windowWidth >= 640 ? 'row' : 'column', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textSecondary, marginBottom: 6 }}>
                          New Email Address
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: tokens.bgSub,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            borderRadius: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            color: tokens.textPrimary,
                            fontSize: 13,
                          }}
                          value={newEmail}
                          onChangeText={setNewEmail}
                          placeholder="rider@newemail.com"
                          placeholderTextColor={tokens.textMuted}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textSecondary, marginBottom: 6 }}>
                          Confirm with Current Password
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: tokens.bgSub,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            borderRadius: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            color: tokens.textPrimary,
                            fontSize: 13,
                          }}
                          value={emailPwd}
                          onChangeText={setEmailPwd}
                          secureTextEntry
                          placeholder="Current password"
                          placeholderTextColor={tokens.textMuted}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.addBtnPrimary,
                        {
                          marginTop: 6,
                          alignSelf: isSmallMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'center',
                        },
                      ]}
                      onPress={handleChangeEmail}
                      disabled={isSavingEmail}
                      activeOpacity={0.85}
                    >
                      {isSavingEmail ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.addBtnPrimaryText}>Save Email Address</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Account Activity Logs */}
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <BootstrapIcon name="shield-lock" size={18} color="#0C6258" />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                      Security Activity History
                    </Text>
                  </View>

                  {accountLogs.length === 0 ? (
                    <Text style={{ fontSize: 12.5, color: tokens.textMuted }}>
                      No security alerts recorded. Your account status is clean and healthy.
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {accountLogs.slice(0, 5).map((log, idx) => (
                        <View
                          key={idx}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: tokens.bgSub,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                            {log.action}
                          </Text>
                          <Text style={{ fontSize: 11, color: tokens.textMuted }}>
                            {log.timestamp || 'Recent'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODALS                                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Live Order Tracking Modal */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => {
          setIsLiveTrackingOpen(false);
          setSelectedOrderForTracking(null);
        }}
        showToast={showToast}
      />

      {/* Cancel Booking Confirmation Modal */}
      <ConfirmModal
        visible={isCancelModalOpen}
        title="Cancel Pit Bay Booking?"
        message={`Are you sure you want to cancel your appointment for ${bookingToCancel?.service_title || 'this service'} on ${bookingToCancel?.appointment_date}?`}
        confirmLabel="Yes, Cancel Booking"
        cancelLabel="Keep Slot"
        onConfirm={handleConfirmCancelBooking}
        onCancel={() => {
          setIsCancelModalOpen(false);
          setBookingToCancel(null);
        }}
      />

      {/* Register / Edit Motorcycle Modal */}
      <RegisterMotorcycleModal
        visible={isMotorcycleModalOpen}
        motorcycle={editingMotorcycle}
        isDarkMode={isDarkMode}
        onClose={() => {
          setIsMotorcycleModalOpen(false);
          setEditingMotorcycle(null);
        }}
        onSave={handleSaveMotorcycle}
      />

      {/* Delete Motorcycle Confirmation Modal */}
      <ConfirmModal
        visible={isDeleteBikeModalOpen}
        title="Remove Motorcycle from Garage?"
        message={`Are you sure you want to remove ${bikeToDelete?.brand || ''} ${bikeToDelete?.model || ''} (${bikeToDelete?.plate_number || ''}) from your garage fleet?`}
        confirmLabel="Yes, Remove Motorcycle"
        cancelLabel="Keep in Garage"
        danger={true}
        onConfirm={handleConfirmDeleteBike}
        onCancel={() => {
          setIsDeleteBikeModalOpen(false);
          setBikeToDelete(null);
        }}
      />

      {/* Log Out Confirmation Modal */}
      <ConfirmModal
        visible={isLogoutModalOpen}
        title="Log Out Confirmation"
        message="Are you sure you want to log out of your MotoTrack account?"
        confirmText="Log Out"
        cancelText="Stay Logged In"
        type="danger"
        confirmIcon="box-arrow-right"
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </SafeAreaView>
  );
}
