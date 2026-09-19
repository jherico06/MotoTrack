import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function BrandLogo({
  size = 40,
  showText = true,
  textColor,
  accentColor = '#DC2626',
  variant = 'horizontal',
  style,
}) {
  const isDark = textColor === '#FFFFFF' || textColor === '#F8FAFC' || textColor === '#F1F5F9';

  if (variant === 'full' || variant === 'image') {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={isDark ? require('../../../assets/logo-dark.png') : require('../../../assets/logo-full.png')}
          style={{ width: Math.round(size * 2.62), height: size, resizeMode: 'contain' }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.logoBadge,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.24),
          },
        ]}
      >
        <Image
          source={require('../../../assets/emblem.png')}
          style={{
            width: Math.round(size * 0.86),
            height: Math.round(size * 0.62),
            resizeMode: 'contain',
          }}
        />
      </View>
      {showText && (
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.brandTitle,
                textColor ? { color: textColor } : null,
                { fontSize: Math.max(14, Math.round(size * 0.44)) },
              ]}
            >
              MOTO<Text style={{ color: accentColor || '#DC2626' }}>TRACK</Text>
            </Text>
          </View>
          <Text
            style={[
              styles.brandSubtitle,
              accentColor ? { color: accentColor } : null,
              { fontSize: Math.max(7.5, Math.round(size * 0.2)) },
            ]}
          >
            MOTORPARTS & ACCESSORIES
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    padding: 2,
  },
  textColumn: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'Manrope',
    fontWeight: '900',
    letterSpacing: -0.3,
    color: '#0F172A',
  },
  brandSubtitle: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#DC2626',
    marginTop: -1,
  },
});

