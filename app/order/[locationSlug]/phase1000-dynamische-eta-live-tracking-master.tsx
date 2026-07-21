'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation2, Package, Truck } from 'lucide-react';

type Phase = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackData {
  phase: Phase;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_lat: number | null;
  fahrer_lng: number | null;
  ziel_lat: number | null;
  ziel_lng: number | null;
  distanz_km: number | null;
  bestellt_am: string;
  versprochen_bis: string | null;
}

const MOCK: TrackData = {
  phase: 'unterwegs',
  eta_min: 8,
  fahrer_name: 'Max M.',
  fahrer_lat: 52.52,
  fahrer_lng: 13.40,
  ziel_lat: 52.53,
  ziel_lng: 13.41,
  distanz_km: 1.4,
  bestellt_am: new Date(Date.now() - 22 * 60000).toISOString(),
  versprochen_bis: new Date(Date.now() + 8 * 60000).toISOString(),
};

const PHASE_ORDER: Phase[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

const PHASE_LABEL: Record<Phase, string> = {
  bestätigt:      'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig:         'Fertig',
  unterwegs:      'Unterwegs',
  geliefert:      'Geliefert ✓',
};

const PHASE_ICON: Record<Phase, React.ReactNode> = {
  bestätigt:      <CheckCircle2 size={14} />,
  in_zubereitung: <Package size={14} />,
  fertig:         <CheckCircle2 size={14} />,
  unterwegs:      <Truck size={14} />,
  geliefert:      <CheckCircle2 size={14} />,
};

function phasePct(phase: Phase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return Math.round(((idx + 1) / PHASE_ORDER.length) * 100);
}

export function Phase1000DynamischeEtaLiveTrackingMaster({
  orderId,
  initialData,
}: {
  orderId?: string;
  initialData?: Partial<TrackData>;
}) {
  const [data,    setData]    = useState<TrackData>({ ...MOCK, ...initialData });
  const [now,     setNow]     = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => {
      if (!orderId) return;
      fetch(`/api/delivery/tracking/live?order_id=${orderId}`)
        .then(r => r.json())
        .then((d: TrackData) => setData(d))
        .catch(() => {});
    };
    load();
    const poll = setInterval(load, 30 * 1000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); if (tickRef.current) clearInterval(tickRef.current); };
  }, [orderId]);

  const pct = phasePct(data.phase);
  const isGeliefert = data.phase === 'geliefert';

  // Countdown zur ETA
  let countdown: string | null = null;
  if (data.versprochen_bis && !isGeliefert) {
    const remMs = new Date(data.versprochen_bis).getTime() - now;
    const remMin = Math.ceil(remMs / 60000);
    if (remMin > 0) {
      countdown = `${remMin} Min`;
    } else {
      countdown = 'Jeden Moment';
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${isGeliefert ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation2 size={16} className={isGeliefert ? 'text-green-600' : 'text-blue-600'} />
          <span className="text-sm font-bold text-gray-900">Live-Tracking</span>
        </div>
        {countdown && (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            <Clock size={12} />
            {countdown}
          </span>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="relative mb-4">
        {/* Linie */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-blue-500 transition-all duration-700"
          style={{ width: `calc(${pct}% - 2rem)` }}
        />
        <div className="relative flex justify-between">
          {PHASE_ORDER.map(ph => {
            const done    = PHASE_ORDER.indexOf(ph) <= PHASE_ORDER.indexOf(data.phase);
            const current = ph === data.phase;
            return (
              <div key={ph} className="flex flex-col items-center gap-1">
                <div className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  current ? 'border-blue-500 bg-blue-500 text-white scale-110' :
                  done    ? 'border-green-500 bg-green-500 text-white' :
                            'border-gray-300 bg-white text-gray-400'
                }`}>
                  {PHASE_ICON[ph]}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight max-w-[48px] ${
                  current ? 'text-blue-700 font-bold' : done ? 'text-green-700' : 'text-gray-400'
                }`}>
                  {PHASE_LABEL[ph]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && !isGeliefert && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Truck size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-800">{data.fahrer_name}</div>
            {data.distanz_km !== null && (
              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                <MapPin size={10} />
                Noch {data.distanz_km.toFixed(1)} km entfernt
              </div>
            )}
          </div>
          {data.eta_min !== null && (
            <div className="text-center">
              <div className="text-lg font-black text-blue-700 tabular-nums">{data.eta_min}</div>
              <div className="text-[9px] text-gray-500">Min</div>
            </div>
          )}
        </div>
      )}

      {isGeliefert && (
        <div className="text-center py-2">
          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-1" />
          <p className="text-sm font-bold text-green-700">Erfolgreich geliefert!</p>
          <p className="text-[11px] text-gray-500">Guten Appetit!</p>
        </div>
      )}

      {/* ETA-Zeitfenster */}
      {data.versprochen_bis && !isGeliefert && (
        <div className="mt-2 text-center text-[10px] text-gray-400">
          Voraussichtlich bis{' '}
          <span className="font-semibold text-gray-700">
            {new Date(data.versprochen_bis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>{' '}
          Uhr
        </div>
      )}
    </div>
  );
}
