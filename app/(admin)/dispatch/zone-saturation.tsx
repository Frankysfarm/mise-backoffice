'use client';

import { useEffect, useState } from 'react';
import { Loader2, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';

type SaturationLevel = 'low' | 'medium' | 'high' | 'saturated';

interface ZoneSaturation {
  zone: string;
  ordersToday: number;
  historicalAvg: number;
  saturationPct: number;
  saturationLevel: SaturationLevel;
}

interface SaturationSummary {
  totalOrdersToday: number;
  avgSaturationPct: number;
  highestZone: string | null;
  lowestZone: string | null;
}

interface ApiResponse {
  ok: boolean;
  zones: ZoneSaturation[];
  summary: SaturationSummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const satStyle: Record<SaturationLevel, { row: string; badge: string; label: string; bar: string; text: string }> = {
  low:       { row: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700',   label: 'Niedrig',    bar: 'bg-blue-400',   text: 'text-blue-600' },
  medium:    { row: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700', label: 'Mittel',     bar: 'bg-amber-400',  text: 'text-amber-600' },
  high:      { row: 'bg-green-50',  badge: 'bg-green-100 text-green-700', label: 'Hoch',       bar: 'bg-green-500',  text: 'text-green-600' },
  saturated: { row: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700', label: 'Gesättigt', bar: 'bg-violet-500', text: 'text-violet-600' },
};

function DonutSegment({ pct, color }: { pct: number; color: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(1, pct / 100) * circ;
  return (
    <circle
      cx="50" cy="50" r={r}
      fill="none"
      stroke={color}
      strokeWidth="12"
      strokeDasharray={`${dash} ${circ - dash}`}
      strokeDashoffset={circ * 0.25}
      strokeLinecap="round"
    />
  );
}

export function DispatchZoneSaturation({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneSaturation[]>([]);
  const [summary, setSummary] = useState<SaturationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/zone-saturation?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setZones(d.zones ?? []);
        setSummary(d.summary ?? null);
        setLastUpdate(d.generatedAt ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && zones.length === 0) return null;

  const saturatedCount = zones.filter((z) => z.saturationLevel === 'saturated').length;
  const lowCount = zones.filter((z) => z.saturationLevel === 'low').length;

  const donutColors: Record<SaturationLevel, string> = {
    low: '#60a5fa', medium: '#fbbf24', high: '#22c55e', saturated: '#8b5cf6',
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <PieChart className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Sättigung</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {saturatedCount > 0 && (
          <span className="ml-2 rounded-full bg-violet-100 text-violet-700 px-2.5 py-0.5 text-[10px] font-bold">
            {saturatedCount} gesättigt
          </span>
        )}
        {!loading && lowCount > 0 && (
          <span className="ml-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
            {lowCount} niedrig
          </span>
        )}
        {summary && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {summary.totalOrdersToday} Bestellungen heute · Ø {summary.avgSaturationPct}%
          </span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Summary + Donut row */}
          {summary && zones.length > 0 && (
            <div className="flex items-center gap-6 px-5 py-4 border-b border-stone-100 bg-stone-50">
              {/* Mini Donut */}
              <div className="relative shrink-0">
                <svg viewBox="0 0 100 100" width="80" height="80">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                  {zones.map((z, i) => {
                    const total = zones.reduce((s, x) => s + x.ordersToday, 0) || 1;
                    const pct = (z.ordersToday / total) * 100;
                    const offset = zones.slice(0, i).reduce((s, x) => s + (x.ordersToday / total) * 100, 0);
                    const circ = 2 * Math.PI * 40;
                    const dash = (pct / 100) * circ;
                    const dashOffset = circ * 0.25 - (offset / 100) * circ;
                    return (
                      <circle
                        key={z.zone}
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke={donutColors[z.saturationLevel]}
                        strokeWidth="12"
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="butt"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-stone-600 tabular-nums text-center leading-tight">
                    {summary.avgSaturationPct}%
                    <br />
                    <span className="text-[8px] font-normal text-stone-400">Ø</span>
                  </span>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">Heute gesamt</div>
                  <div className="text-xl font-black tabular-nums text-foreground">{summary.totalOrdersToday}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">Ø Sättigung</div>
                  <div className={cn('text-xl font-black tabular-nums',
                    summary.avgSaturationPct >= 120 ? 'text-violet-600' :
                    summary.avgSaturationPct >= 80  ? 'text-green-600' :
                    summary.avgSaturationPct >= 40  ? 'text-amber-500' : 'text-blue-500'
                  )}>
                    {summary.avgSaturationPct}%
                  </div>
                </div>
                {summary.highestZone && (
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">Höchste Zone</div>
                    <div className="text-sm font-bold text-violet-600">Zone {summary.highestZone}</div>
                  </div>
                )}
                {summary.lowestZone && summary.lowestZone !== summary.highestZone && (
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">Niedrigste Zone</div>
                    <div className="text-sm font-bold text-blue-500">Zone {summary.lowestZone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Zone Table */}
          <div className="divide-y divide-stone-100">
            {[...zones].sort((a, b) => b.saturationPct - a.saturationPct).map((z) => {
              const s = satStyle[z.saturationLevel];
              const barWidth = Math.min(100, z.saturationPct);

              return (
                <div key={z.zone} className={cn('px-5 py-3 flex items-center gap-3', s.row)}>
                  {/* Zone Name */}
                  <div className="w-16 shrink-0">
                    <span className="font-bold text-sm">Zone {z.zone}</span>
                  </div>

                  {/* Bar + Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.badge)}>
                        {s.label}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {z.ordersToday} heute · Ø {z.historicalAvg} historisch
                      </span>
                    </div>
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Pct */}
                  <div className={cn('text-right shrink-0 font-mono text-sm font-black tabular-nums', s.text)}>
                    {z.saturationPct}%
                  </div>
                </div>
              );
            })}
          </div>

          {lastUpdate && (
            <div className="px-5 py-2 text-[10px] text-stone-400 border-t border-stone-100 text-right">
              Aktualisiert: {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 2 Min
            </div>
          )}
        </div>
      )}
    </div>
  );
}
