import { storageAdapter } from './storageAdapter.js';
import { supabaseManager } from './supabaseClient.js';

const STORAGE_KEY_AUDIT_LOGS = '@mototrack_admin_audit_logs';

/**
 * Pre-seeded realistic audit logs covering recent administrative operations
 */
const INITIAL_AUDIT_LOGS = [
  {
    id: 'audit-1726058912345-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'ORDER_APPROVED',
    category: 'orders',
    target: 'Order #MT-ORD-9412',
    severity: 'SUCCESS',
    details: 'Verified and approved Cash on Delivery (COD) checkout for customer Carlos Mendoza (₱68,500). Ready for warehouse packing.',
    metadata: {
      orderId: 'MT-ORD-9412',
      customer: 'Carlos Mendoza',
      amount: 68500,
      previous_status: 'Pending Approval',
      new_status: 'Processing',
      payment_method: 'COD (Verified)',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'STOCK_REPLENISHED',
    category: 'inventory',
    target: 'Brembo RCS 19 Corsa Corta (prod-02)',
    severity: 'INFO',
    details: 'Replenished warehouse inventory: added +15 units from Supplier Brembo Official PH. Warehouse physical count confirmed.',
    metadata: {
      productId: 'prod-02',
      productName: 'Brembo RCS 19 Corsa Corta',
      old_stock: 2,
      new_stock: 17,
      added_quantity: 15,
      cost_basis: '₱14,200/unit',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'BOOKING_STATUS_CHANGED',
    category: 'garage',
    target: 'Booking #BK-REP-4921',
    severity: 'SUCCESS',
    details: 'Assigned Pit Bay 1 to Booking #BK-REP-4921 (Yamaha NMAX 155) under Master Tech Jayson. Job ticket printed.',
    metadata: {
      bookingId: 'BK-REP-4921',
      customer: 'Maria Santos',
      assigned_bay: 'Pit Bay 1',
      assigned_mechanic: 'Master Tech Jayson',
      service: 'Pro Performance 20-Point PMS',
      stage: 'In Progress (Bay 1 Active)',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'SECURITY_PIN_VERIFIED',
    category: 'security',
    target: 'Admin Security Master Lock',
    severity: 'WARNING',
    details: 'Admin PIN lock passed and authorized for high-privilege configuration and database backup inspection.',
    metadata: {
      auth_mechanism: 'PIN_AUTH',
      session_duration: '4 Hours',
      privilege_level: 'SUPERADMIN_ALL',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-005',
    timestamp: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'PROMO_CREATED',
    category: 'promos',
    target: 'Promo Code: TRACKDAY25',
    severity: 'INFO',
    details: 'Published promotional discount coupon: TRACKDAY25 (25% off storewide on exhaust & brake components).',
    metadata: {
      code: 'TRACKDAY25',
      discount_percentage: 25,
      min_spend: 5000,
      active: true,
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-006',
    timestamp: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'ORDER_STATUS_CHANGED',
    category: 'orders',
    target: 'Order #MT-ORD-8821',
    severity: 'INFO',
    details: 'Updated logistics tracking status: Handed over to MotoTrack Express Courier Rider Jherico. Live tracking activated.',
    metadata: {
      orderId: 'MT-ORD-8821',
      courier: 'MotoTrack Express Courier',
      tracking_number: 'MOTO-TRK-882190',
      previous_status: 'Processing',
      new_status: 'Out for Delivery',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-007',
    timestamp: new Date(Date.now() - 1000 * 60 * 280).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'SYSTEM_SETTINGS_UPDATED',
    category: 'system',
    target: 'Store Identity & Operations Settings',
    severity: 'INFO',
    details: 'Updated maximum COD threshold to ₱85,000 and enabled real-time SMS staff dispatch alerts.',
    metadata: {
      max_cod_amount: 85000,
      dispatch_alerts: true,
      operating_hours: '08:00 AM - 07:00 PM',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-008',
    timestamp: new Date(Date.now() - 1000 * 60 * 380).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'SUPPLIER_PO_SIGNED',
    category: 'inventory',
    target: 'Purchase Order #PO-2026-089',
    severity: 'SUCCESS',
    details: 'Signed off and approved Purchase Order #PO-2026-089 (Öhlins Suspensions Batch - ₱245,000) for distributor shipment.',
    metadata: {
      poNumber: 'PO-2026-089',
      supplier: 'Öhlins Official PH',
      total_cost: 245000,
      item_count: 8,
      status: 'Approved & Transmitted',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-009',
    timestamp: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'DATABASE_BACKUP_EXPORTED',
    category: 'system',
    target: 'Full Database Snapshot',
    severity: 'INFO',
    details: 'Generated and encrypted complete JSON database export covering 1,429 customers, 82 products, and order histories.',
    metadata: {
      export_size: '3.42 MB',
      tables: ['products', 'orders', 'bookings', 'users', 'suppliers'],
      compression: 'AES-256 GZIP',
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
  {
    id: 'audit-1726058912345-010',
    timestamp: new Date(Date.now() - 1000 * 60 * 620).toISOString(),
    admin_name: 'Master Admin (Jherico)',
    admin_role: 'Superadmin',
    action: 'USER_PERMISSIONS_MODIFIED',
    category: 'users',
    target: 'Staff Account: tech_carlos@mototrack.ph',
    severity: 'WARNING',
    details: 'Promoted Carlos Mendoza from Junior Mechanic to Lead Pit Technician with bay assignment authorization.',
    metadata: {
      user_email: 'tech_carlos@mototrack.ph',
      previous_role: 'Mechanic',
      new_role: 'Lead Pit Technician',
      granted_privileges: ['MANAGE_BAYS', 'CLOSE_WORK_ORDERS'],
    },
    ip_address: '192.168.1.104',
    client: 'Chrome 128 (Windows Desktop)',
  },
];

class AuditLogService {
  constructor() {
    this.logs = [...INITIAL_AUDIT_LOGS];
    this.subscribers = new Set();
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      const stored = await storageAdapter.getItem(STORAGE_KEY_AUDIT_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.logs = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...INITIAL_AUDIT_LOGS];
      } else {
        this.logs = [...INITIAL_AUDIT_LOGS];
        await this.persist();
      }
    } catch (_e) {
      this.logs = [...INITIAL_AUDIT_LOGS];
    }
    this.initialized = true;
    this.notify();
  }

  async persist() {
    try {
      // Keep up to 250 recent audit logs
      const trimmed = this.logs.slice(0, 250);
      await storageAdapter.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(trimmed));
    } catch (_e) {}
  }

  notify() {
    this.subscribers.forEach((fn) => {
      try {
        fn(this.logs);
      } catch (_e) {}
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.logs);
    return () => this.subscribers.delete(callback);
  }

  getLogs() {
    return [...this.logs];
  }

  /**
   * Log an administrative event
   */
  async log({
    action = 'ADMIN_ACTION',
    category = 'system', // 'orders' | 'inventory' | 'garage' | 'users' | 'promos' | 'security' | 'system'
    target = 'System Entity',
    details = '',
    severity = 'INFO', // 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL'
    adminName = 'Master Admin (Jherico)',
    adminRole = 'Superadmin',
    metadata = {},
  }) {
    const entry = {
      id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      admin_name: adminName || 'Master Admin',
      admin_role: adminRole || 'Administrator',
      action: action.toUpperCase().replace(/\s+/g, '_'),
      category: category.toLowerCase(),
      target: String(target || 'System Resource'),
      severity: severity.toUpperCase(),
      details: String(details || ''),
      metadata: metadata || {},
      ip_address: '192.168.1.104',
      client: typeof navigator !== 'undefined' ? `${navigator.platform || 'Web'} (Browser)` : 'MotoTrack Admin Hub',
    };

    this.logs.unshift(entry);
    await this.persist();
    this.notify();

    // Optionally sync to Supabase table if available
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('admin_audit_logs').insert([
          {
            action: entry.action,
            category: entry.category,
            target: entry.target,
            details: entry.details,
            severity: entry.severity,
            admin_name: entry.admin_name,
            metadata: entry.metadata,
            ip_address: entry.ip_address,
          },
        ]).catch(() => {});
      }
    } catch (_syncErr) {}

    return entry;
  }

  // ─── DOMAIN CONVENIENCE HELPERS ───

  logOrderAction({ action, target, details, severity = 'INFO', metadata = {} }) {
    return this.log({ action, category: 'orders', target, details, severity, metadata });
  }

  logInventoryAction({ action, target, details, severity = 'INFO', metadata = {} }) {
    return this.log({ action, category: 'inventory', target, details, severity, metadata });
  }

  logGarageAction({ action, target, details, severity = 'INFO', metadata = {} }) {
    return this.log({ action, category: 'garage', target, details, severity, metadata });
  }

  logSecurityAction({ action, target, details, severity = 'WARNING', metadata = {} }) {
    return this.log({ action, category: 'security', target, details, severity, metadata });
  }

  logUserAction({ action, target, details, severity = 'INFO', metadata = {} }) {
    return this.log({ action, category: 'users', target, details, severity, metadata });
  }

  logPromoAction({ action, target, details, severity = 'INFO', metadata = {} }) {
    return this.log({ action, category: 'promos', target, details, severity, metadata });
  }

  logSystemAction({ action, target, details, severity = 'INFO', metadata = {} }) {
    return this.log({ action, category: 'system', target, details, severity, metadata });
  }

  /**
   * Export audit log records to CSV format
   */
  exportToCSV(logsToExport = null) {
    const list = logsToExport || this.logs;
    const headers = ['Log ID', 'Timestamp', 'Operator', 'Role', 'Category', 'Action', 'Target Resource', 'Severity', 'Details', 'IP Address'];
    
    const rows = list.map((l) => [
      `"${l.id}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.admin_name}"`,
      `"${l.admin_role || 'Admin'}"`,
      `"${l.category.toUpperCase()}"`,
      `"${l.action}"`,
      `"${(l.target || '').replace(/"/g, '""')}"`,
      `"${l.severity}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ip_address || '127.0.0.1'}"`,
    ]);

    const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `mototrack_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return csvString;
  }

  /**
   * Clear all audit logs
   */
  async clearLogs() {
    this.logs = [];
    await this.persist();
    this.notify();
    return this.logs;
  }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
