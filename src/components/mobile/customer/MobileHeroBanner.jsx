import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import { fontFamily } from '../../../styles/typography.js';
import { marketingBannerService } from '../../../services/marketing/marketingBannerService.js';

function renderCompactHeading(title) {
  const clean = String(title || '').replace(/\n+/g, ' ').trim();
  if (!clean) {
    return (
      <>
        Motorcycle Parts <Text style={{ color: '#FF5A0A' }}>& Accessories</Text>
      </>
    );
  }
  const words = clean.split(/\s+/);
  if (words.length <= 1) {
    return <Text style={{ color: '#FF5A0A' }}>{clean}</Text>;
  }
  const splitIdx = words.length > 3 ? words.length - 2 : words.length - 1;
  return (
    <>
      {words.slice(0, splitIdx).join(' ')}{' '}
      <Text style={{ color: '#FF5A0A' }}>{words.slice(splitIdx).join(' ')}</Text>
    </>
  );
}

/**
 * Compact, understated Shop promo banner for mobile so featured products
 * remain visible above the fold and take visual priority.
 */
export default function MobileHeroBanner({
  onSelectCategory,
  onNavigateToScreen,
  onShopParts,
  showToast,
}) {
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
        if (isMounted && res?.banner) {
          setBanner(res.banner);
          setImageError(false);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      unsub?.();
    };
  }, []);

  const handleShopParts = () => {
    onSelectCategory?.('All');
    if (typeof onShopParts === 'function') {
      onShopParts();
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
        backgroundColor: '#1E2227',
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2E343B',
      }}
    >
      {/* Subtle right-aligned background accent image */}
      {banner?.image && !imageError ? (
        <Image
          source={{ uri: banner.image }}
          onError={() => setImageError(true)}
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '48%',
            opacity: 0.28,
          }}
        />
      ) : null}

      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          zIndex: 2,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: '#FB923C',
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontFamily: fontFamily.sans,
            marginBottom: 3,
          }}
        >
          {banner?.subtitle || 'MOTOTRACK'}
        </Text>

        <Text
          numberOfLines={2}
          style={{
            fontSize: 16.5,
            lineHeight: 21,
            fontWeight: '700',
            color: '#FFFFFF',
            letterSpacing: -0.3,
            fontFamily: fontFamily.sans,
            maxWidth: '84%',
          }}
        >
          {renderCompactHeading(banner?.title)}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 9,
          }}
        >
          <TouchableOpacity
            onPress={handleShopParts}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#EA580C',
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 11.5,
                fontWeight: '600',
                fontFamily: fontFamily.sans,
              }}
            >
              Shop Parts
            </Text>
            <BootstrapIcon name="arrow-right" size={11} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBookService}
            activeOpacity={0.85}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.2)',
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <BootstrapIcon name="tools" size={11} color="#E2E8F0" />
            <Text
              style={{
                color: '#F8FAFC',
                fontSize: 11.5,
                fontWeight: '600',
                fontFamily: fontFamily.sans,
              }}
            >
              Book Service
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
