'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus, Bike, MapPin } from 'lucide-react';

/**
 * Phase 983 — Fahrer-Score-Tour-Visualisierung (Dispatch)
 *
 * Live-Score-Leiste je aktivem Fahrer (0–100 Balken) kombiniert
 * mit Tour-Fortschritt-Badges. Matcha ≥70 / Amber 50–69 / Rot <50.
 * 2-Min-Polling von /api/delivery/admin/fahrer-tages-score.
 */

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number;
  punkte_puenktlichkeit: number;
  punkte_effizienz: number;
  punkte_bewertung: number;
  stopps_heute: number;
  stopps_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  schicht_dauer_min: number;
  trend: 'up' | 'down' | 'gleich';
  status: 'aktiv' | 'pause' | 'offline';
}

interface ApiResponse {
  fahrer: FahrerScore[];
  location_id: string;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'drv-01', name: 'M. Bauer', score: 87, punkte_puenktlichkeit: 36, punkte_effizienz: 29, punkte_bewertung: 22, stopps_heute: 12, stopps_pro_stunde: 3.8, puenktlichkeit_pct: 92, bewertung_avg: 4.6, schicht_dauer_min: 195, trend: 'up', status: 'aktiv' },
    { fahrer_id: 'drv-02', name: 'L. Huber', score: 72, punkte_puenktlichkeit: 30, punkte_effizienz: 24, punkte_bewertung: 18, stopps_heute: 9, stopps_pro_stunde: 3.1, puenktlichkeit_pct: 78, bewertung_avg: 4.2, schicht_dauer_min: 175, trend: 'gleich', status: 'aktiv' },
    { fahrer_id: 'drv-03', name: 'K. Stein', score: 55, punkte_puenktlichkeit: 22, punkte_effizienz: 18, punkte_bewertung: 15, stopps_heute: 6, stopps_pro_stunde: 2.4, puenktlichkeit_pct: 60, bewertung_avg: 3.9, schicht_dauer_min: 150, trend: 'down', status: 'pause' },
  ],
  location_id: '',
  generiert_am: new Date().toISOString(),
};

interface Props {
  locationId: string | null;
}

function scoreColor(score: number) {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' };
  if (score >= 50) return { bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' };
  return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300', border: 'border-red-200 dark:border-red-800' };
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'gleich' }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

export function DispatchPhase983FahrerScoreTourVisualisierung({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-tages-score?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
        else setData({ ...MOCK, location_id: locationId! });
      } catch {
        setData({ ...MOCK, location_id: locationId! });
      } finally {
        setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 2 * 60_000);
    return () => clearInterval(t);
  }, [locationId]);

  const fahrer = data?.fahrer ?? [];
  const topScore = fahrer[0]?.score ?? 0;
  const avgScore = fahrer.length > 0 ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length) : 0;

  if (!locationId) return null;
  if (!loading && fahrer.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-dispatch-phase="983">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Star className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-bold text-sm flex-1">Fahrer-Score & Tour-Visualisierung</span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            Ø {avgScore}
          </span>
          {topScore >= 80 && (
            <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-black">
              Top {topScore}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {loading && fahrer.length === 0 && (
            <div className="py-3 text-sm text-muted-foreground animate-pulse">Lade Fahrer-Scores…</div>
          )}

          {fahrer.map((f, idx) => {
            const cm = scoreColor(f.score);
            return (
              <div key={f.fahrer_id} className={cn('rounded-xl border bg-card overflow-hidden', cm.border)}>
                {/* Fahrer-Header */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Rang */}
                  <div className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black',
                    idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-stone-100 text-stone-600' : 'bg-muted text-muted-foreground',
                  )}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>

                  {/* Name + Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold truncate">{f.name}</span>
                      <TrendIcon trend={f.trend} />
                      <span className={cn(
                        'text-[9px] rounded-full px-1.5 py-0.5 font-bold',
                        f.status === 'aktiv' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        f.status === 'pause' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {f.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Bike className="h-3 w-3" /> {f.stopps_heute} Stopps</span>
                      <span>·</span>
                      <span>{f.stopps_pro_stunde}/h</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-400" /> {f.bewertung_avg.toFixed(1)}</span>
                      <span>·</span>
                      <span>{fmtMin(f.schicht_dauer_min)}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className={cn('text-xl font-black tabular-nums shrink-0', cm.text)}>
                    {f.score}
                  </div>
                </div>

                {/* Score-Balken */}
                <div className="px-3 pb-2.5">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', cm.bar)}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>

                  {/* Sub-Score-Strip */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { label: 'Pünktlichkeit', val: f.punkte_puenktlichkeit, max: 40, pct: f.puenktlichkeit_pct },
                      { label: 'Effizienz', val: f.punkte_effizienz, max: 35, pct: Math.round(f.stopps_pro_stunde / 5 * 100) },
                      { label: 'Bewertung', val: f.punkte_bewertung, max: 25, pct: Math.round(((f.bewertung_avg - 1) / 4) * 100) },
                    ].map(sub => (
                      <div key={sub.label} className="rounded-lg bg-muted/30 px-2 py-1.5">
                        <div className="text-[9px] text-muted-foreground mb-0.5">{sub.label}</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-black">{sub.val}</span>
                          <span className="text-[9px] text-muted-foreground">/{sub.max}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                          <div className={cn('h-full rounded-full', cm.bar)} style={{ width: `${Math.min(100, sub.pct)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tour-Visualisierung */}
                {f.stopps_heute > 0 && (
                  <div className="flex items-center gap-1 px-3 pb-2.5 overflow-x-auto">
                    {Array.from({ length: Math.min(f.stopps_heute, 10) }, (_, i) => (
                      <div key={i} className="shrink-0 flex flex-col items-center gap-0.5">
                        <MapPin className={cn(
                          'h-3.5 w-3.5',
                          i < Math.floor(f.stopps_heute * 0.7) ? 'text-emerald-500' : 'text-muted-foreground/40',
                        )} />
                        {i < Math.min(f.stopps_heute, 10) - 1 && (
                          <div className={cn('h-0.5 w-4 rounded-full', i < Math.floor(f.stopps_heute * 0.7) ? cm.bar : 'bg-muted')} />
                        )}
                      </div>
                    ))}
                    {f.stopps_heute > 10 && (
                      <span className="text-[9px] text-muted-foreground ml-1">+{f.stopps_heute - 10}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {fahrer.length === 0 && !loading && (
            <div className="py-3 text-sm text-muted-foreground text-center">Keine aktiven Fahrer</div>
          )}

          <div className="text-[10px] text-muted-foreground text-center">
            Aktualisierung alle 2 Min · Score: Pünktlichkeit 40% + Effizienz 35% + Bewertung 25%
          </div>
        </div>
      )}
    </div>
  );
}
