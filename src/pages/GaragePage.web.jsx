import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, ToastNotification, BottomNavBar, UserProfileDropdown, UserProfileButton, BrandLogo, NotificationDropdown } from '../components';
import { LiveOrderTrackingMapModal, GCashPaymentModal, ConfirmModal } from '../components/modals';
import { garageWebStyles as gStyles } from '../styles/web/garagePage.web.styles';
import { useAuth } from '../context/AuthContext';
import {
  garageService,
  REPAIR_COMMON_ISSUES,
  BOOKING_CATEGORIES,
  FIXED_GARAGE_SERVICES,
  GARAGE_BRANCHES,
  TIME_SLOTS,
  AVAILABLE_MECHANICS,
} from '../services/garageService';
import { pickImageFromFile } from '../utils/imagePickerHelper';
import { orderService } from '../services/orderService';
import { motorcycleService } from '../services/motorcycleService';
import { useCart } from '../context/CartContext';
import { notificationService } from '../services/notificationService';
import { useWishlist } from '../context/WishlistContext';

export default function GaragePageWeb({
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onLogout,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { wishlistCount } = useWishlist();
  const { cartItemCount } = useCart();

  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount(currentUser?.id));
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(notificationService.getUnreadCount(currentUser?.id));
    });
    return () => unsub?.();
  }, [currentUser]);

  const flagshipBranch = GARAGE_BRANCHES[0] || {
    name: 'MotoTrack Flagship Central Hub & Pit Bays',
    address: 'East Poblacion, City of Naga, Cebu (South Road Corridor)',
    phone: '(+63) 917 882 9102',
    bays: '6 Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay',
    hours: 'Mon - Sun: 8:00 AM - 6:30 PM',
  };

  const [activeTab, setActiveTab] = useState('Scheduled');
  const [serviceDetailModal, setServiceDetailModal] = useState(null); // 'Repair' | 'PMS' | null
  const [servicesList, setServicesList] = useState(() => garageService.getServices());
  const [userBookings, setUserBookings] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Live Mechanic Availability & Today Slot Status States
  const [mechanicsData, setMechanicsData] = useState(() => garageService.getAvailableMechanics());
  const [todaySlotsData, setTodaySlotsData] = useState(() => garageService.getDaySlotAvailability());
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [isOverrideFull, setIsOverrideFull] = useState(() => garageService.isTodayFullyBookedOverride());

  const refreshAvailability = () => {
    setMechanicsData(garageService.getAvailableMechanics());
    setTodaySlotsData(garageService.getDaySlotAvailability());
    setIsOverrideFull(garageService.isTodayFullyBookedOverride());
  };

  const handleToggleDemoFull = () => {
    const next = !isOverrideFull;
    garageService.setTodayFullyBookedOverride(next);
    setIsOverrideFull(next);
    refreshAvailability();
    showToast(next ? '🔴 Pit Bays simulated as Fully Booked for Today' : '🟢 Pit Bays restored to Live Open Slot Availability');
  };

  // 20% Non-Refundable Downpayment Payment State
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);

  // Cancellation Warning Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Booking Wizard State
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingType, setBookingType] = useState('PMS'); // 'Repair' | 'PMS'
  const [selectedRepairIssue, setSelectedRepairIssue] = useState('Engine & Transmission');

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeOdo, setBikeOdo] = useState('6,500 km');
  const [selectedDate, setSelectedDate] = useState(() => {
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
    setSelectedDate(dateStr);
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      setCalendarViewDate(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
    }
  };
  const [selectedTime, setSelectedTime] = useState('10:30 AM - 12:00 PM');
  const [ownerName, setOwnerName] = useState(currentUser?.name || '');
  const [ownerPhone, setOwnerPhone] = useState(currentUser?.phone || '');
  const [serviceNotes, setServiceNotes] = useState('');
  const [motorcyclePhotos, setMotorcyclePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [garageMotorcycles, setGarageMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );

  // Sync profile details and primary garage motorcycle if logged in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setOwnerName(currentUser.name);
      if (currentUser.phone) setOwnerPhone(currentUser.phone);
      if (currentUser.bikeBrand) setBikeBrand(currentUser.bikeBrand);
      if (currentUser.bikeModel) setBikeModel(currentUser.bikeModel);
      if (currentUser.bikePlate) setBikePlate(currentUser.bikePlate);
      if (currentUser.bikeOdo) setBikeOdo(currentUser.bikeOdo);
    }

    let unsub = () => {};
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
      try {
        unsub?.();
      } catch (_e) {}
    };
  }, [currentUser]);

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const refreshBookings = () => {
    if (currentUser?.email || currentUser?.id || currentUser?.name || currentUser?.fullName) {
      const bookings = garageService.getUserBookings(
        currentUser.email,
        currentUser.id,
        currentUser.name || currentUser.fullName
      );
      setUserBookings(Array.isArray(bookings) ? bookings : []);
    } else {
      setUserBookings([]);
    }
  };

  useEffect(() => {
    garageService.fetchMechanics().then(() => {
      refreshAvailability();
    }).catch(() => {});
    refreshBookings();
    refreshAvailability();
    const unsubBookings = garageService.subscribeBookings(() => {
      refreshBookings();
      refreshAvailability();
    });
    return () => unsubBookings();
  }, [currentUser]);

  const handleOpenBooking = (forcedType) => {
    const cat = forcedType === 'Repair' ? 'Repair' : 'PMS';
    setBookingType(cat);
    setSelectedService(FIXED_GARAGE_SERVICES[cat]);
    setIsBookingModalOpen(true);
  };

  const handleQuickBook = (type, forceTomorrow = false) => {
    if (forceTomorrow || todaySlotsData.isFullyBooked) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = tomorrow.toISOString().split('T')[0];
      setSelectedDate(tomStr);
      showToast('📅 Setting appointment date to tomorrow (Next Available Slot).');
    }
    handleOpenBooking(type);
  };

  const handleSwitchBookingType = (newType) => {
    const target = newType === 'Repair' ? 'Repair' : 'PMS';
    setBookingType(target);
    setSelectedService(FIXED_GARAGE_SERVICES[target]);
  };

  // Photo Picker
  const handlePickPhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      const res = await pickImageFromFile();
      if (res && res.success && res.uri) {
        setMotorcyclePhotos((prev) => [...prev, res.uri]);
        showToast('📸 Photo added to service ticket');
      } else if (res?.error && res.error !== 'Selection cancelled') {
        showToast('⚠️ ' + res.error);
      }
    } catch (_e) {
      showToast('⚠️ Could not pick image');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index) => {
    setMotorcyclePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // 20% Downpayment Gating: Customer must pay 20% advance downpayment to book
  const handleConfirmBooking = () => {
    if (!bikeModel.trim() || !bikePlate.trim() || !ownerName.trim()) {
      showToast('⚠️ Please fill in all required motorcycle details (Model, Plate, Rider Name).');
      return;
    }
    if (!ownerPhone.trim()) {
      showToast('⚠️ Please enter your contact mobile number.');
      return;
    }
    if (!selectedDate || !selectedTime) {
      showToast('⚠️ Please choose an appointment date and pit bay time slot.');
      return;
    }

    const targetAvailability = garageService.getDaySlotAvailability(selectedDate);
    if (targetAvailability.isFullyBooked) {
      showToast('❌ All pit bays are fully booked on this date. Please choose another date.');
      return;
    }
    const isSlotTaken = targetAvailability.slots.some(
      (s) => s.timeSlot === selectedTime && s.isBooked
    );
    if (isSlotTaken) {
      showToast('❌ The selected time slot is already occupied. Please choose an available slot.');
      return;
    }

    const currentSvc = FIXED_GARAGE_SERVICES[bookingType] || FIXED_GARAGE_SERVICES.PMS;
    const catPrefix = bookingType === 'Repair' ? 'REP' : 'PMS';

    const finalNotes =
      bookingType === 'Repair' && selectedRepairIssue
        ? `[Fault: ${selectedRepairIssue}] ${serviceNotes.trim()}`
        : serviceNotes.trim();

    const bookingId = `BK-${catPrefix}-` + Math.floor(10000 + Math.random() * 90000);
    const fullPricePhp = currentSvc.pricePhp;
    const calculatedDownpayment = currentSvc.downpaymentPhp;
    const calculatedBalance = Math.max(0, fullPricePhp - calculatedDownpayment);

    const bookingDraft = {
      id: bookingId,
      booking_id: bookingId,
      serviceId: currentSvc.id,
      service_id: currentSvc.id,
      serviceName: currentSvc.title,
      service_title: currentSvc.title,
      servicePrice: currentSvc.pricePhp / 50,
      pricePhp: fullPricePhp,
      downpayment_required: true,
      downpayment_percent: 20,
      downpayment_amount: calculatedDownpayment,
      remaining_balance: calculatedBalance,
      is_non_refundable: true,
      non_refundable_policy_acknowledged: true,
      category: bookingType,
      repair_type: bookingType === 'Repair' ? selectedRepairIssue : undefined,
      userEmail: currentUser?.email || 'rider@mototrack.com',
      customer_email: currentUser?.email || 'rider@mototrack.com',
      userName: ownerName,
      customer_name: ownerName,
      userPhone: ownerPhone,
      customer_phone: ownerPhone,
      customer_id: currentUser?.customer_id || currentUser?.id,
      bikeBrand,
      bike_brand: bikeBrand,
      bikeModel,
      bike_model: bikeModel,
      bikePlate,
      plate_number: bikePlate,
      bikeOdo,
      bike_odo: bikeOdo,
      odometer: bikeOdo,
      photos: motorcyclePhotos,
      branch: flagshipBranch.name,
      branch_address: flagshipBranch.address,
      appointment_date: selectedDate,
      date: selectedDate,
      time_slot: selectedTime,
      time: selectedTime,
      notes: finalNotes,
      status: 'Pending',
      service_progress: 5,
      createdAt: new Date().toISOString(),
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

    await garageService.addBooking(completedBooking);
    refreshBookings();
    setIsGcashModalOpen(false);
    setIsBookingModalOpen(false);
    setBookingStep(1);
    setMotorcyclePhotos([]);
    setPendingBookingData(null);
    showToast(`🏁 Pit Bay Slot Booked! 20% Non-Refundable Downpayment (₱${pendingBookingData.downpayment_amount.toLocaleString()}) Confirmed.`);
    setActiveTab('Scheduled');
    setTimeout(() => {
      const el = document.getElementById('scheduled-booking-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handlePromptCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    await garageService.cancelBooking(bookingToCancel.id);
    refreshBookings();
    setIsCancelModalOpen(false);
    setBookingToCancel(null);
    showToast('Appointment cancelled. 20% downpayment was forfeited per policy.');
  };

  const numColumns = windowWidth >= 1200 ? 3 : windowWidth >= 768 ? 2 : 1;
  const cardWidth = `${100 / numColumns - 1.5}%`;

  return (
    <View style={gStyles.container}>
      <StatusBar style="dark" />
      <ToastNotification message={toastMessage} />

      {/* ─── DESKTOP TOP STICKY NAVBAR ─── */}
      <View style={gStyles.headerWrapper}>
        <View style={gStyles.headerInner}>
          <TouchableOpacity
            style={gStyles.logoWrap}
            onPress={() => onNavigateToStore?.()}
            activeOpacity={0.8}
          >
            <BrandLogo size={40} textColor="#FFFFFF" />
          </TouchableOpacity>

          {/* Center Navigation: Store & AI Vision */}
          <View style={gStyles.headerCenterNav}>
            {/* Store Button */}
            <TouchableOpacity
              style={gStyles.headerCenterBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.85}
              title="Store"
            >
              <BootstrapIcon name="shop" size={16} color="#FFFFFF" />
              <Text style={gStyles.headerCenterBtnText}>Store</Text>
            </TouchableOpacity>

            {/* Customize Button */}
            <TouchableOpacity
              style={gStyles.headerCenterBtn}
              onPress={() => {
                if (onNavigateToCustomizer) onNavigateToCustomizer();
                else if (onNavigateToCustomize) onNavigateToCustomize();
              }}
              activeOpacity={0.8}
              title="Customize"
            >
              <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
              <Text style={gStyles.headerCenterBtnText}>Customize</Text>
            </TouchableOpacity>
          </View>

          {/* Right Header Actions */}
          <View style={gStyles.headerActions}>
            {/* Favorites Button */}
            <TouchableOpacity
              style={gStyles.navActionIconBtn}
              onPress={() => onNavigateToWishlist?.()}
              activeOpacity={0.8}
              title="Favorites"
            >
              <BootstrapIcon name="heart" size={16} color="#FFFFFF" />
              {wishlistCount > 0 && (
                <View style={gStyles.navBadgeCircle}>
                  <Text style={gStyles.navBadgeText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Notifications Button */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={gStyles.navActionIconBtn}
                onPress={() => {
                  setIsUserDropdownOpen(false);
                  setIsNotifDropdownOpen((prev) => !prev);
                }}
                activeOpacity={0.8}
                title="Notifications"
              >
                <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                {unreadNotifCount > 0 && (
                  <View style={gStyles.navBadgeCircle}>
                    <Text style={gStyles.navBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <NotificationDropdown
                isOpen={isNotifDropdownOpen}
                onClose={() => setIsNotifDropdownOpen(false)}
                onNavigateToScreen={(screen) => {
                  if (screen === 'store') onNavigateToStore?.();
                  else if (screen === 'orders') onNavigateToOrders?.();
                }}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Button */}
            <TouchableOpacity
              style={gStyles.navActionIconBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.85}
              title="Shopping Cart"
            >
              <BootstrapIcon name="cart3" size={17} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <View style={gStyles.navBadgeCircle}>
                  <Text style={gStyles.navBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Admin Badge */}
            {currentUser?.role === 'admin' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: 'rgba(12, 98, 88, 0.4)',
                  borderWidth: 1,
                  borderColor: '#0C6258',
                }}
                onPress={() => onNavigateToAdmin?.()}
                activeOpacity={0.8}
                title="Admin Panel"
              >
                <BootstrapIcon name="shield-lock-fill" size={16} color="#56B9A1" />
              </TouchableOpacity>
            )}

            {/* Auth: Sign In & Sign Up OR Logged In Profile */}
            {currentUser ? (
              <View style={[gStyles.loggedInContainer, { position: 'relative' }]}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsUserDropdownOpen(!isUserDropdownOpen);
                  }}
                  size={40}
                />

                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isUserDropdownOpen}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('overview')}
                  onNavigateToOrders={() => onNavigateToOrders?.()}
                  onNavigateToProfile={() => onNavigateToProfile?.('profile')}
                  onNavigateToSettings={() => onNavigateToProfile?.('settings')}
                  onNavigateToAdmin={() => onNavigateToAdmin?.()}
                  onLogout={() => {
                    if (onLogout) {
                      onLogout();
                    } else {
                      logout?.();
                      setToastMessage('Logged out successfully');
                      onNavigateToStore?.();
                    }
                  }}
                />
              </View>
            ) : (
              <View style={gStyles.authButtonsRow}>
                <TouchableOpacity
                  style={gStyles.signInHeaderBtn}
                  onPress={() => onNavigateToLogin?.()}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                  <Text style={gStyles.signInHeaderBtnText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── GARAGE MAIN CONTENT ─── */}
      <ScrollView contentContainerStyle={gStyles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={gStyles.maxContainer}>
          {/* ─── GARAGE HEADER & QUICK ACTIONS ─── */}
          <View style={gStyles.garageHeaderRow}>
            <View style={gStyles.garageHeaderLeft}>
              <Text style={gStyles.garageHeaderTitle}>Motorcycle Repair & Maintenance</Text>
            </View>

            <View style={gStyles.garageHeaderActions}>
              <View style={gStyles.tabButtons}>
                {/* 1. Repair Button (Opens Modal) */}
                <TouchableOpacity
                  style={[gStyles.tabBtn, serviceDetailModal === 'Repair' && gStyles.tabBtnActive]}
                  onPress={() => setServiceDetailModal('Repair')}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon
                    name="wrench"
                    size={14}
                    color={serviceDetailModal === 'Repair' ? '#FFFFFF' : '#DC2626'}
                  />
                  <Text style={[gStyles.tabBtnText, serviceDetailModal === 'Repair' && gStyles.tabBtnTextActive]}>
                    Repair
                  </Text>
                </TouchableOpacity>

                {/* 2. PMS Booking Button (Opens Modal) */}
                <TouchableOpacity
                  style={[gStyles.tabBtn, serviceDetailModal === 'PMS' && gStyles.tabBtnActive]}
                  onPress={() => setServiceDetailModal('PMS')}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon
                    name="wrench-adjustable"
                    size={14}
                    color={serviceDetailModal === 'PMS' ? '#FFFFFF' : '#0C6258'}
                  />
                  <Text style={[gStyles.tabBtnText, serviceDetailModal === 'PMS' && gStyles.tabBtnTextActive]}>
                    PMS
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ─── 4 KPI STATS GRID (COMPACT & SLEEK) ─── */}
          <div className="flex flex-row flex-wrap gap-4 mb-6 w-full">
            {/* Card 1: MECHANICS AVAILABLE */}
            <div
              className="premium-glass-card premium-hover-lift flex-1 min-w-[190px] min-h-[170px] p-5 border-l-4 border-teal-600 flex flex-col justify-between"
              onClick={() => setIsRosterModalOpen(true)}
            >
              <div>
                <div className="w-10 h-10 mb-2.5 icon-glow-teal">
                  <BootstrapIcon name="people-fill" size={18} color="#0d9488" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-[1px] block">
                  Mechanics Available
                </span>
                <span className="text-[30px] font-black text-slate-900 tracking-tight text-gradient-dark block leading-tight">
                  {mechanicsData.availableCount}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-400 leading-snug block mt-2">
                {mechanicsData.availableCount > 0
                  ? `${mechanicsData.availableCount} of ${mechanicsData.totalCount} on-duty & available`
                  : 'All technicians busy in pit bays'}
              </span>
            </div>

            {/* Card 2: TODAY'S SLOTS */}
            <div
              className={`premium-glass-card premium-hover-lift flex-1 min-w-[190px] min-h-[170px] p-5 border-l-4 flex flex-col justify-between ${
                todaySlotsData.isFullyBooked ? 'border-rose-500 bg-rose-50/20' : 'border-amber-500'
              }`}
            >
              <div>
                <div className={`w-10 h-10 mb-2.5 ${todaySlotsData.isFullyBooked ? 'icon-glow-rose' : 'icon-glow-amber'}`}>
                  <BootstrapIcon
                    name={todaySlotsData.isFullyBooked ? 'calendar-x-fill' : 'calendar-check'}
                    size={18}
                    color={todaySlotsData.isFullyBooked ? '#e11d48' : '#d97706'}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-[1px] block">
                  Today's Slots
                </span>
                <span
                  className={`text-[30px] font-black tracking-tight block leading-tight ${
                    todaySlotsData.isFullyBooked ? 'text-rose-600' : 'text-slate-900 text-gradient-dark'
                  }`}
                >
                  {todaySlotsData.isFullyBooked ? 'No Slot Today' : todaySlotsData.availableSlotsCount}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-400 leading-snug block mt-2">
                {todaySlotsData.isFullyBooked
                  ? 'Fully booked for today (0 remaining)'
                  : `${todaySlotsData.bookedSlotsCount} of ${todaySlotsData.totalSlots} daily slots reserved`}
              </span>
            </div>

            {/* Card 3: NEXT OPENING */}
            <div className="premium-glass-card premium-hover-lift flex-1 min-w-[190px] min-h-[170px] p-5 border-l-4 border-rose-500 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 mb-2.5 icon-glow-rose">
                  <BootstrapIcon name="clock-history" size={18} color="#e11d48" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-[1px] block">
                  Next Opening
                </span>
                <span className="text-[30px] font-black text-slate-900 tracking-tight text-gradient-dark block leading-tight">
                  {todaySlotsData.isFullyBooked ? 'Tomorrow' : 'Today'}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-400 leading-snug block mt-2">
                {todaySlotsData.isFullyBooked ? '09:00 AM - 10:30 AM (Next Slot)' : 'Immediate express pit bay slot'}
              </span>
            </div>

            {/* Card 4: PIT BAY CAPACITY */}
            <div className="premium-glass-card premium-hover-lift flex-1 min-w-[190px] min-h-[170px] p-5 border-l-4 border-blue-600 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 mb-2.5 icon-glow-blue">
                  <BootstrapIcon name="speedometer2" size={18} color="#2563eb" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 mb-0.5 uppercase tracking-[1px] block">
                  Pit Bay Capacity
                </span>
                <span className="text-[30px] font-black text-slate-900 tracking-tight text-gradient-dark block leading-tight">
                  6
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-400 leading-snug block mt-2">
                Dedicated bays & Dynojet cell
              </span>
            </div>
          </div>



          {/* Notice Banner if Fully Booked Today */}
          {todaySlotsData.isFullyBooked && (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FCA5A5',
                borderRadius: 14,
                padding: 14,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <BootstrapIcon name="exclamation-octagon-fill" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#991B1B', marginBottom: 2 }}>
                  Notice: Service Bays Are Fully Booked For Today
                </Text>
                <Text style={{ fontSize: 12, color: '#B91C1C' }}>
                  All 6 pit bays are currently at maximum capacity. You can pre-book a guaranteed slot for tomorrow or future dates to reserve immediate technician assignment.
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
                onPress={() => handleQuickBook('PMS', true)}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Book Tomorrow</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── SCHEDULED BOOKING INFORMATION (MAIN VIEW) ─── */}
          <div id="scheduled-booking-section" className="w-full">
            <View style={gStyles.bookingsContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <BootstrapIcon name="calendar3" size={18} color="#0C6258" />
                    <Text style={[gStyles.sectionTitle, { marginBottom: 0 }]}>Scheduled Bookings</Text>
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: '#D1ECE6',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <BootstrapIcon name="ticket-detailed" size={13} color="#0C6258" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#0C6258' }}>
                    {userBookings.length} Scheduled {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                  </Text>
                </View>
              </View>

              {!currentUser ? (
                <View
                  style={[
                    gStyles.emptyBox,
                    {
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 20,
                      padding: 32,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <BootstrapIcon name="person-lock" size={36} color="#0C6258" />
                  <Text style={[gStyles.emptyTitle, { marginTop: 12 }]}>Sign In to View Scheduled Bookings</Text>
                  <Text style={[gStyles.emptySub, { textAlign: 'center', maxWidth: 440 }]}>
                    Sign in to your account to view your scheduled appointments, track master mechanic assignments, and manage service downpayments.
                  </Text>
                  <TouchableOpacity
                    style={{
                      marginTop: 16,
                      backgroundColor: '#0C6258',
                      paddingHorizontal: 22,
                      paddingVertical: 10,
                      borderRadius: 12,
                      cursor: 'pointer',
                    }}
                    onPress={() => {
                      setRedirectReason('Please sign in to view your booked pitstop appointments.');
                      onNavigateToLogin?.();
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Sign In Now</Text>
                  </TouchableOpacity>
                </View>
              ) : userBookings.length === 0 ? (
                <View style={gStyles.emptyBox}>
                  <BootstrapIcon name="calendar-x" size={36} color="#94A3B8" />
                  <Text style={gStyles.emptyTitle}>No scheduled appointments yet</Text>
                  <Text style={gStyles.emptySub}>
                    Book a Repair or PMS service above to reserve your guaranteed slot and master technician allocation.
                  </Text>
                </View>
              ) : (
                <View style={gStyles.bookingsGrid}>
                  {userBookings.map((b) => (
                    <View key={b.id} style={gStyles.bookingCard}>
                      <View style={gStyles.bookingCardTop}>
                        <View>
                          <Text style={gStyles.bookingId}>REF: {b.id}</Text>
                          <Text style={gStyles.bookingServiceTitle}>{b.serviceName || b.service_title}</Text>
                          {b.repair_type ? (
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626', marginTop: 2 }}>
                              Fault: {b.repair_type}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            gStyles.statusPillConfirmed,
                            b.status === 'Pending' && { backgroundColor: '#FEF3C7' },
                            b.status === 'Inspection' && { backgroundColor: '#EFF6FF' },
                            b.status === 'Estimate Pending' && { backgroundColor: '#FEE2E2' },
                            b.status === 'In Progress' && { backgroundColor: '#E0F2FE' },
                            b.status === 'Service Done' && { backgroundColor: '#DCFCE7' },
                            b.status === 'Paid' && { backgroundColor: '#D1ECE6' },
                            b.status === 'Closed' && { backgroundColor: '#F1F5F9' },
                            b.status === 'Rejected' && { backgroundColor: '#FEE2E2' },
                          ]}
                        >
                          <Text
                            style={[
                              gStyles.statusPillText,
                              b.status === 'Pending' && { color: '#D97706' },
                              b.status === 'Inspection' && { color: '#2563EB' },
                              b.status === 'Estimate Pending' && { color: '#DC2626' },
                              b.status === 'In Progress' && { color: '#0284C7' },
                              b.status === 'Service Done' && { color: '#16A34A' },
                              b.status === 'Paid' && { color: '#0C6258' },
                              b.status === 'Closed' && { color: '#475569' },
                              b.status === 'Rejected' && { color: '#DC2626' },
                            ]}
                          >
                            {b.status === 'Pending'
                              ? '⏳ Pending Review'
                              : b.status === 'Inspection'
                              ? '🔍 In Inspection'
                              : b.status === 'Estimate Pending'
                              ? '⚠️ Estimate Pending'
                              : b.status === 'In Progress'
                              ? '🔧 In Progress'
                              : b.status === 'Service Done'
                              ? '✓ Service Done'
                              : b.status === 'Paid'
                              ? '✓ Bay Service Paid'
                              : b.status === 'Closed'
                              ? '✓ Finished & Released'
                              : 'Cancelled'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
                        <BootstrapIcon name="calendar2-event" size={13} color="#64748B" />
                        <Text style={{ fontSize: 13, color: '#334155', fontWeight: '700' }}>
                          {b.appointment_date || b.date} • {b.appointment_time || b.timeSlot}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <BootstrapIcon name="bicycle" size={13} color="#64748B" />
                        <Text style={{ fontSize: 12.5, color: '#475569' }}>
                          {b.bikeBrand || b.brand} {b.bikeModel || b.model} ({b.bikePlate || b.plateNumber || 'No Plate'})
                        </Text>
                      </View>

                      <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginTop: 4 }}>
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
                      </View>
                      
                      {b.status !== 'Closed' && b.status !== 'Cancelled' && (
                        <TouchableOpacity
                          style={[gStyles.cancelBookingBtn, { marginTop: 12 }]}
                          onPress={() => handlePromptCancelBooking(b)}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                          <Text style={gStyles.cancelBookingBtnText}>Cancel Appointment</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </div>
        </View>
      </ScrollView>

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Garage"
          onTabChange={(tab) => {
            if (tab === 'Home') {
              onNavigateToStore?.();
            } else if (tab === 'Customize') {
              if (onNavigateToCustomizer) onNavigateToCustomizer();
              else if (onNavigateToCustomize) onNavigateToCustomize();
              else onNavigateToStore?.();
            } else if (tab === 'Garage') {
              setActiveTab('All');
            } else if (tab === 'Orders') {
              onNavigateToOrders ? onNavigateToOrders() : onNavigateToProfile?.('orders');
            } else if (tab === 'Favorites') {
              onNavigateToWishlist?.();
            } else if (tab === 'Admin') {
              if (currentUser?.role === 'admin') {
                onNavigateToAdmin?.();
              }
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.();
              }
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}

      {/* ─── SERVICE PACKAGE DETAIL MODAL (REPAIR & PMS) ─── */}
      <Modal
        visible={serviceDetailModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setServiceDetailModal(null)}
      >
        <View style={gStyles.popupModalOverlay}>
          <TouchableOpacity
            style={gStyles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setServiceDetailModal(null)}
          />

          <View
            style={[
              gStyles.popupModalCard,
              {
                maxWidth: 620,
                width: '100%',
                padding: 0,
                overflow: 'hidden',
                borderRadius: 24,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              },
            ]}
          >
            {serviceDetailModal === 'Repair' ? (
              <View>
                {/* Header Banner */}
                <View
                  style={{
                    backgroundColor: '#DC2626',
                    paddingHorizontal: 22,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <BootstrapIcon name="wrench" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.5 }}>
                      MECHANICAL & ELECTRICAL REPAIR
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 20,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        ⏱️ 60 - 120 mins
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setServiceDetailModal(null)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="x-lg" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Body Content */}
                <View style={{ padding: 24, maxHeight: 560, overflowY: 'auto' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                    Precision Diagnosis & Repair
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 18 }}>
                    Master technician isolation of engine knocks, electrical gremlins, transmission slip, or suspension leaks using OBD-II diagnostics and track-proven tools.
                  </Text>

                  {/* Pricing Box */}
                  <View
                    style={{
                      backgroundColor: '#FEF2F2',
                      borderWidth: 1,
                      borderColor: '#FECACA',
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 18,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#991B1B', fontWeight: '700' }}>Fixed Diagnostic & Labor Base</Text>
                      <Text style={{ fontSize: 24, fontWeight: '900', color: '#DC2626' }}>₱1,500</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#FEE2E2', marginVertical: 6 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="shield-lock-fill" size={13} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>20% Downpayment (Due Now):</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: '#DC2626' }}>₱300</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 11.5, color: '#64748B' }}>Balance at Pit Bay Completion:</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#334155' }}>₱1,200</Text>
                    </View>
                  </View>

                  {/* Inclusions */}
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                    What's Included in this Fixed Service:
                  </Text>
                  <View style={{ gap: 8, marginBottom: 20 }}>
                    {FIXED_GARAGE_SERVICES.Repair.inclusions.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <BootstrapIcon name="check-circle-fill" size={14} color="#DC2626" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12.5, color: '#334155', flex: 1, lineHeight: 17 }}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions: Cancel and Book */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: '#F1F5F9',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        cursor: 'pointer',
                      }}
                      onPress={() => setServiceDetailModal(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 22,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: '#DC2626',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                      }}
                      onPress={() => {
                        setServiceDetailModal(null);
                        handleOpenBooking('Repair');
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="calendar2-check-fill" size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                        Book Repair (₱300 DP)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : serviceDetailModal === 'PMS' ? (
              <View>
                {/* Header Banner */}
                <View
                  style={{
                    backgroundColor: '#0C6258',
                    paddingHorizontal: 22,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <BootstrapIcon name="wrench-adjustable" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.5 }}>
                      PREVENTIVE MAINTENANCE (PMS)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 20,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                        ⏱️ 90 mins
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setServiceDetailModal(null)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="x-lg" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Body Content */}
                <View style={{ padding: 24, maxHeight: 560, overflowY: 'auto' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                    Comprehensive 20-Point PMS
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 18 }}>
                    Track-grade comprehensive fluid flush, chassis torque check, and multi-point safety inspection to keep your motorcycle in peak operating condition.
                  </Text>

                  {/* Pricing Box */}
                  <View
                    style={{
                      backgroundColor: '#F0FDF4',
                      borderWidth: 1,
                      borderColor: '#BBF7D0',
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 18,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#166534', fontWeight: '700' }}>Fixed Total Package Fee</Text>
                      <Text style={{ fontSize: 24, fontWeight: '900', color: '#0C6258' }}>₱2,500</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#DCFCE7', marginVertical: 6 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="shield-lock-fill" size={13} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>20% Downpayment (Due Now):</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: '#DC2626' }}>₱500</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ fontSize: 11.5, color: '#64748B' }}>Balance at Pit Bay Completion:</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#334155' }}>₱2,000</Text>
                    </View>
                  </View>

                  {/* Inclusions */}
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                    What's Included in this Fixed Service:
                  </Text>
                  <View style={{ gap: 8, marginBottom: 20 }}>
                    {FIXED_GARAGE_SERVICES.PMS.inclusions.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <BootstrapIcon name="check-circle-fill" size={14} color="#0C6258" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12.5, color: '#334155', flex: 1, lineHeight: 17 }}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions: Cancel and Book */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: '#F1F5F9',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        cursor: 'pointer',
                      }}
                      onPress={() => setServiceDetailModal(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700' }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 22,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: '#0C6258',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(12, 98, 88, 0.3)',
                      }}
                      onPress={() => {
                        setServiceDetailModal(null);
                        handleOpenBooking('PMS');
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="calendar2-check-fill" size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                        Book PMS (₱500 DP)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ─── ONE-PAGE POPUP BOOKING FORM MODAL ─── */}
      <Modal
        visible={isBookingModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsBookingModalOpen(false)}
      >
        <View style={gStyles.popupModalOverlay}>
          {/* Backdrop click dismiss */}
          <TouchableOpacity
            style={gStyles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsBookingModalOpen(false)}
          />

          <View style={gStyles.popupModalCard}>
            {/* Modal Header */}
            <View style={gStyles.popupModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: bookingType === 'Repair' ? '#FEE2E2' : '#D1ECE6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon
                    name={bookingType === 'Repair' ? 'wrench' : 'wrench-adjustable'}
                    size={20}
                    color={bookingType === 'Repair' ? '#DC2626' : '#0C6258'}
                  />
                </View>
                <View>
                  <Text style={gStyles.popupModalTitle}>
                    {bookingType === 'Repair'
                      ? 'Mechanical Repair Booking Form'
                      : bookingType === 'PMS'
                      ? 'PMS Maintenance Booking Form'
                      : 'Pitstop Bay Service Reservation'}
                  </Text>
                  <Text style={gStyles.popupModalSub}>
                    One-page reservation form • 20% advance downpayment required
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={gStyles.popupModalCloseBtn}
                onPress={() => setIsBookingModalOpen(false)}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable One-Page Form Body */}
            <ScrollView style={gStyles.popupModalBody} showsVerticalScrollIndicator={true}>
              {/* SECTION 1: SERVICE CATEGORY & PACKAGE SELECTION */}
              <View style={gStyles.formSectionBox}>
                <View style={gStyles.formSectionHeader}>
                  <BootstrapIcon name="tools" size={16} color="#0C6258" />
                  <Text style={gStyles.formSectionHeading}>1. Service Package Selection</Text>
                </View>

                {/* Category Selector Tabs: Only Fixed PMS and Repair */}
                <View style={[gStyles.serviceTypeSegment, { marginBottom: 14 }]}>
                  <TouchableOpacity
                    style={[
                      gStyles.serviceTypeTab,
                      bookingType === 'PMS' && gStyles.serviceTypeTabActivePMS,
                    ]}
                    onPress={() => handleSwitchBookingType('PMS')}
                  >
                    <BootstrapIcon
                      name="wrench-adjustable"
                      size={15}
                      color={bookingType === 'PMS' ? '#FFFFFF' : '#0C6258'}
                    />
                    <Text
                      style={[
                        gStyles.serviceTypeTabText,
                        bookingType === 'PMS' && gStyles.serviceTypeTabTextActive,
                      ]}
                    >
                      ⚙️ PMS (₱2,500 • ₱500 DP)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      gStyles.serviceTypeTab,
                      bookingType === 'Repair' && gStyles.serviceTypeTabActiveRepair,
                    ]}
                    onPress={() => handleSwitchBookingType('Repair')}
                  >
                    <BootstrapIcon
                      name="wrench"
                      size={15}
                      color={bookingType === 'Repair' ? '#FFFFFF' : '#DC2626'}
                    />
                    <Text
                      style={[
                        gStyles.serviceTypeTabText,
                        bookingType === 'Repair' && gStyles.serviceTypeTabTextActive,
                      ]}
                    >
                      🛠️ Mechanical Repair (₱1,500 • ₱300 DP)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* If Repair: Common Fault Area Chips */}
                {bookingType === 'Repair' && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[gStyles.fieldLabel, { fontSize: 12.5, marginBottom: 6 }]}>
                      Primary Mechanical Fault Area *
                    </Text>
                    <View style={gStyles.repairFaultChipsGrid}>
                      {REPAIR_COMMON_ISSUES.map((issue) => {
                        const isSelected = selectedRepairIssue === issue.label;
                        return (
                          <TouchableOpacity
                            key={issue.id}
                            style={[gStyles.repairFaultChip, isSelected && gStyles.repairFaultChipActive]}
                            onPress={() => setSelectedRepairIssue(issue.label)}
                          >
                            <BootstrapIcon
                              name={issue.icon}
                              size={13}
                              color={isSelected ? '#DC2626' : '#64748B'}
                            />
                            <Text
                              style={[
                                gStyles.repairFaultChipText,
                                isSelected && gStyles.repairFaultChipTextActive,
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
                        padding: 14,
                        borderRadius: 14,
                        backgroundColor: isRepair ? '#FEF2F2' : '#F0FDF4',
                        borderWidth: 1.5,
                        borderColor: isRepair ? '#FECACA' : '#BBF7D0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon
                            name={isRepair ? 'wrench' : 'wrench-adjustable'}
                            size={15}
                            color={isRepair ? '#DC2626' : '#0C6258'}
                          />
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isRepair ? '#991B1B' : '#064E3B' }}>
                            {fixedSvc.title}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: isRepair ? '#FEE2E2' : '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: isRepair ? '#991B1B' : '#166534' }}>
                            ⏱️ {fixedSvc.duration}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 12, color: '#475569', marginBottom: 10, lineHeight: 16 }}>
                        {fixedSvc.subtitle}
                      </Text>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 10, borderRadius: 10 }}>
                        <View>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>Fixed Total Fee</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: isRepair ? '#DC2626' : '#0C6258' }}>
                            ₱{fixedSvc.pricePhp.toLocaleString()}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>20% Downpayment (Due Now)</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: '#DC2626' }}>
                            ₱{fixedSvc.downpaymentPhp.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* SECTION 2: MOTORCYCLE INFORMATION */}
              <View style={gStyles.formSectionBox}>
                <View style={gStyles.formSectionHeader}>
                  <BootstrapIcon name="speedometer" size={16} color="#0C6258" />
                  <Text style={gStyles.formSectionHeading}>2. Motorcycle Information</Text>
                </View>

                {/* Quick Select from My Garage */}
                {Array.isArray(garageMotorcycles) && garageMotorcycles.length > 0 && (
                  <View
                    style={{
                      marginBottom: 14,
                      backgroundColor: '#F0FDFA',
                      borderWidth: 1,
                      borderColor: '#CCFBF1',
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <BootstrapIcon name="wrench-adjustable" size={13} color="#0C6258" />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0C6258' }}>
                        Quick Select from My Garage:
                      </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              shadowColor: '#000',
                              shadowOpacity: 0.05,
                              shadowRadius: 2,
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
                                fontSize: 12,
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
                <Text style={gStyles.fieldLabel}>Motorcycle Brand *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'KTM', 'Vespa', 'Other'].map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: bikeBrand === b ? '#0C6258' : '#CBD5E1',
                        backgroundColor: bikeBrand === b ? '#D1ECE6' : '#FFFFFF',
                      }}
                      onPress={() => setBikeBrand(b)}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: bikeBrand === b ? '800' : '600',
                          color: bikeBrand === b ? '#0C6258' : '#475569',
                        }}
                      >
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={gStyles.fieldLabel}>Motorcycle Model *</Text>
                    <TextInput
                      style={gStyles.modalInput}
                      placeholder="e.g. Aerox 155, Ninja 400, CB650R"
                      value={bikeModel}
                      onChangeText={setBikeModel}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={gStyles.fieldLabel}>Plate Number / MV File *</Text>
                    <TextInput
                      style={gStyles.modalInput}
                      placeholder="e.g. 123-ABC / Registered"
                      value={bikePlate}
                      onChangeText={setBikePlate}
                    />
                  </View>
                  <View style={{ width: 140 }}>
                    <Text style={gStyles.fieldLabel}>Odometer (km)</Text>
                    <TextInput
                      style={gStyles.modalInput}
                      placeholder="e.g. 6,500 km"
                      value={bikeOdo}
                      onChangeText={setBikeOdo}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 3: PITSTOP BAY HUB & SCHEDULE */}
              <View style={gStyles.formSectionBox}>
                <View style={gStyles.formSectionHeader}>
                  <BootstrapIcon name="geo-alt-fill" size={16} color="#0C6258" />
                  <Text style={gStyles.formSectionHeading}>3. Flagship Pit Bay & Schedule</Text>
                </View>

                {/* Flagship Hub Card */}
                <View style={[gStyles.singleHubCard, { marginBottom: 12 }]}>
                  <View style={gStyles.singleHubBadge}>
                    <Text style={gStyles.singleHubBadgeText}>Flagship Service Facility</Text>
                  </View>
                  <Text style={gStyles.singleHubTitle}>{flagshipBranch.name}</Text>
                  <Text style={gStyles.singleHubAddress}>📍 {flagshipBranch.address}</Text>
                  <Text style={gStyles.singleHubFeatures}>⚡ {flagshipBranch.bays}</Text>
                </View>

                {/* ─── DATE SELECTION WITH CALENDAR ─── */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={gStyles.fieldLabel}>
                    Appointment Date (Select in Calendar) *
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsCalendarOpen(!isCalendarOpen)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  >
                    <BootstrapIcon name={isCalendarOpen ? 'calendar-minus' : 'calendar-plus'} size={13} color="#0C6258" />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0C6258' }}>
                      {isCalendarOpen ? 'Hide Grid' : 'Show Grid'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Interactive Native Date Input Field */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: '#0C6258',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginBottom: 10,
                    gap: 10,
                    boxShadow: '0 2px 8px rgba(12,98,88,0.06)',
                  }}
                >
                  <BootstrapIcon name="calendar3" size={17} color="#0C6258" />
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleSelectDate(e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      fontSize: '14px',
                      fontWeight: '800',
                      color: '#0F172A',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  />
                  <View style={{ backgroundColor: '#D1ECE6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0C6258' }}>
                      {selectedDate}
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
                      isSelected: dateStr === selectedDate,
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
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        padding: 14,
                        marginBottom: 12,
                        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      {/* Month & Year Navigation Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <TouchableOpacity
                          onPress={handlePrevMonth}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <BootstrapIcon name="chevron-left" size={13} color="#334155" />
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="calendar-event-fill" size={14} color="#0C6258" />
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                            {monthNames[calendarMonth]} {calendarYear}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={handleNextMonth}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <BootstrapIcon name="chevron-right" size={13} color="#334155" />
                        </TouchableOpacity>
                      </View>

                      {/* Day of Week Headers */}
                      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                        {daysOfWeek.map((dayName, idx) => (
                          <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: idx === 0 || idx === 6 ? '#94A3B8' : '#64748B' }}>
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
                              <View key={idx} style={{ width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 12, color: '#E2E8F0' }}>{cell.day}</Text>
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
                                height: 36,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 10,
                                backgroundColor: isSelected ? '#0C6258' : isToday ? '#D1ECE6' : 'transparent',
                                borderWidth: isToday && !isSelected ? 1 : 0,
                                borderColor: '#0C6258',
                                cursor: isPast ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12.5,
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
                        cursor: 'pointer',
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

                {/* Time Slot Chips */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={gStyles.fieldLabel}>Preferred Pit Bay Time Slot *</Text>
                  {(() => {
                    const selAvail = garageService.getDaySlotAvailability(selectedDate);
                    return (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: selAvail.isFullyBooked ? '#EF4444' : '#0C6258' }}>
                        {selAvail.isFullyBooked ? '● Fully Booked (No slots)' : `● ${selAvail.availableSlotsCount} Slots Open`}
                      </Text>
                    );
                  })()}
                </View>

                {(() => {
                  const selAvail = garageService.getDaySlotAvailability(selectedDate);
                  if (selAvail.isFullyBooked) {
                    return (
                      <View
                        style={{
                          backgroundColor: '#FEE2E2',
                          borderColor: '#EF4444',
                          borderWidth: 1,
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <BootstrapIcon name="exclamation-octagon-fill" size={16} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#991B1B', flex: 1 }}>
                          {selAvail.isToday
                            ? 'Pit bays are FULLY BOOKED for today. No slots available. Please select Tomorrow or another date above.'
                            : 'All service slots are fully booked for this date. Please select another date above.'}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                <View style={[gStyles.timeSlotsGrid, { marginBottom: 4 }]}>
                  {(() => {
                    const selAvail = garageService.getDaySlotAvailability(selectedDate);
                    return TIME_SLOTS.map((ts) => {
                      const slotInfo = selAvail.slots.find((s) => s.timeSlot === ts);
                      const isBooked = slotInfo?.isBooked;
                      const isSelected = selectedTime === ts && !isBooked;

                      return (
                        <TouchableOpacity
                          key={ts}
                          disabled={isBooked}
                          style={[
                            gStyles.timeSlotPill,
                            isSelected && gStyles.timeSlotPillActive,
                            isBooked && {
                              backgroundColor: '#F1F5F9',
                              borderColor: '#E2E8F0',
                              opacity: 0.55,
                              cursor: 'not-allowed',
                            },
                          ]}
                          onPress={() => {
                            if (!isBooked) setSelectedTime(ts);
                          }}
                        >
                          <Text
                            style={[
                              gStyles.timeSlotText,
                              isSelected && gStyles.timeSlotTextActive,
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

              {/* SECTION 4: RIDER CONTACT & SYMPTOMS / PHOTOS */}
              <View style={gStyles.formSectionBox}>
                <View style={gStyles.formSectionHeader}>
                  <BootstrapIcon name="person-badge" size={16} color="#0C6258" />
                  <Text style={gStyles.formSectionHeading}>4. Rider Details & Mechanic Notes</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={gStyles.fieldLabel}>Rider / Owner Name *</Text>
                    <TextInput
                      style={gStyles.modalInput}
                      placeholder="Alex Rider"
                      value={ownerName}
                      onChangeText={setOwnerName}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={gStyles.fieldLabel}>Contact Mobile (GCash & SMS) *</Text>
                    <TextInput
                      style={gStyles.modalInput}
                      placeholder="+63 917 123 4567"
                      value={ownerPhone}
                      onChangeText={setOwnerPhone}
                    />
                  </View>
                </View>

                {/* Issue Symptoms Notes */}
                <Text style={gStyles.fieldLabel}>Issue Symptoms / Maintenance Notes (Optional)</Text>
                <TextInput
                  style={[gStyles.modalInput, { height: 60, textAlignVertical: 'top', marginBottom: 12 }]}
                  placeholder="Describe abnormal sounds, jerking, fluid leaks, oil brand preference, or modifications..."
                  multiline={true}
                  value={serviceNotes}
                  onChangeText={setServiceNotes}
                />

                {/* Photo Upload */}
                <Text style={gStyles.fieldLabel}>Attach Motorcycle / Fault Photos (Optional)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      cursor: 'pointer',
                    }}
                    onPress={handlePickPhoto}
                    disabled={isUploadingPhoto}
                  >
                    <BootstrapIcon name="camera-fill" size={14} color="#0C6258" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                      {isUploadingPhoto ? 'Uploading...' : 'Add Photo'}
                    </Text>
                  </TouchableOpacity>

                  {motorcyclePhotos.map((uri, idx) => (
                    <View key={idx} style={gStyles.photoThumbWrap}>
                      <Image source={{ uri }} style={gStyles.photoThumbImg} />
                      <TouchableOpacity
                        style={gStyles.photoRemoveBtn}
                        onPress={() => handleRemovePhoto(idx)}
                      >
                        <BootstrapIcon name="x" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              {/* SECTION 5: PRICING & 20% NON-REFUNDABLE DOWNPAYMENT POLICY */}
              <View
                style={{
                  backgroundColor: '#FFFBEB',
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: '#FDE68A',
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <BootstrapIcon name="credit-card-2-front" size={16} color="#D97706" />
                  <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#92400E', textTransform: 'uppercase' }}>
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
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>Fixed Service Package Fee ({bookingType}):</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>₱{fullPrice.toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ backgroundColor: '#D1ECE6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0C6258' }}>20% DUE NOW</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0C6258' }}>Mandatory Advance Downpayment:</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0C6258' }}>₱{dp.toLocaleString()}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 6 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#64748B' }}>Remaining Balance (Due Upon Bay Completion):</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#475569' }}>₱{rem.toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Strict Anti-Fake Booking Non-Refundable Notice */}
                <View
                  style={{
                    backgroundColor: '#FEF2F2',
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: '#FECACA',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <BootstrapIcon name="shield-exclamation" size={15} color="#DC2626" />
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#991B1B' }}>
                      ANTI-FAKE BOOKING & NON-REFUNDABLE POLICY:
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#991B1B', lineHeight: 16, marginBottom: 4 }}>
                    • <Text style={{ fontWeight: '800' }}>Slot Not Reserved Without Downpayment:</Text> You must authorize the 20% downpayment via GCash. If cancelled or unpaid, your appointment will NOT be reserved.
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#991B1B', lineHeight: 16 }}>
                    • <Text style={{ fontWeight: '800' }}>Strictly Non-Refundable:</Text> Once confirmed, downpayment is non-refundable upon cancellation or no-show to cover reserved technician and bay slot allocation.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            {(() => {
              const currentSvc = selectedService || servicesList.find((s) => s.category === bookingType) || servicesList[0];
              const fullPrice = currentSvc?.pricePhp || (currentSvc?.price ? currentSvc.price * 50 : 2500);
              const dp = Math.round(fullPrice * 0.20);

              return (
                <View style={gStyles.popupModalFooter}>
                  <TouchableOpacity
                    style={gStyles.popupCancelBtn}
                    onPress={() => setIsBookingModalOpen(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={gStyles.popupCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      gStyles.popupSubmitBtn,
                      bookingType === 'Repair' && { backgroundColor: '#DC2626' },
                    ]}
                    onPress={handleConfirmBooking}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="calendar-check" size={16} color="#FFFFFF" />
                    <Text style={gStyles.popupSubmitBtnText}>Reserve</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Live Order Tracking Modal */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
        showToast={showToast}
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

      {/* ─── CERTIFIED MECHANICS ROSTER MODAL ─── */}
      <Modal
        visible={isRosterModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRosterModalOpen(false)}
      >
        <View style={gStyles.rosterModalOverlay}>
          <View style={gStyles.rosterModalContainer}>
            <View style={gStyles.rosterModalHeader}>
              <View style={gStyles.rosterModalTitleRow}>
                <BootstrapIcon name="tools" size={20} color="#0C6258" />
                <View>
                  <Text style={gStyles.rosterModalTitle}>Certified Pit Crew & Mechanics</Text>
                  <Text style={gStyles.rosterModalSub}>
                    MotoTrack Flagship Central Hub • {mechanicsData.availableCount} of {mechanicsData.totalCount} Technicians Available Today
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={gStyles.rosterModalCloseBtn}
                onPress={() => setIsRosterModalOpen(false)}
              >
                <BootstrapIcon name="x-lg" size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={true}>
              {mechanicsData.mechanics.map((mech) => (
                <View key={mech.id} style={gStyles.rosterItemCard}>
                  <Image source={{ uri: mech.avatar }} style={gStyles.rosterItemAvatar} />
                  <View style={gStyles.rosterItemBody}>
                    <Text style={gStyles.rosterItemName}>{mech.name}</Text>
                    <Text style={gStyles.rosterItemSpec}>
                      ⚡ {mech.specialization} • {mech.experience}
                    </Text>
                    <Text style={gStyles.rosterItemBay}>
                      📍 {mech.bay} • {mech.certifications}
                    </Text>
                  </View>
                  <View
                    style={[
                      gStyles.rosterStatusPill,
                      {
                        backgroundColor: mech.isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        borderWidth: 1,
                        borderColor: mech.isAvailable ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    <BootstrapIcon
                      name={mech.isAvailable ? 'check-circle-fill' : 'gear-wide-connected'}
                      size={11}
                      color={mech.isAvailable ? '#10B981' : '#EF4444'}
                    />
                    <Text
                      style={[
                        gStyles.rosterStatusText,
                        { color: mech.isAvailable ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {mech.status}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1E293B', flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#0C6258',
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
                onPress={() => setIsRosterModalOpen(false)}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>Close Roster</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Strict Non-Refundable Cancellation Confirmation Modal */}
      <ConfirmModal
        visible={isCancelModalOpen}
        title="Cancel Pit Bay Appointment?"
        message={`⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour 20% advance downpayment of ₱${(bookingToCancel?.downpayment_amount !== undefined ? bookingToCancel.downpayment_amount : Math.round((bookingToCancel?.pricePhp || 2500) * 0.20)).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover reserved technician allocation and bay scheduling. Are you sure you wish to cancel?`}
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
    </View>
  );
}
