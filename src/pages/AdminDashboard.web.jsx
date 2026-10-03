import { createPortal } from 'react-dom';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { getAdminStyles, getAdminThemeTokens } from '../styles/web/admin.web.styles';
import { appStorage } from '../services/storageAdapter';
import { productService, resolveReorderLevel, isLowStock } from '../services/productService';
import { promoService } from '../services/promoService';
import { orderService } from '../services/orderService';
import { deliveryService } from '../services/deliveryService';
import {
  garageService,
  GARAGE_BRANCHES,
  TIME_SLOTS,
  MECHANIC_SPECIALIZATION_PRESETS,
  MECHANIC_AVATAR_PRESETS,
  getPackagePricePhp,
} from '../services/garageService';
import {
  riderService,
  RIDER_STATUSES,
  RIDER_ACCOUNT_STATUSES,
  RIDER_AVATAR_PRESETS,
} from '../services/riderService';
import { supplierService, SUPPLIER_CATEGORY_PRESETS } from '../services/supplierService';
import { excelService } from '../services/excelService';

import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { adminSecurityService } from '../services/adminSecurityService';
import { AdminPinLockScreen, ConfirmModal, ProfileModal, AssignDeliveryModal, DeliveryAdminActionModal, DeliveryTokenModal, RiderAccessModal } from '../components/modals';
import { notificationService } from '../services/notificationService';
import { supabaseManager } from '../services/supabaseClient';
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
} from '../utils/bookingWorkflow';
import { AdminStatCard, BootstrapIcon, BrandLogo, ExpectedDeliveryEditor, BookingCalendar, NotificationDropdown } from '../components/common';
import { pickImageFromFile } from '../utils/imagePickerHelper';
import { usdToPhp } from '../utils/currency';
import { systemSettingsService } from '../services/systemSettingsService';
import NotificationsPage from './NotificationsPage.web';
import { auditLogService } from '../services/auditLogService';
import { SalesForecastPanel, RevenueTrendChart, BookingCategoryPieChart, ProductSizesEditor, ProductColorsEditor, CustomizationsAdminPanel, ServiceQuotationPanel, PickupQrScannerPanel, AdminBookingManager, AdminBookingDetailsPanel, MotorcycleModelsAdminPanel, ProductCompatibilityPicker } from '../components/admin';
import {
  cartLineKey,
  getProductSizeEntries,
  getSizePrice,
  isSizeSoldOut,
  normalizeProductSizes,
  productNeedsSizes,
  serializeProductSizes,
  validateSizeDrafts,
} from '../utils/productSizes';
import { normalizeProductColors, serializeProductColors, validateColorDrafts } from '../utils/productColors';
import { CATEGORY_NAMES, ADMIN_IMAGE_PRESETS } from '../data/motorParts';

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
            fontWeight: '900',
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
          backgroundColor: '#F97316',
          boxShadow: hovered ? '0 0 12px #EA580C, 0 0 4px #F97316' : '0 0 6px #F97316',
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
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

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
      } catch (_e) {}
      return next;
    });
  };

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }, [isDarkMode]);

  const themeTokens = useMemo(() => getAdminThemeTokens(isDarkMode), [isDarkMode]);
  const tokens = themeTokens;
  const styles = useMemo(() => getAdminStyles(isDarkMode), [isDarkMode]);

  const { currentUser: authUser, logout, setRedirectReason, adminLogin } = useAuth();
  const currentUser = authUser || authService.getCurrentUser();

  // Active Navigation Tab: 'overview' | 'orders' | 'inventory' | 'pos' | 'analytics' | 'forecast' | 'products' | 'promos' | 'garage' | 'users' | 'supabase'
  const [activeNav, setActiveNav] = useState('overview');

  // Admin PIN Unlock State (Locks by default when leaving/entering)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

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
        adminSecurityService.lockSession();
        setIsAdminUnlocked(false);
        onNavigateToStore?.();
      },
    });
  };

  // Core Data States
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [garageServices, setGarageServices] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [overviewModuleCategory, setOverviewModuleCategory] = useState('all');

  // ─── ORDERS & COD MANAGEMENT STATE ───
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All'); // 'All' | 'Pending Approval' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'
  const [isOrderStatusDropdownOpen, setIsOrderStatusDropdownOpen] = useState(false);
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All'); // 'All' | 'COD' | 'GCash' | 'Card'
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
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

  // ─── PROMOS STATE ───
  const [isAddPromoOpen, setIsAddPromoOpen] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPercent, setNewPromoPercent] = useState('20');
  const [newPromoDesc, setNewPromoDesc] = useState('');

  // ─── GARAGE & BOOKINGS STATE ───
  const [garageSubTab, setGarageSubTab] = useState('bookings'); // 'bookings' | 'services'
  const [isGarageSubTabDropdownOpen, setIsGarageSubTabDropdownOpen] = useState(false);
  const [garageBookings, setGarageBookings] = useState([]);
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('All'); // 'All' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
  const [isBookingStatusDropdownOpen, setIsBookingStatusDropdownOpen] = useState(false);
  const [bookingCategoryFilter, setBookingCategoryFilter] = useState('All'); // 'All' | 'PMS' | 'Customization'
  const [bookingViewMode, setBookingViewMode] = useState('table'); // 'table' | 'calendar' | 'workflow'
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

  // ─── MECHANICS & TECHNICIANS STATE ───
  const [garageMechanics, setGarageMechanics] = useState(() => garageService.getMechanics());
  const [mechanicSearchQuery, setMechanicSearchQuery] = useState('');
  const [mechanicFilterStatus, setMechanicFilterStatus] = useState('All'); // 'All' | 'Available' | 'In Pit Bay'
  const [isMechanicFilterDropdownOpen, setIsMechanicFilterDropdownOpen] = useState(false);
  const [mechanicViewMode, setMechanicViewMode] = useState('list'); // 'list' | 'grid'
  const [isAddMechanicModalOpen, setIsAddMechanicModalOpen] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState(null);

  // New / Edit Mechanic Form Fields
  const [mechName, setMechName] = useState('');
  const [mechShortName, setMechShortName] = useState('');
  const [mechHourlyRate, setMechHourlyRate] = useState('150');
  const [mechSpecialization, setMechSpecialization] = useState('Engine Overhaul & Diagnostics');
  const [mechExperience, setMechExperience] = useState('5 Years Pro Tech');
  const [mechCertifications, setMechCertifications] = useState('Yamaha YTA Gold • Honda Master');
  const [mechAvatar, setMechAvatar] = useState('');
  const [mechStatus, setMechStatus] = useState('Available');

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
  const [riderUsername, setRiderUsername] = useState('');
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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const lowStockAlertProducts = useMemo(() => {
    return products.filter((p) => Number(p.stock || 0) <= resolveReorderLevel(p, 5));
  }, [products]);

  const pendingOrdersAlertCount = useMemo(() => {
    return orders.filter((o) => o.status === 'Processing' || o.status === 'Pending').length;
  }, [orders]);

  const pendingBookingsAlertCount = useMemo(() => {
    return garageBookings.filter((b) => b.status === 'Pending' || b.status === 'Confirmed').length;
  }, [garageBookings]);

  const unreadNotificationsCount = useMemo(() => {
    const unreadFromService = notifications.filter((n) => n.status === 'unread').length;
    const systemIssues = (lowStockAlertProducts.length > 0 ? 1 : 0) + (pendingBookingsAlertCount > 0 ? 1 : 0);
    return unreadFromService + systemIssues;
  }, [notifications, lowStockAlertProducts, pendingBookingsAlertCount]);

  // ─── SYSTEM SETTINGS STATE & HANDLERS ───
  const [systemSettings, setSystemSettings] = useState(() => systemSettingsService.getSettings());
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
  const [auditLogs, setAuditLogs] = useState(() => auditLogService.getLogs());
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('All'); // 'All' | 'orders' | 'inventory' | 'garage' | 'users' | 'promos' | 'security' | 'system'
  const [isAuditCategoryDropdownOpen, setIsAuditCategoryDropdownOpen] = useState(false);
  const [auditSeverityFilter, setAuditSeverityFilter] = useState('All'); // 'All' | 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL'
  const [selectedAuditLogForModal, setSelectedAuditLogForModal] = useState(null);

  useEffect(() => {
    const unsubAudit = auditLogService.subscribe((freshLogs) => {
      setAuditLogs(freshLogs || []);
    });
    return () => unsubAudit?.();
  }, []);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditCategoryFilter !== 'All' && (log.category || '').toLowerCase() !== auditCategoryFilter.toLowerCase()) {
        return false;
      }
      if (auditSeverityFilter !== 'All' && (log.severity || '').toUpperCase() !== auditSeverityFilter.toUpperCase()) {
        return false;
      }
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase();
        const text = `${log.action} ${log.target} ${log.details} ${log.admin_name} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [auditLogs, auditCategoryFilter, auditSeverityFilter, auditSearchQuery]);

  const handleExportAuditLogs = () => {
    try {
      auditLogService.exportToCSV(filteredAuditLogs);
      showToast('✓ Audit logs exported to CSV successfully!');
    } catch (_err) {
      showToast('⚠️ Failed to export audit logs');
    }
  };

  const handleClearAuditLogs = () => {
    showConfirm({
      title: 'Purge Audit Logs History?',
      message: 'Are you sure you want to clear the entire administrative audit history? This action cannot be undone.',
      confirmText: 'Purge All Logs',
      cancelText: 'Cancel',
      type: 'danger',
      confirmIcon: 'trash',
      onConfirm: async () => {
        await auditLogService.clearLogs();
        showToast('✓ Audit logs purged successfully.');
      },
    });
  };

  const getCategoryIcon = (catName) => {
    if (!catName || catName === 'All') return 'speedometer2';
    const found = CATEGORY_PILLS.find(
      (p) => p.category.toLowerCase() === catName.toLowerCase() || p.name.toLowerCase() === catName.toLowerCase()
    );
    return found?.biIcon || 'tag-fill';
  };

  const AUDIT_CATEGORIES = [
    { id: 'All', label: 'All Categories', icon: 'layers' },
    { id: 'orders', label: 'Orders', icon: 'box-seam' },
    { id: 'inventory', label: 'Inventory', icon: 'boxes' },
    { id: 'garage', label: 'Garage', icon: 'wrench' },
    { id: 'users', label: 'Users', icon: 'people' },
    { id: 'promos', label: 'Promos', icon: 'ticket-perforated' },
    { id: 'security', label: 'Security', icon: 'shield-lock' },
    { id: 'system', label: 'System', icon: 'gear' },
  ];

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
      } catch (_e) {}
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
          mechanicsCount: mechanicsList.length,
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

  // ─── LOAD DATA ───
  const loadData = async () => {
    const prods = await productService.getProducts();
    setProducts(prods);

    const ords = await orderService.getAllOrders();
    setOrders(ords || []);

    const prm = await promoService.getPromos();
    setPromos(prm);

    const usrs = await userService.getAllUsers();
    setUsersList(usrs);

    try {
      const srvs = await garageService.fetchServices();
      setGarageServices(srvs || []);
    } catch (e) {
      setGarageServices(garageService.getServices());
    }

    try {
      const bks = await garageService.getAllBookings();
      setGarageBookings(bks || []);
    } catch (e) {
      setGarageBookings(garageService.getLocalBookings());
    }

    try {
      const mechs = await garageService.fetchMechanics();
      setGarageMechanics(mechs || []);
    } catch (_e) {
      setGarageMechanics(garageService.getMechanics());
    }

    try {
      const riders = await riderService.fetchRiders();
      setDeliveryRiders(riders || []);
    } catch (_e) {
      setDeliveryRiders(riderService.getRiders());
    }

    try {
      setIsSuppliersLoading(true);
      appStorage.removeItem('mototrack_suppliers_catalog');
      const sups = await supplierService.fetchSuppliers();
      setSuppliers(sups || []);
    } catch (_e) {
      setSuppliers(supplierService.getSuppliers());
    } finally {
      setIsSuppliersLoading(false);
    }

    const creds = supabaseManager.getCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseKey(creds.key);
  };

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
      if (typeof window !== 'undefined') {
        window.removeEventListener('mototrack_bookings_updated', handleWindowBookings);
        window.removeEventListener('storage', handleWindowBookings);
        window.removeEventListener('storage', handleSharedOrdersStorage);
      }
      adminSecurityService.lockSession();
    };
  }, [currentUser]);

  // ─── INVENTORY COMPUTATIONS & ACTIONS ───
  const invStats = useMemo(() => {
    const totalSkus = products.length;
    const inStockCount = products.filter((p) => (p.stock || 0) > resolveReorderLevel(p, 5)).length;
    const lowStockCount = products.filter((p) => isLowStock(p, 5)).length;
    const outOfStockCount = products.filter((p) => !p.stock || p.stock <= 0).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);
    const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return { totalSkus, inStockCount, lowStockCount, outOfStockCount, totalValue, totalUnits };
  }, [products]);

  // Cost & profit summary for Overview (catalog + sales + supplier purchases)
  const profitOverview = useMemo(() => {
    const productMap = {};
    products.forEach((p) => {
      const id = p.product_id || p.id;
      if (id) productMap[id] = p;
    });

    let inventoryCost = 0;
    let inventorySellValue = 0;
    let catalogProfit = 0;
    products.forEach((p) => {
      const cost = Number(p.unit_cost ?? p.unitCost ?? 0);
      const price = Number(p.price || 0);
      const stock = Number(p.stock || 0);
      inventoryCost += cost * stock;
      inventorySellValue += price * stock;
      catalogProfit += (price - cost) * stock;
    });

    const cancelled = new Set(['cancelled', 'canceled', 'refunded', 'returned', 'declined', 'rejected']);
    let soldRevenue = 0;
    let soldCost = 0;
    (orders || []).forEach((o) => {
      const status = String(o.status || '').toLowerCase();
      if (cancelled.has(status)) return;
      soldRevenue += Number(o.grand_total ?? o.total_amount ?? 0);
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((it) => {
        const qty = Number(it.quantity || 1);
        const pid = it.product_id || it.id;
        const lineCost =
          it.unit_cost != null && it.unit_cost !== ''
            ? Number(it.unit_cost)
            : Number(productMap[pid]?.unit_cost ?? productMap[pid]?.unitCost ?? 0);
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
    } catch (_e) {}

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

  const handlePOSApplyDiscount = () => {
    const code = posDiscountCode.trim().toUpperCase();
    if (!code) {
      setPosDiscountPercent(0);
      return;
    }
    const found = promos.find((p) => p.code.toUpperCase() === code && p.isActive);
    if (found) {
      setPosDiscountPercent(found.discountPercent);
      showToast(`Voucher Applied: ${found.discountPercent}% OFF!`);
    } else {
      setPosDiscountPercent(0);
      showToast('Invalid or expired promo voucher code.');
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
    const posOrders = allOrders.filter((o) => o.channel === 'POS (In-Store)');
    const onlineOrders = allOrders.filter((o) => o.channel !== 'POS (In-Store)');

    const totalRevenue = allOrders.reduce(
      (sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0),
      0
    );
    const posRevenue = posOrders.reduce(
      (sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0),
      0
    );
    const onlineRevenue = onlineOrders.reduce(
      (sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0),
      0
    );

    const aov = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;
    const totalItemsSold = allOrders.reduce(
      (sum, o) => sum + (Number(o.items_count) || (Array.isArray(o.items) ? o.items.length : 1)),
      0
    );

    // Category Revenue totals (no fabricated OLS)
    const categoryTotals = {};
    CATEGORY_NAMES.forEach((cat) => {
      categoryTotals[cat] = 0;
    });

    allOrders.forEach((o) => {
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
    allOrders.forEach((o) => {
      const pm = (o.payment_method || '').toLowerCase();
      if (pm.includes('gcash') || pm.includes('wallet')) paymentBreakdown.GCash += 1;
      else paymentBreakdown.Cash += 1;
    });

    // Top Selling Products
    const productSales = {};
    allOrders.forEach((o) => {
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
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(tp => {
         const match = products?.find(p => p.name === tp.name);
         return { ...tp, image_url: match ? match.image_url : null };
      });

    // Real weekly revenue bars from orders (not fabricated)
    let periodsCount = 12;
    if (analyticsPeriod === '4W') periodsCount = 4;
    else if (analyticsPeriod === '24W') periodsCount = 24;

    const weekBuckets = new Map();
    const now = new Date();
    for (let i = periodsCount - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      const key = `${d.getUTCFullYear()}-W${String(
        Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / (7 * 24 * 60 * 60 * 1000)) + 1
      ).padStart(2, '0')}`;
      weekBuckets.set(key, 0);
    }
    allOrders.forEach((o) => {
      const raw = o.created_at || o.order_date;
      if (!raw) return;
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return;
      const day = dt.getUTCDay();
      const monday = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      const diff = day === 0 ? -6 : 1 - day;
      monday.setUTCDate(monday.getUTCDate() + diff);
      const key = `${monday.getUTCFullYear()}-W${String(
        Math.floor(
          (monday - new Date(Date.UTC(monday.getUTCFullYear(), 0, 1))) / (7 * 24 * 60 * 60 * 1000)
        ) + 1
      ).padStart(2, '0')}`;
      if (!weekBuckets.has(key)) return;
      const rev = Number(o.grand_total) || Number(o.total_amount) || 0;
      weekBuckets.set(key, (weekBuckets.get(key) || 0) + rev);
    });
    const trendBars = Array.from(weekBuckets.entries()).map(([key, revenue], i) => ({
      label: `W${i + 1}`,
      weekKey: key,
      revenue: Math.round(revenue),
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

  // ─── PROMO ACTIONS ───
  const handleCreatePromo = async () => {
    if (!newPromoCode.trim() || !newPromoPercent.trim()) {
      showAlert('Required Fields', 'Please enter a Promo Code and Discount Percentage.');
      return;
    }

    const res = await promoService.addPromo({
      code: newPromoCode,
      discountPercent: parseInt(newPromoPercent, 10),
      description: newPromoDesc,
      isActive: true,
    });

    if (res.success) {
      setPromos((prev) => [res.promo, ...prev.filter((p) => p.code !== res.promo.code)]);
      setIsAddPromoOpen(false);
      setNewPromoCode('');
      setNewPromoPercent('20');
      setNewPromoDesc('');
      showToast(`Created promo code "${res.promo.code}" (${res.promo.discountPercent}% OFF)`);
    }
  };

  const handleTogglePromo = async (code, currentStatus) => {
    await promoService.updatePromo(code, { isActive: !currentStatus });
    setPromos((prev) => prev.map((p) => (p.code === code ? { ...p, isActive: !currentStatus } : p)));
    showToast(`Promo ${code} is now ${!currentStatus ? 'ACTIVE' : 'INACTIVE'}`);
  };

  const handleDeletePromo = (code) => {
    showConfirm({
      title: 'Delete Promo Code',
      message: `Are you sure you want to permanently remove discount code "${code}"? Customers will no longer be able to apply this discount.`,
      itemName: code,
      confirmText: 'Delete Code',
      cancelText: 'Keep Code',
      type: 'danger',
      confirmIcon: 'ticket-perforated-fill',
      onConfirm: async () => {
        await promoService.deletePromo(code);
        setPromos((prev) => prev.filter((p) => p.code !== code));
        showToast(`Deleted promo code ${code}`);
      },
    });
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
        (catLower === 'pms' && (bCategory.includes('pms') || (b.service_id && String(b.service_id).includes('pms'))));

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

  // ─── MECHANICS & TECHNICIANS COMPUTATIONS ───
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
      branch: newBkBranch || 'MotoTrack Flagship Central Hub - Quezon City',
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

  // ─── MECHANIC & TECHNICIAN ACTIONS ───
  const handleOpenAddMechanic = () => {
    setEditingMechanic(null);
    setMechName('');
    setMechShortName('');
    setMechHourlyRate('150');
    setMechSpecialization('');
    setMechExperience('');
    setMechCertifications('');
    setMechAvatar(''); // Starts empty for new technician
    setMechStatus('Available');
    setIsAddMechanicModalOpen(true);
  };

  const handleOpenEditMechanic = (mech) => {
    setEditingMechanic(mech);
    setMechName(mech.name || '');
    setMechShortName(mech.shortName || '');
    setMechHourlyRate(String(mech.hourlyRate ?? mech.hourly_rate ?? 150));
    setMechSpecialization(mech.specialization || 'Engine Overhaul & Diagnostics');
    setMechExperience(mech.experience || '5 Years Pro Tech');
    setMechCertifications(mech.certifications || 'Certified Motorcycle Technician');
    setMechAvatar(mech.avatar || MECHANIC_AVATAR_PRESETS[0]);
    setMechStatus(mech.status || 'Available');
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
      hourlyRate: Number(mechHourlyRate || 150),
      hourly_rate: Number(mechHourlyRate || 150),
    };

    if (editingMechanic) {
      const res = await garageService.updateMechanic(editingMechanic.id, payload);
      if (res.success) {
        setGarageMechanics(garageService.getMechanics());
        setIsAddMechanicModalOpen(false);
        setEditingMechanic(null);
        showToast(`✓ Updated profile for ${payload.shortName || payload.name}`);
      } else {
        showAlert('Update Failed', res.error || 'Unable to update technician profile.');
      }
    } else {
      const res = await garageService.addMechanic(payload);
      if (res.success) {
        setGarageMechanics(garageService.getMechanics());
        setIsAddMechanicModalOpen(false);
        showToast(`✓ Added ${payload.shortName || payload.name} to the garage roster!`);
      } else {
        showAlert('Error', res.error || 'Failed to add technician.');
      }
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
    setRiderUsername('');
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
    setRiderUsername(rider.username || '');
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
    if (!riderEmail.trim() || !riderEmail.includes('@')) {
      showAlert('Required Field', 'Enter the rider email used for login.');
      return;
    }
    if (!riderUsername.trim() || riderUsername.trim().length < 3) {
      showAlert('Required Field', 'Enter a username (at least 3 characters).');
      return;
    }
    if (!riderPassword.trim() || riderPassword.trim().length < 6) {
      showAlert('Required Field', 'Enter a temporary password (at least 6 characters).');
      return;
    }

    const payload = {
      id: riderIdInput.trim() || undefined,
      name: riderName.trim(),
      shortName: riderShortName.trim() || riderName.trim().split(' ')[0],
      phone: riderPhone.trim(),
      email: riderEmail.trim(),
      username: riderUsername.trim(),
      password: riderPassword.trim(),
      accountStatus: riderAccountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE,
      vehicleInfo: riderVehicle.trim(),
      plateNumber: riderPlate.trim(),
      avatar: riderAvatar.trim() || '',
      status: riderStatus || RIDER_STATUSES.AVAILABLE,
      notes: riderNotes.trim(),
    };

    const res = await riderService.addRider(payload);
    if (res.success) {
      setDeliveryRiders(riderService.getRiders());
      setIsAddRiderModalOpen(false);
      setEditingRider(null);
      showToast(`✓ Added ${payload.shortName || payload.name} to delivery staff`);
    } else {
      showAlert('Error', res.error || 'Failed to add rider.');
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

    const payload = {
      name: riderName.trim(),
      shortName: riderShortName.trim() || riderName.trim().split(' ')[0],
      phone: riderPhone.trim(),
      email: riderEmail.trim(),
      username: riderUsername.trim(),
      password: riderPassword.trim(),
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
    // Cycle: user → mechanic → admin → user
    const order = ['user', 'mechanic', 'admin'];
    const idx = order.indexOf(currentRole === 'rider' ? 'user' : currentRole);
    const newRole = order[(idx + 1) % order.length];
    await userService.updateUserRole(userId, newRole);
    await loadData();
    const labels = {
      admin: 'Store Administrator',
      mechanic: 'Mechanic',
      user: 'Customer',
    };
    showToast(`Updated user role to ${labels[newRole] || newRole}`);
  };

  const handleToggleUserStatus = (userId, name, currentStatus) => {
    if (userId === currentUser?.id) {
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
        await userService.updateUserStatus(userId, newStatus);
        await loadData();
        showToast(
          isCurrentlyDisabled
            ? `Account "${name}" has been ENABLED.`
            : `Account "${name}" has been DISABLED.`
        );
      },
    });
  };

  const handleDeleteUser = (userId, name) => {
    if (userId === currentUser?.id) {
      showAlert('Notice', 'You cannot delete your own active administrator account.');
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
        await userService.deleteUser(userId);
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
      .filter((o) => (o.status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0), 0);

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

  const filteredOrdersList = useMemo(() => {
    return orders.filter((o) => {
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
  }, [orders, orderStatusFilter, orderPaymentFilter, orderSearchQuery]);

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
        color: '#0284C7',
        colorBg: isDarkMode ? 'rgba(2, 132, 199, 0.25)' : '#E0F2FE',
        borderColor: isDarkMode ? '#0369A1' : '#BAE6FD',
        badge: invStats.lowStockCount > 0 ? `${invStats.lowStockCount} Reorder Alerts` : 'Stock Healthy',
        badgeType: invStats.lowStockCount > 0 ? 'warning' : 'success',
        metrics: [
          { label: 'Stock Valuation', value: `₱${invStats.totalValue.toLocaleString()}` },
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
        color: '#10B981',
        colorBg: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#ECFDF5',
        borderColor: isDarkMode ? '#059669' : '#A7F3D0',
        badge: `${orders.length} Total Orders`,
        badgeType: 'neutral',
        metrics: [
          { label: 'Gross Revenue', value: `₱${analyticsData.totalRevenue.toLocaleString()}` },
          { label: 'Avg Order Value', value: `₱${Math.round(analyticsData.avgOrderValue || 0).toLocaleString()}` },
          { label: 'Delivered', value: orderStats.delivered, color: '#10B981' },
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
        color: '#8B5CF6',
        colorBg: isDarkMode ? 'rgba(139, 92, 246, 0.25)' : '#F5F3FF',
        borderColor: isDarkMode ? '#7C3AED' : '#DDD6FE',
        badge: `${profitOverview.soldMargin.toFixed(1)}% Realized Margin`,
        badgeType: 'success',
        metrics: [
          { label: 'Realized Profit', value: `₱${profitOverview.soldProfit.toLocaleString()}`, color: '#10B981' },
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
  if (s.includes('pending') || s.includes('approval') || s.includes('cod')) {
    return {
      label: 'Pending COD',
      bg: '#FEF3C7',
      border: '#FDE68A',
      color: '#92400E',
      icon: 'clock-fill',
    };
  }
  if (s === 'processing') {
    return {
      label: 'Processing',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      color: '#1D4ED8',
      icon: 'gear-wide-connected',
    };
  }
  if (s.includes('ready')) {
    return {
      label: 'Ready for Delivery',
      bg: '#F5F3FF',
      border: '#DDD6FE',
      color: '#6D28D9',
      icon: 'box-seam-fill',
    };
  }
  if (s.includes('out') || s === 'shipped' || s.includes('transit')) {
    return {
      label: 'Out for Delivery',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      color: '#047857',
      icon: 'truck',
    };
  }
  if (s.includes('failed')) {
    return {
      label: 'Delivery Failed',
      bg: '#FFF1F2',
      border: '#FECDD3',
      color: '#BE123C',
      icon: 'exclamation-triangle-fill',
    };
  }
  if (s.includes('resched')) {
    return {
      label: 'Rescheduled',
      bg: '#FFF7ED',
      border: '#FFEDD5',
      color: '#C2410C',
      icon: 'calendar-event-fill',
    };
  }
  if (s.includes('deliver') || s === 'completed') {
    return {
      label: 'Delivered',
      bg: '#D1FAE5',
      border: '#6EE7B7',
      color: '#065F46',
      icon: 'check-circle-fill',
    };
  }
  if (s.includes('cancel') || s.includes('reject')) {
    return {
      label: 'Cancelled',
      bg: '#FEE2E2',
      border: '#FCA5A5',
      color: '#B91C1C',
      icon: 'x-circle-fill',
    };
  }
  return {
    label: status || 'Pending Approval',
    bg: '#F1F5F9',
    border: '#CBD5E1',
    color: '#334155',
    icon: 'info-circle-fill',
  };
};

  const handleApproveCOD = async (orderId) => {
    const res = await orderService.approveCODOrder(orderId);
    if (res.success) {
      await loadData();
      setSelectedOrderForModal((prev) =>
        prev && (prev.order_id === orderId || prev.id === orderId)
          ? { ...prev, status: 'Processing' }
          : prev
      );
      showToast(`Approved COD Order #${orderId.slice(0, 10)}! Moved to Packing.`);
    } else {
      showToast(res.error || 'COD approval failed');
    }
  };

  const handleApproveAllPendingCOD = async () => {
    if (pendingCodOrders.length === 0) return;
    for (const ord of pendingCodOrders) {
      await orderService.approveCODOrder(ord.order_id || ord.id);
    }
    await loadData();
    showToast(`Approved all ${pendingCodOrders.length} pending COD orders!`);
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
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
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
    mechanics: 'Certified Mechanics & Pit Crew',
    riders: 'Riders',
    users: 'Users Management',
    supabase: 'Supabase Database Settings',
    notifications: 'Notifications & Alerts Center',
    settings: 'System & Platform Settings',
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
    mechanics: 'person-badge-fill',
    riders: 'bicycle',
    users: 'people-fill',
    supabase: 'database-fill-gear',
    notifications: 'bell-fill',
    settings: 'gear-fill',
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: isDarkMode ? '#0E1311' : '#F8FAFC',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
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
            <BootstrapIcon name="shield-slash-fill" size={30} color="#DC2626" />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '900',
              color: isDarkMode ? '#F8FAFC' : '#0F172A',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Access Denied: Admin Privileges Required
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: isDarkMode ? '#94A3B8' : '#64748B',
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
              backgroundColor: '#1D4533',
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
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
              Switch to Store Administrator (One-Click)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9',
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
            <Text style={{ color: isDarkMode ? '#E2E8F0' : '#475569', fontWeight: '800', fontSize: 13.5 }}>
              Sign In with Another Account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9',
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
            <Text style={{ color: isDarkMode ? '#E2E8F0' : '#475569', fontWeight: '800', fontSize: 14 }}>Return to Storefront</Text>
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
            backgroundColor: '#1D4533',
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
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>{toastMessage}</Text>
        </View>
      ) : null}

      <View style={styles.adminLayout}>
        {/* ─── 1. LEFT SIDEBAR (DESKTOP ONLY) ─── */}
        {isDesktop && (
          <View style={styles.sidebar}>
            {/* Top Fixed Area: Brand Logo */}
            <View style={styles.sidebarBrandRow} className="pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <TouchableOpacity
                onPress={onNavigateToStore}
                style={{ flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.8}
              >
                <BrandLogo
                  size={34}
                  textColor={tokens.textPrimary}
                  accentColor="#1D4533"
                />
              </TouchableOpacity>
            </View>

            {/* Scrollable Navigation Area */}
            <ScrollView
              style={styles.sidebarNavScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* Admin Profile Box */}
              <View style={styles.adminProfileBox}>
                <View style={styles.adminAvatarCircle}>
                  <Text style={styles.adminAvatarText}>
                    {(currentUser?.name || currentUser?.fullName || 'A').charAt(0).toUpperCase()}
                  </Text>
                  <View style={styles.onlineIndicator} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileNameText} numberOfLines={1}>
                    {currentUser?.name || 'Administrator'}
                  </Text>
                  <Text style={styles.profileRoleText}>Store Administrator</Text>
                </View>
              </View>

              {/* Navigation Items */}
              <Text style={styles.navHeading}>OPERATIONS</Text>
              <View style={styles.sidebarNavList}>
                {/* 1. Overview */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'overview' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('overview')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="grid-1x2-fill"
                      size={16}
                      color={activeNav === 'overview' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarNavLabel, activeNav === 'overview' && styles.sidebarNavLabelActive]}
                  >
                    Dashboard
                  </Text>
                  {activeNav === 'overview' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 2. Customer Orders & COD Fulfillment */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'orders' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('orders')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="receipt"
                      size={16}
                      color={activeNav === 'orders' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.sidebarNavLabel, activeNav === 'orders' && styles.sidebarNavLabelActive]}
                  >
                    Orders
                  </Text>
                  {pendingCodCount > 0 ? (
                    <AlertOrangeDot
                      count={pendingCodCount}
                      label="COD"
                      title={`${pendingCodCount} Pending COD Orders`}
                    />
                  ) : (
                    <View
                      style={[
                        styles.sidebarCountBadge,
                        activeNav === 'orders' && styles.sidebarCountBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sidebarCountText,
                          activeNav === 'orders' && styles.sidebarCountTextActive,
                        ]}
                      >
                        {orders.length}
                      </Text>
                    </View>
                  )}
                  {activeNav === 'orders' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 3. Inventory */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'inventory' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('inventory')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="box-seam-fill"
                      size={16}
                      color={activeNav === 'inventory' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sidebarNavLabel,
                      activeNav === 'inventory' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Inventory
                  </Text>
                  {invStats.lowStockCount > 0 && (
                    <AlertOrangeDot
                      count={invStats.lowStockCount}
                      label="LOW"
                      title={`${invStats.lowStockCount} Low Stock Products`}
                    />
                  )}
                  {activeNav === 'inventory' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 4. Point of Sale (POS) */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'pos' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('pos')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="cart-check-fill"
                      size={16}
                      color={activeNav === 'pos' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'pos' && styles.sidebarNavLabelActive]}>
                    POS Cashier
                  </Text>
                  {posCart.length > 0 && (
                    <View
                      style={{
                        backgroundColor: '#EF4444',
                        paddingHorizontal: 7,
                        paddingVertical: 1,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' }}>
                        {posCart.length}
                      </Text>
                    </View>
                  )}
                  {activeNav === 'pos' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 5. Analytics */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'analytics' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('analytics')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="graph-up-arrow"
                      size={16}
                      color={activeNav === 'analytics' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sidebarNavLabel,
                      activeNav === 'analytics' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Reports
                  </Text>
                  {activeNav === 'analytics' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 5b. Forecast */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'forecast' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('forecast')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="clipboard-data"
                      size={16}
                      color={activeNav === 'forecast' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sidebarNavLabel,
                      activeNav === 'forecast' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Forecast
                  </Text>
                  {activeNav === 'forecast' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 5c. Customizations */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'customizations' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('customizations')}

                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="magic"
                      size={16}
                      color={activeNav === 'customizations' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.sidebarNavLabel,
                      activeNav === 'customizations' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Customizations
                  </Text>
                  {activeNav === 'customizations' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 5d. Motorcycle Models (parts compatibility catalog) */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'moto_models' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('moto_models')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="bicycle"
                      size={16}
                      color={activeNav === 'moto_models' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.sidebarNavLabel,
                      activeNav === 'moto_models' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Moto Models
                  </Text>
                  {activeNav === 'moto_models' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                <Text style={styles.navHeading}>STORE MANAGEMENT</Text>

                {/* 6. Products */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'products' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('products')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="tag-fill"
                      size={16}
                      color={activeNav === 'products' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarNavLabel, activeNav === 'products' && styles.sidebarNavLabelActive]}
                  >
                    Products
                  </Text>
                  <View
                    style={[
                      styles.sidebarCountBadge,
                      activeNav === 'products' && styles.sidebarCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCountText,
                        activeNav === 'products' && styles.sidebarCountTextActive,
                      ]}
                    >
                      {products.length}
                    </Text>
                  </View>
                  {activeNav === 'products' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 7. Promos */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'promos' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('promos')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="ticket-perforated-fill"
                      size={16}
                      color={activeNav === 'promos' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.sidebarNavLabel, activeNav === 'promos' && styles.sidebarNavLabelActive]}
                  >
                    Promos
                  </Text>
                  {activeNav === 'promos' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 7.5. Suppliers */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'suppliers' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('suppliers')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="truck"
                      size={16}
                      color={activeNav === 'suppliers' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarNavLabel, activeNav === 'suppliers' && styles.sidebarNavLabelActive]}
                  >
                    Supplier
                  </Text>
                  <View
                    style={[
                      styles.sidebarCountBadge,
                      activeNav === 'suppliers' && styles.sidebarCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCountText,
                        activeNav === 'suppliers' && styles.sidebarCountTextActive,
                      ]}
                    >
                      {suppliers.length}
                    </Text>
                  </View>
                  {activeNav === 'suppliers' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 3: GARAGE & SERVICES ─── */}
                <Text style={styles.navHeading}>GARAGE & SERVICES</Text>

                {/* 8. Bookings */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'garage' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('garage')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="tools"
                      size={16}
                      color={activeNav === 'garage' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarNavLabel, activeNav === 'garage' && styles.sidebarNavLabelActive]}
                  >
                    Bookings
                  </Text>
                  <View
                    style={[
                      styles.sidebarCountBadge,
                      activeNav === 'garage' && styles.sidebarCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCountText,
                        activeNav === 'garage' && styles.sidebarCountTextActive,
                      ]}
                    >
                      {garageBookings.length}
                    </Text>
                  </View>
                  {activeNav === 'garage' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 8.5. Mechanics */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'mechanics' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('mechanics')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="person-badge-fill"
                      size={16}
                      color={activeNav === 'mechanics' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarNavLabel, activeNav === 'mechanics' && styles.sidebarNavLabelActive]}
                  >
                    Mechanics
                  </Text>
                  <View
                    style={[
                      styles.sidebarCountBadge,
                      activeNav === 'mechanics' && styles.sidebarCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCountText,
                        activeNav === 'mechanics' && styles.sidebarCountTextActive,
                      ]}
                    >
                      {garageMechanics.length}
                    </Text>
                  </View>
                  {activeNav === 'mechanics' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 8.6. Riders / Delivery Staff */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'riders' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('riders')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="bicycle"
                      size={16}
                      color={activeNav === 'riders' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[styles.sidebarNavLabel, activeNav === 'riders' && styles.sidebarNavLabelActive]}
                  >
                    Riders
                  </Text>
                  <View
                    style={[
                      styles.sidebarCountBadge,
                      activeNav === 'riders' && styles.sidebarCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCountText,
                        activeNav === 'riders' && styles.sidebarCountTextActive,
                      ]}
                    >
                      {deliveryRiders.length}
                    </Text>
                  </View>
                  {activeNav === 'riders' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 4: USER MANAGEMENT ─── */}
                <Text style={styles.navHeading}>USER MANAGEMENT</Text>

                {/* 9. Users */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'users' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('users')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="people-fill"
                      size={16}
                      color={activeNav === 'users' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.sidebarNavLabel, activeNav === 'users' && styles.sidebarNavLabelActive]}
                  >
                    Users
                  </Text>
                  {activeNav === 'users' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 5: SYSTEM & SETTINGS ─── */}
                <Text style={styles.navHeading}>SYSTEM & SETTINGS</Text>

                {/* 11. Supabase DB */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'supabase' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('supabase')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="database-fill-gear"
                      size={16}
                      color={activeNav === 'supabase' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.sidebarNavLabel, activeNav === 'supabase' && styles.sidebarNavLabelActive]}
                  >
                    Database
                  </Text>
                  {activeNav === 'supabase' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 11.5. Audit Logs */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'audit' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('audit')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="journal-text"
                      size={16}
                      color={activeNav === 'audit' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.sidebarNavLabel, activeNav === 'audit' && styles.sidebarNavLabelActive]}
                  >
                    Audit
                  </Text>
                  <View
                    style={[
                      styles.sidebarCountBadge,
                      activeNav === 'audit' && styles.sidebarCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarCountText,
                        activeNav === 'audit' && styles.sidebarCountTextActive,
                      ]}
                    >
                      {auditLogs.length}
                    </Text>
                  </View>
                  {activeNav === 'audit' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 12. System Settings */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'settings' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('settings')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="gear-fill"
                      size={16}
                      color={activeNav === 'settings' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sidebarNavLabel,
                      activeNav === 'settings' && styles.sidebarNavLabelActive,
                    ]}
                  >
                    Settings
                  </Text>
                  {activeNav === 'settings' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 6: QUICK LINKS ─── */}
                <Text style={styles.navHeading}>QUICK LINKS</Text>

                {/* 13. Live Storefront Link */}
                <TouchableOpacity
                  style={styles.sidebarNavItem}
                  onPress={handleBackToStorefront}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="shop" size={16} color="#1D4533" />
                  </View>
                  <Text style={[styles.sidebarNavLabel, { color: '#1D4533', fontWeight: '800' }]}>
                    Live Storefront
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Sticky Sidebar Footer */}
            <View style={styles.sidebarFooter}>
              <View style={styles.sidebarStatusRow}>
                <View style={styles.statusDotGreen} />
                <Text style={styles.sidebarStatusText}>System Live & Synced</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.logoutSidebarBtn,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
                ]}
                onPress={() => {
                  showConfirm({
                    title: 'Log Out of Admin?',
                    message: 'Are you sure you want to log out of the Admin Console? Your session will be securely locked.',
                    confirmText: 'Log Out',
                    cancelText: 'Stay Logged In',
                    type: 'danger',
                    confirmIcon: 'box-arrow-right',
                    onConfirm: () => {
                      try {
                        adminSecurityService.lockSession();
                      } catch (_e) {}
                      if (onLogout) {
                        onLogout();
                      } else {
                        logout?.();
                        onNavigateToStore?.();
                      }
                    },
                  });
                }}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="box-arrow-right" size={14} color="#DC2626" />
                <Text style={styles.logoutSidebarText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
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
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  backgroundColor: isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F0FDFA',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(29, 69, 51, 0.45)' : '#CCFBF1',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon
                  name={navIcons[activeNav] || 'speedometer2'}
                  size={15}
                  color={isDarkMode ? '#34D399' : '#1D4533'}
                />
              </View>
              <Text style={[styles.pageBreadcrumbTitle, !isDesktop && { fontSize: 16 }]}>
                {navTitles[activeNav] || 'Admin Console'}
              </Text>
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
              {activeNav === 'inventory' && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[
                      styles.addBtnPrimary,
                      {
                        backgroundColor: isDarkMode ? '#1E3A2F' : '#FEF3C7',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#2D5A45' : '#FDE68A',
                      },
                    ]}
                    onPress={() => openSupplierPurchase(null)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="box-arrow-in-down" size={14} color="#1D4533" />
                    <Text style={[styles.addBtnPrimaryText, { color: '#1D4533' }]}>
                      {isDesktop ? 'Restock Inventory' : 'Restock'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addBtnPrimary}
                    onPress={() => setIsAddProductOpen(true)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>
                      {isDesktop ? 'Add New Product SKU' : '+ SKU'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {activeNav === 'products' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={() => setIsAddProductOpen(true)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add New Product' : '+ Product'}</Text>
                </TouchableOpacity>
              )}
              {activeNav === 'pos' && posCart.length > 0 && (
                <TouchableOpacity
                  style={[styles.addBtnPrimary, { backgroundColor: '#DC2626' }]}
                  onPress={() => setPosCart([])}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="trash" size={13} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Clear POS Cart' : 'Clear'}</Text>
                </TouchableOpacity>
              )}
              {activeNav === 'promos' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={() => setIsAddPromoOpen(true)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Create Voucher' : '+ Promo'}</Text>
                </TouchableOpacity>
              )}
              {activeNav === 'garage' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={() => {
                    if (garageSubTab === 'bookings') {
                      setNewBkCustomerName('');
                      setNewBkCustomerPhone('');
                      setNewBkCustomerEmail('');
                      setNewBkPlate('');
                      setNewBkOdo('');
                      setNewBkNotes('');
                      setIsNewBookingModalOpen(true);
                    } else {
                      setEditingGarageService(null);
                      setServTitle('');
                      setServSubtitle('');
                      setServCategory('PMS');
                      setServPrice('3750');
                      setServDuration('60 mins');
                      setServBadge('Popular');
                      setServImage(
                        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80'
                      );
                      setServDesc('');
                      setServInclusions('');
                      setIsAddGarageOpen(true);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="plus-lg"
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.addBtnPrimaryText}>
                    {garageSubTab === 'bookings'
                      ? isDesktop
                        ? 'New Service Booking'
                        : '+ Booking'
                      : isDesktop
                        ? 'Add Service Package'
                        : '+ Package'}
                  </Text>
                </TouchableOpacity>
              )}
              {activeNav === 'suppliers' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={handleOpenAddSupplier}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>
                    {isDesktop ? 'Add New Supplier' : '+ Supplier'}
                  </Text>
                </TouchableOpacity>
              )}
              {activeNav === 'mechanics' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={handleOpenAddMechanic}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person-plus-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>
                    {isDesktop ? 'Add New Mechanic' : '+ Mechanic'}
                  </Text>
                </TouchableOpacity>
              )}
              {activeNav === 'riders' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={handleOpenAddRider}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person-plus-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>
                    {isDesktop ? 'Add Rider' : '+ Rider'}
                  </Text>
                </TouchableOpacity>
              )}
              {activeNav === 'analytics' && (
                <TouchableOpacity
                  style={[
                    styles.addBtnPrimary,
                    {
                      backgroundColor: '#107C41',
                      borderColor: '#107C41',
                      paddingHorizontal: isDesktop ? 12 : 9,
                    },
                  ]}
                  onPress={() => {
                    const res = excelService.exportComprehensiveBusinessReport({
                      products,
                      orders,
                      bookings: garageBookings,
                      users: usersList,
                      suppliers,
                      analyticsData,
                      period: analyticsPeriod,
                      generatedBy: currentUser?.fullName || currentUser?.name || 'Administrator',
                    });
                    if (res.success) {
                      showToast('✓ Master Business Report (.xlsx) downloaded successfully');
                    } else {
                      showAlert('Export Failed', res.error || 'Failed to export report.');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="download" size={13} color="#FFFFFF" />
                  {isDesktop && (
                    <Text style={[styles.addBtnPrimaryText, { color: '#FFFFFF' }]}>
                      Download Master Report (.xlsx)
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Dark Mode Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.quickStoreBtn,
                  isDarkMode && { backgroundColor: '#1C2422', borderColor: tokens.borderInput },
                ]}
                onPress={toggleDarkMode}
                activeOpacity={0.8}
                accessibilityLabel={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <BootstrapIcon
                  name={isDarkMode ? 'sun-fill' : 'moon-stars-fill'}
                  size={13}
                  color={isDarkMode ? '#F59E0B' : '#64748B'}
                />
                {isDesktop && (
                  <Text style={[styles.quickStoreBtnText, isDarkMode && { color: '#F8FAFC' }]}>
                    {isDarkMode ? 'Light' : 'Dark'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* ─── NOTIFICATION BELL & DROPDOWN POPOVER ─── */}
              <View style={{ position: 'relative', zIndex: 1001 }} data-notification-button="true">
                <TouchableOpacity
                  style={[
                    styles.quickStoreBtn,
                    {
                      paddingHorizontal: 11,
                      paddingVertical: 9,
                      minWidth: 38,
                      justifyContent: 'center',
                      position: 'relative',
                    },
                    isDarkMode && { backgroundColor: '#1C2422', borderColor: tokens.borderInput },
                    (isNotificationDropdownOpen || activeNav === 'notifications') && {
                      borderColor: '#1D4533',
                      backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                    },
                  ]}
                  onPress={() => {
                    setIsNotificationDropdownOpen(!isNotificationDropdownOpen);
                    setIsProfileDropdownOpen(false);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Notifications"
                >
                  <BootstrapIcon
                    name={unreadNotificationsCount > 0 ? 'bell-fill' : 'bell'}
                    size={14}
                    color={
                      isNotificationDropdownOpen || activeNav === 'notifications'
                        ? '#1D4533'
                        : unreadNotificationsCount > 0
                          ? '#E11D48'
                          : isDarkMode
                            ? '#94A3B8'
                            : '#64748B'
                    }
                  />
                  {unreadNotificationsCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        backgroundColor: '#E11D48',
                        borderRadius: 10,
                        minWidth: 16,
                        height: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? '#1C2422' : '#FFFFFF',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
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
                />
              </View>

              {/* ─── ADMIN PROFILE AVATAR & DROPDOWN ─── */}
              <View style={{ position: 'relative', zIndex: isProfileDropdownOpen ? 99999 : 1001 }}>
                <TouchableOpacity
                  style={[
                    styles.quickStoreBtn,
                    {
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      height: 38,
                      gap: 7,
                      alignItems: 'center',
                    },
                    isDarkMode && { backgroundColor: '#1C2422', borderColor: tokens.borderInput },
                    isProfileDropdownOpen && {
                      borderColor: '#1D4533',
                      backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                    },
                  ]}
                  onPress={() => {
                    setIsProfileDropdownOpen((prev) => !prev);
                    setIsNotifDropdownOpen(false);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Admin Profile Menu"
                >
                  {currentUser?.avatar ? (
                    <Image
                      source={{ uri: currentUser.avatar }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: '#CBD5E1',
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: '#1D4533',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                        {(currentUser?.name || currentUser?.fullName || 'Admin')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {isDesktop && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12.5,
                          fontWeight: '700',
                          color: isDarkMode ? '#F8FAFC' : '#1E293B',
                          maxWidth: 90,
                        }}
                      >
                        {currentUser?.name ? currentUser.name.split(' ')[0] : 'Admin'}
                      </Text>
                      <BootstrapIcon
                        name="chevron-down"
                        size={10}
                        color={isDarkMode ? '#94A3B8' : '#64748B'}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Floating Profile Popover Dropdown */}
                {isProfileDropdownOpen && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 46,
                      right: 0,
                      width: 280,
                      backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
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
                        backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
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
                              backgroundColor: '#1D4533',
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
                              color: isDarkMode ? '#F8FAFC' : '#0F172A',
                            }}
                            numberOfLines={1}
                          >
                            {currentUser?.name || currentUser?.fullName || 'Store Administrator'}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11.5,
                              color: isDarkMode ? '#94A3B8' : '#64748B',
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
                        <BootstrapIcon name="shield-lock-fill" size={11} color="#1D4533" />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isDarkMode ? '#6EE7B7' : '#065F46',
                          }}
                        >
                          Store Administrator
                        </Text>
                      </View>
                    </View>

                    {/* Action Choices Menu */}
                    <View style={{ padding: 8 }}>
                      {/* 1. Edit Profile */}
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
                          setIsProfileModalOpen(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <BootstrapIcon name="person-gear" size={16} color="#1D4533" />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#F8FAFC' : '#1E293B',
                          }}
                        >
                          My Profile & Settings
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
                        <BootstrapIcon name="shop" size={16} color="#2563EB" />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#F8FAFC' : '#1E293B',
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
                        <BootstrapIcon name="gear-fill" size={16} color="#1D4533" />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#F8FAFC' : '#1E293B',
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
                        <BootstrapIcon name="lock-fill" size={16} color="#D97706" />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '600',
                            color: isDarkMode ? '#F8FAFC' : '#1E293B',
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
                        <BootstrapIcon name="box-arrow-right" size={16} color="#DC2626" />
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '700',
                            color: '#DC2626',
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
            </View>
          </View>

          <ScrollView
            style={{ position: 'relative', zIndex: 1 }}
            contentContainerStyle={[
              styles.mainScroll,
              !isDesktop && { paddingBottom: 110, paddingHorizontal: 12 },
            ]}
          >
            {/* ─── TAB 1: OVERVIEW ─── */}
            {/* ─── TAB 1: DASHBOARD (STORE DASHBOARD & ACTIVITY) ─── */}
            {activeNav === 'overview' && (
              <View>
                {/* 1. Dashboard Executive Header */}
                <View
                  style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: isDesktop ? 'center' : 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 24,
                    paddingBottom: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: tokens.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <Text
                        style={{
                          fontSize: isDesktop ? 24 : 20,
                          fontWeight: '800',
                          color: tokens.textPrimary,
                          letterSpacing: -0.5,
                          fontFamily: Platform.select({ web: "'Plus Jakarta Sans', 'Poppins', -apple-system, sans-serif", default: 'PlusJakartaSans-Bold' }),
                        }}
                      >
                        Admin Dashboard
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
                        }}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#34D399' : '#15803D' }}>
                          Live System
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: tokens.textMuted, marginTop: 4 }}>
                      Motorcycle parts inventory, service appointments, and omnichannel sales telemetry.
                    </Text>
                  </View>

                  {/* Header Actions Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                        borderWidth: 1,
                        borderColor: tokens.border,
                      }}
                    >
                      <BootstrapIcon name="clock-history" size={13} color={tokens.textMuted} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.textMuted }}>
                        Realtime Sync Active
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={loadData}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: tokens.border,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <BootstrapIcon name="arrow-repeat" size={13} color={tokens.textPrimary} />
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: tokens.textPrimary }}>
                        Refresh
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        const res = excelService.exportComprehensiveBusinessReport({
                          products,
                          orders,
                          bookings: garageBookings,
                          users: usersList,
                          suppliers,
                          analyticsData,
                          period: 'All Time',
                          generatedBy: currentUser?.fullName || currentUser?.name || 'Administrator',
                        });
                        if (res.success) {
                          showToast('✓ Master Business Report exported to Excel (.xlsx)');
                        } else {
                          showAlert('Export Failed', res.error || 'Failed to generate Excel report.');
                        }
                      }}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: '#107C41',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(16, 124, 65, 0.25)',
                      }}
                    >
                      <BootstrapIcon name="file-earmark-excel-fill" size={13} color="#FFFFFF" />
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' }}>
                        Export Report (.xlsx)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setActiveNav('pos')}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#334155' : '#0F172A',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    >
                      <BootstrapIcon name="cart-check-fill" size={13} color="#FFFFFF" />
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>
                        POS Cashier
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Primary KPI Stat Cards (Balanced SaaS Metric Grid) */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    icon="receipt"
                    label="Total Orders"
                    value={orderStats.total}
                    trend="+12.4%"
                    trendPositive={true}
                    sub={`₱${orderStats.totalRevenue.toLocaleString()} volume`}
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={orderStats.pendingCod > 0 ? 'amber' : 'blue'}
                    icon="cash-coin"
                    label="Pending COD Approvals"
                    value={orderStats.pendingCod}
                    valueColor={orderStats.pendingCod > 0 ? '#D97706' : undefined}
                    trend={orderStats.pendingCod > 0 ? 'Action required' : 'Clear'}
                    trendPositive={orderStats.pendingCod === 0}
                    sub="Requires Admin action"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    icon="box-seam"
                    label="Packing & Processing"
                    value={orderStats.processing}
                    sub="Ready for courier pickup"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    icon="boxes"
                    label="Total Inventory Value"
                    value={`₱${invStats.totalValue.toLocaleString()}`}
                    sub={`Across ${invStats.totalUnits} items in stock`}
                    isDark={isDarkMode}
                  />
                </View>

                {/* Secondary Store Telemetry Cards */}
                <View style={[styles.statsGrid, { marginTop: -8 }]}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    icon="graph-up-arrow"
                    label="Total Store Revenue"
                    value={`₱${analyticsData.totalRevenue.toLocaleString()}`}
                    trend="Omnichannel"
                    trendPositive={true}
                    sub="Online + Walk-in POS"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    icon="tag-fill"
                    label="Active SKUs"
                    value={products.length}
                    sub={`${invStats.totalUnits} total units in stock`}
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={invStats.lowStockCount > 0 ? 'amber' : 'teal'}
                    icon="exclamation-triangle-fill"
                    label="Stock Alerts"
                    value={`${invStats.lowStockCount} Low`}
                    valueColor={invStats.lowStockCount > 0 ? '#D97706' : undefined}
                    trend={invStats.lowStockCount > 0 ? 'Reorder' : 'Healthy'}
                    trendPositive={invStats.lowStockCount === 0}
                    sub="Needs reorder attention"
                    isDark={isDarkMode}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="green"
                    icon="cash-stack"
                    label="Sales Profit"
                    value={`₱${profitOverview.soldProfit.toLocaleString()}`}
                    trend={`${profitOverview.soldMargin.toFixed(1)}% margin`}
                    trendPositive={profitOverview.soldMargin > 0}
                    sub={`Sold cost ₱${profitOverview.soldCost.toLocaleString()}`}
                    isDark={isDarkMode}
                  />
                </View>

                {/* 3. REVENUE TREND Sparkline Banner */}
                <View
                  style={{
                    backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    paddingVertical: 28,
                    paddingHorizontal: 26,
                    minHeight: 160,
                    justifyContent: 'center',
                    marginBottom: 24,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDarkMode ? 0.2 : 0.03,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
                    {/* Left Metric */}
                    <View style={{ minWidth: 160 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        REVENUE TREND
                      </Text>
                      <Text style={{ fontSize: 30, fontWeight: '800', color: tokens.textPrimary, marginTop: 6, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>
                        ₱{analyticsData.totalRevenue.toLocaleString()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <View style={{ backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0' }}>
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#34D399' : '#059669' }}>
                            ↑ +12.4% this period
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Center Sparkline */}
                    <View style={{ flex: 1, minWidth: 240, height: 96, justifyContent: 'center' }}>
                      {Platform.OS === 'web' ? (
                        <svg width="100%" height="96" viewBox="0 0 320 96" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
                          <defs>
                            <linearGradient id="revSparkGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 0,72 C 40,67 70,54 110,60 C 150,66 180,42 220,34 C 260,26 290,18 320,12 L 320,96 L 0,96 Z"
                            fill="url(#revSparkGrad)"
                          />
                          <path
                            d="M 0,72 C 40,67 70,54 110,60 C 150,66 180,42 220,34 C 260,26 290,18 320,12"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <circle cx="220" cy="34" r="4" fill="#10B981" />
                        </svg>
                      ) : (
                        <View style={{ height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: '75%', backgroundColor: '#10B981', borderRadius: 3 }} />
                        </View>
                      )}
                    </View>

                    {/* Right Stats Breakdown */}
                    <View style={{ flexDirection: 'row', gap: 28, flexWrap: 'wrap' }}>
                      <View>
                        <Text style={{ fontSize: 11, color: tokens.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Online Sales</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                          ₱{analyticsData.onlineRevenue.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 11, color: tokens.textMuted, fontWeight: '700', marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Orders</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                          {orders.length}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, color: tokens.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Walk-in POS</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                          ₱{analyticsData.posRevenue.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 11, color: tokens.textMuted, fontWeight: '700', marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivered</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                          {orderStats.delivered}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, color: tokens.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Net Margin</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                          {profitOverview.soldMargin.toFixed(1)}%
                        </Text>
                        <Text style={{ fontSize: 11, color: tokens.textMuted, fontWeight: '700', marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: pendingCodCount > 0 ? '#D97706' : tokens.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                          {pendingCodCount}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 3b. EXECUTIVE ANALYTICS: SERVICE BOOKINGS & TOP EARNER PRODUCTS */}
                <View style={{ marginBottom: 24 }}>
                  {/* Service Bookings Share & Top Earners Products (Side by Side) */}
                  <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
                    {/* 1. Service Bookings Share (Pie Chart: PMS vs Repair vs Customization) */}
                    <BookingCategoryPieChart
                      bookings={garageBookings}
                      isDark={isDarkMode}
                      isDesktop={isDesktop}
                      style={{ flex: 1, minWidth: isDesktop ? 340 : '100%', marginBottom: 0 }}
                    />

                    {/* 2. Top Earners Products Leaderboard */}
                    <View
                      style={[
                        styles.analyticsCard,
                        {
                          flex: 1,
                          minWidth: isDesktop ? 320 : '100%',
                          marginBottom: 0,
                          backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
                          borderColor: tokens.border,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <BootstrapIcon name="trophy-fill" size={15} color="#D97706" />
                            <Text style={[styles.analyticsCardTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                              Top Earners
                            </Text>
                          </View>
                          <Text style={[styles.analyticsCardSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 3 }]}>
                            Ranked by cumulative sales volume
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setActiveNav('products')}
                          activeOpacity={0.8}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                            borderRadius: 8,
                            cursor: 'pointer',
                          }}
                        >
                          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#475569', fontSize: 12, fontWeight: '600' }}>
                            View products →
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {analyticsData.topProducts.length === 0 ? (
                        <View style={{ paddingVertical: 36, alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="box-seam" size={32} color={tokens.textMuted} />
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.textPrimary, marginTop: 10 }}>
                            No Top-Selling Products Yet
                          </Text>
                          <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>
                            As customer orders are fulfilled, top grossing catalog items will automatically appear here.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 2 }}>
                          {analyticsData.topProducts.map((tp, idx) => {
                            const maxRev = analyticsData.topProducts[0]?.revenue || 1;
                            const barWidth = Math.min(100, Math.max(5, (tp.revenue / maxRev) * 100));
                            const rankBadges = [
                              { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
                              { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
                              { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' },
                            ];
                            const badge = rankBadges[idx] || {
                              bg: isDarkMode ? '#1E293B' : '#F8FAFC',
                              text: isDarkMode ? '#94A3B8' : '#64748B',
                              border: tokens.border,
                            };

                            return (
                              <View
                                key={idx}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingVertical: 8,
                                  paddingHorizontal: 8,
                                  borderRadius: 10,
                                  marginBottom: idx === analyticsData.topProducts.length - 1 ? 0 : 8,
                                }}
                              >
                                {/* Rank Pill */}
                                <View
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 13,
                                    backgroundColor: badge.bg,
                                    borderWidth: 1,
                                    borderColor: badge.border,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 10,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: badge.text }}>
                                    #{idx + 1}
                                  </Text>
                                </View>

                                {/* Product Thumbnail */}
                                <View
                                  style={{
                                    width: 42,
                                    height: 42,
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: tokens.border,
                                    overflow: 'hidden',
                                    marginRight: 12,
                                    flexShrink: 0,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {tp.image_url ? (
                                    <Image
                                      source={{ uri: tp.image_url }}
                                      style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                                    />
                                  ) : (
                                    <BootstrapIcon
                                      name="box-seam"
                                      size={18}
                                      color={isDarkMode ? '#64748B' : '#94A3B8'}
                                    />
                                  )}
                                </View>

                                {/* Product Info + Bar */}
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: 4,
                                    }}
                                  >
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: '700',
                                          color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                        }}
                                        numberOfLines={1}
                                      >
                                        {tp.name}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: 11.5,
                                          color: isDarkMode ? '#94A3B8' : '#64748B',
                                          marginTop: 1,
                                        }}
                                      >
                                        {tp.brand || 'MotoTrack'} • {tp.unitsSold || 0} sold
                                      </Text>
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 14.5,
                                        fontWeight: '800',
                                        color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                        fontVariant: ['tabular-nums'],
                                      }}
                                    >
                                      ₱{tp.revenue.toLocaleString()}
                                    </Text>
                                  </View>

                                  <View
                                    style={{
                                      height: 3,
                                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                                      borderRadius: 2,
                                      width: '100%',
                                      overflow: 'hidden',
                                      marginTop: 4,
                                    }}
                                  >
                                    <View
                                      style={{
                                        height: '100%',
                                        width: `${barWidth}%`,
                                        backgroundColor: '#10B981',
                                        borderRadius: 2,
                                      }}
                                    />
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* 5. Recent Orders & POS Sales Table */}
                <View
                  style={[
                    styles.tableCard,
                    {
                      padding: 0,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: tokens.border,
                      backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
                      overflow: 'hidden',
                      marginBottom: 24,
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDarkMode ? 0.2 : 0.03,
                      shadowRadius: 6,
                      elevation: 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.textPrimary, letterSpacing: -0.3 }}>
                        Recent Orders & POS Sales
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                        Latest transactions across all sales channels
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActiveNav('orders')}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                        cursor: 'pointer',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#475569' }}>
                        View All Orders ({orders.length}) →
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {orders.length === 0 ? (
                    <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
                      <BootstrapIcon name="receipt" size={32} color={tokens.textMuted} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.textPrimary, marginTop: 10 }}>
                        No Recent Transactions
                      </Text>
                      <Text style={{ fontSize: 12, color: tokens.textMuted, marginTop: 4, textAlign: 'center', maxWidth: 360 }}>
                        Customer orders and cashier checkout records will automatically appear here once placed.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ width: '100%' }}
                      contentContainerStyle={{ width: '100%', minWidth: '100%', flexGrow: 1 }}
                    >
                      <View style={{ width: '100%', minWidth: isDesktop ? '100%' : 720, flex: 1 }}>
                        {/* Table Header Row */}
                        <View
                          style={{
                            flexDirection: 'row',
                            width: '100%',
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            backgroundColor: isDarkMode ? '#0E1311' : '#F8FAFC',
                            borderBottomWidth: 1,
                            borderBottomColor: tokens.border,
                          }}
                        >
                          <Text style={{ flex: 2.5, fontSize: 10.5, fontWeight: '800', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>ORDER REF</Text>
                          <Text style={{ flex: 2.5, fontSize: 10.5, fontWeight: '800', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>CUSTOMER</Text>
                          <Text style={{ flex: 1.8, fontSize: 10.5, fontWeight: '800', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>CHANNEL</Text>
                          <Text style={{ flex: 1.6, fontSize: 10.5, fontWeight: '800', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>AMOUNT</Text>
                          <Text style={{ flex: 1.6, fontSize: 10.5, fontWeight: '800', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' }}>STATUS</Text>
                        </View>

                        {/* Rows */}
                        {orders.slice(0, 6).map((o, idx) => {
                          const orderId = o.order_id || o.id || `ORD-ON-2026-${String(idx + 1).padStart(5, '0')}`;
                          const rawChannel = String(o.channel || '').toLowerCase();
                          const isInStore = rawChannel.includes('pos') || rawChannel.includes('in-store') || rawChannel.includes('walk-in') || (rawChannel.includes('store') && !rawChannel.includes('online'));
                          const displayChannel = isInStore ? 'In Store' : 'Online Store';
                          const status = (o.status || 'Delivered').trim();
                          const isDelivered = status.toLowerCase() === 'delivered' || status.toLowerCase() === 'completed';
                          const isPending = status.toLowerCase().includes('pending');

                          return (
                            <View
                              key={orderId}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                width: '100%',
                                paddingHorizontal: 20,
                                paddingVertical: 13,
                                borderBottomWidth: 1,
                                borderBottomColor: tokens.border,
                              }}
                            >
                              {/* ORDER REF: pill box */}
                              <View style={{ flex: 2.5, paddingRight: 12 }}>
                                <View
                                  style={{
                                    alignSelf: 'flex-start',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: tokens.border,
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                                  }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 11.5,
                                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                      fontWeight: '700',
                                      color: tokens.textSecondary,
                                    }}
                                  >
                                    {orderId}
                                  </Text>
                                </View>
                              </View>

                              {/* CUSTOMER & DATE */}
                              <View style={{ flex: 2.5, paddingRight: 12 }}>
                                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                                  {o.customer_name || 'Customer'}
                                </Text>
                                <Text style={{ fontSize: 11, color: tokens.textMuted, marginTop: 1 }}>
                                  {o.order_date || 'Recent'}
                                </Text>
                              </View>

                              {/* CHANNEL */}
                              <View style={{ flex: 1.8, paddingRight: 12 }}>
                                <View
                                  style={{
                                    alignSelf: 'flex-start',
                                    paddingHorizontal: 8,
                                    paddingVertical: 2.5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    backgroundColor: isInStore
                                      ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                                      : (isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF'),
                                    borderColor: isInStore ? (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0') : (isDarkMode ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE'),
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isInStore ? (isDarkMode ? '#34D399' : '#059669') : (isDarkMode ? '#60A5FA' : '#2563EB'),
                                    }}
                                  >
                                    {displayChannel}
                                  </Text>
                                </View>
                              </View>

                              {/* AMOUNT */}
                              <View style={{ flex: 1.6, paddingRight: 12 }}>
                                <Text style={{ fontSize: 13.5, fontWeight: '800', color: tokens.textPrimary, fontVariant: ['tabular-nums'] }}>
                                  ₱{(Number(o.grand_total) || Number(o.total_amount) || 0).toLocaleString()}
                                </Text>
                              </View>

                              {/* STATUS */}
                              <View style={{ flex: 1.6, alignItems: 'center' }}>
                                <View
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 3,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    backgroundColor: isDelivered
                                      ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                                      : isPending
                                      ? (isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB')
                                      : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2'),
                                    borderColor: isDelivered ? (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0') : isPending ? (isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A') : (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FECACA'),
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDelivered ? (isDarkMode ? '#34D399' : '#047857') : isPending ? (isDarkMode ? '#FBBF24' : '#B45309') : (isDarkMode ? '#F87171' : '#B91C1C'),
                                    }}
                                  >
                                    {isDelivered ? 'Delivered' : isPending ? 'Pending COD' : status}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                  )}
                </View>
              </View>
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
                    value={orderStats.total}
                    sub={`₱${orderStats.totalRevenue.toLocaleString()} volume`}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={orderStats.pendingCod > 0 ? 'amber' : 'blue'}
                    label="Pending COD Approvals"
                    value={orderStats.pendingCod}
                    valueColor={orderStats.pendingCod > 0 ? '#D97706' : '#1D4533'}
                    sub="Requires Admin action"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Packing & Processing"
                    value={orderStats.processing}
                    sub="Ready for courier pickup"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Out for Delivery"
                    value={orderStats.shipped}
                    sub="On the road with courier"
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
                          backgroundColor: '#FDE68A',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <BootstrapIcon name="cash-coin" size={20} color="#92400E" />
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
                      zIndex: (isPaymentDropdownOpen || isOrderStatusDropdownOpen) ? 99999 : 10,
                      elevation: (isPaymentDropdownOpen || isOrderStatusDropdownOpen) ? 99999 : 1,
                    },
                  ]}
                >
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by Order ID, Customer, Phone, or Items..."
                      placeholderTextColor="#94A3B8"
                      value={orderSearchQuery}
                      onChangeText={setOrderSearchQuery}
                    />
                    {orderSearchQuery ? (
                      <TouchableOpacity onPress={() => setOrderSearchQuery('')}>
                        <BootstrapIcon name="x-circle" size={14} color="#94A3B8" />
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
                        { key: 'All', label: 'All Orders', count: orderStats.total, icon: 'list-check', color: '#1D4533' },
                        {
                          key: 'Pending Approval',
                          label: 'Pending COD',
                          count: orderStats.pendingCod,
                          icon: 'clock-history',
                          color: '#D97706',
                          highlight: orderStats.pendingCod > 0,
                        },
                        { key: 'Processing', label: 'Processing', count: orderStats.processing, icon: 'gear-wide-connected', color: '#0284C7' },
                        { key: 'Ready for Delivery', label: 'Ready', count: orderStats.ready, icon: 'box-seam', color: '#0EA5E9' },
                        { key: 'Out for Delivery', label: 'Out for Delivery', count: orderStats.shipped, icon: 'truck', color: '#6366F1' },
                        { key: 'Delivery Reported', label: 'Reported', count: orderStats.reported, icon: 'clipboard-check', color: '#1D4533' },
                        { key: 'Delivery Issue', label: 'Issue', count: orderStats.failed, icon: 'exclamation-triangle', color: '#DC2626' },
                        { key: 'Rescheduled', label: 'Rescheduled', count: orderStats.rescheduled, icon: 'arrow-repeat', color: '#D97706' },
                        { key: 'Delivered', label: 'Delivered', count: orderStats.delivered, icon: 'check-circle-fill', color: '#16A34A' },
                        { key: 'Cancelled', label: 'Cancelled', count: orderStats.cancelled, icon: 'x-circle-fill', color: '#DC2626' },
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
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isOrderStatusDropdownOpen
                                ? '#1D4533'
                                : activeOpt.highlight
                                  ? '#F59E0B'
                                  : orderStatusFilter !== 'All'
                                    ? '#1D4533'
                                    : isDarkMode ? '#334155' : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 170,
                              cursor: 'pointer',
                              boxShadow: isOrderStatusDropdownOpen
                                ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
                                : '0 1px 3px rgba(0, 0, 0, 0.04)',
                            }}
                            onPress={() => {
                              setIsOrderStatusDropdownOpen((prev) => !prev);
                              setIsPaymentDropdownOpen(false);
                            }}
                            activeOpacity={0.85}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <BootstrapIcon
                                name={activeOpt.icon}
                                size={13}
                                color={
                                  activeOpt.highlight
                                    ? '#D97706'
                                    : orderStatusFilter !== 'All'
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
                                      : orderStatusFilter !== 'All'
                                        ? '#1D4533'
                                        : isDarkMode ? '#F8FAFC' : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor:
                                    activeOpt.highlight
                                      ? '#FEF3C7'
                                      : orderStatusFilter !== 'All'
                                        ? '#1D4533'
                                        : isDarkMode ? '#334155' : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  marginLeft: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
                                    color:
                                      activeOpt.highlight
                                        ? '#B45309'
                                        : orderStatusFilter !== 'All'
                                          ? '#FFFFFF'
                                          : isDarkMode ? '#CBD5E1' : '#475569',
                                  }}
                                >
                                  {activeOpt.count}
                                </Text>
                              </View>
                            </View>
                            <BootstrapIcon
                              name={isOrderStatusDropdownOpen ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={isOrderStatusDropdownOpen ? '#1D4533' : '#64748B'}
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
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                        color={isSelected ? '#1D4533' : option.color || '#64748B'}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '800' : '600',
                                          color: isSelected
                                            ? '#1D4533'
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
                                              ? '#1D4533'
                                              : isDarkMode ? '#334155' : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '800',
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
                                      {isSelected && <BootstrapIcon name="check2" size={14} color="#1D4533" />}
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
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isPaymentDropdownOpen
                            ? '#1D4533'
                            : orderPaymentFilter !== 'All'
                              ? '#1D4533'
                              : isDarkMode ? '#334155' : '#E2E8F0',
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          minWidth: 155,
                          cursor: 'pointer',
                          boxShadow: isPaymentDropdownOpen
                            ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
                            : '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                        onPress={() => setIsPaymentDropdownOpen((prev) => !prev)}
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
                            color={orderPaymentFilter !== 'All' ? '#1D4533' : '#64748B'}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: orderPaymentFilter !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
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
                          color={isPaymentDropdownOpen ? '#1D4533' : '#64748B'}
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
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                    color={isSelected ? '#1D4533' : '#64748B'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '800' : '600',
                                      color: isSelected
                                        ? '#1D4533'
                                        : isDarkMode ? '#E2E8F0' : '#334155',
                                    }}
                                  >
                                    {option.label}
                                  </Text>
                                </View>
                                {isSelected && <BootstrapIcon name="check2" size={14} color="#1D4533" />}
                              </TouchableOpacity>
                            );
                          })}
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
                        backgroundColor: '#107C41',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        boxShadow: '0 2px 6px rgba(16, 124, 65, 0.25)',
                        cursor: 'pointer',
                      }}
                      onPress={() => {
                        const res = excelService.exportOrdersToExcel(filteredOrdersList, {
                          fileName: `mototrack_orders_${ordersFilter !== 'all' ? ordersFilter + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`,
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
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                        Export Excel ({filteredOrdersList.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#CBD5E1',
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
                      <BootstrapIcon name="download" size={13} color={isDarkMode ? '#94A3B8' : '#475569'} />
                      <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569', fontWeight: '700', fontSize: 12.5 }}>
                        CSV
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Orders List Table */}
                <View style={styles.tableCard}>
                  <View
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: '#E2E8F0',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>
                      Orders Ledger ({filteredOrdersList.length} shown)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        onPress={() => {
                          orderService.clearLocalOrders();
                          loadData();
                          showToast('Local offline orders cache cleared!');
                        }}
                      >
                        <BootstrapIcon name="trash3" size={13} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                          Clear Local Cache
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        onPress={loadData}
                      >
                        <BootstrapIcon name="arrow-repeat" size={13} color="#1D4533" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={{ width: '100%', minWidth: 1040, flexGrow: 1 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 150 }]}>Order ID</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 160 }]}>Customer</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.6, minWidth: 200 }]}>Items Summary</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 95 }]}>Payment</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 95, textAlign: 'right' }]}>Total</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 110, textAlign: 'center' }]}>
                          Status
                        </Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 150, textAlign: 'center' }]}>
                          Action
                        </Text>
                      </View>

                      {filteredOrdersList.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                          <BootstrapIcon name="receipt" size={32} color="#94A3B8" />
                          <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '700', color: '#64748B' }}>
                            No orders found matching the filter criteria.
                          </Text>
                        </View>
                      ) : (
                        filteredOrdersList.map((o, idx) => {
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

                          return (
                            <View
                              key={displayOrderId || idx}
                              style={[styles.tableRow, isPending && { backgroundColor: '#FFFBEB' }]}
                            >
                              {/* 0. Order ID */}
                              <View style={{ flex: 1.8, minWidth: 150, justifyContent: 'center' }}>
                                <View
                                  style={{
                                    alignSelf: 'flex-start',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3.5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                                  }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 11.5,
                                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                      fontWeight: '800',
                                      color: isDarkMode ? '#38BDF8' : '#0F172A',
                                    }}
                                  >
                                    {displayOrderId}
                                  </Text>
                                </View>
                              </View>

                              {/* 1. Customer */}
                              <View style={{ flex: 2.0, minWidth: 160, justifyContent: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <BootstrapIcon name="person-fill" size={13} color="#1D4533" />
                                  <Text style={[styles.tableTitle, { fontWeight: '800', fontSize: 13.5 }]} numberOfLines={1}>
                                    {o.customer_name || 'Walk-in Customer'}
                                  </Text>
                                </View>
                              </View>

                              {/* 2. Items Summary */}
                              <View style={{ flex: 2.6, minWidth: 210, justifyContent: 'center' }}>
                                <Text style={[styles.tableTitle, { fontSize: 12.5, lineHeight: 17 }]} numberOfLines={2}>
                                  {o.items_summary ||
                                    (o.items && o.items.length > 0
                                      ? o.items.map((it) => `${it.quantity || 1}x ${it.name}`).join(', ')
                                      : 'Motorcycle Parts')}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                  <BootstrapIcon name="box-seam" size={10} color="#94A3B8" />
                                  <Text style={[styles.tableSub, { fontSize: 11 }]}>
                                    {o.items_count || (o.items ? o.items.length : 1)} item(s)
                                  </Text>
                                </View>
                              </View>

                              {/* 3. Payment */}
                              <View style={{ flex: 1.1, minWidth: 95 }}>
                                <View
                                  style={{
                                    backgroundColor: isCOD ? '#FEF3C7' : '#EFF6FF',
                                    borderWidth: 1,
                                    borderColor: isCOD ? '#FDE68A' : '#BFDBFE',
                                    paddingHorizontal: 7,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: isCOD ? '#92400E' : '#1D4ED8',
                                      fontSize: 10.5,
                                      fontWeight: '800',
                                    }}
                                  >
                                    {isCOD ? 'COD' : o.payment_method || 'Online'}
                                  </Text>
                                </View>
                                {o.cod_change_for ? (
                                  <Text style={{ color: '#92400E', fontSize: 9.5, fontWeight: '700', marginTop: 3 }}>
                                    Change: ₱{Number(o.cod_change_for).toLocaleString()}
                                  </Text>
                                ) : null}
                              </View>

                              {/* 4. Total */}
                              <View style={{ flex: 1.1, minWidth: 95, alignItems: 'flex-end' }}>
                                <Text
                                  style={[
                                    styles.tableTitle,
                                    { color: '#1D4533', fontWeight: '900', fontSize: 13.5 },
                                  ]}
                                >
                                  ₱{(Number(o.grand_total) || Number(o.total_amount) || 0).toLocaleString()}
                                </Text>
                              </View>

                              {/* 5. Status */}
                              <View style={{ flex: 1.3, minWidth: 110, alignItems: 'center' }}>
                                <View
                                  style={{
                                    backgroundColor: isPending
                                      ? '#FEF3C7'
                                      : isProcessing || isReady
                                        ? '#EFF6FF'
                                        : isShipped || isRescheduled
                                          ? '#F3E8FF'
                                          : isDelivered
                                            ? '#D1FAE5'
                                            : '#FEE2E2',
                                    borderWidth: 1,
                                    borderColor: isPending
                                      ? '#FDE68A'
                                      : isProcessing || isReady
                                        ? '#BFDBFE'
                                        : isShipped || isRescheduled
                                          ? '#E9D5FF'
                                          : isDelivered
                                            ? '#A7F3D0'
                                            : '#FECACA',
                                    paddingHorizontal: 7,
                                    paddingVertical: 3.5,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: isPending
                                        ? '#92400E'
                                        : isProcessing || isReady
                                          ? '#1D4ED8'
                                          : isShipped || isRescheduled
                                            ? '#7E22CE'
                                            : isDelivered
                                              ? '#065F46'
                                              : '#DC2626',
                                      fontSize: 10,
                                      fontWeight: '900',
                                    }}
                                  >
                                    {statusLabel}
                                  </Text>
                                </View>
                              </View>

                              {/* 6. Action */}
                              <View
                                style={{
                                  flex: 1.8,
                                  minWidth: 150,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  flexShrink: 0,
                                }}
                              >
                                <TouchableOpacity
                                  style={[
                                    styles.btnViewOrder,
                                    !isDelivered && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                                  ]}
                                  onPress={() => openOrderModalWithOrder(o, false)}
                                  activeOpacity={0.85}
                                >
                                  <BootstrapIcon
                                    name={isDelivered ? 'eye' : 'sliders'}
                                    size={12}
                                    color={isDelivered ? '#334155' : '#1D4533'}
                                  />
                                  <Text
                                    style={[
                                      styles.btnViewOrderText,
                                      !isDelivered && { color: '#1D4533', fontWeight: '800' },
                                    ]}
                                  >
                                    {isDelivered ? 'Details' : 'Manage'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}</View>
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
                    sub={`Across ${invStats.totalUnits} items`}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="In Stock SKUs"
                    value={invStats.inStockCount}
                    valueColor="#1D4533"
                    sub="Above reorder level"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Low Stock Alert"
                    value={invStats.lowStockCount}
                    valueColor={invStats.lowStockCount > 0 ? '#D97706' : undefined}
                    sub="1 - 4 units remaining"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Out of Stock"
                    value={invStats.outOfStockCount}
                    valueColor={invStats.outOfStockCount > 0 ? '#DC2626' : '#1D4533'}
                    sub="0 units available"
                  />
                </View>

                {/* Recent supplier purchases — expense & profit */}
                {supplierPurchases.length > 0 && (
                  <View style={[styles.tableCard, { marginBottom: 14, padding: 14 }]}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
                      Recent Supplier Purchases
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                      Expense = what you paid the supplier. Profit = selling price − cost (per unit).
                    </Text>
                    {supplierPurchases.slice(0, 8).map((row) => (
                      <View
                        key={row.id}
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: '#E2E8F0',
                          alignItems: 'center',
                        }}
                      >
                        <View style={{ flex: 2, minWidth: 140 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                            {row.product_name}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
                            {row.supplier_name || 'Supplier'} · +{row.quantity} units
                          </Text>
                        </View>
                        <Text style={{ flex: 1, minWidth: 100, fontSize: 12, fontWeight: '700', color: '#B45309' }}>
                          Expense ₱{Number(row.expense || 0).toLocaleString()}
                        </Text>
                        <Text style={{ flex: 1, minWidth: 100, fontSize: 12, fontWeight: '700', color: '#059669' }}>
                          Profit ₱{Number(row.profit_per_unit || 0).toLocaleString()}/pc
                        </Text>
                        <Text style={{ flex: 1, minWidth: 90, fontSize: 12, color: '#475569' }}>
                          Sell ₱{Number(row.sell_price || 0).toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Low Stock Warning Banner */}
                {invStats.lowStockCount > 0 && (
                  <View style={styles.inventoryAlertBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <BootstrapIcon name="exclamation-triangle-fill" size={18} color="#D97706" />
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
                      <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
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
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search inventory by Part Name, Brand, or SKU..."
                      placeholderTextColor="#94A3B8"
                      value={invSearchQuery}
                      onChangeText={setInvSearchQuery}
                    />
                    {invSearchQuery ? (
                      <TouchableOpacity onPress={() => setInvSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
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
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isInvCategoryDropdownOpen
                          ? '#1D4533'
                          : invCategoryFilter !== 'All'
                            ? '#1D4533'
                            : isDarkMode ? '#334155' : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 160,
                        cursor: 'pointer',
                        boxShadow: isInvCategoryDropdownOpen
                          ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                          color={invCategoryFilter !== 'All' ? '#1D4533' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: invCategoryFilter !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                          }}
                        >
                          {invCategoryFilter === 'All' ? 'All Categories' : invCategoryFilter}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isInvCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={isInvCategoryDropdownOpen ? '#1D4533' : '#64748B'}
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
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 6,
                          gap: 3,
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        {CATEGORY_NAMES.map((cat) => {
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
                                  color={isSelected ? '#1D4533' : '#64748B'}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '800' : '600',
                                    color: isSelected
                                      ? '#1D4533'
                                      : isDarkMode ? '#E2E8F0' : '#334155',
                                  }}
                                >
                                  {cat === 'All' ? 'All Categories' : cat}
                                </Text>
                              </View>
                              {isSelected && (
                                <BootstrapIcon name="check2" size={14} color="#1D4533" />
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
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isInvStockDropdownOpen
                          ? '#1D4533'
                          : invStockFilter !== 'All'
                            ? '#1D4533'
                            : isDarkMode ? '#334155' : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 145,
                        cursor: 'pointer',
                        boxShadow: isInvStockDropdownOpen
                          ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                          color={invStockFilter !== 'All' ? '#1D4533' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: invStockFilter !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                          }}
                        >
                          {(STOCK_FILTER_OPTIONS.find((opt) => opt.key === invStockFilter) || STOCK_FILTER_OPTIONS[0]).label}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isInvStockDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={isInvStockDropdownOpen ? '#1D4533' : '#64748B'}
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
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                  color={isSelected ? '#1D4533' : '#64748B'}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '800' : '600',
                                    color: isSelected
                                      ? '#1D4533'
                                      : isDarkMode ? '#E2E8F0' : '#334155',
                                  }}
                                >
                                  {f.label}
                                </Text>
                              </View>
                              {isSelected && (
                                <BootstrapIcon name="check2" size={14} color="#1D4533" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Export Inventory to Excel Button */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      backgroundColor: '#107C41',
                      paddingHorizontal: 15,
                      paddingVertical: 10,
                      borderRadius: 12,
                      marginLeft: 'auto',
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
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                      Export Excel ({filteredInventory.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Inventory Table */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={{ width: '100%' }}
                  contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                >
                  <View style={[styles.tableCard, { width: '100%', minWidth: 920, flexGrow: 1 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.5, minWidth: 200 }]}>Product Part & SKU</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 110 }]}>Category</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 95, textAlign: 'right' }]}>
                        Unit Price
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.6, minWidth: 130, textAlign: 'center' }]}>
                        Current Stock
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 105, textAlign: 'center' }]}>
                        Stock Status
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 100, textAlign: 'right' }]}>
                        Stock Value
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.6, minWidth: 160, textAlign: 'center' }]}>
                        Quick Action
                      </Text>
                    </View>

                    {filteredInventory.map((p) => {
                      const isLow = isLowStock(p, 5);
                      const isOut = !p.stock || p.stock <= 0;
                      const stockVal = (p.price || 0) * (p.stock || 0);

                      return (
                        <View
                          key={p.id}
                          style={[
                            styles.tableRow,
                            isOut && styles.tableRowDanger,
                            isLow && styles.tableRowHighlight,
                          ]}
                        >
                          <View style={{ flex: 2.5, minWidth: 200, flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: p.image }} style={styles.productThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.tableTitle} numberOfLines={1}>
                                {p.name}
                              </Text>
                              <Text style={styles.tableSub}>
                                {p.brand} • SKU: {p.sku || p.id}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.tableSub, { flex: 1.2, minWidth: 110, color: '#0F172A', fontWeight: '600' }]}>
                            {p.category}
                          </Text>

                          <Text
                            style={[styles.tableTitle, { flex: 1.2, minWidth: 95, textAlign: 'right', color: '#1D4533' }]}
                          >
                            ₱{p.price?.toLocaleString()}
                          </Text>

                          {/* Current Stock */}
                          <View
                            style={{
                              flex: 1.6,
                              minWidth: 130,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={[
                                styles.tableTitle,
                                {
                                  fontWeight: '800',
                                  fontSize: 14,
                                  color: isOut ? '#DC2626' : isLow ? '#D97706' : isDarkMode ? '#F8FAFC' : '#0F172A',
                                  textAlign: 'center',
                                },
                              ]}
                            >
                              {p.stock || 0}
                            </Text>
                          </View>

                          {/* Status Badge */}
                          <View style={{ flex: 1.3, minWidth: 105, alignItems: 'center' }}>
                            <View
                              style={[
                                styles.stockStatusBadge,
                                isOut ? styles.stockOut : isLow ? styles.stockLow : styles.stockInStock,
                              ]}
                            >
                              <Text
                                style={[
                                  isOut
                                    ? styles.stockOutText
                                    : isLow
                                      ? styles.stockLowText
                                      : styles.stockInStockText,
                                ]}
                              >
                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.tableTitle,
                              { flex: 1.3, minWidth: 100, textAlign: 'right', fontWeight: '800', color: '#334155' },
                            ]}
                          >
                            ₱{stockVal.toLocaleString()}
                          </Text>

                          {/* Restock & Edit Action */}
                          <View style={{ flex: 1.6, minWidth: 160, flexDirection: 'row', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
                            <TouchableOpacity
                              style={[
                                styles.actionIconBtn,
                                {
                                  backgroundColor: '#FEF3C7',
                                  borderWidth: 1,
                                  borderColor: '#FDE68A',
                                  paddingHorizontal: 8,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                },
                              ]}
                              onPress={() => openSupplierPurchase(p)}
                            >
                              <BootstrapIcon name="box-arrow-in-down" size={13} color="#1D4533" />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>
                                Buy / Restock
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionIconBtn}
                              onPress={() => setEditingProduct({ ...p })}
                            >
                              <BootstrapIcon name="pencil" size={13} color="#475569" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
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
                      <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search parts catalog / Scan barcode..."
                        placeholderTextColor="#94A3B8"
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
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isPosCategoryDropdownOpen
                            ? '#1D4533'
                            : posCategoryFilter !== 'All'
                              ? '#1D4533'
                              : isDarkMode ? '#334155' : '#E2E8F0',
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          minWidth: 160,
                          cursor: 'pointer',
                          boxShadow: isPosCategoryDropdownOpen
                            ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
                            : '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                        onPress={() => setIsPosCategoryDropdownOpen((prev) => !prev)}
                        activeOpacity={0.85}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon
                            name={getCategoryIcon(posCategoryFilter)}
                            size={13}
                            color={posCategoryFilter !== 'All' ? '#1D4533' : '#64748B'}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: posCategoryFilter !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                            }}
                          >
                            {posCategoryFilter === 'All' ? 'All Categories' : posCategoryFilter}
                          </Text>
                        </View>
                        <BootstrapIcon
                          name={isPosCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={isPosCategoryDropdownOpen ? '#1D4533' : '#64748B'}
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
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                            boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                            zIndex: 99999,
                            padding: 6,
                            gap: 3,
                            maxHeight: 320,
                            overflowY: 'auto',
                          }}
                        >
                          {CATEGORY_NAMES.map((cat) => {
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
                                    color={isSelected ? '#1D4533' : '#64748B'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '800' : '600',
                                      color: isSelected
                                        ? '#1D4533'
                                        : isDarkMode ? '#E2E8F0' : '#334155',
                                    }}
                                  >
                                    {cat === 'All' ? 'All Categories' : cat}
                                  </Text>
                                </View>
                                {isSelected && (
                                  <BootstrapIcon name="check2" size={14} color="#1D4533" />
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
                        <BootstrapIcon name="cart3" size={18} color="#1D4533" />
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
                              backgroundColor: isDarkMode ? '#334155' : '#FEE2E2',
                            }}
                          >
                            <BootstrapIcon name="trash" size={11} color="#EF4444" />
                            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Clear</Text>
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
                          <Text style={{ color: '#1D4533', fontSize: 11, fontWeight: '800' }}>
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
                          <BootstrapIcon name="person-circle" size={16} color="#1D4533" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            {posSelectedCustomer.name}
                          </Text>
                        </View>
                        <BootstrapIcon
                          name={posCustomerDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color="#64748B"
                        />
                      </TouchableOpacity>

                      {/* Dropdown Customer Options */}
                      {posCustomerDropdownOpen && (
                        <View
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1D4533' }}>
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
                          <BootstrapIcon name="cart3" size={32} color="#94A3B8" />
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>
                          Cart is currently empty
                        </Text>
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                          Click any product part on the left to begin sale
                        </Text>
                      </View>
                    ) : (
                      <ScrollView
                        style={[styles.posCartItemsList, { flexShrink: 0, minHeight: 140, maxHeight: 260 }]}
                        contentContainerStyle={{ paddingRight: 4 }}
                        showsVerticalScrollIndicator={true}
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
                                <BootstrapIcon name="box-seam" size={16} color="#94A3B8" />
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
                                <Text style={{ fontWeight: '800', color: isDarkMode ? '#CBD5E1' : '#475569', fontSize: 13 }}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.posQtyText}>{item.quantity}</Text>
                              <TouchableOpacity
                                style={styles.posQtyBtn}
                                onPress={() => handlePOSUpdateQty(item.id, 1)}
                              >
                                <Text style={{ fontWeight: '800', color: isDarkMode ? '#CBD5E1' : '#475569', fontSize: 13 }}>+</Text>
                              </TouchableOpacity>
                            </View>

                            <View style={{ minWidth: 62, alignItems: 'flex-end', marginLeft: 8 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1D4533' }}>
                                ₱{(item.price * item.quantity).toLocaleString()}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={{ padding: 6, marginLeft: 4 }}
                              onPress={() => handlePOSUpdateQty(item.id, -item.quantity)}
                            >
                              <BootstrapIcon name="trash3" size={13} color="#EF4444" />
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
                        placeholderTextColor="#94A3B8"
                        value={posDiscountCode}
                        onChangeText={setPosDiscountCode}
                        autoCapitalize="characters"
                      />
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FEF3C7',
                          borderWidth: 1,
                          borderColor: '#FDE68A',
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          justifyContent: 'center',
                        }}
                        onPress={handlePOSApplyDiscount}
                      >
                        <Text style={{ color: '#1D4533', fontWeight: '800', fontSize: 12.5 }}>Apply</Text>
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
                          <Text style={[styles.posSummaryLabel, { color: '#059669' }]}>
                            Discount ({posDiscountPercent}% OFF)
                          </Text>
                          <Text style={[styles.posSummaryVal, { color: '#059669' }]}>
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
                            fontWeight: '800',
                            color: '#475569',
                            textTransform: 'uppercase',
                          }}
                        >
                          Cash Tendered (₱)
                        </Text>
                        <TextInput
                          style={[
                            styles.formInput,
                            { fontSize: 16, fontWeight: '900', color: '#1D4533', marginTop: 4 },
                          ]}
                          keyboardType="numeric"
                          placeholder="Enter amount given by customer..."
                          placeholderTextColor="#94A3B8"
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
              <View>
                {/* Key Telemetry Metrics */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Gross Sales Volume"
                    value={`₱${analyticsData.totalRevenue.toLocaleString()}`}
                    sub="Combined online & in-store"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="Average Order Value (AOV)"
                    value={`₱${Math.round(analyticsData.aov).toLocaleString()}`}
                    sub="Per transaction average"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Units Sold"
                    value={`${analyticsData.totalItemsSold} Items`}
                    sub={`Across ${analyticsData.totalOrders} total orders`}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="POS In-Store Sales Share"
                    value={`${
                      analyticsData.totalRevenue > 0
                        ? Math.round((analyticsData.posRevenue / analyticsData.totalRevenue) * 100)
                        : 0
                    }%`}
                    valueColor="#1D4533"
                    sub={`₱${analyticsData.posRevenue.toLocaleString()} in counter sales`}
                  />
                </View>

                {/* Revenue Trend Area Chart (matching Sales Forecast chart design system) */}
                <RevenueTrendChart
                  data={analyticsData.trendBars}
                  period={analyticsPeriod}
                  onPeriodChange={(newPeriod) => setAnalyticsPeriod(newPeriod)}
                  isDark={isDarkMode}
                  isDesktop={isDesktop}
                  title="Revenue Trend"
                  subtitle={
                    analyticsData.hasRealTrend
                      ? 'Weekly revenue from online storefront & in-store POS'
                      : 'No historical revenue data available.'
                  }
                />

                {/* Service Bookings Share (Pie Chart: Repair vs PMS vs Customization) */}
                <BookingCategoryPieChart
                  bookings={garageBookings}
                  isDark={isDarkMode}
                  isDesktop={isDesktop}
                />

                {/* Sales Channels Comparison & Top Products Leaderboard */}
                <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                  {/* Channel Breakdown */}
                  <View style={[styles.analyticsCard, { flex: 1, minWidth: 320 }]}>
                    <Text style={styles.analyticsCardTitle}>Sales Channel Distribution</Text>
                    <Text style={styles.analyticsCardSubtitle}>
                      Online storefront vs Walk-in POS transactions
                    </Text>

                    <View style={{ marginTop: 16 }}>
                      <View
                        style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                          In-Store POS Counter
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#1D4533' }}>
                          ₱{analyticsData.posRevenue.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${
                                analyticsData.totalRevenue > 0
                                  ? (analyticsData.posRevenue / analyticsData.totalRevenue) * 100
                                  : 50
                              }%`,
                            },
                          ]}
                        />
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          marginTop: 16,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                          Online Store Dispatches
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#EAB308' }}>
                          ₱{analyticsData.onlineRevenue.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              backgroundColor: '#EAB308',
                              width: `${
                                analyticsData.totalRevenue > 0
                                  ? (analyticsData.onlineRevenue / analyticsData.totalRevenue) * 100
                                  : 50
                              }%`,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Payment Methods */}
                    <Text style={[styles.analyticsCardTitle, { marginTop: 24, fontSize: 14.5 }]}>
                      Payment Method Breakdown
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {Object.entries(analyticsData.paymentBreakdown).map(([method, count]) => (
                        <View
                          key={method}
                          style={{
                            flex: 1,
                            minWidth: 70,
                            backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                            padding: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.textMuted }}>{method}</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#1D4533', marginTop: 2 }}>
                            {count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Top Earners Products Leaderboard */}
                  <View style={[styles.analyticsCard, { flex: 1, minWidth: 320, backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF', borderColor: tokens.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <Text style={[styles.analyticsCardTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>Top earners</Text>
                        <Text style={[styles.analyticsCardSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 4 }]}>By lifetime revenue</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setActiveNav('products')}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderRadius: 8, cursor: 'pointer' }}
                      >
                        <Text style={{ color: isDarkMode ? '#F8FAFC' : '#64748B', fontSize: 12, fontWeight: '600' }}>View products</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ marginTop: 20 }}>
                      {analyticsData.topProducts.map((tp, idx) => {
                        const maxRev = analyticsData.topProducts[0]?.revenue || 1;
                        const barWidth = Math.max(5, (tp.revenue / maxRev) * 100);
                        
                        return (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ width: 50, height: 40, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderRadius: 8, overflow: 'hidden', marginRight: 12 }}>
                              {tp.image_url ? (
                                <Image source={{ uri: tp.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                              ) : (
                                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                  <BootstrapIcon name="box-seam" size={16} color={isDarkMode ? "#94A3B8" : "#CBD5E1"} />
                                </View>
                              )}
                            </View>
                            
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }} numberOfLines={1}>
                                  {tp.name}
                                </Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                                  ₱{tp.revenue.toLocaleString()}
                                </Text>
                              </View>
                              
                              <View style={{ height: 6, backgroundColor: isDarkMode ? '#334155' : '#E2E8F0', borderRadius: 3, width: '100%', overflow: 'hidden' }}>
                                <View style={{ height: '100%', width: `${barWidth}%`, backgroundColor: '#1D4533', borderRadius: 3 }} />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Category Revenue (observed totals — forecasting lives in Sales Forecast tab) */}
                <View style={[styles.analyticsCard, { marginTop: 20 }]}>
                  <Text style={styles.analyticsCardTitle}>Category Revenue</Text>
                  <Text style={styles.analyticsCardSubtitle}>
                    Observed sales totals by category. Demand forecasts use Croston/SBA in Sales Forecast.
                  </Text>
                  
                  <View style={{ marginTop: 16 }}>
                    {analyticsData.categoryRegression && analyticsData.categoryRegression.length > 0 ? (
                      analyticsData.categoryRegression.map((catReg, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                          <View style={{ flex: 1.5 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{catReg.category}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              Historical: ₱{catReg.totalRevenue.toLocaleString()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: '800' }}>
                              Share of catalog sales
                            </Text>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#1D4533', marginTop: 2 }}>
                              {analyticsData.totalRevenue > 0
                                ? `${Math.round((catReg.totalRevenue / analyticsData.totalRevenue) * 100)}%`
                                : '—'}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: '#64748B', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 }}>
                        No historical revenue data available.
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* ─── TAB 4b: SALES FORECAST & STOCK OPTIMIZATION ─── */}
            {activeNav === 'forecast' && (
              <SalesForecastPanel
                orders={orders}
                products={products}
                isDarkMode={isDarkMode}
                isDesktop={isDesktop}
              />
            )}

            {activeNav === 'customizations' && (
              <CustomizationsAdminPanel isDarkMode={isDarkMode} />
            )}

            {activeNav === 'moto_models' && (
              <MotorcycleModelsAdminPanel onToast={showToast} />
            )}

            {/* ─── TAB 5: PRODUCTS & PRICES MANAGEMENT ─── */}
            {activeNav === 'products' && (
              <View>
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
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search products by name or brand..."
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
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
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isProdCategoryDropdownOpen
                          ? '#1D4533'
                          : selectedCategory !== 'All'
                            ? '#1D4533'
                            : isDarkMode ? '#334155' : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 160,
                        cursor: 'pointer',
                        boxShadow: isProdCategoryDropdownOpen
                          ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
                          : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                      onPress={() => setIsProdCategoryDropdownOpen((prev) => !prev)}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <BootstrapIcon
                          name={getCategoryIcon(selectedCategory)}
                          size={13}
                          color={selectedCategory !== 'All' ? '#1D4533' : '#64748B'}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: selectedCategory !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                          }}
                        >
                          {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                        </Text>
                      </View>
                      <BootstrapIcon
                        name={isProdCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={isProdCategoryDropdownOpen ? '#1D4533' : '#64748B'}
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
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                          zIndex: 99999,
                          padding: 6,
                          gap: 3,
                          maxHeight: 320,
                          overflowY: 'auto',
                        }}
                      >
                        {CATEGORY_NAMES.map((cat) => {
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
                                  color={isSelected ? '#1D4533' : '#64748B'}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? '800' : '600',
                                    color: isSelected
                                      ? '#1D4533'
                                      : isDarkMode ? '#E2E8F0' : '#334155',
                                  }}
                                >
                                  {cat === 'All' ? 'All Categories' : cat}
                                </Text>
                              </View>
                              {isSelected && (
                                <BootstrapIcon name="check2" size={14} color="#1D4533" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Export Products to Excel Button */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      backgroundColor: '#107C41',
                      paddingHorizontal: 15,
                      paddingVertical: 10,
                      borderRadius: 12,
                      marginLeft: 'auto',
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
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                      Export Excel ({filteredProducts.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Products Table — Cost & Profit visible to admin */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ width: '100%' }}
                  contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                >
                  <View style={[styles.tableCard, { width: '100%', minWidth: 980, flexGrow: 1 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.4 }]}>Product & Brand</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Category</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>
                        Cost (₱)
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>
                        Price (₱)
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>
                        Profit (₱)
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'center' }]}>
                        Margin
                      </Text>
                      <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Stock</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>
                        Actions
                      </Text>
                    </View>

                    {filteredProducts.map((p) => {
                      const cost = Number(p.unit_cost ?? p.unitCost ?? 0);
                      const price = Number(p.price) || 0;
                      const profit = price - cost;
                      const margin = price > 0 ? (profit / price) * 100 : 0;
                      return (
                      <View key={p.id} style={styles.tableRow}>
                        <View style={{ flex: 2.4, flexDirection: 'row', alignItems: 'center' }}>
                          <Image source={{ uri: p.image }} style={styles.productThumb} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tableTitle} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={styles.tableSub}>
                              {p.brand} • {p.compatibility || 'Universal'}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.tableSub, { flex: 1.1, color: '#0F172A', fontWeight: '600' }]}>
                          {p.category}
                        </Text>

                        {/* Editable Cost */}
                        <View style={{ flex: 1.1, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 80 }]}
                            keyboardType="numeric"
                            defaultValue={String(cost)}
                            onEndEditing={(e) => handleUpdateCost(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        {/* Editable Price */}
                        <View style={{ flex: 1.1, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 80 }]}
                            keyboardType="numeric"
                            defaultValue={String(p.price)}
                            onEndEditing={(e) => handleUpdatePrice(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        <Text
                          style={[
                            styles.tableSub,
                            {
                              flex: 1.1,
                              textAlign: 'center',
                              fontWeight: '800',
                              color: profit >= 0 ? '#059669' : '#DC2626',
                            },
                          ]}
                        >
                          ₱{profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </Text>

                        <Text
                          style={[
                            styles.tableSub,
                            {
                              flex: 0.9,
                              textAlign: 'center',
                              fontWeight: '800',
                              color: margin < 15 ? '#D97706' : '#0F172A',
                            },
                          ]}
                        >
                          {margin.toFixed(1)}%
                        </Text>

                        {/* Editable Stock */}
                        <View style={{ flex: 0.8, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 50 }]}
                            keyboardType="numeric"
                            defaultValue={String(p.stock)}
                            onEndEditing={(e) => handleUpdateStock(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        {/* Actions */}
                        <View style={{ flex: 1.1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnEdit]}
                            onPress={() => setEditingProduct({ ...p, unit_cost: cost, unitCost: cost })}
                            title="Edit Product"
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon name="pencil-square" size={17} color="#2563EB" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                            onPress={() => handleDeleteProduct(p.product_id || p.id, p.name)}
                            title="Delete Product"
                            activeOpacity={0.7}
                          >
                            <BootstrapIcon name="trash3" size={17} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ─── TAB 6: PROMO VOUCHERS ─── */}
            {activeNav === 'promos' && (
              <View>
                <View style={styles.tableCard}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={{ width: '100%', minWidth: 840, flexGrow: 1 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 2, minWidth: 140 }]}>Promo Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 100, textAlign: 'center' }]}>Discount</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 3, minWidth: 200 }]}>Description</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 140, textAlign: 'center' }]}>
                          Status / Toggle
                        </Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 100, textAlign: 'center' }]}>Actions</Text>
                      </View>

                      {promos.map((prm) => (
                        <View
                          key={prm.code}
                          style={[
                            styles.tableRow,
                            !prm.isActive && { opacity: 0.65, backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC' },
                          ]}
                        >
                          <View style={{ flex: 2, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text
                              style={[
                                styles.tableTitle,
                                {
                                  color: prm.isActive ? (isDarkMode ? '#34D399' : '#1D4533') : (isDarkMode ? '#94A3B8' : '#64748B'),
                                  fontWeight: '900',
                                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                },
                              ]}
                            >
                              {prm.code}
                            </Text>
                            {!prm.isActive && (
                              <View
                                style={{
                                  backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9',
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: tokens.border,
                                }}
                              >
                                <Text style={{ fontSize: 9.5, color: tokens.textMuted, fontWeight: '800' }}>
                                  DISABLED
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text
                            style={[
                              styles.tableTitle,
                              {
                                flex: 1.5,
                                minWidth: 100,
                                textAlign: 'center',
                                color: prm.isActive ? '#D97706' : '#94A3B8',
                                fontWeight: '900',
                              },
                            ]}
                          >
                            {prm.discountPercent}% OFF
                          </Text>
                          <Text style={[styles.tableSub, { flex: 3, minWidth: 200 }]}>
                            {prm.description || 'General store discount'}
                          </Text>

                          {/* Interactive Active / Inactive Status Switch */}
                          <View style={{ flex: 1.8, minWidth: 140, alignItems: 'center' }}>
                            <TouchableOpacity
                              style={[
                                styles.promoStatusToggleBtn,
                                prm.isActive ? styles.promoStatusActive : styles.promoStatusInactive,
                              ]}
                              onPress={() => handleTogglePromo(prm.code, prm.isActive)}
                              activeOpacity={0.8}
                            >
                              <View
                                style={[
                                  styles.promoToggleDot,
                                  prm.isActive ? styles.promoToggleDotActive : styles.promoToggleDotInactive,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.promoStatusText,
                                  prm.isActive ? styles.promoStatusTextActive : styles.promoStatusTextInactive,
                                ]}
                              >
                                {prm.isActive ? 'Active (ON)' : 'Inactive (OFF)'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Action Buttons */}
                          <View style={{ flex: 1.5, minWidth: 100, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={[
                                styles.actionIconBtn,
                                prm.isActive ? styles.actionIconBtnWarning : styles.actionIconBtnSuccess,
                              ]}
                              onPress={() => handleTogglePromo(prm.code, prm.isActive)}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon
                                name={prm.isActive ? 'toggle-on' : 'toggle-off'}
                                size={15}
                                color={prm.isActive ? '#D97706' : '#16A34A'}
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                              onPress={() => handleDeletePromo(prm.code)}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="trash3" size={17} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon name="tools" size={15} color="#1D4533" />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isDarkMode ? '#94A3B8' : '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                        }}
                      >
                        Garage Workspace View
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#107C41',
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
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
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
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isGarageSubTabDropdownOpen ? '#1D4533' : isDarkMode ? '#334155' : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        cursor: 'pointer',
                        boxShadow: isGarageSubTabDropdownOpen
                          ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                            label: 'Service Packages Catalog',
                            icon: 'tools',
                            count: garageServices.length,
                            desc: 'Maintenance packages & service tiers',
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
                              <BootstrapIcon name={activeObj.icon} size={15} color="#1D4533" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: '800',
                                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                  }}
                                >
                                  {activeObj.label}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: '#1D4533',
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
                                  color: isDarkMode ? '#94A3B8' : '#64748B',
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
                          color={isDarkMode ? '#94A3B8' : '#475569'}
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
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                            label: 'Service Packages Catalog',
                            icon: 'tools',
                            count: garageServices.length,
                            desc: 'Maintenance packages & service tiers',
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
                                    ? '#1D4533'
                                    : isDarkMode ? '#0F172A' : '#F1F5F9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <BootstrapIcon
                                  name={tab.icon}
                                  size={15}
                                  color={isSelected ? '#FFFFFF' : '#1D4533'}
                                />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '800' : '600',
                                      color: isSelected
                                        ? '#1D4533'
                                        : isDarkMode ? '#F8FAFC' : '#1E293B',
                                    }}
                                  >
                                    {tab.label}
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: isSelected
                                        ? '#1D4533'
                                        : isDarkMode ? '#334155' : '#E2E8F0',
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
                                        color: isSelected ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#475569',
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
                                    color: isDarkMode ? '#94A3B8' : '#64748B',
                                    marginTop: 1,
                                  }}
                                >
                                  {tab.desc}
                                </Text>
                              </View>

                              {isSelected && (
                                <BootstrapIcon name="check2" size={16} color="#1D4533" />
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
                    {/* Booking Stats Cards */}
                    <View style={styles.statsGrid}>
                      <AdminStatCard
                        styles={styles}
                        accent="teal"
                        label="Total Bookings"
                        value={bookingStats.total}
                        sub="All service requests"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent={bookingStats.pending > 0 ? 'amber' : 'blue'}
                        label="Pending Review"
                        value={bookingStats.pending}
                        valueColor={bookingStats.pending > 0 ? '#D97706' : undefined}
                        sub="Needs approve / reject"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="teal"
                        label="Approved"
                        value={bookingStats.approved}
                        sub="Awaiting schedule"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="blue"
                        label="Scheduled"
                        value={bookingStats.scheduled}
                        sub="On calendar"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="purple"
                        label="Under Inspection"
                        value={bookingStats.underInspection}
                        sub="Diagnosing"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="amber"
                        label="Waiting Approval"
                        value={bookingStats.waitingCustomerApproval}
                        valueColor="#D97706"
                        sub="Quote with customer"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="amber"
                        label="Waiting DP"
                        value={bookingStats.waitingDownpayment}
                        valueColor="#D97706"
                        sub="Downpayment due"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="amber"
                        label="In Service"
                        value={bookingStats.inProgress}
                        valueColor={bookingStats.inProgress > 0 ? '#D97706' : undefined}
                        sub="Active repairs"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="amber"
                        label="Final Payment"
                        value={bookingStats.waitingFinalPayment}
                        sub="Balance due"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="green"
                        label="Ready Pickup"
                        value={bookingStats.readyForPickup}
                        valueColor="#1D4533"
                        sub="QR / release"
                      />
                      <AdminStatCard
                        styles={styles}
                        accent="green"
                        label="Completed"
                        value={bookingStats.completed}
                        valueColor="#1D4533"
                        sub="Closed bookings"
                      />
                    </View>

                    {/* Toolbar (Search, Filter Tabs, Add Walk-in) */}
                    <View style={[styles.toolbarRow, { marginBottom: 12 }]}>
                      <View style={styles.searchInputBox}>
                        <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search by Ref ID, Customer, Phone, Bike, Plate, or Service..."
                          placeholderTextColor="#94A3B8"
                          value={bookingSearchQuery}
                          onChangeText={(t) => {
                            setBookingSearchQuery(t);
                            setBookingPage(1);
                          }}
                        />
                        {bookingSearchQuery ? (
                          <TouchableOpacity onPress={() => setBookingSearchQuery('')}>
                            <BootstrapIcon name="x-circle" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <TextInput
                        style={[styles.searchInputBox, { maxWidth: 160, marginLeft: 8 }]}
                        placeholder="Date YYYY-MM-DD"
                        placeholderTextColor="#94A3B8"
                        value={bookingDateFilter}
                        onChangeText={(t) => {
                          setBookingDateFilter(t);
                          setBookingPage(1);
                        }}
                      />

                      <View style={[styles.searchInputBox, { maxWidth: 180, marginLeft: 8 }]}>
                        <BootstrapIcon name="person" size={14} color="#64748B" style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Filter by customer"
                          placeholderTextColor="#94A3B8"
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
                            <BootstrapIcon name="x-circle" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={[styles.addBtnPrimary, { backgroundColor: '#1D4533' }]}
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
                      {/* Booking Status Filter Dropdown — classic table/calendar only */}
                      {bookingViewMode !== 'workflow' ? (
                      <View
                        style={{
                          position: 'relative',
                          zIndex: isBookingStatusDropdownOpen ? 99999 : 10,
                        }}
                      >
                        {(() => {
                          const bookingStatusOptions = [
                            { key: 'All', label: 'All Bookings', count: bookingStats.total, icon: 'grid-fill', color: '#1D4533' },
                            { key: 'Pending', label: 'Pending Review', count: bookingStats.pending, icon: 'hourglass-split', color: '#D97706', highlight: bookingStats.pending > 0 },
                            { key: 'Confirmed', label: 'Confirmed', count: bookingStats.confirmed, icon: 'clock-fill', color: '#0284C7' },
                            { key: 'Inspection', label: 'Inspection', count: bookingStats.inspection, icon: 'search', color: '#8B5CF6' },
                            { key: 'In Progress', label: 'In Bay', count: bookingStats.inProgress, icon: 'gear-wide-connected', color: '#F59E0B', highlight: bookingStats.inProgress > 0 },
                            { key: 'Service Done', label: 'Done / Bill', count: bookingStats.serviceDone, icon: 'receipt', color: '#10B981' },
                            { key: 'Completed', label: 'Completed', count: bookingStats.completed, icon: 'check-circle-fill', color: '#16A34A' },
                            { key: 'Cancelled', label: 'Cancelled', count: bookingStats.cancelled, icon: 'x-circle-fill', color: '#DC2626' },
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
                                  backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                  borderWidth: 1.5,
                                  borderColor: isBookingStatusDropdownOpen
                                    ? '#1D4533'
                                    : activeOpt.highlight
                                      ? '#F59E0B'
                                      : bookingStatusFilter !== 'All'
                                        ? '#1D4533'
                                        : isDarkMode ? '#334155' : '#E2E8F0',
                                  borderRadius: 12,
                                  paddingHorizontal: 14,
                                  paddingVertical: 9,
                                  minWidth: 180,
                                  cursor: 'pointer',
                                  boxShadow: isBookingStatusDropdownOpen
                                    ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                                            ? '#1D4533'
                                            : isDarkMode ? '#F8FAFC' : '#0F172A',
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
                                            ? '#1D4533'
                                            : isDarkMode ? '#334155' : '#E2E8F0',
                                      paddingHorizontal: 6,
                                      paddingVertical: 1,
                                      borderRadius: 8,
                                      marginLeft: 2,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: '800',
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
                                  color={isBookingStatusDropdownOpen ? '#1D4533' : '#64748B'}
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
                                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                    borderRadius: 14,
                                    borderWidth: 1.5,
                                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                            color={isSelected ? '#1D4533' : option.color || '#64748B'}
                                          />
                                          <Text
                                            style={{
                                              fontSize: 13,
                                              fontWeight: isSelected ? '800' : '600',
                                              color: isSelected
                                                ? '#1D4533'
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
                                                  ? '#1D4533'
                                                  : isDarkMode ? '#334155' : '#E2E8F0',
                                              paddingHorizontal: 6,
                                              paddingVertical: 1,
                                              borderRadius: 6,
                                            }}
                                          >
                                            <Text
                                              style={{
                                                fontSize: 10.5,
                                                fontWeight: '800',
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
                                          {isSelected && <BootstrapIcon name="check2" size={14} color="#1D4533" />}
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
                      ) : (
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                          Workflow desk — filter by stage below
                        </Text>
                      )}

                      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                        {bookingViewMode !== 'workflow' &&
                          ['All', 'Repair', 'PMS', 'Customization'].map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.orderFilterTab,
                              bookingCategoryFilter === cat && {
                                backgroundColor: '#1D4533',
                                borderColor: '#1D4533',
                              },
                            ]}
                            onPress={() => {
                              setBookingCategoryFilter(cat);
                              setBookingPage(1);
                            }}
                          >
                            <Text
                              style={[
                                styles.orderFilterTabText,
                                bookingCategoryFilter === cat && { color: '#FFFFFF', fontWeight: '800' },
                              ]}
                            >
                              {cat === 'All' ? 'All Types' : cat}
                            </Text>
                          </TouchableOpacity>
                        ))}

                        {/* View Mode Toggle: Table / Calendar / Workflow */}
                        <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8, backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', padding: 3, borderRadius: 10 }}>
                          <TouchableOpacity
                            style={[
                              styles.orderFilterTab,
                              { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 0, borderRadius: 7 },
                              bookingViewMode === 'table' && {
                                backgroundColor: '#1D4533',
                              },
                            ]}
                            onPress={() => setBookingViewMode('table')}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <BootstrapIcon name="table" size={12} color={bookingViewMode === 'table' ? '#FFFFFF' : '#64748B'} />
                              <Text
                                style={[
                                  styles.orderFilterTabText,
                                  bookingViewMode === 'table' && { color: '#FFFFFF', fontWeight: '800' },
                                ]}
                              >
                                Table
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.orderFilterTab,
                              { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 0, borderRadius: 7 },
                              bookingViewMode === 'calendar' && {
                                backgroundColor: '#1D4533',
                              },
                            ]}
                            onPress={() => setBookingViewMode('calendar')}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <BootstrapIcon
                                name="calendar-week"
                                size={12}
                                color={bookingViewMode === 'calendar' ? '#FFFFFF' : '#64748B'}
                              />
                              <Text
                                style={[
                                  styles.orderFilterTabText,
                                  bookingViewMode === 'calendar' && { color: '#FFFFFF', fontWeight: '800' },
                                ]}
                              >
                                Calendar
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.orderFilterTab,
                              { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 0, borderRadius: 7 },
                              bookingViewMode === 'workflow' && {
                                backgroundColor: '#1D4533',
                              },
                            ]}
                            onPress={() => setBookingViewMode('workflow')}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <BootstrapIcon name="list-task" size={12} color={bookingViewMode === 'workflow' ? '#FFFFFF' : '#64748B'} />
                              <Text
                                style={[
                                  styles.orderFilterTabText,
                                  bookingViewMode === 'workflow' && { color: '#FFFFFF', fontWeight: '800' },
                                ]}
                              >
                                Workflow
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Bookings View: Workflow Desk / Calendar / Table */}
                    {bookingViewMode === 'workflow' ? (
                      <AdminBookingManager
                        bookings={garageBookings}
                        mechanics={garageMechanics}
                        onToast={showToast}
                        onRefresh={(list) => {
                          if (Array.isArray(list)) setGarageBookings(list);
                        }}
                        onOpenLegacyModal={handleOpenBookingModal}
                        styles={styles}
                      />
                    ) : bookingViewMode === 'calendar' ? (
                      <View style={{ gap: 16, marginBottom: 20 }}>
                        <BookingCalendar
                          showAdminControls={true}
                          selectedDate={calendarSelectedDate}
                          onSelectDate={(dateStr) => setCalendarSelectedDate(dateStr)}
                          onFullyBookedSelected={(dateStr) => {
                            showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! All 6 pit bays are reserved.`);
                          }}
                          getDayInfo={(dateStr) => {
                            const dayBks = garageBookings.filter(
                              (b) => (b.appointment_date || '').split('T')[0] === dateStr
                            );
                            const count = dayBks.length;
                            const d = new Date(dateStr + 'T00:00:00');
                            const isSunday = d.getDay() === 0;
                            const isOff = adminOffDutyDates[dateStr] ?? isSunday;
                            return {
                              bookingCount: count,
                              isFullyBooked: count >= 6,
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
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderRadius: 16,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                  <BootstrapIcon name="calendar-check-fill" size={16} color="#1D4533" />
                                  <Text style={{ fontSize: 15, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
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
                                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1D4533' }}>
                                      {dateAppointments.length} Booked
                                    </Text>
                                  </View>
                                </View>

                                <TouchableOpacity
                                  style={[styles.addBtnPrimary, { backgroundColor: '#1D4533', paddingVertical: 6, paddingHorizontal: 12 }]}
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
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>+ Book This Day</Text>
                                </TouchableOpacity>
                              </View>

                              {dateAppointments.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                                  <BootstrapIcon name="calendar2-check" size={26} color="#94A3B8" style={{ marginBottom: 6 }} />
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#94A3B8' : '#64748B' }}>
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
                                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                                        gap: 10,
                                      }}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1D4533' }}>
                                            {bk.booking_id || bk.id}
                                          </Text>
                                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>
                                            {bk.customer_name || 'Walk-in Customer'}
                                          </Text>
                                          <Text style={{ fontSize: 11, color: '#64748B' }}>
                                            ({bk.bike_model || bk.motorcycle || 'Motorcycle'})
                                          </Text>
                                        </View>
                                        <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                                          {bk.service_name || bk.package_name || bk.category || 'Service'} • Slot: {bk.time_slot || 'Morning'} • Tech: {bk.mechanic || 'Unassigned'}
                                        </Text>
                                      </View>

                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View
                                          style={{
                                            backgroundColor: '#FEF3C7',
                                            paddingHorizontal: 7,
                                            paddingVertical: 2,
                                            borderRadius: 5,
                                          }}
                                        >
                                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#B45309' }}>
                                            {bk.status || 'Pending'}
                                          </Text>
                                        </View>
                                        <TouchableOpacity
                                          style={[styles.actionIconBtn, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}
                                          onPress={() => handleOpenBookingDetail(bk)}
                                          activeOpacity={0.8}
                                        >
                                          <BootstrapIcon name="eye-fill" size={12} color="#1D4533" />
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
                      /* Bookings Table Card */
                      <View style={styles.tableCard}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={true}
                          contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                        >
                          <View style={{ width: '100%', minWidth: 1140, flexGrow: 1 }}>
                            <View style={styles.tableHeaderRow}>
                              <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 160 }]}>Booking & Schedule</Text>
                              <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 140 }]}>Customer</Text>
                              <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 130 }]}>Motorcycle</Text>
                              <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 140 }]}>Service & Quote</Text>
                              <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 130 }]}>Assigned Mechanic</Text>
                              <Text style={[styles.tableHeaderCell, { flex: 1.4, minWidth: 130, textAlign: 'center' }]}>
                                Status & Payment
                              </Text>
                              <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 120, textAlign: 'center' }]}>
                                Action
                              </Text>
                            </View>

                          {filteredBookings.length === 0 ? (
                            <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                              <BootstrapIcon
                                name="calendar-x"
                                size={32}
                                color="#94A3B8"
                                style={{ marginBottom: 8 }}
                              />
                              <Text style={{ fontSize: 15, fontWeight: '800', color: '#475569' }}>
                                No Service Appointments Found
                              </Text>
                              <Text style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4 }}>
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
                              const quoteAmt = bookingQuotationTotal(b);
                              const payStat = bookingPaymentStatus(b);
                              const sc = statusColor(b.status);

                              return (
                                <View
                                  key={b.id || b.booking_id}
                                  style={[
                                    styles.tableRow,
                                    isPending && { backgroundColor: '#FFFDF5', borderLeftColor: '#F59E0B', borderLeftWidth: 3 },
                                    isInProg && { backgroundColor: '#FFFBEB' },
                                  ]}
                                >
                                  {/* 1. Booking ID & Preferred Schedule (Important Only) */}
                                  <View style={{ flex: 1.8, minWidth: 160, gap: 4 }}>
                                    <Text style={[styles.tableTitle, { color: '#1D4533', fontWeight: '800' }]}>
                                      {b.booking_id || b.id}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                      <BootstrapIcon name="calendar-event" size={11} color="#64748B" />
                                      <Text style={[styles.tableSub, { color: '#334155', fontWeight: '600', fontSize: 11.5 }]}>
                                        {b.preferred_date || b.appointment_date || b.date || '—'}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                      <BootstrapIcon name="clock" size={11} color="#64748B" />
                                      <Text style={[styles.tableSub, { color: '#64748B', fontSize: 11 }]}>
                                        {b.preferred_time || b.time_slot || b.time || '—'}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* 2. Customer Name & Contact Phone (Important Only) */}
                                  <View style={{ flex: 1.5, minWidth: 140, gap: 3 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                      <BootstrapIcon name="person-fill" size={12} color="#1D4533" />
                                      <Text style={[styles.tableTitle, { fontSize: 13 }]} numberOfLines={1}>
                                        {b.customer_name || b.userName || 'Customer'}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                      <BootstrapIcon name="telephone-fill" size={11} color="#64748B" />
                                      <Text style={[styles.tableSub, { fontSize: 11.5 }]}>
                                        {b.customer_phone || b.userPhone || 'No phone'}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* 3. Motorcycle & Plate (Important Only) */}
                                  <View style={{ flex: 1.4, minWidth: 130, gap: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                      <BootstrapIcon name="bicycle" size={13} color="#0F172A" />
                                      <Text style={[styles.tableTitle, { fontSize: 12.5 }]} numberOfLines={1}>
                                        {b.bike_brand || b.bikeBrand} {b.bike_model || b.bikeModel}
                                      </Text>
                                    </View>
                                    <View style={styles.bikeInfoRow}>
                                      <View style={styles.bikePlatePill}>
                                        <Text style={styles.bikePlateText}>
                                          {b.plate_number || b.bikePlate || 'TEMP-PLATE'}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>

                                  {/* 4. Service Package & Price (Important Only) */}
                                  <View style={{ flex: 1.5, minWidth: 140, gap: 3 }}>
                                    <Text style={[styles.tableTitle, { fontSize: 13 }]} numberOfLines={1}>
                                      {b.package_name || b.service_title || b.serviceName || 'Pitstop Service'}
                                    </Text>
                                    <Text style={[styles.tableTitle, { color: '#1D4533', fontSize: 13, fontWeight: '800' }]}>
                                      ₱{(b.pricePhp || usdToPhp(b.service_price) || 0).toLocaleString()}
                                    </Text>
                                  </View>

                                  {/* 5. Assigned Mechanic */}
                                  <View style={{ flex: 1.4, minWidth: 130 }}>
                                    <View style={styles.techPill}>
                                      <BootstrapIcon name="wrench" size={11} color="#1D4533" />
                                      <Text style={styles.techPillText} numberOfLines={1}>
                                        {b.mechanic
                                          ? b.mechanic
                                              .split('(')[0]
                                              .replace('Master Tech ', '')
                                              .replace('Specialist ', '')
                                          : 'Pending Assignment'}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* 6. Live Status & Payment */}
                                  <View style={{ flex: 1.4, minWidth: 130, alignItems: 'center', justifyContent: 'center' }}>
                                    <View
                                      style={[
                                        styles.bookingStatusBadge,
                                        isPending && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                                        isConfirmed && styles.statusConfirmed,
                                        isInspection && { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' },
                                        isInProg && styles.statusInProgress,
                                        isServiceDone && { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' },
                                        isPaid && { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
                                        isDone && styles.statusCompleted,
                                        isCancel && styles.statusCancelled,
                                      ]}
                                    >
                                      <BootstrapIcon
                                        name={
                                          isPending
                                            ? 'hourglass-split'
                                            : isConfirmed
                                            ? 'clock-fill'
                                            : isInspection
                                            ? 'search'
                                            : isInProg
                                            ? 'gear-wide-connected'
                                            : isServiceDone
                                            ? 'receipt'
                                            : isPaid
                                            ? 'cash-stack'
                                            : isDone
                                            ? 'check-circle-fill'
                                            : 'x-circle-fill'
                                        }
                                        size={10}
                                        color={
                                          isPending
                                            ? '#D97706'
                                            : isConfirmed
                                            ? '#1D4ED8'
                                            : isInspection
                                            ? '#7C3AED'
                                            : isInProg
                                            ? '#B45309'
                                            : isServiceDone
                                            ? '#0284C7'
                                            : isPaid
                                            ? '#059669'
                                            : isDone
                                            ? '#059669'
                                            : '#DC2626'
                                        }
                                      />
                                      <Text
                                        style={[
                                          { fontSize: 10.5, fontWeight: '800' },
                                          isPending && { color: '#D97706' },
                                          isConfirmed && styles.statusConfirmedText,
                                          isInspection && { color: '#7C3AED' },
                                          isInProg && styles.statusInProgressText,
                                          isServiceDone && { color: '#0284C7' },
                                          isPaid && { color: '#059669' },
                                          isDone && styles.statusCompletedText,
                                          isCancel && styles.statusCancelledText,
                                        ]}
                                      >
                                        {statusLabel(b.status || 'Pending')}
                                      </Text>
                                    </View>
                                    <Text style={{ fontSize: 10.5, color: '#64748B', marginTop: 4, fontWeight: '600' }}>
                                      {payStat}
                                    </Text>
                                  </View>

                                  {/* 7. Action Button: Manage Full Details & Delete */}
                                  <View
                                    style={{
                                      flex: 1.3,
                                      minWidth: 120,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <TouchableOpacity
                                      style={[
                                        styles.btnViewOrder,
                                        {
                                          backgroundColor: '#1D4533',
                                          borderColor: '#1D4533',
                                          paddingHorizontal: 12,
                                          paddingVertical: 6,
                                          borderRadius: 8,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 5,
                                        },
                                      ]}
                                      onPress={() => handleOpenBookingModal(b)}
                                      activeOpacity={0.8}
                                      title="Manage & View Full Details"
                                    >
                                      <BootstrapIcon name="pencil-square" size={12} color="#FFFFFF" />
                                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>Manage</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                      style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                      onPress={() => handleDeleteBooking(b.booking_id || b.id)}
                                      activeOpacity={0.8}
                                      title="Delete Appointment"
                                    >
                                      <BootstrapIcon name="trash" size={12} color="#DC2626" />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })
                          )}
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
                              borderTopColor: isDarkMode ? '#334155' : '#E2E8F0',
                            }}
                          >
                            <Text style={{ fontSize: 12, color: '#64748B' }}>
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
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>
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

                {/* ── SUB-VIEW B: SERVICE PACKAGES CATALOG ── */}
                {garageSubTab === 'services' && (
                  <View>
                    <View style={styles.toolbarRow}>
                      <View style={styles.searchInputBox}>
                        <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search service catalog by title or category..."
                          placeholderTextColor="#94A3B8"
                          value={garageSearchQuery}
                          onChangeText={setGarageSearchQuery}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.addBtnPrimary}
                        onPress={() => {
                          setEditingGarageService(null);
                          setServTitle('');
                          setServSubtitle('');
                          setServCategory('PMS');
                          setServPrice('3750');
                          setServDuration('60 mins');
                          setServBadge('Popular');
                          setServImage(
                            'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80'
                          );
                          setServDesc('');
                          setServInclusions('');
                          setIsAddGarageOpen(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                        <Text style={styles.addBtnPrimaryText}>+ Add Service Package</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.tableCard}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={true}
                        contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                      >
                        <View style={{ width: '100%', minWidth: 840, flexGrow: 1 }}>
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, { flex: 2.5, minWidth: 200 }]}>Service Package</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 100 }]}>Category</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 100, textAlign: 'right' }]}>
                              Price (₱)
                            </Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 90, textAlign: 'center' }]}>
                              Duration
                            </Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 90, textAlign: 'center' }]}>
                              Actions
                            </Text>
                          </View>

                          {garageServices
                            .filter(
                              (srv) =>
                                !garageSearchQuery ||
                                srv.title?.toLowerCase().includes(garageSearchQuery.toLowerCase()) ||
                                srv.category?.toLowerCase().includes(garageSearchQuery.toLowerCase())
                            )
                            .map((srv) => (
                              <View key={srv.id} style={styles.tableRow}>
                                <View style={{ flex: 2.5, minWidth: 200, flexDirection: 'row', alignItems: 'center' }}>
                                  <Image source={{ uri: srv.image }} style={styles.productThumb} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.tableTitle}>{srv.title}</Text>
                                    <Text style={styles.tableSub}>{srv.subtitle || srv.badge}</Text>
                                  </View>
                                </View>
                                <Text
                                  style={[styles.tableSub, { flex: 1.2, minWidth: 100, color: '#0F172A', fontWeight: '700' }]}
                                >
                                  {srv.category}
                                </Text>
                                <Text
                                  style={[styles.tableTitle, { flex: 1.2, minWidth: 100, textAlign: 'right', color: '#1D4533' }]}
                                >
                                  ₱{(srv.pricePhp || usdToPhp(srv.price) || 0).toLocaleString()}
                                </Text>
                                <Text style={[styles.tableSub, { flex: 1.2, minWidth: 90, textAlign: 'center' }]}>
                                  {srv.duration || '60 mins'}
                                </Text>
                                <View
                                  style={{ flex: 1.2, minWidth: 90, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                                >
                                  <TouchableOpacity
                                    style={[styles.actionIconBtn, styles.actionIconBtnEdit]}
                                    onPress={() => {
                                      setEditingGarageService(srv);
                                      setServTitle(srv.title);
                                      setServCategory(srv.category);
                                      setServSubtitle(srv.subtitle || '');
                                      setServPrice(String(srv.pricePhp || usdToPhp(srv.price) || 0));
                                      setServDuration(srv.duration || '60 mins');
                                      setServBadge(srv.badge || 'Popular');
                                      setServImage(srv.image);
                                      setServDesc(srv.description || '');
                                      setServInclusions(
                                        Array.isArray(srv.inclusions)
                                          ? srv.inclusions.join('\n')
                                          : srv.inclusions || ''
                                      );
                                      setIsAddGarageOpen(true);
                                    }}
                                  >
                                    <BootstrapIcon name="pencil-square" size={17} color="#2563EB" />
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                    onPress={() => handleDeleteGarageService(srv.id, srv.title)}
                                  >
                                    <BootstrapIcon name="trash3" size={17} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ─── TAB: CERTIFIED MECHANICS & PIT CREW ─── */}
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
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="On-Duty & Available"
                    value={mechanicsStats.available}
                    valueColor="#1D4533"
                    sub="Ready for Bay Assignment"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={mechanicsStats.busy > 0 ? 'amber' : 'teal'}
                    label="In Pit Bay (Servicing)"
                    value={mechanicsStats.busy}
                    valueColor={mechanicsStats.busy > 0 ? '#D97706' : undefined}
                    sub="Active Work Orders"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Master Techs"
                    value={mechanicsStats.masterCertified}
                    sub="OEM & Race Certified"
                  />
                </View>

                {/* Toolbar & Filter Bar */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon
                      name="search"
                      size={14}
                      color="#64748B"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search technician by name, specialization, or certification..."
                      placeholderTextColor="#94A3B8"
                      value={mechanicSearchQuery}
                      onChangeText={setMechanicSearchQuery}
                    />
                    {mechanicSearchQuery ? (
                      <TouchableOpacity onPress={() => setMechanicSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
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
                        { id: 'All', label: 'All Technicians', count: mechanicsStats.total, icon: 'people-fill', color: '#1D4533' },
                        { id: 'Available', label: 'Available on Duty', count: mechanicsStats.available, icon: 'check-circle-fill', color: '#16A34A' },
                        { id: 'In Pit Bay', label: 'Busy in Pit Bay', count: mechanicsStats.busy, icon: 'tools', color: '#D97706' },
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
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isMechanicFilterDropdownOpen
                                ? '#1D4533'
                                : mechanicFilterStatus !== 'All'
                                  ? '#1D4533'
                                  : isDarkMode ? '#334155' : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 195,
                              cursor: 'pointer',
                              boxShadow: isMechanicFilterDropdownOpen
                                ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                                  color: mechanicFilterStatus !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: mechanicFilterStatus !== 'All' ? '#1D4533' : isDarkMode ? '#334155' : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  marginLeft: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
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
                              color={isMechanicFilterDropdownOpen ? '#1D4533' : '#64748B'}
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
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                        color={isSelected ? '#1D4533' : option.color || '#64748B'}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '800' : '600',
                                          color: isSelected
                                            ? '#1D4533'
                                            : isDarkMode ? '#E2E8F0' : '#334155',
                                        }}
                                      >
                                        {option.label}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View
                                        style={{
                                          backgroundColor: isSelected
                                            ? '#1D4533'
                                            : isDarkMode ? '#334155' : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '800',
                                            color: isSelected ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
                                          }}
                                        >
                                          {option.count}
                                        </Text>
                                      </View>
                                      {isSelected && <BootstrapIcon name="check2" size={14} color="#1D4533" />}
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
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                        backgroundColor: mechanicViewMode === 'list' ? '#1D4533' : 'transparent',
                      }}
                      onPress={() => setMechanicViewMode('list')}
                    >
                      <BootstrapIcon
                        name="list-ul"
                        size={13}
                        color={mechanicViewMode === 'list' ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: mechanicViewMode === 'list' ? '#FFFFFF' : '#64748B',
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
                        backgroundColor: mechanicViewMode === 'grid' ? '#1D4533' : 'transparent',
                      }}
                      onPress={() => setMechanicViewMode('grid')}
                    >
                      <BootstrapIcon
                        name="grid"
                        size={12}
                        color={mechanicViewMode === 'grid' ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: mechanicViewMode === 'grid' ? '#FFFFFF' : '#64748B',
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
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderRadius: 14,
                      padding: 36,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="person-x" size={40} color="#94A3B8" />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: isDarkMode ? '#F1F5F9' : '#0F172A',
                        marginTop: 12,
                      }}
                    >
                      No technicians found
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: '#64748B',
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
                      showsHorizontalScrollIndicator={true}
                      contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                    >
                      <View style={{ width: '100%', minWidth: 960, flexGrow: 1 }}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { flex: 2.3, minWidth: 200 }]}>Technician / Profile</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 120 }]}>Status</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 2.2, minWidth: 170 }]}>Specialization & Experience</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 2, minWidth: 140 }]}>Certifications</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.6, minWidth: 160, textAlign: 'center' }]}>Actions</Text>
                        </View>

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
                                    borderColor: '#1D4533',
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
                              <View style={{ flex: 1.2, minWidth: 120 }}>
                                <View
                                  style={[
                                    styles.mechanicStatusBadge,
                                    isBusy ? styles.mechanicStatusBusy : styles.mechanicStatusAvailable,
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
                                {activeJob && (
                                  <Text
                                    style={{ fontSize: 10, color: '#B45309', fontWeight: '700', marginTop: 3 }}
                                    numberOfLines={1}
                                  >
                                    Job #{activeJob.id || activeJob.booking_id}
                                  </Text>
                                )}
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
                                <BootstrapIcon name="award-fill" size={13} color="#8B5CF6" />
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
                                  flex: 1.6,
                                  minWidth: 160,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  flexShrink: 0,
                                }}
                              >
                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                                  }}
                                  onPress={() => handleOpenEditMechanic(mech)}
                                >
                                  <BootstrapIcon
                                    name="pencil-square"
                                    size={12}
                                    color={isDarkMode ? '#94A3B8' : '#475569'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDarkMode ? '#E2E8F0' : '#475569',
                                    }}
                                  >
                                    Edit
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#FCA5A5',
                                    backgroundColor: '#FEF2F2',
                                  }}
                                  onPress={() => handleDeleteMechanic(mech)}
                                >
                                  <BootstrapIcon name="trash3-fill" size={12} color="#DC2626" />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                                    Remove
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
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
                              color="#F59E0B"
                            />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {mech.specialization || 'Performance Maintenance'}
                            </Text>
                          </View>

                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="award-fill" size={12} color="#8B5CF6" />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {mech.certifications || 'Certified Master Tech'}
                            </Text>
                          </View>

                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="clock-history" size={12} color="#3B82F6" />
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
                                    fontWeight: '800',
                                    color: '#B45309',
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
                                borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                              }}
                              onPress={() => handleOpenEditMechanic(mech)}
                            >
                              <BootstrapIcon
                                name="pencil-square"
                                size={12}
                                color={isDarkMode ? '#94A3B8' : '#475569'}
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
                                borderColor: '#FCA5A5',
                                backgroundColor: '#FEF2F2',
                              }}
                              onPress={() => handleDeleteMechanic(mech)}
                            >
                              <BootstrapIcon name="trash3-fill" size={12} color="#DC2626" />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#DC2626' }}>
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
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="Available on Duty"
                    value={riderStats.available}
                    valueColor="#10B981"
                    sub="Ready for dispatch"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={riderStats.onDelivery > 0 ? 'amber' : 'teal'}
                    label="On Delivery"
                    value={riderStats.onDelivery}
                    valueColor={riderStats.onDelivery > 0 ? '#D97706' : undefined}
                    sub="Currently fulfilling orders"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    label="Total Fleet Earnings"
                    value={`₱${riderStats.totalEarnings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    valueColor="#1D4533"
                    sub="Shipping fee revenue pool"
                  />
                </View>

                {/* 2. Toolbar: Search Input + Add Rider Button */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search rider by name, phone, email, vehicle, or plate..."
                      placeholderTextColor="#94A3B8"
                      value={riderSearchQuery}
                      onChangeText={setRiderSearchQuery}
                    />
                    {riderSearchQuery ? (
                      <TouchableOpacity onPress={() => setRiderSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
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
                        { id: 'All', label: 'All Riders', count: riderStats.total, icon: 'people-fill', color: '#1D4533' },
                        { id: RIDER_ACCOUNT_STATUSES.ACTIVE, label: 'Active Fleet', count: riderStats.active, icon: 'shield-check', color: '#10B981' },
                        { id: RIDER_ACCOUNT_STATUSES.INACTIVE, label: 'Inactive Riders', count: riderStats.inactive, icon: 'shield-slash', color: '#64748B' },
                        { id: RIDER_STATUSES.AVAILABLE, label: 'Available on Duty', count: riderStats.available, icon: 'check-circle-fill', color: '#16A34A' },
                        { id: RIDER_STATUSES.ON_DELIVERY, label: 'On Delivery', count: riderStats.onDelivery, icon: 'box-seam-fill', color: '#D97706' },
                        { id: RIDER_STATUSES.OFF_DUTY, label: 'Off Duty', count: riderStats.offDuty, icon: 'moon-fill', color: '#64748B' },
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
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isRiderFilterDropdownOpen
                                ? '#1D4533'
                                : riderFilterStatus !== 'All'
                                  ? '#1D4533'
                                  : isDarkMode ? '#334155' : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 210,
                              cursor: 'pointer',
                              boxShadow: isRiderFilterDropdownOpen
                                ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                                  color: riderFilterStatus !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                                }}
                              >
                                {activeOpt.label}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: riderFilterStatus !== 'All' ? '#1D4533' : isDarkMode ? '#334155' : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
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
                              color={isRiderFilterDropdownOpen ? '#1D4533' : '#64748B'}
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
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                        color={isSelected ? '#1D4533' : option.color || '#64748B'}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '800' : '600',
                                          color: isSelected
                                            ? '#1D4533'
                                            : isDarkMode ? '#E2E8F0' : '#334155',
                                        }}
                                      >
                                        {option.label}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View
                                        style={{
                                          backgroundColor: isSelected
                                            ? '#1D4533'
                                            : isDarkMode ? '#334155' : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '800',
                                            color: isSelected ? '#FFFFFF' : isDarkMode ? '#CBD5E1' : '#475569',
                                          }}
                                        >
                                          {option.count}
                                        </Text>
                                      </View>
                                      {isSelected && <BootstrapIcon name="check2" size={14} color="#1D4533" />}
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
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                        backgroundColor: riderViewMode === 'list' ? '#1D4533' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onPress={() => setRiderViewMode('list')}
                    >
                      <BootstrapIcon
                        name="list-ul"
                        size={13}
                        color={riderViewMode === 'list' ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: riderViewMode === 'list' ? '#FFFFFF' : '#64748B',
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
                        backgroundColor: riderViewMode === 'grid' ? '#1D4533' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onPress={() => setRiderViewMode('grid')}
                    >
                      <BootstrapIcon
                        name="grid"
                        size={12}
                        color={riderViewMode === 'grid' ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: riderViewMode === 'grid' ? '#FFFFFF' : '#64748B',
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
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="bicycle" size={32} color="#94A3B8" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F1F5F9' : '#0F172A', marginTop: 10 }}>
                      No riders found
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4, marginBottom: 16 }}>
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
                    showsHorizontalScrollIndicator={true}
                    style={{ width: '100%' }}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={[styles.tableCard, { width: '100%', minWidth: '100%', flexGrow: 1 }]}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 2.5, minWidth: 220 }]}>Rider & Account</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 180 }]}>Assigned Vehicle & Plate</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 140, textAlign: 'center' }]}>Duty Status</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 110, textAlign: 'center' }]}>Account</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 130, textAlign: 'right' }]}>Total Earnings</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, minWidth: 140, textAlign: 'center' }]}>Actions</Text>
                      </View>

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
                            {/* Column 1: Rider Profile & Contact */}
                            <View style={{ flex: 2.5, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <View style={{ position: 'relative' }}>
                                <Image
                                  source={{ uri: rider.avatar || RIDER_AVATAR_PRESETS[0] }}
                                  style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    borderWidth: 1.5,
                                    borderColor: '#1D4533',
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[styles.tableTitle, { fontSize: 13.5 }]} numberOfLines={1}>
                                    {rider.name}
                                  </Text>
                                  {rider.username && (
                                    <View
                                      style={{
                                        backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                                        paddingHorizontal: 6,
                                        paddingVertical: 1,
                                        borderRadius: 4,
                                      }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#1D4533' }}>
                                        @{rider.username}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                  <BootstrapIcon name="telephone-fill" size={10} color="#94A3B8" />
                                  <Text style={[styles.tableSub, { fontSize: 11 }]} numberOfLines={1}>
                                    {rider.phone || 'No phone'}
                                  </Text>
                                </View>
                                {rider.email && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                                    <BootstrapIcon name="envelope-fill" size={10} color="#94A3B8" />
                                    <Text style={[styles.tableSub, { fontSize: 11 }]} numberOfLines={1}>
                                      {rider.email}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Column 2: Vehicle & Plate */}
                            <View style={{ flex: 2.0, minWidth: 180 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <View
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <BootstrapIcon name="bicycle" size={12} color="#1D4533" />
                                </View>
                                <Text style={[styles.tableTitle, { fontSize: 13 }]} numberOfLines={1}>
                                  {rider.vehicleInfo || 'No vehicle assigned'}
                                </Text>
                              </View>
                              <View
                                style={{
                                  alignSelf: 'flex-start',
                                  backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                  borderWidth: 1,
                                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: '800',
                                    fontFamily: 'monospace',
                                    color: isDarkMode ? '#CBD5E1' : '#475569',
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {rider.plateNumber || 'NO PLATE'}
                                </Text>
                              </View>
                            </View>

                            {/* Column 3: Duty Status (Interactive Toggle) */}
                            <View style={{ flex: 1.5, minWidth: 140, alignItems: 'center' }}>
                              <TouchableOpacity
                                onPress={() => handleToggleRiderStatus(rider)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 999,
                                  backgroundColor: statusColor.bg,
                                  borderWidth: 1,
                                  borderColor: statusColor.border,
                                  cursor: 'pointer',
                                }}
                                activeOpacity={0.8}
                              >
                                <BootstrapIcon name={statusColor.icon} size={11} color={statusColor.text} />
                                <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor.text }}>
                                  {rider.status || RIDER_STATUSES.AVAILABLE}
                                </Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 3 }}>Tap to toggle</Text>
                            </View>

                            {/* Column 4: Account Status */}
                            <View style={{ flex: 1.2, minWidth: 110, alignItems: 'center' }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                  paddingHorizontal: 9,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                  backgroundColor: isInactive ? '#F1F5F9' : '#ECFDF5',
                                  borderWidth: 1,
                                  borderColor: isInactive ? '#CBD5E1' : '#A7F3D0',
                                }}
                              >
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: isInactive ? '#94A3B8' : '#10B981',
                                  }}
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
                                    color: isInactive ? '#64748B' : '#047857',
                                  }}
                                >
                                  {rider.accountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE}
                                </Text>
                              </View>
                            </View>

                            {/* Column 5: Total Earnings */}
                            <View style={{ flex: 1.5, minWidth: 130, alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 14, fontWeight: '900', color: '#1D4533' }}>
                                ₱{Number(rider.totalEarnings || 0).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#94A3B8' }}>from shipping</Text>
                            </View>

                            {/* Column 6: Action Buttons */}
                            <View style={{ flex: 1.5, minWidth: 140, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                              <TouchableOpacity
                                style={[
                                  styles.actionIconBtn,
                                  { backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5', borderColor: '#A7F3D0' },
                                ]}
                                onPress={() =>
                                  setRiderAccessModal({
                                    rider,
                                    bundle: null,
                                  })
                                }
                              >
                                <BootstrapIcon name="geo-alt-fill" size={13} color="#1D4533" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.actionIconBtn, styles.actionIconBtnEdit]}
                                onPress={() => handleOpenEditRider(rider)}
                              >
                                <BootstrapIcon name="pencil-square" size={16} color="#2563EB" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                onPress={() => handleDeleteRider(rider)}
                              >
                                <BootstrapIcon name="trash3" size={16} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                ) : (
                  /* ─── GRID (CARD) VIEW ─── */
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                    {filteredRiders.map((rider) => {
                      const statusColor =
                        rider.status === RIDER_STATUSES.AVAILABLE
                          ? { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC', dot: '#10B981', icon: 'check-circle-fill' }
                          : rider.status === RIDER_STATUSES.ON_DELIVERY
                            ? { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D', dot: '#F59E0B', icon: 'box-seam-fill' }
                            : { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', dot: '#94A3B8', icon: 'moon-fill' };

                      const isInactive = (rider.accountStatus || 'Active') === RIDER_ACCOUNT_STATUSES.INACTIVE;

                      return (
                        <View key={rider.id} style={[styles.mechanicCard, { flex: 1, minWidth: 300, maxWidth: 420 }]}>
                          {/* Card Header */}
                          <View style={styles.mechanicCardHeader}>
                            <View style={{ position: 'relative' }}>
                              <Image
                                source={{ uri: rider.avatar || RIDER_AVATAR_PRESETS[0] }}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 22,
                                  borderWidth: 2,
                                  borderColor: '#1D4533',
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
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <Text style={styles.mechanicName} numberOfLines={1}>
                                  {rider.name}
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 999,
                                    backgroundColor: isInactive ? '#F1F5F9' : '#ECFDF5',
                                    borderWidth: 1,
                                    borderColor: isInactive ? '#CBD5E1' : '#A7F3D0',
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 5,
                                      height: 5,
                                      borderRadius: 2.5,
                                      backgroundColor: isInactive ? '#94A3B8' : '#10B981',
                                    }}
                                  />
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: isInactive ? '#64748B' : '#047857' }}>
                                    {rider.accountStatus || RIDER_ACCOUNT_STATUSES.ACTIVE}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.mechanicShortName}>
                                {rider.username ? `@${rider.username}` : 'No login'} {rider.shortName ? `• ${rider.shortName}` : ''}
                              </Text>
                            </View>
                          </View>

                          {/* Vehicle Banner */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              marginBottom: 12,
                              borderWidth: 1,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <BootstrapIcon name="bicycle" size={13} color="#1D4533" />
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#F1F5F9' : '#0F172A' }} numberOfLines={1}>
                                {rider.vehicleInfo || 'No vehicle assigned'}
                              </Text>
                            </View>
                            <View
                              style={{
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 4,
                                borderWidth: 1,
                                borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                              }}
                            >
                              <Text style={{ fontSize: 10.5, fontWeight: '800', fontFamily: 'monospace', color: isDarkMode ? '#CBD5E1' : '#475569' }}>
                                {rider.plateNumber || 'NO PLATE'}
                              </Text>
                            </View>
                          </View>

                          {/* Contact Details */}
                          <View style={{ gap: 6, marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <BootstrapIcon name="telephone-fill" size={11} color="#94A3B8" />
                              <Text style={{ fontSize: 11.5, color: isDarkMode ? '#CBD5E1' : '#475569' }}>
                                {rider.phone || 'No phone registered'}
                              </Text>
                            </View>
                            {rider.email && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                <BootstrapIcon name="envelope-fill" size={11} color="#94A3B8" />
                                <Text style={{ fontSize: 11.5, color: isDarkMode ? '#CBD5E1' : '#475569' }} numberOfLines={1}>
                                  {rider.email}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Earnings & Duty Status Strip */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                              marginBottom: 14,
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                            }}
                          >
                            <View>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>
                                Fleet Earnings
                              </Text>
                              <Text style={{ fontSize: 15, fontWeight: '900', color: '#1D4533' }}>
                                ₱{Number(rider.totalEarnings || 0).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => handleToggleRiderStatus(rider)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: statusColor.bg,
                                borderWidth: 1,
                                borderColor: statusColor.border,
                                cursor: 'pointer',
                              }}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name={statusColor.icon} size={11} color={statusColor.text} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor.text }}>
                                {rider.status || RIDER_STATUSES.AVAILABLE}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Card Footer: Action Buttons */}
                          <View style={styles.mechanicCardFooter}>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: '#A7F3D0',
                                backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5',
                                cursor: 'pointer',
                              }}
                              onPress={() =>
                                setRiderAccessModal({
                                  rider,
                                  bundle: null,
                                })
                              }
                            >
                              <BootstrapIcon name="geo-alt-fill" size={11} color="#1D4533" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4533' }}>
                                Live Map
                              </Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                style={[styles.actionIconBtn, styles.actionIconBtnEdit]}
                                onPress={() => handleOpenEditRider(rider)}
                              >
                                <BootstrapIcon name="pencil-square" size={15} color="#2563EB" />
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                                onPress={() => handleDeleteRider(rider)}
                              >
                                <BootstrapIcon name="trash3" size={15} color="#EF4444" />
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
                        backgroundColor: '#10B981',
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
                      backgroundColor: isDarkMode ? '#134E48' : '#CCFBF1',
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
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    label="Active Sourcing"
                    value={supplierStats.active}
                    valueColor="#1D4533"
                    sub="Fulfilling Purchase Orders"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={supplierStats.pending > 0 ? 'amber' : 'teal'}
                    label="Pending Review"
                    value={supplierStats.pending}
                    valueColor={supplierStats.pending > 0 ? '#D97706' : undefined}
                    sub="Onboarding Contracts"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    label="Top Rated Partners"
                    value={supplierStats.topRated}
                    sub="4.8+ Quality Score"
                  />
                </View>

                {/* Toolbar & Search Bar */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon
                      name="search"
                      size={14}
                      color="#64748B"
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search supplier by company, contact person, category, address..."
                      placeholderTextColor="#94A3B8"
                      value={supplierSearchQuery}
                      onChangeText={setSupplierSearchQuery}
                    />
                    {supplierSearchQuery ? (
                      <TouchableOpacity onPress={() => setSupplierSearchQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.addBtnPrimary}
                    onPress={handleOpenAddSupplier}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="plus-lg" size={15} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>+ Add New Supplier</Text>
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
                        { id: 'All', label: 'All Suppliers', count: supplierStats.total, icon: 'building', color: '#1D4533' },
                        { id: 'Active', label: 'Active Partners', count: supplierStats.active, icon: 'check-circle-fill', color: '#16A34A' },
                        { id: 'Pending', label: 'Pending Review', count: supplierStats.pending, icon: 'hourglass-split', color: '#D97706', highlight: supplierStats.pending > 0 },
                        { id: 'Inactive', label: 'Inactive / On Hold', count: supplierStats.inactive, icon: 'pause-circle-fill', color: '#64748B' },
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
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1.5,
                              borderColor: isSupplierFilterDropdownOpen
                                ? '#1D4533'
                                : activeOpt.highlight
                                  ? '#F59E0B'
                                  : supplierFilterStatus !== 'All'
                                    ? '#1D4533'
                                    : isDarkMode ? '#334155' : '#E2E8F0',
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                              minWidth: 185,
                              cursor: 'pointer',
                              boxShadow: isSupplierFilterDropdownOpen
                                ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
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
                                        ? '#1D4533'
                                        : isDarkMode ? '#F8FAFC' : '#0F172A',
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
                                        ? '#1D4533'
                                        : isDarkMode ? '#334155' : '#E2E8F0',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  marginLeft: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
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
                              color={isSupplierFilterDropdownOpen ? '#1D4533' : '#64748B'}
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
                                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                                        color={isSelected ? '#1D4533' : option.color || '#64748B'}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: isSelected ? '800' : '600',
                                          color: isSelected
                                            ? '#1D4533'
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
                                              ? '#1D4533'
                                              : isDarkMode ? '#334155' : '#E2E8F0',
                                          paddingHorizontal: 6,
                                          paddingVertical: 1,
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '800',
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
                                      {isSelected && <BootstrapIcon name="check2" size={14} color="#1D4533" />}
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
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                        backgroundColor: supplierViewMode === 'list' ? '#1D4533' : 'transparent',
                      }}
                      onPress={() => setSupplierViewMode('list')}
                    >
                      <BootstrapIcon
                        name="list-ul"
                        size={13}
                        color={supplierViewMode === 'list' ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: supplierViewMode === 'list' ? '#FFFFFF' : '#64748B',
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
                        backgroundColor: supplierViewMode === 'grid' ? '#1D4533' : 'transparent',
                      }}
                      onPress={() => setSupplierViewMode('grid')}
                    >
                      <BootstrapIcon
                        name="grid"
                        size={12}
                        color={supplierViewMode === 'grid' ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: supplierViewMode === 'grid' ? '#FFFFFF' : '#64748B',
                        }}
                      >
                        Grid
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Loading State or Empty State */}
                {isSuppliersLoading ? (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderRadius: 14,
                      padding: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      gap: 12,
                    }}
                  >
                    <ActivityIndicator size="large" color="#1D4533" />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '800',
                        color: isDarkMode ? '#F1F5F9' : '#0F172A',
                      }}
                    >
                      Loading Suppliers from Database...
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#64748B',
                      }}
                    >
                      Querying live records from Supabase public.suppliers table
                    </Text>
                  </View>
                ) : filteredSuppliers.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderRadius: 14,
                      padding: 36,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="truck" size={40} color="#94A3B8" />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: isDarkMode ? '#F1F5F9' : '#0F172A',
                        marginTop: 12,
                      }}
                    >
                      {supplierSearchQuery ? 'No matching suppliers found' : 'No suppliers in database'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: '#64748B',
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
                      <Text style={styles.addBtnPrimaryText}>+ Add New Supplier</Text>
                    </TouchableOpacity>
                  </View>
                ) : supplierViewMode === 'list' ? (
                  /* ─── LIST / TABLE VIEW ─── */
                  <View style={styles.tableCard}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                      contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                    >
                      <View style={{ width: '100%', minWidth: 1040, flexGrow: 1 }}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { flex: 2.4, minWidth: 200 }]}>Supplier & Contact</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 110 }]}>Status</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 150 }]}>Product Categories</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 110 }]}>Lead Time</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 2.2, minWidth: 190 }]}>Contact Info & Address</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1, minWidth: 90 }]}>Rating</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.6, minWidth: 160, textAlign: 'center' }]}>Actions</Text>
                        </View>

                        {filteredSuppliers.map((sup) => {
                          const supId = sup.supplier_id || sup.id;
                          const status = sup.status || 'Active';
                          const isActive = status.toLowerCase() === 'active';
                          const isPending = status.toLowerCase() === 'pending';

                          return (
                            <View key={supId} style={styles.tableRow}>
                              {/* Company / Supplier Profile */}
                              <View style={{ flex: 2.4, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F0FDFA',
                                    borderWidth: 1.5,
                                    borderColor: '#1D4533',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <BootstrapIcon name="building" size={18} color="#1D4533" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.tableTitle, { fontSize: 13.5 }]} numberOfLines={1}>
                                    {sup.name}
                                  </Text>
                                  <Text style={[styles.tableSub, { fontSize: 11 }]}>
                                    Rep: {sup.contact_person || 'Purchasing Rep'} • ID: {supId}
                                  </Text>
                                </View>
                              </View>

                              {/* Status */}
                              <View style={{ flex: 1.1, minWidth: 110 }}>
                                <View
                                  style={[
                                    styles.mechanicStatusBadge,
                                    isActive
                                      ? styles.mechanicStatusAvailable
                                      : isPending
                                        ? styles.mechanicStatusBusy
                                        : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: '#94A3B8' },
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
                                          : { fontSize: 11, fontWeight: '700', color: '#64748B' }
                                    }
                                  >
                                    {status}
                                  </Text>
                                </View>
                              </View>

                              {/* Product Categories */}
                              <View style={{ flex: 1.8, minWidth: 150 }}>
                                <View
                                  style={{
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3.5,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDarkMode ? '#CBD5E1' : '#475569',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {sup.categories || 'Exhaust & Performance'}
                                  </Text>
                                </View>
                              </View>

                              {/* Lead Time */}
                              <View style={{ flex: 1.2, minWidth: 110, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <BootstrapIcon name="clock-history" size={12} color="#64748B" />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: isDarkMode ? '#E2E8F0' : '#334155',
                                  }}
                                >
                                  {sup.lead_time || '3-5 Days'}
                                </Text>
                              </View>

                              {/* Contact Info & Location */}
                              <View style={{ flex: 2.2, minWidth: 190 }}>
                                {sup.email ? (
                                  <Text style={[styles.tableSub, { color: isDarkMode ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                                    ✉ {sup.email}
                                  </Text>
                                ) : null}
                                {sup.phone ? (
                                  <Text style={[styles.tableSub, { fontSize: 11 }]} numberOfLines={1}>
                                    ☎ {sup.phone}
                                  </Text>
                                ) : null}
                                {sup.address ? (
                                  <Text style={[styles.tableSub, { fontSize: 10.5, color: '#94A3B8' }]} numberOfLines={1}>
                                    📍 {sup.address}
                                  </Text>
                                ) : null}
                              </View>

                              {/* Rating */}
                              <View style={{ flex: 1, minWidth: 90, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: '800',
                                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                  }}
                                >
                                  {sup.rating || '5.0'}
                                </Text>
                              </View>

                              {/* Actions */}
                              <View
                                style={{
                                  flex: 1.6,
                                  minWidth: 160,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  flexShrink: 0,
                                }}
                              >
                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                                  }}
                                  onPress={() => handleOpenEditSupplier(sup)}
                                >
                                  <BootstrapIcon
                                    name="pencil-square"
                                    size={12}
                                    color={isDarkMode ? '#94A3B8' : '#475569'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDarkMode ? '#E2E8F0' : '#475569',
                                    }}
                                  >
                                    Edit
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#FCA5A5',
                                    backgroundColor: '#FEF2F2',
                                  }}
                                  onPress={() => handleDeleteSupplier(sup)}
                                >
                                  <BootstrapIcon name="trash3-fill" size={12} color="#DC2626" />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                                    Remove
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
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
                                backgroundColor: isDarkMode ? '#1E293B' : '#F0FDFA',
                                borderWidth: 1.5,
                                borderColor: '#1D4533',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <BootstrapIcon name="truck" size={20} color="#1D4533" />
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
                                        : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', borderColor: '#94A3B8' },
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
                                          : { fontSize: 10.5, fontWeight: '700', color: '#64748B' }
                                    }
                                  >
                                    {status}
                                  </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <BootstrapIcon name="star-fill" size={11} color="#F59E0B" />
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '800',
                                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
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
                                backgroundColor: isDarkMode ? 'rgba(29, 69, 51,0.2)' : '#E8F0EC',
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
                                  color: isDarkMode ? '#5EEAD4' : '#1D4533',
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
                                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              }}
                            >
                              <BootstrapIcon name="clock" size={11} color="#64748B" />
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
                            <BootstrapIcon name="envelope-fill" size={12} color="#1D4533" />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {sup.email || 'No email provided'}
                            </Text>
                          </View>
                          <View style={styles.mechanicInfoRow}>
                            <BootstrapIcon name="telephone-fill" size={12} color="#1D4533" />
                            <Text style={styles.mechanicInfoText} numberOfLines={1}>
                              {sup.phone || 'No phone number'}
                            </Text>
                          </View>
                          {sup.address ? (
                            <View style={styles.mechanicInfoRow}>
                              <BootstrapIcon name="geo-alt-fill" size={12} color="#1D4533" />
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
                                borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                              }}
                              onPress={() => handleOpenEditSupplier(sup)}
                            >
                              <BootstrapIcon
                                name="pencil-square"
                                size={12}
                                color={isDarkMode ? '#94A3B8' : '#475569'}
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
                                borderColor: '#FCA5A5',
                                backgroundColor: '#FEF2F2',
                              }}
                              onPress={() => handleDeleteSupplier(sup)}
                            >
                              <BootstrapIcon name="trash3-fill" size={12} color="#DC2626" />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#DC2626' }}>
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
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search users by name, email or phone..."
                      placeholderTextColor="#94A3B8"
                      value={userSearchQuery}
                      onChangeText={setUserSearchQuery}
                    />
                  </View>
                </View>

                <View style={styles.tableCard}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
                  >
                    <View style={{ width: '100%', minWidth: 880, flexGrow: 1 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 2.2, minWidth: 170 }]}>User Profile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 160 }]}>Email</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 90 }]}>Role</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 90 }]}>Status</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2, minWidth: 100, textAlign: 'center' }]}>
                          Account State
                        </Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 90, textAlign: 'center' }]}>
                          Privilege
                        </Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8, minWidth: 70, textAlign: 'center' }]}>Delete</Text>
                      </View>

                      {usersList
                        .filter(
                          (u) =>
                            !userSearchQuery ||
                            u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                        .map((u) => {
                          const isDisabled = u.status === 'disabled';
                          const isSelf = u.id === currentUser?.id;
                          return (
                            <View
                              key={u.id}
                              style={[
                                styles.tableRow,
                                isDisabled && { opacity: 0.65, backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC' },
                              ]}
                            >
                              {/* Profile Name & Initial */}
                              <View style={{ flex: 2.2, minWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 17,
                                    backgroundColor: u.role === 'admin' ? '#1D4533' : '#3B82F6',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>
                                    {(u.name || 'U').charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.tableTitle} numberOfLines={1}>
                                    {u.name || 'Anonymous User'}
                                  </Text>
                                  {isSelf && (
                                    <Text style={{ fontSize: 10.5, color: '#1D4533', fontWeight: '800' }}>
                                      (You - Logged In)
                                    </Text>
                                  )}
                                </View>
                              </View>

                              {/* Email */}
                              <Text
                                style={[styles.tableSub, { flex: 1.8, minWidth: 160, color: tokens.textPrimary, fontWeight: '600' }]}
                                numberOfLines={1}
                              >
                                {u.email || 'No email provided'}
                              </Text>

                              {/* Role Badge */}
                              <View style={{ flex: 1.1, minWidth: 90 }}>
                                <View
                                  style={{
                                    backgroundColor: u.role === 'admin' ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F0FDFA') : (isDarkMode ? '#1C2422' : '#F1F5F9'),
                                    borderColor: u.role === 'admin' ? (isDarkMode ? 'rgba(29, 69, 51, 0.45)' : '#CCFBF1') : tokens.border,
                                    borderWidth: 1,
                                    paddingHorizontal: 7,
                                    paddingVertical: 3.5,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: u.role === 'admin' ? (isDarkMode ? '#34D399' : '#143325') : (isDarkMode ? '#CBD5E1' : '#475569'),
                                      fontSize: 11,
                                      fontWeight: '800',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {u.role || 'customer'}
                                  </Text>
                                </View>
                              </View>

                              {/* Status Badge */}
                              <View style={{ flex: 1.1, minWidth: 90 }}>
                                {isDisabled ? (
                                  <View
                                    style={{
                                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
                                      borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
                                      borderWidth: 1,
                                      paddingHorizontal: 7,
                                      paddingVertical: 3.5,
                                      borderRadius: 6,
                                      alignSelf: 'flex-start',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <BootstrapIcon name="slash-circle-fill" size={11} color={isDarkMode ? '#F87171' : '#DC2626'} />
                                    <Text style={{ color: isDarkMode ? '#F87171' : '#DC2626', fontSize: 10.5, fontWeight: '800' }}>Disabled</Text>
                                  </View>
                                ) : (
                                  <View
                                    style={{
                                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                                      borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
                                      borderWidth: 1,
                                      paddingHorizontal: 7,
                                      paddingVertical: 3.5,
                                      borderRadius: 6,
                                      alignSelf: 'flex-start',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <BootstrapIcon name="check-circle-fill" size={11} color={isDarkMode ? '#34D399' : '#059669'} />
                                    <Text style={{ color: isDarkMode ? '#34D399' : '#059669', fontSize: 10.5, fontWeight: '800' }}>Active</Text>
                                  </View>
                                )}
                              </View>

                              {/* Enable / Disable Button */}
                              <View style={{ flex: 1.2, minWidth: 100, alignItems: 'center' }}>
                                <TouchableOpacity
                                  style={[
                                    styles.actionIconBtn,
                                    isDisabled
                                      ? { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5', borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }
                                      : { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#FECACA', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
                                    isSelf && { opacity: 0.45 },
                                  ]}
                                  onPress={() => handleToggleUserStatus(u.id, u.name, u.status)}
                                  disabled={isSelf}
                                >
                                  <BootstrapIcon name={isDisabled ? 'unlock-fill' : 'slash-circle'} size={11} color={isDisabled ? (isDarkMode ? '#34D399' : '#059669') : (isDarkMode ? '#F87171' : '#DC2626')} />
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDisabled ? (isDarkMode ? '#34D399' : '#059669') : (isDarkMode ? '#F87171' : '#DC2626') }}>
                                    {isDisabled ? 'Enable' : 'Disable'}
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {/* Role Promote / Demote */}
                              <View style={{ flex: 1.1, minWidth: 90, alignItems: 'center' }}>
                                <TouchableOpacity
                                  style={[styles.actionIconBtn, { backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9', borderWidth: 1, borderColor: tokens.border, paddingHorizontal: 8, paddingVertical: 4 }]}
                                  onPress={() => handleToggleUserRole(u.id, u.role)}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#34D399' : '#1D4533' }}>
                                    {u.role === 'admin' ? 'Demote' : 'Promote'}
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {/* Delete Account */}
                              <View style={{ flex: 0.8, minWidth: 70, alignItems: 'center' }}>
                                <TouchableOpacity
                                  style={[styles.actionIconBtn, styles.actionIconBtnDanger, isSelf && { opacity: 0.45 }]}
                                  onPress={() => handleDeleteUser(u.id, u.name)}
                                  disabled={isSelf}
                                >
                                  <BootstrapIcon name="trash3" size={17} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                    </View>
                  </ScrollView>
                </View>
              </View>
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
                        backgroundColor: '#FEF3C7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="database-fill-check" size={20} color="#1D4533" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                      Cloud Database Connection (Supabase)
                    </Text>
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 18, lineHeight: 20 }}>
                    Configure the live PostgreSQL database URL and public anon key for real-time order and
                    product synchronization. Note: Supabase project URLs always end with{' '}
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>.supabase.co</Text>.
                  </Text>

                  <Text style={styles.formLabel}>Supabase Project URL</Text>
                  <TextInput
                    style={styles.formInput}
                    value={supabaseUrl}
                    onChangeText={setSupabaseUrl}
                    placeholder="https://vtbdmurblidtdghaotne.supabase.co"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3, marginBottom: 14 }}>
                    Correct format:{' '}
                    <Text style={{ color: '#1D4533', fontWeight: '600' }}>
                      https://vtbdmurblidtdghaotne.supabase.co
                    </Text>
                  </Text>

                  <Text style={styles.formLabel}>Supabase Public Anon Key</Text>
                  <TextInput
                    style={styles.formInput}
                    value={supabaseKey}
                    onChangeText={setSupabaseKey}
                    placeholder="eyJhbGciOi..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3, marginBottom: 18 }}>
                    Use the client <Text style={{ fontWeight: '600', color: '#0F172A' }}>anon/public</Text>{' '}
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
                        { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#1D4533' },
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
                      <BootstrapIcon name="arrow-counterclockwise" size={14} color="#1D4533" />
                      <Text style={[styles.addBtnPrimaryText, { color: '#1D4533' }]}>
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
              <View>
                {/* ─── 1. Header Card with Actions & Subtab Navigation ─── */}
                <View
                  style={[
                    styles.tableCard,
                    {
                      padding: 24,
                      marginBottom: 20,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                      overflow: 'visible',
                      zIndex: isSettingsDropdownOpen ? 1000 : 10,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#C8DDD3',
                        }}
                      >
                        <BootstrapIcon name="gear-fill" size={22} color="#1D4533" />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 20,
                              fontWeight: '900',
                              color: isDarkMode ? '#F8FAFC' : '#0F172A',
                              letterSpacing: -0.3,
                            }}
                          >
                            System & Platform Settings
                          </Text>
                          <View
                            style={{
                              backgroundColor: isDarkMode ? '#1E293B' : '#E8F0EC',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1D4533' }}>
                              Core Platform
                            </Text>
                          </View>
                        </View>
                        <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 12.5, marginTop: 3 }}>
                          Configure store identity, customer checkout rules, pitstop parameters, and system maintenance.
                        </Text>
                      </View>
                    </View>

                    {/* Header Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={[
                          styles.addBtnPrimary,
                          {
                            backgroundColor: '#1D4533',
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 10,
                            boxShadow: '0 4px 14px rgba(29, 69, 51, 0.28)',
                          },
                        ]}
                        onPress={handleSaveSystemSettings}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="check-lg" size={15} color="#FFFFFF" />
                        <Text style={[styles.addBtnPrimaryText, { fontSize: 13, fontWeight: '800' }]}>
                          {isSavingSettings ? 'Saving...' : 'Save Settings'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.addBtnPrimary,
                          {
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 10,
                          },
                        ]}
                        onPress={handleResetSystemSettings}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon
                          name="arrow-counterclockwise"
                          size={14}
                          color={isDarkMode ? '#F8FAFC' : '#475569'}
                        />
                        <Text
                          style={[
                            styles.addBtnPrimaryText,
                            { color: isDarkMode ? '#F8FAFC' : '#475569', fontSize: 13, fontWeight: '700' },
                          ]}
                        >
                          Reset Defaults
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Clean Divider */}
                  <View
                    style={{
                      height: 1,
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
                      marginVertical: 18,
                    }}
                  />

                  {/* Settings Section Dropdown Selector */}
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon name="sliders" size={15} color="#1D4533" />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isDarkMode ? '#94A3B8' : '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                        }}
                      >
                        Configuration Section
                      </Text>
                    </View>

                    {/* Interactive Dropdown Button Container */}
                    <View
                      style={{
                        position: 'relative',
                        width: isDesktop ? 380 : '100%',
                        zIndex: isSettingsDropdownOpen ? 9999 : 10,
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: isSettingsDropdownOpen ? '#1D4533' : isDarkMode ? '#334155' : '#E2E8F0',
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          cursor: 'pointer',
                          boxShadow: isSettingsDropdownOpen
                            ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
                            : '0 2px 6px rgba(0, 0, 0, 0.04)',
                        }}
                        onPress={() => setIsSettingsDropdownOpen((prev) => !prev)}
                        activeOpacity={0.85}
                      >
                        {(() => {
                          const tabs = [
                            { id: 'general', label: 'Store Identity & Theme', icon: 'shop', desc: 'Branding, colors & fiscal currency' },
                            { id: 'operations', label: 'Fulfillment & Orders', icon: 'box-seam', desc: 'COD limits & delivery thresholds' },
                            { id: 'garage', label: 'Pitstop Garage Rules', icon: 'tools', desc: 'Operating hours & booking capacities' },
                            { id: 'notifications', label: 'Alerts & Telemetry', icon: 'bell', desc: 'Stock alerts & staff dispatch pings' },
                            { id: 'maintenance', label: 'Maintenance & Backup', icon: 'shield-check', desc: 'Database health & data exports' },
                          ];
                          const activeObj = tabs.find((t) => t.id === settingsActiveSubTab) || tabs[0];
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
                                <BootstrapIcon name={activeObj.icon} size={15} color="#1D4533" />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: '800',
                                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                  }}
                                >
                                  {activeObj.label}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 11,
                                    color: isDarkMode ? '#94A3B8' : '#64748B',
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
                            name={isSettingsDropdownOpen ? 'chevron-up' : 'chevron-down'}
                            size={13}
                            color={isDarkMode ? '#94A3B8' : '#475569'}
                          />
                        </View>
                      </TouchableOpacity>

                      {/* Backdrop overlay for outside click */}
                      {isSettingsDropdownOpen && (
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
                          onPress={() => setIsSettingsDropdownOpen(false)}
                          activeOpacity={1}
                        />
                      )}

                      {/* Floating Dropdown Menu */}
                      {isSettingsDropdownOpen && (
                        <View
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 8,
                            width: isDesktop ? 380 : '100%',
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.22)',
                            zIndex: 9999,
                            padding: 6,
                            gap: 4,
                          }}
                        >
                          {[
                            { id: 'general', label: 'Store Identity & Theme', icon: 'shop', desc: 'Branding, colors & fiscal currency' },
                            { id: 'operations', label: 'Fulfillment & Orders', icon: 'box-seam', desc: 'COD limits & delivery thresholds' },
                            { id: 'garage', label: 'Pitstop Garage Rules', icon: 'tools', desc: 'Operating hours & booking capacities' },
                            { id: 'notifications', label: 'Alerts & Telemetry', icon: 'bell', desc: 'Stock alerts & staff dispatch pings' },
                            { id: 'maintenance', label: 'Maintenance & Backup', icon: 'shield-check', desc: 'Database health & data exports' },
                          ].map((tab) => {
                            const isSelected = settingsActiveSubTab === tab.id;
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
                                  setSettingsActiveSubTab(tab.id);
                                  setIsSettingsDropdownOpen(false);
                                }}
                                activeOpacity={0.8}
                              >
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    backgroundColor: isSelected
                                      ? '#1D4533'
                                      : isDarkMode ? '#0F172A' : '#F1F5F9',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <BootstrapIcon
                                    name={tab.icon}
                                    size={15}
                                    color={isSelected ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#64748B'}
                                  />
                                </View>

                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '800' : '600',
                                      color: isSelected
                                        ? isDarkMode ? '#38BDF8' : '#1D4533'
                                        : isDarkMode ? '#F8FAFC' : '#0F172A',
                                    }}
                                  >
                                    {tab.label}
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 11,
                                      color: isDarkMode ? '#94A3B8' : '#64748B',
                                      marginTop: 1,
                                    }}
                                  >
                                    {tab.desc}
                                  </Text>
                                </View>

                                {isSelected && (
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 10,
                                      backgroundColor: '#1D4533',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <BootstrapIcon name="check" size={14} color="#FFFFFF" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* ─── SUBTAB 1: STORE IDENTITY & THEME ─── */}
                {settingsActiveSubTab === 'general' && (
                  <View style={{ gap: 20 }}>
                    {/* SECTION 1 — STORE IDENTITY & BRANDING */}
                    <View
                      style={[
                        styles.tableCard,
                        {
                          padding: 24,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                          gap: 18,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="shop" size={20} color="#1D4533" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '900',
                              color: isDarkMode ? '#F8FAFC' : '#0F172A',
                            }}
                          >
                            Store Identity & Branding
                          </Text>
                          <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Primary details displayed across customer invoices, storefront headers, and email communications.
                          </Text>
                        </View>
                      </View>

                      {/* Store Name & Store Tagline (2 Columns on Desktop) */}
                      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Official Store Name</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <BootstrapIcon name="shop" size={14} color="#94A3B8" />
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              value={setForm.storeName}
                              onChangeText={(val) => handleUpdateSettingField('storeName', val)}
                              placeholder="e.g. MotoTrack Performance & Pitstop Garage"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Store Tagline / Slogan</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <BootstrapIcon name="pencil" size={14} color="#94A3B8" />
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              value={setForm.storeTagline}
                              onChangeText={(val) => handleUpdateSettingField('storeTagline', val)}
                              placeholder="e.g. Premier Performance Motorcycle Parts"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>

                      {/* Store Logo & Branding Asset */}
                      <View>
                        <Text style={styles.formLabel}>Store Logo & Visual Identity Asset</Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                            padding: 12,
                            gap: 14,
                          }}
                        >
                          {setForm.storeLogoUrl ? (
                            <Image
                              source={{ uri: setForm.storeLogoUrl }}
                              style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }}
                              resizeMode="contain"
                            />
                          ) : (
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <BootstrapIcon name="tools" size={18} color="#1D4533" />
                            </View>
                          )}
                          <View style={{ flex: 1, gap: 6 }}>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: '#1D4533',
                                paddingVertical: 7,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                alignSelf: 'flex-start',
                              }}
                              onPress={async () => {
                                const res = await pickImageFromFile();
                                if (res.success && res.uri) {
                                  handleUpdateSettingField('storeLogoUrl', res.uri);
                                  showToast('Store logo asset updated!');
                                }
                              }}
                              activeOpacity={0.85}
                            >
                              <BootstrapIcon name="folder2-open" size={13} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                                Upload Logo Image
                              </Text>
                            </TouchableOpacity>
                            <TextInput
                              style={{
                                fontSize: 11.5,
                                color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                              }}
                              value={setForm.storeLogoUrl || ''}
                              onChangeText={(val) => handleUpdateSettingField('storeLogoUrl', val)}
                              placeholder="Or paste store logo image URL"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* SECTION 2 — CONTACT & HEADQUARTERS */}
                    <View
                      style={[
                        styles.tableCard,
                        {
                          padding: 24,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                          gap: 18,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="pin-map-fill" size={20} color="#1D4533" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '900',
                              color: isDarkMode ? '#F8FAFC' : '#0F172A',
                            }}
                          >
                            Contact & Headquarters
                          </Text>
                          <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Customer support channels, phone hotline, and flagship garage physical location.
                          </Text>
                        </View>
                      </View>

                      {/* Desktop Grid: Email & Phone on Row 1 */}
                      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Support Email Address</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <BootstrapIcon name="envelope-fill" size={14} color="#94A3B8" />
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              value={setForm.contactEmail}
                              onChangeText={(val) => handleUpdateSettingField('contactEmail', val)}
                              placeholder="support@mototrack.ph"
                              placeholderTextColor="#94A3B8"
                              autoCapitalize="none"
                            />
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Hotline / Customer Contact Phone</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <BootstrapIcon name="telephone-fill" size={14} color="#94A3B8" />
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              value={setForm.contactPhone}
                              onChangeText={(val) => handleUpdateSettingField('contactPhone', val)}
                              placeholder="+63 (02) 8876-5432"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>

                      {/* Flagship Address on Row 2 (Full Width) */}
                      <View>
                        <Text style={styles.formLabel}>Store Physical Location / Flagship Address</Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                            paddingHorizontal: 12,
                            height: 42,
                            gap: 10,
                          }}
                        >
                          <BootstrapIcon name="pin-map-fill" size={14} color="#94A3B8" />
                          <TextInput
                            style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                            value={setForm.storeAddress}
                            onChangeText={(val) => handleUpdateSettingField('storeAddress', val)}
                            placeholder="108 Katipunan Ave, Quezon City, Metro Manila, Philippines"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      </View>
                    </View>

                    {/* SECTION 3 — REGIONAL CURRENCY & FISCAL RULES */}
                    <View
                      style={[
                        styles.tableCard,
                        {
                          padding: 24,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                          gap: 18,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="cash-stack" size={20} color="#1D4533" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '900',
                              color: isDarkMode ? '#F8FAFC' : '#0F172A',
                            }}
                          >
                            Regional Currency & Fiscal Rules
                          </Text>
                          <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Default checkout currency symbol, ISO currency code, and nationwide sales tax rates.
                          </Text>
                        </View>
                      </View>

                      {/* 3 Even Columns on Desktop */}
                      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Currency Symbol</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#1D4533' }}>₱</Text>
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              value={setForm.currencySymbol}
                              onChangeText={(val) => handleUpdateSettingField('currencySymbol', val)}
                              placeholder="₱"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Currency Code</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <BootstrapIcon name="globe2" size={14} color="#94A3B8" />
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              value={setForm.currencyCode}
                              onChangeText={(val) => handleUpdateSettingField('currencyCode', val)}
                              placeholder="PHP"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.formLabel}>Default Sales Tax / VAT (%)</Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                              paddingHorizontal: 12,
                              height: 42,
                              gap: 10,
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#64748B' }}>%</Text>
                            <TextInput
                              style={{ flex: 1, fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                              keyboardType="numeric"
                              value={String(setForm.taxRate)}
                              onChangeText={(val) => handleUpdateSettingField('taxRate', Number(val) || 0)}
                              placeholder="12"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* SECTION 4 — CONSOLE THEME & APPEARANCE */}
                    <View
                      style={[
                        styles.tableCard,
                        {
                          padding: 24,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginBottom: 18,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              backgroundColor: isDarkMode ? '#2A2415' : '#FEF3C7',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <BootstrapIcon
                              name={isDarkMode ? 'moon-stars-fill' : 'sun-fill'}
                              size={20}
                              color={isDarkMode ? '#38BDF8' : '#D97706'}
                            />
                          </View>
                          <View>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: '900',
                                color: isDarkMode ? '#F8FAFC' : '#0F172A',
                              }}
                            >
                              Console Theme & Appearance
                            </Text>
                            <Text
                              style={{
                                fontSize: 12.5,
                                color: isDarkMode ? '#94A3B8' : '#64748B',
                                marginTop: 2,
                              }}
                            >
                              Configure the color theme for your Admin workspace. Preferences persist across sessions.
                            </Text>
                          </View>
                        </View>

                        {/* Status Indicator Badge */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 7,
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 16,
                            backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.12)' : '#DCFCE7',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.25)' : '#BBF7D0',
                          }}
                        >
                          <View
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 3.5,
                              backgroundColor: isDarkMode ? '#38BDF8' : '#10B981',
                            }}
                          />
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: '800',
                              color: isDarkMode ? '#38BDF8' : '#15803D',
                            }}
                          >
                            {isDarkMode ? 'Dark Mode Active' : 'Light Mode Active'}
                          </Text>
                        </View>
                      </View>

                      {/* Theme Choice Cards */}
                      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16 }}>
                        {/* Option 1: Light Mode */}
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            padding: 18,
                            borderRadius: 14,
                            backgroundColor: !isDarkMode
                              ? '#F3F7F6'
                              : '#1C2422',
                            borderWidth: 2,
                            borderColor: !isDarkMode ? '#1D4533' : tokens.border,
                            boxShadow: !isDarkMode ? '0 8px 20px -4px rgba(29, 69, 51, 0.15)' : 'none',
                            cursor: 'pointer',
                          }}
                          onPress={() => {
                            if (isDarkMode) toggleDarkMode();
                          }}
                          activeOpacity={0.85}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <BootstrapIcon name="sun-fill" size={17} color="#F59E0B" />
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: '800',
                                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                }}
                              >
                                Light Mode
                              </Text>
                            </View>
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: !isDarkMode ? '#1D4533' : 'transparent',
                                borderWidth: !isDarkMode ? 0 : 2,
                                borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {!isDarkMode && <BootstrapIcon name="check" size={15} color="#FFFFFF" />}
                            </View>
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? '#94A3B8' : '#64748B',
                              lineHeight: 18,
                              marginBottom: 14,
                            }}
                          >
                            Crisp daytime palette with high-contrast slate text and clean white surfaces.
                          </Text>

                          {/* Mini Visual UI Mockup */}
                          <View
                            style={{
                              height: 48,
                              borderRadius: 8,
                              backgroundColor: '#F1F5F9',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              flexDirection: 'row',
                              overflow: 'hidden',
                              padding: 5,
                              gap: 6,
                            }}
                          >
                            <View style={{ width: 34, backgroundColor: '#FFFFFF', borderRadius: 5, padding: 4, gap: 4 }}>
                              <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#1D4533' }} />
                              <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                              <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
                            </View>
                            <View style={{ flex: 1, gap: 4 }}>
                              <View style={{ flexDirection: 'row', gap: 4 }}>
                                <View style={{ flex: 1, height: 14, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }} />
                                <View style={{ flex: 1, height: 14, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }} />
                              </View>
                              <View style={{ height: 14, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }} />
                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* Option 2: Dark Mode */}
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            padding: 18,
                            borderRadius: 14,
                            backgroundColor: isDarkMode
                              ? '#141A18'
                              : '#F8FAFC',
                            borderWidth: 2,
                            borderColor: isDarkMode ? '#10B981' : '#E2E8F0',
                            boxShadow: isDarkMode ? '0 8px 24px -4px rgba(16, 185, 129, 0.25)' : 'none',
                            cursor: 'pointer',
                          }}
                          onPress={() => {
                            if (!isDarkMode) toggleDarkMode();
                          }}
                          activeOpacity={0.85}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <BootstrapIcon name="moon-stars-fill" size={17} color="#34D399" />
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: '800',
                                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                }}
                              >
                                Dark Mode
                              </Text>
                            </View>
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: isDarkMode ? '#10B981' : 'transparent',
                                borderWidth: isDarkMode ? 0 : 2,
                                borderColor: isDarkMode ? '#10B981' : '#CBD5E1',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isDarkMode && <BootstrapIcon name="check" size={15} color="#FFFFFF" />}
                            </View>
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              color: isDarkMode ? '#CBD5E1' : '#64748B',
                              lineHeight: 18,
                              marginBottom: 14,
                            }}
                          >
                            Sleek road-teal charcoal layout tailored for night garage shifts and low-light environments.
                          </Text>

                          {/* Mini Visual UI Mockup */}
                          <View
                            style={{
                              height: 48,
                              borderRadius: 8,
                              backgroundColor: '#0E1311',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.08)',
                              flexDirection: 'row',
                              overflow: 'hidden',
                              padding: 5,
                              gap: 6,
                            }}
                          >
                            <View style={{ width: 34, backgroundColor: '#141A18', borderRadius: 5, padding: 4, gap: 4 }}>
                              <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#10B981' }} />
                              <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />
                              <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />
                            </View>
                            <View style={{ flex: 1, gap: 4 }}>
                              <View style={{ flexDirection: 'row', gap: 4 }}>
                                <View style={{ flex: 1, height: 14, backgroundColor: '#1C2422', borderRadius: 4 }} />
                                <View style={{ flex: 1, height: 14, backgroundColor: '#1C2422', borderRadius: 4 }} />
                              </View>
                              <View style={{ height: 14, backgroundColor: '#1C2422', borderRadius: 4 }} />
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* Subtab 2: Operations & Fulfillment */}
                {settingsActiveSubTab === 'operations' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginBottom: 6 }}>
                      Fulfillment & Checkout Thresholds
                    </Text>
                    <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 20 }}>
                      Set cash on delivery ceilings, free shipping limits, inventory restocking triggers, and checkout flows.
                    </Text>

                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Maximum Cash on Delivery (COD) Limit (₱)</Text>
                        <TextInput
                          style={styles.formInput}
                          keyboardType="numeric"
                          value={String(setForm.maxCodAmount)}
                          onChangeText={(val) => handleUpdateSettingField('maxCodAmount', Number(val) || 0)}
                          placeholder="50000"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                          Orders exceeding this amount require GCash or credit card upfront.
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Free Shipping Order Threshold (₱)</Text>
                        <TextInput
                          style={styles.formInput}
                          keyboardType="numeric"
                          value={String(setForm.freeShippingThreshold)}
                          onChangeText={(val) => handleUpdateSettingField('freeShippingThreshold', Number(val) || 0)}
                          placeholder="3500"
                          placeholderTextColor="#94A3B8"
                        />
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                          Orders over this threshold qualify for free nationwide delivery.
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.formLabel}>Low Stock Alert Threshold (Units remaining)</Text>
                      <TextInput
                        style={[styles.formInput, { maxWidth: isDesktop ? 300 : '100%' }]}
                        keyboardType="numeric"
                        value={String(setForm.lowStockThreshold)}
                        onChangeText={(val) => handleUpdateSettingField('lowStockThreshold', Number(val) || 0)}
                        placeholder="5"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                        Products with stock equal to or below this amount trigger critical restocking notifications.
                      </Text>
                    </View>

                    <View style={{ marginTop: 22, gap: 14 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('autoVerifyCodOrders', !setForm.autoVerifyCodOrders)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Auto-Verify COD Orders
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            When disabled, rider COD orders stay in "Pending" until verified by staff.
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.autoVerifyCodOrders ? '#1D4533' : '#64748B',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.autoVerifyCodOrders ? 'ENABLED' : 'MANUAL'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('allowGuestCheckout', !setForm.allowGuestCheckout)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Allow Guest Visitor Checkout
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Enable riders to purchase parts quickly without mandatory account registration.
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.allowGuestCheckout ? '#1D4533' : '#EF4444',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.allowGuestCheckout ? 'ALLOWED' : 'LOCKED'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Subtab 3: Pitstop Garage Rules */}
                {settingsActiveSubTab === 'garage' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginBottom: 6 }}>
                      Pitstop Garage Operating Rules
                    </Text>
                    <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 20 }}>
                      Control daily service capacity, operating business hours, and automated technician scheduling.
                    </Text>

                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Garage Opening Hours</Text>
                        <TextInput
                          style={styles.formInput}
                          value={setForm.garageOpeningTime}
                          onChangeText={(val) => handleUpdateSettingField('garageOpeningTime', val)}
                          placeholder="08:00 AM"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Garage Closing Hours</Text>
                        <TextInput
                          style={styles.formInput}
                          value={setForm.garageClosingTime}
                          onChangeText={(val) => handleUpdateSettingField('garageClosingTime', val)}
                          placeholder="07:00 PM"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Max Appointments Per Day</Text>
                        <TextInput
                          style={styles.formInput}
                          keyboardType="numeric"
                          value={String(setForm.maxDailyAppointments)}
                          onChangeText={(val) => handleUpdateSettingField('maxDailyAppointments', Number(val) || 0)}
                          placeholder="24"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <View style={{ marginTop: 22, gap: 14 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('allowWeekendBookings', !setForm.allowWeekendBookings)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Accept Saturday & Sunday Bookings
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Enable riders to schedule PMS, ECU flash tuning, and brake repairs on weekends.
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.allowWeekendBookings ? '#1D4533' : '#64748B',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.allowWeekendBookings ? 'ACTIVE' : 'WEEKDAYS ONLY'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('autoAssignMechanic', !setForm.autoAssignMechanic)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Automated Mechanic Roster Allocation
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Automatically assigns certified pit crew based on service specialty (PMS, Diagnostics, Engine, Dyno).
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.autoAssignMechanic ? '#1D4533' : '#64748B',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.autoAssignMechanic ? 'AUTO-ROSTER' : 'MANUAL'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Subtab 4: Alerts & Notifications */}
                {settingsActiveSubTab === 'notifications' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginBottom: 6 }}>
                      Alert Channels & Notification Telemetry
                    </Text>
                    <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 20 }}>
                      Manage audio tones, stock replenishment warnings, and live notifications.
                    </Text>

                    <View style={{ gap: 14 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('enableOrderNotifications', !setForm.enableOrderNotifications)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            New Order Alert Notifications
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Pushes alert banners and badge counter increments whenever a rider submits an order.
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.enableOrderNotifications ? '#1D4533' : '#64748B',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.enableOrderNotifications ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('enableLowStockAlerts', !setForm.enableLowStockAlerts)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Low Inventory Warning Alerts
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Triggers alerts whenever part quantities reach or drop below the threshold ({setForm.lowStockThreshold} units).
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.enableLowStockAlerts ? '#1D4533' : '#64748B',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.enableLowStockAlerts ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        }}
                        onPress={() => handleUpdateSettingField('enableSoundAlerts', !setForm.enableSoundAlerts)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Audio Tones & Sound Effects
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Play gentle chimes on order actions, barcode scans, and admin confirmation prompts.
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: setForm.enableSoundAlerts ? '#1D4533' : '#64748B',
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                            {setForm.enableSoundAlerts ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Subtab 5: Maintenance Mode & Backup */}
                {settingsActiveSubTab === 'maintenance' && (
                  <View style={{ gap: 20 }}>
                    {/* Maintenance Mode Card */}
                    <View style={[styles.tableCard, { padding: 24 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                            Storefront Maintenance Mode
                          </Text>
                          <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                            Temporarily disable live customer ordering while keeping the Admin Console fully accessible.
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 20,
                            backgroundColor: setForm.isMaintenanceMode ? '#DC2626' : '#10B981',
                          }}
                          onPress={() => handleUpdateSettingField('isMaintenanceMode', !setForm.isMaintenanceMode)}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                            {setForm.isMaintenanceMode ? 'MAINTENANCE ON' : 'STORE LIVE'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {setForm.isMaintenanceMode && (
                        <View
                          style={{
                            padding: 14,
                            borderRadius: 12,
                            backgroundColor: '#FEF2F2',
                            borderWidth: 1,
                            borderColor: '#FECACA',
                            marginBottom: 16,
                          }}
                        >
                          <Text style={{ color: '#991B1B', fontWeight: '800', fontSize: 13 }}>
                            ⚠️ Storefront is currently in Maintenance Mode!
                          </Text>
                          <Text style={{ color: '#B91C1C', fontSize: 12, marginTop: 3 }}>
                            Riders will see the custom maintenance banner when visiting the storefront.
                          </Text>
                        </View>
                      )}

                      <Text style={styles.formLabel}>Customer Maintenance Banner Message</Text>
                      <TextInput
                        style={[styles.formInput, { height: 75, textAlignVertical: 'top' }]}
                        multiline
                        value={setForm.maintenanceMessage}
                        onChangeText={(val) => handleUpdateSettingField('maintenanceMessage', val)}
                        placeholder="Notice shown to storefront visitors..."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    {/* Data Backup & System Cache Card */}
                    <View style={[styles.tableCard, { padding: 24 }]}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginBottom: 6 }}>
                        Data Backup & Storage Utilities
                      </Text>
                      <Text style={{ fontSize: 12.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 18 }}>
                        Generate downloadable system configuration snapshots or clear non-critical local caches safely.
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={[styles.addBtnPrimary, { backgroundColor: '#2563EB' }]}
                          onPress={handleExportSystemBackup}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="download" size={14} color="#FFFFFF" />
                          <Text style={styles.addBtnPrimaryText}>Export System Backup (JSON)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.addBtnPrimary,
                            {
                              backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                              borderWidth: 1,
                              borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                            },
                          ]}
                          onPress={handleClearCache}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="trash3" size={14} color={isDarkMode ? '#F8FAFC' : '#475569'} />
                          <Text style={[styles.addBtnPrimaryText, { color: isDarkMode ? '#F8FAFC' : '#475569' }]}>
                            Purge System Cache
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* System Telemetry Specs */}
                      <View
                        style={{
                          marginTop: 22,
                          padding: 16,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? '#132A26' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#1E3A35' : '#E2E8F0',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: isDarkMode ? '#6EE7B7' : '#1D4533', marginBottom: 10 }}>
                          Live System Telemetry & Statistics
                        </Text>
                        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16, flexWrap: 'wrap' }}>
                          <View>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Framework</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                              Expo SDK 57 / React Native
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Database</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>
                              Postgres Supabase (Active)
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Catalog SKUs</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                              {products.length} Products
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Customer Orders</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                              {orders.length} Recorded
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Pitstop Bookings</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                              {garageBookings.length} Appointments
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>Registered Accounts</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                              {usersList.length} Riders & Admins
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ─── TAB 12: AUDIT & GOVERNANCE LOGS ─── */}
            {activeNav === 'audit' && (
              <View>
                {/* ─── 1. Header Card with Actions & Clean Subtitle ─── */}
                <View
                  style={[
                    styles.tableCard,
                    {
                      padding: 22,
                      marginBottom: 18,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'flex-start',
                      justifyContent: 'space-between',
                      gap: 14,
                      paddingBottom: 18,
                      borderBottomWidth: 1,
                      borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="journal-text" size={20} color="#1D4533" />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: '800',
                              color: isDarkMode ? '#F8FAFC' : '#0F172A',
                              letterSpacing: -0.3,
                            }}
                          >
                            Audit Trail
                          </Text>
                          <View
                            style={{
                              backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: '#1D4533',
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
                            color: isDarkMode ? '#94A3B8' : '#64748B',
                            marginTop: 2,
                          }}
                        >
                          Administrative actions, approvals, inventory restocks, and security events
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={[
                          styles.addBtnOutline,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 8,
                            borderColor: '#1D4533',
                            backgroundColor: isDarkMode ? '#132A26' : '#FFFFFF',
                          },
                        ]}
                        onPress={handleExportAuditLogs}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="download" size={13} color="#1D4533" />
                        <Text style={{ color: '#1D4533', fontWeight: '700', fontSize: 12 }}>
                          Export CSV
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
                        }}
                        onPress={handleClearAuditLogs}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="trash3" size={13} color="#DC2626" />
                        <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>
                          Clear Logs
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* ─── 4 Streamlined Summary Metrics ─── */}
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      gap: 12,
                      marginTop: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* 1. Total */}
                    <View
                      style={{
                        flex: 1,
                        minWidth: 160,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                        padding: 14,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="journal-bookmark-fill" size={16} color="#1D4533" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                          {auditLogs.length}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
                          Total Operations
                        </Text>
                      </View>
                    </View>

                    {/* 2. Warnings & Critical */}
                    <View
                      style={{
                        flex: 1,
                        minWidth: 160,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                        padding: 14,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: '#FEF3C7',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="exclamation-triangle-fill" size={16} color="#D97706" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#D97706' }}>
                          {auditLogs.filter((l) => l.severity === 'WARNING' || l.severity === 'CRITICAL').length}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
                          Alerts & Warnings
                        </Text>
                      </View>
                    </View>

                    {/* 3. Orders & Inventory */}
                    <View
                      style={{
                        flex: 1,
                        minWidth: 160,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                        padding: 14,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#1E293B' : '#DBEAFE',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="box-seam-fill" size={16} color="#2563EB" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                          {auditLogs.filter((l) => l.category === 'orders' || l.category === 'inventory').length}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
                          Orders & Inventory
                        </Text>
                      </View>
                    </View>

                    {/* 4. Garage & Security */}
                    <View
                      style={{
                        flex: 1,
                        minWidth: 160,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                        padding: 14,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#132A26' : '#C8DDD3',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="shield-check" size={16} color="#1D4533" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                          {auditLogs.filter((l) => l.category === 'garage' || l.category === 'security' || l.category === 'system').length}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
                          Garage & Security
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* ─── 2. Search & Clean Filter Controls ─── */}
                <View
                  style={{
                    gap: 10,
                    marginBottom: 16,
                    position: 'relative',
                    zIndex: isAuditCategoryDropdownOpen ? 99999 : 10,
                    elevation: isAuditCategoryDropdownOpen ? 99999 : 1,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'stretch',
                      gap: 10,
                      position: 'relative',
                      zIndex: isAuditCategoryDropdownOpen ? 99999 : 10,
                      elevation: isAuditCategoryDropdownOpen ? 99999 : 1,
                    }}
                  >
                    {/* Search Field */}
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                      }}
                    >
                      <BootstrapIcon name="search" size={13} color="#64748B" />
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: isDarkMode ? '#F8FAFC' : '#0F172A',
                          outlineStyle: 'none',
                        }}
                        placeholder="Search logs by action, admin name, target resource, details..."
                        value={auditSearchQuery}
                        onChangeText={setAuditSearchQuery}
                        placeholderTextColor="#94A3B8"
                      />
                      {Boolean(auditSearchQuery) && (
                        <TouchableOpacity onPress={() => setAuditSearchQuery('')}>
                          <BootstrapIcon name="x-circle-fill" size={13} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Audit Category Dropdown Filter */}
                    <View
                      style={{
                        position: 'relative',
                        zIndex: isAuditCategoryDropdownOpen ? 99999 : 10,
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: isAuditCategoryDropdownOpen
                            ? '#1D4533'
                            : auditCategoryFilter !== 'All'
                              ? '#1D4533'
                              : isDarkMode ? '#334155' : '#E2E8F0',
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          minWidth: 160,
                          cursor: 'pointer',
                          boxShadow: isAuditCategoryDropdownOpen
                            ? '0 6px 20px -2px rgba(29, 69, 51, 0.2)'
                            : '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                        onPress={() => setIsAuditCategoryDropdownOpen((prev) => !prev)}
                        activeOpacity={0.85}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon
                            name={
                              AUDIT_CATEGORIES.find((c) => c.id.toLowerCase() === auditCategoryFilter.toLowerCase())?.icon || 'layers'
                            }
                            size={13}
                            color={auditCategoryFilter !== 'All' ? '#1D4533' : '#64748B'}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: auditCategoryFilter !== 'All' ? '#1D4533' : isDarkMode ? '#F8FAFC' : '#0F172A',
                            }}
                          >
                            {AUDIT_CATEGORIES.find((c) => c.id.toLowerCase() === auditCategoryFilter.toLowerCase())?.label || 'All Categories'}
                          </Text>
                        </View>
                        <BootstrapIcon
                          name={isAuditCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={isAuditCategoryDropdownOpen ? '#1D4533' : '#64748B'}
                        />
                      </TouchableOpacity>

                      {/* Transparent backdrop for click-outside dismissal */}
                      {isAuditCategoryDropdownOpen && (
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
                          onPress={() => setIsAuditCategoryDropdownOpen(false)}
                          activeOpacity={1}
                        />
                      )}

                      {/* Floating Dropdown Menu */}
                      {isAuditCategoryDropdownOpen && (
                        <View
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: 6,
                            minWidth: 215,
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                            boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.08)',
                            zIndex: 99999,
                            padding: 6,
                            gap: 3,
                            maxHeight: 320,
                            overflowY: 'auto',
                          }}
                        >
                          {AUDIT_CATEGORIES.map((cat) => {
                            const isSelected = auditCategoryFilter.toLowerCase() === cat.id.toLowerCase();
                            return (
                              <TouchableOpacity
                                key={cat.id}
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
                                  setAuditCategoryFilter(cat.id);
                                  setIsAuditCategoryDropdownOpen(false);
                                }}
                                activeOpacity={0.8}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <BootstrapIcon
                                    name={cat.icon}
                                    size={14}
                                    color={isSelected ? '#1D4533' : '#64748B'}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: isSelected ? '800' : '600',
                                      color: isSelected
                                        ? '#1D4533'
                                        : isDarkMode ? '#E2E8F0' : '#334155',
                                    }}
                                  >
                                    {cat.label}
                                  </Text>
                                </View>
                                {isSelected && (
                                  <BootstrapIcon name="check2" size={14} color="#1D4533" />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    {/* Severity Segmented Filter */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {['All', 'SUCCESS', 'INFO', 'WARNING', 'CRITICAL'].map((sev) => {
                        const active = auditSeverityFilter.toUpperCase() === sev.toUpperCase();
                        const displayLabel = sev === 'All' ? 'All Severities' : sev;
                        return (
                          <TouchableOpacity
                            key={sev}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: active
                                ? '#1D4533'
                                : isDarkMode ? '#1E293B' : '#FFFFFF',
                              borderWidth: 1,
                              borderColor: active
                                ? '#1D4533'
                                : isDarkMode ? '#334155' : '#E2E8F0',
                            }}
                            onPress={() => setAuditSeverityFilter(sev)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: active ? '700' : '600',
                                color: active
                                  ? '#FFFFFF'
                                  : isDarkMode ? '#94A3B8' : '#475569',
                              }}
                            >
                              {displayLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* ─── 3. Audit Logs Feed (Clear, Professional, High Scannability) ─── */}
                <View
                  style={[
                    styles.feedCard,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      borderRadius: 14,
                      position: 'relative',
                      zIndex: 1,
                    },
                  ]}
                >
                  {filteredAuditLogs.length === 0 ? (
                    <View style={styles.emptyState}>
                      <View
                        style={[
                          styles.emptyIconCircle,
                          { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', width: 56, height: 56, borderRadius: 28 },
                        ]}
                      >
                        <BootstrapIcon name="journal-check" size={26} color="#94A3B8" />
                      </View>
                      <Text style={[styles.emptyTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B', fontSize: 15 }]}>
                        No Audit Log Entries
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 12.5 }]}>
                        {auditSearchQuery
                          ? 'No audit entries match your current search.'
                          : 'No recorded actions found for this filter.'}
                      </Text>
                    </View>
                  ) : (
                    filteredAuditLogs.map((log, index) => {
                      const sev = (log.severity || 'INFO').toUpperCase();
                      const sevColor =
                        sev === 'CRITICAL'
                          ? '#DC2626'
                          : sev === 'WARNING'
                            ? '#D97706'
                            : sev === 'SUCCESS'
                              ? '#059669'
                              : '#2563EB';

                      const sevBg =
                        sev === 'CRITICAL'
                          ? isDarkMode ? '#341515' : '#FEE2E2'
                          : sev === 'WARNING'
                            ? isDarkMode ? '#2D2012' : '#FEF3C7'
                            : sev === 'SUCCESS'
                              ? isDarkMode ? '#132A26' : '#D1FAE5'
                              : isDarkMode ? '#1E293B' : '#DBEAFE';

                      // Human-friendly title and icon
                      const getActionPresentation = (action) => {
                        switch (action) {
                          case 'COD_ORDER_APPROVED':
                            return { title: 'Approved COD Order', icon: 'bag-check-fill', color: '#059669', bg: isDarkMode ? '#132A26' : '#D1FAE5' };
                          case 'ORDER_STATUS_CHANGED':
                            return { title: 'Updated Order Status', icon: 'truck', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#DBEAFE' };
                          case 'ORDER_CANCELLED':
                            return { title: 'Cancelled Order', icon: 'x-circle-fill', color: '#DC2626', bg: isDarkMode ? '#341515' : '#FEE2E2' };
                          case 'STOCK_REPLENISHED':
                            return { title: 'Replenished Inventory', icon: 'boxes', color: '#1D4533', bg: isDarkMode ? '#132A26' : '#E8F0EC' };
                          case 'PRICE_OVERRIDE':
                            return { title: 'Price Override', icon: 'tag-fill', color: '#D97706', bg: isDarkMode ? '#2D2012' : '#FEF3C7' };
                          case 'BOOKING_CREATED':
                            return { title: 'Scheduled Pit Bay Service', icon: 'wrench', color: '#1D4533', bg: isDarkMode ? '#132A26' : '#C8DDD3' };
                          case 'BOOKING_STATUS_CHANGED':
                            return { title: 'Updated Bay Status', icon: 'wrench-adjustable', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#DBEAFE' };
                          case 'SERVICE_COMPLETED':
                            return { title: 'Completed Service in Bay', icon: 'check-circle-fill', color: '#059669', bg: isDarkMode ? '#132A26' : '#D1FAE5' };
                          case 'BOOKING_CANCELLED':
                            return { title: 'Cancelled Bay Booking', icon: 'calendar-x-fill', color: '#DC2626', bg: isDarkMode ? '#341515' : '#FEE2E2' };
                          case 'CUSTOMER_REGISTERED':
                            return { title: 'New Customer Registered', icon: 'person-plus-fill', color: '#4F46E5', bg: isDarkMode ? '#1E1B4B' : '#EEF2FF' };
                          case 'STAFF_PERMISSION_CHANGED':
                            return { title: 'Modified Staff Permissions', icon: 'shield-lock-fill', color: '#7C3AED', bg: isDarkMode ? '#281A42' : '#EDE9FE' };
                          case 'SYSTEM_SETTINGS_SAVED':
                            return { title: 'Updated System Settings', icon: 'sliders', color: '#1D4533', bg: isDarkMode ? '#132A26' : '#E8F0EC' };
                          case 'AI_RESTOCK_RECOMMENDED':
                            return { title: 'AI Restock Advice', icon: 'cpu-fill', color: '#7C3AED', bg: isDarkMode ? '#281A42' : '#EDE9FE' };
                          default: {
                            const readable = (action || 'Operation')
                              .replace(/_/g, ' ')
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            return { title: readable, icon: 'journal-check', color: '#1D4533', bg: isDarkMode ? '#132A26' : '#E8F0EC' };
                          }
                        }
                      };

                      const actionMeta = getActionPresentation(log.action);

                      // Relative timestamp
                      const formatTimeAgo = (iso) => {
                        if (!iso) return 'Just now';
                        try {
                          const diff = Date.now() - new Date(iso).getTime();
                          const m = Math.floor(diff / 60000);
                          const h = Math.floor(m / 60);
                          const d = Math.floor(h / 24);
                          if (m < 1) return 'Just now';
                          if (m < 60) return `${m}m ago`;
                          if (h < 24) return `${h}h ago`;
                          if (d === 1) return 'Yesterday';
                          return `${d}d ago`;
                        } catch (_e) {
                          return 'Recent';
                        }
                      };

                      return (
                        <View
                          key={log.id || index}
                          style={{
                            flexDirection: 'row',
                            padding: 16,
                            borderBottomWidth: index === filteredAuditLogs.length - 1 ? 0 : 1,
                            borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
                            gap: 14,
                            alignItems: 'flex-start',
                          }}
                        >
                          {/* Left Action Icon */}
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: actionMeta.bg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 2,
                            }}
                          >
                            <BootstrapIcon name={actionMeta.icon} size={16} color={actionMeta.color} />
                          </View>

                          {/* Content Body */}
                          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                            {/* Header: Action Title + Severity + Category + Time */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 8,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: '700',
                                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                  }}
                                >
                                  {actionMeta.title}
                                </Text>

                                <View
                                  style={{
                                    backgroundColor: sevBg,
                                    paddingHorizontal: 6,
                                    paddingVertical: 1.5,
                                    borderRadius: 5,
                                  }}
                                >
                                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: sevColor }}>
                                    {sev}
                                  </Text>
                                </View>

                                <View
                                  style={{
                                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                                    paddingHorizontal: 6,
                                    paddingVertical: 1.5,
                                    borderRadius: 5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: '700',
                                      color: isDarkMode ? '#94A3B8' : '#64748B',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {log.category}
                                  </Text>
                                </View>
                              </View>

                              <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                {formatTimeAgo(log.timestamp)}
                              </Text>
                            </View>

                            {/* Details sentence */}
                            <Text
                              style={{
                                fontSize: 12.5,
                                color: isDarkMode ? '#CBD5E1' : '#334155',
                                lineHeight: 18,
                              }}
                            >
                              {log.details}
                            </Text>

                            {/* Target & Context Pill */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                                  borderWidth: 1,
                                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B' }}>TARGET:</Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                                  }}
                                >
                                  {log.target}
                                </Text>
                              </View>

                              {/* Operator info inline */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <BootstrapIcon name="person" size={11} color="#94A3B8" />
                                <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                                  {log.admin_name} ({log.admin_role || 'Admin'})
                                </Text>
                              </View>

                              {Boolean(log.ip_address) && (
                                <Text style={{ fontSize: 10.5, color: '#94A3B8' }}>
                                  • IP {log.ip_address}
                                </Text>
                              )}
                            </View>

                            {/* Action inspect trigger */}
                            <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  paddingVertical: 2,
                                }}
                                onPress={() => setSelectedAuditLogForModal(log)}
                                activeOpacity={0.75}
                              >
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1D4533' }}>
                                  Inspect record →
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

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
                backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
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
                borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    backgroundColor: isDarkMode ? '#132A26' : '#E8F0EC',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="journal-text" size={17} color="#1D4533" />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '800',
                      color: isDarkMode ? '#F8FAFC' : '#0F172A',
                    }}
                  >
                    Audit Log Entry
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                    Record: {selectedAuditLogForModal?.id}
                  </Text>
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
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {selectedAuditLogForModal && (
              <ScrollView style={{ maxHeight: 460 }}>
                <View style={{ gap: 12 }}>
                  {/* Action & Status Card */}
                  <View
                    style={{
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      padding: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                        Action Event
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginTop: 2 }}>
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
                            fontWeight: '800',
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
                            color: isDarkMode ? '#94A3B8' : '#475569',
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
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                        Target Resource:
                      </Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1D4533' }}>
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
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                        Operator
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A', marginTop: 2 }}>
                        {selectedAuditLogForModal.admin_name} ({selectedAuditLogForModal.admin_role || 'Admin'})
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                        Network Telemetry
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? '#CBD5E1' : '#475569', marginTop: 2 }}>
                        IP: {selectedAuditLogForModal.ip_address || '127.0.0.1'} • {selectedAuditLogForModal.client || 'Admin Dashboard'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                        Timestamp
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? '#CBD5E1' : '#475569', marginTop: 2 }}>
                        {new Date(selectedAuditLogForModal.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* JSON Metadata Payload */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                      Payload Metadata
                    </Text>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#0A0F1D' : '#F1F5F9',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
                        {JSON.stringify(selectedAuditLogForModal.metadata || {}, null, 2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? '#334155' : '#E2E8F0',
              }}
            >
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#1D4533',
                }}
                onPress={() => setSelectedAuditLogForModal(null)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>Close</Text>
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
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Part Name</Text>
              <TextInput
                style={styles.formInput}
                value={newProdName}
                onChangeText={setNewProdName}
                placeholder="e.g. Akrapovič Slip-On Exhaust"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Brand Name</Text>
              <TextInput
                style={styles.formInput}
                value={newProdBrand}
                onChangeText={setNewProdBrand}
                placeholder="e.g. Brembo, Öhlins, Akrapovič"
                placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
              {Number(newProdPrice) > 0 && (
                <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700', marginBottom: 8 }}>
                  Profit per unit: ₱
                  {(Number(newProdPrice) - Number(newProdCost || 0)).toLocaleString()} (
                  {(
                    ((Number(newProdPrice) - Number(newProdCost || 0)) / Number(newProdPrice)) *
                    100
                  ).toFixed(1)}
                  % margin)
                </Text>
              )}

              <Text style={styles.formLabel}>Category</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {CATEGORY_NAMES.filter((c) => c !== 'All').map((cat) => (
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
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
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
                  backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
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
                      backgroundColor: '#1D4533',
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
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Upload PNG, JPG, WEBP from your local PC or phone
                  </Text>
                </View>
              </View>

              <Text style={[styles.formLabel, { fontSize: 12, color: '#64748B' }]}>
                Or Paste Direct Image URL
              </Text>
              <TextInput
                style={styles.formInput}
                value={newProdImage}
                onChangeText={setNewProdImage}
                placeholder="https://..."
                placeholderTextColor="#94A3B8"
              />

              {/* Preset Image Picker */}
              <Text style={[styles.formLabel, { fontSize: 12, color: '#64748B' }]}>
                Or Select a Preset Image
              </Text>
              <View style={styles.presetGrid}>
                {ADMIN_IMAGE_PRESETS.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.presetThumbBtn, newProdImage === url && styles.presetThumbBtnActive]}
                    onPress={() => setNewProdImage(url)}
                  >
                    <Image source={{ uri: url }} style={styles.presetThumbImg} />
                  </TouchableOpacity>
                ))}
              </View>
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
                  <BootstrapIcon name="x-lg" size={16} color="#64748B" />
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
                  <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700', marginBottom: 8 }}>
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
                )}

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
                    backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
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
                      borderColor: '#CBD5E1',
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
                        backgroundColor: '#1D4533',
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
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      Pick replacement image from your computer or phone
                    </Text>
                  </View>
                </View>

                <Text style={[styles.formLabel, { fontSize: 12, color: '#64748B' }]}>Or Paste Image URL</Text>
                <TextInput
                  style={styles.formInput}
                  value={editingProduct.image || ''}
                  onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, image: val }))}
                  placeholder="https://..."
                  placeholderTextColor="#94A3B8"
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
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Select Product SKU</Text>
              <TextInput
                style={styles.formInput}
                value={restockSearchQuery}
                onChangeText={setRestockSearchQuery}
                placeholder="Search by name, brand, or category…"
                placeholderTextColor="#94A3B8"
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
                                ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F0FDFA')
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
                            style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: isDarkMode ? '#1C2422' : '#E2E8F0' }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.textPrimary }} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: tokens.textMuted }} numberOfLines={1}>
                              {p.brand} · Stock {p.stock || 0} · ₱{Number(p.price || 0).toLocaleString()}
                            </Text>
                          </View>
                          <BootstrapIcon name="plus-circle" size={16} color={isDarkMode ? '#34D399' : '#1D4533'} />
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
                      backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
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
                        backgroundColor: isDarkMode ? '#1C2422' : '#E2E8F0',
                        borderWidth: 1.5,
                        borderColor: tokens.borderInput,
                      }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                        {restockModalProduct.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        {restockModalProduct.brand} · {restockModalProduct.category}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#1D4533', fontWeight: '700', marginTop: 4 }}>
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
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309' }}>
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
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
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
                                    borderColor: isSelected ? '#1D4533' : tokens.borderInput,
                                    borderWidth: 1.5,
                                    backgroundColor: isSelected ? '#1D4533' : (isDarkMode ? '#1C2422' : '#F8FAFC'),
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
                                    fontWeight: '800',
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
                                borderColor: restockSelectedSize === 'all' ? '#1D4533' : tokens.borderInput,
                                borderWidth: 1.5,
                                backgroundColor: restockSelectedSize === 'all' ? '#1D4533' : (isDarkMode ? '#1C2422' : '#F8FAFC'),
                              },
                            ]}
                            onPress={() => setRestockSelectedSize('all')}
                          >
                            <BootstrapIcon
                              name="grid-3x3-gap-fill"
                              size={12}
                              color={restockSelectedSize === 'all' ? '#FFFFFF' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '800',
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
                                backgroundColor: '#F0FDFA',
                                borderWidth: 1,
                                borderColor: '#CCFBF1',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '700' }}>
                                Restocking: <Text style={{ fontWeight: '900' }}>{restockSelectedSize}</Text> (Current: {curStock} units)
                              </Text>
                              <Text style={{ fontSize: 12, color: '#059669', fontWeight: '800' }}>
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
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
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
                                    borderColor: isSelected ? '#1D4533' : tokens.borderInput,
                                    borderWidth: 1.5,
                                    backgroundColor: isSelected ? '#1D4533' : (isDarkMode ? '#1C2422' : '#F8FAFC'),
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
                                    fontWeight: '800',
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
                                borderColor: restockSelectedColor === 'all' ? '#1D4533' : tokens.borderInput,
                                borderWidth: 1.5,
                                backgroundColor: restockSelectedColor === 'all' ? '#1D4533' : (isDarkMode ? '#1C2422' : '#F8FAFC'),
                              },
                            ]}
                            onPress={() => setRestockSelectedColor('all')}
                          >
                            <BootstrapIcon
                              name="grid-3x3-gap-fill"
                              size={12}
                              color={restockSelectedColor === 'all' ? '#FFFFFF' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '800',
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
                                backgroundColor: '#F0FDFA',
                                borderWidth: 1,
                                borderColor: '#CCFBF1',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '700' }}>
                                Restocking: <Text style={{ fontWeight: '900' }}>{restockSelectedColor}</Text> (Current: {curStock} units)
                              </Text>
                              <Text style={{ fontSize: 12, color: '#059669', fontWeight: '800' }}>
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
                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
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
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{row.label}</Text>
                                  </View>
                                ) : (
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{row.label}</Text>
                                )}
                                <Text style={{ fontSize: 11, color: '#64748B' }}>Now: {row.currentStock}</Text>
                              </View>
                              <TextInput
                                style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                                keyboardType="numeric"
                                value={row.addQty}
                                placeholder="+ qty"
                                placeholderTextColor="#94A3B8"
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
                                  backgroundColor: '#FEF3C7',
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                  borderWidth: 1,
                                  borderColor: '#FDE68A',
                                }}
                                onPress={() =>
                                  setRestockColorAdds((prev) =>
                                    prev.map((r) => ({ ...r, addQty: String(qty) }))
                                  )
                                }
                              >
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533' }}>
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
                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
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
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                                  {row.label}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#64748B' }}>
                                  Now: {row.currentStock}
                                </Text>
                              </View>
                              <TextInput
                                style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                                keyboardType="numeric"
                                value={row.addQty}
                                placeholder="+ qty"
                                placeholderTextColor="#94A3B8"
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
                                  backgroundColor: '#FEF3C7',
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  alignItems: 'center',
                                  borderWidth: 1,
                                  borderColor: '#FDE68A',
                                }}
                                onPress={() =>
                                  setRestockSizeAdds((prev) =>
                                    prev.map((r) => ({ ...r, addQty: String(qty) }))
                                  )
                                }
                              >
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533' }}>
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
                          style={[styles.formInput, { fontSize: 16, fontWeight: '900', color: '#1D4533' }]}
                          keyboardType="numeric"
                          value={restockAmount}
                          onChangeText={setRestockAmount}
                          placeholder="10"
                          placeholderTextColor="#94A3B8"
                        />
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                          {[5, 10, 25, 50].map((qty) => (
                            <TouchableOpacity
                              key={qty}
                              style={{
                                flex: 1,
                                backgroundColor: '#FEF3C7',
                                paddingVertical: 6,
                                borderRadius: 8,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#FDE68A',
                              }}
                              onPress={() => setRestockAmount(String(qty))}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533' }}>
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
                        placeholderTextColor="#94A3B8"
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
                        placeholderTextColor="#94A3B8"
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
                          backgroundColor: '#F0FDFA',
                          borderWidth: 1,
                          borderColor: '#99F6E4',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F766E' }}>
                          Expense & Profit preview
                        </Text>
                        {Number(price) > 0 && (
                          <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>
                            Profit per unit: ₱{profitUnit.toLocaleString()} ({margin.toFixed(1)}%
                            margin)
                          </Text>
                        )}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>
                          Expense (paid to supplier): ₱{expense.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#475569' }}>
                          If all {qty || 0} units sell: ₱{expected.toLocaleString()} profit
                        </Text>
                      </View>
                    );
                  })()}
                </>
              ) : (
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 12 }}>
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
                  <BootstrapIcon name="x-lg" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                  {posSizePickerProduct.name}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
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
                          borderColor: soldOut ? (isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#FECACA') : active ? '#1D4533' : tokens.border,
                          backgroundColor: soldOut ? (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2') : active ? '#1D4533' : (isDarkMode ? '#1C2422' : '#F8FAFC'),
                          minWidth: 110,
                          opacity: soldOut ? 0.7 : 1,
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: soldOut ? (isDarkMode ? '#F87171' : '#991B1B') : active ? '#FFFFFF' : tokens.textPrimary,
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
                            color: soldOut ? '#DC2626' : active ? '#CCFBF1' : '#1D4533',
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
                  <Text style={[styles.receiptText, { color: '#059669' }]}>Voucher Discount:</Text>
                  <Text style={[styles.receiptTextBold, { color: '#059669' }]}>
                    -₱{posReceiptOrder.discount_amount?.toLocaleString()}
                  </Text>
                </View>
              )}

              <View style={[styles.receiptRow, { marginTop: 4 }]}>
                <Text style={[styles.receiptTextBold, { fontSize: 14 }]}>TOTAL PAID:</Text>
                <Text style={[styles.receiptTextBold, { fontSize: 16, color: '#1D4533' }]}>
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
                    <Text style={[styles.receiptTextBold, { color: '#059669' }]}>
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
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
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
                  paddingHorizontal: 24,
                  paddingVertical: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: '#FEF3C7',
                      borderWidth: 1,
                      borderColor: '#FDE68A',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <BootstrapIcon name="tools" size={20} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
                        Work Order #{selectedBookingForModal.booking_id || selectedBookingForModal.id}
                      </Text>
                      <View
                        style={{
                          backgroundColor: selectedBookingForModal.status === 'Cancelled' ? '#FEF2F2' : '#ECFDF5',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: selectedBookingForModal.status === 'Cancelled' ? '#FECACA' : '#A7F3D0',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: selectedBookingForModal.status === 'Cancelled' ? '#DC2626' : '#047857',
                          }}
                        >
                          {selectedBookingForModal.status === 'Cancelled'
                            ? 'DP Forfeited'
                            : `20% DP ₱${(selectedBookingForModal.downpayment_amount !== undefined ? selectedBookingForModal.downpayment_amount : Math.round((selectedBookingForModal.pricePhp || 2500) * 0.20)).toLocaleString()} Paid (${selectedBookingForModal.downpayment_method || 'GCash'})`}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                      {selectedBookingForModal.category || 'PMS'} Service Appointment •{' '}
                      {selectedBookingForModal.branch?.replace('MotoTrack ', '') || 'D\'Blockchain Motorparts and Accessories'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setIsBookingModalOpen(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Main Content */}
              <ScrollView
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                contentContainerStyle={{ padding: 22, paddingBottom: 28 }}
                showsVerticalScrollIndicator={true}
              >
                {/* Organized Booking Details (list + modal information) */}
                <AdminBookingDetailsPanel
                  booking={selectedBookingForModal}
                  mechanics={garageMechanics}
                  onToast={showToast}
                  isDarkMode={isDarkMode}
                  tokens={tokens}
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
              </ScrollView>

              {/* Fixed Footer */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FECACA',
                    cursor: 'pointer',
                  }}
                  onPress={() =>
                    handleDeleteBooking(
                      selectedBookingForModal.booking_id || selectedBookingForModal.id
                    )
                  }
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="trash" size={13} color="#DC2626" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>Delete Booking</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#1D4533',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onPress={() => setIsBookingModalOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Close Window</Text>
                </TouchableOpacity>
              </View>
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
                    backgroundColor: '#FEF3C7',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar-plus-fill" size={18} color="#1D4533" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Book Walk-in / Phone-in Service</Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                    Schedule new garage appointment and assign lift bay
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsNewBookingModalOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Category selector */}
              <Text style={styles.formLabel}>Service Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[
                  { key: 'Repair', label: 'Mechanical Repair' },
                  { key: 'PMS', label: 'Preventive Maintenance (PMS)' },
                  { key: 'Customization', label: 'Customization & Tuning' },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.orderFilterTab,
                      { flex: 1, alignItems: 'center', paddingVertical: 10 },
                      newBkCategory === c.key && { backgroundColor: '#1D4533', borderColor: '#1D4533' },
                    ]}
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
                        setNewBkServiceTitle('Full System Exhaust Fitting & Dyno Tuning');
                        setNewBkPrice('6000');
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.orderFilterTabText,
                        newBkCategory === c.key && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Service Title & Price */}
              <Text style={styles.formLabel}>Shop Service Package</Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                {garageServices
                  .filter((pkg) => !newBkCategory || pkg.category === newBkCategory)
                  .map((pkg) => {
                    const selected = newBkServiceTitle === pkg.title;
                    const price = getPackagePricePhp(pkg);
                    return (
                      <TouchableOpacity
                        key={pkg.id || pkg.service_id}
                        onPress={() => {
                          setNewBkServiceTitle(pkg.title);
                          setNewBkPrice(String(price));
                          setNewBkCategory(pkg.category || newBkCategory);
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: selected ? '#1D4533' : tokens.border,
                          backgroundColor: selected ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F0FDF4') : (isDarkMode ? '#1C2422' : '#FFFFFF'),
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? (isDarkMode ? '#34D399' : '#1D4533') : tokens.textPrimary, flex: 1 }}>
                            {pkg.title}
                          </Text>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: isDarkMode ? '#34D399' : '#1D4533' }}>₱{price.toLocaleString()}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
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
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Contact Phone</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkCustomerPhone}
                    onChangeText={setNewBkCustomerPhone}
                    placeholder="+63 9XX XXX XXXX"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Email (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkCustomerEmail}
                    onChangeText={setNewBkCustomerEmail}
                    placeholder="juan@example.com"
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Bike Model</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkBikeModel}
                    onChangeText={setNewBkBikeModel}
                    placeholder="NMAX 155, Ninja 400..."
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Odometer (km)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkOdo}
                    onChangeText={setNewBkOdo}
                    placeholder="8,500 km"
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Time Slot</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newBkTimeSlot}
                    onChangeText={setNewBkTimeSlot}
                    placeholder="10:30 AM - 12:00 PM"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Garage Branch</Text>
              <TextInput
                style={styles.formInput}
                value={newBkBranch}
                onChangeText={setNewBkBranch}
                placeholder="MotoTrack Flagship Central Hub - Quezon City"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Assigned Technician</Text>
              <TextInput
                style={styles.formInput}
                value={newBkMechanic}
                onChangeText={setNewBkMechanic}
                placeholder="Assigned technician (optional / pending)"
                placeholderTextColor="#94A3B8"
              />

              {/* Mandatory 20% Non-Refundable Downpayment Notice */}
              <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0', marginVertical: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#166534' }}>
                    Mandatory 20% Downpayment (Collected):
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#166534' }}>
                    ₱{Math.round((Number(newBkPrice) || (newBkCategory === 'PMS' ? 3750 : 6000)) * 0.20).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
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
                placeholderTextColor="#94A3B8"
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
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Service Title *</Text>
              <TextInput
                style={styles.formInput}
                value={servTitle}
                onChangeText={setServTitle}
                placeholder="e.g. Master Brake System Flush & Bleed"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Subtitle / Short Tagline</Text>
              <TextInput
                style={styles.formInput}
                value={servSubtitle}
                onChangeText={setServSubtitle}
                placeholder="e.g. High Temp Motul RBF 660 Fluid Bleed"
                placeholderTextColor="#94A3B8"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Category</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['PMS', 'Repair', 'Customization'].map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.orderFilterTab,
                          { flex: 1, alignItems: 'center' },
                          servCategory === cat && { backgroundColor: '#1D4533', borderColor: '#1D4533' },
                        ]}
                        onPress={() => setServCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.orderFilterTabText,
                            servCategory === cat && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
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
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Badge Tag</Text>
                  <TextInput
                    style={styles.formInput}
                    value={servBadge}
                    onChangeText={setServBadge}
                    placeholder="Popular / Express"
                    placeholderTextColor="#94A3B8"
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
                  backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              >
                {servImage ? (
                  <Image
                    source={{ uri: servImage }}
                    style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: isDarkMode ? '#1C2422' : '#E2E8F0' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: isDarkMode ? '#1C2422' : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <BootstrapIcon name="tools" size={20} color="#94A3B8" />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: '#1D4533',
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
                    placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Inclusions (One per line)</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                multiline
                value={servInclusions}
                onChangeText={setServInclusions}
                placeholder="e.g. Complete Fluid Change&#10;System Pressure Test"
                placeholderTextColor="#94A3B8"
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
                  {editingMechanic ? 'Edit Certified Technician' : 'Add Certified Technician'}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Set certifications, hourly rate, and live availability
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddMechanicModalOpen(false);
                  setEditingMechanic(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
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
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533', letterSpacing: 0.6 }}>
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
                          borderColor: '#1D4533',
                          backgroundColor: '#F1F5F9',
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
                        borderColor: '#CBD5E1',
                        borderStyle: 'dashed',
                        backgroundColor: '#F8FAFC',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <BootstrapIcon name="person-fill" size={26} color="#94A3B8" />
                      <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8' }}>
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
                        backgroundColor: '#1D4533',
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
                      <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>
                        ✓ Photo attached
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        Upload a device photo for the technician
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />

              {/* SECTION 2 — TECHNICIAN INFORMATION */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533', letterSpacing: 0.6 }}>
                  TECHNICIAN INFORMATION
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1.5 }}>
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
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Short Name / Nickname</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechShortName}
                      onChangeText={setMechShortName}
                      placeholder="e.g. Tech Roberto"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />

              {/* SECTION 3 — HOURLY LABOR RATE */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533', letterSpacing: 0.6 }}>
                  HOURLY LABOR RATE
                </Text>
                <Text style={styles.formLabel}>Hourly Labor Rate (₱/Hour) *</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: tokens.borderInput,
                    borderRadius: 8,
                    backgroundColor: isDarkMode ? '#1C2422' : '#FFFFFF',
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#1D4533', marginRight: 8 }}>
                    ₱
                  </Text>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      fontSize: 14,
                      fontWeight: '700',
                      color: tokens.textPrimary,
                      outline: 'none',
                    }}
                    keyboardType="decimal-pad"
                    value={mechHourlyRate}
                    onChangeText={setMechHourlyRate}
                    placeholder="150.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Used for dynamic quotations. Changing this rate does not alter past quotation snapshots.
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />

              {/* SECTION 4 — CERTIFICATIONS & SPECIALIZATIONS */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533', letterSpacing: 0.6 }}>
                  CERTIFICATIONS & SPECIALIZATIONS
                </Text>

                {/* Primary Specialization */}
                <Text style={styles.formLabel}>Primary Specialization</Text>
                <View style={styles.quickChipRow}>
                  {MECHANIC_SPECIALIZATION_PRESETS.map((spec) => {
                    const isMatch = mechSpecialization === spec;
                    return (
                      <TouchableOpacity
                        key={spec}
                        style={[styles.quickChip, isMatch && styles.quickChipActive]}
                        onPress={() => setMechSpecialization(spec)}
                      >
                        <Text style={[styles.quickChipText, isMatch && styles.quickChipTextActive]}>
                          {spec}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.formInput}
                  value={mechSpecialization}
                  onChangeText={setMechSpecialization}
                  placeholder="e.g. Desmo Valve Clearance & Superbike Electronics"
                  placeholderTextColor="#94A3B8"
                />

                {/* Certifications & Experience */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.formLabel}>OEM Certifications & Badges</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechCertifications}
                      onChangeText={setMechCertifications}
                      placeholder="e.g. Yamaha YTA Gold • Öhlins Factory Center"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Experience</Text>
                    <TextInput
                      style={styles.formInput}
                      value={mechExperience}
                      onChangeText={setMechExperience}
                      placeholder="e.g. 7 Years Pro Tech"
                      placeholderTextColor="#94A3B8"
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
                          borderColor: isSelected ? '#1D4533' : tokens.borderInput,
                          backgroundColor: isSelected ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F3F7F6') : (isDarkMode ? '#1C2422' : '#FFFFFF'),
                        }}
                        onPress={() => setMechStatus(st.id)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isSelected ? (isDarkMode ? '#34D399' : '#1D4533') : tokens.textPrimary,
                            marginBottom: 2,
                          }}
                        >
                          {st.label}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: '#64748B' }}>{st.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Footer (Fixed) */}
            <View style={[styles.modalFooter, { borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 14 }]}>
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
                  {editingMechanic ? 'Save Changes' : 'Add Technician to Roster'}
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
          <View style={[styles.modalSheet, { maxWidth: 520, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingRider ? 'Edit Rider Account' : 'Create Rider Account'}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Role is always Rider. Only Active riders can log in.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddRiderModalOpen(false);
                  setEditingRider(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
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
                      borderColor: '#1D4533',
                      backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      borderWidth: 2,
                      borderColor: '#CBD5E1',
                      borderStyle: 'dashed',
                      backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="person-fill" size={24} color="#94A3B8" />
                  </View>
                )}

                <View style={{ flex: 1, gap: 6 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#1D4533',
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1.5 }}>
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
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Short Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderShortName}
                    onChangeText={setRiderShortName}
                    placeholder="e.g. Juan"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Phone *</Text>
              <TextInput
                style={styles.formInput}
                value={riderPhone}
                onChangeText={setRiderPhone}
                placeholder="e.g. 09171234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Rider ID</Text>
              <TextInput
                style={[styles.formInput, editingRider && { backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC' }]}
                value={riderIdInput}
                onChangeText={setRiderIdInput}
                placeholder="e.g. rider-juan (optional, auto if blank)"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                editable={!editingRider}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Email *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderEmail}
                    onChangeText={setRiderEmail}
                    placeholder="rider@store.com"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Username *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderUsername}
                    onChangeText={setRiderUsername}
                    placeholder="rider.juan"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>
                {editingRider ? 'Temporary password (leave blank to keep)' : 'Temporary password *'}
              </Text>
              <TextInput
                style={styles.formInput}
                value={riderPassword}
                onChangeText={setRiderPassword}
                placeholder={editingRider ? 'Leave blank to keep current password' : 'Min. 6 characters'}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                secureTextEntry
              />

              <Text style={styles.formLabel}>Account status (login)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {Object.values(RIDER_ACCOUNT_STATUSES).map((st) => {
                  const isSelected = riderAccountStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setRiderAccountStatus(st)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#1D4533' : tokens.borderInput,
                        backgroundColor: isSelected ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F3F7F6') : (isDarkMode ? '#1C2422' : '#FFFFFF'),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isSelected ? (isDarkMode ? '#34D399' : '#1D4533') : tokens.textPrimary,
                        }}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.formLabel}>Vehicle</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderVehicle}
                    onChangeText={setRiderVehicle}
                    placeholder="e.g. Yamaha NMAX 155"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Plate Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={riderPlate}
                    onChangeText={setRiderPlate}
                    placeholder="e.g. NMX-1001"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {Object.values(RIDER_STATUSES).map((st) => {
                  const isSelected = riderStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setRiderStatus(st)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#1D4533' : tokens.borderInput,
                        backgroundColor: isSelected ? (isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#F3F7F6') : (isDarkMode ? '#1C2422' : '#FFFFFF'),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isSelected ? (isDarkMode ? '#34D399' : '#1D4533') : tokens.textPrimary,
                        }}
                      >
                        {st}
                      </Text>
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
                placeholderTextColor="#94A3B8"
                multiline
              />
            </ScrollView>

            <View style={styles.modalFooter}>
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
                  {editingRider ? 'Save Changes' : 'Add Rider'}
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
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Procurement source, catalog categories, and fulfillment logistics
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddSupplierModalOpen(false);
                  setEditingSupplier(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Supplier / Company Name */}
              <Text style={styles.formLabel}>Supplier / Company Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Akrapovič Racing Exhausts, Brembo SpA..."
                placeholderTextColor="#94A3B8"
                value={supName}
                onChangeText={setSupName}
              />

              {/* Contact Person */}
              <Text style={styles.formLabel}>Account Executive / Contact Person</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Matteo Rossi, Regional Sales Manager"
                placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
                value={supAddress}
                onChangeText={setSupAddress}
              />

              {/* Category Selection Presets */}
              <Text style={styles.formLabel}>Supplied Category Preset</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {SUPPLIER_CATEGORY_PRESETS.map((cat) => {
                  const isSelected = supCategories === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                        backgroundColor: isSelected
                          ? '#1D4533'
                          : isDarkMode
                            ? '#1E293B'
                            : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isSelected
                          ? '#1D4533'
                          : isDarkMode
                            ? '#334155'
                            : '#CBD5E1',
                      }}
                      onPress={() => setSupCategories(cat)}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected
                            ? '#FFFFFF'
                            : isDarkMode
                              ? '#E2E8F0'
                              : '#475569',
                        }}
                      >
                        {cat}
                      </Text>
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
                    placeholderTextColor="#94A3B8"
                    value={supLeadTime}
                    onChangeText={setSupLeadTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Quality Score (1.0 - 5.0)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="5.0"
                    placeholderTextColor="#94A3B8"
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
                  { id: 'Active', label: 'Active Partner', color: '#10B981' },
                  { id: 'Pending', label: 'Pending Review', color: '#F59E0B' },
                  { id: 'Inactive', label: 'Inactive / On Hold', color: '#64748B' },
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
                            ? 'rgba(29, 69, 51,0.3)'
                            : '#E8F0EC'
                          : isDarkMode
                            ? '#1E293B'
                            : '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: selected
                          ? '#1D4533'
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
                            fontWeight: selected ? '800' : '600',
                            color: selected
                              ? '#1D4533'
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
                placeholderTextColor="#94A3B8"
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

      {/* ─── MODAL 5: CREATE PROMO CODE ─── */}
      <Modal
        visible={isAddPromoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddPromoOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Discount Voucher</Text>
              <TouchableOpacity onPress={() => setIsAddPromoOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 10 }}>
              <Text style={styles.formLabel}>Promo Voucher Code</Text>
              <TextInput
                style={styles.formInput}
                value={newPromoCode}
                onChangeText={setNewPromoCode}
                placeholder="e.g. MOTO25"
                autoCapitalize="characters"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Discount Percentage (%)</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={newPromoPercent}
                onChangeText={setNewPromoPercent}
                placeholder="20"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={styles.formInput}
                value={newPromoDesc}
                onChangeText={setNewPromoDesc}
                placeholder="Special track season voucher"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.quickStoreBtn} onPress={() => setIsAddPromoOpen(false)}>
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleCreatePromo}>
                <Text style={styles.addBtnPrimaryText}>Publish Voucher</Text>
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
                    backgroundColor: '#FEF3C7',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <BootstrapIcon name="grid-fill" size={16} color="#1D4533" />
                </View>
                <Text style={styles.modalTitle}>Admin Management Menu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsMobileMoreOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.mobileMoreGrid}>
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
                  color={activeNav === 'orders' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Orders & COD</Text>
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
                  color={activeNav === 'promos' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Promo Codes</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{promos.length} active vouchers</Text>
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
                  color={activeNav === 'suppliers' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Supplier</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{suppliers.length} vendors</Text>
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
                  color={activeNav === 'garage' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Pitstop Services</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>PMS & Tuning</Text>
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
                  color={activeNav === 'mechanics' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Mechanics & Crew</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{garageMechanics.length} certified</Text>
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
                  color={activeNav === 'riders' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Riders</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{deliveryRiders.length} delivery staff</Text>
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
                  color={activeNav === 'users' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>User Accounts</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{usersList.length} registered</Text>
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
                  color={activeNav === 'supabase' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Supabase DB</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Cloud Database</Text>
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
                  color={activeNav === 'forecast' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Forecast & Stock</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Demand & restock planner</Text>
                </View>
              </TouchableOpacity>

              {/* Audit Logs */}
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
                  color={activeNav === 'audit' ? '#1D4533' : '#475569'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Audit Logs</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{auditLogs.length} tracked records</Text>
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
                  color={activeNav === 'notifications' ? '#1D4533' : '#475569'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Notifications</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
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
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
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
                  color={activeNav === 'settings' ? '#1D4533' : '#475569'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>System Settings</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Store rules & maintenance</Text>
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
                  color={isDarkMode ? '#F59E0B' : '#64748B'}
                />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
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
                <BootstrapIcon name="shop" size={20} color="#1D4533" />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1D4533' }}>Live Storefront</Text>
                  <Text style={{ fontSize: 11, color: '#1D4533' }}>View Store</Text>
                </View>
              </TouchableOpacity>

              {/* Log Out */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                onPress={() => {
                  setIsMobileMoreOpen(false);
                  try {
                    adminSecurityService.lockSession();
                  } catch (_e) {}
                  if (onLogout) {
                    onLogout();
                  } else {
                    logout?.();
                    onNavigateToStore?.();
                  }
                }}
              >
                <BootstrapIcon name="box-arrow-right" size={20} color="#DC2626" />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626' }}>Log Out</Text>
                  <Text style={{ fontSize: 11, color: '#DC2626' }}>Exit Backoffice</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ORDER DETAILS & FULFILLMENT CONTROL ─── */}
      <Modal
        visible={isOrderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOrderModalOpen(false)}
      >
        {(() => {
          const modalStatus = (selectedOrderForModal?.status || '').toLowerCase();
          const isDeliveredModal = modalStatus === 'delivered' || modalStatus === 'completed';
          const isPendingModal = modalStatus.includes('pending') || modalStatus.includes('approval');
          const statusMeta = getOrderStatusMeta(selectedOrderForModal?.status);
          return (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { width: '95%', maxWidth: 820, maxHeight: '94%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: isDarkMode ? '#1E293B' : '#FEF3C7',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <BootstrapIcon name="receipt" size={18} color="#1D4533" />
                </View>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.modalTitle}>
                      Order #{selectedOrderForModal?.order_id || selectedOrderForModal?.id}
                    </Text>
                    {/* Dynamic Status Pill in Header */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: statusMeta.bg,
                        borderColor: statusMeta.border,
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                      }}
                    >
                      <BootstrapIcon name={statusMeta.icon} size={11} color={statusMeta.color} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: statusMeta.color }}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                    Placed on {selectedOrderForModal?.order_date || 'Recent'} •{' '}
                    {selectedOrderForModal?.channel || 'Online Store'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsOrderModalOpen(false)} style={{ padding: 4 }}>
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
              {/* Top Prominent Order Status Bar */}
              <View
                style={{
                  backgroundColor: statusMeta.bg,
                  borderWidth: 1.5,
                  borderColor: statusMeta.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  marginBottom: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: statusMeta.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: '#FFFFFF',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: statusMeta.border,
                    }}
                  >
                    <BootstrapIcon name={statusMeta.icon} size={16} color={statusMeta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '800',
                        color: statusMeta.color,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                      }}
                    >
                      Current Order Status
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: statusMeta.color, marginTop: 1 }}>
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: statusMeta.color,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                    Active Status
                  </Text>
                </View>
              </View>
              {/* COD Approval Priority Callout inside modal */}
              {selectedOrderForModal &&
                ((selectedOrderForModal.status || '').toLowerCase().includes('pending') ||
                  (selectedOrderForModal.status || '').toLowerCase().includes('approval')) && (
                  <View style={[styles.codAlertBanner, { marginBottom: 14 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <BootstrapIcon name="shield-lock-fill" size={18} color="#92400E" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>
                          Cash on Delivery Verification Required
                        </Text>
                        <Text style={{ fontSize: 11, color: '#B45309' }}>
                          Verify recipient details before clicking Approve to send to packing.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.btnApproveCod}
                      onPress={async () => {
                        await handleApproveCOD(selectedOrderForModal.order_id || selectedOrderForModal.id);
                      }}
                    >
                      <BootstrapIcon name="check-circle-fill" size={12} color="#FFFFFF" />
                      <Text style={styles.btnApproveCodText}>Approve COD Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* View-Only: Customer & Shipping Information */}
              <View
                style={{
                  backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  marginBottom: 14,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: isDarkMode ? '#2D3748' : '#E2E8F0',
                    paddingBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Customer & Order Information
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#EFF6FF',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1D4ED8' }}>
                      Verified Order Info
                    </Text>
                  </View>
                </View>

                {/* Customer Name & Contact Phone in two columns */}
                <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 }}>
                      CUSTOMER NAME
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="person-fill" size={14} color="#64748B" />
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: tokens.textPrimary }}>
                        {selectedOrderForModal?.customer_name || 'Walk-in Customer'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 }}>
                      CONTACT NUMBER
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="telephone-fill" size={12} color="#64748B" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                        {selectedOrderForModal?.customer_phone || 'None provided'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Delivery Address */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 }}>
                    DELIVERY ADDRESS
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <BootstrapIcon name="geo-alt-fill" size={13} color="#64748B" style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: 13, color: tokens.textPrimary, fontWeight: '600', lineHeight: 18, flex: 1 }}>
                      {selectedOrderForModal?.customer_address || 'No address provided (Store Pickup)'}
                    </Text>
                  </View>
                </View>

                {/* Delivery Notes */}
                {selectedOrderForModal?.delivery_notes ? (
                  <View style={{ backgroundColor: isDarkMode ? '#141A18' : '#F1F5F9', padding: 10, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 2 }}>
                      DELIVERY NOTES / SPECIAL INSTRUCTIONS
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.textPrimary, fontStyle: 'italic' }}>
                      "{selectedOrderForModal.delivery_notes}"
                    </Text>
                  </View>
                ) : null}

                {/* Payment Method & COD Change */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 14,
                    flexWrap: 'wrap',
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: isDarkMode ? '#2D3748' : '#E2E8F0',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 }}>
                      PAYMENT METHOD
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="credit-card-2-front-fill" size={13} color="#64748B" />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.textPrimary }}>
                        {selectedOrderForModal?.payment_method || 'Cash on Delivery (COD)'}
                      </Text>
                    </View>
                  </View>

                  {selectedOrderForModal?.cod_change_for ? (
                    <View style={{ flex: 1, minWidth: 150 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 }}>
                        COD CHANGE FOR
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#059669' }}>
                        ₱{Number(selectedOrderForModal.cod_change_for).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Rider Assignment Card */}
              <View
                style={{
                  backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BootstrapIcon name="bicycle" size={15} color="#1D4533" />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: tokens.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Assigned Rider / Courier
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#0F172A',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      onPress={() => {
                        setDeliveryTokenModal({
                          order: selectedOrderForModal,
                          bundle: null,
                        });
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="qr-code" size={12} color="#FFFFFF" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>QR Code</Text>
                    </TouchableOpacity>

                    {!isDeliveredModal && (selectedOrderForModal?.status || '').toLowerCase() !== 'cancelled' && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#1D4533',
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onPress={() => {
                          setAssignDeliveryOrder({
                            ...selectedOrderForModal,
                            expected_delivery_at:
                              orderDeliveryDetail?.expected_delivery_at ||
                              selectedOrderForModal?.expected_delivery_at,
                          });
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="person-plus-fill" size={12} color="#FFFFFF" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                          {orderDeliveryDetail?.rider_name || selectedOrderForModal?.rider_name ? 'Change Rider' : 'Assign Rider'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {orderDeliveryDetail?.rider_name || selectedOrderForModal?.rider_name ? (
                  <View
                    style={{
                      backgroundColor: '#ECFDF5',
                      borderWidth: 1,
                      borderColor: '#A7F3D0',
                      padding: 12,
                      borderRadius: 10,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                        <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#065F46' }}>
                          {orderDeliveryDetail?.rider_name || selectedOrderForModal?.rider_name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        {orderDeliveryDetail?.delivery_status || selectedOrderForModal?.status || 'Assigned'}
                      </Text>
                    </View>
                    {(orderDeliveryDetail?.rider_contact || selectedOrderForModal?.rider_contact) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="telephone" size={12} color="#047857" />
                        <Text style={{ fontSize: 12, color: '#047857', fontWeight: '600' }}>
                          Contact: {orderDeliveryDetail?.rider_contact || selectedOrderForModal?.rider_contact}
                        </Text>
                      </View>
                    ) : null}
                    {(orderDeliveryDetail?.vehicle_info || selectedOrderForModal?.vehicle_info) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="truck" size={12} color="#047857" />
                        <Text style={{ fontSize: 12, color: '#047857', fontWeight: '600' }}>
                          Vehicle: {orderDeliveryDetail?.vehicle_info || selectedOrderForModal?.vehicle_info}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: '#FFFBEB',
                      borderWidth: 1,
                      borderColor: '#FDE68A',
                      padding: 12,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon name="exclamation-circle-fill" size={16} color="#D97706" />
                      <View>
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#92400E' }}>
                          No Rider Assigned
                        </Text>
                        <Text style={{ fontSize: 11, color: '#B45309' }}>
                          Assign a courier to schedule delivery dispatch.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Delivery Information */}
              <View
                style={{
                  backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Delivery Information
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setAssignDeliveryOrder({
                        ...selectedOrderForModal,
                        expected_delivery_at:
                          orderDeliveryDetail?.expected_delivery_at ||
                          selectedOrderForModal?.expected_delivery_at,
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <BootstrapIcon name="truck" size={12} color="#1D4533" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>
                      Assign / Update
                    </Text>
                  </TouchableOpacity>
                </View>
                {orderDeliveryDetail ? (
                  <View style={{ gap: 6 }}>
                    <ExpectedDeliveryEditor
                      orderId={selectedOrderForModal?.order_id || selectedOrderForModal?.id}
                      currentIso={
                        orderDeliveryDetail.expected_delivery_at ||
                        selectedOrderForModal?.expected_delivery_at
                      }
                      adminUser={currentUser}
                      showToast={showToast}
                      isDarkMode={isDarkMode}
                      onSaved={async (res) => {
                        const oid = selectedOrderForModal?.order_id || selectedOrderForModal?.id;
                        setSelectedOrderForModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                expected_delivery_at: res?.delivery?.expected_delivery_at,
                                estimated_delivery: res?.estimated_delivery || prev.estimated_delivery,
                              }
                            : prev
                        );
                        if (oid) await refreshOrderDeliveryPanel(oid);
                        await loadData();
                      }}
                    />
                    <Text style={{ fontSize: 12.5, color: '#334155' }}>
                      Admin confirmation:{' '}
                      {orderDeliveryDetail.admin_confirmed
                        ? `Confirmed${orderDeliveryDetail.admin_confirmed_at ? ` · ${new Date(orderDeliveryDetail.admin_confirmed_at).toLocaleString()}` : ''}${orderDeliveryDetail.confirmed_by_admin ? ` by ${orderDeliveryDetail.confirmed_by_admin}` : ''}`
                        : 'Waiting for admin to Confirm Delivery'}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#334155' }}>
                      Rider report:{' '}
                      {orderDeliveryDetail.rider_reported_delivered
                        ? `Reported${orderDeliveryDetail.rider_reported_at ? ` · ${new Date(orderDeliveryDetail.rider_reported_at).toLocaleString()}` : ''}${orderDeliveryDetail.token_verified ? ' · token verified' : ''}`
                        : 'Not reported yet — rider scans QR after drop-off'}
                    </Text>
                    {orderDeliveryDetail.rider_report_notes ? (
                      <Text style={{ fontSize: 12.5, color: '#64748B', fontStyle: 'italic' }}>
                        Report notes: {orderDeliveryDetail.rider_report_notes}
                      </Text>
                    ) : null}
                    {orderDeliveryDetail.admin_confirmed ? (
                      <Text style={{ fontSize: 12.5, color: '#047857' }}>
                        Admin confirmed delivery
                        {orderDeliveryDetail.admin_confirmed_reason
                          ? `: ${orderDeliveryDetail.admin_confirmed_reason}`
                          : ''}
                      </Text>
                    ) : null}
                    {(!orderDeliveryDetail.admin_confirmed &&
                      (orderDeliveryDetail.delivery_status || '').toLowerCase() !== 'delivered' &&
                      ((selectedOrderForModal?.status || '').toLowerCase() === 'out for delivery' ||
                        (selectedOrderForModal?.status || '').toLowerCase() === 'shipped' ||
                        (selectedOrderForModal?.status || '').toLowerCase() === 'delivery reported' ||
                        orderDeliveryDetail.rider_reported_delivered)) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {((selectedOrderForModal?.status || '').toLowerCase() === 'out for delivery' ||
                          (selectedOrderForModal?.status || '').toLowerCase() === 'shipped') && (
                          <TouchableOpacity
                            style={[styles.btnAdvanceOrder, { paddingHorizontal: 10 }]}
                            onPress={() =>
                              setDeliveryTokenModal({ order: selectedOrderForModal, bundle: null })
                            }
                          >
                            <BootstrapIcon name="qr-code" size={12} color="#1D4ED8" />
                            <Text style={styles.btnAdvanceOrderText}>Print QR</Text>
                          </TouchableOpacity>
                        )}
                        {(orderDeliveryDetail.rider_id ||
                          orderDeliveryDetail.rider_name ||
                          selectedOrderForModal?.rider_id ||
                          selectedOrderForModal?.rider_name) && (
                          <TouchableOpacity
                            style={[styles.btnAdvanceOrder, { paddingHorizontal: 10 }]}
                            onPress={() =>
                              setRiderAccessModal({
                                rider: {
                                  id: orderDeliveryDetail.rider_id || selectedOrderForModal?.rider_id,
                                  name: orderDeliveryDetail.rider_name || selectedOrderForModal?.rider_name,
                                  phone: orderDeliveryDetail.rider_contact || selectedOrderForModal?.rider_contact,
                                },
                                bundle: null,
                              })
                            }
                          >
                            <BootstrapIcon name="geo-alt" size={12} color="#1D4ED8" />
                            <Text style={styles.btnAdvanceOrderText}>Rider dashboard</Text>
                          </TouchableOpacity>
                        )}
                        {!orderDeliveryDetail.rider_reported_delivered && (
                          <TouchableOpacity
                            style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                            onPress={() =>
                              setDeliveryAction({ mode: 'rider_report', order: selectedOrderForModal })
                            }
                          >
                            <BootstrapIcon name="bicycle" size={12} color="#B45309" />
                            <Text style={[styles.btnAdvanceOrderText, { color: '#B45309' }]}>Log rider report</Text>
                          </TouchableOpacity>
                        )}
                        {(orderDeliveryDetail.rider_reported_delivered ||
                          (selectedOrderForModal?.status || '').toLowerCase() === 'delivery reported') && (
                          <TouchableOpacity
                            style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                            onPress={() =>
                              setDeliveryAction({ mode: 'mark_delivered', order: selectedOrderForModal })
                            }
                          >
                            <BootstrapIcon name="check-circle-fill" size={12} color="#047857" />
                            <Text style={[styles.btnAdvanceOrderText, { color: '#047857' }]}>Confirm Delivery</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                          onPress={() =>
                            setDeliveryAction({ mode: 'delivery_issue', order: selectedOrderForModal })
                          }
                        >
                          <BootstrapIcon name="exclamation-triangle" size={12} color="#B91C1C" />
                          <Text style={[styles.btnAdvanceOrderText, { color: '#B91C1C' }]}>Delivery Issue</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      {(orderDeliveryDetail.delivery_photo || orderDeliveryDetail.proof_of_delivery) ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() =>
                            setProofViewer({
                              uri:
                                orderDeliveryDetail.delivery_photo ||
                                orderDeliveryDetail.proof_of_delivery,
                              notes:
                                orderDeliveryDetail.rider_report_notes ||
                                orderDeliveryDetail.delivery_notes ||
                                '',
                              reportedAt:
                                orderDeliveryDetail.rider_reported_at ||
                                orderDeliveryDetail.delivered_at ||
                                null,
                              riderName: orderDeliveryDetail.rider_name || '',
                              orderId:
                                selectedOrderForModal?.order_id || selectedOrderForModal?.id || '',
                            })
                          }
                          style={{ position: 'relative' }}
                        >
                          <Image
                            source={{
                              uri:
                                orderDeliveryDetail.delivery_photo ||
                                orderDeliveryDetail.proof_of_delivery,
                            }}
                            style={{ width: 88, height: 88, borderRadius: 10, backgroundColor: '#E2E8F0' }}
                          />
                          <View
                            style={{
                              position: 'absolute',
                              right: 4,
                              bottom: 4,
                              backgroundColor: 'rgba(15,23,42,0.72)',
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 3,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <BootstrapIcon name="eye" size={10} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>View</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>No delivery photo yet</Text>
                      )}
                      <TouchableOpacity
                        style={[styles.btnAdvanceOrder, { paddingHorizontal: 10 }]}
                        onPress={handleUploadProof}
                      >
                        <BootstrapIcon name="camera" size={12} color="#1D4ED8" />
                        <Text style={styles.btnAdvanceOrderText}>
                          {(orderDeliveryDetail.delivery_photo || orderDeliveryDetail.proof_of_delivery)
                            ? 'Replace Photo'
                            : 'Upload Photo'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: '#94A3B8' }}>
                    No delivery assignment yet. Use Assign Delivery when the order is Processing or Rescheduled.
                  </Text>
                )}
              </View>

              {String(selectedOrderForModal?.status || '').toLowerCase() === 'return requested' && (
                <View
                  style={{
                    backgroundColor: '#FFF7ED',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#C8DDD3',
                    marginBottom: 14,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#9A3412', textTransform: 'uppercase' }}>
                    Return Request
                  </Text>
                  <Text style={{ fontSize: 13, color: '#9A3412' }}>
                    {selectedOrderForModal?.return_reason || 'Customer requested a return'}
                    {selectedOrderForModal?.return_notes ? ` — ${selectedOrderForModal.return_notes}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                      onPress={() =>
                        handleProcessReturn(selectedOrderForModal.order_id || selectedOrderForModal.id, 'Approved')
                      }
                    >
                      <Text style={[styles.btnAdvanceOrderText, { color: '#047857' }]}>Approve Refund</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      onPress={() =>
                        handleProcessReturn(selectedOrderForModal.order_id || selectedOrderForModal.id, 'Rejected')
                      }
                    >
                      <Text style={[styles.btnAdvanceOrderText, { color: '#B91C1C' }]}>Reject Return</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Itemized Products List */}
              <View
                style={{
                  backgroundColor: isDarkMode ? '#141A18' : '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: tokens.textMuted,
                    textTransform: 'uppercase',
                    marginBottom: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  Order Items Breakdown
                </Text>

                {(selectedOrderForModal?.items || []).map((it, idx) => (
                  <View
                    key={it.product_id || idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 8,
                      borderBottomWidth: idx < (selectedOrderForModal?.items?.length || 1) - 1 ? 1 : 0,
                      borderBottomColor: tokens.border,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          it.image ||
                          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=200&q=80',
                      }}
                      style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9' }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>{it.name}</Text>
                      <Text style={{ fontSize: 11, color: tokens.textMuted }}>
                        {it.brand || 'MotoTrack'} • Qty: {it.quantity || 1}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.textPrimary }}>
                      ₱{(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}

                {/* Financial Summary */}
                {(() => {
                  const itemsSubtotal = (selectedOrderForModal?.items || []).reduce(
                    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1),
                    0
                  ) || Number(selectedOrderForModal?.total_amount || 0);

                  const shippingFee = Number(
                    selectedOrderForModal?.shipping_fee != null
                      ? selectedOrderForModal.shipping_fee
                      : orderDeliveryDetail?.shipping_fee != null
                      ? orderDeliveryDetail.shipping_fee
                      : (Number(selectedOrderForModal?.grand_total || 0) > Number(itemsSubtotal || 0)
                          ? Number(selectedOrderForModal.grand_total) - Number(itemsSubtotal) + Number(selectedOrderForModal?.discount_amount || 0)
                          : 0)
                  );

                  const grandTotal = Number(
                    selectedOrderForModal?.grand_total ||
                    (itemsSubtotal + shippingFee - Number(selectedOrderForModal?.discount_amount || 0))
                  );

                  return (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: '#E2E8F0',
                        gap: 5,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>Subtotal</Text>
                        <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '700' }}>
                          ₱{itemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>Shipping Fee</Text>
                        <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '700' }}>
                          {shippingFee > 0
                            ? `₱${shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : 'Free Shipping'}
                        </Text>
                      </View>

                      {Number(selectedOrderForModal?.discount_amount) > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: '#16A34A' }}>Discount Applied</Text>
                          <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700' }}>
                            -₱{Number(selectedOrderForModal.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 4,
                          paddingTop: 6,
                          borderTopWidth: 1,
                          borderTopColor: '#E2E8F0',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A' }}>Grand Total</Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#1D4533' }}>
                          ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Approve & Confirm */}
                {selectedOrderForModal &&
                  !isDeliveredModal &&
                  isPendingModal && (
                    <TouchableOpacity
                      style={[styles.btnApproveCod, { paddingHorizontal: 16, paddingVertical: 10 }]}
                      onPress={async () => {
                        await handleApproveCOD(selectedOrderForModal.order_id || selectedOrderForModal.id);
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="check-circle-fill" size={13} color="#FFFFFF" />
                      <Text style={[styles.btnApproveCodText, { fontSize: 13 }]}>Approve & Confirm</Text>
                    </TouchableOpacity>
                  )}

                {/* Reject Order */}
                {selectedOrderForModal &&
                  !isDeliveredModal &&
                  (selectedOrderForModal.status || '').toLowerCase() !== 'cancelled' && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#DC2626',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onPress={() => {
                        const oid = selectedOrderForModal.order_id || selectedOrderForModal.id;
                        handleRejectOrder(oid);
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="x-circle-fill" size={13} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Reject Order</Text>
                    </TouchableOpacity>
                  )}

                {/* Assign / Reassign Rider */}
                {selectedOrderForModal &&
                  !isDeliveredModal &&
                  (selectedOrderForModal.status || '').toLowerCase() !== 'cancelled' && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#0F766E',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onPress={() => {
                        setAssignDeliveryOrder({
                          ...selectedOrderForModal,
                          expected_delivery_at:
                            orderDeliveryDetail?.expected_delivery_at ||
                            selectedOrderForModal?.expected_delivery_at,
                        });
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="bicycle" size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                        {orderDeliveryDetail?.rider_name || selectedOrderForModal?.rider_name ? 'Reassign Rider' : 'Assign Rider'}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[
                    styles.quickStoreBtn,
                    { backgroundColor: '#0F172A', borderColor: '#0F172A' },
                  ]}
                  onPress={() => {
                    setDeliveryTokenModal({
                      order: selectedOrderForModal,
                      bundle: null,
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="qr-code" size={13} color="#FFFFFF" />
                  <Text style={[styles.quickStoreBtnText, { color: '#FFFFFF', fontWeight: '800' }]}>
                    Delivery QR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickStoreBtn}
                  onPress={() => {
                    showToast('Receipt download initiated / print ready');
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.print?.();
                    }
                  }}
                >
                  <BootstrapIcon name="printer" size={13} color="#1D4533" />
                  <Text style={styles.quickStoreBtnText}>Print</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
          );
        })()}
      </Modal>

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
                color={activeNav === 'overview' ? '#1D4533' : '#64748B'}
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
              style={[styles.bottomNavIconWrap, activeNav === 'inventory' && styles.bottomNavIconWrapActive]}
            >
              <BootstrapIcon
                name="box-seam-fill"
                size={17}
                color={activeNav === 'inventory' ? '#1D4533' : '#64748B'}
              />
              {invStats.lowStockCount > 0 && (
                <View style={styles.bottomNavBadge}>
                  <Text style={styles.bottomNavBadgeText}>{invStats.lowStockCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'inventory' && styles.bottomNavLabelActive]}>
              Stock
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
                color={activeNav === 'pos' ? '#1D4533' : '#64748B'}
              />
              {posCart.length > 0 && (
                <View style={styles.bottomNavBadge}>
                  <Text style={styles.bottomNavBadgeText}>{posCart.length}</Text>
                </View>
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
                color={activeNav === 'analytics' ? '#1D4533' : '#64748B'}
              />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'analytics' && styles.bottomNavLabelActive]}>
              Analytics
            </Text>
          </TouchableOpacity>

          {/* 5. Products */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => {
              setActiveNav('products');
              setIsMobileMoreOpen(false);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[styles.bottomNavIconWrap, activeNav === 'products' && styles.bottomNavIconWrapActive]}
            >
              <BootstrapIcon
                name="tag-fill"
                size={17}
                color={activeNav === 'products' ? '#1D4533' : '#64748B'}
              />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'products' && styles.bottomNavLabelActive]}>
              Products
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
                ['orders', 'promos', 'garage', 'users', 'supabase', 'forecast', 'audit'].includes(activeNav) &&
                  styles.bottomNavIconWrapActive,
              ]}
            >
              <BootstrapIcon
                name="three-dots"
                size={18}
                color={
                  ['orders', 'promos', 'garage', 'users', 'supabase', 'forecast', 'audit'].includes(activeNav)
                    ? '#1D4533'
                    : '#64748B'
                }
              />
              {pendingCodCount > 0 && (
                <View style={[styles.bottomNavBadge, { backgroundColor: '#D97706' }]}>
                  <Text style={styles.bottomNavBadgeText}>{pendingCodCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.bottomNavLabel,
                ['orders', 'promos', 'garage', 'users', 'supabase', 'forecast', 'audit'].includes(activeNav) &&
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
                <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.textPrimary }}>
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
                  backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9',
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
                    backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
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
                <Text style={{ fontSize: 12, color: '#94A3B8' }}>No rider notes attached.</Text>
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

      {/* ─── ADMIN PROFILE & SETTINGS MODAL ─── */}
      <ProfileModal
        visible={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onNavigateToOrders={() => {
          setIsProfileModalOpen(false);
          setActiveNav('orders');
        }}
        onNavigateToWishlist={() => {
          setIsProfileModalOpen(false);
          if (onNavigateToStore) onNavigateToStore();
        }}
        onNavigateToAdmin={() => setIsProfileModalOpen(false)}
        showToast={showToast}
      />
    </SafeAreaView>
  );
}
