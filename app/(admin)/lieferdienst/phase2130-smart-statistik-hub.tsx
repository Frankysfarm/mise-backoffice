'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Clock, Package, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiKachel {
  label: string;
  wert: string;
  delta?: string;
  trend: 'up' | 'down' | 'neutral';
  sub?: string;
}

interface StundeEintrag {
  stunde: string;
  bestellungen: number;
}

interface ApiData {
  kpis: KpiKachel[];
  stunden: StundeEintrag[];
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Bestellungen Heute', wert: '84',    delta: '+12%', trend: 'up',   sub: 'vs. gestern' },
    { label: 'Ø Lieferzeit',       wert: '28 Min', delta: '-3m',  trend: 'up',   sub: 'Ziel: <30 Min' },
    { label: 'Pünktlichkeit',      wert: '88%',    delta: '+2%',  trend: 'up',   sub: 'Ziel: ≥85%' },
    { label: 'Aktive Fahrer',      wert: '6',      delta: '',     trend: 'neutral', sub: 'Schicht heute' },
    { label: 'Stornoquote',        wert: '3,2%',   delta: '+0.5%', trend: 'down', sub: 'Ziel: <5%' },
    { label: 'Umsatz Heute',       wert: '1.820 €', delta: '+8%', trend: 'up',   sub: 'Schichtbeginn' },
  ],
  stunden: [
    { stunde: '11', bestellungen: 6  },
    { stunde: '12', bestellungen: 14 },
    { stunde: '13', bestellungen: 18 },
    { stunde: '14', bestellungen: 10 },
    { stunde: '15', bestellungen: 7  },
    { stunde: '16', bestellungen: 9  },
    { stunde: '17', bestellungen: 20 },
    { stunde: '18', bestellungen: 0  },
  ],
};

const ICONS: Record<string, React.ReactNode> = {
  'Bestellungen Heute': <Package className="h-3.5 w-3.5" />,
  'Ø Lieferzeit':       <Clock className="h-3.5 w-3.5" />,
  'Pünktlichkeit':      <TrendingUp className="h-3.5 w-3.5" />,
  'Aktive Fahrer':      <Users className="h-3.5 w-3.5" />,
  'Stornoquote':        <TrendingDown className="h-3.5 w-3.5" />,
  'Umsatz Heute':       <BarChart3 className="h-3.5 w-3.5" />,
};

interface Props { locationId?: string | null }

export function LieferdienstPhase2130SmartStatistikHub({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/statistik-hub?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const maxBest = Math.max(...(data.stunden?.map(s => s.bestellungen) ?? [1]), 1);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Smart Statistik-Hub · Heute
        </span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.kpis.map(kpi => (
              <div
                key={kpi.label}
                className={cn(
                  'rounded-lg border p-2.5',
                  kpi.trend === 'up'   ? 'bg-matcha-50 border-matcha-200'
                  : kpi.trend === 'down' ? 'bg-red-50 border-red-200'
                  : 'bg-muted/30'
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn(
                    kpi.trend === 'up' ? 'text-matcha-600' : kpi.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {ICONS[kpi.label] ?? <BarChart3 className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-[9px] text-muted-foreground truncate">{kpi.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-black tabular-nums">{kpi.wert}</span>
                  {kpi.delta && (
                    <span className={cn(
                      'text-[9px] font-bold',
                      kpi.trend === 'up' ? 'text-matcha-600' : kpi.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                    )}>
                      {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : ''}
                      {kpi.delta}
                    </span>
                  )}
                </div>
                {kpi.sub && <div className="text-[8px] text-muted-foreground mt-0.5">{kpi.sub}</div>}
              </div>
            ))}
          </div>

          {/* Stunden-Verlauf Mini-Chart */}
          {data.stunden.length > 0 && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                Bestellungen nach Stunde
              </div>
              <div className="flex items-end gap-1 h-12">
                {data.stunden.map(s => {
                  const h = s.bestellungen === 0 ? 0 : Math.max(8, Math.round((s.bestellungen / maxBest) * 48));
                  const isHot = s.bestellungen === maxBest;
                  return (
                    <div key={s.stunde} className="flex flex-col items-center gap-0.5 flex-1">
                      <div
                        className={cn('w-full rounded-t', isHot ? 'bg-orange-400' : 'bg-muted-foreground/30')}
                        style={{ height: `${h}px` }}
                        title={`${s.stunde}:00 — ${s.bestellungen} Bestellungen`}
                      />
                      <span className="text-[7px] text-muted-foreground tabular-nums">{s.stunde}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
