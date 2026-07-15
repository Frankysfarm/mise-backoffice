'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Battery, BatteryLow, BatteryMedium, Coffee, Zap, WifiOff } from 'lucide-react';

/**
 * Phase 1654 — Schicht-Energie-Radar (Fahrer-App)
 *
 * Phase1651-API: /api/delivery/driver/komfort-score-heute
 * Energie-Level (0–100) als Radial-Ring + Empfehlung (Pause/Weiter/Schicht-Ende).
 * isOnline-Guard, 20-Min-Polling.
 */

interface KomfortScore {
  driver_id: string;
  pausen_minuten: number;
  km_gesamt: number;
  tour_anzahl: number;
  komfort_score: number;
  empfehlung: 'pause' | 'weiter' | 'schicht_ende';
  generiert_am: string;
}

interface Props {
  driverId?: string | null;
  isOnline?: boolean;
}

const MOCK: KomfortScore = {
  driver_id: 'local',
  pausen_minuten: 25,
  km_gesamt: 68,
  tour_anzahl: 7,
  komfort_score: 62,
  empfehlung: 'weiter',
  generiert_am: new Date().toISOString(),
};

const EMPFEHLUNG_CFG = {
  weiter: {
    label: 'Gut unterwegs',
    sub: 'Deine Energie ist ausreichend — weiter so!',
    color: 'text-matcha-700 dark:text-matcha-300',
    ring: '#22c55e',
    icon: Zap,
  },
  pause: {
    label: 'Pause empfohlen',
    sub: 'Nimm dir kurz Zeit zum Erholen.',
    color: 'text-amber-700 dark:text-amber-300',
    ring: '#f59e0b',
    icon: Coffee,
  },
  schicht_ende: {
    label: 'Schicht beenden',
    sub: 'Du hast heute genug geleistet.',
    color: 'text-red-700 dark:text-red-300',
    ring: '#ef4444',
    icon: BatteryLow,
  },
};

// Radial SVG ring
function EnergyRing({ score, color }: { score: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg viewBox="0 0 88 88" className="w-24 h-24">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
      <circle
        cx="44" cy="44" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="49" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

export function FahrerPhase1654SchichtEnergieRadar({ driverId, isOnline = true }: Props) {
  const [data, setData] = useState<KomfortScore>(MOCK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/komfort-score-heute?driver_id=${driverId}`);
        if (res.ok) setData(await res.json());
      } catch {
        // keep current
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 20 * 60 * 1000); // 20 Min
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  const cfg = EMPFEHLUNG_CFG[data.empfehlung];
  const Icon = cfg.icon;

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-3 mb-3 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Energie-Radar offline nicht verfügbar</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Battery className="h-3.5 w-3.5" /> Schicht-Energie-Radar
        {loading && <span className="text-[10px] opacity-60">…</span>}
      </div>

      <div className="flex items-center gap-4">
        <EnergyRing score={data.komfort_score} color={cfg.ring} />

        <div className="flex-1 space-y-1.5">
          <div className={cn('text-sm font-bold flex items-center gap-1.5', cfg.color)}>
            <Icon className="h-4 w-4 shrink-0" />
            {cfg.label}
          </div>
          <p className="text-xs text-muted-foreground">{cfg.sub}</p>

          <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground">
            <span>☕ {data.pausen_minuten} min Pause</span>
            <span>🛣 {data.km_gesamt} km</span>
            <span>📦 {data.tour_anzahl} Touren</span>
          </div>
        </div>
      </div>
    </div>
  );
}
