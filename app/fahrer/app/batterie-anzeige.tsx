'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BatteryLow, BatteryMedium, BatteryFull, BatteryCharging, Zap } from 'lucide-react';

type BatteryState = {
  level: number;       // 0–1
  charging: boolean;
};

export function FahrerBatterieAnzeige() {
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [powerSave, setPowerSave] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & { getBattery?: () => Promise<any> };
    if (!nav.getBattery) return;

    let manager: any = null;

    nav.getBattery().then((bm) => {
      manager = bm;
      const update = () =>
        setBattery({ level: bm.level, charging: bm.charging });
      update();
      bm.addEventListener('levelchange', update);
      bm.addEventListener('chargingchange', update);
    }).catch(() => {});

    return () => {
      if (manager) {
        const noop = () => {};
        manager.removeEventListener?.('levelchange', noop);
        manager.removeEventListener?.('chargingchange', noop);
      }
    };
  }, []);

  if (!battery || battery.level > 0.35 || dismissed) return null;

  const pct = Math.round(battery.level * 100);
  const isCritical = pct <= 15 && !battery.charging;

  const BattIcon = battery.charging
    ? BatteryCharging
    : pct <= 15
    ? BatteryLow
    : pct <= 50
    ? BatteryMedium
    : BatteryFull;

  return (
    <div
      className={cn(
        'mx-4 mb-3 rounded-xl border px-4 py-3 flex items-center gap-3',
        isCritical
          ? 'border-red-500/50 bg-red-950/70 animate-pulse'
          : 'border-amber-500/40 bg-amber-950/60',
      )}
    >
      <BattIcon
        className={cn(
          'h-5 w-5 shrink-0',
          isCritical ? 'text-red-400' : 'text-amber-400',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-sm font-bold',
          isCritical ? 'text-red-200' : 'text-amber-200',
        )}>
          {battery.charging
            ? `Lädt… ${pct}%`
            : isCritical
            ? `Akku kritisch: ${pct}% — bald laden!`
            : `Akku niedrig: ${pct}%`}
        </div>
        {!battery.charging && (
          <div className="text-[10px] text-amber-400 mt-0.5">
            {powerSave
              ? 'Strom-Sparmodus aktiv — GPS reduziert'
              : 'Strom-Sparmodus empfohlen'}
          </div>
        )}
      </div>

      {/* Power save toggle */}
      {!battery.charging && (
        <button
          onClick={() => setPowerSave((v) => !v)}
          className={cn(
            'shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-black transition',
            powerSave
              ? 'bg-matcha-600 text-white'
              : 'bg-amber-600/80 text-white',
          )}
        >
          <Zap className="h-3 w-3" />
          {powerSave ? 'An' : 'Sparmodus'}
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-600 hover:text-amber-300 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
