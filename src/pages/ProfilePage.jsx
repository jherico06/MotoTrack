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
  TouchableWithoutFeedback,
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
import { LiveOrderTrackingMapModal, ConfirmModal, RegisterMotorcycleModal, EditCustomerSettingsModal, CompanyInfoModal } from '../components/modals';
import { pickImageFromFile } from '../utils/imagePickerHelper';

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu' },
  { label: 'South Poblacion (Store)', address: "D'Blockchain Motorparts and Accessories, Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu" },
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

const getOrderGrandTotal = (order) => {
  if (!order) return 0;
  const val = Number(
    order.grand_total ??
    order.grandTotal ??
    order.total_amount ??
    order.total ??
    order.totalAmount ??
    0
  );
  if (!isNaN(val) && val > 0) return val;

  if (Array.isArray(order.items) && order.items.length > 0) {
    const calc = order.items.reduce((sum, i) => {
      const price = Number(i?.price ?? i?.cost ?? i?.unit_cost ?? 0);
      const qty = Number(i?.quantity) || 1;
      return sum + (price * qty);
    }, 0);
    if (calc > 0) return calc;
  }
  return !isNaN(val) ? val : 0;
};

const isOrderDeliveredOrDone = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (s.includes('out') || s.includes('transit') || s.includes('shipped') || s.includes('ready') || s.includes('report')) {
    return false;
  }
  return s === 'delivered' || s.includes('complete') || s.includes('cancel') || s.includes('refund');
};

const isOrderPendingApproval = (status) => {
  const s = String(status || '').toLowerCase();
  return s.includes('pending') || s.includes('approval');
};

const getOrderStatusRank = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (s.includes('pending') || s.includes('approval') || s === 'processing') return 1;
  if (s.includes('out') || s.includes('transit') || s.includes('shipped') || s.includes('ready') || s.includes('report')) return 2;
  if (s === 'delivered' || s.includes('complete')) return 3;
  if (s.includes('cancel') || s.includes('refund')) return 4;
  return 2;
};

const sortOrdersByPriority = (orderList) => {
  if (!Array.isArray(orderList)) return [];
  return [...orderList].sort((a, b) => {
    const rankA = getOrderStatusRank(a.status);
    const rankB = getOrderStatusRank(b.status);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const dateA = new Date(a.created_at || a.date || a.orderDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.created_at || b.date || b.orderDate || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
};

function formatNotifTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch (_e) {
    return '';
  }
}

function getNotifVisuals(type) {
  switch (type) {
    case 'order':
      return { icon: 'bag-check-fill', bg: '#DCFCE7', color: '#16A34A', label: 'Order' };
    case 'booking':
      return { icon: 'tools', bg: '#FEF3C7', color: '#D97706', label: 'Pitstop' };
    case 'promo':
    case 'welcome':
      return { icon: 'lightning-charge-fill', bg: '#F3E8FF', color: '#9333EA', label: 'Special' };
    case 'security':
    case 'system':
      return { icon: 'shield-lock-fill', bg: '#FEE2E2', color: '#DC2626', label: 'Security' };
    default:
      return { icon: 'bell-fill', bg: '#E2E8F0', color: '#1D4533', label: 'Alert' };
  }
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
  const { currentUser, updateProfile, changePassword, changeEmail, logout } = useAuth();
  const wishlistCtx = useWishlist();
  const scrollViewRef = useRef(null);

  const wishlistCount = wishlistCtx?.wishlistCount || 0;

  // Active Tab: 'overview' | 'garage' | 'orders' | 'bookings' | 'notifications' | 'profile' | 'menu'
  const [activeTab, setActiveTab] = useState(() => {
    if (
      ['overview', 'garage', 'orders', 'bookings', 'notifications', 'profile', 'settings', 'menu'].includes(initialTab)
    ) {
      return initialTab;
    }
    return 'overview';
  });

  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab && initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  // Form State (Profile Tab)
  const initialName = currentUser?.name || currentUser?.fullName || '';
  const initialParts = initialName.trim().split(' ');
  const [name, setName] = useState(initialName);
  const [firstName, setFirstName] = useState(currentUser?.firstName || initialParts[0] || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || (initialParts.length > 1 ? initialParts.slice(1).join(' ') : ''));
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [city, setCity] = useState(currentUser?.city || 'City of Naga');
  const [country, setCountry] = useState(currentUser?.country || 'Philippines');
  const [bio, setBio] = useState(currentUser?.bio || 'Motorcycle Enthusiast & Customer');
  const [deliveryNotes, setDeliveryNotes] = useState(currentUser?.deliveryNotes || 'Leave at front gate / contact on delivery');
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [isEditingGarageInfo, setIsEditingGarageInfo] = useState(false);
  const [isEditingSecurity, setIsEditingSecurity] = useState(false);
  const [bikeBrand, setBikeBrand] = useState(currentUser?.bikeBrand || 'Yamaha');
  const [bikeModel, setBikeModel] = useState(currentUser?.bikeModel || 'NMAX 155');
  const [bikePlate, setBikePlate] = useState(currentUser?.bikePlate || 'NM-4892');
  const [bikeOdo, setBikeOdo] = useState(currentUser?.bikeOdo || '12,500 km');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isEditSettingsModalOpen, setIsEditSettingsModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isEditEmailOpen, setIsEditEmailOpen] = useState(false);

  // Security Form State
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Orders Filter
  const [orderFilter, setOrderFilter] = useState('All');

  // More / Menu Tab Sub-view and Modals
  const [menuSubView, setMenuSubView] = useState('main'); // 'main' | 'settings_privacy'
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isPrivacyCenterOpen, setIsPrivacyCenterOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English (US)');
  const [isPrivacyCheckupOpen, setIsPrivacyCheckupOpen] = useState(false);
  const [isContentPrefOpen, setIsContentPrefOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isDisplayModalOpen, setIsDisplayModalOpen] = useState(false);

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
  const [notifFilter, setNotifFilter] = useState('all');

  const filteredTabNotifications = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    return list.filter((n) => {
      if (notifFilter === 'unread') return n.status === 'unread';
      if (notifFilter === 'order') return n.type === 'order';
      if (notifFilter === 'booking') return n.type === 'booking';
      if (notifFilter === 'promo') return n.type === 'promo' || n.type === 'welcome';
      return true;
    });
  }, [notifications, notifFilter]);

  const handleMarkAllCustomerNotificationsRead = async () => {
    await notificationService.markAllCustomerAsRead(currentUser?.id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
  };

  const handleCustomerNotificationPress = async (n) => {
    if (n.status === 'unread') {
      await notificationService.markCustomerAsRead(n.id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
    if (n.link === 'orders' || n.type === 'order') {
      setActiveTab('orders');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } else if (n.link === 'garage' || n.link === 'bookings' || n.type === 'booking') {
      setActiveTab('bookings');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } else if (n.link === 'shop' || n.type === 'promo') {
      onNavigateToStore?.();
    }
  };

  const handleDeleteCustomerNotification = async (id) => {
    await notificationService.deleteCustomerNotification(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
  };

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
    const syncName = currentUser.name || currentUser.fullName || '';
    const parts = syncName.trim().split(' ');
    setName(syncName);
    setFirstName(currentUser.firstName || parts[0] || '');
    setLastName(currentUser.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : ''));
    setPhone(currentUser.phone || '');
    setAddress(currentUser.address || '');
    if (currentUser.bikeBrand) setBikeBrand(currentUser.bikeBrand);
    if (currentUser.bikeModel) setBikeModel(currentUser.bikeModel);
    if (currentUser.bikePlate) setBikePlate(currentUser.bikePlate);
    if (currentUser.bikeOdo) setBikeOdo(currentUser.bikeOdo);
    if (currentUser.city) setCity(currentUser.city);
    if (currentUser.country) setCountry(currentUser.country);
    if (currentUser.bio) setBio(currentUser.bio);
    if (currentUser.deliveryNotes) setDeliveryNotes(currentUser.deliveryNotes);
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

  const activePendingOrders = useMemo(() => {
    return (Array.isArray(orders) ? orders : []).filter(
      (o) => !isOrderDeliveredOrDone(o.status)
    );
  }, [orders]);

  const totalSpent = useMemo(() => {
    return (Array.isArray(orders) ? orders : [])
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + getOrderGrandTotal(o), 0);
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
      list.find((o) => {
        const s = String(o?.status || '').toLowerCase();
        return !s.includes('deliver') && !s.includes('complete') && !s.includes('cancel') && !s.includes('refund');
      }) || null
    );
  }, [orders]);

  const sortedOrders = useMemo(() => {
    return sortOrdersByPriority(orders);
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    let filtered = list;
    if (orderFilter !== 'All') {
      filtered = filtered.filter((o) => (o.status || '').toLowerCase() === orderFilter.toLowerCase());
    }
    return sortOrdersByPriority(filtered);
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
    const combinedName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || name.trim();
    if (!combinedName) {
      showToast('Please enter your name');
      return;
    }
    setIsSaving(true);
    try {
      if (updateProfile) {
        await updateProfile({
          name: combinedName,
          fullName: combinedName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          country: country.trim(),
          bio: bio.trim(),
          deliveryNotes: deliveryNotes.trim(),
          bikeBrand,
          bikeModel: bikeModel.trim(),
          bikePlate: bikePlate.trim(),
          bikeOdo: bikeOdo.trim(),
        });
      }
      setName(combinedName);
      showToast('✓ Account profile successfully updated!');
      setIsEditingPersonalInfo(false);
      setIsEditingGarageInfo(false);
    } catch (_e) {
      showToast('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfileFromModal = async (payload) => {
    try {
      if (updateProfile) {
        const res = await updateProfile(payload);
        if (res && res.success === false) return res;
      }
      if (payload.firstName) setFirstName(payload.firstName);
      if (payload.lastName) setLastName(payload.lastName);
      if (payload.name) setName(payload.name);
      if (payload.phone) setPhone(payload.phone);
      if (payload.address) setAddress(payload.address);
      if (payload.city) setCity(payload.city);
      if (payload.country) setCountry(payload.country);
      if (payload.bio) setBio(payload.bio);
      if (payload.deliveryNotes) setDeliveryNotes(payload.deliveryNotes);
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message || 'Failed to update settings.' };
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
      const res = await changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      if (res?.success) {
        showToast('✓ Password updated successfully!');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
        setIsChangePasswordOpen(false);
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
      const res = await changeEmail({ newEmail: newEmail.trim(), currentPassword: emailPwd });
      if (res?.success) {
        showToast('✓ Account email updated successfully!');
        setNewEmail('');
        setEmailPwd('');
        setIsEditEmailOpen(false);
      } else {
        showToast(res?.error || 'Could not update email.');
      }
    } catch (_e) {
      showToast('Failed to update email address.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleTrackOrder = (order) => {
    const s = String(order?.status || '').toLowerCase();
    if (s.includes('pending') || s.includes('approval')) {
      showToast('⏳ Order is pending admin approval. Live map tracking will unlock once approved.');
      return;
    }
    if (s.includes('deliver') || s.includes('complete') || s.includes('cancel') || s.includes('refund')) {
      showToast('✓ This order has already been delivered and confirmed!');
      return;
    }
    setSelectedOrderForTracking(order);
    setIsLiveTrackingOpen(true);
  };

  const handleSubmitReport = () => {
    if (!reportText.trim()) return;
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setReportText('');
      setIsReportModalOpen(false);
      showToast('Thank you for reporting this issue! Our team has been notified.');
    }, 1800);
  };

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') onNavigateToStore?.();
    else if (tab === 'Garage') onNavigateToGarage?.();
    else if (tab === 'Customize') (onNavigateToCustomizer || onNavigateToCustomize)?.();
    else if (tab === 'Orders') onNavigateToOrders?.();
    else if (tab === 'More' || tab === 'menu') {
      setActiveTab('menu');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } else if (tab === 'Dashboard') {
      setActiveTab('overview');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else if (tab === 'Bookings') {
      setActiveTab('bookings');
    } else if (tab === 'Notifications') {
      setActiveTab('notifications');
    } else if (tab === 'Profile') {
      setActiveTab('profile');
    } else if (tab === 'Wishlist' || tab === 'Favorites') {
      onNavigateToWishlist?.();
    } else if (tab === 'Admin') {
      onNavigateToAdmin?.();
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
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ToastNotification message={toastMessage} />

      {/* ─── TOP APP BAR (NO TOP HAMBURGER) ─── */}
      {activeTab !== 'profile' && (
        <View style={styles.headerRow}>
          <View style={styles.headerLeftGroup}>
            <View style={styles.titleRow}>
              <BootstrapIcon
                name={activeTab === 'menu' ? 'grid-fill' : 'speedometer2'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.titleText}>{activeTab === 'menu' ? 'Menu' : 'Customer Dashboard'}</Text>
            </View>
          </View>

          {activeTab !== 'menu' && (
            <TouchableOpacity
              style={styles.headerActiveBadge}
              onPress={() => {
                setActiveTab('menu');
                scrollViewRef.current?.scrollTo({ y: 0, animated: false });
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.headerActiveBadgeText}>
                {activeTab === 'overview' && 'Overview'}
                {activeTab === 'garage' && `Garage (${motorcycles.length})`}
                {activeTab === 'bookings' && `Bookings (${activeBookingsCount})`}
                {activeTab === 'notifications' && `Alerts (${unreadNotifCount})`}
                {activeTab === 'profile' && 'Profile'}
                {activeTab === 'settings' && 'Settings'}
              </Text>
              <BootstrapIcon name="chevron-down" size={10} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, activeTab === 'profile' && { backgroundColor: '#F8FAFC' }]}
        contentContainerStyle={[
          styles.scrollContent,
          activeTab === 'menu' && styles.menuScrollContent,
          activeTab === 'profile' && { paddingBottom: 110, paddingHorizontal: 0 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          activeTab === 'profile' ? { width: '100%', paddingHorizontal: 0 } : styles.maxContainer,
          activeTab === 'menu' ? { paddingTop: 8 } : (activeTab === 'profile' ? { paddingTop: 0 } : { paddingTop: 16 })
        ]}>
          {/* ═══════════════════════════════════════════════════════
              TAB 0: MENU SCREEN (MATCHING REFERENCE SCREENSHOT)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'menu' && (
            <View style={styles.menuContentWrapper}>
              {menuSubView === 'settings_privacy' ? (
                /* ═══════════════════════════════════════════════════════
                   SETTINGS & PRIVACY SUB-VIEW (MOBILE APP)
                   ═══════════════════════════════════════════════════════ */
                <View style={styles.menuRefCard}>
                  {/* Top Header with Back Arrow and Title */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#E4E6EB' }}>
                    <TouchableOpacity
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E4E6EB', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setMenuSubView('main')}
                      activeOpacity={0.7}
                      accessibilityLabel="Back to More menu"
                    >
                      <BootstrapIcon name="arrow-left" size={18} color="#050505" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#050505', letterSpacing: -0.3 }}>Settings & privacy</Text>
                  </View>

                  {/* 1. Settings */}
                  <TouchableOpacity
                    style={styles.menuRefRowBtn}
                    onPress={() => {
                      setActiveTab('settings');
                      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuRefRowLeft}>
                      <View style={styles.menuRefIconWrap}>
                        <BootstrapIcon name="gear-fill" size={17} color="#050505" />
                      </View>
                      <Text style={styles.menuRefRowText}>Settings</Text>
                    </View>
                    <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                  </TouchableOpacity>

                  <View style={styles.menuRefHairline} />

                  {/* 2. Language */}
                  <TouchableOpacity
                    style={styles.menuRefRowBtn}
                    onPress={() => setIsLanguageModalOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuRefRowLeft}>
                      <View style={styles.menuRefIconWrap}>
                        <BootstrapIcon name="globe" size={17} color="#050505" />
                      </View>
                      <Text style={styles.menuRefRowText}>Language</Text>
                    </View>
                    <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                  </TouchableOpacity>

                  <View style={styles.menuRefHairline} />

                  {/* 3. Privacy checkup */}
                  <TouchableOpacity
                    style={styles.menuRefRowBtn}
                    onPress={() => setIsPrivacyCheckupOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuRefRowLeft}>
                      <View style={styles.menuRefIconWrap}>
                        <BootstrapIcon name="shield-check" size={17} color="#050505" />
                      </View>
                      <Text style={styles.menuRefRowText}>Privacy checkup</Text>
                    </View>
                    <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                  </TouchableOpacity>

                  <View style={styles.menuRefHairline} />

                  {/* 4. Privacy Center */}
                  <TouchableOpacity
                    style={styles.menuRefRowBtn}
                    onPress={() => setIsPrivacyCenterOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuRefRowLeft}>
                      <View style={styles.menuRefIconWrap}>
                        <BootstrapIcon name="shield-lock-fill" size={17} color="#050505" />
                      </View>
                      <Text style={styles.menuRefRowText}>Privacy Center</Text>
                    </View>
                    <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                  </TouchableOpacity>

                  <View style={styles.menuRefHairline} />

                  {/* 5. Activity log */}
                  <TouchableOpacity
                    style={styles.menuRefRowBtn}
                    onPress={() => {
                      setActiveTab('orders');
                      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuRefRowLeft}>
                      <View style={styles.menuRefIconWrap}>
                        <BootstrapIcon name="list-task" size={17} color="#050505" />
                      </View>
                      <Text style={styles.menuRefRowText}>Activity log</Text>
                    </View>
                    <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                  </TouchableOpacity>

                  <View style={styles.menuRefHairline} />

                  {/* 6. Content preferences */}
                  <TouchableOpacity
                    style={styles.menuRefRowBtn}
                    onPress={() => setIsContentPrefOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuRefRowLeft}>
                      <View style={styles.menuRefIconWrap}>
                        <BootstrapIcon name="sliders" size={17} color="#050505" />
                      </View>
                      <Text style={styles.menuRefRowText}>Content preferences</Text>
                    </View>
                    <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                  </TouchableOpacity>
                </View>
              ) : (
                /* ═══════════════════════════════════════════════════════
                   ORGANIZED MAIN "MORE" SCREEN (MATCHING REFERENCE SCREENSHOT)
                   ═══════════════════════════════════════════════════════ */
                <>
                  {/* CARD 1: PRIMARY PROFILE & SYSTEM CARD */}
                  <View style={styles.menuRefCard}>
                    {/* User Profile Header */}
                    <TouchableOpacity
                      style={styles.menuRefProfileRow}
                      onPress={() => {
                        setActiveTab('profile');
                        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.menuRefAvatar, { overflow: 'hidden' }]}>
                        {currentUser?.avatar ? (
                          <Image source={{ uri: currentUser.avatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <BootstrapIcon name="person-fill" size={24} color="#65676B" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.menuRefUserName} numberOfLines={1}>
                          {currentUser?.name || currentUser?.fullName || 'Rider Account'}
                        </Text>
                        <Text style={styles.menuRefUserSub} numberOfLines={1}>
                          See your profile
                        </Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={15} color="#8A8D91" />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 1. Settings & privacy */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => setMenuSubView('settings_privacy')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="gear-fill" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Settings & privacy</Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 2. Help & support */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => setIsHelpModalOpen(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="question-circle-fill" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Help & support</Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 3. Report a problem */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => setIsReportModalOpen(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="chat-square-dots-fill" size={17} color="#050505" />
                        </View>
                        <View>
                          <Text style={styles.menuRefRowText}>Report a problem</Text>
                          <Text style={{ fontSize: 11, color: '#65676B', marginTop: 1 }}>Feedback & bug reporting</Text>
                        </View>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 4. Display & accessibility */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => setIsDisplayModalOpen(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="moon-fill" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Display & accessibility</Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                    </TouchableOpacity>
                  </View>

                  {/* CARD 2: ACTIVITY & SERVICES */}
                  <Text style={styles.menuRefSectionTitle}>Activity & Services</Text>
                  <View style={styles.menuRefCard}>
                    {/* 1. Overview Hub */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => {
                        setActiveTab('overview');
                        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="speedometer2" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Overview Hub</Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 2. My Garage */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => {
                        setActiveTab('garage');
                        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="tools" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>My Garage</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {motorcycles.length > 0 && (
                          <View style={styles.menuRefCountBadge}>
                            <Text style={styles.menuRefCountBadgeText}>{motorcycles.length}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 3. Pit Bookings */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => {
                        setActiveTab('bookings');
                        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="calendar-check" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Pit Bookings</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {activeBookingsCount > 0 && (
                          <View style={styles.menuRefCountBadge}>
                            <Text style={styles.menuRefCountBadgeText}>{activeBookingsCount}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 4. Alerts & Notifications */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => {
                        setActiveTab('notifications');
                        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="bell" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Alerts & Notifications</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {unreadNotifCount > 0 && (
                          <View style={[styles.menuRefCountBadge, { backgroundColor: '#EF4444' }]}>
                            <Text style={styles.menuRefCountBadgeText}>{unreadNotifCount}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* CARD 3: STORE ADMINISTRATION (IF ADMIN) */}
                  {currentUser?.role === 'admin' && (
                    <>
                      <Text style={styles.menuRefSectionTitle}>Store Administration</Text>
                      <View style={styles.menuRefCard}>
                        <TouchableOpacity
                          style={styles.menuRefRowBtn}
                          onPress={() => onNavigateToAdmin?.()}
                          activeOpacity={0.7}
                        >
                          <View style={styles.menuRefRowLeft}>
                            <View style={[styles.menuRefIconWrap, { backgroundColor: '#E8F0EC' }]}>
                              <BootstrapIcon name="shield-lock-fill" size={17} color="#1D4533" />
                            </View>
                            <Text style={[styles.menuRefRowText, { color: '#1D4533', fontWeight: '700' }]}>Admin Console</Text>
                          </View>
                          <BootstrapIcon name="chevron-right" size={14} color="#1D4533" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* CARD 4: SESSION & ACCOUNT ACCESS (LOG OUT / SIGN IN AT THE VERY LAST) */}
                  <View style={[styles.menuRefCard, { marginTop: 6, marginBottom: 36 }]}>
                    {currentUser ? (
                      <TouchableOpacity
                        style={styles.menuRefRowBtn}
                        onPress={() => setIsLogoutModalOpen(true)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.menuRefRowLeft}>
                          <View style={[styles.menuRefIconWrap, { backgroundColor: '#FEE2E2' }]}>
                            <BootstrapIcon name="box-arrow-right" size={17} color="#DC2626" />
                          </View>
                          <Text style={[styles.menuRefRowText, { color: '#DC2626', fontWeight: '700' }]}>Log out</Text>
                        </View>
                        <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.menuRefRowBtn}
                        onPress={() => onNavigateToLogin?.()}
                        activeOpacity={0.7}
                      >
                        <View style={styles.menuRefRowLeft}>
                          <View style={[styles.menuRefIconWrap, { backgroundColor: '#E8F0EC' }]}>
                            <BootstrapIcon name="box-arrow-in-right" size={17} color="#1D4533" />
                          </View>
                          <Text style={[styles.menuRefRowText, { color: '#1D4533', fontWeight: '700' }]}>Sign In / Register</Text>
                        </View>
                        <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

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
                  <Text style={styles.statLabel}>Orders Placed</Text>
                  <Text style={styles.statValue}>{orders.length}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    {activeOrders.length > 0
                      ? `${activeOrders.length} active in delivery`
                      : 'All deliveries completed'}
                  </Text>
                </TouchableOpacity>

                {/* Card 2: Active Garage Bookings */}
                <TouchableOpacity
                  style={[styles.statCard, styles.statCardWarningAccent]}
                  onPress={() => setActiveTab('bookings')}
                  activeOpacity={0.85}
                >
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
                  <Text style={styles.statLabel}>Saved Wishlist</Text>
                  <Text style={styles.statValue}>{wishlistCount || 0}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    Components ready for bag
                  </Text>
                </TouchableOpacity>

                {/* Card 4: Total Spent */}
                <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                  <Text style={styles.statLabel}>Total Spend</Text>
                  <Text style={styles.statValue}>₱{Number(totalSpent).toLocaleString()}</Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    Verified purchases & tuning
                  </Text>
                </View>
              </View>

              {/* Customer Account Settings & Profile Quick Card */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#1D4533',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        borderWidth: 1.5,
                        borderColor: '#C8DDD3',
                      }}
                    >
                      {currentUser?.avatar || currentUser?.photoUri ? (
                        <Image
                          source={{ uri: currentUser?.avatar || currentUser?.photoUri }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <BootstrapIcon name="person-fill" size={20} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
                          {currentUser?.name || currentUser?.fullName || 'Rider Account'}
                        </Text>
                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#166534' }}>Verified</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }} numberOfLines={1}>
                        {currentUser?.email || 'Customer Account'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: '#1D4533',
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 8,
                    }}
                    onPress={() => setIsEditSettingsModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="pencil-square" size={12} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Details snippet */}
                <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BootstrapIcon name="geo-alt-fill" size={13} color="#64748B" />
                    <Text style={{ fontSize: 12, color: '#334155', flex: 1 }} numberOfLines={2}>
                      <Text style={{ fontWeight: '700' }}>Address:</Text> {currentUser?.address ? `${currentUser.address}, ${currentUser.city || 'City of Naga'}` : 'Not set — tap Edit to configure'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BootstrapIcon name="telephone-fill" size={12} color="#64748B" />
                    <Text style={{ fontSize: 12, color: '#334155', flex: 1 }} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>Phone:</Text> {currentUser?.phone || 'Not provided'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveTab('settings');
                      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                    }}
                    style={{ marginTop: 4, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1D4533' }}>
                      View Full Settings →
                    </Text>
                  </TouchableOpacity>
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
                    <BootstrapIcon name="calendar-plus-fill" size={18} color="#1D4533" />
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
                      <BootstrapIcon name="calendar-check-fill" size={15} color="#1D4533" />
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
                    {nextUpcomingBooking.bike_model || ''} ({nextUpcomingBooking.plate_number || 'Registered'}
                    )
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <BootstrapIcon name="clock-fill" size={12} color="#1D4533" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>
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
                  <BootstrapIcon name="box-seam-fill" size={16} color="#1D4533" />
                  <Text style={styles.sectionTitle}>Recent Orders</Text>
                </View>
                <TouchableOpacity onPress={onNavigateToOrders} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1D4533' }}>
                    View All ({orders.length}) →
                  </Text>
                </TouchableOpacity>
              </View>

              {orders.length === 0 ? (
                <View style={[styles.orderCard, { alignItems: 'center', paddingVertical: 20 }]}>
                  <BootstrapIcon name="cart3" size={28} color="#94A3B8" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 6 }}>
                    No Orders Yet
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, textAlign: 'center' }}>
                    Explore genuine racing parts & components.
                  </Text>
                  <TouchableOpacity
                    style={[styles.orderTrackBtn, { marginTop: 10, backgroundColor: '#1D4533', borderColor: '#163527' }]}
                    onPress={onNavigateToStore}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.orderTrackBtnText, { color: '#FFFFFF' }]}>Browse Catalog</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                sortedOrders.slice(0, 5).map((order) => {
                  const badge = getStatusBadgeStyle(order.status);
                  const isDone = isOrderDeliveredOrDone(order.status);
                  const isPending = isOrderPendingApproval(order.status);
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
                          Placed on{' '}
                          {order.date ||
                            (typeof order.created_at === 'string' ? order.created_at.slice(0, 10) : 'Recent')}
                        </Text>
                      ) : (
                        <View style={{ marginBottom: 4 }} />
                      )}
                      <View style={styles.orderCardFooter}>
                        <View>
                          <Text style={styles.orderTotalLabel}>Total Amount</Text>
                          <Text style={styles.orderTotalPrice}>
                            ₱{getOrderGrandTotal(order).toLocaleString()}
                          </Text>
                        </View>
                        {isDone ? (
                          <View style={[styles.orderTrackBtn, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                            <BootstrapIcon name="check-circle-fill" size={11} color="#059669" />
                            <Text style={[styles.orderTrackBtnText, { color: '#64748B' }]}>Delivered</Text>
                          </View>
                        ) : isPending ? (
                          <TouchableOpacity
                            style={[styles.orderTrackBtn, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
                            onPress={() => handleTrackOrder(order)}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="hourglass-split" size={11} color="#92400E" />
                            <Text style={[styles.orderTrackBtnText, { color: '#92400E' }]}>Awaiting Approval</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.orderTrackBtn}
                            onPress={() => handleTrackOrder(order)}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="geo-alt-fill" size={11} color="#065F46" />
                            <Text style={styles.orderTrackBtnText}>Track Order Live</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
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
                          <Text style={{ fontSize: 12, color: '#1D4533', fontWeight: '700' }}>
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
                          (b.status === 'In Progress' || b.status === 'In-Service') && {
                            backgroundColor: '#E0F2FE',
                          },
                          b.status === 'Service Done' && { backgroundColor: '#DCFCE7' },
                          b.status === 'Paid' && { backgroundColor: '#C8DDD3' },
                          b.status === 'Closed' && { backgroundColor: '#F1F5F9' },
                          (b.status === 'Rejected' || b.status === 'Cancelled') && {
                            backgroundColor: '#FEE2E2',
                          },
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
                            b.status === 'Paid' && { color: '#1D4533' },
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
                        {b.bike_brand || b.brand || 'Motorcycle'} {b.bike_model || b.model || ''} (
                        {b.plate_number || b.bikePlate || 'Registered'})
                      </Text>
                    </View>

                    {b.branch ? (
                      <View style={styles.bookingMetaRow}>
                        <BootstrapIcon name="geo-alt" size={13} color="#64748B" />
                        <Text style={styles.bookingMetaText}>{b.branch}</Text>
                      </View>
                    ) : null}

                    {b.mechanic ? (
                      <View style={styles.bookingMetaRow}>
                        <BootstrapIcon name="person-badge" size={13} color="#1D4533" />
                        <Text style={[styles.bookingMetaText, { color: '#1D4533', fontWeight: '700' }]}>
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
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
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
            <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}>
              {/* Header with Title and "Mark All as Read" */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 }}>
                    Alerts & Notifications
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 }}>
                    {unreadNotifCount > 0
                      ? `${unreadNotifCount} unread message${unreadNotifCount > 1 ? 's' : ''}`
                      : 'All caught up'}
                  </Text>
                </View>
                {unreadNotifCount > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkAllCustomerNotificationsRead}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 14,
                      backgroundColor: '#EFF6FF',
                      borderWidth: 1,
                      borderColor: '#DBEAFE',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#2563EB' }}>Mark all read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {[
                  { id: 'all', label: `All (${(Array.isArray(notifications) ? notifications : []).length})` },
                  { id: 'unread', label: `Unread (${unreadNotifCount})` },
                  { id: 'order', label: 'Orders' },
                  { id: 'booking', label: 'Pitstop' },
                  { id: 'promo', label: 'Offers' },
                ].map((f) => {
                  const isActive = notifFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 20,
                        backgroundColor: isActive ? '#1D4533' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isActive ? '#1D4533' : '#E2E8F0',
                      }}
                      onPress={() => setNotifFilter(f.id)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? '800' : '600',
                          color: isActive ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* List */}
              {filteredTabNotifications.length === 0 ? (
                <View style={[styles.emptyContainer, { marginHorizontal: 0, paddingVertical: 36 }]}>
                  <View style={styles.emptyIconCircle}>
                    <BootstrapIcon name="bell-slash" size={30} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Notifications</Text>
                  <Text style={styles.emptySubtitle}>
                    {notifFilter === 'unread'
                      ? "You're all caught up! No unread messages."
                      : notifFilter !== 'all'
                      ? `No ${notifFilter} notifications available at this time.`
                      : 'Live order updates, pitstop bookings, and promotions will appear here.'}
                  </Text>
                  {onNavigateToStore && (
                    <TouchableOpacity
                      style={{
                        marginTop: 14,
                        backgroundColor: '#1D4533',
                        paddingHorizontal: 18,
                        paddingVertical: 9,
                        borderRadius: 10,
                      }}
                      onPress={onNavigateToStore}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Explore Store</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filteredTabNotifications.map((n) => {
                  const visual = getNotifVisuals(n.type);
                  const isUnread = n.status === 'unread';
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[
                        styles.card,
                        {
                          marginHorizontal: 0,
                          backgroundColor: isUnread ? '#F8FAFC' : '#FFFFFF',
                          borderColor: isUnread ? '#CBD5E1' : '#E2E8F0',
                          borderLeftWidth: isUnread ? 4 : 1,
                          borderLeftColor: isUnread ? '#1D4533' : '#E2E8F0',
                          padding: 14,
                        },
                      ]}
                      onPress={() => handleCustomerNotificationPress(n)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        {/* Type Icon Badge */}
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: visual.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 1,
                          }}
                        >
                          <BootstrapIcon name={visual.icon} size={16} color={visual.color} />
                        </View>

                        {/* Text Content */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: isUnread ? '800' : '700',
                                  color: '#0F172A',
                                  flexShrink: 1,
                                }}
                                numberOfLines={1}
                              >
                                {n.title}
                              </Text>
                              {isUnread && (
                                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2563EB' }} />
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                handleDeleteCustomerNotification(n.id);
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              activeOpacity={0.6}
                            >
                              <BootstrapIcon name="x" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>

                          <Text style={{ fontSize: 12, color: '#475569', lineHeight: 18, marginTop: 4 }}>
                            {n.message}
                          </Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                  backgroundColor: visual.bg,
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: visual.color }}>
                                  {visual.label}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                {formatNotifTime(n.created_at)}
                              </Text>
                            </View>

                            {(n.link || n.type === 'order' || n.type === 'booking') && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4533' }}>
                                  {n.type === 'order' ? 'View Order' : n.type === 'booking' ? 'View Bay' : 'Open'}
                                </Text>
                                <BootstrapIcon name="chevron-right" size={10} color="#1D4533" />
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 6: PROFILE (INSPIRATION UI DESIGN)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'profile' && (
            <View style={{ width: '100%', paddingHorizontal: 16, paddingBottom: 32, gap: 18 }}>
              {/* Heading */}
              <View style={{ marginTop: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
                  My Profile
                </Text>
              </View>

              {/* 1. Avatar Header Card */}
              <View
                style={{
                  backgroundColor: '#1D4533',
                  borderColor: '#163527',
                  borderWidth: 1,
                  borderRadius: 16,
                  paddingVertical: 26,
                  paddingHorizontal: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  shadowColor: '#1D4533',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                  elevation: 4,
                }}
              >
                {/* Subtle Background Decorative Accents */}
                <View
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: -30,
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                  pointerEvents="none"
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: -40,
                    left: -30,
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  }}
                  pointerEvents="none"
                />

                <View style={{ position: 'relative', width: 104, height: 104, marginBottom: 14 }}>
                  <View
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: 52,
                      backgroundColor: '#163527',
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3.5,
                      borderColor: '#FFFFFF',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    {currentUser?.avatar || currentUser?.photoUri ? (
                      <Image
                        source={{ uri: currentUser?.avatar || currentUser?.photoUri }}
                        style={{ width: 104, height: 104, borderRadius: 52 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <BootstrapIcon name="person-fill" size={52} color="#FFFFFF" />
                    )}
                  </View>

                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#1D4533',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 4,
                    }}
                    onPress={handleUploadAvatar}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="camera-fill" size={14} color="#1D4533" />
                  </TouchableOpacity>
                </View>

                {/* Name */}
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '800',
                    color: '#FFFFFF',
                    textAlign: 'center',
                    marginBottom: 3,
                    letterSpacing: -0.2,
                  }}
                >
                  {lastName && firstName
                    ? `${lastName}, ${firstName}`
                    : (name || currentUser?.name || currentUser?.fullName || 'Motorcycle Customer')}
                </Text>

                {/* Subtitle / Bio */}
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '500',
                    color: 'rgba(255, 255, 255, 0.9)',
                    textAlign: 'center',
                    marginBottom: 3,
                  }}
                >
                  {bio || 'Motorcycle Enthusiast & Customer'}
                </Text>

                {/* Location */}
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '500',
                    color: 'rgba(255, 255, 255, 0.72)',
                    textAlign: 'center',
                  }}
                >
                  {city ? `${city}, ${country || 'Philippines'}` : (country || 'Philippines')}
                </Text>

                {currentUser?.avatar && (
                  <TouchableOpacity
                    onPress={handleRemoveAvatar}
                    style={{
                      marginTop: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 20,
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <BootstrapIcon name="trash" size={11} color="#FCA5A5" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FEE2E2' }}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 2. Personal Information Card */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                    Personal Information
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      backgroundColor: isEditingPersonalInfo ? '#F1F5F9' : '#FFFFFF',
                    }}
                    onPress={() => setIsEditingPersonalInfo(!isEditingPersonalInfo)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name={isEditingPersonalInfo ? 'x-lg' : 'pencil'} size={11} color="#334155" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                      {isEditingPersonalInfo ? 'Cancel' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isEditingPersonalInfo ? (
                  <View style={{ gap: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>First Name</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{firstName || name.split(' ')[0] || '—'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>Last Name</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{lastName || '—'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>City</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{city || 'City of Naga'}</Text>
                      </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: '#F1F5F9' }} />

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>Email Address</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{currentUser?.email || '—'}</Text>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>Phone</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{phone || currentUser?.phone || '—'}</Text>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>Country</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{country || 'Philippines'}</Text>
                      </View>
                      <View style={{ width: '48%' }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 3 }}>Bio</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{bio || 'Educator'}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>First Name</Text>
                        <TextInput
                          value={firstName}
                          onChangeText={setFirstName}
                          placeholder="First Name"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Last Name</Text>
                        <TextInput
                          value={lastName}
                          onChangeText={setLastName}
                          placeholder="Last Name"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>City</Text>
                        <TextInput
                          value={city}
                          onChangeText={setCity}
                          placeholder="City"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Phone</Text>
                        <TextInput
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="Phone"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Country</Text>
                        <TextInput
                          value={country}
                          onChangeText={setCountry}
                          placeholder="Country"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Bio</Text>
                        <TextInput
                          value={bio}
                          onChangeText={setBio}
                          placeholder="Bio"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}
                        onPress={() => setIsEditingPersonalInfo(false)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1D4533', flexDirection: 'row', alignItems: 'center', gap: 5 }}
                        onPress={handleSave}
                        disabled={isSaving}
                      >
                        <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Save Changes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* 3. Garage & Delivery Information Card */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                    Garage & Delivery Information
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      backgroundColor: isEditingGarageInfo ? '#F1F5F9' : '#FFFFFF',
                    }}
                    onPress={() => setIsEditingGarageInfo(!isEditingGarageInfo)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name={isEditingGarageInfo ? 'x-lg' : 'pencil'} size={11} color="#334155" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                      {isEditingGarageInfo ? 'Cancel' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isEditingGarageInfo ? (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 8 }}>Primary Motorcycle</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        <View style={{ width: '48%' }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Brand / Make</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{bikeBrand}</Text>
                        </View>
                        <View style={{ width: '48%' }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Model</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{bikeModel}</Text>
                        </View>
                        <View style={{ width: '48%' }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Plate No.</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{bikePlate}</Text>
                        </View>
                        <View style={{ width: '48%' }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Odometer</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{bikeOdo}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: '#F1F5F9' }} />

                    <View>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 8 }}>Default Delivery Destination</Text>
                      <View style={{ gap: 8 }}>
                        <View>
                          <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Street Address</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{address || "D'Blockchain Motorparts, South Poblacion"}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>City</Text>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{city || 'City of Naga'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Instructions</Text>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>{deliveryNotes || 'Leave at gate'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Brand</Text>
                        <TextInput
                          value={bikeBrand}
                          onChangeText={setBikeBrand}
                          placeholder="Brand"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Model</Text>
                        <TextInput
                          value={bikeModel}
                          onChangeText={setBikeModel}
                          placeholder="Model"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Plate</Text>
                        <TextInput
                          value={bikePlate}
                          onChangeText={setBikePlate}
                          placeholder="Plate"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Odometer</Text>
                        <TextInput
                          value={bikeOdo}
                          onChangeText={setBikeOdo}
                          placeholder="Odometer"
                          style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                        />
                      </View>
                    </View>
                    <View>
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Street Address</Text>
                      <TextInput
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Street Address"
                        style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                      />
                    </View>
                    <View>
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Delivery Instructions</Text>
                      <TextInput
                        value={deliveryNotes}
                        onChangeText={setDeliveryNotes}
                        placeholder="e.g. Call upon arrival"
                        style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}
                        onPress={() => setIsEditingGarageInfo(false)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1D4533', flexDirection: 'row', alignItems: 'center', gap: 5 }}
                        onPress={handleSave}
                        disabled={isSaving}
                      >
                        <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Save Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* 4. Account Security & Credentials Card */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                    Account Security & Credentials
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      backgroundColor: isEditingSecurity ? '#F1F5F9' : '#FFFFFF',
                    }}
                    onPress={() => setIsEditingSecurity(!isEditingSecurity)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name={isEditingSecurity ? 'x-lg' : 'pencil'} size={11} color="#334155" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                      {isEditingSecurity ? 'Cancel' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isEditingSecurity ? (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Login Email</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{currentUser?.email || 'customer@mototrack.ph'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginBottom: 2 }}>Status</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A' }}>Protected</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <TextInput
                      value={currentPwd}
                      onChangeText={setCurrentPwd}
                      secureTextEntry
                      placeholder="Current Password"
                      style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                    />
                    <TextInput
                      value={newPwd}
                      onChangeText={setNewPwd}
                      secureTextEntry
                      placeholder="New Password"
                      style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                    />
                    <TextInput
                      value={confirmPwd}
                      onChangeText={setConfirmPwd}
                      secureTextEntry
                      placeholder="Confirm New Password"
                      style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A' }}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}
                        onPress={() => setIsEditingSecurity(false)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1D4533', flexDirection: 'row', alignItems: 'center', gap: 5 }}
                        onPress={async () => {
                          await handleChangePassword();
                          setIsEditingSecurity(false);
                        }}
                        disabled={isSavingPwd}
                      >
                        <BootstrapIcon name="shield-lock" size={13} color="#FFFFFF" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Update Password</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Log Out Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FEE2E2',
                  paddingVertical: 12,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                }}
                onPress={() => setIsLogoutModalOpen(true)}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="box-arrow-right" size={15} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13.5 }}>Log Out of MotoTrack</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 6: SETTINGS (READABLE CUSTOMER INFORMATION WITH MODAL EDIT)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'settings' && (
            <View style={{ gap: 16 }}>
              {/* Customer Information Card */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    paddingBottom: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#E8F0EC',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="person-vcard-fill" size={18} color="#1D4533" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                        Customer Settings
                      </Text>
                      <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                        Profile, contact & delivery destination
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#1D4533',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                    onPress={() => setIsEditSettingsModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="pencil-square" size={13} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Details List */}
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Customer Name
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 3 }}>
                      {[firstName, lastName].filter(Boolean).join(' ') || currentUser?.name || currentUser?.fullName || name || 'Rider Account'}
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                        Account Email
                      </Text>
                      <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#166534' }}>Verified</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A', marginTop: 3 }}>
                      {currentUser?.email || 'N/A'}
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Phone Number
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <BootstrapIcon name="telephone-fill" size={13} color="#0F172A" />
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0F172A' }}>
                        {currentUser?.phone || phone || 'Not provided'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Primary Delivery Address
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                      <BootstrapIcon name="geo-alt-fill" size={13} color="#0F172A" style={{ marginTop: 2 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A', flex: 1 }}>
                        {currentUser?.address || address ? `${currentUser?.address || address}, ${currentUser?.city || city || 'City of Naga'}, ${currentUser?.country || country || 'Philippines'}` : 'No street address saved'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Rider Bio / Headline
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#475569', marginTop: 3 }}>
                      💬 {currentUser?.bio || bio || 'Motorcycle Enthusiast & Customer'}
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Delivery Instructions
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#475569', marginTop: 3 }}>
                      📦 {currentUser?.deliveryNotes || deliveryNotes || 'Leave at front gate / contact on delivery'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Password & Security Card */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="shield-lock-fill" size={17} color="#D97706" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                      Security & Authentication
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                      Update account password
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 10 }}>
                  <TextInput
                    value={currentPwd}
                    onChangeText={setCurrentPwd}
                    secureTextEntry
                    placeholder="Current Password"
                    placeholderTextColor="#94A3B8"
                    style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC' }}
                  />
                  <TextInput
                    value={newPwd}
                    onChangeText={setNewPwd}
                    secureTextEntry
                    placeholder="New Password (min 8 chars)"
                    placeholderTextColor="#94A3B8"
                    style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC' }}
                  />
                  <TextInput
                    value={confirmPwd}
                    onChangeText={setConfirmPwd}
                    secureTextEntry
                    placeholder="Confirm New Password"
                    placeholderTextColor="#94A3B8"
                    style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC' }}
                  />
                  <TouchableOpacity
                    style={{
                      marginTop: 4,
                      backgroundColor: '#1D4533',
                      paddingVertical: 10,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={handleChangePassword}
                    disabled={isSavingPwd}
                    activeOpacity={0.85}
                  >
                    {isSavingPwd ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                          Update Password
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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

      {/* Edit Customer Settings Modal */}
      <EditCustomerSettingsModal
        visible={isEditSettingsModalOpen}
        currentUser={currentUser}
        onClose={() => setIsEditSettingsModalOpen(false)}
        onSave={handleSaveProfileFromModal}
        showToast={showToast}
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

      {/* ─── EDIT PROFILE MODAL ─── */}
      <Modal
        visible={isEditProfileModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditProfileModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderColor: '#F1F5F9',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="pencil-square" size={18} color="#1D4533" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>Edit Profile</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditProfileModalOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {/* Photo Section */}
              <Text style={styles.inputLabel}>Profile Photo</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#E8F0EC',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                  }}
                  onPress={handleUploadAvatar}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="camera-fill" size={13} color="#1D4533" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>Upload Photo</Text>
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
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Name (2 Columns) */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First Name"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last Name"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Contact Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="(+63) 917 000 0000"
                  placeholderTextColor="#94A3B8"
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
                  placeholderTextColor="#94A3B8"
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

              {/* Motorcycle Specs */}
              <Text style={[styles.cardTitle, { marginTop: 8, fontSize: 13.5 }]}>Primary Motorcycle Specs</Text>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Model & Variant</Text>
                <TextInput
                  style={styles.input}
                  value={bikeModel}
                  onChangeText={setBikeModel}
                  placeholder="e.g. NMAX 155"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Plate Number</Text>
                <TextInput
                  style={styles.input}
                  value={bikePlate}
                  onChangeText={setBikePlate}
                  placeholder="e.g. NM-4892"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#1D4533', marginTop: 14 }]}
                onPress={async () => {
                  await handleSave();
                  setIsEditProfileModalOpen(false);
                }}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ─── CHANGE PASSWORD MODAL ─── */}
      <Modal
        visible={isChangePasswordModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsChangePasswordModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', padding: 20 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="shield-lock" size={18} color="#1D4533" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>Change Password</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsChangePasswordModalOpen(false)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="x-lg" size={13} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
              Set a secure password of at least 8 characters.
            </Text>

            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              placeholder="Current Password"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              value={newPwd}
              onChangeText={setNewPwd}
              placeholder="New Password (min 8 characters)"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />
            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              placeholder="Confirm New Password"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#1D4533',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={async () => {
                  await handleChangePassword();
                  if (newPwd && newPwd === confirmPwd && newPwd.length >= 8) {
                    setIsChangePasswordModalOpen(false);
                  }
                }}
                disabled={isSavingPwd}
                activeOpacity={0.85}
              >
                {isSavingPwd ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Update Password</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                }}
                onPress={() => setIsChangePasswordModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 13.5 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ─── HELP & SUPPORT MODAL ─── */}
      <CompanyInfoModal
        visible={isHelpModalOpen}
        initialTab="contact"
        onClose={() => setIsHelpModalOpen(false)}
        showToast={showToast}
      />

      {/* ─── PRIVACY CENTER MODAL ─── */}
      <CompanyInfoModal
        visible={isPrivacyCenterOpen}
        initialTab="privacy"
        onClose={() => setIsPrivacyCenterOpen(false)}
        showToast={showToast}
      />

      {/* ─── LANGUAGE PICKER MODAL ─── */}
      <Modal
        visible={isLanguageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsLanguageModalOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
                  <View style={styles.menuRefIconWrap}>
                    <BootstrapIcon name="globe" size={18} color="#050505" />
                  </View>
                  <Text style={styles.dialogTitle}>Select Language</Text>
                </View>

                <View style={{ gap: 8, marginVertical: 12 }}>
                  {['English (US)', 'Filipino (Tagalog)', 'Bisaya (Cebuano)'].map((lang) => {
                    const isSelected = selectedLanguage === lang;
                    return (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.dialogSelectionRow,
                          isSelected && styles.dialogSelectionRowActive,
                        ]}
                        onPress={() => setSelectedLanguage(lang)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dialogSelectionRowText, isSelected && { color: '#1D4533', fontWeight: '700' }]}>
                          {lang}
                        </Text>
                        {isSelected && (
                          <BootstrapIcon name="check-circle-fill" size={17} color="#1D4533" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.dialogSubmitBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
                  onPress={() => {
                    setIsLanguageModalOpen(false);
                    showToast(`Language set to ${selectedLanguage}`);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dialogSubmitText}>Save Preference</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── PRIVACY CHECKUP MODAL ─── */}
      <Modal
        visible={isPrivacyCheckupOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPrivacyCheckupOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPrivacyCheckupOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
                  <View style={styles.menuRefIconWrap}>
                    <BootstrapIcon name="shield-check" size={18} color="#050505" />
                  </View>
                  <Text style={styles.dialogTitle}>Privacy Checkup</Text>
                </View>

                <Text style={styles.dialogDesc}>
                  Your data and rider privacy settings are protected and managed under MotoTrack standards.
                </Text>

                <View style={{ gap: 8, marginVertical: 10 }}>
                  <View style={styles.dialogDisplayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.dialogDisplayRowTitle}>Profile & Contact Data</Text>
                      <Text style={styles.dialogDisplayRowSub}>Shared only with assigned technician during active service</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>Encrypted</Text>
                    </View>
                  </View>

                  <View style={styles.dialogDisplayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.dialogDisplayRowTitle}>Garage Fleet Details</Text>
                      <Text style={styles.dialogDisplayRowSub}>Specs used solely for motorcycle parts compatibility</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>Private</Text>
                    </View>
                  </View>

                  <View style={styles.dialogDisplayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.dialogDisplayRowTitle}>Order Tracking GPS</Text>
                      <Text style={styles.dialogDisplayRowSub}>Live GPS tracking expires upon delivery completion</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>Secure</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.dialogSubmitBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
                  onPress={() => setIsPrivacyCheckupOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dialogSubmitText}>Looks Good</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── CONTENT PREFERENCES MODAL ─── */}
      <Modal
        visible={isContentPrefOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsContentPrefOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsContentPrefOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
                  <View style={styles.menuRefIconWrap}>
                    <BootstrapIcon name="sliders" size={18} color="#050505" />
                  </View>
                  <Text style={styles.dialogTitle}>Content Preferences</Text>
                </View>

                <View style={{ gap: 8, marginVertical: 10 }}>
                  <View style={styles.dialogDisplayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.dialogDisplayRowTitle}>Motorcycle Compatibility Feed</Text>
                      <Text style={styles.dialogDisplayRowSub}>Prioritize parts compatible with your registered bike</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>On</Text>
                    </View>
                  </View>

                  <View style={styles.dialogDisplayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.dialogDisplayRowTitle}>Restock & Price Drop Alerts</Text>
                      <Text style={styles.dialogDisplayRowSub}>Push notifications for wishlist & restocked items</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>On</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.dialogSubmitBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
                  onPress={() => setIsContentPrefOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dialogSubmitText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── REPORT A PROBLEM MODAL ─── */}
      <Modal
        visible={isReportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsReportModalOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
                  <View style={styles.menuRefIconWrap}>
                    <BootstrapIcon name="chat-square-dots-fill" size={18} color="#050505" />
                  </View>
                  <Text style={styles.dialogTitle}>Report a Problem</Text>
                </View>

                {reportSubmitted ? (
                  <View style={styles.dialogSuccessWrap}>
                    <BootstrapIcon name="check-circle-fill" size={40} color="#10B981" />
                    <Text style={styles.dialogSuccessTitle}>Thank you for your feedback!</Text>
                    <Text style={styles.dialogSuccessSub}>
                      Our technical team has been notified.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.dialogDesc}>
                      Help us improve MotoTrack by describing the issue you encountered.
                    </Text>

                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Briefly explain what happened or what's not working..."
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={4}
                      value={reportText}
                      onChangeText={setReportText}
                    />

                    <View style={styles.dialogActions}>
                      <TouchableOpacity
                        style={styles.dialogCancelBtn}
                        onPress={() => setIsReportModalOpen(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dialogCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.dialogSubmitBtn,
                          !reportText.trim() && { opacity: 0.5 },
                        ]}
                        onPress={handleSubmitReport}
                        disabled={!reportText.trim()}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.dialogSubmitText}>Submit Report</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── DISPLAY & ACCESSIBILITY MODAL ─── */}
      <Modal
        visible={isDisplayModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDisplayModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsDisplayModalOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
                  <View style={styles.menuRefIconWrap}>
                    <BootstrapIcon name="moon-fill" size={18} color="#050505" />
                  </View>
                  <Text style={styles.dialogTitle}>Display & Accessibility</Text>
                </View>

                <View style={{ gap: 12, marginVertical: 12 }}>
                  <View style={styles.dialogDisplayRow}>
                    <View>
                      <Text style={styles.dialogDisplayRowTitle}>Light Theme</Text>
                      <Text style={styles.dialogDisplayRowSub}>Clean white high-contrast interface</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>Active</Text>
                    </View>
                  </View>

                  <View style={styles.dialogDisplayRow}>
                    <View>
                      <Text style={styles.dialogDisplayRowTitle}>High Legibility</Text>
                      <Text style={styles.dialogDisplayRowSub}>Enhanced contrast circular icon badges</Text>
                    </View>
                    <View style={styles.dialogActiveTag}>
                      <Text style={styles.dialogActiveTagText}>On</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.dialogCancelBtn, { marginTop: 8, alignSelf: 'flex-end', minWidth: 90, alignItems: 'center' }]}
                  onPress={() => setIsDisplayModalOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dialogCancelText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── PERSISTENT MOBILE BOTTOM NAVIGATION (BOTTOM NAVBAR STAYS) ─── */}
      <BottomNavBar
        activeTab={activeTab === 'orders' ? 'Orders' : 'More'}
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
