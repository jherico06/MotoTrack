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
import { deliveryService } from '../../services/deliveryService';
import {
  confirmUrlNeedsPhoneRewrite,
  makePhoneReachableConfirmBundle,
} from '../../utils/deliveryToken';
import {
  getDeliverySlipFields,
  printDeliveryPackingSlip,
  shareDeliveryPackingSlip,
} from '../../utils/deliveryPackingSlip';
import { formatPhp } from '../../utils/currency';

/**
 * Shows the secure delivery QR + link for the admin to share with the rider.
 */
export default function DeliveryTokenModal({
  visible,
  order,
  adminUser,
  initialBundle = null,
  onClose,
  showToast,
}) {
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const orderId = order?.order_id || order?.id;

  useEffect(() => {
    if (!visible || !orderId) return;
    let cancelled = false;

    const applyBundle = async (raw) => {
      if (!raw) {
        if (!cancelled) setBundle(null);
        return;
      }
      if (raw.confirmUrl && !confirmUrlNeedsPhoneRewrite(raw.confirmUrl) && raw.qrImageUrl) {
        if (!cancelled) setBundle({ ...raw, phoneReachable: true });
        return;
      }
      const reachable = await makePhoneReachableConfirmBundle(raw.token, raw.confirmUrl);
      if (!cancelled) {
        setBundle({
          ...raw,
          token: reachable.token || raw.token,
          confirmUrl: reachable.confirmUrl || raw.confirmUrl,
          qrImageUrl: reachable.qrImageUrl || raw.qrImageUrl,
          phoneReachable: reachable.phoneReachable,
        });
      }
    };

    if (initialBundle?.token || initialBundle?.confirmUrl) {
      applyBundle(initialBundle);
      return () => {
        cancelled = true;
      };
    }
    applyBundle(deliveryService.getAdminDeliveryTokenBundle(orderId));
    return () => {
      cancelled = true;
    };
  }, [visible, orderId, initialBundle]);

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const res = await deliveryService.regenerateDeliveryToken(orderId, adminUser);
      if (!res.success) {
        showToast?.(res.error || 'Could not generate a new token');
        return;
      }
      setBundle({
        token: res.token,
        confirmUrl: res.confirmUrl,
        qrImageUrl: res.qrImageUrl,
        expiresAt: null,
        phoneReachable: res.phoneReachable !== false,
      });
      showToast?.('New QR / link generated — previous token invalidated');
    } catch (e) {
      showToast?.(e?.message || 'Failed to regenerate token');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const url = bundle?.confirmUrl;
    if (!url) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast?.('Delivery link copied');
        return;
      }
      await Share.share({ message: url, title: 'MotoTrack delivery confirmation' });
    } catch (_e) {
      showToast?.('Could not copy link');
    }
  };

  const handlePrint = async () => {
    if (!bundle?.qrImageUrl && !bundle?.confirmUrl) {
      showToast?.('Generate a QR first, then print the packing label');
      return;
    }
    if (Platform.OS === 'web') {
      const res = printDeliveryPackingSlip(order, bundle);
      if (res.success) {
        showToast?.('Print the label and wrap it on the parcel');
      } else {
        showToast?.(res.error || 'Could not open print preview');
      }
      return;
    }
    try {
      await shareDeliveryPackingSlip(order, bundle);
    } catch (_e) {
      showToast?.('Could not share packing label');
    }
  };

  const slip = getDeliverySlipFields(order, bundle || {});

  if (!visible) return null;

  const isDark = typeof document !== 'undefined' && document.documentElement?.classList.contains('dark');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, isDark && { backgroundColor: '#141A18', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && { color: '#F8FAFC' }]}>Print delivery QR label</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, isDark && { backgroundColor: '#1C2422' }]}>
              <BootstrapIcon name="x-lg" size={14} color={isDark ? '#CBD5E1' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View>
              <Text style={[styles.body, isDark && { color: '#94A3B8' }]}>
                Print this label, wrap it on the parcel, then the rider scans the QR with the phone
                Camera after drop-off — no app or login needed. Single use.
              </Text>

              {bundle && bundle.phoneReachable === false ? (
                <View style={[styles.warnBox, isDark && { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
                  <Text style={[styles.warnTitle, isDark && { color: '#FBBF24' }]}>iPhone cannot open this QR yet</Text>
                  <Text style={[styles.warnBody, isDark && { color: '#CBD5E1' }]}>
                    The link still points at this computer ({bundle.confirmUrl || 'localhost'}). Put
                    the iPhone on the same Wi-Fi, allow port 8081 in Windows Firewall, then tap
                    Regenerate QR. For deliveries away from the shop, set EXPO_PUBLIC_APP_URL to a
                    public https address and restart Expo.
                  </Text>
                </View>
              ) : null}

              {bundle?.qrImageUrl ? (
                <Image source={{ uri: bundle.qrImageUrl }} style={styles.qr} />
              ) : (
                <View style={[styles.qrPlaceholder, isDark && { backgroundColor: '#1C2422', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text style={[styles.qrPlaceholderText, isDark && { color: '#94A3B8' }]}>
                    No active token on this device. Generate a new QR to share with the rider.
                  </Text>
                </View>
              )}

              <View style={[styles.slipCard, isDark && { backgroundColor: '#1C2422', borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={styles.slipKicker}>Wrap on parcel · Deliver to</Text>
                <Text style={[styles.slipName, isDark && { color: '#F8FAFC' }]}>{slip.customerName}</Text>
                {slip.phone ? <Text style={[styles.slipLine, isDark && { color: '#94A3B8' }]}>{slip.phone}</Text> : null}
                <Text style={[styles.slipAddr, isDark && { color: '#CBD5E1' }]}>{slip.address || 'No address on file'}</Text>
                {slip.items?.length ? (
                  <Text style={[styles.slipItems, isDark && { color: '#94A3B8' }]} numberOfLines={3}>
                    {slip.items.join(' · ')}
                  </Text>
                ) : null}
                <Text style={styles.slipPay}>
                  {slip.isCod ? 'Cash on delivery' : slip.payment}
                  {slip.total != null && slip.total !== '' ? ` · ${formatPhp(slip.total)}` : ''}
                </Text>
              </View>

              <Text style={[styles.meta, isDark && { color: '#94A3B8' }]}>Valid until delivery is confirmed</Text>

              {bundle?.confirmUrl ? (
                <Text style={[styles.link, isDark && { color: '#34D399', backgroundColor: '#1C2422' }]} numberOfLines={3} selectable>
                  {bundle.confirmUrl}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            {bundle?.qrImageUrl || bundle?.confirmUrl ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={handlePrint} activeOpacity={0.9}>
                <BootstrapIcon name="printer-fill" size={14} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {Platform.OS === 'web' ? 'Print packing label' : 'Share packing label'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {bundle?.confirmUrl ? (
              <TouchableOpacity style={styles.ghostBtn} onPress={handleCopy} activeOpacity={0.9}>
                <BootstrapIcon name="clipboard" size={14} color="#1D4533" />
                <Text style={styles.ghostBtnText}>Copy link</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.secondaryBtn, busy && { opacity: 0.7 }]}
              onPress={handleRegenerate}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#1D4533" />
              ) : (
                <>
                  <BootstrapIcon name="arrow-repeat" size={14} color="#1D4533" />
                  <Text style={styles.secondaryBtnText}>
                    {bundle ? 'Regenerate QR' : 'Generate QR'}
                  </Text>
                </>
              )}
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
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  scroll: { maxHeight: 520 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A', flex: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 14 },
  warnBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  warnTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  warnBody: { fontSize: 12, color: '#78350F', lineHeight: 17 },
  qr: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  qrPlaceholder: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 10,
  },
  qrPlaceholderText: { color: '#64748B', textAlign: 'center', fontSize: 13, lineHeight: 18 },
  slipCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  slipKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#143325',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  slipName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  slipLine: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 2 },
  slipAddr: { fontSize: 13, color: '#475569', lineHeight: 18, marginTop: 4 },
  slipItems: { fontSize: 12, color: '#143325', marginTop: 8, lineHeight: 17 },
  slipPay: { fontSize: 12, fontWeight: '700', color: '#92400E', marginTop: 8 },
  meta: { fontSize: 12, color: '#047857', fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  link: {
    fontSize: 11.5,
    color: '#334155',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: { gap: 8 },
  primaryBtn: {
    backgroundColor: '#1D4533',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ghostBtn: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ghostBtnText: { color: '#1D4533', fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtnText: { color: '#1D4533', fontWeight: '700', fontSize: 13 },
});
