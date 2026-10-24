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
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { profileMobileStyles as defaultStyles, createProfileMobileStyles } from '../../../styles/profilePage.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { garageService } from '../../../services/bookings/garageService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { productService } from '../../../services/products/productService.js';
import { notificationService, stripEmojis } from '../../../services/notifications/notificationService.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { customizationService } from '../../../services/bookings/customizationService.js';
import { BootstrapIcon, BottomNavBar, ToastNotification, ToggleSwitch } from '../../../components/common';
import { LiveOrderTrackingMapModal, ConfirmModal, RegisterMotorcycleModal, EditCustomerSettingsModal, CompanyInfoModal, RateDeliveredOrderModal } from '../../../components/modals';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';

const FALLBACK_SHOP_PRODUCTS = [
  {
    id: 'rec-01',
    name: 'Brembo 4-Piston Monobloc Radial Caliper Gold Edition',
    price: 3450,
    compareAtPrice: 4200,
    brand: 'Brembo Racing',
    rating: 5.0,
    soldCount: '12.4K sold',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500',
    tag: 'On Trend',
    discount: '-18%',
  },
  {
    id: 'rec-02',
    name: 'Quick Tire 60/80-17 Racing Performance Tubeless',
    price: 850,
    compareAtPrice: 1250,
    brand: 'Quick Tires',
    rating: 4.9,
    soldCount: '28.6K sold',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500',
    tag: 'Best Seller',
    discount: '-32%',
  },
  {
    id: 'rec-03',
    name: 'Yoshimura R-77 Carbon Fiber Full Exhaust System',
    price: 4850,
    compareAtPrice: 6500,
    brand: 'Yoshimura Pro',
    rating: 4.9,
    soldCount: '8.7K sold',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500',
    tag: 'On Trend',
    discount: '-25%',
  },
  {
    id: 'rec-04',
    name: 'Racing Boy (RCB) Forged Adjustable CNC Alloy Levers',
    price: 1250,
    compareAtPrice: 1800,
    brand: 'RCB Official',
    rating: 4.8,
    soldCount: '19.2K sold',
    image: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=500',
    tag: 'Pre-order',
    discount: '-30%',
  },
  {
    id: 'rec-05',
    name: 'Motul 7100 4T 10W-40 100% Synthetic Engine Oil 1L',
    price: 680,
    compareAtPrice: 850,
    brand: 'Motul Pro Gear',
    rating: 5.0,
    soldCount: '45.1K sold',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?w=500',
    tag: 'Star Shop',
    discount: '-20%',
  },
  {
    id: 'rec-06',
    name: 'DID 520 High Strength Gold O-Ring Drive Chain 120L',
    price: 1850,
    compareAtPrice: 2400,
    brand: 'DID Racing',
    rating: 4.9,
    soldCount: '14.8K sold',
    image: 'https://images.unsplash.com/photo-1558981854-3252a1a89c89?w=500',
    tag: 'On Trend',
    discount: '-23%',
  },
];

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu' },
  { label: 'South Poblacion (Store)', address: "D'Blockchain Motorparts and Accessories, Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu" },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu' },
  { label: 'BGC Central, Taguig', address: '7th Ave & 28th St, Bonifacio Global City, Taguig' },
];

const ORDER_STATUS_FILTERS = ['All', 'Processing', 'Shipped', 'Delivered', 'To Review', 'Cancelled'];

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

const isOrderDelivered = (status) => {
  const s = String(status || '').toLowerCase().trim();
  return s === 'delivered' || s.includes('complete') || s === 'received';
};

const isOrderToReview = (order) => {
  if (!order) return false;
  const isDeliv = isOrderDelivered(order.status);
  const isRated = Boolean(order.is_rated || order.rating_data?.customer_rating || order.rating_data?.rated_at);
  return isDeliv && !isRated;
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

function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    const diffMs = Date.now() - d.getTime();
    if (isNaN(diffMs)) return 'Recently';

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

function formatFullDate(isoString) {
  if (!isoString) return 'Recent';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (_e) {
    return 'Recent';
  }
}

function formatNotifTime(dateStr) {
  return formatRelativeTime(dateStr);
}

function getCategoryConfig(notif) {
  if (!notif) return { label: 'Notice', icon: 'bell', bg: '#F4F3F0', color: '#6B6862' };
  const cat = String(notif.category || notif.type || '').toLowerCase();
  const title = String(notif.title || '').toLowerCase();
  const msg = String(notif.message || '').toLowerCase();

  // Cancelled order or booking
  if (title.includes('cancel') || msg.includes('cancel') || cat.includes('cancel')) {
    return {
      label: 'Order Cancelled',
      icon: 'x-circle-fill',
      bg: '#FEF2F2',
      color: '#DC2626',
    };
  }
  // Delivered order
  if (title.includes('deliver') || msg.includes('deliver') || cat.includes('deliver')) {
    return {
      label: 'Delivered',
      icon: 'check-circle-fill',
      bg: '#ECFDF5',
      color: '#059669',
    };
  }
  // Out for delivery / in transit
  if (title.includes('out for delivery') || msg.includes('out for delivery') || title.includes('shipped') || msg.includes('shipped')) {
    return {
      label: 'In Transit',
      icon: 'truck',
      bg: '#EFF6FF',
      color: '#2563EB',
    };
  }
  // Pitstop / Garage Booking
  if (cat.includes('booking') || cat.includes('service') || cat.includes('garage') || cat.includes('pit')) {
    return {
      label: 'Booking',
      icon: 'calendar-check',
      bg: '#FDF4E7',
      color: '#D97706',
    };
  }
  // Order general / dispatch
  if (cat.includes('order') || cat.includes('dispatch') || cat.includes('ship')) {
    return {
      label: 'Order',
      icon: 'box-seam',
      bg: '#EFF6FF',
      color: '#2563EB',
    };
  }
  // Payment
  if (cat.includes('payment') || cat.includes('paid') || cat.includes('spend')) {
    return {
      label: 'Payment',
      icon: 'credit-card-2-front',
      bg: '#ECFDF5',
      color: '#059669',
    };
  }
  // Stock / Inventory
  if (cat.includes('stock') || cat.includes('inventory') || cat.includes('restock')) {
    return {
      label: 'Inventory',
      icon: 'exclamation-diamond',
      bg: '#FEF2F2',
      color: '#DC2626',
    };
  }
  // System / Security
  if (cat.includes('security') || cat.includes('system') || cat.includes('alert')) {
    return {
      label: 'System',
      icon: 'shield-exclamation',
      bg: '#F3E8FF',
      color: '#7C3AED',
    };
  }
  // Promotion / Discount
  if (cat.includes('promo') || cat.includes('discount') || cat.includes('welcome')) {
    return {
      label: 'Promotion',
      icon: 'ticket-perforated',
      bg: '#FEF3C7',
      color: '#D97706',
    };
  }
  return {
    label: notif.categoryLabel || 'Notice',
    icon: notif.icon || 'bell',
    bg: '#F4F3F0',
    color: '#6B6862',
  };
}

function getNotifVisuals(typeOrNotif) {
  if (typeof typeOrNotif === 'object' && typeOrNotif !== null) {
    return getCategoryConfig(typeOrNotif);
  }
  return getCategoryConfig({ type: typeOrNotif });
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
  onNavigateToProductDetails,
  onLogout,
}) {
  const { currentUser, updateProfile, changePassword, changeEmail, logout } = useAuth();
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();
  const addToCart = cartCtx?.addToCart;
  const { isDarkMode, toggleDarkMode } = useTheme();
  const styles = useMemo(() => createProfileMobileStyles(isDarkMode), [isDarkMode]);
  const scrollViewRef = useRef(null);

  const wishlistCount = wishlistCtx?.wishlistCount || 0;
  const [shopProducts, setShopProducts] = useState(FALLBACK_SHOP_PRODUCTS);

  const resolveTabString = (tabInput) => {
    if (tabInput && typeof tabInput === 'object') return tabInput.tab;
    return tabInput;
  };

  const lastInitialTabPropRef = useRef(initialTab);

  // Active Tab: 'overview' | 'garage' | 'orders' | 'bookings' | 'notifications' | 'profile' | 'menu'
  const [activeTab, setActiveTab] = useState(() => {
    const raw = resolveTabString(initialTab);
    if (
      ['overview', 'garage', 'orders', 'bookings', 'notifications', 'profile', 'settings', 'menu'].includes(raw)
    ) {
      return raw;
    }
    return 'overview';
  });

  // Synchronously sync activeTab on prop changes before first paint to eliminate navigation glitch/flash
  if (initialTab !== lastInitialTabPropRef.current) {
    lastInitialTabPropRef.current = initialTab;
    const raw = resolveTabString(initialTab);
    if (
      raw &&
      ['overview', 'garage', 'orders', 'bookings', 'notifications', 'profile', 'settings', 'menu'].includes(raw) &&
      raw !== activeTab
    ) {
      setActiveTab(raw);
    }
  }

  useEffect(() => {
    const raw = resolveTabString(initialTab);
    if (
      raw &&
      ['overview', 'garage', 'orders', 'bookings', 'notifications', 'profile', 'settings', 'menu'].includes(raw)
    ) {
      setActiveTab(raw);
    }
  }, [initialTab]);

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

  // Orders Filter & Search
  const [orderFilter, setOrderFilter] = useState('All');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

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

  // Rate Delivered Order Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [orderToRate, setOrderToRate] = useState(null);

  const handleOpenRateModal = (order) => {
    setOrderToRate(order);
    setIsRateModalOpen(true);
  };

  // Motorcycle Fleet State
  const [motorcycles, setMotorcycles] = useState(() => motorcycleService.getMotorcycles(currentUser?.id));
  const [isMotorcycleModalOpen, setIsMotorcycleModalOpen] = useState(false);
  const [editingMotorcycle, setEditingMotorcycle] = useState(null);
  const [isDeleteBikeModalOpen, setIsDeleteBikeModalOpen] = useState(false);
  const [bikeToDelete, setBikeToDelete] = useState(null);
  const [viewingPhotoBike, setViewingPhotoBike] = useState(null);

  const resolveMotorcyclePhoto = (bike) => {
    if (!bike) return null;
    if (bike?.photo_url && String(bike.photo_url).trim()) return bike.photo_url.trim();
    if (bike?.photoUrl && String(bike.photoUrl).trim()) return bike.photoUrl.trim();
    if (bike?.image && String(bike.image).trim()) return bike.image.trim();
    if (bike?.motorcycle_photo_url && String(bike.motorcycle_photo_url).trim()) return bike.motorcycle_photo_url.trim();

    const brandLower = (bike?.brand || '').toLowerCase();
    const preset = MOTORCYCLE_PHOTO_PRESETS?.find((p) => brandLower.includes(p.brand.toLowerCase()));
    if (preset?.url) return preset.url;

    return null;
  };

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
      console.warn('[MobileProfilePage] Failed to fetch customizations:', err);
    } finally {
      setLoadingCustomizations(false);
    }
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

  // Orders State (initialized synchronously from local cache if present)
  const [orders, setOrders] = useState(() => {
    try {
      if (typeof orderService?.getLocalOrders === 'function') {
        const local = orderService.getLocalOrders();
        if (Array.isArray(local) && local.length > 0) {
          const uid = currentUser?.id || currentUser?.user_id;
          const cid = currentUser?.customer_id;
          const userLocal = local.filter((o) => {
            if (!uid && !cid) return true;
            return (
              (uid && (o.user_id === uid || o.userId === uid || o.customer_id === uid)) ||
              (cid && (o.customer_id === cid || o.customerId === cid))
            );
          });
          if (userLocal.length > 0) return userLocal;
        }
      }
    } catch (_e) {}
    return [];
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Notifications State
  const [notifications, setNotifications] = useState(() =>
    notificationService.getNotifications(currentUser?.id)
  );
  const [notifFilter, setNotifFilter] = useState('all');
  const [notifSearchQuery, setNotifSearchQuery] = useState('');
  const [expandedNotifIds, setExpandedNotifIds] = useState(() => new Set());

  const toggleNotifExpanded = (id, notif) => {
    if (notif && notif.status === 'unread') {
      notificationService.markCustomerAsRead(id);
      setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
    }
    setExpandedNotifIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredTabNotifications = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    return list.filter((n) => {
      if (notifFilter === 'unread' && n.status !== 'unread') return false;
      if (notifFilter === 'order' && n.type !== 'order') return false;
      if (notifFilter === 'booking' && n.type !== 'booking') return false;
      if (notifFilter === 'promo' && n.type !== 'promo' && n.type !== 'welcome') return false;

      if (notifSearchQuery.trim()) {
        const q = notifSearchQuery.toLowerCase();
        const t = (n.title || '').toLowerCase();
        const m = (n.message || '').toLowerCase();
        const c = (n.category || '').toLowerCase();
        return t.includes(q) || m.includes(q) || c.includes(q);
      }
      return true;
    });
  }, [notifications, notifFilter, notifSearchQuery]);

  const groupedNotifSections = useMemo(() => {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    const buckets = {
      thisWeek: [],
      thisMonth: [],
      earlier: [],
    };

    filteredTabNotifications.forEach((n) => {
      const timeVal = n.created_at || n.timestamp || n.date;
      const itemTime = timeVal ? new Date(timeVal).getTime() : now;
      const diff = now - itemTime;

      if (isNaN(diff) || diff <= oneWeekMs) {
        buckets.thisWeek.push(n);
      } else if (diff <= oneMonthMs) {
        buckets.thisMonth.push(n);
      } else {
        buckets.earlier.push(n);
      }
    });

    const sections = [];
    if (buckets.thisWeek.length > 0) {
      sections.push({
        key: 'thisWeek',
        title: 'THIS WEEK',
        count: buckets.thisWeek.length,
        items: buckets.thisWeek,
      });
    }
    if (buckets.thisMonth.length > 0) {
      sections.push({
        key: 'thisMonth',
        title: 'THIS MONTH',
        count: buckets.thisMonth.length,
        items: buckets.thisMonth,
      });
    }
    if (buckets.earlier.length > 0) {
      sections.push({
        key: 'earlier',
        title: 'EARLIER',
        count: buckets.earlier.length,
        items: buckets.earlier,
      });
    }

    if (sections.length === 0 && filteredTabNotifications.length > 0) {
      sections.push({
        key: 'all',
        title: 'ALL NOTIFICATIONS',
        count: filteredTabNotifications.length,
        items: filteredTabNotifications,
      });
    }

    return sections;
  }, [filteredTabNotifications]);

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
    let unsubOrders = () => {};
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
      } finally {
        if (isSubscribed) setIsLoadingOrders(false);
      }

      try {
        const userBikes = motorcycleService.getMotorcycles(currentUser?.id) || [];
        if (isSubscribed) setMotorcycles(userBikes);
      } catch (_e) {}

      try {
        const prods = await productService.getProducts();
        if (isSubscribed && Array.isArray(prods) && prods.length > 0) {
          const formatted = prods.map((p, idx) => {
            const price = Number(p.price) || 150;
            const comparePrice = Number(p.compare_at_price || p.compareAtPrice) || Math.round(price * 1.35);
            const discountPercent = Math.max(10, Math.round(((comparePrice - price) / comparePrice) * 100));
            const tags = ['On Trend', 'Pre-order', 'Star Shop', 'Best Seller'];
            const creators = ['Brembo Racing', 'RCB Official', 'Yoshimura', 'MotoTrack Official'];
            const dur = idx % 2 === 0 ? '01:17' : '00:29';
            return {
              id: p.id || p.product_id || `rec-${idx}`,
              rawProduct: p,
              name: p.name || 'High Performance Motor Part',
              price,
              compareAtPrice: comparePrice,
              brand: p.brand || creators[idx % creators.length],
              rating: Number(p.rating || 4.8),
              soldCount: p.soldCount || `${(15.2 + (idx * 3.7)).toFixed(1)}K sold`,
              image: p.image || p.imageUrl || (FALLBACK_SHOP_PRODUCTS[idx % FALLBACK_SHOP_PRODUCTS.length]?.image),
              tag: tags[idx % tags.length],
              discount: `-${discountPercent}%`,
              videoDuration: dur,
            };
          });
          setShopProducts(formatted);
        }
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

    try {
      if (typeof orderService?.subscribe === 'function') {
        unsubOrders = orderService.subscribe((fresh) => {
          if (isSubscribed && Array.isArray(fresh)) {
            setOrders([...fresh]);
          }
        });
      }
    } catch (_e) {}

    let unsubProd = () => {};
    try {
      if (typeof productService?.subscribe === 'function') {
        unsubProd = productService.subscribe((fresh) => {
          if (isSubscribed && Array.isArray(fresh) && fresh.length > 0) {
            const formatted = fresh.map((p, idx) => {
              const price = Number(p.price) || 150;
              const comparePrice = Number(p.compare_at_price || p.compareAtPrice) || Math.round(price * 1.35);
              const discountPercent = Math.max(10, Math.round(((comparePrice - price) / comparePrice) * 100));
              const tags = ['On Trend', 'Pre-order', 'Star Shop', 'Best Seller'];
              const creators = ['Brembo Racing', 'RCB Official', 'Yoshimura', 'MotoTrack Official'];
              const dur = idx % 2 === 0 ? '01:17' : '00:29';
              return {
                id: p.id || p.product_id || `rec-${idx}`,
                rawProduct: p,
                name: p.name || 'High Performance Motor Part',
                price,
                compareAtPrice: comparePrice,
                brand: p.brand || creators[idx % creators.length],
                rating: Number(p.rating || 4.8),
                soldCount: p.soldCount || `${(15.2 + (idx * 3.7)).toFixed(1)}K sold`,
                image: p.image || p.imageUrl || (FALLBACK_SHOP_PRODUCTS[idx % FALLBACK_SHOP_PRODUCTS.length]?.image),
                tag: tags[idx % tags.length],
                discount: `-${discountPercent}%`,
                videoDuration: dur,
              };
            });
            setShopProducts(formatted);
          }
        });
      }
    } catch (_e) {}

    let unsubCust = () => {};
    try {
      refreshCustomizations();
      if (typeof customizationService?.subscribe === 'function') {
        unsubCust = customizationService.subscribe(() => {
          if (isSubscribed) refreshCustomizations();
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
        unsubOrders?.();
        unsubProd?.();
        unsubCust?.();
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
    if (orderFilter === 'To Review') {
      filtered = filtered.filter((o) => isOrderToReview(o));
    } else if (orderFilter !== 'All') {
      filtered = filtered.filter((o) => (o.status || '').toLowerCase() === orderFilter.toLowerCase());
    }
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((o) => {
        const idMatch = String(o?.id || o?.order_id || '').toLowerCase().includes(q);
        const itemMatch = formatOrderItemsSummary(o).toLowerCase().includes(q);
        const payMatch = String(o?.paymentMethod || o?.payment_method || '').toLowerCase().includes(q);
        const statusMatch = String(o?.status || '').toLowerCase().includes(q);
        return idMatch || itemMatch || payMatch || statusMatch;
      });
    }
    return sortOrdersByPriority(filtered);
  }, [orders, orderFilter, orderSearchQuery]);

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
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Services') {
      onNavigateToGarage?.();
    } else if (tab === 'Customize') {
      (onNavigateToCustomizer || onNavigateToCustomize)?.();
    } else if (tab === 'Garage') {
      setActiveTab('garage');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'garage');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        } catch (_e) {}
      }
    } else if (tab === 'Orders') {
      setActiveTab('orders');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'orders');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        } catch (_e) {}
      }
    } else if (tab === 'More' || tab === 'menu') {
      setActiveTab('menu');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'menu');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        } catch (_e) {}
      }
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

      {/* ─── 1. NATIVE MOBILE APP HEADER ─── */}
      <View style={[styles.headerRow, activeTab === 'orders' && { paddingTop: 8, paddingBottom: 10 }]}>
        {activeTab === 'orders' ? (
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1E2124',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#363C44',
              paddingHorizontal: 14,
              height: 42,
              gap: 10,
            }}
          >
            <BootstrapIcon name="search" size={15} color="#94A3B8" />
            <TextInput
              style={{
                flex: 1,
                color: '#FFFFFF',
                fontSize: 13.5,
                height: '100%',
                fontFamily: 'PlusJakartaSans',
              }}
              placeholder="Search orders by ID, item, or status..."
              placeholderTextColor="#94A3B8"
              value={orderSearchQuery}
              onChangeText={setOrderSearchQuery}
            />
            {orderSearchQuery ? (
              <TouchableOpacity onPress={() => setOrderSearchQuery('')} activeOpacity={0.7}>
                <BootstrapIcon name="x-circle-fill" size={15} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <Text style={styles.headerTitle}>
            {activeTab === 'menu'
              ? 'Menu'
              : activeTab === 'profile'
              ? 'My Profile'
              : activeTab === 'bookings'
              ? 'My Bookings'
              : activeTab === 'garage'
              ? 'My Garage'
              : 'Customer Dashboard'}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={[
          styles.container,
          activeTab === 'orders' && { backgroundColor: isDarkMode ? '#121518' : '#F1F5F9' },
          activeTab === 'profile' && { backgroundColor: isDarkMode ? '#121518' : '#F8FAFC' }
        ]}
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

                    {/* 4. Dark mode */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={toggleDarkMode}
                      activeOpacity={0.7}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isDarkMode }}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={[styles.menuRefIconWrap, { backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#F0F2F5' }]}>
                          <BootstrapIcon
                            name={isDarkMode ? "moon-stars-fill" : "moon-fill"}
                            size={17}
                            color="#EA580C"
                          />
                        </View>
                        <View>
                          <Text style={styles.menuRefRowText}>Dark mode</Text>
                          <Text style={{ fontSize: 11, color: '#65676B', marginTop: 1 }}>
                            {isDarkMode ? 'Dark theme active' : 'Light theme active'}
                          </Text>
                        </View>
                      </View>
                      <ToggleSwitch
                        value={isDarkMode}
                        onToggle={toggleDarkMode}
                        activeTrackColor="#EA580C"
                        inactiveTrackColor={isDarkMode ? '#475569' : '#CBD5E1'}
                      />
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

                    {/* Orders & Tracking */}
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
                          <BootstrapIcon name="box-seam" size={17} color="#050505" />
                        </View>
                        <Text style={styles.menuRefRowText}>Orders & Tracking</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {orders.length > 0 && (
                          <View style={styles.menuRefCountBadge}>
                            <Text style={styles.menuRefCountBadgeText}>{orders.length}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color="#8A8D91" />
                      </View>
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
                            <View style={[styles.menuRefIconWrap, { backgroundColor: '#FFF7ED' }]}>
                              <BootstrapIcon name="shield-lock-fill" size={17} color="#EA580C" />
                            </View>
                            <Text style={[styles.menuRefRowText, { color: '#EA580C', fontWeight: '700' }]}>Admin Console</Text>
                          </View>
                          <BootstrapIcon name="chevron-right" size={14} color="#EA580C" />
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
                          <View style={[styles.menuRefIconWrap, { backgroundColor: '#FFF7ED' }]}>
                            <BootstrapIcon name="box-arrow-in-right" size={17} color="#EA580C" />
                          </View>
                          <Text style={[styles.menuRefRowText, { color: '#EA580C', fontWeight: '700' }]}>Sign In / Register</Text>
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
              {/* Modern Customer Dashboard KPI Metrics Grid (Styled after Order KPI Reference) */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {/* Metric 1: Orders Placed (Top Left - Dark Card) */}
                <TouchableOpacity
                  style={{
                    width: '48%',
                    backgroundColor: '#1E2430',
                    borderRadius: 18,
                    padding: 14,
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                  onPress={() => {
                    setActiveTab('orders');
                    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#EA580C',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="box-seam" size={17} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#FFFFFF',
                          textTransform: 'uppercase',
                          lineHeight: 13,
                          letterSpacing: 0.3,
                        }}
                      >
                        ORDERS{'\n'}PLACED
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: '800',
                      color: '#FFFFFF',
                      marginTop: 12,
                      marginBottom: 2,
                      letterSpacing: -0.5,
                    }}
                  >
                    {orders.length}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '500',
                      color: '#94A3B8',
                    }}
                    numberOfLines={1}
                  >
                    {activeOrders.length > 0 ? `${activeOrders.length} active in delivery` : 'All deliveries completed'}
                  </Text>
                </TouchableOpacity>

                {/* Metric 2: Active Garage Bookings (Top Right - Light Card) */}
                <TouchableOpacity
                  style={{
                    width: '48%',
                    backgroundColor: isDarkMode ? '#1E2430' : '#FFFFFF',
                    borderRadius: 18,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                  onPress={() => {
                    setActiveTab('bookings');
                    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#EA580C',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="tools" size={17} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isDarkMode ? '#F8FAFC' : '#1E293B',
                          textTransform: 'uppercase',
                          lineHeight: 13,
                          letterSpacing: 0.3,
                        }}
                      >
                        GARAGE{'\n'}BOOKINGS
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: '800',
                      color: isDarkMode ? '#FFFFFF' : '#0F172A',
                      marginTop: 12,
                      marginBottom: 2,
                      letterSpacing: -0.5,
                    }}
                  >
                    {activeBookings.length}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '500',
                      color: isDarkMode ? '#94A3B8' : '#64748B',
                    }}
                    numberOfLines={1}
                  >
                    {bookings.length} total scheduled PMS
                  </Text>
                </TouchableOpacity>

                {/* Metric 3: Saved Wishlist (Bottom Left - Light Card) */}
                <TouchableOpacity
                  style={{
                    width: '48%',
                    backgroundColor: isDarkMode ? '#1E2430' : '#FFFFFF',
                    borderRadius: 18,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                  onPress={onNavigateToWishlist}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#EA580C',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="heart-fill" size={16} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isDarkMode ? '#F8FAFC' : '#1E293B',
                          textTransform: 'uppercase',
                          lineHeight: 13,
                          letterSpacing: 0.3,
                        }}
                      >
                        SAVED{'\n'}WISHLIST
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: '800',
                      color: isDarkMode ? '#FFFFFF' : '#0F172A',
                      marginTop: 12,
                      marginBottom: 2,
                      letterSpacing: -0.5,
                    }}
                  >
                    {wishlistCount || 0}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '500',
                      color: isDarkMode ? '#94A3B8' : '#64748B',
                    }}
                    numberOfLines={1}
                  >
                    Components ready for bag
                  </Text>
                </TouchableOpacity>

                {/* Metric 4: Total Spend (Bottom Right - Dark Card) */}
                <View
                  style={{
                    width: '48%',
                    backgroundColor: '#1E2430',
                    borderRadius: 18,
                    padding: 14,
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: '#EA580C',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: '900',
                          color: '#FFFFFF',
                          textAlign: 'center',
                        }}
                      >
                        ₱
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#FFFFFF',
                          textTransform: 'uppercase',
                          lineHeight: 13,
                          letterSpacing: 0.3,
                        }}
                      >
                        TOTAL{'\n'}SPEND
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 26,
                      fontWeight: '800',
                      color: '#FFFFFF',
                      marginTop: 12,
                      marginBottom: 2,
                      letterSpacing: -0.5,
                    }}
                    numberOfLines={1}
                  >
                    ₱{Number(totalSpent).toLocaleString()}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '500',
                      color: '#94A3B8',
                    }}
                    numberOfLines={1}
                  >
                    Verified purchases & tuning
                  </Text>
                </View>

                {/* Metric 5: Custom Builds (Full Width Card in matching styling) */}
                <TouchableOpacity
                  style={{
                    width: '100%',
                    backgroundColor: isDarkMode ? '#1E2430' : '#FFFFFF',
                    borderRadius: 18,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                  onPress={() => onNavigateToCustomizer?.() || onNavigateToCustomize?.()}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: '#EA580C',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="magic" size={18} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isDarkMode ? '#F8FAFC' : '#1E293B',
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}
                      >
                        CUSTOM BUILDS
                      </Text>
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '500',
                          color: isDarkMode ? '#94A3B8' : '#64748B',
                          marginTop: 2,
                        }}
                      >
                        {customizations.length > 0 ? `${customizations.length} AI previews saved` : 'Create your dream motorcycle build'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 26,
                        fontWeight: '800',
                        color: '#EA580C',
                      }}
                    >
                      {customizations.length}
                    </Text>
                    <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                  </View>
                </TouchableOpacity>
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
                        backgroundColor: '#EA580C',
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
                      backgroundColor: '#EA580C',
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
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
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
                    <BootstrapIcon name="calendar-plus-fill" size={18} color="#EA580C" />
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
                  <Text style={styles.quickActionLabel}>AI Install</Text>
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
                      <BootstrapIcon name="calendar-check-fill" size={15} color="#EA580C" />
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
                    <BootstrapIcon name="clock-fill" size={12} color="#EA580C" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>
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
                  <BootstrapIcon name="box-seam-fill" size={16} color="#EA580C" />
                  <Text style={styles.sectionTitle}>Recent Orders</Text>
                </View>
                <TouchableOpacity onPress={onNavigateToOrders} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C' }}>
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
                    style={[styles.orderTrackBtn, { marginTop: 10, backgroundColor: '#EA580C', borderColor: '#163527' }]}
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

              {/* 5. Saved Customizations & AI Previews */}
              <View style={[styles.sectionHeader, { marginTop: 18 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Saved Customizations</Text>
                  {customizations.length > 0 ? (
                    <View style={{ backgroundColor: '#EA580C', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{customizations.length}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => onNavigateToCustomizer?.() || onNavigateToCustomize?.()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>+ New Build →</Text>
                </TouchableOpacity>
              </View>

              {loadingCustomizations ? (
                <View style={[styles.emptyOrdersCard, { paddingVertical: 24 }]}>
                  <ActivityIndicator size="small" color="#EA580C" />
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>Loading custom builds…</Text>
                </View>
              ) : customizations.length === 0 ? (
                <View style={[styles.emptyOrdersCard, { paddingVertical: 24 }]}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: '#ECFDF5',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <BootstrapIcon name="stars" size={22} color="#EA580C" />
                  </View>
                  <Text style={[styles.orderIdText, { textAlign: 'center' }]}>No Saved Customizations Yet</Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, textAlign: 'center', maxWidth: 280 }}>
                    Preview parts installed on your motorcycle using AI and store your builds here.
                  </Text>
                  <TouchableOpacity
                    style={[styles.orderTrackBtn, { marginTop: 12, backgroundColor: '#EA580C', borderColor: '#163527', alignSelf: 'center' }]}
                    onPress={() => onNavigateToCustomizer?.() || onNavigateToCustomize?.()}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.orderTrackBtnText, { color: '#FFFFFF' }]}>Open AI Install Studio</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12, marginBottom: 16 }}>
                  {customizations.map((item) => {
                    const id = item.id || item.customization_id;
                    const img = item.previewImageUrl || item.preview_image_url;
                    const bikeName =
                      item.name ||
                      item.motorcycleName ||
                      [item.motorcycleBrand, item.motorcycleModel].filter(Boolean).join(' ') ||
                      'Custom Motorcycle';
                    const firstItem = item.items?.[0];
                    const partTitle =
                      firstItem?.product_name ||
                      firstItem?.name ||
                      (item.items?.length > 1 ? `${item.items.length} parts installed` : 'Custom Part');
                    const dateStr = item.createdAt || item.created_at
                      ? new Date(item.createdAt || item.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '';

                    return (
                      <View
                        key={id}
                        style={{
                          backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#2B3035' : '#E2E8F0',
                          overflow: 'hidden',
                        }}
                      >
                        <View style={{ height: 160, backgroundColor: isDarkMode ? '#121518' : '#F8FAFC', position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                          {img ? (
                            <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          ) : (
                            <BootstrapIcon name="image" size={32} color="#94A3B8" />
                          )}
                          <View
                            style={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              backgroundColor: '#EA580C',
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <BootstrapIcon name="stars" size={10} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>AI PREVIEW</Text>
                          </View>
                        </View>

                        <View style={{ padding: 12, gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={[styles.orderIdText, { fontSize: 14 }]} numberOfLines={1}>{bikeName}</Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#EA580C', marginTop: 1 }}>Installed: {partTitle}</Text>
                              {dateStr ? (
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Saved on {dateStr}</Text>
                              ) : null}
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDeleteCustomization(id)}
                              style={{ padding: 6 }}
                              activeOpacity={0.7}
                            >
                              <BootstrapIcon name="trash" size={14} color="#DC2626" />
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              style={[styles.orderTrackBtn, { flex: 1, backgroundColor: '#EA580C', borderColor: '#163527', justifyContent: 'center' }]}
                              onPress={() => onNavigateToCustomizer?.() || onNavigateToCustomize?.()}
                              activeOpacity={0.85}
                            >
                              <BootstrapIcon name="eye-fill" size={12} color="#FFFFFF" />
                              <Text style={[styles.orderTrackBtnText, { color: '#FFFFFF' }]}>Open in Studio</Text>
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
                motorcycles.map((bike) => {
                  const bikePhoto = resolveMotorcyclePhoto(bike);
                  const cleanPlate = String(bike.plate_number || '').trim().toUpperCase();
                  const refCode = cleanPlate || `MOTO-${String(bike.motorcycle_id || bike.id || '01').slice(-4).toUpperCase()}`;

                  // Subtitle matching "Honda ADV 160 · RJCX" format from reference card
                  const motoSubtitle = bike.nickname
                    ? `${bike.brand} ${bike.model} · ${bike.nickname}`
                    : cleanPlate
                    ? `${bike.brand} ${bike.model} · ${cleanPlate}`
                    : `${bike.brand} ${bike.model}`;

                  // Specs line matching "Oct 31 · 10:30–12:00 PM" format
                  const specsLine = `${bike.year ? `${bike.year} · ` : ''}${bike.odometer ? (bike.odometer.includes('km') ? bike.odometer : `${bike.odometer} km`) : '0 km'} odometer`;

                  // Stage/status line matching cyan text
                  const statusLine = `${bike.engine_cc ? `${bike.engine_cc}cc` : 'Standard'} · ${bike.is_primary ? 'Primary Fleet Vehicle · Active' : 'Registered Garage Motorcycle'}`;

                  return (
                    <TouchableOpacity
                      key={bike.motorcycle_id || bike.id}
                      style={styles.motorcycleCard}
                      onPress={() => setViewingPhotoBike(bike)}
                      activeOpacity={0.92}
                    >
                      {/* 1. Registered Motorcycle Photo on the right side */}
                      {bikePhoto ? (
                        <Image
                          source={{ uri: bikePhoto }}
                          style={styles.gridHeroImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.gridHeroImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3452' }]}>
                          <BootstrapIcon name="motorcycle" size={64} color="rgba(255, 255, 255, 0.2)" />
                        </View>
                      )}

                      {/* 2. Dark Blue Gradient Overlay (smooth blend from solid dark blue on left into motorcycle photo on right) */}
                      <View
                        style={[
                          StyleSheet.absoluteFillObject,
                          Platform.OS === 'web'
                            ? {
                                backgroundImage:
                                  'linear-gradient(180deg, rgba(15, 28, 44, 0.75) 0%, rgba(15, 28, 44, 0.22) 32%, transparent 62%), linear-gradient(90deg, #172B42 0%, #1A3452 35%, rgba(26, 52, 82, 0.94) 52%, rgba(26, 52, 82, 0.58) 72%, rgba(26, 52, 82, 0.15) 90%, rgba(26, 52, 82, 0.05) 100%)',
                              }
                            : {
                                backgroundColor: 'rgba(23, 43, 66, 0.86)',
                              },
                        ]}
                      />

                      {/* 3. Card Content Overlay */}
                      <View style={styles.gridHeroContent}>
                        {/* Top Row: Ref Badge & Status Pill */}
                        <View style={styles.gridHeaderRow}>
                          <View style={styles.gridRefBadge}>
                            <Text style={styles.gridRefText}>REF: {refCode}</Text>
                          </View>

                          {bike.is_primary ? (
                            <View
                              style={[
                                styles.gridStatusPill,
                                {
                                  backgroundColor: '#271B07',
                                  borderColor: 'rgba(251, 191, 36, 0.75)',
                                },
                              ]}
                            >
                              <View style={[styles.statusDot, { backgroundColor: '#FBBF24' }]} />
                              <Text style={[styles.gridStatusText, { color: '#FEF3C7' }]}>
                                Primary Ride
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.gridStatusPill,
                                {
                                  backgroundColor: '#0A251C',
                                  borderColor: 'rgba(52, 211, 153, 0.75)',
                                },
                              ]}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                handleSetPrimaryBike(bike);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.statusDot, { backgroundColor: '#34D399' }]} />
                              <Text style={[styles.gridStatusText, { color: '#ECFDF5' }]}>
                                Set Primary
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Middle Body */}
                        <View style={styles.gridBody}>
                          {/* Motorcycle Name Title */}
                          <Text style={styles.gridServiceTitle} numberOfLines={1}>
                            {bike.brand} {bike.model}
                          </Text>

                          {/* Model & Nickname Subtitle */}
                          <Text style={styles.gridMotoText} numberOfLines={1}>
                            {motoSubtitle}
                          </Text>

                          {/* Odometer Specs */}
                          <Text style={styles.gridScheduleText} numberOfLines={1}>
                            {specsLine}
                          </Text>

                          {/* Status / Fleet Line */}
                          <Text style={styles.gridStageText} numberOfLines={1}>
                            {statusLine}
                          </Text>
                        </View>

                        {/* Bottom Area: Large Bold Displacement & White Pill Button */}
                        <View style={styles.gridFooterRow}>
                          <View style={styles.gridPriceCol}>
                            <Text style={styles.gridPriceLabel}>DISPLACEMENT</Text>
                            <Text style={styles.gridPriceAmount}>
                              {bike.engine_cc ? `${bike.engine_cc}cc` : '160cc'}
                            </Text>

                            {/* Quick Action Links styled like reference cancel link */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 }}>
                              <TouchableOpacity
                                style={styles.gridCancelLink}
                                onPress={(e) => {
                                  e?.stopPropagation?.();
                                  handleOpenEditMotorcycle(bike);
                                }}
                                activeOpacity={0.65}
                              >
                                <Text style={styles.gridCancelText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.gridCancelLink}
                                onPress={(e) => {
                                  e?.stopPropagation?.();
                                  handlePromptDeleteBike(bike);
                                }}
                                activeOpacity={0.65}
                              >
                                <Text style={[styles.gridCancelText, { color: '#F87171' }]}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={styles.gridPillBtn}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              setViewingPhotoBike(bike);
                            }}
                            activeOpacity={0.88}
                          >
                            <Text style={styles.gridPillBtnText}>View Details</Text>
                            <BootstrapIcon name="arrow-right" size={16} color="#152A42" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════
              TAB 3: ORDERS (PURCHASES & LIVE TRACKING)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'orders' && (
            <View>


              {/* Guest Authentication & Cloud Sync Banner (if not logged in) */}
              {!currentUser && (
                <View
                  style={{
                    backgroundColor: '#FFF7ED',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#FFEDD5',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="person-check-fill" size={17} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#9A3412' }}>
                        Guest Rider Mode
                      </Text>
                      <Text style={{ fontSize: 11.5, color: '#C2410C', marginTop: 1 }}>
                        Sign in to sync your purchase history, receipts, and live courier tracking.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#EA580C',
                      borderRadius: 10,
                      paddingVertical: 9,
                      paddingHorizontal: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={() => onNavigateToLogin?.()}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="box-arrow-in-right" size={14} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                      Sign In / Register
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Active Ongoing Order Banner (if any) */}
              {activeOngoingOrder && (
                <View style={[styles.liveTrackingCard, { marginBottom: 14 }]}>
                  <View style={styles.liveTrackingTopRow}>
                    <View style={styles.pulsingLiveBadge}>
                      <View style={styles.liveIndicatorDot} />
                      <Text style={styles.liveBadgeText}>ONGOING DISPATCH</Text>
                    </View>
                    <Text style={styles.liveOrderEta}>
                      {activeOngoingOrder.status || 'In Transit'}
                    </Text>
                  </View>
                  <Text style={styles.liveOrderTitle}>
                    Order #{activeOngoingOrder.id || activeOngoingOrder.order_id}
                  </Text>
                  <Text style={styles.liveOrderSubtitle} numberOfLines={2}>
                    {formatOrderItemsSummary(activeOngoingOrder)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.trackMapBtn, { marginTop: 10 }]}
                    onPress={() => handleTrackOrder(activeOngoingOrder)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="geo-alt-fill" size={14} color="#FFFFFF" />
                    <Text style={styles.trackMapBtnText}>Track Courier Live on GPS Map</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Status Filter Chips Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
                style={{ marginBottom: 16 }}
              >
                {ORDER_STATUS_FILTERS.map((statusKey) => {
                  const isActive = orderFilter === statusKey;
                  const count =
                    statusKey === 'All'
                      ? orders.length
                      : statusKey === 'To Review'
                      ? orders.filter(isOrderToReview).length
                      : orders.filter((o) => (o.status || '').toLowerCase() === statusKey.toLowerCase()).length;

                  return (
                    <TouchableOpacity
                      key={statusKey}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 24,
                        backgroundColor: isActive ? '#EA580C' : isDarkMode ? '#1E2430' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isActive ? '#EA580C' : isDarkMode ? '#334155' : '#E2E8F0',
                      }}
                      onPress={() => setOrderFilter(statusKey)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? '800' : '600',
                          color: isActive ? '#FFFFFF' : isDarkMode ? '#E5E7EB' : '#334155',
                        }}
                      >
                        {statusKey}
                      </Text>
                      <View
                        style={{
                          backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : isDarkMode ? '#24282D' : '#E2E8F0',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: isActive ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B',
                          }}
                        >
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Orders List View */}
              {isLoadingOrders && orders.length === 0 ? (
                <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#EA580C" />
                  <Text style={{ marginTop: 10, fontSize: 13, color: '#64748B', fontWeight: '600' }}>
                    Loading your orders...
                  </Text>
                </View>
              ) : filteredOrders.length === 0 ? (
                <View style={{ width: '100%', marginTop: 6, paddingBottom: 32 }}>
                  {/* Top "No related orders" Banner matching reference Image 2 */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#11141C',
                      borderRadius: 16,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: '#1E2536',
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    {/* Glowing shopping bag icon */}
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        backgroundColor: '#161B26',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 14,
                        borderWidth: 1,
                        borderColor: '#2A364F',
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <BootstrapIcon name="bag-check-fill" size={18} color="#38BDF8" />
                      </View>
                    </View>

                    {/* Banner Titles */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15.5,
                          fontWeight: '800',
                          color: '#FFFFFF',
                          letterSpacing: -0.2,
                          marginBottom: 3,
                        }}
                      >
                        No related orders
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#94A3B8',
                          lineHeight: 16,
                        }}
                      >
                        Start exploring and find something you love
                      </Text>
                    </View>
                  </View>

                  {/* Section Title: "You might also like" */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 22,
                      marginBottom: 14,
                      paddingHorizontal: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '800',
                        color: isDarkMode ? '#FFFFFF' : '#0F172A',
                        letterSpacing: -0.3,
                      }}
                    >
                      You might also like
                    </Text>

                    <TouchableOpacity
                      onPress={onNavigateToStore}
                      activeOpacity={0.7}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '700',
                          color: '#EA580C',
                          marginRight: 2,
                        }}
                      >
                        Explore shop
                      </Text>
                      <BootstrapIcon name="chevron-right" size={12} color="#EA580C" />
                    </TouchableOpacity>
                  </View>

                  {/* 2-Column Product Grid */}
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    {shopProducts.map((prod, idx) => {
                      const hasDiscount = Boolean(prod.discount || prod.compareAtPrice);
                      const displayPrice = Number(prod.price || 0);
                      const originalPrice = Number(prod.compareAtPrice || 0);

                      return (
                        <TouchableOpacity
                          key={prod.id || `rec-${idx}`}
                          style={{
                            width: '48.5%',
                            backgroundColor: '#161B26',
                            borderRadius: 14,
                            marginBottom: 12,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: '#232A3B',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.18,
                            shadowRadius: 5,
                            elevation: 2,
                          }}
                          onPress={() => {
                            if (typeof onNavigateToProductDetails === 'function') {
                              onNavigateToProductDetails(prod.rawProduct || prod);
                            } else if (typeof onNavigateToStore === 'function') {
                              onNavigateToStore(prod.rawProduct || prod);
                            }
                          }}
                          activeOpacity={0.88}
                        >
                          {/* Image Box */}
                          <View
                            style={{
                              width: '100%',
                              height: 165,
                              position: 'relative',
                              backgroundColor: '#0F131C',
                            }}
                          >
                            <Image
                              source={{ uri: prod.image }}
                              style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                            />

                            {/* Top Left: Video / Media Duration Pill */}
                            <View
                              style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                paddingHorizontal: 6,
                                paddingVertical: 2.5,
                                borderRadius: 6,
                              }}
                            >
                              <BootstrapIcon
                                name={idx % 2 === 0 ? 'pause-fill' : 'play-fill'}
                                size={9}
                                color="#FFFFFF"
                                style={{ marginRight: 3 }}
                              />
                              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                                {prod.videoDuration || (idx % 2 === 0 ? '01:17' : '00:29')}
                              </Text>
                            </View>

                            {/* Top Right: Discount Pill */}
                            {hasDiscount && (
                              <View
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  backgroundColor: '#FF2E4D',
                                  paddingHorizontal: 6,
                                  paddingVertical: 2.5,
                                  borderRadius: 5,
                                }}
                              >
                                <Text
                                  style={{
                                    color: '#FFFFFF',
                                    fontSize: 10,
                                    fontWeight: '800',
                                    letterSpacing: -0.2,
                                  }}
                                >
                                  {prod.discount || '-50%'}
                                </Text>
                              </View>
                            )}

                            {/* Bottom of Image: Channel / Merchant Overlay */}
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 7,
                                paddingVertical: 5,
                                backgroundColor: 'rgba(11, 15, 25, 0.78)',
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  flex: 1,
                                  marginRight: 4,
                                }}
                              >
                                <View
                                  style={{
                                    width: 15,
                                    height: 15,
                                    borderRadius: 7.5,
                                    backgroundColor: '#334155',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 4,
                                  }}
                                >
                                  <BootstrapIcon name="person-circle" size={12} color="#CBD5E1" />
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    color: '#E2E8F0',
                                    fontSize: 10,
                                    fontWeight: '600',
                                    flex: 1,
                                  }}
                                >
                                  {prod.brand || 'MotoTrack'}
                                </Text>
                              </View>

                              <View
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                                  paddingHorizontal: 4,
                                  paddingVertical: 1,
                                  borderRadius: 3,
                                }}
                              >
                                <Text
                                  style={{
                                    color: '#94A3B8',
                                    fontSize: 8.5,
                                    fontWeight: '700',
                                  }}
                                >
                                  Ad
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Card Content */}
                          <View style={{ padding: 9 }}>
                            {/* Tag Badge + Title */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                marginBottom: 5,
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor:
                                    prod.tag === 'Pre-order'
                                      ? '#4F46E5'
                                      : prod.tag === 'Star Shop'
                                        ? '#D97706'
                                        : '#FF2E4D',
                                  paddingHorizontal: 5,
                                  paddingVertical: 1.5,
                                  borderRadius: 4,
                                  marginRight: 4,
                                  marginTop: 1,
                                }}
                              >
                                <Text
                                  style={{
                                    color: '#FFFFFF',
                                    fontSize: 8.5,
                                    fontWeight: '800',
                                  }}
                                >
                                  {prod.tag || 'On Trend'}
                                </Text>
                              </View>

                              <Text
                                numberOfLines={2}
                                style={{
                                  color: '#F1F5F9',
                                  fontSize: 11.5,
                                  fontWeight: '600',
                                  lineHeight: 16,
                                  flex: 1,
                                }}
                              >
                                {prod.name}
                              </Text>
                            </View>

                            {/* Price Row */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'baseline',
                                marginBottom: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: '#FF3B30',
                                  fontSize: 11,
                                  fontWeight: '800',
                                }}
                              >
                                ₱
                              </Text>
                              <Text
                                style={{
                                  color: '#FF3B30',
                                  fontSize: 15,
                                  fontWeight: '900',
                                  marginRight: 5,
                                }}
                              >
                                {displayPrice.toLocaleString()}
                                <Text style={{ fontSize: 9.5 }}>.00</Text>
                              </Text>

                              {originalPrice > displayPrice && (
                                <Text
                                  style={{
                                    color: '#64748B',
                                    fontSize: 10,
                                    textDecorationLine: 'line-through',
                                  }}
                                >
                                  ₱{originalPrice.toLocaleString()}
                                </Text>
                              )}
                            </View>

                            {/* Perks Badge Row */}
                            {idx % 2 === 0 ? (
                              <View
                                style={{
                                  alignSelf: 'flex-start',
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  borderWidth: 0.5,
                                  borderColor: 'rgba(245, 158, 11, 0.4)',
                                  paddingHorizontal: 5,
                                  paddingVertical: 1.5,
                                  borderRadius: 4,
                                  marginBottom: 6,
                                }}
                              >
                                <Text
                                  style={{
                                    color: '#F59E0B',
                                    fontSize: 9,
                                    fontWeight: '800',
                                    letterSpacing: 0.2,
                                  }}
                                >
                                  COD
                                </Text>
                              </View>
                            ) : (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                  marginBottom: 6,
                                }}
                              >
                                <View
                                  style={{
                                    backgroundColor: '#FF2E4D',
                                    paddingHorizontal: 3.5,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: '#FFFFFF',
                                      fontSize: 7.5,
                                      fontWeight: '800',
                                    }}
                                  >
                                    MEGA
                                  </Text>
                                </View>
                                <View
                                  style={{
                                    backgroundColor: '#F59E0B',
                                    paddingHorizontal: 3.5,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: '#000000',
                                      fontSize: 7.5,
                                      fontWeight: '800',
                                    }}
                                  >
                                    Bonus
                                  </Text>
                                </View>
                                <View
                                  style={{
                                    backgroundColor: '#06B6D4',
                                    paddingHorizontal: 3.5,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: '#FFFFFF',
                                      fontSize: 7.5,
                                      fontWeight: '800',
                                    }}
                                  >
                                    Free Ship
                                  </Text>
                                </View>
                              </View>
                            )}

                            {/* Rating and Sold Count Row */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginTop: 1,
                              }}
                            >
                              <BootstrapIcon
                                name="star-fill"
                                size={10}
                                color="#FBBF24"
                                style={{ marginRight: 3 }}
                              />
                              <Text
                                style={{
                                  color: '#FBBF24',
                                  fontSize: 10.5,
                                  fontWeight: '800',
                                  marginRight: 6,
                                }}
                              >
                                {prod.rating || 4.8}
                              </Text>
                              <Text
                                style={{
                                  color: '#94A3B8',
                                  fontSize: 10,
                                }}
                              >
                                {prod.soldCount || '20.6K sold'}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                filteredOrders.map((o) => {
                  const statusStyle = getStatusBadgeStyle(o.status || 'Delivered');
                  const grandTotal = getOrderGrandTotal(o);
                  const isDone = isOrderDeliveredOrDone(o.status);
                  const isPending = isOrderPendingApproval(o.status);
                  const dateStr =
                    o.orderDate ||
                    o.createdAt ||
                    (o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Recent');
                  const orderItemsList =
                    Array.isArray(o.items) && o.items.length > 0
                      ? o.items
                      : [
                          {
                            name: o.itemsSummary || 'ligid ni',
                            price: grandTotal || 11,
                            quantity: 1,
                            size: '60/30',
                            image: o.image || o.imageUrl,
                          },
                        ];
                  const trackingCode =
                    o.tracking_number ||
                    `MOTO-TRK-${String(o.id || o.order_id || '8107038').replace(/[^0-9]/g, '').slice(-7).padStart(7, '8') || '8107038'}`;
                  const paymentMethod =
                    o.paymentMethod || o.payment_method || 'Cash on Delivery (COD)';

                  return (
                    <View
                      key={o.id || o.order_id || Math.random().toString()}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        padding: 16,
                        marginBottom: 16,
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      {/* Top Header: Order #ID and Date on left, Status Pill on right */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text
                            style={{
                              fontSize: 15.5,
                              fontWeight: '800',
                              color: '#0F172A',
                            }}
                            numberOfLines={1}
                          >
                            Order #{o.id || o.order_id}
                          </Text>
                          <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                            Placed on {dateStr}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: statusStyle.bg,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: statusStyle.text,
                            }}
                          >
                            {o.status || 'Delivered'}
                          </Text>
                        </View>
                      </View>

                      {/* Items Breakdown Box */}
                      <View
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: '#F1F5F9',
                        }}
                      >
                        {orderItemsList.map((it, idx) => {
                          const itemName = it.name || it.product_name || 'ligid ni';
                          const itemPrice = Number(it.price || it.cost || it.unit_cost || 0) || grandTotal;
                          const itemQty = Number(it.quantity) || 1;
                          const itemImg = it.image || it.imageUrl || it.product?.image;
                          const variantText = it.size || it.variant || (it.spec ? it.spec : '60/30');

                          return (
                            <View
                              key={idx}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: idx > 0 ? 8 : 0,
                                borderTopWidth: idx > 0 ? 1 : 0,
                                borderTopColor: '#E2E8F0',
                                gap: 12,
                              }}
                            >
                              {itemImg ? (
                                <Image
                                  source={{ uri: itemImg }}
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 8,
                                    backgroundColor: '#FFFFFF',
                                  }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Image
                                  source={{
                                    uri: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=300',
                                  }}
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 8,
                                    backgroundColor: '#E2E8F0',
                                  }}
                                  resizeMode="cover"
                                />
                              )}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: '700',
                                    color: '#0F172A',
                                  }}
                                  numberOfLines={1}
                                >
                                  {itemName}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: '#64748B',
                                    marginTop: 3,
                                  }}
                                >
                                  Qty: {itemQty} • ₱{itemPrice.toLocaleString()} each
                                  {variantText ? ` (${variantText})` : ''}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 14.5,
                                  fontWeight: '800',
                                  color: '#0F172A',
                                }}
                              >
                                ₱{(itemPrice * itemQty).toLocaleString()}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Payment & Tracking Rows */}
                      <View style={{ gap: 5, marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12.5, color: '#64748B', width: 72 }}>Payment</Text>
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A' }}>
                            {paymentMethod}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12.5, color: '#64748B', width: 72 }}>Tracking</Text>
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#EA580C' }}>
                            {trackingCode}
                          </Text>
                        </View>
                      </View>

                      {/* Bottom Footer: Total Amount on left, Action buttons on right */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          paddingTop: 12,
                          borderTopWidth: 1,
                          borderTopColor: '#F1F5F9',
                        }}
                      >
                        <View>
                          <Text
                            style={{
                              fontSize: 11.5,
                              color: '#64748B',
                              fontWeight: '500',
                              marginBottom: 2,
                            }}
                          >
                            Total Amount
                          </Text>
                          <Text
                            style={{
                              fontSize: 22,
                              fontWeight: '900',
                              color: '#EA580C',
                              letterSpacing: -0.5,
                            }}
                          >
                            ₱{grandTotal.toLocaleString()}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {/* Buy Again Button */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#CBD5E1',
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 12,
                            }}
                            onPress={() => {
                              if (typeof addToCart === 'function') {
                                orderItemsList.forEach((it) => {
                                  addToCart(it, it.quantity || 1, it.size || '');
                                });
                                showToast('Added items back to shopping bag!');
                              } else {
                                onNavigateToStore?.();
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="arrow-repeat" size={14} color="#0F172A" />
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: '#0F172A',
                              }}
                            >
                              Buy Again
                            </Text>
                          </TouchableOpacity>

                          {/* Live Track Action (if active) */}
                          {!isDone && (
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                backgroundColor: isPending ? '#FEF3C7' : '#EA580C',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 12,
                              }}
                              onPress={() => {
                                if (isPending) {
                                  showToast('⏳ Order is pending approval. Tracking unlocks upon dispatch.');
                                } else {
                                  handleTrackOrder(o);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon
                                name={isPending ? 'hourglass-split' : 'geo-alt-fill'}
                                size={12}
                                color={isPending ? '#92400E' : '#FFFFFF'}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: isPending ? '#92400E' : '#FFFFFF',
                                }}
                              >
                                {isPending ? 'Pending' : 'Track'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Rate / Review Action (if delivered) */}
                          {isOrderDelivered(o.status) && (
                            !o.is_rated ? (
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  backgroundColor: '#EA580C',
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: 12,
                                }}
                                onPress={() => handleOpenRateModal(o)}
                                activeOpacity={0.8}
                              >
                                <BootstrapIcon name="star-fill" size={12} color="#FFFFFF" />
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: '700',
                                    color: '#FFFFFF',
                                  }}
                                >
                                  To Review
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: '#F0FDF4',
                                  borderWidth: 1,
                                  borderColor: '#BBF7D0',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 10,
                                }}
                              >
                                <BootstrapIcon name="check-circle-fill" size={12} color="#16A34A" />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: '#16A34A',
                                  }}
                                >
                                  Reviewed
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
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
                            b.status === 'Paid' && { color: '#EA580C' },
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
                        <BootstrapIcon name="person-badge" size={13} color="#EA580C" />
                        <Text style={[styles.bookingMetaText, { color: '#EA580C', fontWeight: '700' }]}>
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
              {/* Top Header matching Web */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
                    Notifications
                  </Text>
                  {unreadNotifCount > 0 && (
                    <View
                      style={{
                        backgroundColor: '#18181B',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>
                        {unreadNotifCount} UNREAD
                      </Text>
                    </View>
                  )}
                </View>

                {unreadNotifCount > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkAllCustomerNotificationsRead}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="check2-all" size={13} color="#2563EB" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>Mark all read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Box matching Web */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  marginTop: 2,
                }}
              >
                <BootstrapIcon name="search" size={14} color="#94A3B8" />
                <TextInput
                  style={{ flex: 1, fontSize: 13.5, color: '#0F172A', padding: 0 }}
                  placeholder="Search notifications..."
                  placeholderTextColor="#94A3B8"
                  value={notifSearchQuery}
                  onChangeText={setNotifSearchQuery}
                />
                {Boolean(notifSearchQuery) && (
                  <TouchableOpacity onPress={() => setNotifSearchQuery('')} activeOpacity={0.7}>
                    <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Pills matching Web (Dark active #18181B, light #F1F5F9) */}
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
                        borderRadius: 8,
                        backgroundColor: isActive ? '#18181B' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isActive ? '#18181B' : '#E2E8F0',
                      }}
                      onPress={() => setNotifFilter(f.id)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? '700' : '600',
                          color: isActive ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Grouped Notifications List matching Web */}
              {groupedNotifSections.length === 0 ? (
                <View
                  style={{
                    padding: 40,
                    borderRadius: 16,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <BootstrapIcon name="bell-slash" size={26} color="#94A3B8" />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181B' }}>No notifications</Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' }}>
                    {notifSearchQuery
                      ? 'No alerts match your search query.'
                      : notifFilter === 'unread'
                      ? "You're all caught up! No unread messages."
                      : notifFilter !== 'all'
                      ? `No ${notifFilter} notifications available.`
                      : 'Live order updates, pitstop bookings, and promotions will appear here.'}
                  </Text>
                  {onNavigateToStore && (
                    <TouchableOpacity
                      style={{
                        marginTop: 16,
                        backgroundColor: '#EA580C',
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
                groupedNotifSections.map((section) => (
                  <View key={section.key} style={{ marginTop: 6, marginBottom: 8 }}>
                    {/* Section Header matching Web */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#71717A', letterSpacing: 0.8 }}>
                        {section.title}
                      </Text>
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: '#E4E4E7',
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#52525B' }}>
                          {section.count}
                        </Text>
                      </View>
                    </View>

                    {/* Cards List matching Web */}
                    <View style={{ gap: 12 }}>
                      {section.items.map((notif) => {
                        const isExpanded = expandedNotifIds.has(notif.id);
                        const isUnread = notif.status === 'unread';
                        const config = getCategoryConfig(notif);

                        return (
                          <View
                            key={notif.id}
                            style={{
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: isUnread ? '#CBD5E1' : '#E4E4E7',
                              backgroundColor: '#FFFFFF',
                              overflow: 'hidden',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.04,
                              shadowRadius: 4,
                              elevation: 1,
                            }}
                          >
                            {/* Clickable Header Row */}
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                padding: 16,
                                gap: 12,
                              }}
                              onPress={() => toggleNotifExpanded(notif.id, notif)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                                {/* Soft circular icon badge */}
                                <View
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 19,
                                    backgroundColor: config.bg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: 2,
                                  }}
                                >
                                  <BootstrapIcon name={config.icon} size={15} color={config.color} />
                                </View>

                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text
                                      style={{
                                        fontSize: 14.5,
                                        fontWeight: isUnread ? '700' : '600',
                                        color: isUnread ? '#09090B' : '#27272A',
                                        lineHeight: 20,
                                      }}
                                    >
                                      {stripEmojis(notif.title)}
                                    </Text>
                                    {isUnread && (
                                      <View
                                        style={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: 3,
                                          backgroundColor: '#18181B',
                                        }}
                                      />
                                    )}
                                  </View>

                                  {!isExpanded && (
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        color: '#71717A',
                                        marginTop: 4,
                                        lineHeight: 18,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {stripEmojis(notif.message)}
                                    </Text>
                                  )}
                                </View>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, marginTop: 4 }}>
                                <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                                  {formatRelativeTime(notif.created_at || notif.timestamp || notif.date)}
                                </Text>
                                <View style={{ padding: 2 }}>
                                  <BootstrapIcon
                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={13}
                                    color="#8E8E93"
                                  />
                                </View>
                              </View>
                            </TouchableOpacity>

                            {/* Expanded Card Body */}
                            {isExpanded && (
                              <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }}>
                                <Text
                                  style={{
                                    fontSize: 13.5,
                                    color: '#3F3F46',
                                    lineHeight: 21,
                                    paddingLeft: 50,
                                    marginTop: 2,
                                  }}
                                >
                                  {stripEmojis(notif.message)}
                                </Text>

                                {/* Subtle Divider Line */}
                                <View
                                  style={{
                                    height: 1,
                                    backgroundColor: '#F4F4F5',
                                    marginVertical: 12,
                                    marginLeft: 50,
                                  }}
                                />

                                {/* Footer Row */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingLeft: 50,
                                    flexWrap: 'wrap',
                                    gap: 8,
                                  }}
                                >
                                  <Text style={{ fontSize: 11.5, color: '#8E8E93' }}>
                                    {formatFullDate(notif.created_at || notif.timestamp || notif.date)} · {config.label}
                                  </Text>

                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {(notif.link || notif.type === 'order' || notif.type === 'booking') && (
                                      <TouchableOpacity
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 3,
                                          paddingVertical: 4,
                                          paddingHorizontal: 8,
                                          borderRadius: 6,
                                          backgroundColor: '#FFF7ED',
                                        }}
                                        onPress={() => handleCustomerNotificationPress(notif)}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
                                          {notif.type === 'order' ? 'View Order' : notif.type === 'booking' ? 'View Bay' : 'Open'}
                                        </Text>
                                        <BootstrapIcon name="chevron-right" size={10} color="#EA580C" />
                                      </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 5,
                                        paddingVertical: 4,
                                        paddingHorizontal: 8,
                                        borderRadius: 6,
                                      }}
                                      onPress={(e) => {
                                        e?.stopPropagation?.();
                                        handleDeleteCustomerNotification(notif.id);
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <BootstrapIcon name="trash3" size={12} color="#71717A" />
                                      <Text style={{ fontSize: 11.5, color: '#71717A', fontWeight: '500' }}>Dismiss</Text>
                                    </TouchableOpacity>
                                  </View>
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
                  backgroundColor: '#EA580C',
                  borderColor: '#163527',
                  borderWidth: 1,
                  borderRadius: 16,
                  paddingVertical: 26,
                  paddingHorizontal: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  shadowColor: '#EA580C',
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
                      borderColor: '#EA580C',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 4,
                    }}
                    onPress={handleUploadAvatar}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="camera-fill" size={14} color="#EA580C" />
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
                        style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EA580C', flexDirection: 'row', alignItems: 'center', gap: 5 }}
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
                        style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EA580C', flexDirection: 'row', alignItems: 'center', gap: 5 }}
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
                        style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EA580C', flexDirection: 'row', alignItems: 'center', gap: 5 }}
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
                        backgroundColor: '#FFF7ED',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="person-vcard-fill" size={18} color="#EA580C" />
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
                      backgroundColor: '#EA580C',
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
                      backgroundColor: '#EA580C',
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

      {/* ─── MOTORCYCLE PHOTO VIEWER MODAL ─── */}
      <Modal
        visible={Boolean(viewingPhotoBike)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingPhotoBike(null)}
      >
        <TouchableOpacity
          style={styles.motoPhotoModalOverlay}
          activeOpacity={1}
          onPress={() => setViewingPhotoBike(null)}
        >
          <TouchableOpacity
            style={styles.motoPhotoModalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Header */}
            <View style={styles.motoPhotoModalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.motoPhotoModalTitle} numberOfLines={1}>
                  {viewingPhotoBike?.brand} {viewingPhotoBike?.model}
                </Text>
                {viewingPhotoBike?.nickname ? (
                  <Text style={styles.motoPhotoModalSubtitle}>
                    "{viewingPhotoBike.nickname}"
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.motoPhotoModalCloseBtn}
                onPress={() => setViewingPhotoBike(null)}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            {/* Photo View */}
            <View style={styles.motoPhotoModalImgArea}>
              {resolveMotorcyclePhoto(viewingPhotoBike) ? (
                <Image
                  source={{ uri: resolveMotorcyclePhoto(viewingPhotoBike) }}
                  style={styles.motoPhotoModalImg}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.motoPlaceholderWrap}>
                  <BootstrapIcon name="motorcycle" size={54} color="#94A3B8" />
                  <Text style={[styles.motoNoPhotoText, { fontSize: 12, marginTop: 8 }]}>
                    No motorcycle photo uploaded
                  </Text>
                </View>
              )}
            </View>

            {/* Details & Actions Footer */}
            <View style={styles.motoPhotoModalFooter}>
              <View style={styles.motoPhotoModalSpecsGrid}>
                <View style={styles.motoPhotoModalSpecPill}>
                  <Text style={styles.motoPhotoModalSpecLabel}>Plate</Text>
                  <Text style={styles.motoPhotoModalSpecVal} numberOfLines={1}>
                    {viewingPhotoBike?.plate_number || 'N/A'}
                  </Text>
                </View>
                <View style={styles.motoPhotoModalSpecPill}>
                  <Text style={styles.motoPhotoModalSpecLabel}>Engine</Text>
                  <Text style={styles.motoPhotoModalSpecVal} numberOfLines={1}>
                    {viewingPhotoBike?.engine_cc ? `${viewingPhotoBike.engine_cc} cc` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.motoPhotoModalSpecPill}>
                  <Text style={styles.motoPhotoModalSpecLabel}>Odometer</Text>
                  <Text style={styles.motoPhotoModalSpecVal} numberOfLines={1}>
                    {viewingPhotoBike?.odometer || '0 km'}
                  </Text>
                </View>
              </View>

              <View style={styles.motoPhotoModalActions}>
                <TouchableOpacity
                  style={styles.motoPhotoModalEditBtn}
                  onPress={() => {
                    const bike = viewingPhotoBike;
                    setViewingPhotoBike(null);
                    handleOpenEditMotorcycle(bike);
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="pencil" size={13} color="#FFFFFF" />
                  <Text style={styles.motoPhotoModalEditBtnText}>Edit Bike / Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.motoPhotoModalDismissBtn}
                  onPress={() => setViewingPhotoBike(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.motoPhotoModalDismissBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '90%',
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 20,
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
                  <BootstrapIcon name="pencil-square" size={16} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#0F172A' }}>Edit Profile</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                    Update your personal details & avatar
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditProfileModalOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
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
                    backgroundColor: '#FFF7ED',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                  }}
                  onPress={handleUploadAvatar}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="camera-fill" size={13} color="#EA580C" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>Upload Photo</Text>
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
                style={[styles.saveBtn, { backgroundColor: '#EA580C', marginTop: 14 }]}
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
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChangePasswordModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 20,
              width: '100%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
                marginBottom: 14,
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
                  <BootstrapIcon name="shield-lock" size={16} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#0F172A' }}>Change Password</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                    Set a secure password of at least 8 characters
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsChangePasswordModalOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

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
                  backgroundColor: '#EA580C',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
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
                  paddingVertical: 13,
                  paddingHorizontal: 20,
                  borderRadius: 14,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
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
        animationType="slide"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsLanguageModalOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
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
                      <BootstrapIcon name="globe" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dialogTitle}>Select Language</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                        Choose your preferred app language
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsLanguageModalOpen(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
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
                        <Text style={[styles.dialogSelectionRowText, isSelected && { color: '#EA580C', fontWeight: '700' }]}>
                          {lang}
                        </Text>
                        {isSelected && (
                          <BootstrapIcon name="check-circle-fill" size={17} color="#EA580C" />
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
        animationType="slide"
        onRequestClose={() => setIsPrivacyCheckupOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPrivacyCheckupOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
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
                      <BootstrapIcon name="shield-check" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dialogTitle}>Privacy Checkup</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                        Rider data and security standards
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsPrivacyCheckupOpen(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
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
        animationType="slide"
        onRequestClose={() => setIsContentPrefOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsContentPrefOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
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
                      <BootstrapIcon name="sliders" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dialogTitle}>Content Preferences</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                        Customize feeds and catalog alerts
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsContentPrefOpen(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
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
        animationType="slide"
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsReportModalOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
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
                      <BootstrapIcon name="chat-square-dots-fill" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dialogTitle}>Report a Problem</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                        Help improve your rider experience
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsReportModalOpen(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
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
        animationType="slide"
        onRequestClose={() => setIsDisplayModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsDisplayModalOpen(false)}>
          <View style={styles.dialogOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.dialogCard}>
                <View style={styles.dialogHeader}>
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
                      <BootstrapIcon name="moon-fill" size={16} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dialogTitle}>Display & Accessibility</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                        Visual contrast & theme settings
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsDisplayModalOpen(false)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
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

      {/* ─── RATE DELIVERED ORDER MODAL ─── */}
      <RateDeliveredOrderModal
        visible={isRateModalOpen}
        order={orderToRate}
        currentUser={currentUser}
        onClose={() => {
          setIsRateModalOpen(false);
          setOrderToRate(null);
        }}
        onSubmitSuccess={() => {
          if (orderToRate) {
            const targetId = orderToRate.id || orderToRate.order_id;
            setOrders((prev) =>
              prev.map((o) =>
                (o.id === targetId || o.order_id === targetId)
                  ? { ...o, is_rated: true }
                  : o
              )
            );
          }
          setIsRateModalOpen(false);
          setOrderToRate(null);
        }}
      />

      {/* ─── PERSISTENT MOBILE BOTTOM NAVIGATION (BOTTOM NAVBAR STAYS) ─── */}
      <BottomNavBar
        activeTab={activeTab === 'orders' ? 'Orders' : activeTab === 'garage' ? 'Garage' : 'More'}
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
