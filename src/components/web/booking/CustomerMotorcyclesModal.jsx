// =========================================================================
// MotoTrack - Customer Motorcycles Selection & Switch Modal
// Clean fleet-garage picker. The chosen motorcycle becomes the customer's
// Primary Ride on confirm, and service package rates recalculate by CC tier.
// =========================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, Platform } from 'react-native';
import { BootstrapIcon } from '../../common';

const C = {
  surface: '#FAF9F6',
  card: '#FFFFFF',
  border: '#E7E5E0',
  divider: '#ECEAE5',
  text: '#18181B',
  muted: '#71717A',
  subtle: '#A1A1AA',
  orange: '#EA580C',
  charcoal: '#1C1917',
};

const MONO = Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'monospace';

function resolveCc(bike) {
  const raw =
    bike?.engine_displacement ??
    bike?.engine_cc ??
    bike?.engineCc ??
    bike?.cc ??
    (String(bike?.model || '').match(/\b(\d{2,4})\b/)?.[1] || 0);
  return parseInt(raw, 10) || 0;
}

function getTier(cc) {
  if (cc <= 125) {
    return { label: '125cc and below', bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8' };
  }
  if (cc < 200) {
    return { label: '150cc–160cc Tier', bg: '#FFF7ED', border: '#FED7AA', fg: '#C2410C' };
  }
  return { label: 'Big Bikes 200cc+', bg: '#F5F3FF', border: '#DDD6FE', fg: '#6D28D9' };
}

const inputStyle = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 8,
  fontSize: 13,
  color: C.text,
};

const labelStyle = {
  fontSize: 10.5,
  fontWeight: '600',
  color: C.muted,
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

export default function CustomerMotorcyclesModal({
  visible,
  onClose,
  motorcycles = [],
  selectedMotorcycleId,
  onSelectMotorcycle,
  onAddNewMotorcycle,
}) {
  const [pendingId, setPendingId] = useState(selectedMotorcycleId);
  const [isConfirming, setIsConfirming] = useState(false);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newBrand, setNewBrand] = useState('Honda');
  const [newModel, setNewModel] = useState('');
  const [newCc, setNewCc] = useState('160');
  const [newPlate, setNewPlate] = useState('');
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Reset the staged selection every time the modal opens
  useEffect(() => {
    if (visible) {
      setPendingId(selectedMotorcycleId);
      setIsAddingNew(false);
      setFormError('');
    }
  }, [visible, selectedMotorcycleId]);

  if (!visible) return null;

  const pendingBike = motorcycles.find((m) => String(m.motorcycle_id || m.id) === String(pendingId));

  const handleConfirm = async () => {
    if (!pendingBike) return;
    if (String(pendingId) === String(selectedMotorcycleId)) {
      onClose?.();
      return;
    }
    setIsConfirming(true);
    try {
      await onSelectMotorcycle?.(pendingBike);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSaveNewBike = async () => {
    if (!newModel.trim()) {
      setFormError('Please enter a motorcycle model.');
      return;
    }
    const parsedCc = parseInt(newCc, 10);
    if (!parsedCc || parsedCc <= 0) {
      setFormError('Please enter a valid engine displacement (CC).');
      return;
    }
    setFormError('');
    setIsSaving(true);
    try {
      await onAddNewMotorcycle?.({
        brand: newBrand.trim(),
        model: newModel.trim(),
        engine_cc: parsedCc,
        plate_number: newPlate.trim().toUpperCase() || 'TEMP-PLATE',
        year: parseInt(newYear, 10) || new Date().getFullYear(),
        is_primary: true,
      });
      setIsAddingNew(false);
      setNewModel('');
      setNewPlate('');
    } catch (err) {
      setFormError(err?.message || 'Failed to save motorcycle.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(12, 10, 9, 0.72)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(3px)' } : {}),
        }}
      >
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 20,
            width: '100%',
            maxWidth: 540,
            maxHeight: '92%',
            overflow: 'hidden',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.25,
            shadowRadius: 32,
            elevation: 12,
          }}
        >
          {/* ─── HEADER ─── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 26,
              paddingTop: 22,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: C.divider,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FFF7ED',
                borderWidth: 1,
                borderColor: '#FED7AA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BootstrapIcon name="speedometer2" size={16} color={C.orange} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 19, fontWeight: '600', color: C.text, letterSpacing: -0.3 }}>
                  Select Motorcycle
                </Text>
                <View style={{ backgroundColor: '#EFEDE8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '600', color: C.muted, letterSpacing: 0.6 }}>
                    FLEET GARAGE
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.card,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <BootstrapIcon name="x-lg" size={11} color={C.muted} />
            </TouchableOpacity>
          </View>

          {/* ─── BODY ─── */}
          <ScrollView
            style={{ maxHeight: 460 }}
            contentContainerStyle={{ paddingHorizontal: 26, paddingVertical: 24, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {motorcycles.length === 0 && (
              <View
                style={{
                  padding: 24,
                  alignItems: 'center',
                  backgroundColor: C.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: C.border,
                  gap: 6,
                }}
              >
                <BootstrapIcon name="bicycle" size={26} color={C.subtle} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>No motorcycles registered yet</Text>
                <Text style={{ fontSize: 12.5, color: C.muted, textAlign: 'center' }}>
                  Register your motorcycle below to get rates calculated for its engine CC.
                </Text>
              </View>
            )}

            {motorcycles.map((bike) => {
              const bikeId = bike.motorcycle_id || bike.id;
              const isActive = String(bikeId) === String(pendingId);
              const isPrimary = Boolean(bike.is_primary);
              const cc = resolveCc(bike);
              const tier = getTier(cc);

              return (
                <TouchableOpacity
                  key={bikeId}
                  onPress={() => setPendingId(bikeId)}
                  activeOpacity={0.9}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    backgroundColor: C.card,
                    borderRadius: 14,
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isActive ? C.orange : C.border,
                    paddingVertical: 18,
                    paddingRight: 16,
                    paddingLeft: 18,
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  {/* Left accent bar for the active card */}
                  {isActive && (
                    <View
                      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.orange }}
                    />
                  )}

                  {/* Bike icon tile */}
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      backgroundColor: isActive ? C.orange : '#F4F4F5',
                      borderWidth: isActive ? 0 : 1,
                      borderColor: C.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BootstrapIcon name="bicycle" size={19} color={isActive ? '#FFFFFF' : '#52525B'} />
                  </View>

                  {/* Details */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.text }} numberOfLines={1}>
                        {bike.brand} {bike.model}
                      </Text>
                      {isPrimary && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#ECFDF5',
                            borderWidth: 1,
                            borderColor: '#A7F3D0',
                            paddingHorizontal: 7,
                            paddingVertical: 1.5,
                            borderRadius: 999,
                          }}
                        >
                          <BootstrapIcon name="star-fill" size={8} color="#059669" />
                          <Text style={{ fontSize: 10.5, fontWeight: '500', color: '#047857' }}>Primary Ride</Text>
                        </View>
                      )}
                      {Boolean(bike.nickname) && (
                        <View
                          style={{
                            backgroundColor: '#F4F4F5',
                            borderWidth: 1,
                            borderColor: C.border,
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ fontSize: 10, color: C.subtle }}>“{bike.nickname}”</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7, flexWrap: 'wrap' }}>
                      <View
                        style={{
                          backgroundColor: tier.bg,
                          borderWidth: 1,
                          borderColor: tier.border,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '500', color: tier.fg, fontVariant: ['tabular-nums'] }}>
                          {cc} CC • {tier.label}
                        </Text>
                      </View>
                      {Boolean(bike.plate_number) && (
                        <Text style={{ fontSize: 11, color: C.muted, fontFamily: MONO }}>
                          Plate: <Text style={{ fontWeight: '700', color: C.text, fontFamily: MONO }}>{bike.plate_number}</Text>
                        </Text>
                      )}
                    </View>

                    {Boolean(bike.year) && (
                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Model: {bike.year}</Text>
                    )}
                  </View>

                  {/* Action */}
                  {isActive ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: C.orange,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 8,
                      }}
                    >
                      <BootstrapIcon name="check-lg" size={11} color="#FFFFFF" />
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#FFFFFF' }}>Active Selection</Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: C.card,
                        borderWidth: 1,
                        borderColor: '#D4D4D8',
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '500', color: C.text }}>Select & Use Rates</Text>
                      <BootstrapIcon name="arrow-right" size={11} color={C.muted} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* ─── REGISTER ANOTHER MOTORCYCLE ─── */}
            {!isAddingNew ? (
              <TouchableOpacity
                onPress={() => setIsAddingNew(true)}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 15,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: '#D4D4D8',
                  cursor: 'pointer',
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#FDBA74',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="plus" size={14} color={C.orange} />
                </View>
                <Text style={{ fontSize: 12.5, fontWeight: '500', color: C.text }}>Register Another Motorcycle to Fleet</Text>
                <Text style={{ fontSize: 11, color: C.subtle }}>(Saved as your Primary Ride)</Text>
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  backgroundColor: C.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: C.border,
                  padding: 18,
                  gap: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.text }}>Register New Motorcycle</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsAddingNew(false);
                      setFormError('');
                    }}
                  >
                    <Text style={{ fontSize: 12, color: C.muted, fontWeight: '500' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                {Boolean(formError) && (
                  <View style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontSize: 12, color: '#DC2626' }}>{formError}</Text>
                  </View>
                )}

                <View>
                  <Text style={labelStyle}>Brand</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {['Honda', 'Yamaha', 'Kawasaki', 'Suzuki'].map((b) => (
                      <TouchableOpacity
                        key={b}
                        onPress={() => setNewBrand(b)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: newBrand === b ? C.charcoal : C.card,
                          borderWidth: 1,
                          borderColor: newBrand === b ? C.charcoal : C.border,
                        }}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '500', color: newBrand === b ? '#FFFFFF' : C.text }}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={labelStyle}>Model</Text>
                    <TextInput
                      value={newModel}
                      onChangeText={setNewModel}
                      placeholder="e.g. Smash 125"
                      placeholderTextColor={C.subtle}
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Engine CC</Text>
                    <TextInput
                      value={newCc}
                      onChangeText={setNewCc}
                      keyboardType="numeric"
                      placeholder="160"
                      placeholderTextColor={C.subtle}
                      style={[inputStyle, { fontVariant: ['tabular-nums'] }]}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={labelStyle}>Plate Number</Text>
                    <TextInput
                      value={newPlate}
                      onChangeText={setNewPlate}
                      autoCapitalize="characters"
                      placeholder="e.g. NPC-143431"
                      placeholderTextColor={C.subtle}
                      style={inputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={labelStyle}>Year</Text>
                    <TextInput
                      value={newYear}
                      onChangeText={setNewYear}
                      keyboardType="numeric"
                      placeholderTextColor={C.subtle}
                      style={[inputStyle, { fontVariant: ['tabular-nums'] }]}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSaveNewBike}
                  disabled={isSaving}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: C.charcoal,
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                    opacity: isSaving ? 0.7 : 1,
                    cursor: 'pointer',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' }}>
                    {isSaving ? 'Saving…' : 'Save & Set as Primary'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* ─── FOOTER ─── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              paddingHorizontal: 26,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: C.divider,
              backgroundColor: C.card,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: '#F4F4F5',
                cursor: 'pointer',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '500', color: C.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!pendingBike || isConfirming}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: C.charcoal,
                opacity: !pendingBike || isConfirming ? 0.6 : 1,
                cursor: 'pointer',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                {isConfirming ? 'Applying…' : 'Confirm Selection'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
