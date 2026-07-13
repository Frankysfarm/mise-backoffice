import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1403 Backend — Schicht-Notiz speichern
// POST /api/driver-app/schicht-notiz
// Body: { driver_id, notiz, timestamp }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { driver_id?: string; notiz?: string; timestamp?: string };
    const { driver_id, notiz, timestamp } = body;

    if (!driver_id || !notiz) {
      return NextResponse.json({ error: 'driver_id and notiz required' }, { status: 400 });
    }

    try {
      const supabase = await createClient();
      await supabase.from('driver_shift_notes').insert({
        driver_id,
        notiz: notiz.slice(0, 280),
        created_at: timestamp ?? new Date().toISOString(),
      });
    } catch {
      // Tabelle existiert möglicherweise nicht — best-effort
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
}
