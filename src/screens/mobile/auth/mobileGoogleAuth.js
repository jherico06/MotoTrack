import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase, supabaseManager } from '../../../lib/supabase.js';
import { authService, extractAuthParamsFromUrl } from '../../../services/auth/authService.js';

const PRIVATE_LAN_HOST_RE =
  /^(?:exps?):\/\/(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/|$)/i;

const processedOAuthCodes = new Set();
let inFlightMobileGoogleSignIn = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isPrivateLanExpoRedirect(url) {
  return typeof url === 'string' && PRIVATE_LAN_HOST_RE.test(url.trim());
}

/**
 * Resolves the safest OAuth redirect URL for the current mobile runtime.
 *
 * Hosted Supabase rejects private LAN IP redirects like `exp://192.168.x.x:8081`
 * even when `exp://**` is allowlisted, falling back to Site URL (`localhost:8081`).
 * On iOS Expo Go, `ASWebAuthenticationSession` (`openAuthSessionAsync`) intercepts
 * `mototrack://` internally via `callbackURLScheme` without requiring Info.plist
 * registration, and Supabase already allowlists `mototrack://auth-callback`.
 */
export function resolveMobileGoogleRedirect({
  platformOS = Platform.OS,
  executionEnvironment = Constants.executionEnvironment,
  storeClientEnv = ExecutionEnvironment.StoreClient,
  createURL = Linking.createURL,
} = {}) {
  const isExpoGo = executionEnvironment === storeClientEnv;
  const baseUrl = isExpoGo
    ? createURL('auth-callback')
    : createURL('auth-callback', { scheme: 'mototrack' });

  if (isExpoGo && isPrivateLanExpoRedirect(baseUrl)) {
    if (platformOS === 'ios') {
      return {
        redirectUrl: 'mototrack://auth-callback',
        mode: 'ios-aswebauth-scheme',
        rawExpoUrl: baseUrl,
      };
    }
    return {
      redirectUrl: baseUrl,
      mode: 'android-lan-blocked',
      rawExpoUrl: baseUrl,
    };
  }

  return {
    redirectUrl: baseUrl,
    mode: 'direct',
    rawExpoUrl: baseUrl,
  };
}

async function recoverActiveGoogleSession(client) {
  const cachedUser = authService.getCurrentUser?.();
  if (cachedUser?.auth_provider === 'google') {
    return { success: true, user: cachedUser };
  }

  try {
    const { data: sessionData } = await client.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser) {
      const safeUser = await authService.syncOAuthUser(sessionUser);
      if (safeUser) {
        authService.setCurrentUser(safeUser);
        return { success: true, user: safeUser };
      }
    }
  } catch (_e) {}

  return null;
}

async function completeMobileCallback(client, callbackUrl) {
  const params = extractAuthParamsFromUrl(callbackUrl);
  if (params.error || params.error_description) {
    return {
      success: false,
      error: params.error_description || params.error || 'Google authentication failed.',
    };
  }

  // If another listener (e.g. AuthContext deep-link handler) already exchanged this
  // single-use PKCE code, return the active user instead of failing on reuse.
  if (params.code && processedOAuthCodes.has(params.code)) {
    const recovered = await recoverActiveGoogleSession(client);
    if (recovered?.success) return recovered;
  }

  const res = await authService.handleOAuthCallbackUrl(callbackUrl);
  if (res?.success && res.user) {
    if (params.code) {
      processedOAuthCodes.add(params.code);
    }
    return res;
  }

  // Race recovery: AuthContext's Linking listener may have finished the exchange just before us.
  const recovered = await recoverActiveGoogleSession(client);
  if (recovered?.success) {
    if (params.code) {
      processedOAuthCodes.add(params.code);
    }
    return recovered;
  }

  return res || { success: false, error: 'Could not complete Google sign-in.' };
}

async function executeMobileGoogleSignIn() {
  const client = supabase || supabaseManager?.getClient();
  if (!client) {
    return {
      success: false,
      error: 'Google sign-in is unavailable because the database client is not configured.',
    };
  }

  const { redirectUrl, mode, rawExpoUrl } = resolveMobileGoogleRedirect();

  if (mode === 'android-lan-blocked') {
    return {
      success: false,
      redirectConfigNeeded: true,
      redirectUrl: rawExpoUrl,
      error:
        'Expo Go on Android LAN (' +
        rawExpoUrl +
        ') cannot receive Supabase OAuth redirects. Start Expo with "npm run mobile" (Tunnel) or use a development build.',
    };
  }

  try {
    try {
      WebBrowser.maybeCompleteAuthSession();
    } catch (_e) {}

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      const errMsg = error.message || '';
      if (
        errMsg.toLowerCase().includes('not enabled') ||
        errMsg.toLowerCase().includes('unsupported provider')
      ) {
        return {
          success: false,
          notEnabled: true,
          error:
            'Google OAuth is not enabled yet in your Supabase project dashboard. Enable Google in Authentication > Providers.',
        };
      }
      return { success: false, error: errMsg };
    }

    if (!data?.url) {
      return { success: false, error: 'Could not obtain Google authentication URL from Supabase.' };
    }

    let capturedUrl = null;
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (
        url &&
        (url.includes('code=') || url.includes('access_token=') || url.includes('error='))
      ) {
        capturedUrl = url;
      }
    });

    let authResponse;
    try {
      authResponse = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (!capturedUrl && authResponse?.type !== 'success') {
        await sleep(300);
      }
    } finally {
      linkSub?.remove?.();
    }

    const callbackUrl =
      capturedUrl || (authResponse?.type === 'success' ? authResponse.url : null);

    if (callbackUrl) {
      return await completeMobileCallback(client, callbackUrl);
    }

    const pending = await authService.waitForPendingGoogleCallback?.(1500);
    if (pending?.success) return pending;

    const recovered = await recoverActiveGoogleSession(client);
    if (recovered?.success) return recovered;

    if (authResponse?.type === 'cancel' || authResponse?.type === 'dismiss') {
      return {
        success: false,
        cancelled: true,
        error: '',
      };
    }

    return {
      success: false,
      redirectConfigNeeded: true,
      redirectUrl,
      error:
        'Google sign-in did not return to MotoTrack. Try starting Expo with "npm run mobile" (Tunnel) or use a development build.',
    };
  } catch (err) {
    console.warn('[Mobile Google Auth] Sign-in error:', err);
    return {
      success: false,
      error: err?.message || 'Mobile Google sign-in failed.',
    };
  }
}

export async function signInWithGoogleMobile() {
  if (inFlightMobileGoogleSignIn) {
    return inFlightMobileGoogleSignIn;
  }
  inFlightMobileGoogleSignIn = executeMobileGoogleSignIn().finally(() => {
    inFlightMobileGoogleSignIn = null;
  });
  return inFlightMobileGoogleSignIn;
}
