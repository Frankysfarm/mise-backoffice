'use client';
import { useEffect, useRef, useState } from 'react';
import { Navigation2, Phone, CheckCircle2, ChevronDown, ChevronUp, MapPin, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStopp {
  stopp_id: string;
  reihenfolge: number;
  adresse: string;
  kunde: string;
  telefon: string | null;
  eta_iso: string | null;
  status: 'ausstehend' | 'angekommen' | 'abgeschlossen';
  notiz: string | null;
}

interface ApiData {
  batch_id: string;
  stopps: TourStopp[];
  total_stopps: number;
  abgeschlossen: number;
}

function secondsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1_000);
}

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function openNavi(app: 'google' | 'apple' | 'waze', adresse: string) {
  const enc = encodeURIComponent(adresse);
  const urls: Record<typeof app, string> = {
    google: `https://maps.google.com/maps?daddr=${enc}&dirflg=d`,
    apple:  `maps://maps.apple.com/?daddr=${enc}&dirflg=d`,
    waze:   `https://waze.com/ul?q=${enc}&navigate=yes`,
  };
  window.open(urls[app], '_blank', 'noopener');
}

const MOCK: ApiData = {
  batch_id: 'batch-42',
  stopps: [
    { stopp_id: 's1', reihenfolge: 1, adresse: 'Hauptstraße 12, 10115 Berlin', kunde: 'Max Müller', telefon: '+4917612345678', eta_iso: new Date(Date.now() + 4 * 60_000).toISOString(), status: 'ausstehend', notiz: 'Bitte klingeln – 3. OG links' },
    { stopp_id: 's2', reihenfolge: 2, adresse: 'Berliner Str. 88, 10117 Berlin', kunde: 'Sara Klein', telefon: '+4915123456789', eta_iso: new Date(Date.now() + 11 * 60_000).toISOString(), status: 'ausstehend', notiz: null },
    { stopp_id: 's3', reihenfolge: 3, adresse: 'Kastanienallee 5, 10119 Berlin', kunde: 'Tim Bauer', telefon: null, eta_iso: new Date(Date.now() + 19 * 60_000).toISOString(), status: 'ausstehend', notiz: null },
  ],
  total_stopps: 3,
  abgeschlossen: 0,
};

export function FahrerPhase2718SmartTourCockpitUltra({
  batchId,
  driverId,
}: {
  batchId?: string | null;
  driverId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/fahrer/tour-cockpit?batch_id=${batchId ?? ''}&driver_id=${driverId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));

    if (!batchId && !driverId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [batchId, driverId]);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  if (!data) return null;

  const aktuellerStopp = data.stopps.find(s => s.status === 'ausstehend');
  const naechsteStoepps = data.stopps.filter(s => s.status === 'ausstehend').slice(1);
  const fortschritt = data.abgeschlossen / Math.max(data.total_stopps, 1);

  if (!aktuellerStopp) return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 text-center mb-3">
      <CheckCircle2 className="h-8 w-8 text-matcha-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-matcha-800">Tour abgeschlossen!</p>
      <p className="text-xs text-matcha-600 mt-0.5">Alle {data.total_stopps} Stopps erledigt</p>
    </div>
  );

  const etaSec = secondsUntil(aktuellerStopp.eta_iso);
  const etaColor = etaSec === null ? 'text-gray-500' : etaSec < 0 ? 'text-red-600' : etaSec < 120 ? 'text-amber-600' : 'text-matcha-700';

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm mb-3 overflow-hidden">
      {/* Header */}
      <div className="bg-matcha-900 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-xs font-semibold text-matcha-200">Smart Tour Cockpit</span>
          </div>
          <div className="text-xs text-matcha-300">
            {data.abgeschlossen}/{data.total_stopps} Stopps
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-matcha-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-700"
            style={{ width: `${fortschritt * 100}%` }}
          />
        </div>
      </div>

      {/* Aktueller Stopp — Hero */}
      <div className="px-4 py-4 border-b border-matcha-100">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold text-matcha-500 uppercase tracking-wide">Nächster Stopp</span>
              <span className="text-[10px] text-gray-400">#{aktuellerStopp.reihenfolge}</span>
            </div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{aktuellerStopp.adresse}</p>
            <p className="text-xs text-gray-500 mt-0.5">{aktuellerStopp.kunde}</p>
            {aktuellerStopp.notiz && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5 font-medium">
                ⚠ {aktuellerStopp.notiz}
              </p>
            )}
          </div>
          {etaSec !== null && (
            <div className="text-right flex-shrink-0">
              <div className={cn('text-2xl font-black tabular-nums font-mono', etaColor, etaSec < 0 && 'animate-pulse')}>
                {fmtMmSs(etaSec)}
              </div>
              <div className="text-[9px] text-gray-400">ETA</div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {(['google', 'apple', 'waze'] as const).map(app => (
            <button
              key={app}
              onClick={() => openNavi(app, aktuellerStopp.adresse)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-matcha-50 border border-matcha-200 text-xs font-semibold text-matcha-700 hover:bg-matcha-100 active:bg-matcha-200 transition-colors"
            >
              <Navigation2 size={12} />
              {app === 'google' ? 'Google' : app === 'apple' ? 'Apple' : 'Waze'}
            </button>
          ))}
        </div>

        {/* Anruf */}
        {aktuellerStopp.telefon && (
          <a
            href={`tel:${aktuellerStopp.telefon}`}
            className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Phone size={12} />
            {aktuellerStopp.kunde} anrufen
          </a>
        )}
      </div>

      {/* Nächste Stopps */}
      {naechsteStoepps.length > 0 && (
        <div>
          <button
            onClick={() => setShowAll(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-matcha-600 hover:bg-matcha-50 transition-colors"
          >
            <span className="font-medium">{naechsteStoepps.length} weitere Stopp{naechsteStoepps.length > 1 ? 's' : ''}</span>
            {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAll && (
            <div className="border-t border-matcha-50 divide-y divide-gray-50">
              {naechsteStoepps.map(stopp => {
                const secs = secondsUntil(stopp.eta_iso);
                return (
                  <div key={stopp.stopp_id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 flex-shrink-0">#{stopp.reihenfolge}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{stopp.adresse}</p>
                      <p className="text-[10px] text-gray-400">{stopp.kunde}</p>
                    </div>
                    {secs !== null && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Clock size={10} className="text-gray-400" />
                        <span className="text-xs text-gray-500 font-mono">{Math.max(0, Math.round(secs / 60))} min</span>
                      </div>
                    )}
                    <button
                      onClick={() => openNavi('google', stopp.adresse)}
                      className="flex-shrink-0 p-1.5 rounded-lg bg-matcha-50 text-matcha-600 hover:bg-matcha-100 transition-colors"
                    >
                      <MapPin size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
