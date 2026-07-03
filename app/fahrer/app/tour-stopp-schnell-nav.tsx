'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation, Phone, CheckCircle2, Clock, Package,
  ChevronRight, AlertCircle, Bike,
} from 'lucide-react';

export interface TourStop {
  id: string;
  position: number;
  adresse: string;
  plz?: string | null;
  bestellnummer: string;
  kunde_name: string;
  kunde_telefon?: string | null;
  gesamtbetrag?: number;
  zahlungsart?: string;
  geliefert_am?: string | null;
  eta_min?: number | null;
  notiz?: string | null;
}

interface Props {
  stops: TourStop[];
  currentStopId?: string | null;
  onNavigate?: (stop: TourStop) => void;
  onConfirmDelivery?: (stopId: string) => void;
  onCallCustomer?: (phone: string) => void;
}

function formatEta(min: number | null | undefined): string {
  if (min === null || min === undefined) return '--';
  if (min < 1) return '< 1 Min';
  return `~${Math.round(min)} Min`;
}

export function TourStoppSchnellNav({
  stops,
  currentStopId,
  onNavigate,
  onConfirmDelivery,
  onCallCustomer,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.position - b.position),
    [stops],
  );

  const done = sorted.filter(s => s.geliefert_am);
  const pending = sorted.filter(s => !s.geliefert_am);
  const currentStop = pending[0] ?? null;

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-600 text-white">
        <Bike size={16} className="shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">
          Tour-Stopps · {done.length}/{sorted.length} erledigt
        </span>
        <div className="ml-auto flex items-center gap-1">
          {pending.length > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold">
              {pending.length} offen
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-matcha-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${sorted.length > 0 ? (done.length / sorted.length) * 100 : 0}%` }}
        />
      </div>

      {/* Stop list */}
      <div className="divide-y">
        {sorted.map((stop, idx) => {
          const isDone = !!stop.geliefert_am;
          const isCurrent = !isDone && stop.id === (currentStopId ?? currentStop?.id);
          const isExpanded = expandedId === stop.id;

          return (
            <div
              key={stop.id}
              className={cn(
                'transition-colors',
                isDone ? 'bg-muted/20 opacity-60' : isCurrent ? 'bg-matcha-50' : 'bg-card',
              )}
            >
              {/* Main row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedId(isExpanded ? null : stop.id)}
              >
                {/* Position badge */}
                <div className={cn(
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                  isDone ? 'bg-matcha-500 text-white' : isCurrent ? 'bg-matcha-600 text-white' : 'bg-muted text-muted-foreground',
                )}>
                  {isDone ? <CheckCircle2 size={14} /> : idx + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold truncate">{stop.kunde_name}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-matcha-600 text-white px-1.5 py-0.5 text-[8px] font-bold">
                        JETZT
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {stop.adresse}{stop.plz ? `, ${stop.plz}` : ''}
                  </div>
                </div>

                {/* ETA / Status */}
                <div className="shrink-0 text-right">
                  {isDone ? (
                    <CheckCircle2 size={18} className="text-matcha-500 ml-auto" />
                  ) : stop.eta_min !== undefined && stop.eta_min !== null ? (
                    <>
                      <div className="text-[11px] font-bold tabular-nums text-matcha-700">
                        {formatEta(stop.eta_min)}
                      </div>
                      <div className="text-[8px] text-muted-foreground">ETA</div>
                    </>
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded actions */}
              {isExpanded && !isDone && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                  {/* Bestelldetail */}
                  <div className="rounded-lg bg-white border border-border px-3 py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Bestellung</span>
                      <span className="font-mono font-bold">#{stop.bestellnummer}</span>
                    </div>
                    {stop.zahlungsart && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Zahlung</span>
                        <span className="font-bold capitalize">{stop.zahlungsart}</span>
                      </div>
                    )}
                    {stop.gesamtbetrag !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Betrag</span>
                        <span className="font-bold">{(stop.gesamtbetrag / 100).toFixed(2).replace('.', ',')} €</span>
                      </div>
                    )}
                    {stop.notiz && (
                      <div className="flex items-start gap-1 text-amber-700">
                        <AlertCircle size={11} className="mt-0.5 shrink-0" />
                        <span>{stop.notiz}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onNavigate?.(stop)}
                      className="flex flex-col items-center gap-1 rounded-lg bg-matcha-600 text-white py-2 text-[10px] font-bold active:opacity-80"
                    >
                      <Navigation size={16} />
                      Navigieren
                    </button>
                    {stop.kunde_telefon && (
                      <button
                        onClick={() => onCallCustomer?.(stop.kunde_telefon!)}
                        className="flex flex-col items-center gap-1 rounded-lg bg-blue-600 text-white py-2 text-[10px] font-bold active:opacity-80"
                      >
                        <Phone size={16} />
                        Anrufen
                      </button>
                    )}
                    <button
                      onClick={() => onConfirmDelivery?.(stop.id)}
                      className="flex flex-col items-center gap-1 rounded-lg bg-emerald-600 text-white py-2 text-[10px] font-bold active:opacity-80"
                    >
                      <CheckCircle2 size={16} />
                      Geliefert
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      {pending.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          <Clock size={12} className="shrink-0" />
          <span>
            {pending.length} Stopp{pending.length !== 1 ? 's' : ''} ausstehend
            {currentStop?.eta_min !== undefined && currentStop?.eta_min !== null
              ? ` · Nächster in ${formatEta(currentStop.eta_min)}`
              : ''}
          </span>
          <Package size={12} className="ml-auto shrink-0" />
        </div>
      )}
    </div>
  );
}
