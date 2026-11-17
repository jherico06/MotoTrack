import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import {
  MOBILE_CC_TIERS,
  calculatePackagePriceForCc,
  getCcTierId,
  getPackageStartingPrice,
} from './mobilePackageCatalog.js';

export default function MobilePackageDetailsSheet({
  visible = false,
  pkg = null,
  selectedMotorcycle = null,
  isDarkMode = false,
  onClose,
  onBookPackage,
}) {
  if (!pkg) return null;

  const rawCc =
    selectedMotorcycle?.engine_displacement ??
    selectedMotorcycle?.engine_cc ??
    selectedMotorcycle?.engineCc ??
    selectedMotorcycle?.cc;
  const engineCc = parseInt(rawCc, 10) || 0;
  const activeTierId = getCcTierId(engineCc);
  const ccMatch = engineCc > 0 ? calculatePackagePriceForCc(pkg, engineCc) : null;
  const displayPrice = ccMatch ? ccMatch.price : getPackageStartingPrice(pkg);
  const isUnavailable = ccMatch?.isAvailable === false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, isDarkMode && styles.sheetDark]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.iconBadge, isDarkMode && { backgroundColor: '#3A241B', borderColor: '#EA580C' }]}>
              <BootstrapIcon name={pkg.category === 'Repair' ? 'wrench' : 'wrench-adjustable'} size={17} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, isDarkMode && { color: '#F2F2F3' }]} numberOfLines={2}>
                {pkg.name}
              </Text>
              <Text style={[styles.subtitle, isDarkMode && { color: '#A1A1AA' }]}>
                {pkg.category} • Estimated {pkg.duration}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, isDarkMode && { backgroundColor: '#292B2F' }]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#D4D4D8' : '#475569'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            <Text style={[styles.descText, isDarkMode && { color: '#D4D4D8' }]}>
              {pkg.description}
            </Text>

            {/* Inclusions Checklist */}
            <Text style={[styles.sectionLabel, isDarkMode && { color: '#A1A1AA' }]}>
              INCLUDED WORK ITEMS
            </Text>
            <View style={[styles.box, isDarkMode && styles.boxDark]}>
              {(pkg.inclusions || []).map((item, idx) => (
                <View key={idx} style={styles.checkRow}>
                  <View style={styles.checkDot}>
                    <BootstrapIcon name="check-lg" size={11} color="#10B981" />
                  </View>
                  <Text style={[styles.checkText, isDarkMode && { color: '#E2E8F0' }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Displacement Pricing */}
            <Text style={[styles.sectionLabel, isDarkMode && { color: '#A1A1AA' }]}>
              LABOR RATES BY ENGINE CC
            </Text>
            <View style={[styles.box, isDarkMode && styles.boxDark]}>
              {MOBILE_CC_TIERS.map((tier) => {
                const val = pkg.prices?.[tier.id];
                const isActive = activeTierId === tier.id;
                return (
                  <View
                    key={tier.id}
                    style={[
                      styles.tierRow,
                      isActive && (isDarkMode ? { backgroundColor: 'rgba(234,88,12,0.18)' } : { backgroundColor: '#FFF7ED' }),
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierName,
                        isDarkMode && { color: '#D4D4D8' },
                        isActive && { color: '#EA580C', fontWeight: '700' },
                      ]}
                    >
                      {tier.label}
                      {isActive ? ' (Active)' : ''}
                    </Text>
                    <Text
                      style={[
                        styles.tierPrice,
                        isDarkMode && { color: '#F2F2F3' },
                        isActive && { color: '#EA580C' },
                      ]}
                    >
                      {val === null || val === undefined ? 'N/A' : formatPhp(Number(val))}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.disclaimer}>
              Estimated labor only. Additional parts or fluids recommended after pit inspection require your approval first.
            </Text>
          </ScrollView>

          {/* Bottom CTA */}
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B' }}>
                {ccMatch ? 'Your Motorcycle Rate' : 'Starting Rate'}
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: isDarkMode ? '#FFFFFF' : '#0F172A',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {isUnavailable ? 'Unavailable' : formatPhp(Number(displayPrice || 0))}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.bookBtn, isUnavailable && { backgroundColor: '#94A3B8' }]}
              onPress={() => {
                if (isUnavailable) return;
                onClose?.();
                onBookPackage?.(pkg);
              }}
              disabled={isUnavailable}
              activeOpacity={0.85}
            >
              <Text style={styles.bookBtnText}>
                {isUnavailable ? 'Unavailable' : 'Book This Package'}
              </Text>
              {!isUnavailable ? <BootstrapIcon name="arrow-right" size={14} color="#FFFFFF" /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  descText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#334155',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginTop: 4,
  },
  box: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  boxDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#1E293B',
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tierName: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  tierPrice: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  disclaimer: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  bookBtn: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 18,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
