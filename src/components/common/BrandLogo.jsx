import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';

export default function BrandLogo({
  size = 48,
  showText = true,
  textColor,
  accentColor = '#16A34A',
  variant = 'horizontal',
  style,
  customName,
  customTagline,
  customLogo,
}) {
  const [settings, setSettings] = useState(() => systemSettingsService.getSettings());

  useEffect(() => {
    const unsub = systemSettingsService.subscribe((updated) => {
      setSettings(updated);
    });
    return unsub;
  }, []);

  const isDark = textColor === '#FFFFFF' || textColor === '#F8FAFC' || textColor === '#F1F5F9';
  const customLogoUrl = customLogo !== undefined ? customLogo : settings?.storeLogoUrl;
  const systemName = (customName !== undefined ? customName : settings?.storeName)?.trim() || 'MotoTrack';
  const rawTagline = customTagline !== undefined ? customTagline : settings?.storeTagline;
  const systemTagline = typeof rawTagline === 'string' ? rawTagline.trim() : '';

  if (variant === 'full' || variant === 'image') {
    if (customLogoUrl) {
      return (
        <View style={[styles.container, style]}>
          <Image
            source={{ uri: customLogoUrl }}
            style={{ width: Math.round(size * 2.62), height: size, resizeMode: 'contain' }}
          />
        </View>
      );
    }
    return (
      <View style={[styles.container, style]}>
        <Image
          source={isDark ? require('../../../assets/logo-dark.png') : require('../../../assets/logo-full.png')}
          style={{ width: Math.round(size * 2.62), height: size, resizeMode: 'contain' }}
        />
      </View>
    );
  }

  const renderBrandName = () => {
    const upper = systemName.toUpperCase();
    if (upper.startsWith('MOTO') && upper.length > 4) {
      const rest = upper.slice(4);
      return (
        <>
          MOTO<Text style={{ color: isDark ? '#6EE7B7' : (accentColor || '#16A34A') }}>{rest}</Text>
        </>
      );
    }
    const words = systemName.split(' ');
    if (words.length > 1) {
      const first = words.slice(0, -1).join(' ');
      const last = words[words.length - 1];
      return (
        <>
          {first.toUpperCase()} <Text style={{ color: isDark ? '#6EE7B7' : (accentColor || '#16A34A') }}>{last.toUpperCase()}</Text>
        </>
      );
    }
    return upper;
  };

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
        {customLogoUrl ? (
          <Image
            source={{ uri: customLogoUrl }}
            style={{
              width: Math.round(size * 0.95),
              height: Math.round(size * 0.95),
              borderRadius: Math.round(size * 0.2),
              resizeMode: 'contain',
            }}
          />
        ) : (
          <Image
            source={require('../../../assets/emblem.png')}
            style={{
              width: Math.round(size * 0.92),
              height: Math.round(size * 0.92),
              resizeMode: 'contain',
            }}
          />
        )}
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
              {renderBrandName()}
            </Text>
          </View>
          {systemTagline ? (
            <Text
              style={[
                styles.brandSubtitle,
                { color: isDark ? 'rgba(255,255,255,0.65)' : (accentColor || '#16A34A') },
                { fontSize: Math.max(5.5, Math.round(size * 0.135)) },
              ]}
              numberOfLines={1}
            >
              {systemTagline.toUpperCase()}
            </Text>
          ) : null}
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

