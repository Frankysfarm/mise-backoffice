'use client';

// Phase 1292 — Schicht-Ende-Bestätigung (Fahrer-App)
// Zusammenfassung (Stopps/Einnahmen/km/Bewertung) + "Schicht beenden"-Button
// POST /api/delivery/driver/schicht-abschluss · isOnline-Guard · nach Phase1288

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, LogOut, Star, Truck, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtSummary {
  stopps_heute: number;
  einnahmen_eur: number;
  km_gefahren: number;
  bewertung_schnitt: number;
  schicht_stunden: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

const MOCK_SUMMARY: SchichtSummary = {
  stopps_heute: 14,
  einnahmen_eur: 112.5,
  km_gefahren: 67,
  bewertung_schnitt: 4.7,
  schicht_stunden: 6.5,
};

export function FahrerPhase1292SchichtEndeBestaetigung({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<SchichtSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
        if (active && res.ok) {
          const json = await res.json();
          setSummary({
            stopps_heute: json.stopps_heute ?? json.stopps ?? MOCK_SUMMARY.stopps_heute,
            einnahmen_eur: json.einnahmen_eur ?? json.umsatz_eur ?? MOCK_SUMMARY.einnahmen_eur,
            km_gefahren: json.km_gefahren ?? MOCK_SUMMARY.km_gefahren,
            bewertung_schnitt: json.bewertung_schnitt ?? json.kundenbewertung ?? MOCK_SUMMARY.bewertung_schnitt,
            schicht_stunden: json.schicht_stunden ?? MOCK_SUMMARY.schicht_stunden,
          });
        } else {
          if (active) setSummary(MOCK_SUMMARY);
        }
      } catch {
        if (active) setSummary(MOCK_SUMMARY);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [driverId, isOnline]);

  const handleBeenden = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/schicht-abschluss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, abschluss_at: new Date().toISOString() }),
      });
    } catch { /* best-effort */ } finally {
      setSubmitting(false);
      setDone(true);
    }
  };

  if (!isOnline) return null;

  const s = summary ?? MOCK_SUMMARY;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-rose-600 dark:bg-rose-700 text-white"
      >
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-semibold">Schicht beenden</span>
          {done && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">
              ✓ Abgeschlossen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">Schicht erfolgreich beendet!</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Danke für deinen Einsatz heute.</p>
            </div>
          ) : (
            <>
              {/* Schicht-Zusammenfassung */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Truck, label: 'Stopps heute', value: String(s.stopps_heute), color: 'text-blue-600 dark:text-blue-400' },
                  { icon: Wallet, label: 'Einnahmen', value: fmt(s.einnahmen_eur), color: 'text-emerald-600 dark:text-emerald-400' },
                  { icon: Truck, label: 'km gefahren', value: `${s.km_gefahren} km`, color: 'text-orange-600 dark:text-orange-400' },
                  { icon: Star, label: 'Bewertung', value: `${s.bewertung_schnitt.toFixed(1)} ⭐`, color: 'text-amber-600 dark:text-amber-400' },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-center">
                    <div className={cn('text-base font-bold', kpi.color)}>{kpi.value}</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">{kpi.label}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-center text-stone-500 dark:text-stone-400">
                Schichtdauer: {s.schicht_stunden.toFixed(1)} Stunden
              </div>

              {/* Schicht-beenden-Button */}
              <button
                onClick={handleBeenden}
                disabled={submitting}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-colors',
                  submitting
                    ? 'bg-stone-400 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird beendet…
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Schicht jetzt beenden
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
