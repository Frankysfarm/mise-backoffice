'use client';

/**
 * DispatchDelayRisikoAmpel — Phase 317
 *
 * Kompakte Ampel für das Dispatch-Panel: Wie viele aktive Bestellungen sind
 * Verspätungsrisiko (critical/high/medium/low)?
 * Polling alle 60 s auf /api/delivery/admin/order-delay-prediction?action=dashboard
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, ShieldCheck, Zap } from 'lucide-react';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Summary {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgRiskScore: number;
}

const LEVEL_CFG: Record<RiskLevel, { label: string; bg: string; border: string; text: string; icon: React.ReactNode }> = {
  critical: { label: 'Kritisch', bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  high:     { label: 'Hoch',     bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', icon: <Zap className="h-3.5 w-3.5" /> },
  medium:   { label: 'Mittel',   bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  icon: <Clock className="h-3.5 w-3.5" /> },
  low:      { label: 'Niedrig',  bg: 'bg-matcha-50', border: 'border-matcha-300', text: 'text-matcha-700', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
};

export function DispatchDelayRisikoAmpel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Summary | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/order-delay-prediction?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const d = await res.json();
      if (d.summary) setData(d.summary as Summary);
    } catch {}
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data || data.totalActive === 0) return null;

  const urgentCount = data.criticalCount + data.highCount;
  const dominantLevel: RiskLevel =
    data.criticalCount > 0 ? 'critical' :
    data.highCount > 0     ? 'high'     :
    data.mediumCount > 0   ? 'medium'   : 'low';

  const cfg = LEVEL_CFG[dominantLevel];

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', cfg.bg, cfg.border)}>
      <div className={cn('shrink-0', cfg.text)}>{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold', cfg.text)}>
          Verspätungsrisiko — {cfg.label}
        </div>
        <div className="text-[11px] text-stone-500 mt-0.5">
          {data.totalActive} aktive Prognosen · Ø Score {Math.round(data.avgRiskScore)}
          {urgentCount > 0 && (
            <span className="ml-1 font-bold text-red-600"> · {urgentCount} dringend</span>
          )}
        </div>
      </div>
      {/* Mini-Balken: kritisch / hoch / mittel / niedrig */}
      <div className="shrink-0 flex gap-1 items-end h-7">
        {([
          { count: data.lowCount,      color: 'bg-matcha-400' },
          { count: data.mediumCount,   color: 'bg-amber-400'  },
          { count: data.highCount,     color: 'bg-orange-500' },
          { count: data.criticalCount, color: 'bg-red-500'    },
        ] as const).map((b, i) => {
          const h = data.totalActive > 0 ? Math.max(4, Math.round((b.count / data.totalActive) * 28)) : 4;
          return (
            <div
              key={i}
              className={cn('w-2.5 rounded-sm', b.color, b.count === 0 && 'opacity-20')}
              style={{ height: `${h}px` }}
              title={`${b.count}`}
            />
          );
        })}
      </div>
    </div>
  );
}
