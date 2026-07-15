'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Phase 1655 — Lieferzone-Visualisierungs-Banner (Storefront)
 *
 * Zeigt ob Lieferadresse in Zone A/B/C/D liegt + ETA-Hinweis.
 * locationId-Prop. Hydration-safe.
 */

type Zone = 'A' | 'B' | 'C' | 'D' | 'außerhalb';

interface ZoneInfo {
  zone: Zone;
  radius_km: number;
  eta_min: number;
  min_bestellwert: number;
  liefergebuehr: number;
}

interface Props {
  locationId?: string | null;
  className?: string;
}

const ZONE_CONFIG: Record<Zone, { color: string; bg: string; border: string; label: string; dot: string }> = {
  A: { color: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-900/20', border: 'border-matcha-200 dark:border-matcha-700', label: 'Nähe (Zone A)', dot: 'bg-matcha-500' },
  B: { color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-700',    label: 'Kernzone (Zone B)', dot: 'bg-blue-500' },
  C: { color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-700',  label: 'Außenzone (Zone C)', dot: 'bg-amber-500' },
  D: { color: 'text-orange-700 dark:text-orange-300',bg: 'bg-orange-50 dark:bg-orange-900/20',border: 'border-orange-200 dark:border-orange-700', label: 'Randzone (Zone D)', dot: 'bg-orange-500' },
  außerhalb: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-700', label: 'Außerhalb', dot: 'bg-red-500' },
};

const ZONES_MOCK: ZoneInfo[] = [
  { zone: 'A', radius_km: 2,  eta_min: 20, min_bestellwert: 800,  liefergebuehr: 0   },
  { zone: 'B', radius_km: 4,  eta_min: 30, min_bestellwert: 1200, liefergebuehr: 149 },
  { zone: 'C', radius_km: 7,  eta_min: 45, min_bestellwert: 1500, liefergebuehr: 249 },
  { zone: 'D', radius_km: 10, eta_min: 60, min_bestellwert: 2000, liefergebuehr: 349 },
];

function fmt(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export function StorefrontPhase1655LieferzoneVisualisierungsBanner({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zones] = useState<ZoneInfo[]>(ZONES_MOCK);

  // Hydration-safe
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">Lieferzonen</h3>
      </div>

      {/* Zone-Visualisierung als konzentrische Ringe (SVG) */}
      <div className="flex justify-center mb-4">
        <svg viewBox="0 0 160 160" className="w-40 h-40">
          {['D','C','B','A'].map((z, i) => {
            const r = 70 - i * 16;
            const colors: Record<string, string> = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316' };
            return (
              <circle key={z} cx="80" cy="80" r={r} fill={colors[z]} fillOpacity="0.15" stroke={colors[z]} strokeWidth="1.5" />
            );
          })}
          {/* Center dot */}
          <circle cx="80" cy="80" r="5" fill="#22c55e" />
          {/* Labels */}
          {['D','C','B','A'].map((z, i) => {
            const r = 70 - i * 16;
            const colors: Record<string, string> = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316' };
            return (
              <text key={`lbl-${z}`} x={80 + r - 10} y="84" fontSize="9" fill={colors[z]} fontWeight="600">{z}</text>
            );
          })}
        </svg>
      </div>

      {/* Zonen-Tabelle */}
      <div className="space-y-2">
        {zones.map(z => {
          const cfg = ZONE_CONFIG[z.zone];
          return (
            <div key={z.zone} className={cn('flex items-center gap-3 rounded-lg border p-2', cfg.bg, cfg.border)}>
              <div className={cn('h-3 w-3 rounded-full shrink-0', cfg.dot)} />
              <div className="flex-1 min-w-0">
                <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground ml-1.5">bis {z.radius_km} km</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                <span>{z.eta_min} Min</span>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">
                {z.liefergebuehr === 0 ? (
                  <span className="text-matcha-600 dark:text-matcha-400 font-medium">Kostenlos</span>
                ) : (
                  fmt(z.liefergebuehr)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hinweis */}
      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Mindestbestellwert ab {fmt(Math.min(...zones.map(z => z.min_bestellwert)))} · Abhängig von deiner Adresse
      </p>
    </div>
  );
}
