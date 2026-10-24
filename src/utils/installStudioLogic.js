/**
 * Functional helpers for AI Install Studio.
 * Keeps motorcycle/product association, installation metadata, and prompts accurate.
 */

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

export function validateInstallSession({ motorcycle, product, partMode, uploadCategory } = {}) {
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
  if (!product) {
    return {
      ok: false,
      message: 'Please select a motorcycle part before generating the preview.',
    };
  }
  if (!product.product_image && !product.image) {
    return {
      ok: false,
      message: 'Please select a motorcycle part with a valid photo before generating the preview.',
    };
  }
  if (partMode === 'upload' && !clean(uploadCategory || product.category)) {
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

export function buildInstallationPrompt({
  motorcycle,
  product,
  customNotes = '',
  compatibilityNote = '',
} = {}) {
  const year = clean(motorcycle?.year) || 'selected';
  const motorcycleModel =
    [clean(motorcycle?.brand), clean(motorcycle?.model)].filter(Boolean).join(' ') ||
    clean(motorcycle?.motorcycle_name) ||
    'motorcycle';
  const productCategory = clean(product?.category) || 'motorcycle part';
  const productName = clean(product?.product_name || product?.name) || 'selected part';
  const productBrand = clean(product?.brand) || 'the selected brand';
  const installationPosition =
    clean(product?.installation_position) || DEFAULT_INSTALLATION.position;
  const installationType = clean(product?.installation_type) || DEFAULT_INSTALLATION.type;
  const installationDescription =
    clean(product?.installation_description) || DEFAULT_INSTALLATION.description;
  const cameraView = clean(product?.camera_view) || DEFAULT_INSTALLATION.cameraView;
  const colorLine = motorcycle?.color
    ? `Preserve the motorcycle color (${motorcycle.color}).`
    : '';
  const notes = clean(customNotes);
  const compat = clean(compatibilityNote);

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

export function logInstallSessionSelection({ motorcycle, product } = {}) {
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;
  console.info('[InstallStudio] pre-generation selection verify', {
    selectedMotorcycleId: motorcycle?.motorcycle_id || motorcycle?.id || null,
    selectedMotorcycleName: motorcycle?.motorcycle_name || motorcycle?.name || null,
    selectedMotorcycleImage: motorcycle?.motorcycle_image || motorcycle?.image || null,
    selectedProductId: product?.product_id || product?.id || null,
    selectedProductName: product?.product_name || product?.name || null,
    selectedProductImage: product?.product_image || product?.image || null,
    installation_position: product?.installation_position || null,
    installation_type: product?.installation_type || null,
  });
}

export function createInstallResult({
  motorcycle,
  product,
  generatedImageUrl,
  generatedPrompt,
  cameraView,
} = {}) {
  return {
    motorcycle_id: motorcycle?.motorcycle_id || motorcycle?.id || null,
    motorcycle_name:
      motorcycle?.motorcycle_name ||
      motorcycle?.name ||
      [motorcycle?.year, motorcycle?.brand, motorcycle?.model].filter(Boolean).join(' ') ||
      null,
    product_id: product?.product_id || product?.id || null,
    product_name: product?.product_name || product?.name || null,
    generated_image_url: generatedImageUrl || null,
    generated_prompt: generatedPrompt || '',
    generation_timestamp: new Date().toISOString(),
    camera_view: cameraView || product?.camera_view || DEFAULT_INSTALLATION.cameraView,
  };
}
