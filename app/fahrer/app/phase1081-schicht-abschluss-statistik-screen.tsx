'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Package, Euro, Route, Star, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

/**
 * Phase 1081 — Schicht-Abschluss-Statistik-Screen (Fahrer-App)
 *
 * Tages-Summary mit Stopps / Umsatz / km / Trinkgeld + Motivations-Badge.
 * Erscheint wenn Fahrer offline geht oder Schicht endet.
 */

interface SchichtStats {
  stopps: number;
  umsatz_eur: number;
  km: number;
  trinkgeld_eur: number;
  bewertung_ø: number | null;
  touren: number;
  schicht_dauer_min: number;
  stopps_pro_stunde: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

type Badge = { emoji: string; titel: string; farbe: string };

function motivationsBadge(stats: SchichtStats): Badge {
  if (stats.stopps >= 20 && stats.bewertung_ø !== null && stats.bewertung_ø >= 4.8)
    return { emoji: '🏆', titel: 'Top-Fahrer des Tages!', farbe: 'from-yellow-400 to-amber-500' };
  if (stats.stopps >= 15)
    return { emoji: '⚡', titel: 'Starke Schicht!', farbe: 'from-blue-500 to-indigo-600' };
  if (stats.trinkgeld_eur >= 10)
    return { emoji: '💰', titel: 'Trinkgeld-König!', farbe: 'from-green-500 to-emerald-600' };
  if (stats.bewertung_ø !== null && stats.bewertung_ø >= 4.9)
    return { emoji: '⭐', titel: 'Kunden lieben dich!', farbe: 'from-purple-500 to-pink-500' };
  if (stats.stopps >= 10)
    return { emoji: '👍', titel: 'Gute Schicht!', farbe: 'from-matcha-500 to-matcha-600' };
  return { emoji: '✅', titel: 'Schicht abgeschlossen', farbe: 'from-gray-500 to-gray-600' };
}

function mockStats(): SchichtStats {
  return {
    stopps: 14,
    umsatz_eur: 287.50,
    km: 42.3,
    trinkgeld_eur: 8.40,
    bewertung_ø: 4.7,
    touren: 6,
    schicht_dauer_min: 368,
    stopps_pro_stunde: 2.3,
  };
}

function formatDauer(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn('h-3 w-3', s <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')} />
      ))}
      <span className="ml-1 text-xs font-bold">{value.toFixed(1)}</span>
    </div>
  );
}

export function FahrerPhase1081SchichtAbschlussStatistikScreen({ driverId, isOnline }: Props) {
  const [stats, setStats] = useState<SchichtStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const r = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}&date=${today}`);
        if (r.ok) {
          const json = await r.json();
          const b = json.bilanz ?? json;
          setStats({
            stopps: b.stopps_gesamt ?? 0,
            umsatz_eur: b.umsatz_eur ?? 0,
            km: b.kilometer ?? 0,
            trinkgeld_eur: b.trinkgeld_eur ?? 0,
            bewertung_ø: b.durchschnitt_bewertung ?? null,
            touren: Math.ceil((b.stopps_gesamt ?? 0) / 3),
            schicht_dauer_min: b.schicht_dauer_min ?? 0,
            stopps_pro_stunde: b.schicht_dauer_min > 0 ? parseFloat(((b.stopps_gesamt ?? 0) / (b.schicht_dauer_min / 60)).toFixed(1)) : 0,
          });
        } else throw new Error();
      } catch {
        setStats(mockStats());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [driverId]);

  if (isOnline) return null;
  if (loading) return (
    <div className="rounded-2xl bg-card border p-4 flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Schicht-Statistik lädt…
    </div>
  );

  const s = stats ?? mockStats();
  const badge = motivationsBadge(s);

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-md overflow-hidden">
      {/* Header mit Motivations-Badge */}
      <div className={cn('bg-gradient-to-r px-4 py-4 text-white', badge.farbe)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl mb-0.5">{badge.emoji}</div>
            <div className="text-lg font-black">{badge.titel}</div>
            <div className="text-sm opacity-80">Schichtdauer: {formatDauer(s.schicht_dauer_min)}</div>
          </div>
          <button onClick={() => setOpen(o => !o)} className="p-1 rounded-lg bg-white/20 hover:bg-white/30 transition">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* 4 KPI-Kacheln */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[11px] text-blue-700 font-medium uppercase tracking-wide">Stopps</span>
              </div>
              <div className="text-2xl font-black text-blue-700">{s.stopps}</div>
              <div className="text-[10px] text-blue-500">{s.touren} Touren · {s.stopps_pro_stunde.toFixed(1)}/h</div>
            </div>

            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Euro className="h-3.5 w-3.5 text-green-600" />
                <span className="text-[11px] text-green-700 font-medium uppercase tracking-wide">Umsatz</span>
              </div>
              <div className="text-2xl font-black text-green-700">{euro(s.umsatz_eur)}</div>
              <div className="text-[10px] text-green-500">Ø {euro(s.stopps > 0 ? s.umsatz_eur / s.stopps : 0)}/Stopp</div>
            </div>

            <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Route className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-[11px] text-purple-700 font-medium uppercase tracking-wide">Kilometer</span>
              </div>
              <div className="text-2xl font-black text-purple-700">{s.km.toFixed(1)} km</div>
              <div className="text-[10px] text-purple-500">Ø {s.stopps > 0 ? (s.km / s.stopps).toFixed(1) : '0'} km/Stopp</div>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[11px] text-amber-700 font-medium uppercase tracking-wide">Trinkgeld</span>
              </div>
              <div className="text-2xl font-black text-amber-700">{euro(s.trinkgeld_eur)}</div>
              <div className="text-[10px] text-amber-500">Ø {euro(s.touren > 0 ? s.trinkgeld_eur / s.touren : 0)}/Tour</div>
            </div>
          </div>

          {/* Bewertung */}
          {s.bewertung_ø !== null && (
            <div className="flex items-center justify-between rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Kundenbewertung heute</span>
              </div>
              <StarRating value={s.bewertung_ø} />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Tages-Statistik · Schicht beendet
          </p>
        </div>
      )}
    </div>
  );
}
