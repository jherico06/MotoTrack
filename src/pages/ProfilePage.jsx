import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { profileMobileStyles as styles } from '../styles/profilePage.styles';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { garageService } from '../services/garageService';
import { orderService } from '../services/orderService';
import { notificationService } from '../services/notificationService';
import { motorcycleService } from '../services/motorcycleService';
import { BootstrapIcon, BottomNavBar, ToastNotification } from '../components/common';
import { LiveOrderTrackingMapModal, ConfirmModal, RegisterMotorcycleModal } from '../components/modals';
import { pickImageFromFile } from '../utils/imagePickerHelper';

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu' },
  { label: 'East Poblacion, Naga', address: 'MotoTrack Hub, East Poblacion, City of Naga, Cebu' },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu' },
  { label: 'BGC Central, Taguig', address: '7th Ave & 28th St, Bonifacio Global City, Taguig' },
];

const ORDER_STATUS_FILTERS = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function formatOrderItemsSummary(order, fallback = 'Motorcycle Performance Equipment') {
  if (!order) return fallback;
  if (typeof order.itemsSummary === 'string' && order.itemsSummary.trim()) {
    return order.itemsSummary;
  }
  const items = order.items;
  if (typeof items === 'string' && items.trim()) return items;
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const name = item.name || item.product_name || 'Item';
          const qty = item.quantity != null ? item.quantity : 1;
          return qty > 1 ? `${name} ×${qty}` : name;
        }
        return null;
      })
      .filter(Boolean)
      .join(', ');
  }
  return fallback;
}

export default function ProfilePage({
  initialTab = 'overview',
  onNavigateToStore,
  onNavigateToGarage,
  onNavigateToOrders,
  onNavigateToWishlist,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToAdmin,
  onNavigateToLogin,
  onLogout,
}) {
  const { currentUser, updateProfile, logout } = useAuth();
  const wishlistCtx = useWishlist();
  const scrollViewRef = useRef(null);

  const wishlistCount = wishlistCtx?.wishlistCount || 0;

  // Active Tab: 'overview' | 'garage' | 'orders' | 'bookings' | 'notifications' | 'profile'
  const [activeTab, setActiveTab] = useState(() => {
    if (['overview', 'garage', 'orders', 'bookings', 'notifications', 'profile'].includes(initialTab)) {
      return initialTab;
    }
    return 'overview';
  });

  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab && initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  // Hamburger Choices Drawer Menu State with Smooth Slide Animation
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-340)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setIsMenuVisible(true);
    slideAnim.setValue(-340);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 24,
        mass: 0.8,
        stiffness: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const closeMenu = (callback) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -340,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsMenuVisible(false);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  // Form State (Profile Tab)
  const [name, setName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [bikeBrand, setBikeBrand] = useState(currentUser?.bikeBrand || 'Yamaha');
  const [bikeModel, setBikeModel] = useState(currentUser?.bikeModel || 'NMAX 155');
  const [bikePlate, setBikePlate] = useState(currentUser?.bikePlate || 'NM-4892');
  const [bikeOdo, setBikeOdo] = useState(currentUser?.bikeOdo || '12,500 km');
  const [isSaving, setIsSaving] = useState(false);

  // Orders Filter
  const [orderFilter, setOrderFilter] = useState('All');

  // Live Tracking Modal State
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  // Motorcycle Fleet State
  const [motorcycles, setMotorcycles] = useState(() => motorcycleService.getMotorcycles(currentUser?.id));
  const [isMotorcycleModalOpen, setIsMotorcycleModalOpen] = useState(false);
  const [editingMotorcycle, setEditingMotorcycle] = useState(null);
  const [isDeleteBikeModalOpen, setIsDeleteBikeModalOpen] = useState(false);
  const [bikeToDelete, setBikeToDelete] = useState(null);

  // Bookings State
  const [bookings, setBookings] = useState(() => {
    if (currentUser?.email || currentUser?.id || currentUser?.name || currentUser?.fullName) {
      return (
        garageService.getUserBookings(
          currentUser.email,
          currentUser.id,
          currentUser.name || currentUser.fullName
        ) || []
      );
    }
    return [];
  });

  // Orders State
  const [orders, setOrders] = useState([]);

  // Notifications State
  const [notifications, setNotifications] = useState(() =>
    notificationService.getNotifications(currentUser?.id)
  );

  // Cancel Booking Modal
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isCancelBookingModalOpen, setIsCancelBookingModalOpen] = useState(false);

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

  const handlePromptCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setIsCancelBookingModalOpen(true);
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    try {
      await garageService.cancelBooking(bookingToCancel.id);
      setIsCancelBookingModalOpen(false);
      setBookingToCancel(null);
      syncCustomerBookings();
      showToast('⚠️ Booking appointment cancelled. 20% downpayment forfeited.');
    } catch (_e) {
      showToast('Error cancelling booking.');
    }
  };

  // Logout Confirmation Modal
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const [prevUserSyncId, setPrevUserSyncId] = useState(() => currentUser?.id);
  if (currentUser && currentUser?.id !== prevUserSyncId) {
    setPrevUserSyncId(currentUser.id);
    setName(currentUser.name || currentUser.fullName || '');
    setPhone(currentUser.phone || '');
    setAddress(currentUser.address || '');
    if (currentUser.bikeBrand) setBikeBrand(currentUser.bikeBrand);
    if (currentUser.bikeModel) setBikeModel(currentUser.bikeModel);
    if (currentUser.bikePlate) setBikePlate(currentUser.bikePlate);
    if (currentUser.bikeOdo) setBikeOdo(currentUser.bikeOdo);
  }

  useEffect(() => {
    let unsubGarage = () => {};
    let unsubNotif = () => {};
    let unsubMoto = () => {};
    let isSubscribed = true;

    const syncData = async () => {
      syncCustomerBookings();

      try {
        const userOrders = await orderService.getUserOrders(
          currentUser?.id || currentUser?.user_id,
          currentUser?.customer_id,
          currentUser?.name,
          currentUser
        );
        if (isSubscribed) setOrders(Array.isArray(userOrders) ? userOrders : []);
      } catch (_e) {
        if (isSubscribed) setOrders([]);
      }

      try {
        const userBikes = motorcycleService.getMotorcycles(currentUser?.id) || [];
        if (isSubscribed) setMotorcycles(userBikes);
      } catch (_e) {}
    };

    // Defer initial execution so setState is not called synchronously in the effect body
    const initialSyncTimer = setTimeout(syncData, 0);

    try {
      if (typeof garageService?.subscribeBookings === 'function') {
        unsubGarage = garageService.subscribeBookings(syncCustomerBookings);
      } else if (typeof garageService?.subscribe === 'function') {
        unsubGarage = garageService.subscribe(syncCustomerBookings);
      }
    } catch (_e) {}

    try {
      if (typeof notificationService?.subscribe === 'function') {
        unsubNotif = notificationService.subscribe(() => {
          if (isSubscribed) {
            setNotifications(notificationService.getNotifications(currentUser?.id) || []);
          }
        });
      }
    } catch (_e) {}

    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsubMoto = motorcycleService.subscribe((list) => {
          if (isSubscribed) setMotorcycles([...list]);
        });
      }
    } catch (_e) {}

    return () => {
      isSubscribed = false;
      clearTimeout(initialSyncTimer);
      try {
        unsubGarage?.();
        unsubNotif?.();
        unsubMoto?.();
      } catch (_e) {}
    };
  }, [currentUser]);

  // Derived Values
  const activeOrders = useMemo(() => {
    return (Array.isArray(orders) ? orders : []).filter(
      (o) => o.status !== 'Cancelled' && o.status !== 'Delivered'
    );
  }, [orders]);

  const activeBookings = useMemo(() => {
    return (Array.isArray(bookings) ? bookings : []).filter(
      (b) => b.status !== 'Cancelled' && b.status !== 'Completed'
    );
  }, [bookings]);

  const totalSpent = useMemo(() => {
    return (Array.isArray(orders) ? orders : [])
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (Number(o.grandTotal || o.total) || 0), 0);
  }, [orders]);

  const activeBookingsCount = useMemo(
    () => (Array.isArray(bookings) ? bookings : []).filter((b) => b.status !== 'Cancelled').length,
    [bookings]
  );
  const unreadNotifCount = useMemo(
    () => (Array.isArray(notifications) ? notifications : []).filter((n) => n.status === 'unread').length,
    [notifications]
  );

  // Active Ongoing Order for Live Banner
  const activeOngoingOrder = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    return (
      list.find((o) => ['Processing', 'Shipped', 'Out for Delivery', 'On the Way'].includes(o.status)) ||
      list[0] ||
      null
    );
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    if (orderFilter === 'All') return list;
    return list.filter((o) => (o.status || '').toLowerCase() === orderFilter.toLowerCase());
  }, [orders, orderFilter]);

  // Next Upcoming Booking
  const nextUpcomingBooking = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    return list.find((b) => b.status !== 'Cancelled') || null;
  }, [bookings]);

  // Handlers
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
          showToast(`✓ Registered (${res.warning})`);
        } else {
          showToast(`✓ Registered ${motoData.brand} ${motoData.model} to Supabase Garage!`);
        }
      }

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
      showToast('Could not save motorcycle: ' + (err?.message || 'Error'));
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
      showToast(`★ ${bike.brand} ${bike.model} is your primary ride!`);
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
      showToast(`Motorcycle ${bikeToDelete.brand} ${bikeToDelete.model} removed.`);
    } catch (_e) {
      showToast('Failed to remove motorcycle.');
    } finally {
      setIsDeleteBikeModalOpen(false);
      setBikeToDelete(null);
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

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter your name');
      return;
    }
    setIsSaving(true);
    try {
      if (updateProfile) {
        await updateProfile({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          bikeBrand,
          bikeModel: bikeModel.trim(),
          bikePlate: bikePlate.trim(),
          bikeOdo: bikeOdo.trim(),
        });
      }
      showToast('✓ Profile updated successfully!');
    } catch (_e) {
      showToast('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrackOrder = (order) => {
    setSelectedOrderForTracking(order);
    setIsLiveTrackingOpen(true);
  };

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') onNavigateToStore?.();
    else if (tab === 'Garage') onNavigateToGarage?.();
    else if (tab === 'Dashboard') {
      setActiveTab('overview');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else if (tab === 'Customize') {
      (onNavigateToCustomizer || onNavigateToCustomize)?.();
    } else if (tab === 'Orders') {
      onNavigateToOrders?.();
    } else if (tab === 'Favorites') {
      onNavigateToWishlist?.();
    }
  };

  const getStatusBadgeStyle = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('delivered') || s.includes('completed')) {
      return { bg: '#DCFCE7', text: '#15803D' };
    }
    if (s.includes('shipped') || s.includes('way')) {
      return { bg: '#E0E7FF', text: '#4338CA' };
    }
    if (s.includes('processing') || s.includes('confirmed')) {
      return { bg: '#FEF3C7', text: '#B45309' };
    }
    if (s.includes('cancel')) {
      return { bg: '#FEE2E2', text: '#B91C1C' };
    }
    return { bg: '#F1F5F9', text: '#475569' };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ToastNotification message={toastMessage} />

      {/* ─── TOP APP BAR WITH HAMBURGER ON TOP-LEFT ─── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={openMenu}
            activeOpacity={0.7}
            accessibilityLabel="Open Dashboard Choices Menu"
          >
            <BootstrapIcon name="list" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <BootstrapIcon name="speedometer2" size={18} color="#FFFFFF" />
            <Text style={styles.titleText}>Customer Dashboard</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerActiveBadge}
          onPress={openMenu}
          activeOpacity={0.75}
        >
          <Text style={styles.headerActiveBadgeText}>
            {activeTab === 'overview' && 'Overview'}
            {activeTab === 'garage' && `Garage (${motorcycles.length})`}
            {activeTab === 'bookings' && `Bookings (${activeBookingsCount})`}
            {activeTab === 'notifications' && `Alerts (${unreadNotifCount})`}
            {activeTab === 'profile' && 'Settings'}
          </Text>
          <BootstrapIcon name="chevron-down" size={10} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ─── HAMBURGER CHOICES DRAWER MODAL WITH SLIDING EFFECT ─── */}
      <Modal
        visible={isMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <View style={styles.menuModalContainer}>
          {/* Animated Backdrop (fades in and out, tap to dismiss) */}
          <Animated.View
            style={[
              styles.menuBackdrop,
              { opacity: fadeAnim },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => closeMenu()}
            />
          </Animated.View>

          {/* Animated Drawer Menu (slides in smoothly from the left) */}
          <Animated.View
            style={[
              styles.menuDrawer,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Drawer Header */}
            <View style={styles.menuDrawerHeader}>
              <View style={styles.menuDrawerHeaderInfo}>
                <View style={styles.menuDrawerLogoWrap}>
                  <BootstrapIcon name="speedometer2" size={20} color="#0C6258" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuDrawerTitle} numberOfLines={1}>Customer Menu</Text>
                  <Text style={styles.menuDrawerSub} numberOfLines={1}>
                    {currentUser?.name || currentUser?.fullName || 'Valued Rider'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.menuCloseBtn}
                onPress={() => closeMenu()}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Dashboard Choices List */}
            <ScrollView style={styles.menuItemList} showsVerticalScrollIndicator={false}>
              <Text style={styles.menuSectionTitle}>DASHBOARD CHOICES</Text>

              {[
                { id: 'overview', label: 'Overview Hub', icon: 'speedometer2' },
                { id: 'garage', label: 'My Garage', icon: 'tools', count: motorcycles.length },
                { id: 'bookings', label: 'Pit Bookings', icon: 'calendar-check', count: activeBookingsCount },
                { id: 'notifications', label: 'Alerts', icon: 'bell', count: unreadNotifCount },
                { id: 'profile', label: 'Settings & Profile', icon: 'gear-fill' },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItemBtn, isActive && styles.menuItemBtnActive]}
                    onPress={() => {
                      closeMenu(() => setActiveTab(item.id));
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.menuItemLeft}>
                      <View style={[styles.menuItemIconWrap, isActive && styles.menuItemIconWrapActive]}>
                        <BootstrapIcon
                          name={item.icon}
                          size={16}
                          color={isActive ? '#FFFFFF' : '#0C6258'}
                        />
                      </View>
                      <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                        {item.label}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {item.count !== undefined && item.count !== null && (
                        <View style={[styles.menuItemBadge, isActive && styles.menuItemBadgeActive]}>
                          <Text style={[styles.menuItemBadgeText, isActive && styles.menuItemBadgeTextActive]}>
                            {item.count}
                          </Text>
                        </View>
                      )}
                      {isActive && (
                        <BootstrapIcon name="check2" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.menuDivider} />

              <Text style={styles.menuSectionTitle}>QUICK NAVIGATION</Text>

              <TouchableOpacity
                style={styles.menuItemBtn}
                onPress={() => {
                  closeMenu(() => onNavigateToOrders?.());
                }}
                activeOpacity={0.75}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuItemIconWrap}>
                    <BootstrapIcon name="box-seam" size={16} color="#0C6258" />
                  </View>
                  <Text style={styles.menuItemText}>My Orders</Text>
                </View>
                {orders.length > 0 && (
                  <View style={styles.menuItemBadge}>
                    <Text style={styles.menuItemBadgeText}>{orders.length}</Text>
                  </View>
                )}
                <BootstrapIcon name="chevron-right" size={13} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItemBtn}
                onPress={() => {
                  closeMenu(() => onNavigateToStore?.());
                }}
                activeOpacity={0.75}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuItemIconWrap}>
                    <BootstrapIcon name="shop" size={16} color="#0C6258" />
                  </View>
                  <Text style={styles.menuItemText}>Browse Shop</Text>
                </View>
                <BootstrapIcon name="chevron-right" size={13} color="#94A3B8" />
              </TouchableOpacity>

              {onNavigateToGarage && (
                <TouchableOpacity
                  style={styles.menuItemBtn}
                  onPress={() => {
                    closeMenu(() => onNavigateToGarage?.());
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuItemIconWrap}>
                      <BootstrapIcon name="wrench-adjustable" size={16} color="#0C6258" />
                    </View>
                    <Text style={styles.menuItemText}>Garage Services</Text>
                  </View>
                  <BootstrapIcon name="chevron-right" size={13} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Drawer Footer */}
            <View style={styles.menuDrawerFooter}>
              <TouchableOpacity
                style={styles.menuLogoutBtn}
                onPress={() => {
                  closeMenu(() => setIsLogoutModalOpen(true));
                }}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="box-arrow-right" size={15} color="#DC2626" />
                <Text style={styles.menuLogoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.maxContainer, { paddingTop: 16 }]}>
          {/* ═══════════════════════════════════════════════════════
              TAB 1: OVERVIEW / DASHBOARD HUB
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <View>
              {/* 4 KPI Stats Grid (Matching Web Customer Dashboard Stat Cards) */}
              <View style={styles.statsGrid}>
                {/* Card 1: Orders Placed */}
                <TouchableOpacity
                  style={[styles.statCard, styles.statCardTealAccent]}
                  onPress={onNavigateToOrders}
                  activeOpacity={0.85}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: '#E7F5F3' }]}>
                    <BootstrapIcon name="receipt" size={17} color="#0C6258" />
                  </View>
                  <Text style={styles.statLabel}>Orders Placed</Text>
                  <Text style={styles.statValue}>{orders.length}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    {activeOrders.length > 0 ? `${activeOrders.length} active in delivery` : 'All deliveries completed'}
                  </Text>
                </TouchableOpacity>

                {/* Card 2: Active Garage Bookings */}
                <TouchableOpacity
                  style={[styles.statCard, styles.statCardWarningAccent]}
                  onPress={() => setActiveTab('bookings')}
                  activeOpacity={0.85}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <BootstrapIcon name="calendar-check" size={17} color="#D97706" />
                  </View>
                  <Text style={styles.statLabel}>Garage Bookings</Text>
                  <Text style={styles.statValue}>{activeBookings.length}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    {bookings.length} total scheduled PMS
                  </Text>
                </TouchableOpacity>

                {/* Card 3: Wishlist Saved */}
                <TouchableOpacity
                  style={[styles.statCard, styles.statCardDangerAccent]}
                  onPress={onNavigateToWishlist}
                  activeOpacity={0.85}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <BootstrapIcon name="heart-fill" size={17} color="#DC2626" />
                  </View>
                  <Text style={styles.statLabel}>Saved Wishlist</Text>
                  <Text style={styles.statValue}>{wishlistCount || 0}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    Components ready for bag
                  </Text>
                </TouchableOpacity>

                {/* Card 4: Total Spent */}
                <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <BootstrapIcon name="wallet2" size={17} color="#2563EB" />
                  </View>
                  <Text style={styles.statLabel}>Total Spend</Text>
                  <Text style={styles.statValue}>₱{Number(totalSpent).toLocaleString()}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    Verified purchases & tuning
                  </Text>
                </View>
              </View>

              {/* 2. Live Order Tracking Banner (If Active Order Exists) */}
              {activeOngoingOrder && (
                <View style={styles.liveTrackingCard}>
                  <View style={styles.liveTrackingTopRow}>
                    <View style={styles.pulsingLiveBadge}>
                      <View style={styles.liveIndicatorDot} />
                      <Text style={styles.liveBadgeText}>Live Order In Progress</Text>
                    </View>
                    <Text style={styles.liveOrderEta}>ETA: 25-35 mins</Text>
                  </View>
                  <Text style={styles.liveOrderTitle}>
                    {activeOngoingOrder.status || 'Order in Progress'}
                  </Text>
                  <Text style={styles.liveOrderSubtitle}>
                    {formatOrderItemsSummary(
                      activeOngoingOrder,
                      'Genuine Motorparts & High Performance Accessories'
                    )}
                  </Text>
                  <TouchableOpacity
                    style={styles.trackMapBtn}
                    onPress={() => handleTrackOrder(activeOngoingOrder)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="geo-alt-fill" size={13} color="#022C22" />
                    <Text style={styles.trackMapBtnText}>Track Order Route on Live Map</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 3. Quick Actions 4-Tile Row */}
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity
                  style={styles.quickActionTile}
                  onPress={() => setActiveTab('bookings')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <BootstrapIcon name="calendar-plus-fill" size={18} color="#0C6258" />
                  </View>
                  <Text style={styles.quickActionLabel}>Book PMS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionTile}
                  onPress={onNavigateToStore}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <BootstrapIcon name="cart-check-fill" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.quickActionLabel}>Shop Parts</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionTile}
                  onPress={onNavigateToCustomizer}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIconWrap, { backgroundColor: '#FAF5FF' }]}>
                    <BootstrapIcon name="magic" size={18} color="#7C3AED" />
                  </View>
                  <Text style={styles.quickActionLabel}>AI Studio</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionTile}
                  onPress={onNavigateToOrders}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIconWrap, { backgroundColor: '#FFFBEB' }]}>
                    <BootstrapIcon name="receipt" size={18} color="#D97706" />
                  </View>
                  <Text style={styles.quickActionLabel}>Orders</Text>
                </TouchableOpacity>
              </View>

              {/* 4. Upcoming Service Appointment Card (Web Style) */}
              {nextUpcomingBooking && (
                <View style={styles.card}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                      paddingBottom: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <BootstrapIcon name="calendar-check-fill" size={15} color="#0C6258" />
                      <Text style={styles.cardTitle}>Upcoming Pit Appointment</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={[styles.statusPillText, { color: '#1D4ED8' }]}>Confirmed</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#0F172A' }}>
                    {nextUpcomingBooking.service_title ||
                      nextUpcomingBooking.serviceName ||
                      'PMS Full Inspection'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                    Motorcycle: {nextUpcomingBooking.bike_brand || 'Motorcycle'}{' '}
                    {nextUpcomingBooking.bike_model || ''} ({nextUpcomingBooking.plate_number || 'Registered'})
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <BootstrapIcon name="clock-fill" size={12} color="#0C6258" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0C6258' }}>
                      {nextUpcomingBooking.appointment_date || 'Today'} at{' '}
                      {nextUpcomingBooking.time_slot || '10:00 AM'}
                    </Text>
                  </View>
                </View>
              )}

              {/* 5. Recent Orders Preview (Web Style) */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  marginTop: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <BootstrapIcon name="box-seam-fill" size={16} color="#0C6258" />
                  <Text style={styles.sectionTitle}>Recent Orders</Text>
                </View>
                <TouchableOpacity onPress={onNavigateToOrders} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0C6258' }}>
                    View All ({orders.length}) →
                  </Text>
                </TouchableOpacity>
              </View>

              {orders.slice(0, 3).map((order) => {
                const badge = getStatusBadgeStyle(order.status);
                return (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderCardHeader}>
                      <Text style={[styles.orderIdText, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
                        {formatOrderItemsSummary(order)}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusPillText, { color: badge.text }]}>
                          {order.status || 'Processing'}
                        </Text>
                      </View>
                    </View>
                    {order.date || order.created_at ? (
                      <Text style={[styles.orderDateText, { marginBottom: 10 }]}>
                        Placed on {order.date || (typeof order.created_at === 'string' ? order.created_at.slice(0, 10) : 'Recent')}
                      </Text>
                    ) : (
                      <View style={{ marginBottom: 4 }} />
                    )}
                    <View style={styles.orderCardFooter}>
                      <View>
                        <Text style={styles.orderTotalLabel}>Total Amount</Text>
                        <Text style={styles.orderTotalPrice}>
                          ₱{Number(order.grandTotal || order.total || 0).toLocaleString()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.orderTrackBtn}
                        onPress={() => handleTrackOrder(order)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="geo-alt-fill" size={11} color="#065F46" />
                        <Text style={styles.orderTrackBtnText}>Track Order Live</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 2: MY GARAGE FLEET
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'garage' && (
            <View>
              {/* Register New Bike CTA Button */}
              <TouchableOpacity
                style={styles.addBikeBtn}
                onPress={handleOpenAddMotorcycle}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="plus-circle-fill" size={15} color="#FFFFFF" />
                <Text style={styles.addBikeBtnText}>+ Register Motorcycle to Garage</Text>
              </TouchableOpacity>

              {motorcycles.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <BootstrapIcon name="tools" size={30} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>Your Garage is Empty</Text>
                  <Text style={styles.emptySubtitle}>
                    Register your ride to track service intervals and book pitstop appointments with 1 tap.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyCtaBtn}
                    onPress={handleOpenAddMotorcycle}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptyCtaBtnText}>Register Your Motorcycle</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                motorcycles.map((bike) => (
                  <View key={bike.motorcycle_id || bike.id} style={styles.motorcycleCard}>
                    {/* Top Header */}
                    <View style={styles.motoCardHeader}>
                      <View>
                        <Text style={styles.motoBrandModel}>
                          {bike.brand} {bike.model}
                        </Text>
                        {bike.nickname ? (
                          <Text style={{ fontSize: 12, color: '#0C6258', fontWeight: '700' }}>
                            "{bike.nickname}"
                          </Text>
                        ) : null}
                      </View>
                      {bike.is_primary && (
                        <View style={styles.primaryStarBadge}>
                          <BootstrapIcon name="star-fill" size={10} color="#B45309" />
                          <Text style={styles.primaryStarText}>Primary Ride</Text>
                        </View>
                      )}
                    </View>

                    {/* Details Grid */}
                    <View style={styles.motoDetailsGrid}>
                      <View style={styles.motoDetailItem}>
                        <Text style={styles.motoDetailLabel}>Plate No.</Text>
                        <Text style={styles.motoDetailVal}>{bike.plate_number || 'N/A'}</Text>
                      </View>
                      <View style={styles.motoDetailItem}>
                        <Text style={styles.motoDetailLabel}>Displacement</Text>
                        <Text style={styles.motoDetailVal}>
                          {bike.engine_cc ? `${bike.engine_cc} cc` : '155 cc'}
                        </Text>
                      </View>
                      <View style={styles.motoDetailItem}>
                        <Text style={styles.motoDetailLabel}>Odometer</Text>
                        <Text style={styles.motoDetailVal}>{bike.odometer || '12,500 km'}</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.motoActionsRow}>
                      {!bike.is_primary && (
                        <TouchableOpacity
                          style={[styles.motoActionBtn, { backgroundColor: '#FEF3C7' }]}
                          onPress={() => handleSetPrimaryBike(bike)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.motoActionBtnText, { color: '#B45309' }]}>★ Set Primary</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.motoActionBtn}
                        onPress={() => handleOpenEditMotorcycle(bike)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.motoActionBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.motoActionBtn, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => handlePromptDeleteBike(bike)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="trash3-fill" size={12} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}


          {/* ═══════════════════════════════════════════════════════
              TAB 4: BOOKINGS (SERVICE & PMS APPOINTMENTS)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'bookings' && (
            <View>
              <TouchableOpacity style={styles.addBikeBtn} onPress={onNavigateToGarage} activeOpacity={0.85}>
                <BootstrapIcon name="calendar-plus-fill" size={15} color="#FFFFFF" />
                <Text style={styles.addBikeBtnText}>+ Book New Garage Appointment</Text>
              </TouchableOpacity>

              {bookings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <BootstrapIcon name="calendar-check" size={30} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Service Bookings</Text>
                  <Text style={styles.emptySubtitle}>
                    Schedule a Periodic Maintenance Service (PMS) or expert diagnosis at our certified garage
                    bay.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyCtaBtn}
                    onPress={onNavigateToGarage}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptyCtaBtnText}>Book a Service Slot</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                bookings.map((b) => (
                  <View key={b.id} style={styles.bookingCard}>
                    <View style={styles.bookingTopRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.bookingId}>REF: {b.id}</Text>
                        <Text style={styles.bookingServiceTitle}>
                          {b.service_title || b.serviceName || 'Service Appointment'}
                        </Text>
                        {b.repair_type ? (
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626', marginTop: 2 }}>
                            Fault: {b.repair_type}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          b.status === 'Pending' && { backgroundColor: '#FEF3C7' },
                          b.status === 'Inspection' && { backgroundColor: '#EFF6FF' },
                          b.status === 'Estimate Pending' && { backgroundColor: '#FEE2E2' },
                          (b.status === 'In Progress' || b.status === 'In-Service') && { backgroundColor: '#E0F2FE' },
                          b.status === 'Service Done' && { backgroundColor: '#DCFCE7' },
                          b.status === 'Paid' && { backgroundColor: '#D1ECE6' },
                          b.status === 'Closed' && { backgroundColor: '#F1F5F9' },
                          (b.status === 'Rejected' || b.status === 'Cancelled') && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            b.status === 'Pending' && { color: '#D97706' },
                            b.status === 'Inspection' && { color: '#2563EB' },
                            b.status === 'Estimate Pending' && { color: '#DC2626' },
                            (b.status === 'In Progress' || b.status === 'In-Service') && { color: '#0284C7' },
                            b.status === 'Service Done' && { color: '#16A34A' },
                            b.status === 'Paid' && { color: '#0C6258' },
                            b.status === 'Closed' && { color: '#475569' },
                            (b.status === 'Rejected' || b.status === 'Cancelled') && { color: '#DC2626' },
                          ]}
                        >
                          {b.status === 'Pending'
                            ? '⏳ Pending Review'
                            : b.status === 'Inspection'
                            ? '🔍 In Inspection'
                            : b.status === 'Estimate Pending'
                            ? '⚠️ Estimate Pending'
                            : b.status === 'In Progress' || b.status === 'In-Service'
                            ? '🔧 In Progress'
                            : b.status === 'Service Done'
                            ? '✓ Service Done'
                            : b.status === 'Paid'
                            ? '✓ Bay Service Paid'
                            : b.status === 'Closed'
                            ? '✓ Finished & Released'
                            : b.status === 'Cancelled'
                            ? 'Cancelled'
                            : b.status || 'Confirmed'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bookingMetaRow}>
                      <BootstrapIcon name="calendar2-event" size={13} color="#64748B" />
                      <Text style={[styles.bookingMetaText, { color: '#0F172A', fontWeight: '700' }]}>
                        {b.appointment_date || 'Today'} • {b.time_slot || '10:00 AM'}
                      </Text>
                    </View>

                    <View style={styles.bookingMetaRow}>
                      <BootstrapIcon name="bicycle" size={13} color="#64748B" />
                      <Text style={styles.bookingMetaText}>
                        {b.bike_brand || b.brand || 'Motorcycle'} {b.bike_model || b.model || ''} ({b.plate_number || b.bikePlate || 'Registered'})
                      </Text>
                    </View>

                    {b.branch ? (
                      <View style={styles.bookingMetaRow}>
                        <BootstrapIcon name="geo-alt" size={13} color="#64748B" />
                        <Text style={styles.bookingMetaText}>
                          {b.branch}
                        </Text>
                      </View>
                    ) : null}

                    {b.mechanic ? (
                      <View style={styles.bookingMetaRow}>
                        <BootstrapIcon name="person-badge" size={13} color="#0C6258" />
                        <Text style={[styles.bookingMetaText, { color: '#0C6258', fontWeight: '700' }]}>
                          Assigned: {b.mechanic}
                        </Text>
                      </View>
                    ) : null}

                    <View
                      style={{
                        backgroundColor: b.status === 'Cancelled' ? '#FEF2F2' : '#F0FDF4',
                        borderWidth: 1,
                        borderColor: b.status === 'Cancelled' ? '#FCA5A5' : '#BBF7D0',
                        borderRadius: 10,
                        padding: 10,
                        marginTop: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: b.status === 'Cancelled' ? '#DC2626' : '#166534',
                          }}
                        >
                          {b.status === 'Cancelled'
                            ? '20% Downpayment Forfeited'
                            : `✓ 20% Deposit Paid (₱${Number(b.downpayment_amount || 500).toLocaleString()})`}
                        </Text>
                        {b.downpayment_ref ? (
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>
                            Ref: {b.downpayment_ref}
                          </Text>
                        ) : null}
                      </View>
                      {b.status !== 'Cancelled' && (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534', marginTop: 3 }}>
                          Remaining Due at Bay: ₱{Number(b.remaining_balance || 2000).toLocaleString()}
                        </Text>
                      )}
                    </View>

                    {b.status !== 'Closed' && b.status !== 'Cancelled' && (
                      <TouchableOpacity
                        style={styles.cancelBookingBtn}
                        onPress={() => handlePromptCancelBooking(b)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                        <Text style={styles.cancelBookingBtnText}>Cancel Appointment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 5: NOTIFICATIONS & ALERTS
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <View>
              {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <BootstrapIcon name="bell-slash" size={30} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Alerts</Text>
                  <Text style={styles.emptySubtitle}>
                    You're all caught up! Service and order updates will appear here.
                  </Text>
                </View>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <BootstrapIcon name="info-circle-fill" size={14} color="#0C6258" />
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A', flex: 1 }}>
                        {n.title}
                      </Text>
                      {n.status === 'unread' && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18 }}>{n.message}</Text>
                    {n.created_at ? (
                      <Text style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 6 }}>{n.created_at}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 6: PROFILE DETAILS & SETTINGS
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'profile' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal & Delivery Details</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#E7F5F3',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                  }}
                  onPress={handleUploadAvatar}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="camera-fill" size={13} color="#0C6258" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0C6258' }}>Change Photo</Text>
                </TouchableOpacity>

                {isUploadedAvatar ? (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#FEE2E2',
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                    }}
                    onPress={handleRemoveAvatar}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="trash" size={13} color="#DC2626" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Remove Photo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Full Name */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your Full Name"
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="(+63) 917 000 0000"
                />
              </View>

              {/* Delivery Address */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Primary Delivery Address</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  placeholder="Street, Barangay, City, Province"
                />
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontWeight: '600' }}>
                  Quick Address Presets:
                </Text>
                <View style={styles.addressPresetsRow}>
                  {ADDRESS_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      style={styles.presetChip}
                      onPress={() => setAddress(preset.address)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.presetChipText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Primary Ride Specs */}
              <Text style={[styles.cardTitle, { marginTop: 12 }]}>Primary Motorcycle Specs</Text>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Model & Variant</Text>
                <TextInput
                  style={styles.input}
                  value={bikeModel}
                  onChangeText={setBikeModel}
                  placeholder="e.g. NMAX 155"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Plate Number</Text>
                <TextInput
                  style={styles.input}
                  value={bikePlate}
                  onChangeText={setBikePlate}
                  placeholder="e.g. NM-4892"
                />
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => setIsLogoutModalOpen(true)}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="box-arrow-right" size={15} color="#DC2626" />
                <Text style={styles.logoutBtnText}>Log Out of MotoTrack</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── MODALS ─── */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
      />

      <RegisterMotorcycleModal
        visible={isMotorcycleModalOpen}
        motorcycle={editingMotorcycle}
        isDarkMode={false}
        onClose={() => {
          setIsMotorcycleModalOpen(false);
          setEditingMotorcycle(null);
        }}
        onSave={handleSaveMotorcycle}
      />

      <ConfirmModal
        visible={isCancelBookingModalOpen}
        title="Cancel Pit Bay Appointment?"
        message={`⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour 20% advance downpayment of ₱${(bookingToCancel?.downpayment_amount !== undefined ? bookingToCancel.downpayment_amount : 500).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover technician and bay allocation. Are you sure you wish to cancel?`}
        confirmText="Yes, Cancel & Forfeit Downpayment"
        cancelText="Keep My Booking"
        type="danger"
        onConfirm={handleConfirmCancelBooking}
        onCancel={() => {
          setIsCancelBookingModalOpen(false);
          setBookingToCancel(null);
        }}
      />

      <ConfirmModal
        visible={isDeleteBikeModalOpen}
        title="Remove Motorcycle?"
        message={`Are you sure you want to remove ${bikeToDelete?.brand || ''} ${bikeToDelete?.model || ''} (${bikeToDelete?.plate_number || ''}) from your garage fleet?`}
        confirmLabel="Yes, Remove"
        cancelLabel="Keep"
        danger={true}
        onConfirm={handleConfirmDeleteBike}
        onCancel={() => {
          setIsDeleteBikeModalOpen(false);
          setBikeToDelete(null);
        }}
      />

      <ConfirmModal
        visible={isLogoutModalOpen}
        title="Log Out Confirmation"
        message="Are you sure you want to log out of your MotoTrack account?"
        confirmText="Log Out"
        cancelText="Stay Logged In"
        type="danger"
        confirmIcon="box-arrow-right"
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          if (onLogout) {
            onLogout();
          } else {
            logout?.();
            showToast('Logged out successfully');
            onNavigateToStore?.();
          }
        }}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      {/* ─── PERSISTENT MOBILE BOTTOM NAVIGATION (CENTER DASHBOARD ACTIVE) ─── */}
      <BottomNavBar
        activeTab={activeTab === 'orders' ? 'Orders' : 'Dashboard'}
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
