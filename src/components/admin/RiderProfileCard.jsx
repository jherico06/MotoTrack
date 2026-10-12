/**
 * Marketplace-style delivery rider profile card.
 * Visual language mirrors premium freelancer profile cards:
 * hero portrait, dark overlay content, metric row, pill CTA + circular icons.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../common';
import {
  RIDER_STATUSES,
  RIDER_ACCOUNT_STATUSES,
  RIDER_AVATAR_PRESETS,
} from '../../services/staff/riderService.js';

const BRAND_SOFT = '#10B981';

function dutyMeta(status) {
  if (status === RIDER_STATUSES.AVAILABLE) {
    return { label: 'Available', color: '#34D399', icon: 'check-circle-fill' };
  }
  if (status === RIDER_STATUSES.ON_DELIVERY) {
    return { label: 'On Delivery', color: '#FBBF24', icon: 'box-seam-fill' };
  }
  return { label: status || 'Off Duty', color: '#94A3B8', icon: 'moon-fill' };
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    minWidth: 280,
    maxWidth: 360,
    borderRadius: 28,
    padding: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8EC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' }
      : {}),
  },
  outerDark: {
    backgroundColor: '#1A1D23',
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)' }
      : {}),
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111827',
    minHeight: 460,
  },
  hero: {
    width: '100%',
    height: 460,
    justifyContent: 'flex-end',
    backgroundColor: '#0A0C10',
  },
  // Uniform darkness across the full card (same weight top → bottom)
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 14, 0.86)',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 20,
    gap: 14,
  },
  identity: {
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  activeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveBadge: {
    backgroundColor: '#64748B',
  },
  statusCircle: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10B981',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 8px rgba(16, 185, 129, 0.7)' }
      : {
          shadowColor: '#10B981',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 5,
          elevation: 4,
        }),
  },
  statusCircleInactive: {
    backgroundColor: '#64748B',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : {
          shadowOpacity: 0,
          elevation: 0,
        }),
  },
  bio: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },
  bioSecondary: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.62)',
    lineHeight: 17,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 4,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  statValueAccent: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.55)',
  },
  dutyTap: {
    alignItems: 'center',
    gap: 3,
  },
  dutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  dutyPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  deleteCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
});

export default function RiderProfileCard({
  rider,
  isDarkMode = false,
  onToggleStatus,
  onOpenLiveMap,
  onEdit,
  onDelete,
}) {
  const duty = useMemo(() => dutyMeta(rider?.status), [rider?.status]);
  const isInactive =
    (rider?.accountStatus || 'Active') === RIDER_ACCOUNT_STATUSES.INACTIVE;
  const username = rider?.username ? `@${rider.username}` : 'No login';
  const shortName = rider?.shortName ? ` • ${rider.shortName}` : '';
  const earnings = Number(rider?.totalEarnings || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const avatarUri = rider?.avatar || RIDER_AVATAR_PRESETS[0];
  const vehicle = rider?.vehicleInfo || 'No vehicle';
  const plate = rider?.plateNumber || '—';
  const phone = rider?.phone || 'No phone';

  return (
    <View style={[styles.outer, isDarkMode && styles.outerDark]}>
      <View style={styles.card}>
        <ImageBackground
          source={{ uri: avatarUri }}
          style={styles.hero}
          imageStyle={{ borderRadius: 24, backgroundColor: '#0B0F14' }}
          resizeMode="cover"
        >
          <View style={styles.overlayFull} pointerEvents="none" />

          {/* Top-left active status indicator (green circle) */}
          <View
            style={[
              styles.statusCircle,
              isInactive && styles.statusCircleInactive,
            ]}
            accessibilityRole="status"
            accessibilityLabel={isInactive ? 'Rider Inactive' : 'Rider Active'}
          />

          <View style={styles.content}>
            {/* Identity */}
            <View style={styles.identity}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {rider?.name || 'Delivery Rider'}
                </Text>
                <View style={[styles.activeBadge, isInactive && styles.inactiveBadge]}>
                  <BootstrapIcon name="check-lg" size={11} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.bio} numberOfLines={1}>
                {username}
                {shortName}
              </Text>
              <Text style={styles.bioSecondary} numberOfLines={1}>
                {vehicle}
                {rider?.plateNumber ? ` · ${plate}` : ''}
              </Text>
            </View>

            {/* Compact contact chips */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <BootstrapIcon name="telephone" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={styles.chipText} numberOfLines={1}>
                  {phone}
                </Text>
              </View>
              {rider?.email ? (
                <View style={[styles.chip, { maxWidth: '100%' }]}>
                  <BootstrapIcon name="envelope" size={11} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {rider.email}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Stats — marketplace metric row */}
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <View style={styles.statValueRow}>
                  <BootstrapIcon name="bicycle" size={12} color="#A7F3D0" />
                  <Text style={styles.statValue} numberOfLines={1}>
                    {plate}
                  </Text>
                </View>
                <Text style={styles.statLabel}>Unit</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statCol}>
                <Text style={styles.statValueAccent} numberOfLines={1}>
                  ₱{earnings}
                </Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>

              <View style={styles.statDivider} />

              <TouchableOpacity
                style={[styles.statCol, styles.dutyTap]}
                onPress={() => onToggleStatus?.(rider)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Duty status ${duty.label}. Tap to change.`}
              >
                <View
                  style={[
                    styles.dutyPill,
                    {
                      backgroundColor:
                        rider?.status === RIDER_STATUSES.AVAILABLE
                          ? 'rgba(52, 211, 153, 0.16)'
                          : rider?.status === RIDER_STATUSES.ON_DELIVERY
                            ? 'rgba(251, 191, 36, 0.16)'
                            : 'rgba(148, 163, 184, 0.16)',
                      borderColor:
                        rider?.status === RIDER_STATUSES.AVAILABLE
                          ? 'rgba(52, 211, 153, 0.35)'
                          : rider?.status === RIDER_STATUSES.ON_DELIVERY
                            ? 'rgba(251, 191, 36, 0.35)'
                            : 'rgba(148, 163, 184, 0.35)',
                    },
                  ]}
                >
                  <BootstrapIcon name={duty.icon} size={10} color={duty.color} />
                  <Text style={[styles.dutyPillText, { color: duty.color }]} numberOfLines={1}>
                    {duty.label}
                  </Text>
                </View>
                <Text style={styles.statLabel}>Status</Text>
              </TouchableOpacity>
            </View>

            {/* Actions — Get In Touch style */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => onOpenLiveMap?.(rider)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Open live map"
              >
                <BootstrapIcon name="geo-alt" size={15} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Live Map</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => onEdit?.(rider)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Edit rider"
              >
                <BootstrapIcon name="pencil" size={15} color="#F8FAFC" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.circleBtn, styles.deleteCircle]}
                onPress={() => onDelete?.(rider)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Delete rider"
              >
                <BootstrapIcon name="trash3" size={15} color="#FCA5A5" />
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </View>
    </View>
  );
}
