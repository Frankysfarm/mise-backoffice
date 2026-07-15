'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2, Award } from 'lucide-react';

/**
 * Phase 1669 — Fahrer-Effizienz-Score-Übersicht (Dispatch)
 *
 * Phase1667-API: /api/delivery/admin/fahrer-effizienz
 * Tabelle Score (0–100) + 7-Tage-Trend + Top-Performer-Badge.
 * 20-Min-Polling.
 */

interface FahrerEffizienz {
  driver_id: string;
  fahrer_name: string;
  score_heute: number;
  score_7d_avg: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stopps_heute: number;
}

interface ApiResponse {
  location_id: string;
  fahrer: FahrerEffizienz[];
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: '1', fahrer_name: 'Max M.',  score_heute: 84, score_7d_avg: 79, trend: 'steigend', km_pro_stopp: 3.2, puenktlichkeit_pct: 92, bewertung_avg: 4.6, stopps_heute: 13 },
    { driver_id: '2', fahrer_name: 'Lisa K.', score_heute: 71, score_7d_avg: 76, trend: 'fallend',  km_pro_stopp: 4.3, puenktlichkeit_pct: 83, bewertung_avg: 4.1, stopps_heute: 9 },
    { driver_id: '3', fahrer_name: 'Tom B.',  score_heute: 93, score_7d_avg: 90, trend: 'steigend', km_pro_stopp: 2.7, puenktlichkeit_pct: 97, bewertung_avg: 4.8, stopps_heute: 16 },
  ],
  generiert_am: new Date().toISOString(),
};

function scoreColor(s: number) {
  if (s >= 85) return 'text-matcha-700 dark:text-matcha-300';
  if (s >= 70) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function scoreBarColor(s: number) {
  if (s >= 85) return 'bg-matcha-400';
  if (s >= 70) return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ t }: { t: FahrerEffizienz['trend'] }) {
  if (t === 'steigend') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (t === 'fallend')  return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function DispatchPhase1669FahrerEffizienzScoreUebersicht({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-effizienz?location_id=${locationId}`);
        if (r.ok) {
          const json = await r.json() as ApiResponse;
          if (json.fahrer?.length) setData(json);
        }
      } catch {
        // Mock bleibt
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 20 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  const sorted = [...data.fahrer].sort((a, b) => b.score_heute - a.score_heute);
  const topId = sorted[0]?.driver_id;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Zap className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Fahrer-Effizienz-Score
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {sorted.map(f => (
            <div key={f.driver_id}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {f.driver_id === topId && (
                    <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="text-[11px] font-medium text-foreground truncate max-w-[90px]">
                    {f.fahrer_name}
                  </span>
                  <TrendIcon t={f.trend} />
                </div>
                <div className="flex items-center gap-1 tabular-nums text-[11px] shrink-0 ml-2">
                  <span className={cn('font-bold', scoreColor(f.score_heute))}>
                    {f.score_heute}
                  </span>
                  <span className="text-muted-foreground text-[9px]">/ Ø7d {f.score_7d_avg}</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', scoreBarColor(f.score_heute))}
                  style={{ width: `${f.score_heute}%` }}
                />
              </div>
              <div className="flex gap-3 mt-0.5 text-[9px] text-muted-foreground tabular-nums">
                <span>{f.km_pro_stopp.toFixed(1)} km/Stopp</span>
                <span>{f.puenktlichkeit_pct}% pünktl.</span>
                <span>★ {f.bewertung_avg.toFixed(1)}</span>
                <span>{f.stopps_heute} Stopps</span>
              </div>
            </div>
          ))}

          <p className="text-[9px] text-muted-foreground border-t border-border pt-1.5">
            Score 0–100 · km/Stopp 30% · Pünktlichkeit 40% · Bewertung 30% · Aktualisierung 20 Min
          </p>
        </div>
      )}
    </div>
  );
}
