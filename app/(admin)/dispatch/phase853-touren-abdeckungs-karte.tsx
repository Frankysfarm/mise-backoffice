'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneData {
  zone: string;
  label: string;
  aktive_touren: number;
  kapazitaet: number;
  auslastung_pct: number;
  avg_wartezeit_min: number;
  status: 'ok' | 'busy' | 'ueberlastet';
}

interface KarteData {
  zonen: ZoneData[];
  generatedAt: string;
}

const MOCK: KarteData = {
  zonen: [
    { zone: 'A', label: 'Innenstadt', aktive_touren: 3, kapazitaet: 4, auslastung_pct: 75, avg_wartezeit_min: 22, status: 'busy' },
    { zone: 'B', label: 'Stadtmitte', aktive_touren: 2, kapazitaet: 4, auslastung_pct: 50, avg_wartezeit_min: 18, status: 'ok' },
    { zone: 'C', label: 'Stadtrand', aktive_touren: 4, kapazitaet: 3, auslastung_pct: 133, avg_wartezeit_min: 38, status: 'ueberlastet' },
    { zone: 'D', label: 'Außenbezirk', aktive_touren: 1, kapazitaet: 3, auslastung_pct: 33, avg_wartezeit_min: 12, status: 'ok' },
  ],
  generatedAt: new Date().toISOString(),
};

const ZONE_POSITIONS: Record<string, { x: number; y: number; rx: number; ry: number }> = {
  A: { x: 150, y: 120, rx: 55, ry: 45 },
  B: { x: 150, y: 120, rx: 90, ry: 78 },
  C: { x: 150, y: 120, rx: 130, ry: 110 },
  D: { x: 150, y: 120, rx: 170, ry: 150 },
};

const statusStyle = {
  ok:         { fill: '#86efac', stroke: '#16a34a', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700' },
  busy:       { fill: '#fde68a', stroke: '#d97706', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  ueberlastet:{ fill: '#fca5a5', stroke: '#dc2626', text: 'text-red-700',   badge: 'bg-red-100 text-red-700' },
};

function ZoneSvg({ zonen }: { zonen: ZoneData[] }) {
  const sorted = [...zonen].sort((a, b) => b.zone.localeCompare(a.zone)); // D first (outer)

  return (
    <svg viewBox="0 0 300 240" className="w-full max-w-xs mx-auto" role="img" aria-label="Touren-Abdeckungs-Karte">
      {sorted.map(z => {
        const pos = ZONE_POSITIONS[z.zone];
        if (!pos) return null;
        const s = statusStyle[z.status];
        return (
          <g key={z.zone}>
            <ellipse
              cx={pos.x}
              cy={pos.y}
              rx={pos.rx}
              ry={pos.ry}
              fill={s.fill}
              stroke={s.stroke}
              strokeWidth={z.zone === 'A' ? 2.5 : 1.5}
              fillOpacity={0.55}
            />
          </g>
        );
      })}
      {/* Zone Labels */}
      {zonen.map(z => {
        const pos = ZONE_POSITIONS[z.zone];
        if (!pos) return null;
        const offsets: Record<string, [number, number]> = { A: [0, 0], B: [0, -62], C: [0, -100], D: [0, -138] };
        const [ox, oy] = offsets[z.zone] ?? [0, 0];
        const s = statusStyle[z.status];
        return (
          <text
            key={z.zone}
            x={pos.x + ox}
            y={pos.y + oy}
            textAnchor="middle"
            dominantBaseline="middle"
            className="select-none"
            style={{ fontSize: z.zone === 'A' ? 13 : 11, fontWeight: 700, fill: s.stroke }}
          >
            Zone {z.zone}
          </text>
        );
      })}
    </svg>
  );
}

export function DispatchPhase853TourenAbdeckungsKarte({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<KarteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zonen-auslastung?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        // Map API response to KarteData
        if (Array.isArray(raw.zonen)) {
          const mapped: ZoneData[] = (raw.zonen as Array<{
            zone: string; label?: string; aktive_touren?: number; kapazitaet?: number;
            auslastung_pct?: number; avg_wartezeit_min?: number;
          }>).map(z => {
            const pct = z.auslastung_pct ?? 0;
            const status: ZoneData['status'] = pct >= 100 ? 'ueberlastet' : pct >= 70 ? 'busy' : 'ok';
            return {
              zone: z.zone,
              label: z.label ?? `Zone ${z.zone}`,
              aktive_touren: z.aktive_touren ?? 0,
              kapazitaet: z.kapazitaet ?? 4,
              auslastung_pct: pct,
              avg_wartezeit_min: z.avg_wartezeit_min ?? 0,
              status,
            };
          });
          setData({ zonen: mapped, generatedAt: new Date().toISOString() });
        } else {
          setData(MOCK);
        }
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [open, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ueberlastet = (data?.zonen ?? []).filter(z => z.status === 'ueberlastet').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Touren-Abdeckungs-Karte</span>
          {ueberlastet > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {ueberlastet} überlastet
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && !data && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {data && (
            <>
              {/* SVG Map */}
              <ZoneSvg zonen={data.zonen} />

              {/* Zone Stats */}
              <div className="grid grid-cols-2 gap-2">
                {data.zonen.map(z => {
                  const s = statusStyle[z.status];
                  return (
                    <div
                      key={z.zone}
                      className={cn('rounded-xl border p-3 space-y-1', s.badge)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">Zone {z.zone}</span>
                        <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5 border', s.badge)}>
                          {z.status === 'ok' ? 'Normal' : z.status === 'busy' ? 'Ausgelastet' : 'Überlastet'}
                        </span>
                      </div>
                      <div className="text-[10px] font-medium opacity-80">{z.label}</div>
                      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', {
                            'bg-matcha-500': z.status === 'ok',
                            'bg-amber-400': z.status === 'busy',
                            'bg-red-500': z.status === 'ueberlastet',
                          })}
                          style={{ width: `${Math.min(100, z.auslastung_pct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-bold tabular-nums">
                        <span>{z.aktive_touren}/{z.kapazitaet} Touren</span>
                        <span>Ø {z.avg_wartezeit_min} Min</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[10px] text-muted-foreground text-right">
                Aktualisiert {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
