'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Package } from 'lucide-react';

interface Phase {
  label: string;
  status: 'abgeschlossen' | 'aktiv' | 'ausstehend';
  eta_min: number | null;
  icon: string;
}

interface TrackingData {
  order_id: string;
  status: 'bestaetigt' | 'zubereitung' | 'abholbereit' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  eta_min_konfidenz: 'hoch' | 'mittel' | 'niedrig';
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_distanz_km: number | null;
  phasen: Phase[];
  fortschritt_pct: number;
}

const MOCK: TrackingData = {
  order_id: 'ord_abc123',
  status: 'unterwegs',
  eta_min: 8,
  eta_min_konfidenz: 'hoch',
  fahrer_name: 'Max M.',
  fahrer_bewertung: 4.8,
  fahrer_distanz_km: 1.3,
  fortschritt_pct: 72,
  phasen: [
    { label: 'Bestätigt', status: 'abgeschlossen', eta_min: null, icon: '✓' },
    { label: 'In Zubereitung', status: 'abgeschlossen', eta_min: null, icon: '👨‍🍳' },
    { label: 'Abholbereit', status: 'abgeschlossen', eta_min: null, icon: '📦' },
    { label: 'Fahrer unterwegs', status: 'aktiv', eta_min: 8, icon: '🚴' },
    { label: 'Geliefert', status: 'ausstehend', eta_min: null, icon: '🏠' },
  ],
};

function konfidenzFarbe(k: TrackingData['eta_min_konfidenz']): string {
  switch (k) {
    case 'hoch': return 'text-green-400';
    case 'mittel': return 'text-amber-400';
    case 'niedrig': return 'text-orange-400';
  }
}

export function Phase2680DynamischeEtaLiveTrackingMaster({ orderId, locationId }: { orderId?: string | null; locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/order/tracking?order_id=${orderId ?? ''}&location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: TrackingData) => setData(d))
        .catch(() => setData(MOCK));
    if (orderId) load(); else setData(MOCK);
    const poll = setInterval(load, 15_000);
    return () => clearInterval(poll);
  }, [orderId, locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 shadow overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Navigation className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Live-Tracking & ETA</span>
          {d.eta_min !== null && (
            <span className="flex items-center gap-1 rounded-full bg-blue-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              <Clock className="h-2.5 w-2.5" />
              ~{d.eta_min} min
            </span>
          )}
          {d.status === 'geliefert' && (
            <span className="flex items-center gap-1 rounded-full bg-green-700 px-2 py-0.5 text-[10px] font-bold text-white">
              <CheckCircle2 className="h-2.5 w-2.5" />Geliefert!
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* ETA Hauptanzeige */}
          {d.eta_min !== null && d.status !== 'geliefert' && (
            <div className="text-center rounded-xl bg-gradient-to-b from-blue-900/40 to-gray-800/60 border border-blue-700/30 px-4 py-4">
              <div className="text-4xl font-black tabular-nums text-white mb-1">{d.eta_min}<span className="text-lg font-medium text-gray-400"> min</span></div>
              <div className="text-[11px] text-gray-400 mb-2">Geschätzte Ankunft</div>
              <div className={`text-[10px] font-semibold ${konfidenzFarbe(d.eta_min_konfidenz)}`}>
                Konfidenz: {d.eta_min_konfidenz === 'hoch' ? 'Sehr genau ✓' : d.eta_min_konfidenz === 'mittel' ? 'Mittel ~' : 'Ungefähr ≈'}
              </div>
            </div>
          )}

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
              <span>Fortschritt</span>
              <span className="text-white font-bold">{d.fortschritt_pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-700"
                style={{ width: `${d.fortschritt_pct}%` }}
              />
            </div>
          </div>

          {/* Phasen-Timeline */}
          <div className="space-y-2">
            {d.phasen.map((phase, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  phase.status === 'abgeschlossen' ? 'bg-green-600' :
                  phase.status === 'aktiv' ? 'bg-blue-600 animate-pulse' :
                  'bg-gray-700'
                }`}>
                  {phase.status === 'abgeschlossen' ? '✓' : phase.icon}
                </div>
                <div className={`flex-1 text-xs font-medium ${
                  phase.status === 'abgeschlossen' ? 'text-gray-400 line-through' :
                  phase.status === 'aktiv' ? 'text-white' :
                  'text-gray-500'
                }`}>
                  {phase.label}
                </div>
                {phase.eta_min !== null && phase.status === 'aktiv' && (
                  <span className="text-[10px] text-blue-400 font-bold shrink-0">{phase.eta_min} min</span>
                )}
                {phase.status === 'abgeschlossen' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Fahrer-Info */}
          {d.fahrer_name && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center shrink-0">
                <Navigation className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">{d.fahrer_name}</div>
                <div className="text-[10px] text-gray-400 flex items-center gap-2">
                  {d.fahrer_bewertung && <span>⭐ {d.fahrer_bewertung.toFixed(1)}</span>}
                  {d.fahrer_distanz_km && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />{d.fahrer_distanz_km.toFixed(1)} km weg
                    </span>
                  )}
                </div>
              </div>
              <Package className="h-4 w-4 text-blue-400 shrink-0" />
            </div>
          )}

          <div className="flex items-center justify-between text-[9px] text-gray-600">
            <Clock className="h-2.5 w-2.5" />
            <span>15-Sek-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
