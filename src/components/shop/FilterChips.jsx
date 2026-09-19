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
import { CATEGORY_PILLS } from '../../data/motorParts';

const RATING_OPTIONS = [
  { id: 'all', label: 'All Ratings', desc: 'Show all catalog items', icon: 'grid-fill', color: '#0C6258', bgColor: '#ECFDF5', borderColor: '#A7F3D0' },
  { id: '5', label: '5.0 Stars Only', desc: 'Highest rated rider gear', icon: 'star-fill', color: '#B45309', bgColor: '#FEF3C7', borderColor: '#FDE68A' },
  { id: '4.5', label: '4.5 Stars & Above', desc: 'Top tier customer reviews', icon: 'star-half', color: '#B45309', bgColor: '#FEF3C7', borderColor: '#FDE68A' },
  { id: '4', label: '4.0 Stars & Above', desc: 'Popular community selections', icon: 'star-half', color: '#B45309', bgColor: '#FEF3C7', borderColor: '#FDE68A' },
  { id: 'sort-rating', label: 'Sort: Highest Rated', desc: 'Order products from 5.0 down', icon: 'sort-numeric-down-alt', color: '#4338CA', bgColor: '#E0E7FF', borderColor: '#C7D2FE' },
];

const PRICE_OPTIONS = [
  { id: 'all', label: 'All Prices', desc: 'Products of any price tier', icon: 'grid-fill', color: '#0C6258', bgColor: '#ECFDF5', borderColor: '#A7F3D0' },
  { id: 'price-low', label: 'Price: Low to High', desc: 'Most affordable items first', icon: 'sort-numeric-down', color: '#0284C7', bgColor: '#E0F2FE', borderColor: '#BAE6FD' },
  { id: 'price-high', label: 'Price: High to Low', desc: 'Premium performance items first', icon: 'sort-numeric-up-alt', color: '#0284C7', bgColor: '#E0F2FE', borderColor: '#BAE6FD' },
  { id: 'under-1000', label: 'Under ₱1,000', desc: 'Affordable maintenance, oils & parts', icon: 'cash', color: '#16A34A', bgColor: '#DCFCE7', borderColor: '#BBF7D0' },
  { id: '1000-5000', label: '₱1,000 - ₱5,000', desc: 'Mid-range accessories, chains & pads', icon: 'cash-stack', color: '#16A34A', bgColor: '#DCFCE7', borderColor: '#BBF7D0' },
  { id: 'above-5000', label: 'Above ₱5,000', desc: 'Exhausts, high-end shocks & helmets', icon: 'gem', color: '#7C3AED', bgColor: '#F3E8FF', borderColor: '#DDD6FE' },
];

export default function FilterChips({
  selectedCategory = 'All',
  onSelectCategory = () => {},
  productsList = [],
  filterSort = 'default',
  onSetFilterSort = () => {},
  ratingFilter = 'all',
  onSetRatingFilter = () => {},
  priceFilter = 'all',
  onSetPriceFilter = () => {},
  onResetFilters = () => {},
}) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

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

  const isCategoryActive = selectedCategory !== 'All';
  const isRatingActive = ratingFilter !== 'all';
  const isPriceActive = priceFilter !== 'all' || (filterSort && filterSort.startsWith('price'));
  const isAnyFilterActive = isCategoryActive || isRatingActive || isPriceActive;

  // Rating button display label
  const ratingChipLabel = useMemo(() => {
    if (ratingFilter === '5') return '★ 5.0 ⌵';
    if (ratingFilter === '4.5') return '★ 4.5+ ⌵';
    if (ratingFilter === '4') return '★ 4.0+ ⌵';
    if (ratingFilter === 'sort-rating') return '★ Top ⌵';
    return 'Rating ⌵';
  }, [ratingFilter]);

  // Price button display label
  const priceChipLabel = useMemo(() => {
    if (priceFilter === 'price-low') return '₱ Low ⌵';
    if (priceFilter === 'price-high') return '₱ High ⌵';
    if (priceFilter === 'under-1000') return '< ₱1k ⌵';
    if (priceFilter === '1000-5000') return '₱1k-5k ⌵';
    if (priceFilter === 'above-5000') return '> ₱5k ⌵';
    return 'Price ⌵';
  }, [priceFilter]);

  return (
    <>
      {/* ─── FILTER CHIPS ROW (PERFECTLY ALIGNED SINGLE ROW) ─── */}
      <View style={styles.filterChipsRow}>
        {/* 1. Category Dropdown Button */}
        <TouchableOpacity
          style={[styles.chipBtn, styles.categoryChip, isCategoryActive && styles.chipBtnActive]}
          onPress={() => setIsCategoryModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Category filter: currently ${activeCategoryObj.name}`}
        >
          <BootstrapIcon
            name={activeCategoryObj.biIcon || 'grid-fill'}
            size={11.5}
            color={isCategoryActive ? '#FFFFFF' : '#0C6258'}
          />
          <Text
            style={[styles.chipBtnText, isCategoryActive && styles.chipBtnTextActive]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isCategoryActive ? `${activeCategoryObj.name} ⌵` : 'Category ⌵'}
          </Text>
        </TouchableOpacity>

        {/* 2. Rating Dropdown Button */}
        <TouchableOpacity
          style={[styles.chipBtn, styles.ratingChip, isRatingActive && styles.chipBtnActive]}
          onPress={() => setIsRatingModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Rating dropdown filter"
        >
          <Text
            style={[styles.chipBtnText, isRatingActive && styles.chipBtnTextActive]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {ratingChipLabel}
          </Text>
        </TouchableOpacity>

        {/* 3. Price Dropdown Button */}
        <TouchableOpacity
          style={[styles.chipBtn, styles.priceChip, isPriceActive && styles.chipBtnActive]}
          onPress={() => setIsPriceModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Price dropdown filter"
        >
          <Text
            style={[styles.chipBtnText, isPriceActive && styles.chipBtnTextActive]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {priceChipLabel}
          </Text>
        </TouchableOpacity>

        {/* 4. Reset Dropdown Button */}
        <TouchableOpacity
          style={[styles.chipBtn, styles.resetChip, isAnyFilterActive && styles.resetChipActive]}
          onPress={() => setIsResetModalOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Reset filters dropdown"
        >
          <Text
            style={[styles.chipBtnText, isAnyFilterActive && styles.resetChipTextActive]}
            numberOfLines={1}
          >
            Reset ⌵
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── 1. CATEGORY SELECTION BOTTOM SHEET MODAL ─── */}
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
                <View style={chipModalStyles.sheetHeader}>
                  <View style={chipModalStyles.headerLeft}>
                    <View style={chipModalStyles.headerIconWrap}>
                      <BootstrapIcon name="grid-fill" size={16} color="#0C6258" />
                    </View>
                    <View>
                      <Text style={chipModalStyles.sheetTitle}>Select Category</Text>
                      <Text style={chipModalStyles.sheetSub}>
                        Filter by motorcycle part type ({allCategories.length} categories)
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
                        key={item.id}
                        style={[
                          chipModalStyles.optionRow,
                          isSelected && chipModalStyles.optionRowSelected,
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

      {/* ─── 2. RATING SELECTION BOTTOM SHEET MODAL ─── */}
      <Modal
        visible={isRatingModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRatingModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsRatingModalOpen(false)}>
          <View style={chipModalStyles.backdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={chipModalStyles.sheetCard}>
                <View style={chipModalStyles.sheetHeader}>
                  <View style={chipModalStyles.headerLeft}>
                    <View style={[chipModalStyles.headerIconWrap, { backgroundColor: '#FEF3C7' }]}>
                      <BootstrapIcon name="star-fill" size={16} color="#B45309" />
                    </View>
                    <View>
                      <Text style={chipModalStyles.sheetTitle}>Filter by Rating</Text>
                      <Text style={chipModalStyles.sheetSub}>
                        Show products matching customer ratings
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={chipModalStyles.closeBtn}
                    onPress={() => setIsRatingModalOpen(false)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={chipModalStyles.listContainer}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={{ paddingVertical: 6 }}
                >
                  {RATING_OPTIONS.map((opt) => {
                    const isSelected = ratingFilter === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          chipModalStyles.optionRow,
                          isSelected && chipModalStyles.optionRowSelected,
                        ]}
                        onPress={() => {
                          onSetRatingFilter(opt.id);
                          setIsRatingModalOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            chipModalStyles.itemIconWrap,
                            { backgroundColor: opt.bgColor, borderColor: opt.borderColor },
                            isSelected && { backgroundColor: '#0C6258', borderColor: '#0C6258' },
                          ]}
                        >
                          <BootstrapIcon
                            name={opt.icon}
                            size={14}
                            color={isSelected ? '#FFFFFF' : opt.color}
                          />
                        </View>
                        <View style={chipModalStyles.itemTextWrap}>
                          <Text
                            style={[
                              chipModalStyles.itemTitle,
                              isSelected && chipModalStyles.itemTitleSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text style={chipModalStyles.itemSubtitle}>{opt.desc}</Text>
                        </View>
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

                <View style={chipModalStyles.sheetFooter}>
                  {ratingFilter !== 'all' && (
                    <TouchableOpacity
                      style={chipModalStyles.resetFooterBtn}
                      onPress={() => {
                        onSetRatingFilter('all');
                        setIsRatingModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="arrow-counterclockwise" size={13} color="#0C6258" />
                      <Text style={chipModalStyles.resetFooterBtnText}>Reset Rating</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={chipModalStyles.doneFooterBtn}
                    onPress={() => setIsRatingModalOpen(false)}
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

      {/* ─── 3. PRICE SELECTION BOTTOM SHEET MODAL ─── */}
      <Modal
        visible={isPriceModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPriceModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPriceModalOpen(false)}>
          <View style={chipModalStyles.backdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={chipModalStyles.sheetCard}>
                <View style={chipModalStyles.sheetHeader}>
                  <View style={chipModalStyles.headerLeft}>
                    <View style={[chipModalStyles.headerIconWrap, { backgroundColor: '#E0F2FE' }]}>
                      <BootstrapIcon name="tag-fill" size={16} color="#0284C7" />
                    </View>
                    <View>
                      <Text style={chipModalStyles.sheetTitle}>Filter by Price</Text>
                      <Text style={chipModalStyles.sheetSub}>
                        Choose budget range or price sorting
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={chipModalStyles.closeBtn}
                    onPress={() => setIsPriceModalOpen(false)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={chipModalStyles.listContainer}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={{ paddingVertical: 6 }}
                >
                  {PRICE_OPTIONS.map((opt) => {
                    const isSelected = priceFilter === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          chipModalStyles.optionRow,
                          isSelected && chipModalStyles.optionRowSelected,
                        ]}
                        onPress={() => {
                          onSetPriceFilter(opt.id);
                          setIsPriceModalOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            chipModalStyles.itemIconWrap,
                            { backgroundColor: opt.bgColor, borderColor: opt.borderColor },
                            isSelected && { backgroundColor: '#0C6258', borderColor: '#0C6258' },
                          ]}
                        >
                          <BootstrapIcon
                            name={opt.icon}
                            size={14}
                            color={isSelected ? '#FFFFFF' : opt.color}
                          />
                        </View>
                        <View style={chipModalStyles.itemTextWrap}>
                          <Text
                            style={[
                              chipModalStyles.itemTitle,
                              isSelected && chipModalStyles.itemTitleSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text style={chipModalStyles.itemSubtitle}>{opt.desc}</Text>
                        </View>
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

                <View style={chipModalStyles.sheetFooter}>
                  {priceFilter !== 'all' && (
                    <TouchableOpacity
                      style={chipModalStyles.resetFooterBtn}
                      onPress={() => {
                        onSetPriceFilter('all');
                        setIsPriceModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="arrow-counterclockwise" size={13} color="#0C6258" />
                      <Text style={chipModalStyles.resetFooterBtnText}>Reset Price</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={chipModalStyles.doneFooterBtn}
                    onPress={() => setIsPriceModalOpen(false)}
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

      {/* ─── 4. RESET FILTERS BOTTOM SHEET MODAL ─── */}
      <Modal
        visible={isResetModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsResetModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsResetModalOpen(false)}>
          <View style={chipModalStyles.backdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={chipModalStyles.sheetCard}>
                <View style={chipModalStyles.sheetHeader}>
                  <View style={chipModalStyles.headerLeft}>
                    <View style={[chipModalStyles.headerIconWrap, { backgroundColor: '#F0FDFA' }]}>
                      <BootstrapIcon name="arrow-counterclockwise" size={16} color="#0C6258" />
                    </View>
                    <View>
                      <Text style={chipModalStyles.sheetTitle}>Reset Filters</Text>
                      <Text style={chipModalStyles.sheetSub}>
                        {isAnyFilterActive
                          ? 'Choose which filters you want to clear'
                          : 'No active filters are currently applied'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={chipModalStyles.closeBtn}
                    onPress={() => setIsResetModalOpen(false)}
                    activeOpacity={0.7}
                  >
                    <BootstrapIcon name="x-lg" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ marginVertical: 14 }}>
                  {/* Reset All Option */}
                  <TouchableOpacity
                    style={[chipModalStyles.optionRow, { borderColor: '#CCFBF1', backgroundColor: '#F0FDFA' }]}
                    onPress={() => {
                      onResetFilters();
                      setIsResetModalOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[chipModalStyles.itemIconWrap, { backgroundColor: '#0C6258' }]}>
                      <BootstrapIcon name="arrow-counterclockwise" size={14} color="#FFFFFF" />
                    </View>
                    <View style={chipModalStyles.itemTextWrap}>
                      <Text style={[chipModalStyles.itemTitle, { color: '#0C6258', fontWeight: '800' }]}>
                        Reset All Filters
                      </Text>
                      <Text style={chipModalStyles.itemSubtitle}>
                        Clear Category, Rating, Price and Search query
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Clear Category Only */}
                  {isCategoryActive && (
                    <TouchableOpacity
                      style={chipModalStyles.optionRow}
                      onPress={() => {
                        onSelectCategory('All');
                        setIsResetModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[chipModalStyles.itemIconWrap, { backgroundColor: '#E2E8F0' }]}>
                        <BootstrapIcon name="x-circle" size={14} color="#475569" />
                      </View>
                      <View style={chipModalStyles.itemTextWrap}>
                        <Text style={chipModalStyles.itemTitle}>Clear Category</Text>
                        <Text style={chipModalStyles.itemSubtitle}>
                          Currently set to: {activeCategoryObj.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Clear Rating Only */}
                  {isRatingActive && (
                    <TouchableOpacity
                      style={chipModalStyles.optionRow}
                      onPress={() => {
                        onSetRatingFilter('all');
                        setIsResetModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[chipModalStyles.itemIconWrap, { backgroundColor: '#FEF3C7' }]}>
                        <BootstrapIcon name="x-circle" size={14} color="#B45309" />
                      </View>
                      <View style={chipModalStyles.itemTextWrap}>
                        <Text style={chipModalStyles.itemTitle}>Clear Rating</Text>
                        <Text style={chipModalStyles.itemSubtitle}>
                          Currently set to: {ratingChipLabel.replace(' ⌵', '')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Clear Price Only */}
                  {isPriceActive && (
                    <TouchableOpacity
                      style={chipModalStyles.optionRow}
                      onPress={() => {
                        onSetPriceFilter('all');
                        setIsResetModalOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[chipModalStyles.itemIconWrap, { backgroundColor: '#E0F2FE' }]}>
                        <BootstrapIcon name="x-circle" size={14} color="#0284C7" />
                      </View>
                      <View style={chipModalStyles.itemTextWrap}>
                        <Text style={chipModalStyles.itemTitle}>Clear Price</Text>
                        <Text style={chipModalStyles.itemSubtitle}>
                          Currently set to: {priceChipLabel.replace(' ⌵', '')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={chipModalStyles.sheetFooter}>
                  <TouchableOpacity
                    style={[chipModalStyles.doneFooterBtn, { width: '100%' }]}
                    onPress={() => setIsResetModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={chipModalStyles.doneFooterBtnText}>Close</Text>
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

const styles = StyleSheet.create({
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
    gap: 6,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 35,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  categoryChip: {
    flex: 1.15,
    gap: 4,
  },
  ratingChip: {
    flex: 0.95,
  },
  priceChip: {
    flex: 0.95,
  },
  resetChip: {
    flex: 0.85,
  },
  chipBtnActive: {
    backgroundColor: '#0C6258',
    borderColor: '#0C6258',
  },
  chipBtnText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resetChipActive: {
    borderColor: '#0C6258',
    backgroundColor: '#F0FDFA',
  },
  resetChipTextActive: {
    color: '#0C6258',
    fontWeight: '700',
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
    backgroundColor: '#E7F5F3',
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
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E7F5F3',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
    fontWeight: '700',
    color: '#1E293B',
  },
  itemTitleSelected: {
    color: '#0C6258',
    fontWeight: '800',
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
    backgroundColor: '#DCFCE7',
  },
  itemCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  itemCountTextSelected: {
    color: '#15803D',
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
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  resetFooterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C6258',
  },
  doneFooterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneFooterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
