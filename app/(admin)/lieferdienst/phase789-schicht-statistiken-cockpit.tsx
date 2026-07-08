'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, Award, Clock, Package, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtStatData {
  bestellungen: number;
  bestellungen_vortag: number | null;
  umsatz_eur: number;
  umsatz_vortag_eur: number | null;
  pünktlichkeits_rate: number;
  storno_rate: number;
  avg_liefer_min: number | null;
  fahrer_aktiv: number;
  touren_abgeschlossen: number;
  top_zone: string | null;
  schicht_start: string | null;
}

interface Props {
  locationId: string | null;
}

function delta(current: number, previous: number | null): { pct: number; dir: 'up' | 'down' | 'neutral' } {
  if (previous == null || previous === 0) return { pct: 0, dir: 'neutral' };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

function TrendBadge({ dir, pct }: { dir: 'up' | 'down' | 'neutral'; pct: number }) {
  if (dir === 'neutral' || pct === 0) return null;
  const Icon = dir === 'up' ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[9px] font-bold px-1 rounded',
      dir === 'up' ? 'text-matcha-600 bg-matcha-50' : 'text-red-500 bg-red-50',
    )}>
      <Icon className="h-2.5 w-2.5" />
      {pct.toFixed(0)}%
    </span>
  );
}

function KpiTile({
  icon,
  label,
  value,
  sub,
  color,
  trendDir,
  trendPct,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  trendDir?: 'up' | 'down' | 'neutral';
  trendPct?: number;
}) {
  return (
    <div className={cn('rounded-xl p-3 flex flex-col gap-1', color)}>
      <div className="flex items-center justify-between">
        <div className="opacity-60">{icon}</div>
        {trendDir && trendPct != null && (
          <TrendBadge dir={trendDir} pct={trendPct} />
        )}
      </div>
      <div className="text-xl font-black tabular-nums leading-none">{value}</div>
      <div className="text-[10px] font-semibold opacity-70">{label}</div>
      {sub && <div className="text-[9px] opacity-50">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase789SchichtStatistikCockpit({ locationId }: Props) {
  const [data, setData] = useState<SchichtStatData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/schicht-live?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (active && json) {
          setData({
            bestellungen: json.bestellungen ?? json.total_orders ?? 0,
            bestellungen_vortag: json.bestellungen_vortag ?? json.orders_yesterday ?? null,
            umsatz_eur: json.umsatz_eur ?? json.revenue_eur ?? 0,
            umsatz_vortag_eur: json.umsatz_vortag_eur ?? null,
            pünktlichkeits_rate: json.puenktlichkeits_rate ?? json.on_time_rate ?? 0,
            storno_rate: json.storno_rate ?? json.cancellation_rate ?? 0,
            avg_liefer_min: json.avg_liefer_min ?? json.avg_delivery_min ?? null,
            fahrer_aktiv: json.fahrer_aktiv ?? json.active_drivers ?? 0,
            touren_abgeschlossen: json.touren_abgeschlossen ?? json.tours_completed ?? 0,
            top_zone: json.top_zone ?? null,
            schicht_start: json.schicht_start ?? null,
          });
        }
      } catch {
        // Use mock data as fallback
        if (active) {
          setData({
            bestellungen: 0,
            bestellungen_vortag: null,
            umsatz_eur: 0,
            umsatz_vortag_eur: null,
            pünktlichkeits_rate: 0,
            storno_rate: 0,
            avg_liefer_min: null,
            fahrer_aktiv: 0,
            touren_abgeschlossen: 0,
            top_zone: null,
            schicht_start: null,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const bestellDelta = data ? delta(data.bestellungen, data.bestellungen_vortag) : null;
  const umsatzDelta = data ? delta(data.umsatz_eur, data.umsatz_vortag_eur) : null;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
          <BarChart2 className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-stone-700 dark:text-stone-200">
            Schicht-Statistiken · Live Dashboard
          </div>
          {data?.schicht_start && (
            <div className="text-[10px] text-stone-400">
              seit {new Date(data.schicht_start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
        </div>
        {loading && (
          <div className="h-2 w-2 rounded-full bg-matcha-400 animate-pulse" />
        )}
      </div>

      {/* KPI Grid */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-stone-100 dark:bg-stone-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile
              icon={<Package className="h-4 w-4" />}
              label="Bestellungen"
              value={data.bestellungen.toString()}
              sub={data.bestellungen_vortag != null ? `Vortag: ${data.bestellungen_vortag}` : undefined}
              color="bg-matcha-50 text-matcha-800 dark:bg-matcha-950/30 dark:text-matcha-200"
              trendDir={bestellDelta?.dir}
              trendPct={bestellDelta?.pct}
            />
            <KpiTile
              icon={<Euro className="h-4 w-4" />}
              label="Umsatz"
              value={fmtEur(data.umsatz_eur)}
              sub={data.umsatz_vortag_eur != null ? `Vortag: ${fmtEur(data.umsatz_vortag_eur)}` : undefined}
              color="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              trendDir={umsatzDelta?.dir}
              trendPct={umsatzDelta?.pct}
            />
            <KpiTile
              icon={<Clock className="h-4 w-4" />}
              label="Pünktlichkeit"
              value={`${Math.round(data.pünktlichkeits_rate)}%`}
              color={
                data.pünktlichkeits_rate >= 85
                  ? 'bg-matcha-50 text-matcha-800 dark:bg-matcha-950/30 dark:text-matcha-200'
                  : data.pünktlichkeits_rate >= 70
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
              }
            />
            <KpiTile
              icon={<Award className="h-4 w-4" />}
              label="Aktive Fahrer"
              value={data.fahrer_aktiv.toString()}
              sub={`${data.touren_abgeschlossen} Touren fertig`}
              color="bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
            />
          </div>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-3">
            {data.avg_liefer_min !== null && (
              <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 flex items-center gap-3">
                <Clock className="h-4 w-4 text-stone-400 shrink-0" />
                <div>
                  <div className="text-base font-black tabular-nums text-stone-800 dark:text-stone-100">
                    {Math.round(data.avg_liefer_min)} Min
                  </div>
                  <div className="text-[10px] text-stone-500">Ø Lieferzeit</div>
                </div>
              </div>
            )}
            <div className={cn(
              'rounded-xl p-3 flex items-center gap-3',
              data.storno_rate <= 2 ? 'bg-matcha-50 dark:bg-matcha-950/30' :
              data.storno_rate <= 5 ? 'bg-amber-50 dark:bg-amber-950/30' :
              'bg-red-50 dark:bg-red-950/30',
            )}>
              <div className={cn(
                'text-base font-black tabular-nums',
                data.storno_rate <= 2 ? 'text-matcha-700 dark:text-matcha-400' :
                data.storno_rate <= 5 ? 'text-amber-700 dark:text-amber-400' :
                'text-red-600 dark:text-red-400',
              )}>
                {data.storno_rate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Storno-Rate</div>
            </div>
          </div>

          {data.top_zone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <span className="text-sm">🏆</span>
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                Stärkste Zone: <span className="font-black">{data.top_zone}</span>
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
