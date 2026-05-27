import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CommitItem {
  kategorie: string;
  name: string;
  beschreibung: string | null;
  preis: number | null;
  allergene?: string[];
}

/**
 * POST /api/menu/import/commit
 *
 * Body: { items: CommitItem[] }
 *
 * Legt fehlende Kategorien an, dann alle Items in einem Rutsch.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees').select('tenant_id, location_id, rolle').eq('id', user.id).maybeSingle();
  if (!emp?.location_id) return NextResponse.json({ error: 'no location' }, { status: 403 });
  if (!['manager', 'backoffice', 'admin'].includes(emp.rolle ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as { items: CommitItem[] };
  const items = (body.items ?? []).filter(
    (i) => i.name && typeof i.preis === 'number' && i.preis >= 0,
  );
  if (items.length === 0) {
    return NextResponse.json({ error: 'Keine validen Items.' }, { status: 400 });
  }

  const svc = createServiceClient();

  // Existierende Kategorien laden
  const { data: existingCats } = await svc
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('location_id', emp.location_id);

  const catByName = new Map<string, string>();
  let maxOrder = 0;
  for (const c of existingCats ?? []) {
    catByName.set((c.name as string).toLowerCase(), c.id as string);
    if ((c.sort_order as number) > maxOrder) maxOrder = c.sort_order as number;
  }

  // Fehlende Kategorien anlegen
  const newCats = new Set<string>();
  for (const it of items) {
    const k = it.kategorie.trim();
    if (k && !catByName.has(k.toLowerCase())) newCats.add(k);
  }

  for (const catName of newCats) {
    maxOrder += 10;
    const { data: created } = await svc
      .from('menu_categories')
      .insert({
        location_id: emp.location_id,
        name: catName,
        sort_order: maxOrder,
        aktiv: true,
      })
      .select('id, name')
      .single();
    if (created) catByName.set((created.name as string).toLowerCase(), created.id as string);
  }

  // Items inserten
  const rows = items.map((it, idx) => ({
    location_id: emp.location_id,
    tenant_id: emp.tenant_id,
    category_id: catByName.get(it.kategorie.toLowerCase()) ?? null,
    name: it.name,
    beschreibung: it.beschreibung,
    preis: it.preis,
    allergene: it.allergene ?? null,
    verfuegbar: true,
    beliebt: false,
    sort_order: idx + 1,
    sort_order_in_category: idx + 1,
  }));

  const { data: inserted, error } = await svc
    .from('menu_items')
    .insert(rows)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    inserted: inserted?.length ?? 0,
    categoriesCreated: newCats.size,
  });
}
