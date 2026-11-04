// =========================================================================
// MotoTrack - Admin Package & Inclusions Editor Modal
// Allows admins to edit package title, inclusions, duration, badge,
// image, and CC displacement tier prices directly.
// =========================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../../common';

export default function AdminPackageEditorModal({
  visible,
  pkg,
  onClose,
  onSave,
  onDelete,
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('PMS');
  const [duration, setDuration] = useState('45 mins');
  const [badge, setBadge] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [inclusionsText, setInclusionsText] = useState('');
  const [price125, setPrice125] = useState('');
  const [price150, setPrice150] = useState('');
  const [priceBig, setPriceBig] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (pkg) {
      setTitle(pkg.title || pkg.name || '');
      setCategory(
        String(pkg.category || '').toLowerCase().includes('repair')
          ? 'Repair'
          : 'PMS'
      );
      setDuration(pkg.duration || '45 mins');
      setBadge(pkg.badge || '');
      setImage(pkg.image || '');
      setDescription(pkg.description || pkg.shortDescription || '');

      let incs = [];
      if (Array.isArray(pkg.inclusions)) {
        incs = pkg.inclusions.filter(Boolean);
      } else if (typeof pkg.inclusions === 'string') {
        incs = pkg.inclusions.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
      }
      setInclusionsText(incs.join('\n'));

      const prices = pkg.prices || {};
      setPrice125(prices['cc-125-below'] != null ? String(prices['cc-125-below']) : '');
      setPrice150(prices['cc-150-160'] != null ? String(prices['cc-150-160']) : '');
      setPriceBig(prices['cc-big-bikes'] != null ? String(prices['cc-big-bikes']) : '');
    }
  }, [pkg]);

  if (!visible || !pkg) return null;

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      alert('Please enter a package title.');
      return;
    }

    const inclusions = inclusionsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const p125Num = price125.trim() ? Number(price125.replace(/[^\d.]/g, '')) : null;
    const p150Num = price150.trim() ? Number(price150.replace(/[^\d.]/g, '')) : null;
    const pBigNum = priceBig.trim() ? Number(priceBig.replace(/[^\d.]/g, '')) : null;

    const prices = {
      'cc-125-below': p125Num,
      'cc-150-160': p150Num,
      'cc-big-bikes': pBigNum,
    };

    const primaryPrice = p150Num || p125Num || pBigNum || 1500;

    setIsSaving(true);
    try {
      await onSave({
        id: pkg.id,
        title: cleanTitle,
        name: cleanTitle,
        category,
        duration: duration.trim() || '45 mins',
        badge: badge.trim(),
        image: image.trim(),
        description: description.trim(),
        subtitle: description.trim(),
        inclusions,
        prices,
        price: primaryPrice,
        pricePhp: primaryPrice,
      });
      onClose();
    } catch (e) {
      console.warn('Error saving package:', e);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={editorStyles.overlay}>
        <View style={editorStyles.sheet}>
          {/* Header */}
          <View style={editorStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={editorStyles.adminBadge}>
                <BootstrapIcon name="shield-lock-fill" size={13} color="#FFFFFF" />
                <Text style={editorStyles.adminBadgeText}>ADMIN EDIT</Text>
              </View>
              <Text style={editorStyles.modalTitle}>Edit Service Package</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={editorStyles.closeBtn} activeOpacity={0.7}>
              <BootstrapIcon name="x-lg" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Form Body */}
          <ScrollView style={editorStyles.body} showsVerticalScrollIndicator={false}>
            {/* Package Title */}
            <Text style={editorStyles.label}>Package Title *</Text>
            <TextInput
              style={editorStyles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Express Service"
              placeholderTextColor="#94A3B8"
            />

            {/* Category Selection */}
            <Text style={editorStyles.label}>Category</Text>
            <View style={editorStyles.categoryRow}>
              {['PMS', 'Repair'].map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      editorStyles.categoryPill,
                      isSelected && editorStyles.categoryPillActive,
                    ]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        editorStyles.categoryPillText,
                        isSelected && editorStyles.categoryPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Inclusions Field (Directly affects the card's checkmark list) */}
            <Text style={[editorStyles.label, { marginTop: 12 }]}>
              Package Inclusions (One per line) *
            </Text>
            <Text style={editorStyles.helperText}>
              These items appear with orange checkmarks on the package card.
            </Text>
            <TextInput
              style={[editorStyles.input, editorStyles.textArea, { minHeight: 96 }]}
              multiline
              numberOfLines={4}
              value={inclusionsText}
              onChangeText={setInclusionsText}
              placeholder={'Engine Oil Change\nBasic Motorcycle Inspection\nChain Adjustment'}
              placeholderTextColor="#94A3B8"
            />

            {/* Duration and Badge */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={editorStyles.label}>Duration</Text>
                <TextInput
                  style={editorStyles.input}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g. 30 mins, 90 mins"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editorStyles.label}>Badge Tag</Text>
                <TextInput
                  style={editorStyles.input}
                  value={badge}
                  onChangeText={setBadge}
                  placeholder="e.g. Most Popular"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Package Image URL */}
            <Text style={[editorStyles.label, { marginTop: 4 }]}>Package Image URL</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {image ? (
                <Image
                  source={{ uri: image }}
                  style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                  resizeMode="cover"
                />
              ) : null}
              <TextInput
                style={[editorStyles.input, { flex: 1, marginBottom: 0 }]}
                value={image}
                onChangeText={setImage}
                placeholder="https://images.unsplash.com/..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Description */}
            <Text style={[editorStyles.label, { marginTop: 12 }]}>Description</Text>
            <TextInput
              style={[editorStyles.input, editorStyles.textArea, { minHeight: 64 }]}
              multiline
              numberOfLines={2}
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description of this service package..."
              placeholderTextColor="#94A3B8"
            />

            {/* Displacement Tier Rates */}
            <Text style={[editorStyles.label, { marginTop: 12 }]}>Displacement Tier Rates (₱)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={editorStyles.subLabel}>125cc & below</Text>
                <TextInput
                  style={editorStyles.input}
                  keyboardType="numeric"
                  value={price125}
                  onChangeText={setPrice125}
                  placeholder="1200"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editorStyles.subLabel}>150cc–160cc</Text>
                <TextInput
                  style={editorStyles.input}
                  keyboardType="numeric"
                  value={price150}
                  onChangeText={setPrice150}
                  placeholder="1500"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editorStyles.subLabel}>Big Bikes (200cc+)</Text>
                <TextInput
                  style={editorStyles.input}
                  keyboardType="numeric"
                  value={priceBig}
                  onChangeText={setPriceBig}
                  placeholder="1750"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={editorStyles.footer}>
            {pkg?.id && typeof onDelete === 'function' && (
              <TouchableOpacity
                style={editorStyles.deleteBtn}
                onPress={() => {
                  if (confirm(`Are you sure you want to permanently delete package "${title || pkg.name}"?`)) {
                    onDelete(pkg.id);
                  }
                }}
                disabled={isSaving}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="trash3-fill" size={13} color="#DC2626" />
                <Text style={editorStyles.deleteBtnText}>Delete Package</Text>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={editorStyles.cancelBtn}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={editorStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={editorStyles.saveBtn}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="check-lg" size={14} color="#FFFFFF" />
              <Text style={editorStyles.saveBtnText}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const editorStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }
      : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EA580C',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flex: 1,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  textArea: {
    textAlignVertical: 'top',
    lineHeight: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  categoryPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  categoryPillActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    cursor: 'pointer',
  },
  deleteBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#DC2626',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EA580C',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

