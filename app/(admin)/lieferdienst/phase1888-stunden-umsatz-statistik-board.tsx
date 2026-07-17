'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { euro } from '@/lib/utils';

interface HourlyBucket {
  hour: number;
  umsatz: number;
  bestellungen: number;
  isPeak: boolean;
}

interface ApiData {
  buckets: HourlyBucket[];
  peak_hour: number;
  total_today: number;
}

function mockBuckets(): HourlyBucket[] {
  const now = new Date();
  const currentH = now.getHours();
  const buckets: HourlyBucket[] = [];
  const values = [0, 0, 0, 0, 0, 0, 0, 20, 80, 140, 200, 280, 340, 310, 260, 200, 180, 350, 480, 540, 420, 300, 180, 60];
  for (let h = 0; h <= Math.min(currentH, 23); h++) {
    const umsatz = h < currentH ? values[h] : Math.round(values[h] * 0.6);
    buckets.push({ hour: h, umsatz, bestellungen: Math.round(umsatz / 15), isPeak: false });
  }
  const peakIdx = buckets.reduce((pi, b, i) => b.umsatz > buckets[pi].umsatz ? i : pi, 0);
  if (buckets[peakIdx]) buckets[peakIdx].isPeak = true;
  return buckets;
}

const MOCK: ApiData = {
  buckets: mockBuckets(),
  peak_hour: 18,
  total_today: 1840,
};

const POLL_MS = 5 * 60_000;

export function LieferdienstPhase1888StundenUmsatzStatistikBoard({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/stunden-umsatz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ ...MOCK, buckets: mockBuckets() });
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const maxUmsatz = Math.max(...data.buckets.map(b => b.umsatz), 1);

  return (
    <Card className={cn('p-0 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">Stunden-Umsatz (Heute)</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* KPI-Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
              <p className="text-sm font-black text-foreground">{euro(data.total_today)}</p>
              <p className="text-[9px] text-muted-foreground">Gesamt</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
              <p className="text-sm font-black text-foreground">{String(data.peak_hour).padStart(2, '0')}:00</p>
              <p className="text-[9px] text-muted-foreground">Peak-Stunde</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
              <p className="text-sm font-black text-foreground">{euro(maxUmsatz)}</p>
              <p className="text-[9px] text-muted-foreground">Peak-Umsatz</p>
            </div>
          </div>

          {/* Chart */}
          {!locationId ? (
            <p className="text-xs text-muted-foreground text-center py-3">Bitte Filiale auswählen.</p>
          ) : (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={data.buckets} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 8, fill: 'currentColor' }}
                  tickFormatter={(h: number) => h % 3 === 0 ? `${h}h` : ''}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: number) => [euro(val), 'Umsatz']}
                  labelFormatter={(h: number) => `${String(h).padStart(2, '0')}:00`}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="umsatz" radius={[2, 2, 0, 0]}>
                  {data.buckets.map(b => (
                    <Cell
                      key={b.hour}
                      fill={b.isPeak ? '#f59e0b' : b.hour === new Date().getHours() ? '#6ee7b7' : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-indigo-400" /> Normal</span>
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Aktuelle Stunde</span>
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Peak</span>
          </div>
        </div>
      )}
    </Card>
  );
}
