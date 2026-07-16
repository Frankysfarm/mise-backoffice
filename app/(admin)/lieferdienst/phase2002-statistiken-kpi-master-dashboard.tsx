'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Euro, Package, Clock, Target, Truck, Users, TrendingUp, TrendingDown,
  AlertTriangle, Zap, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

type Statistiken = {
  umsatz_eur: number;
  umsatz_vortag_eur: number;
  bestellungen: number;
  bestellungen_vortag: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  storno_pct: number;
  aktive_fahrer: number;
};

const MOCK_DATA: Statistiken = {
  umsatz_eur: 3240.50,
  umsatz_vortag_eur: 2890.00,
  bestellungen: 108,
  bestellungen_vortag: 96,
  avg_lieferzeit_min: 27,
  puenktlichkeit_pct: 89,
  storno_pct: 3.1,
  aktive_fahrer: 7,
};

function KpiTile({
  label,
  value,
  sub,
  trend,
  color = 'matcha',
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: string;
  icon: React.ElementType;
}) {
  const colorMap: Record<string, string> = {
    matcha: 'bg-matcha-50 text-matcha-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  const iconColor = colorMap[color] ?? colorMap.matcha;

  return (
    <div className="rounded-xl bg-card border p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconColor)}>
          <Icon size={14} />
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-0.5 text-[10px] font-bold',
            trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground',
          )}>
            {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : null}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-lg font-black tabular-nums leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium leading-none">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase2002StatistikenKpiMasterDashboard({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [data, setData] = useState<Statistiken | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!locationId) {
        setData(MOCK_DATA);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/admin/schicht-statistik?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d) setData(d);
          else setData(MOCK_DATA);
        })
        .catch(() => { if (!cancelled) setData(MOCK_DATA); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const umsatzTrend = data && data.umsatz_vortag_eur > 0
    ? ((data.umsatz_eur - data.umsatz_vortag_eur) / data.umsatz_vortag_eur) * 100
    : 0;

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            KPI Master-Dashboard
          </span>
          {!loading && data && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {fmtEur(data.umsatz_eur)} · {data.bestellungen} Bestellungen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade KPI-Daten…
            </div>
          ) : !data ? (
            <div className="text-sm text-muted-foreground">Keine Daten verfügbar.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KpiTile
                label="Umsatz"
                value={fmtEur(data.umsatz_eur)}
                sub={`Vortag: ${fmtEur(data.umsatz_vortag_eur)}`}
                trend={umsatzTrend}
                icon={Euro}
                color="emerald"
              />
              <KpiTile
                label="Bestellungen"
                value={data.bestellungen.toString()}
                sub={`Vortag: ${data.bestellungen_vortag}`}
                trend={data.bestellungen_vortag > 0
                  ? ((data.bestellungen - data.bestellungen_vortag) / data.bestellungen_vortag) * 100
                  : 0}
                icon={Package}
                color="blue"
              />
              <KpiTile
                label="Ø Lieferzeit"
                value={`${data.avg_lieferzeit_min} min`}
                icon={Clock}
                color={data.avg_lieferzeit_min <= 30 ? 'matcha' : 'amber'}
              />
              <KpiTile
                label="Pünktlichkeit"
                value={`${data.puenktlichkeit_pct}%`}
                icon={Target}
                color={data.puenktlichkeit_pct >= 85 ? 'matcha' : 'amber'}
              />
              <KpiTile
                label="Storno-Quote"
                value={`${data.storno_pct.toFixed(1)}%`}
                icon={AlertTriangle}
                color={data.storno_pct <= 5 ? 'matcha' : 'red'}
              />
              <KpiTile
                label="Aktive Fahrer"
                value={data.aktive_fahrer.toString()}
                icon={Truck}
                color="purple"
              />
              <KpiTile
                label="Umsatz/Stunde"
                value={fmtEur(data.umsatz_eur / 8)}
                sub="basiert auf 8h Schicht"
                icon={Zap}
                color="matcha"
              />
              <KpiTile
                label="Bestellungen/Fahrer"
                value={data.aktive_fahrer > 0
                  ? (data.bestellungen / data.aktive_fahrer).toFixed(1)
                  : '—'}
                icon={Users}
                color="blue"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
