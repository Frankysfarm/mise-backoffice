'use client';

import { useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import { TrendingUp, Trophy, Clock, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1454 — Schicht-Gewinn-Ring-Cockpit (Fahrer)
// Kompaktes KPI-Cockpit mit SVG-Fortschrittsringen für Einnahmen, Stops, Zeit

interface Props {
  driverId: string;
  isOnline: boolean;
  schichtStart?: string | null;
  completedStops?: number;
  totalStops?: number;
  earningsToday?: number;
  earningsGoal?: number;
  tipToday?: number;
  kmToday?: number;
}

function Ring({
  pct, color, size = 56, strokeWidth = 5,
  label, sublabel, icon,
}: {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel: string;
  icon?: React.ReactNode;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(pct, 1)) * circ;
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={strokeWidth} />
          <circle
            cx={cx} cy={cx} r={r} fill="none" stroke={color}
            strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {icon || <span className="text-[11px] font-black tabular-nums" style={{ color }}>{Math.round(pct * 100)}%</span>}
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-bold leading-tight">{label}</div>
        <div className="text-[9px] text-muted-foreground leading-tight">{sublabel}</div>
      </div>
    </div>
  );
}

function KpiPill({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex-1 rounded-xl bg-muted/30 border px-3 py-2 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-base font-black tabular-nums mt-0.5" style={{ color }}>{value}</div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}

export function FahrerPhase1454SchichtGewinnRingCockpit({
  driverId,
  isOnline,
  schichtStart,
  completedStops = 0,
  totalStops = 0,
  earningsToday = 0,
  earningsGoal = 80,
  tipToday = 0,
  kmToday = 0,
}: Props) {
  const schichtMinutes = useMemo(() => {
    if (!schichtStart) return null;
    return Math.floor((Date.now() - new Date(schichtStart).getTime()) / 60000);
  }, [schichtStart]);

  const earningsPct = earningsGoal > 0 ? earningsToday / earningsGoal : 0;
  const stopsPct = totalStops > 0 ? completedStops / totalStops : 0;
  const schichtPct = schichtMinutes !== null ? Math.min(1, schichtMinutes / 480) : 0;

  const schichtLabel = schichtMinutes !== null
    ? `${Math.floor(schichtMinutes / 60)}h ${schichtMinutes % 60}m`
    : '—';

  const totalWithTip = earningsToday + tipToday;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Trophy className="h-4 w-4 text-gold shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Gewinn-Cockpit</span>
        <span className={cn(
          'ml-auto text-[9px] font-black rounded-full px-2 py-0.5',
          isOnline ? 'bg-matcha-500 text-white' : 'bg-muted text-muted-foreground',
        )}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="px-4 pt-4 pb-3 space-y-4">
        {/* Fortschritts-Ringe */}
        <div className="flex items-end justify-around gap-2">
          <Ring
            pct={earningsPct}
            color="#2d6b45"
            label={euro(earningsToday)}
            sublabel={`Ziel: ${euro(earningsGoal)}`}
            icon={<TrendingUp className="h-4 w-4" style={{ color: '#2d6b45' }} />}
          />
          <Ring
            pct={stopsPct}
            color="#d97706"
            label={`${completedStops}/${totalStops}`}
            sublabel="Stops"
            icon={<MapPin className="h-4 w-4" style={{ color: '#d97706' }} />}
          />
          <Ring
            pct={schichtPct}
            color="#6366f1"
            label={schichtLabel}
            sublabel="Schichtzeit"
            icon={<Clock className="h-4 w-4" style={{ color: '#6366f1' }} />}
          />
        </div>

        {/* KPI-Pilllen */}
        <div className="flex gap-2">
          <KpiPill label="Einnahmen" value={euro(totalWithTip)} sub="inkl. Trinkgeld" color="#2d6b45" />
          <KpiPill label="Trinkgeld" value={euro(tipToday)} sub="heute gesamt" color="#d4a843" />
          <KpiPill label="Kilometer" value={`${kmToday.toFixed(1)} km`} sub="heute gefahren" color="#6366f1" />
        </div>

        {/* Earnings progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-muted-foreground">Einnahmen-Ziel</span>
            <span className="text-[10px] font-bold text-matcha-700">
              {Math.round(earningsPct * 100)}% erreicht
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${Math.min(100, earningsPct * 100)}%` }}
            />
          </div>
          {earningsPct < 1 && earningsGoal > earningsToday && (
            <div className="text-[9px] text-muted-foreground mt-0.5">
              Noch {euro(earningsGoal - earningsToday)} bis Ziel
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
