/**
 * Soft stock reservations for in-flight checkouts.
 * Available stock = inventory.stock_quantity − active reservations.
 */
import { supabaseManager } from './supabaseClient.js';

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export const reservationService = {
  async releaseExpired() {
    const client = supabaseManager.getClient();
    if (!client) return 0;
    try {
      const { data, error } = await client.rpc('fn_release_expired_reservations');
      if (error) {
        console.warn('releaseExpired:', error.message);
        return 0;
      }
      return Number(data) || 0;
    } catch (e) {
      console.warn('releaseExpired:', e);
      return 0;
    }
  },

  async getAvailableStock(productId) {
    const client = supabaseManager.getClient();
    if (!client || !productId) return null;
    try {
      const { data, error } = await client.rpc('fn_available_stock', {
        p_product_id: productId,
      });
      if (error) return null;
      return Number(data);
    } catch {
      return null;
    }
  },

  /**
   * Reserve quantity for an order. Checks available stock first.
   */
  async reserve({ orderId, productId, quantity, ttlMs = DEFAULT_TTL_MS }) {
    const client = supabaseManager.getClient();
    if (!client) return { success: false, error: 'Database unavailable' };
    const qty = Math.trunc(Number(quantity) || 0);
    if (!productId || qty <= 0) return { success: false, error: 'Invalid reservation' };

    await this.releaseExpired();
    const available = await this.getAvailableStock(productId);
    if (available != null && available < qty) {
      return {
        success: false,
        error: `Insufficient available stock (available ${available}, need ${qty})`,
      };
    }

    const reservationId = `rsv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const { error } = await client.from('stock_reservations').insert([
      {
        reservation_id: reservationId,
        order_id: orderId || null,
        product_id: productId,
        quantity: qty,
        expires_at: expiresAt,
      },
    ]);
    if (error) return { success: false, error: error.message };
    return { success: true, reservationId, expiresAt };
  },

  async releaseByOrder(orderId) {
    const client = supabaseManager.getClient();
    if (!client || !orderId) return { success: false };
    const { error } = await client.from('stock_reservations').delete().eq('order_id', orderId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};

export default reservationService;
