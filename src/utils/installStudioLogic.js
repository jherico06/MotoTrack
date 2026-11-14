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
    keys: ['exhaust', 'muffler', 'silencer', 'slip-on', 'slip on', 'pipe'],
    partCategory: 'Exhaust',
    position: 'Rear / engine exhaust mounting area',
    type: 'Bolt-on exhaust system installation',
    description:
      'Completely remove the stock OEM exhaust muffler/canister and mount the exact aftermarket exhaust from the product reference image at the exhaust header outlet and rear passenger peg hanger bracket. Keep the swingarm, rear shock, rear wheel, and brake assembly untouched.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['mirror', 'side mirror', 'rearview'],
    partCategory: 'Side Mirror',
    position: 'Handlebar / mirror mounting point',
    type: 'Handlebar mount replacement',
    description:
      'Completely REMOVE both original OEM side mirrors AND their tall stock wire stems from the left and right handlebars. Install a matching left-and-right pair of the exact aftermarket side mirrors (using their own short low-profile black CNC/folding stems shown in the product image) directly onto the left and right handlebar mounts. CRITICAL 3D ORIENTATION (NO BLUE GLASS FACING FORWARD): Product photos of side mirrors often show two mirrors (one showing the rider-facing blue glass side, and one showing the forward-facing matte black ribbed pentagon back housing shell). When the motorcycle in REFERENCE IMAGE 1 is viewed from the front or front-3/4 angle (camera in front of the headlight), BOTH installed left and right mirrors MUST show ONLY their solid MATTE BLACK RIBBED BACK HOUSING SHELL facing toward the camera — ZERO blue mirror glass may be visible from the front of the motorcycle! Ignore any duplicate display mirror or unmounted clamp adapter lying beside the mirror in the product photo.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['brake disc', 'brake disk', 'rotor', 'disc brake'],
    partCategory: 'Brake Disc',
    position: 'Wheel hub / brake assembly',
    type: 'Hub-mounted brake disc installation',
    description:
      'Mount the exact brake disc rotor onto the wheel hub/brake assembly with correct carrier color, outer rotor ring pattern, bolt alignment, and caliper clearance.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['brake', 'caliper', 'master cylinder', 'lever'],
    partCategory: 'Brake Component',
    position: 'Wheel hub / brake assembly or handlebar lever perch',
    type: 'Brake component installation',
    description:
      'Install the brake component at the exact lower fork caliper mount (or handlebar lever perch for levers/master cylinders) with realistic alignment and hardware.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['top box', 'topcase', 'top case', 'luggage', 'trunk'],
    partCategory: 'Top Box',
    position: 'Rear luggage rack',
    type: 'Rear rack mount installation',
    description:
      'Secure the top box onto the rear luggage rack behind the passenger seat using the proper baseplate, latches, and hardware, oriented correctly facing forward.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['crash guard', 'crash bar', 'engine guard', 'cage', 'slider'],
    partCategory: 'Crash Guard',
    position: 'Frame / engine mounting area',
    type: 'Frame-mounted crash protection',
    description:
      'Attach the crash guard to the motorcycle frame/engine mounting points with bolts and brackets so it wraps protectively around the engine/fairing area.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['headlight', 'led headlight', 'head lamp'],
    partCategory: 'Headlight',
    position: 'Front headlight housing',
    type: 'Headlight housing replacement',
    description:
      'Install the headlight assembly cleanly inside the front headlight housing with correct lens, bezel alignment, and reflectors while keeping surrounding fairing colors unchanged.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['tail light', 'taillight', 'signal', 'indicator', 'led'],
    partCategory: 'Lighting',
    position: 'Lighting mount / housing',
    type: 'Lighting component installation',
    description:
      'Install the lighting part in the correct housing or mount with realistic lens detail and alignment for that motorcycle.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['rim', 'wheel', 'alloy', 'spoke', 'mag'],
    partCategory: 'Wheel/Rim',
    position: 'Front and rear wheel hub / axle assemblies',
    type: 'Front and rear wheel rim replacement',
    description:
      'Replace BOTH the front and rear wheel assemblies inside the motorcycle’s existing black rubber tires with the exact rim and hub from the product reference image. Match BOTH the outer rim lip color/anodized finish (plus white rim decal/sticker) AND the center wheel hub color (if the center hub in the product reference image is glossy anodized red, render the installed front and rear wheel center hubs in that exact glossy anodized red!), while keeping the wire spokes bright metallic silver/white with black spoke nipples (do NOT tint the silver wire spokes red!). CRITICAL: Preserve the exact front and rear brake mechanism from REFERENCE IMAGE 1 (if REFERENCE IMAGE 1 has a front drum brake with cable, keep the drum brake mechanism — do NOT invent or add a disc brake rotor or caliper!). Ignore any shop counter, glass display case, floor, or background behind the bare rim in the product photo.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['handlebar', 'bar end', 'grip', 'riser', 'throttle'],
    partCategory: 'Handlebar',
    position: 'Handlebar / controls area',
    type: 'Handlebar component installation',
    description:
      'Install the handlebar part at the cockpit controls/grip ends with realistic left-right symmetry, clamp, control, and cable alignment.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['suspension', 'fork', 'shock', 'absorber', 'monoshock'],
    partCategory: 'Suspension',
    position: 'Front fork or rear suspension mount',
    type: 'Suspension component installation',
    description:
      'Replace the suspension component at the exact front fork or rear shock mounting points with matching spring color, reservoir canister, and damper body.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['fairing', 'body', 'cowling', 'cover', 'fender', 'windshield', 'visor'],
    partCategory: 'Body/Fairing',
    position: 'Body panel / fairing mounting points',
    type: 'Bodywork installation',
    description:
      'Fit the body/fairing/windshield part onto the matching mounting points while preserving all other motorcycle panels and factory paint.',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
  {
    keys: ['seat', 'saddle'],
    partCategory: 'Seat',
    position: 'Seat mount / subframe',
    type: 'Seat replacement',
    description:
      'Replace ONLY the seat cushion/upholstery on the subframe with the exact seat cover material, surface texture (such as horizontal ribbed non-slip grip lines), and rear top brand emblem/logo from the product reference image, foreshortened naturally in 3D perspective to match REFERENCE IMAGE 1’s viewing angle. CRITICAL: Keep the original 3D seat profile/thickness and DO NOT remove, cover, or alter the rear passenger grab bar / pillion handle behind the seat!',
    cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
  },
];

const DEFAULT_INSTALLATION = Object.freeze({
  position: 'Correct OEM mounting location for this part category',
  type: 'Mechanically realistic bolt-on installation',
  description:
    'Install the selected part using the correct mounts, brackets, bolts, clamps, connectors, or wiring for this motorcycle and part type without altering unrelated motorcycle components.',
  cameraView: 'Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1',
});

const MARKETING_TAG_VALUES = new Set([
  'newarrival',
  'new arrival',
  'bestseller',
  'best seller',
  'featured',
  'hot',
  'sale',
  'promo',
  'default',
]);

const GENERIC_BOILERPLATE_DESCRIPTIONS = new Set([
  'precision engineered high performance motorcycle upgrade component.',
  'precision engineered high performance motorcycle upgrade component',
]);

function cleanCategoryValue(rawCategory) {
  const val = clean(rawCategory);
  if (!val) return '';
  if (MARKETING_TAG_VALUES.has(val.toLowerCase())) return '';
  return val;
}

function sanitizePartBrand(brand, partCategory, partName) {
  const b = clean(brand);
  if (!b) return '';
  const lowerBrand = b.toLowerCase();
  const hay = `${lower(partCategory)} ${lower(partName)}`;
  // Guard against default exhaust brand ('Akrapovič') left on non-exhaust items like RIM/Seat/Mirror
  if (
    (lowerBrand.includes('akrapov') || lowerBrand.includes('yoshimura') || lowerBrand.includes('sc project')) &&
    !hay.includes('exhaust') &&
    !hay.includes('muffler') &&
    !hay.includes('pipe') &&
    !hay.includes('slip')
  ) {
    return '';
  }
  return b;
}

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
  const rawCategory = cleanCategoryValue(source.category || source.product_type || source.type);
  const name = clean(source.name || source.product_name);
  const rawDesc = clean(source.description || source.product_description);
  const description = GENERIC_BOILERPLATE_DESCRIPTIONS.has(rawDesc.toLowerCase()) ? '' : rawDesc;
  const guide = matchInstallationGuide(rawCategory, name, description);

  const resolvedCategory =
    guide?.partCategory && (!rawCategory || rawCategory.toLowerCase() === 'accessories')
      ? guide.partCategory
      : rawCategory || guide?.partCategory || 'Accessories';

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
    category: resolvedCategory,
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
  const cleanName = clean(product.name || product.product_name);
  const compatible =
    options.compatible_motorcycles ||
    product.compatible_motorcycles ||
    product.compatibleMotorcycles ||
    [];

  return {
    id,
    product_id: id,
    product_name: cleanName,
    name: cleanName,
    brand: sanitizePartBrand(product.brand, meta.category, cleanName) || clean(product.brand),
    category: meta.category || cleanCategoryValue(product.category) || 'Accessories',
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
  const colorLine =
    'Preserve the exact factory paint colors, two-tone fairing finishes, front fender color, headlight cowl color, and factory decals visible in REFERENCE IMAGE 1 (do NOT repaint or recolor any body panels).';
  const notes = clean(customNotes);
  const compat = clean(compatibilityNote);

  if (list.length <= 1) {
    const single = list[0] || product || {};
    const resolvedMeta = resolveInstallationMetadata(single);
    const productCategory =
      cleanCategoryValue(single?.category) || resolvedMeta.category || 'motorcycle part';
    const productName = clean(single?.product_name || single?.name) || 'selected part';
    const safeBrand = sanitizePartBrand(single?.brand, productCategory, productName);
    const brandClause = safeBrand ? ` from ${safeBrand}` : '';
    const installationPosition =
      clean(single?.installation_position) || resolvedMeta.installation_position;
    const installationType = clean(single?.installation_type) || resolvedMeta.installation_type;
    const installationDescription =
      clean(single?.installation_description) || resolvedMeta.installation_description;
    const cameraView = clean(single?.camera_view) || resolvedMeta.camera_view;

    return [
      `Use the uploaded image of the ${year} ${motorcycleModel} motorcycle as the PRIMARY motorcycle reference.`,
      '',
      `Use the uploaded image of the selected ${productCategory} named '${productName}'${brandClause} as the PRIMARY product reference.`,
      '',
      'TASK: PRECISION IN-PLACE PHOTO EDITING (SURGICAL COMPONENT REPLACEMENT ON REFERENCE IMAGE 1).',
      'Install the EXACT selected product shown in the product reference image onto the selected motorcycle in REFERENCE IMAGE 1.',
      '',
      'Keep the original motorcycle unchanged everywhere outside the replaced part. Preserve its exact camera angle, pose, framing, body shape, frame, fairings, front fender, headlight cowl, rear passenger grab bar (pillion rail), brake system type (drum vs disc), wheels, tires, suspension, handlebars, seat, engine, lights, mirrors, exact panel colors, decals, proportions, and overall design.',
      '',
      'Do not replace the motorcycle with another model.',
      '',
      'Do not substitute the selected product with another similar-looking product.',
      '',
      "Preserve the selected product's recognizable shape, design, material, color, finish, sub-component colors, logos, dimensions, and important visual details.",
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
      'Install the product in the correct and mechanically realistic 3D position and orientation for the camera angle of REFERENCE IMAGE 1.',
      '',
      'Make the product physically attached using appropriate brackets, bolts, clamps, connectors, mounts, wiring, or other realistic hardware when applicable, and completely remove the original stock part it replaces (do not leave old OEM mirror stems or old parts stacked under the new part).',
      '',
      'Ensure correct scale, 3D orientation, perspective foreshortening, and alignment.',
      '',
      'Ignore any shop counter, table, floor, packaging, or duplicate display angle shown in the product reference photo — extract ONLY the physical motorcycle part itself.',
      '',
      'Do not allow the product to float, intersect incorrectly with the motorcycle, penetrate through body panels, or appear disconnected.',
      '',
      'Do not add any additional aftermarket parts that were not selected by the customer (for example, do NOT convert a drum brake into a disc brake unless a brake disc was selected, and do NOT delete the rear passenger grab bar behind the seat).',
      '',
      'Do not remove motorcycle components unless they are the exact stock component being replaced by the selected part.',
      '',
      `Return an authentic, surgically edited studio photograph of the ${year} ${motorcycleModel} from REFERENCE IMAGE 1 with the selected ${productName} professionally installed.`,
      '',
      'Camera view:',
      cameraView,
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
      'Do not substitute the motorcycle.',
      'Do not substitute the product.',
      'Preserve the original motorcycle body and silhouette.',
      'Preserve the original background environment from REFERENCE IMAGE 1.',
      'Do not alter the background into a repair shop or garage.',
      'Prioritize physical and mechanical realism.',
      '',
      colorLine,
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
    const resolvedMeta = resolveInstallationMetadata(p);
    const pCat = cleanCategoryValue(p?.category) || resolvedMeta.category || 'motorcycle part';
    const pName = clean(p?.product_name || p?.name) || `selected part ${idx + 1}`;
    const safeBrand = sanitizePartBrand(p?.brand, pCat, pName);
    const brandSuffix = safeBrand ? ` by ${safeBrand}` : '';
    const pPos = clean(p?.installation_position) || resolvedMeta.installation_position;
    const pType = clean(p?.installation_type) || resolvedMeta.installation_type;
    const pDesc = clean(p?.installation_description) || resolvedMeta.installation_description;

    return [
      `SELECTED PART ${idx + 1} OF ${totalParts} — REFERENCE IMAGE ${refIndex} (PRIMARY product reference #${idx + 1}):`,
      `- Product: '${pName}' (Category: ${pCat})${brandSuffix}`,
      `- Installation position: ${pPos}`,
      `- Installation type: ${pType}`,
      `- Installation description: ${pDesc}`,
    ].join('\n');
  });

  const referenceLegend = [
    'REFERENCE IMAGE 1 = primary motorcycle identity, exact camera angle, body, frame, proportions, exact panel paint colors, decals, brake hardware, rear passenger grab rail, and background environment.',
    ...list.map((p, idx) => {
      const resolvedMeta = resolveInstallationMetadata(p);
      const pCat = cleanCategoryValue(p?.category) || resolvedMeta.category || 'part';
      return `REFERENCE IMAGE ${idx + 2} = exact product identity and visual appearance for Selected Part ${idx + 1} ('${clean(p?.product_name || p?.name) || `Part ${idx + 1}`}' — ${pCat}). Extract ONLY the physical part from this photo and ignore any shop counter, table, or duplicate display angle.`;
    }),
  ].join('\n');

  return [
    `Use the uploaded image of the ${year} ${motorcycleModel} motorcycle (REFERENCE IMAGE 1) as the PRIMARY motorcycle reference.`,
    '',
    `Use the ${totalParts} uploaded product images (REFERENCE IMAGE 2 through REFERENCE IMAGE ${totalParts + 1}) for ${summaryNames} as the PRIMARY product reference images.`,
    '',
    'TASK: PRECISION IN-PLACE PHOTO EDITING (SURGICAL MULTI-PART REPLACEMENT ON REFERENCE IMAGE 1).',
    `Install ALL ${totalParts} selected aftermarket parts SIMULTANEOUSLY onto the single ${year} ${motorcycleModel} motorcycle from REFERENCE IMAGE 1 in ONE combined photorealistic installation preview.`,
    '',
    ...perPartBlocks.flatMap((block) => [block, '']),
    'COMBINED MULTI-PART INSTALLATION & FIDELITY RULES:',
    `- Perform a surgical in-place edit of REFERENCE IMAGE 1 so the single ${year} ${motorcycleModel} motorcycle has ALL ${totalParts} selected parts (${summaryNames}) installed together at the same time.`,
    '- Do NOT generate separate images for individual products, and do NOT output split screens, collages, grids, or floating part insets.',
    `- Ensure EVERY selected part (all ${totalParts} of ${totalParts}) is clearly visible, accurately scaled, properly oriented in 3D perspective for REFERENCE IMAGE 1’s viewing angle, and mounted in its mechanically realistic location.`,
    '- Completely remove each replaced stock OEM part (for example, when replacing side mirrors, completely remove both stock mirror heads AND their tall stock wire stems so only the new aftermarket mirror stems and housings are mounted).',
    '- For side mirrors: reflective mirror glass MUST face rearward toward the rider/seat — when the motorcycle in REFERENCE IMAGE 1 faces front or front-3/4, the viewer MUST see the back outer shell/housing of the mirrors facing forward and their short stems, NEVER both blue mirror glasses facing forward toward the headlight!',
    '- For wheel rims: apply the exact rim lip color, rim decal, spoke color (keep bright silver/white wire spokes silver/white and black spoke nipples black — do NOT tint spokes red if only the outer rim ring and center hub are red!), and hub color to BOTH front and rear wheels inside the existing rubber tires, while keeping REFERENCE IMAGE 1’s exact brake type (keep a front drum brake as a drum brake — do NOT invent a disc brake rotor or caliper unless selected!).',
    '- For seats/seat covers: map the top-down seat cover texture (e.g., horizontal ribbed grip lines) and rear top brand logo/emblem onto the existing 3D seat contour in natural foreshortened perspective, and strictly KEEP the rear passenger grab bar / pillion rail behind the seat intact!',
    '- Preserve every other part of REFERENCE IMAGE 1 unchanged: exact camera angle, pose, and panel-by-panel paint colors (for example, if REFERENCE IMAGE 1 has a glossy black front fender and glossy black upper headlight cowl with a gray/silver middle nose fairing, keep the front fender and upper headlight cowl glossy black — never bleed the nose fairing color onto the front fender or headlight cowl!), factory decals, engine, exhaust (unless exhaust is selected), suspension (unless suspension is selected), and proportions.',
    '- Do not replace the motorcycle with another model, and do not substitute any selected product with a generic alternative.',
    '',
    'Camera view:',
    `Exact same camera angle, framing, and perspective as REFERENCE IMAGE 1 showing the entire ${year} ${motorcycleModel} with all ${totalParts} installed parts (${summaryNames}).`,
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
    colorLine,
    compat || null,
    notes ? `Customer installation notes: ${notes}` : null,
    '',
    `Generate the ONE combined photorealistic installation preview showing all ${totalParts} selected parts surgically installed on the motorcycle from REFERENCE IMAGE 1.`,
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
