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
import { RegisterMotorcycleModal } from '../modals';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';
import {
  requestMotorcycleCustomization,
  getCustomizeUsage,
} from '../../services/ai/aiCustomizeApi.js';
import { motorcycleService } from '../../services/products/motorcycleService.js';
import { productService } from '../../services/products/productService.js';
import { compatibilityService } from '../../services/products/compatibilityService.js';
import { customizationService } from '../../services/bookings/customizationService.js';
import { useCart } from '../../context/CartContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

const InstallThemeContext = React.createContext({ styles: {}, BRAND: '#1D4533', MUTED: '#64748B' });
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
} from '../../utils/installStudioLogic.js';

const BRAND = '#1D4533';
const BRAND_SOFT = '#E8F0EC';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SURFACE = '#FFFFFF';
const CANVAS = '#F6F8FA';
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

function formatPartPrice(product) {
  const amount = Number(product?.price);
  if (!Number.isFinite(amount)) return '';
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function focusSection(ref) {
  const node = ref?.current;
  if (node && typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Customer-facing install studio. Selection and preview requests stay on the existing services.
 */
export default function AiMotorcycleInstallStudio({ onRequireLogin, currentUser }) {
  const { isDarkMode } = useTheme();
  const styles = isDarkMode ? darkStyles : lightStyles;
  const BRAND = isDarkMode ? '#4DB896' : '#1D4533';
  const MUTED = isDarkMode ? '#AAB4B0' : '#64748B';
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const { addToCart } = useCart();
  const bikeSectionRef = useRef(null);
  const partSectionRef = useRef(null);
  const [bikes, setBikes] = useState([]);
  const [selectedBikeId, setSelectedBikeId] = useState('');
  const [bikeOverrideUri, setBikeOverrideUri] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [partMode, setPartMode] = useState('catalog'); // catalog | upload
  const [catalog, setCatalog] = useState([]);
  const [partSearch, setPartSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [partUri, setPartUri] = useState(null);
  const [partName, setPartName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');

  const [customRequest, setCustomRequest] = useState('');
  const [generationState, setGenerationState] = useState(GENERATION_STATES.IDLE);
  const [loadingBikes, setLoadingBikes] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resultUri, setResultUri] = useState(null);
  const [promptUsed, setPromptUsed] = useState('');
  const [, setModelUsed] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [savingImage, setSavingImage] = useState(false);
  const [savingToGarage, setSavingToGarage] = useState(false);
  const [savedToGarage, setSavedToGarage] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const [openFilter, setOpenFilter] = useState(null);
  const [compatWarning, setCompatWarning] = useState('');
  const [compatOverride, setCompatOverride] = useState(false);
  const [compatBlocked, setCompatBlocked] = useState(false);
  const [compatMap, setCompatMap] = useState(null);
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
  }, [currentUser]);

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

  const currentUserId = currentUser?.id || currentUser?.user_id;
  const sessionInitializedRef = useRef(false);
  const [savedBuildsModalOpen, setSavedBuildsModalOpen] = useState(false);
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [loadingSavedBuilds, setLoadingSavedBuilds] = useState(false);

  // ── Session persistence: keep generated preview & selections across navigation ──
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

  const refreshSavedBuilds = useCallback(async () => {
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
  }, [currentUser]);

  useEffect(() => {
    refreshSavedBuilds();
    const unsub = customizationService.subscribe?.(() => {
      refreshSavedBuilds();
    });
    return () => unsub?.();
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
    setLoadingBikes(true);
    try {
      if (currentUser?.id || currentUser?.email) {
        await motorcycleService.syncFromSupabase(currentUser?.id, currentUser?.email);
      }
      const all = motorcycleService.getMotorcycles() || [];
      const userId = currentUser?.id || currentUser?.user_id;
      const email = String(currentUser?.email || '').trim().toLowerCase();
      const userBikes = (Array.isArray(all) ? all : []).filter((b) => {
        if (String(b.motorcycle_id || '').startsWith('moto-seed-')) return false;
        if (!userId && !email) return false;
        const sameUser =
          (userId &&
            (b.user_id === userId ||
              b.customer_id === userId ||
              b.customer_id === currentUser?.customer_id)) ||
          (email && String(b.customer_email || '').toLowerCase() === email);
        return Boolean(sameUser);
      });
      setBikes(userBikes);
      setSelectedBikeId((prev) => {
        if (prev && userBikes.some((b) => b.motorcycle_id === prev)) return prev;
        const primary = userBikes.find((b) => b.is_primary) || userBikes[0];
        return primary?.motorcycle_id || '';
      });
    } finally {
      setLoadingBikes(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshBikes();
    const unsub = motorcycleService.subscribe(() => {
      refreshBikes();
    });
    return () => unsub?.();
  }, [refreshBikes]);

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
      const list = Array.isArray(rows) ? rows.filter((p) => productImage(p)) : [];
      setCatalog(list);
    });
    compatibilityService.getCompatibilityMap().then((map) => {
      if (!cancelled) setCompatMap(map instanceof Map ? map : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBike = useMemo(() => {
    const raw = bikes.find((b) => b.motorcycle_id === selectedBikeId) || null;
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
        const key = String(product.product_id || product.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        if (categoryFilter !== 'All' && String(product.category || '') !== categoryFilter) return false;
        if (brandFilter !== 'All' && String(product.brand || '') !== brandFilter) return false;
        if (!q) return true;
        const hay = `${product.name || ''} ${product.brand || ''} ${product.category || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 24);
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
      setCompatWarning('');
      setCompatOverride(false);
      setCompatBlocked(false);
      setGenerationState(GENERATION_STATES.IDLE);
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

    // Fresh installation metadata from the newly selected product only.
    const nextProduct = normalizeProduct(product, { compatible_motorcycles: rows });
    setSelectedProductId(nextId);
    setSelectedProduct(nextProduct);
    setPartName(nextProduct.name || '');
    applyCompatibilityCheck(selectedBike, nextProduct);
    setGenerationState(GENERATION_STATES.IDLE);
  };

  const handleGenerate = async ({ forceCompatOverride = false } = {}) => {
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }

    // Client-side quick check before starting validation
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

    const currentUid = currentUser?.id || currentUser?.user_id;

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
    setGenerationState(GENERATION_STATES.COMPLETED);
    setInfo(
      result.note
        ? `Done — ${accessoryName} installed on ${bikeName} (${result.model}). ${result.note}`
        : `Done — ${accessoryName} installed on ${bikeName} (${result.model}).`
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
      ? sessionProduct?.brand || sessionProduct?.category || ''
      : uploadCategory || '';
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
  const registrationNote = info.startsWith('Motorcycle registered') ? 'Motorcycle registered.' : '';
  const friendlyError = (() => {
    const raw = String(error || '');
    if (!raw) return '';
    // Preserve customer rate-limit messages verbatim
    if (/weekly.*limit|cooldown|preview limit|wait before generating|consecutive/i.test(raw)) {
      return raw;
    }
    if (/quota|resource_exhausted|429|billing|credit balance|plan and billing/i.test(raw)) {
      return 'Gemini image quota is empty for this API key. Activate billing / add credits in Google AI Studio on the account that owns the key, restart the server, then try again.';
    }
    if (/invalid_api_key|invalid authentication|unauthenticated|GEMINI_API_KEY/i.test(raw)) {
      return 'AI key is invalid. Update GEMINI_API_KEY in server/.env, restart the server, then try again.';
    }
    if (/network request failed|ECONNREFUSED|failed to fetch/i.test(raw)) {
      return 'Cannot reach the AI server. Keep `npm run dev` running in the server folder, then try again.';
    }
    // Only treat local photo/upload failures as image problems — not Google JSON that mentions "image" models.
    if (
      /unable to (load|use|read).*(photo|image)|invalid image|unsupported image|upload failed/i.test(raw) ||
      (/127\.0\.0\.1|localhost/i.test(raw) && /photo|upload/i.test(raw))
    ) {
      return 'Unable to use that photo. Please try another image.';
    }
    // Avoid dumping long Google JSON blobs into the UI.
    if (raw.length > 220 || raw.trim().startsWith('{')) {
      return 'Unable to generate the installation preview. Check the AI server terminal for details.';
    }
    return raw;
  })();
  const formNotice = !previewFailed ? friendlyError : '';
  const showCompatOverride =
    Boolean(compatBlocked) &&
    Boolean(compatWarning) &&
    !compatOverride &&
    !loading;

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
      const partName =
        lastResult?.product_name ||
        sessionProduct?.name ||
        sessionProduct?.product_name ||
        'custom_part';
      const safeBike = bikeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const safePart = partName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
          setSaveNotice('✓ Installation image saved to your device!');
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

  const handleSaveToGarage = async () => {
    if (!resultUri) return;
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    setSavingToGarage(true);
    setSaveNotice('');
    try {
      const bike = selectedBike?.raw || selectedBike;
      const prod = sessionProduct?.raw || sessionProduct;
      const bikeTitle =
        lastResult?.motorcycle_name ||
        selectedBike?.nickname ||
        selectedBike?.name ||
        [selectedBike?.brand, selectedBike?.model].filter(Boolean).join(' ') ||
        'My Motorcycle';
      const partTitle =
        lastResult?.product_name ||
        sessionProduct?.name ||
        sessionProduct?.product_name ||
        'Custom Part';
      const setupName = `${bikeTitle} with ${partTitle}`;

      const items = prod
        ? [
            {
              productId: prod.product_id || prod.id,
              quantity: 1,
              price: Number(prod.price) || 0,
              name: prod.name || prod.product_name || partTitle,
              brand: prod.brand || '',
              category: prod.category || '',
            },
          ]
        : [];

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
      });

      if (res?.success) {
        setSavedToGarage(true);
        setSaveNotice('✓ Installation saved to your Garage builds! Access anytime under "My Saved Previews".');
        refreshSavedBuilds();
        setTimeout(() => setSaveNotice(''), 5000);
      } else {
        setSaveNotice(res?.error || 'Could not save to Garage.');
        setTimeout(() => setSaveNotice(''), 4000);
      }
    } catch (err) {
      console.error('[InstallStudio] Save to garage error:', err);
      setSaveNotice('Failed to save to Garage.');
      setTimeout(() => setSaveNotice(''), 4000);
    } finally {
      setSavingToGarage(false);
    }
  };

  const stepOne = (
    <View ref={bikeSectionRef} style={[styles.section, styles.anchor]}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>1. Select your motorcycle</Text>
        <TouchableOpacity onPress={openRegister} disabled={loading} activeOpacity={0.8}>
          <Text style={styles.textLink}>Register Motorcycle</Text>
        </TouchableOpacity>
      </View>

      {registrationNote ? <Text style={styles.noteLine}>{registrationNote}</Text> : null}

      {loadingBikes ? (
        <ActivityIndicator color={BRAND} style={styles.loader} />
      ) : bikes.length === 0 ? (
        <View style={styles.inlineEmpty}>
          <View style={styles.emptyIcon}>
            <BootstrapIcon name="bicycle" size={18} color={BRAND} />
          </View>
          <Text style={styles.inlineEmptyTitle}>No registered motorcycles yet</Text>
          <Text style={styles.inlineEmptyBody}>Register a motorcycle with a photo to preview an installation.</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={openRegister} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Register Motorcycle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.choiceGrid}>
          {bikes.map((bike) => {
            const selected = bike.motorcycle_id === selectedBikeId;
            const photo = bikePhoto(bike);
            const card = bikeIdentity(bike);
            return (
              <View key={bike.motorcycle_id} style={isWide ? styles.choiceSlotWide : styles.choiceSlot}>
                <TouchableOpacity
                  style={[styles.choiceCard, selected && styles.choiceCardOn]}
                  onPress={() => selectBike(bike)}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  <View style={styles.choiceImageWrap}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.choiceImage} />
                    ) : (
                      <View style={[styles.choiceImage, styles.imageFallback]}>
                        <BootstrapIcon name="bicycle" size={22} color={BRAND} />
                      </View>
                    )}
                    {selected ? <SelectedMark /> : null}
                  </View>
                  <Text style={styles.choiceTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  {card.spec ? (
                    <Text style={styles.choiceMeta} numberOfLines={1}>
                      {card.spec}
                    </Text>
                  ) : bike.year ? (
                    <Text style={styles.choiceMeta} numberOfLines={1}>
                      {bike.year}
                    </Text>
                  ) : null}
                  {!photo ? <Text style={styles.warnLine}>Needs photo</Text> : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const stepTwo = (
    <View ref={partSectionRef} style={[styles.section, styles.anchor, openFilter && styles.sectionRaised]}>
      <Text style={styles.sectionTitle}>2. Select part to install</Text>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, partMode === 'catalog' && styles.tabOn]}
          onPress={() => {
            setPartMode('catalog');
            setPartUri(null);
            setUploadCategory('');
            setOpenFilter(null);
          }}
          disabled={loading}
          activeOpacity={0.88}
        >
          <Text style={[styles.tabText, partMode === 'catalog' && styles.tabTextOn]}>Store Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, partMode === 'upload' && styles.tabOn]}
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
          <Text style={[styles.tabText, partMode === 'upload' && styles.tabTextOn]}>Upload Part</Text>
        </TouchableOpacity>
      </View>

      {partMode === 'catalog' ? (
        <>
          <View style={styles.searchWrap}>
            <BootstrapIcon name="search" size={15} color="#94A3B8" />
            <TextInput
              style={styles.search}
              placeholder="Search parts by name or brand"
              placeholderTextColor="#94A3B8"
              value={partSearch}
              onChangeText={setPartSearch}
              editable={!loading}
            />
          </View>
          <View style={styles.filterRow}>
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={categories}
              open={openFilter === 'category'}
              disabled={loading}
              onToggle={() => setOpenFilter((current) => (current === 'category' ? null : 'category'))}
              onChange={(value) => {
                setCategoryFilter(value);
                setOpenFilter(null);
              }}
            />
            <FilterSelect
              label="Brand"
              value={brandFilter}
              options={brands}
              open={openFilter === 'brand'}
              disabled={loading}
              onToggle={() => setOpenFilter((current) => (current === 'brand' ? null : 'brand'))}
              onChange={(value) => {
                setBrandFilter(value);
                setOpenFilter(null);
              }}
            />
          </View>
          {filteredParts.length === 0 ? (
            <Text style={styles.quietLine}>No parts match your search.</Text>
          ) : (
            <View style={styles.choiceGrid}>
              {filteredParts.map((product) => {
                const id = String(product.product_id || product.id || '');
                const selected = partMode === 'catalog' && id !== '' && id === String(selectedProductId || '');
                const img = productImage(product);
                const price = formatPartPrice(product);
                return (
                  <View key={id} style={isWide ? styles.partSlotWide : styles.choiceSlot}>
                    <TouchableOpacity
                      style={[styles.choiceCard, selected && styles.choiceCardOn]}
                      onPress={() => selectCatalogPart(product)}
                      disabled={loading}
                      activeOpacity={0.88}
                    >
                      <View style={styles.partImageWrap}>
                        <Image source={{ uri: img }} style={styles.partImage} />
                        {selected ? <SelectedMark /> : null}
                      </View>
                      <Text style={styles.choiceTitle} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text style={styles.choiceBrand} numberOfLines={1}>
                        {product.brand || product.category || 'Part'}
                      </Text>
                      {price ? <Text style={styles.choicePrice}>{price}</Text> : null}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : partUri ? (
        <View style={{ gap: 12 }}>
          <View style={styles.uploadDone}>
            <Image source={{ uri: partUri }} style={styles.uploadDoneImage} />
            <View style={styles.uploadDoneCopy}>
              <Text style={styles.choiceTitle}>Uploaded part</Text>
              <Text style={styles.choiceMeta}>
                {uploadCategory ? `${uploadCategory} ready for preview` : 'Photo ready — select part type'}
              </Text>
              <TouchableOpacity onPress={pickPart} disabled={loading} activeOpacity={0.8}>
                <Text style={styles.textLink}>Change photo</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.sectionTitle}>What type of motorcycle part is this?</Text>
          <View style={styles.choiceGrid}>
            {UPLOAD_PART_CATEGORIES.map((category) => {
              const selected = uploadCategory === category;
              return (
                <View key={category} style={styles.choiceSlot}>
                  <TouchableOpacity
                    style={[styles.smallBtn, selected && styles.choiceCardOn, { width: '100%', minHeight: 38 }]}
                    onPress={() => {
                      setUploadCategory(category);
                      setError('');
                      setResultUri(null);
                      setLastResult(null);
                    }}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.smallBtnText, selected && { color: BRAND }]} numberOfLines={1}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadDrop} onPress={pickPart} disabled={loading} activeOpacity={0.88}>
          <View style={styles.uploadIcon}>
            <BootstrapIcon name="upload" size={22} color={BRAND} />
          </View>
          <Text style={styles.uploadTitle}>Upload Part Photo</Text>
          <Text style={styles.uploadHint}>Use a clear photo of the motorcycle part</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const notes = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Installation notes</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Optional. Example: install on the rear wheel and keep the stock color"
        placeholderTextColor="#94A3B8"
        value={customRequest}
        onChangeText={setCustomRequest}
        editable={!loading}
        multiline
      />
    </View>
  );

  const motorcyclePreview = loadingBikes ? (
    <View style={styles.sideCard}>
      <Text style={styles.sideLabel}>Selected Motorcycle</Text>
      <ActivityIndicator color={BRAND} style={styles.loader} />
    </View>
  ) : selectedBike && identity ? (
    <View style={styles.sideCard}>
      <Text style={styles.sideLabel}>Selected Motorcycle</Text>
      <View style={styles.previewRow}>
        {bikeUri ? (
          <Image source={{ uri: bikeUri }} style={styles.previewThumb} />
        ) : (
          <View style={[styles.previewThumb, styles.imageFallback]}>
            <BootstrapIcon name="bicycle" size={18} color={BRAND} />
          </View>
        )}
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {identity.title}
          </Text>
          {identity.spec ? (
            <Text style={styles.previewSpec} numberOfLines={2}>
              {identity.spec}
            </Text>
          ) : null}
          {[identity.color, identity.plate].filter(Boolean).length ? (
            <Text style={styles.previewMeta} numberOfLines={2}>
              {[identity.color, identity.plate].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.inlineActions}>
        <TouchableOpacity
          style={styles.smallBtn}
          onPress={() => focusSection(bikeSectionRef)}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.smallBtnText}>Change Motorcycle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={pickBikeOverride} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.smallBtnText}>{bikeOverrideUri ? 'Change photo' : 'Upload photo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    <View style={styles.sideCard}>
      <EmptyState icon="bicycle" message="Select a motorcycle to continue." />
    </View>
  );

  const partPreview = resolvedPartUri ? (
    <View style={styles.sideCard}>
      <Text style={styles.sideLabel}>Selected Part</Text>
      <View style={styles.previewRow}>
        <Image source={{ uri: resolvedPartUri }} style={styles.previewThumb} />
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle} numberOfLines={2}>
            {partDisplayName}
          </Text>
          {partBrand ? (
            <Text style={styles.previewMeta} numberOfLines={1}>
              {partBrand}
            </Text>
          ) : null}
          {partPrice ? <Text style={styles.choicePrice}>{partPrice}</Text> : null}
        </View>
      </View>
    </View>
  ) : (
    <View style={styles.sideCard}>
      <EmptyState icon="box-seam" message="Select a motorcycle part to continue." />
    </View>
  );

  const installSummary = (
    <View style={styles.sideCard}>
      <Text style={styles.sectionTitle}>3. Installation Preview</Text>

      {/* Rate limit status display */}
      {aiUsage.isAdmin ? (
        <View style={styles.adminUsageTag}>
          <BootstrapIcon name="lightning-charge-fill" size={12} color="#065F46" />
          <Text style={styles.adminUsageText}>⚡ Unlimited AI Previews (Admin)</Text>
        </View>
      ) : isWeeklyLimitReached ? (
        <View style={styles.limitAlertBox}>
          <BootstrapIcon name="lock-fill" size={15} color="#991B1B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.limitAlertTitle}>🔒 Weekly AI Preview Limit Reached</Text>
            <Text style={styles.limitAlertDesc}>
              You've used all 3 AI installation previews available this week. Try again next week.
            </Text>
          </View>
        </View>
      ) : isConsecutiveCooldown ? (
        <View style={styles.cooldownAlertBox}>
          <BootstrapIcon name="hourglass-split" size={15} color="#B45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.cooldownAlertTitle}>⏱ Cooldown active</Text>
            <Text style={styles.cooldownAlertDesc}>
              Please wait before generating another preview. Available again in {cooldownCountdown || '30m'}.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.usageIndicatorRow}>
          <BootstrapIcon name="speedometer2" size={12} color="#475569" />
          <Text style={styles.usageIndicatorText}>
            AI Previews: {aiUsage.weeklyUsed} / {aiUsage.weeklyLimit || 3} this week
            {aiUsage.consecutiveUsed > 0
              ? ` • ${aiUsage.consecutiveUsed} / ${aiUsage.consecutiveLimit || 2} consecutive`
              : ''}
          </Text>
        </View>
      )}

      {readyToGenerate ? (
        <>
          <View style={styles.pairRow}>
            <View style={styles.pairItem}>
              <Image source={{ uri: bikeUri }} style={styles.pairImage} />
              <Text style={styles.pairLabel} numberOfLines={2}>
                {identity?.summary}
              </Text>
            </View>
            <View style={styles.pairMark}>
              <BootstrapIcon name="plus" size={14} color={BRAND} />
            </View>
            <View style={styles.pairItem}>
              <Image source={{ uri: resolvedPartUri }} style={styles.pairImage} />
              <Text style={styles.pairLabel} numberOfLines={2}>
                {partDisplayName}
              </Text>
            </View>
          </View>
          {!loading && !isGenerationBlocked ? (
            <Text style={styles.readyLine}>Ready to generate your installation preview.</Text>
          ) : null}
        </>
      ) : null}

      {formNotice ? <Text style={styles.formNotice}>{formNotice}</Text> : null}
      {!formNotice && compatWarning ? <Text style={styles.formNotice}>{compatWarning}</Text> : null}

      {loading ? (
        <GenerationProgress phase={genPhase} />
      ) : showCompatOverride ? (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={[
              styles.generateBtn,
              (!readyToGenerate || isGenerationBlocked) && styles.generateBtnOff,
            ]}
            onPress={() => {
              setCompatOverride(true);
              handleGenerate({ forceCompatOverride: true });
            }}
            disabled={!readyToGenerate || isGenerationBlocked || loading}
            activeOpacity={0.88}
          >
            <Text
              style={[
                styles.generateBtnText,
                (!readyToGenerate || isGenerationBlocked) && styles.generateBtnTextOff,
              ]}
            >
              {loading
                ? 'Generating Preview...'
                : isConsecutiveCooldown
                ? `Cooldown Active (${cooldownCountdown || 'wait'})`
                : isWeeklyLimitReached
                ? 'Weekly Limit Reached (3 / 3)'
                : 'Continue Anyway'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setError('');
              setCompatWarning('');
              focusSection(partSectionRef);
            }}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Change Part</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.generateBtn,
            (!readyToGenerate || isGenerationBlocked) && styles.generateBtnOff,
            isConsecutiveCooldown && styles.generateBtnCooldown,
          ]}
          onPress={() => handleGenerate()}
          disabled={!readyToGenerate || isGenerationBlocked || loading}
          activeOpacity={0.88}
        >
          <Text
            style={[
              styles.generateBtnText,
              (!readyToGenerate || isGenerationBlocked) && styles.generateBtnTextOff,
              isConsecutiveCooldown && styles.generateBtnCooldownText,
            ]}
          >
            {loading
              ? 'Generating Preview...'
              : isConsecutiveCooldown
              ? `Cooldown Active (in ${cooldownCountdown || '30m'})`
              : isWeeklyLimitReached
              ? 'Weekly Limit Reached (3 / 3)'
              : 'Generate Installation Preview'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const resultPanel = (
    <View style={styles.resultCard}>
      <Text style={styles.resultHeading}>AI INSTALLATION PREVIEW</Text>
      {loading ? (
        <View style={[styles.resultFrame, isWide ? styles.resultFrameWide : styles.resultFrameCompact]}>
          <ActivityIndicator color={BRAND} />
          <Text style={styles.emptyText}>Your installation preview will appear here.</Text>
        </View>
      ) : previewFailed ? (
        <View style={styles.errorBox}>
          <View style={styles.errorIcon}>
            <BootstrapIcon name="exclamation-circle" size={18} color="#B91C1C" />
          </View>
          <Text style={styles.errorText}>
            {friendlyError || 'Unable to generate the installation preview.'}
          </Text>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              isGenerationBlocked && styles.generateBtnOff,
            ]}
            onPress={() => handleGenerate({ forceCompatOverride: compatOverride })}
            disabled={isGenerationBlocked || loading}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.secondaryBtnText,
                isGenerationBlocked && styles.generateBtnTextOff,
              ]}
            >
              {loading
                ? 'Generating Preview...'
                : isConsecutiveCooldown
                ? `Try Again in ${cooldownCountdown || '30m'}`
                : isWeeklyLimitReached
                ? 'Weekly Limit Reached'
                : 'Try Again'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : resultUri ? (
        <>
          <View style={styles.resultImageWrap}>
            <Image
              source={{ uri: resultUri }}
              style={[styles.resultImage, isWide ? styles.resultFrameWide : styles.resultFrameCompact]}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.floatingSaveBtn}
              onPress={handleSaveImage}
              disabled={savingImage || loading}
              activeOpacity={0.85}
              accessibilityLabel="Save Image"
            >
              {savingImage ? (
                <ActivityIndicator size="small" color={BRAND} />
              ) : (
                <BootstrapIcon name="download" size={13} color={BRAND} />
              )}
              <Text style={styles.floatingSaveText}>
                {savingImage ? 'Saving...' : 'Save Image'}
              </Text>
            </TouchableOpacity>
          </View>

          {saveNotice ? (
            <View style={styles.saveNoticeBanner}>
              <BootstrapIcon name="check-circle-fill" size={15} color="#166534" />
              <Text style={styles.saveNoticeText}>{saveNotice}</Text>
            </View>
          ) : null}

          {/* Compact Rate Limit Indicator inside Preview Card */}
          {aiUsage.isAdmin ? (
            <View style={styles.adminUsageTag}>
              <BootstrapIcon name="lightning-charge-fill" size={12} color="#065F46" />
              <Text style={styles.adminUsageText}>⚡ Unlimited AI Previews (Admin)</Text>
            </View>
          ) : isWeeklyLimitReached ? (
            <View style={styles.limitAlertBox}>
              <BootstrapIcon name="lock-fill" size={15} color="#991B1B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.limitAlertTitle}>🔒 Weekly AI Preview Limit Reached</Text>
                <Text style={styles.limitAlertDesc}>
                  You've used all 3 AI installation previews available this week. Try again next week.
                </Text>
              </View>
            </View>
          ) : isConsecutiveCooldown ? (
            <View style={styles.cooldownAlertBox}>
              <BootstrapIcon name="hourglass-split" size={15} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cooldownAlertTitle}>⏱ Cooldown active</Text>
                <Text style={styles.cooldownAlertDesc}>
                  Generate again in {cooldownCountdown || '30m'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.usageIndicatorRow}>
              <BootstrapIcon name="speedometer2" size={12} color="#475569" />
              <Text style={styles.usageIndicatorText}>
                AI Previews: {aiUsage.weeklyUsed} / {aiUsage.weeklyLimit || 3} this week
                {aiUsage.consecutiveUsed > 0
                  ? ` • ${aiUsage.consecutiveUsed} / ${aiUsage.consecutiveLimit || 2} consecutive`
                  : ''}
              </Text>
            </View>
          )}

          <View style={styles.resultFacts}>
            <View style={styles.resultFact}>
              <Text style={styles.factLabel}>Motorcycle:</Text>
              <Text style={styles.factValue}>
                {lastResult?.motorcycle_name || identity?.summary || 'Motorcycle'}
              </Text>
            </View>
            <View style={styles.resultFact}>
              <Text style={styles.factLabel}>Installed Part:</Text>
              <Text style={styles.factValue}>
                {lastResult?.product_name || partDisplayName || 'Part'}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                isGenerationBlocked && styles.generateBtnOff,
              ]}
              onPress={() => handleGenerate({ forceCompatOverride: compatOverride })}
              disabled={!readyToGenerate || loading || isGenerationBlocked}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.secondaryBtnText,
                  isGenerationBlocked && styles.generateBtnTextOff,
                ]}
              >
                {loading
                  ? 'Generating Preview...'
                  : isConsecutiveCooldown
                  ? `Generate Again in ${cooldownCountdown || '30m'}`
                  : isWeeklyLimitReached
                  ? 'Weekly Limit Reached'
                  : '↻ Generate Again'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => focusSection(partSectionRef)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Change Part</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => focusSection(bikeSectionRef)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Change Motorcycle</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.primaryActionRow}>
            <TouchableOpacity
              style={styles.saveImageBtn}
              onPress={handleSaveImage}
              disabled={savingImage || loading}
              activeOpacity={0.85}
            >
              {savingImage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BootstrapIcon name="download" size={15} color="#FFFFFF" />
              )}
              <Text style={styles.saveImageBtnText}>
                {savingImage ? 'Saving...' : 'Save Image'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveGarageBtn, savedToGarage && styles.saveGarageBtnSaved]}
              onPress={handleSaveToGarage}
              disabled={savingToGarage || savedToGarage || loading}
              activeOpacity={0.85}
            >
              {savingToGarage ? (
                <ActivityIndicator size="small" color={BRAND} />
              ) : (
                <BootstrapIcon
                  name={savedToGarage ? 'check-circle-fill' : 'bookmark'}
                  size={15}
                  color={savedToGarage ? '#166534' : BRAND}
                />
              )}
              <Text style={[styles.saveGarageBtnText, savedToGarage && styles.saveGarageBtnSavedText]}>
                {savingToGarage ? 'Saving...' : savedToGarage ? 'Saved to Garage' : 'Save to Garage'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cartBtn, !canAddToCart && styles.generateBtnOff]}
              onPress={handleAddToCart}
              disabled={!canAddToCart || loading}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="cart3" size={15} color={canAddToCart ? '#FFFFFF' : '#94A3B8'} />
              <Text style={[styles.cartBtnText, !canAddToCart && styles.generateBtnTextOff]}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={[styles.resultFrame, isWide ? styles.resultFrameWide : styles.resultFrameCompact]}>
          <View style={styles.emptyIcon}>
            <BootstrapIcon name="image" size={18} color={BRAND} />
          </View>
          <Text style={styles.emptyText}>Your installation preview will appear here.</Text>
        </View>
      )}
    </View>
  );

  return (
    <InstallThemeContext.Provider value={{ styles, BRAND, MUTED, isDark: isDarkMode }}>
      <View style={[styles.root, isDarkMode && { backgroundColor: '#0F1412' }]}>
        <View style={styles.pageHead}>
          <View style={styles.pageHeadTopRow}>
            <View style={{ flex: 1, minWidth: 260 }}>
              <Text style={styles.title}>AI INSTALL STUDIO</Text>
            <Text style={styles.subtitle}>
              Preview how a motorcycle part looks when professionally installed on your motorcycle.
            </Text>
          </View>

          <View style={styles.pageHeadActions}>
            <TouchableOpacity
              style={styles.savedPreviewsBtn}
              onPress={() => setSavedBuildsModalOpen(true)}
              activeOpacity={0.85}
            >
              <BootstrapIcon name="bookmark-star-fill" size={14} color={BRAND} />
              <Text style={styles.savedPreviewsBtnText}>My Saved Previews</Text>
              {savedBuilds.length > 0 ? (
                <View style={styles.savedPreviewsBadge}>
                  <Text style={styles.savedPreviewsBadgeText}>{savedBuilds.length}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {resultUri ? (
              <TouchableOpacity
                style={styles.newPreviewBtn}
                onPress={handleStartNewPreview}
                activeOpacity={0.85}
              >
                <BootstrapIcon name="arrow-clockwise" size={13} color="#64748B" />
                <Text style={styles.newPreviewBtnText}>New Preview</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {isWide ? (
        <View style={styles.columnsWide}>
          <View style={styles.colMain}>
            {stepOne}
            {stepTwo}
            {notes}
          </View>
          <View style={styles.colSide}>
            {motorcyclePreview}
            {partPreview}
            {installSummary}
            {resultPanel}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {stepOne}
          {motorcyclePreview}
          {stepTwo}
          {notes}
          {partPreview}
          {installSummary}
          {resultPanel}
        </View>
      )}

      <RegisterMotorcycleModal
        visible={registerOpen}
        motorcycle={null}
        onClose={() => setRegisterOpen(false)}
        onSave={handleSaveRegisteredBike}
      />

      {/* ── Modal to access & manage Saved Installation Previews ── */}
      <Modal
        visible={savedBuildsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedBuildsModalOpen(false)}
      >
        <View style={styles.savedModalOverlay}>
          <View style={styles.savedModalSheet}>
            <View style={styles.savedModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <BootstrapIcon name="bookmark-star-fill" size={18} color={BRAND} />
                <View>
                  <Text style={styles.savedModalTitle}>My Saved Installation Previews</Text>
                  <Text style={styles.savedModalSub}>
                    Access and manage your generated motorcycle installation builds.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.savedModalCloseBtn}
                onPress={() => setSavedBuildsModalOpen(false)}
                activeOpacity={0.7}
              >
                <BootstrapIcon name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingSavedBuilds ? (
              <View style={styles.savedModalLoading}>
                <ActivityIndicator size="large" color={BRAND} />
                <Text style={styles.quietLine}>Loading your saved builds…</Text>
              </View>
            ) : savedBuilds.length === 0 ? (
              <View style={styles.savedModalEmpty}>
                <View style={styles.savedModalEmptyIcon}>
                  <BootstrapIcon name="image" size={28} color={BRAND} />
                </View>
                <Text style={styles.inlineEmptyTitle}>No saved installation previews yet</Text>
                <Text style={styles.inlineEmptyBody}>
                  Generate an AI preview in the studio and tap "Save to Garage" to store and access your builds anytime.
                </Text>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setSavedBuildsModalOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryBtnText}>Back to Studio</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.savedBuildsScroll}
                contentContainerStyle={styles.savedBuildsGrid}
                showsVerticalScrollIndicator={true}
              >
                {savedBuilds.map((build) => {
                  const buildId = build.id || build.customization_id;
                  const img = build.previewImageUrl || build.preview_image_url;
                  const bikeTitle =
                    build.name ||
                    build.motorcycleName ||
                    [build.motorcycleBrand, build.motorcycleModel].filter(Boolean).join(' ') ||
                    'Custom Motorcycle';
                  const firstItem = build.items?.[0];
                  const partTitle =
                    firstItem?.product_name || firstItem?.name || 'Installed Part';
                  const dateStr = build.createdAt || build.created_at
                    ? new Date(build.createdAt || build.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';

                  return (
                    <View key={buildId} style={styles.savedBuildCard}>
                      <View style={styles.savedBuildImageWrap}>
                        <Image source={{ uri: img }} style={styles.savedBuildImage} resizeMode="contain" />
                      </View>
                      <View style={styles.savedBuildInfo}>
                        <Text style={styles.savedBuildTitle} numberOfLines={1}>
                          {bikeTitle}
                        </Text>
                        <Text style={styles.savedBuildPart} numberOfLines={1}>
                          Installed: {partTitle}
                        </Text>
                        {dateStr ? <Text style={styles.savedBuildDate}>Saved on {dateStr}</Text> : null}

                        <View style={styles.savedBuildActions}>
                          <TouchableOpacity
                            style={styles.savedBuildLoadBtn}
                            onPress={() => handleLoadSavedBuild(build)}
                            activeOpacity={0.85}
                          >
                            <BootstrapIcon name="eye-fill" size={13} color="#FFFFFF" />
                            <Text style={styles.savedBuildLoadBtnText}>Load in Studio</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.savedBuildIconBtn}
                            onPress={() => handleSaveImage(img)}
                            title="Download Image"
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="download" size={14} color={BRAND} />
                          </TouchableOpacity>

                          {firstItem && (firstItem.productId || firstItem.product_id) ? (
                            <TouchableOpacity
                              style={styles.savedBuildIconBtn}
                              onPress={() => {
                                const prod = catalog.find(
                                  (p) => String(p.product_id || p.id) === String(firstItem.productId || firstItem.product_id)
                                );
                                if (prod) addToCart(prod, 1);
                                setSaveNotice('✓ Part added to cart!');
                                setTimeout(() => setSaveNotice(''), 3000);
                              }}
                              title="Add to Cart"
                              activeOpacity={0.8}
                            >
                              <BootstrapIcon name="cart-plus" size={14} color={BRAND} />
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            style={[styles.savedBuildIconBtn, { borderColor: '#FECACA' }]}
                            onPress={() => handleDeleteSavedBuild(buildId)}
                            title="Delete"
                            activeOpacity={0.8}
                          >
                            <BootstrapIcon name="trash" size={14} color="#B91C1C" />
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

function SelectedMark() {
  const { styles } = React.useContext(InstallThemeContext);
  return (
    <View style={styles.selectedMark}>
      <BootstrapIcon name="check" size={12} color="#FFFFFF" />
    </View>
  );
}

function EmptyState({ icon, message }) {
  const { styles, BRAND } = React.useContext(InstallThemeContext);
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <BootstrapIcon name={icon} size={18} color={BRAND} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function FilterSelect({ label, value, options, open, onToggle, onChange, disabled }) {
  const { styles, MUTED } = React.useContext(InstallThemeContext);
  return (
    <View style={[styles.filterField, open && styles.filterFieldOpen]}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity style={styles.filterButton} onPress={onToggle} disabled={disabled} activeOpacity={0.85}>
        <Text style={styles.filterValue} numberOfLines={1}>
          {value}
        </Text>
        <BootstrapIcon name="chevron-down" size={14} color={MUTED} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.filterMenu}>
          <ScrollView style={styles.filterMenuScroll} nestedScrollEnabled>
            {options.map((option) => {
              const selected = option === value;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterOption, selected && styles.filterOptionOn]}
                  onPress={() => onChange(option)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextOn]} numberOfLines={1}>
                    {option}
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
    { label: 'Preparing installation', status: phase > 0 ? 'done' : 'active' },
    { label: 'Generating image', status: phase > 1 ? 'done' : phase === 1 ? 'active' : 'wait' },
    { label: 'Finalizing preview', status: phase >= 2 ? 'active' : 'wait' },
  ];

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHead}>
        <ActivityIndicator color={BRAND} size="small" />
        <Text style={styles.progressTitle}>Generating Installation Preview</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.progressRow}>
          <View style={styles.progressIcon}>
            {row.status === 'done' ? (
              <BootstrapIcon name="check-circle-fill" size={16} color={BRAND} />
            ) : row.status === 'active' ? (
              <BootstrapIcon name="circle-fill" size={10} color={BRAND} />
            ) : (
              <BootstrapIcon name="circle" size={14} color="#CBD5E1" />
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

function createInstallStudioStyles(isDark = false) {
  const BRAND = isDark ? '#4DB896' : '#1D4533';
  const BRAND_SOFT = isDark ? 'rgba(77, 184, 150, 0.16)' : '#E8F0EC';
  const INK = isDark ? '#F5F7F6' : '#0F172A';
  const MUTED = isDark ? '#AAB4B0' : '#64748B';
  const LINE = isDark ? '#26332E' : '#E2E8F0';
  const SURFACE = isDark ? '#151C19' : '#FFFFFF';
  const CANVAS = isDark ? '#0F1412' : '#F6F8FA';

  return StyleSheet.create({
  root: {
    width: '100%',
    gap: 18,
    paddingBottom: 8,
  },
  pageHead: {
    gap: 6,
    paddingBottom: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: INK,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    maxWidth: 560,
  },
  columnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  colMain: {
    flex: 1.35,
    minWidth: 0,
    gap: 16,
  },
  colSide: {
    flex: 0.95,
    minWidth: 300,
    maxWidth: 460,
    gap: 14,
  },
  stack: {
    gap: 14,
  },
  anchor: {
    scrollMarginTop: 84,
  },
  section: {
    position: 'relative',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      },
    }),
  },
  sectionRaised: {
    zIndex: 30,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: INK,
  },
  textLink: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
  },
  noteLine: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND,
  },
  loader: {
    marginVertical: 16,
  },
  inlineEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: CANVAS,
    borderRadius: 12,
  },
  inlineEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  inlineEmptyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  choiceSlot: {
    width: '50%',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  choiceSlotWide: {
    width: 188,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  partSlotWide: {
    width: '33.333%',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  choiceCard: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    backgroundColor: SURFACE,
    padding: 8,
    gap: 4,
    minHeight: 168,
  },
  choiceCardOn: {
    borderColor: BRAND,
    borderWidth: 1.5,
    backgroundColor: BRAND_SOFT,
  },
  choiceImageWrap: {
    position: 'relative',
  },
  choiceImage: {
    width: '100%',
    height: 108,
    borderRadius: 10,
    backgroundColor: '#EEF2F4',
  },
  partImageWrap: {
    position: 'relative',
  },
  partImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: '#EEF2F4',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_SOFT,
  },
  selectedMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  choiceTitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: INK,
  },
  choiceMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
  },
  choiceBrand: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: MUTED,
  },
  choicePrice: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: BRAND,
  },
  warnLine: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: CANVAS,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabOn: {
    backgroundColor: BRAND,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabTextOn: {
    color: '#FFFFFF',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    backgroundColor: CANVAS,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  search: {
    flex: 1,
    fontSize: 14,
    color: INK,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    zIndex: 5,
  },
  filterField: {
    flex: 1,
    gap: 6,
    position: 'relative',
    zIndex: 1,
  },
  filterFieldOpen: {
    zIndex: 40,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: MUTED,
  },
  filterButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: INK,
  },
  filterMenu: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    zIndex: 50,
    ...Platform.select({
      web: { boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  filterMenuScroll: {
    maxHeight: 220,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterOptionOn: {
    backgroundColor: BRAND_SOFT,
  },
  filterOptionText: {
    fontSize: 13,
    color: INK,
  },
  filterOptionTextOn: {
    fontWeight: '700',
    color: BRAND,
  },
  quietLine: {
    fontSize: 13,
    color: MUTED,
    paddingVertical: 8,
  },
  uploadDrop: {
    minHeight: 176,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C5D5CC',
    borderRadius: 14,
    backgroundColor: '#F7FAF8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 18,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  uploadHint: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
  },
  uploadDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
    padding: 10,
    backgroundColor: SURFACE,
  },
  uploadDoneImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#EEF2F4',
  },
  uploadDoneCopy: {
    flex: 1,
    gap: 4,
  },
  notesInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    backgroundColor: CANVAS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
    textAlignVertical: 'top',
  },
  sideCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      },
    }),
  },
  sideLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: MUTED,
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewThumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#EEF2F4',
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: INK,
  },
  previewSpec: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  previewMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#C5D5CC',
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    textAlign: 'center',
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 10,
  },
  pairItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  pairImage: {
    width: '100%',
    maxWidth: 148,
    height: 108,
    borderRadius: 12,
    backgroundColor: '#EEF2F4',
  },
  pairLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  pairMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 40,
    backgroundColor: BRAND_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyLine: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    textAlign: 'center',
  },
  formNotice: {
    fontSize: 13,
    lineHeight: 18,
    color: '#B45309',
    textAlign: 'center',
  },
  generateBtn: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  generateBtnOff: {
    backgroundColor: '#E8EDF2',
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  generateBtnTextOff: {
    color: '#94A3B8',
  },
  progressCard: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    backgroundColor: CANVAS,
    padding: 14,
    gap: 10,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressIcon: {
    width: 18,
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: INK,
  },
  progressLabelActive: {
    fontWeight: '700',
    color: BRAND,
  },
  progressLabelWait: {
    color: '#94A3B8',
  },
  resultCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      },
    }),
  },
  resultHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: INK,
  },
  resultFrame: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  resultFrameCompact: {
    height: 240,
  },
  resultFrameWide: {
    height: 420,
  },
  resultImage: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#F4F7F5',
  },
  resultImageWrap: {
    position: 'relative',
    width: '100%',
  },
  floatingSaveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)', cursor: 'pointer' },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  floatingSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
  },
  saveNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  resultFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  resultFact: {
    flexGrow: 1,
    flexBasis: 140,
    gap: 2,
  },
  factLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
  },
  factValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: INK,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryBtn: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C5D5CC',
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
  },
  primaryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  saveImageBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: 130,
  },
  saveImageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveGarageBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: 130,
  },
  saveGarageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
  },
  saveGarageBtnSaved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  saveGarageBtnSavedText: {
    color: '#065F46',
  },
  cartBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: 130,
  },
  cartBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  adminUsageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  adminUsageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  usageIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  usageIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  limitAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  limitAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  limitAlertDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: '#7F1D1D',
  },
  cooldownAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  cooldownAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  cooldownAlertDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: '#92400E',
  },
  generateBtnCooldown: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
  },
  generateBtnCooldownText: {
    color: '#64748B',
  },
  pageHeadTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageHeadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedPreviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  savedPreviewsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
  },
  savedPreviewsBadge: {
    backgroundColor: BRAND,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPreviewsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  newPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  newPreviewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  savedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  savedModalSheet: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: SURFACE,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LINE,
    ...Platform.select({
      web: { boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  savedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: '#F8FAFC',
  },
  savedModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
  savedModalSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  savedModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedModalLoading: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  savedModalEmpty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  savedModalEmptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inlineEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
  },
  inlineEmptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    textAlign: 'center',
    maxWidth: 380,
  },
  savedBuildsScroll: {
    flex: 1,
  },
  savedBuildsGrid: {
    padding: 16,
    gap: 14,
  },
  savedBuildCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' },
    }),
  },
  savedBuildImageWrap: {
    width: 140,
    height: 120,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  savedBuildImage: {
    width: '100%',
    height: '100%',
  },
  savedBuildInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    gap: 6,
  },
  savedBuildTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  savedBuildPart: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND,
  },
  savedBuildDate: {
    fontSize: 11,
    color: MUTED,
  },
  savedBuildActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  savedBuildLoadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  savedBuildLoadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
    savedBuildIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: isDark ? '#1C2622' : '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

const lightStyles = createInstallStudioStyles(false);
const darkStyles = createInstallStudioStyles(true);
