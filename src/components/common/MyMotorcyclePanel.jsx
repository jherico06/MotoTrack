/**
 * Customer "My Motorcycle" — brand + model only, multi-bike, set active.
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
  Modal,
  Platform,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import { compatibilityService } from '../../services/products/compatibilityService.js';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function MyMotorcyclePanel({
  currentUser,
  onToast,
  onActiveChange,
  style,
  compact = false,
}) {
  const { isDarkMode } = useTheme();
  const isDark = Platform.OS === 'web' && isDarkMode;
  const userId = currentUser?.id || currentUser?.user_id || currentUser?.customer_id;
  const [bikes, setBikes] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);

  const brands = useMemo(() => {
    const set = new Set((models || []).map((m) => m.brand));
    return [...set].sort();
  }, [models]);

  const modelsForBrand = useMemo(() => {
    if (!brand) return [];
    return (models || []).filter((m) => m.brand === brand);
  }, [models, brand]);

  const active = useMemo(
    () => bikes.find((b) => b.is_primary) || bikes[0] || null,
    [bikes]
  );

  const refresh = async () => {
    if (!userId) {
      setBikes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, catalog] = await Promise.all([
        compatibilityService.listCustomerMotorcycles(userId),
        compatibilityService.getMotorcycleModels({ activeOnly: true }),
      ]);
      setBikes(list || []);
      setModels(catalog || []);
      const primary = (list || []).find((b) => b.is_primary) || list?.[0] || null;
      onActiveChange?.(primary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await compatibilityService.addSimpleMotorcycle({
        userId,
        customerId: currentUser?.customer_id || userId,
        customerEmail: currentUser?.email,
        brand,
        model,
        nickname,
        setActive: true,
      });
      if (!res.success) {
        onToast?.(res.error || 'Could not save motorcycle');
        return;
      }
      onToast?.(
        res.warning
          ? `Saved locally (${res.warning})`
          : `${brand} ${model} set as your active motorcycle`
      );
      setModalOpen(false);
      setBrand('');
      setModel('');
      setNickname('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (bike) => {
    setBusy(true);
    try {
      await compatibilityService.setActiveMotorcycle(bike.motorcycle_id, userId);
      onToast?.(`${bike.brand} ${bike.model} is now active`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!userId) {
    return (
      <View style={[styles.wrap, isDark && styles.wrapDark, style]}>
        <Text style={[styles.title, isDark && styles.titleDark]}>My Motorcycle</Text>
        <Text style={[styles.sub, isDark && styles.subDark]}>Sign in to save your motorcycle and check part compatibility.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, isDark && styles.wrapDark, compact && styles.wrapCompact, style]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, isDark && styles.titleDark]}>My Motorcycle</Text>
          <Text style={[styles.sub, isDark && styles.subDark]}>
            {active
              ? `Active: ${active.brand} ${active.model}`
              : 'Select your motorcycle to check part compatibility.'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, isDark && styles.addBtnDark]} onPress={() => setModalOpen(true)}>
          <BootstrapIcon name="plus-lg" size={14} color="#FFF" />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={isDark ? '#FF5A00' : '#0C6258'} />
      ) : (
        <View style={styles.list}>
          {bikes.map((b) => {
            const isActive = Boolean(b.is_primary) || active?.motorcycle_id === b.motorcycle_id;
            return (
              <TouchableOpacity
                key={b.motorcycle_id}
                style={[
                  styles.bikeRow,
                  isDark && styles.bikeRowDark,
                  isActive && (isDark ? styles.bikeRowActiveDark : styles.bikeRowActive),
                ]}
                onPress={() => setActive(b)}
                disabled={busy}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bikeTitle, isDark && styles.bikeTitleDark]}>
                    {b.brand} {b.model}
                    {isActive ? ' — Default' : ''}
                  </Text>
                  {b.nickname ? <Text style={[styles.bikeNick, isDark && styles.bikeNickDark]}>{b.nickname}</Text> : null}
                </View>
                {isActive ? (
                  <BootstrapIcon name="check-circle-fill" size={16} color={isDark ? '#FF5A00' : '#0C6258'} />
                ) : (
                  <Text style={[styles.setActive, isDark && styles.setActiveDark]}>Set active</Text>
                )}
              </TouchableOpacity>
            );
          })}
          {bikes.length === 0 && (
            <TouchableOpacity style={[styles.emptyCta, isDark && styles.emptyCtaDark]} onPress={() => setModalOpen(true)}>
              <Text style={styles.emptyCtaText}>Add My Motorcycle</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={[styles.modalBackdrop, isDark && styles.modalBackdropDark]}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>Add My Motorcycle</Text>
            <Text style={[styles.sub, isDark && styles.subDark]}>Brand and model only — no year, VIN, or engine details needed.</Text>

            <Text style={[styles.label, isDark && styles.labelDark]}>Brand</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {brands.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[
                    styles.chip,
                    isDark && styles.chipDark,
                    brand === b && (isDark ? styles.chipOnDark : styles.chipOn),
                  ]}
                  onPress={() => {
                    setBrand(b);
                    setModel('');
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isDark && styles.chipTextDark,
                      brand === b && styles.chipTextOn,
                    ]}
                  >
                    {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, isDark && styles.labelDark]}>Model</Text>
            <ScrollView style={{ maxHeight: 160, marginBottom: 10 }}>
              {modelsForBrand.map((m) => (
                <TouchableOpacity
                  key={m.model_id}
                  style={[
                    styles.modelRow,
                    model === m.model && (isDark ? styles.modelRowOnDark : styles.modelRowOn),
                  ]}
                  onPress={() => setModel(m.model)}
                >
                  <Text
                    style={[
                      styles.modelText,
                      isDark && styles.modelTextDark,
                      model === m.model && (isDark ? styles.modelTextOnDark : styles.modelTextOn),
                    ]}
                  >
                    {m.model}
                  </Text>
                </TouchableOpacity>
              ))}
              {brand && modelsForBrand.length === 0 && (
                <Text style={[styles.sub, isDark && styles.subDark]}>No models for this brand yet.</Text>
              )}
            </ScrollView>

            <Text style={[styles.label, isDark && styles.labelDark]}>Nickname (optional)</Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g. My Click"
              placeholderTextColor={isDark ? '#71717A' : '#94A3B8'}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, isDark && styles.cancelBtnDark]} onPress={() => setModalOpen(false)}>
                <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isDark && styles.saveBtnDark, (!brand || !model) && { opacity: 0.5 }]}
                onPress={save}
                disabled={busy || !brand || !model}
              >
                {busy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveText}>Save & Set Active</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  wrapCompact: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C6258',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  list: { gap: 6 },
  bikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  bikeRowActive: { borderColor: '#0C6258', backgroundColor: '#E6F8F5' },
  bikeTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  bikeNick: { fontSize: 11, color: '#64748B', marginTop: 2 },
  setActive: { fontSize: 11, fontWeight: '700', color: '#0C6258' },
  emptyCta: {
    backgroundColor: '#0C6258',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyCtaText: { color: '#FFF', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#0C6258' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipTextOn: { color: '#FFF' },
  modelRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  modelRowOn: { backgroundColor: '#E6F8F5' },
  modelText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  modelTextOn: { color: '#0C6258' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontWeight: '700', color: '#64748B' },
  saveBtn: {
    flex: 1.4,
    backgroundColor: '#0C6258',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { color: '#FFF', fontWeight: '700' },
  wrapDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  titleDark: { color: '#F5F5F5' },
  subDark: { color: '#A1A1AA' },
  addBtnDark: { backgroundColor: '#FF5A00' },
  bikeRowDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  bikeRowActiveDark: {
    backgroundColor: '#3A241B',
    borderColor: '#8A3D19',
  },
  bikeTitleDark: { color: '#F2F2F3' },
  bikeNickDark: { color: '#A1A1AA' },
  setActiveDark: { color: '#FF5A00' },
  emptyCtaDark: { backgroundColor: '#FF5A00' },
  modalBackdropDark: { backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  modalCardDark: {
    backgroundColor: '#191A1D',
    borderWidth: 1,
    borderColor: '#303236',
  },
  modalTitleDark: { color: '#F5F5F5' },
  labelDark: { color: '#A1A1AA' },
  chipDark: {
    backgroundColor: '#202124',
    borderWidth: 1,
    borderColor: '#303236',
  },
  chipOnDark: {
    backgroundColor: '#FF5A00',
    borderColor: '#FF5A00',
  },
  chipTextDark: { color: '#A1A1AA' },
  modelRowOnDark: {
    backgroundColor: '#3A241B',
    borderWidth: 1,
    borderColor: '#8A3D19',
  },
  modelTextDark: { color: '#F2F2F3' },
  modelTextOnDark: { color: '#FF5A00' },
  inputDark: {
    backgroundColor: '#202124',
    borderColor: '#3A3B40',
    color: '#F2F2F3',
  },
  cancelBtnDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  cancelTextDark: { color: '#F2F2F3' },
  saveBtnDark: { backgroundColor: '#FF5A00' },
});
