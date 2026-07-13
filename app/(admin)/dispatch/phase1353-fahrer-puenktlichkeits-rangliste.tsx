'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, Loader2, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1353 — Fahrer-Pünktlichkeits-Rangliste (Dispatch)
 *
 * GET /api/delivery/admin/fahrer-puenktlichkeit: Stopps pünktlich vs. zu spät;
 * Score A/B/C/D; Rangliste mit Trend. 15-Min-Polling.
 * Nach Phase1340 in dispatch/client.tsx.
 */

type Grade = 'A' | 'B' | 'C' | 'D';
type Trend = 'besser' | 'gleich' | 'schlechter';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  quote_pct: number;
  grade: Grade;
  trend: Trend;
}

interface ApiData {
  rangliste: FahrerRow[];
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const GRADE_COLORS: Record<Grade, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-amber-500 text-white',
  D: 'bg-red-500 text-white',
};

const POLL_MS = 15 * 60 * 1000;

export function DispatchPhase1353FahrerPuenktlichkeitsRangliste({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, POLL_MS);
    return () => clearInterval(id);
  }, [laden]);

  const TrendIcon = ({ trend }: { trend: Trend }) => {
    if (trend === 'besser')      return <TrendingUp   className="h-3.5 w-3.5 text-green-500" />;
    if (trend === 'schlechter')  return <TrendingDown className="h-3.5 w-3.5 text-red-500"   />;
    return                              <Minus         className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-bold">Fahrer-Pünktlichkeit (7 Tage)</span>
        <button
          onClick={laden}
          disabled={loading}
          className="ml-auto rounded-md p-1 hover:bg-muted transition"
          title="Aktualisieren"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!data && !loading && !error && locationId && (
        <p className="text-xs text-muted-foreground">Keine Daten.</p>
      )}
      {!locationId && (
        <p className="text-xs text-muted-foreground">Bitte Filiale auswählen.</p>
      )}

      {data && data.rangliste.length > 0 && (
        <div className="space-y-2">
          {data.rangliste.map((f, idx) => (
            <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">#{idx + 1}</span>
              <span className="flex-1 text-sm font-medium truncate">{f.fahrer_name}</span>

              <div className="flex items-center gap-1">
                <TrendIcon trend={f.trend} />
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <span className="text-green-600 dark:text-green-400">{f.puenktlich}✓</span>
                <span>/</span>
                <span className="text-red-500">{f.zu_spaet}✗</span>
              </div>

              <div className="w-10 text-right text-[11px] font-bold tabular-nums text-foreground">
                {f.quote_pct.toFixed(0)}%
              </div>

              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-bold', GRADE_COLORS[f.grade])}>
                {f.grade}
              </span>
            </div>
          ))}
        </div>
      )}

      {data && data.rangliste.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch keine abgeschlossenen Touren diese Woche.</p>
      )}

      {data && (
        <p className="text-[10px] text-muted-foreground">
          Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 15-Min-Polling
        </p>
      )}
    </div>
  );
}
