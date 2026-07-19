'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, ChevronDown, ChevronUp, Euro, Star, TrendingDown, TrendingUp, Truck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type StundeWert = { stunde: string; umsatz: number; lieferungen: number };

type StatData = {
  umsatz_heute: number;
  lieferungen_heute: number;
  avg_lieferzeit_min: number;
  stornoquote_pct: number;
  kundenbewertung: number;
  best_stunde: string | null;
  stunden: StundeWert[];
  vergleich_gestern_pct: number;
  vergleich_vorwoche_pct: number;
  top_zone: string | null;
};

function getMock(): StatData {
  return {
    umsatz_heute: 183450,
    lieferungen_heute: 67,
    avg_lieferzeit_min: 28.4,
    stornoquote_pct: 4.2,
    kundenbewertung: 4.6,
    best_stunde: '19:00',
    vergleich_gestern_pct: 12.3,
    vergleich_vorwoche_pct: -5.1,
    top_zone: 'Nord',
    stunden: [
      { stunde: '11',  umsatz: 8200,  lieferungen: 3  },
      { stunde: '12',  umsatz: 18700, lieferungen: 7  },
      { stunde: '13',  umsatz: 21400, lieferungen: 8  },
      { stunde: '14',  umsatz: 12300, lieferungen: 5  },
      { stunde: '15',  umsatz: 7800,  lieferungen: 3  },
      { stunde: '16',  umsatz: 9100,  lieferungen: 4  },
      { stunde: '17',  umsatz: 14500, lieferungen: 6  },
      { stunde: '18',  umsatz: 27900, lieferungen: 10 },
      { stunde: '19',  umsatz: 31200, lieferungen: 12 },
      { stunde: '20',  umsatz: 22800, lieferungen: 9  },
    ],
  };
}

function euro(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function DeltaBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
      up ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    )}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export function LieferdienstPhase2250StatistikInsightsPro({ tenantId }: { tenantId?: string | null }) {
  const [data, setData] = useState<StatData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/delivery/stats?tenant_id=${tenantId}&period=today`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(getMock());
      }
    } catch {
      setData(getMock());
    }
  }, [tenantId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!tenantId) return null;

  const d = data ?? getMock();
  const maxUmsatz = Math.max(...d.stunden.map(s => s.umsatz), 1);

  return (
    <div className="rounded-xl border bg-card p-4 mb-3 space-y-3">
      <button className="flex w-full items-center justify-between gap-2" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-matcha-50 dark:bg-matcha-950/20">
            <Activity className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Statistiken Insights Pro</p>
            <p className="text-[10px] text-muted-foreground">Umsatz · Lieferzeit · Zonen · Trends</p>
          </div>
          <DeltaBadge pct={d.vergleich_gestern_pct} />
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* Hauptkennzahlen */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                icon: <Euro className="h-3.5 w-3.5" />,
                label: 'Umsatz heute',
                value: euro(d.umsatz_heute),
                sub: <DeltaBadge pct={d.vergleich_gestern_pct} />,
                bg: 'bg-matcha-50 dark:bg-matcha-950/20',
                text: 'text-matcha-700 dark:text-matcha-300',
              },
              {
                icon: <Truck className="h-3.5 w-3.5" />,
                label: 'Lieferungen',
                value: String(d.lieferungen_heute),
                sub: null,
                bg: 'bg-blue-50 dark:bg-blue-950/20',
                text: 'text-blue-700 dark:text-blue-300',
              },
              {
                icon: <Zap className="h-3.5 w-3.5" />,
                label: 'Ø Lieferzeit',
                value: `${d.avg_lieferzeit_min.toFixed(1)} Min`,
                sub: null,
                bg: d.avg_lieferzeit_min > 35 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-amber-50 dark:bg-amber-950/20',
                text: d.avg_lieferzeit_min > 35 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
              },
              {
                icon: <Star className="h-3.5 w-3.5" />,
                label: 'Bewertung',
                value: d.kundenbewertung.toFixed(1),
                sub: <span className="text-[8px] text-muted-foreground">{d.stornoquote_pct}% Storno</span>,
                bg: 'bg-amber-50 dark:bg-amber-950/20',
                text: 'text-amber-600 dark:text-amber-400',
              },
            ].map(k => (
              <div key={k.label} className={cn('rounded-xl border p-3', k.bg)}>
                <div className={cn('flex items-center gap-1 mb-1', k.text)}>{k.icon}</div>
                <p className={cn('text-base font-black tabular-nums leading-tight', k.text)}>{k.value}</p>
                <p className="text-[9px] text-muted-foreground">{k.label}</p>
                {k.sub && <div className="mt-1">{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Stunden-Chart */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Umsatzverlauf heute {d.best_stunde && <span className="text-matcha-600">· Peak: {d.best_stunde} Uhr</span>}
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={d.stunden} barCategoryGap="20%">
                <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => [euro(v), 'Umsatz']}
                  contentStyle={{ fontSize: 10, border: 'none', borderRadius: 8, padding: '4px 8px' }}
                />
                <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                  {d.stunden.map((s) => (
                    <Cell
                      key={s.stunde}
                      fill={s.umsatz === maxUmsatz ? '#4a7c59' : s.umsatz > maxUmsatz * 0.6 ? '#7eaa8e' : '#c7dece'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insight-Chips */}
          <div className="flex flex-wrap gap-1.5">
            {d.top_zone && (
              <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 text-[9px] font-bold">
                📍 Top-Zone: {d.top_zone}
              </span>
            )}
            <span className="rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[9px]">
              vs. Vorwoche: {d.vergleich_vorwoche_pct >= 0 ? '+' : ''}{d.vergleich_vorwoche_pct.toFixed(1)}%
            </span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[9px] font-bold',
              d.stornoquote_pct > 6 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
            )}>
              Storno: {d.stornoquote_pct}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
