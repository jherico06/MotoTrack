import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions, Platform } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';
import { promoService } from '../../services/products/promoService.js';

const BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1000&q=80',
];

/**
 * Renders high-impact two-tone headline matching the inspiration design
 * (e.g. "Creative Marketing Agency" -> "Free Shipping Promo" with "Shipping" in Racing Orange)
 */
function DynamicTwoToneHeading({ text = '', isDesktop = false, isMobile = false }) {
  const clean = (text || 'Free Shipping Promo').trim();
  const words = clean.split(/\s+/);

  if (words.length <= 1) {
    return (
      <Text
        style={[
          styles.heroBannerHeading,
          isDesktop && styles.heroBannerHeadingDesktop,
          isMobile && styles.heroBannerHeadingMobile,
        ]}
      >
        {clean}
      </Text>
    );
  }

  // Identify the high-impact keyword to highlight in Racing Orange
  const highlightRegex = /(shipping|superbike|discount|special|save|parts|exclusive|promo|sale|clearance)/i;
  let highlightIdx = words.findIndex((w) => highlightRegex.test(w));
  if (highlightIdx === -1) {
    highlightIdx = Math.min(1, words.length - 1);
  }

  return (
    <Text
      style={[
        styles.heroBannerHeading,
        isDesktop && styles.heroBannerHeadingDesktop,
        isMobile && styles.heroBannerHeadingMobile,
      ]}
      numberOfLines={3}
    >
      {words.map((w, idx) => {
        const isHighlight = idx === highlightIdx;
        return (
          <React.Fragment key={idx}>
            <Text style={isHighlight ? styles.heroHeadingHighlight : styles.heroHeadingWhite}>
              {w}
            </Text>
            {idx < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </Text>
  );
}

export default function HeroBanner({ onSelectCategory, showToast }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isMobile = width < 640;
  const isSmallMobile = width < 380;

  const [activePromos, setActivePromos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchPromos = async () => {
      const allPromos = await promoService.getPromos();
      const active = (allPromos || []).filter((p) => p.isActive);
      setActivePromos(active);
    };
    fetchPromos();

    // Soft refresh every 60s
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchPromos();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-cycle carousel every 5.5 seconds if multiple promos are active
  useEffect(() => {
    if (activePromos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activePromos.length);
    }, 5500);
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

  const currentImage =
    currentPromo?.imageUrl ||
    currentPromo?.bannerImage ||
    currentPromo?.image ||
    BANNER_IMAGES[safeIndex % BANNER_IMAGES.length];

  return (
    <View style={styles.heroBannerWrap}>
      <View
        style={[
          styles.heroBannerCard,
          isDesktop && styles.heroBannerCardDesktop,
          isMobile && { minHeight: 180 },
        ]}
      >
        {/* ─── RIGHT MOTORCYCLE PHOTO (Full bleed, masked by origami cut) ─── */}
        <View style={styles.heroRightPhotoWrap}>
          <Image
            source={{ uri: currentImage }}
            style={styles.heroProductImg}
          />
        </View>

        {/* ─── WEB SVG GEOMETRIC ORIGAMI RIBBON SEPARATOR & OVERLAYS ─── */}
        {Platform.OS === 'web' && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 2,
            }}
            viewBox="0 0 1000 260"
            preserveAspectRatio="none"
          >
            {/* Top-left Racing Orange accent tab */}
            <polygon points="0,0 145,0 116,11 0,11" fill="#EA580C" />

            {/* Dark charcoal left cover extending into angled origami cut */}
            <polygon points="0,0 545,0 610,82 546,138 602,192 556,260 0,260" fill="#20242B" />

            {/* Upper diagonal orange ribbon band */}
            <polygon points="545,0 582,0 647,82 610,82" fill="#EA580C" />

            {/* 3D Origami fold underside shadow */}
            <polygon points="610,82 647,82 546,138" fill="#9A3412" />

            {/* Forward folded origami chevron pointing left */}
            <polygon points="546,138 508,138 565,192 602,192" fill="#EA580C" />
            <polygon points="508,138 546,138 602,192 565,192" fill="#EA580C" />

            {/* Lower diagonal orange ribbon band */}
            <polygon points="565,192 602,192 594,260 556,260" fill="#EA580C" />

            {/* Floating diagonal orange slash over photo */}
            <polygon points="695,24 718,24 682,70 659,70" fill="#EA580C" opacity="0.9" />
          </svg>
        )}

        {/* ─── NATIVE FALLBACK ANGLED ACCENTS ─── */}
        {Platform.OS !== 'web' && (
          <View
            style={{
              position: 'absolute',
              right: '42%',
              top: 0,
              bottom: 0,
              width: 16,
              backgroundColor: '#EA580C',
              transform: [{ skewX: '-18deg' }],
              zIndex: 2,
            }}
          />
        )}

        {/* ─── LEFT CONTENT SECTION (Typography, CTA, Brand, Footer) ─── */}
        <View style={[styles.heroBannerLeft, isMobile && styles.heroBannerLeftMobile]}>
          {/* Top Brand / Eyebrow Row */}
          <View style={styles.heroBrandRow}>
            <View style={styles.heroBrandBadge}>
              <View style={styles.heroBrandDiamond} />
              <Text style={styles.heroBrandText}>MotoTrack Official</Text>
            </View>
            <Text style={styles.heroFloatingCrossOrange}>✕</Text>
          </View>

          {/* Dynamic Two-Tone Heading (Matching Inspiration Design) */}
          <DynamicTwoToneHeading
            text={currentPromo.description || `Up to ${currentPromo.discountPercent}% OFF Pro Parts`}
            isDesktop={isDesktop}
            isMobile={isMobile}
          />

          {/* Description Text */}
          <Text
            style={[
              styles.heroBannerSub,
              isMobile && { fontSize: 11, lineHeight: 15, marginBottom: 8 },
            ]}
            numberOfLines={2}
          >
            Use code: <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{currentPromo.code}</Text> for {currentPromo.discountPercent}% off{freeShipping ? ' + Free Shipping nationwide' : ''}.
          </Text>

          {/* Action Row: Primary Shop Now Button + Copy Code Button */}
          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              style={[
                styles.heroPrimaryBtn,
                isMobile && { paddingHorizontal: 14, paddingVertical: 7 },
              ]}
              onPress={() => handleShopNow(currentPromo)}
              activeOpacity={0.88}
            >
              <Text style={[styles.heroPrimaryBtnText, isMobile && { fontSize: 12 }]}>Shop Now</Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.heroSecondaryBtn,
                isMobile && { paddingHorizontal: 10, paddingVertical: 7 },
              ]}
              onPress={() => handleCopyCode(currentPromo.code)}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="tag-fill" size={11} color="#CBD5E1" />
              <Text style={[styles.heroSecondaryBtnText, isMobile && { fontSize: 11 }]}>
                {isSmallMobile ? currentPromo.code : `Copy (${currentPromo.code})`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Row: Website Watermark + Feature Badges */}
          {!isSmallMobile && (
            <View style={styles.heroFooterRow}>
              <Text style={styles.heroWebsiteText}>mototrack.ph</Text>
              <View style={styles.heroFeatureBadges}>
                <View style={styles.heroFeatureBadge} title="Authentic Parts">
                  <BootstrapIcon name="shield-check" size={10} color="#FFFFFF" />
                </View>
                <View style={styles.heroFeatureBadge} title="Express Shipping">
                  <BootstrapIcon name="truck" size={9.5} color="#FFFFFF" />
                </View>
                <View style={styles.heroFeatureBadge} title="Quality Fitment">
                  <BootstrapIcon name="tools" size={9} color="#FFFFFF" />
                </View>
                <View style={styles.heroFeatureBadge} title="Warranty Support">
                  <BootstrapIcon name="arrow-repeat" size={9.5} color="#FFFFFF" />
                </View>
              </View>
            </View>
          )}

          {/* Dot Matrix Pattern Decoration */}
          {isDesktop && (
            <View style={styles.dotMatrixGrid}>
              {Array.from({ length: 18 }).map((_, i) => (
                <View key={i} style={styles.matrixDot} />
              ))}
            </View>
          )}

          {/* Floating Subtle White Cross */}
          {isDesktop && <Text style={styles.heroFloatingCrossWhite}>✕</Text>}
        </View>
      </View>

      {/* Pagination Controls with Prev / Next and Dots if multiple promos active */}
      {activePromos.length > 1 && (
        <View style={styles.paginationDotsRow}>
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
