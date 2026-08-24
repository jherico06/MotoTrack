import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { CATEGORY_PILLS } from '../../data/motorParts';

export default function CategoryPills({ selectedCategory, onSelectCategory }) {
  const pills = Array.isArray(CATEGORY_PILLS) ? CATEGORY_PILLS : [];

  return (
    <View style={styles.categoryPillsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryPillScroll}
      >
        {pills.map((pill) => {
          const isActive =
            (pill.category === 'All' && selectedCategory === 'All') ||
            (pill.category !== 'All' &&
              selectedCategory.toLowerCase() === pill.category.toLowerCase());
          return (
            <TouchableOpacity
              key={pill.id}
              style={[
                styles.categoryPill,
                isActive && styles.categoryPillActive,
                { flexDirection: 'row', alignItems: 'center', gap: 6 },
              ]}
              onPress={() => onSelectCategory(pill.category)}
              activeOpacity={0.85}
            >
              <BootstrapIcon
                name={pill.biIcon || 'grid-fill'}
                size={13}
                color={isActive ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive,
                ]}
              >
                {pill.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
