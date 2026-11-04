import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../../common/BootstrapIcon.jsx';
import ExternalLink from '../../common/ExternalLink.jsx';
import { googleMapsNavigateUrl } from '../../../utils/geo.js';
import {
  RIDER_FONT,
  formatOrderCode,
  formatPhp,
  formatPhpExact,
  isDeliveredOrder,
  isCodOrder,
  getInitials,
  formatActiveDeadlineLabel,
  formatCompletedTimeLabel,
  getOrderStatusBadge,
} from './riderTheme.js';

export default function RiderOrderDetailsSheet({
  visible,
  delivery,
  palette,
  busyId,
  podPhoto,
  podBusy,
  onClose,
  onStartRoute,
  onScanConfirm,
  onPickPodPhoto,
  onSavePodPhoto,
  onClearPodPhoto,
}) {
  if (!delivery) return null;

  const delivered = isDeliveredOrder(delivery);
  const badge = getOrderStatusBadge(delivery, palette);
  const cod = isCodOrder(delivery);
  const statusStr = String(delivery?.deliveryStatus || '').toLowerCase();
  const isAssigned =
    statusStr.includes('assigned') || statusStr.includes('ready');
  const isReported = statusStr.includes('report');
  const cleanPhone = String(delivery?.customerPhone || '').replace(
    /[^\d+]/g,
    ''
  );
  const navUrl = googleMapsNavigateUrl(
    delivery?.lat,
    delivery?.lng,
    delivery?.customerAddress
  );
  const earningAmount =
    Number(delivery?.riderEarning || delivery?.shippingFee) || 0;
  const codAmount = cod ? Number(delivery?.totalAmount) || 0 : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: palette.scrim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgSheet,
              borderColor: palette.border,
            },
          ]}
        >
          {/* Top Drag Handle */}
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: palette.borderStrong },
            ]}
          />

          {/* Sticky Sheet Header */}
          <View
            style={[
              styles.sheetHeader,
              { borderBottomColor: palette.border },
            ]}
          >
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerBadgeIcon,
                  {
                    backgroundColor: delivered
                      ? palette.completedIconBg
                      : palette.orangeSoft,
                    borderColor: delivered
                      ? palette.border
                      : palette.orangeBorder,
                  },
                ]}
              >
                <BootstrapIcon
                  name={delivered ? 'check' : 'box-seam'}
                  size={17}
                  color={
                    delivered ? palette.completedIconColor : palette.orange
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.orderOverline, { color: palette.textMuted }]}
                >
                  ORDER DETAILS
                </Text>
                <Text
                  style={[styles.orderNumberTitle, { color: palette.textPrimary }]}
                  numberOfLines={1}
                >
                  {formatOrderCode(delivery.orderId)}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: badge.bg },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                  {badge.detailLabel || badge.label}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.closeCircle,
                  { backgroundColor: palette.bgMuted },
                ]}
                onPress={onClose}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Close order details"
              >
                <BootstrapIcon
                  name="x-lg"
                  size={14}
                  color={palette.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Customer Profile & Phone Action */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: palette.bgCard,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
                Customer profile
              </Text>
              <View style={styles.customerProfileRow}>
                <View
                  style={[
                    styles.customerAvatar,
                    {
                      backgroundColor: palette.bgAvatar,
                      borderColor: palette.orangeBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.customerInitials,
                      { color: palette.avatarText },
                    ]}
                  >
                    {getInitials(delivery.customerName)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.customerFullName,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {delivery.customerName || 'MotoTrack Customer'}
                  </Text>
                  <Text
                    style={[styles.customerPhone, { color: palette.textMuted }]}
                  >
                    {delivery.customerPhone || 'No contact number on file'}
                  </Text>
                </View>

                {cleanPhone ? (
                  <ExternalLink href={`tel:${cleanPhone}`}>
                    <View
                      style={[
                        styles.callActionBtn,
                        {
                          backgroundColor: palette.orangeSoft,
                          borderColor: palette.orangeBorder,
                        },
                      ]}
                    >
                      <BootstrapIcon
                        name="telephone"
                        size={15}
                        color={palette.orange}
                      />
                      <Text
                        style={[
                          styles.callActionText,
                          { color: palette.orangeText },
                        ]}
                      >
                        Call
                      </Text>
                    </View>
                  </ExternalLink>
                ) : (
                  <View
                    style={[
                      styles.callActionBtn,
                      {
                        backgroundColor: palette.bgMuted,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name="telephone"
                      size={15}
                      color={palette.textSubtle}
                    />
                    <Text
                      style={[
                        styles.callActionText,
                        { color: palette.textSubtle },
                      ]}
                    >
                      No phone
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 2. Complete Delivery Address & Schedule */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: palette.bgCard,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.sectionHeadBetween}>
                <Text
                  style={[styles.sectionLabel, { color: palette.textMuted }]}
                >
                  Complete delivery address
                </Text>
                <ExternalLink href={navUrl}>
                  <View style={styles.inlineNavLink}>
                    <BootstrapIcon
                      name="geo-alt"
                      size={13}
                      color={palette.orange}
                    />
                    <Text
                      style={[
                        styles.inlineNavText,
                        { color: palette.orange },
                      ]}
                    >
                      Open map
                    </Text>
                  </View>
                </ExternalLink>
              </View>

              <View style={styles.addressBlock}>
                <View
                  style={[
                    styles.pinBox,
                    { backgroundColor: palette.bgMuted },
                  ]}
                >
                  <BootstrapIcon
                    name="geo-alt"
                    size={16}
                    color={palette.textPrimary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.fullAddressText,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {delivery.customerAddress || 'No address provided'}
                  </Text>
                  {delivery.landmark ? (
                    <Text
                      style={[
                        styles.landmarkText,
                        { color: palette.textSecondary },
                      ]}
                    >
                      Note: {delivery.landmark}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View
                style={[
                  styles.scheduleStrip,
                  { backgroundColor: palette.bgMuted },
                ]}
              >
                <BootstrapIcon
                  name={delivered ? 'check-circle' : 'clock'}
                  size={14}
                  color={delivered ? palette.success : palette.orange}
                />
                <Text
                  style={[
                    styles.scheduleStripText,
                    { color: palette.textSecondary },
                  ]}
                >
                  {delivered
                    ? formatCompletedTimeLabel(delivery)
                    : `Target drop-off: ${formatActiveDeadlineLabel(delivery)}`}
                </Text>
              </View>
            </View>

            {/* 3. COD Amount, Rider Earnings & Items */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: palette.bgCard,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
                Payment & COD summary
              </Text>

              <View
                style={[
                  styles.codHeroBox,
                  {
                    backgroundColor: cod
                      ? palette.orangeSoft
                      : palette.bgMuted,
                    borderColor: cod
                      ? palette.orangeBorder
                      : palette.border,
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.codHeroCaption,
                      {
                        color: cod
                          ? palette.orangeText
                          : palette.textMuted,
                      },
                    ]}
                  >
                    {cod ? 'COD amount to collect' : 'Online payment settled'}
                  </Text>
                  <Text
                    style={[
                      styles.codHeroValue,
                      { color: palette.textPrimary },
                    ]}
                  >
                    {cod ? formatPhpExact(codAmount) : '₱0.00 COD'}
                  </Text>
                </View>

                <View style={styles.codHeroRight}>
                  <Text
                    style={[styles.earningLabel, { color: palette.textMuted }]}
                  >
                    Rider fee
                  </Text>
                  <Text
                    style={[styles.earningValue, { color: palette.orange }]}
                  >
                    +{formatPhp(earningAmount)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaLineRow}>
                <Text style={[styles.metaKey, { color: palette.textMuted }]}>
                  Order total
                </Text>
                <Text
                  style={[styles.metaVal, { color: palette.textPrimary }]}
                >
                  {formatPhpExact(delivery.totalAmount)}
                </Text>
              </View>
              <View style={styles.metaLineRow}>
                <Text style={[styles.metaKey, { color: palette.textMuted }]}>
                  Payment method
                </Text>
                <Text
                  style={[styles.metaVal, { color: palette.textPrimary }]}
                >
                  {delivery.paymentMethod || (cod ? 'Cash on Delivery' : 'Paid')}
                </Text>
              </View>

              {/* Package Items */}
              <View
                style={[
                  styles.itemsDivider,
                  { backgroundColor: palette.border },
                ]}
              />
              <Text
                style={[
                  styles.sectionLabel,
                  { color: palette.textMuted, marginBottom: 6 },
                ]}
              >
                Package items
              </Text>
              {(delivery.items || []).length > 0 ? (
                delivery.items.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: palette.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {it.name || it.product_name || 'Motorcycle Part'}
                    </Text>
                    <Text
                      style={[styles.itemQty, { color: palette.textPrimary }]}
                    >
                      ×{it.quantity || 1}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={[styles.itemName, { color: palette.textSecondary }]}
                >
                  {delivery.itemsSummary || 'Standard MotoTrack parcel'}
                </Text>
              )}
            </View>

            {/* 4. Optional Route Start (for Assigned orders) */}
            {!delivered && isAssigned ? (
              <TouchableOpacity
                style={[
                  styles.startRouteBtn,
                  {
                    backgroundColor: palette.charcoal,
                    opacity: busyId === delivery.orderId ? 0.7 : 1,
                  },
                ]}
                disabled={busyId === delivery.orderId}
                onPress={() => onStartRoute?.(delivery)}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="motorcycle" size={16} color="#FFFFFF" />
                <Text style={styles.startRouteText}>
                  {busyId === delivery.orderId
                    ? 'Starting live GPS route...'
                    : 'Start route · Out for delivery'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* 5. Proof of Delivery Photo */}
            {!delivered ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: palette.bgCard,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: palette.textMuted }]}
                >
                  Proof of delivery photo (optional)
                </Text>

                {delivery.deliveryPhoto && !podPhoto ? (
                  <View style={styles.podPreviewWrap}>
                    <Image
                      source={{ uri: delivery.deliveryPhoto }}
                      style={styles.podImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.podReplaceLink}
                      onPress={onPickPodPhoto}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name="camera"
                        size={13}
                        color={palette.orange}
                      />
                      <Text
                        style={[
                          styles.podReplaceText,
                          { color: palette.orange },
                        ]}
                      >
                        Replace proof photo
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {podPhoto ? (
                  <View style={styles.podPreviewWrap}>
                    <Image
                      source={{ uri: podPhoto }}
                      style={styles.podImage}
                      resizeMode="cover"
                    />
                    <View style={styles.podStagedActions}>
                      <TouchableOpacity
                        style={[
                          styles.podSaveBtn,
                          {
                            backgroundColor: palette.charcoal,
                            opacity: podBusy ? 0.65 : 1,
                          },
                        ]}
                        disabled={podBusy}
                        onPress={onSavePodPhoto}
                        activeOpacity={0.85}
                      >
                        {podBusy ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <BootstrapIcon
                              name="upload"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.podSaveBtnText}>
                              Save photo
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.podCancelBtn,
                          { borderColor: palette.borderStrong },
                        ]}
                        onPress={onClearPodPhoto}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.podCancelText,
                            { color: palette.textSecondary },
                          ]}
                        >
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {!podPhoto && !delivery.deliveryPhoto ? (
                  <TouchableOpacity
                    style={[
                      styles.podUploadBox,
                      {
                        borderColor: palette.borderStrong,
                        backgroundColor: palette.bgMuted,
                      },
                    ]}
                    onPress={onPickPodPhoto}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon
                      name="camera"
                      size={16}
                      color={palette.textPrimary}
                    />
                    <Text
                      style={[
                        styles.podUploadText,
                        { color: palette.textPrimary },
                      ]}
                    >
                      Attach drop-off photo
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : delivery.deliveryPhoto ? (
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: palette.bgCard,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: palette.textMuted }]}
                >
                  Proof of delivery
                </Text>
                <Image
                  source={{ uri: delivery.deliveryPhoto }}
                  style={[styles.podImage, { marginTop: 8 }]}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky Bottom Sheet Primary CTA */}
          <View
            style={[
              styles.sheetFooter,
              {
                backgroundColor: palette.bgSheet,
                borderTopColor: palette.border,
              },
            ]}
          >
            {delivered ? (
              <View
                style={[
                  styles.completedFooterBanner,
                  {
                    backgroundColor: palette.completedBadgeBg,
                  },
                ]}
              >
                <BootstrapIcon
                  name="check-circle-fill"
                  size={17}
                  color={palette.textPrimary}
                />
                <Text
                  style={[
                    styles.completedFooterText,
                    { color: palette.textPrimary },
                  ]}
                >
                  Delivery confirmed · {formatPhp(earningAmount)} credited
                </Text>
              </View>
            ) : isReported ? (
              <View
                style={[
                  styles.completedFooterBanner,
                  { backgroundColor: palette.orangeSoft },
                ]}
              >
                <BootstrapIcon
                  name="clock"
                  size={16}
                  color={palette.orangeText}
                />
                <Text
                  style={[
                    styles.completedFooterText,
                    { color: palette.orangeText },
                  ]}
                >
                  Reported — awaiting MotoTrack store confirmation
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.largeScanCta,
                  { backgroundColor: palette.orange },
                ]}
                onPress={() => onScanConfirm?.(delivery)}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel="Scan and confirm delivery"
              >
                <BootstrapIcon name="qr-code-scan" size={18} color="#FFFFFF" />
                <Text style={styles.largeScanCtaText}>
                  Scan & confirm delivery
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '91%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  headerBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderOverline: {
    fontFamily: RIDER_FONT,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  orderNumberTitle: {
    fontFamily: RIDER_FONT,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '600',
  },
  closeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    paddingHorizontal: 16,
  },
  bodyContent: {
    paddingVertical: 14,
    gap: 12,
  },
  sectionCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
  },
  sectionHeadBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    fontFamily: RIDER_FONT,
    fontSize: 15,
    fontWeight: '600',
  },
  customerFullName: {
    fontFamily: RIDER_FONT,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '600',
  },
  customerPhone: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  callActionBtn: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callActionText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
  },
  inlineNavLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  inlineNavText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  pinBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullAddressText: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  landmarkText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    marginTop: 4,
  },
  scheduleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 11,
  },
  scheduleStripText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  codHeroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    marginTop: 10,
    marginBottom: 10,
  },
  codHeroCaption: {
    fontFamily: RIDER_FONT,
    fontSize: 11.5,
    fontWeight: '600',
  },
  codHeroValue: {
    fontFamily: RIDER_FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  codHeroRight: {
    alignItems: 'flex-end',
  },
  earningLabel: {
    fontFamily: RIDER_FONT,
    fontSize: 11,
    fontWeight: '500',
  },
  earningValue: {
    fontFamily: RIDER_FONT,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  metaLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metaKey: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '400',
  },
  metaVal: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  itemsDivider: {
    height: 1,
    marginVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '400',
  },
  itemQty: {
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  startRouteBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  startRouteText: {
    fontFamily: RIDER_FONT,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  podPreviewWrap: {
    marginTop: 10,
    gap: 8,
  },
  podImage: {
    width: '100%',
    height: 168,
    borderRadius: 12,
  },
  podReplaceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    paddingVertical: 4,
  },
  podReplaceText: {
    fontFamily: RIDER_FONT,
    fontSize: 12,
    fontWeight: '600',
  },
  podStagedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  podSaveBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  podSaveBtnText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  podCancelBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podCancelText: {
    fontFamily: RIDER_FONT,
    fontSize: 12.5,
    fontWeight: '600',
  },
  podUploadBox: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  podUploadText: {
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '600',
  },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
  },
  largeScanCta: {
    minHeight: 52,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  largeScanCtaText: {
    fontFamily: RIDER_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  completedFooterBanner: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  completedFooterText: {
    fontFamily: RIDER_FONT,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

