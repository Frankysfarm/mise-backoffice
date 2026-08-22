import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { POSTerminalNew } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'POS Terminal · Mise' };

export default async function POSTerminalPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id,vorname,nachname').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: categories }, { data: items }, { data: tables }, { data: register }, { data: openTables }, { data: openShift }, { data: pendingOrders }] = await Promise.all([
    svc.from('menu_categories').select('*').eq('location_id', empRow.location_id).eq('aktiv', true).order('sort_order'),
    svc.from('menu_items').select('*').eq('location_id', empRow.location_id).eq('verfuegbar', true).order('sort_order'),
    svc.from('restaurant_tables').select('*').eq('location_id', empRow.location_id).eq('aktiv', true).order('sort_order'),
    svc.from('pos_registers').select('*').eq('location_id', empRow.location_id).eq('aktiv', true).limit(1).maybeSingle(),
    svc.from('v_open_tables').select('*').eq('location_id', empRow.location_id),
    svc.from('pos_shifts').select('*').eq('employee_id', emp.id).eq('status', 'offen').order('start_at', { ascending: false }).limit(1).maybeSingle(),
    svc.from('v_tisch_offene_orders').select('*').eq('location_id', empRow.location_id).eq('bezahlt', false),
  ]);

  const openMap: Record<string, { offene_orders: number; offene_summe: number }> = {};
  for (const r of (openTables as any[] ?? [])) {
    openMap[r.table_id] = { offene_orders: r.offene_orders ?? 0, offene_summe: r.offene_summe ?? 0 };
  }

  return (
    <POSTerminalNew
      tenantId={empRow.tenant_id}
      locationId={empRow.location_id}
      employeeId={emp.id}
      employeeName={`${empRow.vorname} ${empRow.nachname}`}
      registerId={register?.id ?? null}
      categories={(categories as any[]) ?? []}
      items={(items as any[]) ?? []}
      tables={(tables as any[]) ?? []}
      openTables={openMap}
      initialShift={(openShift as any) ?? null}
      pendingOrders={(pendingOrders as any[]) ?? []}
    />
  );
}
