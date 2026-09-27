import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function BrandLogo({
  size = 48,
  showText = true,
  textColor,
  accentColor = '#16A34A',
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
            width: Math.round(size * 0.92),
            height: Math.round(size * 0.92),
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
                { fontSize: Math.max(10, Math.round(size * 0.28)) },
              ]}
            >
              MOTO<Text style={{ color: isDark ? '#6EE7B7' : (accentColor || '#16A34A') }}>TRACK</Text>
            </Text>
          </View>
          <Text
            style={[
              styles.brandSubtitle,
              { color: isDark ? 'rgba(255,255,255,0.65)' : (accentColor || '#16A34A') },
              { fontSize: Math.max(5.5, Math.round(size * 0.135)) },
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: '900',
    letterSpacing: -0.3,
    color: '#0F172A',
  },
  brandSubtitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#16A34A',
    marginTop: -1,
  },
});

