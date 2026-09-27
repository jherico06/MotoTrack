import { useCallback, useEffect, useMemo, useState } from 'react';
import { customizationService } from '../services/customizationService';
import { motorcycleService } from '../services/motorcycleService';
import {
  CUSTOMIZATION_CATEGORIES,
  getCatalogBrands,
  getCatalogModels,
  getCatalogYears,
  getVehicleType,
} from '../data/motorcycleCatalog';

/**
 * Shared customization builder state for native + web Customizer pages.
 */
export function useCustomizationBuilder({ currentUser, initialProduct } = {}) {
  const [step, setStep] = useState('select-bike');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(null);
  const [bikePhotoUrl, setBikePhotoUrl] = useState(null);
  const [bikeColor, setBikeColor] = useState('');
  const [bikeMotorcycleId, setBikeMotorcycleId] = useState(null);
  const [garageBikes, setGarageBikes] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const [compatibleProducts, setCompatibleProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedParts, setSelectedParts] = useState([]);
  const [compatResult, setCompatResult] = useState(null);
  const [checkingCompat, setCheckingCompat] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [activeCustomization, setActiveCustomization] = useState(null);
  const [myCustomizations, setMyCustomizations] = useState([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const brands = useMemo(() => getCatalogBrands(), []);
  const models = useMemo(() => getCatalogModels(brand), [brand]);
  const years = useMemo(() => getCatalogYears(brand, model), [brand, model]);
  const categories = CUSTOMIZATION_CATEGORIES;

  const motorcycle = useMemo(() => {
    if (!brand || !model || !year) return null;
    return {
      brand,
      model,
      year: Number(year),
      motorcycle_id: bikeMotorcycleId,
      id: bikeMotorcycleId || `catalog-${brand}-${model}-${year}`.replace(/\s+/g, '-').toLowerCase(),
      photo_url: bikePhotoUrl || null,
      color: bikeColor || null,
      category: getVehicleType(brand, model),
      vehicleType: getVehicleType(brand, model),
    };
  }, [brand, model, year, bikePhotoUrl, bikeColor, bikeMotorcycleId]);

  const totalPrice = useMemo(
    () => customizationService.calculateTotal(selectedParts.map((p) => ({ price: p.price, quantity: 1 }))),
    [selectedParts]
  );

  const refreshGarageBikes = useCallback(() => {
    try {
      const list = motorcycleService.getMotorcycles(currentUser?.id) || [];
      setGarageBikes(Array.isArray(list) ? list : []);
    } catch (_e) {
      setGarageBikes([]);
    }
  }, [currentUser]);

  const refreshMyCustomizations = useCallback(async () => {
    if (!currentUser) {
      setMyCustomizations([]);
      return;
    }
    const list = await customizationService.listCustomizations({
      userId: currentUser.id,
      customerId: currentUser.customer_id,
    });
    setMyCustomizations(list || []);
  }, [currentUser]);

  useEffect(() => {
    refreshGarageBikes();
    const unsubMoto = motorcycleService.subscribe?.(() => refreshGarageBikes());
    return () => unsubMoto?.();
  }, [refreshGarageBikes]);

  // Auto-select primary registered motorcycle so preview uses the same model + photo
  useEffect(() => {
    if (bikeMotorcycleId || brand) return;
    if (!garageBikes.length) return;
    const primary = garageBikes.find((b) => b.is_primary) || garageBikes[0];
    if (primary?.brand && primary?.model && primary?.year) {
      selectGarageBike(primary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageBikes]);

  useEffect(() => {
    refreshMyCustomizations();
    const unsub = customizationService.subscribe(() => {
      refreshMyCustomizations();
    });
    return () => unsub?.();
  }, [refreshMyCustomizations]);

  useEffect(() => {
    if (initialProduct) {
      setSelectedParts((prev) => {
        const id = initialProduct.id || initialProduct.product_id;
        if (prev.some((p) => (p.id || p.product_id) === id)) return prev;
        return [...prev, initialProduct];
      });
    }
  }, [initialProduct]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!motorcycle) {
        setCompatibleProducts([]);
        return;
      }
      setLoadingProducts(true);
      try {
        const list = await customizationService.getCompatibleProducts(motorcycle, {
          category,
          search,
          compatibleOnly,
        });
        if (!cancelled) setCompatibleProducts(list);
      } catch (_e) {
        if (!cancelled) setCompatibleProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [motorcycle, category, search, compatibleOnly]);

  const selectGarageBike = (bike) => {
    if (!bike) return;
    setBrand(bike.brand || '');
    setModel(bike.model || '');
    setYear(bike.year ? Number(bike.year) : null);
    setBikePhotoUrl(bike.photo_url || null);
    setBikeColor(bike.color || '');
    setBikeMotorcycleId(bike.motorcycle_id || bike.id || null);
    setSelectedParts([]);
    setCompatResult(null);
    setPreviewUrl(null);
    setActiveCustomization(null);
    setSaveName(
      bike.nickname ||
        `My ${bike.brand || ''} ${bike.model || ''} ${bike.year || ''} Setup`.replace(/\s+/g, ' ').trim()
    );
    if (bike.brand && bike.model && bike.year) {
      setStep('customize');
      setInfo('Using your garage motorcycle for a more accurate preview.');
    } else {
      setError('This garage bike needs brand, model, and year.');
    }
  };

  const selectBrand = (next) => {
    setBrand(next);
    setModel('');
    setYear(null);
    setBikePhotoUrl(null);
    setBikeColor('');
    setBikeMotorcycleId(null);
    setSelectedParts([]);
    setCompatResult(null);
    setPreviewUrl(null);
    setActiveCustomization(null);
  };

  const selectModel = (next) => {
    setModel(next);
    setYear(null);
    setBikeMotorcycleId(null);
    setSelectedParts([]);
    setCompatResult(null);
    setPreviewUrl(null);
  };

  const selectYear = (next) => {
    setYear(Number(next));
    setCompatResult(null);
    setPreviewUrl(null);
    setSaveName(`My ${brand} ${model} ${next} Setup`);
    setStep('customize');
  };

  const togglePart = async (product) => {
    setError('');
    const pid = product.id || product.product_id;
    const exists = selectedParts.some((p) => (p.id || p.product_id) === pid);
    if (exists) {
      setSelectedParts((prev) => prev.filter((p) => (p.id || p.product_id) !== pid));
      setCompatResult(null);
      return { success: true, removed: true };
    }

    if (!motorcycle) {
      setError('Select your motorcycle first.');
      return { success: false };
    }

    const check = await customizationService.checkCompatibility({
      customerId: currentUser?.customer_id,
      motorcycle,
      productIds: [pid],
    });
    const item = check.items?.[0];
    if (!item?.compatible) {
      setError(
        item?.reason ||
          'This product is not marked as compatible with your selected motorcycle.'
      );
      return { success: false, incompatible: true };
    }

    if ((Number(product.stock) || 0) <= 0) {
      setError('Some selected products are currently out of stock.');
      return { success: false, outOfStock: true };
    }

    setSelectedParts((prev) => [...prev, { ...product, id: pid, product_id: pid, quantity: 1 }]);
    setCompatResult(null);
    return { success: true };
  };

  const checkCompatibility = async () => {
    if (!motorcycle) {
      setError('Select your motorcycle first.');
      return null;
    }
    if (!selectedParts.length) {
      setError('Select at least one part.');
      return null;
    }
    setCheckingCompat(true);
    setError('');
    try {
      const result = await customizationService.checkCompatibility({
        customerId: currentUser?.customer_id,
        motorcycle,
        productIds: selectedParts.map((p) => p.id || p.product_id),
      });
      setCompatResult(result);
      if (!result.compatible) {
        setError('This product is not marked as compatible with your selected motorcycle.');
      } else {
        setInfo('All selected parts are compatible with your motorcycle.');
      }
      return result;
    } finally {
      setCheckingCompat(false);
    }
  };

  const saveCustomization = async () => {
    if (!currentUser) {
      setError('Please sign in to save your customization.');
      return { success: false, needsAuth: true };
    }
    if (!motorcycle || !selectedParts.length) {
      setError('Select a motorcycle and at least one part.');
      return { success: false };
    }
    setSaving(true);
    setError('');
    try {
      const result = await customizationService.createCustomization({
        customerId: currentUser.customer_id,
        userId: currentUser.id,
        motorcycle,
        name: saveName || `My ${brand} ${model} Setup`,
        items: selectedParts,
        status: 'saved',
      });
      if (!result.success) {
        setError(result.error || 'Could not save customization.');
        return result;
      }
      setActiveCustomization(result.customization);
      setInfo('Customization saved.');
      setStep('saved');
      await refreshMyCustomizations();
      return result;
    } finally {
      setSaving(false);
    }
  };

  const generatePreview = async () => {
    setError('');
    if (!bikeMotorcycleId || String(bikeMotorcycleId).startsWith('catalog-')) {
      setError(
        'Select your registered motorcycle from My Garage so the preview uses the same model.'
      );
      return { success: false, needsGarageBike: true };
    }
    if (!bikePhotoUrl) {
      setError(
        'Your registered motorcycle needs a photo. Edit it in My Garage and upload a photo, then try again.'
      );
      return { success: false, needsPhoto: true };
    }
    if (!selectedParts.length) {
      setError('Select products to install on your motorcycle first.');
      return { success: false };
    }

    // Always re-save with current registered motorcycle photo/model
    const saved = await saveCustomization();
    if (!saved.success) return saved;
    const customization = saved.customization;

    setGenerating(true);
    setGenProgress({
      percentage: 5,
      message: `Installing selected parts onto your ${brand} ${model}...`,
    });
    try {
      const result = await customizationService.generatePreview(
        customization.id || customization.customization_id,
        { onProgress: setGenProgress }
      );
      if (!result.success) {
        setError(
          result.error ||
            'Unable to generate the preview right now. Your customization has not been lost.'
        );
        return result;
      }
      setPreviewUrl(result.previewImageUrl);
      setActiveCustomization(result.customization || customization);
      setStep('preview');
      setInfo(
        `Preview ready — your registered ${brand} ${model} with ${selectedParts.length} installed part(s).`
      );
      return result;
    } catch (_e) {
      setError('Unable to generate the preview right now. Your customization has not been lost.');
      return { success: false };
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  const addPartsToCart = async (addToCartFn) => {
    setError('');
    let customization = activeCustomization;
    if (!customization) {
      const saved = await saveCustomization();
      if (!saved.success) return saved;
      customization = saved.customization;
    }
    const result = await customizationService.addToCart(
      customization.id || customization.customization_id,
      addToCartFn
    );
    if (!result.success) {
      setError(result.error || 'Could not add parts to cart.');
      return result;
    }
    setInfo(`Added ${result.addedCount} part(s) to cart.`);
    return result;
  };

  const loadCustomization = (cust) => {
    if (!cust) return;
    setActiveCustomization(cust);
    setBrand(cust.motorcycle?.brand || '');
    setModel(cust.motorcycle?.model || '');
    setYear(cust.motorcycle?.year || null);
    setBikePhotoUrl(cust.motorcycle?.photo_url || null);
    setBikeColor(cust.motorcycle?.color || '');
    setBikeMotorcycleId(cust.motorcycle?.motorcycle_id || cust.motorcycleId || null);
    setSelectedParts(
      (cust.items || []).map((it) => ({
        id: it.productId || it.product_id,
        product_id: it.productId || it.product_id,
        name: it.name,
        brand: it.brand,
        category: it.category,
        price: it.price,
        quantity: it.quantity || 1,
      }))
    );
    setSaveName(cust.name || '');
    setPreviewUrl(cust.previewImageUrl || cust.preview_image_url || null);
    setStep(cust.previewImageUrl || cust.preview_image_url ? 'preview' : 'customize');
    setError('');
  };

  const resetBuilder = () => {
    setStep('select-bike');
    setBrand('');
    setModel('');
    setYear(null);
    setBikePhotoUrl(null);
    setBikeColor('');
    setBikeMotorcycleId(null);
    setSelectedParts([]);
    setCompatResult(null);
    setPreviewUrl(null);
    setActiveCustomization(null);
    setError('');
    setInfo('');
  };

  const editCustomization = () => {
    setStep('customize');
    setError('');
  };

  return {
    step,
    setStep,
    brand,
    model,
    year,
    brands,
    models,
    years,
    categories,
    category,
    setCategory,
    search,
    setSearch,
    compatibleOnly,
    setCompatibleOnly,
    motorcycle,
    bikePhotoUrl,
    bikeMotorcycleId,
    garageBikes,
    compatibleProducts,
    loadingProducts,
    selectedParts,
    totalPrice,
    compatResult,
    checkingCompat,
    saveName,
    setSaveName,
    saving,
    generating,
    genProgress,
    previewUrl,
    activeCustomization,
    myCustomizations,
    error,
    info,
    setError,
    setInfo,
    selectGarageBike,
    selectBrand,
    selectModel,
    selectYear,
    togglePart,
    checkCompatibility,
    saveCustomization,
    generatePreview,
    addPartsToCart,
    loadCustomization,
    resetBuilder,
    editCustomization,
    refreshMyCustomizations,
    formatMoney: customizationService.formatMoney,
  };
}

export default useCustomizationBuilder;
