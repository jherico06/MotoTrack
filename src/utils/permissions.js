import { APP_ROLES, STAFF_ROLES } from '../constants/roles.js';

export function isAdmin(user) {
  return user?.role === APP_ROLES.ADMIN;
}

export function isRider(user) {
  return user?.role === APP_ROLES.RIDER;
}

export function isMechanic(user) {
  return user?.role === APP_ROLES.MECHANIC;
}

export function isCustomer(user) {
  return !user?.role || user.role === APP_ROLES.CUSTOMER;
}

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
  if (role === APP_ROLES.MECHANIC) return 'mechanic-dashboard';
  return 'shop';
}
