import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';

interface PostBody {
  gast_name: string;
  gast_telefon?: string | null;
  gast_email?: string | null;
  gast_anzahl: number;
  datum: string;
  zeit_von: string;
  dauer_min?: number;
  tisch_id?: string | null;
  notiz?: string | null;
  quelle?: string;
}

export async function POST(req: Request) {
  const emp = await requireManagerPlus();
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.gast_name || !body.datum || !body.zeit_von || !body.gast_anzahl) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
  }

  const sb = await createClient();
  const svc = createServiceClient();
  const { data: empRow } = await sb
    .from('employees').select('tenant_id, location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) {
    return NextResponse.json({ error: 'tenant unbekannt' }, { status: 403 });
  }

  const { data, error } = await svc
    .from('tisch_reservierungen')
    .insert({
      tenant_id: empRow.tenant_id,
      location_id: empRow.location_id,
      gast_name: body.gast_name,
      gast_telefon: body.gast_telefon ?? null,
      gast_email: body.gast_email ?? null,
      gast_anzahl: body.gast_anzahl,
      datum: body.datum,
      zeit_von: body.zeit_von,
      dauer_min: body.dauer_min ?? 90,
      tisch_id: body.tisch_id ?? null,
      notiz: body.notiz ?? null,
      quelle: body.quelle ?? 'manuell',
      status: 'bestaetigt',
      bestaetigt_am: new Date().toISOString(),
      bestaetigt_von: emp.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
