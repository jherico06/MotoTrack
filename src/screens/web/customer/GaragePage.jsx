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
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BootstrapIcon,
  ToastNotification,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  HeaderSearchWidget,
  NotificationDropdown,
  BookingSelect,
  BookingCalendar,
  SegmentedToggle,
  CustomerServiceBookingCard,
  ServiceCategoryIcon,
  CustomerMobileNavDrawer,
} from '../../../components';
import { isFlexibleBooking, normalizeBookingStatus } from '../../../utils/serviceQuotation.js';
import { PackageFirstBookingWorkflow } from '../../../components/web/booking';
import {
  LiveOrderTrackingMapModal,
  ConfirmModal,
  CartModal,
  CheckoutModal,
  RegisterMotorcycleModal,
} from '../../../components/modals';
import { garageWebStyles as gStyles } from '../../../styles/web/garagePage.web.styles.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import {
  garageService,
  generateBookingId,
  REPAIR_COMMON_ISSUES,
  BOOKING_CATEGORIES,
  GARAGE_BRANCHES,
  TIME_SLOTS,
} from '../../../services/bookings/garageService.js';
import { pmsPricingService } from '../../../services/bookings/pmsPricingService.js';
import {
  formatPhp,
  UNSUPPORTED_CC_MESSAGE,
  filterServicesByCatalogCategory,
  groupPmsCatalog,
  groupPmsCatalogByPrimarySection,
} from '../../../utils/pmsCcPricing.js';
import { pickImageFromFile, pickVideoFromFile } from '../../../utils/imagePickerHelper.js';
import { orderService } from '../../../services/orders/orderService.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { authService } from '../../../services/auth/authService.js';
import { userService } from '../../../services/staff/userService.js';
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';

const ESTIMATE_DISCLAIMER_TEXT =
  pmsPricingService.ESTIMATE_DISCLAIMER || 'Estimated labor only. Final price may change after inspection.';

// Booking wizard: motorcycle -> service type -> services -> details -> review.
const BOOKING_STEPS = [
  { id: 1, label: 'Motorcycle', shortLabel: 'Motorcycle', icon: 'bicycle' },
  { id: 2, label: 'Service type', shortLabel: 'Service type', icon: 'sliders' },
  { id: 3, label: 'Services', shortLabel: 'Services', icon: 'tools' },
  { id: 4, label: 'Schedule', shortLabel: 'Schedule', icon: 'calendar-event' },
  { id: 5, label: 'Review', shortLabel: 'Review', icon: 'clipboard-check' },
];
const BOOKING_STEP_COUNT = BOOKING_STEPS.length;
const MAX_SERVICE_TITLE_LENGTH = 160;

const BOOKING_STEP_TITLES = {
  1: 'Select your motorcycle',
  2: 'Choose service type',
  3: 'Choose your services',
  4: 'Choose schedule',
  5: 'Review & confirm',
};

const SERVICE_DURATIONS = {
  'pms-minor-tune-up': '45–60 min',
  'pms-major-tune-up': '2–3 hours',
  'pms-top-overhaul': '3–5 hours',
  'pms-major-engine-overhaul': '1–2 days',
  'pms-replace-lubricate-cable': '30–45 min',
  'pms-replace-brake-pads': '30–45 min',
  'pms-replace-brake-shoe': '30–45 min',
  'pms-replace-front-fork-oil': '1–2 hours',
  'pms-replace-swing-arm-bushing': '1–2 hours',
  'pms-replace-steering-ball': '1–2 hours',
  'pms-replace-front-hub-bearing': '45–60 min',
  'pms-replace-rear-hub-bearing': '45–60 min',
  'pms-battery-recharging': '2–4 hours',
  'pms-replace-head-light-bulb': '15–30 min',
  'pms-replace-tail-light-bulb': '15–30 min',
  'pms-replace-signal-light-bulb': '15–30 min',
  'pms-replace-panel-bulb': '30–45 min',
  'pms-replace-wiring-harness': '3–5 hours',
  'pms-replace-drive-chain': '30–45 min',
  'pms-overhaul-carburetor': '1–2 hours',
  'pms-replace-starter-motor': '45–60 min',
  'pms-replace-cam-sprocket-chain': '2–3 hours',
};

const SERVICE_CUSTOM_DESCRIPTIONS = {
  'pms-minor-tune-up': 'Essential care and a 12-point safety inspection.',
  'pms-major-tune-up': 'Complete tune-up, diagnostics, and road test.',
  'pms-top-overhaul': 'Cylinder head rebuild, valve grinding, and gasket refresh.',
  'pms-major-engine-overhaul': 'Complete disassembly, piston/crank replacement, and precision rebuild.',
  'pms-replace-lubricate-cable': 'Clutch and throttle cable lubrication and free-play calibration.',
  'pms-replace-brake-pads': 'Front/rear disc brake pad replacement and caliper cleaning.',
  'pms-replace-brake-shoe': 'Rear drum brake shoe replacement and drum de-dusting.',
  'pms-replace-front-fork-oil': 'Fork disassembly, oil replacement, and seal inspection.',
  'pms-replace-swing-arm-bushing': 'Rear swing arm bushing replacement for stable chassis handling.',
  'pms-replace-steering-ball': 'Steering head race and ball bearing cleaning, grease, and alignment.',
  'pms-replace-front-hub-bearing': 'Front wheel bearing replacement and hub race alignment.',
  'pms-replace-rear-hub-bearing': 'Rear wheel bearing replacement and axle inspection.',
  'pms-battery-recharging': 'Automotive multi-stage battery load test and deep replenishment.',
  'pms-replace-head-light-bulb': 'Headlamp bulb replacement and beam alignment check.',
  'pms-replace-tail-light-bulb': 'Rear brake and running light bulb replacement.',
  'pms-replace-signal-light-bulb': 'Turn indicator bulb installation and blinker relay check.',
  'pms-replace-panel-bulb': 'Instrument cluster backlight bulb replacement and circuit test.',
  'pms-replace-wiring-harness': 'Main chassis wiring replacement and ground terminal sealing.',
  'pms-replace-drive-chain': 'Chain replacement, tension adjustment, and sprocket alignment.',
  'pms-overhaul-carburetor': 'Ultrasonic jet cleaning, float bowl setting, and idle mixture tuning.',
  'pms-replace-starter-motor': 'Electric starter replacement, bendix check, and test crank.',
  'pms-replace-cam-sprocket-chain': 'Timing chain, tensioner, and cam sprocket sync calibration.',
};

const POPULAR_SERVICE_IDS = new Set([
  'pms-major-tune-up',
]);

const SERVICE_CATEGORY_DESCRIPTIONS = {
  'Tune-Up and Maintenance': 'Preventive care for a smoother, safer ride',
  'Tune-up and Maintenance': 'Preventive care for a smoother, safer ride',
  'TUNE-UP & MAINTENANCE': 'Preventive care for a smoother, safer ride',
  'Engine Services': 'Core engine maintenance, diagnostics, and component rebuilds',
  'Brake Services': 'Brake system inspection, pad renewal, and safety tuning',
  'Electrical Services': 'Battery health, wiring diagnosis, and lighting fixes',
  'Suspension and Chassis': 'Fork oil replacement, bushing maintenance, and wheel bearing care',
  'Drive System': 'Chain cleaning, belt inspection, and cable lubrication',
};

function getServiceDuration(svc) {
  if (svc.estimated_duration) return svc.estimated_duration;
  if (svc.duration) return svc.duration;
  return SERVICE_DURATIONS[svc.id] || '30–60 min';
}

function getServiceDescription(svc) {
  if (svc?.description && String(svc.description).trim()) {
    return String(svc.description).trim();
  }
  if (svc?.id && SERVICE_CUSTOM_DESCRIPTIONS[svc.id]) return SERVICE_CUSTOM_DESCRIPTIONS[svc.id];
  return 'Professional automotive inspection and servicing.';
}

function isPopularService(svc) {
  return POPULAR_SERVICE_IDS.has(svc.id) || svc.is_popular || svc.popular || false;
}

const reviewSectionTitleStyle = {
  fontSize: 12,
  fontWeight: '600',
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

export default function GaragePageWeb({
  activeView = 'book',
  selectedBookingInitial = null,
  onNavigateToAppointments,
  onNavigateToGarage,
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToCustomizer,
  onNavigateToCustomize,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onLogout,
  initialSearchQuery = '',
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const { currentUser, logout, setRedirectReason } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { wishlistCount } = useWishlist();
  const { cartItemCount } = useCart();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser) : 0
  );
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [brandSettings, setBrandSettings] = useState(() => systemSettingsService.getSettings());

  useEffect(() => {
    return systemSettingsService.subscribe(setBrandSettings);
  }, []);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(currentUser ? notificationService.getUnreadCount(currentUser) : 0);
    });
    return () => unsub?.();
  }, [currentUser]);

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

  const [activeTab, setActiveTab] = useState('Scheduled');
  const [garageViewTab, setGarageViewTab] = useState(activeView || 'book');

  useEffect(() => {
    if (activeView) {
      setGarageViewTab(activeView);
    }
  }, [activeView]);

  useEffect(() => {
    if (selectedBookingInitial) {
      setSelectedBookingForModal(selectedBookingInitial);
      setBookingStatusFilter('ALL');
    }
  }, [selectedBookingInitial]);

  const [bookingSearchQuery, setBookingSearchQuery] = useState(initialSearchQuery || '');

  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== null) {
      setBookingSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);
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
  const safeBookingsPage = Math.min(Math.max(1, bookingsPage), bookingsTotalPages);
  const pagedBookings = useMemo(() => {
    const start = (safeBookingsPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredBookings.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filteredBookings, safeBookingsPage]);

  // Keep selected booking in modal synced if userBookings refreshes
  const activeModalBooking = useMemo(() => {
    if (!selectedBookingForModal) return null;
    const modalId = selectedBookingForModal?.booking_id || selectedBookingForModal?.id;
    return userBookings.find((b) => (b?.booking_id || b?.id) === modalId) || selectedBookingForModal;
  }, [userBookings, selectedBookingForModal]);
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

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

  useEffect(() => {
    return systemSettingsService.subscribe(() => {
      refreshAvailability();
    });
  }, []);

  // Cancellation Warning Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);

  // Booking Wizard State
  const [bookingStep, setBookingStep] = useState(1);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isRegisterBikeModalOpen, setIsRegisterBikeModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [hoveredReviewBtn, setHoveredReviewBtn] = useState(null);
  const [isModalCloseHovered, setIsModalCloseHovered] = useState(false);
  const [isFooterBackHovered, setIsFooterBackHovered] = useState(false);
  const [isFooterSubmitHovered, setIsFooterSubmitHovered] = useState(false);

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

  const [garageMotorcycles, setGarageMotorcycles] = useState(() =>
    motorcycleService.getMotorcycles(currentUser?.id)
  );
  const [selectedMotorcycleId, setSelectedMotorcycleId] = useState('');

  // Fixed-rate service catalog (CC-based, grouped). Re-derived whenever the selected motorcycle changes.
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  /** Selected service type: 'PMS' | 'Repair' */
  const [selectedServiceType, setSelectedServiceType] = useState('PMS');
  const [hoveredServiceId, setHoveredServiceId] = useState(null);
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

  // Primary sections: Preventive Maintenance (PMS) & Repair Services, filtered by selected service type and grouped by subsystem
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

  // Flat groups list fallback for search / compatibility
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

  const formattedAppointmentDay = useMemo(() => {
    if (!selectedDate) return 'Tuesday, March 18';
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      if (isNaN(d.getTime())) return selectedDate;
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } catch (_e) {
      return selectedDate;
    }
  }, [selectedDate]);

  const reviewMotorcycleTitle = useMemo(() => {
    if (selectedMotorcycle) {
      const yr = selectedMotorcycle.year ? `${selectedMotorcycle.year} ` : '';
      const br = selectedMotorcycle.brand || '';
      const md = selectedMotorcycle.model || '';
      const full = `${yr}${br} ${md}`.trim();
      if (full) return full;
    }
    return selectedMotorcycleLabel || '2026 Suzuki Smash 125';
  }, [selectedMotorcycle, selectedMotorcycleLabel]);

  const reviewEngineDisplacement = useMemo(() => {
    const disp = selectedMotorcycle?.engine_displacement || selectedMotorcycle?.engine_cc || pmsCatalog.engineCc;
    if (!disp) return '125 cc';
    const str = String(disp).trim();
    return str.toLowerCase().includes('cc') ? str : `${str} cc`;
  }, [selectedMotorcycle, pmsCatalog.engineCc]);

  const reviewCcCategory = useMemo(() => {
    const raw = pmsCatalog.category?.name || '125 cc and below';
    return raw.replace(/(\d+)\s*cc/i, '$1 cc').toLowerCase();
  }, [pmsCatalog.category]);

  const reviewPlateNumber = useMemo(() => {
    return selectedMotorcycle?.plate_number || selectedMotorcycle?.plate || 'NPC-143431';
  }, [selectedMotorcycle]);

  const reviewServiceType = useMemo(() => {
    return selectedServiceType === 'Repair' ? 'Mechanical Repair' : 'Preventive Maintenance';
  }, [selectedServiceType]);

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

  // Inject clean, non-overlapping scrollbar styles for service booking modal on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'mototrack-service-modal-scroll-style';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        [data-service-modal-scroll="true"]::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        [data-service-modal-scroll="true"]::-webkit-scrollbar-track {
          background: transparent;
        }
        [data-service-modal-scroll="true"]::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
          border-radius: 999px;
        }
        [data-service-modal-scroll="true"]::-webkit-scrollbar-thumb:hover {
          background-color: #94A3B8;
        }
        [data-service-modal-scroll="true"] {
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 transparent;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Sync registered garage motorcycles from service
  useEffect(() => {
    let unsub = () => { };
    try {
      if (typeof motorcycleService?.subscribe === 'function') {
        unsub = motorcycleService.subscribe(() => {
          const updated = currentUser ? motorcycleService.getMotorcycles(currentUser) || [] : [];
          setGarageMotorcycles(updated);
          if (currentUser && updated.length > 0) {
            const nextBike = updated.find((m) => m.is_primary) || updated[0];
            if (nextBike) applyRegisteredMotorcycle(nextBike);
          }
        });
      }
      const list = currentUser ? motorcycleService.getMotorcycles(currentUser) || [] : [];
      setGarageMotorcycles(list);
      if (currentUser && list.length > 0) {
        const nextBike = list.find((m) => m.is_primary) || list.find((m) => m.motorcycle_id === selectedMotorcycleId) || list[0];
        if (nextBike) applyRegisteredMotorcycle(nextBike);
      } else if (!currentUser) {
        setSelectedMotorcycleId('');
      }
    } catch (_e) { }

    return () => {
      try {
        unsub?.();
      } catch (_e) { }
    };
  }, [currentUser]);

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

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
      .catch(() => { });
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

  const getStepValidation = (step) => {
    if (step === 1) {
      if (!currentUser)
        return { valid: false, message: 'Please sign in to book a service for your registered motorcycle.' };
      if (!selectedMotorcycleId)
        return { valid: false, message: 'Please select a registered motorcycle, or register one first.' };
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
      if (!selectedDate)
        return { valid: false, message: 'Please select your preferred date from the calendar.' };
      if (!selectedTime) return { valid: false, message: 'Please select your preferred time window.' };
      // Fully booked days are allowed: the schedule is only a request for admin review.
      return { valid: true };
    }
    return { valid: true };
  };

  const handleNextStep = () => {
    if (isSubmittingBooking) return;
    const validation = getStepValidation(bookingStep);
    if (!validation.valid) {
      showToast(`⚠️ ${validation.message}`);
      return;
    }
    if (bookingStep < BOOKING_STEP_COUNT) {
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
    setGarageViewTab('book');
    setBookingStep(1);
    setIsBookingModalOpen(true);
    setIsCalendarModalOpen(false);
  };

  const handleProceedToBookingForm = () => {
    setGarageViewTab('book');
    setBookingStep(1);
    setIsCalendarModalOpen(false);
    setIsBookingModalOpen(true);
  };

  const handleSaveRegisteredMotorcycle = async (motoData) => {
    const res = await motorcycleService.addMotorcycle({
      ...motoData,
      user_id: currentUser?.id || currentUser?.user_id,
      customer_id: currentUser?.customerId || currentUser?.customer_id || currentUser?.id,
      customer_email: currentUser?.email || '',
    });
    const list = motorcycleService.getMotorcycles(currentUser?.id) || [];
    setGarageMotorcycles(list);
    const saved = list.find((m) => m.motorcycle_id === res?.motorcycle?.motorcycle_id) || res?.motorcycle;
    if (saved) applyRegisteredMotorcycle(saved);
    showToast(
      res?.warning
        ? `✓ Registered in My Garage (${res.warning})`
        : `✓ Registered ${motoData.brand} ${motoData.model} to My Garage`
    );
  };

  const handleQuickBook = (_type, forceTomorrow = false) => {
    if (forceTomorrow || todaySlotsData.isFullyBooked) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = tomorrow.toISOString().split('T')[0];
      setSelectedDate(tomStr);
      showToast('📅 Setting appointment date to tomorrow (Next Available Slot).');
    }
    const resolvedType = String(_type || '')
      .toLowerCase()
      .includes('repair')
      ? 'Repair'
      : 'PMS';
    handleOpenBooking(resolvedType);
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

  // Catalog booking: multi-service, fixed labor rates re-quoted server-side. Submitted as Pending Review.
  const handleConfirmBooking = async () => {
    if (isSubmittingBooking) return;
    try {
      if (!currentUser) {
        showToast('⚠️ Please sign in to submit a service request.');
        return;
      }
      const registeredBike =
        (garageMotorcycles || []).find(
          (m) => String(m.motorcycle_id || m.id) === String(selectedMotorcycleId)
        ) || null;
      if (!registeredBike) {
        showToast('⚠️ Please select a registered motorcycle from My Garage.');
        return;
      }
      if (!selectedServiceIds.length) {
        showToast('⚠️ Please select at least one service.');
        return;
      }
      if (!selectedDate || !selectedTime) {
        showToast('⚠️ Please choose your preferred date and time window.');
        return;
      }

      setIsSubmittingBooking(true);

      // Never trust UI prices — re-quote from the motorcycle CC + selected service ids.
      const uniqueServiceIds = [...new Set(selectedServiceIds)];
      const quote = await pmsPricingService.quoteBookingServices({
        engineCc: registeredBike.engine_cc,
        serviceIds: uniqueServiceIds,
      });
      if (!quote?.ok) {
        showToast(`⚠️ ${quote?.error || UNSUPPORTED_CC_MESSAGE}`);
        return;
      }

      const lineItems = quote.lineItems || [];
      const serviceIdsFromQuote = lineItems.map((i) => i.serviceId);
      const firstLine = lineItems[0] || null;
      const serviceTitle = buildServiceTitle(lineItems);
      const laborSubtotal = Number(quote.laborSubtotal || 0);

      const brand = registeredBike.brand || bikeBrand || 'Motorcycle';
      const model = registeredBike.model || bikeModel || '';
      const plate = registeredBike.plate_number || bikePlate || 'TEMP-PLATE';
      const year = registeredBike.year ? String(registeredBike.year) : bikeYear || '';
      const odometer = registeredBike.odometer ? String(registeredBike.odometer) : bikeOdo || '';

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
        serviceId: firstLine?.serviceId || null,
        package_id: firstLine?.serviceId || null,
        pms_service_id: firstLine?.serviceId || null,
        package_name: serviceTitle,
        service_title: serviceTitle,
        serviceName: serviceTitle,
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
        userEmail: currentUser?.email || 'rider@mototrack.com',
        customer_email: currentUser?.email || 'rider@mototrack.com',
        userName: ownerName,
        customer_name: ownerName,
        userPhone: ownerPhone,
        customer_phone: ownerPhone,
        customer_id: currentUser?.customer_id || currentUser?.id,
        motorcycle_id:
          selectedMotorcycleId || registeredBike.motorcycle_id || registeredBike.id || 'moto-default',
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
        notes: additionalNotes.trim() ? additionalNotes.trim() : problemDescription,
        additional_notes: additionalNotes.trim(),
        status: 'PENDING_REVIEW',
        service_progress: 0,
        createdAt: new Date().toISOString(),
        customerPhone: ownerPhone,
      };

      const created = await garageService.addBooking(bookingDraft);
      refreshBookings();
      setIsBookingModalOpen(false);
      setGarageViewTab('book');
      setBookingStep(1);
      setMotorcyclePhotos([]);
      setServiceNotes('');
      setAdditionalNotes('');
      setSelectedServiceIds([]);
      setServiceSearch('');
      setSelectedServiceType('PMS');
      const dueLabel = created?.payment_deadline ? new Date(created.payment_deadline).toLocaleString() : null;
      const rateLabel = ` (${lineItems.length} service${lineItems.length === 1 ? '' : 's'} — ${formatPhp(laborSubtotal)})`;
      showToast(
        dueLabel
          ? `Booking #${bookingId}${rateLabel} submitted. Pay the downpayment by ${dueLabel} or it will be cancelled automatically.`
          : `Your service request (#${bookingId})${rateLabel} has been submitted for review.`
      );
      setActiveTab('Scheduled');
      setTimeout(() => {
        const el = document.getElementById('scheduled-booking-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      console.error('Booking confirmation failed:', err);
      showToast(`⚠️ ${err?.message || 'Could not submit booking request. Please try again.'}`);
    } finally {
      setIsSubmittingBooking(false);
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
    showToast(
      noCharge ? 'Service request cancelled.' : 'Appointment cancelled. Downpayment was forfeited per policy.'
    );
  };

  return (
    <View style={[gStyles.container, isDarkMode && { backgroundColor: '#0F1412' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT GARAGE SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          ...(Platform.OS === 'web' ? { overscrollBehavior: 'none', overscrollBehaviorY: 'none' } : {}),
        }}
        contentContainerStyle={gStyles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── DESKTOP TOP STICKY NAVBAR ─── */}
        <View
          style={[
            gStyles.headerWrapper,
            isDarkMode && { backgroundColor: '#151C19', borderBottomColor: '#26332E' },
          ]}
          className="web-header"
          dataSet={{ webHeader: true }}
          accessibilityRole="header"
        >
          <View
            style={[
              gStyles.headerInner,
              windowWidth < 768 && { paddingHorizontal: 12, paddingVertical: 10, gap: 8, minHeight: 56 },
              windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
            ]}
          >
            {/* Left: Mobile Nav Toggle + Logo */}
            <View style={gStyles.headerLeft}>
              {windowWidth < 768 && (
                <TouchableOpacity
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                  }}
                  onPress={() => setIsMobileNavOpen(true)}
                  activeOpacity={0.8}
                  accessibilityLabel="Open Navigation Menu"
                >
                  <BootstrapIcon name="list" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {windowWidth >= 768 && (
                <TouchableOpacity
                  style={gStyles.logoWrap}
                  onPress={() => onNavigateToStore?.()}
                  activeOpacity={0.8}
                >
                  <BrandLogo size={windowWidth < 1024 ? 32 : 42} textColor="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Center Navigation: Shop, Book a Service, Appointments, Customize, Garage, Orders (Desktop / Tablet only) */}
            {windowWidth >= 768 && (
              <View style={gStyles.headerCenterNav}>
                {/* Shop Button */}
                <TouchableOpacity
                  className="main-nav-tab"
                  style={gStyles.headerCenterBtn}
                  onPress={() => onNavigateToStore?.()}
                  activeOpacity={0.8}
                  title="Shop"
                >
                  <Text style={gStyles.headerCenterBtnText}>Shop</Text>
                </TouchableOpacity>

                {/* Book a Service Button */}
                <TouchableOpacity
                  className="main-nav-tab"
                  style={garageViewTab === 'book' ? gStyles.headerCenterBtnActive : gStyles.headerCenterBtn}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (garageViewTab !== 'book') {
                      if (onNavigateToGarage) onNavigateToGarage();
                      else setGarageViewTab('book');
                    }
                  }}
                  title="Book a Service"
                >
                  <Text style={garageViewTab === 'book' ? gStyles.headerCenterBtnTextActive : gStyles.headerCenterBtnText}>
                    Book a Service
                  </Text>
                </TouchableOpacity>

                {/* Appointments Button */}
                <TouchableOpacity
                  className="main-nav-tab"
                  style={garageViewTab === 'appointments' ? gStyles.headerCenterBtnActive : gStyles.headerCenterBtn}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (garageViewTab !== 'appointments') {
                      if (onNavigateToAppointments) onNavigateToAppointments();
                      else setGarageViewTab('appointments');
                    }
                  }}
                  title="Appointments"
                >
                  <Text style={garageViewTab === 'appointments' ? gStyles.headerCenterBtnTextActive : gStyles.headerCenterBtnText}>
                    Appointments
                  </Text>
                </TouchableOpacity>

                {/* Customize Button */}
                <TouchableOpacity
                  className="main-nav-tab"
                  style={gStyles.headerCenterBtn}
                  onPress={() => {
                    if (onNavigateToCustomizer) onNavigateToCustomizer();
                    else if (onNavigateToCustomize) onNavigateToCustomize();
                  }}
                  activeOpacity={0.8}
                  title="Customize"
                >
                  <Text style={gStyles.headerCenterBtnText}>Customize</Text>
                </TouchableOpacity>

                {/* Garage Button */}
                <TouchableOpacity
                  className="main-nav-tab"
                  style={gStyles.headerCenterBtn}
                  onPress={() => onNavigateToProfile?.('garage')}
                  activeOpacity={0.8}
                  title="Garage"
                >
                  <Text style={gStyles.headerCenterBtnText}>Garage</Text>
                </TouchableOpacity>

                {/* Orders Button */}
                <TouchableOpacity
                  className="main-nav-tab"
                  style={gStyles.headerCenterBtn}
                  onPress={() => onNavigateToOrders?.()}
                  activeOpacity={0.8}
                  title="Orders"
                >
                  <Text style={gStyles.headerCenterBtnText}>Orders</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Right Header Actions */}
            <View style={[gStyles.headerActions, windowWidth < 768 && { gap: 6 }, windowWidth < 400 && { gap: 4 }]}>
              {/* Search Bar / Icon (Smooth appearance, placed before Wishlist) */}
              <HeaderSearchWidget
                searchQuery={bookingSearchQuery}
                onSearchChange={setBookingSearchQuery}
                onSearch={(query) => {
                  setBookingSearchQuery(query);
                  if (garageViewTab !== 'book') {
                    setGarageViewTab('book');
                  }
                }}
                placeholder={
                  garageViewTab === 'book'
                    ? 'Search service packages...'
                    : garageViewTab === 'appointments'
                      ? 'Search appointments...'
                      : 'Search motorcycles...'
                }
                isDark={isDarkMode}
              />

              {/* Favorites Button */}
              {windowWidth >= 768 && (<TouchableOpacity
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
              </TouchableOpacity>)}

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
                    else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'garage');
                  }}
                  currentUser={currentUser}
                />
              </View>

              {/* Cart Button */}
              {windowWidth >= 768 && (<TouchableOpacity
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
              </TouchableOpacity>)}

              {/* Auth: Sign In & Sign Up OR Logged In Profile (Dropdown only on desktop/tablet; sidebar on mobile) */}
              {currentUser && windowWidth >= 768 ? (
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
                    currentScreen="garage"
                    showDashboard={false}
                    onClose={() => setIsUserDropdownOpen(false)}
                    onNavigateToDashboard={() => onNavigateToProfile?.('garage')}
                    onNavigateToOrders={() => onNavigateToOrders?.()}
                    onNavigateToProfile={(tab = 'profile') =>
                      onNavigateToProfile?.(typeof tab === 'string' ? tab : 'profile')
                    }
                    onNavigateToSettings={() => onNavigateToProfile?.('settings')}
                    onNavigateToWishlist={() => onNavigateToWishlist?.()}
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
                    isDark={isDarkMode}
                    onToggleDarkMode={toggleDarkMode}
                  />
                </View>
              ) : (
                <View style={gStyles.authButtonsRow}>
                  <TouchableOpacity
                    style={[
                      gStyles.signInHeaderBtn,
                      windowWidth < 640 && { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
                      windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 5 },
                      windowWidth < 360 && { width: 34, height: 34, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
                    ]}
                    onPress={() => onNavigateToLogin?.()}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                    {windowWidth >= 360 && (
                      <Text style={[gStyles.signInHeaderBtnText, windowWidth < 400 && { fontSize: 12 }]}>Sign In</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ─── GARAGE MAIN CONTENT ─── */}
        <View style={gStyles.maxContainer}>


          {/* ─── 1. PACKAGE-FIRST SERVICE BOOKING WORKFLOW (SCREEN 1-8) ─── */}
          {garageViewTab === 'book' && (
            <PackageFirstBookingWorkflow
              currentUser={currentUser}
              garageMotorcycles={garageMotorcycles}
              existingBookings={userBookings}
              searchQuery={bookingSearchQuery}
              onSearchQueryChange={setBookingSearchQuery}
              onAddNewMotorcycle={() => setIsRegisterBikeModalOpen(true)}
              onBookingCreated={async () => {
                await refreshBookings();
              }}
              onViewBookingDetails={(booking) => {
                if (onNavigateToAppointments) {
                  onNavigateToAppointments(booking);
                } else {
                  setGarageViewTab('appointments');
                  setBookingStatusFilter('ALL');
                  if (booking) {
                    setSelectedBookingForModal(booking);
                  }
                }
              }}
              onNavigateToLogin={() => {
                setRedirectReason?.('Please sign in to book a service for your motorcycle.');
                onNavigateToLogin?.();
              }}
              showToast={showToast}
            />
          )}

          {/* ─── 2. APPOINTMENTS LIST & TRACKING SECTION ─── */}
          {garageViewTab === 'appointments' && (
            <View style={{ width: '100%' }}>
              {/* Appointments Page Header */}
              <View
                style={{
                  marginBottom: 24,
                  flexDirection: isDesktop ? 'row' : 'column',
                  justifyContent: 'space-between',
                  alignItems: isDesktop ? 'center' : 'flex-start',
                  gap: 14,
                }}
              >
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: isDarkMode ? '#F8FAFC' : '#0F172A',
                        letterSpacing: -0.3,
                      }}
                    >
                      My Appointments
                    </Text>
                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 9999,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '600',
                          color: isDarkMode ? '#94A3B8' : '#475569',
                        }}
                      >
                        {userBookings.length} {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDarkMode ? '#94A3B8' : '#64748B',
                      marginTop: 4,
                    }}
                  >
                    Track your scheduled pit stops, approval stages, live bay progress, and service receipts.
                  </Text>
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: isDarkMode ? '#334155' : '#24272B',
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.16)',
                  }}
                  onPress={() => {
                    if (onNavigateToGarage) onNavigateToGarage();
                    else setGarageViewTab('book');
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' }}>
                    Book New Service
                  </Text>
                </TouchableOpacity>
              </View>
              {/* ─── 4 KPI STATS GRID (CLEAN MODERN SAAS) ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full">
                {/* Card 1: MECHANICS AVAILABLE */}
                <div
                  className={`rounded-xl p-5 border shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between min-h-[140px] ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200/90'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Mechanics Available
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${mechanicsData.availableCount > 0
                          ? isDarkMode
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : isDarkMode
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${mechanicsData.availableCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {mechanicsData.availableCount > 0 ? `${mechanicsData.availableCount} Available` : 'Busy'}
                      </span>
                    </div>
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none block font-mono ${isDarkMode ? 'text-slate-100' : 'text-slate-900'
                        }`}
                    >
                      {mechanicsData.availableCount}
                    </span>
                  </div>
                  <span
                    className={`text-[11.5px] font-medium mt-2.5 block leading-snug ${isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                  >
                    {mechanicsData.availableCount > 0
                      ? `${mechanicsData.availableCount} of ${mechanicsData.totalCount} on-duty & available`
                      : 'All technicians currently busy in pit bays'}
                  </span>
                </div>

                {/* Card 2: TODAY'S SLOTS */}
                <div
                  className={`rounded-xl p-5 border shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between min-h-[140px] ${isDarkMode
                    ? todaySlotsData.isFullyBooked
                      ? 'border-rose-900/60 bg-rose-950/30'
                      : 'border-[#27272A] bg-[#18181B]'
                    : todaySlotsData.isFullyBooked
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200/90 bg-white'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Today's Slots
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${todaySlotsData.isFullyBooked
                          ? isDarkMode
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isDarkMode
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${todaySlotsData.isFullyBooked ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        {todaySlotsData.isFullyBooked ? 'Full' : `${todaySlotsData.totalSlots} Slots`}
                      </span>
                    </div>
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none block font-mono ${todaySlotsData.isFullyBooked
                        ? isDarkMode
                          ? 'text-rose-400'
                          : 'text-rose-600'
                        : isDarkMode
                          ? 'text-slate-100'
                          : 'text-slate-900'
                        }`}
                    >
                      {todaySlotsData.isFullyBooked ? '0' : todaySlotsData.availableSlotsCount}
                    </span>
                  </div>
                  <span
                    className={`text-[11.5px] font-medium mt-2.5 block leading-snug ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    {todaySlotsData.mechanicCount === 0
                      ? 'No mechanics on duty today'
                      : todaySlotsData.isFullyBooked
                        ? 'Fully booked for today (0 remaining)'
                        : `${todaySlotsData.mechanicCount} on duty × ${todaySlotsData.slotsPerMechanic} slots · ${todaySlotsData.bookedSlotsCount} reserved`}
                  </span>
                </div>

                {/* Card 3: NEXT OPENING */}
                <div
                  className={`rounded-xl p-5 border shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between min-h-[140px] ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200/90'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Next Opening
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${isDarkMode
                          ? 'bg-orange-950/70 text-orange-300 border border-orange-800/80'
                          : 'bg-orange-50 text-orange-700 border border-orange-200/70'
                          }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {todaySlotsData.isFullyBooked ? 'Tomorrow' : 'Express'}
                      </span>
                    </div>
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none block font-mono ${isDarkMode ? 'text-slate-100' : 'text-slate-900'
                        }`}
                    >
                      {todaySlotsData.isFullyBooked ? 'Tomorrow' : 'Today'}
                    </span>
                  </div>
                  <span
                    className={`text-[11.5px] font-medium mt-2.5 block leading-snug ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    {todaySlotsData.isFullyBooked
                      ? '09:00 AM - 10:30 AM (Next Slot)'
                      : 'Immediate express pit bay slot'}
                  </span>
                </div>

                {/* Card 4: PIT BAY CAPACITY — limited by free technicians */}
                {(() => {
                  const physicalBays = Math.max(
                    1,
                    Number(brandSettings?.serviceBayCount) || mechanicsData.totalCount || 6
                  );
                  const activeBays = Math.min(physicalBays, Number(mechanicsData.availableCount) || 0);
                  const bayBadge =
                    activeBays <= 0 ? 'All Busy' : activeBays >= physicalBays ? 'Full Staff' : 'Active Bays';
                  const bayFooter =
                    activeBays <= 0
                      ? 'No free technicians — all in pit bay'
                      : `${activeBays} of ${physicalBays} bays open (${mechanicsData.availableCount} techs free)`;
                  return (
                    <div
                      className={`rounded-xl p-5 border shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between min-h-[140px] ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200/90'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Pit Bay Capacity
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${activeBays <= 0
                              ? isDarkMode
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isDarkMode
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeBays <= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            {bayBadge}
                          </span>
                        </div>
                        <span
                          className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none block font-mono ${activeBays <= 0 ? 'text-rose-600' : isDarkMode ? 'text-slate-100' : 'text-slate-900'
                            }`}
                        >
                          {activeBays}
                        </span>
                      </div>
                      <span
                        className={`text-[11.5px] font-medium mt-2.5 block leading-snug ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        {bayFooter}
                      </span>
                    </div>
                  );
                })()}
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
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#991B1B', marginBottom: 2 }}>
                      Notice: Service Bays Are Fully Booked For Today
                    </Text>
                    <Text style={{ fontSize: 12, color: '#B91C1C' }}>
                      {todaySlotsData.mechanicCount === 0
                        ? 'No mechanics are on duty today, so there are no open slots. Pick a later date once a technician is scheduled.'
                        : `All ${todaySlotsData.totalSlots} daily slots are reserved. You can pre-book a guaranteed slot for tomorrow or a later date.`}
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
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Book Tomorrow</Text>
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
                      marginBottom: 18,
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
                            borderRadius: 8,
                            backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#3F3F46' : '#E4E4E7',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BootstrapIcon name="calendar-check" size={15} color={isDarkMode ? '#FFFFFF' : '#18181B'} />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#F4F4F5' : '#18181B', letterSpacing: -0.3 }}>
                          Scheduled Bookings
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: isDarkMode ? '#A1A1AA' : '#71717A',
                          marginTop: 3,
                          marginLeft: 44,
                          fontWeight: '500',
                        }}
                      >
                        View and manage your upcoming motorcycle service appointments.
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: isDarkMode ? '#27272A' : '#F4F4F5',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#3F3F46' : '#E4E4E7',
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <BootstrapIcon name="ticket-detailed" size={13} color={isDarkMode ? '#A1A1AA' : '#71717A'} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#E4E4E7' : '#52525B' }}>
                        {userBookings.length} Scheduled {userBookings.length === 1 ? 'Booking' : 'Bookings'}
                      </Text>
                    </View>
                  </View>

                  {/* Modern Segmented Status Filter Tabs + Grid/List View Toggle */}
                  {currentUser && userBookings.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                      <div
                        className={`flex flex-row items-center gap-1 flex-wrap p-1 ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-slate-100/90 border-slate-200/80'} border rounded-lg w-fit`}
                      >
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
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${isSel
                                ? 'bg-[#1E2227] text-white shadow-xs'
                                : isDarkMode
                                  ? 'bg-transparent text-slate-300 hover:text-white hover:bg-[#27272A]'
                                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                                }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Grid / List View Mode Toggle Button Group */}
                      <div
                        className={`flex items-center gap-1 p-1 ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-slate-100/90 border-slate-200/80'} border rounded-lg w-fit self-start sm:self-auto`}
                      >
                        <button
                          onClick={() => setBookingViewMode('grid')}
                          title="Grid View"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${bookingViewMode === 'grid'
                            ? 'bg-[#1E2227] text-white shadow-xs'
                            : isDarkMode
                              ? 'bg-transparent text-slate-300 hover:text-white hover:bg-[#27272A]'
                              : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                            }`}
                        >
                          <BootstrapIcon
                            name="grid-fill"
                            size={12}
                            color={bookingViewMode === 'grid' ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#475569'}
                          />
                          <span>Grid</span>
                        </button>
                        <button
                          onClick={() => setBookingViewMode('list')}
                          title="List View"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${bookingViewMode === 'list'
                            ? 'bg-[#1E2227] text-white shadow-xs'
                            : isDarkMode
                              ? 'bg-transparent text-slate-300 hover:text-white hover:bg-[#27272A]'
                              : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                            }`}
                        >
                          <BootstrapIcon
                            name="view-list"
                            size={13}
                            color={bookingViewMode === 'list' ? '#FFFFFF' : isDarkMode ? '#94A3B8' : '#475569'}
                          />
                          <span>List</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!currentUser ? (
                    <div
                      className={`${isDarkMode ? 'bg-[#151C19] border-[#374151]' : 'bg-white border-slate-200/80'} rounded-2xl border p-10 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-xs my-4`}
                    >
                      <div
                        className={`w-14 h-14 rounded-2xl ${isDarkMode ? 'bg-[#24272B] border-[#374151]' : 'bg-slate-50 border-slate-200'} border flex items-center justify-center mb-4 text-[#EA580C]`}
                      >
                        <BootstrapIcon name="person-lock" size={26} color={isDarkMode ? '#EA580C' : '#EA580C'} />
                      </div>
                      <h3
                        className={`text-base font-bold mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}
                      >
                        Sign In to View Scheduled Bookings
                      </h3>
                      <p
                        className={`text-xs max-w-sm mb-5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        Sign in to your account to view your scheduled appointments, track master mechanic
                        assignments, and manage service downpayments.
                      </p>
                      <button
                        onClick={() => {
                          setRedirectReason('Please sign in to view your booked pitstop appointments.');
                          onNavigateToLogin?.();
                        }}
                        className="bg-[#EA580C] hover:bg-[#EA580C] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <BootstrapIcon name="box-arrow-in-right" size={13} color="#FFFFFF" />
                        Sign In Now
                      </button>
                    </div>
                  ) : userBookings.length === 0 ? (
                    <div
                      className={`${isDarkMode ? 'bg-[#151C19] border-[#374151]' : 'bg-white border-slate-200/80'} rounded-2xl border p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-xs my-4`}
                    >
                      <div
                        className={`w-14 h-14 rounded-2xl ${isDarkMode ? 'bg-[#24272B] border-[#374151]' : 'bg-[#FFF7ED] border-[#FED7AA]'} border flex items-center justify-center mb-4 text-[#EA580C]`}
                      >
                        <BootstrapIcon
                          name="calendar-plus"
                          size={26}
                          color={isDarkMode ? '#EA580C' : '#EA580C'}
                        />
                      </div>
                      <h3
                        className={`text-base font-bold mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}
                      >
                        No scheduled bookings
                      </h3>
                      <p
                        className={`text-xs max-w-sm mb-5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        You don't have any service appointments matching this filter. Book a service to get your
                        slot reserved.
                      </p>
                      <button
                        onClick={() => handleOpenBooking()}
                        className="bg-[#EA580C] hover:bg-[#EA580C] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <BootstrapIcon name="tools" size={13} color="#FFFFFF" />
                        Book a Service
                      </button>
                    </div>
                  ) : filteredBookings.length === 0 ? (
                    <div
                      className={`${isDarkMode ? 'bg-[#151C19] border-[#374151]' : 'bg-white border-slate-200/80'} rounded-2xl border p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto shadow-xs my-4`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl ${isDarkMode ? 'bg-[#24272B] border-[#374151]' : 'bg-slate-100 border-slate-200'} border flex items-center justify-center mb-3 text-slate-400`}
                      >
                        <BootstrapIcon name="calendar2-x" size={22} color={isDarkMode ? '#64748B' : '#94A3B8'} />
                      </div>
                      <h3
                        className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}
                      >
                        No bookings in this filter
                      </h3>
                      <p className={`text-xs mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Switch to "All" to view your full booking history.
                      </p>
                      <button
                        onClick={() => {
                          setBookingStatusFilter('ALL');
                          setBookingsPage(1);
                        }}
                        className="bg-[#EA580C] hover:bg-[#EA580C] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
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
                        <BootstrapIcon name="chevron-left" size={16} color="#EA580C" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#475569' }}>
                        Page {safeBookingsPage} of {bookingsTotalPages}
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
              </div>
            </View>
          )}

          {/* ─── 3. GARAGE FLEET SECTION ─── */}
          {garageViewTab === 'fleet' && (
            <View style={{ marginBottom: 30, width: '100%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkMode ? '#F5F7F6' : '#0F172A' }}>
                    My Registered Fleet
                  </Text>
                  <Text style={{ fontSize: 12.5, color: '#64748B' }}>
                    Manage and view specifications for your registered motorcycles
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#EA580C',
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  onPress={() => setIsRegisterBikeModalOpen(true)}
                >
                  <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>
                    Add Motorcycle
                  </Text>
                </TouchableOpacity>
              </View>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {garageMotorcycles.map((moto) => (
                  <div
                    key={moto.motorcycle_id || moto.id}
                    className={`rounded-2xl p-4 border transition-all ${isDarkMode ? 'bg-[#151C19] border-[#374151]' : 'bg-white border-slate-200'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">
                        {moto.photo_url ? (
                          <img src={moto.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <BootstrapIcon name="bicycle" size={20} color="#EA580C" />
                        )}
                      </div>
                      <div>
                        <div className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {moto.brand} {moto.model}
                        </div>
                        <div className="text-xs text-slate-400">
                          {moto.engine_displacement || moto.engine_cc} CC • Plate: {moto.plate_number || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMotorcycleId(moto.motorcycle_id || moto.id);
                        setGarageViewTab('book');
                      }}
                      className="w-full py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Book Service for this Bike
                    </button>
                  </div>
                ))}
              </div>
            </View>
          )}
        </View>
      </ScrollView>

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
                    backgroundColor: '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="calendar-check-fill" size={20} color="#EA580C" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: '#FFF7ED',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{ fontSize: 10.5, fontWeight: '600', color: '#EA580C', letterSpacing: 0.5 }}
                      >
                        STEP 1 OF 2
                      </Text>
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: '600', color: '#0F172A' }}>
                      Select Appointment Date & Time
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                    Pick an open date and time slot for your service
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
                  const fullAvail = garageService.getDaySlotAvailability(dateStr);
                  const slotLabel =
                    fullAvail?.mechanicCount === 0
                      ? 'No mechanics are on duty'
                      : `All ${fullAvail?.totalSlots ?? 0} daily slots are reserved`;
                  showToast(`⚠️ Notice: ${dateStr} is FULLY BOOKED! ${slotLabel}.`);
                }}
                minDate={new Date().toISOString().split('T')[0]}
                getDayInfo={(dateStr) => {
                  const selAvail = garageService.getDaySlotAvailability(dateStr);
                  const d = new Date(dateStr + 'T00:00:00');
                  const isSunday = d.getDay() === 0;
                  const bookedCount = selAvail?.bookedSlotsCount || 0;
                  const total = selAvail?.totalSlots || 5;
                  const avail = typeof selAvail?.availableSlotsCount === 'number'
                    ? selAvail.availableSlotsCount
                    : Math.max(0, total - bookedCount);
                  return {
                    bookingCount: bookedCount,
                    availableSlots: avail,
                    totalSlots: total,
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
                    backgroundColor: isFull ? '#FFF1F2' : '#FFF7ED',
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
                        color={isFull ? '#DC2626' : '#EA580C'}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text
                          style={{ fontSize: 14, fontWeight: '600', color: isFull ? '#991B1B' : '#0F172A' }}
                        >
                          Selected: {selectedDate}
                        </Text>
                        {selectedTime && (
                          <View
                            style={{
                              backgroundColor: '#FFF7ED',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#A7F3D0',
                            }}
                          >
                            <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#EA580C' }}>
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
                              fontWeight: '600',
                              color: isFull ? '#DC2626' : '#EA580C',
                            }}
                          >
                            {isFull ? 'FULLY BOOKED' : `${availability?.availableSlotsCount ?? 0} Slots Open`}
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
                        backgroundColor: isFull ? '#CBD5E1' : '#EA580C',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: isFull ? 'not-allowed' : 'pointer',
                        boxShadow: isFull ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.25)',
                      }}
                      onPress={handleProceedToBookingForm}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={{ fontSize: 13, fontWeight: '600', color: isFull ? '#64748B' : '#FFFFFF' }}
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

      {/* ─── PACKAGE-FIRST CUSTOMER BOOKING MODAL ─── */}
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
                maxWidth: 1240,
                maxHeight: '94vh',
                width: '95%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: '#F8FAFC',
              },
            ]}
          >
            {/* Modal Header Bar with Close Button */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingVertical: 14,
                backgroundColor: '#1E2227',
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    backgroundColor: '#EA580C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="tools" size={17} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' }}>
                    Service Booking & Package Marketplace
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                    Browse packages, calculate CC-based pricing, and reserve your pit bay slot
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  gStyles.stepperCloseBtn,
                  isModalCloseHovered && { backgroundColor: '#334155', borderColor: '#475569' },
                ]}
                onPress={() => setIsBookingModalOpen(false)}
                onMouseEnter={() => setIsModalCloseHovered(true)}
                onMouseLeave={() => setIsModalCloseHovered(false)}
                activeOpacity={0.7}
                accessibilityLabel="Close service request modal"
              >
                <BootstrapIcon
                  name="x-lg"
                  size={13}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {/* Scrollable Workflow Body */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={true}
            >
              <PackageFirstBookingWorkflow
                currentUser={currentUser}
                garageMotorcycles={garageMotorcycles}
                existingBookings={userBookings}
                searchQuery={bookingSearchQuery}
                onSearchQueryChange={setBookingSearchQuery}
                onAddNewMotorcycle={() => setIsRegisterBikeModalOpen(true)}
                onBookingCreated={async () => {
                  await refreshBookings();
                }}
                onViewBookingDetails={(booking) => {
                  setIsBookingModalOpen(false);
                  setGarageViewTab('appointments');
                  setBookingStatusFilter('ALL');
                  if (booking) {
                    setSelectedBookingForModal(booking);
                  }
                }}
                onNavigateToLogin={() => {
                  setIsBookingModalOpen(false);
                  setRedirectReason?.('Please sign in to book a service for your motorcycle.');
                  onNavigateToLogin?.();
                }}
                showToast={showToast}
              />
            </ScrollView>
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
                <BootstrapIcon name="tools" size={20} color="#EA580C" />
                <View>
                  <Text style={gStyles.rosterModalTitle}>Certified Pit Crew & Mechanics</Text>
                  <Text style={gStyles.rosterModalSub}>
                    {brandSettings.storeName || 'MotoTrack'} Flagship Central Hub •{' '}
                    {mechanicsData.availableCount} of {mechanicsData.totalCount} Technicians Available Today
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
                        style={[
                          gStyles.rosterStatusText,
                          { color: mech.isAvailable ? '#10B981' : '#EF4444' },
                        ]}
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
                  backgroundColor: '#EA580C',
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
                onPress={() => setIsRosterModalOpen(false)}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Close Roster</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            : `⚠️ STRICT NON-REFUNDABLE POLICY NOTICE:\n\nYour advance downpayment of ₱${(bookingToCancel?.amount_paid || bookingToCancel?.downpayment_amount || Math.round((bookingToCancel?.pricePhp || 2500) * 0.2)).toLocaleString()} is STRICTLY NON-REFUNDABLE.\n\nCancelling Ticket #${bookingToCancel?.id} will forfeit your downpayment to cover reserved technician allocation and bay scheduling. Are you sure you wish to cancel?`
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
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 }}>
                    Booking Details & Quotation
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
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
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: '#E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <View>
                {activeModalBooking && [
                  'PENDING_REVIEW',
                  'APPROVED',
                  'SCHEDULED',
                  'AWAITING_CUSTOMER_APPROVAL',
                  'QUOTATION_SENT',
                  'AWAITING_DOWNPAYMENT',
                ].includes(normalizeBookingStatus(activeModalBooking?.status)) ? (
                  <TouchableOpacity
                    onPress={() => {
                      const b = activeModalBooking;
                      setSelectedBookingForModal(null);
                      handlePromptCancelBooking(b);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: '#FEF2F2',
                      borderWidth: 1,
                      borderColor: '#FEE2E2',
                      cursor: 'pointer',
                    }}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#DC2626' }}>Cancel Booking</Text>
                  </TouchableOpacity>
                ) : <View />}
              </View>

              <TouchableOpacity
                onPress={() => setSelectedBookingForModal(null)}
                style={{
                  paddingHorizontal: 22,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: '#1E2227',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Close Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mobile Customer Navigation Drawer */}
      <CustomerMobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentScreen="garage"
        onNavigateToScreen={(screen, params) => {
          if (screen === 'shop') onNavigateToStore?.();
          else if (screen === 'garage') setActiveTab('All');
          else if (screen === 'customizer') onNavigateToCustomizer ? onNavigateToCustomizer() : onNavigateToCustomize?.();
          else if (screen === 'wishlist') onNavigateToWishlist?.();
          else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'garage');
          else if (screen === 'login') onNavigateToLogin?.();
          else if (screen === 'admin') onNavigateToAdmin?.();
        }}
        unreadNotifCount={unreadNotifCount}
      />
    </View>
  );
}
