'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, CheckCircle2, Clock, Phone, Package, ChevronRight, Zap, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TourStop {
  id: string;
  sequence: number;
  address: string;
  customerName: string;
  phone?: string | null;
  notes?: string | null;
  status: 'pending' | 'arrived' | 'delivered' | 'skipped';
  etaMin?: number | null;
  distanceKm?: number | null;
  orderAmount?: number | null;
}

interface Props {
  stops?: TourStop[];
  currentStopIdx?: number;
  driverName?: string;
  onNavigate?: (stop: TourStop) => void;
  onMarkDelivered?: (stopId: string) => void;
}

const NAV_APPS = [
  { id: 'google', label: 'Google Maps', icon: '🗺️', urlFn: (addr: string) => `https://maps.google.com/?q=${encodeURIComponent(addr)}` },
  { id: 'waze', label: 'Waze', icon: '🚗', urlFn: (addr: string) => `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes` },
  { id: 'apple', label: 'Apple Maps', icon: '🍎', urlFn: (addr: string) => `https://maps.apple.com/?q=${encodeURIComponent(addr)}` },
];

// Mock stops when no real data available
const MOCK_STOPS: TourStop[] = [
  { id: '1', sequence: 1, address: 'Hauptstraße 12, 10115 Berlin', customerName: 'Max M.', phone: '+49 170 1234567', status: 'delivered', etaMin: 0, distanceKm: 1.2, orderAmount: 28.50, notes: 'Bitte klingeln' },
  { id: '2', sequence: 2, address: 'Friedrichstr. 45, 10117 Berlin', customerName: 'Anna K.', phone: '+49 160 7654321', status: 'arrived', etaMin: 2, distanceKm: 0.8, orderAmount: 15.90 },
  { id: '3', sequence: 3, address: 'Unter den Linden 5, 10117 Berlin', customerName: 'Peter S.', phone: '+49 155 9876543', status: 'pending', etaMin: 8, distanceKm: 2.1, orderAmount: 42.00, notes: 'Hinterhof, 2. Aufgang' },
  { id: '4', sequence: 4, address: 'Potsdamer Str. 22, 10785 Berlin', customerName: 'Lisa B.', status: 'pending', etaMin: 18, distanceKm: 4.3, orderAmount: 19.80 },
];

function StatusBadge({ status }: { status: TourStop['status'] }) {
  switch (status) {
    case 'delivered': return <span className="rounded-full bg-matcha-500 text-white px-2 py-0.5 text-[9px] font-black">✓ Geliefert</span>;
    case 'arrived':   return <span className="rounded-full bg-blue-500 text-white px-2 py-0.5 text-[9px] font-black animate-pulse">📍 Angekommen</span>;
    case 'pending':   return <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[9px] font-bold">Ausstehend</span>;
    case 'skipped':   return <span className="rounded-full bg-gray-400 text-white px-2 py-0.5 text-[9px] font-bold">Übersprungen</span>;
  }
}

export function FahrerPhase1450TourStoppNavigationsFinal({ stops: propStops, currentStopIdx = 0, driverName, onNavigate, onMarkDelivered }: Props) {
  const [selectedNav, setSelectedNav] = useState<string>('google');
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const stops = propStops && propStops.length > 0 ? propStops : MOCK_STOPS;

  const currentStop = stops.find(s => s.status === 'arrived') ?? stops.find(s => s.status === 'pending');
  const deliveredCount = stops.filter(s => s.status === 'delivered').length;
  const totalStops = stops.length;
  const progressPct = totalStops > 0 ? Math.round((deliveredCount / totalStops) * 100) : 0;
  const remainingStops = stops.filter(s => s.status === 'pending' || s.status === 'arrived');
  const totalRemainingEta = remainingStops.reduce((sum, s) => sum + (s.etaMin ?? 5), 0);

  return (
    <Card className="overflow-hidden border-matcha-200">
      {/* Header */}
      <div className="px-4 py-3 bg-matcha-900 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Navigation className="h-4 w-4 text-matcha-300 shrink-0" />
          <span className="font-display text-sm font-black uppercase tracking-wider flex-1">
            Tour-Stops · Navigation
          </span>
          <span className="text-[10px] text-matcha-400 tabular-nums">
            {deliveredCount}/{totalStops} Stopps
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-matcha-800 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-matcha-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-matcha-400">
          <span>{progressPct}% abgeschlossen</span>
          {totalRemainingEta > 0 && <span>· ~{totalRemainingEta} Min restlich</span>}
          {driverName && <span>· {driverName}</span>}
        </div>
      </div>

      {/* Nav App Selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/20">
        <span className="text-[10px] font-bold text-muted-foreground mr-1">Navi:</span>
        {NAV_APPS.map(app => (
          <button
            key={app.id}
            onClick={() => setSelectedNav(app.id)}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition',
              selectedNav === app.id ? 'bg-matcha-600 text-white border-matcha-600' : 'bg-background border-border text-muted-foreground hover:bg-muted',
            )}
          >
            <span>{app.icon}</span>
            <span>{app.label}</span>
          </button>
        ))}
      </div>

      {/* Current Stop Highlight */}
      {currentStop && (
        <div className={cn(
          'mx-3 mt-3 rounded-xl border-2 p-3',
          currentStop.status === 'arrived' ? 'border-blue-400 bg-blue-50' : 'border-matcha-400 bg-matcha-50',
        )}>
          <div className="flex items-center gap-2 mb-1">
            <Zap className={cn('h-4 w-4 shrink-0', currentStop.status === 'arrived' ? 'text-blue-600' : 'text-matcha-600')} />
            <span className="text-xs font-black uppercase tracking-wide">
              {currentStop.status === 'arrived' ? 'Aktueller Stop' : 'Nächster Stop'}
            </span>
            <span className="ml-auto text-[10px] font-bold text-matcha-600">Stopp {currentStop.sequence}</span>
          </div>
          <div className="font-bold text-sm mb-0.5">{currentStop.customerName}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{currentStop.address}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {currentStop.etaMin !== null && currentStop.etaMin !== undefined && currentStop.etaMin > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-matcha-700">
                <Clock className="h-3 w-3" /> ~{currentStop.etaMin} Min
              </span>
            )}
            {currentStop.distanceKm && (
              <span className="text-[10px] text-muted-foreground">📍 {currentStop.distanceKm.toFixed(1)} km</span>
            )}
            {currentStop.orderAmount && (
              <span className="text-[10px] font-bold text-foreground">€{currentStop.orderAmount.toFixed(2)}</span>
            )}
          </div>
          {currentStop.notes && (
            <div className="mt-1.5 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
              ⚠️ {currentStop.notes}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <a
              href={NAV_APPS.find(a => a.id === selectedNav)?.urlFn(currentStop.address) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 text-white py-2 text-xs font-bold hover:bg-matcha-700 transition"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigieren
            </a>
            {currentStop.phone && (
              <a
                href={`tel:${currentStop.phone}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-matcha-300 bg-matcha-50 text-matcha-700 py-2 px-3 text-xs font-bold hover:bg-matcha-100 transition"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* All Stops List */}
      <div className="px-3 pb-3 mt-3 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Alle Stops</div>
        {stops.map(stop => {
          const isExpanded = expandedStop === stop.id;
          const isCurrent = stop.id === currentStop?.id;
          return (
            <div
              key={stop.id}
              className={cn(
                'rounded-xl border transition',
                stop.status === 'delivered' ? 'bg-muted/30 border-border opacity-70' :
                isCurrent ? 'bg-matcha-50 border-matcha-300' : 'bg-background border-border',
              )}
            >
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2.5"
                onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
              >
                {/* Sequence indicator */}
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  stop.status === 'delivered' ? 'bg-matcha-500 text-white' :
                  stop.status === 'arrived' ? 'bg-blue-500 text-white animate-pulse' :
                  'bg-muted text-muted-foreground',
                )}>
                  {stop.status === 'delivered' ? '✓' : stop.sequence}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-bold text-xs', stop.status === 'delivered' ? 'line-through text-muted-foreground' : '')}>
                      {stop.customerName}
                    </span>
                    <StatusBadge status={stop.status} />
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{stop.address}</div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {stop.etaMin !== null && stop.etaMin !== undefined && stop.status === 'pending' && (
                    <span className="text-[10px] font-bold text-matcha-600 tabular-nums">~{stop.etaMin}m</span>
                  )}
                  <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                </div>
              </button>

              {isExpanded && stop.status !== 'delivered' && (
                <div className="px-3 pb-3 space-y-2 border-t border-dashed">
                  {stop.notes && (
                    <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200 mt-2">
                      ⚠️ {stop.notes}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={NAV_APPS.find(a => a.id === selectedNav)?.urlFn(stop.address) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-matcha-600 text-white py-1.5 text-[11px] font-bold"
                    >
                      <Navigation className="h-3 w-3" /> Navigieren
                    </a>
                    {stop.phone && (
                      <a href={`tel:${stop.phone}`} className="flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 px-3 text-[11px] font-bold">
                        <Phone className="h-3 w-3" /> Anrufen
                      </a>
                    )}
                    {onMarkDelivered && (
                      <button
                        onClick={() => onMarkDelivered(stop.id)}
                        className="flex items-center justify-center gap-1 rounded-lg bg-blue-500 text-white py-1.5 px-3 text-[11px] font-bold"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Geliefert
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
