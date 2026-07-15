'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface StopInput {
  id: string;
  geliefert_am?: string | null;
  trinkgeld_eur?: number | null;
}

interface Props {
  isOnline: boolean;
  driverId: string | null;
  stops?: StopInput[];
  schichtStartedAt?: string;
}

interface BonusVorschau {
  puenktlichkeit: number;
  touren: number;
  gesamt: number;
}

function fmtEur(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} Min`;
}

export function FahrerPhase1639FeierabendZusammenfassungCard({ isOnline, driverId, stops = [], schichtStartedAt }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [bonusVorschau, setBonusVorschau] = useState<BonusVorschau | null>(null);
  const [loadingBonus, setLoadingBonus] = useState(false);

  // Nur anzeigen wenn OFFLINE (isOnline Guard invers)
  const alleGeliefert = stops.length > 0 && stops.every((s) => !!s.geliefert_am);
  const visible = !isOnline && alleGeliefert && !dismissed;

  const schichtMinuten = schichtStartedAt
    ? Math.floor((Date.now() - new Date(schichtStartedAt).getTime()) / 60_000)
    : null;

  const gelieferteStopps = stops.filter((s) => !!s.geliefert_am).length;
  const trinkgeldGesamt  = stops.reduce((acc, s) => acc + (s.trinkgeld_eur ?? 0), 0);

  const loadBonus = useCallback(async () => {
    if (!driverId || loadingBonus) return;
    setLoadingBonus(true);
    try {
      const r = await fetch(`/api/delivery/driver/bonus-vorschau?driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setBonusVorschau(d);
      } else {
        // Mock-Fallback
        setBonusVorschau({ puenktlichkeit: 1.5, touren: 2.0, gesamt: 3.5 });
      }
    } catch {
      setBonusVorschau({ puenktlichkeit: 1.5, touren: 2.0, gesamt: 3.5 });
    } finally {
      setLoadingBonus(false);
    }
  }, [driverId, loadingBonus]);

  useEffect(() => {
    if (visible && !bonusVorschau) {
      loadBonus();
    }
  }, [visible, bonusVorschau, loadBonus]);

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-white overflow-hidden shadow-md mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white">
        <span className="text-xl">🏁</span>
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-wider">Feierabend!</p>
          <p className="text-[10px] opacity-75">Deine Schicht ist abgeschlossen</p>
        </div>
        <button
          className="opacity-60 hover:opacity-100 transition-opacity text-white"
          onClick={() => setDismissed(true)}
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* KPI-Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
            <p className="text-xl font-black text-emerald-700 tabular-nums">{gelieferteStopps}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Lieferungen</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-xl font-black text-blue-700 tabular-nums">
              {schichtMinuten !== null ? fmtMin(schichtMinuten) : '—'}
            </p>
            <p className="text-[10px] text-blue-600 mt-0.5">Schichtdauer</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
            <p className="text-xl font-black text-amber-700 tabular-nums">
              {fmtEur(trinkgeldGesamt)}
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5">Trinkgeld</p>
          </div>
        </div>

        {/* Bonus-Vorschau */}
        {bonusVorschau && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-wide mb-1.5">
              Bonus-Vorschau diese Woche
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-yellow-700">Pünktlichkeit</span>
              <span className="font-bold text-yellow-800 tabular-nums">+{fmtEur(bonusVorschau.puenktlichkeit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-yellow-700">Touren-Bonus</span>
              <span className="font-bold text-yellow-800 tabular-nums">+{fmtEur(bonusVorschau.touren)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5 pt-1.5 border-t border-yellow-200">
              <span className="font-bold text-yellow-800">Gesamt</span>
              <span className="font-black text-yellow-900 tabular-nums text-sm">+{fmtEur(bonusVorschau.gesamt)}</span>
            </div>
          </div>
        )}

        {/* Abmeldungs-CTA */}
        <div className="rounded-xl bg-emerald-600 text-white p-3 text-center">
          <p className="text-xs font-bold mb-0.5">Gute Arbeit heute! 🎉</p>
          <p className="text-[10px] opacity-80">Du wurdest automatisch abgemeldet.</p>
        </div>
      </div>
    </div>
  );
}
