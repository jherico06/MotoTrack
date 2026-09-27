// Supabase Edge Function: customization-compatibility
// Proxies validated requests to the n8n compatibility webhook.
// Secrets (N8N_COMPAT_WEBHOOK_URL, N8N_WEBHOOK_SECRET) live only here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mototrack-secret',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function brandMatches(rowBrand: string, bikeBrand: string) {
  const a = (rowBrand || '').toLowerCase();
  const b = (bikeBrand || '').toLowerCase();
  if (!a || !b) return false;
  if (a === 'universal') return true;
  return a === b || a.includes(b) || b.includes(a);
}

function modelMatches(rowModel: string, bikeModel: string) {
  const a = (rowModel || '').toLowerCase();
  const b = (bikeModel || '').toLowerCase();
  if (!a || !b) return false;
  if (a === 'all models' || a === 'universal' || a.includes('compatible models')) return true;
  return a === b || a.includes(b) || b.includes(a);
}

function yearMatches(row: Record<string, unknown>, year: number | null) {
  if (year == null || Number.isNaN(Number(year))) return true;
  const y = Number(year);
  if (row.year_exact != null) return Number(row.year_exact) === y;
  const from = row.year_from != null ? Number(row.year_from) : null;
  const to = row.year_to != null ? Number(row.year_to) : null;
  if (from != null && y < from) return false;
  if (to != null && y > to) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const customerId = payload.customerId ?? null;
    const motorcycleId = payload.motorcycleId ?? null;
    const productIds: string[] = Array.isArray(payload.productIds) ? payload.productIds : [];
    const motorcycle = payload.motorcycle || {};

    if (!productIds.length && !motorcycle?.brand) {
      return json({ compatible: false, items: [], errors: [{ code: 'invalid_request', message: 'Missing motorcycle or products.' }] }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let bike = {
      brand: String(motorcycle.brand || '').trim(),
      model: String(motorcycle.model || '').trim(),
      year: motorcycle.year != null ? Number(motorcycle.year) : null,
      motorcycleId,
    };

    if ((!bike.brand || !bike.model) && motorcycleId) {
      const { data: moto } = await supabase
        .from('customer_motorcycles')
        .select('motorcycle_id, brand, model, year')
        .eq('motorcycle_id', motorcycleId)
        .maybeSingle();
      if (moto) {
        bike = {
          brand: moto.brand,
          model: moto.model,
          year: moto.year,
          motorcycleId: moto.motorcycle_id,
        };
      }
    }

    if (!bike.brand || !bike.model) {
      return json({
        compatible: false,
        items: [],
        errors: [{ code: 'invalid_motorcycle', message: 'Invalid motorcycle.' }],
      }, 400);
    }

    // Optional n8n automation pass-through
    const n8nUrl = Deno.env.get('N8N_COMPAT_WEBHOOK_URL');
    const n8nSecret = Deno.env.get('N8N_WEBHOOK_SECRET') || '';
    if (n8nUrl) {
      try {
        const n8nRes = await fetch(n8nUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MotoTrack-Secret': n8nSecret,
          },
          body: JSON.stringify({ customerId, motorcycleId, motorcycle: bike, productIds }),
        });
        if (n8nRes.ok) {
          const n8nBody = await n8nRes.json();
          if (typeof n8nBody?.compatible === 'boolean') {
            return json(n8nBody);
          }
        }
      } catch (_e) {
        // fall through to DB check
      }
    }

    const { data: products } = await supabase
      .from('products')
      .select('product_id, name, brand, price, status')
      .in('product_id', productIds);

    const { data: inventory } = await supabase
      .from('inventory')
      .select('product_id, stock_quantity')
      .in('product_id', productIds);

    const { data: compatRows } = await supabase
      .from('product_compatibility')
      .select('*')
      .in('product_id', productIds);

    const stockMap = new Map((inventory || []).map((i) => [i.product_id, Number(i.stock_quantity) || 0]));
    const productMap = new Map((products || []).map((p) => [p.product_id, p]));
    const items: Record<string, unknown>[] = [];
    const errors: Record<string, unknown>[] = [];

    for (const pid of productIds) {
      const product = productMap.get(pid);
      if (!product) {
        items.push({ productId: pid, compatible: false, reason: 'Product not found.' });
        errors.push({ productId: pid, code: 'invalid_product', message: 'Product not found.' });
        continue;
      }
      const rows = (compatRows || []).filter((r) => r.product_id === pid);
      const hit = rows.find(
        (r) => brandMatches(r.brand, bike.brand) && modelMatches(r.model, bike.model) && yearMatches(r, bike.year)
      );
      const compatible = !!hit;
      items.push({
        productId: pid,
        productName: product.name,
        brand: product.brand,
        price: Number(product.price) || 0,
        stock: stockMap.get(pid) || 0,
        compatible,
        reason: compatible ? null : 'This product is not marked as compatible with your selected motorcycle.',
      });
      if (!compatible) {
        errors.push({
          productId: pid,
          code: 'incompatible',
          message: 'This product is not marked as compatible with your selected motorcycle.',
        });
      }
    }

    return json({
      compatible: errors.length === 0,
      items,
      errors,
      motorcycle: bike,
      customerId,
      source: n8nUrl ? 'db-fallback' : 'database',
    });
  } catch (err) {
    return json({
      compatible: false,
      items: [],
      errors: [{ code: 'server_error', message: String((err as Error)?.message || err) }],
    }, 500);
  }
});
