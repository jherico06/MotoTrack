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
        bgMain: '#0F1412',
        bgCard: '#151C19',
        bgSub: '#1A2320',
        bgSubtle: '#18201D',
        bgElevated: '#1C2622',
        bgHover: '#1E2824',
        border: '#26332E',
        borderLight: '#1F2A26',
        borderInput: '#2F3F39',
        borderFocus: '#4DB896',
        textPrimary: '#F5F7F6',
        textSecondary: '#E3E8E6',
        textMuted: '#AAB4B0',
        textSubtle: '#8A9591',
        brandPrimary: '#4DB896',
        brandPrimaryDark: '#2A8F6E',
        brandLight: 'rgba(77, 184, 150, 0.15)',
        brandBorder: 'rgba(77, 184, 150, 0.38)',
        headerBg: '#151C19',
        headerBorder: '#26332E',
        cardShadow: 'rgba(0, 0, 0, 0.45)',
        tagBg: 'rgba(77, 184, 150, 0.16)',
        tagText: '#4DB896',
      };
    }

    return {
      isDark: false,
      bgMain: '#F1F5F9',
      bgCard: '#FFFFFF',
      bgSub: '#F8FAFC',
      bgSubtle: '#F1F5F9',
      bgElevated: '#FFFFFF',
      bgHover: '#F1F5F9',
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      borderInput: '#CBD5E1',
      borderFocus: '#1D4533',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      textSubtle: '#94A3B8',
      brandPrimary: '#1D4533',
      brandPrimaryDark: '#143325',
      brandLight: '#E8F0EC',
      brandBorder: '#C8DDD3',
      headerBg: '#1D4533',
      headerBorder: 'rgba(255, 255, 255, 0.10)',
      cardShadow: 'rgba(15, 23, 42, 0.06)',
      tagBg: '#E8F0EC',
      tagText: '#1D4533',
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
        bgMain: '#F1F5F9',
        bgCard: '#FFFFFF',
        bgSub: '#F8FAFC',
        border: '#E2E8F0',
        textPrimary: '#0F172A',
        textMuted: '#64748B',
        brandPrimary: '#1D4533',
      },
    };
  }
  return context;
}
