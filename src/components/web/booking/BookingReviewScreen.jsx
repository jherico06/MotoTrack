// =========================================================================
// MotoTrack Customer Booking - Screen 4: Booking Review & Confirmation
// Minimalist, high-clarity summary layout
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import { GARAGE_BRANCHES } from '../../../services/bookings/garageService.js';

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

function SectionHeader({ title, icon, onEdit }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon && <BootstrapIcon name={icon} size={12} color="#71717A" />}
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#18181B', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {title}
        </Text>
      </View>
      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 6,
            backgroundColor: '#FFF7ED',
            borderWidth: 1,
            borderColor: '#FFEDD5',
          }}
          activeOpacity={0.7}
        >
          <BootstrapIcon name="pencil" size={10.5} color="#EA580C" />
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#EA580C' }}>Edit</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function DetailItem({ label, value, subvalue, style }) {
  return (
    <View style={style}>
      <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#18181B', marginTop: 2 }}>
        {value}
      </Text>
      {subvalue ? (
        <Text style={{ fontSize: 12, color: '#71717A', marginTop: 1, lineHeight: 16 }}>
          {subvalue}
        </Text>
      ) : null}
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
  pricingData,
  preferredDate,
  preferredTimeSlot,
  paymentMethod: _paymentMethod,
  gcashNumber: _gcashNumber,
  gcashReference: _gcashReference,
  customerNotes,
  motorcyclePhotos = [],
  isSubmitting,
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

  return (
    <View>
      {/* Title */}
      <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Review Your Service Booking</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Please verify your appointment schedule and service details before confirmation.
        </Text>
      </View>

      {/* Two-Column Clean & Organized Layout - Exact Equal Height */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        {/* ─── LEFT: UNIFIED DETAILS CARD ─── */}
        <View
          style={{
            flex: 1.35,
            minWidth: 280,
            maxWidth: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E4E4E7',
            padding: 24,
            justifyContent: 'space-between',
            shadowColor: '#000000',
            shadowOpacity: 0.02,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View>
            {/* Section 1: Rider & Motorcycle */}
            <SectionHeader
              title="Rider & Motorcycle"
              icon="person"
              onEdit={() => onEditSection?.(2)}
            />

            {/* Rider Information 3-Column Row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
              <DetailItem label="Rider Name" value={customerName} style={{ flex: 1, minWidth: 120 }} />
              <DetailItem label="Email" value={customerEmail} style={{ flex: 1.3, minWidth: 170 }} />
              <DetailItem label="Contact Phone" value={customerPhone} style={{ flex: 1, minWidth: 120 }} />
              {customerSocial && customerSocial !== 'N/A' && (
                <DetailItem label="Social Media" value={customerSocial} style={{ flex: 1, minWidth: 120 }} />
              )}
            </View>

            {/* Registered Motorcycle Highlight Box */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: 12,
                backgroundColor: '#FAFAF9',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#F4F4F5',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#E4E4E7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="speedometer2" size={15} color="#18181B" />
                </View>
                <View>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#18181B' }}>
                    {bikeTitle}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#71717A', marginTop: 1 }}>
                    Plate: <Text style={{ fontWeight: '600', color: '#18181B' }}>{plateNumber}</Text>
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#E4E4E7',
                }}
              >
                <Text style={{ fontSize: 11.5, color: '#52525B', fontWeight: '600' }}>
                  {engineCc}cc • {pricingData?.matchedCategory || 'Standard'}
                </Text>
              </View>
            </View>

            {/* Hairline Divider */}
            <View style={{ height: 1, backgroundColor: '#F4F4F5', marginVertical: 18 }} />

            {/* Section 2: Appointment Schedule */}
            <SectionHeader
              title="Appointment Schedule"
              icon="calendar"
              onEdit={() => onEditSection?.(3)}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <DetailItem
                label="Date & Time"
                value={`${formatDisplayDate(preferredDate)} • ${preferredTimeSlot || 'Pending'}`}
                style={{ flex: 1, minWidth: 180 }}
              />
              <DetailItem
                label="Location"
                value={branch.name}
                subvalue={branch.address}
                style={{ flex: 1.4, minWidth: 200 }}
              />
            </View>

            {/* Hairline Divider & Notes (if provided in Step 3) */}
            {hasNotesOrPhotos && (
              <>
                <View style={{ height: 1, backgroundColor: '#F4F4F5', marginVertical: 18 }} />

                <SectionHeader
                  title="Notes & Concerns"
                  icon="chat"
                  onEdit={() => onEditSection?.(3)}
                />

                {customerNotes ? (
                  <View
                    style={{
                      padding: 10,
                      backgroundColor: '#FAFAF9',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#F4F4F5',
                      marginTop: 2,
                    }}
                  >
                    <Text style={{ fontSize: 12.5, color: '#334155', fontStyle: 'italic', lineHeight: 18 }}>
                      "{customerNotes}"
                    </Text>
                  </View>
                ) : null}

                {motorcyclePhotos.length > 0 ? (
                  <View style={{ marginTop: customerNotes ? 8 : 4 }}>
                    <Text style={{ fontSize: 12, color: '#71717A', fontWeight: '500' }}>
                      📎 {motorcyclePhotos.length} reference photo(s) attached
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* ─── RIGHT: MINIMALIST SUMMARY CARD ─── */}
        <View
          style={{
            flex: 1,
            minWidth: 280,
            maxWidth: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E4E4E7',
            padding: 24,
            justifyContent: 'space-between',
            shadowColor: '#000000',
            shadowOpacity: 0.02,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          {/* Top: Header & Package List */}
          <View>
            <SectionHeader
              title="Service Summary"
              icon="receipt"
              onEdit={() => onEditSection?.(1)}
            />

            {/* Selected Packages List */}
            <View style={{ marginBottom: 16 }}>
              {(pricingData?.items || []).map(({ pkg, price }) => (
                <View
                  key={pkg.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    paddingVertical: 9,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F4F4F5',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#18181B' }}>{pkg.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <BootstrapIcon name="clock" size={11} color="#71717A" />
                      <Text style={{ fontSize: 11.5, color: '#71717A' }}>
                        {pkg.duration ? pkg.duration : (pkg.category || '30-45 mins')}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#18181B', fontVariant: ['tabular-nums'] }}>
                    {formatPhp(price)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Bottom: Cost Breakdown & Total */}
          <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F4F4F5', gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12.5, color: '#71717A', fontWeight: '500' }}>Labor Rate</Text>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#18181B', fontVariant: ['tabular-nums'] }}>
                {formatPhp(subtotal)}
              </Text>
            </View>

            {/* Total Row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingTop: 12,
                marginTop: 4,
                borderTopWidth: 1,
                borderTopColor: '#E4E4E7',
              }}
            >
              <View>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#18181B' }}>Estimated Total</Text>
                <Text style={{ fontSize: 11, color: '#71717A', marginTop: 1 }}>Pay at workshop</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#EA580C', fontVariant: ['tabular-nums'] }}>
                {formatPhp(subtotal)}
              </Text>
            </View>
          </View>
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
          onPress={onConfirmBooking}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                Confirming...
              </Text>
            </>
          ) : (
            <>
              <BootstrapIcon name="check-circle-fill" size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                Confirm Booking
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
