import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { BootstrapIcon } from '../common';

const TEAL = '#1D4533';

/**
 * Full customer customization workspace (brand→model→year, parts, save, AI preview, cart).
 * Designed to drop into CustomizerPage without removing existing AI Studio features.
 */
export default function CustomizationWorkspace({ builder, onRequireLogin, addToCart }) {
  const {
    step,
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
    myCustomizations,
    error,
    info,
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
    editCustomization,
    resetBuilder,
    formatMoney,
  } = builder;

  const handleSave = async () => {
    const result = await saveCustomization();
    if (result?.needsAuth) onRequireLogin?.();
  };

  const handlePreview = async () => {
    const result = await generatePreview();
    if (result?.needsAuth) onRequireLogin?.();
  };

  const handleAddToCart = async () => {
    const result = await addPartsToCart(addToCart);
    if (result?.needsAuth) onRequireLogin?.();
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heroTitle}>CUSTOMIZE YOUR MOTORCYCLE</Text>
      <Text style={styles.heroSub}>
        Select your registered motorcycle, choose parts to install, then generate a preview of that same
        bike with the parts fitted.
      </Text>

      {(error || info) && (
        <View style={[styles.banner, error ? styles.bannerError : styles.bannerInfo]}>
          <Text style={styles.bannerText}>{error || info}</Text>
        </View>
      )}

      {/* My Customizations */}
      {myCustomizations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Customizations</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {myCustomizations.map((c) => (
              <TouchableOpacity
                key={c.id || c.customization_id}
                style={styles.savedCard}
                onPress={() => loadCustomization(c)}
              >
                {c.previewImageUrl || c.preview_image_url ? (
                  <Image
                    source={{ uri: c.previewImageUrl || c.preview_image_url }}
                    style={styles.savedThumb}
                  />
                ) : (
                  <View style={[styles.savedThumb, styles.savedThumbEmpty]}>
                    <BootstrapIcon name="bicycle" size={22} color={TEAL} />
                  </View>
                )}
                <Text style={styles.savedName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.savedMeta} numberOfLines={1}>
                  {c.motorcycle?.brand} {c.motorcycle?.model} {c.motorcycle?.year || ''}
                </Text>
                <Text style={styles.savedPrice}>{formatMoney(c.totalPrice || c.total_price)}</Text>
                <Text style={styles.savedStatus}>{c.status}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Motorcycle selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Select Motorcycle</Text>

        {garageBikes?.length > 0 && (
          <>
            <Text style={styles.label}>My Garage (required for accurate preview)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {garageBikes.map((bike) => {
                const selected =
                  motorcycle?.motorcycle_id &&
                  bike.motorcycle_id &&
                  motorcycle.motorcycle_id === bike.motorcycle_id;
                return (
                  <TouchableOpacity
                    key={bike.motorcycle_id || bike.id}
                    style={[styles.garageCard, selected && styles.garageCardActive]}
                    onPress={() => selectGarageBike(bike)}
                  >
                    {bike.photo_url ? (
                      <Image source={{ uri: bike.photo_url }} style={styles.garageThumb} />
                    ) : (
                      <View style={[styles.garageThumb, styles.garageThumbEmpty]}>
                        <BootstrapIcon name="bicycle" size={18} color="#1D4533" />
                      </View>
                    )}
                    <Text style={styles.garageName} numberOfLines={1}>
                      {bike.nickname || `${bike.brand} ${bike.model}`}
                    </Text>
                    <Text style={styles.garageMeta} numberOfLines={1}>
                      {bike.brand} {bike.model} {bike.year || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        <Text style={styles.label}>{garageBikes?.length ? 'Or pick from catalog' : 'Brand'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {brands.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.chip, brand === b && styles.chipActive]}
              onPress={() => selectBrand(b)}
            >
              <Text style={[styles.chipText, brand === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!!brand && (
          <>
            <Text style={styles.label}>Model</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {models.map((m) => (
                <TouchableOpacity
                  key={m.model}
                  style={[styles.chip, model === m.model && styles.chipActive]}
                  onPress={() => selectModel(m.model)}
                >
                  <Text style={[styles.chipText, model === m.model && styles.chipTextActive]}>
                    {m.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {!!model && (
          <>
            <Text style={styles.label}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.chip, year === y && styles.chipActive]}
                  onPress={() => selectYear(y)}
                >
                  <Text style={[styles.chipText, year === y && styles.chipTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {motorcycle && (
          <View style={styles.bikeSummary}>
            {bikePhotoUrl ? (
              <Image source={{ uri: bikePhotoUrl }} style={styles.bikeSummaryPhoto} />
            ) : (
              <BootstrapIcon name="bicycle" size={18} color={TEAL} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.bikeSummaryText}>
                {motorcycle.brand} {motorcycle.model} · {motorcycle.year}
              </Text>
              <Text style={styles.bikeSummaryMeta}>
                {motorcycle.vehicleType || motorcycle.category || 'Motorcycle'}
                {motorcycle.motorcycle_id && bikePhotoUrl
                  ? ' · registered bike photo will be used — selected parts installed on this model'
                  : ' · select a My Garage bike with photo to install parts on your registered motorcycle'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Preview screen */}
      {step === 'preview' && previewUrl && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR CUSTOM MOTORCYCLE</Text>
          <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="cover" />
          <Text style={styles.bikeSummaryText}>
            Motorcycle: {motorcycle?.brand} {motorcycle?.model} {motorcycle?.year}
          </Text>
          <Text style={[styles.label, { marginTop: 12 }]}>Selected Parts</Text>
          {selectedParts.map((p) => (
            <Text key={p.id || p.product_id} style={styles.partLine}>
              ✓ {p.name} — {formatMoney(p.price)}
            </Text>
          ))}
          <Text style={styles.totalText}>Total: {formatMoney(totalPrice)}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={editCustomization}>
              <Text style={styles.btnSecondaryText}>Edit Customization</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleSave} disabled={saving}>
              <Text style={styles.btnSecondaryText}>{saving ? 'Saving…' : 'Save Customization'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleAddToCart}>
              <Text style={styles.btnPrimaryText}>Add Parts to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Parts browser */}
      {motorcycle && step !== 'preview' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Select Parts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={styles.search}
            placeholder="Search parts by name or brand…"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, !compatibleOnly && styles.filterChipOn]}
              onPress={() => setCompatibleOnly(false)}
            >
              <Text style={[styles.filterChipText, !compatibleOnly && styles.filterChipTextOn]}>
                Show all parts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, compatibleOnly && styles.filterChipOn]}
              onPress={() => setCompatibleOnly(true)}
            >
              <Text style={[styles.filterChipText, compatibleOnly && styles.filterChipTextOn]}>
                Compatible only
              </Text>
            </TouchableOpacity>
          </View>

          {motorcycle && (
            <Text style={styles.hint}>
              Showing store parts for {motorcycle.brand} {motorcycle.model} {motorcycle.year}. Compatible
              parts are listed first.
            </Text>
          )}

          {loadingProducts ? (
            <ActivityIndicator color={TEAL} style={{ marginVertical: 20 }} />
          ) : compatibleProducts.length === 0 ? (
            <Text style={styles.empty}>
              No products found for “{category}”. Try “All” or another category — your part may be filed
              under Accessories / Tires / Exhaust.
            </Text>
          ) : (
            <View style={styles.productGrid}>
              {compatibleProducts.map((p) => {
                const pid = p.id || p.product_id;
                const selected = selectedParts.some((s) => (s.id || s.product_id) === pid);
                const inStock = (Number(p.stock) || 0) > 0;
                return (
                  <View
                    key={pid}
                    style={[styles.productCard, !p.compatible && styles.productCardMuted]}
                  >
                    <Image source={{ uri: p.image }} style={styles.productImage} />
                    <Text style={styles.productName} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={styles.productBrand}>{p.brand}</Text>
                    <Text style={styles.productCat}>{p.category || 'Parts'}</Text>
                    <Text style={styles.productPrice}>{formatMoney(p.price)}</Text>
                    <Text style={[styles.stock, !inStock && styles.stockOut]}>
                      {inStock ? `In stock (${p.stock})` : 'Out of stock'}
                    </Text>
                    <Text style={p.compatible ? styles.compatOk : styles.compatBad}>
                      {p.compatible
                        ? '✓ Compatible'
                        : '✗ Not marked compatible for this motorcycle'}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.selectBtn,
                        selected && styles.selectBtnOn,
                        !p.compatible && !selected && styles.selectBtnDisabled,
                      ]}
                      onPress={() => togglePart(p)}
                      disabled={(!inStock && !selected) || (!p.compatible && !selected)}
                    >
                      <Text
                        style={[
                          styles.selectBtnText,
                          selected && styles.selectBtnTextOn,
                          !p.compatible && !selected && styles.selectBtnTextDisabled,
                        ]}
                      >
                        {selected ? 'Selected' : p.compatible ? 'Select' : 'Incompatible'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Selected parts panel */}
      {selectedParts.length > 0 && step !== 'preview' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Parts</Text>
          {selectedParts.map((p) => (
            <View key={p.id || p.product_id} style={styles.selectedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName}>{p.name}</Text>
                <Text style={styles.productBrand}>{p.brand}</Text>
              </View>
              <Text style={styles.productPrice}>{formatMoney(p.price)}</Text>
              <TouchableOpacity onPress={() => togglePart(p)} style={styles.removeBtn}>
                <BootstrapIcon name="x-lg" size={14} color="#B91C1C" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalText}>{formatMoney(totalPrice)}</Text>
          </View>

          {compatResult && (
            <Text style={compatResult.compatible ? styles.compatOk : styles.compatBad}>
              {compatResult.compatible
                ? 'Compatibility check passed.'
                : 'Compatibility issues found — see warnings above.'}
            </Text>
          )}

          <TextInput
            style={styles.search}
            placeholder="Customization name (e.g. My Click 160 Street Setup)"
            placeholderTextColor="#94A3B8"
            value={saveName}
            onChangeText={setSaveName}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={checkCompatibility}
              disabled={checkingCompat}
            >
              <Text style={styles.btnSecondaryText}>
                {checkingCompat ? 'Checking…' : 'Check Compatibility'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleSave} disabled={saving}>
              <Text style={styles.btnSecondaryText}>{saving ? 'Saving…' : 'Save Customization'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handlePreview} disabled={generating}>
              <Text style={styles.btnPrimaryText}>
                {generating ? 'Generating…' : 'Generate AI Preview'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleAddToCart}>
              <Text style={styles.btnPrimaryText}>Add Parts to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading overlay for AI */}
      {generating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingTitle}>Creating your motorcycle customization preview...</Text>
          <Text style={styles.loadingSub}>
            {genProgress?.message || 'Please wait — your build is saved.'}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.min(100, genProgress?.percentage || 10)}%` }]}
            />
          </View>
        </View>
      )}

      {step === 'preview' && !previewUrl && error && (
        <TouchableOpacity style={styles.btnPrimary} onPress={handlePreview}>
          <Text style={styles.btnPrimaryText}>Try Again</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={resetBuilder} style={styles.resetLink}>
        <Text style={styles.resetText}>Start a new customization</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  heroSub: { color: '#64748B', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  banner: { padding: 12, borderRadius: 10, marginBottom: 10 },
  bannerError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  bannerInfo: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  bannerText: { color: '#134E4A', fontSize: 13, fontWeight: '600' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 4 },
  chipRow: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: TEAL, borderColor: TEAL },
  chipText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  bikeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
  },
  bikeSummaryPhoto: {
    width: 56,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
  },
  bikeSummaryText: { color: '#134E4A', fontWeight: '700', fontSize: 13 },
  bikeSummaryMeta: { color: '#0F766E', fontSize: 11, marginTop: 2 },
  garageCard: {
    width: 132,
    marginRight: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFC',
  },
  garageCardActive: {
    borderColor: TEAL,
    backgroundColor: '#ECFDF5',
  },
  garageThumb: {
    width: '100%',
    height: 68,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  garageThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  garageName: { fontSize: 12, fontWeight: '700', marginTop: 6, color: '#0F172A' },
  garageMeta: { fontSize: 10, color: '#64748B' },
  search: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipOn: { backgroundColor: TEAL, borderColor: TEAL },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterChipTextOn: { color: '#FFFFFF' },
  hint: { fontSize: 11, color: '#64748B', marginBottom: 10, lineHeight: 16 },
  empty: { color: '#94A3B8', fontSize: 13, paddingVertical: 16 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCard: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FAFBFC',
  },
  productCardMuted: { opacity: 0.78, backgroundColor: '#F8FAFC' },
  productImage: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#E2E8F0' },
  productName: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginTop: 8, minHeight: 32 },
  productBrand: { fontSize: 11, color: '#64748B', marginTop: 2 },
  productCat: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  productPrice: { fontSize: 13, fontWeight: '800', color: TEAL, marginTop: 4 },
  stock: { fontSize: 11, color: '#059669', marginTop: 2 },
  stockOut: { color: '#DC2626' },
  compatOk: { fontSize: 11, color: '#1D4533', fontWeight: '600', marginTop: 2 },
  compatBad: { fontSize: 10, color: '#B91C1C', fontWeight: '600', marginTop: 2 },
  selectBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: 'center',
  },
  selectBtnOn: { backgroundColor: TEAL },
  selectBtnDisabled: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  selectBtnText: { color: TEAL, fontWeight: '700', fontSize: 12 },
  selectBtnTextOn: { color: '#FFFFFF' },
  selectBtnTextDisabled: { color: '#94A3B8' },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectedName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  removeBtn: { padding: 6 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  totalText: { fontSize: 18, fontWeight: '800', color: TEAL },
  partLine: { fontSize: 13, color: '#334155', marginBottom: 4 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btnPrimary: {
    backgroundColor: TEAL,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  btnSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnSecondaryText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  loadingOverlay: {
    marginTop: 12,
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    gap: 8,
  },
  loadingTitle: { fontWeight: '700', color: '#134E4A', textAlign: 'center' },
  loadingSub: { fontSize: 12, color: '#0F766E', textAlign: 'center' },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#CCFBF1',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', backgroundColor: TEAL },
  savedCard: {
    width: 140,
    marginRight: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFC',
  },
  savedThumb: { width: '100%', height: 72, borderRadius: 8, backgroundColor: '#E2E8F0' },
  savedThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  savedName: { fontSize: 12, fontWeight: '700', marginTop: 6, color: '#0F172A' },
  savedMeta: { fontSize: 10, color: '#64748B' },
  savedPrice: { fontSize: 12, fontWeight: '800', color: TEAL, marginTop: 2 },
  savedStatus: { fontSize: 10, color: '#94A3B8', textTransform: 'capitalize' },
  resetLink: { alignItems: 'center', paddingVertical: 12 },
  resetText: { color: TEAL, fontWeight: '600', fontSize: 13 },
});
