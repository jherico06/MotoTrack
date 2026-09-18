import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import ExternalLink from '../common/ExternalLink';
import {
  riderAccessService,
  makePhoneReachableRiderBundle,
} from '../../services/riderAccessService';
import { confirmUrlNeedsPhoneRewrite } from '../../utils/deliveryToken';

/**
 * Admin share sheet for the temporary rider dashboard link (no rider account).
 */
export default function RiderAccessModal({
  visible,
  rider,
  adminUser,
  initialBundle = null,
  onClose,
  showToast,
}) {
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;

    const apply = async (raw) => {
      if (!raw?.token && !raw?.dashboardUrl) {
        if (!cancelled) setBundle(null);
        return;
      }
      if (raw.dashboardUrl && !confirmUrlNeedsPhoneRewrite(raw.dashboardUrl) && raw.qrImageUrl) {
        if (!cancelled) setBundle({ ...raw, phoneReachable: true });
        return;
      }
      const reachable = await makePhoneReachableRiderBundle(raw.token, raw.dashboardUrl);
      if (!cancelled) {
        setBundle({
          ...raw,
          ...reachable,
          token: reachable.token || raw.token,
        });
      }
    };

    (async () => {
      if (initialBundle?.token || initialBundle?.dashboardUrl) {
        await apply(initialBundle);
        return;
      }
      const cached = await riderAccessService.getCachedBundle({
        riderId: rider?.id || rider?.rider_id,
        riderName: rider?.name || rider?.rider_name,
        riderContact: rider?.phone || rider?.rider_contact,
      });
      if (cached?.token || cached?.dashboardUrl) {
        await apply(cached);
        return;
      }
      if (!cancelled && (rider?.id || rider?.name || rider?.rider_name)) {
        const res = await riderAccessService.issueRiderAccess({
          riderId: rider?.id || rider?.rider_id,
          riderName: rider?.name || rider?.rider_name,
          riderContact: rider?.phone || rider?.rider_contact,
          adminUser,
        });
        if (!cancelled && res?.success) await apply(res);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, rider, initialBundle]);

  const handleIssue = async (forceNew) => {
    setBusy(true);
    try {
      const res = await riderAccessService.issueRiderAccess({
        riderId: rider?.id || rider?.rider_id,
        riderName: rider?.name || rider?.rider_name,
        riderContact: rider?.phone || rider?.rider_contact,
        adminUser,
        forceNew,
      });
      if (!res.success) {
        showToast?.(res.error || 'Could not create rider link');
        return;
      }
      setBundle(res);
      showToast?.(forceNew ? 'New rider dashboard link created' : 'Rider dashboard link ready');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const url = bundle?.dashboardUrl;
    if (!url) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      showToast?.('Rider dashboard link copied');
    } catch (_e) {
      showToast?.(url);
    }
  };

  const handleShare = async () => {
    const url = bundle?.dashboardUrl;
    if (!url) return;
    try {
      await Share.share({
        message: `MotoTrack rider deliveries:\n${url}`,
        url,
        title: 'Rider delivery dashboard',
      });
    } catch (_e) {}
  };

  if (!visible) return null;
  const riderName = rider?.name || rider?.rider_name || 'Rider';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Rider dashboard link</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.meta}>{riderName}</Text>
            <Text style={styles.hint}>
              Temporary access — no rider account. Opens a phone-friendly list of this rider’s assigned
              deliveries with Google Maps navigation. The link expires after 48 hours or when all assigned
              stops are completed.
            </Text>
            {bundle?.qrImageUrl ? (
              <Image source={{ uri: bundle.qrImageUrl }} style={styles.qr} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.hint}>No link yet. Generate one to share with the rider.</Text>
              </View>
            )}
            {bundle?.dashboardUrl ? (
              <ExternalLink href={bundle.dashboardUrl}>
                <Text style={styles.url}>{bundle.dashboardUrl}</Text>
              </ExternalLink>
            ) : null}
            {bundle?.expiresAt ? (
              <Text style={styles.hint}>Valid until {new Date(bundle.expiresAt).toLocaleString()}</Text>
            ) : null}
            {bundle && bundle.phoneReachable === false ? (
              <Text style={styles.warn}>
                This link still points at this computer (localhost) so a phone cannot open it. Put the
                rider on the same Wi-Fi, allow port 8081 in Windows Firewall, then tap Regenerate. For
                deliveries away from the shop, set EXPO_PUBLIC_APP_URL to a public https address and
                restart Expo.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Phone: same Wi-Fi as this computer, then scan the QR or tap the blue Open button. Do
                not scan this with Expo Go — use the Camera / Chrome / Safari.
              </Text>
            )}
          </ScrollView>
          <View style={styles.actions}>
            {bundle?.dashboardUrl ? (
              <>
                <ExternalLink href={bundle.dashboardUrl}>
                  <View style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Open rider dashboard</Text>
                  </View>
                </ExternalLink>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopy} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>Copy link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={handleShare} disabled={busy}>
                  <Text style={styles.ghostBtnText}>Share…</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleIssue(false)} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Generate link</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.ghostBtn} onPress={() => handleIssue(true)} disabled={busy}>
              <Text style={styles.ghostBtnText}>{busy ? 'Working…' : 'Regenerate link'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    maxHeight: '90%',
    ...Platform.select({
      web: { boxShadow: '0 20px 40px rgba(15,23,42,0.18)' },
      default: { elevation: 8 },
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontSize: 14, fontWeight: '800', color: '#0C6258', marginBottom: 6 },
  hint: { fontSize: 12, color: '#64748B', lineHeight: 18, marginBottom: 10 },
  warn: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, marginTop: 8 },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: 8 },
  qrPlaceholder: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  url: {
    fontSize: 11,
    color: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    textDecorationLine: 'underline',
  },
  actions: { gap: 8, marginTop: 12 },
  primaryBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: '#0C6258',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#0C6258', fontWeight: '800', fontSize: 14 },
  ghostBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
});
