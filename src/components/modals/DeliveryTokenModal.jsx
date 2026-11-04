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

              {statusNote ? (
                <Text style={[styles.meta, { color: isDark ? '#FBBF24' : '#B45309', marginBottom: 8 }]}>
                  {statusNote}
                </Text>
              ) : null}

              {/* Official MotoTrack Packaging Label Preview */}
              <View style={styles.stickerPreviewCard}>
                {/* Left section */}
                <View style={styles.stickerLeftCol}>
                  {/* Row 1: Logo & Product Name */}
                  <View style={styles.stickerRowHeader}>
                    <View style={styles.stickerCellLogo}>
                      <View style={styles.stickerLogoRow}>
                        <BootstrapIcon name="speedometer2" size={13} color="#EA580C" />
                        <Text style={styles.stickerLogoText}>
                          MOTO<Text style={{ color: '#EA580C' }}>TRACK</Text>
                        </Text>
                      </View>
                      <View style={styles.stickerLogoBar} />
                    </View>
                    <View style={styles.stickerCellProduct}>
                      <Text style={styles.stickerProductText} numberOfLines={2}>
                        {slip.productName || '2× Side Mirror'}
                      </Text>
                    </View>
                  </View>

                  {/* Row 2: Addresses & Handling Icons */}
                  <View style={styles.stickerRowAddresses}>
                    <View style={styles.stickerCellFrom}>
                      <Text style={styles.stickerAddrHead}>
                        From : <Text style={styles.stickerAddrName}>{slip.fromCompany || 'MotoTrack'}</Text>
                      </Text>
                      <Text style={styles.stickerAddrSub}>{slip.fromPhone || '6044-4409'}</Text>
                      <Text style={styles.stickerAddrSub} numberOfLines={1}>{slip.fromAddress || 'Naualio B. Bacalso St'}</Text>
                      <Text style={styles.stickerAddrSub} numberOfLines={1}>{slip.fromCity || 'South Poblacion, Naga, Cebu'}</Text>
                    </View>

                    <View style={styles.stickerCellTo}>
                      <View>
                        <Text style={styles.stickerAddrHead}>
                          To : <Text style={styles.stickerAddrName}>{slip.customerName}</Text>
                        </Text>
                        <Text style={styles.stickerAddrSub} numberOfLines={2}>
                          {slip.address || 'Purok Avocado 4, Inoburan, City of Naga, Cebu'}
                        </Text>
                        {slip.phone ? <Text style={styles.stickerAddrSub}>Tel: {slip.phone}</Text> : null}
                      </View>

                      {/* 3 Handling Icons */}
                      <View style={styles.stickerIconsRow}>
                        <View style={styles.stickerIconBox}>
                          <BootstrapIcon name="cup-straw" size={11} color="#000000" />
                        </View>
                        <View style={styles.stickerIconBox}>
                          <BootstrapIcon name="box-arrow-in-down" size={11} color="#000000" />
                        </View>
                        <View style={styles.stickerIconBox}>
                          <BootstrapIcon name="arrow-up-circle" size={11} color="#000000" />
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Row 3: Spaced Order ID Bar */}
                  <View style={styles.stickerRowTracking}>
                    <Text style={styles.stickerTrackingText}>
                      {slip.formattedSpacedId || 'O  R  D  O  M    2  0  2  6  0  0  0  0  4'}
                    </Text>
                  </View>

                  {/* Row 4: Item NNR & Instruction */}
                  <View style={styles.stickerRowBottom}>
                    <View style={styles.stickerCellNnr}>
                      <Text style={styles.stickerNnrTitle}>Item NNR:</Text>
                      <Text style={styles.stickerNnrVal}>{slip.itemNnr || '2600004'}</Text>
                    </View>
                    <View style={styles.stickerCellInstruction}>
                      <Text style={styles.stickerInstructionTitle}>Delivery Instruction</Text>
                      <View style={styles.stickerInstructionRow}>
                        <BootstrapIcon name="exclamation-triangle-fill" size={11} color="#EA580C" />
                        <Text style={styles.stickerInstructionBody} numberOfLines={2}>
                          {slip.isCod
                            ? `CASH ON DELIVERY: Collect ${slip.total != null ? formatPhp(slip.total).replace(/\.00$/, '') : '₱500'} upon drop-off - Rider: ${slip.riderName ? slip.riderName.split(' ').pop() : 'Maurin'}`
                            : `PREPAID ORDER (${slip.payment || 'PAID'}): No collection required - Rider: ${slip.riderName ? slip.riderName.split(' ').pop() : 'Maurin'}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Right section: QR Code with Orange Corners */}
                <View style={styles.stickerRightCol}>
                  <View style={styles.stickerQrFrame}>
                    {/* Orange Corners */}
                    <View style={[styles.stickerCorner, styles.cornerTL]} />
                    <View style={[styles.stickerCorner, styles.cornerTR]} />
                    <View style={[styles.stickerCorner, styles.cornerBL]} />
                    <View style={[styles.stickerCorner, styles.cornerBR]} />

                    {bundle?.qrImageUrl ? (
                      <Image source={{ uri: bundle.qrImageUrl }} style={styles.stickerQrImg} resizeMode="contain" />
                    ) : busy ? (
                      <View style={styles.stickerQrEmpty}>
                        <ActivityIndicator color="#EA580C" size="small" />
                        <Text style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>Generating…</Text>
                      </View>
                    ) : (
                      <View style={styles.stickerQrEmpty}>
                        <BootstrapIcon name="qr-code" size={20} color="#EA580C" />
                        <Text style={{ fontSize: 9, color: '#64748B', textAlign: 'center', marginTop: 2 }}>
                          No QR Code
                        </Text>
                      </View>
                    )}
                  </View>
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
    maxWidth: 620,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  scroll: { maxHeight: 540 },
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
  body: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 12 },
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
  stickerPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stickerLeftCol: {
    flex: 1,
    borderRightWidth: 2,
    borderRightColor: '#000000',
  },
  stickerRightCol: {
    width: 134,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  stickerRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    minHeight: 46,
  },
  stickerCellLogo: {
    width: '45%',
    padding: 6,
    justifyContent: 'center',
  },
  stickerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stickerLogoText: {
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-CondensedBlack' : 'sans-serif-black',
    fontSize: 14,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#000000',
  },
  stickerLogoBar: {
    height: 2.5,
    backgroundColor: '#EA580C',
    width: '100%',
    marginTop: 3,
    borderRadius: 1,
  },
  stickerCellProduct: {
    width: '55%',
    borderLeftWidth: 1.5,
    borderLeftColor: '#000000',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerProductText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
  },
  stickerRowAddresses: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    minHeight: 76,
  },
  stickerCellFrom: {
    width: '45%',
    padding: 6,
  },
  stickerCellTo: {
    width: '55%',
    borderLeftWidth: 1.5,
    borderLeftColor: '#000000',
    padding: 6,
    justifyContent: 'space-between',
  },
  stickerAddrHead: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  stickerAddrName: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
  },
  stickerAddrSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 12,
  },
  stickerIconsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  stickerIconBox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stickerRowTracking: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stickerTrackingText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  stickerRowBottom: {
    flexDirection: 'row',
    minHeight: 54,
  },
  stickerCellNnr: {
    width: '45%',
    padding: 6,
    justifyContent: 'center',
  },
  stickerNnrTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  stickerNnrVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    lineHeight: 18,
    marginTop: 1,
  },
  stickerCellInstruction: {
    width: '55%',
    borderLeftWidth: 1.5,
    borderLeftColor: '#000000',
    padding: 6,
    justifyContent: 'center',
  },
  stickerInstructionTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 2,
  },
  stickerInstructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stickerInstructionBody: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#000000',
    lineHeight: 11,
    flex: 1,
  },
  stickerQrFrame: {
    width: 108,
    height: 108,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  stickerQrImg: {
    width: 94,
    height: 94,
  },
  stickerQrEmpty: {
    width: 94,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#EA580C',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
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
