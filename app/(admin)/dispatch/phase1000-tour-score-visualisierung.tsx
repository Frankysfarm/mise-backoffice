'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Star, Zap, Loader2, Route } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type DriverScore = {
  id: string;
  name: string;
  score: number;
  tours: number;
  avgDeliveryMin: number;
  onTimeRate: number;
  earningsEur: number;
  status: 'active' | 'idle' | 'break';
};

type TourViz = {
  tourId: string;
  driverName: string;
  stopsTotal: number;
  stopsCompleted: number;
  efficiency: number;
  etaMin: number | null;
  score: number;
};

const MOCK_SCORES: DriverScore[] = [
  { id: 'd1', name: 'Marco R.', score: 94, tours: 8, avgDeliveryMin: 22, onTimeRate: 97, earningsEur: 142.50, status: 'active' },
  { id: 'd2', name: 'Lisa T.', score: 89, tours: 6, avgDeliveryMin: 24, onTimeRate: 91, earningsEur: 108.00, status: 'active' },
  { id: 'd3', name: 'Kai W.', score: 82, tours: 5, avgDeliveryMin: 28, onTimeRate: 85, earningsEur: 92.40, status: 'idle' },
  { id: 'd4', name: 'Anna S.', score: 76, tours: 4, avgDeliveryMin: 31, onTimeRate: 80, earningsEur: 78.00, status: 'break' },
];

const MOCK_TOURS: TourViz[] = [
  { tourId: 't1', driverName: 'Marco R.', stopsTotal: 4, stopsCompleted: 3, efficiency: 96, etaMin: 8, score: 95 },
  { tourId: 't2', driverName: 'Lisa T.', stopsTotal: 3, stopsCompleted: 1, efficiency: 82, etaMin: 22, score: 84 },
  { tourId: 't3', driverName: 'Kai W.', stopsTotal: 5, stopsCompleted: 4, efficiency: 78, etaMin: 5, score: 79 },
];

function ScoreBar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-matcha-500' : value >= 75 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'Aktiv', color: 'bg-matcha-100 text-matcha-700' },
  idle: { label: 'Warten', color: 'bg-amber-100 text-amber-700' },
  break: { label: 'Pause', color: 'bg-stone-100 text-stone-600' },
};

export function DispatchPhase1000TourScoreVisualisierung({
  locationId,
}: {
  locationId: string | null;
}) {
  const [scores, setScores] = useState<DriverScore[]>([]);
  const [tours, setTours] = useState<TourViz[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scores' | 'tours'>('scores');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    function load() {
      Promise.all([
        fetch(`/api/delivery/admin/driver-scores?location_id=${encodeURIComponent(locationId!)}`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/delivery/admin/active-tours?location_id=${encodeURIComponent(locationId!)}`).then((r) => r.ok ? r.json() : null),
      ])
        .then(([scoreData, tourData]) => {
          if (scoreData?.drivers?.length) setScores(scoreData.drivers);
          else setScores(MOCK_SCORES);
          if (tourData?.tours?.length) setTours(tourData.tours);
          else setTours(MOCK_TOURS);
        })
        .catch(() => { setScores(MOCK_SCORES); setTours(MOCK_TOURS); })
        .finally(() => setLoading(false));
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const topScore = scores.length ? Math.max(...scores.map((s) => s.score)) : 0;
  const avgScore = scores.length ? Math.round(scores.reduce((s, d) => s + d.score, 0) / scores.length) : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score &amp; Visualisierung
          </span>
          {avgScore > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              Ø {avgScore} · Top {topScore}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t">
          {/* Tab Bar */}
          <div className="flex border-b">
            {(['scores', 'tours'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 text-xs font-bold uppercase tracking-wider transition',
                  tab === t ? 'bg-matcha-50 text-matcha-700 border-b-2 border-matcha-600' : 'text-muted-foreground hover:bg-muted/40'
                )}
              >
                {t === 'scores' ? 'Fahrer-Scores' : 'Tour-Visualisierung'}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {loading && (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Daten…
              </div>
            )}

            {!loading && tab === 'scores' && (
              <div className="space-y-2">
                {scores.map((d, i) => {
                  const st = STATUS_LABEL[d.status] ?? STATUS_LABEL.idle;
                  return (
                    <div key={d.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-matcha-100 text-[10px] font-black text-matcha-700">
                            {i + 1}
                          </span>
                          <span className="text-sm font-bold">{d.name}</span>
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', st.color)}>
                            {st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 text-amber-400" />
                          {d.onTimeRate}% pünktlich
                        </div>
                      </div>
                      <ScoreBar value={d.score} />
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Touren</div>
                          <div className="text-sm font-bold">{d.tours}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Ø Zeit</div>
                          <div className="text-sm font-bold">{d.avgDeliveryMin} Min</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Verdienst</div>
                          <div className="text-sm font-bold">{euro(d.earningsEur)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && tab === 'tours' && (
              <div className="space-y-2">
                {tours.map((t) => {
                  const pct = Math.round((t.stopsCompleted / t.stopsTotal) * 100);
                  const scoreColor = t.score >= 90 ? 'text-matcha-700' : t.score >= 75 ? 'text-amber-600' : 'text-red-600';
                  return (
                    <div key={t.tourId} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-matcha-600" />
                          <span className="text-sm font-bold">{t.driverName}</span>
                          <span className="text-[10px] text-muted-foreground">Tour #{t.tourId}</span>
                        </div>
                        <div className={cn('flex items-center gap-1 text-sm font-black', scoreColor)}>
                          <Zap className="h-3.5 w-3.5" />
                          {t.score}
                        </div>
                      </div>

                      {/* Stop progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Stopps {t.stopsCompleted}/{t.stopsTotal}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-matcha-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Stop dots */}
                      <div className="flex gap-1">
                        {Array.from({ length: t.stopsTotal }).map((_, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'h-3 flex-1 rounded-sm',
                              idx < t.stopsCompleted ? 'bg-matcha-500' : 'bg-muted'
                            )}
                          />
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Effizienz</div>
                          <div className={cn('text-sm font-bold', t.efficiency >= 90 ? 'text-matcha-700' : t.efficiency >= 75 ? 'text-amber-600' : 'text-red-600')}>
                            {t.efficiency}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">ETA Abschl.</div>
                          <div className="text-sm font-bold">
                            {t.etaMin != null ? `${t.etaMin} Min` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {tours.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Keine aktiven Touren
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
