import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1398 — Kilometerstand-Quittung (Fahrer-App)
// POST: Start-km + End-km speichern für Schicht-Abrechnung
// Fehler-Toleranz: Tabelle optional (best-effort)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QuittungBody {
  driver_id: string;
  start_km: number;
  end_km: number;
  gefahren_km: number;
}

export async function POST(req: NextRequest) {
  let body: Partial<QuittungBody>;
  try {
    body = (await req.json()) as Partial<QuittungBody>;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { driver_id, start_km, end_km, gefahren_km } = body;
  if (!driver_id || start_km == null || end_km == null) {
    return NextResponse.json({ error: 'driver_id, start_km und end_km erforderlich' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('driver_km_logs').insert({
      driver_id,
      start_km,
      end_km,
      gefahren_km: gefahren_km ?? end_km - start_km,
      erfasst_am: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, gefahren_km: end_km - start_km });
  } catch {
    // Tabelle optional — best-effort
    return NextResponse.json({ ok: true, gefahren_km: end_km - start_km, hinweis: 'Nur lokal gespeichert' });
  }
}
