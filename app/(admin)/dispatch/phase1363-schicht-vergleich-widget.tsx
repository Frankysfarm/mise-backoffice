'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Euro, Loader2, Minus, RefreshCw, Route, Star, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1363 — Schicht-Vergleich-Widget (Dispatch)
 *
 * Zeigt Phase1361-API: aktuelle Schicht vs. 7-Tage-Ø mit Delta-Ampel.
 * 5-Min-Polling. Nach Phase1358 in dispatch/client.tsx.
 */

type Trend = 'besser' | 'gleich' | 'schlechter';

interface DeltaMetrik {
  wert: number;
  delta_abs: number;
  delta_pct: number;
  trend: Trend;
}

interface SchichtMetrik {
  stopps: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  puenktlich_pct: number;
  touren_anzahl: number;
}

interface ApiData {
  aktuell: SchichtMetrik;
  durchschnitt_7tage: SchichtMetrik;
  deltas: {
    stopps: DeltaMetrik;
    umsatz_eur: DeltaMetrik;
    trinkgeld_eur: DeltaMetrik;
    puenktlich_pct: DeltaMetrik;
  };
  schicht_datum: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 5 * 60 * 1000;

const TREND_STYLES: Record<Trend, { text: string; bg: string; icon: React.ReactNode }> = {
  besser:      { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40', icon: <ArrowUp   className="h-3 w-3" /> },
  gleich:      { text: 'text-muted-foreground',              bg: 'bg-muted/40',                        icon: <Minus     className="h-3 w-3" /> },
  schlechter:  { text: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/40',      icon: <ArrowDown className="h-3 w-3" /> },
};

interface MetrikKachelProps {
  label: string;
  aktuell: string;
  schnitt: string;
  delta: DeltaMetrik;
  icon: React.ReactNode;
}

function MetrikKachel({ label, aktuell, schnitt, delta, icon }: MetrikKachelProps) {
  const s = TREND_STYLES[delta.trend];
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="text-lg font-bold text-foreground">{aktuell}</div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Ø 7 Tage: {schnitt}</span>
        <span className={cn('flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full', s.bg, s.text)}>
          {s.icon}
          {delta.delta_pct > 0 ? '+' : ''}{delta.delta_pct}%
        </span>
      </div>
    </div>
  );
}

export function DispatchPhase1363SchichtVergleichWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-vergleich?location_id=${locationId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as ApiData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, POLL_MS);
    return () => clearInterval(t);
  }, [laden]);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Route className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Schicht-Vergleich (7-Tage-Ø)</h3>
        <button onClick={laden} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" aria-label="Aktualisieren">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loading && !data && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-2">
          <MetrikKachel
            label="Stopps"
            aktuell={String(data.aktuell.stopps)}
            schnitt={String(data.durchschnitt_7tage.stopps)}
            delta={data.deltas.stopps}
            icon={<Route className="h-3.5 w-3.5" />}
          />
          <MetrikKachel
            label="Umsatz"
            aktuell={`€${data.aktuell.umsatz_eur.toFixed(2)}`}
            schnitt={`€${data.durchschnitt_7tage.umsatz_eur.toFixed(2)}`}
            delta={data.deltas.umsatz_eur}
            icon={<Euro className="h-3.5 w-3.5" />}
          />
          <MetrikKachel
            label="Trinkgeld"
            aktuell={`€${data.aktuell.trinkgeld_eur.toFixed(2)}`}
            schnitt={`€${data.durchschnitt_7tage.trinkgeld_eur.toFixed(2)}`}
            delta={data.deltas.trinkgeld_eur}
            icon={<Star className="h-3.5 w-3.5" />}
          />
          <MetrikKachel
            label="Pünktlichkeit"
            aktuell={`${data.aktuell.puenktlich_pct}%`}
            schnitt={`${data.durchschnitt_7tage.puenktlich_pct}%`}
            delta={data.deltas.puenktlich_pct}
            icon={<Timer className="h-3.5 w-3.5" />}
          />
        </div>
      )}

      {data && (
        <p className="text-[10px] text-muted-foreground text-right">
          Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      )}
    </div>
  );
}
