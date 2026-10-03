/**
 * Admin pickup QR scan / manual token verify — two-step confirm release.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { serviceQuotationService } from '../../services/serviceQuotationService';
import { formatPhp } from '../../utils/serviceQuotation';

export default function PickupQrScannerPanel({ onToast, onCompleted, style, verifiedBy = 'admin' }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [lastError, setLastError] = useState('');

  const scan = async () => {
    const t = token.trim();
    if (!t) {
      onToast?.('Enter or paste pickup QR token');
      return;
    }
    setBusy(true);
    setLastError('');
    setPreview(null);
    try {
      const res = await serviceQuotationService.verifyPickupQr(t, {
        verifiedBy,
        confirm: false,
      });
      if (!res.success) {
        setLastError(res.error || 'Invalid QR');
        onToast?.(res.error || 'Invalid QR');
        return;
      }
      setPreview(res);
      onToast?.('QR valid — confirm release');
    } finally {
      setBusy(false);
    }
  };

  const confirmRelease = async () => {
    const t = token.trim();
    if (!t || !preview?.booking) return;
    setBusy(true);
    try {
      const res = await serviceQuotationService.confirmPickupRelease(t, {
        verifiedBy,
        booking: preview.booking,
      });
      if (!res.success) {
        setLastError(res.error || 'Release failed');
        onToast?.(res.error || 'Release failed');
        return;
      }
      onToast?.(`Pickup completed for ${res.booking?.booking_id}`);
      onCompleted?.(res);
      setToken('');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const b = preview?.booking;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>Scan / Verify Pickup QR</Text>
      <Text style={styles.sub}>
        Paste the customer pickup token. Validation runs against Supabase. Confirm release only after
        the preview looks correct.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Paste pickup QR token (MT-PKP-…)"
        placeholderTextColor="#94A3B8"
        selectionColor="#1D4533"
        underlineColorAndroid="transparent"
        value={token}
        onChangeText={(v) => {
          setToken(v);
          setPreview(null);
          setLastError('');
        }}
        autoCapitalize="characters"
      />
      <TouchableOpacity style={styles.btn} onPress={scan} disabled={busy}>
        {busy && !preview ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>Validate QR</Text>
        )}
      </TouchableOpacity>

      {lastError ? <Text style={styles.err}>{lastError}</Text> : null}

      {b ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Pickup Verification</Text>
          <Text style={styles.row}>Booking #: {b.booking_id}</Text>
          <Text style={styles.row}>Customer: {b.customer_name || '—'}</Text>
          <Text style={styles.row}>
            Motorcycle: {[b.bike_brand, b.bike_model].filter(Boolean).join(' ') || '—'}
          </Text>
          <Text style={styles.row}>Service: {b.service_title || b.package_name || b.service_type || '—'}</Text>
          <Text style={styles.row}>
            Payment: Fully Paid
            {b.final_service_total != null ? ` (${formatPhp(b.final_service_total)})` : ''}
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmRelease} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>Confirm Motorcycle Release</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginVertical: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    outlineStyle: 'none',
  },
  btn: {
    backgroundColor: '#1D4533',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#FFF', fontWeight: '700' },
  err: { color: '#DC2626', marginTop: 8, fontSize: 13 },
  preview: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  previewTitle: { fontSize: 14, fontWeight: '800', color: '#166534', marginBottom: 8 },
  row: { fontSize: 13, color: '#334155', marginBottom: 4 },
});
