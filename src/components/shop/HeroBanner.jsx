import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { shopStyles as styles } from '../../styles/shop.styles';
import { promoService } from '../../services/promoService';

const BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80',
];

export default function HeroBanner({ onSelectCategory, showToast }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  
  const [activePromos, setActivePromos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchPromos = async () => {
      const allPromos = await promoService.getPromos();
      const active = (allPromos || []).filter((p) => p.isActive);
      setActivePromos(active);
    };
    fetchPromos();
    
    // Poll promos every 5 seconds to stay updated with admin dashboard changes
    const interval = setInterval(fetchPromos, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-cycle carousel every 4.5 seconds if multiple promos are active
  useEffect(() => {
    if (activePromos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activePromos.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activePromos.length]);

  if (!activePromos || activePromos.length === 0) return null;

  const safeIndex = currentIndex < activePromos.length ? currentIndex : 0;
  const currentPromo = activePromos[safeIndex];
  const freeShipping = currentPromo?.description?.toLowerCase().includes('free shipping');

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activePromos.length) % activePromos.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activePromos.length);
  };

  const handleCopyCode = (code) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code);
      }
    } catch (e) {}
    showToast?.(`Copied promo code "${code}"! Apply it at checkout.`);
  };

  const handleShopNow = (promo) => {
    onSelectCategory?.('All');
    showToast?.(`Use code ${promo.code} at checkout for ${promo.discountPercent}% OFF!`);
  };

  const currentImage = BANNER_IMAGES[safeIndex % BANNER_IMAGES.length];

  return (
    <View style={styles.heroBannerWrap}>
      <View style={[styles.heroBannerCard, isDesktop && styles.heroBannerCardDesktop]}>
        <View style={styles.heroBannerBgShape} />
        
        <View style={styles.heroBannerLeft}>
          {/* Promo Selector Tabs if multiple promos active */}
          {activePromos.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <BootstrapIcon name="ticket-perforated-fill" size={11} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' }}>
                  PROMO {safeIndex + 1}/{activePromos.length}
                </Text>
              </View>

              {activePromos.map((p, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <TouchableOpacity
                    key={p.code || idx}
                    onPress={() => setCurrentIndex(idx)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? '#0C6258' : '#FFFFFF',
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      {p.code} ({p.discountPercent}% OFF)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={[styles.heroBannerHeading, isDesktop && styles.heroBannerHeadingDesktop]}>
            {currentPromo.description || `Up to ${currentPromo.discountPercent}% OFF Pro Motorcycle Parts!`}
          </Text>

          <Text style={styles.heroBannerSub}>
            Use code: <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{currentPromo.code}</Text> at checkout for {currentPromo.discountPercent}% discount{freeShipping ? ' and Free Shipping' : ''}.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={[styles.heroShopBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={() => handleShopNow(currentPromo)}
              activeOpacity={0.9}
            >
              <BootstrapIcon name="cart-check-fill" size={13} color="#0C6258" />
              <Text style={styles.heroShopBtnText}>Shop Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.heroShopBtn,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.45)',
                },
              ]}
              onPress={() => handleCopyCode(currentPromo.code)}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="tag-fill" size={12} color="#FFFFFF" />
              <Text style={[styles.heroShopBtnText, { color: '#FFFFFF' }]}>
                Copy Code ({currentPromo.code})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroBannerRight}>
          <Image
            source={{ uri: currentImage }}
            style={[styles.heroProductImg, isDesktop && styles.heroProductImgDesktop]}
          />
        </View>
      </View>

      {/* Pagination Controls with Prev / Next and Dots */}
      {activePromos.length > 1 && (
        <View style={[styles.paginationDotsRow, { gap: 10, marginTop: 12 }]}>
          <TouchableOpacity
            onPress={handlePrev}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#E2E8F0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Previous Promo"
          >
            <BootstrapIcon name="chevron-left" size={11} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {activePromos.map((p, idx) => (
              <TouchableOpacity
                key={p.code || idx}
                onPress={() => setCurrentIndex(idx)}
                style={idx === safeIndex ? styles.dotActive : styles.dotInactive}
                activeOpacity={0.8}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={handleNext}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#E2E8F0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Next Promo"
          >
            <BootstrapIcon name="chevron-right" size={11} color="#0F172A" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
