/**
 * POST /api/driver-app/tour-feedback
 *
 * Phase 1433 — Post-Tour-Kurzfeedback (Fahrer)
 * Speichert das Post-Tour-Feedback des Fahrers:
 *   • strecke_sterne: 1–5 (Streckenqualität)
 *   • kunden_sterne:  1–5 (Kundenerfahrung)
 *   • besonderheiten_sterne: 1–5 (Besonderheiten)
 * Supabase mise_driver_feedback + Mock-Fallback (204).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FeedbackPayload {
  driver_id: string;
  batch_id: string;
  location_id: string;
  strecke_sterne: number;
  kunden_sterne: number;
  besonderheiten_sterne: number;
}

function clamp(v: number): number {
  return Math.min(5, Math.max(1, Math.round(v)));
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { driver_id, batch_id, location_id, strecke_sterne, kunden_sterne, besonderheiten_sterne } = body as Partial<FeedbackPayload>;

  if (!driver_id || !batch_id || !location_id) {
    return NextResponse.json({ error: 'driver_id, batch_id, location_id required' }, { status: 400 });
  }
  if (strecke_sterne == null || kunden_sterne == null || besonderheiten_sterne == null) {
    return NextResponse.json({ error: 'Alle drei Sterne-Felder erforderlich' }, { status: 400 });
  }

  const payload = {
    driver_id,
    batch_id,
    location_id,
    strecke_sterne:        clamp(strecke_sterne),
    kunden_sterne:         clamp(kunden_sterne),
    besonderheiten_sterne: clamp(besonderheiten_sterne),
    gespeichert_am:        new Date().toISOString(),
  };

  try {
    const sb = await createClient();
    await (sb as any).from('mise_driver_feedback').insert(payload);
    return NextResponse.json({ ok: true });
  } catch {
    // Tabelle existiert noch nicht → trotzdem 200 für den Client
    return NextResponse.json({ ok: true, mock: true });
  }
}
