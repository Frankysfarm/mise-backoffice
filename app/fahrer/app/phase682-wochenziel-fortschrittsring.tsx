'use client';

/**
 * Phase 682 — Wochenziel-Fortschrittsring
 * Wöchentliches Lieferziel (Touren + Einnahmen) mit SVG-Fortschrittsring.
 * Props: driverId, locationId
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

type WochenFortschritt = {
  touren: number;
  stopps: number;
  einnahmen: number;
  kmWoche: number;
  zielTouren: number;
  zielEinnahmen: number;
  tourenPct: number;
  einnahmenPct: number;
  hochrechnungTouren: number;
  hochrechnungEinnahmen: number;
  tagInWoche: number;
  wochenstart: string;
};

const WOCHENTAG = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function ProgressRing({
  pct,
  color,
  size = 72,
  stroke = 7,
  label,
  sub,
}: {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  label: string;
  sub: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-black tabular-nums leading-none">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

export function FahrerPhase682WochenZielFortschrittsring({
  driverId,
  locationId,
}: {
  driverId: string;
  locationId: string;
}) {
  const [data, setData] = useState<WochenFortschritt | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-wochen-ziel?location_id=${locationId}&driver_id=${driverId}`,
          { cache: 'no-store' },
        );
        if (!res.ok || !active) return;
        const json = await res.json() as { ok: boolean; woche?: WochenFortschritt };
        if (json.ok && json.woche) setData(json.woche);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 120_000); // alle 2 Min
    return () => { active = false; clearInterval(id); };
  }, [driverId, locationId]);

  if (loading) return (
    <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground animate-pulse">
      Wochenziel wird geladen…
    </div>
  );

  if (!data) return null;

  const hochrechnungGut = data.hochrechnungTouren >= data.zielTouren;
  const tagLabel = WOCHENTAG[(data.tagInWoche - 1) % 7] ?? 'Mo';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="font-semibold text-sm">Wochenziel</span>
          <span className="text-xs text-muted-foreground">
            Tag {data.tagInWoche}/7 ({tagLabel})
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Fortschrittsringe */}
          <div className="flex items-start justify-around pt-2">
            <ProgressRing
              pct={data.tourenPct}
              color="#22c55e"
              label={`${data.touren} / ${data.zielTouren}`}
              sub="Touren"
            />
            <ProgressRing
              pct={data.einnahmenPct}
              color="#3b82f6"
              label={`${data.einnahmen.toFixed(0)} €`}
              sub={`Ziel: ${data.zielEinnahmen} €`}
            />
          </div>

          {/* Hochrechnung */}
          <div
            className={cn(
              'rounded-lg px-3 py-2 flex items-center gap-2',
              hochrechnungGut
                ? 'bg-matcha-50 dark:bg-matcha-950/20'
                : 'bg-amber-50 dark:bg-amber-950/20',
            )}
          >
            <TrendingUp
              className={cn(
                'h-4 w-4 shrink-0',
                hochrechnungGut ? 'text-matcha-600' : 'text-amber-600',
              )}
            />
            <p
              className={cn(
                'text-xs font-medium',
                hochrechnungGut ? 'text-matcha-700 dark:text-matcha-300' : 'text-amber-700 dark:text-amber-300',
              )}
            >
              {hochrechnungGut
                ? `Auf Kurs! Hochrechnung: ~${data.hochrechnungTouren} Touren diese Woche`
                : `Mehr Touren nötig — Hochrechnung: nur ~${data.hochrechnungTouren} / ${data.zielTouren}`}
            </p>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Touren', value: data.touren.toString() },
              { label: 'km diese Woche', value: `${data.kmWoche} km` },
              { label: 'Einnahmen', value: `${data.einnahmen.toFixed(2)} €` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border bg-muted/30 px-2 py-2 text-center">
                <div className="text-sm font-bold tabular-nums">{value}</div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
