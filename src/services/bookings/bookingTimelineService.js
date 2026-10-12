/**
 * Append-only booking timeline helpers.
 * Extends booking_status_history with event_type / actor / metadata.
 */
import { supabaseManager } from '../../lib/supabase.js';
import { dataCache } from '../cache/dataCache.js';
import { CacheKeys } from '../cache/cacheKeys.js';
import {
  BOOKING_ROLES,
  TIMELINE_EVENTS,
  buildTimelineEvent,
} from '../../utils/bookingWorkflow.js';

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function client() {
  return supabaseManager.getClient();
}

let hasTimelineEventColumns = null;

export function getTimelineEventColumnsSupport() {
  return hasTimelineEventColumns;
}

export function setTimelineEventColumnsSupport(supported) {
  hasTimelineEventColumns = Boolean(supported);
}

function normalizeTimelineRow(row) {
  if (!row) return row;
  return {
    history_id: row.history_id,
    booking_id: row.booking_id,
    from_status: row.from_status,
    to_status: row.to_status,
    changed_by: row.changed_by,
    notes: row.notes,
    created_at: row.created_at,
    event_type: row.event_type || 'STATUS_CHANGED',
    description: row.description || row.notes || (row.to_status ? `Status changed to ${row.to_status}` : 'Status updated'),
    actor_id: row.actor_id || row.changed_by || null,
    actor_role: row.actor_role || (row.changed_by === 'admin' ? BOOKING_ROLES.ADMIN : BOOKING_ROLES.SYSTEM),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  };
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

    const baseRow = {
      history_id: row.history_id,
      booking_id: row.booking_id,
      from_status: row.from_status,
      to_status: row.to_status,
      changed_by: row.changed_by || row.actor_id || 'system',
      notes: row.notes || row.description || '',
      created_at: row.created_at,
    };

    try {
      if (hasTimelineEventColumns === false) {
        // Table does not have event_type column yet: write base fields directly
        const { error: eBase } = await c.from('booking_status_history').insert([baseRow]);
        if (eBase) return { success: false, error: eBase.message };
      } else {
        const { error } = await c.from('booking_status_history').insert([row]);
        if (error) {
          if (error.code === '42703' || String(error.message || '').includes('event_type')) {
            hasTimelineEventColumns = false;
            const { error: e2 } = await c.from('booking_status_history').insert([baseRow]);
            if (e2) return { success: false, error: e2.message };
          } else {
            return { success: false, error: error.message };
          }
        } else if (hasTimelineEventColumns === null) {
          hasTimelineEventColumns = true;
        }
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

        const baseCols = 'history_id, booking_id, from_status, to_status, changed_by, notes, created_at';
        const fullCols = 'history_id, booking_id, from_status, to_status, changed_by, notes, created_at, event_type, description, actor_id, actor_role, metadata';

        if (hasTimelineEventColumns === false) {
          const { data } = await c
            .from('booking_status_history')
            .select(baseCols)
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: true });
          return (data || []).map(normalizeTimelineRow);
        }

        let { data, error } = await c
          .from('booking_status_history')
          .select(fullCols)
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true });

        if (error && (error.code === '42703' || String(error.message || '').includes('event_type'))) {
          hasTimelineEventColumns = false;
          const retry = await c
            .from('booking_status_history')
            .select(baseCols)
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: true });
          data = retry.data;
        } else if (!error && hasTimelineEventColumns === null) {
          hasTimelineEventColumns = true;
        }

        return (data || []).map(normalizeTimelineRow);
      },
      { ttlMs: 30 * 1000, force }
    );
  },
};

export default bookingTimelineService;
