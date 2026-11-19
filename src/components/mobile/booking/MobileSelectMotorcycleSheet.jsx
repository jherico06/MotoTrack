import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, StyleSheet } from 'react-native';
import { BootstrapIcon } from '../../common';

export default function MobileSelectMotorcycleSheet({
  visible = false,
  motorcycles = [],
  selectedMotorcycleId = '',
  isDarkMode = false,
  onSelectMotorcycle,
  onAddNewMotorcycle,
  onClose,
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, isDarkMode && styles.sheetDark]}>
          <View style={styles.headerRow}>
            <View style={[styles.iconBadge, isDarkMode && { backgroundColor: '#3A241B', borderColor: '#EA580C' }]}>
              <BootstrapIcon name="speedometer" size={17} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, isDarkMode && { color: '#F2F2F3' }]}>Select Motorcycle</Text>
              <Text style={[styles.subtitle, isDarkMode && { color: '#A1A1AA' }]}>
                Rates automatically adjust to your bike's engine displacement (CC)
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, isDarkMode && { backgroundColor: '#292B2F' }]}
              onPress={onClose}
            >
              <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? '#D4D4D8' : '#475569'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
            {motorcycles.length === 0 ? (
              <View style={[styles.emptyBox, isDarkMode && { backgroundColor: '#202124', borderColor: '#303236' }]}>
                <BootstrapIcon name="bicycle" size={26} color="#94A3B8" />
                <Text style={[styles.emptyTitle, isDarkMode && { color: '#F2F2F3' }]}>
                  No motorcycles registered yet
                </Text>
                <Text style={[styles.emptySub, isDarkMode && { color: '#A1A1AA' }]}>
                  Add your motorcycle to unlock exact CC service rates and compatibility checks.
                </Text>
              </View>
            ) : (
              motorcycles.map((bike) => {
                const bid = bike.motorcycle_id || bike.id;
                const isSelected = String(bid) === String(selectedMotorcycleId);
                const cc = bike.engine_displacement ?? bike.engine_cc ?? bike.engineCc ?? 150;
                return (
                  <TouchableOpacity
                    key={bid}
                    style={[
                      styles.bikeRow,
                      isDarkMode && styles.bikeRowDark,
                      isSelected && styles.bikeRowSelected,
                    ]}
                    onPress={() => onSelectMotorcycle?.(bike)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.bikeIcon}>
                      <BootstrapIcon name="bicycle" size={18} color={isSelected ? '#FFFFFF' : '#EA580C'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bikeName, isDarkMode && { color: '#F2F2F3' }]}>
                        {bike.year ? `${bike.year} ` : ''}
                        {bike.brand} {bike.model}
                      </Text>
                      <Text style={[styles.bikeMeta, isDarkMode && { color: '#A1A1AA' }]}>
                        {cc} CC {bike.plate_number ? `• ${bike.plate_number}` : ''}
                        {bike.is_primary ? ' • Primary' : ''}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.activePill}>
                        <BootstrapIcon name="check-lg" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              onClose?.();
              onAddNewMotorcycle?.();
            }}
            activeOpacity={0.85}
          >
            <BootstrapIcon name="plus-lg" size={14} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Register New Motorcycle</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  bikeRowDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
  },
  bikeRowSelected: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  bikeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bikeMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activePill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  addBtn: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
