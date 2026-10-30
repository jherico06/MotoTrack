import { supabaseManager } from '../../lib/supabase.js';
import { appStorage } from '../system/storageAdapter.js';
import { notificationService } from '../notifications/notificationService.js';

const STORAGE_KEY = 'mototrack_ratings_reports_v1';
const ADMIN_STATUS_MAP_KEY = 'mototrack_ratings_reports_status_map_v1';
const TTL_MS = 15000;

export const REPORT_CATEGORIES = {
  PRODUCT_QUALITY: { id: 'product_quality', label: 'Product Quality', color: '#3B82F6', icon: 'box-seam' },
  DELIVERY: { id: 'delivery', label: 'Delivery & Shipping', color: '#10B981', icon: 'truck' },
  SERVICE_QUALITY: { id: 'service_quality', label: 'Service Quality', color: '#8B5CF6', icon: 'tools' },
  MECHANIC_EXPERIENCE: { id: 'mechanic_experience', label: 'Mechanic Experience', color: '#F59E0B', icon: 'person-badge' },
  ORDER_ISSUES: { id: 'order_issues', label: 'Order Issues', color: '#EF4444', icon: 'receipt' },
  PAYMENT_ISSUES: { id: 'payment_issues', label: 'Payment Issues', color: '#EC4899', icon: 'credit-card' },
  GENERAL_FEEDBACK: { id: 'general_feedback', label: 'General Feedback', color: '#64748B', icon: 'chat-square-text' },
};

export const REPORT_STATUSES = {
  NEW: 'New',
  UNDER_REVIEW: 'Under Review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

class RatingsReportsService {
  constructor() {
    this.cache = new Map();
    this.inflight = new Map();
    this.listeners = new Set();
    this.realtimeChannel = null;
    this.setupStorageListener();
    this.setupSupabaseRealtime();
  }

  // ── Real-Time Pub/Sub Listener System ──
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  notify(event) {
    this.cache.delete('all_submissions');
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.warn('RatingsReportsService listener error:', e);
      }
    });
  }

  setupStorageListener() {
    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('storage', (e) => {
          if (e.key === 'mototrack_ratings_reports_ping' || e.key === STORAGE_KEY) {
            this.cache.delete('all_submissions');
            this.notify({ type: 'STORAGE_PING' });
          }
        });
        window.addEventListener('mototrack:new_customer_report', (e) => {
          this.cache.delete('all_submissions');
          this.notify({ type: 'NEW_REPORT', report: e.detail });
        });
      } catch (_e) {}
    }
  }

  setupSupabaseRealtime() {
    const client = supabaseManager.getClient();
    if (client && typeof client.channel === 'function') {
      try {
        this.realtimeChannel = client
          .channel('mototrack_feedback_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_ratings_reports' }, (payload) => {
            this.cache.delete('all_submissions');
            this.notify({ type: 'REALTIME_CHANGE', payload });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'product_reviews' }, (payload) => {
            this.cache.delete('all_submissions');
            this.notify({ type: 'REALTIME_CHANGE', payload });
          })
          .subscribe();
      } catch (_e) {}
    }
  }

  // ── Helper: Read/Write Admin Status Map ──
  getAdminStatusMap() {
    try {
      const raw = appStorage.getItem(ADMIN_STATUS_MAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_e) {
      return {};
    }
  }

  saveAdminStatusMap(map) {
    try {
      appStorage.setItem(ADMIN_STATUS_MAP_KEY, JSON.stringify(map));
    } catch (_e) {}
  }

  // ── Helper: Read/Write Local Submissions Cache ──
  getLocalSubmissions() {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Strip out any legacy mocked seed items or demo reviews
      const clean = parsed.filter(
        (item) =>
          item &&
          item.id &&
          !item.id.startsWith('rep-safety-seal-') &&
          !item.id.startsWith('rev-brembo-') &&
          !item.id.startsWith('rev-motul-') &&
          !item.id.startsWith('rep-delivery-delay-') &&
          !item.id.startsWith('rev-pms-tuneup-') &&
          !item.id.startsWith('rep-mechanic-pms-') &&
          !item.id.startsWith('rev-michelin-') &&
          !item.id.startsWith('rev-cvt-mechanic-') &&
          !item.id.startsWith('rev-demo-') &&
          item.customerName !== 'Marco R.' &&
          item.customerName !== 'Aya Santos'
      );
      if (clean.length !== parsed.length) {
        this.saveLocalSubmissions(clean, { silent: true });
      }
      return clean;
    } catch (_e) {
      return [];
    }
  }

  saveLocalSubmissions(list, { silent = true } = {}) {
    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
    } catch (_e) {}
  }

  /**
   * Fetch all raw customer submissions by aggregating:
   * 1. Supabase `customer_ratings_reports` table (if available)
   * 2. Supabase `product_reviews` table (real customer product reviews)
   * 3. Supabase `orders` with `is_rated` or `rating_data` or return requests
   * 4. Persistent local submissions
   * Applies admin status & notes overlay from persistent map.
   */
  async getAllSubmissions({ force = false } = {}) {
    const cacheKey = 'all_submissions';
    if (!force) {
      const hit = this.cache.get(cacheKey);
      if (hit && Date.now() - hit.at < TTL_MS) {
        return hit.data;
      }
      if (this.inflight.has(cacheKey)) {
        return this.inflight.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
      const client = supabaseManager.getClient();
      const statusMap = this.getAdminStatusMap();
      const submissionsMap = new Map();

      // 1. Fetch from persistent local submissions first
      const localItems = this.getLocalSubmissions();
      localItems.forEach((item) => {
        submissionsMap.set(item.id, { ...item });
      });

      // 2. Fetch from Supabase `customer_ratings_reports` if table exists
      if (client) {
        try {
          const { data: dbReports, error: repErr } = await client
            .from('customer_ratings_reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(150);

          if (!repErr && Array.isArray(dbReports)) {
            dbReports.forEach((row) => {
              submissionsMap.set(row.id, {
                id: row.id,
                submissionType: row.submission_type || 'rating_review',
                customerName: row.customer_name || 'Rider',
                customerEmail: row.customer_email || null,
                customerId: row.customer_id || null,
                rating: row.rating != null ? Number(row.rating) : null,
                category: row.category || 'general_feedback',
                message: row.message || '',
                transactionType: row.transaction_type || 'general',
                transactionId: row.transaction_id || null,
                transactionStatus: row.transaction_status || null,
                transactionRef: row.transaction_details?.ref_title || row.transaction_id || '',
                status: row.status || REPORT_STATUSES.NEW,
                adminNotes: row.admin_notes || '',
                reviewedBy: row.reviewed_by || null,
                reviewedAt: row.reviewed_at || null,
                dismissedReason: row.dismissed_reason || null,
                createdAt: row.created_at || new Date().toISOString(),
                updatedAt: row.updated_at || new Date().toISOString(),
              });
            });
          }
        } catch (_e) {
          // Table may not yet be provisioned on remote DB
        }

        // 3. Fetch real customer `product_reviews` from Supabase
        try {
          const { data: dbReviews, error: revErr } = await client
            .from('product_reviews')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          if (!revErr && Array.isArray(dbReviews)) {
            // Also fetch product catalog summary map for readable titles
            let productNames = {};
            try {
              const { data: prods } = await client.from('products').select('id,product_id,name');
              if (prods) {
                prods.forEach((p) => {
                  if (p.id) productNames[p.id] = p.name;
                  if (p.product_id) productNames[p.product_id] = p.name;
                });
              }
            } catch (_pe) {}

            dbReviews.forEach((rev) => {
              const rawId = rev.review_id || rev.id;

              // Filter out demo reviews without a genuine rated order
              // Specifically exclude demo seeded entries like 'rev-demo-1' (Marco R.) and 'rev-demo-2' (Aya Santos)
              if (
                String(rawId).startsWith('rev-demo-') ||
                rev.customer_name === 'Marco R.' ||
                rev.customer_name === 'Aya Santos' ||
                !rev.order_id
              ) {
                return;
              }

              const submissionId = String(rawId).startsWith('rev-') ? rawId : `rev-${rawId}`;
              const prodName = productNames[rev.product_id] || `Product #${rev.product_id}`;
              const comment = String(rev.comment || '').trim();

              // Infer category if comment contains tags
              let category = 'product_quality';
              const lowerComment = comment.toLowerCase();
              if (lowerComment.includes('fast delivery') || lowerComment.includes('shipping') || lowerComment.includes('courier')) {
                category = 'delivery';
              } else if (lowerComment.includes('service') || lowerComment.includes('mechanic')) {
                category = 'service_quality';
              }

              if (!submissionsMap.has(submissionId)) {
                submissionsMap.set(submissionId, {
                  id: submissionId,
                  originalId: rev.review_id || rev.id,
                  submissionType: 'rating_review',
                  customerName: rev.customer_name || 'Rider',
                  customerEmail: null,
                  rating: Number(rev.rating || 5),
                  category,
                  message: comment || 'Verified purchase review',
                  transactionType: rev.order_id ? 'order' : 'product',
                  transactionId: rev.order_id || rev.product_id,
                  orderId: rev.order_id || null,
                  productId: rev.product_id,
                  transactionRef: rev.order_id ? `${prodName} (Order #${rev.order_id})` : prodName,
                  transactionStatus: 'Verified Purchase',
                  status: REPORT_STATUSES.NEW,
                  adminNotes: '',
                  reviewedBy: null,
                  reviewedAt: null,
                  dismissedReason: null,
                  createdAt: rev.created_at || new Date().toISOString(),
                  updatedAt: rev.created_at || new Date().toISOString(),
                  sourceTable: 'product_reviews',
                });
              }
            });
          }
        } catch (_re) {
          console.warn('RatingsReportsService product_reviews note:', _re);
        }

        // 4. Fetch orders with customer return requests or complaints from Supabase
        try {
          const { data: dbOrders, error: ordErr } = await client
            .from('orders')
            .select('order_id,customer_name,customer_email,status,grand_total,items_summary,return_status,return_reason,return_notes,return_requested_at,cancel_reason,created_at')
            .or('return_status.neq.none,cancel_reason.not.is.null')
            .limit(50);

          if (!ordErr && Array.isArray(dbOrders)) {
            dbOrders.forEach((o) => {
              if (o.return_status && o.return_status !== 'none' && o.return_reason) {
                const repId = `rep-ord-return-${o.order_id}`;
                if (!submissionsMap.has(repId)) {
                  submissionsMap.set(repId, {
                    id: repId,
                    submissionType: 'customer_report',
                    customerName: o.customer_name || 'Customer',
                    customerEmail: o.customer_email || null,
                    rating: null,
                    category: 'order_issues',
                    message: `Customer requested return/refund. Reason: ${o.return_reason}${o.return_notes ? ` | Notes: ${o.return_notes}` : ''}`,
                    transactionType: 'order',
                    transactionId: o.order_id,
                    transactionRef: o.items_summary || `Order #${o.order_id}`,
                    transactionStatus: o.status || 'Return Requested',
                    status: REPORT_STATUSES.NEW,
                    adminNotes: '',
                    reviewedBy: null,
                    reviewedAt: null,
                    dismissedReason: null,
                    createdAt: o.return_requested_at || o.created_at || new Date().toISOString(),
                    updatedAt: o.return_requested_at || o.created_at || new Date().toISOString(),
                    sourceTable: 'orders',
                  });
                }
              }
            });
          }
        } catch (_oe) {}
      }

      // Apply admin status overlay from persistent map
      const mergedList = Array.from(submissionsMap.values()).map((sub) => {
        const overlay = statusMap[sub.id];
        if (overlay) {
          return {
            ...sub,
            status: overlay.status || sub.status,
            adminNotes: overlay.adminNotes !== undefined ? overlay.adminNotes : sub.adminNotes,
            reviewedBy: overlay.reviewedBy !== undefined ? overlay.reviewedBy : sub.reviewedBy,
            reviewedAt: overlay.reviewedAt !== undefined ? overlay.reviewedAt : sub.reviewedAt,
            dismissedReason: overlay.dismissedReason !== undefined ? overlay.dismissedReason : sub.dismissedReason,
            updatedAt: overlay.updatedAt || sub.updatedAt,
          };
        }
        return sub;
      });

      // Sort newest first by default
      mergedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Save silent local cache
      this.saveLocalSubmissions(mergedList, { silent: true });
      this.cache.set(cacheKey, { at: Date.now(), data: mergedList });
      return mergedList;
    })();

    this.inflight.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  /**
   * Filter, search, and paginate submissions.
   */
  async getSubmissions({
    filterType = 'all', // 'all' | 'rating_review' | 'customer_report'
    statusFilter = 'all', // 'all' | 'New' | 'Under Review' | 'Resolved' | 'Dismissed'
    searchQuery = '',
    categoryFilter = 'all',
    dateRange = 'all', // 'all' | 'today' | '7days' | '30days'
    sortBy = 'newest', // 'newest' | 'oldest' | 'rating_high' | 'rating_low'
    page = 1,
    limit = 10,
    force = false,
  } = {}) {
    const all = await this.getAllSubmissions({ force });
    const now = Date.now();

    const filtered = all.filter((item) => {
      // 1. Filter by submission type
      if (filterType !== 'all') {
        if (filterType === 'rating_review' && item.submissionType !== 'rating_review') return false;
        if (filterType === 'customer_report' && item.submissionType !== 'customer_report') return false;
      }

      // 2. Filter by review status
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // 3. Filter by category
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // 4. Date range filter
      if (dateRange !== 'all') {
        const itemTime = new Date(item.createdAt).getTime();
        const diffMs = now - itemTime;
        if (dateRange === 'today' && diffMs > 24 * 60 * 60 * 1000) return false;
        if (dateRange === '7days' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === '30days' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      // 5. Search query matching
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (item.customerName || '').toLowerCase().includes(q);
        const emailMatch = (item.customerEmail || '').toLowerCase().includes(q);
        const catMatch = (item.category || '').toLowerCase().includes(q);
        const catLabelMatch = (REPORT_CATEGORIES[item.category?.toUpperCase()]?.label || '').toLowerCase().includes(q);
        const msgMatch = (item.message || '').toLowerCase().includes(q);
        const txMatch = (item.transactionId || '').toLowerCase().includes(q);
        const refMatch = (item.transactionRef || '').toLowerCase().includes(q);

        if (!nameMatch && !emailMatch && !catMatch && !catLabelMatch && !msgMatch && !txMatch && !refMatch) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'rating_high') {
        const rA = a.rating != null ? Number(a.rating) : -1;
        const rB = b.rating != null ? Number(b.rating) : -1;
        return rB - rA;
      }
      if (sortBy === 'rating_low') {
        const rA = a.rating != null ? Number(a.rating) : 999;
        const rB = b.rating != null ? Number(b.rating) : 999;
        return rA - rB;
      }
      // default: newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const safePage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (safePage - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      totalCount,
      totalPages,
      currentPage: safePage,
      limit,
    };
  }

  /**
   * Get KPI summary overview statistics.
   */
  async getOverviewStats({ force = false } = {}) {
    const all = await this.getAllSubmissions({ force });

    let totalRatings = 0;
    let sumRating = 0;
    let ratingCount = 0;
    let newCount = 0;
    let underReviewCount = 0;
    let resolvedCount = 0;
    let dismissedCount = 0;
    let reportsCount = 0;

    all.forEach((item) => {
      if (item.submissionType === 'rating_review') {
        totalRatings++;
      } else {
        reportsCount++;
      }

      if (item.rating != null && !isNaN(Number(item.rating)) && Number(item.rating) > 0) {
        sumRating += Number(item.rating);
        ratingCount++;
      }

      if (item.status === REPORT_STATUSES.NEW) newCount++;
      else if (item.status === REPORT_STATUSES.UNDER_REVIEW) underReviewCount++;
      else if (item.status === REPORT_STATUSES.RESOLVED) resolvedCount++;
      else if (item.status === REPORT_STATUSES.DISMISSED) dismissedCount++;
    });

    const avgRating = ratingCount > 0 ? Number((sumRating / ratingCount).toFixed(1)) : 0;
    const actionRequiredCount = newCount + underReviewCount;
    const resolvedRate = all.length > 0 ? Math.round((resolvedCount / all.length) * 100) : 0;

    // Detect actual unresolved urgent customer report if one genuinely exists in real data
    const urgentReport =
      all.find(
        (item) =>
          item.submissionType === 'customer_report' &&
          item.status === REPORT_STATUSES.NEW &&
          (item.isUrgent || item.category === 'order_issues' || item.category === 'product_quality')
      ) ||
      all.find(
        (item) => item.submissionType === 'customer_report' && item.status === REPORT_STATUSES.NEW
      ) ||
      null;

    const dueTodayCount = all.filter(
      (item) =>
        (item.dueToday || item.isUrgent) &&
        item.status !== REPORT_STATUSES.RESOLVED &&
        item.status !== REPORT_STATUSES.DISMISSED
    ).length;

    return {
      total: all.length,
      totalRatings,
      reportsCount,
      averageRating: avgRating,
      ratingCount,
      actionRequiredCount,
      dueTodayCount,
      resolvedCount,
      resolvedRate,
      urgentReport,
      urgentNeedsResponse: Boolean(urgentReport),
      newCount,
      underReviewCount,
      dismissedCount,
    };
  }

  /**
   * Update report or review status and internal admin notes.
   */
  async updateSubmissionStatus(id, { status, adminNotes, dismissedReason = null, adminName = 'Admin' } = {}) {
    if (!id) return { success: false, error: 'Submission ID is required' };

    const statusMap = this.getAdminStatusMap();
    const nowIso = new Date().toISOString();

    const updatedOverlay = {
      ...(statusMap[id] || {}),
      status: status || statusMap[id]?.status || REPORT_STATUSES.UNDER_REVIEW,
      adminNotes: adminNotes !== undefined ? adminNotes : (statusMap[id]?.adminNotes || ''),
      dismissedReason: status === REPORT_STATUSES.DISMISSED ? dismissedReason : null,
      reviewedBy: adminName,
      reviewedAt: nowIso,
      updatedAt: nowIso,
    };

    statusMap[id] = updatedOverlay;
    this.saveAdminStatusMap(statusMap);

    // Sync to Supabase `customer_ratings_reports` if the row exists there
    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('customer_ratings_reports')
          .update({
            status: updatedOverlay.status,
            admin_notes: updatedOverlay.adminNotes,
            dismissed_reason: updatedOverlay.dismissedReason,
            reviewed_by: updatedOverlay.reviewedBy,
            reviewed_at: updatedOverlay.reviewedAt,
            updated_at: nowIso,
          })
          .eq('id', id);
      } catch (_e) {
        // Table may not yet be present; local overlay guarantees consistency
      }
    }

    // Invalidate local memory cache and notify subscribers
    this.cache.delete('all_submissions');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mototrack_ratings_reports_ping', String(Date.now()));
      } catch (_e) {}
    }
    this.notify({ type: 'STATUS_UPDATE', id, updated: updatedOverlay });

    return {
      success: true,
      updated: updatedOverlay,
    };
  }

  /**
   * Submit a new Customer Report (complaint, issue, feedback).
   */
  async submitCustomerReport({
    customerName = 'Rider',
    customerEmail = null,
    customerId = null,
    rating = null,
    category = 'general_feedback',
    message = '',
    transactionType = 'general',
    transactionId = null,
    transactionStatus = null,
    transactionDetails = {},
  } = {}) {
    if (!message || !message.trim()) {
      return { success: false, error: 'A written message is required' };
    }

    const reportId = `rep-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    const newSubmission = {
      id: reportId,
      submissionType: 'customer_report',
      customerName: String(customerName || 'Rider').trim(),
      customerEmail: customerEmail ? String(customerEmail).trim() : null,
      customerId: customerId || null,
      rating: rating != null && !isNaN(Number(rating)) ? Number(rating) : null,
      category: category || 'general_feedback',
      message: String(message).trim(),
      transactionType: transactionType || 'general',
      transactionId: transactionId || null,
      transactionStatus: transactionStatus || null,
      transactionRef: transactionDetails?.ref_title || transactionId || '',
      status: REPORT_STATUSES.NEW,
      adminNotes: '',
      reviewedBy: null,
      reviewedAt: null,
      dismissedReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Save to Supabase `customer_ratings_reports` if accessible
    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('customer_ratings_reports').insert([
          {
            id: newSubmission.id,
            submission_type: newSubmission.submissionType,
            customer_name: newSubmission.customerName,
            customer_email: newSubmission.customerEmail,
            customer_id: newSubmission.customerId,
            rating: newSubmission.rating,
            category: newSubmission.category,
            message: newSubmission.message,
            transaction_type: newSubmission.transactionType,
            transaction_id: newSubmission.transactionId,
            transaction_status: newSubmission.transactionStatus,
            transaction_details: transactionDetails,
            status: newSubmission.status,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ]);
      } catch (e) {
        console.warn('Supabase customer report insert note:', e);
      }
    }

    // 2. Save into local persistent list
    const currentList = this.getLocalSubmissions();
    const updatedList = [newSubmission, ...currentList.filter((x) => x.id !== newSubmission.id)];
    this.saveLocalSubmissions(updatedList.slice(0, 300), { silent: true });

    // 3. Clear memory cache
    this.cache.delete('all_submissions');

    // 4. Notify admin immediately in-app and across windows
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mototrack_ratings_reports_ping', String(Date.now()));
        window.dispatchEvent(new CustomEvent('mototrack:new_customer_report', { detail: newSubmission }));
      } catch (_e) {}
    }
    this.notify({ type: 'NEW_REPORT', report: newSubmission });

    // 5. Create in-app system notification for admins
    try {
      await notificationService.createNotification({
        title: 'New Customer Report Submitted',
        message: `${newSubmission.customerName} submitted a ${REPORT_CATEGORIES[newSubmission.category.toUpperCase()]?.label || newSubmission.category} report: "${newSubmission.message.slice(0, 80)}..."`,
        type: 'alert',
        recipientRole: 'admin',
        referenceId: newSubmission.id,
      });
    } catch (_ne) {}

    return {
      success: true,
      report: newSubmission,
    };
  }
}

export const ratingsReportsService = new RatingsReportsService();
export default ratingsReportsService;
