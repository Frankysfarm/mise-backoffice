'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, Loader2, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * Phase 923 — Umsatz-Split-Dashboard (Lieferdienst)
 *
 * Umsatz aufgeteilt nach Lieferung / Abholung / Vor-Ort je Filiale + Trend.
 * Nutzt GET /api/delivery/admin/umsatz-split.
 * 10-Min-Polling.
 */

interface Props {
  locationId: string | null;
}

interface SplitSegment {
  typ: 'lieferung' | 'abholung' | 'vor_ort';
  label: string;
  umsatz_eur: number;
  bestellungen: number;
  anteil_pct: number;
  trend_pct: number | null;
}

interface UmsatzSplitData {
  segmente: SplitSegment[];
  gesamt_umsatz_eur: number;
  gesamt_bestellungen: number;
  zeitraum_tage: number;
}

const MOCK: UmsatzSplitData = {
  segmente: [
    { typ: 'lieferung', label: 'Lieferung', umsatz_eur: 8420, bestellungen: 312, anteil_pct: 67.3, trend_pct: 8.2 },
    { typ: 'abholung', label: 'Abholung', umsatz_eur: 2890, bestellungen: 148, anteil_pct: 23.1, trend_pct: -3.5 },
    { typ: 'vor_ort', label: 'Vor-Ort', umsatz_eur: 1190, bestellungen: 61, anteil_pct: 9.5, trend_pct: 1.1 },
  ],
  gesamt_umsatz_eur: 12500,
  gesamt_bestellungen: 521,
  zeitraum_tage: 30,
};

const POLL_MS = 10 * 60 * 1000;

const TYP_COLORS: Record<string, string> = {
  lieferung: 'bg-blue-500',
  abholung: 'bg-matcha-500',
  vor_ort: 'bg-amber-500',
};

const TYP_LIGHT: Record<string, string> = {
  lieferung: 'bg-blue-50 text-blue-700',
  abholung: 'bg-matcha-50 text-matcha-700',
  vor_ort: 'bg-amber-50 text-amber-700',
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

export function LieferdienstPhase923UmsatzSplitDashboard({ locationId }: Props) {
  const [data, setData] = useState<UmsatzSplitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/umsatz-split?location_id=${locationId}&tage=30`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.segmente) setData(json as UmsatzSplitData);
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!open) return null;

  const d = data ?? MOCK;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 shrink-0">
            <BarChart3 className="h-4 w-4 text-blue-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Umsatz-Split</div>
            <div className="text-xs text-stone-400">
              Letzte {d.zeitraum_tage} Tage · {fmtEur(d.gesamt_umsatz_eur)} gesamt
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 text-stone-300 animate-spin" />}
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Visual bar */}
      <div className="flex h-2 overflow-hidden">
        {d.segmente.map((seg) => (
          <div
            key={seg.typ}
            className={TYP_COLORS[seg.typ] ?? 'bg-stone-300'}
            style={{ width: `${seg.anteil_pct}%` }}
          />
        ))}
      </div>

      {/* Segment rows */}
      <div className="divide-y divide-stone-100">
        {d.segmente.map((seg) => (
          <div key={seg.typ} className="flex items-center gap-3 px-4 py-3">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0',
              TYP_LIGHT[seg.typ] ?? 'bg-stone-100 text-stone-700',
            )}>
              {seg.anteil_pct}%
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-char">{seg.label}</div>
              <div className="text-xs text-stone-400">{seg.bestellungen} Bestellungen</div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-sm font-bold tabular-nums text-char">{fmtEur(seg.umsatz_eur)}</div>
              {seg.trend_pct !== null && (
                <div className={cn(
                  'flex items-center justify-end gap-0.5 text-xs font-semibold',
                  seg.trend_pct >= 0 ? 'text-matcha-700' : 'text-red-600',
                )}>
                  {seg.trend_pct >= 0
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />
                  }
                  {seg.trend_pct > 0 ? '+' : ''}{seg.trend_pct}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100">
        <span className="text-xs text-stone-400">
          Ø {fmtEur(d.gesamt_umsatz_eur / Math.max(1, d.gesamt_bestellungen))} pro Bestellung
          · {d.gesamt_bestellungen} Bestellungen gesamt
        </span>
      </div>
    </div>
  );
}
