'use client';

/**
 * BestellPaceIndikator — Phase 313
 *
 * Zeigt dem Kunden den aktuellen Betriebsstatus basierend auf
 * dem Health-API (etaMin/etaMax + activeDrivers).
 * Polling 120 s auf /api/delivery/health?location=<id>
 */

import { useEffect, useRef, useState } from 'react';
import { Zap, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HealthData {
  status: 'online' | 'offline' | 'busy';
  etaMin: number | null;
  etaMax: number | null;
  activeDrivers: number;
}

const STATUS_CONFIG = {
  online: {
    icon: CheckCircle2,
    color: 'text-matcha-600',
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    label: 'Schnelle Lieferung',
    sub: 'Wir sind gut unterwegs!',
  },
  busy: {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Normaler Betrieb',
    sub: 'Etwas mehr Bestellungen als sonst.',
  },
  offline: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Erhöhte Wartezeit',
    sub: 'Wir arbeiten auf Hochtouren!',
  },
};

export function BestellPaceIndikator({ locationId }: { locationId: string }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/health?location=${encodeURIComponent(locationId)}`, { cache: 'no-store' });
      if (res.ok) setHealth(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 120_000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!health) return null;

  const cfg = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.online;
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${cfg.bg} ${cfg.border} w-full`}>
      <div className={`shrink-0 ${cfg.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</div>
        <div className="text-xs text-gray-500">{cfg.sub}</div>
      </div>
      {health.etaMin !== null && health.etaMax !== null && (
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-black text-gray-800 tabular-nums">
              {health.etaMin}–{health.etaMax} Min
            </span>
          </div>
          <div className="text-[10px] text-gray-400">Lieferzeit</div>
        </div>
      )}
    </div>
  );
}
