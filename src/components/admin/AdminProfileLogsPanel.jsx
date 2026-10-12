import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authService } from '../../services/auth/authService.js';
import { auditLogService } from '../../services/system/auditLogService.js';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';

const LOGS_PER_PAGE = 8;

const LOG_FILTER_OPTIONS = [
  { key: 'all', label: 'All Logs', icon: 'journal-text' },
  { key: 'security', label: 'Security', icon: 'shield-lock-fill' },
  { key: 'profile', label: 'Profile', icon: 'person-badge-fill' },
  { key: 'login', label: 'Sign-ins', icon: 'box-arrow-in-right' },
  { key: 'admin', label: 'Admin Actions', icon: 'gear-wide-connected' },
];

/**
 * Format timestamp to a genuine, human-readable date & time object
 */
function parseTimestamp(raw) {
  if (!raw) return { date: '—', time: '—', raw: '' };
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return { date: String(raw), time: '', raw: String(raw) };
    const date = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return { date, time, raw: d.toISOString() };
  } catch (_e) {
    return { date: String(raw), time: '', raw: String(raw) };
  }
}

/**
 * Convert raw action string into a clean, human-readable title
 */
function formatActionTitle(action = '') {
  if (!action) return 'Activity Event';
  const MAP = {
    LOGIN_SUCCESS: 'Sign-in Event',
    LOGIN_FAILED: 'Failed Sign-in',
    ACCOUNT_CREATED: 'Account Registered',
    PASSWORD_CHANGED: 'Password Updated',
    PASSWORD_UPDATED: 'Password Updated',
    EMAIL_CHANGED: 'Email Address Updated',
    PROFILE_UPDATED: 'Profile Updated',
    AVATAR_UPDATED: 'Profile Photo Changed',
    ORDER_APPROVED: 'Order Approved',
    ORDER_CANCELLED: 'Order Cancelled',
    STOCK_REPLENISHED: 'Stock Replenished',
    BOOKING_DISPATCHED: 'Booking Dispatched',
    SETTINGS_UPDATED: 'System Settings Updated',
  };
  if (MAP[action]) return MAP[action];
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * AdminProfileLogsPanel
 *
 * Refined, enterprise-grade administrator profile & activity logs dashboard.
 * Preserves all backend services, authentication flows, password validation,
 * image uploading, and CSV exporting with clean SaaS design.
 */
export default function AdminProfileLogsPanel({
  isDarkMode = false,
  tokens = {},
  showToast = () => {},
  showConfirm = () => {},
  isDesktop = true,
  onNavigate = () => {},
}) {
  const { currentUser, updateProfile, changeEmail, changePassword, getAccountLogs } = useAuth();

  // Active sub-tab: 'profile' | 'security' | 'logs'
  const [activeTab, setActiveTab] = useState('profile');

  // ── Profile Form State ──
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // ── Security: Email State ──
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [showEmailCurrentPwd, setShowEmailCurrentPwd] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');

  // ── Security: Password State ──
  const [pwdCurrentPassword, setPwdCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdErrorMsg, setPwdErrorMsg] = useState('');
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState('');

  // ── Activity Logs State ──
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  // Close filter dropdown on outside click (Web) and Escape key
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Category counts computed from loaded logs
  const categoryCounts = useMemo(() => {
    let security = 0;
    let profile = 0;
    let login = 0;
    let admin = 0;

    logs.forEach((log) => {
      const act = (log.action || '').toUpperCase();
      const cat = (log.category || '').toLowerCase();
      if (act.includes('PASSWORD') || act.includes('EMAIL') || act.includes('SECURITY') || cat === 'security') {
        security++;
      } else if (act.includes('PROFILE') || act.includes('ADDRESS') || act.includes('AVATAR')) {
        profile++;
      } else if (act.includes('LOGIN') || act.includes('SIGNIN') || act.includes('AUTH') || cat === 'login') {
        login++;
      } else if (log.source === 'audit' || cat === 'orders' || cat === 'inventory' || cat === 'system') {
        admin++;
      }
    });

    return {
      all: logs.length,
      security,
      profile,
      login,
      admin,
    };
  }, [logs]);

  const activeFilterOption = useMemo(() => {
    return LOG_FILTER_OPTIONS.find((f) => f.key === logFilter) || LOG_FILTER_OPTIONS[0];
  }, [logFilter]);

  // Password validation analysis
  const pwdStrength = useMemo(() => {
    return authService.validatePasswordStrength(newPassword);
  }, [newPassword]);

  // Sync state with currentUser
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || currentUser.fullName || '');
      setPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  // Fetch account & audit logs
  const fetchLogs = async () => {
    if (!currentUser) return;
    setIsLoadingLogs(true);
    try {
      const personalLogs = (await getAccountLogs?.()) || [];
      const normalizedPersonal = (Array.isArray(personalLogs) ? personalLogs : []).map((l, idx) => {
        const rawTime = l.created_at || l.timestamp || l.createdAt || new Date().toISOString();
        const act = l.action || 'ACTIVITY_EVENT';
        return {
          id: l.log_id || l.id || `personal-${idx}-${rawTime}`,
          action: act,
          details:
            l.description ||
            l.details ||
            (act === 'LOGIN_SUCCESS'
              ? 'Administrator signed in to the console'
              : act === 'ACCOUNT_CREATED'
                ? 'Account verified and configured on platform'
                : 'Authentication event recorded'),
          timestamp: rawTime,
          source: 'personal',
          category:
            l.category ||
            (act.includes('PASSWORD') || act.includes('EMAIL')
              ? 'security'
              : act.includes('LOGIN')
                ? 'login'
                : act.includes('PROFILE')
                  ? 'profile'
                  : 'account'),
          severity: l.severity || 'INFO',
          ip_address: l.ip_address || l.ip || '127.0.0.1',
          user_agent: l.user_agent || 'Admin Web Console',
        };
      });

      // System audit logs
      const systemAuditLogs = auditLogService.getLogs() || [];
      const normalizedSystem = systemAuditLogs.map((l) => {
        const rawTime = l.timestamp || l.createdAt || l.created_at || new Date().toISOString();
        return {
          id: l.id || `audit-${Math.random()}`,
          action: l.action || 'ADMIN_ACTION',
          details: l.details || l.description || (l.target ? `Action on ${l.target}` : 'Administrative action executed'),
          timestamp: rawTime,
          source: 'audit',
          category: l.category || 'system',
          severity: l.severity || 'INFO',
          ip_address: l.ip_address || '127.0.0.1',
          user_agent: l.client || 'Admin Dashboard',
          admin_name: l.admin_name,
          target: l.target,
        };
      });

      // Combine without duplicate IDs and sort newest first
      const map = new Map();
      [...normalizedPersonal, ...normalizedSystem].forEach((item) => {
        if (!map.has(item.id)) map.set(item.id, item);
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      );

      setLogs(merged);
    } catch (_e) {
      setLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [logFilter, logSearchQuery]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const act = (log.action || '').toUpperCase();
      const det = (log.details || '').toLowerCase();
      const cat = (log.category || '').toLowerCase();

      // Category filter
      if (logFilter === 'security') {
        const isSec =
          act.includes('PASSWORD') || act.includes('EMAIL') || act.includes('SECURITY') || cat === 'security';
        if (!isSec) return false;
      } else if (logFilter === 'profile') {
        const isProf = act.includes('PROFILE') || act.includes('ADDRESS') || act.includes('AVATAR');
        if (!isProf) return false;
      } else if (logFilter === 'login') {
        const isLog = act.includes('LOGIN') || act.includes('SIGNIN') || act.includes('AUTH') || cat === 'login';
        if (!isLog) return false;
      } else if (logFilter === 'admin') {
        const isAdmin = log.source === 'audit' || cat === 'orders' || cat === 'inventory' || cat === 'system';
        if (!isAdmin) return false;
      }

      // Search query
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchesAct = act.toLowerCase().includes(q);
        const matchesDet = det.includes(q);
        const matchesDate = (log.timestamp || '').toLowerCase().includes(q);
        const matchesIp = (log.ip_address || '').toLowerCase().includes(q);
        if (!matchesAct && !matchesDet && !matchesDate && !matchesIp) return false;
      }

      return true;
    });
  }, [logs, logFilter, logSearchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  // Helper for Category Badge & Icon
  const getCategoryBadge = (log) => {
    const act = (log.action || '').toUpperCase();
    const cat = (log.category || '').toLowerCase();

    if (act.includes('PASSWORD') || cat === 'security') {
      return { label: 'Security', icon: 'shield-lock-fill', color: '#059669', bg: isDarkMode ? '#132A26' : '#ECFDF5' };
    }
    if (act.includes('EMAIL')) {
      return { label: 'Email', icon: 'envelope-at-fill', color: '#0284C7', bg: isDarkMode ? '#132838' : '#F0F9FF' };
    }
    if (act.includes('LOGIN') || cat === 'login') {
      return { label: 'Sign-in', icon: 'box-arrow-in-right', color: '#10B981', bg: isDarkMode ? '#142A22' : '#F0FDF4' };
    }
    if (act.includes('PROFILE') || act.includes('AVATAR') || cat === 'profile') {
      return { label: 'Profile', icon: 'person-badge-fill', color: '#1D4533', bg: isDarkMode ? '#1A2E26' : '#E8F0EC' };
    }
    if (cat === 'orders' || act.includes('ORDER')) {
      return { label: 'Orders', icon: 'receipt', color: '#2563EB', bg: isDarkMode ? '#1E293B' : '#EFF6FF' };
    }
    if (cat === 'inventory' || act.includes('STOCK')) {
      return { label: 'Inventory', icon: 'box-seam-fill', color: '#D97706', bg: isDarkMode ? '#2D2013' : '#FEF3C7' };
    }
    return { label: log.category || 'System', icon: 'journal-text', color: '#6366F1', bg: isDarkMode ? '#1E1B4B' : '#EEF2FF' };
  };

  // Severity indicator
  const getSeverityBadge = (severity) => {
    const sev = (severity || 'INFO').toUpperCase();
    if (sev === 'CRITICAL' || sev === 'ERROR') {
      return { label: 'Critical', bg: '#FEE2E2', text: '#DC2626' };
    }
    if (sev === 'WARNING') {
      return { label: 'Warning', bg: '#FEF3C7', text: '#D97706' };
    }
    if (sev === 'SUCCESS') {
      return { label: 'Success', bg: '#DCFCE7', text: '#16A34A' };
    }
    return { label: 'Info', bg: isDarkMode ? '#1E2D27' : '#F1F5F9', text: isDarkMode ? '#94A3B8' : '#64748B' };
  };

  // ── Actions ──

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name');
      return;
    }
    setIsSavingProfile(true);
    setProfileSuccessMsg('');
    try {
      const res = await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      if (res?.success !== false) {
        setProfileSuccessMsg('Profile details saved successfully.');
        showToast('✓ Profile updated successfully');
        fetchLogs();
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      } else {
        showToast(res.error || 'Failed to update profile');
      }
    } catch (_e) {
      showToast('Error updating profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const res = await pickImageFromFile({ aspect: [1, 1], quality: 0.85 });
      if (res?.success && res.uri) {
        await updateProfile({ avatar: res.uri });
        showToast('✓ Profile photo updated successfully');
        fetchLogs();
      } else if (res?.error && res.error !== 'Selection cancelled') {
        showToast(res.error);
      }
    } catch (_e) {
      showToast('Failed to select image');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      await updateProfile({ avatar: null });
      showToast('Avatar removed');
      fetchLogs();
    } catch (_e) {
      showToast('Failed to remove avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangeEmail = async () => {
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailErrorMsg('Please enter a valid new email address.');
      return;
    }
    if (cleanEmail === (currentUser.email || '').toLowerCase()) {
      setEmailErrorMsg('New email cannot be identical to your current email.');
      return;
    }
    if (!emailCurrentPassword) {
      setEmailErrorMsg('Please enter your current password to authorize email change.');
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
        setEmailSuccessMsg(`Email successfully updated to ${cleanEmail}.`);
        showToast('✓ Email address changed successfully');
        setNewEmail('');
        setEmailCurrentPassword('');
        fetchLogs();
      } else {
        setEmailErrorMsg(res.error || 'Failed to update email address.');
      }
    } catch (_e) {
      setEmailErrorMsg('Error changing email. Please check your password.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdCurrentPassword) {
      setPwdErrorMsg('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setPwdErrorMsg('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === pwdCurrentPassword) {
      setPwdErrorMsg('New password cannot be identical to your current password.');
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
        setPwdSuccessMsg('Password updated successfully. Security audit log dispatched.');
        showToast('✓ Password updated successfully');
        setPwdCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchLogs();
      } else {
        setPwdErrorMsg(res.error || 'Current password appears incorrect.');
      }
    } catch (_e) {
      setPwdErrorMsg('Error updating password. Verification failed.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs to export');
      return;
    }
    const headers = ['Event', 'Category', 'Date', 'Time', 'Details', 'IP Address', 'Severity'];
    const rows = filteredLogs.map((l) => {
      const ts = parseTimestamp(l.timestamp);
      return [
        `"${formatActionTitle(l.action).replace(/"/g, '""')}"`,
        `"${(l.category || '').replace(/"/g, '""')}"`,
        `"${ts.date}"`,
        `"${ts.time}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.ip_address || '127.0.0.1'}"`,
        `"${l.severity || 'INFO'}"`,
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mototrack_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Audit logs exported to CSV');
  };

  // Color tokens
  const cardBg = isDarkMode ? tokens.bgElevated || '#131A17' : '#FFFFFF';
  const cardBorder = isDarkMode ? tokens.borderInput || '#23322B' : '#E2E8F0';
  const textPrimary = isDarkMode ? tokens.textPrimary || '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? tokens.textMuted || '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#17221E' : '#FFFFFF';
  const inputBorder = isDarkMode ? '#2D4037' : '#E2E8F0';
  const brandGreen = isDarkMode ? tokens.accentBrand || '#34D399' : '#1D4533';

  return (
    <View style={styles.container}>
      {/* ─── 1. PROFILE SUMMARY HERO CARD ─── */}
      <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.heroLayout}>
          {/* Left Avatar & Identity */}
          <View style={styles.heroLeft}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarBox, { backgroundColor: isDarkMode ? '#1E2D27' : '#F1F5F9' }]}>
                {currentUser?.avatar &&
                !currentUser.avatar.includes('photo-1535713875002') &&
                !currentUser.avatar.includes('photo-1534528741775') &&
                !currentUser.avatar.includes('ui-avatars.com') ? (
                  <Image source={{ uri: currentUser.avatar || currentUser.photoUri }} style={styles.avatarImg} />
                ) : (
                  <BootstrapIcon name="person-circle" size={46} color={brandGreen} />
                )}
              </View>
              <View style={styles.avatarOnlineDot} />
            </View>

            <View style={{ flex: 1, minWidth: 200 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.heroName, { color: textPrimary }]}>
                  {currentUser?.name || currentUser?.fullName || 'Store Administrator'}
                </Text>
                <View style={styles.roleBadge}>
                  <BootstrapIcon name="shield-lock-fill" size={11} color="#065F46" />
                  <Text style={styles.roleBadgeText}>Store Administrator</Text>
                </View>
                <View style={[styles.sessionBadge, { backgroundColor: isDarkMode ? '#132A26' : '#ECFDF5' }]}>
                  <BootstrapIcon name="check-circle-fill" size={11} color="#10B981" />
                  <Text style={[styles.sessionBadgeText, { color: '#059669' }]}>Verified Session</Text>
                </View>
              </View>

              <Text style={[styles.heroEmail, { color: textMuted }]}>{currentUser?.email || 'admin@mototrack.ph'}</Text>

              {/* Grouped Profile Photo Actions */}
              <View style={styles.avatarBtnRow}>
                <TouchableOpacity
                  style={[styles.photoActionBtn, { borderColor: cardBorder, backgroundColor: isDarkMode ? '#1B2621' : '#F8FAFC' }]}
                  onPress={handlePickAvatar}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.75}
                >
                  {isUploadingAvatar ? (
                    <ActivityIndicator size="small" color={brandGreen} />
                  ) : (
                    <>
                      <BootstrapIcon name="camera-fill" size={12} color={isDarkMode ? brandGreen : '#1D4533'} />
                      <Text style={[styles.photoActionBtnText, { color: isDarkMode ? brandGreen : '#1D4533' }]}>
                        Upload Photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {currentUser?.avatar ? (
                  <TouchableOpacity
                    style={[styles.photoActionBtn, { borderColor: '#FEE2E2', backgroundColor: isDarkMode ? '#2D1616' : '#FEF2F2' }]}
                    onPress={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                    activeOpacity={0.75}
                  >
                    <BootstrapIcon name="trash" size={12} color="#DC2626" />
                    <Text style={[styles.photoActionBtnText, { color: '#DC2626' }]}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Right Status Indicators */}
          <View style={[styles.heroRightStats, { borderColor: cardBorder, backgroundColor: isDarkMode ? '#0F1412' : '#F8FAFC' }]}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: brandGreen }]}>{logs.length}</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Audit Logs</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: cardBorder }]} />
            <View style={styles.statCell}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={[styles.statValue, { color: '#059669', fontSize: 13.5 }]}>Active</Text>
              </View>
              <Text style={[styles.statLabel, { color: textMuted }]}>Security Status</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: cardBorder }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: textPrimary, fontSize: 13.5 }]}>Supabase</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Auth Sync</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─── 2. TAB NAVIGATION ─── */}
      <View style={styles.tabBarWrapper}>
        <View style={[styles.tabBar, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'profile' && styles.tabBtnActive]}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="person-badge-fill"
              size={14}
              color={activeTab === 'profile' ? '#FFFFFF' : textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'profile' && styles.tabBtnTextActive]}>
              Profile Information
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'security' && styles.tabBtnActive]}
            onPress={() => setActiveTab('security')}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="shield-lock-fill"
              size={14}
              color={activeTab === 'security' ? '#FFFFFF' : textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'security' && styles.tabBtnTextActive]}>
              Security & Credentials
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'logs' && styles.tabBtnActive]}
            onPress={() => setActiveTab('logs')}
            activeOpacity={0.85}
          >
            <BootstrapIcon
              name="journal-text"
              size={14}
              color={activeTab === 'logs' ? '#FFFFFF' : textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'logs' && styles.tabBtnTextActive]}>
              Activity Logs ({logs.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── 3. TAB 1: PROFILE INFORMATION ─── */}
      {activeTab === 'profile' && (
        <View style={styles.tabContent}>
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.panelIconCircle, { backgroundColor: isDarkMode ? '#1E2D27' : '#E8F0EC' }]}>
                  <BootstrapIcon name="person-lines-fill" size={16} color={brandGreen} />
                </View>
                <View>
                  <Text style={[styles.panelTitle, { color: textPrimary }]}>Administrator Identity</Text>
                  <Text style={[styles.panelSubtitle, { color: textMuted }]}>
                    Update your full name, contact phone number, and administrator profile details.
                  </Text>
                </View>
              </View>
            </View>

            {profileSuccessMsg ? (
              <View style={styles.bannerSuccess}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                <Text style={styles.bannerSuccessText}>{profileSuccessMsg}</Text>
              </View>
            ) : null}

            {/* Responsive Form Grid */}
            <View style={styles.formRow}>
              {/* Left Column: Personal Meta */}
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Full Name *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="person" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="e.g. Jherico Maurin"
                      placeholderTextColor={textMuted}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Contact Phone</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="telephone" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="e.g. 0917 123 4567"
                      placeholderTextColor={textMuted}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Right Column: Account & Security Overview */}
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Primary Login Email</Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      { backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC', borderColor: inputBorder },
                    ]}
                  >
                    <BootstrapIcon name="envelope" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary, fontWeight: '600' }]}
                      value={currentUser?.email || 'admin@mototrack.ph'}
                      editable={false}
                    />
                    <TouchableOpacity
                      onPress={() => setActiveTab('security')}
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: brandGreen }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Administrative Role</Text>
                  <View
                    style={[
                      styles.fieldInputWrap,
                      { backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC', borderColor: inputBorder },
                    ]}
                  >
                    <BootstrapIcon name="shield-lock" size={14} color={brandGreen} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary, fontWeight: '600' }]}
                      value="Store Administrator (Full Permissions)"
                      editable={false}
                    />
                    <View style={styles.readOnlyLockPill}>
                      <BootstrapIcon name="lock-fill" size={10} color="#64748B" />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B' }}>Fixed</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Footer with Save Profile */}
            <View style={[styles.panelFooter, { borderTopColor: cardBorder }]}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                activeOpacity={0.85}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="check2" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Save Profile Details</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ─── 4. TAB 2: SECURITY & CREDENTIALS ─── */}
      {activeTab === 'security' && (
        <View style={styles.tabContent}>
          {/* Card 1: Change Email Address */}
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder, marginBottom: 18 }]}>
            <View style={styles.panelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.panelIconCircle, { backgroundColor: isDarkMode ? '#132838' : '#F0F9FF' }]}>
                  <BootstrapIcon name="envelope-at-fill" size={16} color="#0284C7" />
                </View>
                <View>
                  <Text style={[styles.panelTitle, { color: textPrimary }]}>Update Primary Email</Text>
                  <Text style={[styles.panelSubtitle, { color: textMuted }]}>
                    Current login email: <Text style={{ fontWeight: '700', color: textPrimary }}>{currentUser?.email}</Text>
                  </Text>
                </View>
              </View>
            </View>

            {emailSuccessMsg ? (
              <View style={styles.bannerSuccess}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                <Text style={styles.bannerSuccessText}>{emailSuccessMsg}</Text>
              </View>
            ) : null}
            {emailErrorMsg ? (
              <View style={styles.bannerError}>
                <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                <Text style={styles.bannerErrorText}>{emailErrorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>New Email Address *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="envelope" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="e.g. jherico.admin@mototrack.ph"
                      placeholderTextColor={textMuted}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current Password to Authorize *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="lock" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Enter current password"
                      placeholderTextColor={textMuted}
                      value={emailCurrentPassword}
                      onChangeText={setEmailCurrentPassword}
                      secureTextEntry={!showEmailCurrentPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowEmailCurrentPwd((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name={showEmailCurrentPwd ? 'eye-slash' : 'eye'}
                        size={14}
                        color={textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.panelFooter, { borderTopColor: cardBorder }]}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#0284C7' }]}
                onPress={handleChangeEmail}
                disabled={isChangingEmail}
                activeOpacity={0.85}
              >
                {isChangingEmail ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="arrow-repeat" size={14} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Update Email Address</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Card 2: Change Password */}
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.panelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.panelIconCircle, { backgroundColor: isDarkMode ? '#1E2D27' : '#ECFDF5' }]}>
                  <BootstrapIcon name="key-fill" size={16} color={brandGreen} />
                </View>
                <View>
                  <Text style={[styles.panelTitle, { color: textPrimary }]}>Change Password</Text>
                  <Text style={[styles.panelSubtitle, { color: textMuted }]}>
                    Strengthen your administrative account security with a robust password.
                  </Text>
                </View>
              </View>
            </View>

            {pwdSuccessMsg ? (
              <View style={styles.bannerSuccess}>
                <BootstrapIcon name="check-circle-fill" size={14} color="#059669" />
                <Text style={styles.bannerSuccessText}>{pwdSuccessMsg}</Text>
              </View>
            ) : null}
            {pwdErrorMsg ? (
              <View style={styles.bannerError}>
                <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                <Text style={styles.bannerErrorText}>{pwdErrorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.formRow}>
              {/* Current Password Field (Full Width) */}
              <View style={{ width: '100%' }}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Current Password *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="lock" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Enter current password"
                      placeholderTextColor={textMuted}
                      value={pwdCurrentPassword}
                      onChangeText={setPwdCurrentPassword}
                      secureTextEntry={!showPwdCurrent}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPwdCurrent((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon name={showPwdCurrent ? 'eye-slash' : 'eye'} size={14} color={textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 2-Column: New & Confirm Password */}
              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>New Password *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="key" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Min. 8 characters"
                      placeholderTextColor={textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPwd((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon name={showNewPwd ? 'eye-slash' : 'eye'} size={14} color={textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.formCol}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: textPrimary }]}>Confirm New Password *</Text>
                  <View style={[styles.fieldInputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <BootstrapIcon name="check2-circle" size={14} color={textMuted} style={styles.fieldInputIcon} />
                    <TextInput
                      style={[styles.fieldTextInput, { color: textPrimary }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={textMuted}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPwd}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPwd((p) => !p)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <BootstrapIcon
                        name={showConfirmPwd ? 'eye-slash' : 'eye'}
                        size={14}
                        color={textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Password Strength Indicator */}
              {newPassword ? (
                <View style={{ width: '100%' }}>
                  <View style={[styles.strengthBox, { backgroundColor: isDarkMode ? '#131A17' : '#F8FAFC', borderColor: inputBorder }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted }}>Password Strength:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: pwdStrength?.color || '#DC2626' }}>
                        {pwdStrength?.label || 'Weak'}
                      </Text>
                    </View>

                    <View style={[styles.strengthTrack, { backgroundColor: isDarkMode ? '#23322B' : '#E2E8F0' }]}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: `${pwdStrength?.score || 15}%`,
                            backgroundColor: pwdStrength?.color || '#DC2626',
                          },
                        ]}
                      />
                    </View>

                    {/* Requirements Pills */}
                    <View style={styles.reqGrid}>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.minLength ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.minLength ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.minLength ? textPrimary : textMuted }]}>
                          8+ characters
                        </Text>
                      </View>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.hasUppercase ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.hasUppercase ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.hasUppercase ? textPrimary : textMuted }]}>
                          Uppercase letter
                        </Text>
                      </View>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.hasLowercase ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.hasLowercase ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.hasLowercase ? textPrimary : textMuted }]}>
                          Lowercase letter
                        </Text>
                      </View>
                      <View style={styles.reqItem}>
                        <BootstrapIcon
                          name={pwdStrength?.hasNumber ? 'check-circle-fill' : 'circle'}
                          size={11}
                          color={pwdStrength?.hasNumber ? '#10B981' : textMuted}
                        />
                        <Text style={[styles.reqText, { color: pwdStrength?.hasNumber ? textPrimary : textMuted }]}>
                          Number
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.panelFooter, { borderTopColor: cardBorder }]}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                activeOpacity={0.85}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <BootstrapIcon name="shield-check" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ─── 5. TAB 3: ACTIVITY & AUDIT LOGS ─── */}
      {activeTab === 'logs' && (
        <View style={styles.tabContent}>
          <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: cardBorder, overflow: 'visible' }]}>
            {/* Header & Filter Toolbar */}
            <View style={[styles.toolbarBox, { position: 'relative', zIndex: 100 }]}>
              {/* Search Field */}
              <View style={[styles.searchWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <BootstrapIcon name="search" size={13} color={textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchField, { color: textPrimary }]}
                  placeholder="Search logs by action, description, or IP..."
                  placeholderTextColor={textMuted}
                  value={logSearchQuery}
                  onChangeText={setLogSearchQuery}
                />
                {logSearchQuery ? (
                  <TouchableOpacity onPress={() => setLogSearchQuery('')} style={{ padding: 4 }}>
                    <BootstrapIcon name="x-circle-fill" size={13} color={textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Category Filter Dropdown */}
              <View ref={filterDropdownRef} style={styles.filterDropdownContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterDropdownBtn,
                    {
                      backgroundColor:
                        logFilter !== 'all'
                          ? isDarkMode
                            ? '#1E3A2F'
                            : '#E8F5EE'
                          : isDarkMode
                            ? '#17221E'
                            : '#FFFFFF',
                      borderColor: isFilterDropdownOpen
                        ? brandGreen
                        : logFilter !== 'all'
                          ? brandGreen
                          : inputBorder,
                    },
                  ]}
                  onPress={() => setIsFilterDropdownOpen((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon
                    name={activeFilterOption.key === 'all' ? 'funnel-fill' : activeFilterOption.icon}
                    size={12}
                    color={logFilter !== 'all' ? brandGreen : textMuted}
                  />
                  <Text
                    style={[
                      styles.filterDropdownBtnText,
                      {
                        color:
                          logFilter !== 'all'
                            ? isDarkMode
                              ? '#4DB896'
                              : '#1D4533'
                            : textPrimary,
                        fontWeight: logFilter !== 'all' ? '700' : '600',
                      },
                    ]}
                  >
                    {activeFilterOption.label}
                  </Text>
                  <View
                    style={[
                      styles.filterCountBadge,
                      {
                        backgroundColor:
                          logFilter !== 'all'
                            ? isDarkMode
                              ? 'rgba(77, 184, 150, 0.25)'
                              : '#D1FAE5'
                            : isDarkMode
                              ? '#1F2B26'
                              : '#F1F5F9',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountBadgeText,
                        {
                          color:
                            logFilter !== 'all'
                              ? isDarkMode
                                ? '#6EE7B7'
                                : '#065F46'
                              : textMuted,
                        },
                      ]}
                    >
                      {categoryCounts[activeFilterOption.key] || 0}
                    </Text>
                  </View>
                  <BootstrapIcon
                    name={isFilterDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={11}
                    color={textMuted}
                  />
                </TouchableOpacity>

                {/* Dropdown Menu Popover */}
                {isFilterDropdownOpen && (
                  <View
                    style={[
                      styles.filterDropdownMenu,
                      {
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        boxShadow: isDarkMode
                          ? '0 10px 25px rgba(0, 0, 0, 0.5)'
                          : '0 8px 24px rgba(15, 23, 42, 0.12)',
                      },
                    ]}
                  >
                    <View style={[styles.filterDropdownHeader, { borderBottomColor: cardBorder }]}>
                      <Text style={[styles.filterDropdownHeaderTitle, { color: textMuted }]}>
                        FILTER BY CATEGORY
                      </Text>
                      {logFilter !== 'all' && (
                        <TouchableOpacity
                          onPress={() => {
                            setLogFilter('all');
                            setIsFilterDropdownOpen(false);
                          }}
                          style={{ paddingHorizontal: 4, paddingVertical: 2 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: brandGreen }}>Reset</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ padding: 4 }}>
                      {LOG_FILTER_OPTIONS.map((f) => {
                        const isSel = logFilter === f.key;
                        const count = categoryCounts[f.key] || 0;
                        return (
                          <TouchableOpacity
                            key={f.key}
                            style={[
                              styles.filterDropdownItem,
                              {
                                backgroundColor: isSel
                                  ? isDarkMode
                                    ? '#1E3A2F'
                                    : '#E8F5EE'
                                  : 'transparent',
                              },
                            ]}
                            onPress={() => {
                              setLogFilter(f.key);
                              setIsFilterDropdownOpen(false);
                            }}
                            activeOpacity={0.75}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <View
                                style={[
                                  styles.filterItemIconCircle,
                                  {
                                    backgroundColor: isDarkMode ? '#17221E' : '#F1F5F9',
                                  },
                                ]}
                              >
                                <BootstrapIcon
                                  name={f.icon}
                                  size={12}
                                  color={isSel ? brandGreen : textMuted}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.filterDropdownItemText,
                                  {
                                    color: isSel
                                      ? isDarkMode
                                        ? '#4DB896'
                                        : '#1D4533'
                                      : textPrimary,
                                    fontWeight: isSel ? '700' : '500',
                                  },
                                ]}
                              >
                                {f.label}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View
                                style={[
                                  styles.filterItemBadge,
                                  {
                                    backgroundColor: isSel
                                      ? isDarkMode
                                        ? 'rgba(77, 184, 150, 0.2)'
                                        : '#D1FAE5'
                                      : isDarkMode
                                        ? '#1E2D27'
                                        : '#F1F5F9',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.filterItemBadgeText,
                                    {
                                      color: isSel
                                        ? isDarkMode
                                          ? '#6EE7B7'
                                          : '#065F46'
                                        : textMuted,
                                    },
                                  ]}
                                >
                                  {count}
                                </Text>
                              </View>
                              {isSel ? (
                                <BootstrapIcon name="check-lg" size={12} color={brandGreen} />
                              ) : (
                                <View style={{ width: 12 }} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* Action Buttons: Refresh & Export CSV */}
              <View style={styles.toolbarRightActions}>
                <TouchableOpacity
                  style={[styles.outlineActionBtn, { borderColor: inputBorder, backgroundColor: isDarkMode ? '#17221E' : '#FFFFFF' }]}
                  onPress={fetchLogs}
                  disabled={isLoadingLogs}
                  activeOpacity={0.75}
                >
                  <BootstrapIcon
                    name="arrow-clockwise"
                    size={13}
                    color={textPrimary}
                    style={isLoadingLogs ? { transform: [{ rotate: '45deg' }] } : {}}
                  />
                  <Text style={[styles.outlineActionBtnText, { color: textPrimary }]}>Refresh</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.outlineActionBtn, { borderColor: '#107C41', backgroundColor: isDarkMode ? '#1F6B52' : '#107C41' }]}
                  onPress={handleExportCSV}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="file-earmark-excel-fill" size={13} color="#FFFFFF" />
                  <Text style={[styles.outlineActionBtnText, { color: '#FFFFFF' }]}>Export CSV</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── READABLE AUDIT-LOG TABLE ─── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
              <View style={[styles.tableContainer, { minWidth: isDesktop ? 960 : 860 }]}>
                {/* Table Header */}
                <View style={[styles.tableHeadRow, { backgroundColor: isDarkMode ? '#0F1412' : '#F8FAFC', borderBottomColor: cardBorder }]}>
                  <Text style={[styles.tableHeadCell, { flex: 2.2, minWidth: 200 }]}>Event & Operator</Text>
                  <Text style={[styles.tableHeadCell, { flex: 1.1, minWidth: 110 }]}>Category</Text>
                  <Text style={[styles.tableHeadCell, { flex: 1.5, minWidth: 140 }]}>Date & Time</Text>
                  <Text style={[styles.tableHeadCell, { flex: 3.2, minWidth: 280 }]}>Details & Metadata</Text>
                  <Text style={[styles.tableHeadCell, { flex: 1, minWidth: 90, textAlign: 'center' }]}>Status</Text>
                </View>

                {/* Table Rows or Skeletons */}
                {isLoadingLogs ? (
                  // Loading Skeletons
                  [1, 2, 3, 4, 5].map((k) => (
                    <View key={k} style={[styles.tableBodyRow, { borderBottomColor: cardBorder }]}>
                      <View style={{ flex: 2.2, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.skeletonCircle, { backgroundColor: isDarkMode ? '#1E2D27' : '#E2E8F0' }]} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={[styles.skeletonBar, { width: '70%', backgroundColor: isDarkMode ? '#1E2D27' : '#E2E8F0' }]} />
                          <View style={[styles.skeletonBar, { width: '40%', height: 10, backgroundColor: isDarkMode ? '#17221E' : '#F1F5F9' }]} />
                        </View>
                      </View>
                      <View style={{ flex: 1.1, minWidth: 110 }}>
                        <View style={[styles.skeletonBar, { width: 70, height: 22, borderRadius: 6, backgroundColor: isDarkMode ? '#1E2D27' : '#E2E8F0' }]} />
                      </View>
                      <View style={{ flex: 1.5, minWidth: 140, gap: 4 }}>
                        <View style={[styles.skeletonBar, { width: 80, backgroundColor: isDarkMode ? '#1E2D27' : '#E2E8F0' }]} />
                        <View style={[styles.skeletonBar, { width: 60, height: 10, backgroundColor: isDarkMode ? '#17221E' : '#F1F5F9' }]} />
                      </View>
                      <View style={{ flex: 3.2, minWidth: 280 }}>
                        <View style={[styles.skeletonBar, { width: '90%', backgroundColor: isDarkMode ? '#1E2D27' : '#E2E8F0' }]} />
                      </View>
                      <View style={{ flex: 1, minWidth: 90, alignItems: 'center' }}>
                        <View style={[styles.skeletonBar, { width: 50, height: 20, borderRadius: 6, backgroundColor: isDarkMode ? '#1E2D27' : '#E2E8F0' }]} />
                      </View>
                    </View>
                  ))
                ) : paginatedLogs.length === 0 ? (
                  <View style={styles.emptyTableState}>
                    <BootstrapIcon name="journal-x" size={38} color={textMuted} />
                    <Text style={[styles.emptyTableTitle, { color: textPrimary }]}>No Activity Logs Found</Text>
                    <Text style={[styles.emptyTableSub, { color: textMuted }]}>
                      {logSearchQuery
                        ? `No audit events matched "${logSearchQuery}". Try clearing search keywords.`
                        : 'No events found in this category. All operations are logged automatically.'}
                    </Text>
                    {logSearchQuery ? (
                      <TouchableOpacity
                        style={[styles.clearFilterBtn, { borderColor: cardBorder }]}
                        onPress={() => setLogSearchQuery('')}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen }}>Clear Search</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  paginatedLogs.map((log, idx) => {
                    const catCfg = getCategoryBadge(log);
                    const sevCfg = getSeverityBadge(log.severity);
                    const ts = parseTimestamp(log.timestamp);
                    const isLast = idx === paginatedLogs.length - 1;

                    return (
                      <View
                        key={log.id || `log-${idx}`}
                        style={[
                          styles.tableBodyRow,
                          {
                            borderBottomColor: isDarkMode ? '#1F2925' : '#F1F5F9',
                            borderBottomWidth: isLast ? 0 : 1,
                          },
                        ]}
                      >
                        {/* 1. Event & Operator */}
                        <View style={{ flex: 2.2, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.eventIconCircle, { backgroundColor: catCfg.bg }]}>
                            <BootstrapIcon name={catCfg.icon} size={13} color={catCfg.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.eventActionTitle, { color: textPrimary }]} numberOfLines={1}>
                              {formatActionTitle(log.action)}
                            </Text>
                            <Text style={[styles.eventMetaSub, { color: textMuted }]} numberOfLines={1}>
                              {log.ip_address || '127.0.0.1'} · {log.user_agent || 'Console'}
                            </Text>
                          </View>
                        </View>

                        {/* 2. Category */}
                        <View style={{ flex: 1.1, minWidth: 110 }}>
                          <View style={[styles.tableCategoryPill, { backgroundColor: catCfg.bg }]}>
                            <Text style={[styles.tableCategoryPillText, { color: catCfg.color }]}>
                              {catCfg.label}
                            </Text>
                          </View>
                        </View>

                        {/* 3. Date & Time */}
                        <View style={{ flex: 1.5, minWidth: 140 }}>
                          <Text style={[styles.tableDatePrimary, { color: textPrimary }]}>{ts.date}</Text>
                          <Text style={[styles.tableTimeSecondary, { color: textMuted }]}>{ts.time}</Text>
                        </View>

                        {/* 4. Details */}
                        <View style={{ flex: 3.2, minWidth: 280, paddingRight: 10 }}>
                          <Text style={[styles.tableDetailsText, { color: textPrimary }]} numberOfLines={2}>
                            {log.details || '—'}
                          </Text>
                          {log.target ? (
                            <Text style={{ fontSize: 11, color: brandGreen, marginTop: 2, fontWeight: '600' }} numberOfLines={1}>
                              Target: {log.target}
                            </Text>
                          ) : null}
                        </View>

                        {/* 5. Status / Severity */}
                        <View style={{ flex: 1, minWidth: 90, alignItems: 'center' }}>
                          <View style={[styles.tableSeverityPill, { backgroundColor: sevCfg.bg }]}>
                            <Text style={[styles.tableSeverityPillText, { color: sevCfg.text }]}>
                              {sevCfg.label}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* Pagination Controls */}
            <View style={[styles.paginationBar, { borderTopColor: cardBorder }]}>
              <Text style={[styles.paginationCountText, { color: textMuted }]}>
                Showing{' '}
                <Text style={{ fontWeight: '700', color: textPrimary }}>
                  {filteredLogs.length === 0 ? 0 : (currentPage - 1) * LOGS_PER_PAGE + 1}
                </Text>{' '}
                to{' '}
                <Text style={{ fontWeight: '700', color: textPrimary }}>
                  {Math.min(currentPage * LOGS_PER_PAGE, filteredLogs.length)}
                </Text>{' '}
                of <Text style={{ fontWeight: '700', color: textPrimary }}>{filteredLogs.length}</Text> events
              </Text>

              <View style={styles.paginationNavRow}>
                <TouchableOpacity
                  style={[
                    styles.pageNavBtn,
                    { borderColor: cardBorder },
                    currentPage <= 1 && styles.pageNavBtnDisabled,
                  ]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="chevron-left" size={12} color={currentPage <= 1 ? '#94A3B8' : textPrimary} />
                  <Text style={[styles.pageNavBtnText, { color: currentPage <= 1 ? '#94A3B8' : textPrimary }]}>
                    Prev
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pNum = i + 1;
                    // Only show first, last, and window around current
                    if (totalPages > 5 && Math.abs(pNum - currentPage) > 1 && pNum !== 1 && pNum !== totalPages) {
                      if (pNum === 2 || pNum === totalPages - 1) {
                        return (
                          <Text key={pNum} style={{ color: textMuted, paddingHorizontal: 2, fontSize: 12 }}>
                            …
                          </Text>
                        );
                      }
                      return null;
                    }
                    const isCur = pNum === currentPage;
                    return (
                      <TouchableOpacity
                        key={pNum}
                        style={[
                          styles.pageNumBtn,
                          { borderColor: cardBorder },
                          isCur && { backgroundColor: '#1D4533', borderColor: '#1D4533' },
                        ]}
                        onPress={() => setCurrentPage(pNum)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pageNumText, { color: isCur ? '#FFFFFF' : textPrimary }]}>
                          {pNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[
                    styles.pageNavBtn,
                    { borderColor: cardBorder },
                    currentPage >= totalPages && styles.pageNavBtnDisabled,
                  ]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pageNavBtnText,
                      { color: currentPage >= totalPages ? '#94A3B8' : textPrimary },
                    ]}
                  >
                    Next
                  </Text>
                  <BootstrapIcon
                    name="chevron-right"
                    size={12}
                    color={currentPage >= totalPages ? '#94A3B8' : textPrimary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },

  // ─── 1. HERO CARD ───
  heroCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 280,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarBox: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroEmail: {
    fontSize: 12.5,
    marginTop: 2,
  },
  avatarBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 9,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    cursor: 'pointer',
  },
  photoActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  heroRightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statCell: {
    alignItems: 'center',
    minWidth: 70,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
  },

  // ─── 2. TAB BAR ───
  tabBarWrapper: {
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 5,
    borderRadius: 11,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    cursor: 'pointer',
  },
  tabBtnActive: {
    backgroundColor: '#1D4533',
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },

  // ─── 3. PANELS & CARDS ───
  tabContent: {
    width: '100%',
  },
  panelCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  panelHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  panelIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  panelSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  panelFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 16,
  },
  formCol: {
    flex: 1,
    minWidth: 260,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    height: 42,
  },
  fieldInputIcon: {
    marginRight: 8,
  },
  fieldTextInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    outlineStyle: 'none',
  },
  readOnlyLockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eyeBtn: {
    padding: 6,
    cursor: 'pointer',
  },

  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 1,
    cursor: 'pointer',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
  },

  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1D4533',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    cursor: 'pointer',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },

  bannerSuccess: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  bannerError: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },

  strengthBox: {
    marginTop: 6,
    marginBottom: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  strengthTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
  },
  reqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqText: {
    fontSize: 11,
  },

  // ─── 4. LOGS TOOLBAR ───
  toolbarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    flexWrap: 'wrap',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 36,
    minWidth: 260,
    flex: 1,
  },
  searchField: {
    flex: 1,
    fontSize: 12,
    outlineStyle: 'none',
  },
  filterDropdownContainer: {
    position: 'relative',
    zIndex: 110,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    cursor: 'pointer',
  },
  filterDropdownBtnText: {
    fontSize: 12,
  },
  filterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  filterCountBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    width: 230,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 200,
    overflow: 'hidden',
  },
  filterDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  filterDropdownHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    cursor: 'pointer',
  },
  filterItemIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdownItemText: {
    fontSize: 12,
  },
  filterItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  filterItemBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  toolbarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 'auto',
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    cursor: 'pointer',
  },
  outlineActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  // ─── 5. LOGS TABLE ───
  tableContainer: {
    width: '100%',
  },
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableHeadCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  eventIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventActionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  eventMetaSub: {
    fontSize: 11,
    marginTop: 1,
  },
  tableCategoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  tableCategoryPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  tableDatePrimary: {
    fontSize: 12,
    fontWeight: '700',
  },
  tableTimeSecondary: {
    fontSize: 10.5,
    marginTop: 1,
  },
  tableDetailsText: {
    fontSize: 12,
    lineHeight: 16,
  },
  tableSeverityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tableSeverityPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // ─── 6. SKELETONS & EMPTY STATES ───
  skeletonCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 4,
  },
  emptyTableState: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
  },
  emptyTableTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyTableSub: {
    fontSize: 12,
    marginTop: 3,
    textAlign: 'center',
    maxWidth: 380,
  },
  clearFilterBtn: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },

  // ─── 7. PAGINATION ───
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 10,
  },
  paginationCountText: {
    fontSize: 12,
  },
  paginationNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 6,
    borderWidth: 1,
    cursor: 'pointer',
  },
  pageNavBtnDisabled: {
    opacity: 0.45,
    cursor: 'default',
  },
  pageNavBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  pageNumBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  pageNumText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
