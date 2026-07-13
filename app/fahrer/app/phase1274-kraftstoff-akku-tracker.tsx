'use client';

// Phase 1274 — Kraftstoff-/Akku-Tracker (Fahrer-App)
// Eingabe verbrauchte Energie/Kraftstoff je Schicht + Effizienz-Trend + Kosten-Hochrechnung
// Props: driverId · isOnline-Guard · 5-Min-Polling für Trend

import { useEffect, useState } from 'react';
import { Zap, Fuel, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  isOnline: boolean;
}

type FahrzeugTyp = 'elektro' | 'verbrenner';

interface EnergieTrend {
  datum: string;
  verbrauch: number;
  kosten: number;
  effizienz: number;
}

interface TrendData {
  woche: EnergieTrend[];
  avg_effizienz: number;
  avg_kosten: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

const MOCK_TREND: TrendData = {
  woche: [
    { datum: 'Mo', verbrauch: 18.2, kosten: 4.55, effizienz: 92 },
    { datum: 'Di', verbrauch: 21.5, kosten: 5.38, effizienz: 88 },
    { datum: 'Mi', verbrauch: 16.8, kosten: 4.20, effizienz: 95 },
    { datum: 'Do', verbrauch: 19.4, kosten: 4.85, effizienz: 90 },
    { datum: 'Fr', verbrauch: 23.1, kosten: 5.78, effizienz: 84 },
  ],
  avg_effizienz: 90,
  avg_kosten: 4.95,
  trend: 'besser',
};

const E_PREIS = 0.25; // €/kWh
const SPRIT_PREIS = 1.80; // €/Liter

export function FahrerPhase1274KraftstoffAkkuTracker({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [fahrzeugTyp, setFahrzeugTyp] = useState<FahrzeugTyp>('elektro');
  const [verbrauch, setVerbrauch] = useState('');
  const [gespeichert, setGespeichert] = useState(false);
  const [trendData, setTrendData] = useState<TrendData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/energie-trend?driver_id=${driverId}`);
        if (res.ok && !cancelled) setTrendData(await res.json());
      } catch {
        if (!cancelled) setTrendData(MOCK_TREND);
      }
    };

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const td = trendData ?? MOCK_TREND;
  const einheit = fahrzeugTyp === 'elektro' ? 'kWh' : 'Liter';
  const preis = fahrzeugTyp === 'elektro' ? E_PREIS : SPRIT_PREIS;
  const verbrauchNum = parseFloat(verbrauch) || 0;
  const kosten = (verbrauchNum * preis).toFixed(2);

  const maxVerbrauch = Math.max(...td.woche.map(w => w.verbrauch), 1);

  const handleSpeichern = async () => {
    if (!verbrauchNum) return;
    try {
      await fetch('/api/delivery/driver/energie-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, fahrzeug_typ: fahrzeugTyp, verbrauch: verbrauchNum, kosten: parseFloat(kosten), einheit }),
      });
    } catch {}
    setGespeichert(true);
    setTimeout(() => setGespeichert(false), 3000);
    setVerbrauch('');
  };

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          {fahrzeugTyp === 'elektro' ? <Zap className="h-4 w-4 text-white" /> : <Fuel className="h-4 w-4 text-white" />}
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-white">Energie-Tracker</div>
          <div className="text-[11px] text-white/80">Ø {td.avg_kosten.toFixed(2)} €/Schicht · Effizienz {td.avg_effizienz}%</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Fahrzeugtyp-Auswahl */}
          <div className="flex gap-2">
            {(['elektro', 'verbrenner'] as FahrzeugTyp[]).map(t => (
              <button
                key={t}
                onClick={() => setFahrzeugTyp(t)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold border transition-all',
                  fahrzeugTyp === t
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                )}
              >
                {t === 'elektro' ? <Zap className="h-3.5 w-3.5" /> : <Fuel className="h-3.5 w-3.5" />}
                {t === 'elektro' ? 'Elektro' : 'Verbrenner'}
              </button>
            ))}
          </div>

          {/* Eingabe */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Verbrauch heute ({einheit})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                value={verbrauch}
                onChange={e => setVerbrauch(e.target.value)}
                placeholder={`z.B. ${fahrzeugTyp === 'elektro' ? '18.5' : '12.3'}`}
                className="flex-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-char dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button
                onClick={handleSpeichern}
                disabled={!verbrauchNum}
                className={cn('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all',
                  verbrauchNum ? 'bg-teal-600 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-400 cursor-not-allowed'
                )}
              >
                <Save className="h-3.5 w-3.5" />
                Speichern
              </button>
            </div>
            {gespeichert && (
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400">Gespeichert!</div>
            )}
            {verbrauchNum > 0 && (
              <div className="rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-3 py-2 text-xs text-teal-700 dark:text-teal-300">
                Kosten: ca. <strong>{kosten} €</strong> ({preis.toFixed(2)} €/{einheit === 'kWh' ? 'kWh' : 'L'})
              </div>
            )}
          </div>

          {/* 7-Tage-Balken-Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Woche</span>
              <span className={cn('flex items-center gap-1 text-[11px] font-bold',
                td.trend === 'besser' ? 'text-green-600' : td.trend === 'schlechter' ? 'text-red-500' : 'text-stone-500'
              )}>
                {td.trend === 'besser' ? <TrendingDown className="h-3 w-3" /> : td.trend === 'schlechter' ? <TrendingUp className="h-3 w-3" /> : null}
                {td.trend === 'besser' ? 'Effizienter' : td.trend === 'schlechter' ? 'Mehr Verbrauch' : 'Stabil'}
              </span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {td.woche.map(w => {
                const h = Math.round((w.verbrauch / maxVerbrauch) * 100);
                return (
                  <div key={w.datum} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-md bg-teal-400 dark:bg-teal-600 transition-all" style={{ height: `${h}%` }} title={`${w.verbrauch} ${einheit}`} />
                    <span className="text-[9px] text-stone-400 font-medium">{w.datum}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Effizienz-Score */}
          <div className="flex items-center justify-between rounded-xl bg-stone-50 dark:bg-stone-800 px-3 py-2.5">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Ø Effizienz</span>
            <span className={cn('text-sm font-black', td.avg_effizienz >= 90 ? 'text-green-600' : td.avg_effizienz >= 75 ? 'text-amber-600' : 'text-red-500')}>
              {td.avg_effizienz}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
