'use client';

import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeatmapData {
  drivers: Array<{ id: string; name: string }>;
  // hours 0-23, values = Anzahl aktiver Batches
  matrix: Record<string, number[]>; // driver_id → [h0..h23]
  generatedAt: string;
}

const STUNDEN = Array.from({ length: 24 }, (_, i) => i);
const MOCK: HeatmapData = {
  drivers: [
    { id: '1', name: 'Alex M.' },
    { id: '2', name: 'Sara K.' },
    { id: '3', name: 'Tom R.' },
  ],
  matrix: {
    '1': [0,0,0,0,0,0,1,2,3,4,3,2,1,2,3,4,5,4,3,2,1,0,0,0],
    '2': [0,0,0,0,0,0,0,1,2,3,4,3,2,1,2,3,4,3,2,1,0,0,0,0],
    '3': [0,0,0,0,0,0,0,0,1,2,2,2,3,4,3,2,1,2,3,2,1,0,0,0],
  },
  generatedAt: new Date().toISOString(),
};

function heatColor(val: number, max: number): string {
  if (val === 0) return 'bg-stone-100';
  const pct = val / Math.max(max, 1);
  if (pct < 0.25) return 'bg-matcha-100';
  if (pct < 0.5) return 'bg-matcha-300';
  if (pct < 0.75) return 'bg-matcha-500';
  return 'bg-matcha-700';
}

export function DispatchPhase848FahrerEinsatzHeatmap({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-einsatz-heatmap?location_id=${locationId}`, { cache: 'no-store' });
      setData(res.ok ? await res.json() : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 600_000);
    return () => clearInterval(iv);
  }, [open, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxVal = data
    ? Math.max(...Object.values(data.matrix).flatMap(arr => arr), 1)
    : 1;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Einsatz 24h Heatmap</span>
          {data && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {data.drivers.length} Fahrer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Heatmap…
            </div>
          )}

          {!loading && data && data.drivers.length > 0 && (
            <div className="overflow-x-auto">
              {/* Stunden-Header */}
              <div className="flex gap-px mb-1 ml-20">
                {STUNDEN.map(h => (
                  <div key={h} className="w-6 shrink-0 text-center text-[8px] text-stone-400 leading-none">
                    {h % 4 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
              </div>

              {/* Heatmap-Zeilen */}
              <div className="space-y-px">
                {data.drivers.map(d => (
                  <div key={d.id} className="flex items-center gap-px">
                    <span className="w-20 shrink-0 text-[11px] font-medium text-stone-700 truncate pr-2">{d.name}</span>
                    {STUNDEN.map(h => {
                      const val = data.matrix[d.id]?.[h] ?? 0;
                      return (
                        <div
                          key={h}
                          title={`${String(h).padStart(2,'0')}:00 — ${val} Touren`}
                          className={cn('w-6 h-5 rounded-sm shrink-0 transition-colors', heatColor(val, maxVal))}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legende */}
              <div className="flex items-center gap-2 mt-3 text-[10px] text-stone-500">
                <span>Inaktiv</span>
                {['bg-matcha-100','bg-matcha-300','bg-matcha-500','bg-matcha-700'].map(c => (
                  <span key={c} className={cn('h-3 w-5 rounded-sm inline-block', c)} />
                ))}
                <span>Max ({maxVal})</span>
              </div>
            </div>
          )}

          {!loading && (!data || data.drivers.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine Daten verfügbar — Mock-Daten werden angezeigt.
            </p>
          )}

          {!locationId && <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>}
        </div>
      )}
    </div>
  );
}
