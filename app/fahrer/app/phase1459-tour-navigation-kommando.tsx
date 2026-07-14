'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Navigation2, MapPin, CheckCircle2, Clock, ChevronDown, ChevronUp, Phone } from 'lucide-react';

// Phase 1459 — Tour-Navigation-Kommando (Fahrer-App)
// Kompaktes Navigations-Kommando-Center: Alle Tour-Stops mit Echtzeit-Status,
// Direkt-Navigation und Schnell-Aktionen (Geliefert / Angerufen).

interface Stop {
  id: string;
  sequence: number;
  address: string;
  customerName: string;
  phone?: string | null;
  notes?: string | null;
  status: 'pending' | 'arrived' | 'delivered';
  etaMin?: number | null;
  distanceKm?: number | null;
  orderAmount?: number | null;
}

interface Props {
  stops?: Stop[] | null;
  driverName?: string;
  onMarkDelivered?: (stopId: string) => void;
}

function openMaps(address: string) {
  const q = encodeURIComponent(address);
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) {
    window.open(`maps://?q=${q}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }
}

export function FahrerPhase1459TourNavigationKommando({ stops, driverName, onMarkDelivered }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!stops?.length) return [];
    return [...stops].sort((a, b) => a.sequence - b.sequence);
  }, [stops]);

  const pending = sorted.filter(s => s.status !== 'delivered');
  const done = sorted.filter(s => s.status === 'delivered');

  if (!sorted.length) return null;

  const next = pending[0] ?? null;

  return (
    <div className="space-y-3">
      {/* Next-Stop-CTA */}
      {next && (
        <div className="bg-gradient-to-br from-blue-900/90 to-blue-800/90 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold uppercase tracking-wide">
              <Navigation2 className="h-3.5 w-3.5" />
              Nächster Stopp
            </div>
            <span className="text-blue-300 text-xs tabular-nums font-bold">
              #{next.sequence}/{sorted.length}
            </span>
          </div>

          <div>
            <div className="text-white font-bold text-base leading-tight">{next.customerName}</div>
            <div className="text-blue-300 text-sm mt-0.5">{next.address}</div>
            {next.notes && (
              <div className="text-blue-400 text-xs mt-1 italic">📝 {next.notes}</div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => openMaps(next.address)}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              <Navigation2 className="h-4 w-4" /> Navigieren
            </button>
            {next.phone && (
              <a
                href={`tel:${next.phone}`}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-blue-200 text-sm rounded-xl transition flex items-center gap-1.5"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* All Stops */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Alle Stops ({pending.length} offen, {done.length} erledigt)
        </div>
        {sorted.map(stop => {
          const isNext = stop.id === next?.id;
          const isDone = stop.status === 'delivered';
          const isExp = expanded === stop.id;
          return (
            <div key={stop.id}
              className={cn(
                'rounded-xl border transition-all',
                isDone ? 'bg-emerald-50/80 border-emerald-200/60' :
                  isNext ? 'bg-white border-blue-300 shadow-sm' :
                    'bg-white/60 border-slate-200',
              )}>
              <button
                onClick={() => setExpanded(isExp ? null : stop.id)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                  isDone ? 'bg-emerald-100 text-emerald-700' :
                    isNext ? 'bg-blue-500 text-white' :
                      'bg-slate-100 text-slate-500',
                )}>
                  {isDone ? '✓' : stop.sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-semibold truncate', isDone ? 'text-emerald-700 line-through' : 'text-foreground')}>
                    {stop.customerName}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{stop.address}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {stop.orderAmount !== null && stop.orderAmount !== undefined && (
                    <span className="text-[11px] font-bold text-foreground">{stop.orderAmount.toFixed(2)}€</span>
                  )}
                  {stop.etaMin && !isDone && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />{stop.etaMin}Min
                    </span>
                  )}
                  {isExp ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </button>

              {isExp && !isDone && (
                <div className="border-t px-3 py-2 flex gap-2">
                  <button
                    onClick={() => openMaps(stop.address)}
                    className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Maps
                  </button>
                  {stop.phone && (
                    <a
                      href={`tel:${stop.phone}`}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {onMarkDelivered && (
                    <button
                      onClick={() => { onMarkDelivered(stop.id); setExpanded(null); }}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Geliefert
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
