/**
 * Append-only booking timeline helpers.
 * Extends booking_status_history with event_type / actor / metadata.
 */
import { supabaseManager } from './supabaseClient.js';
import { dataCache } from './cache/dataCache.js';
import { CacheKeys } from './cache/cacheKeys.js';
import {
  BOOKING_ROLES,
  TIMELINE_EVENTS,
  buildTimelineEvent,
} from '../utils/bookingWorkflow.js';

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function client() {
  return supabaseManager.getClient();
}

export const bookingTimelineService = {
  TIMELINE_EVENTS,
  BOOKING_ROLES,

  async append(event) {
    const c = client();
    if (!c || !event?.booking_id) return { success: false, error: 'booking_id required' };

    const row = {
      history_id: newId('bsh'),
      ...buildTimelineEvent(event),
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await c.from('booking_status_history').insert([row]);
      if (error) {
        // Fallback if new columns not yet migrated
        const { error: e2 } = await c.from('booking_status_history').insert([
          {
            history_id: row.history_id,
            booking_id: row.booking_id,
            from_status: row.from_status,
            to_status: row.to_status,
            changed_by: row.changed_by,
            notes: row.notes,
            created_at: row.created_at,
          },
        ]);
        if (e2) return { success: false, error: e2.message };
      }
      dataCache.invalidate(`booking-timeline:${event.booking_id}`);
      return { success: true, event: row };
    } catch (e) {
      return { success: false, error: e?.message || 'Timeline append failed' };
    }
  },

  async list(bookingId, { force = false } = {}) {
    if (!bookingId) return [];
    return dataCache.fetch(
      `booking-timeline:${bookingId}`,
      async () => {
        const c = client();
        if (!c) return [];
        const { data } = await c
          .from('booking_status_history')
          .select(
            'history_id, booking_id, from_status, to_status, changed_by, notes, created_at, event_type, description, actor_id, actor_role, metadata'
          )
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true });
        return data || [];
      },
      { ttlMs: 30 * 1000, force }
    );
  },
};

export default bookingTimelineService;
