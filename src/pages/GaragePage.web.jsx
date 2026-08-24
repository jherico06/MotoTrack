import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BootstrapIcon, ToastNotification, BottomNavBar } from '../components';
import { useAuth } from '../context/AuthContext';
import { garageService } from '../services/garageService';
import { useWishlist } from '../context/WishlistContext';

export default function GaragePageWeb({
  onNavigateToStore,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { currentUser, setRedirectReason } = useAuth();
  const { wishlistCount } = useWishlist ? useWishlist() : { wishlistCount: 0 };

  const [activeTab, setActiveTab] = useState('All'); // 'All' | 'PMS' | 'Customization' | 'MyBookings'
  const [servicesList, setServicesList] = useState(() => garageService.getServices());
  const [userBookings, setUserBookings] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Booking Modal State
  const [selectedService, setSelectedService] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Form Fields
  const [bikeBrand, setBikeBrand] = useState('Yamaha');
  const [bikeModel, setBikeModel] = useState('');
  const [bikePlate, setBikePlate] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('Circuit Makati Pit Bay');
  const [selectedDate, setSelectedDate] = useState('2026-08-25');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [ownerName, setOwnerName] = useState(currentUser?.name || 'Alex Rider');
  const [ownerPhone, setOwnerPhone] = useState(currentUser?.phone || '+63 917 123 4567');
  const [serviceNotes, setServiceNotes] = useState('');

  const branches = [
    'Circuit Makati Pit Bay (Main Dyno Lab)',
    'BGC High Street Master Garage',
    'Clark International Speedway Trackside Bay',
  ];

  const timeSlots = ['09:00 AM', '10:30 AM', '01:00 PM', '02:30 PM', '04:00 PM'];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const refreshBookings = () => {
    if (currentUser?.email) {
      const bookings = garageService.getUserBookings(currentUser.email);
      setUserBookings(bookings);
    } else {
      setUserBookings([]);
    }
  };

  useEffect(() => {
    refreshBookings();
  }, [currentUser]);

  const filteredServices = servicesList.filter((s) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'PMS') return s.category === 'PMS';
    if (activeTab === 'Customization') return s.category === 'Customization';
    return true;
  });

  const handleOpenBooking = (service) => {
    if (!currentUser) {
      setRedirectReason('Please sign in to book your garage appointment.');
      onNavigateToLogin?.();
      return;
    }
    setSelectedService(service);
    setIsBookingModalOpen(true);
  };

  const handleConfirmBooking = () => {
    if (!bikeModel.trim() || !bikePlate.trim() || !ownerName.trim()) {
      showToast('⚠️ Please fill in all required motorcycle and rider details.');
      return;
    }

    const newBooking = {
      id: 'BK-' + Math.floor(10000 + Math.random() * 90000),
      serviceId: selectedService.id,
      serviceName: selectedService.title,
      servicePrice: selectedService.price,
      userEmail: currentUser?.email || 'rider@mototrack.com',
      userName: ownerName,
      userPhone: ownerPhone,
      bikeBrand,
      bikeModel,
      bikePlate,
      branch: selectedBranch,
      date: selectedDate,
      time: selectedTime,
      notes: serviceNotes,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
    };

    garageService.addBooking(newBooking);
    refreshBookings();
    setIsBookingModalOpen(false);
    showToast('🎉 Pit bay appointment booked successfully!');
    setActiveTab('MyBookings');
  };

  const handleCancelBooking = (bookingId) => {
    garageService.cancelBooking(bookingId);
    refreshBookings();
    showToast('Appointment cancelled.');
  };

  const numColumns = windowWidth >= 1200 ? 3 : windowWidth >= 768 ? 2 : 1;
  const cardWidth = `${(100 / numColumns) - 1.5}%`;

  return (
    <View style={gStyles.container}>
      <StatusBar style="dark" />
      <ToastNotification message={toastMessage} />

      {/* ─── DESKTOP TOP STICKY NAVBAR ─── */}
      <View style={gStyles.headerWrapper}>
        <View style={gStyles.headerInner}>
          <TouchableOpacity
            style={gStyles.logoWrap}
            onPress={() => onNavigateToStore?.()}
            activeOpacity={0.8}
          >
            <View style={gStyles.logoIconBadge}>
              <BootstrapIcon name="speedometer2" size={20} color="#FFFFFF" />
            </View>
            <Text style={gStyles.logoText}>
              Moto<Text style={{ color: '#0C6258' }}>Track</Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}> PITSTOP GARAGE</Text>
            </Text>
          </TouchableOpacity>

          <View style={gStyles.headerNavLinks}>
            <TouchableOpacity
              style={gStyles.navLinkBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="bag-check" size={14} color="#64748B" />
              <Text style={gStyles.navLinkBtnText}>Storefront Catalog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={gStyles.navLinkBtn}
              onPress={() => onNavigateToOrders?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="receipt" size={14} color="#64748B" />
              <Text style={gStyles.navLinkBtnText}>My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[gStyles.navLinkBtn, { backgroundColor: '#F3F7F6', borderWidth: 1, borderColor: '#D1ECE6', paddingHorizontal: 12, borderRadius: 10 }]}
              onPress={() => onNavigateToAdmin?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="shield-lock-fill" size={13} color="#0C6258" />
              <Text style={[gStyles.navLinkBtnText, { color: '#0C6258', fontWeight: '800' }]}>Admin</Text>
            </TouchableOpacity>

            {currentUser ? (
              <TouchableOpacity
                style={gStyles.userPill}
                onPress={() => onNavigateToProfile?.()}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }}
                  style={gStyles.userAvatar}
                />
                <Text style={gStyles.userNameText}>{currentUser.name}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={gStyles.signInBtn}
                onPress={() => onNavigateToLogin?.()}
                activeOpacity={0.85}
              >
                <Text style={gStyles.signInBtnText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── GARAGE MAIN CONTENT ─── */}
      <ScrollView contentContainerStyle={gStyles.scrollContent} showsVerticalScrollIndicator={true}>
        <View style={gStyles.maxContainer}>

          {/* Garage Hero Showcase */}
          <View style={gStyles.heroCard}>
            <View style={gStyles.heroLeft}>
              <View style={gStyles.heroTag}>
                <BootstrapIcon name="tools" size={12} color="#A7F3D0" />
                <Text style={gStyles.heroTagText}>Official Factory Certified Pitstop</Text>
              </View>
              <Text style={gStyles.heroTitle}>
                MASTER MOTORCYCLE TUNING & PREVENTIVE MAINTENANCE.
              </Text>
              <Text style={gStyles.heroSub}>
                Dyno power mapping, telemetry diagnostics, Akrapovič titanium exhaust installations, and Brembo race brake bleeding by certified master technicians.
              </Text>
            </View>
            <View style={gStyles.heroRight}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80' }}
                style={gStyles.heroImg}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Navigation Tabs */}
          <View style={gStyles.tabBarRow}>
            <View style={gStyles.tabButtons}>
              <TouchableOpacity
                style={[gStyles.tabBtn, activeTab === 'All' && gStyles.tabBtnActive]}
                onPress={() => setActiveTab('All')}
              >
                <Text style={[gStyles.tabBtnText, activeTab === 'All' && gStyles.tabBtnTextActive]}>
                  All Service Packages ({servicesList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gStyles.tabBtn, activeTab === 'PMS' && gStyles.tabBtnActive]}
                onPress={() => setActiveTab('PMS')}
              >
                <Text style={[gStyles.tabBtnText, activeTab === 'PMS' && gStyles.tabBtnTextActive]}>
                  Preventive Maintenance (PMS)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gStyles.tabBtn, activeTab === 'Customization' && gStyles.tabBtnActive]}
                onPress={() => setActiveTab('Customization')}
              >
                <Text style={[gStyles.tabBtnText, activeTab === 'Customization' && gStyles.tabBtnTextActive]}>
                  Customization & Dyno
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gStyles.tabBtn, activeTab === 'MyBookings' && gStyles.tabBtnActive]}
                onPress={() => {
                  if (!currentUser) {
                    setRedirectReason('Please sign in to view your booked pitstop appointments.');
                    onNavigateToLogin?.();
                  } else {
                    setActiveTab('MyBookings');
                  }
                }}
              >
                <Text style={[gStyles.tabBtnText, activeTab === 'MyBookings' && gStyles.tabBtnTextActive]}>
                  My Scheduled Bookings ({userBookings.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Content */}
          {activeTab === 'MyBookings' ? (
            /* ─── MY BOOKINGS VIEW ─── */
            <View style={gStyles.bookingsContainer}>
              <Text style={gStyles.sectionTitle}>My Pitstop Appointments</Text>
              {userBookings.length === 0 ? (
                <View style={gStyles.emptyBox}>
                  <BootstrapIcon name="calendar-x" size={36} color="#94A3B8" />
                  <Text style={gStyles.emptyTitle}>No scheduled pit bay appointments yet</Text>
                  <Text style={gStyles.emptySub}>
                    Browse our service packages above and book a dedicated pit bay slot.
                  </Text>
                </View>
              ) : (
                <View style={gStyles.bookingsGrid}>
                  {userBookings.map((b) => (
                    <View key={b.id} style={gStyles.bookingCard}>
                      <View style={gStyles.bookingCardTop}>
                        <View>
                          <Text style={gStyles.bookingId}>REF: {b.id}</Text>
                          <Text style={gStyles.bookingServiceTitle}>{b.serviceName}</Text>
                        </View>
                        <View style={gStyles.statusPillConfirmed}>
                          <Text style={gStyles.statusPillText}>{b.status}</Text>
                        </View>
                      </View>

                      <View style={gStyles.bookingDetailsGrid}>
                        <View style={gStyles.bookingDetailItem}>
                          <BootstrapIcon name="calendar-event" size={13} color="#0C6258" />
                          <Text style={gStyles.bookingDetailVal}>{b.date} • {b.time}</Text>
                        </View>
                        <View style={gStyles.bookingDetailItem}>
                          <BootstrapIcon name="geo-alt-fill" size={13} color="#0C6258" />
                          <Text style={gStyles.bookingDetailVal}>{b.branch}</Text>
                        </View>
                        <View style={gStyles.bookingDetailItem}>
                          <BootstrapIcon name="speedometer" size={13} color="#0C6258" />
                          <Text style={gStyles.bookingDetailVal}>{b.bikeBrand} {b.bikeModel} ({b.bikePlate})</Text>
                        </View>
                        <View style={gStyles.bookingDetailItem}>
                          <BootstrapIcon name="cash" size={13} color="#0C6258" />
                          <Text style={gStyles.bookingDetailVal}>Est. Cost: ₱{b.servicePrice?.toFixed(2)}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={gStyles.cancelBookingBtn}
                        onPress={() => handleCancelBooking(b.id)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                        <Text style={gStyles.cancelBookingBtnText}>Cancel Booking</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* ─── SERVICES GRID VIEW ─── */
            <View style={gStyles.serviceGrid}>
              {filteredServices.map((service) => (
                <View key={service.id} style={[gStyles.serviceCard, { width: cardWidth }]}>
                  <View style={gStyles.serviceImgWrap}>
                    <Image source={{ uri: service.image }} style={gStyles.serviceImg} resizeMode="cover" />
                    <View style={gStyles.serviceCatBadge}>
                      <BootstrapIcon name={service.category === 'PMS' ? 'wrench-adjustable' : 'tools'} size={12} color="#FFFFFF" />
                      <Text style={gStyles.serviceCatBadgeText}>{service.categoryName || service.category}</Text>
                    </View>
                    <View style={gStyles.servicePriceTag}>
                      <Text style={gStyles.servicePriceText}>₱{service.price?.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={gStyles.serviceBody}>
                    <Text style={gStyles.serviceTitle}>{service.title}</Text>
                    <Text style={gStyles.serviceDesc} numberOfLines={2}>
                      {service.description}
                    </Text>

                    {/* Inclusions Checklist */}
                    <View style={gStyles.inclusionsList}>
                      {service.inclusions?.slice(0, 4).map((inc, i) => (
                        <View key={i} style={gStyles.incItem}>
                          <BootstrapIcon name="check2-circle" size={13} color="#16A34A" />
                          <Text style={gStyles.incItemText} numberOfLines={1}>{inc}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={gStyles.bookServiceBtn}
                      onPress={() => handleOpenBooking(service)}
                      activeOpacity={0.85}
                    >
                      <BootstrapIcon name="calendar-check-fill" size={14} color="#FFFFFF" />
                      <Text style={gStyles.bookServiceBtnText}>Book Pit Bay Slot</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ─── BOOKING MODAL ─── */}
      <Modal visible={isBookingModalOpen} transparent animationType="fade">
        <View style={gStyles.modalOverlay}>
          <View style={gStyles.modalBox}>
            <View style={gStyles.modalHeader}>
              <View>
                <Text style={gStyles.modalTitle}>Book Pitstop Appointment</Text>
                <Text style={gStyles.modalSub}>{selectedService?.title} • ₱{selectedService?.price?.toFixed(2)}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsBookingModalOpen(false)}>
                <BootstrapIcon name="x-lg" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              <View style={gStyles.modalForm}>

                <Text style={gStyles.fieldLabel}>Motorcycle Brand & Model *</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <TextInput
                    style={[gStyles.modalInput, { flex: 1 }]}
                    placeholder="Brand (Yamaha, Ducati...)"
                    value={bikeBrand}
                    onChangeText={setBikeBrand}
                  />
                  <TextInput
                    style={[gStyles.modalInput, { flex: 1.5 }]}
                    placeholder="Model (YZF-R1, Panigale...)"
                    value={bikeModel}
                    onChangeText={setBikeModel}
                  />
                </View>

                <Text style={gStyles.fieldLabel}>Plate Number / Temp Tag *</Text>
                <TextInput
                  style={[gStyles.modalInput, { marginBottom: 12 }]}
                  placeholder="Plate (e.g. 1234-AB)"
                  value={bikePlate}
                  onChangeText={setBikePlate}
                />

                <Text style={gStyles.fieldLabel}>Select Preferred Pitstop Bay *</Text>
                <View style={{ gap: 6, marginBottom: 12 }}>
                  {branches.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[gStyles.branchPickBtn, selectedBranch === b && gStyles.branchPickBtnActive]}
                      onPress={() => setSelectedBranch(b)}
                    >
                      <BootstrapIcon name="geo-alt" size={13} color={selectedBranch === b ? '#0C6258' : '#64748B'} />
                      <Text style={[gStyles.branchPickText, selectedBranch === b && gStyles.branchPickTextActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={gStyles.fieldLabel}>Preferred Date & Time Slot *</Text>
                <TextInput
                  style={[gStyles.modalInput, { marginBottom: 10 }]}
                  placeholder="Date (YYYY-MM-DD)"
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                />

                <View style={gStyles.timeSlotsGrid}>
                  {timeSlots.map((ts) => (
                    <TouchableOpacity
                      key={ts}
                      style={[gStyles.timeSlotPill, selectedTime === ts && gStyles.timeSlotPillActive]}
                      onPress={() => setSelectedTime(ts)}
                    >
                      <Text style={[gStyles.timeSlotText, selectedTime === ts && gStyles.timeSlotTextActive]}>
                        {ts}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={gStyles.fieldLabel}>Rider Name & Phone *</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <TextInput
                    style={[gStyles.modalInput, { flex: 1 }]}
                    placeholder="Owner Name"
                    value={ownerName}
                    onChangeText={setOwnerName}
                  />
                  <TextInput
                    style={[gStyles.modalInput, { flex: 1 }]}
                    placeholder="Contact Number"
                    value={ownerPhone}
                    onChangeText={setOwnerPhone}
                  />
                </View>

                <Text style={gStyles.fieldLabel}>Special Requests / Notes</Text>
                <TextInput
                  style={[gStyles.modalInput, { marginBottom: 16 }]}
                  placeholder="e.g. Please dyno test before and after exhaust installation..."
                  value={serviceNotes}
                  onChangeText={setServiceNotes}
                />

              </View>
            </ScrollView>

            <View style={gStyles.modalFooter}>
              <TouchableOpacity
                style={gStyles.modalCancelBtn}
                onPress={() => setIsBookingModalOpen(false)}
              >
                <Text style={gStyles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={gStyles.modalSubmitBtn}
                onPress={handleConfirmBooking}
              >
                <BootstrapIcon name="check2-circle" size={15} color="#FFFFFF" />
                <Text style={gStyles.modalSubmitText}>Confirm & Book Slot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Persistent Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Garage"
          onTabChange={(tab) => {
            if (tab === 'Home') {
              onNavigateToStore?.();
            } else if (tab === 'Garage') {
              setActiveTab('All');
            } else if (tab === 'Favorites') {
              onNavigateToWishlist?.();
            } else if (tab === 'Admin') {
              onNavigateToAdmin?.();
            } else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.();
              }
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}
    </View>
  );
}

const gStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
  },
  headerInner: {
    maxWidth: 1360,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0C6258',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerNavLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  navLinkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
    paddingVertical: 4,
    paddingLeft: 4,
    borderRadius: 20,
    backgroundColor: '#F3F7F6',
    borderWidth: 1,
    borderColor: '#D1ECE6',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  userNameText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#042F2E',
  },
  signInBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#0F172A',
  },
  signInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  maxContainer: {
    maxWidth: 1360,
    marginHorizontal: 'auto',
    width: '100%',
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  heroLeft: {
    flex: 1.3,
    padding: 36,
    justifyContent: 'center',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: '#0C6258',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroTagText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 13.5,
    color: '#94A3B8',
    lineHeight: 20,
  },
  heroRight: {
    flex: 1,
    minHeight: 220,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  tabBarRow: {
    marginBottom: 20,
  },
  tabButtons: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#0C6258',
    borderColor: '#0C6258',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  serviceImgWrap: {
    width: '100%',
    height: 180,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  serviceImg: {
    width: '100%',
    height: '100%',
  },
  serviceCatBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceCatBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  servicePriceTag: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#0C6258',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  servicePriceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  serviceBody: {
    padding: 16,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  inclusionsList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 6,
    marginBottom: 14,
  },
  incItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  incItemText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  bookServiceBtn: {
    backgroundColor: '#0C6258',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookServiceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bookingsContainer: {
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 16,
  },
  emptyBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  bookingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    width: '48%',
  },
  bookingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bookingId: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0C6258',
  },
  bookingServiceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statusPillConfirmed: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803D',
  },
  bookingDetailsGrid: {
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  bookingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingDetailVal: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  cancelBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  cancelBookingBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 16,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12.5,
    color: '#0C6258',
    fontWeight: '700',
    marginTop: 2,
  },
  modalForm: {
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    outlineStyle: 'none',
  },
  branchPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  branchPickBtnActive: {
    borderColor: '#0C6258',
    backgroundColor: '#F3F7F6',
  },
  branchPickText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  branchPickTextActive: {
    color: '#0C6258',
    fontWeight: '800',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  timeSlotPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  timeSlotPillActive: {
    borderColor: '#0C6258',
    backgroundColor: '#0C6258',
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  timeSlotTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#0C6258',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
