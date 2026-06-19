'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Phone, MessageSquare, Clock, Package, ChevronDown, ChevronUp,
  CheckCircle2, Navigation2, AlertCircle, User,
} from 'lucide-react';

export interface TourStop {
  id: string;
  stopNumber: number;
  customerName: string;
  address: string;
  phone?: string;
  notes?: string;
  itemCount: number;
  estimatedArrivalMin?: number;
  status: 'pending' | 'arrived' | 'delivered' | 'failed';
  cashOnDelivery?: number;
  distanceKm?: number;
}

interface Props {
  stop: TourStop;
  isActive: boolean;
  onNavigate?: (stop: TourStop) => void;
  onCall?: (phone: string) => void;
  onMarkDelivered?: (stopId: string) => void;
  onMarkFailed?: (stopId: string) => void;
  className?: string;
}

const STATUS_CONFIG = {
  pending:   { label: 'Ausstehend', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  arrived:   { label: 'Angekommen', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
  delivered: { label: 'Geliefert',  color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-200'  },
  failed:    { label: 'Fehlgeschl.', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200'     },
} as const;

export function TourStopDetailCard({ stop, isActive, onNavigate, onCall, onMarkDelivered, onMarkFailed, className }: Props) {
  const [expanded, setExpanded] = useState(isActive);
  const cfg = STATUS_CONFIG[stop.status];

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-300',
      isActive ? 'border-matcha-400 shadow-lg shadow-matcha-100' : 'border-border',
      cfg.bg,
      className,
    )}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Stop number badge */}
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black',
          isActive ? 'bg-matcha-600 text-white' : 'bg-white border-2 border-border text-muted-foreground',
        )}>
          {stop.stopNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-bold truncate', isActive ? 'text-matcha-900' : 'text-foreground')}>
              {stop.customerName}
            </span>
            {stop.status === 'delivered' && <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />}
            {stop.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{stop.address}</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          {stop.estimatedArrivalMin !== undefined && stop.status === 'pending' && (
            <div className={cn('flex items-center gap-1 text-[11px] font-bold tabular-nums', isActive ? 'text-matcha-700' : 'text-muted-foreground')}>
              <Clock className="h-3 w-3" />
              {stop.estimatedArrivalMin}min
            </div>
          )}
          <div className={cn('rounded-full px-2 py-0.5 text-[9px] font-black border', cfg.color, cfg.border, 'bg-white/80')}>
            {cfg.label}
          </div>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t bg-white/70 px-4 py-3 space-y-3">
          {/* Info row */}
          <div className="flex items-start gap-4 flex-wrap text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{stop.itemCount} Artikel</span>
            </div>
            {stop.distanceKm !== undefined && (
              <div className="flex items-center gap-1">
                <Navigation2 className="h-3.5 w-3.5" />
                <span>{stop.distanceKm.toFixed(1)} km</span>
              </div>
            )}
            {stop.cashOnDelivery !== undefined && stop.cashOnDelivery > 0 && (
              <div className="flex items-center gap-1 font-bold text-amber-700">
                <span>Bar: {stop.cashOnDelivery.toFixed(2)} €</span>
              </div>
            )}
          </div>

          {stop.notes && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
              <span className="font-bold">Notiz: </span>{stop.notes}
            </div>
          )}

          {/* Action buttons */}
          {stop.status !== 'delivered' && stop.status !== 'failed' && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onNavigate && (
                <button
                  onClick={() => onNavigate(stop)}
                  className="flex items-center gap-1.5 rounded-xl bg-matcha-600 text-white px-3 py-2 text-[11px] font-bold hover:bg-matcha-700 active:scale-95 transition"
                >
                  <Navigation2 className="h-3.5 w-3.5" />
                  Navigation
                </button>
              )}
              {stop.phone && onCall && (
                <button
                  onClick={() => onCall(stop.phone!)}
                  className="flex items-center gap-1.5 rounded-xl bg-white border border-border px-3 py-2 text-[11px] font-bold hover:bg-muted/50 active:scale-95 transition"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-600" />
                  Anrufen
                </button>
              )}
              {onMarkDelivered && stop.status === 'arrived' && (
                <button
                  onClick={() => onMarkDelivered(stop.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-matcha-50 border border-matcha-300 text-matcha-700 px-3 py-2 text-[11px] font-bold hover:bg-matcha-100 active:scale-95 transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Abgeliefert
                </button>
              )}
              {onMarkFailed && (
                <button
                  onClick={() => onMarkFailed(stop.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-[11px] font-bold hover:bg-red-100 active:scale-95 transition"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Fehlversuch
                </button>
              )}
            </div>
          )}

          {stop.status === 'delivered' && (
            <div className="flex items-center gap-2 text-matcha-700 text-[11px] font-semibold pt-1">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" />
              Erfolgreich geliefert
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel: Liste aller Tour-Stops ─────────────────────────────────────────────

interface PanelProps {
  stops: TourStop[];
  activeStopId?: string;
  onNavigate?: (stop: TourStop) => void;
  onCall?: (phone: string) => void;
  onMarkDelivered?: (stopId: string) => void;
  onMarkFailed?: (stopId: string) => void;
  className?: string;
}

export function TourStopsDetailPanel({ stops, activeStopId, onNavigate, onCall, onMarkDelivered, onMarkFailed, className }: PanelProps) {
  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const total = stops.length;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="rounded-xl bg-white border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-foreground">Tour-Fortschritt</span>
          <span className="text-xs font-black text-matcha-700 tabular-nums">{delivered}/{total}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>{pct}% abgeschlossen</span>
          <span>{total - delivered} verbleibend</span>
        </div>
      </div>

      {/* Individual stops */}
      {stops.map((stop) => (
        <TourStopDetailCard
          key={stop.id}
          stop={stop}
          isActive={stop.id === activeStopId}
          onNavigate={onNavigate}
          onCall={onCall}
          onMarkDelivered={onMarkDelivered}
          onMarkFailed={onMarkFailed}
        />
      ))}

      {stops.length === 0 && (
        <div className="rounded-2xl border bg-white flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
          <User className="h-4 w-4" />
          Keine Stops in dieser Tour
        </div>
      )}
    </div>
  );
}
