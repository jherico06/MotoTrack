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
import { pickImageFromFile } from '../utils/imagePickerHelper';

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

  const handlePickPhoto = async () => {
    const res = await pickImageFromFile();
    if (res.success) setPhoto(res.uri);
    else if (res.error && res.error !== 'No file selected') setError(res.error);
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>MotoTrack</Text>
        <Text style={styles.title}>Confirm delivery</Text>
        <Text style={styles.sub}>
          {onDone
            ? 'Review the delivery, then tap Confirm Delivered after drop-off.'
            : 'No login required. Review the delivery, then tap Confirm Delivered after drop-off.'}
        </Text>

        {loading ? (
          <ActivityIndicator color="#0C6258" style={{ marginTop: 32 }} />
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
                <Row label="Order" value={`#${preview.orderId || '—'}`} />
                <Row label="Rider" value={preview.riderName || 'Assigned rider'} />
                {preview.riderContact ? <Row label="Contact" value={preview.riderContact} /> : null}
                <Row
                  label="Items"
                  value={preview.itemCount ? `${preview.itemCount} item(s)` : 'Order items'}
                />
                <Row label="Area" value={preview.destinationHint || 'On file'} />
                <Row
                  label="Status"
                  value={preview.orderStatus || preview.deliveryStatus || '—'}
                />

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
                    <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} activeOpacity={0.85}>
                      <BootstrapIcon name="camera" size={14} color="#1D4ED8" />
                      <Text style={styles.photoBtnText}>
                        {photo ? 'Change photo' : 'Add delivery photo'}
                      </Text>
                    </TouchableOpacity>
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

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
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
    backgroundColor: '#0C6258',
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
