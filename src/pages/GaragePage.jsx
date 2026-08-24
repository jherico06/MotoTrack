import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { garageStyles as styles } from '../styles/garagePage.styles';
import {
  garageService,
  GARAGE_SERVICES,
  GARAGE_BRANCHES,
  TIME_SLOTS,
} from '../services/garageService';
import { BootstrapIcon, BottomNavBar } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

export default function GaragePage({
  currentUser: propCurrentUser,
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToOrders,
  onNavigateToAdmin,
  wishlistCount: propWishlistCount,
  showToast: propShowToast,
}) {
  const auth = useAuth();
  const wishlistCtx = useWishlist();
  const cartCtx = useCart();

  const currentUser = propCurrentUser !== undefined ? propCurrentUser : auth?.currentUser;
  const wishlistCount = propWishlistCount !== undefined ? propWishlistCount : (wishlistCtx?.wishlistCount || 0);
  const showToast = propShowToast || cartCtx?.showToast || (() => {});
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 700 && windowWidth < 1024;

  const [activeFilter, setActiveFilter] = useState('All'); // 'All' | 'PMS' | 'Customization' | 'MyBookings'
  const [servicesList, setServicesList] = useState(() => garageService.getServices());
  const [userBookings, setUserBookings] = useState([]);

  // Booking Modal State
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [bikeOdo, setBikeOdo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(GARAGE_BRANCHES[0].name);
  const [bookingDate, setBookingDate] = useState('Tomorrow, 10:30 AM');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[1]);
  const [ownerName, setOwnerName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [ownerPhone, setOwnerPhone] = useState(currentUser?.phone || '+63 917 882 9102');
  const [serviceNotes, setServiceNotes] = useState('');

  const refreshServices = async () => {
    try {
      const data = await garageService.fetchServices();
      setServicesList(data || []);
    } catch (e) {
      setServicesList(garageService.getServices());
    }
  };

  // Load Bookings & Services on mount and subscribe to live updates
  useEffect(() => {
    refreshServices();
    const unsubscribe = garageService.subscribe((updatedServices) => {
      setServicesList(updatedServices);
    });
    const bookings = garageService.getLocalBookings();
    setUserBookings(bookings);
    if (currentUser) {
      setOwnerName(currentUser.fullName || currentUser.name || '');
      setOwnerPhone(currentUser.phone || '+63 917 882 9102');
    }
    return () => unsubscribe();
  }, [currentUser]);

  // Filtered Services List
  const filteredServices = useMemo(() => {
    if (activeFilter === 'All') return servicesList;
    if (activeFilter === 'PMS') return servicesList.filter((s) => s.category === 'PMS');
    if (activeFilter === 'Customization') return servicesList.filter((s) => s.category === 'Customization');
    return [];
  }, [servicesList, activeFilter]);

  // Open booking modal for a service
  const handleOpenBooking = (service) => {
    if (!currentUser) {
      showToast('Please sign in to book your garage appointment');
      onNavigateToLogin?.();
      return;
    }
    setSelectedServiceForBooking(service);
    setIsBookingModalOpen(true);
  };

  // Submit Booking
  const handleConfirmBooking = () => {
    if (!bikeModel.trim()) {
      showToast('Please enter your motorcycle model (e.g. NMAX 155, Ninja 400)');
      return;
    }
    if (!ownerPhone.trim()) {
      showToast('Please enter your contact phone number');
      return;
    }

    const newBooking = garageService.createBooking({
      service_id: selectedServiceForBooking.id,
      service_title: selectedServiceForBooking.title,
      category: selectedServiceForBooking.category,
      service_price: selectedServiceForBooking.price,
      bike_brand: bikeBrand,
      bike_model: bikeModel,
      plate_number: bikePlate.trim() || 'Pending Registration',
      odometer: bikeOdo.trim() || 'New Unit',
      appointment_date: bookingDate,
      time_slot: selectedTimeSlot,
      branch: selectedBranch,
      customer_name: ownerName || 'Alex Rider',
      customer_phone: ownerPhone,
      notes: serviceNotes,
    });

    setUserBookings(garageService.getLocalBookings());
    setIsBookingModalOpen(false);
    setActiveFilter('MyBookings');
    showToast(`🏁 Appointment booked! Ticket #${newBooking.id}`);
  };

  // Cancel Booking
  const handleCancelBooking = (bookingId) => {
    const updated = garageService.cancelBooking(bookingId);
    setUserBookings(updated);
    showToast('Booking appointment cancelled');
  };

  // Bottom Nav Bar Handler
  const handleBottomNavChange = (tab) => {
    if (tab === 'Home') {
      onNavigateToStore?.();
    } else if (tab === 'Garage') {
      setActiveFilter('All');
    } else if (tab === 'Favorites') {
      onNavigateToWishlist?.();
    } else if (tab === 'Admin') {
      onNavigateToAdmin?.();
    } else if (tab === 'Profile') {
      if (!currentUser) {
        onNavigateToLogin?.();
      } else {
        onNavigateToProfile?.();
      }
    }
  };

  const activeBookingsCount = userBookings.filter((b) => b.status !== 'Cancelled').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* ─── 1. TOP NAVBAR ─── */}
      <View style={styles.navbarWrapper}>
        <View style={[styles.maxContainer, styles.navbarInner]}>
          <View style={styles.logoRow}>
            <BootstrapIcon name="tools" size={24} color="#0C6258" />
            <Text style={styles.logoText}>
              Moto<Text style={styles.logoAccent}>Garage</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.backToStoreBtn}
            onPress={onNavigateToStore}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="arrow-left" size={14} color="#334155" />
            <Text style={styles.backToStoreText}>Back to Shop</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── 2. HERO BANNER ─── */}
          <View style={styles.heroBanner}>
            <View style={styles.heroBadge}>
              <BootstrapIcon name="wrench-adjustable-circle-fill" size={14} color="#74C9B4" />
              <Text style={styles.heroBadgeText}>Official Pitstop & Service Hub</Text>
            </View>
            <Text style={styles.heroTitle}>
              Book Expert PMS & Precision Customization
            </Text>
            <Text style={styles.heroSubtitle}>
              From routine 20-point Preventive Maintenance Service (PMS) to custom titanium exhaust fitting, Dynojet ECU remapping, and race suspension tuning by certified master mechanics.
            </Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <BootstrapIcon name="shield-lock-fill" size={16} color="#56B9A1" />
                <Text style={styles.heroStatVal}>30-Day Service Warranty</Text>
              </View>
              <View style={styles.heroStatItem}>
                <BootstrapIcon name="speedometer2" size={16} color="#56B9A1" />
                <Text style={styles.heroStatVal}>Dynojet 250i Cell</Text>
              </View>
              <View style={styles.heroStatItem}>
                <BootstrapIcon name="check-circle-fill" size={16} color="#16A34A" />
                <Text style={styles.heroStatVal}>100% Genuine Liqui-Moly / Motul</Text>
              </View>
            </View>
          </View>

          {/* ─── 3. CATEGORY & BOOKINGS TABS ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsRow}
          >
            <TouchableOpacity
              style={[styles.tabBtn, activeFilter === 'All' && styles.tabBtnActive]}
              onPress={() => setActiveFilter('All')}
            >
              <BootstrapIcon
                name="grid-fill"
                size={14}
                color={activeFilter === 'All' ? '#FFFFFF' : '#475569'}
              />
              <Text style={[styles.tabBtnText, activeFilter === 'All' && styles.tabBtnTextActive]}>
                All Services
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeFilter === 'PMS' && styles.tabBtnActive]}
              onPress={() => setActiveFilter('PMS')}
            >
              <BootstrapIcon
                name="wrench"
                size={14}
                color={activeFilter === 'PMS' ? '#FFFFFF' : '#475569'}
              />
              <Text style={[styles.tabBtnText, activeFilter === 'PMS' && styles.tabBtnTextActive]}>
                PMS (Preventive Maintenance)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeFilter === 'Customization' && styles.tabBtnActive]}
              onPress={() => setActiveFilter('Customization')}
            >
              <BootstrapIcon
                name="tools"
                size={14}
                color={activeFilter === 'Customization' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeFilter === 'Customization' && styles.tabBtnTextActive,
                ]}
              >
                Customization & Tuning
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeFilter === 'MyBookings' && styles.tabBtnActive]}
              onPress={() => setActiveFilter('MyBookings')}
            >
              <BootstrapIcon
                name="calendar-check-fill"
                size={14}
                color={activeFilter === 'MyBookings' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeFilter === 'MyBookings' && styles.tabBtnTextActive,
                ]}
              >
                My Service Bookings
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  activeFilter === 'MyBookings' && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeFilter === 'MyBookings' && styles.tabBadgeTextActive,
                  ]}
                >
                  {activeBookingsCount}
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* ─── 4. SERVICES CATALOG VIEW ─── */}
          {activeFilter !== 'MyBookings' && (
            <View style={styles.servicesGrid}>
              {filteredServices.length === 0 ? (
                <View
                  style={{
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    padding: 40,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    marginVertical: 16,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: '#F3F7F6',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <BootstrapIcon name="tools" size={28} color="#0C6258" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
                    No Garage Services Available
                  </Text>
                  <Text style={{ fontSize: 13.5, color: '#64748B', textAlign: 'center', maxWidth: 360 }}>
                    New motorcycle maintenance & tuning packages will appear here once published by the store administrator.
                  </Text>
                </View>
              ) : (
                filteredServices.map((service, sIdx) => {
                  const cardWidth = isDesktop ? '31.5%' : isTablet ? '48%' : '100%';
                  return (
                    <View key={service.id || `srv-${sIdx}`} style={[styles.serviceCard, { width: cardWidth }]}>
                      <View style={styles.serviceImgBanner}>
                        <Image
                          source={{ uri: service.image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80' }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        <View style={styles.serviceCatPill}>
                          <BootstrapIcon name={service.icon || (service.category === 'PMS' ? 'wrench-adjustable' : 'tools')} size={12} color="#FFFFFF" />
                          <Text style={styles.serviceCatText}>
                            {service.categoryName || (service.category === 'PMS' ? 'Preventive Maintenance' : 'Customization & Tuning')}
                          </Text>
                        </View>

                        <View style={styles.serviceDurationPill}>
                          <BootstrapIcon name="clock-fill" size={11} color="#0C6258" />
                          <Text style={styles.serviceDurationText}>{service.duration || '60 mins'}</Text>
                        </View>
                      </View>

                      <View style={styles.serviceBody}>
                        <View style={styles.serviceTitleRow}>
                          <Text style={styles.serviceTitle}>{service.title || 'Service Package'}</Text>
                          <View style={styles.servicePricePill}>
                            <Text style={styles.servicePriceText}>₱{Number(service.price || 0).toFixed(2)}</Text>
                            <Text style={styles.servicePriceSub}>₱{(service.pricePhp || Math.round(Number(service.price || 0) * 50)).toLocaleString()}</Text>
                          </View>
                        </View>

                        <Text style={styles.serviceSubtitle}>{service.subtitle || ''}</Text>
                        <Text style={styles.serviceDesc}>{service.description || ''}</Text>

                        {/* Inclusions Box */}
                        <View style={styles.inclusionsBox}>
                          <Text style={styles.inclusionsHeader}>Package Inclusions:</Text>
                          {(Array.isArray(service.inclusions) ? service.inclusions : []).map((inc, i) => (
                            <View key={i} style={styles.inclusionItem}>
                              <BootstrapIcon name="check2" size={13} color="#16A34A" />
                              <Text style={styles.inclusionText}>{inc}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Action Button */}
                        <TouchableOpacity
                          style={styles.bookNowBtn}
                          onPress={() => handleOpenBooking(service)}
                          activeOpacity={0.9}
                        >
                          <BootstrapIcon name="calendar-check-fill" size={15} color="#FFFFFF" />
                          <Text style={styles.bookNowBtnText}>Book This Service Slot ⚡</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ─── 5. MY BOOKINGS VIEW ─── */}
          {activeFilter === 'MyBookings' && (
            <View style={{ marginTop: 8 }}>
              {userBookings.length === 0 ? (
                <View style={{ paddingVertical: 50, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <BootstrapIcon name="calendar-check" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                    No Service Bookings Yet
                  </Text>
                  <Text style={{ fontSize: 13.5, color: '#64748B', marginBottom: 16 }}>
                    Book your motorcycle PMS or custom performance upgrade now.
                  </Text>
                  <TouchableOpacity
                    style={[styles.bookNowBtn, { paddingHorizontal: 20 }]}
                    onPress={() => setActiveFilter('All')}
                  >
                    <Text style={styles.bookNowBtnText}>Browse Garage Services</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                userBookings.map((booking) => (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View style={styles.bookingCardHeader}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <View style={styles.ticketIdPill}>
                            <Text style={styles.ticketIdText}>{booking.id}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>
                            {booking.category === 'PMS' ? '🔧 Maintenance' : '⚡ Customization'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>
                          {booking.service_title}
                        </Text>
                      </View>

                      <View
                        style={
                          booking.status === 'In-Service'
                            ? styles.statusBadgeInService
                            : booking.status === 'Cancelled'
                            ? { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }
                            : styles.statusBadgeConfirmed
                        }
                      >
                        <Text
                          style={
                            booking.status === 'In-Service'
                              ? styles.statusTextInService
                              : booking.status === 'Cancelled'
                              ? { color: '#DC2626', fontSize: 11.5, fontWeight: '800' }
                              : styles.statusTextConfirmed
                          }
                        >
                          {booking.status}
                        </Text>
                      </View>
                    </View>

                    {/* Motorcycle Details */}
                    <View style={styles.bookingBikeRow}>
                      <BootstrapIcon name="bicycle" size={18} color="#0C6258" />
                      <Text style={styles.bookingBikeTitle}>
                        {booking.bike_brand} {booking.bike_model}{' '}
                        <Text style={{ color: '#64748B', fontWeight: '500' }}>({booking.plate_number})</Text>
                      </Text>
                    </View>

                    {/* Meta Details */}
                    <View style={styles.bookingMetaGrid}>
                      <View style={styles.bookingMetaRow}>
                        <Text style={styles.bookingMetaLabel}>Schedule:</Text>
                        <Text style={[styles.bookingMetaVal, { color: '#0C6258' }]}>
                          {booking.appointment_date} • {booking.time_slot}
                        </Text>
                      </View>

                      <View style={styles.bookingMetaRow}>
                        <Text style={styles.bookingMetaLabel}>Pitstop Hub:</Text>
                        <Text style={styles.bookingMetaVal}>{booking.branch}</Text>
                      </View>

                      <View style={styles.bookingMetaRow}>
                        <Text style={styles.bookingMetaLabel}>Technician:</Text>
                        <Text style={styles.bookingMetaVal}>{booking.mechanic}</Text>
                      </View>

                      {booking.notes ? (
                        <View style={styles.bookingMetaRow}>
                          <Text style={styles.bookingMetaLabel}>Notes:</Text>
                          <Text style={[styles.bookingMetaVal, { color: '#64748B', fontWeight: '500' }]}>
                            {booking.notes}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Actions */}
                    {booking.status !== 'Cancelled' && (
                      <View style={styles.bookingActionsRow}>
                        <TouchableOpacity
                          style={styles.cancelBookingBtn}
                          onPress={() => handleCancelBooking(booking.id)}
                        >
                          <Text style={styles.cancelBookingBtnText}>Cancel Booking</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── 6. BOOKING APPOINTMENT MODAL ─── */}
      <Modal visible={isBookingModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="tools" size={18} color="#0C6258" />
                <Text style={styles.modalTitle}>Book Service Appointment</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsBookingModalOpen(false)}
              >
                <BootstrapIcon name="x-lg" size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedServiceForBooking && (
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* Service Header Info */}
                <View
                  style={{
                    backgroundColor: '#F3F7F6',
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#D1ECE6',
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#0C6258', textTransform: 'uppercase' }}>
                    {selectedServiceForBooking.categoryName || (selectedServiceForBooking.category === 'PMS' ? 'Preventive Maintenance' : 'Customization & Tuning')}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 2 }}>
                    {selectedServiceForBooking.title || 'Service Package'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0C6258', marginTop: 2 }}>
                    Estimated Service Fee: ${Number(selectedServiceForBooking.price || 0).toFixed(2)} (₱{(selectedServiceForBooking.pricePhp || Math.round(Number(selectedServiceForBooking.price || 0) * 50)).toLocaleString()}) • {selectedServiceForBooking.duration || '60 mins'}
                  </Text>
                </View>

                {/* Section 1: Motorcycle Information */}
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  1. Motorcycle Details
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Motorcycle Brand *</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW'].map((brand) => (
                      <TouchableOpacity
                        key={brand}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: bikeBrand === brand ? '#0C6258' : '#F1F5F9',
                        }}
                        onPress={() => setBikeBrand(brand)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: bikeBrand === brand ? '#FFFFFF' : '#475569',
                          }}
                        >
                          {brand}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Model & Variant *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. NMAX 155, Ninja 400, Click 160..."
                    value={bikeModel}
                    onChangeText={setBikeModel}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Plate No. / MV File</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. NMX-4892"
                      value={bikePlate}
                      onChangeText={setBikePlate}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Current Odometer (km)</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. 8,500 km"
                      value={bikeOdo}
                      onChangeText={setBikeOdo}
                    />
                  </View>
                </View>

                {/* Section 2: Branch & Time */}
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A', marginTop: 8, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  2. Pitstop Hub & Schedule
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Select Service Center Branch *</Text>
                  {GARAGE_BRANCHES.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.branchSelectCard,
                        selectedBranch === b.name && styles.branchSelectCardActive,
                      ]}
                      onPress={() => setSelectedBranch(b.name)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', flex: 1 }}>
                          {b.name}
                        </Text>
                        {selectedBranch === b.name && (
                          <BootstrapIcon name="check-circle-fill" size={16} color="#0C6258" />
                        )}
                      </View>
                      <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                        {b.address} • {b.bays}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Preferred Time Slot *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {TIME_SLOTS.map((slot) => (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.timeSlotChip,
                          selectedTimeSlot === slot && styles.timeSlotChipActive,
                        ]}
                        onPress={() => setSelectedTimeSlot(slot)}
                      >
                        <Text
                          style={[
                            styles.timeSlotText,
                            selectedTimeSlot === slot && styles.timeSlotTextActive,
                          ]}
                        >
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Section 3: Contact & Notes */}
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A', marginTop: 8, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  3. Contact & Special Requests
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Contact Phone Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="+63 9XX XXX XXXX"
                    value={ownerPhone}
                    onChangeText={setOwnerPhone}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Special Instructions / Mechanic Notes</Text>
                  <TextInput
                    style={[styles.formInput, { height: 64 }]}
                    placeholder="e.g. Please check cold start vibration, custom exhaust sound level..."
                    multiline
                    value={serviceNotes}
                    onChangeText={setServiceNotes}
                  />
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.bookNowBtn, { marginTop: 12 }]}
              onPress={handleConfirmBooking}
              activeOpacity={0.9}
            >
              <BootstrapIcon name="check-circle-fill" size={16} color="#FFFFFF" />
              <Text style={styles.bookNowBtnText}>Confirm Service Booking Slot</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── 7. PERSISTENT MOBILE BOTTOM NAVIGATION ─── */}
      <BottomNavBar
        activeTab="Garage"
        onTabChange={handleBottomNavChange}
        wishlistCount={wishlistCount}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
