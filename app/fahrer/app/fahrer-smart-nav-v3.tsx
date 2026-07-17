'use client';

/**
 * FahrerSmartNavV3
 * Smart Navigation Hub v3 für Fahrer.
 * Kombiniert: aktueller Stopp, Countdown, Navigation-Links, nächster Stopp, Tour-Fortschritt.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, ChevronRight, Phone, AlertTriangle, Zap, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  seq: number;
  address: string;
  city: string;
  customer_name: string;
  phone?: string;
  status: 'done' | 'active' | 'next' | 'later';
  eta_min?: number;
  distance_m?: number;
  note?: string;
  cash_amount?: number;
  is_tip_likely?: boolean;
}

interface NavTour {
  id: string;
  stops: Stop[];
  score: number;
  earnings_so_far: number;
  earnings_total: number;
  started_min_ago: number;
}

const MOCK: NavTour = {
  id: 'demo',
  score: 88,
  earnings_so_far: 4.80,
  earnings_total: 14.20,
  started_min_ago: 18,
  stops: [
    { id: 's1', seq: 1, address: 'Markt 4', city: 'Aachen', customer_name: 'T. Müller', status: 'done' },
    { id: 's2', seq: 2, address: 'Pontstr. 12', city: 'Aachen', customer_name: 'A. Schmidt', status: 'done' },
    {
      id: 's3', seq: 3, address: 'Habsburgerstr. 7', city: 'Aachen',
      customer_name: 'K. Weber', phone: '+49151123456',
      status: 'active', eta_min: 2, distance_m: 380,
      note: 'Klingeln 2× — 3. OG links', is_tip_likely: true,
    },
    {
      id: 's4', seq: 4, address: 'Jülicher Str. 88', city: 'Aachen',
      customer_name: 'L. Becker',
      status: 'next', eta_min: 10, distance_m: 1800, cash_amount: 18.50,
    },
    { id: 's5', seq: 5, address: 'Roermonder Str. 15', city: 'Aachen', customer_name: 'M. Fischer', status: 'later', eta_min: 22, distance_m: 3100 },
  ],
};

function useCountdown() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function NavButton({ address, city, label }: { address: string; city: string; label: string }) {
  const encoded = encodeURIComponent(`${address}, ${city}`);
  return (
    <a
      href={`https://maps.google.com/?q=${encoded}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
    >
      <Navigation className="w-3.5 h-3.5" /> {label}
    </a>
  );
}

export function FahrerSmartNavV3({ driverId }: { driverId?: string | null }) {
  useCountdown();
  const [tour] = useState<NavTour>(MOCK);

  const active = tour.stops.find(s => s.status === 'active');
  const next = tour.stops.find(s => s.status === 'next');
  const doneCount = tour.stops.filter(s => s.status === 'done').length;
  const totalCount = tour.stops.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-600 to-matcha-500 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-wide">Smart Nav v3</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-base font-black tabular-nums">{tour.score}</div>
              <div className="text-[9px] opacity-75">Score</div>
            </div>
            <div className="text-right">
              <div className="text-base font-black tabular-nums">{tour.earnings_so_far.toFixed(2)} €</div>
              <div className="text-[9px] opacity-75">Verdient</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[9px] opacity-75 mb-1">
            <span>{doneCount}/{totalCount} Stopps</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Active Stop */}
      {active && (
        <div className="border-b border-matcha-100 bg-matcha-50 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-full bg-matcha-500 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-matcha-600">Jetzt liefern</span>
                  {active.is_tip_likely && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                      <Star className="w-2.5 h-2.5" /> Trinkgeld erwartet
                    </span>
                  )}
                </div>
                <div className="text-sm font-black text-stone-900 mt-0.5">{active.address}</div>
                <div className="text-xs text-stone-500">{active.city} · {active.customer_name}</div>
                {active.note && (
                  <div className="mt-1 flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {active.note}
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {active.eta_min !== undefined && (
                <div>
                  <div className={cn('text-lg font-black tabular-nums', active.eta_min <= 2 ? 'text-red-500 animate-pulse' : active.eta_min <= 5 ? 'text-amber-500' : 'text-matcha-600')}>
                    {active.eta_min}m
                  </div>
                  <div className="text-[9px] text-stone-400">verbleibend</div>
                </div>
              )}
              {active.distance_m && (
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {active.distance_m >= 1000 ? `${(active.distance_m / 1000).toFixed(1)} km` : `${active.distance_m} m`}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-2.5">
            <NavButton address={active.address} city={active.city} label="Google Maps" />
            {active.phone && (
              <a
                href={`tel:${active.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-200 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" /> Anrufen
              </a>
            )}
          </div>
        </div>
      )}

      {/* Next Stop Preview */}
      {next && (
        <div className="border-b border-stone-100 px-4 py-2.5 bg-amber-50/50">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">Nächster Stopp</div>
              <div className="text-xs font-bold text-stone-800 truncate">{next.address}, {next.city}</div>
              <div className="text-[10px] text-stone-500 truncate">{next.customer_name}{next.cash_amount ? ` · ${next.cash_amount.toFixed(2)} € bar` : ''}</div>
            </div>
            <div className="shrink-0 text-right">
              {next.eta_min && <div className="text-xs font-black text-stone-700">~{next.eta_min} Min</div>}
              {next.distance_m && <div className="text-[9px] text-stone-400">{next.distance_m >= 1000 ? `${(next.distance_m / 1000).toFixed(1)} km` : `${next.distance_m} m`}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Stop List */}
      <div className="divide-y divide-stone-50 max-h-48 overflow-y-auto">
        {tour.stops.filter(s => s.status === 'later').map(s => (
          <div key={s.id} className="flex items-center gap-2 px-4 py-2">
            <div className="w-5 h-5 rounded-full border-2 border-stone-200 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-black text-stone-400">{s.seq}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-stone-600 truncate">{s.address}</div>
              <div className="text-[9px] text-stone-400 truncate">{s.customer_name}</div>
            </div>
            {s.eta_min && <span className="text-[9px] text-stone-400 shrink-0">~{s.eta_min} Min</span>}
          </div>
        ))}
        {tour.stops.filter(s => s.status === 'done').map(s => (
          <div key={s.id} className="flex items-center gap-2 px-4 py-1.5 opacity-40">
            <CheckCircle2 className="w-4 h-4 text-matcha-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-stone-500 truncate line-through">{s.address} · {s.customer_name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-stone-100 bg-stone-50">
        <div className="flex items-center gap-1 text-[10px] text-stone-500">
          <Clock className="w-3 h-3" /> Schicht seit {tour.started_min_ago} Min
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-matcha-700">
          <TrendingUp className="w-3 h-3" /> {tour.earnings_total.toFixed(2)} € Ziel
        </div>
      </div>
    </div>
  );
}
