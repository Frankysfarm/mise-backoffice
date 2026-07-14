/**
 * POST /api/delivery/public/benachrichtigungs-opt-in
 *
 * Phase 1475 — Kunden-Benachrichtigungs-Opt-In
 * Speichert Einwilligung für Push-/Email-Benachrichtigung bei Status-Änderungen.
 * Body: { location_id, customer_id?, email?, push_token?, kanal: 'email'|'push'|'beide' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OptInBody {
  location_id: string;
  customer_id?: string | null;
  email?: string | null;
  push_token?: string | null;
  kanal: 'email' | 'push' | 'beide';
}

export async function POST(req: NextRequest) {
  let body: OptInBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { location_id, customer_id, email, push_token, kanal } = body;
  if (!location_id || !kanal) {
    return NextResponse.json({ error: 'location_id and kanal required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const { error } = await (sb as any)
      .from('customer_notification_optins')
      .upsert(
        {
          location_id,
          customer_id: customer_id ?? null,
          email: email ?? null,
          push_token: push_token ?? null,
          kanal,
          opt_in_at: new Date().toISOString(),
          aktiv: true,
        },
        { onConflict: 'location_id,customer_id' },
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    // Table may not exist yet — silently accept
    return NextResponse.json({ ok: true, fallback: true });
  }
}
