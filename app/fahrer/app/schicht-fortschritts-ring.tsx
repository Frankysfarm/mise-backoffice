'use client';

import React, { useEffect, useState } from 'react';
import { Clock, TrendingUp, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  geliefert_am: string | null;
  order?: { gesamtbetrag?: number } | null;
};

type ActiveBatch = {
  started_at: string | null;
  stops: Stop[];
};

type Props = {
  driverName: string;
  onlineSeit: string | null;
  activeBatch: ActiveBatch | null;
  schichtDauerMin?: number; // Standard: 480 Min (8h)
};

/* Ultra-kompakter Schicht-Fortschrittsring für Fahrer:
   Zeigt Schichtzeit-Nutzung, abgeschlossene Stops und Einnahmen-Rate. */
export function FahrerSchichtFortschrittsRing({
  driverName,
  onlineSeit,
  activeBatch,
  schichtDauerMin = 480,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!onlineSeit) return null;

  const onlineMs = new Date(onlineSeit).getTime();
  const elapsedMin = Math.floor((now - onlineMs) / 60_000);
  const remainMin = Math.max(0, schichtDauerMin - elapsedMin);
  const schichtPct = Math.min(100, Math.round((elapsedMin / schichtDauerMin) * 100));

  const deliveredStops = activeBatch?.stops.filter((s) => s.geliefert_am) ?? [];
  const totalRevenue = deliveredStops.reduce(
    (sum, s) => sum + (s.order?.gesamtbetrag ?? 0),
    0,
  );
  const revenuePerHour =
    elapsedMin > 0 ? (totalRevenue / elapsedMin) * 60 : 0;

  // SVG Ring
  const R = 32;
  const C = 2 * Math.PI * R;
  const dash = (schichtPct / 100) * C;

  const ringColor =
    schichtPct >= 85 ? '#dc2626' : schichtPct >= 60 ? '#f59e0b' : '#4d7c0f';

  const fmtMin = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  return (
    <div className="rounded-xl border bg-card p-3 flex items-center gap-4">
      {/* Ring */}
      <div className="relative shrink-0">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={R} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={R} fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeDasharray={`${dash} ${C - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="36" textAnchor="middle" style={{ fontSize: 14, fontWeight: 900, fill: 'currentColor' }}>
            {schichtPct}%
          </text>
          <text x="40" y="50" textAnchor="middle" style={{ fontSize: 8, fill: '#6b7280' }}>
            Schicht
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex-1 space-y-1.5">
        <div className="text-xs font-bold text-foreground truncate">{driverName}</div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{fmtMin(elapsedMin)} aktiv · noch {fmtMin(remainMin)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <TrendingUp className="h-3 w-3 shrink-0" />
          <span>{deliveredStops.length} Lieferungen · {deliveredStops.length > 0 ? Math.round(elapsedMin / deliveredStops.length) + ' Min/Stop' : '–'}</span>
        </div>

        {totalRevenue > 0 && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <Euro className="h-3 w-3 shrink-0 text-matcha-600" />
            <span className="font-bold text-matcha-700">
              {totalRevenue.toFixed(2)} € · {revenuePerHour.toFixed(2)} €/h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
