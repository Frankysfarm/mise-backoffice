'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface StundeMatrix {
  stunde: number;
  aktiv: number;
  pause: number;
  verfuegbar: number;
}

interface MatrixData {
  location_id: string;
  stunden: StundeMatrix[];
  peak_stunde: number;
  alert_engpass: boolean;
  verfuegbar_aktuell: number;
}

const MOCK: MatrixData = {
  location_id: 'mock',
  stunden: Array.from({ length: 8 }, (_, i) => ({
    stunde: (new Date().getHours() - 7 + i + 24) % 24,
    aktiv: 2 + (i % 3),
    pause: i % 2,
    verfuegbar: 1 + (i % 2),
  })),
  peak_stunde: (new Date().getHours() - 3 + 24) % 24,
  alert_engpass: false,
  verfuegbar_aktuell: 2,
};

const POLL_MS = 15 * 60 * 1000;

export function DispatchPhase2021FahrerAuslastungsMatrixWidget({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<MatrixData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-auslastungs-matrix?location_id=${locationId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const d = data;
  const maxTotal = d
    ? Math.max(1, ...d.stunden.map(s => s.aktiv + s.pause + s.verfuegbar))
    : 1;

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Users className="h-4 w-4 text-sky-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Fahrer-Auslastungs-Matrix (8h)</span>
        {d?.alert_engpass && (
          <span className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" /> Engpass
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {d?.alert_engpass && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300">
                Weniger als 2 Fahrer verfügbar — Engpass!
              </span>
            </div>
          )}

          {!d ? (
            <p className="text-xs text-muted-foreground text-center py-4">Lade Matrix…</p>
          ) : (
            <>
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-matcha-500 inline-block" />Aktiv</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Pause</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/30 inline-block" />Verfügbar</span>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1 h-24">
                {d.stunden.map((s, i) => {
                  const total = s.aktiv + s.pause + s.verfuegbar;
                  const maxH = 88;
                  const scale = total / maxTotal;
                  const aktivH = Math.round((s.aktiv / Math.max(1, total)) * scale * maxH);
                  const pauseH = Math.round((s.pause / Math.max(1, total)) * scale * maxH);
                  const freeH = Math.round((s.verfuegbar / Math.max(1, total)) * scale * maxH);
                  const isPeak = s.stunde === d.peak_stunde;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex flex-col-reverse gap-px" style={{ height: maxH }}>
                        <div className="w-full rounded-t-sm bg-matcha-500" style={{ height: aktivH }} />
                        <div className="w-full bg-amber-400" style={{ height: pauseH }} />
                        <div className="w-full bg-muted-foreground/20" style={{ height: freeH }} />
                      </div>
                      <span className={cn(
                        'text-[9px] tabular-nums',
                        isPeak ? 'text-sky-600 font-bold' : 'text-muted-foreground',
                      )}>
                        {String(s.stunde).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Jetzt verfügbar', value: d.verfuegbar_aktuell, color: 'text-matcha-600' },
                  { label: 'Peak-Stunde', value: `${String(d.peak_stunde).padStart(2, '0')}:00`, color: 'text-sky-600' },
                  { label: 'Aktiv jetzt', value: d.stunden[d.stunden.length - 1]?.aktiv ?? 0, color: 'text-foreground' },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-lg border bg-muted/20 p-2 text-center">
                    <div className={cn('text-sm font-black', kpi.color)}>{kpi.value}</div>
                    <div className="text-[9px] text-muted-foreground">{kpi.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
