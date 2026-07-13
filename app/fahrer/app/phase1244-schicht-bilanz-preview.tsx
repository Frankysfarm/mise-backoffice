'use client';

// Phase 1244 — Schicht-Bilanz-Abschluss-Preview (Fahrer-App)
// Fortlaufende Bilanz: Einnahmen + Stopps + km + Trinkgeld bis jetzt, Hochrechnung Schichtende
// isOnline-Guard · 10-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, MapPin, Euro, Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtBilanz {
  fahrer_id: string;
  schicht_start_uhr: string;
  schicht_ende_uhr: string;
  aktive_stunden: number;
  verbleibende_stunden: number;
  stopps_bisher: number;
  einnahmen_bisher_eur: number;
  trinkgeld_bisher_eur: number;
  km_bisher: number;
  prognose_einnahmen_eur: number;
  prognose_stopps: number;
  prognose_trinkgeld_eur: number;
  ziel_status: 'unter_bronze' | 'bronze' | 'silber' | 'gold';
  generiert_am: string;
}

const ZIEL_STYLE: Record<SchichtBilanz['ziel_status'], { label: string; color: string; bg: string }> = {
  gold: { label: 'Gold', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  silber: { label: 'Silber', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800/50' },
  bronze: { label: 'Bronze', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  unter_bronze: { label: 'Unter Bronze', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20' },
};

function buildMock(driverId: string): SchichtBilanz {
  const now = new Date();
  const startH = Math.max(8, now.getHours() - 3);
  const aktiveStunden = now.getHours() - startH + (now.getMinutes() / 60);
  const verbleibendeStunden = Math.max(0, 8 - aktiveStunden);
  const stoppsBisher = Math.floor(aktiveStunden * 2.5);
  const einnahmenBisher = stoppsBisher * 7.5;
  const trinkgeldBisher = stoppsBisher * 1.2;
  const kmBisher = stoppsBisher * 3.5;
  const pace = aktiveStunden > 0 ? einnahmenBisher / aktiveStunden : 0;
  const prognoseEinnahmen = einnahmenBisher + pace * verbleibendeStunden;

  return {
    fahrer_id: driverId,
    schicht_start_uhr: `${startH.toString().padStart(2, '0')}:00`,
    schicht_ende_uhr: `${(startH + 8).toString().padStart(2, '0')}:00`,
    aktive_stunden: Math.round(aktiveStunden * 10) / 10,
    verbleibende_stunden: Math.round(verbleibendeStunden * 10) / 10,
    stopps_bisher: stoppsBisher,
    einnahmen_bisher_eur: Math.round(einnahmenBisher * 100) / 100,
    trinkgeld_bisher_eur: Math.round(trinkgeldBisher * 100) / 100,
    km_bisher: Math.round(kmBisher * 10) / 10,
    prognose_einnahmen_eur: Math.round(prognoseEinnahmen * 100) / 100,
    prognose_stopps: Math.round(stoppsBisher + (stoppsBisher / Math.max(aktiveStunden, 0.5)) * verbleibendeStunden),
    prognose_trinkgeld_eur: Math.round((trinkgeldBisher / Math.max(aktiveStunden, 0.5)) * (aktiveStunden + verbleibendeStunden) * 100) / 100,
    ziel_status: prognoseEinnahmen >= 160 ? 'gold' : prognoseEinnahmen >= 120 ? 'silber' : prognoseEinnahmen >= 80 ? 'bronze' : 'unter_bronze',
    generiert_am: now.toISOString(),
  };
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function FahrerPhase1244SchichtBilanzPreview({ driverId, isOnline }: { driverId: string; isOnline: boolean }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SchichtBilanz | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    if (!isOnline) return;
    setLoading(true);
    fetch(`/api/delivery/driver/schicht-bilanz-preview?driver_id=${encodeURIComponent(driverId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SchichtBilanz | null) => setData(d ?? buildMock(driverId)))
      .catch(() => setData(buildMock(driverId)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const d = data;
  if (!d) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
        <div className="h-4 w-40 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
      </div>
    );
  }

  const ziel = ZIEL_STYLE[d.ziel_status];
  const progressPct = Math.min(100, (d.aktive_stunden / (d.aktive_stunden + d.verbleibende_stunden)) * 100);

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Schicht-Bilanz</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">
            {d.schicht_start_uhr} – {d.schicht_ende_uhr} · {d.aktive_stunden.toFixed(1)}h aktiv
          </div>
        </div>
        <div className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', ziel.bg, ziel.color)}>
          {ziel.label}
        </div>
        {loading && <div className="h-3 w-3 rounded-full border-2 border-matcha-400 border-t-transparent animate-spin" />}
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Schicht-Fortschrittsbalken */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 mb-1">
              <span>{d.schicht_start_uhr}</span>
              <span className="font-bold text-stone-600 dark:text-stone-300">
                {d.verbleibende_stunden.toFixed(1)}h verbleibend
              </span>
              <span>{d.schicht_ende_uhr}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* KPI Grid — Bisher */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">Bisher</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-matcha-50 dark:bg-matcha-900/20 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Euro className="h-3 w-3 text-matcha-600 dark:text-matcha-400" />
                  <span className="text-[9px] font-bold text-matcha-600 dark:text-matcha-400 uppercase">Einnahmen</span>
                </div>
                <div className="text-lg font-black tabular-nums text-matcha-700 dark:text-matcha-300">
                  {fmtEur(d.einnahmen_bisher_eur)}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Star className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">Trinkgeld</span>
                </div>
                <div className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-300">
                  {fmtEur(d.trinkgeld_bisher_eur)}
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <MapPin className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">Stopps</span>
                </div>
                <div className="text-lg font-black tabular-nums text-blue-700 dark:text-blue-300">
                  {d.stopps_bisher}
                </div>
              </div>
              <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3 text-stone-500" />
                  <span className="text-[9px] font-bold text-stone-500 uppercase">km gefahren</span>
                </div>
                <div className="text-lg font-black tabular-nums text-stone-700 dark:text-stone-200">
                  {d.km_bisher.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Prognose */}
          <div className="rounded-xl border border-dashed border-stone-200 dark:border-stone-700 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
              Hochrechnung Schichtende
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[9px] text-stone-400">Einnahmen gesamt</div>
                <div className={cn('text-base font-black tabular-nums', ziel.color)}>
                  {fmtEur(d.prognose_einnahmen_eur)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-stone-400">Stopps gesamt</div>
                <div className="text-base font-black tabular-nums text-stone-700 dark:text-stone-200">
                  {d.prognose_stopps}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-stone-400">Trinkgeld gesamt</div>
                <div className="text-base font-black tabular-nums text-amber-700 dark:text-amber-300">
                  {fmtEur(d.prognose_trinkgeld_eur)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
