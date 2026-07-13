'use client';

// Phase 1273 — Fahrer-Geo-Verteilungs-Monitor (Dispatch)
// Live-Anzeige wie gut Fahrer geografisch verteilt sind (Zone-Coverage-Score) + Lücken-Alert
// Props: locationId · 30s-Polling · nutzt /api/delivery/admin/fahrer-geo-verteilung

import { useEffect, useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneVerteilung {
  zone: string;
  fahrer: number;
  erwartete_auslastung: 'hoch' | 'mittel' | 'gering';
  luecke: boolean;
}

interface GeoVerteilungData {
  coverage_score: number;
  fahrer_gesamt: number;
  zonen_abgedeckt: number;
  zonen_gesamt: number;
  zonen: ZoneVerteilung[];
  luecken: string[];
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const MOCK: GeoVerteilungData = {
  coverage_score: 72,
  fahrer_gesamt: 6,
  zonen_abgedeckt: 3,
  zonen_gesamt: 4,
  zonen: [
    { zone: 'Mitte', fahrer: 3, erwartete_auslastung: 'hoch', luecke: false },
    { zone: 'Nord',  fahrer: 2, erwartete_auslastung: 'mittel', luecke: false },
    { zone: 'West',  fahrer: 1, erwartete_auslastung: 'mittel', luecke: false },
    { zone: 'Süd',   fahrer: 0, erwartete_auslastung: 'hoch', luecke: true },
  ],
  luecken: ['Süd'],
  generiert_am: new Date().toISOString(),
};

function scoreFarbe(score: number): { ring: string; text: string; bg: string; label: string } {
  if (score >= 85) return { ring: 'stroke-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  label: 'Optimal' };
  if (score >= 60) return { ring: 'stroke-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50',  label: 'Ausbaubar' };
  return               { ring: 'stroke-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    label: 'Lückenhaft' };
}

export function DispatchPhase1273FahrerGeoVerteilungsMonitor({ locationId }: Props) {
  const [data, setData] = useState<GeoVerteilungData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-geo-verteilung?location_id=${locationId}`);
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const d = data ?? MOCK;
  const { ring, text, bg, label } = scoreFarbe(d.coverage_score);
  const eskaliert = d.luecken.length > 0;

  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (d.coverage_score / 100) * circ;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', eskaliert ? 'border-red-200 dark:border-red-800' : 'border-stone-200 dark:border-stone-700', 'bg-white dark:bg-stone-900')}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-500 to-violet-600"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <MapPin className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-white">Fahrer-Geo-Verteilung</div>
          <div className="text-[11px] text-white/80">
            {d.zonen_abgedeckt}/{d.zonen_gesamt} Zonen · Score {d.coverage_score}%
            {eskaliert && ` · ${d.luecken.length} Lücke${d.luecken.length > 1 ? 'n' : ''}`}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Score-Ring + KPIs */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <svg width="72" height="72" className="-rotate-90">
                <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="7" className="stroke-stone-100 dark:stroke-stone-700" />
                <circle
                  cx="36" cy="36" r={radius} fill="none" strokeWidth="7"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeLinecap="round"
                  className={ring}
                />
              </svg>
              <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-black', text)}>
                {d.coverage_score}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div className={cn('rounded-xl p-2 text-center', bg)}>
                <div className={cn('text-lg font-black tabular-nums', text)}>{d.fahrer_gesamt}</div>
                <div className="text-[9px] font-semibold text-stone-500">Fahrer</div>
              </div>
              <div className={cn('rounded-xl p-2 text-center', bg)}>
                <div className={cn('text-lg font-black tabular-nums', text)}>{label}</div>
                <div className="text-[9px] font-semibold text-stone-500">Status</div>
              </div>
            </div>
          </div>

          {/* Lücken-Alert */}
          {eskaliert && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-red-700 dark:text-red-300">Lücken erkannt</div>
                <div className="text-[11px] text-red-600 dark:text-red-400">Keine Fahrer in: {d.luecken.join(', ')}</div>
              </div>
            </div>
          )}

          {/* Zonen-Liste */}
          <div className="space-y-1.5">
            {d.zonen.map(z => {
              const auslStyle = z.erwartete_auslastung === 'hoch' ? 'text-red-600' : z.erwartete_auslastung === 'mittel' ? 'text-amber-600' : 'text-green-600';
              return (
                <div key={z.zone} className={cn('flex items-center gap-2 rounded-lg px-3 py-2', z.luecke ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800' : 'bg-stone-50 dark:bg-stone-800')}>
                  {z.luecke
                    ? <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    : <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  }
                  <span className="text-xs font-semibold text-char dark:text-stone-200 flex-1">{z.zone}</span>
                  <span className={cn('text-[11px] font-bold', auslStyle)}>{z.erwartete_auslastung}</span>
                  <span className="text-xs font-black tabular-nums text-stone-600 dark:text-stone-300 w-5 text-right">{z.fahrer}</span>
                  <MapPin className="h-3 w-3 text-stone-400" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
