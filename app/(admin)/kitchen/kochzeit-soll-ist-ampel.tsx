'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Timer, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface PrepRow {
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
  fertig_am: string | null;
  status: string;
}

interface Stats {
  total: number;
  avgSollMin: number;
  avgIstMin: number;
  deltaMin: number;
  under: number;
  over: number;
  critOver: number;
}

function computeStats(rows: PrepRow[], now: number): Stats {
  const completed = rows.filter(
    (r) => r.fertig_am && r.bestellt_am && r.geschaetzte_zubereitung_min,
  );
  if (completed.length === 0) {
    return { total: 0, avgSollMin: 0, avgIstMin: 0, deltaMin: 0, under: 0, over: 0, critOver: 0 };
  }

  let sumSoll = 0;
  let sumIst = 0;
  let under = 0;
  let over = 0;
  let critOver = 0;

  for (const r of completed) {
    const soll = r.geschaetzte_zubereitung_min!;
    const ist = (new Date(r.fertig_am!).getTime() - new Date(r.bestellt_am!).getTime()) / 60_000;
    sumSoll += soll;
    sumIst += ist;
    const delta = ist - soll;
    if (delta <= 0) under++;
    else if (delta <= 3) over++;
    else { over++; critOver++; }
  }

  const avgSollMin = sumSoll / completed.length;
  const avgIstMin = sumIst / completed.length;
  return {
    total: completed.length,
    avgSollMin: Math.round(avgSollMin * 10) / 10,
    avgIstMin: Math.round(avgIstMin * 10) / 10,
    deltaMin: Math.round((avgIstMin - avgSollMin) * 10) / 10,
    under,
    over: over - critOver,
    critOver,
  };
}

export function KitchenKochzeitSollIstAmpel({ locationId }: Props) {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      const since = new Date(Date.now() - 90 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('customer_orders')
        .select('geschaetzte_zubereitung_min,bestellt_am,fertig_am,status')
        .eq('location_id', locationId)
        .in('status', ['fertig', 'unterwegs', 'geliefert'])
        .gte('fertig_am', since);
      if (data) setStats(computeStats(data, now));
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId, now]);

  if (!locationId || !stats || stats.total === 0) return null;

  const isGood = stats.deltaMin <= 1;
  const isWarn = stats.deltaMin > 1 && stats.deltaMin <= 4;
  const isCrit = stats.deltaMin > 4;

  const ampelColor = isGood ? 'bg-matcha-500' : isWarn ? 'bg-amber-400' : 'bg-red-500';
  const ampelText = isGood ? 'text-matcha-700' : isWarn ? 'text-amber-700' : 'text-red-700';
  const ampelBg = isGood ? 'bg-matcha-50 border-matcha-200' : isWarn ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const pctInTime = Math.round((stats.under / stats.total) * 100);

  return (
    <div className={cn('rounded-2xl border overflow-hidden', ampelBg)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit">
        <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', ampelColor)} />
        <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Kochzeit Soll–Ist · letzte 90 Min
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-muted-foreground border">
          n={stats.total}
        </span>
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        {/* Soll */}
        <div className="rounded-xl bg-white/60 border border-white/80 px-3 py-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Soll</div>
          <div className="text-lg font-black tabular-nums text-foreground">{stats.avgSollMin}</div>
          <div className="text-[9px] text-muted-foreground">Min</div>
        </div>

        {/* Delta */}
        <div className="rounded-xl bg-white/60 border border-white/80 px-3 py-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Δ Abw.</div>
          <div className={cn('text-lg font-black tabular-nums', ampelText)}>
            {stats.deltaMin > 0 ? '+' : ''}{stats.deltaMin}
          </div>
          <div className="text-[9px] text-muted-foreground">Min</div>
        </div>

        {/* Ist */}
        <div className="rounded-xl bg-white/60 border border-white/80 px-3 py-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Ist</div>
          <div className="text-lg font-black tabular-nums text-foreground">{stats.avgIstMin}</div>
          <div className="text-[9px] text-muted-foreground">Min</div>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-white/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', ampelColor)}
            style={{ width: `${pctInTime}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
          {isGood
            ? <><CheckCircle2 className="h-3 w-3 text-matcha-600" /><span className="font-bold text-matcha-700">{pctInTime}% im Ziel</span></>
            : isCrit
            ? <><AlertTriangle className="h-3 w-3 text-red-500" /><span className="font-bold text-red-600">{stats.critOver} kritisch</span></>
            : <><TrendingUp className="h-3 w-3 text-amber-600" /><span className="font-bold text-amber-700">{pctInTime}% im Ziel</span></>
          }
        </div>
      </div>
    </div>
  );
}
