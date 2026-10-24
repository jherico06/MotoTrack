import { APP_ROLES, STAFF_ROLES } from '../constants/roles.js';

export const LEGACY_MECHANIC_BLOCKED_MESSAGE =
  'Mechanic profiles are admin-managed and do not have login access. Please contact the store administrator.';

/** Screen id rendered for legacy mechanic login attempts (roster has no accounts). */
export const ACCOUNT_UNAVAILABLE_SCREEN = 'account-unavailable';

export function isAdmin(user) {
  return user?.role === APP_ROLES.ADMIN;
}

export function isRider(user) {
  return user?.role === APP_ROLES.RIDER;
}

/**
 * Detects legacy mechanic login accounts only (blocked).
 * Active mechanics are roster rows managed by admin — they have no user role.
 */
export function isMechanic(user) {
  return user?.role === APP_ROLES.MECHANIC;
}

export function isCustomer(user) {
  return !user?.role || user.role === APP_ROLES.CUSTOMER;
}

/** Active staff roles only (rider). Mechanic roster has no login / is not staff. */
export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function mustChangeStaffPassword(user) {
  return Boolean(user?.must_change_password && isStaffRole(user.role));
}

/** Screen id used by the existing MotoTrack router after a successful sign-in. */
export function homeScreenForRole(role) {
  if (role === APP_ROLES.ADMIN) return 'admin';
  if (role === APP_ROLES.RIDER) return 'rider-dashboard';
  // Legacy mechanic accounts are blocked: never route them to a dashboard.
  if (role === APP_ROLES.MECHANIC) return ACCOUNT_UNAVAILABLE_SCREEN;
  return 'shop';
}
