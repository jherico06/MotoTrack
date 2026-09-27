// Supabase Edge Function: customization-preview
// Validates customization against DB, then calls n8n AI preview workflow.
// AI never decides price, stock, or compatibility.

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

function buildPrompt(motorcycle: Record<string, unknown>, items: Record<string, unknown>[]) {
  const bikeLabel = [motorcycle.year, motorcycle.brand, motorcycle.model].filter(Boolean).join(' ');
  const parts =
    items.length > 0
      ? items.map((p) => `- ${p.name || p.product_name || 'part'}`).join('\n')
      : '- stock OEM parts';
  return [
    `Generate a realistic commercial motorcycle visualization of a ${bikeLabel}.`,
    'Keep the motorcycle model recognizable. Do not change it into another model. Do not generate a car.',
    'Visually represent ONLY these selected motorcycle parts and accessories:',
    parts,
    'Do not add unrelated parts. Photorealistic studio lighting, sharp detail, 4K commercial product photo.',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const customizationId = payload.customizationId;
    if (!customizationId) {
      return json({ error: 'Missing customizationId' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: customization, error: custErr } = await supabase
      .from('customizations')
      .select('*')
      .eq('customization_id', customizationId)
      .maybeSingle();

    if (custErr || !customization) {
      return json({ error: 'Invalid customization.' }, 400);
    }

    const { data: items } = await supabase
      .from('customization_items')
      .select('*')
      .eq('customization_id', customizationId);

    if (!items?.length) {
      return json({ error: 'Customization has no selected parts.' }, 400);
    }

    const productIds = items.map((i) => i.product_id);
    const motorcycle = {
      brand: customization.motorcycle_brand,
      model: customization.motorcycle_model,
      year: customization.motorcycle_year,
      motorcycleId: customization.motorcycle_id,
    };

    // Re-check compatibility from DB (never trust client / AI)
    const compatRes = await fetch(`${supabaseUrl}/functions/v1/customization-compatibility`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        customerId: customization.customer_id,
        motorcycleId: customization.motorcycle_id,
        motorcycle,
        productIds,
      }),
    });
    const compatBody = await compatRes.json();
    if (!compatBody?.compatible) {
      return json({
        error: 'Cannot generate preview: incompatible products.',
        compatibility: compatBody,
      }, 400);
    }

    const prompt = payload.prompt || buildPrompt(motorcycle, items);

    const n8nUrl = Deno.env.get('N8N_PREVIEW_WEBHOOK_URL');
    const n8nSecret = Deno.env.get('N8N_WEBHOOK_SECRET') || '';

    if (n8nUrl) {
      const n8nRes = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MotoTrack-Secret': n8nSecret,
        },
        body: JSON.stringify({
          customizationId,
          customerId: customization.customer_id,
          motorcycle,
          productIds,
          items,
          prompt,
          totalPrice: customization.total_price,
        }),
      });

      if (!n8nRes.ok) {
        return json({
          error: 'Unable to generate the preview right now. Your customization has not been lost.',
          n8nStatus: n8nRes.status,
        }, 502);
      }

      const n8nBody = await n8nRes.json();
      const previewImageUrl = n8nBody.previewImageUrl || n8nBody.imageUrl || n8nBody.url;
      if (!previewImageUrl) {
        return json({
          error: 'Unable to generate the preview right now. Your customization has not been lost.',
        }, 502);
      }

      await supabase
        .from('customizations')
        .update({
          preview_image_url: previewImageUrl,
          preview_prompt: n8nBody.promptUsed || prompt,
          status: 'previewed',
        })
        .eq('customization_id', customizationId);

      return json({
        success: true,
        previewImageUrl,
        promptUsed: n8nBody.promptUsed || prompt,
        source: 'n8n',
        customizationId,
      });
    }

    // Fallback when n8n is not configured yet
    const clean = prompt.replace(/[^\w\s,.\-/]/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 450);
    const seed = Math.floor(100000 + Math.random() * 900000);
    const previewImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?width=1024&height=768&nologo=true&seed=${seed}&model=flux`;

    await supabase
      .from('customizations')
      .update({
        preview_image_url: previewImageUrl,
        preview_prompt: prompt,
        status: 'previewed',
      })
      .eq('customization_id', customizationId);

    return json({
      success: true,
      previewImageUrl,
      promptUsed: prompt,
      source: 'edge-fallback',
      customizationId,
      note: 'Configure N8N_PREVIEW_WEBHOOK_URL for production AI workflow.',
    });
  } catch (err) {
    return json({
      error: 'Unable to generate the preview right now. Your customization has not been lost.',
      detail: String((err as Error)?.message || err),
    }, 500);
  }
});
