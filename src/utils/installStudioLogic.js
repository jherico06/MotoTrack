/**
 * Functional helpers for AI Install Studio.
 * Keeps motorcycle/product association, installation metadata, and prompts accurate.
 */

export const MAX_SELECTED_PRODUCTS = 3;

export const GENERATION_STATES = Object.freeze({
  IDLE: 'idle',
  SELECTING: 'selecting',
  VALIDATING: 'validating',
  PREPARING: 'preparing',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

export const UPLOAD_PART_CATEGORIES = Object.freeze([
  'Exhaust',
  'Side Mirror',
  'Wheel/Rim',
  'Brake',
  'Lighting',
  'Handlebar',
  'Suspension',
  'Body/Fairing',
  'Accessories',
  'Other',
]);

const INSTALLATION_GUIDES = [
  {
    keys: ['exhaust', 'muffler', 'silencer', 'slip-on', 'slip on'],
    position: 'Rear / engine exhaust mounting area',
    type: 'Bolt-on exhaust system installation',
    description:
      'Mount the exhaust at the stock exhaust outlet and secure it along the rear/side mounting points with the correct brackets and hardware.',
    cameraView: '3/4 rear-side view highlighting the exhaust and muffler area',
  },
  {
    keys: ['mirror', 'side mirror', 'rearview'],
    position: 'Handlebar / mirror mounting point',
    type: 'Handlebar mount replacement',
    description:
      'Install the mirror on the handlebar mirror mount so the stem and glass face outward in a realistic riding position.',
    cameraView: 'Front 3/4 view showing the handlebars and mirrors clearly',
  },
  {
    keys: ['brake disc', 'brake disk', 'rotor', 'disc brake'],
    position: 'Wheel hub / brake assembly',
    type: 'Hub-mounted brake disc installation',
    description:
      'Mount the brake disc onto the wheel hub/brake assembly with correct orientation, bolt pattern, and caliper clearance.',
    cameraView: 'Close 3/4 front-wheel view showing the brake disc and hub',
  },
  {
    keys: ['brake', 'caliper', 'master cylinder'],
    position: 'Wheel hub / brake assembly',
    type: 'Brake component installation',
    description:
      'Install the brake component at the correct brake assembly location with realistic caliper, disc, and mounting hardware alignment.',
    cameraView: '3/4 view highlighting the brake assembly',
  },
  {
    keys: ['top box', 'topcase', 'top case', 'luggage', 'trunk'],
    position: 'Rear luggage rack',
    type: 'Rear rack mount installation',
    description:
      'Secure the top box onto the rear luggage rack using the proper mounting plate, latches, and hardware.',
    cameraView: 'Rear 3/4 view highlighting the luggage rack and top box',
  },
  {
    keys: ['crash guard', 'crash bar', 'engine guard', 'cage'],
    position: 'Frame / engine mounting area',
    type: 'Frame-mounted crash protection',
    description:
      'Attach the crash guard to the motorcycle frame/engine mounting points with bolts and brackets so it wraps protectively around the engine area.',
    cameraView: 'Side 3/4 view showing the engine and frame guards',
  },
  {
    keys: ['headlight', 'led headlight', 'head lamp'],
    position: 'Front headlight housing',
    type: 'Headlight housing replacement',
    description:
      'Install the headlight into the front headlight housing with correct orientation, bezel alignment, and wiring realism.',
    cameraView: 'Front 3/4 view highlighting the headlight',
  },
  {
    keys: ['tail light', 'taillight', 'signal', 'indicator', 'led'],
    position: 'Lighting mount / housing',
    type: 'Lighting component installation',
    description:
      'Install the lighting part in the correct housing or mount with realistic wiring and alignment for that motorcycle.',
    cameraView: '3/4 view that clearly shows the installed lighting part',
  },
  {
    keys: ['rim', 'wheel', 'alloy'],
    position: 'Wheel hub / axle assembly',
    type: 'Wheel and rim replacement',
    description:
      'Install the wheel/rim on the correct axle and hub with proper brake disc, sprocket, and tire alignment.',
    cameraView: 'Side 3/4 view highlighting the installed wheel',
  },
  {
    keys: ['handlebar', 'bar end', 'grip'],
    position: 'Handlebar / controls area',
    type: 'Handlebar component installation',
    description:
      'Install the handlebar part at the controls area with realistic clamp, control, and cable alignment.',
    cameraView: 'Front 3/4 cockpit view showing the handlebars',
  },
  {
    keys: ['suspension', 'fork', 'shock', 'absorber'],
    position: 'Front fork or rear suspension mount',
    type: 'Suspension component installation',
    description:
      'Install the suspension component at the correct fork or rear mount points with realistic geometry and hardware.',
    cameraView: 'Side view highlighting the suspension components',
  },
  {
    keys: ['fairing', 'body', 'cowling', 'cover', 'fender'],
    position: 'Body panel / fairing mounting points',
    type: 'Bodywork installation',
    description:
      'Fit the body/fairing part onto the matching panel mounting points while preserving the motorcycle silhouette.',
    cameraView: 'Side 3/4 view showing the bodywork clearly',
  },
  {
    keys: ['seat', 'saddle'],
    position: 'Seat mount / subframe',
    type: 'Seat replacement',
    description:
      'Install the seat onto the subframe mounts so it sits flush and aligned with the tank and rear body.',
    cameraView: 'Side 3/4 view highlighting the seat',
  },
];

const DEFAULT_INSTALLATION = Object.freeze({
  position: 'Correct OEM mounting location for this part category',
  type: 'Mechanically realistic bolt-on installation',
  description:
    'Install the selected part using the correct mounts, brackets, bolts, clamps, connectors, or wiring for this motorcycle and part type.',
  cameraView: '3/4 studio product view showing the full motorcycle with the installed part clearly visible',
});

function clean(value) {
  return String(value || '').trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

export function bikePhotoUri(bike) {
  return bike?.photo_url || bike?.photoUrl || bike?.image || bike?.motorcycle_image || null;
}

export function productImageUri(product) {
  return product?.image || product?.image_url || product?.photo_url || product?.product_image || null;
}

/**
 * Validates that a product is a physical motorcycle part or accessory suitable for AI installation preview.
 * Excludes maintenance fluids, oils, chemicals, consumables, services, and rider gear.
 */
export function isInstallablePart(product) {
  if (!product) return false;

  const category = clean(product.category || product.product_type || product.type).toLowerCase();
  const name = clean(product.name || product.product_name).toLowerCase();
  const description = clean(product.description || product.product_description).toLowerCase();
  const catId = clean(product.category_id).toLowerCase();

  // Explicit non-part categories
  const excludedCategoryKeywords = [
    'maintenance',
    'cat-08',
    'consumable',
    'fluid',
    'oil',
    'lubricant',
    'chemical',
    'service',
    'labor',
    'apparel',
    'gear',
    'clothing',
    'merchandise',
  ];

  if (excludedCategoryKeywords.some((ex) => category.includes(ex) || catId === ex)) {
    return false;
  }

  // Non-installable keywords in product name or category
  const excludedKeywords = [
    'engine oil',
    'motor oil',
    'gear oil',
    'fork oil',
    '2t oil',
    '4t oil',
    'brake fluid',
    'clutch fluid',
    'coolant',
    'radiator fluid',
    'chain lube',
    'chain cleaner',
    'degreaser',
    'lubricant',
    'grease',
    'oil filter',
    'spark plug',
    'shampoo',
    'car wash',
    'bike wash',
    'polish',
    'wax',
    'additive',
    'injector cleaner',
    'helmet',
    'jacket',
    'gloves',
    'riding pants',
    'riding shoes',
    'boots',
    'raincoat',
    'tune-up',
    'pms package',
  ];

  for (const kw of excludedKeywords) {
    if (name.includes(kw) || category.includes(kw)) {
      return false;
    }
  }

  // Strict check for standalone word 'oil' in product name or category (e.g. "Engine oil", "4T Oil")
  if (/\b(oil|fluids?|lubes?|coolants?|greases?|degreasers?)\b/i.test(name) || /\b(oil|fluids?|lubes?)\b/i.test(category)) {
    return false;
  }

  return true;
}

function matchInstallationGuide(category = '', name = '', description = '') {
  const hay = `${lower(category)} ${lower(name)} ${lower(description)}`;
  return INSTALLATION_GUIDES.find((guide) => guide.keys.some((key) => hay.includes(key))) || null;
}

/**
 * Resolve installation position/type/description/camera from product metadata first,
 * then category/name heuristics. Never hardcode one position for every product.
 */
export function resolveInstallationMetadata(source = {}) {
  const category = clean(source.category || source.product_type || source.type);
  const name = clean(source.name || source.product_name);
  const description = clean(source.description || source.product_description);
  const guide = matchInstallationGuide(category, name, description);

  const position =
    clean(source.installation_position) ||
    clean(source.install_position) ||
    guide?.position ||
    DEFAULT_INSTALLATION.position;

  const type =
    clean(source.installation_type) ||
    clean(source.install_type) ||
    guide?.type ||
    DEFAULT_INSTALLATION.type;

  const installDescription =
    clean(source.installation_description) ||
    clean(source.install_description) ||
    guide?.description ||
    (description
      ? `Install according to the product details: ${description}`
      : DEFAULT_INSTALLATION.description);

  const cameraView =
    clean(source.camera_view) ||
    clean(source.cameraView) ||
    guide?.cameraView ||
    DEFAULT_INSTALLATION.cameraView;

  return {
    installation_position: position,
    installation_type: type,
    installation_description: installDescription,
    camera_view: cameraView,
    category: category || 'Accessories',
    inferred: !clean(source.installation_position) && Boolean(guide),
  };
}

export function normalizeMotorcycle(bike, imageOverride = null) {
  if (!bike) return null;
  const image = imageOverride || bikePhotoUri(bike);
  const brand = clean(bike.brand);
  const model = clean(bike.model);
  const year = clean(bike.year);
  const name =
    clean(bike.nickname) ||
    clean(bike.name) ||
    clean(bike.motorcycle_name) ||
    [year, brand, model].filter(Boolean).join(' ') ||
    'Motorcycle';

  return {
    id: bike.motorcycle_id || bike.id || null,
    motorcycle_id: bike.motorcycle_id || bike.id || null,
    motorcycle_name: name,
    name,
    brand,
    model,
    year,
    color: clean(bike.color),
    plate_number: clean(bike.plate_number || bike.plateNumber),
    motorcycle_image: image,
    image,
    photo_url: bike.photo_url || bike.photoUrl || image,
    user_id: bike.user_id || null,
    customer_id: bike.customer_id || null,
    customer_email: bike.customer_email || null,
    is_primary: Boolean(bike.is_primary),
    raw: bike,
  };
}

export function normalizeProduct(product, options = {}) {
  if (!product && !options.uploadedImage) return null;

  if (options.uploadedImage) {
    const category = clean(options.category);
    const meta = resolveInstallationMetadata({
      category,
      name: options.name || category || 'Uploaded part',
      description: options.description || '',
      brand: options.brand || '',
      installation_position: options.installation_position,
      installation_type: options.installation_type,
      installation_description: options.installation_description,
      camera_view: options.camera_view,
    });

    return {
      id: options.product_id || `upload-${Date.now()}`,
      product_id: options.product_id || null,
      product_name: clean(options.name) || meta.category || 'Uploaded part',
      name: clean(options.name) || meta.category || 'Uploaded part',
      brand: clean(options.brand) || 'Custom',
      category: meta.category,
      product_image: options.uploadedImage,
      image: options.uploadedImage,
      description: clean(options.description),
      installation_position: meta.installation_position,
      installation_type: meta.installation_type,
      installation_description: meta.installation_description,
      camera_view: meta.camera_view,
      compatible_motorcycles: Array.isArray(options.compatible_motorcycles)
        ? options.compatible_motorcycles
        : [],
      source: 'upload',
      raw: null,
    };
  }

  const id = product.product_id || product.id || null;
  const image = productImageUri(product);
  const meta = resolveInstallationMetadata(product);
  const compatible =
    options.compatible_motorcycles ||
    product.compatible_motorcycles ||
    product.compatibleMotorcycles ||
    [];

  return {
    id,
    product_id: id,
    product_name: clean(product.name || product.product_name),
    name: clean(product.name || product.product_name),
    brand: clean(product.brand),
    category: clean(product.category) || meta.category,
    product_image: image,
    image,
    description: clean(product.description),
    price: product.price,
    installation_position:
      clean(product.installation_position) || meta.installation_position,
    installation_type: clean(product.installation_type) || meta.installation_type,
    installation_description:
      clean(product.installation_description) || meta.installation_description,
    camera_view: clean(product.camera_view) || meta.camera_view,
    compatible_motorcycles: Array.isArray(compatible) ? compatible : [],
    compatibility_label: clean(product.compatibility),
    source: 'catalog',
    raw: product,
  };
}

export function getProductKey(product) {
  return clean(product?.product_id ?? product?.id ?? '');
}

export function validateInstallSession({
  motorcycle,
  product,
  products,
  partMode,
  uploadCategory,
} = {}) {
  if (!motorcycle) {
    return {
      ok: false,
      message: 'Please select a motorcycle before generating the preview.',
    };
  }
  if (!motorcycle.motorcycle_image && !motorcycle.image) {
    return {
      ok: false,
      message: 'Please select a motorcycle with a valid photo before generating the preview.',
    };
  }

  const list =
    Array.isArray(products) && products.length > 0
      ? products.filter(Boolean)
      : product
        ? [product]
        : [];

  if (list.length === 0) {
    return {
      ok: false,
      message: 'Please select at least 1 motorcycle part before generating the preview.',
    };
  }
  if (list.length > MAX_SELECTED_PRODUCTS) {
    return {
      ok: false,
      message: 'You can select a maximum of 3 products.',
    };
  }

  const keys = list.map((p) => getProductKey(p)).filter(Boolean);
  if (keys.length > 1 && new Set(keys).size !== keys.length) {
    return {
      ok: false,
      message: 'Duplicate products cannot be selected in the same customization session.',
    };
  }

  const missingPhotoPart = list.find((p) => !p.product_image && !p.image);
  if (missingPhotoPart) {
    return {
      ok: false,
      message: `Selected part "${clean(missingPhotoPart.name || missingPhotoPart.product_name) || 'part'}" does not have a valid photo.`,
    };
  }

  if (partMode === 'upload' && !clean(uploadCategory || list[0]?.category)) {
    return {
      ok: false,
      message: 'What type of motorcycle part is this? Please select a category before generating.',
    };
  }
  return { ok: true, message: '' };
}

function normText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isUniversal(brand, model) {
  const b = normText(brand);
  const m = normText(model);
  return b === 'universal' || m === 'all models' || m === 'all' || m === 'universal';
}

function brandModelMatch(aBrand, aModel, bBrand, bModel) {
  if (isUniversal(bBrand, bModel) || isUniversal(aBrand, aModel)) return true;
  const ab = normText(aBrand);
  const am = normText(aModel);
  const bb = normText(bBrand);
  const bm = normText(bModel);
  if (!ab || !am || !bb || !bm) return false;
  const brandOk = ab === bb || ab.includes(bb) || bb.includes(ab);
  const modelOk = am === bm || am.includes(bm) || bm.includes(am);
  return brandOk && modelOk;
}

/**
 * @returns {{ status: 'compatible'|'incompatible'|'unavailable', warning: string|null }}
 */
export function evaluateCompatibility(motorcycle, product) {
  if (!motorcycle || !product) {
    return { status: 'unavailable', warning: null };
  }

  const compatLabel = normText(product.compatibility_label || product.compatibility);
  if (compatLabel.includes('universal')) {
    return { status: 'compatible', warning: null };
  }

  const rows = Array.isArray(product.compatible_motorcycles)
    ? product.compatible_motorcycles
    : [];

  if (!rows.length) {
    return {
      status: 'unavailable',
      warning: null,
      instructAi:
        'Compatibility information is unavailable. Prioritize a mechanically realistic installation for this motorcycle and part.',
    };
  }

  const hit = rows.some((row) =>
    brandModelMatch(motorcycle.brand, motorcycle.model, row.brand, row.model)
  );

  if (hit) {
    return { status: 'compatible', warning: null };
  }

  return {
    status: 'incompatible',
    warning:
      'This part may not be compatible with your selected motorcycle. Please verify compatibility before installation.',
  };
}

/**
 * Evaluate compatibility across 1..3 selected products against the active motorcycle.
 */
export function evaluateMultiCompatibility(motorcycle, products = []) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];
  if (!motorcycle || list.length === 0) {
    return { status: 'unavailable', warning: null, incompatibleNames: [] };
  }

  const incompatibleNames = [];
  let hasUnavailable = false;

  list.forEach((prod) => {
    const res = evaluateCompatibility(motorcycle, prod);
    if (res.status === 'incompatible') {
      incompatibleNames.push(clean(prod.product_name || prod.name) || 'Selected part');
    } else if (res.status === 'unavailable') {
      hasUnavailable = true;
    }
  });

  if (incompatibleNames.length > 0) {
    const warning =
      list.length === 1
        ? 'This part may not be compatible with your selected motorcycle. Please verify compatibility before installation.'
        : `Compatibility notice: ${incompatibleNames.join(', ')} may not be listed as compatible with your selected motorcycle. Please verify fitment before installation.`;
    return {
      status: 'incompatible',
      warning,
      incompatibleNames,
    };
  }

  if (hasUnavailable) {
    return {
      status: 'unavailable',
      warning: null,
      incompatibleNames: [],
      instructAi:
        'Compatibility information is partially unavailable. Prioritize mechanically realistic mounting positions for all selected parts on this motorcycle.',
    };
  }

  return { status: 'compatible', warning: null, incompatibleNames: [] };
}

export function buildInstallationPrompt({
  motorcycle,
  product,
  products,
  customNotes = '',
  compatibilityNote = '',
} = {}) {
  const list = (
    Array.isArray(products) && products.length > 0
      ? products.filter(Boolean)
      : product
        ? [product]
        : []
  ).slice(0, MAX_SELECTED_PRODUCTS);

  const year = clean(motorcycle?.year) || 'selected';
  const motorcycleModel =
    [clean(motorcycle?.brand), clean(motorcycle?.model)].filter(Boolean).join(' ') ||
    clean(motorcycle?.motorcycle_name) ||
    'motorcycle';
  const colorLine = motorcycle?.color
    ? `Preserve the motorcycle color (${motorcycle.color}).`
    : '';
  const notes = clean(customNotes);
  const compat = clean(compatibilityNote);

  if (list.length <= 1) {
    const single = list[0] || product || {};
    const productCategory = clean(single?.category) || 'motorcycle part';
    const productName = clean(single?.product_name || single?.name) || 'selected part';
    const productBrand = clean(single?.brand) || 'the selected brand';
    const installationPosition =
      clean(single?.installation_position) || DEFAULT_INSTALLATION.position;
    const installationType = clean(single?.installation_type) || DEFAULT_INSTALLATION.type;
    const installationDescription =
      clean(single?.installation_description) || DEFAULT_INSTALLATION.description;
    const cameraView = clean(single?.camera_view) || DEFAULT_INSTALLATION.cameraView;

    return [
      `Use the uploaded image of the ${year} ${motorcycleModel} motorcycle as the PRIMARY motorcycle reference.`,
      '',
      `Use the uploaded image of the selected ${productCategory} named '${productName}' from ${productBrand} as the PRIMARY product reference.`,
      '',
      'Install the EXACT selected product shown in the product reference image onto the selected motorcycle.',
      '',
      'Keep the original motorcycle unchanged. Preserve its body shape, frame, fairings, wheels, tires, suspension, handlebars, seat, engine, lights, mirrors, color, decals, proportions, and overall design.',
      '',
      'Do not replace the motorcycle with another model.',
      '',
      'Do not substitute the selected product with another similar-looking product.',
      '',
      "Preserve the selected product's recognizable shape, design, material, color, finish, dimensions, and important visual details.",
      '',
      'Installation position:',
      installationPosition,
      '',
      'Installation type:',
      installationType,
      '',
      'Installation description:',
      installationDescription,
      '',
      'Install the product in the correct and mechanically realistic position for the selected motorcycle.',
      '',
      'Make the product physically attached using appropriate brackets, bolts, clamps, connectors, mounts, wiring, or other realistic hardware when applicable.',
      '',
      'Ensure correct scale, orientation, perspective, and alignment.',
      '',
      'Do not allow the product to float, intersect incorrectly with the motorcycle, penetrate through body panels, or appear disconnected.',
      '',
      'Do not add any additional aftermarket parts that were not selected by the customer.',
      '',
      'Do not remove motorcycle components unless they would realistically need to be removed or repositioned for the installation.',
      '',
      `Generate a photorealistic commercial studio image of the customized ${year} ${motorcycleModel} with the selected ${productName} professionally installed.`,
      '',
      'Camera view:',
      cameraView,
      '',
      'Keep the entire motorcycle recognizable while making the installed product clearly visible.',
      '',
      'Use realistic lighting, shadows, reflections, materials, proportions, and perspective.',
      '',
      "The result must look like an authentic photograph of the customer's motorcycle with the selected part installed, not a cartoon or redesigned motorcycle.",
      '',
      'BACKGROUND & ENVIRONMENT FIDELITY (CRITICAL):',
      '- Preserve the exact background and environment from REFERENCE IMAGE 1.',
      '- If REFERENCE IMAGE 1 has a solid white, neutral studio, seamless backdrop, or plain cutout background, the output MUST have the exact same clean, solid white / seamless neutral studio background with only subtle natural contact shadow beneath the wheels.',
      '- Do NOT place the motorcycle inside a garage, repair shop, mechanic workshop, tool bay, street, or outdoor environment unless REFERENCE IMAGE 1 itself was already in that environment.',
      '- Do NOT generate background clutter, tools, tire machines, lifts, workbenches, or mechanics.',
      '- Match the camera angle, framing, perspective, and clean studio atmosphere of REFERENCE IMAGE 1 exactly.',
      '',
      'IMPORTANT:',
      "Use the customer's motorcycle image as the primary motorcycle identity reference.",
      '',
      'Use the selected product image as the primary product identity reference.',
      '',
      'REFERENCE IMAGE 1 = motorcycle identity, appearance, and background environment.',
      'REFERENCE IMAGE 2 = exact product identity and appearance.',
      'Do not use the product image as the motorcycle reference.',
      'Do not use the motorcycle image as the product reference.',
      '',
      'Install ONLY the selected product.',
      '',
      'Do not substitute the motorcycle.',
      '',
      'Do not substitute the product.',
      '',
      'Preserve the original motorcycle body and silhouette.',
      'Preserve the original background environment from REFERENCE IMAGE 1.',
      'Do not alter the background into a repair shop or garage.',
      '',
      'Prioritize physical and mechanical realism.',
      '',
      colorLine || null,
      compat || null,
      notes ? `Customer installation notes: ${notes}` : null,
      '',
      'Generate the final photorealistic installation preview.',
    ]
      .filter((line) => line != null)
      .join('\n');
  }

  // Multi-product (2 or 3 selected products) combined single-image installation prompt
  const totalParts = list.length;
  const summaryNames = list
    .map((p) => `'${clean(p?.product_name || p?.name) || 'selected part'}'`)
    .join(', ');

  const perPartBlocks = list.map((p, idx) => {
    const refIndex = idx + 2;
    const pCat = clean(p?.category) || 'motorcycle part';
    const pName = clean(p?.product_name || p?.name) || `selected part ${idx + 1}`;
    const pBrand = clean(p?.brand) || 'the selected brand';
    const pPos = clean(p?.installation_position) || DEFAULT_INSTALLATION.position;
    const pType = clean(p?.installation_type) || DEFAULT_INSTALLATION.type;
    const pDesc = clean(p?.installation_description) || DEFAULT_INSTALLATION.description;

    return [
      `SELECTED PART ${idx + 1} OF ${totalParts} — REFERENCE IMAGE ${refIndex} (PRIMARY product reference #${idx + 1}):`,
      `- Product: '${pName}' (${pCat}) by ${pBrand}`,
      `- Installation position: ${pPos}`,
      `- Installation type: ${pType}`,
      `- Installation description: ${pDesc}`,
    ].join('\n');
  });

  const referenceLegend = [
    'REFERENCE IMAGE 1 = primary motorcycle identity, body, frame, proportions, paint colors, and background environment.',
    ...list.map(
      (p, idx) =>
        `REFERENCE IMAGE ${idx + 2} = exact product identity and visual appearance for Selected Part ${idx + 1} ('${clean(p?.product_name || p?.name) || `Part ${idx + 1}`}').`
    ),
  ].join('\n');

  return [
    `Use the uploaded image of the ${year} ${motorcycleModel} motorcycle (REFERENCE IMAGE 1) as the PRIMARY motorcycle reference.`,
    '',
    `Use the ${totalParts} uploaded product images (REFERENCE IMAGE 2 through REFERENCE IMAGE ${totalParts + 1}) for ${summaryNames} as the PRIMARY product reference images.`,
    '',
    `Install ALL ${totalParts} selected aftermarket parts SIMULTANEOUSLY onto the single ${year} ${motorcycleModel} motorcycle in ONE combined photorealistic installation preview.`,
    '',
    ...perPartBlocks.flatMap((block) => [block, '']),
    'COMBINED MULTI-PART INSTALLATION RULES:',
    `- Generate ONE unified photograph of the single ${year} ${motorcycleModel} motorcycle with ALL ${totalParts} selected parts (${summaryNames}) installed together at the same time.`,
    '- Do NOT generate separate images for individual products, and do NOT output split screens, collages, grids, or floating part insets.',
    `- Ensure EVERY selected part (all ${totalParts} of ${totalParts}) is clearly visible, accurately scaled, and mounted in its mechanically realistic location using proper brackets, bolts, clamps, mounts, or hardware.`,
    '- Preserve the original motorcycle body, frame, fairings, proportions, colors, decals, and all other unrelated stock components that are not being replaced by the selected parts.',
    '- Do not replace the motorcycle with another model, and do not substitute any selected product with a generic alternative.',
    '- Preserve each selected product’s recognizable shape, design, material, color, finish, and visual details.',
    '- Apply ONLY the selected aftermarket parts. Do not add any unselected modifications.',
    '',
    'Camera view:',
    `Full 3/4 studio view matching REFERENCE IMAGE 1 framing so the entire ${year} ${motorcycleModel} and all ${totalParts} installed parts (${summaryNames}) are clearly visible.`,
    '',
    'BACKGROUND & ENVIRONMENT FIDELITY (CRITICAL):',
    '- Preserve the exact background and environment from REFERENCE IMAGE 1.',
    '- If REFERENCE IMAGE 1 has a solid white, neutral studio, seamless backdrop, or plain cutout background, the output MUST have the exact same clean, solid white / seamless neutral studio background with only subtle natural contact shadow beneath the wheels.',
    '- Do NOT place the motorcycle inside a garage, repair shop, mechanic workshop, tool bay, street, or outdoor environment unless REFERENCE IMAGE 1 itself was already in that environment.',
    '- Do NOT generate background clutter, tools, tire machines, lifts, workbenches, people, riders, hands, or mechanics.',
    '',
    'IMPORTANT REFERENCE MAPPING:',
    referenceLegend,
    '',
    colorLine || null,
    compat || null,
    notes ? `Customer installation notes: ${notes}` : null,
    '',
    `Generate the ONE combined photorealistic installation preview showing all ${totalParts} selected parts installed on the motorcycle.`,
  ]
    .filter((line) => line != null)
    .join('\n');
}

export function logInstallSessionSelection({ motorcycle, product, products } = {}) {
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;
  const list =
    Array.isArray(products) && products.length > 0
      ? products.filter(Boolean)
      : product
        ? [product]
        : [];
  console.info('[InstallStudio] pre-generation selection verify', {
    selectedMotorcycleId: motorcycle?.motorcycle_id || motorcycle?.id || null,
    selectedMotorcycleName: motorcycle?.motorcycle_name || motorcycle?.name || null,
    selectedMotorcycleImage: motorcycle?.motorcycle_image || motorcycle?.image || null,
    selectedProductsCount: list.length,
    selectedProducts: list.map((p) => ({
      id: p?.product_id || p?.id || null,
      name: p?.product_name || p?.name || null,
      brand: p?.brand || null,
      image: p?.product_image || p?.image || null,
      installation_position: p?.installation_position || null,
    })),
  });
}

export function createInstallResult({
  motorcycle,
  product,
  products,
  generatedImageUrl,
  generatedPrompt,
  cameraView,
} = {}) {
  const list =
    Array.isArray(products) && products.length > 0
      ? products.filter(Boolean)
      : product
        ? [product]
        : [];
  const primary = list[0] || product || null;
  const combinedNames = list
    .map((p) => p?.product_name || p?.name)
    .filter(Boolean)
    .join(', ');

  return {
    motorcycle_id: motorcycle?.motorcycle_id || motorcycle?.id || null,
    motorcycle_name:
      motorcycle?.motorcycle_name ||
      motorcycle?.name ||
      [motorcycle?.year, motorcycle?.brand, motorcycle?.model].filter(Boolean).join(' ') ||
      null,
    product_id: primary?.product_id || primary?.id || null,
    product_name: combinedNames || primary?.product_name || primary?.name || null,
    product_ids: list.map((p) => p?.product_id || p?.id).filter(Boolean),
    products: list.map((p) => ({
      product_id: p?.product_id || p?.id || null,
      product_name: p?.product_name || p?.name || null,
      brand: p?.brand || null,
      price: Number(p?.price ?? p?.raw?.price) || 0,
      image: p?.product_image || p?.image || null,
    })),
    generated_image_url: generatedImageUrl || null,
    generated_prompt: generatedPrompt || '',
    generation_timestamp: new Date().toISOString(),
    camera_view: cameraView || primary?.camera_view || DEFAULT_INSTALLATION.cameraView,
  };
}

export const MIN_CANVAS_ZOOM = 0.75;
export const MAX_CANVAS_ZOOM = 3.5;
export const CLICK_ZOOM_TARGET = 2;

export function clampCanvasZoom(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, Math.round(num * 1000) / 1000));
}

export function clampCanvasPan(x, y, scale, viewportWidth = 640, viewportHeight = 540) {
  const s = Number(scale);
  if (!Number.isFinite(s) || s <= 1) {
    return { x: 0, y: 0 };
  }
  const w = Math.max(120, Number(viewportWidth) || 640);
  const h = Math.max(120, Number(viewportHeight) || 540);
  const maxX = ((s - 1) * w) / 2;
  const maxY = ((s - 1) * h) / 2;
  const clampedX = Math.min(maxX, Math.max(-maxX, Number(x) || 0));
  const clampedY = Math.min(maxY, Math.max(-maxY, Number(y) || 0));
  return {
    x: Math.round(clampedX * 100) / 100,
    y: Math.round(clampedY * 100) / 100,
  };
}

/**
 * Computes next { scale, x, y } so the image point directly under cursor offset
 * (cursorOffsetX, cursorOffsetY) — relative to the viewport center — remains
 * pinned under the cursor after scaling.
 */
export function computeCursorAnchoredZoom({
  prevScale = 1,
  prevX = 0,
  prevY = 0,
  targetScale = 1,
  cursorOffsetX = 0,
  cursorOffsetY = 0,
  viewportWidth = 640,
  viewportHeight = 540,
} = {}) {
  const safePrevScale = clampCanvasZoom(prevScale);
  const nextScale = clampCanvasZoom(targetScale);
  if (nextScale <= 1) {
    return { scale: nextScale, x: 0, y: 0 };
  }
  const ratio = nextScale / safePrevScale;
  const rawX = cursorOffsetX - (cursorOffsetX - (Number(prevX) || 0)) * ratio;
  const rawY = cursorOffsetY - (cursorOffsetY - (Number(prevY) || 0)) * ratio;
  const clamped = clampCanvasPan(rawX, rawY, nextScale, viewportWidth, viewportHeight);
  return {
    scale: nextScale,
    x: clamped.x,
    y: clamped.y,
  };
}
