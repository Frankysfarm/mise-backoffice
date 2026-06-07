import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kunden · Mise' };

function euro(n: number | null | undefined) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n ?? 0));
}

export default async function CustomersPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');
  const tenantId = empRow.tenant_id;

  const [{ data: customers }, { count: total }] = await Promise.all([
    svc
      .from('customer_profiles')
      .select('id, name, email, telefon, anzahl_bestellungen, umsatz_total, bonus_points, letzter_besuch, created_at')
      .eq('tenant_id', tenantId)
      .order('umsatz_total', { ascending: false })
      .limit(100),
    svc
      .from('customer_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ]);

  const list = customers ?? [];

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Alle Kunden die schon bei dir bestellt haben — sortiert nach Umsatz."
      />

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-display text-lg font-bold">{total ?? 0} Kunden insgesamt</div>
            <div className="text-sm text-muted-foreground">Top 100 angezeigt</div>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Noch keine Kunden — sobald jemand bestellt erscheint er hier.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">E-Mail</th>
                  <th className="py-2 pr-4">Telefon</th>
                  <th className="py-2 pr-4 text-right">Bestellungen</th>
                  <th className="py-2 pr-4 text-right">Umsatz</th>
                  <th className="py-2 pr-4 text-right">Bonus-Punkte</th>
                  <th className="py-2 pr-4">Letzter Besuch</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="py-3 pr-4 font-semibold">{c.name ?? '—'}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.email ?? '—'}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.telefon ?? '—'}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{c.anzahl_bestellungen ?? 0}</td>
                    <td className="py-3 pr-4 text-right tabular-nums font-bold">{euro(c.umsatz_total)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{c.bonus_points ?? 0}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {c.letzter_besuch ? new Date(c.letzter_besuch).toLocaleDateString('de-DE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Datenschutz: Kundendaten werden ausschließlich für deine Bestellabwicklung gespeichert. Du kannst sie jederzeit auf Anfrage löschen lassen.
      </div>
    </>
  );
}
