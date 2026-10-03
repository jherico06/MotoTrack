// Garage & Service Booking Service for MotoTrack (PMS & Customization)
import { storageAdapter } from './storageAdapter.js';
import { supabaseManager } from './supabaseClient.js';
import { usdToPhp } from '../utils/currency.js';
import { notificationService } from './notificationService.js';
import { auditLogService } from './auditLogService.js';
import { dataCache } from './cache/dataCache.js';
import { CACHE_TTL, CacheKeys, mechanicInvalidationKeys, bookingInvalidationKeys } from './cache/cacheKeys.js';
import {
  FLEX_BOOKING_STATUS,
  isFlexibleBooking,
  normalizeBookingStatus,
  intervalsOverlap,
  appointmentEnd,
  isTerminalBookingStatus,
  getServiceEstimateDefaults,
  calcDownpayment,
  calcPaymentDeadline,
  formatPhp,
  roundMoney,
} from '../utils/serviceQuotation.js';
import { BOOKING_ROLES, TIMELINE_EVENTS } from '../utils/bookingWorkflow.js';
import { serviceQuotationService } from './serviceQuotationService.js';
import { bookingTimelineService } from './bookingTimelineService.js';

export const REPAIR_COMMON_ISSUES = [
  { id: 'engine-trans', label: 'Engine & Transmission', icon: 'gear-wide-connected' },
  { id: 'brake-system', label: 'Brake System & ABS', icon: 'shield-shaded' },
  { id: 'electrical', label: 'Electrical, Battery & Starter', icon: 'lightning-charge' },
  { id: 'suspension-fork', label: 'Fork Seal Leak & Suspension', icon: 'tools' },
  { id: 'drive-chain', label: 'Drive Chain & Sprockets', icon: 'link-45deg' },
  { id: 'general-diag', label: 'Strange Noise / Full Diagnosis', icon: 'search' },
];

export const BOOKING_CATEGORIES = [
  { id: 'Repair', label: 'Mechanical Repair', icon: 'wrench', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'PMS', label: 'Preventive Maintenance (PMS)', icon: 'wrench-adjustable', color: '#1D4533', bg: '#C8DDD3' },
];

export function generateBookingId(category = 'PMS', existingBookings = []) {
  const currentYear = new Date().getFullYear();
  const catUpper = String(category || '').toUpperCase();
  const catPrefix = catUpper.includes('REPAIR') || catUpper === 'REP'
    ? 'REP'
    : catUpper.includes('PMS')
    ? 'PMS'
    : catUpper.includes('CUSTOM') || catUpper === 'CUST'
    ? 'CUST'
    : 'PMS';

  let maxSeq = 0;
  const list = Array.isArray(existingBookings) ? existingBookings : [];
  list.forEach((b) => {
    const bId = String((b && (b.id || b.booking_id)) || '');
    const match = bId.match(/-(\d{5})$/) || bId.match(/-(\d+)$/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq < 100000 && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(5, '0');
  return `BK-${catPrefix}-${currentYear}-${nextSeq}`;
}

export const FIXED_GARAGE_SERVICES = {
  PMS: {
    id: 'pms-fixed',
    category: 'PMS',
    categoryName: 'Preventive Maintenance Service (PMS)',
    title: 'Comprehensive 20-Point PMS & Fluid Service',
    subtitle: 'Track-grade preventive maintenance inspection and fluid replacement',
    pricePhp: 2500,
    downpaymentPhp: 500,
    duration: '90 mins',
    badge: 'Fixed Service Package',
    icon: 'wrench-adjustable',
    inclusions: [
      '20-point chassis, fork, swingarm & bolt torque check',
      'High-performance 100% synthetic engine oil & filter replacement',
      'Brake hydraulic line flush, fluid bleed & pad wear inspection',
      'Drive chain deep ultrasonic clean, tension adjustment & wax lube',
      'Spark plug electrode gap calibration, air filter clean & coolant top-up',
    ],
  },
  Repair: {
    id: 'repair-fixed',
    category: 'Repair',
    categoryName: 'Mechanical & Electrical Repair',
    title: 'Precision Diagnosis & Mechanical Repair',
    subtitle: 'Pinpoint mechanical & electrical troubleshooting and repair by master tech',
    pricePhp: 1500,
    downpaymentPhp: 300,
    duration: '60-120 mins',
    badge: 'Fixed Diagnostic & Repair Base',
    icon: 'wrench',
    inclusions: [
      'OBD-II / CAN-Bus computer fault code scanning & error reset',
      'Pinpoint fault isolation across engine, transmission, brakes or wiring',
      'Component teardown, mechanical troubleshooting and repair labor',
      'Dedicated pit bay slot with certified master technician',
      'Post-repair dyno warmup, leak proofing & test ride verification',
    ],
  },
};


export const GARAGE_SERVICES = [
  {
    id: 'repair-diag',
    category: 'Repair',
    categoryName: 'Mechanical & Electrical Repair',
    title: 'Track Diagnostic & Mechanical Repair',
    subtitle: 'Comprehensive Fault Code Scan & Mechanical Component Fix',
    price: 30.0,
    pricePhp: 1500,
    duration: '45 mins',
    badge: 'Full Diagnostic',
    icon: 'wrench',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    description:
      'Specialized OBD diagnostic scan, pinpoint fault isolation, and mechanical repair troubleshooting by master technicians.',
    inclusions: [
      'OBD-II / CAN-Bus ECU Diagnostic Fault Scanning',
      'Engine Compression & Cylinder Leakdown Test',
      'Fuel Rail & Injector Pressure Evaluation',
      'Electrical Harness Short & Parasitic Draw Scan',
      'Component Replacement Labor & Test Ride Verification',
    ],
  },
  {
    id: 'repair-brake',
    category: 'Repair',
    categoryName: 'Mechanical & Electrical Repair',
    title: 'Brake System Overhaul & Caliper Repair',
    subtitle: 'Caliper Piston Seal Rebuild, Rotor Trueing & Hydraulic Bleed',
    price: 44.0,
    pricePhp: 2200,
    duration: '60 mins',
    badge: 'Safety Critical',
    icon: 'shield-shaded',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80',
    description:
      'Complete brake safety restoration addressing spongy levers, stuck calipers, fluid leaks, and rotor pulsation.',
    inclusions: [
      'Brembo / Nissin Caliper Ultrasonic Cleaning & Seal Kit',
      'Master Cylinder Piston Rebuild & Bleeding',
      'High-Boiling Point Synthetic Brake Fluid Flush',
      'Rotor Runout & Thickness Variation Laser Check',
      'Pad De-glaze & Caliper Slide Pin Grease',
    ],
  },
  {
    id: 'repair-engine',
    category: 'Repair',
    categoryName: 'Mechanical & Electrical Repair',
    title: 'Engine Top-End & Transmission Troubleshooting',
    subtitle: 'Valve Clearance Adjustment, Cam Chain Tensioner & Gearbox Fix',
    price: 90.0,
    pricePhp: 4500,
    duration: '120 mins',
    badge: 'Master Tech',
    icon: 'gear-wide-connected',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80',
    description:
      'In-depth mechanical engine repair covering valve shim re-shimming, clutch slipping overhaul, and gear shift fork fixes.',
    inclusions: [
      'Precision Feeler Gauge Valve Clearance Shimming',
      'Manual Cam Chain Tensioner Alignment & Timing',
      'Clutch Basket Friction Plate & Steel Plate Replacement',
      'Gasket & Crankcase Oil Seal Renewal',
      'Post-Repair Dyno Warmup & Leak Proofing',
    ],
  },
  {
    id: 'repair-electrical',
    category: 'Repair',
    categoryName: 'Mechanical & Electrical Repair',
    title: 'Electrical System & Wiring Harness Diagnostics',
    subtitle: 'Stator, Rectifier, Starter Motor & Wiring Loom Troubleshooting',
    price: 36.0,
    pricePhp: 1800,
    duration: '60 mins',
    badge: 'Electrical Lab',
    icon: 'lightning-charge',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=600&q=80',
    description:
      'Resolve battery drain, charging failure, blown fuses, starting issues, and wiring harness corrosion.',
    inclusions: [
      'AC Stator Voltage & Phase Resistance Test',
      'MOSFET Voltage Regulator/Rectifier Load Testing',
      'Starter Relay & Solenoid Amp Draw Test',
      'Wiring Loom Continuity & Ground Point Re-termination',
      'Lithium / AGM Battery High-Rate Load Test',
    ],
  },
  {
    id: 'pms-pro',
    category: 'PMS',
    categoryName: 'Preventive Maintenance',
    title: 'Pro Performance Full PMS',
    subtitle: 'Comprehensive 42-point Track Inspection & Fluid Service',
    price: 75.0,
    pricePhp: 3750,
    duration: '90 mins',
    badge: 'Most Popular',
    icon: 'wrench-adjustable',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    description: 'Complete high-performance preventive maintenance service for superbike and sport riders.',
    inclusions: [
      'Motul 300V Factory Line 100% Synthetic Oil Change',
      'OEM/K&N High-Flow Oil Filter Replacement',
      'Spark Plug Gap & Compression Check',
      'Brake Line Bleed with Motul RBF 660 DOT4',
      'Drive Chain Deep Cleaning, Tensioning & Wax',
      'Throttle Body & Injector Cleaning',
      'Coolant System Specific Gravity Check',
      'Chassis Fasteners Torque Inspection',
    ],
  },
  {
    id: 'pms-quick',
    category: 'PMS',
    categoryName: 'Preventive Maintenance',
    title: 'Quick Express Oil & Lube Pit',
    subtitle: 'Fast 30-min Synthetic Oil, Filter & Chain Service',
    price: 35.0,
    pricePhp: 1750,
    duration: '30 mins',
    badge: 'Express',
    icon: 'speedometer',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80',
    description: 'Rapid turnaround service for busy daily riders and weekend warriors.',
    inclusions: [
      'Fully Synthetic Engine Oil Replacement',
      'Magnetic Drain Plug Inspection & Crush Washer',
      'Tire Pressure & Tread Depth Scan',
      'Drive Chain Degrease & Synthetic Lube',
      'Battery Voltage & Charging Alternator Test',
    ],
  },
  {
    id: 'cust-exhaust',
    category: 'Customization',
    categoryName: 'Customization & Tuning',
    title: 'Full System Exhaust Fitting & Dyno Tuning',
    subtitle: 'Slip-On or Full Titanium Header Installation & ECU Fuel Map',
    price: 120.0,
    pricePhp: 6000,
    duration: '120 mins',
    badge: 'Dyno Verified',
    icon: 'fire',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80',
    description: 'Expert exhaust fabrication and Dynojet 250i chassis dyno fuel calibration.',
    inclusions: [
      'Exhaust Header & Link Pipe Fitting with Anti-Seize',
      'Exup Valve Servo Eliminator / Flashing',
      'Dynojet Dual-Sensor Wideband AFR Tuning',
      'Before & After Horsepower Dyno Printout',
      'Heat Shield & O2 Sensor Sensor Calibration',
    ],
  },
  {
    id: 'cust-suspension',
    category: 'Customization',
    categoryName: 'Customization & Tuning',
    title: 'Track Sag Calibration & Suspension Setup',
    subtitle: 'Front Fork & Rear Shock Spring Preload / Damping Tune',
    price: 65.0,
    pricePhp: 3250,
    duration: '60 mins',
    badge: 'Pro Setup',
    icon: 'gear-wide-connected',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=600&q=80',
    description:
      'Custom suspension geometry dialed in specifically to rider gear weight and track riding style.',
    inclusions: [
      'Rider Static & Dynamic Sag Measurement',
      'Front Fork Compression & Rebound Clicker Setup',
      'Rear Shock High/Low Speed Damping Tuning',
      'Tire Contact Patch Wear Analysis & Guidance',
      'Personalized Track Suspension Baseline Sheet',
    ],
  },
];

export const AVAILABLE_MECHANICS = [];

export const GARAGE_BRANCHES = [
  {
    id: 'central-naga',
    name: "D'Blockchain Motorparts and Accessories",
    address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
    plusCode: '6Q44+MPQ, Naga, 6037 Cebu',
    lat: 10.20663,
    lng: 123.75675,
    bays: '6 Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay',
    phone: '(+63) 917 882 9102 / (032) 489-2100',
    hours: 'Mon - Sun: 8:00 AM - 7:00 PM',
  },
];

export const TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 12:00 PM',
  '01:30 PM - 03:00 PM',
  '03:00 PM - 04:30 PM',
  '04:30 PM - 06:00 PM',
];

export const PACKAGE_CATEGORIES = [
  { id: 'PMS', label: 'Preventive Maintenance', icon: 'wrench-adjustable', color: '#1D4533' },
  { id: 'Repair', label: 'Mechanical Repair', icon: 'wrench', color: '#DC2626' },
  { id: 'Customization', label: 'Customization & Tuning', icon: 'tools', color: '#7C3AED' },
];

function parseInclusions(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_e) {}
    return trimmed
      .split('\n')
      .map((line) => line.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

export function getPackagePricePhp(pkg) {
  if (!pkg) return 0;
  const php = Number(pkg.pricePhp ?? pkg.price_php ?? pkg.package_price ?? 0);
  if (php > 0) return php;
  const price = Number(pkg.price ?? pkg.service_price ?? 0);
  if (price >= 200) return price;
  return price > 0 ? usdToPhp(price) : 0;
}

export function getPackageDownpaymentPhp(pkg) {
  if (!pkg) return 0;
  if (pkg.downpaymentPhp != null && pkg.downpaymentPhp !== '') return Number(pkg.downpaymentPhp);
  return Math.max(0, Math.round(getPackagePricePhp(pkg) * 0.2));
}

export function isActivePackage(pkg) {
  const status = String(pkg?.status || 'active').toLowerCase();
  return status === 'active' || status === '';
}

export function getPackageCategoryName(category) {
  if (category === 'Repair') return 'Mechanical & Electrical Repair';
  if (category === 'PMS') return 'Preventive Maintenance';
  if (category === 'Customization') return 'Customization & Tuning';
  return 'Shop Service Package';
}

export function normalizeServicePackage(item) {
  if (!item) return null;
  const category = item.category || 'PMS';
  const inclusions = parseInclusions(item.inclusions);
  const pricePhp = getPackagePricePhp(item);
  const id = item.service_id || item.id || item.package_id;
  return {
    ...item,
    id,
    service_id: id,
    package_id: item.package_id || id,
    category,
    categoryName: item.categoryName || getPackageCategoryName(category),
    title: item.title || item.name || item.package_name || 'Garage Service Package',
    name: item.name || item.title || item.package_name || 'Garage Service Package',
    subtitle: item.subtitle || 'Professional motorcycle service package',
    price: Number(item.price || 0),
    pricePhp,
    downpaymentPhp: getPackageDownpaymentPhp({ ...item, pricePhp }),
    duration: item.duration || '60 mins',
    badge: item.badge || 'Package',
    icon:
      item.icon ||
      (category === 'Repair' ? 'wrench' : category === 'PMS' ? 'wrench-adjustable' : 'tools'),
    image:
      item.image ||
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    description: item.description || '',
    inclusions,
    status: item.status || 'Active',
    parts_cost: Number(item.parts_cost ?? item.partsCost ?? 0),
    materials_cost: Number(item.materials_cost ?? item.materialsCost ?? 0),
    technician_cost: Number(item.technician_cost ?? item.technicianCost ?? 0),
    other_cost: Number(item.other_cost ?? item.otherCost ?? 0),
    partsCost: Number(item.parts_cost ?? item.partsCost ?? 0),
    materialsCost: Number(item.materials_cost ?? item.materialsCost ?? 0),
    technicianCost: Number(item.technician_cost ?? item.technicianCost ?? 0),
    otherCost: Number(item.other_cost ?? item.otherCost ?? 0),
  };
}

const GARAGE_STORAGE_KEY = 'mototrack_garage_bookings';
const GARAGE_SERVICES_STORAGE_KEY = 'mototrack_garage_services_list';
const GARAGE_MECHANICS_STORAGE_KEY = 'mototrack_garage_mechanics_list';

// Purge any legacy demo bookings from local storage cache immediately
try {
  const savedDemoCheck = storageAdapter.getItem(GARAGE_STORAGE_KEY);
  if (savedDemoCheck) {
    const parsedDemoCheck = JSON.parse(savedDemoCheck);
    if (Array.isArray(parsedDemoCheck)) {
      const demoIds = new Set(['BK-REP-4921', 'BK-PMS-8012', 'BK-REP-3044', 'BK-PMS-1902', 'BK-PMS-3094', 'bk-01', 'BK-REP-VERIFY-1788803844337']);
      const cleanedDemoList = parsedDemoCheck.filter((b) => b && !demoIds.has(String(b.id)) && !demoIds.has(String(b.booking_id)));
      storageAdapter.setItem(GARAGE_STORAGE_KEY, JSON.stringify(cleanedDemoList));
    }
  }
} catch (_e) {}

// Purge any legacy auto-seeded mechanics from local storage cache immediately
try {
  const savedMechsCheck = storageAdapter.getItem(GARAGE_MECHANICS_STORAGE_KEY);
  if (savedMechsCheck) {
    const parsedMechs = JSON.parse(savedMechsCheck);
    if (Array.isArray(parsedMechs)) {
      const autoSeedMechIds = new Set(['tech-jayson', 'tech-mark', 'tech-alvin', 'tech-christian', 'tech-general']);
      const cleanedMechs = parsedMechs.filter((m) => m && !autoSeedMechIds.has(String(m.id)));
      storageAdapter.setItem(GARAGE_MECHANICS_STORAGE_KEY, JSON.stringify(cleanedMechs));
    }
  }
} catch (_e) {}

export const PIT_BAY_PRESETS = [
  'Bay 1 (Master Diagnostic Cell)',
  'Bay 2 (Dynojet 250i Cell)',
  'Bay 3 (Suspension & Alignment Bay)',
  'Bay 4 (Brake & Chassis Bay)',
  'Bay 5 (Express PMS Bay)',
  'Bay 6 (High-Performance Dyno Cell)',
  'Bay 7 (Trackday Superbike Pit)',
];

export const MECHANIC_SPECIALIZATION_PRESETS = [
  'Engine Overhaul & Diagnostics',
  'ECU Dyno & Fuel Mapping',
  'Öhlins & WP Suspension Geometry',
  'Brembo Brake & Hydraulics',
  'PMS & General Fast Turnaround',
  'Superbike Electrical & OBD-II',
  'Track Prep & Desmodromic Valves',
  'Chassis Alignment & Frame Check',
];

export const MECHANIC_AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=300&q=80',
];

const INITIAL_DEMO_BOOKINGS = [];

const serviceListeners = new Set();
const bookingListeners = new Set();

export const garageService = {
  subscribe(callback) {
    if (typeof callback === 'function') {
      serviceListeners.add(callback);
      return () => serviceListeners.delete(callback);
    }
    return () => {};
  },

  subscribeBookings(callback) {
    if (typeof callback === 'function') {
      bookingListeners.add(callback);
      return () => bookingListeners.delete(callback);
    }
    return () => {};
  },

  notifyBookingListeners() {
    bookingListeners.forEach((fn) => {
      try {
        fn(this.getLocalBookings());
      } catch (e) {
        console.warn('Error in garageService booking listener:', e);
      }
    });
  },

  notifyListeners() {
    serviceListeners.forEach((fn) => {
      try {
        fn(this.getServices());
      } catch (e) {
        console.warn('Error in garageService listener:', e);
      }
    });
  },

  // ─── SERVICES CRUD (SUPABASE PRIMARY) ───
  async fetchServices() {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const normalized = data
            .map((item) => normalizeServicePackage(item))
            .filter(Boolean)
            .filter(isActivePackage);

          this.saveServices(normalized);
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Supabase fetchServices note:', e);
    }
    return this.getServices();
  },

  getServices() {
    try {
      const saved = storageAdapter.getItem(GARAGE_SERVICES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => normalizeServicePackage(item)).filter(Boolean);
        }
      }
    } catch (e) {}
    return GARAGE_SERVICES.map((item) => normalizeServicePackage(item));
  },

  getActivePackages(category) {
    const list = this.getServices().filter(isActivePackage);
    if (!category || category === 'All') return list;
    return list.filter((pkg) => String(pkg.category || '').toLowerCase() === String(category).toLowerCase());
  },

  getPackageById(packageId) {
    if (!packageId) return null;
    return (
      this.getServices().find(
        (pkg) => pkg.id === packageId || pkg.service_id === packageId || pkg.package_id === packageId
      ) || null
    );
  },

  saveServices(services) {
    try {
      storageAdapter.setItem(GARAGE_SERVICES_STORAGE_KEY, JSON.stringify(services));
      this.notifyListeners();
    } catch (e) {}
  },

  async addService(serviceData) {
    const services = this.getServices();
    const id = serviceData.id || serviceData.service_id || `pkg-${Date.now()}`;
    const pricePhp = getPackagePricePhp({
      pricePhp: serviceData.pricePhp,
      price: serviceData.price,
    });
    const inclusionsList = parseInclusions(serviceData.inclusions);

    const newService = normalizeServicePackage({
      id,
      service_id: id,
      category: serviceData.category || 'PMS',
      title: serviceData.title || serviceData.name || 'New Service Package',
      subtitle: serviceData.subtitle || 'Professional motorcycle service package',
      price: pricePhp,
      pricePhp,
      duration: serviceData.duration || '60 mins',
      badge: serviceData.badge || 'New Package',
      icon: serviceData.icon,
      image: serviceData.image,
      description: serviceData.description || 'Quality professional motorcycle service package.',
      inclusions: inclusionsList,
      status: 'Active',
    });

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error } = await client.from('services').insert([
          {
            service_id: id,
            name: newService.title,
            category: newService.category,
            subtitle: newService.subtitle,
            price: pricePhp,
            price_php: pricePhp,
            duration: newService.duration,
            badge: newService.badge,
            image: newService.image,
            description: newService.description,
            inclusions: inclusionsList,
            status: 'Active',
          },
        ]);
        if (error) console.warn('Supabase service insert error:', error.message || error);
      }
    } catch (e) {
      console.warn('Supabase service insert error:', e);
    }

    const updated = [newService, ...services.filter((s) => s.id !== id && s.service_id !== id)];
    this.saveServices(updated);
    return newService;
  },

  async updateService(serviceId, updatedData) {
    const services = this.getServices();
    const priceNum = updatedData.price !== undefined ? Number(updatedData.price) : undefined;
    const pricePhp =
      updatedData.pricePhp !== undefined
        ? Number(updatedData.pricePhp)
        : priceNum !== undefined
          ? getPackagePricePhp({ price: priceNum, pricePhp: priceNum })
          : undefined;

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const updatePayload = {
          updated_at: new Date().toISOString(),
        };
        if (updatedData.title) updatePayload.name = updatedData.title;
        if (updatedData.category) updatePayload.category = updatedData.category;
        if (updatedData.subtitle !== undefined) updatePayload.subtitle = updatedData.subtitle;
        if (pricePhp !== undefined) {
          updatePayload.price = pricePhp;
          updatePayload.price_php = pricePhp;
        }
        if (updatedData.duration) updatePayload.duration = updatedData.duration;
        if (updatedData.badge !== undefined) updatePayload.badge = updatedData.badge;
        if (updatedData.image) updatePayload.image = updatedData.image;
        if (updatedData.description !== undefined) updatePayload.description = updatedData.description;
        if (updatedData.inclusions) {
          updatePayload.inclusions = Array.isArray(updatedData.inclusions)
            ? updatedData.inclusions
            : updatedData.inclusions
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
        }
        if (updatedData.parts_cost !== undefined || updatedData.partsCost !== undefined) {
          updatePayload.parts_cost = Number(updatedData.parts_cost ?? updatedData.partsCost ?? 0);
        }
        if (updatedData.materials_cost !== undefined || updatedData.materialsCost !== undefined) {
          updatePayload.materials_cost = Number(
            updatedData.materials_cost ?? updatedData.materialsCost ?? 0
          );
        }
        if (updatedData.technician_cost !== undefined || updatedData.technicianCost !== undefined) {
          updatePayload.technician_cost = Number(
            updatedData.technician_cost ?? updatedData.technicianCost ?? 0
          );
        }
        if (updatedData.other_cost !== undefined || updatedData.otherCost !== undefined) {
          updatePayload.other_cost = Number(updatedData.other_cost ?? updatedData.otherCost ?? 0);
        }

        await client.from('services').update(updatePayload).eq('service_id', serviceId);
      }
    } catch (e) {
      console.warn('Supabase service update error:', e);
    }

    const updated = services.map((s) => {
      if (s.id === serviceId || s.service_id === serviceId) {
        return {
          ...s,
          ...updatedData,
          price: pricePhp !== undefined ? pricePhp : s.price,
          pricePhp: pricePhp !== undefined ? pricePhp : s.pricePhp,
          categoryName:
            (updatedData.category || s.category) === 'Repair'
              ? 'Mechanical & Electrical Repair'
              : (updatedData.category || s.category) === 'PMS'
              ? 'Preventive Maintenance'
              : 'Customization & Tuning',
        };
      }
      return s;
    });
    this.saveServices(updated);
    return updated;
  },

  async deleteService(serviceId) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('services').delete().eq('service_id', serviceId);
      }
    } catch (e) {
      console.warn('Supabase service delete error:', e);
    }

    const services = this.getServices();
    const updated = services.filter((s) => s.id !== serviceId && s.service_id !== serviceId);
    this.saveServices(updated);
    return updated;
  },

  getBranches() {
    return GARAGE_BRANCHES;
  },

  getTimeSlots() {
    return TIME_SLOTS;
  },

  isBookingDateToday(dateStr) {
    if (!dateStr) return false;
    const str = String(dateStr).trim().toLowerCase();
    if (str === 'today') return true;
    const todayIso = new Date().toISOString().split('T')[0];
    if (str === todayIso) return true;
    const bookingDate = new Date(dateStr);
    if (!isNaN(bookingDate.getTime())) {
      const today = new Date();
      return (
        bookingDate.getFullYear() === today.getFullYear() &&
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getDate() === today.getDate()
      );
    }
    return false;
  },

  isTodayFullyBookedOverride() {
    try {
      return storageAdapter.getItem('mototrack_override_today_fully_booked') === 'true';
    } catch (_e) {
      return false;
    }
  },

  setTodayFullyBookedOverride(isOverride) {
    try {
      if (isOverride) {
        storageAdapter.setItem('mototrack_override_today_fully_booked', 'true');
      } else {
        storageAdapter.removeItem('mototrack_override_today_fully_booked');
      }
      this.notifyBookingListeners();
    } catch (_e) {}
  },

  // ─── MECHANICS & TECHNICIANS CRUD (SUPABASE PRIMARY) ───
  async fetchMechanics({ force = false } = {}) {
    return dataCache.fetch(
      CacheKeys.mechanicsList(),
      async () => {
        try {
          const client = supabaseManager.getClient();
          if (client) {
            const autoSeedMechIds = ['tech-jayson', 'tech-mark', 'tech-alvin', 'tech-christian', 'tech-general'];
            try {
              await client.from('mechanics').delete().in('id', autoSeedMechIds);
            } catch (_delErr) {}

            const { data, error } = await client
              .from('mechanics')
              .select(
                'id, name, short_name, specialization, experience, certifications, avatar, bay, status, phone, email, rating, hourly_rate, is_active, user_id, created_at, updated_at'
              )
              .order('created_at', { ascending: true });

            if (!error && Array.isArray(data)) {
              const autoSeedSet = new Set(autoSeedMechIds);
              const nonDemoData = data.filter((item) => item && !autoSeedSet.has(String(item.id)));
              const normalized = nonDemoData.map((item) => ({
                id: item.id,
                name: item.name,
                shortName: item.short_name || (item.name ? item.name.split('(')[0].trim() : 'Pit Tech'),
                specialization: item.specialization || 'Engine Overhaul & Diagnostics',
                experience: item.experience || '5 Years Pro Tech',
                certifications: item.certifications || 'Certified Motorcycle Technician',
                avatar:
                  item.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                bay: item.bay || 'Bay 1 (Master Diagnostic Cell)',
                status: item.status || 'Available',
                phone: item.phone || '',
                email: item.email || '',
                rating: item.rating !== undefined && item.rating !== null ? Number(item.rating) : 5.0,
                hourlyRate: Number(item.hourly_rate ?? 150),
                hourly_rate: Number(item.hourly_rate ?? 150),
                isActive: item.is_active !== false,
                is_active: item.is_active !== false,
                user_id: item.user_id || null,
                userId: item.user_id || null,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
              }));

              this.saveMechanics(normalized);
              return normalized;
            } else if (error) {
              console.warn('Supabase fetchMechanics query note:', error.message || error);
            }
          }
        } catch (e) {
          console.warn('Supabase fetchMechanics error:', e);
        }
        return this.getMechanics();
      },
      { ttlMs: CACHE_TTL.MECHANICS_MS, force, swr: !force }
    );
  },

  async seedInitialMechanics() {
    // Disabled: automatic data for mechanics has been removed per user requirement.
    return [];
  },

  getMechanics() {
    try {
      const saved = storageAdapter.getItem(GARAGE_MECHANICS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const autoSeedMechIds = new Set(['tech-jayson', 'tech-mark', 'tech-alvin', 'tech-christian', 'tech-general']);
          return parsed.filter((m) => m && !autoSeedMechIds.has(String(m.id)));
        }
      }
    } catch (e) {
      console.warn('Error reading mechanics from storage:', e);
    }
    return [];
  },

  saveMechanics(mechanics) {
    try {
      storageAdapter.setItem(GARAGE_MECHANICS_STORAGE_KEY, JSON.stringify(mechanics));
      this.notifyBookingListeners();
      this.notifyListeners();
    } catch (e) {
      console.warn('Error saving mechanics to storage:', e);
    }
  },

  async addMechanic(mechanicData) {
    const list = this.getMechanics();
    const cleanName = (mechanicData.name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Mechanic name is required' };
    }

    const uniqueId =
      mechanicData.id ||
      `tech-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const hourlyRate = Number(
      mechanicData.hourlyRate ?? mechanicData.hourly_rate ?? 150
    );

    const newMechanic = {
      id: uniqueId,
      name: cleanName,
      shortName: mechanicData.shortName?.trim() || cleanName.split('(')[0].trim(),
      specialization: mechanicData.specialization?.trim() || 'Engine Overhaul & Diagnostics',
      experience: mechanicData.experience?.trim() || '5 Years Pro Tech',
      certifications: mechanicData.certifications?.trim() || 'Certified Motorcycle Technician',
      avatar:
        mechanicData.avatar?.trim() ||
        MECHANIC_AVATAR_PRESETS[list.length % MECHANIC_AVATAR_PRESETS.length],
      bay: mechanicData.bay?.trim() || '',
      status: mechanicData.status || 'Available',
      phone: mechanicData.phone?.trim() || '',
      email: mechanicData.email?.trim() || '',
      rating: mechanicData.rating !== undefined ? Number(mechanicData.rating) : 5.0,
      hourlyRate,
      hourly_rate: hourlyRate,
      isActive: mechanicData.isActive !== false && mechanicData.is_active !== false,
      is_active: mechanicData.isActive !== false && mechanicData.is_active !== false,
      createdAt: new Date().toISOString(),
    };

    const updated = [newMechanic, ...list];
    this.saveMechanics(updated);
    dataCache.invalidateMany(mechanicInvalidationKeys(newMechanic.id));

    // Supabase synchronization
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error: supaErr } = await client.from('mechanics').insert([
          {
            id: newMechanic.id,
            name: newMechanic.name,
            short_name: newMechanic.shortName,
            specialization: newMechanic.specialization,
            experience: newMechanic.experience,
            certifications: newMechanic.certifications,
            avatar: newMechanic.avatar,
            bay: newMechanic.bay,
            status: newMechanic.status,
            phone: newMechanic.phone,
            email: newMechanic.email,
            rating: newMechanic.rating,
            hourly_rate: hourlyRate,
            is_active: newMechanic.is_active,
          },
        ]);
        if (supaErr) {
          console.warn('Supabase mechanic insert note:', supaErr.message || supaErr);
        }
      }
    } catch (_supaErr) {
      console.warn('Supabase mechanic insert exception:', _supaErr);
    }

    return { success: true, mechanic: newMechanic };
  },

  async updateMechanic(mechanicId, updateData) {
    const list = this.getMechanics();
    const index = list.findIndex((m) => m.id === mechanicId);
    if (index === -1) {
      return { success: false, error: 'Mechanic not found' };
    }

    const existing = list[index];
    const updatedMech = {
      ...existing,
      ...updateData,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    if (updateData.hourlyRate !== undefined || updateData.hourly_rate !== undefined) {
      const rate = Number(updateData.hourlyRate ?? updateData.hourly_rate);
      updatedMech.hourlyRate = rate;
      updatedMech.hourly_rate = rate;
    }
    if (updateData.isActive !== undefined || updateData.is_active !== undefined) {
      const active = updateData.isActive !== false && updateData.is_active !== false;
      updatedMech.isActive = active;
      updatedMech.is_active = active;
    }

    list[index] = updatedMech;
    this.saveMechanics(list);
    dataCache.invalidateMany(mechanicInvalidationKeys(mechanicId));
    serviceQuotationService.invalidateMechanicCache(mechanicId);

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const updatePayload = {
          name: updatedMech.name,
          short_name: updatedMech.shortName,
          specialization: updatedMech.specialization,
          experience: updatedMech.experience,
          certifications: updatedMech.certifications,
          avatar: updatedMech.avatar,
          bay: updatedMech.bay,
          status: updatedMech.status,
          updated_at: new Date().toISOString(),
        };
        if (updatedMech.phone !== undefined) updatePayload.phone = updatedMech.phone;
        if (updatedMech.email !== undefined) updatePayload.email = updatedMech.email;
        if (updatedMech.rating !== undefined) updatePayload.rating = Number(updatedMech.rating);
        if (updatedMech.hourly_rate !== undefined) {
          updatePayload.hourly_rate = Number(updatedMech.hourly_rate);
        }
        if (updatedMech.is_active !== undefined) {
          updatePayload.is_active = !!updatedMech.is_active;
        }

        const { error: supaErr } = await client
          .from('mechanics')
          .update(updatePayload)
          .eq('id', mechanicId);

        if (supaErr) {
          console.warn('Supabase mechanic update note:', supaErr.message || supaErr);
        }
      }
    } catch (_supaErr) {
      console.warn('Supabase mechanic update exception:', _supaErr);
    }

    return { success: true, mechanic: updatedMech };
  },

  async deleteMechanic(mechanicId) {
    const list = this.getMechanics();
    const filtered = list.filter((m) => m.id !== mechanicId);
    this.saveMechanics(filtered);

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error: supaErr } = await client.from('mechanics').delete().eq('id', mechanicId);
        if (supaErr) {
          console.warn('Supabase mechanic delete note:', supaErr.message || supaErr);
        }
      }
    } catch (_supaErr) {
      console.warn('Supabase mechanic delete exception:', _supaErr);
    }

    return { success: true };
  },

  getAvailableMechanics(targetDate) {
    const isTargetToday = !targetDate || this.isBookingDateToday(targetDate);
    const targetDateStr = targetDate || new Date().toISOString().split('T')[0];

    const allBookings = this.getLocalBookings();
    const activeBookings = allBookings.filter((b) => {
      if (!b || ['Cancelled', 'Declined', 'Completed'].includes(b.status)) return false;
      if (isTargetToday) {
        return this.isBookingDateToday(b.appointment_date || b.date);
      }
      return (b.appointment_date || b.date) === targetDateStr;
    });

    const isOverrideFull = isTargetToday && this.isTodayFullyBookedOverride();

    const roster = this.getMechanics().map((mech, index) => {
      if (isOverrideFull) {
        return {
          ...mech,
          isAvailable: false,
          status: 'In Pit Bay',
          statusColor: '#EF4444',
          assignedBooking: {
            id: `BK-BAY-${index + 1}`,
            service_title: 'Full Overhaul & Performance Tuning',
            customer_name: 'Trackday Rider',
          },
        };
      }

      const matchBooking = activeBookings.find((b) => {
        const assigned = b.mechanic || '';
        return (
          assigned.toLowerCase().includes(mech.id.toLowerCase()) ||
          (mech.shortName && assigned.toLowerCase().includes(mech.shortName.toLowerCase())) ||
          assigned.toLowerCase().includes(mech.name.toLowerCase().split(' ')[0].toLowerCase())
        );
      });

      if (matchBooking) {
        return {
          ...mech,
          isAvailable: false,
          status: 'In Pit Bay',
          statusColor: '#F59E0B',
          assignedBooking: matchBooking,
        };
      }

      return {
        ...mech,
        isAvailable: true,
        status: 'Available',
        statusColor: '#10B981',
        assignedBooking: null,
      };
    });

    const availableCount = roster.filter((m) => m.isAvailable).length;
    const busyCount = roster.filter((m) => !m.isAvailable).length;

    return {
      totalCount: roster.length,
      availableCount,
      busyCount,
      mechanics: roster,
    };
  },

  getDaySlotAvailability(targetDate) {
    const isTargetToday = !targetDate || this.isBookingDateToday(targetDate);
    const targetDateStr = targetDate || new Date().toISOString().split('T')[0];
    const isOverrideFull = isTargetToday && this.isTodayFullyBookedOverride();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const allBookings = this.getLocalBookings();
    const activeBookings = allBookings.filter((b) => {
      if (!b || ['Cancelled', 'Declined', 'Completed'].includes(b.status)) return false;
      if (isTargetToday) {
        return this.isBookingDateToday(b.appointment_date || b.date);
      }
      return (b.appointment_date || b.date) === targetDateStr;
    });

    const slotsData = TIME_SLOTS.map((ts) => {
      if (isOverrideFull) {
        return {
          timeSlot: ts,
          isBooked: true,
          bookingCount: 1,
          status: 'Fully Booked',
          booking: { customer_name: 'Trackday Customer' },
        };
      }

      const matchingBooking = activeBookings.find((b) => (b.time_slot || b.time) === ts);
      return {
        timeSlot: ts,
        isBooked: !!matchingBooking,
        bookingCount: matchingBooking ? 1 : 0,
        status: matchingBooking ? 'Booked' : 'Available',
        booking: matchingBooking || null,
      };
    });

    const bookedSlotsCount = slotsData.filter((s) => s.isBooked).length;
    const totalSlots = TIME_SLOTS.length;
    const availableSlotsCount = isOverrideFull ? 0 : Math.max(0, totalSlots - bookedSlotsCount);
    const isFullyBooked = isOverrideFull || availableSlotsCount === 0;

    return {
      targetDate: targetDateStr,
      isToday: isTargetToday,
      totalSlots,
      bookedSlotsCount: isOverrideFull ? totalSlots : bookedSlotsCount,
      availableSlotsCount,
      isFullyBooked,
      nextAvailableDate: tomorrowStr,
      nextAvailableSlot: '09:00 AM - 10:30 AM (Tomorrow)',
      slots: slotsData,
    };
  },

  // ─── BOOKINGS CRUD (SUPABASE PRIMARY WITH LOCAL MERGE) ───
  async syncBookingToSupabase(booking) {
    try {
      const client = supabaseManager.getClient();
      if (!client) return null;

      const bookingId = booking.id || booking.booking_id;
      if (!bookingId) return null;

      const demoIds = new Set(['BK-REP-4921', 'BK-PMS-8012', 'BK-REP-3044', 'BK-PMS-1902', 'BK-PMS-3094', 'bk-01', 'BK-REP-VERIFY-1788803844337']);
      if (demoIds.has(String(bookingId))) {
        return null;
      }

      // Check if customer exists in Supabase by email or customer_id
      let validCustomerId = null;
      try {
        const customerEmail = booking.customer_email || booking.userEmail;
        if (customerEmail) {
          const { data: custByEmail } = await client
            .from('customers')
            .select('customer_id')
            .eq('email', customerEmail)
            .maybeSingle();
          if (custByEmail?.customer_id) {
            validCustomerId = custByEmail.customer_id;
          }
        }
        if (!validCustomerId && booking.customer_id && booking.customer_id !== 'guest') {
          const { data: custById } = await client
            .from('customers')
            .select('customer_id')
            .eq('customer_id', booking.customer_id)
            .maybeSingle();
          if (custById?.customer_id) {
            validCustomerId = custById.customer_id;
          }
        }
      } catch (_e) {}

      // Keep the selected shop package. Only fall back when no package id exists.
      const requestedServiceId =
        booking.package_id || booking.service_id || booking.serviceId || booking.packageId || null;
      let validServiceId = requestedServiceId || null;
      if (validServiceId) {
        try {
          const { data: svcRow } = await client
            .from('services')
            .select('service_id')
            .eq('service_id', validServiceId)
            .maybeSingle();
          if (!svcRow?.service_id) validServiceId = null;
        } catch (_e) {
          validServiceId = requestedServiceId;
        }
      }

      const packageName =
        booking.package_name ||
        booking.service_title ||
        booking.serviceName ||
        booking.service_title ||
        '';
      const packagePrice = getPackagePricePhp(booking);
      const includedServices = parseInclusions(
        booking.included_services || booking.inclusions || booking.package_inclusions
      );

      // Ensure schedule is a valid ISO timestamp for Supabase timestamptz column
      let scheduleIso = new Date().toISOString();
      const rawDate = booking.appointment_date || booking.date;
      if (rawDate) {
        if (typeof rawDate === 'string' && rawDate.toLowerCase() === 'today') {
          scheduleIso = new Date().toISOString();
        } else if (typeof rawDate === 'string' && rawDate.toLowerCase() === 'tomorrow') {
          const tom = new Date();
          tom.setDate(tom.getDate() + 1);
          scheduleIso = tom.toISOString();
        } else if (typeof rawDate === 'string' && rawDate.toLowerCase() === 'yesterday') {
          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          scheduleIso = yest.toISOString();
        } else {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            scheduleIso = parsed.toISOString();
          }
        }
      }

      // Pack metadata (photos, user email, time_slot, repair_type, appointment_date) into notes trailer
      const rawNotes = (booking.notes || '').trim();
      const meta = {
        time_slot: booking.time_slot || booking.time || '10:30 AM - 12:00 PM',
        photos: Array.isArray(booking.photos) ? booking.photos : [],
        customer_email: booking.customer_email || booking.userEmail || '',
        repair_type: booking.repair_type || '',
        appointment_date: booking.appointment_date || booking.date || 'Today',
      };
      const trailer = `\n__MT_META_START__${JSON.stringify(meta)}__MT_META_END__`;
      const notesToStore = rawNotes.includes('__MT_META_START__') ? rawNotes : `${rawNotes}${trailer}`;

      const payload = {
        booking_id: bookingId,
        customer_id: validCustomerId,
        service_id: validServiceId,
        schedule: scheduleIso,
        bike_brand: booking.bike_brand || booking.bikeBrand || 'Motorcycle',
        bike_model: booking.bike_model || booking.bikeModel || '',
        bike_plate: booking.plate_number || booking.bikePlate || 'TEMP-PLATE',
        bike_odo: booking.odometer || booking.bikeOdo || '',
        plate_number: booking.plate_number || booking.bikePlate || 'TEMP-PLATE',
        odometer: booking.odometer || booking.bikeOdo || '',
        branch_name: booking.branch || 'MotoTrack Flagship Central Hub & Pit Bays',
        branch: booking.branch || 'MotoTrack Flagship Central Hub & Pit Bays',
        mechanic: booking.mechanic || 'Pending Assignment',
        mechanic_id: booking.mechanic_id || booking.mechanicId || null,
        customer_name: booking.customer_name || booking.userName || 'Guest Rider',
        customer_phone: booking.customer_phone || booking.userPhone || '',
        notes: notesToStore,
        price: booking.booking_mode === 'flexible' ? Number(booking.pricePhp || 0) : packagePrice || booking.pricePhp || 2500,
        price_php: booking.booking_mode === 'flexible' ? Number(booking.pricePhp || 0) : packagePrice || booking.pricePhp || 0,
        status: booking.status || 'Pending',
        category: booking.category || 'PMS',
        service_type: booking.service_type || booking.category || 'PMS',
        time_slot: booking.time_slot || booking.time || '10:30 AM - 12:00 PM',
        appointment_date: booking.appointment_date || booking.date || '',
        preferred_date: booking.preferred_date || booking.appointment_date || booking.date || '',
        preferred_time: booking.preferred_time || booking.time_slot || booking.time || '',
        repair_type: booking.repair_type || '',
        package_id: booking.booking_mode === 'flexible' ? null : validServiceId || requestedServiceId,
        package_name: packageName,
        package_price: booking.booking_mode === 'flexible' ? 0 : packagePrice || booking.pricePhp || 0,
        included_services: includedServices,
        estimated_duration: booking.estimated_duration || booking.duration || '',
        service_title: packageName,
        current_stage: booking.current_stage || 'Pending Advisor Review',
        service_progress: booking.service_progress || 0,
        downpayment_amount: booking.downpayment_amount ?? (booking.booking_mode === 'flexible' ? 0 : getPackageDownpaymentPhp(booking)),
        downpayment_ref: booking.downpayment_ref || '',
        downpayment_paid_at: booking.downpayment_paid_at || null,
        downpayment_method: booking.downpayment_method || null,
        downpayment_status: booking.downpayment_status || (booking.booking_mode === 'flexible' ? 'Not Required' : null),
        downpayment_percent: booking.downpayment_percent ?? null,
        downpayment_type: booking.downpayment_type || null,
        remaining_balance: booking.remaining_balance,
        payment_status: booking.payment_status || null,
        amount_paid: booking.amount_paid ?? null,
        booking_mode: booking.booking_mode || 'package',
        problem_description: booking.problem_description || '',
        media_urls: booking.media_urls || booking.photos || [],
        motorcycle_id: booking.motorcycle_id || null,
        user_id: booking.user_id || booking.customer_id || null,
        parts_cost: booking.parts_cost ?? booking.partsCost ?? null,
        materials_cost: booking.materials_cost ?? booking.materialsCost ?? null,
        technician_cost: booking.technician_cost ?? booking.technicianCost ?? null,
        other_cost: booking.other_cost ?? booking.otherCost ?? null,
        total_service_cost:
          booking.total_service_cost ??
          booking.totalServiceCost ??
          (booking.parts_cost != null ||
          booking.materials_cost != null ||
          booking.technician_cost != null ||
          booking.other_cost != null
            ? Number(booking.parts_cost || 0) +
              Number(booking.materials_cost || 0) +
              Number(booking.technician_cost || 0) +
              Number(booking.other_cost || 0)
            : null),
        estimated_labor_hours: booking.estimated_labor_hours ?? null,
        actual_labor_hours: booking.actual_labor_hours ?? null,
        quoted_hourly_rate: booking.quoted_hourly_rate ?? null,
        estimated_labor_cost: booking.estimated_labor_cost ?? null,
        actual_labor_cost: booking.actual_labor_cost ?? null,
        estimated_service_total: booking.estimated_service_total ?? null,
        final_service_total: booking.final_service_total ?? null,
        active_quotation_id: booking.active_quotation_id ?? null,
      };

      const { data, error } = await client
        .from('bookings')
        .upsert([payload], { onConflict: 'booking_id' })
        .select();

      if (!error && data && data.length > 0) {
        console.log('✅ Booking successfully stored in Supabase:', bookingId);
        return data[0];
      } else if (error) {
        console.warn('Supabase booking sync error:', error.message || error);
      }
    } catch (err) {
      console.warn('Exception in syncBookingToSupabase:', err);
    }
    return null;
  },

  getDeletedBookingIds() {
    try {
      const raw = storageAdapter.getItem('mototrack_deleted_bookings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (_e) {}
    return new Set();
  },

  recordDeletedBooking(bookingId) {
    if (!bookingId) return;
    try {
      const set = this.getDeletedBookingIds();
      set.add(String(bookingId));
      storageAdapter.setItem('mototrack_deleted_bookings', JSON.stringify(Array.from(set)));
    } catch (_e) {}
  },

  async fetchBookings(customerId, options = {}) {
    const force = Boolean(options.force);
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(options.pageSize) || 50));
    const cacheKey = customerId
      ? CacheKeys.customerBookings(customerId)
      : CacheKeys.adminBookings(page);

    return dataCache.fetch(
      cacheKey,
      async () => {
    const deletedIds = this.getDeletedBookingIds();
    const demoIds = new Set(['BK-REP-4921', 'BK-PMS-8012', 'BK-REP-3044', 'BK-PMS-1902', 'BK-PMS-3094', 'bk-01', 'BK-REP-VERIFY-1788803844337']);
    try {
      await this.fetchServices();
      const client = supabaseManager.getClient();
      if (client) {
        // Asynchronously delete any lingering demo bookings from the database
        client.from('bookings').delete().in('booking_id', Array.from(demoIds)).then(() => {}).catch(() => {});

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let query = client
          .from('bookings')
          .select(
            'booking_id,customer_id,user_id,service_id,package_id,package_name,package_price,status,notes,bike_brand,bike_model,bike_plate,bike_odo,bike_year,branch_name,customer_name,customer_phone,mechanic_id,mechanic,category,service_type,time_slot,appointment_date,preferred_date,preferred_time,repair_type,estimated_duration,created_at,updated_at,current_stage,approved_by,service_title,booking_mode,problem_description,media_urls,motorcycle_id,estimated_labor_hours,actual_labor_hours,quoted_hourly_rate,estimated_labor_cost,actual_labor_cost,estimated_service_total,final_service_total,downpayment_amount,downpayment_status,downpayment_percent,remaining_balance,amount_paid,payment_status,active_quotation_id,pickup_qr_token,service_progress,customer_email,customer_address,plate_number,odometer,branch,inspection_notes,inspection_started_at,mechanic_assigned_at,mechanic_assignment_status,service_notes,service_started_at,service_completed_at,bike_color,priority,pickup_verified_at,pickup_released_by'
          )
          .order('created_at', { ascending: false })
          .range(customerId ? 0 : from, customerId ? 79 : to);
        if (customerId) {
          query = query.eq('customer_id', customerId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const serviceCatalogTitles = {
            'repair-diag': 'Track Diagnostic & Mechanical Repair',
            'repair-brake': 'Brake System Overhaul & Caliper Repair',
            'repair-engine': 'Engine Top-End & Transmission Troubleshooting',
            'repair-electrical': 'Electrical Diagnostics, Stator & Wire Harness Repair',
            'pms-pro': 'Pro Performance Full PMS',
            'pms-quick': 'Quick PMS Lube & Safety Check',
            'srv-pms-pro': 'Pro Performance Full PMS',
            'srv-pms-basic': 'Quick PMS Lube & Safety Check',
          };

          const catalog = this.getServices();
          const catalogById = new Map(
            catalog.map((pkg) => [pkg.id || pkg.service_id, pkg])
          );

          const normalized = data
            .filter((b) => b && !deletedIds.has(String(b.booking_id)) && !deletedIds.has(String(b.id)) && !demoIds.has(String(b.booking_id)) && !demoIds.has(String(b.id)))
            .map((b) => {
            const catalogPkg = catalogById.get(b.package_id || b.service_id);
            const resolvedTitle =
              b.package_name ||
              b.service_title ||
              catalogPkg?.title ||
              catalogPkg?.name ||
              serviceCatalogTitles[b.service_id] ||
              (b.category === 'Repair'
                ? 'Track Diagnostic & Mechanical Repair'
                : 'PMS Maintenance');
            const includedServices = parseInclusions(b.included_services || catalogPkg?.inclusions);
            const pricePhp = Number(b.package_price || b.price || catalogPkg?.pricePhp || 0) || 2500;

            let cleanNotes = b.notes || '';
            let parsedMeta = {};
            if (cleanNotes.includes('__MT_META_START__')) {
              const parts = cleanNotes.split('__MT_META_START__');
              cleanNotes = parts[0].trim();
              const metaPart = parts[1]?.split('__MT_META_END__')[0];
              if (metaPart) {
                try {
                  parsedMeta = JSON.parse(metaPart);
                } catch (_e) {}
              }
            }

            return {
              id: b.booking_id || b.id,
              booking_id: b.booking_id || b.id,
              customer_id: b.customer_id,
              service_id: b.package_id || b.service_id,
              serviceId: b.package_id || b.service_id,
              package_id: b.package_id || b.service_id,
              package_name: resolvedTitle,
              package_price: pricePhp,
              included_services: includedServices,
              service_title: resolvedTitle,
              serviceName: resolvedTitle,
              servicePrice: pricePhp ? Math.round(pricePhp / 50) : 0,
              pricePhp,
              category:
                b.category ||
                (b.service_id && b.service_id.includes('repair')
                  ? 'Repair'
                  : b.service_id && b.service_id.includes('cust')
                  ? 'Customization'
                  : 'PMS'),
              bike_brand: b.bike_brand || 'Motorcycle',
              bikeBrand: b.bike_brand || 'Motorcycle',
              bike_model: b.bike_model || '',
              bikeModel: b.bike_model || '',
              plate_number: b.bike_plate || 'TEMP-PLATE',
              bikePlate: b.bike_plate || 'TEMP-PLATE',
              odometer: b.bike_odo || '',
              bikeOdo: b.bike_odo || '',
              appointment_date:
                parsedMeta.appointment_date ||
                (b.schedule ? new Date(b.schedule).toLocaleDateString() : 'Scheduled'),
              date:
                parsedMeta.appointment_date ||
                (b.schedule ? new Date(b.schedule).toLocaleDateString() : 'Scheduled'),
              time_slot: parsedMeta.time_slot || '10:30 AM - 12:00 PM',
              time: parsedMeta.time_slot || '10:30 AM - 12:00 PM',
              customer_email: b.customer_email || parsedMeta.customer_email || '',
              userEmail: b.customer_email || parsedMeta.customer_email || '',
              customer_address: b.customer_address || '',
              repair_type: parsedMeta.repair_type || '',
              photos: Array.isArray(parsedMeta.photos) ? parsedMeta.photos : [],
              media_urls: Array.isArray(b.media_urls) ? b.media_urls : (Array.isArray(parsedMeta.photos) ? parsedMeta.photos : []),
              branch: b.branch || b.branch_name || "D'Blockchain Motorparts and Accessories",
              branch_address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
              customer_name: b.customer_name || 'Customer',
              userName: b.customer_name || 'Customer',
              customer_phone: b.customer_phone || '',
              userPhone: b.customer_phone || '',
              status: b.status || 'Pending',
              mechanic: b.mechanic || 'Pending Assignment',
              mechanic_id: b.mechanic_id || null,
              mechanic_assigned_at: b.mechanic_assigned_at || null,
              mechanic_assignment_status: b.mechanic_assignment_status || null,
              notes: cleanNotes,
              created_at: b.created_at || new Date().toISOString(),
              service_progress: b.service_progress || 0,
              additional_estimates: b.additional_estimates || [],
              approved_at: b.approved_at || null,
              approved_by: b.approved_by || null,
              current_stage: b.current_stage || (b.status === 'Pending' ? 'Pending Advisor Review' : ''),
              estimated_duration: b.estimated_duration || catalogPkg?.duration || '',
              downpayment_amount: b.downpayment_amount,
              remaining_balance: b.remaining_balance,
              preferred_date: b.preferred_date || null,
              preferred_time: b.preferred_time || null,
              problem_description: b.problem_description || null,
              booking_mode: b.booking_mode || null,
              service_type: b.service_type || null,
              estimated_labor_hours: b.estimated_labor_hours,
              actual_labor_hours: b.actual_labor_hours,
              quoted_hourly_rate: b.quoted_hourly_rate,
              estimated_labor_cost: b.estimated_labor_cost,
              actual_labor_cost: b.actual_labor_cost,
              estimated_service_total: b.estimated_service_total,
              final_service_total: b.final_service_total,
              amount_paid: b.amount_paid,
              payment_status: b.payment_status,
              downpayment_status: b.downpayment_status,
              downpayment_percent: b.downpayment_percent,
              active_quotation_id: b.active_quotation_id,
              pickup_qr_token: b.pickup_qr_token,
              pickup_verified_at: b.pickup_verified_at,
              pickup_released_by: b.pickup_released_by,
              inspection_notes: b.inspection_notes,
              inspection_started_at: b.inspection_started_at,
              service_notes: b.service_notes,
              service_started_at: b.service_started_at,
              service_completed_at: b.service_completed_at,
              bike_color: b.bike_color,
              bike_year: b.bike_year,
              priority: b.priority || 'Normal',
            };
          });

          // Pure database results saved to local cache (no mock data merged)
          if (!customerId) {
            this.saveLocalBookings(normalized);
          }
          return customerId
            ? normalized.filter((b) => b.customer_id === customerId || b.userId === customerId)
            : normalized;
        }
      }
    } catch (e) {
      console.warn('Supabase fetchBookings error:', e);
    }

    // Fallback safely to local bookings without ever clearing them
    const local = this.getLocalBookings();
    if (customerId) {
      return local.filter((b) => b.customer_id === customerId || b.userId === customerId);
    }
    return local;
      },
      { ttlMs: CACHE_TTL.BOOKING_LIST_MS, force, swr: !force }
    );
  },

  getLocalBookings() {
    try {
      const saved = storageAdapter.getItem(GARAGE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const demoIds = new Set(['BK-REP-4921', 'BK-PMS-8012', 'BK-REP-3044', 'BK-PMS-1902', 'BK-PMS-3094', 'bk-01', 'BK-REP-VERIFY-1788803844337']);
          return parsed.filter((b) => b && !demoIds.has(String(b.id)) && !demoIds.has(String(b.booking_id)));
        }
      }
    } catch (e) {}
    return [];
  },

  saveLocalBookings(bookings) {
    try {
      storageAdapter.setItem(GARAGE_STORAGE_KEY, JSON.stringify(bookings));
      this.notifyBookingListeners();
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('mototrack_bookings_updated', { detail: bookings }));
      }
    } catch (e) {}
  },

  async getAllBookings(options = {}) {
    const force = Boolean(options.force);
    const pageSize = Math.min(100, Math.max(20, Number(options.pageSize) || 100));
    const maxPages = Math.min(20, Math.max(1, Number(options.maxPages) || 10));
    const merged = [];
    const seen = new Set();

    for (let page = 1; page <= maxPages; page += 1) {
      const batch = await this.fetchBookings(null, {
        page,
        pageSize,
        force: force && page === 1,
      });
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const b of batch) {
        const id = String(b?.booking_id || b?.id || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(b);
      }
      if (batch.length < pageSize) break;
    }

    return merged;
  },

  async createBooking(newBookingData) {
    let bookingId = newBookingData.id || newBookingData.booking_id;
    if (!bookingId) {
      const allExisting = await this.getAllBookings();
      bookingId = generateBookingId(newBookingData.category || newBookingData.booking_type || 'PMS', allExisting);
    }

    const defaultBranch = GARAGE_BRANCHES[0] || {
      name: "D'Blockchain Motorparts and Accessories",
      address: 'Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu',
    };

    const customerName =
      newBookingData.customer_name || newBookingData.userName || 'Guest Rider';
    const customerPhone =
      newBookingData.customer_phone || newBookingData.userPhone || '';
    const customerEmail =
      newBookingData.customer_email || newBookingData.userEmail || '';
    const bikeBrand =
      newBookingData.bike_brand || newBookingData.bikeBrand || 'Motorcycle';
    const bikeModel =
      newBookingData.bike_model || newBookingData.bikeModel || '';
    const plateNumber =
      newBookingData.plate_number || newBookingData.bikePlate || 'TEMP-PLATE';
    const odometer =
      newBookingData.odometer || newBookingData.bikeOdo || '';
    const selectedPackage =
      normalizeServicePackage(
        this.getPackageById(newBookingData.package_id || newBookingData.service_id || newBookingData.serviceId) ||
          (newBookingData.package_name || newBookingData.service_title
            ? newBookingData
            : null)
      ) || null;
    const serviceTitle =
      newBookingData.package_name ||
      newBookingData.service_title ||
      newBookingData.serviceName ||
      selectedPackage?.title ||
      (newBookingData.category === 'Repair' ? 'Track Diagnostic & Mechanical Repair' : 'PMS Maintenance');
    const includedServices = parseInclusions(
      newBookingData.included_services || selectedPackage?.inclusions || newBookingData.inclusions
    );
    const packageId =
      newBookingData.package_id ||
      newBookingData.service_id ||
      newBookingData.serviceId ||
      selectedPackage?.id ||
      'repair-diag';

    const isFlexible =
      newBookingData.booking_mode === 'flexible' ||
      newBookingData.bookingMode === 'flexible' ||
      newBookingData.skip_downpayment === true ||
      newBookingData.flexible === true;

    const pricePhp = isFlexible
      ? Number(newBookingData.pricePhp ?? newBookingData.package_price ?? 0)
      : newBookingData.pricePhp ||
        selectedPackage?.pricePhp ||
        (newBookingData.servicePrice ? newBookingData.servicePrice * 50 : 2500);

    // Snapshot service costs at booking time (historical P&L integrity)
    const partsCost = Number(
      newBookingData.parts_cost ?? newBookingData.partsCost ?? selectedPackage?.parts_cost ?? selectedPackage?.partsCost ?? 0
    );
    const materialsCost = Number(
      newBookingData.materials_cost ??
        newBookingData.materialsCost ??
        selectedPackage?.materials_cost ??
        selectedPackage?.materialsCost ??
        0
    );
    const technicianCost = Number(
      newBookingData.technician_cost ??
        newBookingData.technicianCost ??
        selectedPackage?.technician_cost ??
        selectedPackage?.technicianCost ??
        0
    );
    const otherCost = Number(
      newBookingData.other_cost ?? newBookingData.otherCost ?? selectedPackage?.other_cost ?? selectedPackage?.otherCost ?? 0
    );
    const totalServiceCost = partsCost + materialsCost + technicianCost + otherCost;

    const downpaymentPercent = isFlexible ? 0 : 20;
    const downpaymentAmount = isFlexible
      ? 0
      : newBookingData.downpayment_amount !== undefined
        ? Number(newBookingData.downpayment_amount)
        : Math.round(pricePhp * 0.2);
    const remainingBalance = isFlexible
      ? 0
      : newBookingData.remaining_balance !== undefined
        ? Number(newBookingData.remaining_balance)
        : Math.max(0, pricePhp - downpaymentAmount);
    const downpaymentRef = isFlexible
      ? null
      : newBookingData.downpayment_ref ||
        newBookingData.payment_reference ||
        `DP-${Math.floor(100000 + Math.random() * 900000)}`;

    const initialStatus = isFlexible
      ? newBookingData.status || FLEX_BOOKING_STATUS.PENDING_REVIEW
      : newBookingData.status || 'Pending';

    const booking = {
      id: bookingId,
      booking_id: bookingId,
      booking_mode: isFlexible ? 'flexible' : newBookingData.booking_mode || 'package',
      status: initialStatus,
      created_at: newBookingData.created_at || new Date().toISOString(),
      createdAt: newBookingData.createdAt || new Date().toISOString(),
      mechanic: newBookingData.mechanic || 'Pending Assignment',
      mechanic_id: newBookingData.mechanic_id || newBookingData.mechanicId || null,
      branch: newBookingData.branch || defaultBranch.name,
      branch_address: defaultBranch.address,
      category: newBookingData.category || selectedPackage?.category || 'Repair',
      service_type: newBookingData.service_type || newBookingData.category || selectedPackage?.category || 'Repair',
      service_id: isFlexible ? null : packageId,
      serviceId: isFlexible ? null : packageId,
      package_id: isFlexible ? null : packageId,
      package_name: serviceTitle,
      package_price: isFlexible ? 0 : pricePhp,
      included_services: includedServices,
      estimated_duration: newBookingData.estimated_duration || selectedPackage?.duration || '',
      service_title: serviceTitle,
      serviceName: serviceTitle,
      servicePrice: isFlexible ? 0 : newBookingData.servicePrice || Math.round(pricePhp / 50),
      pricePhp: isFlexible ? 0 : pricePhp,
      problem_description:
        newBookingData.problem_description || newBookingData.problemDescription || newBookingData.notes || '',
      media_urls: Array.isArray(newBookingData.media_urls)
        ? newBookingData.media_urls
        : Array.isArray(newBookingData.photos)
          ? newBookingData.photos
          : [],
      motorcycle_id: newBookingData.motorcycle_id || newBookingData.motorcycleId || null,
      preferred_date:
        newBookingData.preferred_date ||
        newBookingData.appointment_date ||
        newBookingData.date ||
        new Date().toISOString().split('T')[0],
      preferred_time: newBookingData.preferred_time || newBookingData.time_slot || newBookingData.time || '',
      parts_cost: partsCost,
      materials_cost: materialsCost,
      technician_cost: technicianCost,
      other_cost: otherCost,
      total_service_cost: totalServiceCost,
      partsCost,
      materialsCost,
      technicianCost,
      otherCost,
      totalServiceCost,
      downpayment_required: !isFlexible,
      downpayment_percent: downpaymentPercent,
      downpayment_amount: downpaymentAmount,
      downpayment_paid: isFlexible
        ? false
        : newBookingData.downpayment_paid !== undefined
          ? newBookingData.downpayment_paid
          : true,
      downpayment_status: isFlexible ? 'Not Required' : newBookingData.downpayment_status || 'Paid',
      downpayment_ref: downpaymentRef,
      downpayment_paid_at: isFlexible ? null : newBookingData.downpayment_paid_at || new Date().toISOString(),
      downpayment_method: isFlexible ? null : newBookingData.downpayment_method || 'GCash',
      remaining_balance: remainingBalance,
      payment_status: isFlexible ? 'Unpaid' : 'DOWNPAYMENT_PAID',
      amount_paid: isFlexible ? 0 : downpaymentAmount,
      is_non_refundable: !isFlexible,
      non_refundable_policy_acknowledged: !isFlexible,
      refund_status: isFlexible ? 'N/A' : 'Non-refundable',
      customer_name: customerName,
      userName: customerName,
      customer_phone: customerPhone,
      userPhone: customerPhone,
      customer_email: customerEmail,
      userEmail: customerEmail,
      customer_id: newBookingData.customer_id || newBookingData.userId || null,
      bike_brand: bikeBrand,
      bikeBrand: bikeBrand,
      bike_model: bikeModel,
      bikeModel: bikeModel,
      plate_number: plateNumber,
      bikePlate: plateNumber,
      odometer: odometer,
      bikeOdo: odometer,
      appointment_date:
        newBookingData.appointment_date || newBookingData.date || new Date().toISOString().split('T')[0],
      date: newBookingData.appointment_date || newBookingData.date || new Date().toISOString().split('T')[0],
      time_slot: newBookingData.time_slot || newBookingData.time || '09:00 AM',
      time: newBookingData.time_slot || newBookingData.time || '09:00 AM',
      notes: newBookingData.notes || newBookingData.problem_description || '',
      photos: Array.isArray(newBookingData.photos) ? newBookingData.photos : [],
      service_progress: newBookingData.service_progress || 0,
      current_stage: isFlexible
        ? 'Pending advisor review • No price required until inspection quotation'
        : `20% Downpayment Verified (₱${downpaymentAmount.toLocaleString()}) • Pending Advisor Review`,
      additional_estimates: [],
      ...newBookingData,
      booking_mode: isFlexible ? 'flexible' : newBookingData.booking_mode || 'package',
      package_id: isFlexible ? null : packageId,
      package_name: serviceTitle,
      package_price: isFlexible ? 0 : pricePhp,
      included_services: includedServices,
      service_id: isFlexible ? null : packageId,
      serviceId: isFlexible ? null : packageId,
      service_title: serviceTitle,
      serviceName: serviceTitle,
      pricePhp: isFlexible ? 0 : pricePhp,
      status: initialStatus,
      downpayment_required: !isFlexible,
      downpayment_paid: isFlexible
        ? false
        : newBookingData.downpayment_paid !== undefined
          ? newBookingData.downpayment_paid
          : true,
      downpayment_status: isFlexible ? 'Not Required' : newBookingData.downpayment_status || 'Paid',
      downpayment_amount: downpaymentAmount,
    };

    // 1. Save locally and notify immediately for instant UI reactivity
    const current = this.getLocalBookings();
    const filteredCurrent = current.filter((b) => b.id !== bookingId && b.booking_id !== bookingId);
    const updated = [booking, ...filteredCurrent];
    this.saveLocalBookings(updated);
    dataCache.invalidateMany(bookingInvalidationKeys(bookingId, booking.customer_id));

    // 2. Persist directly to Supabase
    await this.syncBookingToSupabase(booking);

    // 3. Push Notification to Customer
    try {
      if (notificationService?.addNotification) {
        notificationService.addNotification({
          user_id: newBookingData.customer_id || 'guest',
          title: isFlexible
            ? 'Service Booking Submitted'
            : 'Pit Bay Booking Reserved (20% Downpayment Paid)',
          message: isFlexible
            ? `Your booking #${bookingId} for ${booking.service_title} was submitted for review. Pricing follows after inspection and quotation — no payment required yet.`
            : `Your booking #${bookingId} for ${booking.service_title} is pending admin approval. ₱${downpaymentAmount.toLocaleString()} downpayment received. We'll notify you once a technician is assigned.`,
          type: 'booking',
          link: 'bookings',
        });
      }
      if (notificationService?.notifyAdminNewBooking) {
        notificationService.notifyAdminNewBooking({
          bookingId,
          customerName: booking.customer_name,
          serviceType: booking.service_title,
          vehicleModel: `${booking.bike_brand || ''} ${booking.bike_model || ''}`.trim() || 'Motorcycle',
          date: booking.preferred_date || booking.appointment_date || 'Scheduled Date',
          timeSlot: booking.preferred_time || booking.time_slot || 'Pit Bay Slot',
        });
      }
      if (auditLogService?.logGarageAction) {
        auditLogService.logGarageAction({
          action: 'BOOKING_CREATED',
          target: `Booking #${bookingId}`,
          details: `New ${booking.booking_mode} appointment booked by ${booking.customer_name} for ${booking.service_title} (${booking.bike_brand || ''} ${booking.bike_model || ''}).`,
          severity: 'INFO',
          metadata: {
            bookingId,
            customer: booking.customer_name,
            service: booking.service_title,
            mode: booking.booking_mode,
          },
        });
      }
    } catch (_e) {}

    try {
      await bookingTimelineService.append({
        bookingId,
        eventType: TIMELINE_EVENTS.BOOKING_CREATED,
        description: 'Booking Created',
        actorId: booking.customer_id,
        actorRole: BOOKING_ROLES.CUSTOMER,
        fromStatus: null,
        toStatus: initialStatus,
        metadata: {
          service_type: booking.service_type || booking.category,
          motorcycle_id: booking.motorcycle_id,
        },
      });
    } catch (_e) {}

    return booking;
  },

  async addBooking(bookingData) {
    return this.createBooking(bookingData);
  },

  // ─── WORKSHOP LIFECYCLE ACTIONS ───

  // 1. Advisor Approves → Payment Required (flexible) or Confirmed (package legacy).
  // Mechanic assignment happens AFTER downpayment (CONFIRMED → SCHEDULED).
  async approveBooking(bookingId, mechanicName, opts = {}) {
    const local = this.getLocalBookings().find(
      (b) => b.id === bookingId || b.booking_id === bookingId
    );
    const flexible = isFlexibleBooking(local) || opts.flexible === true;
    const assignedMech =
      mechanicName && !String(mechanicName).toLowerCase().includes('pending')
        ? mechanicName
        : opts.mechanicName || local?.mechanic || 'Pending Assignment';
    const mechanicId = opts.mechanicId || opts.mechanic_id || local?.mechanic_id || null;
    const hasMechanic = Boolean(mechanicId) || (assignedMech && !String(assignedMech).toLowerCase().includes('pending'));

    let patch = {
      mechanic: assignedMech,
      mechanic_id: mechanicId,
      mechanic_assigned_at: hasMechanic ? new Date().toISOString() : null,
      mechanic_assignment_status: hasMechanic ? 'assigned' : 'unassigned',
      approved_at: new Date().toISOString(),
      approved_by: opts.approvedBy || 'admin',
    };

    if (flexible) {
      const serviceType =
        opts.serviceType ||
        local?.service_type ||
        local?.category ||
        local?.package_name ||
        'Other';
      const defaults = getServiceEstimateDefaults(serviceType);
      const estimatedCost = roundMoney(
        Number(
          opts.estimatedServiceCost ??
            opts.estimated_service_total ??
            local?.estimated_service_total ??
            defaults.estimatedCost
        )
      );
      const dpPercent = Number(
        opts.downpaymentPercent ??
          opts.downpayment_percent ??
          local?.downpayment_percent ??
          defaults.downpaymentPercent
      );
      const { downpaymentAmount, remainingBalance } = calcDownpayment({
        totalAmount: estimatedCost,
        downpaymentType: 'percent',
        downpaymentPercent: dpPercent,
      });
      const deadline =
        opts.paymentDeadline ||
        opts.payment_deadline ||
        calcPaymentDeadline(new Date(), opts.deadlineHours);

      patch = {
        ...patch,
        status: FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT,
        estimated_service_total: estimatedCost,
        downpayment_required: true,
        downpayment_percent: dpPercent,
        downpayment_amount: downpaymentAmount,
        remaining_balance: remainingBalance,
        downpayment_status: 'Required',
        payment_deadline: deadline,
        skip_downpayment: false,
        current_stage: `Approved — downpayment ${formatPhp(downpaymentAmount)} required`,
      };
    } else {
      patch = {
        ...patch,
        status: 'Confirmed',
        current_stage: `Appointment Confirmed • Assigned to ${assignedMech}`,
      };
    }

    const updated = await this.updateBooking(bookingId, patch);

    try {
      notificationService?.addNotification?.({
        user_id: local?.customer_id || local?.user_id || 'guest',
        title: flexible ? 'Booking Approved' : 'Service Booking Confirmed!',
        message: flexible
          ? `Your booking #${bookingId} was approved. A downpayment of ${formatPhp(patch.downpayment_amount)} is required before scheduling.`
          : `Your appointment #${bookingId} has been confirmed. Master Tech ${assignedMech} is assigned to your motorcycle. Please bring your bike on the scheduled time.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    try {
      await bookingTimelineService.append({
        bookingId,
        eventType: TIMELINE_EVENTS.BOOKING_APPROVED,
        description: flexible
          ? `Booking approved — downpayment ${formatPhp(patch.downpayment_amount)} required`
          : 'Booking Approved',
        actorId: opts.approvedBy || 'admin',
        actorRole: BOOKING_ROLES.ADMIN,
        fromStatus: local?.status,
        toStatus: flexible ? FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT : 'Confirmed',
        metadata: flexible
          ? {
              estimated_service_total: patch.estimated_service_total,
              downpayment_amount: patch.downpayment_amount,
              downpayment_percent: patch.downpayment_percent,
              payment_deadline: patch.payment_deadline,
            }
          : {},
      });
    } catch (_e) {}

    return updated;
  },

  /**
   * Expire unpaid downpayment bookings past payment_deadline.
   * Releases the reserved preferred slot (status becomes terminal).
   */
  async expireUnpaidDownpayments({ now = new Date() } = {}) {
    const cutoff = new Date(now).getTime();
    const all = this.getLocalBookings() || [];
    const expired = [];
    for (const b of all) {
      const status = normalizeBookingStatus(b.status);
      if (status !== FLEX_BOOKING_STATUS.AWAITING_DOWNPAYMENT) continue;
      const deadline = b.payment_deadline ? new Date(b.payment_deadline).getTime() : null;
      if (!deadline || !Number.isFinite(deadline) || deadline > cutoff) continue;
      const id = b.booking_id || b.id;
      const updated = await this.updateBooking(id, {
        status: FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
        current_stage: 'Booking expired — downpayment deadline passed; slot released',
      });
      try {
        await bookingTimelineService.append({
          bookingId: id,
          eventType: TIMELINE_EVENTS.BOOKING_CANCELLED,
          description: 'Booking expired — payment deadline missed',
          actorRole: BOOKING_ROLES.SYSTEM,
          fromStatus: b.status,
          toStatus: FLEX_BOOKING_STATUS.BOOKING_EXPIRED,
        });
      } catch (_e) {}
      try {
        notificationService?.addNotification?.({
          user_id: b.customer_id || b.user_id || 'guest',
          title: 'Booking Expired',
          message: `Booking #${id} expired because the downpayment deadline was missed. Please book again if you still need service.`,
          type: 'booking',
          link: 'bookings',
        });
      } catch (_e) {}
      expired.push(updated);
    }
    return expired;
  },

  /**
   * Check mechanic schedule overlap.
   * Returns conflicting bookings if any.
   */
  async checkMechanicAvailability(mechanicId, appointmentStart, durationMinutes, { excludeBookingId } = {}) {
    if (!mechanicId || !appointmentStart) {
      return { available: true, conflicts: [] };
    }
    const duration = Math.max(15, Number(durationMinutes || 60));
    const endIso = appointmentEnd(appointmentStart, duration);
    const all = await this.fetchBookings({ force: true }).catch(() => this.getLocalBookings());
    const conflicts = (all || []).filter((b) => {
      if (excludeBookingId && (b.booking_id === excludeBookingId || b.id === excludeBookingId)) {
        return false;
      }
      if (String(b.mechanic_id) !== String(mechanicId)) return false;
      if (isTerminalBookingStatus(b.status)) return false;
      const otherStart =
        b.appointment_start ||
        (b.preferred_date || b.appointment_date
          ? `${String(b.preferred_date || b.appointment_date).slice(0, 10)}T09:00:00`
          : null);
      if (!otherStart) return false;
      const otherDur = Number(b.estimated_duration_minutes || 60);
      const otherEnd = appointmentEnd(otherStart, otherDur);
      return intervalsOverlap(appointmentStart, endIso, otherStart, otherEnd);
    });
    return { available: conflicts.length === 0, conflicts };
  },

  /** Flexible workflow: assign mechanic and move CONFIRMED → SCHEDULED (after downpayment). */
  async assignMechanicToBooking(bookingId, mechanic, opts = {}) {
    const local = this.getLocalBookings().find(
      (b) => b.id === bookingId || b.booking_id === bookingId
    );
    const mechName = mechanic?.name || mechanic || opts.mechanicName;
    const mechId = mechanic?.id || opts.mechanicId || null;
    if (!mechName) throw new Error('Mechanic required');

    const appointmentStart =
      opts.appointmentStart ||
      opts.appointment_start ||
      (() => {
        const dateStr = opts.preferredDate || local?.preferred_date || local?.appointment_date;
        if (!dateStr) return local?.appointment_start || null;
        const day = String(dateStr).slice(0, 10);
        const rawTime = String(opts.startTime || opts.preferredTime || '09:00').trim();
        // Accept HH:MM or fall back to 09:00 when slot labels like "10:30 AM - 12:00 PM"
        const hm = rawTime.match(/^(\d{1,2}):(\d{2})/);
        let hours = 9;
        let mins = 0;
        if (hm) {
          hours = Number(hm[1]);
          mins = Number(hm[2]);
          if (/pm/i.test(rawTime) && hours < 12) hours += 12;
          if (/am/i.test(rawTime) && hours === 12) hours = 0;
        }
        return `${day}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
      })();
    const durationMinutes = Number(
      opts.estimatedDurationMinutes ?? opts.estimated_duration_minutes ?? local?.estimated_duration_minutes ?? 90
    );

    if (mechId && appointmentStart) {
      const avail = await this.checkMechanicAvailability(mechId, appointmentStart, durationMinutes, {
        excludeBookingId: bookingId,
      });
      if (!avail.available) {
        const conflictIds = avail.conflicts.map((b) => b.booking_id || b.id).join(', ');
        throw new Error(`Mechanic unavailable — overlaps with ${conflictIds}`);
      }
    }

    const normalized = normalizeBookingStatus(local?.status);
    const canScheduleFrom =
      normalized === FLEX_BOOKING_STATUS.CONFIRMED ||
      normalized === FLEX_BOOKING_STATUS.APPROVED ||
      normalized === FLEX_BOOKING_STATUS.SCHEDULED;
    const shouldSchedule = opts.schedule !== false && canScheduleFrom;

    const bay = opts.serviceBay || opts.service_bay || opts.bay || local?.service_bay || null;

    const patch = {
      mechanic: mechName,
      mechanic_id: mechId,
      mechanic_assigned_at: new Date().toISOString(),
      mechanic_assignment_status: 'assigned',
      assigned_by: opts.assignedBy || opts.assigned_by || 'admin',
      current_stage: `Scheduled • Assigned to ${mechName}${bay ? ` • ${bay}` : ''}`,
    };
    if (bay) patch.service_bay = bay;
    if (appointmentStart) {
      patch.appointment_start = appointmentStart;
      patch.preferred_date = String(appointmentStart).slice(0, 10);
      patch.appointment_date = String(appointmentStart).slice(0, 10);
      if (opts.startTime || opts.preferredTime) {
        patch.preferred_time = opts.startTime || opts.preferredTime;
        patch.time_slot = opts.startTime || opts.preferredTime;
      }
    }
    if (durationMinutes) patch.estimated_duration_minutes = durationMinutes;
    if (shouldSchedule) {
      patch.status = FLEX_BOOKING_STATUS.SCHEDULED;
    }

    const updated = await this.updateBooking(bookingId, patch);
    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.MECHANIC_ASSIGNED,
      description: `Mechanic assigned: ${mechName}`,
      actorId: opts.assignedBy || 'admin',
      actorRole: BOOKING_ROLES.ADMIN,
      fromStatus: local?.status,
      toStatus: patch.status || local?.status,
      metadata: { mechanic_id: mechId, appointment_start: appointmentStart, durationMinutes },
    });
    if (patch.status === FLEX_BOOKING_STATUS.SCHEDULED) {
      await bookingTimelineService.append({
        bookingId,
        eventType: TIMELINE_EVENTS.APPOINTMENT_SCHEDULED,
        description: `Appointment scheduled${appointmentStart ? ` for ${appointmentStart}` : ''}`,
        actorId: opts.assignedBy || 'admin',
        actorRole: BOOKING_ROLES.ADMIN,
        fromStatus: local?.status,
        toStatus: FLEX_BOOKING_STATUS.SCHEDULED,
      });
    }
    try {
      notificationService?.addNotification?.({
        user_id: local?.customer_id || local?.user_id || 'guest',
        title: 'Mechanic Assigned',
        message: `Technician ${mechName} was assigned to booking #${bookingId}.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}
    return updated;
  },

  async requestBookingInfo(bookingId, notes) {
    const local = this.getLocalBookings().find(
      (b) => b.id === bookingId || b.booking_id === bookingId
    );
    const msg = String(notes || '').trim() || 'Please provide more details about the issue.';
    const updated = await this.updateBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.NEEDS_INFORMATION,
      info_request_notes: msg,
      current_stage: `Info requested: ${msg.slice(0, 80)}`,
    });
    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.NEEDS_INFORMATION,
      description: msg,
      actorRole: BOOKING_ROLES.ADMIN,
      fromStatus: local?.status,
      toStatus: FLEX_BOOKING_STATUS.NEEDS_INFORMATION,
    });
    try {
      notificationService?.addNotification?.({
        user_id: local?.customer_id || local?.user_id || 'guest',
        title: 'More Information Needed',
        message: `For booking #${bookingId}: ${msg}`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}
    return updated;
  },

  /** Customer replies to NEEDS_INFORMATION → back to PENDING_REVIEW */
  async provideBookingInformation(bookingId, reply, { customerId } = {}) {
    const local = this.getLocalBookings().find(
      (b) => b.id === bookingId || b.booking_id === bookingId
    );
    const text = String(reply || '').trim();
    if (!text) throw new Error('Please provide the requested information');
    const updated = await this.updateBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.PENDING_REVIEW,
      notes: `${local?.notes || ''}\n\n[Customer reply]: ${text}`.trim(),
      info_request_notes: null,
      current_stage: 'Customer provided information • Pending admin review',
    });
    await bookingTimelineService.append({
      bookingId,
      eventType: TIMELINE_EVENTS.INFORMATION_PROVIDED,
      description: text,
      actorId: customerId,
      actorRole: BOOKING_ROLES.CUSTOMER,
      fromStatus: local?.status,
      toStatus: FLEX_BOOKING_STATUS.PENDING_REVIEW,
    });
    return updated;
  },

  /** Flexible workflow: CONFIRMED → SERVICE_IN_PROGRESS with customer notification */
  async startService(bookingId, opts = {}) {
    const local = this.getLocalBookings().find(
      (b) => b.id === bookingId || b.booking_id === bookingId
    );
    const updated = await this.updateBooking(bookingId, {
      status: FLEX_BOOKING_STATUS.SERVICE_IN_PROGRESS,
      service_started_at: new Date().toISOString(),
      service_progress: 25,
      current_stage: `Service started${local?.mechanic ? ` • ${local.mechanic}` : ''}`,
    });
    try {
      notificationService?.addNotification?.({
        user_id: local?.customer_id || local?.user_id || 'guest',
        title: 'Service Started',
        message: `Work on your motorcycle for booking #${bookingId} has started. We'll notify you if anything else needs your approval.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}
    return updated;
  },

  async rescheduleBooking(bookingId, { preferredDate, preferredTime } = {}) {
    if (!preferredDate && !preferredTime) throw new Error('Date or time required');
    const updated = await this.updateBooking(bookingId, {
      ...(preferredDate
        ? {
            preferred_date: preferredDate,
            appointment_date: preferredDate,
            date: preferredDate,
          }
        : {}),
      ...(preferredTime
        ? {
            preferred_time: preferredTime,
            time_slot: preferredTime,
            time: preferredTime,
          }
        : {}),
      current_stage: `Rescheduled to ${preferredDate || ''} ${preferredTime || ''}`.trim(),
    });
    try {
      const local = this.getLocalBookings().find(
        (b) => b.id === bookingId || b.booking_id === bookingId
      );
      notificationService?.addNotification?.({
        user_id: local?.customer_id || local?.user_id || 'guest',
        title: 'Schedule Updated',
        message: `Booking #${bookingId} was rescheduled to ${preferredDate || local?.preferred_date || ''} ${preferredTime || local?.preferred_time || ''}`.trim() + '.',
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}
    return updated;
  },

  // 2. Advisor Rejects with Reason
  async rejectBooking(bookingId, reason) {
    const local = this.getLocalBookings().find(
      (b) => b.id === bookingId || b.booking_id === bookingId
    );
    const flexible = isFlexibleBooking(local);
    const updated = await this.updateBooking(bookingId, {
      status: flexible ? FLEX_BOOKING_STATUS.REJECTED : 'Rejected',
      rejection_reason: reason || 'Service bay fully occupied at requested time slot.',
      rejection_notes: reason || '',
      current_stage: `Declined: ${reason || 'Schedule Conflict'}`,
    });

    try {
      notificationService?.addNotification?.({
        user_id: local?.customer_id || 'guest',
        title: 'Service Booking Update',
        message: `Your appointment #${bookingId} could not be confirmed. Reason: ${reason || 'Schedule Conflict'}. Please reschedule another slot.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  // 3. Customer Brings Bike -> Inspection -> Status: Checked In / Inspection
  async checkInBooking(bookingId, inspectionNotes = '') {
    const updated = await this.updateBooking(bookingId, {
      status: 'Inspection',
      inspection_started_at: new Date().toISOString(),
      inspection_notes: inspectionNotes || 'Motorcycle received at Pit Bay. Master technician performing multi-point safety scan.',
      current_stage: 'Initial Technician Multi-Point Inspection in Progress',
      service_progress: 15,
    });

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
        title: 'Motorcycle Checked In',
        message: `Motorcycle #${bookingId} is in Pit Bay 1. Initial technician diagnostic and multi-point inspection is underway.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  // 4. Mechanic Finds Additional Problems -> Status: Estimate Pending
  async addInspectionEstimate(bookingId, estimateItem) {
    const current = this.getLocalBookings();
    let updatedBooking = null;

    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const estimates = Array.isArray(b.additional_estimates) ? [...b.additional_estimates] : [];
        const newEst = {
          id: 'est-' + Math.floor(1000 + Math.random() * 9000),
          title: estimateItem.title || 'Additional Component Replacement',
          description: estimateItem.description || 'Discovered during teardown inspection.',
          amount: Number(estimateItem.amount || 0),
          status: 'pending', // 'pending' | 'approved' | 'declined'
          created_at: new Date().toISOString(),
        };
        estimates.push(newEst);

        updatedBooking = {
          ...b,
          status: 'Estimate Pending',
          additional_estimates: estimates,
          current_stage: `Inspection Finding: ${newEst.title} (₱${newEst.amount.toLocaleString()}) - Awaiting Rider Approval`,
        };
        return updatedBooking;
      }
      return b;
    });

    this.saveLocalBookings(updated);

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
        title: 'Additional Work Estimate Required',
        message: `Technician discovered a necessary repair for #${bookingId}: ${estimateItem.title} (+₱${Number(estimateItem.amount || 0).toLocaleString()}). Tap to review & approve.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  // 5. Customer Approves or Declines Additional Estimate
  async respondToEstimate(bookingId, estimateId, approved) {
    const current = this.getLocalBookings();
    let updatedBooking = null;

    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const estimates = (b.additional_estimates || []).map((est) => {
          if (est.id === estimateId) {
            return { ...est, status: approved ? 'approved' : 'declined' };
          }
          return est;
        });

        // Calculate total approved additional amounts
        const additionalTotal = estimates
          .filter((e) => e.status === 'approved')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const basePrice = Number(b.pricePhp || b.service_price || b.price || 0);
        const newTotalPrice = basePrice + additionalTotal;

        updatedBooking = {
          ...b,
          status: 'In Progress',
          additional_estimates: estimates,
          total_price_with_estimates: newTotalPrice,
          service_progress: Math.max(30, b.service_progress || 30),
          current_stage: approved
            ? `Estimate Approved • Additional Work Authorized • Service in Progress`
            : `Estimate Declined • Proceeding with Base Scheduled Service Only`,
        };
        return updatedBooking;
      }
      return b;
    });

    this.saveLocalBookings(updated);

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
        title: approved ? 'Estimate Approved' : 'Estimate Declined',
        message: approved
          ? `You approved the additional service for #${bookingId}. Technicians have proceeded with full repairs.`
          : `You declined additional service for #${bookingId}. Technicians are continuing standard package work only.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  // 6. No Extra Problems Found -> Continue Base Service
  async continueScheduledService(bookingId) {
    return this.updateBooking(bookingId, {
      status: 'In Progress',
      service_progress: 35,
      current_stage: 'No Additional Faults • Standard Scheduled Service in Progress',
    });
  },

  // 7. Update Service Execution Progress (25% -> 50% -> 75% -> 100%)
  async updateServiceProgress(bookingId, progressPercent, stageDescription, notes) {
    const isDone = progressPercent >= 100;
    const newStatus = isDone ? 'Service Done' : 'In Progress';

    const updated = await this.updateBooking(bookingId, {
      status: newStatus,
      service_progress: progressPercent,
      current_stage: stageDescription || (isDone ? 'Quality Check & Test Ride Passed' : 'Active Mechanical Work'),
      ...(notes && { notes }),
      ...(isDone && {
        quality_checked_at: new Date().toISOString(),
        quality_checked_by: 'Inspector Chief Ramon',
      }),
    });

    if (isDone) {
      try {
        notificationService?.addNotification?.({
          user_id: 'guest',
          title: 'Service Complete • Ready for Pickup!',
          message: `All repairs & maintenance for Ticket #${bookingId} have passed quality assurance. Please visit the hub to settle final bill and claim your bike.`,
          type: 'booking',
          link: 'bookings',
        });
      } catch (_e) {}
    }

    return updated;
  },

  // 8. Settle Final Bill & Process Payment
  async processBookingPayment(bookingId, paymentData = {}) {
    const current = this.getLocalBookings();
    let updatedBooking = null;

    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const base = Number(b.pricePhp || b.service_price || b.price || 0);
        const downpayment = Number(
          b.downpayment_paid ? (b.downpayment_amount !== undefined ? b.downpayment_amount : Math.round(base * 0.20)) : 0
        );
        const additional = (b.additional_estimates || [])
          .filter((e) => e.status === 'approved')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const remainingDue = Math.max(0, (base - downpayment) + additional);
        const finalTotal = paymentData.amount !== undefined ? Number(paymentData.amount) : remainingDue;

        const billing = {
          base_amount: base,
          downpayment_credited: downpayment,
          additional_amount: additional,
          final_amount: finalTotal,
          payment_method: paymentData.paymentMethod || 'Cash',
          reference_number: paymentData.referenceNumber || 'PAY-' + Math.floor(100000 + Math.random() * 900000),
          paid_at: new Date().toISOString(),
          status: 'Paid',
        };

        updatedBooking = {
          ...b,
          status: 'Paid',
          billing,
          remaining_balance: 0,
          current_stage: `Bill Settled (₱${finalTotal.toLocaleString()} via ${billing.payment_method}${downpayment > 0 ? ` after ₱${downpayment.toLocaleString()} downpayment credit` : ''}) • Ready for Release`,
        };
        return updatedBooking;
      }
      return b;
    });

    this.saveLocalBookings(updated);

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
        title: 'Payment Received & Verified',
        message: `Payment of ₱${Number(paymentData.amount || 0).toLocaleString()} for Ticket #${bookingId} is confirmed. Official invoice receipt generated.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  // 9. Release Motorcycle & Close Booking -> Issues Report & Next PMS Reminder
  async releaseMotorcycle(bookingId, releaseNotes = '') {
    const current = this.getLocalBookings();
    let updatedBooking = null;

    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const rawOdo = parseInt(String(b.odometer || '0').replace(/[^0-9]/g, ''), 10) || 5000;
        const nextOdo = (rawOdo + 3000).toLocaleString() + ' km';

        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 3);
        const nextDateStr = nextDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const serviceReport = {
          completed_at: new Date().toISOString(),
          diagnosis_summary: b.notes || 'Full diagnostic and manufacturer recommended procedure completed.',
          work_performed: `${b.service_title || 'Service'} executed by certified technicians. 20-point torque check, fluid flush, and ECU health scan.`,
          replaced_components: [
            b.service_title,
            ...(b.additional_estimates || [])
              .filter((e) => e.status === 'approved')
              .map((e) => e.title),
          ],
          mechanic_signoff: b.mechanic || 'Assigned Technician',
          quality_inspector: b.quality_checked_by || 'Inspector Chief Ramon',
          warranty: '30-Day / 1,000 km MotoTrack Craftsmanship Guarantee',
          release_notes: releaseNotes || 'Motorcycle test ridden and released in peak condition.',
        };

        const nextPmsDue = {
          date: `${nextDateStr} (in 3 months)`,
          mileage: `${nextOdo} (+3,000 km)`,
        };

        updatedBooking = {
          ...b,
          status: 'Closed',
          released_at: new Date().toISOString(),
          service_report: serviceReport,
          next_pms_due: nextPmsDue,
          current_stage: `Booking Closed • Motorcycle Released • Service Report Generated`,
        };
        return updatedBooking;
      }
      return b;
    });

    this.saveLocalBookings(updated);

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
        title: 'Motorcycle Released • Safe Riding!',
        message: `Ticket #${bookingId} is closed. Your Service Report and Next PMS Reminder (${updatedBooking?.next_pms_due?.date}) have been filed in your profile.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  async updateBookingStatus(bookingId, status, mechanic, notes) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const updatePayload = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (mechanic) updatePayload.mechanic = mechanic;
        if (notes !== undefined) updatePayload.notes = notes;

        await client.from('bookings').update(updatePayload).eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase updateBookingStatus error:', e);
    }

    const current = this.getLocalBookings();
    let completedItem = null;
    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const item = {
          ...b,
          status,
          ...(mechanic && { mechanic }),
          ...(notes !== undefined && { notes }),
        };
        if (status === 'Completed') completedItem = item;
        return item;
      }
      return b;
    });
    this.saveLocalBookings(updated);

    if (completedItem && notificationService?.notifyAdminServiceCompleted) {
      try {
        notificationService.notifyAdminServiceCompleted({
          bookingId,
          customerName: completedItem.customer_name,
          mechanicName: mechanic || completedItem.mechanic || 'Lead Pit Mechanic',
          serviceTitle: completedItem.service_title || 'Service / PMS Package',
          vehiclePlate: completedItem.plate_number || completedItem.bike_plate || 'Motorcycle',
        });
      } catch (_e) {}
    }

    if (auditLogService?.logGarageAction) {
      try {
        auditLogService.logGarageAction({
          action: status === 'Completed' ? 'SERVICE_COMPLETED' : 'BOOKING_STATUS_CHANGED',
          target: `Booking #${bookingId}`,
          details: `Booking #${bookingId} status changed to "${status}"${mechanic ? ` (Assigned: ${mechanic})` : ''}.${notes ? ` Notes: ${notes}` : ''}`,
          severity: status === 'Completed' ? 'SUCCESS' : 'INFO',
          metadata: { bookingId, status, mechanic, notes },
        });
      } catch (_e) {}
    }

    return updated;
  },

  async updateBooking(bookingId, updatedFields) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const updatePayload = {
          updated_at: new Date().toISOString(),
          ...(updatedFields.status && { status: updatedFields.status }),
          ...(updatedFields.mechanic && { mechanic: updatedFields.mechanic }),
          ...(updatedFields.notes !== undefined && { notes: updatedFields.notes }),
          ...(updatedFields.bike_brand && { bike_brand: updatedFields.bike_brand }),
          ...(updatedFields.bike_model && { bike_model: updatedFields.bike_model }),
          ...(updatedFields.plate_number && { bike_plate: updatedFields.plate_number }),
          ...(updatedFields.odometer && { bike_odo: updatedFields.odometer }),
          ...(updatedFields.branch && { branch_name: updatedFields.branch }),
          ...(updatedFields.customer_name && { customer_name: updatedFields.customer_name }),
          ...(updatedFields.customer_phone && { customer_phone: updatedFields.customer_phone }),
          ...(updatedFields.service_price !== undefined && { price: updatedFields.service_price }),
          ...(updatedFields.pricePhp !== undefined && { price: updatedFields.pricePhp, package_price: updatedFields.pricePhp }),
          ...(updatedFields.package_id && { package_id: updatedFields.package_id, service_id: updatedFields.package_id }),
          ...(updatedFields.package_name && { package_name: updatedFields.package_name, service_title: updatedFields.package_name }),
          ...(updatedFields.service_title && { service_title: updatedFields.service_title, package_name: updatedFields.service_title }),
          ...(updatedFields.approved_at && { approved_at: updatedFields.approved_at }),
          ...(updatedFields.approved_by && { approved_by: updatedFields.approved_by }),
          ...(updatedFields.current_stage && { current_stage: updatedFields.current_stage }),
          ...(updatedFields.appointment_date && { appointment_date: updatedFields.appointment_date }),
          ...(updatedFields.time_slot && { time_slot: updatedFields.time_slot }),
          ...(updatedFields.mechanic_id !== undefined && { mechanic_id: updatedFields.mechanic_id }),
          ...(updatedFields.service_progress !== undefined && {
            service_progress: updatedFields.service_progress,
          }),
          ...(updatedFields.service_started_at && {
            service_started_at: updatedFields.service_started_at,
          }),
          ...(updatedFields.service_completed_at && {
            service_completed_at: updatedFields.service_completed_at,
          }),
          ...(updatedFields.rejection_reason && {
            rejection_reason: updatedFields.rejection_reason,
          }),
          ...(updatedFields.rejection_notes && {
            rejection_notes: updatedFields.rejection_notes,
          }),
          ...(updatedFields.estimated_labor_hours !== undefined && {
            estimated_labor_hours: updatedFields.estimated_labor_hours,
          }),
          ...(updatedFields.actual_labor_hours !== undefined && {
            actual_labor_hours: updatedFields.actual_labor_hours,
          }),
          ...(updatedFields.inspection_notes !== undefined && {
            inspection_notes: updatedFields.inspection_notes,
          }),
          ...(updatedFields.inspection_started_at && {
            inspection_started_at: updatedFields.inspection_started_at,
          }),
          ...(updatedFields.mechanic_assigned_at !== undefined && {
            mechanic_assigned_at: updatedFields.mechanic_assigned_at,
          }),
          ...(updatedFields.mechanic_assignment_status !== undefined && {
            mechanic_assignment_status: updatedFields.mechanic_assignment_status,
          }),
          ...(updatedFields.service_notes !== undefined && {
            service_notes: updatedFields.service_notes,
          }),
          ...(updatedFields.preferred_date && { preferred_date: updatedFields.preferred_date }),
          ...(updatedFields.preferred_time && { preferred_time: updatedFields.preferred_time }),
          ...(updatedFields.info_request_notes !== undefined && {
            info_request_notes: updatedFields.info_request_notes,
          }),
        };

        await client.from('bookings').update(updatePayload).eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase updateBooking error:', e);
    }

    const current = this.getLocalBookings();
    let updatedCompleted = null;
    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const item = {
          ...b,
          ...updatedFields,
        };
        if (updatedFields.status === 'Completed' || (item.status === 'Completed' && b.status !== 'Completed')) {
          updatedCompleted = item;
        }
        return item;
      }
      return b;
    });
    this.saveLocalBookings(updated);
    dataCache.invalidateMany(
      bookingInvalidationKeys(bookingId, updated.find((b) => b.id === bookingId || b.booking_id === bookingId)?.customer_id)
    );

    if (updatedCompleted && notificationService?.notifyAdminServiceCompleted) {
      try {
        notificationService.notifyAdminServiceCompleted({
          bookingId,
          customerName: updatedCompleted.customer_name,
          mechanicName: updatedCompleted.mechanic || 'Lead Pit Mechanic',
          serviceTitle: updatedCompleted.service_title || 'Service / PMS Package',
          vehiclePlate: updatedCompleted.plate_number || updatedCompleted.bike_plate || 'Motorcycle',
        });
      } catch (_e) {}
    }

    return updated;
  },

  async deleteBooking(bookingId) {
    if (!bookingId) return this.getLocalBookings();

    // 1. Identify all matching IDs (both id and booking_id)
    const current = this.getLocalBookings();
    const target = current.find((b) => b && (b.id === bookingId || b.booking_id === bookingId));
    const targetId = target?.id || bookingId;
    const targetBookingId = target?.booking_id || bookingId;

    // 2. Mark in deleted tombstones set so it will NEVER be re-pushed to Supabase
    this.recordDeletedBooking(bookingId);
    this.recordDeletedBooking(targetId);
    this.recordDeletedBooking(targetBookingId);

    // 3. Remove from local bookings storage immediately
    const updated = current.filter(
      (b) =>
        b &&
        b.id !== bookingId &&
        b.booking_id !== bookingId &&
        b.id !== targetId &&
        b.booking_id !== targetBookingId
    );
    this.saveLocalBookings(updated);

    // 4. Delete directly from Supabase
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const idToDelete = targetBookingId || targetId || bookingId;
        console.log('🗑️ Deleting booking from Supabase:', idToDelete);
        const { error, data } = await client
          .from('bookings')
          .delete()
          .eq('booking_id', idToDelete)
          .select();

        if (error) {
          console.warn('Supabase deleteBooking error:', error.message || error);
        } else {
          console.log('✅ Successfully deleted booking from Supabase:', idToDelete, data);
        }

        // Also purge by alternative key if different
        if (targetId && targetId !== idToDelete) {
          await client.from('bookings').delete().eq('booking_id', targetId);
        }
        if (bookingId && bookingId !== idToDelete && bookingId !== targetId) {
          await client.from('bookings').delete().eq('booking_id', bookingId);
        }
      }
    } catch (e) {
      console.warn('Exception during Supabase deleteBooking:', e);
    }

    return updated;
  },

  async cancelBooking(bookingId, reason = 'Customer cancelled appointment') {
    const current = this.getLocalBookings();
    let updatedBooking = null;
    const existing = current.find((b) => b.id === bookingId || b.booking_id === bookingId);
    const flexible = isFlexibleBooking(existing);
    // Flexible bookings only forfeit if a downpayment was actually paid
    const noChargeCancel = flexible && Number(existing?.amount_paid || 0) <= 0;
    const newStatus = flexible ? FLEX_BOOKING_STATUS.CANCELLED : 'Cancelled';

    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const dpAmount = Number(
          b.amount_paid ||
            (b.downpayment_amount !== undefined ? b.downpayment_amount : Math.round((b.pricePhp || 2500) * 0.2))
        );
        updatedBooking = noChargeCancel
          ? {
              ...b,
              status: newStatus,
              cancellation_reason: reason,
              current_stage: 'Service request cancelled by customer',
              updated_at: new Date().toISOString(),
            }
          : {
              ...b,
              status: newStatus,
              cancellation_reason: reason,
              downpayment_status: 'Forfeited (Non-refundable policy applied)',
              refund_status: 'Non-refundable (Forfeited)',
              current_stage: `Appointment Cancelled • ₱${dpAmount.toLocaleString()} Downpayment Forfeited (Non-Refundable Policy)`,
              updated_at: new Date().toISOString(),
            };
        return updatedBooking;
      }
      return b;
    });

    this.saveLocalBookings(updated);

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client
          .from('bookings')
          .update({
            status: newStatus,
            notes: noChargeCancel
              ? `${reason} | cancelled before payment`
              : `${reason} | downpayment forfeited (non-refundable)`,
            current_stage: updatedBooking?.current_stage || 'Cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase cancelBooking error:', e);
    }
    try {
      dataCache.invalidateMany(bookingInvalidationKeys(bookingId, updatedBooking?.customer_id));
    } catch (_e) {}

    try {
      if (notificationService?.addNotification) {
        notificationService.addNotification({
          user_id: updatedBooking?.customer_id || 'guest',
          title: noChargeCancel ? 'Service Request Cancelled' : 'Pit Bay Booking Cancelled (Downpayment Forfeited)',
          message: noChargeCancel
            ? `Your service request #${bookingId} has been cancelled. No payment was charged.`
            : `Your appointment #${bookingId} has been cancelled. In accordance with our anti-fake booking policy, the advance downpayment is non-refundable.`,
          type: 'booking',
          link: 'bookings',
        });
      }
      if (notificationService?.notifyAdminBookingCancelled) {
        notificationService.notifyAdminBookingCancelled({
          bookingId,
          customerName: updatedBooking?.customer_name || 'Customer',
          serviceType: updatedBooking?.service_title || 'Pitstop Service',
          reason,
        });
      }
      if (auditLogService?.logGarageAction) {
        auditLogService.logGarageAction({
          action: 'BOOKING_CANCELLED',
          target: `Booking #${bookingId}`,
          details: `Booking #${bookingId} was cancelled (${reason}). Pit bay slot returned to queue.`,
          severity: 'WARNING',
          metadata: { bookingId, reason, customer: updatedBooking?.customer_name },
        });
      }
    } catch (_e) {}

    return updated;
  },

  async rescheduleBooking(bookingId, newDate, newSlot) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client
          .from('bookings')
          .update({
            rescheduled_at: new Date().toISOString(),
            status: 'Confirmed',
          })
          .eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase reschedule error:', e);
    }

    const current = this.getLocalBookings();
    const updated = current.map((b) =>
      b.id === bookingId || b.booking_id === bookingId
        ? {
            ...b,
            appointment_date: newDate,
            time_slot: newSlot,
            status: 'Confirmed',
          }
        : b
    );
    this.saveLocalBookings(updated);
    return updated;
  },

  getUserBookings(userEmail, userId, userName) {
    const all = this.getLocalBookings();
    if (!userEmail && !userId && !userName) return [];
    const normUserEmail = userEmail ? String(userEmail).trim().toLowerCase() : null;
    const normUserId = userId ? String(userId).trim() : null;
    const normUserName = userName ? String(userName).trim().toLowerCase() : null;

    return all.filter((b) => {
      if (!b) return false;
      const bEmail = (b.customer_email || b.userEmail || '').trim().toLowerCase();
      const bId = String(b.customer_id || b.userId || '').trim();
      const bName = (b.customer_name || b.userName || '').trim().toLowerCase();

      const emailMatch = normUserEmail && bEmail && bEmail === normUserEmail;
      const idMatch = normUserId && bId && bId === normUserId;
      const nameMatch = !normUserEmail && normUserName && bName && bName === normUserName;

      return Boolean(emailMatch || idMatch || nameMatch);
    });
  },
};
