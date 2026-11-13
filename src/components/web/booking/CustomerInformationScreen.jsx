import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  useWindowDimensions,
} from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';

/**
 * CustomerInformationScreen (Step 2 of Booking Workflow)
 *
 * 1. Primary Motorcycle Confirmation (Auto-selected based on user's fleet settings).
 * 2. Customer Contact Information (First Name, Last Name, Mobile Number, Email, Social Media).
 * 3. Specific Symptoms, Concerns or Notes (with quick-select issue tags and photo uploads).
 */
export default function CustomerInformationScreen({
  primaryMotorcycle,
  selectedMotorcycle,
  selectedPackages: _selectedPackages = [],
  pricingData: _pricingData,
  currentUser: _currentUser,
  firstName = '',
  onFirstNameChange,
  lastName = '',
  onLastNameChange,
  mobileNumber = '',
  onMobileNumberChange,
  email = '',
  onEmailChange,
  socialMedia = '',
  onSocialMediaChange,
  customerNotes = '',
  onCustomerNotesChange,
  motorcyclePhotos = [],
  onPhotosChange,
  onBack,
  onContinue,
  showToast,
  onChangeBike,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Active motorcycle (defaults to primary)
  const activeMoto = selectedMotorcycle || primaryMotorcycle;
  const motoBrand = activeMoto?.brand || 'Motorcycle';
  const motoModel = activeMoto?.model || '';
  const motoPlate = activeMoto?.plate_number || activeMoto?.plate || 'N/A';
  const motoCc =
    activeMoto?.engine_displacement ||
    activeMoto?.engine_cc ||
    activeMoto?.engineCc ||
    activeMoto?.cc ||
    150;

  // Photo upload handler
  const handlePickPhoto = async () => {
    if (motorcyclePhotos.length >= 3) {
      showToast?.('Maximum 3 photos allowed.');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const result = await pickImageFromFile();
      if (result?.uri) {
        onPhotosChange?.([...motorcyclePhotos, result.uri]);
        showToast?.('Photo attached successfully.');
      }
    } catch (_err) {
      showToast?.('Failed to select photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    onPhotosChange?.(motorcyclePhotos.filter((_, idx) => idx !== indexToRemove));
  };

  // Form validation before proceeding
  const handleProceed = () => {
    if (!firstName.trim()) {
      showToast?.('Please enter your First Name.');
      return;
    }
    if (!lastName.trim()) {
      showToast?.('Please enter your Last Name.');
      return;
    }
    if (!mobileNumber.trim()) {
      showToast?.('Please enter your Mobile Number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast?.('Please enter a valid Email Address.');
      return;
    }
    onContinue?.();
  };

  return (
    <View>
      {/* ─── PAGE TITLE & SUBTITLE (MATCHES OTHER STEPS) ─── */}
      <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Rider Information & Symptoms</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Your primary motorcycle is automatically selected for this booking. Please confirm your contact
          details and describe any symptoms for our technicians.
        </Text>
      </View>

      {/* ── 1. PRIMARY MOTORCYCLE CONFIRMATION CARD ── */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          padding: 18,
          marginBottom: 20,
          shadowColor: '#000000',
          shadowOpacity: 0.02,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                backgroundColor: '#FFF7ED',
                borderWidth: 1,
                borderColor: '#FFEDD5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="bicycle" size={22} color="#EA580C" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 16.5, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 }}>
                  {motoBrand} {motoModel}
                </Text>
                <View
                  style={{
                    backgroundColor: '#ECFDF5',
                    paddingHorizontal: 9,
                    paddingVertical: 2.5,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: '#A7F3D0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <BootstrapIcon name="star-fill" size={10} color="#059669" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>
                    Primary Motorcycle (Auto-Selected)
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                Displacement: <Text style={{ fontWeight: '600', color: '#0F172A', fontVariant: ['tabular-nums'] }}>{motoCc} CC</Text>
                {'  •  '}
                Plate Number: <Text style={{ fontWeight: '600', color: '#0F172A' }}>{motoPlate}</Text>
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <View
              style={{
                backgroundColor: '#F8FAFC',
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>
                Package rates calculated for <Text style={{ fontWeight: '700', color: '#0F172A', fontVariant: ['tabular-nums'] }}>{motoCc}cc</Text>
              </Text>
            </View>

            {typeof onChangeBike === 'function' && (
              <TouchableOpacity
                onPress={onChangeBike}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: '#FFF7ED',
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  cursor: 'pointer',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EA580C' }}>
                  Change Bike
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── 2. TWO-COLUMN WORKFLOW SECTION: CONTACT INFO & SYMPTOMS ── */}
      <View
        style={{
          flexDirection: isDesktop ? 'row' : 'column',
          alignItems: 'stretch',
          gap: 20,
        }}
      >
        {/* ── LEFT COLUMN: CUSTOMER CONTACT INFORMATION (MATCHING IMAGE 2) ── */}
        <View
          style={{
            flex: 1,
            minWidth: 280,
            maxWidth: '100%',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            padding: 24,
            shadowColor: '#000000',
            shadowOpacity: 0.02,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <BootstrapIcon name="person-vcard" size={17} color="#EA580C" />
            <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 }}>
              Customer Contact Information
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            {/* First Name */}
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                First Name: <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 13.5,
                  color: '#0F172A',
                  outlineStyle: 'none',
                }}
                placeholder="Enter your first name"
                placeholderTextColor="#94A3B8"
                value={firstName}
                onChangeText={onFirstNameChange}
              />
            </View>

            {/* Last Name */}
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Last Name: <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 13.5,
                  color: '#0F172A',
                  outlineStyle: 'none',
                }}
                placeholder="Enter your last name"
                placeholderTextColor="#94A3B8"
                value={lastName}
                onChangeText={onLastNameChange}
              />
            </View>

            {/* Mobile Number */}
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Mobile Number: <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 13.5,
                  color: '#0F172A',
                  fontVariant: ['tabular-nums'],
                  outlineStyle: 'none',
                }}
                placeholder="09xx xxx xxxx"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={mobileNumber}
                onChangeText={onMobileNumberChange}
              />
            </View>

            {/* Email */}
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Email: <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 13.5,
                  color: '#0F172A',
                  outlineStyle: 'none',
                }}
                placeholder="rider@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={onEmailChange}
              />
            </View>

            {/* Social Media Account (N/A if none) */}
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 6 }}>
                Social Media Account (N/A if none):
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 13.5,
                  color: '#0F172A',
                  outlineStyle: 'none',
                }}
                placeholder="Facebook Name, Instagram handle, or N/A"
                placeholderTextColor="#94A3B8"
                value={socialMedia}
                onChangeText={onSocialMediaChange}
              />
            </View>
          </View>
        </View>

        {/* ── RIGHT COLUMN: SYMPTOMS, CONCERNS & PHOTO ATTACHMENTS ── */}
        <View
          style={{
            flex: 1.15,
            minWidth: 280,
            maxWidth: '100%',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            padding: 24,
            shadowColor: '#000000',
            shadowOpacity: 0.02,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BootstrapIcon name="tools" size={16} color="#EA580C" />
            <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 }}>
              Motorcycle Symptoms & Concerns (Optional)
            </Text>
          </View>

          {/* Symptoms Text Area */}
          <TextInput
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#CBD5E1',
              borderRadius: 8,
              padding: 14,
              fontSize: 13,
              color: '#0F172A',
              minHeight: 120,
              textAlignVertical: 'top',
              outlineStyle: 'none',
              marginBottom: 18,
              lineHeight: 18,
            }}
            placeholder="e.g. Squeaking sound on rear brake when decelerating, engine idle RPM fluctuating after warm-up..."
            placeholderTextColor="#94A3B8"
            multiline={true}
            numberOfLines={4}
            value={customerNotes}
            onChangeText={onCustomerNotesChange}
          />

          {/* Photo Attachments */}
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#334155', marginBottom: 8 }}>
            Motorcycle / Issue Photos (Optional, max 3)
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: '#F8FAFC',
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: '#CBD5E1',
              borderStyle: 'dashed',
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isUploadingPhoto || motorcyclePhotos.length >= 3 ? 'not-allowed' : 'pointer',
              marginBottom: 12,
            }}
            onPress={handlePickPhoto}
            activeOpacity={0.8}
            disabled={isUploadingPhoto || motorcyclePhotos.length >= 3}
          >
            <BootstrapIcon name="camera-fill" size={20} color="#EA580C" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', marginTop: 4 }}>
              {isUploadingPhoto
                ? 'Uploading photo...'
                : motorcyclePhotos.length >= 3
                ? 'Maximum 3 Photos Attached'
                : 'Click to Upload Motorcycle or Damage Photo'}
            </Text>
            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
              Supports JPG, PNG up to 10MB
            </Text>
          </TouchableOpacity>

          {/* Photo Thumbnails */}
          {motorcyclePhotos.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {motorcyclePhotos.map((uri, idx) => (
                <View key={idx} style={{ position: 'relative' }}>
                  <Image
                    source={{ uri }}
                    style={{ width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}
                  />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      shadowColor: '#000000',
                      shadowOpacity: 0.15,
                      shadowRadius: 3,
                    }}
                    onPress={() => handleRemovePhoto(idx)}
                  >
                    <BootstrapIcon name="x" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── STEP ACTIONS FOOTER ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 24,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: '#E4E4E7',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#1E2227',
            cursor: 'pointer',
          }}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-left" size={13} color="#1E2227" />
          <Text style={{ color: '#1E2227', fontWeight: '600', fontSize: 13 }}>
            Back to Packages
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 22,
            borderRadius: 8,
            backgroundColor: '#1E2227',
            cursor: 'pointer',
            shadowColor: '#000000',
            shadowOpacity: 0.12,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
          onPress={handleProceed}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
            Next: Schedule Appointment
          </Text>
          <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
