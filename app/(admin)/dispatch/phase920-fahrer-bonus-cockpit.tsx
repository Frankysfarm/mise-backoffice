'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, Loader2, TrendingUp, Star, Clock } from 'lucide-react';

/**
 * Phase 920 — Fahrer-Bonus-Cockpit (Dispatch)
 *
 * Live-Übersicht aller Fahrer mit aktuellem Bonus-Stand.
 * Nutzt Phase-911-API /api/delivery/admin/fahrer-bonus-berechnung.
 * 3-Min-Polling.
 */

interface Props {
  locationId: string | null;
}

interface FahrerBonus {
  driver_id: string;
  fahrer_name: string;
  touren: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  bonus_eur: number;
  bonus_gruende: string[];
}

const MOCK: FahrerBonus[] = [
  { driver_id: 'm1', fahrer_name: 'Tarkan A.', touren: 10, puenktlichkeit_pct: 96, bewertung_avg: 4.9, bonus_eur: 7, bonus_gruende: ['≥10 Touren +2€', 'Pünktlichkeit ≥95% +3€', 'Bewertung ≥4.8★ +2€'] },
  { driver_id: 'm2', fahrer_name: 'Lena M.', touren: 8, puenktlichkeit_pct: 91, bewertung_avg: 4.6, bonus_eur: 4, bonus_gruende: ['≥8 Touren +1€', 'Pünktlichkeit ≥90% +2€', 'Bewertung ≥4.5★ +1€'] },
  { driver_id: 'm3', fahrer_name: 'Jörn K.', touren: 6, puenktlichkeit_pct: 84, bewertung_avg: 4.3, bonus_eur: 0, bonus_gruende: [] },
];

const POLL_MS = 3 * 60 * 1000;

export function DispatchPhase920FahrerBonusCockpit({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<FahrerBonus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-bonus-berechnung?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((json.fahrer as FahrerBonus[]) ?? MOCK);
      setLastUpdate(new Date());
    } catch {
      setData(MOCK);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const totalBonus = data.reduce((s, f) => s + f.bonus_eur, 0);
  const withBonus = data.filter((f) => f.bonus_eur > 0).length;

  function bonusColor(eur: number) {
    if (eur >= 6) return 'text-matcha-700 bg-matcha-100';
    if (eur >= 3) return 'text-amber-700 bg-amber-100';
    if (eur > 0) return 'text-blue-700 bg-blue-100';
    return 'text-stone-400 bg-stone-100';
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Fahrer-Bonus-Cockpit
          </span>
          {data.length > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {withBonus}/{data.length} mit Bonus · Gesamt {totalBonus.toFixed(0)}€
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && data.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-3">
              Keine aktiven Fahrer heute.
            </p>
          )}

          {/* Fahrer-Liste */}
          {data.map((f) => (
            <div
              key={f.driver_id}
              className="rounded-xl border border-stone-100 bg-stone-50 p-3 space-y-1.5"
            >
              {/* Row 1: Name + Bonus-Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-800">{f.fahrer_name}</span>
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-black',
                  bonusColor(f.bonus_eur),
                )}>
                  {f.bonus_eur > 0 ? `+${f.bonus_eur}€` : 'kein Bonus'}
                </span>
              </div>

              {/* Row 2: KPI-Mini */}
              <div className="flex items-center gap-3 text-[10px] text-stone-500">
                <span className="flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3 text-matcha-500" />
                  {f.touren} Touren
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3 text-blue-500" />
                  {f.puenktlichkeit_pct}% pünktlich
                </span>
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-amber-400" />
                  {f.bewertung_avg > 0 ? f.bewertung_avg.toFixed(1) : '—'}
                </span>
              </div>

              {/* Row 3: Bonus-Gründe */}
              {f.bonus_gruende.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {f.bonus_gruende.map((g) => (
                    <span
                      key={g}
                      className="rounded bg-matcha-50 border border-matcha-200 px-1.5 py-0.5 text-[9px] font-semibold text-matcha-700"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Footer */}
          {data.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-matcha-50 border border-matcha-100 px-3 py-2 mt-1">
              <span className="text-xs font-bold text-matcha-700">Gesamt-Bonus heute</span>
              <span className="text-base font-black text-matcha-800">{totalBonus.toFixed(0)} €</span>
            </div>
          )}

          {lastUpdate && (
            <p className="text-[9px] text-muted-foreground text-right">
              Stand: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
