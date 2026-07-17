'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, ChevronRight, Clock, CheckCircle2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStopp {
  id: string;
  adresse: string;
  kunde_name?: string;
  eta_min: number;
  status: 'ausstehend' | 'aktuell' | 'abgeschlossen';
  lat?: number;
  lng?: number;
}

interface ApiData {
  stopps: TourStopp[];
  tour_id: string;
  gesamte_stopps: number;
  abgeschlossene_stopps: number;
}

const MOCK: ApiData = {
  tour_id: 'tour-1',
  gesamte_stopps: 3,
  abgeschlossene_stopps: 1,
  stopps: [
    { id: 's1', adresse: 'Musterstraße 12, Berlin', kunde_name: 'Julia M.', eta_min: 4, status: 'aktuell' },
    { id: 's2', adresse: 'Hauptstraße 45, Berlin', kunde_name: 'Tom B.', eta_min: 12, status: 'ausstehend' },
    { id: 's3', adresse: 'Parkweg 7, Berlin', kunde_name: 'Lisa K.', eta_min: 22, status: 'ausstehend' },
  ],
};

function openNav(lat?: number, lng?: number, adresse?: string) {
  const target = lat && lng
    ? `${lat},${lng}`
    : encodeURIComponent(adresse ?? '');
  const url = `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=driving`;
  window.open(url, '_blank');
}

interface Props {
  driverId?: string;
  locationId?: string | null;
  isOnline?: boolean;
}

export function FahrerPhase2131TourStoppsNavigationsKommando({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/fahrer/aktive-tour?driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [driverId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const aktuellerStopp = data.stopps.find(s => s.status === 'aktuell');
  const naechsteStopp = data.stopps.find(s => s.status === 'ausstehend');
  const fortschritt = data.gesamte_stopps > 0
    ? Math.round((data.abgeschlossene_stopps / data.gesamte_stopps) * 100)
    : 0;

  void locationId;

  return (
    <div className="rounded-2xl bg-slate-900 text-white overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
        <Package className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Tour-Stopps · Navigation</span>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {data.abgeschlossene_stopps}/{data.gesamte_stopps} Stopps
        </span>
        {loading && <span className="text-[9px] text-slate-500">…</span>}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800">
        <div
          className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${fortschritt}%` }}
        />
      </div>

      <div className="p-3 space-y-2">
        {/* Aktueller Stopp */}
        {aktuellerStopp && (
          <div className="rounded-xl bg-blue-600/20 border border-blue-500/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{aktuellerStopp.adresse}</div>
                {aktuellerStopp.kunde_name && (
                  <div className="text-[10px] text-blue-300">{aktuellerStopp.kunde_name}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-blue-300">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs font-bold tabular-nums">{aktuellerStopp.eta_min} Min</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => openNav(aktuellerStopp.lat, aktuellerStopp.lng, aktuellerStopp.adresse)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 rounded-xl text-sm font-bold transition-colors"
            >
              <Navigation className="h-4 w-4" />
              Navigieren
            </button>
          </div>
        )}

        {/* Nächster Stopp */}
        {naechsteStopp && (
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 flex items-center gap-2">
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 mb-0.5">Nächster Stopp</div>
              <div className="text-xs text-white truncate">{naechsteStopp.adresse}</div>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">~{naechsteStopp.eta_min} Min</span>
          </div>
        )}

        {/* Restliche Stopps */}
        {data.stopps
          .filter(s => s.status === 'ausstehend' && s.id !== naechsteStopp?.id)
          .map(s => (
            <div key={s.id} className={cn('px-3 py-1.5 flex items-center gap-2 rounded-lg', 'bg-white/3')}>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
              <span className="text-[10px] text-slate-400 flex-1 truncate">{s.adresse}</span>
              <span className="text-[9px] text-slate-500 tabular-nums shrink-0">{s.eta_min} Min</span>
            </div>
          ))
        }

        {data.stopps.length === 0 && (
          <div className="flex items-center gap-2 py-2 justify-center">
            <CheckCircle2 className="h-4 w-4 text-matcha-400" />
            <span className="text-xs text-slate-300">Alle Stopps abgeschlossen</span>
          </div>
        )}
      </div>
    </div>
  );
}
