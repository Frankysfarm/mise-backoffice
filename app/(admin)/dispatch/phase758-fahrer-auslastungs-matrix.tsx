'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerAuslastung {
  driver_id: string;
  name: string;
  score: number;
  touren_heute: number;
  touren_aktiv: number;
  km_heute: number;
}

function stufe(score: number): { label: string; farbe: string; bg: string } {
  if (score >= 90) return { label: 'voll', farbe: 'text-red-600 dark:text-red-400', bg: 'bg-red-500' };
  if (score >= 60) return { label: 'aktiv', farbe: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' };
  if (score >= 25) return { label: 'mittel', farbe: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500' };
  return { label: 'frei', farbe: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500' };
}

export function DispatchPhase758FahrerAuslastungsMatrix({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerAuslastung[]>([]);
  const [offen, setOffen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-auslastungs-score?location_id=${locationId}`);
      const j = await r.json();
      if (j.fahrer) setFahrer(j.fahrer.slice(0, 10));
    } catch { /* silent */ }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 30_000);
    return () => clearInterval(t);
  }, [laden]);

  if (!locationId) return null;

  const aktive = fahrer.filter((f) => f.touren_aktiv > 0).length;
  const freie = fahrer.filter((f) => f.touren_aktiv === 0).length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">Fahrer-Auslastungs-Matrix</span>
          {fahrer.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {aktive} aktiv · {freie} frei
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          {fahrer.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Fahrdaten für heute.</p>
          ) : (
            <>
              {/* Zusammenfassung */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Aktiv', wert: aktive, farbe: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Frei', wert: freie, farbe: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Gesamt', wert: fahrer.length, farbe: 'text-foreground' },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">{k.label}</p>
                    <p className={`text-base font-black tabular-nums ${k.farbe}`}>{k.wert}</p>
                  </div>
                ))}
              </div>

              {/* Fahrer-Liste */}
              <div className="space-y-1">
                {fahrer.map((f) => {
                  const s = stufe(f.score);
                  return (
                    <div key={f.driver_id} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-24 truncate">{f.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${s.bg}`}
                          style={{ width: `${Math.min(f.score, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold w-8 text-right tabular-nums ${s.farbe}`}>
                        {f.score}%
                      </span>
                      <span className={`text-[9px] w-10 ${s.farbe}`}>{s.label}</span>
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
