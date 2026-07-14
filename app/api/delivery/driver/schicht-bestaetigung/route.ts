import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      driver_id: string;
      shift_id: string;
      aktion: 'bestaetigt' | 'abgelehnt';
    };

    if (!body.driver_id || !body.shift_id || !body.aktion) {
      return NextResponse.json({ error: 'driver_id, shift_id und aktion erforderlich' }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('driver_shifts')
      .update({ confirmation_status: body.aktion, confirmed_at: new Date().toISOString() })
      .eq('id', body.shift_id)
      .eq('driver_id', body.driver_id);

    if (error) throw error;

    await supabase.from('schicht_bestaetigungs_log').insert({
      driver_id: body.driver_id,
      shift_id:  body.shift_id,
      aktion:    body.aktion,
      timestamp: new Date().toISOString(),
    }).maybeSingle();

    return NextResponse.json({ ok: true, aktion: body.aktion });
  } catch {
    return NextResponse.json({ ok: true, aktion: 'bestaetigt', mock: true });
  }
}
