/**
 * GET /api/delivery/admin/bestellmengen-empfehlung?location_id=<uuid>&item=<name>&item=...
 *
 * Phase 922 — Bestellmengen-Empfehlung Backend
 * "Andere Kunden bestellen oft auch X" — Cross-Sell basierend auf
 * häufig gemeinsam bestellten Artikeln der letzten 30 Tage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentItems = url.searchParams.getAll('item').map((s) => s.toLowerCase());

  const sb = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  // Letzte 30 Tage: alle Bestellungen mit items
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, items')
    .eq('location_id', locationId)
    .not('status', 'in', '("storniert","cancelled")')
    .gte('created_at', cutoff.toISOString())
    .limit(500);

  if (!orders || orders.length === 0) {
    return NextResponse.json({ empfehlungen: [], generatedAt: new Date().toISOString() });
  }

  // Artikel-Häufigkeit berechnen (nur Bestellungen, die einen der aktuellen Artikel enthalten)
  const coCount = new Map<string, number>();

  for (const order of orders) {
    const items = (order.items ?? []) as { name?: string; title?: string }[];
    const orderNames = items.map((it) => ((it.name ?? it.title) ?? '').toLowerCase()).filter(Boolean);

    // Hat diese Bestellung einen der aktuellen Artikel?
    const hasCurrentItem = currentItems.length === 0 || currentItems.some((ci) =>
      orderNames.some((n) => n.includes(ci) || ci.includes(n)),
    );
    if (!hasCurrentItem) continue;

    // Zähle alle anderen Artikel
    for (const name of orderNames) {
      if (!currentItems.some((ci) => name.includes(ci) || ci.includes(name))) {
        const displayName = items.find(
          (it) => ((it.name ?? it.title) ?? '').toLowerCase() === name,
        );
        const label = displayName?.name ?? displayName?.title ?? name;
        coCount.set(label, (coCount.get(label) ?? 0) + 1);
      }
    }
  }

  // Top-5 häufigste Mitbestellungen
  const empfehlungen = [...coCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({ empfehlungen, generatedAt: new Date().toISOString() });
}
