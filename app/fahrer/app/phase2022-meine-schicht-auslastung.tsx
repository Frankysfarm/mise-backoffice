'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface StundeMatrix {
  stunde: number;
  aktiv: number;
  pause: number;
  verfuegbar: number;
}

interface MatrixData {
  stunden: StundeMatrix[];
  avg_auslastung_pct: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK: MatrixData = {
  stunden: Array.from({ length: 8 }, (_, i) => ({
    stunde: (new Date().getHours() - 7 + i + 24) % 24,
    aktiv: i % 3 === 0 ? 1 : 0,
    pause: i % 5 === 0 ? 1 : 0,
    verfuegbar: i % 3 !== 0 && i % 5 !== 0 ? 1 : 0,
  })),
  avg_auslastung_pct: 62,
};

const TIPPS = [
  'Plane kurze Pausen zwischen den Stopps — das steigert die Konzentration.',
  'Du bist heute sehr aktiv — großartige Leistung!',
  'Verteile Pausen gleichmäßig über die Schicht.',
];

const POLL_MS = 15 * 60 * 1000;

export function FahrerPhase2022MeineSchichtAuslastung({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-auslastungs-matrix?location_id=${locationId}&driver_id=${driverId}`,
        );
        if (!res.ok) { if (!cancelled) setData(MOCK); return; }
        const json = await res.json();
        if (!cancelled) {
          const stunden: StundeMatrix[] = json.stunden ?? MOCK.stunden;
          const aktivCount = stunden.filter(s => s.aktiv > 0).length;
          const avg_auslastung_pct = Math.round((aktivCount / Math.max(1, stunden.length)) * 100);
          setData({ stunden, avg_auslastung_pct });
        }
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, locationId]);

  if (!driverId || !isOnline) return null;

  const d = data;
  const tippIndex = d ? (d.avg_auslastung_pct >= 80 ? 1 : d.avg_auslastung_pct >= 50 ? 2 : 0) : 0;
  const ampel = d
    ? d.avg_auslastung_pct >= 75
      ? 'text-matcha-600'
      : d.avg_auslastung_pct >= 50
        ? 'text-amber-600'
        : 'text-red-600'
    : 'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <BarChart2 className="h-4 w-4 text-sky-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Meine Schicht-Auslastung</span>
        {d && (
          <span className={cn(
            'text-[10px] font-bold rounded-full px-2 py-0.5',
            d.avg_auslastung_pct >= 75
              ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
              : d.avg_auslastung_pct >= 50
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
          )}>
            {d.avg_auslastung_pct}%
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!d ? (
            <p className="text-xs text-muted-foreground text-center py-4">Lade Schichtdaten…</p>
          ) : (
            <>
              {/* Avg score */}
              <div className="flex items-center gap-2">
                <span className={cn('text-2xl font-black', ampel)}>{d.avg_auslastung_pct}%</span>
                <span className="text-xs text-muted-foreground">Ø Auslastung letzte 8h</span>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1 h-16">
                {d.stunden.map((s, i) => {
                  const status = s.aktiv > 0 ? 'aktiv' : s.pause > 0 ? 'pause' : 'frei';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={cn(
                          'w-full rounded-t-sm',
                          status === 'aktiv' ? 'bg-matcha-500' : status === 'pause' ? 'bg-amber-400' : 'bg-muted-foreground/25',
                        )}
                        style={{ height: 48 }}
                      />
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {String(s.stunde).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-matcha-500 inline-block" />Aktiv</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Pause</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/25 inline-block" />Frei</span>
              </div>

              {/* Tipp */}
              <div className="flex items-start gap-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-3 py-2">
                <Lightbulb className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span className="text-xs text-sky-700 dark:text-sky-300">{TIPPS[tippIndex]}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
