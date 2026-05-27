import QRCode from 'qrcode';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PrintButton } from './print-button';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Table = { id: string; nummer: string; name: string | null; bereich: string | null; qr_token: string; aktiv: boolean };
type Tenant = { name: string; slug: string; theme_primary: string | null };

export default async function PrintAllQrPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: tablesRaw }, { data: tenantRaw }] = await Promise.all([
    svc.from('restaurant_tables').select('id, nummer, name, bereich, qr_token, aktiv')
      .eq('location_id', empRow.location_id).eq('aktiv', true).order('sort_order'),
    svc.from('tenants').select('name, slug, theme_primary').eq('id', empRow.tenant_id).single(),
  ]);

  const tables = (tablesRaw as Table[]) ?? [];
  const tenant = (tenantRaw as Tenant) ?? { name: 'Restaurant', slug: '', theme_primary: '#14532d' };
  const primary = tenant.theme_primary ?? '#14532d';

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'mise-gastro.de';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  const cards = await Promise.all(tables.map(async (t) => {
    const url = `${origin}/t/${t.qr_token}`;
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: '#0d1f16', light: '#ffffff' } });
    return { table: t, dataUrl };
  }));

  const styles = `
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
      body { margin: 0; background: white; }
      .no-print { display: none !important; }
      .card { break-inside: avoid; page-break-inside: avoid; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #f5f5f0; padding: 1.5rem; margin: 0; color: #0d1f16; }
    .toolbar { max-width: 1200px; margin: 0 auto 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .toolbar h1 { font-size: 1.25rem; margin: 0; font-weight: 800; }
    .toolbar p { margin: .25rem 0 0; font-size: .875rem; color: #555; }
    .grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
    .card { background: white; border-radius: 1.25rem; padding: 1.5rem; text-align: center; border: 2px solid var(--primary); }
    .brand { font-size: .7rem; letter-spacing: .25em; text-transform: uppercase; color: var(--primary); font-weight: 800; }
    .name { font-size: 1.1rem; font-weight: 800; margin: .25rem 0 .75rem; }
    .qr { background: white; padding: .5rem; border-radius: .75rem; display: inline-block; }
    .qr img { width: 220px; height: 220px; display: block; }
    .tisch-label { margin-top: 1rem; font-size: .65rem; text-transform: uppercase; letter-spacing: .2em; color: #666; font-weight: 700; }
    .tisch { font-size: 2.25rem; font-weight: 900; color: var(--primary); letter-spacing: -.02em; line-height: 1; }
    .bereich { margin-top: .25rem; font-size: .75rem; color: #888; }
    .empty { max-width: 1200px; margin: 4rem auto; padding: 3rem; text-align: center; background: white; border-radius: 1rem; border: 2px dashed #ccc; }
  `;

  return (
    <div style={{ '--primary': primary } as React.CSSProperties}>
      <style>{styles}</style>
      <div className="toolbar no-print">
        <div>
          <h1>{tenant.name} · Alle QR-Codes ({cards.length})</h1>
          <p>Druckt alle aktiven Tische auf einmal. A4 hochformat, 2 Karten pro Seite.</p>
        </div>
        <PrintButton color={primary} />
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          <p>Noch keine aktiven Tische angelegt.</p>
        </div>
      ) : (
        <div className="grid">
          {cards.map(({ table, dataUrl }) => (
            <div key={table.id} className="card">
              <div className="brand">{tenant.name}</div>
              {table.name ? <div className="name">{table.name}</div> : null}
              <div className="qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUrl} alt={`QR Tisch ${table.nummer}`} />
              </div>
              <div className="tisch-label">Tisch</div>
              <div className="tisch">{table.nummer}</div>
              {table.bereich ? <div className="bereich">{table.bereich}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
