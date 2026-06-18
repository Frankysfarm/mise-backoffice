'use client';

/**
 * KitchenHandoffReadyMatrix — Matching-Panel: fertige Bestellungen × verfügbare Fahrer
 *
 * Zeigt auf einen Blick:
 * - Linke Spalte: Fertige Lieferbestellungen (sortiert nach Wartezeit)
 * - Rechte Spalte: Freie Fahrer (online, kein aktiver Batch)
 * - Zentrale Metrik: "X fertig, Y Fahrer frei" → Ampel-Farbgebung
 *
 * Erscheint nur wenn ≥1 fertige Lieferbestellung ODER ≥1 freier Fahrer vorhanden.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Zap, AlertTriangle } from 'lucide-react';

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  fertig_am: string | null;
  gesamtbetrag: number;
};

type FreeDriver = {
  id: string;
  name: string;
  fahrzeug: string | null;
};

interface Props {
  orders: {
    id: string;
    bestellnummer: string;
    status: string;
    typ: string;
    kunde_name: string;
    fertig_am: string | null;
    gesamtbetrag: number;
  }[];
  drivers: {
    id: string;
    vorname: string;
    nachname: string;
    status: { ist_online: boolean; aktueller_batch_id: string | null; fahrzeug: string | null } | null;
  }[];
}

function waitMin(fertigAm: string | null): number {
  if (!fertigAm) return 0;
  return Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
}

function fmtWait(min: number): string {
  if (min <= 0) return 'gerade eben';
  if (min === 1) return '1 Min';
  return `${min} Min`;
}

type AmpelStatus = 'ok' | 'warn' | 'critical';

function ampelStatus(readyCount: number, freeCount: number): AmpelStatus {
  if (readyCount === 0) return 'ok';
  if (freeCount > 0) return readyCount > freeCount ? 'warn' : 'ok';
  return 'critical';
}

export function KitchenHandoffReadyMatrix({ orders, drivers }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const readyDeliveries: ReadyOrder[] = orders
    .filter((o) => o.status === 'fertig' && o.typ === 'lieferung')
    .sort((a, b) => {
      const wa = waitMin(a.fertig_am);
      const wb = waitMin(b.fertig_am);
      return wb - wa;
    });

  const freeDrivers: FreeDriver[] = drivers
    .filter((d) => d.status?.ist_online && !d.status?.aktueller_batch_id)
    .map((d) => ({
      id: d.id,
      name: `${d.vorname} ${d.nachname.charAt(0)}.`,
      fahrzeug: d.status?.fahrzeug ?? null,
    }));

  if (readyDeliveries.length === 0 && freeDrivers.length === 0) return null;

  const ampel = ampelStatus(readyDeliveries.length, freeDrivers.length);

  const headerStyles: Record<AmpelStatus, string> = {
    ok:       'border-matcha-300 bg-matcha-50 text-matcha-800',
    warn:     'border-amber-300 bg-amber-50 text-amber-900',
    critical: 'border-red-300 bg-red-50 text-red-900 animate-pulse',
  };

  const dotStyles: Record<AmpelStatus, string> = {
    ok:       'bg-matcha-500',
    warn:     'bg-amber-500',
    critical: 'bg-red-500',
  };

  const AmpelIcon = ampel === 'critical' ? AlertTriangle : ampel === 'warn' ? Clock : CheckCircle2;
  const ampelLabel =
    ampel === 'critical'
      ? `${readyDeliveries.length} warten · Kein Fahrer frei!`
      : ampel === 'warn'
      ? `${readyDeliveries.length} fertig · ${freeDrivers.length} Fahrer frei`
      : readyDeliveries.length > 0
      ? `${readyDeliveries.length} fertig · ${freeDrivers.length} Fahrer verfügbar`
      : `${freeDrivers.length} Fahrer bereit`;

  return (
    <div className={cn('rounded-xl border overflow-hidden', headerStyles[ampel])}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-current/20">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotStyles[ampel])} />
        <AmpelIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="text-[11px] font-black uppercase tracking-wider">Handoff-Status</span>
        <span className="ml-auto text-[11px] font-bold opacity-80">{ampelLabel}</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-current/20">
        {/* Fertige Bestellungen */}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="h-3 w-3 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Fertig ({readyDeliveries.length})
            </span>
          </div>
          {readyDeliveries.length === 0 && (
            <div className="text-[11px] opacity-50 text-center py-2">Keine fertigen Lieferungen</div>
          )}
          {readyDeliveries.slice(0, 4).map((o) => {
            const wait = waitMin(o.fertig_am);
            const urgent = wait >= 8;
            return (
              <div
                key={o.id}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px]',
                  urgent ? 'bg-red-100 border border-red-200' : 'bg-white/60',
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-black tabular-nums shrink-0">#{o.bestellnummer.slice(-4)}</span>
                  <span className="truncate opacity-70">{o.kunde_name}</span>
                </div>
                <div className={cn('shrink-0 font-bold tabular-nums ml-2', urgent && 'text-red-600')}>
                  {fmtWait(wait)}
                </div>
              </div>
            );
          })}
          {readyDeliveries.length > 4 && (
            <div className="text-[10px] opacity-50 text-center">+{readyDeliveries.length - 4} weitere</div>
          )}
        </div>

        {/* Freie Fahrer */}
        <div className="p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Bike className="h-3 w-3 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Fahrer frei ({freeDrivers.length})
            </span>
          </div>
          {freeDrivers.length === 0 && (
            <div className="text-[11px] opacity-50 text-center py-2">
              {ampel === 'critical' ? '⚠ Alle Fahrer unterwegs' : 'Kein Fahrer online'}
            </div>
          )}
          {freeDrivers.slice(0, 4).map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-1.5 rounded-lg bg-white/60 px-2.5 py-1.5 text-[11px]"
            >
              <span className="h-5 w-5 rounded-full bg-current/20 flex items-center justify-center text-[9px] font-black shrink-0">
                {d.name.charAt(0)}
              </span>
              <span className="font-bold truncate">{d.name}</span>
              {d.fahrzeug && (
                <span className="ml-auto shrink-0 text-[10px] opacity-60">
                  {d.fahrzeug === 'fahrrad' ? '🚲' : d.fahrzeug === 'auto' ? '🚗' : '🛵'}
                </span>
              )}
            </div>
          ))}
          {freeDrivers.length > 4 && (
            <div className="text-[10px] opacity-50 text-center">+{freeDrivers.length - 4} weitere</div>
          )}
        </div>
      </div>

      {/* Empfehlung */}
      {ampel !== 'ok' && readyDeliveries.length > 0 && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 border-t border-current/20 text-[10px] font-bold',
        )}>
          <Zap className="h-3 w-3 shrink-0" />
          {ampel === 'critical'
            ? 'Fahrer anrufen oder manuell disponieren!'
            : `${Math.min(readyDeliveries.length, freeDrivers.length)} Tour${Math.min(readyDeliveries.length, freeDrivers.length) > 1 ? 'en' : ''} jetzt starten`}
        </div>
      )}
    </div>
  );
}
