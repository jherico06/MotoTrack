// ─── PH Motorcycle catalog for brand → model → year selection ───────────────
// Used by the Customization module. Does not replace customer_motorcycles.

export const MOTORCYCLE_CATALOG = [
  {
    brand: 'Honda',
    models: [
      { model: 'Click 160', years: [2022, 2023, 2024, 2025, 2026], category: 'Scooter' },
      { model: 'Beat 110', years: [2020, 2021, 2022, 2023, 2024, 2025], category: 'Scooter' },
      { model: 'PCX 160', years: [2021, 2022, 2023, 2024, 2025, 2026], category: 'Scooter' },
      { model: 'ADV 160', years: [2022, 2023, 2024, 2025, 2026], category: 'Scooter' },
      { model: 'CBR150R', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Sport' },
      { model: 'CBR1000RR-R', years: [2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Superbike' },
      { model: 'XR150L', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Dual Sport' },
    ],
  },
  {
    brand: 'Yamaha',
    models: [
      { model: 'NMAX 155', years: [2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Scooter' },
      { model: 'Aerox 155', years: [2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Scooter' },
      { model: 'Mio i 125', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Scooter' },
      { model: 'MT-15', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Naked' },
      { model: 'YZF-R15', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Sport' },
      { model: 'YZF-R1', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Superbike' },
      { model: 'MT-09', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Naked' },
      { model: 'MT-10', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Naked' },
    ],
  },
  {
    brand: 'Kawasaki',
    models: [
      { model: 'Ninja 400', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Sport' },
      { model: 'Ninja ZX-6R', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Sport' },
      { model: 'Ninja ZX-10R', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Superbike' },
      { model: 'Z900', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Naked' },
      { model: 'KLX150', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Dual Sport' },
    ],
  },
  {
    brand: 'Suzuki',
    models: [
      { model: 'Raider R150', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Underbone' },
      { model: 'Burgman Street', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Scooter' },
      { model: 'GSX-R1000R', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Superbike' },
      { model: 'Hayabusa', years: [2021, 2022, 2023, 2024, 2025, 2026], category: 'Sport Touring' },
    ],
  },
  {
    brand: 'Ducati',
    models: [
      { model: 'Panigale V4', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Superbike' },
      { model: 'Panigale V2', years: [2020, 2021, 2022, 2023, 2024, 2025], category: 'Sport' },
      { model: 'Streetfighter V4', years: [2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Naked' },
      { model: 'Monster', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Naked' },
    ],
  },
  {
    brand: 'BMW Motorrad',
    models: [
      { model: 'S1000RR', years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Superbike' },
      { model: 'G310R', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Naked' },
      { model: 'G310GS', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Adventure' },
    ],
  },
  {
    brand: 'KTM',
    models: [
      { model: 'Duke 200', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Naked' },
      { model: 'Duke 390', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], category: 'Naked' },
      { model: 'RC 390', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], category: 'Sport' },
    ],
  },
];

export const CUSTOMIZATION_CATEGORIES = [
  'All',
  'Rims',
  'Tires',
  'Exhaust',
  'Handlebar',
  'Side Mirrors',
  'Headlights',
  'Taillights',
  'Fairings',
  'Brakes',
  'Suspension',
  'Footrests',
  'Levers',
  'Grips',
  'Windshields',
  'Accessories',
  'Drivetrain',
  'Engine',
  'Body Parts',
];

/** Map UI customization categories onto existing MotoTrack category names */
export const CATEGORY_ALIAS_MAP = {
  Rims: ['tires', 'tires & wheels', 'wheels', 'rims', 'accessories'],
  Tires: ['tires', 'tires & wheels', 'wheels'],
  Exhaust: ['exhaust'],
  Handlebar: ['accessories', 'body parts', 'electrical'],
  'Side Mirrors': ['accessories', 'body parts'],
  Headlights: ['electrical', 'accessories', 'body parts'],
  Taillights: ['electrical', 'accessories', 'body parts'],
  Fairings: ['body parts', 'accessories'],
  Brakes: ['brakes'],
  Suspension: ['suspension'],
  Footrests: ['accessories', 'body parts'],
  Levers: ['brakes', 'accessories'],
  Grips: ['accessories'],
  Windshields: ['accessories', 'body parts'],
  Accessories: ['accessories'],
  Drivetrain: ['drivetrain', 'transmission'],
  Engine: ['engine', 'fuel system', 'maintenance'],
  'Body Parts': ['body parts', 'accessories'],
};

/** Extra name keywords so specialty chips still find products stored under Accessories/etc. */
export const CATEGORY_NAME_KEYWORDS = {
  Rims: ['rim', 'wheel', 'alloy', 'mag'],
  Tires: ['tire', 'tyre'],
  Exhaust: ['exhaust', 'slip-on', 'slip on', 'muffler', 'pipe'],
  Handlebar: ['handlebar', 'handle bar', 'clip-on', 'clip on', 'bar end'],
  'Side Mirrors': ['mirror'],
  Headlights: ['headlight', 'head light', 'led head'],
  Taillights: ['taillight', 'tail light', 'tail lamp'],
  Fairings: ['fairing', 'body kit', 'cowling'],
  Brakes: ['brake', 'caliper', 'rotor', 'pad'],
  Suspension: ['suspension', 'shock', 'fork', 'monoshock'],
  Footrests: ['footrest', 'footpeg', 'peg'],
  Levers: ['lever'],
  Grips: ['grip'],
  Windshields: ['windshield', 'windscreen', 'visor'],
  Accessories: [],
  Drivetrain: ['chain', 'sprocket', 'drivetrain'],
  Engine: ['engine', 'oil', 'ecu', 'power commander', 'filter'],
  'Body Parts': ['fairing', 'cover', 'fender'],
};

export function getCatalogBrands() {
  return MOTORCYCLE_CATALOG.map((b) => b.brand);
}

export function getCatalogModels(brand) {
  const entry = MOTORCYCLE_CATALOG.find((b) => b.brand.toLowerCase() === String(brand || '').toLowerCase());
  return entry?.models || [];
}

export function getCatalogYears(brand, model) {
  const models = getCatalogModels(brand);
  const entry = models.find((m) => m.model.toLowerCase() === String(model || '').toLowerCase());
  return entry?.years || [];
}

/** Resolve vehicle body style so AI does not turn a scooter into a superbike */
export function getVehicleType(brand, model) {
  const models = getCatalogModels(brand);
  const entry = models.find((m) => m.model.toLowerCase() === String(model || '').toLowerCase());
  if (entry?.category) return entry.category;

  const name = `${brand || ''} ${model || ''}`.toLowerCase();
  if (/click|beat|pcx|adv|nmax|aerox|mio|vespa|burgman|scooter/.test(name)) return 'Scooter';
  if (/raider|underbone|smash|wave|xrm/.test(name)) return 'Underbone';
  if (/ninja|cbr|r1|r15|r6|panigale|gsx-r|s1000rr|zx-/.test(name)) return 'Sport';
  if (/mt-|duke|monster|streetfighter|z900|naked/.test(name)) return 'Naked';
  if (/klx|xr|gs|adventure|dual/.test(name)) return 'Dual Sport';
  return 'Motorcycle';
}

/** Turn vague product names into visual cues the image model can follow */
export function describePartForAi(part = {}) {
  const name = String(part.name || part.product_name || '').trim();
  const brand = String(part.brand || part.product_brand || '').trim();
  const category = String(part.category || part.product_category || '').toLowerCase();
  const hay = `${name} ${category}`.toLowerCase();

  let visual = '';
  if (/rim|wheel|alloy|mag/.test(hay) || category.includes('rim')) {
    visual = 'aftermarket alloy rims / sport wheels clearly visible on both sides';
  } else if (/tire|tyre/.test(hay)) {
    visual = 'performance motorcycle tires with visible tread pattern';
  } else if (/exhaust|slip|muffler|pipe/.test(hay) || category.includes('exhaust')) {
    visual = 'aftermarket exhaust / slip-on muffler mounted on the motorcycle';
  } else if (/mirror/.test(hay)) {
    visual = 'custom side mirrors';
  } else if (/handle|clip.?on|bar/.test(hay)) {
    visual = 'custom handlebar / clip-ons';
  } else if (/headlight|led head/.test(hay)) {
    visual = 'upgraded headlight assembly';
  } else if (/taillight|tail light/.test(hay)) {
    visual = 'upgraded taillight';
  } else if (/fairing|body/.test(hay)) {
    visual = 'custom fairings / body panels';
  } else if (/brake|caliper|rotor/.test(hay) || category.includes('brake')) {
    visual = 'performance brake components';
  } else if (/suspension|shock|fork/.test(hay) || category.includes('suspension')) {
    visual = 'upgraded suspension / shock absorbers';
  } else if (/grip/.test(hay)) {
    visual = 'custom hand grips';
  } else if (/windshield|windscreen/.test(hay)) {
    visual = 'custom windshield';
  } else if (/lever/.test(hay)) {
    visual = 'custom brake/clutch levers';
  } else if (/footrest|footpeg|peg/.test(hay)) {
    visual = 'custom footrests / footpegs';
  } else {
    visual = `installed accessory: ${name || 'custom motorcycle part'}`;
  }

  const label = [brand, name].filter(Boolean).join(' ');
  return label ? `${visual} (${label})` : visual;
}

export function matchesCustomizationCategory(productCategory, selectedCategory, productName = '') {
  if (!selectedCategory || selectedCategory === 'All') return true;
  const itemCat = String(productCategory || '').toLowerCase();
  const name = String(productName || '').toLowerCase();
  const aliases = CATEGORY_ALIAS_MAP[selectedCategory] || [selectedCategory.toLowerCase()];
  if (aliases.some((alias) => itemCat.includes(alias) || alias.includes(itemCat))) {
    return true;
  }
  const keywords = CATEGORY_NAME_KEYWORDS[selectedCategory] || [selectedCategory.toLowerCase()];
  if (keywords.length && keywords.some((kw) => name.includes(kw))) {
    return true;
  }
  return false;
}

export default MOTORCYCLE_CATALOG;
