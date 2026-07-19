'use client';

/**
 * Phase 2470 — Score + Tour-Visualisierung Cockpit
 * Score-Anzeige je Fahrer (0–100 Ring), farbkodierte Stop-Dots, ETA-Badge.
 * Alert wenn Score < 60. 25-Sek-Polling.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Navigation2, Clock, AlertTriangle, TrendingUp, MapPin } from 'lucide-react';

interface TourRow {
  batchId: string;
  driverName: string;
  score: number;
  stops: { done: boolean; late: boolean }[];
  etaMin: number | null;
  zone: string | null;
  elapsedMin: number;
}

function scoreColor(s: number) {
  if (s >= 80) return { ring: '#22c55e', label: 'TOP', bg: 'bg-emerald-50' };
  if (s >= 60) return { ring: '#f59e0b', label: 'OK', bg: 'bg-amber-50' };
  return { ring: '#ef4444', label: 'TIEF', bg: 'bg-red-50' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const col = scoreColor(score);
  return (
    <svg width={44} height={44} className="shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={22} cy={22} r={r} fill="none"
        stroke={col.ring} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className="transition-all duration-700"
      />
      <text x={22} y={26} textAnchor="middle" fontSize={11} fontWeight="900" fill={col.ring} fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

function StopDots({ stops }: { stops: TourRow['stops'] }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {stops.map((s, i) => (
        <span
          key={i}
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            s.done ? (s.late ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-stone-200'
          )}
        />
      ))}
    </div>
  );
}

export function DispatchPhase2470ScoreTourVisualisierungCockpit({ locationId }: { locationId?: string }) {
  const [tours, setTours] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createClient();
    const load = async () => {
      const { data: batches } = await sb
        .from('dispatch_batches')
        .select(`
          id,
          zone,
          abfahrt_zeit,
          employees!inner(vorname, nachname),
          dispatch_stops(id, status, geplante_ankunft, tatsaechliche_ankunft)
        `)
        .eq('status', 'unterwegs')
        .order('abfahrt_zeit', { ascending: true })
        .limit(8);

      if (batches) {
        const now = Date.now();
        setTours(batches.map((b: any) => {
          const stops = (b.dispatch_stops ?? []).map((s: any) => ({
            done: ['angekomm', 'zugestellt', 'done'].includes(s.status ?? ''),
            late: s.tatsaechliche_ankunft && s.geplante_ankunft
              ? new Date(s.tatsaechliche_ankunft) > new Date(s.geplante_ankunft)
              : false,
          }));
          const doneCount = stops.filter((s: any) => s.done).length;
          const totalCount = stops.length;
          const lateCount = stops.filter((s: any) => s.late).length;
          const score = totalCount === 0 ? 75 : Math.max(0, Math.min(100,
            Math.round(100 - (lateCount / totalCount) * 40 + (doneCount / Math.max(1, totalCount)) * 5)
          ));
          const abfahrt = b.abfahrt_zeit ? new Date(b.abfahrt_zeit).getTime() : now;
          const elapsedMin = Math.round((now - abfahrt) / 60_000);
          const remaining = totalCount - doneCount;
          const etaMin = remaining > 0 ? remaining * 8 : null;

          return {
            batchId: b.id,
            driverName: b.employees ? `${b.employees.vorname} ${b.employees.nachname[0]}.` : 'Fahrer',
            score,
            stops,
            etaMin,
            zone: b.zone ?? null,
            elapsedMin,
          };
        }));
      }
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const alerts = tours.filter(t => t.score < 60);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <Navigation2 className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Score · Tour-Visualisierung</span>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" /> {alerts.length} Score &lt;60
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{tours.length} Touren</span>
        </div>
      </div>

      {/* Body */}
      <div className="divide-y">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Clock className="h-4 w-4 animate-pulse" /> Lade…
          </div>
        ) : tours.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-matcha-500" /> Keine aktiven Touren
          </div>
        ) : tours.map(t => {
          const col = scoreColor(t.score);
          const completedPct = t.stops.length > 0
            ? Math.round((t.stops.filter(s => s.done).length / t.stops.length) * 100)
            : 0;
          return (
            <div key={t.batchId} className={cn('px-4 py-3 flex items-center gap-3', col.bg)}>
              <ScoreRing score={t.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold truncate">{t.driverName}</span>
                  {t.zone && (
                    <span className="text-[9px] rounded-full bg-white/80 border px-1.5 py-0.5 font-bold">
                      Zone {t.zone}
                    </span>
                  )}
                  <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full text-white ml-auto',
                    t.score >= 80 ? 'bg-emerald-500' : t.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  )}>
                    {col.label}
                  </span>
                </div>
                <StopDots stops={t.stops} />
                <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      t.score >= 80 ? 'bg-emerald-400' : t.score >= 60 ? 'bg-amber-400' : 'bg-red-400'
                    )}
                    style={{ width: `${completedPct}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right flex flex-col gap-0.5">
                <div className="font-mono text-sm font-black tabular-nums">{t.elapsedMin}m</div>
                {t.etaMin !== null && (
                  <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" /> ~{t.etaMin}m
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
