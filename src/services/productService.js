import { supabaseManager } from './supabaseClient';
import { MOTOR_PARTS } from '../data/motorParts';
import { appStorage } from './storageAdapter';

const STORAGE_KEY = 'mototrack_products_catalog';
const listeners = new Set();
let realtimeChannel = null;

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async () => {
          const fresh = await productService.getProducts();
          notifyListeners(fresh);
        }
      )
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
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const normalized = data.map((item) => ({
            id: item.product_id || item.id,
            product_id: item.product_id || item.id,
            name: item.name || 'Pro Racing Component',
            category: item.category || 'Accessories',
            brand: item.brand || 'MotoTrack',
            price: Number(item.price) || 0,
            oldPrice: item.old_price ? Number(item.old_price) : undefined,
            rating: Number(item.rating || 5.0),
            reviews: Number(item.reviews || 0),
            compatibility: item.compatibility || 'Universal Fitment',
            sku: item.sku || 'SKU-' + (item.product_id || item.id),
            stock: Number(item.stock || 0),
            badge: item.badge || (item.is_new ? 'New' : undefined),
            type: item.type || 'newArrival',
            isNew: Boolean(item.is_new),
            discount: item.discount,
            image: item.image || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
            material: item.material || 'Aircraft Grade Alloy',
            weight: item.weight || '1.0 kg',
            description: item.description || '',
            features: Array.isArray(item.features)
              ? item.features
              : typeof item.features === 'string'
              ? JSON.parse(item.features)
              : [],
          }));
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
      image: newProduct.image || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
      material: newProduct.material || 'CNC Aluminum / Titanium',
      weight: newProduct.weight || '1.2 kg',
      description: newProduct.description || 'High quality motorcycle upgrade part.',
      features: Array.isArray(newProduct.features) ? newProduct.features : ['Direct OEM Fitment', 'Track Tested'],
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('products').insert([
          {
            product_id: product.product_id,
            name: product.name,
            category: product.category,
            brand: product.brand,
            price: product.price,
            old_price: product.oldPrice,
            rating: product.rating,
            reviews: product.reviews,
            compatibility: product.compatibility,
            sku: product.sku,
            stock: product.stock,
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
        if (updates.oldPrice !== undefined) payload.old_price = updates.oldPrice ? Number(updates.oldPrice) : null;
        if (updates.stock !== undefined) payload.stock = Number(updates.stock);
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.brand !== undefined) payload.brand = updates.brand;
        if (updates.badge !== undefined) payload.badge = updates.badge;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.image !== undefined) payload.image = updates.image;
        if (updates.sku !== undefined) payload.sku = updates.sku;
        if (updates.compatibility !== undefined) payload.compatibility = updates.compatibility;

        await client.from('products').update(payload).or(`product_id.eq.${id},id.eq.${id}`);
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
        try { await client.from('cart_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`); } catch (e) {}
        try { await client.from('inventory').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`); } catch (e) {}
        try { await client.from('order_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`); } catch (e) {}
        try { await client.from('sale_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`); } catch (e) {}
        try { await client.from('purchase_items').delete().or(`product_id.eq.${prodId},id.eq.${prodId}`); } catch (e) {}

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
   * Deduct stock for completed order / POS checkout in Supabase
   */
  async deductStock(items) {
    if (!Array.isArray(items) || items.length === 0) return { success: true };

    const current = await this.getProducts();
    const updated = [...current];

    for (const item of items) {
      const prodId = item.product_id || item.id || item.product?.id || item.product?.product_id;
      const qty = Number(item.quantity || 1);
      const index = updated.findIndex((p) => p.id === prodId || p.product_id === prodId);
      if (index !== -1) {
        const currentStock = updated[index].stock || 0;
        const newStock = Math.max(0, currentStock - qty);
        updated[index] = { ...updated[index], stock: newStock };

        // Supabase update
        try {
          const client = supabaseManager.getClient();
          if (client) {
            await client.from('products').update({ stock: newStock }).or(`product_id.eq.${prodId},id.eq.${prodId}`);
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
    return { success: true, products: updated };
  },
};
