'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, Phone, CheckCircle2, Package, Clock,
  ChevronRight, Truck, Star, AlertTriangle,
} from 'lucide-react';

type TourStop = {
  id: string;
  sequence: number;
  status: 'pending' | 'current' | 'completed';
  address: string;
  customerName: string;
  customerPhone: string | null;
  orderValue: number;
  paymentMethod: string;
  notes: string | null;
  etaMin: number | null;
};

type Props = {
  stops: TourStop[];
  tourStartedAt: string | null;
  totalStops: number;
  onNavigate?: (address: string) => void;
  onCall?: (phone: string) => void;
  onConfirmDelivery?: (stopId: string) => void;
};

function formatEta(etaMin: number | null): string {
  if (etaMin === null) return '–';
  if (etaMin < 1) return '< 1 Min';
  return `~${etaMin} Min`;
}

export function TourLiveSchrittCockpit({
  stops,
  tourStartedAt,
  totalStops,
  onNavigate,
  onCall,
  onConfirmDelivery,
}: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const currentStop = stops.find((s) => s.status === 'current') ?? stops.find((s) => s.status === 'pending') ?? null;
  const completedCount = stops.filter((s) => s.status === 'completed').length;
  const remainingCount = stops.filter((s) => s.status !== 'completed').length;

  if (stops.length === 0 || !currentStop) return null;

  const progressPct = totalStops > 0 ? Math.round((completedCount / totalStops) * 100) : 0;

  const elapsedMin = tourStartedAt
    ? Math.floor((Date.now() - new Date(tourStartedAt).getTime()) / 60_000)
    : null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Tour Progress Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-matcha-900 to-matcha-700 text-white">
        <Truck className="h-4 w-4 shrink-0 text-matcha-200" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-matcha-100">
              Tour läuft
            </span>
            {elapsedMin !== null && (
              <span className="text-[9px] font-bold text-matcha-300 tabular-nums">
                {elapsedMin} Min unterwegs
              </span>
            )}
          </div>
          {/* Progress Bar */}
          <div className="mt-1.5 h-1.5 rounded-full bg-matcha-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-300 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-black tabular-nums text-white">
            {completedCount}/{totalStops}
          </div>
          <div className="text-[9px] text-matcha-300">Stopps</div>
        </div>
      </div>

      {/* Current Stop — Hauptkarte */}
      <div className="p-4 space-y-3">
        {/* Stop Number + Address */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-matcha-600 text-white font-display text-sm font-black">
            {currentStop.sequence}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Aktueller Stopp
            </div>
            <div className="text-base font-bold text-foreground leading-tight truncate">
              {currentStop.customerName}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{currentStop.address}</span>
            </div>
          </div>
          {currentStop.etaMin !== null && (
            <div className="shrink-0 text-right">
              <div className={cn(
                'font-mono text-sm font-black tabular-nums',
                currentStop.etaMin <= 2 ? 'text-matcha-600' : currentStop.etaMin <= 6 ? 'text-amber-600' : 'text-foreground',
              )}>
                {formatEta(currentStop.etaMin)}
              </div>
              <div className="text-[9px] text-muted-foreground">ETA</div>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            {currentStop.orderValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
          <span className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[9px] font-black',
            currentStop.paymentMethod === 'bar'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-matcha-100 text-matcha-800',
          )}>
            {currentStop.paymentMethod === 'bar' ? '💵 Bar' : '💳 Karte'}
          </span>
        </div>

        {/* Notiz */}
        {currentStop.notes && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-800 leading-snug">{currentStop.notes}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Navigate */}
          <button
            onClick={() => onNavigate?.(currentStop.address)}
            className="flex items-center justify-center gap-2 rounded-xl bg-matcha-600 py-3 text-sm font-bold text-white active:scale-95 transition-transform"
          >
            <Navigation className="h-4 w-4" />
            Navigieren
          </button>

          {/* Call or Confirm */}
          {currentStop.customerPhone ? (
            <button
              onClick={() => onCall?.(currentStop.customerPhone!)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold text-foreground active:scale-95 transition-transform"
            >
              <Phone className="h-4 w-4" />
              Anrufen
            </button>
          ) : (
            <button
              onClick={() => onConfirmDelivery?.(currentStop.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-matcha-100 border border-matcha-300 py-3 text-sm font-bold text-matcha-800 active:scale-95 transition-transform"
            >
              <CheckCircle2 className="h-4 w-4" />
              Bestätigen
            </button>
          )}
        </div>

        {/* Confirm Delivery — Big Button when phone present */}
        {currentStop.customerPhone && (
          <button
            onClick={() => onConfirmDelivery?.(currentStop.id)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 py-4 text-base font-black text-white active:scale-95 transition-transform"
          >
            <CheckCircle2 className="h-5 w-5" />
            Lieferung bestätigen
          </button>
        )}
      </div>

      {/* Nächste Stopps — Vorschau */}
      {stops.filter((s) => s.status === 'pending' && s.id !== currentStop.id).length > 0 && (
        <div className="border-t bg-muted/20">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Nächste Stopps
          </div>
          <div className="divide-y divide-border/50">
            {stops
              .filter((s) => s.status === 'pending' && s.id !== currentStop.id)
              .slice(0, 3)
              .map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-6 w-6 shrink-0 rounded-lg border border-border bg-card flex items-center justify-center font-mono text-xs font-bold text-muted-foreground">
                    {s.sequence}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{s.customerName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.address}</div>
                  </div>
                  {s.etaMin !== null && (
                    <div className="shrink-0 text-[10px] font-bold text-muted-foreground tabular-nums">
                      {formatEta(s.etaMin)}
                    </div>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Fertig-Stopps Footer */}
      {completedCount > 0 && (
        <div className="border-t px-4 py-2 flex items-center gap-2 bg-matcha-50/50">
          <CheckCircle2 className="h-3 w-3 text-matcha-600" />
          <span className="text-[10px] font-bold text-matcha-700">
            {completedCount} Stopp{completedCount !== 1 ? 's' : ''} abgeschlossen ·{' '}
            {remainingCount} verbleibend
          </span>
        </div>
      )}
    </div>
  );
}
