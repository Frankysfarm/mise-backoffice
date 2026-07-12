'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1125 — Fahrer-Netz-Heatmap (Dispatch)
// Minimalistische SVG-Heatmap der aktiven Fahrer je Zone A/B/C/D als Auslastungs-Punkte

interface Props { locationId: string | null }

type FahrerEntry = { id: string; name: string; status: 'on_tour' | 'bereit' | 'pause' };
type ZoneLoad = {
  zone: string;
  aktiv: number;
  on_tour: number;
  bereit: number;
  auslastung_pct: number;
  level: 'leer' | 'niedrig' | 'mittel' | 'hoch' | 'voll';
  fahrer: FahrerEntry[];
};
type ApiData = {
  zonen: ZoneLoad[];
  gesamt_aktiv: number;
  gesamt_on_tour: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  zonen: [
    { zone: 'A', aktiv: 3, on_tour: 2, bereit: 1, auslastung_pct: 67, level: 'hoch',
      fahrer: [{ id: 'f1', name: 'Ahmad K.', status: 'on_tour' }, { id: 'f2', name: 'Lukas M.', status: 'on_tour' }, { id: 'f3', name: 'Sara P.', status: 'bereit' }] },
    { zone: 'B', aktiv: 2, on_tour: 1, bereit: 1, auslastung_pct: 50, level: 'mittel',
      fahrer: [{ id: 'f4', name: 'Jonas H.', status: 'on_tour' }, { id: 'f5', name: 'Emma T.', status: 'bereit' }] },
    { zone: 'C', aktiv: 1, on_tour: 1, bereit: 0, auslastung_pct: 100, level: 'voll',
      fahrer: [{ id: 'f6', name: 'Mia R.', status: 'on_tour' }] },
    { zone: 'D', aktiv: 0, on_tour: 0, bereit: 0, auslastung_pct: 0, level: 'leer', fahrer: [] },
  ],
  gesamt_aktiv: 6,
  gesamt_on_tour: 4,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {
  A: { x: 80,  y: 70  },
  B: { x: 220, y: 70  },
  C: { x: 80,  y: 160 },
  D: { x: 220, y: 160 },
};

const LEVEL_COLOR: Record<ZoneLoad['level'], string> = {
  leer:    '#94a3b8',
  niedrig: '#86efac',
  mittel:  '#fbbf24',
  hoch:    '#f97316',
  voll:    '#ef4444',
};

const LEVEL_LABEL: Record<ZoneLoad['level'], string> = {
  leer: 'leer', niedrig: 'niedrig', mittel: 'mittel', hoch: 'hoch', voll: 'voll',
};

function HeatmapSvg({ zonen }: { zonen: ZoneLoad[] }) {
  return (
    <svg viewBox="0 0 300 240" className="w-full max-w-xs mx-auto" aria-label="Fahrer-Netz-Heatmap">
      {/* Background grid */}
      <rect x="10" y="10" width="130" height="110" rx="12" fill="currentColor" className="text-muted/10" />
      <rect x="160" y="10" width="130" height="110" rx="12" fill="currentColor" className="text-muted/10" />
      <rect x="10" y="130" width="130" height="100" rx="12" fill="currentColor" className="text-muted/10" />
      <rect x="160" y="130" width="130" height="100" rx="12" fill="currentColor" className="text-muted/10" />

      {/* Zone labels */}
      <text x="20" y="26" fontSize="11" fontWeight="bold" fill="#94a3b8">Zone A</text>
      <text x="170" y="26" fontSize="11" fontWeight="bold" fill="#94a3b8">Zone B</text>
      <text x="20" y="146" fontSize="11" fontWeight="bold" fill="#94a3b8">Zone C</text>
      <text x="170" y="146" fontSize="11" fontWeight="bold" fill="#94a3b8">Zone D</text>

      {zonen.map(zl => {
        const pos = ZONE_POSITIONS[zl.zone];
        if (!pos) return null;
        const color = LEVEL_COLOR[zl.level];
        const r = Math.max(18, Math.min(38, 18 + zl.aktiv * 5));
        const opacity = zl.aktiv === 0 ? 0.25 : 0.7;

        return (
          <g key={zl.zone}>
            {/* Pulse ring for active zones */}
            {zl.aktiv > 0 && (
              <circle cx={pos.x} cy={pos.y} r={r + 8} fill={color} opacity={0.15} />
            )}
            {/* Main dot */}
            <circle cx={pos.x} cy={pos.y} r={r} fill={color} opacity={opacity} />
            {/* Driver count */}
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="14" fontWeight="900" fill="white">
              {zl.aktiv}
            </text>
            {/* Status line */}
            <text x={pos.x} y={pos.y + r + 12} textAnchor="middle"
              fontSize="9" fill={color} fontWeight="bold">
              {zl.aktiv > 0 ? `${zl.on_tour}T · ${zl.bereit}B` : '—'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DispatchPhase1125FahrerNetzHeatmap({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-netz-heatmap?location_id=${locationId}`);
      if (r.ok) setData(await r.json() as ApiData);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!locationId) return;
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load, locationId]);

  const d = data ?? (locationId ? null : MOCK);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-sky-500 shrink-0" />
          <span className="font-bold text-sm text-foreground">Fahrer-Netz-Heatmap</span>
          {d && (
            <span className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-black px-2 py-0.5">
              {d.gesamt_aktiv} aktiv · {d.gesamt_on_tour} on tour
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {!d && !locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}
          {d && (
            <>
              <HeatmapSvg zonen={d.zonen} />

              {/* Legend */}
              <div className="flex flex-wrap gap-2 justify-center text-[10px]">
                {(['leer', 'niedrig', 'mittel', 'hoch', 'voll'] as ZoneLoad['level'][]).map(lvl => (
                  <div key={lvl} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: LEVEL_COLOR[lvl] }} />
                    <span className="text-muted-foreground capitalize">{LEVEL_LABEL[lvl]}</span>
                  </div>
                ))}
              </div>

              {/* Zone details */}
              <div className="grid grid-cols-2 gap-2">
                {d.zonen.map(zl => (
                  <div key={zl.zone}
                    className="rounded-lg border border-border bg-background p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-foreground">Zone {zl.zone}</span>
                      <span className="text-[10px] font-bold capitalize px-1.5 py-0.5 rounded-full"
                        style={{ background: LEVEL_COLOR[zl.level] + '33', color: LEVEL_COLOR[zl.level] }}>
                        {LEVEL_LABEL[zl.level]}
                      </span>
                    </div>
                    {zl.fahrer.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Keine Fahrer</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {zl.fahrer.map(f => (
                          <li key={f.id} className="flex items-center gap-1 text-[11px]">
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                              f.status === 'on_tour' ? 'bg-orange-500' : 'bg-green-500')} />
                            <span className="truncate text-muted-foreground">{f.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-right">T = auf Tour · B = bereit · Aktualisiert: 60s</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
