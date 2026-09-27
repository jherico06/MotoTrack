/**
 * Admin pickup QR scan / manual token verify.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { serviceQuotationService } from '../../services/serviceQuotationService';

export default function PickupQrScannerPanel({ onToast, onCompleted, style }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const verify = async () => {
    const t = token.trim();
    if (!t) {
      onToast?.('Enter or paste pickup QR token');
      return;
    }
    setBusy(true);
    try {
      // Always authoritative — no stale cache for pickup authorization
      const res = await serviceQuotationService.verifyPickupQr(t, { verifiedBy: 'admin' });
      setLastResult(res);
      if (!res.success) {
        onToast?.(res.error || 'Invalid QR');
        return;
      }
      onToast?.(`Pickup completed for ${res.booking?.booking_id}`);
      onCompleted?.(res);
      setToken('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>Scan / Verify Pickup QR</Text>
      <Text style={styles.sub}>
        Paste the customer pickup token. Payment and QR validity are verified against Supabase
        (not cache).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Paste pickup QR token (MT-PKP-…)"
        placeholderTextColor="#94A3B8"
        selectionColor="#1D4533"
        underlineColorAndroid="transparent"
        value={token}
        onChangeText={setToken}
        autoCapitalize="characters"
      />
      <TouchableOpacity style={styles.btn} onPress={verify} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.btnText}>Verify & Complete Pickup</Text>
        )}
      </TouchableOpacity>
      {lastResult && !lastResult.success && (
        <Text style={styles.err}>{lastResult.error}</Text>
      )}
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
  btnText: { color: '#FFF', fontWeight: '700' },
  err: { color: '#DC2626', marginTop: 8, fontSize: 13 },
});
