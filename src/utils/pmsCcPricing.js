/**
 * Centralized PMS fixed-rate catalog by motorcycle engine displacement (CC).
 * Single source of truth for category matching and service prices (PHP).
 * Do not hardcode PMS rates elsewhere — import from here or from pmsPricingService.
 */

import { formatPhp, roundMoney } from './serviceQuotation.js';

/** @typedef {{ id: string, name: string, minCc: number|null, maxCc: number|null, sortOrder: number }} CcCategory */

export const PMS_UNAVAILABLE = Symbol('PMS_UNAVAILABLE');

/** Browse / filter categories (admin may reassign per service). */
export const CATALOG_CATEGORIES = Object.freeze({
  PMS: 'PMS',
  REPAIR: 'Repair',
});

export const CATALOG_CATEGORY_LABELS = Object.freeze({
  PMS: 'Preventive Maintenance (PMS)',
  Repair: 'Repair Services',
});

/** Initial CC categories — extend via DB / admin without changing booking flow. */
export const DEFAULT_CC_CATEGORIES = Object.freeze([
  {
    id: 'cc-125-below',
    name: '125cc and Below',
    minCc: 0,
    maxCc: 125,
    sortOrder: 1,
  },
  {
    id: 'cc-150-160',
    name: '150cc–160cc',
    minCc: 150,
    maxCc: 160,
    sortOrder: 2,
  },
  {
    id: 'cc-big-bikes',
    name: '200cc above',
    minCc: 200,
    maxCc: null,
    sortOrder: 3,
  },
]);

/**
 * 22 fixed-rate services (PMS + Repair).
 * Prices keyed by CC category id; `null` = Price not configured / Not Available (never ₱0).
 */
export const DEFAULT_PMS_SERVICES = Object.freeze([
  {
    id: 'pms-minor-tune-up',
    sortOrder: 1,
    name: 'Minor Tune Up',
    catalogCategory: 'PMS',
    prices: { 'cc-125-below': 300, 'cc-150-160': 500, 'cc-big-bikes': 700 },
  },
  {
    id: 'pms-major-tune-up',
    sortOrder: 2,
    name: 'Major Tune Up',
    catalogCategory: 'PMS',
    prices: { 'cc-125-below': 1000, 'cc-150-160': 1300, 'cc-big-bikes': 1500 },
  },
  {
    id: 'pms-top-overhaul',
    sortOrder: 3,
    name: 'Top Overhaul',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 1200, 'cc-150-160': 1500, 'cc-big-bikes': 1800 },
  },
  {
    id: 'pms-major-engine-overhaul',
    sortOrder: 4,
    name: 'Major Engine Overhaul',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 2000, 'cc-150-160': 2300, 'cc-big-bikes': 2500 },
  },
  {
    id: 'pms-replace-lubricate-cable',
    sortOrder: 5,
    name: 'Replace/Lubricate Cable',
    catalogCategory: 'PMS',
    prices: { 'cc-125-below': 300, 'cc-150-160': 350, 'cc-big-bikes': 400 },
  },
  {
    id: 'pms-replace-brake-pads',
    sortOrder: 6,
    name: 'Replace Brake Pads',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 130, 'cc-150-160': 150, 'cc-big-bikes': 200 },
  },
  {
    id: 'pms-replace-brake-shoe',
    sortOrder: 7,
    name: 'Replace Brake Shoe',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 300, 'cc-150-160': 350, 'cc-big-bikes': 400 },
  },
  {
    id: 'pms-replace-front-fork-oil',
    sortOrder: 8,
    name: 'Replace Front Fork Oil',
    catalogCategory: 'PMS',
    prices: { 'cc-125-below': 450, 'cc-150-160': 500, 'cc-big-bikes': 600 },
  },
  {
    id: 'pms-replace-swing-arm-bushing',
    sortOrder: 9,
    name: 'Replace Swing Arm Bushing',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 500, 'cc-150-160': 600, 'cc-big-bikes': 800 },
  },
  {
    id: 'pms-replace-steering-ball',
    sortOrder: 10,
    name: 'Replace Steering Ball/Bearing',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 450, 'cc-150-160': 550, 'cc-big-bikes': 700 },
  },
  {
    id: 'pms-replace-front-hub-bearing',
    sortOrder: 11,
    name: 'Replace Front Hub Bearing',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 300, 'cc-150-160': 350, 'cc-big-bikes': 400 },
  },
  {
    id: 'pms-replace-rear-hub-bearing',
    sortOrder: 12,
    name: 'Replace Rear Hub Bearing',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 300, 'cc-150-160': 350, 'cc-big-bikes': 400 },
  },
  {
    id: 'pms-battery-recharging',
    sortOrder: 13,
    name: 'Battery Recharging',
    catalogCategory: 'PMS',
    prices: { 'cc-125-below': 100, 'cc-150-160': 100, 'cc-big-bikes': 100 },
  },
  {
    id: 'pms-replace-head-light-bulb',
    sortOrder: 14,
    name: 'Replace Head Light Bulb',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 150, 'cc-150-160': 200, 'cc-big-bikes': 250 },
  },
  {
    id: 'pms-replace-tail-light-bulb',
    sortOrder: 15,
    name: 'Replace Tail Light Bulb',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 150, 'cc-150-160': 200, 'cc-big-bikes': 250 },
  },
  {
    id: 'pms-replace-signal-light-bulb',
    sortOrder: 16,
    name: 'Replace Signal Light Bulb',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 150, 'cc-150-160': 200, 'cc-big-bikes': 250 },
  },
  {
    id: 'pms-replace-panel-bulb',
    sortOrder: 17,
    name: 'Replace Panel Bulb',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 150, 'cc-150-160': 200, 'cc-big-bikes': 250 },
  },
  {
    id: 'pms-replace-wiring-harness',
    sortOrder: 18,
    name: 'Replace Wiring Harness',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 900, 'cc-150-160': 1400, 'cc-big-bikes': 1900 },
  },
  {
    id: 'pms-replace-drive-chain',
    sortOrder: 19,
    name: 'Replace Drive Chain',
    catalogCategory: 'PMS',
    prices: { 'cc-125-below': 350, 'cc-150-160': 400, 'cc-big-bikes': 450 },
  },
  {
    id: 'pms-overhaul-carburetor',
    sortOrder: 20,
    name: 'Overhaul Carburetor',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 300, 'cc-150-160': 350, 'cc-big-bikes': null },
  },
  {
    id: 'pms-replace-starter-motor',
    sortOrder: 21,
    name: 'Replace Starter Motor',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 350, 'cc-150-160': 400, 'cc-big-bikes': 450 },
  },
  {
    id: 'pms-replace-cam-sprocket-chain',
    sortOrder: 22,
    name: 'Replace Cam Sprocket and Chain',
    catalogCategory: 'Repair',
    prices: { 'cc-125-below': 800, 'cc-150-160': 1000, 'cc-big-bikes': 1200 },
  },
]);

/** Customer-facing catalog groups (order matters). */
export const PMS_SERVICE_GROUPS = Object.freeze([
  'Engine Services',
  'Brake Services',
  'Tune-Up and Maintenance',
  'Electrical Services',
  'Suspension and Chassis',
  'Drive System',
  'Other Services',
]);

/** Default group + short description + icon per service id */
export const PMS_SERVICE_META = Object.freeze({
  'pms-minor-tune-up': { group: 'Tune-Up and Maintenance', description: 'Minor preventive tune-up and inspection', icon: 'wrench-adjustable' },
  'pms-major-tune-up': { group: 'Tune-Up and Maintenance', description: 'Full major tune-up and diagnostics', icon: 'wrench-adjustable' },
  'pms-top-overhaul': { group: 'Engine Services', description: 'Complete top-end engine overhaul labor', icon: 'gear-wide-connected' },
  'pms-major-engine-overhaul': { group: 'Engine Services', description: 'Labor for a major engine overhaul', icon: 'gear-wide-connected' },
  'pms-overhaul-carburetor': {
    group: 'Engine Services',
    description: 'Carburetor overhaul service',
    icon: 'gear',
  },
  'pms-replace-cam-sprocket-chain': { group: 'Engine Services', description: 'Cam sprocket and chain replacement labor', icon: 'link-45deg' },
  'pms-replace-starter-motor': { group: 'Engine Services', description: 'Starter motor replacement labor', icon: 'lightning-charge' },
  'pms-replace-brake-pads': { group: 'Brake Services', description: 'Brake pad replacement labor', icon: 'shield-shaded' },
  'pms-replace-brake-shoe': { group: 'Brake Services', description: 'Brake shoe replacement labor', icon: 'shield-shaded' },
  'pms-battery-recharging': { group: 'Electrical Services', description: 'Battery testing and recharging service', icon: 'battery-charging' },
  'pms-replace-head-light-bulb': { group: 'Electrical Services', description: 'Headlight bulb replacement labor', icon: 'lightbulb' },
  'pms-replace-tail-light-bulb': { group: 'Electrical Services', description: 'Tail light bulb replacement labor', icon: 'lightbulb' },
  'pms-replace-signal-light-bulb': { group: 'Electrical Services', description: 'Turn signal light bulb replacement labor', icon: 'lightbulb' },
  'pms-replace-panel-bulb': { group: 'Electrical Services', description: 'Gauge panel bulb replacement labor', icon: 'lightbulb' },
  'pms-replace-wiring-harness': { group: 'Electrical Services', description: 'Full wiring harness replacement labor', icon: 'lightning-charge' },
  'pms-replace-front-fork-oil': { group: 'Suspension and Chassis', description: 'Front fork oil replacement labor', icon: 'tools' },
  'pms-replace-swing-arm-bushing': { group: 'Suspension and Chassis', description: 'Swing arm bushing replacement labor', icon: 'tools' },
  'pms-replace-steering-ball': { group: 'Suspension and Chassis', description: 'Steering ball / bearing replacement', icon: 'tools' },
  'pms-replace-front-hub-bearing': { group: 'Suspension and Chassis', description: 'Front wheel hub bearing replacement', icon: 'tools' },
  'pms-replace-rear-hub-bearing': { group: 'Suspension and Chassis', description: 'Rear wheel hub bearing replacement', icon: 'tools' },
  'pms-replace-lubricate-cable': { group: 'Drive System', description: 'Control cable replacement and lubrication', icon: 'link' },
  'pms-replace-drive-chain': { group: 'Drive System', description: 'Drive chain replacement and tensioning', icon: 'link-45deg' },
});

export function normalizeCatalogCategory(value) {
  const raw = String(value || '').trim();
  if (raw === CATALOG_CATEGORIES.REPAIR || raw.toLowerCase() === 'repair') {
    return CATALOG_CATEGORIES.REPAIR;
  }
  return CATALOG_CATEGORIES.PMS;
}

/** Filter catalog rows by PMS | Repair | All. */
export function filterServicesByCatalogCategory(services, categoryFilter) {
  const list = Array.isArray(services) ? services : [];
  const key = String(categoryFilter || 'all').trim().toLowerCase();
  if (!key || key === 'all') return list;
  if (key === 'pms') return list.filter((s) => normalizeCatalogCategory(s.catalogCategory) === 'PMS');
  if (key === 'repair') return list.filter((s) => normalizeCatalogCategory(s.catalogCategory) === 'Repair');
  return list;
}

export const UNSUPPORTED_CC_MESSAGE =
  'This motorcycle’s engine displacement is outside the configured service categories. Please contact the administrator for assistance.';

export const SERVICE_UNAVAILABLE_MESSAGE =
  'Price not configured for the selected motorcycle CC category. Contact the shop or choose another service.';

export const ESTIMATE_DISCLAIMER =
  'Amounts shown are estimated labor fees only. Replacement parts and additional work found during inspection may cost extra and require an updated quotation and your approval.';

export function parseEngineCc(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * Validate that category ranges do not overlap (open-ended max = Infinity).
 * @param {CcCategory[]} categories
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateCcCategoryRanges(categories = []) {
  const list = [...categories]
    .filter((c) => c && c.isActive !== false && c.is_active !== false)
    .map((c) => ({
      id: c.id,
      name: c.name,
      min: c.minCc ?? c.min_cc ?? 0,
      max: c.maxCc ?? c.max_cc,
    }))
    .sort((a, b) => Number(a.min) - Number(b.min));

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const aMax = a.max == null ? Number.POSITIVE_INFINITY : Number(a.max);
    const aMin = Number(a.min);
    if (!Number.isFinite(aMin) || aMin < 0) {
      return { ok: false, error: `Invalid minimum CC for category "${a.name}".` };
    }
    if (Number.isFinite(aMax) && aMax < aMin) {
      return { ok: false, error: `Category "${a.name}" has max CC below min CC.` };
    }
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const bMin = Number(b.min);
      const bMax = b.max == null ? Number.POSITIVE_INFINITY : Number(b.max);
      const overlaps = aMin <= bMax && bMin <= aMax;
      if (overlaps) {
        return {
          ok: false,
          error: `CC categories "${a.name}" and "${b.name}" overlap. Adjust the ranges so each displacement maps to exactly one category.`,
        };
      }
    }
  }
  return { ok: true };
}

/**
 * Derive the applicable CC category from engine displacement.
 * Returns null when CC is missing/invalid or no configured range matches
 * (e.g. 126–149cc with the default three categories).
 */
export function resolveCcCategory(engineCc, categories = DEFAULT_CC_CATEGORIES) {
  const cc = parseEngineCc(engineCc);
  if (cc == null) {
    return { category: null, engineCc: null, reason: 'invalid_cc' };
  }
  const active = [...categories]
    .filter((c) => c && c.isActive !== false && c.is_active !== false)
    .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));

  for (const cat of active) {
    const min = Number(cat.minCc ?? cat.min_cc ?? 0);
    const maxRaw = cat.maxCc ?? cat.max_cc;
    const max = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
    if (!Number.isFinite(min)) continue;
    if (cc < min) continue;
    if (max != null && Number.isFinite(max) && cc > max) continue;
    return {
      category: {
        id: cat.id,
        name: cat.name,
        minCc: min,
        maxCc: max,
        sortOrder: cat.sortOrder ?? cat.sort_order ?? 0,
      },
      engineCc: cc,
      reason: null,
    };
  }
  return { category: null, engineCc: cc, reason: 'unsupported_cc' };
}

export function getPmsServiceById(serviceId, services = DEFAULT_PMS_SERVICES) {
  const id = String(serviceId || '').trim();
  return services.find((s) => s.id === id) || null;
}

/**
 * Resolve fixed PMS rate for a service + category.
 * Returns { available: false } when price is null / missing — never ₱0 for N/A.
 */
export function resolvePmsServicePrice(serviceId, categoryId, services = DEFAULT_PMS_SERVICES) {
  const service = getPmsServiceById(serviceId, services);
  if (!service) {
    return { available: false, price: null, service: null, reason: 'unknown_service' };
  }
  const catId = String(categoryId || '');
  const prices = service.prices || {};
  if (!(catId in prices)) {
    return { available: false, price: null, service, reason: 'no_price_for_category' };
  }
  const raw = prices[catId];
  if (raw == null || raw === PMS_UNAVAILABLE) {
    return { available: false, price: null, service, reason: 'not_available' };
  }
  const price = roundMoney(Number(raw));
  if (!Number.isFinite(price) || price < 0) {
    return { available: false, price: null, service, reason: 'invalid_price' };
  }
  return { available: true, price, service, reason: null };
}

/**
 * Catalog rows for UI: one entry per service with price/availability for a category.
 */
export function enrichServiceMeta(service) {
  if (!service) return service;
  const meta = PMS_SERVICE_META[service.id] || {};
  const fromDefault = DEFAULT_PMS_SERVICES.find((s) => s.id === service.id);
  return {
    ...service,
    group: service.group || service.service_group || meta.group || 'Other Services',
    description: service.description || meta.description || 'Fixed labor service',
    icon: service.icon || meta.icon || 'wrench',
    catalogCategory: normalizeCatalogCategory(
      service.catalogCategory ?? service.catalog_category ?? fromDefault?.catalogCategory
    ),
  };
}

export function buildPmsCatalogForCategory(categoryId, services = DEFAULT_PMS_SERVICES) {
  return [...services]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((service) => {
      const enriched = enrichServiceMeta(service);
      const resolved = resolvePmsServicePrice(service.id, categoryId, services);
      return {
        id: service.id,
        name: service.name,
        sortOrder: service.sortOrder,
        group: enriched.group,
        description: enriched.description,
        icon: enriched.icon,
        catalogCategory: enriched.catalogCategory,
        available: resolved.available,
        price: resolved.available ? resolved.price : null,
        priceLabel: resolved.available ? formatPhp(resolved.price) : 'Price not configured',
        unavailableReason: resolved.available ? null : SERVICE_UNAVAILABLE_MESSAGE,
      };
    });
}

/** Group catalog rows for UI sections. */
export function groupPmsCatalog(services = []) {
  const byGroup = new Map();
  for (const g of PMS_SERVICE_GROUPS) byGroup.set(g, []);
  for (const svc of services) {
    const key = PMS_SERVICE_GROUPS.includes(svc.group) ? svc.group : 'Other Services';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(svc);
  }
  return PMS_SERVICE_GROUPS.map((name) => ({
    name,
    services: byGroup.get(name) || [],
  })).filter((g) => g.services.length > 0);
}

/**
 * Groups catalog into two primary sections: Preventive Maintenance (PMS) and Repair Services.
 * Each section contains its relevant service groups and services.
 */
export function groupPmsCatalogByPrimarySection(services = [], categoryFilter = 'all') {
  const normFilter = String(categoryFilter || 'all').toLowerCase();
  const showPms = normFilter === 'all' || normFilter === 'pms';
  const showRepair = normFilter === 'all' || normFilter === 'repair';

  const sections = [];

  if (showPms) {
    const pmsServices = services.filter((s) => (s.catalogCategory || '').toUpperCase() === 'PMS');
    const groups = groupPmsCatalog(pmsServices);
    if (groups.length > 0) {
      sections.push({
        key: 'PMS',
        title: 'Preventive Maintenance (PMS)',
        badgeText: 'PMS',
        description: 'Routine maintenance, fluids, tune-ups, and inspections to keep your motorcycle in peak condition.',
        icon: 'shield-check',
        accentColor: '#EA580C',
        badgeBg: '#FFF7ED',
        badgeBorder: '#FED7AA',
        groups,
        totalServices: pmsServices.length,
      });
    }
  }

  if (showRepair) {
    const repairServices = services.filter((s) => (s.catalogCategory || '').toUpperCase() === 'REPAIR');
    const groups = groupPmsCatalog(repairServices);
    if (groups.length > 0) {
      sections.push({
        key: 'Repair',
        title: 'Repair Services',
        badgeText: 'REPAIR',
        description: 'Mechanical overhauls, electrical troubleshooting, and component replacements.',
        icon: 'wrench-adjustable',
        accentColor: '#B45309',
        badgeBg: '#FEF3C7',
        badgeBorder: '#FDE68A',
        groups,
        totalServices: repairServices.length,
      });
    }
  }

  return sections;
}

/**
 * Server-side validation for a PMS booking quote.
 * Never trust client-submitted prices — recompute from catalog + motorcycle CC.
 */
export function quotePmsBooking({
  engineCc,
  serviceId,
  categories = DEFAULT_CC_CATEGORIES,
  services = DEFAULT_PMS_SERVICES,
  clientPrice,
} = {}) {
  const multi = quotePmsBookingServices({
    engineCc,
    serviceIds: serviceId ? [serviceId] : [],
    categories,
    services,
  });
  if (!multi.ok) return multi;
  const line = multi.lineItems[0];
  if (clientPrice != null && Number(clientPrice) !== line.laborRatePhp) {
    // Ignore client price; keep server rate.
  }
  return {
    ok: true,
    engineCc: multi.engineCc,
    category: multi.category,
    service: {
      id: line.serviceId,
      name: line.serviceName,
      sortOrder: line.sortOrder,
    },
    quotedServiceRate: line.laborRatePhp,
    priceLabel: formatPhp(line.laborRatePhp),
    lineItems: multi.lineItems,
    laborSubtotal: multi.laborSubtotal,
  };
}

/**
 * Authoritative multi-service quote. Never trusts client-submitted prices.
 * Deduplicates service IDs. Fails if any selected service is unavailable.
 */
export function quotePmsBookingServices({
  engineCc,
  serviceIds = [],
  categories = DEFAULT_CC_CATEGORIES,
  services = DEFAULT_PMS_SERVICES,
  partsEstimate = 0,
  additionalFeesEstimate = 0,
} = {}) {
  const { category, engineCc: cc, reason: ccReason } = resolveCcCategory(engineCc, categories);
  if (!category) {
    return {
      ok: false,
      error:
        ccReason === 'invalid_cc'
          ? 'A valid motorcycle engine displacement (CC) is required for service booking.'
          : UNSUPPORTED_CC_MESSAGE,
      code: ccReason || 'unsupported_cc',
    };
  }

  const uniqueIds = [...new Set((serviceIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    return {
      ok: false,
      error: 'Please select at least one service.',
      code: 'no_services',
      category,
      engineCc: cc,
    };
  }

  const lineItems = [];
  for (let i = 0; i < uniqueIds.length; i++) {
    const serviceId = uniqueIds[i];
    const priced = resolvePmsServicePrice(serviceId, category.id, services);
    if (!priced.available || !priced.service) {
      return {
        ok: false,
        error:
          priced.reason === 'unknown_service'
            ? `Service "${serviceId}" was not found.`
            : `"${priced.service?.name || serviceId}" is not available for ${category.name}.`,
        code: priced.reason || 'not_available',
        category,
        engineCc: cc,
      };
    }
    const enriched = enrichServiceMeta(priced.service);
    const laborRatePhp = roundMoney(priced.price);
    lineItems.push({
      serviceId: enriched.id,
      serviceName: enriched.name,
      serviceGroup: enriched.group,
      serviceDescription: enriched.description,
      catalogCategory: enriched.catalogCategory,
      icon: enriched.icon,
      sortOrder: enriched.sortOrder || i + 1,
      motorcycleCc: cc,
      ccCategoryId: category.id,
      ccCategoryName: category.name,
      laborRatePhp,
      quantity: 1,
      lineTotalPhp: laborRatePhp,
      priceLabel: formatPhp(laborRatePhp),
    });
  }

  const laborSubtotal = roundMoney(lineItems.reduce((sum, row) => sum + Number(row.lineTotalPhp || 0), 0));
  const parts = roundMoney(partsEstimate || 0);
  const fees = roundMoney(additionalFeesEstimate || 0);
  const estimatedTotal = roundMoney(laborSubtotal + parts + fees);

  return {
    ok: true,
    engineCc: cc,
    category,
    lineItems,
    laborSubtotal,
    partsEstimate: parts,
    additionalFeesEstimate: fees,
    estimatedTotal,
    laborSubtotalLabel: formatPhp(laborSubtotal),
    estimatedTotalLabel: formatPhp(estimatedTotal),
    disclaimer: ESTIMATE_DISCLAIMER,
  };
}

export function isPmsFixedBooking(booking) {
  const mode = String(booking?.booking_mode || booking?.bookingMode || '').toLowerCase();
  if (mode === 'pms_fixed') return true;
  if (booking?.pms_service_id || booking?.pmsServiceId) return true;
  const cat = String(booking?.category || booking?.service_type || '').toUpperCase();
  return cat === 'PMS' && Number(booking?.quoted_service_rate ?? booking?.package_price ?? 0) > 0;
}

export { formatPhp };
