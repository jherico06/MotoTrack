// =========================================================================
// MotoTrack Minimalist Editorial Hero Section
// Eyebrow: "Service Center", Headline: "Care for every ride.", Rounded Orange CTA
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common';

export default function BookingHero({ onBookServicePress }) {
  return (
    <View style={heroStyles.heroWrapper}>
      <View style={heroStyles.heroInner}>
        {/* Eyebrow Label */}
        <View style={heroStyles.eyebrowWrap}>
          <View style={heroStyles.eyebrowDot} />
          <Text style={heroStyles.eyebrowText}>SERVICE CENTER</Text>
        </View>

        {/* Large Geometric Headline */}
        <Text style={heroStyles.headline}>
          Care for every ride.
        </Text>

        {/* Supporting Copy */}
        <Text style={heroStyles.subcopy}>
          Precision diagnostics, factory-trained master technicians, and transparent CC-based pricing for your motorcycle. Book your appointment in minutes with full visibility.
        </Text>

        {/* Primary Rounded Orange CTA Button */}
        <View style={heroStyles.ctaRow}>
          <TouchableOpacity
            style={heroStyles.primaryBtn}
            onPress={onBookServicePress}
            activeOpacity={0.88}
          >
            <Text style={heroStyles.primaryBtnText}>Book a Service</Text>
            <BootstrapIcon name="arrow-down" size={13} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={heroStyles.guaranteeBadge}>
            <BootstrapIcon name="shield-check" size={13} color="#71717A" />
            <Text style={heroStyles.guaranteeText}>
              Official Track & Street Warranty
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  heroWrapper: {
    backgroundColor: 'transparent',
    paddingTop: 56,
    paddingBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    width: '100%',
  },
  heroInner: {
    maxWidth: 980,
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  eyebrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 16,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
  },
  eyebrowText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 1.2,
  },
  headline: {
    fontSize: 44,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -1.2,
    lineHeight: 52,
    marginBottom: 16,
    textAlign: 'center',
  },
  subcopy: {
    fontSize: 15,
    lineHeight: 24,
    color: '#52525B',
    maxWidth: 640,
    textAlign: 'center',
    marginBottom: 28,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#EA580C',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    cursor: 'pointer',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  guaranteeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guaranteeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
});

