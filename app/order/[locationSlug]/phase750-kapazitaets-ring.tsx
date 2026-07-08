'use client';

import { useCallback, useEffect, useState } from 'react';

interface Props {
  locationId: string | null;
}

interface KapazitaetsDaten {
  auslastung_pct: number;
  status: 'frei' | 'mittel' | 'hoch' | 'voll';
  wartezeit_min: number;
}

const MOCK: KapazitaetsDaten = { auslastung_pct: 55, status: 'mittel', wartezeit_min: 25 };

function ringFarbe(s: KapazitaetsDaten['status']) {
  switch (s) {
    case 'frei': return { stroke: '#22c55e', text: 'text-emerald-600 dark:text-emerald-400', label: 'Freie Küche' };
    case 'mittel': return { stroke: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', label: 'Mittlere Auslastung' };
    case 'hoch': return { stroke: '#f97316', text: 'text-orange-600 dark:text-orange-400', label: 'Hohe Auslastung' };
    case 'voll': return { stroke: '#ef4444', text: 'text-red-600 dark:text-red-400', label: 'Voll ausgelastet' };
  }
}

export function Phase750KapazitaetsRing({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetsDaten | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.auslastung_pct === 'number') {
          const pct: number = json.auslastung_pct;
          const status: KapazitaetsDaten['status'] = pct >= 90 ? 'voll' : pct >= 75 ? 'hoch' : pct >= 50 ? 'mittel' : 'frei';
          setData({ auslastung_pct: pct, status, wartezeit_min: json.wartezeit_min ?? 25 });
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 90_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data) return null;

  const { stroke, text, label } = ringFarbe(data.status);
  const R = 28;
  const CIRC = 2 * Math.PI * R;
  const filled = (data.auslastung_pct / 100) * CIRC;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
        <circle
          cx="32" cy="32" r={R}
          fill="none" stroke={stroke} strokeWidth="5"
          strokeDasharray={`${filled} ${CIRC - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="bold" fill={stroke}>
          {data.auslastung_pct}%
        </text>
      </svg>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${text}`}>{label}</p>
        <p className="text-xs text-muted-foreground">ca. {data.wartezeit_min} Min Wartezeit</p>
      </div>
    </div>
  );
}
