'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, Star, TrendingUp, Package, Clock, Loader2 } from 'lucide-react';

/**
 * Phase 959 — Schicht-Abschluss-Protokoll (Fahrer-App)
 *
 * Zusammenfassung aller Touren + Einnahmen + Bewertungen bei Schichtende.
 * 10-Min-Polling, isOnline-Guard, Supabase-Fallback auf Mock.
 */

interface SchichtBilanz {
  datum: string;
  schicht_start: string | null;
  schicht_ende: string | null;
  schicht_dauer_min: number;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  bonus_eur: number;
  gesamt_eur: number;
  durchschnitt_bewertung: number | null;
  kilometer: number;
  status: 'aktiv' | 'abgeschlossen' | 'keine_schicht';
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

function formatDauer(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min`;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

function formatEur(value: number): string {
  return value.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase959SchichtAbschlussProtokoll({ driverId, isOnline }: Props) {
  const [data, setData] = useState<SchichtBilanz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  if (!isOnline || (!loading && !data)) return null;
  if (loading) return (
    <section className="mb-3 rounded-2xl bg-gradient-to-br from-matcha-900 to-matcha-800 p-4 text-matcha-50">
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="h-5 w-5 animate-spin opacity-60" />
        <span className="text-sm opacity-60">Schicht-Bilanz wird geladen…</span>
      </div>
    </section>
  );

  if (!data || data.status === 'keine_schicht') return null;

  const abschlussquote = data.stopps_gesamt > 0
    ? Math.round((data.stopps_abgeschlossen / data.stopps_gesamt) * 100)
    : 0;

  const isAbgeschlossen = data.status === 'abgeschlossen';

  return (
    <section
      className={cn(
        'mb-3 rounded-2xl p-4 text-white',
        isAbgeschlossen
          ? 'bg-gradient-to-br from-matcha-900 to-emerald-900'
          : 'bg-gradient-to-br from-stone-800 to-stone-900',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle className={cn('h-5 w-5', isAbgeschlossen ? 'text-emerald-300' : 'text-stone-400')} />
        <span className="font-bold">
          {isAbgeschlossen ? 'Schicht-Abschluss-Protokoll' : 'Aktuelle Schicht-Bilanz'}
        </span>
        {isAbgeschlossen && (
          <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            Abgeschlossen
          </span>
        )}
      </div>

      {/* Haupt-KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-xs opacity-70">Gesamteinnahmen</div>
          <div className="mt-0.5 text-xl font-bold text-emerald-300">{formatEur(data.gesamt_eur)}</div>
          <div className="mt-1 flex gap-2 text-xs opacity-70">
            <span>{formatEur(data.umsatz_eur)} Fahrten</span>
          </div>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <div className="text-xs opacity-70">Schichtdauer</div>
          <div className="mt-0.5 text-xl font-bold">{formatDauer(data.schicht_dauer_min)}</div>
          {data.schicht_start && (
            <div className="mt-1 text-xs opacity-70">
              ab {new Date(data.schicht_start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
        </div>
      </div>

      {/* Detail-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/10 p-2">
          <Package className="mx-auto mb-1 h-4 w-4 opacity-70" />
          <div className="text-sm font-bold">{data.stopps_abgeschlossen}/{data.stopps_gesamt}</div>
          <div className="text-xs opacity-60">Stopps</div>
        </div>
        <div className="rounded-xl bg-white/10 p-2">
          <Star className="mx-auto mb-1 h-4 w-4 opacity-70" />
          <div className="text-sm font-bold">
            {data.durchschnitt_bewertung !== null ? data.durchschnitt_bewertung.toFixed(1) : '–'}
          </div>
          <div className="text-xs opacity-60">Ø Bewertung</div>
        </div>
        <div className="rounded-xl bg-white/10 p-2">
          <TrendingUp className="mx-auto mb-1 h-4 w-4 opacity-70" />
          <div className="text-sm font-bold">{abschlussquote}%</div>
          <div className="text-xs opacity-60">Erfolgsquote</div>
        </div>
      </div>

      {/* Trinkgeld & Bonus */}
      {(data.trinkgeld_eur > 0 || data.bonus_eur > 0) && (
        <div className="mt-3 flex gap-2">
          {data.trinkgeld_eur > 0 && (
            <div className="flex-1 rounded-xl bg-amber-400/20 p-2 text-center">
              <div className="text-xs text-amber-300 opacity-80">Trinkgeld</div>
              <div className="font-bold text-amber-300">{formatEur(data.trinkgeld_eur)}</div>
            </div>
          )}
          {data.bonus_eur > 0 && (
            <div className="flex-1 rounded-xl bg-purple-400/20 p-2 text-center">
              <div className="text-xs text-purple-300 opacity-80">Bonus</div>
              <div className="font-bold text-purple-300">{formatEur(data.bonus_eur)}</div>
            </div>
          )}
        </div>
      )}

      {isAbgeschlossen && (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-400/20 px-3 py-2 text-sm text-emerald-300">
          <Clock className="h-4 w-4" />
          Schicht beendet um{' '}
          {data.schicht_ende
            ? new Date(data.schicht_ende).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : '–'}{' '}
          Uhr — Gute Arbeit! 🎉
        </div>
      )}
    </section>
  );
}
