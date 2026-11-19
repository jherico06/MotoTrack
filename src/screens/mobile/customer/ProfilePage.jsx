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
  Vibration,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANDROID_TOP_INSET } from '../../../utils/safeArea.js';
import { profileMobileStyles as defaultStyles, createProfileMobileStyles } from '../../../styles/profilePage.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { garageService } from '../../../services/bookings/garageService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { productService } from '../../../services/products/productService.js';
import { compatibilityService } from '../../../services/products/compatibilityService.js';
import { notificationService, stripEmojis } from '../../../services/notifications/notificationService.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { customizationService } from '../../../services/bookings/customizationService.js';
import { appStorage } from '../../../services/system/storageAdapter.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import MobileBottomNavBar from '../../../components/mobile/customer/MobileBottomNavBar.jsx';
import MobileSubmitReportModal from '../../../components/mobile/customer/MobileSubmitReportModal.jsx';
import ProductCard from '../../../components/mobile/customer/ProductCard.jsx';
import { BootstrapIcon, ToastNotification, ToggleSwitch, DeliveryLocationPicker } from '../../../components/common';
import { LiveOrderTrackingMapModal, ConfirmModal, RegisterMotorcycleModal, EditCustomerSettingsModal, CompanyInfoModal, RateDeliveredOrderModal } from '../../../components/modals';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { parseLatLng } from '../../../utils/geo.js';

const APPEARANCE_STORAGE_KEY = 'mototrack_appearance_preset';
const CUSTOM_PREFS_STORAGE_KEY = 'mototrack_app_customizations';

const CHARCOAL_BOTTOM_FADE_GRADIENT =
  'linear-gradient(to bottom, rgba(18, 21, 25, 0) 0%, rgba(18, 21, 25, 0.04) 16%, rgba(18, 21, 25, 0.14) 32%, rgba(18, 21, 25, 0.30) 46%, rgba(18, 21, 25, 0.52) 60%, rgba(18, 21, 25, 0.74) 72%, rgba(18, 21, 25, 0.90) 83%, rgba(18, 21, 25, 0.98) 92%, rgba(18, 21, 25, 1) 100%)';

const FALLBACK_SHOP_PRODUCTS = [
  {
    id: 'rec-01',
    name: 'Brembo 4-Piston Monobloc Radial Caliper Gold Edition',
    price: 3450,
    brand: 'Brembo Racing',
    stock: 12,
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500',
  },
  {
    id: 'rec-02',
    name: 'Quick Tire 60/80-17 Racing Performance Tubeless',
    price: 850,
    brand: 'Quick Tires',
    stock: 20,
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500',
  },
  {
    id: 'rec-03',
    name: 'Yoshimura R-77 Carbon Fiber Full Exhaust System',
    price: 4850,
    brand: 'Yoshimura Pro',
    stock: 8,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500',
  },
  {
    id: 'rec-04',
    name: 'Racing Boy (RCB) Forged Adjustable CNC Alloy Levers',
    price: 1250,
    brand: 'RCB Official',
    stock: 15,
    image: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=500',
  },
  {
    id: 'rec-05',
    name: 'Motul 7100 4T 10W-40 100% Synthetic Engine Oil 1L',
    price: 680,
    brand: 'Motul Pro Gear',
    stock: 24,
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?w=500',
  },
  {
    id: 'rec-06',
    name: 'DID 520 High Strength Gold O-Ring Drive Chain 120L',
    price: 1850,
    brand: 'DID Racing',
    stock: 10,
    image: 'https://images.unsplash.com/photo-1558981854-3252a1a89c89?w=500',
  },
];

const formatShopCatalogProducts = (rawList) =>
  (Array.isArray(rawList) ? rawList : [])
    .filter((p) => p && p.is_active !== false && !p.archived_at && p.status !== 'Archived')
    .map((p, idx) => ({
      ...p,
      id: p.id || p.product_id || `rec-${idx}`,
      rawProduct: p,
      name: p.name || 'High Performance Motor Part',
      price: Number(p.price) || 0,
      brand: p.brand || 'MotoTrack',
      stock: Number(p.stock ?? 0),
      image:
        p.image ||
        p.imageUrl ||
        FALLBACK_SHOP_PRODUCTS[idx % FALLBACK_SHOP_PRODUCTS.length]?.image,
    }));

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu' },
  { label: 'South Poblacion (Store)', address: "D'Blockchain Motorparts and Accessories, Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu" },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu' },
  { label: 'Toledo Junction', address: 'Toledo-Naga Access Road, Uling, City of Naga, Cebu' },
];

const ORDER_STATUS_FILTERS = ['All', 'Out for Delivery', 'Processing', 'Shipped', 'Delivered', 'To Review', 'Cancelled'];

function formatOrderShortDate(rawDate) {
  if (!rawDate) return 'Recent';
  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(rawDate);
}

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

const hasActiveDeliveryKeyword = (s) =>
  s.includes('out') ||
  s.includes('transit') ||
  s.includes('shipped') ||
  s.includes('ready') ||
  s.includes('report') ||
  s.includes('fail') ||
  s.includes('resched');

const isOrderDeliveredOrDone = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (hasActiveDeliveryKeyword(s)) {
    return false;
  }
  return (
    s === 'delivered' ||
    s.includes('delivered') ||
    s.includes('complete') ||
    s === 'received' ||
    s.includes('cancel') ||
    s.includes('refund')
  );
};

const isOrderDelivered = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (hasActiveDeliveryKeyword(s)) {
    return false;
  }
  return s === 'delivered' || s.includes('delivered') || s.includes('complete') || s === 'received';
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

const ALLOWED_PROFILE_TABS = ['overview', 'garage', 'orders', 'notifications', 'profile', 'settings', 'menu'];

let cachedLightProfileStyles = null;
let cachedDarkProfileStyles = null;
function getCachedProfileMobileStyles(isDark) {
  if (isDark) {
    if (!cachedDarkProfileStyles) cachedDarkProfileStyles = createProfileMobileStyles(true);
    return cachedDarkProfileStyles;
  }
  if (!cachedLightProfileStyles) cachedLightProfileStyles = createProfileMobileStyles(false);
  return cachedLightProfileStyles;
}

export default function ProfilePage({
  initialTab = 'overview',
  onNavigateToStore,
  onNavigateToGarage,
  onNavigateToAppointments,
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
  const { isDarkMode, toggleDarkMode, setDarkMode } = useTheme();
  const styles = useMemo(() => getCachedProfileMobileStyles(isDarkMode), [isDarkMode]);
  const scrollViewRef = useRef(null);

  const [appearancePreset, setAppearancePreset] = useState(() => {
    const saved = appStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (saved === 'daylight' || saved === 'darkroom' || saved === 'sage') {
      if (isDarkMode && saved !== 'darkroom') return 'darkroom';
      if (!isDarkMode && saved === 'darkroom') return 'daylight';
      return saved;
    }
    return isDarkMode ? 'darkroom' : 'daylight';
  });

  useEffect(() => {
    if (isDarkMode && appearancePreset !== 'darkroom') {
      setAppearancePreset('darkroom');
    } else if (!isDarkMode && appearancePreset === 'darkroom') {
      setAppearancePreset('daylight');
    }
  }, [isDarkMode, appearancePreset]);

  const [storeCredentials, setStoreCredentials] = useState(() => systemSettingsService.getSettings());
  useEffect(() => {
    const unsub = systemSettingsService.subscribe(setStoreCredentials);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const [customPrefs, setCustomPrefs] = useState(() => {
    try {
      const raw = appStorage.getItem(CUSTOM_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          notifications: parsed?.notifications !== false,
          soundNotification: parsed?.soundNotification !== false,
          vibration: parsed?.vibration !== false,
        };
      }
    } catch (_e) {}
    return { notifications: true, soundNotification: true, vibration: true };
  });

  const handleSelectAppearance = (preset) => {
    setAppearancePreset(preset);
    appStorage.setItem(APPEARANCE_STORAGE_KEY, preset);
    if (typeof setDarkMode === 'function') {
      setDarkMode(preset === 'darkroom');
    } else if ((preset === 'darkroom') !== isDarkMode) {
      toggleDarkMode?.();
    }
  };

  const handleToggleCustomPref = (key, nextVal) => {
    setCustomPrefs((prev) => {
      const updated = { ...prev, [key]: Boolean(nextVal) };
      appStorage.setItem(CUSTOM_PREFS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    if (key === 'vibration' && nextVal && Platform.OS !== 'web') {
      try {
        Vibration.vibrate(25);
      } catch (_e) {}
    }
  };

  const navigateToViewBookings = () => {
    if (typeof onNavigateToAppointments === 'function') {
      onNavigateToAppointments();
    } else {
      onNavigateToGarage?.({ tab: 'appointments' });
    }
  };

  const wishlistCount = wishlistCtx?.wishlistCount || 0;
  const [shopProducts, setShopProducts] = useState(FALLBACK_SHOP_PRODUCTS);

  const resolveTabString = (tabInput) => {
    if (tabInput && typeof tabInput === 'object') return tabInput.tab;
    return tabInput;
  };

  const lastInitialTabPropRef = useRef(initialTab);

  const [isBodyReady, setIsBodyReady] = useState(Platform.OS === 'web');
  useEffect(() => {
    if (isBodyReady) return undefined;
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => setIsBodyReady(true))
        : setTimeout(() => setIsBodyReady(true), 0);
    return () => {
      if (typeof cancelAnimationFrame === 'function' && typeof requestAnimationFrame === 'function') {
        cancelAnimationFrame(raf);
      } else {
        clearTimeout(raf);
      }
    };
  }, [isBodyReady]);

  // Active Tab: 'overview' | 'garage' | 'orders' | 'notifications' | 'profile' | 'settings' | 'menu'
  const [activeTab, setActiveTab] = useState(() => {
    const raw = resolveTabString(initialTab);
    return ALLOWED_PROFILE_TABS.includes(raw) ? raw : 'overview';
  });

  // Synchronously sync activeTab on prop changes before first paint to eliminate navigation glitch/flash
  if (initialTab !== lastInitialTabPropRef.current) {
    lastInitialTabPropRef.current = initialTab;
    const raw = resolveTabString(initialTab);
    if (raw && ALLOWED_PROFILE_TABS.includes(raw) && raw !== activeTab) {
      setActiveTab(raw);
    }
  }

  useEffect(() => {
    const raw = resolveTabString(initialTab);
    if (raw && ALLOWED_PROFILE_TABS.includes(raw)) {
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
  const initialPin = parseLatLng(
    currentUser?.latitude ?? currentUser?.delivery_lat,
    currentUser?.longitude ?? currentUser?.delivery_lng
  );
  const [latitude, setLatitude] = useState(initialPin?.lat ?? null);
  const [longitude, setLongitude] = useState(initialPin?.lng ?? null);
  const [coordError, setCoordError] = useState('');
  const [bio, setBio] = useState(currentUser?.bio || 'Motorcycle Enthusiast & Customer');
  const [deliveryNotes, setDeliveryNotes] = useState(
    currentUser?.deliveryNotes || currentUser?.delivery_notes || ''
  );
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
  const [showSettingsPasswords, setShowSettingsPasswords] = useState(false);
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Orders Filter & Search
  const [orderFilter, setOrderFilter] = useState('All');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [visibleOrdersCount, setVisibleOrdersCount] = useState(12);
  useEffect(() => {
    setVisibleOrdersCount(12);
  }, [orderFilter, orderSearchQuery]);

  // More / Menu Tab Modals
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportContextOrder, setReportContextOrder] = useState(null);
  const [isDisplayModalOpen, setIsDisplayModalOpen] = useState(false);

  // Live Tracking Modal State
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  // Rate Delivered Order Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [orderToRate, setOrderToRate] = useState(null);
  const [expandedOrderMenuId, setExpandedOrderMenuId] = useState(null);

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
  const [failedBikePhotos, setFailedBikePhotos] = useState({});

  const DEFAULT_GARAGE_BIKE_PHOTO =
    'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80';

  const sanitizeBikePhotoUrl = (rawUrl) => {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';
    if (raw.includes('/storage/v1/render/image/public/')) {
      return raw
        .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
        .split('?')[0];
    }
    return raw;
  };

  const resolveMotorcyclePhoto = (bike, ignoreCustomUrl = false) => {
    if (!bike) return null;
    if (!ignoreCustomUrl) {
      const candidates = [
        bike?.photo_url,
        bike?.photoUrl,
        bike?.image,
        bike?.image_url,
        bike?.motorcycle_photo_url,
      ];
      for (const candidate of candidates) {
        const cleaned = sanitizeBikePhotoUrl(candidate);
        if (cleaned) return cleaned;
      }
    }

    const brandLower = (bike?.brand || '').toLowerCase();
    const preset = MOTORCYCLE_PHOTO_PRESETS?.find((p) => brandLower.includes(p.brand.toLowerCase()));
    if (preset?.url) return preset.url;

    return MOTORCYCLE_PHOTO_PRESETS?.[0]?.url || DEFAULT_GARAGE_BIKE_PHOTO;
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
    } catch (_e) { }
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
      navigateToViewBookings();
    } else if (n.link === 'shop' || n.type === 'promo') {
      onNavigateToStore?.();
    }
  };

  const handleDeleteCustomerNotification = async (id) => {
    await notificationService.deleteCustomerNotification(id);
    setNotifications(notificationService.getCustomerNotifications(currentUser?.id));
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
    if (currentUser.deliveryNotes || currentUser.delivery_notes) {
      setDeliveryNotes(currentUser.deliveryNotes || currentUser.delivery_notes);
    }
    const syncedPin = parseLatLng(
      currentUser.latitude ?? currentUser.delivery_lat,
      currentUser.longitude ?? currentUser.delivery_lng
    );
    setLatitude(syncedPin?.lat ?? null);
    setLongitude(syncedPin?.lng ?? null);
    setCoordError('');
  }

  useEffect(() => {
    let unsubGarage = () => { };
    let unsubNotif = () => { };
    let unsubMoto = () => { };
    let unsubOrders = () => { };
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
      } catch (_e) { }

      try {
        const prods = await productService.getProducts();
        if (isSubscribed && Array.isArray(prods) && prods.length > 0) {
          const formatted = formatShopCatalogProducts(prods);
          if (formatted.length > 0) setShopProducts(formatted);
        }
      } catch (_e) { }
    };

    // Defer initial execution so setState is not called synchronously in the effect body
    const initialSyncTimer = setTimeout(syncData, 0);

    try {
      if (typeof garageService?.subscribeBookings === 'function') {
        unsubGarage = garageService.subscribeBookings(syncCustomerBookings);
      } else if (typeof garageService?.subscribe === 'function') {
        unsubGarage = garageService.subscribe(syncCustomerBookings);
      }
    } catch (_e) { }

    try {
      if (typeof notificationService?.subscribe === 'function') {
        unsubNotif = notificationService.subscribe(() => {
          if (isSubscribed) {
            setNotifications(notificationService.getNotifications(currentUser?.id) || []);
          }
        });
      }
    } catch (_e) { }

    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsubMoto = motorcycleService.subscribe((list) => {
          if (isSubscribed) setMotorcycles([...list]);
        });
      }
    } catch (_e) { }

    try {
      if (typeof orderService?.subscribe === 'function') {
        unsubOrders = orderService.subscribe((fresh) => {
          if (isSubscribed && Array.isArray(fresh)) {
            setOrders([...fresh]);
          }
        });
      }
    } catch (_e) { }

    let unsubProd = () => { };
    try {
      if (typeof productService?.subscribe === 'function') {
        unsubProd = productService.subscribe((fresh) => {
          if (isSubscribed && Array.isArray(fresh) && fresh.length > 0) {
            const formatted = formatShopCatalogProducts(fresh);
            if (formatted.length > 0) setShopProducts(formatted);
          }
        });
      }
    } catch (_e) { }

    let unsubCust = () => { };
    let custDebounceTimer = null;
    try {
      refreshCustomizations();
      if (typeof customizationService?.subscribe === 'function') {
        unsubCust = customizationService.subscribe(() => {
          if (!isSubscribed) return;
          if (custDebounceTimer) clearTimeout(custDebounceTimer);
          custDebounceTimer = setTimeout(() => {
            if (isSubscribed) refreshCustomizations();
          }, 800);
        });
      }
    } catch (_e) { }

    return () => {
      isSubscribed = false;
      clearTimeout(initialSyncTimer);
      if (custDebounceTimer) clearTimeout(custDebounceTimer);
      try {
        unsubGarage?.();
        unsubNotif?.();
        unsubMoto?.();
        unsubOrders?.();
        unsubProd?.();
        unsubCust?.();
      } catch (_e) { }
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

  const unreadNotifCount = useMemo(
    () => (Array.isArray(notifications) ? notifications : []).filter((n) => n.status === 'unread').length,
    [notifications]
  );

  // Active Ongoing Order for Live Banner
  const activeOngoingOrder = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    return list.find((o) => !isOrderDeliveredOrDone(o?.status)) || null;
  }, [orders]);

  const sortedOrders = useMemo(() => {
    return sortOrdersByPriority(orders);
  }, [orders]);

  const primaryBike = useMemo(() => {
    const list = Array.isArray(motorcycles) ? motorcycles : [];
    return list.find((m) => m.is_primary) || list[0] || null;
  }, [motorcycles]);

  const recommendedShopProducts = useMemo(() => {
    const list = Array.isArray(shopProducts) ? shopProducts : [];
    if (!primaryBike) return list;
    const compatMap = compatibilityService.getCachedCompatibilityMap?.() || undefined;
    return compatibilityService.annotateProducts(list, primaryBike, compatMap);
  }, [shopProducts, primaryBike]);

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
          }).catch(() => { });
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
        }).catch(() => { });
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

  const coverStorageKey = `mototrack_profile_cover_${currentUser?.id || currentUser?.email || 'guest'}`;
  const sanitizeImageUri = (rawUri) => {
    if (!rawUri || typeof rawUri !== 'string') return null;
    const trimmed = rawUri.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) {
      return trimmed.replace(/[\r\n\s]+/g, '');
    }
    return trimmed;
  };
  const [profileCoverUri, setProfileCoverUri] = useState(() => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const localCover = window.localStorage.getItem(coverStorageKey);
        if (localCover) return sanitizeImageUri(localCover);
      }
      return sanitizeImageUri(currentUser?.coverPhoto || currentUser?.cover_url || appStorage.getItem(coverStorageKey));
    } catch (_e) {
      return null;
    }
  });
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isViewingCoverModal, setIsViewingCoverModal] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCover = async () => {
      try {
        const direct = sanitizeImageUri(currentUser?.coverPhoto || currentUser?.cover_url);
        if (direct) {
          if (active) {
            setCoverImageFailed(false);
            setProfileCoverUri(direct);
          }
          return;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          const localVal = sanitizeImageUri(window.localStorage.getItem(coverStorageKey));
          if (localVal && active) {
            setCoverImageFailed(false);
            setProfileCoverUri(localVal);
            return;
          }
        }
        const asyncVal = sanitizeImageUri(await AsyncStorage.getItem(coverStorageKey));
        if (asyncVal && active) {
          setCoverImageFailed(false);
          setProfileCoverUri(asyncVal);
          return;
        }
        const adapterVal = sanitizeImageUri(appStorage.getItem(coverStorageKey));
        if (adapterVal && active) {
          setCoverImageFailed(false);
          setProfileCoverUri(adapterVal);
        }
      } catch (_e) {}
    };
    loadCover();
    return () => {
      active = false;
    };
  }, [coverStorageKey, currentUser?.coverPhoto, currentUser?.cover_url]);

  const handleUploadCover = async () => {
    if (isUploadingCover) return;
    setIsUploadingCover(true);
    try {
      const res = await pickImageFromFile({ maxDimension: 1080, quality: 0.72 });
      const cleanUri = sanitizeImageUri(res?.uri);
      if (res?.success && cleanUri) {
        setCoverImageFailed(false);
        setProfileCoverUri(cleanUri);
        try {
          await AsyncStorage.setItem(coverStorageKey, cleanUri);
        } catch (_e) {}
        try {
          appStorage.setItem(coverStorageKey, cleanUri);
        } catch (_e) {}
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(coverStorageKey, cleanUri);
          }
        } catch (_e) {}
        showToast('✓ Cover photo updated!');
      } else if (res?.error && !/cancel/i.test(res.error)) {
        showToast(res.error);
      }
    } catch (e) {
      console.warn('Upload cover error:', e);
      showToast('Could not upload cover photo. Please try a smaller image.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = async () => {
    try {
      setProfileCoverUri(null);
      setCoverImageFailed(false);
      setIsViewingCoverModal(false);
      appStorage.removeItem(coverStorageKey);
      await AsyncStorage.removeItem(coverStorageKey);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(coverStorageKey);
      }
      showToast('Cover photo removed.');
    } catch (e) {
      console.warn('Remove cover error:', e);
    }
  };

  const handleUploadAvatar = async () => {
    try {
      const res = await pickImageFromFile({ maxDimension: 640, quality: 0.8 });
      const cleanUri = sanitizeImageUri(res?.uri);
      if (res?.success && cleanUri) {
        if (typeof updateProfile === 'function') {
          await updateProfile({ avatar: cleanUri });
          showToast('✓ Profile picture updated!');
        }
      } else if (res?.error && !/cancel/i.test(res.error)) {
        showToast(res.error);
      }
    } catch (e) {
      console.warn('Upload avatar error:', e);
      showToast('Could not upload profile photo. Please try a smaller image.');
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
    const savedPin = parseLatLng(latitude, longitude);
    if (isEditingGarageInfo && !savedPin) {
      const msg = 'Please set your exact house pin on the map before saving.';
      setCoordError(msg);
      showToast(msg);
      return;
    }
    setCoordError('');
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
          delivery_notes: deliveryNotes.trim(),
          ...(savedPin
            ? {
                latitude: savedPin.lat,
                longitude: savedPin.lng,
                delivery_lat: savedPin.lat,
                delivery_lng: savedPin.lng,
              }
            : {}),
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
      if (payload.deliveryNotes !== undefined) setDeliveryNotes(payload.deliveryNotes);
      const modalPin = parseLatLng(
        payload.latitude ?? payload.delivery_lat,
        payload.longitude ?? payload.delivery_lng
      );
      if (modalPin) {
        setLatitude(modalPin.lat);
        setLongitude(modalPin.lng);
      }
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
    if (isOrderDelivered(order?.status)) {
      showToast('✓ This order has already been delivered and confirmed!');
      return;
    }
    const s = String(order?.status || '').toLowerCase().trim();
    if (s.includes('cancel') || s.includes('refund')) {
      showToast('This order has been cancelled or refunded and can no longer be tracked.');
      return;
    }
    setSelectedOrderForTracking(order);
    setIsLiveTrackingOpen(true);
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
        } catch (_e) { }
      }
    } else if (tab === 'Orders') {
      setActiveTab('orders');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'orders');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        } catch (_e) { }
      }
    } else if (tab === 'More' || tab === 'menu') {
      setActiveTab('menu');
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'menu');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        } catch (_e) { }
      }
    } else if (tab === 'Dashboard') {
      setActiveTab('overview');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else if (tab === 'Bookings') {
      navigateToViewBookings();
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

  const bodyBgColor = isDarkMode
    ? '#121518'
    : appearancePreset === 'sage'
      ? '#ECEFE8'
      : '#F7F5F0';

  const isFullBleedProfile = activeTab === 'profile';
  const RootContainer = isFullBleedProfile ? View : SafeAreaView;

  return (
    <RootContainer
      style={
        isFullBleedProfile
          ? { flex: 1, backgroundColor: bodyBgColor }
          : [styles.safeArea, { backgroundColor: bodyBgColor }]
      }
    >
      <StatusBar style={isFullBleedProfile || isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <ToastNotification message={toastMessage} />

      {/* ─── 1. NATIVE MOBILE APP HEADER (hidden on full-bleed Profile hero) ─── */}
      {!isFullBleedProfile && (
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: bodyBgColor,
            borderBottomWidth:
              activeTab === 'orders' ||
              activeTab === 'garage' ||
              activeTab === 'profile' ||
              activeTab === 'settings' ||
              activeTab === 'notifications'
                ? 0
                : 1,
            borderBottomColor: isDarkMode ? '#2B3035' : '#EDE9E0',
          },
          (activeTab === 'orders' ||
            activeTab === 'garage' ||
            activeTab === 'profile' ||
            activeTab === 'settings' ||
            activeTab === 'notifications') && { paddingTop: 10, paddingBottom: 8 },
        ]}
      >
        {activeTab === 'orders' ||
        activeTab === 'garage' ||
        activeTab === 'profile' ||
        activeTab === 'settings' ||
        activeTab === 'notifications' ? (
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  color: '#EA580C',
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
              >
                {activeTab === 'profile' ? 'MOTOCARE' : 'MOTOTRACK'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: activeTab === 'profile' ? '500' : '600',
                    color: isDarkMode ? '#F9FAFB' : '#18181B',
                    letterSpacing: -0.6,
                  }}
                >
                  {activeTab === 'garage'
                    ? 'My garage'
                    : activeTab === 'profile'
                      ? 'Profile'
                      : activeTab === 'settings'
                        ? 'Settings'
                        : activeTab === 'notifications'
                          ? 'Notifications'
                          : 'Orders'}
                </Text>
                {activeTab === 'notifications' && unreadNotifCount > 0 && (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#EA580C' : '#18181B',
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
            </View>
            {activeTab === 'notifications' ? (
              unreadNotifCount > 0 ? (
                <TouchableOpacity
                  onPress={handleMarkAllCustomerNotificationsRead}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#2B3035' : '#E2E8F0',
                  }}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="check2-all" size={13} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#60A5FA' : '#2563EB' }}>
                    Mark all read
                  </Text>
                </TouchableOpacity>
              ) : null
            ) : (
              <TouchableOpacity
                onPress={() => setActiveTab('notifications')}
                activeOpacity={0.8}
                accessibilityLabel="Notifications"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <BootstrapIcon name="bell" size={18} color={isDarkMode ? '#F9FAFB' : '#18181B'} />
                {unreadNotifCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 9,
                      width: 7,
                      height: 7,
                      borderRadius: 3.5,
                      backgroundColor: '#EA580C',
                    }}
                  />
                ) : null}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={[styles.headerTitle, !isDarkMode && { color: '#0F172A' }]}>
            {activeTab === 'menu' ? 'Menu' : 'Customer Dashboard'}
          </Text>
        )}
      </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={[
          styles.container,
          { backgroundColor: bodyBgColor },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          activeTab === 'menu' && styles.menuScrollContent,
          activeTab === 'profile' && { paddingBottom: 110, paddingHorizontal: 0 }
        ]}
        showsVerticalScrollIndicator={false}
        bounces={!isFullBleedProfile}
        removeClippedSubviews={Platform.OS === 'android'}
      >
        <View style={[
          activeTab === 'profile' ? { width: '100%', paddingHorizontal: 0 } : styles.maxContainer,
          activeTab === 'menu'
            ? { paddingTop: 8 }
            : (activeTab === 'profile' ? { paddingTop: 0 } : { paddingTop: 16 })
        ]}>
          {!isBodyReady ? (
            <View style={{ padding: 20, gap: 12 }}>
              <View style={{ height: 110, borderRadius: 16, backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF', opacity: 0.7 }} />
              <View style={{ height: 140, borderRadius: 16, backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF', opacity: 0.6 }} />
            </View>
          ) : (
            <>
              {/* ═══════════════════════════════════════════════════════
              TAB 0: MENU SCREEN (MATCHING REFERENCE SCREENSHOT)
             ═══════════════════════════════════════════════════════ */}
              {activeTab === 'menu' && (
                <View style={styles.menuContentWrapper}>
                  {/* ═══════════════════════════════════════════════════════
                 ORGANIZED MAIN "MORE" SCREEN (MATCHING REFERENCE SCREENSHOT)
                 ═══════════════════════════════════════════════════════ */}
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
                          <BootstrapIcon name="person-fill" size={24} color={isDarkMode ? '#D1D5DB' : '#65676B'} />
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
                      <BootstrapIcon name="chevron-right" size={15} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

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
                          <BootstrapIcon name="gear-fill" size={17} color={isDarkMode ? '#F3F4F6' : '#050505'} />
                        </View>
                        <Text style={styles.menuRefRowText}>Settings</Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
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
                          <BootstrapIcon name="question-circle-fill" size={17} color={isDarkMode ? '#F3F4F6' : '#050505'} />
                        </View>
                        <Text style={styles.menuRefRowText}>Help & support</Text>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 3. Report a problem */}
                    <TouchableOpacity
                      style={styles.menuRefRowBtn}
                      onPress={() => {
                        setReportContextOrder(null);
                        setIsReportModalOpen(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.menuRefRowLeft}>
                        <View style={styles.menuRefIconWrap}>
                          <BootstrapIcon name="chat-square-dots-fill" size={17} color={isDarkMode ? '#F3F4F6' : '#050505'} />
                        </View>
                        <View>
                          <Text style={styles.menuRefRowText}>Report a problem</Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#9CA3AF' : '#65676B', marginTop: 1 }}>Feedback & bug reporting</Text>
                        </View>
                      </View>
                      <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
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
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#9CA3AF' : '#65676B', marginTop: 1 }}>
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
                          <BootstrapIcon name="box-seam" size={17} color={isDarkMode ? '#F3F4F6' : '#050505'} />
                        </View>
                        <Text style={styles.menuRefRowText}>Orders & Tracking</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {orders.length > 0 && (
                          <View style={styles.menuRefCountBadge}>
                            <Text style={styles.menuRefCountBadgeText}>{orders.length}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
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
                          <BootstrapIcon name="tools" size={17} color={isDarkMode ? '#F3F4F6' : '#050505'} />
                        </View>
                        <Text style={styles.menuRefRowText}>My Garage</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {motorcycles.length > 0 && (
                          <View style={styles.menuRefCountBadge}>
                            <Text style={styles.menuRefCountBadgeText}>{motorcycles.length}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.menuRefHairline} />

                    {/* 3. Notification */}
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
                          <BootstrapIcon name="bell" size={17} color={isDarkMode ? '#F3F4F6' : '#050505'} />
                        </View>
                        <Text style={styles.menuRefRowText}>Notification</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {unreadNotifCount > 0 && (
                          <View style={[styles.menuRefCountBadge, { backgroundColor: '#EF4444' }]}>
                            <Text style={styles.menuRefCountBadgeText}>{unreadNotifCount}</Text>
                          </View>
                        )}
                        <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
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
                            <View style={[styles.menuRefIconWrap, { backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED' }]}>
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
                          <View style={[styles.menuRefIconWrap, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2' }]}>
                            <BootstrapIcon name="box-arrow-right" size={17} color={isDarkMode ? '#F87171' : '#DC2626'} />
                          </View>
                          <Text style={[styles.menuRefRowText, { color: isDarkMode ? '#F87171' : '#DC2626', fontWeight: '700' }]}>Log out</Text>
                        </View>
                        <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.menuRefRowBtn}
                        onPress={() => onNavigateToLogin?.()}
                        activeOpacity={0.7}
                      >
                        <View style={styles.menuRefRowLeft}>
                          <View style={[styles.menuRefIconWrap, { backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED' }]}>
                            <BootstrapIcon name="box-arrow-in-right" size={17} color="#EA580C" />
                          </View>
                          <Text style={[styles.menuRefRowText, { color: '#EA580C', fontWeight: '700' }]}>Sign In / Register</Text>
                        </View>
                        <BootstrapIcon name="chevron-right" size={14} color={isDarkMode ? '#9CA3AF' : '#8A8D91'} />
                      </TouchableOpacity>
                    )}
                  </View>
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
                      onPress={navigateToViewBookings}
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
                          <BootstrapIcon name="bookmark-fill" size={16} color="#FFFFFF" />
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
                      onPress={() => onNavigateToGarage?.()}
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
                <View style={{ paddingBottom: 20 }}>
                  {/* Register a motorcycle CTA Button (soft peach outline pill) */}
                  <TouchableOpacity
                    onPress={handleOpenAddMotorcycle}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.12)' : '#FDF4EE',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.35)' : '#F5D5C0',
                      borderRadius: 16,
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginBottom: 16,
                    }}
                  >
                    <BootstrapIcon name="plus" size={18} color="#EA580C" />
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: '600',
                        color: '#EA580C',
                      }}
                    >
                      Register a motorcycle
                    </Text>
                  </TouchableOpacity>

                  {motorcycles.length === 0 ? (
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                        paddingVertical: 36,
                        paddingHorizontal: 20,
                        alignItems: 'center',
                        marginBottom: 20,
                      }}
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: isDarkMode ? '#2B1A0A' : '#FFF0E6',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 14,
                        }}
                      >
                        <BootstrapIcon name="motorcycle" size={26} color="#EA580C" />
                      </View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: isDarkMode ? '#F9FAFB' : '#18181B',
                          marginBottom: 6,
                        }}
                      >
                        Your garage is empty
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: isDarkMode ? '#94A3B8' : '#71717A',
                          textAlign: 'center',
                          lineHeight: 19,
                          marginBottom: 18,
                        }}
                      >
                        Register your ride to track service intervals and book pitstop appointments with 1 tap.
                      </Text>
                      <TouchableOpacity
                        onPress={handleOpenAddMotorcycle}
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: isDarkMode ? '#EA580C' : '#141414',
                          borderRadius: 999,
                          paddingHorizontal: 20,
                          paddingVertical: 11,
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#FFFFFF' }}>
                          Register a motorcycle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    motorcycles.map((bike, bikeIndex) => {
                      const bikeKey = String(bike.motorcycle_id || bike.id || bikeIndex);
                      const bikePhoto = resolveMotorcyclePhoto(bike, Boolean(failedBikePhotos[bikeKey]));
                      const rawOdoNum = Number(String(bike.odometer || '').replace(/[^0-9.]/g, ''));
                      const formattedOdo =
                        Number.isFinite(rawOdoNum) && rawOdoNum > 0
                          ? `${Math.round(rawOdoNum).toLocaleString()} km`
                          : bike.odometer
                            ? String(bike.odometer)
                            : '0 km';
                      const yearOdoLine = bike.year
                        ? `${bike.year} · ${formattedOdo}`
                        : formattedOdo;

                      // Find an active upcoming booking for this bike if available
                      const bikeBrandLower = String(bike.brand || '').trim().toLowerCase();
                      const bikeModelLower = String(bike.model || '').trim().toLowerCase();
                      const matchingBooking = (Array.isArray(bookings) ? bookings : []).find((b) => {
                        const st = String(b?.status || '').toLowerCase();
                        if (['cancelled', 'rejected', 'closed', 'service done', 'paid'].includes(st)) {
                          return false;
                        }
                        const bVehicle = String(b?.bike_brand || b?.bikeBrand || b?.vehicle || '').toLowerCase();
                        const bModel = String(b?.bike_model || b?.bikeModel || '').toLowerCase();
                        if (bikeBrandLower && bVehicle.includes(bikeBrandLower)) {
                          return !bikeModelLower || !bModel || bModel.includes(bikeModelLower) || bVehicle.includes(bikeModelLower);
                        }
                        return motorcycles.length === 1;
                      });

                      let nextServiceValue = '1,000 km';
                      if (matchingBooking) {
                        const rawSched = matchingBooking.schedule || matchingBooking.scheduled_date || matchingBooking.preferred_date;
                        if (rawSched) {
                          const d = new Date(rawSched);
                          nextServiceValue = !Number.isNaN(d.getTime())
                            ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : String(rawSched);
                        } else {
                          nextServiceValue = matchingBooking.status || 'Scheduled';
                        }
                      } else if (Number.isFinite(rawOdoNum) && rawOdoNum > 0) {
                        const remainder = 1000 - (Math.round(rawOdoNum) % 1000);
                        nextServiceValue = `${remainder.toLocaleString()} km`;
                      }

                      return (
                        <TouchableOpacity
                          key={bikeKey}
                          onPress={() => setViewingPhotoBike(bike)}
                          activeOpacity={0.94}
                          style={{
                            borderRadius: 22,
                            height: 320,
                            position: 'relative',
                            overflow: 'hidden',
                            marginBottom: 18,
                            backgroundColor: bikePhoto ? (isDarkMode ? '#1C1F23' : '#FFFFFF') : '#27272A',
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#E5E7EB',
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.1,
                            shadowRadius: 14,
                            elevation: 4,
                          }}
                        >
                          {/* Full-bleed Motorcycle Photo */}
                          {bikePhoto ? (
                            <Image
                              source={{ uri: bikePhoto }}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 0,
                              }}
                              resizeMode="cover"
                              onError={() => {
                                if (!failedBikePhotos[bikeKey]) {
                                  setFailedBikePhotos((prev) => ({ ...prev, [bikeKey]: true }));
                                }
                              }}
                            />
                          ) : (
                            <View
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 0,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#27272A',
                              }}
                            >
                              <BootstrapIcon name="motorcycle" size={68} color="rgba(255, 255, 255, 0.2)" />
                            </View>
                          )}

                          {/* Seamless Eased Charcoal Bottom Fade (matches Profile cover) */}
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: '72%',
                              zIndex: 2,
                              backgroundImage: CHARCOAL_BOTTOM_FADE_GRADIENT,
                            }}
                          />

                          {/* Card Overlay Content */}
                          <View
                            style={{
                              flex: 1,
                              zIndex: 5,
                              justifyContent: 'space-between',
                              padding: 16,
                            }}
                          >
                            {/* Top-left High-Contrast Primary Badge */}
                            <View style={{ alignItems: 'flex-start' }}>
                              {bike.is_primary ? (
                                <View
                                  style={{
                                    backgroundColor: '#F5B82E',
                                    borderRadius: 999,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.16,
                                    shadowRadius: 4,
                                    elevation: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '800',
                                      letterSpacing: 0.7,
                                      color: '#18181B',
                                    }}
                                  >
                                    PRIMARY RIDE
                                  </Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={(e) => {
                                    e?.stopPropagation?.();
                                    handleSetPrimaryBike(bike);
                                  }}
                                  activeOpacity={0.85}
                                  style={{
                                    backgroundColor: 'rgba(36, 39, 43, 0.84)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.24)',
                                    borderRadius: 999,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.18,
                                    shadowRadius: 4,
                                    elevation: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      letterSpacing: 0.7,
                                      color: '#FFFFFF',
                                    }}
                                  >
                                    SET AS PRIMARY
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Bottom Bike Info Over Edge-to-Edge Charcoal Frost */}
                            <View>
                              <Text
                                style={{
                                  fontSize: 20,
                                  fontWeight: '700',
                                  color: '#FFFFFF',
                                  letterSpacing: -0.3,
                                  textShadowColor: 'rgba(0, 0, 0, 0.35)',
                                  textShadowOffset: { width: 0, height: 1 },
                                  textShadowRadius: 3,
                                }}
                                numberOfLines={1}
                              >
                                {bike.brand} {bike.model}
                              </Text>

                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: '500',
                                  color: 'rgba(226, 232, 240, 0.92)',
                                  marginTop: 2,
                                }}
                                numberOfLines={1}
                              >
                                {yearOdoLine}
                              </Text>

                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'flex-end',
                                  justifyContent: 'space-between',
                                  marginTop: 12,
                                  gap: 12,
                                }}
                              >
                                <View>
                                  <Text
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: '700',
                                      letterSpacing: 0.8,
                                      color: 'rgba(203, 213, 225, 0.85)',
                                      textTransform: 'uppercase',
                                      marginBottom: 2,
                                    }}
                                  >
                                    NEXT SERVICE
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 17,
                                      fontWeight: '700',
                                      color: '#FFFFFF',
                                      fontVariant: ['tabular-nums'],
                                    }}
                                    numberOfLines={1}
                                  >
                                    {nextServiceValue}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  onPress={(e) => {
                                    e?.stopPropagation?.();
                                    setViewingPhotoBike(bike);
                                  }}
                                  activeOpacity={0.88}
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: 12,
                                    paddingHorizontal: 14,
                                    paddingVertical: 9,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12.5,
                                      fontWeight: '700',
                                      color: '#141414',
                                    }}
                                  >
                                    View details
                                  </Text>
                                  <BootstrapIcon name="arrow-right" size={13} color="#141414" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  {/* MAINTENANCE Section */}
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '700',
                      letterSpacing: 1.2,
                      color: '#EA580C',
                      textTransform: 'uppercase',
                      marginTop: 4,
                      marginBottom: 10,
                    }}
                  >
                    MAINTENANCE
                  </Text>

                  {Array.isArray(bookings) && bookings.length > 0 ? (
                    bookings.slice(0, 2).map((b) => {
                      const statusStr = String(b.status || 'Pending');
                      const statusLower = statusStr.toLowerCase();
                      const badgeBg =
                        statusLower.includes('done') || statusLower.includes('paid')
                          ? '#E6F7F0'
                          : statusLower.includes('cancel') || statusLower.includes('reject')
                            ? '#FEE2E2'
                            : '#FFF0E6';
                      const badgeText =
                        statusLower.includes('done') || statusLower.includes('paid')
                          ? '#0F9D68'
                          : statusLower.includes('cancel') || statusLower.includes('reject')
                            ? '#DC2626'
                            : '#EA580C';

                      return (
                        <View
                          key={b.id}
                          style={{
                            backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                            padding: 15,
                            marginBottom: 10,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 6,
                              gap: 8,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: isDarkMode ? '#94A3B8' : '#A1A1AA',
                                  marginBottom: 2,
                                }}
                              >
                                {b.schedule || b.preferred_date || 'Scheduled Service'}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: '600',
                                  color: isDarkMode ? '#F9FAFB' : '#18181B',
                                }}
                                numberOfLines={1}
                              >
                                {b.service_title || b.serviceName || 'Service Appointment'}
                              </Text>
                            </View>
                            <View
                              style={{
                                backgroundColor: badgeBg,
                                borderRadius: 999,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '600', color: badgeText }}>
                                {statusStr}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: 8,
                              paddingTop: 10,
                              borderTopWidth: 1,
                              borderTopColor: isDarkMode ? '#2B3035' : '#F3EFE6',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12.5,
                                color: isDarkMode ? '#94A3B8' : '#71717A',
                              }}
                              numberOfLines={1}
                            >
                              {b.bike_brand || b.bikeBrand || 'Registered Bike'}
                            </Text>
                            <TouchableOpacity
                              onPress={navigateToViewBookings}
                              activeOpacity={0.85}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#EA580C' }}>
                                View booking
                              </Text>
                              <BootstrapIcon name="arrow-right" size={12} color="#EA580C" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#2B1A0A' : '#FFF0E6',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="wrench-adjustable" size={17} color="#EA580C" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '600',
                              color: isDarkMode ? '#F9FAFB' : '#18181B',
                            }}
                          >
                            Keep your bike tuned
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? '#94A3B8' : '#71717A',
                              marginTop: 2,
                            }}
                          >
                            Book a PMS check or repair slot
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={onNavigateToGarage}
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: isDarkMode ? '#EA580C' : '#141414',
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' }}>
                          Book
                        </Text>
                        <BootstrapIcon name="arrow-right" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
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

                  {/* Rounded Pill Search Input */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                      paddingHorizontal: 14,
                      height: 46,
                      gap: 10,
                      marginBottom: 14,
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.03,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <BootstrapIcon name="search" size={16} color={isDarkMode ? '#94A3B8' : '#9CA3AF'} />
                    <TextInput
                      style={{
                        flex: 1,
                        color: isDarkMode ? '#F9FAFB' : '#18181B',
                        fontSize: 13.5,
                        height: '100%',
                        fontFamily: 'PlusJakartaSans',
                      }}
                      placeholder="Search order number or item"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                      value={orderSearchQuery}
                      onChangeText={setOrderSearchQuery}
                    />
                    {orderSearchQuery ? (
                      <TouchableOpacity onPress={() => setOrderSearchQuery('')} activeOpacity={0.7}>
                        <BootstrapIcon name="x-circle-fill" size={16} color={isDarkMode ? '#94A3B8' : '#9CA3AF'} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Status Filter Chips Row */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
                    style={{ marginBottom: 16 }}
                  >
                    {ORDER_STATUS_FILTERS.map((statusKey) => {
                      const isActive = orderFilter === statusKey;
                      return (
                        <TouchableOpacity
                          key={statusKey}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 8.5,
                            borderRadius: 9999,
                            backgroundColor: isActive
                              ? isDarkMode
                                ? '#EA580C'
                                : '#141414'
                              : isDarkMode
                                ? '#1C1F23'
                                : '#FFFFFF',
                            borderWidth: 1,
                            borderColor: isActive
                              ? isDarkMode
                                ? '#EA580C'
                                : '#141414'
                              : isDarkMode
                                ? '#2B3035'
                                : '#EDE9E0',
                          }}
                          onPress={() => setOrderFilter(statusKey)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: isActive ? '600' : '500',
                              color: isActive ? '#FFFFFF' : isDarkMode ? '#E5E7EB' : '#52525B',
                            }}
                          >
                            {statusKey === 'Out for Delivery' ? 'Out for delivery' : statusKey}
                          </Text>
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

                      {/* 2-Column Product Grid (Reusing Shop ProductCard) */}
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          rowGap: 10,
                          width: '100%',
                        }}
                      >
                        {recommendedShopProducts.slice(0, 8).map((prod, idx) => (
                          <ProductCard
                            key={prod.id || `rec-${idx}`}
                            product={prod}
                            bike={primaryBike}
                            containerPadding={16}
                            onPress={(selectedProd) => {
                              const target = selectedProd?.rawProduct || selectedProd;
                              if (typeof onNavigateToProductDetails === 'function') {
                                onNavigateToProductDetails(target);
                              } else if (typeof onNavigateToStore === 'function') {
                                onNavigateToStore(target);
                              }
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  ) : (
                    <>
                      {filteredOrders.slice(0, visibleOrdersCount).map((o) => {
                        const orderKey = String(o.id || o.order_id || '');
                        const statusLower = String(o.status || 'Processing').toLowerCase();
                        const statusPill = isOrderDelivered(o.status)
                          ? {
                            bg: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E6F7F0',
                            text: isDarkMode ? '#34D399' : '#15803D',
                          }
                          : statusLower.includes('cancel') || statusLower.includes('refund') || statusLower.includes('fail')
                            ? {
                              bg: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
                              text: isDarkMode ? '#F87171' : '#B91C1C',
                            }
                            : statusLower.includes('out') ||
                              statusLower.includes('ship') ||
                              statusLower.includes('way') ||
                              statusLower.includes('ready') ||
                              statusLower.includes('assign') ||
                              statusLower.includes('accept')
                              ? {
                                bg: isDarkMode ? 'rgba(234, 88, 12, 0.18)' : '#FFF0E6',
                                text: isDarkMode ? '#FB923C' : '#EA580C',
                              }
                              : {
                                bg: isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
                                text: isDarkMode ? '#FBBF24' : '#B45309',
                              };
                        const grandTotal = getOrderGrandTotal(o);
                        const isDone = isOrderDeliveredOrDone(o.status);
                        const dateStr = formatOrderShortDate(o.orderDate || o.createdAt || o.created_at);
                        const displayOrderId = orderKey.replace(/^#/, '');
                        const orderItemsList =
                          Array.isArray(o.items) && o.items.length > 0
                            ? o.items
                            : [
                              {
                                name: o.itemsSummary || 'Motorcycle Part',
                                price: grandTotal || 0,
                                quantity: 1,
                                image: o.image || o.imageUrl,
                              },
                            ];
                        const isExpandedMenu = expandedOrderMenuId === orderKey;
                        const showRatePrimary =
                          orderFilter === 'To Review' && isOrderDelivered(o.status) && !o.is_rated;

                        return (
                          <View
                            key={orderKey || Math.random().toString()}
                            style={{
                              backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                              borderRadius: 20,
                              borderWidth: 1,
                              borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                              padding: 16,
                              marginBottom: 14,
                              shadowColor: '#0F172A',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isDarkMode ? 0.15 : 0.03,
                              shadowRadius: 8,
                              elevation: 2,
                            }}
                          >
                            {/* Top Header: Date & Order ID on left, Soft Status Pill on right */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                              }}
                            >
                              <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    color: isDarkMode ? '#94A3B8' : '#9CA3AF',
                                    fontWeight: '500',
                                  }}
                                >
                                  {dateStr}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 15,
                                    fontWeight: '600',
                                    color: isDarkMode ? '#F9FAFB' : '#18181B',
                                    marginTop: 2,
                                    fontVariant: ['tabular-nums'],
                                  }}
                                  numberOfLines={1}
                                >
                                  {displayOrderId}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View
                                  style={{
                                    backgroundColor: statusPill.bg,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 9999,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '600',
                                      color: statusPill.text,
                                    }}
                                  >
                                    {o.status || 'Processing'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  onPress={() =>
                                    setExpandedOrderMenuId((prev) => (prev === orderKey ? null : orderKey))
                                  }
                                  activeOpacity={0.7}
                                  accessibilityLabel="Order actions"
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 13,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <BootstrapIcon
                                    name="three-dots"
                                    size={14}
                                    color={isDarkMode ? '#94A3B8' : '#9CA3AF'}
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Nested Sand-White Items Box */}
                            <View
                              style={{
                                backgroundColor: isDarkMode ? '#23272B' : '#FBF9F5',
                                borderRadius: 14,
                                padding: 12,
                                marginTop: 14,
                                marginBottom: 14,
                                borderWidth: 1,
                                borderColor: isDarkMode ? '#2B3035' : '#F3EFE6',
                              }}
                            >
                              {orderItemsList.map((it, idx) => {
                                const itemName = it.name || it.product_name || 'Motorcycle Part';
                                const itemPrice =
                                  Number(it.price || it.cost || it.unit_cost || 0) || grandTotal;
                                const itemQty = Number(it.quantity) || 1;

                                return (
                                  <View
                                    key={idx}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      paddingTop: idx > 0 ? 10 : 0,
                                      marginTop: idx > 0 ? 10 : 0,
                                      borderTopWidth: idx > 0 ? 1 : 0,
                                      borderTopColor: isDarkMode ? '#2E343B' : '#EFEBE0',
                                      gap: 12,
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 11,
                                        backgroundColor: isDarkMode
                                          ? 'rgba(234, 88, 12, 0.16)'
                                          : '#FFF0E6',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <BootstrapIcon name="box" size={18} color="#EA580C" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text
                                        style={{
                                          fontSize: 13.5,
                                          fontWeight: '600',
                                          color: isDarkMode ? '#F9FAFB' : '#18181B',
                                        }}
                                        numberOfLines={1}
                                      >
                                        {itemName}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: 11.5,
                                          color: isDarkMode ? '#94A3B8' : '#9CA3AF',
                                          marginTop: 2,
                                        }}
                                        numberOfLines={1}
                                      >
                                        Qty: {itemQty} · Standard delivery
                                      </Text>
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 13.5,
                                        fontWeight: '600',
                                        color: isDarkMode ? '#F9FAFB' : '#18181B',
                                        fontVariant: ['tabular-nums'],
                                      }}
                                    >
                                      ₱{(itemPrice * itemQty).toLocaleString()}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>

                            {/* Hairline Divider & Footer Row */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: isDarkMode ? '#2B3035' : '#F3EFE6',
                              }}
                            >
                              <View>
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    color: isDarkMode ? '#94A3B8' : '#9CA3AF',
                                    fontWeight: '500',
                                    marginBottom: 2,
                                  }}
                                >
                                  Total amount
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 20,
                                    fontWeight: '700',
                                    color: '#EA580C',
                                    letterSpacing: -0.4,
                                    fontVariant: ['tabular-nums'],
                                  }}
                                >
                                  ₱{grandTotal.toLocaleString()}
                                </Text>
                              </View>

                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  backgroundColor: showRatePrimary
                                    ? '#EA580C'
                                    : isDarkMode
                                      ? '#EA580C'
                                      : '#141414',
                                  paddingHorizontal: 16,
                                  paddingVertical: 10,
                                  borderRadius: 12,
                                }}
                                onPress={() => {
                                  if (showRatePrimary) {
                                    handleOpenRateModal(o);
                                  } else if (!isDone) {
                                    handleTrackOrder(o);
                                  } else if (typeof addToCart === 'function') {
                                    orderItemsList.forEach((it) => {
                                      addToCart(it, it.quantity || 1, it.size || '');
                                    });
                                    showToast('Added items back to shopping bag!');
                                  } else {
                                    onNavigateToStore?.();
                                  }
                                }}
                                activeOpacity={0.82}
                              >
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: '600',
                                    color: '#FFFFFF',
                                  }}
                                >
                                  {showRatePrimary
                                    ? 'Rate order'
                                    : !isDone
                                      ? 'Track order'
                                      : 'Buy again'}
                                </Text>
                                <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>

                            {/* Optional Secondary Actions Drawer (toggled via ••• button) */}
                            {isExpandedMenu && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginTop: 12,
                                  paddingTop: 10,
                                  borderTopWidth: 1,
                                  borderTopColor: isDarkMode ? '#2B3035' : '#F3EFE6',
                                }}
                              >
                                {!isDone && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setExpandedOrderMenuId(null);
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
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                      paddingHorizontal: 11,
                                      paddingVertical: 6,
                                      borderRadius: 9,
                                      backgroundColor: isDarkMode ? '#23272B' : '#FBF9F5',
                                      borderWidth: 1,
                                      borderColor: isDarkMode ? '#334155' : '#EDE9E0',
                                    }}
                                  >
                                    <BootstrapIcon
                                      name="arrow-repeat"
                                      size={12}
                                      color={isDarkMode ? '#E2E8F0' : '#18181B'}
                                    />
                                    <Text
                                      style={{
                                        fontSize: 11.5,
                                        fontWeight: '600',
                                        color: isDarkMode ? '#E2E8F0' : '#18181B',
                                      }}
                                    >
                                      Buy again
                                    </Text>
                                  </TouchableOpacity>
                                )}

                                {isOrderDelivered(o.status) && !o.is_rated && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setExpandedOrderMenuId(null);
                                      handleOpenRateModal(o);
                                    }}
                                    activeOpacity={0.8}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                      paddingHorizontal: 11,
                                      paddingVertical: 6,
                                      borderRadius: 9,
                                      backgroundColor: '#FFF7ED',
                                      borderWidth: 1,
                                      borderColor: '#FED7AA',
                                    }}
                                  >
                                    <BootstrapIcon name="star-fill" size={11} color="#EA580C" />
                                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#EA580C' }}>
                                      To Review
                                    </Text>
                                  </TouchableOpacity>
                                )}

                                {!(o.status || '').toLowerCase().includes('cancel') && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setExpandedOrderMenuId(null);
                                      setReportContextOrder(o);
                                      setIsReportModalOpen(true);
                                    }}
                                    activeOpacity={0.8}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                      paddingHorizontal: 11,
                                      paddingVertical: 6,
                                      borderRadius: 9,
                                      backgroundColor: isDarkMode ? '#23272B' : '#FBF9F5',
                                      borderWidth: 1,
                                      borderColor: isDarkMode ? '#334155' : '#EDE9E0',
                                    }}
                                  >
                                    <BootstrapIcon name="flag-fill" size={11} color="#EA580C" />
                                    <Text
                                      style={{
                                        fontSize: 11.5,
                                        fontWeight: '600',
                                        color: isDarkMode ? '#E2E8F0' : '#18181B',
                                      }}
                                    >
                                      Report
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {filteredOrders.length > visibleOrdersCount && (
                        <TouchableOpacity
                          onPress={() => setVisibleOrdersCount((prev) => prev + 12)}
                          activeOpacity={0.85}
                          style={{
                            alignSelf: 'center',
                            marginTop: 6,
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            borderRadius: 9999,
                            backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#EDE9E0',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F9FAFB' : '#18181B' }}>
                            Show more orders ({filteredOrders.length - visibleOrdersCount} remaining)
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* ═══════════════════════════════════════════════════════
              TAB 5: NOTIFICATIONS & ALERTS
             ═══════════════════════════════════════════════════════ */}
              {activeTab === 'notifications' && (
                <View style={{ paddingBottom: 24, gap: 14 }}>
                  {/* Search Box matching Web */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#2B3035' : '#E2E8F0',
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      marginTop: 2,
                    }}
                  >
                    <BootstrapIcon name="search" size={14} color={isDarkMode ? '#6B7280' : '#94A3B8'} />
                    <TextInput
                      style={{ flex: 1, fontSize: 13.5, color: isDarkMode ? '#F3F4F6' : '#0F172A', padding: 0 }}
                      placeholder="Search notifications..."
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#94A3B8'}
                      value={notifSearchQuery}
                      onChangeText={setNotifSearchQuery}
                    />
                    {Boolean(notifSearchQuery) && (
                      <TouchableOpacity onPress={() => setNotifSearchQuery('')} activeOpacity={0.7}>
                        <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? '#6B7280' : '#94A3B8'} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Filter Pills matching Web (Dark active #EA580C/#18181B) */}
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
                            backgroundColor: isActive
                              ? isDarkMode
                                ? '#EA580C'
                                : '#18181B'
                              : isDarkMode
                                ? '#1C1F23'
                                : '#F1F5F9',
                            borderWidth: 1,
                            borderColor: isActive
                              ? isDarkMode
                                ? '#EA580C'
                                : '#18181B'
                              : isDarkMode
                                ? '#2B3035'
                                : '#E2E8F0',
                          }}
                          onPress={() => setNotifFilter(f.id)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: isActive ? '700' : '600',
                              color: isActive ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
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
                        backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#2B3035' : '#E2E8F0',
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
                          backgroundColor: isDarkMode ? '#252A30' : '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <BootstrapIcon name="bell-slash" size={26} color={isDarkMode ? '#6B7280' : '#94A3B8'} />
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: isDarkMode ? '#F9FAFB' : '#18181B' }}>
                        No notifications
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? '#9CA3AF' : '#64748B', marginTop: 4, textAlign: 'center' }}>
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
                          <Text style={{ fontSize: 12, fontWeight: '800', color: isDarkMode ? '#9CA3AF' : '#71717A', letterSpacing: 0.8 }}>
                            {section.title}
                          </Text>
                          <View
                            style={{
                              minWidth: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: isDarkMode ? '#252A30' : '#E4E4E7',
                              borderWidth: isDarkMode ? 1 : 0,
                              borderColor: '#2B3035',
                              paddingHorizontal: 6,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#D1D5DB' : '#52525B' }}>
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
                                  borderColor: isDarkMode
                                    ? isUnread
                                      ? '#374151'
                                      : '#2B3035'
                                    : isUnread
                                      ? '#CBD5E1'
                                      : '#E4E4E7',
                                  backgroundColor: isDarkMode ? (isUnread ? '#20242B' : '#1C1F23') : '#FFFFFF',
                                  overflow: 'hidden',
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: isDarkMode ? 0.2 : 0.04,
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
                                        backgroundColor: isDarkMode ? `${config.color}24` : config.bg,
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
                                            color: isDarkMode
                                              ? isUnread
                                                ? '#F9FAFB'
                                                : '#E5E7EB'
                                              : isUnread
                                                ? '#09090B'
                                                : '#27272A',
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
                                              backgroundColor: isDarkMode ? '#EA580C' : '#18181B',
                                            }}
                                          />
                                        )}
                                      </View>

                                      {!isExpanded && (
                                        <Text
                                          style={{
                                            fontSize: 13,
                                            color: isDarkMode ? '#9CA3AF' : '#71717A',
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
                                    <Text style={{ fontSize: 12, color: isDarkMode ? '#9CA3AF' : '#8E8E93' }}>
                                      {formatRelativeTime(notif.created_at || notif.timestamp || notif.date)}
                                    </Text>
                                    <View style={{ padding: 2 }}>
                                      <BootstrapIcon
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={13}
                                        color={isDarkMode ? '#9CA3AF' : '#8E8E93'}
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
                                        color: isDarkMode ? '#D1D5DB' : '#3F3F46',
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
                                        backgroundColor: isDarkMode ? '#2B3035' : '#F4F4F5',
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
                                      <Text style={{ fontSize: 11.5, color: isDarkMode ? '#9CA3AF' : '#8E8E93' }}>
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
                                              backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
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
                                          <BootstrapIcon name="trash3" size={12} color={isDarkMode ? '#9CA3AF' : '#71717A'} />
                                          <Text style={{ fontSize: 11.5, color: isDarkMode ? '#9CA3AF' : '#71717A', fontWeight: '500' }}>Dismiss</Text>
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
              {activeTab === 'profile' && (() => {
                const cardBg = isDarkMode ? '#1C1F23' : '#FFFFFF';
                const cardBorder = isDarkMode ? '#2B3035' : '#EDE9E0';
                const titleText = isDarkMode ? '#F9FAFB' : '#18181B';
                const labelText = isDarkMode ? '#9CA3AF' : '#71717A';
                const dividerColor = isDarkMode ? '#2B3035' : '#F1EFEA';
                const inputStyle = {
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#374151' : '#E4E4E7',
                  backgroundColor: isDarkMode ? '#14171A' : '#FAFAF8',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 13,
                  color: titleText,
                };

                const fullDisplayName = (firstName || lastName)
                  ? [firstName, lastName].filter(Boolean).join(' ')
                  : (name || currentUser?.name || currentUser?.fullName || 'Rider Account');

                const initials = fullDisplayName
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('') || 'MT';

                const profileHandle = currentUser?.username
                  ? `@${String(currentUser.username).replace(/^@/, '')}`
                  : currentUser?.email
                    ? `@${String(currentUser.email).split('@')[0]}`
                    : '@rider';

                const profileTopInset =
                  Platform.OS === 'ios'
                    ? Math.max(Number(Constants.statusBarHeight) || 0, 50)
                    : ANDROID_TOP_INSET + 12;

                const profileStats = [
                  {
                    label: 'Bikes',
                    value: motorcycles.length,
                    onPress: () => {
                      setActiveTab('garage');
                      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                    },
                  },
                  {
                    label: 'Orders',
                    value: orders.length,
                    onPress: () => {
                      setActiveTab('orders');
                      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                    },
                  },
                  {
                    label: 'Bookings',
                    value: bookings.length,
                    onPress: () => onNavigateToGarage?.({ tab: 'appointments' }),
                  },
                ];

                const infoRows = [
                  { label: 'Email', value: currentUser?.email || 'Not set' },
                  { label: 'Phone', value: phone || currentUser?.phone || 'Not set' },
                  { label: 'City', value: city || 'Not set' },
                  { label: 'Country', value: country || 'Philippines' },
                ];

                return (
                  <View style={{ width: '100%' }}>
                    {/* 1. Full-Bleed Cover Hero Header */}
                    {(() => {
                      const avatarSourceUri = currentUser?.avatar || currentUser?.photoUri || null;
                      const primaryBikeKey = String(primaryBike?.motorcycle_id || primaryBike?.id || 'primary-bike');
                      const primaryBikeCoverUri = primaryBike
                        ? resolveMotorcyclePhoto(primaryBike, Boolean(failedBikePhotos[primaryBikeKey]))
                        : null;
                      const activeUploadedCover = !coverImageFailed ? profileCoverUri : null;
                      const backdropUri = activeUploadedCover || primaryBikeCoverUri || avatarSourceUri;
                      const coverBlurRadius = (activeUploadedCover || primaryBikeCoverUri)
                        ? 0
                        : Platform.select({ ios: 8, android: 5, default: 8 });
                      const heroHeight = profileTopInset + 242;
                      const heroGlassBtnStyle = {
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: 'rgba(20, 22, 26, 0.56)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.14)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      };

                      return (
                        <View
                          style={{
                            width: '100%',
                            height: heroHeight,
                            backgroundColor: '#121519',
                            position: 'relative',
                            overflow: 'hidden',
                            justifyContent: 'space-between',
                          }}
                        >
                          {/* Full-bleed Crisp Cover Photo */}
                          {backdropUri ? (
                            <Image
                              key={backdropUri.slice(0, 80)}
                              source={{ uri: backdropUri }}
                              blurRadius={coverBlurRadius}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 0,
                              }}
                              resizeMode="cover"
                              onError={() => {
                                if (activeUploadedCover) {
                                  setCoverImageFailed(true);
                                } else if (primaryBikeCoverUri && !failedBikePhotos[primaryBikeKey]) {
                                  setFailedBikePhotos((prev) => ({ ...prev, [primaryBikeKey]: true }));
                                }
                              }}
                            />
                          ) : (
                            <View
                              pointerEvents="none"
                              style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: '#1E232A',
                              }}
                            />
                          )}

                          {/* Top Status-Bar Readability Scrim */}
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: profileTopInset + 56,
                              zIndex: 1,
                              backgroundImage:
                                'linear-gradient(to bottom, rgba(12, 14, 18, 0.56) 0%, rgba(12, 14, 18, 0.24) 55%, rgba(12, 14, 18, 0) 100%)',
                            }}
                          />

                          {/* Seamless Eased Charcoal Bottom Fade (no clip seams) */}
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: '72%',
                              zIndex: 4,
                              backgroundImage: CHARCOAL_BOTTOM_FADE_GRADIENT,
                            }}
                          />

                          {/* Tap Background Layer to View Full-Screen Cover Photo */}
                          {backdropUri ? (
                            <TouchableOpacity
                              activeOpacity={0.95}
                              onPress={() => setIsViewingCoverModal(true)}
                              accessibilityLabel="View cover photo"
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 5,
                              }}
                            />
                          ) : null}

                          {/* Foreground Hero Controls & Identity */}
                          <View
                            pointerEvents="box-none"
                            style={{
                              flex: 1,
                              zIndex: 6,
                              paddingTop: profileTopInset,
                              paddingBottom: 24,
                              paddingHorizontal: 16,
                              justifyContent: 'space-between',
                            }}
                          >
                            {/* Top Circular Glass Action Row */}
                            <View
                              pointerEvents="box-none"
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    setIsEditingPersonalInfo((prev) => {
                                      const next = !prev;
                                      if (next) {
                                        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 200, animated: true }), 80);
                                      }
                                      return next;
                                    });
                                  }}
                                  accessibilityLabel="Edit profile"
                                  style={heroGlassBtnStyle}
                                >
                                  <BootstrapIcon name="pencil" size={14} color="#FFFFFF" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={handleUploadCover}
                                  disabled={isUploadingCover}
                                  accessibilityLabel="Change cover photo"
                                  style={heroGlassBtnStyle}
                                >
                                  {isUploadingCover ? (
                                    <ActivityIndicator size="small" color="#FBBF24" />
                                  ) : (
                                    <BootstrapIcon name="image" size={15} color="#FBBF24" />
                                  )}
                                </TouchableOpacity>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => setActiveTab('notifications')}
                                  accessibilityLabel="Notifications"
                                  style={heroGlassBtnStyle}
                                >
                                  <BootstrapIcon name="bell" size={15} color="#FFFFFF" />
                                  {unreadNotifCount > 0 ? (
                                    <View
                                      style={{
                                        position: 'absolute',
                                        top: 7,
                                        right: 8,
                                        width: 7,
                                        height: 7,
                                        borderRadius: 3.5,
                                        backgroundColor: '#EA580C',
                                      }}
                                    />
                                  ) : null}
                                </TouchableOpacity>

                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => setActiveTab('settings')}
                                  accessibilityLabel="Settings"
                                  style={heroGlassBtnStyle}
                                >
                                  <BootstrapIcon name="gear" size={15} color="#FFFFFF" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  onPress={() => setActiveTab('menu')}
                                  accessibilityLabel="Menu"
                                  style={heroGlassBtnStyle}
                                >
                                  <BootstrapIcon name="list" size={17} color="#FFFFFF" />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Bottom Split: Left Name/Handle/Stats + Right Avatar/Bubble */}
                            <View
                              pointerEvents="box-none"
                              style={{
                                flexDirection: 'row',
                                alignItems: 'flex-end',
                                justifyContent: 'space-between',
                                gap: 14,
                              }}
                            >
                              {/* Left Identity + Stats */}
                              <View style={{ flex: 1, paddingBottom: 2 }}>
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={() => {
                                    setIsEditingPersonalInfo(true);
                                    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 200, animated: true }), 80);
                                  }}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 25,
                                      fontWeight: '800',
                                      color: '#FFFFFF',
                                      letterSpacing: -0.5,
                                      flexShrink: 1,
                                      textShadowColor: 'rgba(0, 0, 0, 0.45)',
                                      textShadowOffset: { width: 0, height: 1 },
                                      textShadowRadius: 4,
                                    }}
                                  >
                                    {fullDisplayName}
                                  </Text>
                                  <BootstrapIcon name="caret-down-fill" size={11} color="#FFFFFF" />
                                  <View
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 3,
                                      backgroundColor: '#EA580C',
                                      marginBottom: 8,
                                      marginLeft: -2,
                                    }}
                                  />
                                </TouchableOpacity>

                                <Text
                                  numberOfLines={1}
                                  style={{
                                    marginTop: 2,
                                    fontSize: 13,
                                    fontWeight: '500',
                                    color: 'rgba(255, 255, 255, 0.78)',
                                  }}
                                >
                                  {profileHandle}
                                </Text>

                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 22,
                                    marginTop: 14,
                                  }}
                                >
                                  {profileStats.map((stat) => (
                                    <TouchableOpacity
                                      key={stat.label}
                                      activeOpacity={0.75}
                                      onPress={stat.onPress}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 16.5,
                                          fontWeight: '800',
                                          color: '#FFFFFF',
                                          fontVariant: ['tabular-nums'],
                                        }}
                                      >
                                        {stat.value}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: 11.5,
                                          fontWeight: '500',
                                          color: 'rgba(255, 255, 255, 0.72)',
                                          marginTop: 1,
                                        }}
                                      >
                                        {stat.label}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>

                              {/* Right Avatar + Add Badge */}
                              <View style={{ alignItems: 'center', position: 'relative' }}>
                                <View style={{ position: 'relative' }}>
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={handleUploadAvatar}
                                    accessibilityLabel="Change profile photo"
                                    style={{
                                      width: 84,
                                      height: 84,
                                      borderRadius: 42,
                                      backgroundColor: '#FFFFFF',
                                      padding: 2,
                                      borderWidth: 1.5,
                                      borderColor: 'rgba(255, 255, 255, 0.85)',
                                      shadowColor: '#000000',
                                      shadowOffset: { width: 0, height: 4 },
                                      shadowOpacity: 0.28,
                                      shadowRadius: 8,
                                      elevation: 5,
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: 40,
                                        backgroundColor: '#EA580C',
                                        overflow: 'hidden',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {avatarSourceUri ? (
                                        <Image
                                          source={{ uri: avatarSourceUri }}
                                          style={{ width: '100%', height: '100%' }}
                                          resizeMode="cover"
                                        />
                                      ) : (
                                        <Text
                                          style={{
                                            fontSize: 25,
                                            fontWeight: '700',
                                            color: '#FFFFFF',
                                            letterSpacing: 0.5,
                                          }}
                                        >
                                          {initials}
                                        </Text>
                                      )}
                                    </View>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={handleUploadAvatar}
                                    accessibilityLabel="Edit avatar photo"
                                    style={{
                                      position: 'absolute',
                                      bottom: 0,
                                      right: -1,
                                      width: 26,
                                      height: 26,
                                      borderRadius: 13,
                                      backgroundColor: '#EA580C',
                                      borderWidth: 2,
                                      borderColor: '#121519',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      shadowColor: '#000',
                                      shadowOffset: { width: 0, height: 2 },
                                      shadowOpacity: 0.28,
                                      shadowRadius: 3,
                                      elevation: 4,
                                    }}
                                  >
                                    <BootstrapIcon name="plus" size={14} color="#FFFFFF" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </View>

                          {/* Full-Screen Cover Photo Viewer Modal */}
                          {isViewingCoverModal && backdropUri && (
                            <Modal
                              visible={isViewingCoverModal}
                              transparent
                              animationType="fade"
                              onRequestClose={() => setIsViewingCoverModal(false)}
                            >
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  backgroundColor: 'rgba(0, 0, 0, 0.88)',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  padding: 20,
                                }}
                                activeOpacity={1}
                                onPress={() => setIsViewingCoverModal(false)}
                              >
                                <TouchableOpacity
                                  activeOpacity={1}
                                  onPress={(e) => e.stopPropagation?.()}
                                  style={{
                                    width: '100%',
                                    maxWidth: 420,
                                    backgroundColor: '#181A1D',
                                    borderRadius: 18,
                                    overflow: 'hidden',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.12)',
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingHorizontal: 16,
                                      paddingVertical: 12,
                                      borderBottomWidth: 1,
                                      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
                                    }}
                                  >
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#F9FAFB' }}>
                                      Cover Photo
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => setIsViewingCoverModal(false)}
                                      style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 15,
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <BootstrapIcon name="x-lg" size={13} color="#F9FAFB" />
                                    </TouchableOpacity>
                                  </View>

                                  <View style={{ width: '100%', height: 260, backgroundColor: '#0E1014' }}>
                                    <Image
                                      source={{ uri: backdropUri }}
                                      style={{ width: '100%', height: '100%' }}
                                      resizeMode="contain"
                                    />
                                  </View>

                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      gap: 10,
                                      padding: 14,
                                    }}
                                  >
                                    <TouchableOpacity
                                      style={{
                                        flex: 1,
                                        height: 42,
                                        borderRadius: 10,
                                        backgroundColor: '#EA580C',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                      }}
                                      onPress={() => {
                                        setIsViewingCoverModal(false);
                                        handleUploadCover();
                                      }}
                                    >
                                      <BootstrapIcon name="image" size={14} color="#FFFFFF" />
                                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' }}>
                                        Change Cover
                                      </Text>
                                    </TouchableOpacity>

                                    {profileCoverUri ? (
                                      <TouchableOpacity
                                        style={{
                                          flex: 1,
                                          height: 42,
                                          borderRadius: 10,
                                          backgroundColor: 'rgba(239, 68, 68, 0.16)',
                                          borderWidth: 1,
                                          borderColor: 'rgba(248, 113, 113, 0.36)',
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 6,
                                        }}
                                        onPress={handleRemoveCover}
                                      >
                                        <BootstrapIcon name="trash3" size={13} color="#FCA5A5" />
                                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#FCA5A5' }}>
                                          Remove
                                        </Text>
                                      </TouchableOpacity>
                                    ) : null}
                                  </View>
                                </TouchableOpacity>
                              </TouchableOpacity>
                            </Modal>
                          )}
                        </View>
                      );
                    })()}

                    {/* 2. Rounded Profile Content Sheet + Personal Information Card */}
                    <View
                      style={{
                        backgroundColor: bodyBgColor,
                        borderTopLeftRadius: 22,
                        borderTopRightRadius: 22,
                        marginTop: -12,
                        paddingHorizontal: 16,
                        paddingTop: 18,
                        paddingBottom: 32,
                        gap: 14,
                      }}
                    >
                    {/* Personal Information Card */}
                    <View
                      style={{
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderWidth: 1,
                        borderRadius: 22,
                        paddingHorizontal: 18,
                        paddingTop: 18,
                        paddingBottom: isEditingPersonalInfo ? 18 : 6,
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.03,
                        shadowRadius: 8,
                        elevation: 1,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: isEditingPersonalInfo ? 14 : 6,
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '500', color: titleText, letterSpacing: -0.2 }}>
                          Personal information
                        </Text>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#374151' : '#E4E4E7',
                            backgroundColor: isEditingPersonalInfo ? (isDarkMode ? '#272B30' : '#F4F4F5') : cardBg,
                          }}
                          onPress={() => setIsEditingPersonalInfo(!isEditingPersonalInfo)}
                          activeOpacity={0.75}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: titleText }}>
                            {isEditingPersonalInfo ? 'Cancel' : 'Edit'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {!isEditingPersonalInfo ? (
                        <View>
                          {infoRows.map((row, idx) => (
                            <View
                              key={row.label}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                paddingVertical: 13,
                                borderBottomWidth: idx < infoRows.length - 1 ? 1 : 0,
                                borderBottomColor: dividerColor,
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '400', color: labelText }}>
                                {row.label}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{ fontSize: 13, fontWeight: '500', color: titleText, flexShrink: 1, textAlign: 'right' }}
                              >
                                {row.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={{ gap: 10 }}>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>First Name</Text>
                              <TextInput value={firstName} onChangeText={setFirstName} placeholder="First Name" placeholderTextColor="#9CA3AF" style={inputStyle} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Last Name</Text>
                              <TextInput value={lastName} onChangeText={setLastName} placeholder="Last Name" placeholderTextColor="#9CA3AF" style={inputStyle} />
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Phone</Text>
                              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#9CA3AF" style={inputStyle} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>City</Text>
                              <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#9CA3AF" style={inputStyle} />
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Country</Text>
                              <TextInput value={country} onChangeText={setCountry} placeholder="Country" placeholderTextColor="#9CA3AF" style={inputStyle} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Bio</Text>
                              <TextInput value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor="#9CA3AF" style={inputStyle} />
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: dividerColor }}
                              onPress={() => setIsEditingPersonalInfo(false)}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: labelText }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EA580C' }}
                              onPress={handleSave}
                              disabled={isSaving}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Save changes</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* 3. Preferences Card */}
                    <View
                      style={{
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderWidth: 1,
                        borderRadius: 22,
                        paddingHorizontal: 18,
                        paddingTop: 18,
                        paddingBottom: isEditingGarageInfo ? 18 : 6,
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.03,
                        shadowRadius: 8,
                        elevation: 1,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '500', color: titleText, letterSpacing: -0.2, marginBottom: 6 }}>
                        Preferences
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setActiveTab('notifications');
                          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: dividerColor,
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '500', color: titleText }}>Notifications</Text>
                        <BootstrapIcon name="chevron-right" size={14} color={labelText} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setIsEditingGarageInfo((prev) => !prev)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 14,
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '500', color: titleText }}>Delivery addresses</Text>
                        <BootstrapIcon
                          name={isEditingGarageInfo ? 'chevron-down' : 'chevron-right'}
                          size={14}
                          color={labelText}
                        />
                      </TouchableOpacity>

                      {isEditingGarageInfo && (
                        <View style={{ gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: dividerColor }}>
                          <View>
                            <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Street Address</Text>
                            <TextInput
                              value={address}
                              onChangeText={setAddress}
                              placeholder="Street, Barangay, City"
                              placeholderTextColor="#9CA3AF"
                              style={inputStyle}
                            />
                          </View>
                          <View>
                            <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Exact House Pin Location</Text>
                            <DeliveryLocationPicker
                              latitude={latitude}
                              longitude={longitude}
                              addressText={[address, city, country].filter(Boolean).join(', ')}
                              isDarkMode={isDarkMode}
                              height={210}
                              errorText={coordError}
                              onLocationChange={({ lat, lng }) => {
                                setLatitude(lat);
                                setLongitude(lng);
                                setCoordError('');
                              }}
                            />
                          </View>
                          <View>
                            <Text style={{ fontSize: 11.5, fontWeight: '600', color: labelText, marginBottom: 4 }}>Landmark / delivery notes</Text>
                            <TextInput
                              value={deliveryNotes}
                              onChangeText={setDeliveryNotes}
                              placeholder="e.g. blue gate, beside the sari-sari store"
                              placeholderTextColor="#9CA3AF"
                              style={inputStyle}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
                            <TouchableOpacity
                              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: dividerColor }}
                              onPress={() => setIsEditingGarageInfo(false)}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: labelText }}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EA580C' }}
                              onPress={handleSave}
                              disabled={isSaving}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Save address</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* 4. Account & Security Card */}
                    <View
                      style={{
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderWidth: 1,
                        borderRadius: 22,
                        paddingHorizontal: 18,
                        paddingTop: 18,
                        paddingBottom: 6,
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.03,
                        shadowRadius: 8,
                        elevation: 1,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '500', color: titleText, letterSpacing: -0.2, marginBottom: 6 }}>
                        Account
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setIsEditingSecurity((prev) => !prev)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: dividerColor,
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '500', color: titleText }}>Password & security</Text>
                        <BootstrapIcon name={isEditingSecurity ? 'chevron-down' : 'chevron-right'} size={14} color={labelText} />
                      </TouchableOpacity>

                      {isEditingSecurity && (
                        <View style={{ gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: dividerColor }}>
                          <TextInput value={currentPwd} onChangeText={setCurrentPwd} secureTextEntry placeholder="Current Password" placeholderTextColor="#9CA3AF" style={inputStyle} />
                          <TextInput value={newPwd} onChangeText={setNewPwd} secureTextEntry placeholder="New Password" placeholderTextColor="#9CA3AF" style={inputStyle} />
                          <TextInput value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry placeholder="Confirm New Password" placeholderTextColor="#9CA3AF" style={inputStyle} />
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                            <TouchableOpacity
                              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: dividerColor }}
                              onPress={() => setIsEditingSecurity(false)}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: labelText }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EA580C' }}
                              onPress={async () => {
                                await handleChangePassword();
                                setIsEditingSecurity(false);
                              }}
                              disabled={isSavingPwd}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Update password</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setIsLogoutModalOpen(true)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 14,
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#DC2626' }}>Log out</Text>
                        <BootstrapIcon name="box-arrow-right" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                    </View>
                  </View>
                );
              })()}

              {/* ═══════════════════════════════════════════════════════
              TAB 6: SETTINGS (READABLE CUSTOMER INFORMATION WITH MODAL EDIT)
             ═══════════════════════════════════════════════════════ */}
              {activeTab === 'settings' && (
                <View style={{ gap: 16 }}>
                  {/* Appearance Theme Presets */}
                  <View style={{ gap: 10 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 1.1,
                        color: isDarkMode ? '#9CA3AF' : '#64748B',
                        textTransform: 'uppercase',
                      }}
                    >
                      Appearance
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {[
                        {
                          key: 'daylight',
                          label: 'Daylight',
                          swatchBg: '#F4F1EA',
                          textColor: '#3F3A32',
                          barColor: '#EA580C',
                          footerBg: '#FFFFFF',
                          footerText: '#18181B',
                        },
                        {
                          key: 'darkroom',
                          label: 'Darkroom',
                          swatchBg: '#1C1F23',
                          textColor: '#F9FAFB',
                          barColor: '#FB923C',
                          footerBg: '#FFFFFF',
                          footerText: '#18181B',
                        },
                        {
                          key: 'sage',
                          label: 'Sage Atelier',
                          swatchBg: '#DCE2D7',
                          textColor: '#2E362B',
                          barColor: '#52604C',
                          footerBg: '#FFFFFF',
                          footerText: '#18181B',
                        },
                      ].map((themeCard) => {
                        const isSelected = appearancePreset === themeCard.key;
                        return (
                          <TouchableOpacity
                            key={themeCard.key}
                            onPress={() => handleSelectAppearance(themeCard.key)}
                            activeOpacity={0.85}
                            style={{
                              flex: 1,
                              borderRadius: 16,
                              overflow: 'hidden',
                              borderWidth: isSelected ? 2 : 1,
                              borderColor: isSelected
                                ? '#EA580C'
                                : isDarkMode
                                  ? '#2B3035'
                                  : '#E2E8F0',
                              backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                              shadowColor: '#0F172A',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isDarkMode ? 0.16 : 0.04,
                              shadowRadius: 6,
                              elevation: 2,
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: themeCard.swatchBg,
                                paddingHorizontal: 12,
                                paddingTop: 12,
                                paddingBottom: 14,
                                minHeight: 68,
                                justifyContent: 'space-between',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text
                                  style={{
                                    fontSize: 18,
                                    fontWeight: '700',
                                    color: themeCard.textColor,
                                    letterSpacing: -0.3,
                                  }}
                                >
                                  Aa
                                </Text>
                                {isSelected && (
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 10,
                                      backgroundColor: '#EA580C',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                                  </View>
                                )}
                              </View>
                              <View
                                style={{
                                  width: 28,
                                  height: 4,
                                  borderRadius: 999,
                                  backgroundColor: themeCard.barColor,
                                  marginTop: 8,
                                }}
                              />
                            </View>
                            <View
                              style={{
                                backgroundColor: isDarkMode ? '#181B1F' : themeCard.footerBg,
                                paddingHorizontal: 10,
                                paddingVertical: 9,
                                borderTopWidth: 1,
                                borderTopColor: isDarkMode ? '#262A30' : '#F1F5F9',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? '700' : '600',
                                  color: isDarkMode ? '#F3F4F6' : themeCard.footerText,
                                }}
                                numberOfLines={1}
                              >
                                {themeCard.label}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Shop Credentials */}
                  <View style={{ gap: 10 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 1.1,
                        color: isDarkMode ? '#9CA3AF' : '#64748B',
                        textTransform: 'uppercase',
                      }}
                    >
                      Shop Credentials
                    </Text>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                        borderRadius: 20,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#2B3035' : '#E5E7EB',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isDarkMode ? 0.18 : 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                        gap: 14,
                      }}
                    >
                      {[
                        {
                          key: 'shop-location',
                          icon: 'geo-alt',
                          label: 'Shop Location',
                          value:
                            storeCredentials?.storeAddress ||
                            'East Poblacion, City of Naga, Cebu',
                        },
                        {
                          key: 'concierge-hotline',
                          icon: 'telephone',
                          label: 'Concierge Hotline',
                          value: storeCredentials?.contactPhone || '+63 917 882 9102',
                        },
                        {
                          key: 'hours-operation',
                          icon: 'clock',
                          label: 'Hours of Operation',
                          value: `${storeCredentials?.operatingDays || 'Mon – Sat'}: ${storeCredentials?.openTime || '8:00 AM'} – ${storeCredentials?.closeTime || '7:00 PM'} | Sun: By Appointment`,
                        },
                      ].map((cred) => (
                        <View key={cred.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 11,
                              backgroundColor: isDarkMode ? '#2A1D15' : '#FFF7ED',
                              borderWidth: 1,
                              borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.28)' : '#FED7AA',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 1,
                            }}
                          >
                            <BootstrapIcon name={cred.icon} size={16} color="#EA580C" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '500',
                                color: isDarkMode ? '#9CA3AF' : '#64748B',
                              }}
                            >
                              {cred.label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: isDarkMode ? '#F3F4F6' : '#0F172A',
                                marginTop: 2,
                                lineHeight: 20,
                              }}
                            >
                              {cred.value}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Customizations (App Notification Preferences) */}
                  <View style={{ gap: 10 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 1.1,
                        color: isDarkMode ? '#9CA3AF' : '#64748B',
                        textTransform: 'uppercase',
                      }}
                    >
                      Customizations
                    </Text>
                    <View style={{ gap: 10 }}>
                      {[
                        { key: 'notifications', label: 'Notifications' },
                        { key: 'soundNotification', label: 'Sound Notification' },
                        { key: 'vibration', label: 'Vibration' },
                      ].map((pref) => (
                        <TouchableOpacity
                          key={pref.key}
                          activeOpacity={0.85}
                          onPress={() => handleToggleCustomPref(pref.key, !customPrefs[pref.key])}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: Boolean(customPrefs[pref.key]) }}
                          style={{
                            backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                            borderRadius: 18,
                            paddingHorizontal: 18,
                            paddingVertical: 14,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#E5E7EB',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: isDarkMode ? 0.14 : 0.03,
                            shadowRadius: 4,
                            elevation: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14.5,
                              fontWeight: '600',
                              color: isDarkMode ? '#F3F4F6' : '#0F172A',
                            }}
                          >
                            {pref.label}
                          </Text>
                          <ToggleSwitch
                            value={Boolean(customPrefs[pref.key])}
                            onToggle={(val) => handleToggleCustomPref(pref.key, val)}
                            activeTrackColor="#EA580C"
                            inactiveTrackColor={isDarkMode ? '#374151' : '#CBD5E1'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Customer Settings Card */}
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                      borderRadius: 20,
                      padding: 18,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#2B3035' : '#E5E7EB',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDarkMode ? 0.18 : 0.04,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#2A1D15' : '#FFF1E6',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="person" size={18} color="#EA580C" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16.5,
                              fontWeight: '700',
                              color: isDarkMode ? '#F9FAFB' : '#0F172A',
                              letterSpacing: -0.2,
                            }}
                          >
                            Customer settings
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? '#9CA3AF' : '#64748B',
                              marginTop: 1,
                            }}
                          >
                            Profile, contact and delivery details
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#2A1D15' : '#FFF1E6',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => setIsEditSettingsModalOpen(true)}
                        activeOpacity={0.8}
                        accessibilityLabel="Edit customer settings"
                      >
                        <BootstrapIcon name="pencil" size={16} color="#EA580C" />
                      </TouchableOpacity>
                    </View>

                    {/* Details List */}
                    <View style={{ gap: 10 }}>
                      {[
                        {
                          key: 'name',
                          icon: 'person',
                          label: 'Customer Name',
                          value:
                            [firstName, lastName].filter(Boolean).join(' ') ||
                            currentUser?.name ||
                            currentUser?.fullName ||
                            name ||
                            'Rider Account',
                        },
                        {
                          key: 'email',
                          icon: 'chat-square-dots',
                          label: 'Account Email',
                          value: currentUser?.email || 'N/A',
                          verified: true,
                        },
                        {
                          key: 'phone',
                          icon: 'telephone',
                          label: 'Phone Number',
                          value: currentUser?.phone || phone || 'Not provided',
                        },
                        {
                          key: 'address',
                          icon: 'geo-alt',
                          label: 'Primary Delivery Address',
                          value:
                            currentUser?.address || address
                              ? `${currentUser?.address || address}, ${currentUser?.city || city || 'City of Naga'}, ${currentUser?.country || country || 'Philippines'}${
                                  parseLatLng(
                                    currentUser?.latitude ?? currentUser?.delivery_lat ?? latitude,
                                    currentUser?.longitude ?? currentUser?.delivery_lng ?? longitude
                                  )
                                    ? `\nExact pin: ${Number(currentUser?.latitude ?? currentUser?.delivery_lat ?? latitude).toFixed(5)}, ${Number(currentUser?.longitude ?? currentUser?.delivery_lng ?? longitude).toFixed(5)}`
                                    : '\nPin not set yet — tap Edit to pin house'
                                }`
                              : 'No street address saved',
                          multiline: true,
                        },
                        {
                          key: 'bio',
                          icon: 'chat-square-dots',
                          label: 'Rider Bio / Headline',
                          value: currentUser?.bio || bio || 'Motorcycle Enthusiast & Customer',
                          multiline: true,
                        },
                        {
                          key: 'deliveryNotes',
                          icon: 'box-seam',
                          label: 'Landmark / Delivery Notes',
                          value:
                            currentUser?.deliveryNotes ||
                            currentUser?.delivery_notes ||
                            deliveryNotes ||
                            'No landmark added yet — tap Edit to add one',
                          multiline: true,
                        },
                      ].map((item) => (
                        <View
                          key={item.key}
                          style={{
                            backgroundColor: isDarkMode ? '#14171A' : '#F8FAFC',
                            paddingHorizontal: 14,
                            paddingVertical: 13,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#E8EDF3',
                            flexDirection: 'row',
                            alignItems: item.multiline ? 'flex-start' : 'center',
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: isDarkMode ? '#2B3035' : '#E2E8F0',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: item.multiline ? 2 : 0,
                            }}
                          >
                            <BootstrapIcon
                              name={item.icon}
                              size={15}
                              color={isDarkMode ? '#CBD5E1' : '#475569'}
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: '700',
                                  letterSpacing: 0.7,
                                  color: isDarkMode ? '#9CA3AF' : '#64748B',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {item.label}
                              </Text>
                              {item.verified ? (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: isDarkMode ? '#14532D' : '#DCFCE7',
                                    paddingHorizontal: 9,
                                    paddingVertical: 3,
                                    borderRadius: 999,
                                  }}
                                >
                                  <BootstrapIcon
                                    name="check"
                                    size={11}
                                    color={isDarkMode ? '#86EFAC' : '#15803D'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDarkMode ? '#86EFAC' : '#15803D',
                                    }}
                                  >
                                    Verified
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: '500',
                                color: isDarkMode ? '#F3F4F6' : '#0F172A',
                                marginTop: 3,
                                lineHeight: 20,
                              }}
                            >
                              {item.value}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Password & Security Card */}
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#1C1F23' : '#FFFFFF',
                      borderRadius: 20,
                      padding: 18,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#2B3035' : '#E5E7EB',
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDarkMode ? 0.18 : 0.04,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#2C2210' : '#FEF3C7',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="lock" size={18} color="#B45309" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16.5,
                            fontWeight: '700',
                            color: isDarkMode ? '#F9FAFB' : '#0F172A',
                            letterSpacing: -0.2,
                          }}
                        >
                          Security
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: isDarkMode ? '#9CA3AF' : '#64748B',
                            marginTop: 1,
                          }}
                        >
                          Update your account password
                        </Text>
                      </View>
                    </View>

                    <View style={{ gap: 12 }}>
                      <View>
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#E5E7EB' : '#334155',
                            marginBottom: 6,
                          }}
                        >
                          Current password
                        </Text>
                        <TextInput
                          value={currentPwd}
                          onChangeText={setCurrentPwd}
                          secureTextEntry={!showSettingsPasswords}
                          placeholder="Enter current password"
                          placeholderTextColor={isDarkMode ? '#6B7280' : '#94A3B8'}
                          style={{
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#CBD5E1',
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            fontSize: 14,
                            color: isDarkMode ? '#F9FAFB' : '#0F172A',
                            backgroundColor: isDarkMode ? '#14171A' : '#F8FAFC',
                          }}
                        />
                      </View>

                      <View>
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#E5E7EB' : '#334155',
                            marginBottom: 6,
                          }}
                        >
                          New password
                        </Text>
                        <TextInput
                          value={newPwd}
                          onChangeText={setNewPwd}
                          secureTextEntry={!showSettingsPasswords}
                          placeholder="At least 8 characters"
                          placeholderTextColor={isDarkMode ? '#6B7280' : '#94A3B8'}
                          style={{
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#CBD5E1',
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            fontSize: 14,
                            color: isDarkMode ? '#F9FAFB' : '#0F172A',
                            backgroundColor: isDarkMode ? '#14171A' : '#F8FAFC',
                          }}
                        />
                      </View>

                      <View>
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#E5E7EB' : '#334155',
                            marginBottom: 6,
                          }}
                        >
                          Confirm password
                        </Text>
                        <TextInput
                          value={confirmPwd}
                          onChangeText={setConfirmPwd}
                          secureTextEntry={!showSettingsPasswords}
                          placeholder="Repeat new password"
                          placeholderTextColor={isDarkMode ? '#6B7280' : '#94A3B8'}
                          style={{
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#2B3035' : '#CBD5E1',
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            fontSize: 14,
                            color: isDarkMode ? '#F9FAFB' : '#0F172A',
                            backgroundColor: isDarkMode ? '#14171A' : '#F8FAFC',
                          }}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => setShowSettingsPasswords((prev) => !prev)}
                        activeOpacity={0.75}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          alignSelf: 'flex-start',
                          gap: 8,
                          paddingVertical: 4,
                        }}
                      >
                        <BootstrapIcon
                          name={showSettingsPasswords ? 'eye-slash' : 'eye'}
                          size={15}
                          color={isDarkMode ? '#9CA3AF' : '#475569'}
                        />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#D1D5DB' : '#334155',
                          }}
                        >
                          {showSettingsPasswords ? 'Hide passwords' : 'Show passwords'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          marginTop: 2,
                          backgroundColor: '#EA580C',
                          paddingVertical: 13,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                        onPress={handleChangePassword}
                        disabled={isSavingPwd}
                        activeOpacity={0.85}
                      >
                        {isSavingPwd ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                              Update password
                            </Text>
                            <BootstrapIcon name="arrow-right" size={16} color="#FFFFFF" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Need a hand? Support Card */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setIsHelpModalOpen(true)}
                    style={{
                      backgroundColor: isDarkMode ? '#14171A' : '#1E2530',
                      borderRadius: 20,
                      padding: 18,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#2B3035' : '#26303F',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="chat-square-dots" size={18} color="#F97316" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#FFFFFF' }}>
                        Need a hand?
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#94A3B8',
                          lineHeight: 17,
                          marginTop: 3,
                        }}
                      >
                        Our support team is available to help with your order, booking, or account questions.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="arrow-right" size={17} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ─── MODALS ─── */}
      {isLiveTrackingOpen && (
        <LiveOrderTrackingMapModal
          visible={isLiveTrackingOpen}
          order={selectedOrderForTracking}
          onClose={() => setIsLiveTrackingOpen(false)}
        />
      )}

      {isMotorcycleModalOpen && (
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
      )}

      {/* ─── MOTORCYCLE PHOTO VIEWER MODAL ─── */}
      {Boolean(viewingPhotoBike) && (
        <Modal
          visible={Boolean(viewingPhotoBike)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingPhotoBike(null)}
        >
          <TouchableOpacity
            style={[
              styles.motoPhotoModalOverlay,
              { backgroundColor: 'rgba(10, 12, 15, 0.86)' },
              Platform.OS === 'web' && { backdropFilter: 'blur(12px)' },
            ]}
            activeOpacity={1}
            onPress={() => setViewingPhotoBike(null)}
          >
            <TouchableOpacity
              style={[
                styles.motoPhotoModalCard,
                {
                  backgroundColor: 'rgba(17, 19, 23, 0.96)',
                  borderColor: 'rgba(255, 255, 255, 0.10)',
                },
                Platform.OS === 'web' && { backdropFilter: 'blur(20px)' },
              ]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation?.()}
            >
              {/* Header */}
              <View
                style={[
                  styles.motoPhotoModalHeader,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  },
                ]}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[styles.motoPhotoModalTitle, { color: '#F9FAFB' }]} numberOfLines={1}>
                      {viewingPhotoBike?.brand} {viewingPhotoBike?.model}
                    </Text>
                    {viewingPhotoBike?.is_primary && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: 'rgba(234, 88, 12, 0.2)',
                          borderWidth: 1,
                          borderColor: 'rgba(251, 146, 60, 0.45)',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FB923C', letterSpacing: 0.4 }}>
                          PRIMARY
                        </Text>
                      </View>
                    )}
                  </View>
                  {viewingPhotoBike?.nickname ? (
                    <Text style={[styles.motoPhotoModalSubtitle, { color: '#FB923C', marginTop: 2 }]}>
                      "{viewingPhotoBike.nickname}"
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[
                    styles.motoPhotoModalCloseBtn,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.14)',
                    },
                  ]}
                  onPress={() => setViewingPhotoBike(null)}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="x-lg" size={14} color="#F9FAFB" />
                </TouchableOpacity>
              </View>

              {/* Photo View (Clean Framed Stage) */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 2,
                }}
              >
                {(() => {
                  const modalBikeKey = String(viewingPhotoBike?.motorcycle_id || viewingPhotoBike?.id || 'modal');
                  const modalPhotoUri = resolveMotorcyclePhoto(viewingPhotoBike, Boolean(failedBikePhotos[modalBikeKey]));
                  return modalPhotoUri ? (
                    <View
                      style={{
                        width: '100%',
                        height: 210,
                        borderRadius: 14,
                        overflow: 'hidden',
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.14)',
                        padding: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Image
                        source={{ uri: modalPhotoUri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                        onError={() => {
                          if (!failedBikePhotos[modalBikeKey]) {
                            setFailedBikePhotos((prev) => ({ ...prev, [modalBikeKey]: true }));
                          }
                        }}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.motoPlaceholderWrap,
                        {
                          width: '100%',
                          height: 210,
                          borderRadius: 14,
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                        },
                      ]}
                    >
                      <BootstrapIcon name="motorcycle" size={54} color="#94A3B8" />
                      <Text style={[styles.motoNoPhotoText, { fontSize: 12, marginTop: 8, color: '#CBD5E1' }]}>
                        No motorcycle photo uploaded
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Details & Actions Footer */}
              <View style={styles.motoPhotoModalFooter}>
                <View style={styles.motoPhotoModalSpecsGrid}>
                  <View
                    style={[
                      styles.motoPhotoModalSpecPill,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                      },
                    ]}
                  >
                    <Text style={[styles.motoPhotoModalSpecLabel, { color: '#94A3B8' }]}>Plate</Text>
                    <Text style={[styles.motoPhotoModalSpecVal, { color: '#F9FAFB' }]} numberOfLines={1}>
                      {viewingPhotoBike?.plate_number || 'N/A'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.motoPhotoModalSpecPill,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                      },
                    ]}
                  >
                    <Text style={[styles.motoPhotoModalSpecLabel, { color: '#94A3B8' }]}>Engine</Text>
                    <Text style={[styles.motoPhotoModalSpecVal, { color: '#F9FAFB' }]} numberOfLines={1}>
                      {viewingPhotoBike?.engine_cc ? `${viewingPhotoBike.engine_cc} cc` : 'N/A'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.motoPhotoModalSpecPill,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                      },
                    ]}
                  >
                    <Text style={[styles.motoPhotoModalSpecLabel, { color: '#94A3B8' }]}>Odometer</Text>
                    <Text style={[styles.motoPhotoModalSpecVal, { color: '#F9FAFB' }]} numberOfLines={1}>
                      {viewingPhotoBike?.odometer || '0 km'}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 10, width: '100%' }}>
                  <TouchableOpacity
                    style={{
                      width: '100%',
                      height: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#EA580C',
                      borderRadius: 12,
                    }}
                    onPress={() => {
                      const bike = viewingPhotoBike;
                      setViewingPhotoBike(null);
                      handleOpenEditMotorcycle(bike);
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="pencil" size={14} color="#FFFFFF" />
                    <Text style={[styles.motoPhotoModalEditBtnText, { fontSize: 14 }]}>Edit Bike</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    {!viewingPhotoBike?.is_primary && (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          height: 42,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          borderRadius: 12,
                          backgroundColor: 'rgba(234, 88, 12, 0.14)',
                          borderWidth: 1,
                          borderColor: 'rgba(251, 146, 60, 0.40)',
                        }}
                        onPress={() => {
                          const bike = viewingPhotoBike;
                          setViewingPhotoBike(null);
                          handleSetPrimaryBike(bike);
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="star" size={13} color="#FB923C" />
                        <Text style={[styles.motoPhotoModalDismissBtnText, { color: '#FB923C', fontSize: 13 }]}>
                          Set Primary
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 42,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: 12,
                        backgroundColor: 'rgba(239, 68, 68, 0.14)',
                        borderWidth: 1,
                        borderColor: 'rgba(248, 113, 113, 0.36)',
                      }}
                      onPress={() => {
                        const bike = viewingPhotoBike;
                        setViewingPhotoBike(null);
                        handlePromptDeleteBike(bike);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="trash3" size={13} color="#FCA5A5" />
                      <Text style={[styles.motoPhotoModalDismissBtnText, { color: '#FCA5A5', fontSize: 13 }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Edit Customer Settings Modal */}
      {isEditSettingsModalOpen && (
        <EditCustomerSettingsModal
          visible={isEditSettingsModalOpen}
          currentUser={currentUser}
          onClose={() => setIsEditSettingsModalOpen(false)}
          onSave={handleSaveProfileFromModal}
          showToast={showToast}
        />
      )}

      {isDeleteBikeModalOpen && (
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
      )}

      {isLogoutModalOpen && (
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
      )}

      {/* ─── EDIT PROFILE MODAL ─── */}
      {isEditProfileModalOpen && (
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

                {/* Cover Photo Section */}
                <Text style={styles.inputLabel}>Cover Photo</Text>
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
                    onPress={handleUploadCover}
                    disabled={isUploadingCover}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="image" size={13} color="#EA580C" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>
                      {isUploadingCover ? 'Uploading…' : 'Upload Cover'}
                    </Text>
                  </TouchableOpacity>

                  {profileCoverUri ? (
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
                      onPress={handleRemoveCover}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="trash" size={13} color="#DC2626" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>Remove Cover</Text>
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
      )}

      {/* ─── CHANGE PASSWORD MODAL ─── */}
      {isChangePasswordModalOpen && (
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
      )}

      {/* ─── HELP & SUPPORT MODAL ─── */}
      {isHelpModalOpen && (
        <CompanyInfoModal
          visible={isHelpModalOpen}
          initialTab="contact"
          onClose={() => setIsHelpModalOpen(false)}
          showToast={showToast}
        />
      )}

      {/* ─── CUSTOMER FEEDBACK & ISSUE REPORT MODAL ─── */}
      {isReportModalOpen && (
        <MobileSubmitReportModal
          visible={isReportModalOpen}
          currentUser={currentUser}
          recentOrders={orders}
          recentBookings={bookings}
          initialOrder={reportContextOrder}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportContextOrder(null);
          }}
          onSubmitSuccess={() => {
            showToast('Your report has been logged and sent to MotoTrack administrators.');
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* ─── DISPLAY & ACCESSIBILITY MODAL ─── */}
      {isDisplayModalOpen && (
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
      )}

      {/* ─── RATE DELIVERED ORDER MODAL ─── */}
      {isRateModalOpen && (
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
      )}

      {/* ─── PERSISTENT MOBILE BOTTOM NAVIGATION (BOTTOM NAVBAR STAYS) ─── */}
      <MobileBottomNavBar
        activeTab={activeTab === 'orders' ? 'Orders' : activeTab === 'garage' ? 'Garage' : 'More'}
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        ordersCount={0}
        currentUser={currentUser}
      />
    </RootContainer>
  );
}
