import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  StyleSheet,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, BottomNavBar } from '../components/common';
import { ANDROID_TOP_INSET } from '../utils/safeArea';
import {
  LiveOrderTrackingMapModal,
  RateDeliveredOrderModal,
} from '../components/modals';
import { orderService } from '../services/orderService';
import { deliveryService } from '../services/deliveryService';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

const isOutForDeliveryStatus = (status = '') => {
  const st = status.toLowerCase();
  return (
    st === 'out for delivery' ||
    st === 'shipped' ||
    st === 'in transit' ||
    st.includes('transit') ||
    st.includes('way')
  );
};

const isProcessingGroupStatus = (status = '') => {
  const st = status.toLowerCase();
  return (
    st.includes('processing') ||
    st.includes('pending') ||
    st.includes('approval') ||
    st === 'ready for delivery' ||
    st === 'rescheduled'
  );
};

const isShippedGroupStatus = (status = '') => {
  const st = status.toLowerCase();
  return isOutForDeliveryStatus(status) || st === 'delivery failed';
};

const getDisplayStatusLabel = (status = '') => {
  if (isOutForDeliveryStatus(status)) return 'Out for Delivery';
  return status || 'Processing';
};

const ORDER_CATEGORIES = [
  {
    id: 'All',
    name: 'All Orders',
    icon: 'grid-fill',
    color: '#0C6258',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    description: 'All past and active purchases',
  },
  {
    id: 'Processing',
    name: 'Processing',
    icon: 'clock-fill',
    color: '#B45309',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
    description: 'Awaiting confirmation & packing',
  },
  {
    id: 'Shipped',
    name: 'In Transit / Shipped',
    icon: 'truck',
    color: '#4338CA',
    bgColor: '#E0E7FF',
    borderColor: '#C7D2FE',
    description: 'On the way with courier',
  },
  {
    id: 'Delivered',
    name: 'Delivered',
    icon: 'check-circle-fill',
    color: '#15803D',
    bgColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    description: 'Successfully received packages',
  },
  {
    id: 'Cancelled',
    name: 'Cancelled',
    icon: 'x-circle-fill',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    borderColor: '#FECACA',
    description: 'Cancelled or refunded orders',
  },
];

export default function OrderPage({
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
}) {
  const { currentUser } = useAuth();
  const { showToast } = useCart();
  const { wishlistCount } = useWishlist();

  const [ordersList, setOrdersList] = useState([]);
  const [orderFilter, setOrderFilter] = useState('All');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  // Authentication guard: redirect to login if not signed in
  useEffect(() => {
    if (!currentUser) {
      if (typeof onNavigateToLogin === 'function') onNavigateToLogin();
    }
  }, [currentUser, onNavigateToLogin]);

  // Fetch only the current user's actual orders (never demo orders if user hasn't ordered)
  const fetchOrders = useCallback(async () => {
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const customerId = currentUser?.customer_id;
      if (!userId && !customerId) {
        setOrdersList([]);
        return;
      }
      const data = await orderService.getUserOrders(userId, customerId, currentUser?.name, currentUser);
      setOrdersList(Array.isArray(data) ? data : []);
      setSelectedOrderForTracking((curr) => {
        if (!curr || !Array.isArray(data)) return curr;
        const fresh = data.find((o) => o.order_id === curr.order_id || o.id === curr.id);
        return fresh || curr;
      });
    } catch (e) {
      console.warn('Fetch orders error:', e);
      setOrdersList([]);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchOrders();

    const unsubscribe = orderService.subscribe(() => {
      // Always re-fetch from service (DB reconcile) — never trust raw cache dumps
      fetchOrders();
    });

    const onOrdersUpdated = () => {
      fetchOrders();
    };

    const onStorage = (e) => {
      if (e?.key && e.key !== 'mototrack_orders_db') return;
      fetchOrders();
    };

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrders();
      }
    };

    const onAppState = (nextState) => {
      if (nextState === 'active') fetchOrders();
    };
    const appSub = AppState.addEventListener?.('change', onAppState);

    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('mototrack_orders');
        bc.onmessage = () => fetchOrders();
      }
    } catch (_e) {}

    // Poll so admin → customer status changes appear even across accounts/devices
    const pollId = setInterval(() => {
      fetchOrders();
    }, 5000);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('mototrack_orders_updated', onOrdersUpdated);
      window.addEventListener('storage', onStorage);
      document.addEventListener?.('visibilitychange', onVisible);
    }

    return () => {
      unsubscribe();
      clearInterval(pollId);
      try {
        appSub?.remove?.();
      } catch (_e) {}
      try {
        bc?.close?.();
      } catch (_e) {}
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('mototrack_orders_updated', onOrdersUpdated);
        window.removeEventListener('storage', onStorage);
        document.removeEventListener?.('visibilitychange', onVisible);
      }
    };
  }, [currentUser, fetchOrders]);

  // Real-time counts per category for the dropdown
  const categoryCounts = useMemo(() => {
    const list = Array.isArray(ordersList) ? ordersList : [];
    const counts = {
      All: list.length,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    list.forEach((order) => {
      const st = order.status || 'Processing';
      if (isProcessingGroupStatus(st)) {
        counts.Processing += 1;
      } else if (isShippedGroupStatus(st)) {
        counts.Shipped += 1;
      } else if (
        (st || '').toLowerCase().includes('delivered') ||
        (st || '').toLowerCase().includes('completed')
      ) {
        counts.Delivered += 1;
      } else if ((st || '').toLowerCase().includes('cancel')) {
        counts.Cancelled += 1;
      }
    });
    return counts;
  }, [ordersList]);

  const activeCategory = useMemo(() => {
    return ORDER_CATEGORIES.find((c) => c.id === orderFilter) || ORDER_CATEGORIES[0];
  }, [orderFilter]);

  // Filtered orders list matching selected category
  const filteredOrders = useMemo(() => {
    const list = Array.isArray(ordersList) ? ordersList : [];
    if (orderFilter === 'All') return list;
    return list.filter((order) => {
      const st = order.status || 'Processing';
      const f = orderFilter.toLowerCase();
      if (f === 'processing') return isProcessingGroupStatus(st);
      if (f === 'shipped') return isShippedGroupStatus(st);
      if (f === 'delivered') {
        const s = st.toLowerCase();
        return s.includes('delivered') || s.includes('completed');
      }
      if (f === 'cancelled') return st.toLowerCase().includes('cancel');
      return st.toLowerCase() === f;
    });
  }, [ordersList, orderFilter]);

  const getStatusBadgeStyle = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('delivered') || s.includes('completed')) {
      return { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' };
    }
    if (isOutForDeliveryStatus(status) || s === 'delivery failed') {
      return { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' };
    }
    if (isProcessingGroupStatus(status)) {
      return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
    }
    if (s.includes('cancel')) {
      return { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' };
    }
    return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
  };

  const handleTrackOrder = (order) => {
    setSelectedOrderForTracking(order);
    setIsLiveTrackingOpen(true);
  };

  const handleOpenRating = (order) => {
    setSelectedOrderForRating(order);
    setIsRateModalOpen(true);
  };

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home' || tab === 'Search' || tab === 'Cart') onNavigateToStore?.();
    else if (tab === 'Garage') onNavigateToGarage?.();
    else if (tab === 'Dashboard') onNavigateToProfile?.('overview');
    else if (tab === 'Profile') onNavigateToProfile?.('profile');
    else if (tab === 'Customize') {
      if (onNavigateToCustomizer) onNavigateToCustomizer();
      else if (onNavigateToCustomize) onNavigateToCustomize();
      else onNavigateToStore?.();
    } else if (tab === 'Wishlist' || tab === 'Favorites') {
      onNavigateToWishlist?.();
    } else if (tab === 'Orders') {
      // already on orders page
    }
  };

  return (
    <SafeAreaView style={tailwind.safeArea}>
      <StatusBar style="dark" />

      {/* ─── TOP HEADER BAR (CLEAN, EASY TO NAVIGATE) ─── */}
      <View style={tailwind.topBar}>
        <View style={tailwind.topBarInner}>
          <TouchableOpacity
            style={tailwind.backBtn}
            onPress={onNavigateToStore}
            activeOpacity={0.75}
            accessibilityLabel="Back to Shop"
          >
            <BootstrapIcon name="arrow-left" size={16} color="#0C6258" />
            <Text style={tailwind.backBtnText}>Shop</Text>
          </TouchableOpacity>

          <View style={tailwind.headerTitleWrap}>
            <BootstrapIcon name="box-seam-fill" size={18} color="#0C6258" />
            <Text style={tailwind.headerTitle}>My Orders</Text>
          </View>

          <View style={tailwind.orderBadgePill}>
            <Text style={tailwind.orderBadgeText}>
              {ordersList.length} {ordersList.length === 1 ? 'Order' : 'Orders'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={tailwind.container}
        contentContainerStyle={tailwind.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={tailwind.maxContainer}>
          {/* ─── CATEGORY DROPDOWN (TAILWIND STYLED) ─── */}
          <View style={tailwind.dropdownContainer}>
            <TouchableOpacity
              style={[
                tailwind.dropdownTrigger,
                isDropdownOpen && tailwind.dropdownTriggerOpen,
              ]}
              onPress={() => setIsDropdownOpen((prev) => !prev)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Filter orders by category: ${activeCategory.name}`}
            >
              <View style={tailwind.dropdownTriggerLeft}>
                <View
                  style={[
                    tailwind.dropdownIconWrap,
                    { backgroundColor: activeCategory.bgColor, borderColor: activeCategory.borderColor },
                  ]}
                >
                  <BootstrapIcon
                    name={activeCategory.icon}
                    size={15}
                    color={activeCategory.color}
                  />
                </View>
                <View style={tailwind.dropdownTextCol}>
                  <Text style={tailwind.dropdownSubLabel}>FILTER CATEGORY</Text>
                  <Text style={tailwind.dropdownMainLabel} numberOfLines={1}>
                    {activeCategory.name}
                  </Text>
                </View>
              </View>

              <View style={tailwind.dropdownTriggerRight}>
                <View style={tailwind.categoryCountPill}>
                  <Text style={tailwind.categoryCountText}>
                    {categoryCounts[activeCategory.id] ?? 0}{' '}
                    {(categoryCounts[activeCategory.id] ?? 0) === 1 ? 'Order' : 'Orders'}
                  </Text>
                </View>
                <View
                  style={[
                    tailwind.chevronBox,
                    isDropdownOpen && tailwind.chevronBoxOpen,
                  ]}
                >
                  <BootstrapIcon
                    name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={isDropdownOpen ? '#0C6258' : '#64748B'}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* Expandable Dropdown Menu Card */}
            {isDropdownOpen && (
              <View style={tailwind.dropdownMenuCard}>
                <View style={tailwind.dropdownMenuHeader}>
                  <Text style={tailwind.dropdownMenuHeaderTitle}>Select Category</Text>
                  <TouchableOpacity
                    onPress={() => setIsDropdownOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <BootstrapIcon name="x-circle-fill" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {ORDER_CATEGORIES.map((cat) => {
                  const isSelected = orderFilter === cat.id;
                  const count = categoryCounts[cat.id] ?? 0;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        tailwind.dropdownMenuItem,
                        isSelected && tailwind.dropdownMenuItemSelected,
                      ]}
                      onPress={() => {
                        setOrderFilter(cat.id);
                        setIsDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={tailwind.dropdownMenuItemLeft}>
                        <View
                          style={[
                            tailwind.itemIconWrap,
                            { backgroundColor: cat.bgColor, borderColor: cat.borderColor },
                          ]}
                        >
                          <BootstrapIcon name={cat.icon} size={15} color={cat.color} />
                        </View>
                        <View style={tailwind.itemInfoCol}>
                          <Text
                            style={[
                              tailwind.itemTitle,
                              isSelected && tailwind.itemTitleSelected,
                            ]}
                          >
                            {cat.name}
                          </Text>
                          <Text style={tailwind.itemDesc} numberOfLines={1}>
                            {cat.description}
                          </Text>
                        </View>
                      </View>

                      <View style={tailwind.dropdownMenuItemRight}>
                        <View
                          style={[
                            tailwind.itemCountBadge,
                            isSelected && tailwind.itemCountBadgeSelected,
                          ]}
                        >
                          <Text
                            style={[
                              tailwind.itemCountText,
                              isSelected && tailwind.itemCountTextSelected,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={tailwind.checkWrap}>
                            <BootstrapIcon name="check-circle-fill" size={16} color="#0C6258" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ─── ORDERS LIST OR EMPTY STATE ─── */}
          {filteredOrders.length === 0 ? (
            <View style={tailwind.emptyContainer}>
              <View style={tailwind.emptyIconCircle}>
                <BootstrapIcon name="box-seam" size={32} color="#94A3B8" />
              </View>
              <Text style={tailwind.emptyTitle}>
                {ordersList.length === 0 ? 'No Orders Placed Yet' : 'No Orders Found'}
              </Text>
              <Text style={tailwind.emptySubtitle}>
                {ordersList.length === 0
                  ? "You haven't placed any orders yet. Discover our premium motorcycle parts, exhaust systems, and accessories!"
                  : `You have no orders matching "${activeCategory.name}". Browse our curated catalog of motorparts!`}
              </Text>
              <TouchableOpacity
                style={tailwind.emptyCtaBtn}
                onPress={onNavigateToStore}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="cart-fill" size={14} color="#FFFFFF" />
                <Text style={tailwind.emptyCtaBtnText}>Explore Motorparts</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredOrders.map((order, idx) => {
              const badge = getStatusBadgeStyle(order.status);
              const orderId = order.order_id || order.id || `ord-${idx + 1}`;
              const orderDate = order.order_date || order.date || 'Recent';
              const summary =
                order.items_summary ||
                order.itemsSummary ||
                (Array.isArray(order.items)
                  ? order.items.map((i) => `${i.name} (x${i.quantity || 1})`).join(', ')
                  : 'Genuine Motorcycle Parts & Accessories');
              const totalAmount = Number(
                order.grand_total || order.grandTotal || order.total_amount || order.total || 0
              );

              const isDelivered =
                (order.status || '').toLowerCase().includes('delivered') ||
                (order.status || '').toLowerCase().includes('completed');
              const isOutForDelivery = isOutForDeliveryStatus(order.status);
              const isOrderRated = Boolean(order.is_rated);
              const ratedScore = Number(order.rating_data?.customer_rating || 5);
              const confirmedAt = order.admin_confirmed_at || order.updated_at || null;
              const statusLabel = getDisplayStatusLabel(order.status);

              return (
                <View key={orderId} style={tailwind.orderCard}>
                  {/* Card Header: Order ID, Date & Status Pill */}
                  <View style={tailwind.orderCardHeader}>
                    <View>
                      <Text style={tailwind.orderIdText}>Order #{orderId}</Text>
                      <Text style={tailwind.orderDateText}>{orderDate}</Text>
                    </View>
                    <View
                      style={[
                        tailwind.statusPill,
                        { backgroundColor: badge.bg, borderColor: badge.border, borderWidth: 1 },
                      ]}
                    >
                      <Text style={[tailwind.statusPillText, { color: badge.text }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Card Body: Items Summary */}
                  <Text style={tailwind.orderItemsSummary} numberOfLines={3}>
                    {summary}
                  </Text>

                  {isOutForDelivery && (
                    <View style={tailwind.deliveryMetaBlock}>
                      {order.rider_name ? (
                        <Text style={tailwind.deliveryMetaText}>
                          Rider: {order.rider_name}
                        </Text>
                      ) : null}
                      {order.estimated_delivery ? (
                        <Text style={tailwind.deliveryMetaText}>
                          Expected: {order.estimated_delivery}
                        </Text>
                      ) : null}
                      <Text style={tailwind.deliveryMetaText}>
                        Optional: Confirm Received after you get the package. The store finalizes delivery.
                      </Text>
                      {!order.customer_delivery_confirmed ? (
                        <TouchableOpacity
                          style={{
                            marginTop: 8,
                            backgroundColor: '#0C6258',
                            borderRadius: 10,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            alignSelf: 'flex-start',
                          }}
                          onPress={async (e) => {
                            e?.stopPropagation?.();
                            const oid = order.order_id || order.id;
                            const res = await deliveryService.customerConfirmReceived({
                              orderId: oid,
                              customerUser: currentUser,
                            });
                            if (res.success) {
                              showToast?.('Thanks — store notified you received the order');
                              setOrdersList((prev) =>
                                (prev || []).map((o) =>
                                  o.order_id === oid || o.id === oid
                                    ? {
                                        ...o,
                                        customer_delivery_confirmed: true,
                                        customer_delivery_confirmed_at: new Date().toISOString(),
                                      }
                                    : o
                                )
                              );
                            } else {
                              showToast?.(res.error || 'Could not confirm receipt');
                            }
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                            Confirm Received
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[tailwind.deliveryMetaText, { color: '#047857', marginTop: 6 }]}>
                          You confirmed receipt
                        </Text>
                      )}
                    </View>
                  )}

                  {isDelivered && (
                      <View style={tailwind.confirmedBanner}>
                        <BootstrapIcon name="check-circle-fill" size={13} color="#15803D" />
                        <Text style={tailwind.confirmedBannerText}>
                          Delivered by the store
                          {confirmedAt
                            ? ` · ${new Date(confirmedAt).toLocaleString()}`
                            : ''}
                        </Text>
                      </View>
                    )}

                  {/* Card Footer: Total Amount & Action Buttons */}
                  <View style={tailwind.orderCardFooter}>
                    <View>
                      <Text style={tailwind.orderTotalLabel}>Total Amount</Text>
                      <Text style={tailwind.orderTotalPrice}>₱{totalAmount.toLocaleString()}</Text>
                    </View>

                    <View style={tailwind.orderActionBtnsRow}>
                      {isDelivered && (
                        <TouchableOpacity
                          style={isOrderRated ? tailwind.orderRatedBtn : tailwind.orderRateBtn}
                          onPress={() => handleOpenRating(order)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={isOrderRated ? "View or edit rating" : "Rate delivered items"}
                        >
                          <BootstrapIcon
                            name="star-fill"
                            size={12}
                            color={isOrderRated ? '#D97706' : '#FFFFFF'}
                          />
                          <Text
                            style={
                              isOrderRated
                                ? tailwind.orderRatedBtnText
                                : tailwind.orderRateBtnText
                            }
                          >
                            {isOrderRated ? `Rated ${ratedScore.toFixed(1)} ★` : 'Rate Items'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={tailwind.orderTrackBtn}
                        onPress={() => handleTrackOrder(order)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="geo-alt-fill" size={13} color="#065F46" />
                        <Text style={tailwind.orderTrackBtnText}>
                          {isDelivered ? 'Route' : 'Track Order'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─── LIVE GPS TRACKING MODAL ─── */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
      />

      {/* ─── RATE DELIVERED ITEMS MODAL ─── */}
      <RateDeliveredOrderModal
        visible={isRateModalOpen}
        order={selectedOrderForRating}
        currentUser={currentUser}
        onClose={() => setIsRateModalOpen(false)}
        onSubmitSuccess={() => {
          fetchOrders();
        }}
      />

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

// ─── TAILWIND-INSPIRED ORGANIZED STYLES ──────────────────────────────────────────
const tailwind = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: ANDROID_TOP_INSET,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  maxContainer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },

  // Top Bar
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C6258',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  orderBadgePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },

  // Category Dropdown Styles (Tailwind CSS Aesthetic)
  dropdownContainer: {
    marginBottom: 14,
    zIndex: 40,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  dropdownTriggerOpen: {
    borderColor: '#0C6258',
    backgroundColor: '#F9FCFB',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  dropdownIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropdownTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  dropdownSubLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  dropdownMainLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownTriggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryCountPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  chevronBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chevronBoxOpen: {
    backgroundColor: '#E7F5F3',
    borderColor: '#CCFBF1',
  },
  dropdownMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginTop: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  dropdownMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  dropdownMenuHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 12,
    marginBottom: 3,
  },
  dropdownMenuItemSelected: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dropdownMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemInfoCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemTitleSelected: {
    color: '#0C6258',
    fontWeight: '800',
  },
  itemDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  dropdownMenuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  itemCountBadgeSelected: {
    backgroundColor: '#DCFCE7',
  },
  itemCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  itemCountTextSelected: {
    color: '#15803D',
  },
  checkWrap: {
    marginLeft: 2,
  },

  // Order Card (Tailwind-like: bg-white rounded-2xl p-4 border border-slate-200 shadow-sm)
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  orderDateText: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  orderItemsSummary: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 19,
    marginBottom: 12,
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  orderTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  orderTotalPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0C6258',
    marginTop: 1,
  },
  orderTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  orderTrackBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065F46',
  },
  orderActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  orderRateBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  orderRatedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  orderRatedBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
  },
  deliveryMetaBlock: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  deliveryMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#084A43',
    marginBottom: 2,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  confirmedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  // Empty State (Tailwind centered card)
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0C6258',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyCtaBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
