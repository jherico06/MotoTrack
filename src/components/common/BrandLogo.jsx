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
  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.logoBadge,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.22),
          },
        ]}
      >
        <Image
          source={require('../../../assets/logo.png')}
          style={{ width: size, height: size, resizeMode: 'contain' }}
        />
      </View>
      {showText && (
        <View style={styles.textColumn}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.brandTitle,
                textColor ? { color: textColor } : null,
                { fontSize: Math.max(14, Math.round(size * 0.42)) },
              ]}
            >
              D,Blockchain
            </Text>
          </View>
          <Text
            style={[
              styles.brandSubtitle,
              accentColor ? { color: accentColor } : null,
              { fontSize: Math.max(7.5, Math.round(size * 0.21)) },
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
    backgroundColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  textColumn: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#0F172A',
  },
  brandSubtitle: {
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#DC2626',
    marginTop: -1,
  },
});
