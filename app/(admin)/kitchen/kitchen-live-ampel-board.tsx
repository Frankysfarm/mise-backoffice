'use client';

/**
 * KitchenLiveAmpelBoard
 * Kompakter Echtzeit-Ampel-Überblick: Bestellungen als farbige Kacheln (grün/gelb/rot)
 * mit sekundengenauem Countdown. Ideal für den oberen Sichtbereich der Küche.
 */

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, CheckCircle2, AlertTriangle, Bike, Flame, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  typ: string;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type DriverETA = {
  order_id: string;
  driver_name: string;
  eta_sec: number;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
  driverETAs?: DriverETA[];
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig';

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function calcAmpel(remainSec: number | null): Ampel {
  if (remainSec === null) return 'gruen';
  if (remainSec < 0) return 'rot';
  if (remainSec < 180) return 'gelb';
  return 'gruen';
}

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

const AMPEL_STYLE: Record<Ampel, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  gruen:  { bg: 'bg-emerald-50',  border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  gelb:   { bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-800',   badge: 'bg-amber-500 text-white',   dot: 'bg-amber-500 animate-pulse' },
  rot:    { bg: 'bg-red-50',      border: 'border-red-300',     text: 'text-red-800',     badge: 'bg-red-600 text-white',     dot: 'bg-red-600 animate-ping' },
  fertig: { bg: 'bg-matcha-50',   border: 'border-matcha-300',  text: 'text-matcha-800',  badge: 'bg-matcha-500 text-white',  dot: 'bg-matcha-500' },
};

const STATUS_LABEL: Record<string, string> = {
  neu: 'Neu',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
  unterwegs: 'Unterwegs',
};

export function KitchenLiveAmpelBoard({ orders, timings, driverETAs = [] }: Props) {
  useTick();

  const timingMap = useMemo(() => new Map(timings.map(t => [t.order_id, t])), [timings]);
  const etaMap = useMemo(() => new Map(driverETAs.map(e => [e.order_id, e])), [driverETAs]);

  const rows = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status))
      .map(o => {
        const t = timingMap.get(o.id);
        const eta = etaMap.get(o.id);

        let remainSec: number | null = null;
        if (t?.ready_target) {
          remainSec = Math.floor((new Date(t.ready_target).getTime() - now) / 1000);
        } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
          const targetMs = new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000;
          remainSec = Math.floor((targetMs - now) / 1000);
        }

        const ampel: Ampel = o.status === 'fertig' ? 'fertig' : calcAmpel(remainSec);
        const driverArrivingSec = eta?.eta_sec ?? null;
        const urgency = ampel === 'rot' ? 3 : ampel === 'gelb' ? 2 : ampel === 'gruen' ? 1 : 0;

        return { o, t, ampel, remainSec, driverArrivingSec, urgency, driverName: eta?.driver_name ?? null };
      })
      .sort((a, b) => b.urgency - a.urgency || (a.remainSec ?? 9999) - (b.remainSec ?? 9999));
  }, [orders, timingMap, etaMap]);

  const counts = useMemo(() => ({
    rot: rows.filter(r => r.ampel === 'rot').length,
    gelb: rows.filter(r => r.ampel === 'gelb').length,
    gruen: rows.filter(r => r.ampel === 'gruen').length,
    fertig: rows.filter(r => r.ampel === 'fertig').length,
  }), [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-gradient-to-r from-matcha-50 to-white">
        <Flame className="h-5 w-5 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-800">
          Live-Ampel-Board
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {counts.rot > 0 && (
            <span className="flex h-6 items-center gap-1 rounded-full bg-red-600 px-2 text-[10px] font-black text-white animate-pulse">
              <AlertTriangle size={10} /> {counts.rot}
            </span>
          )}
          {counts.gelb > 0 && (
            <span className="flex h-6 items-center gap-1 rounded-full bg-amber-500 px-2 text-[10px] font-black text-white">
              <Clock size={10} /> {counts.gelb}
            </span>
          )}
          {counts.gruen > 0 && (
            <span className="flex h-6 items-center gap-1 rounded-full bg-emerald-500 px-2 text-[10px] font-black text-white">
              <ChefHat size={10} /> {counts.gruen}
            </span>
          )}
          {counts.fertig > 0 && (
            <span className="flex h-6 items-center gap-1 rounded-full bg-matcha-500 px-2 text-[10px] font-black text-white">
              <CheckCircle2 size={10} /> {counts.fertig}
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map(({ o, ampel, remainSec, driverArrivingSec, driverName }) => {
          const style = AMPEL_STYLE[ampel];
          return (
            <div
              key={o.id}
              className={cn(
                'relative flex flex-col gap-1.5 rounded-xl border-2 p-3 transition-all',
                style.bg, style.border,
              )}
            >
              {/* Status dot */}
              <div className={cn('absolute right-2 top-2 h-2.5 w-2.5 rounded-full', style.dot)} />

              {/* Order number + type */}
              <div className="flex items-center gap-1.5">
                {o.typ === 'lieferung' ? (
                  <Bike className={cn('h-3.5 w-3.5 shrink-0', style.text)} />
                ) : (
                  <ChefHat className={cn('h-3.5 w-3.5 shrink-0', style.text)} />
                )}
                <span className={cn('text-xs font-black tabular-nums', style.text)}>
                  #{o.bestellnummer}
                </span>
              </div>

              {/* Customer name */}
              <div className={cn('truncate text-[10px] font-medium', style.text, 'opacity-70')}>
                {o.kunde_name}
              </div>

              {/* Countdown */}
              {remainSec !== null ? (
                <div className={cn('mt-auto text-lg font-black tabular-nums leading-none', style.text)}>
                  {fmtSec(remainSec)}
                  <span className={cn('ml-0.5 text-[9px] font-bold opacity-60')}>min</span>
                </div>
              ) : (
                <div className={cn('mt-auto text-xs font-bold', style.text, 'opacity-50')}>—</div>
              )}

              {/* Status badge */}
              <span className={cn('inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide', style.badge)}>
                {STATUS_LABEL[o.status] ?? o.status}
              </span>

              {/* Driver ETA */}
              {driverArrivingSec !== null && driverName && (
                <div className="mt-0.5 flex items-center gap-0.5 text-[9px] font-medium text-matcha-700">
                  <Bike size={8} />
                  <span className="truncate">{driverName}</span>
                  <span className="ml-auto tabular-nums font-bold">
                    {Math.round(driverArrivingSec / 60)}m
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t px-4 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" /> Überfällig</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {'<'} 3 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> In der Zeit</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500" /> Fertig</span>
        <span className="ml-auto flex items-center gap-1">
          <Zap size={10} /> Live-Aktualisierung
        </span>
      </div>
    </div>
  );
}
