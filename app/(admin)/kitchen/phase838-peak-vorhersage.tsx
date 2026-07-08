'use client';

import { useEffect, useState } from 'react';
import { Zap, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface PeakSlot {
  stunde: number;
  label: string;
  anteil: number; // Anteil dieser Stunde am Tagesvolumen
}

interface PeakData {
  naechster_peak: PeakSlot | null;
  aktuelle_stunde_anteil: number;
  bis_peak_min: number | null;
  ampel: 'gruen' | 'amber' | 'rot';
  generatedAt: string;
}

const MOCK: PeakData = {
  naechster_peak: { stunde: 18, label: '18:00–19:00', anteil: 22 },
  aktuelle_stunde_anteil: 8,
  bis_peak_min: 90,
  ampel: 'amber',
  generatedAt: new Date().toISOString(),
};

export function KitchenPhase838PeakVorhersage({ locationId }: Props) {
  const [data, setData] = useState<PeakData | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/peak-vorhersage?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 600_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const { naechster_peak, bis_peak_min, ampel } = data;

  const ampelConfig = {
    gruen:  { bg: 'bg-matcha-50',  border: 'border-matcha-200',  dot: 'bg-matcha-500',  text: 'text-matcha-700',  label: 'Ruhig' },
    amber:  { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Bald Peak' },
    rot:    { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     text: 'text-red-700',     label: 'Peak jetzt!' },
  }[ampel];

  const formatCountdown = (min: number | null) => {
    if (min == null) return '—';
    if (min < 1) return 'Jetzt';
    if (min < 60) return `in ${min} Min`;
    return `in ${Math.floor(min / 60)}h ${min % 60}m`;
  };

  return (
    <div className={`rounded-2xl border ${ampelConfig.border} ${ampelConfig.bg}`}>
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${ampelConfig.bg}`}>
          <span className={`absolute inline-flex h-full w-full rounded-full ${ampelConfig.dot} opacity-30 ${ampel === 'rot' ? 'animate-ping' : ''}`} />
          <Zap className={`h-4 w-4 ${ampelConfig.text} relative`} />
        </div>
        <div className="flex-1">
          <div className={`text-sm font-bold ${ampelConfig.text}`}>Peak-Vorhersage</div>
          <div className="text-xs text-stone-500">
            {ampelConfig.label}
            {naechster_peak ? ` · ${naechster_peak.label}` : ''}
          </div>
        </div>
        {bis_peak_min != null && (
          <div className="text-right">
            <div className={`text-lg font-black tabular-nums ${ampelConfig.text}`}>
              {formatCountdown(bis_peak_min)}
            </div>
            <div className="text-[10px] text-stone-400 flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" /> bis Peak
            </div>
          </div>
        )}
      </div>
      {naechster_peak && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${ampelConfig.dot}`}
                style={{ width: `${Math.min(100, naechster_peak.anteil * 3)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold tabular-nums ${ampelConfig.text}`}>
              {naechster_peak.anteil}% Bestellvolumen
            </span>
          </div>
          <div className="text-[10px] text-stone-400 mt-1">
            Basiert auf Wochentag-Stunden-Muster · aktuell {data.aktuelle_stunde_anteil}%
          </div>
        </div>
      )}
    </div>
  );
}
