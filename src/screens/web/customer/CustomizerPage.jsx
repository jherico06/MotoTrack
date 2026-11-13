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
import { systemSettingsService } from '../../../services/system/systemSettingsService.js';
import { motorcycleService, MOTORCYCLE_PHOTO_PRESETS } from '../../../services/products/motorcycleService.js';
import { notificationService } from '../../../services/notifications/notificationService.js';
import {
  BootstrapIcon,
  ToastNotification,
  UserProfileDropdown,
  UserProfileButton,
  BrandLogo,
  HeaderSearchWidget,
  NotificationDropdown,
  CustomerMobileNavDrawer,
} from '../../../components/common';
import {
  LiveOrderTrackingMapModal,
  RegisterMotorcycleModal,
  CheckoutModal,
  BookInstallationModal,
} from '../../../components/modals';
import CartPage from './CartPage.jsx';
import CustomizationWorkspace from '../../../components/customizer/CustomizationWorkspace.jsx';
import AiMotorcycleInstallStudio from '../../../components/customizer/AiMotorcycleInstallStudio.jsx';
import { useCustomizationBuilder } from '../../../hooks/useCustomizationBuilder.js';
import { pickImageFromFile } from '../../../utils/imagePickerHelper.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCart } from '../../../context/CartContext.jsx';
import { useWishlist } from '../../../context/WishlistContext.jsx';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { useWebSavedWishlistCount } from '../../../components/web/useWebSavedWishlistCount.js';

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
  onNavigateToAppointments,
}) {
  const { isDarkMode, toggleDarkMode, tokens } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const { currentUser, logout, setRedirectReason } = useAuth();
  const { addToCart, showToast, toastMessage, cartItemCount } = useCart();
  const { wishlist, addToWishlist } = useWishlist();
  const savedWishlistCount = useWebSavedWishlistCount(wishlist);

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
    if (!currentUser) return [];
    return motorcycleService.getMotorcycles(currentUser) || [];
  });
  const [bikeSourceMode, setBikeSourceMode] = useState('all'); // 'all' | 'registered' | 'presets' | 'upload'
  const [selectedRegisteredBike, setSelectedRegisteredBike] = useState(() => {
    if (!currentUser) return null;
    const list = motorcycleService.getMotorcycles(currentUser) || [];
    return list.find((b) => b.is_primary) || list[0] || null;
  });
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customPhotoUri, setCustomPhotoUri] = useState(null);
  const [customBikeName, setCustomBikeName] = useState(BIKE_PRESETS[0].name);
  const [customBikeBrand, setCustomBikeBrand] = useState(BIKE_PRESETS[0].brand);
  const [isRegisterBikeModalOpen, setIsRegisterBikeModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      motorcycleService.syncFromSupabase(currentUser).catch(() => {});
    }
    const unsub = motorcycleService.subscribe(() => {
      if (!currentUser) {
        setRegisteredBikes([]);
        setSelectedRegisteredBike(null);
        return;
      }
      const userBikes = motorcycleService.getMotorcycles(currentUser) || [];
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
  const laborFeePhp = systemSettingsService.getCustomizationLaborFee?.() ?? 3250;
  const laborFeeUsd = laborFeePhp / 50;
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
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
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
        user_id: currentUser?.id || currentUser?.user_id,
        customer_id: currentUser?.customer_id || currentUser?.id,
        customer_email: currentUser?.email || '',
      });
      if (res?.success && res.motorcycle) {
        setSelectedRegisteredBike(res.motorcycle);
        setBikeSourceMode('registered');
        setRegisteredBikes(motorcycleService.getMotorcycles(currentUser));
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

  const handleConfirmCustomBooking = async (bookingData = {}) => {
    const effectivePhone = (bookingData?.phone || riderPhone || '').trim();
    if (!effectivePhone) {
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
        branchName: bookingData?.branch || bookingBranch,
        appointmentDate: bookingData?.date || bookingDate,
        timeSlot: bookingData?.timeSlot || bookingTimeSlot,
        customerName: riderName || currentUser?.name || 'Rider',
        customerPhone: effectivePhone,
        plateNumber: bikePlate || activeMotorcycle?.plate_number || 'Custom Project',
        notes: bookingData?.notes !== undefined ? bookingData.notes : bookingNotes,
        downpaymentPercent: bookingData?.downpaymentPercent,
        downpaymentAmount: bookingData?.downpaymentAmount,
        remainingBalance: bookingData?.remainingBalance,
        paymentMethod: bookingData?.paymentMethod,
        currentUser,
      });

      setIsBookingModalOpen(false);
      const dpMsg = booking?.downpayment_amount > 0 ? ` (₱${Number(booking.downpayment_amount).toLocaleString()} deposit)` : '';
      showToast(`🏁 Pitstop installation booked! Ticket #${booking?.id || booking?.booking_id || ''}.${dpMsg}`);
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
    <View
      style={[
        styles.container,
        isDarkMode && { backgroundColor: '#0F1412' },
        Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {},
      ]}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ToastNotification message={toastMessage} />

      {/* ─── FULL-HEIGHT CUSTOMIZER SCROLLVIEW (Scrollbar extends to top: 0 through header, matching Image 1) ─── */}
      <ScrollView
        style={[
          { flex: 1, width: '100%' },
          isDarkMode && { backgroundColor: '#0F1412' },
          Platform.OS === 'web'
            ? { overflowY: 'scroll', overscrollBehavior: 'none', overscrollBehaviorY: 'none' }
            : {},
        ]}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        {/* ─── 1. NAVBAR ─── */}
        <View
          style={[styles.headerWrapper, isDarkMode && { backgroundColor: '#151C19', borderBottomColor: '#26332E' }]}
          className="web-header"
          dataSet={{ webHeader: true }}
          accessibilityRole="header">
        <View
          style={[
            styles.headerInner,
            isTablet && { paddingHorizontal: 18, paddingVertical: 10, minHeight: 60, gap: 12 },
            windowWidth < 768 && { paddingHorizontal: 12, paddingVertical: 10, gap: 8, minHeight: 56 },
            windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
          ]}
        >
          {/* Left: Mobile Nav Toggle + Logo */}
          <View
            style={[
              styles.headerLeft,
              windowWidth < 768 && { gap: 8 },
              windowWidth < 400 && { gap: 4 },
            ]}
          >
            {windowWidth < 768 && (
              <TouchableOpacity
                style={styles.mobileNavToggleBtn}
                onPress={() => setIsMobileNavOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="Open Navigation Menu"
              >
                <BootstrapIcon name="list" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {windowWidth >= 768 && (
              <TouchableOpacity
                style={[styles.logoWrap, isTablet && { marginRight: 4 }]}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.8}
              >
                <BrandLogo size={windowWidth < 768 ? 28 : isTablet ? 30 : windowWidth < 1024 ? 32 : 42} textColor="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Center Navigation: Shop, Book a Service, Customize (Desktop / Tablet only) */}
          {windowWidth >= 768 && (
            <View style={[styles.headerCenterNav, isTablet && { gap: 8 }]}>
              {/* Shop Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[styles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToStore?.()}
                activeOpacity={0.8}
                title="Shop"
              >
                <Text style={[styles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Shop</Text>
              </TouchableOpacity>

              {/* Book a Service Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[styles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToGarage?.()}
                activeOpacity={0.8}
                title="Book a Service"
              >
                <Text style={[styles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>
                  {isTablet ? 'Book Service' : 'Book a Service'}
                </Text>
              </TouchableOpacity>



              {/* Customize Button (Active) */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[styles.headerCenterBtnActive, isTablet && { height: 34, paddingHorizontal: 9 }]}
                activeOpacity={0.9}
                title="Customize"
              >
                <Text style={[styles.headerCenterBtnTextActive, isTablet && { fontSize: 13 }]}>
                  Customize
                </Text>
              </TouchableOpacity>

              {/* Garage Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[styles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToProfile?.('garage')}
                activeOpacity={0.8}
                title="Garage"
              >
                <Text style={[styles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Garage</Text>
              </TouchableOpacity>

              {/* Orders Button */}
              <TouchableOpacity
                className="main-nav-tab"
                style={[styles.headerCenterBtn, isTablet && { height: 34, paddingHorizontal: 9 }]}
                onPress={() => onNavigateToOrders?.()}
                activeOpacity={0.8}
                title="Orders"
              >
                <Text style={[styles.headerCenterBtnText, isTablet && { fontSize: 13 }]}>Orders</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.headerActions, windowWidth < 400 ? { gap: 4 } : windowWidth < 768 ? { gap: 8 } : undefined]}>
            {/* Search Bar / Icon (Smooth appearance, placed before Wishlist) */}
            <HeaderSearchWidget
              onSearch={(query) => onNavigateToStore?.({ search: query })}
              isDark={isDarkMode}
            />

            {windowWidth >= 768 && (<TouchableOpacity
              style={styles.navActionIconBtn}
              onPress={() => onNavigateToWishlist?.()}
              activeOpacity={0.8}
              title="Saved Wishlist"
            >
              <BootstrapIcon name="bookmark" size={16} color="#FFFFFF" />
              {savedWishlistCount > 0 && (
                <View style={styles.navBadgeCircle}>
                  <Text style={styles.navBadgeText}>{savedWishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>)}

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
                  else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'garage');
                  else if (screen === 'garage') onNavigateToGarage?.();
                }}
                currentUser={currentUser}
              />
            </View>

            {windowWidth >= 768 && (<TouchableOpacity
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
            </TouchableOpacity>)}

            {currentUser ? (
              <View style={[styles.loggedInContainer, { position: 'relative' }]}>
                <UserProfileButton
                  currentUser={currentUser}
                  onPress={() => {
                    setIsNotifDropdownOpen(false);
                    setIsUserDropdownOpen(!isUserDropdownOpen);
                  }}
                  size={windowWidth < 400 ? 34 : 40}
                />
                <UserProfileDropdown
                  currentUser={currentUser}
                  isOpen={isUserDropdownOpen}
                  currentScreen="customizer"
                  showDashboard={false}
                  isDark={isDarkMode}
                  onToggleDarkMode={toggleDarkMode}
                  onClose={() => setIsUserDropdownOpen(false)}
                  onNavigateToDashboard={() => onNavigateToProfile?.('garage')}
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
                style={[
                  styles.signInHeaderBtn,
                  windowWidth < 640 && { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
                  windowWidth < 400 && { paddingHorizontal: 8, paddingVertical: 5 },
                  windowWidth < 360 && { width: 34, height: 34, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
                ]}
                onPress={() => onNavigateToLogin?.()}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="person" size={16} color="#FFFFFF" />
                {windowWidth >= 360 && (
                  <Text style={[styles.signInHeaderBtnText, windowWidth < 400 && { fontSize: 12 }]}>Sign In</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── MAIN CONTENT ─── */}
      <View style={[styles.maxContainer, windowWidth < 480 && { paddingHorizontal: 12, paddingTop: 12 }, windowWidth >= 480 && windowWidth < 768 && { paddingHorizontal: 16, paddingTop: 16 }]}>
          <AiMotorcycleInstallStudio
            currentUser={currentUser}
            initialSelectedProduct={initialSelectedProduct}
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
                  <Text style={{ fontSize: 15, fontWeight: '600', color: isDarkMode ? '#F5F7F6' : '#0F172A' }}>
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
          showToast('🎉 Order placed successfully! Check your orders.');
          onNavigateToOrders?.();
        }}
        onOpenProfile={() => {
          setIsCheckoutModalOpen(false);
          onNavigateToProfile?.('profile');
        }}
      />

      {/* ─── 4. CART PAGE ─── */}
      <CartPage
        visible={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        onProceedToCheckout={() => {
          setIsCartModalOpen(false);
          setIsCheckoutModalOpen(true);
        }}
        onNavigateToStore={onNavigateToStore}
        onNavigateToGarage={onNavigateToGarage}
        onNavigateToWishlist={onNavigateToWishlist}
        onNavigateToOrders={onNavigateToOrders}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToAdmin={onNavigateToAdmin}
        onLogout={onLogout}
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
        laborFeePhp={laborFeePhp}
        partsCostPhp={partsTotalPhp}
        branches={GARAGE_BRANCHES}
        selectedBranch={bookingBranch}
        onSelectBranch={setBookingBranch}
        selectedDate={bookingDate}
        onSelectDate={setBookingDate}
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
          else if (screen === 'appointments') {
            if (onNavigateToAppointments) onNavigateToAppointments();
            else onNavigateToGarage?.({ tab: 'appointments' });
          }
          else if (screen === 'customizer') { /* already here */ }
          else if (screen === 'cart') setIsCartModalOpen(true);
          else if (screen === 'wishlist') onNavigateToWishlist?.();
          else if (screen === 'profile') onNavigateToProfile?.(params?.tab || 'garage');
          else if (screen === 'login') onNavigateToLogin?.();
          else if (screen === 'admin') onNavigateToAdmin?.();
        }}
        onOpenCart={() => setIsCartModalOpen(true)}
        unreadNotifCount={unreadNotifCount}
      />
    </View>
  );
}
