/**
 * Admin CRUD for motorcycle brand + model catalog.
 */
import React, { useEffect, useState } from 'react';
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
import { compatibilityService } from '../../services/compatibilityService';

export default function MotorcycleModelsAdminPanel({ onToast, style }) {
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
          <BootstrapIcon name="arrow-clockwise" size={14} color="#0C6258" />
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand (e.g. Honda)"
          placeholderTextColor="#94A3B8"
        />
        <TextInput
          style={[styles.input, { flex: 1.2 }]}
          value={model}
          onChangeText={setModel}
          placeholder="Model (e.g. Click 125)"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.addBtn} onPress={add} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addText}>Add</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#0C6258" style={{ marginTop: 16 }} />
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
                <BootstrapIcon name="trash3" size={14} color="#DC2626" />
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 4 },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E6F8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  input: {
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  addBtn: {
    backgroundColor: '#0C6258',
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
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowId: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  delBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: 13, color: '#94A3B8', paddingVertical: 16 },
});
