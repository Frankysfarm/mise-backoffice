'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  customerId?: string | null;
}

interface TreueData {
  punkte: number;
  naechster_meilenstein: number;
  praemie: string;
  stufe: 'bronze' | 'silber' | 'gold' | 'platin';
  pct: number;
}

const STUFE_STYLE = {
  bronze: { bg: 'bg-amber-50',   border: 'border-amber-200', bar: 'bg-amber-400',   icon: '🥉', label: 'Bronze' },
  silber: { bg: 'bg-gray-50',    border: 'border-gray-200',  bar: 'bg-gray-400',    icon: '🥈', label: 'Silber' },
  gold:   { bg: 'bg-yellow-50',  border: 'border-yellow-200', bar: 'bg-yellow-400', icon: '🥇', label: 'Gold' },
  platin: { bg: 'bg-indigo-50',  border: 'border-indigo-200', bar: 'bg-indigo-500', icon: '💎', label: 'Platin' },
};

const MEILENSTEINE = [
  { punkte: 50,  stufe: 'bronze' as const, praemie: '5 % Rabatt' },
  { punkte: 150, stufe: 'silber' as const, praemie: 'Gratis Lieferung' },
  { punkte: 300, stufe: 'gold'   as const, praemie: '10 % Rabatt' },
  { punkte: 600, stufe: 'platin' as const, praemie: 'VIP-Prämie 20 €' },
];

const CACHE_KEY = 'mise_treue_data_v1';
const CACHE_TTL_MS = 5 * 60_000;

function loadCache(locationId: string): TreueData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${locationId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: TreueData; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(locationId: string, data: TreueData) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${locationId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

function buildFromPoints(punkte: number): TreueData {
  const naechster = MEILENSTEINE.find((m) => m.punkte > punkte);
  if (!naechster) {
    return { punkte, naechster_meilenstein: MEILENSTEINE[MEILENSTEINE.length - 1].punkte, praemie: MEILENSTEINE[MEILENSTEINE.length - 1].praemie, stufe: 'platin', pct: 100 };
  }
  const prev = MEILENSTEINE.filter((m) => m.punkte <= punkte).pop();
  const from = prev?.punkte ?? 0;
  const pct = Math.min(100, Math.round(((punkte - from) / (naechster.punkte - from)) * 100));
  const stufe: TreueData['stufe'] = prev?.stufe ?? 'bronze';
  return { punkte, naechster_meilenstein: naechster.punkte, praemie: naechster.praemie, stufe, pct };
}

export function StorefrontPhase1591TreueprogrammFortschrittsWidget({ locationId, customerId }: Props) {
  const [data, setData] = useState<TreueData | null>(null);
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const cached = loadCache(locationId);
    if (cached) { setData(cached); return; }

    async function load() {
      try {
        const url = customerId
          ? `/api/delivery/loyalty/points?customer_id=${customerId}&location_id=${locationId}`
          : `/api/delivery/loyalty/points?location_id=${locationId}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const punkte = json.points ?? json.punkte ?? 75;
          const built = buildFromPoints(punkte);
          setData(built);
          saveCache(locationId, built);
        } else {
          const fallback = buildFromPoints(75);
          setData(fallback);
          saveCache(locationId, fallback);
        }
      } catch {
        const fallback = buildFromPoints(75);
        setData(fallback);
      }
    }

    load();
  }, [mounted, locationId, customerId]);

  if (!mounted || !open || !data) return null;

  const style = STUFE_STYLE[data.stufe as keyof typeof STUFE_STYLE];
  const remaining = data.naechster_meilenstein - data.punkte;

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} overflow-hidden mb-4 shadow-sm`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-inherit">
        <span className="text-base">{style.icon}</span>
        <span className="text-sm font-bold text-gray-800 flex-1">Treueprogramm · {style.label}</span>
        <span className="text-xs font-bold text-gray-500">{data.punkte} Punkte</span>
        <button onClick={() => setOpen(false)} className="text-lg leading-none text-gray-400 hover:text-gray-600">×</button>
      </div>

      <div className="px-4 py-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">Nächste Prämie: <span className="font-semibold text-gray-800">{data.praemie}</span></span>
          <span className="text-gray-400">Noch <span className="font-bold text-gray-700">{remaining}</span> Punkte</span>
        </div>

        <div className="h-3 bg-white rounded-full border border-gray-200 overflow-hidden">
          <div
            className={`h-full ${style.bar} rounded-full transition-all duration-700`}
            style={{ width: `${data.pct}%` }}
          />
        </div>

        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>{data.punkte} / {data.naechster_meilenstein}</span>
          <span>{data.pct} %</span>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {MEILENSTEINE.map((m) => {
            const reached = data.punkte >= m.punkte;
            const ms = STUFE_STYLE[m.stufe as keyof typeof STUFE_STYLE];
            return (
              <div
                key={m.punkte}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 border text-xs transition-all ${reached ? `${ms.bg} ${ms.border} font-semibold` : 'bg-gray-50 border-gray-100 opacity-50'}`}
              >
                <span>{ms.icon}</span>
                <span className="font-bold">{m.punkte} P</span>
                <span className="text-gray-500">{m.praemie}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
