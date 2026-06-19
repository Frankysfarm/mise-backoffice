'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId?: string | null;
}

interface Slot {
  hour: number;
  label: string;
  predicted: number;
  drivers: number;
  level: 'ok' | 'tight' | 'understaffed';
}

function computeLevel(predicted: number, drivers: number): 'ok' | 'tight' | 'understaffed' {
  const capacity = drivers * 4;
  if (capacity === 0) return 'understaffed';
  const load = predicted / capacity;
  if (load <= 0.75) return 'ok';
  if (load <= 1.0) return 'tight';
  return 'understaffed';
}

const LEVEL_STYLES = {
  ok:           'bg-green-50 text-green-800 border border-green-200',
  tight:        'bg-amber-50 text-amber-800 border border-amber-200',
  understaffed: 'bg-red-50   text-red-800   border border-red-200',
};

function buildSlots(predicted_per_hour: number[] | null): Slot[] {
  const now = new Date();
  const base = now.getHours();
  return Array.from({ length: 8 }, (_, i) => {
    const hour = (base + i) % 24;
    const label = `${String(hour).padStart(2, '0')}:00`;
    // Use prediction or a sine-based mock weighted around meal times
    const predicted = predicted_per_hour
      ? (predicted_per_hour[hour] ?? 0)
      : Math.max(1, Math.round(6 + 4 * Math.sin(((hour - 12) * Math.PI) / 8)));
    // Recommended drivers: ceil(predicted / 4), minimum 1
    const drivers = Math.max(1, Math.ceil(predicted / 4));
    return { hour, label, predicted, drivers, level: computeLevel(predicted, drivers) };
  });
}

export function PersonalPlanungMatrix({ locationId }: Props) {
  const [slots, setSlots] = useState<Slot[]>(() => buildSlots(null));
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/surge?location=${encodeURIComponent(locationId)}&window=60`);
      if (res.ok) {
        const data = await res.json() as { predicted_per_hour?: number[] };
        setSlots(buildSlots(data.predicted_per_hour ?? null));
        setLastRefresh(new Date());
      }
    } catch {
      // keep current slots
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const understaffed = slots.filter((s) => s.level === 'understaffed').length;
  const tight = slots.filter((s) => s.level === 'tight').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-matcha-600" />
          <h3 className="text-sm font-semibold text-gray-800">Personalplanung — nächste 8 Stunden</h3>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          aria-label="Aktualisieren"
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Aktualisiert: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        {!locationId && ' · Beispieldaten (kein Standort)'}
      </p>

      {(understaffed > 0 || tight > 0) && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {understaffed > 0 && `${understaffed} Stunde${understaffed !== 1 ? 'n' : ''} unterbesetzt`}
          {understaffed > 0 && tight > 0 && ' · '}
          {tight > 0 && `${tight} Stunde${tight !== 1 ? 'n' : ''} knapp`}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => (
          <div key={slot.hour} className={cn('rounded-xl p-2.5 text-center text-xs', LEVEL_STYLES[slot.level])}>
            <p className="font-bold text-[11px]">{slot.label}</p>
            <p className="mt-1 opacity-75">{slot.predicted} Bestell.</p>
            <p className="mt-0.5 font-semibold">{slot.drivers} Fahrer</p>
            {slot.level === 'understaffed' && (
              <p className="mt-1 text-red-700 font-bold text-[10px]">
                +{Math.max(0, Math.ceil(slot.predicted / 4) - slot.drivers)} fehlen
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-200 inline-block" />
          Ausreichend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 inline-block" />
          Knapp
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-200 inline-block" />
          Unterbesetzt
        </span>
      </div>
    </div>
  );
}
