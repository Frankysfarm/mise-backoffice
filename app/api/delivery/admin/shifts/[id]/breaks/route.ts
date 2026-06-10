/**
 * GET  /api/delivery/admin/shifts/[id]/breaks
 *   Gibt alle Pausen einer Schicht + Zusammenfassung zurück.
 *
 * DELETE /api/delivery/admin/shifts/[id]/breaks?break_id=...
 *   Löscht eine Pause (Admin-Korrektur, z.B. versehentlich gestartet).
 *
 * Auth: eingeloggte Supabase-Session (Admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getShiftBreaks, getBreakSummary } from '@/lib/delivery/shifts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const shiftId = params.id;
  const [breaks, summary] = await Promise.all([
    getShiftBreaks(shiftId),
    getBreakSummary(shiftId),
  ]);

  return NextResponse.json({ breaks, summary });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const breakId = searchParams.get('break_id');
  if (!breakId) return NextResponse.json({ error: 'break_id fehlt' }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc
    .from('shift_breaks')
    .delete()
    .eq('id', breakId)
    .eq('shift_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
