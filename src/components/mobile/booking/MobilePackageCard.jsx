import React, { useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from '../../common';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import {
  MOBILE_CC_TIERS,
  getCcTierId,
  getPackageStartingPrice,
} from './mobilePackageCatalog.js';

function MobilePackageCard({
  pkg,
  isSelected = false,
  selectedMotorcycle = null,
  matchedPrice = null,
  isDarkMode = false,
  onToggleSelect,
  onViewDetails,
}) {
  const [imgError, setImgError] = useState(false);

  const rawCc =
    selectedMotorcycle?.engine_displacement ??
    selectedMotorcycle?.engine_cc ??
    selectedMotorcycle?.engineCc ??
    selectedMotorcycle?.cc;
  const engineCc = parseInt(rawCc, 10) || 0;
  const activeTierId = getCcTierId(engineCc);
  const startingPrice = getPackageStartingPrice(pkg);
  const displayPrice = matchedPrice != null ? matchedPrice : startingPrice;
  const isUnavailableForCc =
    matchedPrice === null && activeTierId !== null && pkg?.prices?.[activeTierId] === null;
  const isExactPrice = matchedPrice != null && !isUnavailableForCc;

  const isRepair = pkg?.category === 'Repair' || pkg?.category === 'General Repair';
  const bikePhoto = String(
    selectedMotorcycle?.photo_url || selectedMotorcycle?.photoUrl || selectedMotorcycle?.image || ''
  ).trim();
  const hasBikePhoto = bikePhoto.length > 5;
  const hasCustomImg = hasBikePhoto || (pkg?.image && String(pkg.image).trim().length > 5);
  const fallbackImg = isRepair
    ? 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80'
    : 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
  const primaryImg = hasBikePhoto ? bikePhoto : String(pkg?.image || '').trim();
  const imageUri = !imgError && hasCustomImg ? primaryImg : fallbackImg;

  useEffect(() => {
    setImgError(false);
  }, [bikePhoto, pkg?.image]);

  return (
    <View
      style={[
        styles.cardWrapper,
        isDarkMode && styles.cardWrapperDark,
        isSelected && styles.cardWrapperSelected,
      ]}
    >
      {/* ─── CARD IMAGE & BOTTOM CATEGORY/DURATION PILLS (EXACT WEB LAYOUT) ─── */}
      <View style={[styles.imageContainer, isDarkMode && { backgroundColor: '#202124' }]}>
        {imgError && !hasCustomImg ? (
          <View
            style={[
              styles.cardImage,
              { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <BootstrapIcon name={isRepair ? 'wrench' : 'wrench-adjustable'} size={32} color="#FF5A0A" />
            <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4, fontWeight: '600' }}>
              MotoTrack Service
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUri }}
            style={styles.cardImage}
            resizeMode="cover"
            fadeDuration={Platform.OS === 'android' ? 0 : 200}
            onError={() => setImgError(true)}
          />
        )}

        {isSelected ? (
          <View style={styles.selectedCheckBadge}>
            <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
          </View>
        ) : null}

        <View style={styles.bottomBadgeRow}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{pkg?.category || 'PMS'}</Text>
          </View>
          <View style={[styles.durationPill, isDarkMode && styles.durationPillDark]}>
            <BootstrapIcon name="clock" size={11} color={isDarkMode ? '#A1A1AA' : '#52525B'} />
            <Text style={[styles.durationPillText, isDarkMode && { color: '#A1A1AA' }]}>
              {pkg?.duration || '45–60 mins'}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── CARD BODY ─── */}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, isDarkMode && { color: '#F2F2F3' }]} numberOfLines={1}>
          {pkg?.name}
        </Text>
        <Text style={[styles.cardDesc, isDarkMode && { color: '#A1A1AA' }]} numberOfLines={2}>
          {pkg?.shortDescription || pkg?.description}
        </Text>

        {/* Rates by Engine Displacement */}
        <View style={[styles.inclusionsBox, isDarkMode && { borderTopColor: '#292B2F' }]}>
          {MOBILE_CC_TIERS.map((tier) => {
            const raw = pkg?.prices?.[tier.id];
            const isAvailable = raw !== null && raw !== undefined && Number.isFinite(Number(raw));
            const isMatch = activeTierId === tier.id;
            return (
              <View
                key={tier.id}
                style={[
                  styles.inclusionLine,
                  isMatch && (isDarkMode ? styles.tierLineActiveDark : styles.tierLineActive),
                ]}
              >
                <View
                  style={[
                    styles.checkIconWrap,
                    !isMatch && (isDarkMode ? { backgroundColor: '#292B2F' } : styles.tierDotIdle),
                  ]}
                >
                  <BootstrapIcon
                    name={isMatch ? 'check2' : 'dot'}
                    size={13}
                    color={isMatch ? '#EA580C' : '#A1A1AA'}
                  />
                </View>
                <Text
                  style={[
                    styles.inclusionText,
                    isDarkMode && { color: '#D4D4D8' },
                    isMatch && (isDarkMode ? { color: '#F2F2F3', fontWeight: '600' } : styles.tierTextActive),
                  ]}
                  numberOfLines={1}
                >
                  {tier.label}
                </Text>
                <Text
                  style={[
                    styles.tierPrice,
                    isDarkMode && { color: '#A1A1AA' },
                    isMatch && styles.tierPriceActive,
                    !isAvailable && styles.tierPriceNa,
                  ]}
                >
                  {isAvailable ? formatPhp(Number(raw)) : 'N/A'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ─── CARD FOOTER (#FAFAF9 STRIP, DETAILS + CHARCOAL #1E2227 BOOK CTA) ─── */}
      <View style={[styles.cardFooter, isDarkMode && styles.cardFooterDark]}>
        <View style={styles.priceCol}>
          <Text style={[styles.priceLabel, isDarkMode && { color: '#A1A1AA' }]}>
            {isExactPrice && engineCc ? `${engineCc}cc Rate` : 'Starting Price'}
          </Text>
          <Text style={[styles.priceValue, isDarkMode && { color: '#F2F2F3' }]}>
            {isUnavailableForCc ? 'N/A' : formatPhp(Number(displayPrice || 0))}
          </Text>
        </View>

        <View style={styles.btnGroup}>
          <TouchableOpacity
            style={[styles.detailsBtn, isDarkMode && styles.detailsBtnDark]}
            onPress={() => onViewDetails?.(pkg)}
            activeOpacity={0.75}
          >
            <Text style={[styles.detailsBtnText, isDarkMode && { color: '#A1A1AA' }]}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectBtn,
              isSelected && styles.selectBtnActive,
              isUnavailableForCc && { backgroundColor: '#94A3B8' },
            ]}
            onPress={() => !isUnavailableForCc && onToggleSelect?.(pkg)}
            disabled={isUnavailableForCc}
            activeOpacity={0.88}
          >
            {isSelected ? (
              <>
                <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                <Text style={styles.selectBtnText}>Booked</Text>
              </>
            ) : (
              <Text style={styles.selectBtnText}>{isUnavailableForCc ? 'N/A' : 'Book'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default memo(MobilePackageCard);

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardWrapperDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  cardWrapperSelected: {
    borderColor: '#EA580C',
    borderWidth: 1.5,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#F4F4F5',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  selectedCheckBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBadgeRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    backgroundColor: 'rgba(24, 24, 27, 0.82)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  durationPillDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  durationPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#52525B',
  },
  cardBody: {
    padding: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181B',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: '#52525B',
    marginBottom: 16,
  },
  inclusionsBox: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  inclusionLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(234, 88, 12, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierDotIdle: {
    backgroundColor: '#F4F4F5',
  },
  inclusionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#27272A',
    flex: 1,
  },
  tierLineActive: {
    backgroundColor: '#FFF7ED',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierLineActiveDark: {
    backgroundColor: '#3A241B',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierTextActive: {
    fontWeight: '600',
    color: '#18181B',
  },
  tierPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: '#52525B',
    fontVariant: ['tabular-nums'],
  },
  tierPriceActive: {
    fontWeight: '700',
    color: '#EA580C',
  },
  tierPriceNa: {
    color: '#A1A1AA',
    fontWeight: '500',
  },
  cardFooter: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    backgroundColor: '#FAFAF9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardFooterDark: {
    backgroundColor: '#202124',
    borderTopColor: '#303236',
  },
  priceCol: {
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  btnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsBtnDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52525B',
  },
  selectBtn: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7.5,
    borderRadius: 8,
    backgroundColor: '#1E2227',
  },
  selectBtnActive: {
    backgroundColor: '#EA580C',
  },
  selectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
