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
        bgMain: '#181A1D',
        bgCard: '#24272B',
        bgSub: '#1E2124',
        bgSubtle: '#1F2225',
        bgElevated: '#2E3237',
        bgHover: '#2D3136',
        border: '#374151',
        borderLight: '#2D3136',
        borderInput: '#374151',
        borderFocus: '#EA580C',
        textPrimary: '#F9FAFB',
        textSecondary: '#E5E7EB',
        textMuted: '#9CA3AF',
        textSubtle: '#6B7280',
        brandPrimary: '#EA580C',
        brandPrimaryDark: '#C2410C',
        brandLight: 'rgba(234, 88, 12, 0.18)',
        brandBorder: 'rgba(234, 88, 12, 0.42)',
        headerBg: '#24272B',
        headerBorder: '#374151',
        cardShadow: 'rgba(0, 0, 0, 0.65)',
        tagBg: 'rgba(234, 88, 12, 0.18)',
        tagText: '#EA580C',
      };
    }

    return {
      isDark: false,
      bgMain: '#F3F4F6',
      bgCard: '#FFFFFF',
      bgSub: '#F3F4F6',
      bgSubtle: '#F9FAFB',
      bgElevated: '#FFFFFF',
      bgHover: '#F3F4F6',
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
      borderInput: '#E5E7EB',
      borderFocus: '#EA580C',
      textPrimary: '#111827',
      textSecondary: '#374151',
      textMuted: '#6B7280',
      textSubtle: '#9CA3AF',
      brandPrimary: '#EA580C',
      brandPrimaryDark: '#C2410C',
      brandLight: '#FFF7ED',
      brandBorder: '#FED7AA',
      headerBg: '#24272B',
      headerBorder: '#E5E7EB',
      cardShadow: 'rgba(15, 23, 42, 0.06)',
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
