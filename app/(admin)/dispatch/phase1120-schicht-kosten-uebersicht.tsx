'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1120 — Schicht-Kosten-Übersicht (Dispatch)
// Aktuelle Schichtkosten (Fahrer-Stunden × Stundenlohn) vs. Umsatz → Break-Even-Anzeige

interface Props { locationId: string | null }

type FahrerKosten = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  kosten_eur: number;
  stopps: number;
  kosten_pro_stopp_eur: number;
};

type ApiData = {
  fahrer: FahrerKosten[];
  gesamt_kosten_eur: number;
  gesamt_umsatz_eur: number;
  break_even_pct: number;
  gewinn_eur: number;
  profitabel: boolean;
  stundenlohn_eur: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Ahmad K.',  schicht_stunden: 5.5, kosten_eur: 66.0,  stopps: 22, kosten_pro_stopp_eur: 3.0 },
    { fahrer_id: 'f2', fahrer_name: 'Lukas M.',  schicht_stunden: 4.0, kosten_eur: 48.0,  stopps: 17, kosten_pro_stopp_eur: 2.82 },
    { fahrer_id: 'f3', fahrer_name: 'Sara P.',   schicht_stunden: 6.0, kosten_eur: 72.0,  stopps: 24, kosten_pro_stopp_eur: 3.0 },
  ],
  gesamt_kosten_eur: 186.0,
  gesamt_umsatz_eur: 847.5,
  break_even_pct: 22,
  gewinn_eur: 661.5,
  profitabel: true,
  stundenlohn_eur: 12,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 5 * 60_000;

function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

export function DispatchPhase1120SchichtKostenUebersicht({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-kosten-uebersicht?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const d = data ?? MOCK;
  const profitColor = d.profitabel ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const headerBg = d.profitabel
    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', headerBg)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {d.profitabel
            ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            : <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />}
          <span className="font-bold text-sm text-foreground">Schicht-Kosten-Übersicht</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', d.profitabel
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400')}>
            {d.profitabel ? 'Profitabel' : 'Verlust'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className={cn('text-xs font-bold', profitColor)}>{d.profitabel ? '+' : ''}{fmt(d.gewinn_eur)} €</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/30 dark:border-white/10 pt-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Kosten', value: `${fmt(d.gesamt_kosten_eur)} €`, sub: `${d.fahrer.length} Fahrer × ${d.stundenlohn_eur} €/h` },
              { label: 'Umsatz', value: `${fmt(d.gesamt_umsatz_eur)} €`, sub: 'Lieferbestellungen heute' },
              { label: 'Kostenquote', value: `${d.break_even_pct}%`, sub: 'des Umsatzes' },
            ].map(c => (
              <div key={c.label} className="rounded-lg bg-white/60 dark:bg-white/5 p-2 text-center">
                <div className="text-[10px] text-muted-foreground mb-0.5">{c.label}</div>
                <div className="font-bold text-sm text-foreground">{c.value}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Break-even bar */}
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Kostenquote</span>
              <span>{d.break_even_pct}% von 100%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', d.break_even_pct < 40 ? 'bg-emerald-500' : d.break_even_pct < 70 ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${Math.min(d.break_even_pct, 100)}%` }}
              />
            </div>
          </div>

          {/* Driver breakdown */}
          {d.fahrer.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Fahrer-Aufschlüsselung</div>
              {d.fahrer.map(f => (
                <div key={f.fahrer_id} className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-white/5 px-3 py-1.5">
                  <div>
                    <span className="text-xs font-semibold text-foreground">{f.fahrer_name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{f.schicht_stunden}h · {f.stopps} Stopps</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-foreground">{fmt(f.kosten_eur)} €</div>
                    <div className="text-[9px] text-muted-foreground">{fmt(f.kosten_pro_stopp_eur)} €/Stopp</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!locationId && (
            <div className="text-xs text-muted-foreground">Bitte Filiale auswählen.</div>
          )}
        </div>
      )}
    </div>
  );
}
