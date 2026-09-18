import { supabaseManager } from './supabaseClient';
import { MOTOR_PARTS } from '../data/motorParts';
import { appStorage } from './storageAdapter';
import { notificationService } from './notificationService';

const STORAGE_KEY = 'mototrack_products_catalog';
const listeners = new Set();
let realtimeChannel = null;

const CATEGORY_ID_BY_NAME = {
  drivetrain: 'cat-01',
  tires: 'cat-02',
  accessories: 'cat-03',
  exhaust: 'cat-04',
  brakes: 'cat-05',
  engine: 'cat-06',
  suspension: 'cat-07',
  maintenance: 'cat-08',
};

function categoryIdFromName(name) {
  const key = String(name || '')
    .trim()
    .toLowerCase();
  return CATEGORY_ID_BY_NAME[key] || 'cat-03';
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
  async getProducts() {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('products')
          .select('*, categories(name), inventory(stock_quantity)')
          .order('created_at', { ascending: false });

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
              oldPrice: item.old_price ? Number(item.old_price) : undefined,
              rating: Number(item.rating || 5.0),
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
    const product = {
      id: prodId,
      product_id: prodId,
      name: newProduct.name.trim(),
      category: newProduct.category || 'Accessories',
      brand: newProduct.brand?.trim() || 'MotoTrack',
      price: Number(newProduct.price),
      oldPrice: newProduct.oldPrice ? Number(newProduct.oldPrice) : undefined,
      rating: Number(newProduct.rating || 5.0),
      reviews: Number(newProduct.reviews || 1),
      compatibility: newProduct.compatibility || 'Universal Motorcycle Fitment',
      sku: newProduct.sku || 'TRACK-' + Math.floor(1000 + Math.random() * 9000),
      stock: Number(newProduct.stock || 10),
      badge: newProduct.badge || 'New',
      type: newProduct.type || 'newArrival',
      isNew: Boolean(newProduct.isNew ?? true),
      discount: newProduct.discount || '',
      image:
        newProduct.image ||
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      material: newProduct.material || 'CNC Aluminum / Titanium',
      weight: newProduct.weight || '1.2 kg',
      description: newProduct.description || 'High quality motorcycle upgrade part.',
      features: Array.isArray(newProduct.features)
        ? newProduct.features
        : ['Direct OEM Fitment', 'Track Tested'],
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('products').insert([
          {
            product_id: product.product_id,
            name: product.name,
            category_id: categoryIdFromName(product.category),
            brand: product.brand,
            price: product.price,
            old_price: product.oldPrice,
            rating: product.rating,
            reviews: product.reviews,
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
        await upsertInventoryStock(client, product.product_id, product.stock);
      }
    } catch (e) {
      console.warn('Supabase product insert failed:', e);
    }

    const current = await this.getProducts();
    const updated = [product, ...current.filter((p) => p.id !== product.id)];
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    notifyListeners(updated);
    return { success: true, product };
  },

  /**
   * Update product details in Supabase
   */
  async updateProduct(id, updates) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.price !== undefined) payload.price = Number(updates.price);
        if (updates.oldPrice !== undefined)
          payload.old_price = updates.oldPrice ? Number(updates.oldPrice) : null;
        if (updates.category !== undefined) payload.category_id = categoryIdFromName(updates.category);
        if (updates.category_id !== undefined) payload.category_id = updates.category_id;
        if (updates.brand !== undefined) payload.brand = updates.brand;
        if (updates.badge !== undefined) payload.badge = updates.badge;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.image !== undefined) payload.image = updates.image;
        if (updates.sku !== undefined) payload.sku = updates.sku;
        if (updates.compatibility !== undefined) payload.compatibility = updates.compatibility;
        if (updates.rating !== undefined) payload.rating = Number(updates.rating);
        if (updates.reviews !== undefined) payload.reviews = Number(updates.reviews);

        if (Object.keys(payload).length > 0) {
          await client.from('products').update(payload).or(`product_id.eq.${id},id.eq.${id}`);
        }
        if (updates.stock !== undefined) {
          await upsertInventoryStock(client, id, updates.stock);
        }
      }
    } catch (e) {
      console.warn('Supabase product update failed:', e);
    }

    const current = await this.getProducts();
    const updated = current.map((p) => (p.id === id || p.product_id === id ? { ...p, ...updates } : p));
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    notifyListeners(updated);
    return { success: true, product: updated.find((p) => p.id === id || p.product_id === id) };
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
        // 1. Clean up any related child records first to satisfy foreign keys
        try {
          await client.from('cart_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
        } catch (e) {}
        try {
          await client.from('inventory').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
        } catch (e) {}
        try {
          await client.from('order_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
        } catch (e) {}
        try {
          await client.from('sale_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
        } catch (e) {}
        try {
          await client.from('purchase_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`);
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
      const prodId = item.product_id || item.id || item.product?.id || item.product?.product_id;
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
      const prodId = item.product_id || item.id || item.product?.id || item.product?.product_id;
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
   * Submit a customer rating & review for a product from a delivered order
   */
  async submitProductReview({ productId, rating, comment, customerName, orderId }) {
    if (!productId) return { success: false, error: 'Product ID is required' };
    try {
      const current = await this.getProducts();
      const product = current.find((p) => p.id === productId || p.product_id === productId);
      if (product) {
        const prevRating = Number(product.rating || 5.0);
        const prevReviews = Number(product.reviews || 0);
        const newReviews = prevReviews + 1;
        // Weighted new rating calculation rounded to 1 decimal
        const newRating = Number(((prevRating * prevReviews + Number(rating)) / newReviews).toFixed(1));

        await this.updateProduct(product.id || product.product_id, {
          rating: newRating,
          reviews: newReviews,
        });

        // Notify admin about this new customer review
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

        return { success: true, newRating, newReviews };
      }
    } catch (e) {
      console.warn('submitProductReview error:', e);
    }
    return { success: false };
  },
};
