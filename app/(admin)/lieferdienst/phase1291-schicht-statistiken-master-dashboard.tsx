'use client';

// Phase 1291 (Lieferdienst) — Schicht-Statistiken-Master-Dashboard
// Vollständiges Statistik-Dashboard: Umsatz, Lieferungen, Fahrer-KPIs, Zonen, Trinkgeld, Storno.
// 10-Min-Polling · API /api/delivery/admin/schicht-statistiken-master · Mock-Fallback

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, Package, Euro, Clock,
  Users, MapPin, Star, XCircle, Bike, BarChart3, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtStatistiken {
  umsatz_heute: number;
  umsatz_vorwoche: number;
  umsatz_ziel: number;
  lieferungen_heute: number;
  lieferungen_vorwoche: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_ziel_min: number;
  puenktlichkeits_quote: number;
  storno_quote: number;
  aktive_fahrer: number;
  fahrer_gesamt: number;
  avg_fahrer_score: number;
  trinkgeld_summe: number;
  trinkgeld_vorwoche: number;
  top_zone: string;
  top_zone_lieferungen: number;
  bewertungs_schnitt: number;
  bewertungs_anzahl: number;
}

interface Props {
  locationId: string | null;
}

const MOCK: SchichtStatistiken = {
  umsatz_heute: 1248.5,
  umsatz_vorwoche: 1095.0,
  umsatz_ziel: 1400.0,
  lieferungen_heute: 47,
  lieferungen_vorwoche: 41,
  avg_lieferzeit_min: 28.4,
  avg_lieferzeit_ziel_min: 30,
  puenktlichkeits_quote: 82,
  storno_quote: 4.2,
  aktive_fahrer: 5,
  fahrer_gesamt: 7,
  avg_fahrer_score: 87,
  trinkgeld_summe: 34.5,
  trinkgeld_vorwoche: 28.0,
  top_zone: 'Mitte',
  top_zone_lieferungen: 18,
  bewertungs_schnitt: 4.6,
  bewertungs_anzahl: 39,
};

const POLL_MS = 10 * 60_000;

type Trend = 'up' | 'down' | 'stable';

function calcTrend(current: number, prev: number): Trend {
  if (current > prev * 1.02) return 'up';
  if (current < prev * 0.98) return 'down';
  return 'stable';
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-stone-400" />;
}

function KpiTile({
  icon, label, value, sub, trend, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: Trend;
  highlight?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const highlightCls = {
    good: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
    warn: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    bad: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
    neutral: 'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50',
  }[highlight ?? 'neutral'];

  return (
    <div className={cn('rounded-xl border p-3', highlightCls)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-stone-500 dark:text-stone-400">{icon}</span>
        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">{label}</span>
        {trend && <span className="ml-auto"><TrendIcon trend={trend} /></span>}
      </div>
      <p className="text-lg font-black text-stone-800 dark:text-stone-100 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function LieferdienstPhase1291SchichtStatistikenMasterDashboard({ locationId }: Props) {
  const [data, setData] = useState<SchichtStatistiken | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-statistiken-master?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const umsatzPct = data.umsatz_ziel > 0 ? Math.round((data.umsatz_heute / data.umsatz_ziel) * 100) : 0;
  const umsatzTrend = calcTrend(data.umsatz_heute, data.umsatz_vorwoche);
  const lieferTrend = calcTrend(data.lieferungen_heute, data.lieferungen_vorwoche);
  const trinkgeldTrend = calcTrend(data.trinkgeld_summe, data.trinkgeld_vorwoche);

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-stone-900 to-stone-700 text-white">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold">Schicht-Statistiken</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-300">10-Min-Update</span>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Umsatz-Ziel-Fortschritt */}
        <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-stone-500" />
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">Umsatz-Ziel</span>
            </div>
            <span className={cn('text-sm font-black', umsatzPct >= 100 ? 'text-emerald-600' : umsatzPct >= 75 ? 'text-amber-600' : 'text-stone-600')}>
              {umsatzPct}%
            </span>
          </div>
          <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2.5 mb-1.5">
            <div
              className={cn('h-2.5 rounded-full transition-all duration-700', umsatzPct >= 100 ? 'bg-emerald-500' : umsatzPct >= 75 ? 'bg-amber-500' : 'bg-blue-500')}
              style={{ width: `${Math.min(100, umsatzPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-stone-400">
            <span>{data.umsatz_heute.toFixed(0)} € erreicht</span>
            <span>Ziel: {data.umsatz_ziel.toFixed(0)} €</span>
          </div>
        </div>

        {/* KPI-Grid 2×3 */}
        <div className="grid grid-cols-2 gap-2">
          <KpiTile
            icon={<Euro className="h-4 w-4" />}
            label="Umsatz heute"
            value={`${data.umsatz_heute.toFixed(0)} €`}
            sub={`VW: ${data.umsatz_vorwoche.toFixed(0)} €`}
            trend={umsatzTrend}
            highlight={umsatzTrend === 'up' ? 'good' : umsatzTrend === 'down' ? 'warn' : 'neutral'}
          />
          <KpiTile
            icon={<Package className="h-4 w-4" />}
            label="Lieferungen"
            value={String(data.lieferungen_heute)}
            sub={`VW: ${data.lieferungen_vorwoche}`}
            trend={lieferTrend}
            highlight={lieferTrend === 'up' ? 'good' : 'neutral'}
          />
          <KpiTile
            icon={<Clock className="h-4 w-4" />}
            label="Ø Lieferzeit"
            value={`${data.avg_lieferzeit_min.toFixed(1)} Min`}
            sub={`Ziel: ≤${data.avg_lieferzeit_ziel_min} Min`}
            highlight={data.avg_lieferzeit_min <= data.avg_lieferzeit_ziel_min ? 'good' : 'warn'}
          />
          <KpiTile
            icon={<Bike className="h-4 w-4" />}
            label="Pünktlichkeit"
            value={`${data.puenktlichkeits_quote}%`}
            sub="Lieferungen in Zeit"
            highlight={data.puenktlichkeits_quote >= 80 ? 'good' : data.puenktlichkeits_quote >= 65 ? 'warn' : 'bad'}
          />
          <KpiTile
            icon={<Users className="h-4 w-4" />}
            label="Aktive Fahrer"
            value={`${data.aktive_fahrer}/${data.fahrer_gesamt}`}
            sub={`Ø Score: ${data.avg_fahrer_score}`}
            highlight={data.aktive_fahrer >= data.fahrer_gesamt * 0.7 ? 'good' : 'warn'}
          />
          <KpiTile
            icon={<XCircle className="h-4 w-4" />}
            label="Storno-Quote"
            value={`${data.storno_quote.toFixed(1)}%`}
            sub="Abgebrochene Bestellungen"
            highlight={data.storno_quote <= 5 ? 'good' : data.storno_quote <= 10 ? 'warn' : 'bad'}
          />
        </div>

        {/* Untere Zeile: Trinkgeld + Bewertung + Top-Zone */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Euro className="h-3 w-3 text-emerald-500" />
              <TrendIcon trend={trinkgeldTrend} />
            </div>
            <p className="text-sm font-black text-stone-700 dark:text-stone-200">{data.trinkgeld_summe.toFixed(0)} €</p>
            <p className="text-[9px] text-stone-400">Trinkgeld</p>
          </div>
          <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-3 w-3 text-yellow-500" />
            </div>
            <p className="text-sm font-black text-stone-700 dark:text-stone-200">{data.bewertungs_schnitt.toFixed(1)}</p>
            <p className="text-[9px] text-stone-400">{data.bewertungs_anzahl} Bew.</p>
          </div>
          <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MapPin className="h-3 w-3 text-blue-500" />
            </div>
            <p className="text-xs font-black text-stone-700 dark:text-stone-200 truncate">{data.top_zone}</p>
            <p className="text-[9px] text-stone-400">{data.top_zone_lieferungen} Lief.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
