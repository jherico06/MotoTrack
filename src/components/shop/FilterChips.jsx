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
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { CATEGORY_PILLS } from '../../data/motorParts';

export default function FilterChips({
  selectedCategory = 'All',
  onSelectCategory = () => {},
  productsList = [],
  filterSort,
  onSetFilterSort,
  onResetFilters,
}) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Compute category counts
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

  // Find active category item
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

  return (
    <>
      <View style={styles.filterChipsWrap}>
        {/* 1. Category Dropdown Chip */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedCategory !== 'All' && styles.filterChipActive,
            { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 },
          ]}
          onPress={() => setIsCategoryModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Category filter: currently ${activeCategoryObj.name}`}
        >
          <BootstrapIcon
            name={activeCategoryObj.biIcon || 'grid-fill'}
            size={12}
            color={selectedCategory !== 'All' ? '#FFFFFF' : '#0C6258'}
          />
          <Text
            style={[
              styles.filterChipText,
              selectedCategory !== 'All' && styles.filterChipTextActive,
              { fontWeight: selectedCategory !== 'All' ? '800' : '600' },
            ]}
            numberOfLines={1}
          >
            {selectedCategory === 'All' ? 'Category ⌵' : `${activeCategoryObj.name} ⌵`}
          </Text>
        </TouchableOpacity>

        {/* 2. Rating Sort Chip */}
        <TouchableOpacity
          style={[styles.filterChip, filterSort === 'rating' && styles.filterChipActive]}
          onPress={() => onSetFilterSort((prev) => (prev === 'rating' ? 'all' : 'rating'))}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterChipText, filterSort === 'rating' && styles.filterChipTextActive]}>
            Rating ⌵
          </Text>
        </TouchableOpacity>

        {/* 3. Price Sort Chip */}
        <TouchableOpacity
          style={[styles.filterChip, filterSort.startsWith('price') && styles.filterChipActive]}
          onPress={() => onSetFilterSort((prev) => (prev === 'price-low' ? 'price-high' : 'price-low'))}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterChipText, filterSort.startsWith('price') && styles.filterChipTextActive]}>
            {filterSort === 'price-high' ? 'Price: High ⌵' : 'Price ⌵'}
          </Text>
        </TouchableOpacity>

        {/* 4. Reset Filters Chip */}
        <TouchableOpacity style={styles.filterChip} onPress={onResetFilters} activeOpacity={0.8}>
          <Text style={styles.filterChipText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* ─── CATEGORY SELECTION BOTTOM SHEET MODAL ─── */}
      <Modal
        visible={isCategoryModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsCategoryModalOpen(false)}>
          <View style={chipModalStyles.backdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={chipModalStyles.sheetCard}>
                {/* Modal Header */}
                <View style={chipModalStyles.sheetHeader}>
                  <View style={chipModalStyles.headerLeft}>
                    <View style={chipModalStyles.headerIconWrap}>
                      <BootstrapIcon name="grid-fill" size={16} color="#0C6258" />
                    </View>
                    <View>
                      <Text style={chipModalStyles.sheetTitle}>Select Category</Text>
                      <Text style={chipModalStyles.sheetSub}>
                        Filter products by type ({allCategories.length} categories)
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={chipModalStyles.closeBtn}
                    onPress={() => setIsCategoryModalOpen(false)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Categories List */}
                <ScrollView
                  style={chipModalStyles.categoryList}
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
                        key={item.id}
                        style={[
                          chipModalStyles.categoryRow,
                          isSelected && chipModalStyles.categoryRowSelected,
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
                          ]}
                        >
                          <BootstrapIcon
                            name={item.biIcon || 'grid-fill'}
                            size={14}
                            color={isSelected ? '#FFFFFF' : '#0C6258'}
                          />
                        </View>
                        <View style={chipModalStyles.itemTextWrap}>
                          <Text
                            style={[
                              chipModalStyles.itemTitle,
                              isSelected && chipModalStyles.itemTitleSelected,
                            ]}
                          >
                            {item.name}
                          </Text>
                        </View>
                        {count > 0 && (
                          <View
                            style={[
                              chipModalStyles.itemCountPill,
                              isSelected && chipModalStyles.itemCountPillSelected,
                            ]}
                          >
                            <Text
                              style={[
                                chipModalStyles.itemCountText,
                                isSelected && chipModalStyles.itemCountTextSelected,
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
                            color="#0C6258"
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Modal Footer */}
                <View style={chipModalStyles.sheetFooter}>
                  {selectedCategory !== 'All' && (
                    <TouchableOpacity
                      style={chipModalStyles.resetFooterBtn}
                      onPress={() => {
                        onSelectCategory('All');
                        setIsCategoryModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="arrow-counterclockwise" size={13} color="#0C6258" />
                      <Text style={chipModalStyles.resetFooterBtnText}>Reset to All</Text>
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
    </>
  );
}

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
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
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
  categoryList: {
    marginVertical: 8,
  },
  categoryRow: {
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
  categoryRowSelected: {
    backgroundColor: '#E6F4F1',
    borderColor: '#0C6258',
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemIconWrapSelected: {
    backgroundColor: '#0C6258',
    borderColor: '#0C6258',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  itemTitleSelected: {
    color: '#0C6258',
    fontWeight: '800',
  },
  itemCountPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  itemCountPillSelected: {
    backgroundColor: '#0C6258',
  },
  itemCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  itemCountTextSelected: {
    color: '#FFFFFF',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  resetFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#E6F4F1',
  },
  resetFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C6258',
  },
  doneFooterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0C6258',
  },
  doneFooterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
