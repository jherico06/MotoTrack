/**
 * Centralized cache keys + TTL config for MotoTrack cache-first architecture.
 * Do NOT hardcode TTLs elsewhere — import from here.
 */

export const CACHE_TTL = Object.freeze({
  PRODUCTS_MS: 30 * 60 * 1000, // 30 min
  CATEGORIES_MS: 45 * 60 * 1000,
  MOTORCYCLES_MS: 10 * 60 * 1000,
  MOTORCYCLE_MODELS_MS: 30 * 60 * 1000, // admin catalog — relatively static
  PRODUCT_COMPAT_MS: 30 * 60 * 1000, // fitment matrix — relatively static
  MECHANICS_MS: 10 * 60 * 1000,
  BOOKING_LIST_MS: 60 * 1000, // 1 min
  BOOKING_DETAIL_MS: 45 * 1000,
  QUOTATION_MS: 30 * 1000,
  PAYMENTS_MS: 5 * 1000, // minimal — verify authoritative for decisions
  IMAGE_MS: 60 * 60 * 1000,
});

export const CacheKeys = {
  productsList: () => 'products:list',
  productsCategory: (categoryId) => `products:category:${categoryId}`,
  product: (productId) => `product:${productId}`,

  mechanicsList: () => 'mechanics:list',
  mechanic: (mechanicId) => `mechanic:${mechanicId}`,

  customer: (customerId) => `customer:${customerId}`,
  customerMotorcycles: (customerId) => `customer:${customerId}:motorcycles`,
  customerBookings: (customerId) => `customer:${customerId}:bookings`,

  motorcycleModels: () => 'motorcycle:models:catalog',
  productCompatibilityAll: () => 'products:compatibility:all',
  productCompatibility: (productId) => `products:compatibility:${productId}`,

  booking: (bookingId) => `booking:${bookingId}`,
  bookingQuotation: (bookingId) => `booking:${bookingId}:quotation`,
  bookingPayments: (bookingId) => `booking:${bookingId}:payments`,

  adminBookings: (page = 1) => `admin:bookings:p${page}`,
  image: (url) => `image:${String(url || '').slice(0, 180)}`,
};

export function bookingInvalidationKeys(bookingId, customerId) {
  const keys = [
    CacheKeys.booking(bookingId),
    CacheKeys.bookingQuotation(bookingId),
    CacheKeys.bookingPayments(bookingId),
    CacheKeys.adminBookings(1),
  ];
  if (customerId) keys.push(CacheKeys.customerBookings(customerId));
  return keys;
}

export function mechanicInvalidationKeys(mechanicId) {
  return [CacheKeys.mechanicsList(), CacheKeys.mechanic(mechanicId)];
}

export function productInvalidationKeys(productId, categoryId) {
  const keys = [CacheKeys.productsList()];
  if (productId) keys.push(CacheKeys.product(productId));
  if (categoryId) keys.push(CacheKeys.productsCategory(categoryId));
  return keys;
}

export default { CACHE_TTL, CacheKeys };
