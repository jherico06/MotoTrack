// Garage & Service Booking Service for MotoTrack (PMS & Customization)
import { storageAdapter } from './storageAdapter.js';
import { supabaseManager } from './supabaseClient.js';
import { usdToPhp } from '../utils/currency.js';
import { notificationService } from './notificationService.js';
import { auditLogService } from './auditLogService.js';

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
  { id: 'PMS', label: 'Preventive Maintenance (PMS)', icon: 'wrench-adjustable', color: '#0C6258', bg: '#D1ECE6' },
];

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

export const AVAILABLE_MECHANICS = [
  {
    id: 'tech-jayson',
    name: 'Master Tech Jayson (Yamaha & Honda Certified)',
    shortName: 'Master Tech Jayson',
    specialization: 'Engine Overhaul & Diagnostics',
    experience: '9 Years Pro Tech',
    certifications: 'Yamaha YTA Gold • Honda Master',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    bay: 'Bay 1 (Master Diagnostic Cell)',
  },
  {
    id: 'tech-mark',
    name: 'Senior Dyno Tech Mark',
    shortName: 'Senior Tech Mark',
    specialization: 'ECU Dyno & Fuel Mapping',
    experience: '7 Years Dyno Tuner',
    certifications: 'Dynojet Certified • Akrapovič Tech',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    bay: 'Bay 2 (Dynojet 250i Cell)',
  },
  {
    id: 'tech-alvin',
    name: 'Tech Alvin (Suspension Specialist)',
    shortName: 'Tech Alvin',
    specialization: 'Öhlins & WP Suspension Geometry',
    experience: '6 Years Track Suspension',
    certifications: 'Öhlins Certified Service Center',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    bay: 'Bay 3 (Suspension & Alignment Bay)',
  },
  {
    id: 'tech-christian',
    name: 'Tech Christian (Brembo Brake Specialist)',
    shortName: 'Tech Christian',
    specialization: 'Hydraulics & Calipers',
    experience: '5 Years Hydraulic Specialist',
    certifications: 'Brembo Track System Certified',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
    bay: 'Bay 4 (Brake & Chassis Bay)',
  },
  {
    id: 'tech-general',
    name: 'MotoTrack Assigned Specialist',
    shortName: 'Tech Noel & Team',
    specialization: 'PMS & General Maintenance',
    experience: '4 Years Fast-Turnaround PMS',
    certifications: 'Liqui-Moly / Motul Certified Hub',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
    bay: 'Bay 5 (Express PMS Bay)',
  },
];

export const GARAGE_BRANCHES = [
  {
    id: 'central-naga',
    name: 'MotoTrack Flagship Central Hub & Pit Bays',
    address: 'East Poblacion, City of Naga, Cebu (South Road Corridor)',
    bays: '6 Dedicated Pit Bays • Dynojet Tuning Cell • Master Tech Bay',
    phone: '(+63) 917 882 9102 / (032) 489-2100',
    hours: 'Mon - Sun: 8:00 AM - 6:30 PM',
  },
];

export const TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 12:00 PM',
  '01:30 PM - 03:00 PM',
  '03:00 PM - 04:30 PM',
  '04:30 PM - 06:00 PM',
];

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
          const normalized = data.map((item) => ({
            id: item.service_id || item.id,
            service_id: item.service_id || item.id,
            category: item.category || 'PMS',
            categoryName:
              item.category === 'Repair'
                ? 'Mechanical & Electrical Repair'
                : item.category === 'PMS'
                ? 'Preventive Maintenance'
                : 'Customization & Tuning',
            title: item.name || item.title || 'Garage Service',
            subtitle: item.subtitle || 'Professional Motorcycle Service',
            price: Number(item.price || 0),
            pricePhp: item.price_php ? Number(item.price_php) : usdToPhp(item.price || 0),
            duration: item.duration || '60 mins',
            badge: item.badge || 'Popular',
            icon:
              item.category === 'Repair'
                ? 'wrench'
                : item.category === 'PMS'
                ? 'wrench-adjustable'
                : 'tools',
            image:
              item.image ||
              'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
            description: item.description || '',
            inclusions: Array.isArray(item.inclusions)
              ? item.inclusions
              : typeof item.inclusions === 'string'
                ? JSON.parse(item.inclusions || '[]')
                : [],
          }));

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
          return parsed;
        }
      }
    } catch (e) {}
    return GARAGE_SERVICES;
  },

  saveServices(services) {
    try {
      storageAdapter.setItem(GARAGE_SERVICES_STORAGE_KEY, JSON.stringify(services));
      this.notifyListeners();
    } catch (e) {}
  },

  async addService(serviceData) {
    const services = this.getServices();
    const id = serviceData.id || `srv-${Date.now()}`;
    const priceNum = Number(serviceData.price) || 0;
    const pricePhp = serviceData.pricePhp || usdToPhp(priceNum);
    const inclusionsList = Array.isArray(serviceData.inclusions)
      ? serviceData.inclusions
      : (serviceData.inclusions || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

    const newService = {
      id,
      service_id: id,
      category: serviceData.category || 'PMS',
      categoryName:
        serviceData.category === 'Repair'
          ? 'Mechanical & Electrical Repair'
          : serviceData.category === 'PMS'
          ? 'Preventive Maintenance'
          : 'Customization & Tuning',
      title: serviceData.title || 'New Garage Service',
      subtitle: serviceData.subtitle || 'Professional Motorcycle Service',
      price: priceNum,
      pricePhp,
      duration: serviceData.duration || '60 mins',
      badge: serviceData.badge || 'New Service',
      icon:
        serviceData.icon ||
        (serviceData.category === 'Repair'
          ? 'wrench'
          : serviceData.category === 'PMS'
          ? 'wrench-adjustable'
          : 'tools'),
      image:
        serviceData.image ||
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
      description: serviceData.description || 'Quality professional motorcycle service and maintenance.',
      inclusions: inclusionsList,
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('services').insert([
          {
            service_id: id,
            name: newService.title,
            category: newService.category,
            subtitle: newService.subtitle,
            price: newService.price,
            price_php: newService.pricePhp,
            duration: newService.duration,
            badge: newService.badge,
            image: newService.image,
            description: newService.description,
            inclusions: inclusionsList,
            status: 'active',
          },
        ]);
      }
    } catch (e) {
      console.warn('Supabase service insert error:', e);
    }

    const updated = [newService, ...services];
    this.saveServices(updated);
    return newService;
  },

  async updateService(serviceId, updatedData) {
    const services = this.getServices();
    const priceNum = updatedData.price !== undefined ? Number(updatedData.price) : undefined;
    const pricePhp = priceNum !== undefined ? usdToPhp(priceNum) : undefined;

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const updatePayload = {
          updated_at: new Date().toISOString(),
        };
        if (updatedData.title) updatePayload.name = updatedData.title;
        if (updatedData.category) updatePayload.category = updatedData.category;
        if (updatedData.subtitle !== undefined) updatePayload.subtitle = updatedData.subtitle;
        if (priceNum !== undefined) {
          updatePayload.price = priceNum;
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
          price: priceNum !== undefined ? priceNum : s.price,
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
  async fetchMechanics() {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('mechanics')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const normalized = data.map((item) => ({
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
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          }));

          this.saveMechanics(normalized);
          return normalized;
        } else if (!error && Array.isArray(data) && data.length === 0) {
          // Table exists in Supabase but has no mechanics yet; auto-seed default roster
          await this.seedInitialMechanics();
          return this.getMechanics();
        } else if (error) {
          console.warn('Supabase fetchMechanics query note:', error.message || error);
        }
      }
    } catch (e) {
      console.warn('Supabase fetchMechanics error:', e);
    }
    return this.getMechanics();
  },

  async seedInitialMechanics() {
    try {
      const client = supabaseManager.getClient();
      if (!client) return;

      const seedRows = AVAILABLE_MECHANICS.map((mech) => ({
        id: mech.id,
        name: mech.name,
        short_name: mech.shortName || mech.name.split('(')[0].trim(),
        specialization: mech.specialization,
        experience: mech.experience,
        certifications: mech.certifications,
        avatar: mech.avatar,
        bay: mech.bay,
        status: 'Available',
        rating: 5.0,
      }));

      const { error } = await client
        .from('mechanics')
        .upsert(seedRows, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase seedInitialMechanics error:', error.message || error);
      } else {
        this.saveMechanics(AVAILABLE_MECHANICS);
      }
    } catch (err) {
      console.warn('Error during mechanics auto-seed:', err);
    }
  },

  getMechanics() {
    try {
      const saved = storageAdapter.getItem(GARAGE_MECHANICS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading mechanics from storage:', e);
    }
    return AVAILABLE_MECHANICS;
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
      bay: mechanicData.bay?.trim() || `Bay ${list.length + 1} (General Pit Bay)`,
      status: mechanicData.status || 'Available',
      phone: mechanicData.phone?.trim() || '',
      email: mechanicData.email?.trim() || '',
      rating: mechanicData.rating !== undefined ? Number(mechanicData.rating) : 5.0,
      createdAt: new Date().toISOString(),
    };

    const updated = [newMechanic, ...list];
    this.saveMechanics(updated);

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

    list[index] = updatedMech;
    this.saveMechanics(list);

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

      // Resolve valid service_id in Supabase
      const validServiceId =
        booking.service_id && (booking.service_id.startsWith('repair-') || booking.service_id.startsWith('pms-') || booking.service_id.startsWith('srv-'))
          ? booking.service_id
          : booking.category === 'Repair'
          ? 'repair-diag'
          : 'srv-pms-pro';

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
        branch_name: booking.branch || 'MotoTrack Flagship Central Hub & Pit Bays',
        mechanic: booking.mechanic || 'Pending Assignment',
        customer_name: booking.customer_name || booking.userName || 'Guest Rider',
        customer_phone: booking.customer_phone || booking.userPhone || '',
        notes: notesToStore,
        price: booking.pricePhp || 2500,
        status: booking.status || 'Pending',
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

  async fetchBookings(customerId) {
    const deletedIds = this.getDeletedBookingIds();
    const demoIds = new Set(['BK-REP-4921', 'BK-PMS-8012', 'BK-REP-3044', 'BK-PMS-1902', 'BK-PMS-3094', 'bk-01', 'BK-REP-VERIFY-1788803844337']);
    try {
      const client = supabaseManager.getClient();
      if (client) {
        // Asynchronously delete any lingering demo bookings from the database
        client.from('bookings').delete().in('booking_id', Array.from(demoIds)).then(() => {}).catch(() => {});

        let query = client.from('bookings').select('*').order('created_at', { ascending: false });
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

          const normalized = data
            .filter((b) => b && !deletedIds.has(String(b.booking_id)) && !deletedIds.has(String(b.id)) && !demoIds.has(String(b.booking_id)) && !demoIds.has(String(b.id)))
            .map((b) => {
            const resolvedTitle =
              serviceCatalogTitles[b.service_id] ||
              (b.category === 'Repair'
                ? 'Track Diagnostic & Mechanical Repair'
                : 'PMS Maintenance');

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
              service_id: b.service_id,
              serviceId: b.service_id,
              service_title: resolvedTitle,
              serviceName: resolvedTitle,
              servicePrice: b.price ? Math.round(b.price / 50) : 0,
              pricePhp: b.price || 2500,
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
              customer_email: parsedMeta.customer_email || '',
              userEmail: parsedMeta.customer_email || '',
              repair_type: parsedMeta.repair_type || '',
              photos: Array.isArray(parsedMeta.photos) ? parsedMeta.photos : [],
              branch: b.branch_name || 'MotoTrack Flagship Central Hub & Pit Bays',
              branch_address: 'East Poblacion, City of Naga, Cebu',
              customer_name: b.customer_name || 'Customer',
              userName: b.customer_name || 'Customer',
              customer_phone: b.customer_phone || '',
              userPhone: b.customer_phone || '',
              status: b.status || 'Pending',
              mechanic: b.mechanic || 'Pending Assignment',
              notes: cleanNotes,
              created_at: b.created_at || new Date().toISOString(),
              service_progress: b.service_progress || 0,
              additional_estimates: b.additional_estimates || [],
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
    if (customerId) {
      return local.filter((b) => b.customer_id === customerId || b.userId === customerId);
    }
    return local;
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

  async getAllBookings() {
    return this.fetchBookings();
  },

  async createBooking(newBookingData) {
    const catPrefix =
      newBookingData.category === 'Repair'
        ? 'REP'
        : newBookingData.category === 'PMS'
        ? 'PMS'
        : 'CUST';

    const bookingId =
      newBookingData.id ||
      newBookingData.booking_id ||
      'BK-' + catPrefix + '-' + Math.floor(10000 + Math.random() * 90000);

    const defaultBranch = GARAGE_BRANCHES[0] || {
      name: 'MotoTrack Flagship Central Hub & Pit Bays',
      address: 'East Poblacion, City of Naga, Cebu',
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
    const serviceTitle =
      newBookingData.service_title ||
      newBookingData.serviceName ||
      (newBookingData.category === 'Repair' ? 'Track Diagnostic & Mechanical Repair' : 'PMS Maintenance');
    const pricePhp =
      newBookingData.pricePhp ||
      (newBookingData.servicePrice ? newBookingData.servicePrice * 50 : 2500);

    const downpaymentPercent = 20;
    const downpaymentAmount =
      newBookingData.downpayment_amount !== undefined
        ? Number(newBookingData.downpayment_amount)
        : Math.round(pricePhp * 0.20);
    const remainingBalance =
      newBookingData.remaining_balance !== undefined
        ? Number(newBookingData.remaining_balance)
        : Math.max(0, pricePhp - downpaymentAmount);
    const downpaymentRef =
      newBookingData.downpayment_ref ||
      newBookingData.payment_reference ||
      `DP-${Math.floor(100000 + Math.random() * 900000)}`;

    const booking = {
      id: bookingId,
      booking_id: bookingId,
      status: newBookingData.status || 'Pending', // Initial status is PENDING per diagram
      created_at: newBookingData.created_at || new Date().toISOString(),
      createdAt: newBookingData.createdAt || new Date().toISOString(),
      mechanic: newBookingData.mechanic || 'Pending Assignment',
      branch: newBookingData.branch || defaultBranch.name,
      branch_address: defaultBranch.address,
      category: newBookingData.category || 'Repair',
      service_id: newBookingData.service_id || newBookingData.serviceId || 'repair-diag',
      serviceId: newBookingData.service_id || newBookingData.serviceId || 'repair-diag',
      service_title: serviceTitle,
      serviceName: serviceTitle,
      servicePrice: newBookingData.servicePrice || Math.round(pricePhp / 50),
      pricePhp: pricePhp,
      // 20% Non-Refundable Downpayment Meta
      downpayment_required: true,
      downpayment_percent: downpaymentPercent,
      downpayment_amount: downpaymentAmount,
      downpayment_paid: newBookingData.downpayment_paid !== undefined ? newBookingData.downpayment_paid : true,
      downpayment_status: newBookingData.downpayment_status || 'Paid',
      downpayment_ref: downpaymentRef,
      downpayment_paid_at: newBookingData.downpayment_paid_at || new Date().toISOString(),
      downpayment_method: newBookingData.downpayment_method || 'GCash',
      remaining_balance: remainingBalance,
      is_non_refundable: true,
      non_refundable_policy_acknowledged: true,
      refund_status: 'Non-refundable',
      customer_name: customerName,
      userName: customerName,
      customer_phone: customerPhone,
      userPhone: customerPhone,
      customer_email: customerEmail,
      userEmail: customerEmail,
      bike_brand: bikeBrand,
      bikeBrand: bikeBrand,
      bike_model: bikeModel,
      bikeModel: bikeModel,
      plate_number: plateNumber,
      bikePlate: plateNumber,
      odometer: odometer,
      bikeOdo: odometer,
      appointment_date: newBookingData.appointment_date || newBookingData.date || new Date().toISOString().split('T')[0],
      date: newBookingData.appointment_date || newBookingData.date || new Date().toISOString().split('T')[0],
      time_slot: newBookingData.time_slot || newBookingData.time || '09:00 AM',
      time: newBookingData.time_slot || newBookingData.time || '09:00 AM',
      notes: newBookingData.notes || '',
      photos: Array.isArray(newBookingData.photos) ? newBookingData.photos : [],
      service_progress: newBookingData.service_progress || 0,
      current_stage: `20% Downpayment Verified (₱${downpaymentAmount.toLocaleString()}) • Pending Advisor Review`,
      additional_estimates: [],
      ...newBookingData,
    };

    // 1. Save locally and notify immediately for instant UI reactivity
    const current = this.getLocalBookings();
    const filteredCurrent = current.filter((b) => b.id !== bookingId && b.booking_id !== bookingId);
    const updated = [booking, ...filteredCurrent];
    this.saveLocalBookings(updated);

    // 2. Persist directly to Supabase
    await this.syncBookingToSupabase(booking);

    // 3. Push Notification to Customer
    try {
      if (notificationService?.addNotification) {
        notificationService.addNotification({
          user_id: newBookingData.customer_id || 'guest',
          title: 'Pit Bay Booking Reserved (20% Downpayment Paid)',
          message: `Your booking #${bookingId} for ${booking.service_title} is confirmed with ₱${downpaymentAmount.toLocaleString()} downpayment. Our Service Advisor will review and assign a technician shortly. Note: Downpayment is non-refundable.`,
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
          date: booking.preferred_date || 'Scheduled Date',
          timeSlot: booking.preferred_time_slot || 'Pit Bay Slot',
        });
      }
      if (auditLogService?.logGarageAction) {
        auditLogService.logGarageAction({
          action: 'BOOKING_CREATED',
          target: `Booking #${bookingId}`,
          details: `New pitstop appointment booked by ${booking.customer_name} for ${booking.service_title} (${booking.bike_brand || ''} ${booking.bike_model || ''}).`,
          severity: 'INFO',
          metadata: { bookingId, customer: booking.customer_name, service: booking.service_title },
        });
      }
    } catch (_e) {}

    return booking;
  },

  async createAdminBooking(bookingData) {
    return this.createBooking(bookingData);
  },

  async addBooking(bookingData) {
    return this.createBooking(bookingData);
  },

  // ─── WORKSHOP LIFECYCLE ACTIONS ───

  // 1. Advisor Approves & Assigns Mechanic -> Status: Confirmed
  async approveBooking(bookingId, mechanicName) {
    const assignedMech = mechanicName || 'Master Tech Jayson (Yamaha & Honda Certified)';
    const updated = await this.updateBooking(bookingId, {
      status: 'Confirmed',
      mechanic: assignedMech,
      current_stage: `Appointment Confirmed • Assigned to ${assignedMech}`,
    });

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
        title: 'Service Booking Confirmed!',
        message: `Your appointment #${bookingId} has been confirmed. Master Tech ${assignedMech} is assigned to your motorcycle. Please bring your bike on the scheduled time.`,
        type: 'booking',
        link: 'bookings',
      });
    } catch (_e) {}

    return updated;
  },

  // 2. Advisor Rejects with Reason -> Status: Rejected
  async rejectBooking(bookingId, reason) {
    const updated = await this.updateBooking(bookingId, {
      status: 'Rejected',
      rejection_reason: reason || 'Service bay fully occupied at requested time slot.',
      current_stage: `Declined: ${reason || 'Schedule Conflict'}`,
    });

    try {
      notificationService?.addNotification?.({
        user_id: 'guest',
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
          mechanic_signoff: b.mechanic || 'Master Tech Jayson',
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

    const updated = current.map((b) => {
      if (b.id === bookingId || b.booking_id === bookingId) {
        const dpAmount = Number(b.downpayment_amount !== undefined ? b.downpayment_amount : Math.round((b.pricePhp || 2500) * 0.20));
        updatedBooking = {
          ...b,
          status: 'Cancelled',
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
            status: 'Cancelled',
            notes: `${reason} | 20% downpayment forfeited (non-refundable)`,
            updated_at: new Date().toISOString(),
          })
          .eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase cancelBooking error:', e);
    }

    try {
      if (notificationService?.addNotification) {
        notificationService.addNotification({
          user_id: updatedBooking?.customer_id || 'guest',
          title: 'Pit Bay Booking Cancelled (Downpayment Forfeited)',
          message: `Your appointment #${bookingId} has been cancelled. In accordance with our anti-fake booking policy, the 20% advance downpayment is non-refundable.`,
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

  addBooking(bookingData) {
    return this.createBooking(bookingData);
  },
};
