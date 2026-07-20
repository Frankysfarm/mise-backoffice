'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, Clock, CheckCircle2, Package, ChevronRight, Bike, AlertTriangle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  sequence: number;
  address: string;
  customer_name: string;
  customer_phone: string | null;
  order_items_count: number;
  order_total_eur: number;
  notes: string | null;
  status: 'pending' | 'arrived' | 'delivered' | 'skipped';
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
  is_cash: boolean;
}

interface ApiData {
  tour_id: string;
  stops: Stop[];
  stops_done: number;
  stops_total: number;
  tour_score: number;
  estimated_finish_min: number | null;
}

const MOCK: ApiData = {
  tour_id: 'tour-42',
  stops_done: 2,
  stops_total: 5,
  tour_score: 83,
  estimated_finish_min: 28,
  stops: [
    { id: 's1', sequence: 1, address: 'Hauptstr. 12, 80331 München', customer_name: 'Max Mustermann', customer_phone: '+49 89 1234567', order_items_count: 3, order_total_eur: 28.50, notes: null, status: 'delivered', eta_min: null, lat: 48.1351, lng: 11.5820, is_cash: false },
    { id: 's2', sequence: 2, address: 'Bahnhofstr. 5, 80335 München', customer_name: 'Sara Klein', customer_phone: '+49 89 7654321', order_items_count: 2, order_total_eur: 18.90, notes: 'Klingel defekt – bitte anrufen', status: 'delivered', eta_min: null, lat: 48.1400, lng: 11.5600, is_cash: true },
    { id: 's3', sequence: 3, address: 'Parkweg 8, 80336 München', customer_name: 'Tim Berger', customer_phone: '+49 89 2345678', order_items_count: 4, order_total_eur: 42.00, notes: null, status: 'arrived', eta_min: 2, lat: 48.1390, lng: 11.5650, is_cash: false },
    { id: 's4', sequence: 4, address: 'Lindenallee 3, 80337 München', customer_name: 'Julia Fischer', customer_phone: null, order_items_count: 1, order_total_eur: 12.50, notes: 'Stockwerk 2, Türcode 1234', status: 'pending', eta_min: 8, lat: 48.1380, lng: 11.5700, is_cash: false },
    { id: 's5', sequence: 5, address: 'Gartenstr. 17, 80339 München', customer_name: 'Lukas Müller', customer_phone: '+49 89 3456789', order_items_count: 2, order_total_eur: 24.00, notes: null, status: 'pending', eta_min: 15, lat: 48.1420, lng: 11.5750, is_cash: true },
  ],
};

function openNavigation(stop: Stop, app: 'waze' | 'google' | 'apple') {
  if (!stop.lat || !stop.lng) {
    const query = encodeURIComponent(stop.address);
    if (app === 'waze') window.open(`https://waze.com/ul?q=${query}&navigate=yes`);
    else if (app === 'google') window.open(`https://maps.google.com/?q=${query}`);
    else window.open(`https://maps.apple.com/?q=${query}`);
    return;
  }
  const { lat, lng } = stop;
  if (app === 'waze') window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
  else if (app === 'google') window.open(`https://maps.google.com/?daddr=${lat},${lng}`);
  else window.open(`https://maps.apple.com/?daddr=${lat},${lng}`);
}

export function FahrerPhase2753SmartTourStoppCockpit({ driverId }: { driverId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [activeStop, setActiveStop] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/fahrer/active-tour?driver_id=${driverId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => {
          setData(d);
          const current = d.stops.find(s => s.status === 'arrived' || s.status === 'pending');
          if (current && !activeStop) setActiveStop(current.id);
        })
        .catch(() => {
          setData(MOCK);
          const current = MOCK.stops.find(s => s.status === 'arrived' || s.status === 'pending');
          if (current) setActiveStop(current.id);
        });

    if (!driverId) {
      setData(MOCK);
      const current = MOCK.stops.find(s => s.status === 'arrived' || s.status === 'pending');
      if (current) setActiveStop(current.id);
      return;
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [driverId]);

  if (!data) return null;

  const progressPct = data.stops_total > 0 ? (data.stops_done / data.stops_total) * 100 : 0;
  const currentStop = data.stops.find(s => s.id === activeStop);

  return (
    <div className="space-y-3">
      {/* Tour Header */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
            <Bike className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">Aktive Tour</div>
            <div className="text-[11px] text-stone-400">{data.stops_done} von {data.stops_total} Stopps · Score: <span className={cn('font-bold', data.tour_score >= 80 ? 'text-matcha-700' : data.tour_score >= 65 ? 'text-amber-600' : 'text-red-600')}>{data.tour_score}</span></div>
          </div>
          {data.estimated_finish_min !== null && (
            <div className="text-right">
              <div className="text-sm font-bold tabular-nums text-matcha-700">~{data.estimated_finish_min} Min</div>
              <div className="text-[10px] text-stone-400">bis Abschluss</div>
            </div>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-matcha-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-stone-400">
          <span>{data.stops_done} geliefert</span>
          <span>{data.stops_total - data.stops_done} ausstehend</span>
        </div>
      </div>

      {/* Current Stop highlight */}
      {currentStop && (
        <div className={cn('rounded-2xl border-2 p-4 bg-white', currentStop.status === 'arrived' ? 'border-amber-400 bg-amber-50' : 'border-matcha-300')}>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold', currentStop.status === 'arrived' ? 'bg-amber-400' : 'bg-matcha-600')}>
              {currentStop.sequence}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                {currentStop.status === 'arrived' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 animate-pulse">
                    <MapPin className="h-2.5 w-2.5" />Angekommen
                  </span>
                )}
                {currentStop.is_cash && (
                  <span className="inline-flex items-center text-[10px] font-bold text-stone-600 bg-stone-100 rounded-full px-2 py-0.5">
                    Barzahlung
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-char">{currentStop.customer_name}</div>
              <div className="text-xs text-stone-500 mt-0.5 flex items-start gap-1">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-stone-400" />
                {currentStop.address}
              </div>
              {currentStop.notes && (
                <div className="mt-1.5 flex items-start gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] text-amber-800">{currentStop.notes}</span>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                <Package className="h-3.5 w-3.5" />
                {currentStop.order_items_count} Artikel · <span className="font-bold">{currentStop.order_total_eur.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {/* Navigation */}
            <div className="relative flex-1">
              <button
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 px-3 py-2 text-xs font-bold text-white"
                onClick={() => setNavOpen(navOpen === currentStop.id ? null : currentStop.id)}
              >
                <Navigation className="h-3.5 w-3.5" />Navigation
              </button>
              {navOpen === currentStop.id && (
                <div className="absolute bottom-full mb-1 left-0 w-full rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden z-10">
                  {[
                    { app: 'waze' as const, label: 'Waze', emoji: '🗺️' },
                    { app: 'google' as const, label: 'Google Maps', emoji: '📍' },
                    { app: 'apple' as const, label: 'Apple Maps', emoji: '🍎' },
                  ].map(({ app, label, emoji }) => (
                    <button
                      key={app}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-stone-50 transition"
                      onClick={() => { openNavigation(currentStop, app); setNavOpen(null); }}
                    >
                      <span>{emoji}</span><span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentStop.customer_phone && (
              <a
                href={`tel:${currentStop.customer_phone}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700"
              >
                <Phone className="h-3.5 w-3.5" />Anrufen
              </a>
            )}
          </div>
        </div>
      )}

      {/* All stops list */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">Alle Stopps</div>
        </div>
        <div className="divide-y divide-stone-100">
          {data.stops.map(stop => (
            <button
              key={stop.id}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                stop.id === activeStop ? 'bg-matcha-50' : 'hover:bg-stone-50',
                stop.status === 'delivered' ? 'opacity-60' : ''
              )}
              onClick={() => setActiveStop(stop.id === activeStop ? null : stop.id)}
            >
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                stop.status === 'delivered' ? 'bg-matcha-100 text-matcha-700' :
                stop.status === 'arrived' ? 'bg-amber-100 text-amber-700' :
                stop.status === 'skipped' ? 'bg-red-100 text-red-700' :
                'bg-stone-100 text-stone-600'
              )}>
                {stop.status === 'delivered' ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.sequence}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{stop.customer_name}</div>
                <div className="text-[11px] text-stone-400 truncate">{stop.address}</div>
              </div>
              <div className="shrink-0 text-right">
                {stop.status === 'delivered' && <CheckCircle2 className="h-4 w-4 text-matcha-500" />}
                {stop.status === 'arrived' && <span className="text-[10px] font-bold text-amber-600">Hier</span>}
                {stop.status === 'pending' && stop.eta_min !== null && (
                  <div className="flex items-center gap-0.5 text-[11px] text-stone-400">
                    <Clock className="h-3 w-3" />~{stop.eta_min} Min
                  </div>
                )}
                {stop.is_cash && <div className="text-[10px] text-stone-400">Bar</div>}
              </div>
              {stop.status !== 'delivered' && <ChevronRight className="h-3.5 w-3.5 text-stone-300 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
