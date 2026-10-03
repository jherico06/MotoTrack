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
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { adminStyles as styles } from '../styles/admin.styles';
import { productService, resolveReorderLevel, isLowStock } from '../services/productService';
import { promoService } from '../services/promoService';
import { garageService } from '../services/garageService';
import { orderService } from '../services/orderService';
import { deliveryService } from '../services/deliveryService';
import {
  riderService,
  RIDER_STATUSES,
  RIDER_ACCOUNT_STATUSES,
  RIDER_AVATAR_PRESETS,
} from '../services/riderService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { supabaseManager } from '../services/supabaseClient';
import { CATEGORY_NAMES, ADMIN_IMAGE_PRESETS } from '../data/motorParts';
import { AdminStatCard, BootstrapIcon, ExpectedDeliveryEditor } from '../components/common';
import { AssignDeliveryModal, DeliveryAdminActionModal, DeliveryTokenModal, RiderAccessModal } from '../components/modals';
import { pickImageFromFile } from '../utils/imagePickerHelper';
import { systemSettingsService } from '../services/systemSettingsService';
import NotificationsPage from './NotificationsPage';
import { SalesForecastPanel, BookingCategoryPieChart, ProductSizesEditor, ProductColorsEditor, CustomizationsAdminPanel } from '../components/admin';
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
import { serializeProductColors, validateColorDrafts, normalizeProductColors } from '../utils/productColors';
import { supplierService } from '../services/supplierService';

function AlertOrangeDot({ count, label, title }) {
  const [hovered, setHovered] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: hovered ? 1 : 0,
      friction: 5,
      tension: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [hovered]);

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

  return (
    <View
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
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
        elevation: 10,
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

      {/* Thinking Pop-up Bubble */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 18,
          left: -26,
          alignItems: 'flex-start',
          zIndex: 9999999,
          elevation: 20,
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

        {/* Trailing Thought Bubbles descending to the biggest base orange circle */}
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
  const isDarkMode = false;

  const { currentUser: authUser, adminLogin, login } = useAuth();
  const currentUser = authUser || authService.getCurrentUser() || {
    id: 'admin-default',
    name: 'Administrator',
    email: 'admin@mototrack.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  };

  // Active Navigation Tab: 'overview' | 'orders' | 'inventory' | 'pos' | 'analytics' | 'forecast' | 'products' | 'promos' | 'garage' | 'users' | 'supabase'
  const [activeNav, setActiveNav] = useState('overview');

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
  const [orderStatusFilter, setOrderStatusFilter] = useState('All'); // 'All' | 'Pending Approval' | 'Processing' | 'Ready for Delivery' | 'Out for Delivery' | 'Delivery Failed' | 'Rescheduled' | 'Delivered' | 'Cancelled'
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
  const [deliveryTokenModal, setDeliveryTokenModal] = useState(null);
  const [riderAccessModal, setRiderAccessModal] = useState(null);

  // ─── INVENTORY STATE ───
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invStockFilter, setInvStockFilter] = useState('All'); // 'All' | 'inStock' | 'lowStock' | 'outOfStock'
  const [invCategoryFilter, setInvCategoryFilter] = useState('All');
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
  const [restockSelectedColor, setRestockSelectedColor] = useState(''); // chosen color label or ''
  const [suppliers, setSuppliers] = useState(() =>
    supplierService && supplierService.getSuppliers ? supplierService.getSuppliers() : []
  );
  const [supplierPurchases, setSupplierPurchases] = useState(() =>
    productService.getSupplierPurchases ? productService.getSupplierPurchases() : []
  );

  // ─── POS STATE ───
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState('All');
  const [posCart, setPosCart] = useState([]);
  const [posSelectedCustomer, setPosSelectedCustomer] = useState({ id: 'walkin', name: 'Walk-in Customer', phone: 'N/A' });
  const [posCustomerDropdownOpen, setPosCustomerDropdownOpen] = useState(false);
  const [posPaymentMethod, setPosPaymentMethod] = useState('Cash'); // 'Cash' | 'Card' | 'GCash' | 'Bank'
  const [posTendered, setPosTendered] = useState('');
  const [posDiscountCode, setPosDiscountCode] = useState('');
  const [posDiscountPercent, setPosDiscountPercent] = useState(0);
  const [posReceiptOrder, setPosReceiptOrder] = useState(null);
  const [posSizePickerProduct, setPosSizePickerProduct] = useState(null);
  const [posSelectedSize, setPosSelectedSize] = useState('');

  // ─── ANALYTICS STATE ───
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'all'

  // ─── PRODUCTS & PRICE MANAGEMENT STATE ───
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  // ─── GARAGE STATE ───
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
  const [garageSubTab, setGarageSubTab] = useState('bookings');
  const [garageBookings, setGarageBookings] = useState([]);
  const [garageMechanics, setGarageMechanics] = useState(() => garageService.getMechanics());
  const [selectedBookingForApproval, setSelectedBookingForApproval] = useState(null);
  const [selectedMechanicForApproval, setSelectedMechanicForApproval] = useState('');

  // ─── RIDERS / DELIVERY STAFF STATE ───
  const [deliveryRiders, setDeliveryRiders] = useState(() => riderService.getRiders());
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const [riderFilterStatus, setRiderFilterStatus] = useState('All');
  const [isAddRiderModalOpen, setIsAddRiderModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState(null);
  const [riderName, setRiderName] = useState('');
  const [riderShortName, setRiderShortName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderVehicle, setRiderVehicle] = useState('');
  const [riderPlate, setRiderPlate] = useState('');
  const [riderAvatar, setRiderAvatar] = useState(RIDER_AVATAR_PRESETS[0]);
  const [riderStatus, setRiderStatus] = useState(RIDER_STATUSES.AVAILABLE);
  const [riderNotes, setRiderNotes] = useState('');
  const [riderIdInput, setRiderIdInput] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [riderUsername, setRiderUsername] = useState('');
  const [riderPassword, setRiderPassword] = useState('');
  const [riderAccountStatus, setRiderAccountStatus] = useState(RIDER_ACCOUNT_STATUSES.ACTIVE);

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

  // ─── SYSTEM SETTINGS STATE ───
  const [systemSettings, setSystemSettings] = useState(() => systemSettingsService.getSettings());
  const [setForm, setSetForm] = useState(() => ({ ...systemSettingsService.getSettings() }));
  const [settingsActiveSubTab, setSettingsActiveSubTab] = useState('general'); // 'general' | 'operations' | 'garage' | 'maintenance'
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      setSystemSettings(updated);
      setSetForm({ ...updated });
    });
    return () => unsub?.();
  }, []);

  const handleUpdateSettingField = (field, value) => {
    setSetForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSystemSettings = () => {
    setIsSavingSettings(true);
    const res = systemSettingsService.saveSettings(setForm);
    setIsSavingSettings(false);
    if (res.success) {
      setSystemSettings(res.settings);
      showToast('✓ System settings deployed successfully! ⚙️');
    } else {
      showToast('⚠️ Error saving settings: ' + res.error);
    }
  };

  const handleResetSystemSettings = () => {
    const proceed = () => {
      const res = systemSettingsService.resetToDefaults();
      if (res.success) {
        setSetForm({ ...res.settings });
        setSystemSettings(res.settings);
        showToast('✓ Restored project factory presets! ⚙️');
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Reset all system settings to project defaults?')) proceed();
    } else {
      Alert.alert('Reset Settings', 'Reset all system settings to project defaults?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Defaults', style: 'destructive', onPress: proceed },
      ]);
    }
  };

  const handleClearCache = () => {
    systemSettingsService.clearSystemCache();
    showToast('✓ Non-critical system caches cleared.');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title ? title + ': ' : ''}${message}`);
    } else {
      Alert.alert(title || 'Notice', message);
    }
  };

  const resetGaragePackageForm = () => {
    setEditingGarageService(null);
    setServTitle('');
    setServSubtitle('');
    setServCategory('PMS');
    setServPrice('');
    setServDuration('');
    setServBadge('');
    setServImage('');
    setServDesc('');
    setServInclusions('');
  };

  const handleSaveGarageService = async () => {
    if (!servTitle.trim() || !servPrice.trim()) {
      showAlert('Required Fields', 'Please enter a package title and price.');
      return;
    }
    const priceNum = Number(servPrice) || 0;
    if (editingGarageService) {
      await garageService.updateService(editingGarageService.id || editingGarageService.service_id, {
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
      showToast(`Package "${servTitle}" updated.`);
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
      showToast(`Package "${servTitle}" added to the shop catalog.`);
    }
    setGarageServices(garageService.getServices());
    setIsAddGarageOpen(false);
    resetGaragePackageForm();
  };

  const handleAdvisorApprove = async (bookingId, mechanic) => {
    const assigned = mechanic || selectedMechanicForApproval || garageMechanics[0]?.name || 'Pending Assignment';
    const updated = await garageService.approveBooking(bookingId, assigned);
    setGarageBookings(updated);
    setSelectedBookingForApproval(null);
    showToast(`Booking #${bookingId} approved.`);
  };

  const handleAdvisorReject = async (bookingId) => {
    const updated = await garageService.rejectBooking(bookingId, 'Schedule or bay not available');
    setGarageBookings(updated);
    setSelectedBookingForApproval(null);
    showToast(`Booking #${bookingId} declined.`);
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
      await garageService.fetchMechanics();
      const bks = await garageService.getAllBookings();
      setGarageBookings(bks || []);
      setGarageMechanics(garageService.getMechanics());
    } catch (_e) {
      setGarageBookings(garageService.getLocalBookings());
    }

    try {
      const riders = await riderService.fetchRiders();
      setDeliveryRiders(riders || []);
    } catch (_e) {
      setDeliveryRiders(riderService.getRiders());
    }

    const creds = supabaseManager.getCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseKey(creds.key);
  };

  useEffect(() => {
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
    const unsubscribeGarage = garageService.subscribe((srvs) => {
      if (Array.isArray(srvs)) setGarageServices(srvs);
    });
    const unsubscribeBookings = garageService.subscribeBookings((bks) => {
      if (Array.isArray(bks)) setGarageBookings(bks);
    });
    return () => {
      unsubscribeProd();
      unsubscribeOrders();
      unsubscribeDeliveries?.();
      unsubscribeRiders?.();
      unsubscribeGarage?.();
      unsubscribeBookings?.();
    };
  }, []);

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
      const matchCat = invCategoryFilter === 'All' || p.category.toLowerCase() === invCategoryFilter.toLowerCase();
      const q = invSearchQuery.toLowerCase().trim();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));

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
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: Math.max(0, (p.stock || 0) + delta) } : p)));
      showToast(`Stock updated: ${delta > 0 ? '+' + delta : delta} unit(s) 📦`);
    }
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

  const handleExecuteRestock = async () => {
    if (!restockModalProduct) {
      showAlert('Select Product', 'Choose a product to restock first.');
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
      if (restockSelectedColor) {
        const qty = parseInt(restockAmount, 10);
        if (isNaN(qty) || qty <= 0) {
          showAlert('Invalid Quantity', `Please enter a valid positive purchase quantity for color "${restockSelectedColor}".`);
          return;
        }
        amountNum = qty;
        colorDeltas = [{ label: restockSelectedColor, quantity: qty }];
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
    const colorNote = hasColors && restockSelectedColor ? ` (Color: ${restockSelectedColor})` : '';
    const variantNote = sizeNote || colorNote;

    const productName = restockModalProduct.name;
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
    showToast(
      `Purchase saved${variantNote} · Expense ₱${res.purchase.expense.toLocaleString()} · Profit ₱${res.purchase.profitPerUnit.toLocaleString()}/pc`
    );
    showAlert(
      'Purchase Complete',
      `"${productName}"${variantNote}\n\nExpense: ₱${res.purchase.expense.toLocaleString()}\nProfit/unit: ₱${res.purchase.profitPerUnit.toLocaleString()} (${res.purchase.margin.toFixed(1)}%)\nIf all sell: ₱${res.purchase.expectedProfit.toLocaleString()}`
    );
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
      const matchCat = posCategoryFilter === 'All' || p.category.toLowerCase() === posCategoryFilter.toLowerCase();
      const q = posSearchQuery.toLowerCase().trim();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [products, posSearchQuery, posCategoryFilter]);

  const addPOSLine = (product, size = '') => {
    if (product.stock <= 0) {
      showToast('⚠️ Product is Out of Stock!');
      return;
    }
    const lineId = cartLineKey(product.id, size);
    const unitPrice = size ? getSizePrice(product, size) : Number(product.price) || 0;
    const displayName = size ? `${product.name} [${size}]` : product.name;

    setPosCart((prev) => {
      const existing = prev.find((item) => item.id === lineId);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showToast(`⚠️ Only ${product.stock} units available in inventory.`);
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
    showToast(`Added "${displayName.slice(0, 18)}..." to POS Cart 🛒`);
  };

  const handlePOSAddToCart = (product) => {
    if (product.stock <= 0) {
      showToast('⚠️ Product is Out of Stock!');
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
      showToast('⚠️ Select a size first');
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
              showToast(`⚠️ Max stock limit reached (${item.stock})`);
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
      showToast(`🎟️ Voucher Applied: ${found.discountPercent}% OFF!`);
    } else {
      setPosDiscountPercent(0);
      showToast('⚠️ Invalid or expired promo voucher code.');
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
      showAlert('Insufficient Tender', `Amount tendered (₱${posTenderedNum.toFixed(2)}) is less than the total balance due (₱${posGrandTotal.toFixed(2)}).`);
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
      showToast('🎉 POS Sale Completed! Receipt generated.');
    } else {
      showToast(res.error || 'POS sale failed');
    }
  };

  // ─── ANALYTICS DATA COMPUTATIONS ───
  const analyticsData = useMemo(() => {
    const allOrders = orders || [];
    const posOrders = allOrders.filter((o) => o.channel === 'POS (In-Store)');
    const onlineOrders = allOrders.filter((o) => o.channel !== 'POS (In-Store)');

    const totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0), 0);
    const posRevenue = posOrders.reduce((sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0), 0);
    const onlineRevenue = onlineOrders.reduce((sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0), 0);

    const aov = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;
    const totalItemsSold = allOrders.reduce((sum, o) => sum + (Number(o.items_count) || (Array.isArray(o.items) ? o.items.length : 1)), 0);

    // Category Revenue calculation
    const categoryTotals = {};
    CATEGORY_NAMES.forEach((cat) => (categoryTotals[cat] = 0));

    allOrders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((it) => {
          const cat = it.category || 'Accessories';
          const lineTotal = (Number(it.price) || 0) * (Number(it.quantity) || 1);
          categoryTotals[cat] = (categoryTotals[cat] || 0) + lineTotal;
        });
      }
    });

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
      .map((tp) => {
        const match = products?.find((p) => (p.name || p.title) === tp.name);
        return { ...tp, image_url: match ? match.image_url || match.imageUrl || match.image : null };
      });

    // Trend Simulation for 7 periods
    const trendBars = [
      { label: 'Mon', revenue: totalRevenue * 0.12 },
      { label: 'Tue', revenue: totalRevenue * 0.15 },
      { label: 'Wed', revenue: totalRevenue * 0.11 },
      { label: 'Thu', revenue: totalRevenue * 0.18 },
      { label: 'Fri', revenue: totalRevenue * 0.22 },
      { label: 'Sat', revenue: totalRevenue * 0.28 },
      { label: 'Sun', revenue: totalRevenue * 0.25 },
    ];
    const maxBarRevenue = Math.max(...trendBars.map((b) => b.revenue), 1000);

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
      paymentBreakdown,
      topProducts,
      trendBars,
      maxBarRevenue,
    };
  }, [orders, products]);

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

  const handleDeleteProduct = async (id, name) => {
    const targetId = id;
    const proceed = async () => {
      await productService.deleteProduct(targetId);
      setProducts((prev) => prev.filter((p) => p.id !== targetId && p.product_id !== targetId));
      showToast(`Removed product "${name.slice(0, 18)}..."`);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to remove "${name}"?`)) {
        await proceed();
      }
    } else {
      Alert.alert('Delete Product', `Are you sure you want to remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: proceed },
      ]);
    }
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

  const handleDeletePromo = async (code) => {
    await promoService.deletePromo(code);
    setPromos((prev) => prev.filter((p) => p.code !== code));
    showToast(`Deleted promo code ${code}`);
  };

  // ─── USER ACTIONS ───
  const handleToggleUserRole = async (userId, currentRole) => {
    const newRole =
      currentRole === 'admin' ? 'user' : currentRole === 'mechanic' ? 'admin' : 'mechanic';
    await userService.updateUserRole(userId, newRole);
    await loadData();
    showToast(
      `Updated user role to ${
        newRole === 'admin' ? 'Store Administrator' : newRole === 'mechanic' ? 'Mechanic' : 'Customer'
      }`
    );
  };

  const handleDeleteUser = async (userId, name) => {
    if (userId === currentUser?.id) {
      showAlert('Notice', 'You cannot delete your own active administrator account.');
      return;
    }
    await userService.deleteUser(userId);
    await loadData();
    showToast(`Deleted user account "${name}"`);
  };

  // ─── RIDER / DELIVERY STAFF ACTIONS ───
  const filteredRiders = useMemo(() => {
    return deliveryRiders.filter((r) => {
      const q = riderSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.shortName || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.vehicleInfo || '').toLowerCase().includes(q) ||
        (r.plateNumber || '').toLowerCase().includes(q);
      const matchesStatus = riderFilterStatus === 'All' || r.status === riderFilterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [deliveryRiders, riderSearchQuery, riderFilterStatus]);

  const resetRiderForm = () => {
    setRiderName('');
    setRiderShortName('');
    setRiderPhone('');
    setRiderVehicle('');
    setRiderPlate('');
    setRiderAvatar(RIDER_AVATAR_PRESETS[deliveryRiders.length % RIDER_AVATAR_PRESETS.length]);
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
    setRiderAvatar(rider.avatar || RIDER_AVATAR_PRESETS[0]);
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
      avatar: riderAvatar.trim() || RIDER_AVATAR_PRESETS[0],
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
      avatar: riderAvatar.trim() || RIDER_AVATAR_PRESETS[0],
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
    const doDelete = async () => {
      const res = await riderService.deleteRider(rider.id);
      if (res.success) {
        setDeliveryRiders(riderService.getRiders());
        showToast(`Removed ${rider.shortName || rider.name} from roster.`);
      } else {
        showAlert('Error', res.error || 'Failed to delete rider.');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Remove ${rider.name} from the delivery staff roster?`)) {
        doDelete();
      }
    } else {
      Alert.alert('Remove Delivery Rider', `Remove ${rider.name} from the roster?`, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    }
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

  // ─── ORDER COMPUTATIONS & ACTIONS ───
  const pendingCodOrders = useMemo(() => {
    return orders.filter((o) => {
      const isCOD = (o.payment_method || '').toLowerCase().includes('cash') || (o.payment_method || '').includes('COD');
      const isPending = (o.status || '').toLowerCase().includes('pending') || (o.status || '').toLowerCase().includes('approval');
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
    const failed = orders.filter((o) => (o.status || '').toLowerCase() === 'delivery failed').length;
    const rescheduled = orders.filter((o) => (o.status || '').toLowerCase() === 'rescheduled').length;
    const delivered = orders.filter(
      (o) => (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed'
    ).length;
    const cancelled = orders.filter((o) => (o.status || '').toLowerCase() === 'cancelled').length;
    const totalRevenue = orders
      .filter((o) => (o.status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0), 0);

    return { total, pendingCod, processing, ready, shipped, failed, rescheduled, delivered, cancelled, totalRevenue };
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
      else if (orderPaymentFilter === 'Card') matchPayment = pm.includes('card') || pm.includes('apple');
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
        colorBg: '#E0F2FE',
        borderColor: '#BAE6FD',
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
        colorBg: '#ECFDF5',
        borderColor: '#A7F3D0',
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
        colorBg: '#F5F3FF',
        borderColor: '#DDD6FE',
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
      showToast(`✅ Approved COD Order #${orderId.slice(0, 10)}! Moved to Packing.`);
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
    showToast(`✅ Approved all ${pendingCodOrders.length} pending COD orders!`);
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
    Alert.alert(
      'Reject Customer Order?',
      `Are you sure you want to reject Order #${orderId}? The order will be cancelled and reserved items returned to inventory.`,
      [
        { text: 'Keep Order Active', style: 'cancel' },
        {
          text: 'Yes, Reject Order',
          style: 'destructive',
          onPress: async () => {
            const res = await orderService.cancelOrder(orderId, 'Rejected by admin', { admin: true });
            if (!res.success) {
              showToast(res.error || 'Reject failed');
              return;
            }
            await loadData();
            if (isOrderModalOpen) setIsOrderModalOpen(false);
            showToast(`Order #${orderId.slice(0, 10)} has been rejected.`);
          },
        },
      ]
    );
  };

  const handleCancelOrder = async (orderId) => {
    const proceed = async () => {
      const res = await orderService.cancelOrder(orderId, 'Cancelled by admin', { admin: true });
      if (!res.success) {
        showToast(res.error || 'Cancel failed');
        return;
      }
      await loadData();
      if (isOrderModalOpen) setIsOrderModalOpen(false);
      showToast(`Order #${orderId.slice(0, 10)} cancelled.`);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to cancel Order #${orderId}? Reserved stock will be returned to inventory.`)) {
        await proceed();
      }
    } else {
      Alert.alert(
        'Cancel Order',
        `Are you sure you want to cancel Order #${orderId}? Reserved stock will be returned to inventory.`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes, Cancel Order', style: 'destructive', onPress: proceed },
        ]
      );
    }
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
      const matchCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [products, selectedCategory, searchQuery]);

  const navTitles = {
    overview: '📊 Dashboard',
    orders: '📦 Orders Fulfillment Management',
    inventory: '📦 Inventory Telemetry',
    pos: '💻 Point of Sale (POS) Cashier Terminal',
    analytics: '📈 Sales Analytics',
    forecast: '📊 Sales Forecast Optimization',
    products: '🏷️ Products & Price Management',
    promos: '🎟️ Promo Vouchers & Discounts',
    garage: '🛠️ Bookings (PMS & Tuning)',
    riders: '🛵 Riders / Delivery Staff',
    users: '👥 Users Management',
    supabase: '⚡ Supabase Database Settings',
    notifications: '🔔 Notifications & Alerts Center',
    settings: '⚙️ System & Platform Settings',
  };

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'android' && { paddingTop: 35 }]}>
      <StatusBar style="dark" />
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
            <View style={styles.sidebarBrandRow}>
              <Text style={styles.sidebarLogo}>
                Moto<Text style={styles.sidebarLogoAccent}>Track</Text>
              </Text>
              <View style={styles.adminTagBadge}>
                <Text style={styles.adminTagBadgeText}>Admin</Text>
              </View>
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
                  <Text style={styles.adminAvatarText}>A</Text>
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
                    <BootstrapIcon name="grid-1x2-fill" size={16} color={activeNav === 'overview' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'overview' && styles.sidebarNavLabelActive]}>
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
                    <BootstrapIcon name="receipt" size={16} color={activeNav === 'orders' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'orders' && styles.sidebarNavLabelActive]}>
                    Orders & COD
                  </Text>
                  {pendingCodCount > 0 ? (
                    <AlertOrangeDot
                      count={pendingCodCount}
                      label="COD"
                      title={`${pendingCodCount} Pending COD Orders`}
                    />
                  ) : (
                    <View style={[styles.sidebarCountBadge, activeNav === 'orders' && styles.sidebarCountBadgeActive]}>
                      <Text style={[styles.sidebarCountText, activeNav === 'orders' && styles.sidebarCountTextActive]}>
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
                    <BootstrapIcon name="box-seam-fill" size={16} color={activeNav === 'inventory' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'inventory' && styles.sidebarNavLabelActive]}>
                    Inventory & Stock
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
                    <BootstrapIcon name="cart-check-fill" size={16} color={activeNav === 'pos' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'pos' && styles.sidebarNavLabelActive]}>
                    POS Cashier
                  </Text>
                  {posCart.length > 0 && (
                    <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' }}>{posCart.length}</Text>
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
                    <BootstrapIcon name="graph-up-arrow" size={16} color={activeNav === 'analytics' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'analytics' && styles.sidebarNavLabelActive]}>
                    Analytics & Reports
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
                    <BootstrapIcon name="clipboard-data" size={16} color={activeNav === 'forecast' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'forecast' && styles.sidebarNavLabelActive]}>
                    Forecast & Stock
                  </Text>
                  {activeNav === 'forecast' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'customizations' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('customizations')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="magic" size={16} color={activeNav === 'customizations' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'customizations' && styles.sidebarNavLabelActive]}>
                    Customizations
                  </Text>
                  {activeNav === 'customizations' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                <Text style={styles.navHeading}>STORE MANAGEMENT</Text>

                {/* 6. Products */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'products' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('products')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="tag-fill" size={16} color={activeNav === 'products' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'products' && styles.sidebarNavLabelActive]}>
                    Products
                  </Text>
                  <View style={[styles.sidebarCountBadge, activeNav === 'products' && styles.sidebarCountBadgeActive]}>
                    <Text style={[styles.sidebarCountText, activeNav === 'products' && styles.sidebarCountTextActive]}>
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
                    <BootstrapIcon name="ticket-perforated-fill" size={16} color={activeNav === 'promos' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'promos' && styles.sidebarNavLabelActive]}>
                    Promo Vouchers
                  </Text>
                  {activeNav === 'promos' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 3: GARAGE & SERVICES ─── */}
                <Text style={styles.navHeading}>GARAGE & SERVICES</Text>

                {/* 8. Garage */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'garage' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('garage')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="tools" size={16} color={activeNav === 'garage' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'garage' && styles.sidebarNavLabelActive]}>
                    Bookings
                  </Text>
                  {activeNav === 'garage' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 8.5 Riders / Delivery Staff */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'riders' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('riders')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="bicycle" size={16} color={activeNav === 'riders' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'riders' && styles.sidebarNavLabelActive]}>
                    Riders
                  </Text>
                  <View style={[styles.sidebarCountBadge, activeNav === 'riders' && styles.sidebarCountBadgeActive]}>
                    <Text style={[styles.sidebarCountText, activeNav === 'riders' && styles.sidebarCountTextActive]}>
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
                    <BootstrapIcon name="people-fill" size={16} color={activeNav === 'users' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'users' && styles.sidebarNavLabelActive]}>
                    User Accounts
                  </Text>
                  {activeNav === 'users' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 5: SYSTEM & SETTINGS ─── */}
                <Text style={styles.navHeading}>SYSTEM & SETTINGS</Text>

                {/* 10. Notifications Center */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'notifications' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('notifications')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon
                      name="bell-fill"
                      size={16}
                      color={activeNav === 'notifications' ? '#FFFFFF' : '#64748B'}
                    />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'notifications' && styles.sidebarNavLabelActive]}>
                    Notifications
                  </Text>
                  {activeNav === 'notifications' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* 11. Supabase DB */}
                <TouchableOpacity
                  style={[styles.sidebarNavItem, activeNav === 'supabase' && styles.sidebarNavItemActive]}
                  onPress={() => setActiveNav('supabase')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="database-fill-gear" size={16} color={activeNav === 'supabase' ? '#FFFFFF' : '#64748B'} />
                  </View>
                  <Text style={[styles.sidebarNavLabel, activeNav === 'supabase' && styles.sidebarNavLabelActive]}>
                    Supabase DB
                  </Text>
                  {activeNav === 'supabase' && <View style={styles.sidebarActiveDot} />}
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
                  <Text style={[styles.sidebarNavLabel, activeNav === 'settings' && styles.sidebarNavLabelActive]}>
                    System Settings
                  </Text>
                  {activeNav === 'settings' && <View style={styles.sidebarActiveDot} />}
                </TouchableOpacity>

                {/* ─── SECTION 6: QUICK LINKS ─── */}
                <Text style={styles.navHeading}>QUICK LINKS</Text>

                {/* 13. Live Storefront Link */}
                <TouchableOpacity style={styles.sidebarNavItem} onPress={onNavigateToStore} activeOpacity={0.8}>
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="shop" size={16} color="#1D4533" />
                  </View>
                  <Text style={[styles.sidebarNavLabel, { color: '#1D4533', fontWeight: '800' }]}>Live Storefront</Text>
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
                style={[styles.logoutSidebarBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                onPress={onLogout}
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
          <View style={[styles.topContentBar, !isDesktop && { paddingHorizontal: 16, paddingVertical: 10 }]}>
            <Text style={[styles.pageBreadcrumbTitle, !isDesktop && { fontSize: 16 }]}>{navTitles[activeNav] || 'Admin Console'}</Text>

            <View style={styles.topActionsRow}>
              {activeNav === 'orders' && pendingCodCount > 0 && (
                <TouchableOpacity
                  style={[styles.addBtnPrimary, { backgroundColor: '#1D4533' }]}
                  onPress={handleApproveAllPendingCOD}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>
                    {isDesktop ? `Approve All COD (${pendingCodCount})` : `Approve All (${pendingCodCount})`}
                  </Text>
                </TouchableOpacity>
              )}
              {activeNav === 'inventory' && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={[styles.addBtnPrimary, { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' }]}
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
                    <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add New Product SKU' : '+ SKU'}</Text>
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
                    resetGaragePackageForm();
                    setGarageSubTab('packages');
                    setIsAddGarageOpen(true);
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add Service Package' : '+ Package'}</Text>
                </TouchableOpacity>
              )}
              {activeNav === 'riders' && (
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={handleOpenAddRider}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person-plus-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add Rider' : '+ Rider'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => setActiveNav('notifications')}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="bell-fill" size={13} color="#1D4533" />
                {isDesktop && <Text style={styles.quickStoreBtnText}>Notifications</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickStoreBtn} onPress={onNavigateToStore}>
                <BootstrapIcon name="box-arrow-up-right" size={12} color="#1D4533" />
                {isDesktop && <Text style={styles.quickStoreBtnText}>Storefront</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: '#FEE2E2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  paddingHorizontal: isDesktop ? 14 : 10,
                  paddingVertical: 8,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
                onPress={onLogout}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="box-arrow-right" size={13} color="#DC2626" />
                {isDesktop && <Text style={{ color: '#DC2626', fontSize: 12.5, fontWeight: '800' }}>Log Out</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={[styles.mainScroll, !isDesktop && { paddingBottom: 110, paddingHorizontal: 12 }]}>
            {/* ─── TAB 1: OVERVIEW ─── */}
            {/* ─── TAB 1: DASHBOARD (STORE DASHBOARD & ACTIVITY) ─── */}
            {activeNav === 'overview' && (
              <View>
                {/* 1. Executive Dashboard Header & Live Telemetry Bar */}
                <View
                  style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: isDesktop ? 'center' : 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 24,
                    paddingBottom: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E2E8F0',
                  }}
                >
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text
                        style={{
                          fontSize: isDesktop ? 24 : 20,
                          fontWeight: '800',
                          color: '#0F172A',
                          letterSpacing: -0.5,
                        }}
                      >
                        Operations Overview
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: '#ECFDF5',
                          paddingHorizontal: 9,
                          paddingVertical: 3.5,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: '#A7F3D0',
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#10B981',
                          }}
                        />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>
                          Live
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' }}>
                      Real-time store orders, inventory health, and garage service telemetry
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      alignSelf: isDesktop ? 'auto' : 'stretch',
                      justifyContent: isDesktop ? 'flex-end' : 'space-between',
                      flexWrap: 'wrap',
                    }}
                  >
                    <TouchableOpacity
                      onPress={loadData}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 13,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      <BootstrapIcon name="arrow-repeat" size={13} color="#475569" />
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155' }}>
                        Refresh
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setActiveNav('pos')}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: '#0F172A',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <BootstrapIcon name="cart-plus" size={13} color="#FFFFFF" />
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>
                        POS Cashier
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Primary KPI Stat Cards */}
                <View style={styles.statsGrid}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    icon="bag-check"
                    label="Total Orders"
                    value={orderStats.total}
                    trend="+8.2%"
                    trendPositive={true}
                    sub={`₱${orderStats.totalRevenue.toLocaleString()} volume`}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={orderStats.pendingCod > 0 ? 'amber' : 'blue'}
                    icon="clock-history"
                    label="Pending COD Approvals"
                    value={orderStats.pendingCod}
                    valueColor={orderStats.pendingCod > 0 ? '#D97706' : undefined}
                    trend={orderStats.pendingCod > 0 ? 'Action required' : 'Clear'}
                    trendPositive={orderStats.pendingCod === 0}
                    sub="Requires Admin action"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    icon="box-seam"
                    label="Packing & Processing"
                    value={orderStats.processing}
                    sub="Ready for courier pickup"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="amber"
                    icon="layers"
                    label="Total Inventory Value"
                    value={`₱${invStats.totalValue.toLocaleString()}`}
                    sub={`Across ${invStats.totalUnits} items in stock`}
                  />
                </View>

                {/* Secondary Store Telemetry Cards */}
                <View style={[styles.statsGrid, { marginTop: -4 }]}>
                  <AdminStatCard
                    styles={styles}
                    accent="teal"
                    icon="cash-stack"
                    label="Total Store Revenue"
                    value={`₱${analyticsData.totalRevenue.toLocaleString()}`}
                    trend="+12.4%"
                    trendPositive={true}
                    sub="Online + Walk-in POS"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="blue"
                    icon="tag"
                    label="Active SKUs"
                    value={products.length}
                    sub={`${invStats.totalUnits} total units in stock`}
                  />
                  <AdminStatCard
                    styles={styles}
                    accent={invStats.lowStockCount > 0 ? 'amber' : 'teal'}
                    icon="exclamation-triangle"
                    label="Stock Alerts"
                    value={`${invStats.lowStockCount} Low`}
                    valueColor={invStats.lowStockCount > 0 ? '#D97706' : undefined}
                    sub="Needs reorder attention"
                  />
                  <AdminStatCard
                    styles={styles}
                    accent="green"
                    icon="graph-up-arrow"
                    label="Sales Profit"
                    value={`₱${profitOverview.soldProfit.toLocaleString()}`}
                    trend={`${profitOverview.soldMargin.toFixed(1)}% margin`}
                    trendPositive={profitOverview.soldMargin >= 15}
                    sub={`Sold cost ₱${profitOverview.soldCost.toLocaleString()}`}
                  />
                </View>

                {/* 3. REVENUE TREND Sparkline Banner */}
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    paddingVertical: 28,
                    paddingHorizontal: 26,
                    marginBottom: 24,
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
                    {/* Left Metric */}
                    <View style={{ minWidth: 180 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.1 }}>
                        REVENUE TREND
                      </Text>
                      <Text style={{ fontSize: 32, fontWeight: '800', color: '#0F172A', marginTop: 6, letterSpacing: -0.8 }}>
                        ₱{analyticsData.totalRevenue.toLocaleString()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <BootstrapIcon name="arrow-up-right" size={12} color="#10B981" />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#10B981' }}>
                          +12.4% vs previous period
                        </Text>
                      </View>
                    </View>

                    {/* Center Sparkline */}
                    <View style={{ flex: 1, minWidth: 240, height: 48, justifyContent: 'center' }}>
                      <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: '78%', backgroundColor: '#10B981', borderRadius: 3 }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>30 Days Ago</Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>Today</Text>
                      </View>
                    </View>

                    {/* Right Stats Breakdown */}
                    <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
                      <View style={{ minWidth: 84 }}>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Online</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 4 }}>
                          ₱{analyticsData.onlineRevenue.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 12 }}>Orders</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
                          {orders.length}
                        </Text>
                      </View>
                      <View style={{ minWidth: 84 }}>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>POS</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 4 }}>
                          ₱{analyticsData.posRevenue.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 12 }}>Delivered</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
                          {orderStats.delivered}
                        </Text>
                      </View>
                      <View style={{ minWidth: 84 }}>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Margin</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 4 }}>
                          {profitOverview.soldMargin.toFixed(1)}%
                        </Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 12 }}>Pending</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: pendingCodCount > 0 ? '#D97706' : '#0F172A', marginTop: 2 }}>
                          {pendingCodCount}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 3b. EXECUTIVE ANALYTICS: SERVICE BOOKINGS & TOP EARNER PRODUCTS */}
                <View style={{ marginBottom: 24 }}>
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
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                            <BootstrapIcon name="trophy-fill" size={14} color="#D97706" />
                            <Text style={[styles.analyticsCardTitle, { color: '#0F172A', fontSize: 16, fontWeight: '800' }]}>
                              Top Earners
                            </Text>
                          </View>
                          <Text style={[styles.analyticsCardSubtitle, { color: '#64748B', marginTop: 3, fontSize: 12 }]}>
                            Ranked by cumulative sales volume
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setActiveNav('products')}
                          activeOpacity={0.8}
                          style={{
                            paddingHorizontal: 11,
                            paddingVertical: 5.5,
                            backgroundColor: '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                          }}
                        >
                          <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600' }}>
                            View products →
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {analyticsData.topProducts.length === 0 ? (
                        <View style={{ paddingVertical: 36, alignItems: 'center', justifyContent: 'center' }}>
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: '#F8FAFC',
                              borderWidth: 1,
                              borderColor: '#E2E8F0',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 10,
                            }}
                          >
                            <BootstrapIcon name="box-seam" size={20} color="#94A3B8" />
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                            No Product Sales Yet
                          </Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3, textAlign: 'center', maxWidth: 240 }}>
                            As orders are fulfilled, top grossing catalog items will automatically appear here.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 4, gap: 14 }}>
                          {analyticsData.topProducts.map((tp, idx) => {
                            const maxRev = analyticsData.topProducts[0]?.revenue || 1;
                            const barWidth = Math.max(5, (tp.revenue / maxRev) * 100);
                            const rankBadges = [
                              { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
                              { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
                              { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' },
                            ];
                            const badge = rankBadges[idx] || {
                              bg: '#F8FAFC',
                              text: '#64748B',
                              border: '#E2E8F0',
                            };

                            return (
                              <View
                                key={idx}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingVertical: 2,
                                }}
                              >
                                <View
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: badge.bg,
                                    borderWidth: 1,
                                    borderColor: badge.border,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: badge.text }}>
                                    #{idx + 1}
                                  </Text>
                                </View>

                                <View
                                  style={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
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
                                      color="#94A3B8"
                                    />
                                  )}
                                </View>

                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: 6,
                                    }}
                                  >
                                    <View style={{ flex: 1, marginRight: 12 }}>
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          fontWeight: '700',
                                          color: '#0F172A',
                                        }}
                                        numberOfLines={1}
                                      >
                                        {tp.name}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: 11.5,
                                          color: '#64748B',
                                          marginTop: 1,
                                        }}
                                      >
                                        {tp.brand || 'MotoTrack'} • {tp.unitsSold || 0} sold
                                      </Text>
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 13.5,
                                        fontWeight: '800',
                                        color: '#0F172A',
                                      }}
                                    >
                                      ₱{tp.revenue.toLocaleString()}
                                    </Text>
                                  </View>

                                  <View
                                    style={{
                                      height: 4,
                                      backgroundColor: '#F1F5F9',
                                      borderRadius: 2,
                                      width: '100%',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <View
                                      style={{
                                        height: '100%',
                                        width: `${barWidth}%`,
                                        backgroundColor: '#0F172A',
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
                      borderColor: '#E2E8F0',
                      backgroundColor: '#FFFFFF',
                      overflow: 'hidden',
                      marginBottom: 24,
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 2,
                    },
                  ]}
                >
                  <View
                    style={{
                      paddingHorizontal: 22,
                      paddingVertical: 18,
                      borderBottomWidth: 1,
                      borderBottomColor: '#E2E8F0',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                        Recent Orders & POS Sales
                      </Text>
                      <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                        Latest transactions across all sales channels
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActiveNav('orders')}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>
                        View All Orders ({orders.length}) →
                      </Text>
                    </TouchableOpacity>
                  </View>

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
                          paddingHorizontal: 22,
                          paddingVertical: 12,
                          backgroundColor: '#F8FAFC',
                          borderBottomWidth: 1,
                          borderBottomColor: '#E2E8F0',
                        }}
                      >
                        <Text style={{ flex: 2.2, fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>ORDER REF</Text>
                        <Text style={{ flex: 2.5, fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>CUSTOMER</Text>
                        <Text style={{ flex: 1.8, fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>CHANNEL</Text>
                        <Text style={{ flex: 1.6, fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>AMOUNT</Text>
                        <Text style={{ flex: 1.6, fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' }}>STATUS</Text>
                      </View>

                      {/* Empty State */}
                      {orders.length === 0 ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="receipt" size={28} color="#CBD5E1" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 10 }}>
                            No Orders Found
                          </Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                            New customer orders and POS checkouts will show up here in real time.
                          </Text>
                        </View>
                      ) : (
                        /* Rows */
                        orders.slice(0, 6).map((o, idx) => {
                          const orderId = o.order_id || o.id || `ORD-ON-2026-${String(idx + 1).padStart(5, '0')}`;
                          const rawChannel = String(o.channel || '').toLowerCase();
                          const isInStore = rawChannel.includes('pos') || rawChannel.includes('in-store') || rawChannel.includes('walk-in') || (rawChannel.includes('store') && !rawChannel.includes('online'));
                          const displayChannel = isInStore ? 'In Store' : 'Online Store';
                          const status = (o.status || 'Delivered').trim();
                          const statusLower = status.toLowerCase();
                          const isDelivered = statusLower === 'delivered' || statusLower === 'completed';
                          const isPending = statusLower.includes('pending');

                          return (
                            <View
                              key={orderId}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                width: '100%',
                                paddingHorizontal: 22,
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: '#F1F5F9',
                              }}
                            >
                              {/* ORDER REF: clean pill */}
                              <View style={{ flex: 2.2, paddingRight: 12 }}>
                                <View
                                  style={{
                                    alignSelf: 'flex-start',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3.5,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    backgroundColor: '#F8FAFC',
                                  }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 11.5,
                                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                      fontWeight: '600',
                                      color: '#475569',
                                    }}
                                  >
                                    {orderId}
                                  </Text>
                                </View>
                              </View>

                              {/* CUSTOMER & DATE */}
                              <View style={{ flex: 2.5, paddingRight: 12 }}>
                                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                                  {o.customer_name || 'Customer'}
                                </Text>
                                <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                                  {o.order_date || 'Recent'}
                                </Text>
                              </View>

                              {/* CHANNEL */}
                              <View style={{ flex: 1.8, paddingRight: 12 }}>
                                <View
                                  style={{
                                    alignSelf: 'flex-start',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    backgroundColor: isInStore ? '#ECFDF5' : '#F1F5F9',
                                    borderColor: isInStore ? '#A7F3D0' : '#E2E8F0',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isInStore ? '#047857' : '#475569',
                                    }}
                                  >
                                    {displayChannel}
                                  </Text>
                                </View>
                              </View>

                              {/* AMOUNT */}
                              <View style={{ flex: 1.6, paddingRight: 12 }}>
                                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                                  ₱{(Number(o.grand_total) || Number(o.total_amount) || 0).toLocaleString()}
                                </Text>
                              </View>

                              {/* STATUS */}
                              <View style={{ flex: 1.6, alignItems: 'center' }}>
                                <View
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 3.5,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    backgroundColor: isDelivered
                                      ? '#ECFDF5'
                                      : isPending
                                      ? '#FFFBEB'
                                      : '#EFF6FF',
                                    borderColor: isDelivered
                                      ? '#A7F3D0'
                                      : isPending
                                      ? '#FDE68A'
                                      : '#BFDBFE',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      color: isDelivered ? '#047857' : isPending ? '#B45309' : '#1D4ED8',
                                    }}
                                  >
                                    {isDelivered ? 'Delivered' : isPending ? 'Pending COD' : status}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </ScrollView>
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
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FDE68A', justifyContent: 'center', alignItems: 'center' }}>
                        <BootstrapIcon name="cash-coin" size={20} color="#92400E" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.codAlertBannerText}>
                          ⚠️ {pendingCodCount} Cash on Delivery order(s) awaiting approval
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
                <View style={[styles.toolbarRow, { zIndex: isPaymentDropdownOpen ? 99999 : 10, elevation: isPaymentDropdownOpen ? 99999 : 1 }]}>
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

                  {/* Payment Method Filter Dropdown */}
                  <View style={styles.paymentDropdownContainer}>
                    <TouchableOpacity
                      style={[
                        styles.paymentDropdownTrigger,
                        isPaymentDropdownOpen && styles.paymentDropdownTriggerActive,
                      ]}
                      onPress={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon
                          name={
                            orderPaymentFilter === 'COD'
                              ? 'cash'
                              : orderPaymentFilter === 'GCash'
                              ? 'phone-fill'
                              : orderPaymentFilter === 'Card'
                              ? 'credit-card-fill'
                              : 'credit-card'
                          }
                          size={13}
                          color={orderPaymentFilter !== 'All' ? '#1D4533' : '#64748B'}
                        />
                        <Text style={[styles.paymentDropdownTriggerText, orderPaymentFilter !== 'All' && { color: '#1D4533', fontWeight: '800' }]}>
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
                        color="#64748B"
                      />
                    </TouchableOpacity>

                    {isPaymentDropdownOpen && (
                      <>
                        <View style={styles.paymentDropdownMenu}>
                          <ScrollView
                            style={{ maxHeight: 200 }}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                          >
                            {[
                              { key: 'All', label: 'All Payments', emoji: '💳' },
                              { key: 'COD', label: 'COD Only', emoji: '💵' },
                              { key: 'GCash', label: 'GCash Express', emoji: '📱' },
                            ].map((option) => {
                              const isSelected = orderPaymentFilter === option.key;
                              return (
                                <TouchableOpacity
                                  key={option.key}
                                  style={[
                                    styles.paymentDropdownItem,
                                    isSelected && styles.paymentDropdownItemActive,
                                  ]}
                                  onPress={() => {
                                    setOrderPaymentFilter(option.key);
                                    setIsPaymentDropdownOpen(false);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={{ fontSize: 13 }}>{option.emoji}</Text>
                                    <Text
                                      style={[
                                        styles.paymentDropdownItemText,
                                        isSelected && styles.paymentDropdownItemTextActive,
                                      ]}
                                    >
                                      {option.label}
                                    </Text>
                                  </View>
                                  {isSelected && (
                                    <BootstrapIcon name="check2" size={14} color="#1D4533" />
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Status Tabs */}
                <View style={styles.orderFilterBar}>
                  {[
                    { key: 'All', label: `All Orders (${orderStats.total})` },
                    { key: 'Pending Approval', label: `⏳ Pending COD (${orderStats.pendingCod})`, highlight: orderStats.pendingCod > 0 },
                    { key: 'Processing', label: `⚙️ Processing (${orderStats.processing})` },
                    { key: 'Ready for Delivery', label: `📦 Ready (${orderStats.ready})` },
                    { key: 'Out for Delivery', label: `🚚 Out for Delivery (${orderStats.shipped})` },
                    { key: 'Delivery Failed', label: `⚠️ Failed (${orderStats.failed})` },
                    { key: 'Rescheduled', label: `🔄 Rescheduled (${orderStats.rescheduled})` },
                    { key: 'Delivered', label: `✅ Delivered (${orderStats.delivered})` },
                    { key: 'Cancelled', label: `❌ Cancelled (${orderStats.cancelled})` },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.orderFilterTab,
                        orderStatusFilter === tab.key && styles.orderFilterTabActive,
                        tab.highlight && orderStatusFilter !== tab.key && { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
                      ]}
                      onPress={() => setOrderStatusFilter(tab.key)}
                    >
                      <Text
                        style={[
                          styles.orderFilterTabText,
                          orderStatusFilter === tab.key && styles.orderFilterTabTextActive,
                          tab.highlight && orderStatusFilter !== tab.key && { color: '#B45309', fontWeight: '900' },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Orders List Table */}
                <View style={styles.tableCard}>
                  <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>
                      Orders Ledger ({filteredOrdersList.length} shown)
                    </Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={loadData}
                    >
                      <BootstrapIcon name="arrow-repeat" size={13} color="#1D4533" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>Refresh</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 1040 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 150 }]}>Order ID</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.0, minWidth: 160 }]}>Customer</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.6, minWidth: 200 }]}>Items Summary</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 95 }]}>Payment</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.1, minWidth: 95, textAlign: 'right' }]}>Total</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3, minWidth: 110, textAlign: 'center' }]}>Status</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, minWidth: 150, textAlign: 'center' }]}>Action</Text>
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
                          const isFailed = st === 'delivery failed';
                          const isRescheduled = st === 'rescheduled';
                          const isDelivered = st === 'delivered' || st === 'completed';
                          const isCancelled = st === 'cancelled';
                          const isCOD = (o.payment_method || '').toLowerCase().includes('cash') || (o.payment_method || '').includes('COD');
                          const statusLabel = isPending
                            ? 'Pending COD'
                            : isProcessing
                              ? 'Processing'
                              : isReady
                                ? 'Ready'
                                : isShipped
                                  ? 'Out for Delivery'
                                  : isFailed
                                    ? 'Failed'
                                    : isRescheduled
                                      ? 'Rescheduled'
                                      : isDelivered
                                        ? 'Delivered'
                                        : 'Cancelled';

                          return (
                            <View
                              key={displayOrderId || idx}
                              style={[
                                styles.tableRow,
                                isPending && { backgroundColor: '#FFFBEB' },
                              ]}
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
                                    borderColor: '#E2E8F0',
                                    backgroundColor: '#F8FAFC',
                                  }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontSize: 11.5,
                                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                      fontWeight: '800',
                                      color: '#0F172A',
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
                                  {o.items_summary || (o.items && o.items.length > 0 ? o.items.map(it => `${it.quantity || 1}x ${it.name}`).join(', ') : 'Motorcycle Parts')}
                                </Text>
                                <Text style={[styles.tableSub, { marginTop: 3 }]}>{o.items_count || (o.items ? o.items.length : 1)} item(s)</Text>
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
                                <Text style={[styles.tableTitle, { color: '#1D4533', fontWeight: '900', fontSize: 13.5 }]}>
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
                              <View style={{ flex: 1.8, minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
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

                {/* Low Stock Warning Banner */}
                {invStats.lowStockCount > 0 && (
                  <View style={styles.inventoryAlertBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <BootstrapIcon name="exclamation-triangle-fill" size={18} color="#D97706" />
                      <Text style={styles.inventoryAlertText}>
                        Attention: {invStats.lowStockCount} product(s) have fallen below their reorder level. Please restock to avoid order delays.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#D97706', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                      onPress={() => setInvStockFilter('lowStock')}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>Filter Low Stock</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Inventory Filter Bar */}
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search inventory by Part Name, Brand, or SKU..."
                      placeholderTextColor="#94A3B8"
                      value={invSearchQuery}
                      onChangeText={setInvSearchQuery}
                    />
                  </View>

                  {/* Stock Status Filter Dropdown */}
                  <View style={{ position: 'relative', zIndex: isInvStockDropdownOpen ? 9999 : 9 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: isInvStockDropdownOpen
                          ? '#1D4533'
                          : invStockFilter !== 'All'
                            ? '#1D4533'
                            : '#E2E8F0',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        minWidth: 140,
                      }}
                      onPress={() => setIsInvStockDropdownOpen((prev) => !prev)}
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
                            color: invStockFilter !== 'All' ? '#1D4533' : '#0F172A',
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

                    {/* Floating Dropdown Menu */}
                    {isInvStockDropdownOpen && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 6,
                          minWidth: 175,
                          backgroundColor: '#FFFFFF',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: '#E2E8F0',
                          zIndex: 99999,
                          elevation: 10,
                          padding: 6,
                          gap: 3,
                          boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0,0,0,0.08)',
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
                                backgroundColor: isSelected ? '#E8F0EC' : 'transparent',
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
                                    color: isSelected ? '#1D4533' : '#334155',
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
                </View>

                {/* Category Pills Filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {CATEGORY_NAMES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.filterPill, invCategoryFilter === cat && styles.filterPillActive]}
                        onPress={() => setInvCategoryFilter(cat)}
                      >
                        <Text style={[styles.filterPillText, invCategoryFilter === cat && styles.filterPillTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Inventory Table */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[styles.tableCard, { minWidth: 840 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Product Part & SKU</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Category</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Unit Price</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.6, textAlign: 'center' }]}>Current Stock</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, textAlign: 'center' }]}>Stock Status</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.3, textAlign: 'right' }]}>Stock Value</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.6, textAlign: 'center' }]}>Quick Action</Text>
                    </View>

                    {filteredInventory.map((p) => {
                      const isLow = isLowStock(p, 5);
                      const isOut = !p.stock || p.stock <= 0;
                      const stockVal = (p.price || 0) * (p.stock || 0);

                      return (
                        <View key={p.id} style={[styles.tableRow, isOut && styles.tableRowDanger, isLow && styles.tableRowHighlight]}>
                          <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: p.image }} style={styles.productThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.tableTitle} numberOfLines={1}>{p.name}</Text>
                              <Text style={styles.tableSub}>{p.brand} • SKU: {p.sku || p.id}</Text>
                            </View>
                          </View>

                          <Text style={[styles.tableSub, { flex: 1.2, color: '#0F172A', fontWeight: '600' }]}>{p.category}</Text>

                          <Text style={[styles.tableTitle, { flex: 1.2, textAlign: 'right', color: '#1D4533' }]}>
                            ₱{p.price?.toLocaleString()}
                          </Text>

                          {/* Current Stock */}
                          <View style={{ flex: 1.6, alignItems: 'center', justifyContent: 'center' }}>
                            <Text
                              style={[
                                styles.tableTitle,
                                {
                                  fontWeight: '800',
                                  fontSize: 14,
                                  color: isOut ? '#DC2626' : isLow ? '#D97706' : '#0F172A',
                                  textAlign: 'center',
                                },
                              ]}
                            >
                              {p.stock || 0}
                            </Text>
                          </View>

                          {/* Status Badge */}
                          <View style={{ flex: 1.3, alignItems: 'center' }}>
                            <View
                              style={[
                                styles.stockStatusBadge,
                                isOut ? styles.stockOut : isLow ? styles.stockLow : styles.stockInStock,
                              ]}
                            >
                              <Text
                                style={[
                                  isOut ? styles.stockOutText : isLow ? styles.stockLowText : styles.stockInStockText,
                                ]}
                              >
                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.tableTitle, { flex: 1.3, textAlign: 'right', fontWeight: '800', color: '#334155' }]}>
                            ₱{stockVal.toLocaleString()}
                          </Text>

                          {/* Restock & Edit Action */}
                          <View style={{ flex: 1.6, flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
                            <TouchableOpacity
                              style={[styles.actionIconBtn, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#C8DDD3', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                              onPress={() => openSupplierPurchase(p)}
                            >
                              <BootstrapIcon name="box-arrow-in-down" size={13} color="#1D4533" />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>Buy / Restock</Text>
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
              <View style={styles.posContainer}>
                {/* LEFT PANE: PRODUCT CATALOG GRID */}
                <View style={styles.posCatalogColumn}>
                  <View style={styles.toolbarRow}>
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
                  </View>

                  {/* Category Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {CATEGORY_NAMES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.filterPill, posCategoryFilter === cat && styles.filterPillActive]}
                          onPress={() => setPosCategoryFilter(cat)}
                        >
                          <Text style={[styles.filterPillText, posCategoryFilter === cat && styles.filterPillTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Product Cards Grid */}
                  <View style={styles.posGrid}>
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
                            <Text style={styles.posProductName} numberOfLines={2}>{p.name}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={styles.posProductPrice}>₱{p.price?.toLocaleString()}</Text>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isOutOfStock ? '#EF4444' : '#10B981' }}>
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
                </View>

                {/* RIGHT PANE: POS REGISTER CART & CHECKOUT */}
                <View style={styles.posRegisterColumn}>
                  <View style={styles.posRegisterCard}>
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
                            👤 {posSelectedCustomer.name}
                          </Text>
                        </View>
                        <BootstrapIcon name={posCustomerDropdownOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#64748B" />
                      </TouchableOpacity>

                      {/* Dropdown Customer Options */}
                      {posCustomerDropdownOpen && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#E2E8F0', maxHeight: 150 }}>
                          <ScrollView>
                            <TouchableOpacity
                              style={{ paddingVertical: 6 }}
                              onPress={() => {
                                setPosSelectedCustomer({ id: 'walkin', name: 'Walk-in Customer', phone: 'N/A' });
                                setPosCustomerDropdownOpen(false);
                              }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#1D4533' }}>👤 Walk-in Customer</Text>
                            </TouchableOpacity>
                            {usersList.map((u) => (
                              <TouchableOpacity
                                key={u.id}
                                style={{ paddingVertical: 6 }}
                                onPress={() => {
                                  setPosSelectedCustomer({ id: u.id, name: u.name, phone: u.phone || u.email });
                                  setPosCustomerDropdownOpen(false);
                                }}
                              >
                                <Text style={{ fontSize: 12.5, color: isDarkMode ? '#CBD5E1' : '#334155', fontWeight: '600' }}>
                                  👤 {u.name} ({u.email})
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
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cart is currently empty</Text>
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Click any product part on the left to begin sale</Text>
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
                              <Text style={styles.posCartItemName} numberOfLines={1}>{item.name}</Text>
                              <Text style={styles.posCartItemPrice}>
                                ₱{item.price?.toLocaleString()} each
                                {item.size ? ` · Size ${item.size}` : ''}
                              </Text>
                            </View>

                            <View style={styles.posQtyBox}>
                              <TouchableOpacity style={styles.posQtyBtn} onPress={() => handlePOSUpdateQty(item.id, -1)}>
                                <Text style={{ fontWeight: '800', color: isDarkMode ? '#CBD5E1' : '#475569', fontSize: 13 }}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.posQtyText}>{item.quantity}</Text>
                              <TouchableOpacity style={styles.posQtyBtn} onPress={() => handlePOSUpdateQty(item.id, 1)}>
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
                        style={{ backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#C8DDD3', paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' }}
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
                      {['Cash', 'Card', 'GCash', 'Bank'].map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[styles.posPayMethodBtn, posPaymentMethod === method && styles.posPayMethodBtnActive]}
                          onPress={() => setPosPaymentMethod(method)}
                        >
                          <Text style={[styles.posPayMethodText, posPaymentMethod === method && styles.posPayMethodTextActive]}>
                            {method}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Cash Tender Calculator */}
                    {posPaymentMethod === 'Cash' && (
                      <View style={styles.posTenderBox}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                          Cash Tendered (₱)
                        </Text>
                        <TextInput
                          style={[styles.formInput, { fontSize: 16, fontWeight: '900', color: '#1D4533', marginTop: 4 }]}
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
                            <Text style={styles.posQuickCashChipText}>Exact (₱{posGrandTotal.toLocaleString()})</Text>
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
                            <Text style={styles.posChangeBannerAmount}>₱{posChangeAmount.toLocaleString()}</Text>
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

                {/* Revenue Trend Visual Bar Chart */}
                <View style={styles.analyticsCard}>
                  <View style={styles.analyticsCardHeader}>
                    <View>
                      <Text style={styles.analyticsCardTitle}>Revenue Trends Telemetry</Text>
                      <Text style={styles.analyticsCardSubtitle}>Real-time sales velocity breakdown</Text>
                    </View>
                    <View style={styles.analyticsPeriodTabs}>
                      {['today', 'week', 'month', 'all'].map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.analyticsPeriodTab, analyticsPeriod === p && styles.analyticsPeriodTabActive]}
                          onPress={() => setAnalyticsPeriod(p)}
                        >
                          <Text
                            style={[
                              styles.analyticsPeriodTabText,
                              analyticsPeriod === p && styles.analyticsPeriodTabTextActive,
                            ]}
                          >
                            {p.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Pure Styled Custom Chart Container */}
                  <View style={styles.chartBarContainer}>
                    {analyticsData.trendBars.map((bar, idx) => {
                      const heightPercent = Math.max(12, Math.min(100, (bar.revenue / analyticsData.maxBarRevenue) * 100));
                      return (
                        <View key={idx} style={styles.chartBarCol}>
                          <Text style={styles.chartBarVal}>₱{Math.round(bar.revenue / 1000)}k</Text>
                          <View
                            style={[
                              styles.chartBarPill,
                              idx % 2 === 1 && styles.chartBarPillAlt,
                              { height: `${heightPercent}%` },
                            ]}
                          />
                          <Text style={styles.chartBarLabel}>{bar.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

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
                    <Text style={styles.analyticsCardSubtitle}>Online storefront vs Walk-in POS transactions</Text>

                    <View style={{ marginTop: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>In-Store POS Counter</Text>
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

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, marginTop: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Online Store Dispatches</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#56B9A1' }}>
                          ₱{analyticsData.onlineRevenue.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              backgroundColor: '#56B9A1',
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
                            backgroundColor: '#F8FAFC',
                            padding: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>{method}</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#1D4533', marginTop: 2 }}>{count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Top 5 Products Leaderboard */}
                  <View style={[styles.analyticsCard, { flex: 1, minWidth: 320 }]}>
                    <Text style={styles.analyticsCardTitle}>Top Performing Parts</Text>
                    <Text style={styles.analyticsCardSubtitle}>Ranked by cumulative revenue</Text>

                    <View style={{ marginTop: 12 }}>
                      {analyticsData.topProducts.map((tp, idx) => (
                        <View key={idx} style={styles.leaderboardRow}>
                          <View style={styles.leaderboardRank}>
                            <Text style={styles.leaderboardRankText}>#{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>
                              {tp.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>
                              {tp.brand} • {tp.unitsSold} units sold
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#1D4533' }}>
                            ₱{tp.revenue.toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ─── TAB 4b: SALES FORECAST & STOCK OPTIMIZATION ─── */}
            {activeNav === 'forecast' && (
              <SalesForecastPanel
                orders={orders}
                products={products}
                isDarkMode={false}
                isDesktop={isDesktop}
              />
            )}

            {activeNav === 'customizations' && (
              <CustomizationsAdminPanel />
            )}

            {/* ─── TAB 5: PRODUCTS & PRICES MANAGEMENT ─── */}
            {activeNav === 'products' && (
              <View>
                <View style={styles.toolbarRow}>
                  <View style={styles.searchInputBox}>
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search products by name or brand..."
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  {/* Category Filter */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 480 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {CATEGORY_NAMES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.filterPill, selectedCategory === cat && styles.filterPillActive]}
                          onPress={() => setSelectedCategory(cat)}
                        >
                          <Text style={[styles.filterPillText, selectedCategory === cat && styles.filterPillTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Products Table — Cost & Profit visible to admin */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[styles.tableCard, { minWidth: 920 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.4 }]}>Product & Brand</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Category</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>Cost (₱)</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>Price (₱)</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>Profit (₱)</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'center' }]}>Margin</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Stock</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: 'center' }]}>Actions</Text>
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
                            <Text style={styles.tableTitle} numberOfLines={1}>{p.name}</Text>
                            <Text style={styles.tableSub}>{p.brand} • {p.compatibility || 'Universal'}</Text>
                          </View>
                        </View>

                        <Text style={[styles.tableSub, { flex: 1.1, color: '#0F172A', fontWeight: '600' }]}>{p.category}</Text>

                        <View style={{ flex: 1.1, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 80 }]}
                            keyboardType="numeric"
                            defaultValue={String(cost)}
                            onEndEditing={(e) => handleUpdateCost(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        <View style={{ flex: 1.1, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 80 }]}
                            keyboardType="numeric"
                            defaultValue={String(p.price)}
                            onEndEditing={(e) => handleUpdatePrice(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        <Text style={[styles.tableSub, { flex: 1.1, textAlign: 'center', fontWeight: '800', color: profit >= 0 ? '#059669' : '#DC2626' }]}>
                          ₱{profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </Text>

                        <Text style={[styles.tableSub, { flex: 0.9, textAlign: 'center', fontWeight: '800', color: margin < 15 ? '#D97706' : '#0F172A' }]}>
                          {margin.toFixed(1)}%
                        </Text>

                        <View style={{ flex: 0.8, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 50 }]}
                            keyboardType="numeric"
                            defaultValue={String(p.stock)}
                            onEndEditing={(e) => handleUpdateStock(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        <View style={{ flex: 1.1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnEdit]}
                            onPress={() => setEditingProduct({ ...p, unit_cost: cost, unitCost: cost })}
                            title="Edit Product"
                          >
                            <BootstrapIcon name="pencil-square" size={16} color="#2563EB" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                            onPress={() => handleDeleteProduct(p.product_id || p.id, p.name)}
                            title="Delete Product"
                          >
                            <BootstrapIcon name="trash3" size={16} color="#EF4444" />
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
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Promo Code</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Discount</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Description</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'center' }]}>Status / Toggle</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {promos.map((prm) => (
                    <View key={prm.code} style={[styles.tableRow, !prm.isActive && { opacity: 0.65, backgroundColor: '#F8FAFC' }]}>
                      <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.tableTitle, { color: prm.isActive ? '#1D4533' : '#64748B', fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                          {prm.code}
                        </Text>
                        {!prm.isActive && (
                          <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Text style={{ fontSize: 9.5, color: '#64748B', fontWeight: '800' }}>DISABLED</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.tableTitle, { flex: 1.5, textAlign: 'center', color: prm.isActive ? '#D97706' : '#94A3B8', fontWeight: '900' }]}>
                        {prm.discountPercent}% OFF
                      </Text>
                      <Text style={[styles.tableSub, { flex: 3 }]}>{prm.description || 'General store discount'}</Text>
                      
                      {/* Interactive Active / Inactive Status Switch */}
                      <View style={{ flex: 1.8, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={[
                            styles.promoStatusToggleBtn,
                            prm.isActive ? styles.promoStatusActive : styles.promoStatusInactive,
                          ]}
                          onPress={() => handleTogglePromo(prm.code, prm.isActive)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.promoToggleDot, prm.isActive ? styles.promoToggleDotActive : styles.promoToggleDotInactive]} />
                          <Text style={[styles.promoStatusText, prm.isActive ? styles.promoStatusTextActive : styles.promoStatusTextInactive]}>
                            {prm.isActive ? 'Active (ON)' : 'Inactive (OFF)'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Action Buttons */}
                      <View style={{ flex: 1.5, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={[styles.actionIconBtn, prm.isActive ? styles.actionIconBtnWarning : styles.actionIconBtnSuccess]}
                          onPress={() => handleTogglePromo(prm.code, prm.isActive)}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name={prm.isActive ? 'toggle-on' : 'toggle-off'} size={15} color={prm.isActive ? '#D97706' : '#16A34A'} />
                        </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                            onPress={() => handleDeletePromo(prm.code)}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="trash3" size={16} color="#EF4444" />
                          </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── TAB 7: GARAGE BOOKINGS & PACKAGES ─── */}
            {activeNav === 'garage' && (
              <View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {[
                    { id: 'bookings', label: 'Bookings', count: garageBookings.length },
                    { id: 'packages', label: 'Packages', count: garageServices.length },
                  ].map((tab) => {
                    const active = garageSubTab === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setGarageSubTab(tab.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: active ? '#1D4533' : '#E2E8F0',
                          backgroundColor: active ? '#1D4533' : '#FFFFFF',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: active ? '#FFFFFF' : '#475569' }}>
                          {tab.label} ({tab.count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {garageSubTab === 'bookings' && (
                  <View style={styles.tableCard}>
                    {garageBookings.length === 0 ? (
                      <View style={{ padding: 28, alignItems: 'center' }}>
                        <BootstrapIcon name="calendar3" size={26} color="#94A3B8" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 8 }}>
                          No customer bookings yet
                        </Text>
                      </View>
                    ) : (
                      garageBookings.map((b) => {
                        const isPending = String(b.status || '').toLowerCase() === 'pending';
                        return (
                          <View key={b.id || b.booking_id} style={[styles.tableRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.tableTitle}>{b.package_name || b.service_title || b.serviceName}</Text>
                                <Text style={styles.tableSub}>
                                  {b.customer_name || b.userName} • {b.appointment_date || b.date} • {b.time_slot || b.time}
                                </Text>
                                <Text style={styles.tableSub}>
                                  {(b.bike_brand || b.bikeBrand || '')} {(b.bike_model || b.bikeModel || '')} • {b.plate_number || b.bikePlate}
                                </Text>
                              </View>
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                  backgroundColor: isPending ? '#FEF3C7' : '#C8DDD3',
                                  alignSelf: 'flex-start',
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '800', color: isPending ? '#D97706' : '#1D4533' }}>
                                  {isPending ? 'Pending Approval' : b.status}
                                </Text>
                              </View>
                            </View>
                            {isPending && (
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                <TouchableOpacity
                                  style={[styles.addBtnPrimary, { flex: 1, justifyContent: 'center' }]}
                                  onPress={() => {
                                    setSelectedBookingForApproval(b);
                                    setSelectedMechanicForApproval(garageMechanics[0]?.name || '');
                                  }}
                                >
                                  <Text style={styles.addBtnPrimaryText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.quickStoreBtn, { flex: 1, justifyContent: 'center', backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                                  onPress={() => handleAdvisorReject(b.id || b.booking_id)}
                                >
                                  <Text style={[styles.quickStoreBtnText, { color: '#DC2626' }]}>Decline</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {garageSubTab === 'packages' && (
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Service Package</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Category</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Price (₱)</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>Duration</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {garageServices.map((srv) => (
                    <View key={srv.id} style={styles.tableRow}>
                      <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center' }}>
                        <Image source={{ uri: srv.image }} style={styles.productThumb} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableTitle}>{srv.title}</Text>
                          <Text style={styles.tableSub}>{srv.subtitle || srv.badge}</Text>
                        </View>
                      </View>
                      <Text style={[styles.tableSub, { flex: 1.2, color: '#0F172A', fontWeight: '700' }]}>{srv.category}</Text>
                      <Text style={[styles.tableTitle, { flex: 1.2, textAlign: 'right', color: '#1D4533' }]}>
                        ₱{(srv.pricePhp || srv.price || 0).toLocaleString()}
                      </Text>
                      <Text style={[styles.tableSub, { flex: 1.2, textAlign: 'center' }]}>{srv.duration || '60 mins'}</Text>
                      <View style={{ flex: 1.2, flexDirection: 'row', justifyContent: 'center' }}>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => {
                            setEditingGarageService(srv);
                            setServTitle(srv.title);
                            setServCategory(srv.category);
                            setServSubtitle(srv.subtitle || '');
                            setServPrice(String(srv.pricePhp || srv.price || 0));
                            setServDuration(srv.duration || '60 mins');
                            setServBadge(srv.badge || 'Popular');
                            setServImage(srv.image);
                            setServDesc(srv.description || '');
                            setServInclusions(Array.isArray(srv.inclusions) ? srv.inclusions.join('\n') : srv.inclusions || '');
                            setIsAddGarageOpen(true);
                          }}
                        >
                          <BootstrapIcon name="pencil" size={13} color="#475569" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
                )}
              </View>
            )}

            {/* ─── TAB: RIDERS / DELIVERY STAFF ─── */}
            {activeNav === 'riders' && (
              <View>
                <View style={styles.toolbarRow}>
                  <View style={[styles.searchInputBox, { flex: 1 }]}>
                    <BootstrapIcon name="search" size={14} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search riders..."
                      placeholderTextColor="#94A3B8"
                      value={riderSearchQuery}
                      onChangeText={setRiderSearchQuery}
                    />
                  </View>
                  <TouchableOpacity style={styles.addBtnPrimary} onPress={handleOpenAddRider} activeOpacity={0.85}>
                    <BootstrapIcon name="person-plus-fill" size={14} color="#FFFFFF" />
                    <Text style={styles.addBtnPrimaryText}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { id: 'All', label: 'All', count: deliveryRiders.length },
                      {
                        id: RIDER_STATUSES.AVAILABLE,
                        label: 'Available',
                        count: deliveryRiders.filter((r) => r.status === RIDER_STATUSES.AVAILABLE).length,
                      },
                      {
                        id: RIDER_STATUSES.ON_DELIVERY,
                        label: 'On Delivery',
                        count: deliveryRiders.filter((r) => r.status === RIDER_STATUSES.ON_DELIVERY).length,
                      },
                      {
                        id: RIDER_STATUSES.OFF_DUTY,
                        label: 'Off Duty',
                        count: deliveryRiders.filter((r) => r.status === RIDER_STATUSES.OFF_DUTY).length,
                      },
                    ].map((chip) => {
                      const active = riderFilterStatus === chip.id;
                      return (
                        <TouchableOpacity
                          key={chip.id}
                          onPress={() => setRiderFilterStatus(chip.id)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 999,
                            borderWidth: 1.5,
                            borderColor: active ? '#1D4533' : '#E2E8F0',
                            backgroundColor: active ? '#1D4533' : '#FFFFFF',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : '#475569' }}>
                            {chip.label}
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: active ? '#CCFBF1' : '#94A3B8' }}>
                            {chip.count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={styles.tableCard}>
                  {filteredRiders.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                      <BootstrapIcon name="bicycle" size={26} color="#94A3B8" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 8 }}>
                        No riders found
                      </Text>
                    </View>
                  ) : (
                    filteredRiders.map((rider) => {
                      const statusColor =
                        rider.status === RIDER_STATUSES.AVAILABLE
                          ? { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC' }
                          : rider.status === RIDER_STATUSES.ON_DELIVERY
                            ? { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' }
                            : { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' };

                      return (
                        <View
                          key={rider.id}
                          style={[
                            styles.tableRow,
                            { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
                          ]}
                        >
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
                          <View style={{ flex: 1, minWidth: 120 }}>
                            <Text style={styles.tableTitle} numberOfLines={1}>
                              {rider.name}
                            </Text>
                            <Text style={styles.tableSub} numberOfLines={1}>
                              {rider.phone || '—'} · {rider.vehicleInfo || 'No vehicle'}
                            </Text>
                            <Text style={[styles.tableSub, { fontSize: 11 }]} numberOfLines={1}>
                              Plate: {rider.plateNumber || '—'}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533', marginTop: 4 }}>
                              Earnings: ₱
                              {Number(rider.totalEarnings || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleToggleRiderStatus(rider)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 999,
                              backgroundColor: statusColor.bg,
                              borderWidth: 1,
                              borderColor: statusColor.border,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: statusColor.text }}>
                              {rider.status || RIDER_STATUSES.AVAILABLE}
                            </Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.actionIconBtn}
                              onPress={() => setRiderAccessModal({ rider, bundle: null })}
                            >
                              <BootstrapIcon name="geo-alt" size={13} color="#1D4533" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.actionIconBtn}
                              onPress={() => handleOpenEditRider(rider)}
                            >
                              <BootstrapIcon name="pencil" size={13} color="#475569" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionIconBtn, { backgroundColor: '#FEF2F2' }]}
                              onPress={() => handleDeleteRider(rider)}
                            >
                              <BootstrapIcon name="trash3-fill" size={13} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
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
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>User Profile</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Email</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Role</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Privilege</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Delete</Text>
                  </View>

                  {usersList
                    .filter((u) => !userSearchQuery || u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                    .map((u) => (
                      <View key={u.id} style={styles.tableRow}>
                        <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Image source={{ uri: u.avatar }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9' }} />
                          <View>
                            <Text style={styles.tableTitle}>{u.name}</Text>
                            <Text style={styles.tableSub}>{u.phone || 'No phone'}</Text>
                          </View>
                        </View>
                        <Text style={[styles.tableSub, { flex: 2 }]}>{u.email}</Text>
                        <View style={{ flex: 1.5 }}>
                          <View style={{ backgroundColor: u.role === 'admin' ? '#F3F7F6' : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' }}>
                            <Text style={{ color: u.role === 'admin' ? '#1D4533' : '#475569', fontSize: 11, fontWeight: '800' }}>
                              {u.role === 'admin' ? '👑 Admin' : '👤 Customer'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flex: 1.5, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4 }]}
                            onPress={() => handleToggleUserRole(u.id, u.role)}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4533' }}>
                              {u.role === 'admin' ? 'Demote' : 'Promote'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                            onPress={() => handleDeleteUser(u.id, u.name)}
                          >
                            <BootstrapIcon name="trash" size={13} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* ─── TAB 9: SUPABASE SETTINGS ─── */}
            {activeNav === 'supabase' && (
              <View>
                <View style={[styles.tableCard, { padding: 24 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F7F6', alignItems: 'center', justifyContent: 'center' }}>
                      <BootstrapIcon name="database-fill-check" size={20} color="#1D4533" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                      Cloud Database Connection (Supabase)
                    </Text>
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 18, lineHeight: 20 }}>
                    Configure the live PostgreSQL database URL and public anon key for real-time order and product synchronization. Note: Supabase project URLs always end with <Text style={{ fontWeight: '700', color: '#0F172A' }}>.supabase.co</Text>.
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
                    Correct format: <Text style={{ color: '#1D4533', fontWeight: '600' }}>https://vtbdmurblidtdghaotne.supabase.co</Text>
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
                    Use the client <Text style={{ fontWeight: '600', color: '#0F172A' }}>anon/public</Text> JWT key (starts with eyJhbGci...).
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
                        showToast(res.connected ? '✅ Supabase Connected Live!' : '⚠️ ' + res.message);
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="plug-fill" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>Save & Test Live Connection</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addBtnPrimary, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#1D4533' }]}
                      onPress={async () => {
                        const defs = supabaseManager.resetToDefaults();
                        setSupabaseUrl(defs.url);
                        setSupabaseKey(defs.key);
                        const res = await supabaseManager.testConnection();
                        setConnectionStatus({ tested: true, connected: res.connected, message: res.message });
                        showToast(res.connected ? '✅ Restored Project Defaults!' : '⚠️ ' + res.message);
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="arrow-counterclockwise" size={14} color="#1D4533" />
                      <Text style={[styles.addBtnPrimaryText, { color: '#1D4533' }]}>Restore Default Project Credentials</Text>
                    </TouchableOpacity>
                  </View>

                  {connectionStatus.tested && (
                    <View style={{ marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: connectionStatus.connected ? '#ECFDF5' : '#FEF2F2', borderWidth: 1, borderColor: connectionStatus.connected ? '#A7F3D0' : '#FECACA' }}>
                      <Text style={{ color: connectionStatus.connected ? '#065F46' : '#991B1B', fontWeight: '700', fontSize: 13.5, lineHeight: 20 }}>
                        {connectionStatus.connected ? '✅ Connection Active: ' : '❌ Error: '} {connectionStatus.message}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ─── TAB 10: NOTIFICATIONS & ALERTS CENTER ─── */}
            {activeNav === 'notifications' && (
              <NotificationsPage
                onNavigateToOrders={() => setActiveNav('orders')}
                onNavigateToGarage={() => setActiveNav('garage')}
                onNavigateToAdmin={() => setActiveNav('overview')}
                onNavigateToShop={onNavigateToStore}
              />
            )}

            {/* ─── TAB 11: SYSTEM & PLATFORM SETTINGS ─── */}
            {activeNav === 'settings' && (
              <View>
                {/* Header Card with Actions */}
                <View style={[styles.tableCard, { padding: 24, marginBottom: 20 }]}>
                  <View
                    style={{
                      flexDirection: isDesktop ? 'row' : 'column',
                      alignItems: isDesktop ? 'center' : 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: '#E8F0EC',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="gear-fill" size={22} color="#1D4533" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>
                          System & Platform Settings
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
                          Configure store identity, customer checkout rules, pitstop parameters, and system maintenance.
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={[styles.addBtnPrimary, { backgroundColor: '#1D4533' }]}
                        onPress={handleSaveSystemSettings}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="check-lg" size={15} color="#FFFFFF" />
                        <Text style={styles.addBtnPrimaryText}>
                          {isSavingSettings ? 'Saving...' : 'Save Settings'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.addBtnPrimary,
                          {
                            backgroundColor: '#F1F5F9',
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                          },
                        ]}
                        onPress={handleResetSystemSettings}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="arrow-counterclockwise" size={14} color="#475569" />
                        <Text style={[styles.addBtnPrimaryText, { color: '#475569' }]}>
                          Reset Defaults
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Navigation Subtabs */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', gap: 8 }}
                  >
                    {[
                      { id: 'general', label: 'Store Identity', icon: 'shop' },
                      { id: 'operations', label: 'Fulfillment & Orders', icon: 'box-seam' },
                      { id: 'garage', label: 'Pitstop Garage Rules', icon: 'tools' },
                      { id: 'maintenance', label: 'Maintenance & Cache', icon: 'shield-check' },
                    ].map((tab) => {
                      const isActive = settingsActiveSubTab === tab.id;
                      return (
                        <TouchableOpacity
                          key={tab.id}
                          style={[
                            styles.filterPill,
                            isActive && styles.filterPillActive,
                            { paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
                          ]}
                          onPress={() => setSettingsActiveSubTab(tab.id)}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon
                            name={tab.icon}
                            size={14}
                            color={isActive ? '#FFFFFF' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.filterPillText,
                              isActive && styles.filterPillTextActive,
                              { fontWeight: isActive ? '800' : '600' },
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Subtab 1: Store Identity */}
                {settingsActiveSubTab === 'general' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                      Store Identity & Branding Details
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20 }}>
                      Primary details displayed across customer invoices, storefront headers, and email communications.
                    </Text>

                    <Text style={styles.formLabel}>Official Store Name</Text>
                    <TextInput
                      style={styles.formInput}
                      value={setForm.storeName}
                      onChangeText={(val) => handleUpdateSettingField('storeName', val)}
                      placeholder="e.g. MotoTrack Performance & Pitstop Garage"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={styles.formLabel}>Store Tagline / Slogan</Text>
                    <TextInput
                      style={styles.formInput}
                      value={setForm.storeTagline}
                      onChangeText={(val) => handleUpdateSettingField('storeTagline', val)}
                      placeholder="e.g. Premier Performance Motorcycle Parts"
                      placeholderTextColor="#94A3B8"
                    />

                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Support Email Address</Text>
                        <TextInput
                          style={styles.formInput}
                          value={setForm.contactEmail}
                          onChangeText={(val) => handleUpdateSettingField('contactEmail', val)}
                          placeholder="support@mototrack.ph"
                          placeholderTextColor="#94A3B8"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Hotline / Customer Contact Phone</Text>
                        <TextInput
                          style={styles.formInput}
                          value={setForm.contactPhone}
                          onChangeText={(val) => handleUpdateSettingField('contactPhone', val)}
                          placeholder="+63 (02) 8876-5432"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <Text style={styles.formLabel}>Store Location / Physical Hub Address</Text>
                    <TextInput
                      style={styles.formInput}
                      value={setForm.storeAddress}
                      onChangeText={(val) => handleUpdateSettingField('storeAddress', val)}
                      placeholder="108 Katipunan Ave, Quezon City, Metro Manila"
                      placeholderTextColor="#94A3B8"
                    />

                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Currency Symbol</Text>
                        <TextInput
                          style={styles.formInput}
                          value={setForm.currencySymbol}
                          onChangeText={(val) => handleUpdateSettingField('currencySymbol', val)}
                          placeholder="₱"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>VAT / Sales Tax Rate (%)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={String(setForm.taxRate ?? 12)}
                          onChangeText={(val) => handleUpdateSettingField('taxRate', Number(val) || 0)}
                          placeholder="12"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* Subtab 2: Fulfillment & Orders */}
                {settingsActiveSubTab === 'operations' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                      Fulfillment & Operational Thresholds
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20 }}>
                      Fine-tune order checkout validation limits, free shipping tiers, and inventory alert levels.
                    </Text>

                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Free Shipping Qualification (₱)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={String(setForm.freeShippingThreshold ?? 3500)}
                          onChangeText={(val) => handleUpdateSettingField('freeShippingThreshold', Number(val) || 0)}
                          placeholder="3500"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                        />
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                          Orders exceeding this amount receive complimentary dispatch.
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formLabel}>Maximum Cash On Delivery Ceiling (₱)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={String(setForm.maxCodAmount ?? 50000)}
                          onChangeText={(val) => handleUpdateSettingField('maxCodAmount', Number(val) || 0)}
                          placeholder="50000"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                        />
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                          Transactions above this require digital pre-payment for fraud prevention.
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.formLabel}>Low Stock Alert Threshold (Units)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={String(setForm.lowStockThreshold ?? 5)}
                        onChangeText={(val) => handleUpdateSettingField('lowStockThreshold', Number(val) || 1)}
                        placeholder="5"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                        SKUs with inventory counts at or below this value trigger priority low stock flags.
                      </Text>
                    </View>

                    {/* Auto-verify COD Toggle */}
                    <View
                      style={{
                        marginTop: 20,
                        padding: 16,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                          Auto-Verify COD Orders
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          When enabled, incoming COD purchases skip manual admin vetting and transition straight to fulfillment.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          width: 48,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: setForm.autoVerifyCodOrders ? '#1D4533' : '#CBD5E1',
                          padding: 2,
                          justifyContent: 'center',
                        }}
                        onPress={() => handleUpdateSettingField('autoVerifyCodOrders', !setForm.autoVerifyCodOrders)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: '#FFFFFF',
                            alignSelf: setForm.autoVerifyCodOrders ? 'flex-end' : 'flex-start',
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Subtab 3: Pitstop Garage Rules */}
                {settingsActiveSubTab === 'garage' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                      Pitstop Bay & Service Booking Parameters
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20 }}>
                      Manage service operating hours, daily booking capacity, and mechanic roster assignments.
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
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.formLabel}>Maximum Daily Pitstop Appointments</Text>
                      <TextInput
                        style={styles.formInput}
                        value={String(setForm.maxDailyAppointments ?? 24)}
                        onChangeText={(val) => handleUpdateSettingField('maxDailyAppointments', Number(val) || 1)}
                        placeholder="24"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 3 }}>
                        Limits concurrent online booking requests per day to prevent garage bay overbooking.
                      </Text>
                    </View>

                    {/* Weekend bookings toggle */}
                    <View
                      style={{
                        marginTop: 20,
                        padding: 16,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                          Allow Weekend Appointments (Sat & Sun)
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          Permit riders to reserve weekend tune-ups and express PMS slots.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          width: 48,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: setForm.allowWeekendBookings ? '#1D4533' : '#CBD5E1',
                          padding: 2,
                          justifyContent: 'center',
                        }}
                        onPress={() => handleUpdateSettingField('allowWeekendBookings', !setForm.allowWeekendBookings)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: '#FFFFFF',
                            alignSelf: setForm.allowWeekendBookings ? 'flex-end' : 'flex-start',
                          }}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Auto-assign mechanic */}
                    <View
                      style={{
                        marginTop: 14,
                        padding: 16,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                          Auto-Assign Certified Mechanic
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          Automatically allocates the next available pit bay technician when walk-in or web bookings are placed.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          width: 48,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: setForm.autoAssignMechanic ? '#1D4533' : '#CBD5E1',
                          padding: 2,
                          justifyContent: 'center',
                        }}
                        onPress={() => handleUpdateSettingField('autoAssignMechanic', !setForm.autoAssignMechanic)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: '#FFFFFF',
                            alignSelf: setForm.autoAssignMechanic ? 'flex-end' : 'flex-start',
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Subtab 4: Maintenance & Cache */}
                {settingsActiveSubTab === 'maintenance' && (
                  <View style={[styles.tableCard, { padding: 24 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                      System Maintenance & Diagnostics
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20 }}>
                      Control live storefront maintenance banner and system temporary caches.
                    </Text>

                    {/* Maintenance mode toggle */}
                    <View
                      style={{
                        padding: 18,
                        backgroundColor: setForm.isMaintenanceMode ? '#FEF2F2' : '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: setForm.isMaintenanceMode ? '#FECACA' : '#E2E8F0',
                        marginBottom: 18,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <BootstrapIcon
                            name="cone-striped"
                            size={20}
                            color={setForm.isMaintenanceMode ? '#DC2626' : '#64748B'}
                          />
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: setForm.isMaintenanceMode ? '#DC2626' : '#0F172A' }}>
                              Storefront Maintenance Mode
                            </Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>
                              Displays an advisory banner to customers while admin operations proceed.
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={{
                            width: 48,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: setForm.isMaintenanceMode ? '#DC2626' : '#CBD5E1',
                            padding: 2,
                            justifyContent: 'center',
                          }}
                          onPress={() => handleUpdateSettingField('isMaintenanceMode', !setForm.isMaintenanceMode)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: '#FFFFFF',
                              alignSelf: setForm.isMaintenanceMode ? 'flex-end' : 'flex-start',
                            }}
                          />
                        </TouchableOpacity>
                      </View>

                      {setForm.isMaintenanceMode && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.formLabel}>Maintenance Advisory Notice</Text>
                          <TextInput
                            style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                            value={setForm.maintenanceMessage}
                            onChangeText={(val) => handleUpdateSettingField('maintenanceMessage', val)}
                            multiline
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      )}
                    </View>

                    {/* Cache & Diagnostics Utilities */}
                    <View
                      style={{
                        padding: 18,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        gap: 12,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                        Platform Health & Cache Operations
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        Purge temporary local storage filters and UI state without impacting customer accounts, inventory, or orders.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={[styles.addBtnPrimary, { backgroundColor: '#475569' }]}
                          onPress={handleClearCache}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="trash3" size={14} color="#FFFFFF" />
                          <Text style={styles.addBtnPrimaryText}>Clear System Temporary Caches</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ─── MODAL: ADD / EDIT SERVICE PACKAGE ─── */}
      <Modal
        visible={isAddGarageOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddGarageOpen(false);
          resetGaragePackageForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGarageService ? 'Edit Service Package' : 'Add Service Package'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddGarageOpen(false);
                  resetGaragePackageForm();
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Package Title *</Text>
              <TextInput
                style={styles.formInput}
                value={servTitle}
                onChangeText={setServTitle}
                placeholder="e.g. Premium PMS"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.formLabel}>Subtitle</Text>
              <TextInput
                style={styles.formInput}
                value={servSubtitle}
                onChangeText={setServSubtitle}
                placeholder="Short description customers will see"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.formLabel}>Category</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {['PMS', 'Repair', 'Customization'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setServCategory(cat)}
                    style={[
                      styles.orderFilterTab,
                      { flex: 1, alignItems: 'center' },
                      servCategory === cat && { backgroundColor: '#1D4533', borderColor: '#1D4533' },
                    ]}
                  >
                    <Text style={[styles.orderFilterTabText, servCategory === cat && { color: '#FFFFFF' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Price (₱) *</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={servPrice}
                    onChangeText={setServPrice}
                    placeholder="2500"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Duration</Text>
                  <TextInput
                    style={styles.formInput}
                    value={servDuration}
                    onChangeText={setServDuration}
                    placeholder="60 mins"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
                multiline
                value={servDesc}
                onChangeText={setServDesc}
                placeholder="What this package includes for the customer"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.formLabel}>Inclusions (one per line)</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                multiline
                value={servInclusions}
                onChangeText={setServInclusions}
                placeholder={"Oil change\nChain lube\nBrake inspection"}
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  setIsAddGarageOpen(false);
                  resetGaragePackageForm();
                }}
              >
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtnPrimary} onPress={handleSaveGarageService}>
                <Text style={styles.addBtnPrimaryText}>
                  {editingGarageService ? 'Save Package' : 'Add Package'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: APPROVE CUSTOMER BOOKING ─── */}
      <Modal
        visible={Boolean(selectedBookingForApproval)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBookingForApproval(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Approve Booking</Text>
              <TouchableOpacity onPress={() => setSelectedBookingForApproval(null)}>
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.tableTitle}>
                {selectedBookingForApproval?.package_name || selectedBookingForApproval?.service_title}
              </Text>
              <Text style={[styles.tableSub, { marginTop: 4 }]}>
                {selectedBookingForApproval?.customer_name} • {selectedBookingForApproval?.appointment_date} • {selectedBookingForApproval?.time_slot}
              </Text>
              <Text style={[styles.formLabel, { marginTop: 16 }]}>Assign technician</Text>
              {garageMechanics.length === 0 ? (
                <View style={{ padding: 14, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    No mechanics registered yet. You can add mechanics in the Garage Management tab.
                  </Text>
                </View>
              ) : (
                garageMechanics.map((mech) => {
                  const selected = selectedMechanicForApproval === mech.name;
                  return (
                    <TouchableOpacity
                      key={mech.id || mech.name}
                      onPress={() => setSelectedMechanicForApproval(mech.name)}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: selected ? '#1D4533' : '#E2E8F0',
                        backgroundColor: selected ? '#F0FDF4' : '#FFFFFF',
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? '#1D4533' : '#0F172A' }}>
                        {mech.name}
                      </Text>
                      {mech.specialization ? (
                        <Text style={{ fontSize: 11, color: '#64748B' }}>{mech.specialization}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.quickStoreBtn} onPress={() => setSelectedBookingForApproval(null)}>
                <Text style={styles.quickStoreBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtnPrimary}
                onPress={() =>
                  handleAdvisorApprove(
                    selectedBookingForApproval?.id || selectedBookingForApproval?.booking_id,
                    selectedMechanicForApproval
                  )
                }
              >
                <Text style={styles.addBtnPrimaryText}>Approve Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 1: ADD NEW PRODUCT ─── */}
      <Modal visible={isAddProductOpen} transparent animationType="fade" onRequestClose={() => setIsAddProductOpen(false)}>
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
              <TextInput style={styles.formInput} value={newProdName} onChangeText={setNewProdName} placeholder="e.g. Akrapovič Slip-On Exhaust" placeholderTextColor="#94A3B8" />

              <Text style={styles.formLabel}>Brand Name</Text>
              <TextInput style={styles.formInput} value={newProdBrand} onChangeText={setNewProdBrand} placeholder="e.g. Brembo, Öhlins, Akrapovič" placeholderTextColor="#94A3B8" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Cost (₱)</Text>
                  <TextInput style={styles.formInput} keyboardType="numeric" value={newProdCost} onChangeText={setNewProdCost} placeholder="25000" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Price (₱)</Text>
                  <TextInput style={styles.formInput} keyboardType="numeric" value={newProdPrice} onChangeText={setNewProdPrice} placeholder="39000" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Stock</Text>
                  <TextInput style={styles.formInput} keyboardType="numeric" value={newProdStock} onChangeText={setNewProdStock} placeholder="15" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              {Number(newProdPrice) > 0 && (
                <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700', marginBottom: 8 }}>
                  Profit: ₱{(Number(newProdPrice) - Number(newProdCost || 0)).toLocaleString()} (
                  {(((Number(newProdPrice) - Number(newProdCost || 0)) / Number(newProdPrice)) * 100).toFixed(1)}% margin)
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
                    <Text style={[styles.filterPillText, newProdCategory === cat && styles.filterPillTextActive]}>{cat}</Text>
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

              {/* Image Selection: File Picker / URL / Presets */}
              <Text style={styles.formLabel}>Product Image</Text>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                {newProdImage ? (
                  <Image
                    source={{ uri: newProdImage }}
                    style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#E2E8F0', borderWidth: 1.5, borderColor: '#CBD5E1' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <BootstrapIcon name="box-seam" size={26} color="#94A3B8" />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D4533', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
                    onPress={async () => {
                      const res = await pickImageFromFile();
                      if (res.success && res.uri) {
                        setNewProdImage(res.uri);
                        showToast('✅ Image selected from device files!');
                      } else if (res.error && res.error !== 'Selection cancelled') {
                        showAlert('Image Picker', res.error);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="folder2-open" size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Choose Image from File</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Upload PNG, JPG, WEBP from your local PC or phone</Text>
                </View>
              </View>

              <Text style={[styles.formLabel, { fontSize: 12, color: '#64748B' }]}>Or Paste Direct Image URL</Text>
              <TextInput style={styles.formInput} value={newProdImage} onChangeText={setNewProdImage} placeholder="https://..." placeholderTextColor="#94A3B8" />

              {/* Preset Image Picker */}
              <Text style={[styles.formLabel, { fontSize: 12, color: '#64748B' }]}>Or Select a Preset Image</Text>
              <View style={styles.presetGrid}>
                {ADMIN_IMAGE_PRESETS.map((url, i) => (
                  <TouchableOpacity key={i} style={[styles.presetThumbBtn, newProdImage === url && styles.presetThumbBtnActive]} onPress={() => setNewProdImage(url)}>
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
        <Modal visible={Boolean(editingProduct)} transparent animationType="fade" onRequestClose={() => setEditingProduct(null)}>
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
                <TextInput style={styles.formInput} value={editingProduct.name} onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, name: val }))} />

                <Text style={styles.formLabel}>Brand</Text>
                <TextInput style={styles.formInput} value={editingProduct.brand} onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, brand: val }))} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Cost (₱)</Text>
                    <TextInput
                      style={styles.formInput}
                      keyboardType="numeric"
                      value={String(editingProduct.unit_cost ?? editingProduct.unitCost ?? 0)}
                      onChangeText={(val) => {
                        const cost = parseFloat(val) || 0;
                        setEditingProduct((prev) => ({ ...prev, unit_cost: cost, unitCost: cost }));
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Price (₱)</Text>
                    <TextInput style={styles.formInput} keyboardType="numeric" value={String(editingProduct.price)} onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, price: parseFloat(val) || 0 }))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Stock</Text>
                    <TextInput style={styles.formInput} keyboardType="numeric" value={String(editingProduct.stock)} onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, stock: parseInt(val, 10) || 0 }))} />
                  </View>
                </View>
                {Number(editingProduct.price) > 0 && (
                  <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700', marginBottom: 8 }}>
                    Profit: ₱
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

                {/* Edit Product Image with File Picker */}
                <Text style={styles.formLabel}>Product Image</Text>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  {editingProduct.image ? (
                    <Image
                      source={{ uri: editingProduct.image }}
                      style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#E2E8F0', borderWidth: 1.5, borderColor: '#CBD5E1' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <BootstrapIcon name="box-seam" size={26} color="#94A3B8" />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 6 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D4533', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
                      onPress={async () => {
                        const res = await pickImageFromFile();
                        if (res.success && res.uri) {
                          setEditingProduct((prev) => ({ ...prev, image: res.uri }));
                          showToast('✅ Image updated from file!');
                        } else if (res.error && res.error !== 'Selection cancelled') {
                          showAlert('Image Picker', res.error);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="folder2-open" size={15} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Choose New Image File</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>Pick replacement image from your computer or phone</Text>
                  </View>
                </View>

                <Text style={[styles.formLabel, { fontSize: 12, color: '#64748B' }]}>Or Paste Image URL</Text>
                <TextInput style={styles.formInput} value={editingProduct.image || ''} onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, image: val }))} placeholder="https://..." placeholderTextColor="#94A3B8" />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput style={[styles.formInput, { height: 60 }]} multiline value={editingProduct.description} onChangeText={(val) => setEditingProduct((prev) => ({ ...prev, description: val }))} />
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

      {/* ─── MODAL 3: SUPPLIER PURCHASE / RESTOCK ─── */}
      <Modal
        visible={isRestockModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsRestockModalOpen(false);
          setRestockModalProduct(null);
          setRestockSearchQuery('');
          setRestockColorAdds([]);
          setRestockSelectedColor('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 480 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Purchase from Supplier</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsRestockModalOpen(false);
                  setRestockModalProduct(null);
                  setRestockSearchQuery('');
                  setRestockSizeAdds([]);
                  setRestockSelectedSize('');
                  setRestockColorAdds([]);
                  setRestockSelectedColor('');
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Select Product SKU</Text>
              <TextInput
                style={styles.formInput}
                value={restockSearchQuery}
                onChangeText={setRestockSearchQuery}
                placeholder="Search name or brand…"
                placeholderTextColor="#94A3B8"
              />

              {(!restockModalProduct || restockSearchQuery.trim()) && (
                <View style={{ maxHeight: 160, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {(products || [])
                      .filter((p) => {
                        const q = restockSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          (p.name || '').toLowerCase().includes(q) ||
                          (p.brand || '').toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 10)
                      .map((p) => (
                        <TouchableOpacity
                          key={p.id || p.product_id}
                          style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                          onPress={() => selectRestockProduct(p)}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{p.name}</Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
                            Stock {p.stock || 0} · ₱{Number(p.price || 0).toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {restockModalProduct ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      alignItems: 'center',
                      marginBottom: 12,
                      padding: 10,
                      backgroundColor: '#F8FAFC',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          restockModalProduct.image ||
                          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=200&q=80',
                      }}
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 10,
                        backgroundColor: '#E2E8F0',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                      }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>{restockModalProduct.name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                        {restockModalProduct.brand} · {restockModalProduct.category}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#1D4533', fontWeight: '700', marginTop: 2 }}>
                        Current stock: {restockModalProduct.stock || 0} · Cost ₱
                        {Number(restockModalProduct.unit_cost ?? restockModalProduct.unitCost ?? 0).toLocaleString()} · Price ₱
                        {Number(restockModalProduct.price || 0).toLocaleString()}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setRestockModalProduct(null);
                          setRestockSizeAdds([]);
                          setRestockSelectedSize('');
                          setRestockSearchQuery('');
                        }}
                        style={{ marginTop: 4 }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>Change product</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.formLabel}>Supplier</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[styles.filterPill, !restockSupplierId && styles.filterPillActive]}
                      onPress={() => setRestockSupplierId('')}
                    >
                      <Text style={[styles.filterPillText, !restockSupplierId && styles.filterPillTextActive]}>
                        No supplier
                      </Text>
                    </TouchableOpacity>
                    {(suppliers || []).slice(0, 8).map((s) => {
                      const sid = s.supplier_id || s.id;
                      return (
                        <TouchableOpacity
                          key={sid}
                          style={[styles.filterPill, restockSupplierId === sid && styles.filterPillActive]}
                          onPress={() => setRestockSupplierId(sid)}
                        >
                          <Text style={[styles.filterPillText, restockSupplierId === sid && styles.filterPillTextActive]}>
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* ─── SIZE PICKER SECTION ─── */}
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
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
                                    gap: 5,
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 10,
                                    borderColor: isSelected ? '#1D4533' : '#CBD5E1',
                                    borderWidth: 1.5,
                                    backgroundColor: isSelected ? '#1D4533' : '#F8FAFC',
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
                                    fontSize: 12,
                                    fontWeight: '800',
                                    color: isSelected ? '#FFFFFF' : '#0F172A',
                                  }}
                                >
                                  {sz.label}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : '#E2E8F0',
                                    paddingHorizontal: 5,
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
                                gap: 5,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 10,
                                borderColor: restockSelectedSize === 'all' ? '#1D4533' : '#CBD5E1',
                                borderWidth: 1.5,
                                backgroundColor: restockSelectedSize === 'all' ? '#1D4533' : '#F8FAFC',
                              },
                            ]}
                            onPress={() => setRestockSelectedSize('all')}
                          >
                            <BootstrapIcon
                              name="grid-3x3-gap-fill"
                              size={11}
                              color={restockSelectedSize === 'all' ? '#FFFFFF' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '800',
                                color: restockSelectedSize === 'all' ? '#FFFFFF' : '#0F172A',
                              }}
                            >
                              All Sizes
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
                                marginTop: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: '#F0FDFA',
                                borderWidth: 1,
                                borderColor: '#CCFBF1',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 11, color: '#0F766E', fontWeight: '700' }}>
                                Restocking: <Text style={{ fontWeight: '900' }}>{restockSelectedSize}</Text> ({curStock} units)
                              </Text>
                              <Text style={{ fontSize: 11, color: '#059669', fontWeight: '800' }}>
                                → {curStock + addQty} units
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    );
                  })()}

                  {/* ─── COLOR PICKER SECTION ─── */}
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
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
                                    gap: 5,
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 10,
                                    borderColor: isSelected ? '#1D4533' : '#CBD5E1',
                                    borderWidth: 1.5,
                                    backgroundColor: isSelected ? '#1D4533' : '#F8FAFC',
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
                                    fontSize: 12,
                                    fontWeight: '800',
                                    color: isSelected ? '#FFFFFF' : '#0F172A',
                                  }}
                                >
                                  {c.label}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : '#E2E8F0',
                                    paddingHorizontal: 5,
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
                          {/* All Colors (Multi-restock) button */}
                          <TouchableOpacity
                            style={[
                              styles.filterPill,
                              restockSelectedColor === 'all' && styles.filterPillActive,
                              {
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 10,
                                borderColor: restockSelectedColor === 'all' ? '#1D4533' : '#CBD5E1',
                                borderWidth: 1.5,
                                backgroundColor: restockSelectedColor === 'all' ? '#1D4533' : '#F8FAFC',
                              },
                            ]}
                            onPress={() => setRestockSelectedColor('all')}
                          >
                            <BootstrapIcon
                              name="grid-3x3-gap-fill"
                              size={11}
                              color={restockSelectedColor === 'all' ? '#FFFFFF' : '#64748B'}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '800',
                                color: restockSelectedColor === 'all' ? '#FFFFFF' : '#0F172A',
                              }}
                            >
                              All Colors
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
                                marginTop: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: '#F0FDFA',
                                borderWidth: 1,
                                borderColor: '#CCFBF1',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 11, color: '#0F766E', fontWeight: '700' }}>
                                Restocking: <Text style={{ fontWeight: '900' }}>{restockSelectedColor}</Text> ({curStock} units)
                              </Text>
                              <Text style={{ fontSize: 11, color: '#059669', fontWeight: '800' }}>
                                → {curStock + addQty} units
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
                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                            Enter how many units to add for each color.
                          </Text>
                          {restockColorAdds.map((row, idx) => (
                            <View
                              key={row.label}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 6,
                              }}
                            >
                              <View style={{ flex: 1.2 }}>
                                {row.hex ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: row.hex, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }} />
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>{row.label}</Text>
                                  </View>
                                ) : (
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>{row.label}</Text>
                                )}
                                <Text style={{ fontSize: 10, color: '#64748B' }}>Now: {row.currentStock}</Text>
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
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
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
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>
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
                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                            Enter how many units to add for each size.
                          </Text>
                          {restockSizeAdds.map((row, idx) => (
                            <View
                              key={row.label}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 6,
                              }}
                            >
                              <View style={{ flex: 1.2 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>
                                  {row.label}
                                </Text>
                                <Text style={{ fontSize: 10, color: '#64748B' }}>
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
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
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
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>
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
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 8 }}>
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

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Cost / Purchase (₱)</Text>
                      <TextInput
                        style={styles.formInput}
                        keyboardType="numeric"
                        value={restockUnitCost}
                        onChangeText={setRestockUnitCost}
                        placeholder="Paid to supplier"
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
                    return (
                      <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#0F766E' }}>Expense & Profit preview</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309' }}>
                          Expense (paid to supplier): ₱{expense.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: profitUnit >= 0 ? '#059669' : '#DC2626' }}>
                          Profit/unit: ₱{profitUnit.toLocaleString()} ({margin.toFixed(1)}%)
                        </Text>
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          If all {qty || 0} units sell: ₱{expected.toLocaleString()} profit
                        </Text>
                      </View>
                    );
                  })()}
                </>
              ) : (
                <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
                  Search and select a product, then enter quantity and cost — same idea as adding an SKU.
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  setIsRestockModalOpen(false);
                  setRestockModalProduct(null);
                  setRestockSearchQuery('');
                  setRestockSizeAdds([]);
                  setRestockSelectedSize('');
                  setRestockColorAdds([]);
                  setRestockSelectedColor('');
                }}
              >
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

      {/* ─── MODAL 4: DIGITAL POS THERMAL RECEIPT ─── */}
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
            <View style={styles.modalSheet}>
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
                          borderColor: soldOut ? '#FECACA' : active ? '#1D4533' : '#E2E8F0',
                          backgroundColor: soldOut ? '#FEF2F2' : active ? '#1D4533' : '#F8FAFC',
                          minWidth: 110,
                          opacity: soldOut ? 0.7 : 1,
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: soldOut ? '#991B1B' : active ? '#FFFFFF' : '#0F172A',
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

      {posReceiptOrder && (
        <Modal visible={Boolean(posReceiptOrder)} transparent animationType="fade" onRequestClose={() => setPosReceiptOrder(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.receiptSheet}>
              <Text style={styles.receiptLogo}>MotoTrack Performance</Text>
              <Text style={styles.receiptSub}>Official Counter POS Sales Invoice</Text>
              <Text style={styles.receiptSub}>Receipt No: {posReceiptOrder.order_id} • {posReceiptOrder.order_date}</Text>

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
                  <Text style={[styles.receiptTextBold, { fontSize: 11.5 }]} numberOfLines={1}>{it.name}</Text>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptText}>  {it.quantity} x ₱{it.price?.toLocaleString()}</Text>
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
                  <Text style={[styles.receiptTextBold, { color: '#059669' }]}>-₱{posReceiptOrder.discount_amount?.toLocaleString()}</Text>
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
                    <Text style={styles.receiptTextBold}>₱{posReceiptOrder.amount_tendered?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptText}>Change Given:</Text>
                    <Text style={[styles.receiptTextBold, { color: '#059669' }]}>₱{posReceiptOrder.change_amount?.toLocaleString()}</Text>
                  </View>
                </>
              )}

              <View style={styles.receiptBarcode}>
                <Text style={styles.receiptBarcodeText}>|||||||| | ||||| |||| | |||||||</Text>
              </View>

              <Text style={[styles.receiptSub, { marginTop: 6 }]}>Thank you for choosing MotoTrack! Drive safe.</Text>

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

      {/* ─── MODAL 5: CREATE PROMO CODE ─── */}
      <Modal visible={isAddPromoOpen} transparent animationType="fade" onRequestClose={() => setIsAddPromoOpen(false)}>
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
              <TextInput style={styles.formInput} value={newPromoCode} onChangeText={setNewPromoCode} placeholder="e.g. MOTO25" autoCapitalize="characters" placeholderTextColor="#94A3B8" />

              <Text style={styles.formLabel}>Discount Percentage (%)</Text>
              <TextInput style={styles.formInput} keyboardType="numeric" value={newPromoPercent} onChangeText={setNewPromoPercent} placeholder="20" placeholderTextColor="#94A3B8" />

              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={styles.formInput} value={newPromoDesc} onChangeText={setNewPromoDesc} placeholder="Special track season voucher" placeholderTextColor="#94A3B8" />
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
          <View style={[styles.modalSheet, { maxWidth: 480, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRider ? 'Edit Rider Account' : 'Create Rider Account'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddRiderModalOpen(false);
                  setEditingRider(null);
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingVertical: 8 }}>
              <Text style={styles.formLabel}>Avatar Preset</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {RIDER_AVATAR_PRESETS.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => setRiderAvatar(url)}>
                    <Image
                      source={{ uri: url }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        borderWidth: riderAvatar === url ? 2.5 : 1,
                        borderColor: riderAvatar === url ? '#1D4533' : '#CBD5E1',
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

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

              <Text style={styles.formLabel}>Short Name</Text>
              <TextInput
                style={styles.formInput}
                value={riderShortName}
                onChangeText={setRiderShortName}
                placeholder="e.g. Juan"
                placeholderTextColor="#94A3B8"
              />

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
                style={styles.formInput}
                value={riderIdInput}
                onChangeText={setRiderIdInput}
                placeholder="e.g. rider-juan"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                editable={!editingRider}
              />

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

              <Text style={styles.formLabel}>Username *</Text>
              <TextInput
                style={styles.formInput}
                value={riderUsername}
                onChangeText={setRiderUsername}
                placeholder="rider.juan"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>
                {editingRider ? 'Temporary password (optional)' : 'Temporary password *'}
              </Text>
              <TextInput
                style={styles.formInput}
                value={riderPassword}
                onChangeText={setRiderPassword}
                placeholder={editingRider ? 'Leave blank to keep' : 'Min. 6 characters'}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                secureTextEntry
              />

              <Text style={styles.formLabel}>Account status</Text>
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
                        borderColor: isSelected ? '#1D4533' : '#CBD5E1',
                        backgroundColor: isSelected ? '#F3F7F6' : '#FFFFFF',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isSelected ? '#1D4533' : '#0F172A' }}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>Vehicle</Text>
              <TextInput
                style={styles.formInput}
                value={riderVehicle}
                onChangeText={setRiderVehicle}
                placeholder="e.g. Yamaha NMAX 155"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.formLabel}>Plate Number</Text>
              <TextInput
                style={styles.formInput}
                value={riderPlate}
                onChangeText={setRiderPlate}
                placeholder="e.g. NMX-1001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />

              <Text style={styles.formLabel}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {Object.values(RIDER_STATUSES).map((st) => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setRiderStatus(st)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: riderStatus === st ? '#1D4533' : '#CBD5E1',
                      backgroundColor: riderStatus === st ? '#F3F7F6' : '#FFFFFF',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: riderStatus === st ? '#1D4533' : '#0F172A',
                      }}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
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
                <Text style={styles.addBtnPrimaryText}>
                  {editingRider ? 'Save Changes' : 'Add Rider'}
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
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F7F6', justifyContent: 'center', alignItems: 'center' }}>
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
                <BootstrapIcon name="receipt" size={20} color={activeNav === 'orders' ? '#1D4533' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Orders & COD</Text>
                  <Text style={{ fontSize: 11, color: pendingCodCount > 0 ? '#D97706' : '#64748B', fontWeight: pendingCodCount > 0 ? '700' : '400' }}>
                    {pendingCodCount > 0 ? `⚠️ ${pendingCodCount} Pending COD` : `${orders.length} orders`}
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
                <BootstrapIcon name="ticket-perforated-fill" size={20} color={activeNav === 'promos' ? '#1D4533' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Promo Codes</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{promos.length} active vouchers</Text>
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
                <BootstrapIcon name="tools" size={20} color={activeNav === 'garage' ? '#1D4533' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Pitstop Services</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>PMS & Tuning</Text>
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
                <BootstrapIcon name="bicycle" size={20} color={activeNav === 'riders' ? '#1D4533' : '#475569'} />
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
                <BootstrapIcon name="people-fill" size={20} color={activeNav === 'users' ? '#1D4533' : '#475569'} />
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
                <BootstrapIcon name="database-fill-gear" size={20} color={activeNav === 'supabase' ? '#1D4533' : '#475569'} />
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
                <BootstrapIcon name="clipboard-data" size={20} color={activeNav === 'forecast' ? '#1D4533' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Forecast & Stock</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Demand & restock planner</Text>
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
                <BootstrapIcon name="bell-fill" size={20} color={activeNav === 'notifications' ? '#1D4533' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Notifications</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Alerts & Updates</Text>
                </View>
              </TouchableOpacity>

              {/* System Settings */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, activeNav === 'settings' && styles.mobileMoreCardActive]}
                onPress={() => {
                  setActiveNav('settings');
                  setIsMobileMoreOpen(false);
                }}
              >
                <BootstrapIcon name="gear-fill" size={20} color={activeNav === 'settings' ? '#1D4533' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>System Settings</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Store rules & maintenance</Text>
                </View>
              </TouchableOpacity>

              {/* Live Storefront */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, { backgroundColor: '#F3F7F6', borderColor: '#C8DDD3' }]}
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
                  onLogout?.();
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
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F7F6', justifyContent: 'center', alignItems: 'center' }}>
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
                    Placed on {selectedOrderForModal?.order_date || 'Recent'} • {selectedOrderForModal?.channel || 'Online Store'}
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
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
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
                    borderBottomColor: '#E2E8F0',
                    paddingBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: '#64748B',
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
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
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
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
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
                    <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '600', lineHeight: 18, flex: 1 }}>
                      {selectedOrderForModal?.customer_address || 'No address provided (Store Pickup)'}
                    </Text>
                  </View>
                </View>

                {/* Delivery Notes */}
                {selectedOrderForModal?.delivery_notes ? (
                  <View style={{ backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 2 }}>
                      DELIVERY NOTES / SPECIAL INSTRUCTIONS
                    </Text>
                    <Text style={{ fontSize: 12, color: '#0F172A', fontStyle: 'italic' }}>
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
                    borderTopColor: '#E2E8F0',
                  }}
                >
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 }}>
                      PAYMENT METHOD
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="credit-card-2-front-fill" size={13} color="#64748B" />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
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
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
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
                        color: '#64748B',
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
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: '#64748B',
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
                        ? `Confirmed${orderDeliveryDetail.admin_confirmed_at ? ` · ${new Date(orderDeliveryDetail.admin_confirmed_at).toLocaleString()}` : ''}`
                        : 'Waiting for admin to mark delivered'}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#334155' }}>
                      Rider report:{' '}
                      {orderDeliveryDetail.rider_reported_delivered
                        ? `Dropped off${orderDeliveryDetail.rider_reported_at ? ` · ${new Date(orderDeliveryDetail.rider_reported_at).toLocaleString()}` : ''}`
                        : 'Not reported yet — rider should call/text the store'}
                    </Text>
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
                        (selectedOrderForModal?.status || '').toLowerCase() === 'delivered' ||
                        orderDeliveryDetail.rider_reported_delivered)) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {!orderDeliveryDetail.rider_reported_delivered && (
                          <TouchableOpacity
                            style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                            onPress={() =>
                              setDeliveryAction({ mode: 'rider_report', order: selectedOrderForModal })
                            }
                          >
                            <BootstrapIcon name="bicycle" size={12} color="#B45309" />
                            <Text style={[styles.btnAdvanceOrderText, { color: '#B45309' }]}>Rider dropped off</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.btnAdvanceOrder, { paddingHorizontal: 10, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                          onPress={() =>
                            setDeliveryAction({ mode: 'mark_delivered', order: selectedOrderForModal })
                          }
                        >
                          <BootstrapIcon name="check-circle-fill" size={12} color="#047857" />
                          <Text style={[styles.btnAdvanceOrderText, { color: '#047857' }]}>Mark Delivered</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {orderDeliveryDetail.delivery_notes ? (
                      <Text style={{ fontSize: 12.5, color: '#64748B', fontStyle: 'italic' }}>
                        Notes: {orderDeliveryDetail.delivery_notes}
                      </Text>
                    ) : null}
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
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>No proof photo yet</Text>
                      )}
                      <TouchableOpacity
                        style={[styles.btnAdvanceOrder, { paddingHorizontal: 10 }]}
                        onPress={handleUploadProof}
                      >
                        <BootstrapIcon name="camera" size={12} color="#1D4ED8" />
                        <Text style={styles.btnAdvanceOrderText}>
                          {(orderDeliveryDetail.delivery_photo || orderDeliveryDetail.proof_of_delivery)
                            ? 'Replace Proof'
                            : 'Upload Proof'}
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
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
                  Order Items Breakdown
                </Text>

                {(selectedOrderForModal?.items || []).map((it, idx) => (
                  <View key={it.product_id || idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: idx < (selectedOrderForModal?.items?.length || 1) - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                    <Image
                      source={{ uri: it.image || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=200&q=80' }}
                      style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{it.name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>{it.brand || 'MotoTrack'} • Qty: {it.quantity || 1}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
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
            <View style={[styles.bottomNavIconWrap, activeNav === 'overview' && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon name="grid-1x2-fill" size={17} color={activeNav === 'overview' ? '#1D4533' : '#64748B'} />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'overview' && styles.bottomNavLabelActive]}>Dashboard</Text>
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
            <View style={[styles.bottomNavIconWrap, activeNav === 'inventory' && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon name="box-seam-fill" size={17} color={activeNav === 'inventory' ? '#1D4533' : '#64748B'} />
              {invStats.lowStockCount > 0 && (
                <View style={styles.bottomNavBadge}>
                  <Text style={styles.bottomNavBadgeText}>{invStats.lowStockCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'inventory' && styles.bottomNavLabelActive]}>Stock</Text>
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
              <BootstrapIcon name="cart-check-fill" size={17} color={activeNav === 'pos' ? '#1D4533' : '#64748B'} />
              {posCart.length > 0 && (
                <View style={styles.bottomNavBadge}>
                  <Text style={styles.bottomNavBadgeText}>{posCart.length}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'pos' && styles.bottomNavLabelActive]}>POS</Text>
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
            <View style={[styles.bottomNavIconWrap, activeNav === 'analytics' && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon name="graph-up-arrow" size={17} color={activeNav === 'analytics' ? '#1D4533' : '#64748B'} />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'analytics' && styles.bottomNavLabelActive]}>Analytics</Text>
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
            <View style={[styles.bottomNavIconWrap, activeNav === 'products' && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon name="tag-fill" size={17} color={activeNav === 'products' ? '#1D4533' : '#64748B'} />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'products' && styles.bottomNavLabelActive]}>Products</Text>
          </TouchableOpacity>

          {/* 6. More Options */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => setIsMobileMoreOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.bottomNavIconWrap, ['orders', 'promos', 'garage', 'users', 'supabase', 'forecast'].includes(activeNav) && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon name="three-dots" size={18} color={['orders', 'promos', 'garage', 'users', 'supabase', 'forecast'].includes(activeNav) ? '#1D4533' : '#64748B'} />
              {pendingCodCount > 0 && (
                <View style={[styles.bottomNavBadge, { backgroundColor: '#D97706' }]}>
                  <Text style={styles.bottomNavBadgeText}>{pendingCodCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.bottomNavLabel, ['orders', 'promos', 'garage', 'users', 'supabase', 'forecast'].includes(activeNav) && styles.bottomNavLabelActive]}>More</Text>
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
            setDeliveryTokenModal({ order: assignedOrder, bundle: tokenBundle });
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
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              overflow: 'hidden',
              maxHeight: '92%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                  Proof of delivery
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
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
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="x-lg" size={16} color="#334155" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
              {proofViewer?.uri ? (
                <Image
                  source={{ uri: proofViewer.uri }}
                  resizeMode="contain"
                  style={{
                    width: '100%',
                    height: 360,
                    borderRadius: 12,
                    backgroundColor: '#0F172A',
                  }}
                />
              ) : null}
              {proofViewer?.reportedAt ? (
                <Text style={{ fontSize: 13, color: '#334155' }}>
                  Reported:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {new Date(proofViewer.reportedAt).toLocaleString()}
                  </Text>
                </Text>
              ) : null}
              {proofViewer?.notes ? (
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#64748B',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    Rider notes
                  </Text>
                  <Text style={{ fontSize: 13, color: '#0F172A', lineHeight: 18 }}>
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
    </SafeAreaView>
  );
}
