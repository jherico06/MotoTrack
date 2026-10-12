import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const ASSET_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ttf', '.otf']);
const CODE_EXTS = ['.js', '.jsx', '.mjs', '.web.js', '.web.jsx', '.android.js', '.android.jsx', '.ios.js', '.ios.jsx', '.native.js', '.native.jsx'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveSpec(importer, spec) {
  const base = path.resolve(path.dirname(importer), spec);
  const ext = path.extname(spec);
  if (ASSET_EXTS.has(ext)) return fs.existsSync(base);
  if (['.js', '.jsx', '.mjs'].includes(ext)) return fs.existsSync(base);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  for (const candidate of CODE_EXTS) {
    if (fs.existsSync(base + candidate)) return true;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    return ['index.js', 'index.jsx', 'index.web.js', 'index.web.jsx'].some((name) =>
      fs.existsSync(path.join(base, name))
    );
  }
  return false;
}

const specRe = /(?:from|import|require\()\s*['"](\.[^'"]+)['"]/g;
const missing = [];
for (const file of walk(src)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(specRe)) {
    const spec = match[1];
    if (!resolveSpec(file, spec)) {
      missing.push(`${path.relative(root, file)} -> ${spec}`);
    }
  }
}

if (missing.length) {
  console.log(`Missing ${missing.length} imports:`);
  for (const line of missing) console.log('  ' + line);
  process.exit(1);
}
console.log('All relative imports in src resolve.');
