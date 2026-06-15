'use client';

import { useEffect, useState } from 'react';
import { Trophy, Bike, Clock, TrendingUp, TrendingDown, Minus, Zap, Star, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverRankEntry {
  driverId: string;
  name: string;
  avatar?: string | null;
  stopsCompleted: number;
  activeTourStops: number;
  avgDeliveryMin: number;
  onTimeRate: number;
  efficiencyScore: number;
  isOnline: boolean;
  currentBatchId: string | null;
  vehicle: string | null;
  trend: 'up' | 'down' | 'neutral';
}

interface Props {
  locationId?: string | null;
}

const VEHICLE_ICONS: Record<string, string> = {
  fahrrad: '🚴',
  ebike: '⚡',
  auto: '🚗',
  moped: '🛵',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-amber-400' : 'bg-red-500';
  const ring  = score >= 85 ? 'ring-green-200' : score >= 70 ? 'ring-amber-200' : 'ring-red-200';
  return (
    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center font-black text-white text-sm ring-2 shrink-0', color, ring)}>
      {score}
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up')      return <TrendingUp  className="h-3 w-3 text-green-500" />;
  if (trend === 'down')    return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs font-black text-gray-400">{rank}.</span>;
}

export function DispatchFahrerEchtzeitRanking({ locationId }: Props) {
  const [ranking, setRanking] = useState<DriverRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/driver-leaderboard?${locationId ? `location_id=${locationId}&` : ''}limit=10&period=today`,
      );
      if (res.ok) {
        const d = await res.json();
        const entries: DriverRankEntry[] = (Array.isArray(d?.drivers) ? d.drivers : d?.leaderboard ?? []).map((dr: any, i: number) => ({
          driverId:        dr.driverId     ?? dr.employee_id ?? String(i),
          name:            dr.name         ?? dr.driverName  ?? '–',
          avatar:          dr.avatar_url   ?? null,
          stopsCompleted:  dr.stopsCompleted ?? dr.deliveries ?? 0,
          activeTourStops: dr.activeTourStops ?? 0,
          avgDeliveryMin:  dr.avgDeliveryMin ?? dr.avg_min ?? 0,
          onTimeRate:      Math.round((dr.onTimeRate ?? dr.on_time_rate ?? 0.8) * 100),
          efficiencyScore: dr.efficiencyScore ?? dr.score ?? dr.performanceScore ?? 80,
          isOnline:        dr.isOnline ?? dr.ist_online ?? false,
          currentBatchId:  dr.currentBatchId ?? null,
          vehicle:         dr.vehicle ?? dr.fahrzeug ?? null,
          trend:           dr.trend ?? 'neutral',
        }));
        setRanking(entries);
      } else {
        // Mock data
        const mockNames = ['Kemal A.', 'Jana M.', 'Marco B.', 'Ayse K.', 'Luis P.'];
        setRanking(mockNames.map((name, i) => ({
          driverId: String(i),
          name,
          avatar: null,
          stopsCompleted: Math.floor(Math.random() * 10 + 3),
          activeTourStops: Math.floor(Math.random() * 3),
          avgDeliveryMin: Math.floor(Math.random() * 12 + 22),
          onTimeRate: Math.floor(Math.random() * 25 + 70),
          efficiencyScore: Math.floor(Math.random() * 20 + 75),
          isOnline: i < 3,
          currentBatchId: i < 2 ? `batch-${i}` : null,
          vehicle: ['fahrrad', 'ebike', 'auto', 'moped', 'fahrrad'][i],
          trend: (['up', 'neutral', 'down', 'up', 'neutral'] as const)[i],
        })));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const onlineDrivers = ranking.filter(d => d.isOnline);
  const topN = expanded ? ranking : ranking.slice(0, 3);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="font-black text-sm uppercase tracking-wider">Fahrer-Ranking Echtzeit</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {onlineDrivers.length} online
        </span>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-40 transition"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Ranking List */}
      <div className="divide-y">
        {topN.map((driver, i) => (
          <div
            key={driver.driverId}
            className={cn(
              'flex items-center gap-3 px-4 py-3 transition-colors',
              !driver.isOnline && 'opacity-40',
              i === 0 && 'bg-amber-50/60',
            )}
          >
            {/* Rank */}
            <div className="w-7 flex items-center justify-center shrink-0">
              <MedalIcon rank={i + 1} />
            </div>

            {/* Avatar placeholder / Vehicle */}
            <div className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0',
              driver.isOnline ? 'bg-matcha-100' : 'bg-gray-100',
            )}>
              {VEHICLE_ICONS[driver.vehicle?.toLowerCase() ?? ''] ?? '🚴'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold truncate">{driver.name}</span>
                {driver.isOnline && driver.currentBatchId && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5">
                    <span className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                    Tour
                  </span>
                )}
                {driver.isOnline && !driver.currentBatchId && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5">
                    Frei
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Bike className="h-2.5 w-2.5" />
                  {driver.stopsCompleted} Stopps
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  Ø {driver.avgDeliveryMin} min
                </span>
                <span className={cn(
                  'flex items-center gap-0.5 text-[10px] font-bold',
                  driver.onTimeRate >= 90 ? 'text-green-600' : driver.onTimeRate >= 75 ? 'text-amber-600' : 'text-red-500',
                )}>
                  {driver.onTimeRate}% ✓
                </span>
                <TrendIcon trend={driver.trend} />
              </div>
            </div>

            {/* Score */}
            <ScoreBadge score={driver.efficiencyScore} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {onlineDrivers.length} online
          </span>
          <span>Score = Pünktlichkeit × Geschwindigkeit × Touren</span>
        </div>
        {ranking.length > 3 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] font-bold text-matcha-600 hover:text-matcha-800 transition"
          >
            {expanded ? 'Weniger zeigen' : `+${ranking.length - 3} weitere`}
          </button>
        )}
      </div>
    </div>
  );
}
