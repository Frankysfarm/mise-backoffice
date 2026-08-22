import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Download, FileText, Shield, Send,
} from 'lucide-react';
import { WormBackupCard } from './worm-card';

export const dynamic = 'force-dynamic';

export default async function LegalPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc.from('tenants')
    .select('fiskaly_tss_id, fiskaly_client_id, fiskaly_environment, steuernummer, ust_id')
    .eq('id', empRow.tenant_id).single();

  const { count: txCount } = await svc.from('pos_transactions').select('id', { count: 'exact', head: true })
    .eq('tenant_id', empRow.tenant_id);
  const { count: outages } = await svc.from('tse_outage_log').select('id', { count: 'exact', head: true })
    .eq('tenant_id', empRow.tenant_id).is('end_at', null);

  const tseActive = Boolean(tenant?.fiskaly_tss_id && tenant?.fiskaly_client_id);
  const stammdatenOk = Boolean(tenant?.steuernummer || tenant?.ust_id);

  const items = [
    {
      title: 'TSE (KassenSichV)',
      desc: 'Cloud-TSE eingerichtet, jede Transaktion wird signiert',
      icon: <Shield />,
      ok: tseActive,
      href: '/settings/tse',
      critical: true,
    },
    {
      title: 'Stammdaten vollständig',
      desc: 'Steuernummer oder USt-ID muss auf jedem Bon stehen',
      icon: <FileText />,
      ok: stammdatenOk,
      href: '/settings/restaurant',
      critical: true,
    },
    {
      title: 'TSE-Ausfall aktuell',
      desc: outages && outages > 0 ? `${outages} aktive Ausfallphasen — unverzüglich beheben` : 'Alles stabil',
      icon: <AlertTriangle />,
      ok: !outages || outages === 0,
      href: '/settings/tse',
      critical: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="Rechtskonformität (DE)"
        description="Alles was dein POS für KassenSichV, GoBD und DSGVO braucht."
      />

      {/* Status-Check */}
      <div className="grid gap-3 md:grid-cols-3 mb-6">
        {items.map((i, idx) => (
          <Card key={idx} className={`p-4 ${i.ok ? 'bg-matcha-50 border-matcha-300' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${i.ok ? 'bg-matcha-700 text-white' : 'bg-amber-500 text-white'}`}>
                {i.ok ? <CheckCircle2 className="h-5 w-5" /> : i.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm">{i.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{i.desc}</div>
                <Link href={i.href} className="mt-2 text-xs font-semibold inline-flex items-center gap-1 text-matcha-800 hover:underline">
                  Prüfen <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Export-Bereich */}
      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">DSFinV-K Export</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              ZIP mit allen CSVs für Kassen-Nachschau (§ 146b AO) oder Außenprüfung.
              Zeitraum bestimmen, auf USB-Stick oder an Finanzbeamten übergeben.
            </p>
          </div>
        </div>
        <form action="/api/pos/dsfinvk/export" method="GET" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Von</label>
            <input type="date" name="from" defaultValue={`${new Date().getFullYear()}-01-01`} className="mt-1 h-10 rounded-lg border bg-background px-3 font-mono text-sm block" required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bis</label>
            <input type="date" name="to" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 h-10 rounded-lg border bg-background px-3 font-mono text-sm block" required />
          </div>
          <button type="submit" className="h-10 px-5 rounded-xl bg-gray-900 text-white text-sm font-bold inline-flex items-center gap-2">
            <Download className="h-4 w-4" /> ZIP erstellen
          </button>
        </form>
      </Card>

      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">§ 146a Meldepaket (ELSTER)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Seit 2025 muss jede Kasse innerhalb 1 Monat beim Finanzamt gemeldet werden.
              XML herunterladen und über <strong>ELSTER → Sonstige Formulare → Mitteilung nach § 146a Abs. 4 AO</strong> hochladen.
            </p>
          </div>
        </div>
        <a href="/api/pos/meldepaket" className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-5 py-2 text-sm font-bold">
          <Download className="h-4 w-4" /> Meldepaket-XML holen
        </a>
        <div className="mt-2 text-xs text-muted-foreground">
          Nicht vergessen: Bei jeder neuen Kasse + bei Außerbetriebnahme erneut melden.
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Verfahrensdokumentation (GoBD)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pflicht bei Außenprüfung. Auto-generiert aus Systemdaten — drucken, vom Inhaber ergänzen, archivieren.
            </p>
          </div>
        </div>
        <a href="/api/pos/verfahrensdoku" target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-5 py-2 text-sm font-bold">
          <Download className="h-4 w-4" /> Verfahrensdoku öffnen
        </a>
      </Card>

      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-600 text-white grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Kassen-Nachschau (§ 146b AO)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Finanzbeamter vor der Tür? Temporären Read-Only-Zugang anlegen (max. 24 h, jederzeit widerrufbar).
            </p>
          </div>
        </div>
        <Link href="/settings/kassenpruefung" className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-5 py-2 text-sm font-bold">
          Nachschau-Zugang verwalten <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>

      <WormBackupCard tenantId={empRow.tenant_id} />

      <Card className="p-5">
        <h3 className="font-display text-lg font-bold mb-2">Aufbewahrungsfrist</h3>
        <p className="text-sm text-muted-foreground">
          Alle TSE-Signaturen, Transaktionen, Belege und Audit-Logs werden für <strong>10 Jahre</strong> unveränderlich gespeichert
          ({txCount ?? 0} Transaktionen aktuell). Bei Kontroll-Anforderung → DSFinV-K Export oben.
        </p>
      </Card>
    </>
  );
}
