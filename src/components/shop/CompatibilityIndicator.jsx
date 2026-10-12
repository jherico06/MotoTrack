import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { COMPAT_STATUS, compatibilityService } from '../../services/products/compatibilityService.js';

/**
 * Derives a human-readable accessibility label / tooltip for compatibility status.
 * e.g. "Compatible with Suzuki Smash 125" or "Not compatible with Suzuki Smash 125"
 */
export function getCompatibilityLabel(status, bike, message) {
  const isCompatible = status === COMPAT_STATUS.COMPATIBLE || status === 'compatible';
  const isIncompatible = status === COMPAT_STATUS.INCOMPATIBLE || status === 'incompatible';

  if (!isCompatible && !isIncompatible) return null;

  let bikeName = '';
  if (bike) {
    bikeName = compatibilityService.bikeLabel(bike);
  }
  if (!bikeName && message) {
    // Extract motorcycle model name if present in legacy format message:
    // e.g. "✓ Compatible with your Suzuki Smash 125" -> "Suzuki Smash 125"
    bikeName = message
      .replace(/^[✓✗\s]+/, '')
      .replace(/^(?:Not\s+)?compatible\s+with\s+(?:your\s+)?/i, '')
      .trim();
  }

  if (isCompatible) {
    return bikeName ? `Compatible with ${bikeName}` : 'Compatible with your motorcycle';
  } else {
    return bikeName ? `Not compatible with ${bikeName}` : 'Not compatible with your motorcycle';
  }
}

/**
 * Compact circular compatibility indicator for product cards.
 * Overlays the top-left of the product image with:
 * - Green circle + white check icon for compatible products
 * - Red circle + white X icon for incompatible products
 * Shows tooltip/accessibility label with motorcycle details on hover.
 */
export default function CompatibilityIndicator({
  status,
  bike,
  bikeLabel,
  message,
  size = 26,
  style,
}) {
  const isCompatible = status === COMPAT_STATUS.COMPATIBLE || status === 'compatible';
  const isIncompatible = status === COMPAT_STATUS.INCOMPATIBLE || status === 'incompatible';

  if (!isCompatible && !isIncompatible) {
    return null;
  }

  const tooltipText =
    (bikeLabel
      ? (isCompatible ? `Compatible with ${bikeLabel}` : `Not compatible with ${bikeLabel}`)
      : null) || getCompatibilityLabel(status, bike, message);

  const isGreen = isCompatible;
  const bgColor = isGreen ? '#10B981' : '#EF4444';
  const iconName = isGreen ? 'check-lg' : 'x-lg';
  const iconSize = isGreen ? 14 : 12;

  const webAttributes =
    Platform.OS === 'web'
      ? {
          title: tooltipText,
          'aria-label': tooltipText,
        }
      : {};

  return (
    <View
      style={[
        styles.indicator,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={tooltipText}
      {...webAttributes}
    >
      <BootstrapIcon name={iconName} size={iconSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.22)',
          cursor: 'help',
          transition: 'transform 0.15s ease',
        }
      : {}),
  },
});
