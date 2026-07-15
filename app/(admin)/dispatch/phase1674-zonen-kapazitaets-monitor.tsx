'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1674 — Zonen-Kapazitäts-Monitor (Dispatch)
 *
 * Phase1672-API: Auslastung je Zone A/B/C/D als Balken + Warnampel
 * + Empfehlung Fahrer-Umverteilung. 10-Min-Polling.
 */

type AmpelStatus = 'niedrig' | 'normal' | 'voll';
type Trend = 'steigend' | 'stabil' | 'fallend';

interface ZoneKapazitaet {
  zone: 'A' | 'B' | 'C' | 'D';
  fahrer_aktiv: number;
  fahrer_kapazitaet: number;
  auslastung_pct: number;
  freie_kapazitaet: number;
  ampel: AmpelStatus;
  eta_benchmark_min: number;
  prognose_naechste_stunde: { auslastung_pct: number; trend: Trend };
}

interface ApiResponse {
  location_id: string;
  zonen: ZoneKapazitaet[];
  gesamt_auslastung_pct: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const AMPEL_STYLE: Record<AmpelStatus, { bar: string; badge: string; label: string; dot: string }> = {
  niedrig: {
    bar: 'bg-sky-400',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    label: 'Niedrig',
    dot: 'bg-sky-400',
  },
  normal: {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    label: 'Normal',
    dot: 'bg-emerald-500',
  },
  voll: {
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border-red-200',
    label: 'Voll',
    dot: 'bg-red-500 animate-pulse',
  },
};

const TREND_ICON: Record<Trend, React.ReactNode> = {
  steigend: <TrendingUp className="h-3 w-3 text-red-500" />,
  stabil: <Minus className="h-3 w-3 text-muted-foreground" />,
  fallend: <TrendingDown className="h-3 w-3 text-emerald-500" />,
};

function buildEmpfehlung(zonen: ZoneKapazitaet[]): string | null {
  const voll = zonen.filter(z => z.ampel === 'voll');
  const frei = zonen.filter(z => z.ampel === 'niedrig' && z.freie_kapazitaet > 0);
  if (!voll.length) return null;
  if (frei.length) {
    return `Zone ${voll.map(z => z.zone).join('/')} überlastet → Fahrer aus Zone ${frei.map(z => z.zone).join('/')} umleiten.`;
  }
  return `Zone ${voll.map(z => z.zone).join('/')} überlastet — zusätzliche Fahrer einplanen.`;
}

const POLL_MS = 10 * 60 * 1000;

export function DispatchPhase1674ZonenKapazitaetsMonitor({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/zonen-kapazitaet?location_id=${encodeURIComponent(locationId)}`);
      if (r.ok) setData(await r.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const empfehlung = data ? buildEmpfehlung(data.zonen) : null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/40 transition"
        onClick={() => setOpen(v => !v)}
      >
        <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Zonen-Kapazitäts-Monitor
        </span>
        {data && (
          <span className={cn(
            'ml-2 rounded-full px-2 py-0.5 text-[9px] font-black border',
            data.gesamt_auslastung_pct >= 90 ? 'bg-red-100 text-red-700 border-red-200' :
            data.gesamt_auslastung_pct >= 60 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            'bg-sky-100 text-sky-700 border-sky-200',
          )}>
            Gesamt {data.gesamt_auslastung_pct}%
          </span>
        )}
        <button
          className="ml-auto p-1 rounded hover:bg-muted transition"
          onClick={e => { e.stopPropagation(); load(); }}
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}

          {data && (
            <>
              {/* Empfehlung-Banner */}
              {empfehlung && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <p className="text-xs font-bold text-red-700">{empfehlung}</p>
                </div>
              )}

              {/* Zonen-Balken */}
              <div className="space-y-2">
                {data.zonen.map(z => {
                  const s = AMPEL_STYLE[z.ampel];
                  return (
                    <div key={z.zone} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-8 shrink-0 text-xs font-black tabular-nums">
                          Zone {z.zone}
                        </span>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold border', s.badge)}>
                          {s.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {z.fahrer_aktiv}/{z.fahrer_kapazitaet} Fahrer
                        </span>
                        <span className="ml-auto text-[10px] font-bold tabular-nums">
                          ETA ~{z.eta_benchmark_min} Min
                        </span>
                      </div>
                      {/* Auslastungs-Balken */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                            style={{ width: `${Math.min(100, z.auslastung_pct)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] font-bold tabular-nums shrink-0">
                          {z.auslastung_pct}%
                        </span>
                      </div>
                      {/* Prognose */}
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        {TREND_ICON[z.prognose_naechste_stunde.trend]}
                        <span>Prognose +1h: {z.prognose_naechste_stunde.auslastung_pct}%</span>
                        <span className="ml-1 capitalize">{z.prognose_naechste_stunde.trend}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
