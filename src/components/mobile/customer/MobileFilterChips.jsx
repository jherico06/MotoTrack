import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CATEGORY_PILLS } from '../../../data/motorParts.js';
import { DB_SEEDED_CATEGORIES, resolveCategoryIcon } from '../../../services/products/categoryService.js';
import { useTheme } from '../../../context/ThemeContext.jsx';

const CATEGORY_STRIP_ORDER = [
  'accessories',
  'brakes',
  'drivetrain',
  'engine',
  'exhaust',
  'maintenance',
  'suspension',
  'tires',
];

function MobileStripCategoryIcon({ name, isMore = false, color = '#475569', size = 21 }) {
  if (isMore) {
    return <Ionicons name="grid-outline" size={size - 1} color={color} />;
  }
  const norm = String(name || '').trim().toLowerCase();

  if (norm.includes('access') || norm.includes('bag') || norm.includes('gear')) {
    return <Ionicons name="bag-outline" size={size} color={color} />;
  }
  if (norm.includes('brake') || norm.includes('rotor') || norm.includes('caliper') || norm.includes('pad')) {
    return <Ionicons name="disc-outline" size={size} color={color} />;
  }
  if (norm.includes('drivetrain') || norm.includes('chain') || norm.includes('sprocket')) {
    return <MaterialCommunityIcons name="cog-outline" size={size + 1} color={color} />;
  }
  if (norm.includes('engine') || norm.includes('motor') || norm.includes('cylinder') || norm.includes('piston')) {
    return <MaterialCommunityIcons name="engine-outline" size={size + 1} color={color} />;
  }
  if (norm.includes('exhaust') || norm.includes('pipe') || norm.includes('muffler')) {
    return <Ionicons name="flame-outline" size={size} color={color} />;
  }
  if (norm.includes('maintenance') || norm.includes('oil') || norm.includes('service') || norm.includes('lubricant')) {
    return <MaterialCommunityIcons name="wrench-outline" size={size} color={color} />;
  }
  if (norm.includes('suspension') || norm.includes('shock') || norm.includes('fork') || norm.includes('damper')) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 1 }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, borderWidth: 1.5, borderColor: color }} />
        <View style={{ width: 9, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 8, height: 1.6, backgroundColor: color, transform: [{ rotate: '-20deg' }] }} />
        <View style={{ width: 8, height: 1.6, backgroundColor: color, transform: [{ rotate: '20deg' }] }} />
        <View style={{ width: 8, height: 1.6, backgroundColor: color, transform: [{ rotate: '-20deg' }] }} />
        <View style={{ width: 9, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, borderWidth: 1.5, borderColor: color }} />
      </View>
    );
  }
  if (norm.includes('tire') || norm.includes('wheel') || norm.includes('rim')) {
    return <MaterialCommunityIcons name="tire" size={size + 1} color={color} />;
  }
  return <Ionicons name="grid-outline" size={size - 1} color={color} />;
}

export default function MobileFilterChips({
  selectedCategory = 'All',
  onSelectCategory = () => {},
  productsList = [],
  categoriesList = [],
  activeBike = null,
  onOpenBikeModal = () => {},
  compatOnly = false,
  onToggleCompatOnly = () => {},
}) {
  const { isDarkMode = false } = useTheme?.() || {};
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

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

  // Merge admin-managed categories from categoryService, predefined CATEGORY_PILLS, and product categories
  const allCategories = useMemo(() => {
    const definedList = [];
    const seen = new Set();

    const addEntry = (catName, customIcon) => {
      const name = String(catName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      definedList.push({
        id: `cat-${key.replace(/\s+/g, '-')}`,
        name: key === 'all' ? 'All Parts' : name,
        category: key === 'all' ? 'All' : name,
        biIcon: key === 'all' ? 'grid-fill' : resolveCategoryIcon(name, customIcon),
      });
    };

    addEntry('All', 'grid-fill');

    if (Array.isArray(categoriesList)) {
      categoriesList.forEach((c) => {
        if (c?.name) addEntry(c.name, c.icon);
      });
    }

    if (Array.isArray(CATEGORY_PILLS)) {
      CATEGORY_PILLS.forEach((c) => {
        if (c?.category) addEntry(c.category, c.biIcon);
      });
    }

    if (Array.isArray(productsList)) {
      productsList.forEach((p) => {
        if (p?.category) addEntry(p.category);
      });
    }

    return definedList;
  }, [categoriesList, productsList]);

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
        biIcon: resolveCategoryIcon(selectedCategory),
      }
    );
  }, [allCategories, selectedCategory]);

  const isCategoryActive = selectedCategory !== 'All';

  const stripCategories = useMemo(() => {
    const sourceList =
      Array.isArray(categoriesList) && categoriesList.length > 0
        ? categoriesList
        : DB_SEEDED_CATEGORIES;

    const seen = new Set();
    const sorted = [...sourceList]
      .filter((c) => {
        const key = String(c?.name || '').trim().toLowerCase();
        if (!key || key === 'all' || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const idxA = CATEGORY_STRIP_ORDER.indexOf(String(a?.name || '').trim().toLowerCase());
        const idxB = CATEGORY_STRIP_ORDER.indexOf(String(b?.name || '').trim().toLowerCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return String(a?.name || '').localeCompare(String(b?.name || ''));
      })
      .map((cat) => ({
        id: cat.category_id || cat.id || cat.name,
        name: cat.name,
        isMore: false,
      }));

    return [
      ...sorted,
      {
        id: 'category-strip-more',
        name: 'More',
        isMore: true,
      },
    ];
  }, [categoriesList]);

  return (
    <>
      <View style={styles.filterChipsRow}>
        {/* 1. Category Dropdown Button */}
        <TouchableOpacity
          style={[
            styles.chipBtn,
            isCategoryActive && styles.chipBtnActive,
            !isCategoryActive && isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' },
          ]}
          onPress={() => setIsCategoryModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Category filter: currently ${activeCategoryObj.name}`}
        >
          <BootstrapIcon
            name={activeCategoryObj.biIcon || 'grid-fill'}
            size={11}
            color={isCategoryActive ? '#FFFFFF' : '#EA580C'}
          />
          <Text
            style={[
              styles.chipBtnText,
              isCategoryActive && styles.chipBtnTextActive,
              !isCategoryActive && isDarkMode && { color: '#E2E8F0' },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isCategoryActive ? `${activeCategoryObj.name} ⌵` : 'Category ⌵'}
          </Text>
        </TouchableOpacity>

        {/* 2. Motorcycle Selector Button */}
        <TouchableOpacity
          style={[
            styles.chipBtn,
            Boolean(activeBike) && styles.chipBtnBikeActive,
            !activeBike && isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' },
          ]}
          onPress={onOpenBikeModal}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Select Motorcycle"
        >
          <BootstrapIcon
            name="scooter"
            size={12}
            color={activeBike ? '#EA580C' : isDarkMode ? '#94A3B8' : '#64748B'}
          />
          <Text
            style={[
              styles.chipBtnText,
              Boolean(activeBike) && styles.chipBtnBikeTextActive,
              !activeBike && isDarkMode && { color: '#E2E8F0' },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {activeBike ? `${activeBike.brand} ${activeBike.model} ⌵` : 'My Motorcycle ⌵'}
          </Text>
        </TouchableOpacity>

        {/* 3. Compatible Only Filter Button */}
        <TouchableOpacity
          style={[
            styles.chipBtn,
            compatOnly && styles.chipBtnActive,
            !compatOnly && isDarkMode && { backgroundColor: '#1C1F23', borderColor: '#2B3035' },
          ]}
          onPress={onToggleCompatOnly}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Compatible parts only filter"
        >
          <BootstrapIcon
            name={compatOnly ? 'check-circle-fill' : 'shield-check'}
            size={11}
            color={compatOnly ? '#FFFFFF' : activeBike ? '#EA580C' : isDarkMode ? '#94A3B8' : '#64748B'}
          />
          <Text
            style={[
              styles.chipBtnText,
              compatOnly && styles.chipBtnTextActive,
              Boolean(activeBike && !compatOnly) && { color: isDarkMode ? '#CBD5E1' : '#334155' },
              !compatOnly && isDarkMode && { color: '#E2E8F0' },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Compatible Only
          </Text>
        </TouchableOpacity>
      </View>

      {/* Frameless Horizontal Category Strip matching Web */}
      <View
        style={[
          styles.categoryStripWrap,
          isDarkMode && { borderBottomColor: '#2B3035' },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryStripScrollContent}
        >
          {stripCategories.map((cat) => {
            const isActive =
              !cat.isMore &&
              selectedCategory.toLowerCase() === String(cat.name || '').toLowerCase();
            const itemColor = isActive
              ? '#EA580C'
              : isDarkMode
                ? '#A1A1AA'
                : '#475569';

            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryStripItem}
                onPress={() => {
                  if (cat.isMore) {
                    setIsCategoryModalOpen(true);
                  } else if (isActive) {
                    onSelectCategory('All');
                  } else {
                    onSelectCategory(cat.name);
                  }
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={cat.isMore ? 'More categories' : `Filter by ${cat.name}`}
              >
                <View style={styles.categoryStripIconWrap}>
                  <MobileStripCategoryIcon
                    name={cat.name}
                    isMore={cat.isMore}
                    color={itemColor}
                    size={21}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryStripLabel,
                    { color: itemColor },
                    isActive && styles.categoryStripLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
                <View
                  style={[
                    styles.categoryStripIndicator,
                    { backgroundColor: isActive ? '#EA580C' : 'transparent' },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Category Selection Sheet */}
      {isCategoryModalOpen && (
      <Modal
        visible={isCategoryModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsCategoryModalOpen(false)}>
          <View style={chipModalStyles.backdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation?.()}>
              <View style={[chipModalStyles.sheetCard, isDarkMode && { backgroundColor: '#1C1F23' }]}>
                <View style={[chipModalStyles.sheetHeader, isDarkMode && { borderBottomColor: '#2B3035' }]}>
                  <View style={chipModalStyles.headerLeft}>
                    <View style={[chipModalStyles.headerIconWrap, isDarkMode && { backgroundColor: '#2B1A0A', borderColor: '#43230A' }]}>
                      <BootstrapIcon name="grid-fill" size={16} color="#EA580C" />
                    </View>
                    <View>
                      <Text style={[chipModalStyles.sheetTitle, isDarkMode && { color: '#F9FAFB' }]}>Select Category</Text>
                      <Text style={[chipModalStyles.sheetSub, isDarkMode && { color: '#94A3B8' }]}>
                        Filter by motorcycle part type ({allCategories.length} categories)
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[chipModalStyles.closeBtn, isDarkMode && { backgroundColor: '#23272B' }]}
                    onPress={() => setIsCategoryModalOpen(false)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={chipModalStyles.listContainer}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={{ paddingVertical: 6 }}
                >
                  {allCategories.map((item) => {
                    const isSelected =
                      (item.category === 'All' && selectedCategory === 'All') ||
                      (item.category !== 'All' &&
                        selectedCategory.toLowerCase() === item.category.toLowerCase());
                    const count =
                      categoryCounts[item.category] ??
                      (item.category === 'All' ? productsList.length : 0);

                    return (
                      <TouchableOpacity
                        key={item.id || item.category}
                        style={[
                          chipModalStyles.optionRow,
                          isSelected && chipModalStyles.optionRowSelected,
                          !isSelected && isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' },
                        ]}
                        onPress={() => {
                          onSelectCategory(item.category);
                          setIsCategoryModalOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            chipModalStyles.itemIconWrap,
                            isSelected && chipModalStyles.itemIconWrapSelected,
                            !isSelected && isDarkMode && { backgroundColor: '#1C1F23' },
                          ]}
                        >
                          <BootstrapIcon
                            name={item.biIcon || 'grid-fill'}
                            size={14}
                            color={isSelected ? '#FFFFFF' : '#EA580C'}
                          />
                        </View>
                        <View style={chipModalStyles.itemTextWrap}>
                          <Text
                            style={[
                              chipModalStyles.itemTitle,
                              isSelected && chipModalStyles.itemTitleSelected,
                              !isSelected && isDarkMode && { color: '#F9FAFB' },
                            ]}
                          >
                            {item.name || item.category}
                          </Text>
                          <Text style={[chipModalStyles.itemSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                            {item.category === 'All'
                              ? 'Browse full store collection'
                              : `Explore ${item.name || item.category} products`}
                          </Text>
                        </View>
                        {count > 0 && (
                          <View
                            style={[
                              chipModalStyles.itemCountPill,
                              isSelected && chipModalStyles.itemCountPillSelected,
                              !isSelected && isDarkMode && { backgroundColor: '#33383F' },
                            ]}
                          >
                            <Text
                              style={[
                                chipModalStyles.itemCountText,
                                isSelected && chipModalStyles.itemCountTextSelected,
                                !isSelected && isDarkMode && { color: '#CBD5E1' },
                              ]}
                            >
                              {count} {count === 1 ? 'item' : 'items'}
                            </Text>
                          </View>
                        )}
                        {isSelected && (
                          <BootstrapIcon
                            name="check-circle-fill"
                            size={16}
                            color="#EA580C"
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[chipModalStyles.sheetFooter, isDarkMode && { borderTopColor: '#2B3035' }]}>
                  {selectedCategory !== 'All' && (
                    <TouchableOpacity
                      style={[chipModalStyles.resetFooterBtn, isDarkMode && { backgroundColor: '#23272B', borderColor: '#2B3035' }]}
                      onPress={() => {
                        onSelectCategory('All');
                        setIsCategoryModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="arrow-counterclockwise" size={13} color="#EA580C" />
                      <Text style={[chipModalStyles.resetFooterBtnText, isDarkMode && { color: '#E2E8F0' }]}>Reset to All</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={chipModalStyles.doneFooterBtn}
                    onPress={() => setIsCategoryModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={chipModalStyles.doneFooterBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 8,
    gap: 6,
  },
  chipBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 4,
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  chipBtnActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  chipBtnText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    flexShrink: 1,
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipBtnBikeActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  chipBtnBikeTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  categoryStripWrap: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginTop: 2,
    marginBottom: 8,
  },
  categoryStripScrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 16,
    alignItems: 'center',
  },
  categoryStripItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 2,
    minWidth: 64,
  },
  categoryStripIconWrap: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  categoryStripLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  categoryStripLabelActive: {
    fontWeight: '700',
  },
  categoryStripIndicator: {
    marginTop: 6,
    width: 22,
    height: 2,
    borderRadius: 1,
  },
});

const chipModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  sheetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    marginVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionRowSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemIconWrapSelected: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemTitleSelected: {
    color: '#EA580C',
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  itemCountPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  itemCountPillSelected: {
    backgroundColor: '#FFF7ED',
  },
  itemCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  itemCountTextSelected: {
    color: '#EA580C',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  resetFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resetFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#24272B',
  },
  doneFooterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
