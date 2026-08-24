import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';

export default function FilterChips({
  filterSort,
  onSetFilterSort,
  onResetFilters,
}) {
  return (
    <View style={styles.filterChipsWrap}>
      <TouchableOpacity
        style={[
          styles.filterChip,
          filterSort !== 'all' && styles.filterChipActive,
          { flexDirection: 'row', alignItems: 'center', gap: 4 },
        ]}
        onPress={() => {
          onSetFilterSort((prev) => (prev === 'all' ? 'price-low' : 'all'));
        }}
      >
        <BootstrapIcon
          name="sliders"
          size={12}
          color={filterSort !== 'all' ? '#ffffff' : '#64748b'}
        />
        <Text
          style={[
            styles.filterChipText,
            filterSort !== 'all' && styles.filterChipTextActive,
          ]}
        >
          Filter
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.filterChip,
          filterSort === 'rating' && styles.filterChipActive,
        ]}
        onPress={() =>
          onSetFilterSort((prev) => (prev === 'rating' ? 'all' : 'rating'))
        }
      >
        <Text
          style={[
            styles.filterChipText,
            filterSort === 'rating' && styles.filterChipTextActive,
          ]}
        >
          Rating ⌵
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.filterChip,
          filterSort === 'price-low' && styles.filterChipActive,
        ]}
        onPress={() =>
          onSetFilterSort((prev) =>
            prev === 'price-low' ? 'price-high' : 'price-low'
          )
        }
      >
        <Text
          style={[
            styles.filterChipText,
            filterSort.startsWith('price') && styles.filterChipTextActive,
          ]}
        >
          Price ⌵
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.filterChip}
        onPress={onResetFilters}
      >
        <Text style={styles.filterChipText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}
