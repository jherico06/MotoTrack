/**
 * Unit checks for CC category matching and fixed PMS rates.
 * Run: node --test src/utils/__tests__/pmsCcPricing.test.js
 * (or via project test runner if configured)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCcCategory,
  resolvePmsServicePrice,
  quotePmsBooking,
  quotePmsBookingServices,
  validateCcCategoryRanges,
  DEFAULT_CC_CATEGORIES,
  DEFAULT_PMS_SERVICES,
  buildPmsCatalogForCategory,
  groupPmsCatalog,
  groupPmsCatalogByPrimarySection,
  filterServicesByCatalogCategory,
  normalizeCatalogCategory,
} from '../pmsCcPricing.js';

describe('resolveCcCategory', () => {
  it('maps 125cc to 125cc and Below', () => {
    const r = resolveCcCategory(125);
    assert.equal(r.category?.id, 'cc-125-below');
  });

  it('maps 150–160 to mid band', () => {
    assert.equal(resolveCcCategory(150).category?.id, 'cc-150-160');
    assert.equal(resolveCcCategory(160).category?.id, 'cc-150-160');
  });

  it('maps 200+ to 200cc above', () => {
    assert.equal(resolveCcCategory(200).category?.id, 'cc-big-bikes');
    assert.equal(resolveCcCategory(1000).category?.id, 'cc-big-bikes');
    assert.equal(resolveCcCategory(161).category, null);
  });

  it('does not silently assign 126–149cc', () => {
    const r = resolveCcCategory(140);
    assert.equal(r.category, null);
    assert.equal(r.reason, 'unsupported_cc');
  });

  it('rejects invalid CC', () => {
    assert.equal(resolveCcCategory(null).reason, 'invalid_cc');
    assert.equal(resolveCcCategory('abc').reason, 'invalid_cc');
  });
});

describe('PMS fixed prices', () => {
  it('prices Minor Tune Up correctly', () => {
    assert.equal(resolvePmsServicePrice('pms-minor-tune-up', 'cc-125-below').price, 300);
    assert.equal(resolvePmsServicePrice('pms-minor-tune-up', 'cc-150-160').price, 500);
    assert.equal(resolvePmsServicePrice('pms-minor-tune-up', 'cc-big-bikes').price, 700);
  });

  it('marks Overhaul Carburetor unavailable for 200cc above (not ₱0)', () => {
    const r = resolvePmsServicePrice('pms-overhaul-carburetor', 'cc-big-bikes');
    assert.equal(r.available, false);
    assert.equal(r.price, null);
  });

  it('labels missing prices as Price not configured', () => {
    const cat = buildPmsCatalogForCategory('cc-big-bikes');
    const carb = cat.find((s) => s.id === 'pms-overhaul-carburetor');
    assert.equal(carb.available, false);
    assert.equal(carb.priceLabel, 'Price not configured');
  });

  it('organizes PMS vs Repair categories', () => {
    const pms = filterServicesByCatalogCategory(DEFAULT_PMS_SERVICES, 'pms');
    const repair = filterServicesByCatalogCategory(DEFAULT_PMS_SERVICES, 'repair');
    assert.equal(pms.length, 6);
    assert.equal(repair.length, 16);
    assert.ok(pms.every((s) => normalizeCatalogCategory(s.catalogCategory) === 'PMS'));
    assert.ok(repair.every((s) => normalizeCatalogCategory(s.catalogCategory) === 'Repair'));
  });

  it('catalog has 22 services', () => {
    assert.equal(DEFAULT_PMS_SERVICES.length, 22);
    const cat = buildPmsCatalogForCategory('cc-125-below');
    assert.equal(cat.length, 22);
    assert.ok(cat.every((s) => s.available === true));
    assert.ok(cat.every((s) => s.catalogCategory === 'PMS' || s.catalogCategory === 'Repair'));
  });

  it('quotePmsBooking ignores client price mismatch', () => {
    const q = quotePmsBooking({
      engineCc: 125,
      serviceId: 'pms-minor-tune-up',
      clientPrice: 1,
    });
    assert.equal(q.ok, true);
    assert.equal(q.quotedServiceRate, 300);
  });

  it('quote fails for unsupported CC', () => {
    const q = quotePmsBooking({ engineCc: 140, serviceId: 'pms-minor-tune-up' });
    assert.equal(q.ok, false);
  });

  it('quotes multiple services and sums labor', () => {
    const q = quotePmsBookingServices({
      engineCc: 125,
      serviceIds: ['pms-minor-tune-up', 'pms-replace-brake-pads', 'pms-minor-tune-up'],
    });
    assert.equal(q.ok, true);
    assert.equal(q.lineItems.length, 2);
    assert.equal(q.laborSubtotal, 430);
  });

  it('groups catalog for UI', () => {
    const rows = buildPmsCatalogForCategory('cc-125-below');
    const groups = groupPmsCatalog(rows);
    assert.ok(groups.length >= 5);
    assert.ok(groups.every((g) => g.services.length > 0));
  });

  it('groups catalog into PMS and Repair primary sections', () => {
    const rows = buildPmsCatalogForCategory('cc-125-below');
    const sections = groupPmsCatalogByPrimarySection(rows, 'all');
    assert.equal(sections.length, 2);
    assert.equal(sections[0].key, 'PMS');
    assert.equal(sections[0].totalServices, 6);
    assert.equal(sections[1].key, 'Repair');
    assert.equal(sections[1].totalServices, 16);

    const pmsOnly = groupPmsCatalogByPrimarySection(rows, 'pms');
    assert.equal(pmsOnly.length, 1);
    assert.equal(pmsOnly[0].key, 'PMS');

    const repairOnly = groupPmsCatalogByPrimarySection(rows, 'repair');
    assert.equal(repairOnly.length, 1);
    assert.equal(repairOnly[0].key, 'Repair');
  });
});

describe('validateCcCategoryRanges', () => {
  it('accepts default categories', () => {
    assert.equal(validateCcCategoryRanges(DEFAULT_CC_CATEGORIES).ok, true);
  });

  it('rejects overlapping ranges', () => {
    const r = validateCcCategoryRanges([
      { id: 'a', name: 'A', minCc: 0, maxCc: 150 },
      { id: 'b', name: 'B', minCc: 140, maxCc: 200 },
    ]);
    assert.equal(r.ok, false);
  });
});
