import React, { useState, useEffect, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  BottomNavBar,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  NotificationDropdown,
  BookingSelect,
  BookingCalendar,
  SegmentedToggle,
  CustomerServiceBookingCard,
} from '../components';
import { isFlexibleBooking, normalizeBookingStatus } from '../utils/serviceQuotation';
import {
  LiveOrderTrackingMapModal,
  ConfirmModal,
  CartModal,
  CheckoutModal,
  RegisterMotorcycleModal,
} from '../components/modals';
import { garageWebStyles as gStyles } from '../styles/web/garagePage.web.styles';
import { useAuth } from '../context/AuthContext';
import {
  garageService,
  generateBookingId,
  REPAIR_COMMON_ISSUES,
  BOOKING_CATEGORIES,
  GARAGE_BRANCHES,
  TIME_SLOTS,
} from '../services/garageService';
import { pickImageFromFile, pickVideoFromFile } from '../utils/imagePickerHelper';
import { orderService } from '../services/orderService';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../services/motorcycleService';
import { notificationService } from '../services/notificationService';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { authService } from '../services/authService';
import { CUSTOMER_USER } from '../services/userService';

const SERVICE_TYPE_LABELS = {
  PMS: 'PMS Service',
  Repair: 'Repair Service',
};


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
  const isDesktop = windowWidth >= 1024;
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { wishlistCount } = useWishlist();
  const { cartItemCount } = useCart();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser?.id) : 0
  );
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(
        currentUser ? notificationService.getUnreadCount(currentUser?.id) : 0
      );
    });
    return () => unsub?.();
  }, [currentUser]);

  const flagshipBranch = GARAGE_BRANCHES[0] || {
    name: "D'Blockchain Motorparts and Accessories",
    address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
    phone: '(+63) 917 882 9102',
    bays: '6 Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay',
    hours: 'Mon - Sun: 8:00 AM - 7:00 PM',
  };

  const [activeTab, setActiveTab] = useState('Scheduled');
  const [servicesList, setServicesList] = useState(() => garageService.getActivePackages());
  const [userBookings, setUserBookings] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');
  const [bookingViewMode, setBookingViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedBookingForModal, setSelectedBookingForModal] = useState(null);
  const [bookingsPage, setBookingsPage] = useState(1);
  const BOOKINGS_PAGE_SIZE = 6;

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

  const bookingsTotalPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PAGE_SIZE));
  const pagedBookings = useMemo(() => {
    const start = (bookingsPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredBookings.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filteredBookings, bookingsPage]);
  useEffect(() => {
    if (bookingsPage > bookingsTotalPages) setBookingsPage(1);
  }, [bookingsPage, bookingsTotalPages]);

  // Keep selected booking in modal synced if userBookings refreshes
  const activeModalBooking = useMemo(() => {
    if (!selectedBookingForModal) return null;
    const modalId = selectedBookingForModal?.booking_id || selectedBookingForModal?.id;
    return userBookings.find((b) => (b?.booking_id || b?.id) === modalId) || selectedBookingForModal;
  }, [userBookings, selectedBookingForModal]);
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
    showToast(
      next
        ? '🔴 Pit Bays simulated as Fully Booked for Today'
        : '🟢 Pit Bays restored to Live Open Slot Availability'
    );
  };

  // Cancellation Warning Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Booking Wizard State
  const [bookingStep, setBookingStep] = useState(1);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isRegisterBikeModalOpen, setIsRegisterBikeModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingType, setBookingType] = useState('PMS'); // 'Repair' | 'PMS'
  const [selectedRepairIssue, setSelectedRepairIssue] = useState('Engine & Transmission');

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeYear, setBikeYear] = useState('');
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
    const availability = garageService.getDaySlotAvailability(dateStr);
    if (availability?.isFullyBooked) {
      showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! All pit bays are reserved.`);
    }
  };
  const [selectedTime, setSelectedTime] = useState('10:30 AM - 12:00 PM');
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
  const [motorcyclePhotos, setMotorcyclePhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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

        // Check local users database if phone is not in active session
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

      // Fallback to customer demo profile if no logged-in user or empty
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

  const [garageMotorcycles, setGarageMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState('');

  const applyRegisteredMotorcycle = (m) => {
    if (!m) return;
    setSelectedMotorcycleId(m.motorcycle_id);
    setBikeBrand(m.brand || 'Yamaha');
    setBikeModel(m.model || '');
    setBikePlate(m.plate_number || '');
    setBikeYear(m.year ? String(m.year) : '');
    if (m.odometer) setBikeOdo(String(m.odometer));
  };

  // Sync profile details and registered garage motorcycles if logged in
  useEffect(() => {
    if (currentUser) {
      const cName = currentUser.name || currentUser.fullName || currentUser.user_metadata?.full_name || '';
      const cPhone = currentUser.phone || currentUser.phoneNumber || currentUser.contactNumber || '';
      if (cName) setOwnerName(cName);
      if (cPhone) setOwnerPhone(cPhone);
    }
  }, [currentUser]);

  // Auto-fetch customer details when booking modal is opened if fields are empty
  useEffect(() => {
    if (isBookingModalOpen) {
      if (!ownerName || !ownerPhone) {
        handleFetchCustomerDetails(true);
      }
    }
  }, [isBookingModalOpen]);

  // Sync registered garage motorcycles from service
  useEffect(() => {
    let unsub = () => {};
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
    garageService
      .fetchServices()
      .then((list) => {
        setServicesList(Array.isArray(list) ? list : garageService.getActivePackages());
      })
      .catch(() => {
        setServicesList(garageService.getActivePackages());
      });
    garageService
      .fetchMechanics()
      .then(() => {
        refreshAvailability();
      })
      .catch(() => {});
    refreshBookings();
    refreshAvailability();
    const unsubServices = garageService.subscribe((updatedServices) => {
      setServicesList(Array.isArray(updatedServices) ? updatedServices : garageService.getActivePackages());
    });
    const unsubBookings = garageService.subscribeBookings(() => {
      refreshBookings();
      refreshAvailability();
    });
    return () => {
      unsubServices?.();
      unsubBookings?.();
    };
  }, [currentUser]);

  const BOOKING_STEPS = [
    { id: 1, label: 'Select Motorcycle', shortLabel: 'Motorcycle', icon: 'bicycle' },
    { id: 2, label: 'Service Type', shortLabel: 'Service', icon: 'tools' },
    { id: 3, label: 'Describe Problem', shortLabel: 'Problem', icon: 'chat-left-text-fill' },
    { id: 4, label: 'Upload Photos', shortLabel: 'Photos', icon: 'camera-fill' },
    { id: 5, label: 'Preferred Date & Time', shortLabel: 'Schedule', icon: 'calendar-check-fill' },
  ];

  const getStepValidation = (step) => {
    if (step === 1) {
      if (!currentUser) return { valid: false, message: 'Please sign in to book a service for your registered motorcycle.' };
      if (!selectedMotorcycleId) return { valid: false, message: 'Please select a registered motorcycle, or register one first.' };
      return { valid: true };
    }
    if (step === 2) {
      if (!bookingType) return { valid: false, message: 'Please select a service type (PMS or Repair).' };
      return { valid: true };
    }
    if (step === 3) {
      if (!serviceNotes?.trim()) {
        return { valid: false, message: 'Please describe the problem or the service you need.' };
      }
      return { valid: true };
    }
    if (step === 4) {
      // Photos are optional — nothing to validate.
      return { valid: true };
    }
    if (step === 5) {
      if (!selectedDate) return { valid: false, message: 'Please select your preferred date from the calendar.' };
      if (!selectedTime) return { valid: false, message: 'Please select your preferred time window.' };
      // Fully booked days are allowed: the schedule is only a request for admin review.
      return { valid: true };
    }
    return { valid: true };
  };

  const handleNextStep = () => {
    const validation = getStepValidation(bookingStep);
    if (!validation.valid) {
      showToast(`⚠️ ${validation.message}`);
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
        showToast(`⚠️ Please complete Step ${s} first: ${val.message}`);
        return;
      }
    }
    setBookingStep(targetStep);
  };

  const handleOpenBooking = (type) => {
    setBookingType(type === 'Repair' ? 'Repair' : 'PMS');
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
    setBookingStep(1);
    setIsCalendarModalOpen(false);
    setIsBookingModalOpen(true);
  };

  const handleSaveRegisteredMotorcycle = async (motoData) => {
    const res = await motorcycleService.addMotorcycle({
      ...motoData,
      user_id: currentUser?.id || 'usr-rider-01',
      customer_id: currentUser?.customerId || currentUser?.customer_id || 'cust-demo-01',
      customer_email: currentUser?.email || '',
    });
    const list = motorcycleService.getMotorcycles(currentUser?.id) || [];
    setGarageMotorcycles(list);
    const saved =
      list.find((m) => m.motorcycle_id === res?.motorcycle?.motorcycle_id) || res?.motorcycle;
    if (saved) applyRegisteredMotorcycle(saved);
    showToast(
      res?.warning
        ? `✓ Registered in My Garage (${res.warning})`
        : `✓ Registered ${motoData.brand} ${motoData.model} to My Garage`
    );
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
    setBookingType(newType === 'Repair' ? 'Repair' : 'PMS');
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

  const handleRemovePhoto = (index) => {
    setMotorcyclePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Flexible booking: no package, no pricing, no downpayment. Admin quotes after inspection.
  const handleConfirmBooking = async () => {
    try {
      if (!currentUser) {
        showToast('⚠️ Please sign in to submit a service request.');
        return;
      }
      if (!selectedMotorcycleId && (!garageMotorcycles || garageMotorcycles.length === 0)) {
        showToast('⚠️ Please select a registered motorcycle from My Garage.');
        return;
      }
      if (!serviceNotes.trim()) {
        showToast('⚠️ Please describe the problem or the service you need.');
        return;
      }
      if (!selectedDate || !selectedTime) {
        showToast('⚠️ Please choose your preferred date and time window.');
        return;
      }

      const registeredBike =
        (garageMotorcycles || []).find(
          (m) => String(m.motorcycle_id || m.id) === String(selectedMotorcycleId)
        ) || (garageMotorcycles && garageMotorcycles[0]) || null;

      const brand = registeredBike?.brand || bikeBrand || 'Motorcycle';
      const model = registeredBike?.model || bikeModel || '';
      const plate = registeredBike?.plate_number || bikePlate || 'TEMP-PLATE';
      const year = registeredBike?.year ? String(registeredBike.year) : bikeYear || '';
      const odometer = registeredBike?.odometer ? String(registeredBike.odometer) : bikeOdo || '';

      const serviceLabel = SERVICE_TYPE_LABELS[bookingType] || SERVICE_TYPE_LABELS.PMS;

      const finalNotes =
        bookingType === 'Repair' && selectedRepairIssue
          ? `[Fault: ${selectedRepairIssue}] ${serviceNotes.trim()}`
          : serviceNotes.trim();

      const bookingId = generateBookingId(bookingType, userBookings || []);

      const bookingDraft = {
        id: bookingId,
        booking_id: bookingId,
        booking_mode: 'flexible',
        flexible: true,
        skip_downpayment: true,
        serviceId: null,
        service_id: null,
        package_id: null,
        package_name: serviceLabel,
        package_price: 0,
        serviceName: serviceLabel,
        service_title: serviceLabel,
        servicePrice: 0,
        pricePhp: 0,
        downpayment_required: false,
        downpayment_percent: 0,
        downpayment_amount: 0,
        remaining_balance: 0,
        is_non_refundable: false,
        category: bookingType,
        service_type: bookingType,
        repair_type: bookingType === 'Repair' ? selectedRepairIssue : undefined,
        problem_description: finalNotes,
        userEmail: currentUser?.email || 'rider@mototrack.com',
        customer_email: currentUser?.email || 'rider@mototrack.com',
        userName: ownerName,
        customer_name: ownerName,
        userPhone: ownerPhone,
        customer_phone: ownerPhone,
        customer_id: currentUser?.customer_id || currentUser?.id,
        motorcycle_id: selectedMotorcycleId || registeredBike?.motorcycle_id || registeredBike?.id || 'moto-default',
        bikeBrand: brand,
        bike_brand: brand,
        bikeModel: model,
        bike_model: model,
        bikeYear: year,
        bike_year: year,
        year,
        bikePlate: plate,
        plate_number: plate,
        bikeOdo: odometer,
        bike_odo: odometer,
        odometer,
        photos: motorcyclePhotos,
        media_urls: motorcyclePhotos,
        branch: flagshipBranch.name,
        branch_address: flagshipBranch.address,
        appointment_date: selectedDate,
        preferred_date: selectedDate,
        date: selectedDate,
        time_slot: selectedTime,
        preferred_time: selectedTime,
        time: selectedTime,
        notes: additionalNotes.trim() ? additionalNotes.trim() : finalNotes,
        additional_notes: additionalNotes.trim(),
        status: 'PENDING_REVIEW',
        service_progress: 0,
        createdAt: new Date().toISOString(),
        customerPhone: ownerPhone,
      };

      await garageService.addBooking(bookingDraft);
      refreshBookings();
      setIsBookingModalOpen(false);
      setBookingStep(1);
      setMotorcyclePhotos([]);
      setServiceNotes('');
      setAdditionalNotes('');
      showToast(
        `Your service request (#${bookingId}) has been submitted. Our admin will review your request and provide a quotation.`
      );
      setActiveTab('Scheduled');
      setTimeout(() => {
        const el = document.getElementById('scheduled-booking-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      console.error('Booking confirmation failed:', err);
      showToast('⚠️ Could not submit booking request. Please try again.');
    }
  };

  const handlePromptCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    const noCharge = isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0);
    await garageService.cancelBooking(bookingToCancel.id);
    refreshBookings();
    setIsCancelModalOpen(false);
    setBookingToCancel(null);
    showToast(noCharge ? 'Service request cancelled.' : 'Appointment cancelled. Downpayment was forfeited per policy.');
  };

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
                dataSet={{ notificationButton: true }}
                {...(Platform.OS === 'web' ? { 'data-notification-button': 'true' } : {})}
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
                onNavigateToScreen={(screen, params) => {
                  if (screen === 'store' || screen === 'shop') onNavigateToStore?.();
                  else if (screen === 'orders') onNavigateToOrders?.();
                  else if (screen === 'notifications') onNavigateToProfile?.('notifications');
                  else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'overview');
                }}
                currentUser={currentUser}
              />
            </View>

            {/* Cart Button */}
            <TouchableOpacity
              style={gStyles.navActionIconBtn}
              onPress={() => setIsCartOpen(true)}
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
                  backgroundColor: 'rgba(29, 69, 51, 0.4)',
                  borderWidth: 1,
                  borderColor: '#1D4533',
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
              <Text style={gStyles.garageHeaderSub}>
                Manage your motorcycle service appointments and maintenance bookings.
              </Text>
            </View>

            <View style={gStyles.garageHeaderActions}>
              <TouchableOpacity
                style={[
                  gStyles.tabBtn,
                  {
                    backgroundColor: '#1D4533',
                    borderColor: '#1D4533',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(29, 69, 51, 0.22)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s ease',
                  },
                ]}
                onPress={() => handleOpenBooking('PMS')}
                activeOpacity={0.85}
              >
                <BootstrapIcon
                  name="calendar-plus-fill"
                  size={15}
                  color="#FFFFFF"
                />
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '800',
                    color: '#FFFFFF',
                    letterSpacing: 0.3,
                  }}
                >
                  Book Now
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── 4 KPI STATS GRID (CLEAN MODERN SAAS) ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full">
            {/* Card 1: MECHANICS AVAILABLE */}
            <div
              className="bg-white rounded-2xl p-5 border border-emerald-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[145px] cursor-pointer"
              onClick={() => setIsRosterModalOpen(true)}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Mechanics Available
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    mechanicsData.availableCount > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {mechanicsData.availableCount > 0 ? `${mechanicsData.availableCount} Available` : 'Busy'}
                  </span>
                </div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none block font-mono">
                  {mechanicsData.availableCount}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-500 mt-3 block leading-snug">
                {mechanicsData.availableCount > 0
                  ? `${mechanicsData.availableCount} of ${mechanicsData.totalCount} on-duty & available`
                  : 'All technicians currently busy in pit bays'}
              </span>
            </div>

            {/* Card 2: TODAY'S SLOTS */}
            <div
              className={`bg-white rounded-2xl p-5 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[145px] ${
                todaySlotsData.isFullyBooked
                  ? 'border-rose-200 bg-rose-50/20'
                  : 'border-amber-200/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Today's Slots
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    todaySlotsData.isFullyBooked
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {todaySlotsData.isFullyBooked ? 'Full' : `${todaySlotsData.totalSlots} Slots`}
                  </span>
                </div>
                <span
                  className={`text-3xl font-extrabold tracking-tight leading-none block font-mono ${
                    todaySlotsData.isFullyBooked ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {todaySlotsData.isFullyBooked ? '0' : todaySlotsData.availableSlotsCount}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-500 mt-3 block leading-snug">
                {todaySlotsData.isFullyBooked
                  ? 'Fully booked for today (0 remaining)'
                  : `${todaySlotsData.bookedSlotsCount} of ${todaySlotsData.totalSlots} daily slots reserved`}
              </span>
            </div>

            {/* Card 3: NEXT OPENING */}
            <div className="bg-white rounded-2xl p-5 border border-purple-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Next Opening
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {todaySlotsData.isFullyBooked ? 'Tomorrow' : 'Express'}
                  </span>
                </div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none block font-mono">
                  {todaySlotsData.isFullyBooked ? 'Tomorrow' : 'Today'}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-500 mt-3 block leading-snug">
                {todaySlotsData.isFullyBooked
                  ? '09:00 AM - 10:30 AM (Next Slot)'
                  : 'Immediate express pit bay slot'}
              </span>
            </div>

            {/* Card 4: PIT BAY CAPACITY */}
            <div className="bg-white rounded-2xl p-5 border border-sky-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Pit Bay Capacity
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    Active Bays
                  </span>
                </div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none block font-mono">
                  6
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-500 mt-3 block leading-snug">
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
                  All 6 pit bays are currently at maximum capacity. You can pre-book a guaranteed slot for
                  tomorrow or future dates to reserve immediate technician assignment.
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
              {/* Section Header & Count */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: '#ECFDF5',
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="calendar3" size={16} color="#059669" />
                    </View>
                    <Text style={[gStyles.sectionTitle, { marginBottom: 0 }]}>Scheduled Bookings</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginLeft: 44, fontWeight: '500' }}>
                    View and manage your upcoming motorcycle service appointments.
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <BootstrapIcon name="ticket-detailed" size={13} color="#059669" />
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#065F46' }}>
                    {userBookings.length} Scheduled {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                  </Text>
                </View>
              </View>

              {/* Modern Segmented Status Filter Tabs + Grid/List View Toggle */}
              {currentUser && userBookings.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex flex-row items-center gap-1.5 flex-wrap p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl w-fit">
                    {[
                      { key: 'ALL', label: `All (${userBookings.length})` },
                      { key: 'PENDING', label: 'Pending Review' },
                      { key: 'IN_PROGRESS', label: 'In Service' },
                      { key: 'READY', label: 'Ready for Pickup' },
                      { key: 'COMPLETED', label: 'Completed' },
                    ].map((tab) => {
                      const isSel = bookingStatusFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => {
                            setBookingStatusFilter(tab.key);
                            setBookingsPage(1);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                            isSel
                              ? 'bg-[#1D4533] text-white shadow-xs'
                              : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Grid / List View Mode Toggle Button Group */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl w-fit self-start sm:self-auto">
                    <button
                      onClick={() => setBookingViewMode('grid')}
                      title="Grid View"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                        bookingViewMode === 'grid'
                          ? 'bg-[#1D4533] text-white shadow-xs'
                          : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      <BootstrapIcon
                        name="grid-fill"
                        size={13}
                        color={bookingViewMode === 'grid' ? '#FFFFFF' : '#475569'}
                      />
                      <span>Grid</span>
                    </button>
                    <button
                      onClick={() => setBookingViewMode('list')}
                      title="List View"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                        bookingViewMode === 'list'
                          ? 'bg-[#1D4533] text-white shadow-xs'
                          : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      <BootstrapIcon
                        name="view-list"
                        size={14}
                        color={bookingViewMode === 'list' ? '#FFFFFF' : '#475569'}
                      />
                      <span>List</span>
                    </button>
                  </div>
                </div>
              )}

              {!currentUser ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-xs my-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4 text-[#1D4533]">
                    <BootstrapIcon name="person-lock" size={26} color="#1D4533" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    Sign In to View Scheduled Bookings
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                    Sign in to your account to view your scheduled appointments, track master mechanic assignments, and manage service downpayments.
                  </p>
                  <button
                    onClick={() => {
                      setRedirectReason('Please sign in to view your booked pitstop appointments.');
                      onNavigateToLogin?.();
                    }}
                    className="bg-[#1D4533] hover:bg-[#153426] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <BootstrapIcon name="box-arrow-in-right" size={13} color="#FFFFFF" />
                    Sign In Now
                  </button>
                </div>
              ) : userBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-xs my-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 text-[#1D4533]">
                    <BootstrapIcon name="calendar-plus" size={26} color="#1D4533" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">No scheduled bookings</h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                    You don't have any service appointments matching this filter. Book a service to get your slot reserved.
                  </p>
                  <button
                    onClick={() => handleOpenBooking('PMS')}
                    className="bg-[#1D4533] hover:bg-[#153426] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <BootstrapIcon name="tools" size={13} color="#FFFFFF" />
                    Book a Service
                  </button>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto shadow-xs my-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
                    <BootstrapIcon name="calendar2-x" size={22} color="#94A3B8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">No bookings in this filter</h3>
                  <p className="text-xs text-slate-500 mb-4">Switch to "All" to view your full booking history.</p>
                  <button
                    onClick={() => {
                      setBookingStatusFilter('ALL');
                      setBookingsPage(1);
                    }}
                    className="bg-[#1D4533] hover:bg-[#153426] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    View All Bookings
                  </button>
                </div>
              ) : (
                <div
                  className={
                    bookingViewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full items-start'
                      : 'flex flex-col gap-3.5 w-full'
                  }
                >
                  {pagedBookings.map((b) => {
                    const flexStatus = normalizeBookingStatus(b?.status);
                    const canCancel = [
                      'PENDING_REVIEW',
                      'APPROVED',
                      'SCHEDULED',
                      'AWAITING_CUSTOMER_APPROVAL',
                      'QUOTATION_SENT',
                      'AWAITING_DOWNPAYMENT',
                    ].includes(flexStatus);
                    return (
                      <div key={b.id || b.booking_id} className="w-full">
                        <CustomerServiceBookingCard
                          booking={b}
                          viewMode={bookingViewMode}
                          onToast={showToast}
                          onUpdated={() => refreshBookings()}
                          canCancel={canCancel}
                          onCancel={() => handlePromptCancelBooking(b)}
                          onViewDetails={(item) => setSelectedBookingForModal(item)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {bookingsTotalPages > 1 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    paddingVertical: 14,
                    width: '100%',
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
            } else if (tab === 'Wishlist' || tab === 'Favorites') {
              onNavigateToWishlist?.();
            } else if (tab === 'More') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('menu');
              }
            } else if (tab === 'Dashboard') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('overview');
              }
            } else if (tab === 'Bookings') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('bookings');
              }
            } else if (tab === 'Notifications') {
              onNavigateToProfile?.('notifications');
            } else if (tab === 'Admin') {
              if (currentUser?.role === 'admin') {
                onNavigateToAdmin?.();
              }
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.('profile');
              }
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}

      {/* ─── STEP 1: CALENDAR DATE SELECTION MODAL ─── */}
      <Modal
        visible={isCalendarModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCalendarModalOpen(false)}
      >
        <View style={gStyles.popupModalOverlay}>
          <TouchableOpacity
            style={gStyles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsCalendarModalOpen(false)}
          />

          <View
            style={[
              gStyles.popupModalCard,
              {
                maxWidth: 820,
                maxHeight: '92vh',
                padding: 0,
                overflow: 'hidden',
                borderRadius: 24,
              },
            ]}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 22,
                paddingVertical: 16,
                borderBottomWidth: 1.5,
                borderBottomColor: '#F1F5F9',
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: '#E8F0EC',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar-check-fill" size={20} color="#1D4533" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: '#E8F0EC',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1D4533', letterSpacing: 0.5 }}>
                        STEP 1 OF 2
                      </Text>
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
                      Select Appointment Date & Time
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                    Pick an open date and time slot for your {bookingType === 'Repair' ? 'Mechanical Repair' : 'PMS Maintenance'} service
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onPress={() => setIsCalendarModalOpen(false)}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Calendar Body */}
            <ScrollView style={{ padding: 18, maxHeight: '68vh' }} showsVerticalScrollIndicator={true}>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={(newDate) => handleSelectDate(newDate)}
                selectedTime={selectedTime}
                onSelectTime={(newTime) => setSelectedTime(newTime)}
                getTimeSlots={(dateStr) => {
                  const selAvail = garageService.getDaySlotAvailability(dateStr);
                  return selAvail?.slots || [];
                }}
                onFullyBookedSelected={(dateStr) => {
                  showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! All 6 pit bay slots are reserved.`);
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
                statusBarText="Hours: 9:00 AM – 6:00 PM (Mon – Sat). Select an open date and time slot."
                offDutyCount={1}
              />
            </ScrollView>

            {/* Footer Status & Proceed Action */}
            {(() => {
              const availability = garageService.getDaySlotAvailability(selectedDate);
              const isFull = availability?.isFullyBooked;
              return (
                <View
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                    borderTopWidth: 1.5,
                    borderTopColor: '#F1F5F9',
                    backgroundColor: isFull ? '#FFF1F2' : '#F0FDFA',
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: isDesktop ? 'center' : 'stretch',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: isFull ? '#FEE2E2' : '#C8DDD3',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BootstrapIcon
                        name={isFull ? 'slash-circle-fill' : 'check2-circle'}
                        size={18}
                        color={isFull ? '#DC2626' : '#1D4533'}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: isFull ? '#991B1B' : '#0F172A' }}>
                          Selected: {selectedDate}
                        </Text>
                        {selectedTime && (
                          <View
                            style={{
                              backgroundColor: '#E8F0EC',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                            }}
                          >
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1D4533' }}>
                              ⏱️ {selectedTime}
                            </Text>
                          </View>
                        )}
                        <View
                          style={{
                            backgroundColor: isFull ? '#FEE2E2' : '#C8DDD3',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10.5,
                              fontWeight: '800',
                              color: isFull ? '#DC2626' : '#1D4533',
                            }}
                          >
                            {isFull ? 'FULLY BOOKED' : `${availability?.availableSlotsCount ?? 6} Bays Open`}
                          </Text>
                        </View>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 11.5, color: isFull ? '#B91C1C' : '#64748B', marginTop: 2 }}
                      >
                        {isFull
                          ? 'This date is completely booked. Select another day above.'
                          : 'Service bays are open on this date. Click proceed to enter your motorcycle details.'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onPress={() => setIsCalendarModalOpen(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isFull}
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: isFull ? '#CBD5E1' : '#1D4533',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: isFull ? 'not-allowed' : 'pointer',
                        boxShadow: isFull ? 'none' : '0 4px 14px rgba(29, 69, 51, 0.25)',
                      }}
                      onPress={handleProceedToBookingForm}
                      activeOpacity={0.85}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: isFull ? '#64748B' : '#FFFFFF' }}>
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
        <View style={gStyles.popupModalOverlay}>
          {/* Backdrop click dismiss */}
          <TouchableOpacity
            style={gStyles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsBookingModalOpen(false)}
          />

          <View
            style={[
              gStyles.popupModalCard,
              {
                maxWidth: 760,
                maxHeight: '92vh',
                transition: 'max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              },
            ]}
          >
            {/* Modal Header & 5-Step Progress Indicator */}
            <View style={gStyles.stepperHeader}>
              <View style={gStyles.stepperTitleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={[
                      gStyles.stepperIconWrap,
                      bookingType === 'Repair' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                    ]}
                  >
                    <BootstrapIcon
                      name={BOOKING_STEPS[bookingStep - 1]?.icon || 'bicycle'}
                      size={18}
                      color={bookingType === 'Repair' ? '#DC2626' : '#1D4533'}
                    />
                  </View>
                  <View>
                    <Text style={gStyles.stepperModalTitle}>Service Request</Text>
                    <Text
                      style={[
                        gStyles.stepperModalSubtitle,
                        bookingType === 'Repair' && { color: '#DC2626' },
                      ]}
                    >
                      Step {bookingStep} of 5: {BOOKING_STEPS[bookingStep - 1]?.label}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={gStyles.stepperCloseBtn}
                  onPress={() => setIsBookingModalOpen(false)}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* 5-Step Progress Stepper Indicator */}
              <View style={gStyles.stepIndicatorContainer}>
                {BOOKING_STEPS.map((step, idx) => {
                  const stepNum = idx + 1;
                  const isActive = bookingStep === stepNum;
                  const isCompleted = bookingStep > stepNum;
                  return (
                    <React.Fragment key={step.id}>
                      <TouchableOpacity
                        style={gStyles.stepNodeWrap}
                        onPress={() => handleStepClick(stepNum)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            gStyles.stepCircle,
                            isActive && (bookingType === 'Repair' ? { backgroundColor: '#DC2626', borderColor: '#DC2626', boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.2)' } : gStyles.stepCircleActive),
                            isCompleted && gStyles.stepCircleCompleted,
                          ]}
                        >
                          {isCompleted ? (
                            <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
                          ) : (
                            <Text
                              style={[
                                gStyles.stepNumberText,
                                isActive && gStyles.stepNumberTextActive,
                              ]}
                            >
                              {stepNum}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[
                            gStyles.stepLabel,
                            isActive && (bookingType === 'Repair' ? { color: '#DC2626', fontWeight: '900' } : gStyles.stepLabelActive),
                            isCompleted && gStyles.stepLabelCompleted,
                            { display: isDesktop ? 'flex' : (isActive ? 'flex' : 'none') },
                          ]}
                          numberOfLines={1}
                        >
                          {isDesktop ? step.label : step.shortLabel}
                        </Text>
                      </TouchableOpacity>
                      {idx < BOOKING_STEPS.length - 1 && (
                        <View
                          style={[
                            gStyles.stepConnectingLine,
                            isCompleted && gStyles.stepConnectingLineCompleted,
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* Scrollable Step Body */}
            <ScrollView style={gStyles.popupModalBody} showsVerticalScrollIndicator={true}>
              {/* ════════════════════════════════════════════════════════════════
                  STEP 1: SELECT MOTORCYCLE (REGISTERED ONLY)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 1 && (
                <View>
                  <View style={gStyles.stepSectionHeader}>
                    <Text style={gStyles.stepSectionTitle}>Select Motorcycle</Text>
                    <Text style={gStyles.stepSectionSubtitle}>
                      Choose the motorcycle that needs service.
                    </Text>
                  </View>

                  {!currentUser ? (
                    <View
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                        Sign in to continue
                      </Text>
                      <Text style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12 }}>
                        Please sign in to select a motorcycle from your garage.
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsBookingModalOpen(false);
                          setRedirectReason?.('Please sign in to book a service for your motorcycle.');
                          onNavigateToLogin?.();
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: '#1D4533',
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  ) : !garageMotorcycles.length ? (
                    <View
                      style={{
                        backgroundColor: '#FFFBEB',
                        borderWidth: 1.5,
                        borderColor: '#FDE68A',
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 }}>
                        No motorcycles registered yet
                      </Text>
                      <Text style={{ fontSize: 12.5, color: '#B45309', marginBottom: 12 }}>
                        Add your motorcycle to request a service.
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsRegisterBikeModalOpen(true)}
                        style={{
                          alignSelf: 'flex-start',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: '#1D4533',
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>
                          Add Motorcycle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <View style={gStyles.motorcycleCardGrid}>
                        {garageMotorcycles.map((m) => {
                          const isPicked = String(m.motorcycle_id) === String(selectedMotorcycleId);
                          const bikePhoto = m.photo_url || null;

                          return (
                            <TouchableOpacity
                              key={m.motorcycle_id}
                              style={[
                                gStyles.motorcycleCard,
                                isPicked && gStyles.motorcycleCardActive,
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
                                {bikePhoto ? (
                                  <Image
                                    source={{ uri: bikePhoto }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <View style={{ alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <BootstrapIcon name="bicycle" size={42} color="#94A3B8" />
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>
                                      No photo uploaded
                                    </Text>
                                  </View>
                                )}

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

                                {/* Star / Status Badge */}
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

                              {/* Card Middle: Title & Subtitle */}
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
                                  {m.engine_cc ? `${m.engine_cc}cc` : 'Registered Unit'}
                                  {m.is_primary ? ' • Primary' : ''}
                                </Text>
                              </View>

                              {/* Card Bottom: Plate on Left + Pill Button on Right */}
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
                                    PLATE
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 14.5,
                                      fontWeight: '900',
                                      color: '#0F172A',
                                      letterSpacing: -0.2,
                                      marginTop: 1,
                                    }}
                                  >
                                    {m.plate_number || 'NO PLATE'}
                                  </Text>
                                </View>

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
                        onPress={() => setIsRegisterBikeModalOpen(true)}
                        style={{
                          alignSelf: 'flex-start',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 14,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: '#CBD5E1',
                          borderStyle: 'dashed',
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="plus-lg" size={13} color="#1D4533" />
                        <Text style={{ color: '#0F172A', fontSize: 12.5, fontWeight: '700' }}>
                          Add another motorcycle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 2: SELECT SERVICE TYPE (PMS OR REPAIR)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 2 && (
                <View>
                  <View style={gStyles.stepSectionHeader}>
                    <Text style={gStyles.stepSectionTitle}>Select Service Type</Text>
                    <Text style={gStyles.stepSectionSubtitle}>
                      Choose maintenance or mechanical repair.
                    </Text>
                  </View>

                  {/* Service Cards Grid */}
                  <View style={gStyles.serviceCardGrid}>
                    {/* Card 1: Preventive Maintenance Service (PMS) */}
                    <TouchableOpacity
                      style={[
                        gStyles.serviceCard,
                        bookingType === 'PMS' && gStyles.serviceCardActivePMS,
                      ]}
                      onPress={() => handleSwitchBookingType('PMS')}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <View
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 16,
                            backgroundColor: '#E6F8F5',
                            borderWidth: 1.5,
                            borderColor: '#A7F3D0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="wrench-adjustable" size={24} color="#1D4533" />
                        </View>
                        <View
                          style={{
                            backgroundColor: bookingType === 'PMS' ? '#1D4533' : '#F1F5F9',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          {bookingType === 'PMS' && <BootstrapIcon name="check-circle-fill" size={12} color="#FFFFFF" />}
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: bookingType === 'PMS' ? '#FFFFFF' : '#64748B',
                            }}
                          >
                            {bookingType === 'PMS' ? 'Selected' : 'Select'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                        Preventive Maintenance (PMS)
                      </Text>

                      <Text style={{ fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 14 }}>
                        Routine maintenance, fresh engine oil, filter changes, and complete safety inspection.
                      </Text>

                      <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon name="check2" size={15} color="#059669" />
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Multi-Point Safety Inspection</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon name="check2" size={15} color="#059669" />
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Engine Oil & Filter Replacement</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon name="check2" size={15} color="#059669" />
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Brake System & Chain Care</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Card 2: Mechanical & Electrical Repair */}
                    <TouchableOpacity
                      style={[
                        gStyles.serviceCard,
                        bookingType === 'Repair' && gStyles.serviceCardActiveRepair,
                      ]}
                      onPress={() => handleSwitchBookingType('Repair')}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <View
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 16,
                            backgroundColor: '#FEE2E2',
                            borderWidth: 1.5,
                            borderColor: '#FECACA',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="wrench" size={24} color="#DC2626" />
                        </View>
                        <View
                          style={{
                            backgroundColor: bookingType === 'Repair' ? '#DC2626' : '#F1F5F9',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          {bookingType === 'Repair' && <BootstrapIcon name="check-circle-fill" size={12} color="#FFFFFF" />}
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: bookingType === 'Repair' ? '#FFFFFF' : '#64748B',
                            }}
                          >
                            {bookingType === 'Repair' ? 'Selected' : 'Select'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 6 }}>
                        Mechanical & Electrical Repair
                      </Text>

                      <Text style={{ fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 14 }}>
                        Diagnostics, engine repair, electrical troubleshooting, brake overhauls, and fixes.
                      </Text>

                      <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon name="check2" size={15} color="#DC2626" />
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Computer Diagnostic Scanning</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon name="check2" size={15} color="#DC2626" />
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Engine & Transmission Troubleshooting</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <BootstrapIcon name="check2" size={15} color="#DC2626" />
                          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>Brakes, Battery & Electrical Wiring</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 3: DESCRIBE PROBLEM (REQUIRED)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 3 && (
                <View>
                  <View style={gStyles.stepSectionHeader}>
                    <Text style={gStyles.stepSectionTitle}>Describe the Issue</Text>
                    <Text style={gStyles.stepSectionSubtitle}>
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
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      marginBottom: 14,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon
                        name={bookingType === 'Repair' ? 'wrench' : 'wrench-adjustable'}
                        size={15}
                        color={bookingType === 'Repair' ? '#DC2626' : '#1D4533'}
                      />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: bookingType === 'Repair' ? '#991B1B' : '#065F46' }}>
                        Service: {bookingType === 'Repair' ? 'Mechanical Repair' : 'Preventive Maintenance (PMS)'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setBookingStep(2)}
                      style={{ paddingHorizontal: 8, paddingVertical: 4, cursor: 'pointer' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: bookingType === 'Repair' ? '#DC2626' : '#1D4533' }}>
                        Change →
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Problem Description */}
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      padding: 16,
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                      What seems to be the issue? *
                    </Text>
                    <TextInput
                      style={[gStyles.modalInput, { height: 96, textAlignVertical: 'top', marginBottom: 12 }]}
                      placeholder={
                        bookingType === 'Repair'
                          ? 'Describe any symptoms, unusual noises, leaks, or warning lights...'
                          : 'Mention any specific checks, oil preferences, or services needed...'
                      }
                      multiline={true}
                      value={serviceNotes}
                      onChangeText={setServiceNotes}
                    />

                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      Special Instructions (Optional)
                    </Text>
                    <TextInput
                      style={[gStyles.modalInput, { height: 52, textAlignVertical: 'top' }]}
                      placeholder="e.g. Call before proceeding, preferred brand of fluids..."
                      multiline={true}
                      value={additionalNotes}
                      onChangeText={setAdditionalNotes}
                    />
                  </View>

                  {/* Primary Mechanical Fault Area Selector (If Repair is selected) */}
                  {bookingType === 'Repair' && (
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        padding: 16,
                        marginTop: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <BootstrapIcon name="exclamation-circle-fill" size={15} color="#DC2626" />
                        <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                          Where is the issue located? *
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                        Select the primary area to inspect first:
                      </Text>

                      <View style={gStyles.faultAreaGrid}>
                        {REPAIR_COMMON_ISSUES.map((issue) => {
                          const isPicked = selectedRepairIssue === issue.label;
                          return (
                            <TouchableOpacity
                              key={issue.id}
                              style={[
                                gStyles.faultAreaCard,
                                isPicked && gStyles.faultAreaCardActive,
                              ]}
                              onPress={() => setSelectedRepairIssue(issue.label)}
                              activeOpacity={0.8}
                            >
                              <View
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  backgroundColor: isPicked ? '#DC2626' : '#F1F5F9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <BootstrapIcon
                                  name={issue.icon || 'wrench'}
                                  size={14}
                                  color={isPicked ? '#FFFFFF' : '#64748B'}
                                />
                              </View>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: isPicked ? '800' : '600',
                                  color: isPicked ? '#991B1B' : '#334155',
                                  flex: 1,
                                }}
                                numberOfLines={1}
                              >
                                {issue.label}
                              </Text>
                              {isPicked && (
                                <BootstrapIcon name="check-circle-fill" size={14} color="#DC2626" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 4: UPLOAD PHOTOS (OPTIONAL)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 4 && (
                <View>
                  <View style={gStyles.stepSectionHeader}>
                    <Text style={gStyles.stepSectionTitle}>Add Photos or Video</Text>
                    <Text style={gStyles.stepSectionSubtitle}>
                      Photos help our mechanics diagnose faster (optional).
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      padding: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 10,
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: '#CBD5E1',
                          cursor: 'pointer',
                        }}
                        onPress={handlePickPhoto}
                        disabled={isUploadingPhoto}
                      >
                        <BootstrapIcon name="camera-fill" size={14} color="#1D4533" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>Add Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 10,
                          backgroundColor: '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: '#CBD5E1',
                          cursor: 'pointer',
                        }}
                        onPress={handlePickVideo}
                        disabled={isUploadingPhoto}
                      >
                        <BootstrapIcon name="camera-reels-fill" size={14} color="#1D4533" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>Add Video</Text>
                      </TouchableOpacity>

                      {motorcyclePhotos.map((uri, idx) => {
                        const isVideo = uri.startsWith('data:video') || uri.endsWith('.mp4') || uri.endsWith('.mov');
                        return (
                          <View key={idx} style={gStyles.photoThumbWrap}>
                            {isVideo ? (
                              <View style={[gStyles.photoThumbImg, { backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }]}>
                                <BootstrapIcon name="play-circle-fill" size={24} color="#FFFFFF" />
                                <Text style={{ fontSize: 9, color: '#94A3B8', fontWeight: '800', marginTop: 2 }}>VIDEO</Text>
                              </View>
                            ) : (
                              <Image source={{ uri }} style={gStyles.photoThumbImg} />
                            )}
                            <TouchableOpacity style={gStyles.photoRemoveBtn} onPress={() => handleRemovePhoto(idx)}>
                              <BootstrapIcon name="x" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 10 }}>
                      {motorcyclePhotos.length > 0
                        ? `${motorcyclePhotos.length} file${motorcyclePhotos.length === 1 ? '' : 's'} attached.`
                        : 'Optional — you can skip this step.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 5: PREFERRED DATE & TIME + REVIEW
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 5 && (
                <View>
                  <View style={gStyles.stepSectionHeader}>
                    <Text style={gStyles.stepSectionTitle}>Preferred Date & Time</Text>
                    <Text style={gStyles.stepSectionSubtitle}>
                      Pick when you'd like to drop off your motorcycle.
                    </Text>
                  </View>

                  {/* Schedule & Availability Status Card */}
                  {(() => {
                    const avail = garageService.getDaySlotAvailability(selectedDate);
                    const isFull = avail?.isFullyBooked;
                    const dateObj = new Date(selectedDate + 'T00:00:00');
                    const isSunday = dateObj.getDay() === 0;

                    return (
                      <View
                        style={{
                          backgroundColor: isFull ? '#FFF1F2' : isSunday ? '#FFFBEB' : '#F0FDFA',
                          borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: isFull ? '#FECACA' : isSunday ? '#FDE68A' : '#99F6E4',
                          padding: 14,
                          marginBottom: 14,
                          flexDirection: isDesktop ? 'row' : 'column',
                          alignItems: isDesktop ? 'center' : 'stretch',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              backgroundColor: isFull ? '#DC2626' : isSunday ? '#D97706' : '#1D4533',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <BootstrapIcon
                              name={isFull ? 'slash-circle-fill' : isSunday ? 'cup-hot-fill' : 'calendar-check-fill'}
                              size={18}
                              color="#FFFFFF"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 14.5, fontWeight: '900', color: '#0F172A' }}>
                                {(() => {
                                  try {
                                    const [y, m, d] = selectedDate.split('-').map(Number);
                                    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    });
                                  } catch {
                                    return selectedDate;
                                  }
                                })()}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: isFull ? '#FEE2E2' : isSunday ? '#FEF3C7' : '#C8DDD3',
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: '800',
                                    color: isFull ? '#DC2626' : isSunday ? '#B45309' : '#1D4533',
                                  }}
                                >
                                  {isFull ? 'HIGH DEMAND' : isSunday ? 'SUNDAY' : `${avail?.availableSlotsCount ?? 6} Bays Available`}
                                </Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 12, color: '#475569' }}>
                                📍 {flagshipBranch.name}
                              </Text>
                              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <BootstrapIcon name="clock-fill" size={11} color="#1D4533" />
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533' }}>
                                  {selectedTime || 'Select Time Slot'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Integrated Interactive Booking Calendar */}
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <BookingCalendar
                      selectedDate={selectedDate}
                      onSelectDate={(newDate) => handleSelectDate(newDate)}
                      selectedTime={selectedTime}
                      onSelectTime={(newTime) => setSelectedTime(newTime)}
                      getTimeSlots={(dateStr) => {
                        const selAvail = garageService.getDaySlotAvailability(dateStr);
                        return selAvail?.slots || [];
                      }}
                      onFullyBookedSelected={(dateStr) => {
                        showToast(`⚠️ ${dateStr} is busy. You can still request it — admin will confirm.`);
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
                      statusBarText="Shop hours: Monday – Saturday, 9:00 AM – 6:00 PM"
                      offDutyCount={1}
                    />
                  </View>

                  {/* Request Review Summary Card */}
                  <View
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      padding: 16,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                      Request Summary
                    </Text>

                    <View style={{ gap: 7, marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#64748B' }}>📅 Preferred Date:</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                          {selectedDate} • {selectedTime}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#64748B' }}>🔧 Service:</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#1D4533' }}>
                          {SERVICE_TYPE_LABELS[bookingType] || SERVICE_TYPE_LABELS.PMS}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#64748B' }}>🛵 Motorcycle:</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                          {bikeBrand} {bikeModel} {bikeYear ? `(${bikeYear})` : ''}
                        </Text>
                      </View>
                      {serviceNotes.trim() ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
                          <Text style={{ fontSize: 12.5, color: '#64748B' }}>📝 Details:</Text>
                          <Text
                            style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'right' }}
                            numberOfLines={2}
                          >
                            {serviceNotes.trim()}
                          </Text>
                        </View>
                      ) : null}
                      {motorcyclePhotos.length > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12.5, color: '#64748B' }}>📎 Photos:</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1D4533' }}>
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
                      <Text style={{ fontSize: 12.5, color: '#134E4A', flex: 1, fontWeight: '600', lineHeight: 17 }}>
                        No payment needed now. You'll receive an itemized quotation to review and approve before any work starts.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Sticky Stepper Footer */}
            {(() => {
              return (
                <View style={gStyles.stepperFooter}>
                  {/* Left: Back / Cancel Button */}
                  <TouchableOpacity
                    style={gStyles.stepBackBtn}
                    onPress={handlePrevStep}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name={bookingStep > 1 ? 'arrow-left' : 'x'} size={14} color="#475569" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                      {bookingStep > 1 ? 'Back' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>

                  {/* Middle: Step Status Pill */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text
                      style={{ fontSize: 12, fontWeight: '700', color: '#64748B', textAlign: 'center' }}
                      numberOfLines={1}
                    >
                      Step {bookingStep}/5 • {BOOKING_STEPS[bookingStep - 1]?.label}
                    </Text>
                  </View>

                  {/* Right: Next Step / Confirm Button */}
                  <TouchableOpacity
                    style={[
                      gStyles.stepNextBtn,
                      bookingType === 'Repair' && { backgroundColor: '#DC2626', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)' },
                    ]}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                  >
                    <Text style={gStyles.stepNextBtnText}>
                      {bookingStep === 1
                        ? 'Next: Service Type →'
                        : bookingStep === 2
                          ? 'Next: Describe Problem →'
                          : bookingStep === 3
                            ? 'Next: Upload Photos →'
                            : bookingStep === 4
                              ? 'Next: Preferred Date & Time →'
                              : 'Submit Service Request (Pending Review)'}
                    </Text>
                    {bookingStep < 5 && <BootstrapIcon name="arrow-right-short" size={18} color="#FFFFFF" />}
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

      {/* Register Motorcycle Modal (from booking Step 1) */}
      <RegisterMotorcycleModal
        visible={isRegisterBikeModalOpen}
        onClose={() => setIsRegisterBikeModalOpen(false)}
        onSave={handleSaveRegisteredMotorcycle}
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
                <BootstrapIcon name="tools" size={20} color="#1D4533" />
                <View>
                  <Text style={gStyles.rosterModalTitle}>Certified Pit Crew & Mechanics</Text>
                  <Text style={gStyles.rosterModalSub}>
                    MotoTrack Flagship Central Hub • {mechanicsData.availableCount} of{' '}
                    {mechanicsData.totalCount} Technicians Available Today
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
              {mechanicsData.mechanics.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    No certified mechanics currently registered.
                  </Text>
                </View>
              ) : (
                mechanicsData.mechanics.map((mech) => (
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
                          backgroundColor: mech.isAvailable
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
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
                        style={[gStyles.rosterStatusText, { color: mech.isAvailable ? '#10B981' : '#EF4444' }]}
                      >
                        {mech.status}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: '#1E293B',
                flexDirection: 'row',
                justifyContent: 'flex-end',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#1D4533',
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
        title={isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0) ? 'Cancel Service Request?' : 'Cancel Pit Bay Appointment?'}
        message={
          isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0)
            ? `Cancel service request #${bookingToCancel?.id}? No payment has been made, so nothing will be charged.`
            : `⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour advance downpayment of ₱${(bookingToCancel?.amount_paid || bookingToCancel?.downpayment_amount || Math.round((bookingToCancel?.pricePhp || 2500) * 0.2)).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover reserved technician allocation and bay scheduling. Are you sure you wish to cancel?`
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

      <CartModal
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          if (!currentUser) {
            setIsCartOpen(false);
            setRedirectReason('Please sign in to complete your checkout.');
            onNavigateToLogin?.();
            return;
          }
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        visible={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onCompleteOrder={() => {
          setIsCheckoutOpen(false);
          showToast('Order placed successfully!');
          onNavigateToOrders?.();
        }}
        onOpenProfile={() => {
          setIsCheckoutOpen(false);
          onNavigateToProfile?.('profile');
        }}
      />

      {/* ─── BOOKING DETAILS & QUOTATION MODAL ─── */}
      <Modal
        visible={!!activeModalBooking}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedBookingForModal(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              width: '100%',
              maxWidth: 780,
              maxHeight: '90%',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 28,
              elevation: 12,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: '#ECFDF5',
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="file-earmark-text" size={20} color="#059669" />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
                    Booking Details & Quotation
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                    REF: {activeModalBooking?.booking_id || activeModalBooking?.id}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedBookingForModal(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Scrollable Body */}
            <ScrollView
              style={{ flex: 1, backgroundColor: '#F8FAFC' }}
              contentContainerStyle={{ padding: 22, paddingBottom: 28 }}
              showsVerticalScrollIndicator={true}
            >
              {activeModalBooking ? (
                <CustomerServiceBookingCard
                  booking={activeModalBooking}
                  onToast={showToast}
                  onUpdated={() => refreshBookings()}
                  defaultExpanded={true}
                  isModalView={true}
                  canCancel={[
                    'PENDING_REVIEW',
                    'APPROVED',
                    'SCHEDULED',
                    'AWAITING_CUSTOMER_APPROVAL',
                    'QUOTATION_SENT',
                    'AWAITING_DOWNPAYMENT',
                  ].includes(normalizeBookingStatus(activeModalBooking?.status))}
                  onCancel={() => {
                    const b = activeModalBooking;
                    setSelectedBookingForModal(null);
                    handlePromptCancelBooking(b);
                  }}
                  style={{
                    borderWidth: 0,
                    shadowOpacity: 0,
                    elevation: 0,
                    padding: 0,
                    backgroundColor: 'transparent',
                    marginBottom: 0,
                  }}
                />
              ) : null}
            </ScrollView>

            {/* Modal Footer */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: '#E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <TouchableOpacity
                onPress={() => setSelectedBookingForModal(null)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: '#F1F5F9',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>Close Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
