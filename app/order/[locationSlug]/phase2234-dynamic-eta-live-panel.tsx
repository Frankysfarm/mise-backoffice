'use client';

import { useEffect, useState } from 'react';

interface EtaData {
  eta_minutes: number;
  confidence_pct: number;
  phase: 'kueche' | 'unterwegs' | 'fast_da' | 'geliefert';
  phase_label: string;
  driver_name: string | null;
  updated_at: string;
}

interface Props {
  orderId: string;
  locationId: string;
  className?: string;
}

const PHASES = [
  { key: 'kueche', label: '🍳 Küche', desc: 'Wird zubereitet' },
  { key: 'unterwegs', label: '🚴 Unterwegs', desc: 'Fahrer auf dem Weg' },
  { key: 'fast_da', label: '📍 Fast da', desc: 'In deiner Nähe' },
  { key: 'geliefert', label: '✅ Geliefert', desc: 'Angekommen' },
] as const;

function phaseIndex(phase: string): number {
  return PHASES.findIndex((p) => p.key === phase);
}

export function StorefrontPhase2234DynamicEtaLivePanel({ orderId, locationId, className = '' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<EtaData | null>(null);
  const [secs, setSecs] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !orderId) return;

    async function laden() {
      try {
        const res = await fetch(`/api/delivery/eta?order_id=${orderId}&location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.eta_minutes !== undefined) {
            setData({
              eta_minutes: json.eta_minutes ?? 30,
              confidence_pct: json.confidence_pct ?? json.confidence ?? 75,
              phase: json.phase ?? 'kueche',
              phase_label: json.phase_label ?? 'Wird vorbereitet',
              driver_name: json.driver_name ?? null,
              updated_at: new Date().toISOString(),
            });
            setSecs((json.eta_minutes ?? 30) * 60);
          }
        }
      } catch {
        // noop
      }
    }

    laden();
    const poll = setInterval(laden, 30_000);
    return () => clearInterval(poll);
  }, [mounted, orderId, locationId]);

  // Countdown timer
  useEffect(() => {
    if (!data || data.phase === 'geliefert') return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1_000);
    return () => clearInterval(id);
  }, [data]);

  if (!mounted || !data) return null;
  if (data.phase === 'geliefert') return null;

  const mins = Math.floor(secs / 60);
  const sec = secs % 60;
  const pIdx = phaseIndex(data.phase);
  const conf = Math.min(100, Math.max(0, data.confidence_pct));
  const confColor = conf >= 80 ? '#22c55e' : conf >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`rounded-2xl overflow-hidden shadow-lg ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-700 to-matcha-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-matcha-200 uppercase tracking-wider">
              Dynamische ETA · Live
            </div>
            <div className="text-2xl font-black text-white tabular-nums mt-0.5">
              {mins}:{sec.toString().padStart(2, '0')} Min
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-matcha-200">Konfidenz</div>
            <div className="text-lg font-bold" style={{ color: confColor }}>{conf}%</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${conf}%`, backgroundColor: confColor }}
          />
        </div>
      </div>

      {/* Phase progress */}
      <div className="bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-center justify-between">
          {PHASES.map((p, i) => (
            <div key={p.key} className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${
                i < pIdx
                  ? 'bg-matcha-500 text-white'
                  : i === pIdx
                  ? 'bg-matcha-600 text-white ring-2 ring-matcha-300 ring-offset-1 scale-110'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {i < pIdx ? '✓' : p.label.split(' ')[0]}
              </div>
              <span className={`text-[9px] font-medium text-center leading-tight max-w-[44px] ${
                i === pIdx ? 'text-matcha-700 dark:text-matcha-300' : 'text-gray-400'
              }`}>
                {p.label.split(' ').slice(1).join(' ')}
              </span>
            </div>
          ))}
        </div>

        {/* Connector line */}
        <div className="relative mt-1">
          <div className="absolute inset-y-0 left-3.5 right-3.5 flex items-center">
            <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-700 -z-10" />
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{data.phase_label}</p>
          {data.driver_name && (
            <p className="text-[10px] text-gray-400 mt-0.5">🚴 {data.driver_name}</p>
          )}
        </div>
      </div>
    </div>
  );
}
