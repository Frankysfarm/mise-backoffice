'use client';

// Phase 1254 — Navi-Zusammenfassung-Widget (Fahrer-App)
// Komprimierte Übersicht aller heutigen Stopps: Adressen + Zeiten + Bewertungen als scrollbare Karten
// Props: driverId, isOnline · isOnline-Guard · 5-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Clock, Star, Loader2, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoppEintrag {
  id: string;
  adresse: string;
  zone: string | null;
  ankunft_zeit: string | null;
  status: 'zugestellt' | 'fehlgeschlagen' | 'unterwegs';
  bewertung: number | null;
  trinkgeld_cent: number | null;
}

interface ApiResponse {
  stopps: StoppEintrag[];
  gesamt_stopps: number;
  zugestellt: number;
  fehlgeschlagen: number;
  schnitt_bewertung: number | null;
  driver_id: string;
  generiert_am: string;
}

const STATUS_STYLE: Record<StoppEintrag['status'], { dot: string; label: string }> = {
  zugestellt:   { dot: 'bg-green-500',  label: 'Zugestellt' },
  fehlgeschlagen:{ dot: 'bg-red-500',   label: 'Fehlgeschlagen' },
  unterwegs:    { dot: 'bg-blue-400 animate-pulse', label: 'Unterwegs' },
};

function formatZeit(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function mockData(driverId: string): ApiResponse {
  const stopps: StoppEintrag[] = [
    { id: 's1', adresse: 'Hauptstr. 12, Mitte',   zone: 'Mitte', ankunft_zeit: new Date(Date.now() - 90*60000).toISOString(), status: 'zugestellt',    bewertung: 5, trinkgeld_cent: 200 },
    { id: 's2', adresse: 'Nordring 4, Nord',       zone: 'Nord',  ankunft_zeit: new Date(Date.now() - 60*60000).toISOString(), status: 'zugestellt',    bewertung: 4, trinkgeld_cent: 100 },
    { id: 's3', adresse: 'Westgasse 7, West',      zone: 'West',  ankunft_zeit: new Date(Date.now() - 30*60000).toISOString(), status: 'fehlgeschlagen', bewertung: null, trinkgeld_cent: null },
    { id: 's4', adresse: 'Südring 22, Süd',        zone: 'Süd',   ankunft_zeit: null,                                          status: 'unterwegs',      bewertung: null, trinkgeld_cent: null },
  ];
  return {
    stopps,
    gesamt_stopps: stopps.length,
    zugestellt: 2,
    fehlgeschlagen: 1,
    schnitt_bewertung: 4.5,
    driver_id: driverId,
    generiert_am: new Date().toISOString(),
  };
}

export function FahrerPhase1254NaviZusammenfassungWidget({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!isOnline || !driverId) return;
    setLoading(true);
    fetch(`/api/delivery/driver/navi-zusammenfassung?driver_id=${driverId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => setData(mockData(driverId)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  return (
    <div className="rounded-2xl overflow-hidden shadow-md bg-gradient-to-br from-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3"
      >
        <Route className="h-4 w-4 text-indigo-300 shrink-0" />
        <span className="text-sm font-bold flex-1 text-left">Heutige Tour-Übersicht</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-300" />}
        {data && (
          <span className="text-xs text-indigo-200 tabular-nums">
            {data.zugestellt}/{data.gesamt_stopps} ✓
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-indigo-300 shrink-0" /> : <ChevronDown className="h-4 w-4 text-indigo-300 shrink-0" />}
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {data.zugestellt} Zugestellt
            </span>
            {data.fehlgeschlagen > 0 && (
              <span className="flex items-center gap-1 text-red-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                {data.fehlgeschlagen} Fehlgeschlagen
              </span>
            )}
            {data.schnitt_bewertung !== null && (
              <span className="flex items-center gap-1 text-yellow-300 font-semibold ml-auto">
                <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                {data.schnitt_bewertung.toFixed(1)}
              </span>
            )}
          </div>

          {/* Scrollable stop cards */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {data.stopps.map((stopp, i) => {
              const s = STATUS_STYLE[stopp.status];
              return (
                <div
                  key={stopp.id}
                  className="shrink-0 w-44 rounded-xl bg-white/10 border border-white/15 p-3 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-indigo-300">#{i + 1}</span>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
                    <span className="text-[9px] font-semibold text-white/60">{s.label}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 text-indigo-300 mt-0.5 shrink-0" />
                    <span className="text-xs font-medium leading-tight line-clamp-2">{stopp.adresse}</span>
                  </div>
                  {stopp.ankunft_zeit && (
                    <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatZeit(stopp.ankunft_zeit)}
                    </div>
                  )}
                  {stopp.bewertung !== null && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={cn('h-2.5 w-2.5', s <= (stopp.bewertung ?? 0) ? 'fill-yellow-300 text-yellow-300' : 'text-white/20')} />
                      ))}
                    </div>
                  )}
                  {stopp.trinkgeld_cent !== null && stopp.trinkgeld_cent > 0 && (
                    <span className="text-[9px] font-bold text-green-300">
                      +{(stopp.trinkgeld_cent / 100).toFixed(2)} € TG
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {data.stopps.length === 0 && (
            <p className="text-sm text-white/40 text-center py-2">Noch keine Stopps heute.</p>
          )}
        </div>
      )}
    </div>
  );
}
