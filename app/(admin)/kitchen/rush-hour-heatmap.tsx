'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Wochentag × Stunde Eintrag aus der Tages-Muster-API
interface MusterStunde {
  wochentag: number;
  stunde: number;
  avgBestellungen: number;
  peakKlasse: 'low' | 'normal' | 'peak' | 'high';
}

// 7 Wochentage, relevante Stunden 6–22
const STUNDEN = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22
const WOCHENTAGE = [
  { label: 'Mo', value: 1 },
  { label: 'Di', value: 2 },
  { label: 'Mi', value: 3 },
  { label: 'Do', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
  { label: 'So', value: 0 },
];

function peakColor(
  avg: number,
  maxAvg: number,
  peakKlasse: MusterStunde['peakKlasse'],
): string {
  if (maxAvg === 0 || avg === 0) return 'bg-muted/30 text-muted-foreground';
  const intensity = avg / maxAvg;
  if (peakKlasse === 'high' || intensity > 0.8)  return 'bg-red-500 text-white';
  if (peakKlasse === 'peak' || intensity > 0.55) return 'bg-amber-400 text-white';
  if (intensity > 0.3) return 'bg-matcha-400 text-white';
  if (intensity > 0.1) return 'bg-matcha-200 text-matcha-800';
  return 'bg-muted/30 text-muted-foreground';
}

export function KitchenRushHourHeatmap({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MusterStunde[]>([]);

  const load = useCallback(async () => {
    if (!locationId || !open) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/tages-muster?action=muster&location_id=${encodeURIComponent(locationId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { ok: boolean; muster?: MusterStunde[] };
      setData(json.muster ?? []);
    } catch {
      // Fallback: leere Daten, keine Fehlermeldung
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, open]);

  useEffect(() => {
    void load();
  }, [load]);

  // Baut Lookup map: "wochentag_stunde" → MusterStunde
  const lookup = new Map<string, MusterStunde>(
    data.map((d) => [`${d.wochentag}_${d.stunde}`, d]),
  );

  const maxAvg = data.length > 0 ? Math.max(...data.map((d) => d.avgBestellungen)) : 1;

  // Heutige Stunde und heutiger Wochentag (für Markierung)
  const nowDate = new Date();
  const nowHour = nowDate.getHours();
  const nowDow = nowDate.getDay(); // 0=So..6=Sa

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Rush-Hour-Heatmap · 7×17h Bestellmuster
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">Letzte 30 Tage</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t p-4">
          {!locationId ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Bitte Filiale auswählen.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Lade Bestellmuster…</span>
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Muster-Daten. Bitte Compute auslösen oder warten bis der Cron läuft.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center" style={{ minWidth: '640px' }}>
                <thead>
                  <tr>
                    {/* Leer-Zelle für Wochentag-Labels */}
                    <th className="w-8 pb-1" />
                    {STUNDEN.map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'pb-1 text-[9px] font-bold text-muted-foreground w-8',
                          h === nowHour && 'text-matcha-700',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="space-y-0.5">
                  {WOCHENTAGE.map(({ label, value }) => (
                    <tr key={value}>
                      <td
                        className={cn(
                          'pr-1 text-[10px] font-bold text-right text-muted-foreground',
                          value === nowDow && 'text-matcha-700',
                        )}
                      >
                        {label}
                      </td>
                      {STUNDEN.map((h) => {
                        const entry = lookup.get(`${value}_${h}`);
                        const avg = entry?.avgBestellungen ?? 0;
                        const pk = entry?.peakKlasse ?? 'low';
                        const isNow = value === nowDow && h === nowHour;

                        return (
                          <td key={h} className="p-0.5">
                            <div
                              title={`${label} ${h}:00 — Ø ${avg.toFixed(1)} Bestellungen`}
                              className={cn(
                                'rounded flex items-center justify-center h-6 w-full text-[9px] font-bold transition-colors cursor-default',
                                peakColor(avg, maxAvg, pk),
                                isNow && 'ring-2 ring-offset-1 ring-matcha-600',
                              )}
                            >
                              {avg > 0 ? Math.round(avg) : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legende */}
              <div className="mt-3 flex items-center gap-3 flex-wrap justify-end">
                <span className="text-[9px] text-muted-foreground font-medium">Intensität:</span>
                {[
                  { color: 'bg-muted/30', label: 'Gering' },
                  { color: 'bg-matcha-200', label: 'Niedrig' },
                  { color: 'bg-matcha-400', label: 'Normal' },
                  { color: 'bg-amber-400', label: 'Peak' },
                  { color: 'bg-red-500', label: 'Hochbetrieb' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={cn('h-3 w-3 rounded-sm', color)} />
                    <span className="text-[9px] text-muted-foreground">{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-matcha-400 ring-2 ring-matcha-600" />
                  <span className="text-[9px] text-muted-foreground">Jetzt</span>
                </div>
              </div>

              <p className="mt-2 text-[9px] text-muted-foreground text-right">
                Werte: Ø Bestellungen/Stunde (30-Tage-Basis)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
