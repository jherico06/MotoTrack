// =========================================================================
// MotoTrack Customer Booking - Screen 4: Review Booking
// Minimalist, high-clarity summary layout
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import { GARAGE_BRANCHES } from '../../../services/bookings/garageService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Selected Date';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function DetailItem({ label, value, subvalue, style }) {
  return (
    <View style={style}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#18181B', marginTop: 3, letterSpacing: -0.1 }}>
        {value}
      </Text>
      {subvalue ? (
        <Text style={{ fontSize: 12, color: '#71717A', marginTop: 2, lineHeight: 16 }}>
          {subvalue}
        </Text>
      ) : null}
    </View>
  );
}

const sectionLabelStyle = {
  fontSize: 10.5,
  fontWeight: '700',
  color: '#71717A',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

function ReviewCard({ icon, eyebrow, title, subtitle, actions = [], children }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        padding: 22,
        shadowColor: '#000000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#FFF7ED',
              borderWidth: 1,
              borderColor: '#FED7AA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name={icon} size={16} color="#EA580C" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={sectionLabelStyle}>{eyebrow}</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#18181B', marginTop: 2 }} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ fontSize: 12.5, color: '#71717A', marginTop: 1 }} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {actions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={action.onPress}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 5,
                  paddingHorizontal: 13,
                  borderRadius: 20,
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: '#D4D4D8',
                  cursor: 'pointer',
                }}
              >
                <BootstrapIcon name="pencil" size={11} color="#52525B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#3F3F46' }}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      {children}
    </View>
  );
}

export default function BookingReviewScreen({
  currentUser,
  firstName = '',
  lastName = '',
  mobileNumber = '',
  email = '',
  socialMedia = '',
  selectedMotorcycle,
  selectedPackages = [],
  pricingData,
  preferredDate,
  preferredTimeSlot,
  paymentMethod: _paymentMethod,
  gcashNumber: _gcashNumber,
  gcashReference: _gcashReference,
  customerNotes,
  motorcyclePhotos = [],
  isSubmitting,
  onProceedToPayment,
  onConfirmBooking,
  onEditSection,
  onBack,
}) {
  const branch = GARAGE_BRANCHES[0] || {
    name: "D'Blockchain Motorparts and Accessories",
    address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
  };

  const customerName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    currentUser?.name ||
    currentUser?.fullName ||
    'Guest Rider';
  const customerEmail = email || currentUser?.email || 'customer@mototrack.ph';
  const customerPhone = mobileNumber || currentUser?.phone || '0917-882-9102';
  const customerSocial = socialMedia || 'N/A';

  const bikeTitle = `${selectedMotorcycle?.brand || 'Motorcycle'} ${selectedMotorcycle?.model || ''}`.trim();
  const engineCc = selectedMotorcycle?.engine_displacement || selectedMotorcycle?.engine_cc || '150';
  const plateNumber = selectedMotorcycle?.plate_number || 'N/A';

  const subtotal = pricingData?.subtotal ?? 0;
  const hasNotesOrPhotos = Boolean(customerNotes) || motorcyclePhotos.length > 0;
  const serviceItems = pricingData?.items || [];
  const serviceTitle = serviceItems.length === 1
    ? serviceItems[0].pkg.name
    : serviceItems.length > 1
      ? `${serviceItems.length} Service Packages`
      : 'Selected Service';
  const serviceCountLabel = serviceItems.length > 1 ? 'Multiple packages selected' : 'Service package';

  // ─── ADMIN PIT RULES: DOWNPAYMENT PERCENTAGE & DYNAMIC CALCULATION ───
  const [adminSettings, setAdminSettings] = React.useState(() => systemSettingsService.getSettings());

  React.useEffect(() => {
    // Keep updated in real-time when admin changes pit rules in settings
    const unsubscribe = systemSettingsService.subscribe((updated) => {
      if (updated) setAdminSettings(updated);
    });
    return unsubscribe;
  }, []);

  // Admin Pit Rule Downpayment Percentage (default: 20% from Pitstop Garage Rules)
  const adminPitPercent = React.useMemo(() => {
    if (adminSettings?.requireDownpayment === false) return 0;
    const parsed = Number(adminSettings?.downpaymentPercent);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 20;
  }, [adminSettings]);

  // Downpayment percentage is strictly determined by the Admin's Pitstop Garage Rules
  const downpaymentPercent = adminPitPercent;
  const calculatedDownpayment = Math.round(subtotal * (downpaymentPercent / 100));
  const calculatedRemainingBalance = Math.max(0, subtotal - calculatedDownpayment);

  return (
    <View>
      {/* Title */}
      <View style={{ marginBottom: 24, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Review Your Service Booking</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Please verify your appointment schedule and service details before confirmation.
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        {/* ─── CARD 1: RIDER & MOTORCYCLE PROFILE ─── */}
        <ReviewCard
          icon="person"
          eyebrow="Rider & Motorcycle Profile"
          title={customerName}
          subtitle={`${bikeTitle} • ${engineCc}cc`}
          actions={[{ label: 'Edit Details', onPress: () => onEditSection?.(2) }]}
        >
          <Text style={[sectionLabelStyle, { marginBottom: 12 }]}>Personal & Contact Details</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <DetailItem label="Complete Name" value={customerName} style={{ flex: 1, minWidth: 160 }} />
            <DetailItem label="Contact Phone" value={customerPhone} style={{ flex: 1, minWidth: 140 }} />
            <DetailItem label="Email Address" value={customerEmail} style={{ flex: 1.2, minWidth: 190 }} />
            {customerSocial && customerSocial !== 'N/A' ? (
              <DetailItem label="Social Media" value={customerSocial} style={{ flex: 1, minWidth: 130 }} />
            ) : null}
          </View>

          <View style={{ height: 1, backgroundColor: '#F4F4F5', marginVertical: 16 }} />

          <Text style={[sectionLabelStyle, { marginBottom: 12 }]}>Motorcycle Specifications</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <DetailItem label="Motorcycle Model" value={bikeTitle} style={{ flex: 1, minWidth: 160 }} />
            <DetailItem label="Plate Number" value={plateNumber} style={{ flex: 1, minWidth: 140 }} />
            <DetailItem
              label="Classification"
              value={`${engineCc}cc • ${pricingData?.matchedCategory || 'Standard Rate'}`}
              style={{ flex: 1.2, minWidth: 190 }}
            />
          </View>
        </ReviewCard>

        {/* ─── CARD 2: SERVICE & SCHEDULE ─── */}
        <ReviewCard
          icon="calendar3"
          eyebrow="Schedule & Package Deliverables"
          title={serviceTitle}
          subtitle={serviceCountLabel}
          actions={[
            { label: 'Edit Schedule', onPress: () => onEditSection?.(3) },
            { label: 'Change Service', onPress: () => onEditSection?.(1) },
          ]}
        >
          <Text style={[sectionLabelStyle, { marginBottom: 12 }]}>Date, Time & Workshop Venue</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <DetailItem
              label="Date & Time"
              value={`${formatDisplayDate(preferredDate)} • ${preferredTimeSlot || 'Pending'}`}
              style={{ flex: 1, minWidth: 200 }}
            />
            <DetailItem
              label="Workshop Location"
              value={branch.name}
              subvalue={branch.address}
              style={{ flex: 1.4, minWidth: 220 }}
            />
          </View>

          <View style={{ height: 1, backgroundColor: '#F4F4F5', marginVertical: 16 }} />

          <Text style={[sectionLabelStyle, { marginBottom: 10 }]}>Package Inclusions & Deliverables</Text>
          <View
            style={{
              backgroundColor: '#FAFAF9',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#F4F4F5',
              paddingHorizontal: 16,
              paddingVertical: 4,
            }}
          >
            {(pricingData?.items || []).map(({ pkg, price }, idx, arr) => (
              <View
                key={pkg.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                  borderBottomColor: '#F4F4F5',
                }}
              >
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#18181B' }}>
                      {pkg.name}
                    </Text>
                    {pkg.category ? (
                      <View
                        style={{
                          backgroundColor: '#EFF6FF',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 4,
                          borderWidth: 1,
                          borderColor: '#DBEAFE',
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#2563EB' }}>
                          {pkg.category}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <BootstrapIcon name="clock" size={11} color="#71717A" />
                    <Text style={{ fontSize: 11.5, color: '#71717A' }}>
                      {pkg.duration ? pkg.duration : (pkg.category || '25–35 mins')}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 16, fontWeight: '800', color: '#18181B', fontVariant: ['tabular-nums'] }}>
                  {formatPhp(price)}
                </Text>
              </View>
            ))}
          </View>
        </ReviewCard>

        {/* ─── CARD 3 (OPTIONAL): NOTES & CONCERNS ─── */}
        {hasNotesOrPhotos ? (
          <ReviewCard
            icon="chat-left-text"
            eyebrow="Notes & Concerns"
            title="Your Notes"
            actions={[{ label: 'Edit Notes', onPress: () => onEditSection?.(2) }]}
          >
            {customerNotes ? (
              <View
                style={{
                  padding: 12,
                  backgroundColor: '#FAFAF9',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#F4F4F5',
                }}
              >
                <Text style={{ fontSize: 13, color: '#334155', fontStyle: 'italic', lineHeight: 19 }}>
                  "{customerNotes}"
                </Text>
              </View>
            ) : null}
            {motorcyclePhotos.length > 0 ? (
              <Text style={{ fontSize: 12, color: '#71717A', fontWeight: '500', marginTop: customerNotes ? 10 : 0 }}>
                {motorcyclePhotos.length} reference photo(s) attached
              </Text>
            ) : null}
          </ReviewCard>
        ) : null}

        {/* ─── CARD 4: PRICE & DOWNPAYMENT BREAKDOWN (DARK CARD - MATCHING IMAGE) ─── */}
        <View
          style={{
            backgroundColor: '#1E2227',
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            shadowColor: '#000000',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' }}>
            {/* Left Column: Total Package Breakdown */}
            <View style={{ flex: 1.15, minWidth: 260, justifyContent: 'space-between' }}>
              <View>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <BootstrapIcon name="stars" size={12} color="#FDBA74" />
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Total Package Breakdown
                  </Text>
                </View>

                {/* Primary Package Item */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 }}>
                      {serviceTitle}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {selectedPackages.length > 0 ? selectedPackages.map((p) => p.name).join(' • ') : 'Standard PMS Service Suite'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
                    {formatPhp(subtotal)}
                  </Text>
                </View>
              </View>

              {/* Hairline Divider & Bottom Total Amount */}
              <View style={{ marginTop: 20 }}>
                <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.10)', marginBottom: 14 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <View>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Total Package Rate
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }}>
                      Total Amount
                    </Text>
                  </View>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#FDBA74', fontVariant: ['tabular-nums'] }}>
                    {formatPhp(subtotal)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Subtle Divider between columns on desktop */}
            <View style={{ width: 1, backgroundColor: 'rgba(255, 255, 255, 0.10)' }} />

            {/* Right Column: Payment Terms & Downpayment Calculator */}
            <View style={{ flex: 1.25, minWidth: 280, justifyContent: 'space-between' }}>
              <View>
                {/* Header with Title & Fixed Pit Rule Split (Matching Reference Image) */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BootstrapIcon name="credit-card-2-front" size={13} color="#FDBA74" />
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Payment Terms
                    </Text>
                  </View>

                  <Text style={{ fontSize: 11.5, color: '#A1A1AA', fontWeight: '500' }}>
                    {adminPitPercent}% Balance Split
                  </Text>
                </View>

                {/* Box 1: Down Payment Box */}
                <View
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderWidth: 1,
                    borderColor: 'rgba(253, 186, 116, 0.3)',
                    borderRadius: 12,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FDBA74', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {downpaymentPercent === 100 ? 'Full Payment' : `${downpaymentPercent}% Down Payment`}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#A1A1AA', marginTop: 2 }}>
                      {downpaymentPercent === adminPitPercent ? 'Due upon confirmation • Pit Rule' : 'Due upon confirmation'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#FDBA74', fontVariant: ['tabular-nums'] }}>
                    {formatPhp(calculatedDownpayment)}
                  </Text>
                </View>

                {/* Box 2: Remaining Balance Box */}
                <View
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.10)',
                    borderRadius: 12,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    marginTop: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#E4E4E7', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Remaining Balance {downpaymentPercent < 100 ? `(${100 - downpaymentPercent}%)` : ''}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#A1A1AA', marginTop: 2 }}>
                      Payable at workshop or upon completion
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
                    {formatPhp(calculatedRemainingBalance)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── CONFIRMATION NOTICE BANNER (MATCHING IMAGE) ─── */}
        <View
          style={{
            backgroundColor: '#FFFBEB',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#FEF3C7',
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BootstrapIcon name="shield-check" size={14} color="#D97706" />
          </View>
          <Text style={{ flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 18 }}>
            Please verify your service parameters above. Clicking{' '}
            <Text style={{ fontWeight: '700' }}>"Confirm & Proceed to Payment"</Text> will secure your{' '}
            {downpaymentPercent}% reservation deposit ({formatPhp(calculatedDownpayment)}) required by workshop pit rules to guarantee your pit bay slot, with the remaining balance ({formatPhp(calculatedRemainingBalance)}) payable at the workshop.
          </Text>
        </View>
      </View>
      {/* ─── NAVIGATION BUTTONS ─── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 24,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: '#E4E4E7',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#1E2227',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
          onPress={onBack}
          activeOpacity={0.8}
          disabled={isSubmitting}
        >
          <BootstrapIcon name="arrow-left" size={13} color="#1E2227" />
          <Text style={{ color: '#1E2227', fontWeight: '600', fontSize: 13 }}>
            Back to Schedule
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 22,
            borderRadius: 8,
            backgroundColor: '#1E2227',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            shadowColor: '#000000',
            shadowOpacity: 0.12,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            opacity: isSubmitting ? 0.7 : 1,
          }}
          disabled={isSubmitting}
          onPress={() => {
            const dpPayload = {
              downpaymentPercent,
              downpaymentAmount: calculatedDownpayment,
              remainingBalance: calculatedRemainingBalance,
            };
            if (onProceedToPayment) {
              onProceedToPayment(dpPayload);
            } else if (onConfirmBooking) {
              onConfirmBooking(dpPayload);
            }
          }}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                Proceeding...
              </Text>
            </>
          ) : (
            <>
              <BootstrapIcon name="check-circle-fill" size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                Confirm & Proceed to Payment
              </Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
