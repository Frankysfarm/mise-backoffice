'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart2,
  Bike, ChevronDown, ChevronUp, Clock, Euro, Package,
  Star, Target, TrendingUp, Users, Zap,
} from 'lucide-react';

/**
 * Phase 2025 — Statistiken-Schicht-Live-Hub (Lieferdienst)
 *
 * Schicht-Statistiken-Dashboard mit:
 * - 6 KPI-Kacheln (Umsatz, Bestellungen, Ø Lieferzeit, Fahrer online, Bewertung, Abbruchrate)
 * - Trend-Pfeile vs. Vorwoche gleiche Stunde
 * - Stunden-Balken-Chart (aktuelle Schicht)
 * - Fahrer-Rangliste (Top 3)
 * - 60s-Polling + Mock-Daten als Fallback
 */

interface ShiftLiveData {
  umsatz_heute: number;
  bestellungen_heute: number;
  avg_lieferzeit_min: number;
  aktive_fahrer: number;
  avg_bewertung: number;
  abbruchrate_pct: number;
  vs_vorwoche: {
    umsatz: number;
    bestellungen: number;
    lieferzeit: number;
    bewertung: number;
  };
  stunden_verlauf: { h: number; label: string; orders: number; umsatz: number }[];
  top_fahrer: { name: string; lieferungen: number; bewertung: number }[];
}

const MOCK: ShiftLiveData = {
  umsatz_heute: 1247.80,
  bestellungen_heute: 34,
  avg_lieferzeit_min: 31,
  aktive_fahrer: 3,
  avg_bewertung: 4.7,
  abbruchrate_pct: 3.1,
  vs_vorwoche: {
    umsatz: +6.4,
    bestellungen: +4,
    lieferzeit: -3,
    bewertung: +0.1,
  },
  stunden_verlauf: [
    { h: 10, label: '10h', orders: 2,  umsatz: 78  },
    { h: 11, label: '11h', orders: 4,  umsatz: 152 },
    { h: 12, label: '12h', orders: 9,  umsatz: 341 },
    { h: 13, label: '13h', orders: 8,  umsatz: 312 },
    { h: 14, label: '14h', orders: 5,  umsatz: 194 },
    { h: 15, label: '15h', orders: 3,  umsatz: 117 },
    { h: 16, label: '16h', orders: 3,  umsatz: 53  },
  ],
  top_fahrer: [
    { name: 'Max K.', lieferungen: 12, bewertung: 4.9 },
    { name: 'Lena M.', lieferungen: 10, bewertung: 4.8 },
    { name: 'Tom S.',  lieferungen: 9,  bewertung: 4.6 },
  ],
};

const POLL_MS = 60_000;

function Trend({ value, unit = '' }: { value: number; unit?: string }) {
  if (value === 0) return <span className="text-muted-foreground text-[10px]">±0{unit}</span>;
  const pos = value > 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', pos ? 'text-matcha-600' : 'text-red-500')}>
      {pos ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {pos ? '+' : ''}{value}{unit}
    </span>
  );
}

interface Props {
  locationId: string | null;
}

export function LieferdienstPhase2025StatistikenSchichtLiveHub({ locationId }: Props) {
  const [data, setData] = useState<ShiftLiveData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'kpi' | 'chart' | 'fahrer'>('kpi');

  useEffect(() => {
    if (!locationId) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/delivery/stats?location_id=${locationId}&period=today`);
        if (r.ok && alive) {
          const json = await r.json();
          setData((prev) => ({ ...prev, ...json }));
        }
      } catch {}
      finally { if (alive) setLoading(false); }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [locationId]);

  const maxOrders = Math.max(...data.stunden_verlauf.map((h) => h.orders), 1);

  const kpis = [
    {
      icon: Euro,
      label: 'Umsatz',
      value: data.umsatz_heute.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
      trend: <Trend value={data.vs_vorwoche.umsatz} unit="%" />,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      icon: Package,
      label: 'Bestellungen',
      value: String(data.bestellungen_heute),
      trend: <Trend value={data.vs_vorwoche.bestellungen} />,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      icon: Clock,
      label: 'Ø Lieferzeit',
      value: `${data.avg_lieferzeit_min} Min`,
      trend: <Trend value={data.vs_vorwoche.lieferzeit} unit=" Min" />,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      icon: Bike,
      label: 'Fahrer online',
      value: String(data.aktive_fahrer),
      trend: null,
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
    },
    {
      icon: Star,
      label: 'Ø Bewertung',
      value: data.avg_bewertung.toFixed(1),
      trend: <Trend value={data.vs_vorwoche.bewertung} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      icon: Activity,
      label: 'Abbruchrate',
      value: `${data.abbruchrate_pct.toFixed(1)}%`,
      trend: null,
      color: data.abbruchrate_pct > 8 ? 'text-red-700' : 'text-matcha-700',
      bg: data.abbruchrate_pct > 8 ? 'bg-red-50' : 'bg-matcha-50',
    },
  ];

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Live-Hub</span>
        {loading && <Zap className="h-3 w-3 text-amber-400 animate-pulse" />}
        <span className="ml-auto font-mono text-sm font-black text-emerald-700 tabular-nums">
          {data.umsatz_heute.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Tab-Bar */}
          <div className="flex rounded-xl bg-muted p-0.5 gap-0.5">
            {(['kpi', 'chart', 'fahrer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'kpi' ? 'KPIs' : t === 'chart' ? 'Verlauf' : 'Fahrer'}
              </button>
            ))}
          </div>

          {/* KPI Tab */}
          {tab === 'kpi' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {kpis.map(({ icon: Icon, label, value, trend, color, bg }) => (
                <div key={label} className={cn('rounded-xl p-3 space-y-1', bg)}>
                  <div className="flex items-center gap-1">
                    <Icon className={cn('h-3 w-3', color)} />
                    <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                  </div>
                  <div className={cn('text-lg font-black tabular-nums', color)}>{value}</div>
                  {trend && <div>{trend}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Chart Tab */}
          {tab === 'chart' && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Bestellungen nach Stunde
              </div>
              <div className="flex items-end gap-1 h-24">
                {data.stunden_verlauf.map((h) => {
                  const pct = Math.round((h.orders / maxOrders) * 100);
                  return (
                    <div key={h.h} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] font-mono text-muted-foreground tabular-nums">{h.orders}</span>
                      <div className="w-full rounded-t-sm bg-matcha-100 overflow-hidden" style={{ height: '64px' }}>
                        <div
                          className="w-full bg-matcha-500 rounded-t-sm transition-all duration-500"
                          style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-muted-foreground">{h.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fahrer Tab */}
          {tab === 'fahrer' && (
            <div className="space-y-2">
              {data.top_fahrer.map((f, i) => (
                <div key={f.name} className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2">
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-stone-300 text-stone-700' : 'bg-amber-700/30 text-amber-900',
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-foreground">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">{f.lieferungen} Lieferungen</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                      {f.bewertung.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 border-t pt-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">
              Trend vs. Vorwoche gleiche Stunde · 60s-Refresh
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
