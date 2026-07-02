'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface StundeBucket {
  hour: number;
  label: string;
  umsatz: number;
  bestellungen: number;
  isCurrent: boolean;
}

interface ApiResponse {
  ok: boolean;
  umsatzHeute: number;
  umsatzGestern: number;
  trendPct: number;
  projektionTagesende: number | null;
  stunden: StundeBucket[];
  generatedAt: string;
}

interface Props {
  locationId?: string | null;
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function LieferdienstTagesUmsatzTracker({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/delivery/admin/tages-umsatz-tracker?location_id=${encodeURIComponent(locationId)}`)
        .then(r => r.json())
        .then((d: ApiResponse) => { if (d.ok) setData(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-40 bg-stone-100 animate-pulse rounded mb-3" />
        <div className="h-20 bg-stone-100 animate-pulse rounded" />
      </div>
    );
  }
  if (!data || !locationId) return null;

  const trendUp = data.trendPct > 2;
  const trendDown = data.trendPct < -2;
  const TrendIcon = trendUp ? TrendingUp : trendDown ? TrendingDown : Minus;
  const trendColor = trendUp ? 'text-matcha-600' : trendDown ? 'text-red-500' : 'text-muted-foreground';
  const trendBg = trendUp ? 'bg-matcha-50 text-matcha-700' : trendDown ? 'bg-red-50 text-red-700' : 'bg-stone-50 text-stone-600';

  const maxUmsatz = Math.max(...data.stunden.map(s => s.umsatz), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Euro className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">Tages-Umsatz-Tracker</div>
            <div className="text-xs text-stone-400">Intraday-Umsatz vs. Vortag</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', trendBg)}>
            <TrendIcon className="h-3 w-3" />
            {data.trendPct > 0 ? '+' : ''}{data.trendPct.toFixed(1)}%
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Heute</div>
              <div className="text-base font-black text-emerald-700 tabular-nums leading-tight mt-0.5">
                {fmtEur(data.umsatzHeute)}
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Gestern</div>
              <div className="text-base font-black text-stone-700 tabular-nums leading-tight mt-0.5">
                {fmtEur(data.umsatzGestern)}
              </div>
            </div>
            {data.projektionTagesende !== null && (
              <div className="rounded-xl bg-violet-50 p-3">
                <div className="text-[9px] font-bold uppercase tracking-wider text-violet-600">Prognose</div>
                <div className="text-base font-black text-violet-700 tabular-nums leading-tight mt-0.5">
                  {fmtEur(data.projektionTagesende)}
                </div>
              </div>
            )}
          </div>

          {/* Trend badge */}
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold', trendBg)}>
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
            {trendUp
              ? `+${data.trendPct.toFixed(1)}% über Vortagsvergleich — guter Tag!`
              : trendDown
              ? `${data.trendPct.toFixed(1)}% unter Vortagsvergleich`
              : 'Auf Vortagsniveau'}
          </div>

          {/* Hourly bar chart */}
          {data.stunden.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Stundenverlauf Lieferumsatz
              </div>
              <div className="flex items-end gap-0.5 h-16">
                {data.stunden.map(s => {
                  const heightPct = maxUmsatz > 0 ? (s.umsatz / maxUmsatz) * 100 : 0;
                  return (
                    <div key={s.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div className="w-full rounded-t-sm overflow-hidden" style={{ height: '52px' }}>
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-all duration-500',
                            s.isCurrent ? 'bg-emerald-500' :
                            s.umsatz > 0 ? 'bg-emerald-200' : 'bg-stone-100',
                          )}
                          style={{ height: `${Math.max(2, heightPct)}%`, marginTop: `${100 - Math.max(2, heightPct)}%` }}
                        />
                      </div>
                      <span className="text-[7px] text-muted-foreground tabular-nums">
                        {String(s.hour).padStart(2, '0')}
                      </span>
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                        <div className="rounded bg-stone-800 text-white px-1.5 py-0.5 text-[9px] whitespace-nowrap">
                          {s.label}: {fmtEur(s.umsatz)} ({s.bestellungen} Bestellungen)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground text-right">
            Nur Lieferbestellungen · alle 2 Min
          </div>
        </div>
      )}
    </div>
  );
}
