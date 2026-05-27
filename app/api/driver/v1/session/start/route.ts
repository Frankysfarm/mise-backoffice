import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  vehicle?: 'bike' | 'car';
}

export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* leerer body ok */
  }

  const update: Record<string, unknown> = {
    active: true,
    state: 'idle',
    shift_started_at: new Date().toISOString(),
  };
  if (body.vehicle === 'bike' || body.vehicle === 'car') {
    update.vehicle = body.vehicle;
  }

  const { error } = await sb().from('mise_drivers').update(update).eq('id', m.driver.id);
  if (error) {
    return NextResponse.json({ error: 'Konnte Schicht nicht starten' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
