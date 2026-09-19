import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  LiveOrderTrackingMapModal,
  RateDeliveredOrderModal,
  BottomNavBar,
  ProfileModal,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
} from '../components';
import { orderWebStyles as oStyles } from '../styles/web/orderPage.web.styles';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { deliveryService } from '../services/deliveryService';
import { useWishlist } from '../context/WishlistContext';

const isOutForDeliveryStatus = (status = '') => {
  const st = (status || '').toLowerCase();
  return (
    st === 'out for delivery' ||
    st === 'shipped' ||
    st === 'in transit' ||
    st.includes('transit')
  );
};

const isReportedStatus = (status = '') => {
  const st = (status || '').toLowerCase();
  return st === 'delivery reported' || st === 'reported';
};

const isActiveDispatchStatus = (status = '') => {
  const st = (status || '').toLowerCase();
  return (
    st === 'processing' ||
    st === 'ready for delivery' ||
    st === 'rescheduled' ||
    isOutForDeliveryStatus(status) ||
    isReportedStatus(status) ||
    st === 'delivery failed' ||
    st === 'delivery issue'
  );
};

const getDisplayStatusLabel = (status = '') => {
  if (isReportedStatus(status)) return 'Delivery Reported';
  if (isOutForDeliveryStatus(status)) return 'Out for Delivery';
  const st = (status || '').toLowerCase();
  if (st === 'delivery failed') return 'Delivery Issue';
  return status || 'Processing';
};

export default function OrderPageWeb({
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToGarage,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onLogout,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { wishlistCount } = useWishlist();

  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all'); // 'all' | 'today' | 'week' | 'month'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLiveMapOpen, setIsLiveMapOpen] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Authentication guard: redirect to login if not signed in
  useEffect(() => {
    if (!currentUser) {
      if (setRedirectReason) setRedirectReason('Please sign in to view your orders.');
      if (onNavigateToLogin) onNavigateToLogin();
    }
  }, [currentUser, onNavigateToLogin, setRedirectReason]);

  useEffect(() => {
    let isMounted = true;

    const applyUserOrders = (list) => {
      if (!isMounted) return;
      const userOrders = Array.isArray(list) ? list : [];
      setOrders(userOrders);
      setSelectedOrder((curr) => {
        if (!curr) return userOrders[0] || null;
        return (
          userOrders.find((o) => o.order_id === curr.order_id || o.id === curr.id) ||
          userOrders[0] ||
          null
        );
      });
    };

    const loadUserOrders = async () => {
      if (!currentUser) {
        setOrders([]);
        setSelectedOrder(null);
        return;
      }
      const list = await orderService.getUserOrders(
        currentUser?.id || currentUser?.user_id,
        currentUser?.customer_id,
        currentUser?.name,
        currentUser
      );
      applyUserOrders(list);
    };

    loadUserOrders();

    const unsub = orderService.subscribe(() => {
      if (!isMounted) return;
      loadUserOrders();
    });

    const refreshFromShared = () => {
      loadUserOrders();
    };

    const onOrdersUpdated = () => {
      refreshFromShared();
    };

    const onStorage = (e) => {
      if (e?.key && e.key !== 'mototrack_orders_db') return;
      refreshFromShared();
    };

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshFromShared();
      }
    };

    const onAppState = (nextState) => {
      if (nextState === 'active') refreshFromShared();
    };
    const appSub = AppState.addEventListener?.('change', onAppState);

    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('mototrack_orders');
        bc.onmessage = () => refreshFromShared();
      }
    } catch (_e) {}

    const pollId = setInterval(() => {
      refreshFromShared();
    }, 5000);

    if (typeof window !== 'undefined') {
      window.addEventListener('mototrack_orders_updated', onOrdersUpdated);
      window.addEventListener('storage', onStorage);
      document.addEventListener?.('visibilitychange', onVisible);
    }

    return () => {
      isMounted = false;
      unsub();
      clearInterval(pollId);
      try {
        appSub?.remove?.();
      } catch (_e) {}
      try {
        bc?.close?.();
      } catch (_e) {}
      if (typeof window !== 'undefined') {
        window.removeEventListener('mototrack_orders_updated', onOrdersUpdated);
        window.removeEventListener('storage', onStorage);
        document.removeEventListener?.('visibilitychange', onVisible);
      }
    };
  }, [currentUser]);

  const filteredOrders = orders.filter((o) => {
    const st = (o.status || 'Pending Approval').toLowerCase();
    let statusMatch = true;
    if (filterStatus === 'pending') statusMatch = st.includes('pending') || st.includes('approval');
    else if (filterStatus === 'active') statusMatch = isActiveDispatchStatus(o.status);
    else if (filterStatus === 'delivered') statusMatch = st.includes('delivered') || st.includes('completed');
    else if (filterStatus === 'cancelled') statusMatch = st === 'cancelled';
    if (!statusMatch) return false;

    if (filterDateRange !== 'all') {
      const orderTime = new Date(o.created_at || Date.now()).getTime();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (filterDateRange === 'today') {
        const isToday = now - orderTime <= oneDay || (o.order_date || '').toLowerCase().includes('today');
        if (!isToday) return false;
      } else if (filterDateRange === 'week') {
        if (now - orderTime > 7 * oneDay) return false;
      } else if (filterDateRange === 'month') {
        if (now - orderTime > 30 * oneDay) return false;
      }
    }
    return true;
  });

  // If the open order was marked Delivered, leave the Active tab so the update is visible
  useEffect(() => {
    if (!selectedOrder) return;
    const st = (selectedOrder.status || '').toLowerCase();
    if (filterStatus === 'active' && (st.includes('delivered') || st.includes('completed'))) {
      setFilterStatus('delivered');
    }
    if (
      (filterStatus === 'pending' || filterStatus === 'active') &&
      st.includes('cancel')
    ) {
      setFilterStatus('cancelled');
    }
  }, [selectedOrder?.status, filterStatus, selectedOrder]);

  const totalSpent = orders.reduce((sum, o) => sum + (o.grand_total || o.total_amount || 0), 0);
  const pendingCount = orders.filter(
    (o) =>
      (o.status || '').toLowerCase().includes('pending') ||
      (o.status || '').toLowerCase().includes('approval')
  ).length;
  const activeDispatchCount = orders.filter((o) => isActiveDispatchStatus(o.status)).length;

  const refreshOrders = useCallback(async () => {
    if (!currentUser) {
      setOrders([]);
      setSelectedOrder(null);
      return;
    }
    const list = await orderService.getUserOrders(
      currentUser?.id || currentUser?.user_id,
      currentUser?.customer_id,
      currentUser?.name,
      currentUser
    );
    const userOrders = Array.isArray(list) ? list : [];
    setOrders(userOrders);
    setSelectedOrder((curr) => {
      if (!curr) return userOrders[0] || null;
      return (
        userOrders.find((o) => o.order_id === curr.order_id || o.id === curr.id) ||
        userOrders[0] ||
        null
      );
    });
  }, [currentUser]);

  return (
    <View style={oStyles.container}>
      <StatusBar style="dark" />
      <ToastNotification message={toastMessage} />

      {/* ─── DESKTOP TOP STICKY NAVBAR ─── */}
      <View style={oStyles.headerWrapper}>
        <View style={oStyles.headerInner}>
          <TouchableOpacity
            style={oStyles.logoWrap}
            onPress={() => onNavigateToStore?.()}
            activeOpacity={0.8}
          >
            <BrandLogo size={40} />
          </TouchableOpacity>

          <View style={oStyles.headerNavLinks}>
            <TouchableOpacity
              style={oStyles.navLinkBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="bag-check" size={14} color="#64748B" />
              <Text style={oStyles.navLinkBtnText}>Storefront</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={oStyles.navLinkBtn}
              onPress={() => onNavigateToGarage?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="tools" size={14} color="#64748B" />
              <Text style={oStyles.navLinkBtnText}>Pitstop & Garage</Text>
            </TouchableOpacity>

            {currentUser?.role === 'admin' && (
              <TouchableOpacity
                style={[
                  oStyles.navLinkBtn,
                  {
                    backgroundColor: '#F3F7F6',
                    borderWidth: 1,
                    borderColor: '#D1ECE6',
                    paddingHorizontal: 12,
                    borderRadius: 10,
                  },
                ]}
                onPress={() => onNavigateToAdmin?.()}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="shield-lock-fill" size={13} color="#0C6258" />
                <Text style={[oStyles.navLinkBtnText, { color: '#0C6258', fontWeight: '800' }]}>Admin</Text>
              </TouchableOpacity>
            )}

            {currentUser ? (
              <View style={{ position: 'relative' }}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  size={38}
                />

                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isUserDropdownOpen}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('overview')}
                  onNavigateToProfile={() => onNavigateToProfile?.('profile')}
                  onNavigateToSettings={() => onNavigateToProfile?.('settings')}
                  onNavigateToAdmin={() => onNavigateToAdmin?.()}
                  onLogout={() => {
                    if (onLogout) {
                      onLogout();
                    } else {
                      logout?.();
                      showToast?.('Logged out successfully');
                      onNavigateToStore?.();
                    }
                  }}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={oStyles.signInBtn}
                onPress={() => onNavigateToLogin?.()}
                activeOpacity={0.85}
              >
                <Text style={oStyles.signInBtnText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── ORDERS CONTENT ─── */}
      <ScrollView contentContainerStyle={oStyles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={oStyles.maxContainer}>
          {/* Metrics Row */}
          <View style={oStyles.metricsRow}>
            <View style={oStyles.metricCard}>
              <View style={oStyles.metricIconWrap}>
                <BootstrapIcon name="bag-check-fill" size={18} color="#0C6258" />
              </View>
              <View>
                <Text style={oStyles.metricNum}>{orders.length}</Text>
                <Text style={oStyles.metricLabel}>Total Orders Placed</Text>
              </View>
            </View>

            <View style={oStyles.metricCard}>
              <View style={[oStyles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <BootstrapIcon name="shield-lock-fill" size={18} color="#D97706" />
              </View>
              <View>
                <Text style={[oStyles.metricNum, { color: '#B45309' }]}>{pendingCount}</Text>
                <Text style={oStyles.metricLabel}>Awaiting COD Approval</Text>
              </View>
            </View>

            <View style={oStyles.metricCard}>
              <View style={[oStyles.metricIconWrap, { backgroundColor: '#F3F7F6' }]}>
                <BootstrapIcon name="truck" size={18} color="#0C6258" />
              </View>
              <View>
                <Text style={oStyles.metricNum}>{activeDispatchCount}</Text>
                <Text style={oStyles.metricLabel}>Active Dispatches</Text>
              </View>
            </View>

            <View style={oStyles.metricCard}>
              <View style={[oStyles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <BootstrapIcon name="cash-stack" size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={oStyles.metricNum}>₱{totalSpent.toLocaleString()}</Text>
                <Text style={oStyles.metricLabel}>Total Order Value</Text>
              </View>
            </View>
          </View>

          {/* Filter Toolbar */}
          <View style={[oStyles.toolbar, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View style={oStyles.tabButtons}>
              <TouchableOpacity
                style={[oStyles.tabBtn, filterStatus === 'all' && oStyles.tabBtnActive]}
                onPress={() => setFilterStatus('all')}
              >
                <Text style={[oStyles.tabBtnText, filterStatus === 'all' && oStyles.tabBtnTextActive]}>
                  All Orders ({orders.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[oStyles.tabBtn, filterStatus === 'pending' && oStyles.tabBtnActive]}
                onPress={() => setFilterStatus('pending')}
              >
                <Text style={[oStyles.tabBtnText, filterStatus === 'pending' && oStyles.tabBtnTextActive]}>
                  ⏳ Awaiting COD Approval ({pendingCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[oStyles.tabBtn, filterStatus === 'active' && oStyles.tabBtnActive]}
                onPress={() => setFilterStatus('active')}
              >
                <Text style={[oStyles.tabBtnText, filterStatus === 'active' && oStyles.tabBtnTextActive]}>
                  In Transit / Processing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[oStyles.tabBtn, filterStatus === 'delivered' && oStyles.tabBtnActive]}
                onPress={() => setFilterStatus('delivered')}
              >
                <Text style={[oStyles.tabBtnText, filterStatus === 'delivered' && oStyles.tabBtnTextActive]}>
                  Completed / Delivered
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Range Filter Pills */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Date Range:</Text>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Past 7 Days' },
                { id: 'month', label: 'Past 30 Days' },
              ].map((dr) => (
                <TouchableOpacity
                  key={dr.id}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: filterDateRange === dr.id ? '#0C6258' : '#F1F5F9',
                  }}
                  onPress={() => setFilterDateRange(dr.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: filterDateRange === dr.id ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {dr.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 2-Column Ledger & Details Layout */}
          {filteredOrders.length === 0 ? (
            <View style={oStyles.emptyBox}>
              <BootstrapIcon name="receipt" size={36} color="#94A3B8" />
              <Text style={oStyles.emptyTitle}>No orders found in this category</Text>
              <Text style={oStyles.emptySub}>
                When you complete a checkout in the shop, your delivery telemetry will appear here.
              </Text>
            </View>
          ) : (
            <View style={oStyles.ledgerSplitLayout}>
              {/* Left Column: Order Cards List */}
              <View style={oStyles.orderListCol}>
                {filteredOrders.map((order) => {
                  const isSelected =
                    selectedOrder?.order_id === order.order_id || selectedOrder?.id === order.id;
                  const isPending =
                    (order.status || '').toLowerCase().includes('pending') ||
                    (order.status || '').toLowerCase().includes('approval');
                  const isDelivered =
                    (order.status || '').toLowerCase().includes('delivered') ||
                    (order.status || '').toLowerCase().includes('completed');
                  const isOutForDelivery = isOutForDeliveryStatus(order.status);
                  const statusLabel = isPending
                    ? '⏳ Awaiting COD Approval'
                    : getDisplayStatusLabel(order.status);
                  const confirmedAt = order.admin_confirmed_at || order.updated_at || null;
                  return (
                    <TouchableOpacity
                      key={order.order_id || order.id}
                      style={[oStyles.orderCard, isSelected && oStyles.orderCardSelected]}
                      onPress={() => setSelectedOrder(order)}
                      activeOpacity={0.9}
                    >
                      <View style={oStyles.orderCardTop}>
                        <View>
                          <Text style={oStyles.orderNumber}>ORDER #{order.order_id || order.id}</Text>
                          <Text style={oStyles.orderDate}>{order.order_date || 'Recent'}</Text>
                        </View>
                        <View
                          style={[
                            oStyles.statusPill,
                            isPending
                              ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                              : isDelivered
                                ? oStyles.statusDelivered
                                : isOutForDelivery
                                  ? { backgroundColor: '#E0E7FF', borderColor: '#C7D2FE' }
                                  : oStyles.statusProcessing,
                          ]}
                        >
                          <Text
                            style={[
                              oStyles.statusPillText,
                              isPending
                                ? { color: '#B45309' }
                                : isDelivered
                                  ? oStyles.statusTextDelivered
                                  : isOutForDelivery
                                    ? { color: '#4338CA' }
                                    : oStyles.statusTextProcessing,
                            ]}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      <Text style={oStyles.orderSummaryText} numberOfLines={2}>
                        {order.items_summary || 'Track performance components'}
                      </Text>

                      {isOutForDelivery && (
                        <View
                          style={{
                            backgroundColor: '#F0FDFA',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#CCFBF1',
                            padding: 10,
                            marginBottom: 10,
                            gap: 4,
                          }}
                        >
                          {order.rider_name ? (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#084A43' }}>
                              Rider: {order.rider_name}
                            </Text>
                          ) : null}
                          {order.estimated_delivery ? (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#084A43' }}>
                              Expected: {order.estimated_delivery}
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#084A43' }}>
                            The store will mark this delivered after drop-off.
                          </Text>
                        </View>
                      )}

                      {isDelivered && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: '#DCFCE7',
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#BBF7D0',
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                              marginBottom: 10,
                            }}
                          >
                            <BootstrapIcon name="check-circle-fill" size={12} color="#15803D" />
                            <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: '#15803D' }}>
                              Delivered by the store
                              {confirmedAt
                                ? ` · ${new Date(confirmedAt).toLocaleString()}`
                                : ''}
                            </Text>
                          </View>
                        )}

                      <View style={oStyles.orderCardBottom}>
                        <Text style={oStyles.orderTotalText}>
                          ₱{(order.grand_total || order.total_amount || 0).toFixed(2)}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {isDelivered && (
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: order.is_rated ? '#FEF3C7' : '#D97706',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: order.is_rated ? 1 : 0,
                                borderColor: '#FDE68A',
                              }}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                setSelectedOrderForRating(order);
                                setIsRateModalOpen(true);
                              }}
                              activeOpacity={0.85}
                            >
                              <BootstrapIcon
                                name="star-fill"
                                size={11}
                                color={order.is_rated ? '#D97706' : '#FFFFFF'}
                              />
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: '800',
                                  color: order.is_rated ? '#B45309' : '#FFFFFF',
                                }}
                              >
                                {order.is_rated
                                  ? `Rated ${(order.rating_data?.customer_rating || 5).toFixed(1)} ★`
                                  : 'Rate Items'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={oStyles.trackBtn}
                            onPress={() => {
                              setSelectedOrder(order);
                              setIsLiveMapOpen(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="geo-alt-fill" size={12} color="#0C6258" />
                            <Text style={oStyles.trackBtnText}>Live GPS Route</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Right Column: Selected Order Invoice Drawer */}
              {selectedOrder && (
                <View style={oStyles.invoiceDrawerCol}>
                  <View style={oStyles.invoiceCard}>
                    <View style={oStyles.invoiceHeader}>
                      <View>
                        <Text style={oStyles.invoiceTitle}>Invoice Telemetry</Text>
                        <Text style={oStyles.invoiceSub}>
                          Tracking #{selectedOrder.tracking_number || 'MOTO-TRK-91823'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={oStyles.fullTrackBtn}
                        onPress={() => setIsLiveMapOpen(true)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="geo-fill" size={13} color="#FFFFFF" />
                        <Text style={oStyles.fullTrackBtnText}>Open GPS Map</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Dynamic Delivery Timeline Block */}
                    {(() => {
                      const timeline = orderService.getTrackingTimeline(selectedOrder);
                      return (
                        <View style={oStyles.timelineBlock}>
                          <Text style={[oStyles.blockHeading, { marginBottom: 6 }]}>Delivery Milestones</Text>
                          {timeline.map((step, idx) => (
                            <View key={step.id || idx} style={oStyles.timelineStep}>
                              <View
                                style={[
                                  oStyles.timelineDotActive,
                                  step.isCancelled && { backgroundColor: '#DC2626' },
                                  !step.completed && !step.current && oStyles.timelineDotPending,
                                  step.current &&
                                    !step.isCancelled && {
                                      borderWidth: 2,
                                      borderColor: '#0C6258',
                                      backgroundColor: '#FFFFFF',
                                    },
                                ]}
                              />
                              <View style={{ flex: 1 }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text
                                    style={[
                                      oStyles.timelineStepTitle,
                                      step.isCancelled && { color: '#DC2626' },
                                      !step.completed && !step.current && { color: '#94A3B8' },
                                    ]}
                                  >
                                    {step.title}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                    {step.time && step.time !== '--'
                                      ? `${step.date}, ${step.time}`
                                      : step.date}
                                  </Text>
                                </View>
                                <Text style={oStyles.timelineStepSub}>{step.description}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })()}

                    {/* Cancellation / Return Banner if applicable */}
                    {selectedOrder.cancel_reason ? (
                      <View
                        style={{
                          backgroundColor: '#FEF2F2',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#FECACA',
                          marginBottom: 14,
                        }}
                      >
                        <Text
                          style={{ fontSize: 12.5, fontWeight: '800', color: '#B91C1C', marginBottom: 2 }}
                        >
                          Cancellation Reason:
                        </Text>
                        <Text style={{ fontSize: 12, color: '#7F1D1D' }}>{selectedOrder.cancel_reason}</Text>
                      </View>
                    ) : null}

                    {(isOutForDeliveryStatus(selectedOrder.status) ||
                      isReportedStatus(selectedOrder.status)) && (
                      <View
                        style={{
                          backgroundColor: '#F0FDFA',
                          padding: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#CCFBF1',
                          marginBottom: 14,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                          {isReportedStatus(selectedOrder.status)
                            ? 'Delivery Reported'
                            : 'Out for Delivery'}
                        </Text>
                        {selectedOrder.rider_name ? (
                          <Text style={{ fontSize: 12.5, color: '#084A43', marginBottom: 4, fontWeight: '600' }}>
                            Rider: {selectedOrder.rider_name}
                          </Text>
                        ) : null}
                        {selectedOrder.estimated_delivery ? (
                          <Text style={{ fontSize: 12.5, color: '#084A43', marginBottom: 4, fontWeight: '600' }}>
                            Expected: {selectedOrder.estimated_delivery}
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 12.5, color: '#084A43', fontWeight: '600', marginBottom: 10 }}>
                          {isReportedStatus(selectedOrder.status)
                            ? 'The rider reported drop-off. The store will confirm delivery shortly.'
                            : 'Optional: tap below if you already received your package. Final delivery is confirmed by the store.'}
                        </Text>
                        {!selectedOrder.customer_delivery_confirmed && (
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#0C6258',
                              borderRadius: 10,
                              paddingVertical: 10,
                              paddingHorizontal: 14,
                              alignSelf: 'flex-start',
                            }}
                            onPress={async () => {
                              const oid = selectedOrder.order_id || selectedOrder.id;
                              const res = await deliveryService.customerConfirmReceived({
                                orderId: oid,
                                customerUser: currentUser,
                              });
                              if (res.success) {
                                showToast('Thanks — we notified the store you received your order');
                                setSelectedOrder((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        customer_delivery_confirmed: true,
                                        customer_delivery_confirmed_at: new Date().toISOString(),
                                      }
                                    : prev
                                );
                              } else {
                                showToast(res.error || 'Could not confirm receipt');
                              }
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                              Confirm Received
                            </Text>
                          </TouchableOpacity>
                        )}
                        {selectedOrder.customer_delivery_confirmed ? (
                          <Text style={{ fontSize: 12, color: '#047857', fontWeight: '700' }}>
                            You confirmed receipt
                            {selectedOrder.customer_delivery_confirmed_at
                              ? ` · ${new Date(selectedOrder.customer_delivery_confirmed_at).toLocaleString()}`
                              : ''}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    {((selectedOrder.status || '').toLowerCase().includes('delivered') ||
                      (selectedOrder.status || '').toLowerCase().includes('completed')) && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: '#DCFCE7',
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#BBF7D0',
                            marginBottom: 14,
                          }}
                        >
                          <BootstrapIcon name="check-circle-fill" size={14} color="#15803D" />
                          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: '#15803D' }}>
                            Delivered by the store
                            {selectedOrder.admin_confirmed_at || selectedOrder.updated_at
                              ? ` · ${new Date(
                                  selectedOrder.admin_confirmed_at || selectedOrder.updated_at
                                ).toLocaleString()}`
                              : ''}
                          </Text>
                        </View>
                      )}

                    {selectedOrder.return_status && selectedOrder.return_status !== 'none' ? (
                      <View
                        style={{
                          backgroundColor: '#F0FDF4',
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#BBF7D0',
                          marginBottom: 14,
                        }}
                      >
                        <Text
                          style={{ fontSize: 12.5, fontWeight: '800', color: '#166534', marginBottom: 2 }}
                        >
                          Return Status: {selectedOrder.return_status.toUpperCase()}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#14532D' }}>
                          Reason: {selectedOrder.return_reason || 'N/A'}{' '}
                          {selectedOrder.return_notes ? `(${selectedOrder.return_notes})` : ''}
                        </Text>
                      </View>
                    ) : null}

                    {/* Customer & Address Details */}
                    <View style={oStyles.detailsBlock}>
                      <Text style={oStyles.blockHeading}>Recipient Details</Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Name: </Text>
                        {selectedOrder.customer_name || 'Rider'}
                      </Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Contact: </Text>
                        {selectedOrder.customer_phone || '+63 917 000 0000'}
                      </Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Address: </Text>
                        {selectedOrder.customer_address || 'Delivery Address'}
                      </Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Payment: </Text>
                        {selectedOrder.payment_method || 'GCash / COD'}
                      </Text>
                    </View>

                    {/* Items List */}
                    <View style={oStyles.itemsBlock}>
                      <Text style={oStyles.blockHeading}>
                        Ordered Items ({selectedOrder.items?.length || 1})
                      </Text>
                      {selectedOrder.items?.map((item, idx) => (
                        <View key={idx} style={oStyles.itemRow}>
                          <Image
                            source={{
                              uri:
                                item.image ||
                                'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=120&q=80',
                            }}
                            style={oStyles.itemThumb}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={oStyles.itemName}>{item.name}</Text>
                            <Text style={oStyles.itemMeta}>
                              Qty: {item.quantity} • ₱{(item.price || 0).toFixed(2)} each
                            </Text>
                          </View>
                          <Text style={oStyles.itemTotal}>
                            ₱{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Total Calculation */}
                    <View style={oStyles.totalSummaryBlock}>
                      <View style={oStyles.totalRow}>
                        <Text style={oStyles.totalLabel}>Subtotal</Text>
                        <Text style={oStyles.totalVal}>₱{(selectedOrder.total_amount || 0).toFixed(2)}</Text>
                      </View>
                      <View style={oStyles.totalRow}>
                        <Text style={oStyles.totalLabel}>Discount</Text>
                        <Text style={[oStyles.totalVal, { color: '#16A34A' }]}>
                          -₱{(selectedOrder.discount_amount || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={[oStyles.totalRow, oStyles.grandTotalRow]}>
                        <Text style={oStyles.grandTotalLabel}>Grand Total</Text>
                        <Text style={oStyles.grandTotalVal}>
                          ₱{(selectedOrder.grand_total || selectedOrder.total_amount || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Live GPS Modal */}
      <LiveOrderTrackingMapModal
        visible={isLiveMapOpen}
        order={selectedOrder}
        onClose={() => setIsLiveMapOpen(false)}
        showToast={showToast}
      />

      {/* User Profile & Address Settings Modal */}
      <ProfileModal
        visible={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onNavigateToOrders={() => setIsProfileModalOpen(false)}
        onNavigateToWishlist={onNavigateToWishlist}
        onNavigateToAdmin={onNavigateToAdmin}
        showToast={showToast}
      />

      {/* Rate Delivered Items Modal */}
      <RateDeliveredOrderModal
        visible={isRateModalOpen}
        order={selectedOrderForRating}
        currentUser={currentUser}
        onClose={() => setIsRateModalOpen(false)}
        onSubmitSuccess={() => {
          showToast('Review submitted successfully!');
          refreshOrders();
        }}
      />

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Orders"
          onTabChange={(tab) => {
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
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                setIsProfileModalOpen(true);
              }
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}
    </View>
  );
}
