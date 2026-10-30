import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { systemSettingsService } from '../../services/system/systemSettingsService.js';

export default function BrandLogo({
  size = 48,
  showText = true,
  textColor,
  accentColor = '#EA580C',
  variant = 'horizontal',
  style,
  customName,
  customTagline,
  customLogo,
  textSize,
  titleStyle,
}) {
  const [settings, setSettings] = useState(() => systemSettingsService.getSettings());
  const [imgError, setImgError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);

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

  useEffect(() => {
    if (!customLogoUrl) {
      setImgError(false);
      setAspectRatio(1);
      return;
    }
    setImgError(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.Image === 'function') {
      const img = new window.Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.onerror = () => setImgError(true);
      img.src = customLogoUrl;
    } else {
      Image.getSize(
        customLogoUrl,
        (w, h) => {
          if (w && h) setAspectRatio(w / h);
        },
        () => setImgError(true)
      );
    }
  }, [customLogoUrl]);

  const isCustomActive = Boolean(customLogoUrl && !imgError);

  if (variant === 'full' || variant === 'image') {
    if (isCustomActive) {
      const fullWidth = Math.round(size * Math.max(1.8, Math.min(aspectRatio, 3.2)));
      return (
        <View style={[styles.container, style]}>
          <Image
            source={{ uri: customLogoUrl }}
            resizeMode="contain"
            style={{ width: fullWidth, height: size }}
            onError={() => setImgError(true)}
          />
        </View>
      );
    }
    return (
      <View style={[styles.container, style]}>
        <Image
          source={isDark ? require('../../../assets/logo-dark.png') : require('../../../assets/logo-full.png')}
          resizeMode="contain"
          style={{ width: Math.round(size * 2.62), height: size }}
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
          MOTO<Text style={{ color: isDark ? '#EA580C' : (accentColor || '#EA580C') }}>{rest}</Text>
        </>
      );
    }
    const words = systemName.split(' ');
    if (words.length > 1) {
      const first = words.slice(0, -1).join(' ');
      const last = words[words.length - 1];
      return (
        <>
          {first.toUpperCase()}{' '}
          <Text style={{ color: isDark ? '#EA580C' : (accentColor || '#EA580C') }}>
            {last.toUpperCase()}
          </Text>
        </>
      );
    }
    return upper;
  };

  const effectiveFontSize = textSize !== undefined
    ? textSize
    : Math.max(12, Math.round(size * 0.44));

  const badgeWidth = isCustomActive && aspectRatio > 1.25
    ? Math.min(Math.round(size * Math.min(aspectRatio, 2.4)), Math.round(size * 2.5))
    : size;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.logoBadge,
          {
            width: badgeWidth,
            height: size,
          },
        ]}
      >
        {isCustomActive ? (
          <Image
            source={{ uri: customLogoUrl }}
            resizeMode="contain"
            style={{
              width: '100%',
              height: '100%',
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <Image
            source={require('../../../assets/emblem.png')}
            resizeMode="contain"
            style={{
              width: Math.round(size * 0.92),
              height: Math.round(size * 0.92),
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
                {
                  fontSize: effectiveFontSize,
                  lineHeight: Math.round(effectiveFontSize * 1.2),
                },
                titleStyle,
              ]}
            >
              {renderBrandName()}
            </Text>
          </View>
          {systemTagline ? (
            <Text
              style={[
                styles.brandSubtitle,
                { color: isDark ? 'rgba(255,255,255,0.75)' : (accentColor || '#EA580C') },
                { fontSize: Math.max(5.5, Math.round(size * 0.14)) },
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  textColumn: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#0F172A',
  },
  brandSubtitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#EA580C',
    marginTop: -1,
  },
});
