import React, { useState, useMemo, useEffect } from 'react';
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
import { usdToPhp } from '../utils/currency';
import {
  garageService,
  GARAGE_SERVICES,
  GARAGE_BRANCHES,
  TIME_SLOTS,
  REPAIR_COMMON_ISSUES,
  BOOKING_CATEGORIES,
  FIXED_GARAGE_SERVICES,
  AVAILABLE_MECHANICS,
} from '../services/garageService';
import { motorcycleService } from '../services/motorcycleService';
import { BootstrapIcon, BottomNavBar, BrandLogo } from '../components/common';
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
  const [servicesList, setServicesList] = useState(() => garageService.getServices());
  const [userBookings, setUserBookings] = useState([]);

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Garage') {
      setActiveFilter('Services');
    } else if (tab === 'Dashboard' || tab === 'Profile') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.();
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

  // Service Package Detail Modal State ('Repair' | 'PMS' | null)
  const [serviceDetailModal, setServiceDetailModal] = useState(null);

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

  // Sync registered garage motorcycles from service
  useEffect(() => {
    let unsub = null;
    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsub = motorcycleService.subscribe((list) => {
          setGarageMotorcycles([...list]);
        });
      }
      const list = motorcycleService.getMotorcycles(currentUser?.id) || [];
      setGarageMotorcycles(list);
      const primary = list.find((m) => m.is_primary) || list[0];
      if (primary) {
        setBikeBrand(primary.brand);
        setBikeModel(primary.model);
        setBikePlate(primary.plate_number);
        if (primary.odometer) setBikeOdo(primary.odometer);
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
      setServicesList(data || []);
    } catch (e) {
      setServicesList(garageService.getServices());
    }
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

  // Open booking popup modal
  const handleOpenBooking = (forcedType) => {
    const cat = forcedType === 'Repair' ? 'Repair' : 'PMS';
    setBookingType(cat);
    setSelectedServiceForBooking(FIXED_GARAGE_SERVICES[cat]);
    setIsBookingModalOpen(true);
  };

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
    setSelectedServiceForBooking(FIXED_GARAGE_SERVICES[target]);
  };

  // Submit Booking - Initiates 20% Downpayment via GCash
  const handleConfirmBooking = () => {
    if (!bikeModel.trim()) {
      showToast('Please enter your motorcycle model (e.g. NMAX 155, Ninja 400)');
      return;
    }
    if (!ownerPhone.trim()) {
      showToast('Please enter your contact phone number');
      return;
    }

    const currentSvc = FIXED_GARAGE_SERVICES[bookingType] || FIXED_GARAGE_SERVICES.PMS;

    const finalNotes =
      bookingType === 'Repair' && selectedRepairIssue
        ? `[Fault: ${selectedRepairIssue}] ${serviceNotes.trim()}`
        : serviceNotes.trim();

    const catPrefix = bookingType === 'Repair' ? 'REP' : 'PMS';
    const bookingId = `BK-${catPrefix}-` + Math.floor(10000 + Math.random() * 90000);
    const fullPricePhp = currentSvc.pricePhp;
    const calculatedDownpayment = currentSvc.downpaymentPhp;
    const calculatedBalance = Math.max(0, fullPricePhp - calculatedDownpayment);

    const bookingDraft = {
      id: bookingId,
      booking_id: bookingId,
      service_id: currentSvc.id,
      service_title: currentSvc.title,
      service_price: currentSvc.pricePhp / 50,
      pricePhp: fullPricePhp,
      category: bookingType,
      repair_type: bookingType === 'Repair' ? selectedRepairIssue : undefined,
      downpayment_required: true,
      downpayment_percent: 20,
      downpayment_amount: calculatedDownpayment,
      remaining_balance: calculatedBalance,
      is_non_refundable: true,
      non_refundable_policy_acknowledged: true,
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
          <View style={styles.logoRow}>
            <BrandLogo size={36} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── GARAGE HEADER & QUICK ACTIONS (MATCHING WEB) ─── */}
          <View style={styles.garageHeaderRow}>
            <View style={styles.garageHeaderLeft}>
              <Text style={styles.garageHeaderTitle}>Motorcycle Repair & Maintenance</Text>
            </View>

            <View style={styles.garageHeaderActions}>
              <View style={styles.tabButtons}>
                {/* 1. Repair Button (Opens Modal) */}
                <TouchableOpacity
                  style={[styles.tabBtn, serviceDetailModal === 'Repair' && styles.tabBtnActive]}
                  onPress={() => setServiceDetailModal('Repair')}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon
                    name="wrench"
                    size={13}
                    color={serviceDetailModal === 'Repair' ? '#FFFFFF' : '#DC2626'}
                  />
                  <Text style={[styles.tabBtnText, serviceDetailModal === 'Repair' && styles.tabBtnTextActive]}>
                    Repair
                  </Text>
                </TouchableOpacity>

                {/* 2. PMS Button (Opens Modal) */}
                <TouchableOpacity
                  style={[styles.tabBtn, serviceDetailModal === 'PMS' && styles.tabBtnActive]}
                  onPress={() => setServiceDetailModal('PMS')}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon
                    name="wrench-adjustable"
                    size={13}
                    color={serviceDetailModal === 'PMS' ? '#FFFFFF' : '#0C6258'}
                  />
                  <Text style={[styles.tabBtnText, serviceDetailModal === 'PMS' && styles.tabBtnTextActive]}>
                    PMS
                  </Text>
                </TouchableOpacity>
              </View>
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
                  <BootstrapIcon name="people-fill" size={17} color="#0D9488" />
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
            <View style={[styles.statCard, styles.statCardDangerAccent]}>
              <View>
                <View style={[styles.statIconWrap, { backgroundColor: '#FEF2F2' }]}>
                  <BootstrapIcon name="clock-history" size={17} color="#E11D48" />
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

          {/* ─── SCHEDULED BOOKING INFORMATION (MAIN VIEW - MATCHING WEB) ─── */}
          <View style={styles.bookingsContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="calendar-check-fill" size={18} color="#0C6258" />
                  <Text style={styles.sectionTitle}>Scheduled Booking Information</Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: '#D1ECE6',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <BootstrapIcon name="ticket-detailed" size={12} color="#0C6258" />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0C6258' }}>
                  {userBookings.length} Scheduled {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                </Text>
              </View>
            </View>

            {!currentUser ? (
              <View style={styles.emptyBox}>
                <BootstrapIcon name="person-lock" size={34} color="#0C6258" />
                <Text style={styles.emptyTitle}>Sign In to View Scheduled Bookings</Text>
                <Text style={styles.emptySub}>
                  Sign in to your account to view your scheduled pit bay appointments, track master mechanic assignments, and manage service downpayments.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 14,
                    backgroundColor: '#0C6258',
                    paddingHorizontal: 20,
                    paddingVertical: 9,
                    borderRadius: 10,
                  }}
                  onPress={() => onNavigateToLogin?.()}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>Sign In Now</Text>
                </TouchableOpacity>
              </View>
            ) : userBookings.length === 0 ? (
              <View style={styles.emptyBox}>
                <BootstrapIcon name="calendar-x" size={36} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No scheduled pit bay appointments yet</Text>
                <Text style={styles.emptySub}>
                  Book a Repair or PMS service above to reserve your guaranteed slot and master technician allocation.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#DC2626',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                    onPress={() => setServiceDetailModal('Repair')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="wrench" size={12} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Book Repair</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#0C6258',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                    onPress={() => setServiceDetailModal('PMS')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="wrench-adjustable" size={12} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Book PMS</Text>
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

                    {/* Category Selector Tabs */}
                    <View style={[styles.serviceTypeSegment, { marginBottom: 12 }]}>
                      <TouchableOpacity
                        style={[
                          styles.serviceTypeTab,
                          bookingType === 'PMS' && styles.serviceTypeTabActivePMS,
                        ]}
                        onPress={() => handleSwitchBookingType('PMS')}
                      >
                        <BootstrapIcon
                          name="wrench-adjustable"
                          size={14}
                          color={bookingType === 'PMS' ? '#FFFFFF' : '#0C6258'}
                        />
                        <Text
                          style={[
                            styles.serviceTypeTabText,
                            bookingType === 'PMS' && styles.serviceTypeTabTextActive,
                          ]}
                        >
                          ⚙️ PMS (₱2,500 • ₱500 DP)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.serviceTypeTab,
                          bookingType === 'Repair' && styles.serviceTypeTabActiveRepair,
                        ]}
                        onPress={() => handleSwitchBookingType('Repair')}
                      >
                        <BootstrapIcon
                          name="wrench"
                          size={14}
                          color={bookingType === 'Repair' ? '#FFFFFF' : '#DC2626'}
                        />
                        <Text
                          style={[
                            styles.serviceTypeTabText,
                            bookingType === 'Repair' && styles.serviceTypeTabTextActive,
                          ]}
                        >
                          🛠️ Mechanical Repair (₱1,500 • ₱300 DP)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* If Repair: Common Fault Area Chips */}
                    {bookingType === 'Repair' && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={styles.fieldLabel}>
                          Primary Mechanical Fault Area *
                        </Text>
                        <View style={styles.repairFaultChipsGrid}>
                          {REPAIR_COMMON_ISSUES.map((issue) => {
                            const isSelected = selectedRepairIssue === issue.label;
                            return (
                              <TouchableOpacity
                                key={issue.id}
                                style={[styles.repairFaultChip, isSelected && styles.repairFaultChipActive]}
                                onPress={() => setSelectedRepairIssue(issue.label)}
                              >
                                <BootstrapIcon
                                  name={issue.icon}
                                  size={13}
                                  color={isSelected ? '#DC2626' : '#64748B'}
                                />
                                <Text
                                  style={[
                                    styles.repairFaultChipText,
                                    isSelected && styles.repairFaultChipTextActive,
                                  ]}
                                >
                                  {issue.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Fixed Service Package Summary Card */}
                    {(() => {
                      const fixedSvc = FIXED_GARAGE_SERVICES[bookingType] || FIXED_GARAGE_SERVICES.PMS;
                      const isRepair = bookingType === 'Repair';
                      return (
                        <View
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: isRepair ? '#FEF2F2' : '#F0FDF4',
                            borderWidth: 1.5,
                            borderColor: isRepair ? '#FECACA' : '#BBF7D0',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <BootstrapIcon
                                name={isRepair ? 'wrench' : 'wrench-adjustable'}
                                size={14}
                                color={isRepair ? '#DC2626' : '#0C6258'}
                              />
                              <Text style={{ fontSize: 13.5, fontWeight: '800', color: isRepair ? '#991B1B' : '#064E3B' }}>
                                {fixedSvc.title}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: isRepair ? '#FEE2E2' : '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '800', color: isRepair ? '#991B1B' : '#166534' }}>
                                ⏱️ {fixedSvc.duration}
                              </Text>
                            </View>
                          </View>

                          <Text style={{ fontSize: 11.5, color: '#475569', marginBottom: 8, lineHeight: 16 }}>
                            {fixedSvc.subtitle}
                          </Text>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 8, borderRadius: 8 }}>
                            <View>
                              <Text style={{ fontSize: 10.5, color: '#64748B' }}>Fixed Total Fee</Text>
                              <Text style={{ fontSize: 15, fontWeight: '900', color: isRepair ? '#DC2626' : '#0C6258' }}>
                                ₱{fixedSvc.pricePhp.toLocaleString()}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#DC2626' }}>20% Downpayment (Due Now)</Text>
                              <Text style={{ fontSize: 15, fontWeight: '900', color: '#DC2626' }}>
                                ₱{fixedSvc.downpaymentPhp.toLocaleString()}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </View>

                  {/* SECTION 2: MOTORCYCLE INFORMATION */}
                  <View style={styles.formSectionBox}>
                    <View style={styles.formSectionHeader}>
                      <BootstrapIcon name="speedometer" size={15} color="#0C6258" />
                      <Text style={styles.formSectionHeading}>2. Motorcycle Information</Text>
                    </View>

                    {/* Quick Select from My Garage */}
                    {Array.isArray(garageMotorcycles) && garageMotorcycles.length > 0 && (
                      <View
                        style={{
                          marginBottom: 12,
                          backgroundColor: '#F0FDFA',
                          borderWidth: 1,
                          borderColor: '#CCFBF1',
                          borderRadius: 10,
                          padding: 8,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                          <BootstrapIcon name="wrench-adjustable" size={12} color="#0C6258" />
                          <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0C6258' }}>
                            Quick Select from My Garage:
                          </Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {garageMotorcycles.map((m) => {
                            const isSelected = bikePlate === m.plate_number;
                            return (
                              <TouchableOpacity
                                key={m.motorcycle_id}
                                style={{
                                  backgroundColor: isSelected ? '#0C6258' : '#FFFFFF',
                                  borderWidth: 1.5,
                                  borderColor: isSelected ? '#0C6258' : '#99F6E4',
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                onPress={() => {
                                  setBikeBrand(m.brand);
                                  setBikeModel(m.model);
                                  setBikePlate(m.plate_number);
                                  if (m.odometer) setBikeOdo(m.odometer);
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: isSelected ? '800' : '700',
                                    color: isSelected ? '#FFFFFF' : '#0F172A',
                                  }}
                                >
                                  {m.is_primary ? '★ ' : ''}{m.brand} {m.model} ({m.plate_number})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}

                    {/* Brand Selector */}
                    <Text style={styles.fieldLabel}>Motorcycle Brand *</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'KTM', 'Vespa', 'Other'].map((b) => (
                        <TouchableOpacity
                          key={b}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: bikeBrand === b ? '#0C6258' : '#CBD5E1',
                            backgroundColor: bikeBrand === b ? '#D1ECE6' : '#FFFFFF',
                          }}
                          onPress={() => setBikeBrand(b)}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: bikeBrand === b ? '800' : '600',
                              color: bikeBrand === b ? '#0C6258' : '#475569',
                            }}
                          >
                            {b}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

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
                      const fixedSvc = FIXED_GARAGE_SERVICES[bookingType] || FIXED_GARAGE_SERVICES.PMS;
                      const fullPrice = fixedSvc.pricePhp;
                      const dp = fixedSvc.downpaymentPhp;
                      const rem = fullPrice - dp;

                      return (
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>Fixed Service Fee ({bookingType}):</Text>
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

      {/* ─── SERVICE PACKAGE DETAIL MODAL (REPAIR & PMS - MATCHING WEB) ─── */}
      <Modal
        visible={serviceDetailModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setServiceDetailModal(null)}
      >
        <View style={styles.popupModalOverlay}>
          <TouchableOpacity
            style={styles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setServiceDetailModal(null)}
          />

          <View
            style={[
              styles.popupModalCard,
              {
                maxWidth: 600,
                width: '100%',
                padding: 0,
                overflow: 'hidden',
                borderRadius: 24,
              },
            ]}
          >
            {serviceDetailModal === 'Repair' ? (
              <View>
                {/* Header Banner */}
                <View
                  style={{
                    backgroundColor: '#DC2626',
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <BootstrapIcon name="wrench" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                      MECHANICAL & ELECTRICAL REPAIR
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 16,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' }}>
                        ⏱️ 60 - 120 mins
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setServiceDetailModal(null)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="x-lg" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Body Content */}
                <ScrollView style={{ padding: 20, maxHeight: 520 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                    Precision Diagnosis & Repair
                  </Text>
                  <Text style={{ fontSize: 12.5, color: '#64748B', lineHeight: 18, marginBottom: 16 }}>
                    Master technician isolation of engine knocks, electrical gremlins, transmission slip, or suspension leaks using OBD-II diagnostics and track-proven tools.
                  </Text>

                  {/* Pricing Box */}
                  <View
                    style={{
                      backgroundColor: '#FEF2F2',
                      borderWidth: 1,
                      borderColor: '#FECACA',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12.5, color: '#991B1B', fontWeight: '700' }}>Fixed Diagnostic & Labor Base</Text>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: '#DC2626' }}>₱1,500</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#FEE2E2', marginVertical: 6 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="shield-lock-fill" size={12} color="#DC2626" />
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#DC2626' }}>20% Downpayment (Due Now):</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#DC2626' }}>₱300</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>Balance at Pit Bay Completion:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>₱1,200</Text>
                    </View>
                  </View>

                  {/* Inclusions */}
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    What's Included in this Fixed Service:
                  </Text>
                  <View style={{ gap: 8, marginBottom: 18 }}>
                    {FIXED_GARAGE_SERVICES.Repair.inclusions.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <BootstrapIcon name="check-circle-fill" size={13} color="#DC2626" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12, color: '#334155', flex: 1, lineHeight: 16 }}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: '#F1F5F9',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                      onPress={() => setServiceDetailModal(null)}
                    >
                      <Text style={{ color: '#475569', fontSize: 12.5, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: '#DC2626',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onPress={() => {
                        setServiceDetailModal(null);
                        handleOpenBooking('Repair');
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="calendar2-check-fill" size={13} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                        Book Repair (₱300 DP)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            ) : serviceDetailModal === 'PMS' ? (
              <View>
                {/* Header Banner */}
                <View
                  style={{
                    backgroundColor: '#0C6258',
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <BootstrapIcon name="wrench-adjustable" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                      PREVENTIVE MAINTENANCE (PMS)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 16,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' }}>
                        ⏱️ 90 mins
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setServiceDetailModal(null)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="x-lg" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Body Content */}
                <ScrollView style={{ padding: 20, maxHeight: 520 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                    Comprehensive 20-Point PMS
                  </Text>
                  <Text style={{ fontSize: 12.5, color: '#64748B', lineHeight: 18, marginBottom: 16 }}>
                    Track-grade comprehensive fluid flush, chassis torque check, and multi-point safety inspection to keep your motorcycle in peak operating condition.
                  </Text>

                  {/* Pricing Box */}
                  <View
                    style={{
                      backgroundColor: '#F0FDF4',
                      borderWidth: 1,
                      borderColor: '#BBF7D0',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12.5, color: '#166534', fontWeight: '700' }}>Fixed Total Package Fee</Text>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: '#0C6258' }}>₱2,500</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#DCFCE7', marginVertical: 6 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="shield-lock-fill" size={12} color="#DC2626" />
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#DC2626' }}>20% Downpayment (Due Now):</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#DC2626' }}>₱500</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>Balance at Pit Bay Completion:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>₱2,000</Text>
                    </View>
                  </View>

                  {/* Inclusions */}
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    What's Included in this Fixed Service:
                  </Text>
                  <View style={{ gap: 8, marginBottom: 18 }}>
                    {FIXED_GARAGE_SERVICES.PMS.inclusions.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <BootstrapIcon name="check-circle-fill" size={13} color="#0C6258" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12, color: '#334155', flex: 1, lineHeight: 16 }}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: '#F1F5F9',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                      onPress={() => setServiceDetailModal(null)}
                    >
                      <Text style={{ color: '#475569', fontSize: 12.5, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: '#0C6258',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onPress={() => {
                        setServiceDetailModal(null);
                        handleOpenBooking('PMS');
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="calendar2-check-fill" size={13} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                        Book PMS (₱500 DP)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            ) : null}
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
