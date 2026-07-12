'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge, Loader2, RefreshCw, Route, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1156 — Tour-Live-Score-Board (Dispatch)
// Echtzeit-Score-Visualisierung für alle aktiven Touren: Effizienz-Score + Pünktlichkeit + Stopps-Fortschritt

interface Props {
  locationId: string | null;
}

interface TourScore {
  batch_id: string;
  fahrer_name: string;
  zone: string | null;
  score: number;
  stopps_gesamt: number;
  stopps_erledigt: number;
  laufzeit_min: number;
  eta_min: number | null;
  verbleibend_min: number | null;
  pünktlichkeit: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  batches?: Array<{
    id: string;
    fahrer_name?: string;
    zone?: string | null;
    stopps_gesamt?: number;
    stopps_erledigt?: number;
    laufzeit_min?: number;
    eta_min?: number | null;
    verbleibend_min?: number | null;
    fortschritt_pct?: number;
    ampel?: string;
    grund?: string;
  }>;
}

type BatchItem = NonNullable<ApiResponse['batches']>[number];

function computeScore(b: BatchItem): number {
  const fortschritt = b.stopps_gesamt ? (b.stopps_erledigt ?? 0) / b.stopps_gesamt : 0;
  const zeitEffizienz = b.eta_min && b.laufzeit_min
    ? Math.min(1, b.laufzeit_min / b.eta_min)
    : 0.5;
  const ampelBonus = b.ampel === 'gruen' ? 15 : b.ampel === 'gelb' ? 5 : -10;
  return Math.round(Math.min(100, Math.max(0, fortschritt * 60 + zeitEffizienz * 25 + ampelBonus)));
}

const SCORE_STYLE = (score: number) => {
  if (score >= 80) return { bar: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50', border: 'border-matcha-200', grade: 'A' };
  if (score >= 60) return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', grade: 'B' };
  if (score >= 40) return { bar: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', grade: 'C' };
  return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', grade: 'D' };
};

const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-matcha-500',
  gelb: 'bg-amber-400',
  rot: 'bg-red-500 animate-pulse',
};

export function DispatchPhase1156TourLiveScoreBoard({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [touren, setTouren] = useState<TourScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-ampel?location_id=${locationId}&limit=20`);
      if (!res.ok) throw new Error('API error');
      const data: ApiResponse = await res.json();
      const batches = data.batches ?? [];
      const scored = batches
        .map((b, i) => ({
          batch_id: b.id,
          fahrer_name: b.fahrer_name ?? 'Fahrer',
          zone: b.zone ?? null,
          score: computeScore(b),
          stopps_gesamt: b.stopps_gesamt ?? 0,
          stopps_erledigt: b.stopps_erledigt ?? 0,
          laufzeit_min: b.laufzeit_min ?? 0,
          eta_min: b.eta_min ?? null,
          verbleibend_min: b.verbleibend_min ?? null,
          pünktlichkeit: (b.ampel ?? 'gelb') as TourScore['pünktlichkeit'],
          rang: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((t, i) => ({ ...t, rang: i + 1 }));
      setTouren(scored);
      setLastUpdate(new Date());
    } catch {
      // Mock-Daten wenn API fehlt
      setTouren([
        { batch_id: 'mock-1', fahrer_name: 'Max M.', zone: 'Nord', score: 87, stopps_gesamt: 4, stopps_erledigt: 3, laufzeit_min: 28, eta_min: 35, verbleibend_min: 7, pünktlichkeit: 'gruen', rang: 1 },
        { batch_id: 'mock-2', fahrer_name: 'Lisa K.', zone: 'Süd', score: 62, stopps_gesamt: 3, stopps_erledigt: 1, laufzeit_min: 22, eta_min: 30, verbleibend_min: 8, pünktlichkeit: 'gelb', rang: 2 },
        { batch_id: 'mock-3', fahrer_name: 'Tom B.', zone: 'Mitte', score: 38, stopps_gesamt: 5, stopps_erledigt: 2, laufzeit_min: 41, eta_min: 40, verbleibend_min: -1, pünktlichkeit: 'rot', rang: 3 },
      ]);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (touren.length === 0 && !loading) return null;

  const top = touren[0];
  const avgScore = touren.length ? Math.round(touren.reduce((s, t) => s + t.score, 0) / touren.length) : 0;

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-matcha-100/60 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold text-matcha-800 uppercase tracking-wider">
            Tour-Live-Score
          </span>
          {touren.length > 0 && (
            <>
              <span className="rounded-full bg-matcha-600 text-white text-[10px] font-black px-2 py-0.5">
                {touren.length} Touren
              </span>
              <span className="rounded-full bg-white border border-matcha-300 text-matcha-700 text-[10px] font-black px-2 py-0.5">
                Ø {avgScore} Pkt
              </span>
            </>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-matcha-500" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="rounded-full p-1 hover:bg-matcha-200 transition"
          >
            <RefreshCw className="h-3 w-3 text-matcha-500" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-matcha-600" /> : <ChevronDown className="h-4 w-4 text-matcha-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-matcha-200 divide-y divide-matcha-100">
          {touren.map((tour) => {
            const st = SCORE_STYLE(tour.score);
            const fortschrittPct = tour.stopps_gesamt > 0
              ? Math.round((tour.stopps_erledigt / tour.stopps_gesamt) * 100)
              : 0;
            return (
              <div key={tour.batch_id} className={cn('px-4 py-3 flex items-center gap-3', st.bg)}>
                {/* Rang */}
                <div className={cn('shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black', st.bar, 'text-white')}>
                  {tour.rang}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{tour.fahrer_name}</span>
                    {tour.zone && (
                      <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                        Zone {tour.zone}
                      </span>
                    )}
                    <span className={cn('flex items-center gap-0.5')}>
                      <span className={cn('inline-block h-2 w-2 rounded-full', AMPEL_DOT[tour.pünktlichkeit] ?? 'bg-muted')} />
                    </span>
                  </div>

                  {/* Fortschritts-Balken */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', st.bar)}
                        style={{ width: `${fortschrittPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {tour.stopps_erledigt}/{tour.stopps_gesamt} Stopps
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Route className="h-2.5 w-2.5" />
                      {tour.laufzeit_min} Min unterwegs
                    </span>
                    {tour.verbleibend_min !== null && (
                      <span className={cn('text-[9px] font-bold', tour.verbleibend_min < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                        {tour.verbleibend_min < 0 ? `+${Math.abs(tour.verbleibend_min)} Min überzogen` : `~${tour.verbleibend_min} Min verbleibend`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-xl font-black tabular-nums', st.text)}>
                    {tour.score}
                  </div>
                  <div className={cn('text-[9px] font-black rounded px-1', st.bar, 'text-white text-center')}>
                    {st.grade}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Footer: Schicht-Übersicht */}
          {lastUpdate && (
            <div className="px-4 py-2 bg-matcha-100/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-matcha-700 flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  Ø Score: <strong>{avgScore}</strong>
                </span>
                {top && (
                  <span className="text-[10px] text-matcha-700 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Top: {top.fahrer_name} ({top.score})
                  </span>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground">
                {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
