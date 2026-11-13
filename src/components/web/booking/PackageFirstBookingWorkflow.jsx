// =========================================================================
// MotoTrack - Minimalist, Premium Motorcycle Service-Booking Web App
// Warm off-white background, clean white cards, charcoal typography,
// subtle gray borders, and restrained orange accent.
// =========================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import {
  PACKAGE_CATEGORIES,
  calculatePackagePriceForCc,
  getPackageStartingPrice,
  formatLiveAdminPackage,
  isExcludedLegacyPackage,
} from './bookingPackagesData.js';
import BookingProgressIndicator from './BookingProgressIndicator.jsx';
import PackageCard from './PackageCard.jsx';
import PackageDetailsModal from './PackageDetailsModal.jsx';
import AdminPackageEditorModal from './AdminPackageEditorModal.jsx';
import CustomerMotorcyclesModal from './CustomerMotorcyclesModal.jsx';
import CustomerInformationScreen from './CustomerInformationScreen.jsx';
import BookingInformationScreen from './BookingInformationScreen.jsx';
import BookingReviewScreen from './BookingReviewScreen.jsx';
import BookingPaymentScreen from './BookingPaymentScreen.jsx';
import BookingSuccessScreen from './BookingSuccessScreen.jsx';
import { garageService } from '../../../services/bookings/garageService.js';
import { xenditPaymentService } from '../../../services/payments/xenditPaymentService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { pmsPricingService } from '../../../services/bookings/pmsPricingService.js';
import { DEFAULT_PMS_SERVICES } from '../../../utils/pmsCcPricing.js';
import { motorcycleService } from '../../../services/products/motorcycleService.js';

export default function PackageFirstBookingWorkflow({
  currentUser,
  garageMotorcycles = [],
  existingBookings = [],
  onAddNewMotorcycle: _onAddNewMotorcycle,
  onBookingCreated,
  onViewBookingDetails,
  onNavigateToAppointments,
  onNavigateToLogin: _onNavigateToLogin,
  onNavigateToStore: _onNavigateToStore,
  showToast,
  defaultSelectedPackageId = null,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
}) {
  // ─── STEPPER STATE (4 CLEAN STEPS) ───
  // Step 1: Choose Service
  // Step 2: Rider Info & Motorcycle
  // Step 3: Schedule & Venue
  // Step 4: Review Booking
  // Step 5: Downpayment Checkout
  // Step 6: Success
  const [currentStep, setCurrentStep] = useState(1);
  const [downpaymentData, setDownpaymentData] = useState(null);

  // ─── SEARCH & FILTER STATE ───
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const isSearchControlled = typeof onSearchQueryChange === 'function';
  const searchQuery = isSearchControlled ? (externalSearchQuery ?? '') : internalSearchQuery;

  const setSearchQuery = (val) => {
    if (isSearchControlled) {
      onSearchQueryChange(val);
    } else {
      setInternalSearchQuery(val);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState('all');

  // If user starts searching from the header while on later steps, return to Step 1 (Choose Service)
  useEffect(() => {
    if (searchQuery && searchQuery.trim() && currentStep > 1) {
      setCurrentStep(1);
    }
  }, [searchQuery, currentStep]);

  // ─── PACKAGES SELECTION STATE ───
  const [selectedPackageIds, setSelectedPackageIds] = useState(
    defaultSelectedPackageId ? [defaultSelectedPackageId] : []
  );
  const [detailModalPackage, setDetailModalPackage] = useState(null);
  const [editingAdminPackage, setEditingAdminPackage] = useState(null);
  const isAdmin = currentUser?.role === 'admin';
  const [packagesCatalog, setPackagesCatalog] = useState(() => {
    try {
      const cached = pmsPricingService.getCachedCatalog?.();
      const services = cached?.services?.length ? cached.services : DEFAULT_PMS_SERVICES;
      return services
        .filter((s) => s && s.isActive !== false && !isExcludedLegacyPackage(s))
        .map((s) => formatLiveAdminPackage(s))
        .filter(Boolean);
    } catch (_e) {
      return DEFAULT_PMS_SERVICES.map((s) => formatLiveAdminPackage(s)).filter(Boolean);
    }
  });

  // ─── MOTORCYCLE STATE (STEP 2: AUTO-BINDS TO PRIMARY MOTORCYCLE) ───
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState('');
  const [isChangeBikeModalOpen, setIsChangeBikeModalOpen] = useState(false);

  // ─── CUSTOMER CONTACT INFORMATION (STEP 2) ───
  const [firstName, setFirstName] = useState(() => {
    if (currentUser?.firstName) return currentUser.firstName;
    const parts = String(currentUser?.name || currentUser?.fullName || '').trim().split(' ');
    return parts[0] || 'Jherico';
  });
  const [lastName, setLastName] = useState(() => {
    if (currentUser?.lastName) return currentUser.lastName;
    const parts = String(currentUser?.name || currentUser?.fullName || '').trim().split(' ');
    return parts.slice(1).join(' ') || 'Maurin';
  });
  const [mobileNumber, setMobileNumber] = useState(
    () => currentUser?.phone || currentUser?.mobile || '09614904841'
  );
  const [email, setEmail] = useState(
    () => currentUser?.email || 'jhericomaurin67@gmail.com'
  );
  const [socialMedia, setSocialMedia] = useState(
    () => currentUser?.socialMedia || currentUser?.social_media || 'N/A'
  );

  // ─── SCHEDULE & INFO STATE (STEP 3) ───
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [motorcyclePhotos, setMotorcyclePhotos] = useState([]);

  // ─── PAYMENT STATE (STEP 4) ───
  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [gcashNumber] = useState(currentUser?.phone || '0917-882-9102');
  const [gcashReference] = useState(
    () => 'MP-GCASH-' + Math.floor(100000 + Math.random() * 900000)
  );

  // ─── SUBMISSION STATE ───
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBookingResult, setSubmittedBookingResult] = useState(null);

  // Live catalog from pmsPricingService (Admin Services Packages Catalog strictly - 22 packages)
  useEffect(() => {
    let isMounted = true;

    const loadLiveCatalog = async () => {
      try {
        const pmsCatalog = await pmsPricingService
          .loadCatalog({ forceRefresh: true })
          .catch(() => null);

        if (!isMounted) return;

        // Strictly the Admin Services Packages Catalog from Admin Console
        const pmsServices = (pmsCatalog?.services?.length ? pmsCatalog.services : DEFAULT_PMS_SERVICES)
          .filter((s) => s && s.isActive !== false && !isExcludedLegacyPackage(s));

        const formatted = pmsServices.map((s) => formatLiveAdminPackage(s)).filter(Boolean);

        if (formatted.length > 0) {
          setPackagesCatalog(formatted);
        }
      } catch (err) {
        console.warn('[PackageFirstBooking] Error loading live admin catalog:', err);
      }
    };

    loadLiveCatalog();

    // Subscribe to both pmsPricingService and garageService changes
    const unsubPms = pmsPricingService.subscribe?.(() => {
      loadLiveCatalog();
    });
    const unsubGarage = garageService.subscribe(() => {
      loadLiveCatalog();
    });

    const handleStorage = (e) => {
      if (
        e.key === 'pms_cc_pricing_catalog_v2' ||
        e.key === 'pms_cc_pricing_catalog_v2_all' ||
        e.key === 'mototrack_garage_services_list'
      ) {
        loadLiveCatalog();
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      isMounted = false;
      try { unsubPms?.(); } catch (_e) { }
      try { unsubGarage?.(); } catch (_e) { }
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, []);

  // Live sync with motorcycleService for real-time reactivity when primary bike is updated
  useEffect(() => {
    let unsub = () => { };
    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsub = motorcycleService.subscribe((updatedBikes) => {
          const userBikes = currentUser
            ? motorcycleService.getMotorcycles(currentUser)
            : updatedBikes;
          if (Array.isArray(userBikes) && userBikes.length > 0) {
            const newPrimary = userBikes.find((m) => m.is_primary) || userBikes[0];
            if (newPrimary) {
              const newId = newPrimary.motorcycle_id || newPrimary.id;
              setSelectedMotorcycleId(newId);
            }
          }
        });
      }
    } catch (_e) { }

    return () => {
      try { unsub(); } catch (_e) { }
    };
  }, [currentUser]);

  // Combined list of user's garage motorcycles
  const allMotorcycles = useMemo(() => {
    let list = [];
    if (Array.isArray(garageMotorcycles) && garageMotorcycles.length > 0) {
      list = [...garageMotorcycles];
    } else if (currentUser) {
      try {
        list = motorcycleService.getMotorcycles(currentUser) || [];
      } catch (_e) {
        list = [];
      }
    }
    if (list.length === 0 && currentUser) {
      try {
        list = motorcycleService.getAllMotorcycles() || [];
      } catch (_e) { }
    }
    if (list.length === 0) {
      list = [
        {
          motorcycle_id: 'moto-adv160-default',
          brand: 'Honda',
          model: 'ADV 160',
          engine_cc: 160,
          plate_number: 'N/A-RJCX',
          year: 2024,
          is_primary: true,
        },
      ];
    }
    return list;
  }, [garageMotorcycles, currentUser]);

  // Primary motorcycle in fleet
  const primaryMotorcycle = useMemo(() => {
    if (!allMotorcycles || allMotorcycles.length === 0) return null;
    return allMotorcycles.find((m) => m.is_primary) || allMotorcycles[0] || null;
  }, [allMotorcycles]);

  // Ref to track last seen primary bike ID so we detect when user switches primary
  const prevPrimaryBikeIdRef = useRef(primaryMotorcycle?.motorcycle_id || primaryMotorcycle?.id || null);

  // Sync selectedMotorcycleId whenever primary motorcycle changes or on initial load
  useEffect(() => {
    const currentPrimaryId = primaryMotorcycle?.motorcycle_id || primaryMotorcycle?.id || null;
    if (currentPrimaryId && currentPrimaryId !== prevPrimaryBikeIdRef.current) {
      prevPrimaryBikeIdRef.current = currentPrimaryId;
      setSelectedMotorcycleId(currentPrimaryId);
    } else if (!selectedMotorcycleId && currentPrimaryId) {
      prevPrimaryBikeIdRef.current = currentPrimaryId;
      setSelectedMotorcycleId(currentPrimaryId);
    }
  }, [primaryMotorcycle, selectedMotorcycleId]);

  // Selected motorcycle object
  const selectedMotorcycle = useMemo(() => {
    if (!allMotorcycles || allMotorcycles.length === 0) return null;
    const found = allMotorcycles.find(
      (m) => (m.motorcycle_id || m.id) === selectedMotorcycleId
    );
    return found || primaryMotorcycle || allMotorcycles[0] || null;
  }, [allMotorcycles, selectedMotorcycleId, primaryMotorcycle]);

  // Selected packages objects
  const selectedPackages = useMemo(() => {
    return packagesCatalog.filter((p) => selectedPackageIds.includes(p.id));
  }, [packagesCatalog, selectedPackageIds]);

  // Filter packages based on category & search query
  const filteredPackages = useMemo(() => {
    return packagesCatalog.filter((pkg) => {
      // Category filter
      if (selectedCategory !== 'all' && pkg.category !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (pkg.name || '').toLowerCase().includes(query);
        const matchesDesc = (pkg.description || '').toLowerCase().includes(query);
        const matchesShort = (pkg.shortDescription || '').toLowerCase().includes(query);
        const matchesInclusions = (pkg.inclusions || []).some((inc) =>
          (inc || '').toLowerCase().includes(query)
        );
        const matchesCategory = (pkg.category || '').toLowerCase().includes(query);
        const matchesBadge = (pkg.badge || '').toLowerCase().includes(query);
        return (
          matchesName ||
          matchesDesc ||
          matchesShort ||
          matchesInclusions ||
          matchesCategory ||
          matchesBadge
        );
      }
      return true;
    });
  }, [packagesCatalog, selectedCategory, searchQuery]);

  // ─── SWITCH & REGISTER PRIMARY MOTORCYCLE (DYNAMIC CC RATES) ───
  const handleSelectMotorcycle = async (bike) => {
    if (!bike) return;
    const bikeId = bike.motorcycle_id || bike.id;
    const rawCc =
      bike.engine_displacement ??
      bike.engine_cc ??
      bike.engineCc ??
      bike.cc ??
      parseInt((bike.model || '').match(/\b(\d{2,4})\b/)?.[1] || '150', 10);
    const bikeCc = parseInt(rawCc, 10) || 150;

    // Immediately update active selected bike in workflow
    setSelectedMotorcycleId(bikeId);

    // Automatically make this motorcycle the customer's primary bike
    try {
      const uid = currentUser?.id || currentUser?.user_id;
      const uemail = currentUser?.email;
      await motorcycleService.setPrimaryMotorcycle(bikeId, uid, uemail);
      if (bike.motorcycle_id) {
        await motorcycleService.updateMotorcycle(bike.motorcycle_id, { is_primary: true });
      }
    } catch (err) {
      console.warn('[PackageFirstBookingWorkflow] Error persisting primary bike:', err);
    }

    showToast?.(`✓ ${bike.brand} ${bike.model} (${bikeCc} CC) set as primary ride. Package rates updated!`);
    setIsChangeBikeModalOpen(false);
  };

  const handleAddNewMotorcycle = async (newBikeData) => {
    const uid = currentUser?.id || currentUser?.user_id || 'usr-rider-01';
    const uemail = currentUser?.email || 'jhericomaurin67@gmail.com';
    const res = await motorcycleService.addMotorcycle({
      ...newBikeData,
      user_id: uid,
      customer_email: uemail,
      is_primary: true,
    });

    if (res?.success && res?.motorcycle) {
      const newBikeId = res.motorcycle.motorcycle_id || res.motorcycle.id;
      setSelectedMotorcycleId(newBikeId);
      const cc = res.motorcycle.engine_cc || newBikeData.engine_cc;
      showToast?.(`✓ Registered ${res.motorcycle.brand} ${res.motorcycle.model} (${cc} CC) as primary bike! Service rates updated.`);
      setIsChangeBikeModalOpen(false);
    } else {
      throw new Error(res?.warning || 'Could not register motorcycle.');
    }
  };

  // Display all active packages matching category and search query
  const displayPackages = useMemo(() => {
    return filteredPackages;
  }, [filteredPackages]);

  // ─── AUTOMATIC CC-BASED PRICING DATA ───
  const pricingData = useMemo(() => {
    const rawCc =
      selectedMotorcycle?.engine_displacement ??
      selectedMotorcycle?.engine_cc ??
      selectedMotorcycle?.engineCc ??
      selectedMotorcycle?.cc ??
      parseInt((selectedMotorcycle?.model || '').match(/\b(\d{2,4})\b/)?.[1] || '0', 10);
    const engineCc = parseInt(rawCc, 10) || 0;

    let matchedCategory = '125cc and below';
    let matchedCategoryId = 'cc-125-below';
    if (engineCc <= 125) {
      matchedCategory = '125cc and below';
      matchedCategoryId = 'cc-125-below';
    } else if (engineCc < 200) {
      matchedCategory = '150cc–160cc';
      matchedCategoryId = 'cc-150-160';
    } else {
      matchedCategory = 'Big Bikes (200cc+)';
      matchedCategoryId = 'cc-big-bikes';
    }

    const items = selectedPackages.map((pkg) => {
      const calc = engineCc > 0
        ? calculatePackagePriceForCc(pkg, engineCc)
        : {
          price: getPackageStartingPrice(pkg),
          tierLabel: 'Starting rate',
          tierId: 'default',
          isExact: false,
        };
      const price = calc?.price ?? getPackageStartingPrice(pkg);
      return {
        pkg,
        price,
        tierLabel: calc?.tierLabel || (engineCc > 0 ? matchedCategory : 'Standard Rate'),
        tierId: calc?.tierId || matchedCategoryId,
        isAvailable: calc?.isAvailable !== false,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const adminSettings = systemSettingsService.getSettings();
    const adminDpPct = Number.isFinite(Number(adminSettings?.downpaymentPercent)) ? Number(adminSettings.downpaymentPercent) : 20;
    const downpaymentAmount = Math.round(subtotal * (adminDpPct / 100));
    const balanceRemaining = subtotal - downpaymentAmount;

    return {
      items,
      subtotal,
      downpaymentAmount,
      balanceRemaining,
      matchedCategory: engineCc > 0 ? matchedCategory : 'Standard Rate',
      matchedCategoryId,
      engineCc: engineCc > 0 ? engineCc : null,
    };
  }, [selectedPackages, selectedMotorcycle]);

  const selectedPackagesSubtotal = pricingData.subtotal;

  // Toggle package selection helper: selects and advances to next step, or unselects if already selected
  const handleTogglePackage = (pkgId) => {
    if (!pkgId) return;
    if (selectedPackageIds.includes(pkgId)) {
      setSelectedPackageIds((prev) => prev.filter((id) => id !== pkgId));
    } else {
      setSelectedPackageIds([pkgId]);
      setCurrentStep(2);
    }
  };

  // ─── FINAL BOOKING SUBMISSION ───
  const handleConfirmBooking = async (paymentDetails) => {
    if (!selectedPackages.length || !selectedMotorcycle) {
      showToast?.('Please ensure package(s) and motorcycle are selected.');
      return;
    }

    setIsSubmitting(true);
    try {
      const bikeBrand = selectedMotorcycle.brand || 'Motorcycle';
      const bikeModel = selectedMotorcycle.model || '';
      const plateNumber = selectedMotorcycle.plate_number || 'TEMP-PLATE';
      const engineCc = Number(
        selectedMotorcycle.engine_displacement || selectedMotorcycle.engine_cc || 150
      );

      const calculatedSubtotal = pricingData?.subtotal ?? selectedPackagesSubtotal;
      const adminSettings = systemSettingsService.getSettings();
      const adminDpPct = Number.isFinite(Number(adminSettings?.downpaymentPercent)) ? Number(adminSettings.downpaymentPercent) : 20;
      const downpaymentPercent = paymentDetails?.downpaymentPercent ?? adminDpPct;
      const downpayment = paymentDetails?.downpaymentAmount ?? Math.round(calculatedSubtotal * (downpaymentPercent / 100));
      const remainingBalance = paymentDetails?.remainingBalance ?? Math.max(0, calculatedSubtotal - downpayment);
      const chosenPaymentMethod = paymentDetails?.paymentMethod || paymentMethod || 'GCash';

      const bookingPayload = {
        booking_mode: 'package',
        category: 'PMS',
        service_type: selectedPackages[0]?.category || 'PMS',
        service_ids: selectedPackages.map((p) => p.id),
        selected_service_ids: selectedPackages.map((p) => p.id),
        package_id: selectedPackages[0]?.id,
        package_name: selectedPackages.map((p) => p.name).join(', '),
        service_title: selectedPackages.map((p) => p.name).join(', '),
        package_price: calculatedSubtotal,
        pricePhp: calculatedSubtotal,
        labor_subtotal: calculatedSubtotal,
        estimated_total: calculatedSubtotal,
        total_amount: calculatedSubtotal,
        downpayment_amount: downpayment,
        downpayment_percent: downpaymentPercent,
        remaining_balance: remainingBalance,
        downpayment_required: true,
        downpayment_status: 'Paid',
        downpayment_paid: true,
        amount_paid: downpayment,
        downpayment_paid_at: new Date().toISOString(),
        downpayment_channel: paymentDetails?.paymentMethod || paymentMethod,
        downpayment_method: paymentDetails?.paymentMethod || paymentMethod,
        downpayment_ref: paymentDetails?.transactionRef || (paymentMethod === 'GCash' ? gcashReference : null),
        payment_method: paymentDetails?.paymentMethod || paymentMethod,
        payment_status: 'DOWNPAYMENT_PAID',
        deposit_paid: true,
        transaction_ref: paymentDetails?.transactionRef || null,
        motorcycle_id: selectedMotorcycle.motorcycle_id || selectedMotorcycle.id,
        motorcycle_cc: engineCc,
        cc_category_id:
          pricingData?.matchedCategory ||
          (engineCc <= 125 ? 'cc-125-below' : engineCc <= 160 ? 'cc-150-160' : 'cc-big-bikes'),
        cc_category_name: pricingData?.matchedCategory || `${engineCc}cc`,
        bike_brand: bikeBrand,
        bike_model: bikeModel,
        plate_number: plateNumber,
        scheduled_date: preferredDate,
        appointment_date: preferredDate,
        preferred_time_slot: preferredTimeSlot,
        appointment_time: preferredTimeSlot,
        customer_notes: customerNotes,
        additional_notes: customerNotes,
        photos: motorcyclePhotos,
        status: 'Reserved',
        user_id: currentUser?.id || currentUser?.user_id,
        customer_name: `${firstName} ${lastName}`.trim() || currentUser?.name || currentUser?.fullName || 'Valued Customer',
        customer_email: email || currentUser?.email || '',
        customer_phone: mobileNumber || currentUser?.phone || '',
        social_media: socialMedia,
      };

      const result = await garageService.addBooking(bookingPayload);
      if (result && (result.id || result.booking_id)) {
        const createdBookingId = result.id || result.booking_id;
        const finalBooking = {
          ...bookingPayload,
          ...result,
          bookingReference: createdBookingId,
        };

        // Record the transaction in Supabase payments table linked to the created booking
        try {
          await xenditPaymentService.recordPaymentTransaction({
            bookingId: createdBookingId,
            customerId: bookingPayload.user_id,
            amount: downpayment,
            paymentMethod: chosenPaymentMethod,
            referenceNumber: paymentDetails?.transactionRef || (chosenPaymentMethod.includes('GCash') ? gcashReference : `XND-${Date.now()}`),
            transactionRef: paymentDetails?.transactionRef,
            status: 'Completed',
            notes: `Downpayment for booking #${createdBookingId} via ${chosenPaymentMethod}`,
          });
        } catch (dbErr) {
          console.warn('[PackageFirstBookingWorkflow] Database payment log notice:', dbErr);
        }

        setSubmittedBookingResult(finalBooking);
        onBookingCreated?.(finalBooking);
        setCurrentStep(6); // Show success screen
        showToast?.('Downpayment processed! Your slot is guaranteed.');
      } else {
        throw new Error(result?.error || 'Could not save service booking.');
      }
    } catch (err) {
      console.error('[PackageFirstBooking] Submission error:', err);
      showToast?.(err.message || 'Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', minHeight: '100vh', width: '100%' }}>
      {/* ─── 1. HORIZONTAL 5-STEP BOOKING PROGRESS INDICATOR ─── */}
      {currentStep <= 5 && (
        <BookingProgressIndicator
          currentStep={currentStep}
          onStepClick={(stepId) => {
            if (stepId === 1) setCurrentStep(1);
            else if (stepId === 2 && selectedPackageIds.length > 0) setCurrentStep(2);
            else if (stepId === 3 && firstName.trim() && lastName.trim() && mobileNumber.trim()) setCurrentStep(3);
            else if (stepId === 4 && preferredDate && preferredTimeSlot) setCurrentStep(4);
            else if (stepId === 5 && preferredDate && preferredTimeSlot) setCurrentStep(5);
          }}
          canNavigateToStep={(stepId) => {
            if (stepId === 1) return true;
            if (stepId === 2) return selectedPackageIds.length > 0;
            if (stepId === 3) return selectedPackageIds.length > 0 && !!firstName.trim() && !!lastName.trim();
            if (stepId === 4) return selectedPackageIds.length > 0 && !!preferredDate && !!preferredTimeSlot;
            if (stepId === 5) return selectedPackageIds.length > 0 && !!preferredDate && !!preferredTimeSlot;
            return false;
          }}
        />
      )}

      {/* ─── MAIN CONTENT AREA ─── */}
      <View
        id="services-section"
        style={[styles.workflowContainer, { paddingTop: 0, paddingBottom: 100 }]}
      >
        {/* ─── STEP 1: CHOOSE SERVICE (WHAT DOES YOUR BIKE NEED?) ─── */}
        {currentStep === 1 && (
          <View>
            <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '800',
                  color: '#18181B',
                  letterSpacing: -0.6,
                  marginBottom: 6,
                  textAlign: 'center',
                }}
              >
                What does your bike need?
              </Text>
              <Text
                style={{
                  fontSize: 14.5,
                  color: '#52525B',
                  maxWidth: 580,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                Explore our available service packages for your motorcycle. Select one or more packages to begin your booking.
              </Text>
            </View>

            {/* ─── ROUNDED CATEGORY FILTERS ─── */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 28,
              }}
            >
              {PACKAGE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                const count =
                  cat.id === 'all'
                    ? packagesCatalog.length
                    : packagesCatalog.filter((p) => p.category === cat.id).length;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: isActive ? '#1E2227' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isActive ? '#1E2227' : '#E4E4E7',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon
                      name={cat.icon}
                      size={12}
                      color={isActive ? '#FFFFFF' : '#71717A'}
                    />
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: isActive ? '700' : '500',
                        color: isActive ? '#FFFFFF' : '#52525B',
                      }}
                    >
                      {cat.label}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 8,
                        backgroundColor: isActive ? '#EA580C' : '#F4F4F5',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '700',
                          color: isActive ? '#FFFFFF' : '#71717A',
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* ─── VIEW BOOKING BUTTON (BESIDE PMS & REPAIR) ─── */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#EA580C',
                  cursor: 'pointer',
                  shadowColor: '#EA580C',
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 1 },
                }}
                onPress={() => {
                  if (onNavigateToAppointments) {
                    onNavigateToAppointments();
                  } else if (onViewBookingDetails) {
                    onViewBookingDetails();
                  }
                }}
                activeOpacity={0.8}
                title="View Appointments & Bookings"
              >
                <BootstrapIcon
                  name="calendar-check"
                  size={12}
                  color="#EA580C"
                />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: '#EA580C',
                  }}
                >
                  View Booking
                </Text>
                {existingBookings.length > 0 && (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 8,
                      backgroundColor: '#EA580C',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '700',
                        color: '#FFFFFF',
                      }}
                    >
                      {existingBookings.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Active Motorcycle CC Pricing Indicator Banner */}
            {selectedMotorcycle && (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  marginBottom: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="speedometer" size={15} color="#EA580C" />
                  <Text style={{ fontSize: 13, color: '#18181B' }}>
                    Showing package rates for <Text style={{ fontWeight: '700' }}>{selectedMotorcycle.brand} {selectedMotorcycle.model}</Text>{' '}
                    (<Text style={{ fontWeight: '700', color: '#EA580C' }}>{pricingData.engineCc} CC • {pricingData.matchedCategory}</Text>)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsChangeBikeModalOpen(true)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: '#FFF7ED',
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
                    Change Bike
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── ACTIVE SEARCH FILTER STATUS BAR ─── */}
            {searchQuery.trim() ? (
              <View
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                  <BootstrapIcon name="search" size={13} color="#FF5A0A" />
                  <Text style={{ fontSize: 13, color: '#334155' }}>
                    Showing results for <Text style={{ fontWeight: '700', color: '#0F172A' }}>"{searchQuery}"</Text>{' '}
                    • <Text style={{ fontWeight: '600', color: '#FF5A0A' }}>{displayPackages.length} package{displayPackages.length === 1 ? '' : 's'}</Text> found
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    cursor: 'pointer',
                  }}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="x" size={14} color="#64748B" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Clear Search</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ─── DISPLAY RESPONSIVE SERVICE CARDS ─── */}
            {isAdmin && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#EA580C',
                    cursor: 'pointer',
                  }}
                  onPress={() => {
                    setEditingAdminPackage({
                      id: 'pkg-' + Date.now().toString(36),
                      title: '',
                      category: 'PMS',
                      duration: '45 mins',
                      badge: 'Popular',
                      image: '',
                      description: '',
                      inclusions: [],
                      prices: { 'cc-125-below': 1200, 'cc-150-160': 1500, 'cc-big-bikes': 1800 },
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>
                    Add Service Package
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {displayPackages.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E4E4E7',
                  padding: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginVertical: 20,
                  gap: 8,
                }}
              >
                <BootstrapIcon name="tools" size={30} color="#D4D4D8" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181B' }}>
                  {searchQuery ? 'No services match your search' : 'No service packages available'}
                </Text>
                <Text style={{ fontSize: 13, color: '#71717A', textAlign: 'center', maxWidth: 420 }}>
                  {searchQuery
                    ? 'Try different keywords or clear your category filter.'
                    : isAdmin
                      ? 'No service packages exist in your catalog yet. Click below to add your first customer booking package.'
                      : 'Our garage service packages are currently being updated. Please check back shortly.'}
                </Text>
                {searchQuery ? (
                  <TouchableOpacity
                    style={{
                      marginTop: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: '#1E2227',
                    }}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' }}>
                      Reset Filters
                    </Text>
                  </TouchableOpacity>
                ) : isAdmin ? (
                  <TouchableOpacity
                    style={{
                      marginTop: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 8,
                      backgroundColor: '#EA580C',
                    }}
                    onPress={() => {
                      setEditingAdminPackage({
                        id: 'pkg-' + Date.now().toString(36),
                        title: '',
                        category: 'PMS',
                        duration: '45 mins',
                        badge: 'Popular',
                        image: '',
                        description: '',
                        inclusions: [],
                        prices: { 'cc-125-below': 1200, 'cc-150-160': 1500, 'cc-big-bikes': 1800 },
                      });
                    }}
                  >
                    <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                      Add Service Package
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                  gap: 24,
                  marginBottom: 32,
                }}
              >
                {displayPackages.map((pkg) => {
                  const rawCc =
                    selectedMotorcycle?.engine_displacement ??
                    selectedMotorcycle?.engine_cc ??
                    selectedMotorcycle?.engineCc ??
                    selectedMotorcycle?.cc;
                  const engineCc = parseInt(rawCc, 10) || 0;
                  const ccCalc = engineCc > 0 ? calculatePackagePriceForCc(pkg, engineCc) : null;
                  return (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      isSelected={selectedPackageIds.includes(pkg.id)}
                      onToggleSelect={() => handleTogglePackage(pkg.id)}
                      onViewDetails={() => setDetailModalPackage(pkg)}
                      selectedMotorcycle={selectedMotorcycle}
                      matchedPrice={ccCalc?.price}
                      isAdmin={isAdmin}
                      onEditPackage={setEditingAdminPackage}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ─── STEP 2: CUSTOMER INFORMATION & SYMPTOMS (PRIMARY MOTORCYCLE AUTO-SELECTED) ─── */}
        {currentStep === 2 && (
          <CustomerInformationScreen
            primaryMotorcycle={primaryMotorcycle}
            selectedMotorcycle={selectedMotorcycle}
            selectedPackages={selectedPackages}
            pricingData={pricingData}
            currentUser={currentUser}
            firstName={firstName}
            onFirstNameChange={setFirstName}
            lastName={lastName}
            onLastNameChange={setLastName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            email={email}
            onEmailChange={setEmail}
            socialMedia={socialMedia}
            onSocialMediaChange={setSocialMedia}
            customerNotes={customerNotes}
            onCustomerNotesChange={setCustomerNotes}
            motorcyclePhotos={motorcyclePhotos}
            onPhotosChange={setMotorcyclePhotos}
            onBack={() => setCurrentStep(1)}
            onContinue={() => setCurrentStep(3)}
            showToast={showToast}
          />
        )}

        {/* ─── STEP 3: SCHEDULE & APPOINTMENT DETAILS ─── */}
        {currentStep === 3 && (
          <BookingInformationScreen
            selectedPackages={selectedPackages}
            selectedMotorcycle={selectedMotorcycle}
            preferredDate={preferredDate}
            onDateChange={setPreferredDate}
            preferredTimeSlot={preferredTimeSlot}
            onTimeSlotChange={setPreferredTimeSlot}
            customerNotes={customerNotes}
            onNotesChange={setCustomerNotes}
            motorcyclePhotos={motorcyclePhotos}
            onPhotosChange={setMotorcyclePhotos}
            currentUser={currentUser}
            onBack={() => setCurrentStep(2)}
            onContinue={() => setCurrentStep(4)}
            showToast={showToast}
          />
        )}

        {/* ─── STEP 4: REVIEW BOOKING ─── */}
        {currentStep === 4 && (
          <BookingReviewScreen
            currentUser={currentUser}
            firstName={firstName}
            lastName={lastName}
            mobileNumber={mobileNumber}
            email={email}
            socialMedia={socialMedia}
            selectedMotorcycle={selectedMotorcycle}
            selectedPackages={selectedPackages}
            pricingData={pricingData}
            preferredDate={preferredDate}
            preferredTimeSlot={preferredTimeSlot}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            gcashNumber={gcashNumber}
            gcashReference={gcashReference}
            customerNotes={customerNotes}
            motorcyclePhotos={motorcyclePhotos}
            isSubmitting={isSubmitting}
            onBack={() => setCurrentStep(3)}
            onProceedToPayment={(dpData) => {
              setDownpaymentData(dpData);
              setCurrentStep(5);
            }}
            onConfirmBooking={(dpData) => {
              setDownpaymentData(dpData);
              setCurrentStep(5);
            }}
            onConfirm={(dpData) => {
              setDownpaymentData(dpData);
              setCurrentStep(5);
            }}
            onEditSection={(sectionKey) => {
              if (sectionKey === 'packages' || sectionKey === 1 || sectionKey === 0) setCurrentStep(1);
              else if (sectionKey === 'motorcycle' || sectionKey === 2 || sectionKey === 'riderInfo') setCurrentStep(2);
              else if (sectionKey === 'schedule' || sectionKey === 3) setCurrentStep(3);
            }}
          />
        )}

        {/* ─── STEP 5: DOWNPAYMENT CHECKOUT ─── */}
        {currentStep === 5 && (
          <BookingPaymentScreen
            currentUser={currentUser}
            firstName={firstName}
            lastName={lastName}
            mobileNumber={mobileNumber}
            email={email}
            selectedMotorcycle={selectedMotorcycle}
            selectedPackages={selectedPackages}
            pricingData={pricingData}
            preferredDate={preferredDate}
            preferredTimeSlot={preferredTimeSlot}
            downpaymentData={downpaymentData}
            isSubmitting={isSubmitting}
            onBack={() => setCurrentStep(4)}
            onCompletePayment={handleConfirmBooking}
            showToast={showToast}
          />
        )}

        {/* ─── STEP 6: BOOKING SUCCESS ─── */}
        {currentStep === 6 && submittedBookingResult && (
          <BookingSuccessScreen
            bookingResult={submittedBookingResult}
            selectedMotorcycle={selectedMotorcycle}
            selectedPackages={selectedPackages}
            pricingData={pricingData}
            preferredDate={preferredDate}
            preferredTimeSlot={preferredTimeSlot}
            paymentMethod={paymentMethod}
            onViewDetails={() => onViewBookingDetails?.(submittedBookingResult)}
            onBookAnother={() => {
              setSelectedPackageIds([]);
              setCurrentStep(1);
            }}
          />
        )}
      </View>



      {/* ─── SERVICE DETAIL MODAL ─── */}
      <PackageDetailsModal
        visible={!!detailModalPackage}
        pkg={detailModalPackage}
        isSelected={detailModalPackage && selectedPackageIds.includes(detailModalPackage.id)}
        onToggleSelect={() => {
          if (detailModalPackage) {
            handleTogglePackage(detailModalPackage.id);
            setDetailModalPackage(null);
          }
        }}
        onClose={() => setDetailModalPackage(null)}
        selectedMotorcycle={selectedMotorcycle}
        isAdmin={isAdmin}
        onEditPackage={setEditingAdminPackage}
      />

      {/* ─── ADMIN PACKAGE & INCLUSIONS EDITOR MODAL ─── */}
      <AdminPackageEditorModal
        visible={!!editingAdminPackage}
        pkg={editingAdminPackage}
        onClose={() => setEditingAdminPackage(null)}
        onDelete={async (pkgId) => {
          await garageService.deleteService(pkgId);
          try {
            await pmsPricingService.deleteFixedRateService?.(pkgId);
          } catch (_e) { }
          garageService.notifyListeners();
          showToast?.(`Service package removed.`);
          setEditingAdminPackage(null);
        }}
        onSave={async (updatedPkgData) => {
          if (updatedPkgData.prices) {
            const isExistingPms = (pmsPricingService.getCachedCatalog?.()?.services || []).some(
              (s) => s.id === editingAdminPackage.id
            );
            if (isExistingPms) {
              await pmsPricingService
                .updateFixedRateService(editingAdminPackage.id, {
                  name: updatedPkgData.title,
                  description: updatedPkgData.description,
                  catalogCategory: updatedPkgData.category === 'Repair' ? 'Repair' : 'PMS',
                  pricesByCategory: updatedPkgData.prices,
                })
                .catch(() => { });
            } else {
              await pmsPricingService
                .createFixedRateService({
                  name: updatedPkgData.title,
                  description: updatedPkgData.description,
                  catalogCategory: updatedPkgData.category === 'Repair' ? 'Repair' : 'PMS',
                  pricesByCategory: updatedPkgData.prices,
                })
                .catch(() => { });
            }
          }
          const isNew = !garageService.getPackageById(editingAdminPackage.id);
          if (isNew) {
            await garageService.addService(updatedPkgData);
          } else {
            await garageService.updateService(editingAdminPackage.id, updatedPkgData);
          }
          garageService.notifyListeners();
          showToast?.(`Service package "${updatedPkgData.title}" saved successfully!`);
          setEditingAdminPackage(null);
        }}
      />

      {/* ─── MODAL: SWITCH / SELECT PRIMARY MOTORCYCLE ─── */}
      <CustomerMotorcyclesModal
        visible={isChangeBikeModalOpen}
        onClose={() => setIsChangeBikeModalOpen(false)}
        motorcycles={allMotorcycles}
        selectedMotorcycleId={selectedMotorcycleId}
        onSelectMotorcycle={handleSelectMotorcycle}
        onAddNewMotorcycle={handleAddNewMotorcycle}
      />
    </View>
  );
}
