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
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { customizerWebStyles as styles } from '../styles/web/customizer.web.styles';
import { usdToPhp } from '../utils/currency';
import { aiCustomizerService, BIKE_PRESETS, CUSTOM_THEMES } from '../services/aiCustomizerService';
import { productService } from '../services/productService';
import { geminiService } from '../services/geminiService';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../services/garageService';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../services/motorcycleService';
import { notificationService } from '../services/notificationService';
import {
  BootstrapIcon,
  BottomNavBar,
  ToastNotification,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  NotificationDropdown,
} from '../components/common';
import {
  LiveOrderTrackingMapModal,
  RegisterMotorcycleModal,
  CheckoutModal,
  CartModal,
} from '../components/modals';
import { pickImageFromFile } from '../utils/imagePickerHelper';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function CustomizerPageWeb({
  onNavigateToStore,
  onNavigateToGarage,
  onNavigateToWishlist,
  onNavigateToOrders,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToAdmin,
  initialSelectedProduct,
  onLogout,
  onOpenCart,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const { currentUser, logout, setRedirectReason } = useAuth();
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const { wishlistCount, addToWishlist } = useWishlist();

  // ─── NOTIFICATION STATE ───
  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    notificationService.getUnreadCount(currentUser?.id)
  );
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(notificationService.getUnreadCount(currentUser?.id));
    });
    return () => unsub?.();
  }, [currentUser]);

  // ─── 1. WORKFLOW STEP STATE ───
  // Steps: 'bike' (1) -> 'parts' (2) -> 'review' (3) -> 'total' (4)
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

  // Active motorcycle object
  const activeMotorcycle = useMemo(() => {
    if (bikeSourceMode === 'registered' && selectedRegisteredBike) {
      return selectedRegisteredBike;
    }
    if (bikeSourceMode === 'presets' && selectedPreset) {
      return selectedPreset;
    }
    if (selectedRegisteredBike) {
      return selectedRegisteredBike;
    }
    if (selectedPreset) {
      return selectedPreset;
    }
    return {
      brand: customBikeBrand || 'Custom Motorcycle',
      model: customBikeName || 'Custom Build',
      photo_url: customPhotoUri,
      color: 'Custom Finish',
    };
  }, [bikeSourceMode, selectedRegisteredBike, selectedPreset, customBikeBrand, customBikeName, customPhotoUri]);

  const currentBasePhoto = useMemo(() => {
    if (bikeSourceMode === 'registered' && selectedRegisteredBike?.photo_url) {
      return selectedRegisteredBike.photo_url;
    }
    if (bikeSourceMode === 'presets' && selectedPreset?.image) {
      return selectedPreset.image;
    }
    if (selectedRegisteredBike?.photo_url) {
      return selectedRegisteredBike.photo_url;
    }
    return customPhotoUri || selectedPreset?.image;
  }, [bikeSourceMode, selectedRegisteredBike, selectedPreset, customPhotoUri]);

  const currentBikeTitle = useMemo(() => {
    if (bikeSourceMode === 'registered' && selectedRegisteredBike) {
      return `${selectedRegisteredBike.year ? `${selectedRegisteredBike.year} ` : ''}${selectedRegisteredBike.brand} ${selectedRegisteredBike.model}`;
    }
    if (bikeSourceMode === 'presets' && selectedPreset) {
      return selectedPreset.name;
    }
    if (selectedRegisteredBike) {
      return `${selectedRegisteredBike.year ? `${selectedRegisteredBike.year} ` : ''}${selectedRegisteredBike.brand} ${selectedRegisteredBike.model}`;
    }
    return customBikeName || 'Custom Motorcycle';
  }, [bikeSourceMode, selectedRegisteredBike, selectedPreset, customBikeName]);

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

  // Categories list (Wheels, Exhaust, Accessories, Brakes, Suspension, etc.)
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

  // Performance calculations
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

  // Synthesized AI Prompt Sentence based on selected motorcycle + selected products
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
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
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

  // ─── WORKFLOW ACTIONS ───

  // Step 1: Select Motorcycle
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

  // Step 2: Part Details & Add Part / Cancel
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
      message: 'Synthesizing 4K neural motorcycle photograph...',
      percentage: 15,
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
      console.error('AI generation error:', err);
      showToast('AI preview failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  // Step 3 Actions: Modify or Save to Wishlist
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

  // Step 4 Actions: Buy Parts (Checkout) or Book Installation
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

  // Copy/Reset Prompt
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

  // Active displayed image in preview
  const displayedCanvasImage =
    generationResult && activeViewMode === 'generated' ? generationResult.generatedImage : currentBasePhoto;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ToastNotification message={toastMessage} />

      {/* ─── 1. NAVBAR ─── */}
      <View style={styles.headerWrapper}>
        <View style={[styles.maxContainer, styles.headerInner]}>
          <TouchableOpacity style={styles.logoWrap} onPress={() => onNavigateToStore?.()} activeOpacity={0.8}>
            <BrandLogo size={40} textColor="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenterNav}>
            <TouchableOpacity
              style={styles.headerCenterBtn}
              onPress={() => onNavigateToStore?.()}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="shop" size={16} color="#FFFFFF" />
              <Text style={styles.headerCenterBtnText}>Store</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerCenterBtn}
              onPress={() => onNavigateToGarage?.()}
              activeOpacity={0.8}
            >
              <BootstrapIcon name="tools" size={16} color="#FFFFFF" />
              <Text style={styles.headerCenterBtnText}>Book a Service</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerCenterBtn} activeOpacity={0.8}>
              <BootstrapIcon name="magic" size={16} color="#10B981" />
              <Text style={[styles.headerCenterBtnText, { color: '#10B981', fontWeight: '800' }]}>
                Customize
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.navActionIconBtn}
              onPress={() => onNavigateToWishlist?.()}
              activeOpacity={0.8}
              title="Favorites"
            >
              <BootstrapIcon name="heart" size={16} color="#FFFFFF" />
              {wishlistCount > 0 && (
                <View style={styles.navBadgeCircle}>
                  <Text style={styles.navBadgeText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.navActionIconBtn}
                onPress={() => {
                  setIsUserDropdownOpen(false);
                  setIsNotifDropdownOpen((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <BootstrapIcon name="bell" size={16} color="#FFFFFF" />
                {unreadNotifCount > 0 && (
                  <View style={styles.navBadgeCircle}>
                    <Text style={styles.navBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <NotificationDropdown
                isOpen={isNotifDropdownOpen}
                onClose={() => setIsNotifDropdownOpen(false)}
                onNavigateToScreen={(screen) => {
                  if (screen === 'store') onNavigateToStore?.();
                  else if (screen === 'orders') onNavigateToOrders?.();
                }}
                currentUser={currentUser}
              />
            </View>

            <TouchableOpacity
              style={styles.navActionIconBtn}
              onPress={() => setIsCartModalOpen(true)}
              activeOpacity={0.85}
              title="Cart"
            >
              <BootstrapIcon name="cart3" size={17} color="#FFFFFF" />
              {cartItemCount > 0 && (
                <View style={styles.navBadgeCircle}>
                  <Text style={styles.navBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {currentUser ? (
              <View style={[styles.loggedInContainer, { position: 'relative' }]}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsUserDropdownOpen(!isUserDropdownOpen);
                  }}
                  size={40}
                />
                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isUserDropdownOpen}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('overview')}
                  onNavigateToOrders={() => onNavigateToOrders?.()}
                  onNavigateToProfile={() => onNavigateToProfile?.('profile')}
                  onNavigateToSettings={() => onNavigateToProfile?.('settings')}
                  onNavigateToAdmin={() => onNavigateToAdmin?.()}
                  onLogout={() => {
                    if (onLogout) onLogout();
                    else {
                      logout?.();
                      showToast?.('Logged out successfully');
                      onNavigateToStore?.();
                    }
                  }}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signInHeaderBtn}
                onPress={() => onNavigateToLogin?.()}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                <Text style={styles.signInHeaderBtnText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── MAIN CONTENT ─── */}
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
                    <BootstrapIcon name="check" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.stepBadgeText, styles.stepBadgeTextActive]}>1</Text>
                  )}
                </View>
                <View style={styles.stepLabelWrap}>
                  <Text style={[styles.stepLabel, workflowStep === 'bike' && styles.stepLabelActive]}>
                    Select Motorcycle
                  </Text>
                  <Text style={styles.stepSubLabel} numberOfLines={1}>
                    {activeMotorcycle?.brand} {activeMotorcycle?.model}
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
                    <BootstrapIcon name="check" size={14} color="#FFFFFF" />
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
                    Choose Parts
                  </Text>
                  <Text style={styles.stepSubLabel}>
                    {selectedParts.length} {selectedParts.length === 1 ? 'part' : 'parts'} equipped
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
                    <BootstrapIcon name="check" size={14} color="#FFFFFF" />
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
                    Review & AI Preview
                  </Text>
                  <Text style={styles.stepSubLabel}>Photorealistic render</Text>
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
                    Total & Checkout
                  </Text>
                  <Text style={styles.stepSubLabel}>Buy or Book service</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 1: SELECT MOTORCYCLE (Brand / Model / Year)
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'bike' && (
            <View>
              <View style={styles.workbenchCard}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>1. Select Motorcycle</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      Choose your registered ride from garage, factory chassis preset, or custom project
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.emptyRegBikesBtn, { backgroundColor: '#0C6258' }]}
                    onPress={() => setIsRegisterBikeModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="plus-circle-fill" size={13} color="#FFFFFF" />
                    <Text style={styles.emptyRegBikesBtnText}>+ Register Bike</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter Tabs: All Options | Registered Garage | Presets | Custom Photo */}
                <View style={styles.bikeSourceTabs}>
                  <TouchableOpacity
                    style={[
                      styles.bikeSourceTab,
                      bikeSourceMode === 'all' && styles.bikeSourceTabActive,
                    ]}
                    onPress={() => setBikeSourceMode('all')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon
                      name="collection-fill"
                      size={14}
                      color={bikeSourceMode === 'all' ? '#FFFFFF' : '#0C6258'}
                    />
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'all' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      All Options
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bikeSourceTab,
                      bikeSourceMode === 'registered' && styles.bikeSourceTabActive,
                    ]}
                    onPress={() => setBikeSourceMode('registered')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon
                      name="bicycle"
                      size={14}
                      color={bikeSourceMode === 'registered' ? '#FFFFFF' : '#0C6258'}
                    />
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'registered' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      My Registered Garage ({registeredBikes.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bikeSourceTab,
                      bikeSourceMode === 'presets' && styles.bikeSourceTabActive,
                    ]}
                    onPress={() => setBikeSourceMode('presets')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon
                      name="grid-fill"
                      size={14}
                      color={bikeSourceMode === 'presets' ? '#FFFFFF' : '#0C6258'}
                    />
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'presets' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      Factory Presets ({BIKE_PRESETS.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bikeSourceTab,
                      bikeSourceMode === 'upload' && styles.bikeSourceTabActive,
                    ]}
                    onPress={() => setBikeSourceMode('upload')}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon
                      name="camera-fill"
                      size={14}
                      color={bikeSourceMode === 'upload' ? '#FFFFFF' : '#0C6258'}
                    />
                    <Text
                      style={[
                        styles.bikeSourceTabText,
                        bikeSourceMode === 'upload' && styles.bikeSourceTabTextActive,
                      ]}
                    >
                      Custom Photo
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ─── SECTION 1: CHOOSE FROM REGISTERED MOTORCYCLES ─── */}
                {(bikeSourceMode === 'all' || bikeSourceMode === 'registered') && (
                  <View style={{ marginBottom: 20 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <BootstrapIcon name="bicycle" size={16} color="#0C6258" />
                        <Text
                          style={[
                            styles.formLabel,
                            {
                              marginBottom: 0,
                              textTransform: 'uppercase',
                              letterSpacing: 0.6,
                              color: '#0F172A',
                              fontWeight: '800',
                              fontSize: 12,
                            },
                          ]}
                        >
                          Choose From Your Registered Motorcycles:
                        </Text>
                        <View
                          style={{
                            backgroundColor: '#D1ECE6',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 12,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#0C6258' }}>
                            {registeredBikes.length} in Garage
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        onPress={() => setIsRegisterBikeModalOpen(true)}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="plus-circle-fill" size={13} color="#0C6258" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0C6258' }}>
                          + Register New Motorcycle
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
                                    { width: 22, height: 22 },
                                  ]}
                                >
                                  {isSelected && <BootstrapIcon name="check" size={14} color="#FFFFFF" />}
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
                                    <Text style={styles.regBikePlateText}>
                                      Plate: {bike.plate_number}
                                    </Text>
                                  </View>
                                )}
                                {bike.color && (
                                  <View style={styles.regBikeColorBadge}>
                                    <Text style={styles.regBikeColorText} numberOfLines={1}>
                                      {bike.color}
                                    </Text>
                                  </View>
                                )}
                                {bike.is_primary && (
                                  <View style={styles.regBikePrimaryTag}>
                                    <Text style={styles.regBikePrimaryTagText}>Primary Ride</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Quick Register New Bike Card */}
                        <TouchableOpacity
                          style={[
                            styles.regBikeCard,
                            {
                              borderStyle: 'dashed',
                              backgroundColor: '#F8FAFC',
                              justifyContent: 'center',
                              alignItems: 'center',
                              width: 160,
                              minHeight: 180,
                            },
                          ]}
                          onPress={() => setIsRegisterBikeModalOpen(true)}
                          activeOpacity={0.85}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: '#D1ECE6',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <BootstrapIcon name="plus-lg" size={20} color="#0C6258" />
                          </View>
                          <Text
                            style={{
                              fontSize: 12.5,
                              fontWeight: '700',
                              color: '#0C6258',
                              textAlign: 'center',
                              paddingHorizontal: 8,
                            }}
                          >
                            + Add Another Registered Bike
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    ) : (
                      <View style={styles.emptyRegBikesBox}>
                        <BootstrapIcon name="info-circle" size={24} color="#0C6258" />
                        <Text style={styles.emptyRegBikesText}>
                          No motorcycles registered yet in your garage fleet. Register your ride below to customize parts with 100% precision fitment!
                        </Text>
                        <TouchableOpacity
                          style={styles.emptyRegBikesBtn}
                          onPress={() => setIsRegisterBikeModalOpen(true)}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="plus-circle-fill" size={14} color="#FFFFFF" />
                          <Text style={styles.emptyRegBikesBtnText}>Register Motorcycle Now</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* ─── SECTION 2: CHOOSE FROM SUPERBIKE & SCOOTER PRESETS ─── */}
                {(bikeSourceMode === 'all' || bikeSourceMode === 'presets') && (
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <BootstrapIcon name="grid-fill" size={15} color="#0C6258" />
                      <Text
                        style={[
                          styles.formLabel,
                          {
                            marginBottom: 0,
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            color: '#0F172A',
                            fontWeight: '800',
                            fontSize: 12,
                          },
                        ]}
                      >
                        ...Or Choose From Superbike & Scooter Presets:
                      </Text>
                    </View>

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

                {/* ─── SECTION 3: UPLOAD CUSTOM MOTORCYCLE PHOTO ─── */}
                {(bikeSourceMode === 'all' || bikeSourceMode === 'upload') && (
                  <View style={{ marginBottom: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <BootstrapIcon name="camera-fill" size={14} color="#64748B" />
                      <Text
                        style={[
                          styles.formLabel,
                          {
                            marginBottom: 0,
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            color: '#64748B',
                            fontWeight: '700',
                            fontSize: 11,
                          },
                        ]}
                      >
                        ...Or Upload Custom Motorcycle Photo:
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.uploadBox, customPhotoUri && styles.uploadBoxActive]}
                      onPress={handleUploadBikePhoto}
                      activeOpacity={0.8}
                    >
                      <View style={styles.uploadIconCircle}>
                        <BootstrapIcon
                          name={customPhotoUri ? 'check-circle-fill' : 'camera-fill'}
                          size={24}
                          color={customPhotoUri ? '#0C6258' : '#94A3B8'}
                        />
                      </View>
                      <Text style={styles.uploadTitle}>
                        {customPhotoUri ? 'Custom Motorcycle Photo Loaded' : 'Upload Motorcycle Photo'}
                      </Text>
                      <Text style={styles.uploadSubtitle}>
                        {customPhotoUri ? 'Click to replace photo' : 'Supports JPG / PNG from your device'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ─── SECTION 4: SELECTED MOTORCYCLE SUMMARY BANNER & NEXT CTA ─── */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 16,
                    padding: 16,
                    marginTop: 10,
                    borderWidth: 1.5,
                    borderColor: '#0C6258',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Image
                      source={{ uri: currentBasePhoto }}
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 12,
                        backgroundColor: '#0F172A',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                      }}
                      resizeMode="cover"
                    />
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: '#0C6258',
                            letterSpacing: 0.5,
                          }}
                        >
                          SELECTED MOTORCYCLE
                        </Text>
                        {selectedRegisteredBike ? (
                          <View
                            style={{
                              backgroundColor: '#0C6258',
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                              CUSTOMER REGISTERED BIKE
                            </Text>
                          </View>
                        ) : selectedPreset ? (
                          <View
                            style={{
                              backgroundColor: '#0F172A',
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                              FACTORY PRESET
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              backgroundColor: '#475569',
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                              CUSTOM UPLOAD
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
                        {currentBikeTitle}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        {selectedRegisteredBike
                          ? `Plate: ${selectedRegisteredBike.plate_number || 'N/A'} • Color: ${selectedRegisteredBike.color || 'Standard'} • Engine: ${selectedRegisteredBike.engine_cc || 155}cc`
                          : selectedPreset
                          ? `Category: ${selectedPreset.category} • Color: ${selectedPreset.color} • ${selectedPreset.baseHp} HP`
                          : 'Custom project photo loaded from device'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.reviewActionPrimaryBtn, { flex: 0, paddingHorizontal: 24 }]}
                    onPress={() => setWorkflowStep('parts')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.reviewActionPrimaryText}>
                      Confirm Motorcycle & Choose Parts ➔
                    </Text>
                    <BootstrapIcon name="arrow-right" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 2: CHOOSE CUSTOMIZATION CATEGORY & MOTORCYCLE PARTS
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'parts' && (
            <View style={[styles.studioLayout, (isDesktop || isTablet) && styles.studioLayoutDesktop]}>
              {/* Left Column: Motorcycle Preview & Telemetry */}
              <View style={styles.canvasColumn}>
                <View style={styles.canvasCard}>
                  <View style={styles.canvasImageContainer}>
                    <Image
                      source={{ uri: displayedCanvasImage }}
                      style={styles.canvasImage}
                      resizeMode="cover"
                    />
                    <View style={styles.canvasOverlayHeader}>
                      <View style={styles.bikeTagBadge}>
                        <BootstrapIcon name="bicycle" size={14} color="#0C6258" />
                        <Text style={styles.bikeTagText} numberOfLines={1}>
                          {currentBikeTitle}
                        </Text>
                      </View>
                      <View style={[styles.regBikePlateBadge, { backgroundColor: 'rgba(15,23,42,0.85)' }]}>
                        <Text style={[styles.regBikePlateText, { color: '#F8FAFC' }]}>
                          {selectedParts.length} Parts Equipped
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Dyno Performance Metrics */}
                  <View style={styles.diagnosticsCard}>
                    <View style={styles.diagHeader}>
                      <Text style={styles.diagTitle}>Performance Tuning Metrics</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <BootstrapIcon name="speedometer2" size={14} color="#0C6258" />
                        <Text style={{ fontSize: 11.5, color: '#0C6258', fontWeight: '800' }}>
                          {liveDiagnostics.powerToWeightRatio}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.diagGrid}>
                      <View style={styles.diagItem}>
                        <Text style={styles.diagItemLabel}>Peak Horsepower</Text>
                        <Text style={styles.diagItemVal}>
                          {liveDiagnostics.estimatedFinalHp} HP{' '}
                          <Text style={{ fontSize: 11, color: '#10B981' }}>(+{liveDiagnostics.hpGain} HP)</Text>
                        </Text>
                        <Text style={styles.diagItemSub}>Stock: {liveDiagnostics.baseHp} HP</Text>
                      </View>

                      <View style={styles.diagItem}>
                        <Text style={styles.diagItemLabel}>Curb Weight</Text>
                        <Text style={styles.diagItemVal}>
                          {liveDiagnostics.estimatedFinalWeight} kg{' '}
                          <Text style={{ fontSize: 11, color: '#10B981' }}>
                            (-{liveDiagnostics.weightSavingsKg} kg)
                          </Text>
                        </Text>
                        <Text style={styles.diagItemSub}>Stock: {liveDiagnostics.baseWeight} kg</Text>
                      </View>

                      <View style={styles.diagItem}>
                        <Text style={styles.diagItemLabel}>Braking Bite</Text>
                        <Text style={styles.diagItemVal}>+{liveDiagnostics.brakingEfficiencyPercent}%</Text>
                        <Text style={styles.diagItemSub}>Brembo Radial</Text>
                      </View>

                      <View style={styles.diagItem}>
                        <Text style={styles.diagItemLabel}>Sound Profile</Text>
                        <Text style={[styles.diagItemVal, { fontSize: 13.5 }]} numberOfLines={1}>
                          {liveDiagnostics.soundLevelDb} dB
                        </Text>
                        <Text style={styles.diagItemSub} numberOfLines={1}>
                          {liveDiagnostics.soundProfile}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* ─── "ADD MORE CUSTOMIZATIONS?" PROMPT BANNER ─── */}
                {selectedParts.length > 0 && (
                  <View style={styles.addMorePromptBanner}>
                    <View style={styles.addMorePromptLeft}>
                      <View style={styles.addMoreIconWrap}>
                        <BootstrapIcon name="tools" size={18} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={styles.addMorePromptTitle}>
                          {selectedParts.length} Custom {selectedParts.length === 1 ? 'Part' : 'Parts'} Installed
                        </Text>
                        <Text style={styles.addMorePromptSub}>
                          Add more customizations (Wheels, Exhaust, Accessories)?
                        </Text>
                      </View>
                    </View>

                    <View style={styles.addMoreBtnGroup}>
                      <TouchableOpacity
                        style={styles.addMoreBtnYes}
                        onPress={() => {
                          showToast('Select another category or part below.');
                        }}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="plus" size={14} color="#FFFFFF" />
                        <Text style={styles.addMoreBtnYesText}>YES, Select More</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.addMoreBtnNo}
                        onPress={() => setWorkflowStep('review')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.addMoreBtnNoText}>NO, Review Build ➔</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Right Column: Category Filter & Parts Catalog */}
              <View style={styles.controlsColumn}>
                <View style={styles.workbenchCard}>
                  <View style={styles.sectionHeadingRow}>
                    <View>
                      <Text style={styles.sectionHeading}>2. Choose Customization Category</Text>
                      <Text style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                        Tap any part to view specs & install onto {activeMotorcycle?.model}
                      </Text>
                    </View>
                  </View>

                  {/* Category Pills: Wheels, Exhaust, Accessories, etc. */}
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

                  {/* Search Bar */}
                  <View style={styles.partsSearchBox}>
                    <BootstrapIcon name="search" size={14} color="#64748B" />
                    <TextInput
                      style={styles.partsSearchInput}
                      placeholder={`Search ${selectedCategory} parts, brands, exhausts...`}
                      placeholderTextColor="#64748B"
                      value={searchPartQuery}
                      onChangeText={setSearchPartQuery}
                    />
                    {searchPartQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchPartQuery('')}>
                        <BootstrapIcon name="x-circle-fill" size={14} color="#64748B" />
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
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                <BootstrapIcon name="check2-circle" size={12} color="#0C6258" />
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0C6258' }}>
                                  Installed on {activeMotorcycle?.model || 'Motorcycle'}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.partPriceRow}>
                            <Text style={styles.partPricePhp}>
                              ₱{usdToPhp(product.price || 0).toLocaleString()}
                            </Text>
                            <Text style={styles.partPriceUsd}>${Number(product.price || 0).toFixed(2)}</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected]}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              handleTogglePartDirect(product);
                            }}
                          >
                            {isSelected && <BootstrapIcon name="check" size={14} color="#FFFFFF" />}
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Selected Parts Subtotal Tray & Proceed CTA */}
                  <View style={styles.selectedTray}>
                    <View style={styles.selectedTrayHeader}>
                      <Text style={styles.selectedTrayTitle}>Parts Equipped ({selectedParts.length}):</Text>
                      <Text style={styles.selectedTrayTotal}>
                        ₱{partsTotalPhp.toLocaleString()} (${partsTotalUsd.toFixed(2)})
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        style={styles.reviewActionSecondaryBtn}
                        onPress={() => setWorkflowStep('bike')}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="arrow-left" size={14} color="#334155" />
                        <Text style={styles.reviewActionSecondaryText}>Change Bike</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.reviewActionPrimaryBtn,
                          selectedParts.length === 0 && { opacity: 0.6 },
                        ]}
                        onPress={() => setWorkflowStep('review')}
                        disabled={selectedParts.length === 0}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.reviewActionPrimaryText}>
                          Review Customization ➔
                        </Text>
                        <BootstrapIcon name="arrow-right" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 3: REVIEW CUSTOMIZATION & AI PREVIEW (OPTIONAL FEATURE)
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'review' && (
            <View>
              <View style={styles.reviewCard}>
                {/* Header with Motorcycle Details */}
                <View style={styles.reviewHeaderRow}>
                  <View style={styles.reviewBikeBadge}>
                    <Image
                      source={{ uri: currentBasePhoto }}
                      style={styles.reviewBikeThumb}
                      resizeMode="cover"
                    />
                    <View>
                      <Text style={styles.reviewBikeTitle}>
                        {currentBikeTitle}
                      </Text>
                      <Text style={styles.reviewBikeSub}>
                        {activeMotorcycle?.brand} • {activeMotorcycle?.color || 'Custom Paint'} • Plate: {activeMotorcycle?.plate_number || 'Registered'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.reviewActionSecondaryBtn}
                    onPress={handleModifyCustomizeAgain}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="pencil-square" size={13} color="#334155" />
                    <Text style={styles.reviewActionSecondaryText}>Modify Parts</Text>
                  </TouchableOpacity>
                </View>

                {/* Equipped Parts List */}
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
                  Equipped Custom Modifications ({selectedParts.length})
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
                          <Text style={styles.reviewPartMeta}>
                            {part.brand} • {part.category}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.reviewPartPrice}>
                          ₱{usdToPhp(part.price || 0).toLocaleString()}
                        </Text>
                        <TouchableOpacity
                          style={styles.reviewPartRemoveBtn}
                          onPress={() => handleRemoveEquippedPart(part.id || part.product_id)}
                          title="Remove part"
                        >
                          <BootstrapIcon name="trash" size={13} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* ─── OPTIONAL FEATURE: GENERATE AI PREVIEW ─── */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 16,
                    padding: 20,
                    marginVertical: 18,
                    borderWidth: 1.5,
                    borderColor: '#D1ECE6',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.modeIconWrap, { width: 34, height: 34 }]}>
                        <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                          Generate AI Preview (Optional Feature)
                        </Text>
                        <Text style={{ fontSize: 11.5, color: '#64748B' }}>
                          Render a photorealistic studio photo with all equipped parts installed
                        </Text>
                      </View>
                    </View>

                    <View style={styles.formedPromptBadge}>
                      <Text style={styles.formedPromptBadgeText}>AI Studio 4K</Text>
                    </View>
                  </View>

                  {/* Formed Prompt Box */}
                  <View style={styles.formedPromptTextBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0C6258' }}>
                        AUTO-SYNTHESIZED PROMPT SENTENCE:
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity onPress={handleCopyPrompt} title="Copy prompt">
                          <BootstrapIcon name="clipboard-check" size={13} color="#0C6258" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleResetPrompt} title="Reset prompt">
                          <BootstrapIcon name="arrow-clockwise" size={13} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.formedPromptSentence}>
                      "{customPrompt || synthesizedPromptSentence}"
                    </Text>
                  </View>

                  <TextInput
                    style={[styles.customPromptInput, { marginTop: 4, marginBottom: 12 }]}
                    placeholder="Optional rider notes (e.g. night lighting, track paddock, neon rim accents)..."
                    placeholderTextColor="#94A3B8"
                    value={userPromptAddon}
                    onChangeText={(val) => {
                      setUserPromptAddon(val);
                      setIsPromptCustomized(true);
                    }}
                  />

                  {/* AI Generation Trigger */}
                  <TouchableOpacity
                    style={[styles.generateCtaBtn, { marginBottom: 0 }]}
                    onPress={handleGenerateAI}
                    disabled={isGenerating}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="stars" size={16} color="#FFFFFF" />
                    <Text style={styles.generateCtaText}>
                      {isGenerating
                        ? 'Generating 4K AI Photo...'
                        : generationResult
                        ? '⚡ Re-Generate AI Custom Motorcycle Photo'
                        : '⚡ Generate Photorealistic AI Photo Preview'}
                    </Text>
                  </TouchableOpacity>

                  {/* AI Photo Preview Display */}
                  {generationResult && (
                    <View style={{ marginTop: 16 }}>
                      <View style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                        <Image
                          source={{ uri: displayedCanvasImage }}
                          style={{ width: '100%', height: 320, borderRadius: 16 }}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={[
                            styles.toggleViewBtn,
                            { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(15,23,42,0.85)' },
                          ]}
                          onPress={() =>
                            setActiveViewMode((prev) => (prev === 'generated' ? 'original' : 'generated'))
                          }
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon
                            name={activeViewMode === 'generated' ? 'eye-fill' : 'arrow-repeat'}
                            size={13}
                            color="#FFFFFF"
                          />
                          <Text style={styles.toggleViewBtnText}>
                            {activeViewMode === 'generated' ? 'View Original Bike' : 'View AI Custom'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {generationResult?.geminiAnalysis && (
                        <View style={[styles.geminiCard, { marginTop: 12 }]}>
                          <Text style={styles.geminiTitle}>
                            {generationResult.geminiAnalysis.tagline || 'AI Build Diagnostics'}
                          </Text>
                          <Text style={styles.geminiSummary}>
                            {generationResult.geminiAnalysis.engineeringSummary}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Review Stage Action Buttons: Modify | Save to Wishlist | Proceed to Total */}
                <View style={styles.reviewActionsRow}>
                  <TouchableOpacity
                    style={styles.reviewActionSecondaryBtn}
                    onPress={handleModifyCustomizeAgain}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="arrow-repeat" size={15} color="#334155" />
                    <Text style={styles.reviewActionSecondaryText}>Modify (Customize Again)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reviewActionSecondaryBtn}
                    onPress={handleSaveToWishlist}
                    activeOpacity={0.8}
                  >
                    <BootstrapIcon name="heart-fill" size={15} color="#EF4444" />
                    <Text style={styles.reviewActionSecondaryText}>Save to Wishlist</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reviewActionPrimaryBtn}
                    onPress={() => setWorkflowStep('total')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.reviewActionPrimaryText}>
                      View Estimated Total & Action ➔
                    </Text>
                    <BootstrapIcon name="arrow-right" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              STEP 4: VIEW ESTIMATED TOTAL & BUY PARTS / BOOK INSTALLATION
          ═════════════════════════════════════════════════════════════════════ */}
          {workflowStep === 'total' && (
            <View>
              <View style={styles.totalBreakdownCard}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionHeading}>4. Estimated Total & Action</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      Review complete cost breakdown for parts and certified pitstop installation
                    </Text>
                  </View>
                  <View style={styles.regBikePlateBadge}>
                    <Text style={styles.regBikePlateText}>
                      {activeMotorcycle?.brand} {activeMotorcycle?.model}
                    </Text>
                  </View>
                </View>

                {/* Itemized Lines */}
                <View style={{ marginVertical: 12 }}>
                  {selectedParts.map((part) => (
                    <View key={part.id || part.product_id} style={styles.totalRowItem}>
                      <Text style={styles.totalRowLabel} numberOfLines={1}>
                        {part.name} ({part.brand})
                      </Text>
                      <Text style={styles.totalRowValue}>
                        ₱{usdToPhp(part.price || 0).toLocaleString()}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.totalRowItem}>
                    <Text style={styles.totalRowLabel}>Parts Subtotal ({selectedParts.length} items)</Text>
                    <Text style={styles.totalRowValue}>
                      ₱{partsTotalPhp.toLocaleString()} (${partsTotalUsd.toFixed(2)})
                    </Text>
                  </View>

                  <View style={styles.totalRowItem}>
                    <View>
                      <Text style={styles.totalRowLabel}>Pitstop Installation & Calibration Labor</Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                        Professional garage bay mechanic fitting
                      </Text>
                    </View>
                    <Text style={styles.totalRowValue}>
                      ₱{laborFeePhp.toLocaleString()} (${laborFeeUsd.toFixed(2)})
                    </Text>
                  </View>

                  {/* Grand Total Box */}
                  <View style={styles.totalGrandBox}>
                    <View>
                      <Text style={styles.totalGrandLabel}>Total Estimated Investment</Text>
                      <Text style={{ fontSize: 11, color: '#0C6258' }}>
                        Includes all equipped parts + garage installation
                      </Text>
                    </View>
                    <Text style={styles.totalGrandAmount}>
                      ₱{grandTotalPhp.toLocaleString()}{' '}
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>
                        (${grandTotalUsd.toFixed(2)})
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* Dual Action Paths */}
                <View style={styles.dualActionContainer}>
                  {/* Path A: Buy Parts -> Checkout */}
                  <TouchableOpacity
                    style={styles.buyPartsCheckoutBtn}
                    onPress={handleBuyPartsCheckout}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="cart-check-fill" size={18} color="#FFFFFF" />
                    <View>
                      <Text style={styles.buyPartsCheckoutText}>Buy Parts (Checkout)</Text>
                      <Text style={{ fontSize: 11, color: '#D1ECE6' }}>
                        Order parts online with COD or GCash
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Path B: Book Installation -> Service Booking */}
                  <TouchableOpacity
                    style={styles.bookInstallServiceBtn}
                    onPress={handleOpenBookingModal}
                    activeOpacity={0.9}
                  >
                    <BootstrapIcon name="calendar-check-fill" size={18} color="#10B981" />
                    <View>
                      <Text style={styles.bookInstallServiceText}>Book Installation</Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                        Schedule fitting appointment at Pitstop bay
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Back to Review Button */}
                <TouchableOpacity
                  style={[styles.reviewActionSecondaryBtn, { marginTop: 16, alignSelf: 'flex-start' }]}
                  onPress={() => setWorkflowStep('review')}
                  activeOpacity={0.8}
                >
                  <BootstrapIcon name="arrow-left" size={14} color="#334155" />
                  <Text style={styles.reviewActionSecondaryText}>Back to Review Customization</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── 2. PART DETAILS & PRICE MODAL ─── */}
      <Modal visible={viewingPartDetails !== null} transparent animationType="fade">
        <View style={styles.partModalOverlay}>
          {viewingPartDetails && (
            <View style={styles.partModalSheet}>
              <View style={styles.partModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="info-circle-fill" size={18} color="#0C6258" />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                    Part Details & Fitment
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setViewingPartDetails(null)}>
                  <BootstrapIcon name="x" size={22} color="#64748B" />
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
              <Text style={styles.partModalBrand}>
                {viewingPartDetails.brand} • In Stock ({viewingPartDetails.stock || 8} available)
              </Text>

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
                  <BootstrapIcon name="check-circle" size={12} color="#0C6258" />
                  <Text style={styles.partModalSpecText}>
                    Compatible with {activeMotorcycle?.brand} {activeMotorcycle?.model}
                  </Text>
                </View>
                <View style={styles.partModalSpecChip}>
                  <BootstrapIcon name="lightning-charge-fill" size={12} color="#10B981" />
                  <Text style={styles.partModalSpecText}>Plug-and-Play Fitment</Text>
                </View>
              </View>

              <View style={styles.partModalActions}>
                <TouchableOpacity
                  style={styles.partModalAddBtn}
                  onPress={() => handleAddPartFromModal(viewingPartDetails)}
                  activeOpacity={0.9}
                >
                  <BootstrapIcon name="plus-circle-fill" size={15} color="#FFFFFF" />
                  <Text style={styles.partModalAddBtnText}>Add Part to Motorcycle</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.partModalCancelBtn}
                  onPress={() => setViewingPartDetails(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.partModalCancelBtnText}>Cancel / Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ─── 3. CHECKOUT MODAL ─── */}
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

      {/* ─── 4. CART MODAL ─── */}
      <CartModal
        visible={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        onProceedToCheckout={() => {
          setIsCartModalOpen(false);
          setIsCheckoutModalOpen(true);
        }}
      />

      {/* ─── 5. BOOKING MODAL (PITSTOP SERVICE) ─── */}
      <Modal visible={isBookingModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BootstrapIcon name="calendar-check-fill" size={18} color="#0C6258" />
                <Text style={styles.modalTitle}>Book Installation Pitstop</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsBookingModalOpen(false)}>
                <BootstrapIcon name="x" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={true}>
              <Text style={styles.formLabel}>Selected Motorcycle</Text>
              <View
                style={{
                  backgroundColor: '#F1F5F9',
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13 }}>
                  {currentBikeTitle}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
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
                  <Text style={styles.branchSub}>
                    {b.address} • {b.phone}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Preferred Appointment Time Slot *</Text>
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

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Contact Phone Number *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+63 9XX XXX XXXX"
                placeholderTextColor="#64748B"
                value={riderPhone}
                onChangeText={setRiderPhone}
              />

              <Text style={styles.formLabel}>Special Mechanic / Fitting Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="e.g. Please dyno test before/after exhaust install..."
                placeholderTextColor="#64748B"
                multiline
                value={bookingNotes}
                onChangeText={setBookingNotes}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.generateCtaBtn, { marginTop: 14 }]}
              onPress={handleConfirmCustomBooking}
              activeOpacity={0.9}
            >
              <BootstrapIcon name="check-circle-fill" size={16} color="#FFFFFF" />
              <Text style={styles.generateCtaText}>Confirm Pitstop Customization Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── 6. REGISTER MOTORCYCLE MODAL ─── */}
      <RegisterMotorcycleModal
        visible={isRegisterBikeModalOpen}
        onClose={() => setIsRegisterBikeModalOpen(false)}
        onSave={handleSaveRegisteredBike}
      />

      {/* ─── 7. LIVE TRACKING MODAL ─── */}
      <LiveOrderTrackingMapModal
        visible={isLiveTrackingOpen}
        order={selectedOrderForTracking}
        onClose={() => setIsLiveTrackingOpen(false)}
        showToast={showToast}
      />

      {/* Mobile Bottom Navigation Bar on smaller screens */}
      {windowWidth < 768 && (
        <BottomNavBar
          activeTab="Customize"
          onTabChange={(tab) => {
            if (tab === 'Home') onNavigateToStore?.();
            else if (tab === 'Garage') onNavigateToGarage?.();
            else if (tab === 'Orders') onNavigateToOrders?.();
            else if (tab === 'Favorites') onNavigateToWishlist?.();
            else if (tab === 'Profile') {
              if (!currentUser) {
                setRedirectReason('');
                onNavigateToLogin?.();
              } else {
                onNavigateToProfile?.();
              }
            }
          }}
          currentUser={currentUser}
        />
      )}
    </View>
  );
}
