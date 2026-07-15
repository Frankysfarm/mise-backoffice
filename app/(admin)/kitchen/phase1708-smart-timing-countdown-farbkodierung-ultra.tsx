'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Clock, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  estimated_prep_min?: number | null;
  angenommen_am?: string | null;
  zubereitung_start?: string | null;
  fertig_am?: string | null;
  kunde_name?: string | null;
}

interface Props {
  orders: Order[];
  locationId?: string | null;
}

type Stage = 'ok' | 'warn' | 'critical' | 'done';

const STAGE: Record<Stage, {
  bg: string; border: string; ring: string; text: string; badge: string; label: string; pulsate: boolean;
}> = {
  ok: {
    bg: 'bg-matcha-50', border: 'border-matcha-200', ring: 'bg-matcha-500',
    text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-800', label: 'Im Plan', pulsate: false,
  },
  warn: {
    bg: 'bg-amber-50', border: 'border-amber-200', ring: 'bg-amber-400',
    text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', label: 'Zeitkritisch', pulsate: false,
  },
  critical: {
    bg: 'bg-red-50', border: 'border-red-200', ring: 'bg-red-500',
    text: 'text-red-700', badge: 'bg-red-100 text-red-800', label: 'Überfällig', pulsate: true,
  },
  done: {
    bg: 'bg-stone-50', border: 'border-stone-200', ring: 'bg-stone-400',
    text: 'text-stone-500', badge: 'bg-stone-100 text-stone-600', label: 'Fertig', pulsate: false,
  },
};

function getStage(elapsedSec: number, targetSec: number, isDone: boolean): Stage {
  if (isDone) return 'done';
  const ratio = elapsedSec / Math.max(targetSec, 1);
  if (ratio >= 1.15) return 'critical';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}

function fmtCountdown(remainSec: number): string {
  if (remainSec <= 0) {
    const over = Math.abs(remainSec);
    const m = Math.floor(over / 60);
    const s = over % 60;
    return `-${m}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1708SmartTimingCountdownFarbkodierungUltra({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const active = orders.filter(
      (o) => o.status && ['accepted', 'in_progress', 'preparing', 'ready', 'angenommen', 'zubereitung', 'fertig'].includes(o.status),
    );
    return active
      .map((o) => {
        const isDone = ['ready', 'fertig'].includes(o.status ?? '');
        const startMs = o.zubereitung_start
          ? new Date(o.zubereitung_start).getTime()
          : o.angenommen_am
            ? new Date(o.angenommen_am).getTime()
            : now;
        const targetSec = (o.estimated_prep_min ?? 15) * 60;
        const elapsedSec = Math.floor((now - startMs) / 1000);
        const remainSec = targetSec - elapsedSec;
        const stage = getStage(elapsedSec, targetSec, isDone);
        const progressPct = Math.min(100, Math.round((elapsedSec / Math.max(targetSec, 1)) * 100));
        return { o, elapsedSec, remainSec, targetSec, stage, progressPct, isDone };
      })
      .sort((a, b) => {
        const stageOrder: Stage[] = ['critical', 'warn', 'ok', 'done'];
        const diff = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
        if (diff !== 0) return diff;
        return a.remainSec - b.remainSec;
      });
  }, [orders, now]);

  const counts = useMemo(() => ({
    critical: rows.filter((r) => r.stage === 'critical').length,
    warn: rows.filter((r) => r.stage === 'warn').length,
    ok: rows.filter((r) => r.stage === 'ok').length,
    done: rows.filter((r) => r.stage === 'done').length,
  }), [rows]);

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing Countdown</span>
          {counts.critical > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
              {counts.critical} überfällig
            </span>
          )}
          {counts.warn > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
              {counts.warn} zeitkritisch
            </span>
          )}
          <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
            {rows.length} aktiv
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Stage-Legende */}
          <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/10 flex-wrap">
            {(['ok', 'warn', 'critical', 'done'] as Stage[]).map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn('h-2 w-2 rounded-full', STAGE[s].ring, s === 'critical' && 'animate-pulse')} />
                <span className="text-[10px] font-semibold text-muted-foreground">{STAGE[s].label}: {counts[s]}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-border">
            {rows.map(({ o, elapsedSec, remainSec, targetSec, stage, progressPct, isDone }) => {
              const cfg = STAGE[stage];
              const overdue = remainSec < 0;
              return (
                <div key={o.id} className={cn('p-3 flex flex-col gap-1.5', cfg.bg)}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-foreground truncate">
                        #{o.bestellnummer ?? o.id.slice(-4)}
                        {o.kunde_name && <span className="font-normal text-muted-foreground ml-1">· {o.kunde_name}</span>}
                      </div>
                      <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', cfg.badge)}>
                        {cfg.label}
                      </span>
                    </div>
                    {/* Countdown */}
                    <div className={cn(
                      'font-mono text-lg font-black tabular-nums shrink-0',
                      stage === 'critical' ? 'text-red-600' : stage === 'warn' ? 'text-amber-600' : stage === 'done' ? 'text-stone-400' : 'text-matcha-700',
                    )}>
                      {isDone
                        ? <CheckCircle2 className="h-5 w-5 text-matcha-500" />
                        : overdue
                          ? <span className="flex items-center gap-0.5"><AlertTriangle className="h-3.5 w-3.5" />{fmtCountdown(remainSec)}</span>
                          : fmtCountdown(remainSec)
                      }
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        stage === 'critical' ? 'bg-red-500' : stage === 'warn' ? 'bg-amber-400' : stage === 'done' ? 'bg-stone-400' : 'bg-matcha-500',
                        cfg.pulsate && 'animate-pulse',
                      )}
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>{Math.floor(elapsedSec / 60)}m vergangen</span>
                    <span>Ziel: {Math.floor(targetSec / 60)}m</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
