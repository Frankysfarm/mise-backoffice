'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Bike, CheckCircle2, Clock, MapPin, Route, Trophy, TrendingUp, TrendingDown } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string | null;
    eta_earliest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string; } | null;
  stops: Stop[];
};

/* ── Score calculation ─────────────────────────────────────────────────────── */

function calcTourScore(batch: Batch): { score: number; details: { label: string; value: number; max: number }[] } {
  const stops = batch.stops ?? [];
  const totalStops = stops.length;
  const doneStops  = stops.filter(s => !!s.geliefert_am).length;

  if (totalStops === 0) return { score: 0, details: [] };

  const elapsedMin = batch.started_at
    ? (Date.now() - new Date(batch.started_at).getTime()) / 60_000
    : 0;

  const completionPct = totalStops > 0 ? (doneStops / totalStops) * 100 : 0;
  const etaTotal = batch.total_eta_min ?? 30;

  // On-time score (40 pts): how well elapsed time matches completion
  const expectedElapsedPct = Math.min(100, (elapsedMin / Math.max(1, etaTotal)) * 100);
  const progressDelta = completionPct - expectedElapsedPct;
  const onTimeScore = Math.max(0, Math.min(40, 20 + progressDelta * 0.5));

  // Completion score (40 pts): done stops / total
  const completionScore = Math.round((doneStops / totalStops) * 40);

  // Efficiency score (20 pts): distance vs stops ratio
  const distancePerStop = totalStops > 0 ? (batch.total_distance_km ?? 5) / totalStops : 5;
  const efficiencyScore = Math.max(0, Math.min(20, Math.round(20 - (distancePerStop - 1) * 3)));

  const score = Math.round(onTimeScore + completionScore + efficiencyScore);

  return {
    score: Math.min(100, score),
    details: [
      { label: 'Pünktlichkeit', value: Math.round(onTimeScore), max: 40 },
      { label: 'Fortschritt',   value: completionScore,          max: 40 },
      { label: 'Effizienz',     value: efficiencyScore,          max: 20 },
    ],
  };
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 55) return 'text-orange-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-50 border-emerald-200';
  if (score >= 70) return 'bg-yellow-50 border-yellow-200';
  if (score >= 55) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

/* ── Mock data ────────────────────────────────────────────────────────────────── */

const MOCK_BATCHES: Batch[] = [
  {
    id: 'mock-b1',
    status: 'unterwegs',
    started_at: new Date(Date.now() - 22 * 60_000).toISOString(),
    total_eta_min: 35,
    total_distance_km: 6.2,
    zone: 'Mitte',
    fahrer: { vorname: 'Klaus', nachname: 'Schnell' },
    stops: [
      { id: 's1', reihenfolge: 1, geliefert_am: new Date(Date.now() - 10 * 60_000).toISOString(), order: { bestellnummer: 'B-0011', kunde_name: 'A. Wagner', eta_earliest: new Date(Date.now() - 8 * 60_000).toISOString() } },
      { id: 's2', reihenfolge: 2, geliefert_am: new Date(Date.now() - 3 * 60_000).toISOString(),  order: { bestellnummer: 'B-0012', kunde_name: 'B. Fischer', eta_earliest: new Date(Date.now() - 2 * 60_000).toISOString() } },
      { id: 's3', reihenfolge: 3, geliefert_am: null, order: { bestellnummer: 'B-0013', kunde_name: 'C. Meier', eta_earliest: new Date(Date.now() + 8 * 60_000).toISOString() } },
    ],
  },
  {
    id: 'mock-b2',
    status: 'unterwegs',
    started_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    total_eta_min: 25,
    total_distance_km: 4.1,
    zone: 'Nord',
    fahrer: { vorname: 'Maria', nachname: 'Flott' },
    stops: [
      { id: 's4', reihenfolge: 1, geliefert_am: null, order: { bestellnummer: 'B-0021', kunde_name: 'D. Schulz', eta_earliest: new Date(Date.now() + 5 * 60_000).toISOString() } },
      { id: 's5', reihenfolge: 2, geliefert_am: null, order: { bestellnummer: 'B-0022', kunde_name: 'E. Krause', eta_earliest: new Date(Date.now() + 15 * 60_000).toISOString() } },
    ],
  },
];

/* ── Component ─────────────────────────────────────────────────────────────── */

export function DispatchPhase4680TourScoreLive() {
  const supabase = createClient();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [useMock, setUseMock] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('mise_delivery_batches')
        .select(`
          id, status, started_at, total_eta_min, total_distance_km, zone,
          fahrer:mise_drivers(vorname, nachname),
          stops:mise_delivery_batch_stops(
            id, reihenfolge, geliefert_am,
            order:customer_orders(bestellnummer, kunde_name, eta_earliest)
          )
        `)
        .in('status', ['unterwegs', 'on_route', 'assigned'])
        .order('started_at', { ascending: false })
        .limit(10);

      if (error || !data?.length) { setUseMock(true); return; }
      setBatches(data.map((b: any) => ({
        ...b,
        fahrer: Array.isArray(b.fahrer) ? b.fahrer[0] : b.fahrer,
        stops: (b.stops ?? []).map((s: any) => ({
          ...s,
          order: Array.isArray(s.order) ? s.order[0] : s.order,
        })),
      })));
      setUseMock(false);
    } catch {
      setUseMock(true);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBatches = useMock ? MOCK_BATCHES : batches;

  if (!activeBatches.length) return null;

  const teamScore = Math.round(
    activeBatches.reduce((sum, b) => sum + calcTourScore(b).score, 0) / activeBatches.length,
  );

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-indigo-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-white" />
          <span className="text-sm font-bold text-white">Tour-Score Live</span>
          {useMock && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-medium text-white/80">Demo</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-indigo-200">Team-Ø</span>
          <span className={cn('text-xl font-black tabular-nums', teamScore >= 80 ? 'text-emerald-300' : teamScore >= 65 ? 'text-yellow-300' : 'text-red-300')}>
            {teamScore}
          </span>
        </div>
      </div>

      {/* Tours */}
      <div className="divide-y divide-slate-50">
        {activeBatches.map(batch => {
          const { score, details } = calcTourScore(batch);
          const isExpanded = expanded === batch.id;
          const stops = [...(batch.stops ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const doneCount = stops.filter(s => !!s.geliefert_am).length;
          const fahrerName = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : 'Unbekannt';
          const elapsedMin = batch.started_at
            ? Math.round((Date.now() - new Date(batch.started_at).getTime()) / 60_000)
            : 0;

          return (
            <div key={batch.id} className="px-4 py-3">
              {/* Row */}
              <button
                className="w-full flex items-center gap-3 text-left"
                onClick={() => setExpanded(isExpanded ? null : batch.id)}
              >
                {/* Score ring */}
                <div className={cn(
                  'flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full border-2 text-base font-black',
                  scoreBg(score),
                  scoreColor(score),
                )}>
                  {score}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Bike className="h-3 w-3 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 truncate">{fahrerName}</span>
                    {batch.zone && (
                      <span className="rounded bg-indigo-50 px-1 py-0.5 text-[9px] text-indigo-600 font-medium">{batch.zone}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {doneCount}/{stops.length} Stopps
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {elapsedMin}min
                    </span>
                    {batch.total_distance_km && (
                      <span className="flex items-center gap-0.5">
                        <Route className="h-2.5 w-2.5" />
                        {batch.total_distance_km.toFixed(1)}km
                      </span>
                    )}
                  </div>
                  {/* Mini score bars */}
                  <div className="mt-1.5 flex gap-1">
                    {details.map(d => (
                      <div key={d.label} className="flex-1">
                        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-yellow-400' : score >= 55 ? 'bg-orange-400' : 'bg-red-400',
                            )}
                            style={{ width: `${Math.round((d.value / d.max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trend */}
                <div className="flex-shrink-0 text-slate-400">
                  {score >= 75 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                </div>
              </button>

              {/* Expanded: stop timeline */}
              {isExpanded && (
                <div className="mt-3 ml-3 border-l-2 border-indigo-100 pl-3 space-y-2">
                  {stops.map((stop, idx) => {
                    const isDone = !!stop.geliefert_am;
                    const isCurrent = !isDone && (idx === 0 || !!stops[idx - 1]?.geliefert_am);
                    const order = stop.order;
                    return (
                      <div key={stop.id} className="flex items-start gap-2">
                        <div className={cn(
                          'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border flex items-center justify-center',
                          isDone    && 'border-emerald-400 bg-emerald-400',
                          isCurrent && 'border-indigo-500 bg-white',
                          !isDone && !isCurrent && 'border-slate-200 bg-slate-50',
                        )}>
                          {isDone && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                          {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-slate-700">
                            {order?.bestellnummer ?? `Stopp ${stop.reihenfolge}`}
                          </span>
                          {order?.kunde_name && (
                            <span className="text-[9px] text-slate-400 ml-1">{order.kunde_name}</span>
                          )}
                          {isDone && stop.geliefert_am && (
                            <span className="block text-[9px] text-emerald-600">
                              Geliefert {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {isCurrent && order?.eta_earliest && (
                            <span className="block text-[9px] text-indigo-600">
                              ETA {new Date(order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 bg-slate-50">
        <Trophy className="h-3 w-3 text-indigo-400" />
        <span className="text-[9px] text-slate-400">{activeBatches.length} aktive Touren • 20-Sek-Polling</span>
        <div className="ml-auto flex items-center gap-1.5">
          {[{ label: '85+', color: 'bg-emerald-400' }, { label: '70+', color: 'bg-yellow-400' }, { label: '<70', color: 'bg-red-400' }].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-0.5 text-[8px] text-slate-500">
              <span className={cn('h-1.5 w-1.5 rounded-full', color)} /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
