'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart3, ChevronDown, ChevronUp, Euro, Package,
  TrendingUp, TrendingDown, Users, Zap, Clock, Star, Target,
} from 'lucide-react';

/**
 * Phase 1000 — Statistiken Pro-Dashboard (Lieferdienst)
 *
 * Kompaktes Executive-Dashboard mit KPIs, Trends und Zielerreichung.
 * Nutzt Mock-Daten + API-Platzhalter für Produktionsbetrieb.
 */

interface Props {
  locationId?: string | null;
}

interface KpiData {
  umsatzHeute: number;
  umsatzZiel: number;
  bestellungenHeute: number;
  bestellungenZiel: number;
  aktiveFahrer: number;
  maxFahrer: number;
  avgLieferzeitMin: number;
  zielLieferzeitMin: number;
  pünktlichkeitPct: number;
  stornoPct: number;
  gewinnHeute: number;
  vsTagesvorher: number; // % delta
  bewertungDurchschnitt: number;
  trinkgeldHeute: number;
}

const MOCK: KpiData = {
  umsatzHeute: 3241.8,
  umsatzZiel: 3500,
  bestellungenHeute: 108,
  bestellungenZiel: 120,
  aktiveFahrer: 7,
  maxFahrer: 9,
  avgLieferzeitMin: 27,
  zielLieferzeitMin: 30,
  pünktlichkeitPct: 91,
  stornoPct: 3.7,
  gewinnHeute: 748.4,
  vsTagesvorher: 8.2,
  bewertungDurchschnitt: 4.7,
  trinkgeldHeute: 127.5,
};

function euro(v: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function pct(v: number): string {
  return `${v.toFixed(1)} %`;
}

interface TileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  pctFill?: number;
  color?: 'matcha' | 'blue' | 'amber' | 'red' | 'purple';
  highlight?: boolean;
}

const COLOR_MAP = {
  matcha: { icon: 'text-matcha-600', bar: 'bg-matcha-500', bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-200 dark:border-matcha-800' },
  blue:   { icon: 'text-blue-600',   bar: 'bg-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/20',     border: 'border-blue-200 dark:border-blue-800'   },
  amber:  { icon: 'text-amber-500',  bar: 'bg-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800' },
  red:    { icon: 'text-red-500',    bar: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-200 dark:border-red-800'     },
  purple: { icon: 'text-purple-600', bar: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800'},
};

function Tile({ icon: Icon, label, value, sub, trend, pctFill, color = 'matcha', highlight }: TileProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1.5', c.bg, c.border, highlight && 'ring-2 ring-matcha-400')}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', c.icon)} />
        <span className="text-[10px] font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-base font-black leading-none">{value}</span>
        {trend !== undefined && (
          <span className={cn('flex items-center text-[10px] font-bold mb-0.5', trend >= 0 ? 'text-matcha-600' : 'text-red-600')}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <span className="text-[10px] text-muted-foreground leading-none">{sub}</span>}
      {pctFill !== undefined && (
        <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', c.bar)}
            style={{ width: `${Math.min(100, pctFill)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function LieferdienstPhase1000StatistikenProDashboard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<KpiData>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    // API-Platzhalter: In Produktion → fetch(`/api/delivery/admin/analytics?location=${locationId}`)
    setData(MOCK);
  }, [locationId]);

  const umsatzPct   = (data.umsatzHeute / data.umsatzZiel) * 100;
  const bestellPct  = (data.bestellungenHeute / data.bestellungenZiel) * 100;
  const fahrerPct   = (data.aktiveFahrer / data.maxFahrer) * 100;
  const liefOk      = data.avgLieferzeitMin <= data.zielLieferzeitMin;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Statistiken Pro-Dashboard</span>
          <span className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold',
            data.vsTagesvorher >= 0 ? 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300' : 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300',
          )}>
            {data.vsTagesvorher >= 0 ? '+' : ''}{data.vsTagesvorher.toFixed(1)}% vs. gestern
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile
              icon={Euro} label="Umsatz heute" color="matcha" highlight
              value={euro(data.umsatzHeute)}
              sub={`Ziel: ${euro(data.umsatzZiel)}`}
              trend={data.vsTagesvorher}
              pctFill={umsatzPct}
            />
            <Tile
              icon={Package} label="Bestellungen" color="blue"
              value={`${data.bestellungenHeute}`}
              sub={`Ziel: ${data.bestellungenZiel}`}
              pctFill={bestellPct}
            />
            <Tile
              icon={Users} label="Aktive Fahrer" color="purple"
              value={`${data.aktiveFahrer}/${data.maxFahrer}`}
              sub={`${Math.round(fahrerPct)}% Auslastung`}
              pctFill={fahrerPct}
            />
            <Tile
              icon={Clock} label="Ø Lieferzeit" color={liefOk ? 'matcha' : 'amber'}
              value={`${data.avgLieferzeitMin} Min`}
              sub={`Ziel: ${data.zielLieferzeitMin} Min`}
              pctFill={liefOk ? 100 : (data.avgLieferzeitMin / data.zielLieferzeitMin) * 100}
            />
            <Tile
              icon={Target} label="Pünktlichkeit" color={data.pünktlichkeitPct >= 90 ? 'matcha' : data.pünktlichkeitPct >= 75 ? 'amber' : 'red'}
              value={pct(data.pünktlichkeitPct)}
              pctFill={data.pünktlichkeitPct}
            />
            <Tile
              icon={Star} label="Bewertung" color="amber"
              value={`${data.bewertungDurchschnitt.toFixed(1)} ★`}
              sub="Kundenbewertungen"
              pctFill={(data.bewertungDurchschnitt / 5) * 100}
            />
            <Tile
              icon={Zap} label="Gewinn heute" color="matcha"
              value={euro(data.gewinnHeute)}
              sub="nach Abzügen"
            />
            <Tile
              icon={TrendingDown} label="Storno-Rate" color={data.stornoPct <= 5 ? 'matcha' : 'red'}
              value={pct(data.stornoPct)}
              pctFill={data.stornoPct}
            />
            <Tile
              icon={Euro} label="Trinkgeld" color="purple"
              value={euro(data.trinkgeldHeute)}
              sub="alle Fahrer heute"
            />
          </div>

          {/* Goal completion bar */}
          <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tagesziel-Erfüllung</span>
              <span className={cn('text-[10px] font-black', umsatzPct >= 100 ? 'text-matcha-600' : umsatzPct >= 80 ? 'text-amber-600' : 'text-red-600')}>
                {umsatzPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', umsatzPct >= 100 ? 'bg-matcha-500' : umsatzPct >= 80 ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${Math.min(100, umsatzPct)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
