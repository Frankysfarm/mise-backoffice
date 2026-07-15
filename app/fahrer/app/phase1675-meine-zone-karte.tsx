'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

/**
 * Phase 1675 — Meine-Zone-Karte (Fahrer-App)
 *
 * Aktuelle Zone (A/B/C/D) + ETA-Benchmark + Anzahl Fahrer in gleicher Zone.
 * isOnline-Guard. 15-Min-Polling via Phase1672-API.
 */

type ZoneLabel = 'A' | 'B' | 'C' | 'D';

interface ZoneInfo {
  zone: ZoneLabel;
  fahrer_aktiv: number;
  fahrer_kapazitaet: number;
  auslastung_pct: number;
  ampel: 'niedrig' | 'normal' | 'voll';
  eta_benchmark_min: number;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  locationId?: string | null;
  currentZone?: ZoneLabel | null;
}

const ZONE_COLOR: Record<ZoneLabel, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300' },
  B: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300' },
  C: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300' },
  D: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300' },
};

const AMPEL_LABEL: Record<string, string> = {
  niedrig: 'Geringe Auslastung',
  normal: 'Normale Auslastung',
  voll: 'Zone ausgelastet',
};

const POLL_MS = 15 * 60 * 1000;

export function FahrerPhase1675MeineZoneKarte({ driverId, isOnline, locationId, currentZone }: Props) {
  const [zone, setZone] = useState<ZoneInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const lid = locationId ?? 'all';
      const r = await fetch(`/api/delivery/admin/zonen-kapazitaet?location_id=${encodeURIComponent(lid)}`);
      if (!r.ok) return;
      const data = await r.json();
      const targetZone: ZoneLabel = currentZone ?? 'A';
      const found = (data.zonen ?? []).find((z: ZoneInfo) => z.zone === targetZone);
      if (found) setZone(found);
      else if (data.zonen?.length) setZone(data.zonen[0]);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [driverId, isOnline, locationId, currentZone]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!isOnline) return null;

  const z = zone;
  const colors = z ? ZONE_COLOR[z.zone] : null;

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2 shadow-sm transition-colors',
      colors ? `${colors.bg} ${colors.border}` : 'bg-card border-border',
    )}>
      <div className="flex items-center gap-2">
        <MapPin className={cn('h-4 w-4 shrink-0', colors ? colors.text : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider">Meine Zone</span>
        {loading && (
          <span className="ml-auto text-[9px] text-muted-foreground animate-pulse">Lädt…</span>
        )}
      </div>

      {!z && !loading && (
        <p className="text-xs text-muted-foreground">Zone wird ermittelt…</p>
      )}

      {z && (
        <>
          {/* Zone-Badge groß */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl font-black',
              colors ? `${colors.text} bg-white/60 dark:bg-black/20 border ${colors.border}` : '',
            )}>
              {z.zone}
            </div>
            <div className="space-y-0.5">
              <div className={cn('text-sm font-bold', colors?.text)}>
                Zone {z.zone}
              </div>
              <div className="text-[10px] text-muted-foreground">
                ETA-Benchmark: ~{z.eta_benchmark_min} Min
              </div>
              <div className="text-[10px] text-muted-foreground">
                {z.fahrer_aktiv} von {z.fahrer_kapazitaet} Fahrern aktiv
              </div>
            </div>
          </div>

          {/* Auslastungs-Balken */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{AMPEL_LABEL[z.ampel]}</span>
              <span className="font-bold">{z.auslastung_pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  z.ampel === 'voll' ? 'bg-red-500' : z.ampel === 'normal' ? 'bg-emerald-500' : 'bg-sky-400',
                )}
                style={{ width: `${Math.min(100, z.auslastung_pct)}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
