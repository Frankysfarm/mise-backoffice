'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  MapPin, Navigation, CheckCircle2, Clock, Package, Phone, AlertTriangle, Zap,
  ChevronRight, ArrowRight, Map as MapIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_telefon: string | null;
    kunde_notiz: string | null;
    kunde_lieferhinweis: string | null;
    gesamtbetrag: number;
    zahlungsart: string;
    eta_earliest: string | null;
    eta_latest: string | null;
    items?: { name: string; menge: number }[];
  } | null;
};

function formatEtaTime(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function etaMinsLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
}

function EtaChip({ eta }: { eta: string | null }) {
  const mins = etaMinsLeft(eta);
  if (mins === null) return null;
  return (
    <span className={cn(
      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
      mins < 0 ? 'bg-red-100 text-red-700' :
      mins < 5 ? 'bg-orange-100 text-orange-700' :
      mins < 15 ? 'bg-amber-100 text-amber-700' :
      'bg-emerald-100 text-emerald-700',
    )}>
      {mins < 0 ? `${Math.abs(mins)} Min überfällig` : `in ${mins} Min`}
    </span>
  );
}

function openMaps(address: string | null) {
  if (!address) return;
  const encoded = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
}

export function FahrerPhase502TourStoppNavigator({ stops }: { stops: Stop[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const pending = useMemo(() => sorted.filter(s => !s.geliefert_am), [sorted]);
  const done = useMemo(() => sorted.filter(s => !!s.geliefert_am), [sorted]);
  const nextStop = pending[0] ?? null;

  if (stops.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Next Stop Hero */}
      {nextStop && nextStop.order && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Navigation size={13} className="text-emerald-200" />
            <span className="text-[11px] text-emerald-200 font-medium">
              Nächster Stopp · {nextStop.reihenfolge} von {stops.length}
            </span>
            <EtaChip eta={nextStop.order.eta_latest} />
          </div>

          <div className="mb-3">
            <div className="text-lg font-bold leading-tight">{nextStop.order.kunde_name}</div>
            <div className="text-sm text-emerald-100 mt-0.5">
              #{nextStop.order.bestellnummer}
            </div>
            {nextStop.order.kunde_adresse && (
              <div className="flex items-start gap-1 mt-1.5">
                <MapPin size={12} className="text-emerald-300 shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-100">{nextStop.order.kunde_adresse}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {nextStop.order.kunde_lieferhinweis && (
            <div className="bg-emerald-800/40 rounded-lg px-3 py-2 mb-3 flex items-start gap-1.5">
              <AlertTriangle size={11} className="text-amber-300 shrink-0 mt-0.5" />
              <span className="text-[11px] text-emerald-100">{nextStop.order.kunde_lieferhinweis}</span>
            </div>
          )}

          {/* Items preview */}
          {nextStop.order.items && nextStop.order.items.length > 0 && (
            <div className="bg-emerald-800/30 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center gap-1 mb-1">
                <Package size={11} className="text-emerald-300" />
                <span className="text-[10px] text-emerald-300 font-semibold">Bestellung</span>
              </div>
              <div className="text-[11px] text-emerald-100">
                {nextStop.order.items.slice(0, 3).map(i => `${i.menge}× ${i.name}`).join(', ')}
                {(nextStop.order.items.length ?? 0) > 3 && ` +${nextStop.order.items.length - 3}`}
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-emerald-800/40 rounded-lg px-2.5 py-1.5 flex-1 text-center">
              <div className="text-xs font-bold">{nextStop.order.gesamtbetrag.toFixed(2)} €</div>
              <div className="text-[9px] text-emerald-300">{nextStop.order.zahlungsart}</div>
            </div>
            {nextStop.order.zahlungsart === 'bar' && (
              <div className="bg-amber-500/80 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-xs font-bold text-white">Bargeld!</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openMaps(nextStop.order?.kunde_adresse ?? null)}
              className="bg-white text-emerald-700 rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <MapIcon size={13} />
              Navigation
            </button>
            {nextStop.order.kunde_telefon && (
              <a
                href={`tel:${nextStop.order.kunde_telefon}`}
                className="bg-emerald-500 text-white rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <Phone size={13} />
                Anrufen
              </a>
            )}
          </div>
        </div>
      )}

      {/* All Stops List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={13} className="text-amber-500" />
            <span className="text-xs font-bold text-gray-900">Tour-Übersicht</span>
          </div>
          <span className="text-[10px] text-gray-400">
            {done.length}/{stops.length} geliefert
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${stops.length > 0 ? (done.length / stops.length) * 100 : 0}%` }}
          />
        </div>

        <div className="divide-y divide-gray-50">
          {sorted.map((stop, idx) => {
            const o = stop.order;
            const isDone = !!stop.geliefert_am;
            const isCurrent = !isDone && idx === done.length;
            return (
              <div key={stop.id} className={cn(
                'flex items-start gap-3 px-4 py-3',
                isCurrent && 'bg-emerald-50',
                isDone && 'opacity-60',
              )}>
                {/* Step indicator */}
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5',
                  isDone ? 'bg-emerald-500 text-white' :
                  isCurrent ? 'bg-emerald-600 text-white ring-2 ring-emerald-200' :
                  'bg-gray-100 text-gray-400',
                )}>
                  {isDone ? '✓' : stop.reihenfolge}
                </div>

                <div className="flex-1 min-w-0">
                  {o ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900">{o.kunde_name}</span>
                        {isCurrent && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold">NÄCHSTER</span>}
                        {isDone && <CheckCircle2 size={11} className="text-emerald-500" />}
                      </div>
                      {o.kunde_adresse && (
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">{o.kunde_adresse}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">#{o.bestellnummer}</span>
                        <span className="text-[10px] font-semibold text-gray-600">{o.gesamtbetrag.toFixed(2)} €</span>
                        {o.eta_latest && !isDone && <EtaChip eta={o.eta_latest} />}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-gray-400">Stopp {stop.reihenfolge}</div>
                  )}
                </div>

                {!isDone && o?.kunde_adresse && (
                  <button
                    onClick={() => openMaps(o.kunde_adresse)}
                    className="shrink-0 p-1.5 text-emerald-600 hover:text-emerald-700 active:scale-90 transition-transform"
                  >
                    <Navigation size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
