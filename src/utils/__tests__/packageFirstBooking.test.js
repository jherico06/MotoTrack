// =========================================================================
// Unit tests for MotoTrack Package-First Customer Booking Logic
// Validates:
// 1. Categories streamlined: All, Preventive Maintenance, General Repair (other categories removed)
// 2. All packages belong strictly to Preventive Maintenance or General Repair
// 3. All packages populated with images, inclusions, and CC prices
// 4. CC-based displacement pricing for 125cc, 150-160cc, and Big Bikes
// 5. Starting price computation
// =========================================================================

import { describe, it, expect } from '@jest/globals';
import {
  PACKAGE_CATEGORIES,
  SERVICE_PACKAGES,
  getPackageStartingPrice,
  calculatePackagePriceForCc,
} from '../../components/web/booking/bookingPackagesData.js';

describe('Package-First Customer Booking Catalog & Pricing', () => {
  it('should include customer categories with other categories removed', () => {
    const categoryIds = PACKAGE_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain('all');
    expect(categoryIds).toContain('PMS');
    expect(categoryIds).toContain('Repair');
    expect(categoryIds).not.toContain('Brake Services');
    expect(categoryIds).not.toContain('Engine Services');
    expect(categoryIds).not.toContain('Customization');
    expect(PACKAGE_CATEGORIES).toHaveLength(3);
  });

  it('should ensure all packages belong strictly to PMS or Repair', () => {
    SERVICE_PACKAGES.forEach((pkg) => {
      expect(['PMS', 'Repair']).toContain(pkg.category);
    });
  });

  it('should ensure each package has image, name, shortDescription, duration, and inclusions', () => {
    expect(SERVICE_PACKAGES.length).toBeGreaterThanOrEqual(14);
    SERVICE_PACKAGES.forEach((pkg) => {
      expect(pkg.id).toBeTruthy();
      expect(pkg.name).toBeTruthy();
      expect(pkg.category).toBeTruthy();
      expect(pkg.shortDescription).toBeTruthy();
      expect(pkg.description).toBeTruthy();
      expect(pkg.duration).toBeTruthy();
      expect(pkg.image).toMatch(/^https:\/\//);
      expect(Array.isArray(pkg.inclusions)).toBe(true);
      expect(pkg.inclusions.length).toBeGreaterThan(0);
      expect(pkg.prices).toBeDefined();
    });
  });

  it('should calculate starting prices correctly', () => {
    const pmsPro = SERVICE_PACKAGES.find((p) => p.id === 'pms-pro');
    expect(pmsPro).toBeDefined();
    const startingPrice = getPackageStartingPrice(pmsPro);
    expect(startingPrice).toBe(2500); // 125cc rate is min
  });

  it('should automatically compute CC-based prices for different engine displacement tiers', () => {
    const pmsPro = SERVICE_PACKAGES.find((p) => p.id === 'pms-pro');

    // 125cc and below
    const calc125 = calculatePackagePriceForCc(pmsPro, 125);
    expect(calc125.tierId).toBe('cc-125-below');
    expect(calc125.price).toBe(2500);

    // 150cc–160cc (e.g. Aerox 155, NMAX 155, Winner X 150)
    const calc155 = calculatePackagePriceForCc(pmsPro, 155);
    expect(calc155.tierId).toBe('cc-150-160');
    expect(calc155.price).toBe(3200);

    // Big Bikes (e.g. Ninja 400, CB650R, MT-07)
    const calc400 = calculatePackagePriceForCc(pmsPro, 399);
    expect(calc400.tierId).toBe('cc-big-bikes');
    expect(calc400.price).toBe(3750);
  });

  it('should handle packages that are not applicable to big bikes (e.g. carburetor overhaul)', () => {
    const carb = SERVICE_PACKAGES.find((p) => p.id === 'pms-overhaul-carburetor');
    expect(carb).toBeDefined();

    const calc125 = calculatePackagePriceForCc(carb, 110);
    expect(calc125.price).toBe(300);

    const calcBig = calculatePackagePriceForCc(carb, 650);
    expect(calcBig.price).toBeNull();
    expect(calcBig.isAvailable).toBe(false);
  });

  it('should reliably parse engine CC displacement from various property names and formats', () => {
    const parseCc = (moto) => {
      const raw = moto?.engine_displacement ?? moto?.engine_cc ?? moto?.engineCc ?? moto?.cc;
      return parseInt(raw, 10) || 0;
    };

    expect(parseCc({ engine_cc: 125 })).toBe(125);
    expect(parseCc({ engine_cc: '150' })).toBe(150);
    expect(parseCc({ engine_displacement: '155cc' })).toBe(155);
    expect(parseCc({ engineCc: '400 cc' })).toBe(400);
    expect(parseCc({ cc: 650 })).toBe(650);
    expect(parseCc({})).toBe(0);
    expect(parseCc(null)).toBe(0);
  });

  it('should adjust pricing when switching from a 125cc bike to a 321cc bike', () => {
    const pmsPro = SERVICE_PACKAGES.find((p) => p.id === 'pms-pro');
    const bike125 = { engine_displacement: '125cc', is_primary: true };
    const bike321 = { engine_displacement: '321cc', is_primary: false };

    const parseCc = (moto) => parseInt(moto?.engine_displacement ?? moto?.engine_cc ?? 0, 10) || 0;

    const price1 = calculatePackagePriceForCc(pmsPro, parseCc(bike125)).price;
    const price2 = calculatePackagePriceForCc(pmsPro, parseCc(bike321)).price;

    expect(price1).toBe(2500);
    expect(price2).toBe(3750);
    expect(price2).toBeGreaterThan(price1);
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
    expect(tuneUpMatches.length).toBeGreaterThan(0);
    expect(tuneUpMatches.some((p) => p.name.toLowerCase().includes('tune'))).toBe(true);

    // Search by inclusion (e.g. spark plug)
    const sparkPlugMatches = searchFilter(SERVICE_PACKAGES, 'spark plug');
    expect(sparkPlugMatches.length).toBeGreaterThan(0);

    // Search by category
    const repairMatches = searchFilter(SERVICE_PACKAGES, 'Repair');
    expect(repairMatches.length).toBeGreaterThan(0);
    expect(repairMatches.every((p) => p.category === 'Repair')).toBe(true);

    // Search nonexistent keyword
    const nonexistent = searchFilter(SERVICE_PACKAGES, 'xyznonexistentword123');
    expect(nonexistent.length).toBe(0);
  });
});
