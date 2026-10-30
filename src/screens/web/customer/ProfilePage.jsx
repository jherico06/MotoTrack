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
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getProfileWebTokens, createProfileWebStyles } from '../../../styles/web/profilePage.web.styles.js';
import { appStorage } from '../../../services/system/storageAdapter.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { garageService } from '../../../services/bookings/garageService.js';
import { orderService } from '../../../services/orders/orderService.js';
import {
  notificationService,
  stripEmojis,
  isOrderNotification,
  isBookingNotification,
  isPromoNotification,
  isSecurityNotification,
} from '../../../services/notifications/notificationService.js';
import {
  BootstrapIcon,
  BrandLogo,
  NotificationDropdown,
  UserProfileButton,
  UserProfileDropdown,
  CustomerServiceBookingCard,
} from '../../../components/common';
import { normalizeBookingStatus } from '../../../utils/bookingWorkflow.js';
import {
  LiveOrderTrackingMapModal,
  ConfirmModal,
  RegisterMotorcycleModal,
  EditCustomerSettingsModal,
  CartModal,
  RateDeliveredOrderModal,
  CustomerSubmitReportModal,
} from '../../../components/modals';
import { motorcycleService } from '../../../services/products/motorcycleService.js';
import { customizationService } from '../../../services/bookings/customizationService.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';

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

const formatBookingDate = (dateStr) => {
  if (!dateStr) return 'Date scheduled';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (_e) {}
  return dateStr;
};

const formatOrderDate = (dateStr) => {
  if (!dateStr) return 'Recent Order';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (_e) {}
  return dateStr;
};

const MOTORCYCLE_BRANDS = ['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW', 'KTM', 'Triumph'];

const MAIN_NAV_ITEMS = [
  { id: 'shop', label: 'Shop' },
  { id: 'booking', label: 'Book a Service' },
  { id: 'customize', label: 'Customize' },
  { id: 'garage', label: 'Garage' },
  { id: 'orders', label: 'Orders' },
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

function getNotifTheme(type = '', category = '', notif = null) {
  if (
    notif
      ? isBookingNotification(notif)
      : String(type || '').includes('booking') ||
        String(category || '').includes('booking') ||
        String(category || '').includes('service') ||
        String(category || '').includes('garage') ||
        String(category || '').includes('repair') ||
        String(category || '').includes('pms')
  ) {
    return {
      icon: 'tools',
      color: '#D97706',
      bg: '#FEF3C7',
      badgeBg: '#FDE68A',
      label: 'Pit Bay',
    };
  }
  if (
    notif
      ? isOrderNotification(notif)
      : String(type || '').includes('order') ||
        String(category || '').includes('order') ||
        String(category || '').includes('delivery')
  ) {
    return {
      icon: 'bag-check-fill',
      color: '#2563EB',
      bg: '#EFF6FF',
      badgeBg: '#DBEAFE',
      label: 'Order',
    };
  }
  if (
    notif
      ? isPromoNotification(notif)
      : String(type || '').includes('promo') ||
        String(category || '').includes('promo') ||
        String(category || '').includes('welcome') ||
        String(category || '').includes('discount')
  ) {
    return {
      icon: 'ticket-perforated-fill',
      color: '#EA580C',
      bg: '#FFF7ED',
      badgeBg: '#FFEDD5',
      label: 'Promotion',
    };
  }
  if (
    notif
      ? isSecurityNotification(notif)
      : String(type || '').includes('security') ||
        String(category || '').includes('security') ||
        String(type || '').includes('system') ||
        String(category || '').includes('system')
  ) {
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
    color: '#EA580C',
    bg: '#FFF7ED',
    badgeBg: '#C8DDD3',
    label: 'Notification',
  };
}

function getNotifActionLabel(notif) {
  if (isBookingNotification(notif)) return 'View Booking →';
  if (isOrderNotification(notif)) return 'Track Order →';
  if (isPromoNotification(notif)) return 'View Deals →';
  if (isSecurityNotification(notif)) return 'Security Settings →';
  return 'View Details →';
}

export default function ProfilePage({
  initialTab = 'garage',
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
  const [brandSettings, setBrandSettings] = useState(() => systemSettingsService.getSettings());

  useEffect(() => {
    return systemSettingsService.subscribe(setBrandSettings);
  }, []);

  // ─── DARK MODE STATE (Global Theme Context) ───
  const { isDarkMode, toggleDarkMode } = useTheme();

  const tokens = useMemo(() => getProfileWebTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createProfileWebStyles(isDarkMode), [isDarkMode]);
  const customerHeaderBg = isDarkMode ? '#1E2226' : '#24272B';
  const customerHeaderBorder = isDarkMode ? '#374151' : '#24272B';

  // ─── ACTIVE NAVIGATION TAB ───
  // ─── ACTIVE NAVIGATION TAB ───
  // 'overview' | 'garage' | 'orders' | 'bookings' | 'profile' | 'notifications' | 'settings'
  const resolveWebTab = (t) => {
    const raw = (t && typeof t === 'object' ? t.tab : t);
    if (raw === 'bookings') {
      onNavigateToGarage?.();
      return 'garage';
    }
    return raw === 'overview' ? 'garage' : raw;
  };
  const [activeTab, setActiveTab] = useState(() => {
    const raw = resolveWebTab(initialTab);
    if (
      raw === 'orders' ||
            raw === 'garage' ||
      raw === 'settings' ||
      raw === 'notifications' ||
      raw === 'profile'
    ) {
      return raw;
    }
    return 'garage';
  });

  useEffect(() => {
    const raw = resolveWebTab(initialTab);
    if (raw === 'wishlist') {
      onNavigateToWishlist?.();
    } else if (raw) {
      setActiveTab(raw === 'overview' || raw === 'bookings' ? 'garage' : raw);
    }
  }, [initialTab, onNavigateToWishlist, onNavigateToGarage]);

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
  const [bikeBrand, setBikeBrand] = useState(currentUser?.bikeBrand || '');
  const [bikeModel, setBikeModel] = useState(currentUser?.bikeModel || '');
  const [bikePlate, setBikePlate] = useState(currentUser?.bikePlate || '');
  const [bikeOdo, setBikeOdo] = useState(currentUser?.bikeOdo || '');
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
    currentUser?.id ? motorcycleService.getMotorcycles(currentUser?.id) : []
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
  const [mechanicsData, setMechanicsData] = useState(() => garageService.getAvailableMechanics());
  const [todaySlotsData, setTodaySlotsData] = useState(() => garageService.getDaySlotAvailability());
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');
  const [bookingViewMode, setBookingViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedBookingForModal, setSelectedBookingForModal] = useState(null);
  const [bookingsPage, setBookingsPage] = useState(1);
  const BOOKINGS_PAGE_SIZE = 6;
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState(() =>
    notificationService.getCustomerNotifications(currentUser)
  );
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
    const updateList = () => {
      setNotifications(notificationService.getCustomerNotifications(currentUser));
    };
    updateList();
    const unsub = notificationService.subscribe(updateList);
    return () => unsub?.();
  }, [currentUser?.id, currentUser?.customer_id, currentUser?.email]);

  // Live Tracking Modal State
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  // Customer Rating & Report Modal States
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [isRateOrderModalOpen, setIsRateOrderModalOpen] = useState(false);
  const [isSubmitReportModalOpen, setIsSubmitReportModalOpen] = useState(false);
  const [reportContextOrder, setReportContextOrder] = useState(null);

  // Saved Customizations & AI Previews State
  const [customizations, setCustomizations] = useState([]);
  const [loadingCustomizations, setLoadingCustomizations] = useState(false);

  const refreshCustomizations = async () => {
    const uid = currentUser?.id || currentUser?.user_id;
    const cid = currentUser?.customer_id || currentUser?.id;
    if (!uid && !cid) return;
    setLoadingCustomizations(true);
    try {
      const list = await customizationService.listCustomizations({
        userId: uid,
        customerId: cid,
      });
      setCustomizations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('[ProfilePage] Failed to fetch customizations:', err);
    } finally {
      setLoadingCustomizations(false);
    }
  };

  const handleDownloadCustomization = (item) => {
    const url = item.previewImageUrl || item.preview_image_url;
    if (!url) return;
    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = url;
      link.download = `mototrack_build_${item.id || item.customization_id || 'preview'}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Customization preview downloaded!');
    }
  };

  const handleAddCustomizationToCart = (item) => {
    const items = item.items || [];
    if (!items.length) {
      showToast('No catalog parts attached to this build.');
      return;
    }
    let count = 0;
    for (const line of items) {
      if (typeof addToCart === 'function') {
        addToCart(
          {
            id: line.productId || line.product_id,
            product_id: line.productId || line.product_id,
            name: line.product_name || line.name || 'Motorcycle Part',
            price: Number(line.price) || 0,
            brand: line.product_brand || line.brand || '',
            category: line.product_category || line.category || '',
          },
          line.quantity || 1
        );
        count++;
      }
    }
    showToast(`✓ Added ${count} part${count > 1 ? 's' : ''} to cart!`);
  };

  const handleDeleteCustomization = async (id) => {
    try {
      await customizationService.deleteCustomization(id);
      showToast('Custom build removed.');
      refreshCustomizations();
    } catch (_e) {
      showToast('Failed to remove custom build.');
    }
  };

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

    const refreshAvailability = () => {
      setMechanicsData(garageService.getAvailableMechanics());
      setTodaySlotsData(garageService.getDaySlotAvailability());
    };

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
      refreshAvailability();
    };

    syncCustomerBookings();
    refreshAvailability();
    garageService.fetchMechanics?.().then(() => refreshAvailability()).catch(() => {});

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
          setNotifications(notificationService.getCustomerNotifications(currentUser) || []);
        });
      }
    } catch (_e) {}

    try {
      if (currentUser?.id || currentUser?.user_id) {
        orderService
          .getUserOrders(
            currentUser?.id || currentUser?.user_id,
            currentUser?.customer_id,
            currentUser?.name,
            currentUser
          )
          .then((list) => setOrders(Array.isArray(list) ? list : []))
          .catch(() => setOrders([]));
      } else {
        setOrders([]);
      }
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
        unsubMoto = motorcycleService.subscribe(() => {
          setMotorcycles(currentUser?.id ? motorcycleService.getMotorcycles(currentUser.id) || [] : []);
        });
      }
      setMotorcycles(currentUser?.id ? motorcycleService.getMotorcycles(currentUser?.id) || [] : []);
    } catch (_e) {}

    const unsubSettings = systemSettingsService.subscribe(() => {
      refreshAvailability();
    });

    let unsubCust = () => {};
    try {
      refreshCustomizations();
      if (typeof customizationService?.subscribe === 'function') {
        unsubCust = customizationService.subscribe(() => {
          refreshCustomizations();
        });
      }
    } catch (_e) {}

    return () => {
      try {
        unsubGarage?.();
        unsubNotif?.();
        unsubMoto?.();
        unsubSettings?.();
        unsubCust?.();
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

  const isVerifiedCustomer = useMemo(() => {
    return Boolean(
      currentUser?.email_verified ||
      currentUser?.is_verified ||
      currentUser?.isVerified ||
      currentUser?.verified ||
      currentUser?.email_confirmed_at ||
      currentUser?.user_metadata?.email_verified ||
      currentUser?.app_metadata?.provider === 'google'
    );
  }, [currentUser]);

  const upcomingMaintenance = useMemo(() => {
    if (!Array.isArray(bookings)) return null;
    return (
      bookings.find((b) => {
        const st = String(b.status || '').toLowerCase();
        return (
          st.includes('confirm') ||
          st.includes('sched') ||
          st.includes('pending') ||
          st.includes('in-progress') ||
          st.includes('queue')
        );
      }) || null
    );
  }, [bookings]);

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

  // Filtered Bookings (Matching Motorcycle Repair & Maintenance view)
  const filteredBookings = useMemo(() => {
    const userBookings = Array.isArray(bookings) ? bookings : [];
    if (bookingStatusFilter === 'ALL') return userBookings;
    return userBookings.filter((b) => {
      const s = normalizeBookingStatus(b?.status);
      if (bookingStatusFilter === 'PENDING') {
        return [
          'PENDING_REVIEW',
          'APPROVED',
          'SCHEDULED',
          'UNDER_INSPECTION',
          'QUOTATION_SENT',
          'AWAITING_CUSTOMER_APPROVAL',
          'AWAITING_DOWNPAYMENT',
        ].includes(s);
      }
      if (bookingStatusFilter === 'IN_PROGRESS') {
        return [
          'CONFIRMED',
          'SERVICE_IN_PROGRESS',
          'ADDITIONAL_APPROVAL_REQUIRED',
          'SERVICE_COMPLETED',
          'AWAITING_FINAL_PAYMENT',
        ].includes(s);
      }
      if (bookingStatusFilter === 'READY') {
        return s === 'READY_FOR_PICKUP';
      }
      if (bookingStatusFilter === 'COMPLETED') {
        return s === 'COMPLETED';
      }
      return true;
    });
  }, [bookings, bookingStatusFilter]);

  const bookingsTotalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PAGE_SIZE));
  const pagedBookings = useMemo(() => {
    const start = (bookingsPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredBookings.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filteredBookings, bookingsPage]);

  useEffect(() => {
    if (bookingsPage > bookingsTotalPages) setBookingsPage(1);
  }, [bookingsPage, bookingsTotalPages]);

  const activeModalBooking = useMemo(() => {
    if (!selectedBookingForModal) return null;
    const modalId = selectedBookingForModal?.booking_id || selectedBookingForModal?.id;
    return (bookings || []).find((b) => (b?.booking_id || b?.id) === modalId) || selectedBookingForModal;
  }, [bookings, selectedBookingForModal]);

  const orderNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(isOrderNotification).length;
  }, [notifications]);

  const bookingNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(isBookingNotification).length;
  }, [notifications]);

  const promoNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(isPromoNotification).length;
  }, [notifications]);

  const securityNotifsCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(isSecurityNotification).length;
  }, [notifications]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    let list = Array.isArray(notifications) ? notifications : [];
    if (notifFilter === 'order') {
      list = list.filter(isOrderNotification);
    } else if (notifFilter === 'booking') {
      list = list.filter(isBookingNotification);
    } else if (notifFilter === 'promo') {
      list = list.filter(isPromoNotification);
    } else if (notifFilter === 'security') {
      list = list.filter(isSecurityNotification);
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
    await notificationService.markAllCustomerAsRead(currentUser);
    setNotifications(notificationService.getCustomerNotifications(currentUser));
    showToast('✓ All notifications marked as read');
  };

  const handleClearReadNotifs = async () => {
    await notificationService.clearCustomerReadNotifications(currentUser);
    setNotifications(notificationService.getCustomerNotifications(currentUser));
    showToast('✓ Cleared read notifications');
  };

  const handleMarkSingleNotifRead = async (id) => {
    await notificationService.markCustomerAsRead(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser));
  };

  const handleMarkSingleNotifUnread = async (id) => {
    await notificationService.markCustomerAsUnread(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser));
  };

  const handleDeleteNotif = async (id) => {
    await notificationService.deleteCustomerNotification(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser));
    showToast('Notification removed');
  };

  const handleNotifAction = (notif) => {
    handleMarkSingleNotifRead(notif.id);
    const link = (notif.link || '').toLowerCase();
    const type = (notif.type || '').toLowerCase();
    if (type === 'booking' || link === 'bookings' || link === 'garage') {
      onNavigateToGarage?.();
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
      setActiveTab('garage');
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
        try {
          notificationService.notifyCustomerProfileUpdated({
            userId: currentUser?.id || currentUser?.user_id,
            customerEmail: currentUser?.email,
            customerName: combinedName,
          });
        } catch (_notifErr) {}
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
      try {
        notificationService.notifyCustomerProfileUpdated({
          userId: currentUser?.id || currentUser?.user_id,
          customerEmail: currentUser?.email,
          customerName: payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || currentUser?.name,
        });
      } catch (_notifErr) {}
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
        try {
          notificationService.notifyCustomerSecurityAlert({
            userId: currentUser?.id || currentUser?.user_id,
            customerEmail: currentUser?.email,
            title: 'Password Changed Successfully',
            message: 'Your account password has been updated. If you did not make this change, please contact support immediately.',
          });
        } catch (_notifErr) {}
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
        const updatedEmail = newEmail.trim();
        setNewEmail('');
        setEmailPwd('');
        try {
          notificationService.notifyCustomerSecurityAlert({
            userId: currentUser?.id || currentUser?.user_id,
            customerEmail: updatedEmail,
            title: 'Account Email Updated',
            message: `Your login email was successfully updated to ${updatedEmail}.`,
          });
        } catch (_notifErr) {}
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
            backgroundColor: '#EA580C',
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
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13.5 }}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* ─── FULL-HEIGHT PROFILE SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web' ? { overscrollBehavior: 'none', overscrollBehaviorY: 'none' } : {}),
        }}
        contentContainerStyle={{ flexGrow: 1, width: '100%' }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── 1. SINGLE TOP NAVBAR ─── */}
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

          {/* MAIN NAVIGATION (CENTERED): Shop | Book a Service | Customize | Garage | Orders */}
          {windowWidth >= 768 && (
            <View style={styles.headerCenterNav}>
              <View style={styles.mainNavList}>
                {MAIN_NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      className="main-nav-tab"
                      style={[styles.mainNavItem, isActive && styles.mainNavItemActive]}
                      onPress={() => {
                        if (item.id === 'shop') {
                          onNavigateToStore?.();
                        } else if (item.id === 'booking') {
                          onNavigateToGarage?.();
                        } else if (item.id === 'customize') {
                          if (onNavigateToCustomizer) onNavigateToCustomizer();
                          else onNavigateToStore?.();
                        } else {
                          setActiveTab(item.id);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.mainNavItemText,
                          isActive && styles.mainNavItemTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* RIGHT: [Heart] | [Bell] | [Cart] | [⚙] | [Profile] */}
          <View style={[styles.headerActions, windowWidth < 768 && { gap: 8 }]}>
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
                  else if (screen === 'profile') setActiveTab(params?.tab || 'profile');
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
              <View style={[styles.loggedInContainer, { position: 'relative' }]}>
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
                  currentScreen="profile"
                  showDashboard={false}
                  isDark={isDarkMode}
                  onToggleDarkMode={toggleDarkMode}
                  onClose={() => setIsProfileDropdownOpen(false)}
                  onNavigateToDashboard={(tab = 'garage') => setActiveTab(tab)}
                  onNavigateToOrders={() => setActiveTab('orders')}
                  onNavigateToProfile={(tab = 'profile') => {
                    setActiveTab(typeof tab === 'string' ? tab : 'profile');
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  onNavigateToSettings={() => setActiveTab('settings')}
                  onNavigateToNotifications={() => setActiveTab('notifications')}
                  onNavigateToWishlist={onNavigateToWishlist}
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
                style={styles.signInHeaderBtn || styles.btnPrimary}
                onPress={onNavigateToLogin}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Sign In"
              >
                <BootstrapIcon name="person" size={15} color="#FFFFFF" />
                <Text style={styles.signInHeaderBtnText || styles.btnPrimaryText}>Sign In</Text>
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
                    } else if (item.id === 'booking') {
                      onNavigateToGarage?.();
                    } else if (item.id === 'customize') {
                      if (onNavigateToCustomizer) onNavigateToCustomizer();
                      else onNavigateToStore?.();
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
          {/* Main Content Canvas */}
          <View
            style={[
              styles.mainScroll,
              { maxWidth: 1360, width: '100%', alignSelf: 'center' },
              isDesktop && { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 60 },
              isTablet && { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 60 },
              isMobile && { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40 },
            ]}
          >
            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB: MY GARAGE (FLEET MANAGEMENT)                         */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'garage' && (
              <View>
                {/* Empty State or Motorcycles Cards Grid */}
                {motorcycles.length === 0 ? (
                  <View style={[styles.sectionCard, { paddingVertical: 48, alignItems: 'center' }]}>
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: isDarkMode ? 'rgba(77, 184, 150, 0.2)' : '#C8DDD3',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <BootstrapIcon name="tools" size={32} color={tokens.brandPrimary} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.textPrimary }}>
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
                      className="garage-register-btn"
                      style={{
                        backgroundColor: '#16A34A',
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 20,
                        cursor: 'pointer',
                      }}
                      onPress={handleOpenAddMotorcycle}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="plus-circle-fill" size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                        Register Your First Motorcycle
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.sectionCard, { marginBottom: 20 }]}>
                    {/* Standardized Header */}
                    <View
                      style={{
                        flexDirection: isSmallMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isSmallMobile ? 'flex-start' : 'center',
                        flexWrap: 'wrap',
                        gap: 16,
                        marginBottom: 20,
                      }}
                    >
                      {/* Left: Icon, Title, Count, Description */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.16)' : '#F0FDF4',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(22, 163, 74, 0.35)' : '#BBF7D0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="motorcycle" size={19} color="#16A34A" />
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: '700',
                                color: tokens.textPrimary,
                                letterSpacing: -0.2,
                              }}
                            >
                              My Garage Fleet
                            </Text>
                            <View
                              style={{
                                backgroundColor: isDarkMode ? '#1E293B' : '#133827',
                                paddingHorizontal: 9,
                                paddingVertical: 2.5,
                                borderRadius: 9999,
                              }}
                            >
                              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                                {motorcycles.length} {motorcycles.length === 1 ? 'Motorcycle' : 'Motorcycles'}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                            Manage registered bikes, update specs, odometer logs, and pit booking profiles
                          </Text>
                        </View>
                      </View>

                      {/* Right: Actions */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                          className="garage-register-btn"
                          style={{
                            backgroundColor: '#16A34A',
                            paddingHorizontal: 16,
                            paddingVertical: 8.5,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                          }}
                          onPress={handleOpenAddMotorcycle}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="plus-circle-fill" size={13} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>
                            Register Motorcycle
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Responsive Grid */}
                    <View
                      style={{
                        width: '100%',
                        ...(Platform.OS === 'web'
                          ? {
                              display: 'grid',
                              gridTemplateColumns: windowWidth >= 768 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                              gap: 20,
                            }
                          : {
                              flexDirection: isDesktop ? 'row' : 'column',
                              gap: 20,
                            }),
                      }}
                    >
                    {motorcycles.map((bike) => {
                      return (
                        <View
                          key={bike.motorcycle_id}
                          className="garage-fleet-card"
                          style={{
                            width: '100%',
                            borderRadius: 24,
                            borderWidth: 1.5,
                            borderColor: customerHeaderBorder,
                            overflow: 'hidden',
                            backgroundColor: customerHeaderBg,
                            boxShadow: isDarkMode ? '0 4px 18px rgba(0, 0, 0, 0.35)' : '0 4px 18px rgba(0, 0, 0, 0.18)',
                            elevation: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          {/* 1. Upper Image Showcase Section */}
                          <View
                            style={{
                              position: 'relative',
                              width: '100%',
                              height: 230,
                              backgroundColor: '#FFFFFF',
                              borderTopLeftRadius: 22,
                              borderTopRightRadius: 22,
                              overflow: 'hidden',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingHorizontal: 16,
                              paddingTop: 12,
                              paddingBottom: 22,
                            }}
                          >
                            {/* Ambient showroom soft floor radial gradient */}
                            <View
                              style={[
                                StyleSheet.absoluteFillObject,
                                Platform.OS === 'web'
                                  ? {
                                      backgroundImage:
                                        'radial-gradient(ellipse at 50% 86%, rgba(15, 23, 42, 0.07) 0%, rgba(15, 23, 42, 0.015) 50%, transparent 72%)',
                                    }
                                  : null,
                              ]}
                            />

                            {/* Registered Motorcycle Image */}
                            <Image
                              source={{
                                uri:
                                  bike.photo_url ||
                                  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=900&q=80',
                              }}
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                              resizeMode="contain"
                            />

                            {/* Top Badges Row Floating Over Photo */}
                            <View
                              style={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                right: 12,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                zIndex: 5,
                              }}
                            >
                              {/* Left Compact Reference & Engine-Size Labels */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View
                                  style={{
                                    backgroundColor: isDarkMode ? 'rgba(17, 23, 21, 0.88)' : 'rgba(24, 26, 29, 0.92)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    paddingHorizontal: 11,
                                    paddingVertical: 4.5,
                                    borderRadius: 9999,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: '700',
                                      color: '#FFFFFF',
                                      letterSpacing: 0.4,
                                    }}
                                  >
                                    REF: {bike.plate_number || 'N/A'}
                                  </Text>
                                </View>

                                <View
                                  style={{
                                    backgroundColor: isDarkMode ? 'rgba(17, 23, 21, 0.82)' : 'rgba(24, 26, 29, 0.92)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.16)',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4.5,
                                    borderRadius: 9999,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: '600',
                                      color: '#E2E8F0',
                                    }}
                                  >
                                    {bike.engine_cc ? `${bike.engine_cc} cc` : '150 cc'}
                                  </Text>
                                </View>
                              </View>

                              {/* Right Status / Set Primary Action Badge */}
                              {bike.is_primary ? (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    paddingHorizontal: 11,
                                    paddingVertical: 4.5,
                                    borderRadius: 9999,
                                    borderWidth: 1.5,
                                    backgroundColor: 'rgba(28, 19, 5, 0.92)',
                                    borderColor: '#F59E0B',
                                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
                                  }}
                                >
                                  <BootstrapIcon name="star-fill" size={10.5} color="#FBBF24" />
                                  <Text
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: '700',
                                      color: '#FEF3C7',
                                      letterSpacing: 0.2,
                                    }}
                                  >
                                    Primary Ride
                                  </Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => handleSetPrimaryBike(bike)}
                                  activeOpacity={0.8}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 11,
                                    paddingVertical: 4.5,
                                    borderRadius: 9999,
                                    borderWidth: 1.5,
                                    backgroundColor: isDarkMode ? 'rgba(17, 23, 21, 0.88)' : 'rgba(24, 26, 29, 0.92)',
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
                                  }}
                                >
                                  <BootstrapIcon name="star" size={10.5} color="#CBDCEE" />
                                  <Text
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: '600',
                                      color: '#CBDCEE',
                                    }}
                                  >
                                    Set Primary
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Center Pagination Indicator Dots Neatly Positioned Below Image */}
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 8,
                                left: 0,
                                right: 0,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 5,
                                zIndex: 5,
                              }}
                            >
                              <View style={{ width: 14, height: 3.5, borderRadius: 2, backgroundColor: customerHeaderBg }} />
                              <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                              <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                              <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                            </View>
                          </View>

                          {/* 2. Lower Information Section (Customer Header Color #EA580C) */}
                          <View
                            style={{
                              flex: 1,
                              paddingHorizontal: 22,
                              paddingTop: 18,
                              paddingBottom: 22,
                              backgroundColor: customerHeaderBg,
                              borderBottomLeftRadius: 22,
                              borderBottomRightRadius: 22,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                          >
                            {/* Upper Details Group */}
                            <View>
                              {/* Motorcycle Name & Nickname Label */}
                              <View
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 10,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 21,
                                    fontWeight: '600',
                                    color: '#FFFFFF',
                                    letterSpacing: -0.4,
                                    flex: 1,
                                  }}
                                  numberOfLines={1}
                                >
                                  {bike.brand} {bike.model}
                                </Text>

                                {bike.nickname ? (
                                  <View
                                    style={{
                                      borderWidth: 1.5,
                                      borderColor: 'rgba(255, 255, 255, 0.35)',
                                      backgroundColor: 'transparent',
                                      paddingHorizontal: 11,
                                      paddingVertical: 3.5,
                                      borderRadius: 9999,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11.5,
                                        fontWeight: '700',
                                        color: '#FFFFFF',
                                        letterSpacing: 0.2,
                                      }}
                                    >
                                      "{bike.nickname}"
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              {/* Secondary Metadata Line */}
                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: '500',
                                  color: '#94A3B8',
                                  lineHeight: 18,
                                  marginTop: 4,
                                }}
                                numberOfLines={1}
                              >
                                {bike.engine_cc ? `${bike.engine_cc} cc` : '150 cc'} · {bike.year || '2026'} · {bike.color ? `${bike.color} · ` : ''}{bike.odometer ? (String(bike.odometer).includes('km') ? bike.odometer : `${bike.odometer} km`) : '0 km'}
                              </Text>

                              {/* Compact Service-Readiness Indicator */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                                <BootstrapIcon name="check-circle-fill" size={12.5} color="#38BDF8" />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: '#38BDF8',
                                    fontWeight: '600',
                                    lineHeight: 16,
                                  }}
                                >
                                  {bike.notes || 'Pit service ready · Compatible specs verified'}
                                </Text>
                              </View>
                            </View>

                            {/* Lower Action & Odometer Group */}
                            <View style={{ marginTop: 14 }}>
                              {/* Subtle Divider */}
                              <View
                                style={{
                                  height: 1,
                                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                  marginBottom: 12,
                                }}
                              />

                              {/* Clearly Labeled Odometer Reading and Edit/Delete Actions Row */}
                              <View
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: 14,
                                }}
                              >
                                <View>
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color: '#64748B',
                                      fontWeight: '600',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.6,
                                    }}
                                  >
                                    ODOMETER LOG
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 17,
                                      fontWeight: '600',
                                      color: '#FFFFFF',
                                      marginTop: 2,
                                    }}
                                  >
                                    {bike.odometer ? (String(bike.odometer).includes('km') ? bike.odometer : `${bike.odometer} km`) : '0 km'}
                                  </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <TouchableOpacity
                                    onPress={() => handleOpenEditMotorcycle(bike)}
                                    style={{
                                      cursor: 'pointer',
                                      paddingVertical: 5,
                                      paddingHorizontal: 10,
                                      borderRadius: 8,
                                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <BootstrapIcon name="pencil-square" size={12} color="#38BDF8" />
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: '600',
                                        color: '#38BDF8',
                                        textDecorationLine: 'underline',
                                      }}
                                    >
                                      Edit Specs
                                    </Text>
                                  </TouchableOpacity>

                                  <Text style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: 10 }}>•</Text>

                                  <TouchableOpacity
                                    onPress={() => handlePromptDeleteBike(bike)}
                                    style={{
                                      cursor: 'pointer',
                                      paddingVertical: 5,
                                      paddingHorizontal: 9,
                                      borderRadius: 8,
                                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <BootstrapIcon name="trash3" size={12} color="#FCA5A5" />
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: '600',
                                        color: '#FCA5A5',
                                        textDecorationLine: 'underline',
                                      }}
                                    >
                                      Delete
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Primary Action: Full-Width Book Pit Service Button */}
                              <TouchableOpacity
                                className="garage-book-btn"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderRadius: 9999,
                                  width: '100%',
                                  paddingVertical: 13,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)',
                                  cursor: 'pointer',
                                }}
                                onPress={onNavigateToGarage}
                                activeOpacity={0.9}
                              >
                                <Text
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: '700',
                                    color: customerHeaderBg,
                                    letterSpacing: 0.2,
                                  }}
                                >
                                  Book Pit Service
                                </Text>
                                <BootstrapIcon name="arrow-right-short" size={18} color={customerHeaderBg} />
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
                    <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.textPrimary }}>
                      Order History ({orders.length})
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Submit Feedback / Report Button */}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: tokens.bgSub,
                          borderWidth: 1,
                          borderColor: tokens.border,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          height: 38,
                          cursor: 'pointer',
                        }}
                        onPress={() => {
                          setReportContextOrder(null);
                          setIsSubmitReportModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="chat-square-dots" size={13} color="#EA580C" />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textPrimary }}>
                          Submit Feedback
                        </Text>
                      </TouchableOpacity>

                      {/* Category Dropdown */}
                      <View style={{ position: 'relative', zIndex: 1000 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: orderFilter !== 'All' ? (isDarkMode ? 'rgba(77, 184, 150, 0.2)' : '#C8DDD3') : (isDarkMode ? '#1C2422' : '#FFFFFF'),
                            borderWidth: 1.5,
                            borderColor: orderFilter !== 'All' ? tokens.brandPrimary : tokens.border,
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
                            color={orderFilter !== 'All' ? tokens.brandPrimary : tokens.textMuted}
                          />
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: '600',
                              color: orderFilter !== 'All' ? tokens.brandPrimary : tokens.textPrimary,
                            }}
                          >
                            {orderFilter === 'All' ? 'Category: All' : `Category: ${orderFilter}`}
                          </Text>
                          <BootstrapIcon
                            name={isOrderFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                            size={11}
                            color={orderFilter !== 'All' ? tokens.brandPrimary : tokens.textMuted}
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
                                        ? (isDarkMode ? 'rgba(77, 184, 150, 0.2)' : '#F0FDF4')
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
                                            ? tokens.brandPrimary
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
                                          fontWeight: '600',
                                          color: isActive ? tokens.brandPrimary : tokens.textPrimary,
                                        }}
                                      >
                                        {item.label}
                                      </Text>
                                    </View>
                                    <View
                                      style={{
                                        backgroundColor: isActive
                                          ? (isDarkMode ? 'rgba(77, 184, 150, 0.25)' : '#C8DDD3')
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
                                          fontWeight: '600',
                                          color: isActive ? (isDarkMode ? tokens.brandPrimary : '#EA580C') : tokens.textMuted,
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
                    <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.textPrimary, marginTop: 12 }}>
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
                            <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.textPrimary }}>
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
                                  fontWeight: '600',
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
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E' }}>
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
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                                    Track Live
                                  </Text>
                                </TouchableOpacity>
                              )
                            )}

                            {o.status === 'Delivered' && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  style={[
                                    styles.addBtnPrimary,
                                    {
                                      paddingVertical: 7,
                                      paddingHorizontal: 12,
                                      backgroundColor: o.is_rated ? '#FEF3C7' : '#EA580C',
                                      borderColor: o.is_rated ? '#FDE68A' : '#EA580C',
                                      borderWidth: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                    },
                                  ]}
                                  onPress={() => {
                                    setSelectedOrderForRating(o);
                                    setIsRateOrderModalOpen(true);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <BootstrapIcon
                                    name={o.is_rated ? 'star-fill' : 'star'}
                                    size={12}
                                    color={o.is_rated ? '#D97706' : '#FFFFFF'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '600',
                                      color: o.is_rated ? '#92400E' : '#FFFFFF',
                                    }}
                                  >
                                    {o.is_rated ? 'Rated ★' : 'Rate Order'}
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={{
                                    paddingVertical: 7,
                                    paddingHorizontal: 10,
                                    backgroundColor: tokens.bgSub,
                                    borderWidth: 1,
                                    borderColor: tokens.border,
                                    borderRadius: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                  onPress={() => {
                                    setReportContextOrder(o);
                                    setIsSubmitReportModalOpen(true);
                                  }}
                                  activeOpacity={0.8}
                                  title="Report an issue with this order"
                                >
                                  <BootstrapIcon name="flag" size={12} color={tokens.textMuted} />
                                  <Text style={{ fontSize: 11.5, fontWeight: '500', color: tokens.textMuted }}>
                                    Report
                                  </Text>
                                </TouchableOpacity>
                              </View>
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
                              <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.textPrimary }}>
                                ₱{(Number(item.price || 0) * (item.quantity || 1)).toLocaleString()}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                            Payment: <Text style={{ fontWeight: '700', color: tokens.textPrimary }}>{o.paymentMethod || 'COD'}</Text> • Total: <Text style={{ fontWeight: '600', color: tokens.brandPrimary, fontSize: 14 }}>₱{getOrderGrandTotal(o).toLocaleString()}</Text>
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
                              <BootstrapIcon name="arrow-repeat" size={12} color={tokens.brandPrimary} />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: tokens.brandPrimary }}>Buy Again</Text>
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
            {/* TAB 4: RIDER & BIKE PROFILE (Inspiration UI Design)           */}
            {/* ───────────────────────────────────────────────────────── */}
            {/* ───────────────────────────────────────────────────────── */}
            {/* TAB 4: RIDER & BIKE PROFILE                               */}
            {/* ───────────────────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  maxWidth: 1040,
                  marginHorizontal: 'auto',
                  width: '100%',
                }}
              >
                {/* 1. Compact, Modern Profile Header Card */}
                <View
                  style={{
                    backgroundColor: isDarkMode ? tokens.cardBg : '#FFFFFF',
                    borderColor: tokens.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingVertical: 18,
                    paddingHorizontal: isSmallMobile ? 16 : 22,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'center' : 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  {/* Left: Avatar + Visual Grouping of Customer Identity */}
                  <View
                    style={{
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: 'center',
                      gap: 16,
                      flex: 1,
                      width: isMobile ? '100%' : 'auto',
                    }}
                  >
                    {/* Avatar Container with Camera Action Badge */}
                    <View style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: isDarkMode ? '#24272B' : '#EA580C',
                          overflow: 'hidden',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2.5,
                          borderColor: isDarkMode ? tokens.border : '#FFFFFF',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)',
                        }}
                      >
                        {currentUser?.avatar || currentUser?.photoUri ? (
                          <Image
                            source={{ uri: currentUser?.avatar || currentUser?.photoUri }}
                            style={{ width: 72, height: 72, borderRadius: 36 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <BootstrapIcon name="person-fill" size={36} color="#FFFFFF" />
                        )}
                      </View>

                      {/* Camera / Upload Badge Button */}
                      <TouchableOpacity
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: isDarkMode ? '#1A2320' : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: tokens.brandPrimary,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                          cursor: 'pointer',
                        }}
                        onPress={handleUploadAvatar}
                        accessibilityLabel="Upload new photo"
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="camera-fill" size={11} color={tokens.brandPrimary} />
                      </TouchableOpacity>
                    </View>

                    {/* Customer Info Stack (Name, Badge, Headline, Location) */}
                    <View
                      style={{
                        flex: 1,
                        alignItems: isMobile ? 'center' : 'flex-start',
                        textAlign: isMobile ? 'center' : 'left',
                      }}
                    >
                      {/* Name Row with Real Verified Badge */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          justifyContent: isMobile ? 'center' : 'flex-start',
                          gap: 8,
                          marginBottom: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 18.5,
                            fontWeight: '600',
                            color: tokens.textPrimary,
                            letterSpacing: -0.2,
                          }}
                        >
                          {lastName && firstName
                            ? `${lastName}, ${firstName}`
                            : (name || currentUser?.name || currentUser?.fullName || 'Motorcycle Customer')}
                        </Text>

                        {/* Verified Customer Badge (Rendered ONLY when real account data supports it) */}
                        {isVerifiedCustomer && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: tokens.statusSuccessBg,
                              borderColor: tokens.statusSuccessBorder,
                              borderWidth: 1,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 5,
                            }}
                          >
                            <BootstrapIcon name="patch-check-fill" size={11} color="#16A34A" />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: tokens.statusSuccessText,
                                letterSpacing: 0.1,
                              }}
                            >
                              Verified Customer
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Customer Headline / Bio */}
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '500',
                          color: tokens.textSecondary,
                          marginBottom: 5,
                          textAlign: isMobile ? 'center' : 'left',
                        }}
                      >
                        {bio || currentUser?.bio || 'Motorcycle Enthusiast & Customer'}
                      </Text>

                      {/* Location & Metadata Row */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          justifyContent: isMobile ? 'center' : 'flex-start',
                          gap: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <BootstrapIcon name="geo-alt-fill" size={11} color={tokens.brandPrimary} />
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: '500',
                              color: tokens.textMuted,
                            }}
                          >
                            {city ? `${city}, ${country || 'Philippines'}` : (country || 'City of Naga, Philippines')}
                          </Text>
                        </View>

                        {Boolean(currentUser?.memberSince) && (
                          <Text style={{ fontSize: 12, color: tokens.textMuted }}>
                            • Member since {currentUser.memberSince}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Right: Primary & Secondary Actions */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                      width: isMobile ? '100%' : 'auto',
                      justifyContent: isMobile ? 'center' : 'flex-end',
                    }}
                  >
                    {/* Primary Action: Edit Profile */}
                    <TouchableOpacity
                      style={[
                        styles.btnPrimary,
                        {
                          paddingVertical: 8,
                          paddingHorizontal: 15,
                          borderRadius: 8,
                          minHeight: 35,
                        },
                      ]}
                      onPress={() => setIsEditingPersonalInfo(!isEditingPersonalInfo)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon
                        name={isEditingPersonalInfo ? 'x-lg' : 'pencil-square'}
                        size={12.5}
                        color="#FFFFFF"
                      />
                      <Text style={styles.btnPrimaryText}>
                        {isEditingPersonalInfo ? 'Cancel Editing' : 'Edit Profile'}
                      </Text>
                    </TouchableOpacity>

                    {/* Secondary Destructive Action: Remove Photo */}
                    {isUploadedAvatar && (
                      <TouchableOpacity
                        onPress={handleRemoveAvatar}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingVertical: 7,
                          paddingHorizontal: 11,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.28)' : '#FECACA',
                          cursor: 'pointer',
                          minHeight: 35,
                        }}
                        activeOpacity={0.7}
                      >
                        <BootstrapIcon name="trash" size={12} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                          Remove Photo
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 2. Personal Information Card (Standardized 2-Column Responsive Layout) */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      padding: isSmallMobile ? 16 : 20,
                      marginBottom: 0,
                      borderRadius: 14,
                    },
                  ]}
                >
                  {/* Standardized Card Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="person-vcard" size={13.5} color={tokens.brandPrimary} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontSize: 15.5,
                            fontWeight: '600',
                            color: tokens.textPrimary,
                            letterSpacing: -0.2,
                          }}
                        >
                          Personal Information
                        </Text>
                        <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 1 }}>
                          Customer identity and contact records
                        </Text>
                      </View>
                    </View>

                    {/* Standardized Edit Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.btnSecondary,
                        {
                          paddingVertical: 7,
                          paddingHorizontal: 13,
                          borderRadius: 8,
                          minHeight: 34,
                        },
                      ]}
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
                    /* Read-Only Responsive 2-Column Grid with Subtle Dividers */
                    <View style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Row 1: First Name & Last Name */}
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16, paddingVertical: 10 }}>
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

                      {/* Subtle Row Divider */}
                      <View style={{ height: 1, backgroundColor: tokens.borderLight }} />

                      {/* Row 2: City & Email Address */}
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16, paddingVertical: 10 }}>
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

                      {/* Subtle Row Divider */}
                      <View style={{ height: 1, backgroundColor: tokens.borderLight }} />

                      {/* Row 3: Phone & Country */}
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16, paddingVertical: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                            Contact Phone
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

                      {/* Subtle Row Divider */}
                      <View style={{ height: 1, backgroundColor: tokens.borderLight }} />

                      {/* Row 4: Bio / Headline */}
                      <View style={{ paddingVertical: 10 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Rider Bio / Headline
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.textPrimary, lineHeight: 20 }}>
                          {bio || 'Motorcycle Enthusiast & Customer'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* Edit Personal Info Form Mode */
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                      </View>

                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
                            Contact Phone
                          </Text>
                          <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="09614904841"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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

                        <View style={{ flex: 1.5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
                            Rider Bio / Headline
                          </Text>
                          <TextInput
                            value={bio}
                            onChangeText={setBio}
                            placeholder="e.g. Motorcycle Enthusiast & Customer"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                      </View>

                      {/* Form Actions */}
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
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
                              <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                              <Text style={styles.btnPrimaryText}>Save Changes</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* 3. Garage & Delivery Information Card */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      padding: isSmallMobile ? 16 : 20,
                      marginBottom: 0,
                      borderRadius: 14,
                    },
                  ]}
                >
                  {/* Standardized Card Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="wrench-adjustable" size={13.5} color={tokens.brandPrimary} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontSize: 15.5,
                            fontWeight: '600',
                            color: tokens.textPrimary,
                            letterSpacing: -0.2,
                          }}
                        >
                          Garage & Delivery Information
                        </Text>
                        <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 1 }}>
                          Registered primary ride and default shipping address
                        </Text>
                      </View>
                    </View>

                    {/* Standardized Edit Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.btnSecondary,
                        {
                          paddingVertical: 7,
                          paddingHorizontal: 13,
                          borderRadius: 8,
                          minHeight: 34,
                        },
                      ]}
                      onPress={() => setIsEditingGarageInfo(!isEditingGarageInfo)}
                      activeOpacity={0.8}
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
                    <View style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* ─── Part A: Primary Motorcycle ─── */}
                      <View style={{ marginBottom: 16 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <BootstrapIcon name="motorcycle" size={13} color={tokens.brandPrimary} />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: tokens.brandPrimary,
                                textTransform: 'uppercase',
                                letterSpacing: 0.7,
                              }}
                            >
                              Primary Motorcycle
                            </Text>
                          </View>

                          <View
                            style={{
                              backgroundColor: tokens.statusSuccessBg,
                              borderWidth: 1,
                              borderColor: tokens.statusSuccessBorder,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 5,
                            }}
                          >
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.statusSuccessText }}>
                              Active Fleet Ride
                            </Text>
                          </View>
                        </View>

                        {/* Motorcycle Highlight Card */}
                        <View
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderColor: tokens.border,
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 14,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: isSmallMobile ? 'column' : 'row',
                              alignItems: isSmallMobile ? 'flex-start' : 'center',
                              gap: 14,
                            }}
                          >
                            {/* Motorcycle Thumbnail or Silhouette */}
                            {primaryMotorcycle?.photo_url ? (
                              <Image
                                source={{ uri: primaryMotorcycle.photo_url }}
                                style={{
                                  width: 72,
                                  height: 52,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View
                                style={{
                                  width: 60,
                                  height: 52,
                                  borderRadius: 8,
                                  backgroundColor: isDarkMode ? '#1E2824' : '#FFF7ED',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderWidth: 1,
                                  borderColor: tokens.brandBorder,
                                  flexShrink: 0,
                                }}
                              >
                                <BootstrapIcon name="motorcycle" size={26} color="#16A34A" />
                              </View>
                            )}

                            {/* Motorcycle Specs & Highlighted Metrics */}
                            <View style={{ flex: 1, width: '100%' }}>
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: '600',
                                  color: tokens.textPrimary,
                                  marginBottom: 6,
                                }}
                              >
                                {primaryMotorcycle?.brand || bikeBrand || 'No Bike Registered'}{' '}
                                {primaryMotorcycle?.model || bikeModel || ''}
                              </Text>

                              <View
                                style={{
                                  flexDirection: 'row',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                  alignItems: 'center',
                                }}
                              >
                                {/* Plate / Registration */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase' }}>
                                    Plate:
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                                      paddingHorizontal: 7,
                                      paddingVertical: 1.5,
                                      borderRadius: 5,
                                      borderWidth: 1,
                                      borderColor: tokens.border,
                                    }}
                                  >
                                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: tokens.textPrimary, letterSpacing: 0.5 }}>
                                      {primaryMotorcycle?.plate_number || bikePlate || 'N/A'}
                                    </Text>
                                  </View>
                                </View>

                                {/* Odometer Reading */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <BootstrapIcon name="speedometer2" size={11} color={tokens.textMuted} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase' }}>
                                    Odometer:
                                  </Text>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                                    {primaryMotorcycle?.odometer || bikeOdo || '0 km'}
                                  </Text>
                                </View>

                                {/* Displacement / Year */}
                                {(Boolean(primaryMotorcycle?.year) || Boolean(primaryMotorcycle?.engine_cc)) && (
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textMuted }}>
                                    • {primaryMotorcycle?.year ? `${primaryMotorcycle.year} ` : ''}
                                    {primaryMotorcycle?.engine_cc ? `${primaryMotorcycle.engine_cc}cc` : ''}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>

                          {/* Next Maintenance Information (Rendered ONLY if real maintenance/booking data is available) */}
                          {Boolean(upcomingMaintenance) && (
                            <View
                              style={{
                                marginTop: 12,
                                paddingTop: 10,
                                borderTopWidth: 1,
                                borderTopColor: tokens.border,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 8,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <BootstrapIcon name="tools" size={12} color="#16A34A" />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                                  Next Service:{' '}
                                  <Text style={{ color: tokens.brandPrimary }}>
                                    {upcomingMaintenance.service_type || upcomingMaintenance.serviceType || 'Routine Maintenance'}
                                  </Text>
                                </Text>
                                <Text style={{ fontSize: 11.5, color: tokens.textMuted }}>
                                  ({formatBookingDate(upcomingMaintenance.booking_date || upcomingMaintenance.date)})
                                </Text>
                              </View>

                              <View
                                style={{
                                  backgroundColor: tokens.statusSuccessBg,
                                  borderWidth: 1,
                                  borderColor: tokens.statusSuccessBorder,
                                  paddingHorizontal: 6,
                                  paddingVertical: 1.5,
                                  borderRadius: 4,
                                }}
                              >
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.statusSuccessText }}>
                                  {upcomingMaintenance.status || 'Confirmed'}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Subtle Section Divider */}
                      <View style={{ height: 1, backgroundColor: tokens.border, marginVertical: 14 }} />

                      {/* ─── Part B: Default Delivery Destination ─── */}
                      <View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 10,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <BootstrapIcon name="geo-alt-fill" size={12.5} color={tokens.brandPrimary} />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: tokens.brandPrimary,
                                textTransform: 'uppercase',
                                letterSpacing: 0.7,
                              }}
                            >
                              Default Delivery Destination
                            </Text>
                          </View>

                          <View
                            style={{
                              backgroundColor: tokens.statusNeutralBg,
                              borderWidth: 1,
                              borderColor: tokens.statusNeutralBorder,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 5,
                            }}
                          >
                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.statusNeutralText }}>
                              Doorstep Shipping
                            </Text>
                          </View>
                        </View>

                        {/* Scannable Delivery Details Grid with Dividers */}
                        <View style={{ display: 'flex', flexDirection: 'column' }}>
                          <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16, paddingVertical: 8 }}>
                            <View style={{ flex: 1.5 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                                Street Address
                              </Text>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary, lineHeight: 20 }}>
                                {address || 'Purok Avocado 4, Inoburan, City of Naga, Cebu'}
                              </Text>
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                                City / Region
                              </Text>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary, lineHeight: 20 }}>
                                {city || 'City of Naga'}
                              </Text>
                            </View>
                          </View>

                          <View style={{ height: 1, backgroundColor: tokens.borderLight }} />

                          <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 16, paddingVertical: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                                Delivery Contact Phone
                              </Text>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary }}>
                                {phone || '09614904841'}
                              </Text>
                            </View>

                            <View style={{ flex: 1.5 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                                Delivery Instructions
                              </Text>
                              <Text style={{ fontSize: 13.5, fontWeight: '500', color: tokens.textSecondary, lineHeight: 19 }}>
                                {deliveryNotes || 'Leave at front gate / contact on delivery'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* Edit Garage & Delivery Mode */
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Motorcycle Specs */}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                        Primary Motorcycle Details
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                        {MOTORCYCLE_BRANDS.slice(0, 6).map((b) => (
                          <TouchableOpacity
                            key={b}
                            onPress={() => setBikeBrand(b)}
                            style={{
                              paddingHorizontal: 9,
                              paddingVertical: 4,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: bikeBrand === b ? tokens.brandPrimary : tokens.border,
                              backgroundColor: bikeBrand === b ? tokens.brandLight : tokens.bgSub,
                              cursor: 'pointer',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: bikeBrand === b ? '700' : '500',
                                color: bikeBrand === b ? tokens.brandPrimary : tokens.textSecondary,
                              }}
                            >
                              {b}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
                            Brand
                          </Text>
                          <TextInput
                            value={bikeBrand}
                            onChangeText={setBikeBrand}
                            placeholder="e.g. Yamaha"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1.2 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
                            Model & Spec
                          </Text>
                          <TextInput
                            value={bikeModel}
                            onChangeText={setBikeModel}
                            placeholder="e.g. NMAX 155"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, marginTop: 4 }}>
                        Delivery Destination & Instructions
                      </Text>
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 2 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
                            Delivery Street Address
                          </Text>
                          <TextInput
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Street, Barangay, City, Province"
                            placeholderTextColor={tokens.textMuted}
                            style={[styles.inputBox, { backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF' }]}
                          />
                        </View>
                        <View style={{ flex: 1.5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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

                      {/* Form Actions */}
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
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
                              <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                              <Text style={styles.btnPrimaryText}>Save Details</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* 4. Account Security & Credentials Card */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      padding: isSmallMobile ? 16 : 20,
                      marginBottom: 0,
                      borderRadius: 14,
                    },
                  ]}
                >
                  {/* Standardized Card Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          backgroundColor: tokens.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: tokens.brandBorder,
                        }}
                      >
                        <BootstrapIcon name="shield-lock-fill" size={13.5} color={tokens.brandPrimary} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontSize: 15.5,
                            fontWeight: '600',
                            color: tokens.textPrimary,
                            letterSpacing: -0.2,
                          }}
                        >
                          Account Security & Credentials
                        </Text>
                        <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 1 }}>
                          Authentication status and session protection
                        </Text>
                      </View>
                    </View>

                    {/* Standardized Change Password Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.btnSecondary,
                        {
                          paddingVertical: 7,
                          paddingHorizontal: 13,
                          borderRadius: 8,
                          minHeight: 34,
                        },
                      ]}
                      onPress={() => setIsEditingSecurity(!isEditingSecurity)}
                      activeOpacity={0.8}
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
                      {/* Column 1: Login Email */}
                      <View style={{ flex: 1.2, minWidth: isSmallMobile ? '100%' : 180 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Login Email
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary, marginBottom: 4 }}>
                          {currentUser?.email || 'customer@mototrack.com'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <BootstrapIcon name="check-circle-fill" size={11} color="#16A34A" />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.textMuted }}>
                            Primary login identity
                          </Text>
                        </View>
                      </View>

                      {/* Column 2: Password Status (Never exposes actual credentials) */}
                      <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 150 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Password Status
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: tokens.textPrimary, letterSpacing: 1, marginBottom: 4 }}>
                          ••••••••••••
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.textMuted }}>
                          Encrypted (SHA-256)
                        </Text>
                      </View>

                      {/* Column 3: Security Protection */}
                      <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 150 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Security Protection
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <BootstrapIcon name="shield-check" size={13} color="#16A34A" />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#16A34A' }}>
                            Protected (Active)
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.textMuted }}>
                          Session monitored
                        </Text>
                      </View>

                      {/* Column 4: Account Tier */}
                      <View style={{ flex: 1, minWidth: isSmallMobile ? '100%' : 140 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                          Account Tier
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          {isVerifiedCustomer && (
                            <BootstrapIcon name="patch-check-fill" size={12} color="#16A34A" />
                          )}
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '600',
                              color: isVerifiedCustomer ? tokens.brandPrimary : tokens.textSecondary,
                            }}
                          >
                            {isVerifiedCustomer ? 'Verified Customer' : 'Standard Customer'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: tokens.textMuted }}>
                          {currentUser?.memberSince ? `Member since ${currentUser.memberSince}` : 'Active customer profile'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    /* Edit Password Form Mode */
                    <View style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <View style={{ flexDirection: isSmallMobile ? 'column' : 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                              style={{ position: 'absolute', right: 12, padding: 4, cursor: 'pointer' }}
                              onPress={() => setShowCurrentPwd(!showCurrentPwd)}
                            >
                              <BootstrapIcon name={showCurrentPwd ? 'eye-slash' : 'eye'} size={14} color={tokens.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                              style={{ position: 'absolute', right: 12, padding: 4, cursor: 'pointer' }}
                              onPress={() => setShowNewPwd(!showNewPwd)}
                            >
                              <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={14} color={tokens.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textSecondary, marginBottom: 5 }}>
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
                              style={{ position: 'absolute', right: 12, padding: 4, cursor: 'pointer' }}
                              onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                            >
                              <BootstrapIcon name={showConfirmPwd ? 'eye-slash' : 'eye'} size={14} color={tokens.textMuted} />
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
                              <BootstrapIcon name="shield-lock" size={13} color="#FFFFFF" />
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
                          <BootstrapIcon name="bell-fill" size={18} color={tokens.brandPrimary} />
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.textPrimary, letterSpacing: -0.3 }}>
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
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF' }}>
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
                            <BootstrapIcon name="check2-all" size={13} color={tokens.brandPrimary} />
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
                              backgroundColor: isSelected ? tokens.brandPrimary : tokens.bgSub,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: isSelected ? tokens.brandPrimary : tokens.border,
                              cursor: 'pointer',
                            }}
                            onPress={() => setNotifFilter(f.id)}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
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
                        <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.textPrimary }}>
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
                                  fontWeight: '600',
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
                                    backgroundColor: isDarkMode ? 'rgba(77, 184, 150, 0.2)' : 'rgba(0, 0, 0, 0.12)',
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderRadius: 8,
                                  }}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: '600', color: tokens.brandPrimary }}>
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
                              const metaTheme = getNotifTheme(n.type, n.category, n);
                              const actionLabel = getNotifActionLabel(n);

                              return (
                                <View
                                  key={n.id}
                                  style={{
                                    backgroundColor: isUnread
                                      ? (isDarkMode ? 'rgba(0, 0, 0, 0.14)' : '#FAF9F6')
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
                                                backgroundColor: '#EA580C',
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
                                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>
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
                        <BootstrapIcon name="person-vcard-fill" size={17} color={tokens.brandPrimary} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 16.5, fontWeight: '600', color: tokens.textPrimary, letterSpacing: -0.2 }}>
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
                        <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.textPrimary, marginTop: 3 }}>
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
                            <Text style={{ fontSize: 10, fontWeight: '600', color: tokens.statusSuccessText }}>Verified</Text>
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
                        <BootstrapIcon name="geo-alt-fill" size={12} color={tokens.brandPrimary} />
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
                          <BootstrapIcon name="key-fill" size={15} color={tokens.brandPrimary} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.textPrimary }}>
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
                                <Text style={{ fontSize: 11.5, fontWeight: '600', color: strengthColor }}>
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
                      <BootstrapIcon name="envelope-check-fill" size={15} color={tokens.brandPrimary} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.textPrimary }}>
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
                    <BootstrapIcon name="shield-lock" size={18} color={tokens.brandPrimary} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.textPrimary }}>
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
          </View>
        </View>
      </View>
      </ScrollView>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODALS                                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {/* ─── DETAILED SERVICE INSPECTION & QUOTATION MODAL ─── */}
      <Modal
        visible={Boolean(selectedBookingForModal)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedBookingForModal(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: tokens.bgCard,
              borderRadius: 20,
              width: '100%',
              maxWidth: 780,
              maxHeight: '90%',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 28,
              elevation: 12,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: tokens.border,
                backgroundColor: tokens.bgCard,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: tokens.brandLight,
                    borderWidth: 1,
                    borderColor: tokens.brandBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="file-earmark-text" size={20} color={tokens.brandPrimary} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.textPrimary, letterSpacing: -0.3 }}>
                    Booking Details & Quotation
                  </Text>
                  <Text style={{ fontSize: 12, color: tokens.textMuted, fontWeight: '600', marginTop: 2 }}>
                    REF: {activeModalBooking?.booking_id || activeModalBooking?.id}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedBookingForModal(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: tokens.bgSub,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={14} color={tokens.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Modal Scrollable Body */}
            <ScrollView
              style={{ flex: 1, backgroundColor: tokens.bgSub }}
              contentContainerStyle={{ padding: 22, paddingBottom: 28 }}
              showsVerticalScrollIndicator={true}
            >
              {activeModalBooking ? (
                <CustomerServiceBookingCard
                  booking={activeModalBooking}
                  onToast={showToast}
                  onUpdated={() => {
                    if (currentUser?.email || currentUser?.id || currentUser?.name || currentUser?.fullName) {
                      const userBks = garageService.getUserBookings(
                        currentUser.email,
                        currentUser.id,
                        currentUser.name || currentUser.fullName
                      );
                      setBookings(Array.isArray(userBks) ? userBks : []);
                    }
                  }}
                  defaultExpanded={true}
                  isModalView={true}
                  canCancel={[
                    'PENDING_REVIEW',
                    'APPROVED',
                    'SCHEDULED',
                    'AWAITING_CUSTOMER_APPROVAL',
                    'QUOTATION_SENT',
                    'AWAITING_DOWNPAYMENT',
                  ].includes(normalizeBookingStatus(activeModalBooking?.status))}
                  onCancel={() => {
                    const b = activeModalBooking;
                    setSelectedBookingForModal(null);
                    setBookingToCancel(b);
                    setIsCancelModalOpen(true);
                  }}
                  style={{
                    borderWidth: 0,
                    shadowOpacity: 0,
                    elevation: 0,
                    padding: 0,
                    backgroundColor: 'transparent',
                    marginBottom: 0,
                  }}
                />
              ) : null}
            </ScrollView>

            {/* Modal Footer */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: tokens.border,
                backgroundColor: tokens.bgCard,
              }}
            >
              <TouchableOpacity
                onPress={() => setSelectedBookingForModal(null)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: tokens.bgSub,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>Close Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
        isDark={isDarkMode}
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
        isDark={isDarkMode}
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
        message={`Are you sure you want to log out of your ${brandSettings.storeName || 'MotoTrack'} account?`}
        confirmText="Log Out"
        cancelText="Stay Logged In"
        type="danger"
        confirmIcon="box-arrow-right"
        isDark={isDarkMode}
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

      {/* Customer Delivered Order Rating & Review Modal */}
      <RateDeliveredOrderModal
        visible={isRateOrderModalOpen}
        order={selectedOrderForRating}
        currentUser={currentUser}
        onClose={() => {
          setIsRateOrderModalOpen(false);
          setSelectedOrderForRating(null);
        }}
        onSubmitSuccess={() => {
          refreshOrders();
        }}
      />

      {/* Customer Feedback & Issue Report Submission Modal */}
      <CustomerSubmitReportModal
        visible={isSubmitReportModalOpen}
        currentUser={currentUser}
        recentOrders={orders}
        recentBookings={bookings}
        initialOrder={reportContextOrder}
        onClose={() => {
          setIsSubmitReportModalOpen(false);
          setReportContextOrder(null);
        }}
        onSubmitSuccess={() => {
          showToast?.('Your report has been logged and sent to MotoTrack administrators.');
        }}
      />

    </SafeAreaView>
  );
}
