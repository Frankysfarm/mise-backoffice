import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';

const schema = z.object({
  location_id: z.string().uuid(),
  department_id: z.string().uuid().optional(),
  start_zeit: z.string().datetime({ offset: true }),
  end_zeit: z.string().datetime({ offset: true }),
  position: z.string().trim().min(1).max(120),
  notiz: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) {
    return NextResponse.json({ error: 'Mitarbeiterkonto ist keinem Mandanten zugeordnet.' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bitte alle Angaben zur Probearbeit vollständig prüfen.' }, { status: 400 });
  }

  const start = new Date(parsed.data.start_zeit);
  const end = new Date(parsed.data.end_zeit);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'Die Endzeit muss nach der Startzeit liegen.' }, { status: 400 });
  }

  const sb = createServiceClient();
  const [{ data: application }, { data: location }] = await Promise.all([
    sb.from('employees')
      .select('id,status')
      .eq('id', id)
      .eq('tenant_id', currentEmployee.tenant_id)
      .maybeSingle(),
    sb.from('locations')
      .select('id')
      .eq('id', parsed.data.location_id)
      .eq('tenant_id', currentEmployee.tenant_id)
      .maybeSingle(),
  ]);

  if (!application || !['wartet_zuteilung', 'in_probe'].includes(application.status)) {
    return NextResponse.json({ error: 'Diese Bewerbung kann nicht zur Probearbeit eingeplant werden.' }, { status: 409 });
  }
  if (!location) {
    return NextResponse.json({ error: 'Standort gehört nicht zu diesem Betrieb.' }, { status: 400 });
  }
  if (parsed.data.department_id) {
    const { data: department } = await sb.from('departments')
      .select('id,location_id')
      .eq('id', parsed.data.department_id)
      .eq('location_id', parsed.data.location_id)
      .maybeSingle();
    if (!department) {
      return NextResponse.json({ error: 'Abteilung gehört nicht zum gewählten Standort.' }, { status: 400 });
    }
  }

  const { data: shift, error: shiftError } = await sb.from('shifts').insert({
    employee_id: id,
    department_id: parsed.data.department_id ?? null,
    location_id: parsed.data.location_id,
    start_zeit: start.toISOString(),
    end_zeit: end.toISOString(),
    pause_minuten: 0,
    status: 'bestätigt',
    position: parsed.data.position,
    typ: 'probe',
    notiz: parsed.data.notiz || null,
    erstellt_von: currentEmployee.id,
  }).select('id').single();
  if (shiftError || !shift) {
    return NextResponse.json({ error: shiftError?.message ?? 'Probearbeit konnte nicht angelegt werden.' }, { status: 500 });
  }

  const { error: applicationError } = await sb.from('employees').update({
    status: 'in_probe',
    location_id: parsed.data.location_id,
    department_id: parsed.data.department_id ?? null,
    position_typ: parsed.data.position,
  }).eq('id', id).eq('tenant_id', currentEmployee.tenant_id);
  if (applicationError) {
    await sb.from('shifts').delete().eq('id', shift.id);
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, shift_id: shift.id, status: 'in_probe' });
}
