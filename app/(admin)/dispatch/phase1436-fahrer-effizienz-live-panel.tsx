'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Bike, TrendingUp, TrendingDown, Target, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Driver {
  id: string;
  name?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  dispatch_score?: number | null;
}

interface Batch {
  id: string;
  driver_id?: string | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  eta_min?: number | null;
  gesamtumsatz?: number | null;
  zone?: string | null;
  tour_score?: number | null;
}

interface Stop {
  id: string;
  batch_id: string;
  status: string;
  position?: number | null;
}

interface DriverStat {
  driver: Driver;
  activeBatch: Batch | null;
  stops: Stop[];
  completedStops: number;
  totalStops: number;
  etaMin: number | null;
  score: number | null;
}

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', vorname: 'Tobias', nachname: 'K.', dispatch_score: 88 },
  { id: 'd2', vorname: 'Maya', nachname: 'R.', dispatch_score: 72 },
  { id: 'd3', vorname: 'Ben', nachname: 'S.', dispatch_score: 55 },
];
const MOCK_BATCHES: Batch[] = [
  { id: 'b1', driver_id: 'd1', status: 'unterwegs', started_at: new Date(Date.now() - 18 * 60_000).toISOString(), eta_min: 7, gesamtumsatz: 38.5, zone: 'Nord', tour_score: 91 },
  { id: 'b2', driver_id: 'd2', status: 'unterwegs', started_at: new Date(Date.now() - 25 * 60_000).toISOString(), eta_min: 12, gesamtumsatz: 52.0, zone: 'Mitte', tour_score: 68 },
  { id: 'b3', driver_id: 'd3', status: 'unterwegs', started_at: new Date(Date.now() - 40 * 60_000).toISOString(), eta_min: 3, gesamtumsatz: 21.0, zone: 'Süd', tour_score: 44 },
];
const MOCK_STOPS: Stop[] = [
  { id: 's1', batch_id: 'b1', status: 'geliefert', position: 1 },
  { id: 's2', batch_id: 'b1', status: 'unterwegs', position: 2 },
  { id: 's3', batch_id: 'b1', status: 'offen', position: 3 },
  { id: 's4', batch_id: 'b2', status: 'geliefert', position: 1 },
  { id: 's5', batch_id: 'b2', status: 'geliefert', position: 2 },
  { id: 's6', batch_id: 'b2', status: 'unterwegs', position: 3 },
  { id: 's7', batch_id: 'b3', status: 'geliefert', position: 1 },
  { id: 's8', batch_id: 'b3', status: 'unterwegs', position: 2 },
];

function scoreColor(s: number | null): string {
  if (s === null) return 'text-stone-400';
  if (s >= 80) return 'text-matcha-600';
  if (s >= 60) return 'text-blue-600';
  if (s >= 40) return 'text-amber-600';
  return 'text-red-500';
}

function scoreBar(s: number | null): string {
  if (s === null) return 'bg-stone-200';
  if (s >= 80) return 'bg-matcha-500';
  if (s >= 60) return 'bg-blue-500';
  if (s >= 40) return 'bg-amber-400';
  return 'bg-red-500';
}

export function DispatchFahrerEffizienzLivePanel() {
  const [stats, setStats] = useState<DriverStat[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from('drivers').select('id,name,vorname,nachname,dispatch_score').eq('aktiv', true).limit(8),
      sb.from('delivery_batches').select('id,driver_id,status,started_at,completed_at,eta_min,gesamtumsatz,zone,tour_score').eq('status', 'unterwegs'),
      sb.from('delivery_stops').select('id,batch_id,status,position'),
    ]).then(([dRes, bRes, sRes]) => {
      const drivers: Driver[] = dRes.data?.length ? (dRes.data as Driver[]) : MOCK_DRIVERS;
      const batches: Batch[] = bRes.data?.length ? (bRes.data as Batch[]) : MOCK_BATCHES;
      const stops: Stop[] = sRes.data?.length ? (sRes.data as Stop[]) : MOCK_STOPS;
      buildStats(drivers, batches, stops);
    });

    function buildStats(drivers: Driver[], batches: Batch[], stops: Stop[]) {
      const result: DriverStat[] = drivers
        .map(d => {
          const batch = batches.find(b => b.driver_id === d.id) ?? null;
          const driverStops = batch ? stops.filter(s => s.batch_id === batch.id) : [];
          return {
            driver: d,
            activeBatch: batch,
            stops: driverStops,
            completedStops: driverStops.filter(s => s.status === 'geliefert').length,
            totalStops: driverStops.length,
            etaMin: batch?.eta_min ?? null,
            score: batch?.tour_score ?? d.dispatch_score ?? null,
          };
        })
        .filter(s => s.activeBatch !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setStats(result);
    }

    buildStats(MOCK_DRIVERS, MOCK_BATCHES, MOCK_STOPS);
  }, []);

  if (!stats.length) return null;

  const avgScore = stats.reduce((s, d) => s + (d.score ?? 0), 0) / (stats.length || 1);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-semibold text-stone-700">Fahrer-Effizienz Live</span>
        </div>
        <Badge variant="outline" className="text-xs">
          Ø Score: <span className={cn('font-bold ml-1', scoreColor(avgScore))}>{avgScore.toFixed(0)}</span>
        </Badge>
      </div>

      <div className="space-y-2">
        {stats.map(({ driver, activeBatch, completedStops, totalStops, etaMin, score }) => {
          const name = driver.vorname && driver.nachname
            ? `${driver.vorname} ${driver.nachname}`
            : driver.name ?? driver.id.slice(0, 6);
          const progress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
          const elapsedMin = activeBatch?.started_at
            ? Math.floor((now - new Date(activeBatch.started_at).getTime()) / 60_000)
            : null;
          const isLate = etaMin !== null && etaMin < 0;

          return (
            <div key={driver.id} className="rounded-lg border border-stone-100 bg-stone-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold', scoreBar(score))}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-800">{name}</div>
                    <div className="text-[10px] text-stone-500">{activeBatch?.zone ?? '—'} · {elapsedMin !== null ? `${elapsedMin}min` : '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLate
                    ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    : etaMin !== null && etaMin <= 5
                    ? <Clock className="w-3.5 h-3.5 text-amber-500" />
                    : <Target className="w-3.5 h-3.5 text-matcha-500" />}
                  <span className={cn('text-xs font-bold', isLate ? 'text-red-500' : 'text-stone-700')}>
                    {etaMin !== null ? (isLate ? `+${Math.abs(etaMin)}min` : `${etaMin}min`) : '—'}
                  </span>
                  <span className={cn('text-sm font-bold', scoreColor(score))}>{score ?? '—'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-stone-500">
                  <span>{completedStops}/{totalStops} Stopps</span>
                  {activeBatch?.gesamtumsatz && <span>{euro(activeBatch.gesamtumsatz)}</span>}
                </div>
                <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreBar(score))}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
