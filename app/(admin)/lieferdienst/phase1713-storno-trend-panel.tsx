'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { XCircle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  locationId: string | null | undefined;
}

interface HourData {
  hour: string;
  count: number;
}

interface ApiResponse {
  total_stornos_heute: number;
  storno_rate_pct: number;
  trend: 'up' | 'down' | 'flat';
  by_hour: HourData[];
}

function mockData(): ApiResponse {
  const now = new Date().getHours();
  const by_hour: HourData[] = [];
  for (let h = Math.max(0, now - 5); h <= now; h++) {
    by_hour.push({ hour: `${h}:00`, count: Math.floor(Math.random() * 3) });
  }
  const total = by_hour.reduce((s, h) => s + h.count, 0);
  return {
    total_stornos_heute: total,
    storno_rate_pct: total > 0 ? Math.round(Math.random() * 12 * 10) / 10 : 2.1,
    trend: total > 3 ? 'up' : total === 0 ? 'flat' : 'down',
    by_hour,
  };
}

export function LieferdienstPhase1713StornoTrendPanel({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setData(mockData()); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/storno-trend?locationId=${locationId}`);
        if (!cancelled && res.ok) setData(await res.json());
        else if (!cancelled) setData(mockData());
      } catch {
        if (!cancelled) setData(mockData());
      }
    };
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const maxCount = useMemo(
    () => Math.max(...(data?.by_hour.map((h) => h.count) ?? [0]), 1),
    [data],
  );

  if (!data) return null;

  const rateColor =
    data.storno_rate_pct > 10 ? 'text-red-600' : data.storno_rate_pct > 5 ? 'text-amber-600' : 'text-matcha-700';
  const rateLabel =
    data.storno_rate_pct > 10 ? 'Hoch' : data.storno_rate_pct > 5 ? 'Mittel' : 'Niedrig';
  const rateBg =
    data.storno_rate_pct > 10 ? 'bg-red-100' : data.storno_rate_pct > 5 ? 'bg-amber-100' : 'bg-matcha-100';

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Storno-Trend</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', rateBg, rateColor)}>
            {data.storno_rate_pct}% · {rateLabel}
          </span>
          {data.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
          {data.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-matcha-600" />}
          {data.trend === 'flat' && <Minus className="h-3.5 w-3.5 text-amber-500" />}
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold ml-auto">
            {data.total_stornos_heute} heute
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          <div className="flex items-end gap-1.5 h-16">
            {data.by_hour.map((h, i) => {
              const pct = (h.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col justify-end" style={{ height: '52px' }}>
                    {h.count > 0 ? (
                      <div
                        className="w-full rounded-t bg-red-400 transition-all duration-500"
                        style={{ height: `${pct}%` }}
                        title={`${h.hour}: ${h.count} Stornos`}
                      />
                    ) : (
                      <div className="w-full h-0.5 rounded bg-muted" />
                    )}
                  </div>
                  <span className="text-[8px] text-muted-foreground font-mono leading-none">{h.hour}</span>
                  {h.count > 0 && (
                    <span className="text-[8px] font-black text-red-600 tabular-nums">{h.count}</span>
                  )}
                </div>
              );
            })}
          </div>

          {data.total_stornos_heute === 0 && (
            <p className="text-center text-xs text-matcha-600 font-semibold mt-2">Keine Stornos heute ✓</p>
          )}
        </div>
      )}
    </Card>
  );
}
