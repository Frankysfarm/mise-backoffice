'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, Euro } from 'lucide-react';

/**
 * Phase 1704 — Liefer-Kosten-Effizienz-Widget (Dispatch)
 *
 * Nutzt Phase1702-API (/api/delivery/admin/liefer-kosten-analyse).
 * Zeigt Kosten je Lieferung + Ampel günstig/mittel/teuer + Trend; 30-Min-Polling.
 */

interface ApiData {
  kosten_heute_avg: number;
  kosten_vorwoche_avg: number;
  delta_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  anzahl_lieferungen_heute: number;
  kosten_gesamt_heute: number;
  status: 'guenstig' | 'mittel' | 'teuer';
  empfehlung: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 30 * 60 * 1000;

const STATUS_CONFIG = {
  guenstig: {
    label: 'Günstig',
    bg: 'bg-matcha-50 dark:bg-matcha-950',
    border: 'border-matcha-200 dark:border-matcha-800',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-300',
    bar: 'bg-matcha-500',
  },
  mittel: {
    label: 'Mittel',
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  teuer: {
    label: 'Teuer',
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    bar: 'bg-red-500',
  },
};

const TREND_ICONS = {
  steigend: <TrendingUp className="h-3 w-3 text-red-500" />,
  stabil: <Minus className="h-3 w-3 text-muted-foreground" />,
  fallend: <TrendingDown className="h-3 w-3 text-matcha-500" />,
};

function fmtEur(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export function DispatchPhase1704LieferKostenEffizienzWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/liefer-kosten-analyse?location_id=${encodeURIComponent(locationId)}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const cfg = data ? STATUS_CONFIG[data.status] : null;
  // Cost scale: 0–6 EUR → 0–100%
  const barPct = data ? Math.min(100, Math.round((data.kosten_heute_avg / 6) * 100)) : 0;

  return (
    <div className={cn('rounded-xl border p-3 mb-3 transition-colors', cfg?.bg ?? 'bg-card', cfg?.border ?? 'border-border')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Euro className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Liefer-Kosten-Effizienz</span>
        {data && (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', cfg?.badge)}>
            {STATUS_CONFIG[data.status].label}
          </span>
        )}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data ? (
            <>
              {/* Main KPI */}
              <div className="flex items-end gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ø Kosten/Lieferung</div>
                  <div className="text-2xl font-black tabular-nums text-foreground">{fmtEur(data.kosten_heute_avg)}</div>
                </div>
                <div className="flex items-center gap-1 text-xs mb-1">
                  {TREND_ICONS[data.trend]}
                  <span className={cn(
                    'font-bold',
                    data.delta_pct > 3 ? 'text-red-600 dark:text-red-400' :
                    data.delta_pct < -3 ? 'text-matcha-600 dark:text-matcha-400' :
                    'text-muted-foreground',
                  )}>
                    {data.delta_pct > 0 ? '+' : ''}{data.delta_pct}% vs. Vorwoche
                  </span>
                </div>
              </div>

              {/* Cost bar */}
              <div className="space-y-1">
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', cfg?.bar ?? 'bg-amber-500')}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>günstig (≤2,50€)</span>
                  <span>teuer ({'>'}4,50€)</span>
                </div>
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background/60 p-2">
                  <div className="text-[9px] text-muted-foreground">Lieferungen heute</div>
                  <div className="text-lg font-bold tabular-nums text-foreground">{data.anzahl_lieferungen_heute}</div>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <div className="text-[9px] text-muted-foreground">Gesamtkosten</div>
                  <div className="text-lg font-bold tabular-nums text-foreground">{fmtEur(data.kosten_gesamt_heute)}</div>
                </div>
              </div>

              {/* Empfehlung */}
              <div className="text-[11px] text-muted-foreground leading-relaxed">{data.empfehlung}</div>

              {/* Vorwoche comparison */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Vorwoche:</span>
                <span className="font-bold text-foreground">{fmtEur(data.kosten_vorwoche_avg)}/Lieferung</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              {loading ? 'Lade Kostendaten…' : 'Bitte Filiale auswählen.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
