'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, MapPin, Timer, Route } from 'lucide-react';
import type { FahrerStandortHistoryResponse, FahrerStandortHistory, GpsPunkt } from '@/app/api/delivery/admin/fahrer-standort-history/route';

/**
 * Phase 1724 — Fahrer-Standort-History-Karte (Dispatch)
 *
 * Letzte GPS-Route je Fahrer als Punktlinie (SVG-Canvas) + Dwell-Time je Stopp
 * + gesamte Route-km. Phase1722-API: /api/delivery/admin/fahrer-standort-history.
 * 5-Min-Polling. Multi-Tenant via locationId prop.
 */

interface Props {
  locationId: string | null;
}

const POLL_MS = 5 * 60_000;

const DRIVER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function normalise(punkte: GpsPunkt[]): Array<{ x: number; y: number }> {
  if (punkte.length < 2) return punkte.map(() => ({ x: 50, y: 50 }));
  const lats = punkte.map(p => p.lat);
  const lngs = punkte.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 1e-5;
  const dLng = maxLng - minLng || 1e-5;
  return punkte.map(p => ({
    x: ((p.lng - minLng) / dLng) * 90 + 5,
    y: 95 - ((p.lat - minLat) / dLat) * 90,
  }));
}

function RouteSvg({ fahrer, colors }: { fahrer: FahrerStandortHistory[]; colors: string[] }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-40 rounded-lg bg-slate-100 dark:bg-slate-800">
      {fahrer.map((f, fi) => {
        const pts = normalise(f.punkte);
        if (pts.length < 2) return null;
        const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
        const color = colors[fi % colors.length];
        const last = pts[pts.length - 1];
        return (
          <g key={f.driver_id}>
            <polyline
              points={polyline}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
            />
            {pts.map((p, pi) => (
              <circle key={pi} cx={p.x} cy={p.y} r={pi === pts.length - 1 ? 2.5 : 1} fill={color} opacity={0.7} />
            ))}
            <text x={last.x + 2} y={last.y - 2} fontSize="4" fill={color} fontWeight="bold">
              {f.fahrer_name.split(' ')[0][0]}{f.fahrer_name.split(' ')[1]?.[0] ?? ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DwellBadge({ sec }: { sec: number }) {
  const isFast = sec < 60;
  return (
    <span className={cn(
      'rounded px-1.5 py-0.5 text-[10px] font-mono font-bold shrink-0',
      isFast ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    )}>
      {sec}s
    </span>
  );
}

export function DispatchPhase1724FahrerStandortHistoryKarte({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<FahrerStandortHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-standort-history?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!locationId) return null;

  const fahrer = data?.fahrer ?? [];
  if (!loading && !fahrer.length) return null;

  const selected = fahrer[selectedIdx] ?? null;

  return (
    <div className="rounded-xl border border-border bg-background p-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Route className="h-4 w-4 text-blue-500" />
          Fahrer-Standort-History
          <span className="text-xs font-normal text-muted-foreground">(letzte 2h)</span>
          {loading && <span className="text-[10px] text-muted-foreground">aktualisiert…</span>}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {fahrer.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {fahrer.map((f, fi) => (
                <button
                  key={f.driver_id}
                  onClick={() => setSelectedIdx(fi)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors',
                    selectedIdx === fi
                      ? 'text-white border-transparent'
                      : 'bg-background border-border text-muted-foreground hover:border-foreground',
                  )}
                  style={selectedIdx === fi ? { backgroundColor: DRIVER_COLORS[fi % DRIVER_COLORS.length] } : undefined}
                >
                  {f.fahrer_name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          <RouteSvg fahrer={selected ? [selected] : fahrer.slice(0, 3)} colors={DRIVER_COLORS} />

          {selected && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Route className="h-3 w-3" />
                  <span className="font-mono font-bold text-foreground">{selected.route_km} km</span>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{selected.stopps.length} Stopps</span>
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  <span>Ø {selected.stopps.length
                    ? Math.round(selected.stopps.reduce((s, st) => s + st.dwell_sec, 0) / selected.stopps.length)
                    : 0}s Dwell</span>
                </span>
              </div>

              {selected.stopps.length > 0 && (
                <div className="space-y-1">
                  {selected.stopps.slice(0, 5).map(s => (
                    <div key={s.stopp_nr} className="flex items-center justify-between gap-2 rounded border border-border px-2.5 py-1.5 text-xs bg-muted/30">
                      <span className="flex items-center gap-1.5">
                        <span className="rounded-full bg-blue-500 w-4 h-4 text-[10px] font-black text-white flex items-center justify-center shrink-0">
                          {s.stopp_nr}
                        </span>
                        <span className="truncate text-foreground">{s.adresse}</span>
                      </span>
                      <DwellBadge sec={s.dwell_sec} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">5-Min-Polling · GPS-Punkte letzte 2h</p>
        </div>
      )}
    </div>
  );
}
