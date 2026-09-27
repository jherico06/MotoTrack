import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { customizationService } from '../../services/customizationService';
import { BootstrapIcon } from '../common';

const TEAL = '#1D4533';

/**
 * Admin read-only customization activity panel.
 * Does not mutate customer builds unless future permissions allow it.
 */
export default function CustomizationsAdminPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await customizationService.listAllForAdmin();
      setRows(list || []);
    } catch (e) {
      setError(e?.message || 'Failed to load customizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = customizationService.subscribe(load);
    return () => unsub?.();
  }, []);

  const filtered = rows.filter((r) => {
    const hay = `${r.name} ${r.customerId || ''} ${r.userId || ''} ${r.motorcycle?.brand || ''} ${r.motorcycle?.model || ''} ${r.status || ''}`.toLowerCase();
    return !query || hay.includes(query.toLowerCase());
  });

  const totals = {
    count: rows.length,
    value: rows.reduce((s, r) => s + (Number(r.totalPrice) || Number(r.total_price) || 0), 0),
    previewed: rows.filter((r) => r.status === 'previewed' || r.previewImageUrl).length,
  };

  const isDark = typeof document !== 'undefined' && document.documentElement?.classList.contains('dark');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { justifyContent: 'flex-end', marginBottom: 10 }]}>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <BootstrapIcon name="arrow-clockwise" size={16} color="#FFF" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.stat, isDark && { backgroundColor: '#141A18', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={styles.statVal}>{totals.count}</Text>
          <Text style={[styles.statLabel, isDark && { color: '#94A3B8' }]}>Builds</Text>
        </View>
        <View style={[styles.stat, isDark && { backgroundColor: '#141A18', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={styles.statVal}>{customizationService.formatMoney(totals.value)}</Text>
          <Text style={[styles.statLabel, isDark && { color: '#94A3B8' }]}>Total Value</Text>
        </View>
        <View style={[styles.stat, isDark && { backgroundColor: '#141A18', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={styles.statVal}>{totals.previewed}</Text>
          <Text style={[styles.statLabel, isDark && { color: '#94A3B8' }]}>With Preview</Text>
        </View>
      </View>

      <TextInput
        style={[styles.search, isDark && { backgroundColor: '#1C2422', borderColor: 'rgba(255,255,255,0.1)', color: '#F8FAFC' }]}
        placeholder="Search customer, bike, status…"
        placeholderTextColor="#94A3B8"
        value={query}
        onChangeText={setQuery}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={TEAL} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView style={{ maxHeight: 520 }}>
          <View style={[styles.tableHead, isDark && { borderBottomColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={[styles.th, { flex: 1.4 }, isDark && { color: '#94A3B8' }]}>Customer / Name</Text>
            <Text style={[styles.th, { flex: 1.2 }, isDark && { color: '#94A3B8' }]}>Motorcycle</Text>
            <Text style={[styles.th, { flex: 0.8 }, isDark && { color: '#94A3B8' }]}>Total</Text>
            <Text style={[styles.th, { flex: 0.7 }, isDark && { color: '#94A3B8' }]}>Status</Text>
            <Text style={[styles.th, { flex: 0.9 }, isDark && { color: '#94A3B8' }]}>Created</Text>
          </View>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No customizations yet.</Text>
          ) : (
            filtered.map((r) => (
              <TouchableOpacity
                key={r.id || r.customization_id}
                style={[styles.tr, isDark && { borderBottomColor: 'rgba(255,255,255,0.06)' }]}
                onPress={() => setSelected(r)}
              >
                <View style={{ flex: 1.4 }}>
                  <Text style={[styles.tdStrong, isDark && { color: '#F8FAFC' }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.tdMuted} numberOfLines={1}>
                    {r.customerId || r.userId || 'Guest'}
                  </Text>
                </View>
                <Text style={[styles.td, { flex: 1.2 }, isDark && { color: '#CBD5E1' }]} numberOfLines={2}>
                  {r.motorcycle?.brand} {r.motorcycle?.model} {r.motorcycle?.year || ''}
                </Text>
                <Text style={[styles.tdStrong, { flex: 0.8, color: isDark ? '#34D399' : TEAL }]}>
                  {customizationService.formatMoney(r.totalPrice || r.total_price)}
                </Text>
                <Text style={[styles.td, { flex: 0.7, textTransform: 'capitalize' }, isDark && { color: '#CBD5E1' }]}>{r.status}</Text>
                <Text style={[styles.tdMuted, { flex: 0.9 }]}>
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {selected && (
        <View style={[styles.detail, isDark && { backgroundColor: '#141A18', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <View style={styles.detailHead}>
            <Text style={[styles.detailTitle, isDark && { color: '#F8FAFC' }]}>{selected.name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <BootstrapIcon name="x-lg" size={16} color={isDark ? '#CBD5E1' : '#64748B'} />
            </TouchableOpacity>
          </View>
          {(selected.previewImageUrl || selected.preview_image_url) && (
            <Image
              source={{ uri: selected.previewImageUrl || selected.preview_image_url }}
              style={styles.preview}
            />
          )}
          <Text style={[styles.detailMeta, isDark && { color: '#CBD5E1' }]}>
            Customer: {selected.customerId || selected.userId || '—'}
          </Text>
          <Text style={[styles.detailMeta, isDark && { color: '#CBD5E1' }]}>
            Motorcycle: {selected.motorcycle?.brand} {selected.motorcycle?.model}{' '}
            {selected.motorcycle?.year || ''}
          </Text>
          <Text style={[styles.detailMeta, isDark && { color: '#CBD5E1' }]}>Status: {selected.status}</Text>
          <Text style={[styles.detailMeta, { fontWeight: '800', color: isDark ? '#34D399' : TEAL }]}>
            Total: {customizationService.formatMoney(selected.totalPrice || selected.total_price)}
          </Text>
          <Text style={[styles.detailMeta, { marginTop: 8, fontWeight: '700' }, isDark && { color: '#F8FAFC' }]}>Selected Parts</Text>
          {(selected.items || []).map((it) => (
            <Text key={it.id || it.item_id || it.productId} style={[styles.partLine, isDark && { color: '#CBD5E1' }]}>
              • {it.name || it.product_name} — {customizationService.formatMoney(it.price)} ×{' '}
              {it.quantity || 1}
            </Text>
          ))}
          <Text style={[styles.readOnlyNote, isDark && { color: '#94A3B8' }]}>
            Read-only view — customer customization data is not edited from admin.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: { fontSize: 16, fontWeight: '800', color: TEAL },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  search: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    backgroundColor: '#FFF',
    color: '#0F172A',
  },
  error: { color: '#B91C1C', marginBottom: 8 },
  tableHead: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  th: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  td: { fontSize: 12, color: '#334155' },
  tdStrong: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  tdMuted: { fontSize: 11, color: '#94A3B8' },
  empty: { padding: 20, color: '#94A3B8', textAlign: 'center' },
  detail: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFC',
  },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  preview: { width: '100%', height: 180, borderRadius: 10, marginBottom: 10, backgroundColor: '#E2E8F0' },
  detailMeta: { fontSize: 12, color: '#475569', marginBottom: 3 },
  partLine: { fontSize: 12, color: '#334155', marginBottom: 2 },
  readOnlyNote: { marginTop: 10, fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
});
