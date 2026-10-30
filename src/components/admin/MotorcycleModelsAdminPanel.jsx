/**
 * Admin CRUD for motorcycle brand + model catalog.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { compatibilityService } from '../../services/products/compatibilityService.js';
import { getThemeTokens } from '../../styles/theme.js';

export default function MotorcycleModelsAdminPanel({ onToast, style, isDarkMode = false }) {
  const t = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(t, isDarkMode), [t, isDarkMode]);

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState('Honda');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await compatibilityService.getMotorcycleModels({
        activeOnly: false,
        force: true,
      });
      setModels((list || []).filter((m) => m.is_active !== false));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const add = async () => {
    setBusy(true);
    try {
      const res = await compatibilityService.addMotorcycleModel({ brand, model });
      if (!res.success) {
        onToast?.(res.error || 'Could not add model');
        return;
      }
      setModel('');
      onToast?.(`Added ${brand} — ${res.model?.model || model}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    setBusy(true);
    try {
      const res = await compatibilityService.deleteMotorcycleModel(row.model_id);
      if (!res.success) {
        onToast?.(res.error || 'Could not remove model');
        return;
      }
      onToast?.(`Removed ${row.brand} — ${row.model}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Motorcycle Models</Text>
          <Text style={styles.sub}>
            Brand + model only. Used for product compatibility checkboxes and customer selection.
          </Text>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={refresh}>
          <BootstrapIcon name="arrow-clockwise" size={14} color={t.accentBrand} />
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand (e.g. Honda)"
          placeholderTextColor={t.placeholder}
        />
        <TextInput
          style={[styles.input, { flex: 1.2 }]}
          value={model}
          onChangeText={setModel}
          placeholder="Model (e.g. Click 125)"
          placeholderTextColor={t.placeholder}
        />
        <TouchableOpacity style={styles.addBtn} onPress={add} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addText}>Add</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={t.accentBrand} style={{ marginTop: 16 }} />
      ) : (
        <ScrollView style={styles.list}>
          {models.map((m) => (
            <View key={m.model_id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {m.brand} — {m.model}
                </Text>
                <Text style={styles.rowId}>{m.model_id}</Text>
              </View>
              <TouchableOpacity style={styles.delBtn} onPress={() => remove(m)} disabled={busy}>
                <BootstrapIcon name="trash3" size={14} color={t.statusDangerText} />
              </TouchableOpacity>
            </View>
          ))}
          {models.length === 0 && (
            <Text style={styles.empty}>No models yet. Add Honda — Click 125 to get started.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: t.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 16,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    title: { fontSize: 16, fontWeight: '700', color: t.textPrimary },
    sub: { fontSize: 12, color: t.textMuted, marginTop: 4 },
    refresh: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? t.accentBg : '#E6F8F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    input: {
      minWidth: 120,
      borderWidth: 1,
      borderColor: t.borderInput,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.textPrimary,
      backgroundColor: t.inputBg,
    },
    addBtn: {
      backgroundColor: isDark ? '#EA580C' : '#0C6258',
      borderRadius: 10,
      paddingHorizontal: 16,
      justifyContent: 'center',
      minWidth: 72,
      alignItems: 'center',
    },
    addText: { color: '#FFF', fontWeight: '700' },
    list: { maxHeight: 420 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      gap: 8,
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: t.textPrimary },
    rowId: { fontSize: 11, color: t.textMuted, marginTop: 2 },
    delBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? t.statusDangerBg : '#FEF2F2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { fontSize: 13, color: t.textMuted, paddingVertical: 16 },
  });
}
