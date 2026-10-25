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
import { customizerWebStyles as styles } from '../../../styles/web/customizer.web.styles.js';
import { usdToPhp } from '../../../utils/currency.js';
import { aiCustomizerService, BIKE_PRESETS, CUSTOM_THEMES } from '../../../services/ai/aiCustomizerService.js';
import { productService } from '../../../services/products/productService.js';
import { geminiService } from '../../../services/ai/geminiService.js';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../../../services/bookings/garageService.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import {
  BootstrapIcon,
  ToastNotification,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  NotificationDropdown,
  CustomerMobileNavDrawer,
} from '../../../components/common';
import {
  LiveOrderTrackingMapModal,
  RegisterMotorcycleModal,
  CheckoutModal,
  CartModal,
  BookInstallationModal,
} from '../../../components/modals';
import CustomizationWorkspace from '../../../components/customizer/CustomizationWorkspace.jsx';
import AiMotorcycleInstallStudio from '../../../components/customizer/AiMotorcycleInstallStudio.jsx';
import { useCustomizationBuilder } from '../../../hooks/useCustomizationBuilder.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';

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
  const { isDarkMode, toggleDarkMode, tokens } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const { currentUser, logout, setRedirectReason } = useAuth();
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const { wishlistCount, addToWishlist } = useWishlist();

  const [studioMode, setStudioMode] = useState('install');
  const customizationBuilder = useCustomizationBuilder({
    currentUser,
    initialProduct: initialSelectedProduct,
  });

  // ─── NOTIFICATION STATE ───
  const [unreadNotifCount, setUnreadNotifCount] = useState(() =>
    currentUser ? notificationService.getUnreadCount(currentUser) : 0
  );
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      setUnreadNotifCount(
        currentUser ? notificationService.getUnreadCount(currentUser) : 0
      );
    });
    return () => unsub?.();
  }, [currentUser]);

  // ─── 1. WORKFLOW STEP STATE ───
  // Steps: 'bike' (1) -> 'parts' (2) -> 'review' (3) -> 'total' (4)
  const [workflowStep, setWorkflowStep] = useState('bike');

  // ─── 2. MOTORCYCLE STATE ───
  const [registeredBikes, setRegisteredBikes] = useState(() => {
    if (!currentUser?.id) return [];
    return motorcycleService.getMotorcycles(currentUser?.id) || [];
  });
  const [bikeSourceMode, setBikeSourceMode] = useState('all'); // 'all' | 'registered' | 'presets' | 'upload'
  const [selectedRegisteredBike, setSelectedRegisteredBike] = useState(() => {
    if (!currentUser?.id) return null;
    const list = motorcycleService.getMotorcycles(currentUser?.id) || [];
    return list.find((b) => b.is_primary) || list[0] || null;
  });
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customPhotoUri, setCustomPhotoUri] = useState(null);
  const [customBikeName, setCustomBikeName] = useState(BIKE_PRESETS[0].name);
  const [customBikeBrand, setCustomBikeBrand] = useState(BIKE_PRESETS[0].brand);
  const [isRegisterBikeModalOpen, setIsRegisterBikeModalOpen] = useState(false);

  useEffect(() => {
    const unsub = motorcycleService.subscribe(() => {
      if (!currentUser?.id) {
        setRegisteredBikes([]);
        setSelectedRegisteredBike(null);
        return;
      }
      const userBikes = motorcycleService.getMotorcycles(currentUser.id) || [];
      setRegisteredBikes(userBikes);
      setSelectedRegisteredBike((prev) => {
        if (prev && userBikes.some((b) => b.motorcycle_id === prev.motorcycle_id)) return prev;
        return userBikes.find((b) => b.is_primary) || userBikes[0] || null;
      });
    });
    return () => unsub?.();
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
  }, [
    bikeSourceMode,
    selectedRegisteredBike,
    selectedPreset,
    customBikeBrand,
    customBikeName,
    customPhotoUri,
  ]);

  const currentBasePhoto = useMemo(() => {
    if (bikeSourceMode === 'registered') {
      return selectedRegisteredBike?.photo_url || null;
    }
    if (bikeSourceMode === 'presets' && selectedPreset?.image) {
      return selectedPreset.image;
    }
    if (selectedRegisteredBike) {
      return selectedRegisteredBike.photo_url || null;
    }
    return customPhotoUri || null;
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
      Promise.resolve().then(() => {
        setCustomPrompt(synthesizedPromptSentence);
      });
    }
  }, [synthesizedPromptSentence, isPromptCustomized]);

  // ─── 5. MODALS & CHECKOUT / BOOKING STATE ───
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
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
    if (!currentBasePhoto) {
      showToast('⚠️ Please upload or select a photo of your motorcycle to generate an AI customization.');
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

    setIsBookingSubmitting(true);
    try {
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
    } catch (err) {
      console.error('[CustomizerPageWeb] Booking error:', err);
      showToast(err?.message || 'Could not complete installation booking');
    } finally {
      setIsBookingSubmitting(false);
    }
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
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0F1412' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT CUSTOMIZER SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={[
          styles.container,
          isDarkMode && { backgroundColor: '#0F1412' },
          Platform.OS === 'web' ? { overscrollBehavior: 'none', overscrollBehaviorY: 'none' } : {},
        ]}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── 1. NAVBAR ─── */}
        <View style={[styles.headerWrapper, isDarkMode && { backgroundColor: '#151C19', borderBottomColor: '#26332E' }]}>
        <View style={[styles.headerInner, windowWidth < 768 && { paddingHorizontal: 16, paddingVertical: 10, gap: 10 }]}>
          {/* Left: Mobile Nav Toggle + Logo */}
          <View style={styles.headerLeft}>
            {windowWidth < 768 && (
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                }}
                onPress={() => setIsMobileNavOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="Open Navigation Menu"
              >
                <BootstrapIcon name="list" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.logoWrap} onPress={() => onNavigateToStore?.()} activeOpacity={0.8}>
              <BrandLogo size={windowWidth < 400 ? 28 : windowWidth < 768 ? 32 : 42} textColor="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Center Navigation: Shop, Book a Service, Customize (Desktop / Tablet only) */}
          {windowWidth >= 768 && (
            <View style={styles.headerCenterNav}>
              {/* Shop Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={styles.headerCenterBtn}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.8}
                title="Shop"
              >
                <Text style={styles.headerCenterBtnText}>Shop</Text>
              </TouchableOpacity>

              {/* Book a Service Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={styles.headerCenterBtn}
                onPress={() => onNavigateToGarage?.()}
                activeOpacity={0.8}
                title="Book a Service"
              >
                <Text style={styles.headerCenterBtnText}>Book a Service</Text>
              </TouchableOpacity>

              {/* Customize Button (Active) */}
              <TouchableOpacity
                className="main-nav-tab"
                style={styles.headerCenterBtnActive}
                activeOpacity={0.9}
                title="Customize"
              >
                <Text style={styles.headerCenterBtnTextActive}>Customize</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.headerActions, windowWidth < 768 && { gap: 8 }]}>
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
                dataSet={{ notificationButton: true }}
                {...(Platform.OS === 'web' ? { 'data-notification-button': 'true' } : {})}
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
                onNavigateToScreen={(screen, params) => {
                  if (screen === 'store' || screen === 'shop') onNavigateToStore?.();
                  else if (screen === 'orders') onNavigateToOrders?.();
                  else if (screen === 'notifications') onNavigateToProfile?.('notifications');
                  else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'overview');
                  else if (screen === 'garage') onNavigateToGarage?.();
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
                  currentScreen="customizer"
                  showDashboard={true}
                  isDark={isDarkMode}
                  onToggleDarkMode={toggleDarkMode}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('overview')}
                  onNavigateToOrders={() => onNavigateToOrders?.()}
                  onNavigateToProfile={(tab = 'profile') => onNavigateToProfile?.(typeof tab === 'string' ? tab : 'profile')}
                  onNavigateToSettings={() => onNavigateToProfile?.('settings')}
                  onNavigateToWishlist={() => onNavigateToWishlist?.()}
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
      <View style={styles.maxContainer}>
          <AiMotorcycleInstallStudio
            currentUser={currentUser}
            onRequireLogin={() => {
              setRedirectReason?.('ai-install');
              onNavigateToLogin?.();
            }}
            onNavigateToGarage={onNavigateToGarage}
            onNavigateToWishlist={onNavigateToWishlist}
            layout="web"
          />
        </View>
      </ScrollView>

      {/* ─── 2. PART DETAILS & PRICE MODAL ─── */}
      <Modal visible={viewingPartDetails !== null} transparent animationType="fade">
        <View style={styles.partModalOverlay}>
          {viewingPartDetails && (
            <View style={[styles.partModalSheet, isDarkMode && { backgroundColor: '#151C19', borderColor: '#26332E' }]}>
              <View style={[styles.partModalHeader, isDarkMode && { borderBottomColor: '#26332E' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="info-circle-fill" size={18} color={isDarkMode ? '#EA580C' : '#EA580C'} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isDarkMode ? '#F5F7F6' : '#0F172A' }}>
                    Part Details & Fitment
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setViewingPartDetails(null)}>
                  <BootstrapIcon name="x" size={22} color={isDarkMode ? '#AAB4B0' : '#64748B'} />
                </TouchableOpacity>
              </View>

              <View style={[styles.partModalImgBox, isDarkMode && { backgroundColor: '#131A17' }]}>
                <Image
                  source={{ uri: viewingPartDetails.image }}
                  style={styles.partModalImg}
                  resizeMode="cover"
                />
                <View style={[styles.partModalBadge, isDarkMode && { backgroundColor: '#1E3A2F' }]}>
                  <Text style={[styles.partModalBadgeText, isDarkMode && { color: '#EA580C' }]}>
                    {viewingPartDetails.category || 'Performance'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.partModalTitle, isDarkMode && { color: '#F5F7F6' }]}>{viewingPartDetails.name}</Text>
              <Text style={[styles.partModalBrand, isDarkMode && { color: '#AAB4B0' }]}>
                {viewingPartDetails.brand} • In Stock ({viewingPartDetails.stock || 8} available)
              </Text>

              <View style={styles.partModalPriceRow}>
                <Text style={[styles.partModalPricePhp, isDarkMode && { color: '#EA580C' }]}>
                  ₱{usdToPhp(viewingPartDetails.price || 0).toLocaleString()}
                </Text>
                <Text style={[styles.partModalPriceUsd, isDarkMode && { color: '#AAB4B0' }]}>
                  ${Number(viewingPartDetails.price || 0).toFixed(2)} USD
                </Text>
              </View>

              <View style={styles.partModalSpecsRow}>
                <View style={styles.partModalSpecChip}>
                  <BootstrapIcon name="check-circle" size={12} color="#EA580C" />
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
      <BookInstallationModal
        visible={isBookingModalOpen}
        onClose={() => !isBookingSubmitting && setIsBookingModalOpen(false)}
        previewImageUri={currentBasePhoto || null}
        motorcycle={activeMotorcycle}
        bikeTitle={currentBikeTitle}
        serviceName={
          selectedParts.length > 0
            ? `${selectedParts.length} Custom Parts Installation`
            : 'Custom Parts Installation'
        }
        laborFeePhp={3250}
        branches={GARAGE_BRANCHES}
        selectedBranch={bookingBranch}
        onSelectBranch={setBookingBranch}
        timeSlots={TIME_SLOTS}
        selectedTimeSlot={bookingTimeSlot}
        onSelectTimeSlot={setBookingTimeSlot}
        phone={riderPhone}
        onChangePhone={setRiderPhone}
        notes={bookingNotes}
        onChangeNotes={setBookingNotes}
        onConfirm={handleConfirmCustomBooking}
        busy={isBookingSubmitting}
      />

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

      {/* Mobile Customer Navigation Drawer */}
      <CustomerMobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentScreen="customizer"
        onNavigateToScreen={(screen, params) => {
          if (screen === 'shop') onNavigateToStore?.();
          else if (screen === 'garage') onNavigateToGarage?.();
          else if (screen === 'customizer') { /* already here */ }
          else if (screen === 'wishlist') onNavigateToWishlist?.();
          else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'overview');
          else if (screen === 'login') onNavigateToLogin?.();
          else if (screen === 'admin') onNavigateToAdmin?.();
        }}
        unreadNotifCount={unreadNotifCount}
      />
    </View>
  );
}
