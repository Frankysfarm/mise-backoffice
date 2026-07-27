'use client';

import { useEffect, useState, useCallback } from 'react';
import { Navigation, MapPin, Clock, Package, CheckCircle2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStopp {
  stopp_id: string;
  rang: number;
  adresse: string;
  kunde_name: string;
  eta_min: number | null;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  lat?: number | null;
  lng?: number | null;
}

interface TourData {
  stopps: TourStopp[];
  aktiver_stopp_id: string | null;
  verbleibende_stopps: number;
  tour_eta_gesamt_min: number;
}

const MOCK: TourData = {
  stopps: [
    { stopp_id: 's1', rang: 1, adresse: 'Musterstr. 12, 52062 Aachen', kunde_name: 'M. Müller',  eta_min: 5,  status: 'unterwegs', lat: 50.776, lng: 6.084 },
    { stopp_id: 's2', rang: 2, adresse: 'Kaiserpl. 4, 52062 Aachen',   kunde_name: 'K. Schmidt', eta_min: 14, status: 'ausstehend', lat: 50.774, lng: 6.086 },
    { stopp_id: 's3', rang: 3, adresse: 'Pontstr. 39, 52062 Aachen',   kunde_name: 'J. Weber',   eta_min: 22, status: 'ausstehend', lat: 50.772, lng: 6.088 },
  ],
  aktiver_stopp_id: 's1',
  verbleibende_stopps: 3,
  tour_eta_gesamt_min: 22,
};

const POLL_MS = 60_000;

const STATUS_META = {
  ausstehend: { dot: 'bg-gray-300 dark:bg-gray-600',   label: 'Ausstehend',  text: 'text-gray-500' },
  unterwegs:  { dot: 'bg-amber-400 animate-pulse',     label: 'Unterwegs',   text: 'text-amber-500' },
  geliefert:  { dot: 'bg-emerald-400',                 label: 'Geliefert',   text: 'text-emerald-600' },
};

interface Props {
  locationId: string | null;
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1954TourStoppLiveNavigator({ locationId, driverId, isOnline, className }: Props) {
  const [data, setData] = useState<TourData>(MOCK);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline || !locationId || !driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tour-stopps?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [isOnline, locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, POLL_MS); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const aktiverStopp = data.stopps.find(s => s.stopp_id === data.aktiver_stopp_id);

  function buildNavUrl(stopp: TourStopp) {
    if (stopp.lat && stopp.lng) return `https://maps.google.com/?q=${stopp.lat},${stopp.lng}`;
    return `https://maps.google.com/?q=${encodeURIComponent(stopp.adresse)}`;
  }

  return (
    <div className={cn('rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Tour-Stopps</span>
          <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full px-1.5 py-0.5 font-semibold">
            {data.verbleibende_stopps} offen
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-200 border-t-indigo-400 rounded-full animate-spin" />}
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> ~{data.tour_eta_gesamt_min} min
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-indigo-100 dark:border-indigo-800 px-4 pb-4 pt-3 space-y-3">
          {/* Aktiver Stopp Quick-Nav */}
          {aktiverStopp && (
            <a
              href={buildNavUrl(aktiverStopp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-2.5 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Jetzt navigieren</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{aktiverStopp.adresse}</p>
                  <p className="text-[10px] text-slate-400">{aktiverStopp.kunde_name}</p>
                </div>
              </div>
              <Navigation className="w-5 h-5 text-amber-500 shrink-0" />
            </a>
          )}

          {/* Stopp-Liste */}
          <div className="space-y-2">
            {data.stopps.map((s) => {
              const meta = STATUS_META[s.status];
              const isActive = s.stopp_id === data.aktiver_stopp_id;
              return (
                <div
                  key={s.stopp_id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2',
                    isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700' : 'bg-slate-50 dark:bg-slate-700/40',
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400 font-semibold">#{s.rang}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{s.adresse}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Package className="w-3 h-3" /> {s.kunde_name}
                      {s.status !== 'geliefert' && s.eta_min !== null && (
                        <><span className="mx-1">·</span><Clock className="w-3 h-3" /> ~{s.eta_min} min</>
                      )}
                    </p>
                  </div>
                  {s.status === 'geliefert' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <a
                      href={buildNavUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-800 hover:bg-indigo-200 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-slate-400 text-center">Aktualisiert jede Minute</p>
        </div>
      )}
    </div>
  );
}
