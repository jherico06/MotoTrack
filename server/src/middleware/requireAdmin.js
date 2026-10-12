import { getSupabaseAdmin } from '../services/supabaseAdmin.js';

/**
 * Admin-only gate for staff management APIs.
 * Client sends X-Admin-User-Id of the signed-in admin; we verify role in DB via service role.
 */
export async function requireAdmin(req, res, next) {
  try {
    const adminUserId = String(
      req.headers['x-admin-user-id'] || req.headers['x-mototrack-admin-id'] || ''
    ).trim();

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required.',
      });
    }

    const supabase = getSupabaseAdmin();
    const { data: admin, error } = await supabase
      .from('users')
      .select('user_id, role, status, email, name')
      .eq('user_id', adminUserId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, error: 'Could not verify admin identity.' });
    }

    if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Only active administrators can manage staff accounts.',
      });
    }

    req.admin = admin;
    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Admin authorization failed.',
    });
  }
}
