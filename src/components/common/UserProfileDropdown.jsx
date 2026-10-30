import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  TextInput,
} from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import ConfirmModal from '../modals/ConfirmModal.jsx';
import CompanyInfoModal from '../modals/CompanyInfoModal.jsx';
import { ANDROID_TOP_INSET } from '../../utils/safeArea.js';
import { appStorage } from '../../services/system/storageAdapter.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';

export default function UserProfileDropdown({
  currentUser,
  isOpen,
  onClose,
  onNavigateToProfile,
  onNavigateToTrack,
  onNavigateToSettings,
  onNavigateToNotifications,
  onNavigateToAdmin,
  onLogout,
  onNavigateToDashboard,
  onNavigateToOrders,
  onNavigateToWishlist,
  onNavigateToScreen,
  isMobile = false,
  align = 'right',
  topOffset,
  currentScreen,
  showDashboard = false,
  isDark,
  onToggleDarkMode,
}) {
  const dropdownRef = useRef(null);
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'settings_privacy'
  const [hoveredItem, setHoveredItem] = useState(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isDisplayModalOpen, setIsDisplayModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English (US)');
  const [isPrivacyCheckupOpen, setIsPrivacyCheckupOpen] = useState(false);
  const [isPrivacyCenterOpen, setIsPrivacyCenterOpen] = useState(false);
  const [isContentPrefOpen, setIsContentPrefOpen] = useState(false);
  const [highLegibility, setHighLegibility] = useState(true);

  // Global Theme Context hook
  const themeContext = useTheme();
  let wishlistCount = 0;
  try {
    const wlCtx = useWishlist();
    wishlistCount = wlCtx?.wishlistCount || 0;
  } catch (_e) {}

  // Internal theme state fallback if isDark is not passed as a controlled prop
  const [internalDarkMode, setInternalDarkMode] = useState(() => {
    try {
      const saved = appStorage.getItem('mototrack_customer_dark_mode') || appStorage.getItem('mototrack_theme_mode');
      return saved === 'true' || saved === 'dark';
    } catch (_e) {
      return false;
    }
  });

  const effectiveDarkMode =
    typeof isDark === 'boolean'
      ? isDark
      : themeContext?.isDarkMode !== undefined
        ? themeContext.isDarkMode
        : internalDarkMode;

  const handleToggleDarkMode = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else if (themeContext?.toggleDarkMode) {
      themeContext.toggleDarkMode();
    } else {
      const next = !effectiveDarkMode;
      setInternalDarkMode(next);
      try {
        appStorage.setItem('mototrack_customer_dark_mode', String(next));
        appStorage.setItem('mototrack_theme_mode', next ? 'dark' : 'light');
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.classList.toggle('dark', next);
        }
      } catch (_e) {}
    }
  };

  const theme = {
    isDark: effectiveDarkMode,
    bgCard: effectiveDarkMode ? '#1E293B' : '#FFFFFF',
    border: effectiveDarkMode ? '#334155' : '#E2E8F0',
    bgSub: effectiveDarkMode ? '#0F172A' : '#F8FAFC',
    bgHover: effectiveDarkMode ? '#334155' : '#F1F5F9',
    iconWrapBg: effectiveDarkMode ? '#334155' : '#F1F5F9',
    iconColor: effectiveDarkMode ? '#F8FAFC' : '#0F172A',
    textPrimary: effectiveDarkMode ? '#F8FAFC' : '#0F172A',
    textMuted: effectiveDarkMode ? '#94A3B8' : '#64748B',
    chevronColor: effectiveDarkMode ? '#64748B' : '#94A3B8',
    divider: effectiveDarkMode ? '#334155' : '#E2E8F0',
    inputBg: effectiveDarkMode ? '#0F172A' : '#F8FAFC',
    inputBorder: effectiveDarkMode ? '#334155' : '#CBD5E1',
    btnCancelBg: effectiveDarkMode ? '#334155' : '#E2E8F0',
    btnCancelText: effectiveDarkMode ? '#F8FAFC' : '#0F172A',
    btnSubmitBg: '#EA580C',
    btnSubmitText: '#FFFFFF',
  };

  // Reset to main view whenever dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
      setHoveredItem(null);
    }
  }, [isOpen]);

  // Handle click outside on web to close dropdown & Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!target) return;

      // Ignore clicks on the trigger button (avatar) so it doesn't double toggle
      if (typeof target.closest === 'function' && target.closest('[data-profile-button]')) {
        return;
      }

      // Check whether target is inside the dropdown container
      if (dropdownRef.current) {
        let node = dropdownRef.current;
        if (node && typeof node.contains !== 'function') {
          if (typeof node.getScrollableNode === 'function') {
            node = node.getScrollableNode();
          } else if (typeof node.getNode === 'function') {
            node = node.getNode();
          }
        }
        if (node && typeof node.contains === 'function' && !node.contains(target)) {
          onClose?.();
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }, 40);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  // Support CTRL+B / CMD+B global shortcut on web for "Report a problem"
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
          e.preventDefault();
          setIsReportModalOpen(true);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  if (!currentUser) return null;
  if (
    !isOpen &&
    !isLogoutConfirmOpen &&
    !isHelpModalOpen &&
    !isReportModalOpen &&
    !isDisplayModalOpen &&
    !isLanguageModalOpen &&
    !isPrivacyCheckupOpen &&
    !isPrivacyCenterOpen &&
    !isContentPrefOpen
  ) {
    return null;
  }

  const isAdmin = currentUser?.role === 'admin';

  const isUploadedAvatar = Boolean(
    currentUser?.avatar &&
    typeof currentUser.avatar === 'string' &&
    (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:image'))
  );

  const handleOpenAccountSettings = () => {
    onClose();
    if (onNavigateToSettings) {
      onNavigateToSettings();
    } else if (onNavigateToDashboard) {
      onNavigateToDashboard('settings');
    } else if (onNavigateToProfile) {
      onNavigateToProfile('settings');
    }
  };

  const handleOpenProfile = () => {
    onClose?.();
    if (onNavigateToProfile) {
      onNavigateToProfile('profile');
    } else if (onNavigateToScreen) {
      onNavigateToScreen('profile', { tab: 'profile' });
    } else if (onNavigateToDashboard) {
      onNavigateToDashboard('profile');
    }
  };

  const handleOpenHelp = () => {
    onClose();
    setIsHelpModalOpen(true);
  };

  const handleOpenReport = () => {
    onClose();
    setIsReportModalOpen(true);
  };

  const handleOpenDisplay = () => {
    onClose();
    setIsDisplayModalOpen(true);
  };

  const handleOpenActivityLog = () => {
    onClose();
    if (onNavigateToOrders) {
      onNavigateToOrders();
    } else if (onNavigateToDashboard) {
      onNavigateToDashboard('orders');
    } else if (onNavigateToProfile) {
      onNavigateToProfile('orders');
    }
  };

  const handleSubmitReport = () => {
    if (!reportText.trim()) return;
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setReportText('');
      setIsReportModalOpen(false);
    }, 1400);
  };

  const dropdownContent = currentView === 'settings_privacy' ? (
    /* ═══════════════════════════════════════════════════════
       SUBMENU: SETTINGS & PRIVACY (THEMED)
       ═══════════════════════════════════════════════════════ */
    <View style={styles.submenuContainer}>
      {/* Top Header with Back Arrow and Title */}
      <View style={styles.submenuHeader}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconWrapBg }]}
          onPress={() => setCurrentView('main')}
          activeOpacity={0.7}
          accessibilityLabel="Back to main menu"
        >
          <BootstrapIcon name="arrow-left" size={16} color={theme.iconColor} />
        </TouchableOpacity>
        <Text style={[styles.submenuTitle, { color: theme.textPrimary }]}>Settings & privacy</Text>
      </View>

      {/* List of 6 Items */}
      <View style={styles.menuList}>
        {/* 1. Settings */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenAccountSettings}
          activeOpacity={0.7}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="gear-fill" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Settings</Text>
        </TouchableOpacity>

        {/* 2. Language */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsLanguageModalOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="globe" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Language</Text>
          <BootstrapIcon name="chevron-right" size={15} color={theme.textMuted} />
        </TouchableOpacity>

        {/* 3. Privacy checkup */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsPrivacyCheckupOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="shield-check" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Privacy checkup</Text>
        </TouchableOpacity>

        {/* 4. Privacy Center */}
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: theme.bgHover }]}
          onPress={() => {
            onClose();
            setIsPrivacyCenterOpen(true);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="shield-lock-fill" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Privacy Center</Text>
        </TouchableOpacity>

        {/* 5. Activity log */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenActivityLog}
          activeOpacity={0.7}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="list-task" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Activity log</Text>
        </TouchableOpacity>

        {/* 6. Content preferences */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsContentPrefOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="sliders" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Content preferences</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    /* ═══════════════════════════════════════════════════════
       MAIN MENU VIEW (THEMED)
       ═══════════════════════════════════════════════════════ */
    <>
      {/* User Quick Header - Profile Link */}
      <TouchableOpacity
        style={[
          styles.userProfileCard,
          hoveredItem === 'profile' && { backgroundColor: theme.bgHover },
        ]}
        onPress={handleOpenProfile}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Go to customer profile"
        accessibilityHint="Navigates to your rider and motorcycle profile page"
        {...(Platform.OS === 'web'
          ? {
              onMouseEnter: () => setHoveredItem('profile'),
              onMouseLeave: () => setHoveredItem(null),
            }
          : {})}
      >
        {isUploadedAvatar ? (
          <Image
            source={{ uri: currentUser.avatar || currentUser.photoUri }}
            style={[styles.avatarImg, { borderColor: theme.border, backgroundColor: theme.bgSub }]}
          />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: theme.iconWrapBg, borderColor: theme.border }]}>
            <BootstrapIcon name="person-fill" size={20} color={theme.iconColor} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
            {currentUser.name || currentUser.fullName || 'Rider Account'}
          </Text>
          <Text style={[styles.userSub, { color: theme.textMuted }]} numberOfLines={1}>
            See your profile
          </Text>
        </View>
        <BootstrapIcon name="chevron-right" size={16} color={theme.chevronColor} />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: theme.divider }]} />

      {/* Main Choices Menu */}
      <View style={styles.menuList}>
        {/* 1. Dashboard (Hidden by default for standard web users) */}
        {showDashboard === true && (
          <TouchableOpacity
            style={[
              styles.menuItem,
              hoveredItem === 'dashboard' && { backgroundColor: theme.bgHover },
            ]}
            onPress={() => {
              onClose?.();
              if (onNavigateToDashboard) {
                onNavigateToDashboard('garage');
              } else if (onNavigateToProfile) {
                onNavigateToProfile('garage');
              }
            }}
            activeOpacity={0.7}
            {...(Platform.OS === 'web'
              ? {
                  onMouseEnter: () => setHoveredItem('dashboard'),
                  onMouseLeave: () => setHoveredItem(null),
                }
              : {})}
          >
            <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
              <BootstrapIcon name="speedometer2" size={16} color={theme.iconColor} />
            </View>
            <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Dashboard</Text>
            <BootstrapIcon name="chevron-right" size={16} color={theme.chevronColor} />
          </TouchableOpacity>
        )}

        {/* 2. Settings & privacy */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            hoveredItem === 'settings' && { backgroundColor: theme.bgHover },
          ]}
          onPress={() => setCurrentView('settings_privacy')}
          activeOpacity={0.7}
          {...(Platform.OS === 'web'
            ? {
                onMouseEnter: () => setHoveredItem('settings'),
                onMouseLeave: () => setHoveredItem(null),
              }
            : {})}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="gear-fill" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Settings & privacy</Text>
          <BootstrapIcon name="chevron-right" size={16} color={theme.chevronColor} />
        </TouchableOpacity>

        {/* 3. Help & support */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            hoveredItem === 'help' && { backgroundColor: theme.bgHover },
          ]}
          onPress={handleOpenHelp}
          activeOpacity={0.7}
          {...(Platform.OS === 'web'
            ? {
                onMouseEnter: () => setHoveredItem('help'),
                onMouseLeave: () => setHoveredItem(null),
              }
            : {})}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="question-circle-fill" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Help & support</Text>
          <BootstrapIcon name="chevron-right" size={16} color={theme.chevronColor} />
        </TouchableOpacity>

        {/* 4. Report a problem (CTRL B) */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            hoveredItem === 'report' && { backgroundColor: theme.bgHover },
          ]}
          onPress={handleOpenReport}
          activeOpacity={0.7}
          {...(Platform.OS === 'web'
            ? {
                onMouseEnter: () => setHoveredItem('report'),
                onMouseLeave: () => setHoveredItem(null),
              }
            : {})}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="chat-square-dots-fill" size={16} color={theme.iconColor} />
          </View>
          <View style={styles.textWithSubWrap}>
            <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Report a problem</Text>
            <Text style={[styles.shortcutSub, { color: theme.textMuted }]}>CTRL B</Text>
          </View>
          <BootstrapIcon name="chevron-right" size={16} color={theme.chevronColor} />
        </TouchableOpacity>

        {/* 5. Dark mode */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            hoveredItem === 'darkmode' && { backgroundColor: theme.bgHover },
          ]}
          onPress={handleToggleDarkMode}
          activeOpacity={0.7}
          accessibilityRole="switch"
          accessibilityState={{ checked: effectiveDarkMode }}
          {...(Platform.OS === 'web'
            ? {
                onMouseEnter: () => setHoveredItem('darkmode'),
                onMouseLeave: () => setHoveredItem(null),
              }
            : {})}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="moon-fill" size={16} color={theme.iconColor} />
          </View>
          <View style={styles.textWithSubWrap}>
            <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Dark mode</Text>
            <Text style={[styles.shortcutSub, { color: theme.textMuted }]}>
              {effectiveDarkMode ? 'Dark theme active' : 'Light theme active'}
            </Text>
          </View>
          <ToggleSwitch
            value={effectiveDarkMode}
            onToggle={handleToggleDarkMode}
            size="sm"
            activeTrackColor="#EA580C"
            inactiveTrackColor={effectiveDarkMode ? '#475569' : '#CBD5E1'}
          />
        </TouchableOpacity>

        {/* Admin Console (Store Administrator Only) */}
        {isAdmin && (
          <TouchableOpacity
            style={[
              styles.menuItem,
              hoveredItem === 'admin' && { backgroundColor: theme.bgHover },
            ]}
            onPress={() => {
              onClose();
              onNavigateToAdmin?.();
            }}
            activeOpacity={0.7}
            {...(Platform.OS === 'web'
              ? {
                  onMouseEnter: () => setHoveredItem('admin'),
                  onMouseLeave: () => setHoveredItem(null),
                }
              : {})}
          >
            <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
              <BootstrapIcon name="shield-lock-fill" size={16} color={theme.iconColor} />
            </View>
            <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Admin console</Text>
            <BootstrapIcon name="chevron-right" size={16} color={theme.chevronColor} />
          </TouchableOpacity>
        )}

        {/* 6. Log out */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            hoveredItem === 'logout' && { backgroundColor: theme.bgHover },
          ]}
          onPress={() => {
            onClose();
            setIsLogoutConfirmOpen(true);
          }}
          activeOpacity={0.7}
          {...(Platform.OS === 'web'
            ? {
                onMouseEnter: () => setHoveredItem('logout'),
                onMouseLeave: () => setHoveredItem(null),
              }
            : {})}
        >
          <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
            <BootstrapIcon name="box-arrow-right" size={16} color={theme.iconColor} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.textPrimary }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      {/* Mobile Modal Overlay */}
      {(isMobile || Platform.OS !== 'web') ? (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View
              style={[
                styles.mobileBackdrop,
                { paddingTop: topOffset ?? (Platform.OS === 'ios' ? 104 : 76 + ANDROID_TOP_INSET) },
              ]}
            >
              <TouchableWithoutFeedback
                onPress={(e) => {
                  if (e && e.stopPropagation) e.stopPropagation();
                }}
              >
                <View
                  style={[
                    styles.dropdownContainer,
                    styles.dropdownContainerMobile,
                    { backgroundColor: theme.bgCard, borderColor: theme.border },
                    align === 'left' ? { alignSelf: 'flex-start' } : { alignSelf: 'flex-end' },
                  ]}
                >
                  {dropdownContent}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : (
        /* Desktop Web Dropdown */
        isOpen && (
          <>
            {/* Click-outside backdrop */}
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={styles.backdrop} />
            </TouchableWithoutFeedback>

            {/* Floating Dropdown Card */}
            <View
              ref={dropdownRef}
              style={[
                styles.dropdownContainer,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
                align === 'left' ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' },
              ]}
            >
              {dropdownContent}
            </View>
          </>
        )
      )}

      {/* Center Log Out Confirmation Modal */}
      <ConfirmModal
        visible={isLogoutConfirmOpen}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        confirmText="Log Out"
        cancelText="Cancel"
        type="danger"
        confirmIcon="box-arrow-right"
        isDark={effectiveDarkMode}
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          onLogout?.();
        }}
        onCancel={() => {
          setIsLogoutConfirmOpen(false);
        }}
      />

      {/* Help & Support Modal */}
      <CompanyInfoModal
        visible={isHelpModalOpen}
        initialTab="contact"
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Privacy Center Modal */}
      <CompanyInfoModal
        visible={isPrivacyCenterOpen}
        initialTab="privacy"
        onClose={() => setIsPrivacyCenterOpen(false)}
      />

      {/* Language Picker Modal */}
      <Modal
        visible={isLanguageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsLanguageModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={[styles.reportCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <View style={styles.reportHeader}>
                  <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
                    <BootstrapIcon name="globe" size={18} color={theme.iconColor} />
                  </View>
                  <Text style={[styles.reportTitle, { color: theme.textPrimary }]}>Select Language</Text>
                </View>

                <View style={{ gap: 8, marginVertical: 12 }}>
                  {['English (US)', 'Filipino (Tagalog)', 'Bisaya (Cebuano)'].map((lang) => {
                    const isSelected = selectedLanguage === lang;
                    return (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.selectionRow,
                          {
                            backgroundColor: isSelected ? theme.accentBg : theme.bgSub,
                            borderColor: isSelected ? theme.accentText : theme.border,
                          },
                        ]}
                        onPress={() => setSelectedLanguage(lang)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectionRowText, { color: isSelected ? theme.accentText : theme.textPrimary, fontWeight: isSelected ? '700' : '600' }]}>
                          {lang}
                        </Text>
                        {isSelected && (
                          <BootstrapIcon name="check-circle-fill" size={17} color={theme.accentText} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.reportSubmitBtn, { alignSelf: 'flex-end', marginTop: 8, backgroundColor: theme.btnSubmitBg }]}
                  onPress={() => setIsLanguageModalOpen(false)}
                >
                  <Text style={styles.reportSubmitText}>Save Preference</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Privacy Checkup Modal */}
      <Modal
        visible={isPrivacyCheckupOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPrivacyCheckupOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPrivacyCheckupOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={[styles.reportCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <View style={styles.reportHeader}>
                  <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
                    <BootstrapIcon name="shield-check" size={18} color={theme.iconColor} />
                  </View>
                  <Text style={[styles.reportTitle, { color: theme.textPrimary }]}>Privacy checkup</Text>
                </View>

                <Text style={[styles.reportDesc, { color: theme.textMuted }]}>
                  Your data and rider privacy settings are protected and managed under MotoTrack standards.
                </Text>

                <View style={{ gap: 12, marginVertical: 10 }}>
                  <View style={[styles.displayRow, { borderBottomColor: theme.divider }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>Profile & Contact Data</Text>
                      <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>Only shared with assigned technician/rider during active orders</Text>
                    </View>
                    <View style={[styles.activeTag, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder, borderWidth: 1 }]}>
                      <Text style={[styles.activeTagText, { color: theme.accentText }]}>Encrypted</Text>
                    </View>
                  </View>

                  <View style={[styles.displayRow, { borderBottomColor: theme.divider }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>Garage Fleet Details</Text>
                      <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>Motorcycle specifications used solely for parts compatibility</Text>
                    </View>
                    <View style={[styles.activeTag, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder, borderWidth: 1 }]}>
                      <Text style={[styles.activeTagText, { color: theme.accentText }]}>Private</Text>
                    </View>
                  </View>

                  <View style={[styles.displayRow, { borderBottomColor: theme.divider }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>Order Tracking Location</Text>
                      <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>Live GPS tracking expires upon delivery completion</Text>
                    </View>
                    <View style={[styles.activeTag, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder, borderWidth: 1 }]}>
                      <Text style={[styles.activeTagText, { color: theme.accentText }]}>Secure</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.reportSubmitBtn, { alignSelf: 'flex-end', marginTop: 8, backgroundColor: theme.btnSubmitBg }]}
                  onPress={() => setIsPrivacyCheckupOpen(false)}
                >
                  <Text style={styles.reportSubmitText}>Looks Good</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Content Preferences Modal */}
      <Modal
        visible={isContentPrefOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsContentPrefOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsContentPrefOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={[styles.reportCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <View style={styles.reportHeader}>
                  <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
                    <BootstrapIcon name="sliders" size={18} color={theme.iconColor} />
                  </View>
                  <Text style={[styles.reportTitle, { color: theme.textPrimary }]}>Content preferences</Text>
                </View>

                <View style={{ gap: 12, marginVertical: 10 }}>
                  <View style={[styles.displayRow, { borderBottomColor: theme.divider }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>Motorcycle Compatibility Feed</Text>
                      <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>Prioritize parts compatible with your registered bike</Text>
                    </View>
                    <View style={[styles.activeTag, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder, borderWidth: 1 }]}>
                      <Text style={[styles.activeTagText, { color: theme.accentText }]}>On</Text>
                    </View>
                  </View>

                  <View style={[styles.displayRow, { borderBottomColor: theme.divider }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>Restock & Price Drop Alerts</Text>
                      <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>Push notifications for wishlist & restocked items</Text>
                    </View>
                    <View style={[styles.activeTag, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder, borderWidth: 1 }]}>
                      <Text style={[styles.activeTagText, { color: theme.accentText }]}>On</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.reportSubmitBtn, { alignSelf: 'flex-end', marginTop: 8, backgroundColor: theme.btnSubmitBg }]}
                  onPress={() => setIsContentPrefOpen(false)}
                >
                  <Text style={styles.reportSubmitText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Report a Problem Dialog */}
      <Modal
        visible={isReportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsReportModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={[styles.reportCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <View style={styles.reportHeader}>
                  <View style={[styles.circularIconWrap, { backgroundColor: theme.iconWrapBg }]}>
                    <BootstrapIcon name="chat-square-dots-fill" size={18} color={theme.iconColor} />
                  </View>
                  <Text style={[styles.reportTitle, { color: theme.textPrimary }]}>Report a problem</Text>
                </View>

                {reportSubmitted ? (
                  <View style={styles.reportSuccessWrap}>
                    <BootstrapIcon name="check-circle-fill" size={40} color="#10B981" />
                    <Text style={[styles.reportSuccessTitle, { color: theme.textPrimary }]}>Thank you for your feedback!</Text>
                    <Text style={[styles.reportSuccessSub, { color: theme.textMuted }]}>
                      Our technical team has been notified.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.reportDesc, { color: theme.textMuted }]}>
                      Help us improve MotoTrack by describing the issue you encountered.
                    </Text>

                    <TextInput
                      style={[styles.reportInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                      placeholder="Briefly explain what happened or what's not working..."
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={4}
                      value={reportText}
                      onChangeText={setReportText}
                    />

                    <View style={styles.reportActions}>
                      <TouchableOpacity
                        style={[styles.reportCancelBtn, { backgroundColor: theme.btnCancelBg }]}
                        onPress={() => setIsReportModalOpen(false)}
                      >
                        <Text style={[styles.reportCancelText, { color: theme.btnCancelText }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reportSubmitBtn,
                          { backgroundColor: theme.btnSubmitBg },
                          !reportText.trim() && { opacity: 0.5 },
                        ]}
                        onPress={handleSubmitReport}
                        disabled={!reportText.trim()}
                      >
                        <Text style={styles.reportSubmitText}>Submit Report</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Display & Accessibility Dialog (Interactive Theme Selection) */}
      <Modal
        visible={isDisplayModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDisplayModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsDisplayModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={[styles.reportCard, { backgroundColor: theme.bgCard, borderColor: theme.border, maxWidth: 440 }]}>
                {/* Header */}
                <View style={[styles.reportHeader, { justifyContent: 'space-between', marginBottom: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.circularIconWrap, { backgroundColor: theme.accentBg }]}>
                      <BootstrapIcon
                        name={effectiveDarkMode ? 'moon-stars-fill' : 'brightness-high-fill'}
                        size={18}
                        color={theme.accentText}
                      />
                    </View>
                    <View>
                      <Text style={[styles.reportTitle, { color: theme.textPrimary }]}>Display & accessibility</Text>
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                        Appearance & theme settings
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setIsDisplayModalOpen(false)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: theme.bgSub,
                    }}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={13} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Theme Mode Selection Cards */}
                <View style={{ gap: 10, marginVertical: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: theme.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      marginBottom: 2,
                    }}
                  >
                    Theme Mode
                  </Text>

                  {/* 1. Dark Theme Option with Toggle Switch (matching user uploaded reference) */}
                  <TouchableOpacity
                    style={[
                      styles.themeOptionRow,
                      {
                        backgroundColor: effectiveDarkMode ? (theme.isDark ? '#1C2622' : 'rgba(77, 184, 150, 0.12)') : theme.bgSub,
                        borderColor: effectiveDarkMode ? '#EA580C' : theme.border,
                      },
                    ]}
                    onPress={handleToggleDarkMode}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View
                        style={[
                          styles.themeOptionIconWrap,
                          {
                            backgroundColor: effectiveDarkMode ? 'rgba(77, 184, 150, 0.22)' : theme.iconWrapBg,
                          },
                        ]}
                      >
                        <BootstrapIcon
                          name="moon-stars-fill"
                          size={17}
                          color={effectiveDarkMode ? '#EA580C' : '#64748B'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>
                          Dark Theme
                        </Text>
                        <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>
                          Admin charcoal surfaces with road-teal accents
                        </Text>
                      </View>
                    </View>

                    <ToggleSwitch
                      value={effectiveDarkMode}
                      onToggle={handleToggleDarkMode}
                      activeTrackColor="#EA580C"
                      inactiveTrackColor="#CBD5E1"
                    />
                  </TouchableOpacity>

                  {/* 2. Accessibility: High Legibility */}
                  <TouchableOpacity
                    style={[
                      styles.displayRow,
                      {
                        borderBottomWidth: 0,
                        backgroundColor: theme.bgSub,
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: theme.border,
                        marginTop: 4,
                      },
                    ]}
                    onPress={() => setHighLegibility((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.displayRowTitle, { color: theme.textPrimary }]}>
                        High Legibility
                      </Text>
                      <Text style={[styles.displayRowSub, { color: theme.textMuted }]}>
                        Enhanced contrast icon badges and borders
                      </Text>
                    </View>
                    <ToggleSwitch
                      value={highLegibility}
                      onToggle={() => setHighLegibility((prev) => !prev)}
                      activeTrackColor="#EA580C"
                      inactiveTrackColor="#CBD5E1"
                    />
                  </TouchableOpacity>
                </View>

                {/* Footer Close */}
                <TouchableOpacity
                  style={[
                    styles.reportCancelBtn,
                    {
                      marginTop: 14,
                      alignSelf: 'flex-end',
                      minWidth: 96,
                      alignItems: 'center',
                      backgroundColor: theme.btnCancelBg,
                      borderWidth: 1,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setIsDisplayModalOpen(false)}
                >
                  <Text style={[styles.reportCancelText, { color: theme.btnCancelText }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    backgroundColor: 'transparent',
  },
  mobileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 16,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    width: 295,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 10,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.14), 0 6px 12px -4px rgba(0, 0, 0, 0.05)',
        }
      : {}),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  dropdownContainerMobile: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 'auto',
    marginTop: 0,
    width: '100%',
    maxWidth: 295,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderColor: '#E2E8F0',
  },
  userProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.15s ease',
        }
      : {}),
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  userSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '400',
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
    marginHorizontal: 4,
  },
  menuList: {
    paddingVertical: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6.5,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginVertical: 0.5,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.15s ease',
        }
      : {}),
  },
  circularIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.1,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  textWithSubWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  shortcutSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
    letterSpacing: 0.2,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  reportCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CED0D4',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#050505',
  },
  reportDesc: {
    fontSize: 13.5,
    color: '#65676B',
    lineHeight: 19,
    marginBottom: 14,
  },
  reportInput: {
    backgroundColor: '#F0F2F5',
    borderWidth: 1,
    borderColor: '#CED0D4',
    borderRadius: 10,
    padding: 12,
    color: '#050505',
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  reportCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E4E6EB',
  },
  reportCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
  reportSubmitBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EA580C',
  },
  reportSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportSuccessWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  reportSuccessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#050505',
    marginTop: 6,
  },
  reportSuccessSub: {
    fontSize: 13,
    color: '#65676B',
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },
  displayRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
  },
  displayRowSub: {
    fontSize: 12.5,
    color: '#65676B',
    marginTop: 2,
  },
  activeTag: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  submenuContainer: {
    paddingVertical: 2,
  },
  submenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 4,
    gap: 8,
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none' } : {}),
  },
  submenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
    ...(Platform.OS === 'web'
      ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
      : {}),
  },
  menuItemHighlighted: {
    backgroundColor: '#F0F2F5',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
    borderWidth: 1,
    borderColor: '#CED0D4',
  },
  selectionRowActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#EA580C',
  },
  selectionRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
  themeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    cursor: 'pointer',
  },
  themeOptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});

