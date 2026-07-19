'use client';
import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Bike, AlertTriangle, Flame } from 'lucide-react';

type BestellStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'on_way'
  | 'delivered';

interface EtaData {
  order_id: string;
  order_number: string;
  status: BestellStatus;
  eta_min: number | null;
  eta_updated_at: string | null;
  fahrer_name: string | null;
  fahrer_entfernung_m: number | null;
  kuechen_fertig_in_min: number | null;
  lieferadresse: string;
  delay_reason: string | null;
  confidence_pct: number;
}

const STATUS_STEPS: BestellStatus[] = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_way', 'delivered'];

const STATUS_LABELS: Record<BestellStatus, string> = {
  placed: 'Aufgenommen',
  confirmed: 'Bestätigt',
  preparing: 'In Zubereitung',
  ready: 'Bereit',
  picked_up: 'Abgeholt',
  on_way: 'Unterwegs',
  delivered: 'Geliefert',
};

const STATUS_ICONS: Record<BestellStatus, React.ReactNode> = {
  placed: <Clock size={14} />,
  confirmed: <CheckCircle2 size={14} />,
  preparing: <Flame size={14} />,
  ready: <CheckCircle2 size={14} />,
  picked_up: <Bike size={14} />,
  on_way: <Bike size={14} />,
  delivered: <CheckCircle2 size={14} />,
};

function stepIndex(s: BestellStatus) {
  return STATUS_STEPS.indexOf(s);
}

function confidenceColor(pct: number) {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-500';
}

const MOCK: EtaData = {
  order_id: 'mock_1',
  order_number: '#4711',
  status: 'on_way',
  eta_min: 12,
  eta_updated_at: new Date().toISOString(),
  fahrer_name: 'Mehmet K.',
  fahrer_entfernung_m: 1800,
  kuechen_fertig_in_min: null,
  lieferadresse: 'Hauptstr. 42, 10115 Berlin',
  delay_reason: null,
  confidence_pct: 87,
};

export function StorefrontPhase2375DynamischeEtaLiveTrackingBoard({ orderId }: { orderId?: string | null }) {
  const [data, setData] = useState<EtaData | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    if (!orderId) {
      setData(MOCK);
      return;
    }
    try {
      const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
      if (r.ok) {
        const json = await r.json();
        setData(json.order ?? json);
        setError(false);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <div className="animate-pulse text-stone-400 text-sm">Lade Tracking…</div>
      </div>
    );
  }

  const currentStep = stepIndex(data.status);
  const isDelivered = data.status === 'delivered';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`px-5 py-4 ${isDelivered ? 'bg-emerald-50' : 'bg-stone-50'} border-b border-stone-100`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-stone-500 mb-0.5">Bestellung {data.order_number}</div>
            <div className={`text-lg font-black ${isDelivered ? 'text-emerald-700' : 'text-stone-900'}`}>
              {isDelivered ? 'Geliefert!' : data.eta_min != null ? `Noch ${data.eta_min} Min` : STATUS_LABELS[data.status]}
            </div>
            {data.eta_min != null && !isDelivered && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs font-semibold ${confidenceColor(data.confidence_pct)}`}>
                  {data.confidence_pct}% Konfidenz
                </span>
              </div>
            )}
          </div>
          <div className={`rounded-full p-2.5 ${isDelivered ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
            {STATUS_ICONS[data.status]}
          </div>
        </div>
      </div>

      {/* Delay Alert */}
      {data.delay_reason && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          <AlertTriangle size={12} className="shrink-0" />
          {data.delay_reason}
        </div>
      )}

      {/* ETA Bar */}
      {data.eta_min != null && !isDelivered && (
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
            <span>Jetzt</span>
            <span className="font-semibold text-stone-700">{data.eta_min} Min</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-500 transition-all duration-700"
              style={{ width: `${Math.max(8, Math.min(95, ((30 - data.eta_min) / 30) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="px-5 py-4">
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-stone-200" />
          <div className="space-y-3">
            {STATUS_STEPS.filter(s => s !== 'ready').map(step => {
              const idx = stepIndex(step);
              const done = idx < currentStep;
              const active = idx === currentStep;

              if (!done && !active && idx > currentStep + 2) return null;

              return (
                <div key={step} className="flex items-center gap-3 relative">
                  <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    done ? 'bg-emerald-500 text-white' :
                    active ? 'bg-blue-500 text-white ring-4 ring-blue-100' :
                    'bg-white border-2 border-stone-200 text-stone-400'
                  }`}>
                    {done ? <CheckCircle2 size={14} /> : STATUS_ICONS[step]}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-stone-400'}`}>
                      {STATUS_LABELS[step]}
                    </div>
                    {active && data.kuechen_fertig_in_min != null && step === 'preparing' && (
                      <div className="text-xs text-stone-500">Fertig in ~{data.kuechen_fertig_in_min} Min</div>
                    )}
                    {active && data.fahrer_name && (step === 'on_way' || step === 'picked_up') && (
                      <div className="text-xs text-stone-500">
                        {data.fahrer_name}
                        {data.fahrer_entfernung_m != null && (
                          <> · {data.fahrer_entfernung_m >= 1000
                            ? `${(data.fahrer_entfernung_m / 1000).toFixed(1)} km entfernt`
                            : `${data.fahrer_entfernung_m} m entfernt`
                          }</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lieferadresse */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-stone-100 text-xs text-stone-500">
        <MapPin size={12} className="text-stone-400 shrink-0" />
        <span className="truncate">{data.lieferadresse}</span>
      </div>
    </div>
  );
}
