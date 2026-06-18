'use client';

import { useEffect, useState } from 'react';
import { Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type SurgeStatus = {
  isActive: boolean;
  multiplier: number;
};

export function KitchenRushHourBand({ locationId }: { locationId: string | null }) {
  const [surge, setSurge] = useState<SurgeStatus | null>(null);
  const [hour, setHour] = useState(new Date().getHours());

  // Stündlicher Tick für Tageszeit-Prüfung
  useEffect(() => {
    const iv = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Surge-Status alle 2 Minuten laden
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/surge?action=status&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const s = data.status ?? data;
          setSurge({
            isActive: s.isActive ?? s.is_active ?? false,
            multiplier: s.multiplier ?? 1.0,
          });
        }
      } catch { /* ignore */ }
    };

    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const isLunch   = hour >= 11 && hour < 14;
  const isDinner  = hour >= 17 && hour < 20;
  const isRush    = isLunch || isDinner;
  const hasSurge  = surge?.isActive && (surge.multiplier ?? 1) > 1;

  if (!isRush && !hasSurge) return null;

  const label  = isLunch ? 'Mittagsstoßzeit' : isDinner ? 'Abendstoßzeit' : 'Stoßzeit';
  const detail = hasSurge
    ? `Surge ×${surge!.multiplier.toFixed(1)} aktiv — Fahrer-Boni erhöht, höheres Bestellvolumen`
    : 'Erhöhtes Bestellaufkommen — Zubereitungskapazität im Blick behalten';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg px-4 py-2.5 border text-sm',
      hasSurge
        ? 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300'
        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    )}>
      {hasSurge
        ? <Zap className="h-4 w-4 shrink-0 text-orange-500" />
        : <Flame className="h-4 w-4 shrink-0 text-yellow-500" />}
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{label}</span>
        <span className="font-normal opacity-80"> — {detail}</span>
      </div>
      {hasSurge && (
        <span className="shrink-0 text-xs font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
          ×{surge!.multiplier.toFixed(1)}
        </span>
      )}
    </div>
  );
}
