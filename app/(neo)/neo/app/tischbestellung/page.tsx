import { redirect } from 'next/navigation';
import { ArrowUpRight, CreditCard, Layers, MonitorDot, QrCode } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { TischbestellungClient } from './client';

export const dynamic = 'force-dynamic';

export default async function TischbestellungPage() {
  const employee = await requireManagerPlus();
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: employeeRow } = await supabase
    .from('employees')
    .select('tenant_id,location_id')
    .eq('id', employee.id)
    .maybeSingle();
  if (!employeeRow?.tenant_id || !employeeRow.location_id) redirect('/start');

  const [{ data: tables }, { data: tenant }, { count: menuCount }, { data: payments }] = await Promise.all([
    service.from('restaurant_tables').select('*').eq('location_id', employeeRow.location_id).order('sort_order'),
    service.from('tenants').select('slug,name').eq('id', employeeRow.tenant_id).maybeSingle(),
    service.from('menu_items').select('id', { count: 'exact', head: true }).eq('location_id', employeeRow.location_id).eq('verfuegbar', true),
    service.from('tenant_payment_methods').select('method,enabled_lieferung,enabled_abholung,enabled_vor_ort').eq('tenant_id', employeeRow.tenant_id),
  ]);

  const tableList = (tables ?? []) as any[];
  const activeTables = tableList.filter((table) => table.aktiv);
  const paymentCount = (payments ?? []).filter((payment: any) => payment.enabled_lieferung || payment.enabled_abholung || payment.enabled_vor_ort).length;
  const previewUrl = activeTables[0]?.qr_token ? `/t/${activeTables[0].qr_token}` : null;

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{
        position: 'relative', overflow: 'hidden', marginBottom: 18, borderRadius: 18,
        background: 'linear-gradient(120deg,#1E1B4B,#312E81 58%,#4F46E5)',
        padding: '22px 26px', color: '#fff',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .55, backgroundImage: 'radial-gradient(circle at 1px 1px,rgba(255,255,255,.12) 1px,transparent 0)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
            <QrCode size={27} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#C7D2FE', letterSpacing: '.55px', marginBottom: 5 }}>TISCHBESTELLUNG · LIVE MIT DER LIEFERZENTRALE VERBUNDEN</div>
            <h2 style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 21, fontWeight: 700, letterSpacing: '-.35px' }}>QR scannen, bestellen, direkt in der Zentrale bearbeiten</h2>
            <p style={{ color: '#C7D2FE', fontSize: 13.5, marginTop: 5 }}>Jeder Tisch hat einen festen QR-Code. Neue Bestellungen landen im selben blauen Arbeitsbereich wie Lieferung und Abholung.</p>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" style={{ height: 40, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.22)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Gastansicht <ArrowUpRight size={14} /></a>}
            <a href="/neo/app/lieferzentrale" style={{ height: 40, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 15px', borderRadius: 10, background: '#fff', color: '#312E81', textDecoration: 'none', fontSize: 13, fontWeight: 800 }}>Lieferzentrale <ArrowUpRight size={14} /></a>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14, marginBottom: 22 }}>
        <Metric icon={<QrCode size={19} />} tint="#EEF2FF" color="#4F46E5" value={String(activeTables.length)} label="Aktive Tische" detail={`${tableList.length} insgesamt`} />
        <Metric icon={<Layers size={19} />} tint="#FEF3C7" color="#D97706" value={String(menuCount ?? 0)} label="Verfügbare Artikel" detail="aus der Speisekarte" />
        <Metric icon={paymentCount ? <CreditCard size={19} /> : <MonitorDot size={19} />} tint="#F5F3FF" color="#7C3AED" value={String(paymentCount)} label="Aktive Zahlungsarten" detail="in Neo verwaltbar" />
      </div>

      <TischbestellungClient
        tables={tableList}
        tenantId={employeeRow.tenant_id}
        locationId={employeeRow.location_id}
        slug={tenant?.slug ?? ''}
      />
    </div>
  );
}

function Metric({ icon, tint, color, value, label, detail }: { icon: React.ReactNode; tint: string; color: string; value: string; label: string; detail: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 15, padding: '15px 17px' }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: tint, color, display: 'grid', placeItems: 'center' }}>{icon}</span>
      <div><div style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 21, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>{value}</div><div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginTop: 4 }}>{label}</div><div style={{ fontSize: 11.5, color: '#94A3B8' }}>{detail}</div></div>
    </div>
  );
}
