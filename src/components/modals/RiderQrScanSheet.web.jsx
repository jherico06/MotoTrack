import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, Platform } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';

/**
 * Web overlay for QR paste (camera is native-only). Confirm still pops in-web.
 */
export default function RiderQrScanSheet({ visible, order, onClose, onScanned }) {
  const [paste, setPaste] = useState('');

  useEffect(() => {
    if (!visible) setPaste('');
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>MotoTrack Rider</Text>
            <Text style={styles.title}>Scan order QR</Text>
            <Text style={styles.hint}>
              {order?.orderId
                ? `Paste the packing-label QR link for order #${order.orderId}. On a phone, the camera opens in the app.`
                : 'Paste the packing-label QR link. On a phone, the camera opens in the app.'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <BootstrapIcon name="x-lg" size={16} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <BootstrapIcon name="qr-code-scan" size={36} color="#5EEAD4" />
          </View>
          <Text style={styles.cardTitle}>Open inside this browser</Text>
          <Text style={styles.cardBody}>
            After you verify the QR, Confirm Delivery pops up here in the web app — it will not jump to
            another site.
          </Text>

          <Text style={styles.label}>Paste the QR link / token</Text>
          <TextInput
            style={styles.input}
            value={paste}
            onChangeText={setPaste}
            placeholder="Paste confirm link"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, !paste.trim() && { opacity: 0.55 }]}
            disabled={!paste.trim()}
            accessibilityRole="button"
            onPress={() => onScanned?.(paste.trim())}
          >
            <Text style={styles.primaryBtnText}>Verify this QR</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: '#0B1220',
    ...(Platform.OS === 'web' ? { position: 'fixed', inset: 0 } : null),
  },
  safe: { flex: 1, paddingHorizontal: 16, paddingBottom: 20 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 20,
    paddingBottom: 16,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  hint: { fontSize: 13, color: '#94A3B8', marginTop: 4, lineHeight: 18 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(14,98,88,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC', textAlign: 'center' },
  cardBody: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '800', color: '#CBD5E1', marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    color: '#F8FAFC',
    backgroundColor: '#0B1220',
  },
  primaryBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelBtn: {
    marginTop: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
});
