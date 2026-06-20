'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Award, Bike, BarChart2, CheckCircle2, Clock, Flame, TrendingUp, TrendingDown, Minus,
  Target, Users, Zap,
} from 'lucide-react';

interface ShiftStat {
  totalTours: number;
  completedTours: number;
  activeTours: number;
  totalDeliveries: number;
  avgScore: number;
  topDriver: string | null;
  topDriverScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  totalRevenue: number;
  trend: 'up' | 'down' | 'neutral';
}

interface DriverRow {
  name: string;
  tours: number;
  avgScore: number;
  deliveries: number;
}

function ScorePill({ score }: { score: number }) {
  const { cls, label } =
    score >= 90 ? { cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: '⭐' } :
    score >= 80 ? { cls: 'bg-green-500/20 text-green-300 border-green-500/30', label: '✓' } :
    score >= 70 ? { cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: '~' } :
    { cls: 'bg-red-500/20 text-red-300 border-red-500/30', label: '!' };
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-black', cls)}>
      {label} {Math.round(score)}
    </span>
  );
}

export function DispatchSchichtBilanzPanel({ locationId }: { locationId: string | null }) {
  const [stat, setStat] = useState<ShiftStat | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const sb = createClient();
      const shiftStart = new Date(Date.now() - 8 * 3_600_000).toISOString();

      const { data: batches } = await sb
        .from('mise_delivery_batches')
        .select('id, state, dispatch_score, stop_count, created_at, driver:mise_drivers(id, name)')
        .eq('location_id', locationId)
        .gte('created_at', shiftStart);

      const { data: orders } = await sb
        .from('customer_orders')
        .select('gesamtbetrag, geliefert_am, eta_latest, status')
        .eq('location_id', locationId)
        .gte('bestellt_am', shiftStart)
        .in('status', ['geliefert', 'abgeholt', 'abgeschlossen', 'unterwegs']);

      const rows = (batches ?? []) as any[];
      const ordRows = (orders ?? []) as any[];

      const completedTours = rows.filter((r) => r.state === 'completed').length;
      const activeTours = rows.filter((r) => ['assigned', 'at_restaurant', 'on_route'].length > 0 && ['assigned', 'at_restaurant', 'on_route'].includes(r.state)).length;
      const scores = rows.filter((r) => r.dispatch_score != null).map((r) => r.dispatch_score as number);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      // Driver aggregation
      const driverMap = new Map<string, { name: string; tours: number; scoreSum: number; deliveries: number }>();
      for (const r of rows) {
        const d = r.driver as { id: string; name: string } | null;
        if (!d) continue;
        const existing = driverMap.get(d.id) ?? { name: d.name, tours: 0, scoreSum: 0, deliveries: 0 };
        existing.tours++;
        if (r.dispatch_score != null) existing.scoreSum += r.dispatch_score;
        existing.deliveries += r.stop_count ?? 0;
        driverMap.set(d.id, existing);
      }
      const driverRows: DriverRow[] = Array.from(driverMap.values())
        .map((d) => ({ name: d.name, tours: d.tours, avgScore: d.tours > 0 ? d.scoreSum / d.tours : 0, deliveries: d.deliveries }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5);

      const topDriver = driverRows[0]?.name ?? null;
      const topDriverScore = driverRows[0]?.avgScore ?? null;

      const totalDeliveries = ordRows.length;
      const revenue = ordRows.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);

      const onTimeRows = ordRows.filter((o) => o.geliefert_am && o.eta_latest);
      const onTimeCount = onTimeRows.filter((o) => new Date(o.geliefert_am) <= new Date(o.eta_latest)).length;
      const onTimePct = onTimeRows.length > 0 ? Math.round((onTimeCount / onTimeRows.length) * 100) : null;

      setStat({
        totalTours: rows.length,
        completedTours,
        activeTours,
        totalDeliveries,
        avgScore,
        topDriver,
        topDriverScore,
        avgDeliveryMin: null,
        onTimePct,
        totalRevenue: revenue,
        trend: avgScore >= 80 ? 'up' : avgScore >= 65 ? 'neutral' : 'down',
      });
      setDrivers(driverRows);
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [open, load]);

  const TrendIcon = stat?.trend === 'up' ? TrendingUp : stat?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stat?.trend === 'up' ? 'text-emerald-400' : stat?.trend === 'down' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-400" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-white/90">
            Schicht-Bilanz
          </span>
          {stat && (
            <span className="text-[10px] text-white/40">
              {stat.totalTours} Touren · ø Score {stat.avgScore > 0 ? Math.round(stat.avgScore) : '–'}
            </span>
          )}
        </div>
        {stat && <TrendIcon className={cn('h-4 w-4', trendColor)} />}
      </button>

      {open && (
        <div className="border-t border-white/8 p-4 space-y-4">
          {loading && !stat && (
            <div className="text-sm text-white/40 text-center py-4">Lade Schicht-Daten…</div>
          )}

          {stat && (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Touren gesamt', value: stat.totalTours, icon: Bike, color: 'text-blue-400' },
                  { label: 'Lieferungen', value: stat.totalDeliveries, icon: CheckCircle2, color: 'text-matcha-400' },
                  { label: 'Pünktlich', value: stat.onTimePct != null ? `${stat.onTimePct}%` : '–', icon: Clock, color: stat.onTimePct != null && stat.onTimePct >= 80 ? 'text-emerald-400' : 'text-amber-400' },
                  { label: 'Ø Score', value: stat.avgScore > 0 ? Math.round(stat.avgScore) : '–', icon: Target, color: stat.avgScore >= 80 ? 'text-emerald-400' : stat.avgScore >= 65 ? 'text-amber-400' : 'text-red-400' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border border-white/8 bg-white/5 p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <kpi.icon className={cn('h-3 w-3', kpi.color)} />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">{kpi.label}</span>
                    </div>
                    <div className={cn('font-display text-xl font-black', kpi.color)}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Top Driver */}
              {stat.topDriver && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-700/30 bg-amber-950/20 px-3 py-2">
                  <Award className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/70">Top-Fahrer Schicht</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white/90">{stat.topDriver}</span>
                      {stat.topDriverScore != null && <ScorePill score={stat.topDriverScore} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Driver Rankings */}
              {drivers.length > 1 && (
                <div>
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/30">Fahrer-Rangliste (Schicht)</div>
                  <div className="space-y-1">
                    {drivers.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-4 text-[10px] font-black text-white/30 tabular-nums">{i + 1}.</span>
                        <span className="flex-1 text-xs text-white/70 truncate">{d.name}</span>
                        <span className="text-[10px] text-white/40 tabular-nums">{d.deliveries} Liefg.</span>
                        <ScorePill score={d.avgScore} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue */}
              {stat.totalRevenue > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    <Zap className="h-3 w-3 text-matcha-400" />
                    Schicht-Umsatz (Lieferungen)
                  </div>
                  <span className="font-display text-base font-black text-matcha-300">{euro(stat.totalRevenue)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
