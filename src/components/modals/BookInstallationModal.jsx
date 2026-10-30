import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { useTheme } from '../../context/ThemeContext.jsx';
import { garageService } from '../../services/bookings/garageService.js';

/**
 * MotoTrack Book Installation Modal
 * Clean, professional, modern, and user-friendly motorcycle installation booking experience.
 * Features:
 * - Fixed header with calendar icon, title, subtitle & close button
 * - Scrollable middle body with contain-fitted motorcycle preview, structured location card,
 *   responsive time-slot grid with availability states, and contact info validation
 * - Fixed bottom action footer with price summary, secondary Wishlist, and primary Confirm Booking
 */
export default function BookInstallationModal({
  visible = false,
  onClose,
  previewImageUri = null,
  motorcycle = null,
  bikeTitle = '',
  serviceName = '',
  laborFeePhp = 3250,
  freeInstallPromo = null,
  branches = [],
  selectedBranch = '',
  onSelectBranch,
  timeSlots = [],
  selectedTimeSlot = '',
  onSelectTimeSlot,
  phone = '',
  onChangePhone,
  notes = '',
  onChangeNotes,
  onConfirm,
  onWishlist,
  busy = false,
  errorMessage = '',
}) {
  const { isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  // Local state for inline validation warning
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [hoveredBranch, setHoveredBranch] = useState(null);

  // Brand Palette
  const BRAND = isDarkMode ? '#EA580C' : '#EA580C';
  const BRAND_HOVER = isDarkMode ? '#3CA482' : '#153326';
  const SURFACE = isDarkMode ? '#151C19' : '#FFFFFF';
  const CARD_BG = isDarkMode ? '#1B2420' : '#F8FAFC';
  const CARD_BORDER = isDarkMode ? '#27342F' : '#E2E8F0';
  const INK = isDarkMode ? '#F1F5F9' : '#0F172A';
  const MUTED = isDarkMode ? '#94A3B8' : '#64748B';
  const SUBTLE = isDarkMode ? '#64748B' : '#94A3B8';
  const GREEN_BG = isDarkMode ? 'rgba(77, 184, 150, 0.12)' : '#F0FDF4';
  const GREEN_BORDER = isDarkMode ? '#2E5446' : '#BBF7D0';

  // Compute real-time slot availability for tomorrow
  const slotAvailability = useMemo(() => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const res = garageService.getDaySlotAvailability(tomorrowStr);
      const map = {};
      (res?.slotsData || []).forEach((s) => {
        map[s.timeSlot] = Boolean(s.isBooked);
      });
      return map;
    } catch {
      return {};
    }
  }, [visible]);

  // Derived display strings
  const displayBike =
    bikeTitle ||
    motorcycle?.nickname ||
    motorcycle?.name ||
    [motorcycle?.year, motorcycle?.brand, motorcycle?.model].filter(Boolean).join(' ') ||
    'Registered Motorcycle';

  const displayService =
    serviceName ||
    'Custom Parts Installation';

  const isPhoneValid = Boolean(phone && phone.trim().length >= 7);
  const showPhoneError = phoneTouched && !isPhoneValid;

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
  };

  const handleConfirmPress = () => {
    setPhoneTouched(true);
    if (!isPhoneValid) return;
    onConfirm?.();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={() => !busy && onClose?.()}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: SURFACE,
              borderColor: CARD_BORDER,
              maxWidth: isMobile ? '100%' : 590,
            },
          ]}
        >
          {/* ─── 1. FIXED HEADER ─── */}
          <View
            style={[
              styles.header,
              {
                borderBottomColor: CARD_BORDER,
                backgroundColor: isDarkMode ? '#19221E' : '#FFFFFF',
              },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.headerIconBadge,
                  { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
                ]}
              >
                <BootstrapIcon name="calendar2-check-fill" size={17} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: INK }]}>Book Installation</Text>
                <Text style={[styles.headerSubtitle, { color: MUTED }]}>
                  Review your service and choose your preferred schedule.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: isDarkMode ? '#232E29' : '#F1F5F9' },
              ]}
              onPress={() => !busy && onClose?.()}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityLabel="Close installation booking modal"
            >
              <BootstrapIcon name="x-lg" size={15} color={MUTED} />
            </TouchableOpacity>
          </View>

          {/* ─── 2. SCROLLABLE CONTENT BODY ─── */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Inline Error Banner if submission fails */}
            {errorMessage ? (
              <View style={styles.errorAlert}>
                <BootstrapIcon name="exclamation-triangle-fill" size={15} color="#DC2626" />
                <Text style={styles.errorAlertText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* ─── MOTORCYCLE & SERVICE SUMMARY CARD ─── */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: CARD_BG,
                  borderColor: CARD_BORDER,
                },
              ]}
            >
              {/* Motorcycle Preview Image: Object-fit contain to prevent cut off */}
              {previewImageUri ? (
                <View
                  style={[
                    styles.imageContainer,
                    {
                      backgroundColor: isDarkMode ? '#131A17' : '#FFFFFF',
                      borderBottomColor: CARD_BORDER,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: previewImageUri }}
                    style={styles.motorcycleImage}
                    resizeMode="contain"
                  />
                  <View style={styles.imageOverlayBadge}>
                    <BootstrapIcon name="check-circle-fill" size={12} color="#10B981" />
                    <Text style={styles.imageOverlayBadgeText}>AI Fitted Setup</Text>
                  </View>
                </View>
              ) : null}

              {/* Service & Price Info Row */}
              <View style={styles.summaryDetails}>
                <View style={styles.summaryInfoCol}>
                  <Text style={[styles.serviceTitle, { color: INK }]} numberOfLines={1}>
                    {displayService}
                  </Text>
                  <View style={styles.bikeModelRow}>
                    <BootstrapIcon name="bicycle" size={13} color={BRAND} />
                    <Text style={[styles.bikeModelText, { color: MUTED }]} numberOfLines={1}>
                      {displayBike}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryPriceCol}>
                  {freeInstallPromo ? (
                    <View style={styles.freeBadge}>
                      <BootstrapIcon name="tag-fill" size={11} color="#059669" />
                      <Text style={styles.freeBadgeText}>
                        FREE • {freeInstallPromo.code || 'PROMO'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.priceAmount, { color: BRAND }]}>
                        ₱{Number(laborFeePhp || 3250).toLocaleString()}
                      </Text>
                      <Text style={[styles.priceSublabel, { color: MUTED }]}>
                        Estimated labor fee
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Fee notice note */}
              <View
                style={[
                  styles.feeNoteRow,
                  {
                    backgroundColor: isDarkMode ? 'rgba(77,184,150,0.06)' : '#F0FDF4',
                    borderTopColor: CARD_BORDER,
                  },
                ]}
              >
                <BootstrapIcon name="info-circle" size={12} color={BRAND} />
                <Text style={[styles.feeNoteText, { color: isDarkMode ? '#86EFAC' : '#166534' }]}>
                  Labor fee estimate payable at shop bay. Parts, fabrication, or extra fluids
                  finalized upon check-in.
                </Text>
              </View>
            </View>

            {/* ─── SECTION 1: INSTALLATION LOCATION ─── */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeadingRow}>
                <Text style={[styles.sectionHeading, { color: INK }]}>
                  1. Installation Location
                </Text>
                <Text style={[styles.sectionSub, { color: MUTED }]}>
                  Select your preferred MotoTrack pitstop bay
                </Text>
              </View>

              {(branches && branches.length > 0
                ? branches
                : [
                    {
                      id: 'central-naga',
                      name: "D'Blockchain Motorparts and Accessories",
                      address:
                        'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
                      bays: '6 Dedicated Pit Bays • Master Tech Bay',
                      hours: 'Mon - Sun: 8:00 AM - 7:00 PM',
                    },
                  ]
              ).map((branch) => {
                const isSelected =
                  selectedBranch === branch.name ||
                  (!selectedBranch && branch.id === 'central-naga');
                const isHovered = hoveredBranch === branch.name;

                return (
                  <TouchableOpacity
                    key={branch.name}
                    style={[
                      styles.locationCard,
                      {
                        backgroundColor: isSelected
                          ? GREEN_BG
                          : isHovered
                          ? isDarkMode
                            ? '#202A25'
                            : '#F8FAFC'
                          : CARD_BG,
                        borderColor: isSelected
                          ? BRAND
                          : isHovered
                          ? isDarkMode
                            ? '#3A4B43'
                            : '#CBD5E1'
                          : CARD_BORDER,
                      },
                    ]}
                    onPress={() => onSelectBranch?.(branch.name)}
                    activeOpacity={0.85}
                    {...(Platform.OS === 'web'
                      ? {
                          onMouseEnter: () => setHoveredBranch(branch.name),
                          onMouseLeave: () => setHoveredBranch(null),
                        }
                      : {})}
                  >
                    <View style={styles.locationHeaderRow}>
                      <View style={styles.locationTitleGroup}>
                        <View
                          style={[
                            styles.locationIconBox,
                            {
                              backgroundColor: isSelected
                                ? isDarkMode
                                  ? 'rgba(77,184,150,0.2)'
                                  : '#DCFCE7'
                                : isDarkMode
                                ? '#222F29'
                                : '#EEF2F6',
                            },
                          ]}
                        >
                          <BootstrapIcon
                            name="geo-alt-fill"
                            size={14}
                            color={isSelected ? BRAND : MUTED}
                          />
                        </View>
                        <Text
                          style={[
                            styles.locationName,
                            { color: INK, fontWeight: isSelected ? '600' : '500' },
                          ]}
                        >
                          {branch.name}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.selectedBadge}>
                          <BootstrapIcon name="check-circle-fill" size={11} color="#059669" />
                          <Text style={styles.selectedBadgeText}>Selected</Text>
                        </View>
                      ) : (
                        <View style={[styles.unselectedIndicator, { borderColor: SUBTLE }]} />
                      )}
                    </View>

                    <Text style={[styles.locationAddress, { color: MUTED }]}>
                      {branch.address}
                    </Text>

                    <View style={styles.locationMetaRow}>
                      <View style={styles.locationMetaItem}>
                        <BootstrapIcon name="tools" size={11} color={SUBTLE} />
                        <Text style={[styles.locationMetaText, { color: MUTED }]}>
                          {branch.bays || '6 Pit Bays • Certified Mechanics'}
                        </Text>
                      </View>
                      <View style={styles.locationMetaItem}>
                        <BootstrapIcon name="clock" size={11} color={SUBTLE} />
                        <Text style={[styles.locationMetaText, { color: MUTED }]}>
                          {branch.hours || '8:00 AM - 7:00 PM'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ─── SECTION 2: CHOOSE A TIME SLOT ─── */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeadingRow}>
                <Text style={[styles.sectionHeading, { color: INK }]}>
                  2. Choose a Time Slot
                </Text>
                <Text style={[styles.sectionSub, { color: MUTED }]}>
                  Available appointment windows for tomorrow
                </Text>
              </View>

              <View style={styles.slotsGrid}>
                {(timeSlots && timeSlots.length > 0
                  ? timeSlots
                  : [
                      '09:00 AM - 10:30 AM',
                      '10:30 AM - 12:00 PM',
                      '01:30 PM - 03:00 PM',
                      '03:00 PM - 04:30 PM',
                      '04:30 PM - 06:00 PM',
                    ]
                ).map((slot) => {
                  const isSelected = selectedTimeSlot === slot;
                  const isBooked = Boolean(slotAvailability[slot]);
                  const isHovered = hoveredSlot === slot;

                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.slotButton,
                        {
                          backgroundColor: isSelected
                            ? BRAND
                            : isBooked
                            ? isDarkMode
                              ? '#17201C'
                              : '#F1F5F9'
                            : isHovered
                            ? isDarkMode
                              ? '#202C26'
                              : '#F0FDF4'
                            : isDarkMode
                            ? '#1B2420'
                            : '#FFFFFF',
                          borderColor: isSelected
                            ? BRAND
                            : isBooked
                            ? isDarkMode
                              ? '#222D28'
                              : '#E2E8F0'
                            : isHovered
                            ? BRAND
                            : CARD_BORDER,
                          opacity: isBooked ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => !isBooked && onSelectTimeSlot?.(slot)}
                      disabled={isBooked || busy}
                      activeOpacity={0.8}
                      {...(Platform.OS === 'web'
                        ? {
                            onMouseEnter: () => setHoveredSlot(slot),
                            onMouseLeave: () => setHoveredSlot(null),
                          }
                        : {})}
                    >
                      <View style={styles.slotButtonInner}>
                        {isSelected ? (
                          <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                        ) : isBooked ? (
                          <BootstrapIcon name="slash-circle" size={11} color={SUBTLE} />
                        ) : (
                          <BootstrapIcon
                            name="clock"
                            size={12}
                            color={isHovered ? BRAND : SUBTLE}
                          />
                        )}
                        <Text
                          style={[
                            styles.slotText,
                            {
                              color: isSelected
                                ? '#FFFFFF'
                                : isBooked
                                ? SUBTLE
                                : isHovered
                                ? BRAND
                                : INK,
                              fontWeight: isSelected ? '700' : '600',
                              textDecorationLine: isBooked ? 'line-through' : 'none',
                            },
                          ]}
                        >
                          {slot}
                        </Text>
                      </View>

                      {isBooked ? (
                        <View style={styles.bookedTag}>
                          <Text style={styles.bookedTagText}>Full</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ─── SECTION 3: CONTACT INFORMATION ─── */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeadingRow}>
                <Text style={[styles.sectionHeading, { color: INK }]}>
                  3. Contact Information
                </Text>
                <Text style={[styles.sectionSub, { color: MUTED }]}>
                  Shop dispatch will send SMS updates and bay gate pass
                </Text>
              </View>

              {/* Phone Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: INK }]}>
                  Contact Phone Number <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: isDarkMode ? '#1B2420' : '#FFFFFF',
                      borderColor: showPhoneError ? '#DC2626' : CARD_BORDER,
                    },
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <BootstrapIcon
                      name="telephone-fill"
                      size={13}
                      color={showPhoneError ? '#DC2626' : BRAND}
                    />
                  </View>
                  <TextInput
                    style={[styles.inputField, { color: INK }]}
                    placeholder="+63 9XX XXX XXXX"
                    placeholderTextColor={SUBTLE}
                    value={phone}
                    onChangeText={(val) => {
                      onChangePhone?.(val);
                      if (phoneTouched) setPhoneTouched(false);
                    }}
                    onBlur={handlePhoneBlur}
                    keyboardType="phone-pad"
                    editable={!busy}
                  />
                  {isPhoneValid ? (
                    <BootstrapIcon name="check-circle-fill" size={14} color="#10B981" />
                  ) : null}
                </View>

                {showPhoneError ? (
                  <Text style={styles.fieldErrorText}>
                    Please enter a valid mobile number (e.g. +63 917 123 4567)
                  </Text>
                ) : (
                  <Text style={[styles.fieldHelperText, { color: MUTED }]}>
                    Required for SMS booking verification and pitstop status
                  </Text>
                )}
              </View>

              {/* Fitting Notes Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: INK }]}>
                  Fitting & Special Notes{' '}
                  <Text style={{ fontSize: 11, fontWeight: '500', color: MUTED }}>
                    (Optional)
                  </Text>
                </Text>
                <View
                  style={[
                    styles.textAreaWrapper,
                    {
                      backgroundColor: isDarkMode ? '#1B2420' : '#FFFFFF',
                      borderColor: CARD_BORDER,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.textAreaField, { color: INK }]}
                    placeholder="e.g., torque specs, keep stock parts, dyno test after install..."
                    placeholderTextColor={SUBTLE}
                    value={notes}
                    onChangeText={onChangeNotes}
                    multiline
                    numberOfLines={3}
                    editable={!busy}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* ─── 3. FIXED BOTTOM ACTION FOOTER ─── */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: CARD_BORDER,
                backgroundColor: isDarkMode ? '#18221E' : '#FFFFFF',
              },
            ]}
          >
            <View style={[styles.footerContentRow, isMobile && styles.footerContentCol]}>
              {/* Compact Price Summary */}
              <View style={styles.footerPriceBlock}>
                <Text style={[styles.footerPriceLabel, { color: MUTED }]}>
                  ESTIMATED LABOR
                </Text>
                <View style={styles.footerPriceRow}>
                  {freeInstallPromo ? (
                    <Text style={[styles.footerPriceVal, { color: '#059669' }]}>
                      FREE{' '}
                      <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED }}>
                        (promo)
                      </Text>
                    </Text>
                  ) : (
                    <Text style={[styles.footerPriceVal, { color: BRAND }]}>
                      ₱{Number(laborFeePhp || 3250).toLocaleString()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.footerPriceSub, { color: SUBTLE }]}>
                  Pay at shop pitstop
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={[styles.footerActionsRow, isMobile && styles.footerActionsRowMobile]}>
                {onWishlist ? (
                  <TouchableOpacity
                    style={[
                      styles.wishlistBtn,
                      {
                        borderColor: isDarkMode ? '#34463F' : '#CBD5E1',
                        backgroundColor: isDarkMode ? '#1C2622' : '#FFFFFF',
                      },
                    ]}
                    onPress={() => !busy && onWishlist()}
                    disabled={busy}
                    activeOpacity={0.8}
                    accessibilityLabel="Save build to wishlist"
                  >
                    <BootstrapIcon name="heart" size={14} color={BRAND} />
                    <Text style={[styles.wishlistBtnText, { color: INK }]}>Wishlist</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: BRAND,
                      opacity: busy || !isPhoneValid ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleConfirmPress}
                  disabled={busy || !isPhoneValid}
                  activeOpacity={0.85}
                  accessibilityLabel="Confirm motorcycle installation booking"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : (
                    <BootstrapIcon
                      name="calendar-check"
                      size={15}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text style={styles.confirmBtnText}>
                    {busy ? 'Booking…' : 'Confirm Booking'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? 16 : 0,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  sheet: {
    width: '100%',
    maxHeight: Platform.select({ web: '88vh', default: '88%' }),
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.25)',
      },
      default: {
        elevation: 10,
      },
    }),
  },

  // 1. Fixed Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Scroll Area
  scrollArea: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 18,
  },

  // Alerts
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#B91C1C',
  },

  // Summary Card
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 175,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderBottomWidth: 1,
    position: 'relative',
  },
  motorcycleImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  imageOverlayBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  summaryInfoCol: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  bikeModelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  bikeModelText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  summaryPriceCol: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  priceSublabel: {
    fontSize: 11,
    marginTop: 1,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#065F46',
  },
  feeNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  feeNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },

  // Sections
  sectionBlock: {
    gap: 10,
  },
  sectionHeadingRow: {
    gap: 2,
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 11.5,
  },

  // Location Card
  locationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  locationTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationName: {
    fontSize: 13,
    flex: 1,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  selectedBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#166534',
  },
  unselectedIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  locationAddress: {
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 34,
  },
  locationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 34,
    marginTop: 2,
  },
  locationMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationMetaText: {
    fontSize: 11,
  },

  // Slots Grid
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minWidth: '47%',
    flexGrow: 1,
  },
  slotButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  slotText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  bookedTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookedTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },

  // Fields
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 10, android: 8, default: 8 }),
    gap: 8,
  },
  inputIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  fieldHelperText: {
    fontSize: 11,
  },
  fieldErrorText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#DC2626',
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textAreaField: {
    fontSize: 12.5,
    minHeight: 56,
    textAlignVertical: 'top',
    padding: 0,
  },

  // 3. Fixed Footer
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    flexShrink: 0,
  },
  footerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  footerContentCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  footerPriceBlock: {
    gap: 2,
  },
  footerPriceLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footerPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  footerPriceVal: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  footerPriceSub: {
    fontSize: 10.5,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerActionsRowMobile: {
    justifyContent: 'space-between',
    width: '100%',
  },
  wishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 14,
    minWidth: 95,
  },
  wishlistBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 18,
    minWidth: 150,
    flexGrow: 1,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
});
