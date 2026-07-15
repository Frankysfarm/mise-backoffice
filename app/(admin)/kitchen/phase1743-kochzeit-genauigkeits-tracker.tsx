'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

/**
 * Phase 1743 — Kochzeit-Genauigkeits-Tracker (Kitchen)
 *
 * Ø Abweichung zwischen geschätzter und tatsächlicher Zubereitungszeit
 * je Gericht; Ampel; useMemo; Props orders; Collapsible.
 */

interface OrderItem {
  name: string;
  [key: string]: unknown;
}

interface Order {
  id: string;
  status?: string;
  estimatedTime?: number;
  estimated_time?: number;
  acceptedAt?: string;
  accepted_at?: string;
  doneAt?: string;
  done_at?: string;
  items?: OrderItem[];
  [key: string]: unknown;
}

interface Props {
  orders: Order[];
  schwelle_gut?: number;
  schwelle_schlecht?: number;
}

interface GerichtProfil {
  name: string;
  messwerte: number;
  avg_delta_min: number;
  min_delta: number;
  max_delta: number;
  ampel: 'gut' | 'okay' | 'schlecht';
}

const SCHWELLE_GUT = 3;
const SCHWELLE_SCHLECHT = 7;

export function KitchenPhase1743KochzeitGenauigkeitsTracker({
  orders,
  schwelle_gut = SCHWELLE_GUT,
  schwelle_schlecht = SCHWELLE_SCHLECHT,
}: Props) {
  const [open, setOpen] = useState(false);

  const { profile, gesamtDelta, bestenGericht, schlechtestesGericht } = useMemo(() => {
    const map: Record<string, number[]> = {};

    for (const o of orders) {
      if (o.status !== 'done') continue;
      const acc = o.acceptedAt ?? o.accepted_at;
      const done = o.doneAt ?? o.done_at;
      const est = o.estimatedTime ?? o.estimated_time;
      if (!acc || !done || !est) continue;

      const tatsaechlich = (new Date(done).getTime() - new Date(acc).getTime()) / 60_000;
      const delta = tatsaechlich - est;

      for (const item of (o.items ?? [])) {
        if (!map[item.name]) map[item.name] = [];
        map[item.name].push(delta);
      }
    }

    const profile: GerichtProfil[] = Object.entries(map)
      .filter(([, v]) => v.length >= 2)
      .map(([name, deltas]) => {
        const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
        const absAvg = Math.abs(avg);
        return {
          name,
          messwerte: deltas.length,
          avg_delta_min: Math.round(avg * 10) / 10,
          min_delta: Math.round(Math.min(...deltas) * 10) / 10,
          max_delta: Math.round(Math.max(...deltas) * 10) / 10,
          ampel: (absAvg <= schwelle_gut ? 'gut' : absAvg <= schwelle_schlecht ? 'okay' : 'schlecht') as GerichtProfil['ampel'],
        };
      })
      .sort((a, b) => Math.abs(b.avg_delta_min) - Math.abs(a.avg_delta_min));

    const alle = profile.flatMap(p => [p.avg_delta_min]);
    const gesamtDelta = alle.length > 0
      ? Math.round(alle.reduce((s, v) => s + v, 0) / alle.length * 10) / 10
      : 0;

    const bestes = profile.filter(p => p.ampel === 'gut').sort((a, b) => Math.abs(a.avg_delta_min) - Math.abs(b.avg_delta_min))[0];
    const schlechtestes = profile.filter(p => p.ampel === 'schlecht').sort((a, b) => Math.abs(b.avg_delta_min) - Math.abs(a.avg_delta_min))[0];

    return { profile, gesamtDelta, bestenGericht: bestes, schlechtestesGericht: schlechtestes };
  }, [orders, schwelle_gut, schwelle_schlecht]);

  const ampelFarbe = Math.abs(gesamtDelta) <= schwelle_gut
    ? 'bg-matcha-50 border-matcha-200 text-matcha-700'
    : Math.abs(gesamtDelta) <= schwelle_schlecht
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-red-50 border-red-200 text-red-700';

  if (profile.length === 0) return null;

  return (
    <div className="mx-6 mb-3 rounded-xl border bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="text-sm font-bold text-char">Kochzeit-Genauigkeit</span>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', ampelFarbe)}>
            Ø {gesamtDelta > 0 ? '+' : ''}{gesamtDelta} Min Δ
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-3">
          {/* Zusammenfassung */}
          <div className="grid grid-cols-2 gap-2">
            {bestenGericht && (
              <div className="flex items-center gap-1.5 bg-matcha-50 border border-matcha-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-matcha-600 shrink-0" />
                <div>
                  <div className="text-[9px] font-black uppercase text-matcha-500">Genauestes Gericht</div>
                  <div className="text-xs font-bold text-matcha-700 truncate">{bestenGericht.name}</div>
                  <div className="text-[9px] font-mono text-matcha-500">Ø {bestenGericht.avg_delta_min > 0 ? '+' : ''}{bestenGericht.avg_delta_min} Min</div>
                </div>
              </div>
            )}
            {schlechtestesGericht && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <div>
                  <div className="text-[9px] font-black uppercase text-red-500">Ungenauestes Gericht</div>
                  <div className="text-xs font-bold text-red-700 truncate">{schlechtestesGericht.name}</div>
                  <div className="text-[9px] font-mono text-red-500">Ø {schlechtestesGericht.avg_delta_min > 0 ? '+' : ''}{schlechtestesGericht.avg_delta_min} Min</div>
                </div>
              </div>
            )}
          </div>

          {/* Gerichte-Tabelle */}
          <div className="space-y-1.5">
            {profile.slice(0, 8).map(g => {
              const dotColor = g.ampel === 'gut'
                ? 'bg-matcha-500'
                : g.ampel === 'okay'
                  ? 'bg-amber-400'
                  : 'bg-red-500';
              const barWidth = Math.min(100, (Math.abs(g.avg_delta_min) / (schwelle_schlecht * 2)) * 100);
              const barColor = g.ampel === 'gut' ? 'bg-matcha-400' : g.ampel === 'okay' ? 'bg-amber-400' : 'bg-red-400';
              return (
                <div key={g.name} className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium truncate text-char">{g.name}</span>
                      <span className="text-[10px] font-mono font-bold text-stone-600 ml-2 shrink-0">
                        {g.avg_delta_min > 0 ? '+' : ''}{g.avg_delta_min} Min
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="text-[9px] text-stone-400 shrink-0">{g.messwerte}×</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1 text-[9px] text-stone-400 pt-1 border-t border-stone-100">
            <TrendingUp className="w-3 h-3" />
            <span>Δ = tatsächliche − geschätzte Zubereitungszeit (Minuten)</span>
          </div>
        </div>
      )}
    </div>
  );
}
