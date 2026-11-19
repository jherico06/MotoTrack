/**
 * Web-only Account & Profile Modal with interactive Leaflet house-pin picker,
 * delivery landmark notes, security controls, and audit logs.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import WebLocationPicker from './WebLocationPicker.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import { fontFamily } from '../../styles/typography.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { authService } from '../../services/auth/authService.js';
import { parseLatLng } from '../../utils/geo.js';

const NAGA_ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Inoburan, City of Naga, Cebu, Philippines' },
  { label: 'East Poblacion, Naga', address: 'East Poblacion, City of Naga, Cebu, Philippines' },
  { label: 'South Poblacion, Naga', address: 'South Poblacion, City of Naga, Cebu, Philippines' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu, Philippines' },
  { label: 'Uling, Naga', address: 'Uling, City of Naga, Cebu, Philippines' },
];

export default function WebProfileModal({
  visible,
  onClose,
  onNavigateToOrders,
  onNavigateToWishlist,
  onNavigateToAdmin,
  showToast = () => {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const { currentUser, updateProfile, changeEmail, changePassword, getAccountLogs, logout } = useAuth();
  const { wishlistCount } = useWishlist();
  const { isDarkMode } = useTheme();
  const customStyles = useMemo(() => createCustomStyles(isDarkMode), [isDarkMode]);

  const [activeTab, setActiveTab] = useState('settings');

  // Profile & Delivery Location State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [coordError, setCoordError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Security: Change Email State
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [showEmailCurrentPwd, setShowEmailCurrentPwd] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');

  // Security: Change Password State
  const [pwdCurrentPassword, setPwdCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdErrorMsg, setPwdErrorMsg] = useState('');
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState('');

  // Account Logs State
  const [accountLogs, setAccountLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('all');

  const pwdStrength = useMemo(() => {
    return authService.validatePasswordStrength(newPassword);
  }, [newPassword]);

  const filteredLogs = useMemo(() => {
    return accountLogs.filter((log) => {
      if (logFilter === 'all') return true;
      const act = (log.action || '').toUpperCase();
      if (logFilter === 'security')
        return act.includes('PASSWORD') || act.includes('EMAIL') || act.includes('SECURITY');
      if (logFilter === 'profile') return act.includes('PROFILE') || act.includes('ADDRESS');
      if (logFilter === 'login') return act.includes('LOGIN');
      return true;
    });
  }, [accountLogs, logFilter]);

  useEffect(() => {
    if (currentUser && visible) {
      const coords = parseLatLng(
        currentUser.latitude ?? currentUser.delivery_lat,
        currentUser.longitude ?? currentUser.delivery_lng
      );
      setName(currentUser.name || currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
      setDeliveryNotes(currentUser.deliveryNotes || currentUser.delivery_notes || '');
      setLatitude(coords?.lat ?? null);
      setLongitude(coords?.lng ?? null);
      setCoordError('');
      setSaveSuccessMsg('');
      setEmailErrorMsg('');
      setEmailSuccessMsg('');
      setPwdErrorMsg('');
      setPwdSuccessMsg('');
      setNewEmail('');
      setEmailCurrentPassword('');
      setPwdCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [currentUser, visible]);

  const fetchLogs = async () => {
    if (!currentUser) return;
    setIsLoadingLogs(true);
    try {
      const logs = await getAccountLogs();
      setAccountLogs(Array.isArray(logs) ? logs : []);
    } catch (_e) {
      setAccountLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (visible && activeTab === 'logs') {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, visible]);

  if (!currentUser) return null;

  const activePinCoords = parseLatLng(latitude, longitude);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name');
      return;
    }
    if (!address.trim()) {
      showToast('Please provide a delivery address');
      return;
    }
    if (!activePinCoords) {
      const msg = 'Please pin your exact house location on the map before saving.';
      setCoordError(msg);
      showToast(msg);
      return;
    }

    setCoordError('');
    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const res = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        deliveryNotes: deliveryNotes.trim(),
        delivery_notes: deliveryNotes.trim(),
        latitude: activePinCoords.lat,
        longitude: activePinCoords.lng,
        delivery_lat: activePinCoords.lat,
        delivery_lng: activePinCoords.lng,
      });

      if (res.success) {
        setSaveSuccessMsg('Address, contact details & house pin saved!');
        showToast('Profile, delivery address, and house pin updated');
        setTimeout(() => {
          setSaveSuccessMsg('');
        }, 3000);
      } else {
        showToast(res.error || 'Failed to update profile');
      }
    } catch (_e) {
      showToast('Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailErrorMsg('Please enter a valid new email address');
      return;
    }
    if (cleanEmail === (currentUser.email || '').toLowerCase()) {
      setEmailErrorMsg('New email cannot be identical to your current email');
      return;
    }
    if (!emailCurrentPassword) {
      setEmailErrorMsg('Please enter your current password to confirm email change');
      return;
    }

    setIsChangingEmail(true);
    setEmailErrorMsg('');
    setEmailSuccessMsg('');

    try {
      const res = await changeEmail({
        newEmail: cleanEmail,
        currentPassword: emailCurrentPassword,
      });

      if (res.success) {
        setEmailSuccessMsg(`Email successfully updated to ${cleanEmail}!`);
        showToast('Email address changed successfully');
        setNewEmail('');
        setEmailCurrentPassword('');
        fetchLogs();
      } else {
        setEmailErrorMsg(res.error || 'Failed to update email address');
      }
    } catch (_e) {
      setEmailErrorMsg('Error changing email. Please check your credentials.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdCurrentPassword) {
      setPwdErrorMsg('Please enter your current password');
      return;
    }
    if (!newPassword) {
      setPwdErrorMsg('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setPwdErrorMsg('New password must be at least 8 characters');
      return;
    }
    if (newPassword === pwdCurrentPassword) {
      setPwdErrorMsg('New password cannot be identical to current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErrorMsg('New passwords do not match. Please verify.');
      return;
    }

    setIsChangingPassword(true);
    setPwdErrorMsg('');
    setPwdSuccessMsg('');

    try {
      const res = await changePassword({
        currentPassword: pwdCurrentPassword,
        newPassword: newPassword,
      });

      if (res.success) {
        setPwdSuccessMsg('Password successfully changed! Security alert dispatched.');
        showToast('Password updated successfully');
        setPwdCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchLogs();
      } else {
        setPwdErrorMsg(res.error || 'Failed to update password. Current password may be incorrect.');
      }
    } catch (_e) {
      setPwdErrorMsg('Error updating password. Verification failed.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatLogDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_e) {
      return dateStr || 'Recently';
    }
  };

  const getLogIconConfig = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('PASSWORD')) {
      return {
        icon: 'key-fill',
        color: isDarkMode ? '#FB923C' : '#EA580C',
        bg: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
        label: 'Password Security',
      };
    }
    if (act.includes('EMAIL')) {
      return {
        icon: 'envelope-fill',
        color: isDarkMode ? '#38BDF8' : '#0284C7',
        bg: isDarkMode ? 'rgba(2, 132, 199, 0.18)' : '#E0F2FE',
        label: 'Email Security',
      };
    }
    if (act.includes('LOGIN')) {
      return {
        icon: 'shield-lock-fill',
        color: isDarkMode ? '#00C98D' : '#16A34A',
        bg: isDarkMode ? 'rgba(22, 163, 74, 0.16)' : '#DCFCE7',
        label: 'Sign In Event',
      };
    }
    if (act.includes('PROFILE')) {
      return {
        icon: 'person-fill',
        color: isDarkMode ? '#FB923C' : '#EA580C',
        bg: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
        label: 'Profile Update',
      };
    }
    return {
      icon: 'star-fill',
      color: isDarkMode ? '#A78BFA' : '#7C3AED',
      bg: isDarkMode ? 'rgba(124, 58, 237, 0.16)' : '#EDE9FE',
      label: 'Account Event',
    };
  };

  return (
    <Modal visible={visible} transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View
        style={[
          styles.modalOverlay,
          isDarkMode && { backgroundColor: 'rgba(2, 6, 23, 0.72)' },
          isDesktop && {
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.modalSheet,
            {
              maxHeight: isDesktop ? '90%' : '94%',
              maxWidth: isDesktop ? 640 : '100%',
              borderRadius: isDesktop ? 24 : 28,
              borderBottomLeftRadius: isDesktop ? 24 : 0,
              borderBottomRightRadius: isDesktop ? 24 : 0,
              paddingHorizontal: windowWidth < 380 ? 12 : 20,
              backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
              borderColor: isDarkMode ? '#303236' : 'transparent',
              borderWidth: isDarkMode ? 1 : 0,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeaderRow, isDarkMode && { borderBottomColor: '#282D34' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : '#FED7AA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="person-gear" size={17} color={isDarkMode ? '#FB923C' : '#EA580C'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#F8FAFC' }]}>
                  Account & Settings
                </Text>
                <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 1, fontFamily: fontFamily.sans }}>
                  Manage profile, house pin location & security
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
                borderWidth: isDarkMode ? 1 : 0,
                borderColor: isDarkMode ? '#303236' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* User Summary */}
          <View style={customStyles.userHeaderWrap}>
            <View
              style={[
                styles.avatarWrap,
                {
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: isDarkMode ? '#202124' : '#DDE2E8',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              {currentUser?.avatar &&
              !currentUser.avatar.includes('photo-1535713875002') &&
              !currentUser.avatar.includes('photo-1534528741775') &&
              !currentUser.avatar.includes('ui-avatars.com') ? (
                <Image source={{ uri: currentUser.avatar || currentUser.photoUri }} style={styles.avatarImg} />
              ) : (
                <BootstrapIcon name="person-fill" size={30} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: isDarkMode ? '#F2F2F3' : '#0F172A', fontFamily: fontFamily.sans }}>
                {currentUser.name || currentUser.fullName}
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', fontFamily: fontFamily.sans }}>{currentUser.email}</Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor:
                    currentUser.role === 'admin'
                      ? isDarkMode
                        ? 'rgba(234, 88, 12, 0.16)'
                        : '#FFF7ED'
                      : isDarkMode
                        ? '#202124'
                        : '#F1F5F9',
                  borderWidth: currentUser.role === 'admin' ? 1 : 0,
                  borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : '#C8DDD3',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  marginTop: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <BootstrapIcon
                  name={currentUser.role === 'admin' ? 'shield-lock-fill' : 'person-fill'}
                  size={10}
                  color={
                    currentUser.role === 'admin'
                      ? isDarkMode
                        ? '#FB923C'
                        : '#EA580C'
                      : isDarkMode
                        ? '#A1A1AA'
                        : '#475569'
                  }
                />
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '600',
                    fontFamily: fontFamily.sans,
                    color:
                      currentUser.role === 'admin'
                        ? isDarkMode
                          ? '#FB923C'
                          : '#EA580C'
                        : isDarkMode
                          ? '#A1A1AA'
                          : '#475569',
                  }}
                >
                  {currentUser.role === 'admin' ? 'Store Administrator' : 'Customer Account'}
                </Text>
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={customStyles.tabSwitchRow}>
            {[
              { id: 'settings', label: 'Profile', icon: 'geo-alt-fill' },
              { id: 'security', label: 'Security', icon: 'shield-lock-fill' },
              { id: 'logs', label: 'Logs', icon: 'clock-history' },
              { id: 'overview', label: 'Actions', icon: 'grid-fill' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[customStyles.tabBtn, isActive && customStyles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name={tab.icon}
                    size={12}
                    color={
                      isActive ? (isDarkMode ? '#FB923C' : '#EA580C') : isDarkMode ? '#A1A1AA' : '#64748B'
                    }
                  />
                  <Text style={[customStyles.tabBtnText, isActive && customStyles.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={{ maxHeight: 490 }} showsVerticalScrollIndicator={false}>
            {/* Tab 1: Profile & Delivery Pin */}
            {activeTab === 'settings' && (
              <View style={{ gap: 12, paddingBottom: 10 }}>
                <View style={customStyles.infoBanner}>
                  <BootstrapIcon name="info-circle" size={14} color="#EA580C" />
                  <Text style={customStyles.infoBannerText}>
                    Your saved address, phone number, and house pin are used for express checkout and rider delivery tracking.
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                    Full Name *
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { fontFamily: fontFamily.sans },
                      isDarkMode && { backgroundColor: '#14181D', borderColor: '#333A42', color: '#F8FAFC' },
                    ]}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Juan Dela Cruz"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                    Contact / Phone Number *
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { fontFamily: fontFamily.sans },
                      isDarkMode && { backgroundColor: '#14181D', borderColor: '#333A42', color: '#F8FAFC' },
                    ]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(+63) 9XX-XXX-XXXX"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                      Primary Delivery Address *
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: activePinCoords ? '#16A34A' : isDarkMode ? '#FB923C' : '#EA580C',
                        fontWeight: '600',
                        fontFamily: fontFamily.sans,
                      }}
                    >
                      {activePinCoords ? '✓ House Pin Set' : 'Map Pin Needed'}
                    </Text>
                  </View>
                  <TextInput
                    style={[
                      styles.formInput,
                      { minHeight: 58, textAlignVertical: 'top', fontFamily: fontFamily.sans },
                      isDarkMode && { backgroundColor: '#14181D', borderColor: '#333A42', color: '#F8FAFC' },
                    ]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="House / Purok / Street, Barangay, City of Naga, Cebu"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>

                {/* Area Presets */}
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '600',
                      fontFamily: fontFamily.sans,
                      color: isDarkMode ? '#A1A1AA' : '#64748B',
                      textTransform: 'uppercase',
                    }}
                  >
                    Quick Area Fill:
                  </Text>
                  <View style={customStyles.presetChipRow}>
                    {NAGA_ADDRESS_PRESETS.map((p, idx) => (
                      <TouchableOpacity
                        key={`web-preset-${idx}`}
                        style={[
                          customStyles.presetChip,
                          address.includes(p.label) && customStyles.presetChipActive,
                          { flexDirection: 'row', alignItems: 'center', gap: 4 },
                        ]}
                        onPress={() => {
                          setAddress(p.address);
                          showToast(`Filled ${p.label} — click "Locate Typed Address" to jump map`);
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon
                          name="geo-alt-fill"
                          size={11}
                          color={address.includes(p.label) ? '#FFFFFF' : isDarkMode ? '#FB923C' : '#EA580C'}
                        />
                        <Text
                          style={[
                            customStyles.presetChipText,
                            address.includes(p.label) && customStyles.presetChipTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                    Landmark / Delivery Notes
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { fontFamily: fontFamily.sans },
                      isDarkMode && { backgroundColor: '#14181D', borderColor: '#333A42', color: '#F8FAFC' },
                    ]}
                    value={deliveryNotes}
                    onChangeText={setDeliveryNotes}
                    placeholder="e.g. blue gate, beside the sari-sari store"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                    Exact House Pin Location *
                  </Text>
                  <WebLocationPicker
                    latitude={latitude}
                    longitude={longitude}
                    addressText={address}
                    isDarkMode={isDarkMode}
                    height={230}
                    errorText={coordError}
                    onLocationChange={({ lat, lng }) => {
                      setLatitude(lat);
                      setLongitude(lng);
                      setCoordError('');
                    }}
                  />
                </View>

                {saveSuccessMsg ? (
                  <View style={customStyles.successBanner}>
                    <BootstrapIcon name="check-circle-fill" size={14} color="#16A34A" />
                    <Text style={customStyles.successBannerText}>{saveSuccessMsg}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: '#EA580C',
                      marginTop: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    },
                  ]}
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                  activeOpacity={0.9}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <BootstrapIcon name="check2" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14, fontFamily: fontFamily.sans }}>
                        Save Profile, Address & Pin
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Tab 2: Security */}
            {activeTab === 'security' && (
              <View style={{ gap: 16, paddingBottom: 10 }}>
                <View style={customStyles.securityCard}>
                  <View style={customStyles.securityCardHeader}>
                    <View
                      style={[
                        customStyles.cardIconWrap,
                        { backgroundColor: isDarkMode ? 'rgba(2, 132, 199, 0.18)' : '#E0F2FE' },
                      ]}
                    >
                      <BootstrapIcon name="envelope-fill" size={15} color={isDarkMode ? '#38BDF8' : '#0284C7'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={customStyles.cardTitle}>Change Primary Email</Text>
                      <Text style={customStyles.cardSub}>
                        Current:{' '}
                        <Text style={{ fontWeight: '600', color: isDarkMode ? '#F2F2F3' : '#0F172A' }}>
                          {currentUser.email}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                      New Email Address *
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        { fontFamily: fontFamily.sans },
                        isDarkMode && { backgroundColor: '#14181D', borderColor: '#333A42', color: '#F8FAFC' },
                      ]}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="rider.new@mototrack.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                      Current Password *
                    </Text>
                    <View style={customStyles.pwdInputWrap}>
                      <TextInput
                        style={customStyles.pwdInput}
                        value={emailCurrentPassword}
                        onChangeText={setEmailCurrentPassword}
                        placeholder="Enter current password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showEmailCurrentPwd}
                      />
                      <TouchableOpacity
                        style={customStyles.eyeBtn}
                        onPress={() => setShowEmailCurrentPwd(!showEmailCurrentPwd)}
                      >
                        <BootstrapIcon
                          name={showEmailCurrentPwd ? 'eye-slash' : 'eye'}
                          size={15}
                          color={isDarkMode ? '#A1A1AA' : '#64748B'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {emailErrorMsg ? (
                    <View style={customStyles.errorBanner}>
                      <BootstrapIcon name="exclamation-circle-fill" size={13} color="#DC2626" />
                      <Text style={customStyles.errorBannerText}>{emailErrorMsg}</Text>
                    </View>
                  ) : null}

                  {emailSuccessMsg ? (
                    <View style={customStyles.successBanner}>
                      <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
                      <Text style={customStyles.successBannerText}>{emailSuccessMsg}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[customStyles.securityActionBtn, { backgroundColor: '#0284C7' }]}
                    onPress={handleChangeEmail}
                    disabled={isChangingEmail}
                    activeOpacity={0.85}
                  >
                    {isChangingEmail ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon name="arrow-clockwise" size={14} color="#FFFFFF" />
                        <Text style={customStyles.securityActionBtnText}>Update Email Address</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={customStyles.securityCard}>
                  <View style={customStyles.securityCardHeader}>
                    <View
                      style={[
                        customStyles.cardIconWrap,
                        { backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED' },
                      ]}
                    >
                      <BootstrapIcon name="key-fill" size={15} color={isDarkMode ? '#FB923C' : '#EA580C'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={customStyles.cardTitle}>Change Password</Text>
                      <Text style={customStyles.cardSub}>
                        Must be at least 8 characters with numbers and symbols
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                      Current Password *
                    </Text>
                    <View style={customStyles.pwdInputWrap}>
                      <TextInput
                        style={customStyles.pwdInput}
                        value={pwdCurrentPassword}
                        onChangeText={setPwdCurrentPassword}
                        placeholder="Enter current password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showPwdCurrent}
                      />
                      <TouchableOpacity
                        style={customStyles.eyeBtn}
                        onPress={() => setShowPwdCurrent(!showPwdCurrent)}
                      >
                        <BootstrapIcon
                          name={showPwdCurrent ? 'eye-slash' : 'eye'}
                          size={15}
                          color={isDarkMode ? '#A1A1AA' : '#64748B'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                      New Password *
                    </Text>
                    <View style={customStyles.pwdInputWrap}>
                      <TextInput
                        style={customStyles.pwdInput}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Enter strong new password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showNewPwd}
                      />
                      <TouchableOpacity style={customStyles.eyeBtn} onPress={() => setShowNewPwd(!showNewPwd)}>
                        <BootstrapIcon
                          name={showNewPwd ? 'eye-slash' : 'eye'}
                          size={15}
                          color={isDarkMode ? '#A1A1AA' : '#64748B'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {newPassword.length > 0 && (
                    <View style={customStyles.strengthCard}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#A1A1AA' : '#475569', fontFamily: fontFamily.sans }}>
                          Password Strength:{' '}
                          <Text style={{ color: pwdStrength.color, fontWeight: '500' }}>{pwdStrength.label}</Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#A1A1AA' : '#64748B', fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                          {pwdStrength.score}%
                        </Text>
                      </View>
                      <View style={customStyles.strengthBarTrack}>
                        <View
                          style={[
                            customStyles.strengthBarFill,
                            { width: `${pwdStrength.score}%`, backgroundColor: pwdStrength.color },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { fontFamily: fontFamily.sans }, isDarkMode && { color: '#CBD5E1' }]}>
                      Confirm New Password *
                    </Text>
                    <View style={customStyles.pwdInputWrap}>
                      <TextInput
                        style={customStyles.pwdInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Re-type new password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showConfirmPwd}
                      />
                      <TouchableOpacity
                        style={customStyles.eyeBtn}
                        onPress={() => setShowConfirmPwd(!showConfirmPwd)}
                      >
                        <BootstrapIcon
                          name={showConfirmPwd ? 'eye-slash' : 'eye'}
                          size={15}
                          color={isDarkMode ? '#A1A1AA' : '#64748B'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {pwdErrorMsg ? (
                    <View style={customStyles.errorBanner}>
                      <BootstrapIcon name="exclamation-circle-fill" size={13} color="#DC2626" />
                      <Text style={customStyles.errorBannerText}>{pwdErrorMsg}</Text>
                    </View>
                  ) : null}

                  {pwdSuccessMsg ? (
                    <View style={customStyles.successBanner}>
                      <BootstrapIcon name="check-circle-fill" size={13} color="#16A34A" />
                      <Text style={customStyles.successBannerText}>{pwdSuccessMsg}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[customStyles.securityActionBtn, { backgroundColor: '#EA580C' }]}
                    onPress={handleChangePassword}
                    disabled={isChangingPassword}
                    activeOpacity={0.85}
                  >
                    {isChangingPassword ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <BootstrapIcon name="shield-check" size={14} color="#FFFFFF" />
                        <Text style={customStyles.securityActionBtnText}>Update Password</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Tab 3: Activity Logs */}
            {activeTab === 'logs' && (
              <View style={{ gap: 10, paddingBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#F2F2F3' : '#0F172A', fontFamily: fontFamily.sans }}>
                      Security & Activity Audit Logs
                    </Text>
                    <Text style={{ fontSize: 11.5, color: isDarkMode ? '#A1A1AA' : '#64748B', fontFamily: fontFamily.sans }}>
                      Real-time records of security changes, sign-ins, and profile updates
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={customStyles.refreshBtn}
                    onPress={fetchLogs}
                    disabled={isLoadingLogs}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="arrow-clockwise" size={13} color={isDarkMode ? '#FB923C' : '#EA580C'} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
                  {[
                    { id: 'all', label: 'All Events' },
                    { id: 'security', label: 'Security' },
                    { id: 'login', label: 'Sign-ins' },
                    { id: 'profile', label: 'Profile' },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[customStyles.filterPill, logFilter === f.id && customStyles.filterPillActive]}
                      onPress={() => setLogFilter(f.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[customStyles.filterPillText, logFilter === f.id && customStyles.filterPillTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isLoadingLogs ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#EA580C" />
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#A1A1AA' : '#64748B', marginTop: 8, fontFamily: fontFamily.sans }}>
                      Loading security audit logs...
                    </Text>
                  </View>
                ) : filteredLogs.length === 0 ? (
                  <View
                    style={{
                      padding: 20,
                      alignItems: 'center',
                      backgroundColor: isDarkMode ? '#14181D' : '#F8FAFC',
                      borderWidth: isDarkMode ? 1 : 0,
                      borderColor: '#282D34',
                      borderRadius: 12,
                    }}
                  >
                    <BootstrapIcon name="clock-history" size={28} color={isDarkMode ? '#71717A' : '#94A3B8'} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#A1A1AA' : '#475569', marginTop: 6, fontFamily: fontFamily.sans }}>
                      No activity logs found
                    </Text>
                  </View>
                ) : (
                  filteredLogs.map((item, idx) => {
                    const iconConfig = getLogIconConfig(item.action);
                    return (
                      <View key={item.log_id || idx} style={customStyles.logCard}>
                        <View style={[customStyles.logIconWrap, { backgroundColor: iconConfig.bg }]}>
                          <BootstrapIcon name={iconConfig.icon} size={14} color={iconConfig.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Text style={customStyles.logTitle}>{iconConfig.label}</Text>
                            <Text style={customStyles.logTime}>{formatLogDate(item.created_at)}</Text>
                          </View>
                          <Text style={customStyles.logDesc}>{item.description}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Tab 4: Quick Actions */}
            {activeTab === 'overview' && (
              <View style={{ gap: 10, paddingBottom: 10 }}>
                <View style={customStyles.addressPreviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <BootstrapIcon name="geo-alt-fill" size={14} color={isDarkMode ? '#FB923C' : '#EA580C'} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#F2F2F3' : '#0F172A', fontFamily: fontFamily.sans }}>
                      Current Saved Address & House Pin
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: isDarkMode ? '#A1A1AA' : '#475569', lineHeight: 17, fontFamily: fontFamily.sans }}>
                    {currentUser.address || 'No address set in profile yet.'}
                  </Text>
                  {activePinCoords ? (
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '600',
                        color: '#16A34A',
                        marginTop: 4,
                        fontFamily: fontFamily.sans,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      ✓ Exact house pin: {activePinCoords.lat.toFixed(5)}, {activePinCoords.lng.toFixed(5)}
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={() => setActiveTab('settings')} style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#D97706', fontFamily: fontFamily.sans }}>
                        Pin not set yet — click here to drop your pin in Profile
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <BootstrapIcon name="telephone" size={12} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#A1A1AA' : '#64748B', fontFamily: fontFamily.sans, fontVariant: ['tabular-nums'] }}>
                      {currentUser.phone || 'No phone number set'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    },
                  ]}
                  onPress={() => {
                    onClose?.();
                    onNavigateToOrders?.();
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="box-seam-fill" size={15} color={isDarkMode ? '#FB923C' : '#EA580C'} />
                  <Text style={{ color: isDarkMode ? '#FB923C' : '#EA580C', fontWeight: '600', fontSize: 13.5, fontFamily: fontFamily.sans }}>
                    View My Orders & Live Tracking
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.14)' : '#FEF2F2',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(220, 38, 38, 0.35)' : '#FECACA',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    },
                  ]}
                  onPress={() => {
                    onClose?.();
                    onNavigateToWishlist?.();
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="heart-fill" size={15} color={isDarkMode ? '#F04444' : '#DC2626'} />
                  <Text style={{ color: isDarkMode ? '#F04444' : '#DC2626', fontWeight: '600', fontSize: 13.5, fontFamily: fontFamily.sans }}>
                    View Saved Favorites ({wishlistCount})
                  </Text>
                </TouchableOpacity>

                {currentUser?.role === 'admin' && (
                  <TouchableOpacity
                    style={[
                      styles.checkoutBtn,
                      {
                        backgroundColor: '#EA580C',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      },
                    ]}
                    onPress={() => {
                      onClose?.();
                      onNavigateToAdmin?.();
                    }}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="shield-lock-fill" size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13.5, fontFamily: fontFamily.sans }}>
                      Admin Dashboard
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
                      marginTop: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    },
                  ]}
                  onPress={() => {
                    logout();
                    onClose?.();
                  }}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="box-arrow-right" size={14} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14, fontFamily: fontFamily.sans }}>
                    Log Out
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createCustomStyles = (isDarkMode) =>
  StyleSheet.create({
    userHeaderWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
      marginBottom: 10,
    },
    tabSwitchRow: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: isDarkMode ? '#18181B' : '#F1F5F9',
      padding: 3,
      borderRadius: 12,
      marginBottom: 12,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 7,
      borderRadius: 9,
      cursor: 'pointer',
    },
    tabBtnActive: {
      backgroundColor: isDarkMode ? '#202124' : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDarkMode ? 0.35 : 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabBtnText: {
      fontSize: 11.5,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: '#94A3B8',
    },
    tabBtnTextActive: {
      color: isDarkMode ? '#FB923C' : '#EA580C',
      fontWeight: '600',
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED',
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.32)' : '#C8DDD3',
    },
    infoBannerText: {
      flex: 1,
      fontSize: 11.5,
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#FDBA74' : '#EA580C',
      lineHeight: 16,
      fontWeight: '500',
    },
    presetChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    presetChip: {
      backgroundColor: isDarkMode ? '#18181B' : '#F1F5F9',
      paddingHorizontal: 8,
      paddingVertical: 4.5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
      cursor: 'pointer',
    },
    presetChipActive: {
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
      borderColor: '#EA580C',
    },
    presetChipText: {
      fontSize: 10.5,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#A1A1AA' : '#475569',
    },
    presetChipTextActive: {
      color: isDarkMode ? '#FB923C' : '#EA580C',
      fontWeight: '600',
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.14)' : '#F0FDF4',
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(74, 222, 128, 0.3)' : '#BBF7D0',
    },
    successBannerText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#00C98D' : '#166534',
      flex: 1,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(248, 113, 113, 0.35)' : '#FECACA',
    },
    errorBannerText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#FCA5A5' : '#DC2626',
      flex: 1,
    },
    addressPreviewCard: {
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
    },
    securityCard: {
      backgroundColor: isDarkMode ? '#18181B' : '#F8FAFC',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
      gap: 10,
    },
    securityCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
    },
    cardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 13.5,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
    },
    cardSub: {
      fontSize: 11.5,
      fontFamily: fontFamily.sans,
      color: '#94A3B8',
    },
    pwdInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? '#333A42' : '#E2E8F0',
      borderRadius: 10,
      backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
    },
    pwdInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
    },
    eyeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    securityActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 4,
      cursor: 'pointer',
    },
    securityActionBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      fontSize: 13,
    },
    strengthCard: {
      backgroundColor: isDarkMode ? '#14181D' : '#FFFFFF',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
    },
    strengthBarTrack: {
      height: 4,
      backgroundColor: isDarkMode ? '#303236' : '#E2E8F0',
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 4,
    },
    strengthBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    refreshBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.16)' : '#FFF7ED',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : '#C8DDD3',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'pointer',
    },
    filterPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#202124' : '#F1F5F9',
      cursor: 'pointer',
    },
    filterPillActive: {
      backgroundColor: '#EA580C',
    },
    filterPillText: {
      fontSize: 11,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: '#94A3B8',
    },
    filterPillTextActive: {
      color: '#FFFFFF',
    },
    logCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: isDarkMode ? '#18181B' : '#FFFFFF',
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? '#303236' : '#E2E8F0',
    },
    logIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logTitle: {
      fontSize: 12.5,
      fontWeight: '600',
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#F2F2F3' : '#0F172A',
    },
    logTime: {
      fontSize: 10.5,
      fontFamily: fontFamily.sans,
      color: '#94A3B8',
    },
    logDesc: {
      fontSize: 11.5,
      fontFamily: fontFamily.sans,
      color: isDarkMode ? '#A1A1AA' : '#475569',
      marginTop: 2,
    },
  });
