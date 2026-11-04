import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { googleMapsNavigateUrl } from '../../../utils/geo.js';
import {
  RIDER_FONT,
  cardShadowStyle,
  formatOrderCode,
  formatPhp,
  formatPhpExact,
  isDeliveredOrder,
  isCodOrder,
  formatActiveDeadlineLabel,
  formatCompletedTimeLabel,
  getOrderStatusBadge,
} from './riderTheme.js';

export default function RiderOrderCard({
  delivery,
  palette,
  onViewDetails,
  onScanConfirm,
}) {
  const delivered = isDeliveredOrder(delivery);
  const badge = getOrderStatusBadge(delivery, palette);
  const cod = isCodOrder(delivery);
  const earningAmount =
    Number(delivery?.riderEarning || delivery?.shippingFee) || 0;
  const navUrl = googleMapsNavigateUrl(
    delivery?.lat,
    delivery?.lng,
    delivery?.customerAddress
  );

  return (
    <View
      style={[
        styles.card,
        !palette.isDark && cardShadowStyle,
        {
          backgroundColor: palette.bgCard,
          borderColor: palette.border,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onViewDetails?.(delivery)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${formatOrderCode(delivery?.orderId)} for ${delivery?.customerName || 'Customer'}`}
      >
        {/* Top Row: Order Number & Status Pill */}
        <View style={styles.topRow}>
          <View style={styles.orderCustomerCol}>
            <Text style={[styles.orderCode, { color: palette.textMuted }]}>
              {formatOrderCode(delivery?.orderId)}
            </Text>
            <Text
              style={[styles.customerName, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {delivery?.customerName || 'Customer'}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: badge.bg,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Address Row */}
        <View style={styles.addressRow}>
          <BootstrapIcon
            name="geo-alt"
            size={14}
            color={palette.textMuted}
            style={styles.addressIcon}
          />
          <Text
            style={[styles.addressText, { color: palette.textMuted }]}
            numberOfLines={2}
          >
            {delivery?.customerAddress || 'No delivery address provided'}
          </Text>
        </View>

        {/* Tonal Deadline / Completion & COD / Earnings Strip */}
        <View
          style={[
            styles.infoStrip,
            {
              backgroundColor: palette.bgMuted,
            },
          ]}
        >
          <View style={styles.infoLeft}>
            <BootstrapIcon
              name={delivered ? 'check' : 'clock'}
              size={14}
              color={delivered ? palette.textPrimary : palette.textMuted}
            />
            <Text
              style={[styles.infoTimeText, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {delivered
                ? formatCompletedTimeLabel(delivery)
                : formatActiveDeadlineLabel(delivery)}
            </Text>
          </View>

          {delivered ? (
            <Text style={[styles.earnedText, { color: palette.orange }]}>
              {formatPhp(earningAmount)} earned
            </Text>
          ) : (
            <Text style={[styles.codText, { color: palette.textPrimary }]}>
              {formatPhpExact(delivery?.totalAmount)} · {cod ? 'COD' : 'Paid'}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      {delivered ? (
        <View style={styles.deliveredActionWrap}>
          <TouchableOpacity
            style={[
              styles.outlinedBtn,
              styles.deliveredDetailsBtn,
              {
                borderColor: palette.borderStrong,
                backgroundColor: palette.bgCard,
              },
            ]}
            onPress={() => onViewDetails?.(delivery)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="View order details"
          >
            <Text
              style={[styles.outlinedBtnText, { color: palette.textPrimary }]}
            >
              View details
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.activeActionsWrap}>
          <View style={styles.secondaryButtonsRow}>
            <ExternalLink href={navUrl} style={styles.halfBtnSlot}>
              <View
                style={[
                  styles.outlinedBtn,
                  {
                    borderColor: palette.borderStrong,
                    backgroundColor: palette.bgCard,
                  },
                ]}
              >
                <BootstrapIcon
                  name="geo-alt"
                  size={14}
                  color={palette.textPrimary}
                />
                <Text
                  style={[
                    styles.outlinedBtnText,
                    { color: palette.textPrimary },
                  ]}
                >
                  Navigate
                </Text>
              </View>
            </ExternalLink>

            <TouchableOpacity
              style={[
                styles.outlinedBtn,
                styles.halfBtnSlot,
                {
                  borderColor: palette.borderStrong,
                  backgroundColor: palette.bgCard,
                },
              ]}
              onPress={() => onViewDetails?.(delivery)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="View order details"
            >
              <Text
                style={[
                  styles.outlinedBtnText,
                  { color: palette.textPrimary },
                ]}
              >
                View details
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.scanPrimaryBtn,
              { backgroundColor: palette.orange },
            ]}
            onPress={() => onScanConfirm?.(delivery)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Scan and confirm order ${formatOrderCode(delivery?.orderId)}`}
          >
            <BootstrapIcon name="qr-code-scan" size={16} color="#FFFFFF" />
            <Text style={styles.scanPrimaryBtnText}>Scan & confirm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderCustomerCol: {
    flex: 1,
  },
  orderCode: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  customerName: {
    fontFamily: RIDER_FONT,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 7,
  },
  addressIcon: {
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginTop: 11,
    gap: 8,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  infoTimeText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  codText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  earnedText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  activeActionsWrap: {
    marginTop: 12,
    gap: 9,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 9,
  },
  halfBtnSlot: {
    flex: 1,
  },
  outlinedBtn: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  outlinedBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  scanPrimaryBtn: {
    minHeight: 46,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  scanPrimaryBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deliveredActionWrap: {
    marginTop: 11,
    flexDirection: 'row',
  },
  deliveredDetailsBtn: {
    minWidth: 148,
    minHeight: 42,
  },
});

