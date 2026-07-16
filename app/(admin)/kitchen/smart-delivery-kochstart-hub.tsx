'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, Bike, CheckCircle2, ChevronDown, ChevronUp, Clock, Flame, Loader2, Navigation, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OrderRow {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  fahrer_abgeholt_am?: string | null;
  zubereitung_start?: string | null;
  started_at?: string | null;
  prep_time_min?: number | null;
  driver_eta_min?: number | null;
  driver_name?: string | null;
  driver_distance_km?: number | null;
}

interface TimingRow {
  order_id: string;
  driver_eta_min?: number | null;
  driver_distance_km?: number | null;
  driver_name?: string | null;
  kochstart_empfohlen_at?: string | null;
}

interface Props {
  orders: OrderRow[];
  timings?: TimingRow[];
  locationId?: string | null;
}

function getCountdownColor(secsLeft: number): string {
  if (secsLeft <= 0) return 'bg-red-500 text-white';
  if (secsLeft < 120) return 'bg-red-500 text-white';
  if (secsLeft < 300) return 'bg-amber-400 text-white';
  return 'bg-matcha-500 text-white';
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function KitchenSmartDeliveryKochstartHub({ orders, timings = [], locationId }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'new', 'accepted'].includes(o.status),
  );

  if (active.length === 0) return null;

  const rows = active.map((o) => {
    const t = timings.find((t) => t.order_id === o.id);
    const prepSec = ((o.prep_time_min ?? 15) * 60);
    const startedAt = o.zubereitung_start ?? o.started_at;
    const etaMin = t?.driver_eta_min ?? o.driver_eta_min ?? null;
    const driverKm = t?.driver_distance_km ?? o.driver_distance_km ?? null;
    const driverName = t?.driver_name ?? o.driver_name ?? null;

    let countdownSec: number | null = null;
    let phase: 'waiting' | 'cooking' | 'ready' = 'waiting';

    if (startedAt) {
      const elapsed = (now - new Date(startedAt).getTime()) / 1000;
      countdownSec = Math.max(0, prepSec - elapsed);
      phase = countdownSec > 0 ? 'cooking' : 'ready';
    } else if (etaMin !== null) {
      const idealKochstart = (etaMin - (o.prep_time_min ?? 15)) * 60;
      countdownSec = Math.max(0, idealKochstart);
      phase = 'waiting';
    }

    const urgency =
      countdownSec !== null && countdownSec <= 0
        ? 'critical'
        : countdownSec !== null && countdownSec < 180
        ? 'urgent'
        : 'ok';

    return { o, t, countdownSec, phase, urgency, etaMin, driverKm, driverName };
  });

  const criticals = rows.filter((r) => r.urgency === 'critical').length;
  const urgents = rows.filter((r) => r.urgency === 'urgent').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Smart Kochstart-Hub
          </span>
          <div className="flex gap-1">
            {criticals > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {criticals} kritisch
              </span>
            )}
            {urgents > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
                {urgents} dringend
              </span>
            )}
            {criticals === 0 && urgents === 0 && (
              <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
                {active.length} aktiv
              </span>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows
            .sort((a, b) => {
              const priority: Record<string, number> = { critical: 0, urgent: 1, ok: 2 };
              return (priority[a.urgency] ?? 2) - (priority[b.urgency] ?? 2);
            })
            .map(({ o, countdownSec, phase, urgency, etaMin, driverKm, driverName }) => (
              <div
                key={o.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  urgency === 'critical' && 'bg-red-50/60',
                  urgency === 'urgent' && 'bg-amber-50/60',
                )}
              >
                {/* Countdown Badge */}
                <div
                  className={cn(
                    'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-mono text-sm font-black leading-tight',
                    countdownSec !== null
                      ? getCountdownColor(countdownSec)
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {countdownSec !== null ? (
                    <>
                      <span className="text-[10px] font-bold uppercase opacity-80">
                        {phase === 'cooking' ? 'fertig' : phase === 'ready' ? 'bereit' : 'start'}
                      </span>
                      <span className="text-base tabular-nums leading-none">
                        {formatCountdown(countdownSec)}
                      </span>
                    </>
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>

                {/* Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">
                      #{o.bestellnummer ?? o.id.slice(0, 6)}
                    </span>
                    {phase === 'cooking' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
                        <Flame className="h-3 w-3" /> kocht
                      </span>
                    )}
                    {phase === 'ready' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> bereit
                      </span>
                    )}
                    {phase === 'waiting' && urgency === 'critical' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        <AlarmClock className="h-3 w-3" /> jetzt kochen!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {o.prep_time_min ?? 15} Min Prep
                    </span>
                    {etaMin !== null && (
                      <span className="flex items-center gap-1">
                        <Bike className="h-3 w-3" />
                        Fahrer {Math.round(etaMin)} Min
                        {driverKm !== null && ` · ${driverKm.toFixed(1)} km`}
                      </span>
                    )}
                    {driverName && (
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {driverName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Phase indicator bar */}
                {phase === 'cooking' && countdownSec !== null && (
                  <div className="hidden sm:block w-24 shrink-0">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          countdownSec < 60 ? 'bg-red-500' : countdownSec < 180 ? 'bg-amber-400' : 'bg-matcha-500',
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            100 - (countdownSec / ((o.prep_time_min ?? 15) * 60)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground text-right mt-0.5 tabular-nums">
                      {Math.round(100 - (countdownSec / ((o.prep_time_min ?? 15) * 60)) * 100)}%
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
