import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  SafeAreaView,
  Modal,
} from 'react-native';
import BootstrapIcon from '../components/common/BootstrapIcon';
import ExternalLink from '../components/common/ExternalLink';
import { riderAccessService } from '../services/riderAccessService';
import {
  areaFromAddress,
  googleMapsNavigateUrl,
  mapsEmbedUrl,
  parseLatLng,
} from '../utils/geo';

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('reported')) return { bg: '#ECFDF5', text: '#047857', label: 'Waiting admin' };
  if (s.includes('issue') || s.includes('fail')) return { bg: '#FEF2F2', text: '#B91C1C', label: 'Issue' };
  if (s.includes('out') || s.includes('shipped') || s.includes('transit')) {
    return { bg: '#DBEAFE', text: '#1D4ED8', label: 'On the way' };
  }
  if (s.includes('ready')) return { bg: '#FEF3C7', text: '#B45309', label: 'Ready' };
  if (s.includes('resched')) return { bg: '#F1F5F9', text: '#475569', label: 'Rescheduled' };
  return { bg: '#F1F5F9', text: '#334155', label: status || 'Assigned' };
}

function groupByArea(deliveries) {
  const map = new Map();
  (deliveries || []).forEach((d) => {
    const area = d.area || areaFromAddress(d.customerAddress);
    if (!map.has(area)) map.set(area, []);
    map.get(area).push(d);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function QrScanSheet({ visible, order, onClose, onScanned }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [paste, setPaste] = useState('');
  const [camError, setCamError] = useState('');
  const [camReady, setCamReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.remove();
      } catch (_e) {}
      videoRef.current = null;
    }
    setCamReady(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      stopCamera();
      setPaste('');
      setCamError('');
      return undefined;
    }
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera scan works in the phone browser. You can also paste the QR link below.');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const host =
          typeof document !== 'undefined' ? document.getElementById('rider-qr-video-host') : null;
        if (host) {
          const video = document.createElement('video');
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          video.autoplay = true;
          video.style.width = '100%';
          video.style.height = '220px';
          video.style.objectFit = 'cover';
          video.style.borderRadius = '14px';
          video.style.background = '#0F172A';
          video.srcObject = stream;
          host.innerHTML = '';
          host.appendChild(video);
          videoRef.current = video;
          await video.play();
          setCamReady(true);
        }
        const Detector = typeof window !== 'undefined' ? window.BarcodeDetector : null;
        if (!Detector) {
          setCamError('This browser cannot read QR codes. Paste the packing-label link below.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        timerRef.current = setInterval(async () => {
          const el = videoRef.current;
          if (!el || el.readyState < 2) return;
          try {
            const codes = await detector.detect(el);
            const value = codes?.[0]?.rawValue;
            if (value) {
              stopCamera();
              onScanned?.(value);
            }
          } catch (_e) {}
        }, 450);
      } catch (e) {
        setCamError(e?.message || 'Camera permission denied. Paste the packing-label link below.');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [visible, onScanned, stopCamera]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scanOverlay}>
        <View style={styles.scanSheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Scan order QR</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>
          <Text style={styles.scanHint}>
            Scan the packing label on order #{order?.orderId} to verify the correct parcel.
          </Text>
          {Platform.OS === 'web' ? (
            <View
              nativeID="rider-qr-video-host"
              style={{
                width: '100%',
                height: camReady ? 220 : 0,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#0F172A',
              }}
            />
          ) : null}
          {camError ? <Text style={styles.warn}>{camError}</Text> : null}
          <Text style={styles.label}>Or paste the QR link / token</Text>
          <TextInput
            style={styles.input}
            value={paste}
            onChangeText={setPaste}
            placeholder="Paste confirm link"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, !paste.trim() && { opacity: 0.6 }]}
            disabled={!paste.trim()}
            onPress={() => onScanned?.(paste.trim())}
          >
            <Text style={styles.primaryBtnText}>Verify this QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function RiderRunPage({ token: tokenProp }) {
  const token = useMemo(() => {
    if (tokenProp) return String(tokenProp).trim();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        return String(new URLSearchParams(window.location.search).get('token') || '').trim();
      } catch (_e) {}
    }
    return '';
  }, [tokenProp]);

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [scanOrder, setScanOrder] = useState(null);
  const [issueNotes, setIssueNotes] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing rider access link. Ask the store for a new dashboard QR.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await riderAccessService.getPreview(token);
      setPreview(res.preview || null);
      if (!res.success) {
        setError(res.error || 'This rider link is not valid.');
        setDeliveries([]);
        return;
      }
      setError('');
      const withCoords = await riderAccessService.fillMissingCoords(token, res.preview?.deliveries || []);
      setDeliveries(withCoords);
    } catch (e) {
      setError(e?.message || 'Unable to load deliveries.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByArea(deliveries), [deliveries]);

  const handleStatus = async (d, status) => {
    setBusyId(d.orderId);
    setNotice('');
    try {
      const res = await riderAccessService.updateStatus({
        token,
        orderId: d.orderId,
        status,
        notes: status.toLowerCase().includes('issue') ? issueNotes : '',
      });
      if (!res.success) {
        setNotice(res.error || 'Could not update status');
        return;
      }
      setNotice(status.toLowerCase().includes('issue') ? 'Issue reported' : 'Marked on the way');
      setIssueNotes('');
      await load();
      setSelected((prev) => (prev?.orderId === d.orderId ? { ...prev, deliveryStatus: res.deliveryStatus } : prev));
    } finally {
      setBusyId('');
    }
  };

  const handleScanned = async (raw) => {
    const order = scanOrder;
    setScanOrder(null);
    if (!order) return;
    setBusyId(order.orderId);
    setNotice('');
    try {
      const res = await riderAccessService.confirmByQr({
        accessToken: token,
        orderId: order.orderId,
        scannedRaw: raw,
      });
      if (!res.success) {
        setNotice(res.error || 'QR did not match this order');
        return;
      }
      setNotice(`Order #${order.orderId} verified and reported as delivered`);
      setSelected(null);
      await load();
    } finally {
      setBusyId('');
    }
  };

  const detail = selected;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#0C6258" />
          <Text style={styles.muted}>Loading your deliveries…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!preview?.isValid) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <BootstrapIcon name="shield-lock" size={32} color="#B45309" />
          <Text style={styles.brand}>MotoTrack Rider</Text>
          <Text style={styles.title}>Link unavailable</Text>
          <Text style={styles.sub}>{error || preview?.invalidReason || 'This access link is no longer valid.'}</Text>
          <Text style={styles.muted}>
            Access ends when all assigned deliveries are completed or the 48-hour period expires. Ask the store for a new
            link.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>MotoTrack Rider</Text>
        <Text style={styles.title}>Delivery dashboard</Text>
        <Text style={styles.sub}>
          Hi {preview.riderName || 'rider'} — {preview.activeCount} active stop
          {preview.activeCount === 1 ? '' : 's'}
          {preview.completedCount ? ` · ${preview.completedCount} completed` : ''}
        </Text>
        {preview.expiresAt ? (
          <Text style={styles.muted}>
            Access until {new Date(preview.expiresAt).toLocaleString()}
          </Text>
        ) : null}
        {notice ? <Text style={styles.ok}>{notice}</Text> : null}

        {groups.map(([area, stops]) => (
          <View key={area} style={styles.areaBlock}>
            <View style={styles.areaHead}>
              <BootstrapIcon name="geo-alt-fill" size={14} color="#0C6258" />
              <Text style={styles.areaTitle}>{area}</Text>
              <Text style={styles.areaCount}>{stops.length}</Text>
            </View>
            {stops.map((d) => {
              const tone = statusTone(d.deliveryStatus);
              const coords = parseLatLng(d.lat, d.lng);
              return (
                <View key={d.orderId} style={styles.card}>
                  <TouchableOpacity onPress={() => setSelected(d)} activeOpacity={0.85}>
                    <View style={styles.cardTop}>
                      <Text style={styles.orderId}>#{d.orderId}</Text>
                      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.badgeText, { color: tone.text }]}>{tone.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.customer}>{d.customerName}</Text>
                    <Text style={styles.address}>{d.customerAddress || 'No address on file'}</Text>
                    {d.landmark ? <Text style={styles.landmark}>Landmark: {d.landmark}</Text> : null}
                    {d.customerPhone ? <Text style={styles.phone}>{d.customerPhone}</Text> : null}
                    <Text style={styles.coords}>
                      {coords
                        ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
                        : 'Coordinates pending — Maps will use the address'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.actions}>
                    <ExternalLink href={googleMapsNavigateUrl(d.lat, d.lng, d.customerAddress)}>
                      <View style={styles.navBtn}>
                        <BootstrapIcon name="geo-alt-fill" size={14} color="#FFFFFF" />
                        <Text style={styles.navBtnText}>Navigate</Text>
                      </View>
                    </ExternalLink>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => setSelected(d)}>
                      <Text style={styles.ghostBtnText}>Details</Text>
                    </TouchableOpacity>
                    {d.customerPhone ? (
                      <ExternalLink href={`tel:${String(d.customerPhone).replace(/[^\d+]/g, '')}`}>
                        <View style={styles.ghostBtn}>
                          <Text style={styles.ghostBtnText}>Call</Text>
                        </View>
                      </ExternalLink>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={Boolean(detail)} animationType="slide" onRequestClose={() => setSelected(null)}>
        {detail ? (
          <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Order #{detail.orderId}</Text>
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                  <BootstrapIcon name="x-lg" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.customer}>{detail.customerName}</Text>
              <Text style={styles.address}>{detail.customerAddress}</Text>
              {detail.landmark ? <Text style={styles.landmark}>Landmark: {detail.landmark}</Text> : null}
              {detail.customerPhone ? <Text style={styles.phone}>{detail.customerPhone}</Text> : null}
              <Text style={styles.coords}>
                {parseLatLng(detail.lat, detail.lng)
                  ? `${Number(detail.lat).toFixed(6)}, ${Number(detail.lng).toFixed(6)}`
                  : 'No saved coordinates yet'}
              </Text>
              {detail.itemsSummary ? <Text style={styles.muted}>Items: {detail.itemsSummary}</Text> : null}
              {detail.paymentMethod ? <Text style={styles.muted}>{detail.paymentMethod}</Text> : null}

              {Platform.OS === 'web'
                ? React.createElement('iframe', {
                    title: 'Delivery map',
                    src: mapsEmbedUrl(detail.lat, detail.lng, detail.customerAddress),
                    style: { width: '100%', height: 220, border: 0, borderRadius: 14, marginTop: 12 },
                  })
                : null}

              <ExternalLink href={googleMapsNavigateUrl(detail.lat, detail.lng, detail.customerAddress)}>
                <View style={[styles.navBtn, { marginTop: 14 }]}>
                  <BootstrapIcon name="geo-alt-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.navBtnText}>View location / Navigate</Text>
                </View>
              </ExternalLink>

              {String(detail.deliveryStatus || '').toLowerCase().includes('reported') ? (
                <Text style={styles.ok}>Drop-off verified. Waiting for the store to confirm.</Text>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, busyId === detail.orderId && { opacity: 0.7 }]}
                    disabled={busyId === detail.orderId}
                    onPress={() => handleStatus(detail, 'Out for Delivery')}
                  >
                    {busyId === detail.orderId ? (
                      <ActivityIndicator color="#0C6258" />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Mark on the way</Text>
                    )}
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    value={issueNotes}
                    onChangeText={setIssueNotes}
                    placeholder="Issue notes (optional)"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={styles.issueBtn}
                    disabled={busyId === detail.orderId}
                    onPress={() => handleStatus(detail, 'Delivery Issue')}
                  >
                    <Text style={styles.issueBtnText}>Report delivery issue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => setScanOrder(detail)}
                    disabled={busyId === detail.orderId}
                  >
                    <Text style={styles.primaryBtnText}>Scan order QR to confirm delivered</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      <QrScanSheet
        visible={Boolean(scanOrder)}
        order={scanOrder}
        onClose={() => setScanOrder(null)}
        onScanned={handleScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: { flex: 1, padding: 24, justifyContent: 'center', gap: 10 },
  brand: { fontSize: 12, fontWeight: '800', color: '#0C6258', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  sub: { fontSize: 14, color: '#475569', marginTop: 4, lineHeight: 20 },
  muted: { fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 18 },
  ok: { fontSize: 13, color: '#047857', backgroundColor: '#ECFDF5', padding: 10, borderRadius: 10, marginTop: 10 },
  warn: { fontSize: 12, color: '#B45309', marginTop: 8, lineHeight: 18 },
  areaBlock: { marginTop: 18 },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  areaTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  areaCount: { fontSize: 11, fontWeight: '800', color: '#0C6258', backgroundColor: '#CCFBF1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 13, fontWeight: '800', color: '#0C6258' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  customer: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  address: { fontSize: 13, color: '#334155', marginTop: 4, lineHeight: 18 },
  landmark: { fontSize: 12, color: '#0C6258', marginTop: 4, fontWeight: '600' },
  phone: { fontSize: 13, color: '#1D4ED8', marginTop: 4, fontWeight: '700' },
  coords: { fontSize: 11, color: '#64748B', marginTop: 6, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C6258',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
  },
  navBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  ghostBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 42,
    justifyContent: 'center',
  },
  ghostBtnText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: '#0C6258',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#0C6258',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#0C6258', fontWeight: '800', fontSize: 14 },
  issueBtn: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueBtnText: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  scanSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  scanHint: { fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
});
