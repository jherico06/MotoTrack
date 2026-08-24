import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';

export default function HeroBanner({ onSelectCategory, showToast }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <View style={styles.heroBannerWrap}>
      <View
        style={[
          styles.heroBannerCard,
          isDesktop && styles.heroBannerCardDesktop,
        ]}
      >
        <View style={styles.heroBannerBgShape} />
        <View style={styles.heroBannerLeft}>
          <Text
            style={[
              styles.heroBannerHeading,
              isDesktop && styles.heroBannerHeadingDesktop,
            ]}
          >
            Upgrade Your Ride: Up to 30% OFF Pro Motorcycle Parts!
          </Text>
          <Text style={styles.heroBannerSub}>
            Akrapovič, Brembo, Öhlins & FIM-Approved Helmets. Free express shipping over ₱150.
          </Text>
          <TouchableOpacity
            style={[styles.heroShopBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
            onPress={() => {
              onSelectCategory?.('Exhaust');
              showToast?.('Viewing Titanium Racing Exhaust collection!');
            }}
            activeOpacity={0.9}
          >
            <BootstrapIcon name="bag-check-fill" size={13} color="#0f172a" />
            <Text style={styles.heroShopBtnText}>Shop Exhausts</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroBannerRight}>
          <Image
            source={{
              uri:
                'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
            }}
            style={[
              styles.heroProductImg,
              isDesktop && styles.heroProductImgDesktop,
            ]}
          />
        </View>
      </View>

      {/* Pagination Dots */}
      <View style={styles.paginationDotsRow}>
        <View style={styles.dotActive} />
        <View style={styles.dotInactive} />
        <View style={styles.dotInactive} />
        <View style={styles.dotInactive} />
      </View>
    </View>
  );
}
