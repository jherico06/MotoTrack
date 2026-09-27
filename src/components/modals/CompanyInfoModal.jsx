import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import BrandLogo from '../common/BrandLogo';

export default function CompanyInfoModal({
  visible,
  initialTab = 'about', // 'about' | 'contact' | 'terms' | 'privacy'
  onClose,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Sync tab if initialTab changes when opening
  React.useEffect(() => {
    if (visible && initialTab) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  const tabs = [
    { id: 'about', label: 'About Us', icon: 'info-circle-fill' },
    { id: 'contact', label: 'Contact', icon: 'telephone-fill' },
    { id: 'terms', label: 'Terms of Service', icon: 'file-earmark-text-fill' },
    { id: 'privacy', label: 'Privacy Policy', icon: 'shield-lock-fill' },
  ];

  const handleCopy = (text, label) => {
    if (showToast) {
      showToast(`Copied ${label} to clipboard!`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { maxWidth: isDesktop ? 760 : '94%' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <BrandLogo size={28} />
              <View>
                <Text style={styles.headerTitle}>MotoTrack Information Center</Text>
                <Text style={styles.headerSubtitle}>Official Performance Network & Legal Policies</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <BootstrapIcon name="x-lg" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon
                    name={tab.icon}
                    size={14}
                    color={isActive ? '#1D4533' : '#64748B'}
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Body Content */}
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* ─── ABOUT US ─── */}
            {activeTab === 'about' && (
              <View style={styles.tabContent}>
                <View style={styles.heroBox}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>EST. 2024 • PHILIPPINES</Text>
                  </View>
                  <Text style={styles.heroTitle}>
                    Empowering Riders with Track-Tested Performance & Master Engineering
                  </Text>
                  <Text style={styles.heroDescription}>
                    MotoTrack is the Philippines’ premier destination for certified motorcycle
                    motorparts, racing upgrades, preventive maintenance, and high-precision pit bay
                    diagnostics. Built by riders, engineered for champions.
                  </Text>
                </View>

                {/* Core Pillars */}
                <Text style={styles.sectionHeading}>Why Choose MotoTrack?</Text>
                <View style={styles.pillarsGrid}>
                  <View style={styles.pillarCard}>
                    <View style={[styles.pillarIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <BootstrapIcon name="patch-check-fill" size={20} color="#059669" />
                    </View>
                    <Text style={styles.pillarTitle}>100% Authentic Parts</Text>
                    <Text style={styles.pillarDesc}>
                      Direct authorized partnerships with Akrapovič, Brembo, Öhlins, Motul, and
                      Pirelli. Every component is serial-verified and covered by factory warranty.
                    </Text>
                  </View>

                  <View style={styles.pillarCard}>
                    <View style={[styles.pillarIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <BootstrapIcon name="speedometer2" size={20} color="#2563EB" />
                    </View>
                    <Text style={styles.pillarTitle}>Dynojet Pit Bays</Text>
                    <Text style={styles.pillarDesc}>
                      Our Flagship Center features 6 dedicated pit bays, calibrated chassis dyno
                      cells, and certified master technicians for precision ECU remapping and engine
                      overhauls.
                    </Text>
                  </View>

                  <View style={styles.pillarCard}>
                    <View style={[styles.pillarIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <BootstrapIcon name="lightning-charge-fill" size={20} color="#D97706" />
                    </View>
                    <Text style={styles.pillarTitle}>Fast Track Dispatch</Text>
                    <Text style={styles.pillarDesc}>
                      Same-day courier dispatch across Metro Cebu and express nationwide delivery with
                      live real-time GPS tracking from our hub to your doorstep.
                    </Text>
                  </View>

                  <View style={styles.pillarCard}>
                    <View style={[styles.pillarIconBox, { backgroundColor: '#F5F3FF' }]}>
                      <BootstrapIcon name="shield-lock-fill" size={20} color="#7C3AED" />
                    </View>
                    <Text style={styles.pillarTitle}>Secure Transactions</Text>
                    <Text style={styles.pillarDesc}>
                      Bank-grade 256-bit SSL encrypted checkout supporting GCash e-wallets, Cash on
                      Delivery (COD), and major credit/debit networks.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ─── CONTACT ─── */}
            {activeTab === 'contact' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeading}>Get In Touch With MotoTrack</Text>
                <Text style={styles.paragraph}>
                  Have a question regarding parts fitment, track tuning packages, or your delivery?
                  Our rider support team and certified pit bay technicians are ready to assist you.
                </Text>

                <View style={styles.contactCardsGrid}>
                  {/* Address */}
                  <View style={styles.contactCard}>
                    <View style={styles.contactIconBox}>
                      <BootstrapIcon name="geo-alt-fill" size={20} color="#1D4533" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactLabel}>Flagship Central Pit Bays</Text>
                      <Text style={styles.contactValue}>
                        East Poblacion, City of Naga, Cebu (South Road Corridor), Philippines 6037
                      </Text>
                    </View>
                  </View>

                  {/* Hotlines */}
                  <View style={styles.contactCard}>
                    <View style={styles.contactIconBox}>
                      <BootstrapIcon name="telephone-fill" size={20} color="#1D4533" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactLabel}>Customer & Garage Hotline</Text>
                      <Text style={styles.contactValue}>(+63) 917 882 9102 / (032) 489-2100</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy('+639178829102', 'Hotline')}
                        style={styles.copyBtn}
                      >
                        <Text style={styles.copyBtnText}>Tap to copy hotline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Email */}
                  <View style={styles.contactCard}>
                    <View style={styles.contactIconBox}>
                      <BootstrapIcon name="envelope-fill" size={20} color="#1D4533" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactLabel}>Official Support Email</Text>
                      <Text style={styles.contactValue}>
                        support@mototrack.com / pitbay@mototrack.com
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleCopy('support@mototrack.com', 'Support email')}
                        style={styles.copyBtn}
                      >
                        <Text style={styles.copyBtnText}>Tap to copy email</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Operating Hours */}
                  <View style={styles.contactCard}>
                    <View style={styles.contactIconBox}>
                      <BootstrapIcon name="clock-fill" size={20} color="#1D4533" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactLabel}>Operating Hours</Text>
                      <Text style={styles.contactValue}>
                        Monday to Sunday: 8:00 AM – 6:30 PM (PHT)
                      </Text>
                      <Text style={{ fontSize: 11.5, color: '#059669', fontWeight: '700', marginTop: 4 }}>
                        🟢 Pit Bays and Online Dispatch Open Daily
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ─── TERMS OF SERVICE ─── */}
            {activeTab === 'terms' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeading}>Terms of Service</Text>
                <Text style={styles.lastUpdatedText}>Effective Date: September 2026</Text>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>1. Platform Acceptance & Eligibility</Text>
                  <Text style={styles.legalBody}>
                    By accessing or purchasing through MotoTrack Motorparts & Accessories, you agree
                    to be bound by these Terms. Customers must ensure that parts selected correspond
                    accurately with their motorcycle make, model, engine displacement, and production
                    year.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>2. Genuine Product Guarantee & Warranty</Text>
                  <Text style={styles.legalBody}>
                    All brand-new exhausts, brake calipers, master cylinders, suspension systems, and
                    accessories sold on MotoTrack are 100% authentic and sourced from authorized
                    distributor channels. Manufacturer warranty claims require proof of purchase and
                    unaltered product serial numbers.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>3. Pit Bay Reservations & Downpayment Policy</Text>
                  <Text style={styles.legalBody}>
                    To reserve a dedicated pit bay slot with our master technicians, appointments
                    ordinarily require an advance downpayment (waived in select promotional or
                    testing modes). Cancellations made at least 24 hours prior to appointment time are
                    eligible for full rescheduling without penalty.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>4. Shipping, Dispatch & Live Tracking</Text>
                  <Text style={styles.legalBody}>
                    Orders are dispatched upon verification. Customers are provided with an order
                    token and real-time tracking route. Delivery transit times may vary depending on
                    courier availability, weather advisories, or road conditions along the south
                    corridor.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>5. Technical Installation Disclaimer</Text>
                  <Text style={styles.legalBody}>
                    Performance motorparts such as high-compression engine kits, ECU tunes, and
                    racing brake lines must be installed by certified technicians. MotoTrack is not
                    liable for damage or personal injury resulting from improper self-installation or
                    unauthorized modifications.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── PRIVACY POLICY ─── */}
            {activeTab === 'privacy' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeading}>Privacy & Data Protection Policy</Text>
                <Text style={styles.lastUpdatedText}>Effective Date: September 2026</Text>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>1. Commitment to Data Privacy</Text>
                  <Text style={styles.legalBody}>
                    MotoTrack respects your right to privacy and complies with Republic Act No. 10173
                    (Data Privacy Act of the Philippines). This policy outlines how we collect,
                    process, and protect your personal identification and transaction details.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>2. Information We Collect</Text>
                  <Text style={styles.legalBody}>
                    • Account Information: Name, verified email address, mobile contact number.
                    {'\n'}• Vehicle Registry: Motorcycle brand, model, license plate, and odometer
                    readings for tailored pit bay service records.
                    {'\n'}• Shipping & Delivery: Precise delivery addresses and dispatch coordinates.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>3. Payment Security & Encryption</Text>
                  <Text style={styles.legalBody}>
                    Financial data processed via GCash or payment gateways is secured with
                    industry-standard 256-bit SSL transport layer encryption. MotoTrack never stores
                    raw payment PINs or CVV credentials on its servers.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>4. Location & Tracking Data</Text>
                  <Text style={styles.legalBody}>
                    GPS telemetry used during live order tracking is strictly utilized for the
                    duration of the active dispatch. Location markers are automatically purged once
                    delivery is marked Completed by the rider.
                  </Text>
                </View>

                <View style={styles.legalSection}>
                  <Text style={styles.legalTitle}>5. Rider Rights & Account Control</Text>
                  <Text style={styles.legalBody}>
                    You maintain the right to review, update, or request permanent deletion of your
                    profile and vehicle records at any time through your Profile Settings or by
                    contacting privacy@mototrack.com.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footerBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BootstrapIcon name="shield-check" size={16} color="#1D4533" />
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                MotoTrack Official Performance Network
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Close Window</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  dialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
    maxHeight: '90%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    gap: 6,
    overflow: 'scroll',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    cursor: 'pointer',
  },
  tabBtnActive: {
    borderBottomColor: '#1D4533',
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1D4533',
    fontWeight: '800',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
  },
  tabContent: {
    gap: 16,
  },
  heroBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    marginBottom: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D4533',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#064E3B',
    lineHeight: 24,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 13.5,
    color: '#065F46',
    lineHeight: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 12,
  },
  lastUpdatedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 14,
  },
  pillarsGrid: {
    gap: 12,
  },
  pillarCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },
  pillarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pillarTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  pillarDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  contactCardsGrid: {
    gap: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },
  contactIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F0EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3,
    lineHeight: 20,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2,
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D4533',
    textDecorationLine: 'underline',
  },
  legalSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  legalBody: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 19,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  doneBtn: {
    backgroundColor: '#1D4533',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    cursor: 'pointer',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
