import React from 'react';
import { Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';

export default function ServiceCategoryIcon({ category = '', size = 18, color = '#EA580C', style }) {
  const cat = String(category || '').trim().toLowerCase();

  if (Platform.OS === 'web') {
    if (cat.includes('engine')) {
      // Crisp outline engine icon matching target UI
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
        >
          <path d="M4 10V8a2 2 0 0 1 2-2h2V4h2v2h4V4h2v2h2a2 2 0 0 1 2 2v2" />
          <rect x="2" y="10" width="20" height="10" rx="2" />
          <line x1="1" y1="14" x2="4" y2="14" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <circle cx="12" cy="15" r="2.5" />
        </svg>
      );
    }

    if (cat.includes('brake')) {
      // Ventilated disc brake rotor icon matching target UI
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="6" r="0.9" fill={color} />
          <circle cx="12" cy="18" r="0.9" fill={color} />
          <circle cx="6" cy="12" r="0.9" fill={color} />
          <circle cx="18" cy="12" r="0.9" fill={color} />
          <circle cx="7.75" cy="7.75" r="0.9" fill={color} />
          <circle cx="16.25" cy="16.25" r="0.9" fill={color} />
          <circle cx="7.75" cy="16.25" r="0.9" fill={color} />
          <circle cx="16.25" cy="7.75" r="0.9" fill={color} />
        </svg>
      );
    }

    if (cat.includes('tune') || cat.includes('maintenance')) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    }

    if (cat.includes('electrical')) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    }

    if (cat.includes('suspension') || cat.includes('chassis')) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
        >
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    }

    if (cat.includes('drive')) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    }
  }

  // Native / fallback mapping
  let iconName = 'tools';
  if (cat.includes('engine')) iconName = 'gear-wide-connected';
  else if (cat.includes('brake')) iconName = 'shield-shaded';
  else if (cat.includes('tune') || cat.includes('maintenance')) iconName = 'wrench-adjustable';
  else if (cat.includes('electrical')) iconName = 'lightning-charge-fill';
  else if (cat.includes('suspension') || cat.includes('chassis')) iconName = 'tools';
  else if (cat.includes('drive')) iconName = 'link-45deg';
  else if (cat.includes('other')) iconName = 'grid-fill';

  return <BootstrapIcon name={iconName} size={size} color={color} style={style} />;
}
