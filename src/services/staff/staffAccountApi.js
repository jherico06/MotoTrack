import { Platform } from 'react-native';
import { APP_CONFIG } from '../../config';
import { authService } from '../auth/authService.js';

function getStaffApiBaseUrl() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_CUSTOMIZE_API_URL || APP_CONFIG.customizeApiUrl || ''
  ).trim();
  if (fromEnv && fromEnv.startsWith('https://')) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return `${proto}//${window.location.hostname}:8787`;
    }
    return 'http://127.0.0.1:8787';
  }
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://127.0.0.1:8787';
}

async function staffFetch(path, { method = 'GET', body, admin = false } = {}) {
  const base = getStaffApiBaseUrl();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (admin) {
    const adminUser = authService.getCurrentUser?.() || null;
    const adminId = adminUser?.user_id || adminUser?.id || '';
    if (!adminId || adminUser?.role !== 'admin') {
      return {
        success: false,
        error: 'Only signed-in administrators can manage staff accounts.',
      };
    }
    headers['X-Admin-User-Id'] = String(adminId);
  }

  try {
    const res = await fetch(`${base}/api/staff${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Request failed (${res.status})`,
        code: data.code,
        ...data,
      };
    }
    return data;
  } catch (err) {
    return {
      success: false,
      error: `Cannot reach staff API at ${base}. Start the server (server/) and check EXPO_PUBLIC_CUSTOMIZE_API_URL. ${err?.message || ''}`.trim(),
    };
  }
}

export const staffAccountApi = {
  getBaseUrl: getStaffApiBaseUrl,

  listStaff(role) {
    const q = role ? `?role=${encodeURIComponent(role)}` : '';
    return staffFetch(q || '/', { method: 'GET', admin: true });
  },

  createStaffAccount({ name, email, phone, role, roster }) {
    return staffFetch('/create', {
      method: 'POST',
      admin: true,
      body: { name, email, phone, role, roster },
    });
  },

  resendOtpAdmin({ userId, email }) {
    return staffFetch('/resend-otp', {
      method: 'POST',
      admin: true,
      body: { userId, email },
    });
  },

  resendOtpPublic({ email }) {
    return staffFetch('/verify/resend', {
      method: 'POST',
      body: { email },
    });
  },

  verifyOtp({ email, otp }) {
    return staffFetch('/verify', {
      method: 'POST',
      body: { email, otp },
    });
  },

  resendCredentials({ userId }) {
    return staffFetch('/resend-credentials', {
      method: 'POST',
      admin: true,
      body: { userId },
    });
  },

  /**
   * Email temporary password to a newly created Rider/Mechanic.
   * Password is sent only in the request body to the server — never logged/returned.
   */
  sendTempCredentials({ name, email, role, temporaryPassword }) {
    return staffFetch('/send-temp-credentials', {
      method: 'POST',
      admin: true,
      body: { name, email, role, temporaryPassword },
    });
  },

  setStatus({ userId, status }) {
    return staffFetch('/status', {
      method: 'POST',
      admin: true,
      body: { userId, status },
    });
  },
};

export default staffAccountApi;
