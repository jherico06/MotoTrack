// =========================================================================
// MotoTrack Customer Booking - Screen 3: Select Motorcycle
// Cards for registered motorcycles with displacement, plate, and Add option
// Automatic CC-based package price calculation
// =========================================================================

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, useWindowDimensions } from 'react-native';
import { BootstrapIcon } from '../../common';
import { packageBookingStyles as styles } from '../../../styles/web/packageBooking.web.styles.js';
import { MOTORCYCLE_PHOTO_PRESETS, motorcycleService } from '../../../services/products/motorcycleService.js';
import { calculatePackagePriceForCc } from './bookingPackagesData.js';

// Shop pin location (triangulated from the Street View storefront frames)
const SHOP_LAT = 10.20672;
const SHOP_LNG = 123.75685;

export default function MotorcycleSelectionScreen({
  motorcycles = [],
  garageMotorcycles = [],
  selectedMotorcycleId,
  onSelectMotorcycle,
  onAddNewMotorcycle: _onAddNewMotorcycle,
  selectedPackages = [],
  onBack,
  onContinue,
  currentUser,
  onNavigateToLogin,
}) {
  const availableMotorcycles = useMemo(() => {
    if (Array.isArray(motorcycles) && motorcycles.length > 0) return motorcycles;
    if (Array.isArray(garageMotorcycles) && garageMotorcycles.length > 0) return garageMotorcycles;
    return [];
  }, [motorcycles, garageMotorcycles]);

  const selectedMoto = useMemo(() => {
    return availableMotorcycles.find(
      (m) => (m.motorcycle_id || m.id) === selectedMotorcycleId
    );
  }, [availableMotorcycles, selectedMotorcycleId]);

  const livePricingData = useMemo(() => {
    if (!selectedMoto) return null;
    const rawCc =
      selectedMoto.engine_displacement ??
      selectedMoto.engine_cc ??
      selectedMoto.engineCc ??
      selectedMoto.cc;
    const engineCc = parseInt(rawCc, 10) || 150;
    const items = selectedPackages.map((pkg) => {
      const calc = calculatePackagePriceForCc(pkg, engineCc);
      return {
        pkg,
        price: calc?.price ?? 0,
        tierLabel: calc?.tierLabel || `${engineCc}cc`,
        isAvailable: calc?.isAvailable !== false,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const downpayment = Math.round(subtotal * 0.2);

    let tierLabel = '125cc and below';
    let tierId = 'cc-125-below';
    if (engineCc > 160) {
      tierLabel = 'Big Bikes (200cc+)';
      tierId = 'cc-big-bikes';
    } else if (engineCc > 125) {
      tierLabel = '150cc–160cc';
      tierId = 'cc-150-160';
    }

    return {
      engineCc,
      tierLabel,
      tierId,
      items,
      subtotal,
      downpayment,
      balance: subtotal - downpayment,
      matchedCategory: tierLabel,
    };
  }, [selectedMoto, selectedPackages]);

  const [mapMode, setMapMode] = useState('street'); // 'street' | 'satellite' | 'map'
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 960;

  const googleStreetViewUrl =
    'https://www.google.com/maps/@10.2066654,123.7569248,3a,75y,310h,90t/data=!3m6!1e1!3m4!1s1lF1W3G6qtLGnhLCbeyNKw!2e0!7i16384!8i8192';

  const googleStreetViewEmbedUrl =
    'https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1s1lF1W3G6qtLGnhLCbeyNKw!2m2!1d10.2066654!2d123.7569248!3f310!4f0!5f0.78';

  const satelliteMapHtml = useMemo(() => {
    const lat = SHOP_LAT;
    const lng = SHOP_LNG;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0F172A; }
    .shop-pin {
      background: #EA580C;
      border: 3px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      width: 36px;
      height: 36px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
      cursor: pointer;
    }
    .shop-pin-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FFFFFF;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 19);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);

    var pin = L.divIcon({
      className: '',
      html: '<div style="position:relative;width:36px;height:36px;"><div class="shop-pin" title="D\\'Blockchain Motorparts"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44]
    });

    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map)
      .bindPopup("<b>D'Blockchain Motorparts</b><br/>109 Natalio B. Bacalso S National Hwy, Naga<br/><span style='color:#EA580C;font-size:11px;font-weight:700;'>📍 Official Service Pit Bays</span>")
      .openPopup();
  </script>
</body>
</html>`;
  }, []);

  const roadMapHtml = useMemo(() => {
    const lat = SHOP_LAT;
    const lng = SHOP_LNG;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F8FAFC; }
    .shop-pin {
      background: #EA580C;
      border: 3px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      width: 36px;
      height: 36px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
      cursor: pointer;
    }
    .shop-pin-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #FFFFFF;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var pin = L.divIcon({
      className: '',
      html: '<div style="position:relative;width:36px;height:36px;"><div class="shop-pin" title="D\\'Blockchain Motorparts"><div class="shop-pin-dot"></div></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44]
    });

    L.marker([${lat}, ${lng}], { icon: pin }).addTo(map)
      .bindPopup("<b>D'Blockchain Motorparts</b><br/>109 Natalio B. Bacalso S National Hwy, Naga")
      .openPopup();
  </script>
</body>
</html>`;
  }, []);

  const handleSelect = (moto) => {
    const id = moto.motorcycle_id || moto.id;
    onSelectMotorcycle?.(id);
  };

  return (
    <View>
      <View style={{ marginBottom: 28, alignItems: 'center', textAlign: 'center' }}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Select Your Motorcycle</Text>
        <Text style={[styles.pageSubtitle, { textAlign: 'center', maxWidth: 640 }]}>
          Choose the motorcycle receiving the service. Displacement (CC) determines the exact package rate.
        </Text>
      </View>

      {/* ─── GUEST USER WARNING / SIGN IN PROMPT ─── */}
      {!currentUser && (
        <View
          style={{
            backgroundColor: '#FFF7ED',
            borderWidth: 1,
            borderColor: '#FFEDD5',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <BootstrapIcon name="person-circle" size={24} color="#EA580C" />
            <View>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#9A3412' }}>
                Sign in to view your registered garage fleet
              </Text>
              <Text style={{ fontSize: 12, color: '#C2410C', marginTop: 2 }}>
                Save your motorcycle details, track appointment history, and receive status updates.
              </Text>
            </View>
          </View>
          {onNavigateToLogin && (
            <TouchableOpacity
              style={{
                backgroundColor: '#1E2227',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onPress={onNavigateToLogin}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ─── MOTORCYCLE CARDS GRID ─── */}
      <View style={styles.motorcycleGrid}>
        {availableMotorcycles.map((moto) => {
          const mId = moto.motorcycle_id || moto.id;
          const isSelected = mId === selectedMotorcycleId;
          const rawCc =
            moto.engine_displacement ??
            moto.engine_cc ??
            moto.engineCc ??
            moto.cc;
          const ccValue = parseInt(rawCc, 10) || '150';
          const isPrimary = Boolean(moto.is_primary);
          const plateVal = moto.plate_number || moto.plate || 'No Plate';
          const brandModel = `${moto.brand || 'Motorcycle'} ${moto.model || ''}`.trim();

          // Photo lookup fallback
          let photoUrl = moto.photo_url || moto.photo;
          if (!photoUrl) {
            const foundPreset = MOTORCYCLE_PHOTO_PRESETS.find(
              (p) => p.brand.toLowerCase() === String(moto.brand || '').toLowerCase()
            );
            photoUrl = foundPreset?.url || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80';
          }

          return (
            <TouchableOpacity
              key={mId}
              style={[
                styles.motoCard,
                isSelected && styles.motoCardSelected,
                isSelected && { borderColor: '#1E2227' },
              ]}
              onPress={() => handleSelect(moto)}
              activeOpacity={0.88}
            >
              <View style={styles.motoCardHeader}>
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.motoThumbnail}
                  resizeMode="cover"
                />
                <View style={styles.motoDetails}>
                  <Text style={styles.motoBrandModel} numberOfLines={1}>
                    {brandModel}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={styles.motoCcBadge}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E293B' }}>
                        {ccValue} CC
                      </Text>
                    </View>
                    {isPrimary ? (
                      <View style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <BootstrapIcon name="star-fill" size={9} color="#16A34A" />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#166534' }}>Primary</Text>
                      </View>
                    ) : currentUser ? (
                      <TouchableOpacity
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          backgroundColor: '#F8FAFC',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                        }}
                        onPress={async (e) => {
                          e?.stopPropagation?.();
                          try {
                            await motorcycleService.setPrimaryMotorcycle(mId, currentUser?.id || currentUser?.user_id);
                            handleSelect(moto);
                          } catch (_e) {}
                        }}
                        activeOpacity={0.7}
                      >
                        <BootstrapIcon name="star" size={9} color="#64748B" />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#475569' }}>Set Primary</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                {isSelected && (
                  <View style={{ backgroundColor: '#1E2227', borderRadius: 12, padding: 3 }}>
                    <BootstrapIcon name="check-lg" size={14} color="#FFFFFF" />
                  </View>
                )}
              </View>

              <View style={styles.motoPlateRow}>
                <Text style={styles.motoPlateLabel}>Plate Number</Text>
                <Text style={styles.motoPlateNumber}>{plateVal}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.motoSelectBtn,
                  isSelected && styles.motoSelectBtnActive,
                  isSelected && { backgroundColor: '#1E2227' },
                ]}
                onPress={() => handleSelect(moto)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.motoSelectBtnText,
                    isSelected && styles.motoSelectBtnTextActive,
                  ]}
                >
                  {isSelected ? '✓ Selected Motorcycle' : 'Select Motorcycle'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {availableMotorcycles.length === 0 && (
          <View
            style={{
              padding: 32,
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E4E4E7',
            }}
          >
            <BootstrapIcon name="bicycle" size={32} color="#94A3B8" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B', marginTop: 12 }}>
              No Motorcycles Found in Garage
            </Text>
            <Text style={{ fontSize: 13, color: '#71717A', marginTop: 4, textAlign: 'center', maxWidth: 360 }}>
              Please add your motorcycle in your MotoTrack Garage to select it for booking.
            </Text>
          </View>
        )}
      </View>

      {/* ─── WORKSHOP LOCATION & STREET VIEW CARD (MATCHING REFERENCE UI) ─── */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: '#F3E8D6',
          padding: isDesktop ? 28 : 20,
          marginTop: 24,
          marginBottom: 20,
          shadowColor: '#78350F',
          shadowOpacity: 0.04,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View
          style={{
            flexDirection: isDesktop ? 'row' : 'column',
            gap: isDesktop ? 28 : 20,
            alignItems: 'stretch',
          }}
        >
          {/* ── LEFT COLUMN: WORKSHOP DETAILS, HOURS, GPS & ALTITUDE ── */}
          <View
            style={{
              flex: isDesktop ? 0.44 : undefined,
              width: isDesktop ? undefined : '100%',
              justifyContent: 'space-between',
            }}
          >
            <View>
              {/* Workshop Title */}
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '600',
                  color: '#18181B',
                  letterSpacing: -0.3,
                }}
              >
                D'Blockchain Motorparts & Accessories
              </Text>

              {/* Address */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, marginBottom: 16 }}>
                <View style={{ marginTop: 2 }}>
                  <BootstrapIcon name="geo-alt-fill" size={13} color="#EF4444" />
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: '#3F3F46', lineHeight: 19 }}>
                  109 Natalio B. Bacalso S National Hwy, City of Naga, Cebu, 6037
                </Text>
              </View>

              {/* Information Box */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#EFECE6',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                }}
              >
                {[
                  {
                    key: 'hours',
                    icon: 'clock',
                    label: 'Operating Hours',
                    lines: ['Mon – Sat, 8:00 AM – 7:00 PM', 'Closed on Sundays'],
                  },
                  {
                    key: 'contact',
                    icon: 'telephone',
                    label: 'Contact',
                    lines: ['+63 961 490 4841', 'support@mototrack.ph'],
                  },
                  {
                    key: 'landmark',
                    icon: 'cursor',
                    label: 'Landmark',
                    lines: ["Beside Jerome's Gadget & Millenium", 'Natalio Bacalso Hwy, South Poblacion'],
                  },
                ].map((row, index, all) => (
                  <View
                    key={row.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: index === all.length - 1 ? 0 : 1,
                      borderBottomColor: '#F4F4F5',
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: '#FFF7ED',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BootstrapIcon name={row.icon} size={13} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: '#A1A1AA', letterSpacing: 0.3 }}>
                        {row.label}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#18181B', marginTop: 2 }}>
                        {row.lines[0]}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#71717A', marginTop: 1 }}>{row.lines[1]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Bottom Full-Width Action Button */}
            <TouchableOpacity
              style={{
                backgroundColor: '#1E2227',
                borderRadius: 12,
                paddingVertical: 13,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 18,
                shadowColor: '#000000',
                shadowOpacity: 0.12,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              }}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open(googleStreetViewUrl, '_blank', 'noopener,noreferrer');
                } else {
                  Linking.openURL(googleStreetViewUrl).catch(() => {});
                }
              }}
              activeOpacity={0.88}
            >
              <BootstrapIcon name="geo-alt-fill" size={14} color="#EF4444" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13.5 }}>
                Open in Google Maps App
              </Text>
              <BootstrapIcon name="box-arrow-up-right" size={11} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {/* ── RIGHT COLUMN: STREET VIEW & MAP VIEWER ── */}
          <View style={{ flex: isDesktop ? 0.56 : undefined, width: isDesktop ? undefined : '100%' }}>
            {/* Header Row: Title & Segmented Tabs */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="compass" size={15} color="#D97706" />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#78350F' }}>
                  Workshop Street View & Map
                </Text>
              </View>

              {/* Segmented Tabs: Street View | Roadmap | Satellite */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: '#F5F5F4',
                  padding: 3,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E7E5E4',
                }}
              >
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: mapMode === 'street' ? '#1E2227' : 'transparent',
                  }}
                  onPress={() => setMapMode('street')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="camera-video-fill"
                    size={11}
                    color={mapMode === 'street' ? '#FFFFFF' : '#71717A'}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: mapMode === 'street' ? '#FFFFFF' : '#57534E',
                    }}
                  >
                    Street View
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: mapMode === 'map' ? '#1E2227' : 'transparent',
                  }}
                  onPress={() => setMapMode('map')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="map"
                    size={11}
                    color={mapMode === 'map' ? '#FFFFFF' : '#71717A'}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: mapMode === 'map' ? '#FFFFFF' : '#57534E',
                    }}
                  >
                    Roadmap
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: mapMode === 'satellite' ? '#1E2227' : 'transparent',
                  }}
                  onPress={() => setMapMode('satellite')}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon
                    name="globe"
                    size={11}
                    color={mapMode === 'satellite' ? '#FFFFFF' : '#71717A'}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '700',
                      color: mapMode === 'satellite' ? '#FFFFFF' : '#57534E',
                    }}
                  >
                    Satellite
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Viewport Frame */}
            <View
              style={{
                width: '100%',
                height: 390,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#E4E4E7',
                backgroundColor: '#0F172A',
                position: 'relative',
              }}
            >
              {mapMode === 'street' ? (
                <iframe
                  title="D'Blockchain Motorparts & Accessories - Google Street View"
                  src={googleStreetViewEmbedUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0,
                    display: 'block',
                  }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : mapMode === 'map' ? (
                <iframe
                  title="MotoTrack Service Workshop - Roadmap View"
                  srcDoc={roadMapHtml}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0,
                    display: 'block',
                  }}
                  loading="lazy"
                />
              ) : (
                <iframe
                  title="MotoTrack Service Workshop - Satellite View"
                  srcDoc={satelliteMapHtml}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 0,
                    display: 'block',
                  }}
                  loading="lazy"
                />
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ─── NAVIGATION BUTTONS ─── */}
      <View style={styles.navButtonsRow}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: '#1E2227' }]}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <BootstrapIcon name="arrow-left" size={14} color="#1E2227" />
          <Text style={[styles.backBtnText, { color: '#1E2227' }]}>Back to Packages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: '#1E2227' },
            !selectedMotorcycleId && styles.primaryBtnDisabled,
          ]}
          disabled={!selectedMotorcycleId}
          onPress={() => onContinue?.(livePricingData)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Next: Schedule Appointment</Text>
          <BootstrapIcon name="arrow-right" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
