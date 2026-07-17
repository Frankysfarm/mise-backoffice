'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Navigation2, Clock, CheckCircle2, Phone, AlertTriangle, ChevronRight } from 'lucide-react';

interface Stopp {
  id: string;
  index: number;
  adresse: string;
  kunde: string;
  telefon?: string;
  etaMin: number;
  distanzKm: number;
  status: 'pending' | 'current' | 'done';
  anmerkung?: string;
  zahlungsart: 'bar' | 'karte' | 'online';
  betrag: number;
}

const MOCK_STOPPS: Stopp[] = [
  {
    id: 's1', index: 1, adresse: 'Hauptstr. 42, 10115 Berlin', kunde: 'Müller, Anna',
    telefon: '+49 30 123456', etaMin: 6, distanzKm: 1.2, status: 'current',
    zahlungsart: 'bar', betrag: 28.50,
  },
  {
    id: 's2', index: 2, adresse: 'Kastanienallee 15, 10435 Berlin', kunde: 'Schmidt, Thomas',
    etaMin: 14, distanzKm: 2.8, status: 'pending',
    anmerkung: 'Bitte klingeln bei Wiesner', zahlungsart: 'karte', betrag: 42.00,
  },
  {
    id: 's3', index: 3, adresse: 'Schönhauser Allee 8, 10119 Berlin', kunde: 'Garcia, Maria',
    telefon: '+49 30 987654', etaMin: 22, distanzKm: 4.1, status: 'pending',
    zahlungsart: 'online', betrag: 35.80,
  },
];

const ZAHLUNGS_COLORS: Record<string, string> = {
  bar: 'bg-emerald-100 text-emerald-700',
  karte: 'bg-blue-100 text-blue-700',
  online: 'bg-purple-100 text-purple-700',
};

const ZAHLUNGS_LABELS: Record<string, string> = {
  bar: 'Bar',
  karte: 'Karte',
  online: 'Online',
};

export function FahrerPhase2200SmartStoppNaviCockpit() {
  const [stopps, setStopps] = useState<Stopp[]>(MOCK_STOPPS);
  const [completing, setCompleting] = useState<string | null>(null);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('fahrer_tour_stopps_aktuell')
        .select('id,index,adresse,kunde,telefon,eta_min,distanz_km,status,anmerkung,zahlungsart,betrag')
        .order('index', { ascending: true });
      if (data && data.length > 0) {
        setStopps(data.map((d) => ({
          id: d.id,
          index: d.index,
          adresse: d.adresse,
          kunde: d.kunde,
          telefon: d.telefon,
          etaMin: d.eta_min ?? 0,
          distanzKm: d.distanz_km ?? 0,
          status: d.status ?? 'pending',
          anmerkung: d.anmerkung,
          zahlungsart: d.zahlungsart ?? 'online',
          betrag: d.betrag ?? 0,
        })));
      }
    } catch {
      // keep mock
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleComplete = useCallback(async (stoppId: string) => {
    setCompleting(stoppId);
    try {
      await supabase
        .from('fahrer_tour_stopps_aktuell')
        .update({ status: 'done' })
        .eq('id', stoppId);
      setStopps((prev) => prev.map((s) =>
        s.id === stoppId ? { ...s, status: 'done' } : s
      ));
    } catch {
      // ignore
    } finally {
      setCompleting(null);
    }
  }, [supabase]);

  const handleNav = useCallback((adresse: string) => {
    const encoded = encodeURIComponent(adresse);
    window.open(`https://maps.google.com/?daddr=${encoded}`, '_blank', 'noopener');
  }, []);

  const currentStopp = stopps.find((s) => s.status === 'current');
  const pending = stopps.filter((s) => s.status === 'pending');
  const done = stopps.filter((s) => s.status === 'done');

  return (
    <div className="bg-stone-50 min-h-full p-3 space-y-3">
      {/* Header */}
      <div className="bg-stone-800 text-white rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-stone-400">Tour-Navigator</span>
          <span className="text-xs text-stone-400">{done.length}/{stopps.length} erledigt</span>
        </div>
        <div className="flex gap-1 mt-2">
          {stopps.map((s) => (
            <div
              key={s.id}
              className={`flex-1 h-1.5 rounded-full ${
                s.status === 'done' ? 'bg-emerald-400' :
                s.status === 'current' ? 'bg-amber-400' :
                'bg-stone-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Aktueller Stopp */}
      {currentStopp && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">
              JETZT · Stopp {currentStopp.index}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ZAHLUNGS_COLORS[currentStopp.zahlungsart]}`}>
              {ZAHLUNGS_LABELS[currentStopp.zahlungsart]} €{currentStopp.betrag.toFixed(2)}
            </span>
          </div>

          <p className="text-sm font-bold text-stone-900">{currentStopp.kunde}</p>
          <p className="text-xs text-stone-600 mb-3">{currentStopp.adresse}</p>

          {currentStopp.anmerkung && (
            <div className="flex items-start gap-1.5 bg-amber-50 rounded-lg p-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{currentStopp.anmerkung}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleNav(currentStopp.adresse)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-stone-800 text-white text-xs font-semibold py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              <Navigation2 className="w-3.5 h-3.5" />
              Navigieren
            </button>

            {currentStopp.telefon && (
              <a
                href={`tel:${currentStopp.telefon}`}
                className="flex items-center justify-center gap-1 bg-stone-100 text-stone-700 text-xs font-semibold px-3 py-2.5 rounded-xl active:scale-95 transition-transform"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={() => handleComplete(currentStopp.id)}
              disabled={completing === currentStopp.id}
              className="flex items-center justify-center gap-1 bg-emerald-500 text-white text-xs font-semibold px-3 py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Nächste Stopps */}
      {pending.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-stone-500 mb-1.5 px-1">Nächste Stopps</p>
          <div className="space-y-2">
            {pending.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-stone-600">{s.index}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-800 truncate">{s.kunde}</p>
                  <p className="text-[10px] text-stone-500 truncate">{s.adresse}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                      <Clock className="w-2.5 h-2.5" /> ~{s.etaMin} Min
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                      <MapPin className="w-2.5 h-2.5" /> {s.distanzKm.toFixed(1)} km
                    </span>
                    <span className={`text-[10px] px-1 py-0 rounded ${ZAHLUNGS_COLORS[s.zahlungsart]}`}>
                      €{s.betrag.toFixed(0)}
                    </span>
                  </div>
                  {s.anmerkung && (
                    <p className="text-[10px] text-amber-600 mt-0.5 truncate">⚠ {s.anmerkung}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length === stopps.length && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-800">Tour abgeschlossen!</p>
          <p className="text-xs text-emerald-600 mt-0.5">Alle {stopps.length} Stopps erledigt</p>
        </div>
      )}
    </div>
  );
}
