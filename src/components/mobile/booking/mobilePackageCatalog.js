/**
 * Mobile Package-First Service Catalog Helpers & Atelier Protocol Steps.
 * Reuses shared CC pricing definitions from src/utils/pmsCcPricing.js while
 * keeping mobile UI presentation self-contained in APP MODE.
 */
import { DEFAULT_PMS_SERVICES } from '../../../utils/pmsCcPricing.js';
import { normalizeBookingStatus } from '../../../utils/serviceQuotation.js';

export const MOBILE_PACKAGE_CATEGORIES = [
  { id: 'all', label: 'All Packages', icon: 'grid-fill' },
  { id: 'PMS', label: 'PMS', icon: 'wrench-adjustable' },
  { id: 'Repair', label: 'Repair', icon: 'wrench' },
];

export const MOBILE_CC_TIERS = [
  { id: 'cc-125-below', label: '125cc & below' },
  { id: 'cc-150-160', label: '150cc–160cc' },
  { id: 'cc-big-bikes', label: 'Big Bikes (200cc+)' },
];

export const MOBILE_PACKAGE_PRESETS = Object.freeze({
  'pms-minor-tune-up': {
    duration: '45–60 mins',
    badge: 'Essential',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Minor preventive tune-up and essential engine inspection.',
    inclusions: [
      'Spark Plug Electrode Gap Calibration & Cleaning',
      'Throttle & Clutch Control Cable Lubrication',
      'Airbox Intake Clearing & Battery Voltage Test',
      'Drive Chain Free-Play Adjustment & Synthetic Lube',
      'Brake Pad Lining Wear Inspection',
    ],
  },
  'pms-major-tune-up': {
    duration: '90–120 mins',
    badge: 'Recommended',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Full major tune-up, diagnostics, valve clearance adjustment, and intake clean.',
    inclusions: [
      'Engine Valve Clearance Feeler-Gauge Calibration',
      'Throttle Body & EFI Ultrasonic Spray Clean',
      'Spark Plug Replacement & High-Voltage Ignition Test',
      'Engine Compression Gauge Cylinder Health Analysis',
      'Coolant System Inspection & Radiator Fin Debris Cleanse',
      'Full Chassis Fastener Torque-Down',
    ],
  },
  'pms-top-overhaul': {
    duration: '3–5 hours',
    badge: 'Heavy Mechanical',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    description: 'Complete top-end engine overhaul labor, valve seating, and carbon removal.',
    inclusions: [
      'Cylinder Head Decarbonization & Combustion Chamber De-Coke',
      'Intake & Exhaust Valve Hand-Lapping with Diamond Compound',
      'Viton High-Temperature Valve Stem Seals Replacement',
      'Cylinder Bore Cross-Hatch Honing & Micrometer Inspection',
      'Piston Crown Carbon Removal & Ring End-Gap Calibration',
      'OEM Multi-Layer Steel (MLS) Head & Base Gasket Fitment',
    ],
  },
  'pms-major-engine-overhaul': {
    duration: '1–2 days',
    badge: 'Full Rebuild',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Labor for a comprehensive major engine rebuild and crankcase overhaul.',
    inclusions: [
      'Full Engine Case Split, Ultrasonic Scrubbing & Degreasing',
      'Crankshaft Truing, Connecting Rod Bearing Fitment & Dial Check',
      'Transmission Gear Shifting Dog & Shift Fork Inspection',
      'Japanese Low-Friction Main Bearing Set Replacement',
      'Full OEM Engine Case Gasket & Oil Seal Overhaul Fitment',
    ],
  },
  'pms-replace-lubricate-cable': {
    duration: '30–45 mins',
    badge: 'Controls',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    description: 'Control cable replacement and synthetic pressure lubrication.',
    inclusions: [
      'Throttle & Clutch Control Cable Routing & Fitment',
      'High-Pressure Cable Lube Tool Injection',
      'Handlebar Lever Free-Play Setting & Barrel Lock',
      'Smooth Throttle Snap-Back Verification',
    ],
  },
  'pms-replace-brake-pads': {
    duration: '30 mins',
    badge: 'Safety Critical',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Brake pad replacement labor, slide pin greasing, and rotor prep.',
    inclusions: [
      'Front & Rear Brake Caliper Pad Removal & Pin Inspection',
      'Caliper Piston Cleanse & High-Temp Ceramic Grease',
      'Brake Disc Rotor Surface Inspection & Deglaze',
      'Hydraulic Lever Pressure Bite Check',
    ],
  },
  'pms-replace-brake-shoe': {
    duration: '35 mins',
    badge: 'Safety Critical',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Brake shoe replacement labor and rear drum hub servicing.',
    inclusions: [
      'Rear Drum Hub Dust Extraction & De-Glazing',
      'High-Friction Asbestos-Free Brake Shoe Installation',
      'Actuating Cam Pivot High-Temp Anti-Seize Lube',
      'Pedal Free-Play Calibration',
    ],
  },
  'pms-replace-front-fork-oil': {
    duration: '60–90 mins',
    badge: 'Suspension',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Front fork oil replacement labor and damper flushing.',
    inclusions: [
      'Front Fork Disassembly & Sludge Flush',
      'Stanchion Tube Trueing & Micro-Scratch Polish',
      'Exact Viscosity Fork Oil Refill',
      'Air Chamber Height Calibration',
    ],
  },
  'pms-replace-swing-arm-bushing': {
    duration: '60–90 mins',
    badge: 'Chassis',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    description: 'Replace swing arm bushing and pivot bearing service.',
    inclusions: [
      'Swingarm Pivot Disassembly & Alignment',
      'Worn Bushing Hydraulic Press Extraction',
      'Heavy-Duty Bearing Fitment & Waterproof Grease Pack',
    ],
  },
  'pms-replace-steering-ball': {
    duration: '60–90 mins',
    badge: 'Handling',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Steering ball / cone race bearing replacement labor.',
    inclusions: [
      'Triple Tree Clamp Disassembly & Fork Drop',
      'Steering Stem Bearing Race Extraction',
      'Waterproof Lithium Complex Grease Packing & Preload Set',
    ],
  },
  'pms-replace-front-hub-bearing': {
    duration: '30–45 mins',
    badge: 'Wheel Hub',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Front wheel hub bearing replacement labor.',
    inclusions: [
      'Front Wheel Hub Bearing Extraction',
      'Spacer Tube Degreasing & Inspection',
      'Dual High-Speed Sealed Bearing Press',
    ],
  },
  'pms-replace-rear-hub-bearing': {
    duration: '35–50 mins',
    badge: 'Wheel Hub',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    description: 'Rear wheel hub and sprocket carrier bearing replacement labor.',
    inclusions: [
      'Rear Wheel Hub & Sprocket Carrier Bearing Removal',
      'Damper Bushing Inspection & Nut Torque Calibration',
      'Sealed Radial Bearing Fitment',
    ],
  },
  'pms-battery-recharging': {
    duration: '30 mins',
    badge: 'Electrical',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Battery testing, terminal de-oxidation, and deep pulse recharging.',
    inclusions: [
      'Battery Terminal Cleaning & Anti-Oxidation Prep',
      'Microprocessor Multi-Stage Deep Pulse Charging',
      'CCA Load Test & Alternator Output Check',
    ],
  },
  'pms-replace-head-light-bulb': {
    duration: '20–30 mins',
    badge: 'Lighting',
  },
  'pms-replace-tail-light-bulb': {
    duration: '20 mins',
    badge: 'Lighting',
  },
  'pms-replace-signal-light-bulb': {
    duration: '25 mins',
    badge: 'Lighting',
  },
  'pms-replace-panel-bulb': {
    duration: '30 mins',
    badge: 'Electrical',
  },
  'pms-replace-wiring-harness': {
    duration: '3–5 hours',
    badge: 'Electrical Overhaul',
  },
  'pms-replace-drive-chain': {
    duration: '30–45 mins',
    badge: 'Drivetrain',
  },
  'pms-overhaul-carburetor': {
    duration: '60–90 mins',
    badge: 'Fuel System',
  },
  'pms-replace-starter-motor': {
    duration: '45 mins',
    badge: 'Starting System',
  },
  'pms-replace-cam-sprocket-chain': {
    duration: '2–3 hours',
    badge: 'Engine Timing',
  },
});

export function isExcludedLegacyPackage(pkg) {
  if (!pkg) return false;
  const id = String(pkg.id || pkg.service_id || pkg.package_id || '').toLowerCase().trim();
  const name = String(pkg.name || pkg.title || pkg.package_name || '').toLowerCase().trim();
  return (
    id === 'pkg-pms-basic' ||
    id === 'pkg-pms-standard' ||
    id === 'pkg-pms-premium' ||
    name === 'basic pms' ||
    name === 'standard pms' ||
    name === 'premium pms'
  );
}

export function getPackageStartingPrice(pkg) {
  if (!pkg) return 0;
  const values = Object.values(pkg.prices || {})
    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0)
    .map(Number);
  if (values.length > 0) return Math.min(...values);
  return Number(pkg.pricePhp || pkg.price || 0);
}

export function getCcTierId(cc) {
  const numCc = parseInt(cc, 10) || 0;
  if (numCc <= 0) return null;
  if (numCc <= 125) return 'cc-125-below';
  if (numCc < 200) return 'cc-150-160';
  return 'cc-big-bikes';
}

export function getCcTierLabel(cc) {
  const tierId = getCcTierId(cc);
  if (tierId === 'cc-125-below') return '125cc and below';
  if (tierId === 'cc-big-bikes') return 'Big Bikes (200cc+)';
  if (tierId === 'cc-150-160') return '150cc–160cc';
  return 'Standard Rate';
}

export function calculatePackagePriceForCc(pkg, cc) {
  if (!pkg) return { price: 0, tierId: 'cc-150-160', tierLabel: '150cc–160cc', isAvailable: true };
  const tierId = getCcTierId(cc) || 'cc-150-160';
  const tierLabel = getCcTierLabel(cc) || '150cc–160cc';
  const prices = pkg.prices || {};
  const price = prices[tierId];

  if (price === null || price === undefined) {
    if (tierId in prices && prices[tierId] === null) {
      return { price: null, tierId, tierLabel, isAvailable: false };
    }
    return { price: getPackageStartingPrice(pkg), tierId, tierLabel, isAvailable: true };
  }

  return { price: Number(price), tierId, tierLabel, isAvailable: true };
}

export function formatLiveAdminPackage(liveService) {
  if (!liveService || isExcludedLegacyPackage(liveService)) return null;

  const id = liveService.id || liveService.service_id;
  const name = liveService.name || liveService.title || 'Service Package';
  const rawCat = String(
    liveService.catalogCategory || liveService.catalog_category || liveService.category || ''
  ).toLowerCase();
  const category = rawCat.includes('repair') || rawCat === 'rep' ? 'Repair' : 'PMS';
  const preset = MOBILE_PACKAGE_PRESETS[id] || {};

  let inclusions = [];
  if (Array.isArray(liveService.inclusions) && liveService.inclusions.length > 0) {
    inclusions = liveService.inclusions;
  } else if (Array.isArray(preset.inclusions) && preset.inclusions.length > 0) {
    inclusions = preset.inclusions;
  } else if (liveService.description && liveService.description.includes('\n')) {
    inclusions = liveService.description
      .split('\n')
      .map((l) => l.replace(/^[\s*•\-–—\d.)]+/, '').trim())
      .filter((l) => l.length > 0);
  }
  if (inclusions.length === 0) {
    inclusions = [
      'Comprehensive Multi-Point Diagnostic Inspection',
      'OEM Precision Fluid & Torque Calibrations',
      'Final Road-Test & Verified Handover',
    ];
  }

  let prices = null;
  if (liveService.prices && typeof liveService.prices === 'object') {
    prices = { ...liveService.prices };
  } else {
    const base = Number(liveService.pricePhp || liveService.price || 1500);
    prices = {
      'cc-125-below': Math.round(base * 0.8),
      'cc-150-160': base,
      'cc-big-bikes': Math.round(base * 1.25),
    };
  }

  const description =
    liveService.description ||
    liveService.subtitle ||
    preset.description ||
    'Professional certified motorcycle service delivered to factory specifications.';

  return {
    id,
    name,
    category,
    badge: liveService.badge || preset.badge || 'Available',
    duration: liveService.duration || preset.duration || '45–60 mins',
    image:
      liveService.image ||
      liveService.imageUrl ||
      preset.image ||
      (category === 'Repair'
        ? 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80'
        : 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80'),
    shortDescription: liveService.shortDescription || preset.description || description,
    description,
    inclusions,
    prices,
  };
}

export function buildMobilePackageCatalog(rawServices) {
  const source = Array.isArray(rawServices) && rawServices.length > 0 ? rawServices : DEFAULT_PMS_SERVICES;
  return source
    .filter((s) => s && s.isActive !== false && !isExcludedLegacyPackage(s))
    .map((s) => formatLiveAdminPackage(s))
    .filter(Boolean);
}

function formatClockTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  const match = String(val).match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  return match ? match[1].toUpperCase() : '';
}

function extractShortBayUpper(booking) {
  const raw = String(booking?.bay_name || booking?.service_bay || '').trim();
  if (!raw) return 'PIT BAY';
  const bayMatch = raw.match(/bay\s*#?\s*0?(\d+)/i);
  if (bayMatch) {
    return `BAY ${String(bayMatch[1]).padStart(2, '0')}`;
  }
  return raw.toUpperCase();
}

/**
 * Dynamically derives Spotlight telemetry and "Track your progress" steps from a real booking record.
 */
export function buildProtocolState(booking) {
  if (!booking) {
    return {
      subtitle: 'Book a pit stop or select a reservation to view live bay tracking.',
      etaBadge: 'Est. 45 min',
      spotlight: null,
      steps: [
        { id: 'review', title: 'Checked in', desc: 'Payment and bay verification', state: 'pending' },
        { id: 'progress', title: 'Service in progress', desc: 'Technician inspection & servicing', state: 'pending' },
        { id: 'pickup', title: 'Ready for pickup', desc: 'Road test and final handover', state: 'pending' },
      ],
    };
  }

  const norm = normalizeBookingStatus(booking.status);
  const serviceTitle = booking.service_title || booking.package_name || 'Service Appointment';
  const etaBadge =
    booking.estimated_duration ||
    booking.duration ||
    (norm === 'COMPLETED'
      ? 'Completed'
      : norm === 'READY_FOR_PICKUP'
        ? 'Ready now'
        : 'Est. 45 min');

  const isCancelled = ['CANCELLED', 'REJECTED', 'CUSTOMER_DECLINED', 'BOOKING_EXPIRED'].includes(norm);
  if (isCancelled) {
    return {
      subtitle: `Status: ${booking.status || 'Cancelled'}`,
      etaBadge: 'Closed',
      spotlight: {
        badgeText: 'CANCELLED',
        dotColor: '#F43F5E',
        title: serviceTitle,
        desc: 'This booking is no longer active in the bay queue.',
        progressPct: 0,
        timeLabel: booking.preferred_date ? `${booking.preferred_date}` : 'Cancelled',
      },
      steps: [
        { id: 'review', title: 'Booking closed', desc: 'This appointment is no longer active in bay queue.', state: 'failed' },
        { id: 'progress', title: 'Bay allocation released', desc: 'Schedule slot reopened for other riders.', state: 'pending' },
        { id: 'pickup', title: 'Archive & receipt', desc: 'Booking record saved in history.', state: 'pending' },
      ],
    };
  }

  const isCompleted = norm === 'COMPLETED';
  const isReady = norm === 'READY_FOR_PICKUP';
  const isInService = [
    'CONFIRMED',
    'SERVICE_IN_PROGRESS',
    'ADDITIONAL_APPROVAL_REQUIRED',
    'SERVICE_COMPLETED',
    'AWAITING_FINAL_PAYMENT',
  ].includes(norm);

  const bayUpper = extractShortBayUpper(booking);
  const cleanMech = booking.mechanic && !String(booking.mechanic).toLowerCase().includes('pending')
    ? String(booking.mechanic).replace(/^Assigned to\s*/i, '').trim()
    : '';

  const explicitPct = Number(booking.progress_percent ?? booking.progressPct);
  const defaultPct = isCompleted
    ? 100
    : isReady
      ? 90
      : norm === 'SERVICE_COMPLETED' || norm === 'AWAITING_FINAL_PAYMENT'
        ? 85
        : isInService
          ? 62
          : 25;
  const progressPct =
    Number.isFinite(explicitPct) && explicitPct >= 0 && explicitPct <= 100
      ? Math.round(explicitPct)
      : defaultPct;

  const checkInTime = formatClockTime(
    booking.checked_in_at || booking.started_at || booking.downpayment_paid_at || booking.created_at
  );
  const startedTime = formatClockTime(booking.started_at || booking.checked_in_at || booking.updated_at);
  const prefSlot = booking.preferred_time || booking.time_slot || '';
  const prefDate = booking.preferred_date || booking.appointment_date || booking.date || '';

  const timeLabel = isInService && startedTime
    ? `Started ${startedTime}`
    : isCompleted
      ? checkInTime
        ? `Finished · ${checkInTime}`
        : 'Service completed'
      : prefDate || prefSlot
        ? `${prefDate}${prefDate && prefSlot ? ' · ' : ''}${prefSlot}`
        : 'Scheduled slot';

  const spotlightBadge = isCompleted
    ? 'COMPLETED'
    : isReady
      ? `READY IN ${bayUpper}`
      : isInService
        ? `LIVE IN ${bayUpper}`
        : 'SCHEDULED RESERVATION';

  const spotlightDesc = isCompleted
    ? 'Motorcycle released & digital service receipt issued.'
    : isReady
      ? 'Ready for workshop pickup & final handover.'
      : isInService
        ? 'Your motorcycle is being serviced now.'
        : 'Reservation logged and queued for pit advisor confirmation.';

  return {
    subtitle: `Tracking ${booking.booking_id || booking.id || 'appointment'}`,
    etaBadge,
    spotlight: {
      badgeText: spotlightBadge,
      dotColor: isCompleted ? '#64748B' : isReady || isInService ? '#10B981' : '#F59E0B',
      title: serviceTitle,
      desc: spotlightDesc,
      progressPct,
      timeLabel,
    },
    steps: [
      {
        id: 'review',
        title: 'Checked in',
        desc:
          isInService || isReady || isCompleted
            ? 'Payment and bay confirmed'
            : 'Pending advisor review and bay confirmation',
        timeText: checkInTime,
        state: isInService || isReady || isCompleted ? 'done' : 'current',
      },
      {
        id: 'progress',
        title: 'Service in progress',
        desc:
          isCompleted || isReady
            ? 'All mechanical checklists completed'
            : isInService
              ? cleanMech
                ? `${cleanMech} servicing your motorcycle`
                : 'Engine and fluids inspection'
              : 'Queued for intake at scheduled bay time',
        state: isCompleted || isReady ? 'done' : isInService ? 'current' : 'pending',
        isLive: isInService,
      },
      {
        id: 'pickup',
        title: 'Ready for pickup',
        desc: isCompleted
          ? 'Road test complete & handover signed off'
          : isReady
            ? 'Ready for workshop pickup & settlement'
            : 'Road test and final handover',
        state: isCompleted ? 'done' : isReady ? 'current' : 'pending',
        isLive: isReady,
      },
    ],
  };
}
