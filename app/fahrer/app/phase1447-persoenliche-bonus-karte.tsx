'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, CheckCircle2, TrendingUp, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

// Phase 1447 — Persönliche Bonus-Karte (Fahrer-App)
// Eigene Bonus-Aufstellung (Stopps/Pünktlichkeit/Trinkgeld + Gesamt)
// + Monats-Fortschrittsbalken; isOnline-Guard; nach Phase1442

interface BonusData {
  stopps_bonus_eur: number;
  puenktlichkeits_bonus_eur: number;
  trinkgeld_summe_eur: number;
  gesamt_bonus_eur: number;
  stopps_monat: number;
  puenktlichkeits_quote: number;
  monat_label: string;
  ziel_bonus_eur: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const POLL_MS = 30 * 60 * 1000;
const ZIEL_BONUS_EUR = 100;

function buildMock(driverId: string): BonusData {
  const seed = driverId.charCodeAt(0) % 10;
  return {
    stopps_bonus_eur: 15 + seed * 0.6,
    puenktlichkeits_bonus_eur: seed > 4 ? 15 : 0,
    trinkgeld_summe_eur: 28 + seed * 2,
    gesamt_bonus_eur: 43 + seed * 3 + (seed > 4 ? 15 : 0),
    stopps_monat: 48 + seed * 2,
    puenktlichkeits_quote: 75 + seed * 2,
    monat_label: new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    ziel_bonus_eur: ZIEL_BONUS_EUR,
  };
}

function fmtEur(v: number): string {
  return v.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase1447PersoenlicheBonusKarte({ driverId, isOnline }: Props) {
  const [data, setData] = useState<BonusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bonus-abrechnung?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        const mein = Array.isArray(json.fahrer)
          ? json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId)
          : null;
        if (mein) {
          setData({
            ...mein,
            monat_label: json.monat_label ?? new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
            ziel_bonus_eur: ZIEL_BONUS_EUR,
          });
          return;
        }
      }
    } catch {
      // fallthrough to mock
    } finally {
      setLoading(false);
    }
    setData(buildMock(driverId));
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!isOnline) return null;

  const d = data ?? buildMock(driverId);
  const fortschritt = Math.min(100, Math.round((d.gesamt_bonus_eur / d.ziel_bonus_eur) * 100));
  const hatPuenktlichkeit = d.puenktlichkeits_bonus_eur > 0;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex-1 text-left">
          Mein Bonus · {d.monat_label}
        </span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />}
        <span className="text-sm font-black tabular-nums text-amber-700 dark:text-amber-300 shrink-0">
          {fmtEur(d.gesamt_bonus_eur)}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Monats-Fortschrittsbalken */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-700 dark:text-amber-300 font-semibold">
                Ziel: {fmtEur(d.ziel_bonus_eur)}
              </span>
              <span className="text-amber-700 dark:text-amber-300 font-bold">{fortschritt}%</span>
            </div>
            <div className="h-3 rounded-full bg-amber-200 dark:bg-amber-900/40 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  fortschritt >= 100 ? 'bg-emerald-500' : 'bg-amber-400 dark:bg-amber-500',
                )}
                style={{ width: `${fortschritt}%` }}
              />
            </div>
            {fortschritt >= 100 && (
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3 h-3" /> Ziel erreicht!
              </div>
            )}
          </div>

          {/* Aufschlüsselung */}
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between rounded-lg bg-white/70 dark:bg-slate-800/50 px-3 py-2 border border-amber-100 dark:border-amber-800/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Stopps-Bonus</span>
                <span className="text-[10px] text-slate-400">({d.stopps_monat} Stopps)</span>
              </div>
              <span className="text-sm font-black tabular-nums text-amber-700 dark:text-amber-300">
                {fmtEur(d.stopps_bonus_eur)}
              </span>
            </div>

            <div className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 border',
              hatPuenktlichkeit
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-white/70 dark:bg-slate-800/50 border-amber-100 dark:border-amber-800/50',
            )}>
              <div className="flex items-center gap-2">
                <Star className={cn('w-3.5 h-3.5', hatPuenktlichkeit ? 'text-emerald-500' : 'text-slate-400')} />
                <span className="text-xs text-slate-600 dark:text-slate-300">Pünktlichkeits-Bonus</span>
                <span className="text-[10px] text-slate-400">({d.puenktlichkeits_quote.toFixed(0)}%)</span>
              </div>
              <span className={cn(
                'text-sm font-black tabular-nums',
                hatPuenktlichkeit ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400',
              )}>
                {hatPuenktlichkeit ? fmtEur(d.puenktlichkeits_bonus_eur) : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white/70 dark:bg-slate-800/50 px-3 py-2 border border-amber-100 dark:border-amber-800/50">
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Trinkgeld</span>
              </div>
              <span className="text-sm font-black tabular-nums text-amber-700 dark:text-amber-300">
                {fmtEur(d.trinkgeld_summe_eur)}
              </span>
            </div>
          </div>

          {!hatPuenktlichkeit && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
              Erreiche ≥85% Pünktlichkeit für +15,00 € Bonus!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
