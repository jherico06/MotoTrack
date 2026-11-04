// =========================================================================
// MotoTrack Package Details Modal (Screen 2)
// Comprehensive package overview with inclusions and CC pricing tiers
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Modal } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { formatPhp } from '../../../utils/serviceQuotation.js';

export default function PackageDetailsModal({
  visible,
  pkg,
  isSelected,
  onToggleSelect,
  onClose,
  selectedMotorcycle,
  isAdmin = false,
  onEditPackage,
}) {
  const [modalImgError, setModalImgError] = React.useState(false);

  if (!visible || !pkg) return null;

  const rawCc =
    selectedMotorcycle?.engine_displacement ??
    selectedMotorcycle?.engine_cc ??
    selectedMotorcycle?.engineCc ??
    selectedMotorcycle?.cc;
  const engineCc = parseInt(rawCc, 10) || 0;
  const matchedTierId = engineCc > 0
    ? (engineCc <= 125 ? 'cc-125-below' : engineCc <= 160 ? 'cc-150-160' : 'cc-big-bikes')
    : null;

  const isRepair = pkg?.category === 'Repair' || pkg?.category === 'General Repair';
  const fallbackImg = isRepair
    ? 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=800&q=80'
    : 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
  const hasCustomImg = pkg.image && String(pkg.image).trim().length > 5;
  const imageUri = (!modalImgError && hasCustomImg) ? String(pkg.image).trim() : fallbackImg;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* ─── MODAL HEADER IMAGE ─── */}
          <View style={styles.modalHeaderImageWrap}>
            {modalImgError && !hasCustomImg ? (
              <View style={[styles.packageImage, { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }]}>
                <BootstrapIcon name={isRepair ? 'wrench' : 'wrench-adjustable'} size={40} color="#FF5A0A" />
                <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 6, fontWeight: '600' }}>MotoTrack Service</Text>
              </View>
            ) : (
              <Image
                source={{ uri: imageUri }}
                style={styles.packageImage}
                resizeMode="cover"
                onError={() => setModalImgError(true)}
              />
            )}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="x-lg" size={14} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.packageDurationPill}>
              <BootstrapIcon name="clock-fill" size={12} color="#FB923C" />
              <Text style={styles.packageDurationText}>
                Estimated Duration: {pkg.duration}
              </Text>
            </View>
          </View>

          {/* ─── MODAL CONTENT SCROLL ─── */}
          <ScrollView style={styles.modalContentScroll} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Text style={styles.modalCategoryBadge}>{pkg.category}</Text>
              {pkg.badge && (
                <View style={{ backgroundColor: '#1E2227', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginBottom: 14 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' }}>{pkg.badge}</Text>
                </View>
              )}
            </View>

            <Text style={styles.modalTitle}>{pkg.name}</Text>
            <Text style={styles.modalDescription}>{pkg.description}</Text>

            {/* ─── INCLUDED SERVICES BREAKDOWN ─── */}
            <Text style={styles.sectionTitle}>Included Services & Inspection Checklist</Text>
            <View style={{ gap: 8, marginBottom: 24, backgroundColor: '#F8FAFC', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
              {(pkg.inclusions || []).map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <BootstrapIcon name="check-circle-fill" size={15} color="#16A34A" />
                  <Text style={{ fontSize: 13, color: '#334155', flex: 1, lineHeight: 18 }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            {/* ─── CC-BASED PRICING INFORMATION ─── */}
            <Text style={styles.sectionTitle}>Applicable Engine Displacement (CC) Pricing</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
              Labor and service rates are configured based on your motorcycle engine displacement category:
            </Text>

            <View style={styles.ccPricingTable}>
              {(pkg.applicableTiers || []).map((tier, idx) => {
                const isLast = idx === (pkg.applicableTiers.length - 1);
                const isMatched = tier.id === matchedTierId;
                return (
                  <View
                    key={tier.id}
                    style={[
                      styles.ccPricingRow,
                      isLast && styles.ccPricingRowLast,
                      isMatched && { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 6 },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <BootstrapIcon name="speedometer2" size={14} color="#EA580C" />
                      <Text style={[styles.ccCategoryLabel, isMatched && { fontWeight: '700', color: '#EA580C' }]}>
                        {tier.label} {isMatched && '(Your Bike Rate)'}
                      </Text>
                    </View>
                    <Text style={[styles.ccPriceText, isMatched && { color: '#EA580C', fontWeight: '800' }, tier.price == null && { color: '#94A3B8', fontStyle: 'italic' }]}>
                      {tier.price != null ? formatPhp(tier.price) : 'Not Available for this category'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* ─── MODAL FOOTER ─── */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Close</Text>
            </TouchableOpacity>

            {isAdmin && typeof onEditPackage === 'function' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#EA580C',
                  backgroundColor: '#FFF7ED',
                  cursor: 'pointer',
                }}
                onPress={() => {
                  onClose();
                  onEditPackage(pkg);
                }}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="pencil-square" size={13} color="#EA580C" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C' }}>Edit Inclusions</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.modalSelectBtn,
                isSelected && { backgroundColor: '#1E2227' },
              ]}
              onPress={() => {
                onToggleSelect(pkg);
                onClose();
              }}
              activeOpacity={0.85}
            >
              {isSelected ? (
                <>
                  <BootstrapIcon name="dash-circle" size={14} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                    Remove from Selection
                  </Text>
                </>
              ) : (
                <>
                  <BootstrapIcon name="calendar-check-fill" size={14} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                    Book This Package
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

