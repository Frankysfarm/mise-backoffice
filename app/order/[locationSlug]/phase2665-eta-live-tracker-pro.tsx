'use client';
import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Package } from 'lucide-react';

interface Props {
  orderId?: string | null;
  locationId?: string;
  initialEtaMin?: number;
  bestellnummer?: string;
  orderedAt?: string;
}

type Step = 'bestaetigt' | 'zubereitung' | 'unterwegs' | 'geliefert';

interface EtaData {
  current_step: Step;
  eta_min: number | null;
  driver_name?: string;
  driver_eta_min?: number;
  steps_done: Step[];
}

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'bestaetigt',  label: 'Bestätigt',   icon: CheckCircle2 },
  { key: 'zubereitung', label: 'In der Küche', icon: ChefHat      },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: Bike         },
  { key: 'geliefert',   label: 'Geliefert',    icon: Package      },
];

const STEP_ORDER: Step[] = ['bestaetigt', 'zubereitung', 'unterwegs', 'geliefert'];

function stepIndex(s: Step): number {
  return STEP_ORDER.indexOf(s);
}

export function Phase2665EtaLiveTrackerPro({ orderId, locationId, initialEtaMin = 35, bestellnummer, orderedAt }: Props) {
  const [data, setData] = useState<EtaData>({
    current_step: 'bestaetigt',
    eta_min: initialEtaMin,
    steps_done: ['bestaetigt'],
  });
  const [elapsed, setElapsed] = useState(0);

  // Count seconds since order
  useEffect(() => {
    const start = orderedAt ? new Date(orderedAt).getTime() : Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [orderedAt]);

  // Poll for status
  useEffect(() => {
    if (!orderId || !locationId) return;
    const load = () =>
      fetch(`/api/delivery/tracking?order_id=${orderId}&location_id=${locationId}`)
        .then(r => r.json())
        .then((d: EtaData) => setData(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 30 * 1000);
    return () => clearInterval(t);
  }, [orderId, locationId]);

  const currentIdx = stepIndex(data.current_step);
  const eta        = data.eta_min != null ? Math.max(0, data.eta_min - Math.floor(elapsed / 60)) : null;
  const progress   = Math.min(((currentIdx + 0.5) / STEPS.length) * 100, 100);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-800">
            Deine Bestellung {bestellnummer ? `#${bestellnummer}` : ''}
          </div>
          <div className="text-xs text-gray-500">Live-Tracking</div>
        </div>
        {eta != null && (
          <div className="text-right">
            <div className="text-2xl font-black text-indigo-600">{eta}</div>
            <div className="text-[10px] text-gray-500">Min. bis Lieferung</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-1.5 h-1.5 bg-white rounded-full shadow animate-pulse" style={{ marginLeft: `${progress}%`, transform: 'translateX(-50%)' }} />
        </div>
      </div>

      {/* Steps */}
      <div className="flex justify-between">
        {STEPS.map((step, i) => {
          const done    = currentIdx > i || data.steps_done.includes(step.key);
          const current = currentIdx === i;
          const Icon    = step.icon;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                done    ? 'bg-indigo-600 text-white' :
                current ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-400' :
                          'bg-gray-100 text-gray-400'
              }`}>
                <Icon size={14} />
              </div>
              <span className={`text-[9px] text-center leading-tight ${
                done || current ? 'text-indigo-600 font-medium' : 'text-gray-400'
              }`}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Driver info */}
      {data.driver_name && data.current_step === 'unterwegs' && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 p-2">
          <div className="w-7 h-7 rounded-full bg-indigo-200 flex items-center justify-center">
            <Bike size={14} className="text-indigo-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-800">{data.driver_name}</div>
            {data.driver_eta_min != null && (
              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                <MapPin size={9} /> ca. {data.driver_eta_min} Min bis zu dir
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-indigo-600 font-medium">
            <Clock size={10} />
            <span className="animate-pulse">live</span>
          </div>
        </div>
      )}

      {data.current_step === 'geliefert' && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 p-3">
          <CheckCircle2 size={20} className="text-green-600" />
          <span className="text-sm font-bold text-green-700">Geliefert! Guten Hunger 🍽️</span>
        </div>
      )}
    </div>
  );
}
