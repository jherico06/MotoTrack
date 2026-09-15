import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { shopStyles as styles } from '../../styles/shop.styles';
import { useCart } from '../../context/CartContext';

export default function FloatingCartBar({ onOpenCart }) {
  const { cart, cartItemCount, cartTotal } = useCart();

  if (cart.length === 0) return null;

  return (
    <View style={styles.floatingCartBarWrapper} pointerEvents="box-none">
      <TouchableOpacity style={styles.floatingCartBar} onPress={onOpenCart} activeOpacity={0.9}>
        <View style={styles.floatingCartLeft}>
          <Text style={styles.floatingCartText}>View your cart</Text>
          <View style={styles.floatingCartQtyPill}>
            <Text style={styles.floatingCartQtyText}>{cartItemCount}x</Text>
          </View>
        </View>
        <Text style={styles.floatingCartTotalText}>₱{cartTotal.toFixed(2)}</Text>
      </TouchableOpacity>
    </View>
  );
}
