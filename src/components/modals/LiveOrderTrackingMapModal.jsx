import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  TextInput,
  Linking,
} from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';

// Route Waypoints focused across City of Naga, Cebu, Philippines
const ROUTE_WAYPOINTS = [
  { x: 14, y: 82, label: 'MotoTrack Hub (East Poblacion, Naga City)' },
  { x: 28, y: 70, label: 'Naga Boardwalk & Baywalk Coastal Highway' },
  { x: 42, y: 54, label: 'Cebu South Road & Toledo Junction' },
  { x: 56, y: 45, label: 'Inoburan Barangay Road' },
  { x: 72, y: 34, label: 'Avocado Street Corridor' },
  { x: 86, y: 22, label: 'Purok Avocado 4, Inoburan, City of Naga' },
];

export function formatPHPhone(phone, masked = true) {
  if (!phone) return '(+63)96******41';
  const cleaned = phone.replace(/[^0-9]/g, '');
  let standard10 = '';
  
  if (cleaned.startsWith('639') && cleaned.length >= 12) {
    standard10 = cleaned.slice(2);
  } else if (cleaned.startsWith('09') && cleaned.length >= 11) {
    standard10 = cleaned.slice(1);
  } else if (cleaned.startsWith('9') && cleaned.length >= 10) {
    standard10 = cleaned;
  } else {
    return phone.includes('(+63)') ? phone : `(+63) ${phone}`;
  }

  if (masked) {
    const prefix2 = standard10.slice(0, 2);
    const last2 = standard10.slice(-2);
    return `(+63)${prefix2}******${last2}`;
  } else {
    return `(+63) ${standard10.slice(0, 3)} ${standard10.slice(3, 6)} ${standard10.slice(6)}`;
  }
}

export default function LiveOrderTrackingMapModal({
  visible,
  order,
  onClose,
  showToast = () => {},
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Map Animation & View State
  const [progress, setProgress] = useState(0.45); // 0 to 1
  const [isPlaying, setIsPlaying] = useState(true);
  const [showLiveMapDrawer, setShowLiveMapDrawer] = useState(true); // Open by default for instant Google Map experience
  const [mapMode, setMapMode] = useState('google'); // 'google' | 'satellite' | 'simulation'
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  
  // Interactive Rider Chat State
  const [chatMessages, setChatMessages] = useState([
    { id: 'msg-1', sender: 'rider', text: 'Hi! I picked up your motorcycle parts from the MotoTrack warehouse. On my way now!', time: '10:15 AM' },
    { id: 'msg-2', sender: 'rider', text: 'Traffic is light on the expressway, estimated arrival in ~15 mins.', time: '10:18 AM' },
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [isCallingRider, setIsCallingRider] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [customAddress, setCustomAddress] = useState('');

  // Rider & Vehicle Profile
  const riderInfo = {
    name: 'Marco Valerio',
    phone: '+63 (917) 582-9410',
    vehicle: 'Yamaha NMAX 155 (Black Edition)',
    plateNumber: 'NMX-4892',
    rating: 4.95,
    totalDeliveries: 428,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  };

  // Interpolate rider coordinates based on progress (0 to 1)
  const calculateRiderPosition = (p) => {
    const totalSegments = ROUTE_WAYPOINTS.length - 1;
    const scaled = Math.min(Math.max(p, 0), 1) * totalSegments;
    const index = Math.floor(scaled);
    const remainder = scaled - index;

    if (index >= totalSegments) {
      const last = ROUTE_WAYPOINTS[totalSegments];
      return { x: last.x, y: last.y, currentLeg: last.label };
    }

    const p1 = ROUTE_WAYPOINTS[index];
    const p2 = ROUTE_WAYPOINTS[index + 1];

    const currentX = p1.x + (p2.x - p1.x) * remainder;
    const currentY = p1.y + (p2.y - p1.y) * remainder;

    return {
      x: currentX,
      y: currentY,
      currentLeg: p2.label,
    };
  };

  const riderPos = calculateRiderPosition(progress);

  // Live GPS movement ticker
  useEffect(() => {
    let interval;
    if (visible && isPlaying && showLiveMapDrawer) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 1) return 0.05; // Loop back
          return Number((prev + 0.015).toFixed(3));
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, isPlaying, showLiveMapDrawer]);

  useEffect(() => {
    if (order?.customer_address) {
      setCustomAddress(order.customer_address);
    }
  }, [order?.customer_address]);

  // Dynamic arrival estimate (Unconditionally called before any return)
  const arrivalRangeText = useMemo(() => {
    if (!order) return 'Arriving in 2-4 days';
    if (order.estimated_delivery) return order.estimated_delivery;
    const d = new Date();
    const d1 = new Date(d.getTime() + 2 * 24 * 3600 * 1000);
    const d2 = new Date(d.getTime() + 4 * 24 * 3600 * 1000);
    const opt = { month: 'short', day: 'numeric' };
    return `Arriving ${d1.toLocaleDateString('en-US', opt)} - ${d2.toLocaleDateString('en-US', opt)}`;
  }, [order]);

  if (!order) return null;

  const isCOD = (order.payment_method || '').toLowerCase().includes('cash') || (order.payment_method || '').includes('COD');
  const isGCash = (order.payment_method || '').toLowerCase().includes('gcash');

  // Determine active step index (0: Order placed, 1: Waiting for courier, 2: In transit, 3: Order delivered)
  const getStepIndex = () => {
    const st = (order.status || 'Processing').toLowerCase();
    if (st.includes('pending') || st.includes('approval')) return 0;
    if (st === 'processing') return 1;
    if (st === 'shipped') return 2;
    if (st === 'delivered') return 3;
    return 0;
  };

  const stepIndex = getStepIndex();

  const STEPS = [
    { label: 'Order placed', key: 'step-0' },
    { label: isCOD ? 'Approval / Packing' : 'Waiting for courier', key: 'step-1' },
    { label: 'In transit', key: 'step-2' },
    { label: 'Order delivered', key: 'step-3' },
  ];

  const etaMinutes = Math.max(1, Math.round((1 - progress) * 22));
  const distanceKm = ((1 - progress) * 5.6).toFixed(1);
  const currentSpeed = isPlaying && progress < 1 ? Math.floor(32 + Math.random() * 12) : 0;

  const handleCopyOrderNumber = () => {
    const num = order.order_id || order.id || '585705280479659997';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(num);
      }
    } catch (e) {}
    showToast(`Copied order number: ${num}`);
  };

  const handleOpenGoogleMapsApp = () => {
    const addr = customAddress || order.customer_address || 'Purok Avocado 4, Inoburan, City of Naga, Cebu, Philippines';
    const query = encodeURIComponent(addr);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
    showToast('Opening Google Maps...');
  };

  const grandTotalValue = Number(order.grand_total || order.total_amount || 0).toFixed(2);
  const subtotalValue = Number(order.total_amount || order.grand_total || 0).toFixed(2);
  const discountValue = Number(order.discount_amount || 0).toFixed(2);
  const deliveryAddressStr = customAddress || order.customer_address || 'Purok Avocado 4 Inoburan, City of Naga, Cebu, Inoburan, Naga City, Cebu, Philippines';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, isDesktop && styles.modalContainerDesktop]}>

          {/* ─── 1. TOP HEADER ─── */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <BootstrapIcon name="x-lg" size={15} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerMainTitle}>
                {stepIndex === 0 ? 'Order placed' : stepIndex === 1 ? 'Waiting for courier' : stepIndex === 2 ? 'In transit' : 'Order delivered'}
              </Text>
              <Text style={styles.headerSubtitleText}>
                {arrivalRangeText}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerGpsBtn}
              onPress={() => setShowLiveMapDrawer(!showLiveMapDrawer)}
              activeOpacity={0.8}
            >
              <BootstrapIcon name={showLiveMapDrawer ? 'receipt' : 'compass'} size={14} color="#0C6258" />
              <Text style={styles.headerGpsBtnText}>{showLiveMapDrawer ? 'Details' : 'Google Map'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* ─── 2. FOUR-STAGE TIMELINE PROGRESS STEPPER ─── */}
            <View style={styles.stepperCard}>
              <View style={styles.stepperTrackRow}>
                {/* Background Connecting Line */}
                <View style={styles.stepperConnectingLineBackground} />
                
                {/* Active Filled Progress Line */}
                <View
                  style={[
                    styles.stepperConnectingLineActive,
                    {
                      width: `${(stepIndex / (STEPS.length - 1)) * 100}%`,
                    },
                  ]}
                />

                {/* Nodes */}
                {STEPS.map((s, idx) => {
                  const isPassedOrCurrent = idx <= stepIndex;
                  const isCurrent = idx === stepIndex;

                  return (
                    <View key={s.key} style={styles.stepNodeContainer}>
                      {isCurrent ? (
                        <View style={styles.activeStepCircle}>
                          <BootstrapIcon name="box-seam-fill" size={13} color="#FFFFFF" />
                        </View>
                      ) : isPassedOrCurrent ? (
                        <View style={styles.completedStepDot}>
                          <BootstrapIcon name="check" size={11} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.pendingStepDot} />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Step Labels */}
              <View style={styles.stepLabelsRow}>
                {STEPS.map((s, idx) => {
                  const isCurrent = idx === stepIndex;
                  const isPassed = idx < stepIndex;

                  return (
                    <Text
                      key={`label-${s.key}`}
                      style={[
                        styles.stepLabelText,
                        isCurrent && styles.stepLabelTextActive,
                        isPassed && styles.stepLabelTextCompleted,
                      ]}
                      numberOfLines={2}
                    >
                      {s.label}
                    </Text>
                  );
                })}
              </View>
            </View>

            {/* ─── 3. GUARANTEED ON-TIME DELIVERY BANNER ─── */}
            <View style={styles.guaranteeBanner}>
              <View style={styles.guaranteeIconWrap}>
                <BootstrapIcon name="clock-history" size={17} color="#0C6258" />
              </View>
              <Text style={styles.guaranteeText}>
                <Text style={{ fontWeight: '800', color: '#0C6258' }}>Guaranteed On-Time Delivery</Text> assures that a delivery will be attempted by {arrivalRangeText.replace('Arriving ', '')}. Get a coupon if your order arrives late.
              </Text>
            </View>

            {/* ─── 4. REAL GOOGLE MAP / GPS TRACKING DRAWER ─── */}
            {showLiveMapDrawer && (
              <View style={styles.googleMapSectionCard}>
                {/* Google Map Mode Toolbar */}
                <View style={styles.mapToolbarRow}>
                  <View style={styles.mapModePills}>
                    <TouchableOpacity
                      style={[styles.mapModePill, mapMode === 'google' && styles.mapModePillActive]}
                      onPress={() => setMapMode('google')}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="map" size={12} color={mapMode === 'google' ? '#0C6258' : '#64748B'} />
                      <Text style={[styles.mapModePillText, mapMode === 'google' && styles.mapModePillTextActive]}>
                        Google Map
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.mapModePill, mapMode === 'satellite' && styles.mapModePillActive]}
                      onPress={() => setMapMode('satellite')}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="globe" size={12} color={mapMode === 'satellite' ? '#0C6258' : '#64748B'} />
                      <Text style={[styles.mapModePillText, mapMode === 'satellite' && styles.mapModePillTextActive]}>
                        Satellite
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.mapModePill, mapMode === 'simulation' && styles.mapModePillActive]}
                      onPress={() => setMapMode('simulation')}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="bicycle" size={12} color={mapMode === 'simulation' ? '#0C6258' : '#64748B'} />
                      <Text style={[styles.mapModePillText, mapMode === 'simulation' && styles.mapModePillTextActive]}>
                        Live GPS
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.openGoogleMapsBtn}
                    onPress={handleOpenGoogleMapsApp}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="box-arrow-up-right" size={11} color="#0C6258" />
                    <Text style={styles.openGoogleMapsBtnText}>Open App</Text>
                  </TouchableOpacity>
                </View>

                {/* Map Canvas Container */}
                <View style={styles.mapCanvasWrapper}>
                  {/* Option A & B: Embedded Real Google Maps (Interactive) */}
                  {(mapMode === 'google' || mapMode === 'satellite') && Platform.OS === 'web' ? (
                    <View style={styles.iframeMapContainer}>
                      <iframe
                        title="Google Maps City of Naga Cebu Tracking"
                        width="100%"
                        height="100%"
                        style={{ border: 0, width: '100%', height: '100%', minHeight: 250, borderRadius: 16 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent('Purok Avocado 4, Inoburan, City of Naga, Cebu, Philippines')}&t=${mapMode === 'satellite' ? 'k' : 'm'}&z=14&ie=UTF8&iwloc=&output=embed`}
                      />
                      {/* Floating Courier Badge on Google Map */}
                      <View style={styles.googleMapLiveBadge}>
                        <View style={styles.mapHudLiveDot} />
                        <Text style={styles.googleMapLiveText}>Google Maps • City of Naga, Cebu Active</Text>
                      </View>
                    </View>
                  ) : (
                    /* Option C: High-Fidelity Google Maps Vector Street Simulation */
                    <View style={styles.mapRealisticTerrain}>
                      {/* Waterway / Coastal Bay */}
                      <View style={styles.mapCoastalWater}>
                        <Text style={styles.mapWaterLabel}>CEBU STRAIT (NAGA COAST)</Text>
                      </View>

                      {/* Green Parks & Landscaping */}
                      <View style={[styles.mapParkArea, { top: '10%', left: '8%', width: '30%', height: '26%' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <BootstrapIcon name="tree-fill" size={9} color="#059669" />
                          <Text style={styles.mapParkLabel}>Naga Boardwalk Park</Text>
                        </View>
                      </View>
                      <View style={[styles.mapParkArea, { bottom: '12%', right: '8%', width: '28%', height: '28%' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <BootstrapIcon name="tree-fill" size={9} color="#059669" />
                          <Text style={styles.mapParkLabel}>Inoburan Reserve</Text>
                        </View>
                      </View>

                      {/* Urban City Blocks */}
                      <View style={[styles.mapCityBlock, { top: '44%', left: '10%', width: '24%', height: '28%' }]} />
                      <View style={[styles.mapCityBlock, { top: '10%', right: '28%', width: '24%', height: '24%' }]} />
                      <View style={[styles.mapCityBlock, { top: '42%', right: '10%', width: '22%', height: '24%' }]} />

                      {/* Secondary Local Street Grid */}
                      <View style={[styles.mapStreetLocalH, { top: '22%' }]} />
                      <View style={[styles.mapStreetLocalH, { top: '52%' }]} />
                      <View style={[styles.mapStreetLocalH, { top: '80%' }]} />
                      <View style={[styles.mapStreetLocalV, { left: '18%' }]} />
                      <View style={[styles.mapStreetLocalV, { left: '46%' }]} />
                      <View style={[styles.mapStreetLocalV, { left: '76%' }]} />

                      {/* Primary Expressways & Highways */}
                      <View style={[styles.mapHighwayH, { top: '36%' }]}>
                        <Text style={styles.mapHighwayLabel}>CEBU SOUTH ROAD (NAGA HIGHWAY)</Text>
                      </View>
                      <View style={[styles.mapAvenueV, { left: '38%' }]}>
                        <Text style={styles.mapAvenueLabel}>INOBURAN ACCESS BLVD</Text>
                      </View>

                      {/* Street Name Labels */}
                      <Text style={[styles.mapStreetNameTag, { top: '24%', left: '20%' }]}>Poblacion Naga City Hall</Text>
                      <Text style={[styles.mapStreetNameTag, { top: '70%', left: '48%' }]}>Inoburan Public Market</Text>

                      {/* Delivery Route Polyline */}
                      {ROUTE_WAYPOINTS.map((pt, i) => {
                        if (i === ROUTE_WAYPOINTS.length - 1) return null;
                        const nextPt = ROUTE_WAYPOINTS[i + 1];
                        const left = Math.min(pt.x, nextPt.x);
                        const top = Math.min(pt.y, nextPt.y);
                        const width = Math.abs(nextPt.x - pt.x);
                        const height = Math.abs(nextPt.y - pt.y);

                        return (
                          <React.Fragment key={`route-frag-${i}`}>
                            <View
                              style={{
                                position: 'absolute',
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${Math.max(width, 2.5)}%`,
                                height: `${Math.max(height, 2.5)}%`,
                                borderLeftWidth: pt.x === nextPt.x ? 6 : 0,
                                borderTopWidth: pt.y === nextPt.y ? 6 : 0,
                                borderColor: 'rgba(12, 98, 88, 0.25)',
                                zIndex: 15,
                              }}
                            />
                            <View
                              style={{
                                position: 'absolute',
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${Math.max(width, 2.5)}%`,
                                height: `${Math.max(height, 2.5)}%`,
                                borderLeftWidth: pt.x === nextPt.x ? 3.5 : 0,
                                borderTopWidth: pt.y === nextPt.y ? 3.5 : 0,
                                borderColor: '#0C6258',
                                zIndex: 16,
                              }}
                            />
                          </React.Fragment>
                        );
                      })}

                      {/* Origin Hub Marker */}
                      <View style={[styles.mapOriginMarkerRealistic, { left: `${ROUTE_WAYPOINTS[0].x}%`, top: `${ROUTE_WAYPOINTS[0].y}%` }]}>
                        <View style={styles.originMarkerBubbleRealistic}>
                          <BootstrapIcon name="building" size={13} color="#FFFFFF" />
                        </View>
                        <View style={styles.originMarkerBadgeRealistic}>
                          <Text style={styles.originMarkerBadgeText}>MotoTrack Hub (Poblacion, Naga)</Text>
                        </View>
                      </View>

                      {/* Destination Marker */}
                      <View style={[styles.mapDestMarkerRealistic, { left: `${ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].x}%`, top: `${ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].y}%` }]}>
                        <View style={styles.destRadarPulseRealistic} />
                        <View style={styles.destMarkerBubbleRealistic}>
                          <BootstrapIcon name="house-door-fill" size={14} color="#FFFFFF" />
                        </View>
                        <View style={styles.destMarkerBadgeRealistic}>
                          <Text style={styles.destMarkerBadgeText}>Delivery: Inoburan, City of Naga</Text>
                        </View>
                      </View>

                      {/* Live Moving Courier Rider Marker */}
                      <View style={[styles.mapRiderMarkerRealistic, { left: `${riderPos.x}%`, top: `${riderPos.y}%` }]}>
                        <View style={styles.riderLivePulseRing} />
                        <View style={styles.riderBikeAvatarWrap}>
                          <Image source={{ uri: riderInfo.avatar }} style={styles.riderPinAvatarRealistic} />
                          <View style={styles.riderMotorcycleBadge}>
                            <BootstrapIcon name="compass-fill" size={10} color="#FFFFFF" />
                          </View>
                        </View>
                        <View style={styles.riderTooltipPillRealistic}>
                          <Text style={styles.riderTooltipNameRealistic}>🏍️ {riderInfo.name} ({etaMinutes}m)</Text>
                          <Text style={styles.riderTooltipSpeedRealistic}>{currentSpeed} km/h • Naga Corridor</Text>
                        </View>
                      </View>

                      {/* Google Watermark Brand */}
                      <View style={styles.googleWatermark}>
                        <Text style={styles.googleWatermarkText}>
                          <Text style={{ color: '#4285F4' }}>G</Text>
                          <Text style={{ color: '#EA4335' }}>o</Text>
                          <Text style={{ color: '#FBBC05' }}>o</Text>
                          <Text style={{ color: '#4285F4' }}>g</Text>
                          <Text style={{ color: '#34A853' }}>l</Text>
                          <Text style={{ color: '#EA4335' }}>e</Text>
                        </Text>
                      </View>

                      {/* Map HUD Overlay */}
                      <View style={styles.mapHudTopLeft}>
                        <View style={styles.mapHudLiveDot} />
                        <Text style={styles.mapHudLiveText}>LIVE GPS • City of Naga, Cebu ({distanceKm} km)</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Rider Contact Card */}
                <View style={styles.riderInfoBar}>
                  <Image source={{ uri: riderInfo.avatar }} style={styles.riderAvatarSmall} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.riderNameSmall}>{riderInfo.name} • {riderInfo.vehicle}</Text>
                    <Text style={styles.riderPlateText}>Plate: {riderInfo.plateNumber} • ⭐️ {riderInfo.rating} (Express Rider)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.riderCallSmallBtn}
                    onPress={() => setIsCallingRider(true)}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="telephone-fill" size={13} color="#FFFFFF" />
                    <Text style={styles.riderCallSmallText}>Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─── 5. CUSTOMER SHIPPING ADDRESS CARD ─── */}
            <View style={styles.addressCard}>
              <View style={styles.addressHeaderRow}>
                <View style={styles.addressPinWrap}>
                  <BootstrapIcon name="geo-alt-fill" size={16} color="#0C6258" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressRecipientName}>
                    {order.customer_name || 'Maurin Jherico'}{' '}
                    <Text style={styles.addressPhone}>{formatPHPhone(order.customer_phone, true)}</Text>
                  </Text>
                  <Text style={styles.addressDetailText}>
                    {deliveryAddressStr}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.changeAddressLink}
                onPress={() => setIsAddressModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.changeAddressLinkText}>Change address</Text>
              </TouchableOpacity>
            </View>

            {/* ─── 6. STORE & ORDER ITEMS CARD ─── */}
            <View style={styles.orderItemsCard}>
              {/* Store Header Row */}
              <View style={styles.storeHeaderRow}>
                <View style={styles.storeHeaderLeft}>
                  <View style={styles.storeAvatarCircle}>
                    <BootstrapIcon name="shield-check" size={14} color="#0C6258" />
                  </View>
                  <Text style={styles.storeNameText}>MotoTrack Official PH</Text>
                </View>

                <TouchableOpacity
                  style={styles.browseShopBtn}
                  onPress={() => {
                    onClose?.();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.browseShopText}>Browse shop</Text>
                  <BootstrapIcon name="chevron-right" size={12} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Items List */}
              {(order.items && order.items.length > 0 ? order.items : [
                {
                  product_id: 'p-default',
                  name: order.items_summary || 'MotoTrack High Performance Motorcycle Part',
                  price: order.total_amount || 68500,
                  quantity: order.items_count || 1,
                  image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80',
                  brand: 'MotoTrack Racing',
                  category: 'High Performance Spec',
                }
              ]).map((item, idx) => (
                <View key={item.product_id ? `order-item-${item.product_id}-${idx}` : `order-item-${idx}`} style={styles.itemProductRow}>
                  <Image
                    source={{
                      uri: item.image || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80',
                    }}
                    style={styles.itemThumbImg}
                  />
                  <View style={styles.itemInfoCol}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemNameText} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPriceText}>
                        ₱{Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>

                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemCategorySpecText}>
                        {item.brand || 'MotoTrack'} • {item.category || 'Genuine Pro Parts'}
                      </Text>
                      <Text style={styles.itemQtyText}>x{item.quantity || 1}</Text>
                    </View>

                    <View style={styles.itemBadgesRow}>
                      <View style={styles.freeReturnsPill}>
                        <Text style={styles.freeReturnsPillText}>Free returns</Text>
                      </View>
                      <View style={styles.genuinePill}>
                        <Text style={styles.genuinePillText}>Genuine Part</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {/* Order Number & Copy Row */}
              <View style={styles.orderNumberRow}>
                <Text style={styles.orderNumberLabel}>Order number</Text>
                <TouchableOpacity
                  style={styles.orderNumberValueWrap}
                  onPress={handleCopyOrderNumber}
                  activeOpacity={0.8}
                >
                  <Text style={styles.orderNumberValue}>
                    {order.order_id || order.id || '585705280479659997'}
                  </Text>
                  <BootstrapIcon name="copy" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Payment Method & Total Row */}
              <View style={styles.paymentMethodRow}>
                <View style={styles.paymentBadgeWrap}>
                  <View style={[styles.codIndicatorBadge, !isCOD && { backgroundColor: '#0C6258' }]}>
                    <Text style={styles.codIndicatorText}>{isCOD ? 'COD' : 'GCASH'}</Text>
                  </View>
                  <Text style={styles.paymentMethodLabel}>
                    {isCOD ? 'Cash on delivery' : 'GCash Express Verified'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.totalExpandWrap}
                  onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.totalLabelSmall}>Total: </Text>
                  <Text style={styles.totalPriceBig}>₱{grandTotalValue}</Text>
                  <BootstrapIcon
                    name={isSummaryExpanded ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color="#64748B"
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              </View>

              {/* Expandable Price Breakdown */}
              {isSummaryExpanded && (
                <View style={styles.expandedPriceSummary}>
                  <View style={styles.priceBreakdownLine}>
                    <Text style={styles.priceBreakdownLabel}>Subtotal</Text>
                    <Text style={styles.priceBreakdownVal}>₱{subtotalValue}</Text>
                  </View>
                  {Number(discountValue) > 0 && (
                    <View style={styles.priceBreakdownLine}>
                      <Text style={styles.priceBreakdownLabel}>Voucher Discount</Text>
                      <Text style={[styles.priceBreakdownVal, { color: '#0C6258' }]}>-₱{discountValue}</Text>
                    </View>
                  )}
                  <View style={styles.priceBreakdownLine}>
                    <Text style={styles.priceBreakdownLabel}>Delivery Fee</Text>
                    <Text style={[styles.priceBreakdownVal, { color: '#0C6258' }]}>FREE</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ─── 7. FREE RETURNS AT YOUR CONVENIENCE CARD ─── */}
            <TouchableOpacity
              style={styles.freeReturnsBar}
              onPress={() => showToast('Free 30-day hassle-free return policy supported')}
              activeOpacity={0.85}
            >
              <View style={styles.freeReturnsLeft}>
                <BootstrapIcon name="bag-check-fill" size={15} color="#0C6258" />
                <Text style={styles.freeReturnsText}>
                  <Text style={{ color: '#0C6258', fontWeight: '800' }}>Free returns</Text> at your convenience
                </Text>
              </View>
              <BootstrapIcon name="chevron-right" size={13} color="#64748B" />
            </TouchableOpacity>

          </ScrollView>

          {/* ─── 8. BOTTOM ACTION BUTTONS (CHANGE ADDRESS / CANCEL ORDER) ─── */}
          <View style={styles.bottomButtonsContainer}>
            <TouchableOpacity
              style={styles.secondaryBottomBtn}
              onPress={() => {
                if (!showLiveMapDrawer) {
                  setShowLiveMapDrawer(true);
                  showToast('Opened Google Maps view');
                } else {
                  setIsAddressModalOpen(true);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBottomBtnText}>
                {showLiveMapDrawer ? 'Change address' : 'Google Map'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryCancelBtn}
              onPress={() => {
                showToast(`Order #${order.order_id || order.id} cancellation requested`);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryCancelBtnText}>Cancel order</Text>
            </TouchableOpacity>
          </View>

          {/* ─── ADDRESS EDIT DIALOG ─── */}
          {isAddressModalOpen && (
            <View style={styles.editAddressOverlay}>
              <View style={styles.editAddressCard}>
                <Text style={styles.editAddressTitle}>Update Delivery Address</Text>
                <TextInput
                  style={styles.editAddressInput}
                  value={customAddress}
                  onChangeText={setCustomAddress}
                  placeholder="Enter updated complete address"
                  placeholderTextColor="#94A3B8"
                  multiline
                />
                <View style={styles.editAddressBtnRow}>
                  <TouchableOpacity
                    style={styles.editAddressCancelBtn}
                    onPress={() => setIsAddressModalOpen(false)}
                  >
                    <Text style={styles.editAddressCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editAddressSaveBtn}
                    onPress={() => {
                      setIsAddressModalOpen(false);
                      showToast('Delivery address updated in Google Maps');
                    }}
                  >
                    <Text style={styles.editAddressSaveText}>Save Address</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ─── SIMULATED PHONE CALL MODAL ─── */}
          {isCallingRider && (
            <View style={styles.callDialogOverlay}>
              <View style={styles.callDialogCard}>
                <View style={styles.callAvatarPulse}>
                  <Image source={{ uri: riderInfo.avatar }} style={styles.callAvatarImg} />
                </View>
                <Text style={styles.callRiderName}>{riderInfo.name}</Text>
                <Text style={styles.callRiderPhone}>{riderInfo.phone}</Text>
                <Text style={styles.callStatusText}>Calling Courier Rider...</Text>

                <View style={styles.callBtnRow}>
                  <TouchableOpacity
                    style={styles.callHangupBtn}
                    onPress={() => {
                      setIsCallingRider(false);
                      showToast('Call ended');
                    }}
                  >
                    <BootstrapIcon name="telephone-fill" size={16} color="#FFFFFF" />
                    <Text style={styles.callHangupText}>End Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '94%',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalContainerDesktop: {
    maxWidth: 560,
    marginHorizontal: 'auto',
    borderRadius: 28,
    maxHeight: '90%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // 1. Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitleText: {
    fontSize: 13,
    color: '#0C6258',
    fontWeight: '700',
    marginTop: 2,
  },
  headerGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  headerGpsBtnText: {
    color: '#0C6258',
    fontSize: 12,
    fontWeight: '800',
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },

  // 2. Timeline Stepper
  stepperCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: 32,
    marginHorizontal: 10,
  },
  stepperConnectingLineBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#E2E8F0',
    top: 15,
    zIndex: 1,
  },
  stepperConnectingLineActive: {
    position: 'absolute',
    left: 0,
    height: 2.5,
    backgroundColor: '#0C6258',
    top: 15,
    zIndex: 2,
  },
  stepNodeContainer: {
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  completedStepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingStepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  stepLabelText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  stepLabelTextActive: {
    color: '#0C6258',
    fontWeight: '900',
  },
  stepLabelTextCompleted: {
    color: '#0F172A',
    fontWeight: '700',
  },

  // 3. Guarantee Banner
  guaranteeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F7F6',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: '#D1ECE6',
    gap: 10,
  },
  guaranteeIconWrap: {
    marginTop: 1,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },

  // 4. Google Maps Section
  googleMapSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mapToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapModePills: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 12,
  },
  mapModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  mapModePillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  mapModePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  mapModePillTextActive: {
    color: '#0C6258',
    fontWeight: '800',
  },
  openGoogleMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F7F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  openGoogleMapsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0C6258',
  },

  mapCanvasWrapper: {
    height: 250,
    backgroundColor: '#EDF1F5',
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  iframeMapContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  googleMapLiveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleMapLiveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  mapRealisticTerrain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EDF1F5',
  },
  mapCoastalWater: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '22%',
    backgroundColor: '#BAE6FD',
    borderRightWidth: 2,
    borderRightColor: '#7DD3FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapWaterLabel: {
    transform: [{ rotate: '-90deg' }],
    fontSize: 7.5,
    fontWeight: '900',
    color: '#0369A1',
    letterSpacing: 1.5,
    opacity: 0.7,
  },
  mapParkArea: {
    position: 'absolute',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 4,
    justifyContent: 'flex-start',
  },
  mapParkLabel: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#047857',
  },
  mapCityBlock: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  mapStreetLocalH: {
    position: 'absolute',
    left: '22%',
    right: 0,
    height: 5,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  mapStreetLocalV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  mapHighwayH: {
    position: 'absolute',
    left: '22%',
    right: 0,
    height: 16,
    backgroundColor: '#FED7AA',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  mapHighwayLabel: {
    fontSize: 6.5,
    fontWeight: '900',
    color: '#9A3412',
    letterSpacing: 0.5,
  },
  mapAvenueV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapAvenueLabel: {
    transform: [{ rotate: '-90deg' }],
    fontSize: 6.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  mapStreetNameTag: {
    position: 'absolute',
    fontSize: 7.5,
    fontWeight: '800',
    color: '#475569',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },

  mapOriginMarkerRealistic: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -14 }, { translateY: -14 }],
    zIndex: 20,
  },
  originMarkerBubbleRealistic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0C6258',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  originMarkerBadgeRealistic: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  originMarkerBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  mapDestMarkerRealistic: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -14 }, { translateY: -14 }],
    zIndex: 20,
  },
  destRadarPulseRealistic: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    top: -8,
    left: -8,
  },
  destMarkerBubbleRealistic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  destMarkerBadgeRealistic: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginTop: 2,
  },
  destMarkerBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  mapRiderMarkerRealistic: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    zIndex: 30,
  },
  riderLivePulseRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(12, 98, 88, 0.25)',
    top: -7,
    left: -7,
  },
  riderBikeAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#0C6258',
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderPinAvatarRealistic: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
  },
  riderMotorcycleBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#0C6258',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  riderTooltipPillRealistic: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 3,
    borderWidth: 1,
    borderColor: '#0C6258',
    alignItems: 'center',
  },
  riderTooltipNameRealistic: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  riderTooltipSpeedRealistic: {
    color: '#56B9A1',
    fontSize: 7.5,
    fontWeight: '700',
  },

  googleWatermark: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 25,
  },
  googleWatermarkText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  mapHudTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 25,
  },
  mapHudLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  mapHudLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  riderInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  riderAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  riderNameSmall: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  riderPlateText: {
    fontSize: 10.5,
    color: '#64748B',
  },
  riderCallSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0C6258',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  riderCallSmallText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // 5. Address Card
  addressCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressPinWrap: {
    marginTop: 2,
  },
  addressRecipientName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  addressPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  addressDetailText: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  changeAddressLink: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeAddressLinkText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0C6258',
  },

  // 6. Store & Items Card
  orderItemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  storeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  storeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F7F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  storeNameText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  browseShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  browseShopText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  itemProductRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  itemThumbImg: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemInfoCol: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemNameText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  itemPriceText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0C6258',
  },
  itemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  itemCategorySpecText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  itemQtyText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '700',
  },
  itemBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  freeReturnsPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeReturnsPillText: {
    fontSize: 9.5,
    color: '#D97706',
    fontWeight: '800',
  },
  genuinePill: {
    backgroundColor: '#F3F7F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  genuinePillText: {
    fontSize: 9.5,
    color: '#0C6258',
    fontWeight: '800',
  },

  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  orderNumberLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  orderNumberValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumberValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },

  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  paymentBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codIndicatorBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codIndicatorText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#16A34A',
  },
  paymentMethodLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  totalExpandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabelSmall: {
    fontSize: 12,
    color: '#64748B',
  },
  totalPriceBig: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0C6258',
  },

  expandedPriceSummary: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  priceBreakdownLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceBreakdownLabel: {
    fontSize: 11.5,
    color: '#64748B',
  },
  priceBreakdownVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  // 7. Free Returns Bar
  freeReturnsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  freeReturnsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeReturnsText: {
    fontSize: 12,
    color: '#475569',
  },

  // 8. Bottom Buttons
  bottomButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  secondaryBottomBtn: {
    flex: 1,
    backgroundColor: '#F3F7F6',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  secondaryBottomBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0C6258',
  },
  primaryCancelBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  primaryCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
  },

  // Address Edit Modal
  editAddressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 50,
  },
  editAddressCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  editAddressTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  editAddressInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    color: '#0F172A',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  editAddressBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editAddressCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  editAddressCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  editAddressSaveBtn: {
    flex: 1,
    backgroundColor: '#0C6258',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  editAddressSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Calling Rider Modal
  callDialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 60,
  },
  callDialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  callAvatarPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#F3F7F6',
  },
  callAvatarImg: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  callRiderName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  callRiderPhone: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  callStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C6258',
    marginTop: 10,
  },
  callBtnRow: {
    marginTop: 24,
    width: '100%',
  },
  callHangupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 16,
    width: '100%',
  },
  callHangupText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
