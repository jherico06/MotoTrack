/**
 * Admin Promo Vouchers & Discounts - table + create/edit modal.
 * Preserves MotoTrack dark theme tokens and table styling patterns.
 * Wired into web + mobile AdminDashboard Promos tabs.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../common';
import ConfirmModal from '../modals/ConfirmModal.jsx';
import {
  promoService,
  PROMO_TYPES,
  APPLIES_TO,
} from '../../services/products/promoService.js';
import { productService } from '../../services/products/productService.js';
import { getThemeTokens } from '../../styles/theme.js';
import { pickImageFromFile } from '../../utils/imagePickerHelper.js';
import { uploadProductImage } from '../../utils/productImageUpload.js';

const BRAND = '#EA580C';
const BRAND_SOFT = '#FFF7ED';
const BRAND_SOFT_DARK = 'rgba(36, 39, 43, 0.42)';

export const BANNER_PRESETS = [
  {
    id: 'superbike-black',
    title: 'Sport Superbike',
    url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'sport-orange',
    title: 'Orange Racer',
    url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'cruiser-night',
    title: 'Cruiser Night',
    url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'streetfighter',
    title: 'Streetfighter',
    url: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'garage-custom',
    title: 'Garage Build',
    url: 'https://images.unsplash.com/photo-1558980664-769d59546b3d?auto=format&fit=crop&w=1000&q=80',
  },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildPromoModalStyles(tokens, isDark) {
  const border = isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0';
  const borderStrong = isDark ? 'rgba(255,255,255,0.16)' : '#CBD5E1';
  const inputBg = isDark ? tokens.bgSub : '#FFFFFF';
  const text = isDark ? tokens.textPrimary : '#0F172A';
  const muted = tokens.textMuted;
  const label = isDark ? tokens.textSecondary : '#475569';

  return StyleSheet.create({
    sheet: {
      backgroundColor: tokens.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      width: '100%',
      maxWidth: 640,
      maxHeight: '90%',
      overflow: 'hidden',
      flexDirection: 'column',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: isDark ? 0.45 : 0.14,
      shadowRadius: 28,
      elevation: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
      paddingRight: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: text,
      letterSpacing: -0.3,
      lineHeight: 24,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '500',
      color: muted,
      lineHeight: 18,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
      borderWidth: 1,
      borderColor: border,
    },
    body: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
    },
    bodyContent: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 8,
      gap: 20,
    },
    section: {
      gap: 12,
    },
    sectionHead: {
      gap: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: text,
      letterSpacing: -0.1,
    },
    sectionHint: {
      fontSize: 12,
      fontWeight: '500',
      color: muted,
      lineHeight: 16,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    typeCard: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 140,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: borderStrong,
      backgroundColor: isDark ? tokens.bgSub : '#F8FAFC',
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 8,
      minHeight: 104,
    },
    typeCardSelected: {
      borderColor: BRAND,
      backgroundColor: isDark ? BRAND_SOFT_DARK : BRAND_SOFT,
    },
    typeIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: border,
    },
    typeIconWrapSelected: {
      backgroundColor: BRAND,
      borderColor: BRAND,
    },
    typeTitle: {
      fontSize: 13.5,
      fontWeight: '600',
      color: text,
      letterSpacing: -0.1,
    },
    typeSub: {
      fontSize: 11.5,
      fontWeight: '500',
      color: muted,
      lineHeight: 15,
    },
    fieldStack: {
      gap: 12,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: 12,
    },
    fieldCol: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 11.5,
      fontWeight: '700',
      color: label,
      letterSpacing: 0.35,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: inputBg,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: borderStrong,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'web' ? 10 : 11,
      fontSize: 14,
      fontWeight: '600',
      color: text,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    },
    inputFocused: {
      borderColor: BRAND,
      ...(Platform.OS === 'web'
        ? { boxShadow: isDark ? '0 0 0 3px rgba(52, 211, 153, 0.18)' : '0 0 0 3px rgba(234, 88, 12, 0.18)' }
        : {}),
    },
    inputError: {
      borderColor: '#EF4444',
    },
    inputSuffixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    suffix: {
      fontSize: 14,
      fontWeight: '600',
      color: text,
      minWidth: 18,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 11.5,
      fontWeight: '600',
      marginTop: -2,
    },
    imagePreviewBox: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: borderStrong,
      backgroundColor: isDark ? tokens.bgSub : '#F8FAFC',
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePreviewImg: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 16,
    },
    imagePlaceholderText: {
      fontSize: 12,
      fontWeight: '600',
      color: muted,
      textAlign: 'center',
    },
    photoActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: BRAND,
    },
    uploadBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    removePhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
    },
    removePhotoBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#FCA5A5' : '#DC2626',
    },
    presetLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: muted,
      marginTop: 2,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    presetThumbBtn: {
      width: 58,
      height: 42,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: border,
      overflow: 'hidden',
      backgroundColor: isDark ? tokens.bgSub : '#E2E8F0',
    },
    presetThumbBtnActive: {
      borderColor: BRAND,
      borderWidth: 2.5,
    },
    presetThumbImg: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    segmentTrack: {
      flexDirection: 'row',
      gap: 8,
      padding: 4,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
      borderWidth: 1,
      borderColor: border,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    segmentBtnSelected: {
      backgroundColor: isDark ? BRAND_SOFT_DARK : '#FFFFFF',
      borderColor: isDark ? BRAND : '#D1D5DB',
      ...(Platform.OS === 'web'
        ? { boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.06)' }
        : {}),
    },
    segmentRadio: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentRadioSelected: {
      borderColor: isDark ? '#34D399' : BRAND,
    },
    segmentRadioDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? '#34D399' : BRAND,
    },
    segmentLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: muted,
    },
    segmentLabelSelected: {
      color: text,
    },
    helperText: {
      fontSize: 12,
      fontWeight: '500',
      color: muted,
      lineHeight: 16,
    },
    productPicker: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: isDark ? tokens.bgSub : '#F8FAFC',
      padding: 12,
      gap: 10,
    },
    productToolbar: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    chipBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? BRAND_SOFT_DARK : BRAND_SOFT,
    },
    chipBtnMuted: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
    },
    chipBtnText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: isDark ? '#A7F3D0' : BRAND,
    },
    chipBtnTextMuted: {
      color: muted,
    },
    productList: {
      maxHeight: 148,
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      borderColor: BRAND,
      backgroundColor: BRAND,
    },
    productName: {
      fontSize: 12.5,
      fontWeight: '700',
      color: text,
    },
    productBrand: {
      fontSize: 11,
      fontWeight: '500',
      color: muted,
      marginTop: 1,
    },
    selectedWrap: {
      gap: 4,
      paddingTop: 2,
    },
    selectedTitle: {
      fontSize: 11.5,
      fontWeight: '600',
      color: isDark ? '#A7F3D0' : BRAND,
      marginBottom: 2,
    },
    selectedItem: {
      fontSize: 12,
      fontWeight: '600',
      color: text,
    },
    previewCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(143, 169, 154, 0.28)' : '#BBF7D0',
      backgroundColor: isDark ? 'rgba(234, 88, 12, 0.28)' : '#F0FDF4',
      padding: 14,
      gap: 8,
    },
    previewEyebrow: {
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: 0.7,
      color: isDark ? '#A7F3D0' : '#166534',
      textTransform: 'uppercase',
    },
    previewCode: {
      fontSize: 17,
      fontWeight: '600',
      color: text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      letterSpacing: 0.4,
    },
    previewHeadline: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#A7F3D0' : BRAND,
      marginTop: -2,
    },
    previewMeta: {
      gap: 3,
      marginTop: 2,
    },
    previewMetaText: {
      fontSize: 12,
      fontWeight: '500',
      color: muted,
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: border,
      backgroundColor: tokens.bgCard,
    },
    btnSecondary: {
      minHeight: 40,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: borderStrong,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondaryText: {
      fontSize: 13,
      fontWeight: '700',
      color: label,
    },
    btnPrimary: {
      minHeight: 40,
      minWidth: 132,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: BRAND,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 4px 12px rgba(234, 88, 12, 0.28)' }
        : {}),
    },
    btnPrimaryText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}

function emptyForm() {
  return {
    code: '',
    description: '',
    imageUrl: '',
    promoType: PROMO_TYPES.FREE_SHIPPING,
    discountPercent: '10',
    appliesTo: APPLIES_TO.ALL_PRODUCTS,
    productIds: [],
    startDate: todayIsoDate(),
    endDate: '',
    usageLimit: '',
    minimumOrderAmount: '',
  };
}

function formFromPromo(promo) {
  if (!promo) return emptyForm();
  return {
    code: promo.code || '',
    description: promo.description || '',
    imageUrl: promo.imageUrl || promo.image_url || promo.bannerImage || promo.banner_image || '',
    promoType: promo.promoType || PROMO_TYPES.PERCENT_OFF,
    discountPercent: String(promo.discountPercent ?? 10),
    appliesTo: promo.appliesTo || APPLIES_TO.ALL_PRODUCTS,
    productIds: [...(promo.productIds || [])],
    startDate: promoService.parseDateOnly(promo.startDate) || todayIsoDate(),
    endDate: promoService.parseDateOnly(promo.endDate) || '',
    usageLimit: promo.usageLimit != null ? String(promo.usageLimit) : '',
    minimumOrderAmount:
      promo.minimumOrderAmount != null ? String(promo.minimumOrderAmount) : '',
  };
}

const PromosAdminPanel = forwardRef(function PromosAdminPanel(
  {
    styles: adminStyles,
    isDarkMode = true,
    onToast,
    onPromosChange,
    isDesktop = true,
    hideInternalCreateButton = false,
  },
  ref
) {
  const tokens = useMemo(() => getThemeTokens(isDarkMode), [isDarkMode]);
  const s = adminStyles;
  const ms = useMemo(() => buildPromoModalStyles(tokens, isDarkMode), [tokens, isDarkMode]);

  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [prm, prods] = await Promise.all([
        promoService.getPromos({ force: true }),
        productService.getProducts(),
      ]);
      setPromos(prm || []);
      onPromosChange?.(prm || []);
      setProducts(
        (prods || []).map((p) => ({
          id: String(p.id || p.product_id),
          name: p.name || 'Unnamed product',
          brand: p.brand || '',
          price: Number(p.price || 0),
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [onPromosChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = useCallback(() => {
    setEditingPromo(null);
    setForm(emptyForm());
    setErrors({});
    setProductSearch('');
    setModalOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({ openCreate, refresh }), [openCreate, refresh]);

  const openEdit = (promo) => {
    setEditingPromo(promo);
    setForm(formFromPromo(promo));
    setErrors({});
    setProductSearch('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingPromo(null);
    setErrors({});
    setFocusedField(null);
  };

  const inputStyle = (name) => [
    ms.input,
    focusedField === name && ms.inputFocused,
    errors[name] && ms.inputError,
  ];

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const selectedProducts = useMemo(() => {
    const set = new Set(form.productIds.map(String));
    return products.filter((p) => set.has(p.id));
  }, [products, form.productIds]);

  const toggleProduct = (id) => {
    const sid = String(id);
    setForm((prev) => {
      const has = prev.productIds.includes(sid);
      return {
        ...prev,
        productIds: has
          ? prev.productIds.filter((x) => x !== sid)
          : [...prev.productIds, sid],
      };
    });
    setErrors((prev) => {
      if (!prev.productIds) return prev;
      const next = { ...prev };
      delete next.productIds;
      return next;
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredProducts.map((p) => p.id);
    setForm((prev) => ({
      ...prev,
      productIds: [...new Set([...prev.productIds, ...ids])],
    }));
  };

  const clearSelection = () => {
    setForm((prev) => ({ ...prev, productIds: [] }));
  };

  const preview = useMemo(() => {
    const pct = Number(form.discountPercent || 0);
    const isFreeShip = form.promoType === PROMO_TYPES.FREE_SHIPPING;
    const isFreeInstall = form.promoType === PROMO_TYPES.FREE_INSTALLATION;
    const isNonPercent = isFreeShip || isFreeInstall;
    return {
      code: (form.code || 'CODE').trim().toUpperCase() || 'CODE',
      headline: isFreeShip
        ? 'Free Shipping'
        : isFreeInstall
          ? 'Free Installation'
          : Number.isFinite(pct) && pct > 0
            ? `${pct}% OFF`
            : 'Percentage Off',
      description:
        form.description ||
        (isFreeShip
          ? 'Free Shipping Promo'
          : isFreeInstall
            ? 'Free Installation Promo'
            : pct > 0
              ? `${pct}% discount`
              : ''),
      typeLabel: promoService.promoTypeLabel(form.promoType),
      appliesLabel:
        form.appliesTo === APPLIES_TO.ALL_PRODUCTS
          ? 'All Products'
          : `${form.productIds.length} Selected Product${form.productIds.length === 1 ? '' : 's'}`,
      validity: promoService.formatValidityRange(
        form.startDate ? `${form.startDate}T00:00:00` : null,
        form.endDate ? `${form.endDate}T23:59:59` : null
      ),
      discountLine: isNonPercent ? null : Number.isFinite(pct) ? `${pct}%` : null,
    };
  }, [form]);

  const handlePickAndUploadPhoto = async () => {
    try {
      const res = await pickImageFromFile();
      if (!res.success) {
        if (res.error && res.error !== 'Selection cancelled' && res.error !== 'Capture cancelled') {
          onToast?.(res.error);
        }
        return;
      }

      setUploadingImage(true);
      const uploadRes = await uploadProductImage(res.uri, { folder: 'promos' });
      if (uploadRes.success && uploadRes.url) {
        setField('imageUrl', uploadRes.url);
        onToast?.('Banner photo uploaded successfully!');
      } else {
        setField('imageUrl', res.uri);
        onToast?.('Banner photo attached!');
      }
    } catch (e) {
      console.warn('Banner image picker error:', e);
      onToast?.(e?.message || 'Could not attach image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectPreset = (url) => {
    setField('imageUrl', url);
  };

  const handleRemovePhoto = () => {
    setField('imageUrl', '');
  };

  const handleSave = async () => {
    const payload = {
      code: form.code,
      description: form.description,
      imageUrl: form.imageUrl,
      promoType: form.promoType,
      discountPercent: form.discountPercent,
      appliesTo: form.appliesTo,
      productIds: form.productIds,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      usageLimit: form.usageLimit === '' ? null : form.usageLimit,
      minimumOrderAmount: form.minimumOrderAmount === '' ? null : form.minimumOrderAmount,
      isActive: editingPromo ? editingPromo.isActive : true,
    };

    const check = promoService.validateAdminPayload(payload);
    if (!check.valid) {
      setErrors(check.errors || {});
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editingPromo) {
        res = await promoService.updatePromo(editingPromo.promo_id, payload);
      } else {
        res = await promoService.addPromo(payload);
      }

      if (!res.success) {
        if (res.errors) setErrors(res.errors);
        else onToast?.(res.error || 'Could not save promo');
        return;
      }

      setPromos((prev) => {
        const next = prev.filter((p) => p.promo_id !== res.promo.promo_id);
        return [res.promo, ...next];
      });
      setModalOpen(false);
      setEditingPromo(null);
      onToast?.(
        editingPromo
          ? `Updated promo "${res.promo.code}"`
          : `Created promo "${res.promo.code}"`
      );
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (promo) => {
    if (!promo?.promo_id || togglingId === promo.promo_id) return;

    const nextActive = !promo.isActive;
    const previous = {
      isActive: promo.isActive,
      status: promo.status || (promo.isActive ? 'active' : 'inactive'),
    };

    // Optimistic UI — flip immediately, then persist in the background.
    setTogglingId(promo.promo_id);
    setPromos((prev) => {
      const next = prev.map((p) =>
        p.promo_id === promo.promo_id
          ? { ...p, isActive: nextActive, status: nextActive ? 'active' : 'inactive' }
          : p
      );
      onPromosChange?.(next);
      return next;
    });

    try {
      const res = await promoService.updatePromo(promo.promo_id, { isActive: nextActive });
      if (!res?.success) {
        setPromos((prev) => {
          const next = prev.map((p) =>
            p.promo_id === promo.promo_id
              ? { ...p, isActive: previous.isActive, status: previous.status }
              : p
          );
          onPromosChange?.(next);
          return next;
        });
        onToast?.(res?.error || 'Could not update promo status');
        return;
      }
      onToast?.(`Promo ${promo.code} is now ${nextActive ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (e) {
      setPromos((prev) => {
        const next = prev.map((p) =>
          p.promo_id === promo.promo_id
            ? { ...p, isActive: previous.isActive, status: previous.status }
            : p
        );
        onPromosChange?.(next);
        return next;
      });
      onToast?.(e?.message || 'Could not update promo status');
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const code = deleteTarget.code;
    await promoService.deletePromo(deleteTarget.promo_id);
    setPromos((prev) => {
      const next = prev.filter((p) => p.promo_id !== deleteTarget.promo_id);
      onPromosChange?.(next);
      return next;
    });
    setDeleteTarget(null);
    onToast?.(`Deleted promo code ${code}`);
  };

  const FieldError = ({ name }) =>
    errors[name] ? <Text style={ms.errorText}>{errors[name]}</Text> : null;

  return (
    <View>
      {!hideInternalCreateButton ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginBottom: 14,
          }}
        >
          <TouchableOpacity style={s.addBtnPrimary} onPress={openCreate} activeOpacity={0.85}>
            <BootstrapIcon name="plus-lg" size={13} color="#FFFFFF" />
            <Text style={s.addBtnPrimaryText}>{isDesktop ? 'Create Voucher' : '+ Promo'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={s.tableCard}>
        {loading ? (
          <ActivityIndicator color={tokens.accentBrand} style={{ marginVertical: 28 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
          >
            <View style={{ width: '100%', minWidth: 1100, flexGrow: 1 }}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.tableHeaderCell, { flex: 2, minWidth: 180 }]}>Promo & Photo</Text>
                <Text style={[s.tableHeaderCell, { flex: 2, minWidth: 160 }]}>Description</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.2, minWidth: 110 }]}>Promo Type</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.3, minWidth: 120 }]}>Applies To</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.5, minWidth: 140 }]}>Validity</Text>
                <Text style={[s.tableHeaderCell, { flex: 1.1, minWidth: 100, textAlign: 'center' }]}>
                  Status
                </Text>
                <Text style={[s.tableHeaderCell, { flex: 1.4, minWidth: 130, textAlign: 'center' }]}>
                  Actions
                </Text>
              </View>

              {promos.length === 0 ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <Text style={{ color: tokens.textMuted, fontWeight: '600' }}>
                    No promo vouchers yet. Create one to get started.
                  </Text>
                </View>
              ) : (
                promos.map((prm) => (
                  <View
                    key={prm.promo_id || prm.code}
                    style={[
                      s.tableRow,
                      !prm.isActive && {
                        opacity: 0.75,
                        backgroundColor: isDarkMode ? tokens.bgSub : '#F8FAFC',
                      },
                    ]}
                  >
                    <View
                      style={{
                        flex: 2,
                        minWidth: 180,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingRight: 8,
                      }}
                    >
                      {prm.imageUrl ? (
                        <Image
                          source={{ uri: prm.imageUrl }}
                          style={{
                            width: 48,
                            height: 36,
                            borderRadius: 6,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 48,
                            height: 36,
                            borderRadius: 6,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                          }}
                        >
                          <BootstrapIcon name="image" size={14} color={tokens.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            s.tableTitle,
                            {
                              color: prm.isActive
                                ? isDarkMode
                                  ? tokens.accentBrand
                                  : '#EA580C'
                                : isDarkMode
                                  ? tokens.textMuted
                                  : '#64748B',
                              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {prm.code}
                        </Text>
                        <Text style={s.tableSub} numberOfLines={1}>
                          {promoService.discountLabel(prm)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flex: 2, minWidth: 160, paddingRight: 8 }}>
                      <Text style={s.tableTitle} numberOfLines={1}>
                        {prm.description || '—'}
                      </Text>
                    </View>

                    <View style={{ flex: 1.2, minWidth: 110, paddingRight: 8, justifyContent: 'center' }}>
                      <Text style={s.tableTitle} numberOfLines={1}>
                        {promoService.promoTypeLabel(prm.promoType)}
                      </Text>
                    </View>

                    <View style={{ flex: 1.3, minWidth: 120, paddingRight: 8, justifyContent: 'center' }}>
                      <Text style={s.tableTitle} numberOfLines={1}>
                        {promoService.appliesToLabel(prm)}
                      </Text>
                    </View>

                    <View style={{ flex: 1.5, minWidth: 140, paddingRight: 8, justifyContent: 'center' }}>
                      <Text style={s.tableSub} numberOfLines={2}>
                        {promoService.formatValidityRange(prm.startDate, prm.endDate)}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1.1,
                        minWidth: 100,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={[
                          s.tableStatusPill,
                          {
                            backgroundColor: prm.isActive
                              ? '#2E7D32'
                              : isDarkMode
                                ? 'rgba(245, 158, 11, 0.18)'
                                : '#FEF3C7',
                            borderRadius: prm.isActive ? 6 : 999,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.tableStatusPillText,
                            {
                              color: prm.isActive
                                ? '#FFFFFF'
                                : isDarkMode
                                  ? '#FBBF24'
                                  : '#B45309',
                            },
                          ]}
                        >
                          {prm.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flex: 1.4,
                        minWidth: 130,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleToggle(prm)}
                        activeOpacity={0.85}
                        disabled={togglingId === prm.promo_id}
                        accessibilityRole="switch"
                        accessibilityState={{
                          checked: !!prm.isActive,
                          busy: togglingId === prm.promo_id,
                        }}
                        accessibilityLabel={prm.isActive ? 'Disable voucher' : 'Enable voucher'}
                        style={{
                          width: 44,
                          height: 26,
                          borderRadius: 999,
                          paddingHorizontal: 3,
                          justifyContent: 'center',
                          opacity: togglingId === prm.promo_id ? 0.7 : 1,
                          backgroundColor: prm.isActive
                            ? '#EA580C'
                            : isDarkMode
                              ? '#334155'
                              : '#CBD5E1',
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: '#FFFFFF',
                            alignSelf: prm.isActive ? 'flex-end' : 'flex-start',
                          }}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.actionIconBtn, s.actionIconBtnEdit]}
                        onPress={() => openEdit(prm)}
                        activeOpacity={0.8}
                        accessibilityLabel="Edit promo"
                      >
                        <BootstrapIcon
                          name="pencil"
                          size={13}
                          color={isDarkMode ? '#93C5FD' : '#2563EB'}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.actionIconBtn, s.actionIconBtnDanger]}
                        onPress={() => setDeleteTarget(prm)}
                        activeOpacity={0.8}
                        accessibilityLabel="Delete promo"
                      >
                        <BootstrapIcon
                          name="trash3"
                          size={13}
                          color={isDarkMode ? tokens.statusDangerText : '#EF4444'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Create / Edit Modal */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={ms.sheet}>
            <View style={ms.header}>
              <View style={ms.headerCopy}>
                <Text style={ms.title}>
                  {editingPromo ? 'Edit Promo Voucher' : 'Create Promo Voucher'}
                </Text>
                <Text style={ms.subtitle}>
                  {editingPromo
                    ? 'Update promotion rules, eligibility, and validity.'
                    : 'Set the promotion type, details, eligibility, and limits.'}
                </Text>
              </View>
              <TouchableOpacity
                style={ms.closeBtn}
                onPress={closeModal}
                disabled={saving}
                accessibilityLabel="Close modal"
                accessibilityRole="button"
              >
                <BootstrapIcon name="x-lg" size={14} color={isDarkMode ? tokens.textMuted : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={ms.body}
              contentContainerStyle={ms.bodyContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {/* Promotion Type */}
              <View style={ms.section}>
                <View style={ms.sectionHead}>
                  <Text style={ms.sectionTitle}>Promotion Type</Text>
                  <Text style={ms.sectionHint}>Choose how this voucher rewards the customer.</Text>
                </View>
                <View style={ms.typeRow}>
                  {[
                    {
                      type: PROMO_TYPES.FREE_SHIPPING,
                      icon: 'truck',
                      title: 'Free Shipping',
                      sub: 'Waive shipping fees on eligible orders.',
                    },
                    {
                      type: PROMO_TYPES.PERCENT_OFF,
                      icon: 'ticket-perforated',
                      title: 'Percentage Off',
                      sub: 'Discount product price by a percentage.',
                    },
                    {
                      type: PROMO_TYPES.FREE_INSTALLATION,
                      icon: 'tools',
                      title: 'Free Installation',
                      sub: 'Waive install fee when booking AI install for selected products.',
                    },
                  ].map((opt) => {
                    const selected = form.promoType === opt.type;
                    return (
                      <TouchableOpacity
                        key={opt.type}
                        onPress={() => {
                          setField('promoType', opt.type);
                          if (opt.type === PROMO_TYPES.FREE_INSTALLATION) {
                            setField('appliesTo', APPLIES_TO.SELECTED_PRODUCTS);
                          }
                        }}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[ms.typeCard, selected && ms.typeCardSelected]}
                      >
                        <View style={[ms.typeIconWrap, selected && ms.typeIconWrapSelected]}>
                          <BootstrapIcon
                            name={opt.icon}
                            size={15}
                            color={selected ? '#FFFFFF' : tokens.textMuted}
                          />
                        </View>
                        <Text style={ms.typeTitle}>{opt.title}</Text>
                        <Text style={ms.typeSub}>{opt.sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <FieldError name="promoType" />
              </View>

              {/* Promo Details */}
              <View style={ms.section}>
                <View style={ms.sectionHead}>
                  <Text style={ms.sectionTitle}>Promo Details</Text>
                  <Text style={ms.sectionHint}>Code customers enter at checkout.</Text>
                </View>

                <View style={ms.fieldStack}>
                  <View style={ms.fieldRow}>
                    <View style={ms.fieldCol}>
                      <Text style={ms.label}>Promo Code</Text>
                      <TextInput
                        style={inputStyle('code')}
                        value={form.code}
                        onChangeText={(v) => setField('code', v.toUpperCase())}
                        onFocus={() => setFocusedField('code')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. FREESHIP"
                        autoCapitalize="characters"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                        accessibilityLabel="Promo code"
                      />
                      <FieldError name="code" />
                    </View>

                    {form.promoType === PROMO_TYPES.PERCENT_OFF ? (
                      <View style={ms.fieldCol}>
                        <Text style={ms.label}>Discount Percentage</Text>
                        <View style={ms.inputSuffixRow}>
                          <TextInput
                            style={[...inputStyle('discountPercent'), { flex: 1 }]}
                            keyboardType="numeric"
                            value={form.discountPercent}
                            onChangeText={(v) =>
                              setField('discountPercent', v.replace(/[^0-9.]/g, ''))
                            }
                            onFocus={() => setFocusedField('discountPercent')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="10"
                            placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                            accessibilityLabel="Discount percentage"
                          />
                          <Text style={ms.suffix}>%</Text>
                        </View>
                        <FieldError name="discountPercent" />
                      </View>
                    ) : null}
                  </View>

                  <View style={ms.field}>
                    <Text style={ms.label}>Description</Text>
                    <TextInput
                      style={inputStyle('description')}
                      value={form.description}
                      onChangeText={(v) => setField('description', v)}
                      onFocus={() => setFocusedField('description')}
                      onBlur={() => setFocusedField(null)}
                      placeholder={
                        form.promoType === PROMO_TYPES.FREE_SHIPPING
                          ? 'Free shipping promo'
                          : form.promoType === PROMO_TYPES.FREE_INSTALLATION
                            ? 'Free installation on selected product'
                            : '10% discount on selected products'
                      }
                      placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                      accessibilityLabel="Promo description"
                    />
                  </View>
                </View>
              </View>

              {/* Banner Photo Section */}
              <View style={ms.section}>
                <View style={ms.sectionHead}>
                  <Text style={ms.sectionTitle}>Banner Photo</Text>
                  <Text style={ms.sectionHint}>
                    Upload, choose, or link a motorcycle photo for the storefront hero banner.
                  </Text>
                </View>

                <View style={ms.imagePreviewBox}>
                  {form.imageUrl ? (
                    <>
                      <Image source={{ uri: form.imageUrl }} style={ms.imagePreviewImg} />
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          left: 8,
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.5 }}>
                          ACTIVE BANNER PHOTO
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={ms.imagePlaceholder}>
                      <BootstrapIcon name="image" size={26} color={tokens.textMuted} />
                      <Text style={ms.imagePlaceholderText}>
                        No custom photo set (storefront will cycle default high-res motorcycle photos)
                      </Text>
                    </View>
                  )}
                </View>

                {/* Upload & Remove buttons */}
                <View style={ms.photoActionsRow}>
                  <TouchableOpacity
                    style={[ms.uploadBtn, uploadingImage && { opacity: 0.7 }]}
                    onPress={handlePickAndUploadPhoto}
                    disabled={uploadingImage}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Upload banner photo"
                  >
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <BootstrapIcon name="cloud-arrow-up-fill" size={14} color="#FFFFFF" />
                    )}
                    <Text style={ms.uploadBtnText}>
                      {uploadingImage
                        ? 'Uploading Photo...'
                        : form.imageUrl
                          ? 'Change / Upload Photo'
                          : 'Upload Banner Photo'}
                    </Text>
                  </TouchableOpacity>

                  {form.imageUrl ? (
                    <TouchableOpacity
                      style={ms.removePhotoBtn}
                      onPress={handleRemovePhoto}
                      disabled={uploadingImage}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Remove banner photo"
                    >
                      <BootstrapIcon name="trash3" size={12} color={isDarkMode ? '#FCA5A5' : '#DC2626'} />
                      <Text style={ms.removePhotoBtnText}>Remove Photo</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Preset Motorcycle Photos */}
                <View style={{ gap: 6 }}>
                  <Text style={ms.presetLabel}>Quick Presets (Click to apply):</Text>
                  <View style={ms.presetRow}>
                    {BANNER_PRESETS.map((preset) => {
                      const isSelected = form.imageUrl === preset.url;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[ms.presetThumbBtn, isSelected && ms.presetThumbBtnActive]}
                          onPress={() => handleSelectPreset(preset.url)}
                          activeOpacity={0.8}
                          accessibilityLabel={`Preset ${preset.title}`}
                        >
                          <Image source={{ uri: preset.url }} style={ms.presetThumbImg} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Direct Image URL input */}
                <View style={ms.field}>
                  <Text style={ms.label}>Or Direct Image URL</Text>
                  <TextInput
                    style={inputStyle('imageUrl')}
                    value={form.imageUrl}
                    onChangeText={(v) => setField('imageUrl', v)}
                    onFocus={() => setFocusedField('imageUrl')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="https://images.unsplash.com/... or paste image URL"
                    placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Direct image URL"
                  />
                </View>
              </View>

              {/* Product Eligibility */}
              <View style={ms.section}>
                <View style={ms.sectionHead}>
                  <Text style={ms.sectionTitle}>Product Eligibility</Text>
                  <Text style={ms.sectionHint}>Decide which products this promo can apply to.</Text>
                </View>

                <View style={ms.segmentTrack}>
                  {[
                    { value: APPLIES_TO.ALL_PRODUCTS, label: 'All Products' },
                    { value: APPLIES_TO.SELECTED_PRODUCTS, label: 'Selected Products' },
                  ].map((opt) => {
                    const selected = form.appliesTo === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setField('appliesTo', opt.value)}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[ms.segmentBtn, selected && ms.segmentBtnSelected]}
                      >
                        <View style={[ms.segmentRadio, selected && ms.segmentRadioSelected]}>
                          {selected ? <View style={ms.segmentRadioDot} /> : null}
                        </View>
                        <Text style={[ms.segmentLabel, selected && ms.segmentLabelSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {form.appliesTo === APPLIES_TO.ALL_PRODUCTS ? (
                  <Text style={ms.helperText}>All products are eligible for this promo.</Text>
                ) : (
                  <View style={ms.productPicker}>
                    <TextInput
                      style={inputStyle('productSearch')}
                      value={productSearch}
                      onChangeText={setProductSearch}
                      onFocus={() => setFocusedField('productSearch')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Search products..."
                      placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                      accessibilityLabel="Search products"
                    />

                    <View style={ms.productToolbar}>
                      <TouchableOpacity
                        onPress={selectAllFiltered}
                        style={ms.chipBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={ms.chipBtnText}>Select All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={clearSelection}
                        style={[ms.chipBtn, ms.chipBtnMuted]}
                        activeOpacity={0.8}
                      >
                        <Text style={[ms.chipBtnText, ms.chipBtnTextMuted]}>Clear Selection</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={ms.productList} nestedScrollEnabled>
                      {filteredProducts.map((p) => {
                        const checked = form.productIds.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => toggleProduct(p.id)}
                            style={ms.productRow}
                            activeOpacity={0.8}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                          >
                            <View style={[ms.checkbox, checked && ms.checkboxChecked]}>
                              {checked ? <BootstrapIcon name="check" size={11} color="#FFF" /> : null}
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={ms.productName} numberOfLines={1}>
                                {p.name}
                              </Text>
                              {p.brand ? <Text style={ms.productBrand}>{p.brand}</Text> : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      {filteredProducts.length === 0 ? (
                        <Text style={[ms.helperText, { paddingVertical: 8 }]}>No products found.</Text>
                      ) : null}
                    </ScrollView>

                    {selectedProducts.length > 0 ? (
                      <View style={ms.selectedWrap}>
                        <Text style={ms.selectedTitle}>
                          Selected Products ({selectedProducts.length})
                        </Text>
                        {selectedProducts.map((p) => (
                          <Text key={`sel-${p.id}`} style={ms.selectedItem} numberOfLines={1}>
                            ✓ {p.name}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <FieldError name="productIds" />
                  </View>
                )}
              </View>

              {/* Validity & Limits */}
              <View style={ms.section}>
                <View style={ms.sectionHead}>
                  <Text style={ms.sectionTitle}>Validity & Limits</Text>
                  <Text style={ms.sectionHint}>Optional constraints for when and how often this promo can be used.</Text>
                </View>

                <View style={ms.fieldStack}>
                  <View style={ms.fieldRow}>
                    <View style={ms.fieldCol}>
                      <Text style={ms.label}>Start Date</Text>
                      <TextInput
                        style={inputStyle('startDate')}
                        value={form.startDate}
                        onChangeText={(v) => setField('startDate', v)}
                        onFocus={() => setFocusedField('startDate')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                        accessibilityLabel="Start date"
                      />
                    </View>
                    <View style={ms.fieldCol}>
                      <Text style={ms.label}>End Date</Text>
                      <TextInput
                        style={inputStyle('endDate')}
                        value={form.endDate}
                        onChangeText={(v) => setField('endDate', v)}
                        onFocus={() => setFocusedField('endDate')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="YYYY-MM-DD (optional)"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                        accessibilityLabel="End date"
                      />
                      <FieldError name="endDate" />
                    </View>
                  </View>

                  <View style={ms.fieldRow}>
                    <View style={ms.fieldCol}>
                      <Text style={ms.label}>Usage Limit</Text>
                      <TextInput
                        style={inputStyle('usageLimit')}
                        keyboardType="numeric"
                        value={form.usageLimit}
                        onChangeText={(v) => setField('usageLimit', v.replace(/[^0-9]/g, ''))}
                        onFocus={() => setFocusedField('usageLimit')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Optional (e.g. 100)"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                        accessibilityLabel="Usage limit"
                      />
                      <FieldError name="usageLimit" />
                    </View>
                    <View style={ms.fieldCol}>
                      <Text style={ms.label}>Minimum Order Amount</Text>
                      <TextInput
                        style={inputStyle('minimumOrderAmount')}
                        keyboardType="numeric"
                        value={form.minimumOrderAmount}
                        onChangeText={(v) =>
                          setField('minimumOrderAmount', v.replace(/[^0-9.]/g, ''))
                        }
                        onFocus={() => setFocusedField('minimumOrderAmount')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Optional (e.g. 500)"
                        placeholderTextColor={isDarkMode ? tokens.placeholder : '#94A3B8'}
                        accessibilityLabel="Minimum order amount"
                      />
                      <FieldError name="minimumOrderAmount" />
                    </View>
                  </View>
                </View>
              </View>

              {/* Preview */}
              <View style={ms.previewCard}>
                <Text style={ms.previewEyebrow}>Promo Preview</Text>

                {form.imageUrl ? (
                  <View
                    style={{
                      height: 90,
                      borderRadius: 10,
                      overflow: 'hidden',
                      position: 'relative',
                      marginVertical: 4,
                      backgroundColor: '#20242B',
                    }}
                  >
                    <Image
                      source={{ uri: form.imageUrl }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '52%',
                        height: '100%',
                      }}
                      resizeMode="cover"
                    />
                    <View
                      style={{
                        flex: 1,
                        padding: 10,
                        justifyContent: 'center',
                        maxWidth: '54%',
                        zIndex: 2,
                      }}
                    >
                      <Text style={{ fontSize: 9.5, fontWeight: '600', color: BRAND, letterSpacing: 0.5 }}>
                        HERO BANNER PREVIEW
                      </Text>
                      <Text
                        style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF', marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {preview.headline}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }} numberOfLines={1}>
                        Use code: {preview.code}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Text style={ms.previewCode}>{preview.code}</Text>
                <Text style={ms.previewHeadline}>{preview.headline}</Text>
                {preview.description ? (
                  <Text style={ms.previewMetaText}>{preview.description}</Text>
                ) : null}
                <View style={ms.previewMeta}>
                  <Text style={ms.previewMetaText}>Type: {preview.typeLabel}</Text>
                  {preview.discountLine ? (
                    <Text style={ms.previewMetaText}>Discount: {preview.discountLine}</Text>
                  ) : null}
                  <Text style={ms.previewMetaText}>Applies To: {preview.appliesLabel}</Text>
                  <Text style={ms.previewMetaText}>Validity: {preview.validity}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={ms.footer}>
              <TouchableOpacity
                style={ms.btnSecondary}
                onPress={closeModal}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={ms.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ms.btnPrimary, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={editingPromo ? 'Save changes' : 'Create promo'}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={ms.btnPrimaryText}>
                    {editingPromo ? 'Save Changes' : 'Create Promo'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Promo?"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.code}?\nCustomers will no longer be able to use this promo.`
            : ''
        }
        confirmText="Delete Promo"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDark={isDarkMode}
      />
    </View>
  );
});

export default PromosAdminPanel;
