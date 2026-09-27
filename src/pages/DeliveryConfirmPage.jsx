import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
} from 'react-native';
import BootstrapIcon from '../components/common/BootstrapIcon';
import { deliveryService } from '../services/deliveryService';
import { pickImageFromFile, pickImageFromCamera, openAppPermissionSettings } from '../utils/imagePickerHelper';

function formatPeso(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Public, no-login delivery confirmation page for riders.
 * Opened via ?screen=confirm-delivery&token=...
 */
export default function DeliveryConfirmPage({ token: tokenProp, onDone }) {
  const [token, setToken] = useState(() => {
    if (tokenProp) return String(tokenProp).trim();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        return String(new URLSearchParams(window.location.search).get('token') || '').trim();
      } catch (_e) {}
    }
    return '';
  });

  useEffect(() => {
    if (tokenProp) setToken(String(tokenProp).trim());
  }, [tokenProp]);

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [doneOrderId, setDoneOrderId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError('Missing confirmation token. Ask the store for a new QR or link.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await deliveryService.getPublicDeliveryPreview(token);
        if (cancelled) return;
        setPreview(res.preview || null);
        if (!res.success) setError(res.error || 'This confirmation link is not valid.');
        else setError('');
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Unable to validate this link.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePickPhoto = async (source = 'library') => {
    setError('');
    const res = source === 'camera' ? await pickImageFromCamera() : await pickImageFromFile();
    if (res.success) {
      setPhoto(res.uri);
      return;
    }
    if (res.error && res.error !== 'No file selected' && res.error !== 'Selection cancelled' && res.error !== 'Capture cancelled') {
      setError(res.error);
      if (res.openSettings) {
        // Best-effort: open Settings so the rider can re-enable Photos/Camera.
        openAppPermissionSettings();
      }
    }
  };

  const handleConfirm = async () => {
    if (!preview?.isValid) return;
    setBusy(true);
    setError('');
    try {
      const res = await deliveryService.confirmDeliveryByToken({
        token,
        notes: notes.trim(),
        photo,
      });
      if (!res.success) {
        setError(res.error || 'Confirmation failed.');
        return;
      }
      setDone(true);
      setDoneOrderId(res.orderId || preview.orderId || '');
    } catch (e) {
      setError(e?.message || 'Confirmation failed.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <View style={styles.successIcon}>
            <BootstrapIcon name="check-circle-fill" size={36} color="#047857" />
          </View>
          <Text style={styles.brand}>MotoTrack</Text>
          <Text style={styles.title}>Delivery reported</Text>
          <Text style={styles.sub}>
            Order #{doneOrderId} was reported as delivered. The store admin will review and confirm.
            You can close this page.
          </Text>
          {onDone ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const items = Array.isArray(preview?.items) ? preview.items : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>MotoTrack</Text>
        <Text style={styles.title}>Confirm delivery</Text>
        <Text style={styles.sub}>
          {onDone
            ? 'Review the order details, then tap Confirm Delivered after drop-off.'
            : 'No login required. Review the order details, then tap Confirm Delivered after drop-off.'}
        </Text>

        {loading ? (
          <ActivityIndicator color="#1D4533" style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <BootstrapIcon name="exclamation-triangle" size={16} color="#B45309" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {preview ? (
              <>
                <Text style={styles.sectionTitle}>Order</Text>
                <Row label="Order" value={`#${preview.orderId || '—'}`} />
                <Row
                  label="Status"
                  value={preview.orderStatus || preview.deliveryStatus || '—'}
                />
                <Row label="Rider" value={preview.riderName || 'Assigned rider'} />
                {preview.riderContact ? <Row label="Contact" value={preview.riderContact} /> : null}

                <Text style={styles.sectionTitle}>Customer</Text>
                <Row label="Name" value={preview.customerName || '—'} />
                {preview.customerPhone ? <Row label="Phone" value={preview.customerPhone} /> : null}
                <View style={styles.addressBlock}>
                  <Text style={styles.rowLabel}>Deliver to</Text>
                  <Text style={styles.addressValue}>
                    {preview.customerAddress || preview.destinationHint || 'Address on file'}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Items</Text>
                {items.length > 0 ? (
                  <View style={styles.itemsList}>
                    {items.map((item, idx) => (
                      <View key={`${item.name}-${idx}`} style={styles.itemRow}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.itemThumb} />
                        ) : (
                          <View style={[styles.itemThumb, styles.itemThumbPlaceholder]}>
                            <BootstrapIcon name="box-seam" size={16} color="#94A3B8" />
                          </View>
                        )}
                        <View style={styles.itemMeta}>
                          <Text style={styles.itemName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={styles.itemSub}>
                            {[item.brand, item.size ? `Size ${item.size}` : null, `×${item.quantity}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        {Number(item.price) > 0 ? (
                          <Text style={styles.itemPrice}>{formatPeso(item.price * Number(item.quantity || 1))}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.itemsFallback}>
                    {preview.itemsSummary ||
                      (preview.itemCount ? `${preview.itemCount} item(s)` : 'Order items on file')}
                  </Text>
                )}

                <Text style={styles.sectionTitle}>Payment</Text>
                <Row label="Method" value={preview.paymentMethod || '—'} />
                {preview.shippingFee != null ? (
                  <Row label="Shipping" value={formatPeso(preview.shippingFee)} />
                ) : null}
                {preview.discountAmount > 0 ? (
                  <Row label="Discount" value={`−${formatPeso(preview.discountAmount)}`} />
                ) : null}
                {preview.totalAmount != null ? (
                  <Row label="Total" value={formatPeso(preview.totalAmount)} emphasize />
                ) : null}

                {preview.isValid ? (
                  <>
                    <Text style={styles.label}>Notes (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="e.g. Left with customer at gate"
                      placeholderTextColor="#94A3B8"
                      multiline
                      textAlignVertical="top"
                    />

                    <Text style={styles.label}>Photo (optional)</Text>
                    <View style={styles.photoActions}>
                      <TouchableOpacity
                        style={styles.photoBtn}
                        onPress={() => handlePickPhoto('camera')}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="camera" size={14} color="#1D4ED8" />
                        <Text style={styles.photoBtnText}>Take photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.photoBtn}
                        onPress={() => handlePickPhoto('library')}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="image" size={14} color="#1D4ED8" />
                        <Text style={styles.photoBtnText}>
                          {photo ? 'Change from gallery' : 'Choose from gallery'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.photoPreview} />
                    ) : null}

                    <TouchableOpacity
                      style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                      onPress={handleConfirm}
                      disabled={busy}
                      activeOpacity={0.9}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <BootstrapIcon name="check-lg" size={16} color="#fff" />
                          <Text style={styles.primaryBtnText}>Confirm Delivered</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.footnote}>
                      This reports the drop-off to the store. Final delivery confirmation is done by
                      admin.
                    </Text>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, emphasize }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.rowValueEmphasize]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B3D38' },
  scroll: { padding: 20, paddingBottom: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brand: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    color: '#D1FAE5',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4533',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  rowLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  rowValue: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'right' },
  rowValueEmphasize: { color: '#1D4533', fontSize: 15 },
  addressBlock: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    gap: 4,
  },
  addressValue: { fontSize: 14, fontWeight: '600', color: '#0F172A', lineHeight: 20 },
  itemsList: { gap: 10, marginTop: 4, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#E2E8F0' },
  itemThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemMeta: { flex: 1, gap: 2 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  itemSub: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  itemPrice: { fontSize: 12, fontWeight: '800', color: '#1D4533' },
  itemsFallback: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    paddingVertical: 8,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 72,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#E2E8F0',
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: '#1D4533',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryBtnText: { color: '#ECFDF5', fontWeight: '700' },
  footnote: { fontSize: 12, color: '#64748B', marginTop: 12, lineHeight: 17, textAlign: 'center' },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  errorText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
});
