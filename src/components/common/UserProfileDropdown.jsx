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
import BootstrapIcon from './BootstrapIcon';
import ConfirmModal from '../modals/ConfirmModal';
import CompanyInfoModal from '../modals/CompanyInfoModal';
import { ANDROID_TOP_INSET } from '../../utils/safeArea';

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
  isMobile = false,
  align = 'right',
  topOffset,
  currentScreen,
  showDashboard = false,
}) {
  const dropdownRef = useRef(null);
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'settings_privacy'
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

  // Reset to main view whenever dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
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
    onClose();
    if (onNavigateToProfile) {
      onNavigateToProfile('profile');
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
       SUBMENU: SETTINGS & PRIVACY (LIGHT THEME)
       ═══════════════════════════════════════════════════════ */
    <View style={styles.submenuContainer}>
      {/* Top Header with Back Arrow and Title */}
      <View style={styles.submenuHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentView('main')}
          activeOpacity={0.7}
          accessibilityLabel="Back to main menu"
        >
          <BootstrapIcon name="arrow-left" size={20} color="#050505" />
        </TouchableOpacity>
        <Text style={styles.submenuTitle}>Settings & privacy</Text>
      </View>

      {/* List of 6 Items from Screenshot */}
      <View style={styles.menuList}>
        {/* 1. Settings */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenAccountSettings}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="gear-fill" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Settings</Text>
        </TouchableOpacity>

        {/* 2. Language */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsLanguageModalOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="globe" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Language</Text>
          <BootstrapIcon name="chevron-right" size={17} color="#65676B" />
        </TouchableOpacity>

        {/* 3. Privacy checkup */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsPrivacyCheckupOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="shield-check" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Privacy checkup</Text>
        </TouchableOpacity>

        {/* 4. Privacy Center */}
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemHighlighted]}
          onPress={() => {
            onClose();
            setIsPrivacyCenterOpen(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="shield-lock-fill" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Privacy Center</Text>
        </TouchableOpacity>

        {/* 5. Activity log */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenActivityLog}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="list-task" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Activity log</Text>
        </TouchableOpacity>

        {/* 6. Content preferences */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsContentPrefOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="sliders" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Content preferences</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    /* ═══════════════════════════════════════════════════════
       MAIN MENU VIEW (LIGHT THEME)
       ═══════════════════════════════════════════════════════ */
    <>
      {/* User Quick Header - Profile Link in Light Mode */}
      <TouchableOpacity
        style={styles.userProfileCard}
        onPress={handleOpenProfile}
        activeOpacity={0.8}
      >
        {isUploadedAvatar ? (
          <Image
            source={{ uri: currentUser.avatar || currentUser.photoUri }}
            style={styles.avatarImg}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <BootstrapIcon name="person-fill" size={24} color="#65676B" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {currentUser.name || currentUser.fullName || 'Rider Account'}
          </Text>
          <Text style={styles.userSub} numberOfLines={1}>
            See your profile
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Main Choices Menu */}
      <View style={styles.menuList}>
        {/* 0. Dashboard shortcut (Visible when customer is in the shop page) */}
        {(showDashboard || currentScreen === 'shop') && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose?.();
              if (onNavigateToDashboard) {
                onNavigateToDashboard('overview');
              } else if (onNavigateToProfile) {
                onNavigateToProfile('overview');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.circularIconWrap, { backgroundColor: '#E8F0EC' }]}>
              <BootstrapIcon name="speedometer2" size={18} color="#1D4533" />
            </View>
            <Text style={[styles.menuTitle, { fontWeight: '700', color: '#1D4533' }]}>Dashboard</Text>
            <BootstrapIcon name="chevron-right" size={17} color="#65676B" />
          </TouchableOpacity>
        )}

        {/* 1. Settings & privacy -> Switches to Settings & privacy submenu */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setCurrentView('settings_privacy')}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="gear-fill" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Settings & privacy</Text>
          <BootstrapIcon name="chevron-right" size={17} color="#65676B" />
        </TouchableOpacity>

        {/* 2. Help & support */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenHelp}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="question-circle-fill" size={19} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Help & support</Text>
          <BootstrapIcon name="chevron-right" size={17} color="#65676B" />
        </TouchableOpacity>

        {/* 3. Report a problem (CTRL B) */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenReport}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="chat-square-dots-fill" size={18} color="#050505" />
          </View>
          <View style={styles.textWithSubWrap}>
            <Text style={styles.menuTitle}>Report a problem</Text>
            <Text style={styles.shortcutSub}>CTRL B</Text>
          </View>
        </TouchableOpacity>

        {/* 4. Display & accessibility */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleOpenDisplay}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="moon-fill" size={18} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Display & accessibility</Text>
          <BootstrapIcon name="chevron-right" size={17} color="#65676B" />
        </TouchableOpacity>

        {/* 5. Admin Console (Store Administrator Only) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onNavigateToAdmin?.();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.circularIconWrap, { backgroundColor: '#E8F0EC' }]}>
              <BootstrapIcon name="shield-lock-fill" size={18} color="#1D4533" />
            </View>
            <Text style={styles.menuTitle}>Admin console</Text>
            <BootstrapIcon name="chevron-right" size={17} color="#65676B" />
          </TouchableOpacity>
        )}

        {/* 6. Log out */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            onClose();
            setIsLogoutConfirmOpen(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.circularIconWrap}>
            <BootstrapIcon name="box-arrow-right" size={18} color="#050505" />
          </View>
          <Text style={styles.menuTitle}>Log out</Text>
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
                align === 'left' ? { left: 0, right: 'auto' } : { right: 0, left: 'auto' },
              ]}
            >
              {dropdownContent}
            </View>
          </>
        )
      )}

      {/* Center Log Out Confirmation Modal (Light Mode Compatible) */}
      <ConfirmModal
        visible={isLogoutConfirmOpen}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        confirmText="Log Out"
        cancelText="Cancel"
        type="danger"
        confirmIcon="box-arrow-right"
        isDark={false}
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
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.circularIconWrap}>
                    <BootstrapIcon name="globe" size={18} color="#050505" />
                  </View>
                  <Text style={styles.reportTitle}>Select Language</Text>
                </View>

                <View style={{ gap: 8, marginVertical: 12 }}>
                  {['English (US)', 'Filipino (Tagalog)', 'Bisaya (Cebuano)'].map((lang) => {
                    const isSelected = selectedLanguage === lang;
                    return (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.selectionRow,
                          isSelected && styles.selectionRowActive,
                        ]}
                        onPress={() => setSelectedLanguage(lang)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectionRowText, isSelected && { color: '#1D4533', fontWeight: '700' }]}>
                          {lang}
                        </Text>
                        {isSelected && (
                          <BootstrapIcon name="check-circle-fill" size={17} color="#1D4533" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.reportSubmitBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
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
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.circularIconWrap}>
                    <BootstrapIcon name="shield-check" size={18} color="#050505" />
                  </View>
                  <Text style={styles.reportTitle}>Privacy checkup</Text>
                </View>

                <Text style={styles.reportDesc}>
                  Your data and rider privacy settings are protected and managed under MotoTrack standards.
                </Text>

                <View style={{ gap: 12, marginVertical: 10 }}>
                  <View style={styles.displayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.displayRowTitle}>Profile & Contact Data</Text>
                      <Text style={styles.displayRowSub}>Only shared with assigned technician/rider during active orders</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>Encrypted</Text>
                    </View>
                  </View>

                  <View style={styles.displayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.displayRowTitle}>Garage Fleet Details</Text>
                      <Text style={styles.displayRowSub}>Motorcycle specifications used solely for parts compatibility</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>Private</Text>
                    </View>
                  </View>

                  <View style={styles.displayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.displayRowTitle}>Order Tracking Location</Text>
                      <Text style={styles.displayRowSub}>Live GPS tracking expires upon delivery completion</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>Secure</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.reportSubmitBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
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
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.circularIconWrap}>
                    <BootstrapIcon name="sliders" size={18} color="#050505" />
                  </View>
                  <Text style={styles.reportTitle}>Content preferences</Text>
                </View>

                <View style={{ gap: 12, marginVertical: 10 }}>
                  <View style={styles.displayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.displayRowTitle}>Motorcycle Compatibility Feed</Text>
                      <Text style={styles.displayRowSub}>Prioritize parts compatible with your registered bike</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>On</Text>
                    </View>
                  </View>

                  <View style={styles.displayRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.displayRowTitle}>Restock & Price Drop Alerts</Text>
                      <Text style={styles.displayRowSub}>Push notifications for wishlist & restocked items</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>On</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.reportSubmitBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
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
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.circularIconWrap}>
                    <BootstrapIcon name="chat-square-dots-fill" size={18} color="#050505" />
                  </View>
                  <Text style={styles.reportTitle}>Report a problem</Text>
                </View>

                {reportSubmitted ? (
                  <View style={styles.reportSuccessWrap}>
                    <BootstrapIcon name="check-circle-fill" size={40} color="#10B981" />
                    <Text style={styles.reportSuccessTitle}>Thank you for your feedback!</Text>
                    <Text style={styles.reportSuccessSub}>
                      Our technical team has been notified.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.reportDesc}>
                      Help us improve MotoTrack by describing the issue you encountered.
                    </Text>

                    <TextInput
                      style={styles.reportInput}
                      placeholder="Briefly explain what happened or what's not working..."
                      placeholderTextColor="#8A8D91"
                      multiline
                      numberOfLines={4}
                      value={reportText}
                      onChangeText={setReportText}
                    />

                    <View style={styles.reportActions}>
                      <TouchableOpacity
                        style={styles.reportCancelBtn}
                        onPress={() => setIsReportModalOpen(false)}
                      >
                        <Text style={styles.reportCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reportSubmitBtn,
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

      {/* Display & Accessibility Dialog */}
      <Modal
        visible={isDisplayModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDisplayModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsDisplayModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e?.stopPropagation?.()}>
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.circularIconWrap}>
                    <BootstrapIcon name="moon-fill" size={18} color="#050505" />
                  </View>
                  <Text style={styles.reportTitle}>Display & accessibility</Text>
                </View>

                <View style={{ gap: 14, marginVertical: 12 }}>
                  <View style={styles.displayRow}>
                    <View>
                      <Text style={styles.displayRowTitle}>Light Theme</Text>
                      <Text style={styles.displayRowSub}>Clean white high-contrast interface</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>Active</Text>
                    </View>
                  </View>

                  <View style={styles.displayRow}>
                    <View>
                      <Text style={styles.displayRowTitle}>High Legibility</Text>
                      <Text style={styles.displayRowSub}>Enhanced contrast icon badges</Text>
                    </View>
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>On</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.reportCancelBtn, { marginTop: 8, alignSelf: 'flex-end', minWidth: 90, alignItems: 'center' }]}
                  onPress={() => setIsDisplayModalOpen(false)}
                >
                  <Text style={styles.reportCancelText}>Close</Text>
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
    marginTop: 8,
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CED0D4',
    paddingHorizontal: 8,
    paddingVertical: 10,
    zIndex: 9999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  dropdownContainerMobile: {
    position: 'relative',
    top: 0,
    left: 0,
    right: 'auto',
    marginTop: 0,
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderColor: '#CED0D4',
  },
  userProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F2F5',
    borderWidth: 1,
    borderColor: '#CED0D4',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E4E6EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#050505',
    letterSpacing: -0.2,
  },
  userSub: {
    fontSize: 13,
    color: '#65676B',
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#CED0D4',
    marginVertical: 6,
    marginHorizontal: 8,
  },
  menuList: {
    paddingVertical: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  circularIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4E6EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
    flex: 1,
  },
  textWithSubWrap: {
    flex: 1,
  },
  shortcutSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#65676B',
    marginTop: 1,
    letterSpacing: 0.2,
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
    backgroundColor: '#1D4533',
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
    backgroundColor: '#E8F0EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4533',
  },
  submenuContainer: {
    paddingVertical: 2,
  },
  submenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#050505',
    letterSpacing: -0.3,
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
    backgroundColor: '#E8F0EC',
    borderWidth: 1,
    borderColor: '#1D4533',
  },
  selectionRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
});

