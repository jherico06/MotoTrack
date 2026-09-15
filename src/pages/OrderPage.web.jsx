import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  LiveOrderTrackingMapModal,
  BottomNavBar,
  ProfileModal,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
} from '../components';
import { orderWebStyles as oStyles } from '../styles/web/orderPage.web.styles';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { useWishlist } from '../context/WishlistContext';

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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Redirect guard: Customer orders belong exclusively in the Customer Dashboard
  useEffect(() => {
    if (!currentUser) {
      if (setRedirectReason) setRedirectReason('Please sign in to view your orders in your Customer Dashboard.');
      if (onNavigateToLogin) onNavigateToLogin();
    } else {
      if (onNavigateToProfile) onNavigateToProfile('orders');
    }
  }, [currentUser, onNavigateToLogin, onNavigateToProfile, setRedirectReason]);

  useEffect(() => {
    let isMounted = true;

    const loadUserOrders = async () => {
      if (!currentUser) {
        setOrders([]);
        setSelectedOrder(null);
        return;
      }
      const list = await orderService.getUserOrders(
        currentUser?.id || currentUser?.user_id,
        currentUser?.customer_id,
        currentUser?.name
      );
      if (isMounted) {
        const userOrders = Array.isArray(list) ? list : [];
        setOrders(userOrders);
        setSelectedOrder(userOrders[0] || null);
      }
    };

    loadUserOrders();

    const unsub = orderService.subscribe((updatedList) => {
      if (!isMounted || !Array.isArray(updatedList)) return;
      if (!currentUser) {
        setOrders([]);
        setSelectedOrder(null);
        return;
      }
      const userId = currentUser?.id || currentUser?.user_id;
      const customerId = currentUser?.customer_id;
      const userOrders = updatedList.filter((o) => {
        const uMatch = Boolean(userId && (o.user_id === userId || o.customer_id === userId));
        const cMatch = Boolean(customerId && (o.customer_id === customerId || o.user_id === customerId));
        return uMatch || cMatch;
      });
      setOrders(userOrders);
      setSelectedOrder((curr) => {
        if (!curr) return userOrders[0] || null;
        return (
          userOrders.find((o) => o.order_id === curr.order_id || o.id === curr.id) || userOrders[0] || null
        );
      });
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  const filteredOrders = orders.filter((o) => {
    const st = (o.status || 'Pending Approval').toLowerCase();
    let statusMatch = true;
    if (filterStatus === 'pending') statusMatch = st.includes('pending') || st.includes('approval');
    else if (filterStatus === 'active')
      statusMatch = st === 'processing' || st === 'shipped' || st === 'in transit';
    else if (filterStatus === 'delivered') statusMatch = st === 'delivered';
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

  const totalSpent = orders.reduce((sum, o) => sum + (o.grand_total || o.total_amount || 0), 0);
  const pendingCount = orders.filter(
    (o) =>
      (o.status || '').toLowerCase().includes('pending') ||
      (o.status || '').toLowerCase().includes('approval')
  ).length;

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
                <Text style={oStyles.metricNum}>
                  {
                    orders.filter(
                      (o) => o.status === 'Processing' || o.status === 'Shipped' || o.status === 'In Transit'
                    ).length
                  }
                </Text>
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
                  const isDelivered = (order.status || '').toLowerCase() === 'delivered';
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
                                  : oStyles.statusTextProcessing,
                            ]}
                          >
                            {isPending ? '⏳ Awaiting COD Approval' : order.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={oStyles.orderSummaryText} numberOfLines={2}>
                        {order.items_summary || 'Track performance components'}
                      </Text>

                      <View style={oStyles.orderCardBottom}>
                        <Text style={oStyles.orderTotalText}>
                          ₱{(order.grand_total || order.total_amount || 0).toFixed(2)}
                        </Text>

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
