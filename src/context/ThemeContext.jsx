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
        appStorage.getItem('mototrack_theme_mode') ||
        appStorage.getItem('mototrack_customer_dark_mode') ||
        appStorage.getItem('mototrack_admin_dark_mode');
      const initial = saved === 'true' || saved === 'dark';
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.toggle('dark', initial);
      }
      return initial;
    } catch (_e) {
      return false;
    }
  });

  const syncStorageAndDom = (next) => {
    try {
      appStorage.setItem('mototrack_customer_dark_mode', String(next));
      appStorage.setItem('mototrack_admin_dark_mode', String(next));
      appStorage.setItem('mototrack_theme_mode', next ? 'dark' : 'light');
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.toggle('dark', next);
      }
    } catch (_e) {}
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      syncStorageAndDom(next);
      return next;
    });
  };

  const setDarkMode = (val) => {
    const next = Boolean(val);
    setIsDarkMode(next);
    syncStorageAndDom(next);
  };

  // Keep DOM class synced on web
  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }, [isDarkMode]);

  // Color tokens matching MotoTrack global dark theme and customer design system
  const tokens = useMemo(() => {
    if (isDarkMode) {
      if (Platform.OS === 'web') {
        return {
          isDark: true,
          bgMain: '#111315',
          bgSidebar: '#18181B',
          bgTopBar: '#111315',
          bgContent: '#18181B',
          bgCard: '#191A1D',
          bgSub: '#202124',
          bgSubtle: '#202124',
          bgElevated: '#202124',
          bgHover: '#292B2F',
          inputBg: '#202124',
          border: '#303236',
          borderLight: '#292B2F',
          divider: '#303236',
          borderInput: '#3A3B40',
          borderFocus: '#FF5A00',
          textPrimary: '#F2F2F3',
          textHeading: '#F5F5F5',
          textSecondary: '#A1A1AA',
          textMuted: '#71717A',
          textDisabled: '#52525B',
          textSubtle: '#71717A',
          brandPrimary: '#FF5A00',
          brandPrimaryDark: '#E95000',
          brandLight: '#3A241B',
          brandBorder: '#8A3D19',
          success: '#00C98D',
          warning: '#F5B942',
          error: '#F04444',
          info: '#3B82F6',
          headerBg: '#111315',
          headerBorder: '#303236',
          cardShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
          tagBg: '#3A241B',
          tagText: '#FF5A00',
        };
      }
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
