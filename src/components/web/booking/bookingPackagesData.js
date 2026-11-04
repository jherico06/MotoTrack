// =========================================================================
// MotoTrack Package-First Customer Booking - Service Packages Catalog & Helpers
// Services strictly depend on the live Admin Services Packages Catalog
// (pmsPricingService / Supabase pms_services & pms_service_prices).
// =========================================================================

export const PACKAGE_CATEGORIES = [
  { id: 'all', label: 'All Packages', icon: 'grid-fill' },
  { id: 'PMS', label: 'PMS', icon: 'wrench-adjustable' },
  { id: 'Repair', label: 'Repair', icon: 'wrench' },
];

// Rich presentation presets for the 22 Admin Services Packages Catalog items
export const ADMIN_CATALOG_SERVICE_PRESETS = Object.freeze({
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
      'OEM Multi-Layer Steel (MLS) Head Gasket & Base Gasket Fitment',
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
      'Complete Japanese Low-Friction Main Bearing Set Replacement',
      'Oil Pump Rotor Clearance Measurement & High-Flow Screen Swap',
      'Full OEM Engine Case Gasket & Oil Seal Overhaul Kit Fitment',
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
      'Handlebar Lever Free-Play Setting & Barrel Adjuster Lock',
      'Friction-Free Smooth Throttle Snap-Back Verification',
    ],
  },
  'pms-replace-brake-pads': {
    duration: '30 mins',
    badge: 'Safety Critical',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Brake pad replacement labor, slide pin greasing, and rotor prep.',
    inclusions: [
      'Front & Rear Brake Caliper Pad Removal & Pin Inspection',
      'Caliper Piston Cleanse & High-Temp Ceramic Grease Application',
      'Brake Disc Rotor Surface Inspection & Deglaze',
      'Hydraulic Lever Pressure Bite & Bleed Check',
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
      'Pedal Free-Play Rod & Return Spring Tension Calibration',
    ],
  },
  'pms-replace-front-fork-oil': {
    duration: '60–90 mins',
    badge: 'Suspension',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Front fork oil replacement labor and damper flushing.',
    inclusions: [
      'Front Fork Disassembly, Inspection & Sludge Flush',
      'Stanchion Tube Trueing & Micro-Scratch Polish',
      'Motul / Bel-Ray Exact Viscosity Fork Oil Refill',
      'Air Chamber Height Calibration to Factory Specs',
    ],
  },
  'pms-replace-swing-arm-bushing': {
    duration: '60–90 mins',
    badge: 'Chassis',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    description: 'Replace swing arm bushing and pivot bearing service.',
    inclusions: [
      'Swingarm Pivot Disassembly & Axle Bolt Laser Alignment',
      'Hydraulic Press Extraction of Worn Bushings/Bearings',
      'Heavy-Duty Low-Wear Bronze/Needle Bearing Fitment',
      'High-Tack Waterproof Grease Pack & Factory Torque Tighten',
    ],
  },
  'pms-replace-steering-ball': {
    duration: '60–90 mins',
    badge: 'Handling',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Steering ball / cone race bearing replacement labor.',
    inclusions: [
      'Triple Tree Clamp Disassembly & Fork Drop',
      'Steering Stem Bearing Race Extraction & Clean',
      'Heavy-Duty Tapered Roller Bearing Fitment',
      'Waterproof Lithium Complex Grease Packing & Preload Set',
    ],
  },
  'pms-replace-front-hub-bearing': {
    duration: '30–45 mins',
    badge: 'Wheel Hub',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Front wheel hub bearing replacement labor.',
    inclusions: [
      'Front Wheel Hub Blind-Hole Bearing Extraction',
      'Spacer Tube Inspection & Center Cavity Degreasing',
      'Dual Japanese High-Speed C3 Sealed Bearing Press',
      'Outer Dust Seal Lip Pack & Axle Trueing Check',
    ],
  },
  'pms-replace-rear-hub-bearing': {
    duration: '35–50 mins',
    badge: 'Wheel Hub',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    description: 'Rear wheel hub and sprocket carrier bearing replacement labor.',
    inclusions: [
      'Rear Wheel Hub & Sprocket Carrier Bearing Removal',
      'Sprocket Carrier Damper Bushing Inspection',
      'C3 Sealed High-Load Radial Bearing Fitment',
      'Axle Washer Alignment & Nut Torque Calibration',
    ],
  },
  'pms-battery-recharging': {
    duration: '30 mins',
    badge: 'Electrical',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Battery testing, terminal de-oxidation, and deep pulse recharging.',
    inclusions: [
      'Battery Terminal Corrosion Scrubbing & Anti-Oxidation Prep',
      'Microprocessor Multi-Stage Deep Pulse Charging',
      'High-Amperage Cold-Cranking Amp (CCA) Load Test',
      'Stator & Rectifier Alternator Output Volts Check',
    ],
  },
  'pms-replace-head-light-bulb': {
    duration: '20–30 mins',
    badge: 'Lighting',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Headlight bulb replacement labor and beam alignment.',
    inclusions: [
      'Headlight Fairing / Cowl Disassembly',
      'High-Output OEM / LED Headlight Bulb Fitment',
      'Weatherproof Rubber Boot Sealing',
      'Beam Angle Height & Aim Calibration',
    ],
  },
  'pms-replace-tail-light-bulb': {
    duration: '15–25 mins',
    badge: 'Lighting',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Tail light bulb replacement labor and brake trigger verification.',
    inclusions: [
      'Tail Lens Housing Clean & Seal Inspection',
      'Dual-Filament Brake & Running Light Bulb Install',
      'Brake Light Switch Spring & Contact Verification',
    ],
  },
  'pms-replace-signal-light-bulb': {
    duration: '15–20 mins',
    badge: 'Lighting',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Turn signal light bulb replacement and flasher rate test.',
    inclusions: [
      'Turn Signal Lens Disassembly & Base Cleaning',
      'Amber Signal Bulb Installation & Socket Continuity Test',
      'Flasher Relay Flash-Rate Frequency Verification',
    ],
  },
  'pms-replace-panel-bulb': {
    duration: '25–35 mins',
    badge: 'Instruments',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Gauge panel instrument cluster bulb replacement labor.',
    inclusions: [
      'Instrument Gauge Cluster Disassembly',
      'Backlight Bulb Swap & Speedometer Cable Check',
      'O-Ring Weather Seal Restoration & Reassembly',
    ],
  },
  'pms-replace-wiring-harness': {
    duration: '3–5 hours',
    badge: 'Electrical',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Full main wiring harness replacement labor and dielectric sealing.',
    inclusions: [
      'Full Bodywork Removal & Old Loom Extraction',
      'Complete OEM Main Wiring Harness Laydown & Tie-Off',
      'All Waterproof Connectors Dielectric Greasing',
      'Relay, Fuse Box & CDI / ECU Load Continuity Verification',
    ],
  },
  'pms-replace-drive-chain': {
    duration: '30–45 mins',
    badge: 'Drive System',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: 'Drive chain replacement, slack tensioning, and synthetic waxing.',
    inclusions: [
      'Old Chain Rivet Master Link Extraction',
      'Heavy-Duty O-Ring / X-Ring Drive Chain Installation',
      'Rear Wheel Alignment & Chain Slack Laser Calibration',
      'Synthetic High-Adhesion Chain Wax Lube Application',
    ],
  },
  'pms-overhaul-carburetor': {
    duration: '60 mins',
    badge: 'Underbone / Carb',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: 'Carburetor ultrasonic overhaul service, jetting, and float sync.',
    inclusions: [
      'Heated Ultrasonic Bath Carburetor Body Cleanse',
      'Pilot Jet, Main Jet & Float Needle Emulsion De-gumming',
      'Float Bowl Level Caliper Measurement & Air/Fuel Screw Tune',
      'Throttle Slide Spring Free-Travel Check',
    ],
  },
  'pms-replace-starter-motor': {
    duration: '45–60 mins',
    badge: 'Starting System',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    description: 'Starter motor replacement labor and cranking amperage check.',
    inclusions: [
      'Starter Motor Removal & Flywheel Bendix Gear Check',
      'High-Torque OEM / Aftermarket Starter Motor Installation',
      'Heavy-Gauge Battery Positive Cable & Terminal Cleanse',
      'Cranking Amperage & One-Touch Start Push Test',
    ],
  },
  'pms-replace-cam-sprocket-chain': {
    duration: '90–120 mins',
    badge: 'Valvetrain',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    description: 'Cam sprocket and timing chain replacement labor.',
    inclusions: [
      'Engine Stator Cover & Camshaft Sprocket Access',
      'Silent Cam Timing Chain & Hardened Sprocket Install',
      'Tensioner Slipper Guide Alignment & TDC Valve Sync',
      'High-Temp Crankcase Gasket & Oil Leak Check',
    ],
  },
});

// Baseline testing / reference packages list matching the Admin Catalog
export const SERVICE_PACKAGES = [
  {
    id: 'pms-pro',
    name: 'Complete Care',
    category: 'PMS',
    badge: 'Most Popular',
    duration: '90 mins',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Complete high-performance 42-point inspection, Motul synthetic oil change, and multi-system track calibration.',
    description: 'Our most comprehensive track-grade preventive maintenance package designed for superbikes, sportsbikes, and daily riders wanting peak performance and engine longevity.',
    inclusions: [
      'Motul 300V Synthetic Oil & Filter Replacement',
      'Dual Caliper Hydraulic Line Bleed & Pad Inspection',
      'Drive Chain Ultrasonic Clean, Tension & Wax Lube',
      'Spark Plug Gap Calibration & Compression Health Check',
      'Dual Throttle Body & Fuel Injector Ultrasonic Spray Clean',
    ],
    prices: {
      'cc-125-below': 2500,
      'cc-150-160': 3200,
      'cc-big-bikes': 3750,
    },
  },
  {
    id: 'pms-minor-tune-up',
    name: 'Minor Tune Up',
    category: 'PMS',
    badge: 'Essential',
    duration: '45–60 mins',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Minor preventive tune-up labor and essential ignition calibration.',
    description: 'Precision tune-up for smooth idle, optimized throttle response, and reliable everyday ignition.',
    inclusions: [
      'Spark Plug Electrode Gap Calibration & Cleaning',
      'Throttle & Clutch Control Cable Lubrication',
      'Airbox Intake Clearing & Battery Voltage Test',
      'Drive Chain Free-Play Adjustment & Synthetic Lube',
      'Brake Pad Lining Wear Inspection',
    ],
    prices: {
      'cc-125-below': 300,
      'cc-150-160': 500,
      'cc-big-bikes': 700,
    },
  },
  {
    id: 'pms-major-tune-up',
    name: 'Major Tune Up',
    category: 'PMS',
    badge: 'Recommended',
    duration: '90–120 mins',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Full major tune-up, diagnostics, valve clearance adjustment, and intake clean.',
    description: 'Comprehensive engine optimization restoring maximum horsepower and crisp throttle response.',
    inclusions: [
      'Engine Valve Clearance Feeler-Gauge Calibration',
      'Throttle Body & EFI Ultrasonic Spray Clean',
      'Spark Plug Replacement & High-Voltage Ignition Test',
      'Engine Compression Gauge Cylinder Health Analysis',
    ],
    prices: {
      'cc-125-below': 1000,
      'cc-150-160': 1300,
      'cc-big-bikes': 1500,
    },
  },
  {
    id: 'pms-top-overhaul',
    name: 'Top Overhaul',
    category: 'Repair',
    badge: 'Heavy Mechanical',
    duration: '3–5 hours',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Complete top-end engine overhaul labor, valve seating, and carbon removal.',
    description: 'Restores engine compression, eliminates smoke blow-by, and cures valve ticking for refreshed engine power.',
    inclusions: [
      'Cylinder Head Decarbonization & Combustion Chamber De-Coke',
      'Intake & Exhaust Valve Hand-Lapping with Diamond Compound',
      'Viton High-Temperature Valve Stem Seals Replacement',
      'OEM Multi-Layer Steel (MLS) Head Gasket & Base Gasket Fitment',
    ],
    prices: {
      'cc-125-below': 1200,
      'cc-150-160': 1500,
      'cc-big-bikes': 1800,
    },
  },
  {
    id: 'pms-major-engine-overhaul',
    name: 'Major Engine Overhaul',
    category: 'Repair',
    badge: 'Full Rebuild',
    duration: '1–2 days',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Labor for a comprehensive major engine rebuild and crankcase overhaul.',
    description: 'Total teardown and rebuild from crankcase up, guaranteeing brand new engine tolerances.',
    inclusions: [
      'Full Engine Case Split, Ultrasonic Scrubbing & Degreasing',
      'Crankshaft Truing, Connecting Rod Bearing Fitment & Dial Check',
      'Complete Japanese Low-Friction Main Bearing Set Replacement',
    ],
    prices: {
      'cc-125-below': 2000,
      'cc-150-160': 2300,
      'cc-big-bikes': 2500,
    },
  },
  {
    id: 'pms-replace-lubricate-cable',
    name: 'Replace/Lubricate Cable',
    category: 'PMS',
    badge: 'Controls',
    duration: '30–45 mins',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Control cable replacement and synthetic pressure lubrication.',
    description: 'Eliminates sticky cables and ensures razor-sharp throttle control and clutch feel.',
    inclusions: [
      'Throttle & Clutch Control Cable Routing & Fitment',
      'High-Pressure Cable Lube Tool Injection',
    ],
    prices: {
      'cc-125-below': 300,
      'cc-150-160': 350,
      'cc-big-bikes': 400,
    },
  },
  {
    id: 'pms-replace-brake-pads',
    name: 'Replace Brake Pads',
    category: 'Repair',
    badge: 'Safety Critical',
    duration: '30 mins',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Brake pad replacement labor, slide pin greasing, and rotor prep.',
    description: 'High friction ceramic pad installation for maximum stopping power.',
    inclusions: [
      'Front & Rear Brake Caliper Pad Removal & Pin Inspection',
      'Caliper Piston Cleanse & High-Temp Ceramic Grease Application',
    ],
    prices: {
      'cc-125-below': 130,
      'cc-150-160': 150,
      'cc-big-bikes': 200,
    },
  },
  {
    id: 'pms-replace-brake-shoe',
    name: 'Replace Brake Shoe',
    category: 'Repair',
    badge: 'Safety Critical',
    duration: '35 mins',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Brake shoe replacement labor and rear drum hub servicing.',
    description: 'Restores instant bite to rear drum brakes with clean de-glazed lining.',
    inclusions: [
      'Rear Drum Hub Dust Extraction & De-Glazing',
      'High-Friction Asbestos-Free Brake Shoe Installation',
    ],
    prices: {
      'cc-125-below': 300,
      'cc-150-160': 350,
      'cc-big-bikes': 400,
    },
  },
  {
    id: 'pms-replace-front-fork-oil',
    name: 'Replace Front Fork Oil',
    category: 'PMS',
    badge: 'Suspension',
    duration: '60–90 mins',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Front fork oil replacement labor and damper flushing.',
    description: 'Restores plush front fork damping and prevents bottoming out.',
    inclusions: [
      'Front Fork Disassembly, Inspection & Sludge Flush',
      'Motul / Bel-Ray Exact Viscosity Fork Oil Refill',
    ],
    prices: {
      'cc-125-below': 450,
      'cc-150-160': 500,
      'cc-big-bikes': 600,
    },
  },
  {
    id: 'pms-replace-swing-arm-bushing',
    name: 'Replace Swing Arm Bushing',
    category: 'Repair',
    badge: 'Chassis',
    duration: '60–90 mins',
    image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Replace swing arm bushing and pivot bearing service.',
    description: 'Eliminates rear end wobble and restores rock-solid high-speed tracking.',
    inclusions: [
      'Swingarm Pivot Disassembly & Axle Bolt Laser Alignment',
      'Heavy-Duty Low-Wear Bronze/Needle Bearing Fitment',
    ],
    prices: {
      'cc-125-below': 500,
      'cc-150-160': 600,
      'cc-big-bikes': 800,
    },
  },
  {
    id: 'pms-replace-steering-ball',
    name: 'Replace Steering Ball/Bearing',
    category: 'Repair',
    badge: 'Handling',
    duration: '60–90 mins',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Steering ball / cone race bearing replacement labor.',
    description: 'Cures notched steering feel and restores smooth cornering transitions.',
    inclusions: [
      'Triple Tree Clamp Disassembly & Fork Drop',
      'Steering Stem Bearing Race Extraction & Clean',
    ],
    prices: {
      'cc-125-below': 450,
      'cc-150-160': 550,
      'cc-big-bikes': 700,
    },
  },
  {
    id: 'pms-replace-front-hub-bearing',
    name: 'Replace Front Hub Bearing',
    category: 'Repair',
    badge: 'Wheel Hub',
    duration: '30–45 mins',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Front wheel hub bearing replacement labor.',
    description: 'Smooth, friction-free wheel rotation with Japanese sealed bearings.',
    inclusions: [
      'Front Wheel Hub Blind-Hole Bearing Extraction',
      'Dual Japanese High-Speed C3 Sealed Bearing Press',
    ],
    prices: {
      'cc-125-below': 300,
      'cc-150-160': 350,
      'cc-big-bikes': 400,
    },
  },
  {
    id: 'pms-replace-rear-hub-bearing',
    name: 'Replace Rear Hub Bearing',
    category: 'Repair',
    badge: 'Wheel Hub',
    duration: '35–50 mins',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Rear wheel hub and sprocket carrier bearing replacement labor.',
    description: 'High-load radial bearings for stable drivetrain power transfer.',
    inclusions: [
      'Rear Wheel Hub & Sprocket Carrier Bearing Removal',
      'C3 Sealed High-Load Radial Bearing Fitment',
    ],
    prices: {
      'cc-125-below': 300,
      'cc-150-160': 350,
      'cc-big-bikes': 400,
    },
  },
  {
    id: 'pms-battery-recharging',
    name: 'Battery Recharging',
    category: 'PMS',
    badge: 'Electrical',
    duration: '30 mins',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Battery testing, terminal de-oxidation, and deep pulse recharging.',
    description: 'Deep cycle pulse charging restoring cranking voltage.',
    inclusions: [
      'Battery Terminal Corrosion Scrubbing & Anti-Oxidation Prep',
      'Microprocessor Multi-Stage Deep Pulse Charging',
    ],
    prices: {
      'cc-125-below': 100,
      'cc-150-160': 100,
      'cc-big-bikes': 100,
    },
  },
  {
    id: 'pms-overhaul-carburetor',
    name: 'Overhaul Carburetor',
    category: 'Repair',
    badge: 'Underbone / Carb',
    duration: '60 mins',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    shortDescription: 'Carburetor ultrasonic overhaul service, jetting, and float sync.',
    description: 'Deep ultrasonic restorative cleaning for carbureted motorcycles.',
    inclusions: [
      'Heated Ultrasonic Bath Carburetor Body Cleanse',
      'Pilot Jet, Main Jet & Float Needle Emulsion De-gumming',
    ],
    prices: {
      'cc-125-below': 300,
      'cc-150-160': 350,
      'cc-big-bikes': null,
    },
  },
];

// ─── Format Currency ──────────────────────────────────────────────────────────
export function formatPhp(val) {
  if (val === null || val === undefined || isNaN(val)) return '₱0';
  return '₱' + Number(val).toLocaleString('en-PH');
}

// ─── Starting Price Helper ───────────────────────────────────────────────────
export function getPackageStartingPrice(pkg) {
  if (!pkg) return 0;
  if (pkg.prices && typeof pkg.prices === 'object') {
    const valid = Object.values(pkg.prices).filter((p) => typeof p === 'number' && p > 0);
    if (valid.length > 0) return Math.min(...valid);
  }
  if (typeof pkg.pricePhp === 'number') return pkg.pricePhp;
  if (typeof pkg.price === 'number') return pkg.price;
  return 0;
}

// ─── Calculate Price for Engine CC ───────────────────────────────────────────
export function calculatePackagePriceForCc(pkg, cc) {
  if (!pkg) return { price: 0, tierId: 'cc-150-160', tierLabel: '150cc–160cc', isAvailable: true };
  const numCc = parseInt(cc, 10) || 0;

  let tierId = 'cc-150-160';
  let tierLabel = '150cc–160cc';

  if (numCc <= 125 && numCc > 0) {
    tierId = 'cc-125-below';
    tierLabel = '125cc & below';
  } else if (numCc >= 200) {
    tierId = 'cc-big-bikes';
    tierLabel = 'Big Bikes (200cc+)';
  } else {
    tierId = 'cc-150-160';
    tierLabel = '150cc–160cc';
  }

  const prices = pkg.prices || {};
  const price = prices[tierId];

  if (price === null || price === undefined) {
    if (tierId in prices && prices[tierId] === null) {
      return { price: null, tierId, tierLabel, isAvailable: false };
    }
    const fallback = getPackageStartingPrice(pkg);
    return { price: fallback, tierId, tierLabel, isAvailable: true };
  }

  return { price: Number(price), tierId, tierLabel, isAvailable: true };
}

// ─── Filter Legacy Packages ──────────────────────────────────────────────────
export function isExcludedLegacyPackage(pkg) {
  if (!pkg) return false;
  const id = String(pkg.id || pkg.service_id || pkg.package_id || '').toLowerCase().trim();
  const name = String(pkg.name || pkg.title || pkg.package_name || '').toLowerCase().trim();
  if (id === 'pkg-pms-basic' || id === 'pkg-pms-standard' || id === 'pkg-pms-premium') {
    return true;
  }
  if (name === 'basic pms' || name === 'standard pms' || name === 'premium pms') {
    return true;
  }
  return false;
}

// ─── Format Live Admin Package ───────────────────────────────────────────────
export function formatLiveAdminPackage(liveService, pmsMap = new Map()) {
  if (!liveService || isExcludedLegacyPackage(liveService)) return null;

  const id = liveService.id || liveService.service_id;
  const name = liveService.name || liveService.title || 'Service Package';
  const rawCat = String(liveService.catalogCategory || liveService.catalog_category || liveService.category || '').toLowerCase();
  const category = (rawCat.includes('repair') || rawCat === 'rep')
    ? 'Repair'
    : 'PMS';

  const lookupKey = String(name).toLowerCase().trim();
  const pmsMatch = pmsMap.get(id) || pmsMap.get(lookupKey);
  const preset = ADMIN_CATALOG_SERVICE_PRESETS[id] || {};

  // Inclusions: liveService inclusions take top precedence, then preset inclusions, then parse lines
  let inclusions = [];
  if (Array.isArray(liveService.inclusions) && liveService.inclusions.length > 0) {
    inclusions = liveService.inclusions;
  } else if (pmsMatch && Array.isArray(pmsMatch.inclusions) && pmsMatch.inclusions.length > 0) {
    inclusions = pmsMatch.inclusions;
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

  // Prices: extract CC rates from liveService or pmsMatch
  let prices = null;
  if (liveService.prices && typeof liveService.prices === 'object') {
    prices = { ...liveService.prices };
  } else if (pmsMatch?.prices && typeof pmsMatch.prices === 'object') {
    prices = { ...pmsMatch.prices };
  } else {
    const base = Number(liveService.pricePhp || liveService.price || 1500);
    prices = {
      'cc-125-below': Math.round(base * 0.8),
      'cc-150-160': base,
      'cc-big-bikes': Math.round(base * 1.25),
    };
  }

  const duration = liveService.duration || pmsMatch?.duration || preset.duration || '45–60 mins';
  const badge = liveService.badge || pmsMatch?.badge || preset.badge || 'Available';
  const image =
    liveService.image ||
    liveService.imageUrl ||
    preset.image ||
    (category === 'Repair'
      ? 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80'
      : 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80');

  const description =
    liveService.description ||
    liveService.subtitle ||
    pmsMatch?.description ||
    preset.description ||
    'Professional certified motorcycle service delivered to factory specifications.';

  const shortDescription = liveService.shortDescription || preset.description || description;

  return {
    id,
    name,
    category,
    badge,
    duration,
    image,
    shortDescription,
    description,
    inclusions,
    prices,
  };
}
