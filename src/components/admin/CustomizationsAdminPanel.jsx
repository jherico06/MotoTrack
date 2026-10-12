import React, { useEffect, useMemo, useState } from 'react';
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
import { customizationService } from '../../services/bookings/customizationService.js';
import { BootstrapIcon } from '../common';
import { getThemeTokens } from '../../styles/theme.js';

const TEAL = '#1D4533';

/**
 * Admin read-only customization activity panel.
 * Does not mutate customer builds unless future permissions allow it.
 */
export default function CustomizationsAdminPanel({ isDarkMode }) {
  const isDark =
    typeof isDarkMode === 'boolean'
      ? isDarkMode
      : typeof document !== 'undefined' && !!document.documentElement?.classList.contains('dark');
  const t = useMemo(() => getThemeTokens(isDark), [isDark]);
  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { justifyContent: 'flex-end', marginBottom: 10 }]}>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <BootstrapIcon name="arrow-clockwise" size={16} color="#FFF" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{totals.count}</Text>
          <Text style={styles.statLabel}>Builds</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{customizationService.formatMoney(totals.value)}</Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{totals.previewed}</Text>
          <Text style={styles.statLabel}>With Preview</Text>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search customer, bike, status…"
        placeholderTextColor={isDark ? t.placeholder : '#94A3B8'}
        value={query}
        onChangeText={setQuery}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={isDark ? t.accentBrand : TEAL} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView style={{ maxHeight: 520 }}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1.4 }]}>Customer / Name</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Motorcycle</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Total</Text>
            <Text style={[styles.th, { flex: 0.7 }]}>Status</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>Created</Text>
          </View>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No customizations yet.</Text>
          ) : (
            filtered.map((r) => (
              <TouchableOpacity
                key={r.id || r.customization_id}
                style={styles.tr}
                onPress={() => setSelected(r)}
              >
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.tdStrong} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.tdMuted} numberOfLines={1}>
                    {r.customerId || r.userId || 'Guest'}
                  </Text>
                </View>
                <Text style={[styles.td, { flex: 1.2 }]} numberOfLines={2}>
                  {r.motorcycle?.brand} {r.motorcycle?.model} {r.motorcycle?.year || ''}
                </Text>
                <Text style={[styles.tdStrong, { flex: 0.8, color: isDark ? t.money : TEAL }]}>
                  {customizationService.formatMoney(r.totalPrice || r.total_price)}
                </Text>
                <Text style={[styles.td, { flex: 0.7, textTransform: 'capitalize' }]}>{r.status}</Text>
                <Text style={[styles.tdMuted, { flex: 0.9 }]}>
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {selected && (
        <View style={styles.detail}>
          <View style={styles.detailHead}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <BootstrapIcon name="x-lg" size={16} color={isDark ? t.textMuted : '#64748B'} />
            </TouchableOpacity>
          </View>
          {(selected.previewImageUrl || selected.preview_image_url) && (
            <Image
              source={{ uri: selected.previewImageUrl || selected.preview_image_url }}
              style={styles.preview}
            />
          )}
          <Text style={styles.detailMeta}>
            Customer: {selected.customerId || selected.userId || '—'}
          </Text>
          <Text style={styles.detailMeta}>
            Motorcycle: {selected.motorcycle?.brand} {selected.motorcycle?.model}{' '}
            {selected.motorcycle?.year || ''}
          </Text>
          <Text style={styles.detailMeta}>Status: {selected.status}</Text>
          <Text style={[styles.detailMeta, { fontWeight: '800', color: isDark ? t.money : TEAL }]}>
            Total: {customizationService.formatMoney(selected.totalPrice || selected.total_price)}
          </Text>
          <Text style={[styles.detailMeta, { marginTop: 8, fontWeight: '700' }, isDark && { color: t.textPrimary }]}>Selected Parts</Text>
          {(selected.items || []).map((it) => (
            <Text key={it.id || it.item_id || it.productId} style={styles.partLine}>
              • {it.name || it.product_name} — {customizationService.formatMoney(it.price)} ×{' '}
              {it.quantity || 1}
            </Text>
          ))}
          <Text style={styles.readOnlyNote}>
            Read-only view — customer customization data is not edited from admin.
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    root: { padding: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A' },
    sub: { fontSize: 12, color: isDark ? t.textMuted : '#64748B', marginTop: 2 },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#1F6B52' : TEAL,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    refreshText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    stat: {
      flex: 1,
      backgroundColor: isDark ? t.bgCard : '#F8FAFC',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
    },
    statVal: { fontSize: 16, fontWeight: '800', color: isDark ? t.money : TEAL },
    statLabel: { fontSize: 11, color: isDark ? t.textMuted : '#64748B', marginTop: 2 },
    search: {
      borderWidth: 1,
      borderColor: isDark ? t.borderInput : '#E2E8F0',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 10,
      backgroundColor: isDark ? t.inputBg : '#FFF',
      color: isDark ? t.textPrimary : '#0F172A',
    },
    error: { color: isDark ? t.statusDangerText : '#B91C1C', marginBottom: 8 },
    tableHead: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.border : '#E2E8F0',
    },
    th: { fontSize: 11, fontWeight: '700', color: isDark ? t.textMuted : '#64748B', textTransform: 'uppercase' },
    tr: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? t.tableRowBorder : '#F1F5F9',
    },
    td: { fontSize: 12, color: isDark ? t.textSecondary : '#334155' },
    tdStrong: { fontSize: 12, fontWeight: '700', color: isDark ? t.textPrimary : '#0F172A' },
    tdMuted: { fontSize: 11, color: isDark ? t.textSubtle : '#94A3B8' },
    empty: { padding: 20, color: isDark ? t.textMuted : '#94A3B8', textAlign: 'center' },
    detail: {
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? t.border : '#E2E8F0',
      backgroundColor: isDark ? t.bgCard : '#FAFBFC',
    },
    detailHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailTitle: { fontSize: 15, fontWeight: '800', color: isDark ? t.textPrimary : '#0F172A' },
    preview: {
      width: '100%',
      height: 180,
      borderRadius: 10,
      marginBottom: 10,
      backgroundColor: isDark ? t.bgSub : '#E2E8F0',
    },
    detailMeta: { fontSize: 12, color: isDark ? t.textSecondary : '#475569', marginBottom: 3 },
    partLine: { fontSize: 12, color: isDark ? t.textSecondary : '#334155', marginBottom: 2 },
    readOnlyNote: { marginTop: 10, fontSize: 11, color: isDark ? t.textMuted : '#94A3B8', fontStyle: 'italic' },
  });
}
