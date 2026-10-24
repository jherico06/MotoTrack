import { appStorage, storageAdapter } from './storageAdapter.js';
import { supabaseManager } from '../../lib/supabase.js';

const STORAGE_KEY_AUDIT_LOGS = '@mototrack_admin_audit_logs';

/**
 * Admin activity log. Records come from public.account_logs and actions
 * taken in this session. Previously shipped sample rows are discarded.
 */
const SEED_AUDIT_ID_PREFIX = 'audit-1726058912345-';

function isSeedAuditLog(log) {
  return String(log?.id || '').startsWith(SEED_AUDIT_ID_PREFIX);
}

function readSessionOperator() {
  try {
    const raw = appStorage.getItem('mototrack_current_session');
    const user = raw ? JSON.parse(raw) : null;
    if (!user) return { id: null, name: 'Staff', role: 'staff' };
    return {
      id: user.id || user.user_id || null,
      name: user.name || user.fullName || 'Staff',
      role: user.role || 'staff',
    };
  } catch (_e) {
    return { id: null, name: 'Staff', role: 'staff' };
  }
}

function mapAccountLog(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: row.log_id || meta.audit_id,
    timestamp: row.created_at,
    admin_name: meta.admin_name || 'Staff',
    admin_role: meta.admin_role || 'staff',
    action: row.action || 'ACCOUNT_ACTIVITY',
    category: meta.category || 'system',
    target: meta.target || row.action || 'Account',
    severity: meta.severity || 'INFO',
    details: row.description || '',
    metadata: meta,
    ip_address: row.ip_address || '',
    client: row.user_agent || '',
    user_id: row.user_id || null,
  };
}

class AuditLogService {
  constructor() {
    this.logs = [];
    this.subscribers = new Set();
    this.initialized = false;
    this._refreshInflight = null;
    this.init();
  }

  async init() {
    try {
      const stored = await storageAdapter.getItem(STORAGE_KEY_AUDIT_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.logs = Array.isArray(parsed) ? parsed.filter((row) => row && !isSeedAuditLog(row)) : [];
      } else {
        this.logs = [];
      }
    } catch (_e) {
      this.logs = [];
    }
    this.initialized = true;
    this.notify();
    this.refreshFromDatabase().catch(() => {});
  }

  async refreshFromDatabase() {
    if (this._refreshInflight) return this._refreshInflight;
    this._refreshInflight = (async () => {
      try {
        const client = supabaseManager.getClient();
        if (!client) return this.logs;
        const { data, error } = await client
          .from('account_logs')
          .select('log_id,user_id,action,description,metadata,ip_address,user_agent,created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error || !Array.isArray(data)) return this.logs;

        const merged = new Map();
        data.map(mapAccountLog).forEach((row) => {
          if (row?.id && !isSeedAuditLog(row)) merged.set(row.id, row);
        });
        this.logs.forEach((local) => {
          if (local?.id && !isSeedAuditLog(local) && !merged.has(local.id)) {
            merged.set(local.id, local);
          }
        });
        this.logs = Array.from(merged.values())
          .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
          .slice(0, 250);
        await this.persist();
        this.notify();
        return this.logs;
      } finally {
        this._refreshInflight = null;
      }
    })();
    return this._refreshInflight;
  }

  async persist() {
    try {
      // Keep up to 250 recent audit logs
      const trimmed = this.logs.filter((row) => row && !isSeedAuditLog(row)).slice(0, 250);
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
    adminName,
    adminRole,
    metadata = {},
  }) {
    const operator = readSessionOperator();
    const entry = {
      id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      admin_name: adminName || operator.name,
      admin_role: adminRole || operator.role,
      action: action.toUpperCase().replace(/\s+/g, '_'),
      category: category.toLowerCase(),
      target: String(target || 'System Resource'),
      severity: severity.toUpperCase(),
      details: String(details || ''),
      metadata: metadata || {},
      ip_address: '',
      client: typeof navigator !== 'undefined' ? navigator.userAgent || 'Browser' : 'MotoTrack Admin Hub',
      user_id: operator.id,
    };

    this.logs = [entry, ...this.logs.filter((row) => !isSeedAuditLog(row))].slice(0, 250);
    await this.persist();
    this.notify();

    try {
      const client = supabaseManager.getClient();
      if (client && operator.id) {
        await client.from('account_logs').insert([
          {
            user_id: operator.id,
            action: entry.action,
            description: entry.details || entry.target,
            metadata: {
              ...(entry.metadata || {}),
              audit_id: entry.id,
              category: entry.category,
              target: entry.target,
              severity: entry.severity,
              admin_name: entry.admin_name,
              admin_role: entry.admin_role,
            },
            user_agent: entry.client,
          },
        ]);
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
      `"${l.ip_address || ''}"`,
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
