/**
 * Login roles stored on MotoTrack accounts.
 * Customer accounts use "user". Do not rename these values; Supabase and the API depend on them.
 */
export const APP_ROLES = Object.freeze({
  ADMIN: 'admin',
  RIDER: 'rider',
  MECHANIC: 'mechanic',
  CUSTOMER: 'user',
});

export const STAFF_ROLES = Object.freeze([APP_ROLES.RIDER, APP_ROLES.MECHANIC]);

export function isAppRole(role) {
  return (
    role === APP_ROLES.ADMIN ||
    role === APP_ROLES.RIDER ||
    role === APP_ROLES.MECHANIC ||
    role === APP_ROLES.CUSTOMER
  );
}
