// =========================================================================
// MotoTrack Expandable Header Search Widget
// Circular icon button that expands smoothly into a translucent search input
// Placed directly before Wishlist across all customer pages
// =========================================================================

import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';

export default function HeaderSearchWidget({
  onSearch,
  searchQuery: controlledQuery,
  onSearchChange,
  isDark = true,
  placeholder = 'Search products, brands, categories...',
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [internalQuery, setInternalQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const isControlled = typeof onSearchChange === 'function';
  const query = isControlled ? (controlledQuery || '') : internalQuery;

  const setQuery = (val) => {
    if (isControlled) {
      onSearchChange(val);
    } else {
      setInternalQuery(val);
    }
  };

  const handleOpen = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    } else {
      searchInputRef.current?.focus();
    }
  };

  const handleClose = () => {
    setIsSearchOpen(false);
    setIsSearchFocused(false);
  };

  const handleSubmit = () => {
    if (query.trim() && typeof onSearch === 'function') {
      onSearch(query.trim());
    }
  };

  // Click-outside and Escape key handlers
  useEffect(() => {
    if (Platform.OS !== 'web' || !isSearchOpen) return;
    const handleClickOutside = (e) => {
      if (searchContainerRef.current) {
        const domNode = searchContainerRef.current;
        if (domNode.contains && !domNode.contains(e.target)) {
          if (!query.trim()) {
            handleClose();
          }
        }
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, query]);

  const targetWidth = windowWidth < 600 ? 170 : windowWidth < 1280 ? 220 : 280;

  return (
    <View
      ref={searchContainerRef}
      style={[
        styles.searchExpandContainer,
        {
          width: isSearchOpen ? targetWidth : 38,
          borderRadius: 8,
          backgroundColor: isSearchOpen
            ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.12)')
            : 'transparent',
          borderColor: isSearchOpen
            ? (isSearchFocused ? '#FF5A0A' : (isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.32)'))
            : 'transparent',
          boxShadow: isSearchOpen && isSearchFocused ? '0 0 0 1px #FF5A0A' : 'none',
        },
      ]}
    >
      <TouchableOpacity
        style={styles.searchExpandIconBtn}
        onPress={handleOpen}
        activeOpacity={0.8}
        title={isSearchOpen ? 'Search' : 'Search products'}
        accessibilityLabel="Search products"
      >
        <BootstrapIcon
          name="search"
          size={15}
          color={isSearchOpen && isSearchFocused ? '#FF5A0A' : '#FFFFFF'}
        />
        {!isSearchOpen && query.trim().length > 0 && (
          <View style={styles.searchActiveDot} />
        )}
      </TouchableOpacity>

      {isSearchOpen && (
        <TextInput
          ref={searchInputRef}
          style={styles.searchExpandInput}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          onSubmitEditing={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleClose();
            } else if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          returnKeyType="search"
        />
      )}

      {isSearchOpen && query.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            setQuery('');
            searchInputRef.current?.focus();
          }}
          style={{ padding: 4 }}
          activeOpacity={0.7}
          title="Clear search query"
        >
          <BootstrapIcon name="x-circle-fill" size={13} color="#94A3B8" />
        </TouchableOpacity>
      )}

      {isSearchOpen && (
        <TouchableOpacity
          onPress={handleClose}
          style={styles.searchExpandCloseBtn}
          activeOpacity={0.7}
          title="Close search"
          accessibilityLabel="Close search"
        >
          <BootstrapIcon name="x-lg" size={11} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchExpandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, border-radius 0.2s ease',
    flexShrink: 0,
    position: 'relative',
  },
  searchExpandIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 8,
    cursor: 'pointer',
  },
  searchExpandInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    outlineStyle: 'none',
    paddingVertical: 0,
    paddingHorizontal: 4,
    minWidth: 80,
  },
  searchExpandCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    cursor: 'pointer',
  },
  searchActiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF5A0A',
  },
});

