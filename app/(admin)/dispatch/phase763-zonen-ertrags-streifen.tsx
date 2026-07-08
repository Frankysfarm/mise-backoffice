'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, Euro } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ZoneEintrag {
  zone_id: string;
  zone_name: string;
  umsatz: number;
  bestellungen: number;
}

export function DispatchPhase763ZonenErtragsStreifen({ locationId }: Props) {
  const [zonen, setZonen] = useState<ZoneEintrag[]>([]);
  const [offen, setOffen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/zonen-erloes-vergleich?location_id=${locationId}`);
      const j = await r.json();
      if (!j.ok) return;
      const raw: Array<{
        zone_id?: string;
        zone_name?: string;
        umsatz_heute?: number;
        bestellungen_heute?: number;
      }> = j.zonen ?? [];
      const mapped: ZoneEintrag[] = raw
        .map((z) => ({
          zone_id: z.zone_id ?? '',
          zone_name: z.zone_name ?? z.zone_id ?? '?',
          umsatz: z.umsatz_heute ?? 0,
          bestellungen: z.bestellungen_heute ?? 0,
        }))
        .sort((a, b) => b.umsatz - a.umsatz)
        .slice(0, 6);
      setZonen(mapped);
    } catch { /* silent */ }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 60_000);
    return () => clearInterval(t);
  }, [laden]);

  if (!locationId) return null;

  const maxUmsatz = Math.max(...zonen.map((z) => z.umsatz), 1);
  const gesamtUmsatz = zonen.reduce((s, z) => s + z.umsatz, 0);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold">Zonen-Ertrag heute</span>
          {gesamtUmsatz > 0 && (
            <span className="text-xs font-bold text-green-600 dark:text-green-400">
              {gesamtUmsatz.toFixed(0)} €
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          {zonen.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Umsatzdaten für heute.</p>
          ) : (
            zonen.map((z, i) => {
              const balkenPct = Math.round((z.umsatz / maxUmsatz) * 100);
              const farbe = i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-blue-500' : 'bg-slate-400';
              return (
                <div key={z.zone_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[120px]">{z.zone_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{z.bestellungen} Best.</span>
                      <span className="font-bold tabular-nums flex items-center gap-0.5">
                        <Euro className="h-3 w-3" />{z.umsatz.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${farbe}`}
                      style={{ width: `${balkenPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
