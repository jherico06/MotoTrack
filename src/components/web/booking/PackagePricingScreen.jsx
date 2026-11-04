// =========================================================================
// MotoTrack Customer Booking - Screen 4: Automatic Package Pricing
// Automatically calculates and breaks down CC-based rates from backend/database
// =========================================================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import { calculatePackagePriceForCc } from './bookingPackagesData.js';

export default function PackagePricingScreen({
  selectedPackages = [],
  selectedMotorcycle,
  onBack,
  onContinue,
}) {
  const engineCc = Number(
    selectedMotorcycle?.engine_displacement ||
    selectedMotorcycle?.engine_cc ||
    150
  );

  // Compute pricing per package based on displacement CC
  const pricingData = useMemo(() => {
    const items = selectedPackages.map((pkg) => {
      const calc = calculatePackagePriceForCc(pkg, engineCc);
      const price = calc?.price ?? 0;
      return {
        pkg,
        price,
        tierLabel: calc?.tierLabel || 'Standard rate',
        tierId: calc?.tierId,
        isAvailable: calc?.isAvailable !== false,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const downpaymentAmount = Math.round(subtotal * 0.2);
    const balanceRemaining = subtotal - downpaymentAmount;

    let matchedCategory = '150cc–160cc';
    if (engineCc <= 125) matchedCategory = '125cc and below';
    else if (engineCc > 160) matchedCategory = 'Big Bikes';

    return {
      items,
      subtotal,
      downpaymentAmount,
      balanceRemaining,
      matchedCategory,
      engineCc,
    };
  }, [selectedPackages, engineCc]);

  const bikeTitle = `${selectedMotorcycle?.brand || 'Motorcycle'} ${selectedMotorcycle?.model || ''}`.trim();

  return (
    <View>
      <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Automatic Package Pricing</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Service package rates configured and calculated specifically for your motorcycle engine displacement.
        </Text>
      </View>

      {/* ─── MOTORCYCLE CC TIER BANNER ─── */}
      <View style={styles.pricingCcNotice}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: '#1E2227',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BootstrapIcon name="speedometer" size={20} color="#EA580C" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
              {bikeTitle}
            </Text>
            <View style={{ backgroundColor: '#EA580C', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                {engineCc} CC
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12.5, color: '#475569', marginTop: 3 }}>
            Matched Pricing Category: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{pricingData.matchedCategory}</Text>
          </Text>
        </View>
      </View>

      {/* ─── SELECTED PACKAGES PRICING BREAKDOWN ─── */}
      <View style={styles.pricingCard}>
        <Text style={styles.sectionTitle}>Selected Packages Breakdown</Text>
        <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
          {selectedPackages.length} package{selectedPackages.length === 1 ? '' : 's'} selected for this appointment:
        </Text>

        {pricingData.items.map(({ pkg, price, tierLabel, isAvailable }) => (
          <View key={pkg.id} style={styles.pricingLineItem}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="box-seam" size={13} color="#EA580C" />
                <Text style={styles.pricingItemName}>{pkg.name}</Text>
              </View>
              <Text style={styles.pricingItemSub}>
                {pkg.category} • ⏱️ {pkg.duration} • Tier: {tierLabel}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pricingItemPrice}>
                {isAvailable ? formatPhp(price) : 'Not Available'}
              </Text>
              <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '500' }}>
                Displacement rate applied
              </Text>
            </View>
          </View>
        ))}

        {/* ─── TOTAL SUMMARY CALCULATION ─── */}
        <View style={styles.totalSummaryBox}>
          <View style={styles.summaryRow}>
            <Text style={{ fontSize: 13, color: '#475569' }}>Total Labor Subtotal</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>
              {formatPhp(pricingData.subtotal)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, color: '#475569' }}>20% Slot Reservation Downpayment</Text>
              <BootstrapIcon name="info-circle" size={12} color="#94A3B8" />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#EA580C' }}>
              {formatPhp(pricingData.downpaymentAmount)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={{ fontSize: 13, color: '#475569' }}>Balance Payable Upon Completion</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>
              {formatPhp(pricingData.balanceRemaining)}
            </Text>
          </View>

          <View style={[styles.summaryRow, { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
            <View>
              <Text style={styles.totalLabel}>Total Service Labor</Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}>
                All selected packages included
              </Text>
            </View>
            <Text style={styles.totalValue}>
              {formatPhp(pricingData.subtotal)}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BootstrapIcon name="shield-check" size={14} color="#16A34A" />
          <Text style={{ fontSize: 11.5, color: '#475569', flex: 1, lineHeight: 16 }}>
            Pricing is automatically validated against official shop CC rate schedules. Any required replacement parts will be quoted separately after initial bay inspection.
          </Text>
        </View>
      </View>

      {/* ─── NAVIGATION BUTTONS ─── */}
      <View style={styles.navButtonsRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-left" size={14} color="#334155" />
          <Text style={styles.backBtnText}>Back to Motorcycle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => onContinue(pricingData)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Next: Schedule & Booking Info</Text>
          <BootstrapIcon name="arrow-right" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
