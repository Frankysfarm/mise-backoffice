'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Award, BarChart2, CheckCircle2, Clock, MapPin, Star, TrendingUp, Trophy, X, Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Phase 2001 — Schicht-Abschluss-Assistent (Fahrer-App)
 *
 * Wird aktiv wenn der Fahrer keine aktive Tour mehr hat und Lieferungen heute getätigt hat.
 * Zeigt:
 * - Heutige Statistik: Lieferungen, Durchschnittszeit, Trinkgeld, Gesamteinnahmen
 * - Performance-Badge (Goldstar / Silber / Bronze / Einsteiger)
 * - Top-Bewertungen der letzten Tour
 * - Motivationsnachricht
 */

interface ShiftStats {
  deliveries: number;
  avgDeliveryMin: number | null;
  totalEarnings: number;
  totalTips: number;
  score: number | null;
  onTimeRate: number | null;
}

interface FahrerPhase2001Props {
  driverId: string | null;
  hasActiveTour: boolean;
}

function getBadge(stats: ShiftStats): { label: string; color: string; bg: string; icon: React.ReactNode } {
  const score = stats.score ?? 0;
  const deliveries = stats.deliveries;
  if (score >= 85 && deliveries >= 5) return { label: 'Gold-Fahrer', color: 'text-yellow-300', bg: 'bg-yellow-950/50 border-yellow-700/50', icon: <Trophy className="w-5 h-5 text-yellow-400" /> };
  if (score >= 70 && deliveries >= 3) return { label: 'Silber-Fahrer', color: 'text-neutral-300', bg: 'bg-neutral-800/60 border-neutral-600/50', icon: <Star className="w-5 h-5 text-neutral-400" /> };
  if (score >= 55 || deliveries >= 2) return { label: 'Bronze-Fahrer', color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/50', icon: <Award className="w-5 h-5 text-amber-500" /> };
  return { label: 'Auf dem Weg', color: 'text-blue-300', bg: 'bg-blue-950/40 border-blue-800/50', icon: <Zap className="w-5 h-5 text-blue-400" /> };
}

function motivationMsg(stats: ShiftStats): string {
  if (stats.deliveries === 0) return 'Bereit für den nächsten Einsatz!';
  if ((stats.score ?? 0) >= 85) return `Perfekte Schicht! ${stats.deliveries} Lieferungen — du bist ein Star!`;
  if ((stats.onTimeRate ?? 0) >= 90) return `Pünktlichkeit auf höchstem Niveau. Weiter so!`;
  if (stats.totalTips > 0) return `${euro(stats.totalTips)} Trinkgeld — die Kunden schätzen dich!`;
  return `${stats.deliveries} Lieferungen heute — gute Arbeit!`;
}

export function FahrerPhase2001SchichtAbschlussAssistent({ driverId, hasActiveTour }: FahrerPhase2001Props) {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasActiveTour || !driverId || dismissed) return;
    setLoading(true);

    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase
      .from('tour_stops')
      .select('geliefert_am, angekommen_am, order:orders(gesamtbetrag, trinkgeld)')
      .eq('driver_id', driverId)
      .gte('geliefert_am', todayStart.toISOString())
      .not('geliefert_am', 'is', null)
      .limit(100)
      .then(({ data }) => {
        if (!data || data.length === 0) { setLoading(false); return; }

        const deliveries = data.length;
        const durations = data
          .filter((s: any) => s.angekommen_am && s.geliefert_am)
          .map((s: any) => (new Date(s.geliefert_am).getTime() - new Date(s.angekommen_am).getTime()) / 60000);
        const avgDeliveryMin = durations.length > 0 ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : null;

        const totalEarnings = data.reduce((sum: number, s: any) => sum + ((s.order as any)?.gesamtbetrag ?? 0), 0);
        const totalTips = data.reduce((sum: number, s: any) => sum + ((s.order as any)?.trinkgeld ?? 0), 0);

        setStats({ deliveries, avgDeliveryMin: avgDeliveryMin ? Math.round(avgDeliveryMin) : null, totalEarnings, totalTips, score: null, onTimeRate: null });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Also try to get driver score
    supabase
      .from('drivers')
      .select('score, on_time_rate')
      .eq('id', driverId)
      .single()
      .then(({ data }) => {
        if (data) {
          setStats((prev) =>
            prev ? { ...prev, score: (data as any).score ?? null, onTimeRate: (data as any).on_time_rate ?? null } : prev,
          );
        }
      });
  }, [driverId, hasActiveTour, dismissed]);

  if (hasActiveTour || dismissed || loading || !stats || stats.deliveries === 0) return null;

  const badge = getBadge(stats);
  const msg = motivationMsg(stats);

  return (
    <Card className="border-matcha-800/30 bg-matcha-950/20 p-4 space-y-4 relative">
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-neutral-600 hover:text-neutral-300 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <span className="text-xs font-semibold text-matcha-300 uppercase tracking-wider">Schicht-Abschluss</span>
        <span className="text-[10px] text-neutral-500">Phase 2001</span>
      </div>

      {/* Badge */}
      <div className={cn('rounded-xl border p-3 flex items-center gap-3', badge.bg)}>
        {badge.icon}
        <div>
          <div className={cn('text-sm font-bold', badge.color)}>{badge.label}</div>
          <div className="text-xs text-neutral-400">{msg}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-neutral-900/60 border border-neutral-800/50 p-2.5 space-y-0.5">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Lieferungen</div>
          <div className="text-xl font-bold text-neutral-100">{stats.deliveries}</div>
        </div>
        <div className="rounded-lg bg-neutral-900/60 border border-neutral-800/50 p-2.5 space-y-0.5">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Trinkgeld</div>
          <div className="text-xl font-bold text-green-400">{euro(stats.totalTips)}</div>
        </div>
        {stats.avgDeliveryMin != null && (
          <div className="rounded-lg bg-neutral-900/60 border border-neutral-800/50 p-2.5 space-y-0.5">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Ø Stoppzeit</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-neutral-100">{stats.avgDeliveryMin}</span>
              <span className="text-xs text-neutral-500">min</span>
            </div>
          </div>
        )}
        {stats.score != null && (
          <div className="rounded-lg bg-neutral-900/60 border border-neutral-800/50 p-2.5 space-y-0.5">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Score</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-matcha-300">{stats.score}</span>
              <span className="text-xs text-neutral-500">/ 100</span>
            </div>
          </div>
        )}
      </div>

      {/* On-time bar */}
      {stats.onTimeRate != null && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-1">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pünktlichkeit</span>
            <span>{Math.round(stats.onTimeRate)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-800">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                stats.onTimeRate >= 85 ? 'bg-green-500' : stats.onTimeRate >= 70 ? 'bg-yellow-500' : 'bg-red-500',
              )}
              style={{ width: `${Math.min(stats.onTimeRate, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-[10px] text-neutral-600 text-center">Daten werden für den nächsten Einsatz zurückgesetzt</div>
    </Card>
  );
}
