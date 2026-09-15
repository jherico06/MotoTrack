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
import { geminiService } from '../services/geminiService';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../services/garageService';
import { BootstrapIcon, BottomNavBar, ToastNotification, BrandLogo } from '../components/common';
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
  initialSelectedProduct,
}) {
  const { currentUser, setRedirectReason } = useAuth();
  const { addToCart, showToast, toastMessage } = useCart();
  const { wishlistCount } = useWishlist();

  // ─── 1. CORE DATA STATES ───
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchPartQuery, setSearchPartQuery] = useState('');

  // ─── 2. MOTORCYCLE BASE PHOTO STATE ───
  const [selectedPreset, setSelectedPreset] = useState(BIKE_PRESETS[0]);
  const [customPhotoUri, setCustomPhotoUri] = useState(null);
  const [customBikeName, setCustomBikeName] = useState(BIKE_PRESETS[0].name);
  const [customBikeBrand, setCustomBikeBrand] = useState(BIKE_PRESETS[0].brand);

  // ─── 3. EQUIPPED PARTS & THEME ───
  const [selectedParts, setSelectedParts] = useState([]);
  const [selectedThemeId, setSelectedThemeId] = useState(CUSTOM_THEMES[0].id);

  // ─── 4. AI GENERATION & CANVAS STATE ───
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(null);
  const [generationResult, setGenerationResult] = useState(null);
  const [activeViewMode, setActiveViewMode] = useState('generated'); // 'generated' | 'original'

  // ─── DUAL-MODE CUSTOMIZATION STATES ───
  const [customizerMode, setCustomizerMode] = useState('upload_inspo'); // 'upload_inspo' | 'generate'
  const [inspoPhotoUri, setInspoPhotoUri] = useState(null);
  const [inspoNotes, setInspoNotes] = useState('');
  const [isInspoAnalyzing, setIsInspoAnalyzing] = useState(false);
  const [inspoProgress, setInspoProgress] = useState(null);
  const [inspoResult, setInspoResult] = useState(null);
  const [inspoSelectedParts, setInspoSelectedParts] = useState([]);
  const [customPrompt, setCustomPrompt] = useState('');

  // ─── 5. GEMINI API KEY STATE ───
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(() => geminiService.getApiKey());
  const [hasGeminiKey, setHasGeminiKey] = useState(() => geminiService.hasApiKey());

  // ─── 6. BOOKING MODAL STATE ───
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingBranch, setBookingBranch] = useState(GARAGE_BRANCHES[0].name);
  const [bookingDate, setBookingDate] = useState('Tomorrow, 10:30 AM');
  const [bookingTimeSlot, setBookingTimeSlot] = useState(TIME_SLOTS[1]);
  const [riderName, setRiderName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [riderPhone, setRiderPhone] = useState(currentUser?.phone || '+63 917 882 9102');
  const [bikePlate, setBikePlate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');


  // Load products catalog
  useEffect(() => {
    productService.getProducts().then((data) => {
      if (Array.isArray(data)) {
        setCatalogProducts(data);
        if (initialSelectedProduct) {
          setSelectedParts([initialSelectedProduct]);
        } else {
          const defaultExhaust = data.find((p) => (p.category || '').toLowerCase().includes('exhaust'));
          if (defaultExhaust) {
            setSelectedParts([defaultExhaust]);
          }
        }
      }
    });
  }, [initialSelectedProduct]);

  // Current active bike photo URI
  const currentBasePhoto = customPhotoUri || selectedPreset?.image;
  const currentBikeTitle = customBikeName || selectedPreset?.name || 'Custom Motorcycle';

  // Filtered Parts Catalog
  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((item) => {
      const matchCat =
        selectedCategory === 'All' || (item.category || '').toLowerCase() === selectedCategory.toLowerCase();
      const matchQuery =
        !searchPartQuery ||
        item.name.toLowerCase().includes(searchPartQuery.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchPartQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [catalogProducts, selectedCategory, searchPartQuery]);

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = ['All', ...new Set(catalogProducts.map((p) => p.category).filter(Boolean))];
    return cats;
  }, [catalogProducts]);

  // Calculate live diagnostics based on current selections
  const liveDiagnostics = useMemo(() => {
    return aiCustomizerService.calculatePerformanceGains(selectedParts, selectedPreset);
  }, [selectedParts, selectedPreset]);

  // Total parts cost calculation
  const partsTotalUsd = useMemo(() => {
    return selectedParts.reduce((sum, p) => sum + Number(p.price || 0), 0);
  }, [selectedParts]);
  const partsTotalPhp = usdToPhp(partsTotalUsd);

  // ─── ACTIONS ───

  // Pick Custom Bike Photo from Device
  const handleUploadBikePhoto = async () => {
    try {
      const res = await pickImageFromFile();
      if (res.success && res.uri) {
        setCustomPhotoUri(res.uri);
        setSelectedPreset(null);
        setCustomBikeName('My Custom Motorcycle');
        showToast('📸 Motorcycle photo loaded! Select performance parts to equip.');
      } else if (res.error && res.error !== 'Selection cancelled') {
        showToast(`Upload note: ${res.error}`);
      }
    } catch (err) {
      showToast('Could not access photo library');
    }
  };

  // Select Preset Bike
  const handleSelectPreset = (preset) => {
    setCustomPhotoUri(null);
    setSelectedPreset(preset);
    setCustomBikeName(preset.name);
    setCustomBikeBrand(preset.brand);
    setGenerationResult(null);
  };

  // Toggle Part Selection
  const handleTogglePart = (product) => {
    const exists = selectedParts.some((p) => p.id === product.id || p.product_id === product.id);
    if (exists) {
      setSelectedParts(selectedParts.filter((p) => p.id !== product.id && p.product_id !== product.id));
    } else {
      setSelectedParts([...selectedParts, product]);
    }
    if (generationResult) {
      setGenerationResult(null);
    }
  };

  // Save Gemini Key
  const handleSaveGeminiKey = () => {
    geminiService.setApiKey(geminiApiKeyInput);
    const valid = geminiService.hasApiKey();
    setHasGeminiKey(valid);
    setIsGeminiModalOpen(false);
    showToast(valid ? '✨ Gemini AI API Key saved & activated!' : 'Gemini Key cleared');
  };

  // ─── INSPIRATION / DESIRED CUSTOM ACTIONS ───
  const handleUploadInspoPhoto = async () => {
    try {
      const res = await pickImageFromFile();
      if (res.success && res.uri) {
        setInspoPhotoUri(res.uri);
        setInspoResult(null);
        showToast('📸 Custom motorcycle photo loaded! Tap "Analyze With Gemini" to scan.');
      } else if (res.error && res.error !== 'Selection cancelled') {
        showToast(`Upload note: ${res.error}`);
      }
    } catch (err) {
      showToast('Could not access photo library');
    }
  };

  const handleAnalyzeInspo = async () => {
    if (!inspoPhotoUri) {
      showToast('⚠️ Please upload a photo of your desired custom motorcycle first.');
      return;
    }

    setIsInspoAnalyzing(true);
    setInspoProgress({
      step: 1,
      totalSteps: 5,
      message: hasGeminiKey
        ? 'Connecting to Google Gemini 3.6 Flash Vision...'
        : 'Initializing Neural Vision Engine...',
      percentage: 15,
    });

    try {
      const result = await aiCustomizerService.analyzeDesiredCustomPhoto({
        photoUri: inspoPhotoUri,
        userNotes: inspoNotes,
        catalogProducts,
        onProgress: (prog) => setInspoProgress(prog),
      });

      setInspoResult(result);
      setInspoSelectedParts(result.matchedParts || []);
      showToast(`✨ Custom build analyzed with ${result.poweredBy}!`);
    } catch (err) {
      showToast('Inspiration analysis failed. Please try again.');
    } finally {
      setIsInspoAnalyzing(false);
      setInspoProgress(null);
    }
  };

  const handleToggleInspoPart = (part) => {
    const exists = inspoSelectedParts.some((p) => p.id === part.id);
    if (exists) {
      setInspoSelectedParts(inspoSelectedParts.filter((p) => p.id !== part.id));
    } else {
      setInspoSelectedParts([...inspoSelectedParts, part]);
    }
  };

  const handleTransferInspoToStudio = () => {
    if (inspoSelectedParts.length > 0) {
      setSelectedParts(inspoSelectedParts);
    }
    if (inspoResult?.tagline) {
      setCustomPrompt(`${inspoResult.bikeStyle || ''} - ${inspoResult.tagline}`);
    }
    setCustomizerMode('generate');
    showToast('🚀 Matched parts loaded into AI Custom Studio! Ready to render.');
  };

  const handleAddInspoPartsToCart = () => {
    if (inspoSelectedParts.length === 0) {
      showToast('No parts selected to add to bag');
      return;
    }
    inspoSelectedParts.forEach((part) => {
      addToCart(part, 1);
    });
    showToast(`🛒 Added ${inspoSelectedParts.length} matched custom parts to your shopping bag!`);
  };

  // Trigger AI Customization Generation
  const handleGenerateAI = async () => {
    if (selectedParts.length === 0) {
      showToast('⚠️ Please select at least 1 motor part to customize onto your motorcycle.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({
      step: 1,
      totalSteps: 5,
      message: hasGeminiKey
        ? 'Connecting to Google Gemini Vision Engine...'
        : 'Initializing Neural Vision Engine...',
      percentage: 10,
    });

    try {
      const result = await aiCustomizerService.generateAICustomization({
        bikePhotoUri: currentBasePhoto,
        bikeName: currentBikeTitle,
        bikeBrand: customBikeBrand,
        selectedParts,
        selectedThemeId,
        customPrompt,
        onProgress: (prog) => setGenerationProgress(prog),
      });

      setGenerationResult(result);
      setActiveViewMode('generated');
      showToast(`⚡ AI Customization complete! Powered by ${result.geminiAnalysis?.poweredBy || 'AI'}`);
    } catch (err) {
      showToast('AI Customization failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  // Open Customization Booking Modal
  const handleOpenBookingModal = () => {
    if (!currentUser) {
      setRedirectReason('Please sign in to book your AI customization & installation appointment.');
      onNavigateToLogin?.();
      return;
    }
    setIsBookingModalOpen(true);
  };

  // Confirm Customization Booking
  const handleConfirmCustomBooking = async () => {
    if (!riderPhone.trim()) {
      showToast('Please enter your contact phone number');
      return;
    }

    let customizationPayload;
    if (customizerMode === 'upload_inspo' && inspoResult) {
      const inspoCostUsd = inspoSelectedParts.reduce((sum, p) => sum + Number(p.price || 0), 0);
      customizationPayload = {
        customizationId: inspoResult.customizationId || 'INSP-' + Math.floor(10000 + Math.random() * 90000),
        bikeName: inspoResult.bikeStyle || 'Custom Motorcycle Build',
        bikeBrand: 'Custom Inspo Build',
        selectedParts: inspoSelectedParts,
        partsTotalUsd: inspoCostUsd,
        partsTotalPhp: usdToPhp(inspoCostUsd),
        generatedImage: inspoResult.photoUri,
        diagnostics: {
          hpGain: inspoResult.estimatedHpGain,
          weightSavingsKg: inspoResult.weightSavingsKg,
          soundProfile: inspoResult.exhaustSoundProfile,
        },
      };
    } else {
      customizationPayload = generationResult || {
        customizationId: 'AI-CUST-' + Math.floor(10000 + Math.random() * 90000),
        bikeName: currentBikeTitle,
        bikeBrand: customBikeBrand,
        selectedParts,
        partsTotalUsd,
        partsTotalPhp,
        generatedImage: currentBasePhoto,
        diagnostics: liveDiagnostics,
      };
    }

    const booking = await aiCustomizerService.bookCustomizationService({
      customizationData: customizationPayload,
      branchName: bookingBranch,
      appointmentDate: bookingDate,
      timeSlot: bookingTimeSlot,
      customerName: riderName || currentUser?.name || 'MotoTrack Rider',
      customerPhone: riderPhone,
      plateNumber: bikePlate || 'Custom Project',
      notes: bookingNotes,
      currentUser,
    });

    setIsBookingModalOpen(false);
    showToast(`🏁 Customization appointment booked! Ticket #${booking.id}`);
    onNavigateToGarage?.();
  };


  // Add all selected parts to Shopping Cart
  const handleAddAllToCart = () => {
    if (selectedParts.length === 0) {
      showToast('No parts selected to add to bag');
      return;
    }
    selectedParts.forEach((part) => {
      addToCart(part, 1);
    });
    showToast(`🛒 Added ${selectedParts.length} custom parts to your shopping bag!`);
  };

  // Active displayed image in canvas
  const displayedCanvasImage =
    generationResult && activeViewMode === 'generated' ? generationResult.generatedImage : currentBasePhoto;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ToastNotification message={toastMessage} />

      {/* ─── 1. TOP MOBILE HEADER ─── */}
      <View style={styles.headerWrapper}>
        <View style={[styles.maxContainer, styles.headerInner]}>
          <View style={styles.logoRow}>
            <BrandLogo size={36} />
          </View>
        </View>
      </View>

      {/* ─── SCROLLABLE STUDIO ─── */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* ─── 2. HERO SHOWCASE BANNER ─── */}
          <View style={styles.heroSection}>
            <View style={styles.heroPill}>
              <BootstrapIcon name="cpu-fill" size={12} color="#A7F3D0" />
              <Text style={styles.heroPillText}>AI Vision & Dyno Engine</Text>
            </View>
            <Text style={styles.heroHeading}>Customize Your Motorcycle with AI Vision.</Text>
            <Text style={styles.heroSub}>
              Upload your bike photo, equip race exhausts & performance parts, then render a photorealistic 4K
              preview with dynamic dyno telemetry.
            </Text>
          </View>

          {/* ─── DUAL-MODE SELECTOR TABS ─── */}
          <View style={styles.modeSelectorWrapper}>
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                style={[styles.modeTab, customizerMode === 'upload_inspo' && styles.modeTabActive]}
                onPress={() => setCustomizerMode('upload_inspo')}
                activeOpacity={0.85}
              >
                <View style={styles.modeTabHeader}>
                  <View
                    style={[
                      styles.modeIconWrap,
                      customizerMode === 'upload_inspo' && styles.modeIconWrapActive,
                    ]}
                  >
                    <BootstrapIcon
                      name="camera-fill"
                      size={17}
                      color={customizerMode === 'upload_inspo' ? '#FFFFFF' : '#0C6258'}
                    />
                  </View>
                  <View
                    style={[
                      styles.modeTabBadge,
                      customizerMode === 'upload_inspo' && styles.modeTabBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeTabBadgeText,
                        customizerMode === 'upload_inspo' && styles.modeTabBadgeTextActive,
                      ]}
                    >
                      AI Vision
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.modeTabTitle,
                    customizerMode === 'upload_inspo' && styles.modeTabTitleActive,
                  ]}
                >
                  Send Desired Custom
                </Text>
                <Text style={styles.modeTabDesc}>
                  Upload a photo of your dream custom motorcycle. AI analyzes mods and matches real parts.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, customizerMode === 'generate' && styles.modeTabActive]}
                onPress={() => setCustomizerMode('generate')}
                activeOpacity={0.85}
              >
                <View style={styles.modeTabHeader}>
                  <View
                    style={[
                      styles.modeIconWrap,
                      customizerMode === 'generate' && styles.modeIconWrapActive,
                    ]}
                  >
                    <BootstrapIcon
                      name="magic"
                      size={17}
                      color={customizerMode === 'generate' ? '#FFFFFF' : '#0C6258'}
                    />
                  </View>
                  <View
                    style={[
                      styles.modeTabBadge,
                      customizerMode === 'generate' && styles.modeTabBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeTabBadgeText,
                        customizerMode === 'generate' && styles.modeTabBadgeTextActive,
                      ]}
                    >
                      AI Studio
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.modeTabTitle,
                    customizerMode === 'generate' && styles.modeTabTitleActive,
                  ]}
                >
                  Generate AI Custom
                </Text>
                <Text style={styles.modeTabDesc}>
                  Choose bike presets, themes, styling prompts & race parts to render custom machine.
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {customizerMode === 'upload_inspo' ? (
            /* ── INSPIRATION / SEND DESIRED CUSTOM VIEW ── */
            <View style={styles.studioLayout}>
              {/* Left: Inspo Photo Uploader & Notes */}
              <View style={styles.canvasColumn}>
                <View style={styles.workbenchCard}>
                  <View style={styles.sectionHeadingRow}>
                    <Text style={styles.sectionHeading}>Upload Your Desired Custom Motorcycle</Text>
                    {inspoPhotoUri && (
                      <TouchableOpacity onPress={() => setInspoPhotoUri(null)}>
                        <Text style={styles.sectionHeadingSub}>Clear Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Photo Upload Box or Preview */}
                  {inspoPhotoUri ? (
                    <View style={{ marginBottom: 14, position: 'relative' }}>
                      <Image
                        source={{ uri: inspoPhotoUri }}
                        style={styles.inspoPreviewImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={[
                          styles.backBtn,
                          {
                            position: 'absolute',
                            bottom: 12,
                            right: 12,
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            borderColor: '#334155',
                          },
                        ]}
                        onPress={handleUploadInspoPhoto}
                        activeOpacity={0.8}
                      >
                        <BootstrapIcon name="camera-fill" size={13} color="#FFFFFF" />
                        <Text style={[styles.backBtnText, { color: '#FFFFFF' }]}>Change Photo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadBox}
                      onPress={handleUploadInspoPhoto}
                      activeOpacity={0.8}
                    >
                      <View style={styles.uploadIconCircle}>
                        <BootstrapIcon name="camera-fill" size={24} color="#0C6258" />
                      </View>
                      <Text style={styles.uploadTitle}>Choose Photo of Desired Custom Bike</Text>
                      <Text style={styles.uploadSubtitle}>
                        Supports JPG / PNG photo from your camera roll or device files
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Rider Notes / Specific Modifications */}
                  <Text style={[styles.formLabel, { marginTop: 8 }]}>
                    Build Notes or Specific Modifications (Optional):
                  </Text>
                  <TextInput
                    style={styles.inspoNotesInput}
                    placeholder="e.g. I want this cafe racer exhaust, low handlebars, and custom gold wheels..."
                    placeholderTextColor="#94A3B8"
                    value={inspoNotes}
                    onChangeText={setInspoNotes}
                    multiline
                  />

                  {/* Analyze Button */}
                  <TouchableOpacity
                    style={[
                      styles.generateCtaBtn,
                      (!inspoPhotoUri || isInspoAnalyzing) && { opacity: 0.7 },
                    ]}
                    onPress={handleAnalyzeInspo}
                    disabled={!inspoPhotoUri || isInspoAnalyzing}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
                    <Text style={styles.generateCtaText}>
                      {isInspoAnalyzing
                        ? inspoProgress?.message || 'Analyzing with Gemini Vision...'
                        : '🔍 Analyze Custom Build with Gemini Vision'}
                    </Text>
                  </TouchableOpacity>

                  {/* Scanning Animation */}
                  {isInspoAnalyzing && (
                    <View style={{ marginTop: 14 }}>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${inspoProgress?.percentage || 30}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressPercentText, { textAlign: 'center', marginTop: 6 }]}>
                        {inspoProgress?.percentage || 30}% - {inspoProgress?.message}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right: Analysis Teardown & Matched Store Parts */}
              <View style={styles.controlsColumn}>
                {inspoResult ? (
                  <>
                    {/* Teardown Card */}
                    <View style={styles.inspoResultCard}>
                      <View style={styles.inspoStyleBadgeRow}>
                        <View style={styles.inspoStylePill}>
                          <Text style={styles.inspoStylePillText}>{inspoResult.bikeStyle}</Text>
                        </View>
                        <View style={styles.geminiBadge}>
                          <Text style={styles.geminiBadgeText}>{inspoResult.poweredBy}</Text>
                        </View>
                      </View>

                      <Text style={styles.inspoTaglineText}>{inspoResult.tagline}</Text>
                      <Text style={styles.inspoSummaryText}>{inspoResult.engineeringSummary}</Text>

                      {/* Detected Custom Modifications */}
                      <Text style={[styles.formLabel, { marginBottom: 8 }]}>Detected Custom Modifications:</Text>
                      <View style={styles.inspoModsWrap}>
                        {inspoResult.detectedModifications.map((mod, i) => (
                          <View key={i} style={styles.inspoModChip}>
                            <BootstrapIcon name="check2-circle" size={12} color="#0C6258" />
                            <Text style={styles.inspoModChipText}>{mod}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Performance Impact */}
                      <View style={styles.diagnosticsCard}>
                        <View style={styles.diagHeader}>
                          <Text style={styles.diagTitle}>Estimated Custom Performance Impact</Text>
                          <Text style={{ fontSize: 11, color: '#0C6258', fontWeight: '800' }}>
                            {inspoResult.difficultyRating}
                          </Text>
                        </View>
                        <View style={styles.diagGrid}>
                          <View style={styles.diagItem}>
                            <Text style={styles.diagItemLabel}>Est. Horsepower Boost</Text>
                            <Text style={styles.diagItemVal}>+{inspoResult.estimatedHpGain} HP</Text>
                          </View>
                          <View style={styles.diagItem}>
                            <Text style={styles.diagItemLabel}>Est. Weight Savings</Text>
                            <Text style={styles.diagItemVal}>-{inspoResult.weightSavingsKg} kg</Text>
                          </View>
                          <View style={[styles.diagItem, { width: '100%' }]}>
                            <Text style={styles.diagItemLabel}>Acoustics Profile</Text>
                            <Text style={[styles.diagItemVal, { fontSize: 12 }]} numberOfLines={2}>
                              {inspoResult.exhaustSoundProfile}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Matched Parts From MotoTrack Store */}
                    <View style={styles.matchedPartsCard}>
                      <View style={styles.matchedPartsHeader}>
                        <View>
                          <Text style={styles.matchedPartsTitle}>Matched Parts From Our Store</Text>
                          <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                            Recreate this custom build with genuine in-stock components
                          </Text>
                        </View>
                        <View style={styles.matchedPartsCountBadge}>
                          <Text style={styles.matchedPartsCountText}>
                            {inspoSelectedParts.length} Selected
                          </Text>
                        </View>
                      </View>

                      {inspoResult.matchedParts.map((part) => {
                        const isSelected = inspoSelectedParts.some((p) => p.id === part.id);
                        return (
                          <TouchableOpacity
                            key={part.id}
                            style={[styles.matchedPartItem, isSelected && styles.matchedPartItemActive]}
                            onPress={() => handleToggleInspoPart(part)}
                            activeOpacity={0.8}
                          >
                            <View
                              style={[
                                styles.checkboxCircle,
                                isSelected && styles.checkboxCircleSelected,
                              ]}
                            >
                              {isSelected && <BootstrapIcon name="check" size={13} color="#FFFFFF" />}
                            </View>
                            <Image
                              source={{ uri: part.image_url || part.image }}
                              style={styles.matchedPartImg}
                              resizeMode="cover"
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.matchedPartName} numberOfLines={1}>
                                {part.name}
                              </Text>
                              <Text style={styles.matchedPartBrand}>
                                {part.brand} • {part.category}
                              </Text>
                              <Text style={styles.matchedPartPrice}>
                                ₱{usdToPhp(part.price).toLocaleString()} (${part.price})
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Action buttons */}
                      <View style={{ gap: 8, marginTop: 14 }}>
                        <TouchableOpacity
                          style={styles.addCartBtn}
                          onPress={handleAddInspoPartsToCart}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="bag-plus-fill" size={14} color="#E2E8F0" />
                          <Text style={styles.addCartBtnText}>
                            Add Selected ({inspoSelectedParts.length}) to Shopping Bag
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.generateCtaBtn}
                          onPress={handleTransferInspoToStudio}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="magic" size={15} color="#FFFFFF" />
                          <Text style={styles.generateCtaText}>
                            Transfer to AI Studio & Generate Render
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.bookServiceBtn}
                          onPress={handleOpenBookingModal}
                          activeOpacity={0.85}
                        >
                          <BootstrapIcon name="calendar-check-fill" size={15} color="#0C6258" />
                          <Text style={styles.bookServiceBtnText}>
                            Book Pitstop Garage Customization
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={[styles.workbenchCard, { alignItems: 'center', paddingVertical: 40 }]}>
                    <View
                      style={[
                        styles.modeIconWrap,
                        { width: 56, height: 56, borderRadius: 16, marginBottom: 14 },
                      ]}
                    >
                      <BootstrapIcon name="stars" size={24} color="#0C6258" />
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '800',
                        color: '#0F172A',
                        textAlign: 'center',
                        marginBottom: 6,
                      }}
                    >
                      Ready For Gemini AI Vision
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        color: '#64748B',
                        textAlign: 'center',
                        maxWidth: 320,
                        lineHeight: 18,
                      }}
                    >
                      Upload a photo of any motorcycle build you love. Gemini AI will break down every modification, estimate dyno telemetry, and match parts in our store.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* ── 3. MOBILE STUDIO STACK ── */
            <View style={styles.studioLayout}>

            {/* ── 4K AI CANVAS & LIVE DIAGNOSTICS ── */}
            <View style={styles.canvasColumn}>
              <View style={styles.canvasCard}>
                <View style={styles.canvasImageContainer}>
                  <Image
                    source={{ uri: displayedCanvasImage }}
                    style={styles.canvasImage}
                    resizeMode="cover"
                  />

                  {/* Top Overlay Controls */}
                  <View style={styles.canvasOverlayHeader}>
                    <View style={styles.bikeTagBadge}>
                      <BootstrapIcon name="bicycle" size={13} color="#0C6258" />
                      <Text style={styles.bikeTagText} numberOfLines={1}>
                        {currentBikeTitle}
                      </Text>
                    </View>

                    {generationResult && (
                      <TouchableOpacity
                        style={styles.toggleViewBtn}
                        onPress={() =>
                          setActiveViewMode((prev) => (prev === 'generated' ? 'original' : 'generated'))
                        }
                        activeOpacity={0.85}
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
                    )}
                  </View>

                  {/* Scanning Animation Overlay */}
                  {isGenerating && (
                    <View style={styles.scanOverlay}>
                      <View style={styles.scanSpinnerBox}>
                        <BootstrapIcon name="cpu" size={28} color="#10B981" />
                      </View>
                      <Text style={styles.scanTitle}>
                        {hasGeminiKey ? 'Gemini AI Vision Active' : 'Neural Synthesis Active'}
                      </Text>
                      <Text style={styles.scanSub}>
                        {generationProgress?.message || 'Processing 4K render...'}
                      </Text>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${generationProgress?.percentage || 30}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressPercentText}>
                        {generationProgress?.percentage || 30}% Complete
                      </Text>
                    </View>
                  )}
                </View>

                {/* Gemini AI Live Analysis Insights (if available) */}
                {generationResult?.geminiAnalysis && (
                  <View style={styles.geminiCard}>
                    <View style={styles.geminiCardHeader}>
                      <View style={styles.geminiTitleWrap}>
                        <BootstrapIcon name="stars" size={14} color="#10B981" />
                        <Text style={styles.geminiTitle}>
                          {generationResult.geminiAnalysis.tagline || 'AI Build Diagnostics'}
                        </Text>
                      </View>
                      <View style={styles.geminiBadge}>
                        <Text style={styles.geminiBadgeText}>
                          {generationResult.geminiAnalysis.poweredBy}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.geminiSummary}>
                      {generationResult.geminiAnalysis.engineeringSummary}
                    </Text>
                    {generationResult.geminiAnalysis.dynoAdvice && (
                      <View style={styles.dynoAdviceBox}>
                        <BootstrapIcon
                          name="wrench-adjustable"
                          size={12}
                          color="#10B981"
                          style={{ marginTop: 2 }}
                        />
                        <Text style={styles.dynoAdviceText}>
                          <Text style={{ fontWeight: '800', color: '#0C6258' }}>Dyno Advice: </Text>
                          {generationResult.geminiAnalysis.dynoAdvice}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Performance Diagnostics Sheet */}
                <View style={styles.diagnosticsCard}>
                  <View style={styles.diagHeader}>
                    <Text style={styles.diagTitle}>Estimated Performance</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <BootstrapIcon name="speedometer2" size={13} color="#0C6258" />
                      <Text style={{ fontSize: 11, color: '#0C6258', fontWeight: '800' }}>
                        {liveDiagnostics.powerToWeightRatio}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.diagGrid}>
                    <View style={styles.diagItem}>
                      <Text style={styles.diagItemLabel}>Peak Horsepower</Text>
                      <Text style={styles.diagItemVal}>
                        {liveDiagnostics.estimatedFinalHp} HP{' '}
                        <Text style={{ fontSize: 10.5, color: '#10B981' }}>
                          (+{liveDiagnostics.hpGain} HP)
                        </Text>
                      </Text>
                      <Text style={styles.diagItemSub}>Stock: {liveDiagnostics.baseHp} HP</Text>
                    </View>

                    <View style={styles.diagItem}>
                      <Text style={styles.diagItemLabel}>Curb Weight</Text>
                      <Text style={styles.diagItemVal}>
                        {liveDiagnostics.estimatedFinalWeight} kg{' '}
                        <Text style={{ fontSize: 10.5, color: '#10B981' }}>
                          (-{liveDiagnostics.weightSavingsKg} kg)
                        </Text>
                      </Text>
                      <Text style={styles.diagItemSub}>Stock: {liveDiagnostics.baseWeight} kg</Text>
                    </View>

                    <View style={styles.diagItem}>
                      <Text style={styles.diagItemLabel}>Braking Efficiency</Text>
                      <Text style={styles.diagItemVal}>+{liveDiagnostics.brakingEfficiencyPercent}%</Text>
                      <Text style={styles.diagItemSub}>Brembo Radial Bite</Text>
                    </View>

                    <View style={styles.diagItem}>
                      <Text style={styles.diagItemLabel}>Acoustic Sound</Text>
                      <Text style={[styles.diagItemVal, { fontSize: 12.5 }]} numberOfLines={1}>
                        {liveDiagnostics.soundLevelDb} dB
                      </Text>
                      <Text style={styles.diagItemSub} numberOfLines={1}>
                        {liveDiagnostics.soundProfile}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bottom Quick Action CTAs */}
              <View style={styles.actionButtonsGroup}>
                <TouchableOpacity
                  style={styles.generateCtaBtn}
                  onPress={handleGenerateAI}
                  activeOpacity={0.9}
                  disabled={isGenerating}
                >
                  <BootstrapIcon name="magic" size={17} color="#FFFFFF" />
                  <Text style={styles.generateCtaText}>
                    {generationResult ? '⚡ Re-Generate AI Custom' : '⚡ Generate AI Motorcycle Photo'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bookServiceBtn}
                  onPress={handleOpenBookingModal}
                  activeOpacity={0.85}
                >
                  <BootstrapIcon name="calendar-check-fill" size={15} color="#0C6258" />
                  <Text style={styles.bookServiceBtnText}>Book Pitstop Customization & Fitting</Text>
                </TouchableOpacity>

                {selectedParts.length > 0 && (
                  <TouchableOpacity
                    style={styles.addCartBtn}
                    onPress={handleAddAllToCart}
                    activeOpacity={0.85}
                  >
                    <BootstrapIcon name="bag-plus-fill" size={14} color="#E2E8F0" />
                    <Text style={styles.addCartBtnText}>
                      Add All ({selectedParts.length}) Selected Parts • ₱{partsTotalPhp.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── WORKBENCH CONTROLS (RIGHT / STACKED) ── */}
            <View style={styles.controlsColumn}>
              {/* 1. Base Motorcycle Photo / Presets */}
              <View style={styles.workbenchCard}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeading}>1. Motorcycle Base Photo</Text>
                  {customPhotoUri && (
                    <TouchableOpacity onPress={() => handleSelectPreset(BIKE_PRESETS[0])}>
                      <Text style={styles.sectionHeadingSub}>Reset Presets</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Upload Button */}
                <TouchableOpacity
                  style={[styles.uploadBox, customPhotoUri && styles.uploadBoxActive]}
                  onPress={handleUploadBikePhoto}
                  activeOpacity={0.8}
                >
                  <View style={styles.uploadIconCircle}>
                    <BootstrapIcon
                      name={customPhotoUri ? 'check-circle-fill' : 'camera-fill'}
                      size={20}
                      color={customPhotoUri ? '#0C6258' : '#94A3B8'}
                    />
                  </View>
                  <Text style={styles.uploadTitle}>
                    {customPhotoUri ? 'Custom Motorcycle Photo Loaded' : 'Upload Your Motorcycle Photo'}
                  </Text>
                  <Text style={styles.uploadSubtitle}>
                    {customPhotoUri ? 'Tap to change photo' : 'Supports JPG / PNG photo from your device'}
                  </Text>
                </TouchableOpacity>

                {/* Preset Bike Selector */}
                <Text style={[styles.formLabel, { marginTop: 4, marginBottom: 8 }]}>
                  Or Choose From Presets:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.presetBikesScroll}
                >
                  {BIKE_PRESETS.map((preset) => {
                    const isSelected = selectedPreset?.id === preset.id && !customPhotoUri;
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

              {/* 2. Custom Finish & Theme */}
              <View style={styles.workbenchCard}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeading}>2. Custom Theme & Finish</Text>
                </View>

                <View style={styles.themeGrid}>
                  {CUSTOM_THEMES.map((theme) => {
                    const isSelected = selectedThemeId === theme.id;
                    return (
                      <TouchableOpacity
                        key={theme.id}
                        style={[styles.themeCard, isSelected && styles.themeCardActive]}
                        onPress={() => {
                          setSelectedThemeId(theme.id);
                          if (generationResult) setGenerationResult(null);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={styles.themeTitle}>{theme.name}</Text>
                            <View style={styles.themeBadge}>
                              <Text style={styles.themeBadgeText}>{theme.badge}</Text>
                            </View>
                          </View>
                          <Text style={styles.themeDesc}>{theme.description}</Text>
                        </View>

                        <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected]}>
                          {isSelected && <BootstrapIcon name="check" size={13} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Generative Styling Prompt */}
                <Text style={[styles.formLabel, { marginTop: 14, marginBottom: 4 }]}>
                  AI Styling Prompt (Optional):
                </Text>
                <TextInput
                  style={styles.customPromptInput}
                  placeholder="e.g. Matte titanium frame with acid neon accents, high-exit Akrapovic pipe..."
                  placeholderTextColor="#94A3B8"
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  multiline
                />
              </View>


              {/* 3. Motor Parts Catalog Selector */}
              <View style={styles.workbenchCard}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeading}>3. Equip Performance Parts</Text>
                  <Text style={styles.sectionHeadingSub}>{selectedParts.length} Parts Equipped</Text>
                </View>

                {/* Category Filter Pills */}
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
                          style={[styles.partsCategoryText, isCatActive && styles.partsCategoryTextActive]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Search Bar */}
                <View style={styles.partsSearchBox}>
                  <BootstrapIcon name="search" size={13} color="#64748B" />
                  <TextInput
                    style={styles.partsSearchInput}
                    placeholder="Search parts..."
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
                        onPress={() => handleTogglePart(product)}
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
                        </View>

                        <View style={styles.partPriceRow}>
                          <Text style={styles.partPricePhp}>
                            ₱{usdToPhp(product.price || 0).toLocaleString()}
                          </Text>
                          <Text style={styles.partPriceUsd}>${Number(product.price || 0).toFixed(2)}</Text>
                        </View>

                        <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleSelected]}>
                          {isSelected && <BootstrapIcon name="check" size={13} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Selected Parts Summary Tray */}
                {selectedParts.length > 0 && (
                  <View style={styles.selectedTray}>
                    <View style={styles.selectedTrayHeader}>
                      <Text style={styles.selectedTrayTitle}>Custom Build Parts Total:</Text>
                      <Text style={styles.selectedTrayTotal}>
                        ₱{partsTotalPhp.toLocaleString()} (${partsTotalUsd.toFixed(2)})
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                      Includes {selectedParts.length} performance modifications selected.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          )}
        </View>
      </ScrollView>


      {/* ─── 4. GEMINI API KEY MODAL ─── */}
      <Modal visible={isGeminiModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="key-fill" size={16} color="#0C6258" />
                <Text style={styles.modalTitle}>Google Gemini API Key</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsGeminiModalOpen(false)}>
                <BootstrapIcon name="x" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 18, marginBottom: 12 }}>
              Enter your Google Gemini API Key to enable 4K photorealistic neural visual generation and live
              dyno engineering diagnostics.
            </Text>

            <Text style={styles.formLabel}>Gemini API Key</Text>
            <TextInput
              style={styles.formInput}
              placeholder="AIzaSy..."
              placeholderTextColor="#64748B"
              value={geminiApiKeyInput}
              onChangeText={setGeminiApiKeyInput}
              secureTextEntry
            />

            <TouchableOpacity style={styles.generateCtaBtn} onPress={handleSaveGeminiKey} activeOpacity={0.9}>
              <BootstrapIcon name="check-circle-fill" size={15} color="#FFFFFF" />
              <Text style={styles.generateCtaText}>Save & Activate Gemini AI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── 5. BOOKING MODAL ─── */}
      <Modal visible={isBookingModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <BootstrapIcon name="calendar-check-fill" size={16} color="#0C6258" />
                <Text style={styles.modalTitle}>Book Customization Pitstop</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsBookingModalOpen(false)}>
                <BootstrapIcon name="x" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              {/* Form 1: Branch */}
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

              {/* Form 2: Time Slot */}
              <Text style={[styles.formLabel, { marginTop: 8 }]}>Appointment Time Slot *</Text>
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

              {/* Form 3: Rider Contact */}
              <Text style={[styles.formLabel, { marginTop: 8 }]}>Contact Phone Number *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+63 9XX XXX XXXX"
                placeholderTextColor="#64748B"
                value={riderPhone}
                onChangeText={setRiderPhone}
              />

              <Text style={styles.formLabel}>Special Mechanic / Fitting Notes</Text>
              <TextInput
                style={[styles.formInput, { height: 54 }]}
                placeholder="e.g. Please dyno test before/after exhaust install..."
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

      {/* ─── 6. PERSISTENT MOBILE BOTTOM NAVIGATION (MOBILE ONLY) ─── */}
      {Platform.OS !== 'web' && (
        <BottomNavBar
          activeTab="Customize"
          onTabChange={(tab) => {
            if (tab === 'Home') onNavigateToStore?.();
            else if (tab === 'Garage') onNavigateToGarage?.();
            else if (tab === 'Orders') onNavigateToOrders?.();
            else if (tab === 'Favorites') onNavigateToWishlist?.();
            else if (tab === 'Dashboard' || tab === 'Profile') {
              if (!currentUser) onNavigateToLogin?.();
              else onNavigateToProfile?.();
            }
          }}
          wishlistCount={wishlistCount}
          currentUser={currentUser}
        />
      )}
    </SafeAreaView>
  );
}
