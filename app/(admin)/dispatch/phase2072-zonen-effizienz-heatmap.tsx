'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, ChevronDown, ChevronUp, AlertTriangle, TrendingDown } from 'lucide-react';

interface ZonenItem {
  zone: string;
  avg_lieferzeit_min: number;
  avg_km: number;
  bestellungen_heute: number;
  auslastung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ZonenData {
  zonen: ZonenItem[];
  best_zone: string | null;
  worst_zone: string | null;
  team_avg_lieferzeit_min: number;
  alert_count: number;
}

const MOCK: ZonenData = {
  zonen: [
    { zone: 'A', avg_lieferzeit_min: 22, avg_km: 3.2, bestellungen_heute: 18, auslastung_pct: 72, ampel: 'gruen', alert: false },
    { zone: 'B', avg_lieferzeit_min: 31, avg_km: 5.1, bestellungen_heute: 12, auslastung_pct: 48, ampel: 'gelb', alert: false },
    { zone: 'C', avg_lieferzeit_min: 41, avg_km: 7.8, bestellungen_heute: 7,  auslastung_pct: 28, ampel: 'gelb', alert: false },
    { zone: 'D', avg_lieferzeit_min: 52, avg_km: 11.4, bestellungen_heute: 3, auslastung_pct: 12, ampel: 'rot',  alert: true  },
  ],
  best_zone: 'A',
  worst_zone: 'D',
  team_avg_lieferzeit_min: 32,
  alert_count: 1,
};

const POLL_MS = 30 * 60 * 1000;
const ALERT_MIN = 45;

const AMPEL_STYLE = {
  gruen: { tile: 'bg-green-950/60 border-green-800',  badge: 'bg-green-900 text-green-300',  bar: 'bg-green-500',  label: 'Gut'       },
  gelb:  { tile: 'bg-amber-950/60 border-amber-800',  badge: 'bg-amber-900 text-amber-300',  bar: 'bg-amber-400',  label: 'Mittel'    },
  rot:   { tile: 'bg-red-950/60   border-red-800',    badge: 'bg-red-900   text-red-300',    bar: 'bg-red-500',    label: 'Kritisch'  },
};

export function DispatchPhase2072ZonenEffizienzHeatmap({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ZonenData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/lieferzonen-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: ZonenData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const alertZonen = d.zonen.filter(z => z.alert);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Map className="w-4 h-4 text-blue-400" />
          Zonen-Effizienz-Heatmap
          <span className="text-xs text-gray-400 font-normal">Ø Lieferzeit je Zone</span>
          {d.alert_count > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-red-950 text-red-300">
              <AlertTriangle className="w-3 h-3" />
              {d.alert_count} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-gray-800 px-2 py-2 text-center">
              <div className="text-base font-black tabular-nums text-blue-300">{d.team_avg_lieferzeit_min} Min</div>
              <div className="text-[10px] text-gray-400">Team-Ø Lieferzeit</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-2 text-center">
              <div className="text-base font-black tabular-nums text-green-300">{d.best_zone ?? '–'}</div>
              <div className="text-[10px] text-gray-400">Beste Zone</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-2 text-center">
              <div className={cn('text-base font-black tabular-nums', d.alert_count > 0 ? 'text-red-400' : 'text-amber-300')}>
                {d.worst_zone ?? '–'}
              </div>
              <div className="text-[10px] text-gray-400">Schwächste Zone</div>
            </div>
          </div>

          {/* Alert banner */}
          {alertZonen.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="text-xs text-red-300">
                <strong>Zone {alertZonen.map(z => z.zone).join(', ')}</strong> — Ø Lieferzeit &gt;{ALERT_MIN} Min.
                Mehr Fahrer einteilen oder Zone vorübergehend schließen.
              </div>
            </div>
          )}

          {/* Zone tiles */}
          <div className="grid grid-cols-2 gap-2">
            {d.zonen.map(z => {
              const s = AMPEL_STYLE[z.ampel];
              const barPct = Math.min((z.avg_lieferzeit_min / 60) * 100, 100);
              return (
                <div key={z.zone} className={cn('rounded-lg border p-3 space-y-2', s.tile)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-gray-100">Zone {z.zone}</span>
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold', s.badge)}>{s.label}</span>
                  </div>

                  {/* Main metric */}
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-black tabular-nums text-gray-100">{z.avg_lieferzeit_min}</span>
                    <span className="text-xs text-gray-400 mb-0.5">Min Ø</span>
                  </div>

                  {/* Bar */}
                  <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  {/* Secondary metrics */}
                  <div className="grid grid-cols-2 gap-1 text-center">
                    <div>
                      <div className="text-xs font-bold tabular-nums text-gray-300">{z.avg_km} km</div>
                      <div className="text-[9px] text-gray-500">Ø km</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold tabular-nums text-gray-300">{z.bestellungen_heute}</div>
                      <div className="text-[9px] text-gray-500">Aufträge</div>
                    </div>
                  </div>

                  {/* Auslastung */}
                  <div className="text-[10px] text-gray-500">
                    Auslastung: <span className="font-bold text-gray-400">{z.auslastung_pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tipp */}
          {d.worst_zone && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-950/40 border border-blue-900/50 px-3 py-2">
              <TrendingDown className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-200">
                Zone {d.worst_zone} hat die längste Lieferzeit — erwäge Fahrer-Umverteilung oder Batch-Bündelung.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
