'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { Banknote, Check, CreditCard, FileText, Minus, Plus, Printer, Smartphone, TrendingUp } from 'lucide-react';

type Register = { id: string; name: string; location_id: string; startbestand: number };

type Transaction = {
  id: string;
  typ: string;
  bon_nummer: string;
  netto_gesamt: number;
  mwst_7: number;
  mwst_19: number;
  brutto_gesamt: number;
  zahlungsart: string;
  storniert: boolean;
  created_at: string;
};

export function ZReportClient({ registers }: { registers: Register[] }) {
  const supabase = createClient();
  const [registerId, setRegisterId] = useState<string>(registers[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [istBestand, setIstBestand] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ z_nummer: number; created_at: string } | null>(null);
  const [existingReport, setExistingReport] = useState<any>(null);

  useEffect(() => {
    if (!registerId || !date) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerId, date]);

  async function load() {
    setLoading(true);
    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();

    const [{ data: trans }, { data: report }] = await Promise.all([
      supabase
        .from('pos_transactions')
        .select('id,typ,bon_nummer,netto_gesamt,mwst_7,mwst_19,brutto_gesamt,zahlungsart,storniert,created_at')
        .eq('register_id', registerId)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: true }),
      supabase
        .from('pos_z_reports')
        .select('*')
        .eq('register_id', registerId)
        .eq('datum', date)
        .maybeSingle(),
    ]);
    setTransactions((trans as any) ?? []);
    setExistingReport(report);
    setLoading(false);
  }

  const summary = useMemo(() => {
    const verkauf = transactions.filter((t) => t.typ === 'verkauf' && !t.storniert);
    const storno = transactions.filter((t) => t.typ === 'storno');
    const einlagen = transactions.filter((t) => t.typ === 'einlage');
    const entnahmen = transactions.filter((t) => t.typ === 'entnahme');
    const trinkgeld = transactions.filter((t) => t.typ === 'trinkgeld');

    const umsatz_brutto = verkauf.reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const umsatz_netto = verkauf.reduce((s, t) => s + Number(t.netto_gesamt), 0);
    const mwst_7_summe = verkauf.reduce((s, t) => s + Number(t.mwst_7 ?? 0), 0);
    const mwst_19_summe = verkauf.reduce((s, t) => s + Number(t.mwst_19 ?? 0), 0);

    const bar = verkauf.filter((t) => t.zahlungsart === 'bar').reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const karte = verkauf.filter((t) => t.zahlungsart === 'karte').reduce((s, t) => s + Number(t.brutto_gesamt), 0);
    const digital = verkauf.filter((t) => t.zahlungsart === 'digital').reduce((s, t) => s + Number(t.brutto_gesamt), 0);

    const storno_betrag = Math.abs(storno.reduce((s, t) => s + Number(t.brutto_gesamt), 0));
    const einlagen_summe = einlagen.reduce((s, t) => s + Math.abs(Number(t.brutto_gesamt)), 0);
    const entnahmen_summe = entnahmen.reduce((s, t) => s + Math.abs(Number(t.brutto_gesamt)), 0);
    const trinkgeld_summe = trinkgeld.reduce((s, t) => s + Math.abs(Number(t.brutto_gesamt)), 0);

    const register = registers.find((r) => r.id === registerId);
    const anfangsbestand = Number(register?.startbestand ?? 0);
    // Sollbestand = Start + Bar-Einnahmen + Einlagen + Trinkgeld-Bar - Entnahmen
    const soll = anfangsbestand + bar + einlagen_summe + trinkgeld_summe - entnahmen_summe;

    return {
      bon_anzahl: verkauf.length,
      erster_bon: verkauf[0]?.bon_nummer ?? '—',
      letzter_bon: verkauf[verkauf.length - 1]?.bon_nummer ?? '—',
      umsatz_brutto,
      umsatz_netto,
      mwst_7_summe,
      mwst_19_summe,
      bar,
      karte,
      digital,
      storno_anzahl: storno.length,
      storno_betrag,
      einlagen: einlagen_summe,
      entnahmen: entnahmen_summe,
      trinkgeld: trinkgeld_summe,
      anfangsbestand,
      soll,
    };
  }, [transactions, registerId, registers]);

  const ist = parseFloat(istBestand.replace(',', '.')) || 0;
  const differenz = ist - summary.soll;

  async function abschliessen() {
    if (!registerId || existingReport) return;
    setSaving(true);
    try {
      const register = registers.find((r) => r.id === registerId);
      const { data } = await supabase
        .from('pos_z_reports')
        .insert({
          register_id: registerId,
          location_id: register?.location_id,
          datum: date,
          umsatz_brutto: summary.umsatz_brutto,
          umsatz_netto: summary.umsatz_netto,
          mwst_7_summe: summary.mwst_7_summe,
          mwst_19_summe: summary.mwst_19_summe,
          bar_einnahmen: summary.bar,
          karten_einnahmen: summary.karte,
          digital_einnahmen: summary.digital,
          anfangsbestand: summary.anfangsbestand,
          einlagen: summary.einlagen,
          entnahmen: summary.entnahmen,
          soll_bestand: summary.soll,
          ist_bestand: ist,
          differenz,
          storno_anzahl: summary.storno_anzahl,
          storno_betrag: summary.storno_betrag,
          trinkgeld_gesamt: summary.trinkgeld,
          bon_anzahl: summary.bon_anzahl,
          erster_bon: summary.erster_bon,
          letzter_bon: summary.letzter_bon,
          abgeschlossen: true,
          abgeschlossen_am: new Date().toISOString(),
        } as any)
        .select('z_nummer,created_at')
        .single();
      if (data) {
        setSaved({ z_nummer: (data as any).z_nummer, created_at: (data as any).created_at });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  const frozen = !!existingReport || !!saved;
  const current = existingReport ?? (saved ? { ...summary, z_nummer: saved.z_nummer, ist_bestand: ist, differenz } : null);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        <select
          value={registerId}
          onChange={(e) => setRegisterId(e.target.value)}
          className="h-10 rounded-lg border bg-card px-3 text-sm font-medium"
        >
          {registers.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-lg border bg-card px-3 text-sm font-medium"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Printer size={14} /> Drucken
          </button>
        </div>
      </div>

      {frozen && current && (
        <div className="rounded-xl border-2 border-matcha-500 bg-matcha-50 p-4 flex items-center gap-3 no-print">
          <div className="h-10 w-10 rounded-full bg-matcha-500 text-white flex items-center justify-center">
            <Check size={20} />
          </div>
          <div>
            <div className="font-bold font-display">Z-Bericht {current.z_nummer ?? '—'} abgeschlossen</div>
            <div className="text-xs text-muted-foreground">
              Am {new Date(saved?.created_at ?? existingReport?.created_at).toLocaleString('de-DE')}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] print:grid-cols-1">
        {/* Haupt-Report */}
        <article className="rounded-2xl border bg-card p-6 print:border-0 print:p-0">
          <header className="border-b pb-4 mb-5 print:border-black">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">Z-Bericht</h2>
                <div className="text-sm text-muted-foreground mt-1">
                  {registers.find((r) => r.id === registerId)?.name} · {new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                Z-Nr.: <span className="font-bold text-foreground">{current?.z_nummer ?? '(entwurf)'}</span>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Lade …</div>
          ) : (
            <div className="space-y-6">
              <Section title="Umsatz">
                <Row label={`Bons`} value={summary.bon_anzahl.toString()} />
                <Row label="Erster Bon" value={summary.erster_bon} mono />
                <Row label="Letzter Bon" value={summary.letzter_bon} mono />
                <Row label="Netto-Umsatz" value={euro(summary.umsatz_netto)} />
                <Row label="MwSt 7 %" value={euro(summary.mwst_7_summe)} />
                <Row label="MwSt 19 %" value={euro(summary.mwst_19_summe)} />
                <Row label="Brutto-Umsatz" value={euro(summary.umsatz_brutto)} bold />
              </Section>

              <Section title="Zahlungsarten">
                <Row label="Bar" icon={<Banknote size={14} />} value={euro(summary.bar)} />
                <Row label="Karte" icon={<CreditCard size={14} />} value={euro(summary.karte)} />
                <Row label="Digital" icon={<Smartphone size={14} />} value={euro(summary.digital)} />
              </Section>

              <Section title="Kassenbewegungen">
                <Row label="Anfangsbestand" value={euro(summary.anfangsbestand)} />
                <Row label="Einlagen" icon={<Plus size={12} />} value={`+ ${euro(summary.einlagen)}`} positive={summary.einlagen > 0} />
                <Row label="Entnahmen" icon={<Minus size={12} />} value={`− ${euro(summary.entnahmen)}`} negative={summary.entnahmen > 0} />
                <Row label="Trinkgeld (Kasse)" value={euro(summary.trinkgeld)} />
                <Row label="Sollbestand" value={euro(summary.soll)} bold />
              </Section>

              <Section title="Sonstiges">
                <Row label="Stornierungen" value={`${summary.storno_anzahl} · ${euro(summary.storno_betrag)}`} />
              </Section>

              <div className="border-t-2 border-dashed pt-4 print:border-black">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 print:block">Ist-Zählung (Bargeld)</div>
                {frozen ? (
                  <div className="grid grid-cols-3 gap-4">
                    <IstBlock label="Ist-Bestand" value={euro(current.ist_bestand ?? 0)} />
                    <IstBlock label="Sollbestand" value={euro(current.soll_bestand ?? summary.soll)} />
                    <IstBlock label="Differenz" value={euro(current.differenz ?? 0)} tone={Number(current.differenz) < -0.01 ? 'neg' : Number(current.differenz) > 0.01 ? 'pos' : 'neutral'} />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 no-print">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Bargeld gezählt</label>
                      <input
                        value={istBestand}
                        onChange={(e) => setIstBestand(e.target.value)}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder={summary.soll.toFixed(2)}
                        className="w-full h-12 rounded-xl border bg-background px-3 text-xl font-bold font-display focus:outline-none focus:ring-2 focus:ring-matcha-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Soll</label>
                      <div className="h-12 flex items-center px-3 bg-muted rounded-xl text-xl font-bold font-display">
                        {euro(summary.soll)}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Differenz</label>
                      <div className={cn(
                        'h-12 flex items-center px-3 rounded-xl text-xl font-bold font-display',
                        differenz < -0.01 ? 'bg-red-50 text-red-700' :
                        differenz > 0.01 ? 'bg-gold/20 text-matcha-900' :
                        'bg-matcha-50 text-matcha-700',
                      )}>
                        {istBestand ? euro(differenz) : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <footer className="text-[11px] text-muted-foreground border-t pt-4 space-y-1 print:border-black">
                <div>Ausgestellt am {frozen ? new Date(saved?.created_at ?? existingReport?.created_at).toLocaleString('de-DE') : new Date().toLocaleString('de-DE')}</div>
                <div>TSE: <span className="font-mono">{existingReport?.tse_z_report_id ?? 'Platzhalter — KassSichV-Integration ausstehend'}</span></div>
                <div className="italic">Dieser Z-Bericht ist nach GoBD aufzubewahren (10 Jahre).</div>
              </footer>
            </div>
          )}
        </article>

        {/* Abschluss-Sidebar */}
        <aside className="space-y-4 no-print">
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-display font-bold flex items-center gap-2 mb-4">
              <TrendingUp size={16} /> Tagesübersicht
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <KPI label="Umsatz" value={euro(summary.umsatz_brutto)} />
              <KPI label="Bons" value={summary.bon_anzahl.toString()} />
              <KPI label="⌀ Bon" value={euro(summary.bon_anzahl > 0 ? summary.umsatz_brutto / summary.bon_anzahl : 0)} />
              <KPI label="Stornos" value={summary.storno_anzahl.toString()} />
            </div>
          </div>

          {!frozen && (
            <div className="rounded-2xl border-2 border-dashed border-matcha-500/30 p-5 bg-matcha-50/50">
              <h3 className="font-display font-bold mb-2">Tag abschließen</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Z-Bericht kann nur einmal pro Kasse + Tag erstellt werden. Nach Abschluss unveränderbar.
              </p>
              <button
                onClick={abschliessen}
                disabled={saving || !istBestand}
                className="w-full bg-matcha-900 hover:bg-matcha-800 disabled:opacity-40 text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                <FileText size={16} />
                {saving ? 'Speichere …' : 'Z-Bericht abschließen'}
              </button>
              {!istBestand && (
                <div className="text-xs text-amber-700 mt-2 text-center">
                  Zuerst Ist-Bestand zählen und eintragen.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">
        {title}
      </div>
      <div className="rounded-lg border bg-background/50">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  icon,
  bold,
  mono,
  positive,
  negative,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 text-sm">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={cn(
        mono && 'font-mono',
        bold && 'font-bold font-display',
        positive && 'text-matcha-700',
        negative && 'text-red-700',
      )}>
        {value}
      </span>
    </div>
  );
}

function IstBlock({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn(
        'h-12 flex items-center px-3 rounded-xl text-xl font-bold font-display',
        tone === 'neg' ? 'bg-red-50 text-red-700' :
        tone === 'pos' ? 'bg-gold/20 text-matcha-900' :
        'bg-muted',
      )}>
        {value}
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
