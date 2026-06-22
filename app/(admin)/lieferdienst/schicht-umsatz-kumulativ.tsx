'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface HourPoint { hour: number; cumulative: number; delta: number }

const MOCK: HourPoint[] = [
  { hour: 10, cumulative: 120, delta: 120 },
  { hour: 11, cumulative: 280, delta: 160 },
  { hour: 12, cumulative: 510, delta: 230 },
  { hour: 13, cumulative: 720, delta: 210 },
  { hour: 14, cumulative: 860, delta: 140 },
  { hour: 15, cumulative: 970, delta: 110 },
  { hour: 16, cumulative: 1100, delta: 130 },
  { hour: 17, cumulative: 1340, delta: 240 },
  { hour: 18, cumulative: 1640, delta: 300 },
];

export function SchichtUmsatzKumulativ({ locationId }: Props) {
  const [data, setData] = useState<HourPoint[]>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/admin/analytics?action=schicht-verlauf&location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (Array.isArray(d?.points) && d.points.length > 0) setData(d.points); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const total = data[data.length - 1]?.cumulative ?? 0;
  const lastDelta = data[data.length - 1]?.delta ?? 0;
  const prevDelta = data[data.length - 2]?.delta ?? 0;
  const trending = lastDelta >= prevDelta;

  const W = 240; const H = 48;
  const maxVal = Math.max(...data.map((d) => d.cumulative), 1);
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W;
    const y = H - (d.cumulative / maxVal) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="rounded-xl border border-matcha-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-semibold text-matcha-900">Kumulativer Schicht-Umsatz</span>
      </div>

      <div className="mb-3 overflow-hidden rounded bg-matcha-50 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke="#4a7c59" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xl font-bold text-matcha-900">{total.toFixed(2)} €</p>
          <p className="text-xs text-matcha-600">Gesamt diese Schicht</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-semibold', trending ? 'text-matcha-600' : 'text-amber-600')}>
            {trending ? '▲' : '▼'} {lastDelta.toFixed(0)} €
          </p>
          <p className="text-xs text-matcha-500">letzte Stunde</p>
        </div>
      </div>
    </div>
  );
}
