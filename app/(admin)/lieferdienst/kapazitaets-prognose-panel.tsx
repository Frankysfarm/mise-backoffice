'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Users, AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type PeakKlasse = 'low' | 'normal' | 'peak' | 'high';
type Severity = 'ok' | 'warning' | 'critical';

interface HourSlot {
  hourUtc: number;
  hourLabel: string;
  predictedOrders: number;
  plannedDrivers: number;
  peakKlasse: PeakKlasse;
  driversNeeded: number;
  severity: Severity;
}

interface KapazitaetsPrognose {
  locationId: string;
  generatedAt: string;
  lookaheadHours: number;
  hours: HourSlot[];
  criticalHours: number;
  warningHours: number;
  recommendation: string | null;
}

const PEAK_LABELS: Record<PeakKlasse, string> = {
  low: 'Ruhig',
  normal: 'Normal',
  peak: 'Stoßzeit',
  high: 'Hochbetrieb',
};

const SEVERITY_BG: Record<Severity, string> = {
  ok: 'bg-matcha-50 border-matcha-200',
  warning: 'bg-amber-50 border-amber-200',
  critical: 'bg-red-50 border-red-200',
};

const SEVERITY_TEXT: Record<Severity, string> = {
  ok: 'text-matcha-700',
  warning: 'text-amber-700',
  critical: 'text-red-700',
};

const SEVERITY_BAR: Record<Severity, string> = {
  ok: 'bg-matcha-500',
  warning: 'bg-amber-400',
  critical: 'bg-red-500',
};

const PEAK_DOT: Record<PeakKlasse, string> = {
  low: 'bg-stone-300',
  normal: 'bg-sky-400',
  peak: 'bg-amber-400',
  high: 'bg-red-500',
};

export function KapazitaetsPrognosePanel({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<KapazitaetsPrognose | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    if (!locationId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/delivery/admin/kapazitaets-prognose?location_id=${locationId}&hours=4`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  if (!loading && !data) return null;

  const hasCritical = (data?.criticalHours ?? 0) > 0;
  const hasWarning = (data?.warningHours ?? 0) > 0;

  const headerBadgeColor = hasCritical
    ? 'bg-red-100 text-red-700'
    : hasWarning
    ? 'bg-amber-100 text-amber-700'
    : 'bg-matcha-100 text-matcha-700';

  const headerBadgeText = hasCritical
    ? `${data!.criticalHours} Kritisch`
    : hasWarning
    ? `${data!.warningHours} Warnung`
    : 'Kapazität OK';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Clock className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-bold text-stone-800 flex-1">4h Kapazitäts-Prognose</span>
        {!loading && data && (
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', headerBadgeColor)}>
            {headerBadgeText}
          </span>
        )}
        <button onClick={load} className="p-1 hover:bg-stone-100 rounded transition" title="Aktualisieren">
          <RefreshCw className={cn('h-3.5 w-3.5 text-stone-400', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setOpen(v => !v)} className="p-1 hover:bg-stone-100 rounded">
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
            : <ChevronDown className="h-3.5 w-3.5 text-stone-400" />}
        </button>
      </div>

      {open && (
        loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data && data.hours.length > 0 ? (
          <div className="p-5 space-y-3">
            {/* Recommendation banner */}
            {data.recommendation && (
              <div className={cn(
                'flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold border',
                hasCritical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700',
              )}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.recommendation}</span>
              </div>
            )}

            {!data.recommendation && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold border bg-matcha-50 border-matcha-200 text-matcha-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Kapazität für die nächsten {data.lookaheadHours} Stunden ausreichend.</span>
              </div>
            )}

            {/* Hour slots */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.hours.map(slot => {
                const barPct = slot.driversNeeded > 0
                  ? Math.min(100, (slot.plannedDrivers / slot.driversNeeded) * 100)
                  : 100;

                return (
                  <div
                    key={slot.hourUtc}
                    className={cn('rounded-xl border p-3 space-y-2', SEVERITY_BG[slot.severity])}
                  >
                    {/* Hour + peak dot */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-stone-800">{slot.hourLabel}</span>
                      <div className="flex items-center gap-1">
                        <span className={cn('w-2 h-2 rounded-full inline-block', PEAK_DOT[slot.peakKlasse])} />
                        <span className="text-[9px] text-stone-400">{PEAK_LABELS[slot.peakKlasse]}</span>
                      </div>
                    </div>

                    {/* Orders prediction */}
                    <div>
                      <div className="text-[10px] text-stone-400 font-medium">Erw. Bestellungen</div>
                      <div className="text-base font-black tabular-nums text-stone-900">
                        {slot.predictedOrders.toFixed(1)}
                      </div>
                    </div>

                    {/* Drivers bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-stone-400 font-medium flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" /> Fahrer
                        </span>
                        <span className={cn('text-[10px] font-bold tabular-nums', SEVERITY_TEXT[slot.severity])}>
                          {slot.plannedDrivers}/{slot.driversNeeded}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', SEVERITY_BAR[slot.severity])}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="text-[9px] text-stone-400 text-right pt-1">
              Aktualisiert {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              {' · '}Prognose aus Tages-Muster + geplanten Schichten
            </div>
          </div>
        ) : (
          <div className="p-5 text-xs text-stone-400 text-center">
            Keine Prognosedaten verfügbar — Tages-Muster noch nicht berechnet.
          </div>
        )
      )}
    </div>
  );
}
