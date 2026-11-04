// =========================================================================
// MotoTrack Minimalist Floating Bottom Tray
// Displays Selected Services, Starting Total, and "Continue" Action
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from '../../common';
import { formatPhp } from '../../../utils/serviceQuotation.js';

export default function FloatingBottomTray({
  selectedPackages = [],
  totalPrice = 0,
  onProceed,
  onClear,
}) {
  if (!selectedPackages || selectedPackages.length === 0) {
    return null;
  }

  return (
    <View style={trayStyles.trayFixedContainer}>
      <View style={trayStyles.trayCard}>
        {/* Left: Selected count & compact pills */}
        <View style={trayStyles.leftCol}>
          <View style={trayStyles.countBadge}>
            <Text style={trayStyles.countBadgeText}>{selectedPackages.length}</Text>
          </View>
          <View>
            <Text style={trayStyles.summaryLabel}>
              {selectedPackages.length === 1
                ? '1 service package selected'
                : `${selectedPackages.length} service packages selected`}
            </Text>
            <View style={trayStyles.pillsRow}>
              {selectedPackages.map((pkg) => (
                <View key={pkg.id} style={trayStyles.pkgPill}>
                  <Text style={trayStyles.pkgPillText} numberOfLines={1}>
                    {pkg.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Right: Total Price & Continue Button */}
        <View style={trayStyles.rightCol}>
          <View style={trayStyles.priceBox}>
            <Text style={trayStyles.priceSub}>Estimated total</Text>
            <Text style={trayStyles.priceMain}>{formatPhp(totalPrice)}</Text>
          </View>

          {onClear && (
            <TouchableOpacity
              style={trayStyles.clearBtn}
              onPress={onClear}
              activeOpacity={0.75}
            >
              <Text style={trayStyles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={trayStyles.proceedBtn}
            onPress={onProceed}
            activeOpacity={0.88}
          >
            <Text style={trayStyles.proceedBtnText}>Continue</Text>
            <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const trayStyles = StyleSheet.create({
  trayFixedContainer: {
    position: Platform.select({ web: 'fixed', default: 'absolute' }),
    bottom: 20,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 20,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  trayCard: {
    width: '100%',
    maxWidth: 960,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    ...(Platform.OS === 'web'
      ? {
        boxShadow:
          '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      }
      : {}),
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    ...(Platform.OS === 'web' ? { '@media (max-width: 640px)': { display: 'none' } } : {}),
  },
  pkgPill: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 160,
  },
  pkgPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#52525B',
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceSub: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#71717A',
  },
  priceMain: {
    fontSize: 19,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    cursor: 'pointer',
  },
  clearBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#71717A',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    cursor: 'pointer',
    shadowColor: '#EA580C',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  proceedBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

