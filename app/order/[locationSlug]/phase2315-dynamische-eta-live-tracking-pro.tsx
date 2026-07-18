'use client';
import { useEffect, useState } from 'react';
import { Clock, Truck, MapPin, CheckCircle2, ChefHat, Package, Navigation } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackingData {
  status: OrderStatus;
  eta_earliest: string | null;
  eta_latest: string | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  delivery_address: string | null;
  prep_progress_pct: number | null;
}

interface Props {
  orderId: string;
  initialStatus: OrderStatus;
  initialEta?: string | null;
}

const STATUS_STEPS: { key: OrderStatus; label: string; icon: any }[] = [
  { key: 'bestätigt', label: 'Bestätigt', icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'fertig', label: 'Bereit', icon: Package },
  { key: 'unterwegs', label: 'Unterwegs', icon: Truck },
  { key: 'geliefert', label: 'Geliefert', icon: MapPin },
];

const STATUS_ORDER: OrderStatus[] = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function stepIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function etaCountdown(etaStr: string | null): string {
  if (!etaStr) return '—';
  const diff = Math.floor((new Date(etaStr).getTime() - Date.now()) / 60000);
  if (diff <= 0) return 'Gleich!';
  return `~${diff} min`;
}

function formatEta(earliest: string | null, latest: string | null): string {
  if (!earliest && !latest) return '—';
  const fmt = (s: string) => new Date(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (earliest && latest) return `${fmt(earliest)} – ${fmt(latest)}`;
  return fmt(earliest ?? latest!);
}

export function Phase2315DynamischeEtaLiveTrackingPro({ orderId, initialStatus, initialEta }: Props) {
  const [data, setData] = useState<TrackingData>({
    status: initialStatus,
    eta_earliest: initialEta ?? null,
    eta_latest: null,
    driver_name: null,
    driver_lat: null,
    driver_lng: null,
    delivery_address: null,
    prep_progress_pct: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/tracking/${orderId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(prev => ({ ...prev, ...d })))
        .catch(() => null);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [orderId]);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const currentStep = stepIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const countdown = etaCountdown(data.eta_earliest);

  return (
    <div className="rounded-2xl bg-white border border-matcha-100 shadow-sm overflow-hidden">
      {/* ETA Header */}
      <div className={`px-5 py-4 ${isDelivered ? 'bg-green-600' : 'bg-matcha-800'} text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">
              {isDelivered ? 'Geliefert' : 'Voraussichtliche Lieferzeit'}
            </div>
            <div className="text-3xl font-black tabular-nums">
              {isDelivered ? '✓' : countdown}
            </div>
            {!isDelivered && data.eta_earliest && (
              <div className="text-sm opacity-70 mt-0.5">
                {formatEta(data.eta_earliest, data.eta_latest)}
              </div>
            )}
          </div>
          {!isDelivered && (
            <div className="text-right">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold">Live</span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic ETA update indicator */}
        {!isDelivered && (
          <div className="mt-2 text-[11px] opacity-60">
            ETA wird alle 15 Sek. aktualisiert
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="px-5 py-4">
        <div className="relative">
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100">
            <div
              className="h-0.5 bg-matcha-600 transition-all duration-700"
              style={{ width: `${Math.max(0, ((currentStep - 1) / (STATUS_STEPS.length - 1)) * 100)}%` }}
            />
          </div>
          <div className="relative flex justify-between">
            {STATUS_STEPS.map((step, i) => {
              const stepIdx = stepIndex(step.key);
              const done = currentStep >= stepIdx;
              const active = currentStep === stepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1.5" style={{ zIndex: 1 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${done ? 'bg-matcha-700 shadow-md' : 'bg-gray-100'}
                    ${active ? 'ring-2 ring-matcha-400 ring-offset-1' : ''}`}
                  >
                    <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-[10px] font-semibold text-center leading-tight
                    ${done ? 'text-matcha-700' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prep Progress Bar (in_zubereitung phase) */}
        {data.status === 'in_zubereitung' && data.prep_progress_pct != null && (
          <div className="mt-5">
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span className="flex items-center gap-1">
                <ChefHat className="w-3 h-3" /> Zubereitung läuft
              </span>
              <span>{data.prep_progress_pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-orange-400 rounded-full transition-all duration-700"
                style={{ width: `${data.prep_progress_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Driver Info (unterwegs phase) */}
        {data.status === 'unterwegs' && data.driver_name && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <Truck className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-blue-800">Dein Fahrer</div>
              <div className="text-sm font-bold text-blue-900">{data.driver_name}</div>
              {data.delivery_address && (
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-blue-600">
                  <Navigation className="w-3 h-3" />
                  <span className="truncate">{data.delivery_address}</span>
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-black text-blue-700 tabular-nums">{countdown}</div>
              <div className="text-[10px] text-blue-500">verbleibend</div>
            </div>
          </div>
        )}

        {/* Delivered confirmation */}
        {isDelivered && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
            <div>
              <div className="text-sm font-bold text-green-800">Bestellung geliefert!</div>
              <div className="text-xs text-green-600 mt-0.5">Guten Appetit 🎉</div>
            </div>
          </div>
        )}

        {/* Live update dot */}
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-1.5 h-1.5 rounded-full bg-matcha-500 animate-pulse" />
          <span className="text-[10px] text-gray-400">Live-Tracking aktiv</span>
        </div>
      </div>
    </div>
  );
}
