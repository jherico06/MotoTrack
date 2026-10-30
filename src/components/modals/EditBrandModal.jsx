import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';
import { auditLogService } from '../../services/system/auditLogService.js';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';

/**
 * EditBrandModal
 *
 * Dedicated modal to customize the system name, brand tagline, and custom logo/emblem.
 * Features live side-by-side preview in both Light and Dark backgrounds.
 */
export default function EditBrandModal({
  visible = false,
  onClose = () => {},
  isDarkMode = false,
  showToast = () => {},
}) {
  const [storeName, setStoreName] = useState('MotoTrack');
  const [storeTagline, setStoreTagline] = useState('');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever modal opens
  useEffect(() => {
    if (visible) {
      const current = systemSettingsService.getSettings();
      setStoreName(current.storeName || 'MotoTrack');
      setStoreTagline(current.storeTagline || '');
      setStoreLogoUrl(current.storeLogoUrl || '');
    }
  }, [visible]);

  const handlePickLogo = async () => {
    try {
      const res = await pickImageFromFile();
      if (res.success && res.uri) {
        setStoreLogoUrl(res.uri);
        showToast('✓ Logo uploaded successfully! Live preview updated.');
      } else if (res.error && !res.error.includes('cancelled')) {
        showToast('⚠️ ' + res.error);
      }
    } catch (err) {
      showToast('⚠️ Failed to select logo: ' + err.message);
    }
  };

  const handleResetToDefaultLogo = () => {
    setStoreLogoUrl('');
    showToast('✓ Restored default MotoTrack emblem.');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const trimmedName = storeName.trim() || 'MotoTrack';
      const trimmedTagline = (storeTagline || '').trim();

      const res = await systemSettingsService.saveSettings({
        storeName: trimmedName,
        storeTagline: trimmedTagline,
        storeLogoUrl: storeLogoUrl.trim(),
      });

      if (res.success) {
        try {
          auditLogService.logSystemAction({
            action: 'BRAND_IDENTITY_UPDATED',
            target: 'System Brand & Logo',
            details: `Admin updated system name to "${trimmedName}" and configured brand assets`,
            severity: 'INFO',
          });
        } catch (_e) {}

        showToast('✓ System name & logo updated successfully!');
        onClose();
      } else {
        showToast('⚠️ Failed to save: ' + res.error);
      }
    } catch (err) {
      showToast('⚠️ Error saving brand: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          zIndex: 99999,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 620,
            maxHeight: '92%',
            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 22,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0',
              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? '#132A26' : '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="palette" size={20} color="#EA580C" />
              </View>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                  Edit System Name & Logo
                </Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                  Customize application title, tagline, and brand logo mark.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#F8FAFC' : '#475569'} />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 22, gap: 18 }}
            showsVerticalScrollIndicator={true}
          >
            {/* Field 1: System / Store Name */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDarkMode ? '#94A3B8' : '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                System Name / Store Title
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 15,
                  fontWeight: '700',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                }}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="e.g. MotoTrack"
                placeholderTextColor="#94A3B8"
              />
              <Text style={{ fontSize: 11, color: isDarkMode ? '#64748B' : '#94A3B8' }}>
                Main title displayed on top navigation, sidebar, invoices, and browser tab.
              </Text>
            </View>

            {/* Field 2: Tagline / Subtitle */}
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDarkMode ? '#94A3B8' : '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Brand Subtitle / Tagline
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 14,
                  fontWeight: '600',
                  color: isDarkMode ? '#F8FAFC' : '#0F172A',
                }}
                value={storeTagline}
                onChangeText={setStoreTagline}
                placeholder="e.g. MOTORPARTS & ACCESSORIES (or leave blank for none)"
                placeholderTextColor="#94A3B8"
              />
              <Text style={{ fontSize: 11, color: isDarkMode ? '#64748B' : '#94A3B8' }}>
                Optional: Leave blank if your brand has no second name or subtitle.
              </Text>
            </View>

            {/* Field 3: Logo Upload / URL */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDarkMode ? '#94A3B8' : '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                System Logo & Emblem Asset
              </Text>

              <View
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderWidth: 1.5,
                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {storeLogoUrl ? (
                  <Image
                    source={{ uri: storeLogoUrl }}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? '#132A26' : '#FFF7ED',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#EA580C' : '#A7F3D0',
                    }}
                  >
                    <Image
                      source={require('../../../assets/emblem.png')}
                      style={{ width: 44, height: 44, resizeMode: 'contain' }}
                    />
                  </View>
                )}

                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                    {storeLogoUrl ? 'Custom Logo Asset Active' : 'Default MotoTrack Emblem Active'}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                    {storeLogoUrl
                      ? 'Custom image uploaded from your device or link.'
                      : 'Standard red helmet & speed stripes emblem.'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={handlePickLogo}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: '#EA580C',
                        cursor: 'pointer',
                      }}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="cloud-arrow-up-fill" size={14} color="#FFFFFF" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                        Upload Logo File
                      </Text>
                    </TouchableOpacity>

                    {storeLogoUrl ? (
                      <TouchableOpacity
                        onPress={handleResetToDefaultLogo}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#334155' : '#FEE2E2',
                          cursor: 'pointer',
                        }}
                        activeOpacity={0.85}
                      >
                        <BootstrapIcon name="trash" size={13} color="#EF4444" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>
                          Restore Default
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Direct Image URL input */}
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                  Or enter direct Image URL:
                </Text>
                <TextInput
                  style={{
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 12.5,
                    color: isDarkMode ? '#F8FAFC' : '#0F172A',
                  }}
                  value={storeLogoUrl}
                  onChangeText={setStoreLogoUrl}
                  placeholder="https://example.com/logo.png"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 22,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: isDarkMode ? '#334155' : '#E2E8F0',
              backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                cursor: 'pointer',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#475569' }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 22,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: '#EA580C',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.28)',
                cursor: 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="check-lg" size={15} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
                {isSaving ? 'Saving...' : 'Save Brand Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
