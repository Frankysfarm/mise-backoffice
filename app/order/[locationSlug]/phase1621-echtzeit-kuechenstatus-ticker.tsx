'use client';

import React, { useEffect, useState } from 'react';

const CACHE_KEY_PREFIX = 'mise_kuechen_status_';
const CACHE_TTL_MS = 2 * 60 * 1000;

interface KuechenStatus {
  in_zubereitung: number;
  auslastung: 'ruhig' | 'normal' | 'hochtouren' | 'ueberlastet';
}

interface CacheEntry {
  data: KuechenStatus;
  ts: number;
}

function loadCache(locationId: string): KuechenStatus | null {
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

function saveCache(locationId: string, data: KuechenStatus) {
  try {
    const entry: CacheEntry = { data, ts: Date.now() };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${locationId}`, JSON.stringify(entry));
  } catch {
    // storage full — ignore
  }
}

const AUSLASTUNG_META: Record<KuechenStatus['auslastung'], { label: string; bg: string; text: string; border: string; dot: string }> = {
  ruhig:       { label: 'läuft ruhig',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  normal:      { label: 'läuft normal',          bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  hochtouren:  { label: 'läuft auf Hochtouren',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  ueberlastet: { label: 'unter Hochdruck',        bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
};

const MOCK: KuechenStatus = { in_zubereitung: 7, auslastung: 'hochtouren' };

interface Props {
  locationId: string;
}

export function StorefrontPhase1621EchtzeitKuechenstatusTicker({ locationId }: Props) {
  const [status, setStatus] = useState<KuechenStatus | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cached = loadCache(locationId);
    if (cached) {
      setStatus(cached);
      return;
    }
    fetch(`/api/delivery/public/kuechen-status?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: KuechenStatus) => {
        saveCache(locationId, d);
        setStatus(d);
      })
      .catch(() => {
        saveCache(locationId, MOCK);
        setStatus(MOCK);
      });
  }, [locationId]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      fetch(`/api/delivery/public/kuechen-status?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d: KuechenStatus) => {
          saveCache(locationId, d);
          setStatus(d);
        })
        .catch(() => {});
    }, CACHE_TTL_MS);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !status) return null;

  const m = AUSLASTUNG_META[status.auslastung];

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-semibold ${m.bg} ${m.border} ${m.text}`}>
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 animate-pulse ${m.dot}`} />
      <span>
        {status.in_zubereitung > 0 ? (
          <>{status.in_zubereitung} Bestellung{status.in_zubereitung !== 1 ? 'en' : ''} in Zubereitung · Küche {m.label}</>
        ) : (
          <>Küche {m.label}</>
        )}
      </span>
    </div>
  );
}
