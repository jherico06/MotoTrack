/**
 * Official service receipt for garage bookings.
 * Used by admin (after finalize) and customer (view completed service).
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

export default function ServiceReceiptModal({
  visible,
  onClose,
  booking,
  quotation,
  payments = [],
  isDarkMode = false,
  title = 'Official Service Receipt',
}) {
  const t = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(t, isDarkMode), [t, isDarkMode]);

  const bookingId = booking?.booking_id || booking?.id || '—';
  const isPms = isPmsFixedBooking(booking);
  const items = Array.isArray(quotation?.items) ? quotation.items : [];
  const parts = items.filter((i) => i.item_type === 'part');
  const others = items.filter((i) => i.item_type !== 'part');

  const laborCost = Number(
    quotation?.labor_cost ??
      booking?.actual_labor_cost ??
      booking?.quoted_service_rate ??
      booking?.estimated_labor_cost ??
      0
  );
  const partsTotal = Number(quotation?.parts_total ?? booking?.parts_total ?? 0);
  const otherTotal = Number(quotation?.other_charges_total ?? booking?.other_charges_total ?? 0);
  const additionalTotal = Number(quotation?.additional_charges_total ?? 0);
  const discount = Number(quotation?.discount_amount ?? booking?.discount_amount ?? 0);
  const finalTotal = Number(
    quotation?.total_amount ?? booking?.final_service_total ?? booking?.estimated_service_total ?? 0
  );
  const paid = Number(booking?.amount_paid || 0);
  const remaining = Number(
    quotation?.remaining_balance ?? booking?.remaining_balance ?? Math.max(0, finalTotal - paid)
  );
  const status = normalizeBookingStatus(booking?.status);

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
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.headerIconWrap}>
                <BootstrapIcon name="receipt-cutoff" size={17} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSub}>Ref #{bookingId}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? t.textMuted : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.receiptCard}>
              <Text style={styles.brand}>MOTOTRACK SERVICE HUB</Text>
              <Text style={styles.subhead}>Official Service Completion Receipt</Text>
              <View style={styles.verifiedBadge}>
                <BootstrapIcon name="shield-check" size={12} color="#166534" />
                <Text style={styles.verifiedText}>
                  {remaining <= 0 ? 'PAID / READY FOR PICKUP' : 'FINAL BILL GENERATED'}
                </Text>
              </View>

              <View style={styles.dash} />

              <Row label="Receipt Ref #" value={`SRV-${bookingId}`} styles={styles} />
              <Row
                label="Issued"
                value={fmtDateTime(booking?.service_completed_at || booking?.updated_at || Date.now())}
                styles={styles}
              />
              <Row label="Customer" value={booking?.customer_name || '—'} styles={styles} />
              <Row
                label="Motorcycle"
                value={[booking?.bike_brand, booking?.bike_model, booking?.bike_plate || booking?.plate_number]
                  .filter(Boolean)
                  .join(' · ') || '—'}
                styles={styles}
              />
              <Row
                label="Service"
                value={
                  booking?.service_title ||
                  booking?.package_name ||
                  booking?.cc_category_name ||
                  (isPms ? 'Fixed-rate service' : 'Repair service')
                }
                styles={styles}
              />
              <Row label="Status" value={status.replace(/_/g, ' ')} styles={styles} />

              <View style={styles.dash} />

              <Text style={styles.sectionLabel}>CHARGES</Text>
              <Row
                label={isPms ? 'Service rate (fixed)' : 'Labor'}
                value={formatPhp(laborCost)}
                styles={styles}
              />

              {parts.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>PARTS REPLACED</Text>
                  {parts.map((p, idx) => (
                    <Row
                      key={`p-${idx}`}
                      label={`${p.product_name || 'Part'} × ${p.quantity || 1}`}
                      value={formatPhp(p.line_total ?? Number(p.quantity || 1) * Number(p.unit_price || 0))}
                      styles={styles}
                    />
                  ))}
                </>
              ) : (
                <Row label="Parts" value={formatPhp(partsTotal)} styles={styles} />
              )}

              {others.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>OTHER CHARGES</Text>
                  {others.map((o, idx) => (
                    <Row
                      key={`o-${idx}`}
                      label={o.description || o.product_name || 'Other'}
                      value={formatPhp(o.line_total ?? o.unit_price ?? 0)}
                      styles={styles}
                    />
                  ))}
                </>
              ) : otherTotal > 0 ? (
                <Row label="Other charges" value={formatPhp(otherTotal)} styles={styles} />
              ) : null}

              {additionalTotal > 0 ? (
                <Row label="Approved additional work" value={formatPhp(additionalTotal)} styles={styles} />
              ) : null}
              {discount > 0 ? (
                <Row label="Discount" value={`−${formatPhp(discount)}`} styles={styles} danger />
              ) : null}

              <View style={styles.dash} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>FINAL TOTAL</Text>
                <Text style={styles.totalValue}>{formatPhp(finalTotal)}</Text>
              </View>
              <Row label="Amount paid" value={formatPhpDecimals(paid)} styles={styles} />
              <Row
                label="Remaining balance"
                value={formatPhp(remaining)}
                styles={styles}
                bold
              />

              {payments?.length > 0 ? (
                <>
                  <View style={styles.dash} />
                  <Text style={styles.sectionLabel}>PAYMENTS</Text>
                  {payments.map((p) => (
                    <Row
                      key={p.payment_id || `${p.payment_type}-${p.created_at}`}
                      label={`${p.payment_type || 'Payment'} · ${p.payment_method || 'Cash'}`}
                      value={formatPhpDecimals(p.amount)}
                      styles={styles}
                    />
                  ))}
                </>
              ) : null}

              <Text style={styles.notice}>
                {remaining > 0
                  ? 'Please settle the remaining balance at the shop. Present this receipt when paying.'
                  : 'Thank you. Present this receipt (or pickup QR) when claiming your motorcycle.'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {Platform.OS === 'web' ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={handlePrint}>
                <BootstrapIcon name="printer" size={14} color={isDarkMode ? t.textPrimary : '#EA580C'} />
                <Text style={styles.secondaryBtnText}>Print</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, styles, bold, danger }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, danger && styles.danger]}>{value}</Text>
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
      alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
      padding: Platform.OS === 'web' ? 16 : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 520 : '100%',
      maxHeight: '92%',
      backgroundColor: isDark ? t.bgCard : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: Platform.OS === 'web' ? 16 : 0,
      borderBottomRightRadius: Platform.OS === 'web' ? 16 : 0,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.borderInput : '#E2E8F0',
    },
    headerIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#FFF7ED',
      borderWidth: 1,
      borderColor: '#FED7AA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? t.bgInput : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '600', color: isDark ? t.textPrimary : '#0F172A' },
    headerSub: { fontSize: 12, color: isDark ? t.textMuted : '#64748B', marginTop: 2 },
    body: { paddingHorizontal: 16, paddingTop: 14 },
    receiptCard: {
      backgroundColor: isDark ? t.bgSub : '#F8FAFC',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      padding: 16,
    },
    brand: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: isDark ? t.accentBrand : '#EA580C',
      textAlign: 'center',
    },
    subhead: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? t.textPrimary : '#0F172A',
      textAlign: 'center',
      marginTop: 4,
    },
    verifiedBadge: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#DCFCE7',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    verifiedText: { fontSize: 10.5, fontWeight: '600', color: isDark ? '#86EFAC' : '#166534' },
    dash: {
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      marginVertical: 12,
    },
    sectionLabel: {
      fontSize: 10.5,
      fontWeight: '600',
      color: isDark ? t.textMuted : '#64748B',
      letterSpacing: 0.6,
      marginTop: 6,
      marginBottom: 4,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
    rowLabel: { flex: 1, fontSize: 12.5, color: isDark ? t.textSecondary : '#475569' },
    rowValue: { fontSize: 12.5, fontWeight: '700', color: isDark ? t.textPrimary : '#0F172A' },
    bold: { fontWeight: '600', color: isDark ? t.textPrimary : '#0F172A' },
    danger: { color: isDark ? t.statusDangerText : '#DC2626' },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    totalLabel: { fontSize: 13, fontWeight: '600', color: isDark ? t.accentBrand : '#EA580C' },
    totalValue: { fontSize: 20, fontWeight: '700', color: isDark ? t.accentBrand : '#EA580C' },
    notice: {
      marginTop: 12,
      fontSize: 11.5,
      lineHeight: 17,
      color: isDark ? t.textMuted : '#64748B',
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'ios' ? 30 : 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? t.borderInput : '#E2E8F0',
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: isDark ? t.borderInput : '#CBD5E1',
      borderRadius: 14,
      paddingVertical: 12,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: '700', color: isDark ? t.textPrimary : '#EA580C' },
    primaryBtn: {
      flex: 1,
      backgroundColor: isDark ? '#EA580C' : '#EA580C',
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  });
}
