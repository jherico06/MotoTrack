import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import {
  RIDER_FONT,
  cardShadowStyle,
  formatOrderCode,
  formatPhp,
  formatPhpExact,
  isCodOrder,
  formatCompletedTimeLabel,
} from './riderTheme.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

export default function RiderEarningsView({
  palette,
  deliveredOrders = [],
  earningsLedger = [],
  weekEarnings = 0,
  totalRiderEarnings = 0,
  onSelectOrder,
}) {
  const [period, setPeriod] = useState('week'); // 'week' | 'today' | 'all'

  const normalizedEntries = useMemo(() => {
    const byOrder = new Map();
    deliveredOrders.forEach((d) => {
      if (d?.orderId) byOrder.set(String(d.orderId), d);
    });

    if (Array.isArray(earningsLedger) && earningsLedger.length > 0) {
      return earningsLedger.map((row, idx) => {
        const linked = row?.order_id
          ? byOrder.get(String(row.order_id))
          : null;
        return {
          id: row.id || `earn-${idx}`,
          orderId: row.order_id || linked?.orderId || '',
          customerName: linked?.customerName || 'MotoTrack Delivery',
          address: linked?.customerAddress || row.notes || 'Shipping fee credit',
          amount: Number(row.amount) || 0,
          timestamp: row.created_at || linked?.deliveredAt || null,
          deliveryRef: linked || null,
        };
      });
    }

    return deliveredOrders.map((d, idx) => ({
      id: `del-earn-${d.orderId || idx}`,
      orderId: d.orderId,
      customerName: d.customerName || 'Customer',
      address: d.customerAddress || 'Completed delivery',
      amount: Number(d.riderEarning || d.shippingFee) || 0,
      timestamp: d.deliveredAt || null,
      deliveryRef: d,
    }));
  }, [deliveredOrders, earningsLedger]);

  const todayStart = useMemo(() => startOfToday(), []);
  const weekStart = useMemo(() => startOfWeek(), []);

  const todayEarned = useMemo(() => {
    return normalizedEntries.reduce((sum, item) => {
      const dt = item.timestamp ? new Date(item.timestamp) : null;
      if (!dt || Number.isNaN(dt.getTime()) || dt < todayStart) return sum;
      return sum + item.amount;
    }, 0);
  }, [normalizedEntries, todayStart]);

  const allTimeEarned = useMemo(() => {
    const ledgerSum = normalizedEntries.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    return Math.max(Number(totalRiderEarnings) || 0, ledgerSum);
  }, [normalizedEntries, totalRiderEarnings]);

  const codCollectedToday = useMemo(() => {
    return deliveredOrders.reduce((sum, d) => {
      if (!isCodOrder(d)) return sum;
      const dt = d.deliveredAt ? new Date(d.deliveredAt) : null;
      if (!dt || Number.isNaN(dt.getTime()) || dt < todayStart) return sum;
      return sum + (Number(d.totalAmount) || 0);
    }, 0);
  }, [deliveredOrders, todayStart]);

  const filteredEntries = useMemo(() => {
    if (period === 'today') {
      return normalizedEntries.filter((item) => {
        const dt = item.timestamp ? new Date(item.timestamp) : null;
        return dt && !Number.isNaN(dt.getTime()) && dt >= todayStart;
      });
    }
    if (period === 'week') {
      return normalizedEntries.filter((item) => {
        const dt = item.timestamp ? new Date(item.timestamp) : null;
        return !dt || Number.isNaN(dt.getTime()) || dt >= weekStart;
      });
    }
    return normalizedEntries;
  }, [normalizedEntries, period, todayStart, weekStart]);

  const periodTotal =
    period === 'today'
      ? todayEarned
      : period === 'week'
        ? weekEarnings
        : allTimeEarned;

  return (
    <View style={styles.container}>
      {/* Charcoal Hero Earnings Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroOverline}>MOTOTRACK RIDER PAYOUTS</Text>
            <Text style={styles.heroAmount}>{formatPhpExact(periodTotal)}</Text>
          </View>
          <View style={styles.heroIconBadge}>
            <BootstrapIcon name="wallet2" size={19} color="#FF4D00" />
          </View>
        </View>

        <Text style={styles.heroSub}>
          {period === 'today'
            ? 'Delivery fees credited today'
            : period === 'week'
              ? 'Shipping fees earned this week'
              : 'Total lifetime credited rider earnings'}
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Today</Text>
            <Text style={styles.heroStatValue}>{formatPhp(todayEarned)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>Completed</Text>
            <Text style={styles.heroStatValue}>{deliveredOrders.length}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>COD collected</Text>
            <Text style={styles.heroStatValue}>
              {formatPhp(codCollectedToday)}
            </Text>
          </View>
        </View>
      </View>

      {/* Period Filter Tabs */}
      <View
        style={[
          styles.segmentedTrack,
          { backgroundColor: palette.isDark ? palette.bgCard : '#ECEEF0' },
        ]}
      >
        {[
          { id: 'week', label: 'This week' },
          { id: 'today', label: 'Today' },
          { id: 'all', label: 'All time' },
        ].map((tab) => {
          const active = period === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.segmentBtn,
                active && [
                  styles.segmentBtnActive,
                  { backgroundColor: palette.bgSheet },
                ],
              ]}
              onPress={() => setPeriod(tab.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: active ? palette.textPrimary : palette.textMuted,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Ledger Section */}
      <View
        style={[
          styles.ledgerSheet,
          !palette.isDark && cardShadowStyle,
          {
            backgroundColor: palette.bgCard,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.ledgerHeader}>
          <Text style={[styles.ledgerTitle, { color: palette.textPrimary }]}>
            Earnings activity
          </Text>
          <View
            style={[styles.countPill, { backgroundColor: palette.bgMuted }]}
          >
            <Text
              style={[styles.countPillText, { color: palette.textSecondary }]}
            >
              {filteredEntries.length}{' '}
              {filteredEntries.length === 1 ? 'trip' : 'trips'}
            </Text>
          </View>
        </View>

        {filteredEntries.length === 0 ? (
          <View style={styles.emptyBox}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: palette.bgMuted },
              ]}
            >
              <BootstrapIcon
                name="wallet2"
                size={22}
                color={palette.textSubtle}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No credited deliveries in this period
            </Text>
            <Text style={[styles.emptySub, { color: palette.textMuted }]}>
              Completed QR-confirmed drop-offs automatically credit your
              shipping fee here.
            </Text>
          </View>
        ) : (
          filteredEntries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              style={[
                styles.ledgerRow,
                idx < filteredEntries.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                },
              ]}
              disabled={!entry.deliveryRef}
              onPress={() => {
                if (entry.deliveryRef) onSelectOrder?.(entry.deliveryRef);
              }}
              activeOpacity={0.78}
            >
              <View
                style={[
                  styles.ledgerRowIcon,
                  { backgroundColor: palette.orangeSoft },
                ]}
              >
                <BootstrapIcon name="check" size={15} color={palette.orange} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.ledgerTopLine}>
                  <Text
                    style={[
                      styles.ledgerCustomer,
                      { color: palette.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {entry.customerName}
                  </Text>
                  <Text
                    style={[styles.ledgerAmount, { color: palette.orange }]}
                  >
                    +{formatPhpExact(entry.amount)}
                  </Text>
                </View>

                <View style={styles.ledgerBottomLine}>
                  <Text
                    style={[styles.ledgerOrderCode, { color: palette.textMuted }]}
                  >
                    {entry.orderId
                      ? formatOrderCode(entry.orderId)
                      : 'Delivery credit'}
                  </Text>
                  <Text
                    style={[styles.ledgerTime, { color: palette.textMuted }]}
                  >
                    {entry.deliveryRef
                      ? formatCompletedTimeLabel(entry.deliveryRef)
                      : entry.timestamp
                        ? new Date(entry.timestamp).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                            }
                          )
                        : 'Credited'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#202426',
    borderRadius: 18,
    padding: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroOverline: {
    fontFamily: RIDER_FONT,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#FF4D00',
  },
  heroAmount: {
    fontFamily: RIDER_FONT,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 77, 0, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 0, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSub: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
    color: '#9BA3AA',
    marginTop: 4,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2F32',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 15,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#3A4044',
  },
  heroStatLabel: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '500',
    color: '#9BA3AA',
  },
  heroStatValue: {
    fontFamily: RIDER_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    shadowColor: '#202426',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
  },
  ledgerSheet: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ledgerTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 16,
    fontWeight: '600',
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  ledgerRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ledgerCustomer: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 14,
    fontWeight: '600',
  },
  ledgerAmount: {
    fontFamily: RIDER_FONT,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ledgerBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 8,
  },
  ledgerOrderCode: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  ledgerTime: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 14.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
});

