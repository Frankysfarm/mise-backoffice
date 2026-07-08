'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Package, ChefHat, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

type DeliveryPhase =
  | 'bestätigt'
  | 'zubereitung'
  | 'bereit'
  | 'unterwegs'
  | 'zugestellt';

interface EtaData {
  phase: DeliveryPhase;
  eta_min: number | null;
  eta_text: string | null;
  fahrer_name: string | null;
  fahrer_lat?: number | null;
  fahrer_lng?: number | null;
  zubereitung_start?: string | null;
  abgeholt_am?: string | null;
  geliefert_am?: string | null;
}

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
}

const PHASES: { key: DeliveryPhase; label: string; icon: React.ReactNode; sublabel: string }[] = [
  {
    key: 'bestätigt',
    label: 'Bestätigt',
    icon: <CheckCircle2 className="h-4 w-4" />,
    sublabel: 'Deine Bestellung wurde angenommen',
  },
  {
    key: 'zubereitung',
    label: 'In Zubereitung',
    icon: <ChefHat className="h-4 w-4" />,
    sublabel: 'Die Küche bereitet dein Essen zu',
  },
  {
    key: 'bereit',
    label: 'Bereit zur Abholung',
    icon: <Package className="h-4 w-4" />,
    sublabel: 'Dein Fahrer holt die Bestellung ab',
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs zu dir',
    icon: <Bike className="h-4 w-4" />,
    sublabel: 'Dein Fahrer ist auf dem Weg',
  },
  {
    key: 'zugestellt',
    label: 'Zugestellt',
    icon: <CheckCircle2 className="h-4 w-4" />,
    sublabel: 'Guten Appetit!',
  },
];

const PHASE_ORDER: DeliveryPhase[] = ['bestätigt', 'zubereitung', 'bereit', 'unterwegs', 'zugestellt'];

function phaseIndex(p: DeliveryPhase): number {
  return PHASE_ORDER.indexOf(p);
}

export function Phase785DynamischeEtaLive({ orderId, initialEtaMin }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/tracking/${orderId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (active && json) {
          const phase: DeliveryPhase =
            json.status === 'zugestellt' || json.status === 'delivered' ? 'zugestellt'
            : json.status === 'unterwegs' || json.status === 'on_route' ? 'unterwegs'
            : json.status === 'bereit' || json.status === 'ready' ? 'bereit'
            : json.status === 'in_zubereitung' || json.status === 'preparing' || json.status === 'confirmed' ? 'zubereitung'
            : 'bestätigt';

          setData({
            phase,
            eta_min: json.eta_min ?? initialEtaMin ?? null,
            eta_text: json.eta_text ?? null,
            fahrer_name: json.fahrer_name ?? json.driver_name ?? null,
            zubereitung_start: json.zubereitung_start ?? null,
            abgeholt_am: json.abgeholt_am ?? null,
            geliefert_am: json.geliefert_am ?? null,
          });
        }
      } catch {
        // On error: keep showing existing data
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => { active = false; clearInterval(iv); };
  }, [orderId, initialEtaMin]);

  // Tick every second for elapsed time display
  useEffect(() => {
    const t = setInterval(() => setElapsedSec((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-stone-100 rounded" />
        <div className="h-2 bg-stone-100 rounded" />
        <div className="h-16 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  const phase = data?.phase ?? 'bestätigt';
  const currentIdx = phaseIndex(phase);
  const etaMin = data?.eta_min;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* ETA header */}
      <div className="px-5 py-4 bg-gradient-to-br from-matcha-600 to-matcha-700 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-matcha-200 uppercase tracking-wide">
              {phase === 'zugestellt' ? 'Bestellung zugestellt 🎉' : 'Geschätzte Lieferzeit'}
            </div>
            {phase !== 'zugestellt' && etaMin != null && (
              <div className="text-3xl font-black tabular-nums mt-0.5">
                {Math.max(1, Math.round(etaMin))} Min
              </div>
            )}
            {phase === 'zugestellt' && (
              <div className="text-2xl font-black mt-0.5">Guten Appetit! 🍽️</div>
            )}
            {etaMin == null && phase !== 'zugestellt' && (
              <div className="text-2xl font-black mt-0.5">Bald…</div>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-matcha-200">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">Live-Status</span>
            </div>
            {data?.fahrer_name && phase === 'unterwegs' && (
              <div className="mt-1 flex items-center gap-1 text-matcha-100">
                <Bike className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">{data.fahrer_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase progress */}
      <div className="px-5 py-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-stone-100" />
          <div
            className="absolute left-[18px] top-4 w-0.5 bg-matcha-400 transition-all duration-700"
            style={{
              height: `${Math.min(currentIdx / (PHASES.length - 1), 1) * 100}%`,
            }}
          />

          <div className="space-y-4 relative">
            {PHASES.map((p, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const future = idx > currentIdx;

              return (
                <div key={p.key} className="flex items-start gap-3">
                  {/* Dot */}
                  <div className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    done
                      ? 'bg-matcha-500 border-matcha-500 text-white'
                      : active
                      ? 'bg-white border-matcha-500 text-matcha-600 shadow-md shadow-matcha-200'
                      : 'bg-white border-stone-200 text-stone-300',
                  )}>
                    {p.icon}
                    {active && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-matcha-500" />
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <div className={cn(
                    'flex-1 pt-1.5',
                    future ? 'opacity-40' : '',
                  )}>
                    <div className={cn(
                      'text-sm font-bold leading-none',
                      active ? 'text-stone-900' : done ? 'text-matcha-600' : 'text-stone-400',
                    )}>
                      {p.label}
                    </div>
                    {(active || done) && (
                      <div className="text-xs text-stone-400 mt-0.5 leading-snug">
                        {p.sublabel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      {phase !== 'zugestellt' && (
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-stone-400 shrink-0" />
            <span className="text-[11px] text-stone-400">
              Live-Updates alle 30 Sekunden · Kein Reload nötig
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
