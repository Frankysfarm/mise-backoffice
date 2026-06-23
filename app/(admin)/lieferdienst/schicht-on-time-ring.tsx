'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface OnTimeData {
  total: number;
  onTime: number;
  late: number;
  pct: number;
  prevPct: number;
  trend: 'up' | 'down' | 'stable';
}

function computeOnTime(
  rows: { fertig_am: string | null; ready_target: string | null }[],
  windowMs: number,
  now: number,
): { total: number; onTime: number } {
  const since = now - windowMs;
  const window = rows.filter(
    (r) => r.fertig_am && new Date(r.fertig_am).getTime() > since,
  );
  const onTime = window.filter((r) => {
    if (!r.ready_target) return true;
    return new Date(r.fertig_am!).getTime() <= new Date(r.ready_target).getTime() + 3 * 60_000;
  }).length;
  return { total: window.length, onTime };
}

export function SchichtOnTimeRing({ locationId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<OnTimeData | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from('customer_orders')
        .select('fertig_am,ready_target')
        .eq('location_id', locationId)
        .in('status', ['fertig', 'unterwegs', 'geliefert'])
        .gte('fertig_am', since4h);
      if (!mountedRef.current || !rows) return;

      const now = Date.now();
      const curr = computeOnTime(rows, 2 * 60 * 60_000, now);
      const prev = computeOnTime(rows, 4 * 60 * 60_000, now - 2 * 60 * 60_000);

      const pct = curr.total > 0 ? Math.round((curr.onTime / curr.total) * 100) : 0;
      const prevPct = prev.total > 0 ? Math.round((prev.onTime / prev.total) * 100) : 0;
      const diff = pct - prevPct;
      const trend: OnTimeData['trend'] = Math.abs(diff) < 5 ? 'stable' : diff > 0 ? 'up' : 'down';

      setData({ total: curr.total, onTime: curr.onTime, late: curr.total - curr.onTime, pct, prevPct, trend });
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId || !data || data.total === 0) return null;

  const color = data.pct >= 85 ? '#4a7c59' : data.pct >= 70 ? '#d97706' : '#dc2626';
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - data.pct / 100);

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Pünktlichkeitsquote · Schicht
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          letzte 2h
        </span>
      </div>

      <div className="flex items-center gap-5 px-5 py-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="9" />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black text-xl tabular-nums leading-none" style={{ color }}>
              {data.pct}%
            </span>
            <span className="text-[8px] text-muted-foreground mt-0.5">pünktlich</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <TrendIcon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                data.trend === 'up' ? 'text-matcha-600' :
                data.trend === 'down' ? 'text-red-500' : 'text-muted-foreground',
              )}
            />
            <span className="text-muted-foreground">
              Vorperiode: <strong>{data.prevPct}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-matcha-50 px-2.5 py-1.5 text-center">
              <div className="text-base font-black text-matcha-700 tabular-nums">{data.onTime}</div>
              <div className="text-[9px] text-matcha-600 font-medium">Pünktlich</div>
            </div>
            <div className="rounded-xl bg-red-50 px-2.5 py-1.5 text-center">
              <div className="text-base font-black text-red-600 tabular-nums">{data.late}</div>
              <div className="text-[9px] text-red-500 font-medium">Verspätet</div>
            </div>
          </div>

          <div
            className={cn(
              'rounded-lg px-2 py-1 text-[10px] font-bold text-center',
              data.pct >= 85 ? 'bg-matcha-50 text-matcha-700' :
              data.pct >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
            )}
          >
            {data.pct >= 85 ? '✓ Ziel erreicht (≥85%)' :
             data.pct >= 70 ? '! Unter Ziel — verbessern' : '⚠ Dringend: Pünktlichkeit prüfen'}
          </div>
        </div>
      </div>
    </div>
  );
}
