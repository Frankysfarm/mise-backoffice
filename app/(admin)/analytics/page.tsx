import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { AnalyticsDashboard } from './client';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empT } = await sb.from('employees').select('tenant_id, location_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const last14 = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const last30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const prev30 = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // 1) Alle Filialen des Tenants
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('tenant_id', empT.tenant_id);
  const locIds = ((locs as any[]) ?? []).map((l) => l.id);

  // Parallele Abfragen
  const [ordersAll, pos30, prev30Pos, topItems, driversOnline, activeEmployees, vouchersRedeemed, campaignsStats] = await Promise.all([
    // Alle customer_orders letzte 30 Tage für Kanal/Zahlung/Zeitreihen
    svc
      .from('customer_orders')
      .select('bestellnummer,status,typ,gesamtbetrag,zahlungsart,bezahlt,bestellt_am,external_source')
      .in('location_id', locIds.length > 0 ? locIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('bestellt_am', last30),
    // POS-Transaktionen (Direktverkauf) letzte 30 Tage
    svc
      .from('pos_transactions')
      .select('brutto_gesamt,zahlungsart,created_at,typ,storniert')
      .gte('created_at', last30)
      .in('typ', ['verkauf']),
    // POS Vorperiode (30-60 Tage)
    svc
      .from('pos_transactions')
      .select('brutto_gesamt')
      .gte('created_at', prev30).lt('created_at', last30)
      .in('typ', ['verkauf']),
    // Top-Seller aus order_items letzte 30 Tage
    svc
      .from('order_items')
      .select('name, menge, einzelpreis, order:customer_orders!inner(location_id,bestellt_am)')
      .gte('order.bestellt_am', last30),
    // Online-Fahrer aktuell
    svc
      .from('driver_status')
      .select('*, employee:employees!inner(tenant_id)')
      .eq('employee.tenant_id', empT.tenant_id)
      .eq('ist_online', true),
    // Aktive Mitarbeiter im Tenant
    svc.from('employees').select('id', { count: 'exact', head: true })
      .eq('tenant_id', empT.tenant_id).eq('status', 'aktiv'),
    // Voucher-Einlösungen
    svc.from('voucher_redemptions').select('rabatt_betrag, created_at, voucher:vouchers!inner(tenant_id)')
      .eq('voucher.tenant_id', empT.tenant_id)
      .gte('created_at', last30),
    // Kampagnen-Performance
    svc.from('email_campaigns').select('versendet_count, geoeffnet_count, geklickt_count')
      .eq('tenant_id', empT.tenant_id)
      .eq('status', 'gesendet'),
  ]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Umsatz · Top-Seller · Kanäle · Zahlungsarten — letzte 30 Tage`}
      />
      <AnalyticsDashboard
        orders={(ordersAll.data as any[]) ?? []}
        pos={(pos30.data as any[]) ?? []}
        posPrev={(prev30Pos.data as any[]) ?? []}
        topItems={(topItems.data as any[]) ?? []}
        onlineDrivers={(driversOnline.data as any[])?.length ?? 0}
        activeEmployees={activeEmployees.count ?? 0}
        redemptions={(vouchersRedeemed.data as any[]) ?? []}
        campaigns={(campaignsStats.data as any[]) ?? []}
        today={today}
      />
    </>
  );
}
