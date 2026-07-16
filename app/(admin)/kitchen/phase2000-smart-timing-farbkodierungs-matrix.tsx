'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, AlertTriangle, CheckCircle2, Zap, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 2000 — Smart Timing Farbkodierungs-Matrix (Kitchen)
 *
 * Echtzeit-Farbkodierungs-Grid aller aktiven Bestellungen:
 * - Grün: >10 Min verbleibend
 * - Amber: 5–10 Min verbleibend
 * - Orange: 2–5 Min verbleibend
 * - Rot/Pulsierend: <2 Min oder überfällig
 * Countdown auf Sekundengenauigkeit. Fahrer-ETA-Sync.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  fertig_am?: string | null;
  delivery_zone?: string | null;
  items?: { name?: string }[];
}

type ColorStatus = 'gut' | 'bald' | 'kritisch' | 'ueberfaellig' | 'fertig';

function fmtCountdownSec(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const neg = sek < 0 ? '-' : '';
  return `${neg}${m}:${String(s).padStart(2, '0')}`;
}

function getColorStatus(remainSec: number): ColorStatus {
  if (remainSec > 10 * 60) return 'gut';
  if (remainSec > 5 * 60) return 'bald';
  if (remainSec > 2 * 60) return 'kritisch';
  return 'ueberfaellig';
}

const COLOR_CONFIG: Record<ColorStatus, { bg: string; border: string; badge: string; label: string; textColor: string }> = {
  gut:         { bg: 'bg-green-50 dark:bg-green-950/20',   border: 'border-green-200 dark:border-green-800',   badge: 'bg-green-500',   label: 'OK',          textColor: 'text-green-700 dark:text-green-300' },
  bald:        { bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800',   badge: 'bg-amber-500',   label: 'Bald',        textColor: 'text-amber-700 dark:text-amber-300' },
  kritisch:    { bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-500',  label: 'Kritisch',    textColor: 'text-orange-700 dark:text-orange-300' },
  ueberfaellig:{ bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-200 dark:border-red-800',       badge: 'bg-red-600',     label: 'Überfällig',  textColor: 'text-red-700 dark:text-red-300' },
  fertig:      { bg: 'bg-muted/20',                        border: 'border-border',                            badge: 'bg-muted-foreground', label: 'Fertig',  textColor: 'text-muted-foreground' },
};

export function KitchenPhase2000SmartTimingFarbkodierungsMatrix({
  orders,
  className,
}: {
  orders: Order[];
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const rows = useMemo(() => {
    return orders
      .filter((o) => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status ?? ''))
      .map((o) => {
        const istFertig = o.status === 'fertig';
        const startMs = o.zubereitung_start
          ? new Date(o.zubereitung_start).getTime()
          : o.bestellt_am
          ? new Date(o.bestellt_am).getTime()
          : null;
        const estMin = o.geschaetzte_zubereitung_min ?? 15;
        const targetMs = startMs ? startMs + estMin * 60_000 : null;
        const remainSec = targetMs ? Math.round((targetMs - now) / 1000) : null;
        const colorStatus: ColorStatus = istFertig ? 'fertig' : remainSec !== null ? getColorStatus(remainSec) : 'bald';
        const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : null;
        const progressPct = targetMs && startMs ? Math.min(100, Math.round(((now - startMs) / (targetMs - startMs)) * 100)) : 0;

        return { order: o, remainSec, colorStatus, elapsedMin, progressPct, estMin };
      })
      .sort((a, b) => {
        const order: ColorStatus[] = ['ueberfaellig', 'kritisch', 'bald', 'gut', 'fertig'];
        return order.indexOf(a.colorStatus) - order.indexOf(b.colorStatus);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const counts = useMemo(() => ({
    ueberfaellig: rows.filter((r) => r.colorStatus === 'ueberfaellig').length,
    kritisch:     rows.filter((r) => r.colorStatus === 'kritisch').length,
    bald:         rows.filter((r) => r.colorStatus === 'bald').length,
    gut:          rows.filter((r) => r.colorStatus === 'gut').length,
    fertig:       rows.filter((r) => r.colorStatus === 'fertig').length,
  }), [rows]);

  if (rows.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Smart Timing Matrix</span>

        {/* Ampel-Zusammenfassung */}
        <div className="flex items-center gap-1.5 ml-2">
          {counts.ueberfaellig > 0 && (
            <span className="rounded-full bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 min-w-[18px] text-center">{counts.ueberfaellig}</span>
          )}
          {counts.kritisch > 0 && (
            <span className="rounded-full bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 min-w-[18px] text-center">{counts.kritisch}</span>
          )}
          {counts.bald > 0 && (
            <span className="rounded-full bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 min-w-[18px] text-center">{counts.bald}</span>
          )}
          {counts.gut > 0 && (
            <span className="rounded-full bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 min-w-[18px] text-center">{counts.gut}</span>
          )}
        </div>

        {counts.ueberfaellig > 0 && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
        )}

        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{rows.length} Bestellung{rows.length !== 1 ? 'en' : ''}</span>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {offen && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(({ order, remainSec, colorStatus, elapsedMin, progressPct, estMin }) => {
            const cfg = COLOR_CONFIG[colorStatus];
            const isPulse = colorStatus === 'ueberfaellig';
            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border p-3 flex flex-col gap-2 transition-all',
                  cfg.bg, cfg.border,
                  isPulse && 'animate-pulse',
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.badge)} />
                    <span className="text-xs font-bold truncate text-foreground">
                      #{order.bestellnummer ?? order.id.slice(-4)}
                    </span>
                    {order.delivery_zone && (
                      <span className="text-[9px] rounded bg-white/60 dark:bg-black/20 border px-1 py-0.5 font-bold shrink-0">
                        Z{order.delivery_zone}
                      </span>
                    )}
                  </div>
                  <span className={cn('text-[9px] font-black rounded-full px-1.5 py-0.5 shrink-0', cfg.badge, 'text-white')}>
                    {cfg.label}
                  </span>
                </div>

                {/* Countdown */}
                <div className="flex items-center gap-2">
                  <Clock className={cn('h-3.5 w-3.5 shrink-0', cfg.textColor)} />
                  {remainSec !== null ? (
                    <span className={cn('font-mono text-lg font-black tabular-nums leading-none', cfg.textColor)}>
                      {fmtCountdownSec(remainSec)}
                    </span>
                  ) : (
                    <span className="font-mono text-lg font-black text-muted-foreground">--:--</span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {elapsedMin !== null ? `${elapsedMin}/${estMin} Min` : `${estMin} Min`}
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                {colorStatus !== 'fertig' && (
                  <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000', cfg.badge)}
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                  </div>
                )}

                {colorStatus === 'fertig' && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">Fertig · Warte auf Abholung</span>
                  </div>
                )}

                {/* Artikel-Preview */}
                {order.items && order.items.length > 0 && (
                  <p className="text-[9px] text-muted-foreground truncate">
                    {order.items.slice(0, 3).map((i) => i.name).filter(Boolean).join(', ')}
                    {order.items.length > 3 ? ` +${order.items.length - 3}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      {offen && (
        <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t bg-muted/10">
          {Object.entries(COLOR_CONFIG).filter(([k]) => k !== 'fertig').map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', cfg.badge)} />
              <span className="text-[9px] text-muted-foreground">{cfg.label}</span>
              {key === 'gut' && <span className="text-[9px] text-muted-foreground">&gt;10 Min</span>}
              {key === 'bald' && <span className="text-[9px] text-muted-foreground">5–10 Min</span>}
              {key === 'kritisch' && <span className="text-[9px] text-muted-foreground">2–5 Min</span>}
              {key === 'ueberfaellig' && <span className="text-[9px] text-muted-foreground">&lt;2 Min / Überfällig</span>}
            </div>
          ))}
          <span className="ml-auto text-[9px] text-muted-foreground">Live · Sekundentakt</span>
        </div>
      )}
    </div>
  );
}
