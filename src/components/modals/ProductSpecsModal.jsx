import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';

export default function ProductSpecsModal({
  visible,
  product,
  onClose,
  onAddToCart,
}) {
  if (!product) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Product Specifications</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <BootstrapIcon name="x-lg" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            <Image
              source={{ uri: product.image }}
              style={styles.specImageBanner}
            />

            <Text style={styles.specTitle}>{product.name}</Text>

            <View style={styles.specBrandRow}>
              <View style={styles.specBrandBadge}>
                <Text style={styles.specBrandText}>
                  {product.brand} • {product.category}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <BootstrapIcon name="star-fill" size={12} color="#F59E0B" />
                <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '800' }}>
                  {product.rating?.toFixed(1) || '5.0'} ({product.reviews || 0} reviews)
                </Text>
              </View>
            </View>

            <View style={styles.specPriceRow}>
              <Text style={styles.specPriceMain}>₱{product.price?.toFixed(2)}
              </Text>
              {product.oldPrice && (
                <Text style={styles.specPriceOld}>₱{product.oldPrice?.toFixed(2)}
                </Text>
              )}
            </View>

            <Text style={styles.specDescription}>
              {product.description}
            </Text>

            <Text style={[styles.formLabel, { marginTop: 6 }]}>
              Key Features:
            </Text>
            {product.features?.map((feat, idx) => (
              <View key={idx} style={styles.featureBullet}>
                <BootstrapIcon name="check2" size={14} color="#0C6258" />
                <Text style={styles.featureBulletText}>{feat}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.checkoutBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
            onPress={() => {
              onAddToCart?.(product);
              onClose?.();
            }}
            activeOpacity={0.9}
          >
            <BootstrapIcon name="bag-plus-fill" size={14} color="#ffffff" />
            <Text style={styles.checkoutBtnText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
