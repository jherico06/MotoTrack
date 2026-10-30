import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import EditBrandModal from '../modals/EditBrandModal.jsx';
import BrandLogo from '../common/BrandLogo.jsx';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';
import { auditLogService } from '../../services/system/auditLogService.js';
import { marketingBannerService } from '../../services/marketing/marketingBannerService.js';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';
import AdminMarketingBannerSettings from './AdminMarketingBannerSettings.jsx';

/**
 * AdminSystemSettingsPanel
 *
 * Provides a clean, executive read-only view of all platform and store settings.
 * Each logical section has ONE unified [Edit] button that opens ONE organized modal
 * containing all editable fields for that section.
 */
export default function AdminSystemSettingsPanel({
  isDarkMode = false,
  tokens = {},
  showToast = () => {},
  showConfirm = () => {},
  isDesktop = true,
  products = [],
  orders = [],
  garageBookings = [],
  usersList = [],
  mechanicsList = [],
  suppliers = [],
  toggleDarkMode = () => {},
}) {
  const [settings, setSettings] = useState(() => systemSettingsService.getSettings());
  const [marketingBanner, setMarketingBanner] = useState(() => marketingBannerService.getBanner());
  const [activeSubTab, setActiveSubTab] = useState('general');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  // Section-level unified modal state
  const [activeModalSection, setActiveModalSection] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [isModalSaving, setIsModalSaving] = useState(false);

  // Sync with service subscriptions
  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      setSettings({ ...updated });
    });
    const unsubBanner = marketingBannerService.subscribe((updated) => {
      setMarketingBanner({ ...updated });
    });
    return () => {
      unsub();
      unsubBanner();
    };
  }, []);

  const openSectionModal = (sectionKey) => {
    if (sectionKey === 'store_identity') {
      setIsBrandModalOpen(true);
      return;
    }
    setActiveModalSection(sectionKey);
    setModalForm({ ...settings });
  };

  const closeSectionModal = () => {
    setActiveModalSection(null);
    setModalForm({});
    setIsModalSaving(false);
  };

  const handleUpdateFormField = (field, val) => {
    setModalForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleToggleSetting = (field, nextValue) => {
    try {
      const res = systemSettingsService.saveSettings({ [field]: nextValue });
      if (res.success) {
        setSettings(res.settings);
        try {
          auditLogService.logSystemAction({
            action: 'SETTINGS_TOGGLE_UPDATED',
            target: field,
            details: `Admin toggled ${field} to ${nextValue ? 'enabled' : 'disabled'}`,
            severity: 'INFO',
            metadata: { field, value: nextValue },
          });
        } catch (_e) {}
      } else {
        showToast('⚠️ Error saving: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      showToast('⚠️ Failed to save: ' + err.message);
    }
  };

  const handlePickLogoFile = async () => {
    try {
      const res = await pickImageFromFile();
      if (res.success && res.uri) {
        handleUpdateFormField('storeLogoUrl', res.uri);
        showToast('✓ Logo uploaded successfully! Click Save Changes to apply.');
      } else if (res.error && !res.error.includes('cancelled')) {
        showToast('⚠️ ' + res.error);
      }
    } catch (err) {
      showToast('⚠️ Failed to select logo: ' + err.message);
    }
  };

  const handleSaveSectionModal = async () => {
    if (!activeModalSection) return;
    setIsModalSaving(true);

    try {
      // Process numeric fields if applicable
      const sanitized = { ...modalForm };
      const numericFields = [
        'standardShippingFee',
        'freeShippingThreshold',
        'deliveryLeadTimeDays',
        'defaultReorderLevel',
        'criticalStockLevel',
        'serviceBayCount',
        'maxConcurrentBookings',
        'maxDailyAppointments',
        'slotDurationMinutes',
        'slotsPerMechanic',
        'downpaymentPercent',
        'downpaymentDueHours',
        'laborRatePerHour',
        'allowCancellationHours',
        'reminderHoursBefore',
        'minimumOrderAmount',
        'maxCodAmount',
        'passwordMinLength',
        'sessionTimeoutMinutes',
        'dataRetentionDays',
      ];

      numericFields.forEach((key) => {
        if (sanitized[key] !== undefined && sanitized[key] !== '') {
          sanitized[key] = Number(sanitized[key]) || 0;
        }
      });

      const res = await systemSettingsService.saveSettings(sanitized);
      if (res.success) {
        setSettings(res.settings);
        try {
          auditLogService.logSystemAction({
            action: 'SETTINGS_SECTION_UPDATED',
            target: activeModalSection,
            details: `Admin updated settings for section: ${activeModalSection}`,
            severity: 'INFO',
            metadata: { section: activeModalSection },
          });
        } catch (_e) {}

        showToast('✓ Settings updated and saved successfully!');
        closeSectionModal();
      } else {
        showToast('⚠️ Error saving: ' + res.error);
      }
    } catch (err) {
      showToast('⚠️ Failed to save: ' + err.message);
    } finally {
      setIsModalSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    showConfirm({
      title: 'Reset All Settings to Factory Defaults?',
      message:
        'This will reset all store information, operational limits, garage hours, and notification preferences. Proceed?',
      confirmText: 'Reset Defaults',
      cancelText: 'Cancel',
      type: 'warning',
      confirmIcon: 'arrow-counterclockwise',
      onConfirm: () => {
        const res = systemSettingsService.resetToDefaults();
        if (res.success) {
          setSettings(res.settings);
          showToast('✓ System settings restored to clean factory defaults.');
        }
      },
    });
  };

  const handleClearCache = () => {
    systemSettingsService.clearSystemCache();
    showToast('✓ Temporary system caches purged successfully.');
  };

  const handleExportBackup = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        settings,
        stats: {
          productsCount: (products || []).length,
          ordersCount: (orders || []).length,
          bookingsCount: (garageBookings || []).length,
          usersCount: (usersList || []).length,
        },
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mototrack_settings_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      showToast('✓ System configuration backup JSON downloaded!');
    } catch (err) {
      showToast('⚠️ Backup export failed: ' + err.message);
    }
  };

  const subTabs = [
    { id: 'general', label: 'Store Identity & Theme', icon: 'shop', desc: 'Branding, contact details & schedule' },
    { id: 'marketing', label: 'Marketing Banner', icon: 'image', desc: 'Hero banner copy, graphics & live preview' },
    { id: 'footer', label: 'Shop Footer', icon: 'layout-text-window-reverse', desc: 'Storefront footer columns, tagline, quick links & social profiles' },
    { id: 'store', label: 'Store & Business Configuration', icon: 'building', desc: 'Hours, delivery, pickup & status' },
    { id: 'checkout', label: 'Checkout & Payment Settings', icon: 'credit-card', desc: 'COD, online payment & fees' },
    { id: 'garage', label: 'Pitstop Garage Rules', icon: 'tools', desc: 'Operating hours & booking capacities' },
    { id: 'notifications', label: 'Alerts & Telemetry', icon: 'bell', desc: 'Stock alerts & notification channels' },
    { id: 'security', label: 'Security & System Settings', icon: 'shield-check', desc: 'Auth, access, backup & maintenance' },
    // Legacy ids kept for backward compatibility with older tab state
    { id: 'operations', label: 'Fulfillment & Orders', icon: 'box-seam', desc: 'Delivery thresholds & inventory controls', hidden: true },
    { id: 'maintenance', label: 'Maintenance & Backup', icon: 'shield-check', desc: 'System health, backup & cache', hidden: true },
  ];

  const visibleTabs = subTabs.filter((t) => !t.hidden);
  // Map legacy tab ids to their new canonical domains
  const canonicalTabId = activeSubTab === 'operations' ? 'store' : activeSubTab === 'maintenance' ? 'security' : activeSubTab;

  const activeTabObj = subTabs.find((t) => t.id === canonicalTabId) || subTabs[0];

  // Helper component to render a clean, read-only field tile (without individual edit buttons)
  const ReadOnlyField = ({
    title,
    value,
    displayValue,
    icon = 'gear',
    description,
    badge,
    isConfigured = true,
  }) => (
    <View
      style={{
        backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
        padding: 16,
        gap: 10,
        boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.04)',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: isDarkMode ? tokens.textMuted : '#64748B',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {title}
          </Text>
          {badge}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BootstrapIcon name={icon} size={15} color={isDarkMode ? tokens.textMuted : '#475569'} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          {displayValue ? (
            displayValue
          ) : isConfigured && value ? (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: isDarkMode ? tokens.textPrimary : '#0F172A',
                letterSpacing: -0.2,
              }}
              numberOfLines={2}
            >
              {String(value)}
            </Text>
          ) : (
            <Text
              style={{
                fontSize: 13,
                fontStyle: 'italic',
                color: isDarkMode ? tokens.textSubtle : '#94A3B8',
                fontWeight: '500',
              }}
            >
              Not configured
            </Text>
          )}
        </View>
      </View>

      {description && (
        <Text
          style={{
            fontSize: 11.5,
            color: isDarkMode ? tokens.textMuted : '#64748B',
            lineHeight: 16,
          }}
        >
          {description}
        </Text>
      )}
    </View>
  );

  // Section Header — optional [Edit] when onEdit is provided
  const SectionHeader = ({ icon, title, subtitle, onEdit }) => (
    <View
      style={{
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: isDarkMode ? '#1A2622' : '#FFF7ED',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BootstrapIcon name={icon} size={20} color="#EA580C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
            {title}
          </Text>
          <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
      </View>

      {typeof onEdit === 'function' ? (
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 9,
            backgroundColor: isDarkMode ? tokens.accentBg : '#ECFDF5',
            borderWidth: 1.5,
            borderColor: isDarkMode ? tokens.accentBorder : '#A7F3D0',
            cursor: 'pointer',
          }}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="pencil-square" size={13} color={isDarkMode ? tokens.accentBrand : '#059669'} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: isDarkMode ? tokens.accentBrand : '#059669' }}>
            Edit
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const ToggleSettingField = ({
    title,
    icon = 'gear',
    description,
    value,
    onToggle,
    defaultOn = true,
  }) => {
    const isOn = defaultOn ? value !== false : !!value;
    return (
      <View
        style={{
          backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
          padding: 16,
          gap: 10,
          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: isDarkMode ? tokens.textMuted : '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name={icon} size={15} color={isDarkMode ? tokens.textMuted : '#475569'} />
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: isDarkMode ? tokens.textPrimary : '#0F172A',
                letterSpacing: -0.2,
              }}
            >
              {isOn ? 'Enabled' : 'Disabled'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onToggle(!isOn)}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOn }}
            accessibilityLabel={`${title} ${isOn ? 'enabled' : 'disabled'}`}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              backgroundColor: isOn ? '#EA580C' : '#CBD5E1',
              justifyContent: 'center',
              paddingHorizontal: 3,
              alignItems: isOn ? 'flex-end' : 'flex-start',
              cursor: 'pointer',
            }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
          </TouchableOpacity>
        </View>

        {description ? (
          <Text
            style={{
              fontSize: 11.5,
              color: isDarkMode ? tokens.textMuted : '#64748B',
              lineHeight: 16,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ gap: 20 }}>
      {/* ─── 1. Header Card with Actions & Subtab Navigation ─── */}
      <View
        style={{
          backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
          padding: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
          overflow: 'visible',
          zIndex: isDropdownOpen ? 1000 : 10,
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="gear-wide-connected" size={26} color="#EA580C" />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '600',
                    color: isDarkMode ? tokens.textPrimary : '#0F172A',
                    letterSpacing: -0.3,
                  }}
                >
                  System & Platform Settings
                </Text>
                <View
                  style={{
                    backgroundColor: isDarkMode ? '#1A2622' : '#FFF7ED',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#EA580C' }}>
                    Core Platform
                  </Text>
                </View>
              </View>
              <Text style={{ color: isDarkMode ? tokens.textMuted : '#64748B', fontSize: 12.5, marginTop: 3 }}>
                Configure store identity, customer checkout rules, pitstop parameters, and system maintenance.
              </Text>
            </View>
          </View>

          {/* Header Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                borderWidth: 1.5,
                borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                cursor: 'pointer',
              }}
              onPress={handleResetToDefaults}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name="arrow-counterclockwise"
                size={14}
                color={isDarkMode ? tokens.textPrimary : '#475569'}
              />
              <Text
                style={{
                  color: isDarkMode ? tokens.textPrimary : '#475569',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                Reset Defaults
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
            marginVertical: 18,
          }}
        />

        {/* Dropdown Section Selector */}
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            position: 'relative',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BootstrapIcon name="sliders" size={14} color={isDarkMode ? tokens.textMuted : '#64748B'} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B' }}>
              Active Configuration Domain:
            </Text>
          </View>

          <View style={{ position: 'relative', width: isDesktop ? 340 : '100%', zIndex: 9999 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                borderWidth: 1.5,
                borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                cursor: 'pointer',
              }}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: '#EA580C',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name={activeTabObj.icon} size={13} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 13.5,
                      fontWeight: '600',
                      color: isDarkMode ? tokens.textPrimary : '#0F172A',
                    }}
                  >
                    {activeTabObj.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 11,
                      color: isDarkMode ? tokens.textMuted : '#64748B',
                      marginTop: 1,
                    }}
                  >
                    {activeTabObj.desc}
                  </Text>
                </View>
              </View>

              <BootstrapIcon
                name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={isDarkMode ? tokens.textMuted : '#475569'}
              />
            </TouchableOpacity>

            {/* Dropdown Options Menu */}
            {isDropdownOpen && (
              <View
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  width: isDesktop ? 380 : '100%',
                  backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                  boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.22)',
                  zIndex: 9999,
                  padding: 6,
                  gap: 4,
                }}
              >
                {visibleTabs.map((tab) => {
                  const isSelected = canonicalTabId === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: isSelected
                          ? isDarkMode ? tokens.accentBg : '#FFF7ED'
                          : 'transparent',
                        cursor: 'pointer',
                      }}
                      onPress={() => {
                        setActiveSubTab(tab.id);
                        setIsDropdownOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: isSelected
                            ? '#EA580C'
                            : isDarkMode ? tokens.bgSub : '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon
                          name={tab.icon}
                          size={15}
                          color={isSelected ? '#FFFFFF' : isDarkMode ? tokens.textMuted : '#64748B'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '600' : '500',
                            color: isSelected
                              ? isDarkMode ? tokens.accentBrand : '#EA580C'
                              : isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                        >
                          {tab.label}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 11,
                            color: isDarkMode ? tokens.textMuted : '#64748B',
                            marginTop: 1,
                          }}
                        >
                          {tab.desc}
                        </Text>
                      </View>
                      {isSelected && (
                        <BootstrapIcon name="check" size={16} color="#EA580C" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── SUBTAB 1: STORE IDENTITY & THEME ─── */}
      {canonicalTabId === 'general' && (
        <View style={{ gap: 20 }}>
          {/* Section 1: Store Identity & Branding */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="shop"
              title="System Name & Brand Identity"
              subtitle="Configure the official system name and custom logo displayed across header, sidebar, login page, and invoices."
              onEdit={() => setIsBrandModalOpen(true)}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Official System / Store Name"
                  value={settings.storeName || 'MotoTrack'}
                  icon="app-indicator"
                  description="Primary system name displayed in top header, sidebar brand mark, and browser title."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="System Tagline / Slogan"
                  value={settings.storeTagline}
                  icon="pencil"
                  description="A short promotional slogan displayed in brand banners and storefront emails."
                />
              </View>
            </View>

            {/* Store Logo Row */}
            <ReadOnlyField
              title="System Logo & Brand Mark Asset"
              icon="image"
              description="Primary brand logo used in application headers, sidebar, dark/light bars, and invoice PDFs."
              displayValue={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {settings.storeLogoUrl ? (
                    <Image
                      source={{ uri: settings.storeLogoUrl }}
                      style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1A2622' : '#FFF7ED',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="tools" size={20} color="#EA580C" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                      {settings.storeLogoUrl ? 'Custom Brand Logo Configured' : 'Default MotoTrack System Logo'}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }} numberOfLines={1}>
                      {settings.storeLogoUrl ? 'Active custom logo asset loaded.' : 'No custom logo uploaded — using standard brand emblem.'}
                    </Text>
                  </View>
                </View>
              }
            />
          </View>

          {/* Section: Marketing Banner */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="image"
              title="Marketing Banner"
              subtitle="Configure the landing page hero banner title, subtitle, marketing description, and background image for the public storefront."
              onEdit={() => setActiveSubTab('marketing')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Banner Title"
                  value={marketingBanner.title || 'Everything Your Ride Needs'}
                  icon="type-h1"
                  description="Primary headline rendered with motorcycle brand accent."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Banner Subtitle"
                  value={marketingBanner.subtitle || 'Ride More Worry Less'}
                  icon="type"
                  description="Short supporting heading and promotional accent."
                />
              </View>
            </View>

            <ReadOnlyField
              title="Banner Description"
              value={marketingBanner.description || 'Quality motorcycle parts, accessories, and professional service — all in one place.'}
              icon="text-paragraph"
              description="Marketing copy displayed directly under the hero headline."
            />

            <ReadOnlyField
              title="Hero Background Image"
              icon="image"
              description="High-resolution motorcycle background photo displayed in the storefront hero card."
              displayValue={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {marketingBanner.image ? (
                    <Image
                      source={{ uri: marketingBanner.image }}
                      style={{
                        width: 80,
                        height: 48,
                        borderRadius: 8,
                        backgroundColor: '#1E252D',
                        borderWidth: 1,
                        borderColor: '#334155',
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 48,
                        borderRadius: 8,
                        backgroundColor: '#1E252D',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name="image" size={20} color="#64748B" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      numberOfLines={1}
                    >
                      {marketingBanner.image ? 'Custom Hero Banner Image Configured' : 'Default Hero Image'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveSubTab('marketing')}
                      style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#EA580C' }}>
                        Edit in Marketing Banner Studio →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              }
            />
          </View>

          {/* Section 2: Contact & Headquarters */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="geo-alt"
              title="Contact & Headquarters"
              subtitle="Customer-facing physical address, support hotline, and official notification dispatch email."
              onEdit={() => openSectionModal('contact_hq')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Official Support Email"
                  value={settings.contactEmail}
                  icon="envelope"
                  description="Receives automated contact queries and customer reply notifications."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Customer Service Hotline / Phone"
                  value={settings.contactPhone}
                  icon="telephone"
                  description="Direct voice contact displayed on order manifests and SMS alerts."
                />
              </View>
            </View>

            <ReadOnlyField
              title="Workshop / Hub Facility Name"
              value={settings.hubName || "D'Blockchain Motorparts and Accessories"}
              icon="shop"
              description="Official name of the workshop and pit bay service hub used on bookings, receipts, and live tracking."
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Business Address"
                  value={settings.storeAddress}
                  icon="pin-map"
                  description="Primary location used for customer returns, walk-in services, and GPS directions."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="City / Location"
                  value={settings.cityLocation}
                  icon="building"
                  description="City and area shown on storefront contact block and delivery zones."
                />
              </View>
            </View>

            <ReadOnlyField
              title="Official Business Email"
              value={settings.businessEmail || settings.contactEmail}
              icon="envelope-at"
              description="Official dispatch mailbox used for invoices, notifications, and supplier correspondence."
            />
          </View>

          {/* Section 3: Operating Hours & Schedule */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="clock"
              title="Store Hours & Operating Schedule"
              subtitle="Daily service window and opening hours for customer appointments and fulfillment shifts."
              onEdit={() => openSectionModal('operating_schedule')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Daily Service Opening Time"
                  value={settings.openTime || '08:00 AM'}
                  icon="sun"
                  description="When mechanics bay check-in and order fulfillment shifts commence."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Daily Service Closing Time"
                  value={settings.closeTime || '07:00 PM'}
                  icon="moon"
                  description="Cutoff time for same-day walk-in PMS jobs and order dispatch."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Store Operating Days"
                  value={settings.operatingDays || 'Monday – Saturday'}
                  icon="calendar-week"
                  description="Regular active business days when appointments are accepted."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Default Platform Currency"
                  value={settings.currencyCode || 'PHP (₱)'}
                  icon="cash"
                  description="Base fiscal denomination for part prices, invoices, and deposits."
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ─── SUBTAB: MARKETING BANNER ─── */}
      {canonicalTabId === 'marketing' && (
        <AdminMarketingBannerSettings
          isDarkMode={isDarkMode}
          tokens={tokens}
          showToast={showToast}
          isDesktop={isDesktop}
        />
      )}

      {/* ─── SUBTAB: SHOP FOOTER SETTINGS & LIVE PREVIEW ─── */}
      {canonicalTabId === 'footer' && (
        <View style={{ gap: 20 }}>
          {/* Header Action Banner */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              flexDirection: isDesktop ? 'row' : 'column',
              alignItems: isDesktop ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                  Storefront Footer & Navigation Settings
                </Text>
                <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C' }}>
                    LIVE STOREFRONT
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                Control all customer-facing footer content on the Shop page: brand tagline, 4-column navigation, newsletter subscription, social media links, and copyright text.
              </Text>
            </View>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#EA580C',
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 10,
                cursor: 'pointer',
              }}
              onPress={() => openSectionModal('shop_footer')}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="pencil-square" size={15} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                Edit All Footer Settings
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── LIVE INTERACTIVE STOREFRONT FOOTER PREVIEW CARD ─── */}
          <View
            style={{
              backgroundColor: '#0B1118',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              overflow: 'hidden',
              boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Simulation Header Bar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Live Storefront Footer Simulation
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="eye-fill" size={12} color="#F97316" />
                <Text style={{ fontSize: 11, color: '#F97316', fontWeight: '600' }}>
                  Updates Instantly
                </Text>
              </View>
            </View>

            {/* Footer Inner Simulation */}
            <View style={{ padding: 24, gap: 24 }}>
              <View
                style={{
                  flexDirection: isDesktop ? 'row' : 'column',
                  gap: 24,
                  justifyContent: 'space-between',
                }}
              >
                {/* Column 1: Brand & Tagline */}
                <View style={{ flex: 1.2, minWidth: 180 }}>
                  <BrandLogo size={32} textColor="#FFFFFF" />
                  <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 10, fontWeight: '500' }}>
                    {settings.footerTagline || 'Ride Better. Go Further.'}
                  </Text>
                  {settings.footerAboutText ? (
                    <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 6, lineHeight: 16 }}>
                      {settings.footerAboutText}
                    </Text>
                  ) : null}
                </View>

                {/* Column 2: Quick Links */}
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' }}>
                    {settings.footerQuickLinksTitle || 'Quick Links'}
                  </Text>
                  <View style={{ gap: 8 }}>
                    {settings.footerLinkShopEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkShopLabel || 'Shop'}</Text>
                    )}
                    {settings.footerLinkServiceEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkServiceLabel || 'Book a Service'}</Text>
                    )}
                    {settings.footerLinkCustomizeEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkCustomizeLabel || 'Customize'}</Text>
                    )}
                    {settings.footerLinkAboutEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkAboutLabel || 'About Us'}</Text>
                    )}
                  </View>
                </View>

                {/* Column 3: Customer Care */}
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' }}>
                    {settings.footerCustomerCareTitle || 'Customer Care'}
                  </Text>
                  <View style={{ gap: 8 }}>
                    {settings.footerLinkHelpEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkHelpLabel || 'Help Center'}</Text>
                    )}
                    {settings.footerLinkShippingEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkShippingLabel || 'Shipping & Delivery'}</Text>
                    )}
                    {settings.footerLinkReturnsEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkReturnsLabel || 'Returns & Refunds'}</Text>
                    )}
                    {settings.footerLinkContactEnabled !== false && (
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>{settings.footerLinkContactLabel || 'Contact Us'}</Text>
                    )}
                  </View>
                </View>

                {/* Column 4: Stay Connected */}
                <View style={{ flex: 1.4, minWidth: 220 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                    {settings.footerStayConnectedTitle || 'Stay Connected'}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 10 }}>
                    {settings.footerNewsletterSubtitle || 'Get the latest updates, promos and more.'}
                  </Text>
                  {settings.footerNewsletterEnabled !== false && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        paddingHorizontal: 10,
                        height: 34,
                        marginBottom: 12,
                      }}
                    >
                      <Text style={{ flex: 1, color: '#64748B', fontSize: 11.5 }}>
                        {settings.footerNewsletterPlaceholder || 'Enter your email address'}
                      </Text>
                      <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' }}>
                        <BootstrapIcon name="arrow-right" size={10} color="#FFFFFF" />
                      </View>
                    </View>
                  )}
                  {/* Social icons preview */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {[
                      { icon: 'facebook', val: settings.footerSocialFacebook },
                      { icon: 'instagram', val: settings.footerSocialInstagram },
                      { icon: 'youtube', val: settings.footerSocialYoutube },
                      { icon: 'tiktok', val: settings.footerSocialTiktok },
                    ].map((s) => (
                      <View
                        key={s.icon}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundColor: s.val ? 'rgba(234, 88, 12, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                          borderWidth: 1,
                          borderColor: s.val ? 'rgba(234, 88, 12, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BootstrapIcon name={s.icon} size={12} color={s.val ? '#EA580C' : '#64748B'} />
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

              {/* Bottom Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                  {settings.footerCopyrightText || ('© ' + new Date().getFullYear() + ' ' + (settings.storeName || 'MOTOTRACK') + '. All rights reserved.')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {settings.footerTermsEnabled !== false && (
                    <Text style={{ fontSize: 11.5, color: '#94A3B8' }}>{settings.footerTermsLabel || 'Terms of Service'}</Text>
                  )}
                  {settings.footerPrivacyEnabled !== false && (
                    <Text style={{ fontSize: 11.5, color: '#94A3B8' }}>{settings.footerPrivacyLabel || 'Privacy Policy'}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Section 1: Brand Identity & Column Headings */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="shop"
              title="Brand Tagline & Column Titles"
              subtitle="Configure the brand slogan and title headers displayed at the top of each footer column."
              onEdit={() => openSectionModal('footer_brand')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Footer Brand Tagline"
                  value={settings.footerTagline || 'Ride Better. Go Further.'}
                  icon="tag"
                  description="Promotional slogan displayed below the brand logo in Column 1."
                />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="About Summary Blurb"
                  value={settings.footerAboutText || 'Ride Better. Go Further.'}
                  icon="card-text"
                  description="Short optional company description rendered in the brand column."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Column 2 Heading"
                  value={settings.footerQuickLinksTitle || 'Quick Links'}
                  icon="fonts"
                  description="Title header for general platform navigation links."
                />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Column 3 Heading"
                  value={settings.footerCustomerCareTitle || 'Customer Care'}
                  icon="fonts"
                  description="Title header for customer support and policies."
                />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Column 4 Heading"
                  value={settings.footerStayConnectedTitle || 'Stay Connected'}
                  icon="fonts"
                  description="Title header for newsletter and social community."
                />
              </View>
            </View>
          </View>

          {/* Section 2: Quick Links & Customer Care Navigation */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="link-45deg"
              title="Quick Links & Customer Care Navigation"
              subtitle="Customize the labels and visibility of each navigation item in Columns 2 & 3."
              onEdit={() => openSectionModal('footer_links')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Quick Links Column Items"
                  icon="list-ul"
                  description="Main navigation links pointing to store shopping, servicing, and customizer."
                  displayValue={
                    <View style={{ gap: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkShopLabel || 'Shop'} {settings.footerLinkShopEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkServiceLabel || 'Book a Service'} {settings.footerLinkServiceEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkCustomizeLabel || 'Customize'} {settings.footerLinkCustomizeEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkAboutLabel || 'About Us'} {settings.footerLinkAboutEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                    </View>
                  }
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Customer Care Column Items"
                  icon="headset"
                  description="Support and policy links directing customers to help and service conditions."
                  displayValue={
                    <View style={{ gap: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkHelpLabel || 'Help Center'} {settings.footerLinkHelpEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkShippingLabel || 'Shipping & Delivery'} {settings.footerLinkShippingEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkReturnsLabel || 'Returns & Refunds'} {settings.footerLinkReturnsEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerLinkContactLabel || 'Contact Us'} {settings.footerLinkContactEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                    </View>
                  }
                />
              </View>
            </View>
          </View>

          {/* Section 3: Newsletter & Social Profiles */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="megaphone"
              title="Newsletter Prompt & Social Community Profiles"
              subtitle="Configure newsletter signup call-to-action and direct links to official social pages."
              onEdit={() => openSectionModal('footer_social')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Newsletter Subscription CTA"
                  value={settings.footerNewsletterEnabled !== false ? 'Enabled' : 'Disabled'}
                  icon="envelope-check"
                  description={settings.footerNewsletterSubtitle || 'Get the latest updates, promos and more.'}
                  badge={
                    <View style={{ backgroundColor: settings.footerNewsletterEnabled !== false ? '#DCFCE7' : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: settings.footerNewsletterEnabled !== false ? '#15803D' : '#64748B' }}>
                        {settings.footerNewsletterEnabled !== false ? 'ACTIVE' : 'OFF'}
                      </Text>
                    </View>
                  }
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Social Profiles Connected"
                  icon="share"
                  description="Social links displayed as icon buttons in the stay connected column."
                  displayValue={
                    <View style={{ gap: 4, marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Facebook: <Text style={{ color: '#EA580C' }}>{settings.footerSocialFacebook || 'Not configured'}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Instagram: <Text style={{ color: '#EA580C' }}>{settings.footerSocialInstagram || 'Not configured'}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        YouTube: <Text style={{ color: '#EA580C' }}>{settings.footerSocialYoutube || 'Not configured'}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        TikTok: <Text style={{ color: '#EA580C' }}>{settings.footerSocialTiktok || 'Not configured'}</Text>
                      </Text>
                    </View>
                  }
                />
              </View>
            </View>
          </View>

          {/* Section 4: Copyright & Legal Compliance */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="shield-check"
              title="Copyright Statement & Legal Compliance"
              subtitle="Manage copyright notices and consumer protection legal links in the footer bottom bar."
              onEdit={() => openSectionModal('footer_legal')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Bottom Copyright Text"
                  value={settings.footerCopyrightText || ('© ' + new Date().getFullYear() + ' ' + (settings.storeName || 'MOTOTRACK') + '. All rights reserved.')}
                  icon="c-circle"
                  description="Legal ownership text displayed at the bottom left of the storefront footer."
                />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Terms & Privacy Navigation"
                  icon="file-earmark-text"
                  description="Visibility of legal modal links at the bottom right of the footer."
                  displayValue={
                    <View style={{ gap: 4, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerTermsLabel || 'Terms of Service'} {settings.footerTermsEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDarkMode ? tokens.textPrimary : '#0F172A', fontWeight: '600' }}>
                        • {settings.footerPrivacyLabel || 'Privacy Policy'} {settings.footerPrivacyEnabled === false ? '(Hidden)' : '(Active)'}
                      </Text>
                    </View>
                  }
                />
              </View>
            </View>
          </View>
        </View>
      )}


      {/* ─── SUBTAB 2: STORE & BUSINESS CONFIGURATION ─── */}
      {canonicalTabId === 'store' && (
        <View style={{ gap: 20 }}>
          <View style={{ backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0', gap: 16 }}>
            <SectionHeader icon="building" title="Store & Business Configuration" subtitle="Configure store operations, business hours, delivery options, and customer-facing information." onEdit={() => openSectionModal('store_business')} />
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Store Status" value={(settings.storeStatus || 'open') === 'open' ? 'Open — Accepting Orders' : 'Closed — Paused'} icon="shop-window" description="Master switch for storefront ordering and booking availability." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Minimum Order Amount" value={`₱${Number(settings.minimumOrderAmount || 0).toLocaleString()}`} icon="cash-coin" description="Lowest cart subtotal required before checkout is allowed." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Store Operating Hours" value={`${settings.openTime || '08:00 AM'} - ${settings.closeTime || '07:00 PM'}`} icon="clock" description="Daily service window for fulfillment shifts and walk-in service." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Business Days" value={settings.operatingDays || 'Monday – Saturday'} icon="calendar-week" description="Regular active business days when appointments are accepted." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Delivery Availability" value={settings.deliveryAvailable !== false ? 'Available' : 'Disabled'} icon="truck" description="When enabled, customers can select courier delivery at checkout." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Pickup Availability" value={settings.pickupAvailable !== false ? 'Available' : 'Disabled'} icon="bag-check" description="When enabled, customers can reserve online and pick up in-store." />
              </View>
            </View>
          </View>
          {/* Section 1: Order Fulfillment & Logistics */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="truck"
              title="Store Operations — Fulfillment & Delivery Rules"
              subtitle="Default delivery pricing, free shipping waiver thresholds, and processing rules."
              onEdit={() => openSectionModal('fulfillment')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Base Standard Delivery Fee"
                  value={`₱${Number(settings.standardShippingFee || 0).toLocaleString()}`}
                  icon="cash-stack"
                  description="Standard baseline delivery charge applied to customer cart checkouts."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Free Shipping Minimum Order"
                  value={
                    Number(settings.freeShippingThreshold) > 0
                      ? `₱${Number(settings.freeShippingThreshold).toLocaleString()}`
                      : 'Disabled (No free shipping)'
                  }
                  icon="gift"
                  description="Subtotal required for automatic free delivery waiver."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Estimated Delivery Lead Time"
                  value={`${settings.deliveryLeadTimeDays || 3} Business Days`}
                  icon="calendar-check"
                  description="Expected window communicated to customers upon checkout."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Auto-Fulfill Confirmed Orders"
                  value={settings.autoFulfillOrders ? 'Enabled' : 'Disabled (Manual Approval)'}
                  icon="lightning-charge"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.autoFulfillOrders ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.autoFulfillOrders ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.autoFulfillOrders ? 'AUTO' : 'MANUAL'}
                      </Text>
                    </View>
                  }
                  description="When enabled, paid orders immediately transition to 'Ready for Delivery'."
                />
              </View>
            </View>
          </View>

          {/* Section 2: Inventory & Stock Controls */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="boxes"
              title="Inventory Thresholds & Stock Controls"
              subtitle="Reorder alerts, backorder preferences, and catalog identification numbering."
              onEdit={() => openSectionModal('inventory')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Default Low-Stock Warning Level"
                  value={`${settings.defaultReorderLevel || 5} Units`}
                  icon="exclamation-triangle"
                  description="Parts below this quantity trigger inventory warnings in the catalog."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Critical Out-of-Stock Level"
                  value={`${settings.criticalStockLevel || 2} Units`}
                  icon="slash-circle"
                  description="Triggers urgent priority alerts on the admin dashboard."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Catalog SKU Prefix"
                  value={settings.skuPrefix || 'MT-'}
                  icon="upc-scan"
                  description="Default prefix prepended when generating new part SKU codes."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Allow Customer Backorders"
                  value={settings.enableBackorders ? 'Enabled (Accept Orders When 0 Stock)' : 'Disabled (Strict Inventory)'}
                  icon="cart-plus"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.enableBackorders ? '#FEF3C7' : '#DCFCE7',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.enableBackorders ? '#92400E' : '#166534',
                        }}
                      >
                        {settings.enableBackorders ? 'BACKORDERS' : 'STRICT'}
                      </Text>
                    </View>
                  }
                  description="Permits customers to purchase parts currently out of stock."
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {canonicalTabId === 'checkout' && (
        <View style={{ gap: 20 }}>
          <View style={{ backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0', gap: 16 }}>
            <SectionHeader icon="credit-card" title="Checkout & Payment Settings" subtitle="Configure customer checkout rules and available payment methods." onEdit={() => openSectionModal('checkout_payment')} />
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Cash on Delivery" value={settings.codEnabled !== false ? 'Enabled' : 'Disabled'} icon="cash" description="Allow customers to pay in cash upon rider delivery or store pickup." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Online Payment" value={settings.onlinePaymentEnabled !== false ? 'Enabled' : 'Disabled'} icon="phone" description="Accept GCash and other online wallets at customer checkout." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Payment Verification" value={settings.paymentVerificationRequired !== false ? 'Required (Manual Review)' : 'Auto-Approve'} icon="shield-check" description="Require staff verification for online payments before fulfillment." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Minimum Order Amount" value={`₱${Number(settings.minimumOrderAmount || 0).toLocaleString()}`} icon="cart-check" description="Minimum cart subtotal enforced at checkout entry." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Delivery Fee" value={`₱${Number(settings.standardShippingFee || 0).toLocaleString()}`} icon="truck" description="Flat delivery fee applied when free-shipping threshold is not met." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Free Delivery Threshold" value={Number(settings.freeShippingThreshold) > 0 ? `₱${Number(settings.freeShippingThreshold).toLocaleString()}` : 'Disabled'} icon="gift" description="Order subtotal that unlocks free courier delivery." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Max COD Amount" value={`₱${Number(settings.maxCodAmount || 50000).toLocaleString()}`} icon="cash-stack" description="Upper limit for COD orders; larger orders require online payment." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Order Cancellation Rules" value={`${settings.allowCancellationHours || 24} Hours Free Cancellation`} icon="x-circle" description="Customers may cancel without penalty inside this window." />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* PITSTOP GARAGE RULES */}
      {canonicalTabId === 'garage' && (
        <View style={{ gap: 20 }}>
          {/* Section 1: Bay & Capacity Operations */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="tools"
              title="Pitstop Bays & Service Capacity"
              subtitle="Physical bay count, scheduling slots, and technician auto-assignment rules."
              onEdit={() => openSectionModal('garage_capacity')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Certified Service Pit Bays"
                  value={`${settings.serviceBayCount || 4} Active Bays`}
                  icon="building"
                  description="Simultaneous motorcycle repair and inspection stalls available."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Max Concurrent Appointments"
                  value={`${settings.maxConcurrentBookings || 4} Bookings / Hour`}
                  icon="people"
                  description="Upper ceiling on simultaneous customer bookings to prevent bay congestions."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Slots per Mechanic"
                  value={`${settings.slotsPerMechanic ?? 2} Slots / Mechanic`}
                  icon="calendar2-week"
                  description="Appointments each on-duty mechanic can take in one day. Today's slots equal on-duty mechanics times this number."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Auto-Assign Available Mechanics"
                  value={settings.autoAssignMechanics ? 'Enabled' : 'Disabled (Manual Dispatch)'}
                  icon="person-gear"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.autoAssignMechanics ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.autoAssignMechanics ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.autoAssignMechanics ? 'AUTO-DISPATCH' : 'MANUAL'}
                      </Text>
                    </View>
                  }
                  description="Automatically pairs new bookings with on-duty master mechanics."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Default PMS Service Duration"
                  value={`${settings.slotDurationMinutes || 90} Minutes`}
                  icon="hourglass-split"
                  description="Standard time block allocated on technician schedules per service."
                />
              </View>
            </View>
          </View>

          {/* Section 2: Booking Policies & Deposits */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="credit-card"
              title="Booking Policies, Deposits & Labor Pricing"
              subtitle="Downpayment rules, cancellation cutoff windows, and standard labor rates."
              onEdit={() => openSectionModal('garage_pricing')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Required Booking Downpayment"
                  value={`${settings.downpaymentPercent || 20}% of Estimated Service`}
                  icon="percent"
                  description="Initial security deposit required to reserve a service pit bay slot."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Standard Garage Hourly Labor Rate"
                  value={`₱${Number(settings.laborRatePerHour || 350).toLocaleString()} / hour`}
                  icon="cash-coin"
                  description="Standard baseline hourly rate applied to custom repairs and mechanical work."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Downpayment Due Date"
                  value={`${settings.downpaymentDueHours ?? 1} Hour${Number(settings.downpaymentDueHours ?? 1) === 1 ? '' : 's'} After Booking`}
                  icon="alarm"
                  description="Starts when the customer books. If unpaid by this due date, the booking is cancelled automatically and the customer is notified."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Free Cancellation Cutoff Window"
                  value={`${settings.allowCancellationHours || 24} Hours Prior`}
                  icon="arrow-counterclockwise"
                  description="Riders can cancel without deposit forfeiture up to this threshold."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Enforce Downpayment Requirement"
                  value={settings.requireDownpayment !== false ? 'Enforced' : 'Optional (Pay on Arrival)'}
                  icon="shield-lock"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.requireDownpayment !== false ? '#DCFCE7' : '#FEF3C7',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.requireDownpayment !== false ? '#166534' : '#92400E',
                        }}
                      >
                        {settings.requireDownpayment !== false ? 'ENFORCED' : 'OPTIONAL'}
                      </Text>
                    </View>
                  }
                  description="When enabled, bookings remain in 'Pending Downpayment' until paid."
                />
              </View>
            </View>
          </View>

          <View style={{ backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0', gap: 16 }}>
            <SectionHeader icon="gear" title="Garage & Service Configuration" subtitle="Configure motorcycle service, booking, mechanic, and pitstop operations." onEdit={() => openSectionModal('garage_operations')} />
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Service Booking Availability" value={settings.serviceBookingEnabled !== false ? 'Open for Bookings' : 'Paused'} icon="calendar-check" description="Master switch for accepting new pitstop service appointments." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Maximum Daily Bookings" value={`${settings.maxDailyAppointments || 24} / Day`} icon="list-ol" description="Daily cap across all bays to protect service quality." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Walk-in Availability" value={settings.walkInAvailable !== false ? 'Walk-ins Accepted' : 'By Appointment Only'} icon="person-walking" description="Allow riders without reservations to queue for PMS." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="PMS Settings" value={settings.pmsEnabled !== false ? 'PMS Packages Active' : 'Disabled'} icon="wrench" description="Preventive maintenance schedule packages offered at booking." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Mechanic Assignment" value={settings.autoAssignMechanics !== false ? 'Auto-Assign' : 'Manual Dispatch'} icon="person-gear" description="How new bookings are paired with on-duty mechanics." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Booking Approval Requirements" value={settings.bookingApprovalRequired ? 'Manual Approval Required' : 'Auto-Confirm'} icon="patch-check" description="Whether staff must approve each booking before confirmation." />
              </View>
            </View>
            <ReadOnlyField title="Service Status Workflow" value={settings.serviceStatusWorkflow || 'Pending → Confirmed → In Service → Ready → Completed'} icon="diagram-3" description="Canonical pitstop stages tracked on booking timeline." />
          </View>
        </View>
      )}

      {/* ─── SUBTAB 4: ALERTS & TELEMETRY ─── */}
      {canonicalTabId === 'notifications' && (
        <View style={{ gap: 20 }}>
          {/* Section 1: Customer Notification Dispatch */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="bell"
              title="Customer Notification Channels"
              subtitle="Configure automated text and email alerts sent to customers regarding orders and appointments."
              onEdit={() => openSectionModal('customer_notifications')}
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Pre-Appointment Reminder Lead Time"
                  value={`${settings.reminderHoursBefore || 24} Hours in Advance`}
                  icon="clock-history"
                  description="Automated SMS and email notice sent before appointment schedule."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Order Status SMS Dispatch"
                  value={settings.enableOrderSms ? 'Active' : 'Disabled'}
                  icon="chat-dots"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.enableOrderSms ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.enableOrderSms ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.enableOrderSms ? 'ACTIVE' : 'OFF'}
                      </Text>
                    </View>
                  }
                  description="Sends text messages when order status transitions to shipped or delivered."
                />
              </View>
            </View>

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Email Order Receipts & Invoices"
                  value={settings.enableOrderEmail !== false ? 'Active' : 'Disabled'}
                  icon="envelope-check"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.enableOrderEmail !== false ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.enableOrderEmail !== false ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.enableOrderEmail !== false ? 'ACTIVE' : 'OFF'}
                      </Text>
                    </View>
                  }
                  description="Sends PDF receipt and delivery tracking links to rider emails."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Automated PMS Appointment Reminders"
                  value={settings.enableBookingReminder !== false ? 'Active' : 'Disabled'}
                  icon="calendar-check"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.enableBookingReminder !== false ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.enableBookingReminder !== false ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.enableBookingReminder !== false ? 'ACTIVE' : 'OFF'}
                      </Text>
                    </View>
                  }
                  description="Pings riders with directions and checklist prior to pitstop arrival."
                />
              </View>
            </View>
          </View>

          {/* Section 2: Administrative Alert Escalations */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="shield-exclamation"
              title="Administrative & Dispatch Alerts"
              subtitle="Emergency alerts sent directly to store administrators and pitstop coordinators."
              onEdit={() => openSectionModal('admin_alerts')}
            />

            <ReadOnlyField
              title="Central Dispatch Notification Email"
              value={settings.adminNotificationEmail}
              icon="envelope-at"
              description="Primary mailbox for receiving stock replenishment notices and booking alerts."
            />

            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Alert on Critical Low Stock"
                  value={settings.alertOnLowStock !== false ? 'Enabled' : 'Disabled'}
                  icon="boxes"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.alertOnLowStock !== false ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.alertOnLowStock !== false ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.alertOnLowStock !== false ? 'ENABLED' : 'MUTED'}
                      </Text>
                    </View>
                  }
                  description="Sends immediate warning when any inventory SKU crosses reorder limit."
                />
              </View>

              <View style={{ flex: 1 }}>
                <ReadOnlyField
                  title="Push Alert on New Bookings"
                  value={settings.alertOnNewBooking !== false ? 'Enabled' : 'Disabled'}
                  icon="bell-fill"
                  badge={
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: settings.alertOnNewBooking !== false ? '#DCFCE7' : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: settings.alertOnNewBooking !== false ? '#166534' : '#64748B',
                        }}
                      >
                        {settings.alertOnNewBooking !== false ? 'ENABLED' : 'MUTED'}
                      </Text>
                    </View>
                  }
                  description="Notifies service advisors the moment a rider books a service slot."
                />
              </View>
            </View>
          </View>

          <View style={{ backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0', gap: 16 }}>
            <SectionHeader
              icon="megaphone"
              title="Notifications & Communication"
              subtitle="Toggle system notifications and customer communication preferences."
            />
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Email Notifications"
                  icon="envelope"
                  description="Master switch for outbound storefront emails."
                  value={settings.enableOrderEmail}
                  onToggle={(next) => handleToggleSetting('enableOrderEmail', next)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Order Notifications"
                  icon="receipt"
                  description="Order placed, paid, shipped, and delivered updates."
                  value={settings.enableOrderNotifications}
                  onToggle={(next) => handleToggleSetting('enableOrderNotifications', next)}
                />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Booking Notifications"
                  icon="calendar-bell"
                  description="Appointment confirmations and pre-arrival reminders."
                  value={settings.enableBookingReminder}
                  onToggle={(next) => handleToggleSetting('enableBookingReminder', next)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Payment Notifications"
                  icon="credit-card-2-front"
                  description="Payment received, failed, and refund alerts."
                  value={settings.enablePaymentNotifications}
                  onToggle={(next) => handleToggleSetting('enablePaymentNotifications', next)}
                />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Stock Alerts"
                  icon="boxes"
                  description="Inventory threshold warnings for staff."
                  value={settings.enableStockAlerts}
                  onToggle={(next) => handleToggleSetting('enableStockAlerts', next)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Low-Stock Notifications"
                  icon="exclamation-triangle"
                  description="Urgent alerts when SKUs hit critical levels."
                  value={settings.alertOnLowStock}
                  onToggle={(next) => handleToggleSetting('alertOnLowStock', next)}
                />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Admin Alerts"
                  icon="shield-exclamation"
                  description="Dispatch alerts for new bookings and critical stock."
                  value={settings.alertOnNewBooking}
                  onToggle={(next) => handleToggleSetting('alertOnNewBooking', next)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ToggleSettingField
                  title="Customer Notifications"
                  icon="chat-dots"
                  description="SMS updates sent to customers for order and booking events."
                  value={settings.enableOrderSms}
                  defaultOn={false}
                  onToggle={(next) => handleToggleSetting('enableOrderSms', next)}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ─── SUBTAB 5: MAINTENANCE & BACKUP ─── */}
      {canonicalTabId === 'security' && (
        <View style={{ gap: 20 }}>
          <View style={{ backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0', gap: 16 }}>
            <SectionHeader icon="shield-lock" title="Security & System Settings" subtitle="Manage account security, authentication, system access, and maintenance options." onEdit={() => openSectionModal('security_system')} />
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Password Requirements" value={`${settings.passwordMinLength || 8}+ chars${settings.requireStrongPassword !== false ? ', Strong' : ''}`} icon="key" description="Minimum length and complexity enforced on new passwords." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="OTP Authentication" value={settings.otpEnabled !== false ? 'Enabled' : 'Disabled'} icon="patch-check" description="One-time passcode verification for signup and sensitive actions." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Session Timeout" value={`${settings.sessionTimeoutMinutes || 60} Minutes`} icon="clock-history" description="Auto-logout window for idle admin and staff sessions." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Login Protection" value={settings.loginProtection !== false ? 'Enabled' : 'Disabled'} icon="shield" description="Rate-limiting and lockout against brute-force sign-in attempts." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Admin Access" value={settings.adminAccessRestricted ? 'Restricted (Invite Only)' : 'Standard Role-Based'} icon="person-lock" description="Controls who can be granted administrator privileges." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Audit Logging" value={settings.auditLogging !== false ? 'Enabled' : 'Disabled'} icon="journal-text" description="Immutable trail of admin settings and order actions." />
              </View>
            </View>
            <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Automatic Backup" value={settings.autoBackup !== false ? 'Enabled' : 'Manual Only'} icon="cloud-check" description="Scheduled snapshots of system configuration data." />
              </View>
              <View style={{ flex: 1 }}>
                <ReadOnlyField title="Data Retention" value={`${settings.dataRetentionDays || 365} Days`} icon="database" description="How long transactional and audit records are preserved." />
              </View>
            </View>
            <ReadOnlyField title="System Maintenance Mode" value={settings.maintenanceMode || settings.isMaintenanceMode ? 'Active — Storefront Paused' : 'Inactive — Normal Operations'} icon="wrench-adjustable" description="Temporarily pause public checkout and booking for upgrades." />
          </View>
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <SectionHeader
              icon="wrench-adjustable"
              title="System Maintenance & Storefront Availability"
              subtitle="Temporarily pause public storefront checkout and appointment booking for platform upgrades."
              onEdit={() => openSectionModal('maintenance')}
            />

            <ReadOnlyField
              title="System Maintenance Mode"
              value={settings.maintenanceMode ? 'Active — Public Storefront Paused' : 'Inactive — Normal Operations'}
              icon="shield-lock"
              badge={
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: settings.maintenanceMode ? '#FEE2E2' : '#DCFCE7',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: settings.maintenanceMode ? '#B91C1C' : '#166534',
                    }}
                  >
                    {settings.maintenanceMode ? 'ACTIVE MAINTENANCE' : 'LIVE ONLINE'}
                  </Text>
                </View>
              }
              description="When active, customers see an emergency maintenance banner."
            />

            <ReadOnlyField
              title="Customer Maintenance Banner Notice"
              value={settings.maintenanceMessage}
              icon="chat-square-quote"
              description="Message displayed to storefront visitors when maintenance mode is active."
            />
          </View>

          {/* Section 2: Data Backup & Storage Utilities */}
          <View
            style={{
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)',
              gap: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? '#1A2622' : '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="database" size={20} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                  Data Backup & Storage Utilities
                </Text>
                <Text style={{ fontSize: 12.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                  Generate downloadable system configuration snapshots or clear non-critical local caches safely.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#2563EB',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
                onPress={handleExportBackup}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="download" size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
                  Export System Backup (JSON)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isDarkMode ? tokens.bgCard : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
                onPress={handleClearCache}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="trash3" size={14} color={isDarkMode ? tokens.textPrimary : '#475569'} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#475569' }}>
                  Purge System Cache
                </Text>
              </TouchableOpacity>
            </View>

            {/* System Telemetry Specs */}
            <View
              style={{
                marginTop: 8,
                padding: 16,
                borderRadius: 12,
                backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                borderWidth: 1,
                borderColor: isDarkMode ? tokens.bgCard : '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#6EE7B7' : '#EA580C', marginBottom: 12 }}>
                Live System Telemetry & Statistics
              </Text>
              <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16, flexWrap: 'wrap' }}>
                <View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Framework</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                    Expo SDK 57 / React Native
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Database</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981', marginTop: 2 }}>
                    Postgres Supabase (Active)
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Catalog SKUs</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                    {(products || []).length} Products
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Customer Orders</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                    {(orders || []).length} Recorded
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Pitstop Bookings</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                    {(garageBookings || []).length} Appointments
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>Active Mechanics</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A', marginTop: 2 }}>
                    {(mechanicsList || []).length} Technicians
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          UNIFIED SECTION EDIT MODAL
          One organized modal containing all fields for the edited section
          ═══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!activeModalSection}
        transparent
        animationType="fade"
        onRequestClose={closeSectionModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
              maxHeight: '90%',
              backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 22,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? '#1A2622' : '#FFF7ED',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon
                    name={
                      activeModalSection === 'store_identity'
                        ? 'shop'
                        : activeModalSection === 'contact_hq'
                        ? 'geo-alt'
                        : activeModalSection === 'operating_schedule'
                        ? 'clock'
                        : activeModalSection === 'fulfillment'
                        ? 'truck'
                        : activeModalSection === 'inventory'
                        ? 'boxes'
                        : activeModalSection === 'garage_capacity'
                        ? 'tools'
                        : activeModalSection === 'garage_pricing'
                        ? 'credit-card'
                        : activeModalSection === 'customer_notifications'
                        ? 'bell'
                        : activeModalSection === 'admin_alerts'
                        ? 'shield-exclamation'
                        : activeModalSection === 'store_business'
                        ? 'building'
                        : activeModalSection === 'checkout_payment'
                        ? 'credit-card'
                        : activeModalSection === 'garage_operations'
                        ? 'gear'
                        : activeModalSection === 'notifications_hub'
                        ? 'megaphone'
                        : activeModalSection === 'security_system'
                        ? 'shield-lock'
                        : activeModalSection === 'footer_brand' || activeModalSection === 'shop_footer'
                        ? 'layout-text-window-reverse'
                        : activeModalSection === 'footer_links'
                        ? 'list-nested'
                        : activeModalSection === 'footer_social'
                        ? 'share'
                        : activeModalSection === 'footer_legal'
                        ? 'shield-check'
                        : 'wrench-adjustable'
                    }
                    size={20}
                    color="#EA580C"
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                    {activeModalSection === 'store_identity' && 'Edit Store Identity & Branding'}
                    {activeModalSection === 'contact_hq' && 'Edit Contact & Headquarters'}
                    {activeModalSection === 'operating_schedule' && 'Edit Operating Hours & Schedule'}
                    {activeModalSection === 'fulfillment' && 'Edit Order Fulfillment & Delivery'}
                    {activeModalSection === 'inventory' && 'Edit Inventory & Stock Controls'}
                    {activeModalSection === 'garage_capacity' && 'Edit Pitstop Bays & Capacity'}
                    {activeModalSection === 'garage_pricing' && 'Edit Booking Policies & Pricing'}
                    {activeModalSection === 'customer_notifications' && 'Edit Customer Notification Channels'}
                    {activeModalSection === 'admin_alerts' && 'Edit Administrative & Dispatch Alerts'}
                    {activeModalSection === 'maintenance' && 'Edit Maintenance Mode & Banner'}
                    {activeModalSection === 'store_business' && 'Edit Store & Business Configuration'}
                    {activeModalSection === 'checkout_payment' && 'Edit Checkout & Payment Settings'}
                    {activeModalSection === 'garage_operations' && 'Edit Garage & Service Configuration'}
                    {activeModalSection === 'notifications_hub' && 'Edit Notifications & Communication'}
                    {activeModalSection === 'security_system' && 'Edit Security & System Settings'}
                    {activeModalSection === 'footer_brand' && 'Edit Footer Brand & Column Headings'}
                    {activeModalSection === 'footer_links' && 'Edit Footer Navigation Links'}
                    {activeModalSection === 'footer_social' && 'Edit Footer Newsletter & Social Profiles'}
                    {activeModalSection === 'footer_legal' && 'Edit Footer Copyright & Legal Links'}
                    {activeModalSection === 'shop_footer' && 'Edit All Shop Footer Settings'}
                  </Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                    Update parameters below and click Save Changes to apply immediately.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={closeSectionModal}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? tokens.textPrimary : '#475569'} />
              </TouchableOpacity>
            </View>

            {/* Modal Form Content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 22, gap: 18 }}
              showsVerticalScrollIndicator={true}
            >
              {/* 1. STORE IDENTITY MODAL */}
              {activeModalSection === 'store_identity' && (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Official System / Store Name
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 15,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.storeName !== undefined ? modalForm.storeName : ''}
                      onChangeText={(val) => handleUpdateFormField('storeName', val)}
                      placeholder="e.g. MotoTrack"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textSubtle : '#94A3B8' }}>
                      Updates the brand title across the Admin Dashboard sidebar, top navigation, browser title, and receipts.
                    </Text>
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      System Brand Logo
                    </Text>

                    {/* Logo Preview and Actions Box */}
                    <View
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        flexDirection: isDesktop ? 'row' : 'column',
                        alignItems: isDesktop ? 'center' : 'flex-start',
                        gap: 16,
                      }}
                    >
                      {modalForm.storeLogoUrl ? (
                        <Image
                          source={{ uri: modalForm.storeLogoUrl }}
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? tokens.bgCard : '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                          }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 12,
                            backgroundColor: isDarkMode ? '#1A2622' : '#FFF7ED',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: isDarkMode ? '#EA580C' : '#A7F3D0',
                          }}
                        >
                          <BootstrapIcon name="tools" size={28} color="#EA580C" />
                        </View>
                      )}

                      <View style={{ flex: 1, gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                          {modalForm.storeLogoUrl ? 'Custom Brand Logo Uploaded' : 'Default MotoTrack System Logo'}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                          {modalForm.storeLogoUrl
                            ? 'Custom logo will be used in place of the default emblem.'
                            : 'Upload your organization or store logo from your computer.'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          <TouchableOpacity
                            onPress={handlePickLogoFile}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 13,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: '#EA580C',
                              cursor: 'pointer',
                            }}
                            activeOpacity={0.85}
                          >
                            <BootstrapIcon name="cloud-arrow-up-fill" size={14} color="#FFFFFF" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                              Upload Logo Image
                            </Text>
                          </TouchableOpacity>

                          {modalForm.storeLogoUrl ? (
                            <TouchableOpacity
                              onPress={() => handleUpdateFormField('storeLogoUrl', '')}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 11,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: isDarkMode ? tokens.borderInput : '#FEE2E2',
                                cursor: 'pointer',
                              }}
                              activeOpacity={0.85}
                            >
                              <BootstrapIcon name="trash" size={13} color="#EF4444" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>
                                Reset to Default
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Direct Image URL input */}
                    <View style={{ gap: 4, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                        Or paste external Image URL:
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 12.5,
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        value={modalForm.storeLogoUrl || ''}
                        onChangeText={(val) => handleUpdateFormField('storeLogoUrl', val)}
                        placeholder="https://example.com/logo.png"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Store Tagline / Slogan
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.storeTagline || ''}
                      onChangeText={(val) => handleUpdateFormField('storeTagline', val)}
                      placeholder="e.g. Premium Motorcycle Parts & Pitstop Service"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textSubtle : '#94A3B8' }}>
                      Short slogan displayed on banners and promotional headers.
                    </Text>
                  </View>
                </>
              )}

              {/* 2. CONTACT & HEADQUARTERS MODAL */}
              {activeModalSection === 'contact_hq' && (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Official Support Email
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.contactEmail || ''}
                      onChangeText={(val) => handleUpdateFormField('contactEmail', val)}
                      placeholder="e.g. contact@yourstore.ph"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Hotline / Phone Number
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.contactPhone || ''}
                      onChangeText={(val) => handleUpdateFormField('contactPhone', val)}
                      placeholder="e.g. +63 (02) 8000-0000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Workshop / Hub Facility Name
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.hubName !== undefined ? modalForm.hubName : ''}
                      onChangeText={(val) => handleUpdateFormField('hubName', val)}
                      placeholder="e.g. D'Blockchain Motorparts and Accessories"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textSubtle : '#94A3B8' }}>
                      Updates the workshop/hub title across customer booking cards, pit bay appointment confirmations, and maps.
                    </Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Store Physical Address & Hub Facility
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        padding: 12,
                        fontSize: 13.5,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        minHeight: 80,
                        textAlignVertical: 'top',
                      }}
                      multiline
                      value={modalForm.storeAddress || ''}
                      onChangeText={(val) => handleUpdateFormField('storeAddress', val)}
                      placeholder="e.g. Natalio B. Bacalso S National Hwy, South Poblacion, Naga, 6037 Cebu"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      City / Location
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.cityLocation || ''}
                      onChangeText={(val) => handleUpdateFormField('cityLocation', val)}
                      placeholder="e.g. City of Naga, Cebu"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Official Business Email
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.businessEmail || ''}
                      onChangeText={(val) => handleUpdateFormField('businessEmail', val)}
                      placeholder="e.g. sales@mototrack.ph"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                    />
                  </View>
                </>
              )}

              {/* 3. OPERATING SCHEDULE MODAL */}
              {activeModalSection === 'operating_schedule' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Opening Time
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        value={modalForm.openTime || ''}
                        onChangeText={(val) => handleUpdateFormField('openTime', val)}
                        placeholder="08:00 AM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Closing Time
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        value={modalForm.closeTime || ''}
                        onChangeText={(val) => handleUpdateFormField('closeTime', val)}
                        placeholder="07:00 PM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Operating Days / Weekly Schedule
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.operatingDays || ''}
                      onChangeText={(val) => handleUpdateFormField('operatingDays', val)}
                      placeholder="e.g. Monday – Saturday"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Default Currency Code
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.currencyCode || ''}
                      onChangeText={(val) => handleUpdateFormField('currencyCode', val)}
                      placeholder="PHP"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </>
              )}

              {/* 4. FULFILLMENT MODAL */}
              {activeModalSection === 'fulfillment' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Base Delivery Fee (₱)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.standardShippingFee !== undefined ? String(modalForm.standardShippingFee) : ''}
                        onChangeText={(val) => handleUpdateFormField('standardShippingFee', val)}
                        placeholder="100"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Free Shipping Min. (₱)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.freeShippingThreshold !== undefined ? String(modalForm.freeShippingThreshold) : ''}
                        onChangeText={(val) => handleUpdateFormField('freeShippingThreshold', val)}
                        placeholder="1500"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Estimated Delivery Lead Time (Days)
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      keyboardType="numeric"
                      value={modalForm.deliveryLeadTimeDays !== undefined ? String(modalForm.deliveryLeadTimeDays) : ''}
                      onChangeText={(val) => handleUpdateFormField('deliveryLeadTimeDays', val)}
                      placeholder="3"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Toggle: Auto-fulfill */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.autoFulfillOrders ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('autoFulfillOrders', !modalForm.autoFulfillOrders)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Auto-Fulfill Confirmed Orders
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Automatically mark successfully paid orders as ready for shipping.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.autoFulfillOrders ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.autoFulfillOrders ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* 5. INVENTORY MODAL */}
              {activeModalSection === 'inventory' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Low Stock Warning (Units)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.defaultReorderLevel !== undefined ? String(modalForm.defaultReorderLevel) : ''}
                        onChangeText={(val) => handleUpdateFormField('defaultReorderLevel', val)}
                        placeholder="5"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Critical Stock Level (Units)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.criticalStockLevel !== undefined ? String(modalForm.criticalStockLevel) : ''}
                        onChangeText={(val) => handleUpdateFormField('criticalStockLevel', val)}
                        placeholder="2"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Catalog SKU Code Prefix
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.skuPrefix || ''}
                      onChangeText={(val) => handleUpdateFormField('skuPrefix', val)}
                      placeholder="MT-"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Toggle: Backorders */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.enableBackorders ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('enableBackorders', !modalForm.enableBackorders)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Allow Customer Backorders
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Allow purchasing items even when local inventory reaches zero.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.enableBackorders ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.enableBackorders ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* 6. GARAGE CAPACITY MODAL */}
              {activeModalSection === 'garage_capacity' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Active Pitstop Bays
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.serviceBayCount !== undefined ? String(modalForm.serviceBayCount) : ''}
                        onChangeText={(val) => handleUpdateFormField('serviceBayCount', val)}
                        placeholder="4"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Max Bookings / Slot
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.maxConcurrentBookings !== undefined ? String(modalForm.maxConcurrentBookings) : ''}
                        onChangeText={(val) => handleUpdateFormField('maxConcurrentBookings', val)}
                        placeholder="4"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Slots per Mechanic
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.slotsPerMechanic !== undefined ? String(modalForm.slotsPerMechanic) : ''}
                        onChangeText={(val) => handleUpdateFormField('slotsPerMechanic', val)}
                        placeholder="2"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                        Daily slots = mechanics on duty that day × this number.
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Default Service Slot Duration (Minutes)
                      </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      keyboardType="numeric"
                      value={modalForm.slotDurationMinutes !== undefined ? String(modalForm.slotDurationMinutes) : ''}
                      onChangeText={(val) => handleUpdateFormField('slotDurationMinutes', val)}
                      placeholder="90"
                      placeholderTextColor="#94A3B8"
                    />
                    </View>
                  </View>

                  {/* Toggle: Auto-assign mechanics */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.autoAssignMechanics ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('autoAssignMechanics', !modalForm.autoAssignMechanics)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Auto-Assign Mechanics
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Automatically dispatch available mechanics to new customer appointments.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.autoAssignMechanics ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.autoAssignMechanics ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* 7. GARAGE PRICING & POLICIES MODAL */}
              {activeModalSection === 'garage_pricing' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Required Downpayment (%)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.downpaymentPercent !== undefined ? String(modalForm.downpaymentPercent) : ''}
                        onChangeText={(val) => handleUpdateFormField('downpaymentPercent', val)}
                        placeholder="20"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Hourly Labor Rate (₱/hr)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.laborRatePerHour !== undefined ? String(modalForm.laborRatePerHour) : ''}
                        onChangeText={(val) => handleUpdateFormField('laborRatePerHour', val)}
                        placeholder="350"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Downpayment Due Date (Hours After Booking)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.downpaymentDueHours !== undefined ? String(modalForm.downpaymentDueHours) : ''}
                        onChangeText={(val) => handleUpdateFormField('downpaymentDueHours', val)}
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B' }}>
                        Clock starts when the customer books. Unpaid bookings auto-cancel after this many hours and the customer is notified.
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Free Cancellation Cutoff (Hours)
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        keyboardType="numeric"
                        value={modalForm.allowCancellationHours !== undefined ? String(modalForm.allowCancellationHours) : ''}
                        onChangeText={(val) => handleUpdateFormField('allowCancellationHours', val)}
                        placeholder="24"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* Toggle: Enforce downpayment */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.requireDownpayment !== false ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('requireDownpayment', modalForm.requireDownpayment === false ? true : false)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Enforce Booking Downpayment
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Require upfront deposit reservation before booking slot is confirmed.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.requireDownpayment !== false ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.requireDownpayment !== false ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* 8. CUSTOMER NOTIFICATIONS MODAL */}
              {activeModalSection === 'customer_notifications' && (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Appointment Reminder Lead Time (Hours)
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      keyboardType="numeric"
                      value={modalForm.reminderHoursBefore !== undefined ? String(modalForm.reminderHoursBefore) : ''}
                      onChangeText={(val) => handleUpdateFormField('reminderHoursBefore', val)}
                      placeholder="24"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Toggle: SMS */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.enableOrderSms ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('enableOrderSms', !modalForm.enableOrderSms)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Order Status SMS Alerts
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Send SMS updates to riders when orders ship or are out for delivery.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.enableOrderSms ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.enableOrderSms ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>

                  {/* Toggle: Email Receipts */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.enableOrderEmail !== false ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('enableOrderEmail', modalForm.enableOrderEmail === false ? true : false)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Email Order Receipts & Invoices
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Send digital PDF receipts upon order payment completion.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.enableOrderEmail !== false ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.enableOrderEmail !== false ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>

                  {/* Toggle: Booking reminders */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.enableBookingReminder !== false ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('enableBookingReminder', modalForm.enableBookingReminder === false ? true : false)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Automated PMS Appointment Reminders
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Send appointment reminder notifications before scheduled bay check-in.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.enableBookingReminder !== false ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.enableBookingReminder !== false ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* 9. ADMIN ALERTS MODAL */}
              {activeModalSection === 'admin_alerts' && (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Central Dispatch Notification Email
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.adminNotificationEmail || ''}
                      onChangeText={(val) => handleUpdateFormField('adminNotificationEmail', val)}
                      placeholder="e.g. dispatch@mototrack.ph"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                    />
                  </View>

                  {/* Toggle: Alert on low stock */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.alertOnLowStock !== false ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('alertOnLowStock', modalForm.alertOnLowStock === false ? true : false)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Critical Low-Stock Alerts
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Notify inventory dispatch immediately when any SKU reaches critical level.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.alertOnLowStock !== false ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.alertOnLowStock !== false ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>

                  {/* Toggle: Alert on new booking */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.alertOnNewBooking !== false ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('alertOnNewBooking', modalForm.alertOnNewBooking === false ? true : false)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Push Alert on New Bookings
                      </Text>
                      <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Send immediate alert to staff when a rider reserves an appointment slot.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.alertOnNewBooking !== false ? '#EA580C' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.alertOnNewBooking !== false ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* 10. STORE BUSINESS MODAL */}
              {activeModalSection === 'store_business' && (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Store Status</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['open', 'closed'].map((s) => (
                        <TouchableOpacity key={s} onPress={() => handleUpdateFormField('storeStatus', s)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: (modalForm.storeStatus || 'open') === s ? '#EA580C' : isDarkMode ? tokens.bgSub : '#F1F5F9', borderWidth: 1.5, borderColor: (modalForm.storeStatus || 'open') === s ? '#EA580C' : '#CBD5E1' }} activeOpacity={0.85}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: (modalForm.storeStatus || 'open') === s ? '#FFFFFF' : '#64748B' }}>{s === 'open' ? 'Open' : 'Closed'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Minimum Order Amount (₱)</Text>
                    <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.minimumOrderAmount !== undefined ? String(modalForm.minimumOrderAmount) : ''} onChangeText={(val) => handleUpdateFormField('minimumOrderAmount', val)} placeholder="0" placeholderTextColor="#94A3B8" />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Opening</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} value={modalForm.openTime || ''} onChangeText={(val) => handleUpdateFormField('openTime', val)} placeholder="08:00 AM" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Closing</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} value={modalForm.closeTime || ''} onChangeText={(val) => handleUpdateFormField('closeTime', val)} placeholder="07:00 PM" placeholderTextColor="#94A3B8" />
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Business Days</Text>
                    <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} value={modalForm.operatingDays || ''} onChangeText={(val) => handleUpdateFormField('operatingDays', val)} placeholder="Monday – Saturday" placeholderTextColor="#94A3B8" />
                  </View>
                  {[
                    { key: 'deliveryAvailable', title: 'Delivery Availability', desc: 'Offer courier delivery at checkout.' },
                    { key: 'pickupAvailable', title: 'Pickup Availability', desc: 'Offer in-store pickup reservations.' },
                  ].map((t) => (
                    <TouchableOpacity key={t.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderWidth: 1.5, borderColor: modalForm[t.key] !== false ? '#EA580C' : '#CBD5E1' }} onPress={() => handleUpdateFormField(t.key, modalForm[t.key] === false ? true : false)} activeOpacity={0.8}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{t.title}</Text>
                        <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>{t.desc}</Text>
                      </View>
                      <View style={{ width: 48, height: 26, borderRadius: 13, backgroundColor: modalForm[t.key] !== false ? '#EA580C' : '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3, alignItems: modalForm[t.key] !== false ? 'flex-end' : 'flex-start' }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* 11. CHECKOUT PAYMENT MODAL */}
              {activeModalSection === 'checkout_payment' && (
                <>
                  {[
                    { key: 'codEnabled', title: 'Cash on Delivery', desc: 'Pay in cash upon delivery or pickup.' },
                    { key: 'onlinePaymentEnabled', title: 'Online Payment', desc: 'Accept GCash and online wallets.' },
                    { key: 'paymentVerificationRequired', title: 'Payment Verification', desc: 'Staff must verify online payments.' },
                  ].map((t) => (
                    <TouchableOpacity key={t.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderWidth: 1.5, borderColor: modalForm[t.key] !== false ? '#EA580C' : '#CBD5E1' }} onPress={() => handleUpdateFormField(t.key, modalForm[t.key] === false ? true : false)} activeOpacity={0.8}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{t.title}</Text>
                        <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>{t.desc}</Text>
                      </View>
                      <View style={{ width: 48, height: 26, borderRadius: 13, backgroundColor: modalForm[t.key] !== false ? '#EA580C' : '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3, alignItems: modalForm[t.key] !== false ? 'flex-end' : 'flex-start' }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                      </View>
                    </TouchableOpacity>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Min Order (₱)</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.minimumOrderAmount !== undefined ? String(modalForm.minimumOrderAmount) : ''} onChangeText={(val) => handleUpdateFormField('minimumOrderAmount', val)} placeholder="0" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Max COD (₱)</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.maxCodAmount !== undefined ? String(modalForm.maxCodAmount) : ''} onChangeText={(val) => handleUpdateFormField('maxCodAmount', val)} placeholder="50000" placeholderTextColor="#94A3B8" />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivery Fee (₱)</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.standardShippingFee !== undefined ? String(modalForm.standardShippingFee) : ''} onChangeText={(val) => handleUpdateFormField('standardShippingFee', val)} placeholder="100" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Free Threshold (₱)</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.freeShippingThreshold !== undefined ? String(modalForm.freeShippingThreshold) : ''} onChangeText={(val) => handleUpdateFormField('freeShippingThreshold', val)} placeholder="3500" placeholderTextColor="#94A3B8" />
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cancellation Window (Hours)</Text>
                    <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.allowCancellationHours !== undefined ? String(modalForm.allowCancellationHours) : ''} onChangeText={(val) => handleUpdateFormField('allowCancellationHours', val)} placeholder="24" placeholderTextColor="#94A3B8" />
                  </View>
                </>
              )}

              {/* 12. GARAGE OPERATIONS MODAL */}
              {activeModalSection === 'garage_operations' && (
                <>
                  {[
                    { key: 'serviceBookingEnabled', title: 'Service Booking Availability', desc: 'Accept new pitstop appointments.' },
                    { key: 'walkInAvailable', title: 'Walk-in Availability', desc: 'Allow riders without reservations.' },
                    { key: 'pmsEnabled', title: 'PMS Settings', desc: 'Offer preventive maintenance packages.' },
                    { key: 'bookingApprovalRequired', title: 'Booking Approval Required', desc: 'Staff must approve each booking.', invert: true },
                  ].map((t) => {
                    const on = t.invert ? !!modalForm[t.key] : modalForm[t.key] !== false;
                    return (
                      <TouchableOpacity key={t.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderWidth: 1.5, borderColor: on ? '#EA580C' : '#CBD5E1' }} onPress={() => handleUpdateFormField(t.key, t.invert ? !modalForm[t.key] : modalForm[t.key] === false ? true : false)} activeOpacity={0.8}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{t.title}</Text>
                          <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>{t.desc}</Text>
                        </View>
                        <View style={{ width: 48, height: 26, borderRadius: 13, backgroundColor: on ? '#EA580C' : '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Max Daily Bookings</Text>
                    <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.maxDailyAppointments !== undefined ? String(modalForm.maxDailyAppointments) : ''} onChangeText={(val) => handleUpdateFormField('maxDailyAppointments', val)} placeholder="24" placeholderTextColor="#94A3B8" />
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Service Status Workflow</Text>
                    <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} value={modalForm.serviceStatusWorkflow || ''} onChangeText={(val) => handleUpdateFormField('serviceStatusWorkflow', val)} placeholder="Pending → Confirmed → In Service → Ready → Completed" placeholderTextColor="#94A3B8" />
                  </View>
                </>
              )}

              {/* 13. NOTIFICATIONS HUB MODAL */}
              {activeModalSection === 'notifications_hub' && (
                <>
                  {[
                    { key: 'enableOrderEmail', title: 'Email Notifications', desc: 'Outbound storefront emails.', defOn: true },
                    { key: 'enableOrderNotifications', title: 'Order Notifications', desc: 'Placed, paid, shipped, delivered.', defOn: true },
                    { key: 'enableBookingReminder', title: 'Booking Notifications', desc: 'Confirmations and reminders.', defOn: true },
                    { key: 'enablePaymentNotifications', title: 'Payment Notifications', desc: 'Received, failed, refund alerts.', defOn: true },
                    { key: 'enableStockAlerts', title: 'Stock Alerts', desc: 'Inventory threshold warnings.', defOn: true },
                    { key: 'alertOnLowStock', title: 'Low-Stock Notifications', desc: 'Urgent critical-level alerts.', defOn: true },
                  ].map((t) => {
                    const on = t.defOn ? modalForm[t.key] !== false : !!modalForm[t.key];
                    return (
                      <TouchableOpacity key={t.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderWidth: 1.5, borderColor: on ? '#EA580C' : '#CBD5E1' }} onPress={() => handleUpdateFormField(t.key, t.defOn ? (modalForm[t.key] === false ? true : false) : !modalForm[t.key])} activeOpacity={0.8}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{t.title}</Text>
                          <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>{t.desc}</Text>
                        </View>
                        <View style={{ width: 48, height: 26, borderRadius: 13, backgroundColor: on ? '#EA580C' : '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* 14. SECURITY SYSTEM MODAL */}
              {activeModalSection === 'security_system' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Min Password Length</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.passwordMinLength !== undefined ? String(modalForm.passwordMinLength) : ''} onChangeText={(val) => handleUpdateFormField('passwordMinLength', val)} placeholder="8" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Session Timeout (min)</Text>
                      <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.sessionTimeoutMinutes !== undefined ? String(modalForm.sessionTimeoutMinutes) : ''} onChangeText={(val) => handleUpdateFormField('sessionTimeoutMinutes', val)} placeholder="60" placeholderTextColor="#94A3B8" />
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Data Retention (Days)</Text>
                    <TextInput style={{ backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }} keyboardType="numeric" value={modalForm.dataRetentionDays !== undefined ? String(modalForm.dataRetentionDays) : ''} onChangeText={(val) => handleUpdateFormField('dataRetentionDays', val)} placeholder="365" placeholderTextColor="#94A3B8" />
                  </View>
                  {[
                    { key: 'requireStrongPassword', title: 'Strong Password Requirements', desc: 'Enforce mixed case, numbers, symbols.', defOn: true },
                    { key: 'otpEnabled', title: 'OTP Authentication', desc: 'One-time passcodes for sensitive actions.', defOn: true },
                    { key: 'loginProtection', title: 'Login Protection', desc: 'Rate-limit and lockout brute force.', defOn: true },
                    { key: 'adminAccessRestricted', title: 'Restrict Admin Access', desc: 'Invite-only administrator grants.', defOn: false },
                    { key: 'auditLogging', title: 'Audit Logging', desc: 'Immutable admin action trail.', defOn: true },
                    { key: 'autoBackup', title: 'Automatic Backup', desc: 'Scheduled configuration snapshots.', defOn: true },
                  ].map((t) => {
                    const on = t.defOn ? modalForm[t.key] !== false : !!modalForm[t.key];
                    return (
                      <TouchableOpacity key={t.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC', borderWidth: 1.5, borderColor: on ? '#EA580C' : '#CBD5E1' }} onPress={() => handleUpdateFormField(t.key, t.defOn ? (modalForm[t.key] === false ? true : false) : !modalForm[t.key])} activeOpacity={0.8}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>{t.title}</Text>
                          <Text style={{ fontSize: 11.5, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>{t.desc}</Text>
                        </View>
                        <View style={{ width: 48, height: 26, borderRadius: 13, backgroundColor: on ? '#EA580C' : '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* 10. MAINTENANCE MODAL */}
              {activeModalSection === 'maintenance' && (
                <>
                  {/* Toggle: Maintenance mode */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: modalForm.maintenanceMode ? '#FEF2F2' : isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.maintenanceMode ? '#EF4444' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                    }}
                    onPress={() => handleUpdateFormField('maintenanceMode', !modalForm.maintenanceMode)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: modalForm.maintenanceMode ? '#B91C1C' : isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        System Maintenance Mode
                      </Text>
                      <Text style={{ fontSize: 12, color: modalForm.maintenanceMode ? '#DC2626' : isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        {modalForm.maintenanceMode
                          ? 'Storefront is currently paused. Visitors will see the maintenance notice.'
                          : 'Storefront is live and operating normally.'}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: modalForm.maintenanceMode ? '#EF4444' : '#CBD5E1',
                        justifyContent: 'center',
                        paddingHorizontal: 3,
                        alignItems: modalForm.maintenanceMode ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Customer Maintenance Banner Notice
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        padding: 12,
                        fontSize: 13.5,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        minHeight: 90,
                        textAlignVertical: 'top',
                      }}
                      multiline
                      value={modalForm.maintenanceMessage || ''}
                      onChangeText={(val) => handleUpdateFormField('maintenanceMessage', val)}
                      placeholder="e.g. MotoTrack is undergoing scheduled system upgrades. Storefront ordering will resume shortly."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </>
              )}
              {/* ─── FOOTER SETTINGS MODAL SECTIONS ─── */}
              {(activeModalSection === 'footer_brand' || activeModalSection === 'shop_footer') && (
                <View style={{ gap: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Brand Identity & Column Headers
                  </Text>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Footer Brand Tagline
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerTagline !== undefined ? modalForm.footerTagline : ''}
                      onChangeText={(val) => handleUpdateFormField('footerTagline', val)}
                      placeholder="e.g. Ride Better. Go Further."
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textSubtle : '#94A3B8' }}>
                      Promotional slogan rendered directly below the logo in the shop footer.
                    </Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      About Summary Blurb
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 13.5,
                        fontWeight: '500',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        minHeight: 60,
                        textAlignVertical: 'top',
                      }}
                      multiline
                      value={modalForm.footerAboutText !== undefined ? modalForm.footerAboutText : ''}
                      onChangeText={(val) => handleUpdateFormField('footerAboutText', val)}
                      placeholder="Brief company mission or description..."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Column 2 Heading (Quick Links)
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerQuickLinksTitle !== undefined ? modalForm.footerQuickLinksTitle : ''}
                      onChangeText={(val) => handleUpdateFormField('footerQuickLinksTitle', val)}
                      placeholder="Quick Links"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Column 3 Heading (Customer Care)
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerCustomerCareTitle !== undefined ? modalForm.footerCustomerCareTitle : ''}
                      onChangeText={(val) => handleUpdateFormField('footerCustomerCareTitle', val)}
                      placeholder="Customer Care"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Column 4 Heading (Stay Connected)
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerStayConnectedTitle !== undefined ? modalForm.footerStayConnectedTitle : ''}
                      onChangeText={(val) => handleUpdateFormField('footerStayConnectedTitle', val)}
                      placeholder="Stay Connected"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              )}

              {(activeModalSection === 'footer_links' || activeModalSection === 'shop_footer') && (
                <View style={{ gap: 14, marginTop: activeModalSection === 'shop_footer' ? 16 : 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Quick Links & Customer Care Navigation
                  </Text>

                  {/* Quick links labels */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                      Column 2: Quick Links Navigation Labels
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Shop Page Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkShopLabel !== undefined ? modalForm.footerLinkShopLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkShopLabel', val)}
                          placeholder="Shop"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Service Booking Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkServiceLabel !== undefined ? modalForm.footerLinkServiceLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkServiceLabel', val)}
                          placeholder="Book a Service"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Customizer Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkCustomizeLabel !== undefined ? modalForm.footerLinkCustomizeLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkCustomizeLabel', val)}
                          placeholder="Customize"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>About Us Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkAboutLabel !== undefined ? modalForm.footerLinkAboutLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkAboutLabel', val)}
                          placeholder="About Us"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Customer Care Labels */}
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                      Column 3: Customer Care Navigation Labels
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Help Center Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkHelpLabel !== undefined ? modalForm.footerLinkHelpLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkHelpLabel', val)}
                          placeholder="Help Center"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Shipping & Delivery Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkShippingLabel !== undefined ? modalForm.footerLinkShippingLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkShippingLabel', val)}
                          placeholder="Shipping & Delivery"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Returns & Refunds Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkReturnsLabel !== undefined ? modalForm.footerLinkReturnsLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkReturnsLabel', val)}
                          placeholder="Returns & Refunds"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Contact Us Label</Text>
                        <TextInput
                          style={{
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            fontWeight: '600',
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerLinkContactLabel !== undefined ? modalForm.footerLinkContactLabel : ''}
                          onChangeText={(val) => handleUpdateFormField('footerLinkContactLabel', val)}
                          placeholder="Contact Us"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {(activeModalSection === 'footer_social' || activeModalSection === 'shop_footer') && (
                <View style={{ gap: 14, marginTop: activeModalSection === 'shop_footer' ? 16 : 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Newsletter Subscription & Social Media Profiles
                  </Text>

                  {/* Newsletter Enabled Toggle */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      borderWidth: 1.5,
                      borderColor: modalForm.footerNewsletterEnabled !== false ? '#EA580C' : isDarkMode ? tokens.borderInput : '#CBD5E1',
                      cursor: 'pointer',
                    }}
                    onPress={() => handleUpdateFormField('footerNewsletterEnabled', modalForm.footerNewsletterEnabled === false ? true : false)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                        Enable Newsletter Email Subscription
                      </Text>
                      <Text style={{ fontSize: 11, color: isDarkMode ? tokens.textMuted : '#64748B', marginTop: 2 }}>
                        Displays the email input box and subscription action in Column 4.
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: modalForm.footerNewsletterEnabled !== false ? '#EA580C' : '#CBD5E1',
                        padding: 2,
                        justifyContent: 'center',
                        alignItems: modalForm.footerNewsletterEnabled !== false ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </TouchableOpacity>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Newsletter Subtitle Copy
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 13.5,
                        fontWeight: '500',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerNewsletterSubtitle !== undefined ? modalForm.footerNewsletterSubtitle : ''}
                      onChangeText={(val) => handleUpdateFormField('footerNewsletterSubtitle', val)}
                      placeholder="e.g. Get the latest updates, promos and more."
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Newsletter Input Placeholder Text
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 13.5,
                        fontWeight: '500',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerNewsletterPlaceholder !== undefined ? modalForm.footerNewsletterPlaceholder : ''}
                      onChangeText={(val) => handleUpdateFormField('footerNewsletterPlaceholder', val)}
                      placeholder="e.g. Enter your email address"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  {/* Social Profile URLs */}
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? tokens.textPrimary : '#0F172A' }}>
                      Social Media Community URLs
                    </Text>
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#1877F2', alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="facebook" size={16} color="#FFFFFF" />
                        </View>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerSocialFacebook !== undefined ? modalForm.footerSocialFacebook : ''}
                          onChangeText={(val) => handleUpdateFormField('footerSocialFacebook', val)}
                          placeholder="https://facebook.com/yourpage"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#E4405F', alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="instagram" size={16} color="#FFFFFF" />
                        </View>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerSocialInstagram !== undefined ? modalForm.footerSocialInstagram : ''}
                          onChangeText={(val) => handleUpdateFormField('footerSocialInstagram', val)}
                          placeholder="https://instagram.com/yourhandle"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FF0000', alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="youtube" size={16} color="#FFFFFF" />
                        </View>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerSocialYoutube !== undefined ? modalForm.footerSocialYoutube : ''}
                          onChangeText={(val) => handleUpdateFormField('footerSocialYoutube', val)}
                          placeholder="https://youtube.com/@channel"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }}>
                          <BootstrapIcon name="tiktok" size={16} color="#FFFFFF" />
                        </View>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            color: isDarkMode ? tokens.textPrimary : '#0F172A',
                          }}
                          value={modalForm.footerSocialTiktok !== undefined ? modalForm.footerSocialTiktok : ''}
                          onChangeText={(val) => handleUpdateFormField('footerSocialTiktok', val)}
                          placeholder="https://tiktok.com/@profile"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {(activeModalSection === 'footer_legal' || activeModalSection === 'shop_footer') && (
                <View style={{ gap: 14, marginTop: activeModalSection === 'shop_footer' ? 16 : 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Copyright & Bottom Bar Compliance
                  </Text>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: isDarkMode ? tokens.textMuted : '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Copyright Statement Notice
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 13.5,
                        fontWeight: '600',
                        color: isDarkMode ? tokens.textPrimary : '#0F172A',
                      }}
                      value={modalForm.footerCopyrightText !== undefined ? modalForm.footerCopyrightText : ''}
                      onChangeText={(val) => handleUpdateFormField('footerCopyrightText', val)}
                      placeholder={'© ' + new Date().getFullYear() + ' ' + (settings.storeName || 'MotoTrack') + '. All rights reserved.'}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>Terms of Service Label</Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 13,
                          fontWeight: '600',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        value={modalForm.footerTermsLabel !== undefined ? modalForm.footerTermsLabel : ''}
                        onChangeText={(val) => handleUpdateFormField('footerTermsLabel', val)}
                        placeholder="Terms of Service"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>Privacy Policy Label</Text>
                      <TextInput
                        style={{
                          backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? tokens.borderInput : '#CBD5E1',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 13,
                          fontWeight: '600',
                          color: isDarkMode ? tokens.textPrimary : '#0F172A',
                        }}
                        value={modalForm.footerPrivacyLabel !== undefined ? modalForm.footerPrivacyLabel : ''}
                        onChangeText={(val) => handleUpdateFormField('footerPrivacyLabel', val)}
                        placeholder="Privacy Policy"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              )}

            </ScrollView>

            {/* Modal Footer */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 22,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? tokens.borderInput : '#E2E8F0',
                backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
              }}
            >
              <TouchableOpacity
                onPress={closeSectionModal}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? tokens.bgCard : '#E2E8F0',
                  cursor: 'pointer',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? tokens.textPrimary : '#475569' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveSectionModal}
                disabled={isModalSaving}
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
                  opacity: isModalSaving ? 0.7 : 1,
                }}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="check-lg" size={15} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
                  {isModalSaving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dedicated Brand Identity Modal with Live Dual Theme Previews */}
      <EditBrandModal
        visible={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />
    </View>
  );
}
