import React from 'react';
import { Linking, Platform, TouchableOpacity } from 'react-native';

/** Open http/tel/maps URLs without relying on window.open (often blocked). */
export function openExternalUrl(url) {
  const href = String(url || '').trim();
  if (!href) return;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  Linking.openURL(href).catch(() => {});
}

export default function ExternalLink({ href, children, style, activeOpacity = 0.85 }) {
  const url = String(href || '').trim();
  if (!url) return children || null;
  if (Platform.OS === 'web') {
    return React.createElement(
      'a',
      {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: { textDecoration: 'none', color: 'inherit', display: 'block', ...(style || {}) },
      },
      children
    );
  }
  return (
    <TouchableOpacity onPress={() => openExternalUrl(url)} activeOpacity={activeOpacity} style={style}>
      {children}
    </TouchableOpacity>
  );
}
