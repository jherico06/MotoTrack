// =========================================================================
// MotoTrack Auxiliary Modals: Favorites, Notifications, Motorcycle, Schedule, Success
// Clean, Modern, Flat Editorial Design with Accessible Interactions
// =========================================================================

import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Image } from 'react-native';
import { BootstrapIcon } from '../../common';
import { formatPhp } from '../../../utils/serviceQuotation.js';
import { MOCK_MOTORCYCLES, TIME_SLOTS } from './bookingPackagesData.js';

// ─── 1. FAVORITES MODAL ───
export function FavoritesModal({ visible, onClose, favorites = [], onSelectPackage, onRemoveFavorite }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.modalCard}>
          <View style={modalStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BootstrapIcon name="heart-fill" size={16} color="#EA580C" />
              <Text style={modalStyles.title}>Saved Service Packages</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <BootstrapIcon name="x-lg" size={14} color="#71717A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
            {favorites.length === 0 ? (
              <View style={modalStyles.emptyState}>
                <BootstrapIcon name="heart" size={32} color="#D4D4D8" />
                <Text style={modalStyles.emptyTitle}>No saved packages yet</Text>
                <Text style={modalStyles.emptySub}>
                  Click the favorite icon on any service package to save it for quick booking.
                </Text>
              </View>
            ) : (
              favorites.map((pkg) => (
                <View key={pkg.id} style={modalStyles.favRow}>
                  <Image source={{ uri: pkg.image }} style={modalStyles.favImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.favName} numberOfLines={1}>{pkg.name}</Text>
                    <Text style={modalStyles.favSub}>{pkg.category} • {pkg.duration}</Text>
                    <Text style={modalStyles.favPrice}>{formatPhp(pkg.startingPrice || 2500)}</Text>
                  </View>
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    <TouchableOpacity
                      style={modalStyles.miniSelectBtn}
                      onPress={() => {
                        onSelectPackage?.(pkg.id);
                        onClose();
                      }}
                    >
                      <Text style={modalStyles.miniSelectText}>Select</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onRemoveFavorite?.(pkg.id)}
                      style={{ padding: 4 }}
                    >
                      <BootstrapIcon name="trash" size={13} color="#A1A1AA" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.secondaryBtn} onPress={onClose}>
              <Text style={modalStyles.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 2. NOTIFICATIONS MODAL ───
export function NotificationsModal({ visible, onClose }) {
  if (!visible) return null;

  const notifications = [
    {
      id: 'n1',
      title: 'Periodic Maintenance Due',
      desc: 'Your Yamaha MT-09 SP is due for its 6,000 km oil renewal & brake check.',
      time: '2 hours ago',
      unread: true,
      icon: 'wrench',
    },
    {
      id: 'n2',
      title: 'Shop Promotion: Free Brake Bleed',
      desc: 'Book Complete Care this week and enjoy complimentary track brake fluid flush.',
      time: '1 day ago',
      unread: false,
      icon: 'tag',
    },
    {
      id: 'n3',
      title: 'Booking Approved',
      desc: 'Booking #BK-PMS-2026-00088 has been confirmed by master technician.',
      time: '3 days ago',
      unread: false,
      icon: 'check-circle',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.modalCard}>
          <View style={modalStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BootstrapIcon name="bell-fill" size={16} color="#EA580C" />
              <Text style={modalStyles.title}>Service Notifications</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <BootstrapIcon name="x-lg" size={14} color="#71717A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
            {notifications.map((item) => (
              <View key={item.id} style={[modalStyles.notifRow, item.unread && modalStyles.notifRowUnread]}>
                <View style={modalStyles.notifIconWrap}>
                  <BootstrapIcon name={item.icon} size={14} color="#18181B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.notifTitle}>{item.title}</Text>
                  <Text style={modalStyles.notifDesc}>{item.desc}</Text>
                  <Text style={modalStyles.notifTime}>{item.time}</Text>
                </View>
                {item.unread && <View style={modalStyles.unreadDot} />}
              </View>
            ))}
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.secondaryBtn} onPress={onClose}>
              <Text style={modalStyles.secondaryBtnText}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 3. MOTORCYCLE SELECTION MODAL (STEP 2) ───
export function MotorcycleSelectionModal({
  visible,
  onClose,
  selectedMotorcycleId,
  onSelectMotorcycle,
  onProceedToSchedule,
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.modalCard, { maxWidth: 540 }]}>
          <View style={modalStyles.header}>
            <View>
              <Text style={modalStyles.title}>Select Motorcycle</Text>
              <Text style={modalStyles.subtitle}>
                Labor rates automatically calculate based on engine displacement (CC).
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <BootstrapIcon name="x-lg" size={14} color="#71717A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 10 }}>
              {MOCK_MOTORCYCLES.map((bike) => {
                const isSelected = selectedMotorcycleId === bike.id;
                return (
                  <TouchableOpacity
                    key={bike.id}
                    style={[modalStyles.bikeCard, isSelected && modalStyles.bikeCardActive]}
                    onPress={() => onSelectMotorcycle(bike)}
                    activeOpacity={0.88}
                  >
                    <Image source={{ uri: bike.image }} style={modalStyles.bikeImage} />
                    <View style={{ flex: 1 }}>
                      <Text style={modalStyles.bikeTitle}>{bike.brand} {bike.model}</Text>
                      <Text style={modalStyles.bikeSub}>
                        {bike.plateNumber} • {bike.engineCc}cc displacement
                      </Text>
                      <View style={modalStyles.ccTag}>
                        <Text style={modalStyles.ccTagText}>
                          {bike.engineCc <= 125 ? '125cc and below' : bike.engineCc <= 160 ? '150cc–160cc' : 'Big Bike (200cc+)'}
                        </Text>
                      </View>
                    </View>
                    <View style={[modalStyles.radioCircle, isSelected && modalStyles.radioCircleActive]}>
                      {isSelected && <View style={modalStyles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.secondaryBtn} onPress={onClose}>
              <Text style={modalStyles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.primaryBtn, !selectedMotorcycleId && { opacity: 0.5 }]}
              disabled={!selectedMotorcycleId}
              onPress={onProceedToSchedule}
            >
              <Text style={modalStyles.primaryBtnText}>Continue to Schedule</Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 4. SCHEDULE MODAL (STEP 3) ───
export function ScheduleSelectionModal({
  visible,
  onClose,
  preferredDate,
  setPreferredDate,
  preferredTimeSlot,
  setPreferredTimeSlot,
  onProceedToReview,
}) {
  if (!visible) return null;

  const dates = [
    { label: 'Today', date: '2026-11-04' },
    { label: 'Tomorrow', date: '2026-11-05' },
    { label: 'Friday', date: '2026-11-06' },
    { label: 'Saturday', date: '2026-11-07' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.modalCard, { maxWidth: 520 }]}>
          <View style={modalStyles.header}>
            <View>
              <Text style={modalStyles.title}>Preferred Schedule</Text>
              <Text style={modalStyles.subtitle}>
                Choose your service date and appointment pit bay slot.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <BootstrapIcon name="x-lg" size={14} color="#71717A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
            {/* Preferred Date */}
            <Text style={modalStyles.sectionHeader}>Select Date</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {dates.map((d) => {
                const isSelected = preferredDate === d.date;
                return (
                  <TouchableOpacity
                    key={d.date}
                    style={[modalStyles.dateChip, isSelected && modalStyles.dateChipActive]}
                    onPress={() => setPreferredDate(d.date)}
                  >
                    <Text style={[modalStyles.dateChipLabel, isSelected && modalStyles.dateChipLabelActive]}>
                      {d.label}
                    </Text>
                    <Text style={[modalStyles.dateChipSub, isSelected && { color: '#FFFFFF' }]}>
                      {d.date.slice(5)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time Slots */}
            <Text style={modalStyles.sectionHeader}>Available Time Slots</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TIME_SLOTS.map((slot) => {
                const isSelected = preferredTimeSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[modalStyles.slotChip, isSelected && modalStyles.slotChipActive]}
                    onPress={() => setPreferredTimeSlot(slot)}
                  >
                    <BootstrapIcon
                      name="clock"
                      size={12}
                      color={isSelected ? '#FFFFFF' : '#52525B'}
                    />
                    <Text style={[modalStyles.slotText, isSelected && modalStyles.slotTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.secondaryBtn} onPress={onClose}>
              <Text style={modalStyles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.primaryBtn, (!preferredDate || !preferredTimeSlot) && { opacity: 0.5 }]}
              disabled={!preferredDate || !preferredTimeSlot}
              onPress={onProceedToReview}
            >
              <Text style={modalStyles.primaryBtnText}>Review Booking</Text>
              <BootstrapIcon name="arrow-right" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 5. CONFIRMATION & SUCCESS MODAL (STEP 4) ───
export function BookingConfirmationSuccessModal({
  visible,
  onClose,
  bookingReference = 'BK-PMS-2026-00124',
  selectedPackages = [],
  selectedMotorcycle,
  schedule,
  totalPrice = 0,
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.modalCard, { maxWidth: 520 }]}>
          <View style={{ alignItems: 'center', paddingVertical: 14 }}>
            <View style={modalStyles.successCheckWrap}>
              <BootstrapIcon name="check-lg" size={26} color="#FFFFFF" />
            </View>
            <Text style={[modalStyles.title, { textAlign: 'center', marginTop: 12 }]}>
              Booking Submitted
            </Text>
            <Text style={[modalStyles.subtitle, { textAlign: 'center', maxWidth: 380, marginTop: 4 }]}>
              Your appointment request has been recorded and is currently <Text style={{ fontWeight: '700', color: '#EA580C' }}>Pending Review</Text> by the service manager.
            </Text>
          </View>

          {/* Reference Card */}
          <View style={modalStyles.receiptBox}>
            <View style={modalStyles.receiptRow}>
              <Text style={modalStyles.receiptKey}>Reference Number</Text>
              <Text style={modalStyles.receiptValBold}>{bookingReference}</Text>
            </View>
            <View style={modalStyles.receiptRow}>
              <Text style={modalStyles.receiptKey}>Motorcycle</Text>
              <Text style={modalStyles.receiptVal}>
                {selectedMotorcycle?.brand} {selectedMotorcycle?.model} ({selectedMotorcycle?.engineCc}cc)
              </Text>
            </View>
            <View style={modalStyles.receiptRow}>
              <Text style={modalStyles.receiptKey}>Schedule</Text>
              <Text style={modalStyles.receiptVal}>
                {schedule?.date} at {schedule?.timeSlot}
              </Text>
            </View>
            <View style={modalStyles.receiptRow}>
              <Text style={modalStyles.receiptKey}>Services ({selectedPackages.length})</Text>
              <Text style={modalStyles.receiptVal}>
                {selectedPackages.map((p) => p.name).join(', ')}
              </Text>
            </View>
            <View style={[modalStyles.receiptRow, { borderTopWidth: 1, borderTopColor: '#E4E4E7', paddingTop: 8, marginTop: 4 }]}>
              <Text style={[modalStyles.receiptKey, { fontWeight: '700', color: '#18181B' }]}>Total Amount</Text>
              <Text style={modalStyles.receiptTotal}>{formatPhp(totalPrice)}</Text>
            </View>
          </View>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={[modalStyles.primaryBtn, { flex: 1, justifyContent: 'center' }]} onPress={onClose}>
              <Text style={modalStyles.primaryBtnText}>Return to Services</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181B',
  },
  subtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    cursor: 'pointer',
  },
  body: {
    padding: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    backgroundColor: '#FAFAF9',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
  },
  emptySub: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    maxWidth: 280,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  favImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
  },
  favName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  favSub: {
    fontSize: 11,
    color: '#71717A',
  },
  favPrice: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EA580C',
    marginTop: 2,
  },
  miniSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E2227',
    cursor: 'pointer',
  },
  miniSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  notifRowUnread: {
    backgroundColor: 'rgba(234, 88, 12, 0.03)',
  },
  notifIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  notifDesc: {
    fontSize: 11.5,
    color: '#52525B',
    lineHeight: 16,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10.5,
    color: '#A1A1AA',
    marginTop: 4,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
    marginTop: 4,
  },
  bikeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  bikeCardActive: {
    borderColor: '#EA580C',
    backgroundColor: 'rgba(234, 88, 12, 0.04)',
  },
  bikeImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
  },
  bikeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#18181B',
  },
  bikeSub: {
    fontSize: 11.5,
    color: '#71717A',
  },
  ccTag: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  ccTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#52525B',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D4D4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#EA580C',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EA580C',
  },
  sectionHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#18181B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    cursor: 'pointer',
  },
  dateChipActive: {
    backgroundColor: '#1E2227',
    borderColor: '#1E2227',
  },
  dateChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#18181B',
  },
  dateChipLabelActive: {
    color: '#FFFFFF',
  },
  dateChipSub: {
    fontSize: 10.5,
    color: '#71717A',
    marginTop: 2,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  slotChipActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  slotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#27272A',
  },
  slotTextActive: {
    color: '#FFFFFF',
  },
  successCheckWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptBox: {
    backgroundColor: '#FAFAF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  receiptKey: {
    fontSize: 12,
    color: '#71717A',
  },
  receiptVal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#18181B',
    textAlign: 'right',
  },
  receiptValBold: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EA580C',
    fontVariant: ['tabular-nums'],
  },
  receiptTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EA580C',
    fontVariant: ['tabular-nums'],
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#EA580C',
    cursor: 'pointer',
  },
  primaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    cursor: 'pointer',
  },
  secondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#71717A',
  },
});

