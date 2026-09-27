import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { BootstrapIcon, AdminStatCard } from '../common';
import ForecastChart from './ForecastChart';
import {
  getForecastStyles,
  getForecastTokens,
  getStockStatusColors,
} from '../../styles/forecast.styles';
import {
  forecastService,
  getHistoricalSales,
  generateProductForecast,
  buildProductForecastTable,
} from '../../services/forecastService';
import { formatRegressionEquation } from '../../utils/linearRegression';

const CHART_LOOKBACK_WEEK = [
  { key: 4, label: '4W' },
  { key: 12, label: '12W' },
  { key: 24, label: '24W' },
];

const CHART_LOOKBACK_DAY = [
  { key: 7, label: '7D' },
  { key: 14, label: '14D' },
  { key: 30, label: '30D' },
];

const HORIZON_OPTIONS = [
  { key: 1, label: 'Next Day', periodType: 'day', id: 'd1' },
  { key: 3, label: 'Next 3 Days', periodType: 'day', id: 'd3' },
  { key: 1, label: '7 Days', periodType: 'week', id: 'w1' },
  { key: 2, label: '14 Days', periodType: 'week', id: 'w2' },
  { key: 1, label: '1 Month', periodType: 'month', id: 'm1' },
];

const FORECAST_TABLE_COLUMNS = [
  { key: 'product', label: 'Product', flex: 2.2, minWidth: 180 },
  { key: 'category', label: 'Category', flex: 1.2, minWidth: 110 },
  { key: 'stock', label: 'Stock', flex: 0.8, minWidth: 70 },
  { key: 'avgSales', label: 'Avg. Sales/Wk', flex: 1.1, minWidth: 110 },
  { key: 'forecast', label: 'Forecast', flex: 0.9, minWidth: 90 },
  { key: 'restockQty', label: 'Restock Qty', flex: 1.0, minWidth: 100 },
  { key: 'trend', label: 'Trend', flex: 1.1, minWidth: 110 },
  { key: 'status', label: 'Status', flex: 1.0, minWidth: 100 },
];

function formatDateRange(historical = []) {
  if (!historical.length) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 18);
    return `${fmtShort(start)} – ${fmtShort(now)}`;
  }
  const first = historical[0]?.key;
  const last = historical[historical.length - 1]?.key;
  return `${first || '—'} → ${last || '—'}`;
}

function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status, isDark }) {
  const sc = getStockStatusColors(status, isDark);
  return (
    <View style={{ backgroundColor: sc.bg, borderColor: sc.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: sc.text }}>{sc.label}</Text>
    </View>
  );
}

function TrendCell({ trend, tokens }) {
  if (!trend || trend === '—') {
    return <Text style={{ fontSize: 12, color: tokens.mutedForeground }}>—</Text>;
  }
  const up = trend === 'Increasing';
  const down = trend === 'Decreasing';
  const color = up ? tokens.success : down ? tokens.danger : tokens.mutedForeground;
  const icon = up ? '↑' : down ? '↓' : '→';
  return (
    <Text style={{ fontSize: 12, fontWeight: '700', color }}>
      {icon} {trend}
    </Text>
  );
}

/**
 * Sales Forecast & Stock Optimization — styled to match Figma Make design.
 * https://www.figma.com/make/3Uhb9CKJJ6vcnxXwDFJhwc/Sales-Forecasting-Dashboard-Design
 */
export default function SalesForecastPanel({
  orders = [],
  products = [],
  isDarkMode = false,
  isDesktop = true,
}) {
  const styles = useMemo(() => getForecastStyles(isDarkMode), [isDarkMode]);
  const tokens = useMemo(() => getForecastTokens(isDarkMode), [isDarkMode]);

  const [periodType, setPeriodType] = useState('day');
  const [lookbackPeriods, setLookbackPeriods] = useState(14);
  const [forecastAhead, setForecastAhead] = useState(1);
  const [horizonLabel, setHorizonLabel] = useState('Next Day');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [horizonPickerOpen, setHorizonPickerOpen] = useState(false);
  const [lookbackPickerOpen, setLookbackPickerOpen] = useState(false);
  const [safetyConfig, setSafetyConfig] = useState(() => forecastService.loadSafetyPrefs());
  const [safetyInput, setSafetyInput] = useState(String(forecastService.loadSafetyPrefs().value));
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saveAfterRefresh, setSaveAfterRefresh] = useState(false);

  const salesRows = useMemo(() => getHistoricalSales(orders), [orders]);

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');

  const productOptions = useMemo(() => {
    const list = (products || []).map((p) => ({
      id: p.id || p.product_id,
      name: p.name,
      brand: p.brand || '',
      category: p.category || '—',
      stock: Number(p.stock) || 0,
      image: p.image || p.imageUrl || p.photo || '',
      rating: Number(p.rating) || 5.0,
      reviews: Number(p.reviews) || 0,
      product: p,
    }));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }, [products]);

  const pickerCategories = useMemo(() => {
    const cats = new Set();
    productOptions.forEach((p) => {
      if (p.category && p.category !== '—') cats.add(p.category);
    });
    return ['All', ...Array.from(cats)];
  }, [productOptions]);

  const filteredProductOptions = useMemo(() => {
    return productOptions.filter((p) => {
      const q = productSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.brand || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q);
      const matchesCat =
        productCategoryFilter === 'All' ||
        String(p.category || '').toLowerCase() === productCategoryFilter.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [productOptions, productSearchQuery, productCategoryFilter]);

  useEffect(() => {
    if (!selectedProductId && productOptions.length > 0) {
      setSelectedProductId(productOptions[0].id);
    }
  }, [productOptions, selectedProductId]);

  const selectedProduct = useMemo(
    () => productOptions.find((p) => String(p.id) === String(selectedProductId))?.product || null,
    [productOptions, selectedProductId]
  );

  const forecast = useMemo(() => {
    if (!selectedProduct) return null;
    return generateProductForecast({
      salesRows,
      product: selectedProduct,
      periodType,
      lookbackPeriods,
      forecastAhead,
      safetyConfig,
    });
  }, [salesRows, selectedProduct, periodType, lookbackPeriods, forecastAhead, safetyConfig, refreshKey]);

  const tableRows = useMemo(
    () =>
      buildProductForecastTable({
        products,
        salesRows,
        periodType,
        lookbackPeriods,
        forecastAhead,
        safetyConfig,
        limit: 40,
      }),
    [products, salesRows, periodType, lookbackPeriods, forecastAhead, safetyConfig, refreshKey]
  );

  const loadHistory = useCallback(async () => {
    const rows = await forecastService.getForecastHistory({ salesRows, limit: 30 });
    setHistory(rows);
  }, [salesRows]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshKey]);

  const persistForecast = useCallback(async () => {
    if (!forecast || forecast.insufficient) return;
    const primary = forecast.forecastPoints?.[forecast.forecastPoints.length - 1];
    await forecastService.saveForecastHistory({
      product_id: forecast.productId,
      product_name: forecast.productName,
      forecast_date: new Date().toISOString().slice(0, 10),
      forecast_period: periodType,
      period_label: primary?.label || forecast.forecastPeriodLabel,
      period_key: primary?.key,
      predicted_quantity: forecast.forecastedDemand,
      slope: forecast.regression.slope,
      intercept: forecast.regression.intercept,
      safety_stock: forecast.safetyStock,
      current_stock: forecast.currentStock,
      recommended_restock: forecast.recommendedRestock,
    });
    await loadHistory();
  }, [forecast, periodType, loadHistory]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const next = forecastService.saveSafetyPrefs({
        mode: safetyConfig.mode,
        value: Math.max(0, Number(safetyInput) || 0),
      });
      setSafetyConfig(next);
      setSafetyInput(String(next.value));
      setSaveAfterRefresh(true);
      setRefreshKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!saveAfterRefresh || !forecast || forecast.insufficient) return;
    setSaveAfterRefresh(false);
    persistForecast();
  }, [saveAfterRefresh, forecast, persistForecast]);

  const selectedName =
    productOptions.find((p) => String(p.id) === String(selectedProductId))?.name || 'Select product';

  const equation =
    forecast && !forecast.insufficient
      ? formatRegressionEquation(forecast.regression.intercept, forecast.regression.slope)
      : 'Y = a + bX';

  // Prefer "Y = bX + a" display order to match Figma mock
  const equationDisplay = useMemo(() => {
    if (!forecast || forecast.insufficient) return 'Y = bX + a';
    const b = Number(forecast.regression.slope);
    const a = Number(forecast.regression.intercept);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return equation;
    const absB = Math.abs(b).toFixed(Math.abs(b) >= 10 ? 1 : 2);
    const aAbs = Math.abs(a).toFixed(Math.abs(a) >= 10 ? 0 : 1);
    const aPart = a >= 0 ? `+ ${aAbs}` : `- ${aAbs}`;
    if (b >= 0) return `Y = ${absB}X ${aPart}`;
    return `Y = -${absB}X ${aPart}`;
  }, [forecast, equation]);

  const chartLookback = (forecast?.periodType || periodType) === 'day' ? CHART_LOOKBACK_DAY : CHART_LOOKBACK_WEEK;
  const activePeriodType = forecast?.periodType || periodType;
  const periodNoun =
    activePeriodType === 'day' ? 'days' : activePeriodType === 'month' ? 'months' : 'weeks';

  const renderPickerModal = (visible, onClose, title, children) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            maxHeight: '70%',
            backgroundColor: tokens.card,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: tokens.foreground }}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <BootstrapIcon name="x-lg" size={16} color={tokens.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderProductPickerModal = () => (
    <Modal
      visible={productPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setProductPickerOpen(false)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: isDesktop ? 24 : 12,
        }}
      >
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          activeOpacity={1}
          onPress={() => setProductPickerOpen(false)}
        />

        <View
          style={{
            width: '100%',
            maxWidth: 960,
            maxHeight: '88%',
            backgroundColor: tokens.card,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: tokens.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 25,
            elevation: 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Modal Header */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: tokens.border,
              backgroundColor: isDarkMode ? '#171922' : '#FAFCFF',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? 'rgba(29, 69, 51, 0.25)' : '#E6F4F1',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BootstrapIcon name="box-seam" size={18} color={tokens.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: tokens.foreground }}>
                    Select motorcycle part
                  </Text>
                  <Text style={{ fontSize: 11.5, color: tokens.mutedForeground, marginTop: 1 }}>
                    Choose a part to analyze demand regression and calculate replenishment
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setProductPickerOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDarkMode ? '#222530' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BootstrapIcon name="x-lg" size={14} color={tokens.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Search Input & Category Pills */}
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#1E2028' : '#FFFFFF',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  paddingHorizontal: 12,
                  height: 40,
                  gap: 8,
                }}
              >
                <BootstrapIcon name="search" size={14} color={tokens.mutedForeground} />
                <TextInput
                  placeholder="Search motorcycle part by name, brand, or category..."
                  placeholderTextColor={tokens.mutedForeground}
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: tokens.foreground,
                    outlineStyle: 'none',
                  }}
                />
                {productSearchQuery ? (
                  <TouchableOpacity onPress={() => setProductSearchQuery('')}>
                    <BootstrapIcon name="x-circle-fill" size={14} color={tokens.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Category Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {pickerCategories.map((cat) => {
                  const active = productCategoryFilter === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setProductCategoryFilter(cat)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 20,
                        backgroundColor: active
                          ? tokens.primary
                          : isDarkMode
                          ? '#1E2028'
                          : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: active ? tokens.primary : tokens.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: active ? '700' : '600',
                          color: active ? '#FFFFFF' : tokens.mutedForeground,
                        }}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Modal Body: Product Card Grid */}
          <ScrollView
            style={{ flex: 1, padding: 16 }}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {filteredProductOptions.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <BootstrapIcon name="search" size={32} color={tokens.mutedForeground} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.foreground, marginTop: 12 }}>
                  No parts found
                </Text>
                <Text style={{ fontSize: 12, color: tokens.mutedForeground, marginTop: 4 }}>
                  Try adjusting your search query or category filter
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                  justifyContent: 'flex-start',
                }}
              >
                {filteredProductOptions.map((p) => {
                  const isSelected = String(p.id) === String(selectedProductId);
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= 5;

                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.88}
                      onPress={() => {
                        setSelectedProductId(p.id);
                        setProductPickerOpen(false);
                      }}
                      style={{
                        width: isDesktop ? '23.5%' : '48%',
                        minWidth: isDesktop ? 180 : 150,
                        backgroundColor: isSelected
                          ? isDarkMode
                            ? 'rgba(29, 69, 51, 0.15)'
                            : '#F0FDF4'
                          : isDarkMode
                          ? '#1E2028'
                          : '#FFFFFF',
                        borderRadius: 14,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? tokens.primary : tokens.border,
                        overflow: 'hidden',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 1,
                        marginBottom: 4,
                      }}
                    >
                      {/* Product Image Container */}
                      <View
                        style={{
                          width: '100%',
                          aspectRatio: 1.15,
                          backgroundColor: isDarkMode ? '#14161C' : '#F1F5F9',
                          overflow: 'hidden',
                          position: 'relative',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {p.image ? (
                          <Image
                            source={{ uri: p.image }}
                            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                          />
                        ) : (
                          <BootstrapIcon name="box-seam" size={36} color={tokens.mutedForeground} />
                        )}

                        {/* Category badge top-left */}
                        <View
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            backgroundColor: 'rgba(15, 23, 42, 0.75)',
                            paddingHorizontal: 6,
                            paddingVertical: 2.5,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>
                            {p.category}
                          </Text>
                        </View>

                        {/* Selected Indicator Checkmark top-right */}
                        {isSelected && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: tokens.primary,
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.2,
                              shadowRadius: 2,
                            }}
                          >
                            <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      {/* Product Card Details (Matching ProductCard layout, strictly NO PRICE) */}
                      <View style={{ padding: 10, flex: 1, justifyContent: 'space-between' }}>
                        <View>
                          {/* Brand subtle uppercase tag */}
                          {p.brand ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 9.5,
                                fontWeight: '700',
                                color: tokens.mutedForeground,
                                letterSpacing: 0.5,
                                marginBottom: 2,
                                textTransform: 'uppercase',
                              }}
                            >
                              {p.brand}
                            </Text>
                          ) : null}

                          {/* Product Title (2 Lines Max) */}
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: 12.5,
                              fontWeight: '700',
                              color: tokens.foreground,
                              lineHeight: 16,
                              minHeight: 32,
                              marginBottom: 6,
                            }}
                          >
                            {p.name}
                          </Text>

                          {/* Minimal Meta Row: Rating & Stock */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 4,
                              marginBottom: 8,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <BootstrapIcon name="star-fill" size={9.5} color="#F59E0B" />
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.foreground }}>
                                {Number(p.rating || 5.0).toFixed(1)}
                              </Text>
                              <Text style={{ fontSize: 9.5, color: tokens.mutedForeground }}>
                                ({p.reviews || 0})
                              </Text>
                            </View>
                            <Text style={{ color: tokens.mutedForeground, fontSize: 10 }}>•</Text>
                            <Text
                              style={{
                                fontSize: 10.5,
                                fontWeight: '700',
                                color: isOutOfStock
                                  ? '#EF4444'
                                  : isLowStock
                                  ? '#F59E0B'
                                  : '#10B981',
                              }}
                            >
                              {isOutOfStock
                                ? 'Out of stock'
                                : isLowStock
                                ? `Only ${p.stock} left`
                                : `${p.stock} in stock`}
                            </Text>
                          </View>
                        </View>

                        {/* Action CTA Button */}
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 8,
                            borderRadius: 7,
                            backgroundColor: isSelected
                              ? tokens.primary
                              : isDarkMode
                              ? '#272930'
                              : '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 5,
                          }}
                        >
                          <BootstrapIcon
                            name={isSelected ? 'check-circle-fill' : 'hand-index-thumb'}
                            size={11}
                            color={isSelected ? '#FFFFFF' : tokens.mutedForeground}
                          />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: isSelected ? '#FFFFFF' : tokens.foreground,
                            }}
                          >
                            {isSelected ? 'Active Selection' : 'Select Part'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.root}>
      {/* Controls header */}
      <View style={[styles.pageHeader, { justifyContent: 'flex-end', marginBottom: 8 }]}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setProductPickerOpen(true)}>
            <BootstrapIcon name="box-seam" size={13} color={tokens.mutedForeground} />
            <Text style={styles.controlBtnText} numberOfLines={1}>
              {selectedName}
            </Text>
            <BootstrapIcon name="chevron-down" size={12} color={tokens.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={() => setHorizonPickerOpen(true)}>
            <BootstrapIcon name="calendar3" size={13} color={tokens.mutedForeground} />
            <Text style={styles.controlBtnText}>{horizonLabel}</Text>
            <BootstrapIcon name="chevron-down" size={12} color={tokens.mutedForeground} />
          </TouchableOpacity>

          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setLookbackPickerOpen((v) => !v)}
            >
              <BootstrapIcon name="calendar-range" size={13} color={tokens.mutedForeground} />
              <Text style={styles.controlBtnText} numberOfLines={1}>
                {formatDateRange(forecast?.historical)}
              </Text>
              <BootstrapIcon
                name={lookbackPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={tokens.mutedForeground}
              />
            </TouchableOpacity>

            {lookbackPickerOpen && (
              <>
                {/* Transparent backdrop to close on outside click */}
                <TouchableOpacity
                  style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 999,
                  }}
                  onPress={() => setLookbackPickerOpen(false)}
                  activeOpacity={1}
                />
                <View
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    minWidth: 260,
                    backgroundColor: tokens.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  {/* Dropdown header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: tokens.mutedForeground, letterSpacing: 0.5 }}>
                      HISTORY DATE RANGE
                    </Text>
                    <TouchableOpacity onPress={() => setLookbackPickerOpen(false)}>
                      <BootstrapIcon name="x-lg" size={13} color={tokens.mutedForeground} />
                    </TouchableOpacity>
                  </View>

                  {/* Options */}
                  {chartLookback.map((opt, idx) => {
                    const active = lookbackPeriods === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 14,
                          paddingVertical: 11,
                          backgroundColor: active ? (isDarkMode ? 'rgba(29, 69, 51,0.2)' : '#E8F0EC') : 'transparent',
                          borderBottomWidth: idx < chartLookback.length - 1 ? 1 : 0,
                          borderBottomColor: tokens.border,
                        }}
                        onPress={() => {
                          setLookbackPeriods(opt.key);
                          setLookbackPickerOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View>
                          <Text style={{ fontWeight: '700', fontSize: 13.5, color: active ? '#1D4533' : tokens.foreground }}>
                            Lookback {opt.label}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: tokens.mutedForeground, marginTop: 2 }}>
                            Changes the history window used for the forecast chart
                          </Text>
                        </View>
                        {active && (
                          <BootstrapIcon name="check-lg" size={15} color="#1D4533" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.generateBtn} onPress={handleRefresh} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={tokens.navActiveText} size="small" />
            ) : (
              <BootstrapIcon name="lightning-fill" size={13} color={tokens.navActiveText} />
            )}
            <Text style={styles.generateBtnText}>Generate Forecast</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary cards (using unified AdminStatCard design system) */}
      <View style={[styles.statsGrid, !isDesktop && { flexDirection: 'column' }]}>
        {[
          {
            accent: 'teal',
            label: 'Forecasted Demand',
            value:
              forecast?.insufficient || forecast?.forecastedDemand == null ? (
                '—'
              ) : (
                <>
                  {forecast.forecastedDemand}
                  <Text style={styles.statUnit}> units</Text>
                </>
              ),
            sub: forecast?.forecastPeriodLabel
              ? `Next period · ${forecast.forecastPeriodLabel}`
              : 'Next period',
          },
          {
            accent: 'blue',
            label: 'Current Stock',
            value: (
              <>
                {String(forecast?.currentStock ?? selectedProduct?.stock ?? 0)}
                <Text style={styles.statUnit}> units</Text>
              </>
            ),
            sub: 'Available inventory',
          },
          {
            accent: 'purple',
            label: 'Recommended Restock',
            value: forecast?.insufficient ? (
              '—'
            ) : (
              <>
                {String(forecast?.recommendedRestock ?? 0)}
                <Text style={styles.statUnit}> units</Text>
              </>
            ),
            valueColor:
              !forecast?.insufficient && (forecast?.recommendedRestock ?? 0) > 0
                ? tokens.primary
                : undefined,
            sub: 'Suggested order quantity',
          },
          {
            accent: 'amber',
            label: 'Sales Trend',
            value: forecast?.insufficient ? '—' : forecast?.trendLabel || '—',
            sub: 'Based on historical sales',
          },
        ].map((card) => (
          <AdminStatCard
            key={card.label}
            styles={styles}
            accent={card.accent}
            label={card.label}
            value={card.value}
            valueColor={card.valueColor}
            sub={card.sub}
            style={!isDesktop && styles.statCardMobile}
          />
        ))}
      </View>

      {/* Sales Forecast chart */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Sales Forecast</Text>
            <Text style={styles.cardSubtitle}>
              Historical sales compared with linear regression forecast
            </Text>
          </View>
          <View style={styles.periodTabs}>
            {chartLookback.map((opt) => {
              const active = lookbackPeriods === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.periodTab, active && styles.periodTabActive]}
                  onPress={() => setLookbackPeriods(opt.key)}
                >
                  <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {forecast?.insufficient ? (
          <View style={styles.emptyState}>
            <BootstrapIcon name="exclamation-triangle" size={22} color={tokens.amber} />
            <Text style={styles.emptyText}>
              {forecast.error || 'Insufficient historical sales data for forecasting.'}
            </Text>
          </View>
        ) : (
          <>
            {forecast?.autoAdjustedPeriod ? (
              <Text style={[styles.cardSubtitle, { marginBottom: 10, color: tokens.primary }]}>
                Showing a daily forecast because there are not enough separate weeks of sales yet.
              </Text>
            ) : null}
            <View style={[styles.legendRow, { marginTop: 0, marginBottom: 12 }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: tokens.primary }]} />
                <Text style={styles.legendText}>Actual Sales</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendLine,
                    { backgroundColor: tokens.mutedForeground, opacity: 0.7 },
                  ]}
                />
                <Text style={styles.legendText}>Regression Trend</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: tokens.forecast }]} />
                <Text style={styles.legendText}>Forecast</Text>
              </View>
            </View>
            <ForecastChart
              chartPoints={forecast?.chartPoints || []}
              trendLine={forecast?.trendLine || []}
              isDark={isDarkMode}
              periodType={activePeriodType}
              height={isDesktop ? 300 : 260}
            />
          </>
        )}
      </View>

      {/* Regression + Stock Optimization */}
      <View style={[styles.splitRow, !isDesktop && { flexDirection: 'column' }]}>
        <View style={[styles.card, styles.splitMain]}>
          <Text style={styles.cardTitle}>Linear Regression Model</Text>
          <Text style={styles.cardSubtitle}>
            Uses historical sales data to estimate future demand via a best-fit line (Y = bX + a).
          </Text>

          {forecast?.insufficient ? (
            <Text style={styles.emptyText}>{forecast.error}</Text>
          ) : (
            <>
              <View style={styles.equationBox}>
                <Text style={styles.equationLabel}>Regression Equation</Text>
                <Text style={styles.equationText}>{equationDisplay}</Text>
                <Text style={styles.equationHint}>General form: Y = bX + a</Text>
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Slope (b)</Text>
                  <Text style={styles.metaValue}>
                    {Number(forecast?.regression?.slope || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Intercept (a)</Text>
                  <Text style={styles.metaValue}>
                    {Number(forecast?.regression?.intercept || 0).toFixed(1)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Historical Periods</Text>
                  <Text style={styles.metaValue}>
                    {forecast?.regression?.n ?? 0} {periodNoun}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Forecast Period</Text>
                  <Text style={styles.metaValue}>{horizonLabel}</Text>
                </View>
              </View>

              <View style={styles.predictedBox}>
                <Text style={styles.predictedLabel}>Predicted Demand</Text>
                <Text style={styles.predictedValue}>
                  {forecast?.forecastedDemand ?? '—'} units
                </Text>
              </View>

              <Text style={[styles.cardSubtitle, { marginTop: 12, marginBottom: 0 }]}>
                {forecast?.trendExplanation}
              </Text>
            </>
          )}
        </View>

        <View style={[styles.card, styles.splitSide, !isDesktop && { maxWidth: '100%' }]}>
          <View style={styles.stockHeader}>
            <Text style={styles.cardTitle}>Stock Optimization</Text>
            {forecast && !forecast.insufficient ? (
              <StatusBadge status={forecast.stockStatus} isDark={isDarkMode} />
            ) : null}
          </View>

          <View style={styles.flowStep}>
            <Text style={styles.flowLabel}>Current Stock</Text>
            <Text style={styles.flowValue}>{forecast?.currentStock ?? 0} units</Text>
          </View>

          <View style={styles.flowArrow}>
            <BootstrapIcon name="arrow-down" size={14} color={tokens.mutedForeground} />
          </View>

          <View style={styles.flowStep}>
            <Text style={styles.flowLabel}>Forecasted Demand</Text>
            <Text style={styles.flowValue}>
              {forecast?.insufficient ? '—' : `${forecast?.forecastedDemand ?? '—'} units`}
            </Text>
          </View>

          <Text style={styles.safetyNote}>
            + Safety Stock: {forecast?.safetyStock ?? 0} units
          </Text>

          <View style={styles.flowArrow}>
            <BootstrapIcon name="arrow-down" size={14} color={tokens.mutedForeground} />
          </View>

          <View style={[styles.flowStep, styles.flowStepHighlight]}>
            <Text style={[styles.flowLabel, { color: tokens.primary }]}>Recommended Restock</Text>
            <Text style={[styles.flowValue, { color: tokens.primary, fontSize: 26 }]}>
              {forecast?.insufficient ? '—' : `${forecast?.recommendedRestock ?? 0} units`}
            </Text>
          </View>

          <View style={styles.safetyRow}>
            <Text style={[styles.metaLabel, { marginBottom: 0 }]}>Safety stock</Text>
            <TouchableOpacity
              style={[styles.chip, safetyConfig.mode === 'absolute' && styles.chipActive]}
              onPress={() => setSafetyConfig((s) => ({ ...s, mode: 'absolute' }))}
            >
              <Text
                style={[styles.chipText, safetyConfig.mode === 'absolute' && styles.chipTextActive]}
              >
                Units
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, safetyConfig.mode === 'percent' && styles.chipActive]}
              onPress={() => setSafetyConfig((s) => ({ ...s, mode: 'percent' }))}
            >
              <Text
                style={[styles.chipText, safetyConfig.mode === 'percent' && styles.chipTextActive]}
              >
                %
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.safetyInput}
              keyboardType="numeric"
              value={safetyInput}
              onChangeText={setSafetyInput}
              onBlur={() => {
                const next = forecastService.saveSafetyPrefs({
                  mode: safetyConfig.mode,
                  value: Math.max(0, Number(safetyInput) || 0),
                });
                setSafetyConfig(next);
                setSafetyInput(String(next.value));
              }}
              placeholderTextColor={tokens.mutedForeground}
            />
          </View>
        </View>
      </View>

      {/* Product Forecast table */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Product Forecast</Text>
        <Text style={[styles.cardSubtitle, { marginBottom: 14 }]}>
          Restock recommendations for all tracked motorcycle parts
        </Text>

        {isDesktop && Platform.OS === 'web' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ width: '100%' }}
            contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}
          >
            <View style={{ width: '100%', minWidth: 960 }}>
              <View style={[styles.tableHeader, { width: '100%', flexDirection: 'row' }]}>
                {FORECAST_TABLE_COLUMNS.map((col) => (
                  <Text
                    key={col.key}
                    style={[
                      styles.tableHeaderText,
                      { flex: col.flex, minWidth: col.minWidth },
                    ]}
                  >
                    {col.label}
                  </Text>
                ))}
              </View>
              {tableRows.map((row) => {
                const active = String(row.productId) === String(selectedProductId);
                const stockColor =
                  row.stockStatus === 'Critical Stock'
                    ? tokens.danger
                    : row.stockStatus === 'Low Stock'
                      ? tokens.warning
                      : tokens.foreground;
                return (
                  <TouchableOpacity
                    key={row.productId}
                    style={[
                      styles.tableRow,
                      { width: '100%', flexDirection: 'row' },
                      active && styles.tableRowActive,
                    ]}
                    onPress={() => setSelectedProductId(row.productId)}
                  >
                    <Text
                      style={[
                        styles.tableCellBold,
                        {
                          flex: FORECAST_TABLE_COLUMNS[0].flex,
                          minWidth: FORECAST_TABLE_COLUMNS[0].minWidth,
                          paddingRight: 8,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {row.productName}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          flex: FORECAST_TABLE_COLUMNS[1].flex,
                          minWidth: FORECAST_TABLE_COLUMNS[1].minWidth,
                          paddingRight: 8,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {row.category}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellBold,
                        {
                          flex: FORECAST_TABLE_COLUMNS[2].flex,
                          minWidth: FORECAST_TABLE_COLUMNS[2].minWidth,
                          color: stockColor,
                        },
                      ]}
                    >
                      {row.currentStock}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          flex: FORECAST_TABLE_COLUMNS[3].flex,
                          minWidth: FORECAST_TABLE_COLUMNS[3].minWidth,
                        },
                      ]}
                    >
                      {row.averageSales}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellBold,
                        {
                          flex: FORECAST_TABLE_COLUMNS[4].flex,
                          minWidth: FORECAST_TABLE_COLUMNS[4].minWidth,
                        },
                      ]}
                    >
                      {row.forecastedDemand == null ? '—' : row.forecastedDemand}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellBold,
                        {
                          flex: FORECAST_TABLE_COLUMNS[5].flex,
                          minWidth: FORECAST_TABLE_COLUMNS[5].minWidth,
                          color: tokens.primary,
                        },
                      ]}
                    >
                      {row.recommendedRestock == null
                        ? '—'
                        : row.recommendedRestock > 0
                          ? `+${row.recommendedRestock}`
                          : '—'}
                    </Text>
                    <View
                      style={{
                        flex: FORECAST_TABLE_COLUMNS[6].flex,
                        minWidth: FORECAST_TABLE_COLUMNS[6].minWidth,
                      }}
                    >
                      <TrendCell trend={row.trend} tokens={tokens} />
                    </View>
                    <View
                      style={{
                        flex: FORECAST_TABLE_COLUMNS[7].flex,
                        minWidth: FORECAST_TABLE_COLUMNS[7].minWidth,
                      }}
                    >
                      <StatusBadge status={row.stockStatus} isDark={isDarkMode} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <View>
            {tableRows.map((row) => {
              const active = String(row.productId) === String(selectedProductId);
              return (
                <TouchableOpacity
                  key={row.productId}
                  style={[styles.productCard, active && styles.productCardActive]}
                  onPress={() => setSelectedProductId(row.productId)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: tokens.foreground, fontSize: 14 }}>
                        {row.productName}
                      </Text>
                      <Text style={{ color: tokens.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {row.category}
                      </Text>
                    </View>
                    <StatusBadge status={row.stockStatus} isDark={isDarkMode} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: tokens.mutedForeground }}>
                      Stock{' '}
                      <Text style={{ fontWeight: '800', color: tokens.foreground }}>
                        {row.currentStock}
                      </Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.mutedForeground }}>
                      Forecast{' '}
                      <Text style={{ fontWeight: '800', color: tokens.foreground }}>
                        {row.forecastedDemand == null ? '—' : row.forecastedDemand}
                      </Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.mutedForeground }}>
                      Restock{' '}
                      <Text style={{ fontWeight: '800', color: tokens.primary }}>
                        {row.recommendedRestock == null
                          ? '—'
                          : row.recommendedRestock > 0
                            ? `+${row.recommendedRestock}`
                            : '—'}
                      </Text>
                    </Text>
                    <TrendCell trend={row.trend} tokens={tokens} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Forecast history */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Forecast History</Text>
        <Text style={[styles.cardSubtitle, { marginBottom: 10 }]}>
          Previous predictions saved for later comparison against actual sales
        </Text>
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No saved forecasts yet. Tap Generate Forecast to store the current prediction.
            </Text>
          </View>
        ) : (
          history.map((h) => (
            <View key={h.forecast_id} style={styles.historyRow}>
              <Text style={[styles.tableCellBold, { minWidth: 120, flex: 1 }]} numberOfLines={1}>
                {h.product_name}
              </Text>
              <Text style={styles.tableCell}>{h.forecast_date}</Text>
              <Text style={styles.tableCell}>{h.period_label || h.forecast_period}</Text>
              <Text style={[styles.tableCellBold, { color: tokens.primary }]}>
                Pred {h.predicted_quantity}
              </Text>
              <Text style={styles.tableCell}>
                Act {h.actual_quantity == null ? '—' : h.actual_quantity}
              </Text>
              <Text style={styles.tableCell}>
                Diff {h.forecast_difference == null ? '—' : h.forecast_difference}
              </Text>
            </View>
          ))
        )}
      </View>

      {renderProductPickerModal()}

      {renderPickerModal(horizonPickerOpen, () => setHorizonPickerOpen(false), 'Forecast period',
        HORIZON_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id || `${opt.periodType}-${opt.key}-${opt.label}`}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: tokens.border,
            }}
            onPress={() => {
              setForecastAhead(opt.key);
              setPeriodType(opt.periodType);
              setHorizonLabel(opt.label);
              if (opt.periodType === 'day') {
                setLookbackPeriods((prev) => (prev === 4 || prev === 12 || prev === 24 ? 14 : prev));
              } else if (opt.periodType === 'week') {
                setLookbackPeriods((prev) => (prev === 7 || prev === 14 || prev === 30 ? 12 : prev));
              }
              setHorizonPickerOpen(false);
            }}
          >
            <Text style={{ fontWeight: '700', color: tokens.foreground }}>{opt.label}</Text>
          </TouchableOpacity>
        ))
      )}


    </View>
  );
}
