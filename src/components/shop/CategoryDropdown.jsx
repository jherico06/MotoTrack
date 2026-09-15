import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { CATEGORY_PILLS } from '../../data/motorParts';

export default function CategoryDropdown({
  selectedCategory = 'All',
  onSelectCategory = () => {},
  productsList = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');

  // Pre-calculate count of products per category
  const categoryCounts = useMemo(() => {
    const counts = { All: productsList?.length || 0 };
    if (Array.isArray(productsList)) {
      productsList.forEach((p) => {
        if (p?.category) {
          counts[p.category] = (counts[p.category] || 0) + 1;
        }
      });
    }
    return counts;
  }, [productsList]);

  // Merge predefined categories with any dynamic categories found in productsList
  const allCategories = useMemo(() => {
    const definedList = Array.isArray(CATEGORY_PILLS) ? [...CATEGORY_PILLS] : [];
    const definedNames = new Set(definedList.map((c) => c.category.toLowerCase()));

    if (Array.isArray(productsList)) {
      productsList.forEach((p) => {
        if (p?.category && !definedNames.has(p.category.toLowerCase())) {
          definedNames.add(p.category.toLowerCase());
          definedList.push({
            id: `cat-${p.category.toLowerCase().replace(/\s+/g, '-')}`,
            name: p.category,
            category: p.category,
            biIcon: 'tag-fill',
          });
        }
      });
    }
    return definedList;
  }, [productsList]);

  // Find active category item metadata
  const activeCategoryObj = useMemo(() => {
    const found = allCategories.find(
      (c) =>
        (selectedCategory === 'All' && c.category === 'All') ||
        (selectedCategory !== 'All' && c.category.toLowerCase() === selectedCategory.toLowerCase())
    );
    return (
      found || {
        id: 'custom',
        name: selectedCategory,
        category: selectedCategory,
        biIcon: 'grid-fill',
      }
    );
  }, [allCategories, selectedCategory]);

  // Filtered categories for the dropdown search
  const displayedCategories = useMemo(() => {
    if (!filterText.trim()) return allCategories;
    const q = filterText.toLowerCase().trim();
    return allCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [allCategories, filterText]);

  const handleSelect = (category) => {
    onSelectCategory(category);
    setIsOpen(false);
    setFilterText('');
  };

  const totalCurrentCount = categoryCounts[activeCategoryObj.category] ?? (selectedCategory === 'All' ? productsList.length : 0);

  return (
    <View style={styles.dropdownContainer}>
      {/* ─── DROPDOWN TRIGGER BUTTON ─── */}
      <TouchableOpacity
        style={[styles.triggerButton, isOpen && styles.triggerButtonOpen]}
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Category filter: ${activeCategoryObj.name}`}
      >
        <View style={styles.triggerLeft}>
          <View style={[styles.triggerIconWrap, isOpen && styles.triggerIconWrapOpen]}>
            <BootstrapIcon
              name={activeCategoryObj.biIcon || 'grid-fill'}
              size={16}
              color={isOpen ? '#FFFFFF' : '#0C6258'}
            />
          </View>
          <View style={styles.triggerTextColumn}>
            <Text style={styles.triggerSubLabel}>Browse Category</Text>
            <View style={styles.triggerTitleRow}>
              <Text style={styles.triggerMainTitle} numberOfLines={1}>
                {activeCategoryObj.name}
              </Text>
              {selectedCategory !== 'All' && (
                <View style={styles.activeDot} />
              )}
            </View>
          </View>
        </View>

        <View style={styles.triggerRight}>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {totalCurrentCount} {totalCurrentCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <View style={[styles.chevronWrap, isOpen && styles.chevronWrapOpen]}>
            <BootstrapIcon
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={isOpen ? '#0C6258' : '#64748B'}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* ─── EXPANDABLE DROPDOWN MENU ─── */}
      {isOpen && (
        <View style={styles.menuCard}>
          {/* Quick Search inside Dropdown */}
          <View style={styles.searchRow}>
            <BootstrapIcon name="search" size={13} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor="#94A3B8"
              value={filterText}
              onChangeText={setFilterText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {filterText.length > 0 && (
              <TouchableOpacity onPress={() => setFilterText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick All / Reset Bar */}
          <View style={styles.menuSubHeader}>
            <Text style={styles.menuSubHeaderText}>
              {displayedCategories.length} {displayedCategories.length === 1 ? 'Category' : 'Categories'}
            </Text>
            {selectedCategory !== 'All' && (
              <TouchableOpacity
                onPress={() => handleSelect('All')}
                style={styles.resetLinkBtn}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="arrow-counterclockwise" size={11} color="#0C6258" />
                <Text style={styles.resetLinkText}>Reset to All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Categories Grid List */}
          <ScrollView
            style={styles.optionsScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.categoryGrid}>
              {displayedCategories.map((item) => {
                const isSelected =
                  (item.category === 'All' && selectedCategory === 'All') ||
                  (item.category !== 'All' && selectedCategory.toLowerCase() === item.category.toLowerCase());
                const count = categoryCounts[item.category] ?? (item.category === 'All' ? productsList.length : 0);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.categoryOption, isSelected && styles.categoryOptionActive]}
                    onPress={() => handleSelect(item.category)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconBox, isSelected && styles.optionIconBoxActive]}>
                      <BootstrapIcon
                        name={item.biIcon || 'grid-fill'}
                        size={13}
                        color={isSelected ? '#FFFFFF' : '#0C6258'}
                      />
                    </View>
                    <Text
                      style={[styles.optionLabel, isSelected && styles.optionLabelActive]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.optionCountBadge, isSelected && styles.optionCountBadgeActive]}>
                        <Text style={[styles.optionCountText, isSelected && styles.optionCountTextActive]}>
                          {count}
                        </Text>
                      </View>
                    )}
                    {isSelected && (
                      <BootstrapIcon name="check2" size={14} color="#0C6258" style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {displayedCategories.length === 0 && (
              <View style={styles.emptyState}>
                <BootstrapIcon name="search" size={20} color="#94A3B8" />
                <Text style={styles.emptyStateText}>No category found matching "{filterText}"</Text>
                <TouchableOpacity style={styles.emptyResetBtn} onPress={() => setFilterText('')}>
                  <Text style={styles.emptyResetBtnText}>Clear Search</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Dropdown Footer */}
          <View style={styles.menuFooter}>
            <TouchableOpacity
              style={styles.closeMenuBtn}
              onPress={() => setIsOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeMenuBtnText}>Close Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    marginBottom: 14,
    width: '100%',
    zIndex: 50,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  triggerButtonOpen: {
    borderColor: '#0C6258',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0C6258',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  triggerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerIconWrapOpen: {
    backgroundColor: '#0C6258',
  },
  triggerTextColumn: {
    flex: 1,
  },
  triggerSubLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  triggerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerMainTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0C6258',
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chevronWrapOpen: {
    backgroundColor: '#E6F4F1',
    borderColor: '#A7F3D0',
  },
  menuCard: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    paddingVertical: 2,
    marginLeft: 6,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  menuSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  menuSubHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0C6258',
  },
  optionsScroll: {
    maxHeight: 280,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryOption: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryOptionActive: {
    backgroundColor: '#E6F4F1',
    borderColor: '#0C6258',
  },
  optionIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconBoxActive: {
    backgroundColor: '#0C6258',
  },
  optionLabel: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  optionLabelActive: {
    color: '#0C6258',
    fontWeight: '800',
  },
  optionCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  optionCountBadgeActive: {
    backgroundColor: '#0C6258',
  },
  optionCountText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  optionCountTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C6258',
  },
  menuFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  closeMenuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  closeMenuBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
});
