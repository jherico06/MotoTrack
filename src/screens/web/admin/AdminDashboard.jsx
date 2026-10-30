import { createPortal } from 'react-dom';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Platform,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getAdminStyles, getAdminThemeTokens } from '../../../styles/web/admin.web.styles.js';
import { appStorage } from '../../../services/system/storageAdapter.js';
import { productService, resolveReorderLevel, isLowStock } from '../../../services/products/productService.js';
import { promoService } from '../../../services/products/promoService.js';
import { orderService } from '../../../services/orders/orderService.js';
import { deliveryService } from '../../../services/delivery/deliveryService.js';
import {
  garageService,
  GARAGE_BRANCHES,
  TIME_SLOTS,
  MECHANIC_SPECIALIZATION_PRESETS,
  MECHANIC_AVATAR_PRESETS,
  getPackagePricePhp,
} from '../../../services/bookings/garageService.js';
import { pmsPricingService } from '../../../services/bookings/pmsPricingService.js';
import {
  DEFAULT_PMS_SERVICES,
  DEFAULT_CC_CATEGORIES,
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  formatPhp as formatPmsPhp,
} from '../../../utils/pmsCcPricing.js';
import {
  riderService,
  RIDER_STATUSES,
  RIDER_ACCOUNT_STATUSES,
  RIDER_AVATAR_PRESETS,
} from '../../../services/staff/riderService.js';
import { supplierService, SUPPLIER_CATEGORY_PRESETS } from '../../../services/inventory/supplierService.js';
import { excelService } from '../../../services/inventory/excelService.js';

import { userService } from '../../../services/staff/userService.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus.js';
import { authService } from '../../../services/auth/authService.js';
import { adminSecurityService } from '../../../services/auth/adminSecurityService.js';
import { AdminPinLockScreen, ConfirmModal, AdminAccountSettingsModal, AdminPinSettingsModal, AssignDeliveryModal, DeliveryAdminActionModal, DeliveryTokenModal, RiderAccessModal, EditBrandModal, AdminOrderDetailsModal } from '../../../components/modals';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { supabaseManager } from '../../../lib/supabase.js';
import {
  computeBookingDashboardStats,
  normalizeBookingStatus,
  statusLabel,
  statusColor,
  bookingQuotationTotal,
  bookingPaymentStatus,
  ADMIN_STATUS_FILTER_OPTIONS,
  formatPhp,
  FLEX_BOOKING_STATUS,
} from '../../../utils/bookingWorkflow.js';
import { AdminStatCard, BootstrapIcon, BrandLogo, ExpectedDeliveryEditor, BookingCalendar, NotificationDropdown, UserProfileButton, Skeleton } from '../../../components/common';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { usdToPhp } from '../../../utils/currency.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import NotificationsPage from '../customer/NotificationsPage.jsx';
import { auditLogService } from '../../../services/system/auditLogService.js';
import { AdminSidebar, SalesForecastPanel, SalesAnalyticsPanel, RevenueTrendChart, BookingCategoryPieChart, ProductSizesEditor, ProductColorsEditor, ServiceQuotationPanel, PickupQrScannerPanel, AdminBookingDetailsPanel, MotorcycleModelsAdminPanel, ProductCompatibilityPicker, AdminSystemSettingsPanel, PromosAdminPanel, RiderProfileCard, DashboardInsightsPanel, AdminProfileLogsPanel, ModernOverviewDashboard, AdminCustomerRatingsReportsPanel } from '../../../components/admin';
import { ratingsReportsService } from '../../../services/feedback/ratingsReportsService.js';
import {
  buildDashboardInsights,
  computeInventoryKpis,
  computeWeeklyKpiSeries,
  isRecognizedSalesOrder,
  recognizedOrderAmount,
} from '../../../services/inventory/dashboardInsightsService.js';
import { staffAccountApi } from '../../../services/staff/staffAccountApi.js';
import {
  cartLineKey,
  getProductSizeEntries,
  getSizePrice,
  isSizeSoldOut,
  normalizeProductSizes,
  productNeedsSizes,
  serializeProductSizes,
  validateSizeDrafts,
} from '../../../utils/productSizes.js';
import { normalizeProductColors, serializeProductColors, validateColorDrafts } from '../../../utils/productColors.js';
import { CATEGORY_NAMES, CATEGORY_PILLS } from '../../../data/motorParts.js';
import { categoryService, resolveCategoryIcon } from '../../../services/products/categoryService.js';

function AlertOrangeDot({ count, label, title }) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const dotRef = useRef(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: hovered ? 1 : 0,
      friction: 5,
      tension: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [hovered]);

  const updatePosition = () => {
    if (dotRef.current) {
      if (typeof dotRef.current.getBoundingClientRect === 'function') {
        const rect = dotRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  if (!count || count <= 0) return null;

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.85, 1],
  });

  const popupContent = (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'fixed',
        top: coords ? coords.top - 50 : 0,
        left: coords ? coords.left - 26 : 0,
        alignItems: 'flex-start',
        zIndex: 9999999,
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      {/* Main Orange Thought Bubble Pill */}
      <View
        style={{
          backgroundColor: '#EA580C',
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 22px rgba(234, 88, 12, 0.48), 0 2px 6px rgba(0, 0, 0, 0.12)',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {count} {label ? label : ''}
        </Text>
      </View>

      {/* Trailing Thought Bubbles descending to the biggest orange circle */}
      <View style={{ marginTop: 2, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: '#EA580C',
            marginLeft: 18,
            marginBottom: 3,
            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.4)',
          }}
        />
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#EA580C',
            marginLeft: 26,
            boxShadow: '0 3px 8px rgba(234, 88, 12, 0.45)',
          }}
        />
      </View>
    </Animated.View>
  );

  return (
    <View
      ref={dotRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={() => {
        updatePosition();
        setHovered(true);
      }}
      onTouchEnd={() => setTimeout(() => setHovered(false), 2000)}
      title={title || `${count} ${label || ''}`}
      style={{
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        paddingVertical: 5,
        paddingHorizontal: 4,
        zIndex: 99999,
      }}
    >
      {/* Base Glowing Orange Circle (The biggest circle where the thought trail starts) */}
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: '#EA580C',
          boxShadow: hovered ? '0 0 12px #EA580C, 0 0 4px #EA580C' : '0 0 6px #EA580C',
          transform: [{ scale: hovered ? 1.15 : 1 }],
          transition: 'all 0.2s ease',
        }}
      />

      {/* Render pop-up directly in document.body via Portal so it overlaps borders and main content completely in front */}
      {typeof document !== 'undefined' && coords && createPortal(popupContent, document.body)}
    </View>
  );
}

const STOCK_FILTER_OPTIONS = [
  { key: 'All', label: 'All SKUs', icon: 'boxes' },
  { key: 'inStock', label: 'In Stock', icon: 'check-circle-fill' },
  { key: 'lowStock', label: 'Low Stock', icon: 'exclamation-triangle-fill' },
  { key: 'outOfStock', label: 'Out of Stock', icon: 'slash-circle-fill' },
];

export default function AdminDashboard({ onNavigateToStore, onLogout }) {
  const promosPanelRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;

  // ─── THEME & DARK MODE STATE ───
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = appStorage.getItem('mototrack_admin_dark_mode');
      return saved === 'true';
    } catch (_e) {
      return false;
    }
  });

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        appStorage.setItem('mototrack_admin_dark_mode', String(next));
      } catch (_e) { }
      return next;
    });
  };

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'mototrack-clean-table-scrollbars';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        [data-tablescroll="true"],
        [data-table-scroll="true"],
        [data-tablescroll="true"] *,
        [data-table-scroll="true"] * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        [data-tablescroll="true"]::-webkit-scrollbar,
        [data-table-scroll="true"]::-webkit-scrollbar,
        [data-tablescroll="true"] *::-webkit-scrollbar,
        [data-table-scroll="true"] *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const themeTokens = useMemo(() => getAdminThemeTokens(isDarkMode), [isDarkMode]);
  const tokens = themeTokens;
  const styles = useMemo(() => getAdminStyles(isDarkMode), [isDarkMode]);

  const { currentUser: authUser, logout, setRedirectReason, adminLogin } = useAuth();
  const currentUser = authUser || authService.getCurrentUser();

  // Active Navigation Tab: 'overview' | 'orders' | 'inventory' | 'pos' | 'analytics' | 'forecast' | 'products' | 'promos' | 'garage' | 'users' | 'supabase'
  const [activeNav, setActiveNav] = useState('overview');
  const [dashboardAnimated, setDashboardAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDashboardAnimated(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const [forecastFocusProductId, setForecastFocusProductId] = useState(null);

  // Admin PIN Unlock State (persists across dashboard refreshes for the active admin session)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return adminSecurityService.isSessionUnlocked(currentUser);
  });

  // Keep unlock state in sync if currentUser changes
  useEffect(() => {
    if (currentUser) {
      const unlocked = adminSecurityService.isSessionUnlocked(currentUser);
      setIsAdminUnlocked(unlocked);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  // Automatic Lock Handler when navigating back to Storefront (with confirmation)
  const handleBackToStorefront = () => {
    showConfirm({
      title: 'Exit to Storefront?',
      message: 'You will be logged out of the Admin Console and your session will be locked. Do you want to return to the store?',
      confirmText: 'Exit to Store',
      cancelText: 'Stay in Admin',
      type: 'warning',
      confirmIcon: 'box-arrow-up-right',
      onConfirm: () => {
        adminSecurityService.lockSession(currentUser);
        setIsAdminUnlocked(false);
        onNavigateToStore?.();
      },
    });
  };

  // Core Data States & Realtime Network Latency Awareness
  const {
    isOnline,
    isOffline,
    isLagging,
    latencyMs,
    speedTier,
    isFast,
    hasEnoughInternet,
    measureLatency,
    detectRealtimeSpeed,
    trackOperationDuration,
  } = useNetworkStatus();
  const [isRefreshingWithSkeleton, setIsRefreshingWithSkeleton] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const inFlightLoadRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [forceSkeletonPreview, setForceSkeletonPreview] = useState(false);

  // If there is enough internet connection, the skeleton loading animation is NOT triggered.
  // It is ONLY triggered if the internet is NOT enough (offline, lagging/high latency, poor connection) or during explicit preview.
  const shouldShowSkeleton = forceSkeletonPreview || (!hasEnoughInternet && ((!hasLoadedOnce && isDashboardLoading) || isLagging || isOffline));
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [garageServices, setGarageServices] = useState([]);
  const [pmsRateCatalog, setPmsRateCatalog] = useState(() =>
    DEFAULT_PMS_SERVICES.map((s) => ({
      no: s.sortOrder,
      id: s.id,
      name: s.name,
      catalogCategory: s.catalogCategory || 'PMS',
      isActive: true,
      prices: { ...s.prices },
    }))
  );
  const [pmsCatalogCategoryFilter, setPmsCatalogCategoryFilter] = useState('all');
  const [pmsCatalogStatusFilter, setPmsCatalogStatusFilter] = useState('active');
  const [usersList, setUsersList] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [overviewModuleCategory, setOverviewModuleCategory] = useState('all');

  // ─── ORDERS & COD MANAGEMENT STATE ───
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All'); // 'All' | 'Pending Approval' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'
  const [isOrderStatusDropdownOpen, setIsOrderStatusDropdownOpen] = useState(false);
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All'); // 'All' | 'COD' | 'GCash' | 'Card'
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [orderMonthFilter, setOrderMonthFilter] = useState('All'); // 'All' | 0..11
  const [orderYearFilter, setOrderYearFilter] = useState('All');   // 'All' | 2026, 2025...
  const [isOrderDateDropdownOpen, setIsOrderDateDropdownOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isOrderEditMode, setIsOrderEditMode] = useState(false);
  const [orderEditForm, setOrderEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    delivery_notes: '',
    cod_change_for: '',
    status: '',
    payment_method: '',
    rider_name: '',
    rider_contact: '',
    channel: '',
  });
  const [isSavingOrderEdits, setIsSavingOrderEdits] = useState(false);
  const [assignDeliveryOrder, setAssignDeliveryOrder] = useState(null);
  const [orderDeliveryDetail, setOrderDeliveryDetail] = useState(null);
  const [proofViewer, setProofViewer] = useState(null); // { uri, notes, reportedAt, riderName }
  const [orderDeliveryHistory, setOrderDeliveryHistory] = useState([]);
  const [deliveryAction, setDeliveryAction] = useState(null);
  const [deliveryTokenModal, setDeliveryTokenModal] = useState(null); // { order, bundle }
  const [riderAccessModal, setRiderAccessModal] = useState(null); // { rider, bundle }

  // ─── INVENTORY STATE ───
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invStockFilter, setInvStockFilter] = useState('All'); // 'All' | 'inStock' | 'lowStock' | 'outOfStock'
  const [invCategoryFilter, setInvCategoryFilter] = useState('All');
  const [isInvCategoryDropdownOpen, setIsInvCategoryDropdownOpen] = useState(false);
  const [isInvStockDropdownOpen, setIsInvStockDropdownOpen] = useState(false);
  const [restockModalProduct, setRestockModalProduct] = useState(null);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockAmount, setRestockAmount] = useState('10');
  const [restockUnitCost, setRestockUnitCost] = useState('0');
  const [restockSellPrice, setRestockSellPrice] = useState('0');
  const [restockSupplierId, setRestockSupplierId] = useState('');
  const [restockSearchQuery, setRestockSearchQuery] = useState('');
  const [restockSizeAdds, setRestockSizeAdds] = useState([]); // [{ label, currentStock, addQty }]
  const [restockSelectedSize, setRestockSelectedSize] = useState(''); // chosen size label or 'all'
  const [restockColorAdds, setRestockColorAdds] = useState([]); // [{ label, hex, image, currentStock, addQty }]
  const [restockSelectedColor, setRestockSelectedColor] = useState(''); // chosen color label or 'all'
  const [supplierPurchases, setSupplierPurchases] = useState(() =>
    productService.getSupplierPurchases ? productService.getSupplierPurchases() : []
  );

  // ─── POS STATE ───
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState('All');
  const [isPosCategoryDropdownOpen, setIsPosCategoryDropdownOpen] = useState(false);
  const [posCart, setPosCart] = useState([]);
  const [posSelectedCustomer, setPosSelectedCustomer] = useState({
    id: 'walkin',
    name: 'Walk-in Customer',
    phone: 'N/A',
  });
  const [posCustomerDropdownOpen, setPosCustomerDropdownOpen] = useState(false);
  const [posPaymentMethod, setPosPaymentMethod] = useState('Cash'); // 'Cash' | 'Card' | 'GCash' | 'Bank'
  const [posTendered, setPosTendered] = useState('');
  const [posDiscountCode, setPosDiscountCode] = useState('');
  const [posDiscountPercent, setPosDiscountPercent] = useState(0);
  const [posReceiptOrder, setPosReceiptOrder] = useState(null);
  const [posSizePickerProduct, setPosSizePickerProduct] = useState(null);
  const [posSelectedSize, setPosSelectedSize] = useState('');

  // ─── ANALYTICS STATE ───
  const [analyticsPeriod, setAnalyticsPeriod] = useState('12W'); // '4W' | '12W' | '24W'

  // ─── PRODUCTS & PRICE MANAGEMENT STATE ───
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isProdCategoryDropdownOpen, setIsProdCategoryDropdownOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // Dynamic Catalog Categories & Add Category Modal State
  const [catalogCategories, setCatalogCategories] = useState(() => categoryService._cache || []);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('box-seam');
  const [newCatImage, setNewCatImage] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // New Product Form Fields
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCost, setNewProdCost] = useState('0');
  const [newProdSizes, setNewProdSizes] = useState([]);
  const [newProdColors, setNewProdColors] = useState([]);
  const [newProdOldPrice, setNewProdOldPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdBadge, setNewProdBadge] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdCompat, setNewProdCompat] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');

  // ─── GARAGE & BOOKINGS STATE ───
  const [garageSubTab, setGarageSubTab] = useState('bookings'); // 'bookings' | 'services'
  const [isGarageSubTabDropdownOpen, setIsGarageSubTabDropdownOpen] = useState(false);
  const [garageBookings, setGarageBookings] = useState([]);
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('All'); // 'All' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
  const [isBookingStatusDropdownOpen, setIsBookingStatusDropdownOpen] = useState(false);
  const [bookingCategoryFilter, setBookingCategoryFilter] = useState('All'); // 'All' | 'Repair' | 'PMS' | 'Installation'
  const [bookingViewMode, setBookingViewMode] = useState('table'); // 'table' | 'calendar'
  const [bookingDateFilter, setBookingDateFilter] = useState(''); // YYYY-MM-DD or ''
  const [bookingCustomerFilter, setBookingCustomerFilter] = useState(''); // customer name exact or ''
  const [bookingPage, setBookingPage] = useState(1);
  const BOOKING_PAGE_SIZE = 20;

  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [adminOffDutyDates, setAdminOffDutyDates] = useState({});
  const [selectedBookingForModal, setSelectedBookingForModal] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);

  // Edit Booking Form Fields
  const [editBkStatus, setEditBkStatus] = useState('Confirmed');
  const [editBkDate, setEditBkDate] = useState('');
  const [editBkTimeSlot, setEditBkTimeSlot] = useState('');
  const [editBkBranch, setEditBkBranch] = useState('');
  const [editBkMechanic, setEditBkMechanic] = useState('');
  const [editBkNotes, setEditBkNotes] = useState('');
  const [editBkPrice, setEditBkPrice] = useState('');
  const [editBkPlate, setEditBkPlate] = useState('');

  // New Walk-in Booking Form Fields
  const [newBkCustomerName, setNewBkCustomerName] = useState('');
  const [newBkCustomerPhone, setNewBkCustomerPhone] = useState('');
  const [newBkCustomerEmail, setNewBkCustomerEmail] = useState('');
  const [newBkCategory, setNewBkCategory] = useState('PMS');
  const [newBkServiceTitle, setNewBkServiceTitle] = useState('');
  const [newBkPrice, setNewBkPrice] = useState('');
  const [newBkBikeBrand, setNewBkBikeBrand] = useState('');
  const [newBkBikeModel, setNewBkBikeModel] = useState('');
  const [newBkPlate, setNewBkPlate] = useState('');
  const [newBkOdo, setNewBkOdo] = useState('');
  const [newBkDate, setNewBkDate] = useState('Today');
  const [newBkTimeSlot, setNewBkTimeSlot] = useState('');
  const [newBkBranch, setNewBkBranch] = useState('');
  const [newBkMechanic, setNewBkMechanic] = useState('');
  const [newBkNotes, setNewBkNotes] = useState('');

  // Service Advisor Workflow States
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [selectedMechanicForApproval, setSelectedMechanicForApproval] = useState('');
  const [newEstimateTitle, setNewEstimateTitle] = useState('');
  const [newEstimateAmount, setNewEstimateAmount] = useState('');
  const [newEstimateDesc, setNewEstimateDesc] = useState('');
  const [inspectionNotesInput, setInspectionNotesInput] = useState('');
  const [releaseNotesInput, setReleaseNotesInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('Cash');

  // Service Catalog Package States
  const [garageSearchQuery, setGarageSearchQuery] = useState('');
  const [isAddGarageOpen, setIsAddGarageOpen] = useState(false);
  const [editingGarageService, setEditingGarageService] = useState(null);
  const [servTitle, setServTitle] = useState('');
  const [servCategory, setServCategory] = useState('PMS');
  const [servSubtitle, setServSubtitle] = useState('');
  const [servPrice, setServPrice] = useState('');
  const [servDuration, setServDuration] = useState('');
  const [servBadge, setServBadge] = useState('');
  const [servImage, setServImage] = useState('');
  const [servDesc, setServDesc] = useState('');
  const [servInclusions, setServInclusions] = useState('');

  // PMS fixed-rate catalog (by CC) — add / edit
  const [isAddPmsRateOpen, setIsAddPmsRateOpen] = useState(false);
  const [editingPmsRate, setEditingPmsRate] = useState(null);
  const [pmsRateName, setPmsRateName] = useState('');
  const [pmsRateCatalogCategory, setPmsRateCatalogCategory] = useState(CATALOG_CATEGORIES.PMS);
  const [pmsRate125, setPmsRate125] = useState('');
  const [pmsRate150, setPmsRate150] = useState('');
  const [pmsRateBig, setPmsRateBig] = useState('');
  const [pmsRate125Na, setPmsRate125Na] = useState(false);
  const [pmsRate150Na, setPmsRate150Na] = useState(false);
  const [pmsRateBigNa, setPmsRateBigNa] = useState(false);
  const [pmsRateSaving, setPmsRateSaving] = useState(false);
  const [pmsActionMenu, setPmsActionMenu] = useState(null); // { service, coords: { top, right, bottom, left } }

  // ─── MECHANICS & TECHNICIANS STATE ───
  const [garageMechanics, setGarageMechanics] = useState(() => garageService.getMechanics());
  const [mechanicSearchQuery, setMechanicSearchQuery] = useState('');
  const [mechanicFilterStatus, setMechanicFilterStatus] = useState('All'); // 'All' | 'Available' | 'In Pit Bay'
  const [isMechanicFilterDropdownOpen, setIsMechanicFilterDropdownOpen] = useState(false);
  const [mechanicViewMode, setMechanicViewMode] = useState('list'); // 'list' | 'grid'
  const [isAddMechanicModalOpen, setIsAddMechanicModalOpen] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState(null);

  // New / Edit Mechanic Form Fields (roster only — no login account)
  const [mechName, setMechName] = useState('');
  const [mechShortName, setMechShortName] = useState('');
  const [mechSpecialization, setMechSpecialization] = useState('Engine Overhaul & Diagnostics');
  const [mechExperience, setMechExperience] = useState('5 Years Pro Tech');
  const [mechCertifications, setMechCertifications] = useState('Yamaha YTA Gold • Honda Master');
  const [mechAvatar, setMechAvatar] = useState('');
  const [mechStatus, setMechStatus] = useState('Available');
  const [mechPhone, setMechPhone] = useState('');
  const [mechEmail, setMechEmail] = useState('');


  // ─── RIDERS / DELIVERY STAFF STATE ───
  const [deliveryRiders, setDeliveryRiders] = useState(() => riderService.getRiders());
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const [riderFilterStatus, setRiderFilterStatus] = useState('All'); // 'All' | 'Available' | 'On Delivery' | 'Off Duty'
  const [riderViewMode, setRiderViewMode] = useState('list'); // 'list' | 'grid'
  const [isRiderFilterDropdownOpen, setIsRiderFilterDropdownOpen] = useState(false);
  const [isAddRiderModalOpen, setIsAddRiderModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState(null);
  const [riderName, setRiderName] = useState('');
  const [riderShortName, setRiderShortName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderVehicle, setRiderVehicle] = useState('');
  const [riderPlate, setRiderPlate] = useState('');
  const [riderAvatar, setRiderAvatar] = useState('');
  const [riderStatus, setRiderStatus] = useState(RIDER_STATUSES.AVAILABLE);
  const [riderNotes, setRiderNotes] = useState('');
  const [riderIdInput, setRiderIdInput] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [riderPassword, setRiderPassword] = useState('');
  const [riderAccountStatus, setRiderAccountStatus] = useState(RIDER_ACCOUNT_STATUSES.ACTIVE);

  // ─── SUPPLIERS & VENDORS STATE ───
  const [suppliers, setSuppliers] = useState(() => supplierService.getSuppliers());
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierFilterStatus, setSupplierFilterStatus] = useState('All'); // 'All' | 'Active' | 'Pending' | 'Inactive'
  const [isSupplierFilterDropdownOpen, setIsSupplierFilterDropdownOpen] = useState(false);
  const [supplierViewMode, setSupplierViewMode] = useState('list'); // 'list' | 'grid'
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // New / Edit Supplier Form Fields
  const [supName, setSupName] = useState('');
  const [supContactPerson, setSupContactPerson] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supCategories, setSupCategories] = useState(
    SUPPLIER_CATEGORY_PRESETS[0] || 'Exhaust & Performance'
  );
  const [supLeadTime, setSupLeadTime] = useState('3-5 Days');
  const [supRating, setSupRating] = useState('5.0');
  const [supStatus, setSupStatus] = useState('Active');
  const [supNotes, setSupNotes] = useState('');

  // ─── ADMIN HEADER NOTIFICATIONS & PROFILE STATE ───
  const [notifications, setNotifications] = useState(() => notificationService.getAdminNotifications());
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isAdminAccountOpen, setIsAdminAccountOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);

  const lowStockAlertProducts = useMemo(() => {
    return products.filter((p) => isLowStock(p, 5));
  }, [products]);

  const pendingOrdersAlertCount = useMemo(() => {
    return orders.filter((o) => {
      const st = String(o.status || '').toLowerCase();
      return st === 'processing' || st.includes('pending') || st.includes('approval');
    }).length;
  }, [orders]);

  const pendingBookingsAlertCount = useMemo(() => {
    return garageBookings.filter((b) => {
      const status = normalizeBookingStatus(b.status);
      return (
        status === FLEX_BOOKING_STATUS.PENDING_REVIEW ||
        status === FLEX_BOOKING_STATUS.NEEDS_INFORMATION
      );
    }).length;
  }, [garageBookings]);

  const unreadNotificationsCount = useMemo(() => {
    const unreadFromService = notifications.filter((n) => n.status === 'unread').length;
    const systemIssues = (lowStockAlertProducts.length > 0 ? 1 : 0) + (pendingBookingsAlertCount > 0 ? 1 : 0);
    return unreadFromService + systemIssues;
  }, [notifications, lowStockAlertProducts, pendingBookingsAlertCount]);

  // ─── SYSTEM SETTINGS STATE & HANDLERS ───
  const [systemSettings, setSystemSettings] = useState(() => systemSettingsService.getSettings());
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [settingsActiveSubTab, setSettingsActiveSubTab] = useState('general'); // 'general' | 'operations' | 'garage' | 'notifications' | 'maintenance'
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [setForm, setSetForm] = useState(() => ({ ...systemSettingsService.getSettings() }));

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      setSystemSettings(updated);
      setSetForm({ ...updated });
    });
    return () => unsub?.();
  }, []);

  // ─── AUDIT LOGS STATE ───
  // ─── AUDIT / ACTIVITY LOGS STATE ───
  const [auditLogs, setAuditLogs] = useState(() => auditLogService.getLogs());
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditDateRangeFilter, setAuditDateRangeFilter] = useState('7d'); // 'all' | 'today' | '7d' | '30d' | 'month'
  const [isDateRangeDropdownOpen, setIsDateRangeDropdownOpen] = useState(false);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('All'); // 'All' | 'orders' | 'inventory' | 'garage' | 'users' | 'promos' | 'security' | 'system'
  const [isAuditCategoryDropdownOpen, setIsAuditCategoryDropdownOpen] = useState(false);
  const [auditSeverityFilter, setAuditSeverityFilter] = useState('All'); // 'All' | 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL'
  const [isAuditSeverityDropdownOpen, setIsAuditSeverityDropdownOpen] = useState(false);
  const [selectedAuditLogForModal, setSelectedAuditLogForModal] = useState(null);
  const [hoveredAuditRowId, setHoveredAuditRowId] = useState(null);
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const auditItemsPerPage = 5;

  useEffect(() => {
    const unsubAudit = auditLogService.subscribe((freshLogs) => {
      setAuditLogs(freshLogs || []);
    });
    return () => unsubAudit?.();
  }, []);

  // ─── RATINGS & REPORTS ATTENTION STATE ───
  const [newReportsCount, setNewReportsCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchBadge = () => {
      ratingsReportsService
        .getOverviewStats()
        .then((st) => {
          if (mounted && st?.newCount !== undefined) {
            setNewReportsCount(st.newCount);
          }
        })
        .catch(() => { });
    };

    fetchBadge();
    const unsubscribe = ratingsReportsService.subscribe(() => {
      fetchBadge();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeNav]);

  const DATE_RANGE_OPTIONS = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 days' },
    { id: '30d', label: 'Last 30 days' },
    { id: 'month', label: 'This Month' },
  ];

  const AUDIT_CATEGORIES = [
    { id: 'All', label: 'All categories', icon: 'grid' },
    { id: 'orders', label: 'Orders', icon: 'box-seam' },
    { id: 'inventory', label: 'Inventory', icon: 'boxes' },
    { id: 'garage', label: 'Garage', icon: 'wrench' },
    { id: 'users', label: 'Users', icon: 'people' },
    { id: 'promos', label: 'Promos', icon: 'ticket-perforated' },
    { id: 'security', label: 'Security', icon: 'shield-lock' },
    { id: 'system', label: 'System', icon: 'gear' },
  ];

  const AUDIT_SEVERITIES = [
    { id: 'All', label: 'All severities' },
    { id: 'SUCCESS', label: 'SUCCESS', color: '#059669', dotColor: '#10B981', bg: '#ECFDF5' },
    { id: 'INFO', label: 'INFO', color: '#2563EB', dotColor: '#3B82F6', bg: '#EFF6FF' },
    { id: 'WARNING', label: 'WARNING', color: '#D97706', dotColor: '#F59E0B', bg: '#FFFBEB' },
    { id: 'CRITICAL', label: 'CRITICAL', color: '#DC2626', dotColor: '#EF4444', bg: '#FEF2F2' },
  ];

  // Logs filtered by selected date range period for KPI counts and table feed
  const periodAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditDateRangeFilter === 'all') return true;
      const t = new Date(log.timestamp).getTime();
      if (isNaN(t)) return true;
      const now = Date.now();
      if (auditDateRangeFilter === 'today') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        return t >= todayStart;
      }
      if (auditDateRangeFilter === '7d') {
        return t >= now - 7 * 24 * 60 * 60 * 1000;
      }
      if (auditDateRangeFilter === '30d') {
        return t >= now - 30 * 24 * 60 * 60 * 1000;
      }
      if (auditDateRangeFilter === 'month') {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        return t >= monthStart;
      }
      return true;
    });
  }, [auditLogs, auditDateRangeFilter]);

  const totalEventsCount = periodAuditLogs.length;
  const successfulEventsCount = periodAuditLogs.filter((l) => (l.severity || '').toUpperCase() === 'SUCCESS').length;
  const warningEventsCount = periodAuditLogs.filter((l) => (l.severity || '').toUpperCase() === 'WARNING').length;
  const criticalEventsCount = periodAuditLogs.filter((l) => (l.severity || '').toUpperCase() === 'CRITICAL').length;

  const filteredAuditLogs = useMemo(() => {
    return periodAuditLogs.filter((log) => {
      if (auditCategoryFilter !== 'All' && (log.category || '').toLowerCase() !== auditCategoryFilter.toLowerCase()) {
        return false;
      }
      if (auditSeverityFilter !== 'All' && (log.severity || '').toUpperCase() !== auditSeverityFilter.toUpperCase()) {
        return false;
      }
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.trim().toLowerCase();
        const text = `${log.action} ${log.target} ${log.details} ${log.admin_name} ${log.ip_address || ''} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [periodAuditLogs, auditCategoryFilter, auditSeverityFilter, auditSearchQuery]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditLogs.length / auditItemsPerPage));

  useEffect(() => {
    if (auditCurrentPage > totalAuditPages) {
      setAuditCurrentPage(1);
    }
  }, [totalAuditPages, auditCurrentPage]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditCurrentPage - 1) * auditItemsPerPage;
    return filteredAuditLogs.slice(start, start + auditItemsPerPage);
  }, [filteredAuditLogs, auditCurrentPage, auditItemsPerPage]);

  const handleResetAuditFilters = () => {
    setAuditSearchQuery('');
    setAuditDateRangeFilter('7d');
    setAuditCategoryFilter('All');
    setAuditSeverityFilter('All');
    setAuditCurrentPage(1);
    setIsDateRangeDropdownOpen(false);
    setIsAuditCategoryDropdownOpen(false);
    setIsAuditSeverityDropdownOpen(false);
    setHoveredAuditRowId(null);
  };

  const hasActiveAuditFilters = Boolean(
    auditSearchQuery.trim() ||
    auditDateRangeFilter !== '7d' ||
    auditCategoryFilter !== 'All' ||
    auditSeverityFilter !== 'All'
  );

  const handleExportAuditLogs = () => {
    try {
      auditLogService.exportToCSV(filteredAuditLogs);
      showToast('✓ Activity logs exported to CSV successfully!');
    } catch (_err) {
      showToast('⚠️ Failed to export activity logs');
    }
  };

  const availableCategoryNames = useMemo(() => {
    const fromService = (catalogCategories || []).map((c) => c.name);
    return ['All', ...new Set([...fromService, ...CATEGORY_NAMES.filter((c) => c !== 'All')])];
  }, [catalogCategories]);

  const getCategoryIcon = (catName) => {
    if (!catName || catName === 'All') return 'speedometer2';
    const found = CATEGORY_PILLS.find(
      (p) => p.category.toLowerCase() === catName.toLowerCase() || p.name.toLowerCase() === catName.toLowerCase()
    );
    if (found?.biIcon) return found.biIcon;
    return resolveCategoryIcon(catName);
  };

  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      showAlert('Validation Error', 'Please enter a category name.');
      return;
    }
    setIsSavingCategory(true);
    try {
      const res = await categoryService.addCategory({
        name: trimmed,
        description: newCatDesc.trim(),
        icon: newCatIcon,
        image: newCatImage.trim(),
      });
      if (!res.success) {
        showAlert('Cannot Add Category', res.error || 'Failed to add category.');
        return;
      }
      showToast(`✓ Category "${trimmed}" added successfully!`);
      setNewProdCategory(trimmed);
      setNewCatName('');
      setNewCatDesc('');
      setNewCatIcon('box-seam');
      setNewCatImage('');
      setIsAddCategoryModalOpen(false);
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to add category.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleUpdateSettingField = (field, value) => {
    setSetForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSystemSettings = () => {
    setIsSavingSettings(true);
    const res = systemSettingsService.saveSettings(setForm);
    setIsSavingSettings(false);
    if (res.success) {
      setSystemSettings(res.settings);
      try {
        auditLogService.logSystemAction({
          action: 'SYSTEM_SETTINGS_SAVED',
          target: `Settings Tab: ${settingsActiveSubTab}`,
          details: `Administrator updated store & platform configuration settings (${settingsActiveSubTab}).`,
          severity: 'INFO',
          metadata: { subTab: settingsActiveSubTab },
        });
      } catch (_e) { }
      showToast('✓ System configuration saved and deployed successfully!');
    } else {
      showToast('⚠️ Error saving settings: ' + res.error);
    }
  };

  const handleResetSystemSettings = () => {
    showConfirm({
      title: 'Reset System Settings to Defaults?',
      message:
        'This will revert all store configurations, thresholds, and operational rules to project factory presets. Proceed?',
      confirmText: 'Reset Defaults',
      cancelText: 'Cancel',
      type: 'warning',
      confirmIcon: 'arrow-counterclockwise',
      onConfirm: () => {
        const res = systemSettingsService.resetToDefaults();
        if (res.success) {
          setSetForm({ ...res.settings });
          setSystemSettings(res.settings);
          showToast('✓ System settings restored to factory defaults.');
        }
      },
    });
  };

  const handleClearCache = () => {
    systemSettingsService.clearSystemCache();
    showToast('✓ Temporary system caches purged.');
  };

  const handleExportSystemBackup = () => {
    try {
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        systemSettings: setForm,
        statistics: {
          productsCount: products.length,
          ordersCount: orders.length,
          bookingsCount: garageBookings.length,
          usersCount: usersList.length,
          mechanicsCount: (garageMechanics || []).length,
          suppliersCount: suppliers.length,
        },
      };
      const jsonStr = JSON.stringify(backupPayload, null, 2);
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mototrack_system_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      showToast('✓ System configuration JSON backup downloaded!');
    } catch (err) {
      showToast('Failed to export backup: ' + err.message);
    }
  };

  const handleLogoutAdmin = () => {
    showConfirm({
      title: 'Sign Out of Admin Console?',
      message: 'Are you sure you want to end your administrative session?',
      confirmText: 'Sign Out',
      cancelText: 'Stay Logged In',
      type: 'danger',
      confirmIcon: 'box-arrow-right',
      onConfirm: async () => {
        try {
          adminSecurityService.lockSession(currentUser);
          setIsAdminUnlocked(false);
        } catch (_e) { }
        await logout();
        if (onLogout) {
          onLogout();
        } else {
          onNavigateToStore?.();
        }
      },
    });
  };

  // ─── USERS STATE ───
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // ─── SUPABASE STATE ───
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState({
    tested: false,
    connected: false,
    message: 'Ready to test',
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  // ─── CUSTOM CENTERED CONFIRMATION & ALERT STATE ───
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    title: 'Confirm Action',
    message: '',
    itemName: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
    confirmIcon: undefined,
    hideCancel: false,
    onConfirm: null,
  });

  const showConfirm = ({
    title = 'Confirm Removal',
    message = 'Are you sure you want to proceed?',
    itemName = '',
    confirmText = 'Delete',
    cancelText = 'Cancel',
    type = 'danger',
    confirmIcon,
    onConfirm,
  }) => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      itemName,
      confirmText,
      cancelText,
      type,
      confirmIcon,
      hideCancel: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, visible: false }));
        if (onConfirm) await onConfirm();
      },
    });
  };

  const showAlert = (title, message) => {
    setConfirmDialog({
      visible: true,
      title: title || 'Notice',
      message: message || '',
      itemName: '',
      confirmText: 'OK',
      cancelText: '',
      type: 'info',
      confirmIcon: 'info-circle-fill',
      hideCancel: true,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  // ─── LOAD DATA (Parallelized, Latency-Optimized, and Deduplicated) ───
  const loadData = useCallback(async ({ isBackground = false, forceRefresh = false } = {}) => {
    // If a load request is already running, avoid duplicate concurrent fetching
    if (inFlightLoadRef.current && !forceRefresh) {
      return inFlightLoadRef.current;
    }

    const reqId = ++loadRequestIdRef.current;
    const startTime = performance?.now ? performance.now() : Date.now();

    // Only activate full initial skeleton if no data has been loaded yet, or brief skeleton on force refresh
    if (!hasLoadedOnceRef.current) {
      setIsDashboardLoading(true);
    } else if (forceRefresh) {
      setIsRefreshing(true);
      setIsRefreshingWithSkeleton(true);
    } else {
      setIsRefreshing(true);
    }
    setDashboardError(null);

    // Concurrently probe real-time connection speed (zero delay on data fetching)
    const speedProbePromise = detectRealtimeSpeed
      ? detectRealtimeSpeed().catch(() => ({ tier: 'fast', latencyMs: 65, minLoadingMs: 100, isFast: true }))
      : Promise.resolve({ tier: 'fast', latencyMs: 65, minLoadingMs: 100, isFast: true });

    const loadPromise = (async () => {
      try {
        await trackOperationDuration(async () => {
          // If offline, read cached data immediately without hanging on network timeouts
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const cachedProducts = productService.getProducts ? await productService.getProducts() : [];
            if (cachedProducts?.length) setProducts(cachedProducts);
            const cachedOrders = orderService.getOrders ? orderService.getOrders() : [];
            if (cachedOrders?.length) setOrders(cachedOrders);
            setGarageBookings(garageService.getLocalBookings());
            setGarageMechanics(garageService.getMechanics());
            setDeliveryRiders(riderService.getRiders());
            setSuppliers(supplierService.getSuppliers());
            hasLoadedOnceRef.current = true;
            setHasLoadedOnce(true);
            return;
          }

          // Execute all independent service requests in parallel
          const [
            prodRes,
            orderRes,
            promoRes,
            userRes,
            servRes,
            catalogRes,
            bkRes,
            mechRes,
            riderRes,
            supRes,
            catRes,
          ] = await Promise.allSettled([
            productService.getProducts(),
            orderService.getAllOrders(),
            promoService.getPromos(),
            userService.getAllUsers(),
            garageService.fetchServices().catch(() => garageService.getServices()),
            pmsPricingService.loadCatalog({ forceRefresh, includeInactive: true }).catch(() => null),
            garageService.getAllBookings().catch(() => garageService.getLocalBookings()),
            garageService.fetchMechanics().catch(() => garageService.getMechanics()),
            riderService.fetchRiders().catch(() => riderService.getRiders()),
            supplierService.fetchSuppliers().catch(() => supplierService.getSuppliers()),
            categoryService.getCategories({ force: forceRefresh }).catch(() => null),
          ]);

          // Prevent race conditions: check if this is still the active request
          if (reqId !== loadRequestIdRef.current) return;

          if (prodRes.status === 'fulfilled' && prodRes.value) {
            setProducts(Array.isArray(prodRes.value) ? prodRes.value : []);
          }
          if (orderRes.status === 'fulfilled' && orderRes.value) {
            setOrders(Array.isArray(orderRes.value) ? orderRes.value : []);
          }
          if (promoRes.status === 'fulfilled' && promoRes.value) {
            setPromos(Array.isArray(promoRes.value) ? promoRes.value : []);
          }
          if (userRes.status === 'fulfilled' && userRes.value) {
            setUsersList(Array.isArray(userRes.value) ? userRes.value : []);
          }
          if (servRes.status === 'fulfilled' && servRes.value) {
            setGarageServices(Array.isArray(servRes.value) ? servRes.value : []);
          }

          if (catalogRes.status === 'fulfilled' && catalogRes.value) {
            const catalog = catalogRes.value;
            const services = (catalog?.services?.length ? catalog.services : DEFAULT_PMS_SERVICES).map((s) => ({
              no: s.sortOrder ?? s.sort_order ?? 0,
              id: s.id,
              name: s.name,
              catalogCategory: s.catalogCategory || 'PMS',
              isActive: s.isActive !== false,
              prices: { ...(s.prices || {}) },
            }));
            services.sort((a, b) => a.no - b.no);
            setPmsRateCatalog(services);
          } else {
            setPmsRateCatalog(
              DEFAULT_PMS_SERVICES.map((s) => ({
                no: s.sortOrder,
                id: s.id,
                name: s.name,
                catalogCategory: s.catalogCategory || 'PMS',
                isActive: true,
                prices: { ...s.prices },
              }))
            );
          }

          if (bkRes.status === 'fulfilled' && bkRes.value) {
            setGarageBookings(Array.isArray(bkRes.value) ? bkRes.value : garageService.getLocalBookings());
          }
          if (mechRes.status === 'fulfilled' && mechRes.value) {
            setGarageMechanics(Array.isArray(mechRes.value) ? mechRes.value : garageService.getMechanics());
          }
          if (riderRes.status === 'fulfilled' && riderRes.value) {
            setDeliveryRiders(Array.isArray(riderRes.value) ? riderRes.value : riderService.getRiders());
          }
          if (supRes.status === 'fulfilled' && supRes.value) {
            setSuppliers(Array.isArray(supRes.value) ? supRes.value : supplierService.getSuppliers());
          }
          if (catRes.status === 'fulfilled' && catRes.value) {
            setCatalogCategories(Array.isArray(catRes.value) ? catRes.value : []);
          }

          const creds = supabaseManager.getCredentials();
          setSupabaseUrl(creds.url);
          setSupabaseKey(creds.key);

          // Mark that data has successfully loaded at least once
          hasLoadedOnceRef.current = true;
          setHasLoadedOnce(true);
        });
      } catch (err) {
        console.error('[AdminDashboard] Data loading error:', err);
        // Only show fatal error banner if initial load had zero cached data
        if (!hasLoadedOnceRef.current) {
          setDashboardError('Unable to connect to live database. Please check your connection and retry.');
        }
      } finally {
        inFlightLoadRef.current = null;
        if (reqId === loadRequestIdRef.current) {
          setIsDashboardLoading(false);
          setIsRefreshing(false);
          setIsRefreshingWithSkeleton(false);
        }
      }
    })();

    inFlightLoadRef.current = loadPromise;
    return loadPromise;
  }, [detectRealtimeSpeed, trackOperationDuration]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;
    loadData();
    const unsubscribeProd = productService.subscribe((fresh) => {
      if (Array.isArray(fresh)) {
        setProducts(fresh);
      }
    });
    const unsubscribeOrders = orderService.subscribe((freshOrders) => {
      if (Array.isArray(freshOrders)) {
        setOrders(freshOrders);
      }
    });
    const unsubscribeBookings = garageService.subscribeBookings((freshBks) => {
      if (Array.isArray(freshBks)) {
        setGarageBookings(freshBks);
      }
      setGarageMechanics(garageService.getMechanics());
    });
    const unsubscribeSuppliers = supplierService.subscribe((freshSups) => {
      if (Array.isArray(freshSups)) {
        setSuppliers(freshSups);
      }
    });
    const unsubscribeNotifs = notificationService.subscribe((data) => {
      const adminList = data?.admin || (Array.isArray(data) ? data : []);
      setNotifications(adminList);
    });
    const unsubscribeDeliveries = deliveryService.subscribe(() => {
      orderService.getAllOrders().then((ords) => {
        if (Array.isArray(ords)) setOrders(ords);
      });
      riderService.fetchRiders().then((riders) => {
        if (Array.isArray(riders)) setDeliveryRiders(riders);
      });
    });
    const unsubscribeRiders = riderService.subscribe((riders) => {
      if (Array.isArray(riders)) setDeliveryRiders(riders);
    });
    const unsubscribeCategories = categoryService.subscribe((freshCats) => {
      if (Array.isArray(freshCats)) setCatalogCategories(freshCats);
    });

    const handleWindowBookings = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setGarageBookings(e.detail);
      } else {
        setGarageBookings(garageService.getLocalBookings());
      }
      setGarageMechanics(garageService.getMechanics());
    };

    const handleSharedOrdersStorage = (e) => {
      if (e?.key && e.key !== 'mototrack_orders_db') return;
      orderService.getAllOrders().then((ords) => {
        if (Array.isArray(ords)) setOrders(ords);
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mototrack_bookings_updated', handleWindowBookings);
      window.addEventListener('storage', handleWindowBookings);
      window.addEventListener('storage', handleSharedOrdersStorage);
    }

    return () => {
      unsubscribeProd?.();
      unsubscribeOrders?.();
      unsubscribeBookings?.();
      unsubscribeSuppliers?.();
      unsubscribeNotifs?.();
      unsubscribeDeliveries?.();
      unsubscribeRiders?.();
      unsubscribeCategories?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('mototrack_bookings_updated', handleWindowBookings);
        window.removeEventListener('storage', handleWindowBookings);
        window.removeEventListener('storage', handleSharedOrdersStorage);
      }
    };
  }, [currentUser]);

  // ─── INVENTORY COMPUTATIONS & ACTIONS ───
  const invStats = useMemo(() => computeInventoryKpis(products), [products]);

  // Cost & profit summary for Overview (catalog + sales + supplier purchases)
  const profitOverview = useMemo(() => {
    const productMap = {};
    products.forEach((p) => {
      const id = p.product_id || p.id;
      if (id) productMap[id] = p;
    });

    const inventoryKpis = computeInventoryKpis(products);
    const inventoryCost = inventoryKpis.totalValue;
    const inventorySellValue = inventoryKpis.retailValue;
    const catalogProfit = inventorySellValue - inventoryCost;

    let soldRevenue = 0;
    let soldCost = 0;
    (orders || []).forEach((o) => {
      if (!isRecognizedSalesOrder(o)) return;
      soldRevenue += recognizedOrderAmount(o);
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((it) => {
        const qty = Number(it.quantity || 1);
        const pid = it.product_id || it.id;
        const recorded =
          it.unit_cost != null && it.unit_cost !== ''
            ? Number(it.unit_cost)
            : Number(productMap[pid]?.unit_cost ?? productMap[pid]?.unitCost ?? productMap[pid]?.cost_price ?? 0);
        const lineCost = Number.isFinite(recorded) ? recorded : 0;
        soldCost += lineCost * qty;
      });
    });
    const soldProfit = soldRevenue - soldCost;
    const soldMargin = soldRevenue > 0 ? (soldProfit / soldRevenue) * 100 : 0;
    const purchaseExpense = (supplierPurchases || []).reduce(
      (sum, row) => sum + Number(row.expense || 0),
      0
    );

    return {
      inventoryCost,
      inventorySellValue,
      catalogProfit,
      soldRevenue,
      soldCost,
      soldProfit,
      soldMargin,
      purchaseExpense,
    };
  }, [products, orders, supplierPurchases]);

  const filteredInventory = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        invCategoryFilter === 'All' || p.category.toLowerCase() === invCategoryFilter.toLowerCase();
      const q = invSearchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q));

      let matchStock = true;
      if (invStockFilter === 'inStock') matchStock = (p.stock || 0) > resolveReorderLevel(p, 5);
      else if (invStockFilter === 'lowStock') matchStock = isLowStock(p, 5);
      else if (invStockFilter === 'outOfStock') matchStock = !p.stock || p.stock <= 0;

      return matchCat && matchQ && matchStock;
    });
  }, [products, invSearchQuery, invStockFilter, invCategoryFilter]);

  const handleQuickAdjustStock = async (id, delta) => {
    const res = await productService.quickAdjustStock(id, delta);
    if (res.success) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stock: Math.max(0, (p.stock || 0) + delta) } : p))
      );
      showToast(`Stock updated: ${delta > 0 ? '+' + delta : delta} unit(s)`);
    }
  };

  const handleExecuteRestock = async () => {
    if (!restockModalProduct) {
      showAlert('Select Product', 'Choose a product to restock — same as picking an SKU when adding stock.');
      return;
    }
    const costNum = parseFloat(restockUnitCost);
    const priceNum = parseFloat(restockSellPrice);
    const availSizes = normalizeProductSizes(restockModalProduct);
    const hasSizes = availSizes.length > 0;
    const availColors = normalizeProductColors(restockModalProduct);
    const hasColors = availColors.length > 0;

    let sizeDeltas = null;
    let colorDeltas = null;
    let amountNum = 0;

    if (hasSizes) {
      if (restockSelectedSize && restockSelectedSize !== 'all') {
        const qty = parseInt(restockAmount, 10);
        if (isNaN(qty) || qty <= 0) {
          showAlert('Invalid Quantity', `Please enter a valid positive purchase quantity for size "${restockSelectedSize}".`);
          return;
        }
        amountNum = qty;
        sizeDeltas = [{ label: restockSelectedSize, quantity: qty }];
      } else {
        // 'all' multi-size breakdown
        sizeDeltas = (restockSizeAdds || [])
          .map((row) => ({
            label: row.label,
            quantity: parseInt(String(row.addQty || '0'), 10) || 0,
          }))
          .filter((row) => row.quantity > 0);
        if (!sizeDeltas.length) {
          showAlert('Invalid Quantity', 'Enter how many units to add for at least one size.');
          return;
        }
        amountNum = sizeDeltas.reduce((sum, row) => sum + row.quantity, 0);
      }
    } else if (hasColors) {
      // Color-based restocking
      if (restockSelectedColor && restockSelectedColor !== 'all') {
        const qty = parseInt(restockAmount, 10);
        if (isNaN(qty) || qty <= 0) {
          showAlert('Invalid Quantity', `Please enter a valid positive purchase quantity for color "${restockSelectedColor}".`);
          return;
        }
        amountNum = qty;
        colorDeltas = [{ label: restockSelectedColor, quantity: qty }];
      } else if (restockSelectedColor === 'all') {
        // 'all' multi-color breakdown
        colorDeltas = (restockColorAdds || [])
          .map((row) => ({
            label: row.label,
            quantity: parseInt(String(row.addQty || '0'), 10) || 0,
          }))
          .filter((row) => row.quantity > 0);
        if (!colorDeltas.length) {
          showAlert('Invalid Quantity', 'Enter how many units to add for at least one color.');
          return;
        }
        amountNum = colorDeltas.reduce((sum, row) => sum + row.quantity, 0);
      } else {
        showAlert('No Color Selected', 'Please select a color to restock.');
        return;
      }
    } else {
      amountNum = parseInt(restockAmount, 10);
      if (isNaN(amountNum) || amountNum <= 0) {
        showAlert('Invalid Quantity', 'Please enter a valid positive purchase quantity.');
        return;
      }
    }

    if (isNaN(costNum) || costNum < 0) {
      showAlert('Invalid Cost', 'Please enter the supplier purchase cost (₱).');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      showAlert('Invalid Price', 'Please enter the selling price (₱).');
      return;
    }
    if (priceNum < costNum) {
      showAlert(
        'Price Below Cost',
        'Selling price is lower than purchase cost. Increase the selling price to keep a profit.'
      );
      return;
    }

    const supplier = (suppliers || []).find(
      (s) => (s.supplier_id || s.id) === restockSupplierId
    );

    const res = await productService.purchaseFromSupplier({
      productId: restockModalProduct.id || restockModalProduct.product_id,
      quantity: amountNum,
      unitCost: costNum,
      sellPrice: priceNum,
      supplierId: restockSupplierId || null,
      supplierName: supplier?.name || '',
      sizeDeltas: hasSizes ? sizeDeltas : null,
      colorDeltas: hasColors ? colorDeltas : null,
    });

    if (!res.success) {
      showAlert('Purchase Failed', res.error || 'Unable to record supplier purchase.');
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === restockModalProduct.id || p.product_id === restockModalProduct.id
          ? { ...p, ...res.product }
          : p
      )
    );
    setSupplierPurchases(productService.getSupplierPurchases());

    const sizeNote = hasSizes && restockSelectedSize && restockSelectedSize !== 'all' ? ` (Size: ${restockSelectedSize})` : '';
    const colorNote = hasColors && restockSelectedColor && restockSelectedColor !== 'all' ? ` (Color: ${restockSelectedColor})` : '';

    const variantNote = sizeNote || colorNote;
    try {
      notificationService.notifyAdminSalesInventoryUpdate({
        title: 'Supplier Purchase Recorded',
        message: `Bought ${amountNum} × "${restockModalProduct.name}"${variantNote} for ₱${res.purchase.expense.toLocaleString()}. Sell ₱${priceNum.toLocaleString()} · Profit ₱${res.purchase.profitPerUnit.toLocaleString()}/unit.`,
        metrics: {
          product: restockModalProduct.name,
          restockedQty: amountNum,
          expense: res.purchase.expense,
          profitPerUnit: res.purchase.profitPerUnit,
        },
      });
      auditLogService.logInventoryAction({
        action: 'SUPPLIER_PURCHASE',
        target: `${restockModalProduct.name}${variantNote} (${restockModalProduct.id})`,
        details: `Purchased +${amountNum} units @ ₱${costNum}. Sell price ₱${priceNum}. Expense ₱${res.purchase.expense}. Profit/unit ₱${res.purchase.profitPerUnit}.${variantNote}`,
        severity: 'INFO',
        metadata: {
          productId: restockModalProduct.id,
          productName: restockModalProduct.name,
          addedQty: amountNum,
          unitCost: costNum,
          sellPrice: priceNum,
          expense: res.purchase.expense,
          expectedProfit: res.purchase.expectedProfit,
          supplierId: restockSupplierId || null,
          sizeDeltas: hasSizes ? sizeDeltas : null,
          colorDeltas: hasColors ? colorDeltas : null,
        },
      });
    } catch (_e) { }

    const productName = restockModalProduct.name;
    closeRestockModal();
    showToast(
      `Purchase saved${variantNote} · Expense ₱${res.purchase.expense.toLocaleString()} · Profit ₱${res.purchase.profitPerUnit.toLocaleString()}/pc`
    );
    showAlert(
      'Purchase Complete',
      `"${productName}"${variantNote}\n\nExpense (paid to supplier): ₱${res.purchase.expense.toLocaleString()}\nSelling price: ₱${priceNum.toLocaleString()}\nProfit per unit: ₱${res.purchase.profitPerUnit.toLocaleString()} (${res.purchase.margin.toFixed(1)}%)\nIf all ${amountNum} sell: ₱${res.purchase.expectedProfit.toLocaleString()} profit`
    );
  };

  const seedRestockSizeAdds = (product) => {
    const sizes = normalizeProductSizes(product);
    if (!sizes.length) {
      setRestockSizeAdds([]);
      setRestockSelectedSize('');
      return;
    }
    setRestockSelectedSize(sizes[0].label);
    setRestockSizeAdds(
      sizes.map((s) => ({
        label: s.label,
        currentStock:
          s.stock === null || s.stock === undefined
            ? Number(product.stock || 0)
            : Number(s.stock || 0),
        addQty: '',
      }))
    );
    if (sizes[0].price) {
      setRestockSellPrice(String(sizes[0].price));
    }
  };

  const seedRestockColorAdds = (product) => {
    const colors = normalizeProductColors(product);
    if (!colors.length) {
      setRestockColorAdds([]);
      setRestockSelectedColor('');
      return;
    }
    setRestockSelectedColor(colors[0].label);
    setRestockColorAdds(
      colors.map((c) => ({
        label: c.label,
        hex: c.hex || '',
        image: c.image || '',
        currentStock:
          c.stock === null || c.stock === undefined
            ? Number(product.stock || 0)
            : Number(c.stock || 0),
        addQty: '',
      }))
    );
  };

  const closeRestockModal = () => {
    setIsRestockModalOpen(false);
    setRestockModalProduct(null);
    setRestockAmount('10');
    setRestockUnitCost('0');
    setRestockSellPrice('0');
    setRestockSupplierId('');
    setRestockSearchQuery('');
    setRestockSizeAdds([]);
    setRestockSelectedSize('');
    setRestockColorAdds([]);
    setRestockSelectedColor('');
  };

  const openSupplierPurchase = (product = null) => {
    setIsRestockModalOpen(true);
    setRestockSearchQuery('');
    if (product) {
      const cost = Number(product.unit_cost ?? product.unitCost ?? 0);
      const price = Number(product.price || 0);
      setRestockModalProduct(product);
      setRestockAmount('10');
      setRestockUnitCost(String(cost || 0));
      setRestockSellPrice(String(price || 0));
      setRestockSupplierId(product.supplier_id || '');
      seedRestockSizeAdds(product);
      seedRestockColorAdds(product);
    } else {
      setRestockModalProduct(null);
      setRestockAmount('10');
      setRestockUnitCost('0');
      setRestockSellPrice('0');
      setRestockSupplierId('');
      setRestockSizeAdds([]);
      setRestockSelectedSize('');
      setRestockColorAdds([]);
      setRestockSelectedColor('');
    }
  };

  const selectRestockProduct = (product) => {
    const cost = Number(product.unit_cost ?? product.unitCost ?? 0);
    const price = Number(product.price || 0);
    setRestockModalProduct(product);
    setRestockAmount('10');
    setRestockUnitCost(String(cost || 0));
    setRestockSellPrice(String(price || 0));
    setRestockSupplierId(product.supplier_id || '');
    setRestockSearchQuery('');
    seedRestockSizeAdds(product);
    seedRestockColorAdds(product);
  };

  // ─── POS CASHIER TERMINAL ACTIONS ───
  const filteredPOSProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        posCategoryFilter === 'All' || p.category.toLowerCase() === posCategoryFilter.toLowerCase();
      const q = posSearchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [products, posSearchQuery, posCategoryFilter]);

  const addPOSLine = (product, size = '') => {
    if (product.stock <= 0) {
      showToast('Product is Out of Stock!');
      return;
    }
    const lineId = cartLineKey(product.id, size);
    const unitPrice = size ? getSizePrice(product, size) : Number(product.price) || 0;
    const displayName = size ? `${product.name} [${size}]` : product.name;

    setPosCart((prev) => {
      const existing = prev.find((item) => item.id === lineId);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showToast(`Only ${product.stock} units available in inventory.`);
          return prev;
        }
        return prev.map((item) =>
          item.id === lineId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: lineId,
          product_id: product.id,
          name: displayName,
          brand: product.brand,
          category: product.category,
          price: unitPrice,
          quantity: 1,
          image: product.image,
          stock: product.stock,
          size: size || null,
          unit_cost: Number(product.unit_cost ?? product.unitCost ?? 0),
        },
      ];
    });
    showToast(`Added "${displayName.slice(0, 18)}..." to POS Cart`);
  };

  const handlePOSAddToCart = (product) => {
    if (product.stock <= 0) {
      showToast('Product is Out of Stock!');
      return;
    }
    if (productNeedsSizes(product)) {
      const opts = getProductSizeEntries(product);
      setPosSizePickerProduct(product);
      setPosSelectedSize(opts.length === 1 ? opts[0].label : '');
      return;
    }
    addPOSLine(product);
  };

  const handlePOSConfirmSize = () => {
    if (!posSizePickerProduct) return;
    if (!posSelectedSize) {
      showToast('Select a size first');
      return;
    }
    addPOSLine(posSizePickerProduct, posSelectedSize);
    setPosSizePickerProduct(null);
    setPosSelectedSize('');
  };

  const handlePOSUpdateQty = (id, delta) => {
    setPosCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.stock) {
              showToast(`Max stock limit reached (${item.stock})`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const handlePOSApplyDiscount = async () => {
    const code = posDiscountCode.trim().toUpperCase();
    if (!code) {
      setPosDiscountPercent(0);
      return;
    }
    const cartItems = posCart.map((item) => ({
      product: { id: item.id || item.product_id, price: item.price },
      quantity: item.quantity,
    }));
    const result = await promoService.validatePromo(code, { cartItems, shippingFee: 0 });
    if (result.valid && result.discountPercent > 0) {
      setPosDiscountPercent(result.discountPercent);
      showToast(`Voucher Applied: ${result.discountPercent}% OFF!`);
    } else if (result.valid && result.isFreeShipping) {
      setPosDiscountPercent(0);
      showToast('Free Shipping promo applied (no product discount for in-store).');
    } else {
      setPosDiscountPercent(0);
      showToast(result.error || 'Invalid or expired promo voucher code.');
    }
  };

  const posSubtotal = useMemo(() => {
    return posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [posCart]);

  const posDiscountAmount = useMemo(() => {
    return (posSubtotal * posDiscountPercent) / 100;
  }, [posSubtotal, posDiscountPercent]);

  const posGrandTotal = useMemo(() => {
    return Math.max(0, posSubtotal - posDiscountAmount);
  }, [posSubtotal, posDiscountAmount]);

  const posTenderedNum = parseFloat(posTendered) || 0;
  const posChangeAmount = Math.max(0, posTenderedNum - posGrandTotal);

  const handlePOSCheckout = async () => {
    if (posCart.length === 0) {
      showAlert('Empty Cart', 'Please add products to the POS register before checkout.');
      return;
    }

    if (posPaymentMethod === 'Cash' && posTenderedNum < posGrandTotal) {
      showAlert(
        'Insufficient Tender',
        `Amount tendered (₱${posTenderedNum.toFixed(2)}) is less than the total balance due (₱${posGrandTotal.toFixed(2)}).`
      );
      return;
    }

    const orderData = {
      customer_id: posSelectedCustomer.id || 'walkin',
      customer_name: posSelectedCustomer.name || 'Walk-in Customer',
      customer_phone: posSelectedCustomer.phone || 'N/A',
      payment_method: posPaymentMethod,
      amount_tendered: posPaymentMethod === 'Cash' ? posTenderedNum : posGrandTotal,
      change_amount: posPaymentMethod === 'Cash' ? posChangeAmount : 0,
      total_amount: posSubtotal,
      discount_amount: posDiscountAmount,
      discount_code: posDiscountCode,
      grand_total: posGrandTotal,
      cashier: currentUser?.name || 'Admin Cashier',
      items: posCart,
    };

    const res = await orderService.createPOSOrder(orderData);
    if (res.success) {
      await loadData();

      // Show receipt modal
      setPosReceiptOrder(res.order);
      setPosCart([]);
      setPosTendered('');
      setPosDiscountCode('');
      setPosDiscountPercent(0);
      showToast('POS Sale Completed! Receipt generated.');
    } else {
      showToast(res.error || 'POS sale failed');
    }
  };

  // ─── ANALYTICS DATA COMPUTATIONS ───
  const analyticsData = useMemo(() => {
    const allOrders = orders || [];
    const recognizedOrders = allOrders.filter(isRecognizedSalesOrder);
    const posOrders = recognizedOrders.filter((o) => o.channel === 'POS (In-Store)');
    const onlineOrders = recognizedOrders.filter((o) => o.channel !== 'POS (In-Store)');

    const totalRevenue = recognizedOrders.reduce((sum, o) => sum + recognizedOrderAmount(o), 0);
    const posRevenue = posOrders.reduce((sum, o) => sum + recognizedOrderAmount(o), 0);
    const onlineRevenue = onlineOrders.reduce((sum, o) => sum + recognizedOrderAmount(o), 0);

    const aov = recognizedOrders.length > 0 ? totalRevenue / recognizedOrders.length : 0;
    const totalItemsSold = recognizedOrders.reduce(
      (sum, o) => sum + (Number(o.items_count) || (Array.isArray(o.items) ? o.items.length : 1)),
      0
    );

    // Category Revenue totals (no fabricated OLS)
    const categoryTotals = {};
    CATEGORY_NAMES.forEach((cat) => {
      categoryTotals[cat] = 0;
    });

    recognizedOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const cat = it.category || 'Accessories';
          const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
          categoryTotals[cat] = (categoryTotals[cat] || 0) + lineTotal;
        });
      }
    });

    const categoryRegression = Object.keys(categoryTotals)
      .map((cat) => ({
        category: cat,
        totalRevenue: categoryTotals[cat] || 0,
        slope: null,
        prediction: null,
      }))
      .filter((c) => c.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Payment Methods breakdown
    const paymentBreakdown = { Cash: 0, GCash: 0 };
    recognizedOrders.forEach((o) => {
      const pm = (o.payment_method || '').toLowerCase();
      if (pm.includes('gcash') || pm.includes('wallet')) paymentBreakdown.GCash += 1;
      else paymentBreakdown.Cash += 1;
    });

    // Top Selling Products
    const productSales = {};
    recognizedOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const key = it.name || 'Motorcycle Part';
          if (!productSales[key]) {
            productSales[key] = { name: key, brand: it.brand || 'MotoTrack', unitsSold: 0, revenue: 0 };
          }
          productSales[key].unitsSold += Number(it.quantity) || 1;
          productSales[key].revenue += (Number(it.price) || 0) * (Number(it.quantity) || 1);
        });
      }
    });

    const topProducts = Object.values(productSales)
      .filter((tp) => {
        if (!tp.name || tp.name === 'Motorcycle Part') return false;
        if (Array.isArray(products) && products.length > 0) {
          return products.some((p) => (p.name || '').trim().toLowerCase() === tp.name.trim().toLowerCase());
        }
        return true;
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(tp => {
        const match = products?.find(p => p.name === tp.name);
        return { ...tp, image_url: match ? match.image_url : null };
      });

    let periodsCount = 12;
    if (analyticsPeriod === '4W') periodsCount = 4;
    else if (analyticsPeriod === '24W') periodsCount = 24;

    const trendBars = computeWeeklyKpiSeries(allOrders, periodsCount).map((bucket, index) => ({
      label: `W${index + 1}`,
      weekKey: bucket.key,
      revenue: Math.round(bucket.revenue),
    }));
    const hasRealTrend = trendBars.some((b) => b.revenue > 0);
    const maxBarRevenue = hasRealTrend
      ? Math.max(...trendBars.map((b) => b.revenue), 1)
      : 0;

    return {
      totalRevenue,
      posRevenue,
      onlineRevenue,
      totalOrders: allOrders.length,
      posOrdersCount: posOrders.length,
      onlineOrdersCount: onlineOrders.length,
      aov,
      totalItemsSold,
      categoryTotals,
      categoryRegression,
      paymentBreakdown,
      topProducts,
      trendBars: hasRealTrend ? trendBars : [],
      maxBarRevenue,
      hasRealTrend,
    };
  }, [orders, products, analyticsPeriod]);

  // ─── PRODUCT ACTIONS ───
  const handleUpdatePrice = async (id, newPrice) => {
    const parsed = parseFloat(newPrice);
    if (isNaN(parsed) || parsed < 0) return;

    await productService.updateProduct(id, { price: parsed });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, price: parsed } : p)));
    showToast(`Price updated to ₱${parsed.toFixed(2)}`);
  };

  const handleUpdateCost = async (id, newCost) => {
    const parsed = parseFloat(newCost);
    if (isNaN(parsed) || parsed < 0) return;

    await productService.updateProduct(id, { unit_cost: parsed, unitCost: parsed });
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id || p.product_id === id
          ? { ...p, unit_cost: parsed, unitCost: parsed }
          : p
      )
    );
    showToast(`Cost updated to ₱${parsed.toFixed(2)}`);
  };

  const handleUpdateStock = async (id, newStock) => {
    const parsed = parseInt(newStock, 10);
    if (isNaN(parsed) || parsed < 0) return;

    await productService.updateProduct(id, { stock: parsed });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: parsed } : p)));
    showToast(`Stock updated to ${parsed} units`);
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    const sizeIssues = validateSizeDrafts(editingProduct.sizes || []);
    const colorIssues = validateColorDrafts(editingProduct.colors || []);
    const issues = [...sizeIssues, ...colorIssues];
    if (issues.length) {
      showToast(issues[0]);
      return;
    }
    const cost = Number(editingProduct.unit_cost ?? editingProduct.unitCost ?? 0);
    const payload = {
      ...editingProduct,
      unit_cost: cost,
      unitCost: cost,
      sizes: serializeProductSizes(
        editingProduct.sizes || [],
        Number(editingProduct.price) || 0
      ),
      colors: serializeProductColors(editingProduct.colors || []),
    };
    const res = await productService.updateProduct(
      editingProduct.id || editingProduct.product_id,
      payload
    );
    if (res?.product) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id || p.product_id === editingProduct.product_id
            ? { ...p, ...res.product }
            : p
        )
      );
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id || p.product_id === editingProduct.product_id
            ? { ...p, ...payload }
            : p
        )
      );
    }
    setEditingProduct(null);
    const sizeCount = (payload.sizes || []).length;
    const colorCount = (payload.colors || []).length;
    if (res?.error) {
      showToast(`Saved locally, but database sync failed: ${res.error}`);
    } else {
      showToast(
        `Saved "${String(editingProduct.name || '').slice(0, 18)}..." (${sizeCount} sizes, ${colorCount} colors)`
      );
    }
  };

  const handleDeleteProduct = (id, name) => {
    const targetId = id;
    showConfirm({
      title: 'Remove Product from Catalog',
      message:
        'Are you sure you want to permanently remove this motorcycle part from inventory and store catalog?',
      itemName: name,
      confirmText: 'Delete Product',
      cancelText: 'Keep Product',
      type: 'danger',
      confirmIcon: 'trash3-fill',
      onConfirm: async () => {
        await productService.deleteProduct(targetId);
        setProducts((prev) => prev.filter((p) => p.id !== targetId && p.product_id !== targetId));
        showToast(`Removed product "${name.slice(0, 18)}..."`);
      },
    });
  };

  const handleCreateProduct = async () => {
    if (!newProdName.trim() || !newProdPrice.trim()) {
      showAlert('Required Fields', 'Please provide at least a Product Name and Price.');
      return;
    }

    const sizeIssues = validateSizeDrafts(newProdSizes || []);
    const colorIssues = validateColorDrafts(newProdColors || []);
    const issues = [...sizeIssues, ...colorIssues];
    if (issues.length) {
      showToast(issues[0]);
      return;
    }

    const created = await productService.addProduct({
      name: newProdName,
      brand: newProdBrand,
      category: newProdCategory,
      price: parseFloat(newProdPrice),
      unit_cost: parseFloat(newProdCost) || 0,
      unitCost: parseFloat(newProdCost) || 0,
      sizes: serializeProductSizes(newProdSizes, parseFloat(newProdPrice) || 0),
      colors: serializeProductColors(newProdColors),
      oldPrice:
        newProdOldPrice && parseFloat(newProdOldPrice) > parseFloat(newProdPrice)
          ? parseFloat(newProdOldPrice)
          : undefined,
      stock: parseInt(newProdStock, 10) || 0,
      badge: newProdBadge || '',
      image: newProdImage || '',
      compatibility: newProdCompat || '',
      description: newProdDesc || '',
    });

    if (created.product) {
      setProducts((prev) => {
        const id = created.product.id || created.product.product_id;
        const without = prev.filter((p) => p.id !== id && p.product_id !== id);
        return [created.product, ...without];
      });
      setIsAddProductOpen(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdCost('0');
      setNewProdSizes([]);
      setNewProdColors([]);
      setNewProdOldPrice('');
      setNewProdDesc('');
      const sizeCount = (created.product.sizes || []).length;
      const colorCount = (created.product.colors || []).length;
      if (created.error) {
        showToast(`Product saved locally, DB sync failed: ${created.error}`);
      } else {
        showToast(
          `Added "${created.product.name.slice(0, 18)}..." (${sizeCount} sizes, ${colorCount} colors)`
        );
      }
    }
  };

  // ─── GARAGE & BOOKINGS COMPUTATIONS & ACTIONS ───
  const bookingStats = useMemo(() => {
    const s = computeBookingDashboardStats(garageBookings);
    return {
      ...s,
      // Legacy aliases used by existing Garage stat cards / filters
      confirmed:
        s.approved +
        s.scheduled +
        garageBookings.filter((b) => normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.CONFIRMED)
          .length,
      inspection: s.underInspection + s.waitingCustomerApproval + s.waitingDownpayment,
      inProgress: s.inProgress,
      serviceDone: s.waitingFinalPayment + s.readyForPickup,
      paid: s.readyForPickup,
    };
  }, [garageBookings]);

  const filteredBookings = useMemo(() => {
    return garageBookings.filter((b) => {
      const q = bookingSearchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        (b.id && b.id.toLowerCase().includes(q)) ||
        (b.booking_id && b.booking_id.toLowerCase().includes(q)) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
        (b.userName && b.userName.toLowerCase().includes(q)) ||
        (b.customer_phone && b.customer_phone.toLowerCase().includes(q)) ||
        (b.userPhone && b.userPhone.toLowerCase().includes(q)) ||
        (b.customer_email && String(b.customer_email).toLowerCase().includes(q)) ||
        (b.bike_brand && b.bike_brand.toLowerCase().includes(q)) ||
        (b.bikeBrand && b.bikeBrand.toLowerCase().includes(q)) ||
        (b.bike_model && b.bike_model.toLowerCase().includes(q)) ||
        (b.bikeModel && b.bikeModel.toLowerCase().includes(q)) ||
        (b.plate_number && b.plate_number.toLowerCase().includes(q)) ||
        (b.bikePlate && b.bikePlate.toLowerCase().includes(q)) ||
        (b.service_title && b.service_title.toLowerCase().includes(q)) ||
        (b.serviceName && b.serviceName.toLowerCase().includes(q));

      const normalized = normalizeBookingStatus(b.status);
      const filterKey = bookingStatusFilter;
      let matchStatus = filterKey === 'All';
      if (!matchStatus) {
        if (filterKey === 'CANCELLED' || filterKey === 'Cancelled') {
          matchStatus =
            normalized === FLEX_BOOKING_STATUS.CANCELLED ||
            normalized === FLEX_BOOKING_STATUS.REJECTED ||
            normalized === FLEX_BOOKING_STATUS.CUSTOMER_DECLINED;
        } else if (filterKey === 'Pending') {
          matchStatus = normalized === FLEX_BOOKING_STATUS.PENDING_REVIEW;
        } else if (filterKey === 'Confirmed') {
          matchStatus =
            normalized === FLEX_BOOKING_STATUS.CONFIRMED ||
            normalized === FLEX_BOOKING_STATUS.APPROVED ||
            normalized === FLEX_BOOKING_STATUS.SCHEDULED;
        } else if (filterKey === 'Inspection') {
          matchStatus =
            normalized === FLEX_BOOKING_STATUS.UNDER_INSPECTION ||
            normalized === FLEX_BOOKING_STATUS.QUOTATION_SENT ||
            normalized === FLEX_BOOKING_STATUS.AWAITING_CUSTOMER_APPROVAL;
        } else if (filterKey === 'In Progress') {
          matchStatus = normalized === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS;
        } else if (filterKey === 'Service Done') {
          matchStatus =
            normalized === FLEX_BOOKING_STATUS.SERVICE_COMPLETED ||
            normalized === FLEX_BOOKING_STATUS.AWAITING_FINAL_PAYMENT ||
            normalized === FLEX_BOOKING_STATUS.READY_FOR_PICKUP;
        } else if (filterKey === 'Completed') {
          matchStatus = normalized === FLEX_BOOKING_STATUS.COMPLETED;
        } else {
          matchStatus = normalized === filterKey || String(b.status) === filterKey;
        }
      }

      const bCategory = (b.category || b.service_type || '').toLowerCase();
      const catLower = bookingCategoryFilter.toLowerCase();
      const matchCategory =
        bookingCategoryFilter === 'All' ||
        bCategory === catLower ||
        (catLower === 'repair' && (bCategory.includes('repair') || (b.service_id && String(b.service_id).includes('repair')))) ||
        (catLower === 'pms' && (bCategory.includes('pms') || (b.service_id && String(b.service_id).includes('pms')))) ||
        (catLower === 'installation' &&
          (bCategory.includes('installation') ||
            bCategory.includes('customization') ||
            bCategory.includes('tuning') ||
            (b.service_id &&
              (String(b.service_id).includes('install') ||
                String(b.service_id).includes('custom')))));

      const dateVal = b.preferred_date || b.appointment_date || b.date || '';
      const matchDate = !bookingDateFilter || String(dateVal).startsWith(bookingDateFilter);

      const custName = (b.customer_name || b.userName || '').trim().toLowerCase();
      const matchCustomer =
        !bookingCustomerFilter ||
        custName.includes(bookingCustomerFilter.toLowerCase().trim());

      return matchQ && matchStatus && matchCategory && matchDate && matchCustomer;
    });
  }, [
    garageBookings,
    bookingSearchQuery,
    bookingStatusFilter,
    bookingCategoryFilter,
    bookingDateFilter,
    bookingCustomerFilter,
  ]);

  const paginatedBookings = useMemo(() => {
    const start = (bookingPage - 1) * BOOKING_PAGE_SIZE;
    return filteredBookings.slice(start, start + BOOKING_PAGE_SIZE);
  }, [filteredBookings, bookingPage]);

  const bookingTotalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKING_PAGE_SIZE));

  const mechanicsStats = useMemo(() => {
    const total = garageMechanics.length;
    const activeBookings = garageBookings.filter(
      (b) =>
        b &&
        !['cancelled', 'declined', 'completed', 'closed'].includes(
          (b.status || '').toLowerCase()
        )
    );

    const busyMechanicIds = new Set();
    const busyMechanicNames = new Set();
    activeBookings.forEach((b) => {
      const assigned = (b.mechanic || '').toLowerCase();
      if (assigned && !assigned.includes('pending')) {
        garageMechanics.forEach((m) => {
          if (
            assigned.includes(m.id.toLowerCase()) ||
            (m.shortName && assigned.includes(m.shortName.toLowerCase())) ||
            assigned.includes(m.name.toLowerCase().split(' ')[0].toLowerCase())
          ) {
            busyMechanicIds.add(m.id);
            busyMechanicNames.add(m.name);
          }
        });
      }
    });

    const busy = garageMechanics.filter(
      (m) =>
        m.status === 'In Pit Bay' ||
        busyMechanicIds.has(m.id) ||
        busyMechanicNames.has(m.name)
    ).length;
    const available = Math.max(0, total - busy);
    const masterCertified = garageMechanics.filter(
      (m) =>
        (m.name || '').toLowerCase().includes('master') ||
        (m.certifications || '').toLowerCase().includes('master') ||
        (m.certifications || '').toLowerCase().includes('gold')
    ).length;

    return { total, available, busy, masterCertified, busyMechanicIds };
  }, [garageMechanics, garageBookings]);

  const filteredMechanics = useMemo(() => {
    return garageMechanics.filter((m) => {
      const q = mechanicSearchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.shortName && m.shortName.toLowerCase().includes(q)) ||
        (m.specialization && m.specialization.toLowerCase().includes(q)) ||
        (m.certifications && m.certifications.toLowerCase().includes(q));

      const isBusy =
        m.status === 'In Pit Bay' || mechanicsStats.busyMechanicIds.has(m.id);
      const matchStatus =
        mechanicFilterStatus === 'All' ||
        (mechanicFilterStatus === 'Available' && !isBusy) ||
        (mechanicFilterStatus === 'In Pit Bay' && isBusy);

      return matchQ && matchStatus;
    });
  }, [garageMechanics, mechanicSearchQuery, mechanicFilterStatus, mechanicsStats]);


  const filteredRiders = useMemo(() => {
    return deliveryRiders.filter((r) => {
      const q = riderSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.shortName || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.username || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.vehicleInfo || '').toLowerCase().includes(q) ||
        (r.plateNumber || '').toLowerCase().includes(q);
      const account = (r.accountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE).toLowerCase();
      const matchesStatus =
        riderFilterStatus === 'All' ||
        r.status === riderFilterStatus ||
        (riderFilterStatus === RIDER_ACCOUNT_STATUSES.ACTIVE && account === 'active') ||
        (riderFilterStatus === RIDER_ACCOUNT_STATUSES.INACTIVE && account === 'inactive');
      return matchesSearch && matchesStatus;
    });
  }, [deliveryRiders, riderSearchQuery, riderFilterStatus]);

  const riderStats = useMemo(() => {
    const total = deliveryRiders.length;
    const active = deliveryRiders.filter(
      (r) => (r.accountStatus || 'Active') === RIDER_ACCOUNT_STATUSES.ACTIVE
    ).length;
    const available = deliveryRiders.filter(
      (r) => r.status === RIDER_STATUSES.AVAILABLE
    ).length;
    const onDelivery = deliveryRiders.filter(
      (r) => r.status === RIDER_STATUSES.ON_DELIVERY
    ).length;
    const offDuty = deliveryRiders.filter(
      (r) => r.status === RIDER_STATUSES.OFF_DUTY
    ).length;
    const inactive = deliveryRiders.filter(
      (r) => r.accountStatus === RIDER_ACCOUNT_STATUSES.INACTIVE
    ).length;
    const totalEarnings = deliveryRiders.reduce(
      (sum, r) => sum + Number(r.totalEarnings || 0),
      0
    );
    return { total, active, available, onDelivery, offDuty, inactive, totalEarnings };
  }, [deliveryRiders]);

  // ─── SUPPLIERS & VENDORS COMPUTATIONS ───
  const supplierStats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(
      (s) => (s.status || '').toLowerCase() === 'active'
    ).length;
    const pending = suppliers.filter(
      (s) => (s.status || '').toLowerCase() === 'pending'
    ).length;
    const inactive = suppliers.filter(
      (s) => (s.status || '').toLowerCase() === 'inactive'
    ).length;
    const topRated = suppliers.filter(
      (s) => parseFloat(s.rating || 0) >= 4.8
    ).length;
    return { total, active, pending, inactive, topRated };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = supplierSearchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.categories && s.categories.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      const statusNorm = (s.status || 'Active').toLowerCase();
      const matchStatus =
        supplierFilterStatus === 'All' ||
        (supplierFilterStatus === 'Active' && statusNorm === 'active') ||
        (supplierFilterStatus === 'Pending' && statusNorm === 'pending') ||
        (supplierFilterStatus === 'Inactive' && statusNorm === 'inactive');

      return matchQ && matchStatus;
    });
  }, [suppliers, supplierSearchQuery, supplierFilterStatus]);

  const getActiveBookingForMechanic = (mech) => {
    return garageBookings.find((b) => {
      if (['cancelled', 'declined', 'completed', 'closed'].includes((b.status || '').toLowerCase()))
        return false;
      const assigned = (b.mechanic || '').toLowerCase();
      if (!assigned || assigned.includes('pending')) return false;
      return (
        assigned.includes(mech.id.toLowerCase()) ||
        (mech.shortName && assigned.includes(mech.shortName.toLowerCase())) ||
        assigned.includes(mech.name.toLowerCase().split(' ')[0].toLowerCase())
      );
    });
  };

  const handleUpdateBookingStatus = async (bookingId, newStatus, mechanic, notes) => {
    const updated = await garageService.updateBookingStatus(bookingId, newStatus, mechanic, notes);
    setGarageBookings(updated);
    if (selectedBookingForModal && selectedBookingForModal.id === bookingId) {
      setSelectedBookingForModal((prev) => ({
        ...prev,
        status: newStatus,
        ...(mechanic && { mechanic }),
        ...(notes !== undefined && { notes }),
      }));
    }
    showToast(`Booking #${bookingId} marked as ${newStatus}`);
  };

  const handleOpenBookingModal = (booking) => {
    setSelectedBookingForModal(booking);
    setEditBkStatus(booking.status || 'Pending');
    setEditBkDate(booking.appointment_date || booking.date || 'Today');
    setEditBkTimeSlot(booking.time_slot || booking.time || '10:30 AM - 12:00 PM');
    setEditBkBranch(booking.branch || 'MotoTrack Flagship Central Hub & Pit Bays');
    setEditBkMechanic(booking.mechanic || '');
    setEditBkNotes(booking.notes || booking.problem_description || '');
    setEditBkPrice(
      String(
        booking.final_service_total ||
        booking.estimated_service_total ||
        booking.total_price_with_estimates ||
        booking.pricePhp ||
        usdToPhp(booking.service_price) ||
        0
      )
    );
    setEditBkPlate(booking.plate_number || booking.bikePlate || '');
    setSelectedMechanicForApproval(booking.mechanic || '');
    setRejectReasonInput('');
    setInspectionNotesInput('');
    setNewEstimateTitle('');
    setNewEstimateAmount('');
    setNewEstimateDesc('');
    setReleaseNotesInput('');
    setPaymentMethodInput('Cash');
    setIsBookingModalOpen(true);
  };

  const handleOpenBookingDetail = handleOpenBookingModal;

  // 1. Advisor Approves Booking & Assigns Mechanic
  const handleAdvisorApprove = async (bookingId, mechanic) => {
    const booking =
      selectedBookingForModal ||
      garageBookings.find((b) => b.id === bookingId || b.booking_id === bookingId);
    const mechObj = garageMechanics.find((m) => m.name === mechanic);
    const flexible =
      booking?.booking_mode === 'flexible' ||
      booking?.status === 'PENDING_REVIEW' ||
      String(booking?.status || '').toUpperCase() === 'PENDING_REVIEW';
    const updated = await garageService.approveBooking(bookingId, mechanic, {
      flexible,
      mechanicId: mechObj?.id,
      approvedBy: 'admin',
    });
    setGarageBookings(updated);
    const next = Array.isArray(updated)
      ? updated.find((b) => b.id === bookingId || b.booking_id === bookingId)
      : null;
    if (selectedBookingForModal?.id === bookingId || selectedBookingForModal?.booking_id === bookingId) {
      if (next) setSelectedBookingForModal(next);
      setEditBkStatus(next?.status || (flexible ? 'APPROVED' : 'Confirmed'));
      setEditBkMechanic(mechanic);
    }
    showToast(`✓ Booking #${bookingId} confirmed! Assigned to ${mechanic}.`);
  };

  // 2. Advisor Rejects Booking
  const handleAdvisorReject = async (bookingId, reason) => {
    const updated = await garageService.rejectBooking(bookingId, reason);
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      setSelectedBookingForModal(updated.find((b) => b.id === bookingId));
      setEditBkStatus('Rejected');
    }
    showToast(`Booking #${bookingId} declined.`);
  };

  // 3. Customer Arrives -> Check In & Begin Inspection
  const handleAdvisorCheckIn = async (bookingId, notes) => {
    const updated = await garageService.checkInBooking(bookingId, notes);
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      setSelectedBookingForModal(updated.find((b) => b.id === bookingId));
      setEditBkStatus('Inspection');
    }
    showToast(`🛵 Motorcycle checked in to Pit Bay! Inspection started.`);
  };

  // 4. Send Additional Estimate to Rider
  const handleAdvisorSendEstimate = async (bookingId) => {
    if (!newEstimateTitle.trim() || !newEstimateAmount.trim()) {
      showToast('⚠️ Please enter estimate title and amount');
      return;
    }
    const updated = await garageService.addInspectionEstimate(bookingId, {
      title: newEstimateTitle.trim(),
      amount: Number(newEstimateAmount) || 0,
      description: newEstimateDesc.trim(),
    });
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      setSelectedBookingForModal(updated.find((b) => b.id === bookingId));
      setEditBkStatus('Estimate Pending');
    }
    setNewEstimateTitle('');
    setNewEstimateAmount('');
    setNewEstimateDesc('');
    showToast(`⚠️ Additional estimate sent to rider for authorization!`);
  };

  // 5. No Extra Problems Found -> Continue Base Service
  const handleAdvisorContinueService = async (bookingId) => {
    const updated = await garageService.continueScheduledService(bookingId);
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      setSelectedBookingForModal(updated.find((b) => b.id === bookingId));
      setEditBkStatus('In Progress');
    }
    showToast(`🔧 Base service proceeding in bay.`);
  };

  // 6. Update Service Progress
  const handleAdvisorUpdateProgress = async (bookingId, percent, desc) => {
    const updated = await garageService.updateServiceProgress(bookingId, percent, desc);
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      const refreshed = updated.find((b) => b.id === bookingId);
      setSelectedBookingForModal(refreshed);
      setEditBkStatus(refreshed?.status || 'In Progress');
    }
    showToast(percent >= 100 ? `🏁 Quality inspection passed! Ready for pickup.` : `Progress updated to ${percent}%.`);
  };

  // 7. Settle Final Bill Payment
  const handleAdvisorProcessPayment = async (bookingId, amount, method) => {
    const updated = await garageService.processBookingPayment(bookingId, {
      amount,
      paymentMethod: method || 'Cash',
    });
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      const refreshed = updated.find((b) => b.id === bookingId);
      setSelectedBookingForModal(refreshed);
      setEditBkStatus('Paid');
    }
    showToast(`💳 Payment of ₱${Number(amount).toLocaleString()} recorded via ${method}!`);
  };

  // 8. Release Motorcycle & Close Booking
  const handleAdvisorReleaseMotorcycle = async (bookingId, notes) => {
    const updated = await garageService.releaseMotorcycle(bookingId, notes);
    setGarageBookings(updated);
    if (selectedBookingForModal?.id === bookingId) {
      const refreshed = updated.find((b) => b.id === bookingId);
      setSelectedBookingForModal(refreshed);
      setEditBkStatus('Closed');
    }
    showToast(`🏁 Motorcycle released to rider! Service report & next PMS logged.`);
  };

  const handleSaveBookingEdit = async () => {
    if (!selectedBookingForModal) return;
    const priceNum = Number(editBkPrice) || 3750;
    const updated = await garageService.updateBooking(selectedBookingForModal.id, {
      status: editBkStatus,
      appointment_date: editBkDate,
      time_slot: editBkTimeSlot,
      branch: editBkBranch,
      mechanic: editBkMechanic,
      notes: editBkNotes,
      plate_number: editBkPlate,
      service_price: Math.round(priceNum / 50),
      pricePhp: priceNum,
    });
    setGarageBookings(updated);
    setIsBookingModalOpen(false);
    showToast(`Work order for #${selectedBookingForModal.id} updated!`);
  };

  const handleCreateAdminBooking = async () => {
    if (!newBkCustomerName.trim()) {
      showAlert('Required Field', 'Please enter customer full name.');
      return;
    }
    const serviceLabel =
      newBkCategory === 'Repair' ? 'Repair Service' : 'PMS Service';

    const created = await garageService.createAdminBooking({
      booking_mode: 'flexible',
      flexible: true,
      skip_downpayment: true,
      customer_name: newBkCustomerName.trim(),
      customer_phone: newBkCustomerPhone.trim() || 'N/A',
      customer_email: newBkCustomerEmail.trim() || '',
      category: newBkCategory,
      service_type: newBkCategory,
      package_id: null,
      package_name: serviceLabel,
      package_price: 0,
      included_services: [],
      service_id: null,
      service_title: serviceLabel,
      service_price: 0,
      pricePhp: 0,
      downpayment_required: false,
      downpayment_percent: 0,
      downpayment_amount: 0,
      downpayment_paid: false,
      downpayment_status: 'Not Required',
      remaining_balance: 0,
      is_non_refundable: false,
      bike_brand: newBkBikeBrand || 'Yamaha',
      bike_model: newBkBikeModel || 'NMAX 155',
      plate_number: newBkPlate.trim() || 'TEMP-PLATE',
      odometer: newBkOdo.trim() || '0 km',
      preferred_date: newBkDate || '',
      appointment_date: newBkDate || '',
      preferred_time: newBkTimeSlot || '',
      time_slot: newBkTimeSlot || '',
      branch: newBkBranch || 'MotoTrack Flagship Central Hub & Pit Bays',
      mechanic: newBkMechanic && !String(newBkMechanic).toLowerCase().includes('pending')
        ? newBkMechanic
        : 'Pending Assignment',
      problem_description: newBkNotes.trim() || 'Walk-in service request created by admin.',
      notes: newBkNotes.trim() || 'Walk-in service request created by admin.',
      status: 'PENDING_REVIEW',
    });

    const bks = garageService.getLocalBookings();
    setGarageBookings(bks);
    setIsNewBookingModalOpen(false);
    setNewBkCustomerName('');
    setNewBkCustomerPhone('');
    setNewBkCustomerEmail('');
    setNewBkPlate('');
    setNewBkOdo('');
    setNewBkNotes('');
    showToast(`Service request ${created.id} submitted for ${created.customer_name} (pending review).`);
  };

  const handleDeleteBooking = (bookingId) => {
    showConfirm({
      title: 'Delete Service Booking Ticket',
      message: `Are you sure you want to delete appointment ticket #${bookingId}? This will remove it from the pit bay schedule and database.`,
      itemName: `Booking Ticket #${bookingId}`,
      confirmText: 'Delete Ticket',
      cancelText: 'Keep Appointment',
      type: 'danger',
      confirmIcon: 'trash3-fill',
      onConfirm: async () => {
        const updated = await garageService.deleteBooking(bookingId);
        setGarageBookings(updated);
        if (
          selectedBookingForModal?.id === bookingId ||
          selectedBookingForModal?.booking_id === bookingId
        ) {
          setIsBookingModalOpen(false);
        }
        showToast(`Booking #${bookingId} deleted.`);
      },
    });
  };

  const handleSaveGarageService = async () => {
    if (!servTitle.trim() || !servPrice.trim()) {
      showAlert('Required Fields', 'Please enter a Service Title and Price.');
      return;
    }
    const priceNum = Number(servPrice) || 0;
    if (editingGarageService) {
      await garageService.updateService(editingGarageService.id, {
        title: servTitle.trim(),
        category: servCategory,
        subtitle: servSubtitle.trim(),
        price: priceNum,
        pricePhp: priceNum,
        duration: servDuration,
        badge: servBadge,
        image: servImage,
        description: servDesc.trim(),
        inclusions: servInclusions,
      });
      showToast(`Service "${servTitle}" updated!`);
    } else {
      await garageService.addService({
        title: servTitle.trim(),
        category: servCategory,
        subtitle: servSubtitle.trim(),
        price: priceNum,
        pricePhp: priceNum,
        duration: servDuration,
        badge: servBadge,
        image: servImage,
        description: servDesc.trim(),
        inclusions: servInclusions,
      });
      showToast(`Service package "${servTitle}" added to catalog!`);
    }
    setGarageServices(garageService.getServices());
    setIsAddGarageOpen(false);
    setEditingGarageService(null);
  };

  const resetPmsRateForm = () => {
    setEditingPmsRate(null);
    setPmsRateName('');
    setPmsRateCatalogCategory(CATALOG_CATEGORIES.PMS);
    setPmsRate125('');
    setPmsRate150('');
    setPmsRateBig('');
    setPmsRate125Na(false);
    setPmsRate150Na(false);
    setPmsRateBigNa(false);
  };

  const openAddPmsRateModal = () => {
    resetPmsRateForm();
    setIsAddPmsRateOpen(true);
  };

  const openEditPmsRateModal = (srv) => {
    setEditingPmsRate(srv);
    setPmsRateName(srv.name || '');
    setPmsRateCatalogCategory(srv.catalogCategory === 'Repair' ? CATALOG_CATEGORIES.REPAIR : CATALOG_CATEGORIES.PMS);
    const p125 = srv.prices?.['cc-125-below'];
    const p150 = srv.prices?.['cc-150-160'];
    const pBig = srv.prices?.['cc-big-bikes'];
    setPmsRate125Na(p125 == null);
    setPmsRate150Na(p150 == null);
    setPmsRateBigNa(pBig == null);
    setPmsRate125(p125 == null ? '' : String(p125));
    setPmsRate150(p150 == null ? '' : String(p150));
    setPmsRateBig(pBig == null ? '' : String(pBig));
    setIsAddPmsRateOpen(true);
  };

  const syncPmsRateCatalogFromResult = (catalog) => {
    const services = (catalog?.services || []).map((s) => ({
      no: s.sortOrder ?? s.sort_order ?? 0,
      id: s.id,
      name: s.name,
      catalogCategory: s.catalogCategory || 'PMS',
      isActive: s.isActive !== false,
      prices: { ...(s.prices || {}) },
    }));
    services.sort((a, b) => a.no - b.no);
    setPmsRateCatalog(services);
  };

  const handleSavePmsFixedRate = async () => {
    if (!pmsRateName.trim()) {
      showAlert('Required Field', 'Please enter a service description.');
      return;
    }
    if (!pmsRate125Na && !String(pmsRate125).trim()) {
      showAlert('Required Field', 'Enter a Tier 1 price or mark Price not configured.');
      return;
    }
    if (!pmsRate150Na && !String(pmsRate150).trim()) {
      showAlert('Required Field', 'Enter a Tier 2 price or mark Price not configured.');
      return;
    }
    if (!pmsRateBigNa && !String(pmsRateBig).trim()) {
      showAlert('Required Field', 'Enter a Tier 3 price or mark Price not configured.');
      return;
    }

    const pricesByCategory = {
      'cc-125-below': pmsRate125Na ? null : pmsRate125,
      'cc-150-160': pmsRate150Na ? null : pmsRate150,
      'cc-big-bikes': pmsRateBigNa ? null : pmsRateBig,
    };

    setPmsRateSaving(true);
    try {
      const result = editingPmsRate
        ? await pmsPricingService.updateFixedRateService(editingPmsRate.id, {
          name: pmsRateName.trim(),
          catalogCategory: pmsRateCatalogCategory,
          pricesByCategory,
        })
        : await pmsPricingService.createFixedRateService({
          name: pmsRateName.trim(),
          catalogCategory: pmsRateCatalogCategory,
          pricesByCategory,
        });

      if (!result?.success) {
        showAlert('Could not save', result?.error || 'Failed to save fixed rate.');
        return;
      }

      if (result.catalog) {
        syncPmsRateCatalogFromResult(result.catalog);
      } else {
        const catalog = await pmsPricingService.loadCatalog({ forceRefresh: true, includeInactive: true });
        syncPmsRateCatalogFromResult(catalog);
      }

      showToast(
        editingPmsRate
          ? `Service "${pmsRateName.trim()}" updated.`
          : `Service "${pmsRateName.trim()}" added to catalog.`
      );
      setIsAddPmsRateOpen(false);
      resetPmsRateForm();
    } catch (err) {
      showAlert('Could not save', err?.message || 'Unexpected error while saving fixed rate.');
    } finally {
      setPmsRateSaving(false);
    }
  };

  const handleTogglePmsServiceActive = (srv) => {
    const nextActive = srv.isActive === false;
    showConfirm({
      title: nextActive ? 'Activate Service' : 'Archive Service',
      message: nextActive
        ? 'This service will become bookable again for customers (when prices are configured).'
        : 'Archived services stay in history but cannot be selected for new bookings.',
      itemName: srv.name,
      confirmText: nextActive ? 'Activate' : 'Archive',
      cancelText: 'Cancel',
      type: nextActive ? 'info' : 'danger',
      confirmIcon: nextActive ? 'check2-circle' : 'archive',
      onConfirm: async () => {
        const result = await pmsPricingService.setServiceActive(srv.id, nextActive);
        if (!result?.success) {
          showAlert('Could not update', result?.error || 'Failed to update service status.');
          return;
        }
        if (result.catalog) syncPmsRateCatalogFromResult(result.catalog);
        showToast(nextActive ? `"${srv.name}" activated.` : `"${srv.name}" archived.`);
      },
    });
  };

  const handleDeleteGarageService = (serviceId, name) => {
    showConfirm({
      title: 'Delete Garage Service Package',
      message: 'Are you sure you want to delete this pitstop service package from the active garage catalog?',
      itemName: name,
      confirmText: 'Delete Package',
      cancelText: 'Keep Service',
      type: 'danger',
      confirmIcon: 'trash3-fill',
      onConfirm: async () => {
        await garageService.deleteService(serviceId);
        setGarageServices(garageService.getServices());
        showToast(`Service package "${name}" deleted.`);
      },
    });
  };

  // ─── MECHANIC & TECHNICIAN ACTIONS (admin roster only — no login accounts) ───
  const handleOpenAddMechanic = () => {
    setEditingMechanic(null);
    setMechName('');
    setMechShortName('');
    setMechSpecialization('');
    setMechExperience('');
    setMechCertifications('');
    setMechAvatar('');
    setMechStatus('Available');
    setMechPhone('');
    setMechEmail('');
    setIsAddMechanicModalOpen(true);
  };

  const handleOpenEditMechanic = (mech) => {
    setEditingMechanic(mech);
    setMechName(mech.name || '');
    setMechShortName(mech.shortName || '');
    setMechSpecialization(mech.specialization || 'Engine Overhaul & Diagnostics');
    setMechExperience(mech.experience || '5 Years Pro Tech');
    setMechCertifications(mech.certifications || 'Certified Motorcycle Technician');
    setMechAvatar(mech.avatar || MECHANIC_AVATAR_PRESETS[0]);
    setMechStatus(mech.status || 'Available');
    setMechPhone(mech.phone || '');
    setMechEmail(mech.email || '');
    setIsAddMechanicModalOpen(true);
  };

  const handleSaveMechanic = async () => {
    if (!mechName.trim()) {
      showAlert('Required Field', 'Please enter the technician full name.');
      return;
    }

    const payload = {
      name: mechName.trim(),
      shortName: mechShortName.trim() || mechName.trim().split('(')[0].trim(),
      specialization: mechSpecialization.trim() || 'General Superbike Tuning',
      experience: mechExperience.trim() || '5 Years Pro Tech',
      certifications: mechCertifications.trim() || 'Certified Motorcycle Technician',
      avatar: mechAvatar.trim() || MECHANIC_AVATAR_PRESETS[0],
      status: mechStatus || 'Available',
      phone: mechPhone.trim(),
      email: mechEmail.trim().toLowerCase(),
      isActive: true,
      is_active: true,
    };

    if (editingMechanic) {
      const res = await garageService.updateMechanic(editingMechanic.id, payload);
      if (res.success) {
        setGarageMechanics(garageService.getMechanics());
        setIsAddMechanicModalOpen(false);
        setEditingMechanic(null);
        showToast(`✓ Updated mechanic profile for ${payload.shortName || payload.name}`);
      } else {
        showAlert('Update Failed', res.error || 'Unable to update technician profile.');
      }
      return;
    }

    const res = await garageService.addMechanic(payload);
    if (res.success) {
      try {
        await garageService.fetchMechanics?.({ force: true });
      } catch (_e) { }
      setGarageMechanics(garageService.getMechanics());
      setIsAddMechanicModalOpen(false);
      showToast(`✓ Added ${payload.shortName || payload.name} to the pit bay roster`);
    } else {
      showAlert('Error', res.error || 'Failed to add mechanic to roster.');
    }
  };

  const handleDeleteMechanic = (mech) => {
    showConfirm({
      title: 'Remove Technician from Roster',
      message: `Are you sure you want to remove ${mech.name} from the active pit bay roster?`,
      itemName: mech.name,
      confirmText: 'Remove Technician',
      cancelText: 'Keep on Roster',
      type: 'danger',
      confirmIcon: 'trash3-fill',
      onConfirm: async () => {
        await garageService.deleteMechanic(mech.id);
        setGarageMechanics(garageService.getMechanics());
        showToast(`Removed ${mech.shortName || mech.name} from roster.`);
      },
    });
  };

  // ─── RIDER / DELIVERY STAFF ACTIONS ───
  const resetRiderForm = () => {
    setRiderName('');
    setRiderShortName('');
    setRiderPhone('');
    setRiderVehicle('');
    setRiderPlate('');
    setRiderAvatar('');
    setRiderStatus(RIDER_STATUSES.AVAILABLE);
    setRiderNotes('');
    setRiderIdInput('');
    setRiderEmail('');
    setRiderPassword('');
    setRiderAccountStatus(RIDER_ACCOUNT_STATUSES.ACTIVE);
  };

  const handleOpenAddRider = () => {
    setEditingRider(null);
    resetRiderForm();
    setIsAddRiderModalOpen(true);
  };

  const handleOpenEditRider = (rider) => {
    setEditingRider(rider);
    setRiderName(rider.name || '');
    setRiderShortName(rider.shortName || '');
    setRiderPhone(rider.phone || '');
    setRiderVehicle(rider.vehicleInfo || '');
    setRiderPlate(rider.plateNumber || '');
    setRiderAvatar(rider.avatar || '');
    setRiderStatus(rider.status || RIDER_STATUSES.AVAILABLE);
    setRiderNotes(rider.notes || '');
    setRiderIdInput(rider.id || '');
    setRiderEmail(rider.email || '');
    setRiderPassword('');
    setRiderAccountStatus(rider.accountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE);
    setIsAddRiderModalOpen(true);
  };

  const handleAddRider = async () => {
    if (!riderName.trim()) {
      showAlert('Required Field', 'Please enter the rider full name.');
      return;
    }
    if (!riderPhone.trim() || riderPhone.trim().length < 8) {
      showAlert('Required Field', 'Please enter a valid rider phone number.');
      return;
    }
    const cleanEmail = riderEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showAlert('Required Field', 'Enter the rider email for OTP verification.');
      return;
    }

    const res = await staffAccountApi.createStaffAccount({
      name: riderName.trim(),
      email: cleanEmail,
      phone: riderPhone.trim(),
      role: 'rider',
      roster: {
        id: riderIdInput.trim() || undefined,
        shortName: riderShortName.trim() || riderName.trim().split(' ')[0],
        vehicleInfo: riderVehicle.trim(),
        plateNumber: riderPlate.trim(),
        avatar: riderAvatar.trim() || '',
        status: riderStatus || RIDER_STATUSES.AVAILABLE,
        notes: riderNotes.trim(),
      },
    });

    if (res.success) {
      try {
        await riderService.fetchRiders?.({ force: true });
      } catch (_e) { }
      setDeliveryRiders(riderService.getRiders());
      setIsAddRiderModalOpen(false);
      setEditingRider(null);
      if (res.partial || res.emailError) {
        showAlert(
          'OTP email issue',
          res.emailError ||
          res.message ||
          'Account is pending. OTP email failed — use Staff email verification → Resend Code, or configure RESEND_API_KEY / Gmail SMTP in server/.env.'
        );
      } else if (res.warning) {
        showToast(`✓ Rider invited (dev OTP — check server console)`);
        showAlert(
          'OTP in server console',
          `Account created for ${cleanEmail}, but email is not configured yet.\n\nCopy the OTP from the API terminal, then open Login → Staff email verification.\nAfter verify, the temporary password is also printed/emailed.\n\nTo send real Gmail: set RESEND_API_KEY or Gmail SMTP in server/.env and restart the server.`
        );
      } else {
        showToast(`✓ Rider invited. OTP sent to ${cleanEmail}`);
        showAlert(
          'Verify email',
          `A 6-digit OTP was sent to ${cleanEmail}. After the rider verifies, a temporary password will be emailed automatically.`
        );
      }
    } else {
      showAlert('Error', res.error || 'Failed to create rider account.');
    }
  };

  const handleUpdateRider = async () => {
    if (!editingRider) return;
    if (!riderName.trim()) {
      showAlert('Required Field', 'Please enter the rider full name.');
      return;
    }
    if (!riderPhone.trim() || riderPhone.trim().length < 8) {
      showAlert('Required Field', 'Please enter a valid rider phone number.');
      return;
    }

    // Admin may edit roster/profile only — not login credentials
    const payload = {
      name: riderName.trim(),
      shortName: riderShortName.trim() || riderName.trim().split(' ')[0],
      phone: riderPhone.trim(),
      accountStatus: riderAccountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE,
      vehicleInfo: riderVehicle.trim(),
      plateNumber: riderPlate.trim(),
      avatar: riderAvatar.trim() || '',
      status: riderStatus || RIDER_STATUSES.AVAILABLE,
      notes: riderNotes.trim(),
    };

    const res = await riderService.updateRider(editingRider.id, payload);
    if (res.success) {
      setDeliveryRiders(riderService.getRiders());
      setIsAddRiderModalOpen(false);
      setEditingRider(null);
      showToast(`✓ Updated ${payload.shortName || payload.name}`);
    } else {
      showAlert('Update Failed', res.error || 'Unable to update rider.');
    }
  };

  const handleSaveRider = async () => {
    if (editingRider) {
      await handleUpdateRider();
    } else {
      await handleAddRider();
    }
  };

  const handleDeleteRider = (rider) => {
    showConfirm({
      title: 'Remove Delivery Rider',
      message: `Remove ${rider.name} from the delivery staff roster?`,
      itemName: rider.name,
      confirmText: 'Remove Rider',
      cancelText: 'Keep on Roster',
      type: 'danger',
      confirmIcon: 'trash3-fill',
      onConfirm: async () => {
        const res = await riderService.deleteRider(rider.id);
        if (res.success) {
          setDeliveryRiders(riderService.getRiders());
          showToast(`Removed ${rider.shortName || rider.name} from roster.`);
        } else {
          showAlert('Error', res.error || 'Failed to delete rider.');
        }
      },
    });
  };

  const handleToggleRiderStatus = async (rider) => {
    const cycle = [
      RIDER_STATUSES.AVAILABLE,
      RIDER_STATUSES.ON_DELIVERY,
      RIDER_STATUSES.OFF_DUTY,
    ];
    const idx = cycle.indexOf(rider.status);
    const next = cycle[(idx + 1) % cycle.length];
    const res = await riderService.setRiderStatus(rider.id, next);
    if (res.success) {
      setDeliveryRiders(riderService.getRiders());
      showToast(`${rider.shortName || rider.name} → ${next}`);
    } else {
      showAlert('Error', res.error || 'Failed to update status.');
    }
  };

  // ─── SUPPLIER & VENDOR ACTIONS ───
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupContactPerson('');
    setSupEmail('');
    setSupPhone('');
    setSupAddress('');
    setSupCategories(SUPPLIER_CATEGORY_PRESETS[0] || 'Exhaust & Performance');
    setSupLeadTime('3-5 Days');
    setSupRating('5.0');
    setSupStatus('Active');
    setSupNotes('');
    setIsAddSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup) => {
    setEditingSupplier(sup);
    setSupName(sup.name || '');
    setSupContactPerson(sup.contact_person || '');
    setSupEmail(sup.email || '');
    setSupPhone(sup.phone || '');
    setSupAddress(sup.address || '');
    setSupCategories(sup.categories || SUPPLIER_CATEGORY_PRESETS[0] || 'Exhaust & Performance');
    setSupLeadTime(sup.lead_time || '3-5 Days');
    setSupRating(sup.rating ? String(sup.rating) : '5.0');
    setSupStatus(sup.status || 'Active');
    setSupNotes(sup.notes || '');
    setIsAddSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supName.trim()) {
      showAlert('Required Field', 'Please enter the supplier company name.');
      return;
    }

    const payload = {
      name: supName.trim(),
      contact_person: supContactPerson.trim() || 'Purchasing Department',
      email: supEmail.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      categories: supCategories.trim() || 'Exhaust & Performance',
      lead_time: supLeadTime.trim() || '3-5 Days',
      rating: supRating.trim() || '5.0',
      status: supStatus || 'Active',
      notes: supNotes.trim(),
    };

    if (editingSupplier) {
      const supId = editingSupplier.supplier_id || editingSupplier.id;
      const res = await supplierService.updateSupplier(supId, payload);
      if (res.success) {
        setSuppliers(supplierService.getSuppliers());
        setIsAddSupplierModalOpen(false);
        setEditingSupplier(null);
        showToast(`✓ Updated supplier profile for ${payload.name}`);
      } else {
        showAlert('Update Failed', res.error || 'Unable to update supplier.');
      }
    } else {
      const res = await supplierService.addSupplier(payload);
      if (res.success) {
        setSuppliers(supplierService.getSuppliers());
        setIsAddSupplierModalOpen(false);
        showToast(`✓ Registered ${payload.name} to supplier catalog!`);
      } else {
        showAlert('Error', res.error || 'Failed to add supplier.');
      }
    }
  };

  const handleDeleteSupplier = (sup) => {
    const supId = sup.supplier_id || sup.id;
    showConfirm({
      title: 'Remove Supplier Partner',
      message: `Are you sure you want to remove ${sup.name} from your active supplier directory?`,
      itemName: sup.name,
      confirmText: 'Remove Supplier',
      cancelText: 'Cancel',
      type: 'danger',
      confirmIcon: 'trash3-fill',
      onConfirm: async () => {
        await supplierService.deleteSupplier(supId);
        setSuppliers(supplierService.getSuppliers());
        showToast(`Removed ${sup.name} from supplier catalog.`);
      },
    });
  };

  // ─── USER ACTIONS ───
  const handleToggleUserRole = async (userId, currentRole) => {
    const actingAdminId = currentUser?.user_id || currentUser?.id;
    if (actingAdminId && userId === actingAdminId) {
      showAlert('Notice', 'You cannot demote your own active administrator account.');
      return;
    }
    // Cycle: user → admin → user (mechanic role is retired)
    const order = ['user', 'admin'];
    const idx = order.indexOf(currentRole === 'rider' || currentRole === 'mechanic' ? 'user' : currentRole);
    const newRole = order[(idx + 1) % order.length];
    const res = await userService.updateUserRole(userId, newRole, actingAdminId);
    if (!res?.success) {
      showAlert('Notice', res?.error || 'Could not update user role.');
      return;
    }
    await loadData();
    const labels = {
      admin: 'Store Administrator',
      user: 'Customer',
    };
    showToast(`Updated user role to ${labels[newRole] || newRole}`);
  };

  const handleToggleUserStatus = (userId, name, currentStatus) => {
    const actingAdminId = currentUser?.user_id || currentUser?.id;
    if (actingAdminId && userId === actingAdminId) {
      showAlert('Notice', 'You cannot disable your own active administrator account.');
      return;
    }
    const isCurrentlyDisabled = currentStatus === 'disabled';
    const newStatus = isCurrentlyDisabled ? 'active' : 'disabled';

    showConfirm({
      title: isCurrentlyDisabled ? 'Enable User Account' : 'Disable User Account',
      message: isCurrentlyDisabled
        ? `Are you sure you want to enable the account for "${name}"? The user will regain access to sign in and shop.`
        : `Are you sure you want to disable the account for "${name}"? The user will be blocked from logging in and placing orders.`,
      itemName: `${name} (${isCurrentlyDisabled ? 'Currently Disabled' : 'Currently Active'})`,
      confirmText: isCurrentlyDisabled ? 'Enable Account' : 'Disable Account',
      cancelText: 'Cancel',
      type: isCurrentlyDisabled ? 'success' : 'danger',
      confirmIcon: isCurrentlyDisabled ? 'check-circle-fill' : 'slash-circle-fill',
      onConfirm: async () => {
        const res = await userService.updateUserStatus(userId, newStatus, actingAdminId);
        if (!res?.success) {
          showAlert('Notice', res?.error || 'Could not update user status.');
          return;
        }
        await loadData();
        showToast(
          isCurrentlyDisabled
            ? `Account "${name}" has been ENABLED.`
            : `Account "${name}" has been DISABLED.`
        );
      },
    });
  };

  const handleDeleteUser = (userId, name, role) => {
    if (userId === currentUser?.id) {
      showAlert('Notice', 'You cannot delete your own active administrator account.');
      return;
    }
    if (role === 'admin') {
      showAlert(
        'Notice',
        'Administrator accounts cannot be deleted. Demote the account to Customer first if you must remove access.'
      );
      return;
    }
    showConfirm({
      title: 'Delete User Account',
      message: `Are you sure you want to delete account "${name}"? Profile and user records will be permanently removed.`,
      itemName: name,
      confirmText: 'Delete Account',
      cancelText: 'Cancel',
      type: 'danger',
      confirmIcon: 'person-x-fill',
      onConfirm: async () => {
        const res = await userService.deleteUser(userId);
        if (!res?.success) {
          showAlert('Notice', res?.error || 'Could not delete this account.');
          return;
        }
        await loadData();
        showToast(`Deleted user account "${name}"`);
      },
    });
  };

  // ─── ORDER COMPUTATIONS & ACTIONS ───
  const pendingCodOrders = useMemo(() => {
    return orders.filter((o) => {
      const isCOD =
        (o.payment_method || '').toLowerCase().includes('cash') || (o.payment_method || '').includes('COD');
      const isPending =
        (o.status || '').toLowerCase().includes('pending') ||
        (o.status || '').toLowerCase().includes('approval');
      return isCOD && isPending;
    });
  }, [orders]);

  const pendingCodCount = pendingCodOrders.length;

  const parseOrderDate = useCallback((order) => {
    if (!order) return null;
    if (order.created_at) {
      const d = new Date(order.created_at);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (order.updated_at) {
      const d = new Date(order.updated_at);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (order.order_date) {
      const raw = String(order.order_date).trim();
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
      const lower = raw.toLowerCase();
      const now = new Date();
      if (lower.includes('today')) return now;
      if (lower.includes('yesterday')) {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return y;
      }
    }
    if (order.date) {
      const d = new Date(order.date);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const idStr = String(order.order_id || order.id || '');
    const tsMatch = idStr.match(/(?:ord-)?(\d{12,14})/);
    if (tsMatch) {
      const ts = Number(tsMatch[1]);
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2040) {
        return d;
      }
    }
    const yrMatch = idStr.match(/(?:20\d{2})/);
    if (yrMatch) {
      return new Date(parseInt(yrMatch[0], 10), 0, 1);
    }
    return null;
  }, []);

  const orderAvailableYears = useMemo(() => {
    const yearsSet = new Set();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    (orders || []).forEach((o) => {
      const d = parseOrderDate(o);
      if (d) yearsSet.add(d.getFullYear());
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [orders, parseOrderDate]);

  const ordersCountByMonthYear = useMemo(() => {
    const map = {};
    (orders || []).forEach((o) => {
      const d = parseOrderDate(o);
      if (d) {
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        map[key] = (map[key] || 0) + 1;
        const yKey = `${d.getFullYear()}-all`;
        map[yKey] = (map[yKey] || 0) + 1;
      }
    });
    return map;
  }, [orders, parseOrderDate]);

  const isOrderDateFiltered = orderMonthFilter !== 'All' || orderYearFilter !== 'All';

  const orderDateFilterLabel = useMemo(() => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (orderYearFilter === 'All' && orderMonthFilter === 'All') {
      return 'All Dates';
    }
    if (orderYearFilter !== 'All' && orderMonthFilter === 'All') {
      return `All of ${orderYearFilter}`;
    }
    if (orderYearFilter === 'All' && orderMonthFilter !== 'All') {
      return `${months[orderMonthFilter]} (All Years)`;
    }
    return `${months[orderMonthFilter]} ${orderYearFilter}`;
  }, [orderMonthFilter, orderYearFilter]);

  const periodOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (orderYearFilter === 'All' && orderMonthFilter === 'All') return true;
      const d = parseOrderDate(o);
      if (!d) return false;
      if (orderYearFilter !== 'All' && d.getFullYear() !== Number(orderYearFilter)) {
        return false;
      }
      if (orderMonthFilter !== 'All' && d.getMonth() !== Number(orderMonthFilter)) {
        return false;
      }
      return true;
    });
  }, [orders, orderYearFilter, orderMonthFilter, parseOrderDate]);

  const periodOrderStats = useMemo(() => {
    const targetList = periodOrders;
    const total = targetList.length;
    const pendingCod = targetList.filter((o) => {
      const pm = (o.payment_method || '').toLowerCase();
      const st = (o.status || '').toLowerCase();
      const isCOD = pm.includes('cod') || pm.includes('cash');
      const isPending = st.includes('pending') || st.includes('approval');
      return isCOD && isPending;
    }).length;
    const processing = targetList.filter((o) => (o.status || '').toLowerCase() === 'processing').length;
    const ready = targetList.filter((o) => (o.status || '').toLowerCase() === 'ready for delivery').length;
    const shipped = targetList.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s === 'shipped' || s === 'in transit' || s === 'out for delivery';
    }).length;
    const reported = targetList.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s === 'delivery reported' || s === 'reported';
    }).length;
    const failed = targetList.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s === 'delivery failed' || s === 'delivery issue';
    }).length;
    const rescheduled = targetList.filter((o) => (o.status || '').toLowerCase() === 'rescheduled').length;
    const delivered = targetList.filter(
      (o) => (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed'
    ).length;
    const cancelled = targetList.filter((o) => (o.status || '').toLowerCase() === 'cancelled').length;
    const totalRevenue = targetList
      .filter(isRecognizedSalesOrder)
      .reduce((sum, o) => sum + recognizedOrderAmount(o), 0);

    return {
      total,
      pendingCod,
      processing,
      ready,
      shipped,
      reported,
      failed,
      rescheduled,
      delivered,
      cancelled,
      totalRevenue,
    };
  }, [periodOrders]);
  const orderStats = useMemo(() => {
    const total = orders.length;
    const pendingCod = pendingCodCount;
    const processing = orders.filter((o) => (o.status || '').toLowerCase() === 'processing').length;
    const ready = orders.filter((o) => (o.status || '').toLowerCase() === 'ready for delivery').length;
    const shipped = orders.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s === 'shipped' || s === 'in transit' || s === 'out for delivery';
    }).length;
    const reported = orders.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s === 'delivery reported' || s === 'reported';
    }).length;
    const failed = orders.filter((o) => {
      const s = (o.status || '').toLowerCase();
      return s === 'delivery failed' || s === 'delivery issue';
    }).length;
    const rescheduled = orders.filter((o) => (o.status || '').toLowerCase() === 'rescheduled').length;
    const delivered = orders.filter(
      (o) => (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed'
    ).length;
    const cancelled = orders.filter((o) => (o.status || '').toLowerCase() === 'cancelled').length;
    const totalRevenue = orders
      .filter(isRecognizedSalesOrder)
      .reduce((sum, o) => sum + recognizedOrderAmount(o), 0);

    return {
      total,
      pendingCod,
      processing,
      ready,
      shipped,
      reported,
      failed,
      rescheduled,
      delivered,
      cancelled,
      totalRevenue,
    };
  }, [orders, pendingCodCount]);

  const dashboardInsights = useMemo(
    () =>
      buildDashboardInsights({
        orders,
        products,
        pendingCodCount,
      }),
    [orders, products, pendingCodCount]
  );


  const navigateFromInsights = (navKey, opts = {}) => {
    if (navKey === 'forecast') {
      if (opts.productId) setForecastFocusProductId(opts.productId);
      setActiveNav('forecast');
      return;
    }
    if (navKey === 'inventory') {
      if (opts.filter === 'outOfStock') setInvStockFilter('outOfStock');
      else if (opts.filter === 'lowStock') setInvStockFilter('lowStock');
      setActiveNav('inventory');
      return;
    }
    if (navKey === 'orders') {
      if (opts.filter) setOrderStatusFilter(opts.filter);
      setActiveNav('orders');
      return;
    }
    setActiveNav(navKey);
  };

  const filteredOrdersList = useMemo(() => {
    return periodOrders.filter((o) => {
      const st = (o.status || 'Pending Approval').toLowerCase();
      let matchStatus = true;
      if (orderStatusFilter === 'Pending Approval') {
        matchStatus = st.includes('pending') || st.includes('approval');
      } else if (orderStatusFilter === 'Shipped' || orderStatusFilter === 'Out for Delivery') {
        matchStatus = st === 'shipped' || st === 'out for delivery' || st === 'in transit';
      } else if (orderStatusFilter === 'Delivery Reported') {
        matchStatus = st === 'delivery reported' || st === 'reported';
      } else if (orderStatusFilter === 'Delivery Failed' || orderStatusFilter === 'Delivery Issue') {
        matchStatus = st === 'delivery failed' || st === 'delivery issue';
      } else if (orderStatusFilter === 'Delivered') {
        matchStatus = st === 'delivered' || st === 'completed';
      } else if (orderStatusFilter !== 'All') {
        matchStatus = st === orderStatusFilter.toLowerCase();
      }

      const pm = (o.payment_method || '').toLowerCase();
      let matchPayment = true;
      if (orderPaymentFilter === 'COD') matchPayment = pm.includes('cash') || pm.includes('cod');
      else if (orderPaymentFilter === 'GCash') matchPayment = pm.includes('gcash');
      else if (orderPaymentFilter === 'Card')
        matchPayment = pm.includes('card') || pm.includes('apple') || pm.includes('credit') || pm.includes('debit');
      else if (orderPaymentFilter === 'PayPal') matchPayment = pm.includes('paypal');

      const q = orderSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (o.order_id && o.order_id.toLowerCase().includes(q)) ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (o.items_summary && o.items_summary.toLowerCase().includes(q));

      return matchStatus && matchPayment && matchSearch;
    });
  }, [periodOrders, orderStatusFilter, orderPaymentFilter, orderSearchQuery]);

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => (Number(p.stock) || 0) <= resolveReorderLevel(p, 5))
      .slice(0, 3);
  }, [products]);

  const overviewHubs = useMemo(() => {
    return [
      {
        id: 'stocks',
        title: 'Stocks & Inventory',
        categoryLabel: 'Warehouse & Catalog',
        subtitle: 'Warehouse SKU levels, reorder alerts, and catalog valuation',
        icon: 'box-seam-fill',
        color: isDarkMode ? tokens.statusInfoText : '#0284C7',
        colorBg: isDarkMode ? tokens.statusInfoBg : '#E0F2FE',
        borderColor: isDarkMode ? tokens.chipBorder : '#BAE6FD',
        badge: invStats.lowStockCount > 0 ? `${invStats.lowStockCount} Reorder Alerts` : 'Stock Healthy',
        badgeType: invStats.lowStockCount > 0 ? 'warning' : 'success',
        metrics: [
          { label: 'Inventory cost', value: `₱${invStats.totalValue.toLocaleString()}` },
          { label: 'Total Units', value: invStats.totalUnits.toLocaleString() },
          { label: 'Low Stock', value: invStats.lowStockCount, color: invStats.lowStockCount > 0 ? '#D97706' : undefined },
          { label: 'Out of Stock', value: invStats.outOfStockCount, color: invStats.outOfStockCount > 0 ? '#DC2626' : undefined },
        ],
        detailsType: 'stocks',
        actions: [
          { label: 'Audit & Restock Inventory', nav: 'inventory', primary: true, icon: 'box-seam-fill' },
          { label: 'Manage Products', nav: 'products', primary: false, icon: 'tag-fill' },
        ],
      },
      {
        id: 'trends',
        title: 'Sales & Demand Trends',
        categoryLabel: 'Velocity & Forecasting',
        subtitle: 'Revenue momentum, channel split, and predictive demand',
        icon: 'graph-up-arrow',
        color: isDarkMode ? tokens.statusSuccessText : '#10B981',
        colorBg: isDarkMode ? tokens.statusSuccessBg : '#ECFDF5',
        borderColor: isDarkMode ? tokens.chipBorder : '#A7F3D0',
        badge: `${orders.length} Total Orders`,
        badgeType: 'neutral',
        metrics: [
          { label: 'Recognized revenue', value: `₱${analyticsData.totalRevenue.toLocaleString()}` },
          { label: 'Avg Order Value', value: `₱${Math.round(analyticsData.aov || 0).toLocaleString()}` },
          { label: 'Delivered', value: orderStats.delivered, color: isDarkMode ? tokens.statusSuccessText : '#10B981' },
          { label: 'Active Orders', value: orderStats.processing + orderStats.shipped + orderStats.ready },
        ],
        detailsType: 'trends',
        actions: [
          { label: 'Sales & Demand Forecast', nav: 'forecast', primary: true, icon: 'graph-up-arrow' },
          { label: 'Revenue Trends & Charts', nav: 'analytics', primary: false, icon: 'pie-chart-fill' },
        ],
      },
      {
        id: 'reports',
        title: 'Financial & Operational Reports',
        categoryLabel: 'Margins & Reconciliation',
        subtitle: 'Profit margins, supplier cost accounting, and order reconciliation',
        icon: 'file-earmark-bar-graph-fill',
        color: isDarkMode ? tokens.statusPurpleText : '#8B5CF6',
        colorBg: isDarkMode ? tokens.statusPurpleBg : '#F5F3FF',
        borderColor: isDarkMode ? tokens.chipBorder : '#DDD6FE',
        badge: `${profitOverview.soldMargin.toFixed(1)}% Realized Margin`,
        badgeType: 'success',
        metrics: [
          { label: 'Realized Profit', value: `₱${profitOverview.soldProfit.toLocaleString()}`, color: isDarkMode ? tokens.statusSuccessText : '#10B981' },
          { label: 'Sold Cost', value: `₱${profitOverview.soldCost.toLocaleString()}` },
          { label: 'Supplier Expense', value: `₱${profitOverview.purchaseExpense.toLocaleString()}` },
          { label: 'Catalog Potential', value: `₱${profitOverview.catalogProfit.toLocaleString()}` },
        ],
        detailsType: 'reports',
        actions: [
          { label: 'Financial Reports & P&L', nav: 'analytics', primary: true, icon: 'file-earmark-bar-graph-fill' },
          { label: 'Orders Ledger & COD', nav: 'orders', primary: false, icon: 'receipt' },
        ],
      },
    ];
  }, [
    invStats,
    orders.length,
    orderStats,
    analyticsData,
    profitOverview,
    lowStockProducts,
    isDarkMode,
  ]);

  const overviewHubTabs = useMemo(() => [
    { id: 'all', label: 'All 3 Hubs', count: 'Stocks · Trends · Reports' },
    { id: 'stocks', label: 'Stocks & Inventory', count: invStats.lowStockCount > 0 ? `${invStats.lowStockCount} Low` : 'Healthy' },
    { id: 'trends', label: 'Sales & Trends', count: `${orders.length} Orders` },
    { id: 'reports', label: 'Financial Reports', count: `${profitOverview.soldMargin.toFixed(1)}% Margin` },
  ], [invStats.lowStockCount, orders.length, profitOverview.soldMargin]);

  const filteredOverviewHubs = useMemo(() => {
    if (overviewModuleCategory === 'all') return overviewHubs;
    return overviewHubs.filter((h) => h.id === overviewModuleCategory);
  }, [overviewHubs, overviewModuleCategory]);

  const getOrderStatusMeta = (status) => {
    const s = String(status || '').toLowerCase().trim();
    const dark = isDarkMode;
    if (s.includes('pending') || s.includes('approval') || s.includes('cod')) {
      return {
        label: 'Pending COD',
        bg: dark ? tokens.statusWarningBg : '#FEF3C7',
        border: dark ? tokens.chipBorder : '#FDE68A',
        color: dark ? tokens.statusWarningText : '#92400E',
        icon: 'clock-fill',
      };
    }
    if (s === 'processing') {
      return {
        label: 'Processing',
        bg: dark ? tokens.statusInfoBg : '#EFF6FF',
        border: dark ? tokens.chipBorder : '#BFDBFE',
        color: dark ? tokens.statusInfoText : '#1D4ED8',
        icon: 'gear-wide-connected',
      };
    }
    if (s.includes('ready')) {
      return {
        label: 'Ready for Delivery',
        bg: dark ? tokens.statusPurpleBg : '#F5F3FF',
        border: dark ? tokens.chipBorder : '#DDD6FE',
        color: dark ? tokens.statusPurpleText : '#6D28D9',
        icon: 'box-seam-fill',
      };
    }
    if (s.includes('out') || s === 'shipped' || s.includes('transit')) {
      return {
        label: 'Out for Delivery',
        bg: dark ? tokens.statusPurpleBg : '#ECFDF5',
        border: dark ? tokens.chipBorder : '#A7F3D0',
        color: dark ? tokens.statusPurpleText : '#047857',
        icon: 'truck',
      };
    }
    if (s === 'delivery reported' || s === 'reported') {
      return {
        label: 'Delivery Reported',
        bg: dark ? tokens.statusPurpleBg : '#EDE9FE',
        border: dark ? tokens.chipBorder : '#DDD6FE',
        color: dark ? tokens.statusPurpleText : '#6D28D9',
        icon: 'clipboard-check',
      };
    }
    if (s.includes('failed') || s === 'delivery issue') {
      return {
        label: 'Delivery Issue',
        bg: dark ? tokens.statusDangerBg : '#FFF1F2',
        border: dark ? tokens.chipBorder : '#FECDD3',
        color: dark ? tokens.statusDangerText : '#BE123C',
        icon: 'exclamation-triangle-fill',
      };
    }
    if (s.includes('resched')) {
      return {
        label: 'Rescheduled',
        bg: dark ? tokens.statusWarningBg : '#FFF7ED',
        border: dark ? tokens.chipBorder : '#FFEDD5',
        color: dark ? tokens.statusWarningText : '#C2410C',
        icon: 'calendar-event-fill',
      };
    }
    if (s === 'delivered' || s === 'completed') {
      return {
        label: 'Delivered',
        bg: dark ? tokens.statusSuccessBg : '#D1FAE5',
        border: dark ? tokens.chipBorder : '#6EE7B7',
        color: dark ? tokens.statusSuccessText : '#065F46',
        icon: 'check-circle-fill',
      };
    }
    if (s.includes('cancel') || s.includes('reject')) {
      return {
        label: 'Cancelled',
        bg: dark ? tokens.statusDangerBg : '#FEE2E2',
        border: dark ? tokens.chipBorder : '#FCA5A5',
        color: dark ? tokens.statusDangerText : '#B91C1C',
        icon: 'x-circle-fill',
      };
    }
    return {
      label: status || 'Pending Approval',
      bg: dark ? tokens.badgeNeutralBg : '#F1F5F9',
      border: dark ? tokens.chipBorder : '#CBD5E1',
      color: dark ? tokens.badgeNeutralText : '#334155',
      icon: 'info-circle-fill',
    };
  };

  const handleApproveCOD = async (orderId) => {
    // Prefer COD-specific approval; fall back to standard status advance for non-COD pending
    const target =
      orders.find((o) => o.order_id === orderId || o.id === orderId) || selectedOrderForModal;
    const method = target?.payment_method || '';
    const isCod =
      String(method).toLowerCase().includes('cash') || String(method).toLowerCase().includes('cod');

    let res;
    if (isCod) {
      res = await orderService.approveCODOrder(orderId);
    } else {
      res = await orderService.updateOrderStatus(orderId, 'Processing', 'Approved by admin', {
        adminCorrection: false,
      });
    }

    if (res.success) {
      await loadData();
      setSelectedOrderForModal((prev) =>
        prev && (prev.order_id === orderId || prev.id === orderId)
          ? { ...prev, ...(res.order || {}), status: 'Processing' }
          : prev
      );
      if (isCod) {
        if (res.emailSent) {
          showToast('COD order approved successfully. Customer email notification sent.');
        } else {
          showToast(
            `COD order approved successfully, but the email notification could not be sent.${res.emailError ? ` (${res.emailError})` : ''
            }`
          );
        }
      } else {
        showToast(`Approved Order #${String(orderId).slice(0, 10)}! Moved to Packing.`);
      }
    } else {
      showToast(res.error || 'Approval failed');
    }
  };

  const handleApproveAllPendingCOD = async () => {
    if (pendingCodOrders.length === 0) return;
    let emailsSent = 0;
    let emailsFailed = 0;
    for (const ord of pendingCodOrders) {
      const res = await orderService.approveCODOrder(ord.order_id || ord.id);
      if (res?.emailSent) emailsSent++;
      else emailsFailed++;
    }
    await loadData();
    if (emailsFailed === 0) {
      showToast(`Approved all ${pendingCodOrders.length} pending COD orders. Customer email notifications sent.`);
    } else {
      showToast(
        `Approved all ${pendingCodOrders.length} pending COD orders. (${emailsSent} emails sent, ${emailsFailed} notifications could not be sent).`
      );
    }
  };

  const handleRetryCodApprovalEmail = async (orderId) => {
    const res = await orderService.retryCodApprovalEmail(orderId);
    if (res.success && res.emailSent) {
      showToast(`Customer email notification sent to ${res.recipient || 'customer'}.`);
      await loadData();
      setSelectedOrderForModal((prev) => {
        if (!prev || (prev.order_id !== orderId && prev.id !== orderId)) return prev;
        return {
          ...prev,
          cod_approval_email_sent: true,
          cod_approval_email_status: 'sent',
          cod_approval_email_at: new Date().toISOString(),
          cod_approval_email_recipient: res.recipient,
          cod_approval_email_error: null,
        };
      });
    } else {
      showToast(res.error || res.emailError || 'Failed to dispatch email.');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, notes = '') => {
    const res = await orderService.updateOrderStatus(orderId, newStatus, notes, {
      adminCorrection: true,
      allowDelivered: true,
    });
    if (res.success) {
      await loadData();
      setSelectedOrderForModal((prev) => {
        if (!prev || (prev.order_id !== orderId && prev.id !== orderId)) return prev;
        const updated = res.order || {};
        return { ...prev, ...updated, status: newStatus };
      });
      showToast(`Order status updated to "${newStatus}"`);
    } else {
      showToast(res.error || 'Status update blocked');
    }
  };

  /** Guided workflow advance — respects ALLOWED_TRANSITIONS (no skipping stages). */
  const handleAdvanceOrderStatus = async (orderId, newStatus) => {
    const res = await orderService.updateOrderStatus(
      orderId,
      newStatus,
      `Workflow: ${newStatus}`,
      {
        adminCorrection: false,
        allowDelivered: false,
      }
    );
    if (res.success) {
      await loadData();
      setSelectedOrderForModal((prev) => {
        if (!prev || (prev.order_id !== orderId && prev.id !== orderId)) return prev;
        const updated = res.order || {};
        return { ...prev, ...updated, status: newStatus };
      });
      await refreshOrderDeliveryPanel(orderId);
      showToast(`Order moved to "${newStatus}"`);
    } else {
      showToast(res.error || 'This status change is not allowed from the current stage.');
    }
  };

  const openOrderModalWithOrder = (order, editMode = false) => {
    setSelectedOrderForModal(order);
    setIsOrderEditMode(editMode);
    setOrderEditForm({
      customer_name: order?.customer_name || '',
      customer_phone: order?.customer_phone || '',
      customer_address: order?.customer_address || '',
      delivery_notes: order?.delivery_notes || '',
      cod_change_for: order?.cod_change_for ? String(order.cod_change_for) : '',
      status: order?.status || 'Pending Approval',
      payment_method: order?.payment_method || 'Cash on Delivery (COD)',
      rider_name: order?.rider_name || '',
      rider_contact: order?.rider_contact || '',
      channel: order?.channel || 'Online Store',
    });
    setIsOrderModalOpen(true);
  };

  const handleSaveOrderEdits = async () => {
    if (!selectedOrderForModal) return;
    const orderId = selectedOrderForModal.order_id || selectedOrderForModal.id;
    if (!orderId) return;

    setIsSavingOrderEdits(true);
    try {
      const updates = {
        customer_name: (orderEditForm.customer_name || '').trim(),
        customer_phone: (orderEditForm.customer_phone || '').trim(),
        customer_address: (orderEditForm.customer_address || '').trim(),
        delivery_notes: (orderEditForm.delivery_notes || '').trim(),
        cod_change_for: orderEditForm.cod_change_for ? Number(orderEditForm.cod_change_for) : null,
        status: orderEditForm.status || selectedOrderForModal.status,
        rider_name: (orderEditForm.rider_name || '').trim(),
        rider_contact: (orderEditForm.rider_contact || '').trim(),
      };

      const res = await orderService.updateOrderDetails(orderId, updates);
      if (res.success) {
        showToast(`Order #${orderId.slice(0, 10)} details saved successfully!`);
        setSelectedOrderForModal((prev) => (prev ? { ...prev, ...updates } : prev));
        await loadData();
      } else {
        showToast(res.error || 'Failed to update order details');
      }
    } catch (e) {
      showToast('Error saving order details');
    } finally {
      setIsSavingOrderEdits(false);
    }
  };

  const refreshOrderDeliveryPanel = async (orderId) => {
    if (!orderId) {
      setOrderDeliveryDetail(null);
      setOrderDeliveryHistory([]);
      return;
    }
    const d = await deliveryService.getDeliveryForOrder(orderId);
    const h = await deliveryService.getDeliveryHistory(orderId);
    setOrderDeliveryDetail(d);
    setOrderDeliveryHistory(h || []);
  };

  useEffect(() => {
    if (isOrderModalOpen && selectedOrderForModal) {
      refreshOrderDeliveryPanel(selectedOrderForModal.order_id || selectedOrderForModal.id);
    }
  }, [isOrderModalOpen, selectedOrderForModal?.order_id, selectedOrderForModal?.id]);

  const handleUploadProof = async () => {
    const oid = selectedOrderForModal?.order_id || selectedOrderForModal?.id;
    if (!oid) return;
    const picked = await pickImageFromFile();
    if (!picked.success) {
      if (picked.error && picked.error !== 'No file selected') showToast(picked.error);
      return;
    }
    const res = await deliveryService.uploadProofOfDelivery(oid, picked.uri, currentUser);
    if (res.success) {
      showToast('Proof of delivery uploaded');
      await refreshOrderDeliveryPanel(oid);
    } else {
      showToast(res.error || 'Upload failed');
    }
  };


  const handleRejectOrder = (orderId) => {
    showConfirm({
      title: 'Reject Customer Order?',
      message: `Are you sure you want to reject Order #${orderId}? The order will be cancelled and reserved items will be returned to inventory.`,
      itemName: `Order #${orderId}`,
      confirmText: 'Yes, Reject Order',
      cancelText: 'Keep Order Active',
      type: 'danger',
      confirmIcon: 'x-circle-fill',
      onConfirm: async () => {
        const res = await orderService.cancelOrder(orderId, 'Rejected by admin', { admin: true });
        if (!res.success) {
          showToast(res.error || 'Reject failed');
          return;
        }
        await loadData();
        setSelectedOrderForModal((prev) =>
          prev && (prev.order_id === orderId || prev.id === orderId)
            ? { ...prev, status: 'Cancelled' }
            : prev
        );
        showToast(`Order #${orderId.slice(0, 10)} has been rejected.`);
      },
    });
  };

  const handleCancelOrder = (orderId) => {
    showConfirm({
      title: 'Cancel Customer Order',
      message: `Are you sure you want to cancel Order #${orderId}? The customer will receive a cancellation notice and reserved stock will be returned to inventory.`,
      itemName: `Order #${orderId}`,
      confirmText: 'Yes, Cancel Order',
      cancelText: 'Keep Order Active',
      type: 'warning',
      confirmIcon: 'x-circle-fill',
      onConfirm: async () => {
        const res = await orderService.cancelOrder(orderId, 'Cancelled by admin', { admin: true });
        if (!res.success) {
          showToast(res.error || 'Cancel failed');
          return;
        }
        await loadData();
        setSelectedOrderForModal((prev) =>
          prev && (prev.order_id === orderId || prev.id === orderId)
            ? { ...prev, status: 'Cancelled' }
            : prev
        );
        showToast(`Order #${orderId.slice(0, 10)} cancelled.`);
      },
    });
  };

  const handleProcessReturn = async (orderId, decision) => {
    const res = await orderService.processReturn(orderId, decision, `Admin ${decision.toLowerCase()} return`);
    if (!res.success) {
      showToast(res.error || 'Return update failed');
      return;
    }
    await loadData();
    setSelectedOrderForModal(res.order || null);
    showToast(decision === 'Approved' ? 'Return approved — order refunded' : 'Return rejected — order remains delivered');
  };

  // Filtered products list for Products Tab
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.compatibility && p.compatibility.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [products, selectedCategory, searchQuery]);

  const navTitles = {
    overview: 'Dashboard',
    orders: 'Orders Fulfillment Management',
    inventory: 'Inventory Telemetry',
    pos: 'Point of Sale (POS) Cashier Terminal',
    analytics: 'Sales Analytics',
    forecast: 'Sales Forecast Optimization',
    products: 'Products & Price Management',
    promos: 'Promo Vouchers & Discounts',
    suppliers: 'Suppliers & Parts Vendors',
    garage: 'Garage & Service Appointments Management',
    riders: 'Riders',
    users: 'Users Management',
    supabase: 'Supabase Database Settings',
    audit: 'Activity Logs',
    notifications: 'Notifications & Alerts Center',
    settings: 'System & Platform Settings',
    profile: 'Profile & Account Settings',
  };

  const navIcons = {
    overview: 'grid-1x2-fill',
    orders: 'receipt',
    inventory: 'box-seam-fill',
    pos: 'cart-check-fill',
    analytics: 'graph-up-arrow',
    forecast: 'clipboard-data',
    products: 'tag-fill',
    promos: 'ticket-perforated-fill',
    suppliers: 'truck',
    garage: 'tools',
    riders: 'bicycle',
    users: 'people-fill',
    supabase: 'database-fill-gear',
    audit: 'journal-text',
    notifications: 'bell-fill',
    settings: 'gear-fill',
    profile: 'person-gear',
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? tokens.bgMain : '#F8FAFC',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
            borderRadius: 24,
            padding: 32,
            maxWidth: 460,
            width: '100%',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDarkMode ? 0.3 : 0.08,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <BootstrapIcon name="shield-slash-fill" size={30} color={isDarkMode ? tokens.statusDangerText : "#DC2626"} />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: isDarkMode ? tokens.textPrimary : '#0F172A',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Access Denied: Admin Privileges Required
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: isDarkMode ? tokens.textMuted : '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            Only authorized Store Administrators with the 'admin' role are permitted to access the MotoTrack
            Administrator Console.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 14,
              width: '100%',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
            }}
            onPress={() => {
              if (adminLogin) {
                adminLogin();
              }
            }}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="shield-check" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
              Switch to Store Administrator (One-Click)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
              borderWidth: 1,
              borderColor: tokens.border,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 14,
              width: '100%',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
            }}
            onPress={() => {
              adminSecurityService.lockSession();
              if (onLogout) {
                onLogout();
              } else {
                onNavigateToStore?.();
              }
            }}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="box-arrow-in-right" size={15} color={isDarkMode ? '#E2E8F0' : '#475569'} />
            <Text style={{ color: isDarkMode ? '#E2E8F0' : '#475569', fontWeight: '600', fontSize: 13.5 }}>
              Sign In with Another Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
              borderWidth: 1,
              borderColor: tokens.border,
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 14,
              width: '100%',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleBackToStorefront}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="arrow-left" size={14} color={isDarkMode ? '#E2E8F0' : '#475569'} />
            <Text style={{ color: isDarkMode ? '#E2E8F0' : '#475569', fontWeight: '600', fontSize: 14 }}>Return to Storefront</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'android' && { paddingTop: 35 }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Centered Admin Security PIN Popup Modal */}
      <AdminPinLockScreen
        visible={!isAdminUnlocked}
        isDarkMode={isDarkMode}
        onUnlockSuccess={() => {
          adminSecurityService.unlockSession(currentUser);
          setIsAdminUnlocked(true);
          setToastMessage('Store Admin Console Unlocked');
          setTimeout(() => setToastMessage(''), 2500);
        }}
        onNavigateToStore={handleBackToStorefront}
        adminUser={currentUser}
      />
      {/* Toast Notification */}
      {toastMessage ? (
        <View
          style={{
            position: 'absolute',
            top: 20,
            alignSelf: 'center',
            backgroundColor: '#24272B',
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 9999,
            zIndex: 9999,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13.5 }}>{toastMessage}</Text>
        </View>
      ) : null}

      <View style={styles.adminLayout}>
        {/* ─── 1A. LEFT SIDEBAR (DESKTOP) ─── */}
        {isDesktop && (
          <AdminSidebar
            isLoading={shouldShowSkeleton}
            isOffline={isOffline}
            isLagging={isLagging}
            activeNav={activeNav}
            setActiveNav={setActiveNav}
            isDarkMode={isDarkMode}
            tokens={tokens}
            styles={styles}
            onNavigateToStore={onNavigateToStore}
            onOpenBrandModal={() => setIsBrandModalOpen(true)}
            onOpenProfileModal={() => setActiveNav('profile')}
            currentUser={currentUser}
            orders={orders}
            pendingCodCount={pendingCodCount}
            invStats={invStats}
            posCart={posCart}
            products={products}
            suppliers={suppliers}
            garageBookings={garageBookings}
            garageMechanics={garageMechanics}
            deliveryRiders={deliveryRiders}
            auditLogs={auditLogs}
            newReportsCount={newReportsCount}
            onBackToStorefront={handleBackToStorefront}
          />
        )}

        {/* ─── 1B. LEFT SIDEBAR (MOBILE DRAWER WITH BACKDROP) ─── */}
        {!isDesktop && (
          <AdminSidebar
            isLoading={shouldShowSkeleton}
            isOffline={isOffline}
            isLagging={isLagging}
            activeNav={activeNav}
            setActiveNav={(nav) => {
              setActiveNav(nav);
              setIsMobileSidebarOpen(false);
            }}
            isDarkMode={isDarkMode}
            tokens={tokens}
            styles={styles}
            onNavigateToStore={onNavigateToStore}
            onOpenBrandModal={() => {
              setIsMobileSidebarOpen(false);
              setIsBrandModalOpen(true);
            }}
            onOpenProfileModal={() => {
              setIsMobileSidebarOpen(false);
              setActiveNav('profile');
            }}
            currentUser={currentUser}
            orders={orders}
            pendingCodCount={pendingCodCount}
            invStats={invStats}
            posCart={posCart}
            products={products}
            suppliers={suppliers}
            garageBookings={garageBookings}
            garageMechanics={garageMechanics}
            deliveryRiders={deliveryRiders}
            auditLogs={auditLogs}
            newReportsCount={newReportsCount}
            onBackToStorefront={handleBackToStorefront}
            isMobile={true}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* ─── 2. RIGHT MAIN CONTENT AREA ─── */}
        <View style={styles.mainContentArea}>
          {/* Top Header Bar */}
          <View
            style={[
              styles.topContentBar,
              !isDesktop && { paddingHorizontal: 16, paddingVertical: 10 },
              {
                position: 'relative',
                zIndex: isProfileDropdownOpen ? 99999 : 50,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!isDesktop && (
                <TouchableOpacity
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  onPress={() => setIsMobileSidebarOpen(true)}
                  activeOpacity={0.7}
                  title="Open Admin Navigation"
                  accessibilityLabel="Open Admin Navigation"
                >
                  <BootstrapIcon
                    name="list"
                    size={18}
                    color={isDarkMode ? (tokens.textPrimary || '#F8FAFC') : '#EA580C'}
                  />
                </TouchableOpacity>
              )}
              {shouldShowSkeleton ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Skeleton width={20} height={20} borderRadius={4} />
                  <Skeleton width={120} height={20} borderRadius={6} />
                </View>
              ) : (
                <>
                  <View
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon
                      name={navIcons[activeNav] || 'speedometer2'}
                      size={18}
                      color={isDarkMode ? tokens.accentBrand : '#EA580C'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.pageBreadcrumbTitle,
                      { color: isDarkMode ? (tokens.textPrimary || '#F8FAFC') : '#24272B' },
                      !isDesktop && { fontSize: 16 },
                    ]}
                  >
                    {navTitles[activeNav] || 'Admin Console'}
                  </Text>
                </>
              )}
            </View>

            <View
              style={[
                styles.topActionsRow,
                {
                  position: 'relative',
                  zIndex: isProfileDropdownOpen ? 99999 : 50,
                },
              ]}
            >
              {shouldShowSkeleton ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Skeleton circle width={38} height={38} />
                  <Skeleton circle width={38} height={38} />
                  <Skeleton circle width={38} height={38} />
                </View>
              ) : (
                <>
                  {/* Dark Mode Toggle Button */}
                  <TouchableOpacity
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                      cursor: 'pointer',
                    }}
                    onPress={toggleDarkMode}
                    activeOpacity={0.7}
                    accessibilityLabel={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    <BootstrapIcon
                      name={isDarkMode ? 'sun-fill' : 'moon-stars-fill'}
                      size={18}
                      color={isDarkMode ? (tokens.statusWarningText || '#F59E0B') : '#475569'}
                    />
                  </TouchableOpacity>





                  {/* ─── NOTIFICATION BELL & DROPDOWN POPOVER ─── */}
                  <View style={{ position: 'relative', zIndex: 1001 }} data-notification-button="true">
                    <TouchableOpacity
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onPress={() => {
                        setIsNotificationDropdownOpen(!isNotificationDropdownOpen);
                        setIsProfileDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Notifications"
                      title="Notifications"
                    >
                      <BootstrapIcon
                        name={unreadNotificationsCount > 0 ? 'bell-fill' : 'bell'}
                        size={18}
                        color={
                          isNotificationDropdownOpen || activeNav === 'notifications'
                            ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                            : (isDarkMode ? '#F8FAFC' : '#475569')
                        }
                      />
                      {unreadNotificationsCount > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            backgroundColor: '#EF4444',
                            borderRadius: 9,
                            minWidth: 17,
                            height: 17,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 3,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? (tokens.topBarBg || '#151C19') : '#FFFFFF',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '600' }}>
                            {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <NotificationDropdown
                      isOpen={isNotificationDropdownOpen}
                      onClose={() => setIsNotificationDropdownOpen(false)}
                      onNavigateToScreen={(screen) => {
                        setIsNotificationDropdownOpen(false);
                        setActiveNav(screen || 'notifications');
                      }}
                      currentUser={currentUser}
                      isAdmin={true}
                      isDark={isDarkMode}
                    />
                  </View>

                  {/* ─── ADMIN PROFILE AVATAR & DROPDOWN ─── */}
                  <View style={{ position: 'relative', zIndex: isProfileDropdownOpen ? 99999 : 1001 }}>
                    <UserProfileButton
                      currentUser={currentUser}
                      onPress={() => {
                        setIsProfileDropdownOpen((prev) => !prev);
                        setIsNotificationDropdownOpen(false);
                      }}
                      size={38}
                    />

                    {/* Floating Profile Popover Dropdown */}
                    {isProfileDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 46,
                          right: 0,
                          width: 280,
                          backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: isDarkMode ? 0.45 : 0.15,
                          shadowRadius: 18,
                          elevation: 99999,
                          zIndex: 99999,
                          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0,0,0,0.2)',
                          overflow: 'hidden',
                        }}
                      >
                        {/* User Info Header */}
                        <View
                          style={{
                            padding: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9',
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {currentUser?.avatar ? (
                              <Image
                                source={{ uri: currentUser.avatar }}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 22,
                                  backgroundColor: '#CBD5E1',
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 22,
                                  backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <BootstrapIcon name="person-fill" size={24} color="#FFFFFF" />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '700',
                                  color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                }}
                                numberOfLines={1}
                              >
                                {currentUser?.name || currentUser?.fullName || 'Store Administrator'}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  color: isDarkMode ? tokens.textMuted : '#64748B',
                                  marginTop: 1,
                                }}
                                numberOfLines={1}
                              >
                                {currentUser?.email || 'admin@mototrack.com'}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 5,
                              marginTop: 10,
                              backgroundColor: isDarkMode ? '#132A26' : '#DCFCE7',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              alignSelf: 'flex-start',
                            }}
                          >
                            <BootstrapIcon
                              name="shield-lock-fill"
                              size={11}
                              color={isDarkMode ? tokens.accentBrand : '#EA580C'}
                            />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: isDarkMode ? tokens.accentBrand : '#065F46',
                              }}
                            >
                              Store Administrator
                            </Text>
                          </View>
                        </View>

                        {/* Action Choices Menu */}
                        <View style={{ padding: 8 }}>
                          {/* 1a. Admin Account — Change Password */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              setIsAdminAccountOpen(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon
                              name="key-fill"
                              size={16}
                              color={isDarkMode ? tokens.accentBrand : '#EA580C'}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.textPrimary : '#1E293B',
                              }}
                            >
                              Change Password
                            </Text>
                          </TouchableOpacity>

                          {/* 1b. Admin Security PIN — Separate Modal */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              setIsAdminPinModalOpen(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon
                              name="shield-lock-fill"
                              size={16}
                              color={isDarkMode ? tokens.accentBrand : '#EA580C'}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.textPrimary : '#1E293B',
                              }}
                            >
                              Change Security PIN
                            </Text>
                          </TouchableOpacity>

                          {/* 1b. Edit Profile */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              setActiveNav('profile');
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon
                              name="person-gear"
                              size={16}
                              color={isDarkMode ? tokens.accentBrand : '#EA580C'}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.textPrimary : '#1E293B',
                              }}
                            >
                              Administrator Profile
                            </Text>
                          </TouchableOpacity>

                          {/* 2. Customer Storefront */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              handleBackToStorefront();
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon name="shop" size={16} color={isDarkMode ? tokens.statusInfoText : "#2563EB"} />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.textPrimary : '#1E293B',
                              }}
                            >
                              View Customer Store
                            </Text>
                          </TouchableOpacity>

                          {/* 3. System Settings */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              setActiveNav('settings');
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon
                              name="gear-fill"
                              size={16}
                              color={isDarkMode ? tokens.accentBrand : '#EA580C'}
                            />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.textPrimary : '#1E293B',
                              }}
                            >
                              System Settings
                            </Text>
                          </TouchableOpacity>

                          {/* 4. Lock Console with PIN */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              setIsAdminUnlocked(false);
                              adminSecurityService.lockSession();
                              showToast('🔒 Admin console locked.');
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon name="lock-fill" size={16} color={isDarkMode ? tokens.statusWarningText : "#D97706"} />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.textPrimary : '#1E293B',
                              }}
                            >
                              Lock Admin Console
                            </Text>
                          </TouchableOpacity>

                          <View
                            style={{
                              height: 1,
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9',
                              marginVertical: 4,
                            }}
                          />

                          {/* 4. Log Out */}
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                            }}
                            onPress={() => {
                              setIsProfileDropdownOpen(false);
                              handleLogoutAdmin();
                            }}
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon name="box-arrow-right" size={16} color={isDarkMode ? tokens.statusDangerText : "#DC2626"} />
                            <Text
                              style={{
                                fontSize: 12.5,
                                fontWeight: '700',
                                color: isDarkMode ? tokens.statusDangerText : '#DC2626',
                              }}
                            >
                              Sign Out
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Click-outside Backdrop for Profile Dropdown */}
                  {isProfileDropdownOpen && (
                    <TouchableOpacity
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 99998,
                        backgroundColor: 'transparent',
                        cursor: 'default',
                      }}
                      onPress={() => {
                        setIsProfileDropdownOpen(false);
                      }}
                      activeOpacity={1}
                    />
                  )}
                </>
              )}


            </View>
          </View>

          <ScrollView
            style={{ position: 'relative', zIndex: 1 }}
            contentContainerStyle={[
              styles.mainScroll,
              !isDesktop && { paddingBottom: 110, paddingHorizontal: 12 },
            ]}
          >


            {/* ─── INITIAL LOAD ERROR STATE WITH RETRY ─── */}
            {!hasLoadedOnce && dashboardError && (
              <View
                style={{
                  padding: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? '#1E1919' : '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5',
                  marginVertical: 24,
                  gap: 12,
                  maxWidth: 520,
                  alignSelf: 'center',
                  width: '100%',
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="exclamation-triangle-fill" size={24} color="#EF4444" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A', textAlign: 'center' }}>
                  Unable to Load Dashboard Data
                </Text>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B', textAlign: 'center', lineHeight: 18 }}>
                  {dashboardError}
                </Text>
                <TouchableOpacity
                  onPress={() => loadData({ forceRefresh: true })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: 9,
                    marginTop: 4,
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="arrow-clockwise" size={15} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Retry Connection</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── TAB 1: OVERVIEW ─── */}
            {activeNav === 'overview' && (
              <ModernOverviewDashboard
                isLoading={shouldShowSkeleton}
                orders={orders}
                products={products}
                garageBookings={garageBookings}
                suppliers={suppliers}
                analyticsData={analyticsData}
                orderStats={orderStats}
                invStats={invStats}
                profitOverview={profitOverview}
                bookingStats={bookingStats}
                dashboardInsights={dashboardInsights}
                setActiveNav={setActiveNav}
                openOrderModal={(order) => openOrderModalWithOrder(order, false)}
                setOrderStatusFilter={setOrderStatusFilter}
                setInvStockFilter={setInvStockFilter}
                setBookingStatusFilter={setBookingStatusFilter}
                isDarkMode={isDarkMode}
                isDesktop={isDesktop}
                tokens={tokens}
              />
            )}

            {/* ─── TAB: ORDERS & COD FULFILLMENT MANAGEMENT ─── */}
            {activeNav === 'orders' && (
              <View>
                {/* Orders KPI Grid */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Orders"
                    value={periodOrderStats.total}
                    sub={
                      isOrderDateFiltered
                        ? `₱${periodOrderStats.totalRevenue.toLocaleString()} (${orderDateFilterLabel})`
                        : `₱${periodOrderStats.totalRevenue.toLocaleString()} volume`
                    }
                    badge={isOrderDateFiltered ? orderDateFilterLabel : undefined}
                    badgeType={isOrderDateFiltered ? 'info' : undefined}
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={periodOrderStats.pendingCod > 0 ? 'amber' : 'blue'}
                    label="Pending COD Approvals"
                    value={periodOrderStats.pendingCod}
                    valueColor={
                      periodOrderStats.pendingCod > 0
                        ? isDarkMode
                          ? tokens.statusWarningText
                          : '#D97706'
                        : isDarkMode
                          ? tokens.accentBrand
                          : '#EA580C'
                    }
                    sub="Requires Admin action"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Packing & Processing"
                    value={periodOrderStats.processing}
                    sub="Ready for courier pickup"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Out for Delivery"
                    value={periodOrderStats.shipped}
                    sub="On the road with courier"
                    isDark={isDarkMode}
                  />
                </View>

                {/* COD Pending Banner if any */}
                {pendingCodCount > 0 && (
                  <View style={styles.codAlertBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FDE68A',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <BootstrapIcon
                          name="cash-coin"
                          size={20}
                          color={isDarkMode ? tokens.statusWarningText : '#92400E'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.codAlertBannerText}>
                          {pendingCodCount} Cash on Delivery order(s) awaiting approval
                        </Text>
                        <Text style={styles.codAlertBannerSub}>
                          Review destination addresses and click "Approve COD" to authorize dispatch.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.approveAllCodBtn}
                      onPress={handleApproveAllPendingCOD}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                      <Text style={styles.approveAllCodBtnText}>Approve All ({pendingCodCount})</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Filter and Search Toolbar */}
                <View
                  style={[
                    styles.toolbarRow,
                    {
                      position: 'relative',
                      zIndex: (isPaymentDropdownOpen || isOrderStatusDropdownOpen || isOrderDateDropdownOpen) ? 99999 : 10,
                      elevation: (isPaymentDropdownOpen || isOrderStatusDropdownOpen || isOrderDateDropdownOpen) ? 99999 : 1,
                    },
                  ]}
                >
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon
                      name="search"
                      size={14}
                      color={isDarkMode ? tokens.textMuted : '#64748B'}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by Order ID, Customer, Phone, or Items..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                      value={orderSearchQuery}
                      onChangeText={setOrderSearchQuery}
                    />
                    {orderSearchQuery ? (
                      <TouchableOpacity onPress={() => setOrderSearchQuery('')}>
                        <BootstrapIcon
                          name="x-circle"
                          size={14}
                          color={isDarkMode ? tokens.textMuted : '#94A3B8'}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Order Status Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isOrderStatusDropdownOpen ? 99999 : 10,
                    }}
                  >
                    {(() => {
                      const orderStatusOptions = [
                        { key: 'All', label: 'All Orders', count: periodOrderStats.total, icon: 'list-check', color: isDarkMode ? tokens.accentBrand : '#EA580C' },
                        {
                          key: 'Pending Approval',
                          label: 'Pending COD',
                          count: periodOrderStats.pendingCod,
                          icon: 'clock-history',
                          color: isDarkMode ? tokens.statusWarningText : '#D97706',
                          highlight: periodOrderStats.pendingCod > 0,
                        },
                        { key: 'Processing', label: 'Processing', count: periodOrderStats.processing, icon: 'gear-wide-connected', color: isDarkMode ? tokens.statusInfoText : '#0284C7' },
                        { key: 'Ready for Delivery', label: 'Ready', count: periodOrderStats.ready, icon: 'box-seam', color: '#0EA5E9' },
                        { key: 'Out for Delivery', label: 'Out for Delivery', count: periodOrderStats.shipped, icon: 'truck', color: '#6366F1' },
                        { key: 'Delivery Reported', label: 'Reported', count: periodOrderStats.reported, icon: 'clipboard-check', color: isDarkMode ? tokens.accentBrand : '#EA580C' },
                        { key: 'Delivery Issue', label: 'Issue', count: periodOrderStats.failed, icon: 'exclamation-triangle', color: isDarkMode ? tokens.statusDangerText : '#DC2626' },
                        { key: 'Rescheduled', label: 'Rescheduled', count: periodOrderStats.rescheduled, icon: 'arrow-repeat', color: isDarkMode ? tokens.statusWarningText : '#D97706' },
                        { key: 'Delivered', label: 'Delivered', count: periodOrderStats.delivered, icon: 'check-circle-fill', color: isDarkMode ? tokens.statusSuccessText : '#16A34A' },
                        { key: 'Cancelled', label: 'Cancelled', count: periodOrderStats.cancelled, icon: 'x-circle-fill', color: isDarkMode ? tokens.statusDangerText : '#DC2626' },
                      ];
                      const activeOpt = orderStatusOptions.find((o) => o.key === orderStatusFilter) || orderStatusOptions[0];

                      return (
                        <>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isOrderStatusDropdownOpen
                                ? isDarkMode
                                  ? tokens.accentBorder
                                  : '#EA580C'
                                : activeOpt.highlight
                                  ? isDarkMode
                                    ? 'rgba(180, 160, 120, 0.45)'
                                    : '#F59E0B'
                                  : orderStatusFilter !== 'All'
                                    ? isDarkMode
                                      ? tokens.accentBorder
                                      : '#EA580C'
                                    : isDarkMode
                                      ? tokens.borderInput
                                      : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 170,
                              cursor: 'pointer',
                              boxShadow: isOrderStatusDropdownOpen
                                ? isDarkMode
                                  ? '0 6px 16px -2px rgba(0, 0, 0, 0.35)'
                                  : '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                                : '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                            onPress={() => {
                              setIsOrderStatusDropdownOpen((prev) => !prev);
                              setIsPaymentDropdownOpen(false);
                              setIsOrderDateDropdownOpen(false);
                            }}
                            activeOpacity={0.85}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <BootstrapIcon
                                name={activeOpt.icon}
                                size={13}
                                color={
                                  activeOpt.highlight
                                    ? isDarkMode
                                      ? tokens.statusWarningText
                                      : '#D97706'
                                    : orderStatusFilter !== 'All'
                                      ? isDarkMode && activeOpt.color === '#EA580C'
                                        ? tokens.accentBrand
                                        : activeOpt.color
                                      : isDarkMode
                                        ? tokens.textMuted
                                        : '#64748B'
                                }
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color:
                                    activeOpt.highlight
                                      ? isDarkMode
                                        ? tokens.statusWarningText
                                        : '#B45309'
                                      : orderStatusFilter !== 'All'
                                        ? isDarkMode
                                          ? tokens.accentBrand
                                          : '#EA580C'
                                        : isDarkMode
                                          ? tokens.textPrimary
                                          : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor:
                                    activeOpt.highlight
                                      ? isDarkMode
                                        ? 'rgba(251, 191, 36, 0.2)'
                                        : '#FEF3C7'
                                      : orderStatusFilter !== 'All'
                                        ? isDarkMode
                                          ? 'rgba(16, 185, 129, 0.22)'
                                          : '#EA580C'
                                        : isDarkMode
                                          ? tokens.bgSub
                                          : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  marginLeft: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color:
                                      activeOpt.highlight
                                        ? isDarkMode
                                          ? tokens.statusWarningText
                                          : '#B45309'
                                        : orderStatusFilter !== 'All'
                                          ? isDarkMode
                                            ? tokens.accentBrand
                                            : '#FFFFFF'
                                          : isDarkMode
                                            ? tokens.textMuted
                                            : '#475569',
                                  }}
                                >
                                  {activeOpt.count}
                                </Text>
                              </View>
                            </View>
                            <BootstrapIcon
                              name={isOrderStatusDropdownOpen ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={
                                isOrderStatusDropdownOpen
                                  ? isDarkMode
                                    ? tokens.accentBrand
                                    : '#EA580C'
                                  : isDarkMode
                                    ? tokens.textMuted
                                    : '#64748B'
                              }
                            />
                          </TouchableOpacity>

                          {/* Transparent backdrop for outside click */}
                          {isOrderStatusDropdownOpen && (
                            <TouchableOpacity
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 99998,
                                backgroundColor: 'transparent',
                                cursor: 'default',
                              }}
                              onPress={() => setIsOrderStatusDropdownOpen(false)}
                              activeOpacity={1}
                            />
                          )}

                          {/* Floating Dropdown Menu */}
                          {isOrderStatusDropdownOpen && (
                            <View
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 6,
                                minWidth: 230,
                                backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                                zIndex: 99999,
                                padding: 6,
                                gap: 3,
                                maxHeight: 320,
                                overflowY: 'auto',
                              }}
                            >
                              {orderStatusOptions.map((option) => {
                                const isSelected = orderStatusFilter === option.key;
                                return (
                                  <TouchableOpacity
                                    key={option.key}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingHorizontal: 12,
                                      paddingVertical: 9,
                                      borderRadius: 9,
                                      backgroundColor: isSelected
                                        ? isDarkMode ? '#132A26' : '#E8F0EC'
                                        : 'transparent',
                                      cursor: 'pointer',
                                    }}
                                    onPress={() => {
                                      setOrderStatusFilter(option.key);
                                      setIsOrderStatusDropdownOpen(false);
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <BootstrapIcon
                                        name={option.icon}
                                        size={14}
                                        color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : option.color || (isDarkMode ? tokens.textMuted : '#64748B')}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '600' : '500',
                                          color: isSelected
                                            ? isDarkMode
                                              ? tokens.accentBrand
                                              : '#EA580C'
                                            : isDarkMode
                                              ? tokens.textSecondary
                                              : '#334155',
                                        }}
                                      >
                                        {option.label}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View
                                        style={{
                                          backgroundColor: option.highlight
                                            ? isDarkMode
                                              ? 'rgba(251, 191, 36, 0.2)'
                                              : '#FEF3C7'
                                            : isSelected
                                              ? isDarkMode
                                                ? 'rgba(16, 185, 129, 0.22)'
                                                : '#EA580C'
                                              : isDarkMode
                                                ? tokens.bgSub
                                                : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '600',
                                            color: option.highlight
                                              ? isDarkMode
                                                ? tokens.statusWarningText
                                                : '#B45309'
                                              : isSelected
                                                ? isDarkMode
                                                  ? tokens.accentBrand
                                                  : '#FFFFFF'
                                                : isDarkMode
                                                  ? tokens.textMuted
                                                  : '#475569',
                                          }}
                                        >
                                          {option.count}
                                        </Text>
                                      </View>
                                      {isSelected && <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  {/* Payment Method Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isPaymentDropdownOpen ? 99999 : 10,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isPaymentDropdownOpen
                          ? isDarkMode
                            ? tokens.accentBorder
                            : '#EA580C'
                          : orderPaymentFilter !== 'All'
                            ? isDarkMode
                              ? tokens.accentBorder
                              : '#EA580C'
                            : isDarkMode
                              ? tokens.borderInput
                              : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 155,
                        cursor: 'pointer',
                        boxShadow: isPaymentDropdownOpen
                          ? isDarkMode
                            ? '0 6px 20px -2px rgba(16, 185, 129, 0.18)'
                            : '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => {
                        setIsPaymentDropdownOpen((prev) => !prev);
                        setIsOrderStatusDropdownOpen(false);
                        setIsOrderDateDropdownOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <BootstrapIcon
                          name={
                            orderPaymentFilter === 'COD'
                              ? 'cash'
                              : orderPaymentFilter === 'GCash'
                                ? 'phone-fill'
                                : orderPaymentFilter === 'Card'
                                  ? 'credit-card-fill'
                                  : orderPaymentFilter === 'PayPal'
                                    ? 'wallet2'
                                    : 'credit-card'
                          }
                          size={13}
                          color={
                            orderPaymentFilter !== 'All'
                              ? isDarkMode
                                ? tokens.accentBrand
                                : '#EA580C'
                              : isDarkMode
                                ? tokens.textMuted
                                : '#64748B'
                          }
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color:
                              orderPaymentFilter !== 'All'
                                ? isDarkMode
                                  ? tokens.accentBrand
                                  : '#EA580C'
                                : isDarkMode
                                  ? tokens.textPrimary
                                  : '#0F172A',
                          }}
                        >
                          {orderPaymentFilter === 'All'
                            ? 'All Payments'
                            : orderPaymentFilter === 'COD'
                              ? 'COD Only'
                              : orderPaymentFilter === 'GCash'
                                ? 'GCash'
                                : orderPaymentFilter === 'PayPal'
                                  ? 'PayPal'
                                  : 'Card'}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isPaymentDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={
                          isPaymentDropdownOpen
                            ? isDarkMode
                              ? tokens.accentBrand
                              : '#EA580C'
                            : isDarkMode
                              ? tokens.textMuted
                              : '#64748B'
                        }
                      />
                    </TouchableOpacity>

                    {/* Transparent backdrop for outside click */}
                    {isPaymentDropdownOpen && (
                      <TouchableOpacity
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99998,
                          backgroundColor: 'transparent',
                          cursor: 'default',
                        }}
                        onPress={() => setIsPaymentDropdownOpen(false)}
                        activeOpacity={1}
                      />
                    )}

                    {/* Floating Dropdown Menu */}
                    {isPaymentDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 6,
                          minWidth: 210,
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 6,
                          gap: 3,
                          maxHeight: 280,
                          overflowY: 'auto',
                        }}
                      >
                        {[
                          { key: 'All', label: 'All Payments', icon: 'credit-card' },
                          { key: 'COD', label: 'COD Only', icon: 'cash-coin' },
                          { key: 'GCash', label: 'GCash Express', icon: 'phone' },
                        ].map((option) => {
                          const isSelected = orderPaymentFilter === option.key;
                          return (
                            <TouchableOpacity
                              key={option.key}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                borderRadius: 9,
                                backgroundColor: isSelected
                                  ? isDarkMode ? '#132A26' : '#E8F0EC'
                                  : 'transparent',
                                cursor: 'pointer',
                              }}
                              onPress={() => {
                                setOrderPaymentFilter(option.key);
                                setIsPaymentDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <BootstrapIcon
                                  name={option.icon}
                                  size={14}
                                  color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '600' : '500',
                                    color: isSelected
                                      ? isDarkMode
                                        ? tokens.accentBrand
                                        : '#EA580C'
                                      : isDarkMode
                                        ? tokens.textSecondary
                                        : '#334155',
                                  }}
                                >
                                  {option.label}
                                </Text>
                              </View>
                              {isSelected && <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Order Month & Year Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isOrderDateDropdownOpen ? 99999 : 10,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isOrderDateDropdownOpen
                          ? isDarkMode
                            ? tokens.accentBorder
                            : '#EA580C'
                          : isOrderDateFiltered
                            ? isDarkMode
                              ? tokens.accentBorder
                              : '#EA580C'
                            : isDarkMode
                              ? tokens.borderInput
                              : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 165,
                        cursor: 'pointer',
                        boxShadow: isOrderDateDropdownOpen
                          ? isDarkMode
                            ? '0 6px 20px -2px rgba(16, 185, 129, 0.18)'
                            : '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => {
                        setIsOrderDateDropdownOpen((prev) => !prev);
                        setIsOrderStatusDropdownOpen(false);
                        setIsPaymentDropdownOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <BootstrapIcon
                          name={isOrderDateFiltered ? 'calendar-check-fill' : 'calendar3'}
                          size={13}
                          color={
                            isOrderDateFiltered
                              ? isDarkMode
                                ? tokens.accentBrand
                                : '#EA580C'
                              : isDarkMode
                                ? tokens.textMuted
                                : '#64748B'
                          }
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color:
                              isOrderDateFiltered
                                ? isDarkMode
                                  ? tokens.accentBrand
                                  : '#EA580C'
                                : isDarkMode
                                  ? tokens.textPrimary
                                  : '#0F172A',
                          }}
                        >
                          {orderDateFilterLabel}
                        </Text>
                        {isOrderDateFiltered && (
                          <View
                            style={{
                              backgroundColor: isDarkMode
                                ? 'rgba(16, 185, 129, 0.22)'
                                : '#EA580C',
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 8,
                              marginLeft: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: isDarkMode ? tokens.accentBrand : '#FFFFFF',
                              }}
                            >
                              {periodOrders.length}
                            </Text>
                          </View>
                        )}
                      </View>
                      <BootstrapIcon
                        name={isOrderDateDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={
                          isOrderDateDropdownOpen
                            ? isDarkMode
                              ? tokens.accentBrand
                              : '#EA580C'
                            : isDarkMode
                              ? tokens.textMuted
                              : '#64748B'
                        }
                      />
                    </TouchableOpacity>

                    {/* Transparent backdrop for outside click */}
                    {isOrderDateDropdownOpen && (
                      <TouchableOpacity
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99998,
                          backgroundColor: 'transparent',
                          cursor: 'default',
                        }}
                        onPress={() => setIsOrderDateDropdownOpen(false)}
                        activeOpacity={1}
                      />
                    )}

                    {/* Floating Dropdown Menu */}
                    {isOrderDateDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 6,
                          width: 320,
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 14,
                          gap: 12,
                        }}
                      >
                        {/* Header with Reset */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <BootstrapIcon name="calendar-event" size={13} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Filter by Month & Year
                            </Text>
                          </View>
                          {isOrderDateFiltered && (
                            <TouchableOpacity
                              onPress={() => {
                                setOrderYearFilter('All');
                                setOrderMonthFilter('All');
                                setIsOrderDateDropdownOpen(false);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                Reset All
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Quick Presets */}
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              paddingVertical: 6,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              backgroundColor: (orderYearFilter === 'All' && orderMonthFilter === 'All')
                                ? (isDarkMode ? '#132A26' : '#E8F0EC')
                                : (isDarkMode ? tokens.bgSub : '#F1F5F9'),
                              borderWidth: 1,
                              borderColor: (orderYearFilter === 'All' && orderMonthFilter === 'All')
                                ? (isDarkMode ? tokens.accentBorder : '#EA580C')
                                : 'transparent',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                            onPress={() => {
                              setOrderYearFilter('All');
                              setOrderMonthFilter('All');
                              setIsOrderDateDropdownOpen(false);
                            }}
                          >
                            <Text style={{
                              fontSize: 11,
                              fontWeight: (orderYearFilter === 'All' && orderMonthFilter === 'All') ? '600' : '500',
                              color: (orderYearFilter === 'All' && orderMonthFilter === 'All')
                                ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                : (isDarkMode ? tokens.textMuted : '#64748B'),
                            }}>
                              All Time
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flex: 1,
                              paddingVertical: 6,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              backgroundColor: (orderYearFilter === new Date().getFullYear() && orderMonthFilter === new Date().getMonth())
                                ? (isDarkMode ? '#132A26' : '#E8F0EC')
                                : (isDarkMode ? tokens.bgSub : '#F1F5F9'),
                              borderWidth: 1,
                              borderColor: (orderYearFilter === new Date().getFullYear() && orderMonthFilter === new Date().getMonth())
                                ? (isDarkMode ? tokens.accentBorder : '#EA580C')
                                : 'transparent',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                            onPress={() => {
                              const now = new Date();
                              setOrderYearFilter(now.getFullYear());
                              setOrderMonthFilter(now.getMonth());
                              setIsOrderDateDropdownOpen(false);
                            }}
                          >
                            <Text style={{
                              fontSize: 11,
                              fontWeight: (orderYearFilter === new Date().getFullYear() && orderMonthFilter === new Date().getMonth()) ? '600' : '500',
                              color: (orderYearFilter === new Date().getFullYear() && orderMonthFilter === new Date().getMonth())
                                ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                : (isDarkMode ? tokens.textMuted : '#64748B'),
                            }}>
                              This Month
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flex: 1,
                              paddingVertical: 6,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              backgroundColor: (() => {
                                const now = new Date();
                                const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                return (orderYearFilter === lm.getFullYear() && orderMonthFilter === lm.getMonth());
                              })()
                                ? (isDarkMode ? '#132A26' : '#E8F0EC')
                                : (isDarkMode ? tokens.bgSub : '#F1F5F9'),
                              borderWidth: 1,
                              borderColor: (() => {
                                const now = new Date();
                                const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                return (orderYearFilter === lm.getFullYear() && orderMonthFilter === lm.getMonth());
                              })()
                                ? (isDarkMode ? tokens.accentBorder : '#EA580C')
                                : 'transparent',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                            onPress={() => {
                              const now = new Date();
                              const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                              setOrderYearFilter(lm.getFullYear());
                              setOrderMonthFilter(lm.getMonth());
                              setIsOrderDateDropdownOpen(false);
                            }}
                          >
                            <Text style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: isDarkMode ? tokens.textMuted : '#64748B',
                            }}>
                              Last Month
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Year Selector */}
                        <View style={{ gap: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>
                            YEAR
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            <TouchableOpacity
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 7,
                                backgroundColor: orderYearFilter === 'All'
                                  ? (isDarkMode ? '#132A26' : '#E8F0EC')
                                  : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                                borderWidth: 1,
                                borderColor: orderYearFilter === 'All'
                                  ? (isDarkMode ? tokens.accentBorder : '#EA580C')
                                  : (isDarkMode ? tokens.borderInput : '#E2E8F0'),
                                cursor: 'pointer',
                              }}
                              onPress={() => setOrderYearFilter('All')}
                            >
                              <Text style={{
                                fontSize: 11.5,
                                fontWeight: orderYearFilter === 'All' ? '600' : '500',
                                color: orderYearFilter === 'All'
                                  ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                  : (isDarkMode ? tokens.textSecondary : '#475569'),
                              }}>
                                All Years
                              </Text>
                            </TouchableOpacity>

                            {orderAvailableYears.map((yr) => {
                              const isYrSelected = orderYearFilter === yr;
                              const yrCount = ordersCountByMonthYear[`${yr}-all`] || 0;
                              return (
                                <TouchableOpacity
                                  key={yr}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 7,
                                    backgroundColor: isYrSelected
                                      ? (isDarkMode ? '#132A26' : '#E8F0EC')
                                      : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                                    borderWidth: 1,
                                    borderColor: isYrSelected
                                      ? (isDarkMode ? tokens.accentBorder : '#EA580C')
                                      : (isDarkMode ? tokens.borderInput : '#E2E8F0'),
                                    cursor: 'pointer',
                                  }}
                                  onPress={() => setOrderYearFilter(yr)}
                                >
                                  <Text style={{
                                    fontSize: 11.5,
                                    fontWeight: isYrSelected ? '600' : '500',
                                    color: isYrSelected
                                      ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                      : (isDarkMode ? tokens.textSecondary : '#475569'),
                                  }}>
                                    {yr}
                                  </Text>
                                  {yrCount > 0 && (
                                    <Text style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: isYrSelected
                                        ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                        : (isDarkMode ? tokens.textMuted : '#94A3B8'),
                                    }}>
                                      ({yrCount})
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>

                        {/* Month Selector Grid */}
                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>
                              MONTH {orderYearFilter !== 'All' ? `(${orderYearFilter})` : ''}
                            </Text>
                            {orderMonthFilter !== 'All' && (
                              <TouchableOpacity onPress={() => setOrderMonthFilter('All')} style={{ cursor: 'pointer' }}>
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                  All Months
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {[
                              'Jan', 'Feb', 'Mar', 'Apr',
                              'May', 'Jun', 'Jul', 'Aug',
                              'Sep', 'Oct', 'Nov', 'Dec'
                            ].map((mName, mIdx) => {
                              const isMSelected = orderMonthFilter === mIdx;
                              const yrKey = orderYearFilter !== 'All' ? orderYearFilter : (orderAvailableYears[0] || new Date().getFullYear());
                              const count = ordersCountByMonthYear[`${yrKey}-${mIdx}`] || 0;

                              return (
                                <TouchableOpacity
                                  key={mName}
                                  style={{
                                    width: '23%',
                                    paddingVertical: 7,
                                    borderRadius: 8,
                                    backgroundColor: isMSelected
                                      ? (isDarkMode ? '#132A26' : '#E8F0EC')
                                      : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                                    borderWidth: 1.5,
                                    borderColor: isMSelected
                                      ? (isDarkMode ? tokens.accentBorder : '#EA580C')
                                      : (isDarkMode ? tokens.borderInput : '#E2E8F0'),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                  onPress={() => {
                                    setOrderMonthFilter(mIdx);
                                    if (orderYearFilter === 'All') {
                                      setOrderYearFilter(orderAvailableYears[0] || new Date().getFullYear());
                                    }
                                    setIsOrderDateDropdownOpen(false);
                                  }}
                                >
                                  <Text style={{
                                    fontSize: 12,
                                    fontWeight: isMSelected ? '600' : '500',
                                    color: isMSelected
                                      ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                      : (isDarkMode ? tokens.textPrimary : '#1E293B'),
                                  }}>
                                    {mName}
                                  </Text>
                                  {count > 0 && (
                                    <Text style={{
                                      fontSize: 9.5,
                                      fontWeight: '600',
                                      color: isMSelected
                                        ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                        : (isDarkMode ? tokens.statusSuccessText : '#16A34A'),
                                      marginTop: 1,
                                    }}>
                                      {count} {count === 1 ? 'ord' : 'ords'}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Export Buttons */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: isDarkMode ? '#EA580C' : '#107C41',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        boxShadow: isDarkMode
                          ? 'none'
                          : '0 2px 6px rgba(16, 124, 65, 0.25)',
                        cursor: 'pointer',
                      }}
                      onPress={() => {
                        const res = excelService.exportOrdersToExcel(filteredOrdersList, {
                          fileName: `mototrack_orders_${isOrderDateFiltered ? `${orderDateFilterLabel.replace(/\s+/g, '_')}_` : ''}${orderStatusFilter !== 'All' ? orderStatusFilter + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`,
                        });
                        if (res.success) {
                          showToast(`✓ Exported ${filteredOrdersList.length} orders to Excel (.xlsx)`);
                        } else {
                          showAlert('Export Failed', res.error || 'Failed to generate Excel file.');
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="file-earmark-excel-fill" size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
                        Export Excel ({filteredOrdersList.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 12,
                        cursor: 'pointer',
                      }}
                      onPress={() => {
                        orderService.exportOrdersToCSV(filteredOrdersList);
                        showToast('Orders exported to CSV');
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="download" size={13} color={isDarkMode ? tokens.textMuted : '#475569'} />
                      <Text style={{ color: isDarkMode ? tokens.textMuted : '#475569', fontWeight: '700', fontSize: 12.5 }}>
                        CSV
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Active Date Filter Banner */}
                {isOrderDateFiltered && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.25)' : '#F0FDF4',
                      borderColor: isDarkMode ? tokens.accentBorder : '#86EFAC',
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon
                        name="calendar-check-fill"
                        size={15}
                        color={isDarkMode ? tokens.accentBrand : '#15803D'}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.accentBrand : '#15803D',
                        }}
                      >
                        Showing orders for {orderDateFilterLabel} ({filteredOrdersList.length} of {periodOrders.length} orders)
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: isDarkMode ? tokens.borderInput : '#DCFCE7',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                      onPress={() => {
                        setOrderYearFilter('All');
                        setOrderMonthFilter('All');
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name="x-lg"
                        size={11}
                        color={isDarkMode ? tokens.textMuted : '#374151'}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#374151',
                        }}
                      >
                        Reset to All Dates
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Orders List Table */}
                <View style={styles.tableCard}>
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      backgroundColor: '#24272B',
                      borderBottomWidth: 1,
                      borderBottomColor: isDarkMode ? '#374151' : '#32373D',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#FFFFFF',
                          letterSpacing: -0.2,
                        }}
                      >
                        Orders Ledger ({filteredOrdersList.length} shown)
                      </Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                        Transactions across online store and cashier POS, newest first
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          borderWidth: 1,
                          borderColor: 'rgba(239, 68, 68, 0.25)',
                          cursor: 'pointer',
                        }}
                        onPress={() => {
                          orderService.clearLocalOrders();
                          loadData();
                          showToast('Local offline orders cache cleared!');
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon
                          name="trash3"
                          size={12}
                          color="#F87171"
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: '#F87171',
                          }}
                        >
                          Clear Local Cache
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: 'rgba(234, 88, 12, 0.14)',
                          borderWidth: 1,
                          borderColor: 'rgba(234, 88, 12, 0.3)',
                          cursor: 'pointer',
                        }}
                        onPress={loadData}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon
                          name="arrow-repeat"
                          size={12}
                          color="#EA580C"
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: '#EA580C',
                          }}
                        >
                          Refresh
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    dataSet={{ tableScroll: 'true' }}
                    style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={{ width: '100%', minWidth: 960, flexGrow: 1 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.7, minWidth: 150 }]}>Customer & Order</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.1, minWidth: 170 }]}>Items & Qty</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 110, textAlign: 'center' }]}>Channel</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 120 }]}>Payment & Total</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 120, textAlign: 'center' }]}>
                          Status
                        </Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 120, textAlign: 'center' }]}>
                          Actions
                        </Text>
                      </View>

                      {filteredOrdersList.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                          <BootstrapIcon
                            name="receipt"
                            size={32}
                            color={isDarkMode ? tokens.textMuted : '#94A3B8'}
                          />
                          <Text
                            style={{
                              marginTop: 10,
                              fontSize: 14,
                              fontWeight: '700',
                              color: isDarkMode ? tokens.textMuted : '#64748B',
                            }}
                          >
                            No orders found matching the filter criteria.
                          </Text>
                        </View>
                      ) : (
                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          dataSet={{ tableScroll: 'true' }}
                          style={{
                            maxHeight: 560,
                            width: '100%',
                            ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                          }}
                          contentContainerStyle={{ flexGrow: 1 }}
                        >
                          {filteredOrdersList.map((o, idx) => {
                            const displayOrderId = o.order_id || o.id || `ORD-ON-2026-${String(idx + 1).padStart(5, '0')}`;
                            const st = (o.status || 'Pending Approval').toLowerCase();
                            const isPending = st.includes('pending') || st.includes('approval');
                            const isProcessing = st === 'processing';
                            const isReady = st === 'ready for delivery';
                            const isShipped = st === 'shipped' || st === 'in transit' || st === 'out for delivery';
                            const isReported = st === 'delivery reported' || st === 'reported';
                            const isFailed = st === 'delivery failed' || st === 'delivery issue';
                            const isRescheduled = st === 'rescheduled';
                            const isDelivered = st === 'delivered' || st === 'completed';
                            const isCancelled = st === 'cancelled';
                            const isCOD =
                              (o.payment_method || '').toLowerCase().includes('cash') ||
                              (o.payment_method || '').includes('COD');
                            const statusLabel = isPending
                              ? 'Pending'
                              : isProcessing
                                ? 'Processing'
                                : isReady
                                  ? 'Ready'
                                  : isReported
                                    ? 'Delivery Reported'
                                    : isShipped
                                      ? 'Out for Delivery'
                                      : isFailed
                                        ? 'Delivery Issue'
                                        : isRescheduled
                                          ? 'Rescheduled'
                                          : isDelivered
                                            ? 'Delivered'
                                            : 'Cancelled';

                            let statusBg = isDarkMode ? tokens.badgeNeutralBg : '#F1F5F9';
                            let statusFg = isDarkMode ? tokens.badgeNeutralText : '#334155';
                            let statusSolid = false;
                            if (isPending) {
                              statusBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
                              statusFg = isDarkMode ? '#FBBF24' : '#B45309';
                            } else if (isProcessing || isReady) {
                              statusBg = isDarkMode ? 'rgba(56, 189, 248, 0.16)' : '#DBEAFE';
                              statusFg = isDarkMode ? '#7DD3FC' : '#1E3A5F';
                            } else if (isShipped || isRescheduled || isReported) {
                              statusBg = isDarkMode ? 'rgba(167, 139, 250, 0.16)' : '#EDE9FE';
                              statusFg = isDarkMode ? '#C4B5FD' : '#6D28D9';
                            } else if (isDelivered) {
                              statusBg = '#EA580C';
                              statusFg = '#FFFFFF';
                              statusSolid = true;
                            } else if (isFailed || isCancelled) {
                              statusBg = isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2';
                              statusFg = isDarkMode ? '#FCA5A5' : '#B91C1C';
                            }

                            const itemsSummary =
                              o.items_summary ||
                              (o.items && o.items.length > 0
                                ? o.items.map((it) => `${it.quantity || 1}x ${it.name}`).join(', ')
                                : 'Motorcycle Parts');
                            const itemCount = o.items_count || (o.items ? o.items.length : 1);
                            const orderTotal = Number(o.grand_total) || Number(o.total_amount) || 0;

                            return (
                              <View
                                key={displayOrderId || idx}
                                dataSet={{ adminTableRow: 'true' }}
                                style={[
                                  styles.tableRow,
                                  isPending && {
                                    backgroundColor: isDarkMode
                                      ? tokens.tableRowHighlight
                                      : '#FFFBEB',
                                  },
                                ]}
                              >
                                {/* Customer & Order */}
                                <View style={{ flex: 1.7, minWidth: 150, paddingRight: 8 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {o.customer_name || 'Walk-in Customer'}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.tableSub,
                                      {
                                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                        fontSize: 11.5,
                                      },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {displayOrderId}
                                  </Text>
                                </View>

                                {/* Items & Qty */}
                                <View style={{ flex: 2.1, minWidth: 170, paddingRight: 8 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {itemsSummary}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    {itemCount} item{itemCount === 1 ? '' : 's'}
                                  </Text>
                                </View>

                                {/* Channel */}
                                <View
                                  style={{
                                    flex: 1.1,
                                    minWidth: 110,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingRight: 8,
                                  }}
                                >
                                  {(() => {
                                    const isPos = o.channel === 'POS (In-Store)' || (o.payment_method || '').toLowerCase().includes('pos');
                                    return (
                                      <View
                                        style={{
                                          paddingHorizontal: 10,
                                          paddingVertical: 3.5,
                                          borderRadius: 6,
                                          borderWidth: 1,
                                          backgroundColor: isPos
                                            ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                                            : (isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF'),
                                          borderColor: isPos
                                            ? (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0')
                                            : (isDarkMode ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE'),
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: '700',
                                            color: isPos
                                              ? (isDarkMode ? tokens.accentBrand : '#059669')
                                              : (isDarkMode ? tokens.statusInfoText : '#2563EB'),
                                          }}
                                        >
                                          {isPos ? 'POS In-Store' : 'Online Store'}
                                        </Text>
                                      </View>
                                    );
                                  })()}
                                </View>

                                {/* Payment & Total */}
                                <View style={{ flex: 1.3, minWidth: 120, paddingRight: 8 }}>
                                  <Text
                                    style={[
                                      styles.tableTitle,
                                      { color: isDarkMode ? tokens.money : '#EA580C' },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    ₱{orderTotal.toLocaleString()}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    {isCOD ? 'COD' : o.payment_method || 'Online'}
                                    {o.cod_change_for
                                      ? ` · Change ₱${Number(o.cod_change_for).toLocaleString()}`
                                      : ''}
                                  </Text>
                                </View>

                                {/* Status */}
                                <View
                                  style={{
                                    flex: 1.5,
                                    minWidth: 140,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <View
                                    style={[
                                      styles.tableStatusPill,
                                      {
                                        backgroundColor: statusBg,
                                        borderRadius: statusSolid ? 6 : 999,
                                        paddingHorizontal: statusSolid ? 14 : 12,
                                        paddingVertical: statusSolid ? 6 : 5,
                                        ...(statusSolid
                                          ? {
                                            shadowColor: '#1B5E20',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.28,
                                            shadowRadius: 2,
                                            elevation: 2,
                                          }
                                          : null),
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.tableStatusPillText,
                                        {
                                          color: statusFg,
                                          fontSize: statusSolid ? 12 : 11,
                                        },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {statusLabel}
                                    </Text>
                                  </View>
                                  <Text style={styles.tableStatusSub} numberOfLines={1}>
                                    {isCOD ? 'Cash on delivery' : 'Online payment'}
                                  </Text>
                                </View>

                                {/* Actions */}
                                <View
                                  style={{
                                    flex: 1.2,
                                    minWidth: 120,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <TouchableOpacity
                                    style={styles.tableOutlineBtn}
                                    onPress={() => openOrderModalWithOrder(o, false)}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.tableOutlineBtnText}>
                                      {isDelivered ? 'Details' : 'Manage'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* ─── TAB 2: INVENTORY & STOCK MANAGEMENT ─── */}
            {activeNav === 'inventory' && (
              <View>
                {/* Inventory KPI Summary Cards */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Inventory Value"
                    value={`₱${invStats.totalValue.toLocaleString()}`}
                    sub={`At unit cost · ${invStats.totalUnits} units`}
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="In Stock SKUs"
                    value={invStats.inStockCount}
                    valueColor={isDarkMode ? tokens.accentBrand : "#EA580C"}
                    sub="Above reorder level"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Low Stock Alert"
                    value={invStats.lowStockCount}
                    valueColor={invStats.lowStockCount > 0 ? '#D97706' : undefined}
                    sub="At or below reorder level"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Out of Stock"
                    value={invStats.outOfStockCount}
                    valueColor={invStats.outOfStockCount > 0 ? '#DC2626' : '#EA580C'}
                    sub="0 units available"
                    isDark={isDarkMode}
                  />
                </View>

                {/* Low Stock Warning Banner */}
                {invStats.lowStockCount > 0 && (
                  <View style={styles.inventoryAlertBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <BootstrapIcon name="exclamation-triangle-fill" size={18} color={isDarkMode ? tokens.statusWarningText : "#D97706"} />
                      <Text style={styles.inventoryAlertText}>
                        Attention: {invStats.lowStockCount} product(s) have fallen below their reorder level.
                        Please restock to avoid order delays.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#D97706',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                      onPress={() => setInvStockFilter('lowStock')}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '600' }}>
                        Filter Low Stock
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Inventory Filter Bar */}
                <View
                  style={[
                    styles.toolbarRow,
                    {
                      position: 'relative',
                      zIndex: isInvCategoryDropdownOpen ? 99999 : 10,
                      elevation: isInvCategoryDropdownOpen ? 99999 : 1,
                    },
                  ]}
                >
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search inventory by Part Name, Brand, or SKU..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      value={invSearchQuery}
                      onChangeText={setInvSearchQuery}
                    />
                    {invSearchQuery ? (
                      <TouchableOpacity onPress={() => setInvSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Category Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isInvCategoryDropdownOpen ? 99999 : 10,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isInvCategoryDropdownOpen
                          ? '#EA580C'
                          : invCategoryFilter !== 'All'
                            ? '#EA580C'
                            : isDarkMode ? tokens.borderInput : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 160,
                        cursor: 'pointer',
                        boxShadow: isInvCategoryDropdownOpen
                          ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => {
                        setIsInvCategoryDropdownOpen((prev) => !prev);
                        setIsInvStockDropdownOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <BootstrapIcon
                          name={getCategoryIcon(invCategoryFilter)}
                          size={13}
                          color={invCategoryFilter !== 'All' ? '#EA580C' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: invCategoryFilter !== 'All' ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                        >
                          {invCategoryFilter === 'All' ? 'All Categories' : invCategoryFilter}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isInvCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={isInvCategoryDropdownOpen ? '#EA580C' : '#64748B'}
                      />
                    </TouchableOpacity>

                    {/* Transparent backdrop for outside click */}
                    {isInvCategoryDropdownOpen && (
                      <TouchableOpacity
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99998,
                          backgroundColor: 'transparent',
                          cursor: 'default',
                        }}
                        onPress={() => setIsInvCategoryDropdownOpen(false)}
                        activeOpacity={1}
                      />
                    )}

                    {/* Floating Dropdown Menu */}
                    {isInvCategoryDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 6,
                          minWidth: 220,
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 6,
                          gap: 3,
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        {availableCategoryNames.map((cat) => {
                          const isSelected = invCategoryFilter === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                borderRadius: 9,
                                backgroundColor: isSelected
                                  ? isDarkMode ? '#132A26' : '#E8F0EC'
                                  : 'transparent',
                                cursor: 'pointer',
                              }}
                              onPress={() => {
                                setInvCategoryFilter(cat);
                                setIsInvCategoryDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <BootstrapIcon
                                  name={getCategoryIcon(cat)}
                                  size={14}
                                  color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '600' : '500',
                                    color: isSelected
                                      ? isDarkMode
                                        ? tokens.accentBrand
                                        : '#EA580C'
                                      : isDarkMode
                                        ? tokens.textSecondary
                                        : '#334155',
                                  }}
                                >
                                  {cat === 'All' ? 'All Categories' : cat}
                                </Text>
                              </View>
                              {isSelected && (
                                <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Stock Status Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isInvStockDropdownOpen ? 99999 : 9,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isInvStockDropdownOpen
                          ? '#EA580C'
                          : invStockFilter !== 'All'
                            ? '#EA580C'
                            : isDarkMode ? tokens.borderInput : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 145,
                        cursor: 'pointer',
                        boxShadow: isInvStockDropdownOpen
                          ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => {
                        setIsInvStockDropdownOpen((prev) => !prev);
                        setIsInvCategoryDropdownOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <BootstrapIcon
                          name={
                            (STOCK_FILTER_OPTIONS.find((opt) => opt.key === invStockFilter) || STOCK_FILTER_OPTIONS[0]).icon
                          }
                          size={13}
                          color={invStockFilter !== 'All' ? '#EA580C' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: invStockFilter !== 'All' ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                        >
                          {(STOCK_FILTER_OPTIONS.find((opt) => opt.key === invStockFilter) || STOCK_FILTER_OPTIONS[0]).label}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isInvStockDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={isInvStockDropdownOpen ? '#EA580C' : '#64748B'}
                      />
                    </TouchableOpacity>

                    {/* Transparent backdrop for outside click */}
                    {isInvStockDropdownOpen && (
                      <TouchableOpacity
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99998,
                          backgroundColor: 'transparent',
                          cursor: 'default',
                        }}
                        onPress={() => setIsInvStockDropdownOpen(false)}
                        activeOpacity={1}
                      />
                    )}

                    {/* Floating Dropdown Menu */}
                    {isInvStockDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 6,
                          minWidth: 180,
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 6,
                          gap: 3,
                        }}
                      >
                        {STOCK_FILTER_OPTIONS.map((f) => {
                          const isSelected = invStockFilter === f.key;
                          return (
                            <TouchableOpacity
                              key={f.key}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                borderRadius: 9,
                                backgroundColor: isSelected
                                  ? isDarkMode ? '#132A26' : '#E8F0EC'
                                  : 'transparent',
                                cursor: 'pointer',
                              }}
                              onPress={() => {
                                setInvStockFilter(f.key);
                                setIsInvStockDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <BootstrapIcon
                                  name={f.icon}
                                  size={13}
                                  color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '600' : '500',
                                    color: isSelected
                                      ? isDarkMode
                                        ? tokens.accentBrand
                                        : '#EA580C'
                                      : isDarkMode
                                        ? tokens.textSecondary
                                        : '#334155',
                                  }}
                                >
                                  {f.label}
                                </Text>
                              </View>
                              {isSelected && (
                                <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {/* Export Inventory to Excel Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        backgroundColor: isDarkMode ? '#EA580C' : '#107C41',
                        paddingHorizontal: 15,
                        paddingVertical: 10,
                        borderRadius: 12,
                      }}
                      onPress={() => {
                        const res = excelService.exportInventoryToExcel(filteredInventory, {
                          fileName: `mototrack_inventory_${invStockFilter !== 'All' ? invStockFilter + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`,
                        });
                        if (res.success) {
                          showToast(`✓ Exported ${filteredInventory.length} inventory items to Excel (.xlsx)`);
                        } else {
                          showAlert('Export Failed', res.error || 'Failed to generate Excel file.');
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="file-earmark-excel-fill" size={15} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
                        Export Excel ({filteredInventory.length})
                      </Text>
                    </TouchableOpacity>

                    {/* Add Category Button */}
                    <TouchableOpacity
                      style={[
                        styles.addBtnPrimary,
                        {
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                        },
                      ]}
                      onPress={() => setIsAddCategoryModalOpen(true)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="folder-plus" size={14} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
                      <Text style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A', fontWeight: '700', fontSize: 13 }}>
                        {isDesktop ? 'Add Category' : '+ Category'}
                      </Text>
                    </TouchableOpacity>

                    {/* Add New Product Button */}
                    <TouchableOpacity
                      style={styles.addBtnPrimary}
                      onPress={() => setIsAddProductOpen(true)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add New Product' : '+ Product'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Inventory Table */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  dataSet={{ tableScroll: 'true' }}
                  style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                  contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                >
                  <View style={[styles.tableCard, { width: '100%', minWidth: 980, flexGrow: 1 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.5, minWidth: 200 }]}>Product & SKU</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 120 }]}>Category & Price</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 120 }]}>Stock & Value</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 110 }]}>Status</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 110, textAlign: 'center' }]}>Actions</Text>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled={true}
                      dataSet={{ tableScroll: 'true' }}
                      style={{
                        maxHeight: 560,
                        width: '100%',
                        ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                      }}
                      contentContainerStyle={{ flexGrow: 1 }}
                    >
                      {filteredInventory.map((p) => {
                        const threshold = resolveReorderLevel(p, 5);
                        const stock = Number(p.stock || 0);
                        const price = Number(p.price || 0);
                        const isOut = stock <= 0;
                        const isLow = !isOut && stock <= threshold;
                        const stockVal = price * stock;

                        return (
                          <View
                            key={p.id}
                            style={[
                              styles.tableRow,
                              isOut && styles.tableRowDanger,
                              isLow && { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.08)' : '#FEFCE8' },
                            ]}
                          >
                            {/* PRODUCT & SKU */}
                            <View style={{ flex: 2.5, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 }}>
                              <Image source={{ uri: p.image }} style={styles.productThumb} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.tableTitle} numberOfLines={1}>
                                  {p.name}
                                </Text>
                                <Text style={styles.tableSub} numberOfLines={1}>
                                  {p.brand || 'Brand'} · SKU-{p.sku || p.id}
                                </Text>
                              </View>
                            </View>

                            {/* CATEGORY & PRICE */}
                            <View style={{ flex: 1.5, minWidth: 120, paddingRight: 8 }}>
                              <Text style={styles.tableTitle} numberOfLines={1}>
                                {p.category || 'General'}
                              </Text>
                              <Text style={styles.tableSub} numberOfLines={1}>
                                ₱{price.toLocaleString()} / unit
                              </Text>
                            </View>

                            {/* STOCK & VALUE */}
                            <View style={{ flex: 1.5, minWidth: 120, paddingRight: 8 }}>
                              <Text
                                style={[
                                  styles.tableTitle,
                                  {
                                    fontWeight: '600',
                                    fontSize: 14,
                                    color: isOut ? '#DC2626' : isLow ? '#D97706' : (isDarkMode ? tokens.textPrimary : '#1E293B'),
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {stock} units
                              </Text>
                              <Text style={styles.tableSub} numberOfLines={1}>
                                Value ₱{stockVal.toLocaleString()}
                              </Text>
                            </View>

                            {/* STATUS */}
                            <View style={{ flex: 1.3, minWidth: 110, justifyContent: 'center', gap: 4 }}>
                              {isOut ? (
                                <View
                                  style={[
                                    styles.tableStatusPill,
                                    {
                                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
                                      alignSelf: 'flex-start',
                                    },
                                  ]}
                                >
                                  <Text style={[styles.tableStatusPillText, { color: '#DC2626' }]} numberOfLines={1}>
                                    Out of Stock
                                  </Text>
                                </View>
                              ) : isLow ? (
                                <View
                                  style={[
                                    styles.tableStatusPill,
                                    {
                                      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                                      alignSelf: 'flex-start',
                                    },
                                  ]}
                                >
                                  <Text style={[styles.tableStatusPillText, { color: '#D97706', fontWeight: '600' }]} numberOfLines={1}>
                                    Low Stock
                                  </Text>
                                </View>
                              ) : (
                                <View
                                  style={[
                                    styles.tableStatusPill,
                                    {
                                      backgroundColor: '#15803D',
                                      alignSelf: 'flex-start',
                                    },
                                  ]}
                                >
                                  <Text style={[styles.tableStatusPillText, { color: '#FFFFFF', fontWeight: '600' }]} numberOfLines={1}>
                                    In Stock
                                  </Text>
                                </View>
                              )}
                              <Text style={[styles.tableStatusSub, { textAlign: 'left' }]} numberOfLines={1}>
                                {isOut ? 'Out of stock' : isLow ? 'Reorder soon' : 'Healthy stock'}
                              </Text>
                            </View>

                            {/* ACTIONS */}
                            <View style={{ flex: 1.3, minWidth: 110, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <TouchableOpacity
                                style={styles.tableOutlineBtn}
                                onPress={() => openSupplierPurchase(p)}
                                activeOpacity={0.8}
                                title="Restock units from supplier"
                              >
                                <Text style={styles.tableOutlineBtnText}>Restock</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.actionIconBtn,
                                  {
                                    borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                    padding: 6,
                                    borderRadius: 8,
                                  },
                                ]}
                                onPress={() => setEditingProduct({ ...p, unit_cost: Number(p.unit_cost ?? p.unitCost ?? 0), unitCost: Number(p.unit_cost ?? p.unitCost ?? 0) })}
                                activeOpacity={0.8}
                                title="Edit product"
                              >
                                <BootstrapIcon name="pencil" size={13} color={isDarkMode ? tokens.textSecondary : '#64748B'} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </ScrollView>
              </View>
            )}



            {/* ─── TAB 3: POINT OF SALE (POS) CASHIER TERMINAL ─── */}
            {activeNav === 'pos' && (
              <View style={[styles.posContainer, isDesktop && { height: 'calc(100vh - 120px)', overflow: 'hidden' }]}>
                {/* LEFT PANE: PRODUCT CATALOG GRID */}
                <View style={[styles.posCatalogColumn, isDesktop && { height: '100%', display: 'flex', flexDirection: 'column' }]}>
                  <View
                    style={[
                      styles.toolbarRow,
                      {
                        position: 'relative',
                        zIndex: isPosCategoryDropdownOpen ? 99999 : 10,
                        elevation: isPosCategoryDropdownOpen ? 99999 : 1,
                        marginBottom: 14,
                      },
                    ]}
                  >
                    <View style={styles.searchInputBox}>
                      <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search parts catalog / Scan barcode..."
                        placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                        value={posSearchQuery}
                        onChangeText={setPosSearchQuery}
                      />
                    </View>

                    {/* POS Category Filter Dropdown */}
                    <View
                      style={{
                        position: 'relative',
                        zIndex: isPosCategoryDropdownOpen ? 99999 : 10,
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isPosCategoryDropdownOpen
                            ? '#EA580C'
                            : posCategoryFilter !== 'All'
                              ? '#EA580C'
                              : isDarkMode ? tokens.borderInput : '#E2E8F0',
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          minWidth: 160,
                          cursor: 'pointer',
                          boxShadow: isPosCategoryDropdownOpen
                            ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                            : '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                        onPress={() => setIsPosCategoryDropdownOpen((prev) => !prev)}
                        activeOpacity={0.85}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon
                            name={getCategoryIcon(posCategoryFilter)}
                            size={13}
                            color={posCategoryFilter !== 'All' ? '#EA580C' : '#64748B'}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: posCategoryFilter !== 'All' ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#0F172A',
                            }}
                          >
                            {posCategoryFilter === 'All' ? 'All Categories' : posCategoryFilter}
                          </Text>
                        </View>
                        <BootstrapIcon
                          name={isPosCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={isPosCategoryDropdownOpen ? '#EA580C' : '#64748B'}
                        />
                      </TouchableOpacity>

                      {/* Transparent backdrop for outside click */}
                      {isPosCategoryDropdownOpen && (
                        <TouchableOpacity
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 99998,
                            backgroundColor: 'transparent',
                            cursor: 'default',
                          }}
                          onPress={() => setIsPosCategoryDropdownOpen(false)}
                          activeOpacity={1}
                        />
                      )}

                      {/* Floating Dropdown Menu */}
                      {isPosCategoryDropdownOpen && (
                        <View
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: 6,
                            minWidth: 220,
                            backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                            boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                            zIndex: 99999,
                            padding: 6,
                            gap: 3,
                            maxHeight: 320,
                            overflowY: 'auto',
                          }}
                        >
                          {availableCategoryNames.map((cat) => {
                            const isSelected = posCategoryFilter === cat;
                            return (
                              <TouchableOpacity
                                key={cat}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingHorizontal: 12,
                                  paddingVertical: 9,
                                  borderRadius: 9,
                                  backgroundColor: isSelected
                                    ? isDarkMode ? '#132A26' : '#E8F0EC'
                                    : 'transparent',
                                  cursor: 'pointer',
                                }}
                                onPress={() => {
                                  setPosCategoryFilter(cat);
                                  setIsPosCategoryDropdownOpen(false);
                                }}
                                activeOpacity={0.8}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <BootstrapIcon
                                    name={getCategoryIcon(cat)}
                                    size={14}
                                    color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '600' : '500',
                                      color: isSelected
                                        ? isDarkMode
                                          ? tokens.accentBrand
                                          : '#EA580C'
                                        : isDarkMode
                                          ? tokens.textSecondary
                                          : '#334155',
                                    }}
                                  >
                                    {cat === 'All' ? 'All Categories' : cat}
                                  </Text>
                                </View>
                                {isSelected && (
                                  <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Product Cards Grid */}
                  <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <View style={[styles.posGrid, { marginTop: 0 }]}>
                      {filteredPOSProducts.map((p) => {
                        const isOutOfStock = !p.stock || p.stock <= 0;
                        return (
                          <View
                            key={p.id}
                            style={[styles.posProductCard, isOutOfStock && styles.posProductCardDisabled]}
                          >
                            <View style={styles.posProductImgContainer}>
                              <Image
                                source={{ uri: p.image }}
                                style={styles.posProductImg}
                                resizeMode="cover"
                              />
                            </View>
                            <View style={styles.posProductBody}>
                              <Text style={styles.posProductBrand}>{p.brand}</Text>
                              <Text style={styles.posProductName} numberOfLines={2}>
                                {p.name}
                              </Text>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <Text style={styles.posProductPrice}>₱{p.price?.toLocaleString()}</Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: isOutOfStock ? '#EF4444' : '#10B981',
                                  }}
                                >
                                  {isOutOfStock ? '0 Left' : `${p.stock} In Stock`}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.posAddBtn, isOutOfStock && { opacity: 0.5 }]}
                                onPress={() => handlePOSAddToCart(p)}
                                disabled={isOutOfStock}
                              >
                                <BootstrapIcon name="plus-lg" size={12} color="#FFFFFF" />
                                <Text style={styles.posAddBtnText}>Add to Cart</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* RIGHT PANE: POS REGISTER CART & CHECKOUT */}
                <View style={[styles.posRegisterColumn, isDesktop && { height: '100%', display: 'flex', flexDirection: 'column' }]}>
                  <View style={[styles.posRegisterCard, isDesktop && { height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }]}>
                    <View style={styles.posRegisterHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <BootstrapIcon name="cart3" size={18} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                        <Text style={styles.posRegisterTitle}>POS Cashier Register</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {posCart.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setPosCart([])}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              backgroundColor: isDarkMode ? tokens.borderInput : '#FEE2E2',
                            }}
                          >
                            <BootstrapIcon name="trash" size={11} color={isDarkMode ? tokens.statusDangerText : "#EF4444"} />
                            <Text style={{ color: isDarkMode ? tokens.statusDangerText : '#EF4444', fontSize: 11, fontWeight: '700' }}>Clear</Text>
                          </TouchableOpacity>
                        )}
                        <View
                          style={{
                            backgroundColor: '#E8F0EC',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: isDarkMode ? tokens.accentBrand : '#EA580C', fontSize: 11, fontWeight: '600' }}>
                            {posCart.reduce((acc, item) => acc + item.quantity, 0)} Item(s)
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Customer Selector */}
                    <View style={styles.posCustomerSelector}>
                      <Text style={styles.posCustomerLabel}>Customer / Account</Text>
                      <TouchableOpacity
                        style={styles.posCustomerPickerRow}
                        onPress={() => setPosCustomerDropdownOpen(!posCustomerDropdownOpen)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="person-circle" size={16} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                            {posSelectedCustomer.name}
                          </Text>
                        </View>
                        <BootstrapIcon
                          name={posCustomerDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={isDarkMode ? tokens.textMuted : "#64748B"}
                        />
                      </TouchableOpacity>

                      {/* Dropdown Customer Options */}
                      {posCustomerDropdownOpen && (
                        <View
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                            maxHeight: 150,
                          }}
                        >
                          <ScrollView>
                            <TouchableOpacity
                              style={{ paddingVertical: 6 }}
                              onPress={() => {
                                setPosSelectedCustomer({
                                  id: 'walkin',
                                  name: 'Walk-in Customer',
                                  phone: 'N/A',
                                });
                                setPosCustomerDropdownOpen(false);
                              }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                Walk-in Customer
                              </Text>
                            </TouchableOpacity>
                            {usersList.map((u) => (
                              <TouchableOpacity
                                key={u.id}
                                style={{ paddingVertical: 6 }}
                                onPress={() => {
                                  setPosSelectedCustomer({
                                    id: u.id,
                                    name: u.name,
                                    phone: u.phone || u.email,
                                  });
                                  setPosCustomerDropdownOpen(false);
                                }}
                              >
                                <Text style={{ fontSize: 12.5, color: isDarkMode ? '#CBD5E1' : '#334155', fontWeight: '600' }}>
                                  {u.name} ({u.email})
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Cart Items List */}
                    {posCart.length === 0 ? (
                      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                        <View style={{ marginBottom: 8 }}>
                          <BootstrapIcon name="cart3" size={32} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                          Cart is currently empty
                        </Text>
                        <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#94A3B8', marginTop: 2 }}>
                          Click any product part on the left to begin sale
                        </Text>
                      </View>
                    ) : (
                      <ScrollView
                        style={[
                          styles.posCartItemsList,
                          { flexShrink: 0, minHeight: 140, maxHeight: 260 },
                          Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {},
                        ]}
                        contentContainerStyle={{ paddingRight: 4 }}
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                      >
                        {posCart.map((item) => (
                          <View key={item.id} style={styles.posCartItemRow}>
                            {/* Product Thumbnail */}
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                                overflow: 'hidden',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 10,
                                flexShrink: 0,
                              }}
                            >
                              {item.image ? (
                                <Image
                                  source={{ uri: item.image }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="contain"
                                />
                              ) : (
                                <BootstrapIcon name="box-seam" size={16} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                              )}
                            </View>

                            <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                              <Text style={styles.posCartItemName} numberOfLines={1}>
                                {item.name}
                              </Text>
                              <Text style={styles.posCartItemPrice}>
                                ₱{item.price?.toLocaleString()} each
                                {item.size ? ` · Size ${item.size}` : ''}
                              </Text>
                            </View>

                            <View style={styles.posQtyBox}>
                              <TouchableOpacity
                                style={styles.posQtyBtn}
                                onPress={() => handlePOSUpdateQty(item.id, -1)}
                              >
                                <Text style={{ fontWeight: '600', color: isDarkMode ? '#CBD5E1' : '#475569', fontSize: 13 }}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.posQtyText}>{item.quantity}</Text>
                              <TouchableOpacity
                                style={styles.posQtyBtn}
                                onPress={() => handlePOSUpdateQty(item.id, 1)}
                              >
                                <Text style={{ fontWeight: '600', color: isDarkMode ? '#CBD5E1' : '#475569', fontSize: 13 }}>+</Text>
                              </TouchableOpacity>
                            </View>

                            <View style={{ minWidth: 62, alignItems: 'flex-end', marginLeft: 8 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                ₱{(item.price * item.quantity).toLocaleString()}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={{ padding: 6, marginLeft: 4 }}
                              onPress={() => handlePOSUpdateQty(item.id, -item.quantity)}
                            >
                              <BootstrapIcon name="trash3" size={13} color={isDarkMode ? tokens.statusDangerText : "#EF4444"} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    {/* Promo Code Input */}
                    <View style={{ flexDirection: 'row', gap: 6, marginVertical: 10 }}>
                      <TextInput
                        style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                        placeholder="Promo Voucher (e.g. RACE20)"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                        value={posDiscountCode}
                        onChangeText={setPosDiscountCode}
                        autoCapitalize="characters"
                      />
                      <TouchableOpacity
                        style={{
                          backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                          borderWidth: 1,
                          borderColor: isDarkMode ? tokens.chipBorder : '#FDE68A',
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          justifyContent: 'center',
                        }}
                        onPress={handlePOSApplyDiscount}
                      >
                        <Text style={{ color: isDarkMode ? tokens.accentBrand : '#EA580C', fontWeight: '600', fontSize: 12.5 }}>Apply</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Summary Totals */}
                    <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }}>
                      <View style={styles.posSummaryRow}>
                        <Text style={styles.posSummaryLabel}>Subtotal</Text>
                        <Text style={styles.posSummaryVal}>₱{posSubtotal.toLocaleString()}</Text>
                      </View>
                      {posDiscountAmount > 0 && (
                        <View style={styles.posSummaryRow}>
                          <Text style={[styles.posSummaryLabel, { color: isDarkMode ? tokens.statusSuccessText : '#059669' }]}>
                            Discount ({posDiscountPercent}% OFF)
                          </Text>
                          <Text style={[styles.posSummaryVal, { color: isDarkMode ? tokens.statusSuccessText : '#059669' }]}>
                            -₱{posDiscountAmount.toLocaleString()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.posGrandTotalRow}>
                        <Text style={styles.posGrandTotalLabel}>Total Amount Due</Text>
                        <Text style={styles.posGrandTotalVal}>₱{posGrandTotal.toLocaleString()}</Text>
                      </View>
                    </View>

                    {/* Payment Method Selector */}
                    <Text style={[styles.posCustomerLabel, { marginTop: 14 }]}>Payment Method</Text>
                    <View style={styles.posPayMethodRow}>
                      {['Cash', 'GCash'].map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.posPayMethodBtn,
                            posPaymentMethod === method && styles.posPayMethodBtnActive,
                          ]}
                          onPress={() => setPosPaymentMethod(method)}
                        >
                          <Text
                            style={[
                              styles.posPayMethodText,
                              posPaymentMethod === method && styles.posPayMethodTextActive,
                            ]}
                          >
                            {method}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Cash Tender Calculator */}
                    {posPaymentMethod === 'Cash' && (
                      <View style={styles.posTenderBox}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textMuted : '#475569',
                            textTransform: 'uppercase',
                          }}
                        >
                          Cash Tendered (₱)
                        </Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            { fontSize: 16, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C', marginTop: 4 },
                          ]}
                          keyboardType="numeric"
                          placeholder="Enter amount given by customer..."
                          placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                          value={posTendered}
                          onChangeText={setPosTendered}
                        />
                        {/* Quick Cash Chips */}
                        <View style={styles.posQuickCashRow}>
                          <TouchableOpacity
                            style={styles.posQuickCashChip}
                            onPress={() => setPosTendered(String(posGrandTotal))}
                          >
                            <Text style={styles.posQuickCashChipText}>
                              Exact (₱{posGrandTotal.toLocaleString()})
                            </Text>
                          </TouchableOpacity>
                          {[1000, 2000, 5000, 10000, 50000].map((amt) => (
                            <TouchableOpacity
                              key={amt}
                              style={styles.posQuickCashChip}
                              onPress={() => setPosTendered(String(amt))}
                            >
                              <Text style={styles.posQuickCashChipText}>₱{amt.toLocaleString()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Change Due Display */}
                        {posTenderedNum > 0 && (
                          <View style={styles.posChangeBanner}>
                            <Text style={styles.posChangeBannerText}>Change Due to Customer:</Text>
                            <Text style={styles.posChangeBannerAmount}>
                              ₱{posChangeAmount.toLocaleString()}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Process Checkout CTA */}
                    <TouchableOpacity
                      style={[styles.posCheckoutBtn, posCart.length === 0 && styles.posCheckoutBtnDisabled]}
                      onPress={handlePOSCheckout}
                      disabled={posCart.length === 0}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="receipt-cutoff" size={16} color="#FFFFFF" />
                      <Text style={styles.posCheckoutBtnText}>Complete POS Sale & Print Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ─── TAB 4: ANALYTICS & REPORTS ─── */}
            {activeNav === 'analytics' && (
              <SalesAnalyticsPanel
                orders={orders}
                products={products}
                garageBookings={garageBookings}
                usersList={usersList}
                suppliers={suppliers}
                isDarkMode={isDarkMode}
                isDesktop={isDesktop}
                currentUser={currentUser}
                showToast={showToast}
                showAlert={showAlert}
                setActiveNav={setActiveNav}
              />
            )}

            {/* ─── TAB 4b: SALES FORECAST & STOCK OPTIMIZATION ─── */}
            {activeNav === 'forecast' && (
              <SalesForecastPanel
                orders={orders}
                products={products}
                suppliers={suppliers}
                isDarkMode={isDarkMode}
                isDesktop={isDesktop}
                initialProductId={forecastFocusProductId}
                onNavigate={(navKey) => {
                  if (navKey === 'forecast') return;
                  navigateFromInsights(navKey);
                }}
                onRestock={(product, qty) => {
                  openSupplierPurchase(product);
                  if (qty != null && Number(qty) > 0) {
                    setRestockAmount(String(Math.round(Number(qty))));
                  }
                }}
              />
            )}

            {activeNav === 'moto_models' && (
              <MotorcycleModelsAdminPanel onToast={showToast} isDarkMode={isDarkMode} />
            )}

            {/* ─── TAB 5: PRODUCTS & PRICES MANAGEMENT ─── */}
            {activeNav === 'products' && (
              <View>
                {/* Products & Price Catalog Toolbar & Filters */}
                <View
                  style={[
                    styles.toolbarRow,
                    {
                      position: 'relative',
                      zIndex: isProdCategoryDropdownOpen ? 99999 : 10,
                      elevation: isProdCategoryDropdownOpen ? 99999 : 1,
                    },
                  ]}
                >
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search products by name or brand..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Product Category Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isProdCategoryDropdownOpen ? 99999 : 10,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isProdCategoryDropdownOpen
                          ? '#EA580C'
                          : selectedCategory !== 'All'
                            ? '#EA580C'
                            : isDarkMode ? tokens.borderInput : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 160,
                        cursor: 'pointer',
                        boxShadow: isProdCategoryDropdownOpen
                          ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => setIsProdCategoryDropdownOpen((prev) => !prev)}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <BootstrapIcon
                          name={getCategoryIcon(selectedCategory)}
                          size={13}
                          color={selectedCategory !== 'All' ? '#EA580C' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: selectedCategory !== 'All' ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                        >
                          {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isProdCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={isProdCategoryDropdownOpen ? '#EA580C' : '#64748B'}
                      />
                    </TouchableOpacity>

                    {/* Transparent backdrop for outside click */}
                    {isProdCategoryDropdownOpen && (
                      <TouchableOpacity
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99998,
                          backgroundColor: 'transparent',
                          cursor: 'default',
                        }}
                        onPress={() => setIsProdCategoryDropdownOpen(false)}
                        activeOpacity={1}
                      />
                    )}

                    {/* Floating Dropdown Menu */}
                    {isProdCategoryDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 6,
                          minWidth: 220,
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 6,
                          gap: 3,
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        {availableCategoryNames.map((cat) => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                borderRadius: 9,
                                backgroundColor: isSelected
                                  ? isDarkMode ? '#132A26' : '#E8F0EC'
                                  : 'transparent',
                                cursor: 'pointer',
                              }}
                              onPress={() => {
                                setSelectedCategory(cat);
                                setIsProdCategoryDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <BootstrapIcon
                                  name={getCategoryIcon(cat)}
                                  size={14}
                                  color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '600' : '500',
                                    color: isSelected
                                      ? isDarkMode
                                        ? tokens.accentBrand
                                        : '#EA580C'
                                      : isDarkMode
                                        ? tokens.textSecondary
                                        : '#334155',
                                  }}
                                >
                                  {cat === 'All' ? 'All Categories' : cat}
                                </Text>
                              </View>
                              {isSelected && (
                                <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {/* Export Products to Excel Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        backgroundColor: isDarkMode ? '#EA580C' : '#107C41',
                        paddingHorizontal: 15,
                        paddingVertical: 10,
                        borderRadius: 12,
                      }}
                      onPress={() => {
                        const res = excelService.exportInventoryToExcel(filteredProducts, {
                          fileName: `mototrack_products_${selectedCategory !== 'All' ? selectedCategory.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`,
                        });
                        if (res.success) {
                          showToast(`✓ Exported ${filteredProducts.length} catalog products to Excel (.xlsx)`);
                        } else {
                          showAlert('Export Failed', res.error || 'Failed to generate Excel file.');
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="file-earmark-excel-fill" size={15} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
                        Export Excel ({filteredProducts.length})
                      </Text>
                    </TouchableOpacity>

                    {/* Add Category Button */}
                    <TouchableOpacity
                      style={[
                        styles.addBtnPrimary,
                        {
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                        },
                      ]}
                      onPress={() => setIsAddCategoryModalOpen(true)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="folder-plus" size={14} color={isDarkMode ? '#F8FAFC' : '#0F172A'} />
                      <Text style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A', fontWeight: '700', fontSize: 13 }}>
                        {isDesktop ? 'Add Category' : '+ Category'}
                      </Text>
                    </TouchableOpacity>

                    {/* Add New Product Button */}
                    <TouchableOpacity
                      style={styles.addBtnPrimary}
                      onPress={() => setIsAddProductOpen(true)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add New Product' : '+ Product'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Products Table — Cost & Profit visible to admin */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  dataSet={{ tableScroll: 'true' }}
                  style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                  contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                >
                  <View style={[styles.tableCard, { width: '100%', minWidth: 1040, flexGrow: 1 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.4, minWidth: 200 }]}>Product & Brand</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 120 }]}>Category & Stock</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 100, textAlign: 'center' }]}>Cost</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 100, textAlign: 'center' }]}>Price</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 110, textAlign: 'center' }]}>Profit</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 100, textAlign: 'center' }]}>Actions</Text>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled={true}
                      dataSet={{ tableScroll: 'true' }}
                      style={{
                        maxHeight: 560,
                        width: '100%',
                        ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {})
                      }}
                      contentContainerStyle={{ flexGrow: 1 }}
                    >
                      {filteredProducts.map((p) => {
                        const cost = Number(p.unit_cost ?? p.unitCost ?? 0);
                        const price = Number(p.price) || 0;
                        const profit = price - cost;
                        const margin = price > 0 ? (profit / price) * 100 : 0;
                        const stockQty = Number(p.stock) || 0;

                        return (
                          <View key={p.id} style={styles.tableRow}>
                            {/* PRODUCT & BRAND */}
                            <View style={{ flex: 2.4, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 }}>
                              <Image source={{ uri: p.image }} style={styles.productThumb} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.tableTitle} numberOfLines={1}>
                                  {p.name}
                                </Text>
                                <Text style={styles.tableSub} numberOfLines={1}>
                                  {p.brand || 'Brand'} · {p.compatibility || 'Universal Superbike Fitment'}
                                </Text>
                              </View>
                            </View>

                            {/* CATEGORY & STOCK */}
                            <View style={{ flex: 1.5, minWidth: 120, paddingRight: 8 }}>
                              <Text style={styles.tableTitle} numberOfLines={1}>
                                {p.category || 'General'}
                              </Text>
                              <Text style={[styles.tableSub, { marginTop: 2 }]} numberOfLines={1}>
                                Stock {stockQty}
                              </Text>
                            </View>

                            {/* COST */}
                            <View style={{ flex: 1.2, minWidth: 100, alignItems: 'center', justifyContent: 'center' }}>
                              <Text
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: '700',
                                  color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                  textAlign: 'center',
                                  fontVariant: ['tabular-nums'],
                                }}
                                numberOfLines={1}
                              >
                                {cost.toLocaleString()}
                              </Text>
                              <Text style={styles.tableSub}>Unit cost</Text>
                            </View>

                            {/* PRICE */}
                            <View style={{ flex: 1.2, minWidth: 100, alignItems: 'center', justifyContent: 'center' }}>
                              <Text
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: '700',
                                  color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                  textAlign: 'center',
                                  fontVariant: ['tabular-nums'],
                                }}
                                numberOfLines={1}
                              >
                                {price.toLocaleString()}
                              </Text>
                              <Text style={styles.tableSub}>Sell price</Text>
                            </View>

                            {/* PROFIT */}
                            <View style={{ flex: 1.3, minWidth: 110, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                              <View
                                style={[
                                  styles.tableStatusPill,
                                  {
                                    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
                                    paddingHorizontal: 10,
                                    paddingVertical: 3,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: isDarkMode ? '#5FBF9A' : '#15803D',
                                    fontWeight: '600',
                                    fontSize: 12.5,
                                  }}
                                  numberOfLines={1}
                                >
                                  ₱{profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.tableStatusSub,
                                  {
                                    color: isDarkMode ? tokens.textMuted : '#64748B',
                                    fontWeight: '600',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {margin.toFixed(1)}% margin
                              </Text>
                            </View>

                            {/* ACTIONS */}
                            <View style={{ flex: 1.2, minWidth: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                              <TouchableOpacity
                                style={styles.tableOutlineBtn}
                                onPress={() => setEditingProduct({ ...p, unit_cost: cost, unitCost: cost })}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.tableOutlineBtnText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                onPress={() => handleDeleteProduct(p.product_id || p.id, p.name)}
                                activeOpacity={0.7}
                              >
                                <BootstrapIcon name="trash3" size={14} color={isDarkMode ? tokens.statusDangerText : '#EF4444'} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ─── TAB 6: PROMO VOUCHERS ─── */}
            {activeNav === 'promos' && (
              <PromosAdminPanel
                ref={promosPanelRef}
                styles={styles}
                isDarkMode={isDarkMode}
                onToast={showToast}
                onPromosChange={setPromos}
                isDesktop={isDesktop}
              />
            )}

            {/* ─── TAB 7: GARAGE & BOOKINGS ─── */}
            {activeNav === 'garage' && (
              <View>
                {/* Garage Sub-Navigation Dropdown Selector */}
                <View
                  style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: isDesktop ? 'center' : 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 20,
                    zIndex: isGarageSubTabDropdownOpen ? 9999 : 10,
                    position: 'relative',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: isDarkMode ? '#EA580C' : '#107C41',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(16, 124, 65, 0.25)',
                      }}
                      onPress={() => {
                        const res = excelService.exportBookingsToExcel(garageBookings, {
                          fileName: `mototrack_service_bookings_${new Date().toISOString().slice(0, 10)}.xlsx`,
                        });
                        if (res.success) {
                          showToast(`✓ Exported ${garageBookings.length} service appointments to Excel (.xlsx)`);
                        } else {
                          showAlert('Export Failed', res.error || 'Failed to generate Excel report.');
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="file-earmark-excel-fill" size={13} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12 }}>
                        Export Excel ({garageBookings.length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Interactive Dropdown Button Container */}
                  <View
                    style={{
                      position: 'relative',
                      width: isDesktop ? 420 : '100%',
                      zIndex: isGarageSubTabDropdownOpen ? 9999 : 10,
                    }}
                  >
                    {/* Trigger Button */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isGarageSubTabDropdownOpen ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        cursor: 'pointer',
                        boxShadow: isGarageSubTabDropdownOpen
                          ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                          : '0 2px 6px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => setIsGarageSubTabDropdownOpen((prev) => !prev)}
                      activeOpacity={0.85}
                    >
                      {(() => {
                        const garageTabs = [
                          {
                            id: 'bookings',
                            label: 'Customer Bookings & Pitstop Queue',
                            icon: 'calendar2-check-fill',
                            count: bookingStats.total,
                            desc: 'Appointments, bays & walk-in queue',
                          },
                          {
                            id: 'services',
                            label: 'PMS Fixed-Rate Catalog (by CC)',
                            icon: 'tools',
                            count: pmsRateCatalog.length,
                            desc: '125cc · 150–160cc · 200cc above rates',
                          },
                        ];
                        const activeObj = garageTabs.find((t) => t.id === garageSubTab) || garageTabs[0];
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <BootstrapIcon name={activeObj.icon} size={15} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: '600',
                                    color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                  }}
                                >
                                  {activeObj.label}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                                    paddingHorizontal: 7,
                                    paddingVertical: 1,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                                    {activeObj.count}
                                  </Text>
                                </View>
                              </View>
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 11,
                                  color: isDarkMode ? tokens.textMuted : '#64748B',
                                  marginTop: 1,
                                }}
                              >
                                {activeObj.desc}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}

                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 10,
                        }}
                      >
                        <BootstrapIcon
                          name={isGarageSubTabDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={isDarkMode ? tokens.textMuted : '#475569'}
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Backdrop overlay for outside click */}
                    {isGarageSubTabDropdownOpen && (
                      <TouchableOpacity
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 9998,
                          backgroundColor: 'transparent',
                        }}
                        onPress={() => setIsGarageSubTabDropdownOpen(false)}
                        activeOpacity={1}
                      />
                    )}

                    {/* Floating Dropdown Menu */}
                    {isGarageSubTabDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          left: isDesktop ? undefined : 0,
                          marginTop: 8,
                          width: isDesktop ? 420 : '100%',
                          backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.22)',
                          zIndex: 9999,
                          padding: 6,
                          gap: 4,
                        }}
                      >
                        {[
                          {
                            id: 'bookings',
                            label: 'Customer Bookings & Pitstop Queue',
                            icon: 'calendar2-check-fill',
                            count: bookingStats.total,
                            desc: 'Appointments, bays & walk-in queue',
                          },
                          {
                            id: 'services',
                            label: 'PMS Fixed-Rate Catalog (by CC)',
                            icon: 'tools',
                            count: pmsRateCatalog.length,
                            desc: '125cc · 150–160cc · 200cc above rates',
                          },
                        ].map((tab) => {
                          const isSelected = garageSubTab === tab.id;
                          return (
                            <TouchableOpacity
                              key={tab.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 10,
                                borderRadius: 10,
                                backgroundColor: isSelected
                                  ? isDarkMode ? '#132A26' : '#E8F0EC'
                                  : 'transparent',
                                gap: 10,
                                cursor: 'pointer',
                              }}
                              onPress={() => {
                                setGarageSubTab(tab.id);
                                setIsGarageSubTabDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: isSelected
                                    ? '#EA580C'
                                    : isDarkMode ? '#0F172A' : '#F1F5F9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <BootstrapIcon
                                  name={tab.icon}
                                  size={15}
                                  color={isSelected ? '#FFFFFF' : '#EA580C'}
                                />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '600' : '500',
                                      color: isSelected
                                        ? '#EA580C'
                                        : isDarkMode ? tokens.textPrimary : '#1E293B',
                                    }}
                                  >
                                    {tab.label}
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: isSelected
                                        ? '#EA580C'
                                        : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                      paddingHorizontal: 7,
                                      paddingVertical: 1,
                                      borderRadius: 10,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: '700',
                                        color: isSelected ? '#FFFFFF' : isDarkMode ? tokens.textMuted : '#475569',
                                      }}
                                    >
                                      {tab.count}
                                    </Text>
                                  </View>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 11,
                                    color: isDarkMode ? tokens.textMuted : '#64748B',
                                    marginTop: 1,
                                  }}
                                >
                                  {tab.desc}
                                </Text>
                              </View>

                              {isSelected && (
                                <BootstrapIcon name="check2" size={16} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>

                {/* ── SUB-VIEW A: CUSTOMER BOOKINGS & QUEUE ── */}
                {garageSubTab === 'bookings' && (
                  <View>
                    {/* Booking Stats Cards — key operational KPIs only */}
                    <View
                      style={[
                        styles.statsGrid,
                        {
                          flexWrap: 'wrap',
                          gap: 16,
                          marginBottom: 24,
                        },
                      ]}
                    >
                      <AdminStatCard
                        styles={styles}
                        accent="teal"
                        label="Total Bookings"
                        value={bookingStats.total}
                        sub="All service requests"
                        isDark={isDarkMode}
                        style={{ flex: 1, minWidth: 200, minHeight: 152, padding: 22 }}
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="amber"
                        label="Pending Review"
                        value={bookingStats.pending}
                        valueColor={
                          bookingStats.pending > 0
                            ? isDarkMode
                              ? tokens.statusWarningText
                              : '#D97706'
                            : undefined
                        }
                        sub="Needs approve / reject"
                        isDark={isDarkMode}
                        style={{ flex: 1, minWidth: 200, minHeight: 152, padding: 22 }}
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="teal"
                        label="In Service"
                        value={bookingStats.inProgress}
                        sub="Active repairs"
                        isDark={isDarkMode}
                        style={{ flex: 1, minWidth: 200, minHeight: 152, padding: 22 }}
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="green"
                        label="Ready Pickup"
                        value={bookingStats.readyForPickup}
                        valueColor={
                          bookingStats.readyForPickup > 0
                            ? isDarkMode
                              ? tokens.statusSuccessText
                              : '#EA580C'
                            : undefined
                        }
                        sub="Ready to claim"
                        isDark={isDarkMode}
                        style={{ flex: 1, minWidth: 200, minHeight: 152, padding: 22 }}
                      />
                    </View>

                    {/* Toolbar (Search, Filter Tabs, Add Walk-in) */}
                    <View style={[styles.toolbarRow, { marginBottom: 12 }]}>
                      <View style={styles.searchInputBox}>
                        <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search by Ref ID, Customer, Phone, Bike, Plate, or Service..."
                          placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                          value={bookingSearchQuery}
                          onChangeText={(t) => {
                            setBookingSearchQuery(t);
                            setBookingPage(1);
                          }}
                        />
                        {bookingSearchQuery ? (
                          <TouchableOpacity onPress={() => setBookingSearchQuery('')}>
                            <BootstrapIcon name="x-circle" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <TextInput
                        style={[styles.searchInputBox, { maxWidth: 160, marginLeft: 8 }]}
                        placeholder="Date YYYY-MM-DD"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                        value={bookingDateFilter}
                        onChangeText={(t) => {
                          setBookingDateFilter(t);
                          setBookingPage(1);
                        }}
                      />

                      <View style={[styles.searchInputBox, { maxWidth: 180, marginLeft: 8 }]}>
                        <BootstrapIcon name="person" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Filter by customer"
                          placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                          value={bookingCustomerFilter}
                          onChangeText={(t) => {
                            setBookingCustomerFilter(t);
                            setBookingPage(1);
                          }}
                        />
                        {bookingCustomerFilter ? (
                          <TouchableOpacity
                            onPress={() => {
                              setBookingCustomerFilter('');
                              setBookingPage(1);
                            }}
                          >
                            <BootstrapIcon name="x-circle" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={[styles.addBtnPrimary, { backgroundColor: isDarkMode ? '#EA580C' : '#EA580C' }]}
                        onPress={() => {
                          setNewBkCustomerName('');
                          setNewBkCustomerPhone('');
                          setNewBkCustomerEmail('');
                          setNewBkPlate('');
                          setNewBkOdo('');
                          setNewBkNotes('');
                          setIsNewBookingModalOpen(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="calendar-plus-fill" size={13} color="#FFFFFF" />
                        <Text style={styles.addBtnPrimaryText}>+ Book Walk-in / Phone</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Filter Dropdown & Category Bar */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 14,
                        flexWrap: 'wrap',
                        position: 'relative',
                        zIndex: isBookingStatusDropdownOpen ? 99999 : 10,
                      }}
                    >
                      {/* Booking Status Filter Dropdown */}
                      <View
                        style={{
                          position: 'relative',
                          zIndex: isBookingStatusDropdownOpen ? 99999 : 10,
                        }}
                      >
                        {(() => {
                          const bookingStatusOptions = [
                            { key: 'All', label: 'All Bookings', count: bookingStats.total, icon: 'grid-fill', color: isDarkMode ? tokens.accentBrand : '#EA580C' },
                            { key: 'Pending', label: 'Pending Review', count: bookingStats.pending, icon: 'hourglass-split', color: isDarkMode ? tokens.statusWarningText : '#D97706', highlight: bookingStats.pending > 0 },
                            { key: 'Confirmed', label: 'Confirmed', count: bookingStats.confirmed, icon: 'clock-fill', color: isDarkMode ? tokens.statusInfoText : '#0284C7' },
                            { key: 'Inspection', label: 'Inspection', count: bookingStats.inspection, icon: 'search', color: isDarkMode ? tokens.statusPurpleText : '#8B5CF6' },
                            { key: 'In Progress', label: 'In Bay', count: bookingStats.inProgress, icon: 'gear-wide-connected', color: isDarkMode ? tokens.statusWarningText : '#F59E0B', highlight: bookingStats.inProgress > 0 },
                            { key: 'Service Done', label: 'Done / Bill', count: bookingStats.serviceDone, icon: 'receipt', color: isDarkMode ? tokens.statusSuccessText : '#10B981' },
                            { key: 'Completed', label: 'Completed', count: bookingStats.completed, icon: 'check-circle-fill', color: isDarkMode ? tokens.statusSuccessText : '#16A34A' },
                            { key: 'Cancelled', label: 'Cancelled', count: bookingStats.cancelled, icon: 'x-circle-fill', color: isDarkMode ? tokens.statusDangerText : '#DC2626' },
                          ];
                          const activeOpt = bookingStatusOptions.find((o) => o.key === bookingStatusFilter) || bookingStatusOptions[0];

                          return (
                            <>
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                  borderWidth: 1.5,
                                  borderColor: isBookingStatusDropdownOpen
                                    ? '#EA580C'
                                    : activeOpt.highlight
                                      ? '#F59E0B'
                                      : bookingStatusFilter !== 'All'
                                        ? '#EA580C'
                                        : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                  borderRadius: 12,
                                  paddingHorizontal: 14,
                                  paddingVertical: 9,
                                  minWidth: 180,
                                  cursor: 'pointer',
                                  boxShadow: isBookingStatusDropdownOpen
                                    ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
                                }}
                                onPress={() => setIsBookingStatusDropdownOpen((prev) => !prev)}
                                activeOpacity={0.85}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                  <BootstrapIcon
                                    name={activeOpt.icon}
                                    size={13}
                                    color={
                                      activeOpt.highlight
                                        ? '#D97706'
                                        : bookingStatusFilter !== 'All'
                                          ? activeOpt.color
                                          : '#64748B'
                                    }
                                  />
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: '700',
                                      color:
                                        activeOpt.highlight
                                          ? '#B45309'
                                          : bookingStatusFilter !== 'All'
                                            ? '#EA580C'
                                            : isDarkMode ? tokens.textPrimary : '#0F172A',
                                    }}
                                  >
                                    {activeOpt.label}
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor:
                                        activeOpt.highlight
                                          ? '#FEF3C7'
                                          : bookingStatusFilter !== 'All'
                                            ? '#EA580C'
                                            : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                      paddingHorizontal: 6,
                                      paddingVertical: 1,
                                      borderRadius: 8,
                                      marginLeft: 2,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: '600',
                                        color:
                                          activeOpt.highlight
                                            ? '#B45309'
                                            : bookingStatusFilter !== 'All'
                                              ? '#FFFFFF'
                                              : isDarkMode ? '#CBD5E1' : '#475569',
                                      }}
                                    >
                                      {activeOpt.count}
                                    </Text>
                                  </View>
                                </View>
                                <BootstrapIcon
                                  name={isBookingStatusDropdownOpen ? 'chevron-up' : 'chevron-down'}
                                  size={12}
                                  color={isBookingStatusDropdownOpen ? '#EA580C' : '#64748B'}
                                />
                              </TouchableOpacity>

                              {/* Transparent backdrop for outside click */}
                              {isBookingStatusDropdownOpen && (
                                <TouchableOpacity
                                  style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 99998,
                                    backgroundColor: 'transparent',
                                    cursor: 'default',
                                  }}
                                  onPress={() => setIsBookingStatusDropdownOpen(false)}
                                  activeOpacity={1}
                                />
                              )}

                              {/* Floating Dropdown Menu */}
                              {isBookingStatusDropdownOpen && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    marginTop: 6,
                                    minWidth: 230,
                                    backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                    borderRadius: 14,
                                    borderWidth: 1.5,
                                    borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                    boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                                    zIndex: 99999,
                                    padding: 6,
                                    gap: 3,
                                    maxHeight: 320,
                                    overflowY: 'auto',
                                  }}
                                >
                                  {bookingStatusOptions.map((option) => {
                                    const isSelected = bookingStatusFilter === option.key;
                                    return (
                                      <TouchableOpacity
                                        key={option.key}
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          paddingHorizontal: 12,
                                          paddingVertical: 9,
                                          borderRadius: 9,
                                          backgroundColor: isSelected
                                            ? isDarkMode ? '#132A26' : '#E8F0EC'
                                            : 'transparent',
                                          cursor: 'pointer',
                                        }}
                                        onPress={() => {
                                          setBookingStatusFilter(option.key);
                                          setBookingPage(1);
                                          setIsBookingStatusDropdownOpen(false);
                                        }}
                                        activeOpacity={0.8}
                                      >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                          <BootstrapIcon
                                            name={option.icon}
                                            size={14}
                                            color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : option.color || (isDarkMode ? tokens.textMuted : '#64748B')}
                                          />
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              fontWeight: isSelected ? '600' : '500',
                                              color: isSelected
                                                ? '#EA580C'
                                                : isDarkMode ? '#E2E8F0' : '#334155',
                                            }}
                                          >
                                            {option.label}
                                          </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                          <View
                                            style={{
                                              backgroundColor: option.highlight
                                                ? '#FEF3C7'
                                                : isSelected
                                                  ? '#EA580C'
                                                  : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                              paddingHorizontal: 6,
                                              paddingVertical: 1,
                                              borderRadius: 6,
                                            }}
                                          >
                                            <Text
                                              style={{
                                                fontSize: 10.5,
                                                fontWeight: '600',
                                                color: option.highlight
                                                  ? '#B45309'
                                                  : isSelected
                                                    ? '#FFFFFF'
                                                    : isDarkMode ? '#CBD5E1' : '#475569',
                                              }}
                                            >
                                              {option.count}
                                            </Text>
                                          </View>
                                          {isSelected && <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />}
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </>
                          );
                        })()}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                        {/* Segmented Category Filter: All Types | Repair | PMS | Installation */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                            borderRadius: 8,
                            padding: 3,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                          }}
                        >
                          {['All', 'Repair', 'PMS', 'Installation'].map((cat) => {
                            const isSelected = bookingCategoryFilter === cat;
                            return (
                              <TouchableOpacity
                                key={cat}
                                style={{
                                  paddingVertical: 5,
                                  paddingHorizontal: 12,
                                  borderRadius: 6,
                                  backgroundColor: isSelected ? '#EA580C' : 'transparent',
                                  boxShadow: isSelected ? '0 1px 4px rgba(234, 88, 12, 0.35)' : 'none',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onPress={() => {
                                  setBookingCategoryFilter(cat);
                                  setBookingPage(1);
                                }}
                                activeOpacity={0.85}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: isSelected ? '700' : '600',
                                    color: isSelected ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B',
                                    transition: 'color 0.15s ease',
                                  }}
                                >
                                  {cat === 'All' ? 'All Types' : cat}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* View Mode Toggle: Table / Calendar */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginLeft: 8,
                            backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                            padding: 3,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                          }}
                        >
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 5,
                              paddingVertical: 5,
                              paddingHorizontal: 10,
                              borderRadius: 6,
                              backgroundColor: bookingViewMode === 'table' ? '#EA580C' : 'transparent',
                              boxShadow: bookingViewMode === 'table' ? '0 1px 4px rgba(234, 88, 12, 0.35)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onPress={() => setBookingViewMode('table')}
                            activeOpacity={0.85}
                          >
                            <BootstrapIcon
                              name="table"
                              size={12}
                              color={bookingViewMode === 'table' ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: bookingViewMode === 'table' ? '700' : '600',
                                color: bookingViewMode === 'table' ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B',
                                transition: 'color 0.15s ease',
                              }}
                            >
                              Table
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 5,
                              paddingVertical: 5,
                              paddingHorizontal: 10,
                              borderRadius: 6,
                              backgroundColor: bookingViewMode === 'calendar' ? '#EA580C' : 'transparent',
                              boxShadow: bookingViewMode === 'calendar' ? '0 1px 4px rgba(234, 88, 12, 0.35)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onPress={() => setBookingViewMode('calendar')}
                            activeOpacity={0.85}
                          >
                            <BootstrapIcon
                              name="calendar-week"
                              size={12}
                              color={bookingViewMode === 'calendar' ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: bookingViewMode === 'calendar' ? '700' : '600',
                                color: bookingViewMode === 'calendar' ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B',
                                transition: 'color 0.15s ease',
                              }}
                            >
                              Calendar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Bookings View: Calendar / Table */}
                    {bookingViewMode === 'calendar' ? (
                      <View style={{ gap: 16, marginBottom: 20 }}>
                        <BookingCalendar
                          headerBg="#24272B"
                          isDarkMode={isDarkMode}
                          selectedDate={calendarSelectedDate}
                          onSelectDate={(dateStr) => setCalendarSelectedDate(dateStr)}
                          onFullyBookedSelected={(dateStr) => {
                            const avail = garageService.getDaySlotAvailability(dateStr);
                            const slotLabel = avail?.mechanicCount === 0
                              ? 'No mechanics are on duty'
                              : `All ${avail?.totalSlots ?? 0} daily slots are reserved`;
                            showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! ${slotLabel}.`);
                          }}
                          getDayInfo={(dateStr) => {
                            const selAvail = garageService.getDaySlotAvailability(dateStr);
                            const count = selAvail?.bookedSlotsCount || 0;
                            const total = selAvail?.totalSlots || 5;
                            const avail = typeof selAvail?.availableSlotsCount === 'number'
                              ? selAvail.availableSlotsCount
                              : Math.max(0, total - count);
                            const d = new Date(dateStr + 'T00:00:00');
                            const isSunday = d.getDay() === 0;
                            const isOff = adminOffDutyDates[dateStr] ?? isSunday;
                            return {
                              bookingCount: count,
                              availableSlots: avail,
                              totalSlots: total,
                              isFullyBooked: selAvail?.isFullyBooked || false,
                              isOffDuty: isOff,
                              label: count === 0 && !isOff ? 'Open' : undefined,
                            };
                          }}
                          onToggleOffDuty={(dateStr) => {
                            setAdminOffDutyDates((prev) => {
                              const current = prev[dateStr] ?? (new Date(dateStr + 'T00:00:00').getDay() === 0);
                              const nextVal = !current;
                              showToast(nextVal ? `Marked ${dateStr} as Off-Duty` : `Marked ${dateStr} as Open Duty`);
                              return { ...prev, [dateStr]: nextVal };
                            });
                          }}
                          onBlockDate={(dateStr) => {
                            if (!dateStr) return;
                            setAdminOffDutyDates((prev) => ({ ...prev, [dateStr]: true }));
                            showToast(`Blocked all slots for ${dateStr}`);
                          }}
                          onEnableDate={(dateStr) => {
                            if (!dateStr) return;
                            setAdminOffDutyDates((prev) => ({ ...prev, [dateStr]: false }));
                            showToast(`Restored active business slots for ${dateStr}`);
                          }}
                          statusBarText="Hours: 9:00 AM – 6:00 PM (Mon – Sat). Tap any date to toggle off-duty or select date."
                          offDutyCount={Object.values(adminOffDutyDates).filter(Boolean).length || 1}
                        />

                        {/* Selected Date Appointments Sub-panel */}
                        {(() => {
                          const dateAppointments = garageBookings.filter(
                            (b) => (b.appointment_date || '').split('T')[0] === calendarSelectedDate
                          );
                          return (
                            <View
                              style={{
                                backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                borderRadius: 16,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                padding: 18,
                                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: 12,
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <BootstrapIcon name="calendar-check-fill" size={16} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                                  <Text style={{ fontSize: 15, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                                    Appointments for {calendarSelectedDate}
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: '#C8DDD3',
                                      borderRadius: 12,
                                      paddingHorizontal: 8,
                                      paddingVertical: 2,
                                    }}
                                  >
                                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                      {dateAppointments.length} Booked
                                    </Text>
                                  </View>
                                </View>

                                <TouchableOpacity
                                  style={[styles.addBtnPrimary, { backgroundColor: isDarkMode ? '#EA580C' : '#EA580C', paddingVertical: 6, paddingHorizontal: 12 }]}
                                  onPress={() => {
                                    setEditBkDate(calendarSelectedDate);
                                    setNewBkCustomerName('');
                                    setNewBkCustomerPhone('');
                                    setNewBkCustomerEmail('');
                                    setNewBkPlate('');
                                    setNewBkOdo('');
                                    setNewBkNotes('');
                                    setIsNewBookingModalOpen(true);
                                  }}
                                  activeOpacity={0.85}
                                >
                                  <BootstrapIcon name="plus-lg" size={11} color="#FFFFFF" />
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>+ Book This Day</Text>
                                </TouchableOpacity>
                              </View>

                              {dateAppointments.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                                  <BootstrapIcon name="calendar2-check" size={26} color={isDarkMode ? tokens.textMuted : "#94A3B8"} style={{ marginBottom: 6 }} />
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                                    No appointments scheduled for {calendarSelectedDate}
                                  </Text>
                                </View>
                              ) : (
                                <View style={{ gap: 8 }}>
                                  {dateAppointments.map((bk, bIdx) => (
                                    <View
                                      key={bk.id || bk.booking_id || bIdx}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 10,
                                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                        gap: 10,
                                      }}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                            {bk.booking_id || bk.id}
                                          </Text>
                                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#1E293B' }}>
                                            {bk.customer_name || 'Walk-in Customer'}
                                          </Text>
                                          <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                                            ({bk.bike_model || bk.motorcycle || 'Motorcycle'})
                                          </Text>
                                        </View>
                                        <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                                          {bk.service_name || bk.package_name || bk.category || 'Service'} • Slot: {bk.time_slot || 'Morning'} • Tech: {bk.mechanic || 'Unassigned'}
                                        </Text>
                                      </View>

                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View
                                          style={{
                                            backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                                            paddingHorizontal: 7,
                                            paddingVertical: 2,
                                            borderRadius: 5,
                                          }}
                                        >
                                          <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDarkMode ? tokens.statusWarningText : '#B45309' }}>
                                            {bk.status || 'Pending'}
                                          </Text>
                                        </View>
                                        <TouchableOpacity
                                          style={[styles.actionIconBtn, { backgroundColor: isDarkMode ? tokens.borderInput : '#E2E8F0' }]}
                                          onPress={() => handleOpenBookingDetail(bk)}
                                          activeOpacity={0.8}
                                        >
                                          <BootstrapIcon name="eye-fill" size={12} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    ) : (
                      /* Bookings Table Card — two-line scan-friendly layout */
                      <View style={styles.tableCard}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          showsVerticalScrollIndicator={false}
                          dataSet={{ tableScroll: 'true' }}
                          style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                          contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                        >
                          <View style={{ width: '100%', minWidth: 1080, flexGrow: 1 }}>
                            <View
                              style={[
                                styles.tableHeaderRow,
                              ]}
                            >
                              {[
                                { label: 'Customer & Time', flex: 1.7, minWidth: 160 },
                                { label: 'Service & Date', flex: 1.6, minWidth: 150 },
                                { label: 'Booking ID', flex: 1.3, minWidth: 130 },
                                { label: 'Motorcycle', flex: 1.4, minWidth: 130 },
                                { label: 'Mechanic', flex: 1.4, minWidth: 130 },
                                { label: 'Status', flex: 1.55, minWidth: 150, center: true },
                                { label: 'Actions', flex: 1.2, minWidth: 120, center: true },
                              ].map((col) => (
                                <Text
                                  key={col.label}
                                  style={[
                                    styles.tableHeaderCell,
                                    {
                                      flex: col.flex,
                                      minWidth: col.minWidth,
                                      textAlign: col.center ? 'center' : 'left',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.6,
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDarkMode ? tokens.textMuted : '#94A3B8',
                                    },
                                  ]}
                                >
                                  {col.label}
                                </Text>
                              ))}
                            </View>

                            <ScrollView
                              showsVerticalScrollIndicator={false}
                              showsHorizontalScrollIndicator={false}
                              nestedScrollEnabled={true}
                              dataSet={{ tableScroll: 'true' }}
                              style={{
                                maxHeight: 560,
                                width: '100%',
                                ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                              }}
                              contentContainerStyle={{ flexGrow: 1 }}
                            >
                              {filteredBookings.length === 0 ? (
                                <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                                  <BootstrapIcon
                                    name="calendar-x"
                                    size={32}
                                    color={isDarkMode ? tokens.textMuted : "#94A3B8"}
                                    style={{ marginBottom: 8 }}
                                  />
                                  <Text style={{ fontSize: 15, fontWeight: '600', color: isDarkMode ? tokens.textMuted : '#475569' }}>
                                    No Service Appointments Found
                                  </Text>
                                  <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#94A3B8', marginTop: 4 }}>
                                    {bookingSearchQuery || bookingStatusFilter !== 'All'
                                      ? 'Try clearing your search filters or status selection.'
                                      : 'No bookings in the queue. Click "+ Book Walk-in / Phone" to schedule one.'}
                                  </Text>
                                </View>
                              ) : (
                                paginatedBookings.map((b) => {
                                  const isPending =
                                    (b.status || '').toLowerCase() === 'pending' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.PENDING_REVIEW;
                                  const isConfirmed =
                                    (b.status || '').toLowerCase() === 'confirmed' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.CONFIRMED ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.APPROVED;
                                  const isInspection =
                                    (b.status || '').toLowerCase() === 'inspection' ||
                                    (b.status || '').toLowerCase() === 'estimate pending' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.UNDER_INSPECTION;
                                  const isInProg =
                                    (b.status || '').toLowerCase() === 'in progress' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS;
                                  const isServiceDone =
                                    (b.status || '').toLowerCase() === 'service done' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.SERVICE_COMPLETED;
                                  const isPaid =
                                    (b.status || '').toLowerCase() === 'paid' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.READY_FOR_PICKUP;
                                  const isDone =
                                    (b.status || '').toLowerCase() === 'completed' ||
                                    (b.status || '').toLowerCase() === 'closed' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.COMPLETED;
                                  const isCancel =
                                    (b.status || '').toLowerCase() === 'cancelled' ||
                                    (b.status || '').toLowerCase() === 'rejected' ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.CANCELLED ||
                                    normalizeBookingStatus(b.status) === FLEX_BOOKING_STATUS.REJECTED;
                                  const payStat = bookingPaymentStatus(b);
                                  const mechanicName = b.mechanic
                                    ? String(b.mechanic)
                                      .split('(')[0]
                                      .replace('Master Tech ', '')
                                      .replace('Specialist ', '')
                                      .trim()
                                    : '';
                                  const bikeLabel = [b.bike_brand || b.bikeBrand, b.bike_model || b.bikeModel]
                                    .filter(Boolean)
                                    .join(' ') || 'Motorcycle';
                                  const scheduleTime = b.preferred_time || b.time_slot || b.time || '—';
                                  const scheduleDate = b.preferred_date || b.appointment_date || b.date || '—';
                                  const serviceLabel =
                                    b.package_name || b.service_title || b.serviceName || 'Pitstop Service';
                                  const quoteAmt =
                                    Number(bookingQuotationTotal(b)) ||
                                    Number(b.pricePhp) ||
                                    usdToPhp(b.service_price) ||
                                    0;

                                  const primaryText = {
                                    fontSize: 13.5,
                                    fontWeight: '700',
                                    color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                    lineHeight: 18,
                                  };
                                  const secondaryText = {
                                    fontSize: 12,
                                    fontWeight: '500',
                                    color: isDarkMode ? tokens.textMuted : '#94A3B8',
                                    marginTop: 3,
                                    lineHeight: 16,
                                  };

                                  // Soft tinted pills (pending/approved) + solid green completed
                                  let statusBg = isDarkMode ? tokens.badgeNeutralBg : '#F1F5F9';
                                  let statusFg = isDarkMode ? tokens.badgeNeutralText : '#334155';
                                  let statusSolid = false;
                                  if (isPending) {
                                    statusBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
                                    statusFg = isDarkMode ? '#FBBF24' : '#B45309';
                                  } else if (isConfirmed) {
                                    statusBg = isDarkMode ? 'rgba(56, 189, 248, 0.16)' : '#DBEAFE';
                                    statusFg = isDarkMode ? '#7DD3FC' : '#1E3A5F';
                                  } else if (isInspection) {
                                    statusBg = isDarkMode ? 'rgba(167, 139, 250, 0.16)' : '#EDE9FE';
                                    statusFg = isDarkMode ? '#C4B5FD' : '#6D28D9';
                                  } else if (isInProg) {
                                    statusBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FFEDD5';
                                    statusFg = isDarkMode ? '#FBBF24' : '#C2410C';
                                  } else if (isServiceDone) {
                                    statusBg = isDarkMode ? 'rgba(56, 189, 248, 0.16)' : '#E0F2FE';
                                    statusFg = isDarkMode ? '#7DD3FC' : '#0369A1';
                                  } else if (isPaid || isDone) {
                                    statusBg = isDarkMode ? '#2E7D32' : '#2E7D32';
                                    statusFg = '#FFFFFF';
                                    statusSolid = true;
                                  } else if (isCancel) {
                                    statusBg = isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2';
                                    statusFg = isDarkMode ? '#FCA5A5' : '#B91C1C';
                                  }

                                  const payLabel = String(payStat || 'Unpaid')
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, (c) => c.toUpperCase());

                                  return (
                                    <View
                                      key={b.id || b.booking_id}
                                      style={[
                                        styles.tableRow,
                                        {
                                          alignItems: 'center',
                                          paddingVertical: 16,
                                          borderBottomColor: isDarkMode ? tokens.tableRowBorder : '#E8EEF2',
                                        },
                                      ]}
                                    >
                                      {/* Customer & Time */}
                                      <View style={{ flex: 1.7, minWidth: 160, paddingRight: 8 }}>
                                        <Text style={primaryText} numberOfLines={1}>
                                          {b.customer_name || b.userName || 'Customer'}
                                        </Text>
                                        <Text style={secondaryText} numberOfLines={1}>
                                          {scheduleTime}
                                        </Text>
                                      </View>

                                      {/* Service & Date */}
                                      <View style={{ flex: 1.6, minWidth: 150, paddingRight: 8 }}>
                                        <Text style={primaryText} numberOfLines={1}>
                                          {serviceLabel}
                                        </Text>
                                        <Text style={secondaryText} numberOfLines={1}>
                                          {scheduleDate}
                                          {quoteAmt > 0 ? `  ·  ₱${Number(quoteAmt).toLocaleString()}` : ''}
                                        </Text>
                                      </View>

                                      {/* Booking ID */}
                                      <View style={{ flex: 1.3, minWidth: 130, paddingRight: 8 }}>
                                        <Text
                                          style={{
                                            fontSize: 12.5,
                                            fontWeight: '600',
                                            color: isDarkMode ? tokens.textSecondary : '#334155',
                                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                          }}
                                          numberOfLines={1}
                                        >
                                          {b.booking_id || b.id || '—'}
                                        </Text>
                                      </View>

                                      {/* Motorcycle */}
                                      <View style={{ flex: 1.4, minWidth: 130, paddingRight: 8 }}>
                                        <Text style={primaryText} numberOfLines={1}>
                                          {bikeLabel}
                                        </Text>
                                        <Text style={secondaryText} numberOfLines={1}>
                                          {b.plate_number || b.bikePlate || 'No plate'}
                                        </Text>
                                      </View>

                                      {/* Mechanic */}
                                      <View style={{ flex: 1.4, minWidth: 130, paddingRight: 8 }}>
                                        <Text style={primaryText} numberOfLines={1}>
                                          {mechanicName || 'Unassigned'}
                                        </Text>
                                        <Text style={secondaryText} numberOfLines={1}>
                                          {mechanicName ? 'Assigned mechanic' : 'Pending assignment'}
                                        </Text>
                                      </View>

                                      {/* Status — pill + payment subtext */}
                                      <View
                                        style={{
                                          flex: 1.55,
                                          minWidth: 150,
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 6,
                                          paddingHorizontal: 4,
                                        }}
                                      >
                                        <View
                                          style={{
                                            backgroundColor: statusBg,
                                            paddingHorizontal: statusSolid ? 14 : 12,
                                            paddingVertical: statusSolid ? 6 : 5,
                                            borderRadius: statusSolid ? 6 : 999,
                                            alignSelf: 'center',
                                            maxWidth: '100%',
                                            ...(statusSolid
                                              ? {
                                                shadowColor: '#1B5E20',
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.28,
                                                shadowRadius: 2,
                                                elevation: 2,
                                              }
                                              : Platform.OS === 'web'
                                                ? { boxShadow: 'none' }
                                                : null),
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: statusSolid ? 12 : 11,
                                              fontWeight: '700',
                                              color: statusFg,
                                              textAlign: 'center',
                                            }}
                                            numberOfLines={1}
                                          >
                                            {statusLabel(b.status || 'Pending')}
                                          </Text>
                                        </View>
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: '500',
                                            color: isDarkMode ? tokens.textMuted : '#64748B',
                                            textAlign: 'center',
                                          }}
                                          numberOfLines={1}
                                        >
                                          {payLabel}
                                        </Text>
                                      </View>

                                      {/* Actions */}
                                      <View
                                        style={{
                                          flex: 1.2,
                                          minWidth: 120,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 8,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <TouchableOpacity
                                          style={{
                                            backgroundColor: isDarkMode ? tokens.bgSub : '#FFFFFF',
                                            borderWidth: 1,
                                            borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                            paddingHorizontal: 12,
                                            paddingVertical: 7,
                                            borderRadius: 8,
                                          }}
                                          onPress={() => handleOpenBookingModal(b)}
                                          activeOpacity={0.8}
                                          title="Manage booking"
                                        >
                                          <Text
                                            style={{
                                              fontSize: 12,
                                              fontWeight: '600',
                                              color: isDarkMode ? tokens.textPrimary : '#334155',
                                            }}
                                          >
                                            Manage
                                          </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                          onPress={() => handleDeleteBooking(b.booking_id || b.id)}
                                          activeOpacity={0.8}
                                          title="Delete Appointment"
                                        >
                                          <BootstrapIcon
                                            name="trash"
                                            size={12}
                                            color={isDarkMode ? tokens.statusDangerText : '#DC2626'}
                                          />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  );
                                })
                              )}
                            </ScrollView>
                          </View>
                        </ScrollView>
                        {filteredBookings.length > 0 && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              borderTopWidth: 1,
                              borderTopColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                            }}
                          >
                            <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                              {(bookingPage - 1) * BOOKING_PAGE_SIZE + 1}–
                              {Math.min(bookingPage * BOOKING_PAGE_SIZE, filteredBookings.length)} of{' '}
                              {filteredBookings.length}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                              <TouchableOpacity
                                style={[styles.quickStoreBtn, bookingPage <= 1 && { opacity: 0.4 }]}
                                disabled={bookingPage <= 1}
                                onPress={() => setBookingPage((p) => Math.max(1, p - 1))}
                              >
                                <Text style={styles.quickStoreBtnText}>Prev</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                {bookingPage}/{bookingTotalPages}
                              </Text>
                              <TouchableOpacity
                                style={[
                                  styles.quickStoreBtn,
                                  bookingPage >= bookingTotalPages && { opacity: 0.4 },
                                ]}
                                disabled={bookingPage >= bookingTotalPages}
                                onPress={() => setBookingPage((p) => Math.min(bookingTotalPages, p + 1))}
                              >
                                <Text style={styles.quickStoreBtnText}>Next</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* ── SUB-VIEW B: PMS / REPAIR FIXED-RATE CATALOG (BY CC) ── */}
                {garageSubTab === 'services' && (
                  <View>
                    <View style={styles.toolbarRow}>
                      <View style={styles.searchInputBox}>
                        <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search service by name..."
                          placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                          value={garageSearchQuery}
                          onChangeText={setGarageSearchQuery}
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.addBtnPrimary}
                        onPress={openAddPmsRateModal}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                        <Text style={styles.addBtnPrimaryText}>+ Add Service</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {[
                        { key: 'all', label: 'All categories' },
                        { key: 'pms', label: 'PMS' },
                        { key: 'repair', label: 'Repair' },
                      ].map((chip) => {
                        const active = pmsCatalogCategoryFilter === chip.key;
                        return (
                          <TouchableOpacity
                            key={chip.key}
                            onPress={() => setPmsCatalogCategoryFilter(chip.key)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: active
                                ? isDarkMode
                                  ? tokens.accentBrand
                                  : '#EA580C'
                                : isDarkMode
                                  ? tokens.borderInput
                                  : '#E2E8F0',
                              backgroundColor: active
                                ? isDarkMode
                                  ? '#132A26'
                                  : '#EA580C'
                                : isDarkMode
                                  ? tokens.bgElevated
                                  : '#FFFFFF',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '500',
                                color: active ? '#FFFFFF' : isDarkMode ? tokens.textMuted : '#475569',
                              }}
                            >
                              {chip.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {[
                        { key: 'active', label: 'Active' },
                        { key: 'archived', label: 'Archived' },
                        { key: 'all', label: 'Any status' },
                      ].map((chip) => {
                        const active = pmsCatalogStatusFilter === chip.key;
                        return (
                          <TouchableOpacity
                            key={`st-${chip.key}`}
                            onPress={() => setPmsCatalogStatusFilter(chip.key)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: active
                                ? isDarkMode
                                  ? tokens.accentBrand
                                  : '#EA580C'
                                : isDarkMode
                                  ? tokens.borderInput
                                  : '#E2E8F0',
                              backgroundColor: active
                                ? isDarkMode
                                  ? '#132A26'
                                  : '#E8F0EC'
                                : isDarkMode
                                  ? tokens.bgElevated
                                  : '#FFFFFF',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: active
                                  ? isDarkMode
                                    ? '#FFFFFF'
                                    : '#EA580C'
                                  : isDarkMode
                                    ? tokens.textMuted
                                    : '#475569',
                              }}
                            >
                              {chip.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.tableCard}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={Platform.OS !== 'web'}
                        showsVerticalScrollIndicator={false}
                        dataSet={{ tableScroll: 'true' }}
                        style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'thin' } : {}) }}
                        contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                      >
                        <View style={{ width: '100%', minWidth: 1180, flexGrow: 1 }}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { flex: 0.4, minWidth: 40, textAlign: 'center' }]}>No.</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 180 }]}>Service</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.85, minWidth: 90 }]}>Category</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.05, minWidth: 110, textAlign: 'right' }]}>
                              Tier 1 (≤125)
                            </Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.05, minWidth: 110, textAlign: 'right' }]}>
                              Tier 2 (150–160)
                            </Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.05, minWidth: 110, textAlign: 'right' }]}>
                              Tier 3 (200+)
                            </Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.7, minWidth: 80, textAlign: 'center' }]}>
                              Status
                            </Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 130, textAlign: 'center' }]}>
                              Actions
                            </Text>
                          </View>

                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            nestedScrollEnabled={true}
                            dataSet={{ tableScroll: 'true' }}
                            style={{
                              maxHeight: 560,
                              width: '100%',
                              ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                            }}
                            contentContainerStyle={{ flexGrow: 1 }}
                          >
                            {pmsRateCatalog
                              .filter((srv) => {
                                const q = garageSearchQuery.trim().toLowerCase();
                                if (q && !String(srv.name || '').toLowerCase().includes(q)) return false;
                                if (pmsCatalogCategoryFilter === 'pms' && srv.catalogCategory !== 'PMS') return false;
                                if (pmsCatalogCategoryFilter === 'repair' && srv.catalogCategory !== 'Repair') return false;
                                if (pmsCatalogStatusFilter === 'active' && srv.isActive === false) return false;
                                if (pmsCatalogStatusFilter === 'archived' && srv.isActive !== false) return false;
                                return true;
                              })
                              .map((srv) => {
                                const renderRate = (categoryId) => {
                                  const raw = srv.prices?.[categoryId];
                                  if (raw == null) {
                                    return (
                                      <Text
                                        style={[
                                          styles.tableSub,
                                          {
                                            textAlign: 'right',
                                            fontWeight: '700',
                                            color: isDarkMode ? tokens.statusDangerText : '#B91C1C',
                                          },
                                        ]}
                                        numberOfLines={2}
                                      >
                                        Price not configured
                                      </Text>
                                    );
                                  }
                                  return (
                                    <Text
                                      style={[
                                        styles.tableTitle,
                                        {
                                          textAlign: 'right',
                                          color: isDarkMode ? tokens.money : '#EA580C',
                                        },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {formatPmsPhp(raw)}
                                    </Text>
                                  );
                                };

                                const active = srv.isActive !== false;
                                return (
                                  <View key={srv.id} style={[styles.tableRow, !active && { opacity: 0.55 }]}>
                                    <View style={{ flex: 0.4, minWidth: 40, justifyContent: 'center', paddingRight: 6 }}>
                                      <Text style={[styles.tableTitle, { textAlign: 'center' }]}>{srv.no}</Text>
                                    </View>
                                    <View style={{ flex: 2.0, minWidth: 180, paddingRight: 10, justifyContent: 'center' }}>
                                      <Text style={styles.tableTitle} numberOfLines={2}>
                                        {srv.name}
                                      </Text>
                                      <Text style={styles.tableSub} numberOfLines={1}>
                                        Labor only · parts separate
                                      </Text>
                                    </View>
                                    <View style={{ flex: 0.85, minWidth: 90, justifyContent: 'center', paddingRight: 6 }}>
                                      <Text style={[styles.tableSub, { fontWeight: '600' }]} numberOfLines={1}>
                                        {srv.catalogCategory === 'Repair' ? 'Repair' : 'PMS'}
                                      </Text>
                                    </View>
                                    <View style={{ flex: 1.05, minWidth: 110, paddingRight: 8, justifyContent: 'center' }}>
                                      {renderRate('cc-125-below')}
                                    </View>
                                    <View style={{ flex: 1.05, minWidth: 110, paddingRight: 8, justifyContent: 'center' }}>
                                      {renderRate('cc-150-160')}
                                    </View>
                                    <View style={{ flex: 1.05, minWidth: 110, paddingRight: 8, justifyContent: 'center' }}>
                                      {renderRate('cc-big-bikes')}
                                    </View>
                                    <View style={{ flex: 0.7, minWidth: 80, justifyContent: 'center', alignItems: 'center' }}>
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontWeight: '600',
                                          color: active
                                            ? isDarkMode
                                              ? tokens.accentBrand
                                              : '#166534'
                                            : isDarkMode
                                              ? tokens.textMuted
                                              : '#94A3B8',
                                        }}
                                      >
                                        {active ? 'Active' : 'Archived'}
                                      </Text>
                                    </View>
                                    <View
                                      style={{
                                        flex: 1.2,
                                        minWidth: 130,
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <TouchableOpacity
                                        style={[
                                          styles.tableOutlineBtn,
                                          pmsActionMenu?.service?.id === srv.id && {
                                            borderColor: isDarkMode ? tokens.accentBrand : '#EA580C',
                                            backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.12)' : '#FFF7ED',
                                          },
                                        ]}
                                        onPress={(e) => {
                                          if (pmsActionMenu?.service?.id === srv.id) {
                                            setPmsActionMenu(null);
                                            return;
                                          }
                                          const target = e?.currentTarget;
                                          if (target && typeof target.getBoundingClientRect === 'function') {
                                            const rect = target.getBoundingClientRect();
                                            setPmsActionMenu({
                                              service: srv,
                                              coords: {
                                                top: rect.bottom,
                                                right: rect.right,
                                                bottom: rect.bottom,
                                                left: rect.left,
                                              },
                                            });
                                          } else {
                                            setPmsActionMenu({ service: srv, coords: null });
                                          }
                                        }}
                                        activeOpacity={0.8}
                                      >
                                        <Text
                                          style={[
                                            styles.tableOutlineBtnText,
                                            pmsActionMenu?.service?.id === srv.id && {
                                              color: isDarkMode ? tokens.accentBrand : '#EA580C',
                                              fontWeight: '700',
                                            },
                                          ]}
                                        >
                                          Manage
                                        </Text>
                                        <BootstrapIcon
                                          name={pmsActionMenu?.service?.id === srv.id ? 'chevron-up' : 'chevron-down'}
                                          size={11}
                                          color={
                                            pmsActionMenu?.service?.id === srv.id
                                              ? (isDarkMode ? tokens.accentBrand : '#EA580C')
                                              : (isDarkMode ? tokens.textMuted : '#64748B')
                                          }
                                        />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                              })}
                          </ScrollView>

                          {/* ─── Manage Action Dropdown Menu (Rendered via Portal) ─── */}
                          {typeof document !== 'undefined' && pmsActionMenu && createPortal(
                            <View
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 999999,
                              }}
                            >
                              {/* Transparent Backdrop to close dropdown on click outside */}
                              <TouchableOpacity
                                activeOpacity={1}
                                onPress={() => setPmsActionMenu(null)}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  cursor: 'default',
                                }}
                              />

                              {/* Floating Menu Card */}
                              <View
                                style={{
                                  position: 'absolute',
                                  top: (pmsActionMenu.coords?.top || 100) + 4,
                                  left: Math.max(12, (pmsActionMenu.coords?.right || 160) - 150),
                                  width: 150,
                                  backgroundColor: isDarkMode ? '#1E2124' : '#FFFFFF',
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: isDarkMode ? '#374151' : '#E2E8F0',
                                  padding: 5,
                                  shadowColor: '#000000',
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: isDarkMode ? 0.45 : 0.12,
                                  shadowRadius: 12,
                                  elevation: 8,
                                  gap: 3,
                                  ...(Platform.OS === 'web'
                                    ? {
                                      boxShadow: isDarkMode
                                        ? '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
                                        : '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
                                    }
                                    : {}),
                                }}
                              >
                                {/* Edit Option */}
                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    paddingVertical: 8,
                                    paddingHorizontal: 10,
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (Platform.OS === 'web' && e?.currentTarget) {
                                      e.currentTarget.style.backgroundColor = isDarkMode
                                        ? 'rgba(255, 255, 255, 0.06)'
                                        : '#F1F5F9';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (Platform.OS === 'web' && e?.currentTarget) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                  }}
                                  onPress={() => {
                                    const srv = pmsActionMenu.service;
                                    setPmsActionMenu(null);
                                    openEditPmsRateModal(srv);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <BootstrapIcon name="pencil-square" size={13} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                                  <Text
                                    style={{
                                      fontSize: 12.5,
                                      fontWeight: '600',
                                      color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                    }}
                                  >
                                    Edit
                                  </Text>
                                </TouchableOpacity>

                                {/* Archive / Activate Option */}
                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    paddingVertical: 8,
                                    paddingHorizontal: 10,
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (Platform.OS === 'web' && e?.currentTarget) {
                                      e.currentTarget.style.backgroundColor = isDarkMode
                                        ? 'rgba(255, 255, 255, 0.06)'
                                        : (pmsActionMenu.service?.isActive === false ? '#F0FDF4' : '#FEF2F2');
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (Platform.OS === 'web' && e?.currentTarget) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                  }}
                                  onPress={() => {
                                    const srv = pmsActionMenu.service;
                                    setPmsActionMenu(null);
                                    handleTogglePmsServiceActive(srv);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <BootstrapIcon
                                    name={pmsActionMenu.service?.isActive === false ? 'check2-circle' : 'archive'}
                                    size={13}
                                    color={
                                      pmsActionMenu.service?.isActive === false
                                        ? (isDarkMode ? '#4ADE80' : '#16A34A')
                                        : (isDarkMode ? '#F87171' : '#DC2626')
                                    }
                                  />
                                  <Text
                                    style={{
                                      fontSize: 12.5,
                                      fontWeight: '600',
                                      color:
                                        pmsActionMenu.service?.isActive === false
                                          ? (isDarkMode ? '#4ADE80' : '#16A34A')
                                          : (isDarkMode ? '#F87171' : '#DC2626'),
                                    }}
                                  >
                                    {pmsActionMenu.service?.isActive === false ? 'Activate' : 'Archive'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>,
                            document.body
                          )}
                        </View>
                      </ScrollView>
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                        }}
                      >
                        <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                          {DEFAULT_CC_CATEGORIES.map((c) => c.name).join(' · ')}
                          {' · '}Labor rates use the motorcycle’s registered engine CC. Unconfigured prices cannot be booked.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {activeNav === 'mechanics' && (
              <View>
                {/* Technician Stats Cards */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Mechanics"
                    value={mechanicsStats.total}
                    sub="Certified Pit Bay Crew"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="On-Duty & Available"
                    value={mechanicsStats.available}
                    valueColor={isDarkMode ? tokens.accentBrand : "#EA580C"}
                    sub="Ready for Bay Assignment"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={mechanicsStats.busy > 0 ? 'amber' : 'teal'}
                    label="In Pit Bay (Servicing)"
                    value={mechanicsStats.busy}
                    valueColor={mechanicsStats.busy > 0 ? '#D97706' : undefined}
                    sub="Active Work Orders"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Master Techs"
                    value={mechanicsStats.masterCertified}
                    sub="OEM & Race Certified"
                    isDark={isDarkMode}
                  />
                </View>

                {/* Toolbar & Filter Bar */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon
                      name="search"
                      size={14}
                      color={isDarkMode ? tokens.textMuted : "#64748B"}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search technician by name, specialization, or certification..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      value={mechanicSearchQuery}
                      onChangeText={setMechanicSearchQuery}
                    />
                    {mechanicSearchQuery ? (
                      <TouchableOpacity onPress={() => setMechanicSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.addBtnPrimary}
                    onPress={handleOpenAddMechanic}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="person-plus-fill" size={15} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>+ Add Certified Technician</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter Status Dropdown & View Mode Switch */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    position: 'relative',
                    zIndex: isMechanicFilterDropdownOpen ? 99999 : 10,
                  }}
                >
                  {/* Technicians Status Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isMechanicFilterDropdownOpen ? 99999 : 10,
                    }}
                  >
                    {(() => {
                      const mechanicStatusOptions = [
                        { id: 'All', label: 'All Technicians', count: mechanicsStats.total, icon: 'people-fill', color: isDarkMode ? tokens.accentBrand : '#EA580C' },
                        { id: 'Available', label: 'Available on Duty', count: mechanicsStats.available, icon: 'check-circle-fill', color: isDarkMode ? tokens.statusSuccessText : '#16A34A' },
                        { id: 'In Pit Bay', label: 'Busy in Pit Bay', count: mechanicsStats.busy, icon: 'tools', color: isDarkMode ? tokens.statusWarningText : '#D97706' },
                      ];
                      const activeOpt = mechanicStatusOptions.find((o) => o.id === mechanicFilterStatus) || mechanicStatusOptions[0];

                      return (
                        <>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isMechanicFilterDropdownOpen
                                ? '#EA580C'
                                : mechanicFilterStatus !== 'All'
                                  ? '#EA580C'
                                  : isDarkMode ? tokens.borderInput : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 195,
                              cursor: 'pointer',
                              boxShadow: isMechanicFilterDropdownOpen
                                ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                                : '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                            onPress={() => setIsMechanicFilterDropdownOpen((prev) => !prev)}
                            activeOpacity={0.85}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <BootstrapIcon
                                name={activeOpt.icon}
                                size={13}
                                color={mechanicFilterStatus !== 'All' ? activeOpt.color : '#64748B'}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: mechanicFilterStatus !== 'All' ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: mechanicFilterStatus !== 'All' ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  marginLeft: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: mechanicFilterStatus !== 'All' ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
                                  }}
                                >
                                  {activeOpt.count}
                                </Text>
                              </View>
                            </View>
                            <BootstrapIcon
                              name={isMechanicFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={isMechanicFilterDropdownOpen ? '#EA580C' : '#64748B'}
                            />
                          </TouchableOpacity>

                          {/* Transparent backdrop for outside click */}
                          {isMechanicFilterDropdownOpen && (
                            <TouchableOpacity
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 99998,
                                backgroundColor: 'transparent',
                                cursor: 'default',
                              }}
                              onPress={() => setIsMechanicFilterDropdownOpen(false)}
                              activeOpacity={1}
                            />
                          )}

                          {/* Floating Dropdown Menu */}
                          {isMechanicFilterDropdownOpen && (
                            <View
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 6,
                                minWidth: 230,
                                backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                                zIndex: 99999,
                                padding: 6,
                                gap: 3,
                                maxHeight: 280,
                                overflowY: 'auto',
                              }}
                            >
                              {mechanicStatusOptions.map((option) => {
                                const isSelected = mechanicFilterStatus === option.id;
                                return (
                                  <TouchableOpacity
                                    key={option.id}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingHorizontal: 12,
                                      paddingVertical: 9,
                                      borderRadius: 9,
                                      backgroundColor: isSelected
                                        ? isDarkMode ? '#132A26' : '#E8F0EC'
                                        : 'transparent',
                                      cursor: 'pointer',
                                    }}
                                    onPress={() => {
                                      setMechanicFilterStatus(option.id);
                                      setIsMechanicFilterDropdownOpen(false);
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <BootstrapIcon
                                        name={option.icon}
                                        size={14}
                                        color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : option.color || (isDarkMode ? tokens.textMuted : '#64748B')}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '600' : '500',
                                          color: isSelected
                                            ? isDarkMode
                                              ? tokens.accentBrand
                                              : '#EA580C'
                                            : isDarkMode
                                              ? tokens.textSecondary
                                              : '#334155',
                                        }}
                                      >
                                        {option.label}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View
                                        style={{
                                          backgroundColor: isSelected
                                            ? '#EA580C'
                                            : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '600',
                                            color: isSelected ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
                                          }}
                                        >
                                          {option.count}
                                        </Text>
                                      </View>
                                      {isSelected && <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  {/* View Mode Toggle (List vs Grid) */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                      borderRadius: 8,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: mechanicViewMode === 'list' ? '#EA580C' : 'transparent',
                      }}
                      onPress={() => setMechanicViewMode('list')}
                    >
                      <BootstrapIcon
                        name="list-ul"
                        size={13}
                        color={mechanicViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: mechanicViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B',
                        }}
                      >
                        List
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: mechanicViewMode === 'grid' ? '#EA580C' : 'transparent',
                      }}
                      onPress={() => setMechanicViewMode('grid')}
                    >
                      <BootstrapIcon
                        name="grid"
                        size={12}
                        color={mechanicViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: mechanicViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B',
                        }}
                      >
                        Grid
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Empty State if no match */}
                {filteredMechanics.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      borderRadius: 14,
                      padding: 36,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="person-x" size={40} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: isDarkMode ? '#F1F5F9' : '#0F172A',
                        marginTop: 12,
                      }}
                    >
                      No technicians found
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: isDarkMode ? tokens.textMuted : '#64748B',
                        marginTop: 4,
                        marginBottom: 16,
                        textAlign: 'center',
                      }}
                    >
                      {mechanicSearchQuery
                        ? `No mechanic matches "${mechanicSearchQuery}"`
                        : 'Add your first certified technician to the garage roster.'}
                    </Text>
                    <TouchableOpacity
                      style={styles.addBtnPrimary}
                      onPress={handleOpenAddMechanic}
                    >
                      <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>+ Add New Mechanic</Text>
                    </TouchableOpacity>
                  </View>
                ) : mechanicViewMode === 'list' ? (
                  /* ─── LIST / TABLE VIEW ─── */
                  <View style={styles.tableCard}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      dataSet={{ tableScroll: 'true' }}
                      style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                      contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                    >
                      <View style={{ width: '100%', minWidth: 960, flexGrow: 1 }}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { flex: 2.3, minWidth: 200 }]}>Technician & ID</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 130, textAlign: 'center' }]}>Status</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 160 }]}>Specialization & Exp</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 140 }]}>Certifications</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 140, textAlign: 'center' }]}>Actions</Text>
                        </View>

                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          dataSet={{ tableScroll: 'true' }}
                          style={{
                            maxHeight: 560,
                            width: '100%',
                            ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                          }}
                          contentContainerStyle={{ flexGrow: 1 }}
                        >
                          {filteredMechanics.map((mech) => {
                            const activeJob = getActiveBookingForMechanic(mech);
                            const isBusy =
                              mech.status === 'In Pit Bay' ||
                              mechanicsStats.busyMechanicIds.has(mech.id) ||
                              Boolean(activeJob);

                            return (
                              <View key={mech.id} style={styles.tableRow}>
                                {/* Technician Profile */}
                                <View style={{ flex: 2.3, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                  <Image
                                    source={{ uri: mech.avatar }}
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 19,
                                      borderWidth: 1.5,
                                      borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                                      backgroundColor: '#E2E8F0',
                                    }}
                                  />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.tableTitle, { fontSize: 13.5 }]} numberOfLines={1}>
                                      {mech.name}
                                    </Text>
                                    <Text style={[styles.tableSub, { fontSize: 11 }]}>
                                      Display: {mech.shortName || mech.name} • ID: {mech.id}
                                    </Text>
                                  </View>
                                </View>

                                {/* Status */}
                                <View style={{ flex: 1.4, minWidth: 130, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                  <View
                                    style={[
                                      styles.tableStatusPill,
                                      {
                                        backgroundColor: isBusy
                                          ? isDarkMode
                                            ? 'rgba(245, 158, 11, 0.18)'
                                            : '#FEF3C7'
                                          : '#2E7D32',
                                        borderRadius: isBusy ? 999 : 6,
                                        ...(!isBusy
                                          ? {
                                            shadowColor: '#1B5E20',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.28,
                                            shadowRadius: 2,
                                            elevation: 2,
                                          }
                                          : null),
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.tableStatusPillText,
                                        {
                                          color: isBusy
                                            ? isDarkMode
                                              ? '#FBBF24'
                                              : '#B45309'
                                            : '#FFFFFF',
                                        },
                                      ]}
                                    >
                                      {isBusy ? 'In Pit Bay' : 'Available'}
                                    </Text>
                                  </View>
                                  <Text style={styles.tableStatusSub} numberOfLines={1}>
                                    {activeJob
                                      ? `Job #${activeJob.id || activeJob.booking_id}`
                                      : 'No active job'}
                                  </Text>
                                </View>

                                {/* Specialization & Experience */}
                                <View style={{ flex: 2.2, minWidth: 170 }}>
                                  <Text style={[styles.tableTitle, { fontSize: 12 }]} numberOfLines={1}>
                                    {mech.specialization || 'Performance Maintenance'}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    {mech.experience || '5+ Years Pro Tech'}
                                  </Text>
                                </View>

                                {/* Certifications */}
                                <View style={{ flex: 2, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <BootstrapIcon name="award-fill" size={13} color={isDarkMode ? tokens.statusPurpleText : "#8B5CF6"} />
                                  <Text
                                    style={[
                                      styles.tableSub,
                                      { color: isDarkMode ? '#CBD5E1' : '#334155', fontWeight: '600', flex: 1 },
                                    ]}
                                    numberOfLines={2}
                                  >
                                    {mech.certifications || 'Certified Tech'}
                                  </Text>
                                </View>

                                {/* Actions */}
                                <View
                                  style={{
                                    flex: 1.4,
                                    minWidth: 140,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    flexShrink: 0,
                                  }}
                                >
                                  <TouchableOpacity
                                    style={styles.tableOutlineBtn}
                                    onPress={() => handleOpenEditMechanic(mech)}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.tableOutlineBtnText}>Edit</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                    onPress={() => handleDeleteMechanic(mech)}
                                  >
                                    <BootstrapIcon name="trash3" size={14} color={isDarkMode ? tokens.statusDangerText : '#DC2626'} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </ScrollView>
                  </View>
                ) : (
                  /* ─── GRID VIEW ─── */
                  <View style={styles.mechanicsGrid}>
                    {filteredMechanics.map((mech) => {
                      const activeJob = getActiveBookingForMechanic(mech);
                      const isBusy =
                        mech.status === 'In Pit Bay' ||
                        mechanicsStats.busyMechanicIds.has(mech.id) ||
                        Boolean(activeJob);

                      return (
                        <View key={mech.id} style={styles.mechanicCard}>
                          {/* Header: Avatar + Name + Status */}
                          <View style={styles.mechanicCardHeader}>
                            <Image
                              source={{ uri: mech.avatar }}
                              style={styles.mechanicAvatar}
                            />
                            <View style={styles.mechanicHeaderInfo}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 6,
                                  marginBottom: 4,
                                }}
                              >
                                <View
                                  style={[
                                    styles.mechanicStatusBadge,
                                    isBusy
                                      ? styles.mechanicStatusBusy
                                      : styles.mechanicStatusAvailable,
                                  ]}
                                >
                                  <View
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 3,
                                      backgroundColor: isBusy ? '#D97706' : '#10B981',
                                    }}
                                  />
                                  <Text
                                    style={
                                      isBusy
                                        ? styles.mechanicStatusBusyText
                                        : styles.mechanicStatusAvailableText
                                    }
                                  >
                                    {isBusy ? 'In Pit Bay' : 'Available'}
                                  </Text>
                                </View>

                                <Text
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: '700',
                                    color: isDarkMode ? '#64748B' : '#94A3B8',
                                  }}
                                >
                                  ID: {mech.id}
                                </Text>
                              </View>

                              <Text style={styles.mechanicName} numberOfLines={2}>
                                {mech.name}
                              </Text>
                              <Text style={styles.mechanicShortName}>
                                Display: {mech.shortName || mech.name}
                              </Text>
                            </View>
                          </View>

                          {/* Specialization & Credentials */}
                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon
                              name="lightning-charge-fill"
                              size={12}
                              color={isDarkMode ? tokens.statusWarningText : "#F59E0B"}
                            />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {mech.specialization || 'Performance Maintenance'}
                            </Text>
                          </View>

                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="award-fill" size={12} color={isDarkMode ? tokens.statusPurpleText : "#8B5CF6"} />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {mech.certifications || 'Certified Master Tech'}
                            </Text>
                          </View>

                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="clock-history" size={12} color={isDarkMode ? tokens.statusInfoText : "#3B82F6"} />
                            <Text style={styles.mechanicInfoText}>
                              {mech.experience || '5+ Years Pro Tech'}
                            </Text>
                          </View>

                          {/* Active Work Order Callout if busy */}
                          {activeJob && (
                            <View style={styles.mechanicActiveBookingBanner}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  marginBottom: 2,
                                }}
                              >
                                <BootstrapIcon name="tools" size={12} color="#B45309" />
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: '600',
                                    color: isDarkMode ? tokens.statusWarningText : '#B45309',
                                  }}
                                >
                                  Active Job: #{activeJob.id || activeJob.booking_id}
                                </Text>
                              </View>
                              <Text style={styles.mechanicActiveBookingText} numberOfLines={1}>
                                {activeJob.service_title || 'Motorcycle Service'} •{' '}
                                {activeJob.customer_name || activeJob.userName || 'Customer'}
                              </Text>
                            </View>
                          )}

                          {/* Action Footer */}
                          <View style={styles.mechanicCardFooter}>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                              }}
                              onPress={() => handleOpenEditMechanic(mech)}
                            >
                              <BootstrapIcon
                                name="pencil-square"
                                size={12}
                                color={isDarkMode ? tokens.textMuted : '#475569'}
                              />
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: '700',
                                  color: isDarkMode ? '#E2E8F0' : '#475569',
                                }}
                              >
                                Edit Details
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isDarkMode ? tokens.chipBorder : '#FCA5A5',
                                backgroundColor: isDarkMode ? tokens.statusDangerBg : '#FEF2F2',
                              }}
                              onPress={() => handleDeleteMechanic(mech)}
                            >
                              <BootstrapIcon name="trash3-fill" size={12} color={isDarkMode ? tokens.statusDangerText : "#DC2626"} />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? tokens.statusDangerText : '#DC2626' }}>
                                Remove
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ─── TAB: RIDERS / DELIVERY STAFF ─── */}
            {activeNav === 'riders' && (
              <View>
                {/* 1. Rider KPI Stats Telemetry Grid */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Delivery Fleet"
                    value={riderStats.total}
                    sub={`${riderStats.active} active accounts enrolled`}
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="Available on Duty"
                    value={riderStats.available}
                    valueColor={isDarkMode ? tokens.statusSuccessText : "#10B981"}
                    sub="Ready for dispatch"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={riderStats.onDelivery > 0 ? 'amber' : 'teal'}
                    label="On Delivery"
                    value={riderStats.onDelivery}
                    valueColor={riderStats.onDelivery > 0 ? '#D97706' : undefined}
                    sub="Currently fulfilling orders"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Fleet Earnings"
                    value={`₱${riderStats.totalEarnings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    valueColor={isDarkMode ? tokens.accentBrand : "#EA580C"}
                    sub="Shipping fee revenue pool"
                    isDark={isDarkMode}
                  />
                </View>

                {/* 2. Toolbar: Search Input + Add Rider Button */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search rider by name, phone, email, vehicle, or plate..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      value={riderSearchQuery}
                      onChangeText={setRiderSearchQuery}
                    />
                    {riderSearchQuery ? (
                      <TouchableOpacity onPress={() => setRiderSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.addBtnPrimary}
                    onPress={handleOpenAddRider}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="person-plus-fill" size={15} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>+ Add Rider</Text>
                  </TouchableOpacity>
                </View>

                {/* 3. Filter Category Dropdown & View Mode Switcher (List vs Grid) */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    position: 'relative',
                    zIndex: isRiderFilterDropdownOpen ? 99999 : 10,
                  }}
                >
                  {/* Category Status Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isRiderFilterDropdownOpen ? 99999 : 10,
                    }}
                  >
                    {(() => {
                      const riderCategoryOptions = [
                        { id: 'All', label: 'All Riders', count: riderStats.total, icon: 'people-fill', color: isDarkMode ? tokens.accentBrand : '#EA580C' },
                        { id: RIDER_ACCOUNT_STATUSES.ACTIVE, label: 'Active Fleet', count: riderStats.active, icon: 'shield-check', color: isDarkMode ? tokens.statusSuccessText : '#10B981' },
                        { id: RIDER_ACCOUNT_STATUSES.INACTIVE, label: 'Inactive Riders', count: riderStats.inactive, icon: 'shield-slash', color: isDarkMode ? tokens.textMuted : '#64748B' },
                        { id: RIDER_STATUSES.AVAILABLE, label: 'Available on Duty', count: riderStats.available, icon: 'check-circle-fill', color: isDarkMode ? tokens.statusSuccessText : '#16A34A' },
                        { id: RIDER_STATUSES.ON_DELIVERY, label: 'On Delivery', count: riderStats.onDelivery, icon: 'box-seam-fill', color: isDarkMode ? tokens.statusWarningText : '#D97706' },
                        { id: RIDER_STATUSES.OFF_DUTY, label: 'Off Duty', count: riderStats.offDuty, icon: 'moon-fill', color: isDarkMode ? tokens.textMuted : '#64748B' },
                      ];
                      const activeOpt = riderCategoryOptions.find((o) => o.id === riderFilterStatus) || riderCategoryOptions[0];

                      return (
                        <>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isRiderFilterDropdownOpen
                                ? '#EA580C'
                                : riderFilterStatus !== 'All'
                                  ? '#EA580C'
                                  : isDarkMode ? tokens.borderInput : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 210,
                              cursor: 'pointer',
                              boxShadow: isRiderFilterDropdownOpen
                                ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                                : '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                            onPress={() => setIsRiderFilterDropdownOpen((prev) => !prev)}
                            activeOpacity={0.85}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <BootstrapIcon
                                name={activeOpt.icon}
                                size={14}
                                color={riderFilterStatus !== 'All' ? activeOpt.color : '#64748B'}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: riderFilterStatus !== 'All' ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: riderFilterStatus !== 'All' ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: riderFilterStatus !== 'All' ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
                                  }}
                                >
                                  {activeOpt.count}
                                </Text>
                              </View>
                            </View>
                            <BootstrapIcon
                              name={isRiderFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={isRiderFilterDropdownOpen ? '#EA580C' : '#64748B'}
                            />
                          </TouchableOpacity>

                          {/* Backdrop for outside click */}
                          {isRiderFilterDropdownOpen && (
                            <TouchableOpacity
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 99998,
                                backgroundColor: 'transparent',
                                cursor: 'default',
                              }}
                              onPress={() => setIsRiderFilterDropdownOpen(false)}
                              activeOpacity={1}
                            />
                          )}

                          {/* Floating Dropdown Menu */}
                          {isRiderFilterDropdownOpen && (
                            <View
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 6,
                                minWidth: 240,
                                backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                                zIndex: 99999,
                                padding: 6,
                                gap: 3,
                                maxHeight: 300,
                                overflowY: 'auto',
                              }}
                            >
                              {riderCategoryOptions.map((option) => {
                                const isSelected = riderFilterStatus === option.id;
                                return (
                                  <TouchableOpacity
                                    key={option.id}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingHorizontal: 12,
                                      paddingVertical: 9,
                                      borderRadius: 9,
                                      backgroundColor: isSelected
                                        ? isDarkMode ? '#132A26' : '#E8F0EC'
                                        : 'transparent',
                                      cursor: 'pointer',
                                    }}
                                    onPress={() => {
                                      setRiderFilterStatus(option.id);
                                      setIsRiderFilterDropdownOpen(false);
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <BootstrapIcon
                                        name={option.icon}
                                        size={14}
                                        color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : option.color || (isDarkMode ? tokens.textMuted : '#64748B')}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '600' : '500',
                                          color: isSelected
                                            ? isDarkMode
                                              ? tokens.accentBrand
                                              : '#EA580C'
                                            : isDarkMode
                                              ? tokens.textSecondary
                                              : '#334155',
                                        }}
                                      >
                                        {option.label}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View
                                        style={{
                                          backgroundColor: isSelected
                                            ? '#EA580C'
                                            : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '600',
                                            color: isSelected ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
                                          }}
                                        >
                                          {option.count}
                                        </Text>
                                      </View>
                                      {isSelected && <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  {/* View Mode Toggle (List vs Grid) */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                      borderRadius: 8,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: riderViewMode === 'list' ? '#EA580C' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onPress={() => setRiderViewMode('list')}
                    >
                      <BootstrapIcon
                        name="list-ul"
                        size={13}
                        color={riderViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: riderViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B',
                        }}
                      >
                        List
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: riderViewMode === 'grid' ? '#EA580C' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onPress={() => setRiderViewMode('grid')}
                    >
                      <BootstrapIcon
                        name="grid"
                        size={12}
                        color={riderViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: riderViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B',
                        }}
                      >
                        Grid
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 4. Content Area: Empty State vs List vs Grid */}
                {filteredRiders.length === 0 ? (
                  <View
                    style={{
                      alignItems: 'center',
                      paddingVertical: 48,
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="bicycle" size={32} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F1F5F9' : '#0F172A', marginTop: 10 }}>
                      No riders found
                    </Text>
                    <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#94A3B8', marginTop: 4, marginBottom: 16 }}>
                      {riderSearchQuery
                        ? `No matches for "${riderSearchQuery}"`
                        : 'Add your first delivery rider to the fleet.'}
                    </Text>
                    <TouchableOpacity style={styles.addBtnPrimary} onPress={handleOpenAddRider}>
                      <BootstrapIcon name="person-plus-fill" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>+ Add Rider</Text>
                    </TouchableOpacity>
                  </View>
                ) : riderViewMode === 'list' ? (
                  /* ─── LIST (TABLE) VIEW ─── */
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    dataSet={{ tableScroll: 'true' }}
                    style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={[styles.tableCard, { width: '100%', minWidth: '100%', flexGrow: 1 }]}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 2.3, minWidth: 200 }]}>Rider & Contact</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 160 }]}>Vehicle & Plate</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 130, textAlign: 'center' }]}>Duty Status</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 120 }]}>Earnings</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 120, textAlign: 'center' }]}>Actions</Text>
                      </View>

                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        dataSet={{ tableScroll: 'true' }}
                        style={{
                          maxHeight: 560,
                          width: '100%',
                          ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                        }}
                        contentContainerStyle={{ flexGrow: 1 }}
                      >
                        {filteredRiders.map((rider) => {
                          const statusColor =
                            rider.status === RIDER_STATUSES.AVAILABLE
                              ? { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC', dot: '#10B981', icon: 'check-circle-fill' }
                              : rider.status === RIDER_STATUSES.ON_DELIVERY
                                ? { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D', dot: '#F59E0B', icon: 'box-seam-fill' }
                                : { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', dot: '#94A3B8', icon: 'moon-fill' };

                          const isInactive = (rider.accountStatus || 'Active') === RIDER_ACCOUNT_STATUSES.INACTIVE;

                          return (
                            <View key={rider.id} style={styles.tableRow}>
                              <View style={{ flex: 2.3, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 8 }}>
                                <View style={{ position: 'relative' }}>
                                  <Image
                                    source={{ uri: rider.avatar || RIDER_AVATAR_PRESETS[0] }}
                                    style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: 20,
                                      borderWidth: 1.5,
                                      borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                                      backgroundColor: '#E2E8F0',
                                    }}
                                  />
                                  <View
                                    style={{
                                      position: 'absolute',
                                      bottom: -1,
                                      right: -1,
                                      width: 12,
                                      height: 12,
                                      borderRadius: 6,
                                      backgroundColor: statusColor.dot,
                                      borderWidth: 2,
                                      borderColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                    }}
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {rider.name}
                                    {rider.username ? ` · @${rider.username}` : ''}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    {rider.phone || 'No phone'}
                                    {isInactive ? ' · Inactive account' : ''}
                                  </Text>
                                </View>
                              </View>

                              <View style={{ flex: 1.8, minWidth: 160, paddingRight: 8 }}>
                                <Text style={styles.tableTitle} numberOfLines={1}>
                                  {rider.vehicleInfo || 'No vehicle assigned'}
                                </Text>
                                <Text
                                  style={[
                                    styles.tableSub,
                                    { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {rider.plateNumber || 'NO PLATE'}
                                </Text>
                              </View>

                              <View style={{ flex: 1.5, minWidth: 130, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  onPress={() => handleToggleRiderStatus(rider)}
                                  style={[
                                    styles.tableStatusPill,
                                    {
                                      backgroundColor: statusColor.bg,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                    },
                                  ]}
                                  activeOpacity={0.8}
                                >
                                  <BootstrapIcon name={statusColor.icon} size={11} color={statusColor.text} />
                                  <Text style={[styles.tableStatusPillText, { color: statusColor.text }]}>
                                    {rider.status || RIDER_STATUSES.AVAILABLE}
                                  </Text>
                                </TouchableOpacity>
                                <Text style={styles.tableStatusSub}>Tap to toggle</Text>
                              </View>

                              <View style={{ flex: 1.4, minWidth: 120, paddingRight: 8 }}>
                                <Text
                                  style={[
                                    styles.tableTitle,
                                    { color: isDarkMode ? tokens.money : '#EA580C' },
                                  ]}
                                  numberOfLines={1}
                                >
                                  ₱{Number(rider.totalEarnings || 0).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </Text>
                                <Text style={styles.tableSub} numberOfLines={1}>
                                  From shipping
                                </Text>
                              </View>

                              <View style={{ flex: 1.3, minWidth: 120, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                                <TouchableOpacity
                                  style={styles.tableOutlineBtn}
                                  onPress={() => handleOpenEditRider(rider)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.tableOutlineBtnText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionIconBtn]}
                                  onPress={() =>
                                    setRiderAccessModal({
                                      rider,
                                      bundle: null,
                                    })
                                  }
                                >
                                  <BootstrapIcon name="geo-alt-fill" size={13} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                  onPress={() => handleDeleteRider(rider)}
                                >
                                  <BootstrapIcon name="trash3" size={14} color={isDarkMode ? tokens.statusDangerText : '#EF4444'} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </ScrollView>
                ) : (
                  /* ─── GRID (CARD) VIEW ─── */
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                    {filteredRiders.map((rider) => (
                      <RiderProfileCard
                        key={rider.id}
                        rider={rider}
                        isDarkMode={isDarkMode}
                        onToggleStatus={handleToggleRiderStatus}
                        onOpenLiveMap={(r) => setRiderAccessModal({ rider: r, bundle: null })}
                        onEdit={handleOpenEditRider}
                        onDelete={handleDeleteRider}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ─── TAB: SUPPLIERS & VENDORS MANAGEMENT ─── */}
            {activeNav === 'suppliers' && (
              <View>
                {/* Live Database Sync Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isDarkMode ? '#0F2922' : '#F0FDF9',
                    borderColor: isDarkMode ? '#063D37' : '#99F6E4',
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: isDarkMode ? '#EA580C' : '#10B981',
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isDarkMode ? '#5EEAD4' : '#143325',
                      }}
                    >
                      Live Database Connected (Supabase public.suppliers)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      backgroundColor: isDarkMode ? '#134E48' : '#FED7AA',
                    }}
                    onPress={async () => {
                      try {
                        setIsSuppliersLoading(true);
                        const fresh = await supplierService.fetchSuppliers();
                        setSuppliers(fresh || []);
                        showToast('✓ Suppliers synced from database');
                      } finally {
                        setIsSuppliersLoading(false);
                      }
                    }}
                    disabled={isSuppliersLoading}
                  >
                    <BootstrapIcon name="arrow-clockwise" size={13} color="#143325" />
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: isDarkMode ? '#5EEAD4' : '#143325',
                      }}
                    >
                      {isSuppliersLoading ? 'Syncing...' : 'Sync with DB'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Supplier Stats Telemetry */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Suppliers"
                    value={supplierStats.total}
                    sub="Catalogued Part Vendors"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="Active Sourcing"
                    value={supplierStats.active}
                    valueColor={isDarkMode ? tokens.accentBrand : "#EA580C"}
                    sub="Fulfilling Purchase Orders"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={supplierStats.pending > 0 ? 'amber' : 'teal'}
                    label="Pending Review"
                    value={supplierStats.pending}
                    valueColor={supplierStats.pending > 0 ? '#D97706' : undefined}
                    sub="Onboarding Contracts"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Top Rated Partners"
                    value={supplierStats.topRated}
                    sub="4.8+ Quality Score"
                    isDark={isDarkMode}
                  />
                </View>

                {/* Toolbar & Search Bar */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon
                      name="search"
                      size={14}
                      color={isDarkMode ? tokens.textMuted : "#64748B"}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search supplier by company, contact person, category, address..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      value={supplierSearchQuery}
                      onChangeText={setSupplierSearchQuery}
                    />
                    {supplierSearchQuery ? (
                      <TouchableOpacity onPress={() => setSupplierSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.addBtnPrimary}
                    onPress={handleOpenAddSupplier}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="plus-lg" size={15} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>Add New Supplier</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter Status Dropdown & View Mode Switch */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    position: 'relative',
                    zIndex: isSupplierFilterDropdownOpen ? 99999 : 10,
                  }}
                >
                  {/* Suppliers Status Filter Dropdown */}
                  <View
                    style={{
                      position: 'relative',
                      zIndex: isSupplierFilterDropdownOpen ? 99999 : 10,
                    }}
                  >
                    {(() => {
                      const supplierStatusOptions = [
                        { id: 'All', label: 'All Suppliers', count: supplierStats.total, icon: 'building', color: isDarkMode ? tokens.accentBrand : '#EA580C' },
                        { id: 'Active', label: 'Active Partners', count: supplierStats.active, icon: 'check-circle-fill', color: isDarkMode ? tokens.statusSuccessText : '#16A34A' },
                        { id: 'Pending', label: 'Pending Review', count: supplierStats.pending, icon: 'hourglass-split', color: isDarkMode ? tokens.statusWarningText : '#D97706', highlight: supplierStats.pending > 0 },
                        { id: 'Inactive', label: 'Inactive / On Hold', count: supplierStats.inactive, icon: 'pause-circle-fill', color: isDarkMode ? tokens.textMuted : '#64748B' },
                      ];
                      const activeOpt = supplierStatusOptions.find((o) => o.id === supplierFilterStatus) || supplierStatusOptions[0];

                      return (
                        <>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isSupplierFilterDropdownOpen
                                ? '#EA580C'
                                : activeOpt.highlight
                                  ? '#F59E0B'
                                  : supplierFilterStatus !== 'All'
                                    ? '#EA580C'
                                    : isDarkMode ? tokens.borderInput : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 185,
                              cursor: 'pointer',
                              boxShadow: isSupplierFilterDropdownOpen
                                ? '0 6px 20px -2px rgba(234, 88, 12, 0.2)'
                                : '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                            onPress={() => setIsSupplierFilterDropdownOpen((prev) => !prev)}
                            activeOpacity={0.85}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <BootstrapIcon
                                name={activeOpt.icon}
                                size={13}
                                color={
                                  activeOpt.highlight
                                    ? '#D97706'
                                    : supplierFilterStatus !== 'All'
                                      ? activeOpt.color
                                      : '#64748B'
                                }
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color:
                                    activeOpt.highlight
                                      ? '#B45309'
                                      : supplierFilterStatus !== 'All'
                                        ? '#EA580C'
                                        : isDarkMode ? tokens.textPrimary : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor:
                                    activeOpt.highlight
                                      ? '#FEF3C7'
                                      : supplierFilterStatus !== 'All'
                                        ? '#EA580C'
                                        : isDarkMode ? tokens.borderInput : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  marginLeft: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color:
                                      activeOpt.highlight
                                        ? '#B45309'
                                        : supplierFilterStatus !== 'All'
                                          ? '#FFFFFF'
                                          : isDarkMode ? '#CBD5E1' : '#475569',
                                  }}
                                >
                                  {activeOpt.count}
                                </Text>
                              </View>
                            </View>
                            <BootstrapIcon
                              name={isSupplierFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={isSupplierFilterDropdownOpen ? '#EA580C' : '#64748B'}
                            />
                          </TouchableOpacity>

                          {/* Transparent backdrop for outside click */}
                          {isSupplierFilterDropdownOpen && (
                            <TouchableOpacity
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 99998,
                                backgroundColor: 'transparent',
                                cursor: 'default',
                              }}
                              onPress={() => setIsSupplierFilterDropdownOpen(false)}
                              activeOpacity={1}
                            />
                          )}

                          {/* Floating Dropdown Menu */}
                          {isSupplierFilterDropdownOpen && (
                            <View
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 6,
                                minWidth: 230,
                                backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                                boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                                zIndex: 99999,
                                padding: 6,
                                gap: 3,
                                maxHeight: 280,
                                overflowY: 'auto',
                              }}
                            >
                              {supplierStatusOptions.map((option) => {
                                const isSelected = supplierFilterStatus === option.id;
                                return (
                                  <TouchableOpacity
                                    key={option.id}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingHorizontal: 12,
                                      paddingVertical: 9,
                                      borderRadius: 9,
                                      backgroundColor: isSelected
                                        ? isDarkMode ? '#132A26' : '#E8F0EC'
                                        : 'transparent',
                                      cursor: 'pointer',
                                    }}
                                    onPress={() => {
                                      setSupplierFilterStatus(option.id);
                                      setIsSupplierFilterDropdownOpen(false);
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <BootstrapIcon
                                        name={option.icon}
                                        size={14}
                                        color={isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : option.color || (isDarkMode ? tokens.textMuted : '#64748B')}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '600' : '500',
                                          color: isSelected
                                            ? isDarkMode
                                              ? tokens.accentBrand
                                              : '#EA580C'
                                            : isDarkMode
                                              ? tokens.textSecondary
                                              : '#334155',
                                        }}
                                      >
                                        {option.label}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View
                                        style={{
                                          backgroundColor: option.highlight
                                            ? isDarkMode
                                              ? 'rgba(251, 191, 36, 0.2)'
                                              : '#FEF3C7'
                                            : isSelected
                                              ? isDarkMode
                                                ? 'rgba(16, 185, 129, 0.22)'
                                                : '#EA580C'
                                              : isDarkMode
                                                ? tokens.bgSub
                                                : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '600',
                                            color: option.highlight
                                              ? isDarkMode
                                                ? tokens.statusWarningText
                                                : '#B45309'
                                              : isSelected
                                                ? isDarkMode
                                                  ? tokens.accentBrand
                                                  : '#FFFFFF'
                                                : isDarkMode
                                                  ? tokens.textMuted
                                                  : '#475569',
                                          }}
                                        >
                                          {option.count}
                                        </Text>
                                      </View>
                                      {isSelected && <BootstrapIcon name="check2" size={14} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </>
                      );
                    })()}
                  </View>

                  {/* View Mode Toggle (List vs Grid) */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                      borderRadius: 8,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: supplierViewMode === 'list' ? '#EA580C' : 'transparent',
                      }}
                      onPress={() => setSupplierViewMode('list')}
                    >
                      <BootstrapIcon
                        name="list-ul"
                        size={13}
                        color={supplierViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: supplierViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B',
                        }}
                      >
                        List
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: supplierViewMode === 'grid' ? '#EA580C' : 'transparent',
                      }}
                      onPress={() => setSupplierViewMode('grid')}
                    >
                      <BootstrapIcon
                        name="grid"
                        size={12}
                        color={supplierViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: supplierViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B',
                        }}
                      >
                        Grid
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Loading State or Empty State */}
                {isSuppliersLoading ? (
                  <View style={styles.tableCard}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.2, minWidth: 190 }]}>Supplier & Contact</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 130 }]}>Category & Lead Time</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 170 }]}>Contact & Address</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 120, textAlign: 'center' }]}>Status</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 120, textAlign: 'center' }]}>Actions</Text>
                    </View>
                    {[1, 2, 3, 4, 5].map((k) => (
                      <View
                        key={k}
                        style={[
                          styles.tableRow,
                          {
                            borderBottomColor: isDarkMode ? tokens.borderLight : '#F1F5F9',
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                          },
                        ]}
                      >
                        <View style={{ flex: 2.2, minWidth: 190, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Skeleton circle size={36} />
                          <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width="75%" height={14} borderRadius={4} />
                            <Skeleton width="45%" height={10} borderRadius={3} />
                          </View>
                        </View>
                        <View style={{ flex: 1.5, minWidth: 130, gap: 4 }}>
                          <Skeleton width={80} height={20} borderRadius={6} />
                          <Skeleton width={50} height={10} borderRadius={3} />
                        </View>
                        <View style={{ flex: 2.0, minWidth: 170, gap: 4 }}>
                          <Skeleton width="85%" height={12} borderRadius={3} />
                          <Skeleton width="60%" height={10} borderRadius={3} />
                        </View>
                        <View style={{ flex: 1.4, minWidth: 120, alignItems: 'center' }}>
                          <Skeleton width={70} height={22} borderRadius={6} />
                        </View>
                        <View style={{ flex: 1.3, minWidth: 120, alignItems: 'center' }}>
                          <Skeleton width={56} height={26} borderRadius={6} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : filteredSuppliers.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      borderRadius: 14,
                      padding: 36,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="truck" size={40} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: isDarkMode ? '#F1F5F9' : '#0F172A',
                        marginTop: 12,
                      }}
                    >
                      {supplierSearchQuery ? 'No matching suppliers found' : 'No suppliers in database'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: isDarkMode ? tokens.textMuted : '#64748B',
                        marginTop: 4,
                        marginBottom: 16,
                        textAlign: 'center',
                        maxWidth: 440,
                      }}
                    >
                      {supplierSearchQuery
                        ? `No supplier in the database matches "${supplierSearchQuery}"`
                        : 'Your supplier directory is connected directly to Supabase. Register your first vendor or manufacturing partner to populate the database.'}
                    </Text>
                    <TouchableOpacity
                      style={styles.addBtnPrimary}
                      onPress={handleOpenAddSupplier}
                    >
                      <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>Add New Supplier</Text>
                    </TouchableOpacity>
                  </View>
                ) : supplierViewMode === 'list' ? (
                  /* ─── LIST / TABLE VIEW ─── */
                  <View style={styles.tableCard}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      dataSet={{ tableScroll: 'true' }}
                      style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                      contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                    >
                      <View style={{ width: '100%', minWidth: 1040, flexGrow: 1 }}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { flex: 2.2, minWidth: 190 }]}>Supplier & Contact</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 130 }]}>Category & Lead Time</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 170 }]}>Contact & Address</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 120, textAlign: 'center' }]}>Status</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 120, textAlign: 'center' }]}>Actions</Text>
                        </View>

                        <ScrollView
                          showsVerticalScrollIndicator={false}
                          showsHorizontalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          dataSet={{ tableScroll: 'true' }}
                          style={{
                            maxHeight: 560,
                            width: '100%',
                            ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                          }}
                          contentContainerStyle={{ flexGrow: 1 }}
                        >
                          {filteredSuppliers.map((sup) => {
                            const supId = sup.supplier_id || sup.id;
                            const status = sup.status || 'Active';
                            const isActive = status.toLowerCase() === 'active';
                            const isPending = status.toLowerCase() === 'pending';

                            return (
                              <View key={supId} style={styles.tableRow}>
                                <View style={{ flex: 2.2, minWidth: 190, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 8 }}>
                                  <View
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 10,
                                      backgroundColor: isDarkMode ? '#1E293B' : '#FFF7ED',
                                      borderWidth: 1.5,
                                      borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <BootstrapIcon name="building" size={18} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.tableTitle} numberOfLines={1}>
                                      {sup.name}
                                    </Text>
                                    <Text style={styles.tableSub} numberOfLines={1}>
                                      {sup.contact_person || 'Purchasing Rep'} · ★ {sup.rating || '5.0'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={{ flex: 1.5, minWidth: 130, paddingRight: 8 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {sup.categories || 'Exhaust & Performance'}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    Lead {sup.lead_time || '3-5 Days'}
                                  </Text>
                                </View>

                                <View style={{ flex: 2.0, minWidth: 170, paddingRight: 8 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {sup.email || sup.phone || 'No contact'}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    {sup.address || (sup.phone && sup.email ? sup.phone : 'No address')}
                                  </Text>
                                </View>

                                <View style={{ flex: 1.4, minWidth: 120, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                  <View
                                    style={[
                                      styles.tableStatusPill,
                                      {
                                        backgroundColor: isActive
                                          ? '#2E7D32'
                                          : isPending
                                            ? isDarkMode
                                              ? 'rgba(245, 158, 11, 0.18)'
                                              : '#FEF3C7'
                                            : isDarkMode
                                              ? tokens.badgeNeutralBg
                                              : '#F1F5F9',
                                        borderRadius: isActive ? 6 : 999,
                                        ...(isActive
                                          ? {
                                            shadowColor: '#1B5E20',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.28,
                                            shadowRadius: 2,
                                            elevation: 2,
                                          }
                                          : null),
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.tableStatusPillText,
                                        {
                                          color: isActive
                                            ? '#FFFFFF'
                                            : isPending
                                              ? isDarkMode
                                                ? '#FBBF24'
                                                : '#B45309'
                                              : isDarkMode
                                                ? tokens.badgeNeutralText
                                                : '#334155',
                                        },
                                      ]}
                                    >
                                      {status}
                                    </Text>
                                  </View>
                                  <Text style={styles.tableStatusSub} numberOfLines={1}>
                                    {isActive ? 'Approved vendor' : isPending ? 'Awaiting review' : 'Inactive'}
                                  </Text>
                                </View>

                                <View
                                  style={{
                                    flex: 1.3,
                                    minWidth: 120,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    flexShrink: 0,
                                  }}
                                >
                                  <TouchableOpacity
                                    style={styles.tableOutlineBtn}
                                    onPress={() => handleOpenEditSupplier(sup)}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.tableOutlineBtnText}>Edit</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                    onPress={() => handleDeleteSupplier(sup)}
                                  >
                                    <BootstrapIcon name="trash3" size={14} color={isDarkMode ? tokens.statusDangerText : '#DC2626'} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </ScrollView>
                  </View>
                ) : (
                  /* ─── GRID VIEW ─── */
                  <View style={styles.mechanicsGrid}>
                    {filteredSuppliers.map((sup) => {
                      const supId = sup.supplier_id || sup.id;
                      const status = sup.status || 'Active';
                      const isActive = status.toLowerCase() === 'active';
                      const isPending = status.toLowerCase() === 'pending';

                      return (
                        <View key={supId} style={styles.mechanicCard}>
                          {/* Card Header: Icon + Info + Status */}
                          <View style={styles.mechanicCardHeader}>
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFF7ED',
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <BootstrapIcon name="truck" size={20} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                            </View>
                            <View style={styles.mechanicHeaderInfo}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 6,
                                  marginBottom: 4,
                                }}
                              >
                                <View
                                  style={[
                                    styles.mechanicStatusBadge,
                                    isActive
                                      ? styles.mechanicStatusAvailable
                                      : isPending
                                        ? styles.mechanicStatusBusy
                                        : { backgroundColor: isDarkMode ? tokens.borderInput : '#F1F5F9', borderColor: '#94A3B8' },
                                  ]}
                                >
                                  <View
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 3,
                                      backgroundColor: isActive ? '#10B981' : isPending ? '#D97706' : '#94A3B8',
                                    }}
                                  />
                                  <Text
                                    style={
                                      isActive
                                        ? styles.mechanicStatusAvailableText
                                        : isPending
                                          ? styles.mechanicStatusBusyText
                                          : { fontSize: 10.5, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B' }
                                    }
                                  >
                                    {status}
                                  </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <BootstrapIcon name="star-fill" size={11} color={isDarkMode ? tokens.statusWarningText : "#F59E0B"} />
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '600',
                                      color: isDarkMode ? tokens.textPrimary : '#0F172A',
                                    }}
                                  >
                                    {sup.rating || '5.0'}
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.mechanicName} numberOfLines={2}>
                                {sup.name}
                              </Text>
                              <Text style={styles.mechanicShortName}>
                                Contact: {sup.contact_person || 'Purchasing Rep'}
                              </Text>
                            </View>
                          </View>

                          {/* Category Badge & Lead Time */}
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginVertical: 10,
                              gap: 8,
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: isDarkMode ? 'rgba(234, 88, 12,0.2)' : '#E8F0EC',
                                paddingHorizontal: 9,
                                paddingVertical: 4,
                                borderRadius: 6,
                                flex: 1,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: isDarkMode ? '#5EEAD4' : '#EA580C',
                                }}
                                numberOfLines={1}
                              >
                                {sup.categories || 'Exhaust & Performance'}
                              </Text>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                              }}
                            >
                              <BootstrapIcon name="clock" size={11} color={isDarkMode ? tokens.textMuted : "#64748B"} />
                              <Text
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: '700',
                                  color: isDarkMode ? '#CBD5E1' : '#475569',
                                }}
                              >
                                {sup.lead_time || '3-5 Days'}
                              </Text>
                            </View>
                          </View>

                          {/* Contact Details */}
                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="envelope-fill" size={12} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {sup.email || 'No email provided'}
                            </Text>
                          </View>
                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="telephone-fill" size={12} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {sup.phone || 'No phone number'}
                            </Text>
                          </View>
                          {sup.address ? (
                            <View style={styles.mechanicInfoRow}>
                              <BootstrapIcon name="geo-alt-fill" size={12} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                              <Text style={styles.mechanicInfoText} numberOfLines={1}>
                                {sup.address}
                              </Text>
                            </View>
                          ) : null}

                          {/* Card Footer: Edit & Remove */}
                          <View style={styles.mechanicCardFooter}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                paddingVertical: 7,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                              }}
                              onPress={() => handleOpenEditSupplier(sup)}
                            >
                              <BootstrapIcon
                                name="pencil-square"
                                size={12}
                                color={isDarkMode ? tokens.textMuted : '#475569'}
                              />
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: '700',
                                  color: isDarkMode ? '#E2E8F0' : '#475569',
                                }}
                              >
                                Edit Details
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isDarkMode ? tokens.chipBorder : '#FCA5A5',
                                backgroundColor: isDarkMode ? tokens.statusDangerBg : '#FEF2F2',
                              }}
                              onPress={() => handleDeleteSupplier(sup)}
                            >
                              <BootstrapIcon name="trash3-fill" size={12} color={isDarkMode ? tokens.statusDangerText : "#DC2626"} />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? tokens.statusDangerText : '#DC2626' }}>
                                Remove
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ─── TAB 8: USER ACCOUNTS ─── */}
            {activeNav === 'users' && (
              <View>
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color={isDarkMode ? tokens.textMuted : "#64748B"} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search users by name, email or phone..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      value={userSearchQuery}
                      onChangeText={setUserSearchQuery}
                    />
                  </View>
                </View>

                <View style={styles.tableCard}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    dataSet={{ tableScroll: 'true' }}
                    style={{ width: '100%', ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}) }}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={{ width: '100%', minWidth: 920, flexGrow: 1 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 2.2, minWidth: 180 }]}>User & Email</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 110 }]}>Role</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 130, textAlign: 'center' }]}>
                          Status
                        </Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 180, textAlign: 'center' }]}>
                          Actions
                        </Text>
                      </View>

                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        dataSet={{ tableScroll: 'true' }}
                        style={{
                          maxHeight: 560,
                          width: '100%',
                          ...(Platform.OS === 'web' ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}),
                        }}
                        contentContainerStyle={{ flexGrow: 1 }}
                      >
                        {usersList
                          .filter(
                            (u) =>
                              !userSearchQuery ||
                              u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                          )
                          .map((u) => {
                            const isDisabled = u.status === 'disabled' || u.status === 'inactive';
                            const isPending = u.status === 'pending_verification';
                            const currentAdminId = currentUser?.user_id || currentUser?.id;
                            const rowUserId = u.user_id || u.id;
                            const isSelf = Boolean(currentAdminId && rowUserId && currentAdminId === rowUserId);
                            const isAdminRole = u.role === 'admin';
                            const roleLabel =
                              u.role === 'admin'
                                ? 'Admin'
                                : u.role === 'rider'
                                  ? 'Rider'
                                  : u.role === 'mechanic'
                                    ? 'Mechanic'
                                    : 'Customer';
                            const roleSub =
                              u.role === 'admin'
                                ? 'Full access'
                                : u.role === 'rider'
                                  ? 'Delivery staff'
                                  : u.role === 'mechanic'
                                    ? 'Garage staff'
                                    : 'Store account';
                            const avatarBg =
                              u.role === 'admin'
                                ? '#EA580C'
                                : u.role === 'rider'
                                  ? '#0F766E'
                                  : u.role === 'mechanic'
                                    ? '#B45309'
                                    : '#3B82F6';
                            return (
                              <View
                                key={u.id}
                                style={[
                                  styles.tableRow,
                                  (isDisabled || isPending) && { opacity: 0.75, backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC' },
                                ]}
                              >
                                <View style={{ flex: 2.2, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 }}>
                                  <View
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 17,
                                      backgroundColor: avatarBg,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
                                      {(u.name || 'U').charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.tableTitle} numberOfLines={1}>
                                      {u.name || 'Anonymous User'}
                                      {isSelf ? ' (You)' : ''}
                                    </Text>
                                    <Text style={styles.tableSub} numberOfLines={1}>
                                      {u.email || 'No email provided'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={{ flex: 1.3, minWidth: 110, paddingRight: 8 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {roleLabel}
                                  </Text>
                                  <Text style={styles.tableSub} numberOfLines={1}>
                                    {roleSub}
                                  </Text>
                                </View>

                                <View style={{ flex: 1.5, minWidth: 130, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                  <View
                                    style={[
                                      styles.tableStatusPill,
                                      {
                                        backgroundColor: isPending
                                          ? isDarkMode
                                            ? 'rgba(245, 158, 11, 0.18)'
                                            : '#FEF3C7'
                                          : isDisabled
                                            ? isDarkMode
                                              ? 'rgba(239, 68, 68, 0.16)'
                                              : '#FEE2E2'
                                            : '#2E7D32',
                                        borderRadius: isDisabled || isPending ? 999 : 6,
                                        ...(!isDisabled && !isPending
                                          ? {
                                            shadowColor: '#1B5E20',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.28,
                                            shadowRadius: 2,
                                            elevation: 2,
                                          }
                                          : null),
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.tableStatusPillText,
                                        {
                                          color: isPending
                                            ? isDarkMode
                                              ? '#FCD34D'
                                              : '#B45309'
                                            : isDisabled
                                              ? isDarkMode
                                                ? '#FCA5A5'
                                                : '#B91C1C'
                                              : '#FFFFFF',
                                        },
                                      ]}
                                    >
                                      {isPending ? 'Pending' : isDisabled ? 'Disabled' : 'Active'}
                                    </Text>
                                  </View>
                                  <Text style={styles.tableStatusSub} numberOfLines={1}>
                                    {isPending ? 'Awaiting OTP' : isDisabled ? 'Login blocked' : 'Can sign in'}
                                  </Text>
                                </View>

                                <View
                                  style={{
                                    flex: 1.8,
                                    minWidth: 180,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    flexShrink: 0,
                                  }}
                                >
                                  <TouchableOpacity
                                    style={[styles.tableOutlineBtn, isSelf && { opacity: 0.45 }]}
                                    onPress={() => handleToggleUserStatus(u.id, u.name, u.status)}
                                    disabled={isSelf}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.tableOutlineBtnText}>
                                      {isDisabled ? 'Enable' : 'Disable'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.tableOutlineBtn, isSelf && { opacity: 0.45 }]}
                                    onPress={() => handleToggleUserRole(u.id, u.role)}
                                    disabled={isSelf}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.tableOutlineBtnText}>
                                      {isAdminRole ? 'Demote' : 'Promote'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.actionIconBtn,
                                      styles.actionIconBtnDanger,
                                      (isSelf || isAdminRole) && { opacity: 0.45 },
                                    ]}
                                    onPress={() => handleDeleteUser(u.id, u.name, u.role)}
                                    disabled={isSelf || isAdminRole}
                                  >
                                    <BootstrapIcon name="trash3" size={14} color={isDarkMode ? tokens.statusDangerText : '#EF4444'} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                      </ScrollView>
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* ─── TAB: CUSTOMER RATINGS AND REPORTS MANAGEMENT ─── */}
            {activeNav === 'ratings_reports' && (
              <AdminCustomerRatingsReportsPanel
                isDarkMode={isDarkMode}
                tokens={tokens}
                isDesktop={isDesktop}
                currentUser={currentUser}
                showToast={showToast}
              />
            )}

            {/* ─── TAB 9: SUPABASE SETTINGS ─── */}
            {activeNav === 'supabase' && (
              <View>
                <View style={[styles.tableCard, { padding: 24 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="database-fill-check" size={20} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                      Cloud Database Connection (Supabase)
                    </Text>
                  </View>
                  <Text style={{ color: isDarkMode ? tokens.textMuted : '#64748B', fontSize: 13, marginBottom: 18, lineHeight: 20 }}>
                    Configure the live PostgreSQL database URL and public anon key for real-time order and
                    product synchronization. Note: Supabase project URLs always end with{' '}
                    <Text style={{ fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>.supabase.co</Text>.
                  </Text>

                  <Text style={styles.formLabel}>Supabase Project URL</Text>
                  <TextInput
                    style={styles.formInput}
                    value={supabaseUrl}
                    onChangeText={setSupabaseUrl}
                    placeholder="https://vtbdmurblidtdghaotne.supabase.co"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#94A3B8', marginTop: 3, marginBottom: 14 }}>
                    Correct format:{' '}
                    <Text style={{ color: isDarkMode ? tokens.accentBrand : '#EA580C', fontWeight: '600' }}>
                      https://vtbdmurblidtdghaotne.supabase.co
                    </Text>
                  </Text>

                  <Text style={styles.formLabel}>Supabase Public Anon Key</Text>
                  <TextInput
                    style={styles.formInput}
                    value={supabaseKey}
                    onChangeText={setSupabaseKey}
                    placeholder="eyJhbGciOi..."
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#94A3B8', marginTop: 3, marginBottom: 18 }}>
                    Use the client <Text style={{ fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>anon/public</Text>{' '}
                    JWT key (starts with eyJhbGci...).
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={styles.addBtnPrimary}
                      onPress={async () => {
                        const saved = supabaseManager.saveCredentials(supabaseUrl, supabaseKey);
                        setSupabaseUrl(saved.url);
                        setSupabaseKey(saved.key);
                        const res = await supabaseManager.testConnection();
                        setConnectionStatus({ tested: true, connected: res.connected, message: res.message });
                        showToast(res.connected ? 'Supabase Connected Live!' : res.message);
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="plug-fill" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>Save & Test Live Connection</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.addBtnPrimary,
                        { backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7', borderWidth: 1, borderColor: isDarkMode ? tokens.accentBorder : '#EA580C' },
                      ]}
                      onPress={async () => {
                        const defs = supabaseManager.resetToDefaults();
                        setSupabaseUrl(defs.url);
                        setSupabaseKey(defs.key);
                        const res = await supabaseManager.testConnection();
                        setConnectionStatus({ tested: true, connected: res.connected, message: res.message });
                        showToast(res.connected ? 'Restored Project Defaults!' : res.message);
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="arrow-counterclockwise" size={14} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                      <Text style={[styles.addBtnPrimaryText, { color: isDarkMode ? tokens.accentBrand : '#EA580C' }]}>
                        Restore Default Project Credentials
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {connectionStatus.tested && (
                    <View
                      style={{
                        marginTop: 18,
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: connectionStatus.connected ? '#ECFDF5' : '#FEF2F2',
                        borderWidth: 1,
                        borderColor: connectionStatus.connected ? '#A7F3D0' : '#FECACA',
                      }}
                    >
                      <Text
                        style={{
                          color: connectionStatus.connected ? '#065F46' : '#991B1B',
                          fontWeight: '700',
                          fontSize: 13.5,
                          lineHeight: 20,
                        }}
                      >
                        {connectionStatus.connected ? 'Connection Active: ' : 'Error: '}{' '}
                        {connectionStatus.message}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ─── TAB 10: NOTIFICATIONS & ALERTS CENTER ─── */}
            {activeNav === 'notifications' && (
              <NotificationsPage
                isAdmin={true}
                isDarkMode={isDarkMode}
                onNavigateToOrders={() => setActiveNav('orders')}
                onNavigateToGarage={() => {
                  setActiveNav('garage');
                  setGarageSubTab('bookings');
                }}
                onNavigateToAdmin={() => setActiveNav('overview')}
                onNavigateToShop={handleBackToStorefront}
                onNavigateToInventory={() => setActiveNav('inventory')}
                onNavigateToSuppliers={() => setActiveNav('suppliers')}
                onNavigateToUsers={() => setActiveNav('users')}
                onNavigateToSettings={() => setActiveNav('settings')}
              />
            )}

            {/* ─── TAB 11: SYSTEM & PLATFORM SETTINGS ─── */}
            {activeNav === 'settings' && (
              <AdminSystemSettingsPanel
                isDarkMode={isDarkMode}
                tokens={tokens}
                showToast={showToast}
                showConfirm={showConfirm}
                isDesktop={isDesktop}
                products={products}
                orders={orders}
                garageBookings={garageBookings}
                usersList={usersList}
                mechanicsList={garageMechanics}
                suppliers={suppliers}
                toggleDarkMode={toggleDarkMode}
              />
            )}

            {/* ─── TAB 12: ACTIVITY LOGS & AUDIT DASHBOARD ─── */}
            {activeNav === 'audit' && (
              <View>
                {/* Click-outside backdrop for open dropdowns */}
                {(isDateRangeDropdownOpen || isAuditCategoryDropdownOpen || isAuditSeverityDropdownOpen) && (
                  <TouchableOpacity
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 99998,
                      backgroundColor: 'transparent',
                      cursor: 'default',
                    }}
                    onPress={() => {
                      setIsDateRangeDropdownOpen(false);
                      setIsAuditCategoryDropdownOpen(false);
                      setIsAuditSeverityDropdownOpen(false);
                    }}
                    activeOpacity={1}
                  />
                )}

                {/* ─── 1. Page Header Card ─── */}
                <View
                  style={[
                    styles.tableCard,
                    {
                      padding: 20,
                      marginBottom: 16,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'flex-start',
                      justifyContent: 'space-between',
                      gap: 14,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="journal-text" size={20} color={isDarkMode ? tokens.accentBrand : '#059669'} />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 19,
                              fontWeight: '600',
                              color: isDarkMode ? tokens.textPrimary : '#0F172A',
                              letterSpacing: -0.3,
                            }}
                          >
                            Activity Logs
                          </Text>
                          <View
                            style={{
                              backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: isDarkMode ? tokens.accentBrand : '#059669',
                                letterSpacing: 0.3,
                              }}
                            >
                              IMMUTABLE
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            fontSize: 12.5,
                            color: isDarkMode ? tokens.textMuted : '#64748B',
                            marginTop: 3,
                          }}
                        >
                          Track administrative actions, inventory changes, approvals, and security events.
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                          backgroundColor: isDarkMode ? '#132A26' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                        onPress={handleExportAuditLogs}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="download" size={13} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                        <Text style={{ color: isDarkMode ? tokens.accentBrand : '#EA580C', fontWeight: '700', fontSize: 12.5 }}>
                          Export CSV
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* ─── 2. Four KPI Summary Cards ─── */}
                <View
                  style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* 1. Total Events */}
                  <View
                    style={{
                      flex: 1,
                      minWidth: 160,
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        {totalEventsCount}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', fontWeight: '600' }}>
                        Total Events
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="file-earmark-text" size={18} color={isDarkMode ? '#94A3B8' : '#475569'} />
                    </View>
                  </View>

                  {/* 2. Successful */}
                  <View
                    style={{
                      flex: 1,
                      minWidth: 160,
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        {successfulEventsCount}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', fontWeight: '600' }}>
                        Successful
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="check2-circle" size={18} color="#059669" />
                    </View>
                  </View>

                  {/* 3. Warnings */}
                  <View
                    style={{
                      flex: 1,
                      minWidth: 160,
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        {warningEventsCount}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', fontWeight: '600' }}>
                        Warnings
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#2D2012' : '#FFFBEB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="exclamation-triangle-fill" size={18} color="#D97706" />
                    </View>
                  </View>

                  {/* 4. Critical */}
                  <View
                    style={{
                      flex: 1,
                      minWidth: 160,
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        {criticalEventsCount}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', fontWeight: '600' }}>
                        Critical
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#341515' : '#FEF2F2',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="shield-fill-x" size={18} color="#DC2626" />
                    </View>
                  </View>
                </View>

                {/* ─── 3. Search & Filtering Toolbar ─── */}
                <View
                  style={{
                    backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    padding: 12,
                    marginBottom: 16,
                    position: 'relative',
                    zIndex: isDateRangeDropdownOpen || isAuditCategoryDropdownOpen || isAuditSeverityDropdownOpen ? 99999 : 10,
                    elevation: 2,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'stretch',
                      gap: 10,
                    }}
                  >
                    {/* Search Field */}
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: isDarkMode ? tokens.bgMain : '#F8FAFC',
                        borderWidth: 1,
                        borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                        borderRadius: 9,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <BootstrapIcon name="search" size={13} color={isDarkMode ? tokens.textMuted : '#64748B'} />
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          outlineStyle: 'none',
                        }}
                        placeholder="Search action, admin, target, or details..."
                        value={auditSearchQuery}
                        onChangeText={(txt) => {
                          setAuditSearchQuery(txt);
                          setAuditCurrentPage(1);
                        }}
                        placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                      />
                      {Boolean(auditSearchQuery) && (
                        <TouchableOpacity onPress={() => setAuditSearchQuery('')}>
                          <BootstrapIcon name="x-circle-fill" size={13} color={isDarkMode ? tokens.textMuted : '#94A3B8'} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Filter Controls Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Date Range Dropdown */}
                      <View style={{ position: 'relative', zIndex: isDateRangeDropdownOpen ? 99999 : 10 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: isDarkMode ? tokens.bgMain : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: auditDateRangeFilter !== '7d' ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                            borderRadius: 9,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            cursor: 'pointer',
                          }}
                          onPress={() => {
                            setIsDateRangeDropdownOpen((prev) => !prev);
                            setIsAuditCategoryDropdownOpen(false);
                            setIsAuditSeverityDropdownOpen(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="calendar3" size={12} color="#64748B" />
                          <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#334155' }}>
                            {DATE_RANGE_OPTIONS.find((d) => d.id === auditDateRangeFilter)?.label || 'Last 7 days'}
                          </Text>
                          <BootstrapIcon name="chevron-down" size={10} color="#64748B" />
                        </TouchableOpacity>

                        {isDateRangeDropdownOpen && (
                          <View
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              marginTop: 6,
                              minWidth: 160,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                              boxShadow: '0 10px 25px -4px rgba(0,0,0,0.15)',
                              zIndex: 99999,
                              padding: 4,
                            }}
                          >
                            {DATE_RANGE_OPTIONS.map((opt) => (
                              <TouchableOpacity
                                key={opt.id}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 6,
                                  backgroundColor: auditDateRangeFilter === opt.id ? (isDarkMode ? '#132A26' : '#ECFDF5') : 'transparent',
                                  cursor: 'pointer',
                                }}
                                onPress={() => {
                                  setAuditDateRangeFilter(opt.id);
                                  setAuditCurrentPage(1);
                                  setIsDateRangeDropdownOpen(false);
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: auditDateRangeFilter === opt.id ? '700' : '500',
                                    color: auditDateRangeFilter === opt.id ? '#059669' : isDarkMode ? tokens.textPrimary : '#334155',
                                  }}
                                >
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Category Dropdown */}
                      <View style={{ position: 'relative', zIndex: isAuditCategoryDropdownOpen ? 99999 : 10 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: isDarkMode ? tokens.bgMain : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: auditCategoryFilter !== 'All' ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                            borderRadius: 9,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            cursor: 'pointer',
                          }}
                          onPress={() => {
                            setIsAuditCategoryDropdownOpen((prev) => !prev);
                            setIsDateRangeDropdownOpen(false);
                            setIsAuditSeverityDropdownOpen(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="grid" size={12} color="#64748B" />
                          <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#334155' }}>
                            {AUDIT_CATEGORIES.find((c) => c.id.toLowerCase() === auditCategoryFilter.toLowerCase())?.label || 'All categories'}
                          </Text>
                          <BootstrapIcon name="chevron-down" size={10} color="#64748B" />
                        </TouchableOpacity>

                        {isAuditCategoryDropdownOpen && (
                          <View
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              marginTop: 6,
                              minWidth: 175,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                              boxShadow: '0 10px 25px -4px rgba(0,0,0,0.15)',
                              zIndex: 99999,
                              padding: 4,
                            }}
                          >
                            {AUDIT_CATEGORIES.map((cat) => (
                              <TouchableOpacity
                                key={cat.id}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 6,
                                  backgroundColor: auditCategoryFilter.toLowerCase() === cat.id.toLowerCase() ? (isDarkMode ? '#132A26' : '#ECFDF5') : 'transparent',
                                  cursor: 'pointer',
                                }}
                                onPress={() => {
                                  setAuditCategoryFilter(cat.id);
                                  setAuditCurrentPage(1);
                                  setIsAuditCategoryDropdownOpen(false);
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: auditCategoryFilter.toLowerCase() === cat.id.toLowerCase() ? '700' : '500',
                                    color: auditCategoryFilter.toLowerCase() === cat.id.toLowerCase() ? '#059669' : isDarkMode ? tokens.textPrimary : '#334155',
                                  }}
                                >
                                  {cat.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Severity Dropdown */}
                      <View style={{ position: 'relative', zIndex: isAuditSeverityDropdownOpen ? 99999 : 10 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: isDarkMode ? tokens.bgMain : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: auditSeverityFilter !== 'All' ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                            borderRadius: 9,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            cursor: 'pointer',
                          }}
                          onPress={() => {
                            setIsAuditSeverityDropdownOpen((prev) => !prev);
                            setIsDateRangeDropdownOpen(false);
                            setIsAuditCategoryDropdownOpen(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="shield-check" size={12} color="#64748B" />
                          <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#334155' }}>
                            {auditSeverityFilter === 'All' ? 'All severities' : auditSeverityFilter}
                          </Text>
                          <BootstrapIcon name="chevron-down" size={10} color="#64748B" />
                        </TouchableOpacity>

                        {isAuditSeverityDropdownOpen && (
                          <View
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              marginTop: 6,
                              minWidth: 160,
                              backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                              boxShadow: '0 10px 25px -4px rgba(0,0,0,0.15)',
                              zIndex: 99999,
                              padding: 4,
                            }}
                          >
                            {AUDIT_SEVERITIES.map((sev) => (
                              <TouchableOpacity
                                key={sev.id}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 6,
                                  backgroundColor: auditSeverityFilter === sev.id ? (isDarkMode ? '#132A26' : '#ECFDF5') : 'transparent',
                                  cursor: 'pointer',
                                }}
                                onPress={() => {
                                  setAuditSeverityFilter(sev.id);
                                  setAuditCurrentPage(1);
                                  setIsAuditSeverityDropdownOpen(false);
                                }}
                              >
                                {sev.dotColor && (
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sev.dotColor }} />
                                )}
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: auditSeverityFilter === sev.id ? '700' : '500',
                                    color: auditSeverityFilter === sev.id ? '#059669' : isDarkMode ? tokens.textPrimary : '#334155',
                                  }}
                                >
                                  {sev.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Filter / Reset Action Button */}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: hasActiveAuditFilters ? (isDarkMode ? '#2D1616' : '#FEF2F2') : isDarkMode ? tokens.bgMain : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: hasActiveAuditFilters ? '#F87171' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                          borderRadius: 9,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          cursor: 'pointer',
                        }}
                        onPress={hasActiveAuditFilters ? handleResetAuditFilters : undefined}
                        activeOpacity={hasActiveAuditFilters ? 0.75 : 1}
                      >
                        <BootstrapIcon
                          name={hasActiveAuditFilters ? 'arrow-counterclockwise' : 'funnel'}
                          size={12}
                          color={hasActiveAuditFilters ? '#DC2626' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: hasActiveAuditFilters ? '#DC2626' : isDarkMode ? tokens.textPrimary : '#334155',
                          }}
                        >
                          {hasActiveAuditFilters ? 'Reset' : 'Filter'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* ─── 4. Activity Logs Table / List Container ─── */}
                <View
                  style={{
                    backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    position: 'relative',
                  }}
                >
                  {/* Table Column Headers (Desktop) */}
                  {isDesktop && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        backgroundColor: '#24272B',
                        borderTopLeftRadius: 13,
                        borderTopRightRadius: 13,
                        borderBottomWidth: 1,
                        borderBottomColor: isDarkMode ? '#374151' : '#32373D',
                      }}
                    >
                      <Text style={{ flex: 2.2, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                        EVENT
                      </Text>
                      <Text style={{ flex: 1.7, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                        ACTOR / TARGET
                      </Text>
                      <Text style={{ flex: 1.1, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                        IP ADDRESS
                      </Text>
                      <Text style={{ flex: 0.9, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                        TIME
                      </Text>
                      <Text style={{ flex: 0.9, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5 }}>
                        STATUS
                      </Text>
                      <Text style={{ width: 110, textAlign: 'right', fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.5, paddingRight: 6 }}>
                        ACTION
                      </Text>
                    </View>
                  )}

                  {/* Empty State */}
                  {filteredAuditLogs.length === 0 ? (
                    <View style={{ padding: 48, alignItems: 'center', justifyContent: 'center' }}>
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <BootstrapIcon name="journal-check" size={26} color={isDarkMode ? tokens.textMuted : '#94A3B8'} />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#1E293B' }}>
                        No Activity Log Entries
                      </Text>
                      <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 4, textAlign: 'center' }}>
                        {auditSearchQuery || hasActiveAuditFilters
                          ? 'No activity log entries match your current search and filters.'
                          : 'No recorded actions found for this period.'}
                      </Text>
                      {hasActiveAuditFilters && (
                        <TouchableOpacity
                          style={{
                            marginTop: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 8,
                            backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                            borderWidth: 1,
                            borderColor: isDarkMode ? tokens.accentBorder : '#A7F3D0',
                          }}
                          onPress={handleResetAuditFilters}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#059669' }}>
                            Reset All Filters
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    /* Table / Cards Body */
                    paginatedAuditLogs.map((log, index) => {
                      const isLast = index === paginatedAuditLogs.length - 1;
                      const sev = (log.severity || 'INFO').toUpperCase();

                      // Status Badge Colors
                      const statusMeta = {
                        CRITICAL: { label: 'CRITICAL', color: '#DC2626', dot: '#EF4444', bg: isDarkMode ? '#341515' : '#FEF2F2' },
                        WARNING: { label: 'WARNING', color: '#D97706', dot: '#F59E0B', bg: isDarkMode ? '#2D2012' : '#FFFBEB' },
                        SUCCESS: { label: 'SUCCESS', color: '#059669', dot: '#10B981', bg: isDarkMode ? '#132A26' : '#ECFDF5' },
                        INFO: { label: 'INFO', color: '#2563EB', dot: '#3B82F6', bg: isDarkMode ? '#1E293B' : '#EFF6FF' },
                      }[sev] || { label: sev, color: '#475569', dot: '#94A3B8', bg: isDarkMode ? '#1E293B' : '#F1F5F9' };

                      // Action Title & Icon presentation
                      const getPresentation = (action) => {
                        switch (action) {
                          case 'ORDER_APPROVED':
                          case 'COD_ORDER_APPROVED':
                            return { title: 'Order Approved', icon: 'check2', color: '#059669', bg: isDarkMode ? '#132A26' : '#ECFDF5' };
                          case 'INVENTORY_RESTOCKED':
                          case 'STOCK_REPLENISHED':
                            return { title: 'Inventory Restocked', icon: 'box-seam', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#EFF6FF' };
                          case 'BOOKING_BAY_UPDATED':
                          case 'BOOKING_STATUS_CHANGED':
                            return { title: 'Booking Bay Updated', icon: 'calendar-check', color: '#059669', bg: isDarkMode ? '#132A26' : '#ECFDF5' };
                          case 'SECURITY_PIN_VERIFIED':
                            return { title: 'Security PIN Verified', icon: 'shield-lock', color: '#D97706', bg: isDarkMode ? '#2D2012' : '#FFFBEB' };
                          case 'FAILED_LOGIN_ATTEMPT':
                            return { title: 'Failed Login Attempt', icon: 'shield-x', color: '#DC2626', bg: isDarkMode ? '#341515' : '#FEF2F2' };
                          case 'ORDER_STATUS_CHANGED':
                            return { title: 'Order Status Changed', icon: 'truck', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#EFF6FF' };
                          case 'PROMO_CREATED':
                            return { title: 'Promo Code Published', icon: 'ticket-perforated', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#EFF6FF' };
                          case 'SYSTEM_SETTINGS_UPDATED':
                          case 'SYSTEM_SETTINGS_SAVED':
                            return { title: 'System Settings Updated', icon: 'sliders', color: '#059669', bg: isDarkMode ? '#132A26' : '#ECFDF5' };
                          case 'SUPPLIER_PO_SIGNED':
                            return { title: 'Supplier PO Signed', icon: 'file-earmark-check', color: '#059669', bg: isDarkMode ? '#132A26' : '#ECFDF5' };
                          case 'DATABASE_BACKUP_EXPORTED':
                            return { title: 'Database Backup Exported', icon: 'database', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#EFF6FF' };
                          case 'USER_PERMISSIONS_MODIFIED':
                            return { title: 'User Permissions Modified', icon: 'person-gear', color: '#D97706', bg: isDarkMode ? '#2D2012' : '#FFFBEB' };
                          default: {
                            const readable = (action || 'Operation')
                              .replace(/_/g, ' ')
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            if (sev === 'CRITICAL') return { title: readable, icon: 'shield-x', color: '#DC2626', bg: isDarkMode ? '#341515' : '#FEF2F2' };
                            if (sev === 'WARNING') return { title: readable, icon: 'shield-lock', color: '#D97706', bg: isDarkMode ? '#2D2012' : '#FFFBEB' };
                            if (sev === 'SUCCESS') return { title: readable, icon: 'check2', color: '#059669', bg: isDarkMode ? '#132A26' : '#ECFDF5' };
                            return { title: readable, icon: 'info-circle', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#EFF6FF' };
                          }
                        }
                      };

                      const meta = getPresentation(log.action);

                      // Relative timestamp formatter
                      const formatTime = (iso) => {
                        if (!iso) return 'Just now';
                        try {
                          const diff = Date.now() - new Date(iso).getTime();
                          const m = Math.floor(diff / 60000);
                          const h = Math.floor(m / 60);
                          const d = Math.floor(h / 24);
                          if (m < 1) return 'Just now';
                          if (m === 1) return '1 min ago';
                          if (m < 60) return `${m} min ago`;
                          if (h === 1) return '1 hour ago';
                          if (h < 24) return `${h} hours ago`;
                          if (d === 1) return 'Yesterday';
                          return `${d} days ago`;
                        } catch (_e) {
                          return 'Recent';
                        }
                      };

                      const isHovered = hoveredAuditRowId === (log.id || index);

                      if (!isDesktop) {
                        /* ─── Mobile Card View ─── */
                        return (
                          <TouchableOpacity
                            key={log.id || index}
                            style={{
                              padding: 16,
                              borderBottomWidth: isLast ? 0 : 1,
                              borderBottomColor: isHovered
                                ? (isDarkMode ? '#10B98133' : '#05966928')
                                : (isDarkMode ? tokens.borderInput : '#F1F5F9'),
                              borderLeftWidth: 5,
                              borderLeftColor: isHovered ? (isDarkMode ? '#10B981' : '#059669') : 'transparent',
                              backgroundColor: isHovered
                                ? (isDarkMode ? '#1C4434' : '#E2EFE7')
                                : (isDarkMode ? 'transparent' : '#FFFFFF'),
                              gap: 10,
                              cursor: 'pointer',
                              boxShadow: isHovered
                                ? (isDarkMode ? '0 4px 16px rgba(0,0,0,0.45)' : '0 4px 14px rgba(234, 88, 12, 0.12)')
                                : 'none',
                              transition: Platform.OS === 'web' ? 'all 0.15s ease' : undefined,
                            }}
                            onMouseEnter={() => setHoveredAuditRowId(log.id || index)}
                            onMouseLeave={() => setHoveredAuditRowId(null)}
                            onPress={() => setSelectedAuditLogForModal(log)}
                            activeOpacity={0.75}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: isHovered ? (isDarkMode ? '#132A26' : '#DCFCE7') : meta.bg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: Platform.OS === 'web' ? 'all 0.15s ease' : undefined,
                                  }}
                                >
                                  <BootstrapIcon name={meta.icon} size={15} color={meta.color} />
                                </View>
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: isHovered ? '700' : '600',
                                    color: isHovered
                                      ? (isDarkMode ? '#34D399' : '#0F442A')
                                      : (isDarkMode ? tokens.textPrimary : '#0F172A'),
                                  }}
                                >
                                  {meta.title}
                                </Text>
                              </View>

                              {/* Status Pill */}
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  backgroundColor: statusMeta.bg,
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 9999,
                                }}
                              >
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusMeta.dot }} />
                                <Text style={{ fontSize: 10, fontWeight: '500', color: statusMeta.color }}>
                                  {statusMeta.label}
                                </Text>
                              </View>
                            </View>

                            <Text style={{ fontSize: 12.5, color: isDarkMode ? '#CBD5E1' : '#475569', lineHeight: 18 }}>
                              {log.details}
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <BootstrapIcon name="person" size={12} color="#64748B" />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#334155' }}>
                                  {log.admin_name}
                                </Text>
                                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>
                                  • {log.target}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>
                                  {formatTime(log.timestamp)}
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    backgroundColor: isHovered
                                      ? (isDarkMode ? '#10B981' : '#EA580C')
                                      : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                    boxShadow: isHovered
                                      ? (isDarkMode ? '0 2px 8px rgba(16,185,129,0.35)' : '0 2px 8px rgba(234, 88, 12,0.22)')
                                      : 'none',
                                    transition: Platform.OS === 'web' ? 'all 0.15s ease' : undefined,
                                  }}
                                >
                                  <BootstrapIcon
                                    name="eye"
                                    size={11}
                                    color={isHovered ? (isDarkMode ? '#06281E' : '#FFFFFF') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: '700',
                                      color: isHovered ? (isDarkMode ? '#06281E' : '#FFFFFF') : (isDarkMode ? tokens.textMuted : '#64748B'),
                                    }}
                                  >
                                    Details
                                  </Text>
                                  <BootstrapIcon
                                    name="arrow-right"
                                    size={10}
                                    color={isHovered ? (isDarkMode ? '#06281E' : '#FFFFFF') : (isDarkMode ? tokens.textMuted : '#64748B')}
                                  />
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      }

                      /* ─── Desktop Table Row View ─── */
                      return (
                        <TouchableOpacity
                          key={log.id || index}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingLeft: 16,
                            paddingVertical: 14,
                            borderBottomWidth: isLast ? 0 : 1,
                            borderBottomColor: isHovered
                              ? (isDarkMode ? '#10B98133' : '#05966928')
                              : (isDarkMode ? tokens.borderInput : '#F1F5F9'),
                            borderLeftWidth: 5,
                            borderLeftColor: isHovered ? (isDarkMode ? '#10B981' : '#059669') : 'transparent',
                            backgroundColor: isHovered
                              ? (isDarkMode ? '#1C4434' : '#E2EFE7')
                              : (isDarkMode ? 'transparent' : '#FFFFFF'),
                            cursor: 'pointer',
                            boxShadow: isHovered
                              ? (isDarkMode ? '0 4px 16px rgba(0,0,0,0.45)' : '0 4px 14px rgba(234, 88, 12, 0.12)')
                              : 'none',
                            transition: Platform.OS === 'web' ? 'all 0.15s ease' : undefined,
                          }}
                          onMouseEnter={() => setHoveredAuditRowId(log.id || index)}
                          onMouseLeave={() => setHoveredAuditRowId(null)}
                          onPress={() => setSelectedAuditLogForModal(log)}
                          activeOpacity={0.75}
                        >
                          {/* Column 1: EVENT */}
                          <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 10 }}>
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: isHovered ? (isDarkMode ? '#132A26' : '#DCFCE7') : meta.bg,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: Platform.OS === 'web' ? 'all 0.15s ease' : undefined,
                              }}
                            >
                              <BootstrapIcon name={meta.icon} size={15} color={meta.color} />
                            </View>
                            <View style={{ minWidth: 0, flex: 1 }}>
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: isHovered ? '700' : '600',
                                  color: isHovered
                                    ? isDarkMode ? '#34D399' : '#0F442A'
                                    : isDarkMode ? tokens.textPrimary : '#0F172A',
                                  transition: Platform.OS === 'web' ? 'color 0.15s ease' : undefined,
                                }}
                              >
                                {meta.title}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 12,
                                  color: isDarkMode ? tokens.textMuted : '#64748B',
                                  marginTop: 2,
                                }}
                              >
                                {log.details}
                              </Text>
                            </View>
                          </View>

                          {/* Column 2: ACTOR / TARGET */}
                          <View style={{ flex: 1.7, paddingRight: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <BootstrapIcon name="person" size={12} color="#64748B" />
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: isHovered
                                    ? isDarkMode ? tokens.textPrimary : '#0F172A'
                                    : isDarkMode ? tokens.textPrimary : '#1E293B',
                                }}
                              >
                                {log.admin_name}
                              </Text>
                            </View>
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 11.5,
                                color: isDarkMode ? tokens.textMuted : '#64748B',
                                marginTop: 2,
                              }}
                            >
                              {log.target}
                            </Text>
                          </View>

                          {/* Column 3: IP ADDRESS */}
                          <View style={{ flex: 1.1, paddingRight: 10 }}>
                            <Text
                              style={{
                                fontSize: 12.5,
                                color: isDarkMode ? tokens.textMuted : '#475569',
                                fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                              }}
                            >
                              {log.ip_address || '192.168.1.104'}
                            </Text>
                          </View>

                          {/* Column 4: TIME */}
                          <View style={{ flex: 0.9, paddingRight: 10 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: isDarkMode ? tokens.textMuted : '#64748B',
                              }}
                            >
                              {formatTime(log.timestamp)}
                            </Text>
                          </View>

                          {/* Column 5: STATUS */}
                          <View style={{ flex: 0.9, paddingRight: 10 }}>
                            <View
                              style={{
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                backgroundColor: statusMeta.bg,
                                paddingHorizontal: 9,
                                paddingVertical: 3.5,
                                borderRadius: 9999,
                              }}
                            >
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusMeta.dot }} />
                              <Text
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: '500',
                                  color: statusMeta.color,
                                  letterSpacing: 0.2,
                                }}
                              >
                                {statusMeta.label}
                              </Text>
                            </View>
                          </View>

                          {/* Column 6: ACTION / VIEW DETAILS */}
                          <View style={{ width: 110, alignItems: 'flex-end', paddingRight: 6 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: isHovered
                                  ? (isDarkMode ? '#10B981' : '#EA580C')
                                  : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                                borderWidth: 1,
                                borderColor: isHovered
                                  ? (isDarkMode ? '#34D399' : '#EA580C')
                                  : (isDarkMode ? tokens.borderInput : '#E2E8F0'),
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 7,
                                boxShadow: isHovered
                                  ? (isDarkMode ? '0 2px 8px rgba(16,185,129,0.35)' : '0 2px 8px rgba(234, 88, 12,0.22)')
                                  : 'none',
                                transition: Platform.OS === 'web' ? 'all 0.15s ease' : undefined,
                              }}
                            >
                              <BootstrapIcon
                                name="eye"
                                size={12}
                                color={isHovered ? (isDarkMode ? '#06281E' : '#FFFFFF') : (isDarkMode ? tokens.textMuted : '#64748B')}
                              />
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: '700',
                                  color: isHovered ? (isDarkMode ? '#06281E' : '#FFFFFF') : (isDarkMode ? tokens.textMuted : '#475569'),
                                  letterSpacing: 0.2,
                                }}
                              >
                                Details
                              </Text>
                              <BootstrapIcon
                                name="arrow-right"
                                size={11}
                                color={isHovered ? (isDarkMode ? '#06281E' : '#FFFFFF') : (isDarkMode ? tokens.textMuted : '#64748B')}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}

                  {/* ─── 5. Table Pagination Footer ─── */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderTopWidth: 1,
                      borderTopColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                      {filteredAuditLogs.length === 0
                        ? 'Showing 0 of 0 events'
                        : `Showing ${(auditCurrentPage - 1) * auditItemsPerPage + 1}–${Math.min(auditCurrentPage * auditItemsPerPage, filteredAuditLogs.length)} of ${filteredAuditLogs.length} events`}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {/* Previous Button */}
                      <TouchableOpacity
                        disabled={auditCurrentPage <= 1}
                        onPress={() => setAuditCurrentPage((prev) => Math.max(1, prev - 1))}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 7,
                          borderWidth: 1,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          opacity: auditCurrentPage <= 1 ? 0.45 : 1,
                          cursor: auditCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <BootstrapIcon name="chevron-left" size={10} color={isDarkMode ? tokens.textPrimary : '#334155'} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#334155' }}>
                          Previous
                        </Text>
                      </TouchableOpacity>

                      {/* Numbered Page Buttons */}
                      {Array.from({ length: totalAuditPages }, (_, i) => i + 1).map((pageNum) => {
                        const isActive = pageNum === auditCurrentPage;
                        return (
                          <TouchableOpacity
                            key={pageNum}
                            onPress={() => setAuditCurrentPage(pageNum)}
                            style={{
                              minWidth: 32,
                              height: 32,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 7,
                              backgroundColor: isActive ? '#EA580C' : isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: isActive ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                              cursor: 'pointer',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: isActive ? '600' : '500',
                                color: isActive ? '#FFFFFF' : isDarkMode ? tokens.textPrimary : '#334155',
                              }}
                            >
                              {pageNum}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Next Button */}
                      <TouchableOpacity
                        disabled={auditCurrentPage >= totalAuditPages}
                        onPress={() => setAuditCurrentPage((prev) => Math.min(totalAuditPages, prev + 1))}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 7,
                          borderWidth: 1,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          opacity: auditCurrentPage >= totalAuditPages ? 0.45 : 1,
                          cursor: auditCurrentPage >= totalAuditPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#334155' }}>
                          Next
                        </Text>
                        <BootstrapIcon name="chevron-right" size={10} color={isDarkMode ? tokens.textPrimary : '#334155'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ─── TAB 13: ADMINISTRATOR PROFILE ─── */}
            {activeNav === 'profile' && (
              <AdminProfileLogsPanel
                isDarkMode={isDarkMode}
                tokens={tokens}
                showToast={showToast}
                showConfirm={showConfirm}
                isDesktop={isDesktop}
                onNavigate={setActiveNav}
              />
            )}
          </ScrollView>
        </View>
      </View>

      {/* ─── MODAL: DEDICATED BRAND IDENTITY MODAL ─── */}
      <EditBrandModal
        visible={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />

      {/* ─── MODAL: AUDIT LOG INSPECTION MODAL ─── */}
      <Modal
        visible={Boolean(selectedAuditLogForModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAuditLogForModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                maxWidth: 640,
                width: '100%',
                backgroundColor: isDarkMode ? tokens.bgElevated : '#FFFFFF',
                borderRadius: 16,
                padding: 22,
                gap: 14,
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="journal-text" size={18} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                    >
                      Activity Log Details
                    </Text>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#059669', letterSpacing: 0.3 }}>
                        IMMUTABLE
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#94A3B8', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
                      ID: {selectedAuditLogForModal?.id}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedAuditLogForModal?.id && typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(selectedAuditLogForModal.id);
                          showToast('✓ Event ID copied to clipboard');
                        }
                      }}
                      style={{ padding: 2 }}
                    >
                      <BootstrapIcon name="clipboard" size={11} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedAuditLogForModal(null)}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                }}
              >
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? tokens.textMuted : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {selectedAuditLogForModal && (
              <ScrollView style={{ maxHeight: 480 }}>
                <View style={{ gap: 12 }}>
                  {/* Action & Status Card */}
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      padding: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8', textTransform: 'uppercase' }}>
                        Action Event
                      </Text>
                      <Text style={{ fontSize: 14.5, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                        {selectedAuditLogForModal.action}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          backgroundColor:
                            selectedAuditLogForModal.severity === 'CRITICAL'
                              ? isDarkMode ? '#341515' : '#FEE2E2'
                              : selectedAuditLogForModal.severity === 'WARNING'
                                ? isDarkMode ? '#2D2012' : '#FEF3C7'
                                : selectedAuditLogForModal.severity === 'SUCCESS'
                                  ? isDarkMode ? '#132A26' : '#D1FAE5'
                                  : isDarkMode ? '#1E293B' : '#DBEAFE',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '600',
                            color:
                              selectedAuditLogForModal.severity === 'CRITICAL'
                                ? '#DC2626'
                                : selectedAuditLogForModal.severity === 'WARNING'
                                  ? '#D97706'
                                  : selectedAuditLogForModal.severity === 'SUCCESS'
                                    ? '#059669'
                                    : '#2563EB',
                          }}
                        >
                          {selectedAuditLogForModal.severity}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '700',
                            color: isDarkMode ? tokens.textMuted : '#475569',
                            textTransform: 'uppercase',
                          }}
                        >
                          {selectedAuditLogForModal.category}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Target & Details */}
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      padding: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B', textTransform: 'uppercase' }}>
                        Target Resource:
                      </Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                        {selectedAuditLogForModal.target}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: isDarkMode ? '#CBD5E1' : '#334155', lineHeight: 19 }}>
                      {selectedAuditLogForModal.details}
                    </Text>
                  </View>

                  {/* Operator & Network Info */}
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      gap: 10,
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8', textTransform: 'uppercase' }}>
                        Actor / Operator
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                        {selectedAuditLogForModal.admin_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 1 }}>
                        Role: {selectedAuditLogForModal.admin_role || 'Administrator'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8', textTransform: 'uppercase' }}>
                        Network Telemetry
                      </Text>
                      <Text
                        style={{
                          fontSize: 11.5,
                          color: isDarkMode ? '#CBD5E1' : '#475569',
                          marginTop: 2,
                          fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                        }}
                      >
                        IP: {selectedAuditLogForModal.ip_address || '127.0.0.1'}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: isDarkMode ? tokens.textMuted : '#94A3B8', marginTop: 1 }}>
                        {selectedAuditLogForModal.client || 'Admin Dashboard'}
                      </Text>
                    </View>
                    <View style={{ flex: 1.1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8', textTransform: 'uppercase' }}>
                        Timestamp
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? '#CBD5E1' : '#475569', marginTop: 2 }}>
                        {new Date(selectedAuditLogForModal.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: isDarkMode ? tokens.textMuted : '#94A3B8',
                          marginTop: 1,
                          fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                        }}
                      >
                        {selectedAuditLogForModal.timestamp}
                      </Text>
                    </View>
                  </View>

                  {/* JSON Metadata Payload (if present) */}
                  {Boolean(selectedAuditLogForModal.metadata && Object.keys(selectedAuditLogForModal.metadata).length > 0) && (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B', textTransform: 'uppercase' }}>
                        Payload Metadata
                      </Text>
                      <View
                        style={{
                          backgroundColor: isDarkMode ? '#0A0F1D' : '#F1F5F9',
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
                            fontSize: 11,
                            color: isDarkMode ? '#38BDF8' : '#0369A1',
                            lineHeight: 17,
                          }}
                        >
                          {JSON.stringify(selectedAuditLogForModal.metadata, null, 2)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="shield-lock-fill" size={13} color="#059669" />
                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B', fontWeight: '500' }}>
                  Immutable Audit Ledger • Tamper-evident record
                </Text>
              </View>

              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                }}
                onPress={() => setSelectedAuditLogForModal(null)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD NEW CATEGORY ─── */}
      <Modal
        visible={isAddCategoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSavingCategory) setIsAddCategoryModalOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 520 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#EA580C',
                  }}
                >
                  <BootstrapIcon name="folder-plus" size={18} color="#EA580C" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Add Product Category</Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                    Create a custom catalog category for parts & gear
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isSavingCategory) setIsAddCategoryModalOpen(false);
                }}
                disabled={isSavingCategory}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Category Name *</Text>
              <TextInput
                style={styles.formInput}
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="e.g. Helmets, Carbon Fairings, Riding Boots"
                placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                autoFocus
              />

              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.formInput, { height: 72, textAlignVertical: 'top', paddingTop: 8 }]}
                value={newCatDesc}
                onChangeText={setNewCatDesc}
                placeholder="Brief summary of components or gear belonging to this category..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.formLabel}>Category Icon</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[
                  { icon: 'shield-shaded', label: 'Shield / Gear' },
                  { icon: 'circle', label: 'Tires' },
                  { icon: 'disc', label: 'Brakes' },
                  { icon: 'gear-fill', label: 'Engine' },
                  { icon: 'lightning-charge-fill', label: 'Electrical' },
                  { icon: 'droplet-fill', label: 'Oils / Lubes' },
                  { icon: 'bag-fill', label: 'Accessories' },
                  { icon: 'fire', label: 'Exhaust' },
                  { icon: 'tools', label: 'Suspension' },
                  { icon: 'gear-wide-connected', label: 'Drivetrain' },
                  { icon: 'fuel-pump-fill', label: 'Fuel' },
                  { icon: 'speedometer2', label: 'Cockpit' },
                  { icon: 'box-seam', label: 'Box / Parts' },
                  { icon: 'tag-fill', label: 'Tag' },
                ].map((item) => {
                  const isSelected = newCatIcon === item.icon;
                  return (
                    <TouchableOpacity
                      key={item.icon}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EA580C' : isDarkMode ? tokens.borderInput : '#E2E8F0',
                        backgroundColor: isSelected
                          ? isDarkMode ? '#132A26' : '#FFF7ED'
                          : isDarkMode ? tokens.bgElevated : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                      onPress={() => setNewCatIcon(item.icon)}
                    >
                      <BootstrapIcon
                        name={item.icon}
                        size={13}
                        color={isSelected ? '#EA580C' : isDarkMode ? tokens.textMuted : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? '#EA580C' : isDarkMode ? tokens.textPrimary : '#334155',
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>Cover Image URL (Optional)</Text>
              <TextInput
                style={styles.formInput}
                value={newCatImage}
                onChangeText={setNewCatImage}
                placeholder="https://... (or leave blank to use iconic category icon)"
                placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  if (!isSavingCategory) setIsAddCategoryModalOpen(false);
                }}
                disabled={isSavingCategory}
              >
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtnPrimary, isSavingCategory && { opacity: 0.7 }]}
                onPress={handleAddCategory}
                disabled={isSavingCategory}
              >
                <BootstrapIcon name="check-lg" size={14} color="#FFFFFF" />
                <Text style={styles.addBtnPrimaryText}>
                  {isSavingCategory ? 'Creating Category...' : 'Create Category'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 1: ADD NEW PRODUCT ─── */}
      <Modal
        visible={isAddProductOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddProductOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Performance Part SKU</Text>
              <TouchableOpacity onPress={() => setIsAddProductOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Part Name</Text>
              <TextInput
                style={styles.formInput}
                value={newProdName}
                onChangeText={setNewProdName}
                placeholder="e.g. Akrapovič Slip-On Exhaust"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <Text style={styles.formLabel}>Brand Name</Text>
              <TextInput
                style={styles.formInput}
                value={newProdBrand}
                onChangeText={setNewProdBrand}
                placeholder="e.g. Brembo, Öhlins, Akrapovič"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Cost / Purchase (₱)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newProdCost}
                    onChangeText={setNewProdCost}
                    placeholder="25000"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Selling Price (₱)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newProdPrice}
                    onChangeText={setNewProdPrice}
                    placeholder="39000"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Initial Stock</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newProdStock}
                    onChangeText={setNewProdStock}
                    placeholder="15"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>
              {Number(newProdPrice) > 0 && (
                Number(newProdCost || 0) > 0 ? (
                  <Text style={{ fontSize: 12, color: isDarkMode ? tokens.statusSuccessText : '#059669', fontWeight: '700', marginBottom: 8 }}>
                    Profit per unit: ₱
                    {(Number(newProdPrice) - Number(newProdCost || 0)).toLocaleString()} (
                    {(
                      ((Number(newProdPrice) - Number(newProdCost || 0)) / Number(newProdPrice)) *
                      100
                    ).toFixed(1)}
                    % margin)
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#FBBF24' : '#D97706', fontWeight: '700', marginBottom: 8 }}>
                    ⚠️ Enter purchase cost above to calculate accurate profit & margin
                  </Text>
                )
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.formLabel}>Category</Text>
                <TouchableOpacity
                  onPress={() => setIsAddCategoryModalOpen(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 6 }}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="plus-circle-fill" size={12} color="#EA580C" />
                  <Text style={{ color: '#EA580C', fontSize: 12, fontWeight: '700' }}>+ New Category</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {availableCategoryNames.filter((c) => c !== 'All').map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterPill, newProdCategory === cat && styles.filterPillActive]}
                    onPress={() => setNewProdCategory(cat)}
                  >
                    <Text
                      style={[styles.filterPillText, newProdCategory === cat && styles.filterPillTextActive]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ProductSizesEditor
                sizes={newProdSizes}
                basePrice={parseFloat(newProdPrice) || 0}
                onChange={setNewProdSizes}
                formInputStyle={styles.formInput}
                formLabelStyle={styles.formLabel}
                productKey={isAddProductOpen ? 'new-open' : 'new-closed'}
              />

              <ProductColorsEditor
                colors={newProdColors}
                onChange={setNewProdColors}
                formInputStyle={styles.formInput}
                formLabelStyle={styles.formLabel}
                onToast={showToast}
                productKey={isAddProductOpen ? 'new-open' : 'new-closed'}
              />

              <Text style={[styles.formLabel, { marginTop: 8 }]}>Compatible Motorcycles</Text>
              <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', marginBottom: 8 }}>
                Save the product first, then open Edit to select compatible motorcycle models.
              </Text>

              {/* Image Selection: File Picker / URL / Presets */}
              <Text style={styles.formLabel}>Product Image</Text>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 14,
                  alignItems: 'center',
                  marginBottom: 12,
                  padding: 12,
                  backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                    }}
                    onPress={async () => {
                      const res = await pickImageFromFile();
                      if (res.success && res.uri) {
                        setNewProdImage(res.uri);
                        showToast('Image selected from device files!');
                      } else if (res.error && res.error !== 'Selection cancelled') {
                        showAlert('Image Picker', res.error);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="folder2-open" size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      Choose Image from File
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                    Upload PNG, JPG, WEBP from your local PC or phone
                  </Text>
                </View>
              </View>

              <Text style={[styles.formLabel, { fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B' }]}>
                Or Paste Direct Image URL
              </Text>
              <TextInput
                style={styles.formInput}
                value={newProdImage}
                onChangeText={setNewProdImage}
                placeholder="https://..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.quickStoreBtn} onPress={() => setIsAddProductOpen(false)}>
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleCreateProduct}>
                <Text style={styles.addBtnPrimaryText}>Save Product to Inventory</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: EDIT PRODUCT ─── */}
      {editingProduct && (
        <Modal
          visible={Boolean(editingProduct)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingProduct(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Product Part</Text>
                <TouchableOpacity onPress={() => setEditingProduct(null)}>
                  <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.formLabel}>Part Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={editingProduct.name}
                  onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, name: val }))}
                />

                <Text style={styles.formLabel}>Brand</Text>
                <TextInput
                  style={styles.formInput}
                  value={editingProduct.brand}
                  onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, brand: val }))}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Cost / Purchase (₱)</Text>
                    <TextInput
                      style={styles.formInput}
                      keyboardType="numeric"
                      value={String(editingProduct.unit_cost ?? editingProduct.unitCost ?? 0)}
                      onChangeText={(val) => {
                        const cost = parseFloat(val) || 0;
                        setEditingProduct((prev) => ({
                          ...prev,
                          unit_cost: cost,
                          unitCost: cost,
                        }));
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Selling Price (₱)</Text>
                    <TextInput
                      style={styles.formInput}
                      keyboardType="numeric"
                      value={String(editingProduct.price)}
                      onChangeText={(val) =>
                        setEditingProduct((prev) => ({ ...prev, price: parseFloat(val) || 0 }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Stock</Text>
                    <TextInput
                      style={styles.formInput}
                      keyboardType="numeric"
                      value={String(editingProduct.stock)}
                      onChangeText={(val) =>
                        setEditingProduct((prev) => ({ ...prev, stock: parseInt(val, 10) || 0 }))
                      }
                    />
                  </View>
                </View>
                {Number(editingProduct.price) > 0 && (
                  Number(editingProduct.unit_cost ?? editingProduct.unitCost ?? 0) > 0 ? (
                    <Text style={{ fontSize: 12, color: isDarkMode ? tokens.statusSuccessText : '#059669', fontWeight: '700', marginBottom: 8 }}>
                      Profit per unit: ₱
                      {(
                        Number(editingProduct.price) -
                        Number(editingProduct.unit_cost ?? editingProduct.unitCost ?? 0)
                      ).toLocaleString()}{' '}
                      (
                      {(
                        ((Number(editingProduct.price) -
                          Number(editingProduct.unit_cost ?? editingProduct.unitCost ?? 0)) /
                          Number(editingProduct.price)) *
                        100
                      ).toFixed(1)}
                      % margin)
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#FBBF24' : '#D97706', fontWeight: '700', marginBottom: 8 }}>
                      ⚠️ Enter purchase cost above to calculate accurate profit & margin
                    </Text>
                  )
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.formLabel}>Category</Text>
                  <TouchableOpacity
                    onPress={() => setIsAddCategoryModalOpen(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 6 }}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="plus-circle-fill" size={12} color="#EA580C" />
                    <Text style={{ color: '#EA580C', fontSize: 12, fontWeight: '700' }}>+ New Category</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {availableCategoryNames.filter((c) => c !== 'All').map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.filterPill,
                        (editingProduct.category || '').toLowerCase() === cat.toLowerCase() && styles.filterPillActive,
                      ]}
                      onPress={() => setEditingProduct((prev) => ({ ...prev, category: cat }))}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          (editingProduct.category || '').toLowerCase() === cat.toLowerCase() && styles.filterPillTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <ProductSizesEditor
                  sizes={editingProduct.sizes || []}
                  basePrice={Number(editingProduct.price) || 0}
                  onChange={(next) => setEditingProduct((prev) => ({ ...prev, sizes: next }))}
                  formInputStyle={styles.formInput}
                  formLabelStyle={styles.formLabel}
                  productKey={editingProduct.id || editingProduct.product_id || 'edit'}
                />

                <ProductColorsEditor
                  colors={editingProduct.colors || []}
                  onChange={(next) => setEditingProduct((prev) => ({ ...prev, colors: next }))}
                  formInputStyle={styles.formInput}
                  formLabelStyle={styles.formLabel}
                  onToast={showToast}
                  productKey={editingProduct.id || editingProduct.product_id || 'edit'}
                />

                <ProductCompatibilityPicker
                  productId={editingProduct.id || editingProduct.product_id}
                  onToast={showToast}
                  isDarkMode={isDarkMode}
                />

                {/* Edit Product Image with File Picker */}
                <Text style={styles.formLabel}>Product Image</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 14,
                    alignItems: 'center',
                    marginBottom: 12,
                    padding: 12,
                    backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }}
                >
                  <Image
                    source={{
                      uri:
                        editingProduct.image ||
                        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 12,
                      backgroundColor: '#E2E8F0',
                      borderWidth: 1.5,
                      borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, gap: 6 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                      }}
                      onPress={async () => {
                        const res = await pickImageFromFile();
                        if (res.success && res.uri) {
                          setEditingProduct((prev) => ({ ...prev, image: res.uri }));
                          showToast('Image updated from file!');
                        } else if (res.error && res.error !== 'Selection cancelled') {
                          showAlert('Image Picker', res.error);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="folder2-open" size={15} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        Choose New Image File
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                      Pick replacement image from your computer or phone
                    </Text>
                  </View>
                </View>

                <Text style={[styles.formLabel, { fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B' }]}>Or Paste Image URL</Text>
                <TextInput
                  style={styles.formInput}
                  value={editingProduct.image || ''}
                  onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, image: val }))}
                  placeholder="https://..."
                  placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, { height: 60 }]}
                  multiline
                  value={editingProduct.description}
                  onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, description: val }))}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.quickStoreBtn} onPress={() => setEditingProduct(null)}>
                  <Text style={styles.quickStoreBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtnPrimary} onPress={handleSaveProductEdit}>
                  <Text style={styles.addBtnPrimaryText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL 3: SUPPLIER PURCHASE / RESTOCK (same form style as Add Product) ─── */}
      <Modal
        visible={isRestockModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRestockModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 560 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Purchase from Supplier</Text>
              <TouchableOpacity onPress={closeRestockModal}>
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Select Product SKU</Text>
              <TextInput
                style={styles.formInput}
                value={restockSearchQuery}
                onChangeText={setRestockSearchQuery}
                placeholder="Search by name, brand, or category…"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              {!restockModalProduct || restockSearchQuery.trim() ? (
                <View
                  style={{
                    maxHeight: 180,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    borderRadius: 12,
                    marginBottom: 12,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {(products || [])
                      .filter((p) => {
                        const q = restockSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          (p.name || '').toLowerCase().includes(q) ||
                          (p.brand || '').toLowerCase().includes(q) ||
                          (p.category || '').toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 12)
                      .map((p) => (
                        <TouchableOpacity
                          key={p.id || p.product_id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: tokens.border,
                            backgroundColor:
                              restockModalProduct?.id === p.id
                                ? (isDarkMode ? 'rgba(234, 88, 12, 0.25)' : '#FFF7ED')
                                : (isDarkMode ? '#141A18' : '#FFFFFF'),
                          }}
                          onPress={() => selectRestockProduct(p)}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{
                              uri:
                                p.image ||
                                'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=200&q=80',
                            }}
                            style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: isDarkMode ? tokens.bgSub : '#E2E8F0' }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.textPrimary }} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: tokens.textMuted }} numberOfLines={1}>
                              {p.brand} · Stock {p.stock || 0} · ₱{Number(p.price || 0).toLocaleString()}
                            </Text>
                          </View>
                          <BootstrapIcon name="plus-circle" size={16} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              ) : null}

              {restockModalProduct ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 14,
                      alignItems: 'center',
                      marginBottom: 14,
                      padding: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: tokens.border,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          restockModalProduct.image ||
                          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=200&q=80',
                      }}
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 12,
                        backgroundColor: isDarkMode ? tokens.bgSub : '#E2E8F0',
                        borderWidth: 1.5,
                        borderColor: tokens.borderInput,
                      }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        {restockModalProduct.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        {restockModalProduct.brand} · {restockModalProduct.category}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.accentBrand : '#EA580C', fontWeight: '700', marginTop: 4 }}>
                        Current stock: {restockModalProduct.stock || 0} · Cost ₱
                        {Number(
                          restockModalProduct.unit_cost ?? restockModalProduct.unitCost ?? 0
                        ).toLocaleString()}{' '}
                        · Price ₱{Number(restockModalProduct.price || 0).toLocaleString()}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setRestockModalProduct(null);
                          setRestockSizeAdds([]);
                          setRestockSelectedSize('');
                          setRestockColorAdds([]);
                          setRestockSelectedColor('');
                          setRestockSearchQuery('');
                        }}
                        style={{ marginTop: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? tokens.statusWarningText : '#B45309' }}>
                          Change product
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.formLabel}>Supplier</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[styles.filterPill, !restockSupplierId && styles.filterPillActive]}
                      onPress={() => setRestockSupplierId('')}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          !restockSupplierId && styles.filterPillTextActive,
                        ]}
                      >
                        No supplier
                      </Text>
                    </TouchableOpacity>
                    {(suppliers || []).slice(0, 12).map((s) => {
                      const sid = s.supplier_id || s.id;
                      return (
                        <TouchableOpacity
                          key={sid}
                          style={[
                            styles.filterPill,
                            restockSupplierId === sid && styles.filterPillActive,
                          ]}
                          onPress={() => setRestockSupplierId(sid)}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              restockSupplierId === sid && styles.filterPillTextActive,
                            ]}
                          >
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* ─── SIZE PICKER SECTION (if product has sizes) ─── */}
                  {(() => {
                    const availSizes = normalizeProductSizes(restockModalProduct);
                    if (!availSizes.length) return null;

                    return (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.formLabel}>Select Size to Restock</Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                            {availSizes.length} variant{availSizes.length !== 1 ? 's' : ''} available
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          {availSizes.map((sz) => {
                            const isSelected = restockSelectedSize === sz.label;
                            const currentStock =
                              sz.stock === null || sz.stock === undefined
                                ? Number(restockModalProduct.stock || 0)
                                : Number(sz.stock || 0);
                            return (
                              <TouchableOpacity
                                key={sz.label}
                                style={[
                                  styles.filterPill,
                                  isSelected && styles.filterPillActive,
                                  {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingVertical: 7,
                                    paddingHorizontal: 12,
                                    borderRadius: 10,
                                    borderColor: isSelected ? '#EA580C' : tokens.borderInput,
                                    borderWidth: 1.5,
                                    backgroundColor: isSelected ? '#EA580C' : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                                  },
                                ]}
                                onPress={() => {
                                  setRestockSelectedSize(sz.label);
                                  if (sz.price) {
                                    setRestockSellPrice(String(sz.price));
                                  }
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: isSelected ? '#FFFFFF' : tokens.textPrimary,
                                  }}
                                >
                                  {sz.label}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : '#E2E8F0',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: isSelected ? '#FFFFFF' : '#475569',
                                    }}
                                  >
                                    {currentStock} in stock
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={[
                              styles.filterPill,
                              restockSelectedSize === 'all' && styles.filterPillActive,
                              {
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingVertical: 7,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                borderColor: restockSelectedSize === 'all' ? '#EA580C' : tokens.borderInput,
                                borderWidth: 1.5,
                                backgroundColor: restockSelectedSize === 'all' ? '#EA580C' : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                              },
                            ]}
                            onPress={() => setRestockSelectedSize('all')}
                          >
                            <BootstrapIcon
                              name="grid-3x3-gap-fill"
                              size={12}
                              color={restockSelectedSize === 'all' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '600',
                                color: restockSelectedSize === 'all' ? '#FFFFFF' : '#0F172A',
                              }}
                            >
                              All Sizes (Multi-restock)
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {restockSelectedSize && restockSelectedSize !== 'all' && (() => {
                          const activeSize = availSizes.find((s) => s.label === restockSelectedSize);
                          const curStock =
                            activeSize?.stock === null || activeSize?.stock === undefined
                              ? Number(restockModalProduct.stock || 0)
                              : Number(activeSize?.stock || 0);
                          const addQty = parseInt(restockAmount, 10) || 0;
                          return (
                            <View
                              style={{
                                marginTop: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: '#FFF7ED',
                                borderWidth: 1,
                                borderColor: '#FED7AA',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '700' }}>
                                Restocking: <Text style={{ fontWeight: '600' }}>{restockSelectedSize}</Text> (Current: {curStock} units)
                              </Text>
                              <Text style={{ fontSize: 12, color: isDarkMode ? tokens.statusSuccessText : '#059669', fontWeight: '600' }}>
                                → Will become: {curStock + addQty} units
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    );
                  })()}

                  {/* ─── COLOR PICKER SECTION (if product has colors and no sizes) ─── */}
                  {(() => {
                    const availColors = normalizeProductColors(restockModalProduct);
                    const availSizes = normalizeProductSizes(restockModalProduct);
                    // Only show color picker when there are colors and no sizes (sizes take priority)
                    if (!availColors.length || availSizes.length > 0) return null;
                    return (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.formLabel}>Select Color to Restock</Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                            {availColors.length} color{availColors.length !== 1 ? 's' : ''} available
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          {availColors.map((c) => {
                            const isSelected = restockSelectedColor === c.label;
                            const currentStock =
                              c.stock === null || c.stock === undefined
                                ? Number(restockModalProduct.stock || 0)
                                : Number(c.stock || 0);
                            return (
                              <TouchableOpacity
                                key={c.label}
                                style={[
                                  styles.filterPill,
                                  isSelected && styles.filterPillActive,
                                  {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingVertical: 7,
                                    paddingHorizontal: 12,
                                    borderRadius: 10,
                                    borderColor: isSelected ? '#EA580C' : tokens.borderInput,
                                    borderWidth: 1.5,
                                    backgroundColor: isSelected ? '#EA580C' : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                                  },
                                ]}
                                onPress={() => setRestockSelectedColor(c.label)}
                              >
                                {/* Color swatch */}
                                {c.image ? (
                                  <Image
                                    source={{ uri: c.image }}
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 4,
                                      borderWidth: 1,
                                      borderColor: 'rgba(0,0,0,0.12)',
                                    }}
                                    resizeMode="cover"
                                  />
                                ) : c.hex ? (
                                  <View
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: 3,
                                      backgroundColor: c.hex,
                                      borderWidth: 1,
                                      borderColor: 'rgba(0,0,0,0.15)',
                                    }}
                                  />
                                ) : null}
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: isSelected ? '#FFFFFF' : tokens.textPrimary,
                                  }}
                                >
                                  {c.label}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : '#E2E8F0',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: isSelected ? '#FFFFFF' : '#475569',
                                    }}
                                  >
                                    {currentStock} in stock
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                          {/* All Colors button */}
                          <TouchableOpacity
                            style={[
                              styles.filterPill,
                              restockSelectedColor === 'all' && styles.filterPillActive,
                              {
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingVertical: 7,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                borderColor: restockSelectedColor === 'all' ? '#EA580C' : tokens.borderInput,
                                borderWidth: 1.5,
                                backgroundColor: restockSelectedColor === 'all' ? '#EA580C' : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                              },
                            ]}
                            onPress={() => setRestockSelectedColor('all')}
                          >
                            <BootstrapIcon
                              name="grid-3x3-gap-fill"
                              size={12}
                              color={restockSelectedColor === 'all' ? '#FFFFFF' : isDarkMode ? '#AAB4B0' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '600',
                                color: restockSelectedColor === 'all' ? '#FFFFFF' : tokens.textPrimary,
                              }}
                            >
                              All Colors (Multi-restock)
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {restockSelectedColor && restockSelectedColor !== 'all' && (() => {
                          const activeColor = availColors.find((c) => c.label === restockSelectedColor);
                          const curStock =
                            activeColor?.stock === null || activeColor?.stock === undefined
                              ? Number(restockModalProduct.stock || 0)
                              : Number(activeColor?.stock || 0);
                          const addQty = parseInt(restockAmount, 10) || 0;
                          return (
                            <View
                              style={{
                                marginTop: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: '#FFF7ED',
                                borderWidth: 1,
                                borderColor: '#FED7AA',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '700' }}>
                                Restocking: <Text style={{ fontWeight: '600' }}>{restockSelectedColor}</Text> (Current: {curStock} units)
                              </Text>
                              <Text style={{ fontSize: 12, color: isDarkMode ? tokens.statusSuccessText : '#059669', fontWeight: '600' }}>
                                → Will become: {curStock + addQty} units
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    );
                  })()}

                  {/* ─── QUANTITY SECTION ─── */}
                  {(() => {
                    const availSizes = normalizeProductSizes(restockModalProduct);
                    const availColors = normalizeProductColors(restockModalProduct);
                    const hasSizesQ = availSizes.length > 0;
                    const hasColorsQ = availColors.length > 0 && !hasSizesQ;
                    const isAll = hasSizesQ && restockSelectedSize === 'all';
                    const isAllColors = hasColorsQ && restockSelectedColor === 'all';

                    if (isAllColors) {
                      return (
                        <>
                          <Text style={styles.formLabel}>Restock by color (add units)</Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B', marginBottom: 8 }}>
                            Enter how many units to add for each color.
                          </Text>
                          {restockColorAdds.map((row, idx) => (
                            <View
                              key={row.label}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <View style={{ flex: 1.2 }}>
                                {row.hex ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: row.hex, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }} />
                                    <Text style={{ fontSize: 13, fontWeight: '500', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{row.label}</Text>
                                  </View>
                                ) : (
                                  <Text style={{ fontSize: 13, fontWeight: '500', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{row.label}</Text>
                                )}
                                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Now: {row.currentStock}</Text>
                              </View>
                              <TextInput
                                style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                                keyboardType="numeric"
                                value={row.addQty}
                                placeholder="+ qty"
                                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                                onChangeText={(val) => {
                                  setRestockColorAdds((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, addQty: val } : r))
                                  );
                                }}
                              />
                            </View>
                          ))}
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                            {[5, 10, 25].map((qty) => (
                              <TouchableOpacity
                                key={qty}
                                style={{
                                  flex: 1,
                                  backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                  borderWidth: 1,
                                  borderColor: isDarkMode ? tokens.chipBorder : '#FDE68A',
                                }}
                                onPress={() =>
                                  setRestockColorAdds((prev) =>
                                    prev.map((r) => ({ ...r, addQty: String(qty) }))
                                  )
                                }
                              >
                                <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                  +{qty} all
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      );
                    }

                    if (isAll) {
                      return (
                        <>
                          <Text style={styles.formLabel}>Restock by size (add units)</Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B', marginBottom: 8 }}>
                            Enter how many units to add for each size.
                          </Text>
                          {restockSizeAdds.map((row, idx) => (
                            <View
                              key={row.label}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <View style={{ flex: 1.2 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                                  {row.label}
                                </Text>
                                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                                  Now: {row.currentStock}
                                </Text>
                              </View>
                              <TextInput
                                style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                                keyboardType="numeric"
                                value={row.addQty}
                                placeholder="+ qty"
                                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                                onChangeText={(val) => {
                                  setRestockSizeAdds((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, addQty: val } : r))
                                  );
                                }}
                              />
                            </View>
                          ))}
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                            {[5, 10, 25].map((qty) => (
                              <TouchableOpacity
                                key={qty}
                                style={{
                                  flex: 1,
                                  backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                  borderWidth: 1,
                                  borderColor: isDarkMode ? tokens.chipBorder : '#FDE68A',
                                }}
                                onPress={() =>
                                  setRestockSizeAdds((prev) =>
                                    prev.map((r) => ({ ...r, addQty: String(qty) }))
                                  )
                                }
                              >
                                <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                  +{qty} all
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      );
                    }

                    return (
                      <>
                        <Text style={styles.formLabel}>Quantity purchased</Text>
                        <TextInput
                          style={[styles.formInput, { fontSize: 16, fontWeight: '500', color: isDarkMode ? tokens.accentBrand : '#EA580C' }]}
                          keyboardType="numeric"
                          value={restockAmount}
                          onChangeText={setRestockAmount}
                          placeholder="10"
                          placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                        />
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                          {[5, 10, 25, 50].map((qty) => (
                            <TouchableOpacity
                              key={qty}
                              style={{
                                flex: 1,
                                backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                                paddingVertical: 6,
                                borderRadius: 8,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: isDarkMode ? tokens.chipBorder : '#FDE68A',
                              }}
                              onPress={() => setRestockAmount(String(qty))}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                                +{qty}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    );
                  })()}

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Cost / Purchase (₱)</Text>
                      <TextInput
                        style={styles.formInput}
                        keyboardType="numeric"
                        value={restockUnitCost}
                        onChangeText={setRestockUnitCost}
                        placeholder="What you paid the supplier"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Selling Price (₱)</Text>
                      <TextInput
                        style={styles.formInput}
                        keyboardType="numeric"
                        value={restockSellPrice}
                        onChangeText={setRestockSellPrice}
                        placeholder="Customer price"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                      />
                    </View>
                  </View>

                  {(() => {
                    const availSizes = normalizeProductSizes(restockModalProduct);
                    const availColors = normalizeProductColors(restockModalProduct);
                    const hasSizesP = availSizes.length > 0;
                    const hasColorsP = availColors.length > 0 && !hasSizesP;
                    const isAll = hasSizesP && restockSelectedSize === 'all';
                    const isAllColors = hasColorsP && restockSelectedColor === 'all';
                    const sizeTotal = (restockSizeAdds || []).reduce(
                      (sum, r) => sum + (parseInt(String(r.addQty || '0'), 10) || 0),
                      0
                    );
                    const colorTotal = (restockColorAdds || []).reduce(
                      (sum, r) => sum + (parseInt(String(r.addQty || '0'), 10) || 0),
                      0
                    );
                    const qty = isAll ? sizeTotal : isAllColors ? colorTotal : Number(restockAmount) || 0;
                    const cost = Number(restockUnitCost) || 0;
                    const price = Number(restockSellPrice) || 0;
                    const expense = qty * cost;
                    const profitUnit = price - cost;
                    const expected = profitUnit * qty;
                    const margin = price > 0 ? (profitUnit / price) * 100 : 0;
                    if (qty <= 0 && price <= 0) return null;
                    return (
                      <View
                        style={{
                          marginTop: 8,
                          marginBottom: 8,
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: '#FFF7ED',
                          borderWidth: 1,
                          borderColor: '#99F6E4',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F766E' }}>
                          Expense & Profit preview
                        </Text>
                        {Number(price) > 0 && (
                          <Text style={{ fontSize: 12, color: isDarkMode ? tokens.statusSuccessText : '#059669', fontWeight: '700' }}>
                            Profit per unit: ₱{profitUnit.toLocaleString()} ({margin.toFixed(1)}%
                            margin)
                          </Text>
                        )}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.statusWarningText : '#B45309' }}>
                          Expense (paid to supplier): ₱{expense.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#475569' }}>
                          If all {qty || 0} units sell: ₱{expected.toLocaleString()} profit
                        </Text>
                      </View>
                    );
                  })()}
                </>
              ) : (
                <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 4, marginBottom: 12 }}>
                  Pick a product above — same flow as adding stock when creating an SKU, then enter
                  quantity and cost.
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.quickStoreBtn} onPress={closeRestockModal}>
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtnPrimary, !restockModalProduct && { opacity: 0.5 }]}
                onPress={handleExecuteRestock}
                disabled={!restockModalProduct}
              >
                <BootstrapIcon name="box-arrow-in-down" size={14} color="#FFFFFF" />
                <Text style={styles.addBtnPrimaryText}>Confirm Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── POS SIZE PICKER (tires / rims) ─── */}
      {posSizePickerProduct && (
        <Modal
          visible={Boolean(posSizePickerProduct)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setPosSizePickerProduct(null);
            setPosSelectedSize('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxWidth: 420 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Size</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPosSizePickerProduct(null);
                    setPosSelectedSize('');
                  }}
                >
                  <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginBottom: 4 }}>
                  {posSizePickerProduct.name}
                </Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', marginBottom: 12 }}>
                  Choose a size before adding to the POS cart.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {getProductSizeEntries(posSizePickerProduct).map((entry) => {
                    const soldOut = isSizeSoldOut(posSizePickerProduct, entry.label);
                    const active = posSelectedSize === entry.label;
                    return (
                      <TouchableOpacity
                        key={entry.label}
                        disabled={soldOut}
                        onPress={() => setPosSelectedSize(entry.label)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: soldOut ? (isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#FECACA') : active ? '#EA580C' : tokens.border,
                          backgroundColor: soldOut ? (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2') : active ? '#EA580C' : (isDarkMode ? tokens.bgSub : '#F8FAFC'),
                          minWidth: 110,
                          opacity: soldOut ? 0.7 : 1,
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '500',
                            color: soldOut ? (isDarkMode ? tokens.statusDangerText : '#991B1B') : active ? '#FFFFFF' : tokens.textPrimary,
                            textDecorationLine: soldOut ? 'line-through' : 'none',
                          }}
                        >
                          {entry.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            marginTop: 2,
                            color: soldOut ? '#DC2626' : active ? '#FED7AA' : '#EA580C',
                          }}
                        >
                          {soldOut ? 'Sold Out' : `₱${Number(entry.price || 0).toLocaleString()}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.quickStoreBtn}
                  onPress={() => {
                    setPosSizePickerProduct(null);
                    setPosSelectedSize('');
                  }}
                >
                  <Text style={styles.quickStoreBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addBtnPrimary, !posSelectedSize && { opacity: 0.5 }]}
                  onPress={handlePOSConfirmSize}
                  disabled={!posSelectedSize}
                >
                  <Text style={styles.addBtnPrimaryText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL 4: DIGITAL POS THERMAL RECEIPT ─── */}
      {posReceiptOrder && (
        <Modal
          visible={Boolean(posReceiptOrder)}
          transparent
          animationType="fade"
          onRequestClose={() => setPosReceiptOrder(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.receiptSheet}>
              <Text style={styles.receiptLogo}>MotoTrack Motorparts & Accessories</Text>
              <Text style={styles.receiptSub}>Official Counter POS Sales Invoice</Text>
              <Text style={styles.receiptSub}>
                Receipt No: {posReceiptOrder.order_id} • {posReceiptOrder.order_date}
              </Text>

              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptText}>Customer:</Text>
                <Text style={styles.receiptTextBold}>{posReceiptOrder.customer_name}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptText}>Cashier:</Text>
                <Text style={styles.receiptTextBold}>{posReceiptOrder.cashier || 'Admin Cashier'}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptText}>Channel:</Text>
                <Text style={styles.receiptTextBold}>Direct In-Store Counter</Text>
              </View>

              <View style={styles.receiptDivider} />

              {/* Items */}
              {(posReceiptOrder.items || []).map((it, idx) => (
                <View key={idx} style={{ marginVertical: 3 }}>
                  <Text style={[styles.receiptTextBold, { fontSize: 11.5 }]} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptText}>
                      {' '}
                      {it.quantity} x ₱{it.price?.toLocaleString()}
                    </Text>
                    <Text style={styles.receiptTextBold}>₱{(it.price * it.quantity).toLocaleString()}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptText}>Subtotal:</Text>
                <Text style={styles.receiptTextBold}>₱{posReceiptOrder.total_amount?.toLocaleString()}</Text>
              </View>

              {posReceiptOrder.discount_amount > 0 && (
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptText, { color: isDarkMode ? tokens.statusSuccessText : '#059669' }]}>Voucher Discount:</Text>
                  <Text style={[styles.receiptTextBold, { color: isDarkMode ? tokens.statusSuccessText : '#059669' }]}>
                    -₱{posReceiptOrder.discount_amount?.toLocaleString()}
                  </Text>
                </View>
              )}

              <View style={[styles.receiptRow, { marginTop: 4 }]}>
                <Text style={[styles.receiptTextBold, { fontSize: 14 }]}>TOTAL PAID:</Text>
                <Text style={[styles.receiptTextBold, { fontSize: 16, color: isDarkMode ? tokens.accentBrand : '#EA580C' }]}>
                  ₱{posReceiptOrder.grand_total?.toLocaleString()}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptText}>Payment Method:</Text>
                <Text style={styles.receiptTextBold}>{posReceiptOrder.payment_method}</Text>
              </View>

              {posReceiptOrder.payment_method === 'Cash' && (
                <>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptText}>Tendered:</Text>
                    <Text style={styles.receiptTextBold}>
                      ₱{posReceiptOrder.amount_tendered?.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptText}>Change Given:</Text>
                    <Text style={[styles.receiptTextBold, { color: isDarkMode ? tokens.statusSuccessText : '#059669' }]}>
                      ₱{posReceiptOrder.change_amount?.toLocaleString()}
                    </Text>
                  </View>
                </>
              )}

              <View style={styles.receiptBarcode}>
                <Text style={styles.receiptBarcodeText}>|||||||| | ||||| |||| | |||||||</Text>
              </View>

              <Text style={[styles.receiptSub, { marginTop: 6 }]}>
                Thank you for choosing MotoTrack! Drive safe.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.addBtnPrimary, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.print?.();
                    }
                    setPosReceiptOrder(null);
                  }}
                >
                  <BootstrapIcon name="printer-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>Print / Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL: MANAGE BOOKING / WORK ORDER ─── */}
      {selectedBookingForModal && (
        <Modal
          visible={isBookingModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsBookingModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalSheet,
                {
                  maxWidth: 860,
                  maxHeight: '92%',
                  borderRadius: 24,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isDarkMode ? tokens.border : '#E2E8F0',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.2,
                  shadowRadius: 28,
                  elevation: 12,
                },
              ]}
            >
              {/* Fixed Modal Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? tokens.border : '#E2E8F0',
                  backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                      borderWidth: 1,
                      borderColor: isDarkMode ? tokens.chipBorder : '#FDE68A',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <BootstrapIcon name="tools" size={15} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', letterSpacing: -0.3 }}>
                        Work Order #{selectedBookingForModal.booking_id || selectedBookingForModal.id}
                      </Text>
                      <View
                        style={{
                          backgroundColor: selectedBookingForModal.status === 'Cancelled' ? '#FEF2F2' : '#ECFDF5',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 5,
                          borderWidth: 1,
                          borderColor: selectedBookingForModal.status === 'Cancelled' ? '#FECACA' : '#A7F3D0',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: '600',
                            color: selectedBookingForModal.status === 'Cancelled' ? '#DC2626' : '#047857',
                          }}
                        >
                          {selectedBookingForModal.status === 'Cancelled'
                            ? 'DP Forfeited'
                            : `20% DP ₱${(selectedBookingForModal.downpayment_amount !== undefined ? selectedBookingForModal.downpayment_amount : Math.round((selectedBookingForModal.pricePhp || 2500) * 0.20)).toLocaleString()} Paid (${selectedBookingForModal.downpayment_method || 'GCash'})`}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', fontWeight: '500', marginTop: 1 }}>
                      {selectedBookingForModal.category || 'PMS'} Service Appointment •{' '}
                      {selectedBookingForModal.branch?.replace('MotoTrack ', '') || 'D\'Blockchain Motorparts and Accessories'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setIsBookingModalOpen(false)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                    borderWidth: 1,
                    borderColor: isDarkMode ? tokens.border : '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="x-lg" size={12} color={isDarkMode ? tokens.textMuted : "#64748B"} />
                </TouchableOpacity>
              </View>

              {/* Organized Booking Details & Operational Workflow Modal */}
              <AdminBookingDetailsPanel
                booking={selectedBookingForModal}
                onClose={() => setIsBookingModalOpen(false)}
                onDeleteBooking={handleDeleteBooking}
                mechanics={garageMechanics}
                onToast={showToast}
                isDarkMode={isDarkMode}
                tokens={tokens}
                showConfirm={showConfirm}
                isDesktop={true}
                onBookingUpdated={(next, list) => {
                  if (Array.isArray(list)) setGarageBookings(list);
                  if (next) {
                    setSelectedBookingForModal(next);
                    setEditBkStatus(next.status || editBkStatus);
                    setEditBkMechanic(next.mechanic || editBkMechanic);
                  } else {
                    garageService.fetchBookings().then((fresh) => {
                      if (Array.isArray(fresh)) {
                        setGarageBookings(fresh);
                        const id = selectedBookingForModal?.booking_id || selectedBookingForModal?.id;
                        const found = fresh.find((b) => b.booking_id === id || b.id === id);
                        if (found) {
                          setSelectedBookingForModal(found);
                          setEditBkStatus(found.status || editBkStatus);
                        }
                      }
                    });
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL: CREATE WALK-IN / NEW BOOKING ─── */}
      <Modal
        visible={isNewBookingModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNewBookingModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 640, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar-plus-fill" size={18} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Book Walk-in / Phone-in Service</Text>
                  <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                    Schedule new garage appointment and assign lift bay
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsNewBookingModalOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Category selector */}
              <Text style={styles.formLabel}>Service Type</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                  borderRadius: 8,
                  padding: 3,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  marginBottom: 12,
                }}
              >
                {[
                  { key: 'Repair', label: 'Mechanical Repair' },
                  { key: 'PMS', label: 'Preventive Maintenance (PMS)' },
                  { key: 'Installation', label: 'Installation' },
                ].map((c) => {
                  const isSelected = newBkCategory === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 7,
                        borderRadius: 6,
                        backgroundColor: isSelected ? '#EA580C' : 'transparent',
                        boxShadow: isSelected ? '0 1px 4px rgba(234, 88, 12, 0.35)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onPress={() => {
                        setNewBkCategory(c.key);
                        const match = garageServices.find((pkg) => pkg.category === c.key);
                        if (match) {
                          setNewBkServiceTitle(match.title);
                          setNewBkPrice(String(getPackagePricePhp(match) || match.pricePhp || ''));
                        } else if (c.key === 'Repair') {
                          setNewBkServiceTitle('Track Diagnostic & Mechanical Repair');
                          setNewBkPrice('1500');
                        } else if (c.key === 'PMS') {
                          setNewBkServiceTitle('Pro Performance Full PMS');
                          setNewBkPrice('3750');
                        } else {
                          setNewBkServiceTitle('Parts / Accessory Installation');
                          setNewBkPrice('1500');
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Service Title & Price */}
              <Text style={styles.formLabel}>Shop Service Package</Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                {garageServices
                  .filter((pkg) => {
                    if (!newBkCategory) return true;
                    if (pkg.category === newBkCategory) return true;
                    // Legacy packages labeled Customization map to Installation
                    if (
                      newBkCategory === 'Installation' &&
                      /customization|tuning|install/i.test(String(pkg.category || ''))
                    ) {
                      return true;
                    }
                    return false;
                  })
                  .map((pkg) => {
                    const selected = newBkServiceTitle === pkg.title;
                    const price = getPackagePricePhp(pkg);
                    return (
                      <TouchableOpacity
                        key={pkg.id || pkg.service_id}
                        onPress={() => {
                          setNewBkServiceTitle(pkg.title);
                          setNewBkPrice(String(price));
                          const pkgCat = pkg.category || newBkCategory;
                          setNewBkCategory(
                            /customization|tuning/i.test(String(pkgCat || ''))
                              ? 'Installation'
                              : pkgCat
                          );
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: selected ? '#EA580C' : tokens.border,
                          backgroundColor: selected ? (isDarkMode ? 'rgba(234, 88, 12, 0.25)' : '#F0FDF4') : (isDarkMode ? tokens.bgSub : '#FFFFFF'),
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : tokens.textPrimary, flex: 1 }}>
                            {pkg.title}
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>₱{price.toLocaleString()}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                          {pkg.category} • {pkg.duration || '60 mins'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.formLabel}>Service Package Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkServiceTitle}
                    onChangeText={setNewBkServiceTitle}
                    placeholder="e.g. Pro Performance Full PMS"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Service Price (₱)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={newBkPrice}
                    onChangeText={setNewBkPrice}
                    placeholder="3750"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              {/* Customer Info */}
              <Text style={[styles.formLabel, { marginTop: 4 }]}>Customer Full Name *</Text>
              <TextInput
                style={styles.formInput}
                value={newBkCustomerName}
                onChangeText={setNewBkCustomerName}
                placeholder="e.g. Juan dela Cruz"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Contact Phone</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkCustomerPhone}
                    onChangeText={setNewBkCustomerPhone}
                    placeholder="+63 9XX XXX XXXX"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Email (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkCustomerEmail}
                    onChangeText={setNewBkCustomerEmail}
                    placeholder="juan@example.com"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Motorcycle Details */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Bike Brand</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkBikeBrand}
                    onChangeText={setNewBkBikeBrand}
                    placeholder="Yamaha, Honda, Kawasaki..."
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Bike Model</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkBikeModel}
                    onChangeText={setNewBkBikeModel}
                    placeholder="NMAX 155, Ninja 400..."
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Plate Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkPlate}
                    onChangeText={setNewBkPlate}
                    placeholder="ABC-1234"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Odometer (km)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkOdo}
                    onChangeText={setNewBkOdo}
                    placeholder="8,500 km"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              {/* Appointment Date & Slot */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Appointment Date</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkDate}
                    onChangeText={setNewBkDate}
                    placeholder="Today / Tomorrow"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Time Slot</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkTimeSlot}
                    onChangeText={setNewBkTimeSlot}
                    placeholder="10:30 AM - 12:00 PM"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Garage Branch</Text>
              <TextInput
                style={styles.formInput}
                value={newBkBranch}
                onChangeText={setNewBkBranch}
                placeholder="MotoTrack Flagship Central Hub & Pit Bays"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <Text style={styles.formLabel}>Assigned Technician</Text>
              <TextInput
                style={styles.formInput}
                value={newBkMechanic}
                onChangeText={setNewBkMechanic}
                placeholder="Assigned technician (optional / pending)"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              {/* Mandatory 20% Non-Refundable Downpayment Notice */}
              <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? tokens.chipBorder : '#BBF7D0', marginVertical: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? tokens.statusSuccessText : '#166534' }}>
                    Mandatory 20% Downpayment (Collected):
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? tokens.statusSuccessText : '#166534' }}>
                    ₱{Math.round((Number(newBkPrice) || (newBkCategory === 'PMS' ? 3750 : 6000)) * 0.20).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.statusSuccessText : '#166534', marginTop: 2 }}>
                  Anti-fake booking policy: 20% advance downpayment is collected and strictly non-refundable.
                </Text>
              </View>

              <Text style={styles.formLabel}>Special Notes & Requests</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                multiline
                value={newBkNotes}
                onChangeText={setNewBkNotes}
                placeholder="Customer symptoms, requests, pre-existing scratches..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.quickStoreBtn} onPress={() => setIsNewBookingModalOpen(false)}>
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleCreateAdminBooking}>
                <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                <Text style={styles.addBtnPrimaryText}>Confirm & Book Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD / EDIT PMS FIXED RATE (BY CC) ─── */}
      <Modal
        visible={isAddPmsRateOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pmsRateSaving) return;
          setIsAddPmsRateOpen(false);
          resetPmsRateForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 520, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPmsRate ? 'Edit Service' : 'Add Service'}
              </Text>
              <TouchableOpacity
                disabled={pmsRateSaving}
                onPress={() => {
                  setIsAddPmsRateOpen(false);
                  resetPmsRateForm();
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Service name *</Text>
              <TextInput
                style={styles.formInput}
                value={pmsRateName}
                onChangeText={setPmsRateName}
                placeholder="e.g. Replace Clutch Cable"
                placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
              />

              <Text style={styles.formLabel}>Category *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[
                  { key: CATALOG_CATEGORIES.PMS, label: 'PMS' },
                  { key: CATALOG_CATEGORIES.REPAIR, label: 'Repair Services' },
                ].map((opt) => {
                  const active = pmsRateCatalogCategory === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setPmsRateCatalogCategory(opt.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: active
                          ? isDarkMode
                            ? tokens.accentBrand
                            : '#EA580C'
                          : isDarkMode
                            ? tokens.borderInput
                            : '#E2E8F0',
                        backgroundColor: active
                          ? isDarkMode
                            ? '#132A26'
                            : '#E8F0EC'
                          : isDarkMode
                            ? tokens.bgElevated
                            : '#FFFFFF',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '600',
                          color: active
                            ? isDarkMode
                              ? tokens.accentBrand
                              : '#EA580C'
                            : isDarkMode
                              ? tokens.textMuted
                              : '#64748B',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginBottom: 12 }}>
                {CATALOG_CATEGORY_LABELS[pmsRateCatalogCategory] || pmsRateCatalogCategory}. Category is for browsing — shops may reclassify services like cable/fork/chain work.
              </Text>

              <Text style={[styles.formLabel, { marginTop: 4 }]}>
                Labor prices by motorcycle tier (₱)
              </Text>
              <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginBottom: 10 }}>
                Mark a tier as Price not configured when it does not apply. Never use ₱0 for missing prices — those bookings will be blocked.
              </Text>

              {[
                {
                  key: '125',
                  label: 'Tier 1 · 125cc and Below',
                  value: pmsRate125,
                  setValue: setPmsRate125,
                  na: pmsRate125Na,
                  setNa: setPmsRate125Na,
                },
                {
                  key: '150',
                  label: 'Tier 2 · 150cc–160cc',
                  value: pmsRate150,
                  setValue: setPmsRate150,
                  na: pmsRate150Na,
                  setNa: setPmsRate150Na,
                },
                {
                  key: 'big',
                  label: 'Tier 3 · Big bikes (200cc+)',
                  value: pmsRateBig,
                  setValue: setPmsRateBig,
                  na: pmsRateBigNa,
                  setNa: setPmsRateBigNa,
                },
              ].map((row) => (
                <View
                  key={row.key}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                    backgroundColor: isDarkMode ? tokens.bgElevated : '#F8FAFC',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                      {row.label}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const next = !row.na;
                        row.setNa(next);
                        if (next) row.setValue('');
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: row.na
                          ? isDarkMode
                            ? '#3F1D1D'
                            : '#FEE2E2'
                          : isDarkMode
                            ? '#132A26'
                            : '#E8F0EC',
                        borderWidth: 1,
                        borderColor: row.na
                          ? isDarkMode
                            ? '#7F1D1D'
                            : '#FECACA'
                          : isDarkMode
                            ? tokens.borderInput
                            : '#C8DDD3',
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: row.na
                            ? isDarkMode
                              ? tokens.statusDangerText
                              : '#B91C1C'
                            : isDarkMode
                              ? tokens.accentBrand
                              : '#EA580C',
                        }}
                      >
                        {row.na ? 'Price not configured' : 'Configured'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[
                      styles.formInput,
                      row.na && { opacity: 0.45 },
                      { marginBottom: 0 },
                    ]}
                    keyboardType="numeric"
                    editable={!row.na && !pmsRateSaving}
                    value={row.value}
                    onChangeText={row.setValue}
                    placeholder={row.na ? 'Price not configured' : 'e.g. 450'}
                    placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                disabled={pmsRateSaving}
                onPress={() => {
                  setIsAddPmsRateOpen(false);
                  resetPmsRateForm();
                }}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, pmsRateSaving && { opacity: 0.7 }]}
                disabled={pmsRateSaving}
                onPress={handleSavePmsFixedRate}
                activeOpacity={0.85}
              >
                {pmsRateSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {editingPmsRate ? 'Save Changes' : 'Add Service'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD / EDIT GARAGE SERVICE PACKAGE ─── */}
      <Modal
        visible={isAddGarageOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddGarageOpen(false);
          setEditingGarageService(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 540, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGarageService ? 'Edit Service Package' : 'Add New Service Package'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddGarageOpen(false);
                  setEditingGarageService(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Service Title *</Text>
              <TextInput
                style={styles.formInput}
                value={servTitle}
                onChangeText={setServTitle}
                placeholder="e.g. Master Brake System Flush & Bleed"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <Text style={styles.formLabel}>Subtitle / Short Tagline</Text>
              <TextInput
                style={styles.formInput}
                value={servSubtitle}
                onChangeText={setServSubtitle}
                placeholder="e.g. High Temp Motul RBF 660 Fluid Bleed"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Category</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                      borderRadius: 8,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    {['PMS', 'Repair', 'Installation'].map((cat) => {
                      const isSelected = servCategory === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 7,
                            borderRadius: 6,
                            backgroundColor: isSelected ? '#EA580C' : 'transparent',
                            boxShadow: isSelected ? '0 1px 4px rgba(234, 88, 12, 0.35)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onPress={() => setServCategory(cat)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: isSelected ? '700' : '600',
                              color: isSelected ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B',
                              transition: 'color 0.15s ease',
                            }}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Price (₱) *</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={servPrice}
                    onChangeText={setServPrice}
                    placeholder="3750"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Est. Duration</Text>
                  <TextInput
                    style={styles.formInput}
                    value={servDuration}
                    onChangeText={setServDuration}
                    placeholder="60 mins"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Badge Tag</Text>
                  <TextInput
                    style={styles.formInput}
                    value={servBadge}
                    onChangeText={setServBadge}
                    placeholder="Popular / Express"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              {/* Service Package Image */}
              <Text style={[styles.formLabel, { marginTop: 10 }]}>Package Image</Text>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                  padding: 10,
                  backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                {servImage ? (
                  <Image
                    source={{ uri: servImage }}
                    style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: isDarkMode ? tokens.bgSub : '#E2E8F0' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: isDarkMode ? tokens.bgSub : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <BootstrapIcon name="tools" size={20} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                    }}
                    onPress={async () => {
                      const res = await pickImageFromFile();
                      if (res.success && res.uri) {
                        setServImage(res.uri);
                        showToast('Service image selected!');
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="folder2-open" size={13} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                      Choose Image File
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.formInput, { marginBottom: 0, paddingVertical: 4, fontSize: 11 }]}
                    value={servImage}
                    onChangeText={setServImage}
                    placeholder="Or paste image URL"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Service Description</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                multiline
                value={servDesc}
                onChangeText={setServDesc}
                placeholder="Full description of what this service entails..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />

              <Text style={styles.formLabel}>Inclusions (One per line)</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                multiline
                value={servInclusions}
                onChangeText={setServInclusions}
                placeholder="e.g. Complete Fluid Change&#10;System Pressure Test"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  setIsAddGarageOpen(false);
                  setEditingGarageService(null);
                }}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveGarageService}>
                <Text style={styles.btnPrimaryText}>
                  {editingGarageService ? 'Save Changes' : 'Add Service'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD / EDIT CERTIFIED TECHNICIAN ─── */}
      <Modal
        visible={isAddMechanicModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddMechanicModalOpen(false);
          setEditingMechanic(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 620, maxHeight: '92%' }]}>
            {/* Header (Fixed) */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingMechanic ? 'Edit Mechanic' : 'Add Mechanic to Roster'}
                </Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                  Admin-managed pit bay roster only — technicians do not get a login account
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddMechanicModalOpen(false);
                  setEditingMechanic(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ gap: 18, paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
            >
              {/* SECTION 1 — TECHNICIAN PHOTO */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C', letterSpacing: 0.6 }}>
                  TECHNICIAN PHOTO
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  {/* Photo Placeholder / Selected Image Container */}
                  {mechAvatar ? (
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: mechAvatar }}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 16,
                          borderWidth: 2,
                          borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
                        }}
                      />
                      <TouchableOpacity
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          backgroundColor: '#DC2626',
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: '#FFFFFF',
                        }}
                        onPress={() => setMechAvatar('')}
                        title="Remove photo"
                      >
                        <BootstrapIcon name="x-lg" size={11} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        borderStyle: 'dashed',
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <BootstrapIcon name="person-fill" size={26} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>
                        No photo
                      </Text>
                    </View>
                  )}

                  {/* Actions Column */}
                  <View style={{ flex: 1, gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                      }}
                      onPress={async () => {
                        const res = await pickImageFromFile();
                        if (res.success && res.uri) {
                          setMechAvatar(res.uri);
                          showToast('Technician photo selected!');
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="camera-fill" size={13} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                        Upload Device Photo
                      </Text>
                    </TouchableOpacity>

                    {mechAvatar ? (
                      <Text style={{ fontSize: 11, color: isDarkMode ? tokens.statusSuccessText : '#059669', fontWeight: '600' }}>
                        ✓ Photo attached
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                        Upload a device photo for the technician
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />

              {/* SECTION 2 — TECHNICIAN INFORMATION */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C', letterSpacing: 0.6 }}>
                  TECHNICIAN INFORMATION
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Full Name & Credentials *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechName}
                      onChangeText={(txt) => {
                        setMechName(txt);
                        if (!editingMechanic && !mechShortName) {
                          const parts = txt.split('(')[0].trim();
                          setMechShortName(parts);
                        }
                      }}
                      placeholder="e.g. Master Tech Roberto (Ducati Certified)"
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Short Name / Nickname</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechShortName}
                      onChangeText={setMechShortName}
                      placeholder="e.g. Tech Roberto"
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    />
                  </View>
                </View>

                <Text style={styles.formLabel}>Contact Number</Text>
                <TextInput
                  style={styles.formInput}
                  value={mechPhone}
                  onChangeText={setMechPhone}
                  placeholder="e.g. 09171234567"
                  placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                  keyboardType="phone-pad"
                />

                <Text style={styles.formLabel}>Contact email (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={mechEmail}
                  onChangeText={setMechEmail}
                  placeholder="shop-contact@example.com"
                  placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                  Contact only. Mechanics cannot sign in — only admins manage the roster and bookings.
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />

              {/* SECTION 3 — CERTIFICATIONS & SPECIALIZATIONS */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '500', color: isDarkMode ? tokens.accentBrand : '#EA580C', letterSpacing: 0.6 }}>
                  CERTIFICATIONS & SPECIALIZATIONS
                </Text>

                {/* Primary Specialization (Aligned 2-Column Grid) */}
                <Text style={styles.formLabel}>Primary Specialization</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {MECHANIC_SPECIALIZATION_PRESETS.map((spec) => {
                    const isMatch =
                      mechSpecialization?.trim().toLowerCase() === spec.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={spec}
                        activeOpacity={0.75}
                        style={{
                          width: Platform.OS === 'web' ? 'calc(50% - 4px)' : '48.8%',
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 8,
                          backgroundColor: isMatch
                            ? '#EA580C'
                            : isDarkMode
                              ? '#1E293B'
                              : '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: isMatch
                            ? '#EA580C'
                            : isDarkMode
                              ? '#334155'
                              : '#CBD5E1',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                        onPress={() => setMechSpecialization(spec)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: isMatch ? '700' : '600',
                            color: isMatch
                              ? '#FFFFFF'
                              : isDarkMode
                                ? '#E2E8F0'
                                : '#334155',
                            flex: 1,
                            marginRight: 6,
                          }}
                          numberOfLines={1}
                        >
                          {spec}
                        </Text>
                        {isMatch ? (
                          <BootstrapIcon name="check-circle-fill" size={14} color="#10B981" />
                        ) : (
                          <View
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 7,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                            }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.formInput}
                  value={mechSpecialization}
                  onChangeText={setMechSpecialization}
                  placeholder="e.g. Desmo Valve Clearance & Superbike Electronics"
                  placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                />

                {/* Certifications & Experience */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>OEM Certifications & Badges</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechCertifications}
                      onChangeText={setMechCertifications}
                      placeholder="e.g. Yamaha YTA Gold • Öhlins Factory Center"
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Experience</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechExperience}
                      onChangeText={setMechExperience}
                      placeholder="e.g. 7 Years Pro Tech"
                      placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    />
                  </View>
                </View>

                {/* Status */}
                <Text style={styles.formLabel}>Initial Status</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                  {[
                    { id: 'Available', label: '🟢 Available on Duty', desc: 'Ready for booking assignment' },
                    { id: 'In Pit Bay', label: '🟠 In Pit Bay', desc: 'Currently working on bike' },
                  ].map((st) => {
                    const isSelected = mechStatus === st.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#EA580C' : tokens.borderInput,
                          backgroundColor: isSelected ? (isDarkMode ? 'rgba(234, 88, 12, 0.25)' : '#F3F7F6') : (isDarkMode ? tokens.bgSub : '#FFFFFF'),
                        }}
                        onPress={() => setMechStatus(st.id)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: isSelected ? (isDarkMode ? tokens.accentBrand : '#EA580C') : tokens.textPrimary,
                            marginBottom: 2,
                          }}
                        >
                          {st.label}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{st.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Footer (Fixed) */}
            <View style={[styles.modalFooter, { borderTopWidth: 1, borderColor: isDarkMode ? tokens.border : '#E2E8F0', paddingTop: 14 }]}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  setIsAddMechanicModalOpen(false);
                  setEditingMechanic(null);
                }}
              >
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleSaveMechanic}>
                <BootstrapIcon
                  name={editingMechanic ? 'check-lg' : 'person-plus-fill'}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.addBtnPrimaryText}>
                  {editingMechanic ? 'Save Changes' : 'Add to Roster'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD / EDIT DELIVERY RIDER ─── */}
      <Modal
        visible={isAddRiderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddRiderModalOpen(false);
          setEditingRider(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 520, maxHeight: '90%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }]}>
            <View style={[styles.modalHeader, { flexShrink: 0 }]}>
              <Text style={styles.modalTitle}>
                {editingRider ? 'Edit Rider Account' : 'Invite Rider Account'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddRiderModalOpen(false);
                  setEditingRider(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[styles.modalBody, { flex: 1, minHeight: 0, maxHeight: undefined }]}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.formLabel}>Rider Photo / Avatar</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                {riderAvatar ? (
                  <Image
                    source={{ uri: riderAvatar }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      borderWidth: 2,
                      borderColor: isDarkMode ? tokens.accentBorder : '#EA580C',
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      borderWidth: 2,
                      borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                      borderStyle: 'dashed',
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="person-fill" size={24} color={isDarkMode ? tokens.textMuted : "#94A3B8"} />
                  </View>
                )}

                <View style={{ flex: 1, gap: 6 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: isDarkMode ? '#EA580C' : '#EA580C',
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      alignSelf: 'flex-start',
                    }}
                    onPress={async () => {
                      const res = await pickImageFromFile();
                      if (res.success && res.uri) {
                        setRiderAvatar(res.uri);
                        showToast('Rider photo selected!');
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="camera-fill" size={13} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                      Upload Device Photo
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.formInput, { marginBottom: 0, paddingVertical: 4, fontSize: 11 }]}
                    value={riderAvatar}
                    onChangeText={setRiderAvatar}
                    placeholder="Or paste image URL"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderName}
                    onChangeText={(txt) => {
                      setRiderName(txt);
                      if (!editingRider && !riderShortName) {
                        setRiderShortName(txt.trim().split(' ')[0] || '');
                      }
                    }}
                    placeholder="e.g. Juan Dela Cruz"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Short Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderShortName}
                    onChangeText={setRiderShortName}
                    placeholder="e.g. Juan"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Phone *</Text>
              <TextInput
                style={styles.formInput}
                value={riderPhone}
                onChangeText={setRiderPhone}
                placeholder="e.g. 09171234567"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Rider ID</Text>
              <TextInput
                style={[styles.formInput, editingRider && { backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC' }]}
                value={riderIdInput}
                onChangeText={setRiderIdInput}
                placeholder="e.g. rider-juan (optional, auto if blank)"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                autoCapitalize="none"
                editable={!editingRider}
              />

              {editingRider ? (
                <>
                  <Text style={styles.formLabel}>Login email</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9' }]}
                    value={riderEmail}
                    editable={false}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.formLabel}>Email *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderEmail}
                    onChangeText={setRiderEmail}
                    placeholder="rider@store.com"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </>
              )}

              <Text style={styles.formLabel}>Account status (login)</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {Object.values(RIDER_ACCOUNT_STATUSES).map((st) => {
                  const isSelected = riderAccountStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      activeOpacity={0.75}
                      onPress={() => setRiderAccountStatus(st)}
                      style={{
                        flex: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EA580C' : isDarkMode ? '#334155' : '#CBD5E1',
                        backgroundColor: isSelected ? '#EA580C' : isDarkMode ? '#1E293B' : '#F8FAFC',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected ? '#FFFFFF' : isDarkMode ? '#E2E8F0' : '#334155',
                          flex: 1,
                        }}
                      >
                        {st}
                      </Text>
                      {isSelected ? (
                        <BootstrapIcon name="check-circle-fill" size={14} color="#10B981" />
                      ) : (
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Vehicle</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderVehicle}
                    onChangeText={setRiderVehicle}
                    placeholder="e.g. Yamaha NMAX 155"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Plate Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderPlate}
                    onChangeText={setRiderPlate}
                    placeholder="e.g. NMX-1001"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Fleet Delivery Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {Object.values(RIDER_STATUSES).map((st) => {
                  const isSelected = riderStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      activeOpacity={0.75}
                      onPress={() => setRiderStatus(st)}
                      style={{
                        flex: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 9,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EA580C' : isDarkMode ? '#334155' : '#CBD5E1',
                        backgroundColor: isSelected ? '#EA580C' : isDarkMode ? '#1E293B' : '#F8FAFC',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected ? '#FFFFFF' : isDarkMode ? '#E2E8F0' : '#334155',
                        }}
                      >
                        {st}
                      </Text>
                      {isSelected && (
                        <BootstrapIcon name="check-circle-fill" size={12} color="#10B981" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 64, textAlignVertical: 'top' }]}
                value={riderNotes}
                onChangeText={setRiderNotes}
                placeholder="Optional notes..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                multiline
              />
            </ScrollView>

            <View style={[styles.modalFooter, { flexShrink: 0, marginTop: 12 }]}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  setIsAddRiderModalOpen(false);
                  setEditingRider(null);
                }}
              >
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleSaveRider}>
                <BootstrapIcon
                  name={editingRider ? 'check-lg' : 'person-plus-fill'}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.addBtnPrimaryText}>
                  {editingRider ? 'Save Changes' : 'Send OTP Invite'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD / EDIT SUPPLIER PARTNER ─── */}
      <Modal
        visible={isAddSupplierModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 580, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingSupplier ? 'Edit Supplier Partner' : 'Add New Supplier Partner'}
                </Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                  Procurement source, catalog categories, and fulfillment logistics
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddSupplierModalOpen(false);
                  setEditingSupplier(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Supplier / Company Name */}
              <Text style={styles.formLabel}>Supplier / Company Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Akrapovič Racing Exhausts, Brembo SpA..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                value={supName}
                onChangeText={setSupName}
              />

              {/* Contact Person */}
              <Text style={styles.formLabel}>Account Executive / Contact Person</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Matteo Rossi, Regional Sales Manager"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                value={supContactPerson}
                onChangeText={setSupContactPerson}
              />

              {/* Two Column: Email & Phone */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Contact Email</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="supply@company.com"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    keyboardType="email-address"
                    value={supEmail}
                    onChangeText={setSupEmail}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Phone / Hotline</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="+63 917 123 4567"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    keyboardType="phone-pad"
                    value={supPhone}
                    onChangeText={setSupPhone}
                  />
                </View>
              </View>

              {/* Address / Headquarters */}
              <Text style={styles.formLabel}>Warehouse / Distribution Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Bergamo, Italy / Laguna Technopark, PH"
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                value={supAddress}
                onChangeText={setSupAddress}
              />

              {/* Supplied Category Field & Presets */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 }}>
                <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>
                  Supplied Category *
                </Text>
                {Boolean(
                  supCategories?.trim() &&
                  !SUPPLIER_CATEGORY_PRESETS.some(
                    (c) => c.toLowerCase() === supCategories.trim().toLowerCase()
                  )
                ) && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : '#F0F9FF',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#0284C7' : '#BAE6FD',
                      }}
                    >
                      <BootstrapIcon name="pencil" size={10} color={isDarkMode ? '#38BDF8' : '#0284C7'} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#38BDF8' : '#0284C7' }}>
                        Custom Category
                      </Text>
                    </View>
                  )}
              </View>

              <View style={{ position: 'relative', marginBottom: 10 }}>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      paddingRight: supCategories ? 38 : 14,
                      marginBottom: 0,
                    },
                  ]}
                  placeholder="e.g. Exhaust & Performance, Custom Helmets, Gear..."
                  placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                  value={supCategories}
                  onChangeText={setSupCategories}
                />
                {Boolean(supCategories) && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setSupCategories('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: [{ translateY: -11 }],
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Clear category"
                  >
                    <BootstrapIcon name="x" size={14} color={isDarkMode ? '#CBD5E1' : '#64748B'} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Presets Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Category Presets
                </Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>
                  Select preset or type custom above
                </Text>
              </View>

              {/* Aligned 2-Column Grid */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {SUPPLIER_CATEGORY_PRESETS.map((cat) => {
                  const isSelected =
                    supCategories?.trim().toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      activeOpacity={0.75}
                      style={{
                        width: Platform.OS === 'web' ? 'calc(50% - 4px)' : '48.8%',
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 8,
                        backgroundColor: isSelected
                          ? '#EA580C'
                          : isDarkMode
                            ? '#1E293B'
                            : '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: isSelected
                          ? '#EA580C'
                          : isDarkMode
                            ? '#334155'
                            : '#CBD5E1',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onPress={() => setSupCategories(cat)}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected
                            ? '#FFFFFF'
                            : isDarkMode
                              ? '#E2E8F0'
                              : '#475569',
                          flex: 1,
                          marginRight: 6,
                        }}
                        numberOfLines={1}
                      >
                        {cat}
                      </Text>
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected
                            ? '#22C55E'
                            : isDarkMode
                              ? '#334155'
                              : '#E2E8F0',
                        }}
                      >
                        {isSelected ? (
                          <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                        ) : (
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: isDarkMode ? '#64748B' : '#94A3B8',
                            }}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Two Column: Lead Time & Reliability Rating */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Restock Lead Time</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 3-5 Days, 1-2 Weeks"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    value={supLeadTime}
                    onChangeText={setSupLeadTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Quality Score (1.0 - 5.0)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="5.0"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                    keyboardType="numeric"
                    value={supRating}
                    onChangeText={setSupRating}
                  />
                </View>
              </View>

              {/* Status Radio Pills */}
              <Text style={styles.formLabel}>Vendor Status</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {[
                  { id: 'Active', label: 'Active Partner', color: isDarkMode ? tokens.statusSuccessText : '#10B981' },
                  { id: 'Pending', label: 'Pending Review', color: isDarkMode ? tokens.statusWarningText : '#F59E0B' },
                  { id: 'Inactive', label: 'Inactive / On Hold', color: isDarkMode ? tokens.textMuted : '#64748B' },
                ].map((st) => {
                  const selected = supStatus === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected
                          ? isDarkMode
                            ? 'rgba(234, 88, 12,0.3)'
                            : '#E8F0EC'
                          : isDarkMode
                            ? '#1E293B'
                            : '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: selected
                          ? '#EA580C'
                          : isDarkMode
                            ? '#334155'
                            : '#E2E8F0',
                      }}
                      onPress={() => setSupStatus(st.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 3.5,
                            backgroundColor: st.color,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: selected ? '600' : '500',
                            color: selected
                              ? '#EA580C'
                              : isDarkMode
                                ? '#94A3B8'
                                : '#475569',
                          }}
                        >
                          {st.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes & Contract Terms */}
              <Text style={styles.formLabel}>Procurement Notes & Terms (Optional)</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top', paddingTop: 8 }]}
                placeholder="e.g. OEM Certified Direct Importer, NET 30 payment term, minimum batch order of 10 units..."
                placeholderTextColor={isDarkMode ? tokens.placeholder : "#94A3B8"}
                multiline
                numberOfLines={3}
                value={supNotes}
                onChangeText={setSupNotes}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  setIsAddSupplierModalOpen(false);
                  setEditingSupplier(null);
                }}
              >
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleSaveSupplier}>
                <BootstrapIcon
                  name={editingSupplier ? 'check-lg' : 'plus-lg'}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.addBtnPrimaryText}>
                  {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 6: MOBILE ADMIN MORE MENU SHEET ─── */}
      <Modal
        visible={isMobileMoreOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMobileMoreOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setIsMobileMoreOpen(false)}
          />
          <View style={styles.mobileMoreSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? tokens.statusWarningBg : '#FEF3C7',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <BootstrapIcon name="grid-fill" size={16} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                </View>
                <Text style={styles.modalTitle}>Admin Management Menu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsMobileMoreOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? tokens.textMuted : "#64748B"} />
              </TouchableOpacity>
            </View>

            <View style={styles.mobileMoreGrid}>
              {/* Products */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'products' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('products');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="tag-fill"
                  size={20}
                  color={activeNav === 'products' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Products</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{products.length} products</Text>
                </View>
              </TouchableOpacity>

              {/* Orders & Fulfillment */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'orders' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('orders');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="receipt"
                  size={20}
                  color={activeNav === 'orders' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Orders & COD</Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: pendingCodCount > 0 ? '#D97706' : '#64748B',
                      fontWeight: pendingCodCount > 0 ? '700' : '400',
                    }}
                  >
                    {pendingCodCount > 0 ? `${pendingCodCount} Pending COD` : `${orders.length} orders`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Promos */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'promos' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('promos');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="ticket-perforated-fill"
                  size={20}
                  color={activeNav === 'promos' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Promo Codes</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{promos.length} active vouchers</Text>
                </View>
              </TouchableOpacity>

              {/* Suppliers */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'suppliers' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('suppliers');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="truck"
                  size={20}
                  color={activeNav === 'suppliers' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Supplier</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{suppliers.length} vendors</Text>
                </View>
              </TouchableOpacity>

              {/* Garage */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'garage' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('garage');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="tools"
                  size={20}
                  color={activeNav === 'garage' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Pitstop Services</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>PMS & Tuning</Text>
                </View>
              </TouchableOpacity>

              {/* Mechanics */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'mechanics' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('mechanics');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="person-badge-fill"
                  size={20}
                  color={activeNav === 'mechanics' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Mechanics & Crew</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{garageMechanics.length} certified</Text>
                </View>
              </TouchableOpacity>

              {/* Riders */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'riders' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('riders');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="bicycle"
                  size={20}
                  color={activeNav === 'riders' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Riders</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{deliveryRiders.length} delivery staff</Text>
                </View>
              </TouchableOpacity>

              {/* Users */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'users' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('users');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="people-fill"
                  size={20}
                  color={activeNav === 'users' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>User Accounts</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{usersList.length} registered</Text>
                </View>
              </TouchableOpacity>

              {/* Ratings & Reports */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'ratings_reports' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('ratings_reports');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="star"
                  size={20}
                  color={activeNav === 'ratings_reports' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Ratings & reports</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                    {newReportsCount > 0 ? `${newReportsCount} new reports` : 'Customer feedback'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Supabase DB */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'supabase' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('supabase');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="database-fill-gear"
                  size={20}
                  color={activeNav === 'supabase' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Supabase DB</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Cloud Database</Text>
                </View>
              </TouchableOpacity>

              {/* Forecast & Stock */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'forecast' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('forecast');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="clipboard-data"
                  size={20}
                  color={activeNav === 'forecast' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Forecast & Stock</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Demand & restock planner</Text>
                </View>
              </TouchableOpacity>

              {/* Activity Logs */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'audit' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('audit');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="journal-text"
                  size={20}
                  color={activeNav === 'audit' ? '#EA580C' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Activity Logs</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>{auditLogs.length} tracked records</Text>
                </View>
              </TouchableOpacity>

              {/* Notifications Center */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'notifications' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('notifications');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="bell-fill"
                  size={20}
                  color={activeNav === 'notifications' ? '#EA580C' : '#475569'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>Notifications</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                    {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} unread alerts` : 'All alerts read'}
                  </Text>
                </View>
                {unreadNotificationsCount > 0 && (
                  <View
                    style={{
                      backgroundColor: '#E11D48',
                      borderRadius: 10,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* System Settings */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'settings' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('settings');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon
                  name="gear-fill"
                  size={20}
                  color={activeNav === 'settings' ? '#EA580C' : '#475569'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>System Settings</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Store rules & maintenance</Text>
                </View>
              </TouchableOpacity>

              {/* Change Password */}
              <TouchableOpacity
                style={[
                  styles.mobileMoreCard,
                  { backgroundColor: isDarkMode ? '#142826' : '#F3F7F6', borderColor: isDarkMode ? '#1F4742' : '#C8DDD3' },
                ]}
                onPress={() => {
                  setIsMobileMoreOpen(false);
                  setIsAdminAccountOpen(true);
                }}
              >
                <BootstrapIcon name="key-fill" size={20} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                    Change Password
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                    Account & login password
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Change Security PIN */}
              <TouchableOpacity
                style={[
                  styles.mobileMoreCard,
                  { backgroundColor: isDarkMode ? '#142826' : '#FFF7ED', borderColor: isDarkMode ? '#1F4742' : '#FED7AA' },
                ]}
                onPress={() => {
                  setIsMobileMoreOpen(false);
                  setIsAdminPinModalOpen(true);
                }}
              >
                <BootstrapIcon name="shield-lock-fill" size={20} color={isDarkMode ? tokens.accentBrand : '#EA580C'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                    Change Security PIN
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>
                    Console lock PIN
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Dark Mode Toggle */}
              <TouchableOpacity
                style={[
                  styles.mobileMoreCard,
                  isDarkMode && { backgroundColor: '#1E293B', borderColor: '#334155' },
                ]}
                onPress={() => {
                  toggleDarkMode();
                  showToast(isDarkMode ? 'Switched to Light Theme' : 'Switched to Dark Theme');
                }}
              >
                <BootstrapIcon
                  name={isDarkMode ? 'sun-fill' : 'moon-stars-fill'}
                  size={20}
                  color={isDarkMode ? tokens.statusWarningText : '#64748B'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                    {isDarkMode ? 'Switch Theme' : 'Night Display'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Live Storefront */}
              <TouchableOpacity
                style={[
                  styles.mobileMoreCard,
                  {
                    backgroundColor: isDarkMode ? '#142826' : '#FEF3C7',
                    borderColor: isDarkMode ? '#1F4742' : '#FDE68A',
                  },
                ]}
                onPress={() => {
                  setIsMobileMoreOpen(false);
                  onNavigateToStore?.();
                }}
              >
                <BootstrapIcon name="shop" size={20} color={isDarkMode ? tokens.accentBrand : "#EA580C"} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>Live Storefront</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.accentBrand : '#EA580C' }}>View Store</Text>
                </View>
              </TouchableOpacity>

              {/* Log Out */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, { backgroundColor: isDarkMode ? tokens.statusDangerBg : '#FEE2E2', borderColor: isDarkMode ? tokens.chipBorder : '#FECACA' }]}
                onPress={() => {
                  setIsMobileMoreOpen(false);
                  try {
                    adminSecurityService.lockSession(currentUser);
                    setIsAdminUnlocked(false);
                  } catch (_e) { }
                  if (onLogout) {
                    onLogout();
                  } else {
                    logout?.();
                    onNavigateToStore?.();
                  }
                }}
              >
                <BootstrapIcon name="box-arrow-right" size={20} color={isDarkMode ? tokens.statusDangerText : "#DC2626"} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.statusDangerText : '#DC2626' }}>Log Out</Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.statusDangerText : '#DC2626' }}>Exit Backoffice</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ORDER DETAILS & FULFILLMENT CONTROL ─── */}
      <AdminOrderDetailsModal
        visible={isOrderModalOpen}
        order={selectedOrderForModal}
        deliveryDetail={orderDeliveryDetail}
        deliveryHistory={orderDeliveryHistory}
        isDarkMode={isDarkMode}
        isDesktop={isDesktop}
        tokens={tokens}
        styles={styles}
        showConfirm={showConfirm}
        onClose={() => setIsOrderModalOpen(false)}
        onApprove={handleApproveCOD}
        onRetryEmail={handleRetryCodApprovalEmail}
        onAdvanceStatus={handleAdvanceOrderStatus}
        onReject={handleRejectOrder}
        onCancel={handleCancelOrder}
        onAssignRider={(ord) => {
          setAssignDeliveryOrder({
            ...ord,
            expected_delivery_at:
              orderDeliveryDetail?.expected_delivery_at || ord?.expected_delivery_at,
            expected_delivery_end_at:
              orderDeliveryDetail?.expected_delivery_end_at || ord?.expected_delivery_end_at,
          });
        }}
        onOpenQr={(ord) => setDeliveryTokenModal({ order: ord, bundle: null })}
        onOpenRiderAccess={(payload) => setRiderAccessModal(payload)}
        onDeliveryAction={(payload) => setDeliveryAction(payload)}
        onUploadProof={handleUploadProof}
        onViewProof={(payload) => setProofViewer(payload)}
        onProcessReturn={handleProcessReturn}
        onPrint={() => {
          showToast('Receipt download initiated / print ready');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.print?.();
          }
        }}
      />

      {/* ─── 3. ADMIN MOBILE BOTTOM NAVIGATION BAR (MOBILE ONLY) ─── */}
      {!isDesktop && (
        <View style={styles.bottomNavWrapper}>
          {/* 1. Overview */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => {
              setActiveNav('overview');
              setIsMobileMoreOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[styles.bottomNavIconWrap, activeNav === 'overview' && styles.bottomNavIconWrapActive]}
            >
              <BootstrapIcon
                name="grid-1x2-fill"
                size={17}
                color={activeNav === 'overview' ? '#EA580C' : '#64748B'}
              />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'overview' && styles.bottomNavLabelActive]}>
              Dashboard
            </Text>
          </TouchableOpacity>

          {/* 2. Inventory */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => {
              setActiveNav('inventory');
              setIsMobileMoreOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.bottomNavIconWrap,
                activeNav === 'inventory' && styles.bottomNavIconWrapActive,
              ]}
            >
              <BootstrapIcon
                name="box-seam-fill"
                size={17}
                color={activeNav === 'inventory' ? '#EA580C' : '#64748B'}
              />
              {invStats.lowStockCount > 0 && (
                <View style={styles.bottomNavDot} />
              )}
            </View>
            <Text
              style={[
                styles.bottomNavLabel,
                activeNav === 'inventory' && styles.bottomNavLabelActive,
              ]}
            >
              Inventory
            </Text>
          </TouchableOpacity>

          {/* 3. POS Cashier */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => {
              setActiveNav('pos');
              setIsMobileMoreOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.bottomNavIconWrap, activeNav === 'pos' && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon
                name="cart-check-fill"
                size={17}
                color={activeNav === 'pos' ? '#EA580C' : '#64748B'}
              />
              {posCart.length > 0 && (
                <View style={styles.bottomNavDot} />
              )}
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'pos' && styles.bottomNavLabelActive]}>
              POS
            </Text>
          </TouchableOpacity>

          {/* 4. Analytics */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => {
              setActiveNav('analytics');
              setIsMobileMoreOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[styles.bottomNavIconWrap, activeNav === 'analytics' && styles.bottomNavIconWrapActive]}
            >
              <BootstrapIcon
                name="graph-up-arrow"
                size={17}
                color={activeNav === 'analytics' ? '#EA580C' : '#64748B'}
              />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'analytics' && styles.bottomNavLabelActive]}>
              Analytics
            </Text>
          </TouchableOpacity>

          {/* 5. Orders */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => {
              setActiveNav('orders');
              setIsMobileMoreOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[styles.bottomNavIconWrap, activeNav === 'orders' && styles.bottomNavIconWrapActive]}
            >
              <BootstrapIcon
                name="receipt"
                size={17}
                color={activeNav === 'orders' ? '#EA580C' : '#64748B'}
              />
              {pendingCodCount > 0 && (
                <View style={styles.bottomNavDot} />
              )}
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'orders' && styles.bottomNavLabelActive]}>
              Orders
            </Text>
          </TouchableOpacity>

          {/* 6. More Options */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => setIsMobileMoreOpen(true)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.bottomNavIconWrap,
                ['products', 'orders', 'promos', 'garage', 'users', 'supabase', 'forecast', 'audit'].includes(activeNav) &&
                styles.bottomNavIconWrapActive,
              ]}
            >
              <BootstrapIcon
                name="three-dots"
                size={18}
                color={
                  ['products', 'orders', 'promos', 'garage', 'users', 'supabase', 'forecast', 'audit'].includes(activeNav)
                    ? '#EA580C'
                    : '#64748B'
                }
              />
              {pendingCodCount > 0 && (
                <View style={styles.bottomNavDot} />
              )}
            </View>
            <Text
              style={[
                styles.bottomNavLabel,
                ['products', 'orders', 'promos', 'garage', 'users', 'supabase', 'forecast', 'audit'].includes(activeNav) &&
                styles.bottomNavLabelActive,
              ]}
            >
              More
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── ASSIGN DELIVERY MODAL ─── */}
      <AssignDeliveryModal
        visible={Boolean(assignDeliveryOrder)}
        order={assignDeliveryOrder}
        adminUser={currentUser}
        onClose={() => setAssignDeliveryOrder(null)}
        onSuccess={async (delivery, tokenBundle, riderAccess) => {
          const assignedOrder = assignDeliveryOrder;
          setAssignDeliveryOrder(null);
          await loadData();
          const oid = selectedOrderForModal?.order_id || selectedOrderForModal?.id;
          if (oid) {
            await refreshOrderDeliveryPanel(oid);
            setSelectedOrderForModal((prev) => {
              if (!prev) return prev;
              const newStatus =
                delivery?.delivery_status === 'out_for_delivery' || delivery?.delivery_status === 'shipped'
                  ? 'Out for Delivery'
                  : 'Ready for Delivery';
              return {
                ...prev,
                status: newStatus,
                rider_name: delivery?.rider_name || assignedOrder?.rider_name || prev.rider_name,
                rider_contact: delivery?.rider_contact || assignedOrder?.rider_contact || prev.rider_contact,
                rider_id: delivery?.rider_id || assignedOrder?.rider_id || prev.rider_id,
                delivery_status: delivery?.delivery_status || newStatus,
              };
            });
          }
          if (tokenBundle?.token || tokenBundle?.confirmUrl) {
            setDeliveryTokenModal({
              order: assignedOrder,
              bundle: tokenBundle,
            });
          }
          if (riderAccess?.success || riderAccess?.dashboardUrl || riderAccess?.token) {
            setRiderAccessModal({
              rider: {
                id: delivery?.rider_id || assignedOrder?.rider_id,
                name: delivery?.rider_name || assignedOrder?.rider_name,
                phone: delivery?.rider_contact || assignedOrder?.rider_contact,
              },
              bundle: riderAccess,
            });
          }
        }}
        showToast={showToast}
      />

      <DeliveryTokenModal
        visible={Boolean(deliveryTokenModal)}
        order={deliveryTokenModal?.order}
        adminUser={currentUser}
        initialBundle={deliveryTokenModal?.bundle || null}
        onClose={() => setDeliveryTokenModal(null)}
        showToast={showToast}
      />

      <Modal
        visible={Boolean(proofViewer?.uri)}
        transparent
        animationType="fade"
        onRequestClose={() => setProofViewer(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.88)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: isDarkMode ? '#141A18' : '#fff',
              borderRadius: 16,
              overflow: 'hidden',
              maxWidth: 720,
              width: '100%',
              alignSelf: 'center',
              maxHeight: '92%',
              borderWidth: 1,
              borderColor: tokens.border,
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
                borderBottomColor: tokens.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.textPrimary }}>
                  Proof of delivery
                </Text>
                <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                  {proofViewer?.orderId ? `Order #${proofViewer.orderId}` : 'Delivery photo'}
                  {proofViewer?.riderName ? ` · ${proofViewer.riderName}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setProofViewer(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? '#CBD5E1' : '#334155'} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {proofViewer?.uri ? (
                <Image
                  source={{ uri: proofViewer.uri }}
                  resizeMode="contain"
                  style={{
                    width: '100%',
                    height: 420,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? '#0E1311' : '#0F172A',
                  }}
                />
              ) : null}
              {proofViewer?.reportedAt ? (
                <Text style={{ fontSize: 13, color: tokens.textSecondary }}>
                  Reported:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {new Date(proofViewer.reportedAt).toLocaleString()}
                  </Text>
                </Text>
              ) : null}
              {proofViewer?.notes ? (
                <View
                  style={{
                    backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    Rider notes
                  </Text>
                  <Text style={{ fontSize: 13, color: tokens.textPrimary, lineHeight: 18 }}>
                    {proofViewer.notes}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#94A3B8' }}>No rider notes attached.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <RiderAccessModal
        visible={Boolean(riderAccessModal)}
        rider={riderAccessModal?.rider}
        adminUser={currentUser}
        initialBundle={riderAccessModal?.bundle || null}
        onClose={() => setRiderAccessModal(null)}
        showToast={showToast}
      />

      <DeliveryAdminActionModal
        visible={Boolean(deliveryAction)}
        mode={deliveryAction?.mode || 'rider_report'}
        order={deliveryAction?.order}
        adminUser={currentUser}
        onClose={() => setDeliveryAction(null)}
        onSuccess={async (res) => {
          const oid =
            deliveryAction?.order?.order_id ||
            deliveryAction?.order?.id ||
            selectedOrderForModal?.order_id ||
            selectedOrderForModal?.id;
          setDeliveryAction(null);
          await loadData();
          if (oid && selectedOrderForModal && (selectedOrderForModal.order_id === oid || selectedOrderForModal.id === oid)) {
            const nextStatus =
              deliveryAction?.mode === 'mark_delivered'
                ? 'Delivered'
                : res?.delivery?.delivery_status || 'Delivered';
            setSelectedOrderForModal((prev) =>
              prev
                ? {
                  ...prev,
                  status: nextStatus,
                  rider_reported_delivered: Boolean(res?.delivery?.rider_reported_delivered),
                  admin_confirmed: Boolean(res?.delivery?.admin_confirmed),
                }
                : prev
            );
            await refreshOrderDeliveryPanel(oid);
          }
        }}
        showToast={showToast}
      />

      {/* ─── CUSTOM CENTER CONFIRMATION & ALERT DIALOG MODAL ─── */}
      <ConfirmModal
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        itemName={confirmDialog.itemName}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        confirmIcon={confirmDialog.confirmIcon}
        hideCancel={confirmDialog.hideCancel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, visible: false }))}
      />

      {/* ─── ADMIN ACCOUNT: CHANGE PASSWORD MODAL (SEPARATE FROM PIN) ─── */}
      <AdminAccountSettingsModal
        visible={isAdminAccountOpen}
        onClose={() => setIsAdminAccountOpen(false)}
        onSaved={() => setIsAdminAccountOpen(false)}
        onSwitchToPin={() => {
          setIsAdminAccountOpen(false);
          setIsAdminPinModalOpen(true);
        }}
        showToast={showToast}
      />

      {/* ─── ADMIN SECURITY PIN MODAL (SEPARATE FROM PASSWORD) ─── */}
      <AdminPinSettingsModal
        visible={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        onSaved={() => setIsAdminPinModalOpen(false)}
        onSwitchToPassword={() => {
          setIsAdminPinModalOpen(false);
          setIsAdminAccountOpen(true);
        }}
        showToast={showToast}
      />

    </SafeAreaView>
  );
}
