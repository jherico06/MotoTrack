const fs = require('fs');
const path = require('path');

const TABLES = [
  'users',
  'customers',
  'addresses',
  'notifications',
  'suppliers',
  'categories',
  'products',
  'inventory',
  'discounts',
  'promos',
  'orders',
  'order_items',
  'payments',
  'sales',
  'sale_items',
  'carts',
  'cart_items',
  'services',
  'bookings',
  'purchase_orders',
  'purchase_items',
  'backups',
  'system_settings',
  'otp_verifications',
  'admin_pins',
  'order_notes',
  'account_logs',
  'customer_motorcycles',
  'mechanics',
  'order_deliveries',
  'delivery_history',
  'riders',
  'rider_earnings',
  'rider_access_tokens',
  'service_history',
  'forecast_history',
  'product_cost_history',
  'service_cost_records',
  'financial_expenses',
  'product_reviews',
  'product_compatibility',
  'customizations',
  'customization_items',
  'service_quotations',
  'service_quotation_items',
  'booking_inspections',
  'booking_additional_charges',
  'booking_status_history',
  'pickup_verifications',
  'motorcycle_models',
  'inventory_transactions',
  'stock_reservations',
  'delivery_locations',
  'promo_products',
  'ai_generation_usage',
  'ai_generation_history',
  'admin_sessions',
  'cc_categories',
  'pms_services',
  'pms_service_prices',
  'booking_service_items',
  'wishlist_items'
];

function getAllFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx', '.sql', '.json']) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (['node_modules', '.git', 'dist', '.expo', '.temp'].includes(file)) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath, exts));
      } else {
        if (exts.some(ext => file.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {}
  return results;
}

const rootDir = path.resolve(__dirname, '..');
const srcFiles = getAllFiles(path.join(rootDir, 'src'));
const supabaseFiles = getAllFiles(path.join(rootDir, 'supabase'));
const serverFiles = getAllFiles(path.join(rootDir, 'server'));

const allCodeFiles = [...srcFiles, ...serverFiles];
const allMigrationFiles = supabaseFiles.filter(f => f.includes('migrations'));

const auditResults = {};

for (const table of TABLES) {
  auditResults[table] = {
    codeReferences: [],
    migrationReferences: [],
    fromCalls: [],
  };
}

for (const file of allCodeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
  
  for (const table of TABLES) {
    // check from('table') or from("table")
    const fromRegex = new RegExp(`from\\(['"\`]${table}['"\`]\\)`, 'g');
    if (fromRegex.test(content)) {
      auditResults[table].fromCalls.push(relPath);
    }
    
    // check general word match
    const wordRegex = new RegExp(`\\b${table}\\b`, 'g');
    if (wordRegex.test(content)) {
      auditResults[table].codeReferences.push(relPath);
    }
  }
}

for (const file of allMigrationFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
  for (const table of TABLES) {
    const wordRegex = new RegExp(`\\b${table}\\b`, 'g');
    if (wordRegex.test(content)) {
      auditResults[table].migrationReferences.push(relPath);
    }
  }
}

fs.writeFileSync(path.join(__dirname, 'audit_summary.json'), JSON.stringify(auditResults, null, 2));
console.log('Done auditing 62 tables.');
