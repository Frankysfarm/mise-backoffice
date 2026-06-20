'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle, Zap, ChefHat } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type UrgencyLevel = 'kritisch' | 'dringend' | 'normal' | 'ok';

interface TimingRow {
  id: string;
  bestellnummer: string;
  kundenname: string;
  urgency: UrgencyLevel;
  remainSec: number | null;
  phase: string;
  cookStartNeededSec: number | null;
  targetMin: number;
}

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function computeRows(orders: Order[], timings: KitchenTiming[], now: number): TimingRow[] {
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));
  const rows: TimingRow[] = [];

  for (const o of orders) {
    if (!['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)) continue;

    const t = timingMap.get(o.id);
    const targetMin = t?.prep_min ?? o.geschaetzte_zubereitung_min ?? 20;

    let remainSec: number | null = null;
    let cookStartNeededSec: number | null = null;
    let urgency: UrgencyLevel = 'normal';
    let phase = o.status;

    if (t?.ready_target) {
      remainSec = Math.floor((new Date(t.ready_target).getTime() - now) / 1000);
      if (remainSec < -120) urgency = 'kritisch';
      else if (remainSec < 180) urgency = 'dringend';
      else if (remainSec < 360) urgency = 'normal';
      else urgency = 'ok';
    } else if (o.bestellt_am) {
      const elapsedMin = (now - new Date(o.bestellt_am).getTime()) / 60_000;
      const remaining = targetMin - elapsedMin;
      remainSec = Math.floor(remaining * 60);
      if (remaining < 0) urgency = 'kritisch';
      else if (remaining < 5) urgency = 'dringend';
      else if (remaining < 10) urgency = 'normal';
      else urgency = 'ok';

      if (o.status !== 'in_zubereitung') {
        cookStartNeededSec = Math.max(0, Math.floor(remaining * 60));
      }
    }

    rows.push({
      id: o.id,
      bestellnummer: o.bestellnummer,
      kundenname: o.kunde_name,
      urgency,
      remainSec,
      phase,
      cookStartNeededSec,
      targetMin,
    });
  }

  return rows.sort((a, b) => {
    const order: UrgencyLevel[] = ['kritisch', 'dringend', 'normal', 'ok'];
    const diff = order.indexOf(a.urgency) - order.indexOf(b.urgency);
    if (diff !== 0) return diff;
    if (a.remainSec !== null && b.remainSec !== null) return a.remainSec - b.remainSec;
    return 0;
  });
}

function fmtTime(sec: number | null): string {
  if (sec === null) return '--:--';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

const URGENCY_CONFIG: Record<UrgencyLevel, {
  bg: string; border: string; text: string; badge: string; ringColor: string; icon: typeof Flame;
}> = {
  kritisch: { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    badge: 'bg-red-500 text-white',         ringColor: '#ef4444', icon: Flame },
  dringend: { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  badge: 'bg-amber-400 text-white',       ringColor: '#f59e0b', icon: AlertTriangle },
  normal:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-400 text-white',        ringColor: '#3b82f6', icon: ChefHat },
  ok:       { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', badge: 'bg-matcha-500 text-white',      ringColor: '#6b9c5a', icon: CheckCircle2 },
};

function CountdownRing({ sec, maxSec, color }: { sec: number; maxSec: number; color: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, sec / maxSec));
  const dash = circ * pct;
  return (
    <svg width={44} height={44} className="shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
      <circle
        cx={22} cy={22} r={r} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 1s linear' }}
      />
    </svg>
  );
}

export function KitchenSmartTimingDashboard({ orders, timings }: Props) {
  useTick();
  const now = Date.now();
  const rows = computeRows(orders, timings, now);

  if (rows.length === 0) return null;

  const critical = rows.filter((r) => r.urgency === 'kritisch').length;
  const urgent = rows.filter((r) => r.urgency === 'dringend').length;

  const headerBg = critical > 0 ? 'bg-red-600' : urgent > 0 ? 'bg-amber-500' : 'bg-matcha-600';

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2', headerBg)}>
        <Zap className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Smart Timing · {rows.length} aktiv
        </span>
        {critical > 0 && (
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            {critical} ÜBERFÄLLIG
          </span>
        )}
        {critical === 0 && urgent > 0 && (
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            {urgent} dringend
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
        {rows.slice(0, 8).map((row) => {
          const cfg = URGENCY_CONFIG[row.urgency];
          const Icon = cfg.icon;
          const maxSec = row.targetMin * 60;
          const displaySec = row.remainSec ?? 0;

          return (
            <div key={row.id} className={cn('flex items-center gap-3 p-3', cfg.bg)}>
              {/* Ring */}
              <div className="relative shrink-0">
                <CountdownRing sec={Math.max(0, displaySec)} maxSec={maxSec} color={cfg.ringColor} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon size={12} className={cfg.text} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground">#{row.bestellnummer}</span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', cfg.badge)}>
                    {row.urgency.toUpperCase()}
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-bold truncate">{row.kundenname}</div>
                {row.cookStartNeededSec !== null && row.cookStartNeededSec < 300 && (
                  <div className="text-[10px] text-amber-600 font-semibold">
                    Kochstart in {Math.ceil(row.cookStartNeededSec / 60)} Min
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="shrink-0 text-right">
                <div className={cn(
                  'font-mono text-base font-black tabular-nums',
                  row.urgency === 'kritisch' ? 'text-red-600' :
                  row.urgency === 'dringend' ? 'text-amber-600' : cfg.text,
                )}>
                  {fmtTime(row.remainSec)}
                </div>
                <div className="text-[8px] text-muted-foreground">verbleibend</div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > 8 && (
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-center bg-muted/30">
          +{rows.length - 8} weitere Bestellungen
        </div>
      )}
    </div>
  );
}
