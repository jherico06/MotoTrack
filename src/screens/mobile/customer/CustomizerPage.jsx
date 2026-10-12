import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { customizerStyles as styles } from '../../../styles/customizer.styles.js';
import { usdToPhp } from '../../../utils/currency.js';
import { aiCustomizerService, BIKE_PRESETS, CUSTOM_THEMES } from '../../../services/ai/aiCustomizerService.js';
import { productService } from '../../../services/products/productService.js';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../../../services/bookings/garageService.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { BootstrapIcon, BottomNavBar, ToastNotification, BrandLogo } from '../../../components/common';
import { RegisterMotorcycleModal, CheckoutModal, CartModal } from '../../../components/modals';
import CustomizationWorkspace from '../../../components/customizer/CustomizationWorkspace.jsx';
import AiMotorcycleInstallStudio from '../../../components/customizer/AiMotorcycleInstallStudio.jsx';
import { useCustomizationBuilder } from '../../../hooks/useCustomizationBuilder.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';

export default function CustomizerPage({
  onNavigateToStore,
  onNavigateToGarage,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  onOpenCart,
  initialSelectedProduct,
}) {
  const { currentUser, setRedirectReason } = useAuth();
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const { wishlistCount, addToWishlist } = useWishlist();

  // Parts Builder | Install Studio (Express Gemini/Imagen) | legacy AI Studio
  const [studioMode, setStudioMode] = useState('install'); // 'builder' | 'install' | 'studio'
  const customizationBuilder = useCustomizationBuilder({
    currentUser,
    initialProduct: initialSelectedProduct,
  });

  // ─── 1. WORKFLOW STEP STATE ───
  // 'bike' (1) -> 'parts' (2) -> 'review' (3) -> 'total' (4)
  const [workflowStep, setWorkflowStep] = useState('bike');

  // ─── 2. MOTORCYCLE STATE ───
  const [registeredBikes, setRegisteredBikes] = useState(() => {
    const list = motorcycleService.getMotorcycles(currentUser?.id);
    return Array.isArray(list) && list.length > 0 ? list : motorcycleService.getMotorcycles();
  });
  const [bikeSourceMode, setBikeSourceMode] = useState('all'); // 'all' | 'registered' | 'presets' | 'upload'
  const [selectedRegisteredBike, setSelectedRegisteredBike] = useState(() => {
    const list = motorcycleService.getMotorcycles(currentUser?.id);
    const validList = Array.isArray(list) && list.length > 0 ? list : motorcycleService.getMotorcycles();
    return validList.find((b) => b.is_primary) || validList[0] || null;
  });
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customPhotoUri, setCustomPhotoUri] = useState(null);
  const [customBikeName, setCustomBikeName] = useState(BIKE_PRESETS[0].name);
  const [customBikeBrand, setCustomBikeBrand] = useState(BIKE_PRESETS[0].brand);
  const [isRegisterBikeModalOpen, setIsRegisterBikeModalOpen] = useState(false);

  useEffect(() => {
    const unsub = motorcycleService.subscribe(() => {
      const userBikes = motorcycleService.getMotorcycles(currentUser?.id);
      const bikes =
        Array.isArray(userBikes) && userBikes.length > 0 ? userBikes : motorcycleService.getMotorcycles();
      setRegisteredBikes(bikes);
      if (!selectedRegisteredBike && bikes.length > 0) {
        setSelectedRegisteredBike(bikes.find((b) => b.is_primary) || bikes[0]);
      }
    });
    return () => unsub?.();
  }, [currentUser]);

  useEffect(() => {
    const list = motorcycleService.getMotorcycles(currentUser?.id);
    const bikes = Array.isArray(list) && list.length > 0 ? list : motorcycleService.getMotorcycles();
    setRegisteredBikes(bikes);
    if (!selectedRegisteredBike && bikes.length > 0) {
      setSelectedRegisteredBike(bikes.find((b) => b.is_primary) || bikes[0]);
    }
  }, [currentUser]);

  const activeMotorcycle = useMemo(() => {
    if (selectedRegisteredBike) {
      return selectedRegisteredBike;
    }
    if (selectedPreset) {
      return selectedPreset;
    }
    if (customPhotoUri) {
      return {
        brand: customBikeBrand || 'Custom Motorcycle',
        model: customBikeName || 'Custom Build',
        photo_url: customPhotoUri,
        color: 'Custom Finish',
      };
    }
    return registeredBikes[0] || BIKE_PRESETS[0];
  }, [
    selectedRegisteredBike,
    selectedPreset,
    customBikeBrand,
    customBikeName,
    customPhotoUri,
    registeredBikes,
  ]);

  const currentBasePhoto = useMemo(() => {
    if (selectedRegisteredBike) {
      return selectedRegisteredBike.photo_url || null;
    }
    if (selectedPreset?.image) {
      return selectedPreset.image;
    }
    return customPhotoUri || null;
  }, [selectedRegisteredBike, selectedPreset, customPhotoUri]);

  const currentBikeTitle = useMemo(() => {
    if (selectedRegisteredBike) {
      return `${selectedRegisteredBike.year ? `${selectedRegisteredBike.year} ` : ''}${selectedRegisteredBike.brand} ${selectedRegisteredBike.model}`;
    }
    if (selectedPreset) {
      return selectedPreset.name;
    }
    return customBikeName || 'Custom Motorcycle';
  }, [selectedRegisteredBike, selectedPreset, customBikeName]);

  // ─── 3. CATEGORIES & PARTS CATALOG ───
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchPartQuery, setSearchPartQuery] = useState('');
  const [selectedParts, setSelectedParts] = useState([]);
  const [viewingPartDetails, setViewingPartDetails] = useState(null);
  const [showAddMorePrompt, setShowAddMorePrompt] = useState(false);

  useEffect(() => {
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) {
        setCatalogProducts(data);
        if (initialSelectedProduct) {
          setSelectedParts([initialSelectedProduct]);
        }
      }
    });
  }, [initialSelectedProduct]);

  const categoriesList = useMemo(() => {
    const defaultPriority = ['All', 'Exhaust', 'Wheels', 'Brakes', 'Suspension', 'Accessories', 'Carbon'];
    const found = new Set(catalogProducts.map((p) => p.category).filter(Boolean));
    const merged = [...defaultPriority];
    found.forEach((c) => {
      if (!merged.some((m) => m.toLowerCase() === c.toLowerCase())) {
        merged.push(c);
      }
    });
    return merged;
  }, [catalogProducts]);

  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((item) => {
      const itemCat = (item.category || '').toLowerCase();
      const matchCat =
        selectedCategory === 'All' ||
        itemCat.includes(selectedCategory.toLowerCase()) ||
        (selectedCategory === 'Wheels' && (itemCat.includes('wheel') || itemCat.includes('tire')));
      const matchQuery =
        !searchPartQuery ||
        item.name.toLowerCase().includes(searchPartQuery.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchPartQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [catalogProducts, selectedCategory, searchPartQuery]);

  const liveDiagnostics = useMemo(() => {
    return aiCustomizerService.calculatePerformanceGains(selectedParts, selectedPreset);
  }, [selectedParts, selectedPreset]);

  const partsTotalUsd = useMemo(() => {
    return selectedParts.reduce((sum, p) => sum + Number(p.price || 0), 0);
  }, [selectedParts]);
  const partsTotalPhp = usdToPhp(partsTotalUsd);
  const laborFeePhp = 1500;
  const laborFeeUsd = 26.8;
  const grandTotalPhp = partsTotalPhp + (selectedParts.length > 0 ? laborFeePhp : 0);
  const grandTotalUsd = partsTotalUsd + (selectedParts.length > 0 ? laborFeeUsd : 0);

  // ─── 4. AI PROMPT & PREVIEW STATE ───
  const [selectedThemeId, setSelectedThemeId] = useState(CUSTOM_THEMES[0].id);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isPromptCustomized, setIsPromptCustomized] = useState(false);
  const [userPromptAddon, setUserPromptAddon] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(null);
  const [generationResult, setGenerationResult] = useState(null);
  const [activeViewMode, setActiveViewMode] = useState('generated');

  const synthesizedPromptSentence = useMemo(() => {
    return aiCustomizerService.buildCustomizationPrompt({
      motorcycle: activeMotorcycle,
      selectedParts,
      selectedThemeId,
      customNotes: userPromptAddon,
    });
  }, [activeMotorcycle, selectedParts, selectedThemeId, userPromptAddon]);

  useEffect(() => {
    if (!isPromptCustomized) {
      setCustomPrompt(synthesizedPromptSentence);
    }
  }, [synthesizedPromptSentence, isPromptCustomized]);

  // ─── 5. MODALS & CHECKOUT / BOOKING STATE ───
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingBranch, setBookingBranch] = useState(GARAGE_BRANCHES[0].name);
  const [bookingDate, setBookingDate] = useState('Tomorrow, 10:30 AM');
  const [bookingTimeSlot, setBookingTimeSlot] = useState(TIME_SLOTS[1]);
  const [riderName, setRiderName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [riderPhone, setRiderPhone] = useState(currentUser?.phone || '+63 917 882 9102');
  const [bikePlate, setBikePlate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // ─── ACTIONS ───

  const handleSelectRegisteredBike = (bike) => {
    setSelectedRegisteredBike(bike);
    setSelectedPreset(null);
    setCustomPhotoUri(null);
    setGenerationResult(null);
    if (bike.plate_number) {
      setBikePlate(bike.plate_number);
    }
    setIsPromptCustomized(false);
    showToast(`🏍️ ${bike.brand} ${bike.model} selected from your registered fleet!`);
  };

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setSelectedRegisteredBike(null);
    setCustomPhotoUri(null);
    setCustomBikeName(preset.name);
    setCustomBikeBrand(preset.brand);
    setGenerationResult(null);
    setIsPromptCustomized(false);
    showToast(`🏍️ ${preset.name} preset selected!`);
  };

  const handleUploadBikePhoto = async () => {
    try {
      const res = await pickImageFromFile();
      if (res.success && res.uri) {
        setCustomPhotoUri(res.uri);
        setSelectedPreset(null);
        setSelectedRegisteredBike(null);
        setCustomBikeName('My Custom Motorcycle');
        setIsPromptCustomized(false);
        showToast('📸 Custom motorcycle photo loaded!');
      }
    } catch (_err) {
      showToast('Could not load photo');
    }
  };

  const handleSaveRegisteredBike = async (bikeData) => {
    try {
      const res = await motorcycleService.addMotorcycle({
        ...bikeData,
        user_id: currentUser?.id || 'usr-rider-01',
        customer_id: currentUser?.customer_id || currentUser?.id || 'cust-demo-01',
        customer_email: currentUser?.email || '',
      });
      if (res?.success && res.motorcycle) {
        setSelectedRegisteredBike(res.motorcycle);
        setBikeSourceMode('registered');
        setRegisteredBikes(motorcycleService.getMotorcycles(currentUser?.id));
        showToast(`✓ ${res.motorcycle.brand} ${res.motorcycle.model} registered!`);
      }
    } catch (_err) {
      showToast('Could not register motorcycle.');
    } finally {
      setIsRegisterBikeModalOpen(false);
    }
  };

  // Step 2 Part Actions
  const handleOpenPartDetails = (part) => {
    setViewingPartDetails(part);
  };

  const handleAddPartFromModal = (part) => {
    const exists = selectedParts.some((p) => p.id === part.id || p.product_id === part.id);
    if (!exists) {
      setSelectedParts((prev) => [...prev, part]);
    }
    setViewingPartDetails(null);
    setShowAddMorePrompt(true);
    showToast(`✓ Added ${part.name} to your build!`);
  };

  const handleTogglePartDirect = (product) => {
    const exists = selectedParts.some((p) => p.id === product.id || p.product_id === product.id);
    if (exists) {
      setSelectedParts(selectedParts.filter((p) => p.id !== product.id && p.product_id !== product.id));
    } else {
      setSelectedParts([...selectedParts, product]);
      setShowAddMorePrompt(true);
      showToast(`✓ ${product.name} installed on motorcycle!`);
    }
    if (generationResult) {
      setGenerationResult(null);
    }
  };

  const handleRemoveEquippedPart = (partId) => {
    setSelectedParts((prev) => prev.filter((p) => p.id !== partId && p.product_id !== partId));
    showToast('Part removed from build.');
  };

  // Optional AI Generation
  const handleGenerateAI = async () => {
    if (selectedParts.length === 0) {
      showToast('⚠️ Please select at least 1 product to install on your motorcycle.');
      return;
    }
    if (!currentBasePhoto) {
      showToast('⚠️ Please upload or select a photo of your motorcycle to generate an AI customization.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({
      step: 1,
      totalSteps: 5,
      message: 'Synthesizing 4K neural photograph...',
      percentage: 20,
    });

    try {
      const activePrompt = customPrompt || synthesizedPromptSentence;
      const result = await aiCustomizerService.generateAICustomization({
        motorcycle: activeMotorcycle,
        bikePhotoUri: currentBasePhoto,
        bikeName: currentBikeTitle,
        bikeBrand: activeMotorcycle?.brand || 'MotoTrack',
        selectedParts,
        selectedThemeId,
        customPrompt: activePrompt,
        onProgress: (prog) => setGenerationProgress(prog),
      });

      setGenerationResult(result);
      setActiveViewMode('generated');
      showToast(`⚡ AI render generated for ${result.bikeBrand} ${result.bikeName}!`);
    } catch (err) {
      showToast('AI preview failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handleModifyCustomizeAgain = () => {
    setWorkflowStep('parts');
    setShowAddMorePrompt(false);
  };

  const handleSaveToWishlist = () => {
    if (selectedParts.length === 0) {
      showToast('⚠️ No parts equipped to save.');
      return;
    }
    selectedParts.forEach((p) => {
      addToWishlist(p.id || p.product_id);
    });
    showToast(`❤️ Saved ${selectedParts.length} custom parts to your wishlist!`);
  };

  const handleBuyPartsCheckout = () => {
    if (selectedParts.length === 0) {
      showToast('⚠️ No parts selected for checkout.');
      return;
    }
    selectedParts.forEach((part) => {
      addToCart(part, 1);
    });
    setIsCheckoutModalOpen(true);
  };

  const handleOpenBookingModal = () => {
    if (!currentUser) {
      setRedirectReason('Please sign in to book your installation appointment.');
      onNavigateToLogin?.();
      return;
    }
    setIsBookingModalOpen(true);
  };

  const handleConfirmCustomBooking = async () => {
    if (!riderPhone.trim()) {
      showToast('Please enter your contact phone number');
      return;
    }

    const customizationPayload = generationResult || {
      customizationId: 'AI-CUST-' + Math.floor(10000 + Math.random() * 90000),
      bikeName: currentBikeTitle,
      bikeBrand: activeMotorcycle?.brand || 'MotoTrack',
      selectedParts,
      partsTotalUsd,
      partsTotalPhp,
      generatedImage: currentBasePhoto,
      diagnostics: liveDiagnostics,
    };

    const booking = await aiCustomizerService.bookCustomizationService({
      customizationData: customizationPayload,
      branchName: bookingBranch,
      appointmentDate: bookingDate,
      timeSlot: bookingTimeSlot,
      customerName: riderName || currentUser?.name || 'Rider',
      customerPhone: riderPhone,
      plateNumber: bikePlate || activeMotorcycle?.plate_number || 'Custom Project',
      notes: bookingNotes,
      currentUser,
    });

    setIsBookingModalOpen(false);
    showToast(`🏁 Pitstop installation booked! Ticket #${booking.id}`);
    onNavigateToGarage?.();
  };

  const handleCopyPrompt = () => {
    const textToCopy = customPrompt || synthesizedPromptSentence;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('📋 AI Prompt copied to clipboard!');
      });
    } else {
      showToast('📋 Prompt ready!');
    }
  };

  const handleResetPrompt = () => {
    setIsPromptCustomized(false);
    setUserPromptAddon('');
    setCustomPrompt(synthesizedPromptSentence);
    showToast('🔄 Prompt reset to auto-synthesized spec.');
  };

  const displayedCanvasImage =
    generationResult && activeViewMode === 'generated' ? generationResult.generatedImage : currentBasePhoto;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <ToastNotification message={toastMessage} />

      {/* ─── 1. TOP HEADER ─── */}
      <View style={styles.headerWrapper}>
        <View style={[styles.maxContainer, styles.headerInner]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => onNavigateToStore?.()} activeOpacity={0.8}>
            <BootstrapIcon name="arrow-left" size={15} color="#334155" />
            <Text style={styles.backBtnText}>Store</Text>
          </TouchableOpacity>

          <View style={styles.logoRow}>
            <View style={styles.logoIconBadge}>
              <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.logoTitle}>
              Moto<Text style={styles.logoAccent}>Custom</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => onNavigateToWishlist?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="heart" size={14} color="#334155" />
              {wishlistCount > 0 && (
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4533' }}>{wishlistCount}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: '#1D4533', borderColor: '#1D4533' }]}
              onPress={() => setIsCartModalOpen(true)}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="cart3" size={14} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>{cartItemCount}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── MAIN SCROLL CONTENT ─── */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.maxContainer}>
          <AiMotorcycleInstallStudio
            currentUser={currentUser}
            onRequireLogin={() => {
              setRedirectReason?.('ai-install');
              onNavigateToLogin?.();
            }}
          />
        </View>
      </ScrollView>

      {/* ─── PART DETAILS & PRICE MODAL ─── */}
      <Modal visible={viewingPartDetails !== null} transparent animationType="slide">
        <View style={styles.partModalOverlay}>
          {viewingPartDetails && (
            <View style={styles.partModalSheet}>
              <View style={styles.partModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="info-circle-fill" size={16} color="#1D4533" />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                    Part Details & Price
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setViewingPartDetails(null)}>
                  <BootstrapIcon name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.partModalImgBox}>
                <Image
                  source={{ uri: viewingPartDetails.image }}
                  style={styles.partModalImg}
                  resizeMode="cover"
                />
                <View style={styles.partModalBadge}>
                  <Text style={styles.partModalBadgeText}>
                    {viewingPartDetails.category || 'Performance'}
                  </Text>
                </View>
              </View>

              <Text style={styles.partModalTitle}>{viewingPartDetails.name}</Text>
              <Text style={styles.partModalBrand}>{viewingPartDetails.brand}</Text>

              <View style={styles.partModalPriceRow}>
                <Text style={styles.partModalPricePhp}>
                  ₱{usdToPhp(viewingPartDetails.price || 0).toLocaleString()}
                </Text>
                <Text style={styles.partModalPriceUsd}>
                  ${Number(viewingPartDetails.price || 0).toFixed(2)} USD
                </Text>
              </View>

              <View style={styles.partModalSpecsRow}>
                <View style={styles.partModalSpecChip}>
                  <BootstrapIcon name="check-circle" size={11} color="#1D4533" />
                  <Text style={styles.partModalSpecText}>
                    Fits {activeMotorcycle?.brand} {activeMotorcycle?.model}
                  </Text>
                </View>
              </View>

              <View style={styles.partModalActions}>
                <TouchableOpacity
                  style={styles.partModalAddBtn}
                  onPress={() => handleAddPartFromModal(viewingPartDetails)}
                  activeOpacity={0.9}
                >
                  <BootstrapIcon name="plus-circle-fill" size={14} color="#FFFFFF" />
                  <Text style={styles.partModalAddBtnText}>Add Part</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.partModalCancelBtn}
                  onPress={() => setViewingPartDetails(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.partModalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ─── CHECKOUT MODAL ─── */}
      <CheckoutModal
        visible={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        onCompleteOrder={() => {
          setIsCheckoutModalOpen(false);
          showToast('🎉 Order placed successfully! Check your orders in dashboard.');
          onNavigateToOrders?.();
        }}
        onOpenProfile={() => {
          setIsCheckoutModalOpen(false);
          onNavigateToProfile?.('profile');
        }}
      />

      {/* ─── CART MODAL ─── */}
      <CartModal
        visible={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        onProceedToCheckout={() => {
          setIsCartModalOpen(false);
          setIsCheckoutModalOpen(true);
        }}
      />

      {/* ─── BOOKING MODAL (PITSTOP SERVICE) ─── */}
      <Modal visible={isBookingModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="calendar-check-fill" size={16} color="#1D4533" />
                <Text style={styles.modalTitle}>Book Installation Pitstop</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsBookingModalOpen(false)}>
                <BootstrapIcon name="x" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              <Text style={styles.formLabel}>Selected Motorcycle</Text>
              <View
                style={{
                  backgroundColor: '#F1F5F9',
                  padding: 8,
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>{currentBikeTitle}</Text>
                <Text style={{ fontSize: 10.5, color: '#64748B' }}>
                  {selectedParts.length} Custom Parts to be Installed
                </Text>
              </View>

              <Text style={styles.formLabel}>Select Pitstop Bay Location *</Text>
              {GARAGE_BRANCHES.map((b) => (
                <TouchableOpacity
                  key={b.name}
                  style={[styles.branchBtn, bookingBranch === b.name && styles.branchBtnActive]}
                  onPress={() => setBookingBranch(b.name)}
                >
                  <Text style={styles.branchText}>{b.name}</Text>
                  <Text style={styles.branchSub}>{b.address}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.formLabel, { marginTop: 8 }]}>Preferred Time Slot *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {TIME_SLOTS.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotChip, bookingTimeSlot === slot && styles.slotChipActive]}
                    onPress={() => setBookingTimeSlot(slot)}
                  >
                    <Text style={[styles.slotText, bookingTimeSlot === slot && styles.slotTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { marginTop: 8 }]}>Contact Phone Number *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+63 9XX XXX XXXX"
                placeholderTextColor="#64748B"
                value={riderPhone}
                onChangeText={setRiderPhone}
              />

              <Text style={styles.formLabel}>Fitting Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 50 }]}
                placeholder="Mechanic notes..."
                placeholderTextColor="#64748B"
                multiline
                value={bookingNotes}
                onChangeText={setBookingNotes}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.generateCtaBtn, { marginTop: 12 }]}
              onPress={handleConfirmCustomBooking}
              activeOpacity={0.9}
            >
              <BootstrapIcon name="check-circle-fill" size={15} color="#FFFFFF" />
              <Text style={styles.generateCtaText}>Confirm Pitstop Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── REGISTER MOTORCYCLE MODAL ─── */}
      <RegisterMotorcycleModal
        visible={isRegisterBikeModalOpen}
        onClose={() => setIsRegisterBikeModalOpen(false)}
        onSave={handleSaveRegisteredBike}
      />

      {/* Persistent Bottom Nav Bar */}
      <BottomNavBar
        activeTab="Customize"
        onTabChange={(tab) => {
          if (tab === 'Home') onNavigateToStore?.();
          else if (tab === 'Garage') onNavigateToGarage?.();
          else if (tab === 'Orders') onNavigateToOrders?.();
          else if (tab === 'Wishlist' || tab === 'Favorites') onNavigateToWishlist?.();
          else if (tab === 'More') {
            if (!currentUser) {
              setRedirectReason('');
              onNavigateToLogin?.();
            } else {
              onNavigateToProfile?.('menu');
            }
          } else if (tab === 'Dashboard') {
            if (!currentUser) {
              setRedirectReason('');
              onNavigateToLogin?.();
            } else {
              onNavigateToProfile?.('overview');
            }
          } else if (tab === 'Bookings') {
            if (!currentUser) {
              setRedirectReason('');
              onNavigateToLogin?.();
            } else {
              onNavigateToProfile?.('bookings');
            }
          } else if (tab === 'Notifications') {
            onNavigateToProfile?.('notifications');
          } else if (tab === 'Profile') {
            if (!currentUser) {
              setRedirectReason('');
              onNavigateToLogin?.();
            } else {
              onNavigateToProfile?.('profile');
            }
          } else if (tab === 'Admin') {
            onNavigateToAdmin?.();
          }
        }}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
