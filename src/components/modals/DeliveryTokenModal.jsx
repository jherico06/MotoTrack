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
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { deliveryService } from '../../services/delivery/deliveryService.js';
import {
  confirmUrlNeedsPhoneRewrite,
  makePhoneReachableConfirmBundle,
} from '../../utils/deliveryToken.js';
import {
  getDeliverySlipFields,
  printDeliveryPackingSlip,
  shareDeliveryPackingSlip,
} from '../../utils/deliveryPackingSlip.js';
import { formatPhp } from '../../utils/currency.js';

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
  const [statusNote, setStatusNote] = useState('');
  const orderId = order?.order_id || order?.id;
  const orderStatus = String(order?.status || '').toLowerCase();

  useEffect(() => {
    if (!visible || !orderId) return;
    let cancelled = false;
    let loadSeq = 0;

    const finishBusy = () => {
      if (!cancelled) setBusy(false);
    };

    const applyBundle = async (raw) => {
      if (!raw) {
        if (!cancelled) setBundle(null);
        return false;
      }
      // Prefer already-built QR URL so we don't block on LAN discovery.
      if (raw.qrImageUrl && raw.confirmUrl) {
        if (!cancelled) {
          setBundle({
            ...raw,
            phoneReachable: raw.phoneReachable !== false && !confirmUrlNeedsPhoneRewrite(raw.confirmUrl),
          });
        }
        return true;
      }
      try {
        const reachable = await Promise.race([
          makePhoneReachableConfirmBundle(raw.token, raw.confirmUrl),
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  token: raw.token,
                  confirmUrl: raw.confirmUrl || '',
                  qrImageUrl: raw.confirmUrl
                    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(raw.confirmUrl)}&margin=8`
                    : '',
                  phoneReachable: false,
                }),
              2000
            )
          ),
        ]);
        if (!cancelled) {
          setBundle({
            ...raw,
            token: reachable.token || raw.token,
            confirmUrl: reachable.confirmUrl || raw.confirmUrl,
            qrImageUrl: reachable.qrImageUrl || raw.qrImageUrl,
            phoneReachable: reachable.phoneReachable,
          });
        }
        return Boolean(reachable?.qrImageUrl || reachable?.confirmUrl || raw.qrImageUrl);
      } catch (_e) {
        if (!cancelled && raw.confirmUrl) {
          setBundle({
            ...raw,
            qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(raw.confirmUrl)}&margin=8`,
            phoneReachable: false,
          });
          return true;
        }
        return false;
      }
    };

    const run = async () => {
      const seq = ++loadSeq;
      setBusy(true);
      setStatusNote('');
      setBundle(null);

      try {
        if (orderStatus === 'delivered' || orderStatus === 'completed' || orderStatus === 'cancelled') {
          setStatusNote(
            `This order is already "${order?.status || 'closed'}". A delivery confirmation QR is not needed.`
          );
          return;
        }

        if (initialBundle?.token || initialBundle?.confirmUrl) {
          await applyBundle(initialBundle);
          return;
        }

        const cached = deliveryService.getAdminDeliveryTokenBundle(orderId);
        if (cached) {
          await applyBundle(cached);
          return;
        }

        // Active order with no local QR cache → generate a fresh token so the QR can show.
        const res = await deliveryService.regenerateDeliveryToken(orderId, adminUser, {
          orderSnapshot: order,
        });
        if (cancelled || seq !== loadSeq) return;
        if (!res.success) {
          setStatusNote(res.error || 'Could not generate delivery QR.');
          showToast?.(res.error || 'Could not generate delivery QR');
          return;
        }
        await applyBundle({
          token: res.token,
          confirmUrl: res.confirmUrl,
          qrImageUrl: res.qrImageUrl,
          expiresAt: null,
          phoneReachable: res.phoneReachable !== false,
        });
      } catch (e) {
        if (!cancelled) {
          setStatusNote(e?.message || 'Could not generate delivery QR.');
        }
      } finally {
        finishBusy();
      }
    };

    run();

    return () => {
      cancelled = true;
      setBusy(false);
    };
    // Intentionally only re-run when the modal opens for an order — not on every toast/adminUser identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, orderId]);

  const handleRegenerate = async () => {
    setBusy(true);
    setStatusNote('');
    try {
      const res = await deliveryService.regenerateDeliveryToken(orderId, adminUser, {
        orderSnapshot: order,
      });
      if (!res.success) {
        setStatusNote(res.error || 'Could not generate a new token');
        showToast?.(res.error || 'Could not generate a new token');
        return;
      }
      const next = {
        token: res.token,
        confirmUrl: res.confirmUrl,
        qrImageUrl: res.qrImageUrl,
        expiresAt: null,
        phoneReachable: res.phoneReachable !== false,
      };
      if (next.qrImageUrl && next.confirmUrl) {
        setBundle(next);
      } else {
        const reachable = await makePhoneReachableConfirmBundle(next.token, next.confirmUrl);
        setBundle({ ...next, ...reachable });
      }
      showToast?.('New QR / link generated — previous token invalidated. Re-print the packing label.');
    } catch (e) {
      setStatusNote(e?.message || 'Failed to regenerate token');
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
              ) : busy ? (
                <View style={[styles.qrPlaceholder, isDark && { backgroundColor: '#1C2422', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <ActivityIndicator size="large" color="#EA580C" />
                  <Text style={[styles.qrPlaceholderText, { marginTop: 10 }, isDark && { color: '#94A3B8' }]}>
                    Generating QR code…
                  </Text>
                </View>
              ) : (
                <View style={[styles.qrPlaceholder, isDark && { backgroundColor: '#1C2422', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Text style={[styles.qrPlaceholderText, isDark && { color: '#94A3B8' }]}>
                    {statusNote ||
                      'No QR yet. Tap Generate QR below to create one, then print the packing label.'}
                  </Text>
                </View>
              )}

              {statusNote && bundle?.qrImageUrl ? (
                <Text style={[styles.meta, { color: isDark ? '#FBBF24' : '#B45309', marginBottom: 8 }]}>
                  {statusNote}
                </Text>
              ) : null}

              <View style={[styles.slipCard, isDark && { backgroundColor: '#1C2422', borderColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.slipKicker}>Commercial Shipping Package</Text>
                  <View style={{ backgroundColor: isDark ? '#132A26' : '#FFF7ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#EA580C', fontFamily: 'monospace' }}>
                      Item Nº: {slip.itemNo}
                    </Text>
                  </View>
                </View>

                {slip.productName ? (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 6 }}>
                    {slip.productName}
                  </Text>
                ) : null}

                <Text style={[styles.slipName, isDark && { color: '#F8FAFC' }]}>To: {slip.customerName}</Text>
                {slip.phone ? <Text style={[styles.slipLine, isDark && { color: '#94A3B8' }]}>{slip.phone}</Text> : null}
                <Text style={[styles.slipAddr, isDark && { color: '#CBD5E1' }]}>{slip.address || 'No address on file'}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }}>
                  <Text style={styles.slipPay}>
                    {slip.isCod ? 'Cash on Delivery' : slip.payment}
                    {slip.total != null && slip.total !== '' ? ` · ${formatPhp(slip.total)}` : ''}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    🍷 Fragile · 🤲 Care · ⬆️ Up
                  </Text>
                </View>
              </View>

              <Text style={[styles.meta, isDark && { color: '#94A3B8' }]}>
                {bundle?.qrImageUrl
                  ? 'Valid until delivery is confirmed'
                  : statusNote
                    ? ''
                    : 'Generate a QR to enable packing-label confirmation'}
              </Text>

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
                <BootstrapIcon name="clipboard" size={14} color="#EA580C" />
                <Text style={styles.ghostBtnText}>Copy link</Text>
              </TouchableOpacity>
            ) : null}
            {orderStatus === 'delivered' ||
            orderStatus === 'completed' ||
            orderStatus === 'cancelled' ? null : (
              <TouchableOpacity
                style={[styles.secondaryBtn, busy && { opacity: 0.7 }]}
                onPress={handleRegenerate}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color="#EA580C" />
                ) : (
                  <>
                    <BootstrapIcon name="arrow-repeat" size={14} color="#EA580C" />
                    <Text style={styles.secondaryBtnText}>
                      {bundle ? 'Regenerate QR' : 'Generate QR'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
    zIndex: 999999,
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
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1 },
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
  warnTitle: { fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: 4 },
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
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  slipKicker: {
    fontSize: 10,
    fontWeight: '600',
    color: '#143325',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  slipName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
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
    backgroundColor: '#EA580C',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
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
  ghostBtnText: { color: '#EA580C', fontWeight: '700', fontSize: 13 },
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
  secondaryBtnText: { color: '#EA580C', fontWeight: '700', fontSize: 13 },
});
