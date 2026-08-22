import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { StationDisplay } from '@/app/kitchen/display/[token]/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Küchen-Display' };

/**
 * Device-spezifisches Display (nach erfolgreichem Pairing).
 * URL wird im LocalStorage des Tablets gespeichert — kein Re-Pairing nötig beim Neustart.
 */
export default async function KitchenDeviceDisplayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();

  const { data: device } = await svc.from('kitchen_display_devices')
    .select('id, station_id, aktiv, name, tenant_id')
    .eq('device_token', token).maybeSingle();

  if (!device || !device.aktiv) notFound();

  const [{ data: station }, { data: items }] = await Promise.all([
    svc.from('kitchen_stations')
      .select('id, name, icon, farbe, sound_enabled, location_id, tenant_id')
      .eq('id', device.station_id).single(),
    svc.from('order_items').select(`
      id, order_id, name, menge, notiz, station_status, extras,
      order:customer_orders!inner(id, bestellnummer, status, typ, bestellt_am, kunde_name, tisch_id, location_id, gedeckt_personen, bezahlt)
    `).eq('station_id', device.station_id).in('station_status', ['offen', 'in_arbeit']),
  ]);

  // Filter: nur bezahlte Bestellungen (Gastronomie-Lightspeed-Regel)
  const filtered = ((items as any[]) ?? []).filter((i) => i.order?.bezahlt === true);

  const tischIds = Array.from(new Set(filtered.map((i) => i.order?.tisch_id).filter(Boolean)));
  const { data: tables } = tischIds.length > 0
    ? await svc.from('restaurant_tables').select('id, nummer, name, bereich').in('id', tischIds)
    : { data: [] };
  const tableMap: Record<string, any> = Object.fromEntries((tables ?? []).map((t: any) => [t.id, t]));

  // letzter-Kontakt aktualisieren
  await svc.from('kitchen_display_devices').update({ letzter_kontakt: new Date().toISOString() }).eq('id', device.id);

  return (
    <StationDisplay
      station={station as any}
      initialItems={filtered as any}
      initialTableMap={tableMap}
    />
  );
}
