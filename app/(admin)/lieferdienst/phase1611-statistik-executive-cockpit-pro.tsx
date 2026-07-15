'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, ChevronDown, ChevronUp, Euro, TrendingUp, TrendingDown, Minus, Package, Bike, Target } from 'lucide-react';

/**
 * Phase 1611 — Statistik-Executive-Cockpit-Pro (Lieferdienst)
 *
 * Kompaktes KPI-Dashboard für Schicht-Statistiken:
 * Umsatz, Bestellungen, Ø-Lieferzeit, Fahrer-Performance.
 * API-Polling 90s, Mock-Fallback.
 */

interface SchichtStats {
  umsatz_heute: number;
  bestellungen_heute: number;
  avg_lieferzeit_min: number;
  sla_quote_pct: number;
  aktive_fahrer: number;
  storno_quote_pct: number;
  umsatz_trend: 'steigend' | 'fallend' | 'stabil';
  beste_stunde: string;
  top_zone: string;
}

const MOCK: SchichtStats = {
  umsatz_heute: 1847.50,
  bestellungen_heute: 63,
  avg_lieferzeit_min: 28,
  sla_quote_pct: 82,
  aktive_fahrer: 4,
  storno_quote_pct: 3.2,
  umsatz_trend: 'steigend',
  beste_stunde: '12–13 Uhr',
  top_zone: 'Zone B',
};

interface Props {
  locationId?: string | null;
}

function euro(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function TrendIcon({ trend }: { trend: SchichtStats['umsatz_trend'] }) {
  if (trend === 'steigend') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-zinc-400" />;
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
  warn?: boolean;
}

function KpiTile({ icon, label, value, sub, good, warn }: KpiTileProps) {
  return (
    <div className={cn(
      'rounded-lg border p-2.5 space-y-1',
      good ? 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700' :
      warn ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' :
             'bg-card border-border',
    )}>
      <div className="flex items-center gap-1.5">
        <span className={cn('shrink-0', good ? 'text-matcha-600' : warn ? 'text-amber-600' : 'text-muted-foreground')}>{icon}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className={cn('text-base font-black tabular-nums', good ? 'text-matcha-700 dark:text-matcha-300' : warn ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1611StatistikExecutiveCockpitPro({ locationId }: Props) {
  const [stats, setStats] = useState<SchichtStats | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/admin/analytics?location_id=${locationId}`
          : '/api/delivery/admin/analytics';
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const raw = await res.json();
        setStats({
          umsatz_heute: raw.umsatz_heute ?? raw.umsatz ?? MOCK.umsatz_heute,
          bestellungen_heute: raw.bestellungen_heute ?? raw.bestellungen ?? MOCK.bestellungen_heute,
          avg_lieferzeit_min: raw.avg_lieferzeit_min ?? raw.avg_lieferzeit ?? MOCK.avg_lieferzeit_min,
          sla_quote_pct: raw.sla_quote_pct ?? raw.sla_quote ?? MOCK.sla_quote_pct,
          aktive_fahrer: raw.aktive_fahrer ?? raw.fahrer_count ?? MOCK.aktive_fahrer,
          storno_quote_pct: raw.storno_quote_pct ?? raw.storno_quote ?? MOCK.storno_quote_pct,
          umsatz_trend: raw.umsatz_trend ?? 'stabil',
          beste_stunde: raw.beste_stunde ?? MOCK.beste_stunde,
          top_zone: raw.top_zone ?? MOCK.top_zone,
        });
      } catch {
        setStats(MOCK);
      }
    }
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const s = stats ?? MOCK;
  const slaGood = s.sla_quote_pct >= 80;
  const slaWarn = s.sla_quote_pct >= 60 && s.sla_quote_pct < 80;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-semibold">Statistik-Executive-Cockpit</span>
          <TrendIcon trend={s.umsatz_trend} />
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <KpiTile
              icon={<Euro className="h-3.5 w-3.5" />}
              label="Umsatz heute"
              value={euro(s.umsatz_heute)}
              sub={`Trend: ${s.umsatz_trend}`}
              good={s.umsatz_trend === 'steigend'}
            />
            <KpiTile
              icon={<Package className="h-3.5 w-3.5" />}
              label="Bestellungen"
              value={String(s.bestellungen_heute)}
              sub={`Peak: ${s.beste_stunde}`}
            />
            <KpiTile
              icon={<Target className="h-3.5 w-3.5" />}
              label="SLA-Quote"
              value={`${s.sla_quote_pct}%`}
              sub="Pünktlichkeitsrate"
              good={slaGood}
              warn={slaWarn}
            />
            <KpiTile
              icon={<Bike className="h-3.5 w-3.5" />}
              label="Aktive Fahrer"
              value={String(s.aktive_fahrer)}
              sub={`Top: ${s.top_zone}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border bg-muted/30 p-2.5">
              <div className="text-[10px] text-muted-foreground mb-1">Ø Lieferzeit</div>
              <div className={cn('text-lg font-black tabular-nums', s.avg_lieferzeit_min > 35 ? 'text-red-600' : s.avg_lieferzeit_min > 28 ? 'text-amber-600' : 'text-matcha-700 dark:text-matcha-300')}>
                {s.avg_lieferzeit_min} Min
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2.5">
              <div className="text-[10px] text-muted-foreground mb-1">Storno-Quote</div>
              <div className={cn('text-lg font-black tabular-nums', s.storno_quote_pct > 8 ? 'text-red-600' : s.storno_quote_pct > 5 ? 'text-amber-600' : 'text-matcha-700 dark:text-matcha-300')}>
                {s.storno_quote_pct.toFixed(1)}%
              </div>
            </div>
          </div>
          {/* SLA bar */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">SLA-Fortschritt</span>
              <span className={cn('font-bold', slaGood ? 'text-matcha-700 dark:text-matcha-300' : slaWarn ? 'text-amber-600' : 'text-red-600')}>
                {s.sla_quote_pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', slaGood ? 'bg-matcha-500' : slaWarn ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${s.sla_quote_pct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
