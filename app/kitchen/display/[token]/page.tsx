import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { StationDisplay } from './client';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Küchen-Display',
};

export default async function StationDisplayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();

  const { data: station } = await svc.from('kitchen_stations')
    .select('id, name, icon, farbe, location_id, tenant_id, sound_enabled')
    .eq('display_token', token).eq('aktiv', true).maybeSingle();

  if (!station) notFound();

  // Initial orders: alle offenen Orders der Location, gefiltert auf Items dieser Station
  const { data: items } = await svc.from('order_items')
    .select(`
      id, order_id, name, menge, notiz, station_status, extras,
      order:customer_orders!inner(id, bestellnummer, status, typ, bestellt_am, kunde_name, tisch_id, location_id, gedeckt_personen)
    `)
    .eq('station_id', station.id)
    .in('station_status', ['offen', 'in_arbeit']);

  // Tische holen für Tisch-Nummer-Lookup
  const tischIds = Array.from(new Set(
    ((items as any[]) ?? []).map((i) => i.order?.tisch_id).filter(Boolean),
  ));
  const { data: tables } = tischIds.length > 0
    ? await svc.from('restaurant_tables').select('id, nummer, name, bereich').in('id', tischIds)
    : { data: [] };

  const tableMap: Record<string, { nummer: string; name: string | null; bereich: string | null }> =
    Object.fromEntries((tables ?? []).map((t: any) => [t.id, { nummer: t.nummer, name: t.name, bereich: t.bereich }]));

  return (
    <StationDisplay
      station={station as any}
      initialItems={(items as any[]) ?? []}
      initialTableMap={tableMap}
    />
  );
}
