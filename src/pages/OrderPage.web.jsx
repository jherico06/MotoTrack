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
import { BootstrapIcon, ToastNotification, LiveOrderTrackingMapModal, BottomNavBar } from '../components';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { useWishlist } from '../context/WishlistContext';

export default function OrderPageWeb({
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToGarage,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, setRedirectReason } = useAuth();
  const { wishlistCount } = useWishlist ? useWishlist() : { wishlistCount: 0 };

  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLiveMapOpen, setIsLiveMapOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    const list = orderService.getLocalOrders();
    setOrders(list);
    if (list.length > 0) {
      setSelectedOrder(list[0]);
    }
    const unsub = orderService.subscribe((updatedList) => {
      setOrders(updatedList);
      setSelectedOrder((curr) => {
        if (!curr) return updatedList[0] || null;
        return updatedList.find((o) => o.order_id === curr.order_id || o.id === curr.id) || updatedList[0] || null;
      });
    });
    return () => unsub();
  }, []);

  const filteredOrders = orders.filter((o) => {
    const st = (o.status || 'Pending Approval').toLowerCase();
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return st.includes('pending') || st.includes('approval');
    if (filterStatus === 'active') return st === 'processing' || st === 'shipped' || st === 'in transit';
    if (filterStatus === 'delivered') return st === 'delivered';
    if (filterStatus === 'cancelled') return st === 'cancelled';
    return true;
  });

  const totalSpent = orders.reduce((sum, o) => sum + (o.grand_total || o.total_amount || 0), 0);
  const pendingCount = orders.filter((o) => (o.status || '').toLowerCase().includes('pending') || (o.status || '').toLowerCase().includes('approval')).length;

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
            <View style={oStyles.logoIconBadge}>
              <BootstrapIcon name="speedometer2" size={20} color="#FFFFFF" />
            </View>
            <Text style={oStyles.logoText}>
              Moto<Text style={{ color: '#0C6258' }}>Track</Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}> ORDER PORTAL</Text>
            </Text>
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

            <TouchableOpacity
              style={[oStyles.navLinkBtn, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', paddingHorizontal: 12, borderRadius: 10 }]}
              onPress={() => onNavigateToAdmin?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="shield-lock-fill" size={13} color="#0C6258" />
              <Text style={[oStyles.navLinkBtnText, { color: '#0C6258', fontWeight: '800' }]}>Admin</Text>
            </TouchableOpacity>

            {currentUser ? (
              <TouchableOpacity
                style={oStyles.userPill}
                onPress={() => onNavigateToProfile?.()}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }}
                  style={oStyles.userAvatar}
                />
                <Text style={oStyles.userNameText}>{currentUser.name}</Text>
              </TouchableOpacity>
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
                  {orders.filter(o => o.status === 'Processing' || o.status === 'Shipped' || o.status === 'In Transit').length}
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
          <View style={oStyles.toolbar}>
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
          </View>

          {/* 2-Column Ledger & Details Layout */}
          {filteredOrders.length === 0 ? (
            <View style={oStyles.emptyBox}>
              <BootstrapIcon name="receipt" size={36} color="#94A3B8" />
              <Text style={oStyles.emptyTitle}>No orders found in this category</Text>
              <Text style={oStyles.emptySub}>When you complete a checkout in the shop, your delivery telemetry will appear here.</Text>
            </View>
          ) : (
            <View style={oStyles.ledgerSplitLayout}>

              {/* Left Column: Order Cards List */}
              <View style={oStyles.orderListCol}>
                {filteredOrders.map((order) => {
                  const isSelected = selectedOrder?.order_id === order.order_id || selectedOrder?.id === order.id;
                  const isPending = (order.status || '').toLowerCase().includes('pending') || (order.status || '').toLowerCase().includes('approval');
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
                        <View style={[
                          oStyles.statusPill,
                          isPending ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' } : isDelivered ? oStyles.statusDelivered : oStyles.statusProcessing
                        ]}>
                          <Text style={[
                            oStyles.statusPillText,
                            isPending ? { color: '#B45309' } : isDelivered ? oStyles.statusTextDelivered : oStyles.statusTextProcessing
                          ]}>
                            {isPending ? '⏳ Awaiting COD Approval' : order.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={oStyles.orderSummaryText} numberOfLines={2}>
                        {order.items_summary || 'Track performance components'}
                      </Text>

                      <View style={oStyles.orderCardBottom}>
                        <Text style={oStyles.orderTotalText}>₱{(order.grand_total || order.total_amount || 0).toFixed(2)}
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
                        <Text style={oStyles.invoiceSub}>Tracking #{selectedOrder.tracking_number || 'MOTO-TRK-91823'}</Text>
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

                    {/* Delivery Timeline Block */}
                    <View style={oStyles.timelineBlock}>
                      <View style={oStyles.timelineStep}>
                        <View style={oStyles.timelineDotActive} />
                        <View>
                          <Text style={oStyles.timelineStepTitle}>Order Confirmed & Dyno Inspected</Text>
                          <Text style={oStyles.timelineStepSub}>Warehouse Circuit Makati</Text>
                        </View>
                      </View>
                      <View style={oStyles.timelineStep}>
                        <View style={oStyles.timelineDotActive} />
                        <View>
                          <Text style={oStyles.timelineStepTitle}>Handed to {selectedOrder.courier || 'MotoTrack SuperAir'}</Text>
                          <Text style={oStyles.timelineStepSub}>Courier on track route</Text>
                        </View>
                      </View>
                      <View style={oStyles.timelineStep}>
                        <View style={oStyles.timelineDotPending} />
                        <View>
                          <Text style={oStyles.timelineStepTitle}>Estimated Delivery</Text>
                          <Text style={oStyles.timelineStepSub}>{selectedOrder.estimated_delivery || 'Today (30-45 mins)'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Customer & Address Details */}
                    <View style={oStyles.detailsBlock}>
                      <Text style={oStyles.blockHeading}>Recipient Details</Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Name: </Text>{selectedOrder.customer_name || 'Rider'}
                      </Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Contact: </Text>{selectedOrder.customer_phone || '+63 917 000 0000'}
                      </Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Address: </Text>{selectedOrder.customer_address || 'Delivery Address'}
                      </Text>
                      <Text style={oStyles.detailLine}>
                        <Text style={{ fontWeight: '800' }}>Payment: </Text>{selectedOrder.payment_method || 'GCash / COD'}
                      </Text>
                    </View>

                    {/* Items List */}
                    <View style={oStyles.itemsBlock}>
                      <Text style={oStyles.blockHeading}>Ordered Items ({selectedOrder.items?.length || 1})</Text>
                      {selectedOrder.items?.map((item, idx) => (
                        <View key={idx} style={oStyles.itemRow}>
                          <Image source={{ uri: item.image || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=120&q=80' }} style={oStyles.itemThumb} />
                          <View style={{ flex: 1 }}>
                            <Text style={oStyles.itemName}>{item.name}</Text>
                            <Text style={oStyles.itemMeta}>Qty: {item.quantity} • ₱{(item.price || 0).toFixed(2)} each</Text>
                          </View>
                          <Text style={oStyles.itemTotal}>₱{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</Text>
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
                        <Text style={[oStyles.totalVal, { color: '#16A34A' }]}>-₱{(selectedOrder.discount_amount || 0).toFixed(2)}</Text>
                      </View>
                      <View style={[oStyles.totalRow, oStyles.grandTotalRow]}>
                        <Text style={oStyles.grandTotalLabel}>Grand Total</Text>
                        <Text style={oStyles.grandTotalVal}>₱{(selectedOrder.grand_total || selectedOrder.total_amount || 0).toFixed(2)}</Text>
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

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Home"
          onTabChange={(tab) => {
            if (tab === 'Home') {
              onNavigateToStore?.();
            } else if (tab === 'Garage') {
              onNavigateToGarage?.();
            } else if (tab === 'Favorites') {
              onNavigateToWishlist?.();
            } else if (tab === 'Admin') {
              onNavigateToAdmin?.();
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.();
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

const oStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
  },
  headerInner: {
    maxWidth: 1360,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerNavLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  navLinkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
    paddingVertical: 4,
    paddingLeft: 4,
    borderRadius: 20,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  userNameText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#042F2E',
  },
  signInBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#0F172A',
  },
  signInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  maxContainer: {
    maxWidth: 1360,
    marginHorizontal: 'auto',
    width: '100%',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F3F7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  toolbar: {
    marginBottom: 20,
  },
  tabButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#0C6258',
    borderColor: '#0C6258',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  emptyBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  ledgerSplitLayout: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  orderListCol: {
    flex: 1.1,
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  orderCardSelected: {
    borderColor: '#0C6258',
    backgroundColor: '#F8FAF9',
  },
  orderCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0C6258',
  },
  orderDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusProcessing: {
    backgroundColor: '#F3F7F6',
  },
  statusTextProcessing: {
    color: '#0C6258',
    fontSize: 11.5,
    fontWeight: '800',
  },
  statusDelivered: {
    backgroundColor: '#DCFCE7',
  },
  statusTextDelivered: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '800',
  },
  orderSummaryText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 19,
    marginVertical: 10,
  },
  orderCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  orderTotalText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  trackBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0C6258',
  },
  invoiceDrawerCol: {
    flex: 1.2,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  invoiceSub: {
    fontSize: 12.5,
    color: '#0C6258',
    fontWeight: '700',
    marginTop: 2,
  },
  fullTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C6258',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  fullTrackBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  timelineBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0C6258',
  },
  timelineDotPending: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },
  timelineStepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineStepSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  detailsBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
    gap: 4,
  },
  blockHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  detailLine: {
    fontSize: 12.5,
    color: '#475569',
  },
  itemsBlock: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemMeta: {
    fontSize: 11.5,
    color: '#64748B',
  },
  itemTotal: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  totalSummaryBlock: {
    gap: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  totalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  grandTotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  grandTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0C6258',
  },
});
