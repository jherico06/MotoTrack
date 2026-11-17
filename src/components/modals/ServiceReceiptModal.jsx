/**
 * Official service receipt for garage bookings.
 * Used by admin (after finalize) and customer (view completed service / deposit slip).
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { formatPhp, formatPhpDecimals, normalizeBookingStatus } from '../../utils/serviceQuotation.js';
import { getThemeTokens } from '../../styles/theme.js';
import { isPmsFixedBooking } from '../../utils/pmsCcPricing.js';

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildBarcodeWidths(seedText) {
  const str = String(seedText || 'MOTOTRACK');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars = [3, 1.5, 2, 1.5];
  const widths = [1.5, 2.5, 3.5, 1.5, 4, 2];
  for (let i = 0; i < 28; i += 1) {
    hash = (Math.imul(hash ^ (i * 31), 1664525) + 1013904223) >>> 0;
    bars.push(widths[hash % widths.length]);
  }
  bars.push(2, 1.5, 3, 1.5);
  return bars;
}

export default function ServiceReceiptModal({
  visible,
  onClose,
  booking,
  quotation,
  payments = [],
  isDarkMode = false,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const t = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(t, isDarkMode), [t, isDarkMode]);

  const bookingId = booking?.booking_id || booking?.id || '—';
  const receiptRef = `SRV-${bookingId}`;
  const isPms = isPmsFixedBooking(booking);
  const items = Array.isArray(quotation?.items) ? quotation.items : [];
  const parts = items.filter((i) => i.item_type === 'part');
  const others = items.filter((i) => i.item_type !== 'part');

  const laborCost = Number(
    quotation?.labor_cost ??
      booking?.actual_labor_cost ??
      booking?.quoted_service_rate ??
      booking?.estimated_labor_cost ??
      (isPms ? (booking?.pricePhp ?? booking?.package_price) : 0) ??
      0
  );
  const partsTotal = Number(quotation?.parts_total ?? booking?.parts_total ?? 0);
  const otherTotal = Number(quotation?.other_charges_total ?? booking?.other_charges_total ?? 0);
  const additionalTotal = Number(quotation?.additional_charges_total ?? 0);
  const discount = Number(quotation?.discount_amount ?? booking?.discount_amount ?? 0);
  const finalTotal = Number(
    quotation?.total_amount ??
      booking?.final_service_total ??
      booking?.estimated_service_total ??
      booking?.pricePhp ??
      booking?.package_price ??
      (laborCost + partsTotal + otherTotal + additionalTotal - discount)
  );
  const paid = Number(
    booking?.amount_paid ??
      (booking?.downpayment_paid || booking?.downpayment_status === 'Paid'
        ? booking?.downpayment_amount
        : 0) ??
      0
  );
  const remaining = Math.max(
    0,
    Number(
      quotation?.remaining_balance ??
        booking?.remaining_balance ??
        Math.max(0, finalTotal - paid)
    )
  );
  const status = normalizeBookingStatus(booking?.status);
  const statusText = (status || 'ACTIVE').replace(/_/g, ' ');
  const shopName =
    booking?.service_location ||
    booking?.shop_name ||
    booking?.branch_name ||
    "D'Blockchain Motorparts and Accessories";
  const barcodeBars = useMemo(() => buildBarcodeWidths(receiptRef), [receiptRef]);

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print?.();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isDesktop ? styles.overlayDesktop : styles.overlayMobile]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, isDesktop ? styles.sheetDesktop : styles.sheetMobile]}>
          <TouchableOpacity onPress={onClose} style={styles.floatingCloseBtn} activeOpacity={0.75}>
            <BootstrapIcon name="x-lg" size={13} color={isDarkMode ? t.textMuted : '#64748B'} />
          </TouchableOpacity>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.receiptCard}>
              <Text style={styles.brand}>MOTOTRACK SERVICE HUB</Text>
              <Text style={styles.subhead}>
                Official Service{'\n'}Completion Receipt
              </Text>

              <View style={styles.verifiedBadge}>
                <BootstrapIcon name="check-circle-fill" size={12} color={isDarkMode ? '#86EFAC' : '#166534'} />
                <Text style={styles.verifiedText}>
                  {remaining <= 0 ? 'PAID / READY FOR PICKUP' : 'FINAL BILL GENERATED'}
                </Text>
              </View>

              <View style={styles.metaTable}>
                <MetaRow label="Receipt Ref #" value={receiptRef} styles={styles} />
                <MetaRow
                  label="Issued"
                  value={fmtDateTime(booking?.service_completed_at || booking?.updated_at || Date.now())}
                  styles={styles}
                />
                <MetaRow label="Customer" value={booking?.customer_name || '—'} styles={styles} />
                <MetaRow
                  label="Motorcycle"
                  value={[booking?.bike_brand, booking?.bike_model, booking?.bike_plate || booking?.plate_number]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                  styles={styles}
                />
                <MetaRow
                  label="Service"
                  value={
                    booking?.service_title ||
                    booking?.package_name ||
                    booking?.cc_category_name ||
                    (isPms ? 'Fixed-rate service' : 'Repair service')
                  }
                  styles={styles}
                />
                <View style={[styles.metaRow, { borderBottomWidth: 0, paddingBottom: 2 }]}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusPillText}>{statusText}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.dash} />

              <Text style={styles.sectionLabel}>CHARGES</Text>
              <LeaderRow
                label={isPms ? 'Service rate (fixed)' : 'Labor'}
                value={formatPhp(laborCost)}
                styles={styles}
              />

              {parts.length > 0 ? (
                parts.map((p, idx) => (
                  <LeaderRow
                    key={`p-${idx}`}
                    label={`${p.product_name || 'Part'} × ${p.quantity || 1}`}
                    value={formatPhp(p.line_total ?? Number(p.quantity || 1) * Number(p.unit_price || 0))}
                    styles={styles}
                  />
                ))
              ) : (
                <LeaderRow label="Parts" value={formatPhp(partsTotal)} styles={styles} />
              )}

              {others.length > 0 ? (
                others.map((o, idx) => (
                  <LeaderRow
                    key={`o-${idx}`}
                    label={o.description || o.product_name || 'Other charge'}
                    value={formatPhp(o.line_total ?? o.unit_price ?? 0)}
                    styles={styles}
                  />
                ))
              ) : otherTotal > 0 ? (
                <LeaderRow label="Other charges" value={formatPhp(otherTotal)} styles={styles} />
              ) : null}

              {additionalTotal > 0 ? (
                <LeaderRow label="Additional work" value={formatPhp(additionalTotal)} styles={styles} />
              ) : null}
              {discount > 0 ? (
                <LeaderRow label="Discount" value={`−${formatPhp(discount)}`} styles={styles} danger />
              ) : null}

              <View style={styles.totalHighlightBox}>
                <Text style={styles.totalLabel}>FINAL TOTAL</Text>
                <Text style={styles.totalValue}>{formatPhp(finalTotal)}</Text>
              </View>

              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabelMuted}>Amount paid</Text>
                <Text style={styles.balanceValue}>{formatPhpDecimals(paid)}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabelBold}>Remaining balance</Text>
                <Text style={[styles.balanceValueBold, remaining <= 0 && styles.paidText]}>
                  {formatPhp(remaining)}
                </Text>
              </View>

              {payments?.length > 0 ? (
                <>
                  <View style={styles.dash} />
                  <Text style={styles.sectionLabel}>PAYMENTS</Text>
                  {payments.map((p) => (
                    <LeaderRow
                      key={p.payment_id || `${p.payment_type}-${p.created_at}`}
                      label={`${p.payment_type || 'Payment'} · ${p.payment_method || 'GCash'}`}
                      value={formatPhpDecimals(p.amount)}
                      styles={styles}
                    />
                  ))}
                </>
              ) : null}

              <Text style={styles.notice}>
                {remaining > 0
                  ? 'Please settle the remaining balance at the shop. Present this receipt when paying.'
                  : 'Thank you. Present your Booking ID or receipt when claiming your motorcycle at the shop counter.'}
              </Text>

              <View style={styles.dash} />

              <View style={styles.barcodeWrap}>
                <View style={styles.barcodeBars}>
                  {barcodeBars.map((w, idx) => (
                    <View
                      key={`bar-${idx}`}
                      style={[
                        styles.barcodeBar,
                        {
                          width: w,
                          marginRight: idx % 2 === 0 ? 2 : 3,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.barcodeText}>{receiptRef}</Text>
                <Text style={styles.shopFooter}>
                  Thank you for trusting MotoTrack • {shopName}.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {Platform.OS === 'web' ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={handlePrint} activeOpacity={0.8}>
                <BootstrapIcon name="printer" size={14} color={isDarkMode ? t.textPrimary : '#EA580C'} />
                <Text style={styles.secondaryBtnText}>Print</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MetaRow({ label, value, styles }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function LeaderRow({ label, value, styles, danger }) {
  return (
    <View style={styles.leaderRow}>
      <Text style={styles.leaderLabel}>{label}</Text>
      <View style={styles.leaderDots} />
      <Text style={[styles.leaderValue, danger && styles.danger]}>{value}</Text>
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.58)',
      ...Platform.select({
        web: { backdropFilter: 'blur(4px)' },
      }),
    },
    overlayDesktop: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    overlayMobile: {
      justifyContent: 'flex-end',
      alignItems: 'stretch',
      padding: 0,
    },
    sheet: {
      width: '100%',
      maxHeight: '94%',
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 22,
    },
    sheetDesktop: {
      maxWidth: 430,
      borderRadius: 20,
      maxHeight: '92%',
    },
    sheetMobile: {
      maxWidth: '100%',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    floatingCloseBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: isDark ? t.bgInput : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 20,
    },
    receiptCard: {
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
    },
    brand: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: isDark ? t.accentBrand : '#EA580C',
      textAlign: 'center',
    },
    subhead: {
      fontSize: 21,
      fontWeight: '700',
      lineHeight: 26,
      letterSpacing: -0.3,
      color: isDark ? t.textPrimary : '#0F172A',
      textAlign: 'center',
      marginTop: 6,
    },
    verifiedBadge: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(34,197,94,0.16)' : '#ECFDF5',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
    },
    verifiedText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: isDark ? '#86EFAC' : '#166534',
    },
    metaTable: {
      marginTop: 20,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.border : '#F1F5F9',
    },
    metaLabel: {
      fontSize: 12.5,
      fontWeight: '400',
      color: isDark ? t.textMuted : '#64748B',
    },
    metaValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: 12.5,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.16)' : '#FFF3EB',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusDot: {
      width: 5.5,
      height: 5.5,
      borderRadius: 3,
      backgroundColor: '#EA580C',
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: isDark ? '#FDBA74' : '#0F172A',
    },
    dash: {
      borderStyle: 'dashed',
      borderBottomWidth: 1.5,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      marginVertical: 18,
    },
    sectionLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
      letterSpacing: 0.9,
      marginBottom: 10,
    },
    leaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    leaderLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? t.textSecondary : '#334155',
    },
    leaderDots: {
      flex: 1,
      borderStyle: 'dotted',
      borderBottomWidth: 1.5,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      marginHorizontal: 8,
      marginTop: 5,
    },
    leaderValue: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    danger: {
      color: isDark ? t.statusDangerText : '#DC2626',
    },
    totalHighlightBox: {
      marginTop: 8,
      marginBottom: 14,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF3EB',
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: isDark ? t.textPrimary : '#0F172A',
    },
    totalValue: {
      fontSize: 22,
      fontWeight: '700',
      color: isDark ? t.accentBrand : '#EA580C',
      fontVariant: ['tabular-nums'],
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    balanceLabelMuted: {
      fontSize: 12.5,
      fontWeight: '400',
      color: isDark ? t.textMuted : '#64748B',
    },
    balanceValue: {
      fontSize: 12.5,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    balanceLabelBold: {
      fontSize: 12.5,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
    },
    balanceValueBold: {
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#F04444' : '#DC2626',
      fontVariant: ['tabular-nums'],
    },
    paidText: {
      color: isDark ? '#00C98D' : '#047857',
    },
    notice: {
      marginTop: 14,
      fontSize: 11,
      lineHeight: 16,
      fontStyle: 'italic',
      color: isDark ? t.textMuted : '#64748B',
      textAlign: 'center',
      paddingHorizontal: 10,
    },
    barcodeWrap: {
      alignItems: 'center',
      paddingTop: 2,
    },
    barcodeBars: {
      flexDirection: 'row',
      alignItems: 'stretch',
      height: 36,
      marginBottom: 8,
    },
    barcodeBar: {
      height: '100%',
      backgroundColor: isDark ? '#F2F2F3' : '#0F172A',
    },
    barcodeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: isDark ? t.textPrimary : '#0F172A',
      fontVariant: ['tabular-nums'],
    },
    shopFooter: {
      marginTop: 10,
      fontSize: 10.5,
      lineHeight: 15,
      color: isDark ? t.textMuted : '#94A3B8',
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.borderInput : '#F1F5F9',
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      borderRadius: 10,
      paddingVertical: 10,
      cursor: 'pointer',
    },
    secondaryBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? t.textPrimary : '#1E293B',
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: '#EA580C',
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 13,
    },
  });
}
