'use client';

// Phase 1286 — Schicht-Kosten-Widget (Lieferdienst)
// Nutzt /api/delivery/admin/schicht-kosten-kalkulation
// Break-Even-Analyse: Personal + Fahrtkosten vs. Umsatz → Deckungsbeitrag + Marge
// 15-Min-Polling; nach Phase1281

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerKosten {
  fahrer_id: string;
  fahrer_name: string;
  aktive_stunden: number;
  stopps_heute: number;
  personalkosten_eur: number;
  fahrtkosten_eur: number;
  gesamt_kosten_eur: number;
}

interface ApiData {
  fahrer: FahrerKosten[];
  umsatz_eur: number;
  personalkosten_eur: number;
  fahrtkosten_eur: number;
  gesamt_kosten_eur: number;
  deckungsbeitrag_eur: number;
  marge_pct: number;
  status: 'gewinn' | 'kostendeckend' | 'verlust';
  aktive_fahrer: number;
  location_id: string;
  generiert_am: string;
}

const STATUS_STYLE = {
  gewinn:         { color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900', badge: 'bg-emerald-500 text-white', label: 'Gewinn', Icon: TrendingUp },
  kostendeckend:  { color: 'text-amber-600',   bg: 'bg-amber-100 dark:bg-amber-900',    badge: 'bg-amber-400 text-white',   label: 'Kostendeckend', Icon: TrendingUp },
  verlust:        { color: 'text-red-600',      bg: 'bg-red-100 dark:bg-red-900',        badge: 'bg-red-500 text-white',     label: 'Verlust', Icon: TrendingDown },
};

export function LieferdienstPhase1286SchichtKostenWidget({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [showFahrer, setShowFahrer] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/schicht-kosten-kalkulation?location_id=${locationId}`);
        if (!cancelled) setData(await res.json());
      } catch {
        // mock via API
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const st = data ? STATUS_STYLE[data.status] : null;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      data?.status === 'verlust'
        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
        : data?.status === 'kostendeckend'
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'
          : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950',
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Euro className={cn('h-4 w-4 shrink-0', st?.color ?? 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Schicht-Kosten-Kalkulation
        </span>
        {data && st && (
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full mr-2', st.badge)}>
            {st.label} · {data.marge_pct}% Marge
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin opacity-50" />}
        {open ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!locationId && <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>}

          {data && (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Umsatz',         val: `${data.umsatz_eur.toFixed(2)} €`,         color: 'text-foreground' },
                  { label: 'Personalkosten', val: `${data.personalkosten_eur.toFixed(2)} €`,  color: 'text-red-600' },
                  { label: 'Fahrtkosten',    val: `${data.fahrtkosten_eur.toFixed(2)} €`,     color: 'text-red-500' },
                  { label: 'Deckungsbeitrag',val: `${data.deckungsbeitrag_eur.toFixed(2)} €`, color: data.deckungsbeitrag_eur >= 0 ? 'text-emerald-600' : 'text-red-600' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg bg-background border p-2.5 text-center">
                    <div className={cn('text-base font-black tabular-nums', kpi.color)}>{kpi.val}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Marge-Balken */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Marge</span>
                  <span className={cn('font-bold', st?.color)}>{data.marge_pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', data.marge_pct >= 20 ? 'bg-emerald-500' : data.marge_pct >= 0 ? 'bg-amber-400' : 'bg-red-500')}
                    style={{ width: `${Math.max(0, Math.min(100, data.marge_pct))}%` }}
                  />
                </div>
              </div>

              {/* Fahrer-Aufschlüsselung Toggle */}
              <button
                onClick={() => setShowFahrer((v) => !v)}
                className="text-[10px] font-bold text-muted-foreground underline"
              >
                {showFahrer ? 'Fahrer-Aufschlüsselung verbergen' : `Aufschlüsselung: ${data.aktive_fahrer} Fahrer anzeigen`}
              </button>

              {showFahrer && (
                <div className="space-y-1.5">
                  {data.fahrer.map((f) => (
                    <div key={f.fahrer_id} className="rounded-lg bg-background border px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{f.fahrer_name}</span>
                        <span className="text-[10px] font-bold text-red-600">{f.gesamt_kosten_eur.toFixed(2)} €</span>
                      </div>
                      <div className="flex gap-3 text-[9px] text-muted-foreground">
                        <span>{f.aktive_stunden.toFixed(1)}h · Personal: {f.personalkosten_eur.toFixed(2)} €</span>
                        <span>Fahrt: {f.fahrtkosten_eur.toFixed(2)} €</span>
                        <span>{f.stopps_heute} Stopps</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
