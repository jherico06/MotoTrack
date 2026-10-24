const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env for SUPABASE credentials if present
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL\s*=\s*(.+)/);
const keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Supabase credentials not found in .env');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportTables() {
  const tables = [
    'discounts',
    'promos',
    'sales',
    'sale_items',
    'services',
    'product_cost_history',
    'service_cost_records',
    'service_history',
    'backups',
    'carts',
    'cart_items'
  ];

  const backupData = {
    exported_at: new Date().toISOString(),
    tables: {}
  };

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`Error exporting ${table}:`, error.message);
      backupData.tables[table] = { error: error.message };
    } else {
      backupData.tables[table] = {
        rowCount: data.length,
        rows: data
      };
      console.log(`Exported ${table}: ${data.length} rows`);
    }
  }

  const outPath = path.join(__dirname, 'pre_migration_table_backup.json');
  fs.writeFileSync(outPath, JSON.stringify(backupData, null, 2));
  console.log(`Saved backup to ${outPath}`);
}

exportTables();
