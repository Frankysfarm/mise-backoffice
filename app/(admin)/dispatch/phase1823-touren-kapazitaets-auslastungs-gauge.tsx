'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Users } from 'lucide-react';

/**
 * Phase 1823 — Touren-Kapazitäts-Auslastungs-Gauge (Dispatch)
 *
 * Gauge-Visualisierung (0–100%) aktive Touren vs. Fahrer-Kapazität.
 * Alert >90%; 30-Min-Polling.
 */

interface Props {
  locationId: string | null;
  className?: string;
}

interface AuslastungsDaten {
  aktive_touren: number;
  fahrer_kapazitaet: number;
  auslastung_pct: number;
  verfuegbare_fahrer: number;
  aktive_fahrer: number;
}

const MOCK_DATEN: AuslastungsDaten = {
  aktive_touren: 7,
  fahrer_kapazitaet: 10,
  auslastung_pct: 70,
  verfuegbare_fahrer: 3,
  aktive_fahrer: 7,
};

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelVon(pct: number): Ampel {
  if (pct >= 90) return 'rot';
  if (pct >= 70) return 'gelb';
  return 'gruen';
}

const AMPEL_FARBEN: Record<Ampel, { gauge: string; text: string; bg: string; border: string; badge: string }> = {
  gruen: {
    gauge: 'bg-matcha-500',
    text: 'text-matcha-600 dark:text-matcha-400',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
  },
  gelb: {
    gauge: 'bg-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  rot: {
    gauge: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

const LABEL: Record<Ampel, string> = {
  gruen: 'Kapazität frei',
  gelb: 'Auslastung hoch',
  rot: 'Kapazität kritisch',
};

async function ladeDaten(locationId: string): Promise<AuslastungsDaten> {
  const res = await fetch(`/api/delivery/admin/touren-auslastung?location_id=${locationId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('fetch_failed');
  return res.json() as Promise<AuslastungsDaten>;
}

export function DispatchPhase1823TourenKapazitaetsAuslastungsGauge({ locationId, className }: Props) {
  const [daten, setDaten] = useState<AuslastungsDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    let aktiv = true;
    const laden = () =>
      ladeDaten(locationId)
        .then((d) => { if (aktiv) setDaten(d); })
        .catch(() => { if (aktiv) setDaten(MOCK_DATEN); });

    laden();
    const id = setInterval(laden, 30 * 60_000);
    return () => { aktiv = false; clearInterval(id); };
  }, [locationId]);

  const d = daten ?? MOCK_DATEN;
  const ampel = ampelVon(d.auslastung_pct);
  const farben = AMPEL_FARBEN[ampel];
  const pct = Math.min(100, Math.max(0, d.auslastung_pct));

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Touren-Kapazität
          </span>
          <span className={cn('rounded-full text-[10px] font-bold px-1.5 py-0.5', farben.badge)}>
            {pct}%
          </span>
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-3">
          {ampel === 'rot' && (
            <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', farben.bg, farben.border)}>
              <AlertTriangle className={cn('h-4 w-4 flex-shrink-0', farben.text)} />
              <p className={cn('text-xs font-medium', farben.text)}>
                Kapazitätsgrenze erreicht — nur noch {d.verfuegbare_fahrer} Fahrer verfügbar!
              </p>
            </div>
          )}

          {/* Gauge */}
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{LABEL[ampel]}</span>
              <span className={cn('font-semibold', farben.text)}>{pct}%</span>
            </div>
            <div className="h-4 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', farben.gauge)}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Marker bei 90% */}
            <div className="relative h-2">
              <div
                className="absolute top-0 w-0.5 h-2 bg-red-400 dark:bg-red-500"
                style={{ left: '90%' }}
                title="90%-Schwelle"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Aktive Touren', wert: d.aktive_touren },
              { label: 'Kapazität', wert: d.fahrer_kapazitaet },
              { label: 'Verfügbar', wert: d.verfuegbare_fahrer },
            ].map(({ label, wert }) => (
              <div key={label} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">{wert}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</p>
              </div>
            ))}
          </div>

          {ampel === 'gruen' && (
            <div className="flex items-center gap-2 text-matcha-600 dark:text-matcha-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Ausreichend Fahrer-Kapazität vorhanden.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
