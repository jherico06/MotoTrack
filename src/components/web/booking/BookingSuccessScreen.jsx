// =========================================================================
// MotoTrack Customer Booking - Screen 8: Booking Success Confirmation
// Confirms reference ID, motorcycle, packages, date/time, and Pending Review status
// =========================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';

export default function BookingSuccessScreen({
  bookingResult,
  selectedMotorcycle,
  selectedPackages = [],
  pricingData,
  preferredDate,
  preferredTimeSlot,
  paymentMethod,
  onViewBookingDetails,
  onBookAnother,
  showToast,
}) {
  const [copied, setCopied] = useState(false);
  const bookingId = bookingResult?.id || bookingResult?.booking_id || 'BK-PMS-2026-PENDING';
  const bikeTitle = `${selectedMotorcycle?.brand || 'Motorcycle'} ${selectedMotorcycle?.model || ''}`.trim();
  const subtotal = pricingData?.subtotal ?? 0;

  const handleCopyReference = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(bookingId);
      }
      setCopied(true);
      showToast?.(`Copied ${bookingId} to clipboard`);
      setTimeout(() => setCopied(false), 2500);
    } catch (_e) {
      showToast?.(bookingId);
    }
  };

  return (
    <View style={styles.successCard}>
      {/* ─── SUCCESS ICON & TITLE ─── */}
      <View style={styles.successIconBadge}>
        <BootstrapIcon name="check-circle-fill" size={32} color="#10B981" />
      </View>

      <Text style={styles.successTitle}>Booking Request Submitted!</Text>
      <Text style={styles.successSubtext}>
        Your motorcycle service booking has been created and logged in our system.
      </Text>

      {/* ─── REFERENCE NUMBER PILL ─── */}
      <View style={styles.referenceBox}>
        <View style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: '600' }}>
            Booking Reference Number
          </Text>
          <Text style={styles.referenceText}>{bookingId}</Text>
        </View>
        <TouchableOpacity
          style={{
            padding: 8,
            borderRadius: 6,
            backgroundColor: copied ? '#DCFCE7' : '#FFFFFF',
            borderWidth: 1,
            borderColor: copied ? '#86EFAC' : '#CBD5E1',
            cursor: 'pointer',
          }}
          onPress={handleCopyReference}
          activeOpacity={0.8}
        >
          <BootstrapIcon
            name={copied ? 'clipboard-check-fill' : 'clipboard'}
            size={16}
            color={copied ? '#16A34A' : '#475569'}
          />
        </TouchableOpacity>
      </View>

      {/* ─── CURRENT STATUS: PENDING REVIEW ─── */}
      <View style={styles.statusPendingPill}>
        <BootstrapIcon name="clock-history" size={14} color="#B45309" />
        <Text style={styles.statusPendingText}>
          Current Status: Pending Review
        </Text>
      </View>

      <Text style={{ fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 24, maxWidth: 520, textAlign: 'center' }}>
        Our service advisors are reviewing your requested package(s) and bay schedule. You will receive an email and system notification once your booking is confirmed.
      </Text>

      {/* ─── SUMMARY DETAILS MINI-CARD ─── */}
      <View
        style={{
          width: '100%',
          backgroundColor: '#F8FAFC',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          padding: 16,
          marginBottom: 24,
          textAlign: 'left',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Motorcycle</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
            {bikeTitle} ({selectedMotorcycle?.plate_number || 'No Plate'})
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Selected Package(s)</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>
            {selectedPackages.map((p) => p.name).join(', ')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Schedule</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C' }}>
            {preferredDate} • {preferredTimeSlot}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Payment Method</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>
            {paymentMethod}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Estimated Total</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', fontVariant: ['tabular-nums'] }}>
            {formatPhp(subtotal)}
          </Text>
        </View>
      </View>

      {/* ─── ACTION BUTTONS ─── */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', justifyContent: 'center' }}>
        <TouchableOpacity
          style={[styles.primaryBtn, { minWidth: 180 }]}
          onPress={onViewBookingDetails}
          activeOpacity={0.85}
        >
          <BootstrapIcon name="eye-fill" size={15} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>View Booking Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backBtn, { minWidth: 160 }]}
          onPress={onBookAnother}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-repeat" size={15} color="#334155" />
          <Text style={styles.backBtnText}>Book Another Service</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

