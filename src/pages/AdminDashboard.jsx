import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
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
import { productService } from '../services/productService';
import { promoService } from '../services/promoService';
import { garageService } from '../services/garageService';
import { orderService } from '../services/orderService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { supabaseManager } from '../services/supabaseClient';
import { CATEGORY_NAMES, ADMIN_IMAGE_PRESETS } from '../data/motorParts';
import { BootstrapIcon } from '../components/common';
import { pickImageFromFile } from '../utils/imagePickerHelper';
import { systemSettingsService } from '../services/systemSettingsService';
import NotificationsPage from './NotificationsPage';

export default function AdminDashboard({ onNavigateToStore, onLogout }) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const { currentUser: authUser, adminLogin, login } = useAuth();
  const currentUser = authUser || authService.getCurrentUser() || {
    id: 'admin-default',
    name: 'Administrator',
    email: 'admin@mototrack.com',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  };

  // Active Navigation Tab: 'overview' | 'orders' | 'inventory' | 'pos' | 'analytics' | 'products' | 'promos' | 'garage' | 'users' | 'supabase'
  const [activeNav, setActiveNav] = useState('overview');

  // Core Data States
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [garageServices, setGarageServices] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // ─── ORDERS & COD MANAGEMENT STATE ───
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All'); // 'All' | 'Pending Approval' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All'); // 'All' | 'COD' | 'GCash' | 'Card'
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // ─── INVENTORY STATE ───
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invStockFilter, setInvStockFilter] = useState('All'); // 'All' | 'inStock' | 'lowStock' | 'outOfStock'
  const [invCategoryFilter, setInvCategoryFilter] = useState('All');
  const [restockModalProduct, setRestockModalProduct] = useState(null);
  const [restockAmount, setRestockAmount] = useState('10');

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

  // ─── ANALYTICS STATE ───
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'all'

  // ─── PRODUCTS & PRICE MANAGEMENT STATE ───
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // New Product Form Fields
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('Akrapovič');
  const [newProdCategory, setNewProdCategory] = useState('Exhaust');
  const [newProdPrice, setNewProdPrice] = useState('39000');
  const [newProdOldPrice, setNewProdOldPrice] = useState('42500');
  const [newProdStock, setNewProdStock] = useState('15');
  const [newProdBadge, setNewProdBadge] = useState('New');
  const [newProdImage, setNewProdImage] = useState(
    'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80'
  );
  const [newProdCompat, setNewProdCompat] = useState('Universal Superbike Fitment');
  const [newProdDesc, setNewProdDesc] = useState('Precision engineered high performance motorcycle upgrade component.');

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
  const [servPrice, setServPrice] = useState('4500');
  const [servDuration, setServDuration] = useState('60 mins');
  const [servBadge, setServBadge] = useState('Popular');
  const [servImage, setServImage] = useState(
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80'
  );
  const [servDesc, setServDesc] = useState('');
  const [servInclusions, setServInclusions] = useState('');

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
    return () => {
      unsubscribeProd();
      unsubscribeOrders();
    };
  }, []);

  // ─── INVENTORY COMPUTATIONS & ACTIONS ───
  const invStats = useMemo(() => {
    const totalSkus = products.length;
    const inStockCount = products.filter((p) => (p.stock || 0) >= 5).length;
    const lowStockCount = products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) < 5).length;
    const outOfStockCount = products.filter((p) => !p.stock || p.stock <= 0).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);
    const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    return { totalSkus, inStockCount, lowStockCount, outOfStockCount, totalValue, totalUnits };
  }, [products]);

  const filteredInventory = useMemo(() => {
    return products.filter((p) => {
      const matchCat = invCategoryFilter === 'All' || p.category.toLowerCase() === invCategoryFilter.toLowerCase();
      const q = invSearchQuery.toLowerCase().trim();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));

      let matchStock = true;
      if (invStockFilter === 'inStock') matchStock = (p.stock || 0) >= 5;
      else if (invStockFilter === 'lowStock') matchStock = (p.stock || 0) > 0 && (p.stock || 0) < 5;
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

  const handleExecuteRestock = async () => {
    if (!restockModalProduct) return;
    const amountNum = parseInt(restockAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      showAlert('Invalid Quantity', 'Please enter a valid positive restock number.');
      return;
    }

    await handleQuickAdjustStock(restockModalProduct.id, amountNum);
    setRestockModalProduct(null);
    setRestockAmount('10');
    showToast(`Restocked ${amountNum} units of "${restockModalProduct.name.slice(0, 18)}..."! 🚀`);
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

  const handlePOSAddToCart = (product) => {
    if (product.stock <= 0) {
      showToast('⚠️ Product is Out of Stock!');
      return;
    }

    setPosCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showToast(`⚠️ Only ${product.stock} units available in inventory.`);
          return prev;
        }
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [
        ...prev,
        {
          id: product.id,
          product_id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price,
          quantity: 1,
          image: product.image,
          stock: product.stock,
        },
      ];
    });
    showToast(`Added "${product.name.slice(0, 16)}..." to POS Cart 🛒`);
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
      // Deduct inventory
      await productService.deductStock(posCart);
      await loadData();

      // Show receipt modal
      setPosReceiptOrder(res.order);
      setPosCart([]);
      setPosTendered('');
      setPosDiscountCode('');
      setPosDiscountPercent(0);
      showToast('🎉 POS Sale Completed! Receipt generated.');
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
    const paymentBreakdown = { Cash: 0, Card: 0, GCash: 0, PayPal: 0 };
    allOrders.forEach((o) => {
      const pm = (o.payment_method || '').toLowerCase();
      if (pm.includes('cash')) paymentBreakdown.Cash += 1;
      else if (pm.includes('card') || pm.includes('apple') || pm.includes('credit')) paymentBreakdown.Card += 1;
      else if (pm.includes('gcash') || pm.includes('wallet')) paymentBreakdown.GCash += 1;
      else paymentBreakdown.PayPal += 1;
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
      .slice(0, 5);

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

  const handleUpdateStock = async (id, newStock) => {
    const parsed = parseInt(newStock, 10);
    if (isNaN(parsed) || parsed < 0) return;

    await productService.updateProduct(id, { stock: parsed });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock: parsed } : p)));
    showToast(`Stock updated to ${parsed} units`);
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    await productService.updateProduct(editingProduct.id, editingProduct);
    setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? editingProduct : p)));
    setEditingProduct(null);
    showToast(`Saved changes for "${editingProduct.name.slice(0, 18)}..."`);
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

    const created = await productService.addProduct({
      name: newProdName,
      brand: newProdBrand,
      category: newProdCategory,
      price: parseFloat(newProdPrice),
      oldPrice: newProdOldPrice ? parseFloat(newProdOldPrice) : undefined,
      stock: parseInt(newProdStock, 10) || 10,
      badge: newProdBadge,
      image: newProdImage || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
      compatibility: newProdCompat,
      description: newProdDesc || 'Precision engineered motorcycle upgrade part.',
    });

    if (created.success) {
      setProducts((prev) => [created.product, ...prev]);
      setIsAddProductOpen(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdOldPrice('');
      setNewProdDesc('');
      showToast(`Added new product "${created.product.name.slice(0, 18)}..."`);
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
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await userService.updateUserRole(userId, newRole);
    await loadData();
    showToast(`Updated user role to ${newRole === 'admin' ? 'Store Administrator 👑' : 'Customer 👤'}`);
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
    const shipped = orders.filter((o) => (o.status || '').toLowerCase() === 'shipped' || (o.status || '').toLowerCase() === 'in transit').length;
    const delivered = orders.filter((o) => (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed').length;
    const cancelled = orders.filter((o) => (o.status || '').toLowerCase() === 'cancelled').length;
    const totalRevenue = orders
      .filter((o) => (o.status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.grand_total) || Number(o.total_amount) || 0), 0);

    return { total, pendingCod, processing, shipped, delivered, cancelled, totalRevenue };
  }, [orders, pendingCodCount]);

  const filteredOrdersList = useMemo(() => {
    return orders.filter((o) => {
      const st = (o.status || 'Pending Approval').toLowerCase();
      let matchStatus = true;
      if (orderStatusFilter === 'Pending Approval') {
        matchStatus = st.includes('pending') || st.includes('approval');
      } else if (orderStatusFilter !== 'All') {
        matchStatus = st === orderStatusFilter.toLowerCase();
      }

      const pm = (o.payment_method || '').toLowerCase();
      let matchPayment = true;
      if (orderPaymentFilter === 'COD') matchPayment = pm.includes('cash') || pm.includes('cod');
      else if (orderPaymentFilter === 'GCash') matchPayment = pm.includes('gcash');
      else if (orderPaymentFilter === 'Card') matchPayment = pm.includes('card') || pm.includes('apple');

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

  const handleApproveCOD = async (orderId) => {
    const res = await orderService.approveCODOrder(orderId);
    if (res.success) {
      await loadData();
      showToast(`✅ Approved COD Order #${orderId.slice(0, 10)}! Moved to Packing.`);
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

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const res = await orderService.updateOrderStatus(orderId, newStatus);
    if (res.success) {
      await loadData();
      if (selectedOrderForModal && (selectedOrderForModal.order_id === orderId || selectedOrderForModal.id === orderId)) {
        setSelectedOrderForModal(res.order || { ...selectedOrderForModal, status: newStatus });
      }
      showToast(`Order status updated to "${newStatus}"`);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const proceed = async () => {
      await orderService.cancelOrder(orderId);
      await loadData();
      if (isOrderModalOpen) setIsOrderModalOpen(false);
      showToast(`Order #${orderId.slice(0, 10)} cancelled.`);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to cancel Order #${orderId}?`)) {
        await proceed();
      }
    } else {
      Alert.alert('Cancel Order', `Are you sure you want to cancel Order #${orderId}?`, [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel Order', style: 'destructive', onPress: proceed },
      ]);
    }
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
    overview: '📊 Store Overview & Activity',
    orders: '📦 Orders & COD Fulfillment Management',
    inventory: '📦 Inventory & Stock Telemetry',
    pos: '💻 Point of Sale (POS) Cashier Terminal',
    analytics: '📈 Sales Analytics & Reports',
    products: '🏷️ Products & Price Management',
    promos: '🎟️ Promo Vouchers & Discounts',
    garage: '🛠️ Garage Services (PMS & Tuning)',
    users: '👥 User Accounts Management',
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
            backgroundColor: '#0C6258',
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
              <Text style={styles.navHeading}>Operations</Text>
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
                    Overview
                  </Text>
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
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                      <Text style={{ color: '#92400E', fontSize: 10, fontWeight: '900' }}>{pendingCodCount} COD</Text>
                    </View>
                  ) : (
                    <View style={[styles.sidebarCountBadge, activeNav === 'orders' && styles.sidebarCountBadgeActive]}>
                      <Text style={[styles.sidebarCountText, activeNav === 'orders' && styles.sidebarCountTextActive]}>
                        {orders.length}
                      </Text>
                    </View>
                  )}
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
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ color: '#92400E', fontSize: 10.5, fontWeight: '800' }}>{invStats.lowStockCount} LOW</Text>
                    </View>
                  )}
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
                </TouchableOpacity>

                <Text style={styles.navHeading}>Store Management</Text>

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
                    Products & Prices
                  </Text>
                  <View style={[styles.sidebarCountBadge, activeNav === 'products' && styles.sidebarCountBadgeActive]}>
                    <Text style={[styles.sidebarCountText, activeNav === 'products' && styles.sidebarCountTextActive]}>
                      {products.length}
                    </Text>
                  </View>
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
                </TouchableOpacity>

                {/* ─── SECTION 3: GARAGE & SERVICES ─── */}
                <Text style={styles.navHeading}>Garage & Services</Text>

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
                    Garage Services
                  </Text>
                </TouchableOpacity>

                {/* ─── SECTION 4: USER MANAGEMENT ─── */}
                <Text style={styles.navHeading}>User Management</Text>

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
                </TouchableOpacity>

                {/* ─── SECTION 5: SYSTEM & SETTINGS ─── */}
                <Text style={styles.navHeading}>System & Settings</Text>

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
                </TouchableOpacity>

                {/* ─── SECTION 6: QUICK LINKS ─── */}
                <Text style={styles.navHeading}>Quick Links</Text>

                {/* 13. Live Storefront Link */}
                <TouchableOpacity style={styles.sidebarNavItem} onPress={onNavigateToStore} activeOpacity={0.8}>
                  <View style={{ width: 22, alignItems: 'center' }}>
                    <BootstrapIcon name="shop" size={16} color="#0C6258" />
                  </View>
                  <Text style={[styles.sidebarNavLabel, { color: '#0C6258', fontWeight: '800' }]}>Live Storefront</Text>
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
                  style={[styles.addBtnPrimary, { backgroundColor: '#0C6258' }]}
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
                <TouchableOpacity
                  style={styles.addBtnPrimary}
                  onPress={() => setIsAddProductOpen(true)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add New Product SKU' : '+ SKU'}</Text>
                </TouchableOpacity>
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
                    setIsAddGarageOpen(true);
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={styles.addBtnPrimaryText}>{isDesktop ? 'Add Pitstop Package' : '+ Service'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => setActiveNav('notifications')}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="bell-fill" size={13} color="#0C6258" />
                {isDesktop && <Text style={styles.quickStoreBtnText}>Notifications</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickStoreBtn} onPress={onNavigateToStore}>
                <BootstrapIcon name="box-arrow-up-right" size={12} color="#0C6258" />
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
            {activeNav === 'overview' && (
              <View>
                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="currency-dollar" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Total Store Revenue</Text>
                    <Text style={styles.statValue}>₱{analyticsData.totalRevenue.toLocaleString()}</Text>
                    <Text style={styles.statSub}>Online + Walk-in POS</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="box-seam" size={18} color="#10B981" />
                    </View>
                    <Text style={styles.statLabel}>Active SKUs</Text>
                    <Text style={styles.statValue}>{products.length}</Text>
                    <Text style={styles.statSub}>{invStats.totalUnits} total units in stock</Text>
                  </View>

                  <View style={[styles.statCard, invStats.lowStockCount > 0 ? styles.statCardWarningAccent : styles.statCardSuccessAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="exclamation-triangle-fill" size={18} color={invStats.lowStockCount > 0 ? '#F59E0B' : '#10B981'} />
                    </View>
                    <Text style={styles.statLabel}>Stock Alerts</Text>
                    <Text style={[styles.statValue, invStats.lowStockCount > 0 && { color: '#D97706' }]}>
                      {invStats.lowStockCount} Low / {invStats.outOfStockCount} Out
                    </Text>
                    <Text style={styles.statSub}>Needs reorder attention</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="receipt" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Dispatches & Orders</Text>
                    <Text style={styles.statValue}>{orders.length}</Text>
                    <Text style={styles.statSub}>
                      {analyticsData.posOrdersCount} POS / {analyticsData.onlineOrdersCount} Online
                    </Text>
                  </View>
                </View>

                {/* Urgent Pending COD Approvals Alert in Overview */}
                {pendingCodCount > 0 && (
                  <View style={[styles.codAlertBanner, { marginBottom: 20 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FDE68A', justifyContent: 'center', alignItems: 'center' }}>
                        <BootstrapIcon name="shield-lock-fill" size={20} color="#92400E" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.codAlertBannerText}>
                          ⚠️ {pendingCodCount} Cash on Delivery order(s) awaiting store verification
                        </Text>
                        <Text style={styles.codAlertBannerSub}>
                          Review recipient shipping address and click "Approve COD" to authorize warehouse packing.
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.approveAllCodBtn}
                        onPress={handleApproveAllPendingCOD}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="check2-circle" size={14} color="#FFFFFF" />
                        <Text style={styles.approveAllCodBtnText}>Approve All ({pendingCodCount})</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addBtnPrimary, { backgroundColor: '#92400E', paddingHorizontal: 14, paddingVertical: 8 }]}
                        onPress={() => {
                          setOrderStatusFilter('Pending Approval');
                          setActiveNav('orders');
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Review Orders</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Quick Action Banner */}
                <View style={[styles.tableCard, { padding: 22, marginBottom: 24, backgroundColor: '#FFFFFF' }]}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                    Backoffice Quick Control Center
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 13.5, lineHeight: 20, marginBottom: 20 }}>
                    Manage customer orders and Cash on Delivery approvals, audit warehouse inventory levels, process in-store walk-in sales via POS, and track revenue telemetry.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={[styles.addBtnPrimary, { backgroundColor: '#0C6258', flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                      onPress={() => setActiveNav('orders')}
                    >
                      <BootstrapIcon name="receipt" size={15} color="#FFFFFF" />
                      <Text style={styles.addBtnPrimaryText}>
                        Manage Orders & COD {pendingCodCount > 0 ? `(${pendingCodCount} Pending)` : ''}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addBtnPrimary, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                      onPress={() => setActiveNav('pos')}
                    >
                      <BootstrapIcon name="cart-check-fill" size={15} color="#0C6258" />
                      <Text style={[styles.addBtnPrimaryText, { color: '#0C6258' }]}>Launch POS Cashier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addBtnPrimary, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                      onPress={() => setActiveNav('inventory')}
                    >
                      <BootstrapIcon name="box-seam-fill" size={15} color="#0C6258" />
                      <Text style={[styles.addBtnPrimaryText, { color: '#0C6258' }]}>Audit Inventory</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addBtnPrimary, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                      onPress={() => setActiveNav('analytics')}
                    >
                      <BootstrapIcon name="graph-up-arrow" size={15} color="#0C6258" />
                      <Text style={[styles.addBtnPrimaryText, { color: '#0C6258' }]}>Revenue Analytics</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Recent Transactions Table */}
                <View style={styles.tableCard}>
                  <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>Recent Orders & POS Sales</Text>
                    <TouchableOpacity onPress={() => setActiveNav('orders')}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0C6258' }}>View All Orders ({orders.length}) →</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 640 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Order Ref</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Customer</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Channel</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Amount</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'center' }]}>Status</Text>
                      </View>

                      {orders.slice(0, 5).map((o, idx) => (
                        <View key={o.order_id || idx} style={styles.tableRow}>
                          <Text style={[styles.tableTitle, { flex: 1.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12.5 }]}>
                            {o.order_id || o.id}
                          </Text>
                          <View style={{ flex: 2 }}>
                            <Text style={styles.tableTitle}>{o.customer_name || 'Customer'}</Text>
                            <Text style={styles.tableSub}>{o.order_date || 'Recent'}</Text>
                          </View>
                          <View style={{ flex: 1.5 }}>
                            <View style={{ backgroundColor: o.channel === 'POS (In-Store)' ? '#F3F7F6' : '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' }}>
                              <Text style={{ color: o.channel === 'POS (In-Store)' ? '#0C6258' : '#1D4ED8', fontSize: 11, fontWeight: '800' }}>
                                {o.channel || 'Online Store'}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.tableTitle, { flex: 1.5, textAlign: 'right', color: '#0C6258', fontWeight: '900' }]}>
                            ₱{(Number(o.grand_total) || Number(o.total_amount) || 0).toLocaleString()}
                          </Text>
                          <View style={{ flex: 1.5, alignItems: 'center' }}>
                            <View style={{
                              backgroundColor: (o.status || '').toLowerCase().includes('pending') ? '#FEF3C7' : '#D1FAE5',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6
                            }}>
                              <Text style={{
                                color: (o.status || '').toLowerCase().includes('pending') ? '#92400E' : '#065F46',
                                fontSize: 11,
                                fontWeight: '800'
                              }}>
                                {(o.status || '').toLowerCase().includes('pending') ? '⏳ Pending COD' : (o.status || 'Completed')}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
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
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={styles.statIconWrap}>
                      <BootstrapIcon name="receipt" size={18} color="#0C6258" />
                    </View>
                    <Text style={styles.statLabel}>Total Orders</Text>
                    <Text style={styles.statValue}>{orderStats.total}</Text>
                    <Text style={styles.statSub}>₱{orderStats.totalRevenue.toLocaleString()} volume</Text>
                  </View>

                  <View style={[styles.statCard, orderStats.pendingCod > 0 ? styles.statCardWarningAccent : styles.statCardSuccessAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: orderStats.pendingCod > 0 ? '#FEF3C7' : '#ECFDF5' }]}>
                      <BootstrapIcon name="shield-lock-fill" size={18} color={orderStats.pendingCod > 0 ? '#D97706' : '#10B981'} />
                    </View>
                    <Text style={styles.statLabel}>Pending COD Approvals</Text>
                    <Text style={[styles.statValue, { color: orderStats.pendingCod > 0 ? '#D97706' : '#047857' }]}>
                      {orderStats.pendingCod}
                    </Text>
                    <Text style={styles.statSub}>Requires Admin action</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <BootstrapIcon name="box-seam-fill" size={18} color="#1D4ED8" />
                    </View>
                    <Text style={styles.statLabel}>Packing & Processing</Text>
                    <Text style={[styles.statValue, { color: '#1D4ED8' }]}>{orderStats.processing}</Text>
                    <Text style={styles.statSub}>Ready for courier pickup</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#F3E8FF' }]}>
                      <BootstrapIcon name="truck" size={18} color="#9333EA" />
                    </View>
                    <Text style={styles.statLabel}>In Transit & Shipped</Text>
                    <Text style={[styles.statValue, { color: '#9333EA' }]}>{orderStats.shipped}</Text>
                    <Text style={styles.statSub}>On the road with courier</Text>
                  </View>
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
                          color={orderPaymentFilter !== 'All' ? '#0C6258' : '#64748B'}
                        />
                        <Text style={[styles.paymentDropdownTriggerText, orderPaymentFilter !== 'All' && { color: '#0C6258', fontWeight: '800' }]}>
                          {orderPaymentFilter === 'All'
                            ? 'All Payments'
                            : orderPaymentFilter === 'COD'
                            ? 'COD Only'
                            : orderPaymentFilter === 'GCash'
                            ? 'GCash'
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
                              { key: 'Card', label: 'Credit / Debit Card', emoji: '💳' },
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
                                    <BootstrapIcon name="check2" size={14} color="#0C6258" />
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
                    { key: 'Shipped', label: `🚚 Shipped (${orderStats.shipped})` },
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
                      <BootstrapIcon name="arrow-repeat" size={13} color="#0C6258" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#0C6258' }}>Refresh</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 920 }}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Order Ref & Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.4 }]}>Customer & Destination</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Items Summary</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Payment Method</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.4, textAlign: 'right' }]}>Total</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'center' }]}>Status</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 2.6, textAlign: 'center' }]}>Fulfillment Actions</Text>
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
                          const orderId = o.order_id || o.id;
                          const st = (o.status || 'Pending Approval').toLowerCase();
                          const isPending = st.includes('pending') || st.includes('approval');
                          const isProcessing = st === 'processing';
                          const isShipped = st === 'shipped' || st === 'in transit';
                          const isDelivered = st === 'delivered' || st === 'completed';
                          const isCancelled = st === 'cancelled';
                          const isCOD = (o.payment_method || '').toLowerCase().includes('cash') || (o.payment_method || '').includes('COD');

                          return (
                            <View
                              key={orderId || idx}
                              style={[
                                styles.tableRow,
                                isPending && { backgroundColor: '#FFFBEB' },
                              ]}
                            >
                              {/* 1. Order Ref */}
                              <View style={{ flex: 1.6 }}>
                                <Text style={[styles.tableTitle, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12.5, fontWeight: '900', color: '#0F172A' }]}>
                                  {orderId}
                                </Text>
                                <Text style={styles.tableSub}>{o.order_date || 'Recent'}</Text>
                                <View style={{ backgroundColor: o.channel === 'POS (In-Store)' ? '#F3F7F6' : '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                                  <Text style={{ color: o.channel === 'POS (In-Store)' ? '#0C6258' : '#1D4ED8', fontSize: 9.5, fontWeight: '800' }}>
                                    {o.channel || 'Online Store'}
                                  </Text>
                                </View>
                              </View>

                              {/* 2. Customer & Address */}
                              <View style={{ flex: 2.4 }}>
                                <Text style={[styles.tableTitle, { fontWeight: '800' }]}>{o.customer_name || 'Walk-in Customer'}</Text>
                                {o.customer_phone && <Text style={styles.tableSub}>📞 {o.customer_phone}</Text>}
                                {o.customer_address && (
                                  <Text style={[styles.tableSub, { color: '#475569', fontSize: 11 }]} numberOfLines={1}>
                                    📍 {o.customer_address}
                                  </Text>
                                )}
                                {o.cod_change_for && (
                                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 3 }}>
                                    <Text style={{ color: '#92400E', fontSize: 10, fontWeight: '700' }}>
                                      💵 Change for ₱{Number(o.cod_change_for).toLocaleString()}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* 3. Items Summary */}
                              <View style={{ flex: 2.2 }}>
                                <Text style={[styles.tableTitle, { fontSize: 12 }]} numberOfLines={2}>
                                  {o.items_summary || (o.items ? `${o.items.length} items` : 'Motorcycle Parts')}
                                </Text>
                                <Text style={styles.tableSub}>{o.items_count || (o.items ? o.items.length : 1)} item(s)</Text>
                              </View>

                              {/* 4. Payment Method */}
                              <View style={{ flex: 1.6 }}>
                                <View
                                  style={{
                                    backgroundColor: isCOD ? '#FEF3C7' : '#EFF6FF',
                                    borderWidth: 1,
                                    borderColor: isCOD ? '#FDE68A' : '#BFDBFE',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: isCOD ? '#92400E' : '#1D4ED8',
                                      fontSize: 11,
                                      fontWeight: '800',
                                    }}
                                  >
                                    {isCOD ? '💵 Cash on Delivery' : o.payment_method || 'Online'}
                                  </Text>
                                </View>
                              </View>

                              {/* 5. Grand Total */}
                              <View style={{ flex: 1.4, alignItems: 'flex-end' }}>
                                <Text style={[styles.tableTitle, { color: '#0C6258', fontWeight: '900', fontSize: 13.5 }]}>
                                  ₱{(Number(o.grand_total) || Number(o.total_amount) || 0).toLocaleString()}
                                </Text>
                              </View>

                              {/* 6. Status Badge */}
                              <View style={{ flex: 1.8, alignItems: 'center' }}>
                                <View
                                  style={{
                                    backgroundColor: isPending
                                      ? '#FEF3C7'
                                      : isProcessing
                                      ? '#EFF6FF'
                                      : isShipped
                                      ? '#F3E8FF'
                                      : isDelivered
                                      ? '#D1FAE5'
                                      : '#FEE2E2',
                                    borderWidth: 1,
                                    borderColor: isPending
                                      ? '#FDE68A'
                                      : isProcessing
                                      ? '#BFDBFE'
                                      : isShipped
                                      ? '#E9D5FF'
                                      : isDelivered
                                      ? '#A7F3D0'
                                      : '#FECACA',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: isPending
                                        ? '#92400E'
                                        : isProcessing
                                        ? '#1D4ED8'
                                        : isShipped
                                        ? '#7E22CE'
                                        : isDelivered
                                        ? '#065F46'
                                        : '#DC2626',
                                      fontSize: 10.5,
                                      fontWeight: '900',
                                    }}
                                  >
                                    {isPending
                                      ? '⏳ Pending COD'
                                      : isProcessing
                                      ? '⚙️ Processing'
                                      : isShipped
                                      ? '🚚 Shipped'
                                      : isDelivered
                                      ? '✅ Delivered'
                                      : '❌ Cancelled'}
                                  </Text>
                                </View>
                              </View>

                              {/* 7. Fulfillment Actions */}
                              <View style={{ flex: 2.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                {/* One-Click Approve COD Button */}
                                {isPending && (
                                  <TouchableOpacity
                                    style={styles.btnApproveCod}
                                    onPress={() => handleApproveCOD(orderId)}
                                    activeOpacity={0.85}
                                  >
                                    <BootstrapIcon name="check-circle-fill" size={12} color="#FFFFFF" />
                                    <Text style={styles.btnApproveCodText}>Approve COD</Text>
                                  </TouchableOpacity>
                                )}

                                {/* Advance from Processing to Shipped */}
                                {isProcessing && (
                                  <TouchableOpacity
                                    style={styles.btnAdvanceOrder}
                                    onPress={() => handleUpdateOrderStatus(orderId, 'Shipped')}
                                    activeOpacity={0.85}
                                  >
                                    <BootstrapIcon name="truck" size={12} color="#1D4ED8" />
                                    <Text style={styles.btnAdvanceOrderText}>Ship</Text>
                                  </TouchableOpacity>
                                )}

                                {/* Advance from Shipped to Delivered */}
                                {isShipped && (
                                  <TouchableOpacity
                                    style={[styles.btnAdvanceOrder, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                                    onPress={() => handleUpdateOrderStatus(orderId, 'Delivered')}
                                    activeOpacity={0.85}
                                  >
                                    <BootstrapIcon name="check-circle" size={12} color="#059669" />
                                    <Text style={[styles.btnAdvanceOrderText, { color: '#059669' }]}>Deliver</Text>
                                  </TouchableOpacity>
                                )}

                                {/* View Details Modal Button */}
                                <TouchableOpacity
                                  style={styles.btnViewOrder}
                                  onPress={() => {
                                    setSelectedOrderForModal(o);
                                    setIsOrderModalOpen(true);
                                  }}
                                  activeOpacity={0.85}
                                >
                                  <BootstrapIcon name="eye" size={12} color="#334155" />
                                  <Text style={styles.btnViewOrderText}>Details</Text>
                                </TouchableOpacity>

                                {/* Cancel Button */}
                                {!isDelivered && !isCancelled && (
                                  <TouchableOpacity
                                    style={styles.btnCancelOrder}
                                    onPress={() => handleCancelOrder(orderId)}
                                    activeOpacity={0.85}
                                  >
                                    <BootstrapIcon name="x-lg" size={11} color="#DC2626" />
                                  </TouchableOpacity>
                                )}
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

            {/* ─── TAB 2: INVENTORY & STOCK MANAGEMENT ─── */}
            {activeNav === 'inventory' && (
              <View>
                {/* Inventory KPI Summary Cards */}
                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <Text style={styles.statLabel}>Total Inventory Value</Text>
                    <Text style={styles.statValue}>₱{invStats.totalValue.toLocaleString()}</Text>
                    <Text style={styles.statSub}>Across {invStats.totalUnits} items</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <Text style={styles.statLabel}>In Stock SKUs</Text>
                    <Text style={[styles.statValue, { color: '#047857' }]}>{invStats.inStockCount}</Text>
                    <Text style={styles.statSub}>5+ units on hand</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardWarningAccent]}>
                    <Text style={styles.statLabel}>Low Stock Alert</Text>
                    <Text style={[styles.statValue, { color: '#D97706' }]}>{invStats.lowStockCount}</Text>
                    <Text style={styles.statSub}>1 - 4 units remaining</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardDangerAccent]}>
                    <Text style={styles.statLabel}>Out of Stock</Text>
                    <Text style={[styles.statValue, { color: '#DC2626' }]}>{invStats.outOfStockCount}</Text>
                    <Text style={styles.statSub}>0 units available</Text>
                  </View>
                </View>

                {/* Low Stock Warning Banner */}
                {invStats.lowStockCount > 0 && (
                  <View style={styles.inventoryAlertBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <BootstrapIcon name="exclamation-triangle-fill" size={18} color="#D97706" />
                      <Text style={styles.inventoryAlertText}>
                        Attention: {invStats.lowStockCount} product(s) have fallen below the safe threshold of 5 units. Please restock to avoid order delays.
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

                  {/* Stock Status Filter Pills */}
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { key: 'All', label: 'All SKUs' },
                      { key: 'inStock', label: '✅ In Stock' },
                      { key: 'lowStock', label: '⚠️ Low Stock' },
                      { key: 'outOfStock', label: '⛔ Out of Stock' },
                    ].map((f) => (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.filterPill, invStockFilter === f.key && styles.filterPillActive]}
                        onPress={() => setInvStockFilter(f.key)}
                      >
                        <Text style={[styles.filterPillText, invStockFilter === f.key && styles.filterPillTextActive]}>
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
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
                      const isLow = (p.stock || 0) > 0 && (p.stock || 0) < 5;
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

                          <Text style={[styles.tableTitle, { flex: 1.2, textAlign: 'right', color: '#0C6258' }]}>
                            ₱{p.price?.toLocaleString()}
                          </Text>

                          {/* Quick Adjust Buttons */}
                          <View style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.stockMiniBtn}
                              onPress={() => handleQuickAdjustStock(p.id, -1)}
                            >
                              <Text style={styles.stockMiniBtnText}>-</Text>
                            </TouchableOpacity>

                            <TextInput
                              style={[styles.tableInputInline, { width: 50 }]}
                              keyboardType="numeric"
                              defaultValue={String(p.stock || 0)}
                              onEndEditing={(e) => handleUpdateStock(p.id, e.nativeEvent.text)}
                            />

                            <TouchableOpacity
                              style={styles.stockMiniBtn}
                              onPress={() => handleQuickAdjustStock(p.id, 1)}
                            >
                              <Text style={styles.stockMiniBtnText}>+</Text>
                            </TouchableOpacity>
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
                              style={[styles.actionIconBtn, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                              onPress={() => {
                                setRestockModalProduct(p);
                                setRestockAmount('10');
                              }}
                            >
                              <BootstrapIcon name="box-arrow-in-down" size={13} color="#0C6258" />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0C6258' }}>Restock</Text>
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
                          <Image source={{ uri: p.image }} style={styles.posProductImg} />
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
                            <BootstrapIcon name="plus-lg" size={12} color="#0C6258" />
                            <Text style={styles.posAddBtnText}>Add to Cart</Text>
                          </TouchableOpacity>
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
                        <BootstrapIcon name="cart3" size={18} color="#0C6258" />
                        <Text style={styles.posRegisterTitle}>POS Cashier Register</Text>
                      </View>
                      <View style={{ backgroundColor: '#F3F7F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: '#0C6258', fontSize: 11, fontWeight: '800' }}>
                          {posCart.length} Item(s)
                        </Text>
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
                          <BootstrapIcon name="person-circle" size={16} color="#0C6258" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                            {posSelectedCustomer.name}
                          </Text>
                        </View>
                        <BootstrapIcon name={posCustomerDropdownOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#64748B" />
                      </TouchableOpacity>

                      {/* Dropdown Customer Options */}
                      {posCustomerDropdownOpen && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', maxHeight: 150 }}>
                          <ScrollView>
                            <TouchableOpacity
                              style={{ paddingVertical: 6 }}
                              onPress={() => {
                                setPosSelectedCustomer({ id: 'walkin', name: 'Walk-in Customer', phone: 'N/A' });
                                setPosCustomerDropdownOpen(false);
                              }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0C6258' }}>👤 Walk-in Customer</Text>
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
                                <Text style={{ fontSize: 12.5, color: '#334155', fontWeight: '600' }}>
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
                      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Cart is currently empty</Text>
                        <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Click any product part on the left to begin sale</Text>
                      </View>
                    ) : (
                      <ScrollView style={styles.posCartItemsList}>
                        {posCart.map((item) => (
                          <View key={item.id} style={styles.posCartItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.posCartItemName} numberOfLines={1}>{item.name}</Text>
                              <Text style={styles.posCartItemPrice}>
                                ₱{item.price?.toLocaleString()} x {item.quantity} = ₱{(item.price * item.quantity).toLocaleString()}
                              </Text>
                            </View>
                            <View style={styles.posQtyBox}>
                              <TouchableOpacity style={styles.posQtyBtn} onPress={() => handlePOSUpdateQty(item.id, -1)}>
                                <Text style={{ fontWeight: '800', color: '#475569' }}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.posQtyText}>{item.quantity}</Text>
                              <TouchableOpacity style={styles.posQtyBtn} onPress={() => handlePOSUpdateQty(item.id, 1)}>
                                <Text style={{ fontWeight: '800', color: '#475569' }}>+</Text>
                              </TouchableOpacity>
                            </View>
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
                        style={{ backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' }}
                        onPress={handlePOSApplyDiscount}
                      >
                        <Text style={{ color: '#0C6258', fontWeight: '800', fontSize: 12.5 }}>Apply</Text>
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
                          style={[styles.formInput, { fontSize: 16, fontWeight: '900', color: '#0C6258', marginTop: 4 }]}
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
                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <Text style={styles.statLabel}>Gross Sales Volume</Text>
                    <Text style={styles.statValue}>₱{analyticsData.totalRevenue.toLocaleString()}</Text>
                    <Text style={styles.statSub}>Combined online & in-store</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardSuccessAccent]}>
                    <Text style={styles.statLabel}>Average Order Value (AOV)</Text>
                    <Text style={styles.statValue}>₱{Math.round(analyticsData.aov).toLocaleString()}</Text>
                    <Text style={styles.statSub}>Per transaction average</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardTealAccent]}>
                    <Text style={styles.statLabel}>Total Units Sold</Text>
                    <Text style={styles.statValue}>{analyticsData.totalItemsSold} Items</Text>
                    <Text style={styles.statSub}>Across {analyticsData.totalOrders} total orders</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardWarningAccent]}>
                    <Text style={styles.statLabel}>POS In-Store Sales Share</Text>
                    <Text style={[styles.statValue, { color: '#0C6258' }]}>
                      {analyticsData.totalRevenue > 0
                        ? Math.round((analyticsData.posRevenue / analyticsData.totalRevenue) * 100)
                        : 0}
                      %
                    </Text>
                    <Text style={styles.statSub}>₱{analyticsData.posRevenue.toLocaleString()} in counter sales</Text>
                  </View>
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

                {/* Sales Channels Comparison & Top Products Leaderboard */}
                <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                  {/* Channel Breakdown */}
                  <View style={[styles.analyticsCard, { flex: 1, minWidth: 320 }]}>
                    <Text style={styles.analyticsCardTitle}>Sales Channel Distribution</Text>
                    <Text style={styles.analyticsCardSubtitle}>Online storefront vs Walk-in POS transactions</Text>

                    <View style={{ marginTop: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>In-Store POS Counter</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0C6258' }}>
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
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0C6258', marginTop: 2 }}>{count}</Text>
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
                          <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#0C6258' }}>
                            ₱{tp.revenue.toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
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

                {/* Products Table */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[styles.tableCard, { minWidth: 700 }]}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Product & Brand</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Category</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>Price (₱)</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Stock</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>Actions</Text>
                    </View>

                    {filteredProducts.map((p) => (
                      <View key={p.id} style={styles.tableRow}>
                        <View style={{ flex: 2.5, flexDirection: 'row', alignItems: 'center' }}>
                          <Image source={{ uri: p.image }} style={styles.productThumb} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tableTitle} numberOfLines={1}>{p.name}</Text>
                            <Text style={styles.tableSub}>{p.brand} • {p.compatibility || 'Universal'}</Text>
                          </View>
                        </View>

                        <Text style={[styles.tableSub, { flex: 1.2, color: '#0F172A', fontWeight: '600' }]}>{p.category}</Text>

                        {/* Editable Price */}
                        <View style={{ flex: 1.2, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 80 }]}
                            keyboardType="numeric"
                            defaultValue={String(p.price)}
                            onEndEditing={(e) => handleUpdatePrice(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        {/* Editable Stock */}
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.tableInputInline, { width: 50 }]}
                            keyboardType="numeric"
                            defaultValue={String(p.stock)}
                            onEndEditing={(e) => handleUpdateStock(p.id, e.nativeEvent.text)}
                          />
                        </View>

                        {/* Actions */}
                        <View style={{ flex: 1.2, flexDirection: 'row', justifyContent: 'center' }}>
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => setEditingProduct({ ...p })}
                          >
                            <BootstrapIcon name="pencil" size={13} color="#475569" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, styles.actionIconBtnDanger]}
                            onPress={() => handleDeleteProduct(p.product_id || p.id, p.name)}
                          >
                            <BootstrapIcon name="trash" size={13} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
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
                        <Text style={[styles.tableTitle, { color: prm.isActive ? '#0C6258' : '#64748B', fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
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
                          <BootstrapIcon name="trash" size={13} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── TAB 7: GARAGE SERVICES ─── */}
            {activeNav === 'garage' && (
              <View>
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
                      <Text style={[styles.tableTitle, { flex: 1.2, textAlign: 'right', color: '#0C6258' }]}>
                        ₱{srv.price?.toLocaleString()}
                      </Text>
                      <Text style={[styles.tableSub, { flex: 1.2, textAlign: 'center' }]}>{srv.duration || '60 mins'}</Text>
                      <View style={{ flex: 1.2, flexDirection: 'row', justifyContent: 'center' }}>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => {
                            setEditingGarageService(srv);
                            setServTitle(srv.title);
                            setServCategory(srv.category);
                            setServPrice(String(srv.price));
                            setServDuration(srv.duration || '60 mins');
                            setServImage(srv.image);
                            setServDesc(srv.description || '');
                            setIsAddGarageOpen(true);
                          }}
                        >
                          <BootstrapIcon name="pencil" size={13} color="#475569" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
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
                            <Text style={{ color: u.role === 'admin' ? '#0C6258' : '#475569', fontSize: 11, fontWeight: '800' }}>
                              {u.role === 'admin' ? '👑 Admin' : '👤 Customer'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flex: 1.5, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={[styles.actionIconBtn, { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4 }]}
                            onPress={() => handleToggleUserRole(u.id, u.role)}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0C6258' }}>
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
                      <BootstrapIcon name="database-fill-check" size={20} color="#0C6258" />
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
                    Correct format: <Text style={{ color: '#0C6258', fontWeight: '600' }}>https://vtbdmurblidtdghaotne.supabase.co</Text>
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
                      style={[styles.addBtnPrimary, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#0C6258' }]}
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
                      <BootstrapIcon name="arrow-counterclockwise" size={14} color="#0C6258" />
                      <Text style={[styles.addBtnPrimaryText, { color: '#0C6258' }]}>Restore Default Project Credentials</Text>
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
                          backgroundColor: '#E6F4F1',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="gear-fill" size={22} color="#0C6258" />
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
                        style={[styles.addBtnPrimary, { backgroundColor: '#0C6258' }]}
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
                          backgroundColor: setForm.autoVerifyCodOrders ? '#0C6258' : '#CBD5E1',
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
                          backgroundColor: setForm.allowWeekendBookings ? '#0C6258' : '#CBD5E1',
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
                          backgroundColor: setForm.autoAssignMechanic ? '#0C6258' : '#CBD5E1',
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
                  <Text style={styles.formLabel}>Price (₱)</Text>
                  <TextInput style={styles.formInput} keyboardType="numeric" value={newProdPrice} onChangeText={setNewProdPrice} placeholder="39000" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Initial Stock</Text>
                  <TextInput style={styles.formInput} keyboardType="numeric" value={newProdStock} onChangeText={setNewProdStock} placeholder="15" placeholderTextColor="#94A3B8" />
                </View>
              </View>

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

              {/* Image Selection: File Picker / URL / Presets */}
              <Text style={styles.formLabel}>Product Image</Text>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Image
                  source={{ uri: newProdImage || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80' }}
                  style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#E2E8F0', borderWidth: 1.5, borderColor: '#CBD5E1' }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0C6258', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
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
                <TextInput style={styles.formInput} value={editingProduct.name} onChangeText={(val) => setEditingProduct({ ...editingProduct, name: val })} />

                <Text style={styles.formLabel}>Brand</Text>
                <TextInput style={styles.formInput} value={editingProduct.brand} onChangeText={(val) => setEditingProduct({ ...editingProduct, brand: val })} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Price (₱)</Text>
                    <TextInput style={styles.formInput} keyboardType="numeric" value={String(editingProduct.price)} onChangeText={(val) => setEditingProduct({ ...editingProduct, price: parseFloat(val) || 0 })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Stock</Text>
                    <TextInput style={styles.formInput} keyboardType="numeric" value={String(editingProduct.stock)} onChangeText={(val) => setEditingProduct({ ...editingProduct, stock: parseInt(val, 10) || 0 })} />
                  </View>
                </View>

                {/* Edit Product Image with File Picker */}
                <Text style={styles.formLabel}>Product Image</Text>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Image
                    source={{ uri: editingProduct.image || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80' }}
                    style={{ width: 68, height: 68, borderRadius: 12, backgroundColor: '#E2E8F0', borderWidth: 1.5, borderColor: '#CBD5E1' }}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, gap: 6 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0C6258', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
                      onPress={async () => {
                        const res = await pickImageFromFile();
                        if (res.success && res.uri) {
                          setEditingProduct({ ...editingProduct, image: res.uri });
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
                <TextInput style={styles.formInput} value={editingProduct.image || ''} onChangeText={(val) => setEditingProduct({ ...editingProduct, image: val })} placeholder="https://..." placeholderTextColor="#94A3B8" />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput style={[styles.formInput, { height: 60 }]} multiline value={editingProduct.description} onChangeText={(val) => setEditingProduct({ ...editingProduct, description: val })} />
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

      {/* ─── MODAL 3: QUICK RESTOCK DIALOG ─── */}
      {restockModalProduct && (
        <Modal visible={Boolean(restockModalProduct)} transparent animationType="fade" onRequestClose={() => setRestockModalProduct(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxWidth: 420 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Restock Inventory</Text>
                <TouchableOpacity onPress={() => setRestockModalProduct(null)}>
                  <BootstrapIcon name="x-lg" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>{restockModalProduct.name}</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Current Stock: {restockModalProduct.stock || 0} unit(s)
                </Text>

                <Text style={[styles.formLabel, { marginTop: 16 }]}>Units to Add to Stock</Text>
                <TextInput
                  style={[styles.formInput, { fontSize: 16, fontWeight: '900', color: '#0C6258' }]}
                  keyboardType="numeric"
                  value={restockAmount}
                  onChangeText={setRestockAmount}
                />

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[5, 10, 25, 50].map((qty) => (
                    <TouchableOpacity
                      key={qty}
                      style={{ flex: 1, backgroundColor: '#F3F7F6', paddingVertical: 6, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#D1ECE6' }}
                      onPress={() => setRestockAmount(String(qty))}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0C6258' }}>+{qty}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.quickStoreBtn} onPress={() => setRestockModalProduct(null)}>
                  <Text style={styles.quickStoreBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtnPrimary} onPress={handleExecuteRestock}>
                  <Text style={styles.addBtnPrimaryText}>Confirm Restock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ─── MODAL 4: DIGITAL POS THERMAL RECEIPT ─── */}
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
                <Text style={[styles.receiptTextBold, { fontSize: 16, color: '#0C6258' }]}>
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
                  <BootstrapIcon name="grid-fill" size={16} color="#0C6258" />
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
                <BootstrapIcon name="receipt" size={20} color={activeNav === 'orders' ? '#0C6258' : '#475569'} />
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
                <BootstrapIcon name="ticket-perforated-fill" size={20} color={activeNav === 'promos' ? '#0C6258' : '#475569'} />
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
                <BootstrapIcon name="tools" size={20} color={activeNav === 'garage' ? '#0C6258' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Pitstop Services</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>PMS & Tuning</Text>
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
                <BootstrapIcon name="people-fill" size={20} color={activeNav === 'users' ? '#0C6258' : '#475569'} />
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
                <BootstrapIcon name="database-fill-gear" size={20} color={activeNav === 'supabase' ? '#0C6258' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Supabase DB</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Cloud Database</Text>
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
                <BootstrapIcon name="bell-fill" size={20} color={activeNav === 'notifications' ? '#0C6258' : '#475569'} />
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
                <BootstrapIcon name="gear-fill" size={20} color={activeNav === 'settings' ? '#0C6258' : '#475569'} />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>System Settings</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Store rules & maintenance</Text>
                </View>
              </TouchableOpacity>

              {/* Live Storefront */}
              <TouchableOpacity
                style={[styles.mobileMoreCard, { backgroundColor: '#F3F7F6', borderColor: '#D1ECE6' }]}
                onPress={() => {
                  setIsMobileMoreOpen(false);
                  onNavigateToStore?.();
                }}
              >
                <BootstrapIcon name="shop" size={20} color="#0C6258" />
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0C6258' }}>Live Storefront</Text>
                  <Text style={{ fontSize: 11, color: '#0C6258' }}>View Store</Text>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxWidth: 640, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F7F6', justifyContent: 'center', alignItems: 'center' }}>
                  <BootstrapIcon name="receipt" size={18} color="#0C6258" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    Order #{selectedOrderForModal?.order_id || selectedOrderForModal?.id}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                    Placed on {selectedOrderForModal?.order_date || 'Recent'} • {selectedOrderForModal?.channel || 'Online Store'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsOrderModalOpen(false)}>
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
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
                      onPress={() => {
                        handleApproveCOD(selectedOrderForModal.order_id || selectedOrderForModal.id);
                        setIsOrderModalOpen(false);
                      }}
                    >
                      <BootstrapIcon name="check-circle-fill" size={12} color="#FFFFFF" />
                      <Text style={styles.btnApproveCodText}>Approve COD Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* Customer & Delivery Card */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Customer & Shipping Address
                </Text>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                    👤 {selectedOrderForModal?.customer_name || 'Walk-in Customer'}
                  </Text>
                  {selectedOrderForModal?.customer_phone && (
                    <Text style={{ fontSize: 12.5, color: '#334155' }}>
                      📞 {selectedOrderForModal.customer_phone}
                    </Text>
                  )}
                  {selectedOrderForModal?.customer_address && (
                    <Text style={{ fontSize: 12.5, color: '#334155' }}>
                      📍 {selectedOrderForModal.customer_address}
                    </Text>
                  )}
                  {selectedOrderForModal?.delivery_notes ? (
                    <View style={{ backgroundColor: '#FFFFFF', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 4 }}>
                      <Text style={{ fontSize: 11.5, color: '#64748B', fontStyle: 'italic' }}>
                        💬 Note: "{selectedOrderForModal.delivery_notes}"
                      </Text>
                    </View>
                  ) : null}
                  {selectedOrderForModal?.cod_change_for ? (
                    <View style={{ backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>
                        💵 Change requested for: ₱{Number(selectedOrderForModal.cod_change_for).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Status Selector & State Management */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Update Order Fulfillment Status
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {['Pending Approval', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((st) => {
                    const isCur = (selectedOrderForModal?.status || '').toLowerCase() === st.toLowerCase() ||
                      (st === 'Pending Approval' && ((selectedOrderForModal?.status || '').toLowerCase().includes('pending') || (selectedOrderForModal?.status || '').toLowerCase().includes('approval')));

                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.orderFilterTab,
                          isCur && { backgroundColor: '#0C6258', borderColor: '#0C6258' },
                        ]}
                        onPress={() => {
                          const oid = selectedOrderForModal?.order_id || selectedOrderForModal?.id;
                          handleUpdateOrderStatus(oid, st);
                        }}
                      >
                        <Text style={[styles.orderFilterTabText, isCur && { color: '#FFFFFF', fontWeight: '800' }]}>
                          {st === 'Pending Approval' ? '⏳ Pending COD' : st}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

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
                      ₱{(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString()}
                    </Text>
                  </View>
                ))}

                {/* Financial Summary */}
                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>Subtotal</Text>
                    <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '700' }}>
                      ₱{Number(selectedOrderForModal?.total_amount || selectedOrderForModal?.grand_total || 0).toLocaleString()}
                    </Text>
                  </View>
                  {Number(selectedOrderForModal?.discount_amount) > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: '#16A34A' }}>Discount Applied</Text>
                      <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '700' }}>
                        -₱{Number(selectedOrderForModal.discount_amount).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A' }}>Grand Total</Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0C6258' }}>
                      ₱{Number(selectedOrderForModal?.grand_total || selectedOrderForModal?.total_amount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.quickStoreBtn}
                onPress={() => {
                  showToast('Receipt download initiated / print ready');
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.print?.();
                  }
                }}
              >
                <BootstrapIcon name="download" size={13} color="#0C6258" />
                <Text style={styles.quickStoreBtnText}>Print / Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addBtnPrimary, { backgroundColor: '#64748B' }]}
                onPress={() => setIsOrderModalOpen(false)}
              >
                <Text style={styles.addBtnPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
              <BootstrapIcon name="grid-1x2-fill" size={17} color={activeNav === 'overview' ? '#0C6258' : '#64748B'} />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'overview' && styles.bottomNavLabelActive]}>Overview</Text>
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
              <BootstrapIcon name="box-seam-fill" size={17} color={activeNav === 'inventory' ? '#0C6258' : '#64748B'} />
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
              <BootstrapIcon name="cart-check-fill" size={17} color={activeNav === 'pos' ? '#0C6258' : '#64748B'} />
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
              <BootstrapIcon name="graph-up-arrow" size={17} color={activeNav === 'analytics' ? '#0C6258' : '#64748B'} />
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
              <BootstrapIcon name="tag-fill" size={17} color={activeNav === 'products' ? '#0C6258' : '#64748B'} />
            </View>
            <Text style={[styles.bottomNavLabel, activeNav === 'products' && styles.bottomNavLabelActive]}>Products</Text>
          </TouchableOpacity>

          {/* 6. More Options */}
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => setIsMobileMoreOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.bottomNavIconWrap, ['orders', 'promos', 'garage', 'users', 'supabase'].includes(activeNav) && styles.bottomNavIconWrapActive]}>
              <BootstrapIcon name="three-dots" size={18} color={['orders', 'promos', 'garage', 'users', 'supabase'].includes(activeNav) ? '#0C6258' : '#64748B'} />
              {pendingCodCount > 0 && (
                <View style={[styles.bottomNavBadge, { backgroundColor: '#D97706' }]}>
                  <Text style={styles.bottomNavBadgeText}>{pendingCodCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.bottomNavLabel, ['orders', 'promos', 'garage', 'users', 'supabase'].includes(activeNav) && styles.bottomNavLabelActive]}>More</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
