import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Animated,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext.jsx';

// Ensure keyframes are injected into DOM immediately on web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const SKELETON_STYLE_ID = 'mototrack-skeleton-style';
  if (!document.getElementById(SKELETON_STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = SKELETON_STYLE_ID;
    styleEl.textContent = `
      @keyframes mototrack-skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes mototrack-skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.42; }
      }
      @keyframes mototrack-fade-in {
        from { opacity: 0.6; transform: translateY(3px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .mototrack-skeleton-shimmer {
        background-size: 200% 100% !important;
        animation: mototrack-skeleton-shimmer 0.85s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
      }
      .mototrack-skeleton-pulse {
        animation: mototrack-skeleton-pulse 0.8s ease-in-out infinite !important;
      }
      .mototrack-content-fade-in {
        animation: mototrack-fade-in 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

/**
 * Universal Skeleton Loading Animation Component for MotoTrack.
 * Works seamlessly across Web, iOS, and Android.
 *
 * Supports:
 * - Variants: 'text' | 'rounded' | 'circular' | 'rectangular'
 * - Animation modes: 'shimmer' (default) | 'pulse' | 'none'
 * - Auto dark/light theme switching with MotoTrack forest emerald palette
 * - Full subcomponents: Text, Avatar, Badge, Button, Card, ProductCard, TableRow, Table, StatCard, List
 */
export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  circle = false,
  variant = 'rounded',
  animation = 'shimmer',
  duration = 800,
  baseColor,
  highlightColor,
  style,
  children,
  testID = 'skeleton-placeholder',
  ...rest
}) {
  // Gracefully read theme (fall back to defaults if outside ThemeProvider)
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {
    isDarkMode = false;
  }

  // Determine colors based on theme tokens
  const resolvedBaseColor = useMemo(() => {
    if (baseColor) return baseColor;
    return isDarkMode ? '#1E2824' : '#E2E8F0';
  }, [baseColor, isDarkMode]);

  const resolvedHighlightColor = useMemo(() => {
    if (highlightColor) return highlightColor;
    return isDarkMode ? '#2A3A33' : '#F1F5F9';
  }, [highlightColor, isDarkMode]);

  // Compute border radius
  const resolvedBorderRadius = useMemo(() => {
    if (circle) return 9999;
    if (typeof borderRadius === 'number') return borderRadius;
    switch (variant) {
      case 'circular':
        return 9999;
      case 'text':
        return 4;
      case 'rectangular':
        return 0;
      case 'rounded':
      default:
        return 8;
    }
  }, [circle, borderRadius, variant]);

  // Native & Web animated values
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animation === 'none') {
      animatedValue.setValue(1);
      return;
    }

    const animLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    animLoop.start();

    return () => {
      animLoop.stop();
    };
  }, [animation, duration, animatedValue]);

  // Interpolated opacity for pulse animation or native fallback
  const animatedOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.95],
  });

  // Calculate dimensions
  const computedStyle = useMemo(() => {
    const s = {
      width: circle ? (typeof height === 'number' ? height : 40) : width,
      height: circle ? (typeof width === 'number' ? width : 40) : height,
      borderRadius: resolvedBorderRadius,
    };
    if (circle) {
      s.aspectRatio = 1;
    }
    return s;
  }, [circle, width, height, resolvedBorderRadius]);

  // Web hardware-accelerated CSS shimmer implementation
  if (Platform.OS === 'web') {
    const isShimmer = animation === 'shimmer';
    const isPulse = animation === 'pulse';

    const webStyle = {
      ...computedStyle,
      backgroundColor: resolvedBaseColor,
      ...(isShimmer
        ? {
            backgroundImage: `linear-gradient(90deg, ${resolvedBaseColor} 0%, ${resolvedHighlightColor} 50%, ${resolvedBaseColor} 100%)`,
            backgroundSize: '200% 100%',
            animation: `mototrack-skeleton-shimmer ${duration}ms cubic-bezier(0.4, 0, 0.6, 1) infinite`,
          }
        : {}),
      ...(isPulse
        ? {
            animation: `mototrack-skeleton-pulse ${duration}ms cubic-bezier(0.4, 0, 0.6, 1) infinite`,
          }
        : {}),
      overflow: 'hidden',
    };

    return (
      <Animated.View
        className={isShimmer ? 'mototrack-skeleton-shimmer' : isPulse ? 'mototrack-skeleton-pulse' : ''}
        style={[
          webStyle,
          animation === 'pulse' ? { opacity: animatedOpacity } : undefined,
          style,
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading..."
        testID={testID}
        {...rest}
      >
        {children}
      </Animated.View>
    );
  }

  // Native mobile implementation (iOS / Android) using Animated.View
  return (
    <Animated.View
      style={[
        computedStyle,
        {
          backgroundColor: resolvedBaseColor,
          opacity: animation === 'none' ? 1 : animatedOpacity,
        },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading..."
      testID={testID}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOUND SKELETON COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-line paragraph skeleton with organic line length staggering
 */
export function SkeletonText({
  lines = 3,
  gap = 8,
  lineHeight = 12,
  width = '100%',
  lastLineWidth = '60%',
  style,
  ...props
}) {
  const lineArray = Array.from({ length: lines }, (_, index) => index);

  const getLineWidth = (index) => {
    if (index === lines - 1) return lastLineWidth;
    if (index === 0) return '100%';
    if (index === 1) return '92%';
    if (index === 2) return '85%';
    return '75%';
  };

  return (
    <View style={[{ width, gap }, style]}>
      {lineArray.map((i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={getLineWidth(i)}
          variant="text"
          {...props}
        />
      ))}
    </View>
  );
}

/**
 * Avatar placeholder skeleton
 */
export function SkeletonAvatar({ size = 40, shape = 'circle', style, ...props }) {
  return (
    <Skeleton
      width={size}
      height={size}
      circle={shape === 'circle'}
      borderRadius={shape === 'rounded' ? 8 : 0}
      style={style}
      {...props}
    />
  );
}

/**
 * Button placeholder skeleton
 */
export function SkeletonButton({
  width = 120,
  height = 38,
  borderRadius = 10,
  style,
  ...props
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={style}
      {...props}
    />
  );
}

/**
 * Badge / Pill placeholder skeleton
 */
export function SkeletonBadge({
  width = 64,
  height = 22,
  borderRadius = 6,
  style,
  ...props
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={style}
      {...props}
    />
  );
}

/**
 * Generic content card skeleton
 */
export function SkeletonCard({
  height = 220,
  borderRadius = 16,
  hasImage = true,
  lines = 2,
  style,
  ...props
}) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {}

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDarkMode ? '#151C19' : '#FFFFFF',
          borderColor: isDarkMode ? '#26332E' : '#E2E8F0',
          borderRadius,
        },
        style,
      ]}
    >
      {hasImage && (
        <Skeleton
          width="100%"
          height={height * 0.55}
          borderRadius={borderRadius - 4}
          style={{ marginBottom: 12 }}
          {...props}
        />
      )}
      <Skeleton width="45%" height={14} style={{ marginBottom: 8 }} {...props} />
      <SkeletonText lines={lines} lineHeight={11} gap={6} {...props} />
    </View>
  );
}

/**
 * MotoTrack Shop Product Card Skeleton
 * Exactly mirrors the layout of ProductCard in ShopPage.jsx
 */
export function ProductCardSkeleton({ width, style, ...props }) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {}

  return (
    <View
      style={[
        styles.productCard,
        {
          backgroundColor: isDarkMode ? '#151C19' : '#FFFFFF',
          borderColor: isDarkMode ? '#26332E' : '#E2E8F0',
          width: width || '100%',
        },
        style,
      ]}
    >
      {/* 1:1 Aspect Ratio Image Box with Badges */}
      <View
        style={[
          styles.productImageContainer,
          { backgroundColor: isDarkMode ? '#131A17' : '#F1F5F9' },
        ]}
      >
        <Skeleton width="100%" height="100%" borderRadius={0} {...props} />

        {/* Top-Left Compatibility Badge Placeholder */}
        <View style={styles.productBadgeLeft}>
          <Skeleton width={80} height={20} borderRadius={6} {...props} />
        </View>

        {/* Top-Right Wishlist Button Placeholder */}
        <View style={styles.productBadgeRight}>
          <Skeleton circle size={28} {...props} />
        </View>
      </View>

      {/* Product Details Section */}
      <View style={styles.productDetailsContainer}>
        {/* Category Pill Placeholder */}
        <Skeleton width={50} height={13} borderRadius={4} style={{ marginBottom: 8 }} {...props} />

        {/* Product Title (2 lines) */}
        <Skeleton width="88%" height={13} borderRadius={4} style={{ marginBottom: 6 }} {...props} />
        <Skeleton width="62%" height={13} borderRadius={4} style={{ marginBottom: 10 }} {...props} />

        {/* Rating Stars & Count Placeholder */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Skeleton width={60} height={12} borderRadius={3} {...props} />
          <Skeleton width={32} height={12} borderRadius={3} {...props} />
        </View>

        {/* Bottom Price & Action Button Row */}
        <View style={styles.productBottomRow}>
          <View style={{ gap: 4 }}>
            <Skeleton width={68} height={18} borderRadius={4} {...props} />
            <Skeleton width={44} height={10} borderRadius={3} {...props} />
          </View>
          <Skeleton width={34} height={34} borderRadius={8} {...props} />
        </View>
      </View>
    </View>
  );
}

/**
 * Data Table Row Skeleton
 * Specifically tailored for MotoTrack's admin logs, orders, suppliers, and bookings tables.
 */
export function TableRowSkeleton({
  hasAvatar = true,
  columns,
  style,
  ...props
}) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {}

  if (Array.isArray(columns) && columns.length > 0) {
    return (
      <View
        style={[
          styles.tableRow,
          { borderBottomColor: isDarkMode ? '#26332E' : '#F1F5F9' },
          style,
        ]}
      >
        {columns.map((col, idx) => {
          const flex = typeof col === 'number' ? col : col.flex || 1;
          const minWidth = col.minWidth || 80;
          const colWidth = col.width || undefined;
          return (
            <View
              key={idx}
              style={{
                flex,
                minWidth,
                width: colWidth,
                justifyContent: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Skeleton
                width={col.skeletonWidth || '75%'}
                height={col.skeletonHeight || 14}
                borderRadius={col.borderRadius || 4}
                {...props}
              />
            </View>
          );
        })}
      </View>
    );
  }

  // Default MotoTrack Table Row: [Avatar + 2-line Text, Badge, Timestamp, Action]
  return (
    <View
      style={[
        styles.tableRow,
        { borderBottomColor: isDarkMode ? '#26332E' : '#F1F5F9' },
        style,
      ]}
    >
      {/* Primary Column with Avatar/Icon */}
      <View style={{ flex: 2.2, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {hasAvatar && <Skeleton circle size={32} {...props} />}
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="80%" height={13} borderRadius={4} {...props} />
          <Skeleton width="45%" height={10} borderRadius={3} {...props} />
        </View>
      </View>

      {/* Category / Role Badge */}
      <View style={{ flex: 1.2, minWidth: 100, justifyContent: 'center' }}>
        <Skeleton width={70} height={22} borderRadius={6} {...props} />
      </View>

      {/* Date & Time */}
      <View style={{ flex: 1.5, minWidth: 120, justifyContent: 'center', gap: 4 }}>
        <Skeleton width={80} height={12} borderRadius={3} {...props} />
        <Skeleton width={50} height={9} borderRadius={3} {...props} />
      </View>

      {/* Status Badge */}
      <View style={{ flex: 1.1, minWidth: 90, alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton width={64} height={22} borderRadius={6} {...props} />
      </View>

      {/* Action Button */}
      <View style={{ flex: 0.8, minWidth: 60, alignItems: 'flex-end', justifyContent: 'center' }}>
        <Skeleton width={28} height={28} borderRadius={6} {...props} />
      </View>
    </View>
  );
}

/**
 * Complete Data Table Skeleton with Header and Rows
 */
export function TableSkeleton({ rows = 5, ...props }) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {}

  return (
    <View
      style={[
        styles.tableContainer,
        {
          backgroundColor: isDarkMode ? '#151C19' : '#FFFFFF',
          borderColor: isDarkMode ? '#26332E' : '#E2E8F0',
        },
      ]}
    >
      {/* Table Header Skeleton */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: isDarkMode ? '#121A17' : '#F8FAF9',
            borderBottomColor: isDarkMode ? '#26332E' : '#E2E8F0',
          },
        ]}
      >
        <Skeleton width="30%" height={13} borderRadius={4} {...props} />
        <Skeleton width="20%" height={13} borderRadius={4} {...props} />
        <Skeleton width="20%" height={13} borderRadius={4} {...props} />
        <Skeleton width="15%" height={13} borderRadius={4} {...props} />
      </View>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} {...props} />
      ))}
    </View>
  );
}

/**
 * Admin KPI / Stat Card Skeleton
 * Matches MotoTrack AdminStatCard metrics
 */
export function StatCardSkeleton({ style, ...props }) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {}

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: isDarkMode ? '#151C19' : '#FFFFFF',
          borderColor: isDarkMode ? '#26332E' : '#E2E8F0',
        },
        style,
      ]}
    >
      {/* Top Row: Icon pill + trend badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Skeleton width={38} height={38} borderRadius={10} {...props} />
        <Skeleton width={54} height={20} borderRadius={12} {...props} />
      </View>

      {/* Huge Metric Number */}
      <Skeleton width="65%" height={30} borderRadius={6} style={{ marginBottom: 8 }} {...props} />

      {/* Metric Label / Subtitle */}
      <Skeleton width="45%" height={12} borderRadius={4} {...props} />
    </View>
  );
}

/**
 * Generic List Item Skeleton
 */
export function SkeletonList({ count = 4, gap = 12, style, ...props }) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDarkMode ?? false;
  } catch (_e) {}

  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.listItem,
            {
              backgroundColor: isDarkMode ? '#151C19' : '#FFFFFF',
              borderColor: isDarkMode ? '#26332E' : '#E2E8F0',
            },
          ]}
        >
          <Skeleton circle size={38} {...props} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="75%" height={13} borderRadius={4} {...props} />
            <Skeleton width="45%" height={10} borderRadius={3} {...props} />
          </View>
          <Skeleton width={50} height={18} borderRadius={6} {...props} />
        </View>
      ))}
    </View>
  );
}

// Attach subcomponents to main Skeleton component
Skeleton.Text = SkeletonText;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.Button = SkeletonButton;
Skeleton.Badge = SkeletonBadge;
Skeleton.Card = SkeletonCard;
Skeleton.ProductCard = ProductCardSkeleton;
Skeleton.TableRow = TableRowSkeleton;
Skeleton.Table = TableSkeleton;
Skeleton.StatCard = StatCardSkeleton;
Skeleton.List = SkeletonList;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardContainer: {
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  productBadgeLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  productBadgeRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  productDetailsContainer: {
    padding: 12,
  },
  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tableContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
});
