'use client';

import { AlertTriangle, Calendar, CheckCircle2, Download, FileText, Shield } from 'lucide-react';
import { euro } from '@/lib/utils';

type Tenant = {
  name: string; steuernummer: string | null; ust_id: string | null;
  stadt: string | null; adresse: string | null; plz: string | null;
  fiskaly_tss_id: string | null; fiskaly_environment: string | null;
};

export function PruefungView({
  token, tenant, pruefer, registers, transactions, zReports, outages, auditCount,
}: {
  token: string;
  tenant: Tenant;
  pruefer: { name: string | null; amt: string | null; gueltig_bis: string };
  registers: any[];
  transactions: any[];
  zReports: any[];
  outages: any[];
  auditCount: number;
}) {
  const gueltigBis = new Date(pruefer.gueltig_bis).toLocaleString('de-DE');
  const totalBrutto = transactions.reduce((s, t) => s + Number(t.brutto_gesamt ?? 0), 0);
  const stornoCount = transactions.filter((t) => t.typ === 'storno').length;
  const trainingCount = transactions.filter((t) => t.trainingsbon).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-red-700 text-white py-4 px-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">§ 146b AO · Kassen-Nachschau</div>
            <h1 className="font-display text-2xl font-black">Read-Only-Zugang für Finanzbeamte</h1>
          </div>
          <div className="text-right text-xs">
            <div>Gültig bis: <strong className="font-mono">{gueltigBis}</strong></div>
            {pruefer.name && <div>Prüfer: <strong>{pruefer.name}</strong></div>}
            {pruefer.amt && <div>{pruefer.amt}</div>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-5 space-y-5">
        {/* Unternehmen */}
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-display text-lg font-bold mb-3">Unternehmen</h2>
          <div className="grid gap-2 text-sm">
            <Row label="Name" value={tenant.name} />
            <Row label="Adresse" value={[tenant.adresse, tenant.plz, tenant.stadt].filter(Boolean).join(', ')} />
            <Row label="Steuernummer" value={tenant.steuernummer} />
            <Row label="USt-IdNr" value={tenant.ust_id} />
          </div>
        </section>

        {/* TSE */}
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" /> TSE (KassenSichV)
          </h2>
          <div className="grid gap-2 text-sm">
            <Row label="TSS-ID" value={tenant.fiskaly_tss_id} mono />
            <Row label="Umgebung" value={tenant.fiskaly_environment?.toUpperCase() ?? '—'} />
            <Row label="Provider" value="fiskaly Cloud-TSE · BSI-TR-03153" />
            <Row label="Aktive TSE-Ausfälle" value={outages.filter((o) => !o.end_at).length > 0 ? '⚠️ ' + outages.filter((o) => !o.end_at).length : '0'} />
          </div>
          {outages.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-semibold">TSE-Ausfall-Log ({outages.length})</summary>
              <div className="mt-2 space-y-1 font-mono text-[11px]">
                {outages.map((o) => (
                  <div key={o.id}>
                    {new Date(o.start_at).toLocaleString('de-DE')}
                    {o.end_at ? ` – ${new Date(o.end_at).toLocaleString('de-DE')}` : ' – aktiv'}
                    · {o.reason}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* Kassen */}
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-display text-lg font-bold mb-3">Registrierkassen ({registers.length})</h2>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500">
              <tr className="border-b">
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Kassen-ID</th>
                <th className="text-left py-2">Angelegt</th>
              </tr>
            </thead>
            <tbody>
              {registers.map((r) => (
                <tr key={r.id} className="border-b text-xs">
                  <td className="py-2 font-bold">{r.name}</td>
                  <td className="py-2 font-mono">{r.id}</td>
                  <td className="py-2">{new Date(r.created_at).toLocaleDateString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Zusammenfassung */}
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Transaktionen (30T)" value={transactions.length} />
          <Stat label="Umsatz Brutto" value={euro(totalBrutto)} />
          <Stat label="Stornos" value={stornoCount} warn={stornoCount > 0} />
          <Stat label="Audit-Einträge" value={auditCount} />
        </div>

        {/* Z-Berichte */}
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-display text-lg font-bold mb-3">Z-Berichte (letzte 30 Tage)</h2>
          {zReports.length === 0 ? (
            <div className="text-sm text-gray-500">Keine Z-Berichte im Zeitraum</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                <tr className="border-b">
                  <th className="text-left py-2">Z-Nr</th>
                  <th className="text-left py-2">Datum</th>
                  <th className="text-right py-2">Bar</th>
                  <th className="text-right py-2">Karte</th>
                  <th className="text-right py-2">Online</th>
                  <th className="text-right py-2">Gesamt</th>
                  <th className="text-right py-2">Anz.</th>
                </tr>
              </thead>
              <tbody>
                {zReports.map((z) => (
                  <tr key={z.id} className="border-b">
                    <td className="py-2 font-mono font-bold">{z.z_nr ?? '-'}</td>
                    <td className="py-2">{new Date(z.erstellt_am).toLocaleString('de-DE')}</td>
                    <td className="py-2 text-right">{euro(z.summe_bar ?? 0)}</td>
                    <td className="py-2 text-right">{euro(z.summe_karte ?? 0)}</td>
                    <td className="py-2 text-right">{euro(z.summe_online ?? 0)}</td>
                    <td className="py-2 text-right font-bold">{euro(z.summe_gesamt ?? 0)}</td>
                    <td className="py-2 text-right">{z.anzahl_transaktionen ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Transaktionen — letzte 100 */}
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-display text-lg font-bold mb-3">Transaktionen (letzte 500)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-gray-500 sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2">Zeit</th>
                  <th className="text-left py-2">Typ</th>
                  <th className="text-left py-2">BON-ID</th>
                  <th className="text-right py-2">Brutto</th>
                  <th className="text-left py-2">Zahlung</th>
                  <th className="text-left py-2">TSE-Sig</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 100).map((t) => (
                  <tr key={t.id} className={`border-b ${t.trainingsbon ? 'bg-amber-50' : ''} ${t.typ === 'storno' ? 'bg-red-50' : ''}`}>
                    <td className="py-1.5 font-mono">{new Date(t.created_at).toLocaleString('de-DE')}</td>
                    <td className="py-1.5">{t.trainingsbon ? '🎓 Training' : t.typ}</td>
                    <td className="py-1.5 font-mono">{t.id.slice(0, 8)}</td>
                    <td className={`py-1.5 text-right font-bold ${t.typ === 'storno' ? 'text-red-700' : ''}`}>{euro(t.brutto_gesamt)}</td>
                    <td className="py-1.5">{t.zahlungsart}</td>
                    <td className="py-1.5">{t.tse_signature ? <CheckCircle2 className="h-3 w-3 text-matcha-700" /> : <AlertTriangle className="h-3 w-3 text-amber-700" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length > 100 && (
            <div className="mt-2 text-xs text-gray-500">
              Weitere {transactions.length - 100} Einträge — bitte vollständigen Export anfordern
            </div>
          )}
        </section>

        {/* Exports */}
        <section className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Download className="h-5 w-5" /> Datenexport für Außenprüfung
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={`/api/pruefung/${token}/dsfinvk?from=${new Date(Date.now() - 365*24*3600*1000).toISOString().slice(0,10)}&to=${new Date().toISOString().slice(0,10)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-3 text-sm font-bold hover:bg-gray-800">
              <FileText className="h-4 w-4" /> DSFinV-K 2.4 (letzte 12 Monate)
            </a>
            <a href={`/api/pruefung/${token}/meldepaket`}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-900 bg-white text-gray-900 px-4 py-3 text-sm font-bold hover:bg-gray-50">
              <FileText className="h-4 w-4" /> § 146a Meldepaket XML
            </a>
          </div>
        </section>

        <footer className="text-xs text-gray-500 text-center py-4">
          <Calendar className="inline h-3 w-3 mr-1" />
          Token läuft ab am {gueltigBis} · danach kein weiterer Zugriff ohne Neu-Freigabe durch Inhaber
        </footer>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b last:border-0 py-1">
      <div className="w-32 text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`flex-1 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border-2 p-4 ${warn ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-black">{value}</div>
    </div>
  );
}
