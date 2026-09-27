/**
 * One-off: move base64 images out of Postgres into Supabase Storage.
 * Cuts egress from repeated full-table pulls of multi-hundred-KB text blobs.
 *
 * Usage: node scripts/migrate-base64-images.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = 'product-images';

if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function guessExtAndMime(dataUri) {
  if (dataUri.startsWith('data:image/png')) return { ext: 'png', mime: 'image/png' };
  if (dataUri.startsWith('data:image/webp')) return { ext: 'webp', mime: 'image/webp' };
  if (dataUri.startsWith('data:image/gif')) return { ext: 'gif', mime: 'image/gif' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}

function dataUriToBuffer(dataUri) {
  const match = String(dataUri).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function uploadDataUri(dataUri, fileName) {
  const parsed = dataUriToBuffer(dataUri);
  if (!parsed) throw new Error('Invalid data URI');
  const { ext, mime } = guessExtAndMime(dataUri);
  const path = fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, parsed.buffer, {
    contentType: mime || parsed.mime,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function migrateProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('product_id, image')
    .like('image', 'data:%');
  if (error) throw error;
  console.log(`Products with data URIs: ${(data || []).length}`);
  for (const row of data || []) {
    try {
      const publicUrl = await uploadDataUri(
        row.image,
        `products/${row.product_id}-${Date.now()}`
      );
      const { error: upErr } = await supabase
        .from('products')
        .update({ image: publicUrl })
        .eq('product_id', row.product_id);
      if (upErr) throw upErr;
      console.log(`  ✓ product ${row.product_id} → ${publicUrl.slice(0, 80)}...`);
    } catch (e) {
      console.error(`  ✗ product ${row.product_id}:`, e.message || e);
    }
  }
}

async function migrateDeliveryProofs() {
  const { data, error } = await supabase
    .from('order_deliveries')
    .select('order_id, delivery_photo, proof_of_delivery');
  if (error) throw error;

  const rows = (data || []).filter(
    (r) =>
      String(r.delivery_photo || '').startsWith('data:') ||
      String(r.proof_of_delivery || '').startsWith('data:')
  );
  console.log(`Deliveries with data URI photos: ${rows.length}`);

  for (const row of rows) {
    try {
      const source = String(row.delivery_photo || '').startsWith('data:')
        ? row.delivery_photo
        : row.proof_of_delivery;
      const publicUrl = await uploadDataUri(
        source,
        `delivery-proofs/${row.order_id}-${Date.now()}`
      );
      const { error: upErr } = await supabase
        .from('order_deliveries')
        .update({
          delivery_photo: publicUrl,
          proof_of_delivery: publicUrl,
        })
        .eq('order_id', row.order_id);
      if (upErr) throw upErr;
      console.log(`  ✓ delivery ${row.order_id} → ${publicUrl.slice(0, 80)}...`);
    } catch (e) {
      console.error(`  ✗ delivery ${row.order_id}:`, e.message || e);
    }
  }
}

async function migrateMotorcyclePhotos() {
  const { data, error } = await supabase
    .from('customer_motorcycles')
    .select('motorcycle_id, photo_url');
  if (error) throw error;
  const rows = (data || []).filter((r) => String(r.photo_url || '').startsWith('data:'));
  console.log(`Motorcycles with data URI photos: ${rows.length}`);
  for (const row of rows) {
    try {
      const publicUrl = await uploadDataUri(
        row.photo_url,
        `motorcycles/${row.motorcycle_id}-${Date.now()}`
      );
      const { error: upErr } = await supabase
        .from('customer_motorcycles')
        .update({ photo_url: publicUrl })
        .eq('motorcycle_id', row.motorcycle_id);
      if (upErr) throw upErr;
      console.log(`  ✓ motorcycle ${row.motorcycle_id}`);
    } catch (e) {
      console.error(`  ✗ motorcycle ${row.motorcycle_id}:`, e.message || e);
    }
  }
}

async function migrateCustomizationPhotos() {
  const { data, error } = await supabase
    .from('customizations')
    .select('customization_id, motorcycle_photo_url, preview_image_url');
  if (error) throw error;
  const rows = (data || []).filter(
    (r) =>
      String(r.motorcycle_photo_url || '').startsWith('data:') ||
      String(r.preview_image_url || '').startsWith('data:')
  );
  console.log(`Customizations with data URI photos: ${rows.length}`);
  for (const row of rows) {
    try {
      const patch = {};
      if (String(row.motorcycle_photo_url || '').startsWith('data:')) {
        patch.motorcycle_photo_url = await uploadDataUri(
          row.motorcycle_photo_url,
          `motorcycles/custz-${row.customization_id}-${Date.now()}`
        );
      }
      if (String(row.preview_image_url || '').startsWith('data:')) {
        patch.preview_image_url = await uploadDataUri(
          row.preview_image_url,
          `customization-previews/${row.customization_id}-${Date.now()}`
        );
      }
      const { error: upErr } = await supabase
        .from('customizations')
        .update(patch)
        .eq('customization_id', row.customization_id);
      if (upErr) throw upErr;
      console.log(`  ✓ customization ${row.customization_id}`);
    } catch (e) {
      console.error(`  ✗ customization ${row.customization_id}:`, e.message || e);
    }
  }
}

async function main() {
  console.log('Migrating base64 images → Storage…');
  await migrateProducts();
  await migrateDeliveryProofs();
  await migrateMotorcyclePhotos();
  await migrateCustomizationPhotos();

  const { count: prodLeft } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .like('image', 'data:%');
  const { data: deliveries } = await supabase
    .from('order_deliveries')
    .select('order_id, delivery_photo, proof_of_delivery');
  const delLeft = (deliveries || []).filter(
    (r) =>
      String(r.delivery_photo || '').startsWith('data:') ||
      String(r.proof_of_delivery || '').startsWith('data:')
  ).length;
  console.log('Done. Remaining product data URIs:', prodLeft ?? 0);
  console.log('Done. Remaining delivery data URIs:', delLeft);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
