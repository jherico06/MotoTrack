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

export default function RegisterMotorcycleModal({
  visible = false,
  motorcycle = null, // null for add, object for edit
  isDarkMode = false,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(motorcycle && motorcycle.motorcycle_id);

  // Form Fields
  const [brand, setBrand] = useState('Yamaha');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [engineCc, setEngineCc] = useState('155');
  const [color, setColor] = useState('');
  const [odometer, setOdometer] = useState('');
  const [nickname, setNickname] = useState('');
  const [vinNumber, setVinNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset or pre-fill form
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
      setVinNumber(motorcycle.vin_number || '');
      setPhotoUrl(motorcycle.photo_url || '');
      setIsPrimary(Boolean(motorcycle.is_primary));
      setNotes(motorcycle.notes || '');
    } else {
      setBrand('Yamaha');
      setModel('');
      setPlateNumber('');
      setYear(String(new Date().getFullYear()));
      setEngineCc('155');
      setColor('Matte Black');
      setOdometer('0 km');
      setNickname('');
      setVinNumber('');
      setPhotoUrl(MOTORCYCLE_PHOTO_PRESETS[0]?.url || '');
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

  const handleSelectPresetPhoto = (preset) => {
    setPhotoUrl(preset.url);
    if (!brand || brand === 'Yamaha') {
      setBrand(preset.brand);
    }
  };

  const handleFormSubmit = async () => {
    if (!model.trim()) {
      setErrorMessage('Please enter the motorcycle model / variant.');
      return;
    }
    if (!plateNumber.trim()) {
      setErrorMessage('Please enter the motorcycle plate or registration number.');
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
        color: color.trim() || 'Standard Fairing',
        odometer: odometer.trim() || '0 km',
        nickname: nickname.trim() || `${brand} ${model.trim()}`,
        vin_number: vinNumber.trim(),
        photo_url: photoUrl.trim() || MOTORCYCLE_PHOTO_PRESETS[0]?.url,
        is_primary: isPrimary,
        notes: notes.trim(),
      };

      if (isEditing) {
        payload.motorcycle_id = motorcycle.motorcycle_id;
      }

      await onSave(payload);
      onClose();
    } catch (e) {
      setErrorMessage(e.message || 'Failed to save motorcycle details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[modalStyles.card, { backgroundColor: bgModal, borderColor: borderCol }]}>
          {/* Top Brand Accent Bar */}
          <View style={modalStyles.accentBar} />

          {/* Modal Header */}
          <View style={[modalStyles.header, { borderBottomColor: borderCol }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View style={modalStyles.iconCircle}>
                <BootstrapIcon name="tools" size={18} color="#0C6258" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[modalStyles.title, { color: textMain }]}>
                  {isEditing ? 'Edit Motorcycle Specs' : 'Register Motorcycle in My Garage'}
                </Text>
                <Text style={[modalStyles.subtitle, { color: textMuted }]}>
                  Keep your garage fleet up-to-date for fast pit bay bookings and PMS scheduling.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[modalStyles.closeBtn, { backgroundColor: bgInput }]}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="x-lg" size={16} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Form Content Scroll */}
          <ScrollView
            style={modalStyles.bodyScroll}
            contentContainerStyle={modalStyles.bodyContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Error Banner */}
            {errorMessage ? (
              <View style={modalStyles.errorBanner}>
                <BootstrapIcon name="exclamation-triangle-fill" size={14} color="#DC2626" />
                <Text style={modalStyles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Photo Preview & Presets */}
            <View style={modalStyles.fieldGroup}>
              <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                Motorcycle Photo & Appearance
              </Text>
              <View style={modalStyles.photoRow}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={modalStyles.photoPreview} />
                ) : (
                  <View style={[modalStyles.photoPreview, { backgroundColor: bgInput, justifyContent: 'center', alignItems: 'center' }]}>
                    <BootstrapIcon name="camera-fill" size={24} color={textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: textMuted, marginBottom: 6 }}>
                    Quick-pick styling preset or enter custom image URL below:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {MOTORCYCLE_PHOTO_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.id}
                        style={[
                          modalStyles.presetChip,
                          photoUrl === preset.url && modalStyles.presetChipActive,
                        ]}
                        onPress={() => handleSelectPresetPhoto(preset)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            modalStyles.presetChipText,
                            photoUrl === preset.url && modalStyles.presetChipTextActive,
                          ]}
                        >
                          {preset.brand}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Custom Image URL input */}
              <TextInput
                style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain, marginTop: 8 }]}
                placeholder="https://example.com/my-motorcycle.jpg (optional)"
                placeholderTextColor={textMuted}
                value={photoUrl}
                onChangeText={setPhotoUrl}
              />
            </View>

            {/* Brand Selection */}
            <View style={modalStyles.fieldGroup}>
              <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                Manufacturer / Brand *
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {MOTORCYCLE_BRANDS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      modalStyles.brandPill,
                      { borderColor: borderCol, backgroundColor: bgInput },
                      brand === b && modalStyles.brandPillActive,
                    ]}
                    onPress={() => setBrand(b)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        modalStyles.brandPillText,
                        { color: textMain },
                        brand === b && modalStyles.brandPillTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Model & Nickname Row */}
            <View style={modalStyles.twoColRow}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Model / Variant *
                </Text>
                <TextInput
                  style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                  placeholder="e.g. NMAX 155 Connected, Ninja ZX-6R"
                  placeholderTextColor={textMuted}
                  value={model}
                  onChangeText={setModel}
                />
              </View>

              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Garage Nickname (Optional)
                </Text>
                <TextInput
                  style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                  placeholder="e.g. Daily Commuter, Weekend Weapon"
                  placeholderTextColor={textMuted}
                  value={nickname}
                  onChangeText={setNickname}
                />
              </View>
            </View>

            {/* Plate Number & Year & Engine CC */}
            <View style={modalStyles.threeColRow}>
              <View style={{ flex: 1.2, minWidth: 140 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Plate / MV File No. *
                </Text>
                <TextInput
                  style={[
                    modalStyles.input,
                    {
                      backgroundColor: bgInput,
                      borderColor: borderCol,
                      color: textMain,
                      textTransform: 'uppercase',
                      fontWeight: '700',
                      letterSpacing: 1,
                    },
                  ]}
                  placeholder="NM-4892"
                  placeholderTextColor={textMuted}
                  value={plateNumber}
                  onChangeText={setPlateNumber}
                  autoCapitalize="characters"
                />
              </View>

              <View style={{ flex: 1, minWidth: 100 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Model Year
                </Text>
                <TextInput
                  style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                  placeholder="2024"
                  placeholderTextColor={textMuted}
                  value={year}
                  onChangeText={setYear}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ flex: 1, minWidth: 110 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Engine (CC)
                </Text>
                <TextInput
                  style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                  placeholder="e.g. 155"
                  placeholderTextColor={textMuted}
                  value={engineCc}
                  onChangeText={setEngineCc}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Color & Odometer */}
            <View style={modalStyles.twoColRow}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Color / Fairing Theme
                </Text>
                <TextInput
                  style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                  placeholder="e.g. Matte Dark Gray, KRT Lime Green"
                  placeholderTextColor={textMuted}
                  value={color}
                  onChangeText={setColor}
                />
              </View>

              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                  Current Odometer
                </Text>
                <TextInput
                  style={[modalStyles.input, { backgroundColor: bgInput, borderColor: borderCol, color: textMain }]}
                  placeholder="e.g. 12,400 km"
                  placeholderTextColor={textMuted}
                  value={odometer}
                  onChangeText={setOdometer}
                />
              </View>
            </View>

            {/* Primary Motorcycle Toggle */}
            <TouchableOpacity
              style={[
                modalStyles.primaryToggleBox,
                {
                  backgroundColor: isPrimary ? (isDarkMode ? '#064E3B' : '#ECFDF5') : bgInput,
                  borderColor: isPrimary ? '#10B981' : borderCol,
                },
              ]}
              onPress={() => setIsPrimary((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={[
                    modalStyles.checkboxBox,
                    isPrimary && { backgroundColor: '#10B981', borderColor: '#10B981' },
                  ]}
                >
                  {isPrimary && <BootstrapIcon name="check" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: isPrimary ? (isDarkMode ? '#A7F3D0' : '#065F46') : textMain,
                    }}
                  >
                    ★ Set as Primary Motorcycle
                  </Text>
                  <Text style={{ fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                    Auto-selects this motorcycle for quick pit bay reservations and part compatibility checks.
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Custom Notes / Tuning */}
            <View style={modalStyles.fieldGroup}>
              <Text style={[modalStyles.fieldLabel, { color: textMain }]}>
                Installed Modifications & Notes (Optional)
              </Text>
              <TextInput
                style={[
                  modalStyles.input,
                  modalStyles.textArea,
                  { backgroundColor: bgInput, borderColor: borderCol, color: textMain },
                ]}
                placeholder="e.g. Stage 1 CVT tuning, Akrapovič slip-on exhaust, Pirelli Diablo Rosso IV tires..."
                placeholderTextColor={textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline={true}
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Modal Footer */}
          <View style={[modalStyles.footer, { borderTopColor: borderCol }]}>
            <TouchableOpacity
              style={[modalStyles.cancelBtn, { borderColor: borderCol }]}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={[modalStyles.cancelBtnText, { color: textMuted }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[modalStyles.saveBtn, isSaving && { opacity: 0.7 }]}
              onPress={handleFormSubmit}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <BootstrapIcon name={isEditing ? 'check-circle-fill' : 'plus-circle-fill'} size={15} color="#FFFFFF" />
                  <Text style={modalStyles.saveBtnText}>
                    {isEditing ? 'Save Motorcycle Changes' : 'Register Motorcycle'}
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

const modalStyles = StyleSheet.create({
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
    maxWidth: 680,
    maxHeight: '92%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  accentBar: {
    height: 4,
    width: '100%',
    backgroundColor: '#0C6258',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#D1ECE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
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
    padding: 22,
    gap: 16,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  threeColRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  brandPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  brandPillActive: {
    backgroundColor: '#0C6258',
    borderColor: '#0C6258',
  },
  brandPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  brandPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoPreview: {
    width: 76,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  presetChipActive: {
    backgroundColor: '#0C6258',
  },
  presetChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  primaryToggleBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  checkboxBox: {
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
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#0C6258',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
