import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pos/reservations/today
 * Heute fällige Reservierungen für die Location des eingeloggten Employees.
 */
export async function GET() {
  const emp = await requirePosAccess();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id)
    .maybeSingle();

  if (!empRow?.tenant_id || !empRow?.location_id) {
    return NextResponse.json({ error: 'Keine Location' }, { status: 400 });
  }

  const { data, error } = await svc
    .from('v_heutige_reservierungen')
    .select('*')
    .eq('tenant_id', empRow.tenant_id)
    .eq('location_id', empRow.location_id)
    .order('zeit_von', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reservations: data ?? [] });
}
