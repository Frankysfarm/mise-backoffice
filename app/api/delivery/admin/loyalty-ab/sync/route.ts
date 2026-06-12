/**
 * POST /api/delivery/admin/loyalty-ab/sync
 * Body: { source_location_id, test_id, target_location_ids: string[] }
 *
 * Kopiert einen A/B-Test aus einer Quell-Location in mehrere Ziel-Locations.
 * Bestehende Tests mit gleichem Namen werden übersprungen.
 * Auth: eingeloggter Supabase-User erforderlich.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncTestToLocations } from '@/lib/delivery/loyalty-ab';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    source_location_id?: string;
    test_id?: string;
    target_location_ids?: string[];
  };

  const { source_location_id, test_id, target_location_ids } = body;

  if (!source_location_id || !test_id || !target_location_ids?.length) {
    return NextResponse.json(
      { error: 'source_location_id, test_id und target_location_ids erforderlich' },
      { status: 400 },
    );
  }

  try {
    const result = await syncTestToLocations(test_id, source_location_id, target_location_ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
