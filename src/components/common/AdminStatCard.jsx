import React, { useState } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export const ACCENT_THEMES = {
  green: {
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    iconBgDark: 'rgba(22, 163, 74, 0.16)',
    iconColorDark: '#4ADE80',
    badgeBg: '#DCFCE7',
    badgeText: '#15803D',
    badgeBgDark: 'rgba(22, 163, 74, 0.22)',
    badgeTextDark: '#4ADE80',
    borderHover: '#86EFAC',
    borderDarkHover: 'rgba(74, 222, 128, 0.35)',
  },
  teal: {
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    iconBgDark: 'rgba(5, 150, 105, 0.16)',
    iconColorDark: '#34D399',
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
    badgeBgDark: 'rgba(5, 150, 105, 0.22)',
    badgeTextDark: '#34D399',
    borderHover: '#A7F3D0',
    borderDarkHover: 'rgba(52, 211, 153, 0.35)',
  },
  blue: {
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    iconBgDark: 'rgba(37, 99, 235, 0.16)',
    iconColorDark: '#60A5FA',
    badgeBg: '#DBEAFE',
    badgeText: '#1D4ED8',
    badgeBgDark: 'rgba(37, 99, 235, 0.22)',
    badgeTextDark: '#60A5FA',
    borderHover: '#93C5FD',
    borderDarkHover: 'rgba(96, 165, 250, 0.35)',
  },
  cyan: {
    iconBg: '#F0FDFA',
    iconColor: '#0D9488',
    iconBgDark: 'rgba(13, 148, 136, 0.16)',
    iconColorDark: '#2DD4BF',
    badgeBg: '#CCFBF1',
    badgeText: '#0F766E',
    badgeBgDark: 'rgba(13, 148, 136, 0.22)',
    badgeTextDark: '#2DD4BF',
    borderHover: '#99F6E4',
    borderDarkHover: 'rgba(45, 212, 191, 0.35)',
  },
  amber: {
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    iconBgDark: 'rgba(217, 119, 6, 0.16)',
    iconColorDark: '#FBBF24',
    badgeBg: '#FEF3C7',
    badgeText: '#B45309',
    badgeBgDark: 'rgba(217, 119, 6, 0.22)',
    badgeTextDark: '#FBBF24',
    borderHover: '#FDE68A',
    borderDarkHover: 'rgba(251, 191, 36, 0.35)',
  },
  orange: {
    iconBg: '#FFF7ED',
    iconColor: '#EA580C',
    iconBgDark: 'rgba(234, 88, 12, 0.16)',
    iconColorDark: '#FB923C',
    badgeBg: '#FFEDD5',
    badgeText: '#C2410C',
    badgeBgDark: 'rgba(234, 88, 12, 0.22)',
    badgeTextDark: '#FB923C',
    borderHover: '#FDBA74',
    borderDarkHover: 'rgba(251, 146, 60, 0.35)',
  },
  red: {
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    iconBgDark: 'rgba(220, 38, 38, 0.16)',
    iconColorDark: '#F87171',
    badgeBg: '#FEE2E2',
    badgeText: '#B91C1C',
    badgeBgDark: 'rgba(220, 38, 38, 0.22)',
    badgeTextDark: '#F87171',
    borderHover: '#FCA5A5',
    borderDarkHover: 'rgba(248, 113, 113, 0.35)',
  },
  purple: {
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    iconBgDark: 'rgba(124, 58, 237, 0.16)',
    iconColorDark: '#A78BFA',
    badgeBg: '#EDE9FE',
    badgeText: '#6D28D9',
    badgeBgDark: 'rgba(124, 58, 237, 0.22)',
    badgeTextDark: '#A78BFA',
    borderHover: '#DDD6FE',
    borderDarkHover: 'rgba(167, 139, 250, 0.35)',
  },
  gray: {
    iconBg: '#F1F5F9',
    iconColor: '#64748B',
    iconBgDark: 'rgba(148, 163, 184, 0.16)',
    iconColorDark: '#94A3B8',
    badgeBg: '#F1F5F9',
    badgeText: '#475569',
    badgeBgDark: 'rgba(148, 163, 184, 0.22)',
    badgeTextDark: '#94A3B8',
    borderHover: '#CBD5E1',
    borderDarkHover: 'rgba(148, 163, 184, 0.35)',
  },
};

function getAutoIcon(label = '') {
  const l = String(label).toLowerCase();
  if (l.includes('sales') || l.includes('revenue')) return 'wallet2';
  if (l.includes('profit') || l.includes('margin')) return 'graph-up-arrow';
  if (l.includes('cod') || l.includes('payment')) return 'cash-coin';
  if (l.includes('order')) return 'bag-check';
  if (l.includes('processing') || l.includes('pack')) return 'box-seam';
  if (l.includes('inventory') || l.includes('stock value')) return 'boxes';
  if (l.includes('out of stock')) return 'slash-circle';
  if (l.includes('alert') || l.includes('low')) return 'boxes';
  if (l.includes('sku') || l.includes('product')) return 'tag-fill';
  if (l.includes('delivery') || l.includes('courier') || l.includes('shipped') || l.includes('fleet')) return 'truck';
  if (l.includes('booking') || l.includes('service')) return 'tools';
  if (l.includes('mechanic')) return 'wrench';
  if (l.includes('supplier')) return 'building';
  if (l.includes('user') || l.includes('customer')) return 'people-fill';
  return 'speedometer2';
}

export default function AdminStatCard({
  styles = {},
  label,
  value,
  sub,
  accent = 'teal',
  valueColor,
  icon,
  trend,
  trendPositive,
  isDark,
  style,
  badge,
  badgeType,
  onPress,
  testID,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const themeContext = useTheme?.();
  const resolvedIsDark =
    isDark !== undefined && isDark !== null
      ? Boolean(isDark)
      : Boolean(themeContext?.isDarkMode);

  const theme = ACCENT_THEMES[accent] || ACCENT_THEMES.teal;
  const resolvedIcon = icon || getAutoIcon(label);

  const iconBg = resolvedIsDark ? theme.iconBgDark : theme.iconBg;
  const iconColor = resolvedIsDark ? theme.iconColorDark : theme.iconColor;
  const cardBorderColor = resolvedIsDark ? '#26332E' : '#E2E8F0';
  const cardBg = resolvedIsDark ? '#0F1412' : '#FFFFFF';

  // Value color resolution
  const resolvedValueColor =
    valueColor ||
    (resolvedIsDark ? '#F5F7F6' : '#0F172A');

  // Badge resolution
  const badgeContent = badge || trend;
  let resolvedBadgeBg = resolvedIsDark ? theme.badgeBgDark : theme.badgeBg;
  let resolvedBadgeText = resolvedIsDark ? theme.badgeTextDark : theme.badgeText;

  if (badgeType === 'success' || (badgeType == null && trendPositive === true)) {
    resolvedBadgeBg = resolvedIsDark ? ACCENT_THEMES.green.badgeBgDark : ACCENT_THEMES.green.badgeBg;
    resolvedBadgeText = resolvedIsDark ? ACCENT_THEMES.green.badgeTextDark : ACCENT_THEMES.green.badgeText;
  } else if (badgeType === 'warning') {
    resolvedBadgeBg = resolvedIsDark ? ACCENT_THEMES.amber.badgeBgDark : ACCENT_THEMES.amber.badgeBg;
    resolvedBadgeText = resolvedIsDark ? ACCENT_THEMES.amber.badgeTextDark : ACCENT_THEMES.amber.badgeText;
  } else if (badgeType === 'danger' || (badgeType == null && trendPositive === false)) {
    resolvedBadgeBg = resolvedIsDark ? ACCENT_THEMES.red.badgeBgDark : ACCENT_THEMES.red.badgeBg;
    resolvedBadgeText = resolvedIsDark ? ACCENT_THEMES.red.badgeTextDark : ACCENT_THEMES.red.badgeText;
  } else if (badgeType === 'purple') {
    resolvedBadgeBg = resolvedIsDark ? ACCENT_THEMES.purple.badgeBgDark : ACCENT_THEMES.purple.badgeBg;
    resolvedBadgeText = resolvedIsDark ? ACCENT_THEMES.purple.badgeTextDark : ACCENT_THEMES.purple.badgeText;
  } else if (badgeType === 'info') {
    resolvedBadgeBg = resolvedIsDark ? ACCENT_THEMES.blue.badgeBgDark : ACCENT_THEMES.blue.badgeBg;
    resolvedBadgeText = resolvedIsDark ? ACCENT_THEMES.blue.badgeTextDark : ACCENT_THEMES.blue.badgeText;
  } else if (badgeType === 'neutral') {
    resolvedBadgeBg = resolvedIsDark ? ACCENT_THEMES.gray.badgeBgDark : ACCENT_THEMES.gray.badgeBg;
    resolvedBadgeText = resolvedIsDark ? ACCENT_THEMES.gray.badgeTextDark : ACCENT_THEMES.gray.badgeText;
  }

  const isClickable = typeof onPress === 'function';

  // Web interactive hover & elevation
  const webStyle = Platform.OS === 'web'
    ? {
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        ...(isHovered
          ? {
              borderColor: resolvedIsDark ? theme.borderDarkHover : theme.borderHover,
              transform: isClickable ? 'translateY(-2px)' : 'none',
              boxShadow: resolvedIsDark
                ? '0 6px 16px rgba(0, 0, 0, 0.4)'
                : '0 6px 16px rgba(0, 0, 0, 0.05)',
            }
          : {
              boxShadow: resolvedIsDark
                ? '0 1px 3px rgba(0, 0, 0, 0.3)'
                : '0 1px 3px rgba(0, 0, 0, 0.04)',
              transform: 'none',
            }),
      }
    : {};

  const ContainerComponent = isClickable ? TouchableOpacity : View;
  const containerProps = isClickable
    ? {
        onPress,
        activeOpacity: 0.82,
        testID,
      }
    : { testID };

  return (
    <ContainerComponent
      {...containerProps}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          }
        : {})}
      style={[
        {
          flex: 1,
          minWidth: 200,
          backgroundColor: cardBg,
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: cardBorderColor,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: resolvedIsDark ? 0.25 : 0.03,
          shadowRadius: 4,
          elevation: 1,
        },
        webStyle,
        style,
      ]}
    >
      {/* ─── TOP ROW: Icon Box (Top-Left) & Status Badge (Top-Right) ─── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        {/* Subtle colored square with rounded corners */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BootstrapIcon name={resolvedIcon} size={17} color={iconColor} />
        </View>

        {/* Compact percentage change or status indicator pill */}
        {badgeContent ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 7,
              paddingVertical: 2.5,
              borderRadius: 6,
              backgroundColor: resolvedBadgeBg,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: resolvedBadgeText,
                letterSpacing: -0.1,
              }}
            >
              {badgeContent}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ─── KPI LABEL: Muted Gray ─── */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          color: resolvedIsDark ? '#94A3B8' : '#64748B',
          marginBottom: 2,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>

      {/* ─── LARGE BOLD METRIC VALUE ─── */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
          lineHeight: 32,
          color: resolvedValueColor,
          fontVariant: ['tabular-nums'],
          fontFamily: Platform.select({
            web: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            default: 'PlusJakartaSans-Bold',
          }),
        }}
      >
        {value}
      </Text>

      {/* ─── SHORT DESCRIPTION / COMPARISON PERIOD ─── */}
      {sub ? (
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11.5,
            fontWeight: '500',
            color: resolvedIsDark ? '#AAB4B0' : '#64748B',
            marginTop: 2,
            letterSpacing: -0.1,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </ContainerComponent>
  );
}
