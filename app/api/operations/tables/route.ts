import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uuid = z.string().uuid();
const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'), id: z.union([uuid, z.literal(''), z.null()]).optional(),
    nummer: z.string().trim().min(1).max(30), name: z.string().trim().max(100).nullable(),
    bereich: z.string().trim().min(1).max(80), kapazitaet: z.number().int().min(1).max(100),
    status: z.enum(['frei', 'belegt', 'reserviert', 'reinigung', 'gesperrt']),
    serviceDepartmentId: z.union([uuid, z.literal(''), z.null()]).optional(),
    confirmationRequired: z.boolean(), sessionTtlMinutes: z.number().int().min(15).max(720),
    menuLocale: z.string().trim().max(10).nullable().optional(), menuVariant: z.string().trim().max(60).nullable().optional(),
  }),
  z.object({ action: z.literal('toggle'), id: uuid, aktiv: z.boolean() }),
  z.object({ action: z.literal('archive'), id: uuid }),
]);

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id || !actor.location_id || !['manager', 'backoffice', 'admin'].includes(actor.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Tischdaten sind ungültig.' }, { status: 400 });
  const input = parsed.data;
  const service = createServiceClient();

  if (input.action === 'save') {
    const serviceDepartmentId = input.serviceDepartmentId || null;
    if (serviceDepartmentId) {
      const { data: department } = await service.from('departments').select('id').eq('id', serviceDepartmentId)
        .eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id).eq('aktiv', true).maybeSingle();
      if (!department) return NextResponse.json({ error: 'Servicebereich ist für diesen Standort nicht gültig.' }, { status: 400 });
    }
    const payload = {
      nummer: input.nummer, name: input.name || null, bereich: input.bereich, kapazitaet: input.kapazitaet,
      status: input.status, service_department_id: serviceDepartmentId,
      service_confirmation_required: input.confirmationRequired,
      session_ttl_minutes: input.sessionTtlMinutes,
      menu_locale: input.menuLocale || null, menu_variant: input.menuVariant || null,
    };
    const query = input.id
      ? service.from('restaurant_tables').update(payload).eq('id', input.id).eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id)
      : service.from('restaurant_tables').insert({ ...payload, tenant_id: actor.tenant_id, location_id: actor.location_id, aktiv: true });
    const { data, error } = await query.select('*').maybeSingle();
    if (error || !data) {
      const message = error?.code === '23505' ? 'Diese Tischnummer ist bereits vergeben.' : 'Tisch konnte nicht gespeichert werden.';
      return NextResponse.json({ error: message }, { status: error?.code === '23505' ? 409 : 500 });
    }
    return NextResponse.json({ table: data });
  }

  const patch = input.action === 'archive'
    ? { aktiv: false, status: 'gesperrt' }
    : { aktiv: input.aktiv, status: input.aktiv ? 'frei' : 'gesperrt' };
  const { data, error } = await service.from('restaurant_tables').update(patch)
    .eq('id', input.id).eq('tenant_id', actor.tenant_id).eq('location_id', actor.location_id)
    .select('*').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Tisch nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ table: data });
}
