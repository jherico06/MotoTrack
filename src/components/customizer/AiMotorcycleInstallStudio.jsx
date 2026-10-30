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
  MAX_SELECTED_PRODUCTS,
  MIN_CANVAS_ZOOM,
  MAX_CANVAS_ZOOM,
  CLICK_ZOOM_TARGET,
  GENERATION_STATES,
  UPLOAD_PART_CATEGORIES,
  bikePhotoUri,
  productImageUri,
  getProductKey,
  normalizeMotorcycle,
  normalizeProduct,
  validateInstallSession,
  evaluateMultiCompatibility,
  buildInstallationPrompt,
  logInstallSessionSelection,
  createInstallResult,
  isInstallablePart,
  clampCanvasPan,
  computeCursorAnchoredZoom,
} from '../../utils/installStudioLogic.js';

const InstallThemeContext = React.createContext({
  styles: {},
  BRAND: '#EA580C',
  MUTED: '#64748B',
  isDark: false,
});

const COMPAT_WARNING =
  'This part may not be compatible with your selected motorcycle. Please verify compatibility before installation.';

const MAX_PRODUCTS_NOTICE = 'You can select a maximum of 3 products.';


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
  const brand = String(bike?.brand || '').trim();
  const model = String(bike?.model || bike?.name || bike?.motorcycle_name || '').trim();
  const year = String(bike?.year || '').trim();

  let combined = model;
  if (brand && (!model || !model.toLowerCase().startsWith(brand.toLowerCase()))) {
    combined = `${brand} ${model}`.trim();
  }
  const spec = [year, combined].filter(Boolean).join(' ');
  return {
    title: nickname || combined || spec || 'Motorcycle',
    spec: nickname ? spec : (year || ''),
    summary: spec || nickname || 'Motorcycle',
    color: String(bike?.color || '').trim(),
    plate: String(bike?.plate_number || '').trim(),
  };
}

function filterUserBikes(all, user) {
  const userId = user?.id || user?.user_id;
  const customerId = user?.customer_id || user?.customerId;
  const email = String(user?.email || user?.customer_email || '').trim().toLowerCase();
  if (!userId && !customerId && !email) return [];
  return (Array.isArray(all) ? all : []).filter((b) => {
    if (String(b.motorcycle_id || '').startsWith('moto-seed-')) return false;
    const bikeEmail = String(b.customer_email || '').trim().toLowerCase();
    const sameUser =
      (userId && (b.user_id === userId || b.customer_id === userId)) ||
      (customerId && (b.customer_id === customerId || b.user_id === customerId)) ||
      (email && bikeEmail === email);
    return Boolean(sameUser);
  });
}

function formatPartPrice(product) {
  const amount = Number(product?.price ?? product?.raw?.price);
  if (!Number.isFinite(amount)) return '';
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatPhpAmount(amount) {
  const num = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `₱${num.toLocaleString(undefined, {
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
  initialSelectedProduct = null,
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
  const { addToCart, showToast } = useCart();
  const { addCustomizationToWishlist } = useWishlist();

  const currentUserId = currentUser?.id || currentUser?.user_id;
  const currentUserEmail = currentUser?.email ? String(currentUser.email).trim().toLowerCase() : '';
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Selection state - initialized from user's registered motorcycles (no synthetic mock bikes)
  const [bikes, setBikes] = useState(() => {
    return motorcycleService.getMotorcycles(currentUser) || [];
  });
  const [selectedBikeId, setSelectedBikeId] = useState(() => {
    const userBikes = motorcycleService.getMotorcycles(currentUser) || [];
    const primary = userBikes.find((b) => b.is_primary) || userBikes[0];
    return primary?.motorcycle_id || primary?.id || '';
  });
  const [bikeOverrideUri, setBikeOverrideUri] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [partMode, setPartMode] = useState('catalog'); // 'catalog' | 'upload'
  const [catalog, setCatalog] = useState([]);
  const [partSearch, setPartSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(() => {
    if (
      initialSelectedProduct &&
      getProductKey(initialSelectedProduct) &&
      isInstallablePart(initialSelectedProduct) &&
      productImage(initialSelectedProduct)
    ) {
      const normalized = normalizeProduct(initialSelectedProduct);
      return normalized ? [normalized] : [];
    }
    return [];
  });
  const selectedProductsRef = useRef(selectedProducts);
  const [limitNotice, setLimitNotice] = useState('');
  const limitNoticeTimerRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const lastInitialProductIdRef = useRef(
    initialSelectedProduct ? getProductKey(initialSelectedProduct) : ''
  );
  const [partUri, setPartUri] = useState(null);
  const [partName, setPartName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');

  useEffect(() => {
    selectedProductsRef.current = selectedProducts;
  }, [selectedProducts]);

  useEffect(() => {
    return () => {
      if (limitNoticeTimerRef.current) {
        clearTimeout(limitNoticeTimerRef.current);
      }
    };
  }, []);

  const triggerLimitNotice = useCallback(() => {
    setLimitNotice(MAX_PRODUCTS_NOTICE);
    showToast?.(MAX_PRODUCTS_NOTICE);
    if (limitNoticeTimerRef.current) {
      clearTimeout(limitNoticeTimerRef.current);
    }
    limitNoticeTimerRef.current = setTimeout(() => {
      setLimitNotice('');
    }, 4500);
  }, [showToast]);

  // Custom prompt & Generation state
  const [customRequest, setCustomRequest] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [generationState, setGenerationState] = useState(GENERATION_STATES.IDLE);
  const [loadingBikes, setLoadingBikes] = useState(() => {
    const userBikes = motorcycleService.getMotorcycles(currentUser) || [];
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
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const canvasViewportRef = useRef(null);
  const zoomStateRef = useRef({ scale: 1, x: 0, y: 0 });
  const panDragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  useEffect(() => {
    zoomStateRef.current = { scale: zoomLevel, x: panOffset.x, y: panOffset.y };
  }, [zoomLevel, panOffset]);

  const resetZoomAndPan = useCallback(() => {
    zoomStateRef.current = { scale: 1, x: 0, y: 0 };
    panDragRef.current.active = false;
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
  }, []);
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
      const rawSessionProducts = Array.isArray(session.selectedProducts)
        ? session.selectedProducts
        : session.selectedProduct
          ? [session.selectedProduct]
          : [];
      if (rawSessionProducts.length > 0) {
        const seen = new Set();
        const hydrated = [];
        for (const item of rawSessionProducts) {
          const key = getProductKey(item);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          hydrated.push(item);
          if (hydrated.length >= MAX_SELECTED_PRODUCTS) break;
        }
        selectedProductsRef.current = hydrated;
        setSelectedProducts(hydrated);
      }
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
      selectedProducts,
      selectedProductId: getProductKey(selectedProducts[0]) || '',
      selectedProduct: selectedProducts[0] || null,
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
    selectedProducts,
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
    setSavedCustomizationId(null);
    setSaveNotice('');
    setPreviewFailed(false);
    setCompatBlocked(false);
    setError('');
    resetZoomAndPan();
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
    const buildItems = Array.isArray(build.items) ? build.items : [];
    const partNames = buildItems
      .map((it) => it?.product_name || it?.name)
      .filter(Boolean);
    const partTitle = partNames.length > 0 ? partNames.join(' + ') : 'Custom Part';

    if (buildItems.length > 0 && catalog.length > 0) {
      const restored = [];
      const seen = new Set();
      for (const it of buildItems) {
        const pid = String(it?.product_id || it?.productId || it?.id || '').trim();
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        const found = catalog.find((c) => getProductKey(c) === pid);
        if (found) {
          const normalized = normalizeProduct(found, {
            compatible_motorcycles: compatMap?.get(pid) || [],
          });
          if (normalized) restored.push(normalized);
        }
        if (restored.length >= MAX_SELECTED_PRODUCTS) break;
      }
      if (restored.length > 0) {
        setPartMode('catalog');
        selectedProductsRef.current = restored;
        setSelectedProducts(restored);
      }
    }

    setLastResult({
      motorcycle_name: bikeTitle,
      product_name: partTitle,
      generated_image_url: img,
      generated_prompt: build.previewPrompt || '',
    });
    setSavedToGarage(true);
    resetZoomAndPan();
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
      const user = currentUserRef.current;
      if (user) {
        await motorcycleService.syncFromSupabase(user);
      }
      const userBikes = motorcycleService.getMotorcycles(user) || [];
      setBikes(userBikes);
      setSelectedBikeId((prev) => {
        if (prev && userBikes.some((b) => b.motorcycle_id === prev)) return prev;
        const primary = userBikes.find((b) => b.is_primary) || userBikes[0];
        return primary?.motorcycle_id || primary?.id || '';
      });
    } catch (_err) {
      console.warn('[InstallStudio] refreshBikes error:', _err);
    } finally {
      setLoadingBikes(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Immediately load any currently available motorcycles from service cache
    const initialUserBikes = motorcycleService.getMotorcycles(currentUser) || [];
    if (initialUserBikes.length > 0) {
      setBikes(initialUserBikes);
      setSelectedBikeId((prev) => {
        if (prev && initialUserBikes.some((b) => b.motorcycle_id === prev)) return prev;
        const primary = initialUserBikes.find((b) => b.is_primary) || initialUserBikes[0];
        return primary?.motorcycle_id || primary?.id || '';
      });
      setLoadingBikes(false);
    }

    // 1. Subscribe to updates in motorcycleService
    const unsub = motorcycleService.subscribe((all) => {
      if (!isMounted) return;
      const userBikes = filterUserBikes(
        all || motorcycleService.getAllMotorcycles() || [],
        currentUserRef.current
      );
      setBikes(userBikes);
      setSelectedBikeId((prev) => {
        if (prev && userBikes.some((b) => b.motorcycle_id === prev)) return prev;
        const primary = userBikes.find((b) => b.is_primary) || userBikes[0];
        return primary?.motorcycle_id || primary?.id || '';
      });
      setLoadingBikes(false);
    });

    // 2. Perform background sync from Supabase and immediately set bikes when resolved
    if (currentUser) {
      motorcycleService
        .syncFromSupabase(currentUser)
        .then(() => {
          if (!isMounted) return;
          const fresh = motorcycleService.getMotorcycles(currentUserRef.current);
          setBikes(fresh);
          setSelectedBikeId((prev) => {
            if (prev && fresh.some((b) => b.motorcycle_id === prev)) return prev;
            const primary = fresh.find((b) => b.is_primary) || fresh[0];
            return primary?.motorcycle_id || primary?.id || '';
          });
        })
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
  }, [currentUserId, currentUserEmail, currentUser]);

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
    });
    compatibilityService.getCompatibilityMap().then((map) => {
      if (!cancelled) setCompatMap(map instanceof Map ? map : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialSelectedProduct) return undefined;
    const initKey = getProductKey(initialSelectedProduct);
    if (!initKey || lastInitialProductIdRef.current === initKey) return undefined;
    if (!isInstallablePart(initialSelectedProduct) || !productImage(initialSelectedProduct)) {
      return undefined;
    }
    lastInitialProductIdRef.current = initKey;
    const rows = compatMap?.get(initKey) || [];
    const normalized = normalizeProduct(initialSelectedProduct, { compatible_motorcycles: rows });
    if (!normalized) return undefined;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setPartMode('catalog');
      setSelectedProducts((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((item) => getProductKey(item) === initKey)) {
          selectedProductsRef.current = list;
          return list;
        }
        const next =
          list.length >= MAX_SELECTED_PRODUCTS
            ? [normalized, ...list.slice(0, MAX_SELECTED_PRODUCTS - 1)]
            : [...list, normalized];
        selectedProductsRef.current = next;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [initialSelectedProduct, compatMap]);

  const selectedBike = useMemo(() => {
    let raw = bikes.find((b) => b.motorcycle_id === selectedBikeId) || null;
    if (!raw && bikes.length > 0) {
      raw = bikes[0];
    }
    return normalizeMotorcycle(raw, bikeOverrideUri);
  }, [bikes, selectedBikeId, bikeOverrideUri]);

  const enrichedSelectedProducts = useMemo(() => {
    if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) return [];
    const seen = new Set();
    const list = [];
    for (const item of selectedProducts) {
      const key = getProductKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const fromCatalog = catalog.find((p) => getProductKey(p) === key) || item?.raw || item;
      const rows =
        compatMap?.get(key) ||
        (Array.isArray(item?.compatible_motorcycles) ? item.compatible_motorcycles : []);
      const normalized = normalizeProduct(fromCatalog, { compatible_motorcycles: rows });
      if (normalized) list.push(normalized);
      if (list.length >= MAX_SELECTED_PRODUCTS) break;
    }
    return list;
  }, [selectedProducts, catalog, compatMap]);

  const uploadedProduct = useMemo(() => {
    if (partMode !== 'upload' || !partUri) return null;
    return normalizeProduct(null, {
      uploadedImage: partUri,
      name: partName,
      category: uploadCategory,
    });
  }, [partMode, partUri, partName, uploadCategory]);

  const activeProducts = useMemo(() => {
    if (partMode === 'upload') {
      return uploadedProduct ? [uploadedProduct] : [];
    }
    return enrichedSelectedProducts;
  }, [partMode, uploadedProduct, enrichedSelectedProducts]);

  const sessionProduct = activeProducts[0] || null;
  const selectedCount = enrichedSelectedProducts.length;
  const isMaxSelectionReached = selectedCount >= MAX_SELECTED_PRODUCTS;
  const selectionProgressPct = Math.min(
    100,
    Math.round((selectedCount / MAX_SELECTED_PRODUCTS) * 100)
  );

  const selectedProductIdsSet = useMemo(
    () => new Set(enrichedSelectedProducts.map((p) => getProductKey(p)).filter(Boolean)),
    [enrichedSelectedProducts]
  );

  const combinedSelectedPrice = useMemo(
    () =>
      enrichedSelectedProducts.reduce(
        (sum, p) => sum + (Number(p?.price ?? p?.raw?.price) || 0),
        0
      ),
    [enrichedSelectedProducts]
  );

  const bikeUri = selectedBike?.motorcycle_image || selectedBike?.image || null;
  const resolvedPartUri = sessionProduct?.product_image || sessionProduct?.image || null;

  const liveCompatWarning = useMemo(() => {
    if (!selectedBike || partMode === 'upload' || enrichedSelectedProducts.length === 0) {
      return '';
    }
    const result = evaluateMultiCompatibility(selectedBike, enrichedSelectedProducts);
    return result.status === 'incompatible' ? result.warning || COMPAT_WARNING : '';
  }, [selectedBike, enrichedSelectedProducts, partMode]);

  const displayCompatWarning = compatWarning || liveCompatWarning;

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

  const resetPreviewOutput = useCallback(() => {
    setResultUri(null);
    setLastResult(null);
    setSavedToGarage(false);
    setSavedCustomizationId(null);
    setSaveNotice('');
    setPreviewFailed(false);
    setCompatBlocked(false);
    setCompatOverride(false);
    setError('');
    setPreviewMode('before');
  }, []);

  const selectBike = (bike) => {
    setGenerationState(GENERATION_STATES.SELECTING);
    setSelectedBikeId(bike.motorcycle_id);
    setBikeOverrideUri(null);
    resetZoomAndPan();
    resetPreviewOutput();
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
      setSavedCustomizationId(null);
      setSaveNotice('');
      setPreviewFailed(false);
      if (selectedBike?.motorcycle_id) {
        motorcycleService.updateMotorcycle(selectedBike.motorcycle_id, { photo_url: res.uri }).catch(() => {});
      }
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
      setPartUri(res.uri);
      setPartName('');
      setUploadCategory('');
      resetPreviewOutput();
      setCompatWarning('');
      setGenerationState(GENERATION_STATES.IDLE);
      if (!isWide) {
        setMobileTab('preview');
      }
    } else if (res?.error && !/cancel/i.test(res.error)) {
      setError(res.error);
    }
  };

  const selectCatalogPart = useCallback(
    (product) => {
      if (loading || !product) return;
      const nextId = getProductKey(product);
      if (!nextId) return;

      setPartMode('catalog');
      setPartUri(null);
      setUploadCategory('');

      const currentList = Array.isArray(selectedProductsRef.current)
        ? selectedProductsRef.current
        : [];
      const alreadySelected = currentList.some((item) => getProductKey(item) === nextId);

      // Toggle off deselects product while keeping motorcycle and remaining selections intact
      if (alreadySelected) {
        const nextList = currentList.filter((item) => getProductKey(item) !== nextId);
        selectedProductsRef.current = nextList;
        setSelectedProducts(nextList);
        setLimitNotice('');
        resetPreviewOutput();
        return;
      }

      // Enforce strict maximum of 3 products
      if (currentList.length >= MAX_SELECTED_PRODUCTS) {
        triggerLimitNotice();
        return;
      }

      const rows = compatMap?.get(nextId) || [];
      const nextProduct = normalizeProduct(product, { compatible_motorcycles: rows });
      if (!nextProduct) return;

      const nextList = [...currentList, nextProduct].slice(0, MAX_SELECTED_PRODUCTS);
      selectedProductsRef.current = nextList;
      setSelectedProducts(nextList);
      setPartName(nextProduct.name || '');
      setLimitNotice('');
      resetPreviewOutput();
    },
    [loading, compatMap, resetPreviewOutput, triggerLimitNotice]
  );

  const removeSelectedProduct = useCallback(
    (productId) => {
      if (loading) return;
      const targetKey = String(productId || '').trim();
      if (!targetKey) return;
      const currentList = Array.isArray(selectedProductsRef.current)
        ? selectedProductsRef.current
        : [];
      const nextList = currentList.filter((item) => getProductKey(item) !== targetKey);
      if (nextList.length === currentList.length) return;
      selectedProductsRef.current = nextList;
      setSelectedProducts(nextList);
      setLimitNotice('');
      resetPreviewOutput();
    },
    [loading, resetPreviewOutput]
  );

  const clearSelectedProducts = useCallback(() => {
    if (loading) return;
    if (!selectedProductsRef.current?.length) return;
    selectedProductsRef.current = [];
    setSelectedProducts([]);
    setLimitNotice('');
    resetPreviewOutput();
  }, [loading, resetPreviewOutput]);

  const handleGenerate = async ({ forceCompatOverride = false } = {}) => {
    if (isSubmittingRef.current || loading) {
      return;
    }

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

    if (partMode === 'catalog' && enrichedSelectedProducts.length > MAX_SELECTED_PRODUCTS) {
      triggerLimitNotice();
      setError(MAX_PRODUCTS_NOTICE);
      return;
    }

    isSubmittingRef.current = true;
    try {
      setGenerationState(GENERATION_STATES.VALIDATING);
      setError('');
      setPreviewFailed(false);

      const motorcycle = selectedBike;
      const productsToInstall = activeProducts;

      const validation = validateInstallSession({
        motorcycle,
        products: productsToInstall,
        partMode,
        uploadCategory,
      });
      if (!validation.ok) {
        setGenerationState(GENERATION_STATES.IDLE);
        setError(validation.message);
        if (validation.message === MAX_PRODUCTS_NOTICE) {
          triggerLimitNotice();
        }
        return;
      }

      const compat = evaluateMultiCompatibility(motorcycle, productsToInstall);
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

      if (!isWide) {
        setMobileTab('preview');
      }

      const accessoryNames = productsToInstall.map(
        (p) => p.product_name || p.name || 'accessory'
      );
      const accessorySummary = accessoryNames.join(' + ');
      const bikeName = bikeLabel(motorcycle);
      const installationPrompt = buildInstallationPrompt({
        motorcycle,
        products: productsToInstall,
        customNotes: customRequest,
        compatibilityNote:
          compat.status === 'unavailable'
            ? compat.instructAi ||
              'Compatibility information is unavailable. Prioritize a mechanically realistic installation for this motorcycle and all selected parts.'
            : compat.status === 'incompatible'
              ? 'Compatibility warning acknowledged by customer. Still prioritize a mechanically realistic installation if possible.'
              : '',
      });

      logInstallSessionSelection({ motorcycle, products: productsToInstall });

      setGenerationState(GENERATION_STATES.PREPARING);
      setInfo(`Installing ${accessorySummary} on ${bikeName}…`);
      setResultUri(null);
      setSavedToGarage(false);
      setSavedCustomizationId(null);
      setSaveNotice('');

      const currentUid = currentUser?.id || currentUser?.user_id || 'usr-customer-01';
      const partUris = productsToInstall
        .map((p) => p.product_image || p.image)
        .filter(Boolean);

      setGenerationState(GENERATION_STATES.GENERATING);
      const result = await requestMotorcycleCustomization({
        userId: currentUid,
        bikeUri: motorcycle.motorcycle_image || motorcycle.image,
        partUri: partUris[0],
        partUris,
        installationPrompt,
        customRequest: installationPrompt,
        selectionMeta: {
          userId: currentUid,
          motorcycleId: motorcycle.motorcycle_id || motorcycle.id,
          motorcycleName: motorcycle.motorcycle_name || motorcycle.name,
          motorcycleImage: motorcycle.motorcycle_image || motorcycle.image,
          productId: productsToInstall[0]?.product_id || productsToInstall[0]?.id,
          productName: accessorySummary,
          productImage: partUris[0],
          productIds: productsToInstall.map((p) => p.product_id || p.id).filter(Boolean),
          products: productsToInstall.map((p) => ({
            id: p.product_id || p.id,
            product_id: p.product_id || p.id,
            name: p.product_name || p.name || 'Accessory',
            brand: p.brand || '',
            category: p.category || '',
            price: Number(p.price ?? p.raw?.price) || 0,
            image: p.product_image || p.image || '',
            position: p.position || '',
            type: p.type || '',
          })),
        },
      });

      if (!result.success) {
        if (result.code === 'MAX_PRODUCTS_EXCEEDED') {
          triggerLimitNotice();
        }
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
        products: productsToInstall,
        generatedImageUrl: result.previewImageUrl,
        generatedPrompt: result.promptUsed || installationPrompt,
        cameraView: productsToInstall[0]?.camera_view,
      });

      setLastResult(persisted);
      setPreviewFailed(false);
      setResultUri(result.previewImageUrl);
      setPromptUsed(result.promptUsed || installationPrompt);
      setModelUsed(result.model || '');
      setPreviewMode('after');
      setGenerationState(GENERATION_STATES.COMPLETED);
      setInfo(`Done — ${accessorySummary} installed on ${bikeName}.`);
    } finally {
      isSubmittingRef.current = false;
    }
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
    setInfo('Motorcycle registered. Choose up to 3 parts to install on it.');
  };

  const activePartDisplayNames = useMemo(
    () => activeProducts.map((p) => p.product_name || p.name || 'Accessory').filter(Boolean),
    [activeProducts]
  );
  const partDisplayName = activePartDisplayNames.join(' + ');
  const partBrand =
    partMode === 'catalog'
      ? enrichedSelectedProducts.length > 1
        ? `Selected: ${selectedCount}/${MAX_SELECTED_PRODUCTS}`
        : sessionProduct?.brand || sessionProduct?.category || 'Universal'
      : uploadCategory || 'Custom Part';
  const partPrice =
    partMode === 'catalog'
      ? enrichedSelectedProducts.length > 1
        ? `Combined: ${formatPhpAmount(combinedSelectedPrice)}`
        : formatPartPrice(sessionProduct?.raw || sessionProduct)
      : '';
  const readyToGenerate = Boolean(
    selectedBike &&
      bikeUri &&
      activeProducts.length > 0 &&
      activeProducts.length <= MAX_SELECTED_PRODUCTS &&
      activeProducts.every((p) => Boolean(p?.product_image || p?.image)) &&
      (partMode !== 'upload' || Boolean(uploadCategory))
  );

  const isWeeklyLimitReached = !aiUsage.isAdmin && aiUsage.weeklyUsed >= (aiUsage.weeklyLimit || 3);
  const isConsecutiveCooldown = !aiUsage.isAdmin && aiUsage.isCooldownActive;
  const isGenerationBlocked = isWeeklyLimitReached || isConsecutiveCooldown;

  const canAddToCart =
    partMode === 'catalog' && enrichedSelectedProducts.some((p) => Boolean(p?.raw || p));
  const friendlyError = (() => {
    const raw = String(error || '');
    if (!raw) return '';
    if (raw === MAX_PRODUCTS_NOTICE) {
      return raw;
    }
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
    let added = 0;
    enrichedSelectedProducts.forEach((item) => {
      const cartProduct = item?.raw || item;
      if (cartProduct) {
        addToCart(cartProduct, 1);
        added += 1;
      }
    });
    if (!added) return;
    setSaveNotice(
      added === 1 ? '✓ Part added to cart!' : `✓ ${added} selected parts added to cart!`
    );
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
        partDisplayName ||
        'custom_parts';
      const safeBike = bikeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const safePart = pName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48).replace(/^_+|_+$/g, '');
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
      partDisplayName ||
      partName ||
      'Custom Part';
    const setupName = `${bikeTitle} with ${pTitle}`;
    const items =
      partMode === 'catalog' && enrichedSelectedProducts.length > 0
        ? enrichedSelectedProducts.map((item) => {
            const raw = item?.raw || item;
            return {
              productId: raw.product_id || raw.id || item.product_id || item.id,
              quantity: 1,
              price: Number(raw.price ?? item.price) || 0,
              name: raw.name || raw.product_name || item.product_name || item.name || 'Accessory',
              brand: raw.brand || item.brand || '',
              category: raw.category || item.category || '',
            };
          })
        : partMode === 'upload' && uploadedProduct
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

  const selectedProductIdsKey = useMemo(() => {
    if (partMode !== 'catalog') return '';
    return enrichedSelectedProducts
      .map((p) => getProductKey(p))
      .filter(Boolean)
      .join(',');
  }, [partMode, enrichedSelectedProducts]);

  // Detect Free Installation promo across selected catalog parts
  useEffect(() => {
    if (!selectedProductIdsKey) return undefined;
    let cancelled = false;
    const ids = selectedProductIdsKey.split(',').filter(Boolean);
    promoService
      .findApplicableFreeInstallation(ids)
      .then((match) => {
        if (!cancelled) setFreeInstallPromo(match);
      })
      .catch(() => {
        if (!cancelled) setFreeInstallPromo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProductIdsKey]);

  const effectiveFreeInstallPromo = selectedProductIdsKey ? freeInstallPromo : null;

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

  const getViewportRect = useCallback((fallbackEl = null) => {
    const el =
      (canvasViewportRef.current &&
        typeof canvasViewportRef.current.getBoundingClientRect === 'function' &&
        canvasViewportRef.current) ||
      (fallbackEl &&
        typeof fallbackEl.getBoundingClientRect === 'function' &&
        fallbackEl) ||
      null;
    if (!el) {
      return { left: 0, top: 0, width: 640, height: 540 };
    }
    const rect = el.getBoundingClientRect();
    return {
      left: Number(rect.left) || 0,
      top: Number(rect.top) || 0,
      width: Number(rect.width) || 640,
      height: Number(rect.height) || 540,
    };
  }, []);

  const applyZoomAtPoint = useCallback(
    (targetScale, cursorOffsetX = 0, cursorOffsetY = 0, rectOverride = null) => {
      const prev = zoomStateRef.current;
      const rect = rectOverride || getViewportRect();
      const next = computeCursorAnchoredZoom({
        prevScale: prev.scale,
        prevX: prev.x,
        prevY: prev.y,
        targetScale,
        cursorOffsetX,
        cursorOffsetY,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
      });
      zoomStateRef.current = next;
      setZoomLevel(next.scale);
      setPanOffset({ x: next.x, y: next.y });
    },
    [getViewportRect]
  );

  // Zoom controls (top-right buttons remain synced with cursor zoom & pan bounds)
  const handleZoomIn = useCallback(() => {
    const nextTarget = Math.round((zoomStateRef.current.scale + 0.25) * 100) / 100;
    applyZoomAtPoint(nextTarget, 0, 0);
  }, [applyZoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    const nextTarget = Math.round((zoomStateRef.current.scale - 0.25) * 100) / 100;
    applyZoomAtPoint(nextTarget, 0, 0);
  }, [applyZoomAtPoint]);

  const handleFitScreen = useCallback(() => {
    resetZoomAndPan();
  }, [resetZoomAndPan]);

  // Web cursor-anchored mouse wheel & trackpad pinch zoom (non-passive to prevent page scroll)
  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasDisplayUri || loading || previewFailed) {
      return undefined;
    }
    const node = canvasViewportRef.current;
    if (!node || typeof node.addEventListener !== 'function') {
      return undefined;
    }

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = getViewportRect(node);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const cursorOffsetX = e.clientX - centerX;
      const cursorOffsetY = e.clientY - centerY;

      const normalizedDelta =
        e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * 120 : e.deltaY;
      const clampedDelta = Math.max(-180, Math.min(180, normalizedDelta));
      const sensitivity = e.ctrlKey ? 0.01 : 0.0024;
      const factor = Math.exp(-clampedDelta * sensitivity);

      applyZoomAtPoint(
        zoomStateRef.current.scale * factor,
        cursorOffsetX,
        cursorOffsetY,
        rect
      );
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
    };
  }, [canvasDisplayUri, loading, previewFailed, applyZoomAtPoint, getViewportRect]);

  const handleCanvasPointerDown = useCallback((e) => {
    if (Platform.OS !== 'web') return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault?.();
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch (_err) {
      // Ignore pointer capture errors on synthetic/unsupported targets
    }
    panDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: zoomStateRef.current.x,
      originY: zoomStateRef.current.y,
      moved: false,
    };
  }, []);

  const handleCanvasPointerMove = useCallback(
    (e) => {
      if (Platform.OS !== 'web') return;
      const drag = panDragRef.current;
      if (
        !drag.active ||
        (drag.pointerId != null && e.pointerId != null && drag.pointerId !== e.pointerId)
      ) {
        return;
      }
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        if (zoomStateRef.current.scale > 1.01) {
          setIsPanning(true);
        }
      }

      if (drag.moved && zoomStateRef.current.scale > 1.01) {
        const rect = getViewportRect(e.currentTarget);
        const nextPan = clampCanvasPan(
          drag.originX + dx,
          drag.originY + dy,
          zoomStateRef.current.scale,
          rect.width,
          rect.height
        );
        zoomStateRef.current = {
          scale: zoomStateRef.current.scale,
          x: nextPan.x,
          y: nextPan.y,
        };
        setPanOffset(nextPan);
      }
    },
    [getViewportRect]
  );

  const handleCanvasPointerUp = useCallback(
    (e) => {
      if (Platform.OS !== 'web') return;
      const drag = panDragRef.current;
      if (!drag.active) return;
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch (_err) {
        // Ignore release errors
      }
      const wasMoved = drag.moved;
      panDragRef.current.active = false;
      setIsPanning(false);

      // Clean click without dragging: zoom in to 200% anchored at cursor, or reset to 100% Fit
      if (!wasMoved) {
        const rect = getViewportRect(e.currentTarget);
        const cursorOffsetX = e.clientX - (rect.left + rect.width / 2);
        const cursorOffsetY = e.clientY - (rect.top + rect.height / 2);
        if (zoomStateRef.current.scale <= 1.05) {
          applyZoomAtPoint(CLICK_ZOOM_TARGET, cursorOffsetX, cursorOffsetY, rect);
        } else {
          resetZoomAndPan();
        }
      }
    },
    [applyZoomAtPoint, getViewportRect, resetZoomAndPan]
  );

  const handleCanvasPointerCancel = useCallback((e) => {
    if (Platform.OS !== 'web') return;
    if (!panDragRef.current.active) return;
    try {
      e?.currentTarget?.releasePointerCapture?.(e?.pointerId);
    } catch (_err) {
      // Ignore release errors
    }
    panDragRef.current.active = false;
    setIsPanning(false);
  }, []);

  // Compare Original action (preserves cursor zoom & pan for pixel-level Before/After comparison)
  const handleToggleCompare = () => {
    if (!resultUri) return;
    setPreviewMode((prev) => (prev === 'before' ? 'after' : 'before'));
  };

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
            <BootstrapIcon name="bicycle" size={24} color={BRAND} />
            <Text style={styles.emptySidebarTitle}>No registered motorcycles</Text>
            <Text style={styles.emptySidebarSubtext}>
              {currentUser
                ? 'Register your motorcycle to test aftermarket parts and generate AI installation previews.'
                : 'Sign in to access your registered garage motorcycles.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyRegisterBtn}
              onPress={openRegister}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyRegisterBtnText}>
                {currentUser ? '+ Register Motorcycle' : 'Sign In to Register'}
              </Text>
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
        <View style={styles.sidebarCardHeader}>
          <Text style={styles.sidebarTitle}>2. Select part to install</Text>
          {partMode === 'catalog' ? (
            <View
              style={[
                styles.selectionCounterPill,
                selectedCount > 0 && styles.selectionCounterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.selectionCounterText,
                  selectedCount > 0 && styles.selectionCounterTextActive,
                ]}
              >
                Selected: {selectedCount}/{MAX_SELECTED_PRODUCTS}
              </Text>
            </View>
          ) : null}
        </View>

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
            {/* Subtle Progress Indicator for 3-Product Limit */}
            <View style={styles.selectionLimitBlock}>
              <View
                style={styles.selectionProgressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: MAX_SELECTED_PRODUCTS,
                  now: selectedCount,
                }}
              >
                <View
                  style={[
                    styles.selectionProgressFill,
                    { width: `${selectionProgressPct}%` },
                  ]}
                />
              </View>
              <View style={styles.selectionLimitMetaRow}>
                <Text
                  style={[
                    styles.selectionLimitCaption,
                    isMaxSelectionReached && styles.selectionLimitCaptionFull,
                  ]}
                >
                  {isMaxSelectionReached
                    ? 'Maximum 3/3 selected — deselect a part to change'
                    : 'Select up to 3 products for one combined preview'}
                </Text>
                {selectedCount > 0 ? (
                  <TouchableOpacity
                    onPress={clearSelectedProducts}
                    disabled={loading}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all selected products"
                  >
                    <Text style={styles.clearSelectionLink}>Clear all</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Max Limit Notification Banner */}
            {limitNotice ? (
              <View
                style={styles.maxLimitNoticeBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <BootstrapIcon name="exclamation-circle-fill" size={14} color={BRAND} />
                <Text style={styles.maxLimitNoticeText}>{limitNotice}</Text>
                <TouchableOpacity
                  onPress={() => setLimitNotice('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Dismiss limit notification"
                >
                  <BootstrapIcon name="x" size={15} color={MUTED} />
                </TouchableOpacity>
              </View>
            ) : null}

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
                  const id = getProductKey(product);
                  const selected =
                    partMode === 'catalog' && Boolean(id) && selectedProductIdsSet.has(id);
                  const limitLocked =
                    partMode === 'catalog' && !selected && isMaxSelectionReached;
                  const img = productImage(product);
                  const price = formatPartPrice(product);
                  const badgeLabel = product.brand || product.category || 'Universal';
                  return (
                    <View key={id} style={styles.partSlot}>
                      <TouchableOpacity
                        style={[
                          styles.partCard,
                          selected && styles.partCardSelected,
                          limitLocked && styles.partCardLimitReached,
                        ]}
                        onPress={() => selectCatalogPart(product)}
                        disabled={loading}
                        activeOpacity={limitLocked ? 0.96 : 0.88}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: loading }}
                        accessibilityLabel={`${product.name}, ${price || ''}${selected ? ', Selected' : limitLocked ? ', Limit reached' : ''}`}
                      >
                        <View style={styles.partImageWrap}>
                          <Image source={{ uri: img }} style={styles.partThumb} resizeMode="cover" />
                          {selected ? (
                            <View style={styles.checkBadge}>
                              <BootstrapIcon name="check" size={12} color="#FFFFFF" />
                            </View>
                          ) : limitLocked ? (
                            <View style={styles.limitLockBadge}>
                              <Text style={styles.limitLockBadgeText}>Max 3</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.partTitle} numberOfLines={2}>
                          {product.name}
                        </Text>
                        {price ? <Text style={styles.partPrice}>{price}</Text> : null}
                        <View style={styles.partCardFooterRow}>
                          <View style={styles.badgePill}>
                            <Text style={styles.badgePillText} numberOfLines={1}>
                              {badgeLabel}
                            </Text>
                          </View>
                          {selected ? (
                            <View style={styles.selectedStateTag}>
                              <Text style={styles.selectedStateTagText}>Selected</Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Selected Products Summary */}
            <View style={styles.selectedSummaryCard}>
              <View style={styles.selectedSummaryHeader}>
                <Text style={styles.selectedSummaryTitle}>Selected Products</Text>
                <Text style={styles.selectedSummaryCount}>
                  Selected: {selectedCount}/{MAX_SELECTED_PRODUCTS}
                </Text>
              </View>

              {enrichedSelectedProducts.length === 0 ? (
                <Text style={styles.selectedSummaryEmpty}>
                  No products selected yet. Choose up to 3 parts from the catalog above.
                </Text>
              ) : (
                <View style={styles.selectedSummaryList}>
                  {enrichedSelectedProducts.map((item) => {
                    const itemKey = getProductKey(item);
                    const itemThumb =
                      item.product_image || item.image || productImage(item.raw);
                    const itemName = item.product_name || item.name || 'Accessory';
                    const itemBrand =
                      item.brand || item.raw?.brand || item.category || 'MotoTrack';
                    const itemPrice =
                      formatPartPrice(item.raw || item) || formatPhpAmount(0);
                    return (
                      <View key={itemKey} style={styles.selectedSummaryRow}>
                        {itemThumb ? (
                          <Image
                            source={{ uri: itemThumb }}
                            style={styles.selectedSummaryThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.selectedSummaryThumb, styles.imageFallback]}>
                            <BootstrapIcon name="gear" size={14} color={BRAND} />
                          </View>
                        )}
                        <View style={styles.selectedSummaryInfo}>
                          <Text style={styles.selectedSummaryName} numberOfLines={1}>
                            {itemName}
                          </Text>
                          <Text style={styles.selectedSummaryBrand} numberOfLines={1}>
                            {itemBrand}
                          </Text>
                        </View>
                        <Text style={styles.selectedSummaryPrice}>{itemPrice}</Text>
                        <TouchableOpacity
                          style={styles.selectedSummaryRemoveBtn}
                          onPress={() => removeSelectedProduct(itemKey)}
                          disabled={loading}
                          activeOpacity={0.75}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${itemName}`}
                        >
                          <BootstrapIcon name="x" size={15} color={MUTED} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.selectedSummaryTotalRow}>
                <Text style={styles.selectedSummaryTotalLabel}>Combined Price</Text>
                <Text style={styles.selectedSummaryTotalValue}>
                  {formatPhpAmount(combinedSelectedPrice)}
                </Text>
              </View>

              {friendlyError && !previewFailed ? (
                <View style={styles.inlineValidationAlert}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7, flex: 1 }}>
                    <BootstrapIcon name="exclamation-circle-fill" size={14} color="#DC2626" />
                    <Text style={styles.inlineValidationText}>{friendlyError}</Text>
                  </View>
                  {compatBlocked ? (
                    <TouchableOpacity
                      style={styles.inlineOverrideBtn}
                      onPress={() => {
                        setCompatOverride(true);
                        handleGenerate({ forceCompatOverride: true });
                      }}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.inlineOverrideBtnText}>Install Anyway</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.installSelectedBtn,
                  (selectedCount === 0 || isGenerationBlocked || loading) &&
                    styles.installSelectedBtnDisabled,
                ]}
                onPress={() => handleGenerate()}
                disabled={selectedCount === 0 || isGenerationBlocked || loading}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: selectedCount === 0 || isGenerationBlocked || loading,
                }}
                accessibilityLabel="Install Selected Parts"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <BootstrapIcon
                    name="stars"
                    size={15}
                    color={
                      selectedCount === 0 || isGenerationBlocked || loading
                        ? '#94A3B8'
                        : '#FFFFFF'
                    }
                  />
                )}
                <Text
                  style={[
                    styles.installSelectedBtnText,
                    (selectedCount === 0 || isGenerationBlocked || loading) &&
                      styles.installSelectedBtnTextDisabled,
                  ]}
                >
                  {loading
                    ? 'Installing Selected Parts...'
                    : isConsecutiveCooldown
                    ? `Cooldown (${cooldownCountdown || 'wait'})`
                    : isWeeklyLimitReached
                    ? 'Weekly Limit Reached (3 / 3)'
                    : 'Install Selected Parts'}
                </Text>
              </TouchableOpacity>
            </View>
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
          if (sessionProduct?.raw || sessionProduct) {
            setViewingPartDetails(sessionProduct?.raw || sessionProduct);
          } else {
            setMobileTab('selection');
          }
        }}
        activeOpacity={0.88}
        accessibilityLabel={
          activeProducts.length > 0
            ? `Selected parts: ${partDisplayName || 'Accessory'}, ${partBrand} · ${partPrice || ''}. Status: ${readyToGenerate ? 'Preview Ready' : 'Incomplete Selection'}.`
            : 'No part selected. Tap to browse catalog or upload a part.'
        }
      >
        <View style={styles.partInfoLeft}>
          {activeProducts.length > 1 ? (
            <View style={styles.partInfoThumbGroup}>
              {activeProducts.slice(0, MAX_SELECTED_PRODUCTS).map((item, idx) => {
                const thumbUri = item.product_image || item.image || productImage(item.raw);
                return thumbUri ? (
                  <Image
                    key={getProductKey(item) || idx}
                    source={{ uri: thumbUri }}
                    style={[
                      styles.partInfoMultiThumb,
                      idx > 0 && styles.partInfoMultiThumbOverlap,
                    ]}
                    resizeMode="cover"
                  />
                ) : null;
              })}
            </View>
          ) : resolvedPartUri ? (
            <Image source={{ uri: resolvedPartUri }} style={styles.partInfoThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.partInfoThumb, styles.partInfoFallback]}>
              <BootstrapIcon name="gear" size={18} color={BRAND} />
            </View>
          )}
          <View style={styles.partInfoMeta}>
            <Text style={styles.partInfoName} numberOfLines={1}>
              {activeProducts.length > 0 ? partDisplayName || 'Accessory' : 'No Parts Selected'}
            </Text>
            <Text style={styles.partInfoBrandPrice} numberOfLines={1}>
              {activeProducts.length > 0
                ? partMode === 'catalog' && selectedCount === 1
                  ? `${partBrand}${partPrice ? ` · ${partPrice}` : ''} · Selected: 1/${MAX_SELECTED_PRODUCTS}`
                  : `${partBrand}${partPrice ? ` · ${partPrice}` : ''}`
                : 'Select up to 3 parts from catalog or upload a photo'}
            </Text>
          </View>
        </View>

        <View style={styles.partInfoRight}>
          <View style={[styles.statusReadyBadge, !readyToGenerate && styles.statusPendingBadge]}>
            <View style={[styles.statusReadyDot, !readyToGenerate && styles.statusPendingDot]} />
            <Text style={[styles.statusReadyText, !readyToGenerate && styles.statusPendingText]}>
              {readyToGenerate
                ? 'Preview Ready'
                : !selectedBike
                ? 'Select Motorcycle'
                : activeProducts.length === 0
                ? 'Select Part'
                : 'Setup Incomplete'}
            </Text>
          </View>
          <BootstrapIcon name="chevron-right" size={15} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {/* Compatibility Warning if present */}
      {displayCompatWarning ? (
        <View style={styles.compatWarningAlert}>
          <BootstrapIcon name="exclamation-triangle-fill" size={15} color="#B45309" />
          <Text style={styles.compatWarningAlertText}>{displayCompatWarning}</Text>
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

        {/* Floating Zoom Controls: Zoom Out / % / Zoom In / Fit (Upper-Right) */}
        <View style={styles.floatingZoomGroup}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomOut}
            disabled={zoomLevel <= MIN_CANVAS_ZOOM}
            activeOpacity={0.7}
            accessibilityLabel="Zoom Out"
          >
            <BootstrapIcon
              name="dash"
              size={16}
              color={
                zoomLevel <= MIN_CANVAS_ZOOM
                  ? '#94A3B8'
                  : isDarkMode
                    ? '#F8FAFC'
                    : '#172033'
              }
            />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <View style={styles.zoomReadoutBox} pointerEvents="none">
            <Text style={styles.zoomLevelReadout}>{Math.round(zoomLevel * 100)}%</Text>
          </View>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomIn}
            disabled={zoomLevel >= MAX_CANVAS_ZOOM}
            activeOpacity={0.7}
            accessibilityLabel="Zoom In"
          >
            <BootstrapIcon
              name="plus"
              size={16}
              color={
                zoomLevel >= MAX_CANVAS_ZOOM
                  ? '#94A3B8'
                  : isDarkMode
                    ? '#F8FAFC'
                    : '#172033'
              }
            />
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

        {Platform.OS === 'web' && canvasDisplayUri && !loading && !previewFailed ? (
          <View pointerEvents="none" style={styles.floatingZoomHint}>
            <BootstrapIcon
              name={zoomLevel > 1.05 ? 'arrows-move' : 'zoom-in'}
              size={11}
              color={BRAND}
            />
            <Text style={styles.floatingZoomHintText}>
              {zoomLevel > 1.05
                ? 'Drag to pan · Scroll to zoom · Click to reset'
                : 'Scroll or click to zoom at cursor'}
            </Text>
          </View>
        ) : null}

        {/* Canvas Display Content */}
        {loading ? (
          <View style={styles.canvasLoadingOverlay}>
            <View style={styles.canvasLoadingCard}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.canvasLoadingTitle}>AI Installation In Progress</Text>
              <Text style={styles.canvasLoadingSubtitle}>
                Precision-fitting {partDisplayName || 'selected parts'} onto {selectedBike?.nickname || selectedBike?.name || 'motorcycle'}...
              </Text>
              <GenerationProgress phase={genPhase} partCount={activeProducts.length} />
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
          <View
            ref={canvasViewportRef}
            style={[
              styles.canvasImageWrapper,
              Platform.OS === 'web' &&
                (isPanning
                  ? styles.canvasImageWrapperPanning
                  : zoomLevel > 1.05
                    ? styles.canvasImageWrapperZoomed
                    : styles.canvasImageWrapperZoomable),
            ]}
            {...(Platform.OS === 'web'
              ? {
                  onPointerDown: handleCanvasPointerDown,
                  onPointerMove: handleCanvasPointerMove,
                  onPointerUp: handleCanvasPointerUp,
                  onPointerCancel: handleCanvasPointerCancel,
                  onLostPointerCapture: handleCanvasPointerCancel,
                }
              : {})}
          >
            <Image
              source={{ uri: canvasDisplayUri }}
              draggable={false}
              pointerEvents="none"
              style={[
                styles.canvasImage,
                isPanning && styles.canvasImagePanning,
                {
                  transform: [
                    { translateX: panOffset.x },
                    { translateY: panOffset.y },
                    { scale: zoomLevel },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.canvasEmptyState}>
            <View style={styles.canvasEmptyIcon}>
              <BootstrapIcon
                name={previewMode === 'after' ? 'stars' : 'bicycle'}
                size={38}
                color={BRAND}
              />
            </View>
            <Text style={styles.canvasEmptyTitle}>
              {previewMode === 'after'
                ? 'No AI Installation Result Yet'
                : !selectedBike
                ? 'No Motorcycle Selected'
                : 'No Photo Available'}
            </Text>
            <Text style={styles.canvasEmptyText}>
              {previewMode === 'after'
                ? 'Click "Generate Preview" below to view the AI installation result, or switch to "Before" to view the original motorcycle.'
                : !selectedBike
                ? (currentUser
                    ? 'Register or select your motorcycle on the left to preview it here.'
                    : 'Sign in and register your motorcycle to see it on the preview canvas.')
                : 'Please add a photo of your registered motorcycle to view it on the canvas.'}
            </Text>
            {!selectedBike ? (
              <TouchableOpacity
                style={styles.emptyCanvasRegisterBtn}
                onPress={openRegister}
                activeOpacity={0.85}
              >
                <BootstrapIcon name={currentUser ? "plus-circle" : "person-fill"} size={14} color="#FFFFFF" />
                <Text style={styles.emptyCanvasRegisterBtnText}>
                  {currentUser ? 'Register Motorcycle' : 'Sign In to Register'}
                </Text>
              </TouchableOpacity>
            ) : !bikeUri && (
              <TouchableOpacity
                style={styles.emptyCanvasRegisterBtn}
                onPress={pickBikeOverride}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="camera-fill" size={14} color="#FFFFFF" />
                <Text style={styles.emptyCanvasRegisterBtnText}>
                  Upload Photo for this Motorcycle
                </Text>
              </TouchableOpacity>
            )}
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
            {effectiveFreeInstallPromo ? 'Book Free Install' : 'Book Installation'}
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

      {effectiveFreeInstallPromo && resultUri ? (
        <View style={styles.freeInstallBanner}>
          <BootstrapIcon name="gift" size={13} color="#166534" />
          <Text style={styles.freeInstallBannerText}>
            Free Installation promo active for this part ({effectiveFreeInstallPromo.code})
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
              <Text style={styles.auxActionBtnText}>
                {selectedCount > 1 ? `Add Selected Parts to Cart (${selectedCount})` : 'Add Part to Cart'}
              </Text>
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

  const viewingPartKey = viewingPartDetails ? getProductKey(viewingPartDetails) : '';
  const isViewingPartSelected = Boolean(viewingPartKey && selectedProductIdsSet.has(viewingPartKey));
  const isViewingPartAtLimit = !isViewingPartSelected && isMaxSelectionReached;

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
            {viewingPartDetails ? (
              <View style={[styles.modalSheet, { maxWidth: 420, padding: 18, gap: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#172033' }}>
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
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#172033' }}>
                    {viewingPartDetails.name || viewingPartDetails.product_name}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '500' }}>
                    {viewingPartDetails.brand} · {viewingPartDetails.category || 'Accessory'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#EA580C', fontVariant: ['tabular-nums'] }}>
                    {formatPartPrice(viewingPartDetails)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <BootstrapIcon name="check-circle-fill" size={14} color="#10B981" />
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#065F46' }}>
                    Fits {selectedBike?.nickname || selectedBike?.name || 'Selected Motorcycle'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: isViewingPartSelected
                      ? '#24272B'
                      : isViewingPartAtLimit
                      ? '#CBD5E1'
                      : '#EA580C',
                    height: 46,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 6,
                  }}
                  onPress={() => {
                    if (isViewingPartSelected) {
                      removeSelectedProduct(viewingPartKey);
                      setViewingPartDetails(null);
                    } else if (isViewingPartAtLimit) {
                      triggerLimitNotice();
                    } else {
                      selectCatalogPart(viewingPartDetails);
                      setViewingPartDetails(null);
                    }
                  }}
                  activeOpacity={0.88}
                >
                  <Text
                    style={{
                      color: isViewingPartAtLimit ? '#475569' : '#FFFFFF',
                      fontSize: 14,
                      fontWeight: '600',
                    }}
                  >
                    {isViewingPartSelected
                      ? 'Remove from Selection'
                      : isViewingPartAtLimit
                      ? 'Maximum 3 Products Selected'
                      : `Select Part (${selectedCount + 1}/${MAX_SELECTED_PRODUCTS})`}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
          freeInstallPromo={effectiveFreeInstallPromo}
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
                    const buildItems = Array.isArray(build.items) ? build.items : [];
                    const buildPartNames = buildItems
                      .map((it) => it?.product_name || it?.name)
                      .filter(Boolean);
                    const pTitle =
                      buildPartNames.length > 0 ? buildPartNames.join(' + ') : 'Installed Part';

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

function GenerationProgress({ phase, partCount = 1 }) {
  const { styles, BRAND } = React.useContext(InstallThemeContext);
  const rows = [
    { label: 'Motorcycle selected', status: 'done' },
    {
      label: partCount > 1 ? `${partCount} parts selected` : 'Part selected',
      status: 'done',
    },
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
    partInfoThumbGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    partInfoMultiThumb: {
      width: 38,
      height: 38,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: SURFACE,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
    },
    partInfoMultiThumbOverlap: {
      marginLeft: -10,
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
      fontWeight: '700',
      color: INK,
      letterSpacing: -0.2,
    },
    partInfoBrandPrice: {
      fontSize: 12.5,
      fontWeight: '500',
      color: MUTED,
      fontVariant: ['tabular-nums'],
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
    statusPendingBadge: {
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.12)' : '#FFF7ED',
      borderColor: isDark ? 'rgba(234, 88, 12, 0.35)' : '#FFEDD5',
    },
    statusPendingDot: {
      backgroundColor: '#EA580C',
    },
    statusPendingText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#FB923C' : '#C2410C',
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
      fontWeight: '700',
      color: INK,
      letterSpacing: -0.2,
    },
    selectionCounterPill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
      borderWidth: 1,
      borderColor: LINE,
    },
    selectionCounterPillActive: {
      backgroundColor: BRAND_SOFT,
      borderColor: isDark ? 'rgba(234, 88, 12, 0.45)' : '#FDBA74',
    },
    selectionCounterText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: MUTED,
      fontVariant: ['tabular-nums'],
    },
    selectionCounterTextActive: {
      color: BRAND,
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
      fontWeight: '600',
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
      backgroundColor: BRAND_SOFT,
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
    emptySidebarSubtext: {
      fontSize: 11,
      color: MUTED,
      textAlign: 'center',
      paddingHorizontal: 12,
      lineHeight: 15,
      marginTop: 2,
      marginBottom: 4,
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
    selectionLimitBlock: {
      gap: 5,
    },
    selectionProgressTrack: {
      width: '100%',
      height: 5,
      borderRadius: 999,
      backgroundColor: isDark ? '#263040' : '#E2E8F0',
      overflow: 'hidden',
    },
    selectionProgressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: BRAND,
      ...Platform.select({
        web: { transition: 'width 0.2s ease-out' },
      }),
    },
    selectionLimitMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectionLimitCaption: {
      flex: 1,
      fontSize: 11,
      fontWeight: '500',
      color: MUTED,
      fontVariant: ['tabular-nums'],
    },
    selectionLimitCaptionFull: {
      color: BRAND,
      fontWeight: '600',
    },
    clearSelectionLink: {
      fontSize: 11,
      fontWeight: '600',
      color: BRAND,
    },
    maxLimitNoticeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: BRAND_SOFT,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234, 88, 12, 0.5)' : '#FDBA74',
      borderRadius: isWeb ? 8 : 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    maxLimitNoticeText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#FDBA74' : '#9A3412',
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
      maxHeight: isWeb ? 380 : 340,
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
      backgroundColor: BRAND_SOFT,
      ...Platform.select({
        web: {
          boxShadow: '0 0 0 1px #EA580C, 0 2px 8px rgba(234, 88, 12, 0.14)',
        },
      }),
    },
    partCardLimitReached: {
      opacity: 0.46,
      backgroundColor: isDark ? '#151A23' : '#F8FAFC',
      borderColor: LINE,
      ...Platform.select({
        web: { cursor: 'not-allowed' },
      }),
    },
    limitLockBadge: {
      position: 'absolute',
      top: 5,
      right: 5,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(23, 32, 51, 0.9)' : 'rgba(36, 39, 43, 0.82)',
    },
    limitLockBadgeText: {
      fontSize: 9,
      fontWeight: '600',
      color: '#FFFFFF',
      fontVariant: ['tabular-nums'],
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
      fontWeight: '600',
      color: INK,
    },
    partPrice: {
      fontSize: 12,
      fontWeight: '700',
      color: BRAND,
      fontVariant: ['tabular-nums'],
    },
    partCardFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
      marginTop: 2,
    },
    badgePill: {
      flexShrink: 1,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: LINE,
    },
    badgePillText: {
      fontSize: 9.5,
      fontWeight: '600',
      color: isDark ? '#CBD5E1' : '#475569',
    },
    selectedStateTag: {
      backgroundColor: BRAND,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      flexShrink: 0,
    },
    selectedStateTagText: {
      fontSize: 9,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    // Selected Products Summary Section
    selectedSummaryCard: {
      marginTop: 2,
      padding: 11,
      borderRadius: isWeb ? 10 : 12,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: isDark ? '#151A23' : '#F8FAFC',
      gap: 9,
    },
    selectedSummaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectedSummaryTitle: {
      fontSize: 12.5,
      fontWeight: '700',
      color: INK,
    },
    selectedSummaryCount: {
      fontSize: 11.5,
      fontWeight: '600',
      color: BRAND,
      fontVariant: ['tabular-nums'],
    },
    selectedSummaryEmpty: {
      fontSize: 11.5,
      lineHeight: 16,
      color: MUTED,
      paddingVertical: 4,
    },
    selectedSummaryList: {
      gap: 6,
    },
    selectedSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: SURFACE,
    },
    selectedSummaryThumb: {
      width: 38,
      height: 38,
      borderRadius: 7,
      backgroundColor: isDark ? '#232D3B' : '#F1F5F9',
    },
    selectedSummaryInfo: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    selectedSummaryName: {
      fontSize: 12,
      fontWeight: '600',
      color: INK,
    },
    selectedSummaryBrand: {
      fontSize: 10.5,
      fontWeight: '500',
      color: MUTED,
    },
    selectedSummaryPrice: {
      fontSize: 12,
      fontWeight: '700',
      color: INK,
      fontVariant: ['tabular-nums'],
    },
    selectedSummaryRemoveBtn: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: isDark ? '#232D3B' : '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedSummaryTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: LINE,
    },
    selectedSummaryTotalLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: MUTED,
    },
    selectedSummaryTotalValue: {
      fontSize: 14,
      fontWeight: '700',
      color: BRAND,
      fontVariant: ['tabular-nums'],
    },
    inlineValidationAlert: {
      gap: 8,
      padding: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(220, 38, 38, 0.45)' : '#FECACA',
      backgroundColor: isDark ? 'rgba(127, 29, 29, 0.22)' : '#FEF2F2',
    },
    inlineValidationText: {
      flex: 1,
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: '500',
      color: isDark ? '#FCA5A5' : '#991B1B',
    },
    inlineOverrideBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: BRAND,
    },
    inlineOverrideBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    installSelectedBtn: {
      width: '100%',
      height: isWeb ? 40 : 44,
      borderRadius: isWeb ? 8 : 10,
      backgroundColor: BRAND,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 12,
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(234, 88, 12, 0.24)' },
      }),
    },
    installSelectedBtnDisabled: {
      backgroundColor: isDark ? '#232D3B' : '#E2E8F0',
      ...Platform.select({
        web: { boxShadow: 'none', cursor: 'not-allowed' },
      }),
    },
    installSelectedBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    installSelectedBtnTextDisabled: {
      color: '#94A3B8',
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
    zoomReadoutBox: {
      minWidth: 42,
      height: 30,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomLevelReadout: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#F5F7F6' : '#334155',
      fontVariant: ['tabular-nums'],
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
    floatingZoomHint: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      zIndex: 25,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor: isDark ? 'rgba(23, 32, 51, 0.86)' : 'rgba(255, 255, 255, 0.92)',
      borderWidth: 1,
      borderColor: LINE,
      ...Platform.select({
        web: {
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
          userSelect: 'none',
        },
      }),
    },
    floatingZoomHintText: {
      fontSize: 10.5,
      fontWeight: '500',
      color: isDark ? '#CBD5E1' : '#475569',
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
      ...Platform.select({
        web: {
          userSelect: 'none',
          touchAction: 'none',
        },
      }),
    },
    canvasImageWrapperZoomable: {
      ...Platform.select({
        web: {
          cursor: 'zoom-in',
        },
      }),
    },
    canvasImageWrapperZoomed: {
      ...Platform.select({
        web: {
          cursor: 'grab',
        },
      }),
    },
    canvasImageWrapperPanning: {
      ...Platform.select({
        web: {
          cursor: 'grabbing',
        },
      }),
    },
    canvasImage: {
      width: '92%',
      height: '90%',
      ...Platform.select({
        web: {
          transition: 'transform 0.11s cubic-bezier(0.22, 1, 0.36, 1)',
          userSelect: 'none',
        },
      }),
    },
    canvasImagePanning: {
      ...Platform.select({
        web: {
          transition: 'none',
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
    emptyCanvasRegisterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: BRAND,
    },
    emptyCanvasRegisterBtnText: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '700',
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
