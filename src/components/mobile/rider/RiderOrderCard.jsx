import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { googleMapsNavigateUrl } from '../../../utils/geo.js';
import {
  riderFont,
  cardShadowStyle,
  formatOrderCode,
  formatPhp,
  formatPhpExact,
  isDeliveredOrder,
  isCancelledOrder,
  isCodOrder,
  formatActiveDeadlineLabel,
  formatCompletedTimeLabel,
  getOrderStatusBadge,
} from './riderTheme.js';

export default function RiderOrderCard({
  delivery,
  palette,
  onViewDetails,
  onViewMap,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const delivered = isDeliveredOrder(delivery);
  const cancelled = isCancelledOrder(delivery);
  const isClosed = delivered || cancelled;
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
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.addressLineText, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {delivery?.customerAddress || 'No delivery address provided'}
              </Text>
              {delivery?.landmark ? (
                <Text
                  style={[styles.landmarkLineText, { color: '#EA580C' }]}
                  numberOfLines={1}
                >
                  Landmark: {delivery.landmark}
                </Text>
              ) : null}
            </View>
          </View>

          {!isClosed ? (
            <View style={styles.mapActionsRow}>
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
              : cancelled
                ? 'Order total'
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
            isClosed ? onViewDetails?.(delivery) : onViewMap?.(delivery)
          }
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={
            isClosed
              ? `View order ${formatOrderCode(delivery?.orderId)}`
              : `Track order ${formatOrderCode(delivery?.orderId)} to customer location`
          }
        >
          <Text style={styles.primaryFooterBtnText}>
            {isClosed ? 'View details' : 'Track order'}
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
          {!isClosed ? (
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
                Track order
              </Text>
            </TouchableOpacity>
          ) : null}

          {!isClosed ? (
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
    ...riderFont('500'),
    fontSize: 12,
    lineHeight: 15,
  },
  orderCode: {
    ...riderFont('700'),
    fontSize: 15.5,
    lineHeight: 21,
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
    ...riderFont('700'),
    fontSize: 11.5,
    lineHeight: 14,
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
    ...riderFont('600'),
    fontSize: 14,
    lineHeight: 19,
  },
  itemSub: {
    ...riderFont('400'),
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  itemPrice: {
    ...riderFont('700'),
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  moreItemsText: {
    ...riderFont('600'),
    fontSize: 12,
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
    ...riderFont('500'),
    fontSize: 12.5,
    lineHeight: 17,
  },
  landmarkLineText: {
    ...riderFont('600'),
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
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
    ...riderFont('600'),
    fontSize: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  totalLabel: {
    ...riderFont('500'),
    fontSize: 11.5,
    lineHeight: 15,
    marginBottom: 2,
  },
  totalAmount: {
    ...riderFont('700'),
    fontSize: 20,
    lineHeight: 24,
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
    ...riderFont('700'),
    fontSize: 13,
    lineHeight: 17,
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
    ...riderFont('600'),
    fontSize: 12,
  },
});

