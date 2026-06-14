'use client';

/**
 * SchichtKpiLive
 *
 * Live-KPI-Panel für die Fahrer-App. Zeigt dem Fahrer auf einen Blick:
 * - Heute abgeschlossene Stops
 * - Ø Zeit pro Stopp (Effizienz)
 * - Gefahrene Kilometer gesamt
 * - Nächstes Ziel-Bonus (gamifizierter Anreiz)
 *
 * Daten kommen aus den abgeschlossenen Batch-Stops der aktuellen Schicht.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Award, CheckCircle2, Clock, MapPin, Route, Target, Trophy, Zap,
} from 'lucide-react';

interface ShiftKpi {
  stopsCompleted: number;
  stopsGoal: number;          // z.B. 10 Stops → nächster Bonus
  avgMinPerStop: number | null;
  totalKm: number;
  totalEarnings: number;      // Gesamtumsatz (kein Lohn, nur Info)
  ordersToday: number;
}

interface Props {
  driverId: string;
  onlineSeit: string | null;
}

const STOP_GOALS = [5, 10, 15, 20, 25, 30];

export function SchichtKpiLive({ driverId, onlineSeit }: Props) {
  const [kpi, setKpi] = useState<ShiftKpi | null>(null);
  const [now, setNow] = useState(new Date());
  const supabase = createClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;

    async function load() {
      try {
        const shiftStart = new Date();
        shiftStart.setHours(0, 0, 0, 0);

        // Abgeschlossene Stops heute
        const { data: stops } = await supabase
          .from('batch_stops')
          .select(`
            id,
            geliefert_am,
            angekommen_am,
            distanz_zum_vorgaenger_m,
            batch:delivery_batches!batch_id(driver_id, started_at),
            order:customer_orders!order_id(gesamtbetrag)
          `)
          .gte('geliefert_am', shiftStart.toISOString());

        if (cancelled) return;

        const myStops = (stops ?? []).filter(
          (s: any) => s.batch?.driver_id === driverId && s.geliefert_am,
        );

        const stopsCompleted = myStops.length;

        // Ø Minuten pro Stopp
        const timesMin: number[] = [];
        for (const s of myStops) {
          if (s.angekommen_am && s.geliefert_am) {
            const diff = (new Date(s.geliefert_am).getTime() - new Date(s.angekommen_am).getTime()) / 60_000;
            if (diff > 0 && diff < 60) timesMin.push(diff);
          }
        }
        const avgMinPerStop = timesMin.length > 0
          ? Math.round(timesMin.reduce((s, c) => s + c, 0) / timesMin.length)
          : null;

        // Gesamtstrecke
        const totalM = myStops.reduce((s: number, st: any) => s + (st.distanz_zum_vorgaenger_m ?? 0), 0);
        const totalKm = Math.round(totalM / 100) / 10;

        // Gesamtumsatz
        const totalEarnings = myStops.reduce((s: number, st: any) => s + (st.order?.gesamtbetrag ?? 0), 0);

        // Nächstes Ziel
        const nextGoal = STOP_GOALS.find((g) => g > stopsCompleted) ?? (stopsCompleted + 5);

        if (!cancelled) {
          setKpi({
            stopsCompleted,
            stopsGoal: nextGoal,
            avgMinPerStop,
            totalKm,
            totalEarnings,
            ordersToday: stopsCompleted,
          });
        }
      } catch {
        // Kein crash
      }
    }

    void load();
    const iv = setInterval(() => void load(), 3 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, onlineSeit]);

  if (!kpi) return null;

  const onlineSinceMin = onlineSeit
    ? Math.floor((now.getTime() - new Date(onlineSeit).getTime()) / 60_000)
    : null;

  const goalProgress = kpi.stopsGoal > 0 ? Math.min(1, kpi.stopsCompleted / kpi.stopsGoal) : 0;
  const stopsToGoal = Math.max(0, kpi.stopsGoal - kpi.stopsCompleted);
  const isGoalReached = kpi.stopsCompleted >= kpi.stopsGoal;

  const efficiencyLabel: string =
    kpi.avgMinPerStop == null ? '—' :
    kpi.avgMinPerStop <= 3 ? 'Super' :
    kpi.avgMinPerStop <= 5 ? 'Gut' :
    kpi.avgMinPerStop <= 8 ? 'OK' :
    'Langsam';

  const efficiencyColor =
    kpi.avgMinPerStop == null ? 'text-muted-foreground' :
    kpi.avgMinPerStop <= 3 ? 'text-matcha-600' :
    kpi.avgMinPerStop <= 5 ? 'text-blue-600' :
    kpi.avgMinPerStop <= 8 ? 'text-amber-600' :
    'text-red-500';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-gold shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-200">Schicht-Stats</span>
        {onlineSinceMin != null && (
          <span className="ml-auto text-[9px] text-matcha-400 tabular-nums">
            {onlineSinceMin >= 60
              ? `${Math.floor(onlineSinceMin / 60)}h ${onlineSinceMin % 60}m`
              : `${onlineSinceMin}m`} online
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Stops */}
        <div className="rounded-xl bg-accent/10 border border-accent/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-wide">Stops</span>
          </div>
          <div className="text-2xl font-black text-accent tabular-nums">{kpi.stopsCompleted}</div>
          <div className="text-[9px] text-matcha-400">heute geliefert</div>
        </div>

        {/* Ø Zeit */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-matcha-300" />
            <span className="text-[10px] font-bold text-matcha-300 uppercase tracking-wide">Ø/Stop</span>
          </div>
          <div className={cn('text-2xl font-black tabular-nums', efficiencyColor)}>
            {kpi.avgMinPerStop != null ? `${kpi.avgMinPerStop}m` : '—'}
          </div>
          <div className={cn('text-[9px]', efficiencyColor)}>{efficiencyLabel}</div>
        </div>

        {/* Distanz */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Route className="h-3.5 w-3.5 text-matcha-300" />
            <span className="text-[10px] font-bold text-matcha-300 uppercase tracking-wide">Distanz</span>
          </div>
          <div className="text-2xl font-black text-matcha-100 tabular-nums">
            {kpi.totalKm.toFixed(1)} <span className="text-sm font-medium">km</span>
          </div>
          <div className="text-[9px] text-matcha-400">heute gefahren</div>
        </div>

        {/* Umsatz */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Award className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] font-bold text-gold uppercase tracking-wide">Umsatz</span>
          </div>
          <div className="text-lg font-black text-gold tabular-nums">
            {euro(kpi.totalEarnings)}
          </div>
          <div className="text-[9px] text-matcha-400">geliefert</div>
        </div>
      </div>

      {/* Nächstes Ziel */}
      <div className={cn(
        'rounded-xl p-2.5 border',
        isGoalReached
          ? 'border-gold/40 bg-gold/10'
          : 'border-white/10 bg-white/5',
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Target className={cn('h-3.5 w-3.5', isGoalReached ? 'text-gold' : 'text-matcha-300')} />
            <span className={cn('text-[10px] font-black uppercase tracking-wide', isGoalReached ? 'text-gold' : 'text-matcha-300')}>
              {isGoalReached ? '🎉 Ziel erreicht!' : `Ziel: ${kpi.stopsGoal} Stops`}
            </span>
          </div>
          {!isGoalReached && (
            <span className="text-[10px] font-bold text-matcha-400">
              {stopsToGoal} fehlen noch
            </span>
          )}
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isGoalReached ? 'bg-gold' : 'bg-accent',
            )}
            style={{ width: `${goalProgress * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[8px] text-matcha-500 tabular-nums">
          <span>{kpi.stopsCompleted}</span>
          <span>{kpi.stopsGoal}</span>
        </div>
      </div>

      {/* Motivations-Nachricht */}
      {kpi.stopsCompleted > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-matcha-400">
          <Zap className="h-3 w-3 text-accent shrink-0" />
          {isGoalReached
            ? 'Mega! Nächstes Ziel wartet schon…'
            : kpi.avgMinPerStop != null && kpi.avgMinPerStop <= 4
            ? 'Starke Pace! Weiter so!'
            : 'Du schaffst das — bleib dran!'}
        </div>
      )}
    </div>
  );
}
