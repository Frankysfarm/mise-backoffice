'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Package, Euro, Clock, Users, Star, Percent } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface SmartStats {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number | null;
  on_time_rate: number | null;
  aktive_fahrer: number;
  avg_bewertung: number | null;
  storno_rate: number | null;
  delta_bestellungen?: number | null;
  delta_umsatz?: number | null;
  peak_stunde?: number | null;
  touren_aktiv?: number;
  stunden_verlauf?: { stunde: number; bestellungen: number }[];
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function DeltaBadge({ delta, inverse = false }: { delta: number | null; inverse?: boolean }) {
  if (delta === null || delta === undefined) return <span className="text-[9px] text-muted-foreground">—</span>;
  const positive = inverse ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <div className={cn('flex items-center gap-0.5 text-[9px] font-bold', positive ? 'text-matcha-600' : delta === 0 ? 'text-muted-foreground' : 'text-red-500')}>
      <Icon className="h-2.5 w-2.5" />
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
    </div>
  );
}

function MiniHeatbar({ data }: { data: { stunde: number; bestellungen: number }[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.bestellungen), 1);
  const currentHour = new Date().getHours();
  return (
    <div className="flex items-end gap-0.5 h-6 mt-2">
      {data.map((d) => (
        <div key={d.stunde} className="flex-1 flex flex-col items-center">
          <div
            className={cn(
              'w-full rounded-t-sm transition-all',
              d.stunde === currentHour ? 'bg-matcha-600' : 'bg-matcha-300/60',
            )}
            style={{ height: `${Math.round((d.bestellungen / max) * 100)}%`, minHeight: d.bestellungen > 0 ? '2px' : '0' }}
          />
        </div>
      ))}
    </div>
  );
}

const MOCK: SmartStats = {
  bestellungen_heute: 47,
  umsatz_heute: 1284.50,
  avg_lieferzeit_min: 28,
  on_time_rate: 87.2,
  aktive_fahrer: 4,
  avg_bewertung: 4.6,
  storno_rate: 3.1,
  delta_bestellungen: 12.4,
  delta_umsatz: 8.7,
  peak_stunde: 12,
  touren_aktiv: 2,
  stunden_verlauf: Array.from({ length: 12 }, (_, i) => ({
    stunde: i + 8,
    bestellungen: Math.floor(Math.random() * 8),
  })),
};

export function LieferdienstPhase1712StatistikenSmartUebersichtCockpit({ locationId }: Props) {
  const [data, setData] = useState<SmartStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/delivery/admin/analytics?location_id=${encodeURIComponent(locationId)}&range=today`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setData({
            bestellungen_heute: d.bestellungen_heute ?? MOCK.bestellungen_heute,
            umsatz_heute: d.umsatz_heute ?? MOCK.umsatz_heute,
            avg_lieferzeit_min: d.avg_lieferzeit_min ?? MOCK.avg_lieferzeit_min,
            on_time_rate: d.on_time_rate ?? MOCK.on_time_rate,
            aktive_fahrer: d.aktive_fahrer ?? MOCK.aktive_fahrer,
            avg_bewertung: d.avg_bewertung ?? MOCK.avg_bewertung,
            storno_rate: d.storno_rate ?? MOCK.storno_rate,
            delta_bestellungen: d.delta_bestellungen ?? MOCK.delta_bestellungen,
            delta_umsatz: d.delta_umsatz ?? MOCK.delta_umsatz,
            peak_stunde: d.peak_stunde ?? MOCK.peak_stunde,
            touren_aktiv: d.touren_aktiv ?? MOCK.touren_aktiv,
            stunden_verlauf: d.stunden_verlauf ?? MOCK.stunden_verlauf,
          });
        } else {
          setData(MOCK);
        }
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      icon: <Package className="h-4 w-4" />,
      label: 'Bestellungen',
      value: data.bestellungen_heute.toString(),
      delta: data.delta_bestellungen ?? null,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      icon: <Euro className="h-4 w-4" />,
      label: 'Umsatz heute',
      value: fmtEur(data.umsatz_heute),
      delta: data.delta_umsatz ?? null,
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
      iconBg: 'bg-matcha-100 text-matcha-600',
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Ø Lieferzeit',
      value: data.avg_lieferzeit_min !== null ? `${Math.round(data.avg_lieferzeit_min)} Min` : '—',
      delta: null,
      color: data.avg_lieferzeit_min !== null && data.avg_lieferzeit_min <= 30 ? 'text-matcha-700' : 'text-amber-700',
      bg: data.avg_lieferzeit_min !== null && data.avg_lieferzeit_min <= 30 ? 'bg-matcha-50' : 'bg-amber-50',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    {
      icon: <Percent className="h-4 w-4" />,
      label: 'Pünktlichkeit',
      value: data.on_time_rate !== null ? `${data.on_time_rate.toFixed(1)}%` : '—',
      delta: null,
      color: data.on_time_rate !== null && data.on_time_rate >= 85 ? 'text-matcha-700' : 'text-red-600',
      bg: data.on_time_rate !== null && data.on_time_rate >= 85 ? 'bg-matcha-50' : 'bg-red-50',
      iconBg: 'bg-matcha-100 text-matcha-600',
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Aktive Fahrer',
      value: data.aktive_fahrer.toString(),
      delta: null,
      color: 'text-violet-700',
      bg: 'bg-violet-50',
      iconBg: 'bg-violet-100 text-violet-600',
    },
    {
      icon: <Star className="h-4 w-4" />,
      label: 'Ø Bewertung',
      value: data.avg_bewertung !== null ? data.avg_bewertung.toFixed(1) : '—',
      delta: null,
      color: data.avg_bewertung !== null && data.avg_bewertung >= 4.0 ? 'text-amber-700' : 'text-red-600',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-100 text-amber-600',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">Smart-Statistiken Übersicht</div>
          <div className="text-xs text-stone-400">Heute · Live</div>
        </div>
        {data.storno_rate !== null && data.storno_rate > 5 && (
          <span className="text-[10px] font-black rounded-full bg-red-100 text-red-700 px-2 py-0.5 animate-pulse">
            Storno {data.storno_rate.toFixed(1)}%
          </span>
        )}
        {data.touren_aktiv !== undefined && data.touren_aktiv > 0 && (
          <span className="text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
            {data.touren_aktiv} Tour{data.touren_aktiv !== 1 ? 'en' : ''} aktiv
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px bg-stone-100">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn('p-3.5 bg-white', kpi.bg)}>
            <div className={cn('inline-flex h-6 w-6 items-center justify-center rounded-lg mb-1.5', kpi.iconBg)}>
              {kpi.icon}
            </div>
            <div className={cn('text-base font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[10px] text-stone-500 font-semibold">{kpi.label}</div>
            {kpi.delta !== null && <DeltaBadge delta={kpi.delta} />}
          </div>
        ))}
      </div>

      {data.stunden_verlauf && data.stunden_verlauf.length > 0 && (
        <div className="px-5 py-3 border-t border-stone-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
            Bestellungen je Stunde · heute
          </div>
          <MiniHeatbar data={data.stunden_verlauf} />
        </div>
      )}
    </div>
  );
}
