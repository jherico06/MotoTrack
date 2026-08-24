import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome5,
  Octicons,
} from '@expo/vector-icons';

// Ensure Bootstrap Icons font CDN is loaded in browser
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('bootstrap-icons-cdn')) {
  const bsLink = document.createElement('link');
  bsLink.id = 'bootstrap-icons-cdn';
  bsLink.rel = 'stylesheet';
  bsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
  document.head.appendChild(bsLink);
}

// Complete Icon dictionary mapping Bootstrap icon names to @expo/vector-icons
const ICON_MAP = {
  // Navigation & Core Controls
  'speedometer': { type: 'ion', name: 'speedometer' },
  'speedometer2': { type: 'ion', name: 'speedometer' },
  'search': { type: 'ion', name: 'search' },
  'sliders': { type: 'ion', name: 'options-outline' },
  'filter': { type: 'ion', name: 'filter' },
  'funnel': { type: 'ion', name: 'funnel-outline' },
  'funnel-fill': { type: 'ion', name: 'funnel' },
  'three-dots': { type: 'ion', name: 'ellipsis-horizontal' },
  'three-dots-vertical': { type: 'ion', name: 'ellipsis-vertical' },

  // Arrows & Chevrons
  'arrow-right': { type: 'ion', name: 'arrow-forward' },
  'arrow-left': { type: 'ion', name: 'arrow-back' },
  'arrow-up': { type: 'ion', name: 'arrow-up' },
  'arrow-down': { type: 'ion', name: 'arrow-down' },
  'chevron-left': { type: 'ion', name: 'chevron-back' },
  'chevron-right': { type: 'ion', name: 'chevron-forward' },
  'chevron-up': { type: 'ion', name: 'chevron-up' },
  'chevron-down': { type: 'ion', name: 'chevron-down' },
  'arrow-repeat': { type: 'ion', name: 'refresh' },
  'arrow-counterclockwise': { type: 'ion', name: 'reload' },
  'arrow-clockwise': { type: 'ion', name: 'sync' },

  // Shopping & Cart & Bags
  'bag': { type: 'ion', name: 'bag-outline' },
  'bag-fill': { type: 'ion', name: 'bag' },
  'bag-check': { type: 'ion', name: 'bag-check-outline' },
  'bag-check-fill': { type: 'ion', name: 'bag-check' },
  'bag-plus': { type: 'ion', name: 'bag-add-outline' },
  'bag-plus-fill': { type: 'ion', name: 'bag-add' },
  'bag-x': { type: 'ion', name: 'bag-remove-outline' },
  'cart': { type: 'ion', name: 'cart-outline' },
  'cart3': { type: 'ion', name: 'cart-outline' },
  'cart-fill': { type: 'ion', name: 'cart' },
  'cart-check-fill': { type: 'mci', name: 'cart-check' },
  'cart-plus-fill': { type: 'ion', name: 'cart' },
  'shop': { type: 'ion', name: 'storefront' },

  // Boxes & Inventory & Actions
  'box-seam': { type: 'ion', name: 'cube-outline' },
  'box-seam-fill': { type: 'ion', name: 'cube' },
  'box-arrow-right': { type: 'ion', name: 'log-out-outline' },
  'box-arrow-in-right': { type: 'ion', name: 'log-in-outline' },
  'box-arrow-up-right': { type: 'ion', name: 'open-outline' },
  'box-arrow-in-down': { type: 'ion', name: 'download-outline' },
  'folder2-open': { type: 'ion', name: 'folder-open' },
  'plug-fill': { type: 'ion', name: 'flash' },

  // Admin & Dashboard Navigation Tabs
  'grid-1x2-fill': { type: 'mci', name: 'view-dashboard' },
  'grid-fill': { type: 'ion', name: 'grid' },
  'graph-up-arrow': { type: 'mci', name: 'chart-line' },
  'ticket-perforated-fill': { type: 'mci', name: 'ticket-percent' },
  'database-fill-gear': { type: 'mci', name: 'database-cog' },
  'database-fill-check': { type: 'mci', name: 'database-check' },
  'database': { type: 'mci', name: 'database' },
  'tag-fill': { type: 'ion', name: 'pricetag' },
  'tag': { type: 'ion', name: 'pricetag-outline' },

  // Favorites & Ratings
  'heart': { type: 'ion', name: 'heart-outline' },
  'heart-fill': { type: 'ion', name: 'heart' },
  'star': { type: 'ion', name: 'star-outline' },
  'star-fill': { type: 'ion', name: 'star' },
  'star-half': { type: 'ion', name: 'star-half' },
  'stars': { type: 'ion', name: 'sparkles' },

  // Users & Auth
  'person': { type: 'ion', name: 'person-outline' },
  'person-fill': { type: 'ion', name: 'person' },
  'person-circle': { type: 'ion', name: 'person-circle-outline' },
  'person-plus-fill': { type: 'ion', name: 'person-add' },
  'people-fill': { type: 'ion', name: 'people' },
  'people': { type: 'ion', name: 'people-outline' },
  'lock': { type: 'ion', name: 'lock-closed-outline' },
  'lock-fill': { type: 'ion', name: 'lock-closed' },
  'shield-lock': { type: 'ion', name: 'shield-outline' },
  'shield-lock-fill': { type: 'ion', name: 'shield-checkmark' },
  'patch-check-fill': { type: 'ion', name: 'shield-checkmark' },
  'key-fill': { type: 'ion', name: 'key' },

  // Communication & Status
  'envelope': { type: 'ion', name: 'mail-outline' },
  'envelope-fill': { type: 'ion', name: 'mail' },
  'phone': { type: 'ion', name: 'call-outline' },
  'phone-fill': { type: 'ion', name: 'call' },
  'telephone-fill': { type: 'ion', name: 'call' },
  'chat-dots-fill': { type: 'ion', name: 'chatbubbles' },
  'chat-text-fill': { type: 'ion', name: 'chatbox-ellipses' },
  'send-fill': { type: 'ion', name: 'paper-plane' },

  // Checks & Alerts & Deletion
  'check2': { type: 'ion', name: 'checkmark' },
  'check-circle': { type: 'ion', name: 'checkmark-circle-outline' },
  'check-circle-fill': { type: 'ion', name: 'checkmark-circle' },
  'check2-circle': { type: 'ion', name: 'checkmark-circle' },
  'x-lg': { type: 'ion', name: 'close' },
  'x-circle': { type: 'ion', name: 'close-circle-outline' },
  'x-circle-fill': { type: 'ion', name: 'close-circle' },
  'trash': { type: 'ion', name: 'trash-outline' },
  'trash3-fill': { type: 'ion', name: 'trash' },
  'exclamation-triangle-fill': { type: 'ion', name: 'warning' },
  'exclamation-circle': { type: 'ion', name: 'alert-circle' },
  'info-circle': { type: 'ion', name: 'information-circle-outline' },

  // Orders, Delivery, Money & Payments
  'truck': { type: 'mci', name: 'truck-delivery' },
  'receipt': { type: 'ion', name: 'receipt-outline' },
  'receipt-cutoff': { type: 'mci', name: 'receipt-text' },
  'credit-card': { type: 'ion', name: 'card-outline' },
  'cash': { type: 'ion', name: 'cash-outline' },
  'cash-stack': { type: 'mci', name: 'cash-multiple' },
  'cash-coin': { type: 'mci', name: 'cash-multiple' },
  'currency-dollar': { type: 'ion', name: 'cash-outline' },
  'wallet2': { type: 'ion', name: 'wallet-outline' },
  'printer-fill': { type: 'ion', name: 'print' },

  // Sorting
  'sort-numeric-down': { type: 'mci', name: 'sort-numeric-ascending' },
  'sort-numeric-up': { type: 'mci', name: 'sort-numeric-descending' },

  // Garage, Tools & Location
  'tools': { type: 'ion', name: 'construct' },
  'wrench': { type: 'ion', name: 'build' },
  'wrench-adjustable': { type: 'mci', name: 'wrench' },
  'wrench-adjustable-circle-fill': { type: 'mci', name: 'wrench-clock' },
  'gear-wide-connected': { type: 'ion', name: 'settings-outline' },
  'geo-alt': { type: 'ion', name: 'location-outline' },
  'geo-alt-fill': { type: 'ion', name: 'location' },
  'geo-fill': { type: 'ion', name: 'location' },
  'map': { type: 'ion', name: 'map-outline' },
  'map-fill': { type: 'ion', name: 'map' },
  'compass': { type: 'ion', name: 'compass' },
  'bicycle': { type: 'ion', name: 'bicycle' },

  // Dates & Calendar
  'calendar-check': { type: 'ion', name: 'calendar-outline' },
  'calendar-check-fill': { type: 'ion', name: 'calendar' },
  'calendar-event': { type: 'ion', name: 'calendar-outline' },
  'calendar3': { type: 'ion', name: 'calendar-outline' },
  'calendar-x': { type: 'ion', name: 'calendar-clear-outline' },
  'clock-fill': { type: 'ion', name: 'time' },
  'clock-history': { type: 'ion', name: 'time-outline' },

  // Editing & Controls
  'pencil': { type: 'ion', name: 'pencil' },
  'plus-lg': { type: 'ion', name: 'add' },
  'plus': { type: 'ion', name: 'add' },
  'eye': { type: 'ion', name: 'eye-outline' },
  'eye-slash': { type: 'ion', name: 'eye-off-outline' },
  'download': { type: 'ion', name: 'download-outline' },
  'lightning-charge-fill': { type: 'ion', name: 'flash' },
  'building': { type: 'ion', name: 'business' },
  'house-door-fill': { type: 'ion', name: 'home' },
  'laptop': { type: 'ion', name: 'laptop-outline' },
  'share-fill': { type: 'ion', name: 'share-social-outline' },
  'qr-code': { type: 'ion', name: 'qr-code-outline' },
  'qr-code-scan': { type: 'ion', name: 'scan-outline' },
  'play-fill': { type: 'ion', name: 'play' },
  'pause-fill': { type: 'ion', name: 'pause' },
  'cone-striped': { type: 'mci', name: 'cone' },
  'fuel-pump-fill': { type: 'mci', name: 'gas-station' },
  'slash-circle': { type: 'ion', name: 'ban-outline' },
  'circle': { type: 'ion', name: 'ellipse-outline' },
  'facebook': { type: 'ion', name: 'logo-facebook' },
  'google': { type: 'ion', name: 'logo-google' },
  'apple': { type: 'ion', name: 'logo-apple' },
};

export default function BootstrapIcon({
  name,
  size = 16,
  color = '#0F172A',
  style,
}) {
  const iconColor = color === 'currentColor' ? '#0F172A' : color;
  const flatStyle = StyleSheet.flatten(style) || {};

  // 1. Web Environment: Direct High-Fidelity Bootstrap Icons HTML Icon Rendering
  if (Platform.OS === 'web') {
    return (
      <i
        className={`bi bi-${name}`}
        style={{
          fontSize: size,
          color: iconColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          width: size,
          height: size,
          textAlign: 'center',
          verticalAlign: 'middle',
          ...flatStyle,
        }}
      />
    );
  }

  // 2. Mobile Environment (iOS / Android)
  const mapped = ICON_MAP[name];

  if (mapped) {
    if (mapped.type === 'mci') {
      return <MaterialCommunityIcons name={mapped.name} size={size} color={iconColor} style={flatStyle} />;
    }
    if (mapped.type === 'feather') {
      return <Feather name={mapped.name} size={size} color={iconColor} style={flatStyle} />;
    }
    if (mapped.type === 'fa5') {
      return <FontAwesome5 name={mapped.name} size={size} color={iconColor} style={flatStyle} />;
    }
    if (mapped.type === 'octicon') {
      return <Octicons name={mapped.name} size={size} color={iconColor} style={flatStyle} />;
    }
    return <Ionicons name={mapped.name} size={size} color={iconColor} style={flatStyle} />;
  }

  // Fallback to standard dot icon
  return <Ionicons name="ellipse" size={Math.min(size, 8)} color={iconColor} style={flatStyle} />;
}
