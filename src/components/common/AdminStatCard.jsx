import React from 'react';
import { View, Text, Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon';

const ACCENT_KEY = {
  teal: 'statCardTealAccent',
  blue: 'statCardBlueAccent',
  cyan: 'statCardCyanAccent',
  amber: 'statCardWarningAccent',
  green: 'statCardSuccessAccent',
  red: 'statCardDangerAccent',
  purple: 'statCardPurpleAccent',
};

const ACCENT_THEMES = {
  teal: {
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    iconBgDark: 'rgba(16, 185, 129, 0.14)',
    iconColorDark: '#34D399',
    borderColor: '#A7F3D0',
    borderDark: 'rgba(16, 185, 129, 0.35)',
  },
  green: {
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    iconBgDark: 'rgba(16, 185, 129, 0.14)',
    iconColorDark: '#34D399',
    borderColor: '#A7F3D0',
    borderDark: 'rgba(16, 185, 129, 0.35)',
  },
  blue: {
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    iconBgDark: 'rgba(37, 99, 235, 0.14)',
    iconColorDark: '#60A5FA',
    borderColor: '#BFDBFE',
    borderDark: 'rgba(37, 99, 235, 0.35)',
  },
  cyan: {
    iconBg: '#F0FDFA',
    iconColor: '#0D9488',
    iconBgDark: 'rgba(13, 148, 136, 0.14)',
    iconColorDark: '#2DD4BF',
    borderColor: '#99F6E4',
    borderDark: 'rgba(13, 148, 136, 0.35)',
  },
  amber: {
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    iconBgDark: 'rgba(217, 119, 6, 0.15)',
    iconColorDark: '#FBBF24',
    borderColor: '#FDE68A',
    borderDark: 'rgba(217, 119, 6, 0.35)',
  },
  red: {
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    iconBgDark: 'rgba(220, 38, 38, 0.15)',
    iconColorDark: '#F87171',
    borderColor: '#FECACA',
    borderDark: 'rgba(220, 38, 38, 0.35)',
  },
  purple: {
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    iconBgDark: 'rgba(124, 58, 237, 0.15)',
    iconColorDark: '#A78BFA',
    borderColor: '#DDD6FE',
    borderDark: 'rgba(124, 58, 237, 0.35)',
  },
};

function getAutoIcon(label = '') {
  const l = String(label).toLowerCase();
  if (l.includes('cod') || l.includes('payment')) return 'cash-coin';
  if (l.includes('order')) return 'receipt';
  if (l.includes('processing') || l.includes('pack')) return 'box-seam';
  if (l.includes('inventory') || l.includes('stock value')) return 'boxes';
  if (l.includes('revenue')) return 'graph-up-arrow';
  if (l.includes('sku') || l.includes('product')) return 'tag-fill';
  if (l.includes('alert') || l.includes('low')) return 'exclamation-triangle-fill';
  if (l.includes('profit') || l.includes('margin')) return 'cash-stack';
  if (l.includes('delivery') || l.includes('courier') || l.includes('shipped')) return 'truck';
  if (l.includes('booking') || l.includes('service')) return 'tools';
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
  isDark = false,
  style,
}) {
  const accentKey = ACCENT_KEY[accent] || ACCENT_KEY.teal;
  const accentStyle = styles[accentKey];
  const theme = ACCENT_THEMES[accent] || ACCENT_THEMES.teal;
  const resolvedIcon = icon || getAutoIcon(label);

  const iconBg = isDark ? theme.iconBgDark : theme.iconBg;
  const iconColor = isDark ? theme.iconColorDark : theme.iconColor;
  const cardBorderColor = accentStyle?.borderColor || (isDark ? theme.borderDark : theme.borderColor);

  return (
    <View
      style={[
        styles.statCard,
        accentStyle,
        {
          borderRadius: 16,
          padding: 20,
          justifyContent: 'space-between',
          minHeight: 140,
          borderColor: cardBorderColor,
        },
        style,
      ]}
    >
      {/* Top Row: Label */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.statLabel,
            {
              marginBottom: 0,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            },
          ]}
        >
          {label}
        </Text>
      </View>

      {/* Main Metric Value */}
      <View style={{ marginVertical: 4 }}>
        <Text
          numberOfLines={1}
          style={[
            styles.statValue,
            {
              fontSize: 27,
              fontWeight: '800',
              letterSpacing: -0.6,
              lineHeight: 33,
              fontVariant: ['tabular-nums'],
            },
            valueColor ? { color: valueColor } : null,
          ]}
        >
          {value}
        </Text>
      </View>

      {/* Bottom Context Row: Subtitle + Optional Trend */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 6,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.statSub,
            {
              flex: 1,
              marginTop: 0,
              fontSize: 11.5,
              fontWeight: '500',
            },
          ]}
        >
          {sub || ''}
        </Text>

        {trend ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor:
                trendPositive === false
                  ? isDark
                    ? 'rgba(239, 68, 68, 0.15)'
                    : '#FEF2F2'
                  : isDark
                  ? 'rgba(16, 185, 129, 0.15)'
                  : '#ECFDF5',
            }}
          >
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '700',
                color:
                  trendPositive === false
                    ? isDark
                      ? '#F87171'
                      : '#DC2626'
                    : isDark
                    ? '#34D399'
                    : '#059669',
              }}
            >
              {trend}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
