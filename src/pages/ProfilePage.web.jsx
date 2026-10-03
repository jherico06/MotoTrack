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
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getProfileWebTokens, createProfileWebStyles } from '../styles/web/profilePage.web.styles';
import { appStorage } from '../services/storageAdapter';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { garageService } from '../services/garageService';
import { orderService } from '../services/orderService';
import { notificationService, stripEmojis } from '../services/notificationService';
import {
  BootstrapIcon,
  BrandLogo,
  NotificationDropdown,
  UserProfileButton,
  UserProfileDropdown,
} from '../components/common';
import {
  LiveOrderTrackingMapModal,
  ConfirmModal,
  RegisterMotorcycleModal,
  EditCustomerSettingsModal,
  CartModal,
} from '../components/modals';
import { motorcycleService } from '../services/motorcycleService';
import { pickImageFromFile } from '../utils/imagePickerHelper';

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu' },
  { label: 'South Poblacion (Store)', address: "D'Blockchain Motorparts and Accessories, Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu" },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu' },
  { label: 'BGC Central, Taguig', address: '7th Ave & 28th St, Bonifacio Global City, Taguig' },
];

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

const MOTORCYCLE_BRANDS = ['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW', 'KTM', 'Triumph'];

const MAIN_NAV_ITEMS = [
  { id: 'shop', label: 'Shop' },
  { id: 'overview', label: 'Overview' },
  { id: 'garage', label: 'My Garage' },
  { id: 'orders', label: 'My Orders' },
  { id: 'bookings', label: 'Booked Services' },
];

function formatNotifTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (_e) {
    return 'Recent';
  }
}

function getNotifTheme(type = '', category = '') {
  const t = (type || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (t === 'order' || c === 'order' || c.includes('delivery')) {
    return {
      icon: 'bag-check-fill',
      color: '#2563EB',
      bg: '#EFF6FF',
      badgeBg: '#DBEAFE',
      label: 'Order',
    };
  }
  if (t === 'booking' || c === 'booking' || c.includes('service') || c.includes('repair')) {
    return {
      icon: 'tools',
      color: '#D97706',
      bg: '#FEF3C7',
      badgeBg: '#FDE68A',
      label: 'Pit Bay',
    };
  }
  if (t === 'promo' || c === 'promo' || c === 'welcome') {
    return {
      icon: 'ticket-perforated-fill',
      color: '#EA580C',
      bg: '#FFF7ED',
      badgeBg: '#FFEDD5',
      label: 'Promotion',
    };
  }
  if (t === 'security' || t === 'system' || c === 'security') {
    return {
      icon: 'shield-lock-fill',
      color: '#DC2626',
      bg: '#FEE2E2',
      badgeBg: '#FECACA',
      label: 'Security',
    };
  }
  return {
    icon: 'bell-fill',
    color: '#1D4533',
    bg: '#E8F0EC',
    badgeBg: '#C8DDD3',
    label: 'Notification',
  };
}

function getNotifActionLabel(notif) {
  const t = (notif?.type || '').toLowerCase();
  const c = (notif?.category || '').toLowerCase();
  if (t === 'booking' || c === 'booking') return 'View Booking →';
  if (t === 'order' || c === 'order') return 'Track Order →';
  if (t === 'promo' || c === 'promo' || c === 'welcome') return 'View Deals →';
  if (t === 'security') return 'Security Settings →';
  return 'View Details →';
}

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
  const { cartItemCount = 0, showToast: cartShowToast, addToCart } = useCart();
  const { wishlistCount = 0 } = useWishlist();

  // ─── TOP NAVBAR & MODALS STATE ───
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  const tokens = useMemo(() => getProfileWebTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createProfileWebStyles(isDarkMode), [isDarkMode]);

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
  const [bikeOdo, setBikeOdo] = useState(currentUser?.bikeOdo || '12,400 km');
  const [isSaving, setIsSaving] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isEditEmailOpen, setIsEditEmailOpen] = useState(false);

  // Security Form State
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Motorcycle Fleet State ("My Garage")
  const [motorcycles, setMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [isMotorcycleModalOpen, setIsMotorcycleModalOpen] = useState(false);
  const [editingMotorcycle, setEditingMotorcycle] = useState(null);
  const [isDeleteBikeModalOpen, setIsDeleteBikeModalOpen] = useState(false);
  const [bikeToDelete, setBikeToDelete] = useState(null);
  const [isEditSettingsModalOpen, setIsEditSettingsModalOpen] = useState(false);

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
  const [notifFilter, setNotifFilter] = useState('All'); // 'All' | 'order' | 'booking' | 'promo' | 'security' | 'unread'
  const [notifSearchQuery, setNotifSearchQuery] = useState('');
  const [expandedNotifIds, setExpandedNotifIds] = useState(new Set());
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Real-time notification subscription
  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    });
    return () => unsub?.();
  }, [currentUser?.id]);

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
      const uName = currentUser.name || currentUser.fullName || '';
      const parts = uName.trim().split(' ');
      setName(uName);
      setFirstName(currentUser.firstName || parts[0] || '');
      setLastName(currentUser.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : ''));
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

  const unreadNotifCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (n) => n.status === 'unread'
    ).length;
  }, [notifications]);

  const sortedOrders = useMemo(() => {
    return sortOrdersByPriority(orders);
  }, [orders]);

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
    return sortOrdersByPriority(list);
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

  const orderNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (n) => (n.type || '').toLowerCase() === 'order' || (n.category || '').toLowerCase() === 'order'
    ).length;
  }, [notifications]);

  const bookingNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (n) => (n.type || '').toLowerCase() === 'booking' || (n.category || '').toLowerCase() === 'booking'
    ).length;
  }, [notifications]);

  const promoNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (n) => (n.type || '').toLowerCase() === 'promo' || (n.category || '').toLowerCase() === 'promo' || (n.category || '').toLowerCase() === 'welcome'
    ).length;
  }, [notifications]);

  const securityNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (n) => (n.type || '').toLowerCase() === 'security' || (n.type || '').toLowerCase() === 'system' || (n.category || '').toLowerCase() === 'security'
    ).length;
  }, [notifications]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    let list = Array.isArray(notifications) ? notifications : [];
    if (notifFilter === 'order') {
      list = list.filter((n) => (n.type || '').toLowerCase() === 'order' || (n.category || '').toLowerCase() === 'order');
    } else if (notifFilter === 'booking') {
      list = list.filter((n) => (n.type || '').toLowerCase() === 'booking' || (n.category || '').toLowerCase() === 'booking');
    } else if (notifFilter === 'promo') {
      list = list.filter((n) => (n.type || '').toLowerCase() === 'promo' || (n.category || '').toLowerCase() === 'promo' || (n.category || '').toLowerCase() === 'welcome');
    } else if (notifFilter === 'security') {
      list = list.filter((n) => (n.type || '').toLowerCase() === 'security' || (n.type || '').toLowerCase() === 'system' || (n.category || '').toLowerCase() === 'security');
    } else if (notifFilter === 'unread') {
      list = list.filter((n) => n.status === 'unread');
    }

    if (notifSearchQuery.trim()) {
      const q = notifSearchQuery.toLowerCase();
      list = list.filter((n) => {
        const t = (n.title || '').toLowerCase();
        const m = (n.message || '').toLowerCase();
        const c = (n.category || '').toLowerCase();
        const oId = String(n.meta?.orderId || '').toLowerCase();
        const bId = String(n.meta?.bookingId || '').toLowerCase();
        return t.includes(q) || m.includes(q) || c.includes(q) || oId.includes(q) || bId.includes(q);
      });
    }

    return list;
  }, [notifications, notifFilter, notifSearchQuery]);

  // Group notifications chronologically (New, Today, Yesterday, Earlier)
  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayMidnight = todayMidnight - 24 * 60 * 60 * 1000;

    const buckets = {
      new: [],
      today: [],
      yesterday: [],
      earlier: [],
    };

    filteredNotifications.forEach((n) => {
      const isUnread = n.status === 'unread';
      const timeVal = n.created_at || n.timestamp || n.date;
      const itemDate = timeVal ? new Date(timeVal).getTime() : now.getTime();

      if (isUnread && itemDate >= yesterdayMidnight) {
        buckets.new.push(n);
      } else if (itemDate >= todayMidnight) {
        buckets.today.push(n);
      } else if (itemDate >= yesterdayMidnight) {
        buckets.yesterday.push(n);
      } else {
        buckets.earlier.push(n);
      }
    });

    const sections = [];
    if (buckets.new.length > 0) {
      sections.push({
        key: 'new',
        title: 'New',
        badge: `${buckets.new.length} unread`,
        items: buckets.new,
      });
    }
    if (buckets.today.length > 0) {
      sections.push({
        key: 'today',
        title: 'Today',
        badge: null,
        items: buckets.today,
      });
    }
    if (buckets.yesterday.length > 0) {
      sections.push({
        key: 'yesterday',
        title: 'Yesterday',
        badge: null,
        items: buckets.yesterday,
      });
    }
    if (buckets.earlier.length > 0) {
      sections.push({
        key: 'earlier',
        title: 'Earlier',
        badge: null,
        items: buckets.earlier,
      });
    }

    if (sections.length === 0 && filteredNotifications.length > 0) {
      sections.push({
        key: 'all',
        title: 'All Notifications',
        badge: null,
        items: filteredNotifications,
      });
    }

    return sections;
  }, [filteredNotifications]);

  const handleMarkAllNotifsRead = async () => {
    await notificationService.markAllCustomerAsRead(currentUser?.id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    showToast('✓ All notifications marked as read');
  };

  const handleClearReadNotifs = async () => {
    const unreadOnly = (Array.isArray(notifications) ? notifications : []).filter(
      (n) => n.status === 'unread'
    );
    notificationService.customerNotifications = unreadOnly;
    await notificationService.persist();
    notificationService.notify();
    setNotifications(unreadOnly);
    showToast('✓ Cleared read notifications');
  };

  const handleMarkSingleNotifRead = async (id) => {
    await notificationService.markCustomerAsRead(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
  };

  const handleMarkSingleNotifUnread = async (id) => {
    await notificationService.markCustomerAsUnread(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
  };

  const handleDeleteNotif = async (id) => {
    await notificationService.deleteCustomerNotification(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    showToast('Notification removed');
  };

  const handleNotifAction = (notif) => {
    handleMarkSingleNotifRead(notif.id);
    const link = (notif.link || '').toLowerCase();
    const type = (notif.type || '').toLowerCase();
    if (type === 'booking' || link === 'bookings' || link === 'garage') {
      setActiveTab('bookings');
    } else if (type === 'order' || link === 'orders') {
      setActiveTab('orders');
      if (notif.meta?.orderId) {
        const found = orders.find((o) => String(o.id) === String(notif.meta.orderId));
        if (found) {
          if (isOrderDeliveredOrDone(found.status)) {
            showToast('✓ Order has already been delivered and confirmed.');
          } else {
            setSelectedOrderForTracking(found);
            setIsLiveTrackingOpen(true);
          }
        }
      }
    } else if (type === 'promo' || link === 'shop' || link === 'store') {
      onNavigateToStore?.();
    } else if (type === 'security' || link === 'settings') {
      setActiveTab('settings');
    } else {
      setActiveTab('overview');
    }
  };

  // Handlers
  const handleSaveProfile = async () => {
    const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim() || name.trim();
    if (!combinedName) {
      showToast('Please enter your name');
      return;
    }
    setIsSaving(true);
    try {
      const res = await updateProfile({
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
      if (res?.success) {
        showToast('✓ Account profile successfully updated!');
        setIsEditingPersonalInfo(false);
        setIsEditingGarageInfo(false);
      } else {
        showToast(res?.error || 'Failed to update profile.');
      }
    } catch (_e) {
      showToast('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfileFromModal = async (payload) => {
    const res = await updateProfile(payload);
    if (res?.success) {
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
    }
    return res;
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
            backgroundColor: '#1D4533',
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

      {/* ─── 1. SINGLE TOP GREEN NAVBAR (ONLY NAVBAR) ─── */}
      <View style={styles.headerWrapper}>
        <View style={[styles.headerInner, windowWidth < 768 && { paddingHorizontal: 16, paddingVertical: 10, gap: 10 }]}>
          {/* LEFT: MotoTrack Logo + Mobile Menu Toggle */}
          <View style={styles.headerLeft}>
            {windowWidth < 1024 && (
              <TouchableOpacity
                style={styles.mobileNavToggleBtn}
                onPress={() => setIsMobileNavOpen((prev) => !prev)}
                activeOpacity={0.7}
                title="Navigation Menu"
                accessibilityLabel="Navigation Menu"
              >
                <BootstrapIcon name={isMobileNavOpen ? 'x-lg' : 'list'} size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.logoWrap}
              onPress={onNavigateToStore}
              activeOpacity={0.8}
            >
              <BrandLogo size={windowWidth < 768 ? 32 : 42} textColor="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* MAIN NAVIGATION (CENTERED): Overview | My Garage | My Orders | Booked Services */}
          {windowWidth >= 1024 && (
            <View style={styles.headerCenterNav}>
              <View style={styles.mainNavList}>
                {MAIN_NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.mainNavItem, isActive && styles.mainNavItemActive]}
                      onPress={() => {
                        if (item.id === 'shop') {
                          onNavigateToStore?.();
                        } else {
                          setActiveTab(item.id);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.mainNavItemText, isActive && styles.mainNavItemTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* RIGHT: [Heart] | [Bell] | [Cart] | [⚙] | [Profile] */}
          <View style={[styles.headerActions, windowWidth < 768 && { gap: 6 }]}>
            {/* Wishlist / Heart Icon [Heart] */}
            <TouchableOpacity
              style={styles.navActionIconBtn}
              onPress={onNavigateToWishlist}
              activeOpacity={0.8}
              title="Favorites"
            >
              <BootstrapIcon name="heart" size={16} color="#FFFFFF" />
              {wishlistCount > 0 && (
                <View style={styles.navBadgeCircle}>
                  <Text style={styles.navBadgeText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Existing Notification / Bell Icon [Bell] */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.navActionIconBtn}
                onPress={() => {
                  setIsProfileDropdownOpen(false);
                  setIsNotifDropdownOpen((prev) => !prev);
                }}
                activeOpacity={0.8}
                title="Notifications"
                dataSet={{ notificationButton: true }}
                {...(Platform.OS === 'web' ? { 'data-notification-button': 'true' } : {})}
              >
                <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                {unreadNotifCount > 0 && (
                  <View style={styles.navBadgeCircle}>
                    <Text style={styles.navBadgeText}>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <NotificationDropdown
                isOpen={isNotifDropdownOpen}
                onClose={() => setIsNotifDropdownOpen(false)}
                onNavigateToScreen={(screen, params) => {
                  if (screen === 'store' || screen === 'shop') onNavigateToStore?.();
                  else if (screen === 'garage') onNavigateToGarage?.();
                  else if (screen === 'customizer') onNavigateToCustomizer?.();
                  else if (screen === 'orders') setActiveTab('orders');
                  else if (screen === 'profile') setActiveTab(params?.tab || 'overview');
                  else if (screen === 'notifications') setActiveTab('notifications');
                  else if (screen === 'admin') onNavigateToAdmin?.();
                }}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Icon [Cart] */}
            <TouchableOpacity
              style={styles.navActionIconBtn}
              onPress={() => setIsCartOpen(true)}
              activeOpacity={0.85}
              title="Shopping Cart"
            >
              <BootstrapIcon name="cart3" size={17} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <View style={styles.navBadgeCircle}>
                  <Text style={styles.navBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* User Profile Avatar [Profile] or Sign In */}
            {currentUser ? (
              <View style={{ position: 'relative' }}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsProfileDropdownOpen(!isProfileDropdownOpen);
                  }}
                  size={40}
                />

                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isProfileDropdownOpen}
                  onClose={() => setIsProfileDropdownOpen(false)}
                  onNavigateToDashboard={(tab = 'overview') => setActiveTab(tab)}
                  onNavigateToOrders={() => setActiveTab('orders')}
                  onNavigateToProfile={() => setActiveTab('profile')}
                  onNavigateToSettings={() => setActiveTab('settings')}
                  onNavigateToNotifications={() => setActiveTab('notifications')}
                  onNavigateToAdmin={() => {
                    if (currentUser?.role === 'admin') {
                      onNavigateToAdmin?.();
                    } else {
                      showToast('Admin access required');
                    }
                  }}
                  onLogout={handleUserLogout}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={onNavigateToLogin}
              >
                <Text style={styles.btnPrimaryText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Mobile Navigation Drawer for Screens < 1024px */}
        {windowWidth < 1024 && isMobileNavOpen && (
          <View style={styles.mobileNavDrawer}>
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.mobileNavItem, isActive && styles.mobileNavItemActive]}
                  onPress={() => {
                    if (item.id === 'shop') {
                      onNavigateToStore?.();
                    } else {
                      setActiveTab(item.id);
                    }
                    setIsMobileNavOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.mobileNavItemText, isActive && styles.mobileNavItemTextActive]}>
                    {item.label}
                  </Text>
                  {isActive && (
                    <BootstrapIcon name="check2" size={16} color="#34D399" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.adminLayout}>
        <View style={styles.mainContentArea}>
          {/* Main Scrollable Canvas */}
          <ScrollView
            contentContainerStyle={[
              styles.mainScroll,
              { maxWidth: 1360, width: '100%', alignSelf: 'center' },
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
                {/* 4 KPI Stats Grid */}
                <View style={styles.statsGrid}>
                  {/* Card 1: Total Orders */}
                  <TouchableOpacity
                    style={[styles.statCard, styles.statCardTealAccent]}
                    onPress={() => setActiveTab('orders')}
                    activeOpacity={0.88}
                  >
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
                    activeOpacity={0.88}
                  >
                    <Text style={styles.statLabel}>Garage Bookings</Text>
                    <Text style={styles.statValue}>{activeBookings.length}</Text>
                    <Text style={styles.statSub}>
                      {bookings.length > 0 ? `${bookings.length} scheduled PMS/repairs` : 'No scheduled pit services'}
                    </Text>
                  </TouchableOpacity>

                  {/* Card 3: Wishlist Saved */}
                  <TouchableOpacity
                    style={[styles.statCard, styles.statCardDangerAccent]}
                    onPress={onNavigateToWishlist}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.statLabel}>Saved Wishlist</Text>
                    <Text style={styles.statValue}>{wishlistCount || 0}</Text>
                    <Text style={styles.statSub}>Components ready for bag</Text>
                  </TouchableOpacity>

                  {/* Card 4: Total Spent */}
                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <Text style={styles.statLabel}>Total Spend</Text>
                    <Text style={styles.statValue}>₱{Number(totalSpent).toLocaleString()}</Text>
                    <Text style={styles.statSub}>Verified purchases & tuning</Text>
                  </View>
                </View>

                {/* Customer Profile Summary */}
                <View style={[styles.sectionCard, { marginBottom: 20 }]}>
                  <View
                    style={{
                      flexDirection: isSmallMobile ? 'column' : 'row',
                      alignItems: isSmallMobile ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    {/* Left: Avatar + Identity */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 26,
                          backgroundColor: '#1D4533',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          borderWidth: 2,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        {currentUser?.avatar || currentUser?.photoUri ? (
                          <Image
                            source={{ uri: currentUser?.avatar || currentUser?.photoUri }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        ) : (
                          <BootstrapIcon name="person-fill" size={26} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 16.5, fontWeight: '800', color: tokens.textPrimary, letterSpacing: -0.2 }}>
                            {userDisplayName}
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: tokens.statusSuccessBg,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: tokens.statusSuccessBorder,
                            }}
                          >
                            <BootstrapIcon name="patch-check-fill" size={11} color={tokens.statusSuccessText} />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: tokens.statusSuccessText }}>
                              Verified Customer
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <BootstrapIcon name="envelope-fill" size={11} color={tokens.textMuted} />
                            <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                              {currentUser?.email || 'Customer Account'}
                            </Text>
                          </View>
                          <Text style={{ color: tokens.border, fontSize: 12 }}>•</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <BootstrapIcon name="telephone-fill" size={11} color={tokens.textMuted} />
                            <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                              {currentUser?.phone || phone || 'No phone set'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.btnPrimary}
                        onPress={() => setIsEditSettingsModalOpen(true)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="pencil-square" size={13} color="#FFFFFF" />
                        <Text style={styles.btnPrimaryText}>Edit Information</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnSecondary}
                        onPress={() => setActiveTab('settings')}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="gear" size={13} color={tokens.textSecondary} />
                        <Text style={styles.btnSecondaryText}>Settings →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Delivery Details 2-box row */}
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      gap: 12,
                      paddingTop: 16,
                      borderTopWidth: 1,
                      borderTopColor: tokens.border,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: tokens.bgSub,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: tokens.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <BootstrapIcon name="geo-alt-fill" size={12} color={tokens.brandPrimary} />
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Delivery Address
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.textPrimary, lineHeight: 18 }}>
                        {currentUser?.address ? `${currentUser.address}, ${currentUser.city || 'City of Naga'}, Philippines` : 'No delivery address saved — click Edit Information to configure'}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        backgroundColor: tokens.bgSub,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: tokens.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <BootstrapIcon name="truck" size={12} color={tokens.brandPrimary} />
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Delivery Instructions
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: tokens.textSecondary, lineHeight: 18 }}>
                        {currentUser?.deliveryNotes || 'Leave at front gate / contact on delivery'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Split Two-Column Activity Cards */}
                <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 20, marginBottom: 20 }}>
                  {/* Left Column: Recent Orders Card */}
                  <View style={[styles.sectionCard, { flex: 1, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: tokens.brandLight,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: tokens.brandBorder,
                          }}
                        >
                          <BootstrapIcon name="box-seam-fill" size={14} color="#1D4533" />
                        </View>
                        <Text style={{ fontSize: 15.5, fontWeight: '800', color: tokens.textPrimary }}>
                          Recent Orders
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setActiveTab('orders')} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1D4533' }}>View All ({orders.length}) →</Text>
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
                          style={[styles.btnPrimary, { marginTop: 14 }]}
                          onPress={onNavigateToStore}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.btnPrimaryText}>Browse Catalog</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {sortedOrders.slice(0, 5).map((ord) => {
                          const statusLower = String(ord.status || '').toLowerCase();
                          let statusBg = tokens.statusWarningBg;
                          let statusText = tokens.statusWarningText;
                          let statusBorder = tokens.statusWarningBorder;
                          let statusLabel = ord.status || 'Processing';

                          if (statusLower.includes('out') || statusLower.includes('transit') || statusLower.includes('shipped') || statusLower.includes('ready')) {
                            statusBg = tokens.statusInfoBg;
                            statusText = tokens.statusInfoText;
                            statusBorder = tokens.statusInfoBorder;
                            statusLabel = ord.status || 'Out for Delivery';
                          } else if (statusLower === 'delivered' || statusLower.includes('complete')) {
                            statusBg = tokens.statusSuccessBg;
                            statusText = tokens.statusSuccessText;
                            statusBorder = tokens.statusSuccessBorder;
                            statusLabel = 'Delivered';
                          } else if (statusLower.includes('cancel')) {
                            statusBg = tokens.statusDangerBg;
                            statusText = tokens.statusDangerText;
                            statusBorder = tokens.statusDangerBorder;
                            statusLabel = 'Cancelled';
                          }

                          const isDone = isOrderDeliveredOrDone(ord.status);
                          const isPending = isOrderPendingApproval(ord.status);

                          return (
                            <View
                              key={ord.id}
                              style={{
                                backgroundColor: tokens.bgSub,
                                borderWidth: 1,
                                borderColor: tokens.border,
                                borderRadius: 12,
                                padding: 13,
                                flexDirection: isSmallMobile ? 'column' : 'row',
                                justifyContent: 'space-between',
                                alignItems: isSmallMobile ? 'flex-start' : 'center',
                                gap: 12,
                              }}
                            >
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.textPrimary }} numberOfLines={1}>
                                  {ord.itemsSummary || (Array.isArray(ord.items) && ord.items.length > 0 ? ord.items.map((i) => typeof i === 'string' ? i : (i?.name || i?.product_name || 'Part')).join(', ') : 'Motorcycle Performance Equipment')}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                  <Text style={{ fontSize: 11.5, color: tokens.textMuted }}>
                                    {ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent Order'}
                                  </Text>
                                  <Text style={{ color: tokens.border }}>•</Text>
                                  <Text style={{ fontSize: 11.5, color: tokens.textMuted }}>
                                    {ord.items?.length || 1} {ord.items?.length === 1 ? 'item' : 'items'}
                                  </Text>
                                  <Text style={{ color: tokens.border }}>•</Text>
                                  <Text style={{ fontSize: 11.5, color: tokens.textMuted }}>
                                    {ord.paymentMethod || 'COD'}
                                  </Text>
                                  <Text style={{ color: tokens.border }}>•</Text>
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                                    ₱{getOrderGrandTotal(ord).toLocaleString()}
                                  </Text>
                                </View>
                              </View>

                              <View style={{ flexDirection: isSmallMobile ? 'row' : 'column', alignItems: isSmallMobile ? 'center' : 'flex-end', gap: 8, width: isSmallMobile ? '100%' : 'auto', justifyContent: 'space-between' }}>
                                <View
                                  style={{
                                    backgroundColor: statusBg,
                                    borderWidth: 1,
                                    borderColor: statusBorder,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2.5,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: statusText }}>
                                    {statusLabel}
                                  </Text>
                                </View>

                                {isDone ? (
                                  <View
                                    style={[
                                      styles.btnSecondary,
                                      {
                                        paddingVertical: 6,
                                        paddingHorizontal: 10,
                                        backgroundColor: tokens.bgSub,
                                        borderColor: tokens.border,
                                        opacity: 0.75,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                      },
                                    ]}
                                  >
                                    <BootstrapIcon name="check-circle-fill" size={11} color="#059669" />
                                    <Text style={[styles.btnSecondaryText, { fontSize: 11.5, color: tokens.textMuted }]}>
                                      Delivered
                                    </Text>
                                  </View>
                                ) : isPending ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.btnSecondary,
                                      {
                                        paddingVertical: 6,
                                        paddingHorizontal: 10,
                                        backgroundColor: tokens.statusWarningBg || '#FEF3C7',
                                        borderColor: tokens.statusWarningBorder || '#FDE68A',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 5,
                                      },
                                    ]}
                                    onPress={() => showToast('⏳ Order is pending admin approval. Live tracking will unlock once approved.')}
                                    activeOpacity={0.8}
                                  >
                                    <BootstrapIcon name="hourglass-split" size={11} color={tokens.statusWarningText || '#92400E'} />
                                    <Text style={[styles.btnSecondaryText, { fontSize: 11.5, color: tokens.statusWarningText || '#92400E' }]}>
                                      Awaiting Approval
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    style={[styles.btnSecondary, { paddingVertical: 6, paddingHorizontal: 10 }]}
                                    onPress={() => {
                                      setSelectedOrderForTracking(ord);
                                      setIsLiveTrackingOpen(true);
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <BootstrapIcon name="geo-alt-fill" size={11} color={tokens.brandPrimary} />
                                    <Text style={[styles.btnSecondaryText, { fontSize: 11.5 }]}>Track Order</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Right Column: Next Garage Appointment Card */}
                  <View style={[styles.sectionCard, { flex: 1, marginBottom: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: tokens.brandLight,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: tokens.brandBorder,
                          }}
                        >
                          <BootstrapIcon name="tools" size={14} color="#1D4533" />
                        </View>
                        <Text style={{ fontSize: 15.5, fontWeight: '800', color: tokens.textPrimary }}>
                          Garage Pit Bay Slots
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setActiveTab('bookings')} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1D4533' }}>Manage ({bookings.length}) →</Text>
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
                          style={[styles.btnPrimary, { marginTop: 14 }]}
                          onPress={onNavigateToGarage}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.btnPrimaryText}>Book a Service Slot</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {activeBookings.slice(0, 2).map((bk) => (
                          <View
                            key={bk.id}
                            style={{
                              backgroundColor: tokens.bgSub,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              borderRadius: 12,
                              padding: 14,
                              gap: 8,
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                  Service Type
                                </Text>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: tokens.textPrimary, marginTop: 2 }}>
                                  {bk.service_title || bk.serviceName || 'PMS Service'}
                                </Text>
                              </View>
                              <View
                                style={{
                                  backgroundColor: tokens.brandLight,
                                  borderWidth: 1,
                                  borderColor: tokens.brandBorder,
                                  paddingHorizontal: 8,
                                  paddingVertical: 2.5,
                                  borderRadius: 6,
                                }}
                              >
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: tokens.brandPrimary }}>
                                  {bk.category || 'PMS'} / Scheduled
                                </Text>
                              </View>
                            </View>

                            <View style={{ gap: 4, paddingVertical: 2 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <BootstrapIcon name="calendar3" size={12} color={tokens.brandPrimary} />
                                <Text style={{ fontSize: 12, color: tokens.textSecondary, fontWeight: '500' }}>
                                  {bk.appointment_date || 'Date scheduled'}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <BootstrapIcon name="clock" size={12} color={tokens.brandPrimary} />
                                <Text style={{ fontSize: 12, color: tokens.textSecondary, fontWeight: '500' }}>
                                  {bk.time_slot || '10:30 AM – 12:00 PM'}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <BootstrapIcon name="geo-alt-fill" size={12} color={tokens.brandPrimary} />
                                <Text style={{ fontSize: 12, color: tokens.textSecondary, fontWeight: '500' }} numberOfLines={1}>
                                  {bk.branch || 'MotoTrack Flagship Central Hub'}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: tokens.border }}>
                              <TouchableOpacity
                                style={[styles.btnSecondary, { flex: 1, paddingVertical: 6 }]}
                                onPress={() => setActiveTab('bookings')}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.btnSecondaryText, { fontSize: 12 }]}>View Details</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.btnDangerSubtle, { paddingVertical: 6 }]}
                                onPress={() => {
                                  setBookingToCancel(bk);
                                  setIsCancelModalOpen(true);
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.btnDangerSubtleText, { fontSize: 12 }]}>Cancel</Text>
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
                          backgroundColor: '#C8DDD3',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="wrench-adjustable" size={18} color="#1D4533" />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: tokens.textPrimary }}>
                            My Garage Fleet
                          </Text>
                          <View
                            style={{
                              backgroundColor: '#1D4533',
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
                            borderColor: bike.is_primary ? '#1D4533' : tokens.border,
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
                                    backgroundColor: '#1D4533',
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
                                borderColor: '#1D4533',
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
                              <Text style={{ fontSize: 11.5, color: '#1D4533', fontWeight: '700', marginTop: 1 }}>
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
                                  backgroundColor: '#1D4533',
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
                    <Text style={styles.statLabel}>Garage Fleet</Text>
                    <Text style={styles.statValue}>{motorcycles.length}</Text>
                    <Text style={styles.statSub}>Registered vehicles</Text>
                  </View>

                  {/* Stat 2: Primary Ride */}
                  <View style={[styles.statCard, styles.statCardWarningAccent]}>
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
                    <Text style={styles.statLabel}>Pit Bay Bookings</Text>
                    <Text style={styles.statValue}>{activeBookings.length}</Text>
                    <Text style={styles.statSub}>Scheduled PMS & repairs</Text>
                  </TouchableOpacity>

                  {/* Stat 4: Service Readiness */}
                  <View style={[styles.statCard, styles.statCardDangerAccent]}>
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
                        backgroundColor: '#C8DDD3',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <BootstrapIcon name="tools" size={32} color="#1D4533" />
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
                  <View>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                        My Fleet ({motorcycles.length})
                      </Text>
                      <TouchableOpacity
                        style={styles.addBtnPrimary}
                        onPress={handleOpenAddMotorcycle}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-circle-fill" size={13} color="#FFFFFF" />
                        <Text style={styles.addBtnPrimaryText}>
                          {isSmallMobile ? 'Register' : 'Register Motorcycle'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View
                      style={{
                        width: '100%',
                        ...(Platform.OS === 'web'
                          ? {
                              display: 'grid',
                              gridTemplateColumns: windowWidth >= 768 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                              gap: 14,
                            }
                          : {
                              flexDirection: isDesktop ? 'row' : 'column',
                              gap: 14,
                            }),
                      }}
                    >
                    {motorcycles.map((bike) => {
                      return (
                        <View
                          key={bike.motorcycle_id}
                          style={{
                            width: '100%',
                            backgroundColor: tokens.bgCard,
                            borderRadius: 18,
                            borderWidth: 1.5,
                            borderColor: bike.is_primary ? '#1D4533' : tokens.border,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: isDarkMode ? 0.35 : 0.06,
                            shadowRadius: 12,
                            elevation: 4,
                            display: 'flex',
                            flexDirection: 'column',
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
                                    backgroundColor: '#1D4533',
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
                                borderColor: '#1D4533',
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
                                  color: '#1D4533',
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
                          <View style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              {/* Brand & Model Title */}
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '800',
                                color: '#1D4533',
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
                                <BootstrapIcon name="speedometer2" size={12} color="#1D4533" />
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
                                <BootstrapIcon name="calendar-event" size={12} color="#1D4533" />
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
                                <BootstrapIcon name="geo-alt" size={12} color="#1D4533" />
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
                                  <BootstrapIcon name="palette-fill" size={12} color="#1D4533" />
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
                                <BootstrapIcon name="gear-wide-connected" size={14} color="#1D4533" />
                                <Text style={{ fontSize: 11.5, color: tokens.textSecondary, flex: 1, lineHeight: 16 }}>
                                  {bike.notes}
                                </Text>
                              </View>
                            ) : null}
                          </View>

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
                                  backgroundColor: '#1D4533',
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
                    <Text style={styles.statLabel}>Total Orders Placed</Text>
                    <Text style={styles.statValue}>{orders.length}</Text>
                    <Text style={styles.statSub}>Full order telemetry history</Text>
                  </View>

                  {/* Metric 2: Awaiting COD Approval */}
                  <View style={[styles.statCard, styles.statCardWarningAccent]}>
                    <Text style={styles.statLabel}>Awaiting COD Approval</Text>
                    <Text style={[styles.statValue, { color: '#D97706' }]}>
                      {orders.filter((o) => (o.status || '').toLowerCase().includes('pending') || (o.status || '').toLowerCase().includes('approval')).length}
                    </Text>
                    <Text style={styles.statSub}>Pending backoffice verification</Text>
                  </View>

                  {/* Metric 3: Active Dispatches */}
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <Text style={styles.statLabel}>Active Dispatches</Text>
                    <Text style={[styles.statValue, { color: '#2563EB' }]}>
                      {orders.filter((o) => ['processing', 'shipped', 'in transit'].includes((o.status || '').toLowerCase())).length}
                    </Text>
                    <Text style={styles.statSub}>Out for packing or courier transit</Text>
                  </View>

                  {/* Metric 4: Total Order Value */}
                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <Text style={styles.statLabel}>Total Order Value</Text>
                    <Text style={[styles.statValue, { color: '#16A34A' }]}>
                      ₱{orders.reduce((acc, o) => acc + getOrderGrandTotal(o), 0).toLocaleString()}
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
                            backgroundColor: orderFilter !== 'All' ? '#C8DDD3' : (isDarkMode ? '#1C2422' : '#FFFFFF'),
                            borderWidth: 1.5,
                            borderColor: orderFilter !== 'All' ? '#1D4533' : tokens.border,
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
                            color={orderFilter !== 'All' ? '#1D4533' : tokens.textMuted}
                          />
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: orderFilter !== 'All' ? '800' : '600',
                              color: orderFilter !== 'All' ? '#1D4533' : tokens.textPrimary,
                            }}
                          >
                            {orderFilter === 'All' ? 'Category: All' : `Category: ${orderFilter}`}
                          </Text>
                          <BootstrapIcon
                            name={isOrderFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                            size={11}
                            color={orderFilter !== 'All' ? '#1D4533' : tokens.textMuted}
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
                                backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
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
                                        ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F0FDF4')
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
                                            ? '#1D4533'
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
                                          color: isActive ? '#1D4533' : tokens.textPrimary,
                                        }}
                                      >
                                        {item.label}
                                      </Text>
                                    </View>
                                    <View
                                      style={{
                                        backgroundColor: isActive
                                          ? '#C8DDD3'
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
                                          color: isActive ? '#1D4533' : tokens.textMuted,
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

                            {!isOrderDeliveredOrDone(o.status) && (
                              isOrderPendingApproval(o.status) ? (
                                <TouchableOpacity
                                  style={[
                                    styles.addBtnPrimary,
                                    {
                                      paddingVertical: 7,
                                      paddingHorizontal: 12,
                                      backgroundColor: '#FEF3C7',
                                      borderColor: '#FDE68A',
                                      borderWidth: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                    },
                                  ]}
                                  onPress={() => showToast('⏳ Order is pending admin approval. Live tracking will unlock once approved.')}
                                  activeOpacity={0.8}
                                >
                                  <BootstrapIcon name="hourglass-split" size={12} color="#92400E" />
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#92400E' }}>
                                    Awaiting Approval
                                  </Text>
                                </TouchableOpacity>
                              ) : (
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
                              )
                            )}
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
                            Payment: <Text style={{ fontWeight: '700', color: tokens.textPrimary }}>{o.paymentMethod || 'COD'}</Text> • Total: <Text style={{ fontWeight: '900', color: '#1D4533', fontSize: 14 }}>₱{getOrderGrandTotal(o).toLocaleString()}</Text>
                          </Text>

                          {typeof addToCart === 'function' && o.items && o.items.length > 0 && (
                            <TouchableOpacity
                              style={{
                                backgroundColor: isDarkMode ? '#1C2422' : '#FFFFFF',
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
                              <BootstrapIcon name="arrow-repeat" size={12} color="#1D4533" />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1D4533' }}>Buy Again</Text>
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
                          backgroundColor: bookingFilter === f ? '#1D4533' : tokens.bgSub,
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: bookingFilter === f ? '#1D4533' : tokens.border,
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
            {/* TAB 4: RIDER & BIKE PROFILE (Inspiration UI Design)           */}
            {/* ───────────────────────────────────────────────────────── */}
            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 4: RIDER & BIKE PROFILE                               */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <View style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960, marginHorizontal: 'auto', width: '100%' }}>
                {/* 1. Balanced Profile Header Card (Replacing heavy dark banner) */}
                <View
                  style={{
                    backgroundColor: isDarkMode ? tokens.cardBg : '#FFFFFF',
                    borderColor: tokens.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    paddingVertical: isSmallMobile ? 24 : 30,
                    paddingHorizontal: isSmallMobile ? 18 : 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    borderTopWidth: 4,
                    borderTopColor: '#1D4533',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  {/* Avatar Container with Camera Action Badge */}
                  <View style={{ position: 'relative', width: 92, height: 92, marginBottom: 14 }}>
                    <View
                      style={{
                        width: 92,
                        height: 92,
                        borderRadius: 46,
                        backgroundColor: '#1D4533',
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: '#FFFFFF',
                        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                      }}
                    >
                      {currentUser?.avatar || currentUser?.photoUri ? (
                        <Image
                          source={{ uri: currentUser?.avatar || currentUser?.photoUri }}
                          style={{ width: 92, height: 92, borderRadius: 46 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <BootstrapIcon name="person-fill" size={46} color="#FFFFFF" />
                      )}
                    </View>

                    {/* Camera / Edit Badge Button */}
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: '#1D4533',
                        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)',
                        cursor: 'pointer',
                      }}
                      onPress={handleUploadAvatar}
                      accessibilityLabel="Upload new photo"
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="camera-fill" size={13} color="#1D4533" />
                    </TouchableOpacity>
                  </View>

                  {/* Customer Full Name: e.g. "Maurin, Jherico" */}
                  <Text
                    style={{
                      fontSize: isSmallMobile ? 20 : 22,
                      fontWeight: '800',
                      color: tokens.textPrimary,
                      textAlign: 'center',
                      marginBottom: 3,
                      letterSpacing: -0.3,
                    }}
                  >
                    {lastName && firstName
                      ? `${lastName}, ${firstName}`
                      : (name || currentUser?.name || currentUser?.fullName || 'Motorcycle Customer')}
                  </Text>

                  {/* Customer Headline / Bio */}
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: tokens.textSecondary,
                      textAlign: 'center',
                      marginBottom: 5,
                    }}
                  >
                    {bio || currentUser?.bio || 'Motorcycle Enthusiast & Customer'}
                  </Text>

                  {/* Customer Location */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                    <BootstrapIcon name="geo-alt-fill" size={12} color={tokens.brandPrimary} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: tokens.textMuted,
                        textAlign: 'center',
                      }}
                    >
                      {city ? `${city}, ${country || 'Philippines'}` : (country || 'City of Naga, Philippines')}
                    </Text>
                  </View>

                  {/* Profile Header Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={() => setIsEditingPersonalInfo(!isEditingPersonalInfo)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon
                        name={isEditingPersonalInfo ? 'x-lg' : 'pencil-square'}
                        size={13}
                        color="#FFFFFF"
                      />
                      <Text style={styles.btnPrimaryText}>
                        {isEditingPersonalInfo ? 'Cancel Editing' : 'Edit Profile'}
                      </Text>
                    </TouchableOpacity>

                    {/* Subtle Destructive Remove Photo */}
                    {isUploadedAvatar && (
                      <TouchableOpacity
                        onPress={handleRemoveAvatar}
                        style={styles.btnGhost}
                        activeOpacity={0.7}
                      >
                        <BootstrapIcon name="trash" size={12} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626' }}>
                          Remove Photo
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 2. Personal Information Card (2-Column Responsive Grid) */}
                <View style={styles.sectionCard}>
                  {/* Card Header with Section Title and [Edit Information] Button */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="person-vcard" size={14} color="#1D4533" />
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '800',
                          color: tokens.textPrimary,
                          letterSpacing: -0.2,
                        }}
                      >
                        Personal Information
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={() => setIsEditingPersonalInfo(!isEditingPersonalInfo)}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={isEditingPersonalInfo ? 'x-lg' : 'pencil-square'}
                        size={12}
                        color={tokens.brandPrimary}
                      />
                      <Text style={styles.btnSecondaryText}>
                        {isEditingPersonalInfo ? 'Cancel' : 'Edit Information'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!isEditingPersonalInfo ? (
                    /* Read-Only 2-Column Responsive Grid */
                    <View style={{ gap: 16 }}>
                      {/* Row 1: First Name & Last Name */}
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            First Name
                          </Text>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                            {firstName || (name ? name.split(' ')[0] : '—')}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            Last Name
                          </Text>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                            {lastName || (name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : '—')}
                          </Text>
                        </View>
                      </View>

                      {/* Row 2: City & Email Address */}
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            City
                          </Text>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                            {city || 'City of Naga'}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            Email Address
                          </Text>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                            {currentUser?.email || '—'}
                          </Text>
                        </View>
                      </View>

                      {/* Row 3: Phone & Country */}
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            Phone
                          </Text>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                            {phone || currentUser?.phone || '—'}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            Country
                          </Text>
                          <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                            {country || 'Philippines'}
                          </Text>
                        </View>
                      </View>

                      {/* Row 4: Bio */}
                      <View>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Bio
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                          {bio || 'Motorcycle Enthusiast & Customer'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* Edit Form Mode */
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            First Name
                          </Text>
                          <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First Name"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Last Name
                          </Text>
                          <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last Name"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            City
                          </Text>
                          <TextInput
                            value={city}
                            onChangeText={setCity}
                            placeholder="e.g. City of Naga"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Phone Number
                          </Text>
                          <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="+63 912 345 6789"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Country
                          </Text>
                          <TextInput
                            value={country}
                            onChangeText={setCountry}
                            placeholder="Philippines"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Bio / Headline
                          </Text>
                          <TextInput
                            value={bio}
                            onChangeText={setBio}
                            placeholder="e.g. Rider, Enthusiast"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                      </View>

                      {/* Edit Actions */}
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <TouchableOpacity
                          style={styles.btnSecondary}
                          onPress={() => setIsEditingPersonalInfo(false)}
                        >
                          <Text style={styles.btnSecondaryText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnPrimary}
                          onPress={handleSaveProfile}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <BootstrapIcon name="check2" size={14} color="#FFFFFF" />
                              <Text style={styles.btnPrimaryText}>Save Changes</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* 3. Garage & Delivery Information Card */}
                <View style={styles.sectionCard}>
                  {/* Card Header with Section Title and [Edit] Button */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="wrench-adjustable" size={14} color="#1D4533" />
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '800',
                          color: tokens.textPrimary,
                          letterSpacing: -0.2,
                        }}
                      >
                        Garage & Delivery Information
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={() => setIsEditingGarageInfo(!isEditingGarageInfo)}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name={isEditingGarageInfo ? 'x-lg' : 'pencil-square'}
                        size={12}
                        color={tokens.brandPrimary}
                      />
                      <Text style={styles.btnSecondaryText}>
                        {isEditingGarageInfo ? 'Cancel' : 'Edit Information'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!isEditingGarageInfo ? (
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Section 1: Primary Motorcycle */}
                      <View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: tokens.textPrimary,
                            marginBottom: 10,
                          }}
                        >
                          Primary Motorcycle
                        </Text>
                        <View
                          style={{
                            flexDirection: isSmallMobile ? 'column' : 'row',
                            flexWrap: 'wrap',
                            gap: 16,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 150 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Motorcycle Brand
                            </Text>
                            <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                              {bikeBrand || 'Yamaha'}
                            </Text>
                          </View>

                          <View style={{ flex: 1.2, minWidth: isSmallMobile ? '100%' : 170 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Model & Displacement
                            </Text>
                            <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                              {bikeModel || 'NMAX 155'}
                            </Text>
                          </View>

                          <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 140 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Plate / Registration
                            </Text>
                            <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                              {bikePlate || 'NM-4892'}
                            </Text>
                          </View>

                          <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 140 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Odometer Reading
                            </Text>
                            <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                              {bikeOdo || '12,400 km'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Subtle Divider */}
                      <View style={{ height: 1, backgroundColor: tokens.border }} />

                      {/* Section 2: Default Delivery Destination */}
                      <View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: tokens.textPrimary,
                            marginBottom: 10,
                          }}
                        >
                          Default Delivery Destination
                        </Text>
                        <View
                          style={{
                            flexDirection: isSmallMobile ? 'column' : 'row',
                            flexWrap: 'wrap',
                            gap: 16,
                          }}
                        >
                          <View style={{ flex: 1.5, minWidth: isSmallMobile ? '100%' : 200 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Street Address
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.textPrimary, lineHeight: 19 }}>
                              {address || "D'Blockchain Motorparts, South Poblacion"}
                            </Text>
                          </View>

                          <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 140 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              City / Region
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.textPrimary, lineHeight: 19 }}>
                              {city || 'City of Naga'}
                            </Text>
                          </View>

                          <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 140 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Contact Phone
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.textPrimary, lineHeight: 19 }}>
                              {phone || '+63 912 345 6789'}
                            </Text>
                          </View>

                          <View style={{ flex: 1.5, minWidth: isSmallMobile ? '100%' : 180 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                              Delivery Instructions
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: tokens.textSecondary, lineHeight: 19 }}>
                              {deliveryNotes || 'Leave at front gate / contact on delivery'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* Edit Garage & Delivery Mode */
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Motorcycle Specs */}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                        Primary Motorcycle Details
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                        {MOTORCYCLE_BRANDS.slice(0, 5).map((b) => (
                          <TouchableOpacity
                            key={b}
                            onPress={() => setBikeBrand(b)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: bikeBrand === b ? '#1D4533' : tokens.border,
                              backgroundColor: bikeBrand === b ? tokens.brandLight : tokens.bgSub,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: bikeBrand === b ? '700' : '500',
                                color: bikeBrand === b ? '#1D4533' : tokens.textSecondary,
                              }}
                            >
                              {b}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Motorcycle Brand
                          </Text>
                          <TextInput
                            value={bikeBrand}
                            onChangeText={setBikeBrand}
                            placeholder="e.g. Yamaha"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Model & Spec
                          </Text>
                          <TextInput
                            value={bikeModel}
                            onChangeText={setBikeModel}
                            placeholder="e.g. NMAX 155 ABS"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Plate / Registration
                          </Text>
                          <TextInput
                            value={bikePlate}
                            onChangeText={setBikePlate}
                            placeholder="e.g. NM-4892"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Odometer Reading
                          </Text>
                          <TextInput
                            value={bikeOdo}
                            onChangeText={setBikeOdo}
                            placeholder="e.g. 12,400 km"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                      </View>

                      {/* Delivery Address */}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, marginTop: 8 }}>
                        Delivery Destination & Notes
                      </Text>
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 2 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Delivery Street Address
                          </Text>
                          <TextInput
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Street, Barangay, Landmark"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1.5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Delivery Instructions
                          </Text>
                          <TextInput
                            value={deliveryNotes}
                            onChangeText={setDeliveryNotes}
                            placeholder="e.g. Call before arrival"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <TouchableOpacity
                          style={styles.btnSecondary}
                          onPress={() => setIsEditingGarageInfo(false)}
                        >
                          <Text style={styles.btnSecondaryText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnPrimary}
                          onPress={handleSaveProfile}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <BootstrapIcon name="check2" size={14} color="#FFFFFF" />
                              <Text style={styles.btnPrimaryText}>Save Details</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* 4. Account Security & Credentials Card */}
                <View style={styles.sectionCard}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="shield-lock-fill" size={14} color="#1D4533" />
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '800',
                          color: tokens.textPrimary,
                          letterSpacing: -0.2,
                        }}
                      >
                        Account Security & Credentials
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={() => setIsEditingSecurity(!isEditingSecurity)}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name={isEditingSecurity ? 'x-lg' : 'key'}
                        size={12}
                        color={tokens.brandPrimary}
                      />
                      <Text style={styles.btnSecondaryText}>
                        {isEditingSecurity ? 'Cancel' : 'Change Password'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!isEditingSecurity ? (
                    <View
                      style={{
                        flexDirection: isSmallMobile ? 'column' : 'row',
                        flexWrap: 'wrap',
                        gap: 16,
                      }}
                    >
                      <View style={{ flex: 1.2, minWidth: isSmallMobile ? '100%' : 180 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Login Email
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                          {currentUser?.email || 'customer@mototrack.com'}
                        </Text>
                      </View>

                      <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 150 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Password Status
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary }}>
                          •••••••••••• (Encrypted)
                        </Text>
                      </View>

                      <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 150 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Security Protection
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#16A34A' }}>
                          ✓ Protected (Active)
                        </Text>
                      </View>

                      <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 140 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Account Tier
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#1D4533' }}>
                          Verified Customer
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* Edit Password Form */
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Current Password
                          </Text>
                          <View style={{ position: 'relative', justifyContent: 'center' }}>
                            <TextInput
                              value={currentPwd}
                              onChangeText={setCurrentPwd}
                              secureTextEntry={!showCurrentPwd}
                              placeholder="Enter current password"
                              placeholderTextColor={tokens.textMuted}
                              style={[styles.inputBox, { paddingRight: 40, backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', right: 12, padding: 4 }}
                              onPress={() => setShowCurrentPwd(!showCurrentPwd)}
                            >
                              <BootstrapIcon name={showCurrentPwd ? 'eye-slash' : 'eye'} size={15} color={tokens.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            New Password
                          </Text>
                          <View style={{ position: 'relative', justifyContent: 'center' }}>
                            <TextInput
                              value={newPwd}
                              onChangeText={setNewPwd}
                              secureTextEntry={!showNewPwd}
                              placeholder="Min 8 characters"
                              placeholderTextColor={tokens.textMuted}
                              style={[styles.inputBox, { paddingRight: 40, backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', right: 12, padding: 4 }}
                              onPress={() => setShowNewPwd(!showNewPwd)}
                            >
                              <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={15} color={tokens.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 6 }}>
                            Confirm New Password
                          </Text>
                          <View style={{ position: 'relative', justifyContent: 'center' }}>
                            <TextInput
                              value={confirmPwd}
                              onChangeText={setConfirmPwd}
                              secureTextEntry={!showConfirmPwd}
                              placeholder="Confirm new password"
                              placeholderTextColor={tokens.textMuted}
                              style={[styles.inputBox, { paddingRight: 40, backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', right: 12, padding: 4 }}
                              onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                            >
                              <BootstrapIcon name={showConfirmPwd ? 'eye-slash' : 'eye'} size={15} color={tokens.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Password Action Buttons */}
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                        <TouchableOpacity
                          style={styles.btnSecondary}
                          onPress={() => {
                            setIsEditingSecurity(false);
                            setCurrentPwd('');
                            setNewPwd('');
                            setConfirmPwd('');
                          }}
                        >
                          <Text style={styles.btnSecondaryText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnPrimary}
                          onPress={async () => {
                            await handleChangePassword();
                            setIsEditingSecurity(false);
                          }}
                          disabled={isSavingPwd}
                        >
                          {isSavingPwd ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <BootstrapIcon name="shield-lock" size={14} color="#FFFFFF" />
                              <Text style={styles.btnPrimaryText}>Update Password</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 5: NOTIFICATIONS & ALERTS                             */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <View>
                <View
                  style={{
                    backgroundColor: tokens.bgCard,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.10)' : '#A7F3D0',
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 10,
                    elevation: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    height: Platform.OS === 'web' ? 'calc(100vh - 160px)' : 640,
                    maxHeight: 880,
                    minHeight: 520,
                    overflow: 'hidden',
                  }}
                >
                  {/* ─── 1. FIXED TOP CONTROLS (HEADER, SEARCH, FILTERS) ─── */}
                  <View
                    style={{
                      paddingHorizontal: isSmallMobile ? 14 : 20,
                      paddingTop: 18,
                      paddingBottom: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.border,
                      backgroundColor: tokens.bgCard,
                      zIndex: 10,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.03,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    {/* Header Row */}
                    <View
                      style={{
                        flexDirection: isSmallMobile ? 'column' : 'row',
                        alignItems: isSmallMobile ? 'flex-start' : 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: tokens.brandLight,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: tokens.brandBorder,
                          }}
                        >
                          <BootstrapIcon name="bell-fill" size={18} color="#1D4533" />
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: tokens.textPrimary, letterSpacing: -0.3 }}>
                              Notifications & Alerts
                            </Text>
                            {unreadNotifCount > 0 && (
                              <View
                                style={{
                                  backgroundColor: '#E11D48',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                                  {unreadNotifCount} NEW
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                            Updates on your orders, pit bay bookings, deliveries, and promotions
                          </Text>
                        </View>
                      </View>

                      {/* Top Action Button: Mark all read */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {unreadNotifCount > 0 && (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 8,
                              backgroundColor: tokens.bgSub,
                              borderWidth: 1,
                              borderColor: tokens.border,
                              cursor: 'pointer',
                            }}
                            onPress={handleMarkAllNotifsRead}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="check2-all" size={13} color="#1D4533" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                              Mark all read
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Search Input Bar */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: tokens.bgSub,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: tokens.border,
                        paddingHorizontal: 12,
                        paddingVertical: Platform.OS === 'web' ? 8 : 4,
                        marginBottom: 12,
                        gap: 8,
                      }}
                    >
                      <BootstrapIcon name="search" size={14} color={tokens.textMuted} />
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: tokens.textPrimary,
                          padding: 0,
                          outlineStyle: 'none',
                        }}
                        placeholder="Search notifications by keyword, order #, item, ticket..."
                        placeholderTextColor={tokens.textMuted}
                        value={notifSearchQuery}
                        onChangeText={setNotifSearchQuery}
                      />
                      {Boolean(notifSearchQuery) && (
                        <TouchableOpacity onPress={() => setNotifSearchQuery('')} activeOpacity={0.7} style={{ cursor: 'pointer' }}>
                          <BootstrapIcon name="x-circle-fill" size={14} color={tokens.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Filter Pills */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { id: 'All', label: `All (${notifications.length})` },
                        { id: 'order', label: `Orders (${orderNotifsCount})` },
                        { id: 'booking', label: `Pit Bay (${bookingNotifsCount})` },
                        { id: 'promo', label: `Promotions (${promoNotifsCount})` },
                        { id: 'security', label: `Security (${securityNotifsCount})` },
                        { id: 'unread', label: `Unread (${unreadNotifCount})` },
                      ].map((f) => {
                        const isSelected = notifFilter === f.id;
                        return (
                          <TouchableOpacity
                            key={f.id}
                            style={{
                              backgroundColor: isSelected ? '#1D4533' : tokens.bgSub,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: isSelected ? '#1D4533' : tokens.border,
                              cursor: 'pointer',
                            }}
                            onPress={() => setNotifFilter(f.id)}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: isSelected ? '800' : '600',
                                color: isSelected ? '#FFFFFF' : tokens.textSecondary,
                              }}
                            >
                              {f.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* ─── 2. DEDICATED SCROLLABLE NOTIFICATION FEED ─── */}
                  <ScrollView
                    style={{ flex: 1, paddingHorizontal: isSmallMobile ? 14 : 20 }}
                    contentContainerStyle={{ paddingVertical: 16, gap: 18 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {groupedNotifications.length === 0 ? (
                      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: tokens.bgSub,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                          }}
                        >
                          <BootstrapIcon name="bell-slash" size={26} color={tokens.textMuted} />
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary }}>
                          {notifSearchQuery ? 'No matching notifications' : 'No notifications yet'}
                        </Text>
                        <Text style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 4 }}>
                          {notifSearchQuery
                            ? 'Try searching with different keywords.'
                            : "We'll notify you about orders, pit bay bookings, and specials."}
                        </Text>
                      </View>
                    ) : (
                      groupedNotifications.map((group) => (
                        <View key={group.key} style={{ gap: 8 }}>
                          {/* Date Section Heading (New, Today, Yesterday, Earlier) */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 4,
                              paddingHorizontal: 2,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '800',
                                  color: tokens.textPrimary,
                                  letterSpacing: 0.3,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {group.title}
                              </Text>
                              {group.badge && (
                                <View
                                  style={{
                                    backgroundColor: 'rgba(29, 69, 51, 0.12)',
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderRadius: 8,
                                  }}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1D4533' }}>
                                    {group.badge}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Group Items Feed */}
                          <View style={{ gap: 10 }}>
                            {group.items.map((n) => {
                              const isUnread = n.status === 'unread';
                              const isExpanded = expandedNotifIds.has(n.id);
                              const metaTheme = getNotifTheme(n.type, n.category);
                              const actionLabel = getNotifActionLabel(n);

                              return (
                                <View
                                  key={n.id}
                                  style={{
                                    backgroundColor: isUnread
                                      ? (isDarkMode ? 'rgba(29, 69, 51, 0.14)' : '#FAF9F6')
                                      : (isDarkMode ? '#141A18' : '#FFFFFF'),
                                    borderWidth: 1,
                                    borderColor: isUnread ? '#D4D4D8' : tokens.border,
                                    borderRadius: 16,
                                    shadowColor: '#000000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.03,
                                    shadowRadius: 6,
                                    elevation: 1,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {/* Top Clickable Summary Row */}
                                  <TouchableOpacity
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'flex-start',
                                      justifyContent: 'space-between',
                                      padding: 16,
                                      gap: 14,
                                      cursor: 'pointer',
                                    }}
                                    onPress={() => {
                                      if (isUnread) handleMarkSingleNotifRead(n.id);
                                      setExpandedNotifIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(n.id)) next.delete(n.id);
                                        else next.add(n.id);
                                        return next;
                                      });
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 0 }}>
                                      {/* Soft Icon Circle */}
                                      <View
                                        style={{
                                          width: 38,
                                          height: 38,
                                          borderRadius: 19,
                                          backgroundColor: metaTheme.bg,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          flexShrink: 0,
                                          marginTop: 2,
                                        }}
                                      >
                                        <BootstrapIcon
                                          name={metaTheme.icon}
                                          size={16}
                                          color={metaTheme.color}
                                        />
                                      </View>

                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <Text
                                            style={{
                                              fontSize: 14,
                                              fontWeight: isUnread ? '700' : '600',
                                              color: tokens.textPrimary,
                                              lineHeight: 20,
                                            }}
                                          >
                                            {stripEmojis(n.title)}
                                          </Text>
                                          {isUnread && (
                                            <View
                                              style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: '#1D4533',
                                              }}
                                            />
                                          )}
                                        </View>

                                        {!isExpanded && (
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              color: tokens.textMuted,
                                              marginTop: 3,
                                              lineHeight: 18,
                                            }}
                                            numberOfLines={1}
                                          >
                                            {stripEmojis(n.message)}
                                          </Text>
                                        )}
                                      </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, marginTop: 4 }}>
                                      <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                                        {formatNotifTime(n.created_at || n.timestamp)}
                                      </Text>
                                      <BootstrapIcon
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={14}
                                        color="#8E8E93"
                                      />
                                    </View>
                                  </TouchableOpacity>

                                  {/* Expanded Body */}
                                  {isExpanded && (
                                    <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }}>
                                      <Text
                                        style={{
                                          fontSize: 13.5,
                                          color: tokens.textSecondary,
                                          lineHeight: 21,
                                          paddingLeft: 52,
                                          marginTop: 2,
                                        }}
                                      >
                                        {stripEmojis(n.message)}
                                      </Text>

                                      {/* Divider */}
                                      <View
                                        style={{
                                          height: 1,
                                          backgroundColor: tokens.border,
                                          marginVertical: 12,
                                          marginLeft: 52,
                                        }}
                                      />

                                      {/* Footer */}
                                      <View
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          paddingLeft: 52,
                                        }}
                                      >
                                        <TouchableOpacity
                                          onPress={() => handleNotifAction(n)}
                                          activeOpacity={0.7}
                                          style={{ cursor: 'pointer' }}
                                        >
                                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>
                                            {actionLabel} · {metaTheme.label}
                                          </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          onPress={() => handleDeleteNotif(n.id)}
                                          activeOpacity={0.7}
                                          title="Dismiss notification"
                                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                        >
                                          <BootstrapIcon name="trash3" size={13} color="#71717A" />
                                          <Text style={{ fontSize: 12, color: '#71717A', fontWeight: '500' }}>Dismiss</Text>
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 6: SECURITY & SETTINGS                                */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
              <View>
                {/* 1. Customer Information & Settings Card */}
                <View style={[styles.sectionCard, { marginBottom: 20 }]}>
                  <View
                    style={{
                      flexDirection: isSmallMobile ? 'column' : 'row',
                      alignItems: isSmallMobile ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 16,
                      paddingBottom: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="person-vcard-fill" size={17} color="#1D4533" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 16.5, fontWeight: '800', color: tokens.textPrimary, letterSpacing: -0.2 }}>
                          Customer Information & Settings
                        </Text>
                        <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 1 }}>
                          Review your registered rider information, contact details, and destination
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={() => setIsEditSettingsModalOpen(true)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="pencil-square" size={13} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryText}>Edit Information</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 2-Column Responsive Information Grid */}
                  <View style={{ gap: 12 }}>
                    {/* Row 1: Name and Email */}
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: tokens.bgSub,
                          padding: 13,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Full Customer Name
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: tokens.textPrimary, marginTop: 3 }}>
                          {userDisplayName}
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          backgroundColor: tokens.bgSub,
                          padding: 13,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Account Email Address
                          </Text>
                          <View
                            style={{
                              backgroundColor: tokens.statusSuccessBg,
                              paddingHorizontal: 7,
                              paddingVertical: 1.5,
                              borderRadius: 5,
                              borderWidth: 1,
                              borderColor: tokens.statusSuccessBorder,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: tokens.statusSuccessText }}>Verified</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary, marginTop: 3 }}>
                          {currentUser?.email || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Row 2: Phone and Delivery Destination */}
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: tokens.bgSub,
                          padding: 13,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Contact Phone Number
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary, marginTop: 3 }}>
                          {currentUser?.phone || phone || 'Not provided'}
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          backgroundColor: tokens.bgSub,
                          padding: 13,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Primary Delivery Destination
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary, marginTop: 3 }} numberOfLines={1}>
                          {currentUser?.address || address ? `${currentUser?.address || address}, ${currentUser?.city || city || 'City of Naga'}, ${currentUser?.country || country || 'Philippines'}` : 'No street address saved'}
                        </Text>
                      </View>
                    </View>

                    {/* Row 3: Bio and Delivery Notes */}
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: tokens.bgSub,
                          padding: 13,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Rider Bio / Headline
                        </Text>
                        <Text style={{ fontSize: 13.5, fontWeight: '600', color: tokens.textSecondary, marginTop: 3 }}>
                          {currentUser?.bio || bio || 'Motorcycle Enthusiast & Customer'}
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          backgroundColor: tokens.bgSub,
                          padding: 13,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: tokens.border,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          Courier Delivery Instructions
                        </Text>
                        <Text style={{ fontSize: 13.5, fontWeight: '600', color: tokens.textSecondary, marginTop: 3 }}>
                          {currentUser?.deliveryNotes || deliveryNotes || 'Leave at front gate / contact on delivery'}
                        </Text>
                      </View>
                    </View>

                    {/* Row 4: Account Badges & Status */}
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        paddingTop: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tokens.bgSub, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: tokens.border }}>
                        <BootstrapIcon name="shield-check" size={12} color="#059669" />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                          Active Customer
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tokens.bgSub, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: tokens.border }}>
                        <BootstrapIcon name="geo-alt-fill" size={12} color="#1D4533" />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                          Hub: {currentUser?.city || city || 'City of Naga'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tokens.bgSub, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: tokens.border }}>
                        <BootstrapIcon name="patch-check-fill" size={12} color="#2563EB" />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.textPrimary }}>
                          Verified Account
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 2. Compact Change Password Card */}
                {(() => {
                  const hasLength = newPwd.length >= 8;
                  const hasUpper = /[A-Z]/.test(newPwd);
                  const hasNumber = /[0-9]/.test(newPwd);
                  const hasSpecial = /[^A-Za-z0-9]/.test(newPwd);
                  const score = (hasLength ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);

                  let strengthLabel = 'Weak';
                  let strengthColor = '#DC2626';
                  let strengthPercent = '25%';
                  if (score === 2) {
                    strengthLabel = 'Fair';
                    strengthColor = '#F59E0B';
                    strengthPercent = '50%';
                  } else if (score === 3) {
                    strengthLabel = 'Good';
                    strengthColor = '#2563EB';
                    strengthPercent = '75%';
                  } else if (score === 4) {
                    strengthLabel = 'Strong';
                    strengthColor = '#10B981';
                    strengthPercent = '100%';
                  }

                  return (
                    <View style={styles.sectionCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: tokens.brandLight,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: tokens.brandBorder,
                          }}
                        >
                          <BootstrapIcon name="key-fill" size={15} color="#1D4533" />
                        </View>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                            Change Password
                          </Text>
                          <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                            Keep your rider account secured with strong authentication
                          </Text>
                        </View>
                      </View>

                      <View style={{ gap: 14 }}>
                        {/* Current Password */}
                        <View>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                            Current Password
                          </Text>
                          <View style={{ position: 'relative', justifyContent: 'center' }}>
                            <TextInput
                              style={[styles.inputBox, { paddingRight: 42 }]}
                              value={currentPwd}
                              onChangeText={setCurrentPwd}
                              secureTextEntry={!showCurrentPwd}
                              placeholder="••••••••"
                              placeholderTextColor={tokens.textMuted}
                            />
                            <TouchableOpacity
                              style={{ position: 'absolute', right: 12, padding: 6 }}
                              onPress={() => setShowCurrentPwd(!showCurrentPwd)}
                              accessibilityLabel={showCurrentPwd ? 'Hide current password' : 'Show current password'}
                            >
                              <BootstrapIcon name={showCurrentPwd ? 'eye-slash' : 'eye'} size={15} color={tokens.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* New Password & Confirm New Password in 2 Columns */}
                        <View style={{ flexDirection: windowWidth >= 640 ? 'row' : 'column', gap: 14 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                              New Password
                            </Text>
                            <View style={{ position: 'relative', justifyContent: 'center' }}>
                              <TextInput
                                style={[styles.inputBox, { paddingRight: 42 }]}
                                value={newPwd}
                                onChangeText={setNewPwd}
                                secureTextEntry={!showNewPwd}
                                placeholder="Min 8 characters"
                                placeholderTextColor={tokens.textMuted}
                              />
                              <TouchableOpacity
                                style={{ position: 'absolute', right: 12, padding: 6 }}
                                onPress={() => setShowNewPwd(!showNewPwd)}
                                accessibilityLabel={showNewPwd ? 'Hide new password' : 'Show new password'}
                              >
                                <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={15} color={tokens.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                              Confirm New Password
                            </Text>
                            <View style={{ position: 'relative', justifyContent: 'center' }}>
                              <TextInput
                                style={[styles.inputBox, { paddingRight: 42 }]}
                                value={confirmPwd}
                                onChangeText={setConfirmPwd}
                                secureTextEntry={!showConfirmPwd}
                                placeholder="Re-enter password"
                                placeholderTextColor={tokens.textMuted}
                              />
                              <TouchableOpacity
                                style={{ position: 'absolute', right: 12, padding: 6 }}
                                onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                                accessibilityLabel={showConfirmPwd ? 'Hide confirm password' : 'Show confirm password'}
                              >
                                <BootstrapIcon name={showConfirmPwd ? 'eye-slash' : 'eye'} size={15} color={tokens.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>

                        {/* Real-time Password Strength & Requirements Checklist */}
                        {newPwd.length > 0 && (
                          <View style={{ backgroundColor: tokens.bgSub, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: tokens.border, gap: 10 }}>
                            <View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Password Strength
                                </Text>
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: strengthColor }}>
                                  {strengthLabel}
                                </Text>
                              </View>
                              <View style={{ height: 5, borderRadius: 3, backgroundColor: tokens.bgCard, borderWidth: 1, borderColor: tokens.border, overflow: 'hidden' }}>
                                <View style={{ width: strengthPercent, height: '100%', backgroundColor: strengthColor, borderRadius: 2 }} />
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 150 }}>
                                <BootstrapIcon
                                  name={hasLength ? 'check-circle-fill' : 'circle'}
                                  size={12}
                                  color={hasLength ? '#10B981' : tokens.textMuted}
                                />
                                <Text style={{ fontSize: 11.5, color: hasLength ? tokens.textPrimary : tokens.textMuted, fontWeight: hasLength ? '600' : '400' }}>
                                  At least 8 characters
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 150 }}>
                                <BootstrapIcon
                                  name={hasUpper ? 'check-circle-fill' : 'circle'}
                                  size={12}
                                  color={hasUpper ? '#10B981' : tokens.textMuted}
                                />
                                <Text style={{ fontSize: 11.5, color: hasUpper ? tokens.textPrimary : tokens.textMuted, fontWeight: hasUpper ? '600' : '400' }}>
                                  Contains uppercase letter
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 150 }}>
                                <BootstrapIcon
                                  name={hasNumber ? 'check-circle-fill' : 'circle'}
                                  size={12}
                                  color={hasNumber ? '#10B981' : tokens.textMuted}
                                />
                                <Text style={{ fontSize: 11.5, color: hasNumber ? tokens.textPrimary : tokens.textMuted, fontWeight: hasNumber ? '600' : '400' }}>
                                  Contains number
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 150 }}>
                                <BootstrapIcon
                                  name={hasSpecial ? 'check-circle-fill' : 'circle'}
                                  size={12}
                                  color={hasSpecial ? '#10B981' : tokens.textMuted}
                                />
                                <Text style={{ fontSize: 11.5, color: hasSpecial ? tokens.textPrimary : tokens.textMuted, fontWeight: hasSpecial ? '600' : '400' }}>
                                  Contains special character
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.btnPrimary,
                            {
                              marginTop: 4,
                              alignSelf: isSmallMobile ? 'stretch' : 'flex-start',
                            },
                          ]}
                          onPress={handleChangePassword}
                          disabled={isSavingPwd}
                          activeOpacity={0.85}
                        >
                          {isSavingPwd ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <BootstrapIcon name="shield-lock-fill" size={13} color="#FFFFFF" />
                              <Text style={styles.btnPrimaryText}>Update Password</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}

                {/* 3. Change Email Card */}
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: tokens.brandLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: tokens.brandBorder,
                      }}
                    >
                      <BootstrapIcon name="envelope-check-fill" size={15} color="#1D4533" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary }}>
                        Account Email Address
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                        Currently signed in as: {currentUser?.email || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 14 }}>
                    <View style={{ flexDirection: windowWidth >= 640 ? 'row' : 'column', gap: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                          New Email Address
                        </Text>
                        <TextInput
                          style={styles.inputBox}
                          value={newEmail}
                          onChangeText={setNewEmail}
                          placeholder="rider@newemail.com"
                          placeholderTextColor={tokens.textMuted}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                          Confirm with Current Password
                        </Text>
                        <TextInput
                          style={styles.inputBox}
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
                        styles.btnPrimary,
                        {
                          marginTop: 4,
                          alignSelf: isSmallMobile ? 'stretch' : 'flex-start',
                        },
                      ]}
                      onPress={handleChangeEmail}
                      disabled={isSavingEmail}
                      activeOpacity={0.85}
                    >
                      {isSavingEmail ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <BootstrapIcon name="check2" size={14} color="#FFFFFF" />
                          <Text style={styles.btnPrimaryText}>Save Email Address</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Account Activity Logs */}
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <BootstrapIcon name="shield-lock" size={18} color="#1D4533" />
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

      {/* Edit Customer Settings Modal */}
      <EditCustomerSettingsModal
        visible={isEditSettingsModalOpen}
        currentUser={currentUser}
        onClose={() => setIsEditSettingsModalOpen(false)}
        onSave={handleSaveProfileFromModal}
        isDarkMode={isDarkMode}
        showToast={showToast}
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
          {/* Shopping Cart Modal */}
      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          onNavigateToStore?.();
        }}
      />
</SafeAreaView>
  );
}
