import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { procedureContentSchema } from '@/lib/ablaeufe/schema';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  title: z.string().trim().min(2, 'Bitte einen Titel mit mindestens zwei Zeichen eingeben.').max(180, 'Der Titel ist zu lang.'),
  phase: z.enum(['opening', 'middle', 'closing', '']).default(''),
  position: z.string().trim().max(100, 'Die Position ist zu lang.'),
  departmentId: z.string().uuid('Der Bereich ist ungültig.').nullable(),
  active: z.boolean(),
  interval: z.string().trim().min(1, 'Bitte eine Wiederholung angeben.').max(100),
  reminderMinutes: z.number().int().min(0).max(10080),
  escalationMinutes: z.number().int().min(0).max(10080),
  content: procedureContentSchema,
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!['manager', 'backoffice', 'admin'].includes(actor.rolle)) return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Bitte Eingaben prüfen.' }, { status: 400 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: existing } = await supabase.from('checkup_templates').select('id,department_id').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Kontrollliste nicht gefunden.' }, { status: 404 });
  if (parsed.data.departmentId) {
    let departmentQuery = supabase.from('departments').select('id,location_id').eq('id', parsed.data.departmentId).eq('tenant_id', actor.tenant_id);
    if (actor.rolle === 'manager') departmentQuery = departmentQuery.eq('location_id', actor.location_id!);
    const { data: department } = await departmentQuery.maybeSingle();
    if (!department) return NextResponse.json({ error: 'Bereich nicht freigegeben.' }, { status: 403 });
  }
  const input = parsed.data;
  const { error } = await supabase.from('checkup_templates').update({
    titel: input.title,
    phase: input.phase || null,
    position_typ: input.position || null,
    department_id: input.departmentId,
    aktiv: input.active,
    intervall: input.interval,
    auto_reminder_minutes: input.reminderMinutes,
    eskalation_minutes: input.escalationMinutes,
    fragen: input.content,
  }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Kontrollliste konnte nicht gespeichert werden.' }, { status: 500 });
  return NextResponse.json({ id });
}
