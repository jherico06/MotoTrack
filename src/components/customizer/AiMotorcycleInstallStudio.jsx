import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { RegisterMotorcycleModal, BookInstallationModal } from '../modals';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';
import {
  requestMotorcycleCustomization,
  getCustomizeUsage,
  getCustomizeApiBaseUrl,
} from '../../services/ai/aiCustomizeApi.js';
import { motorcycleService } from '../../services/products/motorcycleService.js';
import { productService } from '../../services/products/productService.js';
import { compatibilityService } from '../../services/products/compatibilityService.js';
import { customizationService } from '../../services/bookings/customizationService.js';
import {
  aiCustomizerService,
  BIKE_PRESETS,
  AI_INSTALLATION_FEE_USD,
} from '../../services/ai/aiCustomizerService.js';
import { GARAGE_BRANCHES, TIME_SLOTS } from '../../services/bookings/garageService.js';
import { promoService } from '../../services/products/promoService.js';
import { usdToPhp } from '../../utils/currency.js';
import { useCart } from '../../context/CartContext.jsx';
import { useWishlist } from '../../context/WishlistContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import {
  getInstallStudioSession,
  saveInstallStudioSession,
  clearInstallStudioSession,
} from '../../utils/installStudioSession.js';
import {
  GENERATION_STATES,
  UPLOAD_PART_CATEGORIES,
  bikePhotoUri,
  productImageUri,
  normalizeMotorcycle,
  normalizeProduct,
  validateInstallSession,
  evaluateCompatibility,
  buildInstallationPrompt,
  logInstallSessionSelection,
  createInstallResult,
  isInstallablePart,
} from '../../utils/installStudioLogic.js';

const InstallThemeContext = React.createContext({
  styles: {},
  BRAND: '#EA580C',
  MUTED: '#64748B',
  isDark: false,
});

const COMPAT_WARNING =
  'This part may not be compatible with your selected motorcycle. Please verify compatibility before installation.';


function bikeLabel(bike) {
  if (!bike) return 'Motorcycle';
  const title = [bike.year, bike.brand, bike.model].filter(Boolean).join(' ');
  return bike.nickname || bike.motorcycle_name || bike.name || title || 'Motorcycle';
}

function bikePhoto(bike) {
  return bikePhotoUri(bike);
}

function productImage(product) {
  return productImageUri(product);
}

function bikeIdentity(bike) {
  const nickname = String(bike?.nickname || '').trim();
  const spec = [bike?.year, bike?.brand, bike?.model].filter(Boolean).join(' ');
  const shortName = [bike?.brand, bike?.model].filter(Boolean).join(' ');
  return {
    title: nickname || shortName || spec || 'Motorcycle',
    spec: nickname ? spec : '',
    summary: spec || nickname || 'Motorcycle',
    color: String(bike?.color || '').trim(),
    plate: String(bike?.plate_number || '').trim(),
  };
}

function filterUserBikes(all, user) {
  const userId = user?.id || user?.user_id;
  const email = String(user?.email || '').trim().toLowerCase();
  return (Array.isArray(all) ? all : []).filter((b) => {
    if (String(b.motorcycle_id || '').startsWith('moto-seed-')) return false;
    if (!userId && !email) return false;
    const sameUser =
      (userId &&
        (b.user_id === userId ||
          b.customer_id === userId ||
          b.customer_id === user?.customer_id)) ||
      (email && String(b.customer_email || '').toLowerCase() === email);
    return Boolean(sameUser);
  });
}

function formatPartPrice(product) {
  const amount = Number(product?.price);
  if (!Number.isFinite(amount)) return '';
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Redesigned MotoTrack AI Install Studio
 * Preview-first two-column workspace:
 * - Left sidebar (~29%): Compact motorcycle and part selection
 * - Right workspace (~71%): Dominant AI Installation Preview with Before/After toggle, zoom controls, and primary action bar
 */
export default function AiMotorcycleInstallStudio({
  onRequireLogin,
  currentUser,
  onNavigateToGarage,
  onNavigateToWishlist,
  mobileTab: propMobileTab,
  onMobileTabChange,
  hideMobileToolbar = false,
  layout = 'auto',
}) {
  const isWebMode = layout === 'web' || (layout === 'auto' && Platform.OS === 'web' && !propMobileTab);
  const { isDarkMode } = useTheme();
  const styles = isWebMode
    ? (isDarkMode ? darkStylesWeb : lightStylesWeb)
    : (isDarkMode ? darkStylesMobile : lightStylesMobile);
  const BRAND = '#EA580C';
  const MUTED = isDarkMode ? '#94A3B8' : '#64748B';
  const { width } = useWindowDimensions();
  const isWide = isWebMode ? width >= 860 : width >= 1024;
  const shouldHideToolbar = hideMobileToolbar || isWebMode;
  const { addToCart } = useCart();
  const { addCustomizationToWishlist } = useWishlist();

  const currentUserId = currentUser?.id || currentUser?.user_id;
  const currentUserEmail = currentUser?.email ? String(currentUser.email).trim().toLowerCase() : '';
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Selection state - initialized synchronously from local memory cache so bikes never flash or disappear
  const [bikes, setBikes] = useState(() => {
    const all = motorcycleService.getMotorcycles() || [];
    const userBikes = filterUserBikes(all, currentUser);
    if (userBikes.length > 0) return userBikes;
    return BIKE_PRESETS.map((p) => ({
      motorcycle_id: p.id,
      id: p.id,
      brand: p.brand,
      model: p.name,
      motorcycle_name: p.name,
      name: p.name,
      color: p.color,
      photo_url: p.image,
      image: p.image,
      motorcycle_image: p.image,
      is_preset: true,
    }));
  });
  const [selectedBikeId, setSelectedBikeId] = useState(() => {
    const all = motorcycleService.getMotorcycles() || [];
    const userBikes = filterUserBikes(all, currentUser);
    const initialList = userBikes.length > 0 ? userBikes : BIKE_PRESETS;
    const primary = initialList.find((b) => b.is_primary) || initialList[0];
    return primary?.motorcycle_id || primary?.id || '';
  });
  const [bikeOverrideUri, setBikeOverrideUri] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [partMode, setPartMode] = useState('catalog'); // 'catalog' | 'upload'
  const [catalog, setCatalog] = useState([]);
  const [partSearch, setPartSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [partUri, setPartUri] = useState(null);
  const [partName, setPartName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');

  // Custom prompt & Generation state
  const [customRequest, setCustomRequest] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [generationState, setGenerationState] = useState(GENERATION_STATES.IDLE);
  const [loadingBikes, setLoadingBikes] = useState(() => {
    const all = motorcycleService.getMotorcycles() || [];
    const userBikes = filterUserBikes(all, currentUser);
    // Only show loading indicator if user is authenticated and we have zero cached bikes yet
    return userBikes.length === 0 && Boolean(currentUser?.id || currentUser?.email);
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resultUri, setResultUri] = useState(null);
  const [promptUsed, setPromptUsed] = useState('');
  const [, setModelUsed] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [savingImage, setSavingImage] = useState(false);
  const [savingToGarage, setSavingToGarage] = useState(false);
  const [savedToGarage, setSavedToGarage] = useState(false);
  const [savedCustomizationId, setSavedCustomizationId] = useState(null);
  const [saveNotice, setSaveNotice] = useState('');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingBranch, setBookingBranch] = useState(
    () => GARAGE_BRANCHES?.[0]?.name || "D'Blockchain Motorparts and Accessories"
  );
  const [bookingTimeSlot, setBookingTimeSlot] = useState(() => TIME_SLOTS?.[1] || '10:30 AM - 12:00 PM');
  const [bookingPhone, setBookingPhone] = useState(() => currentUser?.phone || '');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [freeInstallPromo, setFreeInstallPromo] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const [openFilter, setOpenFilter] = useState(null);
  const [compatWarning, setCompatWarning] = useState('');
  const [compatOverride, setCompatOverride] = useState(false);
  const [compatBlocked, setCompatBlocked] = useState(false);
  const [compatMap, setCompatMap] = useState(null);

  // New Preview-First interactive state:
  const [previewMode, setPreviewMode] = useState('before'); // 'before' (original motorcycle) | 'after' (AI result)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [internalMobileTab, setInternalMobileTab] = useState('preview'); // Default to AI preview canvas
  const mobileTab = propMobileTab !== undefined ? propMobileTab : internalMobileTab;
  const setMobileTab = useCallback(
    (tab) => {
      setInternalMobileTab(tab);
      onMobileTabChange?.(tab);
    },
    [onMobileTabChange]
  );
  const [viewingPartDetails, setViewingPartDetails] = useState(null);

  // AI Usage & Rate Limiting
  const [aiUsage, setAiUsage] = useState({
    allowed: true,
    isAdmin: false,
    weeklyUsed: 0,
    weeklyLimit: 3,
    consecutiveUsed: 0,
    consecutiveLimit: 2,
    isCooldownActive: false,
    cooldownUntil: null,
    remainingSeconds: 0,
  });
  const [cooldownCountdown, setCooldownCountdown] = useState('');

  const refreshAiUsage = useCallback(async () => {
    const uid = currentUser?.id || currentUser?.user_id;
    if (!uid) return;
    try {
      const res = await getCustomizeUsage({ userId: uid });
      if (res?.success) {
        setAiUsage({
          allowed: res.allowed ?? true,
          isAdmin: Boolean(res.isAdmin),
          weeklyUsed: Number(res.weeklyUsed) || 0,
          weeklyLimit: res.weeklyLimit ?? 3,
          consecutiveUsed: Number(res.consecutiveUsed) || 0,
          consecutiveLimit: res.consecutiveLimit ?? 2,
          isCooldownActive: Boolean(res.isCooldownActive),
          cooldownUntil: res.cooldownUntil || null,
          remainingSeconds: Math.max(0, Number(res.remainingSeconds) || 0),
        });
      }
    } catch (_e) {
      // ignore
    }
  }, [currentUserId]);

  useEffect(() => {
    refreshAiUsage();
  }, [refreshAiUsage]);

  useEffect(() => {
    if (!aiUsage.cooldownUntil) {
      setCooldownCountdown('');
      return undefined;
    }

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(aiUsage.cooldownUntil).getTime();
      const diffSec = Math.max(0, Math.ceil((end - now) / 1000));

      if (diffSec <= 0) {
        setCooldownCountdown('');
        setAiUsage((prev) => ({
          ...prev,
          isCooldownActive: false,
          cooldownUntil: null,
          remainingSeconds: 0,
          consecutiveUsed: 0,
          allowed: prev.weeklyUsed < (prev.weeklyLimit || 3),
        }));
        refreshAiUsage();
        return;
      }

      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      setCooldownCountdown(`${m}m ${String(s).padStart(2, '0')}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [aiUsage.cooldownUntil, refreshAiUsage]);

  const sessionInitializedRef = useRef(false);
  const [savedBuildsModalOpen, setSavedBuildsModalOpen] = useState(false);
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [loadingSavedBuilds, setLoadingSavedBuilds] = useState(false);

  // Session persistence across navigation
  useEffect(() => {
    if (sessionInitializedRef.current) return;
    const session = getInstallStudioSession(currentUserId);
    if (session) {
      sessionInitializedRef.current = true;
      if (session.selectedBikeId) setSelectedBikeId(session.selectedBikeId);
      if (session.bikeOverrideUri) setBikeOverrideUri(session.bikeOverrideUri);
      if (session.partMode) setPartMode(session.partMode);
      if (session.selectedProductId) setSelectedProductId(session.selectedProductId);
      if (session.selectedProduct) setSelectedProduct(session.selectedProduct);
      if (session.partUri) setPartUri(session.partUri);
      if (session.partName) setPartName(session.partName);
      if (session.uploadCategory) setUploadCategory(session.uploadCategory);
      if (session.customRequest) setCustomRequest(session.customRequest);
      if (session.resultUri) {
        setResultUri(session.resultUri);
        setGenerationState(GENERATION_STATES.COMPLETED);
      }
      if (session.lastResult) setLastResult(session.lastResult);
      if (session.promptUsed) setPromptUsed(session.promptUsed);
      if (session.savedToGarage) setSavedToGarage(Boolean(session.savedToGarage));
    } else {
      sessionInitializedRef.current = true;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!sessionInitializedRef.current) return;
    saveInstallStudioSession(currentUserId, {
      selectedBikeId,
      bikeOverrideUri,
      partMode,
      selectedProductId,
      selectedProduct,
      partUri,
      partName,
      uploadCategory,
      customRequest,
      resultUri,
      lastResult,
      promptUsed,
      savedToGarage,
    });
  }, [
    currentUserId,
    selectedBikeId,
    bikeOverrideUri,
    partMode,
    selectedProductId,
    selectedProduct,
    partUri,
    partName,
    uploadCategory,
    customRequest,
    resultUri,
    lastResult,
    promptUsed,
    savedToGarage,
  ]);

  const refreshSavedBuilds = useCallback(async ({ force = false } = {}) => {
    if (!currentUser) {
      setSavedBuilds([]);
      return;
    }
    const uid = currentUser?.id || currentUser?.user_id;
    const cid = currentUser?.customer_id || currentUser?.id;
    try {
      setLoadingSavedBuilds(true);
      const list = await customizationService.listCustomizations({
        userId: uid,
        customerId: cid,
        force,
      });
      const withImages = (Array.isArray(list) ? list : []).filter(
        (c) => Boolean(c.previewImageUrl || c.preview_image_url)
      );
      setSavedBuilds(withImages);
    } catch (err) {
      console.warn('[InstallStudio] fetch saved builds error:', err);
    } finally {
      setLoadingSavedBuilds(false);
    }
  }, [currentUserId, currentUser?.customer_id]);

  useEffect(() => {
    refreshSavedBuilds();
    // Debounce subscriber refresh — never chain list→notify→list in a tight loop
    let timer = null;
    const unsub = customizationService.subscribe?.(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshSavedBuilds();
      }, 800);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub?.();
    };
  }, [refreshSavedBuilds]);

  const handleStartNewPreview = () => {
    clearInstallStudioSession(currentUserId);
    setResultUri(null);
    setLastResult(null);
    setPromptUsed('');
    setSavedToGarage(false);
    setSaveNotice('');
    setPreviewFailed(false);
    setError('');
    setZoomLevel(1);
    setPreviewMode('before');
    setGenerationState(GENERATION_STATES.IDLE);
  };

  const handleLoadSavedBuild = (build) => {
    if (!build) return;
    const img = build.previewImageUrl || build.preview_image_url;
    if (img) setResultUri(img);
    if (build.motorcycleId) setSelectedBikeId(build.motorcycleId);
    if (build.previewPrompt) setPromptUsed(build.previewPrompt);
    const bikeTitle =
      build.name ||
      build.motorcycleName ||
      [build.motorcycleBrand, build.motorcycleModel].filter(Boolean).join(' ') ||
      'Motorcycle';
    const firstItem = build.items?.[0];
    const partTitle = firstItem?.product_name || firstItem?.name || 'Custom Part';
    setLastResult({
      motorcycle_name: bikeTitle,
      product_name: partTitle,
      generated_image_url: img,
      generated_prompt: build.previewPrompt || '',
    });
    setSavedToGarage(true);
    setPreviewMode('after');
    setGenerationState(GENERATION_STATES.COMPLETED);
    setSavedBuildsModalOpen(false);
    setSaveNotice(`✓ Loaded saved preview for ${bikeTitle}!`);
    setTimeout(() => setSaveNotice(''), 4500);
  };

  const handleDeleteSavedBuild = async (buildId) => {
    if (!buildId) return;
    try {
      await customizationService.deleteCustomization(buildId);
      refreshSavedBuilds();
      setSaveNotice('✓ Saved preview deleted.');
      setTimeout(() => setSaveNotice(''), 3000);
    } catch (err) {
      console.warn('[InstallStudio] delete saved build error:', err);
    }
  };

  const loading =
    generationState === GENERATION_STATES.VALIDATING ||
    generationState === GENERATION_STATES.PREPARING ||
    generationState === GENERATION_STATES.GENERATING;

  const refreshBikes = useCallback(async () => {
    try {
      if (currentUserId || currentUserEmail) {
        await motorcycleService.syncFromSupabase(currentUserId, currentUserEmail);
      }
      const all = motorcycleService.getMotorcycles() || [];
      const userBikes = filterUserBikes(all, currentUserRef.current);
      const effectiveBikes = userBikes.length > 0 ? userBikes : BIKE_PRESETS.map((p) => ({
        motorcycle_id: p.id,
        id: p.id,
        brand: p.brand,
        model: p.name,
        motorcycle_name: p.name,
        name: p.name,
        color: p.color,
        photo_url: p.image,
        image: p.image,
        motorcycle_image: p.image,
        is_preset: true,
      }));
      setBikes(effectiveBikes);
      setSelectedBikeId((prev) => {
        if (prev && effectiveBikes.some((b) => b.motorcycle_id === prev)) return prev;
        const primary = effectiveBikes.find((b) => b.is_primary) || effectiveBikes[0];
        return primary?.motorcycle_id || primary?.id || '';
      });
    } catch (_err) {
      console.warn('[InstallStudio] refreshBikes error:', _err);
    } finally {
      setLoadingBikes(false);
    }
  }, [currentUserId, currentUserEmail]);

  useEffect(() => {
    let isMounted = true;

    // 1. Subscribe to local updates in motorcycleService (never call syncFromSupabase inside subscribe!)
    const unsub = motorcycleService.subscribe((all) => {
      if (!isMounted) return;
      const userBikes = filterUserBikes(
        all || motorcycleService.getMotorcycles() || [],
        currentUserRef.current
      );
      const effectiveBikes = userBikes.length > 0 ? userBikes : BIKE_PRESETS.map((p) => ({
        motorcycle_id: p.id,
        id: p.id,
        brand: p.brand,
        model: p.name,
        motorcycle_name: p.name,
        name: p.name,
        color: p.color,
        photo_url: p.image,
        image: p.image,
        motorcycle_image: p.image,
        is_preset: true,
      }));
      setBikes(effectiveBikes);
      setSelectedBikeId((prev) => {
        if (prev && effectiveBikes.some((b) => b.motorcycle_id === prev)) return prev;
        const primary = effectiveBikes.find((b) => b.is_primary) || effectiveBikes[0];
        return primary?.motorcycle_id || primary?.id || '';
      });
      setLoadingBikes(false);
    });

    // 2. Perform background sync from Supabase silently without clearing displayed bikes
    if (currentUserId || currentUserEmail) {
      motorcycleService
        .syncFromSupabase(currentUserId, currentUserEmail)
        .catch((err) => console.warn('[InstallStudio] background sync warning:', err))
        .finally(() => {
          if (isMounted) setLoadingBikes(false);
        });
    } else {
      setLoadingBikes(false);
    }

    return () => {
      isMounted = false;
      unsub?.();
    };
  }, [currentUserId, currentUserEmail]);

  useEffect(() => {
    if (!loading) {
      setGenPhase(0);
      return undefined;
    }
    setGenPhase(0);
    const toGenerating = setTimeout(() => setGenPhase(1), 700);
    const toFinalizing = setTimeout(() => setGenPhase(2), 1600);
    return () => {
      clearTimeout(toGenerating);
      clearTimeout(toFinalizing);
    };
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    productService.getProducts().then((rows) => {
      if (cancelled) return;
      const list = Array.isArray(rows)
        ? rows.filter((p) => productImage(p) && isInstallablePart(p))
        : [];
      setCatalog(list);
      if (list.length > 0) {
        setSelectedProductId((prev) => {
          if (!prev) {
            const def =
              list.find((p) => /rim|wheel/i.test(p.name || p.category)) ||
              list.find((p) => /exhaust|pipe/i.test(p.name || p.category)) ||
              list[0];
            if (def) {
              const defId = String(def.product_id || def.id || '');
              setSelectedProduct(normalizeProduct(def));
              setPartName(def.name || '');
              return defId;
            }
          }
          return prev;
        });
      }
    });
    compatibilityService.getCompatibilityMap().then((map) => {
      if (!cancelled) setCompatMap(map instanceof Map ? map : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBike = useMemo(() => {
    let raw = bikes.find((b) => b.motorcycle_id === selectedBikeId) || null;
    if (!raw && bikes.length > 0) {
      raw = bikes[0];
    }
    return normalizeMotorcycle(raw, bikeOverrideUri);
  }, [bikes, selectedBikeId, bikeOverrideUri]);

  const sessionProduct = useMemo(() => {
    if (partMode === 'upload') {
      if (!partUri) return null;
      return normalizeProduct(null, {
        uploadedImage: partUri,
        name: partName,
        category: uploadCategory,
      });
    }
    if (selectedProduct) return selectedProduct;
    const selectedKey = String(selectedProductId || '');
    if (!selectedKey) return null;
    const fromCatalog =
      catalog.find((product) => String(product.product_id || product.id || '') === selectedKey) ||
      null;
    if (!fromCatalog) return null;
    const rows = compatMap?.get(selectedKey) || [];
    return normalizeProduct(fromCatalog, { compatible_motorcycles: rows });
  }, [
    partMode,
    partUri,
    partName,
    uploadCategory,
    selectedProduct,
    selectedProductId,
    catalog,
    compatMap,
  ]);

  const bikeUri = selectedBike?.motorcycle_image || selectedBike?.image || null;
  const resolvedPartUri = sessionProduct?.product_image || sessionProduct?.image || null;

  const applyCompatibilityCheck = useCallback((motorcycle, product) => {
    const result = evaluateCompatibility(motorcycle, product);
    if (result.status === 'incompatible') {
      setCompatWarning(result.warning || COMPAT_WARNING);
      setCompatOverride(false);
      setCompatBlocked(false);
    } else {
      setCompatWarning('');
      setCompatOverride(false);
      setCompatBlocked(false);
    }
    return result;
  }, []);

  const categories = useMemo(() => {
    const names = new Set();
    catalog.forEach((product) => {
      if (product?.category) names.add(String(product.category));
    });
    return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [catalog]);

  const brands = useMemo(() => {
    const names = new Set();
    catalog.forEach((product) => {
      if (product?.brand) names.add(String(product.brand));
    });
    return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [catalog]);

  const filteredParts = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    const seen = new Set();
    return catalog
      .filter((product) => {
        if (!isInstallablePart(product)) return false;
        const key = String(product.product_id || product.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        if (categoryFilter !== 'All' && String(product.category || '') !== categoryFilter) return false;
        if (brandFilter !== 'All' && String(product.brand || '') !== brandFilter) return false;
        if (!q) return true;
        const hay = `${product.name || ''} ${product.brand || ''} ${product.category || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 32);
  }, [catalog, partSearch, categoryFilter, brandFilter]);

  const selectBike = (bike) => {
    setGenerationState(GENERATION_STATES.SELECTING);
    setSelectedBikeId(bike.motorcycle_id);
    setBikeOverrideUri(null);
    setResultUri(null);
    setLastResult(null);
    setSavedToGarage(false);
    setSaveNotice('');
    setPreviewFailed(false);
    setError('');
    setPreviewMode('before');
    const nextBike = normalizeMotorcycle(bike, null);
    if (sessionProduct) {
      applyCompatibilityCheck(nextBike, sessionProduct);
    } else {
      setCompatWarning('');
      setCompatOverride(false);
      setCompatBlocked(false);
    }
    setGenerationState(GENERATION_STATES.IDLE);
  };

  const pickBikeOverride = async () => {
    setError('');
    const res = await pickImageFromFile();
    if (res?.success && res.uri) {
      setBikeOverrideUri(res.uri);
      setResultUri(null);
      setLastResult(null);
      setSavedToGarage(false);
      setSaveNotice('');
      setPreviewFailed(false);
    } else if (res?.error && !/cancel/i.test(res.error)) {
      setError(res.error);
    }
  };

  const pickPart = async () => {
    setError('');
    const res = await pickImageFromFile();
    if (res?.success && res.uri) {
      setGenerationState(GENERATION_STATES.SELECTING);
      setPartMode('upload');
      setSelectedProductId('');
      setSelectedProduct(null);
      setPartUri(res.uri);
      setPartName('');
      setUploadCategory('');
      setResultUri(null);
      setLastResult(null);
      setSavedToGarage(false);
      setSaveNotice('');
      setPreviewFailed(false);
      setPreviewMode('before');
      setCompatWarning('');
      setCompatOverride(false);
      setCompatBlocked(false);
      setGenerationState(GENERATION_STATES.IDLE);
      if (!isWide) {
        setMobileTab('preview');
      }
    } else if (res?.error && !/cancel/i.test(res.error)) {
      setError(res.error);
    }
  };

  const selectCatalogPart = async (product) => {
    const nextId = String(product.product_id || product.id || '');
    if (!nextId) return;

    setGenerationState(GENERATION_STATES.SELECTING);
    setPartMode('catalog');
    setPartUri(null);
    setUploadCategory('');
    setResultUri(null);
    setLastResult(null);
    setSavedToGarage(false);
    setSaveNotice('');
    setPreviewFailed(false);
    setError('');
    setPreviewMode('before');

    // Toggle off keeps motorcycle selection intact.
    if (String(selectedProductId || '') === nextId) {
      setSelectedProductId('');
      setSelectedProduct(null);
      setPartName('');
      setCompatWarning('');
      setCompatOverride(false);
      setCompatBlocked(false);
      setGenerationState(GENERATION_STATES.IDLE);
      return;
    }

    let rows = compatMap?.get(nextId) || [];
    if (!rows.length) {
      try {
        rows = await compatibilityService.getCompatibilityForProduct(nextId);
      } catch (_e) {
        rows = [];
      }
    }

    const nextProduct = normalizeProduct(product, { compatible_motorcycles: rows });
    setSelectedProductId(nextId);
    setSelectedProduct(nextProduct);
    setPartName(nextProduct.name || '');
    applyCompatibilityCheck(selectedBike, nextProduct);
    setGenerationState(GENERATION_STATES.IDLE);
    if (!isWide) {
      setMobileTab('preview');
    }
  };

  const handleGenerate = async ({ forceCompatOverride = false } = {}) => {
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }

    if (!aiUsage.isAdmin && aiUsage.weeklyUsed >= (aiUsage.weeklyLimit || 3)) {
      setError("You've reached your weekly AI preview limit. You can generate another preview next week.");
      return;
    }
    if (!aiUsage.isAdmin && aiUsage.isCooldownActive) {
      setError(`Please wait before generating another preview. Available again in ${cooldownCountdown || '30m'}.`);
      return;
    }

    setGenerationState(GENERATION_STATES.VALIDATING);
    setError('');
    setPreviewFailed(false);

    const motorcycle = selectedBike;
    const product = sessionProduct;

    const validation = validateInstallSession({
      motorcycle,
      product,
      partMode,
      uploadCategory,
    });
    if (!validation.ok) {
      setGenerationState(GENERATION_STATES.IDLE);
      setError(validation.message);
      return;
    }

    const compat = evaluateCompatibility(motorcycle, product);
    if (compat.status === 'incompatible') {
      setCompatWarning(compat.warning || COMPAT_WARNING);
      if (!forceCompatOverride && !compatOverride) {
        setCompatBlocked(true);
        setGenerationState(GENERATION_STATES.IDLE);
        setError(compat.warning || COMPAT_WARNING);
        return;
      }
      setCompatBlocked(false);
    } else {
      setCompatBlocked(false);
      if (compat.status !== 'unavailable') {
        setCompatWarning('');
      }
    }

    const accessoryName = product.product_name || product.name || 'accessory';
    const bikeName = bikeLabel(motorcycle);
    const installationPrompt = buildInstallationPrompt({
      motorcycle,
      product,
      customNotes: customRequest,
      compatibilityNote:
        compat.status === 'unavailable'
          ? compat.instructAi ||
            'Compatibility information is unavailable. Prioritize a mechanically realistic installation for this motorcycle and part.'
          : compat.status === 'incompatible'
            ? 'Compatibility warning acknowledged by customer. Still prioritize a mechanically realistic installation if possible.'
            : '',
    });

    logInstallSessionSelection({ motorcycle, product });

    setGenerationState(GENERATION_STATES.PREPARING);
    setInfo(`Installing ${accessoryName} on ${bikeName}…`);
    setResultUri(null);
    setSavedToGarage(false);
    setSaveNotice('');

    const currentUid = currentUser?.id || currentUser?.user_id || 'usr-customer-01';

    setGenerationState(GENERATION_STATES.GENERATING);
    const result = await requestMotorcycleCustomization({
      userId: currentUid,
      bikeUri: motorcycle.motorcycle_image || motorcycle.image,
      partUri: product.product_image || product.image,
      installationPrompt,
      customRequest: installationPrompt,
      selectionMeta: {
        userId: currentUid,
        motorcycleId: motorcycle.motorcycle_id || motorcycle.id,
        motorcycleName: motorcycle.motorcycle_name || motorcycle.name,
        motorcycleImage: motorcycle.motorcycle_image || motorcycle.image,
        productId: product.product_id || product.id,
        productName: product.product_name || product.name,
        productImage: product.product_image || product.image,
      },
    });

    if (!result.success) {
      setGenerationState(GENERATION_STATES.FAILED);
      setPreviewFailed(true);
      setError(result.error || 'Generation failed.');
      setInfo('');

      if (result.code === 'RATE_LIMIT' || result.reason) {
        setAiUsage((prev) => ({
          ...prev,
          allowed: false,
          weeklyUsed: result.weeklyUsed ?? prev.weeklyUsed,
          weeklyLimit: result.weeklyLimit ?? prev.weeklyLimit,
          consecutiveUsed: result.consecutiveUsed ?? prev.consecutiveUsed,
          consecutiveLimit: result.consecutiveLimit ?? prev.consecutiveLimit,
          isCooldownActive: Boolean(result.reason === 'CONSECUTIVE_LIMIT' || result.cooldownUntil),
          cooldownUntil: result.cooldownUntil || prev.cooldownUntil,
          remainingSeconds: Math.max(0, Number(result.remainingSeconds) || 0),
        }));
      }
      return;
    }

    if (result.usage) {
      setAiUsage({
        allowed: result.usage.allowed ?? true,
        isAdmin: Boolean(result.usage.isAdmin),
        weeklyUsed: Number(result.usage.weeklyUsed) || 0,
        weeklyLimit: result.usage.weeklyLimit ?? 3,
        consecutiveUsed: Number(result.usage.consecutiveUsed) || 0,
        consecutiveLimit: result.usage.consecutiveLimit ?? 2,
        isCooldownActive: Boolean(result.usage.isCooldownActive),
        cooldownUntil: result.usage.cooldownUntil || null,
        remainingSeconds: Math.max(0, Number(result.usage.remainingSeconds) || 0),
      });
    } else {
      refreshAiUsage();
    }

    const persisted = createInstallResult({
      motorcycle,
      product,
      generatedImageUrl: result.previewImageUrl,
      generatedPrompt: result.promptUsed || installationPrompt,
      cameraView: product.camera_view,
    });

    setLastResult(persisted);
    setPreviewFailed(false);
    setResultUri(result.previewImageUrl);
    setPromptUsed(result.promptUsed || installationPrompt);
    setModelUsed(result.model || '');
    setPreviewMode('after');
    setGenerationState(GENERATION_STATES.COMPLETED);
    setInfo(
      result.note
        ? `Done — ${accessoryName} installed on ${bikeName}.`
        : `Done — ${accessoryName} installed on ${bikeName}.`
    );
  };

  const handleSaveRegisteredBike = async (bikeData) => {
    const res = await motorcycleService.addMotorcycle({
      ...bikeData,
      user_id: currentUser?.id || currentUser?.user_id,
      customer_id: currentUser?.customer_id || currentUser?.id,
      customer_email: currentUser?.email || '',
    });
    if (!res?.success) {
      throw new Error(res?.error || 'Could not register motorcycle.');
    }
    await refreshBikes();
    if (res.motorcycle?.motorcycle_id) {
      setSelectedBikeId(res.motorcycle.motorcycle_id);
      setBikeOverrideUri(null);
    }
    setInfo('Motorcycle registered. Choose a part to install on it.');
  };

  const identity = selectedBike ? bikeIdentity(selectedBike.raw || selectedBike) : null;
  const partDisplayName = sessionProduct?.product_name || sessionProduct?.name || '';
  const partBrand =
    partMode === 'catalog'
      ? sessionProduct?.brand || sessionProduct?.category || 'Universal'
      : uploadCategory || 'Custom Part';
  const partPrice =
    partMode === 'catalog' ? formatPartPrice(sessionProduct?.raw || sessionProduct) : '';
  const readyToGenerate = Boolean(
    selectedBike &&
      bikeUri &&
      resolvedPartUri &&
      (partMode !== 'upload' || Boolean(uploadCategory))
  );

  const isWeeklyLimitReached = !aiUsage.isAdmin && aiUsage.weeklyUsed >= (aiUsage.weeklyLimit || 3);
  const isConsecutiveCooldown = !aiUsage.isAdmin && aiUsage.isCooldownActive;
  const isGenerationBlocked = isWeeklyLimitReached || isConsecutiveCooldown;

  const canAddToCart = partMode === 'catalog' && Boolean(sessionProduct?.raw || selectedProduct?.raw);
  const friendlyError = (() => {
    const raw = String(error || '');
    if (!raw) return '';
    if (/weekly.*limit|cooldown|preview limit|wait before generating|consecutive/i.test(raw)) {
      return raw;
    }
    if (/quota|resource_exhausted|429|billing|credit balance|plan and billing/i.test(raw)) {
      return 'AI image quota is currently exhausted. Please add credits or try again shortly.';
    }
    if (/invalid_api_key|invalid authentication|unauthenticated|GEMINI_API_KEY/i.test(raw)) {
      return 'AI key is invalid. Please verify GEMINI_API_KEY in server configuration.';
    }
    if (/network request failed|ECONNREFUSED|failed to fetch/i.test(raw)) {
      return `Cannot reach the AI server (${getCustomizeApiBaseUrl()}). Please make sure the backend server is running.`;
    }
    if (
      /unable to (load|use|read).*(photo|image)|invalid image|unsupported image|upload failed/i.test(raw) ||
      (/127\.0\.0\.1|localhost/i.test(raw) && /photo|upload/i.test(raw))
    ) {
      return 'Unable to use that photo. Please try another image.';
    }
    if (raw.length > 220 || raw.trim().startsWith('{')) {
      return 'Unable to generate the installation preview. Check the AI server terminal for details.';
    }
    return raw;
  })();

  const openRegister = () => {
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    setRegisterOpen(true);
  };

  const handleAddToCart = () => {
    if (!canAddToCart || loading) return;
    const cartProduct = sessionProduct?.raw || selectedProduct?.raw;
    if (!cartProduct) return;
    addToCart(cartProduct, 1);
    setSaveNotice('✓ Part added to cart!');
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const handleSaveImage = async (customUri = null) => {
    const uriToSave = customUri || resultUri;
    if (!uriToSave) return;
    setSavingImage(true);
    setSaveNotice('');
    try {
      const bikeName =
        lastResult?.motorcycle_name ||
        selectedBike?.nickname ||
        selectedBike?.name ||
        [selectedBike?.brand, selectedBike?.model].filter(Boolean).join(' ') ||
        'motorcycle';
      const pName =
        lastResult?.product_name ||
        sessionProduct?.name ||
        sessionProduct?.product_name ||
        'custom_part';
      const safeBike = bikeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const safePart = pName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const fileName = `mototrack_${safeBike}_${safePart}_${Date.now()}.png`;

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          let downloadHref = uriToSave;
          let revokeNeeded = false;

          if (/^https?:\/\//i.test(uriToSave)) {
            try {
              const res = await fetch(uriToSave);
              const blob = await res.blob();
              downloadHref = URL.createObjectURL(blob);
              revokeNeeded = true;
            } catch (_blobErr) {
              downloadHref = uriToSave;
            }
          }

          const link = document.createElement('a');
          link.href = downloadHref;
          link.download = fileName;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          if (revokeNeeded) {
            setTimeout(() => URL.revokeObjectURL(downloadHref), 1000);
          }
          setSaveNotice('✓ Installation preview image downloaded!');
          setTimeout(() => setSaveNotice(''), 4500);
          return;
        }
      }

      // React Native Mobile handling
      try {
        const FileSystem = await import('expo-file-system');
        const Sharing = await import('expo-sharing');
        let fileUriToShare = resultUri;

        if (resultUri.startsWith('data:')) {
          const parts = resultUri.split(',');
          const base64Data = parts[1] || parts[0];
          const localPath = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(localPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          fileUriToShare = localPath;
        }

        if (Sharing && typeof Sharing.isAvailableAsync === 'function' && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(fileUriToShare, {
            mimeType: 'image/png',
            dialogTitle: 'Save Installation Preview',
            UTI: 'public.png',
          });
          setSaveNotice('✓ Installation image saved / ready to share!');
        } else {
          setSaveNotice('✓ Installation image saved to device storage!');
        }
        setTimeout(() => setSaveNotice(''), 4500);
      } catch (nativeErr) {
        console.warn('[InstallStudio] Mobile save fallback:', nativeErr);
        setSaveNotice('✓ Image ready. Long-press to save.');
        setTimeout(() => setSaveNotice(''), 4500);
      }
    } catch (err) {
      console.error('[InstallStudio] Save image error:', err);
      setSaveNotice('Failed to save image. Please try again.');
      setTimeout(() => setSaveNotice(''), 4500);
    } finally {
      setSavingImage(false);
    }
  };

  const buildPreviewSnapshot = () => {
    const bike = selectedBike?.raw || selectedBike;
    const prod = sessionProduct?.raw || sessionProduct;
    const bikeTitle =
      lastResult?.motorcycle_name ||
      selectedBike?.nickname ||
      selectedBike?.name ||
      [selectedBike?.brand, selectedBike?.model].filter(Boolean).join(' ') ||
      'My Motorcycle';
    const pTitle =
      lastResult?.product_name ||
      sessionProduct?.name ||
      sessionProduct?.product_name ||
      partName ||
      'Custom Part';
    const setupName = `${bikeTitle} with ${pTitle}`;
    const items = prod
      ? [
          {
            productId: prod.product_id || prod.id,
            quantity: 1,
            price: Number(prod.price) || 0,
            name: prod.name || prod.product_name || pTitle,
            brand: prod.brand || '',
            category: prod.category || '',
          },
        ]
      : partMode === 'upload'
        ? [
            {
              productId: null,
              quantity: 1,
              price: 0,
              name: pTitle,
              brand: '',
              category: uploadCategory || 'Custom',
            },
          ]
        : [];
    return { bike, prod, bikeTitle, pTitle, setupName, items };
  };

  // Detect Free Installation promo for the selected catalog part
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const prod = sessionProduct?.raw || sessionProduct;
      const pid = prod?.product_id || prod?.id;
      if (!pid) {
        setFreeInstallPromo(null);
        return;
      }
      try {
        const match = await promoService.findApplicableFreeInstallation([String(pid)]);
        if (!cancelled) setFreeInstallPromo(match);
      } catch {
        if (!cancelled) setFreeInstallPromo(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [sessionProduct]);

  const persistPreviewForWishlist = async () => {
    const { bike, setupName, items } = buildPreviewSnapshot();
    const res = await customizationService.createCustomization({
      customerId: currentUser?.customer_id || currentUser?.id,
      userId: currentUser?.id || currentUser?.user_id,
      motorcycle: bike,
      name: setupName,
      items,
      status: 'saved',
      notes: customRequest || '',
      previewImageUrl: resultUri,
      previewPrompt: promptUsed || lastResult?.prompt_used || '',
      skipCompatibilityCheck: compatOverride || compatBlocked,
      allowEmptyItems: true,
    });
    const customization = res?.customization || null;
    const customizationId =
      customization?.customization_id || customization?.id || savedCustomizationId || null;
    // Prefer uploaded storage URL — never stash multi‑MB data: URIs in wishlist storage
    const uploadedPreview =
      customization?.previewImageUrl || customization?.preview_image_url || '';
    const safePreview =
      uploadedPreview && !String(uploadedPreview).startsWith('data:')
        ? uploadedPreview
        : resultUri && !String(resultUri).startsWith('data:')
          ? resultUri
          : '';

    const wishRes = addCustomizationToWishlist({
      customizationId,
      name: setupName,
      title: setupName,
      previewImageUrl: safePreview,
      motorcycle: bike,
      items: customization?.items || items,
      productIds: items.map((it) => it.productId).filter(Boolean),
      notes: customRequest || '',
      promptUsed: promptUsed || lastResult?.prompt_used || '',
    });
    if (customizationId) setSavedCustomizationId(customizationId);
    if ((res?.success || customizationId) && wishRes?.success) {
      setSavedToGarage(true);
    }
    return { res, wishRes, customization, customizationId, setupName, bike, items };
  };

  const handleSaveToGarage = async () => {
    if (!resultUri) return;
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    setSavingToGarage(true);
    setSaveNotice('');
    try {
      const { res, wishRes, customizationId } = await persistPreviewForWishlist();
      if (wishRes?.success && customizationId) {
        setSaveNotice('✓ Preview saved — open Wishlist to see it!');
        refreshSavedBuilds({ force: true });
        setTimeout(() => setSaveNotice(''), 5000);
      } else if (wishRes?.success && !customizationId) {
        setSaveNotice(
          wishRes?.error ||
            'Saved locally, but cloud upload is still pending. Try Save again in a moment.'
        );
        setTimeout(() => setSaveNotice(''), 5000);
      } else {
        setSaveNotice(
          wishRes?.error || res?.error || 'Could not save preview to Wishlist.'
        );
        setTimeout(() => setSaveNotice(''), 4500);
      }
    } catch (err) {
      console.error('[InstallStudio] Save preview error:', err);
      setSaveNotice('Failed to save preview.');
      setTimeout(() => setSaveNotice(''), 4000);
    } finally {
      setSavingToGarage(false);
    }
  };

  const handleOpenBookingModal = () => {
    if (!resultUri) return;
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    setBookingPhone(currentUser?.phone || bookingPhone || '');
    setBookingModalOpen(true);
  };

  const handleConfirmInstallBooking = async () => {
    if (!bookingPhone?.trim()) {
      setSaveNotice('Please enter your contact phone number.');
      setTimeout(() => setSaveNotice(''), 3500);
      return;
    }
    setBookingBusy(true);
    try {
      let customizationId = savedCustomizationId;
      let bike;
      let bikeTitle;
      let items;
      let prod;

      if (!customizationId && resultUri) {
        const persisted = await persistPreviewForWishlist();
        customizationId = persisted.customizationId;
        bike = persisted.bike;
        bikeTitle = persisted.setupName?.split(' with ')[0] || buildPreviewSnapshot().bikeTitle;
        items = persisted.items;
        prod = buildPreviewSnapshot().prod;
        refreshSavedBuilds();
      } else {
        ({ bike, bikeTitle, items, prod } = buildPreviewSnapshot());
      }

      const selectedParts = (items || [])
        .filter((it) => it.productId)
        .map((it) => ({
          id: it.productId,
          product_id: it.productId,
          name: it.name,
          price: Number(it.price) || 0,
          brand: it.brand,
        }));

      if (!selectedParts.length && prod) {
        selectedParts.push({
          id: prod.product_id || prod.id,
          product_id: prod.product_id || prod.id,
          name: prod.name || prod.product_name,
          price: Number(prod.price) || 0,
          brand: prod.brand || '',
        });
      }

      const booking = await aiCustomizerService.bookCustomizationService({
        customizationData: {
          customizationId,
          bikeName: bikeTitle,
          bikeBrand: bike?.brand || selectedBike?.brand || 'Motorcycle',
          bikeModel: bike?.model || selectedBike?.model || '',
          motorcycleId: bike?.motorcycle_id || bike?.motorcycleId || selectedBikeId,
          selectedParts,
          partsTotalUsd: selectedParts.reduce((s, p) => s + Number(p.price || 0), 0),
          generatedImage: resultUri,
        },
        branchName: bookingBranch,
        appointmentDate: 'Tomorrow',
        timeSlot: bookingTimeSlot,
        customerName: currentUser?.name || currentUser?.full_name || 'Rider',
        customerPhone: bookingPhone.trim(),
        plateNumber: bike?.plate_number || selectedBike?.plate_number || 'Pending Plate',
        notes: bookingNotes,
        currentUser,
      });

      setBookingModalOpen(false);
      const feeMsg = booking?.installationFeeWaived
        ? ' Installation fee waived (promo)!'
        : '';
      setSaveNotice(`✓ Installation booked! Ticket #${booking?.id || booking?.booking_id}.${feeMsg}`);
      setTimeout(() => setSaveNotice(''), 6000);
      onNavigateToGarage?.();
    } catch (err) {
      console.error('[InstallStudio] Book install error:', err);
      setSaveNotice(err?.message || 'Could not book installation. Please try again.');
      setTimeout(() => setSaveNotice(''), 4500);
    } finally {
      setBookingBusy(false);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100));
  const handleFitScreen = () => setZoomLevel(1);

  // Compare Original action
  const handleToggleCompare = () => {
    if (!resultUri) return;
    setPreviewMode((prev) => (prev === 'before' ? 'after' : 'before'));
  };

  // Active display image in canvas:
  // - "before" exclusively displays the original motorcycle photo.
  // - "after" exclusively displays the AI generated installation result (never falls back to before).
  const canvasDisplayUri = useMemo(() => {
    if (previewMode === 'before') {
      return bikeUri || null;
    }
    // previewMode === 'after'
    return resultUri || null;
  }, [previewMode, resultUri, bikeUri]);

  // ─────────────────────────────────────────────────────────────────────────
  // LEFT SIDEBAR: Selection Panel
  // ─────────────────────────────────────────────────────────────────────────
  const selectionSidebar = (
    <View style={styles.sidebarContainer}>
      {/* 1. Selection Toolbar (Directly below header) */}
      {!shouldHideToolbar && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity
            style={[styles.toolbarBtn, mobileTab === 'selection' && styles.toolbarBtnActive]}
            onPress={() => setMobileTab('selection')}
            activeOpacity={0.85}
            accessibilityLabel="Motorcycle and Part Selector"
          >
            <BootstrapIcon
              name="sliders"
              size={14}
              color={mobileTab === 'selection' ? '#FFFFFF' : '#172033'}
            />
            <Text
              style={[styles.toolbarBtnText, mobileTab === 'selection' && styles.toolbarBtnTextActive]}
              numberOfLines={1}
            >
              Motorcycle & Part Selector
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolbarBtn, styles.toolbarBtnCanvas, mobileTab === 'preview' && styles.toolbarBtnCanvasActive]}
            onPress={() => setMobileTab('preview')}
            activeOpacity={0.85}
            accessibilityLabel="AI Preview Canvas"
          >
            <BootstrapIcon name="eye-fill" size={14} color="#FFFFFF" />
            <Text style={[styles.toolbarBtnText, styles.toolbarBtnCanvasText]} numberOfLines={1}>
              AI Preview Canvas
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SECTION 1: Select your motorcycle */}
      <View style={styles.sidebarCard}>
        <View style={styles.sidebarCardHeader}>
          <Text style={styles.sidebarTitle}>1. Select your motorcycle</Text>
          <TouchableOpacity
            style={styles.registerLink}
            onPress={openRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <BootstrapIcon name="plus-circle" size={13} color={BRAND} />
            <Text style={styles.registerLinkText}>Register Motorcycle</Text>
          </TouchableOpacity>
        </View>

        {loadingBikes ? (
          <ActivityIndicator color={BRAND} style={{ marginVertical: 18 }} />
        ) : bikes.length === 0 ? (
          <View style={styles.emptySidebar}>
            <BootstrapIcon name="bicycle" size={20} color={BRAND} />
            <Text style={styles.emptySidebarTitle}>No registered motorcycles</Text>
            <TouchableOpacity style={styles.emptyRegisterBtn} onPress={openRegister} activeOpacity={0.85}>
              <Text style={styles.emptyRegisterBtnText}>+ Register Motorcycle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bikeGrid}>
            {bikes.map((bike) => {
              const selected = bike.motorcycle_id === selectedBikeId;
              const photo = bikePhoto(bike);
              const card = bikeIdentity(bike);
              return (
                <View key={bike.motorcycle_id} style={styles.bikeSlot}>
                  <TouchableOpacity
                    style={[styles.bikeCard, selected && styles.bikeCardSelected]}
                    onPress={() => selectBike(bike)}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <View style={styles.bikeImageWrapper}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.bikeThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.bikeThumb, styles.imageFallback]}>
                          <BootstrapIcon name="bicycle" size={22} color={BRAND} />
                        </View>
                      )}
                      {selected ? (
                        <View style={styles.checkBadge}>
                          <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.bikeTitle} numberOfLines={1}>
                      {card.title}
                    </Text>
                    {card.spec ? (
                      <Text style={styles.bikeSpec} numberOfLines={1}>
                        {card.spec}
                      </Text>
                    ) : bike.year ? (
                      <Text style={styles.bikeSpec} numberOfLines={1}>
                        {bike.year}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* SECTION 2: Select part to install */}
      <View style={[styles.sidebarCard, openFilter && styles.sidebarCardRaised]}>
        <Text style={styles.sidebarTitle}>2. Select part to install</Text>

        {/* Catalog / Upload Tabs */}
        <View style={styles.pillTabs}>
          <TouchableOpacity
            style={[styles.pillTab, partMode === 'catalog' && styles.pillTabActive]}
            onPress={() => {
              setPartMode('catalog');
              setPartUri(null);
              setUploadCategory('');
              setOpenFilter(null);
            }}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={[styles.pillTabText, partMode === 'catalog' && styles.pillTabTextActive]}>
              Store Catalog
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillTab, partMode === 'upload' && styles.pillTabActive]}
            onPress={() => {
              setPartMode('upload');
              setSelectedProductId('');
              setSelectedProduct(null);
              setCompatWarning('');
              setCompatOverride(false);
              setCompatBlocked(false);
              setOpenFilter(null);
            }}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={[styles.pillTabText, partMode === 'upload' && styles.pillTabTextActive]}>
              Upload Part
            </Text>
          </TouchableOpacity>
        </View>

        {partMode === 'catalog' ? (
          <>
            {/* Search Bar */}
            <View style={styles.searchBar}>
              <BootstrapIcon name="search" size={14} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search parts by name or brand"
                placeholderTextColor="#94A3B8"
                value={partSearch}
                onChangeText={setPartSearch}
                editable={!loading}
              />
              {partSearch ? (
                <TouchableOpacity onPress={() => setPartSearch('')} activeOpacity={0.7}>
                  <BootstrapIcon name="x-circle-fill" size={14} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Dropdowns: Category & Brand */}
            <View style={styles.filterRow}>
              <FilterSelect
                label="Category"
                value={categoryFilter}
                options={categories}
                open={openFilter === 'category'}
                disabled={loading}
                onToggle={() => setOpenFilter((c) => (c === 'category' ? null : 'category'))}
                onChange={(val) => {
                  setCategoryFilter(val);
                  setOpenFilter(null);
                }}
              />
              <FilterSelect
                label="Brand"
                value={brandFilter}
                options={brands}
                open={openFilter === 'brand'}
                disabled={loading}
                onToggle={() => setOpenFilter((c) => (c === 'brand' ? null : 'brand'))}
                onChange={(val) => {
                  setBrandFilter(val);
                  setOpenFilter(null);
                }}
              />
            </View>

            {/* Compact 2-Column Catalog Grid */}
            <ScrollView
              style={styles.catalogScroll}
              contentContainerStyle={styles.catalogGrid}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {filteredParts.length === 0 ? (
                <Text style={styles.quietText}>No parts match your search or filter.</Text>
              ) : (
                filteredParts.map((product) => {
                  const id = String(product.product_id || product.id || '');
                  const selected = partMode === 'catalog' && id !== '' && id === String(selectedProductId || '');
                  const img = productImage(product);
                  const price = formatPartPrice(product);
                  const badgeLabel = product.brand || product.category || 'Universal';
                  return (
                    <View key={id} style={styles.partSlot}>
                      <TouchableOpacity
                        style={[styles.partCard, selected && styles.partCardSelected]}
                        onPress={() => selectCatalogPart(product)}
                        disabled={loading}
                        activeOpacity={0.88}
                      >
                        <View style={styles.partImageWrap}>
                          <Image source={{ uri: img }} style={styles.partThumb} resizeMode="cover" />
                          {selected ? (
                            <View style={styles.checkBadge}>
                              <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.partTitle} numberOfLines={2}>
                          {product.name}
                        </Text>
                        {price ? <Text style={styles.partPrice}>{price}</Text> : null}
                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText} numberOfLines={1}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </>
        ) : partUri ? (
          <View style={{ gap: 10 }}>
            <View style={styles.uploadPreviewRow}>
              <Image source={{ uri: partUri }} style={styles.uploadThumb} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.uploadPartTitle}>Uploaded Part Photo</Text>
                <Text style={styles.uploadPartCategory}>
                  {uploadCategory ? `${uploadCategory} selected` : 'Select part category below'}
                </Text>
                <TouchableOpacity onPress={pickPart} disabled={loading} activeOpacity={0.8}>
                  <Text style={styles.changePhotoText}>Change photo</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.categoryPrompt}>What type of motorcycle part is this?</Text>
            <View style={styles.categoryPillsGrid}>
              {UPLOAD_PART_CATEGORIES.map((cat) => {
                const active = uploadCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryPillBtn, active && styles.categoryPillBtnActive]}
                    onPress={() => {
                      setUploadCategory(cat);
                      setError('');
                      setResultUri(null);
                      setLastResult(null);
                    }}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.categoryPillBtnText, active && styles.categoryPillBtnTextActive]} numberOfLines={1}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadDropzone} onPress={pickPart} disabled={loading} activeOpacity={0.88}>
            <View style={styles.uploadDropzoneIcon}>
              <BootstrapIcon name="cloud-arrow-up" size={24} color={BRAND} />
            </View>
            <Text style={styles.uploadDropzoneTitle}>Upload Part Photo</Text>
            <Text style={styles.uploadDropzoneSub}>Select a clear image of the accessory to install</Text>
          </TouchableOpacity>
        )}

        {/* Optional Collapsible Custom Instructions */}
        <View style={styles.notesAccordion}>
          <TouchableOpacity
            style={styles.notesAccordionHeader}
            onPress={() => setNotesOpen(!notesOpen)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BootstrapIcon name="chat-square-text" size={13} color="#64748B" />
              <Text style={styles.notesAccordionTitle}>Custom Installation Notes (Optional)</Text>
            </View>
            <BootstrapIcon name={notesOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#64748B" />
          </TouchableOpacity>
          {notesOpen ? (
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Mount open pipe with carbon bracket, maintain stock angle..."
              placeholderTextColor="#94A3B8"
              value={customRequest}
              onChangeText={setCustomRequest}
              editable={!loading}
              multiline
            />
          ) : null}
        </View>

        {!isWebMode && (
          <TouchableOpacity
            style={styles.floatingPreviewNavBtn}
            onPress={() => setMobileTab('preview')}
            activeOpacity={0.88}
          >
            <BootstrapIcon name="eye-fill" size={15} color="#FFFFFF" />
            <Text style={styles.floatingPreviewNavBtnText}>View AI Preview Canvas ➔</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RIGHT WORKSPACE: Modern Card Style AI Installation Preview
  // ─────────────────────────────────────────────────────────────────────────
  const previewWorkspace = (
    <View style={styles.workspaceContainer}>
      {/* 1. Selection Toolbar */}
      {!shouldHideToolbar && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity
            style={[styles.toolbarBtn, mobileTab === 'selection' && styles.toolbarBtnActive]}
            onPress={() => setMobileTab('selection')}
            activeOpacity={0.85}
            accessibilityLabel="Motorcycle and Part Selector"
          >
            <BootstrapIcon
              name="sliders"
              size={14}
              color={mobileTab === 'selection' ? '#FFFFFF' : '#172033'}
            />
            <Text
              style={[styles.toolbarBtnText, mobileTab === 'selection' && styles.toolbarBtnTextActive]}
              numberOfLines={1}
            >
              Motorcycle & Part Selector
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolbarBtn, styles.toolbarBtnCanvas, mobileTab === 'preview' && styles.toolbarBtnCanvasActive]}
            onPress={() => setMobileTab('preview')}
            activeOpacity={0.85}
            accessibilityLabel="AI Preview Canvas"
          >
            <BootstrapIcon name="eye-fill" size={14} color="#FFFFFF" />
            <Text style={[styles.toolbarBtnText, styles.toolbarBtnCanvasText]} numberOfLines={1}>
              AI Preview Canvas
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. AI Installation Preview Heading */}
      <View style={styles.previewHeadingRow}>
        <View style={styles.previewTitleWrap}>
          <Text style={styles.previewHeadingTitle} numberOfLines={1}>
            AI Installation Preview
          </Text>
        </View>

        <View style={styles.previewHeadingControls}>
          {/* Before and After segmented control (Web only; mobile is floating on canvas) */}
          {isWebMode && (
            <View style={styles.beforeAfterSegment}>
              <TouchableOpacity
                style={[
                  styles.beforeAfterPill,
                  previewMode === 'before' ? styles.beforeAfterPillActive : styles.beforeAfterPillInactive,
                ]}
                onPress={() => setPreviewMode('before')}
                activeOpacity={0.85}
                accessibilityLabel="Show Before Preview"
              >
                <Text
                  style={[
                    styles.beforeAfterText,
                    previewMode === 'before' ? styles.beforeAfterTextActive : styles.beforeAfterTextInactive,
                  ]}
                >
                  Before
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.beforeAfterPill,
                  previewMode === 'after' ? styles.beforeAfterPillActive : styles.beforeAfterPillInactive,
                ]}
                onPress={() => setPreviewMode('after')}
                activeOpacity={0.85}
                accessibilityLabel="Show After Preview"
              >
                <Text
                  style={[
                    styles.beforeAfterText,
                    previewMode === 'after' ? styles.beforeAfterTextActive : styles.beforeAfterTextInactive,
                  ]}
                >
                  After
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Saved indicator */}
          <TouchableOpacity
            style={styles.savedIndicatorBtn}
            onPress={() => setSavedBuildsModalOpen(true)}
            activeOpacity={0.85}
            accessibilityLabel={`View ${savedBuilds.length} saved installation previews`}
          >
            <BootstrapIcon
              name={isWebMode ? 'bookmark-star-fill' : 'circle-fill'}
              size={isWebMode ? 13 : 9}
              color="#10B981"
            />
            <Text style={styles.savedIndicatorText}>Saved</Text>
            <View style={styles.savedCountChip}>
              <Text style={styles.savedCountChipText}>{savedBuilds.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Motorcycle Part Information Card */}
      <TouchableOpacity
        style={styles.partInfoCard}
        onPress={() => {
          if (sessionProduct?.raw || selectedProduct?.raw || selectedProduct) {
            setViewingPartDetails(sessionProduct?.raw || selectedProduct?.raw || selectedProduct);
          } else {
            setMobileTab('selection');
          }
        }}
        activeOpacity={0.88}
        accessibilityLabel={`Selected part: ${partDisplayName || 'Accessory'}, ${partBrand} · ${partPrice || '₱800'}. Status: Preview Ready.`}
      >
        <View style={styles.partInfoLeft}>
          {resolvedPartUri ? (
            <Image source={{ uri: resolvedPartUri }} style={styles.partInfoThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.partInfoThumb, styles.partInfoFallback]}>
              <BootstrapIcon name="gear" size={18} color={BRAND} />
            </View>
          )}
          <View style={styles.partInfoMeta}>
            <Text style={styles.partInfoName} numberOfLines={1}>
              {partDisplayName || 'Akrapovič RIM'}
            </Text>
            <Text style={styles.partInfoBrandPrice} numberOfLines={1}>
              {partBrand || 'Akrapovič'} · {partPrice || '₱800'}
            </Text>
          </View>
        </View>

        <View style={styles.partInfoRight}>
          <View style={styles.statusReadyBadge}>
            <View style={styles.statusReadyDot} />
            <Text style={styles.statusReadyText}>Preview Ready</Text>
          </View>
          <BootstrapIcon name="chevron-right" size={15} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {/* Compatibility Warning if present */}
      {compatWarning ? (
        <View style={styles.compatWarningAlert}>
          <BootstrapIcon name="exclamation-triangle-fill" size={15} color="#B45309" />
          <Text style={styles.compatWarningAlertText}>{compatWarning}</Text>
        </View>
      ) : null}

      {/* Save Notice feedback */}
      {saveNotice ? (
        <View style={styles.saveNoticeBanner}>
          <BootstrapIcon name="check-circle-fill" size={15} color="#166534" />
          <Text style={styles.saveNoticeText}>{saveNotice}</Text>
        </View>
      ) : null}

      {/* 4. Motorcycle Preview Canvas */}
      <View style={styles.canvasFrame}>
        {/* Floating Mode indicator tag / Segmented Control (Upper-Left) */}
        {isWebMode ? (
          <View style={styles.floatingModeTag}>
            <Text style={styles.floatingModeTagText}>
              {previewMode === 'before'
                ? 'BEFORE: ORIGINAL'
                : resultUri
                ? 'AFTER: INSTALLED'
                : 'AFTER: PENDING RESULT'}
            </Text>
          </View>
        ) : (
          <View style={styles.floatingBeforeAfterSegment}>
            <TouchableOpacity
              style={[
                styles.floatingBeforeAfterPill,
                previewMode === 'before'
                  ? styles.floatingBeforeAfterPillActive
                  : styles.floatingBeforeAfterPillInactive,
              ]}
              onPress={() => setPreviewMode('before')}
              activeOpacity={0.85}
              accessibilityLabel="Show Before Preview"
            >
              <Text
                style={[
                  styles.floatingBeforeAfterText,
                  previewMode === 'before'
                    ? styles.floatingBeforeAfterTextActive
                    : styles.floatingBeforeAfterTextInactive,
                ]}
              >
                Before
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.floatingBeforeAfterPill,
                previewMode === 'after'
                  ? styles.floatingBeforeAfterPillActive
                  : styles.floatingBeforeAfterPillInactive,
              ]}
              onPress={() => setPreviewMode('after')}
              activeOpacity={0.85}
              accessibilityLabel="Show After Preview"
            >
              <Text
                style={[
                  styles.floatingBeforeAfterText,
                  previewMode === 'after'
                    ? styles.floatingBeforeAfterTextActive
                    : styles.floatingBeforeAfterTextInactive,
                ]}
              >
                After
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Zoom Controls: Zoom Out / Zoom In / Fit (Upper-Right) */}
        <View style={styles.floatingZoomGroup}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomOut}
            disabled={zoomLevel <= 0.75}
            activeOpacity={0.7}
            accessibilityLabel="Zoom Out"
          >
            <BootstrapIcon name="dash" size={16} color={isDarkMode ? '#F8FAFC' : '#172033'} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomIn}
            disabled={zoomLevel >= 2.5}
            activeOpacity={0.7}
            accessibilityLabel="Zoom In"
          >
            <BootstrapIcon name="plus" size={16} color={isDarkMode ? '#F8FAFC' : '#172033'} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={[styles.zoomButton, styles.zoomFitButton]}
            onPress={handleFitScreen}
            activeOpacity={0.7}
            accessibilityLabel="Fit to Screen"
          >
            <BootstrapIcon name="arrows-fullscreen" size={11} color={isDarkMode ? '#F8FAFC' : '#172033'} />
            <Text style={styles.zoomFitText}>Fit</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas Display Content */}
        {loading ? (
          <View style={styles.canvasLoadingOverlay}>
            <View style={styles.canvasLoadingCard}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.canvasLoadingTitle}>AI Installation In Progress</Text>
              <Text style={styles.canvasLoadingSubtitle}>
                Precision-fitting {sessionProduct?.name || 'part'} onto {selectedBike?.nickname || selectedBike?.name || 'motorcycle'}...
              </Text>
              <GenerationProgress phase={genPhase} />
            </View>
          </View>
        ) : previewFailed ? (
          <View style={styles.canvasErrorCard}>
            <BootstrapIcon name="exclamation-circle-fill" size={32} color="#DC2626" />
            <Text style={styles.canvasErrorTitle}>Preview Generation Notice</Text>
            <Text style={styles.canvasErrorMsg}>
              {friendlyError || 'Unable to generate installation preview.'}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => handleGenerate({ forceCompatOverride: true })}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="arrow-clockwise" size={14} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : canvasDisplayUri ? (
          <View style={styles.canvasImageWrapper}>
            <Image
              source={{ uri: canvasDisplayUri }}
              style={[
                styles.canvasImage,
                { transform: [{ scale: zoomLevel }] },
              ]}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.canvasEmptyState}>
            <View style={styles.canvasEmptyIcon}>
              <BootstrapIcon
                name={previewMode === 'after' ? 'stars' : 'bicycle'}
                size={36}
                color={BRAND}
              />
            </View>
            <Text style={styles.canvasEmptyTitle}>
              {previewMode === 'after'
                ? 'No AI Installation Result Yet'
                : 'No Motorcycle Selected'}
            </Text>
            <Text style={styles.canvasEmptyText}>
              {previewMode === 'after'
                ? 'Click "Generate Preview" below to view the AI installation result, or switch to "Before" to view the original motorcycle.'
                : 'Select your registered motorcycle on the left to preview it here.'}
            </Text>
          </View>
        )}
      </View>

      {/* 5. Generate Preview Button (Full-width directly below canvas) */}
      <TouchableOpacity
        style={[
          styles.generatePrimaryBtn,
          (!readyToGenerate || isGenerationBlocked || loading) && styles.generatePrimaryBtnDisabled,
        ]}
        onPress={() => handleGenerate()}
        disabled={!readyToGenerate || isGenerationBlocked || loading}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Generate AI Installation Preview"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <BootstrapIcon name="stars" size={18} color="#FFFFFF" />
        )}
        <Text
          style={[
            styles.generatePrimaryBtnText,
            (!readyToGenerate || isGenerationBlocked || loading) && styles.generatePrimaryBtnTextDisabled,
          ]}
        >
          {loading
            ? 'Generating Preview...'
            : isConsecutiveCooldown
            ? `Cooldown (${cooldownCountdown || 'wait'})`
            : isWeeklyLimitReached
            ? 'Weekly Limit Reached (3 / 3)'
            : 'Generate Preview'}
        </Text>
      </TouchableOpacity>

      {/* 6. Secondary Action Cards */}
      <View style={styles.secondaryCardsRow}>
        {/* Card 1: Save to Wishlist */}
        <TouchableOpacity
          style={[styles.secondaryCard, (!resultUri || loading) && styles.secondaryCardDisabled]}
          onPress={handleSaveToGarage}
          disabled={!resultUri || loading || savingToGarage}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save preview to Wishlist"
        >
          {savingToGarage ? (
            <ActivityIndicator size="small" color={BRAND} />
          ) : (
            <BootstrapIcon
              name={savedToGarage ? 'heart-fill' : 'heart'}
              size={16}
              color={!resultUri ? '#94A3B8' : savedToGarage ? '#EF4444' : BRAND}
            />
          )}
          <Text
            style={[
              styles.secondaryCardText,
              !resultUri && styles.secondaryCardTextDisabled,
              savedToGarage && { color: '#EF4444' },
            ]}
          >
            {savedToGarage ? 'Saved to Wishlist' : 'Save to Wishlist'}
          </Text>
        </TouchableOpacity>

        {/* Card 2: Book Installation */}
        <TouchableOpacity
          style={[
            styles.secondaryCard,
            styles.bookInstallCard,
            (!resultUri || loading) && styles.secondaryCardDisabled,
          ]}
          onPress={handleOpenBookingModal}
          disabled={!resultUri || loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Book Pitstop Installation"
        >
          <BootstrapIcon
            name="calendar-check"
            size={16}
            color={!resultUri ? '#94A3B8' : BRAND}
          />
          <Text
            style={[
              styles.secondaryCardText,
              !resultUri && styles.secondaryCardTextDisabled,
            ]}
          >
            {freeInstallPromo ? 'Book Free Install' : 'Book Installation'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full-width Separate Action: Compare Original vs. Modified */}
      <TouchableOpacity
        style={[styles.compareFullBtn, (!resultUri || loading) && styles.compareFullBtnDisabled]}
        onPress={handleToggleCompare}
        disabled={!resultUri || loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Compare Original vs. Modified preview"
      >
        <BootstrapIcon
          name="arrow-left-right"
          size={16}
          color={!resultUri ? '#94A3B8' : BRAND}
        />
        <Text
          style={[
            styles.compareFullBtnText,
            !resultUri && styles.compareFullBtnTextDisabled,
          ]}
        >
          {previewMode === 'before' ? 'Show Modified Preview' : 'Compare Original vs. Modified'}
        </Text>
      </TouchableOpacity>

      {freeInstallPromo && resultUri ? (
        <View style={styles.freeInstallBanner}>
          <BootstrapIcon name="gift" size={13} color="#166534" />
          <Text style={styles.freeInstallBannerText}>
            Free Installation promo active for this part ({freeInstallPromo.code})
          </Text>
        </View>
      ) : null}

      {/* 7. Preview Usage & Additional Actions Row */}
      <View style={styles.auxiliarySection}>
        <View style={styles.usageIndicator}>
          {aiUsage.isAdmin ? (
            <Text style={styles.usageText}>⚡ Unlimited Previews (Admin)</Text>
          ) : (
            <Text style={styles.usageText}>
              Previews: {aiUsage.weeklyUsed} / {aiUsage.weeklyLimit || 3} this week
            </Text>
          )}
        </View>

        <View style={styles.auxiliaryActionsRow}>
          {canAddToCart ? (
            <TouchableOpacity style={styles.auxActionBtn} onPress={handleAddToCart} activeOpacity={0.85}>
              <BootstrapIcon name="cart3" size={14} color={BRAND} />
              <Text style={styles.auxActionBtnText}>Add Part to Cart</Text>
            </TouchableOpacity>
          ) : null}

          {resultUri ? (
            <>
              <TouchableOpacity
                style={styles.auxActionBtn}
                onPress={() => handleSaveImage()}
                disabled={savingImage}
                activeOpacity={0.85}
              >
                {savingImage ? (
                  <ActivityIndicator size="small" color={BRAND} />
                ) : (
                  <BootstrapIcon name="download" size={14} color={BRAND} />
                )}
                <Text style={styles.auxActionBtnText}>Download PNG</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.auxActionBtn} onPress={handleStartNewPreview} activeOpacity={0.85}>
                <BootstrapIcon name="arrow-clockwise" size={14} color="#64748B" />
                <Text style={[styles.auxActionBtnText, { color: '#64748B' }]}>New Preview</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <InstallThemeContext.Provider value={{ styles, BRAND, MUTED, isDark: isDarkMode, isWeb: isWebMode }}>
      <View style={[styles.root, isDarkMode && { backgroundColor: '#12161E' }]}>
        {isWebMode && isWide ? (
          <View style={styles.twoColumnWorkspace}>
            <View style={styles.leftColumn}>
              {selectionSidebar}
            </View>
            <View style={styles.rightColumn}>
              {previewWorkspace}
            </View>
          </View>
        ) : isWebMode ? (
          <View style={[styles.studioCardWrapper, { maxWidth: '100%' }]}>
            <View style={{ gap: 20 }}>
              {selectionSidebar}
              {previewWorkspace}
            </View>
          </View>
        ) : (
          <View style={styles.studioCardWrapper}>
            {mobileTab === 'selection' ? selectionSidebar : previewWorkspace}
          </View>
        )}

        {/* Part Details & Fitment Modal */}
        <Modal
          visible={viewingPartDetails !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setViewingPartDetails(null)}
        >
          <View style={styles.modalOverlay}>
            {viewingPartDetails && (
              <View style={[styles.modalSheet, { maxWidth: 420, padding: 18, gap: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#172033' }}>
                    Part Details & Fitment
                  </Text>
                  <TouchableOpacity onPress={() => setViewingPartDetails(null)} activeOpacity={0.7}>
                    <BootstrapIcon name="x-lg" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {productImage(viewingPartDetails) ? (
                  <View style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F5F9' }}>
                    <Image source={{ uri: productImage(viewingPartDetails) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                ) : null}

                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#172033' }}>
                    {viewingPartDetails.name || viewingPartDetails.product_name}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '500' }}>
                    {viewingPartDetails.brand} · {viewingPartDetails.category || 'Accessory'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#EA580C' }}>
                    {formatPartPrice(viewingPartDetails)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <BootstrapIcon name="check-circle-fill" size={14} color="#10B981" />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#065F46' }}>
                    Fits {selectedBike?.nickname || selectedBike?.name || 'Selected Motorcycle'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={{ backgroundColor: '#EA580C', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
                  onPress={() => {
                    selectCatalogPart(viewingPartDetails);
                    setViewingPartDetails(null);
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Equip on Motorcycle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>

        {/* Motorcycle Registration Modal */}
        <RegisterMotorcycleModal
          visible={registerOpen}
          motorcycle={null}
          onClose={() => setRegisterOpen(false)}
          onSave={handleSaveRegisteredBike}
        />

        {/* Book Installation Modal */}
        <BookInstallationModal
          visible={bookingModalOpen}
          onClose={() => !bookingBusy && setBookingModalOpen(false)}
          previewImageUri={resultUri}
          motorcycle={selectedBike?.raw || selectedBike}
          bikeTitle={buildPreviewSnapshot().bikeTitle}
          serviceName={buildPreviewSnapshot().pTitle}
          laborFeePhp={usdToPhp(AI_INSTALLATION_FEE_USD)}
          freeInstallPromo={freeInstallPromo}
          branches={GARAGE_BRANCHES}
          selectedBranch={bookingBranch}
          onSelectBranch={setBookingBranch}
          timeSlots={TIME_SLOTS}
          selectedTimeSlot={bookingTimeSlot}
          onSelectTimeSlot={setBookingTimeSlot}
          phone={bookingPhone}
          onChangePhone={setBookingPhone}
          notes={bookingNotes}
          onChangeNotes={setBookingNotes}
          onConfirm={handleConfirmInstallBooking}
          onWishlist={
            onNavigateToWishlist
              ? () => {
                  setBookingModalOpen(false);
                  onNavigateToWishlist();
                }
              : null
          }
          busy={bookingBusy}
          errorMessage={
            saveNotice &&
            (saveNotice.includes('Could not') ||
              saveNotice.includes('Failed') ||
              saveNotice.includes('Please enter'))
              ? saveNotice
              : ''
          }
        />

        {/* Saved Builds Management Modal */}
        <Modal
          visible={savedBuildsModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSavedBuildsModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <BootstrapIcon name="bookmark-star-fill" size={18} color={BRAND} />
                  <View>
                    <Text style={styles.modalTitle}>My Saved Installation Previews</Text>
                    <Text style={styles.modalSub}>Access your saved motorcycle modifications.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSavedBuildsModalOpen(false)}
                  activeOpacity={0.7}
                >
                  <BootstrapIcon name="x" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {loadingSavedBuilds ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="large" color={BRAND} />
                  <Text style={styles.quietText}>Loading saved previews…</Text>
                </View>
              ) : savedBuilds.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <BootstrapIcon name="image" size={32} color={BRAND} />
                  <Text style={styles.emptyTitle}>No saved previews yet</Text>
                  <Text style={styles.emptyBody}>
                    Generate a preview in the studio and tap "Save Preview" to access your builds anytime.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                  {savedBuilds.map((build) => {
                    const buildId = build.id || build.customization_id;
                    const img = build.previewImageUrl || build.preview_image_url;
                    const bTitle =
                      build.name ||
                      build.motorcycleName ||
                      [build.motorcycleBrand, build.motorcycleModel].filter(Boolean).join(' ') ||
                      'Custom Motorcycle';
                    const firstItem = build.items?.[0];
                    const pTitle = firstItem?.product_name || firstItem?.name || 'Installed Part';

                    return (
                      <View key={buildId} style={styles.savedCard}>
                        <Image source={{ uri: img }} style={styles.savedCardThumb} resizeMode="cover" />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={styles.savedCardTitle} numberOfLines={1}>
                            {bTitle}
                          </Text>
                          <Text style={styles.savedCardPart} numberOfLines={1}>
                            {pTitle}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              style={styles.loadStudioBtn}
                              onPress={() => handleLoadSavedBuild(build)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.loadStudioBtnText}>Load in Studio</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => handleSaveImage(img)}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="download" size={13} color={BRAND} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.iconBtn, { borderColor: '#FECACA' }]}
                              onPress={() => handleDeleteSavedBuild(buildId)}
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="trash" size={13} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </InstallThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Auxiliary Subcomponents
// ─────────────────────────────────────────────────────────────────────────
function FilterSelect({ label, value, options, open, onToggle, onChange, disabled }) {
  const { styles, MUTED } = React.useContext(InstallThemeContext);
  return (
    <View style={[styles.filterField, open && styles.filterFieldOpen]}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity style={styles.filterButton} onPress={onToggle} disabled={disabled} activeOpacity={0.85}>
        <Text style={styles.filterValue} numberOfLines={1}>
          {value}
        </Text>
        <BootstrapIcon name="chevron-down" size={12} color={MUTED} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.filterMenu}>
          <ScrollView style={styles.filterMenuScroll} nestedScrollEnabled>
            {options.map((opt) => {
              const selected = opt === value;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.filterOption, selected && styles.filterOptionOn]}
                  onPress={() => onChange(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextOn]} numberOfLines={1}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function GenerationProgress({ phase }) {
  const { styles, BRAND } = React.useContext(InstallThemeContext);
  const rows = [
    { label: 'Motorcycle selected', status: 'done' },
    { label: 'Part selected', status: 'done' },
    { label: 'Preparing installation geometry', status: phase > 0 ? 'done' : 'active' },
    { label: 'AI image rendering', status: phase > 1 ? 'done' : phase === 1 ? 'active' : 'wait' },
    { label: 'Finalizing photorealistic output', status: phase >= 2 ? 'active' : 'wait' },
  ];

  return (
    <View style={styles.progressTracker}>
      {rows.map((row) => (
        <View key={row.label} style={styles.progressRow}>
          <View style={styles.progressIcon}>
            {row.status === 'done' ? (
              <BootstrapIcon name="check-circle-fill" size={14} color={BRAND} />
            ) : row.status === 'active' ? (
              <BootstrapIcon name="circle-fill" size={9} color={BRAND} />
            ) : (
              <BootstrapIcon name="circle" size={11} color="#94A3B8" />
            )}
          </View>
          <Text
            style={[
              styles.progressLabel,
              row.status === 'active' && styles.progressLabelActive,
              row.status === 'wait' && styles.progressLabelWait,
            ]}
          >
            {row.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STYLESHEET GENERATOR
// ─────────────────────────────────────────────────────────────────────────
function createInstallStudioStyles(isDark = false, isWeb = false) {
  const BRAND = '#EA580C';
  const BRAND_SOFT = isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED';
  const INK = isDark ? '#F8FAFC' : '#172033';
  const MUTED = isDark ? '#94A3B8' : '#64748B';
  const LINE = isDark ? '#2D3748' : '#E2E8F0';
  const SURFACE = isDark ? '#1A202C' : '#FFFFFF';
  const CANVAS = isDark ? '#12161E' : '#F5F7FA';
  const CANVAS_STUDIO = isDark ? '#1E2530' : '#E6E9EC';

  return StyleSheet.create({
    root: {
      width: '100%',
      paddingBottom: 24,
    },
    // Modern Card Style max-width centered container
    studioCardWrapper: {
      width: '100%',
      maxWidth: isWeb ? '100%' : 680,
      alignSelf: isWeb ? 'stretch' : 'center',
    },
    // ─── 1. SELECTION TOOLBAR ───
    selectionToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 16,
      width: '100%',
    },
    toolbarBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: SURFACE,
      borderWidth: 1.5,
      borderColor: LINE,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    toolbarBtnActive: {
      borderColor: BRAND,
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.1)' : '#FFF7ED',
    },
    toolbarBtnCanvas: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: BRAND,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1.5,
      borderColor: BRAND,
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(234, 88, 12, 0.28)' },
        default: {
          shadowColor: '#EA580C',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.28,
          shadowRadius: 4,
          elevation: 2,
        },
      }),
    },
    toolbarBtnCanvasActive: {
      backgroundColor: BRAND,
      borderColor: BRAND,
    },
    toolbarBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: INK,
      letterSpacing: -0.1,
    },
    toolbarBtnTextActive: {
      color: BRAND,
    },
    toolbarBtnCanvasText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ─── 2. PREVIEW HEADING ROW ───
    previewHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: isWeb ? 10 : 8,
      marginBottom: isWeb ? 14 : 12,
      width: '100%',
    },
    previewTitleWrap: {
      flexShrink: 0,
    },
    previewHeadingTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: INK,
      letterSpacing: -0.3,
    },
    previewHeadingControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    beforeAfterSegment: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#232D3B' : '#E2E8F0',
      borderRadius: isWeb ? 8 : 8,
      padding: 3,
      borderWidth: 1,
      borderColor: LINE,
    },
    beforeAfterPill: {
      paddingHorizontal: isWeb ? 12 : 12,
      paddingVertical: 5,
      borderRadius: isWeb ? 6 : 6,
    },
    beforeAfterPillActive: {
      backgroundColor: BRAND,
    },
    beforeAfterPillInactive: {
      backgroundColor: 'transparent',
    },
    beforeAfterText: {
      fontSize: 12,
      fontWeight: '700',
    },
    beforeAfterTextActive: {
      color: '#FFFFFF',
    },
    beforeAfterTextInactive: {
      color: MUTED,
    },
    savedIndicatorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: isWeb ? 8 : 14,
      backgroundColor: isDark ? '#1E2530' : '#F8FAFC',
      borderWidth: 1,
      borderColor: LINE,
    },
    savedIndicatorText: {
      fontSize: 12,
      fontWeight: '600',
      color: MUTED,
    },
    savedCountChip: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
      borderRadius: isWeb ? 6 : 999,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: isDark ? '#10B981' : '#A7F3D0',
    },
    savedCountChipText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#065F46',
    },

    // ─── 3. MOTORCYCLE PART INFORMATION CARD ───
    partInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: isWeb ? 10 : 16,
      padding: isWeb ? 10 : 12,
      marginBottom: isWeb ? 12 : 14,
      width: '100%',
      gap: 12,
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    partInfoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    partInfoThumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
    },
    partInfoFallback: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    partInfoMeta: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    partInfoName: {
      fontSize: 14,
      fontWeight: '800',
      color: INK,
      letterSpacing: -0.2,
    },
    partInfoBrandPrice: {
      fontSize: 12.5,
      fontWeight: '600',
      color: MUTED,
    },
    partInfoRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusReadyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? '#065F46' : '#A7F3D0',
      borderRadius: isWeb ? 6 : 12,
      paddingHorizontal: isWeb ? 8 : 9,
      paddingVertical: 4,
    },
    statusReadyDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#10B981',
    },
    statusReadyText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#065F46',
    },
    // Mobile tab switcher
    mobileTabBar: {
      flexDirection: 'row',
      backgroundColor: CANVAS,
      borderRadius: 12,
      padding: 4,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: LINE,
    },
    mobileTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 9,
    },
    mobileTabBtnActive: {
      backgroundColor: BRAND,
    },
    mobileTabBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: MUTED,
    },
    mobileTabBtnTextActive: {
      color: '#FFFFFF',
    },
    // Desktop Two-Column Layout (29% / 71%)
    twoColumnWorkspace: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: isWeb ? 24 : 20,
      width: '100%',
    },
    leftColumn: {
      width: isWeb ? 380 : '29%',
      minWidth: isWeb ? 340 : 300,
      maxWidth: isWeb ? 420 : 390,
      flexShrink: 0,
    },
    rightColumn: {
      flex: 1,
      minWidth: 0,
      ...Platform.select({
        web: isWeb ? { position: 'sticky', top: 84, alignSelf: 'flex-start' } : {},
      }),
    },
    mobileStack: {
      width: '100%',
      gap: 16,
    },

    // ─── LEFT SIDEBAR STYLES ───
    sidebarContainer: {
      gap: 16,
      width: '100%',
    },
    sidebarCard: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: isWeb ? 12 : 16,
      padding: 14,
      gap: 12,
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        },
      }),
    },
    sidebarCardRaised: {
      zIndex: 40,
    },
    sidebarCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sidebarTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: INK,
      letterSpacing: -0.2,
    },
    registerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    registerLinkText: {
      fontSize: 12,
      fontWeight: '700',
      color: BRAND,
    },
    // Motorcycle Selection Grid
    bikeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    bikeSlot: {
      width: '50%',
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    bikeCard: {
      borderWidth: 1.5,
      borderColor: LINE,
      borderRadius: isWeb ? 8 : 12,
      backgroundColor: SURFACE,
      padding: 7,
      gap: 3,
    },
    bikeCardSelected: {
      borderColor: BRAND,
      backgroundColor: isDark ? 'rgba(77, 184, 150, 0.1)' : '#F0FDF4',
    },
    bikeImageWrapper: {
      position: 'relative',
      width: '100%',
      height: isWeb ? 80 : 76,
      borderRadius: isWeb ? 6 : 8,
      overflow: 'hidden',
      backgroundColor: isDark ? '#1C2622' : '#EEF2F4',
    },
    bikeThumb: {
      width: '100%',
      height: '100%',
    },
    checkBadge: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: BRAND,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
    },
    bikeTitle: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '800',
      color: INK,
    },
    bikeSpec: {
      fontSize: 10.5,
      color: MUTED,
    },
    imageFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptySidebar: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      gap: 6,
      backgroundColor: CANVAS,
      borderRadius: 12,
    },
    emptySidebarTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: INK,
    },
    emptyRegisterBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: BRAND,
    },
    emptyRegisterBtnText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '700',
    },

    // ─── PART SELECTION TABS & CATALOG ───
    pillTabs: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#18221E' : '#F1F5F9',
      borderRadius: isWeb ? 8 : 10,
      padding: 3,
      gap: 4,
    },
    pillTab: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: isWeb ? 6 : 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillTabActive: {
      backgroundColor: BRAND,
    },
    pillTabText: {
      fontSize: 12,
      fontWeight: '700',
      color: MUTED,
    },
    pillTabTextActive: {
      color: '#FFFFFF',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? '#1A2420' : '#F8FAFC',
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: isWeb ? 8 : 10,
      paddingHorizontal: 10,
      minHeight: 38,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      color: INK,
      paddingVertical: Platform.OS === 'web' ? 7 : 4,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      zIndex: 5,
    },
    filterField: {
      flex: 1,
      gap: 4,
      position: 'relative',
    },
    filterFieldOpen: {
      zIndex: 50,
    },
    filterLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      color: MUTED,
      letterSpacing: 0.2,
    },
    filterButton: {
      minHeight: 34,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: isWeb ? 8 : 9,
      backgroundColor: SURFACE,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    filterValue: {
      fontSize: 11.5,
      fontWeight: '600',
      color: INK,
    },
    filterMenu: {
      position: 'absolute',
      top: 56,
      left: 0,
      right: 0,
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 10,
      zIndex: 60,
      ...Platform.select({
        web: { boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 6,
        },
      }),
    },
    filterMenuScroll: {
      maxHeight: 180,
    },
    filterOption: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    filterOptionOn: {
      backgroundColor: BRAND_SOFT,
    },
    filterOptionText: {
      fontSize: 12,
      color: INK,
    },
    filterOptionTextOn: {
      fontWeight: '700',
      color: BRAND,
    },
    // Independently scrollable catalog
    catalogScroll: {
      maxHeight: isWeb ? 460 : 380,
      borderRadius: isWeb ? 8 : 10,
    },
    catalogGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    partSlot: {
      width: '50%',
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    partCard: {
      borderWidth: 1.5,
      borderColor: LINE,
      borderRadius: isWeb ? 8 : 12,
      backgroundColor: SURFACE,
      padding: 7,
      gap: 3,
    },
    partCardSelected: {
      borderColor: BRAND,
      backgroundColor: isDark ? 'rgba(77, 184, 150, 0.1)' : '#F0FDF4',
    },
    partImageWrap: {
      position: 'relative',
      width: '100%',
      height: isWeb ? 80 : 74,
      borderRadius: isWeb ? 6 : 8,
      overflow: 'hidden',
      backgroundColor: isDark ? '#1C2622' : '#EEF2F4',
    },
    partThumb: {
      width: '100%',
      height: '100%',
    },
    partTitle: {
      marginTop: 3,
      fontSize: 11.5,
      lineHeight: 15,
      fontWeight: '700',
      color: INK,
    },
    partPrice: {
      fontSize: 12,
      fontWeight: '800',
      color: BRAND,
    },
    badgePill: {
      alignSelf: 'flex-start',
      backgroundColor: isDark ? '#1D2A24' : '#F1F5F9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDark ? '#2B3D35' : '#E2E8F0',
      marginTop: 2,
    },
    badgePillText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: isDark ? '#AAB4B0' : '#475569',
    },
    quietText: {
      fontSize: 12,
      color: MUTED,
      textAlign: 'center',
      paddingVertical: 24,
      width: '100%',
    },
    // Upload dropzone & preview
    uploadDropzone: {
      minHeight: 140,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? '#2E4038' : '#C5D5CC',
      borderRadius: 12,
      backgroundColor: isDark ? '#16201B' : '#F7FAF8',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 14,
    },
    uploadDropzoneIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: BRAND_SOFT,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    uploadDropzoneTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: INK,
    },
    uploadDropzoneSub: {
      fontSize: 11,
      color: MUTED,
      textAlign: 'center',
    },
    uploadPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 10,
      backgroundColor: SURFACE,
    },
    uploadThumb: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: '#EEF2F4',
    },
    uploadPartTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: INK,
    },
    uploadPartCategory: {
      fontSize: 11,
      color: BRAND,
      fontWeight: '600',
    },
    changePhotoText: {
      fontSize: 11,
      fontWeight: '700',
      color: BRAND,
    },
    categoryPrompt: {
      fontSize: 11.5,
      fontWeight: '700',
      color: INK,
      marginTop: 4,
    },
    categoryPillsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    categoryPillBtn: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: SURFACE,
    },
    categoryPillBtnActive: {
      borderColor: BRAND,
      backgroundColor: BRAND_SOFT,
    },
    categoryPillBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: INK,
    },
    categoryPillBtnTextActive: {
      color: BRAND,
      fontWeight: '700',
    },
    // Notes accordion
    notesAccordion: {
      borderTopWidth: 1,
      borderTopColor: LINE,
      paddingTop: 10,
      marginTop: 4,
    },
    notesAccordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    notesAccordionTitle: {
      fontSize: 11.5,
      fontWeight: '600',
      color: MUTED,
    },
    notesInput: {
      marginTop: 6,
      minHeight: 52,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 8,
      backgroundColor: CANVAS,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 12,
      color: INK,
      textAlignVertical: 'top',
    },

    // ─── RIGHT WORKSPACE STYLES ───
    workspaceContainer: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: isWeb ? 12 : 20,
      padding: isWeb ? 18 : 16,
      width: '100%',
      ...Platform.select({
        web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        },
      }),
    },
    workspaceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    workspaceTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: isDark ? '#F5F7F6' : '#142E22',
      letterSpacing: -0.5,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    // Before / After Segmented Pill
    beforeAfterSwitch: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1A2420' : '#F1F5F9',
      borderRadius: 20,
      padding: 3,
      borderWidth: 1,
      borderColor: LINE,
    },
    switchPill: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 16,
    },
    switchPillActive: {
      backgroundColor: BRAND,
    },
    switchPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: MUTED,
    },
    switchPillTextActive: {
      color: '#FFFFFF',
    },
    savedBuildsTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: SURFACE,
    },
    savedBuildsTriggerText: {
      fontSize: 12,
      fontWeight: '700',
      color: BRAND,
    },
    savedBuildsBadge: {
      backgroundColor: BRAND,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    savedBuildsBadgeText: {
      color: '#FFFFFF',
      fontSize: 9.5,
      fontWeight: '800',
    },

    // Selected Part Subheader Strip
    selectedPartStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#17201C' : '#F8FAFC',
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 12,
      padding: 8,
      paddingHorizontal: 12,
      gap: 12,
    },
    selectedPartLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    selectedPartThumb: {
      width: 42,
      height: 42,
      borderRadius: 8,
      backgroundColor: isDark ? '#1E2A25' : '#EEF2F4',
    },
    selectedPartInfo: {
      flex: 1,
      gap: 1,
    },
    selectedPartTitle: {
      fontSize: 13.5,
      fontWeight: '800',
      color: INK,
    },
    selectedPartMeta: {
      fontSize: 11.5,
      color: MUTED,
    },
    selectedPartRight: {},
    badgeReady: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(77, 184, 150, 0.16)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(77, 184, 150, 0.3)' : '#A7F3D0',
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#10B981',
    },
    badgeReadyText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#EA580C' : '#166534',
    },
    badgeGenerating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: '#FEF3C7',
      borderWidth: 1,
      borderColor: '#FDE68A',
    },
    badgeGeneratingText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#92400E',
    },
    badgeWaiting: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: isDark ? '#1C2622' : '#F1F5F9',
    },
    badgeWaitingText: {
      fontSize: 11,
      fontWeight: '600',
      color: MUTED,
    },

    // ─── LARGE PREVIEW CANVAS ───
    canvasFrame: {
      width: '100%',
      minHeight: isWeb ? 480 : 320,
      height: isWeb ? 540 : 420,
      maxHeight: isWeb ? 620 : 520,
      borderRadius: isWeb ? 12 : 18,
      backgroundColor: CANVAS_STUDIO,
      borderWidth: 1,
      borderColor: isDark ? '#2D3748' : '#D0D7DE',
      overflow: 'hidden',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      ...Platform.select({
        web: {
          backgroundImage: isDark
            ? 'radial-gradient(circle at 50% 60%, #252F3E 0%, #171E27 100%)'
            : 'radial-gradient(circle at 50% 60%, #F3F5F7 0%, #E6E9EC 70%, #D8DCE0 100%)',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.04)',
        },
      }),
    },
    // Floating Zoom Controls
    floatingZoomGroup: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 25,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(23, 32, 51, 0.88)' : 'rgba(255, 255, 255, 0.94)',
      borderRadius: isWeb ? 8 : 10,
      borderWidth: 1,
      borderColor: LINE,
      padding: 2,
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)' },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        },
      }),
    },
    zoomButton: {
      width: 32,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomFitButton: {
      width: 'auto',
      paddingHorizontal: 8,
      flexDirection: 'row',
      gap: 4,
    },
    zoomDivider: {
      width: 1,
      height: 16,
      backgroundColor: LINE,
    },
    zoomFitText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#F5F7F6' : '#334155',
    },
    floatingModeTag: {
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 25,
      paddingHorizontal: isWeb ? 9 : 10,
      paddingVertical: isWeb ? 4 : 5,
      borderRadius: isWeb ? 6 : 8,
      backgroundColor: isDark ? 'rgba(23, 32, 51, 0.88)' : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: LINE,
      ...Platform.select({
        web: { boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
      }),
    },
    floatingModeTagText: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: BRAND,
    },
    floatingBeforeAfterSegment: {
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 25,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(241, 245, 249, 0.95)',
      borderRadius: 9,
      padding: 3,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
      }),
    },
    floatingBeforeAfterPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 7,
    },
    floatingBeforeAfterPillActive: {
      backgroundColor: BRAND,
    },
    floatingBeforeAfterPillInactive: {
      backgroundColor: 'transparent',
    },
    floatingBeforeAfterText: {
      fontSize: 12,
      fontWeight: '700',
    },
    floatingBeforeAfterTextActive: {
      color: '#FFFFFF',
    },
    floatingBeforeAfterTextInactive: {
      color: isDark ? '#94A3B8' : '#475569',
    },
    canvasImageWrapper: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    canvasImage: {
      width: '92%',
      height: '90%',
      ...Platform.select({
        web: {
          transition: 'transform 0.15s ease-out',
        },
      }),
    },
    // Empty state inside canvas
    canvasEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    canvasEmptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: BRAND_SOFT,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    canvasEmptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: INK,
      textAlign: 'center',
    },
    canvasEmptyText: {
      fontSize: 13,
      color: MUTED,
      textAlign: 'center',
      maxWidth: 360,
      lineHeight: 18,
    },
    // Loading overlay
    canvasLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(15, 20, 18, 0.85)' : 'rgba(248, 250, 252, 0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      zIndex: 20,
    },
    canvasLoadingCard: {
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 16,
      padding: 22,
      alignItems: 'center',
      gap: 8,
      maxWidth: 420,
      width: '100%',
      ...Platform.select({
        web: { boxShadow: '0 12px 32px rgba(0,0,0,0.1)' },
      }),
    },
    canvasLoadingTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: INK,
      marginTop: 4,
    },
    canvasLoadingSubtitle: {
      fontSize: 12,
      color: MUTED,
      textAlign: 'center',
      lineHeight: 17,
    },
    progressTracker: {
      width: '100%',
      gap: 7,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: LINE,
      paddingTop: 10,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressIcon: {
      width: 16,
      alignItems: 'center',
    },
    progressLabel: {
      fontSize: 11.5,
      color: INK,
    },
    progressLabelActive: {
      fontWeight: '700',
      color: BRAND,
    },
    progressLabelWait: {
      color: '#94A3B8',
    },
    // Error card
    canvasErrorCard: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 24,
      maxWidth: 400,
    },
    canvasErrorTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: '#DC2626',
    },
    canvasErrorMsg: {
      fontSize: 12.5,
      color: INK,
      textAlign: 'center',
      lineHeight: 18,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: BRAND,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 9,
      marginTop: 6,
    },
    retryBtnText: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '700',
    },

    // ─── PRIMARY PREVIEW ACTIONS (DIRECTLY BELOW CANVAS) ───
    previewActionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    generatePrimaryBtn: {
      width: '100%',
      height: isWeb ? 42 : 52,
      borderRadius: isWeb ? 8 : 16,
      backgroundColor: BRAND,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: isWeb ? 16 : 18,
      marginBottom: isWeb ? 10 : 12,
      ...Platform.select({
        web: { boxShadow: '0 4px 14px rgba(234, 88, 12, 0.28)' },
        default: {
          shadowColor: '#EA580C',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.28,
          shadowRadius: 6,
          elevation: 3,
        },
      }),
    },
    generatePrimaryBtnDisabled: {
      backgroundColor: isDark ? '#222E28' : '#E2E8F0',
      shadowOpacity: 0,
      elevation: 0,
    },
    generatePrimaryBtnText: {
      fontSize: isWeb ? 14 : 15,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: isWeb ? -0.1 : -0.2,
    },
    generatePrimaryBtnTextDisabled: {
      color: '#94A3B8',
    },
    // Secondary Action Cards
    secondaryCardsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      marginBottom: 10,
    },
    secondaryCard: {
      flex: 1,
      height: isWeb ? 40 : 48,
      borderRadius: isWeb ? 8 : 14,
      backgroundColor: SURFACE,
      borderWidth: 1.5,
      borderColor: LINE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    secondaryCardDisabled: {
      opacity: 0.5,
      borderColor: LINE,
    },
    secondaryCardText: {
      fontSize: isWeb ? 12.5 : 13,
      fontWeight: '700',
      color: INK,
    },
    secondaryCardTextDisabled: {
      color: '#94A3B8',
    },
    bookInstallCard: {
      borderColor: LINE,
    },
    compareFullBtn: {
      width: '100%',
      height: isWeb ? 40 : 46,
      borderRadius: isWeb ? 8 : 14,
      backgroundColor: SURFACE,
      borderWidth: 1.5,
      borderColor: LINE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 14,
      marginBottom: isWeb ? 10 : 12,
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        },
      }),
    },
    compareFullBtnDisabled: {
      opacity: 0.55,
      backgroundColor: isDark ? '#1A202C' : '#F8FAFC',
    },
    compareFullBtnText: {
      fontSize: isWeb ? 12.5 : 13,
      fontWeight: '700',
      color: INK,
    },
    compareFullBtnTextDisabled: {
      color: '#94A3B8',
    },
    secondaryActionBtn: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      backgroundColor: SURFACE,
      borderWidth: 1.5,
      borderColor: isDark ? '#2E4038' : '#CBD5E1',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 12,
    },
    secondaryActionBtnDisabled: {
      opacity: 0.45,
      borderColor: LINE,
    },
    secondaryActionBtnText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: INK,
    },
    secondaryActionBtnTextDisabled: {
      color: '#94A3B8',
    },
    bookInstallBtn: {
      backgroundColor: BRAND,
      borderColor: BRAND,
    },
    freeInstallBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(22, 101, 52, 0.2)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? '#166534' : '#A7F3D0',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 4,
    },
    freeInstallBannerText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#86EFAC' : '#166534',
    },
    bookingPreviewImg: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: isDark ? '#1C2622' : '#F1F5F9',
    },
    feeChip: {
      alignSelf: 'flex-start',
      backgroundColor: isDark ? 'rgba(77, 184, 150, 0.15)' : '#ECFDF5',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? '#2E4038' : '#A7F3D0',
    },
    feeChipText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: isDark ? '#86EFAC' : '#166534',
    },
    formLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: MUTED,
      marginBottom: 6,
      marginTop: 4,
    },
    formInput: {
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: INK,
      backgroundColor: isDark ? '#16201B' : '#FFFFFF',
      marginBottom: 8,
    },
    branchBtn: {
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
      backgroundColor: isDark ? '#16201B' : '#F8FAFC',
    },
    branchBtnActive: {
      borderColor: BRAND,
      backgroundColor: isDark ? 'rgba(77, 184, 150, 0.12)' : '#F0FDF4',
    },
    branchText: {
      fontSize: 13,
      fontWeight: '700',
      color: INK,
    },
    branchSub: {
      fontSize: 11,
      color: MUTED,
      marginTop: 2,
    },
    slotChip: {
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: isDark ? '#16201B' : '#FFFFFF',
    },
    slotChipActive: {
      borderColor: BRAND,
      backgroundColor: BRAND,
    },
    slotText: {
      fontSize: 12,
      fontWeight: '700',
      color: INK,
    },
    slotTextActive: {
      color: '#FFFFFF',
    },

    // Auxiliary links bar below action buttons
    auxiliaryBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: LINE,
    },
    auxiliarySection: {
      width: '100%',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: LINE,
      gap: 10,
      marginTop: 2,
    },
    usageIndicator: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    usageText: {
      fontSize: 12,
      color: MUTED,
      fontWeight: '600',
    },
    auxiliaryActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    auxActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDark ? '#2D3748' : '#E2E8F0',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: isWeb ? 8 : 10,
    },
    auxActionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: INK,
    },
    auxiliaryButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    auxBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    auxBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: BRAND,
    },

    // Alerts & Banners
    compatWarningAlert: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: '#FFFBEB',
      borderWidth: 1,
      borderColor: '#FDE68A',
      borderRadius: 10,
      padding: 10,
    },
    compatWarningAlertText: {
      flex: 1,
      fontSize: 12,
      color: '#B45309',
      lineHeight: 16,
      fontWeight: '600',
    },
    saveNoticeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#ECFDF5',
      borderColor: '#A7F3D0',
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
    },
    saveNoticeText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#065F46',
      flex: 1,
    },

    // ─── SAVED PREVIEWS MODAL STYLES ───
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalSheet: {
      width: '100%',
      maxWidth: 640,
      maxHeight: '85%',
      backgroundColor: SURFACE,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: LINE,
      ...Platform.select({
        web: { boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: LINE,
      backgroundColor: isDark ? '#18221E' : '#F8FAFC',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: INK,
    },
    modalSub: {
      fontSize: 11.5,
      color: MUTED,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? '#26332E' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalLoading: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    modalEmpty: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: INK,
    },
    emptyBody: {
      fontSize: 12.5,
      color: MUTED,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 17,
    },
    savedCard: {
      flexDirection: 'row',
      backgroundColor: SURFACE,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: LINE,
      overflow: 'hidden',
      padding: 10,
      gap: 12,
    },
    savedCardThumb: {
      width: 90,
      height: 75,
      borderRadius: 8,
      backgroundColor: '#F8FAFC',
    },
    savedCardTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: INK,
    },
    savedCardPart: {
      fontSize: 12,
      color: BRAND,
      fontWeight: '600',
    },
    loadStudioBtn: {
      backgroundColor: BRAND,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    loadStudioBtnText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    iconBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: LINE,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1C2622' : '#F8FAFC',
    },
    floatingPreviewNavBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: BRAND,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginTop: 14,
      marginBottom: 6,
      ...Platform.select({
        web: { boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)' },
        default: { elevation: 3 },
      }),
    },
    floatingPreviewNavBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    floatingSelectNavBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: isDark ? '#1E2A24' : '#FFF7ED',
      borderWidth: 1,
      borderColor: BRAND,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginTop: 14,
    },
    floatingSelectNavBtnText: {
      color: BRAND,
      fontSize: 12.5,
      fontWeight: '700',
    },
  });
}

const lightStylesMobile = createInstallStudioStyles(false, false);
const darkStylesMobile = createInstallStudioStyles(true, false);
const lightStylesWeb = createInstallStudioStyles(false, true);
const darkStylesWeb = createInstallStudioStyles(true, true);
const lightStyles = lightStylesMobile;
const darkStyles = darkStylesMobile;
