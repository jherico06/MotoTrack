import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { garageStyles as styles } from '../styles/garagePage.styles';
import {
  garageService,
  GARAGE_BRANCHES,
  TIME_SLOTS,
  REPAIR_COMMON_ISSUES,
  BOOKING_CATEGORIES,
  FIXED_GARAGE_SERVICES,
  getPackagePricePhp,
  getPackageDownpaymentPhp,
  normalizeServicePackage,
} from '../services/garageService';
import { motorcycleService } from '../services/motorcycleService';
import { BootstrapIcon, BottomNavBar, BrandLogo, BookingSelect } from '../components/common';
import { GCashPaymentModal, ConfirmModal } from '../components/modals';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

export default function GaragePage({
  currentUser: propCurrentUser,
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToOrders,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToAdmin,
  onOpenCart,
  wishlistCount: propWishlistCount,
  showToast: propShowToast,
}) {
  const auth = useAuth();
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();

  const currentUser = propCurrentUser !== undefined ? propCurrentUser : auth?.currentUser;
  const wishlistCount = propWishlistCount !== undefined ? propWishlistCount : wishlistCtx?.wishlistCount || 0;
  const showToast = propShowToast || cartCtx?.showToast || (() => {});
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 700 && windowWidth < 1024;

  const [activeFilter, setActiveFilter] = useState('Services'); // 'Services' | 'MyBookings'
  const [servicesList, setServicesList] = useState(() => garageService.getActivePackages());
  const [userBookings, setUserBookings] = useState([]);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Garage') {
      setActiveFilter('Services');
    } else if (tab === 'Dashboard') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('overview');
      }
    } else if (tab === 'Profile') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('profile');
      }
    } else if (tab === 'Customize') {
      if (onNavigateToCustomizer) onNavigateToCustomizer();
      else if (onNavigateToCustomize) onNavigateToCustomize();
      else onNavigateToStore?.();
    } else if (tab === 'Orders') {
      onNavigateToOrders ? onNavigateToOrders() : onNavigateToProfile?.('orders');
    } else if (tab === 'Favorites') {
      onNavigateToWishlist?.();
    } else if (tab === 'Admin') {
      if (currentUser?.role === 'admin') {
        onNavigateToAdmin?.();
      }
    }
  };

  // 20% Non-Refundable Downpayment Payment State
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);

  // Cancellation Confirmation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Booking Form State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(null);
  const [bookingType, setBookingType] = useState('Repair'); // 'Repair' | 'PMS'
  const [selectedRepairIssue, setSelectedRepairIssue] = useState('Engine & Transmission');

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeOdo, setBikeOdo] = useState('');
  const flagshipBranch = GARAGE_BRANCHES[0] || {
    name: 'MotoTrack Flagship Central Hub & Pit Bays',
    address: 'East Poblacion, City of Naga, Cebu (South Road Corridor)',
    phone: '(+63) 917 882 9102',
    bays: '6 Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay',
    hours: 'Mon - Sun: 8:00 AM - 6:30 PM',
  };
  const [selectedBranch, setSelectedBranch] = useState(flagshipBranch.name);
  const [garageMotorcycles, setGarageMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [bikeInfoMode, setBikeInfoMode] = useState('registered');
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState('');
  const [motorcyclePhotos, setMotorcyclePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePickPhoto = () => {
    const samplePhotos = [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=60'
    ];
    const nextPhoto = samplePhotos[motorcyclePhotos.length % samplePhotos.length];
    setMotorcyclePhotos((prev) => [...prev, nextPhoto]);
    if (showToast) showToast('📷 Motorcycle photo attached.');
  };

  const handleRemovePhoto = (idx) => {
    setMotorcyclePhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(true);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const handleSelectDate = (dateStr) => {
    if (!dateStr) return;
    setBookingDate(dateStr);
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      setCalendarViewDate(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
    }
  };

  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[1]);
  const [ownerName, setOwnerName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [ownerPhone, setOwnerPhone] = useState(currentUser?.phone || '+63 917 882 9102');
  const [serviceNotes, setServiceNotes] = useState('');

  const applyRegisteredMotorcycle = (m) => {
    if (!m) return;
    setSelectedMotorcycleId(m.motorcycle_id);
    setBikeBrand(m.brand || 'Yamaha');
    setBikeModel(m.model || '');
    setBikePlate(m.plate_number || '');
    if (m.odometer) setBikeOdo(String(m.odometer));
  };

  // Sync registered garage motorcycles from service
  useEffect(() => {
    let unsub = null;
    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsub = motorcycleService.subscribe((list) => {
          setGarageMotorcycles(currentUser ? [...list] : []);
        });
      }
      const list = currentUser ? motorcycleService.getMotorcycles(currentUser?.id) || [] : [];
      setGarageMotorcycles(list);
      if (currentUser && bikeInfoMode !== 'manual') {
        const existing = list.find((m) => m.motorcycle_id === selectedMotorcycleId);
        const nextBike = existing || list.find((m) => m.is_primary) || list[0];
        if (nextBike) applyRegisteredMotorcycle(nextBike);
      } else if (!currentUser) {
        setSelectedMotorcycleId('');
      }
    } catch (_e) {}

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [currentUser]);

  const [mechanicsData, setMechanicsData] = useState(() => garageService.getAvailableMechanics());
  const [todaySlotsData, setTodaySlotsData] = useState(() => garageService.getDaySlotAvailability());
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  const refreshAvailability = () => {
    setMechanicsData(garageService.getAvailableMechanics());
    setTodaySlotsData(garageService.getDaySlotAvailability());
  };

  const refreshServices = async () => {
    try {
      const data = await garageService.fetchServices();
      setServicesList(data || garageService.getActivePackages());
    } catch (e) {
      setServicesList(garageService.getActivePackages());
    }
  };

  const packagesForCategory = (category) => {
    const list = (servicesList || []).map((pkg) => normalizeServicePackage(pkg)).filter(Boolean);
    const cat = category === 'Repair' ? 'Repair' : 'PMS';
    return list.filter((pkg) => pkg.category === cat);
  };

  const resolveBookingPackage = (pkgOrType) => {
    if (pkgOrType && typeof pkgOrType === 'object') {
      return normalizeServicePackage(pkgOrType);
    }
    const cat = pkgOrType === 'Repair' ? 'Repair' : 'PMS';
    return packagesForCategory(cat)[0] || normalizeServicePackage(FIXED_GARAGE_SERVICES[cat] || FIXED_GARAGE_SERVICES.PMS);
  };

  // Open booking popup modal
  const handleOpenBooking = (pkgOrType) => {
    const pkg = resolveBookingPackage(pkgOrType);
    setBookingType(pkg?.category === 'Repair' ? 'Repair' : 'PMS');
    setSelectedServiceForBooking(pkg);
    const list = currentUser && Array.isArray(garageMotorcycles) ? garageMotorcycles : [];
    if (list.length > 0) {
      setBikeInfoMode('registered');
      const current = list.find((m) => m.motorcycle_id === selectedMotorcycleId) || list.find((m) => m.is_primary) || list[0];
      applyRegisteredMotorcycle(current);
    } else {
      setBikeInfoMode('manual');
      setSelectedMotorcycleId('');
    }
    setIsBookingModalOpen(true);
  };

  const refreshUserBookings = () => {
    if (currentUser?.email || currentUser?.id || currentUser?.name || currentUser?.fullName) {
      const bks = garageService.getUserBookings(
        currentUser.email,
        currentUser.id,
        currentUser.name || currentUser.fullName
      );
      setUserBookings(Array.isArray(bks) ? bks : []);
    } else {
      setUserBookings([]);
    }
  };

  // Load Bookings & Services on mount and subscribe to live updates
  useEffect(() => {
    refreshServices();
    garageService.fetchMechanics().then(() => {
      refreshAvailability();
    }).catch(() => {});
    refreshUserBookings();
    refreshAvailability();
    const unsubscribe = garageService.subscribe((updatedServices) => {
      setServicesList(updatedServices);
    });
    const unsubBookings = garageService.subscribeBookings(() => {
      refreshUserBookings();
      refreshAvailability();
    });
    if (currentUser) {
      setOwnerName(currentUser.fullName || currentUser.name || '');
      setOwnerPhone(currentUser.phone || '+63 917 882 9102');
    }
    return () => {
      unsubscribe();
      unsubBookings();
    };
  }, [currentUser]);

  // Quick book from hero CTA
  const handleQuickBook = (type, forceTomorrow = false) => {
    if (forceTomorrow || todaySlotsData.isFullyBooked) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = tomorrow.toISOString().split('T')[0];
      setBookingDate(tomStr);
      showToast('📅 Pit bays fully booked today. Selecting tomorrow for your appointment.');
    }
    handleOpenBooking(type);
  };

  // Switch booking type directly
  const handleSwitchBookingType = (newType) => {
    const target = newType === 'Repair' ? 'Repair' : 'PMS';
    setBookingType(target);
    setSelectedServiceForBooking(resolveBookingPackage(target));
  };

  // Submit Booking - Initiates 20% Downpayment via GCash
  const handleConfirmBooking = () => {
    if (bikeInfoMode === 'registered' && !selectedMotorcycleId) {
      showToast('Please select a registered motorcycle, or switch to Enter details.');
      return;
    }
    if (!bikeModel.trim()) {
      showToast('Please enter your motorcycle model (e.g. NMAX 155, Ninja 400)');
      return;
    }
    if (!ownerPhone.trim()) {
      showToast('Please enter your contact phone number');
      return;
    }

    const currentSvc =
      selectedServiceForBooking ||
      resolveBookingPackage(bookingType) ||
      FIXED_GARAGE_SERVICES[bookingType] ||
      FIXED_GARAGE_SERVICES.PMS;

    const finalNotes =
      currentSvc.category === 'Repair' && selectedRepairIssue
        ? `[Fault: ${selectedRepairIssue}] ${serviceNotes.trim()}`
        : serviceNotes.trim();

    const catPrefix = currentSvc.category === 'Repair' ? 'REP' : currentSvc.category === 'Customization' ? 'CUST' : 'PMS';
    const bookingId = `BK-${catPrefix}-` + Math.floor(10000 + Math.random() * 90000);
    const fullPricePhp = getPackagePricePhp(currentSvc);
    const calculatedDownpayment = getPackageDownpaymentPhp(currentSvc);
    const calculatedBalance = Math.max(0, fullPricePhp - calculatedDownpayment);

    const bookingDraft = {
      id: bookingId,
      booking_id: bookingId,
      service_id: currentSvc.id,
      package_id: currentSvc.id,
      package_name: currentSvc.title,
      package_price: fullPricePhp,
      included_services: currentSvc.inclusions || [],
      estimated_duration: currentSvc.duration,
      service_title: currentSvc.title,
      service_price: fullPricePhp / 50,
      pricePhp: fullPricePhp,
      category: bookingType,
      repair_type: bookingType === 'Repair' ? selectedRepairIssue : undefined,
      downpayment_required: true,
      downpayment_percent: 20,
      downpayment_amount: calculatedDownpayment,
      remaining_balance: calculatedBalance,
      is_non_refundable: true,
      non_refundable_policy_acknowledged: true,
      motorcycle_id: bikeInfoMode === 'registered' ? selectedMotorcycleId : undefined,
      bike_brand: bikeBrand,
      bike_model: bikeModel,
      plate_number: bikePlate.trim() || 'Pending Registration',
      odometer: bikeOdo.trim() || 'New Unit',
      appointment_date: bookingDate,
      time_slot: selectedTimeSlot,
      branch: flagshipBranch.name,
      branch_address: flagshipBranch.address,
      photos: motorcyclePhotos,
      customer_name: ownerName || currentUser?.name || 'Customer',
      customer_phone: ownerPhone,
      notes: finalNotes,
      status: 'Pending',
      customerPhone: ownerPhone,
      grandTotal: calculatedDownpayment,
      orderId: bookingId,
    };

    setPendingBookingData(bookingDraft);
    setDownpaymentAmount(calculatedDownpayment);
    setIsGcashModalOpen(true);
  };

  const handleGcashPaymentSuccess = async (paymentReceipt) => {
    if (!pendingBookingData) return;

    const completedBooking = {
      ...pendingBookingData,
      downpayment_paid: true,
      downpayment_status: 'Paid',
      downpayment_ref: paymentReceipt.referenceNumber || ('DP-GCASH-' + Math.floor(100000 + Math.random() * 900000)),
      downpayment_paid_at: paymentReceipt.paidAt || new Date().toISOString(),
      downpayment_method: 'GCash',
      refund_status: 'Non-refundable',
      current_stage: `20% Downpayment Verified (₱${pendingBookingData.downpayment_amount.toLocaleString()} via GCash) • Pending Advisor Review`,
    };

    const newBooking = await garageService.createBooking(completedBooking);
    refreshUserBookings();
    setIsGcashModalOpen(false);
    setIsBookingModalOpen(false);
    setMotorcyclePhotos([]);
    setPendingBookingData(null);
    setActiveFilter('MyBookings');
    showToast(`🏁 Pit Bay Slot Booked! 20% Non-Refundable Downpayment (₱${newBooking.downpayment_amount.toLocaleString()}) Confirmed.`);
  };

  // Cancel Booking Prompter
  const handlePromptCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    await garageService.cancelBooking(bookingToCancel.id);
    refreshUserBookings();
    setIsCancelModalOpen(false);
    setBookingToCancel(null);
    showToast('Booking cancelled. 20% downpayment forfeited per policy.');
  };



  const activeBookingsCount = userBookings.filter((b) => b.status !== 'Cancelled').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* ─── 1. TOP NAVBAR ─── */}
      <View style={styles.navbarWrapper}>
        <View style={[styles.maxContainer, styles.navbarInner]}>
          <TouchableOpacity style={styles.logoRow} onPress={onNavigateToStore} activeOpacity={0.8}>
            <BrandLogo size={36} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#F8FAFC',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 10,
            }}
            onPress={onNavigateToStore}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="arrow-left" size={12} color="#0C6258" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>Back to Shop</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── GARAGE HEADER & QUICK ACTIONS ─── */}
          <View style={{ marginTop: 4, marginBottom: 18 }}>
            <Text style={styles.garageHeaderTitle}>Motorcycle Repair & Maintenance</Text>
            <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 4, lineHeight: 18 }}>
              Real-time pit bay status, diagnostics & certified technician bookings
            </Text>

            {/* Clean Segmented Booking Quick Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  backgroundColor: isBookingModalOpen && bookingType === 'PMS' ? '#0C6258' : '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: isBookingModalOpen && bookingType === 'PMS' ? '#0C6258' : '#E2E8F0',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.03,
                  shadowRadius: 3,
                  elevation: 1,
                }}
                onPress={() => handleOpenBooking('PMS')}
                activeOpacity={0.85}
              >
                <BootstrapIcon
                  name="wrench-adjustable"
                  size={14}
                  color={isBookingModalOpen && bookingType === 'PMS' ? '#FFFFFF' : '#0C6258'}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isBookingModalOpen && bookingType === 'PMS' ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  PMS Service
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  backgroundColor: isBookingModalOpen && bookingType === 'Repair' ? '#0F172A' : '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: isBookingModalOpen && bookingType === 'Repair' ? '#0F172A' : '#E2E8F0',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  shadowColor: '#0F172A',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.03,
                  shadowRadius: 3,
                  elevation: 1,
                }}
                onPress={() => handleOpenBooking('Repair')}
                activeOpacity={0.85}
              >
                <BootstrapIcon
                  name="wrench"
                  size={13}
                  color={isBookingModalOpen && bookingType === 'Repair' ? '#FFFFFF' : '#475569'}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isBookingModalOpen && bookingType === 'Repair' ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Repair Request
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── 4 KPI STATS GRID (COMPACT & SLEEK - MATCHING WEB) ─── */}
          <View style={styles.statsGrid}>
            {/* Card 1: MECHANICS AVAILABLE */}
            <TouchableOpacity
              style={[styles.statCard, styles.statCardTealAccent]}
              onPress={() => setIsRosterModalOpen(true)}
              activeOpacity={0.85}
            >
              <View>
                <View style={[styles.statIconWrap, { backgroundColor: '#F0FDFA' }]}>
                  <BootstrapIcon name="people-fill" size={17} color="#0C6258" />
                </View>
                <Text style={styles.statLabel}>MECHANICS AVAILABLE</Text>
                <Text style={styles.statValue}>{mechanicsData.availableCount}</Text>
              </View>
              <Text style={styles.statSub}>
                {mechanicsData.availableCount > 0
                  ? `${mechanicsData.availableCount} of ${mechanicsData.totalCount} on-duty & available`
                  : 'All technicians busy in bays'}
              </Text>
            </TouchableOpacity>

            {/* Card 2: TODAY'S SLOTS */}
            <View
              style={[
                styles.statCard,
                todaySlotsData.isFullyBooked ? styles.statCardDangerAccent : styles.statCardWarningAccent,
              ]}
            >
              <View>
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: todaySlotsData.isFullyBooked ? '#FEF2F2' : '#FFFBEB' },
                  ]}
                >
                  <BootstrapIcon
                    name={todaySlotsData.isFullyBooked ? 'calendar-x-fill' : 'calendar-check'}
                    size={17}
                    color={todaySlotsData.isFullyBooked ? '#E11D48' : '#D97706'}
                  />
                </View>
                <Text style={styles.statLabel}>TODAY'S SLOTS</Text>
                <Text
                  style={[
                    styles.statValue,
                    todaySlotsData.isFullyBooked && { color: '#E11D48', fontSize: 20 },
                  ]}
                >
                  {todaySlotsData.isFullyBooked ? 'No Slot Today' : todaySlotsData.availableSlotsCount}
                </Text>
              </View>
              <Text style={styles.statSub}>
                {todaySlotsData.isFullyBooked
                  ? 'Fully booked today'
                  : `${todaySlotsData.bookedSlotsCount} of ${todaySlotsData.totalSlots} daily slots reserved`}
              </Text>
            </View>

            {/* Card 3: NEXT OPENING */}
            <View
              style={[
                styles.statCard,
                todaySlotsData.isFullyBooked ? styles.statCardWarningAccent : styles.statCardDangerAccent,
              ]}
            >
              <View>
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: todaySlotsData.isFullyBooked ? '#FFFBEB' : '#EEF2FF' },
                  ]}
                >
                  <BootstrapIcon
                    name="clock-history"
                    size={17}
                    color={todaySlotsData.isFullyBooked ? '#D97706' : '#4F46E5'}
                  />
                </View>
                <Text style={styles.statLabel}>NEXT OPENING</Text>
                <Text style={styles.statValue}>
                  {todaySlotsData.isFullyBooked ? 'Tomorrow' : 'Today'}
                </Text>
              </View>
              <Text style={styles.statSub}>
                {todaySlotsData.isFullyBooked ? '09:00 AM - 10:30 AM' : 'Immediate express bay slot'}
              </Text>
            </View>

            {/* Card 4: PIT BAY CAPACITY */}
            <View style={[styles.statCard, styles.statCardBlueAccent]}>
              <View>
                <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <BootstrapIcon name="speedometer2" size={17} color="#2563EB" />
                </View>
                <Text style={styles.statLabel}>PIT BAY CAPACITY</Text>
                <Text style={styles.statValue}>6</Text>
              </View>
              <Text style={styles.statSub}>Dedicated bays & Dyno cell</Text>
            </View>
          </View>

          {/* Notice Banner if Fully Booked Today */}
          {todaySlotsData.isFullyBooked && (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FCA5A5',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <BootstrapIcon name="exclamation-octagon-fill" size={18} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#991B1B' }}>
                  Pit bays are fully booked today
                </Text>
                <Text style={{ fontSize: 11, color: '#B91C1C' }}>
                  All 6 bays at full capacity. Reserve tomorrow to secure your slot.
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
                onPress={() => handleQuickBook('PMS', true)}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Tomorrow</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── SCHEDULED BOOKING INFORMATION ─── */}
          <View style={styles.bookingsContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="calendar3" size={17} color="#0C6258" />
                <Text style={styles.sectionTitle}>Scheduled Bookings</Text>
              </View>
              <View
                style={{
                  backgroundColor: '#F1F5F9',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#475569' }}>
                  {userBookings.length} {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                </Text>
              </View>
            </View>

            {!currentUser ? (
              <View style={styles.emptyBox}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <BootstrapIcon name="person-lock" size={24} color="#0C6258" />
                </View>
                <Text style={styles.emptyTitle}>Sign In to View Scheduled Bookings</Text>
                <Text style={styles.emptySub}>
                  Sign in to your account to view your scheduled appointments, track master mechanic assignments, and manage service downpayments.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 14,
                    backgroundColor: '#0C6258',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                  }}
                  onPress={() => onNavigateToLogin?.()}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Sign In Now</Text>
                </TouchableOpacity>
              </View>
            ) : userBookings.length === 0 ? (
              <View style={styles.emptyBox}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: '#F8FAFC',
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <BootstrapIcon name="calendar3" size={24} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>No scheduled appointments yet</Text>
                <Text style={styles.emptySub}>
                  Book a PMS service or repair diagnostic above to reserve your slot and certified mechanic allocation.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: '#0C6258',
                      paddingVertical: 11,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      shadowColor: '#0C6258',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                    onPress={() => handleOpenBooking('PMS')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="wrench-adjustable" size={13} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Book PMS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      paddingVertical: 11,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                    }}
                    onPress={() => handleOpenBooking('Repair')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="wrench" size={13} color="#334155" />
                    <Text style={{ color: '#0F172A', fontSize: 13, fontWeight: '700' }}>Book Repair</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.bookingsGrid}>
                {userBookings.map((b) => (
                  <View
                    key={b.id}
                    style={[
                      styles.bookingCard,
                      b.status === 'Pending' && { borderLeftColor: '#F59E0B' },
                      b.status === 'Inspection' && { borderLeftColor: '#2563EB' },
                      b.status === 'Estimate Pending' && { borderLeftColor: '#DC2626' },
                      (b.status === 'In Progress' || b.status === 'In-Service') && { borderLeftColor: '#0284C7' },
                      b.status === 'Service Done' && { borderLeftColor: '#16A34A' },
                      b.status === 'Paid' && { borderLeftColor: '#0C6258' },
                      b.status === 'Closed' && { borderLeftColor: '#475569' },
                      (b.status === 'Rejected' || b.status === 'Cancelled') && { borderLeftColor: '#DC2626' },
                    ]}
                  >
                    <View style={styles.bookingCardTop}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.bookingId}>REF: {b.id}</Text>
                        <Text style={styles.bookingServiceTitle}>{b.serviceName || b.service_title}</Text>
                        {b.repair_type ? (
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626', marginTop: 2 }}>
                            Fault: {b.repair_type}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.statusPillConfirmed,
                          b.status === 'Pending' && { backgroundColor: '#FEF3C7' },
                          b.status === 'Inspection' && { backgroundColor: '#EFF6FF' },
                          b.status === 'Estimate Pending' && { backgroundColor: '#FEE2E2' },
                          (b.status === 'In Progress' || b.status === 'In-Service') && { backgroundColor: '#E0F2FE' },
                          b.status === 'Service Done' && { backgroundColor: '#DCFCE7' },
                          b.status === 'Paid' && { backgroundColor: '#D1ECE6' },
                          b.status === 'Closed' && { backgroundColor: '#F1F5F9' },
                          (b.status === 'Rejected' || b.status === 'Cancelled') && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            b.status === 'Pending' && { color: '#D97706' },
                            b.status === 'Inspection' && { color: '#2563EB' },
                            b.status === 'Estimate Pending' && { color: '#DC2626' },
                            (b.status === 'In Progress' || b.status === 'In-Service') && { color: '#0284C7' },
                            b.status === 'Service Done' && { color: '#16A34A' },
                            b.status === 'Paid' && { color: '#0C6258' },
                            b.status === 'Closed' && { color: '#475569' },
                            (b.status === 'Rejected' || b.status === 'Cancelled') && { color: '#DC2626' },
                          ]}
                        >
                          {b.status === 'Pending'
                            ? '⏳ Pending Review'
                            : b.status === 'Inspection'
                            ? '🔍 In Inspection'
                            : b.status === 'Estimate Pending'
                            ? '⚠️ Estimate Pending'
                            : b.status === 'In Progress' || b.status === 'In-Service'
                            ? '🔧 In Progress'
                            : b.status === 'Service Done'
                            ? '✓ Service Done'
                            : b.status === 'Paid'
                            ? '✓ Bay Service Paid'
                            : b.status === 'Closed'
                            ? '✓ Finished & Released'
                            : b.status === 'Cancelled'
                            ? 'Cancelled'
                            : b.status || 'Confirmed'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
                      <BootstrapIcon name="calendar2-event" size={13} color="#64748B" />
                      <Text style={{ fontSize: 13, color: '#334155', fontWeight: '700' }}>
                        {b.appointment_date || b.date} • {b.appointment_time || b.timeSlot || b.time_slot}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <BootstrapIcon name="bicycle" size={13} color="#64748B" />
                      <Text style={{ fontSize: 12.5, color: '#475569' }}>
                        {b.bikeBrand || b.brand || b.bike_brand} {b.bikeModel || b.model || b.bike_model} ({b.bikePlate || b.plateNumber || b.plate_number || 'No Plate'})
                      </Text>
                    </View>

                    {b.branch ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <BootstrapIcon name="geo-alt" size={13} color="#64748B" />
                        <Text style={{ fontSize: 12, color: '#64748B' }}>
                          {b.branch}
                        </Text>
                      </View>
                    ) : null}

                    {b.mechanic ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <BootstrapIcon name="person-badge" size={13} color="#0C6258" />
                        <Text style={{ fontSize: 12, color: '#0C6258', fontWeight: '700' }}>
                          Assigned: {b.mechanic}
                        </Text>
                      </View>
                    ) : null}

                    <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', marginTop: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                          20% Downpayment (Paid): <Text style={{ fontWeight: '800', color: '#0C6258' }}>₱{(b.downpayment_amount !== undefined ? b.downpayment_amount : Math.round((b.pricePhp || 2500) * 0.20)).toLocaleString()}</Text>
                        </Text>
                        {b.downpayment_ref ? (
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>
                            Ref: {b.downpayment_ref}
                          </Text>
                        ) : null}
                      </View>
                      {b.status !== 'Cancelled' && (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0C6258', marginTop: 4 }}>
                          Remaining Due at Bay: ₱{(b.remaining_balance !== undefined ? b.remaining_balance : Math.max(0, (b.pricePhp || 2500) - Math.round((b.pricePhp || 2500) * 0.20))).toLocaleString()}
                        </Text>
                      )}
                    </View>
                    
                    {b.status !== 'Closed' && b.status !== 'Cancelled' && (
                      <TouchableOpacity
                        style={[styles.cancelBookingBtn, { marginTop: 12 }]}
                        onPress={() => handlePromptCancelBooking(b)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                        <Text style={styles.cancelBookingBtnText}>Cancel Appointment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ─── ONE-PAGE POPUP BOOKING FORM MODAL (MATCHING WEB) ─── */}
          <Modal
            visible={isBookingModalOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsBookingModalOpen(false)}
          >
            <View style={styles.popupModalOverlay}>
              <TouchableOpacity
                style={styles.popupModalBackdropTouchable}
                activeOpacity={1}
                onPress={() => setIsBookingModalOpen(false)}
              />

              <View style={styles.popupModalCard}>
                {/* Modal Header */}
                <View style={styles.popupModalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: bookingType === 'Repair' ? '#FEE2E2' : '#D1ECE6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon
                        name={bookingType === 'Repair' ? 'wrench' : 'wrench-adjustable'}
                        size={18}
                        color={bookingType === 'Repair' ? '#DC2626' : '#0C6258'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.popupModalTitle} numberOfLines={1}>
                        {bookingType === 'Repair'
                          ? 'Mechanical Repair Booking Form'
                          : bookingType === 'PMS'
                          ? 'PMS Maintenance Booking Form'
                          : 'Pitstop Bay Service Reservation'}
                      </Text>
                      <Text style={styles.popupModalSub} numberOfLines={1}>
                        One-page reservation form • 20% advance downpayment required
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.popupModalCloseBtn}
                    onPress={() => setIsBookingModalOpen(false)}
                  >
                    <BootstrapIcon name="x-lg" size={15} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Scrollable Form Body */}
                <ScrollView style={styles.popupModalBody} showsVerticalScrollIndicator={true}>
                  {/* SECTION 1: SERVICE CATEGORY & PACKAGE SELECTION */}
                  <View style={styles.formSectionBox}>
                    <View style={styles.formSectionHeader}>
                      <BootstrapIcon name="tools" size={15} color="#0C6258" />
                      <Text style={styles.formSectionHeading}>1. Service Package Selection</Text>
                    </View>

                    <BookingSelect
                      label="Service Category *"
                      value={bookingType}
                      accentColor={bookingType === 'Repair' ? '#DC2626' : '#0C6258'}
                      options={BOOKING_CATEGORIES.map((cat) => ({
                        value: cat.id,
                        label: cat.label,
                      }))}
                      onChange={(cat) => handleSwitchBookingType(cat)}
                    />

                    {(() => {
                      const categoryPackages = packagesForCategory(bookingType);
                      const selectedPkg =
                        selectedServiceForBooking ||
                        categoryPackages.find(
                          (pkg) =>
                            String(pkg.id) === String(selectedServiceForBooking?.id) ||
                            String(pkg.service_id) === String(selectedServiceForBooking?.service_id)
                        ) ||
                        categoryPackages[0];
                      const selectedPkgId = selectedPkg?.id || selectedPkg?.service_id || '';
                      const selectedDescription = selectedPkg?.description || selectedPkg?.subtitle || '';
                      const selectedPrice = selectedPkg ? getPackagePricePhp(selectedPkg) : 0;
                      const selectedDp = selectedPkg ? getPackageDownpaymentPhp(selectedPkg) : 0;
                      return (
                        <>
                          <BookingSelect
                            label={bookingType === 'Repair' ? 'Repair Package *' : 'PMS Package *'}
                            value={selectedPkgId}
                            placeholder="Select a package"
                            emptyText="No packages available for this service yet."
                            accentColor={bookingType === 'Repair' ? '#DC2626' : '#0C6258'}
                            options={categoryPackages.map((pkg) => ({
                              value: pkg.id || pkg.service_id,
                              label: `${pkg.title} — ₱${getPackagePricePhp(pkg).toLocaleString()}`,
                            }))}
                            onChange={(pkgId) => {
                              const pkg = categoryPackages.find(
                                (item) => String(item.id) === String(pkgId) || String(item.service_id) === String(pkgId)
                              );
                              if (pkg) setSelectedServiceForBooking(pkg);
                            }}
                          />
                          {selectedPkg ? (
                            <View
                              style={{
                                marginTop: -4,
                                marginBottom: 12,
                                padding: 12,
                                borderRadius: 10,
                                backgroundColor: bookingType === 'Repair' ? '#FEF2F2' : '#F0FDF4',
                                borderWidth: 1,
                                borderColor: bookingType === 'Repair' ? '#FECACA' : '#BBF7D0',
                              }}
                            >
                              {selectedDescription ? (
                                <Text style={{ fontSize: 12, color: '#475569', lineHeight: 17, marginBottom: 6 }}>
                                  {selectedDescription}
                                </Text>
                              ) : null}
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '800',
                                  color: bookingType === 'Repair' ? '#DC2626' : '#0C6258',
                                }}
                              >
                                ₱{selectedPrice.toLocaleString()} • 20% DP due now: ₱{selectedDp.toLocaleString()}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      );
                    })()}

                    {bookingType === 'Repair' && (
                      <BookingSelect
                        label="Primary Mechanical Fault Area *"
                        value={selectedRepairIssue}
                        accentColor="#DC2626"
                        options={REPAIR_COMMON_ISSUES.map((issue) => ({
                          value: issue.label,
                          label: issue.label,
                        }))}
                        onChange={(issue) => setSelectedRepairIssue(issue)}
                      />
                    )}
                  </View>

                  {/* SECTION 2: MOTORCYCLE INFORMATION */}
                  <View style={styles.formSectionBox}>
                    <View style={styles.formSectionHeader}>
                      <BootstrapIcon name="speedometer" size={15} color="#0C6258" />
                      <Text style={styles.formSectionHeading}>2. Motorcycle Information</Text>
                    </View>

                    <Text style={styles.fieldLabel}>How do you want to provide motorcycle details? *</Text>
                    <View style={[styles.serviceTypeSegment, { marginBottom: 12 }]}>
                      <TouchableOpacity
                        style={[styles.serviceTypeTab, bikeInfoMode === 'registered' && styles.serviceTypeTabActivePMS]}
                        onPress={() => {
                          setBikeInfoMode('registered');
                          const current =
                            garageMotorcycles.find((m) => m.motorcycle_id === selectedMotorcycleId) ||
                            garageMotorcycles.find((m) => m.is_primary) ||
                            garageMotorcycles[0];
                          if (current) applyRegisteredMotorcycle(current);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.serviceTypeTabText,
                            bikeInfoMode === 'registered' && styles.serviceTypeTabTextActive,
                            { fontSize: 11 },
                          ]}
                        >
                          Registered motorcycle
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.serviceTypeTab, bikeInfoMode === 'manual' && styles.serviceTypeTabActivePMS]}
                        onPress={() => setBikeInfoMode('manual')}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.serviceTypeTabText,
                            bikeInfoMode === 'manual' && styles.serviceTypeTabTextActive,
                            { fontSize: 11 },
                          ]}
                        >
                          Enter details
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {bikeInfoMode === 'registered' ? (
                      !currentUser ? (
                        <View
                          style={{
                            marginBottom: 8,
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderRadius: 10,
                            padding: 12,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 6 }}>
                            Sign in to choose a registered motorcycle
                          </Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10, lineHeight: 17 }}>
                            Your saved bikes will appear here. You can also enter motorcycle details without signing in.
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setIsBookingModalOpen(false);
                              onNavigateToLogin?.();
                            }}
                            style={{
                              alignSelf: 'flex-start',
                              backgroundColor: '#0C6258',
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Sign In</Text>
                          </TouchableOpacity>
                        </View>
                      ) : !garageMotorcycles.length ? (
                        <View
                          style={{
                            marginBottom: 8,
                            backgroundColor: '#FFFBEB',
                            borderWidth: 1,
                            borderColor: '#FDE68A',
                            borderRadius: 10,
                            padding: 12,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 6 }}>
                            No registered motorcycle yet
                          </Text>
                          <Text style={{ fontSize: 12, color: '#B45309', marginBottom: 10, lineHeight: 17 }}>
                            Add a bike to My Garage, or enter the motorcycle details for this booking.
                          </Text>
                          <TouchableOpacity
                            onPress={() => setBikeInfoMode('manual')}
                            style={{
                              alignSelf: 'flex-start',
                              backgroundColor: '#0C6258',
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Enter details instead</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <BookingSelect
                            label="Registered Motorcycle *"
                            value={selectedMotorcycleId}
                            placeholder="Select a registered motorcycle"
                            accentColor="#0C6258"
                            options={garageMotorcycles.map((m) => ({
                              value: m.motorcycle_id,
                              label: `${m.is_primary ? '★ ' : ''}${m.brand} ${m.model} (${m.plate_number})`,
                            }))}
                            onChange={(id) => {
                              const bike = garageMotorcycles.find((m) => String(m.motorcycle_id) === String(id));
                              applyRegisteredMotorcycle(bike);
                            }}
                          />
                          {(() => {
                            const selectedBike = garageMotorcycles.find((m) => m.motorcycle_id === selectedMotorcycleId);
                            if (!selectedBike) return null;
                            return (
                              <View
                                style={{
                                  marginTop: -4,
                                  marginBottom: 12,
                                  padding: 12,
                                  borderRadius: 10,
                                  backgroundColor: '#F0FDF4',
                                  borderWidth: 1,
                                  borderColor: '#BBF7D0',
                                }}
                              >
                                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                                  {selectedBike.nickname || `${selectedBike.brand} ${selectedBike.model}`}
                                </Text>
                                <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                  {selectedBike.brand} {selectedBike.model}
                                  {selectedBike.year ? ` • ${selectedBike.year}` : ''}
                                  {selectedBike.plate_number ? ` • ${selectedBike.plate_number}` : ''}
                                </Text>
                              </View>
                            );
                          })()}
                          <Text style={styles.fieldLabel}>Current Odometer</Text>
                          <TextInput
                            style={[styles.modalInput, { marginBottom: 4 }]}
                            placeholder="e.g. 6,500 km"
                            placeholderTextColor="#94A3B8"
                            value={bikeOdo}
                            onChangeText={setBikeOdo}
                          />
                        </>
                      )
                    ) : (
                      <>
                        <BookingSelect
                          label="Motorcycle Brand *"
                          value={bikeBrand}
                          options={['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'KTM', 'Vespa', 'Other'].map(
                            (b) => ({ value: b, label: b })
                          )}
                          onChange={setBikeBrand}
                        />

                        <View style={{ marginBottom: 10 }}>
                          <Text style={styles.fieldLabel}>Motorcycle Model *</Text>
                          <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Aerox 155, Ninja 400, CB650R"
                            placeholderTextColor="#94A3B8"
                            value={bikeModel}
                            onChangeText={setBikeModel}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Plate Number / Temp Tag *</Text>
                            <TextInput
                              style={styles.modalInput}
                              placeholder="e.g. 123-ABC"
                              placeholderTextColor="#94A3B8"
                              value={bikePlate}
                              onChangeText={setBikePlate}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Current Odometer</Text>
                            <TextInput
                              style={styles.modalInput}
                              placeholder="e.g. 6,500 km"
                              placeholderTextColor="#94A3B8"
                              value={bikeOdo}
                              onChangeText={setBikeOdo}
                            />
                          </View>
                        </View>
                      </>
                    )}
                  </View>

                  {/* SECTION 3: PITSTOP BAY HUB & SCHEDULE */}
                  <View style={styles.formSectionBox}>
                    <View style={styles.formSectionHeader}>
                      <BootstrapIcon name="geo-alt-fill" size={15} color="#0C6258" />
                      <Text style={styles.formSectionHeading}>3. Flagship Pit Bay & Schedule</Text>
                    </View>

                    {/* Flagship Hub Card */}
                    <View style={styles.singleHubCard}>
                      <View style={styles.singleHubBadge}>
                        <Text style={styles.singleHubBadgeText}>Flagship Service Facility</Text>
                      </View>
                      <Text style={styles.singleHubTitle}>{flagshipBranch.name}</Text>
                      <Text style={styles.singleHubAddress}>📍 {flagshipBranch.address}</Text>
                      <Text style={styles.singleHubFeatures}>⚡ {flagshipBranch.bays}</Text>
                    </View>

                    {/* Date Selection Header with Calendar Toggle */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.fieldLabel}>
                        Appointment Date (Select in Calendar) *
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsCalendarOpen(!isCalendarOpen)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <BootstrapIcon name={isCalendarOpen ? 'calendar-minus' : 'calendar-plus'} size={12} color="#0C6258" />
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0C6258' }}>
                          {isCalendarOpen ? 'Hide Grid' : 'Show Grid'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Date Display Bar */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: '#0C6258',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <BootstrapIcon name="calendar3" size={15} color="#0C6258" />
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                          {bookingDate}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#D1ECE6', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0C6258' }}>
                          Selected
                        </Text>
                      </View>
                    </View>

                    {/* Interactive Visual Calendar Grid */}
                    {isCalendarOpen && (() => {
                      const calendarYear = calendarViewDate.getFullYear();
                      const calendarMonth = calendarViewDate.getMonth();
                      const monthNames = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ];
                      const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

                      const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
                      const daysInCurrentMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                      const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];

                      const handlePrevMonth = () => {
                        setCalendarViewDate(new Date(calendarYear, calendarMonth - 1, 1));
                      };
                      const handleNextMonth = () => {
                        setCalendarViewDate(new Date(calendarYear, calendarMonth + 1, 1));
                      };

                      const cells = [];
                      for (let i = firstDayOfMonth - 1; i >= 0; i--) {
                        cells.push({
                          day: daysInPrevMonth - i,
                          isCurrentMonth: false,
                          dateStr: null,
                          isPast: true,
                        });
                      }
                      for (let d = 1; d <= daysInCurrentMonth; d++) {
                        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isPast = dateStr < todayStr;
                        cells.push({
                          day: d,
                          isCurrentMonth: true,
                          dateStr,
                          isPast,
                          isSelected: dateStr === bookingDate,
                          isToday: dateStr === todayStr,
                        });
                      }
                      const remaining = 7 - (cells.length % 7);
                      if (remaining < 7) {
                        for (let i = 1; i <= remaining; i++) {
                          cells.push({
                            day: i,
                            isCurrentMonth: false,
                            dateStr: null,
                            isPast: false,
                          });
                        }
                      }

                      return (
                        <View
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: '#E2E8F0',
                            padding: 12,
                            marginBottom: 10,
                          }}
                        >
                          {/* Month / Year Header */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <TouchableOpacity
                              onPress={handlePrevMonth}
                              style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <BootstrapIcon name="chevron-left" size={12} color="#334155" />
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <BootstrapIcon name="calendar-event-fill" size={13} color="#0C6258" />
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                                {monthNames[calendarMonth]} {calendarYear}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={handleNextMonth}
                              style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <BootstrapIcon name="chevron-right" size={12} color="#334155" />
                            </TouchableOpacity>
                          </View>

                          {/* Day of Week Headers */}
                          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                            {daysOfWeek.map((dayName, idx) => (
                              <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: idx === 0 || idx === 6 ? '#94A3B8' : '#64748B' }}>
                                  {dayName}
                                </Text>
                              </View>
                            ))}
                          </View>

                          {/* Day Cells Grid */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {cells.map((cell, idx) => {
                              if (!cell.isCurrentMonth) {
                                return (
                                  <View key={idx} style={{ width: '14.28%', height: 32, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 11, color: '#E2E8F0' }}>{cell.day}</Text>
                                  </View>
                                );
                              }

                              const isPast = cell.isPast;
                              const isSelected = cell.isSelected;
                              const isToday = cell.isToday;

                              return (
                                <TouchableOpacity
                                  key={idx}
                                  disabled={isPast}
                                  onPress={() => {
                                    handleSelectDate(cell.dateStr);
                                  }}
                                  style={{
                                    width: '14.28%',
                                    height: 32,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 8,
                                    backgroundColor: isSelected ? '#0C6258' : isToday ? '#D1ECE6' : 'transparent',
                                    borderWidth: isToday && !isSelected ? 1 : 0,
                                    borderColor: '#0C6258',
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: isSelected || isToday ? '800' : '600',
                                      color: isSelected ? '#FFFFFF' : isPast ? '#CBD5E1' : '#0F172A',
                                    }}
                                  >
                                    {cell.day}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })()}

                    {/* Quick Date Chips */}
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Tomorrow', days: 1 },
                        { label: 'In 2 Days', days: 2 },
                        { label: 'In 3 Days', days: 3 },
                        { label: 'In 5 Days', days: 5 },
                        { label: 'Next Week', days: 7 },
                      ].map((q) => (
                        <TouchableOpacity
                          key={q.label}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                          }}
                          onPress={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + q.days);
                            handleSelectDate(d.toISOString().split('T')[0]);
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                            + {q.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Preferred Time Slot */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={styles.fieldLabel}>Preferred Pit Bay Time Slot *</Text>
                      {(() => {
                        const selAvail = garageService.getDaySlotAvailability(bookingDate);
                        return (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: selAvail.isFullyBooked ? '#EF4444' : '#0C6258' }}>
                            {selAvail.isFullyBooked ? '● Fully Booked (No slots)' : `● ${selAvail.availableSlotsCount} Slots Open`}
                          </Text>
                        );
                      })()}
                    </View>

                    {(() => {
                      const selAvail = garageService.getDaySlotAvailability(bookingDate);
                      if (selAvail.isFullyBooked) {
                        return (
                          <View
                            style={{
                              backgroundColor: '#FEE2E2',
                              borderColor: '#EF4444',
                              borderWidth: 1,
                              borderRadius: 8,
                              padding: 8,
                              marginBottom: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <BootstrapIcon name="exclamation-octagon-fill" size={14} color="#DC2626" />
                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#991B1B', flex: 1 }}>
                              {selAvail.isToday
                                ? 'Pit bays are fully booked today. Please select tomorrow or another date above.'
                                : 'All service slots are fully booked for this date. Please choose another date.'}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}

                    <View style={[styles.timeSlotsGrid, { marginBottom: 4 }]}>
                      {(() => {
                        const selAvail = garageService.getDaySlotAvailability(bookingDate);
                        return TIME_SLOTS.map((ts) => {
                          const slotInfo = selAvail.slots?.find((s) => s.timeSlot === ts);
                          const isBooked = slotInfo?.isBooked;
                          const isSelected = selectedTimeSlot === ts && !isBooked;

                          return (
                            <TouchableOpacity
                              key={ts}
                              disabled={isBooked}
                              style={[
                                styles.timeSlotPill,
                                isSelected && styles.timeSlotPillActive,
                                isBooked && {
                                  backgroundColor: '#F1F5F9',
                                  borderColor: '#E2E8F0',
                                  opacity: 0.55,
                                },
                              ]}
                              onPress={() => {
                                if (!isBooked) setSelectedTimeSlot(ts);
                              }}
                            >
                              <Text
                                style={[
                                  styles.timeSlotText,
                                  isSelected && styles.timeSlotTextActive,
                                  isBooked && { color: '#94A3B8', textDecorationLine: 'line-through' },
                                ]}
                              >
                                {ts} {isBooked ? '(Booked)' : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        });
                      })()}
                    </View>
                  </View>

                  {/* SECTION 4: RIDER DETAILS & MECHANIC NOTES */}
                  <View style={styles.formSectionBox}>
                    <View style={styles.formSectionHeader}>
                      <BootstrapIcon name="person-badge" size={15} color="#0C6258" />
                      <Text style={styles.formSectionHeading}>4. Rider Details & Mechanic Notes</Text>
                    </View>

                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.fieldLabel}>Rider / Owner Name *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Alex Rider"
                        placeholderTextColor="#94A3B8"
                        value={ownerName}
                        onChangeText={setOwnerName}
                      />
                    </View>

                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.fieldLabel}>Contact Mobile (GCash & SMS) *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="+63 917 123 4567"
                        placeholderTextColor="#94A3B8"
                        value={ownerPhone}
                        onChangeText={setOwnerPhone}
                        keyboardType="phone-pad"
                      />
                    </View>

                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.fieldLabel}>Issue Symptoms / Maintenance Notes (Optional)</Text>
                      <TextInput
                        style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                        placeholder="Describe abnormal sounds, jerking, fluid leaks, oil brand preference..."
                        placeholderTextColor="#94A3B8"
                        multiline={true}
                        value={serviceNotes}
                        onChangeText={setServiceNotes}
                      />
                    </View>

                    <Text style={styles.fieldLabel}>Attach Motorcycle / Fault Photos (Optional)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#CBD5E1',
                        }}
                        onPress={handlePickPhoto}
                        disabled={isUploadingPhoto}
                      >
                        <BootstrapIcon name="camera-fill" size={13} color="#0C6258" />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0F172A' }}>
                          {isUploadingPhoto ? 'Uploading...' : 'Add Photo'}
                        </Text>
                      </TouchableOpacity>

                      {motorcyclePhotos.map((uri, idx) => (
                        <View key={idx} style={styles.photoThumbWrap}>
                          <Image source={{ uri }} style={styles.photoThumbImg} />
                          <TouchableOpacity
                            style={styles.photoRemoveBtn}
                            onPress={() => handleRemovePhoto(idx)}
                          >
                            <BootstrapIcon name="x" size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* SECTION 5: PRICING & 20% DOWNPAYMENT SETTLEMENT */}
                  <View
                    style={{
                      backgroundColor: '#FFFBEB',
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: '#FDE68A',
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <BootstrapIcon name="credit-card-2-front" size={15} color="#D97706" />
                      <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#92400E', textTransform: 'uppercase' }}>
                        5. Pricing & 20% Downpayment Settlement
                      </Text>
                    </View>

                    {/* Fee Breakdown */}
                    {(() => {
                      const currentSvc = selectedServiceForBooking || resolveBookingPackage(bookingType);
                      const fullPrice = getPackagePricePhp(currentSvc);
                      const dp = getPackageDownpaymentPhp(currentSvc);
                      const rem = Math.max(0, fullPrice - dp);

                      return (
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ fontSize: 12, color: '#64748B', flex: 1, paddingRight: 8 }}>Package ({currentSvc?.title}):</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>₱{fullPrice.toLocaleString()}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <View style={{ backgroundColor: '#D1ECE6', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5 }}>
                                <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#0C6258' }}>20% DUE NOW</Text>
                              </View>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#0C6258' }}>Mandatory Downpayment:</Text>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#0C6258' }}>₱{dp.toLocaleString()}</Text>
                          </View>
                          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 5 }} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11.5, color: '#64748B' }}>Remaining Balance Due at Bay:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569' }}>₱{rem.toLocaleString()}</Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Strict Anti-Fake Booking Non-Refundable Notice */}
                    <View
                      style={{
                        backgroundColor: '#FEF2F2',
                        borderRadius: 8,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: '#FECACA',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <BootstrapIcon name="shield-exclamation" size={13} color="#DC2626" />
                        <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#991B1B' }}>
                          ANTI-FAKE BOOKING & NON-REFUNDABLE POLICY:
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#991B1B', lineHeight: 15, marginBottom: 3 }}>
                        • <Text style={{ fontWeight: '800' }}>Slot Not Reserved Without Downpayment:</Text> You must authorize the 20% downpayment via GCash to hold the bay.
                      </Text>
                      <Text style={{ fontSize: 11, color: '#991B1B', lineHeight: 15 }}>
                        • <Text style={{ fontWeight: '800' }}>Strictly Non-Refundable:</Text> Once confirmed, downpayment is non-refundable upon cancellation to cover technician and bay allocation.
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Modal Footer */}
                <View style={styles.popupModalFooter}>
                  <TouchableOpacity
                    style={styles.popupCancelBtn}
                    onPress={() => setIsBookingModalOpen(false)}
                  >
                    <Text style={styles.popupCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.popupSubmitBtn,
                      bookingType === 'Repair' && { backgroundColor: '#DC2626' },
                    ]}
                    onPress={handleConfirmBooking}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="calendar-check" size={15} color="#FFFFFF" />
                    <Text style={styles.popupSubmitBtnText}>Reserve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

      {/* ─── 7. PERSISTENT MOBILE BOTTOM NAVIGATION ─── */}
      <BottomNavBar
        activeTab="Garage"
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />
      {/* 20% Non-Refundable Downpayment GCash Modal */}
      <GCashPaymentModal
        visible={isGcashModalOpen}
        amount={downpaymentAmount}
        orderData={pendingBookingData}
        onClose={() => {
          setIsGcashModalOpen(false);
          showToast('❌ Booking not reserved: 20% downpayment is required to prevent fake bookings.');
        }}
        onPaymentSuccess={handleGcashPaymentSuccess}
        showToast={showToast}
      />

      {/* Strict Non-Refundable Cancellation Confirmation Modal */}
      <ConfirmModal
        visible={isCancelModalOpen}
        title="Cancel Pit Bay Appointment?"
        message={`⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour 20% advance downpayment of ₱${(bookingToCancel?.downpayment_amount !== undefined ? bookingToCancel.downpayment_amount : Math.round((bookingToCancel?.pricePhp || 2500) * 0.20)).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover technician and bay allocation. Are you sure you wish to cancel?`}
        confirmText="Yes, Cancel & Forfeit Downpayment"
        cancelText="Keep My Booking"
        type="danger"
        confirmIcon="exclamation-triangle-fill"
        onConfirm={handleConfirmCancelBooking}
        onCancel={() => {
          setIsCancelModalOpen(false);
          setBookingToCancel(null);
        }}
      />

      {/* ─── CERTIFIED MECHANICS ROSTER MODAL ─── */}
      <Modal
        visible={isRosterModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRosterModalOpen(false)}
      >
        <View style={styles.rosterModalOverlay}>
          <View style={styles.rosterModalContainer}>
            <View style={styles.rosterModalHeader}>
              <View style={styles.rosterModalTitleRow}>
                <BootstrapIcon name="tools" size={18} color="#0C6258" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rosterModalTitle}>Certified Mechanics</Text>
                  <Text style={styles.rosterModalSub}>
                    {mechanicsData.availableCount} of {mechanicsData.totalCount} Available Today
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.rosterModalCloseBtn}
                onPress={() => setIsRosterModalOpen(false)}
              >
                <BootstrapIcon name="x-lg" size={12} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              {mechanicsData.mechanics.map((mech) => (
                <View key={mech.id} style={styles.rosterItemCard}>
                  <Image source={{ uri: mech.avatar }} style={styles.rosterItemAvatar} />
                  <View style={styles.rosterItemBody}>
                    <Text style={styles.rosterItemName}>{mech.shortName || mech.name}</Text>
                    <Text style={styles.rosterItemSpec}>
                      ⚡ {mech.specialization}
                    </Text>
                    <Text style={styles.rosterItemBay}>
                      📍 {mech.bay}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rosterStatusPill,
                      {
                        backgroundColor: mech.isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        borderWidth: 1,
                        borderColor: mech.isAvailable ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rosterStatusText,
                        { color: mech.isAvailable ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {mech.status}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E293B', flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#0C6258',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
                onPress={() => setIsRosterModalOpen(false)}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
