import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { authService } from '../../services/authService';

// Quick Location Presets for City of Naga & Cebu
const NAGA_ADDRESS_PRESETS = [
  { label: 'Inoburan, Naga', address: 'Purok Avocado 4, Inoburan, City of Naga, Cebu, Philippines' },
  {
    label: 'East Poblacion, Naga',
    address: 'MotoTrack Hub, East Poblacion, City of Naga, Cebu, Philippines',
  },
  { label: 'Naga Boardwalk', address: 'Naga City Boardwalk, South Road, City of Naga, Cebu, Philippines' },
  { label: 'Minglanilla Border', address: 'Poblacion Ward 2, Minglanilla, Cebu, Philippines' },
  { label: 'Toledo Junction', address: 'Toledo-Naga Access Road, Uling, City of Naga, Cebu, Philippines' },
];

export default function ProfileModal({
  visible,
  onClose,
  onNavigateToOrders,
  onNavigateToWishlist,
  onNavigateToAdmin,
  showToast = () => {},
}) {
  const { currentUser, updateProfile, changeEmail, changePassword, getAccountLogs, logout } = useAuth();
  const { wishlistCount } = useWishlist();

  // Active view tab: 'settings' | 'security' | 'logs' | 'overview'
  const [activeTab, setActiveTab] = useState('settings');

  // Profile Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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

  // Password strength validation
  const pwdStrength = useMemo(() => {
    return authService.validatePasswordStrength(newPassword);
  }, [newPassword]);

  // Filtered account logs
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

  // Sync state with currentUser
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
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

  // Fetch account logs when switching to logs tab
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
  }, [activeTab, visible]);

  if (!currentUser) return null;

  // Handle Save Profile
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name');
      return;
    }
    if (!address.trim()) {
      showToast('Please provide a delivery address');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const res = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });

      if (res.success) {
        setSaveSuccessMsg('Address & contact details updated!');
        showToast('Profile and delivery address updated successfully');
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

  // Handle Change Email
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

  // Handle Change Password
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

  // Format log timestamp
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

  // Log icon & style resolver
  const getLogIconConfig = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('PASSWORD')) {
      return { icon: 'key-fill', color: '#0C6258', bg: '#F3F7F6', label: 'Password Security' };
    }
    if (act.includes('EMAIL')) {
      return { icon: 'envelope-fill', color: '#0284C7', bg: '#E0F2FE', label: 'Email Security' };
    }
    if (act.includes('LOGIN')) {
      return { icon: 'shield-lock-fill', color: '#16A34A', bg: '#DCFCE7', label: 'Sign In Event' };
    }
    if (act.includes('PROFILE')) {
      return { icon: 'person-fill', color: '#0C6258', bg: '#F3F7F6', label: 'Profile Update' };
    }
    return { icon: 'star-fill', color: '#7C3AED', bg: '#EDE9FE', label: 'Account Event' };
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { maxHeight: '94%' }]}>
          {/* ─── HEADER ─── */}
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BootstrapIcon name="gear-wide-connected" size={18} color="#0C6258" />
              <Text style={styles.modalTitle}>User Account & Settings</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* ─── USER SUMMARY BADGE ─── */}
          <View style={customStyles.userHeaderWrap}>
            <View style={[styles.avatarWrap, { width: 52, height: 52, borderRadius: 26, backgroundColor: '#DDE2E8', alignItems: 'center', justifyContent: 'center' }]}>
              {currentUser?.avatar &&
              !currentUser.avatar.includes('photo-1535713875002') &&
              !currentUser.avatar.includes('photo-1534528741775') &&
              !currentUser.avatar.includes('ui-avatars.com') ? (
                <Image
                  source={{ uri: currentUser.avatar || currentUser.photoUri }}
                  style={styles.avatarImg}
                />
              ) : (
                <BootstrapIcon name="person-fill" size={30} color="#64748B" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                {currentUser.name || currentUser.fullName}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>{currentUser.email}</Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: currentUser.role === 'admin' ? '#F3F7F6' : '#F1F5F9',
                  borderWidth: currentUser.role === 'admin' ? 1 : 0,
                  borderColor: '#D1ECE6',
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
                  color={currentUser.role === 'admin' ? '#0C6258' : '#475569'}
                />
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '800',
                    color: currentUser.role === 'admin' ? '#0C6258' : '#475569',
                  }}
                >
                  {currentUser.role === 'admin' ? 'Store Administrator' : 'Customer Account'}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── TAB SELECTOR (4 TABS) ─── */}
          <View style={customStyles.tabSwitchRow}>
            <TouchableOpacity
              style={[customStyles.tabBtn, activeTab === 'settings' && customStyles.tabBtnActive]}
              onPress={() => setActiveTab('settings')}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="geo-alt-fill"
                size={12}
                color={activeTab === 'settings' ? '#0C6258' : '#64748B'}
              />
              <Text
                style={[customStyles.tabBtnText, activeTab === 'settings' && customStyles.tabBtnTextActive]}
              >
                Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[customStyles.tabBtn, activeTab === 'security' && customStyles.tabBtnActive]}
              onPress={() => setActiveTab('security')}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="shield-lock-fill"
                size={12}
                color={activeTab === 'security' ? '#0C6258' : '#64748B'}
              />
              <Text
                style={[customStyles.tabBtnText, activeTab === 'security' && customStyles.tabBtnTextActive]}
              >
                Security
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[customStyles.tabBtn, activeTab === 'logs' && customStyles.tabBtnActive]}
              onPress={() => setActiveTab('logs')}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="clock-history"
                size={12}
                color={activeTab === 'logs' ? '#0C6258' : '#64748B'}
              />
              <Text style={[customStyles.tabBtnText, activeTab === 'logs' && customStyles.tabBtnTextActive]}>
                Logs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[customStyles.tabBtn, activeTab === 'overview' && customStyles.tabBtnActive]}
              onPress={() => setActiveTab('overview')}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="grid-fill"
                size={12}
                color={activeTab === 'overview' ? '#0C6258' : '#64748B'}
              />
              <Text
                style={[customStyles.tabBtnText, activeTab === 'overview' && customStyles.tabBtnTextActive]}
              >
                Actions
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            {/* ─── TAB 1: ADDRESS & PROFILE SETTINGS ─── */}
            {activeTab === 'settings' && (
              <View style={{ gap: 12, paddingBottom: 10 }}>
                <View style={customStyles.infoBanner}>
                  <BootstrapIcon name="info-circle" size={14} color="#0C6258" />
                  <Text style={customStyles.infoBannerText}>
                    Your saved address and phone number are automatically used for checkout and live GPS
                    courier delivery tracking.
                  </Text>
                </View>

                {/* Full Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Juan Dela Cruz"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Phone Number */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Contact / Phone Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(+63) 965 829 4141 / 09XX-XXX-XXXX"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Delivery Address */}
                <View style={styles.formGroup}>
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Text style={styles.formLabel}>Primary Delivery Address *</Text>
                    <Text style={{ fontSize: 11, color: '#0C6258', fontWeight: '700' }}>GPS Sync Active</Text>
                  </View>
                  <TextInput
                    style={[styles.formInput, { minHeight: 65, textAlignVertical: 'top' }]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Purok / Street, Barangay, City of Naga, Cebu, Philippines"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>

                {/* Quick Presets for City of Naga & Cebu */}
                <View style={{ gap: 6 }}>
                  <Text
                    style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}
                  >
                    Quick Location Shortcuts:
                  </Text>
                  <View style={customStyles.presetChipRow}>
                    {NAGA_ADDRESS_PRESETS.map((p, idx) => (
                      <TouchableOpacity
                        key={`preset-${idx}`}
                        style={[
                          customStyles.presetChip,
                          address.includes(p.label) && customStyles.presetChipActive,
                          { flexDirection: 'row', alignItems: 'center', gap: 4 },
                        ]}
                        onPress={() => {
                          setAddress(p.address);
                          showToast(`Selected: ${p.label}`);
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon
                          name="geo-alt-fill"
                          size={11}
                          color={address.includes(p.label) ? '#FFFFFF' : '#0C6258'}
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

                {/* Success Message Feedback */}
                {saveSuccessMsg ? (
                  <View style={customStyles.successBanner}>
                    <BootstrapIcon name="check-circle-fill" size={14} color="#16A34A" />
                    <Text style={customStyles.successBannerText}>{saveSuccessMsg}</Text>
                  </View>
                ) : null}

                {/* Save Changes Button */}
                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: '#0C6258',
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
                      <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14 }}>
                        Save Settings & Delivery Address
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ─── TAB 2: SECURITY (CHANGE EMAIL & CHANGE PASSWORD) ─── */}
            {activeTab === 'security' && (
              <View style={{ gap: 16, paddingBottom: 10 }}>
                {/* 1. CHANGE EMAIL CARD */}
                <View style={customStyles.securityCard}>
                  <View style={customStyles.securityCardHeader}>
                    <View style={[customStyles.cardIconWrap, { backgroundColor: '#E0F2FE' }]}>
                      <BootstrapIcon name="envelope-fill" size={15} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={customStyles.cardTitle}>Change Primary Email</Text>
                      <Text style={customStyles.cardSub}>
                        Current:{' '}
                        <Text style={{ fontWeight: '800', color: '#0F172A' }}>{currentUser.email}</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>New Email Address *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="rider.new@mototrack.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Current Password (to authorize change) *</Text>
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
                          color="#64748B"
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

                {/* 2. CHANGE PASSWORD CARD */}
                <View style={customStyles.securityCard}>
                  <View style={customStyles.securityCardHeader}>
                    <View style={[customStyles.cardIconWrap, { backgroundColor: '#F3F7F6' }]}>
                      <BootstrapIcon name="key-fill" size={15} color="#0C6258" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={customStyles.cardTitle}>Change Password</Text>
                      <Text style={customStyles.cardSub}>
                        Must be at least 8 characters with numbers and symbols
                      </Text>
                    </View>
                  </View>

                  {/* Current Password */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Current Password *</Text>
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
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* New Password */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>New Password *</Text>
                    <View style={customStyles.pwdInputWrap}>
                      <TextInput
                        style={customStyles.pwdInput}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Enter strong new password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showNewPwd}
                      />
                      <TouchableOpacity
                        style={customStyles.eyeBtn}
                        onPress={() => setShowNewPwd(!showNewPwd)}
                      >
                        <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={15} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Live Password Strength Meter */}
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
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                          Password Strength:{' '}
                          <Text style={{ color: pwdStrength.color, fontWeight: '900' }}>
                            {pwdStrength.label}
                          </Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '800' }}>
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
                      <View style={customStyles.criteriaRow}>
                        <Text
                          style={[
                            customStyles.criteriaBadge,
                            pwdStrength.criteria.minLength && customStyles.criteriaBadgeActive,
                          ]}
                        >
                          ✓ 8+ chars
                        </Text>
                        <Text
                          style={[
                            customStyles.criteriaBadge,
                            pwdStrength.criteria.hasUppercase && customStyles.criteriaBadgeActive,
                          ]}
                        >
                          ✓ A-Z
                        </Text>
                        <Text
                          style={[
                            customStyles.criteriaBadge,
                            pwdStrength.criteria.hasLowercase && customStyles.criteriaBadgeActive,
                          ]}
                        >
                          ✓ a-z
                        </Text>
                        <Text
                          style={[
                            customStyles.criteriaBadge,
                            pwdStrength.criteria.hasNumber && customStyles.criteriaBadgeActive,
                          ]}
                        >
                          ✓ 0-9
                        </Text>
                        <Text
                          style={[
                            customStyles.criteriaBadge,
                            pwdStrength.criteria.hasSpecial && customStyles.criteriaBadgeActive,
                          ]}
                        >
                          ✓ !@#$
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Confirm New Password */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Confirm New Password *</Text>
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
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                      <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 3, fontWeight: '600' }}>
                        Passwords do not match
                      </Text>
                    )}
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
                    style={[customStyles.securityActionBtn, { backgroundColor: '#0C6258' }]}
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

            {/* ─── TAB 3: ACCOUNT ACTIVITY & SECURITY LOGS ─── */}
            {activeTab === 'logs' && (
              <View style={{ gap: 10, paddingBottom: 10 }}>
                {/* Header with Refresh & Filter Pills */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                      Security & Activity Audit Logs
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                      Real-time records of security changes, sign-ins, and profile updates
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={customStyles.refreshBtn}
                    onPress={fetchLogs}
                    disabled={isLoadingLogs}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="arrow-clockwise" size={13} color="#0C6258" />
                  </TouchableOpacity>
                </View>

                {/* Filter Pills */}
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
                      <Text
                        style={[
                          customStyles.filterPillText,
                          logFilter === f.id && customStyles.filterPillTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Log List */}
                {isLoadingLogs ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#0C6258" />
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
                      Loading security audit logs...
                    </Text>
                  </View>
                ) : filteredLogs.length === 0 ? (
                  <View
                    style={{
                      padding: 20,
                      alignItems: 'center',
                      backgroundColor: '#F8FAFC',
                      borderRadius: 12,
                    }}
                  >
                    <BootstrapIcon name="clock-history" size={28} color="#94A3B8" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 6 }}>
                      No activity logs found
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', marginTop: 2 }}>
                      Recent security and profile events will appear here.
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
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                            }}
                          >
                            <Text style={customStyles.logTitle}>{iconConfig.label}</Text>
                            <Text style={customStyles.logTime}>{formatLogDate(item.created_at)}</Text>
                          </View>
                          <Text style={customStyles.logDesc}>{item.description}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
                            <Text style={customStyles.logBadge}>IP: {item.ip_address || '127.0.0.1'}</Text>
                            <Text style={customStyles.logBadge}>Verified</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ─── TAB 4: QUICK ACTIONS & NAVIGATION ─── */}
            {activeTab === 'overview' && (
              <View style={{ gap: 10, paddingBottom: 10 }}>
                {/* Current Saved Address Preview Card */}
                <View style={customStyles.addressPreviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <BootstrapIcon name="geo-alt-fill" size={14} color="#0C6258" />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }}>
                      Current Saved Address
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: '#475569', lineHeight: 17 }}>
                    {currentUser.address || 'No address set in profile yet.'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                    📞 {currentUser.phone || 'No phone number set'}
                  </Text>
                </View>

                {/* Direct Link to My Orders */}
                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: '#F3F7F6',
                      borderWidth: 1,
                      borderColor: '#D1ECE6',
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
                  <BootstrapIcon name="box-seam-fill" size={15} color="#0C6258" />
                  <Text style={{ color: '#0C6258', fontWeight: '800', fontSize: 13.5 }}>
                    View My Orders & Live Tracking
                  </Text>
                </TouchableOpacity>

                {/* Direct Link to Wishlist */}
                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: '#FEF2F2',
                      borderWidth: 1,
                      borderColor: '#FECACA',
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
                  <BootstrapIcon name="heart-fill" size={15} color="#DC2626" />
                  <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13.5 }}>
                    View Saved Favorites ({wishlistCount})
                  </Text>
                </TouchableOpacity>

                {/* Admin console button (Admin role only) */}
                {currentUser?.role === 'admin' && (
                  <TouchableOpacity
                    style={[
                      styles.checkoutBtn,
                      {
                        backgroundColor: '#0C6258',
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
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                      Admin Dashboard
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Logout Button */}
                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: '#F1F5F9',
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
                  <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 14 }}>Log Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const customStyles = StyleSheet.create({
  userHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  tabSwitchRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F1F5F9',
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
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0C6258',
    fontWeight: '900',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F3F7F6',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#0C6258',
    lineHeight: 16,
    fontWeight: '600',
  },
  presetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#F3F7F6',
    borderColor: '#0C6258',
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#0C6258',
    fontWeight: '900',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    flex: 1,
  },
  addressPreviewCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  securityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  pwdInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  pwdInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
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
  },
  securityActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  strengthCard: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  strengthBarTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  criteriaBadge: {
    fontSize: 10,
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criteriaBadgeActive: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
    fontWeight: '700',
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#0C6258',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  logCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    fontWeight: '800',
    color: '#0F172A',
  },
  logTime: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  logDesc: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  logBadge: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
});
