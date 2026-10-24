const fs = require('fs');
const path = require('path');

const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit_summary.json'), 'utf8'));

console.log('--- TABLES WITH 0 from() CALLS ---');
for (const [table, data] of Object.entries(summary)) {
  if (data.fromCalls.length === 0) {
    console.log(`Table: ${table} | Code refs: ${data.codeReferences.length} | Migrations: ${data.migrationReferences.length}`);
  }
}

console.log('\n--- TABLES WITH from() CALLS ---');
for (const [table, data] of Object.entries(summary)) {
  if (data.fromCalls.length > 0) {
    console.log(`Table: ${table} | from() calls: ${data.fromCalls.length} files`);
  }
}
