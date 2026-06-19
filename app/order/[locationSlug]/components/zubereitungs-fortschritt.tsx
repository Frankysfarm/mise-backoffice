'use client';

/**
 * ZubereitungsFortschritt — Phase 255
 *
 * Küchenfortschritts-Timeline in der Bestellungs-Erfolgsseite.
 * Zeigt Zubereitung + Fahrt als zweigeteilten animierten Fortschrittsbalken
 * mit Zeitstempeln. Sichtbar wenn Bestellung in_zubereitung, fertig oder unterwegs.
 *
 * Props:
 *   prepMin   — Geschätzte Zubereitungszeit in Minuten
 *   driveMin  — Geschätzte Fahrzeit in Minuten
 *   status    — Bestellungsstatus
 *   orderedAt — ISO-Timestamp der Bestellung
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Truck, CheckCircle2 } from 'lucide-react';

interface Props {
  prepMin: number;
  driveMin: number;
  status: string;
  orderedAt?: string | null;
}

const STATUSES_VISIBLE = ['in_zubereitung', 'preparing', 'fertig', 'ready', 'unterwegs', 'out_for_delivery'];

function fmtTime(isoOrMs: string | number | null): string {
  if (!isoOrMs) return '–';
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function ZubereitungsFortschritt({ prepMin, driveMin, status, orderedAt }: Props) {
  const [nowMs, setNowMs] = React.useState(Date.now());

  React.useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  if (!STATUSES_VISIBLE.includes(status)) return null;

  const totalMin = prepMin + driveMin;
  const startMs = orderedAt ? new Date(orderedAt).getTime() : nowMs - 60_000;
  const elapsedMin = Math.max(0, (nowMs - startMs) / 60_000);

  const prepRatio   = prepMin / totalMin;
  const driveRatio  = driveMin / totalMin;

  // How far through each phase
  const prepProgress = Math.min(1, elapsedMin / prepMin);
  const driveProgress = status === 'unterwegs' || status === 'out_for_delivery'
    ? Math.min(1, Math.max(0, (elapsedMin - prepMin) / driveMin))
    : 0;

  const prepDoneAt  = fmtTime(startMs + prepMin * 60_000);
  const driveDoneAt = fmtTime(startMs + totalMin * 60_000);

  const isPrep  = status === 'in_zubereitung' || status === 'preparing';
  const isReady = status === 'fertig' || status === 'ready';
  const isDrive = status === 'unterwegs' || status === 'out_for_delivery';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
        Lieferzeit-Aufschlüsselung
      </div>

      {/* Stacked progress bar */}
      <div className="rounded-full overflow-hidden flex h-3 bg-muted">
        {/* Prep segment */}
        <div
          className="relative overflow-hidden"
          style={{ width: `${prepRatio * 100}%` }}
          title={`Zubereitung: ${prepMin} Min`}
        >
          <div className="absolute inset-0 bg-amber-200" />
          <div
            className={cn('absolute inset-y-0 left-0 bg-amber-500 transition-all duration-1000', isPrep && 'animate-pulse')}
            style={{ width: `${prepProgress * 100}%` }}
          />
        </div>
        {/* Drive segment */}
        <div
          className="relative overflow-hidden flex-1"
          title={`Fahrt: ${driveMin} Min`}
        >
          <div className="absolute inset-0 bg-blue-200" />
          <div
            className={cn('absolute inset-y-0 left-0 bg-blue-500 transition-all duration-1000', isDrive && 'animate-pulse')}
            style={{ width: `${driveProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Phase labels */}
      <div className="flex items-start gap-2 text-xs">
        {/* Prep phase */}
        <div className={cn(
          'flex-1 rounded-lg p-2 transition-colors',
          isPrep  ? 'bg-amber-50 border border-amber-200' : 'opacity-60',
          isReady || isDrive ? 'bg-green-50 border border-green-200 opacity-100' : '',
        )}>
          <div className="flex items-center gap-1.5 mb-1">
            {isReady || isDrive
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              : <ChefHat className={cn('h-3.5 w-3.5 shrink-0', isPrep ? 'text-amber-600' : 'text-muted-foreground')} />}
            <span className="font-bold">Küche</span>
          </div>
          <div className="text-muted-foreground">{prepMin} Min</div>
          <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">fertig ~{prepDoneAt}</div>
        </div>

        {/* Drive phase */}
        <div className={cn(
          'flex-1 rounded-lg p-2 transition-colors',
          isDrive ? 'bg-blue-50 border border-blue-200' : 'opacity-60',
        )}>
          <div className="flex items-center gap-1.5 mb-1">
            <Truck className={cn('h-3.5 w-3.5 shrink-0', isDrive ? 'text-blue-600' : 'text-muted-foreground')} />
            <span className="font-bold">Lieferung</span>
          </div>
          <div className="text-muted-foreground">{driveMin} Min</div>
          <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">an ~{driveDoneAt}</div>
        </div>
      </div>

      {/* Total */}
      <div className="text-[11px] text-center text-muted-foreground">
        Gesamtzeit ca. <strong className="text-foreground">{totalMin} Minuten</strong>
      </div>
    </div>
  );
}
