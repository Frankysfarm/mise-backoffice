'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Trophy } from 'lucide-react';

/**
 * Phase 1009 — Tour-Effizienz-Live-Ranking (Dispatch)
 *
 * Echtzeit-Ranking aller aktiven Touren nach Umsatz/km-Marge.
 * Defizit-Alert wenn Marge < 0.
 * Polling: 90s.
 */

interface Props {
  locationId: string | null;
}

interface TourRank {
  tour_id: string;
  rang: number;
  fahrer_name: string;
  zone: string | null;
  umsatz_eur: number;
  km_gefahren: number;
  effizienz_eur_per_km: number;
  marge_pct: number;
  stopps_offen: number;
  ist_defizit: boolean;
}

interface ApiResponse {
  touren: TourRank[];
  defizit_count: number;
  top_effizienz_fahrer: string | null;
  location_id: string | null;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  touren: [
    { tour_id: 't1', rang: 1, fahrer_name: 'M. Bauer', zone: 'A', umsatz_eur: 87.5, km_gefahren: 12, effizienz_eur_per_km: 7.29, marge_pct: 79, stopps_offen: 2, ist_defizit: false },
    { tour_id: 't2', rang: 2, fahrer_name: 'L. Huber', zone: 'B', umsatz_eur: 63.0, km_gefahren: 18, effizienz_eur_per_km: 3.5, marge_pct: 55, stopps_offen: 3, ist_defizit: false },
    { tour_id: 't3', rang: 3, fahrer_name: 'K. Stein', zone: 'C', umsatz_eur: 34.0, km_gefahren: 28, effizienz_eur_per_km: 1.21, marge_pct: 22, stopps_offen: 2, ist_defizit: false },
    { tour_id: 't4', rang: 4, fahrer_name: 'A. König', zone: 'D', umsatz_eur: 19.5, km_gefahren: 47, effizienz_eur_per_km: 0.41, marge_pct: -21, stopps_offen: 1, ist_defizit: true },
  ],
  defizit_count: 1,
  top_effizienz_fahrer: 'M. Bauer',
  location_id: null,
  generiert_am: new Date().toISOString(),
};

function rangEmoji(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return `#${rang}`;
}

function margeColor(pct: number): string {
  if (pct < 0) return 'text-red-600 dark:text-red-400';
  if (pct < 20) return 'text-amber-600 dark:text-amber-400';
  return 'text-matcha-600 dark:text-matcha-400';
}

function effizBadge(eff: number): { cls: string; label: string } {
  if (eff >= 5) return { cls: 'bg-matcha-100 text-matcha-700 border-matcha-300', label: 'Top' };
  if (eff >= 2) return { cls: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Gut' };
  if (eff >= 1) return { cls: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Mittel' };
  return { cls: 'bg-red-100 text-red-700 border-red-300', label: 'Schwach' };
}

export function DispatchPhase1009TourEffizienzLiveRanking({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-effizienz-ranking?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      const json: ApiResponse = res.ok ? await res.json() : MOCK;
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 90_000);
    return () => clearInterval(id);
  }, [load]);

  const touren = data?.touren ?? [];
  const defizit = data?.defizit_count ?? 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold">Tour-Effizienz-Ranking</span>
          {defizit > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 border border-red-300 animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />
              {defizit} Defizit
            </span>
          )}
          {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {touren.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">Keine aktiven Touren</p>
          )}
          {touren.map(t => {
            const badge = effizBadge(t.effizienz_eur_per_km);
            return (
              <div
                key={t.tour_id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5',
                  t.ist_defizit ? 'border-red-300 bg-red-50/40' : 'border-border bg-muted/10',
                )}
              >
                <div className="shrink-0 w-8 text-center text-lg font-black">
                  {rangEmoji(t.rang)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold truncate">{t.fahrer_name}</span>
                    {t.zone && (
                      <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">Z{t.zone}</span>
                    )}
                    <span className={cn('text-[10px] font-bold tabular-nums', margeColor(t.marge_pct))}>
                      {t.marge_pct > 0 ? '+' : ''}{t.marge_pct}% Marge
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <TrendingUp className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {t.effizienz_eur_per_km.toFixed(2)} €/km · {t.km_gefahren} km · {t.umsatz_eur.toFixed(2)} €
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold', badge.cls)}>
                    {badge.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground tabular-nums">{t.stopps_offen} offen</span>
                </div>
              </div>
            );
          })}
          {data?.top_effizienz_fahrer && touren.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              Top: {data.top_effizienz_fahrer} · Ranking nach €/km
            </p>
          )}
        </div>
      )}
    </div>
  );
}
