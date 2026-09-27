import React, { useState, useEffect, useMemo } from 'react';
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
  FIXED_GARAGE_SERVICES,
  normalizeServicePackage,
} from '../services/garageService';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../services/motorcycleService';
import { isFlexibleBooking, normalizeBookingStatus } from '../utils/serviceQuotation';
import { BootstrapIcon, BottomNavBar, BrandLogo, BookingSelect, BookingCalendar, SegmentedToggle, CustomerServiceBookingCard } from '../components/common';
import { ConfirmModal, RegisterMotorcycleModal } from '../components/modals';
import { pickImageFromFile, pickVideoFromFile } from '../utils/imagePickerHelper';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { authService } from '../services/authService';
import { CUSTOMER_USER } from '../services/userService';

const SERVICE_TYPE_LABELS = {
  PMS: 'PMS Service',
  Repair: 'Repair Service',
};


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
  const [bookingsPage, setBookingsPage] = useState(1);
  const BOOKINGS_PAGE_SIZE = 5;
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Garage') {
      setActiveFilter('Services');
    } else if (tab === 'More') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('menu');
      }
    } else if (tab === 'Dashboard') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('overview');
      }
    } else if (tab === 'Bookings') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.('bookings');
      }
    } else if (tab === 'Notifications') {
      onNavigateToProfile?.('notifications');
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
    } else if (tab === 'Wishlist' || tab === 'Favorites') {
      onNavigateToWishlist?.();
    } else if (tab === 'Admin') {
      if (currentUser?.role === 'admin') {
        onNavigateToAdmin?.();
      }
    } else if (tab === 'Login') {
      onNavigateToLogin?.();
    } else if (tab === 'Logout') {
      onLogout?.();
    }
  };

  // Cancellation Confirmation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Booking Flow Modals State (5-Step Flexible Service Request Stepper)
  const [bookingStep, setBookingStep] = useState(1);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(null);
  const [bookingType, setBookingType] = useState('PMS'); // 'Repair' | 'PMS'
  const [selectedRepairIssue, setSelectedRepairIssue] = useState('Engine & Transmission');

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeYear, setBikeYear] = useState('');
  const [bikeOdo, setBikeOdo] = useState('');
  const flagshipBranch = GARAGE_BRANCHES[0] || {
    name: "D'Blockchain Motorparts and Accessories",
    address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
    phone: '(+63) 917 882 9102',
    bays: '6 Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay',
    hours: 'Mon - Sun: 8:00 AM - 7:00 PM',
  };
  const [selectedBranch, setSelectedBranch] = useState(flagshipBranch.name);
  const [garageMotorcycles, setGarageMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState('');
  const [isRegisterMotorcycleModalOpen, setIsRegisterMotorcycleModalOpen] = useState(false);
  const [motorcyclePhotos, setMotorcyclePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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

  const handlePickVideo = async () => {
    try {
      setIsUploadingPhoto(true);
      const res = await pickVideoFromFile();
      if (res && res.success && res.uri) {
        setMotorcyclePhotos((prev) => [...prev, res.uri]);
        showToast('🎥 Video clip attached to service request');
      } else if (res?.error && res.error !== 'Selection cancelled') {
        showToast('⚠️ ' + res.error);
      }
    } catch (_e) {
      showToast('⚠️ Could not pick video');
    } finally {
      setIsUploadingPhoto(false);
    }
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
    const availability = garageService.getDaySlotAvailability(dateStr);
    if (availability?.isFullyBooked) {
      showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! All pit bays are reserved.`);
    }
  };

  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[1]);
  const [ownerName, setOwnerName] = useState(() => {
    const u = currentUser || authService.getCurrentUser();
    return u?.name || u?.fullName || u?.user_metadata?.full_name || u?.user_metadata?.name || CUSTOMER_USER?.name || 'Alex Rider';
  });
  const [ownerPhone, setOwnerPhone] = useState(() => {
    const u = currentUser || authService.getCurrentUser();
    return u?.phone || u?.phoneNumber || u?.contactNumber || u?.contact_number || u?.user_metadata?.phone || CUSTOMER_USER?.phone || '+63 917 555 0192';
  });
  const [serviceNotes, setServiceNotes] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleFetchCustomerDetails = (silent = false) => {
    try {
      const activeUser = currentUser || authService.getCurrentUser();
      let fetchedName = '';
      let fetchedPhone = '';

      if (activeUser) {
        fetchedName =
          activeUser.name ||
          activeUser.fullName ||
          activeUser.user_metadata?.full_name ||
          activeUser.user_metadata?.name ||
          (activeUser.email ? activeUser.email.split('@')[0] : '');
        fetchedPhone =
          activeUser.phone ||
          activeUser.phoneNumber ||
          activeUser.contactNumber ||
          activeUser.contact_number ||
          activeUser.user_metadata?.phone ||
          '';

        if (!fetchedPhone && typeof userService?.getLocalUsers === 'function') {
          const matched = userService
            .getLocalUsers()
            .find((u) => u.id === activeUser.id || u.email === activeUser.email);
          if (matched) {
            if (!fetchedName && matched.name) fetchedName = matched.name;
            if (matched.phone) fetchedPhone = matched.phone;
          }
        }
      }

      if (!fetchedName) {
        fetchedName = CUSTOMER_USER?.name || 'Alex Rider';
      }
      if (!fetchedPhone) {
        fetchedPhone = CUSTOMER_USER?.phone || '+63 917 555 0192';
      }

      setOwnerName(fetchedName);
      setOwnerPhone(fetchedPhone);
      if (!silent) {
        showToast(`✅ Customer info fetched: ${fetchedName} (${fetchedPhone})`);
      }
    } catch (_e) {
      const fallbackName = 'Alex Rider';
      const fallbackPhone = '+63 917 555 0192';
      setOwnerName(fallbackName);
      setOwnerPhone(fallbackPhone);
      if (!silent) {
        showToast(`✅ Customer info fetched: ${fallbackName}`);
      }
    }
  };

  // Auto-sync profile details when user session changes
  useEffect(() => {
    if (currentUser) {
      const cName = currentUser.name || currentUser.fullName || currentUser.user_metadata?.full_name || '';
      const cPhone = currentUser.phone || currentUser.phoneNumber || currentUser.contactNumber || '';
      if (cName) setOwnerName(cName);
      if (cPhone) setOwnerPhone(cPhone);
    }
  }, [currentUser]);

  // Auto-fetch if booking modal opens and details are empty
  useEffect(() => {
    if (isBookingModalOpen) {
      if (!ownerName || !ownerPhone) {
        handleFetchCustomerDetails(true);
      }
    }
  }, [isBookingModalOpen]);

  const applyRegisteredMotorcycle = (m) => {
    if (!m) return;
    setSelectedMotorcycleId(m.motorcycle_id);
    setBikeBrand(m.brand || 'Yamaha');
    setBikeModel(m.model || '');
    setBikePlate(m.plate_number || '');
    setBikeYear(m.year ? String(m.year) : '');
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
      if (currentUser) {
        const existing = list.find((m) => m.motorcycle_id === selectedMotorcycleId);
        const nextBike = existing || list.find((m) => m.is_primary) || list[0];
        if (nextBike) applyRegisteredMotorcycle(nextBike);
      } else {
        setSelectedMotorcycleId('');
      }
    } catch (_e) {}

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [currentUser]);

  // Register a new motorcycle from inside the booking wizard (Step 1)
  const handleRegisterMotorcycle = async (motoData) => {
    try {
      const res = await motorcycleService.addMotorcycle({
        ...motoData,
        user_id: currentUser?.id || 'usr-rider-01',
        customer_id: currentUser?.customerId || currentUser?.customer_id || 'cust-demo-01',
        customer_email: currentUser?.email || '',
      });
      const saved = res?.motorcycle;
      const list = motorcycleService.getMotorcycles(currentUser?.id) || [];
      setGarageMotorcycles(list);
      const nextBike = saved || list[0];
      if (nextBike) applyRegisteredMotorcycle(nextBike);
      setIsRegisterMotorcycleModalOpen(false);
      showToast(
        res?.warning
          ? `Registered ${motoData.brand} ${motoData.model} (${res.warning})`
          : `Registered ${motoData.brand} ${motoData.model} to your garage.`
      );
    } catch (_e) {
      showToast('⚠️ Could not register motorcycle. Please try again.');
    }
  };

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
    return (
      packagesForCategory(cat)[0] ||
      normalizeServicePackage(FIXED_GARAGE_SERVICES[cat] || FIXED_GARAGE_SERVICES.PMS)
    );
  };

  const BOOKING_STEPS = [
    { id: 1, label: 'Select Motorcycle', shortLabel: 'Motorcycle', icon: 'bicycle' },
    { id: 2, label: 'Service Type', shortLabel: 'Service', icon: 'tools' },
    { id: 3, label: 'Describe Problem', shortLabel: 'Problem', icon: 'chat-left-text-fill' },
    { id: 4, label: 'Upload Photos', shortLabel: 'Photos', icon: 'camera-fill' },
    { id: 5, label: 'Preferred Date & Time', shortLabel: 'Schedule', icon: 'calendar-check-fill' },
  ];

  const getStepValidation = (step) => {
    if (step === 1) {
      if (!currentUser) return { valid: false, message: 'Please sign in to book a service.' };
      if (!garageMotorcycles || garageMotorcycles.length === 0) {
        return { valid: false, message: 'Register a motorcycle first to continue.' };
      }
      if (!selectedMotorcycleId) return { valid: false, message: 'Please select a registered motorcycle.' };
      return { valid: true };
    }
    if (step === 2) {
      if (!bookingType) return { valid: false, message: 'Please select a service type (PMS or Repair).' };
      return { valid: true };
    }
    if (step === 3) {
      if (!serviceNotes?.trim()) {
        return { valid: false, message: 'Please describe the problem or service you need.' };
      }
      return { valid: true };
    }
    if (step === 4) {
      // Photos are optional
      return { valid: true };
    }
    if (step === 5) {
      if (!bookingDate) return { valid: false, message: 'Please select your preferred date.' };
      if (!selectedTimeSlot) return { valid: false, message: 'Please select your preferred time.' };
      return { valid: true };
    }
    return { valid: true };
  };

  const handleNextStep = () => {
    const validation = getStepValidation(bookingStep);
    if (!validation.valid) {
      if (showToast) showToast(`⚠️ ${validation.message}`);
      return;
    }
    if (bookingStep < 5) {
      setBookingStep((prev) => prev + 1);
    } else {
      handleConfirmBooking();
    }
  };

  const handlePrevStep = () => {
    if (bookingStep > 1) {
      setBookingStep((prev) => prev - 1);
    } else {
      setIsBookingModalOpen(false);
    }
  };

  const handleStepClick = (targetStep) => {
    if (targetStep === bookingStep) return;
    if (targetStep < bookingStep) {
      setBookingStep(targetStep);
      return;
    }
    for (let s = bookingStep; s < targetStep; s++) {
      const val = getStepValidation(s);
      if (!val.valid) {
        if (showToast) showToast(`⚠️ Please complete Step ${s} first: ${val.message}`);
        return;
      }
    }
    setBookingStep(targetStep);
  };

  // Open booking flow: Step 1 is Select Motorcycle (registered only)
  const handleOpenBooking = (pkgOrType) => {
    const pkg = resolveBookingPackage(pkgOrType);
    setBookingType(pkg?.category === 'Repair' ? 'Repair' : 'PMS');
    setSelectedServiceForBooking(pkg);
    const list = currentUser && Array.isArray(garageMotorcycles) ? garageMotorcycles : [];
    if (list.length > 0) {
      const current =
        list.find((m) => m.motorcycle_id === selectedMotorcycleId) ||
        list.find((m) => m.is_primary) ||
        list[0];
      applyRegisteredMotorcycle(current);
    } else {
      setSelectedMotorcycleId('');
    }
    setBookingStep(1);
    setIsBookingModalOpen(true);
    setIsCalendarModalOpen(false);
  };

  const handleProceedToBookingForm = () => {
    const availability = garageService.getDaySlotAvailability(bookingDate);
    if (availability?.isFullyBooked) {
      if (showToast) showToast(`❌ Cannot book: ${bookingDate} is fully booked. Please select an available date.`);
      return;
    }
    setBookingStep(2);
    setIsCalendarModalOpen(false);
    setIsBookingModalOpen(true);
  };

  const handleChangeDateFromBookingForm = () => {
    setBookingStep(1);
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
    garageService
      .fetchMechanics()
      .then(() => {
        refreshAvailability();
      })
      .catch(() => {});
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

  // Submit flexible service request — no package, no price, no downpayment (quotation comes later)
  const handleConfirmBooking = async () => {
    if (!selectedMotorcycleId) {
      showToast('⚠️ Please select a registered motorcycle to continue.');
      setBookingStep(1);
      return;
    }
    if (!serviceNotes.trim()) {
      showToast('⚠️ Please describe the problem or service you need.');
      setBookingStep(3);
      return;
    }
    if (!bookingDate || !selectedTimeSlot) {
      showToast('⚠️ Please choose your preferred date and time.');
      setBookingStep(5);
      return;
    }

    const isRepair = bookingType === 'Repair';
    const serviceLabel = isRepair ? SERVICE_TYPE_LABELS.Repair : SERVICE_TYPE_LABELS.PMS;
    const selectedBike = garageMotorcycles.find(
      (m) => String(m.motorcycle_id) === String(selectedMotorcycleId)
    );

    const problemDescription = isRepair && selectedRepairIssue
      ? `[Fault: ${selectedRepairIssue}] ${serviceNotes.trim()}`
      : serviceNotes.trim();

    const bookingId = `BK-${isRepair ? 'REP' : 'PMS'}-` + Math.floor(10000 + Math.random() * 90000);

    const bookingDraft = {
      id: bookingId,
      booking_id: bookingId,
      booking_mode: 'flexible',
      flexible: true,
      skip_downpayment: true,
      service_id: null,
      package_id: null,
      package_name: serviceLabel,
      package_price: 0,
      included_services: [],
      service_title: serviceLabel,
      service_price: 0,
      pricePhp: 0,
      category: bookingType,
      service_type: bookingType,
      repair_type: isRepair ? selectedRepairIssue : undefined,
      problem_description: problemDescription,
      downpayment_required: false,
      downpayment_percent: 0,
      downpayment_amount: 0,
      remaining_balance: 0,
      is_non_refundable: false,
      motorcycle_id: selectedMotorcycleId,
      bike_brand: selectedBike?.brand || bikeBrand,
      bike_model: selectedBike?.model || bikeModel,
      bike_year: selectedBike?.year ? String(selectedBike.year) : bikeYear,
      year: selectedBike?.year ? String(selectedBike.year) : bikeYear,
      plate_number: selectedBike?.plate_number || bikePlate.trim() || 'Pending Registration',
      odometer: selectedBike?.odometer || bikeOdo.trim() || 'New Unit',
      appointment_date: bookingDate,
      preferred_date: bookingDate,
      time_slot: selectedTimeSlot,
      preferred_time: selectedTimeSlot,
      branch: flagshipBranch.name,
      branch_address: flagshipBranch.address,
      photos: motorcyclePhotos,
      media_urls: motorcyclePhotos,
      customer_name: ownerName || currentUser?.name || 'Customer',
      customer_phone: ownerPhone,
      customer_id: currentUser?.customer_id || currentUser?.id || currentUser?.user_id,
      notes: additionalNotes.trim() ? additionalNotes.trim() : problemDescription,
      additional_notes: additionalNotes.trim(),
      status: 'PENDING_REVIEW',
      customerPhone: ownerPhone,
    };

    const newBooking = await garageService.createBooking(bookingDraft);
    refreshUserBookings();
    setIsBookingModalOpen(false);
    setMotorcyclePhotos([]);
    setServiceNotes('');
    setAdditionalNotes('');
    setActiveFilter('MyBookings');
    showToast(
      `Your service request (#${newBooking?.booking_id || bookingId}) has been submitted. Our admin will review your request and provide a quotation.`
    );
  };

  // Cancel Booking Prompter
  const handlePromptCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    const flexible = isFlexibleBooking(bookingToCancel);
    const paid = Number(bookingToCancel?.amount_paid || 0) > 0;
    await garageService.cancelBooking(bookingToCancel.id);
    refreshUserBookings();
    setIsCancelModalOpen(false);
    setBookingToCancel(null);
    showToast(
      flexible && !paid
        ? 'Service request cancelled.'
        : 'Booking cancelled. Downpayment forfeited per policy.'
    );
  };

  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');

  const filteredBookings = useMemo(() => {
    if (bookingStatusFilter === 'ALL') return userBookings;
    return userBookings.filter((b) => {
      const s = normalizeBookingStatus(b?.status);
      if (bookingStatusFilter === 'PENDING') {
        return [
          'PENDING_REVIEW',
          'APPROVED',
          'SCHEDULED',
          'UNDER_INSPECTION',
          'QUOTATION_SENT',
          'AWAITING_CUSTOMER_APPROVAL',
          'AWAITING_DOWNPAYMENT',
        ].includes(s);
      }
      if (bookingStatusFilter === 'IN_PROGRESS') {
        return [
          'CONFIRMED',
          'SERVICE_IN_PROGRESS',
          'ADDITIONAL_APPROVAL_REQUIRED',
          'SERVICE_COMPLETED',
          'AWAITING_FINAL_PAYMENT',
        ].includes(s);
      }
      if (bookingStatusFilter === 'READY') {
        return s === 'READY_FOR_PICKUP';
      }
      if (bookingStatusFilter === 'COMPLETED') {
        return s === 'COMPLETED';
      }
      return true;
    });
  }, [userBookings, bookingStatusFilter]);

  const activeBookingsCount = userBookings.filter(
    (b) => b.status !== 'Cancelled' && normalizeBookingStatus(b.status) !== 'CANCELLED'
  ).length;

  const bookingsTotalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PAGE_SIZE));
  const pagedBookings = useMemo(() => {
    const start = (bookingsPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredBookings.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filteredBookings, bookingsPage]);
  useEffect(() => {
    if (bookingsPage > bookingsTotalPages) setBookingsPage(1);
  }, [bookingsPage, bookingsTotalPages]);

  const activeBike =
    (garageMotorcycles && garageMotorcycles.length > 0 && garageMotorcycles[0]) ||
    (currentUser?.bikeBrand || currentUser?.bikeModel
      ? {
          brand: currentUser.bikeBrand || 'Yamaha',
          model: currentUser.bikeModel || 'NMAX 155',
          plateNumber: currentUser.bikePlate || 'NM-4892',
          odo: currentUser.bikeOdo || '12,500 km',
        }
      : null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ─── 1. NATIVE MOBILE APP HEADER ─── */}
      <View style={styles.appHeaderRow}>
        <View style={styles.appHeaderLeftGroup}>
          <View style={styles.appHeaderIconWrap}>
            <BootstrapIcon name="tools" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.appHeaderTitle} numberOfLines={1}>
              Pitstop Garage
            </Text>
            <Text style={styles.appHeaderSub} numberOfLines={1}>
              📍 Naga Flagship Bay • 8:00 AM - 6:30 PM
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.appHeaderRosterBtn}
          onPress={() => setIsRosterModalOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.greenPulseDot} />
          <Text style={styles.appHeaderRosterText}>{mechanicsData.availableCount} Techs</Text>
          <BootstrapIcon name="chevron-right" size={10} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── 2. ACTIVE MOTORCYCLE CONTEXT CARD ─── */}
          {activeBike ? (
            <View style={styles.activeBikeCard}>
              <View style={styles.activeBikeLeft}>
                <View style={styles.activeBikeIconWrap}>
                  <BootstrapIcon name="bicycle" size={20} color="#1D4533" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.activeBikeBadgeRow}>
                    <Text style={styles.activeBikeTag}>REGISTERED RIDE</Text>
                  </View>
                  <Text style={styles.activeBikeName} numberOfLines={1}>
                    {activeBike.brand || activeBike.bikeBrand || 'Motorcycle'}{' '}
                    {activeBike.model || activeBike.bikeModel || ''}
                  </Text>
                  <Text style={styles.activeBikeMeta} numberOfLines={1}>
                    Plate:{' '}
                    {activeBike.plateNumber ||
                      activeBike.plate_number ||
                      activeBike.bikePlate ||
                      'Registered'}{' '}
                    • {activeBike.odo || activeBike.odometer || 'Service Ready'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.activeBikeQuickBtn}
                onPress={() => handleOpenBooking('PMS')}
                activeOpacity={0.8}
              >
                <Text style={styles.activeBikeQuickBtnText}>Quick Book</Text>
                <BootstrapIcon name="arrow-right-short" size={16} color="#1D4533" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.activeBikeCard}>
              <View style={styles.activeBikeLeft}>
                <View style={[styles.activeBikeIconWrap, { backgroundColor: '#F1F5F9' }]}>
                  <BootstrapIcon name="bicycle" size={20} color="#64748B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeBikeName}>Express Pit Bay Service</Text>
                  <Text style={styles.activeBikeMeta}>Certified mechanics & Dynojet tuning bay</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.activeBikeQuickBtn}
                onPress={() => handleOpenBooking('PMS')}
                activeOpacity={0.8}
              >
                <Text style={styles.activeBikeQuickBtnText}>Book Bay</Text>
                <BootstrapIcon name="arrow-right-short" size={16} color="#1D4533" />
              </TouchableOpacity>
            </View>
          )}

          {/* ─── 3. GLANCEABLE LIVE STATUS STRIP (COMPACT MOBILE CARD) ─── */}
          <View style={styles.liveStatusStrip}>
            <View style={styles.liveStatusHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="broadcast" size={13} color="#1D4533" />
                <Text style={styles.liveStatusTitle}>LIVE PIT BAY STATUS</Text>
              </View>
              <View style={styles.liveFeedBadge}>
                <View style={styles.greenPulseDotSmall} />
                <Text style={styles.liveFeedBadgeText}>Real-Time</Text>
              </View>
            </View>

            <View style={styles.liveStatsRow}>
              {/* Stat 1: Mechanics */}
              <TouchableOpacity
                style={styles.liveStatChip}
                onPress={() => setIsRosterModalOpen(true)}
                activeOpacity={0.75}
              >
                <BootstrapIcon name="people-fill" size={14} color="#1D4533" />
                <Text style={styles.liveStatVal}>
                  {mechanicsData.availableCount}/{mechanicsData.totalCount}
                </Text>
                <Text style={styles.liveStatLbl}>On-Duty</Text>
              </TouchableOpacity>

              {/* Stat 2: Slots */}
              <View style={styles.liveStatChip}>
                <BootstrapIcon
                  name={todaySlotsData.isFullyBooked ? 'calendar-x-fill' : 'calendar-check'}
                  size={14}
                  color={todaySlotsData.isFullyBooked ? '#DC2626' : '#D97706'}
                />
                <Text style={[styles.liveStatVal, todaySlotsData.isFullyBooked && { color: '#DC2626' }]}>
                  {todaySlotsData.isFullyBooked ? 'Full' : todaySlotsData.availableSlotsCount}
                </Text>
                <Text style={styles.liveStatLbl}>Slots Left</Text>
              </View>

              {/* Stat 3: Next Opening */}
              <View style={styles.liveStatChip}>
                <BootstrapIcon name="clock-history" size={14} color="#4F46E5" />
                <Text style={styles.liveStatVal}>{todaySlotsData.isFullyBooked ? 'Tmrw' : 'Today'}</Text>
                <Text style={styles.liveStatLbl}>Next Opening</Text>
              </View>

              {/* Stat 4: Pit Bays */}
              <View style={styles.liveStatChip}>
                <BootstrapIcon name="speedometer2" size={14} color="#2563EB" />
                <Text style={styles.liveStatVal}>6 Bays</Text>
                <Text style={styles.liveStatLbl}>Dyno Cell</Text>
              </View>
            </View>
          </View>

          {/* Notice Banner if Fully Booked Today */}
          {todaySlotsData.isFullyBooked && (
            <View style={styles.fullyBookedAlert}>
              <BootstrapIcon name="exclamation-octagon-fill" size={16} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.fullyBookedAlertTitle}>Pit bays are fully booked today</Text>
                <Text style={styles.fullyBookedAlertSub}>
                  All 6 bays at capacity. Reserve for tomorrow to secure your slot.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.bookTomorrowBtn}
                onPress={() => handleQuickBook('PMS', true)}
                activeOpacity={0.8}
              >
                <Text style={styles.bookTomorrowBtnText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── 4. HERO SERVICE CARDS (ORGANIZED PRIMARY ACTION PATHWAYS) ─── */}
          <Text style={styles.sectionHeading}>SELECT A SERVICE</Text>

          {/* Card A: PMS Service */}
          <View style={styles.serviceHeroCard}>
            <View style={styles.serviceHeroTop}>
              <View style={styles.serviceHeroIconWrapTeal}>
                <BootstrapIcon name="wrench-adjustable" size={22} color="#1D4533" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.serviceTagRow}>
                  <View style={styles.serviceHeroTagTeal}>
                    <Text style={styles.serviceHeroTagTextTeal}>FAST LANE • 90 MINS</Text>
                  </View>
                </View>
                <Text style={styles.serviceHeroTitle}>Periodic Maintenance (PMS)</Text>
                <Text style={styles.serviceHeroSubtitle}>
                  High-performance synthetic oil change, brake bleed, chain service & 20-point inspection
                </Text>
              </View>
            </View>

            <View style={styles.serviceHeroFeatures}>
              <View style={styles.serviceFeatureItem}>
                <BootstrapIcon name="check2" size={14} color="#1D4533" />
                <Text style={styles.serviceFeatureText}>100% Synthetic Oil & OEM Filter Replacement</Text>
              </View>
              <View style={styles.serviceFeatureItem}>
                <BootstrapIcon name="check2" size={14} color="#1D4533" />
                <Text style={styles.serviceFeatureText}>Hydraulic Brake Flush & Pad Wear Check</Text>
              </View>
              <View style={styles.serviceFeatureItem}>
                <BootstrapIcon name="check2" size={14} color="#1D4533" />
                <Text style={styles.serviceFeatureText}>Drive Chain Sonic Clean, Tension & Wax</Text>
              </View>
            </View>

            <View style={styles.serviceHeroFooter}>
              <View>
                <Text style={styles.serviceHeroPrice}>₱2,500</Text>
                <Text style={styles.serviceHeroPriceSub}>₱500 down to hold bay</Text>
              </View>
              <TouchableOpacity
                style={styles.pmsPrimaryBtn}
                onPress={() => handleOpenBooking('PMS')}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="calendar-check" size={14} color="#FFFFFF" />
                <Text style={styles.pmsPrimaryBtnText}>Reserve PMS Bay</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card B: Mechanical Repair & Diagnostic */}
          <View style={[styles.serviceHeroCard, { marginTop: 12 }]}>
            <View style={styles.serviceHeroTop}>
              <View style={styles.serviceHeroIconWrapSlate}>
                <BootstrapIcon name="wrench" size={20} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.serviceTagRow}>
                  <View style={styles.serviceHeroTagSlate}>
                    <Text style={styles.serviceHeroTagTextSlate}>MASTER TECH • 60-120 MINS</Text>
                  </View>
                </View>
                <Text style={styles.serviceHeroTitle}>Repair & Diagnostics</Text>
                <Text style={styles.serviceHeroSubtitle}>
                  OBD-II computer fault scanning, mechanical troubleshooting, engine & electrical repair
                </Text>
              </View>
            </View>

            <View style={styles.serviceHeroFeatures}>
              <View style={styles.serviceFeatureItem}>
                <BootstrapIcon name="check2" size={14} color="#0F172A" />
                <Text style={styles.serviceFeatureText}>OBD-II / CAN-Bus ECU Diagnostic Scan</Text>
              </View>
              <View style={styles.serviceFeatureItem}>
                <BootstrapIcon name="check2" size={14} color="#0F172A" />
                <Text style={styles.serviceFeatureText}>Pinpoint Mechanical & Electrical Fault Fix</Text>
              </View>
              <View style={styles.serviceFeatureItem}>
                <BootstrapIcon name="check2" size={14} color="#0F172A" />
                <Text style={styles.serviceFeatureText}>Dyno Warmup & Post-Repair Validation</Text>
              </View>
            </View>

            <View style={styles.serviceHeroFooter}>
              <View>
                <Text style={styles.serviceHeroPrice}>From ₱1,500</Text>
                <Text style={styles.serviceHeroPriceSub}>₱300 down to hold bay</Text>
              </View>
              <TouchableOpacity
                style={styles.repairPrimaryBtn}
                onPress={() => handleOpenBooking('Repair')}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="tools" size={14} color="#FFFFFF" />
                <Text style={styles.repairPrimaryBtnText}>Request Diagnostic</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── 5. SCHEDULED APPOINTMENTS SECTION ─── */}
          <View style={styles.appointmentsSection}>
            <View style={styles.appointmentsHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="calendar-check-fill" size={17} color="#1D4533" />
                <Text style={styles.appointmentsHeaderTitle}>Your Appointments</Text>
              </View>
              <View style={styles.appointmentsCountBadge}>
                <Text style={styles.appointmentsCountBadgeText}>
                  {userBookings.length} {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                </Text>
              </View>
            </View>

            {/* Status Filter Tabs */}
            {currentUser && userBookings.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { key: 'ALL', label: `All (${userBookings.length})` },
                  { key: 'PENDING', label: 'Pending Review' },
                  { key: 'IN_PROGRESS', label: 'In Service' },
                  { key: 'READY', label: 'Ready for Pickup' },
                  { key: 'COMPLETED', label: 'Completed' },
                ].map((tab) => {
                  const isSel = bookingStatusFilter === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => {
                        setBookingStatusFilter(tab.key);
                        setBookingsPage(1);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: isSel ? '#1D4533' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isSel ? '#1D4533' : '#E2E8F0',
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '800',
                          color: isSel ? '#FFFFFF' : '#475569',
                        }}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

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
                  <BootstrapIcon name="person-lock" size={24} color="#1D4533" />
                </View>
                <Text style={styles.emptyTitle}>Sign In to View Appointments</Text>
                <Text style={styles.emptySub}>
                  Sign in to view your scheduled pit appointments, track master mechanic assignments, and bay
                  service updates.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 14,
                    backgroundColor: '#1D4533',
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
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#E6F4F1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <BootstrapIcon name="calendar3" size={22} color="#1D4533" />
                </View>
                <Text style={styles.emptyTitle}>No scheduled appointments yet</Text>
                <Text style={styles.emptySub}>
                  Select Periodic Maintenance or Repair Diagnostic above to reserve a pit bay with our master
                  technicians.
                </Text>
              </View>
            ) : filteredBookings.length === 0 ? (
              <View style={[styles.emptyBox, { padding: 24, backgroundColor: '#F8FAFC' }]}>
                <BootstrapIcon name="calendar2-x" size={28} color="#94A3B8" />
                <Text style={[styles.emptyTitle, { fontSize: 14, marginTop: 8 }]}>No bookings in this filter</Text>
                <Text style={styles.emptySub}>Switch to "All" to view your full booking history.</Text>
                <TouchableOpacity
                  onPress={() => {
                    setBookingStatusFilter('ALL');
                    setBookingsPage(1);
                  }}
                  style={{
                    marginTop: 10,
                    backgroundColor: '#1D4533',
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11.5 }}>View All Bookings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bookingsGrid}>
                {pagedBookings.map((b) => {
                  const flexStatus = normalizeBookingStatus(b?.status);
                  const canCancelFlexible = [
                    'PENDING_REVIEW',
                    'APPROVED',
                    'SCHEDULED',
                    'AWAITING_CUSTOMER_APPROVAL',
                    'QUOTATION_SENT',
                    'AWAITING_DOWNPAYMENT',
                  ].includes(flexStatus);
                  return (
                    <View key={b.id || b.booking_id}>
                      <CustomerServiceBookingCard
                        booking={b}
                        onToast={showToast}
                        onUpdated={() => refreshUserBookings()}
                      />
                      {canCancelFlexible ? (
                        <TouchableOpacity
                          style={[styles.cancelBookingBtn, { marginTop: -4, marginBottom: 12 }]}
                          onPress={() => handlePromptCancelBooking(b)}
                          activeOpacity={0.8}
                        >
                          <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                          <Text style={styles.cancelBookingBtnText}>Cancel Request</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
                {bookingsTotalPages > 1 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <TouchableOpacity
                      disabled={bookingsPage <= 1}
                      onPress={() => setBookingsPage((p) => Math.max(1, p - 1))}
                      style={{ opacity: bookingsPage <= 1 ? 0.4 : 1, padding: 6 }}
                    >
                      <BootstrapIcon name="chevron-left" size={16} color="#1D4533" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#475569' }}>
                      Page {bookingsPage} of {bookingsTotalPages}
                    </Text>
                    <TouchableOpacity
                      disabled={bookingsPage >= bookingsTotalPages}
                      onPress={() => setBookingsPage((p) => Math.min(bookingsTotalPages, p + 1))}
                      style={{ opacity: bookingsPage >= bookingsTotalPages ? 0.4 : 1, padding: 6 }}
                    >
                      <BootstrapIcon name="chevron-right" size={16} color="#1D4533" />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ─── STEP 1: CALENDAR DATE SELECTION MODAL ─── */}
      <Modal
        visible={isCalendarModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCalendarModalOpen(false)}
      >
        <View style={styles.popupModalOverlay}>
          <TouchableOpacity
            style={styles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsCalendarModalOpen(false)}
          />

          <View
            style={[
              styles.popupModalCard,
              {
                maxWidth: 680,
                maxHeight: '92%',
                padding: 0,
                overflow: 'hidden',
                borderRadius: 22,
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderBottomWidth: 1.5,
                borderBottomColor: '#F1F5F9',
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: '#E8F0EC',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar-check-fill" size={18} color="#1D4533" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        backgroundColor: '#E8F0EC',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 5,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#1D4533', letterSpacing: 0.5 }}>
                        STEP 1 OF 2
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                      Select Appointment Date & Time
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                    Pick an open date and time slot for your {selectedServiceForBooking?.name || selectedServiceForBooking?.title || (bookingType === 'Repair' ? 'Mechanical Repair' : 'PMS Maintenance')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.popupModalCloseBtn}
                onPress={() => setIsCalendarModalOpen(false)}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Calendar Body */}
            <ScrollView style={{ padding: 14, maxHeight: 460 }} showsVerticalScrollIndicator={true}>
              <BookingCalendar
                selectedDate={bookingDate}
                onSelectDate={(newDate) => handleSelectDate(newDate)}
                selectedTime={selectedTimeSlot}
                onSelectTime={(time) => setSelectedTimeSlot(time)}
                getTimeSlots={(dateStr) => {
                  const selAvail = garageService.getDaySlotAvailability(dateStr);
                  return selAvail?.slots || [];
                }}
                onFullyBookedSelected={(dateStr) => {
                  if (showToast) showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! All pit bays are reserved.`);
                }}
                minDate={new Date().toISOString().split('T')[0]}
                compact={true}
                getDayInfo={(dateStr) => {
                  const selAvail = garageService.getDaySlotAvailability(dateStr);
                  const d = new Date(dateStr + 'T00:00:00');
                  const isSunday = d.getDay() === 0;
                  const bookedCount = selAvail?.bookedSlotsCount || 0;
                  return {
                    bookingCount: bookedCount,
                    isFullyBooked: selAvail?.isFullyBooked || false,
                    isOffDuty: isSunday,
                    label: bookedCount === 0 && !isSunday ? 'Open' : undefined,
                  };
                }}
                statusBarText="Hours: 9:00 AM – 6:00 PM (Mon – Sat). Select an open date and time slot."
                offDutyCount={1}
              />
            </ScrollView>

            {/* Footer Status & Proceed Action */}
            {(() => {
              const availability = garageService.getDaySlotAvailability(bookingDate);
              const isFull = availability?.isFullyBooked;
              return (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderTopWidth: 1.5,
                    borderTopColor: '#F1F5F9',
                    backgroundColor: isFull ? '#FFF1F2' : '#F0FDFA',
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: isDesktop ? 'center' : 'stretch',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: isFull ? '#FEE2E2' : '#C8DDD3',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon
                        name={isFull ? 'slash-circle-fill' : 'check2-circle'}
                        size={16}
                        color={isFull ? '#DC2626' : '#1D4533'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: isFull ? '#991B1B' : '#0F172A' }}>
                          Selected: {bookingDate}
                        </Text>
                        {selectedTimeSlot && (
                          <View
                            style={{
                              backgroundColor: '#E8F0EC',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#1D4533' }}>
                              ⏱️ {selectedTimeSlot}
                            </Text>
                          </View>
                        )}
                        <View
                          style={{
                            backgroundColor: isFull ? '#FEE2E2' : '#C8DDD3',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '800',
                              color: isFull ? '#DC2626' : '#1D4533',
                            }}
                          >
                            {isFull ? 'FULLY BOOKED' : `${availability?.availableSlotsCount ?? 6} Bays Open`}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: isFull ? '#B91C1C' : '#64748B', marginTop: 1 }}>
                        {isFull
                          ? 'This date is completely booked. You cannot book this date — select another day above.'
                          : 'Service bays are open on this date. Click proceed to enter motorcycle details.'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={() => setIsCalendarModalOpen(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isFull}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isFull ? '#CBD5E1' : '#1D4533',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: isFull ? 0.7 : 1,
                      }}
                      onPress={handleProceedToBookingForm}
                      activeOpacity={0.85}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: isFull ? '#64748B' : '#FFFFFF' }}>
                        {isFull ? 'Date Fully Booked' : 'Proceed to Booking Form →'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ─── 5-STEP POPUP BOOKING FORM MODAL ─── */}
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

          <View style={[styles.popupModalCard, { maxHeight: '92%' }]}>
            {/* Modal Header & 5-Step Progress Stepper */}
            <View style={styles.stepperHeader}>
              <View style={styles.stepperTitleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                  <View
                    style={[
                      styles.stepperIconWrap,
                      bookingType === 'Repair' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                    ]}
                  >
                    <BootstrapIcon
                      name={BOOKING_STEPS[bookingStep - 1]?.icon || 'bicycle'}
                      size={18}
                      color={bookingType === 'Repair' ? '#DC2626' : '#1D4533'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepperModalTitle} numberOfLines={1}>
                      Service Request
                    </Text>
                    <Text
                      style={[
                        styles.stepperModalSubtitle,
                        bookingType === 'Repair' && { color: '#DC2626' },
                      ]}
                      numberOfLines={1}
                    >
                      Step {bookingStep} of 5: {BOOKING_STEPS[bookingStep - 1]?.label}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.stepperCloseBtn}
                  onPress={() => setIsBookingModalOpen(false)}
                >
                  <BootstrapIcon name="x-lg" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* 5-Step Progress Stepper Indicator */}
              <View style={styles.stepIndicatorContainer}>
                {BOOKING_STEPS.map((step, idx) => {
                  const stepNum = idx + 1;
                  const isActive = bookingStep === stepNum;
                  const isCompleted = bookingStep > stepNum;
                  return (
                    <React.Fragment key={step.id}>
                      <TouchableOpacity
                        style={styles.stepNodeWrap}
                        onPress={() => handleStepClick(stepNum)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.stepCircle,
                            isActive && (bookingType === 'Repair' ? { backgroundColor: '#DC2626', borderColor: '#DC2626' } : styles.stepCircleActive),
                            isCompleted && styles.stepCircleCompleted,
                          ]}
                        >
                          {isCompleted ? (
                            <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />
                          ) : (
                            <Text
                              style={[
                                styles.stepNumberText,
                                isActive && styles.stepNumberTextActive,
                              ]}
                            >
                              {stepNum}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stepLabel,
                            isActive && (bookingType === 'Repair' ? { color: '#DC2626', fontWeight: '900' } : styles.stepLabelActive),
                            isCompleted && styles.stepLabelCompleted,
                          ]}
                          numberOfLines={1}
                        >
                          {step.shortLabel}
                        </Text>
                      </TouchableOpacity>
                      {idx < BOOKING_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.stepConnectingLine,
                            isCompleted && styles.stepConnectingLineCompleted,
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* Scrollable Step Body */}
            <ScrollView style={styles.popupModalBody} showsVerticalScrollIndicator={true}>
              {/* STEP 1: SELECT MOTORCYCLE (REGISTERED UNITS ONLY) */}
              {bookingStep === 1 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Select Motorcycle</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Choose the motorcycle that needs service.
                    </Text>
                  </View>

                  {garageMotorcycles.length > 0 ? (
                    <View>
                      <View style={styles.motorcycleCardGrid}>
                        {garageMotorcycles.map((m) => {
                          const isPicked = String(m.motorcycle_id) === String(selectedMotorcycleId);
                          const bikePhoto =
                            m.photo_url ||
                            MOTORCYCLE_PHOTO_PRESETS?.find(
                              (p) => p.brand?.toLowerCase() === m.brand?.toLowerCase()
                            )?.url ||
                            'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80';

                          return (
                            <TouchableOpacity
                              key={m.motorcycle_id}
                              style={[
                                styles.motorcycleCard,
                                isPicked && styles.motorcycleCardActive,
                              ]}
                              onPress={() => applyRegisteredMotorcycle(m)}
                              activeOpacity={0.88}
                            >
                              {/* Top Product Image Container with Badges */}
                              <View
                                style={{
                                  position: 'relative',
                                  width: '100%',
                                  height: 180,
                                  borderRadius: 14,
                                  overflow: 'hidden',
                                  backgroundColor: '#F8FAFC',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 6,
                                }}
                              >
                                <Image
                                  source={{ uri: bikePhoto }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="contain"
                                />

                                {/* Brand Badge (Top-Left) */}
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: 10,
                                    left: 10,
                                    backgroundColor: 'rgba(15, 23, 42, 0.72)',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 }}>
                                    {m.brand}
                                  </Text>
                                </View>

                                {/* Star / Status Badge (Top-Right action icon like inspiration) */}
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: isPicked ? '#1D4533' : 'rgba(15, 23, 42, 0.55)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {isPicked ? (
                                    <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
                                  ) : m.is_primary ? (
                                    <BootstrapIcon name="star-fill" size={12} color="#FBBF24" />
                                  ) : (
                                    <BootstrapIcon name="bicycle" size={13} color="#FFFFFF" />
                                  )}
                                </View>
                              </View>

                              {/* Card Middle: Title & Subtitle/Description */}
                              <View style={{ marginTop: 12, marginBottom: 8, paddingHorizontal: 2 }}>
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontWeight: '800',
                                    color: '#0F172A',
                                    letterSpacing: -0.2,
                                  }}
                                  numberOfLines={1}
                                >
                                  {m.year ? `${m.year} ` : ''}{m.brand} {m.model}
                                </Text>

                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: '#64748B',
                                    lineHeight: 16,
                                    marginTop: 4,
                                  }}
                                  numberOfLines={1}
                                >
                                  {m.nickname ? `"${m.nickname}" • ` : ''}
                                  {m.engine_cc ? `${m.engine_cc}cc` : 'Registered'}
                                  {m.odometer ? ` • ${m.odometer}` : ''}
                                </Text>
                              </View>

                              {/* Card Bottom: Plate on Left + Pill Button on Right (Matching Inspiration "Buy Now") */}
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginTop: 8,
                                  paddingTop: 10,
                                  borderTopWidth: 1,
                                  borderTopColor: '#F1F5F9',
                                  paddingHorizontal: 2,
                                }}
                              >
                                <View>
                                  <Text
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: '800',
                                      color: '#94A3B8',
                                      letterSpacing: 0.5,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    PLATE NUMBER
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 15,
                                      fontWeight: '900',
                                      color: '#0F172A',
                                      letterSpacing: -0.2,
                                      marginTop: 1,
                                    }}
                                  >
                                    {m.plate_number || 'NO PLATE'}
                                  </Text>
                                </View>

                                {/* Pill Button matching inspiration Buy Now button */}
                                <View
                                  style={{
                                    backgroundColor: isPicked ? '#1D4533' : '#0F172A',
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                >
                                  {isPicked && <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />}
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '800',
                                      color: '#FFFFFF',
                                    }}
                                  >
                                    {isPicked ? 'Selected' : 'Select'}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        style={{
                          marginTop: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingVertical: 11,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderStyle: 'dashed',
                          borderColor: '#1D4533',
                          backgroundColor: '#F0FDFA',
                        }}
                        onPress={() => setIsRegisterMotorcycleModalOpen(true)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-circle-fill" size={14} color="#1D4533" />
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1D4533' }}>
                          Register Another Motorcycle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        padding: 18,
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 26,
                          backgroundColor: '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name="bicycle" size={24} color="#64748B" />
                      </View>
                      <Text style={{ fontSize: 14.5, fontWeight: '900', color: '#0F172A', textAlign: 'center' }}>
                        No Registered Motorcycle Yet
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 17 }}>
                        Add your motorcycle to request a service.
                      </Text>
                      <TouchableOpacity
                        style={{
                          marginTop: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 16,
                          paddingVertical: 11,
                          borderRadius: 12,
                          backgroundColor: '#1D4533',
                        }}
                        onPress={() => setIsRegisterMotorcycleModalOpen(true)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-circle-fill" size={14} color="#FFFFFF" />
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' }}>
                          Add Motorcycle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 2: SELECT SERVICE TYPE */}
              {bookingStep === 2 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Select Service Type</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Choose maintenance or mechanical repair.
                    </Text>
                  </View>

                  {/* Service Cards Grid */}
                  <View style={styles.serviceCardGrid}>
                    {/* Card 1: PMS */}
                    <TouchableOpacity
                      style={[
                        styles.serviceCard,
                        bookingType === 'PMS' && styles.serviceCardActivePMS,
                      ]}
                      onPress={() => {
                        setBookingType('PMS');
                        setSelectedServiceForBooking(resolveBookingPackage('PMS'));
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#E6F8F5', alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="wrench-adjustable" size={20} color="#1D4533" />
                        </View>
                        <View style={{ backgroundColor: bookingType === 'PMS' ? '#1D4533' : '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: bookingType === 'PMS' ? '#FFFFFF' : '#64748B' }}>
                            {bookingType === 'PMS' ? 'Selected ✓' : 'Select'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                        Preventive Maintenance (PMS)
                      </Text>
                      <Text style={{ fontSize: 12, color: '#475569', lineHeight: 17, marginBottom: 12 }}>
                        Routine maintenance, fresh engine oil, filter changes, and complete safety inspection.
                      </Text>
                      <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="check2" size={14} color="#059669" />
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>Multi-Point Safety Inspection</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="check2" size={14} color="#059669" />
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>Engine Oil & Filter Replacement</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="check2" size={14} color="#059669" />
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>Brake System & Chain Care</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Card 2: Repair */}
                    <TouchableOpacity
                      style={[
                        styles.serviceCard,
                        bookingType === 'Repair' && styles.serviceCardActiveRepair,
                      ]}
                      onPress={() => {
                        setBookingType('Repair');
                        setSelectedServiceForBooking(resolveBookingPackage('Repair'));
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="wrench" size={20} color="#DC2626" />
                        </View>
                        <View style={{ backgroundColor: bookingType === 'Repair' ? '#DC2626' : '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: bookingType === 'Repair' ? '#FFFFFF' : '#64748B' }}>
                            {bookingType === 'Repair' ? 'Selected ✓' : 'Select'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                        Mechanical & Electrical Repair
                      </Text>
                      <Text style={{ fontSize: 12, color: '#475569', lineHeight: 17, marginBottom: 12 }}>
                        Diagnostics, engine repair, electrical troubleshooting, brake overhauls, and fixes.
                      </Text>
                      <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="check2" size={14} color="#DC2626" />
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>Computer Diagnostic Scanning</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="check2" size={14} color="#DC2626" />
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>Engine & Transmission Troubleshooting</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BootstrapIcon name="check2" size={14} color="#DC2626" />
                          <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>Brakes, Battery & Electrical Wiring</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 3: DESCRIBE ISSUE (REQUIRED) */}
              {bookingStep === 3 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Describe the Issue</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Tell us what needs attention on your motorcycle.
                    </Text>
                  </View>

                  {/* Active Service Type Pill */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: bookingType === 'Repair' ? '#FFF5F5' : '#F0FDFA',
                      borderWidth: 1,
                      borderColor: bookingType === 'Repair' ? '#FECACA' : '#99F6E4',
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 12,
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <BootstrapIcon
                        name={bookingType === 'Repair' ? 'wrench' : 'wrench-adjustable'}
                        size={14}
                        color={bookingType === 'Repair' ? '#DC2626' : '#1D4533'}
                      />
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: bookingType === 'Repair' ? '#991B1B' : '#065F46' }}>
                        Service: {bookingType === 'Repair' ? 'Mechanical Repair' : 'Preventive Maintenance (PMS)'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setBookingStep(2)}
                      style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: bookingType === 'Repair' ? '#DC2626' : '#1D4533' }}>
                        Change →
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                      What seems to be the issue? *
                    </Text>
                    <TextInput
                      style={[styles.modalInput, { height: 90, textAlignVertical: 'top', marginBottom: 12 }]}
                      placeholder={
                        bookingType === 'Repair'
                          ? 'Describe any symptoms, unusual noises, leaks, or warning lights...'
                          : 'Mention any specific checks, oil preferences, or services needed...'
                      }
                      multiline={true}
                      value={serviceNotes}
                      onChangeText={setServiceNotes}
                    />

                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                      Special Instructions (Optional)
                    </Text>
                    <TextInput
                      style={[styles.modalInput, { height: 50, textAlignVertical: 'top' }]}
                      placeholder="e.g. Call before proceeding, preferred fluids..."
                      multiline={true}
                      value={additionalNotes}
                      onChangeText={setAdditionalNotes}
                    />
                  </View>

                  {/* Primary Mechanical Fault Area Selector (If Repair is selected) */}
                  {bookingType === 'Repair' && (
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                          Where is the issue located? *
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#64748B', marginBottom: 10 }}>
                        Select the primary area to inspect first:
                      </Text>
                      <View style={styles.faultAreaGrid}>
                        {REPAIR_COMMON_ISSUES.map((issue) => {
                          const isPicked = selectedRepairIssue === issue.label;
                          return (
                            <TouchableOpacity
                              key={issue.id}
                              style={[
                                styles.faultAreaCard,
                                isPicked && styles.faultAreaCardActive,
                              ]}
                              onPress={() => setSelectedRepairIssue(issue.label)}
                              activeOpacity={0.8}
                            >
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  backgroundColor: isPicked ? '#DC2626' : '#F1F5F9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <BootstrapIcon name={issue.icon || 'wrench'} size={12} color={isPicked ? '#FFFFFF' : '#64748B'} />
                              </View>
                              <Text style={{ fontSize: 11.5, fontWeight: isPicked ? '800' : '600', color: isPicked ? '#991B1B' : '#334155', flex: 1 }} numberOfLines={1}>
                                {issue.label}
                              </Text>
                              {isPicked && <BootstrapIcon name="check-circle-fill" size={12} color="#DC2626" />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 4: UPLOAD PHOTOS (OPTIONAL) */}
              {bookingStep === 4 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Add Photos or Video</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Photos help our mechanics diagnose faster (optional).
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: '#CBD5E1',
                        }}
                        onPress={handlePickPhoto}
                        disabled={isUploadingPhoto}
                      >
                        <BootstrapIcon name="camera-fill" size={14} color="#1D4533" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                          Add Photo
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: '#CBD5E1',
                        }}
                        onPress={handlePickVideo}
                        disabled={isUploadingPhoto}
                      >
                        <BootstrapIcon name="camera-reels-fill" size={14} color="#1D4533" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                          Add Video
                        </Text>
                      </TouchableOpacity>

                      {motorcyclePhotos.map((uri, idx) => {
                        const isVideo = uri.startsWith('data:video') || uri.endsWith('.mp4') || uri.endsWith('.mov');
                        return (
                          <View key={idx} style={styles.photoThumbWrap}>
                            {isVideo ? (
                              <View style={[styles.photoThumbImg, { backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }]}>
                                <BootstrapIcon name="play-circle-fill" size={24} color="#FFFFFF" />
                                <Text style={{ fontSize: 9, color: '#94A3B8', fontWeight: '800', marginTop: 2 }}>VIDEO</Text>
                              </View>
                            ) : (
                              <Image source={{ uri }} style={styles.photoThumbImg} />
                            )}
                            <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(idx)}>
                              <BootstrapIcon name="x" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 10, lineHeight: 16 }}>
                      {motorcyclePhotos.length > 0
                        ? `${motorcyclePhotos.length} file${motorcyclePhotos.length === 1 ? '' : 's'} attached.`
                        : 'Optional — you can skip this step.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* STEP 5: PREFERRED DATE & TIME */}
              {bookingStep === 5 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Preferred Date & Time</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Pick when you'd like to drop off your motorcycle.
                    </Text>
                  </View>

                  {/* Requested Schedule Card */}
                  {(() => {
                    const avail = garageService.getDaySlotAvailability(bookingDate);
                    const isBusy = avail?.isFullyBooked;
                    const dateObj = new Date(bookingDate + 'T00:00:00');
                    const isSunday = dateObj.getDay() === 0;

                    return (
                      <View
                        style={{
                          backgroundColor: isBusy || isSunday ? '#FFFBEB' : '#F0FDFA',
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isBusy || isSunday ? '#FDE68A' : '#99F6E4',
                          padding: 14,
                          marginBottom: 14,
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              backgroundColor: isBusy || isSunday ? '#D97706' : '#1D4533',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <BootstrapIcon
                              name={isSunday ? 'cup-hot-fill' : 'calendar-check-fill'}
                              size={18}
                              color="#FFFFFF"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 14, fontWeight: '900', color: '#0F172A' }}>
                                {bookingDate}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: isBusy || isSunday ? '#FEF3C7' : '#C8DDD3',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 5,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: '800',
                                    color: isBusy || isSunday ? '#B45309' : '#1D4533',
                                  }}
                                >
                                  {isSunday
                                    ? 'OFF-DUTY'
                                    : isBusy
                                      ? 'HIGH DEMAND'
                                      : `${avail?.availableSlotsCount ?? 6} Bays Available`}
                                </Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <Text style={{ fontSize: 11.5, color: '#475569' }}>
                                ⏱️ {selectedTimeSlot || 'Select Preferred Time'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Interactive Booking Calendar */}
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      padding: 12,
                      marginBottom: 14,
                    }}
                  >
                    <BookingCalendar
                      selectedDate={bookingDate}
                      onSelectDate={(newDate) => setBookingDate(newDate)}
                      selectedTime={selectedTimeSlot}
                      onSelectTime={(newTime) => setSelectedTimeSlot(newTime)}
                      getTimeSlots={(dateStr) => {
                        const selAvail = garageService.getDaySlotAvailability(dateStr);
                        return selAvail?.slots || [];
                      }}
                      onFullyBookedSelected={(dateStr) => {
                        if (showToast) showToast(`ℹ️ ${dateStr} is busy. You can still request it — admin will confirm.`);
                      }}
                      minDate={new Date().toISOString().split('T')[0]}
                      getDayInfo={(dateStr) => {
                        const selAvail = garageService.getDaySlotAvailability(dateStr);
                        const d = new Date(dateStr + 'T00:00:00');
                        const isSunday = d.getDay() === 0;
                        const bookedCount = selAvail?.bookedSlotsCount || 0;
                        return {
                          bookingCount: bookedCount,
                          isFullyBooked: selAvail?.isFullyBooked || false,
                          isOffDuty: isSunday,
                          label: bookedCount === 0 && !isSunday ? 'Open' : undefined,
                        };
                      }}
                      statusBarText="Hours: 9:00 AM – 6:00 PM (Mon – Sat)."
                      offDutyCount={1}
                      compact={true}
                    />
                  </View>

                  {/* Summary Card */}
                  {(() => {
                    const serviceLabel = bookingType === 'Repair' ? SERVICE_TYPE_LABELS.Repair : SERVICE_TYPE_LABELS.PMS;

                    return (
                      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Request Summary
                        </Text>
                        <View style={{ gap: 8, marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>📅 Date & Time:</Text>
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A' }}>
                              {bookingDate} • {selectedTimeSlot || 'Morning'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>🔧 Service:</Text>
                            <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1D4533' }}>
                              {serviceLabel}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>🛵 Motorcycle:</Text>
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A' }}>
                              {bikeBrand} {bikeModel} {bikeYear ? `(${bikeYear})` : ''}
                            </Text>
                          </View>
                          {serviceNotes.trim() ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                              <Text style={{ fontSize: 12, color: '#64748B' }}>📝 Details:</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'right' }} numberOfLines={2}>
                                {serviceNotes.trim()}
                              </Text>
                            </View>
                          ) : null}
                          {motorcyclePhotos.length > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#64748B' }}>📎 Photos:</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4533' }}>
                                {motorcyclePhotos.length} file{motorcyclePhotos.length === 1 ? '' : 's'} attached
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Concise, reassuring notice */}
                        <View
                          style={{
                            backgroundColor: '#F0FDFA',
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1.5,
                            borderColor: '#99F6E4',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <BootstrapIcon name="shield-check" size={17} color="#1D4533" />
                          <Text style={{ fontSize: 12, color: '#134E4A', flex: 1, fontWeight: '600', lineHeight: 17 }}>
                            No payment needed now. You'll receive an itemized quotation to review and approve before any work starts.
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}
            </ScrollView>

            {/* Stepper Footer Controls */}
            {(() => {
              const serviceLabel = bookingType === 'Repair' ? SERVICE_TYPE_LABELS.Repair : SERVICE_TYPE_LABELS.PMS;

              return (
                <View style={styles.stepperFooter}>
                  <TouchableOpacity
                    style={styles.stepBackBtn}
                    onPress={handlePrevStep}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name={bookingStep > 1 ? 'arrow-left' : 'x'} size={13} color="#475569" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>
                      {bookingStep > 1 ? 'Back' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }} numberOfLines={1}>
                      Step {bookingStep}/5 • {bookingStep === 5 ? 'Review & Submit' : serviceLabel}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.stepNextBtn,
                      bookingType === 'Repair' && { backgroundColor: '#DC2626' },
                    ]}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.stepNextBtnText}>
                      {bookingStep === 1
                        ? 'Next: Service Type →'
                        : bookingStep === 2
                          ? 'Next: Describe Problem →'
                          : bookingStep === 3
                            ? 'Next: Photos →'
                            : bookingStep === 4
                              ? 'Next: Date & Time →'
                              : 'Submit Request →'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
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
      {/* Register Motorcycle Modal (opened from Step 1 of the booking wizard) */}
      <RegisterMotorcycleModal
        visible={isRegisterMotorcycleModalOpen}
        motorcycle={null}
        isDarkMode={false}
        onClose={() => setIsRegisterMotorcycleModalOpen(false)}
        onSave={handleRegisterMotorcycle}
      />

      {/* Strict Non-Refundable Cancellation Confirmation Modal */}
      <ConfirmModal
        visible={isCancelModalOpen}
        title={isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0) ? 'Cancel Service Request?' : 'Cancel Pit Bay Appointment?'}
        message={
          isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0)
            ? `Cancel service request #${bookingToCancel?.id}? No payment has been made, so nothing will be charged.`
            : `⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour advance downpayment of ₱${(bookingToCancel?.amount_paid || bookingToCancel?.downpayment_amount || Math.round((bookingToCancel?.pricePhp || 2500) * 0.2)).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover technician and bay allocation. Are you sure you wish to cancel?`
        }
        confirmText={isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0) ? 'Yes, Cancel Request' : 'Yes, Cancel & Forfeit Downpayment'}
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
                <BootstrapIcon name="tools" size={18} color="#1D4533" />
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
                    <Text style={styles.rosterItemSpec}>⚡ {mech.specialization}</Text>
                    <Text style={styles.rosterItemBay}>📍 {mech.bay}</Text>
                  </View>
                  <View
                    style={[
                      styles.rosterStatusPill,
                      {
                        backgroundColor: mech.isAvailable
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        borderWidth: 1,
                        borderColor: mech.isAvailable ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.rosterStatusText, { color: mech.isAvailable ? '#10B981' : '#EF4444' }]}
                    >
                      {mech.status}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#1E293B',
                flexDirection: 'row',
                justifyContent: 'flex-end',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#1D4533',
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
