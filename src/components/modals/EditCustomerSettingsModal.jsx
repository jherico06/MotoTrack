import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';

const ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu', city: 'City of Naga' },
  { label: 'East Poblacion, Naga', address: 'MotoTrack Hub, East Poblacion, City of Naga, Cebu', city: 'City of Naga' },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu', city: 'City of Naga' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu', city: 'Minglanilla' },
  { label: 'Toledo Junction', address: 'Toledo-Naga Access Road, Uling, City of Naga, Cebu', city: 'City of Naga' },
];

export default function EditCustomerSettingsModal({
  visible,
  currentUser,
  onClose,
  onSave,
  isDarkMode = false,
  showToast = () => {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isSmall = windowWidth < 600;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('City of Naga');
  const [country, setCountry] = useState('Philippines');
  const [bio, setBio] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state when modal becomes visible
  useEffect(() => {
    if (visible && currentUser) {
      const uName = currentUser.name || currentUser.fullName || '';
      const parts = uName.trim().split(' ');
      setFirstName(currentUser.firstName || parts[0] || '');
      setLastName(currentUser.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : ''));
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
      setCity(currentUser.city || 'City of Naga');
      setCountry(currentUser.country || 'Philippines');
      setBio(currentUser.bio || 'Motorcycle Enthusiast & Customer');
      setDeliveryNotes(currentUser.deliveryNotes || 'Leave at front gate / contact on delivery');
      setErrorMsg('');
      setIsSaving(false);
    }
  }, [visible, currentUser]);

  const handleApplyPreset = (preset) => {
    setAddress(preset.address);
    if (preset.city) setCity(preset.city);
  };

  const handleSave = async () => {
    const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!combinedName) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('Please enter a delivery address.');
      return;
    }

    setErrorMsg('');
    setIsSaving(true);

    try {
      const payload = {
        name: combinedName,
        fullName: combinedName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim() || 'City of Naga',
        country: country.trim() || 'Philippines',
        bio: bio.trim() || 'Motorcycle Enthusiast & Customer',
        deliveryNotes: deliveryNotes.trim(),
      };

      if (typeof onSave === 'function') {
        const res = await onSave(payload);
        if (res === false || (res && res.success === false)) {
          setErrorMsg(res?.error || 'Failed to save changes. Please try again.');
          setIsSaving(false);
          return;
        }
      }
      showToast('✓ Customer settings updated successfully!');
      onClose();
    } catch (err) {
      console.error('Error saving customer settings:', err);
      setErrorMsg(err?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  const bgModal = isDarkMode ? '#141A18' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDarkMode ? '#94A3B8' : '#475569';
  const inputBg = isDarkMode ? '#1C2422' : '#F8FAFC';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: bgModal,
            width: '100%',
            maxWidth: 640,
            maxHeight: '90%',
            borderRadius: 20,
            borderWidth: 1,
            borderColor,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
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
              borderBottomColor: borderColor,
              backgroundColor: isDarkMode ? '#18211E' : '#FAFAFA',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(29, 69, 51, 0.35)' : '#E8F0EC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(29, 69, 51, 0.5)' : '#C8DDD3',
                }}
              >
                <BootstrapIcon name="gear-fill" size={17} color="#1D4533" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textPrimary, letterSpacing: -0.2 }}>
                  Edit Customer Settings
                </Text>
                <Text style={{ fontSize: 12, color: textSecondary, marginTop: 1 }}>
                  Update your contact details, delivery address, and notes
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDarkMode ? '#1C2422' : '#F1F5F9',
                borderWidth: 1,
                borderColor,
              }}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="x-lg" size={13} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView
            style={{ padding: 22 }}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ gap: 16, paddingBottom: 10 }}
          >
            {errorMsg ? (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <BootstrapIcon name="exclamation-circle-fill" size={15} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontSize: 12.5, fontWeight: '600', flex: 1 }}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* Read-Only Account Email Notice */}
            <View
              style={{
                backgroundColor: isDarkMode ? '#1C2422' : '#F8FAFC',
                borderWidth: 1,
                borderColor,
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <BootstrapIcon name="envelope-fill" size={16} color="#1D4533" />
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Account Login Email
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary, marginTop: 1 }}>
                    {currentUser?.email || 'N/A'}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: '#DCFCE7',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#86EFAC',
                }}
              >
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#166534' }}>
                  Verified
                </Text>
              </View>
            </View>

            {/* Name Fields (2 Columns on Desktop) */}
            <View style={{ flexDirection: isSmall ? 'column' : 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                  First Name <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: textPrimary,
                    fontSize: 13,
                    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                  }}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="e.g. Jherico"
                  placeholderTextColor={textSecondary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                  Last Name
                </Text>
                <TextInput
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: textPrimary,
                    fontSize: 13,
                    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                  }}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="e.g. Maurin"
                  placeholderTextColor={textSecondary}
                />
              </View>
            </View>

            {/* Phone Number */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                Contact Phone Number
              </Text>
              <TextInput
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: textPrimary,
                  fontSize: 13,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                }}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 0917 123 4567 or +63 917 123 4567"
                placeholderTextColor={textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            {/* Delivery Address */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary }}>
                  Primary Delivery Address <Text style={{ color: '#DC2626' }}>*</Text>
                </Text>
                <Text style={{ fontSize: 11, color: textSecondary }}>
                  City of Naga & Cebu Hubs
                </Text>
              </View>

              {/* Quick Preset Chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {ADDRESS_PRESETS.map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleApplyPreset(p)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 16,
                      backgroundColor: address === p.address ? '#1D4533' : (isDarkMode ? '#1C2422' : '#F1F5F9'),
                      borderWidth: 1,
                      borderColor: address === p.address ? '#1D4533' : borderColor,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: address === p.address ? '#FFFFFF' : textSecondary,
                      }}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: textPrimary,
                  fontSize: 13,
                  minHeight: 52,
                  textAlignVertical: 'top',
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                }}
                value={address}
                onChangeText={setAddress}
                placeholder="House / Unit No., Street, Barangay, City, Province"
                placeholderTextColor={textSecondary}
                multiline
              />
            </View>

            {/* City & Country (2 Columns on Desktop) */}
            <View style={{ flexDirection: isSmall ? 'column' : 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                  City / Municipality
                </Text>
                <TextInput
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: textPrimary,
                    fontSize: 13,
                    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                  }}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City of Naga"
                  placeholderTextColor={textSecondary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                  Country
                </Text>
                <TextInput
                  style={{
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: textPrimary,
                    fontSize: 13,
                    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                  }}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="Philippines"
                  placeholderTextColor={textSecondary}
                />
              </View>
            </View>

            {/* Bio / Headline */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                Rider Bio / Headline
              </Text>
              <TextInput
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: textPrimary,
                  fontSize: 13,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                }}
                value={bio}
                onChangeText={setBio}
                placeholder="e.g. Trackday Enthusiast & Sunday Rider"
                placeholderTextColor={textSecondary}
              />
            </View>

            {/* Delivery Notes */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: textPrimary, marginBottom: 6 }}>
                Delivery Instructions & Notes for Courier
              </Text>
              <TextInput
                style={{
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: textPrimary,
                  fontSize: 13,
                  minHeight: 46,
                  textAlignVertical: 'top',
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                }}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                placeholder="e.g. Leave at front guardhouse / Call on arrival"
                placeholderTextColor={textSecondary}
                multiline
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              paddingHorizontal: 22,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              backgroundColor: isDarkMode ? '#18211E' : '#FAFAFA',
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isSaving}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#1C2422' : '#FFFFFF',
                borderWidth: 1,
                borderColor,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: textSecondary }}>
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
                paddingHorizontal: 20,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: '#1D4533',
                opacity: isSaving ? 0.7 : 1,
              }}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <BootstrapIcon name="check-lg" size={14} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                    Save Changes
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
