'use client';

import React, { useEffect, useState } from 'react';

interface StundeData {
  stunde: number;
  bestellungen: number;
  avgPrepMin: number;
}

interface ApiData {
  stunden: StundeData[];
  currentHour: number;
  totalToday: number;
  avgPrepMinToday: number;
  zielPrepMin: number;
  kapazitaetsStatus: string;
}

const STUNDEN_LABELS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export function KitchenPhase1528TagesUmsatzBalkenChart() {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/delivery/admin/kuechen-durchsatz');
        if (res.ok) setData(await res.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-4 w-44 bg-muted rounded mb-3" />
      <div className="h-16 bg-muted rounded" />
    </div>
  );

  const relevant = data.stunden.filter(s => s.stunde <= data.currentHour);
  const maxCount = Math.max(...relevant.map(s => s.bestellungen), 1);
  const peakHour = relevant.reduce(
    (best, s) => s.bestellungen > best.bestellungen ? s : best,
    relevant[0] ?? { stunde: -1, bestellungen: 0, avgPrepMin: 0 }
  );
  const overTarget = data.avgPrepMinToday > data.zielPrepMin;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Tages-Durchsatz</h3>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Gesamt: <span className="font-bold text-foreground">{data.totalToday}</span></span>
          {data.avgPrepMinToday > 0 && (
            <span>Ø Prep: <span className={`font-bold ${overTarget ? 'text-red-600' : 'text-green-600'}`}>{data.avgPrepMinToday} Min</span></span>
          )}
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${relevant.length * 20} 64`}
          preserveAspectRatio="none"
          style={{ width: '100%', minWidth: `${relevant.length * 14}px`, height: '64px' }}
        >
          {relevant.map((s, i) => {
            const barH = Math.max(2, Math.round((s.bestellungen / maxCount) * 52));
            const isPeak = s.stunde === peakHour?.stunde && s.bestellungen > 0;
            const isCurrent = s.stunde === data.currentHour;
            const fill = isPeak ? '#f59e0b' : isCurrent ? '#3b82f6' : '#6366f1';
            return (
              <g key={s.stunde}>
                <rect x={i * 20 + 2} y={60 - barH} width={16} height={barH} rx={2} fill={fill} opacity={0.85} />
                {isPeak && (
                  <text x={i * 20 + 10} y={60 - barH - 3} textAnchor="middle" fontSize="7" fill="#f59e0b" fontWeight="bold">▲</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* X-axis labels every 3h */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {relevant.filter((_, i) => i % 3 === 0).map(s => (
          <span key={s.stunde}>{STUNDEN_LABELS[s.stunde]}</span>
        ))}
      </div>

      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-yellow-500 inline-block" />
          Peak{peakHour.stunde >= 0 ? ` (${STUNDEN_LABELS[peakHour.stunde]} Uhr, ${peakHour.bestellungen})` : ''}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
          Aktuelle Stunde
        </span>
      </div>
    </div>
  );
}
