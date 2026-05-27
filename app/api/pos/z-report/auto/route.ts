import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Automatischer täglicher Z-Bericht — wird von Vercel-Cron 04:00 getriggert.
 * Schließt alle offenen Schichten des Vortags + erzeugt Z-Bericht pro Kasse.
 */
export async function GET() { return run(); }
export async function POST() { return run(); }

async function run() {
  const svc = createServiceClient();
  const heute = new Date().toISOString().slice(0, 10);
  const gestern = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

  // 1) Auto-Close offene Schichten (> 14h)
  const { data: closed } = await svc.rpc('auto_close_shifts');

  // 2) Pro Tenant + Register einen Z-Bericht generieren
  const { data: registers } = await svc.from('pos_registers').select('id, tenant_id, location_id');

  let created = 0;
  for (const r of (registers as any[] ?? [])) {
    // Skippen wenn schon Z-Bericht für heute existiert
    const { count } = await svc.from('pos_z_reports').select('id', { count: 'exact', head: true })
      .eq('register_id', r.id).gte('erstellt_am', `${gestern}T00:00:00`).lte('erstellt_am', `${gestern}T23:59:59`);
    if (count && count > 0) continue;

    // Summen aus pos_transactions vom Vortag
    const { data: txs } = await svc.from('pos_transactions').select('*')
      .eq('register_id', r.id)
      .gte('created_at', `${gestern}T00:00:00`)
      .lte('created_at', `${gestern}T23:59:59`);

    const rows = (txs as any[]) ?? [];
    if (rows.length === 0) continue;

    const summeBar = rows.filter((t) => t.zahlungsart === 'bar').reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const summeKarte = rows.filter((t) => t.zahlungsart === 'karte').reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const summeOnline = rows.filter((t) => t.zahlungsart === 'online').reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const summeGesamt = summeBar + summeKarte + summeOnline;

    // Z-Nummer: DB-Sequence + Trigger `set_z_nr_seq` füllt z_nr_seq lückenlos
    // (alte z_nr bleibt für Register-lokale Anzeige, Sequence für DSFinV-K)
    const { count: prevZ } = await svc.from('pos_z_reports').select('id', { count: 'exact', head: true }).eq('register_id', r.id);
    const zNr = (prevZ ?? 0) + 1;

    await svc.from('pos_z_reports').insert({
      tenant_id: r.tenant_id,
      location_id: r.location_id,
      register_id: r.id,
      z_nr: zNr,
      typ: 'automatisch',
      summe_bar: summeBar,
      summe_karte: summeKarte,
      summe_online: summeOnline,
      summe_gesamt: summeGesamt,
      anzahl_transaktionen: rows.filter((t) => t.typ === 'verkauf').length,
      start_transaction_id: rows[0]?.id,
      ende_transaction_id: rows[rows.length - 1]?.id,
      erstellt_am: `${gestern}T23:59:59`,
    });

    created++;
  }

  return NextResponse.json({
    ok: true,
    shifts_closed: closed ?? 0,
    z_reports_created: created,
    for_date: gestern,
  });
}
