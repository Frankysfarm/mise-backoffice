'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Clock, Loader2, Star, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DriverRow {
  rank: number;
  driverId: string;
  driverName: string | null;
  toursCompleted: number;
  stopsCompleted: number;
  onTimeRate: number | null;
  avgDeliveryMin: number | null;
  earningsEur: number;
}

interface ApiResponse {
  total: number;
  entries: DriverRow[];
}

const MOCK: DriverRow[] = [
  { rank: 1, driverId: 'd1', driverName: 'Marco R.',  toursCompleted: 4, stopsCompleted: 12, onTimeRate: 0.92, avgDeliveryMin: 18, earningsEur: 9.6  },
  { rank: 2, driverId: 'd2', driverName: 'Ayşe K.',   toursCompleted: 3, stopsCompleted: 10, onTimeRate: 0.88, avgDeliveryMin: 21, earningsEur: 8.0  },
  { rank: 3, driverId: 'd3', driverName: 'Jonas H.',  toursCompleted: 3, stopsCompleted: 9,  onTimeRate: 0.81, avgDeliveryMin: 23, earningsEur: 7.2  },
  { rank: 4, driverId: 'd4', driverName: 'Lena M.',   toursCompleted: 2, stopsCompleted: 7,  onTimeRate: 0.78, avgDeliveryMin: 25, earningsEur: 5.6  },
  { rank: 5, driverId: 'd5', driverName: 'Ben S.',    toursCompleted: 2, stopsCompleted: 5,  onTimeRate: 0.65, avgDeliveryMin: 31, earningsEur: 4.0  },
];

function onTimeBadge(rate: number | null) {
  if (rate == null) return { label: '–',     cls: 'bg-muted text-muted-foreground' };
  const pct = Math.round(rate * 100);
  if (pct >= 90) return { label: `${pct}%`, cls: 'bg-matcha-100 text-matcha-800 border border-matcha-300' };
  if (pct >= 75) return { label: `${pct}%`, cls: 'bg-amber-100 text-amber-800 border border-amber-300' };
  return              { label: `${pct}%`, cls: 'bg-red-100 text-red-700 border border-red-300' };
}

function rankBadge(rank: number) {
  if (rank === 1) return 'text-yellow-500';
  if (rank === 2) return 'text-slate-400';
  if (rank === 3) return 'text-amber-700';
  return 'text-muted-foreground';
}

export function DispatchFahrerTagesBilanz({ locationId }: { locationId?: string | null }) {
  const [open, setOpen]       = useState(true);
  const [rows, setRows]       = useState<DriverRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!locationId) { setRows(MOCK); setTotal(MOCK.length); return; }
    setLoading(true);
    fetch(`/api/delivery/admin/driver-leaderboard?location_id=${encodeURIComponent(locationId)}&period=today&limit=10`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: ApiResponse) => {
        const entries = d.entries ?? [];
        setRows(entries.length > 0 ? entries : MOCK);
        setTotal(d.total ?? entries.length);
      })
      .catch(() => { setRows(MOCK); setTotal(MOCK.length); })
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  const activeDrivers = rows.filter(r => r.toursCompleted > 0).length;
  const totalDeliveries = rows.reduce((s, r) => s + r.stopsCompleted, 0);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Tages-Bilanz</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {activeDrivers} aktiv · {totalDeliveries} Liefer.
        </Badge>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Noch keine Fahrer-Daten für heute
            </div>
          )}
          {rows.map((row) => {
            const badge = onTimeBadge(row.onTimeRate);
            const rankCls = rankBadge(row.rank);
            return (
              <div key={row.driverId} className="flex items-center gap-3 px-4 py-2.5">
                {/* Rank */}
                <span className={cn('w-5 text-center text-xs font-black tabular-nums shrink-0', rankCls)}>
                  {row.rank <= 3 ? ['①','②','③'][row.rank - 1] : row.rank}
                </span>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold truncate">
                      {row.driverName ?? 'Unbekannt'}
                    </span>
                    <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold', badge.cls)}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{row.toursCompleted} Tour{row.toursCompleted !== 1 ? 'en' : ''}</span>
                    <span>{row.stopsCompleted} Stopps</span>
                    {row.avgDeliveryMin != null && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        ø {Math.round(row.avgDeliveryMin)} Min
                      </span>
                    )}
                  </div>
                </div>

                {/* Earnings */}
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-0.5 text-[11px] font-bold text-yellow-600">
                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                    {row.earningsEur.toFixed(2).replace('.', ',')} €
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 py-2 bg-muted/20">
            <span className="text-[10px] text-muted-foreground">
              Gesamt: {total} Fahrer · Pünktlichkeit + Touren + Einnahmen · 5-Min-Refresh
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
