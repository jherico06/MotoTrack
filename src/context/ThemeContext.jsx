import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { appStorage } from '../services/system/storageAdapter.js';

const ThemeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
  tokens: {},
});

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved =
        appStorage.getItem('mototrack_customer_dark_mode') ||
        appStorage.getItem('mototrack_theme_mode');
      return saved === 'true' || saved === 'dark';
    } catch (_e) {
      return false;
    }
  });

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        appStorage.setItem('mototrack_customer_dark_mode', String(next));
        appStorage.setItem('mototrack_theme_mode', next ? 'dark' : 'light');
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.classList.toggle('dark', next);
        }
      } catch (_e) {}
      return next;
    });
  };

  const setDarkMode = (val) => {
    const next = Boolean(val);
    setIsDarkMode(next);
    try {
      appStorage.setItem('mototrack_customer_dark_mode', String(next));
      appStorage.setItem('mototrack_theme_mode', next ? 'dark' : 'light');
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.toggle('dark', next);
      }
    } catch (_e) {}
  };

  // Keep DOM class synced on web
  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }, [isDarkMode]);

  // Color tokens matching admin dark theme and customer profile design system
  const tokens = useMemo(() => {
    if (isDarkMode) {
      return {
        isDark: true,
        bgMain: '#121518',
        bgCard: '#1C2025',
        bgSub: '#181B1F',
        bgSubtle: '#1E2227',
        bgElevated: '#252A30',
        bgHover: '#252A30',
        border: '#282D34',
        borderLight: '#202429',
        borderInput: '#282D34',
        borderFocus: '#EA580C',
        textPrimary: '#F8FAFC',
        textSecondary: '#E2E8F0',
        textMuted: '#94A3B8',
        textSubtle: '#64748B',
        brandPrimary: '#EA580C',
        brandPrimaryDark: '#C2410C',
        brandLight: 'rgba(234, 88, 12, 0.12)',
        brandBorder: 'rgba(234, 88, 12, 0.30)',
        headerBg: '#181B1F',
        headerBorder: '#282D34',
        cardShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
        tagBg: 'rgba(234, 88, 12, 0.12)',
        tagText: '#EA580C',
      };
    }

    return {
      isDark: false,
      bgMain: '#F3F4F6',
      bgCard: '#FFFFFF',
      bgSub: '#F3F4F6',
      bgSubtle: '#F1F5F9',
      bgElevated: '#FFFFFF',
      bgHover: '#F1F5F9',
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      borderInput: '#E2E8F0',
      borderFocus: '#EA580C',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      textSubtle: '#94A3B8',
      brandPrimary: '#EA580C',
      brandPrimaryDark: '#C2410C',
      brandLight: '#FFF7ED',
      brandBorder: '#FED7AA',
      headerBg: '#1E2227',
      headerBorder: '#E2E8F0',
      cardShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      tagBg: '#FFF7ED',
      tagText: '#EA580C',
    };
  }, [isDarkMode]);

  const value = useMemo(
    () => ({
      isDarkMode,
      toggleDarkMode,
      setDarkMode,
      tokens,
    }),
    [isDarkMode, tokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDarkMode: false,
      toggleDarkMode: () => {},
      setDarkMode: () => {},
      tokens: {
        isDark: false,
        bgMain: '#F3F4F6',
        bgCard: '#FFFFFF',
        bgSub: '#F3F4F6',
        border: '#E5E7EB',
        textPrimary: '#111827',
        textMuted: '#6B7280',
        brandPrimary: '#EA580C',
      },
    };
  }
  return context;
}
