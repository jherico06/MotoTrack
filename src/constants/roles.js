/**
 * Login roles stored on MotoTrack accounts.
 * Customer accounts use "user". Do not rename these values; Supabase and the API depend on them.
 */
export const APP_ROLES = Object.freeze({
  ADMIN: 'admin',
  RIDER: 'rider',
  /**
   * @deprecated Not a sign-in role. Mechanics are an admin-managed pit-bay roster
   * only (no accounts). Kept so legacy mechanic logins can be detected and blocked.
   */
  MECHANIC: 'mechanic',
  CUSTOMER: 'user',
});

/** Active staff roles that can be invited / sign in. Mechanic roster has no login. */
export const STAFF_ROLES = Object.freeze([APP_ROLES.RIDER]);

/** Recognizes every stored role value, including deprecated "mechanic" (legacy login blocking). */
export function isAppRole(role) {
  return (
    role === APP_ROLES.ADMIN ||
    role === APP_ROLES.RIDER ||
    role === APP_ROLES.MECHANIC ||
    role === APP_ROLES.CUSTOMER
  );
}
