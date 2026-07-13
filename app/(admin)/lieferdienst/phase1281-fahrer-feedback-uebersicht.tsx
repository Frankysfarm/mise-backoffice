'use client';

// Phase 1281 — Fahrer-Feedback-Übersicht (Lieferdienst)
// Aggregierte Kunden-Zufriedenheits-Daten je Fahrer aus /api/delivery/admin/fahrer-feedback-uebersicht
// Positiv/Negativ-Quote + Ø-Bewertung + Trend-Badge; 10-Min-Polling; nach Phase1276

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerFeedback {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  positiv: number;
  negativ: number;
  gesamt: number;
  positiv_quote_pct: number;
  avg_rating: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  status: 'top' | 'gut' | 'ok' | 'kritisch';
}

interface ApiData {
  fahrer: FahrerFeedback[];
  gesamt_positiv_quote_pct: number;
  kritische_fahrer_count: number;
  location_id: string;
  generiert_am: string;
}

const STATUS_STYLE: Record<FahrerFeedback['status'], { bar: string; badge: string; label: string }> = {
  top:      { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'Top' },
  gut:      { bar: 'bg-matcha-500',  badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-300',   label: 'Gut' },
  ok:       { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',        label: 'OK' },
  kritisch: { bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',               label: 'Kritisch' },
};

export function LieferdienstPhase1281FahrerFeedbackUebersicht({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-feedback-uebersicht?location_id=${locationId}`);
        if (!cancelled) setData(await res.json());
      } catch {
        // silent — mock-Fallback via API
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <ThumbsUp className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 flex-1">
          Fahrer-Feedback-Übersicht
        </span>
        {data && (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full mr-2',
            data.kritische_fahrer_count > 0
              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
          )}>
            {data.gesamt_positiv_quote_pct}% positiv
            {data.kritische_fahrer_count > 0 && ` · ${data.kritische_fahrer_count} kritisch`}
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-violet-500" />}
        {open ? <ChevronUp className="h-4 w-4 text-violet-400" /> : <ChevronDown className="h-4 w-4 text-violet-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}

          {data && data.fahrer.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Feedback-Daten vorhanden.</p>
          )}

          {data && data.fahrer.map((f) => {
            const st = STATUS_STYLE[f.status];
            const TrendIcon = f.trend === 'besser' ? TrendingUp : f.trend === 'schlechter' ? TrendingDown : Minus;
            const trendColor = f.trend === 'besser' ? 'text-emerald-600' : f.trend === 'schlechter' ? 'text-red-500' : 'text-muted-foreground';
            return (
              <div key={f.fahrer_id} className="rounded-lg bg-background border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{f.fahrer_name}</span>
                  {f.zone && (
                    <span className="text-[10px] rounded-full border px-1.5 py-0.5 font-bold">Zone {f.zone}</span>
                  )}
                  <span className={cn('ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full', st.badge)}>
                    {st.label}
                  </span>
                  <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
                </div>

                {/* Positiv-Quote Balken */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', st.bar)}
                      style={{ width: `${f.positiv_quote_pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums w-10 text-right">{f.positiv_quote_pct}%</span>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-emerald-500" /> {f.positiv}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown className="h-3 w-3 text-red-400" /> {f.negativ}
                  </span>
                  {f.avg_rating !== null && (
                    <span>⭐ {f.avg_rating.toFixed(1)}</span>
                  )}
                  <span className="ml-auto">{f.gesamt} Feedbacks</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
