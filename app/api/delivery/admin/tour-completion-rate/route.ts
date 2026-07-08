/**
 * GET /api/delivery/admin/tour-completion-rate?location_id=...
 *
 * Phase 816 — Tour-Completion-Rate-Live
 * Live-Anteil fertig / aktiv / geplant aus allen Touren der heutigen Schicht.
 *
 * Response: { ok, data: CompletionData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CompletionData {
  abgeschlossen: number;
  aktiv: number;
  geplant: number;
  gesamt: number;
  completionPct: number;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  // Schicht: letzten 12 Stunden
  const since = new Date(now.getTime() - 12 * 3_600_000);

  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, status')
    .eq('location_id', locationId)
    .gte('created_at', since.toISOString());

  const batches = (batchRows ?? []) as { id: string; status: string }[];

  const DONE_STATUSES = ['abgeschlossen', 'completed'];
  const ACTIVE_STATUSES = ['aktiv', 'active', 'unterwegs', 'in_delivery', 'gestartet', 'started'];

  const abgeschlossen = batches.filter((b) => DONE_STATUSES.some((s) => b.status.includes(s))).length;
  const aktiv = batches.filter((b) => ACTIVE_STATUSES.some((s) => b.status.includes(s))).length;
  const geplant = batches.length - abgeschlossen - aktiv;
  const gesamt = batches.length;
  const completionPct = gesamt > 0 ? Math.round((abgeschlossen / gesamt) * 100) : 0;

  const data: CompletionData = { abgeschlossen, aktiv, geplant: Math.max(0, geplant), gesamt, completionPct };
  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
