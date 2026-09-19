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
import { customizerStyles as styles } from '../styles/customizer.styles';
import { usdToPhp } from '../utils/currency';
import { aiCustomizerService, BIKE_PRESETS, CUSTOM_THEMES } from '../services/aiCustomizerService';
import { productService } from '../services/productService';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../services/garageService';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../services/motorcycleService';
import { BootstrapIcon, BottomNavBar, ToastNotification, BrandLogo } from '../components/common';
import { RegisterMotorcycleModal, CheckoutModal, CartModal } from '../components/modals';
import { pickImageFromFile } from '../utils/imagePickerHelper';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

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
      const bikes = Array.isArray(userBikes) && userBikes.length > 0 ? userBikes : motorcycleService.getMotorcycles();
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
  }, [selectedRegisteredBike, selectedPreset, customBikeBrand, customBikeName, customPhotoUri, registeredBikes]);

  const currentBasePhoto = useMemo(() => {
    if (selectedRegisteredBike?.photo_url) {
      return selectedRegisteredBike.photo_url;
    }
    if (selectedPreset?.image) {
      return selectedPreset.image;
    }
    return customPhotoUri || registeredBikes[0]?.photo_url || BIKE_PRESETS[0]?.image;
  }, [selectedRegisteredBike, selectedPreset, customPhotoUri, registeredBikes]);

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
      <StatusBar style="dark" />
      <ToastNotification message={toastMessage} />

      {/* ─── 1. TOP HEADER ─── */}
      <View style={styles.headerWrapper}>
        <View style={[styles.maxContainer, styles.headerInner]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => onNavigateToStore?.()}
            activeOpacity={0.8}
          >
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
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0C6258' }}>
                  {wishlistCount}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: '#0C6258', borderColor: '#0C6258' }]}
              onPress={() => setIsCartModalOpen(true)}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="cart3" size={14} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                  {cartItemCount}
                </Text>
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
          {/* ─── MINIMALIST STEPPER ─── */}
          <View style={styles.workflowStepperCard}>
            <View style={styles.stepperTrack}>
              {/* Step 1 */}
              <TouchableOpacity
                style={[styles.stepItem, workflowStep === 'bike' && styles.stepItemActive]}
                onPress={() => setWorkflowStep('bike')}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.stepBadge,
                    workflowStep === 'bike' && styles.stepBadgeActive,
                    workflowStep !== 'bike' && styles.stepBadgeDone,
                  ]}
                >
                  {workflowStep !== 'bike' ? (
                    <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.stepBadgeText, styles.stepBadgeTextActive]}>1</Text>
                  )}
                </View>
                <View style={styles.stepLabelWrap}>
                  <Text style={[styles.stepLabel, workflowStep === 'bike' && styles.stepLabelActive]}>
                    Motorcycle
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.stepConnector,
                  ['parts', 'review', 'total'].includes(workflowStep) && styles.stepConnectorActive,
                ]}
              />

              {/* Step 2 */}
              <TouchableOpacity
                style={[styles.stepItem, workflowStep === 'parts' && styles.stepItemActive]}
                onPress={() => setWorkflowStep('parts')}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.stepBadge,
                    workflowStep === 'parts' && styles.stepBadgeActive,
                    ['review', 'total'].includes(workflowStep) && styles.stepBadgeDone,
                  ]}
                >
                  {['review', 'total'].includes(workflowStep) ? (
                    <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepBadgeText,
                        workflowStep === 'parts' && styles.stepBadgeTextActive,
                      ]}
                    >
                      2
                    </Text>
                  )}
                </View>
                <View style={styles.stepLabelWrap}>
                  <Text style={[styles.stepLabel, workflowStep === 'parts' && styles.stepLabelActive]}>
                    Parts ({selectedParts.length})
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.stepConnector,
                  ['review', 'total'].includes(workflowStep) && styles.stepConnectorActive,
                ]}
              />

              {/* Step 3 */}
              <TouchableOpacity
                style={[styles.stepItem, workflowStep === 'review' && styles.stepItemActive]}
                onPress={() => setWorkflowStep('review')}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.stepBadge,
                    workflowStep === 'review' && styles.stepBadgeActive,
                    workflowStep === 'total' && styles.stepBadgeDone,
                  ]}
                >
                  {workflowStep === 'total' ? (
                    <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepBadgeText,
                        workflowStep === 'review' && styles.stepBadgeTextActive,
                      ]}
                    >
                      3
                    </Text>
                  )}
                </View>
                <View style={styles.stepLabelWrap}>
                  <Text style={[styles.stepLabel, workflowStep === 'review' && styles.stepLabelActive]}>
                    Review
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.stepConnector,
                  workflowStep === 'total' && styles.stepConnectorActive,
                ]}
              />

              {/* Step 4 */}
              <TouchableOpacity
                style={[styles.stepItem, workflowStep === 'total' && styles.stepItemActive]}
                onPress={() => setWorkflowStep('total')}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.stepBadge,
                    workflowStep === 'total' && styles.stepBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepBadgeText,
                      workflowStep === 'total' && styles.stepBadgeTextActive,
                    ]}
                  >
                    4
                  </Text>
                </View>
                <View style={styles.stepLabelWrap}>
                  <Text style={[styles.stepLabel, workflowStep === 'total' && styles.stepLabelActive]}>
                    Total
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 1: SELECT MOTORCYCLE
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'bike' && (
            <View>
              <View style={styles.workbenchCard}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>1. Select Motorcycle</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      Brand / Model / Year fitment
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.emptyRegBikesBtn, { backgroundColor: '#0C6258', paddingHorizontal: 10 }]}
                    onPress={() => setIsRegisterBikeModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="plus-circle-fill" size={12} color="#FFFFFF" />
                    <Text style={[styles.emptyRegBikesBtnText, { fontSize: 11 }]}>+ Register</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter Tabs: All Options | My Garage | Presets | Upload */}
                <View style={styles.bikeSourceTabs}>
                  <TouchableOpacity
                    style={[styles.bikeSourceTab, bikeSourceMode === 'all' && styles.bikeSourceTabActive]}
                    onPress={() => setBikeSourceMode('all')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'all' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bikeSourceTab, bikeSourceMode === 'registered' && styles.bikeSourceTabActive]}
                    onPress={() => setBikeSourceMode('registered')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'registered' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      Registered Garage ({registeredBikes.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bikeSourceTab, bikeSourceMode === 'presets' && styles.bikeSourceTabActive]}
                    onPress={() => setBikeSourceMode('presets')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'presets' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      Presets ({BIKE_PRESETS.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bikeSourceTab, bikeSourceMode === 'upload' && styles.bikeSourceTabActive]}
                    onPress={() => setBikeSourceMode('upload')}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'upload' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      Upload
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ─── SECTION 1: CHOOSE FROM REGISTERED MOTORCYCLES ─── */}
                {(bikeSourceMode === 'all' || bikeSourceMode === 'registered') && (
                  <View style={{ marginBottom: 16 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <BootstrapIcon name="bicycle" size={14} color="#0C6258" />
                        <Text
                          style={[
                            styles.formLabel,
                            {
                              marginBottom: 0,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              color: '#0F172A',
                              fontWeight: '800',
                              fontSize: 11,
                            },
                          ]}
                        >
                          Choose From Your Registered Motorcycles:
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setIsRegisterBikeModalOpen(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0C6258' }}>
                          + Register Bike
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {registeredBikes.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.registeredBikesScroll}
                      >
                        {registeredBikes.map((bike) => {
                          const isSelected = selectedRegisteredBike?.motorcycle_id === bike.motorcycle_id;
                          return (
                            <TouchableOpacity
                              key={bike.motorcycle_id}
                              style={[styles.regBikeCard, isSelected && styles.regBikeCardActive]}
                              onPress={() => handleSelectRegisteredBike(bike)}
                              activeOpacity={0.85}
                            >
                              <Image
                                source={{ uri: bike.photo_url || MOTORCYCLE_PHOTO_PRESETS[0]?.url }}
                                style={styles.regBikeThumb}
                                resizeMode="cover"
                              />
                              <View style={styles.regBikeHeader}>
                                <Text style={styles.regBikeTitle} numberOfLines={1}>
                                  {bike.year ? `${bike.year} ` : ''}{bike.brand} {bike.model}
                                </Text>
                                <View
                                  style={[
                                    styles.checkboxCircle,
                                    isSelected && styles.checkboxCircleSelected,
                                    { width: 18, height: 18 },
                                  ]}
                                >
                                  {isSelected && <BootstrapIcon name="check" size={11} color="#FFFFFF" />}
                                </View>
                              </View>

                              {bike.nickname ? (
                                <Text style={styles.regBikeNickname} numberOfLines={1}>
                                  "{bike.nickname}"
                                </Text>
                              ) : null}

                              <View style={styles.regBikeMetaRow}>
                                {bike.plate_number && (
                                  <View style={styles.regBikePlateBadge}>
                                    <Text style={styles.regBikePlateText}>{bike.plate_number}</Text>
                                  </View>
                                )}
                                {bike.is_primary && (
                                  <View style={styles.regBikePrimaryTag}>
                                    <Text style={styles.regBikePrimaryTagText}>Primary</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Quick Register Card */}
                        <TouchableOpacity
                          style={[
                            styles.regBikeCard,
                            {
                              borderStyle: 'dashed',
                              backgroundColor: '#F8FAFC',
                              justifyContent: 'center',
                              alignItems: 'center',
                              width: 140,
                            },
                          ]}
                          onPress={() => setIsRegisterBikeModalOpen(true)}
                          activeOpacity={0.85}
                        >
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              backgroundColor: '#D1ECE6',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginBottom: 6,
                            }}
                          >
                            <BootstrapIcon name="plus-lg" size={18} color="#0C6258" />
                          </View>
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: '700',
                              color: '#0C6258',
                              textAlign: 'center',
                            }}
                          >
                            + Add Registered Bike
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    ) : (
                      <View style={styles.emptyRegBikesBox}>
                        <BootstrapIcon name="info-circle" size={20} color="#0C6258" />
                        <Text style={styles.emptyRegBikesText}>
                          No bikes registered yet in your garage. Tap Register below or pick a preset!
                        </Text>
                        <TouchableOpacity
                          style={styles.emptyRegBikesBtn}
                          onPress={() => setIsRegisterBikeModalOpen(true)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.emptyRegBikesBtnText}>+ Register Bike</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* ─── SECTION 2: CHOOSE FROM PRESETS ─── */}
                {(bikeSourceMode === 'all' || bikeSourceMode === 'presets') && (
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={[
                        styles.formLabel,
                        {
                          marginTop: 4,
                          marginBottom: 8,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: '#0F172A',
                          fontWeight: '800',
                          fontSize: 11,
                        },
                      ]}
                    >
                      ...Or Choose From Superbike & Scooter Presets:
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.presetBikesScroll}
                    >
                      {BIKE_PRESETS.map((preset) => {
                        const isSelected =
                          selectedPreset?.id === preset.id && !selectedRegisteredBike && !customPhotoUri;
                        return (
                          <TouchableOpacity
                            key={preset.id}
                            style={[styles.presetBikeCard, isSelected && styles.presetBikeCardActive]}
                            onPress={() => handleSelectPreset(preset)}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: preset.image }}
                              style={styles.presetBikeImg}
                              resizeMode="cover"
                            />
                            <View style={styles.presetBikeBody}>
                              <Text style={styles.presetBikeName} numberOfLines={1}>
                                {preset.name}
                              </Text>
                              <Text style={styles.presetBikeBrand}>{preset.brand}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* ─── SECTION 3: UPLOAD CUSTOM PHOTO ─── */}
                {(bikeSourceMode === 'all' || bikeSourceMode === 'upload') && (
                  <View style={{ marginBottom: 14 }}>
                    <Text
                      style={[
                        styles.formLabel,
                        {
                          marginBottom: 6,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: '#64748B',
                          fontWeight: '700',
                          fontSize: 10.5,
                        },
                      ]}
                    >
                      ...Or Upload Custom Motorcycle Photo:
                    </Text>
                    <TouchableOpacity
                      style={[styles.uploadBox, customPhotoUri && styles.uploadBoxActive]}
                      onPress={handleUploadBikePhoto}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon
                        name={customPhotoUri ? 'check-circle-fill' : 'camera-fill'}
                        size={22}
                        color={customPhotoUri ? '#0C6258' : '#94A3B8'}
                      />
                      <Text style={styles.uploadTitle}>
                        {customPhotoUri ? 'Custom Bike Photo Loaded' : 'Upload Bike Photo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ─── SECTION 4: SELECTED MOTORCYCLE BANNER & NEXT CTA ─── */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 14,
                    padding: 14,
                    marginTop: 8,
                    borderWidth: 1.5,
                    borderColor: '#0C6258',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Image
                      source={{ uri: currentBasePhoto }}
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 10,
                        backgroundColor: '#0F172A',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                      }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#0C6258' }}>
                          SELECTED MOTORCYCLE
                        </Text>
                        {selectedRegisteredBike ? (
                          <View
                            style={{
                              backgroundColor: '#0C6258',
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                              REGISTERED
                            </Text>
                          </View>
                        ) : selectedPreset ? (
                          <View
                            style={{
                              backgroundColor: '#0F172A',
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                              PRESET
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              backgroundColor: '#475569',
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                              UPLOAD
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
                        {currentBikeTitle}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        {selectedRegisteredBike
                          ? `Plate: ${selectedRegisteredBike.plate_number || 'N/A'} • ${selectedRegisteredBike.color || 'Standard'}`
                          : selectedPreset
                          ? `${selectedPreset.brand} • ${selectedPreset.category}`
                          : 'Custom photo'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.reviewActionPrimaryBtn}
                    onPress={() => setWorkflowStep('parts')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.reviewActionPrimaryText}>
                      Confirm Motorcycle & Choose Parts ➔
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 2: CHOOSE CATEGORY & PARTS
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'parts' && (
            <View>
              {/* Motorcycle Preview Card */}
              <View style={styles.canvasCard}>
                <View style={styles.canvasImageContainer}>
                  <Image
                    source={{ uri: displayedCanvasImage }}
                    style={styles.canvasImage}
                    resizeMode="cover"
                  />
                  <View style={styles.canvasOverlayHeader}>
                    <View style={styles.bikeTagBadge}>
                      <BootstrapIcon name="bicycle" size={13} color="#0C6258" />
                      <Text style={styles.bikeTagText} numberOfLines={1}>
                        {currentBikeTitle}
                      </Text>
                    </View>
                    <View style={[styles.regBikePlateBadge, { backgroundColor: 'rgba(15,23,42,0.85)' }]}>
                      <Text style={[styles.regBikePlateText, { color: '#F8FAFC' }]}>
                        {selectedParts.length} Equipped
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Add More Customizations Banner */}
              {selectedParts.length > 0 && (
                <View style={styles.addMorePromptBanner}>
                  <View style={styles.addMorePromptLeft}>
                    <View style={styles.addMoreIconWrap}>
                      <BootstrapIcon name="tools" size={16} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addMorePromptTitle}>
                        {selectedParts.length} {selectedParts.length === 1 ? 'Part' : 'Parts'} Installed
                      </Text>
                      <Text style={styles.addMorePromptSub}>
                        Add more customizations (Wheels, Exhaust, Accessories)?
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addMoreBtnGroup}>
                    <TouchableOpacity
                      style={styles.addMoreBtnYes}
                      onPress={() => showToast('Select another category or part below.')}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="plus" size={13} color="#FFFFFF" />
                      <Text style={styles.addMoreBtnYesText}>YES, Add More</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.addMoreBtnNo}
                      onPress={() => setWorkflowStep('review')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.addMoreBtnNoText}>NO, Review ➔</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Categories Bar */}
              <View style={styles.workbenchCard}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeading}>2. Choose Customization Category</Text>
                  <Text style={{ fontSize: 11, color: '#0C6258', fontWeight: '700' }}>
                    {selectedParts.length} Parts
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.partsCategoryScroll}
                >
                  {categoriesList.map((cat) => {
                    const isCatActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.partsCategoryChip, isCatActive && styles.partsCategoryChipActive]}
                        onPress={() => setSelectedCategory(cat)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.partsCategoryText,
                            isCatActive && styles.partsCategoryTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Search */}
                <View style={styles.partsSearchBox}>
                  <BootstrapIcon name="search" size={13} color="#64748B" />
                  <TextInput
                    style={styles.partsSearchInput}
                    placeholder={`Search ${selectedCategory} parts...`}
                    placeholderTextColor="#64748B"
                    value={searchPartQuery}
                    onChangeText={setSearchPartQuery}
                  />
                  {searchPartQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchPartQuery('')}>
                      <BootstrapIcon name="x-circle-fill" size={13} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Parts List */}
                <ScrollView style={styles.partsListContainer} showsVerticalScrollIndicator={true}>
                  {filteredCatalog.map((product) => {
                    const isSelected = selectedParts.some(
                      (p) => p.id === product.id || p.product_id === product.id
                    );
                    return (
                      <TouchableOpacity
                        key={product.id || product.product_id}
                        style={[styles.partItemCard, isSelected && styles.partItemCardSelected]}
                        onPress={() => handleOpenPartDetails(product)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: product.image }} style={styles.partThumb} resizeMode="cover" />

                        <View style={styles.partInfo}>
                          <Text style={styles.partName} numberOfLines={1}>
                            {product.name}
                          </Text>
                          <Text style={styles.partMeta}>
                            {product.brand} • {product.category}
                          </Text>
                          {isSelected && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                              <BootstrapIcon name="check2-circle" size={11} color="#0C6258" />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#0C6258' }}>
                                Installed on {activeMotorcycle?.model || 'Bike'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.partPriceRow}>
                          <Text style={styles.partPricePhp}>
                            ₱{usdToPhp(product.price || 0).toLocaleString()}
                          </Text>
                          <Text style={styles.partPriceUsd}>${Number(product.price || 0).toFixed(0)}</Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected]}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            handleTogglePartDirect(product);
                          }}
                        >
                          {isSelected && <BootstrapIcon name="check" size={13} color="#FFFFFF" />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Subtotal & Next CTA */}
                <View style={styles.selectedTray}>
                  <View style={styles.selectedTrayHeader}>
                    <Text style={styles.selectedTrayTitle}>Parts Total:</Text>
                    <Text style={styles.selectedTrayTotal}>
                      ₱{partsTotalPhp.toLocaleString()} (${partsTotalUsd.toFixed(2)})
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={styles.reviewActionSecondaryBtn}
                      onPress={() => setWorkflowStep('bike')}
                      activeOpacity={0.8}
                    >
                      <BootstrapIcon name="arrow-left" size={13} color="#334155" />
                      <Text style={styles.reviewActionSecondaryText}>Bike</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.reviewActionPrimaryBtn,
                        { flex: 2, marginTop: 0 },
                        selectedParts.length === 0 && { opacity: 0.6 },
                      ]}
                      onPress={() => setWorkflowStep('review')}
                      disabled={selectedParts.length === 0}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.reviewActionPrimaryText}>
                        Review Customization ➔
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 3: REVIEW CUSTOMIZATION & AI PREVIEW (OPTIONAL)
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'review' && (
            <View>
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeaderRow}>
                  <View style={styles.reviewBikeBadge}>
                    <Image
                      source={{ uri: currentBasePhoto }}
                      style={styles.reviewBikeThumb}
                      resizeMode="cover"
                    />
                    <View>
                      <Text style={styles.reviewBikeTitle}>{currentBikeTitle}</Text>
                      <Text style={styles.reviewBikeSub}>
                        {activeMotorcycle?.brand} • {selectedParts.length} Parts Fitted
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.reviewActionSecondaryBtn, { minWidth: 80 }]}
                    onPress={handleModifyCustomizeAgain}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="pencil" size={12} color="#334155" />
                    <Text style={styles.reviewActionSecondaryText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Equipped list */}
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                  Custom Parts ({selectedParts.length})
                </Text>

                <View style={styles.reviewPartsList}>
                  {selectedParts.map((part) => (
                    <View key={part.id || part.product_id} style={styles.reviewPartRow}>
                      <View style={styles.reviewPartLeft}>
                        <Image source={{ uri: part.image }} style={styles.reviewPartThumb} resizeMode="cover" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewPartName} numberOfLines={1}>
                            {part.name}
                          </Text>
                          <Text style={styles.reviewPartMeta}>{part.brand}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.reviewPartPrice}>
                          ₱{usdToPhp(part.price || 0).toLocaleString()}
                        </Text>
                        <TouchableOpacity
                          style={styles.reviewPartRemoveBtn}
                          onPress={() => handleRemoveEquippedPart(part.id || part.product_id)}
                        >
                          <BootstrapIcon name="trash" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* AI Preview Section */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 14,
                    padding: 14,
                    marginVertical: 14,
                    borderWidth: 1.5,
                    borderColor: '#D1ECE6',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <BootstrapIcon name="magic" size={15} color="#0C6258" />
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                        Generate AI Preview (Optional)
                      </Text>
                    </View>
                    <View style={styles.formedPromptBadge}>
                      <Text style={styles.formedPromptBadgeText}>AI 4K</Text>
                    </View>
                  </View>

                  <View style={styles.formedPromptTextBox}>
                    <Text style={styles.formedPromptSentence} numberOfLines={3}>
                      "{customPrompt || synthesizedPromptSentence}"
                    </Text>
                  </View>

                  <TextInput
                    style={[styles.customPromptInput, { marginTop: 4, marginBottom: 8, fontSize: 11 }]}
                    placeholder="Add rider styling notes (e.g. night lighting)..."
                    placeholderTextColor="#94A3B8"
                    value={userPromptAddon}
                    onChangeText={(val) => {
                      setUserPromptAddon(val);
                      setIsPromptCustomized(true);
                    }}
                  />

                  <TouchableOpacity
                    style={[styles.generateCtaBtn, { marginBottom: 0, paddingVertical: 11 }]}
                    onPress={handleGenerateAI}
                    disabled={isGenerating}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="stars" size={15} color="#FFFFFF" />
                    <Text style={[styles.generateCtaText, { fontSize: 13 }]}>
                      {isGenerating ? 'Generating Photo...' : '⚡ Generate AI Photo Preview'}
                    </Text>
                  </TouchableOpacity>

                  {generationResult && (
                    <View style={{ marginTop: 12, position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                      <Image
                        source={{ uri: displayedCanvasImage }}
                        style={{ width: '100%', height: 220, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={[
                          styles.toggleViewBtn,
                          { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(15,23,42,0.85)' },
                        ]}
                        onPress={() =>
                          setActiveViewMode((prev) => (prev === 'generated' ? 'original' : 'generated'))
                        }
                      >
                        <BootstrapIcon
                          name={activeViewMode === 'generated' ? 'eye-fill' : 'arrow-repeat'}
                          size={12}
                          color="#FFFFFF"
                        />
                        <Text style={styles.toggleViewBtnText}>
                          {activeViewMode === 'generated' ? 'Original' : 'AI Custom'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Review Actions: Modify | Wishlist | Total */}
                <View style={styles.reviewActionsRow}>
                  <TouchableOpacity
                    style={styles.reviewActionSecondaryBtn}
                    onPress={handleModifyCustomizeAgain}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="arrow-repeat" size={14} color="#334155" />
                    <Text style={styles.reviewActionSecondaryText}>Modify Parts</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reviewActionSecondaryBtn}
                    onPress={handleSaveToWishlist}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="heart-fill" size={14} color="#EF4444" />
                    <Text style={styles.reviewActionSecondaryText}>Wishlist</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reviewActionPrimaryBtn}
                    onPress={() => setWorkflowStep('total')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.reviewActionPrimaryText}>
                      View Estimated Total ➔
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 4: ESTIMATED TOTAL & DUAL ACTIONS
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'total' && (
            <View>
              <View style={styles.totalBreakdownCard}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>4. Estimated Total & Action</Text>
                    <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      Itemized parts & pitstop installation
                    </Text>
                  </View>
                </View>

                <View style={{ marginVertical: 10 }}>
                  {selectedParts.map((part) => (
                    <View key={part.id || part.product_id} style={styles.totalRowItem}>
                      <Text style={styles.totalRowLabel} numberOfLines={1}>
                        {part.name}
                      </Text>
                      <Text style={styles.totalRowValue}>
                        ₱{usdToPhp(part.price || 0).toLocaleString()}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.totalRowItem}>
                    <Text style={styles.totalRowLabel}>Parts Subtotal</Text>
                    <Text style={styles.totalRowValue}>
                      ₱{partsTotalPhp.toLocaleString()} (${partsTotalUsd.toFixed(2)})
                    </Text>
                  </View>

                  <View style={styles.totalRowItem}>
                    <Text style={styles.totalRowLabel}>Pitstop Installation Labor</Text>
                    <Text style={styles.totalRowValue}>
                      ₱{laborFeePhp.toLocaleString()} (${laborFeeUsd.toFixed(2)})
                    </Text>
                  </View>

                  <View style={styles.totalGrandBox}>
                    <View>
                      <Text style={styles.totalGrandLabel}>Total Investment</Text>
                      <Text style={{ fontSize: 10.5, color: '#0C6258' }}>Parts + Fitting</Text>
                    </View>
                    <Text style={styles.totalGrandAmount}>
                      ₱{grandTotalPhp.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Dual Actions: Buy Parts vs Book Installation */}
                <View style={styles.dualActionContainer}>
                  <TouchableOpacity
                    style={styles.buyPartsCheckoutBtn}
                    onPress={handleBuyPartsCheckout}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="cart-check-fill" size={16} color="#FFFFFF" />
                    <Text style={styles.buyPartsCheckoutText}>Buy Parts (Checkout)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bookInstallServiceBtn}
                    onPress={handleOpenBookingModal}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="calendar-check-fill" size={16} color="#10B981" />
                    <Text style={styles.bookInstallServiceText}>Book Installation</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.reviewActionSecondaryBtn, { marginTop: 14 }]}
                  onPress={() => setWorkflowStep('review')}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="arrow-left" size={13} color="#334155" />
                  <Text style={styles.reviewActionSecondaryText}>Back to Review</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── PART DETAILS & PRICE MODAL ─── */}
      <Modal visible={viewingPartDetails !== null} transparent animationType="slide">
        <View style={styles.partModalOverlay}>
          {viewingPartDetails && (
            <View style={styles.partModalSheet}>
              <View style={styles.partModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BootstrapIcon name="info-circle-fill" size={16} color="#0C6258" />
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
                  <BootstrapIcon name="check-circle" size={11} color="#0C6258" />
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
                <BootstrapIcon name="calendar-check-fill" size={16} color="#0C6258" />
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
                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 12 }}>
                  {currentBikeTitle}
                </Text>
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
          else if (tab === 'Favorites') onNavigateToWishlist?.();
          else if (tab === 'Dashboard') {
            if (!currentUser) {
              setRedirectReason('');
              onNavigateToLogin?.();
            } else {
              onNavigateToProfile?.('overview');
            }
          } else if (tab === 'Profile') {
            if (!currentUser) {
              setRedirectReason('');
              onNavigateToLogin?.();
            } else {
              onNavigateToProfile?.('profile');
            }
          }
        }}
        currentUser={currentUser}
      />
    </SafeAreaView>
  );
}
