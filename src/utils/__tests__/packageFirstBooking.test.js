// =========================================================================
// Unit tests for MotoTrack Package-First Customer Booking Logic
// Validates:
// 1. Categories streamlined: All, Preventive Maintenance, General Repair (other categories removed)
// 2. All packages belong strictly to Preventive Maintenance or General Repair
// 3. All packages populated with images, inclusions, and CC prices
// 4. CC-based displacement pricing for 125cc, 150-160cc, and Big Bikes
// 5. Starting price computation
// =========================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKAGE_CATEGORIES,
  SERVICE_PACKAGES,
  getPackageStartingPrice,
  calculatePackagePriceForCc,
} from '../../components/web/booking/bookingPackagesData.js';

describe('Package-First Customer Booking Catalog & Pricing', () => {
  it('should include customer categories with other categories removed', () => {
    const categoryIds = PACKAGE_CATEGORIES.map((c) => c.id);
    assert.ok(categoryIds.includes('all'));
    assert.ok(categoryIds.includes('PMS'));
    assert.ok(categoryIds.includes('Repair'));
    assert.ok(!categoryIds.includes('Brake Services'));
    assert.ok(!categoryIds.includes('Engine Services'));
    assert.ok(!categoryIds.includes('Customization'));
    assert.equal(PACKAGE_CATEGORIES.length, 3);
  });

  it('should ensure all packages belong strictly to PMS or Repair', () => {
    SERVICE_PACKAGES.forEach((pkg) => {
      assert.ok(['PMS', 'Repair'].includes(pkg.category));
    });
  });

  it('should ensure each package has image, name, shortDescription, duration, and inclusions', () => {
    assert.ok(SERVICE_PACKAGES.length >= 14);
    SERVICE_PACKAGES.forEach((pkg) => {
      assert.ok(pkg.id);
      assert.ok(pkg.name);
      assert.ok(pkg.category);
      assert.ok(pkg.shortDescription);
      assert.ok(pkg.description);
      assert.ok(pkg.duration);
      assert.match(pkg.image, /^https:\/\//);
      assert.ok(Array.isArray(pkg.inclusions));
      assert.ok(pkg.inclusions.length > 0);
      assert.ok(pkg.prices);
    });
  });

  it('should calculate starting prices correctly', () => {
    const pmsPro = SERVICE_PACKAGES.find((p) => p.id === 'pms-pro');
    assert.ok(pmsPro);
    const startingPrice = getPackageStartingPrice(pmsPro);
    assert.equal(startingPrice, 2500); // 125cc rate is min
  });

  it('should automatically compute CC-based prices for different engine displacement tiers', () => {
    const pmsPro = SERVICE_PACKAGES.find((p) => p.id === 'pms-pro');

    // 125cc and below
    const calc125 = calculatePackagePriceForCc(pmsPro, 125);
    assert.equal(calc125.tierId, 'cc-125-below');
    assert.equal(calc125.price, 2500);

    // 150cc–160cc (e.g. Aerox 155, NMAX 155, Winner X 150)
    const calc155 = calculatePackagePriceForCc(pmsPro, 155);
    assert.equal(calc155.tierId, 'cc-150-160');
    assert.equal(calc155.price, 3200);

    // Big Bikes (e.g. Ninja 400, CB650R, MT-07)
    const calc400 = calculatePackagePriceForCc(pmsPro, 399);
    assert.equal(calc400.tierId, 'cc-big-bikes');
    assert.equal(calc400.price, 3750);
  });

  it('should handle packages that are not applicable to big bikes (e.g. carburetor overhaul)', () => {
    const carb = SERVICE_PACKAGES.find((p) => p.id === 'pms-overhaul-carburetor');
    assert.ok(carb);

    const calc125 = calculatePackagePriceForCc(carb, 110);
    assert.equal(calc125.price, 300);

    const calcBig = calculatePackagePriceForCc(carb, 650);
    assert.equal(calcBig.price, null);
    assert.equal(calcBig.isAvailable, false);
  });

  it('should reliably parse engine CC displacement from various property names and formats', () => {
    const parseCc = (moto) => {
      const raw = moto?.engine_displacement ?? moto?.engine_cc ?? moto?.engineCc ?? moto?.cc;
      return parseInt(raw, 10) || 0;
    };

    assert.equal(parseCc({ engine_cc: 125 }), 125);
    assert.equal(parseCc({ engine_cc: '150' }), 150);
    assert.equal(parseCc({ engine_displacement: '155cc' }), 155);
    assert.equal(parseCc({ engineCc: '400 cc' }), 400);
    assert.equal(parseCc({ cc: 650 }), 650);
    assert.equal(parseCc({}), 0);
    assert.equal(parseCc(null), 0);
  });

  it('should adjust pricing when switching from a 125cc bike to a 321cc bike', () => {
    const pmsPro = SERVICE_PACKAGES.find((p) => p.id === 'pms-pro');
    const bike125 = { engine_displacement: '125cc', is_primary: true };
    const bike321 = { engine_displacement: '321cc', is_primary: false };

    const parseCc = (moto) => parseInt(moto?.engine_displacement ?? moto?.engine_cc ?? 0, 10) || 0;

    const price1 = calculatePackagePriceForCc(pmsPro, parseCc(bike125)).price;
    const price2 = calculatePackagePriceForCc(pmsPro, parseCc(bike321)).price;

    assert.equal(price1, 2500);
    assert.equal(price2, 3750);
    assert.ok(price2 > price1);
  });

  it('should search packages by name, description, inclusions, and category accurately', () => {
    const searchFilter = (packages, query) => {
      if (!query || !query.trim()) return packages;
      const q = query.toLowerCase().trim();
      return packages.filter((pkg) => {
        const matchesName = (pkg.name || '').toLowerCase().includes(q);
        const matchesDesc = (pkg.description || '').toLowerCase().includes(q);
        const matchesShort = (pkg.shortDescription || '').toLowerCase().includes(q);
        const matchesInclusions = (pkg.inclusions || []).some((inc) =>
          (inc || '').toLowerCase().includes(q)
        );
        const matchesCategory = (pkg.category || '').toLowerCase().includes(q);
        const matchesBadge = (pkg.badge || '').toLowerCase().includes(q);
        return matchesName || matchesDesc || matchesShort || matchesInclusions || matchesCategory || matchesBadge;
      });
    };

    // Search by name
    const tuneUpMatches = searchFilter(SERVICE_PACKAGES, 'tune');
    assert.ok(tuneUpMatches.length > 0);
    assert.ok(tuneUpMatches.some((p) => p.name.toLowerCase().includes('tune')));

    // Search by inclusion (e.g. spark plug)
    const sparkPlugMatches = searchFilter(SERVICE_PACKAGES, 'spark plug');
    assert.ok(sparkPlugMatches.length > 0);

    // Search by category
    const repairMatches = searchFilter(SERVICE_PACKAGES, 'Repair');
    assert.ok(repairMatches.length > 0);
    assert.ok(repairMatches.every((p) => p.category === 'Repair'));

    // Search nonexistent keyword
    const nonexistent = searchFilter(SERVICE_PACKAGES, 'xyznonexistentword123');
    assert.equal(nonexistent.length, 0);
  });
});
