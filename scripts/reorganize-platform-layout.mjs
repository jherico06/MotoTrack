/**
 * One-shot move of MotoTrack screens and services into platform/role folders.
 * Rewrites relative imports so existing modules keep resolving.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');

if (!fs.existsSync(path.join(src, 'pages', 'ShopPage.jsx'))) {
  console.log('Screens are already organized. This script does not need to run again.');
  process.exit(0);
}

const moves = {
  'pages/ShopPage.web.jsx': 'screens/web/customer/ShopPage.jsx',
  'pages/ShopPage.jsx': 'screens/mobile/customer/ShopPage.jsx',
  'pages/LoginPage.web.jsx': 'screens/web/auth/LoginPage.jsx',
  'pages/LoginPage.jsx': 'screens/mobile/auth/LoginPage.jsx',
  'pages/SignUpPage.web.jsx': 'screens/web/auth/SignUpPage.jsx',
  'pages/SignUpPage.jsx': 'screens/mobile/auth/SignUpPage.jsx',
  'pages/OrderPage.web.jsx': 'screens/web/customer/OrderPage.jsx',
  'pages/OrderPage.jsx': 'screens/mobile/customer/OrderPage.jsx',
  'pages/GaragePage.web.jsx': 'screens/web/customer/GaragePage.jsx',
  'pages/GaragePage.jsx': 'screens/mobile/customer/GaragePage.jsx',
  'pages/WishlistPage.web.jsx': 'screens/web/customer/WishlistPage.jsx',
  'pages/WishlistPage.jsx': 'screens/mobile/customer/WishlistPage.jsx',
  'pages/CustomizerPage.web.jsx': 'screens/web/customer/CustomizerPage.jsx',
  'pages/CustomizerPage.jsx': 'screens/mobile/customer/CustomizerPage.jsx',
  'pages/ProfilePage.web.jsx': 'screens/web/customer/ProfilePage.jsx',
  'pages/ProfilePage.jsx': 'screens/mobile/customer/ProfilePage.jsx',
  'pages/NotificationsPage.web.jsx': 'screens/web/customer/NotificationsPage.jsx',
  'pages/NotificationsPage.jsx': 'screens/mobile/customer/NotificationsPage.jsx',
  'pages/AdminDashboard.web.jsx': 'screens/web/admin/AdminDashboard.jsx',
  'pages/AdminDashboard.jsx': 'screens/mobile/admin/AdminDashboard.jsx',
  'pages/RiderDashboard.jsx': 'screens/mobile/rider/RiderDashboard.jsx',
  'pages/MechanicDashboard.jsx': 'screens/mobile/mechanic/MechanicDashboard.jsx',
  'pages/RiderRunPage.jsx': 'screens/mobile/rider/RiderRunPage.jsx',
  'pages/DeliveryConfirmPage.jsx': 'screens/shared/delivery/DeliveryConfirmPage.jsx',
  'pages/ProductDetailsPage.jsx': 'screens/shared/customer/ProductDetailsPage.jsx',
  'pages/StaffVerifyEmailPage.jsx': 'screens/shared/auth/StaffVerifyEmailPage.jsx',
  'pages/ForceChangePasswordPage.jsx': 'screens/shared/auth/ForceChangePasswordPage.jsx',

  'services/authService.js': 'services/auth/authService.js',
  'services/adminSecurityService.js': 'services/auth/adminSecurityService.js',
  'services/productService.js': 'services/products/productService.js',
  'services/compatibilityService.js': 'services/products/compatibilityService.js',
  'services/motorcycleService.js': 'services/products/motorcycleService.js',
  'services/promoService.js': 'services/products/promoService.js',
  'services/wishlistService.js': 'services/products/wishlistService.js',
  'services/orderService.js': 'services/orders/orderService.js',
  'services/reservationService.js': 'services/orders/reservationService.js',
  'services/gcashPaymentService.js': 'services/orders/gcashPaymentService.js',
  'services/garageService.js': 'services/bookings/garageService.js',
  'services/mechanicBookingService.js': 'services/bookings/mechanicBookingService.js',
  'services/bookingTimelineService.js': 'services/bookings/bookingTimelineService.js',
  'services/serviceQuotationService.js': 'services/bookings/serviceQuotationService.js',
  'services/customizationService.js': 'services/bookings/customizationService.js',
  'services/supplierService.js': 'services/inventory/supplierService.js',
  'services/forecastService.js': 'services/inventory/forecastService.js',
  'services/excelService.js': 'services/inventory/excelService.js',
  'services/deliveryService.js': 'services/delivery/deliveryService.js',
  'services/deliveryLocationService.js': 'services/delivery/deliveryLocationService.js',
  'services/riderGpsTrackingService.js': 'services/delivery/riderGpsTrackingService.js',
  'services/riderAccessService.js': 'services/delivery/riderAccessService.js',
  'services/riderService.js': 'services/staff/riderService.js',
  'services/staffAccountApi.js': 'services/staff/staffAccountApi.js',
  'services/userService.js': 'services/staff/userService.js',
  'services/notificationService.js': 'services/notifications/notificationService.js',
  'services/emailService.js': 'services/notifications/emailService.js',
  'services/aiCustomizerService.js': 'services/ai/aiCustomizerService.js',
  'services/aiCustomizeApi.js': 'services/ai/aiCustomizeApi.js',
  'services/geminiService.js': 'services/ai/geminiService.js',
  'services/systemSettingsService.js': 'services/system/systemSettingsService.js',
  'services/auditLogService.js': 'services/system/auditLogService.js',
  'services/databaseService.js': 'services/system/databaseService.js',
  'services/storageAdapter.js': 'services/system/storageAdapter.js',
  'services/supabaseClient.js': 'lib/supabase.js',

  'components/shop/MobileHeader.jsx': 'components/mobile/customer/MobileHeader.jsx',
};

function absFromSrc(rel) {
  return path.normalize(path.join(src, rel));
}

const moveMap = new Map();
for (const [fromRel, toRel] of Object.entries(moves)) {
  const from = absFromSrc(fromRel);
  const to = absFromSrc(toRel);
  if (!fs.existsSync(from)) {
    console.error('Missing source:', fromRel);
    process.exitCode = 1;
    continue;
  }
  moveMap.set(from, to);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.expo') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function preferWeb(filePath) {
  const base = path.basename(filePath);
  return base.includes('.web.');
}

const EXPLICIT_EXTS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

function resolveSpecifier(importer, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.normalize(path.resolve(path.dirname(importer), spec));
  const web = preferWeb(importer);
  const exts = web
    ? ['.web.jsx', '.web.js', '.jsx', '.js', '.mjs']
    : ['.jsx', '.js', '.mjs', '.android.jsx', '.ios.jsx', '.native.jsx'];

  if (EXPLICIT_EXTS.has(path.extname(spec))) {
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    return null;
  }

  for (const ext of exts) {
    const file = base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  const indexNames = web
    ? ['index.web.js', 'index.web.jsx', 'index.js', 'index.jsx']
    : ['index.js', 'index.jsx', 'index.web.js', 'index.web.jsx'];
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const name of indexNames) {
      const file = path.join(base, name);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

function finalPath(absFile) {
  return moveMap.get(path.normalize(absFile)) || path.normalize(absFile);
}

function toSpecifier(fromFile, targetFile, originalSpec) {
  const indexNames = new Set(['index.js', 'index.jsx', 'index.web.js', 'index.web.jsx']);
  const originalBase = path.posix.basename(originalSpec.replace(/\\/g, '/'));
  const targetBase = path.basename(targetFile);
  let pointed = targetFile;
  if (indexNames.has(targetBase) && !originalBase.startsWith('index')) {
    pointed = path.dirname(targetFile);
  }
  let rel = path.relative(path.dirname(fromFile), pointed).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const origHasExt = EXPLICIT_EXTS.has(path.posix.extname(originalSpec));
  if (origHasExt && path.extname(pointed)) {
    if (!rel.endsWith(path.extname(pointed))) rel += path.extname(pointed);
  }
  return rel;
}

const specRe =
  /((?:from|import|export)\s*\(?\s*|require\(\s*|import\(\s*)(['"])(\.[^'"]+)\2/g;

function rewrite(content, oldFile, newFile) {
  const warnings = [];
  const next = content.replace(specRe, (full, prefix, quote, spec) => {
    const resolved = resolveSpecifier(oldFile, spec);
    if (!resolved) {
      warnings.push(`${path.relative(root, oldFile)} -> ${spec}`);
      return full;
    }
    const dest = finalPath(resolved);
    const nextSpec = toSpecifier(newFile, dest, spec);
    if (nextSpec === spec) return full;
    return `${prefix}${quote}${nextSpec}${quote}`;
  });
  return { next, warnings };
}

const files = [...walk(src), ...walk(path.join(root, 'scripts'))];
const originals = new Map();
for (const file of files) {
  originals.set(path.normalize(file), fs.readFileSync(file, 'utf8'));
}

const warnings = [];
const writes = [];
for (const [oldFile, content] of originals) {
  if (!oldFile.startsWith(src) && !oldFile.startsWith(path.join(root, 'scripts'))) continue;
  const newFile = finalPath(oldFile);
  const { next, warnings: fileWarnings } = rewrite(content, oldFile, newFile);
  warnings.push(...fileWarnings);
  writes.push({ oldFile, newFile, next, changed: next !== content || newFile !== oldFile });
}

for (const job of writes) {
  if (!job.changed) continue;
  fs.mkdirSync(path.dirname(job.newFile), { recursive: true });
  fs.writeFileSync(job.newFile, job.next);
}

for (const [from, to] of moveMap) {
  if (from !== to && fs.existsSync(from)) fs.unlinkSync(from);
}

console.log(`Moved ${moveMap.size} files.`);
console.log(`Rewrote ${writes.filter((w) => w.changed).length} files.`);
if (warnings.length) {
  console.log('Unresolved relative imports:');
  for (const line of warnings) console.log('  ' + line);
}
