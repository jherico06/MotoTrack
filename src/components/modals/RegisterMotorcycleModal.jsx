import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import {
  MOTORCYCLE_BRANDS,
  MOTORCYCLE_PHOTO_PRESETS,
} from '../../services/motorcycleService';
import { pickImageFromFile } from '../../utils/imagePickerHelper';

export default function RegisterMotorcycleModal({
  visible = false,
  motorcycle = null,
  isDarkMode = false,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(motorcycle && motorcycle.motorcycle_id);

  const [brand, setBrand] = useState('Yamaha');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [engineCc, setEngineCc] = useState('155');
  const [color, setColor] = useState('');
  const [odometer, setOdometer] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (motorcycle) {
      setBrand(motorcycle.brand || 'Yamaha');
      setModel(motorcycle.model || '');
      setPlateNumber(motorcycle.plate_number || '');
      setYear(motorcycle.year ? String(motorcycle.year) : String(new Date().getFullYear()));
      setEngineCc(motorcycle.engine_cc ? String(motorcycle.engine_cc) : '155');
      setColor(motorcycle.color || '');
      setOdometer(motorcycle.odometer || '');
      setNickname(motorcycle.nickname || '');
      setPhotoUrl(motorcycle.photo_url || '');
      setIsPrimary(Boolean(motorcycle.is_primary));
      setNotes(motorcycle.notes || '');
    } else {
      setBrand('Yamaha');
      setModel('');
      setPlateNumber('');
      setYear(String(new Date().getFullYear()));
      setEngineCc('155');
      setColor('');
      setOdometer('');
      setNickname('');
      setPhotoUrl('');
      setIsPrimary(false);
      setNotes('');
    }
    setErrorMessage('');
  }, [motorcycle, visible]);

  if (!visible) return null;

  const bgModal = isDarkMode ? '#0F172A' : '#FFFFFF';
  const bgInput = isDarkMode ? '#1E293B' : '#F8FAFC';
  const borderCol = isDarkMode ? '#334155' : '#E2E8F0';
  const textMain = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';

  const defaultPhotoForBrand = (brandName) => {
    const preset = MOTORCYCLE_PHOTO_PRESETS.find(
      (p) => p.brand.toLowerCase() === String(brandName || '').toLowerCase()
    );
    return preset?.url || MOTORCYCLE_PHOTO_PRESETS[0]?.url || '';
  };

  const handleUploadPhoto = async () => {
    setErrorMessage('');
    setIsUploadingPhoto(true);
    try {
      const res = await pickImageFromFile();
      if (res?.success && res.uri) {
        setPhotoUrl(res.uri);
      } else if (res?.error && res.error !== 'Selection cancelled' && res.error !== 'No file selected') {
        setErrorMessage(res.error);
      }
    } catch (e) {
      setErrorMessage(e?.message || 'Could not upload photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
  };

  const handleFormSubmit = async () => {
    if (!model.trim()) {
      setErrorMessage('Please enter the motorcycle model.');
      return;
    }
    if (!plateNumber.trim()) {
      setErrorMessage('Please enter the plate or MV file number.');
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    try {
      const payload = {
        brand: brand.trim(),
        model: model.trim(),
        plate_number: plateNumber.trim().toUpperCase(),
        year: parseInt(year, 10) || new Date().getFullYear(),
        engine_cc: parseInt(engineCc, 10) || 150,
        color: color.trim() || 'Standard',
        odometer: odometer.trim() || '0 km',
        nickname: nickname.trim() || `${brand} ${model.trim()}`,
        vin_number: '',
        photo_url: photoUrl.trim() || defaultPhotoForBrand(brand),
        is_primary: isPrimary,
        notes: notes.trim(),
      };

      if (isEditing) {
        payload.motorcycle_id = motorcycle.motorcycle_id;
      }

      await onSave(payload);
      onClose();
    } catch (e) {
      setErrorMessage(e.message || 'Failed to save motorcycle.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.card, { backgroundColor: bgModal, borderColor: borderCol }]}>
          <View style={styles.accentBar} />

          <View style={[styles.header, { borderBottomColor: borderCol }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.iconCircle}>
                <BootstrapIcon name="bicycle" size={18} color="#1D4533" />
              </View>
              <Text style={[styles.title, { color: textMain }]}>
                {isEditing ? 'Edit Motorcycle' : 'Register Motorcycle'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: bgInput }]}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="x-lg" size={16} color={textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={true}
          >
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <BootstrapIcon name="exclamation-triangle-fill" size={14} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Photo upload */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: textMain }]}>Photo</Text>
              <View style={styles.photoBlock}>
                <TouchableOpacity
                  style={[styles.photoDrop, { borderColor: borderCol, backgroundColor: bgInput }]}
                  onPress={handleUploadPhoto}
                  activeOpacity={0.85}
                  disabled={isUploadingPhoto}
                >
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoEmpty}>
                      {isUploadingPhoto ? (
                        <ActivityIndicator color="#1D4533" />
                      ) : (
                        <>
                          <BootstrapIcon name="cloud-upload" size={28} color="#1D4533" />
                          <Text style={[styles.photoEmptyTitle, { color: textMain }]}>
                            Upload photo
                          </Text>
                          <Text style={[styles.photoEmptyHint, { color: textMuted }]}>
                            Tap to choose from your device
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handleUploadPhoto}
                    disabled={isUploadingPhoto}
                    activeOpacity={0.85}
                  >
                    {isUploadingPhoto ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon name="camera-fill" size={14} color="#FFFFFF" />
                        <Text style={styles.uploadBtnText}>
                          {photoUrl ? 'Change photo' : 'Choose photo'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {photoUrl ? (
                    <TouchableOpacity
                      style={[styles.removeBtn, { borderColor: borderCol }]}
                      onPress={handleRemovePhoto}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.removeBtnText, { color: textMuted }]}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Brand — single selector */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: textMain }]}>Brand *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.brandRow}
              >
                {MOTORCYCLE_BRANDS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.brandPill,
                      { borderColor: borderCol, backgroundColor: bgInput },
                      brand === b && styles.brandPillActive,
                    ]}
                    onPress={() => setBrand(b)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.brandPillText,
                        { color: textMain },
                        brand === b && styles.brandPillTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Core details */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: textMain }]}>Details</Text>
              <View style={styles.grid}>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Model *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                    placeholder="e.g. Click 160"
                    placeholderTextColor={textMuted}
                    value={model}
                    onChangeText={setModel}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Nickname</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                    placeholder="Optional"
                    placeholderTextColor={textMuted}
                    value={nickname}
                    onChangeText={setNickname}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Plate / MV No. *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: bgInput,
                        borderColor: borderCol,
                        color: textMain,
                        fontWeight: '700',
                        letterSpacing: 0.6,
                      },
                    ]}
                    placeholder="ABC-1234"
                    placeholderTextColor={textMuted}
                    value={plateNumber}
                    onChangeText={setPlateNumber}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.fieldThird}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Year</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                    placeholder="2025"
                    placeholderTextColor={textMuted}
                    value={year}
                    onChangeText={setYear}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.fieldThird}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Engine (cc)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                    placeholder="160"
                    placeholderTextColor={textMuted}
                    value={engineCc}
                    onChangeText={setEngineCc}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Color</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                    placeholder="e.g. Matte Gray"
                    placeholderTextColor={textMuted}
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldHint, { color: textMuted }]}>Odometer</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                    placeholder="e.g. 2,800 km"
                    placeholderTextColor={textMuted}
                    value={odometer}
                    onChangeText={setOdometer}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryToggle,
                {
                  backgroundColor: isPrimary ? (isDarkMode ? '#064E3B' : '#ECFDF5') : bgInput,
                  borderColor: isPrimary ? '#10B981' : borderCol,
                },
              ]}
              onPress={() => setIsPrimary((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  isPrimary && { backgroundColor: '#10B981', borderColor: '#10B981' },
                ]}
              >
                {isPrimary ? <BootstrapIcon name="check" size={12} color="#FFFFFF" /> : null}
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isPrimary ? (isDarkMode ? '#A7F3D0' : '#065F46') : textMain,
                }}
              >
                Set as primary motorcycle
              </Text>
            </TouchableOpacity>

            <View style={styles.section}>
              <Text style={[styles.label, { color: textMain }]}>Notes</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: bgInput, borderColor: borderCol, color: textMain },
                ]}
                placeholder="Optional notes or mods"
                placeholderTextColor={textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: borderCol }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: borderCol }]}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: textMuted }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={handleFormSubmit}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <BootstrapIcon
                    name={isEditing ? 'check-circle-fill' : 'plus-circle-fill'}
                    size={15}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveBtnText}>
                    {isEditing ? 'Save changes' : 'Register'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      web: { backdropFilter: 'blur(6px)' },
    }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  accentBar: {
    height: 4,
    width: '100%',
    backgroundColor: '#1D4533',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#C8DDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    gap: 16,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  fieldHint: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  photoBlock: {
    gap: 10,
  },
  photoDrop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 160,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  photoEmpty: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  photoEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  photoEmptyHint: {
    fontSize: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  uploadBtn: {
    backgroundColor: '#1D4533',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  removeBtn: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  removeBtnText: {
    fontWeight: '700',
    fontSize: 12.5,
  },
  brandRow: {
    gap: 8,
    paddingVertical: 2,
  },
  brandPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  brandPillActive: {
    backgroundColor: '#1D4533',
    borderColor: '#1D4533',
  },
  brandPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  brandPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldHalf: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
  },
  fieldThird: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryToggle: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#1D4533',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
