// =========================================================================
// MotoTrack Minimalist Service Card Component
// High-quality photography, Category/Duration tags, Title, Short desc,
// 3 Included services with check icons, Starting price, Details & Rounded Select CTA
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { BootstrapIcon } from '../../common';
import { getPackageStartingPrice } from './bookingPackagesData.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';

const CC_TIERS = [
  { id: 'cc-125-below', label: '125cc and below' },
  { id: 'cc-150-160', label: '150cc–160cc' },
  { id: 'cc-big-bikes', label: 'Big Bikes (200cc+)' },
];

export default function PackageCard({
  pkg,
  isSelected,
  onToggleSelect,
  onViewDetails,
  selectedMotorcycle,
  matchedPrice,
  isAdmin = false,
  onEditPackage,
}) {
  const rawCc =
    selectedMotorcycle?.engine_displacement ??
    selectedMotorcycle?.engine_cc ??
    selectedMotorcycle?.engineCc ??
    selectedMotorcycle?.cc;
  const engineCc = parseInt(rawCc, 10) || null;
  const startingPrice = getPackageStartingPrice(pkg);
  const displayPrice = matchedPrice != null ? matchedPrice : startingPrice;
  const isExactPrice = matchedPrice != null;

  // CC tier matching the selected motorcycle (highlighted in the rate list)
  const activeTierId = engineCc
    ? engineCc <= 125
      ? 'cc-125-below'
      : engineCc < 200
        ? 'cc-150-160'
        : 'cc-big-bikes'
    : null;
  const [imgLoadError, setImgLoadError] = React.useState(false);
  const isRepair = pkg?.category === 'Repair' || pkg?.category === 'General Repair';
  const fallbackImg = isRepair
    ? 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80'
    : 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';

  // Prefer the customer's selected motorcycle photo; fall back to the package image
  const bikePhoto = String(
    selectedMotorcycle?.photo_url || selectedMotorcycle?.photoUrl || selectedMotorcycle?.image || ''
  ).trim();
  const hasBikePhoto = bikePhoto.length > 5;
  const hasCustomImg = hasBikePhoto || (pkg?.image && String(pkg.image).trim().length > 5);
  const primaryImg = hasBikePhoto ? bikePhoto : String(pkg?.image || '').trim();
  const imageUri = (!imgLoadError && hasCustomImg) ? primaryImg : fallbackImg;

  // Retry loading whenever the selected bike (or its photo) changes
  React.useEffect(() => {
    setImgLoadError(false);
  }, [bikePhoto]);

  return (
    <View style={[cardStyles.cardWrapper, isSelected && cardStyles.cardWrapperSelected]}>
      {/* ─── CARD IMAGE & DURATION PILL ─── */}
      <View style={cardStyles.imageContainer}>
        {imgLoadError && !hasCustomImg ? (
          <View style={[cardStyles.cardImage, { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }]}>
            <BootstrapIcon name={isRepair ? 'wrench' : 'wrench-adjustable'} size={32} color="#FF5A0A" />
            <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4, fontWeight: '600' }}>MotoTrack Service</Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUri }}
            style={cardStyles.cardImage}
            resizeMode="cover"
            onError={() => setImgLoadError(true)}
          />
        )}

        {/* Selected Checkmark Overlay */}
        {isSelected && (
          <View style={cardStyles.selectedCheckBadge}>
            <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
          </View>
        )}

        {/* Top Badges: Category & Duration */}
        <View style={cardStyles.topBadgeRow}>
          <View style={cardStyles.categoryPill}>
            <Text style={cardStyles.categoryPillText}>{pkg.category}</Text>
          </View>
          <View style={cardStyles.durationPill}>
            <BootstrapIcon name="clock" size={11} color="#52525B" />
            <Text style={cardStyles.durationPillText}>{pkg.duration}</Text>
          </View>
        </View>
      </View>

      {/* ─── CARD BODY ─── */}
      <View style={cardStyles.cardBody}>
        {/* Title */}
        <Text style={cardStyles.cardTitle} numberOfLines={1}>
          {pkg.name}
        </Text>

        {/* Short Description */}
        <Text style={cardStyles.cardDesc} numberOfLines={2}>
          {pkg.shortDescription}
        </Text>

        {/* ─── RATES BY ENGINE DISPLACEMENT (CC TIER) ─── */}
        <View style={cardStyles.inclusionsBox}>
          {CC_TIERS.map((tier) => {
            const raw = pkg?.prices?.[tier.id];
            const isAvailable = raw !== null && raw !== undefined && Number.isFinite(Number(raw));
            const isMatch = activeTierId === tier.id;
            return (
              <View
                key={tier.id}
                style={[cardStyles.inclusionLine, isMatch && cardStyles.tierLineActive]}
              >
                <View style={[cardStyles.checkIconWrap, !isMatch && cardStyles.tierDotIdle]}>
                  <BootstrapIcon
                    name={isMatch ? 'check2' : 'dot'}
                    size={13}
                    color={isMatch ? '#EA580C' : '#A1A1AA'}
                  />
                </View>
                <Text
                  style={[cardStyles.inclusionText, isMatch && cardStyles.tierTextActive]}
                  numberOfLines={1}
                >
                  {tier.label}
                </Text>
                <Text
                  style={[
                    cardStyles.tierPrice,
                    isMatch && cardStyles.tierPriceActive,
                    !isAvailable && cardStyles.tierPriceNa,
                  ]}
                >
                  {isAvailable ? formatPhp(Number(raw)) : 'N/A'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ─── CARD FOOTER (PRICING & ACTIONS) ─── */}
      <View style={cardStyles.cardFooter}>
        {/* Price Column */}
        <View style={cardStyles.priceCol}>
          <Text style={cardStyles.priceLabel}>
            {isExactPrice && engineCc ? `${engineCc}cc Rate` : isExactPrice ? 'Calculated Rate' : 'Starting Price'}
          </Text>
          <Text style={cardStyles.priceValue}>
            {formatPhp(displayPrice)}
          </Text>
        </View>

        {/* Action Buttons: Secondary "Details", Optional Admin "Edit", & Rounded "Select" */}
        <View style={cardStyles.btnGroup}>
          {isAdmin && typeof onEditPackage === 'function' && (
            <TouchableOpacity
              style={cardStyles.adminEditBtn}
              onPress={(e) => {
                e?.stopPropagation?.();
                onEditPackage(pkg);
              }}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="pencil" size={11} color="#EA580C" />
              <Text style={cardStyles.adminEditBtnText}>Edit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={cardStyles.detailsBtn}
            onPress={() => onViewDetails(pkg)}
            activeOpacity={0.75}
          >
            <Text style={cardStyles.detailsBtnText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cardStyles.selectBtn, isSelected && cardStyles.selectBtnActive]}
            onPress={() => onToggleSelect(pkg.id)}
            activeOpacity={0.88}
          >
            {isSelected ? (
              <>
                <BootstrapIcon name="check2" size={13} color="#FFFFFF" />
                <Text style={cardStyles.selectBtnTextActive}>Booked</Text>
              </>
            ) : (
              <Text style={cardStyles.selectBtnText}>Book</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all 0.2s ease',
    ...(Platform.OS === 'web'
      ? {
        boxShadow:
          '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
      }
      : {}),
  },
  cardWrapperSelected: {
    borderColor: '#EA580C',
    borderWidth: 1.5,
    ...(Platform.OS === 'web'
      ? {
        boxShadow:
          '0 0 0 3px rgba(234, 88, 12, 0.18), 0 4px 12px rgba(234, 88, 12, 0.08)',
      }
      : {}),
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
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topBadgeRow: {
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
    backdropFilter: 'blur(6px)',
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
  durationPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#52525B',
  },
  cardBody: {
    padding: 18,
    flex: 1,
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
  tierDotIdle: {
    backgroundColor: '#F4F4F5',
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
  adminEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
    cursor: 'pointer',
  },
  adminEditBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  detailsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52525B',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7.5,
    borderRadius: 8,
    backgroundColor: '#1E2227',
    cursor: 'pointer',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  selectBtnActive: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOpacity: 0.25,
  },
  selectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectBtnTextActive: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
