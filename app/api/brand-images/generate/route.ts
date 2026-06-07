import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 Min für mehrere DALL-E-Calls

/**
 * POST /api/brand-images/generate
 * Body: { tenant_id: string, count?: number, type?: 'hero' | 'gallery' | 'both' }
 *
 * Generiert KI-Food-Bilder mit DALL-E 3, lädt sie in Supabase Storage hoch,
 * updated tenant.storefront_settings.brand_page.gallery (+ hero.image_url).
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY nicht konfiguriert. Setze ihn in /opt/mise/.env' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { tenant_id?: string; count?: number; type?: 'hero' | 'gallery' | 'both' } | null;
  const tenant_id = body?.tenant_id;
  const count = Math.min(Math.max(body?.count ?? 8, 1), 8);
  const type = body?.type ?? 'both';
  if (!tenant_id) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });

  const svc = createServiceClient();

  // Tenant + Top-Menu-Items laden
  const { data: tenant } = await svc.from('tenants')
    .select('id, name, slug, stadt, storefront_settings')
    .eq('id', tenant_id).single();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const { data: location } = await svc.from('locations')
    .select('id').eq('tenant_id', tenant_id).limit(1).maybeSingle();

  const items: { name: string; beschreibung: string | null }[] = [];
  if (location?.id) {
    const { data } = await svc.from('menu_items')
      .select('name, beschreibung, beliebt')
      .eq('location_id', location.id)
      .eq('verfuegbar', true)
      .order('beliebt', { ascending: false })
      .limit(count + 1);
    items.push(...(data ?? []));
  }

  // Categories für Stilbestimmung
  const { data: categories } = await svc.from('menu_categories')
    .select('name').eq('location_id', location?.id ?? '').limit(5);
  const cuisineHint = (categories ?? []).map((c: { name: string }) => c.name).slice(0, 3).join(', ');

  // Prompt-Builder
  const buildHeroPrompt = () => {
    const top = items[0];
    return `Cinematic food photography hero shot of ${top?.name ?? 'Italian pasta dish'}. ${top?.beschreibung ?? ''} Dramatic moody lighting from above, dark deep green and warm amber tones, shallow depth of field, premium restaurant magazine style like Padella London or Pizza East. Atmospheric steam, rustic wooden surface, soft bokeh background. Editorial Food&Wine quality. 16:9 wide composition, no people, no text.`.slice(0, 1000);
  };
  const buildItemPrompt = (item: { name: string; beschreibung: string | null }) => {
    return `Cinematic food photography of ${item.name}. ${item.beschreibung ?? ''}. ${cuisineHint ? `Cuisine: ${cuisineHint}.` : ''} Dramatic moody side lighting, dark background with warm wood tones, shallow depth of field, premium restaurant magazine style. Steam rising, rustic ceramic plate, professional food styling. No text, no people, top-down or 45-degree angle. Editorial Food&Wine quality.`.slice(0, 1000);
  };

  const callDalle = async (prompt: string) => {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DALL-E API: ${res.status} ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.data[0].url as string;
  };

  const uploadFromUrl = async (url: string, filename: string) => {
    const imgRes = await fetch(url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const path = `${tenant_id}/brand/${filename}`;
    const { error } = await svc.storage
      .from('tenant_assets')
      .upload(path, buf, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`Upload: ${error.message}`);
    const { data } = svc.storage.from('tenant_assets').getPublicUrl(path);
    return data.publicUrl;
  };

  try {
    const generatedUrls: string[] = [];
    let heroUrl: string | null = null;

    // Hero (groß, separate Prompt)
    if (type === 'hero' || type === 'both') {
      const dalleUrl = await callDalle(buildHeroPrompt());
      heroUrl = await uploadFromUrl(dalleUrl, `hero-${Date.now()}.png`);
    }

    // Galerie (mehrere)
    if (type === 'gallery' || type === 'both') {
      const itemsToGen = items.slice(0, count);
      for (const item of itemsToGen) {
        try {
          const dalleUrl = await callDalle(buildItemPrompt(item));
          const stored = await uploadFromUrl(dalleUrl, `gallery-${item.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.png`);
          generatedUrls.push(stored);
        } catch (e) {
          console.error(`Failed for ${item.name}:`, e);
        }
      }
    }

    // Brand-Page-Settings updaten
    const currentSettings = (tenant.storefront_settings ?? {}) as any;
    const currentBrand = currentSettings.brand_page ?? {};
    const newBrandPage = {
      ...currentBrand,
      hero: {
        ...(currentBrand.hero ?? {}),
        ...(heroUrl ? { image_url: heroUrl } : {}),
      },
      ...(generatedUrls.length > 0 ? { gallery: generatedUrls } : {}),
    };
    await svc.from('tenants').update({
      storefront_settings: { ...currentSettings, brand_page: newBrandPage },
    }).eq('id', tenant_id);

    return NextResponse.json({
      ok: true,
      hero_url: heroUrl,
      gallery_urls: generatedUrls,
      total_generated: (heroUrl ? 1 : 0) + generatedUrls.length,
      cost_estimate_usd: ((heroUrl ? 1 : 0) + generatedUrls.length) * 0.04,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
