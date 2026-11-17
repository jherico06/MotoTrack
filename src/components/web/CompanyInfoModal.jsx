import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../common/BootstrapIcon.jsx';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { fontFamily, fontWeights } from '../../styles/typography.js';

const getPillars = (isDark) => [
  {
    icon: 'patch-check-fill',
    iconColor: isDark ? '#00C98D' : '#059669',
    iconBg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
    title: '100% Authentic Parts',
    desc: 'Direct authorized partnerships with Akrapovič, Brembo, Öhlins, Motul, and Pirelli. Every component is serial-verified and covered by factory warranty.',
  },
  {
    icon: 'speedometer2',
    iconColor: isDark ? '#3B82F6' : '#2563EB',
    iconBg: isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
    title: 'Dynojet Pit Bays',
    desc: 'Our Flagship Center features 6 dedicated pit bays, calibrated chassis dyno cells, and certified master technicians for precision ECU remapping and engine overhauls.',
  },
  {
    icon: 'lightning-charge-fill',
    iconColor: isDark ? '#F5B942' : '#D97706',
    iconBg: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
    title: 'Fast Track Dispatch',
    desc: 'Same-day courier dispatch across Metro Cebu and express nationwide delivery with live real-time GPS tracking from our hub to your doorstep.',
  },
  {
    icon: 'shield-lock-fill',
    iconColor: isDark ? '#A78BFA' : '#7C3AED',
    iconBg: isDark ? 'rgba(139, 92, 246, 0.14)' : '#F5F3FF',
    title: 'Secure Transactions',
    desc: 'Bank-grade 256-bit SSL encrypted checkout supporting GCash e-wallets, Cash on Delivery (COD), and major credit/debit networks.',
  },
];

const getTermsSections = (storeName) => [
  {
    num: '01',
    title: 'Platform Acceptance & Vehicle Fitment',
    body: `By accessing, purchasing parts, or booking garage services through ${storeName}, you agree to these Terms of Service. Customers are responsible for verifying that selected parts match their motorcycle make, model, engine displacement (cc), and production year prior to checkout.`,
  },
  {
    num: '02',
    title: 'Genuine Product Guarantee & Warranty',
    body: `All exhausts, braking systems, suspension components, oils, and accessories sold on ${storeName} are 100% authentic and sourced through authorized distribution channels. Manufacturer warranty claims require valid proof of purchase and unaltered product serial numbers.`,
  },
  {
    num: '03',
    title: 'Payments, Checkout & Order Verification',
    body: `${storeName} supports Cash on Delivery (subject to eligible order limits), GCash, and online payments via Xendit checkout invoices. Orders and service reservations are processed once payment or COD verification is completed.`,
  },
  {
    num: '04',
    title: 'Pit Bay Bookings, Downpayments & Rescheduling',
    body: 'Dedicated garage and PMS pit bay reservations may require an advance downpayment within the specified payment window to confirm your slot; unpaid reservations expire automatically. Requests to reschedule or cancel at least 24 hours before the scheduled time are eligible without penalty.',
  },
  {
    num: '05',
    title: 'Shipping, Dispatch & Delivery Confirmation',
    body: 'Confirmed orders are dispatched with real-time route tracking and a delivery verification token or QR confirmation for secure handoff. Estimated transit times may vary due to courier availability, weather advisories, or corridor traffic conditions.',
  },
  {
    num: '06',
    title: 'AI Customizer & Technical Installation Disclaimer',
    body: `AI Customizer previews are visual concepts only and may differ from physical fitment. Performance upgrades—including exhausts, brake lines, suspension, ECU tuning, and engine kits—must be installed by certified technicians. ${storeName} is not liable for damage or injury resulting from improper self-installation or unauthorized modifications.`,
  },
];

const getPrivacySections = (storeName) => [
  {
    num: '01',
    title: 'Commitment to Data Privacy (RA 10173)',
    body: `${storeName} respects your privacy and complies with Republic Act No. 10173 (Data Privacy Act of the Philippines). This policy explains how we collect, process, store, and safeguard your personal, vehicle, and transaction data.`,
  },
  {
    num: '02',
    title: 'Information We Collect',
    bullets: [
      {
        label: 'Account & Identity:',
        text: 'Full name, verified email address, mobile contact number, and account preferences.',
      },
      {
        label: 'Vehicle & Garage Registry:',
        text: 'Motorcycle make, model, displacement (cc), license plate, and odometer/service history for accurate fitment and PMS records.',
      },
      {
        label: 'Orders & Delivery:',
        text: 'Shipping addresses, pin coordinates, order items, and delivery confirmation tokens.',
      },
      {
        label: 'Customizer & Support Media:',
        text: 'Photos uploaded for AI Customizer previews, service requests, or delivery issue reports.',
      },
    ],
  },
  {
    num: '03',
    title: 'How We Use Your Data',
    body: `We use collected data strictly to fulfill parts orders, validate motorcycle compatibility, assign and schedule pit bay technicians, deliver live order/service status notifications, and provide rider support.`,
  },
  {
    num: '04',
    title: 'Payment Security & Third-Party Gateways',
    body: `Online checkout and booking downpayments are encrypted over HTTPS/TLS and processed through authorized payment partners such as Xendit and GCash. ${storeName} never stores raw card CVVs, bank passwords, or e-wallet PINs on its servers.`,
  },
  {
    num: '05',
    title: 'Location & Live Dispatch Telemetry',
    body: 'Delivery coordinates and live rider telemetry are used solely to route and verify active dispatches. Real-time tracking access ends automatically once your order is marked Delivered/Completed.',
  },
  {
    num: '06',
    title: 'Data Retention & Rider Rights',
    body: 'Under the Data Privacy Act, you may access, correct, or request deletion of your profile and registered motorcycle records at any time through Profile Settings or by emailing privacy@mototrack.com.',
  },
];

export default function CompanyInfoModal({
  visible,
  initialTab = 'about', // 'about' | 'contact' | 'terms' | 'privacy'
  onClose,
  showToast,
  isDark: isDarkProp,
}) {
  const { isDarkMode: themeDark = false } = useTheme?.() || {};
  const isDarkMode = typeof isDarkProp === 'boolean' ? isDarkProp : Boolean(themeDark);
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [brandSettings, setBrandSettings] = useState(() => systemSettingsService.getSettings());
  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimerRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  useEffect(() => {
    const unsub = systemSettingsService.subscribe(setBrandSettings);
    return unsub;
  }, []);

  useEffect(() => {
    if (visible && initialTab) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const storeName = brandSettings.storeName || 'MotoTrack';
  const pillars = getPillars(isDarkMode);
  const termsSections = getTermsSections(storeName);
  const privacySections = getPrivacySections(storeName);

  const tabs = [
    { id: 'about', label: 'About Us', icon: 'info-circle-fill' },
    { id: 'contact', label: 'Contact', icon: 'telephone-fill' },
    { id: 'terms', label: 'Terms of Service', icon: 'file-earmark-text-fill' },
    { id: 'privacy', label: 'Privacy Policy', icon: 'shield-lock-fill' },
  ];

  const handleCopy = async (text, label, key) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Fallback silently if clipboard permission is unavailable
    }

    setCopiedKey(key);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedKey(null);
    }, 2000);

    if (showToast) {
      showToast(`Copied ${label} to clipboard!`);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isDesktop ? styles.backdropDesktop : styles.backdropMobile]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.dialog, isDesktop ? styles.dialogDesktop : styles.dialogMobile]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {storeName} Information Center
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Official Performance Network & Legal Policies
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close modal"
            >
              <BootstrapIcon name="x-lg" size={16} color={isDarkMode ? '#A1A1AA' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.tabsRow, isDesktop && styles.tabsRowDesktop]}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.75}
                  >
                    <BootstrapIcon
                      name={tab.icon}
                      size={14}
                      color={isActive ? '#EA580C' : isDarkMode ? '#A1A1AA' : '#64748B'}
                    />
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[styles.bodyContent, !isDesktop && styles.bodyContentMobile]}
            showsVerticalScrollIndicator
          >
            {/* ─── ABOUT US ─── */}
            {activeTab === 'about' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeading}>Why Choose {storeName}?</Text>
                <View style={[styles.gridWrap, !isDesktop && styles.gridWrapMobile]}>
                  {pillars.map((pillar) => (
                    <View
                      key={pillar.title}
                      style={[styles.pillarCard, isDesktop && styles.gridCardHalf]}
                    >
                      <View style={[styles.pillarIconBox, { backgroundColor: pillar.iconBg }]}>
                        <BootstrapIcon name={pillar.icon} size={18} color={pillar.iconColor} />
                      </View>
                      <Text style={styles.pillarTitle}>{pillar.title}</Text>
                      <Text style={styles.pillarDesc}>{pillar.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── CONTACT ─── */}
            {activeTab === 'contact' && (
              <View style={styles.tabContent}>
                <View style={styles.sectionIntro}>
                  <Text style={styles.sectionHeading}>Get In Touch With {storeName}</Text>
                  <Text style={styles.paragraph}>
                    Have a question regarding parts fitment, track tuning packages, or your
                    delivery? Our rider support team and certified pit bay technicians are ready to
                    assist you.
                  </Text>
                </View>

                <View style={[styles.gridWrap, !isDesktop && styles.gridWrapMobile]}>
                  {/* Address */}
                  <View style={[styles.contactCard, isDesktop && styles.gridCardHalf]}>
                    <View style={styles.contactCardHeader}>
                      <View style={styles.contactIconBox}>
                        <BootstrapIcon name="geo-alt-fill" size={18} color="#EA580C" />
                      </View>
                      <View style={styles.contactHeaderText}>
                        <Text style={styles.contactLabel}>Flagship Central Pit Bays</Text>
                        <Text style={styles.contactSubBadge}>Main Service Hub</Text>
                      </View>
                    </View>
                    <Text style={styles.contactValue}>
                      East Poblacion, City of Naga, Cebu (South Road Corridor), Philippines 6037
                    </Text>
                  </View>

                  {/* Hotlines */}
                  <View style={[styles.contactCard, isDesktop && styles.gridCardHalf]}>
                    <View style={styles.contactCardHeader}>
                      <View style={styles.contactIconBox}>
                        <BootstrapIcon name="telephone-fill" size={18} color="#EA580C" />
                      </View>
                      <View style={styles.contactHeaderText}>
                        <Text style={styles.contactLabel}>Customer & Garage Hotline</Text>
                        <Text style={styles.contactSubBadge}>Direct Line & Landline</Text>
                      </View>
                    </View>
                    <View style={styles.contactValueGroup}>
                      <Text style={[styles.contactValue, styles.tabularText]}>
                        (+63) 917 882 9102
                      </Text>
                      <Text style={[styles.contactSecondaryValue, styles.tabularText]}>
                        (032) 489-2100
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCopy('+639178829102', 'Hotline', 'hotline')}
                      style={[
                        styles.copyPillBtn,
                        copiedKey === 'hotline' && styles.copyPillBtnCopied,
                      ]}
                      activeOpacity={0.75}
                    >
                      <BootstrapIcon
                        name={copiedKey === 'hotline' ? 'check' : 'copy'}
                        size={12}
                        color={copiedKey === 'hotline' ? '#059669' : '#EA580C'}
                      />
                      <Text
                        style={[
                          styles.copyPillText,
                          copiedKey === 'hotline' && styles.copyPillTextCopied,
                        ]}
                      >
                        {copiedKey === 'hotline' ? 'Copied hotline' : 'Copy hotline'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Email */}
                  <View style={[styles.contactCard, isDesktop && styles.gridCardHalf]}>
                    <View style={styles.contactCardHeader}>
                      <View style={styles.contactIconBox}>
                        <BootstrapIcon name="envelope-fill" size={18} color="#EA580C" />
                      </View>
                      <View style={styles.contactHeaderText}>
                        <Text style={styles.contactLabel}>Official Support Email</Text>
                        <Text style={styles.contactSubBadge}>Orders & Pit Bay Inquiries</Text>
                      </View>
                    </View>
                    <View style={styles.contactValueGroup}>
                      <Text style={styles.contactValue}>support@mototrack.com</Text>
                      <Text style={styles.contactSecondaryValue}>pitbay@mototrack.com</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCopy('support@mototrack.com', 'Support email', 'email')}
                      style={[
                        styles.copyPillBtn,
                        copiedKey === 'email' && styles.copyPillBtnCopied,
                      ]}
                      activeOpacity={0.75}
                    >
                      <BootstrapIcon
                        name={copiedKey === 'email' ? 'check' : 'copy'}
                        size={12}
                        color={copiedKey === 'email' ? '#059669' : '#EA580C'}
                      />
                      <Text
                        style={[
                          styles.copyPillText,
                          copiedKey === 'email' && styles.copyPillTextCopied,
                        ]}
                      >
                        {copiedKey === 'email' ? 'Copied email' : 'Copy email'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Operating Hours */}
                  <View style={[styles.contactCard, isDesktop && styles.gridCardHalf]}>
                    <View style={styles.contactCardHeader}>
                      <View style={styles.contactIconBox}>
                        <BootstrapIcon name="clock-fill" size={18} color="#EA580C" />
                      </View>
                      <View style={styles.contactHeaderText}>
                        <Text style={styles.contactLabel}>Operating Hours</Text>
                        <Text style={styles.contactSubBadge}>Philippine Standard Time</Text>
                      </View>
                    </View>
                    <View style={styles.contactValueGroup}>
                      <Text style={styles.contactValue}>Monday – Sunday</Text>
                      <Text style={[styles.contactSecondaryValue, styles.tabularText]}>
                        8:00 AM – 6:30 PM (PHT)
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusBadgeText}>
                        Pit Bays & Online Dispatch Open Daily
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ─── TERMS OF SERVICE ─── */}
            {activeTab === 'terms' && (
              <View style={styles.tabContent}>
                <View style={styles.legalHeaderRow}>
                  <Text style={styles.sectionHeading}>Terms of Service</Text>
                  <View style={styles.effectiveBadge}>
                    <Text style={styles.effectiveBadgeText}>Effective: November 2026</Text>
                  </View>
                </View>

                <View style={styles.legalList}>
                  {termsSections.map((item) => (
                    <View key={item.num} style={styles.legalSection}>
                      <View style={styles.legalTitleRow}>
                        <View style={styles.legalNumBadge}>
                          <Text style={styles.legalNumText}>{item.num}</Text>
                        </View>
                        <Text style={styles.legalTitle}>{item.title}</Text>
                      </View>
                      <Text style={styles.legalBody}>{item.body}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── PRIVACY POLICY ─── */}
            {activeTab === 'privacy' && (
              <View style={styles.tabContent}>
                <View style={styles.legalHeaderRow}>
                  <Text style={styles.sectionHeading}>Privacy & Data Protection Policy</Text>
                  <View style={styles.effectiveBadge}>
                    <Text style={styles.effectiveBadgeText}>Effective: November 2026</Text>
                  </View>
                </View>

                <View style={styles.legalList}>
                  {privacySections.map((item) => (
                    <View key={item.num} style={styles.legalSection}>
                      <View style={styles.legalTitleRow}>
                        <View style={styles.legalNumBadge}>
                          <Text style={styles.legalNumText}>{item.num}</Text>
                        </View>
                        <Text style={styles.legalTitle}>{item.title}</Text>
                      </View>
                      {item.body ? <Text style={styles.legalBody}>{item.body}</Text> : null}
                      {item.bullets ? (
                        <View style={styles.bulletList}>
                          {item.bullets.map((bullet) => (
                            <View key={bullet.label} style={styles.bulletRow}>
                              <View style={styles.bulletDot} />
                              <Text style={[styles.legalBody, styles.bulletText]}>
                                <Text style={styles.bulletLabel}>{bullet.label} </Text>
                                {bullet.text}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (isDark = false) => {
  const bgDialog = isDark ? '#191A1D' : '#FFFFFF';
  const bgSub = isDark ? '#18181B' : '#F8FAFC';
  const bgElevated = isDark ? '#202124' : '#F1F5F9';
  const border = isDark ? '#303236' : '#E2E8F0';
  const borderLight = isDark ? '#242930' : '#F1F5F9';
  const textPrimary = isDark ? '#F2F2F3' : '#0F172A';
  const textSecondary = isDark ? '#A1A1AA' : '#475569';
  const textMuted = isDark ? '#A1A1AA' : '#64748B';
  const orangeSoft = isDark ? 'rgba(234, 88, 12, 0.14)' : '#FFF7ED';
  const orangeBorder = isDark ? 'rgba(234, 88, 12, 0.32)' : '#FED7AA';

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.6)',
    },
    backdropDesktop: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    backdropMobile: {
      justifyContent: 'flex-end',
      alignItems: 'stretch',
      padding: 0,
      zIndex: 9999,
    },
    dialog: {
      width: '100%',
      backgroundColor: bgDialog,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.45 : 0.16,
      shadowRadius: 32,
      elevation: 12,
      maxHeight: '90%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    dialogDesktop: {
      maxWidth: 740,
      maxHeight: '88%',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: border,
    },
    dialogMobile: {
      maxWidth: '100%',
      maxHeight: '92%',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 22,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: borderLight,
      backgroundColor: bgDialog,
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      fontFamily: fontFamily.sans,
      fontSize: 16,
      fontWeight: fontWeights.semiBold,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: textPrimary,
    },
    headerSubtitle: {
      fontFamily: fontFamily.sans,
      fontSize: 12,
      fontWeight: fontWeights.regular,
      lineHeight: 16,
      color: textMuted,
      marginTop: 1,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    tabsWrapper: {
      borderBottomWidth: 1,
      borderBottomColor: border,
      backgroundColor: bgSub,
    },
    tabsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 4,
    },
    tabsRowDesktop: {
      paddingHorizontal: 18,
      gap: 6,
    },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      cursor: 'pointer',
    },
    tabBtnActive: {
      borderBottomColor: '#EA580C',
      backgroundColor: bgDialog,
    },
    tabText: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      fontWeight: fontWeights.medium,
      lineHeight: 18,
      color: textMuted,
    },
    tabTextActive: {
      color: '#EA580C',
      fontWeight: fontWeights.semiBold,
    },
    bodyScroll: {
      flex: 1,
      backgroundColor: bgDialog,
    },
    bodyContent: {
      padding: 24,
    },
    bodyContentMobile: {
      padding: 18,
    },
    tabContent: {
      gap: 16,
    },
    sectionIntro: {
      gap: 6,
    },
    sectionHeading: {
      fontFamily: fontFamily.sans,
      fontSize: 16,
      fontWeight: fontWeights.semiBold,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: textPrimary,
    },
    paragraph: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      fontWeight: fontWeights.regular,
      lineHeight: 20,
      color: textSecondary,
    },
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    gridWrapMobile: {
      flexDirection: 'column',
    },
    gridCardHalf: {
      width: '48.8%',
      flexGrow: 1,
    },
    pillarCard: {
      backgroundColor: isDark ? bgSub : '#FFFFFF',
      borderWidth: 1,
      borderColor: border,
      borderRadius: 12,
      padding: 16,
    },
    pillarIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    pillarTitle: {
      fontFamily: fontFamily.sans,
      fontSize: 14,
      fontWeight: fontWeights.semiBold,
      lineHeight: 20,
      letterSpacing: -0.1,
      color: textPrimary,
      marginBottom: 4,
    },
    pillarDesc: {
      fontFamily: fontFamily.sans,
      fontSize: 12.5,
      fontWeight: fontWeights.regular,
      lineHeight: 18,
      color: textMuted,
    },
    contactCard: {
      backgroundColor: bgSub,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 14,
      padding: 16,
      gap: 12,
      justifyContent: 'space-between',
    },
    contactCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    contactIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: orangeSoft,
      borderWidth: 1,
      borderColor: orangeBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    contactLabel: {
      fontFamily: fontFamily.sans,
      fontSize: 10.5,
      fontWeight: fontWeights.semiBold,
      lineHeight: 14,
      color: textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    contactSubBadge: {
      fontFamily: fontFamily.sans,
      fontSize: 11.5,
      fontWeight: fontWeights.regular,
      lineHeight: 16,
      color: textMuted,
      marginTop: 1,
    },
    contactValueGroup: {
      gap: 2,
    },
    contactValue: {
      fontFamily: fontFamily.sans,
      fontSize: 13.5,
      fontWeight: fontWeights.semiBold,
      lineHeight: 20,
      color: textPrimary,
    },
    contactSecondaryValue: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      fontWeight: fontWeights.medium,
      lineHeight: 18,
      color: textSecondary,
    },
    tabularText: {
      fontVariant: ['tabular-nums'],
    },
    copyPillBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: orangeSoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234, 88, 12, 0.35)' : '#FDBA74',
      cursor: 'pointer',
    },
    copyPillBtnCopied: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
    },
    copyPillText: {
      fontFamily: fontFamily.sans,
      fontSize: 11.5,
      fontWeight: fontWeights.semiBold,
      lineHeight: 16,
      color: isDark ? '#FB923C' : '#EA580C',
    },
    copyPillTextCopied: {
      color: isDark ? '#00C98D' : '#059669',
    },
    statusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#10B981',
    },
    statusBadgeText: {
      fontFamily: fontFamily.sans,
      fontSize: 11.5,
      fontWeight: fontWeights.semiBold,
      lineHeight: 16,
      color: isDark ? '#6EE7B7' : '#065F46',
    },
    legalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    effectiveBadge: {
      backgroundColor: bgElevated,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    effectiveBadgeText: {
      fontFamily: fontFamily.sans,
      fontSize: 11.5,
      fontWeight: fontWeights.medium,
      lineHeight: 16,
      color: textSecondary,
    },
    legalList: {
      gap: 10,
    },
    legalSection: {
      backgroundColor: bgSub,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: border,
      gap: 8,
    },
    legalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    legalNumBadge: {
      backgroundColor: orangeSoft,
      borderWidth: 1,
      borderColor: orangeBorder,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    legalNumText: {
      fontFamily: fontFamily.sans,
      fontSize: 11,
      fontWeight: fontWeights.semiBold,
      lineHeight: 15,
      color: isDark ? '#FB923C' : '#EA580C',
      fontVariant: ['tabular-nums'],
    },
    legalTitle: {
      fontFamily: fontFamily.sans,
      fontSize: 14,
      fontWeight: fontWeights.semiBold,
      lineHeight: 20,
      color: textPrimary,
      flex: 1,
    },
    legalBody: {
      fontFamily: fontFamily.sans,
      fontSize: 13,
      fontWeight: fontWeights.regular,
      lineHeight: 19,
      color: textSecondary,
    },
    bulletList: {
      gap: 6,
      paddingLeft: 2,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: '#EA580C',
      marginTop: 7,
    },
    bulletText: {
      flex: 1,
    },
    bulletLabel: {
      fontFamily: fontFamily.sans,
      fontWeight: fontWeights.semiBold,
      color: textPrimary,
    },
  });
};
