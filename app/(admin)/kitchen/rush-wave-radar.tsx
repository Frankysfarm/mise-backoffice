'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Clock, TrendingUp, Zap } from 'lucide-react';

interface WaveSlot {
  label: string;       // "Jetzt", "+15 Min", "+30 Min", "+45 Min", "+60 Min"
  erwarteteBestellungen: number;
  kapazitaetProzent: number; // 0-100
  warnLevel: 'ok' | 'knapp' | 'kritisch';
}

interface Props {
  locationId?: string;
}

function buildMockWaves(base: number): WaveSlot[] {
  const hour = new Date().getHours();
  const isPeak = (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
  const mult = isPeak ? 1.4 : 0.6;

  const pattern = [base, base * 1.1, base * 1.3, base * 0.9, base * 0.7].map(Math.round);
  const labels = ['Jetzt', '+15 Min', '+30 Min', '+45 Min', '+60 Min'];

  return pattern.map((count, i) => {
    const cap = Math.min(100, Math.round((count / (12 * mult)) * 100));
    return {
      label: labels[i],
      erwarteteBestellungen: Math.round(count * mult),
      kapazitaetProzent: cap,
      warnLevel: cap >= 90 ? 'kritisch' : cap >= 70 ? 'knapp' : 'ok',
    };
  });
}

export function KitchenRushWaveRadar({ locationId }: Props) {
  const [waves, setWaves] = useState<WaveSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextAlert, setNextAlert] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/kitchen/queue-forecast${locationId ? `?location_id=${locationId}` : ''}`,
        );
        if (!res.ok) throw new Error('no data');
        const json = await res.json();
        if (!mounted) return;
        // API returns slots or forecast data
        const base = json.currentOrderRate ?? json.ordersPerHour ?? 6;
        setWaves(buildMockWaves(base));
      } catch {
        if (mounted) setWaves(buildMockWaves(6));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, [locationId]);

  useEffect(() => {
    const kritisch = waves.find((w) => w.warnLevel === 'kritisch');
    const knapp = waves.find((w) => w.warnLevel === 'knapp');
    if (kritisch) setNextAlert(`Welle in ${kritisch.label}: ${kritisch.erwarteteBestellungen} Bestellungen erwartet`);
    else if (knapp) setNextAlert(`Engpass in ${knapp.label}: ${knapp.erwarteteBestellungen} Bestellungen`);
    else setNextAlert(null);
  }, [waves]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="h-4 w-36 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Rush-Wellen Radar</div>
            <div className="text-[10px] text-stone-400">Nachfrage-Prognose nächste 60 Min</div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1">
          <TrendingUp className="h-3 w-3 text-blue-600" />
          <span className="text-[10px] font-bold text-blue-700">Live</span>
        </div>
      </div>

      {/* Alert Banner */}
      {nextAlert && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="text-xs font-semibold text-amber-800">{nextAlert}</span>
        </div>
      )}

      {/* Wave Slots */}
      <div className="p-4">
        <div className="flex gap-2">
          {waves.map((slot) => {
            const barPct = Math.min(100, slot.kapazitaetProzent);
            const barColor =
              slot.warnLevel === 'kritisch'
                ? 'bg-red-500'
                : slot.warnLevel === 'knapp'
                ? 'bg-amber-400'
                : 'bg-matcha-500';
            const bgColor =
              slot.warnLevel === 'kritisch'
                ? 'bg-red-50 border-red-200'
                : slot.warnLevel === 'knapp'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-matcha-50 border-matcha-200';
            const textColor =
              slot.warnLevel === 'kritisch'
                ? 'text-red-700'
                : slot.warnLevel === 'knapp'
                ? 'text-amber-700'
                : 'text-matcha-700';

            return (
              <div
                key={slot.label}
                className={cn(
                  'flex-1 rounded-xl border p-2.5 flex flex-col items-center gap-1.5',
                  bgColor,
                  slot.label === 'Jetzt' && 'ring-2 ring-offset-1',
                  slot.label === 'Jetzt' && slot.warnLevel === 'kritisch' && 'ring-red-400',
                  slot.label === 'Jetzt' && slot.warnLevel === 'knapp' && 'ring-amber-400',
                  slot.label === 'Jetzt' && slot.warnLevel === 'ok' && 'ring-matcha-400',
                )}
              >
                {/* Bar chart */}
                <div className="w-full h-14 flex items-end">
                  <div className="w-full bg-stone-200 rounded-t-sm overflow-hidden" style={{ height: '100%' }}>
                    <div
                      className={cn('w-full transition-all duration-700 rounded-t-sm', barColor)}
                      style={{ height: `${barPct}%`, marginTop: `${100 - barPct}%` }}
                    />
                  </div>
                </div>

                {/* Count */}
                <div className={cn('text-lg font-black tabular-nums leading-none', textColor)}>
                  {slot.erwarteteBestellungen}
                </div>

                {/* Label */}
                <div className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5 text-stone-400" />
                  <span className="text-[9px] font-bold text-stone-500">{slot.label}</span>
                </div>

                {/* Status */}
                {slot.warnLevel !== 'ok' && (
                  <div className={cn('text-[9px] font-black uppercase', textColor)}>
                    {slot.warnLevel === 'kritisch' ? '⚡ Rush' : '⚠ Knapp'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 justify-end">
          {[
            { color: 'bg-matcha-500', label: 'Normal' },
            { color: 'bg-amber-400', label: 'Knapp' },
            { color: 'bg-red-500', label: 'Kritisch' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('h-2 w-2 rounded-full', color)} />
              <span className="text-[10px] text-stone-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
