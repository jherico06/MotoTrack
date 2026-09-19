import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome5, Octicons } from '@expo/vector-icons';

// Ensure Bootstrap Icons font CDN is loaded in browser
if (
  Platform.OS === 'web' &&
  typeof document !== 'undefined' &&
  !document.getElementById('bootstrap-icons-cdn')
) {
  const bsLink = document.createElement('link');
  bsLink.id = 'bootstrap-icons-cdn';
  bsLink.rel = 'stylesheet';
  bsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
  document.head.appendChild(bsLink);
}

// Complete Icon dictionary mapping Bootstrap icon names to @expo/vector-icons
const ICON_MAP = {
  // Navigation & Core Controls
  house: { type: 'ion', name: 'home-outline' },
  'house-door': { type: 'ion', name: 'home-outline' },
  'house-door-fill': { type: 'ion', name: 'home' },
  'house-fill': { type: 'ion', name: 'home' },
  heart: { type: 'ion', name: 'heart-outline' },
  'heart-fill': { type: 'ion', name: 'heart' },
  person: { type: 'ion', name: 'person-outline' },
  'person-fill': { type: 'ion', name: 'person' },
  'person-circle': { type: 'ion', name: 'person-circle-outline' },
  speedometer: { type: 'ion', name: 'speedometer-outline' },
  speedometer2: { type: 'ion', name: 'speedometer-outline' },
  search: { type: 'ion', name: 'search-outline' },
  sliders: { type: 'ion', name: 'options-outline' },
  sliders2: { type: 'ion', name: 'options' },
  filter: { type: 'ion', name: 'filter' },
  funnel: { type: 'ion', name: 'funnel-outline' },
  'funnel-fill': { type: 'ion', name: 'funnel' },
  'three-dots': { type: 'ion', name: 'ellipsis-horizontal' },
  'three-dots-vertical': { type: 'ion', name: 'ellipsis-vertical' },
  grid: { type: 'ion', name: 'grid-outline' },
  'grid-fill': { type: 'ion', name: 'grid' },
  'grid-1x2-fill': { type: 'mci', name: 'view-dashboard' },
  'grid-3x3-gap-fill': { type: 'ion', name: 'grid' },
  list: { type: 'ion', name: 'list-outline' },
  'list-task': { type: 'ion', name: 'list' },
  'list-check': { type: 'ion', name: 'checkbox-outline' },

  // Arrows & Chevrons & Movements
  'arrow-right': { type: 'ion', name: 'arrow-forward' },
  'arrow-left': { type: 'ion', name: 'arrow-back' },
  'arrow-up': { type: 'ion', name: 'arrow-up' },
  'arrow-down': { type: 'ion', name: 'arrow-down' },
  'arrow-up-right': { type: 'ion', name: 'arrow-redo-outline' },
  'chevron-left': { type: 'ion', name: 'chevron-back' },
  'chevron-right': { type: 'ion', name: 'chevron-forward' },
  'chevron-up': { type: 'ion', name: 'chevron-up' },
  'chevron-down': { type: 'ion', name: 'chevron-down' },
  'arrow-repeat': { type: 'ion', name: 'refresh' },
  'arrow-counterclockwise': { type: 'ion', name: 'reload' },
  'arrow-clockwise': { type: 'ion', name: 'sync' },

  // Shopping, Cart, Bags & Retail
  bag: { type: 'ion', name: 'bag-outline' },
  'bag-fill': { type: 'ion', name: 'bag' },
  'bag-check': { type: 'ion', name: 'bag-check-outline' },
  'bag-check-fill': { type: 'ion', name: 'bag-check' },
  'bag-plus': { type: 'ion', name: 'bag-add-outline' },
  'bag-plus-fill': { type: 'ion', name: 'bag-add' },
  'bag-dash': { type: 'ion', name: 'bag-remove-outline' },
  'bag-dash-fill': { type: 'ion', name: 'bag-remove' },
  'bag-x': { type: 'ion', name: 'bag-remove-outline' },
  'bag-heart': { type: 'ion', name: 'bag-outline' },
  'bag-heart-fill': { type: 'ion', name: 'bag' },
  cart: { type: 'ion', name: 'cart-outline' },
  cart2: { type: 'ion', name: 'cart-outline' },
  cart3: { type: 'ion', name: 'cart-outline' },
  cart4: { type: 'ion', name: 'cart-outline' },
  'cart-fill': { type: 'ion', name: 'cart' },
  'cart-check': { type: 'mci', name: 'cart-check' },
  'cart-check-fill': { type: 'mci', name: 'cart-check' },
  'cart-plus': { type: 'mci', name: 'cart-plus' },
  'cart-plus-fill': { type: 'mci', name: 'cart-plus' },
  'cart-dash': { type: 'mci', name: 'cart-minus' },
  'cart-x': { type: 'mci', name: 'cart-remove' },
  shop: { type: 'ion', name: 'storefront' },
  'shop-window': { type: 'ion', name: 'storefront-outline' },

  // Boxes & Inventory & File Actions
  box: { type: 'ion', name: 'cube-outline' },
  'box-fill': { type: 'ion', name: 'cube' },
  'box-seam': { type: 'ion', name: 'cube-outline' },
  'box-seam-fill': { type: 'ion', name: 'cube' },
  boxes: { type: 'mci', name: 'package-variant-closed' },
  'box-arrow-right': { type: 'ion', name: 'log-out-outline' },
  'box-arrow-left': { type: 'ion', name: 'log-in-outline' },
  'box-arrow-in-right': { type: 'ion', name: 'log-in-outline' },
  'box-arrow-up-right': { type: 'ion', name: 'open-outline' },
  'box-arrow-in-down': { type: 'ion', name: 'download-outline' },
  'box-arrow-up': { type: 'ion', name: 'arrow-up-circle-outline' },
  'box-arrow-down': { type: 'ion', name: 'arrow-down-circle-outline' },
  'file-earmark-excel': { type: 'mci', name: 'file-excel-outline' },
  'file-earmark-excel-fill': { type: 'mci', name: 'file-excel' },
  'file-earmark-spreadsheet': { type: 'mci', name: 'table' },
  folder: { type: 'ion', name: 'folder-outline' },
  'folder-fill': { type: 'ion', name: 'folder' },
  'folder2-open': { type: 'ion', name: 'folder-open' },
  plug: { type: 'ion', name: 'flash-outline' },
  'plug-fill': { type: 'ion', name: 'flash' },

  // Admin & Dashboard Navigation Tabs
  'graph-up': { type: 'mci', name: 'chart-line' },
  'graph-up-arrow': { type: 'mci', name: 'chart-line' },
  'clipboard-data': { type: 'mci', name: 'clipboard-text-outline' },
  'bar-chart-fill': { type: 'ion', name: 'bar-chart' },
  'pie-chart-fill': { type: 'ion', name: 'pie-chart' },
  'ticket-perforated': { type: 'mci', name: 'ticket-percent-outline' },
  'ticket-perforated-fill': { type: 'mci', name: 'ticket-percent' },
  'ticket-detailed-fill': { type: 'mci', name: 'ticket-confirmation' },
  database: { type: 'mci', name: 'database' },
  'database-fill': { type: 'mci', name: 'database' },
  'database-gear': { type: 'mci', name: 'database-cog' },
  'database-fill-gear': { type: 'mci', name: 'database-cog' },
  'database-check': { type: 'mci', name: 'database-check' },
  'database-fill-check': { type: 'mci', name: 'database-check' },
  'database-add': { type: 'mci', name: 'database-plus' },
  'database-fill-add': { type: 'mci', name: 'database-plus' },
  tag: { type: 'ion', name: 'pricetag-outline' },
  'tag-fill': { type: 'ion', name: 'pricetag' },
  tags: { type: 'ion', name: 'pricetags-outline' },
  'tags-fill': { type: 'ion', name: 'pricetags' },

  // Favorites & Ratings
  heart: { type: 'ion', name: 'heart-outline' },
  'heart-fill': { type: 'ion', name: 'heart' },
  'heart-half': { type: 'ion', name: 'heart-half' },
  star: { type: 'ion', name: 'star-outline' },
  'star-fill': { type: 'ion', name: 'star' },
  'star-half': { type: 'ion', name: 'star-half' },
  stars: { type: 'ion', name: 'sparkles-outline' },
  magic: { type: 'ion', name: 'color-wand-outline' },
  sparkles: { type: 'ion', name: 'sparkles-outline' },

  // Users & Auth & Security
  person: { type: 'ion', name: 'person-outline' },
  'person-fill': { type: 'ion', name: 'person' },
  'person-circle': { type: 'ion', name: 'person-circle-outline' },
  'person-plus': { type: 'ion', name: 'person-add-outline' },
  'person-plus-fill': { type: 'ion', name: 'person-add' },
  'person-check': { type: 'ion', name: 'person-outline' },
  'person-check-fill': { type: 'ion', name: 'person' },
  people: { type: 'ion', name: 'people-outline' },
  'people-fill': { type: 'ion', name: 'people' },
  lock: { type: 'ion', name: 'lock-closed-outline' },
  'lock-fill': { type: 'ion', name: 'lock-closed' },
  unlock: { type: 'ion', name: 'lock-open-outline' },
  'unlock-fill': { type: 'ion', name: 'lock-open' },
  shield: { type: 'ion', name: 'shield-outline' },
  'shield-fill': { type: 'ion', name: 'shield' },
  'shield-lock': { type: 'ion', name: 'shield-outline' },
  'shield-lock-fill': { type: 'ion', name: 'shield-checkmark' },
  'shield-check': { type: 'ion', name: 'shield-checkmark-outline' },
  'shield-fill-check': { type: 'ion', name: 'shield-checkmark' },
  'patch-check': { type: 'ion', name: 'shield-checkmark-outline' },
  'patch-check-fill': { type: 'ion', name: 'shield-checkmark' },
  key: { type: 'ion', name: 'key-outline' },
  'key-fill': { type: 'ion', name: 'key' },

  // Communication, Chat & Contacts
  envelope: { type: 'ion', name: 'mail-outline' },
  'envelope-fill': { type: 'ion', name: 'mail' },
  'envelope-check': { type: 'ion', name: 'mail' },
  'envelope-open': { type: 'ion', name: 'mail-open-outline' },
  phone: { type: 'ion', name: 'call-outline' },
  'phone-fill': { type: 'ion', name: 'call' },
  telephone: { type: 'ion', name: 'call-outline' },
  'telephone-fill': { type: 'ion', name: 'call' },
  chat: { type: 'ion', name: 'chatbubble-outline' },
  'chat-dots': { type: 'ion', name: 'chatbubbles-outline' },
  'chat-dots-fill': { type: 'ion', name: 'chatbubbles' },
  'chat-text': { type: 'ion', name: 'chatbox-ellipses-outline' },
  'chat-text-fill': { type: 'ion', name: 'chatbox-ellipses' },
  send: { type: 'ion', name: 'paper-plane-outline' },
  'send-fill': { type: 'ion', name: 'paper-plane' },
  bell: { type: 'ion', name: 'notifications-outline' },
  'bell-fill': { type: 'ion', name: 'notifications' },

  // Checks, Alerts, Toggles & Deletion
  check: { type: 'ion', name: 'checkmark' },
  check2: { type: 'ion', name: 'checkmark' },
  'check-all': { type: 'ion', name: 'checkmark-done' },
  'check2-all': { type: 'ion', name: 'checkmark-done' },
  'check-circle': { type: 'ion', name: 'checkmark-circle-outline' },
  'check-circle-fill': { type: 'ion', name: 'checkmark-circle' },
  'check2-circle': { type: 'ion', name: 'checkmark-circle' },
  'check-square': { type: 'ion', name: 'checkbox-outline' },
  'check-square-fill': { type: 'ion', name: 'checkbox' },
  x: { type: 'ion', name: 'close' },
  'x-lg': { type: 'ion', name: 'close' },
  'x-circle': { type: 'ion', name: 'close-circle-outline' },
  'x-circle-fill': { type: 'ion', name: 'close-circle' },
  'x-square': { type: 'ion', name: 'close-outline' },
  trash: { type: 'ion', name: 'trash-outline' },
  trash2: { type: 'ion', name: 'trash-outline' },
  trash3: { type: 'ion', name: 'trash-outline' },
  'trash-fill': { type: 'ion', name: 'trash' },
  'trash3-fill': { type: 'ion', name: 'trash' },
  exclamation: { type: 'ion', name: 'alert' },
  'exclamation-triangle': { type: 'ion', name: 'warning-outline' },
  'exclamation-triangle-fill': { type: 'ion', name: 'warning' },
  'exclamation-circle': { type: 'ion', name: 'alert-circle-outline' },
  'exclamation-circle-fill': { type: 'ion', name: 'alert-circle' },
  info: { type: 'ion', name: 'information-outline' },
  'info-circle': { type: 'ion', name: 'information-circle-outline' },
  'info-circle-fill': { type: 'ion', name: 'information-circle' },
  'question-circle': { type: 'ion', name: 'help-circle-outline' },
  'question-circle-fill': { type: 'ion', name: 'help-circle' },
  crosshair: { type: 'mci', name: 'crosshairs-gps' },
  'toggle-on': { type: 'mci', name: 'toggle-switch' },
  'toggle-off': { type: 'mci', name: 'toggle-switch-off' },

  // Orders, Delivery, Money & Payments
  truck: { type: 'mci', name: 'truck-delivery' },
  'truck-flatbed': { type: 'mci', name: 'truck' },
  receipt: { type: 'ion', name: 'receipt-outline' },
  'receipt-cutoff': { type: 'mci', name: 'receipt-text' },
  'credit-card': { type: 'ion', name: 'card-outline' },
  'credit-card-2-front': { type: 'ion', name: 'card-outline' },
  'credit-card-fill': { type: 'ion', name: 'card' },
  'credit-card-2-front-fill': { type: 'ion', name: 'card' },
  cash: { type: 'ion', name: 'cash-outline' },
  'cash-stack': { type: 'mci', name: 'cash-multiple' },
  'cash-coin': { type: 'mci', name: 'cash-multiple' },
  'currency-dollar': { type: 'ion', name: 'cash-outline' },
  wallet: { type: 'ion', name: 'wallet-outline' },
  wallet2: { type: 'ion', name: 'wallet-outline' },
  'wallet-fill': { type: 'ion', name: 'wallet' },
  printer: { type: 'ion', name: 'print-outline' },
  'printer-fill': { type: 'ion', name: 'print' },

  // Sorting & Filtering
  'sort-numeric-down': { type: 'mci', name: 'sort-numeric-ascending' },
  'sort-numeric-up': { type: 'mci', name: 'sort-numeric-descending' },
  'sort-alpha-down': { type: 'mci', name: 'sort-alphabetical-ascending' },
  'sort-alpha-up': { type: 'mci', name: 'sort-alphabetical-descending' },

  // Garage, Tools, Motorcycle & Maps
  tools: { type: 'ion', name: 'construct-outline' },
  wrench: { type: 'ion', name: 'build-outline' },
  'wrench-adjustable': { type: 'mci', name: 'wrench' },
  'wrench-adjustable-circle': { type: 'mci', name: 'wrench-clock' },
  'wrench-adjustable-circle-fill': { type: 'mci', name: 'wrench-clock' },
  gear: { type: 'ion', name: 'settings-outline' },
  'gear-fill': { type: 'ion', name: 'settings' },
  'gear-wide': { type: 'ion', name: 'settings-outline' },
  'gear-wide-connected': { type: 'ion', name: 'settings-outline' },
  'geo-alt': { type: 'ion', name: 'location-outline' },
  'geo-alt-fill': { type: 'ion', name: 'location' },
  geo: { type: 'ion', name: 'location-outline' },
  'geo-fill': { type: 'ion', name: 'location' },
  'pin-map': { type: 'ion', name: 'location-outline' },
  'pin-map-fill': { type: 'ion', name: 'location' },
  map: { type: 'ion', name: 'map-outline' },
  'map-fill': { type: 'ion', name: 'map' },
  compass: { type: 'ion', name: 'compass-outline' },
  'compass-fill': { type: 'ion', name: 'compass' },
  globe: { type: 'ion', name: 'globe-outline' },
  tree: { type: 'mci', name: 'pine-tree' },
  'tree-fill': { type: 'mci', name: 'pine-tree' },
  bicycle: { type: 'ion', name: 'bicycle' },

  // Dates & Calendar
  calendar: { type: 'ion', name: 'calendar-outline' },
  'calendar-fill': { type: 'ion', name: 'calendar' },
  'calendar-check': { type: 'ion', name: 'calendar-outline' },
  'calendar-check-fill': { type: 'ion', name: 'calendar' },
  'calendar2-check': { type: 'ion', name: 'calendar-outline' },
  'calendar2-check-fill': { type: 'ion', name: 'calendar' },
  'calendar-plus': { type: 'mci', name: 'calendar-plus' },
  'calendar-plus-fill': { type: 'mci', name: 'calendar-plus' },
  'calendar-event': { type: 'ion', name: 'calendar-outline' },
  'calendar-event-fill': { type: 'ion', name: 'calendar' },
  calendar3: { type: 'ion', name: 'calendar-outline' },
  'calendar-range': { type: 'ion', name: 'calendar-outline' },
  'calendar-x': { type: 'ion', name: 'calendar-clear-outline' },
  'calendar-x-fill': { type: 'ion', name: 'calendar-clear' },
  clock: { type: 'ion', name: 'time-outline' },
  'clock-fill': { type: 'ion', name: 'time' },
  'clock-history': { type: 'ion', name: 'time-outline' },

  // Editing & Media & Devices
  'three-dots': { type: 'ion', name: 'ellipsis-horizontal' },
  'three-dots-vertical': { type: 'ion', name: 'ellipsis-vertical' },
  pencil: { type: 'ion', name: 'pencil' },
  'pencil-square': { type: 'ion', name: 'create-outline' },
  'pencil-fill': { type: 'ion', name: 'pencil' },
  'plus-lg': { type: 'ion', name: 'add' },
  plus: { type: 'ion', name: 'add' },
  'plus-circle': { type: 'ion', name: 'add-circle-outline' },
  'plus-circle-fill': { type: 'ion', name: 'add-circle' },
  dash: { type: 'ion', name: 'remove' },
  'dash-lg': { type: 'ion', name: 'remove' },
  'dash-circle': { type: 'ion', name: 'remove-circle-outline' },
  'dash-circle-fill': { type: 'ion', name: 'remove-circle' },
  eye: { type: 'ion', name: 'eye-outline' },
  'eye-fill': { type: 'ion', name: 'eye' },
  'eye-slash': { type: 'ion', name: 'eye-off-outline' },
  'eye-slash-fill': { type: 'ion', name: 'eye-off' },
  camera: { type: 'ion', name: 'camera-outline' },
  'camera-fill': { type: 'ion', name: 'camera' },
  image: { type: 'ion', name: 'image-outline' },
  'image-fill': { type: 'ion', name: 'image' },
  images: { type: 'ion', name: 'images-outline' },
  copy: { type: 'ion', name: 'copy-outline' },
  download: { type: 'ion', name: 'download-outline' },
  upload: { type: 'ion', name: 'cloud-upload-outline' },
  cpu: { type: 'ion', name: 'hardware-chip-outline' },
  'cpu-fill': { type: 'ion', name: 'hardware-chip' },
  lightning: { type: 'ion', name: 'flash-outline' },
  'lightning-fill': { type: 'ion', name: 'flash' },
  'lightning-charge': { type: 'ion', name: 'flash-outline' },
  'lightning-charge-fill': { type: 'ion', name: 'flash' },
  building: { type: 'ion', name: 'business' },
  'building-fill': { type: 'ion', name: 'business' },
  house: { type: 'ion', name: 'home-outline' },
  'house-door': { type: 'ion', name: 'home-outline' },
  'house-door-fill': { type: 'ion', name: 'home' },
  laptop: { type: 'ion', name: 'laptop-outline' },
  'laptop-fill': { type: 'ion', name: 'laptop' },
  'phone-landscape': { type: 'ion', name: 'phone-landscape-outline' },
  share: { type: 'ion', name: 'share-social-outline' },
  'share-fill': { type: 'ion', name: 'share-social-outline' },
  'qr-code': { type: 'ion', name: 'qr-code-outline' },
  'qr-code-scan': { type: 'ion', name: 'scan-outline' },
  play: { type: 'ion', name: 'play-outline' },
  'play-fill': { type: 'ion', name: 'play' },
  pause: { type: 'ion', name: 'pause-outline' },
  'pause-fill': { type: 'ion', name: 'pause' },
  'cone-striped': { type: 'mci', name: 'cone' },
  'fuel-pump': { type: 'mci', name: 'gas-station-outline' },
  'fuel-pump-fill': { type: 'mci', name: 'gas-station' },
  'slash-circle': { type: 'ion', name: 'ban-outline' },
  circle: { type: 'ion', name: 'ellipse-outline' },
  'circle-fill': { type: 'ion', name: 'ellipse' },
  facebook: { type: 'ion', name: 'logo-facebook' },
  google: { type: 'ion', name: 'logo-google' },
  apple: { type: 'ion', name: 'logo-apple' },
  award: { type: 'ion', name: 'ribbon-outline' },
  'award-fill': { type: 'ion', name: 'ribbon' },
  trophy: { type: 'ion', name: 'trophy-outline' },
  'trophy-fill': { type: 'ion', name: 'trophy' },
};

// Intelligent pattern fallback helper for any arbitrary Bootstrap icon name on mobile
function getFallbackIcon(cleanName) {
  if (cleanName.startsWith('arrow-') || cleanName.startsWith('chevron-'))
    return { type: 'ion', name: 'arrow-forward' };
  if (cleanName.startsWith('check')) return { type: 'ion', name: 'checkmark' };
  if (cleanName.startsWith('x-') || cleanName === 'x') return { type: 'ion', name: 'close' };
  if (cleanName.startsWith('trash')) return { type: 'ion', name: 'trash' };
  if (cleanName.startsWith('shield')) return { type: 'ion', name: 'shield' };
  if (cleanName.startsWith('cart') || cleanName.startsWith('bag')) return { type: 'ion', name: 'cart' };
  if (cleanName.startsWith('person') || cleanName.startsWith('people'))
    return { type: 'ion', name: 'person' };
  if (cleanName.startsWith('card') || cleanName.startsWith('credit')) return { type: 'ion', name: 'card' };
  if (cleanName.startsWith('heart')) return { type: 'ion', name: 'heart' };
  if (cleanName.startsWith('star')) return { type: 'ion', name: 'star' };
  if (cleanName.startsWith('camera') || cleanName.startsWith('image')) return { type: 'ion', name: 'camera' };
  if (cleanName.startsWith('calendar') || cleanName.startsWith('clock'))
    return { type: 'ion', name: 'calendar' };
  if (cleanName.startsWith('gear') || cleanName.startsWith('tool') || cleanName.startsWith('wrench'))
    return { type: 'ion', name: 'construct' };
  if (cleanName.startsWith('chat') || cleanName.startsWith('envelope'))
    return { type: 'ion', name: 'chatbubble' };
  if (cleanName.startsWith('file') || cleanName.startsWith('folder'))
    return { type: 'ion', name: 'document' };
  if (cleanName.startsWith('box')) return { type: 'ion', name: 'cube' };
  if (cleanName.startsWith('geo') || cleanName.startsWith('pin') || cleanName.startsWith('map'))
    return { type: 'ion', name: 'location' };
  return { type: 'ion', name: 'ellipse' };
}

export default function BootstrapIcon({ name, size = 16, color = '#0F172A', style }) {
  const iconColor = color === 'currentColor' ? '#0F172A' : color;
  const flatStyle = StyleSheet.flatten(style) || {};

  // Clean name in case `bi-` prefix was passed
  const cleanName = (name || '').replace(/^bi-/, '').trim();

  // 1. Web Environment: Direct High-Fidelity Bootstrap Icons HTML Icon Rendering
  if (Platform.OS === 'web') {
    return (
      <i
        className={`bi bi-${cleanName}`}
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
  const mapped = ICON_MAP[cleanName] || getFallbackIcon(cleanName);

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

export { BootstrapIcon };
