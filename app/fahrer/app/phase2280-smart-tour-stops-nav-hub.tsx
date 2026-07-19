'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Navigation, MapPin, CheckCircle2, Clock, Phone, ChevronRight, AlertTriangle } from 'lucide-react';

interface TourStop {
  stopId: string;
  position: number;
  adresse: string;
  kundeName: string;
  kundePhone?: string;
  etaMin: number | null;
  distanzM: number;
  status: 'ausstehend' | 'unterwegs' | 'angefahren' | 'geliefert';
  hinweis?: string;
}

const MOCK_STOPS: TourStop[] = [
  { stopId: 'S-1', position: 1, adresse: 'Musterstr. 12, Berlin', kundeName: 'Maria S.', kundePhone: '+49 30 1234567', etaMin: 8, distanzM: 1200, status: 'unterwegs' },
  { stopId: 'S-2', position: 2, adresse: 'Hauptweg 4, Berlin', kundeName: 'Tom K.', kundePhone: '+49 30 9876543', etaMin: 18, distanzM: 2800, status: 'ausstehend' },
  { stopId: 'S-3', position: 3, adresse: 'Birkenallee 7, Berlin', kundeName: 'Lena B.', etaMin: 28, distanzM: 4100, status: 'ausstehend', hinweis: 'Klingel 3. OG' },
  { stopId: 'S-4', position: 4, adresse: 'Parkstr. 22, Berlin', kundeName: 'Kai M.', kundePhone: '+49 30 5554433', etaMin: 38, distanzM: 5900, status: 'ausstehend' },
];

const NAVI_APPS = [
  { key: 'google', label: 'Google Maps', urlFn: (addr: string) => `https://maps.google.com/?q=${encodeURIComponent(addr)}` },
  { key: 'waze', label: 'Waze', urlFn: (addr: string) => `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes` },
  { key: 'apple', label: 'Apple Maps', urlFn: (addr: string) => `https://maps.apple.com/?q=${encodeURIComponent(addr)}` },
];

function StatusPill({ status }: { status: TourStop['status'] }) {
  const map = {
    ausstehend: 'bg-stone-100 text-stone-500',
    unterwegs: 'bg-matcha-100 text-matcha-700',
    angefahren: 'bg-blue-100 text-blue-700',
    geliefert: 'bg-emerald-100 text-emerald-700',
  };
  const labels = { ausstehend: 'Wartend', unterwegs: 'Unterwegs', angefahren: 'Vor Ort', geliefert: 'Geliefert' };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export function FahrerPhase2280SmartTourStopsNavHub({ tourId }: { tourId?: string }) {
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [naviApp, setNaviApp] = useState<string>('google');
  const [activeStop, setActiveStop] = useState<string | null>(MOCK_STOPS[0]?.stopId ?? null);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    if (!tourId) return;
    try {
      const { data } = await supabase
        .from('tour_stops')
        .select('id,position,address,customer_name,customer_phone,eta_min,distance_m,status,notes')
        .eq('tour_id', tourId)
        .order('position', { ascending: true });
      if (data && data.length > 0) {
        setStops(data.map((d: any) => ({
          stopId: d.id,
          position: d.position,
          adresse: d.address,
          kundeName: d.customer_name ?? 'Unbekannt',
          kundePhone: d.customer_phone,
          etaMin: d.eta_min,
          distanzM: d.distance_m ?? 0,
          status: d.status ?? 'ausstehend',
          hinweis: d.notes,
        })));
      }
    } catch {
      // keep mock
    }
  }, [supabase, tourId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const currentStop = stops.find((s) => s.stopId === activeStop) ?? stops[0];
  const doneCount = stops.filter((s) => s.status === 'geliefert').length;
  const progressPct = stops.length ? (doneCount / stops.length) * 100 : 0;

  const naviUrl = currentStop
    ? NAVI_APPS.find((a) => a.key === naviApp)?.urlFn(currentStop.adresse) ?? '#'
    : '#';

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-matcha-600 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            <span className="font-bold text-base">Tour-Navigation</span>
          </div>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {doneCount}/{stops.length} Stopps
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Current Stop Hero */}
      {currentStop && (
        <div className="p-4 border-b border-stone-100">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wide">Aktueller Stopp</p>
              <p className="font-bold text-stone-900 text-sm truncate">{currentStop.kundeName}</p>
              <p className="text-xs text-stone-500 truncate">{currentStop.adresse}</p>
              {currentStop.hinweis && (
                <p className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                  <AlertTriangle className="w-3 h-3" />{currentStop.hinweis}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {currentStop.etaMin != null && (
                <div className="flex items-center gap-1 text-matcha-700">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-black text-lg tabular-nums">{currentStop.etaMin}</span>
                  <span className="text-xs">min</span>
                </div>
              )}
              <p className="text-[10px] text-stone-400">{(currentStop.distanzM / 1000).toFixed(1)} km</p>
            </div>
          </div>

          {/* Nav app selector + button */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-1">
              {NAVI_APPS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setNaviApp(a.key)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    naviApp === a.key ? 'bg-matcha-700 text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {a.label.split(' ')[0]}
                </button>
              ))}
            </div>
            <a
              href={naviUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 bg-matcha-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-matcha-700 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              Navigieren
            </a>
            {currentStop.kundePhone && (
              <a
                href={`tel:${currentStop.kundePhone}`}
                className="flex items-center gap-1 bg-stone-100 text-stone-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stop list */}
      <div className="divide-y divide-stone-100">
        {stops.map((s) => (
          <button
            key={s.stopId}
            onClick={() => setActiveStop(s.stopId)}
            className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
              s.stopId === activeStop ? 'bg-matcha-50' : 'hover:bg-stone-50'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
              s.status === 'geliefert' ? 'bg-emerald-500 text-white' :
              s.stopId === activeStop ? 'bg-matcha-600 text-white' :
              'bg-stone-200 text-stone-500'
            }`}>
              {s.status === 'geliefert' ? <CheckCircle2 className="w-3 h-3" /> : s.position}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-800 truncate">{s.kundeName}</p>
              <p className="text-[10px] text-stone-400 truncate">{s.adresse}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <StatusPill status={s.status} />
              {s.etaMin != null && s.status !== 'geliefert' && (
                <span className="text-[10px] font-mono text-stone-500">{s.etaMin}m</span>
              )}
              <ChevronRight className="w-3 h-3 text-stone-300" />
            </div>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-stone-400 text-center py-2">Navi-App wählbar · 20s Refresh</p>
    </div>
  );
}
