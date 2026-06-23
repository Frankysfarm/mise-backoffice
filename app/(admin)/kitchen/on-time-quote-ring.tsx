'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface QuoteData {
  total: number;
  onTime: number;
  late: number;
  quotePct: number;
  trend: 'up' | 'down' | 'stable';
  prevQuotePct: number;
}

function computeOnTimeQuote(
  orders: { ready_target: string | null; fertig_am: string | null; status: string }[],
): QuoteData {
  const finished = orders.filter((o) => o.fertig_am && o.status === 'fertig');
  if (finished.length === 0) return { total: 0, onTime: 0, late: 0, quotePct: 0, trend: 'stable', prevQuotePct: 0 };

  const now = Date.now();
  const cutoff60 = now - 60 * 60 * 1000;
  const cutoff120 = now - 120 * 60 * 1000;

  const last60 = finished.filter((o) => new Date(o.fertig_am!).getTime() > cutoff60);
  const prev60 = finished.filter(
    (o) =>
      new Date(o.fertig_am!).getTime() > cutoff120 &&
      new Date(o.fertig_am!).getTime() <= cutoff60,
  );

  const onTimeCount = (list: typeof finished) =>
    list.filter((o) => {
      if (!o.ready_target) return true;
      return new Date(o.fertig_am!).getTime() <= new Date(o.ready_target).getTime() + 2 * 60 * 1000;
    }).length;

  const onTime = onTimeCount(last60);
  const total = last60.length;
  const quotePct = total > 0 ? Math.round((onTime / total) * 100) : 0;

  const prevTotal = prev60.length;
  const prevOnTime = onTimeCount(prev60);
  const prevQuotePct = prevTotal > 0 ? Math.round((prevOnTime / prevTotal) * 100) : 0;

  const diff = quotePct - prevQuotePct;
  const trend: QuoteData['trend'] = Math.abs(diff) < 5 ? 'stable' : diff > 0 ? 'up' : 'down';

  return { total, onTime, late: total - onTime, quotePct, trend, prevQuotePct };
}

export function KitchenOnTimeQuoteRing({ locationId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<QuoteData | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from('customer_orders')
        .select('ready_target,fertig_am,status')
        .eq('location_id', locationId)
        .in('status', ['fertig', 'geliefert', 'abgeholt'])
        .gte('fertig_am', since);
      if (!mountedRef.current) return;
      setData(computeOnTimeQuote(rows ?? []));
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId || !data) return null;

  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const strokePct = circ * (1 - data.quotePct / 100);

  const color =
    data.quotePct >= 85 ? '#4a7c59' :
    data.quotePct >= 70 ? '#d97706' : '#dc2626';

  const TrendIcon =
    data.trend === 'up' ? TrendingUp :
    data.trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Pünktlichkeitsquote · letzte 60 Min</span>
        {data.total > 0 && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {data.total} Bestellungen
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 px-5 py-4">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle
              cx="56" cy="56" r={radius} fill="none"
              stroke={color} strokeWidth="10"
              strokeDasharray={circ}
              strokeDashoffset={strokePct}
              strokeLinecap="round"
              transform="rotate(-90 56 56)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black text-2xl tabular-nums leading-none" style={{ color }}>
              {data.quotePct}%
            </span>
            <span className="text-[9px] text-muted-foreground mt-0.5">pünktlich</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <TrendIcon
              className={cn(
                'h-4 w-4 shrink-0',
                data.trend === 'up' ? 'text-matcha-600' :
                data.trend === 'down' ? 'text-red-500' : 'text-muted-foreground',
              )}
            />
            <span className="text-xs text-muted-foreground">
              Vorherige 60 Min: <strong>{data.prevQuotePct}%</strong>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-matcha-700 font-medium">Pünktlich</span>
              <span className="font-bold tabular-nums text-matcha-700">{data.onTime}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-600 font-medium">Verspätet</span>
              <span className="font-bold tabular-nums text-red-600">{data.late}</span>
            </div>
          </div>
          <div
            className={cn(
              'mt-1 rounded-lg px-2 py-1 text-[10px] font-bold text-center',
              data.quotePct >= 85 ? 'bg-matcha-50 text-matcha-700' :
              data.quotePct >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
            )}
          >
            {data.quotePct >= 85 ? 'Küche läuft sehr gut' :
             data.quotePct >= 70 ? 'Leicht unter Ziel (85%)' : 'Aufmerksamkeit nötig!'}
          </div>
        </div>
      </div>
    </div>
  );
}
