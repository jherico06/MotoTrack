import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { orderStyles as styles } from '../styles/orderPage.styles';
import { orderService } from '../services/orderService';
import { BootstrapIcon, BottomNavBar, BrandLogo } from '../components/common';
import { LiveOrderTrackingMapModal, ProfileModal } from '../components/modals';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

const STATUS_TABS = ['All', 'Pending Approval', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default function OrderPage({
  currentUser: propCurrentUser,
  productsList = [],
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onAddToCart,
  onOpenCart,
  cartItemCount: propCartItemCount,
  wishlistCount: propWishlistCount,
  showToast: propShowToast,
}) {
  const auth = useAuth();
  const cartCtx = useCart();
  const wishlistCtx = useWishlist();

  const currentUser = propCurrentUser !== undefined ? propCurrentUser : auth?.currentUser;
  const cartItemCount = propCartItemCount !== undefined ? propCartItemCount : cartCtx?.cartItemCount || 0;
  const wishlistCount = propWishlistCount !== undefined ? propWishlistCount : wishlistCtx?.wishlistCount || 0;
  const showToast = propShowToast || cartCtx?.showToast || (() => {});
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;

  const [ordersList, setOrdersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All'); // 'All' | 'Today' | 'Week' | 'Month'
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect guard: Customer orders belong exclusively in the Customer Dashboard
  useEffect(() => {
    if (!currentUser) {
      if (typeof onNavigateToLogin === 'function') onNavigateToLogin();
    } else {
      if (typeof onNavigateToProfile === 'function') onNavigateToProfile('orders');
    }
  }, [currentUser, onNavigateToLogin, onNavigateToProfile]);

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Customize') {
      if (onNavigateToCustomizer) onNavigateToCustomizer();
      else if (onNavigateToCustomize) onNavigateToCustomize();
      else onNavigateToStore?.();
    } else if (tab === 'Garage') {
      onNavigateToGarage?.();
    } else if (tab === 'Orders') {
      // already on orders
    } else if (tab === 'Favorites') {
      onNavigateToWishlist?.();
    } else if (tab === 'Admin') {
      if (currentUser?.role === 'admin') {
        onNavigateToAdmin?.();
      }
    } else if (tab === 'Dashboard' || tab === 'Profile') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else if (onNavigateToProfile) {
        onNavigateToProfile();
      } else {
        setIsProfileModalOpen(true);
      }
    }
  };

  // Modals
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const [orderToCancel, setOrderToCancel] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Fetch orders on mount or user change
  const fetchOrders = async () => {
    setIsLoading(true);
    const data = await orderService.getUserOrders(
      currentUser?.id || currentUser?.user_id,
      currentUser?.customer_id,
      currentUser?.name
    );
    setOrdersList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const unsubscribe = orderService.subscribe((updatedOrders) => {
      if (Array.isArray(updatedOrders)) {
        if (!currentUser) {
          setOrdersList([]);
        } else {
          const userId = currentUser?.id || currentUser?.user_id;
          const customerId = currentUser?.customer_id;
          const userOrders = updatedOrders.filter((o) => {
            const uMatch = Boolean(userId && (o.user_id === userId || o.customer_id === userId));
            const cMatch = Boolean(customerId && (o.customer_id === customerId || o.user_id === customerId));
            return uMatch || cMatch;
          });
          setOrdersList(userOrders);
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return ordersList.filter((order) => {
      const matchStatus =
        statusFilter === 'All' || (order.status || 'Processing').toLowerCase() === statusFilter.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (order.order_id && order.order_id.toLowerCase().includes(q)) ||
        (order.items_summary && order.items_summary.toLowerCase().includes(q)) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(q)) ||
        (order.tracking_number && order.tracking_number.toLowerCase().includes(q));

      if (!matchStatus || !matchSearch) return false;

      if (dateFilter !== 'All') {
        const orderTime = new Date(order.created_at || Date.now()).getTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (dateFilter === 'Today') {
          const isToday =
            now - orderTime <= oneDay || (order.order_date || '').toLowerCase().includes('today');
          if (!isToday) return false;
        } else if (dateFilter === 'Week') {
          if (now - orderTime > 7 * oneDay) return false;
        } else if (dateFilter === 'Month') {
          if (now - orderTime > 30 * oneDay) return false;
        }
      }

      return true;
    });
  }, [ordersList, statusFilter, dateFilter, searchQuery]);

  // Statistics counts
  const countsByStatus = useMemo(() => {
    const counts = {
      All: ordersList.length,
      'Pending Approval': 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    ordersList.forEach((o) => {
      const st = (o.status || 'Processing').toLowerCase();
      if (st.includes('pending') || st.includes('approval')) counts['Pending Approval']++;
      else if (st === 'processing') counts.Processing++;
      else if (st === 'shipped') counts.Shipped++;
      else if (st === 'delivered') counts.Delivered++;
      else if (st === 'cancelled') counts.Cancelled++;
    });
    return counts;
  }, [ordersList]);

  // Reorder / Buy Again
  const handleBuyAgain = (order) => {
    if (!order.items || order.items.length === 0) {
      showToast('No items found to reorder');
      return;
    }

    let addedCount = 0;
    order.items.forEach((item) => {
      // Find matching catalog product or create fallback
      const matchingProduct = productsList.find(
        (p) => p.id === item.product_id || p.name.toLowerCase() === item.name.toLowerCase()
      ) || {
        id: item.product_id || 'reorder-' + Date.now(),
        name: item.name,
        price: item.price || 99.0,
        image:
          item.image ||
          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
        brand: item.brand || 'MotoTrack',
        category: item.category || 'Gear',
      };

      if (typeof onAddToCart === 'function') {
        onAddToCart(matchingProduct, item.quantity || 1);
      } else if (cartCtx?.addToCart) {
        cartCtx.addToCart(matchingProduct, item.quantity || 1);
      }
      addedCount += item.quantity || 1;
    });

    showToast(`🛒 Reordered ${addedCount} items! Added to your shopping bag.`);
  };

  // Cancel order handler
  const handleCancelOrderConfirm = async () => {
    if (!orderToCancel) return;
    await orderService.cancelOrder(orderToCancel.order_id || orderToCancel.id);
    showToast(`Order ${orderToCancel.order_id || orderToCancel.id} has been cancelled.`);
    setIsCancelModalOpen(false);
    setOrderToCancel(null);
    fetchOrders();
  };

  // Render Status Badge Pill
  const renderStatusBadge = (status = 'Processing') => {
    const st = status.toLowerCase();
    if (st.includes('pending') || st.includes('approval')) {
      return (
        <View style={[styles.statusPillProcessing, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
          <BootstrapIcon name="shield-lock-fill" size={12} color="#D97706" />
          <Text style={[styles.statusTextProcessing, { color: '#B45309' }]}>Awaiting COD Approval</Text>
        </View>
      );
    }
    if (st === 'delivered') {
      return (
        <View style={styles.statusPillDelivered}>
          <BootstrapIcon name="check-circle-fill" size={12} color="#16A34A" />
          <Text style={styles.statusTextDelivered}>Delivered</Text>
        </View>
      );
    }
    if (st === 'shipped') {
      return (
        <View style={styles.statusPillShipped}>
          <BootstrapIcon name="truck" size={12} color="#9333EA" />
          <Text style={styles.statusTextShipped}>In Transit</Text>
        </View>
      );
    }
    if (st === 'cancelled') {
      return (
        <View style={styles.statusPillCancelled}>
          <BootstrapIcon name="x-lg" size={12} color="#DC2626" />
          <Text style={styles.statusTextCancelled}>Cancelled</Text>
        </View>
      );
    }
    return (
      <View style={styles.statusPillProcessing}>
        <BootstrapIcon name="arrow-repeat" size={12} color="#0C6258" />
        <Text style={styles.statusTextProcessing}>Processing</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* ─── TOP NAVBAR (CROSS-PLATFORM) ─── */}
      <View style={styles.navbarWrapper}>
        <View style={[styles.maxContainer, styles.navbarInner]}>
          <TouchableOpacity style={styles.logoRow} onPress={onNavigateToStore} activeOpacity={0.8}>
            <BrandLogo size={36} />
          </TouchableOpacity>

          <View style={styles.navActionsRight}>
            <TouchableOpacity style={styles.navBtn} onPress={onNavigateToStore} activeOpacity={0.8}>
              <BootstrapIcon name="arrow-left" size={13} color="#334155" />
              <Text style={styles.navBtnText}>Back to Store</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBtn} onPress={onNavigateToWishlist} activeOpacity={0.8}>
              <BootstrapIcon name="heart-fill" size={13} color="#EF4444" />
              <Text style={styles.navBtnText}>Favorites</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: '#0C6258' }]}
              onPress={onOpenCart}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="bag-fill" size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Bag ({cartItemCount})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.maxContainer}>
          {/* ─── HEADER & BREADCRUMB ─── */}
          <View style={styles.headerSection}>
            <View style={styles.breadcrumbRow}>
              <TouchableOpacity onPress={onNavigateToStore}>
                <Text style={styles.breadcrumbText}>Home</Text>
              </TouchableOpacity>
              <BootstrapIcon name="arrow-right" size={10} color="#94A3B8" />
              <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>My Orders</Text>
            </View>

            <View style={styles.titleRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="box-seam-fill" size={24} color="#0C6258" />
                  <Text style={styles.pageTitle}>Order History & Tracking</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statChip}>
                    <BootstrapIcon name="receipt" size={12} color="#0C6258" />
                    <Text style={styles.statChipText}>{ordersList.length} Total Orders</Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: '#F0FDF4' }]}>
                    <BootstrapIcon name="check2" size={12} color="#16A34A" />
                    <Text style={[styles.statChipText, { color: '#16A34A' }]}>
                      {countsByStatus.Delivered} Delivered
                    </Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: '#FAF5FF' }]}>
                    <BootstrapIcon name="truck" size={12} color="#9333EA" />
                    <Text style={[styles.statChipText, { color: '#9333EA' }]}>
                      {countsByStatus.Processing + countsByStatus.Shipped} Active
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ─── SEARCH & STATUS TABS TOOLBAR ─── */}
          <View style={styles.toolbarCard}>
            <View style={styles.searchBox}>
              <BootstrapIcon name="search" size={14} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Order ID (e.g. ord-8921), item name, or tracking #..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <BootstrapIcon name="x-lg" size={12} color="#64748B" />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusTabsScroll}
            >
              {STATUS_TABS.map((tab) => {
                const isActive = statusFilter.toLowerCase() === tab.toLowerCase();
                const count = countsByStatus[tab] ?? 0;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.statusTab, isActive && styles.statusTabActive]}
                    onPress={() => setStatusFilter(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.statusTabText, isActive && styles.statusTabTextActive]}>{tab}</Text>
                    <View style={[styles.statusTabCount, isActive && styles.statusTabCountActive]}>
                      <Text style={[styles.statusTabCountText, isActive && styles.statusTabCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Date Range Filter Pills */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginRight: 2 }}>Date:</Text>
              {[
                { id: 'All', label: 'All' },
                { id: 'Today', label: 'Today' },
                { id: 'Week', label: '7 Days' },
                { id: 'Month', label: '30 Days' },
              ].map((dr) => (
                <TouchableOpacity
                  key={dr.id}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 14,
                    backgroundColor: dateFilter === dr.id ? '#0C6258' : '#F1F5F9',
                  }}
                  onPress={() => setDateFilter(dr.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: dateFilter === dr.id ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {dr.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ─── ORDERS LIST OR EMPTY STATE ─── */}
          {ordersList.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <View style={styles.emptyIconWrap}>
                <BootstrapIcon name="box-seam" size={40} color="#0C6258" />
              </View>
              <Text style={styles.emptyTitle}>No Orders Placed Yet</Text>
              <Text style={styles.emptySubtitle}>
                You have not placed any orders yet. Discover our latest motorcycle spare parts, performance
                upgrades, and racing components to place your first order.
              </Text>
              <TouchableOpacity style={styles.emptyShopBtn} onPress={onNavigateToStore} activeOpacity={0.9}>
                <BootstrapIcon name="bag-fill" size={15} color="#FFFFFF" />
                <Text style={styles.emptyShopBtnText}>Start Shopping Now</Text>
              </TouchableOpacity>
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <BootstrapIcon name="search" size={36} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Orders Match Your Filter</Text>
              <Text style={styles.emptySubtitle}>
                No orders found under status "{statusFilter}" or matching "{searchQuery}".
              </Text>
              <TouchableOpacity
                style={styles.buyAgainBtn}
                onPress={() => {
                  setStatusFilter('All');
                  setSearchQuery('');
                }}
              >
                <Text style={styles.buyAgainBtnText}>Clear Search & Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.orderList}>
              {filteredOrders.map((order, orderIdx) => {
                const isCancellable = (order.status || 'Processing').toLowerCase() === 'processing';
                return (
                  <View key={order.order_id || order.id || `order-${orderIdx}`} style={styles.orderCard}>
                    {/* Header */}
                    <View style={styles.orderCardHeader}>
                      <View style={styles.orderHeaderLeft}>
                        <BootstrapIcon name="receipt" size={18} color="#0C6258" />
                        <View>
                          <Text style={styles.orderIdText}>{order.order_id || order.id}</Text>
                          <Text style={styles.orderDateText}>
                            Placed on {order.order_date || 'Aug 20, 2026'} •{' '}
                            {order.items_count || order.items?.length || 1}{' '}
                            {order.items_count === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                      </View>

                      {renderStatusBadge(order.status)}
                    </View>

                    {/* Order Items */}
                    <View style={styles.orderItemsWrap}>
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <View key={idx} style={styles.orderItemRow}>
                            <Image
                              source={{
                                uri:
                                  item.image ||
                                  'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
                              }}
                              style={styles.orderItemThumb}
                            />
                            <View style={styles.orderItemDetails}>
                              <Text style={styles.orderItemName} numberOfLines={2}>
                                {item.name}
                              </Text>
                              <Text style={styles.orderItemSub}>
                                Qty: {item.quantity || 1} • Unit: ${Number(item.price || 0).toFixed(2)}
                              </Text>
                            </View>
                            <View style={styles.orderItemPriceCol}>
                              <Text style={styles.orderItemPrice}>
                                ₱{(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={{ fontSize: 13.5, color: '#475569' }}>{order.items_summary}</Text>
                      )}

                      {/* Customer & Delivery address snippet */}
                      <View
                        style={{
                          backgroundColor: '#F8FAFC',
                          padding: 10,
                          borderRadius: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 4,
                        }}
                      >
                        <BootstrapIcon name="geo-alt-fill" size={13} color="#64748B" />
                        <Text style={{ fontSize: 12, color: '#475569', flex: 1 }} numberOfLines={1}>
                          Shipping to:{' '}
                          <Text style={{ fontWeight: '700' }}>{order.customer_name || 'Alex Rider'}</Text> (
                          {order.customer_address || '742 Evergreen Terrace, Springfield, OR'})
                        </Text>
                      </View>
                    </View>

                    {/* Footer / Actions */}
                    <View style={styles.orderCardFooter}>
                      <View style={styles.orderMetaCol}>
                        <Text style={styles.orderTotalLabel}>Grand Total Paid</Text>
                        <Text style={styles.orderTotalValue}>
                          ₱{Number(order.grand_total || order.total_amount || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.paymentMethodText}>
                          via {order.payment_method || 'Credit Card / Apple Pay'}
                        </Text>
                      </View>

                      <View style={styles.orderActionsRow}>
                        {/* Track on Live Map */}
                        <TouchableOpacity
                          style={[styles.trackShipmentBtn, { backgroundColor: '#0F172A', gap: 6 }]}
                          onPress={() => {
                            setSelectedOrderForTracking(order);
                            setIsTrackingModalOpen(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="map-fill" size={13} color="#FFFFFF" />
                          <Text style={styles.trackShipmentBtnText}>Track on Live Map</Text>
                        </TouchableOpacity>

                        {/* Buy Again */}
                        <TouchableOpacity
                          style={styles.buyAgainBtn}
                          onPress={() => handleBuyAgain(order)}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="arrow-repeat" size={13} color="#0C6258" />
                          <Text style={styles.buyAgainBtnText}>Buy Again</Text>
                        </TouchableOpacity>

                        {/* View Invoice */}
                        <TouchableOpacity
                          style={styles.invoiceBtn}
                          onPress={() => {
                            setSelectedOrderForInvoice(order);
                            setIsInvoiceModalOpen(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="receipt" size={12} color="#475569" />
                          <Text style={styles.invoiceBtnText}>Invoice</Text>
                        </TouchableOpacity>

                        {/* Cancel Order (if still in Processing) */}
                        {isCancellable && (
                          <TouchableOpacity
                            style={styles.cancelOrderBtn}
                            onPress={() => {
                              setOrderToCancel(order);
                              setIsCancelModalOpen(true);
                            }}
                            activeOpacity={0.85}
                          >
                            <BootstrapIcon name="x-lg" size={11} color="#DC2626" />
                            <Text style={styles.cancelOrderBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── MODAL 1: LIVE INTERACTIVE GPS MAP TRACKING MODAL ─── */}
      <LiveOrderTrackingMapModal
        visible={isTrackingModalOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsTrackingModalOpen(false)}
        showToast={showToast}
      />

      {/* ─── MODAL 1.5: PROFILE & SETTINGS MODAL ─── */}
      <ProfileModal
        visible={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onNavigateToOrders={() => setIsProfileModalOpen(false)}
        onNavigateToWishlist={onNavigateToWishlist}
        onNavigateToAdmin={onNavigateToAdmin}
        showToast={showToast}
      />

      {/* ─── MODAL 2: INVOICE / RECEIPT MODAL ─── */}
      <Modal visible={isInvoiceModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 580 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="receipt" size={18} color="#0C6258" />
                <Text style={styles.modalTitle}>Official Purchase Receipt</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsInvoiceModalOpen(false)}>
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedOrderForInvoice && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.invoicePaper}>
                  {/* Company & Invoice Header */}
                  <View style={styles.invoiceHeader}>
                    <View>
                      <View style={{ marginBottom: 6 }}>
                        <BrandLogo size={28} />
                      </View>
                      <Text style={styles.invoiceSub}>
                        Invoice #{selectedOrderForInvoice.order_id || selectedOrderForInvoice.id}
                      </Text>
                      <Text style={styles.invoiceSub}>
                        Date: {selectedOrderForInvoice.order_date || 'Aug 20, 2026'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#16A34A' }}>PAID IN FULL</Text>
                      <Text style={styles.invoiceSub}>
                        {selectedOrderForInvoice.payment_method || 'Credit Card'}
                      </Text>
                    </View>
                  </View>

                  {/* Customer Information */}
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: '#64748B',
                        textTransform: 'uppercase',
                      }}
                    >
                      Billed & Shipped To:
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
                      {selectedOrderForInvoice.customer_name || 'Alex Rider'}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: '#475569' }}>
                      {selectedOrderForInvoice.customer_address ||
                        '742 Evergreen Terrace, Springfield, OR 97477'}
                    </Text>
                    {selectedOrderForInvoice.customer_phone ? (
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        Tel: {selectedOrderForInvoice.customer_phone}
                      </Text>
                    ) : null}
                  </View>

                  {/* Itemized list */}
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: '#64748B',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Purchased Items:
                  </Text>
                  {selectedOrderForInvoice.items && selectedOrderForInvoice.items.length > 0 ? (
                    selectedOrderForInvoice.items.map((item, idx) => (
                      <View key={idx} style={styles.invoiceItemRow}>
                        <Text style={styles.invoiceItemName}>
                          {item.name}{' '}
                          <Text style={{ color: '#64748B', fontWeight: '600' }}>(x{item.quantity || 1})</Text>
                        </Text>
                        <Text style={styles.invoiceItemPrice}>
                          ₱{(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 13, color: '#0F172A', paddingVertical: 6 }}>
                      {selectedOrderForInvoice.items_summary}
                    </Text>
                  )}

                  {/* Pricing breakdown */}
                  <View
                    style={{
                      marginTop: 14,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: '#E2E8F0',
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12.5, color: '#64748B' }}>Subtotal</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A' }}>
                        ₱
                        {Number(
                          selectedOrderForInvoice.total_amount || selectedOrderForInvoice.grand_total || 0
                        ).toFixed(2)}
                      </Text>
                    </View>

                    {Number(selectedOrderForInvoice.discount_amount || 0) > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#16A34A' }}>Promo Voucher Discount</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#16A34A' }}>
                          -₱{Number(selectedOrderForInvoice.discount_amount).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12.5, color: '#64748B' }}>Standard Shipping</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#16A34A' }}>
                        FREE (₱0.00)
                      </Text>
                    </View>

                    <View style={styles.invoiceTotalRow}>
                      <Text style={styles.invoiceTotalLabel}>Grand Total</Text>
                      <Text style={styles.invoiceTotalVal}>
                        ₱
                        {Number(
                          selectedOrderForInvoice.grand_total || selectedOrderForInvoice.total_amount || 0
                        ).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.buyAgainBtn, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => {
                      showToast('Receipt download initiated / print preview ready.');
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.print?.();
                      }
                    }}
                  >
                    <BootstrapIcon name="download" size={13} color="#0C6258" />
                    <Text style={styles.buyAgainBtnText}>Download / Print</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.trackShipmentBtn, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => setIsInvoiceModalOpen(false)}
                  >
                    <Text style={styles.trackShipmentBtnText}>Close Receipt</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: CONFIRM CANCEL ORDER MODAL ─── */}
      <Modal visible={isCancelModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 420, alignItems: 'center' }]}>
            <BootstrapIcon name="x-lg" size={36} color="#DC2626" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
              Cancel Order {orderToCancel?.order_id || orderToCancel?.id}?
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: '#64748B',
                textAlign: 'center',
                lineHeight: 20,
                marginBottom: 20,
              }}
            >
              Are you sure you want to cancel this order? Once cancelled, the items will not be dispatched and
              a full refund will be credited back to your payment method.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F1F5F9',
                  paddingVertical: 11,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setIsCancelModalOpen(false);
                  setOrderToCancel(null);
                }}
              >
                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13.5 }}>Keep Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#DC2626',
                  paddingVertical: 11,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={handleCancelOrderConfirm}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── PERSISTENT MOBILE BOTTOM NAVIGATION ─── */}
      <BottomNavBar
        activeTab="Orders"
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
