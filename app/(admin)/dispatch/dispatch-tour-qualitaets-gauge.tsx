'use client';

/**
 * Dispatch Tour-Qualitäts-Gauge
 * Radiale Score-Gauges je Fahrer + Live-Tour-Status + Farb-Ampel
 * Polling: 30 Sek.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Trophy, Bike, AlertTriangle, TrendingUp } from 'lucide-react';

type DriverScore = {
  id: string;
  name: string;
  score: number; // 0–100
  tours: number;
  on_time_rate: number; // 0–1
  active: boolean;
};

function gaugeColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

function ScoreGauge({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270° arc
  const fill = arc * (score / 100);
  const color = gaugeColor(score);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={6}
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeLinecap="round"
      />
      {/* Score arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export function DispatchTourQualitaetsGauge({ locationId }: { locationId?: string }) {
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const supabase = createClient();

  async function load() {
    const { data: raw } = await supabase
      .from('mise_drivers')
      .select('id, name, total_score, tours_today, on_time_rate, is_online')
      .order('total_score', { ascending: false })
      .limit(8);

    if (!raw) return;
    setDrivers(
      raw.map((d: any) => ({
        id: d.id,
        name: d.name ?? 'Fahrer',
        score: Math.min(100, Math.max(0, d.total_score ?? 0)),
        tours: d.tours_today ?? 0,
        on_time_rate: d.on_time_rate ?? 0,
        active: d.is_online ?? false,
      })),
    );
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const avgScore =
    drivers.length > 0
      ? Math.round(drivers.reduce((s, d) => s + d.score, 0) / drivers.length)
      : 0;
  const activeCount = drivers.filter((d) => d.active).length;
  const low = drivers.filter((d) => d.score < 60 && d.active);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white">Fahrer-Score-Übersicht</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">{activeCount} online</span>
          <span
            className={cn(
              'text-sm font-bold',
              avgScore >= 80 ? 'text-green-400' : avgScore >= 60 ? 'text-yellow-400' : 'text-red-400',
            )}
          >
            Ø {avgScore}
          </span>
        </div>
      </div>

      {/* Alert for low scorers */}
      {low.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">
            {low.length} Fahrer unter 60 Pkt – Coaching empfohlen
          </span>
        </div>
      )}

      {/* Driver gauges grid */}
      {drivers.length === 0 ? (
        <p className="text-center text-xs text-white/30 py-4">Keine Fahrerdaten</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {drivers.slice(0, 8).map((driver) => (
            <div
              key={driver.id}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-2',
                driver.active
                  ? 'border-white/10 bg-white/5'
                  : 'border-white/5 bg-white/[0.02] opacity-50',
              )}
            >
              <div className="relative">
                <ScoreGauge score={driver.score} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: gaugeColor(driver.score) }}
                  >
                    {driver.score}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-white/80 truncate max-w-[72px]">
                  {driver.name.split(' ')[0]}
                </p>
                <div className="flex items-center gap-1 justify-center">
                  <Bike className="h-2.5 w-2.5 text-blue-400" />
                  <span className="text-[10px] text-white/40">{driver.tours} Touren</span>
                </div>
              </div>
              {/* On-time bar */}
              <div className="w-full h-1 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.round(driver.on_time_rate * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team trend */}
      {drivers.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <TrendingUp className="h-3 w-3 text-green-400" />
          <span>
            Beste: <span className="text-white/70">{drivers[0]?.name.split(' ')[0]} ({drivers[0]?.score} Pkt)</span>
          </span>
          <span className="ml-auto">
            Pünktlich: <span className="text-white/70">{Math.round((drivers[0]?.on_time_rate ?? 0) * 100)}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
