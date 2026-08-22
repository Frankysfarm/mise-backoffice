import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { ReservationsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tisch-Reservierungen · Mise' };

export default async function ReservationsPage({
  searchParams,
}: { searchParams?: Promise<{ tag?: string }> }) {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const params = (await searchParams) ?? {};
  const tag = params.tag === 'morgen' ? 'morgen' : params.tag === 'woche' ? 'woche' : 'heute';

  const { data: empRow } = await sb
    .from('employees')
    .select('tenant_id,location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const today = new Date();
  const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10);

  let dateFrom = yyyymmdd(today);
  let dateTo = yyyymmdd(today);
  if (tag === 'morgen') {
    const morgen = new Date(today.getTime() + 86400000);
    dateFrom = yyyymmdd(morgen);
    dateTo = yyyymmdd(morgen);
  } else if (tag === 'woche') {
    const inSieben = new Date(today.getTime() + 7 * 86400000);
    dateTo = yyyymmdd(inSieben);
  }

  const [{ data: reservations }, { data: tables }, { data: location }] = await Promise.all([
    svc.from('tisch_reservierungen')
      .select('id, gast_name, gast_telefon, gast_email, gast_anzahl, datum, zeit_von, zeit_bis, dauer_min, notiz, allergie_hinweis, status, quelle, tisch_id, customer_order_id, restaurant_tables(nummer, kapazitaet)')
      .eq('location_id', empRow.location_id)
      .gte('datum', dateFrom)
      .lte('datum', dateTo)
      .not('status', 'in', '(beendet,storniert,noshow)')
      .order('datum', { ascending: true })
      .order('zeit_von', { ascending: true }),
    svc.from('restaurant_tables')
      .select('id, nummer, kapazitaet, aktiv')
      .eq('location_id', empRow.location_id)
      .eq('aktiv', true)
      .order('nummer', { ascending: true }),
    svc.from('locations').select('name').eq('id', empRow.location_id).single(),
  ]);

  return (
    <ReservationsClient
      tag={tag}
      locationName={(location as { name: string }).name}
      reservations={(reservations ?? []) as never[]}
      tables={(tables ?? []) as never[]}
    />
  );
}
