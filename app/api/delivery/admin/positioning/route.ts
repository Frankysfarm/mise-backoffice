import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  generatePositioningSuggestions,
  getActiveSuggestions,
  getPositioningStats,
  getPositioningHistory,
} from '@/lib/delivery/positioning';

export const dynamic = 'force-dynamic';

async function resolveAuth(req: NextRequest): Promise<{ locationId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const serviceSb = createServiceClient();
  const { data: emp } = await serviceSb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.tenant_id) return null;
  return { locationId: emp.tenant_id as string };
}

// GET — Aktive Vorschläge + Stats + History
export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'overview';
  const days = Math.min(30, Math.max(1, Number(searchParams.get('days') ?? '7')));

  try {
    if (action === 'stats') {
      const stats = await getPositioningStats(auth.locationId);
      return NextResponse.json(stats);
    }

    if (action === 'history') {
      const history = await getPositioningHistory(auth.locationId, days);
      return NextResponse.json({ history });
    }

    // Default: overview (suggestions + stats + history)
    const [suggestions, stats, history] = await Promise.all([
      getActiveSuggestions(auth.locationId),
      getPositioningStats(auth.locationId),
      getPositioningHistory(auth.locationId, 7),
    ]);

    return NextResponse.json({ suggestions, stats, history });
  } catch (err) {
    console.error('[positioning GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

// POST — Neue Vorschläge manuell generieren
export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await generatePositioningSuggestions(auth.locationId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[positioning POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
