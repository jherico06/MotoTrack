import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions, Platform } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';
import { fontFamily } from '../../styles/typography.js';
import { marketingBannerService } from '../../services/marketing/marketingBannerService.js';

function renderBannerHeading(title) {
  const clean = String(title || '').trim();
  if (!clean) {
    return (
      <>
        Motorcycle Parts{'\n'}
        <Text style={{ color: '#FF5A0A' }}>& Accessories</Text>
      </>
    );
  }

  // If author explicitly put a newline \n:
  if (clean.includes('\n')) {
    const parts = clean.split('\n');
    return (
      <>
        {parts[0]}
        {'\n'}
        <Text style={{ color: '#FF5A0A' }}>{parts.slice(1).join(' ')}</Text>
      </>
    );
  }

  // Split words: if >= 3 words, last 2 words in orange; if 2 words, second word in orange; if 1 word, in orange
  const words = clean.split(/\s+/);
  if (words.length <= 1) {
    return <Text style={{ color: '#FF5A0A' }}>{clean}</Text>;
  }
  if (words.length === 2) {
    return (
      <>
        {words[0]} <Text style={{ color: '#FF5A0A' }}>{words[1]}</Text>
      </>
    );
  }
  const splitIdx = words.length > 3 ? words.length - 2 : words.length - 1;
  const firstPart = words.slice(0, splitIdx).join(' ');
  const accentPart = words.slice(splitIdx).join(' ');

  return (
    <>
      {firstPart}{'\n'}
      <Text style={{ color: '#FF5A0A' }}>{accentPart}</Text>
    </>
  );
}

export default function HeroBanner({
  onSelectCategory,
  onNavigateToScreen,
  onShopParts,
  showToast,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  const isSmallMobile = width < 420;

  const [banner, setBanner] = useState(() => marketingBannerService.getBanner());
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const unsub = marketingBannerService.subscribe((updated) => {
      if (isMounted) {
        setBanner(updated);
        setImageError(false);
      }
    });

    marketingBannerService
      .fetchBanner()
      .then((res) => {
        if (isMounted && res.banner) {
          setBanner(res.banner);
          setImageError(false);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleShopParts = () => {
    onSelectCategory?.('All');
    if (typeof onShopParts === 'function') {
      onShopParts();
    } else if (typeof document !== 'undefined') {
      const target = document.getElementById('catalog-products-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleBookService = () => {
    if (typeof onNavigateToScreen === 'function') {
      onNavigateToScreen('garage');
    } else {
      showToast?.('Navigating to Service Booking...');
    }
  };

  return (
    <View
      style={{
        width: '100%',
        backgroundColor: '#24272B',
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative',
        minHeight: isDesktop ? 460 : isTablet ? 420 : 480,
        marginBottom: 0,
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#26313B',
      }}
    >
      {/* ─── RIGHT BACKGROUND MOTORCYCLE PHOTO ─── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: isDesktop ? '38%' : isTablet ? '25%' : 0,
          opacity: isMobile ? 0.3 : 0.95,
          zIndex: 1,
        }}
      >
        {banner?.image && !imageError ? (
          <Image
            source={{ uri: banner.image }}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#24272B',
            }}
          />
        )}

        {/* Cinematic Gradient Overlays for perfect text contrast on left */}
        {Platform.OS === 'web' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isDesktop
                ? 'linear-gradient(90deg, #24272B 0%, #24272B 18%, rgba(36, 39, 43, 0.92) 40%, rgba(36, 39, 43, 0.3) 75%, rgba(36, 39, 43, 0) 100%)'
                : 'linear-gradient(180deg, rgba(36, 39, 43, 0.92) 0%, rgba(36, 39, 43, 0.75) 50%, #24272B 100%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </View>

      {/* ─── INNER CONTENT WRAPPER (Aligned with site maxContainer 1360px grid) ─── */}
      <View
        style={{
          width: '100%',
          maxWidth: 1360,
          marginHorizontal: 'auto',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* ─── TOP RIGHT GEOMETRIC ACCENT & SUBTITLE (matching reference UI) ─── */}
        {isDesktop && (
          <View
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              zIndex: 3,
              alignItems: 'flex-end',
              pointerEvents: 'none',
            }}
          >
          {/* Angular Orange Chevron Accent Ribbon */}
          {Platform.OS === 'web' && (
            <svg
              style={{
                position: 'absolute',
                top: -14,
                right: -10,
                width: 140,
                height: 140,
                pointerEvents: 'none',
                opacity: 0.9,
              }}
              viewBox="0 0 140 140"
              fill="none"
            >
              <polygon points="140,0 90,0 140,50" fill="#FF5A0A" />
              <polygon points="140,30 60,0 80,0 140,60" fill="#FF5A0A" opacity="0.6" />
              <polygon points="140,70 100,30 115,30 140,85" fill="#FF5A0A" opacity="0.3" />
            </svg>
          )}

          {banner?.subtitle ? (
            <View style={{ alignItems: 'flex-end', marginTop: 12, marginRight: 8 }}>
              {banner.subtitle.split(/\s+/).slice(0, 4).map((w, idx) => (
                <Text
                  key={idx}
                  style={{
                    color: idx % 2 === 0 ? '#FF5A0A' : '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '600',
                    letterSpacing: 2.5,
                    lineHeight: 16,
                    fontFamily: fontFamily.sans,
                    textTransform: 'uppercase',
                  }}
                >
                  {w}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Dot Grid Pattern Accent at Bottom Right */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              width: 50,
              gap: 5,
              marginTop: 240,
              opacity: 0.5,
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#FF5A0A',
                }}
              />
            ))}
          </View>
        </View>
      )}

        {/* ─── LEFT HERO CONTENT (Eyebrow, Headline, Subtitle, CTAs, Trust Indicators) ─── */}
        <View
          style={{
            position: 'relative',
            zIndex: 2,
            paddingLeft: isDesktop ? 24 : isTablet ? 24 : 16,
            paddingRight: isDesktop ? 24 : isTablet ? 24 : 16,
            paddingTop: isDesktop ? 54 : 36,
            paddingBottom: isDesktop ? 40 : 28,
            maxWidth: isDesktop ? 680 : isTablet ? 560 : '100%',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: isDesktop ? 460 : isTablet ? 420 : 480,
          }}
        >
        {/* Top: Eyebrow + Headline + Subtitle + CTAs */}
        <View>
          {/* Eyebrow / Subtitle Label */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: '#FF5A0A',
                fontSize: isSmallMobile ? 11 : 12.5,
                fontWeight: '600',
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                fontFamily: fontFamily.sans,
              }}
            >
              {banner?.subtitle || 'MOTOTRACK'}
            </Text>
          </View>

          {/* Headline: Dynamic banner title */}
          <Text
            style={{
              fontSize: isDesktop ? 46 : isTablet ? 38 : isSmallMobile ? 28 : 34,
              fontWeight: '600',
              color: '#FFFFFF',
              lineHeight: isDesktop ? 54 : isTablet ? 44 : isSmallMobile ? 34 : 40,
              letterSpacing: -0.8,
              fontFamily: fontFamily.sans,
              marginBottom: 14,
            }}
          >
            {renderBannerHeading(banner?.title)}
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: isDesktop ? 15 : 13.5,
              lineHeight: isDesktop ? 23 : 20,
              color: '#CBD5E1',
              fontFamily: fontFamily.sans,
              maxWidth: 480,
              marginBottom: isDesktop ? 28 : 22,
            }}
          >
            {banner?.description || ''}
          </Text>

          {/* CTAs Row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              marginBottom: isDesktop ? 44 : 28,
            }}
          >
            {/* Primary CTA: [ 🛒 Shop Parts -> ] */}
            <TouchableOpacity
              onPress={handleShopParts}
              activeOpacity={0.88}
              style={{
                backgroundColor: '#FF5A0A',
                paddingHorizontal: isDesktop ? 24 : 20,
                paddingVertical: isDesktop ? 13 : 11,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(255, 90, 10, 0.45)',
              }}
            >
              <BootstrapIcon name="cart3" size={15} color="#FFFFFF" />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: fontFamily.sans,
                }}
              >
                Shop Parts
              </Text>
              <BootstrapIcon name="arrow-right" size={14} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Secondary CTA: [ 🔧 Book a Service ] */}
            <TouchableOpacity
              onPress={handleBookService}
              activeOpacity={0.85}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.22)',
                paddingHorizontal: isDesktop ? 22 : 18,
                paddingVertical: isDesktop ? 13 : 11,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <BootstrapIcon name="tools" size={14} color="#FFFFFF" />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '700',
                  fontFamily: fontFamily.sans,
                }}
              >
                Book a Service
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── BOTTOM TRUST INDICATORS (Fast & Reliable Shipping | Genuine Parts & Brands | Expert Support Always) ─── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: isDesktop ? 32 : isTablet ? 20 : 16,
            flexWrap: 'wrap',
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* Indicator 1: Fast & Reliable Shipping */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 90, 10, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="truck" size={15} color="#FF5A0A" />
            </View>
            <View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '600',
                  fontFamily: fontFamily.sans,
                }}
              >
                Fast & Reliable
              </Text>
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 11,
                  fontWeight: '500',
                  fontFamily: fontFamily.sans,
                }}
              >
                Shipping
              </Text>
            </View>
          </View>

          {/* Indicator 2: Genuine Parts & Brands */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 90, 10, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="shield-check" size={15} color="#FF5A0A" />
            </View>
            <View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '600',
                  fontFamily: fontFamily.sans,
                }}
              >
                Genuine Parts
              </Text>
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 11,
                  fontWeight: '500',
                  fontFamily: fontFamily.sans,
                }}
              >
                & Brands
              </Text>
            </View>
          </View>

          {/* Indicator 3: Expert Support Always */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 90, 10, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="headset" size={15} color="#FF5A0A" />
            </View>
            <View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '600',
                  fontFamily: fontFamily.sans,
                }}
              >
                Expert Support
              </Text>
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 11,
                  fontWeight: '500',
                  fontFamily: fontFamily.sans,
                }}
              >
                Always
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  </View>
);
}
