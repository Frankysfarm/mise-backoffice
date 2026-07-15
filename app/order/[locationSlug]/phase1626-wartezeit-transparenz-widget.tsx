'use client';

import React, { useEffect, useState } from 'react';

const CACHE_KEY_PREFIX = 'mise_wartezeit_transparenz_';
const CACHE_TTL_MS = 60 * 1000;

type BestellStatus = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';

interface WartezeitData {
  eta_min: number;
  status: BestellStatus;
  kuechen_auslastung: 'ruhig' | 'normal' | 'hochtouren';
  verbleibend_min: number;
}

interface CacheEntry {
  data: WartezeitData;
  ts: number;
}

function loadCache(locationId: string): WartezeitData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${locationId}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function saveCache(locationId: string, data: WartezeitData) {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${locationId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // storage full
  }
}

const MOCK: WartezeitData = {
  eta_min: 28,
  status: 'zubereitung',
  kuechen_auslastung: 'normal',
  verbleibend_min: 28,
};

const STEPS: { key: BestellStatus; label: string }[] = [
  { key: 'bestellt',    label: 'Bestellt'    },
  { key: 'zubereitung', label: 'Zubereitung' },
  { key: 'unterwegs',   label: 'Unterwegs'   },
  { key: 'geliefert',   label: 'Geliefert'   },
];

const STATUS_ORDER: Record<BestellStatus, number> = {
  bestellt: 0, zubereitung: 1, unterwegs: 2, geliefert: 3,
};

const AUSLASTUNG_META = {
  ruhig:      { text: 'Küche ruhig',          color: 'text-emerald-600' },
  normal:     { text: 'Küche läuft normal',   color: 'text-blue-600'    },
  hochtouren: { text: 'Küche auf Hochtouren', color: 'text-amber-600'   },
};

interface Props {
  locationId: string;
}

export function StorefrontPhase1626WartezeitTransparenzWidget({ locationId }: Props) {
  const [data, setData] = useState<WartezeitData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cached = loadCache(locationId);
    if (cached) {
      setData(cached);
      return;
    }
    fetch(`/api/delivery/public/wartezeit-transparenz?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: WartezeitData) => {
        saveCache(locationId, d);
        setData(d);
      })
      .catch(() => {
        saveCache(locationId, MOCK);
        setData(MOCK);
      });
  }, [locationId]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      fetch(`/api/delivery/public/wartezeit-transparenz?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((d: WartezeitData) => {
          saveCache(locationId, d);
          setData(d);
        })
        .catch(() => {});
    }, CACHE_TTL_MS);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !data) return null;

  const currentIdx = STATUS_ORDER[data.status];
  const progressPct = Math.round((currentIdx / (STEPS.length - 1)) * 100);
  const auslMeta = AUSLASTUNG_META[data.kuechen_auslastung];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header: ETA */}
      <div className="flex items-center gap-3 px-4 py-3 bg-stone-800 text-white">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Lieferzeit</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums">{data.eta_min}</span>
            <span className="text-sm font-medium opacity-80">Min</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-70">{auslMeta.text}</div>
          {data.verbleibend_min > 0 && data.status !== 'geliefert' && (
            <div className="text-sm font-bold">noch ~{data.verbleibend_min} Min</div>
          )}
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-4 py-3">
        {/* Step-Punkte */}
        <div className="relative flex items-center justify-between mb-2">
          {/* Verbindungslinie */}
          <div className="absolute left-0 right-0 top-3 h-0.5 bg-stone-100" />
          <div
            className="absolute left-0 top-3 h-0.5 bg-stone-800 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
          {STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step.key} className="relative flex flex-col items-center" style={{ width: '25%' }}>
                <div className={`
                  z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center text-[9px] font-black transition-all duration-500
                  ${done
                    ? active
                      ? 'border-stone-800 bg-stone-800 text-white ring-2 ring-stone-800 ring-offset-1'
                      : 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 bg-white text-stone-400'}
                `}>
                  {done && !active ? '✓' : i + 1}
                </div>
                <div className={`mt-1.5 text-[9px] font-semibold text-center leading-tight ${done ? 'text-stone-700' : 'text-stone-400'}`}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Küchenstatus */}
        <div className={`mt-3 text-[10px] font-semibold ${auslMeta.color} text-center`}>
          {auslMeta.text}
        </div>
      </div>
    </div>
  );
}
