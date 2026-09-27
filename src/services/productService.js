import { supabaseManager } from './supabaseClient';
import { MOTOR_PARTS } from '../data/motorParts';
import { appStorage } from './storageAdapter';
import { notificationService } from './notificationService';
import { serializeProductSizes, normalizeProductSizes } from '../utils/productSizes';
import { serializeProductColors } from '../utils/productColors';
import { resolveColorImagesForSave, resolveImageForDatabase } from '../utils/productImageUpload';
import { sanitizeCompareAtPrice } from '../utils/productCatalog';
import { dataCache } from './cache/dataCache.js';
import { CACHE_TTL, CacheKeys, productInvalidationKeys } from './cache/cacheKeys.js';

const STORAGE_KEY = 'mototrack_products_catalog';
const REVIEWS_STORAGE_KEY = 'mototrack_product_reviews_v1';
const listeners = new Set();
let realtimeChannel = null;
let productFetchCache = null;
const PRODUCT_FETCH_TTL_MS = CACHE_TTL.PRODUCTS_MS;

/**
 * Map admin UI category labels (and aliases) → categories.category_id
 * Seeded IDs from 009_normalize_schema.sql
 */
const CATEGORY_ID_BY_NAME = {
  // Canonical DB names
  drivetrain: 'cat-01',
  tires: 'cat-02',
  accessories: 'cat-03',
  exhaust: 'cat-04',
  brakes: 'cat-05',
  engine: 'cat-06',
  suspension: 'cat-07',
  maintenance: 'cat-08',
  // Admin UI labels (CATEGORY_NAMES)
  'tires & wheels': 'cat-02',
  'tires and wheels': 'cat-02',
  wheels: 'cat-02',
  transmission: 'cat-01',
  'fuel system': 'cat-06',
  fuel: 'cat-06',
  'body parts': 'cat-03',
  body: 'cat-03',
  electrical: 'cat-03',
  electronics: 'cat-03',
};

function categoryIdFromName(name) {
  const key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!key) return 'cat-03';
  if (CATEGORY_ID_BY_NAME[key]) return CATEGORY_ID_BY_NAME[key];
  // Partial / contains match for compound labels
  if (key.includes('tire') || key.includes('wheel') || key.includes('rim')) return 'cat-02';
  if (key.includes('exhaust')) return 'cat-04';
  if (key.includes('brake')) return 'cat-05';
  if (key.includes('engine') || key.includes('fuel')) return 'cat-06';
  if (key.includes('suspension') || key.includes('shock') || key.includes('fork')) return 'cat-07';
  if (key.includes('maintenance') || key.includes('oil') || key.includes('filter')) return 'cat-08';
  if (key.includes('drivetrain') || key.includes('transmission') || key.includes('chain'))
    return 'cat-01';
  return 'cat-03';
}

async function upsertInventoryStock(client, productId, stockQuantity) {
  if (!client || !productId) return;
  const qty = Math.max(0, Number(stockQuantity) || 0);
  const { error } = await client.from('inventory').upsert(
    [
      {
        inventory_id: `inv-${productId}`,
        product_id: productId,
        stock_quantity: qty,
        reorder_level: 5,
        last_updated: new Date().toISOString(),
      },
    ],
    { onConflict: 'product_id' }
  );
  if (error) {
    // Fallback if upsert conflict target differs
    const { data } = await client
      .from('inventory')
      .select('inventory_id')
      .eq('product_id', productId)
      .limit(1);
    if (data?.[0]?.inventory_id) {
      await client
        .from('inventory')
        .update({ stock_quantity: qty, last_updated: new Date().toISOString() })
        .eq('product_id', productId);
    } else {
      await client.from('inventory').insert([
        {
          inventory_id: `inv-${productId}`,
          product_id: productId,
          stock_quantity: qty,
          reorder_level: 5,
          last_updated: new Date().toISOString(),
        },
      ]);
    }
  }
}

function notifyListeners(products) {
  productFetchCache = null;
  dataCache.invalidateMany(productInvalidationKeys());
  if (products) {
    dataCache.set(CacheKeys.productsList(), products, CACHE_TTL.PRODUCTS_MS);
  }
  listeners.forEach((fn) => {
    try {
      fn(products);
    } catch (e) {
      console.warn('Error in product listener:', e);
    }
  });
}

function setupRealtimeSubscription() {
  if (realtimeChannel) return;
  try {
    const client = supabaseManager.getClient();
    if (!client) return;

    realtimeChannel = client
      .channel('public:products_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const fresh = await productService.getProducts();
        notifyListeners(fresh);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, async () => {
        const fresh = await productService.getProducts();
        notifyListeners(fresh);
      })
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription setup failed:', e);
  }
}

export const productService = {
  /**
   * Subscribe to real-time product/inventory updates
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      listeners.add(listener);
      setupRealtimeSubscription();
      return () => listeners.delete(listener);
    }
    return () => {};
  },

  /**
   * Get all products from Supabase database (dynamic live source of truth)
   */
  async getProducts(options = {}) {
    const force = Boolean(options?.force);
    if (!force) {
      const cached = dataCache.get(CacheKeys.productsList());
      if (cached?.value) return cached.value;
    }
    if (
      !force &&
      productFetchCache &&
      Date.now() - productFetchCache.at < PRODUCT_FETCH_TTL_MS
    ) {
      dataCache.set(CacheKeys.productsList(), productFetchCache.data, CACHE_TTL.PRODUCTS_MS);
      return productFetchCache.data;
    }
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('products')
          .select(
            'product_id,id,category_id,name,description,price,image,brand,old_price,rating,reviews,compatibility,sku,badge,type,is_new,discount,material,weight,features,unit_cost,sizes,colors,status,created_at,categories(name),inventory(stock_quantity)'
          )
          .order('created_at', { ascending: false })
          .limit(Number(options?.limit) > 0 ? Number(options.limit) : 120);

        if (!error && Array.isArray(data)) {
          const normalized = data.map((item) => {
            const inv = Array.isArray(item.inventory) ? item.inventory[0] : item.inventory;
            const cat = Array.isArray(item.categories) ? item.categories[0] : item.categories;
            return {
              id: item.product_id || item.id,
              product_id: item.product_id || item.id,
              name: item.name || 'Pro Racing Component',
              category: cat?.name || item.category || 'Accessories',
              category_id: item.category_id || categoryIdFromName(cat?.name || item.category),
              brand: item.brand || 'MotoTrack',
              price: Number(item.price) || 0,
              unit_cost: Number(item.unit_cost || 0),
              unitCost: Number(item.unit_cost || 0),
              sizes: serializeProductSizes(item.sizes, Number(item.price) || 0),
              colors: serializeProductColors(item.colors),
              oldPrice: sanitizeCompareAtPrice(item.old_price, item.price),
              rating: Number(item.reviews) > 0 ? Number(item.rating || 0) : 0,
              reviews: Number(item.reviews || 0),
              compatibility: item.compatibility || 'Universal Fitment',
              sku: item.sku || 'SKU-' + (item.product_id || item.id),
              stock: Number(inv?.stock_quantity ?? item.stock ?? 0),
              badge: item.badge || (item.is_new ? 'New' : undefined),
              type: item.type || 'newArrival',
              isNew: Boolean(item.is_new),
              discount: item.discount,
              image:
                item.image ||
                'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
              material: item.material || 'Aircraft Grade Alloy',
              weight: item.weight || '1.0 kg',
              description: item.description || '',
              features: Array.isArray(item.features)
                ? item.features
                : typeof item.features === 'string'
                  ? JSON.parse(item.features)
                  : [],
            };
          });
          appStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          productFetchCache = { at: Date.now(), data: normalized };
          dataCache.set(CacheKeys.productsList(), normalized, CACHE_TTL.PRODUCTS_MS);
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Supabase fetch products failed, checking local cache:', e);
    }

    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (stored !== null && stored !== undefined) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          productFetchCache = { at: Date.now(), data: parsed };
          return parsed;
        }
      }
    } catch (e) {}

    return [];
  },

  /**
   * Add a new motorcycle product directly to Supabase
   */
  async addProduct(newProduct) {
    const prodId = newProduct.id || newProduct.product_id || 'p-' + Date.now();
    const sizes = serializeProductSizes(newProduct.sizes, Number(newProduct.price) || 0);
    const resolvedColors = await resolveColorImagesForSave(newProduct.colors || []);
    const colors = serializeProductColors(resolvedColors.colors);
    const resolvedMainImage = await resolveImageForDatabase(
      newProduct.image ||
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      { folder: 'products', orderId: prodId, fileName: `products/${prodId}-${Date.now()}.jpg` }
    );
    const product = {
      id: prodId,
      product_id: prodId,
      name: newProduct.name.trim(),
      category: newProduct.category || 'Accessories',
      brand: newProduct.brand?.trim() || 'MotoTrack',
      price: Number(newProduct.price),
      unit_cost: Number(newProduct.unit_cost ?? newProduct.unitCost ?? 0),
      unitCost: Number(newProduct.unit_cost ?? newProduct.unitCost ?? 0),
      sizes,
      colors,
      oldPrice: sanitizeCompareAtPrice(newProduct.oldPrice, newProduct.price),
      rating: 0,
      reviews: 0,
      compatibility: newProduct.compatibility || 'Universal Motorcycle Fitment',
      sku: newProduct.sku || 'TRACK-' + Math.floor(1000 + Math.random() * 9000),
      stock: Number(newProduct.stock || 10),
      badge: newProduct.badge || 'New',
      type: newProduct.type || 'newArrival',
      isNew: Boolean(newProduct.isNew ?? true),
      discount: newProduct.discount || '',
      image:
        resolvedMainImage.url ||
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      material: newProduct.material || 'CNC Aluminum / Titanium',
      weight: newProduct.weight || '1.2 kg',
      description: newProduct.description || 'High quality motorcycle upgrade part.',
      features: Array.isArray(newProduct.features)
        ? newProduct.features
        : ['Direct OEM Fitment', 'Track Tested'],
    };

    let dbError = null;
    if (resolvedColors.errors?.length) {
      console.warn('Color image upload warnings:', resolvedColors.errors);
    }
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { error } = await client.from('products').insert([
          {
            product_id: product.product_id,
            name: product.name,
            category_id: categoryIdFromName(product.category),
            brand: product.brand,
            price: product.price,
            unit_cost: Number(product.unit_cost ?? product.unitCost ?? 0),
            sizes,
            colors,
            old_price: product.oldPrice ?? null,
            rating: 0,
            reviews: 0,
            compatibility: product.compatibility,
            sku: product.sku,
            badge: product.badge,
            type: product.type,
            is_new: product.isNew,
            discount: product.discount,
            image: product.image,
            material: product.material,
            weight: product.weight,
            description: product.description,
            features: product.features,
          },
        ]);
        if (error) {
          dbError = error;
          console.warn('Supabase product insert failed:', error);
        } else {
          await upsertInventoryStock(client, product.product_id, product.stock);
        }
      }
    } catch (e) {
      dbError = e;
      console.warn('Supabase product insert failed:', e);
    }

    const current = await this.getProducts();
    // Prefer the DB/cache row when present so we never double-prepend the same product
    const already = current.find(
      (p) => p.id === product.id || p.product_id === product.product_id
    );
    const merged = already ? { ...already, ...product, sizes, colors } : product;
    const updated = [
      merged,
      ...current.filter((p) => p.id !== product.id && p.product_id !== product.product_id),
    ];
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    notifyListeners(updated);
    return {
      success: !dbError,
      product: merged,
      error: dbError ? String(dbError.message || dbError) : null,
      savedLocally: true,
      colorUploadWarnings: resolvedColors.errors || [],
    };
  },

  /**
   * Update product details in Supabase
   */
  async updateProduct(id, updates) {
    let nextUpdates = { ...updates };
    const sizes =
      nextUpdates.sizes !== undefined
        ? serializeProductSizes(nextUpdates.sizes, Number(nextUpdates.price ?? nextUpdates.basePrice ?? 0) || 0)
        : undefined;
    let colors;
    let colorUploadWarnings = [];
    if (nextUpdates.colors !== undefined) {
      const resolved = await resolveColorImagesForSave(nextUpdates.colors || []);
      colors = serializeProductColors(resolved.colors);
      colorUploadWarnings = resolved.errors || [];
      if (colorUploadWarnings.length) {
        console.warn('Color image upload warnings:', colorUploadWarnings);
      }
    }

    if (nextUpdates.image !== undefined && String(nextUpdates.image || '').startsWith('data:')) {
      const resolvedImg = await resolveImageForDatabase(nextUpdates.image, {
        folder: 'products',
        orderId: id,
        fileName: `products/${id}-${Date.now()}.jpg`,
      });
      if (resolvedImg.url) nextUpdates = { ...nextUpdates, image: resolvedImg.url };
    }

    let dbError = null;
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const payload = {};
        if (nextUpdates.name !== undefined) payload.name = nextUpdates.name;
        if (nextUpdates.price !== undefined) payload.price = Number(nextUpdates.price);
        if (nextUpdates.unit_cost !== undefined) payload.unit_cost = Number(nextUpdates.unit_cost);
        if (nextUpdates.unitCost !== undefined) payload.unit_cost = Number(nextUpdates.unitCost);
        if (sizes !== undefined) payload.sizes = sizes;
        if (colors !== undefined) payload.colors = colors;
        if (nextUpdates.oldPrice !== undefined) {
          payload.old_price =
            sanitizeCompareAtPrice(nextUpdates.oldPrice, Number(nextUpdates.price) || 0) ?? null;
        }
        if (nextUpdates.category !== undefined) payload.category_id = categoryIdFromName(nextUpdates.category);
        if (nextUpdates.category_id !== undefined) payload.category_id = nextUpdates.category_id;
        if (nextUpdates.brand !== undefined) payload.brand = nextUpdates.brand;
        if (nextUpdates.badge !== undefined) payload.badge = nextUpdates.badge;
        if (nextUpdates.description !== undefined) payload.description = nextUpdates.description;
        if (nextUpdates.image !== undefined) payload.image = nextUpdates.image;
        if (nextUpdates.sku !== undefined) payload.sku = nextUpdates.sku;
        if (nextUpdates.compatibility !== undefined) payload.compatibility = nextUpdates.compatibility;
        if (nextUpdates.rating !== undefined) payload.rating = Number(nextUpdates.rating);
        if (nextUpdates.reviews !== undefined) payload.reviews = Number(nextUpdates.reviews);
        if (nextUpdates.features !== undefined) payload.features = nextUpdates.features;
        if (nextUpdates.material !== undefined) payload.material = nextUpdates.material;
        if (nextUpdates.weight !== undefined) payload.weight = nextUpdates.weight;

        if (Object.keys(payload).length > 0) {
          // Prefer product_id (primary business key); fall back to id
          let { error, data } = await client
            .from('products')
            .update(payload)
            .eq('product_id', id)
            .select('product_id, sizes, colors');

          if (error || !data?.length) {
            const retry = await client
              .from('products')
              .update(payload)
              .eq('id', id)
              .select('product_id, sizes, colors');
            error = retry.error;
            data = retry.data;
          }

          if (error) {
            dbError = error;
            console.warn('Supabase product update failed:', error);
          } else if (!data?.length) {
            dbError = { message: `No product row updated for id=${id}` };
            console.warn(dbError.message);
          }
        }
        if (nextUpdates.stock !== undefined) {
          await upsertInventoryStock(client, id, nextUpdates.stock);
        }
      }
    } catch (e) {
      dbError = e;
      console.warn('Supabase product update failed:', e);
    }

    const current = await this.getProducts();
    const safeUpdates = { ...nextUpdates };
    if (sizes !== undefined) safeUpdates.sizes = sizes;
    if (colors !== undefined) safeUpdates.colors = colors;
    const updated = current.map((p) =>
      p.id === id || p.product_id === id ? { ...p, ...safeUpdates } : p
    );
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    notifyListeners(updated);
    return {
      success: !dbError,
      product: updated.find((p) => p.id === id || p.product_id === id),
      error: dbError ? String(dbError.message || dbError) : null,
      savedLocally: true,
      colorUploadWarnings,
    };
  },

  /**
   * Delete a product from Supabase and sync local catalog cache
   */
  async deleteProduct(id) {
    if (!id) return { success: false, error: 'Product ID is required' };
    const prodId = String(id).trim();

    try {
      const client = supabaseManager.getClient();
      if (client) {
        // NOTE: order_items / sale_items / purchase_items are intentionally NOT
        // deleted here. Their FK columns (product_id) are ON DELETE SET NULL, so
        // the DB nulls them out automatically when the product row is removed —
        // preserving order/sales/purchase history instead of destroying it.
        // We only clear throwaway local tables (cart + inventory cache).
        try {
          await client.from('cart_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
        } catch (e) {}
        try {
          await client.from('inventory').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
        } catch (e) {}

        // 2. Delete the product itself from Supabase
        const { error } = await client
          .from('products')
          .delete()
          .or(`product_id.eq.${prodId},id.eq.${prodId}`);

        if (error) {
          console.warn('Supabase product delete with .or failed, trying exact eq:', error);
          await client.from('products').delete().eq('product_id', prodId);
          await client.from('products').delete().eq('id', prodId);
        }
      }
    } catch (e) {
      console.warn('Supabase product delete exception:', e);
    }

    // 3. Immediately remove from local memory & storage cache
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      let list = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (e) {}
      }
      if (!Array.isArray(list) || list.length === 0) {
        list = MOTOR_PARTS;
      }
      const updated = list.filter((p) => p.id !== prodId && p.product_id !== prodId);
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      notifyListeners(updated);
      return { success: true, products: updated };
    } catch (e) {
      return { success: true };
    }
  },

  /**
   * Quick adjust stock (+/- delta) in Supabase
   */
  async quickAdjustStock(id, delta) {
    const current = await this.getProducts();
    const target = current.find((p) => p.id === id || p.product_id === id);
    if (!target) return { success: false, error: 'Product not found' };

    const newStock = Math.max(0, (target.stock || 0) + delta);
    return await this.updateProduct(id, { stock: newStock });
  },

  /**
   * Admin purchases stock from a supplier:
   * - increases inventory
   * - updates purchase cost (unit_cost)
   * - optionally raises selling price
   * - records purchase_orders / purchase_items + expense log
   */
  async purchaseFromSupplier({
    productId,
    quantity,
    unitCost,
    sellPrice,
    supplierId = null,
    supplierName = '',
    sizeDeltas = null,
  }) {
    const cost = Number(unitCost);
    const price = sellPrice != null && sellPrice !== '' ? Number(sellPrice) : null;

    if (!productId) return { success: false, error: 'Product is required' };
    if (!Number.isFinite(cost) || cost < 0) {
      return { success: false, error: 'Enter a valid supplier purchase cost' };
    }

    const current = await this.getProducts();
    const target = current.find((p) => p.id === productId || p.product_id === productId);
    if (!target) return { success: false, error: 'Product not found' };

    const existingSizes = normalizeProductSizes(target);
    const deltaMap = new Map();
    if (Array.isArray(sizeDeltas)) {
      sizeDeltas.forEach((row) => {
        const label = String(row?.label || '').trim();
        const add = Number(row?.quantity ?? row?.addQty ?? 0);
        if (!label || !Number.isFinite(add) || add <= 0) return;
        deltaMap.set(label, (deltaMap.get(label) || 0) + add);
      });
    }

    let qty = Number(quantity);
    let nextSizes = undefined;
    if (deltaMap.size > 0 && existingSizes.length > 0) {
      nextSizes = existingSizes.map((s) => {
        const add = deltaMap.get(s.label) || 0;
        const prev =
          s.stock === null || s.stock === undefined
            ? Number(target.stock || 0)
            : Number(s.stock || 0);
        return {
          label: s.label,
          price: Number(s.price) || Number(target.price) || 0,
          stock: Math.max(0, prev + add),
        };
      });
      deltaMap.forEach((add, label) => {
        if (!nextSizes.some((s) => s.label === label)) {
          nextSizes.push({
            label,
            price: Number(target.price) || 0,
            stock: Math.max(0, add),
          });
        }
      });
      qty = Array.from(deltaMap.values()).reduce((a, b) => a + b, 0);
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Enter a valid purchase quantity' };
    }

    const prevStock = Number(target.stock || 0);
    const newStock =
      nextSizes && nextSizes.length
        ? nextSizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
        : prevStock + qty;
    const prevPrice = Number(target.price || 0);
    const nextPrice = price != null && Number.isFinite(price) && price >= 0 ? price : prevPrice;
    const expense = cost * qty;
    const profitPerUnit = nextPrice - cost;
    const expectedProfit = profitPerUnit * qty;
    const margin = nextPrice > 0 ? (profitPerUnit / nextPrice) * 100 : 0;

    const updates = {
      stock: newStock,
      unit_cost: cost,
      unitCost: cost,
      price: nextPrice,
    };
    if (nextSizes) {
      updates.sizes = serializeProductSizes(nextSizes, nextPrice);
    }

    const updateRes = await this.updateProduct(productId, updates);
    if (!updateRes?.success) {
      return { success: false, error: updateRes?.error || 'Failed to update product' };
    }

    const poId = `po-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const piId = `pi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const expId = `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const today = new Date().toISOString().slice(0, 10);

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const poPayload = {
          po_id: poId,
          supplier_id: supplierId || null,
          order_date: new Date().toISOString(),
          status: 'Completed',
          total_amount: expense,
        };
        let { error: poErr } = await client.from('purchase_orders').insert([poPayload]);
        if (poErr && supplierId) {
          const retry = await client
            .from('purchase_orders')
            .insert([{ ...poPayload, supplier_id: null }]);
          poErr = retry.error;
        }
        if (poErr) console.warn('[ProductService] purchase_orders insert:', poErr);

        const { error: piErr } = await client.from('purchase_items').insert([
          {
            purchase_item_id: piId,
            po_id: poId,
            product_id: target.product_id || target.id,
            quantity: qty,
            cost,
            subtotal: expense,
          },
        ]);
        if (piErr) console.warn('[ProductService] purchase_items insert:', piErr);

        // Log as business expense (supplier purchase) — separate from customer payments
        const { error: expErr } = await client.from('financial_expenses').insert([
          {
            expense_id: expId,
            category: 'Other',
            amount: expense,
            expense_date: today,
            description: `Supplier purchase: ${qty} × ${target.name}${
              supplierName ? ` from ${supplierName}` : ''
            } @ ₱${cost.toLocaleString()}`,
            payment_method: 'Supplier Purchase',
            created_by: 'admin',
          },
        ]);
        if (expErr) console.warn('[ProductService] financial_expenses insert:', expErr);
      }
    } catch (e) {
      console.warn('[ProductService] purchaseFromSupplier sync warning:', e);
    }

    // Local purchase history for admin expense/profit view
    try {
      const key = 'mototrack_supplier_purchases_v1';
      const raw = appStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const entry = {
        id: poId,
        product_id: target.product_id || target.id,
        product_name: target.name,
        supplier_id: supplierId,
        supplier_name: supplierName || 'Supplier',
        quantity: qty,
        unit_cost: cost,
        sell_price: nextPrice,
        expense,
        profit_per_unit: profitPerUnit,
        expected_profit: expectedProfit,
        margin,
        size_deltas: deltaMap.size
          ? Array.from(deltaMap.entries()).map(([label, quantity]) => ({ label, quantity }))
          : null,
        created_at: new Date().toISOString(),
      };
      const next = [entry, ...(Array.isArray(list) ? list : [])].slice(0, 100);
      appStorage.setItem(key, JSON.stringify(next));
    } catch (_e) {}

    return {
      success: true,
      product: {
        ...target,
        stock: newStock,
        unit_cost: cost,
        unitCost: cost,
        price: nextPrice,
        ...(nextSizes ? { sizes: serializeProductSizes(nextSizes, nextPrice) } : {}),
      },
      purchase: {
        poId,
        quantity: qty,
        unitCost: cost,
        sellPrice: nextPrice,
        expense,
        profitPerUnit,
        expectedProfit,
        margin,
        previousPrice: prevPrice,
        previousStock: prevStock,
      },
    };
  },

  getSupplierPurchases() {
    try {
      const raw = appStorage.getItem('mototrack_supplier_purchases_v1');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  /**
   * Validate stock availability without mutating inventory.
   * Aggregates quantities when the same product appears multiple times.
   */
  async validateStock(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'No items to validate' };
    }

    const catalog = await this.getProducts();
    const needed = new Map();

    for (const item of items) {
      const rawId = item.product_id || item.id || item.product?.id || item.product?.product_id;
      // Cart/POS line keys may be "productId::size" — use the product id only
      const prodId =
        typeof rawId === 'string' && rawId.includes('::') ? rawId.split('::')[0] : rawId;
      const name = item.name || item.product?.name || 'Unknown product';
      const qty = Number(item.quantity || 1);
      if (!prodId || qty <= 0) continue;
      const prev = needed.get(prodId) || { qty: 0, name };
      needed.set(prodId, { qty: prev.qty + qty, name: prev.name || name });
    }

    if (needed.size === 0) {
      return { success: false, error: 'No valid products in order' };
    }

    const insufficient = [];
    const plan = [];

    for (const [prodId, { qty, name }] of needed.entries()) {
      const match = catalog.find((p) => p.id === prodId || p.product_id === prodId);
      if (!match) {
        insufficient.push({ productId: prodId, name, available: 0, requested: qty });
        continue;
      }
      const available = Number(match.stock || 0);
      if (available < qty) {
        insufficient.push({
          productId: prodId,
          name: match.name || name,
          available,
          requested: qty,
        });
        continue;
      }
      plan.push({
        productId: match.id || match.product_id || prodId,
        name: match.name || name,
        quantity: qty,
        previousStock: available,
        newStock: available - qty,
      });
    }

    if (insufficient.length > 0) {
      const first = insufficient[0];
      return {
        success: false,
        error: `Insufficient stock for "${first.name}" (only ${first.available} left, need ${first.requested})`,
        insufficient,
      };
    }

    return { success: true, plan };
  },

  /**
   * Deduct stock for completed order / POS checkout.
   * Aborts without mutating local inventory if any line lacks stock or a remote write fails.
   */
  async deductStock(items) {
    if (!Array.isArray(items) || items.length === 0) return { success: true };

    const validation = await this.validateStock(items);
    if (!validation.success) {
      return { success: false, error: validation.error, insufficient: validation.insufficient };
    }

    const catalog = await this.getProducts();
    const updated = [...catalog];
    const appliedRemote = [];
    const client = supabaseManager.getClient();

    const rollbackRemote = async () => {
      if (!client) return;
      for (const done of appliedRemote) {
        try {
          await upsertInventoryStock(client, done.productId, done.previousStock);
        } catch (e) {
          console.warn('Supabase stock rollback error:', e);
        }
      }
    };

    for (const step of validation.plan) {
      const index = updated.findIndex((p) => p.id === step.productId || p.product_id === step.productId);
      if (index === -1 || Number(updated[index].stock || 0) < step.quantity) {
        await rollbackRemote();
        return { success: false, error: `Insufficient stock for "${step.name}"` };
      }

      updated[index] = { ...updated[index], stock: step.newStock };

      if (client) {
        try {
          const { data: invRows, error } = await client
            .from('inventory')
            .select('product_id, stock_quantity')
            .eq('product_id', step.productId)
            .limit(1);

          if (error) {
            console.warn('Supabase stock deduction error:', error);
            await rollbackRemote();
            return { success: false, error: `Failed to update inventory for "${step.name}"` };
          } else if (invRows && invRows.length > 0) {
            const remoteStock = Number(invRows[0].stock_quantity || 0);
            if (remoteStock < step.quantity) {
              await rollbackRemote();
              return {
                success: false,
                error: `Insufficient stock for "${step.name}" (only ${remoteStock} left)`,
              };
            }
            const newQty = remoteStock - step.quantity;
            await upsertInventoryStock(client, step.productId, newQty);
            appliedRemote.push({
              ...step,
              previousStock: remoteStock,
              newStock: newQty,
            });
          } else {
            await upsertInventoryStock(client, step.productId, step.newStock);
            appliedRemote.push(step);
          }
        } catch (e) {
          console.warn('Supabase stock deduction error:', e);
        }
      }
    }

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    notifyListeners(updated);
    return { success: true, products: updated, deductions: validation.plan };
  },

  /**
   * Restore previously deducted stock (cancel / failed checkout rollback).
   */
  async restoreStock(items) {
    if (!Array.isArray(items) || items.length === 0) return { success: true };

    const catalog = await this.getProducts();
    const updated = [...catalog];
    const client = supabaseManager.getClient();

    for (const item of items) {
      const rawId = item.product_id || item.id || item.product?.id || item.product?.product_id;
      const prodId =
        typeof rawId === 'string' && rawId.includes('::') ? rawId.split('::')[0] : rawId;
      const qty = Number(item.quantity || 1);
      if (!prodId || qty <= 0) continue;

      const index = updated.findIndex((p) => p.id === prodId || p.product_id === prodId);
      if (index === -1) continue;

      const newStock = Number(updated[index].stock || 0) + qty;
      updated[index] = { ...updated[index], stock: newStock };

      if (client) {
        try {
          await upsertInventoryStock(client, prodId, newStock);
        } catch (e) {
          console.warn('Supabase stock restore error:', e);
        }
      }
    }

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    notifyListeners(updated);
    return { success: true, products: updated };
  },

  /**
   * Fetch customer reviews for a product (Supabase + local fallback).
   */
  async getProductReviews(productId) {
    if (!productId) return [];
    const id = String(productId);

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('product_reviews')
          .select('*')
          .eq('product_id', id)
          .order('created_at', { ascending: false })
          .limit(40);
        if (!error && Array.isArray(data)) {
          return data.map((r) => ({
            id: r.review_id,
            review_id: r.review_id,
            productId: r.product_id,
            orderId: r.order_id,
            customerName: r.customer_name || 'Rider',
            rating: Number(r.rating) || 5,
            comment: r.comment || '',
            createdAt: r.created_at,
          }));
        }
      }
    } catch (e) {
      console.warn('getProductReviews supabase note:', e);
    }

    try {
      const raw = appStorage.getItem(REVIEWS_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(all)) return [];
      return all
        .filter((r) => String(r.productId || r.product_id) === id)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch {
      return [];
    }
  },

  /**
   * Submit a customer rating & review for a product from a delivered order
   */
  async submitProductReview({ productId, rating, comment, customerName, orderId }) {
    if (!productId) return { success: false, error: 'Product ID is required' };
    const reviewId = `rev-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reviewRow = {
      id: reviewId,
      review_id: reviewId,
      productId,
      product_id: productId,
      orderId: orderId || null,
      customerName: customerName || 'Rider',
      customer_name: customerName || 'Rider',
      rating: Number(rating) || 5,
      comment: String(comment || '').trim(),
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('product_reviews').insert([
          {
            review_id: reviewId,
            product_id: productId,
            order_id: orderId || null,
            customer_name: reviewRow.customerName,
            rating: reviewRow.rating,
            comment: reviewRow.comment || null,
            created_at: reviewRow.createdAt,
          },
        ]);
      }
    } catch (e) {
      console.warn('product_reviews insert note:', e);
    }

    try {
      const raw = appStorage.getItem(REVIEWS_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const next = [reviewRow, ...(Array.isArray(all) ? all : [])];
      appStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(next.slice(0, 500)));
    } catch (e) {
      console.warn('local review save note:', e);
    }

    try {
      const current = await this.getProducts();
      const product = current.find((p) => p.id === productId || p.product_id === productId);
      if (product) {
        const prevRating = Number(product.rating || 0);
        const prevReviews = Number(product.reviews || 0);
        const newReviews = prevReviews + 1;
        const newRating = Number(
          ((prevRating * prevReviews + Number(rating)) / newReviews).toFixed(1)
        );

        await this.updateProduct(product.id || product.product_id, {
          rating: newRating,
          reviews: newReviews,
        });

        try {
          await notificationService.notifyAdminCustomerReview({
            customerName: customerName || 'Rider',
            productName: product.name,
            rating: Number(rating),
            comment: comment || 'Verified purchase from delivered order',
          });
        } catch (ne) {
          console.warn('Failed to notify admin of review:', ne);
        }

        return { success: true, newRating, newReviews, review: reviewRow };
      }
    } catch (e) {
      console.warn('submitProductReview error:', e);
    }
    return { success: true, review: reviewRow };
  },
};
