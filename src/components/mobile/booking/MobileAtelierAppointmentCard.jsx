import React, { useMemo, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import ServiceReceiptModal from '../../modals/ServiceReceiptModal.jsx';
import { normalizeBookingStatus } from '../../../utils/serviceQuotation.js';

function fmtShortDateNoYear(val) {
  if (!val) return 'Scheduled';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtFullDate(val) {
  if (!val) return 'Recent';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortTime(val) {
  if (!val) return '09:00 AM';
  const str = String(val).trim();
  const match = str.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
  return match ? match[1].toUpperCase() : str;
}

function formatPriceNumber(val) {
  const num = Number(val) || 0;
  return `₱${num.toLocaleString('en-US')}`;
}

function getInitials(fullName) {
  const cleaned = String(fullName || '').trim();
  if (!cleaned) return 'MT';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function extractShortBay(booking) {
  const raw = String(booking?.bay_name || booking?.service_bay || '').trim();
  if (!raw) return 'Assigned Bay';
  const m = raw.match(/bay\s*#?\s*0?(\d+)/i);
  if (m) return `Bay ${String(m[1]).padStart(2, '0')}`;
  return raw.length > 22 ? `${raw.slice(0, 20)}…` : raw;
}

function resolveStatusConfig(normStatus, isDarkMode) {
  switch (normStatus) {
    case 'CONFIRMED':
    case 'SERVICE_IN_PROGRESS':
    case 'ADDITIONAL_APPROVAL_REQUIRED':
    case 'SERVICE_COMPLETED':
    case 'AWAITING_FINAL_PAYMENT':
      return {
        label: 'In service',
        bg: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E8F7EE',
        text: isDarkMode ? '#34D399' : '#0F8A5F',
        dot: '#10B981',
      };
    case 'READY_FOR_PICKUP':
      return {
        label: 'Ready for pickup',
        bg: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E8F7EE',
        text: isDarkMode ? '#6EE7B7' : '#047857',
        dot: '#10B981',
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        bg: isDarkMode ? '#202124' : '#F3F1EC',
        text: isDarkMode ? '#CBD5E1' : '#475569',
        dot: '#64748B',
      };
    case 'CANCELLED':
    case 'CUSTOMER_DECLINED':
    case 'REJECTED':
      return {
        label: 'Cancelled',
        bg: isDarkMode ? 'rgba(244, 63, 94, 0.16)' : '#FFF1F2',
        text: isDarkMode ? '#FDA4AF' : '#BE123C',
        dot: '#F43F5E',
      };
    default:
      return {
        label: 'Pending review',
        bg: isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
        text: isDarkMode ? '#FCD34D' : '#D97706',
        dot: '#F59E0B',
      };
  }
}

export default function MobileAtelierAppointmentCard({
  booking,
  brandSettings,
  isDarkMode = false,
  isSelected = false,
  canCancel = false,
  onSelect,
  onViewDetails,
  onReschedule,
  onCancel,
  onToast,
}) {
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const bookingId = booking?.booking_id || booking?.id || 'BK-00001';
  const serviceTitle = booking?.service_title || booking?.package_name || 'Service Appointment';

  const rawPlate = String(booking?.plate_number || booking?.plate || '').trim();
  const cleanPlate =
    rawPlate && !rawPlate.toLowerCase().startsWith('n/a') && !rawPlate.toLowerCase().includes('temp')
      ? rawPlate
      : rawPlate.replace(/^N\/A-?/i, '');

  const bikeBrand = String(booking?.bike_brand || booking?.brand || '').trim();
  const rawBike = String(
    booking?.motorcycle_model || booking?.motorcycle || booking?.bike_model || ''
  ).trim();
  const bikeSubtitle = [bikeBrand && !rawBike.toLowerCase().startsWith(bikeBrand.toLowerCase()) ? `${bikeBrand} ${rawBike}` : rawBike || 'Registered Motorcycle', cleanPlate]
    .filter(Boolean)
    .join(' · ');

  const totalEstimate = Number(
    booking?.estimated_service_total ??
      booking?.estimatedServiceTotal ??
      booking?.total_amount ??
      booking?.estimated_total ??
      booking?.pricePhp ??
      0
  );
  const depositAmount = Number(
    booking?.downpayment_amount ?? booking?.downpaymentAmount ?? Math.round(totalEstimate * 0.3)
  );
  const balanceAmount = Math.max(0, totalEstimate - depositAmount);
  const paymentMethod = booking?.payment_method || booking?.downpayment_channel || 'GCash';

  const formattedDate = fmtShortDateNoYear(
    booking?.preferred_date || booking?.appointment_date || booking?.date
  );
  const formattedTime = fmtShortTime(booking?.preferred_time || booking?.time_slot);
  const shortBay = extractShortBay(booking);

  const shopFullName =
    brandSettings?.hubName ||
    brandSettings?.shopName ||
    brandSettings?.storeName ||
    booking?.branch ||
    "D'Blockchain Motorparts & Accessories";
  const shortHubLabel = booking?.branch || brandSettings?.hubName || brandSettings?.storeName || 'MotoTrack Hub';
  const shopAddress =
    brandSettings?.storeAddress ||
    brandSettings?.shopAddress ||
    'Central Naga Highway, Naga City, Cebu';
  const shopHotline = brandSettings?.supportPhone || '+63 (032) 489-021';

  const hasAssignedMech =
    Boolean(booking?.mechanic) && !String(booking.mechanic).toLowerCase().includes('pending');
  const mechanicName = hasAssignedMech
    ? String(booking.mechanic).replace(/^Assigned to\s*/i, '').trim()
    : 'Assigning technician';
  const mechInitials = hasAssignedMech ? getInitials(mechanicName) : null;

  const submittedDate = fmtFullDate(booking?.created_at || booking?.submitted_at);
  const normStatus = normalizeBookingStatus(booking?.status);
  const statusConfig = useMemo(
    () => resolveStatusConfig(normStatus, isDarkMode),
    [normStatus, isDarkMode]
  );

  const isCompleted = normStatus === 'COMPLETED';
  const isCancelled = normStatus === 'CANCELLED' || normStatus === 'REJECTED';
  const canModify = !isCompleted && !isCancelled;

  const refundAmt = Number(booking?.refund_amount || Math.round(Number(depositAmount || 0) * 0.5));
  const refundRaw = String(booking?.refund_status || '').toLowerCase();
  const isRefunded =
    isCancelled && refundAmt > 0 && refundRaw.includes('refunded') && !refundRaw.includes('pending');
  const isRefundPending = isCancelled && depositAmount > 0 && !isRefunded;

  const surfaceBg = isDarkMode ? '#18181B' : '#FFFFFF';
  const insetBg = isDarkMode ? '#202124' : '#F6F4EF';
  const iconBoxBg = isDarkMode ? '#18181B' : '#FFFFFF';
  const borderCol = isSelected
    ? isDarkMode
      ? '#CBD5E1'
      : '#141D2E'
    : isDarkMode
      ? '#27272A'
      : '#EDEAE3';
  const textPrimary = isDarkMode ? '#F4F4F5' : '#18181B';
  const textMuted = isDarkMode ? '#A1A1AA' : '#71717A';

  return (
    <TouchableOpacity
      activeOpacity={0.96}
      onPress={() => onSelect?.(booking)}
      style={{
        width: '100%',
        borderRadius: 22,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: borderCol,
        backgroundColor: surfaceBg,
        padding: 18,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isSelected ? 0.06 : 0.03,
        shadowRadius: 8,
        elevation: isSelected ? 2 : 1,
      }}
    >
      {/* 1. Reference & Status Pill */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '500',
            color: '#94A3B8',
            fontVariant: ['tabular-nums'],
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {bookingId}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: statusConfig.bg,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusConfig.dot }} />
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: statusConfig.text }}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* 2. Service Title & Bike Subtitle + Price */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 18.5,
              fontWeight: '700',
              color: textPrimary,
              letterSpacing: -0.3,
            }}
            numberOfLines={2}
          >
            {serviceTitle}
          </Text>
          <Text
            style={{
              fontSize: 12.5,
              color: textMuted,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            {bikeSubtitle}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: '#EA580C',
            fontVariant: ['tabular-nums'],
            marginTop: 2,
          }}
        >
          {formatPriceNumber(totalEstimate)}
        </Text>
      </View>

      {/* 3. Inset Warm-Stone Schedule & Service Center Box */}
      <View
        style={{
          backgroundColor: insetBg,
          borderRadius: 16,
          padding: 12,
          gap: 12,
          marginBottom: 14,
        }}
      >
        <TouchableOpacity
          activeOpacity={canModify ? 0.75 : 1}
          onPress={() => {
            if (canModify) onReschedule?.(booking);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: iconBoxBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name="calendar-event" size={14} color={textMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 }}>
              SCHEDULE
            </Text>
            <Text
              style={{ fontSize: 13, fontWeight: '700', color: textPrimary, marginTop: 1 }}
              numberOfLines={1}
            >
              {formattedDate} · {formattedTime}
            </Text>
          </View>
          <BootstrapIcon name="chevron-right" size={13} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setIsDetailsExpanded((prev) => !prev)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: iconBoxBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name="geo-alt" size={14} color={textMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 }}>
              SERVICE CENTER
            </Text>
            <Text
              style={{ fontSize: 13, fontWeight: '700', color: textPrimary, marginTop: 1 }}
              numberOfLines={1}
            >
              {shortHubLabel} · {shortBay}
            </Text>
          </View>
          <BootstrapIcon name="chevron-right" size={13} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 4. Assigned Technician & Message Button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: hasAssignedMech ? '#C8765C' : isDarkMode ? '#27272A' : '#EFECE6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {mechInitials ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                {mechInitials}
              </Text>
            ) : (
              <BootstrapIcon name="tools" size={15} color={textMuted} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 }}>
              YOUR TECHNICIAN
            </Text>
            <Text
              style={{ fontSize: 13.5, fontWeight: '700', color: textPrimary, marginTop: 1 }}
              numberOfLines={1}
            >
              {mechanicName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            const dial = shopHotline.replace(/[^+\d]/g, '') || '+63032489021';
            Linking.openURL(`tel:${dial}`).catch(() => {
              onToast?.(`Shop Hotline: ${shopHotline}`);
            });
          }}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 13,
            height: 36,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDarkMode ? '#334155' : '#E5E2DC',
            backgroundColor: surfaceBg,
          }}
        >
          <BootstrapIcon name="chat" size={13} color={textMuted} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: textPrimary }}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* 5. Expandable "View booking details" Footer */}
      <TouchableOpacity
        onPress={() => setIsDetailsExpanded((prev) => !prev)}
        activeOpacity={0.75}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? '#27272A' : '#EFECE6',
        }}
      >
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: textPrimary }}>
          View booking details
        </Text>
        <BootstrapIcon
          name={isDetailsExpanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={textMuted}
        />
      </TouchableOpacity>

      {isDetailsExpanded ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View
            style={{
              backgroundColor: insetBg,
              borderRadius: 12,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              Shop: <Text style={{ fontWeight: '600', color: textPrimary }}>{shopFullName}</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              Address: <Text style={{ fontWeight: '600', color: textPrimary }}>{shopAddress}</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              {isRefunded
                ? `Refund: ${formatPriceNumber(refundAmt)} refunded via GCash`
                : isRefundPending
                  ? `Refund: ${formatPriceNumber(refundAmt)} refund pending`
                  : `Deposit (${paymentMethod}): ${formatPriceNumber(depositAmount)} paid · Balance: ${formatPriceNumber(balanceAmount)}`}
            </Text>
            <Text style={{ fontSize: 11.5, color: textMuted }}>
              Submitted: <Text style={{ fontWeight: '600', color: textPrimary }}>{submittedDate}</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setReceiptVisible(true)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isDarkMode ? '#334155' : '#E5E2DC',
                backgroundColor: surfaceBg,
              }}
            >
              <BootstrapIcon name="download" size={11.5} color={textMuted} />
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: textPrimary }}>
                Deposit Slip
              </Text>
            </TouchableOpacity>

            {canModify ? (
              <TouchableOpacity
                onPress={() => onReschedule?.(booking)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#E5E2DC',
                  backgroundColor: surfaceBg,
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: textPrimary }}>
                  Reschedule
                </Text>
              </TouchableOpacity>
            ) : null}

            {canCancel ? (
              <TouchableOpacity
                onPress={() => onCancel?.(booking)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#9F1239' : '#FECDD3',
                  backgroundColor: isDarkMode ? 'rgba(136, 19, 55, 0.25)' : '#FFF1F2',
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#E11D48' }}>Cancel</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => {
                onSelect?.(booking);
                onViewDetails?.(booking);
              }}
              activeOpacity={0.85}
              style={{
                marginLeft: 'auto',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: '#141D2E',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#FFFFFF' }}>
                Track Journey
              </Text>
              <BootstrapIcon name="arrow-down" size={11} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ServiceReceiptModal
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        booking={booking}
        payments={[]}
        isDarkMode={isDarkMode}
      />
    </TouchableOpacity>
  );
}
