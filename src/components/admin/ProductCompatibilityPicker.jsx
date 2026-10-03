/**
 * Admin checkbox list: pick compatible motorcycle models for a product.
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
import { compatibilityService } from '../../services/compatibilityService';

export default function ProductCompatibilityPicker({
  productId,
  onToast,
  style,
}) {
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [newBrand, setNewBrand] = useState('Honda');
  const [newModel, setNewModel] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [catalog, rows] = await Promise.all([
          compatibilityService.getMotorcycleModels({ activeOnly: true, force: true }),
          productId
            ? compatibilityService.getCompatibilityForProduct(productId, { force: true })
            : Promise.resolve([]),
        ]);
        if (!alive) return;
        setModels(catalog || []);
        const sel = new Set();
        for (const r of rows || []) {
          const match = (catalog || []).find(
            (m) =>
              String(m.brand).toLowerCase() === String(r.brand).toLowerCase() &&
              String(m.model).toLowerCase() === String(r.model).toLowerCase()
          );
          if (match) sel.add(match.model_id);
          else sel.add(`${r.brand}|||${r.model}`);
        }
        setSelected(sel);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        String(m.brand).toLowerCase().includes(q) ||
        String(m.model).toLowerCase().includes(q)
    );
  }, [models, search]);

  const toggle = (modelId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const addModel = async () => {
    const brand = newBrand.trim();
    const model = newModel.trim();
    if (!brand || !model) {
      onToast?.('Enter brand and model.');
      return;
    }
    setAdding(true);
    try {
      const res = await compatibilityService.addMotorcycleModel({ brand, model });
      if (!res.success) {
        onToast?.(res.error || 'Could not add model');
        return;
      }
      const created = res.model;
      const catalog = await compatibilityService.getMotorcycleModels({
        activeOnly: true,
        force: true,
      });
      setModels(catalog || []);
      if (created?.model_id) {
        setSelected((prev) => new Set(prev).add(created.model_id));
      }
      setNewModel('');
      setSearch('');
      onToast?.(`Added ${brand} — ${created?.model || model}`);
    } finally {
      setAdding(false);
    }
  };

  const save = async () => {
    if (!productId) {
      onToast?.('Save the product first, then assign compatible motorcycles.');
      return;
    }
    setSaving(true);
    try {
      const chosen = models.filter((m) => selected.has(m.model_id));
      // Also keep any free-form keys not in catalog
      for (const key of selected) {
        if (String(key).includes('|||')) {
          const [brand, model] = String(key).split('|||');
          if (!chosen.some((c) => c.brand === brand && c.model === model)) {
            chosen.push({ brand, model });
          }
        }
      }
      const res = await compatibilityService.setProductCompatibleModels(productId, chosen);
      if (!res.success) {
        onToast?.(res.error || 'Could not save compatibility');
        return;
      }
      onToast?.(`Compatibility saved (${chosen.length} model${chosen.length === 1 ? '' : 's'})`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.wrap, style]}>
        <ActivityIndicator color="#0C6258" />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>Compatible Motorcycles</Text>
      <Text style={styles.sub}>
        Select one or more models this part fits. Leave empty if fitment is unknown.
      </Text>

      <View style={styles.addForm}>
        <TextInput
          style={[styles.addInput, styles.addBrand]}
          value={newBrand}
          onChangeText={setNewBrand}
          placeholder="Brand"
          placeholderTextColor="#94A3B8"
        />
        <TextInput
          style={[styles.addInput, styles.addModel]}
          value={newModel}
          onChangeText={setNewModel}
          placeholder="Model (e.g. Click 125)"
          placeholderTextColor="#94A3B8"
          onSubmitEditing={addModel}
        />
        <TouchableOpacity
          style={[styles.addBtn, adding && styles.addBtnDisabled]}
          onPress={addModel}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.addBtnText}>+ Add</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search brand or model…"
        placeholderTextColor="#94A3B8"
      />
      <ScrollView style={styles.list} nestedScrollEnabled>
        {filtered.map((m) => {
          const on = selected.has(m.model_id);
          return (
            <TouchableOpacity
              key={m.model_id}
              style={[styles.row, on && styles.rowOn]}
              onPress={() => toggle(m.model_id)}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name={on ? 'check-square-fill' : 'square'}
                size={16}
                color={on ? '#0C6258' : '#94A3B8'}
              />
              <Text style={[styles.rowText, on && styles.rowTextOn]}>
                {m.brand} — {m.model}
              </Text>
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 && (
          <Text style={styles.empty}>
            No models match. Use + Add above to create a new brand and model.
          </Text>
        )}
      </ScrollView>
      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving || !productId}>
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.saveText}>
            {productId ? 'Save Compatibility' : 'Save product first'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 12,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 8 },
  addForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  addInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    color: '#0F172A',
    fontSize: 13,
  },
  addBrand: { flexGrow: 1, flexBasis: 90, minWidth: 90 },
  addModel: { flexGrow: 2, flexBasis: 140, minWidth: 120 },
  addBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.7 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  search: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    color: '#0F172A',
    marginBottom: 8,
  },
  list: { maxHeight: 220 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  rowOn: { backgroundColor: '#E6F8F5' },
  rowText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  rowTextOn: { color: '#0C6258' },
  empty: { fontSize: 12, color: '#94A3B8', padding: 8 },
  saveBtn: {
    marginTop: 10,
    backgroundColor: '#0C6258',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
