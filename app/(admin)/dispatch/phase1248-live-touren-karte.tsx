'use client';

// Phase 1248 — Live-Touren-Karte (Dispatch)
// SVG-Zonenansicht: 4 Zonen-Quadranten + Fahrer-Punkte + Stopp-Count + ETA
// Props: locationId · 60s-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourKartePunkt {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  on_tour: boolean;
  offene_stopps: number;
  naechster_stopp_adresse: string | null;
  eta_min: number | null;
  status: 'frei' | 'aktiv' | 'abweichend';
}

interface ApiResponse {
  fahrer: TourKartePunkt[];
  aktive_fahrer: number;
  freie_fahrer: number;
  offene_stopps_gesamt: number;
  location_id: string;
  generiert_am: string;
}

const ZONE_QUADRANT: Record<string, { x: number; y: number; label: string; color: string }> = {
  Mitte:    { x: 95,  y: 95,  label: 'Mitte',  color: '#6366f1' },
  Nord:     { x: 95,  y: 30,  label: 'Nord',   color: '#0ea5e9' },
  Süd:      { x: 95,  y: 160, label: 'Süd',    color: '#10b981' },
  West:     { x: 30,  y: 95,  label: 'West',   color: '#f59e0b' },
  Ost:      { x: 160, y: 95,  label: 'Ost',    color: '#ec4899' },
  Unbekannt:{ x: 95,  y: 95,  label: '?',      color: '#94a3b8' },
};

const STATUS_COLOR: Record<TourKartePunkt['status'], string> = {
  frei:      '#22c55e',
  aktiv:     '#6366f1',
  abweichend:'#ef4444',
};

function zonenOffset(zone: string | null, index: number): { dx: number; dy: number } {
  const offsets = [
    { dx: 0, dy: 0 }, { dx: 12, dy: -12 }, { dx: -12, dy: 12 },
    { dx: 12, dy: 12 }, { dx: -12, dy: -12 },
  ];
  return offsets[index % offsets.length];
}

export function DispatchPhase1248LiveTourenKarte({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/live-touren-karte?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const zoneIndexMap = new Map<string, number>();
  const fahrerByZone = (zone: string | null) => {
    const z = zone ?? 'Unbekannt';
    const idx = zoneIndexMap.get(z) ?? 0;
    zoneIndexMap.set(z, idx + 1);
    return idx;
  };

  return (
    <div className="rounded-xl border overflow-hidden bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-700">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-sky-100 dark:bg-sky-900/20"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Live-Touren-Karte</span>
          {data && (
            <>
              <span className="rounded-full bg-indigo-500 text-white px-2 py-0.5 text-[10px] font-black">
                {data.aktive_fahrer} aktiv
              </span>
              <span className="rounded-full bg-green-500 text-white px-2 py-0.5 text-[10px] font-black">
                {data.freie_fahrer} frei
              </span>
              <span className="rounded-full bg-slate-400 text-white px-2 py-0.5 text-[10px] font-bold">
                {data.offene_stopps_gesamt} Stopps offen
              </span>
            </>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-sky-500" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && data && (
            <>
              {/* SVG Map */}
              <div className="relative overflow-hidden rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900">
                <svg viewBox="0 0 190 190" width="100%" className="max-h-56">
                  {/* Zone grid lines */}
                  <line x1="95" y1="0" x2="95" y2="190" stroke="#e2e8f0" strokeWidth="1" />
                  <line x1="0" y1="95" x2="190" y2="95" stroke="#e2e8f0" strokeWidth="1" />

                  {/* Zone labels */}
                  {Object.entries(ZONE_QUADRANT).slice(0, 4).map(([, q]) => (
                    <text key={q.label} x={q.x} y={q.y} textAnchor="middle" dominantBaseline="middle"
                      fontSize="10" fill={q.color} opacity="0.25" fontWeight="bold">
                      {q.label}
                    </text>
                  ))}

                  {/* Fahrer dots */}
                  {data.fahrer.map((f) => {
                    const zone = f.zone ?? 'Unbekannt';
                    const q = ZONE_QUADRANT[zone] ?? ZONE_QUADRANT.Unbekannt;
                    const idx = fahrerByZone(f.zone);
                    const { dx, dy } = zonenOffset(zone, idx);
                    const cx = q.x + dx;
                    const cy = q.y + dy;
                    const color = STATUS_COLOR[f.status];
                    return (
                      <g key={f.fahrer_id}>
                        <circle cx={cx} cy={cy} r="7" fill={color} opacity="0.85" />
                        {f.offene_stopps > 0 && (
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                            fontSize="7" fill="white" fontWeight="bold">
                            {f.offene_stopps}
                          </text>
                        )}
                        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="6" fill="#64748b">
                          {f.fahrer_name.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Legend */}
                <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                  {(['frei', 'aktiv', 'abweichend'] as const).map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                      <span className="text-[9px] text-muted-foreground capitalize">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fahrer-Liste */}
              <div className="divide-y rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 overflow-hidden">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center gap-3 px-3 py-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLOR[f.status] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{f.fahrer_name}</div>
                      {f.naechster_stopp_adresse && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          → {f.naechster_stopp_adresse}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2 text-right">
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                        f.zone ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-muted text-muted-foreground',
                      )}>
                        {f.zone ?? '?'}
                      </span>
                      {f.offene_stopps > 0 && (
                        <span className="rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 text-[9px] font-black">
                          {f.offene_stopps} Stopp{f.offene_stopps !== 1 ? 's' : ''}
                        </span>
                      )}
                      {f.eta_min !== null && (
                        <span className="text-[10px] font-bold text-foreground tabular-nums">
                          {f.eta_min} Min
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {locationId && !data && !loading && (
            <p className="text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}
        </div>
      )}
    </div>
  );
}
