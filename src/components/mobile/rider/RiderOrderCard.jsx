import React, { useState } from 'react';
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
  onViewMap,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  const itemsList =
    Array.isArray(delivery?.items) && delivery.items.length > 0
      ? delivery.items
      : [
          {
            name:
              delivery?.itemsSummary ||
              delivery?.customerName ||
              'MotoTrack Delivery',
            quantity: Number(delivery?.itemCount) || 1,
            price: Number(delivery?.totalAmount) || 0,
          },
        ];

  const cardBg = palette.isDark ? '#1C1F23' : '#FFFFFF';
  const cardBorder = palette.isDark ? '#2B3035' : '#EDE9E0';
  const nestedBg = palette.isDark ? '#23272B' : '#FBF9F5';
  const nestedBorder = palette.isDark ? '#2B3035' : '#F3EFE6';
  const dividerColor = palette.isDark ? '#2E343B' : '#EFEBE0';
  const primaryBtnBg = palette.isDark ? '#EA580C' : '#141414';

  return (
    <View
      style={[
        styles.card,
        !palette.isDark && cardShadowStyle,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onViewDetails?.(delivery)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${formatOrderCode(delivery?.orderId)} for ${delivery?.customerName || 'Customer'}`}
      >
        {/* Top Header: Date & Order ID on left, Soft Status Pill + ••• Menu on right */}
        <View style={styles.metaTopRow}>
          <View style={styles.orderIdCol}>
            <Text style={[styles.dateSubText, { color: palette.textMuted }]}>
              {delivered
                ? formatCompletedTimeLabel(delivery)
                : formatActiveDeadlineLabel(delivery)}
            </Text>
            <Text
              style={[styles.orderCode, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {formatOrderCode(delivery?.orderId)}
            </Text>
          </View>

          <View style={styles.headerRightGroup}>
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

            <TouchableOpacity
              onPress={() => setMenuOpen((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityLabel="Order actions"
              style={styles.dotsMenuBtn}
            >
              <BootstrapIcon
                name="three-dots"
                size={14}
                color={palette.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Nested Sand-White Items & Recipient Box (Matching Customer Orders Card) */}
        <View
          style={[
            styles.nestedBox,
            {
              backgroundColor: nestedBg,
              borderColor: nestedBorder,
            },
          ]}
        >
          {itemsList.slice(0, 2).map((it, idx) => {
            const itemName =
              it?.name || it?.product_name || 'Motorcycle Part';
            const itemQty = Number(it?.quantity) || 1;
            const unitPrice = Number(it?.price || it?.cost || 0);
            const lineTotal =
              unitPrice > 0
                ? unitPrice * itemQty
                : itemsList.length === 1
                  ? Number(delivery?.totalAmount) || 0
                  : 0;

            return (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  idx > 0 && {
                    paddingTop: 10,
                    marginTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: dividerColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.itemIconBox,
                    {
                      backgroundColor: palette.isDark
                        ? 'rgba(234, 88, 12, 0.16)'
                        : '#FFF0E6',
                    },
                  ]}
                >
                  <BootstrapIcon name="box" size={18} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.itemName, { color: palette.textPrimary }]}
                    numberOfLines={1}
                  >
                    {itemName}
                  </Text>
                  <Text
                    style={[styles.itemSub, { color: palette.textMuted }]}
                    numberOfLines={1}
                  >
                    Qty: {itemQty} · {delivery?.customerName || 'Customer'}
                  </Text>
                </View>
                {lineTotal > 0 ? (
                  <Text
                    style={[styles.itemPrice, { color: palette.textPrimary }]}
                  >
                    {formatPhp(lineTotal)}
                  </Text>
                ) : null}
              </View>
            );
          })}

          {itemsList.length > 2 ? (
            <Text style={[styles.moreItemsText, { color: palette.textMuted }]}>
              +{itemsList.length - 2} more item{itemsList.length - 2 === 1 ? '' : 's'}
            </Text>
          ) : null}

          <View
            style={[
              styles.addressStrip,
              {
                borderTopColor: dividerColor,
              },
            ]}
          >
            <BootstrapIcon
              name="geo-alt"
              size={12}
              color={palette.textMuted}
            />
            <Text
              style={[styles.addressLineText, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {delivery?.customerAddress || 'No delivery address provided'}
            </Text>
          </View>

          {!delivered ? (
            <View style={styles.mapActionsRow}>
              <TouchableOpacity
                onPress={() => onViewMap?.(delivery)}
                activeOpacity={0.8}
                style={[
                  styles.inlineActionChip,
                  {
                    backgroundColor: palette.bgCard,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <BootstrapIcon name="map" size={12} color="#EA580C" />
                <Text style={[styles.inlineActionChipText, { color: palette.textPrimary }]}>
                  View map
                </Text>
              </TouchableOpacity>

              <ExternalLink href={navUrl}>
                <View
                  style={[
                    styles.inlineActionChip,
                    {
                      backgroundColor: palette.bgCard,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <BootstrapIcon name="cursor-fill" size={11} color="#EA580C" />
                  <Text style={[styles.inlineActionChipText, { color: palette.textPrimary }]}>
                    Navigate
                  </Text>
                </View>
              </ExternalLink>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Hairline Divider & Footer Row (Total on left, Charcoal Pill CTA on right) */}
      <View
        style={[
          styles.footerRow,
          {
            borderTopColor: nestedBorder,
          },
        ]}
      >
        <View>
          <Text style={[styles.totalLabel, { color: palette.textMuted }]}>
            {delivered
              ? 'Earned fee'
              : cod
                ? 'COD to collect'
                : 'Total amount (Paid)'}
          </Text>
          <Text style={[styles.totalAmount, { color: '#EA580C' }]}>
            {delivered
              ? `+${formatPhp(earningAmount)}`
              : formatPhpExact(delivery?.totalAmount)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryFooterBtn,
            { backgroundColor: primaryBtnBg },
          ]}
          onPress={() =>
            delivered ? onViewDetails?.(delivery) : onScanConfirm?.(delivery)
          }
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={
            delivered
              ? `View order ${formatOrderCode(delivery?.orderId)}`
              : `Scan and confirm order ${formatOrderCode(delivery?.orderId)}`
          }
        >
          <Text style={styles.primaryFooterBtnText}>
            {delivered ? 'View details' : 'Scan & confirm'}
          </Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Optional Secondary Actions Drawer (toggled via ••• button) */}
      {menuOpen ? (
        <View
          style={[
            styles.drawerRow,
            {
              borderTopColor: nestedBorder,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              setMenuOpen(false);
              onViewMap?.(delivery);
            }}
            activeOpacity={0.8}
            style={[
              styles.drawerChip,
              {
                backgroundColor: nestedBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <BootstrapIcon name="map" size={12} color="#EA580C" />
            <Text
              style={[styles.drawerChipText, { color: palette.textPrimary }]}
            >
              View map
            </Text>
          </TouchableOpacity>

          {!delivered ? (
            <ExternalLink href={navUrl}>
              <View
                style={[
                  styles.drawerChip,
                  {
                    backgroundColor: nestedBg,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <BootstrapIcon
                  name="geo-alt"
                  size={12}
                  color={palette.textPrimary}
                />
                <Text
                  style={[styles.drawerChipText, { color: palette.textPrimary }]}
                >
                  Navigate
                </Text>
              </View>
            </ExternalLink>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              setMenuOpen(false);
              onViewDetails?.(delivery);
            }}
            activeOpacity={0.8}
            style={[
              styles.drawerChip,
              {
                backgroundColor: nestedBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <BootstrapIcon
              name="receipt"
              size={12}
              color={palette.textPrimary}
            />
            <Text
              style={[styles.drawerChipText, { color: palette.textPrimary }]}
            >
              Order details
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderIdCol: {
    flex: 1,
    paddingRight: 8,
  },
  dateSubText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  orderCode: {
    fontFamily: RIDER_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusPillText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  dotsMenuBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nestedBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  itemSub: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  moreItemsText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 8,
  },
  addressStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
  },
  addressLineText: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  mapActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  inlineActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 9,
    borderWidth: 1,
  },
  inlineActionChipText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  totalAmount: {
    fontFamily: RIDER_FONT,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  primaryFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryFooterBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  drawerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  drawerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  drawerChipText: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
});

