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
import { garageStyles as styles } from '../../../styles/garagePage.styles.js';
import {
  garageService,
  generateBookingId,
  GARAGE_BRANCHES,
  TIME_SLOTS,
  REPAIR_COMMON_ISSUES,
} from '../../../services/bookings/garageService.js';
import { pmsPricingService } from '../../../services/bookings/pmsPricingService.js';
import {
  formatPhp,
  UNSUPPORTED_CC_MESSAGE,
  filterServicesByCatalogCategory,
  groupPmsCatalog,
  groupPmsCatalogByPrimarySection,
} from '../../../utils/pmsCcPricing.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { isFlexibleBooking, normalizeBookingStatus } from '../../../utils/serviceQuotation.js';
import {
  BootstrapIcon,
  BottomNavBar,
  BrandLogo,
  BookingSelect,
  BookingCalendar,
  SegmentedToggle,
  CustomerServiceBookingCard,
  ServiceCategoryIcon,
} from '../../../components/common';
import { ConfirmModal, RegisterMotorcycleModal } from '../../../components/modals';
import { pickImageFromFile, pickVideoFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { authService } from '../../../services/auth/authService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { userService } from '../../../services/staff/userService.js';

const ESTIMATE_DISCLAIMER_TEXT =
  pmsPricingService.ESTIMATE_DISCLAIMER || 'Estimated labor only. Final price may change after inspection.';

const MAX_SERVICE_TITLE_LENGTH = 160;

const reviewSectionTitleStyle = {
  fontSize: 12,
  fontWeight: '800',
  color: '#EA580C',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
};

function ReviewRow({ label, value, multiline = false }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text style={{ fontSize: 12.5, color: '#64748B' }}>{label}</Text>
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'right' }}
        numberOfLines={multiline ? 4 : 2}
      >
        {value}
      </Text>
    </View>
  );
}

function buildServiceTitle(lineItems = []) {
  const title = lineItems
    .map((i) => i.serviceName)
    .filter(Boolean)
    .join(', ');
  if (title.length <= MAX_SERVICE_TITLE_LENGTH) return title;
  const shown = [];
  let len = 0;
  for (const item of lineItems) {
    const name = item.serviceName || '';
    if (len + name.length + 2 > MAX_SERVICE_TITLE_LENGTH - 16) break;
    shown.push(name);
    len += name.length + 2;
  }
  const rest = lineItems.length - shown.length;
  return shown.length ? `${shown.join(', ')} +${rest} more` : `${lineItems.length} services`;
}

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
  const { isDarkMode = false } = useTheme?.() || {};

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

  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Services') {
      setActiveFilter('Services');
    } else if (tab === 'Garage') {
      onNavigateToProfile?.('garage');
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
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeYear, setBikeYear] = useState('');
  const [bikeOdo, setBikeOdo] = useState('');
  const [brandSettings, setBrandSettings] = useState(() => systemSettingsService.getSettings());
  const flagshipBranch = useMemo(() => {
    const s = brandSettings || {};
    const defaultBranch = GARAGE_BRANCHES[0] || {};
    return {
      name: s.hubName || s.storeName || defaultBranch.name || "D'Blockchain Motorparts and Accessories",
      address:
        s.storeAddress ||
        defaultBranch.address ||
        'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
      phone: s.contactPhone || defaultBranch.phone || '(+63) 917 882 9102',
      bays: `${s.serviceBayCount || 6} Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay`,
      hours: `${s.operatingDays || 'Mon - Sun'}: ${s.garageOpeningTime || s.openTime || '8:00 AM'} - ${s.garageClosingTime || s.closeTime || '7:00 PM'}`,
    };
  }, [brandSettings]);
  const [selectedBranch, setSelectedBranch] = useState(flagshipBranch.name);
  const [garageMotorcycles, setGarageMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState('');

  // Fixed-rate service catalog (CC-based, grouped). Re-derived whenever the selected motorcycle changes.
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  /** Selected service type: 'PMS' | 'Repair' */
  const [selectedServiceType, setSelectedServiceType] = useState('PMS');
  const [pmsCatalogReloadKey, setPmsCatalogReloadKey] = useState(0);
  const [pmsCatalog, setPmsCatalog] = useState({
    loading: false,
    ok: false,
    engineCc: null,
    category: null,
    services: [],
    groups: [],
    message: null,
    loadError: false,
  });

  const selectedMotorcycle = useMemo(
    () =>
      (garageMotorcycles || []).find(
        (m) => String(m.motorcycle_id || m.id) === String(selectedMotorcycleId)
      ) || null,
    [garageMotorcycles, selectedMotorcycleId]
  );
  const selectedMotorcycleCc = selectedMotorcycle?.engine_cc ?? null;

  useEffect(() => {
    if (!isBookingModalOpen) return undefined;
    if (!selectedMotorcycle) {
      setPmsCatalog({
        loading: false,
        ok: false,
        engineCc: null,
        category: null,
        services: [],
        groups: [],
        message: null,
        loadError: false,
      });
      setSelectedServiceIds([]);
      return undefined;
    }
    let cancelled = false;
    setPmsCatalog((prev) => ({ ...prev, loading: true }));
    pmsPricingService
      .getCatalogForMotorcycle(selectedMotorcycleCc)
      .then((result) => {
        if (cancelled) return;
        const services = Array.isArray(result?.services) ? result.services : [];
        setPmsCatalog({
          loading: false,
          ok: !!result?.ok,
          engineCc: result?.engineCc ?? null,
          category: result?.category || null,
          services,
          groups: Array.isArray(result?.groups) ? result.groups : [],
          message: result?.message || null,
          loadError: false,
        });
        // Drop previously selected services that are not available for this CC category.
        setSelectedServiceIds((prevIds) => {
          if (!prevIds.length) return prevIds;
          if (!result?.ok) return [];
          const availableIds = new Set(services.filter((s) => s.available).map((s) => s.id));
          const next = prevIds.filter((id) => availableIds.has(id));
          return next.length === prevIds.length ? prevIds : next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPmsCatalog({
          loading: false,
          ok: false,
          engineCc: null,
          category: null,
          services: [],
          groups: [],
          message: 'Could not load services and rates. Please try again.',
          loadError: true,
        });
        setSelectedServiceIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isBookingModalOpen, selectedMotorcycle?.motorcycle_id, selectedMotorcycleCc, pmsCatalogReloadKey]);

  const selectedServiceIdSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);

  // Selected catalog rows (in selection order, available only) + live labor estimate.
  const selectedServices = useMemo(() => {
    if (!pmsCatalog.ok) return [];
    const byId = new Map((pmsCatalog.services || []).map((s) => [s.id, s]));
    return selectedServiceIds.map((id) => byId.get(id)).filter((s) => s && s.available);
  }, [pmsCatalog, selectedServiceIds]);

  const estimatedLaborTotal = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0),
    [selectedServices]
  );

  const serviceCounts = useMemo(() => {
    const all = pmsCatalog.services || [];
    const pms = all.filter((s) => (s.catalogCategory || '').toUpperCase() === 'PMS');
    const repair = all.filter((s) => (s.catalogCategory || '').toUpperCase() === 'REPAIR');
    return {
      all: all.length,
      pms: pms.length,
      repair: repair.length,
    };
  }, [pmsCatalog.services]);

  // Primary sections: Preventive Maintenance (PMS) & Repair Services, grouped by subsystem
  const filteredPrimarySections = useMemo(() => {
    const allServices = pmsCatalog.services || [];
    const q = serviceSearch.trim().toLowerCase();
    const effectiveCategory = (selectedServiceType || 'all').toLowerCase();
    const sections = groupPmsCatalogByPrimarySection(allServices, effectiveCategory);

    if (!q) {
      return sections
        .map((sec) => ({
          ...sec,
          groups: sec.groups.filter((g) => (g.services || []).length > 0),
        }))
        .filter((sec) => sec.groups.length > 0);
    }

    return sections
      .map((sec) => {
        const filteredGroups = sec.groups
          .map((g) => {
            const groupMatch = String(g.name || '')
              .toLowerCase()
              .includes(q);
            return {
              ...g,
              services: groupMatch
                ? g.services
                : g.services.filter(
                    (s) =>
                      String(s.name || '')
                        .toLowerCase()
                        .includes(q) ||
                      String(s.description || '')
                        .toLowerCase()
                        .includes(q) ||
                      String(s.catalogCategory || '')
                        .toLowerCase()
                        .includes(q)
                  ),
            };
          })
          .filter((g) => g.services.length > 0);

        return {
          ...sec,
          groups: filteredGroups,
        };
      })
      .filter((sec) => sec.groups.length > 0);
  }, [pmsCatalog, serviceSearch, selectedServiceType]);

  // Flat groups list fallback for compatibility
  const filteredServiceGroups = useMemo(() => {
    return filteredPrimarySections.flatMap((sec) => sec.groups);
  }, [filteredPrimarySections]);

  const selectedMotorcycleLabel = selectedMotorcycle
    ? `${selectedMotorcycle.year ? `${selectedMotorcycle.year} ` : ''}${selectedMotorcycle.brand || ''} ${selectedMotorcycle.model || ''}`.trim()
    : '';
  const selectedEngineCcLabel =
    pmsCatalog.engineCc || selectedMotorcycle?.engine_cc
      ? `${pmsCatalog.engineCc || selectedMotorcycle?.engine_cc} cc`
      : 'Not set';

  // Switch service type: clear previously picked services to prevent cross-category contamination
  const handleSelectServiceType = (type) => {
    if (selectedServiceType !== type) {
      setSelectedServiceType(type);
      setSelectedServiceIds([]);
    }
  };

  // Multi-select toggle: unique ids only, unavailable services can never be added.
  const handleToggleService = (svc) => {
    if (!svc?.id || !svc.available) return;
    setSelectedServiceIds((prev) =>
      prev.includes(svc.id) ? prev.filter((id) => id !== svc.id) : [...new Set([...prev, svc.id])]
    );
  };

  // Optional helper chips: append a common issue to the problem description.
  const handleAppendCommonIssue = (label) => {
    setServiceNotes((prev) => {
      const current = String(prev || '');
      if (current.toLowerCase().includes(String(label).toLowerCase())) return current;
      return current.trim() ? `${current.trim()}\n${label}` : label;
    });
  };

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
    return (
      u?.name ||
      u?.fullName ||
      u?.user_metadata?.full_name ||
      u?.user_metadata?.name ||
      ''
    );
  });
  const [ownerPhone, setOwnerPhone] = useState(() => {
    const u = currentUser || authService.getCurrentUser();
    return (
      u?.phone ||
      u?.phoneNumber ||
      u?.contactNumber ||
      u?.contact_number ||
      u?.user_metadata?.phone ||
      ''
    );
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

      setOwnerName(fetchedName);
      setOwnerPhone(fetchedPhone);
      if (!silent) {
        if (!fetchedName && !fetchedPhone) {
          showToast('Add your name and phone in profile before booking.');
        } else {
          showToast(`Customer info loaded${fetchedName ? `: ${fetchedName}` : ''}${fetchedPhone ? ` (${fetchedPhone})` : ''}`);
        }
      }
    } catch (_e) {
      if (!silent) {
        showToast('Could not load your profile. Enter your name and phone to continue.');
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

  const BOOKING_STEPS = [
    { id: 1, label: 'Motorcycle', shortLabel: 'Motorcycle', icon: 'bicycle' },
    { id: 2, label: 'Service Type', shortLabel: 'Type', icon: 'sliders' },
    { id: 3, label: 'Services', shortLabel: 'Services', icon: 'tools' },
    { id: 4, label: 'Schedule', shortLabel: 'Schedule', icon: 'calendar-event' },
    { id: 5, label: 'Review & Submit', shortLabel: 'Review', icon: 'clipboard-check' },
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
      if (!selectedServiceType)
        return { valid: false, message: 'Please select a service type (PMS or Repair).' };
      return { valid: true };
    }
    if (step === 3) {
      if (pmsCatalog.loading)
        return {
          valid: false,
          message: 'Loading services and rates for your motorcycle. Please wait a moment.',
        };
      if (!pmsCatalog.ok) return { valid: false, message: pmsCatalog.message || UNSUPPORTED_CC_MESSAGE };
      if (selectedServices.length === 0)
        return { valid: false, message: 'Please select at least one service.' };
      return { valid: true };
    }
    if (step === 4) {
      if (!bookingDate) return { valid: false, message: 'Please select your preferred date.' };
      if (!selectedTimeSlot) return { valid: false, message: 'Please select your preferred time.' };
      const availability = garageService.getDaySlotAvailability(bookingDate);
      if (availability?.isFullyBooked) {
        return { valid: false, message: 'That date is fully booked. Please choose another slot.' };
      }
      const slotTaken = (availability?.slots || []).some(
        (s) => s.isBooked && String(s.timeSlot) === String(selectedTimeSlot)
      );
      if (slotTaken) {
        return { valid: false, message: 'That time slot is already booked. Please pick another.' };
      }
      // Photos and additional notes are optional.
      return { valid: true };
    }
    return { valid: true };
  };

  const handleNextStep = () => {
    if (isSubmittingBooking) return;
    const validation = getStepValidation(bookingStep);
    if (!validation.valid) {
      if (showToast) showToast(`⚠️ ${validation.message}`);
      return;
    }
    if (bookingStep < BOOKING_STEPS.length) {
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
  const handleOpenBooking = (serviceType = 'PMS') => {
    setSelectedServiceIds([]);
    setServiceSearch('');
    setSelectedServiceType(serviceType === 'Repair' ? 'Repair' : 'PMS');
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
      if (showToast)
        showToast(`❌ Cannot book: ${bookingDate} is fully booked. Please select an available date.`);
      return;
    }
    setBookingStep(1);
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
    const unsubSettings = systemSettingsService.subscribe((updated) => {
      setBrandSettings({ ...updated });
      refreshAvailability();
    });
    if (currentUser) {
      setOwnerName(currentUser.fullName || currentUser.name || '');
      setOwnerPhone(currentUser.phone || '+63 917 882 9102');
    }
    return () => {
      unsubscribe();
      unsubBookings();
      unsubSettings?.();
    };
  }, [currentUser]);

  // Quick book from hero CTA
  const handleQuickBook = (_type, forceTomorrow = false) => {
    if (forceTomorrow || todaySlotsData.isFullyBooked) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = tomorrow.toISOString().split('T')[0];
      setBookingDate(tomStr);
      showToast('📅 Pit bays fully booked today. Selecting tomorrow for your appointment.');
    }
    const resolvedType = String(_type || '')
      .toLowerCase()
      .includes('repair')
      ? 'Repair'
      : 'PMS';
    handleOpenBooking(resolvedType);
  };

  // Submit catalog booking — multi-service, fixed labor rates re-quoted server-side. Lands as Pending Review.
  const handleConfirmBooking = async () => {
    if (isSubmittingBooking) return;
    if (!selectedMotorcycleId) {
      showToast('⚠️ Please select a registered motorcycle to continue.');
      setBookingStep(1);
      return;
    }
    const selectedBike = garageMotorcycles.find(
      (m) => String(m.motorcycle_id) === String(selectedMotorcycleId)
    );
    if (!selectedBike) {
      showToast('⚠️ Please select a registered motorcycle to continue.');
      setBookingStep(1);
      return;
    }
    if (!selectedServiceIds.length) {
      showToast('⚠️ Please select at least one service.');
      setBookingStep(3);
      return;
    }
    if (!bookingDate || !selectedTimeSlot) {
      showToast('⚠️ Please choose your preferred date and time.');
      setBookingStep(4);
      return;
    }

    setIsSubmittingBooking(true);
    try {
      // Never trust UI prices — re-quote from the motorcycle CC + selected service ids.
      let quote;
      try {
        quote = await pmsPricingService.quoteBookingServices({
          engineCc: selectedBike.engine_cc,
          serviceIds: [...new Set(selectedServiceIds)],
        });
      } catch (_e) {
        quote = { ok: false, error: 'Could not verify the service rates. Please try again.' };
      }
      if (!quote?.ok) {
        showToast(`⚠️ ${quote?.error || UNSUPPORTED_CC_MESSAGE}`);
        setBookingStep(3);
        return;
      }

      const lineItems = quote.lineItems || [];
      const serviceIdsFromQuote = lineItems.map((i) => i.serviceId);
      const firstLine = lineItems[0] || null;
      const serviceTitle = buildServiceTitle(lineItems);
      const laborSubtotal = Number(quote.laborSubtotal || 0);
      const problemDescription = serviceNotes.trim() || serviceTitle || 'Scheduled Service';

      const serviceTypeLabel = selectedServiceType === 'Repair' ? 'Repair' : 'PMS';
      const bookingId = generateBookingId(serviceTypeLabel, userBookings || []);

      const pricingFields = {
        booking_mode: 'pms_fixed',
        flexible: false,
        skip_downpayment: false,
        // Downpayment amounts/status are computed by garageService.createBooking from system settings.
        downpayment_paid: false,
        downpayment_status: 'Required',
        is_estimate_only: true,
        service_ids: serviceIdsFromQuote,
        selected_service_ids: serviceIdsFromQuote,
        service_line_items: lineItems,
        labor_subtotal: laborSubtotal,
        parts_estimate: Number(quote.partsEstimate || 0),
        estimated_total: laborSubtotal,
        quoted_service_rate: laborSubtotal,
        // Legacy single-service compatibility (first selected service)
        service_id: firstLine?.serviceId || null,
        package_id: firstLine?.serviceId || null,
        pms_service_id: firstLine?.serviceId || null,
        package_name: serviceTitle,
        service_title: serviceTitle,
        included_services: [],
        motorcycle_cc: quote.engineCc,
        engine_cc: quote.engineCc,
        cc_category_id: quote.category.id,
        cc_category_name: quote.category.name,
        package_price: laborSubtotal,
        pricePhp: laborSubtotal,
        estimated_service_total: laborSubtotal,
      };

      const bookingDraft = {
        id: bookingId,
        booking_id: bookingId,
        ...pricingFields,
        category: serviceTypeLabel,
        service_type: serviceTypeLabel,
        booking_type: serviceTypeLabel,
        service_category: serviceTypeLabel,
        problem_description: problemDescription,
        motorcycle_id: selectedMotorcycleId,
        bike_brand: selectedBike?.brand || bikeBrand,
        bike_model: selectedBike?.model || bikeModel,
        bike_year: selectedBike?.year ? String(selectedBike.year) : bikeYear,
        year: selectedBike?.year ? String(selectedBike.year) : bikeYear,
        plate_number: selectedBike?.plate_number || bikePlate.trim() || 'Pending Registration',
        odometer: selectedBike?.odometer || bikeOdo.trim() || 'New Unit',
        color: selectedBike?.color || selectedBike?.bike_color || '',
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
      setBookingStep(1);
      setMotorcyclePhotos([]);
      setServiceNotes('');
      setAdditionalNotes('');
      setSelectedServiceIds([]);
      setServiceSearch('');
      setSelectedServiceType('PMS');
      setActiveFilter('MyBookings');
      const dueLabel = newBooking?.payment_deadline
        ? new Date(newBooking.payment_deadline).toLocaleString()
        : null;
      const rateLabel = ` (${lineItems.length} service${lineItems.length === 1 ? '' : 's'} — ${formatPhp(laborSubtotal)})`;
      showToast(
        dueLabel
          ? `Booking #${newBooking?.booking_id || bookingId}${rateLabel} submitted. Pay the downpayment by ${dueLabel} or it will be cancelled automatically.`
          : `Booking Submitted Successfully. #${newBooking?.booking_id || bookingId}${rateLabel} is waiting for admin review.`
      );
    } catch (err) {
      console.error('Booking confirmation failed:', err);
      showToast(`⚠️ ${err?.message || 'Could not submit booking request. Please try again.'}`);
    } finally {
      setIsSubmittingBooking(false);
    }
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
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#24272B' }]}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ─── 1. NATIVE MOBILE APP HEADER ─── */}
      <View style={[styles.appHeaderRow, isDarkMode && { backgroundColor: '#24272B' }]}>
        <Text style={styles.appHeaderTitle}>Book a service now</Text>
      </View>

      <ScrollView
        style={[styles.container, isDarkMode && { backgroundColor: '#121518' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── 4 PITSTOP GARAGE KPI METRICS (MATCHING ORDER PAGE DESIGN) ─── */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Metric 1: On-Duty Technicians (Top Left - Dark Card) */}
            <TouchableOpacity
              style={{
                width: '48%',
                backgroundColor: '#1E2430',
                borderRadius: 18,
                padding: 14,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 3,
              }}
              onPress={() => setIsRosterModalOpen(true)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#EA580C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="person-badge" size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      lineHeight: 13,
                      letterSpacing: 0.3,
                    }}
                  >
                    CERTIFIED TECHS{'\n'}ON-DUTY
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: '800',
                  color: '#FFFFFF',
                  marginTop: 12,
                  marginBottom: 2,
                  letterSpacing: -0.5,
                }}
              >
                {mechanicsData.availableCount}/{mechanicsData.totalCount}
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '500',
                  color: '#94A3B8',
                }}
                numberOfLines={1}
              >
                Active master mechanics
              </Text>
            </TouchableOpacity>

            {/* Metric 2: Available Slots (Top Right - Reactive Card) */}
            <View
              style={{
                width: '48%',
                backgroundColor: isDarkMode ? '#1E2430' : '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                borderWidth: 1,
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#EA580C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="clock-history" size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: isDarkMode ? '#F8FAFC' : '#1E293B',
                      textTransform: 'uppercase',
                      lineHeight: 13,
                      letterSpacing: 0.3,
                    }}
                  >
                    SLOTS LEFT{'\n'}TODAY
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '800',
                  color: todaySlotsData.isFullyBooked ? '#DC2626' : (isDarkMode ? '#FFFFFF' : '#0F172A'),
                  marginTop: 12,
                  marginBottom: 2,
                  letterSpacing: -0.5,
                }}
              >
                {todaySlotsData.isFullyBooked ? 'Full' : todaySlotsData.availableSlotsCount}
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '500',
                  color: isDarkMode ? '#94A3B8' : '#64748B',
                }}
                numberOfLines={1}
              >
                {todaySlotsData.isFullyBooked ? 'Book ahead for tomorrow' : 'Instant bay reservation'}
              </Text>
            </View>

            {/* Metric 3: Next Opening (Bottom Left - Reactive Card) */}
            <View
              style={{
                width: '48%',
                backgroundColor: isDarkMode ? '#1E2430' : '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                borderWidth: 1,
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#EA580C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar2-check" size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: isDarkMode ? '#F8FAFC' : '#1E293B',
                      textTransform: 'uppercase',
                      lineHeight: 13,
                      letterSpacing: 0.3,
                    }}
                  >
                    NEXT OPENING{'\n'}SCHEDULE
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '800',
                  color: isDarkMode ? '#FFFFFF' : '#0F172A',
                  marginTop: 12,
                  marginBottom: 2,
                  letterSpacing: -0.5,
                }}
              >
                {todaySlotsData.isFullyBooked ? 'Tmrw' : 'Today'}
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '500',
                  color: isDarkMode ? '#94A3B8' : '#64748B',
                }}
                numberOfLines={1}
              >
                Earliest available slot
              </Text>
            </View>

            {/* Metric 4: Active Pit Bays (Bottom Right - Dark Card) */}
            <View
              style={{
                width: '48%',
                backgroundColor: '#1E2430',
                borderRadius: 18,
                padding: 14,
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#EA580C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="tools" size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      lineHeight: 13,
                      letterSpacing: 0.3,
                    }}
                  >
                    ACTIVE SERVICE{'\n'}PIT BAYS
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '800',
                  color: Number(mechanicsData.availableCount) <= 0 ? '#EF4444' : '#FFFFFF',
                  marginTop: 12,
                  marginBottom: 2,
                  letterSpacing: -0.5,
                }}
                numberOfLines={1}
              >
                {Math.min(
                  Math.max(1, Number(brandSettings?.serviceBayCount) || mechanicsData.totalCount || 6),
                  Number(mechanicsData.availableCount) || 0
                )}{' '}
                Bays
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '500',
                  color: '#94A3B8',
                }}
                numberOfLines={1}
              >
                {Number(mechanicsData.availableCount) <= 0 ? 'All bays occupied' : 'Open for booking now'}
              </Text>
            </View>
          </View>

          {/* Notice Banner if Fully Booked Today */}
          {todaySlotsData.isFullyBooked && (
            <View style={styles.fullyBookedAlert}>
              <BootstrapIcon name="exclamation-octagon-fill" size={16} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.fullyBookedAlertTitle}>Pit bays are fully booked today</Text>
                <Text style={styles.fullyBookedAlertSub}>
                  {todaySlotsData.mechanicCount === 0
                    ? 'No mechanics are on duty today, so there are no open slots.'
                    : `All ${todaySlotsData.totalSlots} daily slots are reserved. Reserve for tomorrow to secure your slot.`}
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

          {/* ─── 4. BOOK A SERVICE PRIMARY BUTTON ─── */}
          <TouchableOpacity
            style={styles.bookServicePrimaryBtn}
            onPress={() => handleOpenBooking()}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="calendar-check-fill" size={17} color="#FFFFFF" />
            <Text style={styles.bookServicePrimaryBtnText}>Book a Service Now</Text>
            <BootstrapIcon name="arrow-right" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          {/* ─── 5. SCHEDULED APPOINTMENTS SECTION ─── */}
          <View style={styles.appointmentsSection}>
            <View style={styles.appointmentsHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="calendar-check-fill" size={17} color="#EA580C" />
                <Text style={[styles.appointmentsHeaderTitle, isDarkMode && { color: '#F9FAFB' }]}>Your Appointments</Text>
              </View>
              <View style={[styles.appointmentsCountBadge, isDarkMode && { backgroundColor: '#23272B' }]}>
                <Text style={[styles.appointmentsCountBadgeText, isDarkMode && { color: '#E2E8F0' }]}>
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
                        backgroundColor: isSel ? '#EA580C' : (isDarkMode ? '#1E2430' : '#F1F5F9'),
                        borderWidth: 1,
                        borderColor: isSel ? '#EA580C' : (isDarkMode ? '#334155' : '#E2E8F0'),
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '800',
                          color: isSel ? '#FFFFFF' : (isDarkMode ? '#E2E8F0' : '#475569'),
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
              <View style={[styles.emptyBox, isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' }]}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: isDarkMode ? '#23272B' : '#F8FAFC',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#2B3035' : '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <BootstrapIcon name="person-lock" size={24} color="#EA580C" />
                </View>
                <Text style={[styles.emptyTitle, isDarkMode && { color: '#F9FAFB' }]}>Sign In to View Appointments</Text>
                <Text style={[styles.emptySub, isDarkMode && { color: '#94A3B8' }]}>
                  Sign in to view your scheduled pit appointments, track master mechanic assignments, and bay
                  service updates.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 14,
                    backgroundColor: '#EA580C',
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
              <View style={[styles.emptyBox, isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' }]}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDarkMode ? '#23272B' : '#E6F4F1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <BootstrapIcon name="calendar3" size={22} color="#EA580C" />
                </View>
                <Text style={[styles.emptyTitle, isDarkMode && { color: '#F9FAFB' }]}>No scheduled appointments yet</Text>
                <Text style={[styles.emptySub, isDarkMode && { color: '#94A3B8' }]}>
                  Tap "Book a Service Now" above to reserve a pit bay with our master technicians.
                </Text>
              </View>
            ) : filteredBookings.length === 0 ? (
              <View style={[styles.emptyBox, { padding: 24, backgroundColor: isDarkMode ? '#1C1F23' : '#F8FAFC', borderColor: isDarkMode ? '#2B3035' : '#E2E8F0' }]}>
                <BootstrapIcon name="calendar2-x" size={28} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                <Text style={[styles.emptyTitle, { fontSize: 14, marginTop: 8 }, isDarkMode && { color: '#F9FAFB' }]}>
                  No bookings in this filter
                </Text>
                <Text style={[styles.emptySub, isDarkMode && { color: '#94A3B8' }]}>Switch to "All" to view your full booking history.</Text>
                <TouchableOpacity
                  onPress={() => {
                    setBookingStatusFilter('ALL');
                    setBookingsPage(1);
                  }}
                  style={{
                    marginTop: 10,
                    backgroundColor: '#EA580C',
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
                      <BootstrapIcon name="chevron-left" size={16} color="#EA580C" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#475569' }}>
                      Page {bookingsPage} of {bookingsTotalPages}
                    </Text>
                    <TouchableOpacity
                      disabled={bookingsPage >= bookingsTotalPages}
                      onPress={() => setBookingsPage((p) => Math.min(bookingsTotalPages, p + 1))}
                      style={{ opacity: bookingsPage >= bookingsTotalPages ? 0.4 : 1, padding: 6 }}
                    >
                      <BootstrapIcon name="chevron-right" size={16} color="#EA580C" />
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
        animationType="slide"
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
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
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
                    backgroundColor: '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar-check-fill" size={18} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        backgroundColor: '#FFF7ED',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 5,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#EA580C', letterSpacing: 0.5 }}>
                        STEP 1 OF 2
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                      Select Appointment Date & Time
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                    Pick an open date and time slot for your service
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
                  if (showToast)
                    showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! All pit bays are reserved.`);
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
                    backgroundColor: isFull ? '#FFF1F2' : '#FFF7ED',
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
                        color={isFull ? '#DC2626' : '#EA580C'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text
                          style={{ fontSize: 13, fontWeight: '800', color: isFull ? '#991B1B' : '#0F172A' }}
                        >
                          Selected: {bookingDate}
                        </Text>
                        {selectedTimeSlot && (
                          <View
                            style={{
                              backgroundColor: '#FFF7ED',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#EA580C' }}>
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
                              color: isFull ? '#DC2626' : '#EA580C',
                            }}
                          >
                            {isFull ? 'FULLY BOOKED' : `${availability?.availableSlotsCount ?? 0} Slots Open`}
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

                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}
                  >
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
                        backgroundColor: isFull ? '#CBD5E1' : '#EA580C',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: isFull ? 0.7 : 1,
                      }}
                      onPress={handleProceedToBookingForm}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={{ fontSize: 12.5, fontWeight: '800', color: isFull ? '#64748B' : '#FFFFFF' }}
                      >
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
        animationType="slide"
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
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}
                >
                  <View style={styles.stepperIconWrap}>
                    <BootstrapIcon
                      name={BOOKING_STEPS[bookingStep - 1]?.icon || 'bicycle'}
                      size={18}
                      color="#EA580C"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepperModalTitle} numberOfLines={1}>
                      Service Request
                    </Text>
                    <Text style={styles.stepperModalSubtitle} numberOfLines={1}>
                      Step {bookingStep} of {BOOKING_STEPS.length}: {BOOKING_STEPS[bookingStep - 1]?.label}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.stepperCloseBtn} onPress={() => setIsBookingModalOpen(false)}>
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
                            isActive && styles.stepCircleActive,
                            isCompleted && styles.stepCircleCompleted,
                          ]}
                        >
                          {isCompleted ? (
                            <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />
                          ) : (
                            <Text style={[styles.stepNumberText, isActive && styles.stepNumberTextActive]}>
                              {stepNum}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stepLabel,
                            isActive && styles.stepLabelActive,
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
                    <Text style={styles.stepSectionSubtitle}>Choose the motorcycle that needs service.</Text>
                  </View>

                  {garageMotorcycles.length > 0 ? (
                    <View>
                      <View style={styles.motorcycleCardGrid}>
                        {garageMotorcycles.map((m) => {
                          const isPicked = String(m.motorcycle_id) === String(selectedMotorcycleId);
                          const bikePhoto = m.photo_url || null;

                          return (
                            <TouchableOpacity
                              key={m.motorcycle_id}
                              style={[styles.motorcycleCard, isPicked && styles.motorcycleCardActive]}
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
                                  <Text
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: '800',
                                      color: '#FFFFFF',
                                      letterSpacing: 0.4,
                                    }}
                                  >
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
                                    backgroundColor: isPicked ? '#EA580C' : 'rgba(15, 23, 42, 0.55)',
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
                                  {m.year ? `${m.year} ` : ''}
                                  {m.brand} {m.model}
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
                                    backgroundColor: isPicked ? '#EA580C' : '#0F172A',
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
                          borderColor: '#EA580C',
                          backgroundColor: '#FFF7ED',
                        }}
                        onPress={() => setIsRegisterMotorcycleModalOpen(true)}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="plus-circle-fill" size={14} color="#EA580C" />
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#EA580C' }}>
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
                      <Text
                        style={{ fontSize: 14.5, fontWeight: '900', color: '#0F172A', textAlign: 'center' }}
                      >
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
                          backgroundColor: '#EA580C',
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

              {/* ════════════════════════════════════════════════════════════════
                  STEP 2: SELECT SERVICE TYPE (PMS vs REPAIR)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 2 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Select Service Type</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Choose whether you need preventive maintenance (PMS) or specific repair services for
                      your motorcycle.
                    </Text>
                  </View>

                  {/* Selected motorcycle tag */}
                  {selectedMotorcycleLabel ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#F0F7F3',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: '#C8DDD3',
                        alignSelf: 'flex-start',
                        marginBottom: 14,
                      }}
                    >
                      <BootstrapIcon name="bicycle" size={12} color="#EA580C" />
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
                        {selectedMotorcycleLabel} • {selectedEngineCcLabel}
                        {pmsCatalog.ok && pmsCatalog.category ? ` • ${pmsCatalog.category.name}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Service Type Selection Cards */}
                  <View style={{ gap: 14, marginBottom: 14 }}>
                    {/* Preventive Maintenance (PMS) Card */}
                    <TouchableOpacity
                      onPress={() => handleSelectServiceType('PMS')}
                      activeOpacity={0.9}
                      style={{
                        backgroundColor: selectedServiceType === 'PMS' ? '#F0FDF4' : '#FFFFFF',
                        borderRadius: 14,
                        borderWidth: selectedServiceType === 'PMS' ? 2 : 1.5,
                        borderColor: selectedServiceType === 'PMS' ? '#EA580C' : '#E2E8F0',
                        padding: 16,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: '#E8F5EE',
                            borderWidth: 1,
                            borderColor: '#C8DDD3',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="shield-check" size={20} color="#EA580C" />
                        </View>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: selectedServiceType === 'PMS' ? '#EA580C' : '#FFFFFF',
                            borderWidth: selectedServiceType === 'PMS' ? 0 : 2,
                            borderColor: '#CBD5E1',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {selectedServiceType === 'PMS' && (
                            <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />
                          )}
                        </View>
                      </View>

                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                            Preventive Maintenance
                          </Text>
                          <View
                            style={{
                              backgroundColor: '#E8F5EE',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 5,
                              borderWidth: 1,
                              borderColor: '#C8DDD3',
                            }}
                          >
                            <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#EA580C' }}>PMS</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 17 }}>
                          Routine maintenance, fluids, tune-ups, and inspections to keep your motorcycle in
                          peak operating condition.
                        </Text>
                      </View>

                      <View style={{ gap: 5 }}>
                        {[
                          'Regular Oil & Filter Replacement',
                          'Minor & Major Engine Tune-up',
                          'CVT Cleaning / Chain Lubrication',
                          'Brake System & Safety Check',
                        ].map((feature, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <BootstrapIcon name="check2" size={12} color="#EA580C" />
                            <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '500' }}>
                              {feature}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View
                        style={{
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: selectedServiceType === 'PMS' ? '#DCE9E2' : '#F1F5F9',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
                          {serviceCounts.pms} PMS services available
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: selectedServiceType === 'PMS' ? '#EA580C' : '#94A3B8',
                          }}
                        >
                          {selectedServiceType === 'PMS' ? 'Selected ✓' : 'Select →'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Repair Services Card */}
                    <TouchableOpacity
                      onPress={() => handleSelectServiceType('Repair')}
                      activeOpacity={0.9}
                      style={{
                        backgroundColor: selectedServiceType === 'Repair' ? '#FFFBEB' : '#FFFFFF',
                        borderRadius: 14,
                        borderWidth: selectedServiceType === 'Repair' ? 2 : 1.5,
                        borderColor: selectedServiceType === 'Repair' ? '#B45309' : '#E2E8F0',
                        padding: 16,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: '#FEF3C7',
                            borderWidth: 1,
                            borderColor: '#FDE68A',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="tools" size={18} color="#B45309" />
                        </View>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: selectedServiceType === 'Repair' ? '#B45309' : '#FFFFFF',
                            borderWidth: selectedServiceType === 'Repair' ? 0 : 2,
                            borderColor: '#CBD5E1',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {selectedServiceType === 'Repair' && (
                            <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />
                          )}
                        </View>
                      </View>

                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                            Repair Services
                          </Text>
                          <View
                            style={{
                              backgroundColor: '#FEF3C7',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 5,
                              borderWidth: 1,
                              borderColor: '#FDE68A',
                            }}
                          >
                            <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#B45309' }}>REPAIR</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 17 }}>
                          Mechanical overhauls, electrical troubleshooting, and component replacements for
                          broken or worn parts.
                        </Text>
                      </View>

                      <View style={{ gap: 5 }}>
                        {[
                          'Engine & Transmission Overhauls',
                          'Electrical Diagnosis & Wiring Repairs',
                          'Brake Caliper & Master Cylinder Fixes',
                          'Suspension, Fork Oil & Chassis Service',
                        ].map((feature, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <BootstrapIcon name="check2" size={12} color="#B45309" />
                            <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '500' }}>
                              {feature}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View
                        style={{
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: selectedServiceType === 'Repair' ? '#FDE68A' : '#F1F5F9',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#B45309' }}>
                          {serviceCounts.repair} repair services available
                        </Text>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: selectedServiceType === 'Repair' ? '#B45309' : '#94A3B8',
                          }}
                        >
                          {selectedServiceType === 'Repair' ? 'Selected ✓' : 'Select →'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Informative helper note */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#F8FAFC',
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                    }}
                  >
                    <BootstrapIcon name="info-circle" size={13} color="#64748B" />
                    <Text style={{ fontSize: 11.5, color: '#64748B', flex: 1 }}>
                      Next step displays{' '}
                      <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                        {selectedServiceType === 'Repair' ? 'Repair Services' : 'PMS Services'}
                      </Text>{' '}
                      tailored to your motorcycle's {selectedEngineCcLabel} engine.
                    </Text>
                  </View>
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 3: SELECT SERVICES (MULTI-SELECT, FILTERED BY SERVICE TYPE)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 3 && (
                <View>
                  {/* Top instruction note & selected motorcycle tag */}
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
                    <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '500' }}>
                      Choose the {selectedServiceType === 'Repair' ? 'repair' : 'preventive maintenance'}{' '}
                      services you need. Prices shown are labor/service fees.
                    </Text>
                    {selectedMotorcycleLabel ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          backgroundColor: '#F0F7F3',
                          paddingHorizontal: 9,
                          paddingVertical: 3.5,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: '#C8DDD3',
                        }}
                      >
                        <BootstrapIcon name="bicycle" size={11} color="#EA580C" />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C' }}>
                          {selectedMotorcycleLabel} • {selectedEngineCcLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {pmsCatalog.loading ? (
                    <View
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: '#E2E8F0',
                        padding: 20,
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <BootstrapIcon name="arrow-repeat" size={18} color="#EA580C" />
                      <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '600' }}>
                        Loading services and rates for your motorcycle...
                      </Text>
                    </View>
                  ) : !pmsCatalog.ok ? (
                    <View
                      style={{
                        backgroundColor: '#FEF2F2',
                        borderColor: '#FECACA',
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 12,
                        flexDirection: 'row',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <BootstrapIcon name="exclamation-triangle-fill" size={15} color="#DC2626" />
                      <View style={{ flex: 1, gap: 8 }}>
                        <Text style={{ fontSize: 12.5, color: '#991B1B', fontWeight: '700', lineHeight: 18 }}>
                          {pmsCatalog.message || UNSUPPORTED_CC_MESSAGE}
                        </Text>
                        {pmsCatalog.loadError ? (
                          <TouchableOpacity
                            onPress={() => setPmsCatalogReloadKey((k) => k + 1)}
                            style={{
                              alignSelf: 'flex-start',
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#FECACA',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>
                              Try again
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <View>
                      {/* Compact Quick Search */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1.5,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          marginBottom: 14,
                        }}
                      >
                        <BootstrapIcon name="search" size={13} color="#94A3B8" />
                        <TextInput
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            fontSize: 12.5,
                            color: '#0F172A',
                          }}
                          placeholder="Search services (e.g. overhaul, brake, chain)..."
                          placeholderTextColor="#94A3B8"
                          value={serviceSearch}
                          onChangeText={setServiceSearch}
                        />
                        {serviceSearch ? (
                          <TouchableOpacity
                            onPress={() => setServiceSearch('')}
                            style={{ cursor: 'pointer' }}
                          >
                            <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {filteredPrimarySections.length === 0 ? (
                        <View
                          style={{
                            backgroundColor: '#F8FAFC',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: '#E2E8F0',
                            padding: 20,
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12.5,
                              color: '#64748B',
                              fontWeight: '600',
                              textAlign: 'center',
                            }}
                          >
                            {serviceSearch.trim()
                              ? `No services match "${serviceSearch.trim()}".`
                              : 'No services are available for your motorcycle right now.'}
                          </Text>
                          {serviceSearch ? (
                            <TouchableOpacity
                              onPress={() => setServiceSearch('')}
                              style={{
                                marginTop: 8,
                                backgroundColor: '#FFFFFF',
                                borderWidth: 1,
                                borderColor: '#CBD5E1',
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
                                Clear search
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : (
                        <View style={{ gap: 18 }}>
                          {filteredPrimarySections.map((section) => (
                            <View key={section.key} style={{ gap: 16 }}>
                              {section.groups.map((group) => {
                                return (
                                  <View key={group.name} style={{ gap: 10 }}>
                                    {/* Subsystem Category Header with icon & count */}
                                    <View
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        paddingBottom: 6,
                                        borderBottomWidth: 1.5,
                                        borderBottomColor: '#F1F5F9',
                                        paddingHorizontal: 2,
                                      }}
                                    >
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                        <View
                                          style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 7,
                                            backgroundColor: '#F0F7F3',
                                            borderWidth: 1,
                                            borderColor: '#C8DDD3',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          <ServiceCategoryIcon
                                            category={group.name}
                                            size={13}
                                            color="#EA580C"
                                          />
                                        </View>
                                        <Text
                                          style={{
                                            fontSize: 12,
                                            fontWeight: '900',
                                            color: '#EA580C',
                                            letterSpacing: 0.6,
                                            textTransform: 'uppercase',
                                          }}
                                        >
                                          {group.name}
                                        </Text>
                                      </View>

                                      <View
                                        style={{
                                          backgroundColor: '#F1F5F9',
                                          paddingHorizontal: 7,
                                          paddingVertical: 2,
                                          borderRadius: 5,
                                        }}
                                      >
                                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B' }}>
                                          {group.services.length}{' '}
                                          {group.services.length === 1 ? 'service' : 'services'}
                                        </Text>
                                      </View>
                                    </View>

                                    {/* Service Cards List */}
                                    <View style={{ gap: 10 }}>
                                      {group.services.map((svc) => {
                                        const isPicked = svc.available && selectedServiceIdSet.has(svc.id);
                                        return (
                                          <TouchableOpacity
                                            key={svc.id}
                                            disabled={!svc.available}
                                            onPress={() => handleToggleService(svc)}
                                            activeOpacity={0.8}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{
                                              checked: isPicked,
                                              disabled: !svc.available,
                                            }}
                                            style={{
                                              backgroundColor: isPicked
                                                ? '#DCFCE7'
                                                : svc.available
                                                  ? '#E8F6EE'
                                                  : '#F1F5F3',
                                              borderRadius: 16,
                                              borderWidth: isPicked ? 2 : 1.5,
                                              borderColor: isPicked ? '#EA580C' : '#8ECFB0',
                                              padding: 15,
                                              gap: 10,
                                              opacity: svc.available ? 1 : 0.55,
                                              ...(Platform.OS === 'web'
                                                ? {
                                                    backgroundImage: isPicked
                                                      ? 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 45%, #86EFAC 100%)'
                                                      : svc.available
                                                        ? 'linear-gradient(135deg, #E8F6EE 0%, #D4F0DE 50%, #BFE7CF 100%)'
                                                        : 'none',
                                                    boxShadow: isPicked
                                                      ? '0 6px 18px rgba(0, 0, 0, 0.18), 0 2px 4px rgba(0, 0, 0, 0.08)'
                                                      : '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)',
                                                    cursor: svc.available ? 'pointer' : 'not-allowed',
                                                  }
                                                : {
                                                    elevation: isPicked ? 3 : 1,
                                                  }),
                                            }}
                                          >
                                            {/* Top: Category Tag & Selection Indicator */}
                                            <View
                                              style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                              }}
                                            >
                                              <View
                                                style={{
                                                  flexDirection: 'row',
                                                  alignItems: 'center',
                                                  gap: 5,
                                                  backgroundColor: isPicked
                                                    ? 'rgba(0, 0, 0, 0.12)'
                                                    : 'rgba(255, 255, 255, 0.82)',
                                                  paddingHorizontal: 7.5,
                                                  paddingVertical: 3,
                                                  borderRadius: 6,
                                                  borderWidth: 1,
                                                  borderColor: isPicked
                                                    ? 'rgba(0, 0, 0, 0.22)'
                                                    : 'rgba(0, 0, 0, 0.14)',
                                                }}
                                              >
                                                <ServiceCategoryIcon
                                                  category={group.name}
                                                  size={11}
                                                  color="#EA580C"
                                                />
                                                <Text
                                                  style={{
                                                    fontSize: 9.5,
                                                    fontWeight: '700',
                                                    color: '#EA580C',
                                                    letterSpacing: 0.4,
                                                    textTransform: 'uppercase',
                                                  }}
                                                >
                                                  {group.name}
                                                </Text>
                                              </View>

                                              <View
                                                style={{
                                                  width: 24,
                                                  height: 24,
                                                  borderRadius: 12,
                                                  backgroundColor: isPicked
                                                    ? '#EA580C'
                                                    : 'rgba(255, 255, 255, 0.9)',
                                                  borderWidth: isPicked ? 0 : 1.5,
                                                  borderColor: isPicked ? '#EA580C' : '#7BB999',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  boxShadow: isPicked
                                                    ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                                                    : '0 1px 2px rgba(0, 0, 0, 0.06)',
                                                }}
                                              >
                                                {isPicked && (
                                                  <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
                                                )}
                                              </View>
                                            </View>

                                            {/* Middle: Title & Description */}
                                            <View>
                                              <Text
                                                style={{
                                                  fontSize: 14.5,
                                                  fontWeight: '800',
                                                  color: svc.available
                                                    ? isPicked
                                                      ? '#EA580C'
                                                      : '#0F2E21'
                                                    : '#94A3B8',
                                                  letterSpacing: -0.2,
                                                  lineHeight: 20,
                                                }}
                                              >
                                                {svc.name}
                                              </Text>
                                              {svc.description ? (
                                                <Text
                                                  style={{
                                                    fontSize: 12,
                                                    color: isPicked ? '#264E3B' : '#335845',
                                                    lineHeight: 17,
                                                    marginTop: 3,
                                                  }}
                                                >
                                                  {svc.description}
                                                </Text>
                                              ) : null}
                                            </View>

                                            {/* Crisp Visible Divider */}
                                            <View
                                              style={{
                                                height: 1,
                                                backgroundColor: isPicked
                                                  ? 'rgba(0, 0, 0, 0.22)'
                                                  : 'rgba(0, 0, 0, 0.14)',
                                                marginVertical: 4,
                                              }}
                                            />

                                            {/* Bottom: Labor Fee */}
                                            <View
                                              style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                              }}
                                            >
                                              <View>
                                                <Text
                                                  style={{
                                                    fontSize: 9.5,
                                                    fontWeight: '700',
                                                    color: isPicked ? '#2D5843' : '#456E5A',
                                                    letterSpacing: 0.5,
                                                    textTransform: 'uppercase',
                                                    marginBottom: 1,
                                                  }}
                                                >
                                                  Labor Fee
                                                </Text>
                                                <Text
                                                  style={{
                                                    fontSize: 18.5,
                                                    fontWeight: '800',
                                                    color: svc.available
                                                      ? isPicked
                                                        ? '#EA580C'
                                                        : '#0F2E21'
                                                      : '#DC2626',
                                                    letterSpacing: -0.2,
                                                    fontVariant: ['tabular-nums'],
                                                  }}
                                                >
                                                  {svc.available
                                                    ? formatPhp(svc.price)
                                                    : 'Price not configured'}
                                                </Text>
                                              </View>

                                              {!svc.available && (
                                                <View
                                                  style={{
                                                    backgroundColor: '#FEE2E2',
                                                    borderWidth: 1,
                                                    borderColor: '#FECACA',
                                                    paddingHorizontal: 7.5,
                                                    paddingVertical: 3.5,
                                                    borderRadius: 5,
                                                  }}
                                                >
                                                  <Text
                                                    style={{
                                                      fontSize: 10,
                                                      fontWeight: '700',
                                                      color: '#DC2626',
                                                    }}
                                                  >
                                                    Unavailable
                                                  </Text>
                                                </View>
                                              )}
                                            </View>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 4: BOOKING DETAILS (PROBLEM, PHOTOS, SCHEDULE, NOTES)
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 4 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Preferred Schedule</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Choose your preferred date, service slot, and technician schedule.
                    </Text>
                  </View>

                  {/* Selected motorcycle + services summary */}
                  <View
                    style={{
                      backgroundColor: '#F0F7F3',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#C8DDD3',
                      padding: 14,
                      marginBottom: 14,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#EA580C' }} numberOfLines={1}>
                          {selectedMotorcycleLabel || 'No motorcycle selected'}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '600' }}>
                          Type:{' '}
                          {selectedServiceType === 'Repair'
                            ? 'Repair Services'
                            : 'Preventive Maintenance (PMS)'}{' '}
                          • Engine: {selectedEngineCcLabel}
                          {pmsCatalog.ok && pmsCatalog.category ? `  •  ${pmsCatalog.category.name}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setBookingStep(3)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, cursor: 'pointer' }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#EA580C' }}>Change →</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {selectedServices.map((svc) => (
                        <View
                          key={svc.id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#C8DDD3',
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0F172A' }}>
                            {svc.name} • {formatPhp(svc.price)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Preferred date & time */}
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                    Preferred date & time
                  </Text>
                  {/* Requested Schedule Card */}
                  {(() => {
                    const avail = garageService.getDaySlotAvailability(bookingDate);
                    const isBusy = avail?.isFullyBooked;
                    const dateObj = new Date(bookingDate + 'T00:00:00');
                    const isSunday = dateObj.getDay() === 0;

                    return (
                      <View
                        style={{
                          backgroundColor: isBusy || isSunday ? '#FFFBEB' : '#FFF7ED',
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
                              backgroundColor: isBusy || isSunday ? '#D97706' : '#EA580C',
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
                            <View
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                            >
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
                                    color: isBusy || isSunday ? '#B45309' : '#EA580C',
                                  }}
                                >
                                  {isSunday
                                    ? 'OFF-DUTY'
                                    : isBusy
                                      ? 'HIGH DEMAND'
                                      : `${avail?.availableSlotsCount ?? 0} Slots Available`}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}
                            >
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
                        if (showToast)
                          showToast(`ℹ️ ${dateStr} is busy. You can still request it — admin will confirm.`);
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
                </View>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  STEP 5: REVIEW & SUBMIT
                  ════════════════════════════════════════════════════════════════ */}
              {bookingStep === 5 && (
                <View>
                  <View style={styles.stepSectionHeader}>
                    <Text style={styles.stepSectionTitle}>Review & Submit</Text>
                    <Text style={styles.stepSectionSubtitle}>
                      Check everything below. Your request will be sent for review.
                    </Text>
                  </View>

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
                    {/* Motorcycle & Service Type */}
                    <Text style={reviewSectionTitleStyle}>Motorcycle & Service Type</Text>
                    <View style={{ gap: 7, marginBottom: 14 }}>
                      <ReviewRow label="🛵 Motorcycle" value={selectedMotorcycleLabel || '—'} />
                      <ReviewRow
                        label="🛠️ Service Type"
                        value={
                          selectedServiceType === 'Repair'
                            ? 'Repair Services'
                            : 'Preventive Maintenance (PMS)'
                        }
                      />
                      <ReviewRow label="⚙️ Engine CC" value={selectedEngineCcLabel} />
                      <ReviewRow label="🏷️ CC Category" value={pmsCatalog.category?.name || '—'} />
                      {selectedMotorcycle?.plate_number ? (
                        <ReviewRow label="🔖 Plate" value={selectedMotorcycle.plate_number} />
                      ) : null}
                    </View>

                    {/* Services */}
                    <Text style={reviewSectionTitleStyle}>Services & labor rates</Text>
                    <View style={{ gap: 7, marginBottom: 8 }}>
                      {selectedServices.map((svc) => (
                        <View
                          key={svc.id}
                          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}
                        >
                          <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '600', flex: 1 }}>
                            {svc.name}
                          </Text>
                          <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '800' }}>
                            {formatPhp(svc.price)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 }} />
                    <View style={{ gap: 6, marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#64748B' }}>Labor subtotal</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                          {formatPhp(estimatedLaborTotal)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, color: '#64748B' }}>Parts estimate</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                          {formatPhp(0)}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                          Estimated total
                        </Text>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#EA580C' }}>
                          {formatPhp(estimatedLaborTotal)}
                        </Text>
                      </View>
                    </View>

                    {/* Details */}
                    <Text style={reviewSectionTitleStyle}>Request details</Text>
                    <View style={{ gap: 7, marginBottom: 14 }}>
                      <ReviewRow label="📅 Preferred Date" value={`${bookingDate} • ${selectedTimeSlot}`} />
                      {serviceNotes.trim() ? (
                        <ReviewRow label="📝 Problem" value={serviceNotes.trim()} multiline />
                      ) : null}
                      {additionalNotes.trim() ? (
                        <ReviewRow label="🗒️ Notes" value={additionalNotes.trim()} multiline />
                      ) : null}
                      {motorcyclePhotos.length > 0 ? (
                        <ReviewRow
                          label="📎 Photos"
                          value={`${motorcyclePhotos.length} file${motorcyclePhotos.length === 1 ? '' : 's'} attached`}
                        />
                      ) : null}
                    </View>

                    {/* Disclaimer */}
                    <View
                      style={{
                        backgroundColor: '#FFF7ED',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1.5,
                        borderColor: '#99F6E4',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <BootstrapIcon name="shield-check" size={17} color="#EA580C" />
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: '#134E4A',
                          flex: 1,
                          fontWeight: '600',
                          lineHeight: 17,
                        }}
                      >
                        {ESTIMATE_DISCLAIMER_TEXT} Labor rates are confirmed again when you submit, and your
                        request is sent as Pending Review.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Stepper Footer Controls (Consistent across all steps) */}
            {(() => {
              const validation = getStepValidation(bookingStep);
              const nextBlocked = !validation.valid;

              const nextButtonText =
                bookingStep === 1
                  ? 'Continue to Service Type →'
                  : bookingStep === 2
                    ? 'Continue to Services →'
                    : bookingStep === 3
                      ? 'Continue to Schedule →'
                      : bookingStep === 4
                        ? 'Continue to Review →'
                        : isSubmittingBooking
                          ? 'Submitting...'
                          : 'Submit Booking →';

              return (
                <View
                  style={[
                    styles.stepperFooter,
                    {
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      paddingHorizontal: 18,
                      paddingTop: 14,
                      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
                      gap: 12,
                      backgroundColor: '#FFFFFF',
                      borderTopWidth: 1,
                      borderTopColor: '#F1F5F9',
                    },
                  ]}
                >
                  {/* Summary row (only displayed on Step 3 and beyond) */}
                  {bookingStep >= 3 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#64748B' }}>
                        Estimated total
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#EA580C' }}>
                        {formatPhp(estimatedLaborTotal)}
                      </Text>
                    </View>
                  )}

                  {/* Action buttons row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      style={[
                        styles.stepBackBtn,
                        {
                          paddingHorizontal: 16,
                          paddingVertical: 13,
                          borderRadius: 14,
                          backgroundColor: '#F1F5F9',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        },
                      ]}
                      onPress={handlePrevStep}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name={bookingStep > 1 ? 'arrow-left' : 'x'} size={14} color="#475569" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
                        {bookingStep > 1 ? 'Back' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.stepNextBtn,
                        {
                          flex: 1,
                          paddingVertical: 13,
                          borderRadius: 14,
                          backgroundColor: '#EA580C',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 6,
                        },
                        (nextBlocked || isSubmittingBooking) && { opacity: 0.5 },
                      ]}
                      onPress={handleNextStep}
                      disabled={nextBlocked || isSubmittingBooking}
                      activeOpacity={0.85}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }}>{nextButtonText}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ─── 7. PERSISTENT MOBILE BOTTOM NAVIGATION ─── */}
      <BottomNavBar
        activeTab="Services"
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
        title={
          isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0)
            ? 'Cancel Service Request?'
            : 'Cancel Pit Bay Appointment?'
        }
        message={
          isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0)
            ? `Cancel service request #${bookingToCancel?.id}? No payment has been made, so nothing will be charged.`
            : `⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour advance downpayment of ₱${(bookingToCancel?.amount_paid || bookingToCancel?.downpayment_amount || Math.round((bookingToCancel?.pricePhp || 2500) * 0.2)).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover technician and bay allocation. Are you sure you wish to cancel?`
        }
        confirmText={
          isFlexibleBooking(bookingToCancel) && !Number(bookingToCancel?.amount_paid || 0)
            ? 'Yes, Cancel Request'
            : 'Yes, Cancel & Forfeit Downpayment'
        }
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
        animationType="slide"
        onRequestClose={() => setIsRosterModalOpen(false)}
      >
        <View style={styles.rosterModalOverlay}>
          <TouchableOpacity
            style={styles.popupModalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsRosterModalOpen(false)}
          />

          <View style={styles.rosterModalContainer}>
            <View style={styles.rosterModalHeader}>
              <View style={styles.rosterModalTitleRow}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: '#FFF7ED',
                    borderWidth: 1,
                    borderColor: '#FED7AA',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="tools" size={17} color="#EA580C" />
                </View>
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
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              {mechanicsData.mechanics.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                    No certified mechanics currently registered.
                  </Text>
                </View>
              ) : (
                mechanicsData.mechanics.map((mech) => (
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
                ))
              )}
            </ScrollView>

            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9',
                flexDirection: 'row',
                justifyContent: 'flex-end',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#EA580C',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
                onPress={() => setIsRosterModalOpen(false)}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
