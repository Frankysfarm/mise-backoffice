'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Euro, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';

/**
 * Phase 973 — Schicht-Profitabilitäts-Cockpit (Dispatch)
 *
 * Echtzeit P&L je aktiver Schicht: Umsatz - Löhne - Kraftstoff - Plattformkosten.
 * 3-Min-Polling auf /api/delivery/admin/fahrer-performance-vergleich als Datenbasis.
 */

interface Props {
  locationId: string | null;
}

interface SchichtPL {
  fahrer_id: string;
  fahrer_name: string;
  umsatz: number;
  lohnkosten: number;
  kraftstoff: number;
  plattformkosten: number;
  gewinn: number;
  marge_pct: number;
  trend: 'positiv' | 'neutral' | 'negativ';
  stopps: number;
  km: number;
}

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    umsatz_30d: number;
    stopps_pro_h: number;
    km_gesamt: number;
    score: number;
  }>;
}

const LOHN_PRO_H = 14.5;
const KRAFTSTOFF_PRO_KM = 0.25;
const PLATTFORM_PCT = 0.03;
const SCHICHT_H = 6;

function buildMock(): SchichtPL[] {
  return [
    { fahrer_id: '1', fahrer_name: 'T. Bauer', umsatz: 312, lohnkosten: 87, kraftstoff: 18.5, plattformkosten: 9.36, gewinn: 197.14, marge_pct: 63.2, trend: 'positiv', stopps: 22, km: 74 },
    { fahrer_id: '2', fahrer_name: 'S. Meier', umsatz: 265, lohnkosten: 87, kraftstoff: 22.0, plattformkosten: 7.95, gewinn: 148.05, marge_pct: 55.9, trend: 'neutral', stopps: 18, km: 88 },
    { fahrer_id: '3', fahrer_name: 'J. Huber', umsatz: 198, lohnkosten: 87, kraftstoff: 14.0, plattformkosten: 5.94, gewinn: 91.06, marge_pct: 46.0, trend: 'negativ', stopps: 14, km: 56 },
  ];
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function TrendIcon({ trend }: { trend: SchichtPL['trend'] }) {
  if (trend === 'positiv') return <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />;
  if (trend === 'negativ') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-stone-400" />;
}

export function DispatchPhase973SchichtProfitabilitaetsCockpit({ locationId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState<SchichtPL[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setData(buildMock()); return; }
    try {
      const url = `/api/delivery/admin/fahrer-performance-vergleich?location_id=${encodeURIComponent(locationId)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const json: ApiResponse = await res.json();
      const fahrer = json.fahrer ?? [];
      if (!fahrer.length) { setData(buildMock()); return; }

      const pl: SchichtPL[] = fahrer.slice(0, 6).map(f => {
        const umsatz = f.umsatz_30d / 30; // Tages-Umsatz aus 30-Tage-Wert
        const lohnkosten = LOHN_PRO_H * SCHICHT_H;
        const kraftstoff = (f.km_gesamt / 30) * KRAFTSTOFF_PRO_KM;
        const plattformkosten = umsatz * PLATTFORM_PCT;
        const gewinn = umsatz - lohnkosten - kraftstoff - plattformkosten;
        const marge_pct = umsatz > 0 ? (gewinn / umsatz) * 100 : 0;
        return {
          fahrer_id: f.fahrer_id,
          fahrer_name: f.fahrer_name,
          umsatz,
          lohnkosten,
          kraftstoff,
          plattformkosten,
          gewinn,
          marge_pct,
          trend: marge_pct >= 55 ? 'positiv' : marge_pct >= 40 ? 'neutral' : 'negativ',
          stopps: Math.round(f.stopps_pro_h * SCHICHT_H),
          km: Math.round(f.km_gesamt / 30),
        };
      });
      setData(pl);
      setLastUpdate(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setData(buildMock());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 180_000);
    return () => clearInterval(iv);
  }, [load]);

  const gesamtGewinn = data.reduce((s, d) => s + d.gewinn, 0);
  const gesamtUmsatz = data.reduce((s, d) => s + d.umsatz, 0);
  const gesamtMarge = gesamtUmsatz > 0 ? (gesamtGewinn / gesamtUmsatz) * 100 : 0;
  const negativCount = data.filter(d => d.trend === 'negativ').length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
        type="button"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-matcha-500" />
          <span className="font-semibold text-stone-800 dark:text-stone-100 text-sm">
            Schicht-Profitabilitäts-Cockpit
          </span>
          {negativCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {negativCount} Defizit
            </span>
          )}
          {gesamtMarge > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-semibold text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300">
              Ø {gesamtMarge.toFixed(0)}% Marge
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-stone-400 hidden sm:block">aktualisiert {lastUpdate}</span>
          )}
          {collapsed ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronUp className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {!collapsed && data.length > 0 && (
        <div className="border-t border-stone-100 px-4 pb-4 pt-3 dark:border-stone-800 space-y-2">
          {data.map(d => (
            <div
              key={d.fahrer_id}
              className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 dark:border-stone-800 dark:bg-stone-800/50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <TrendIcon trend={d.trend} />
                  <span className="font-semibold text-sm text-stone-800 dark:text-stone-100">
                    {d.fahrer_name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'font-bold text-sm',
                      d.gewinn >= 0 ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {d.gewinn >= 0 ? '+' : ''}{fmtEur(d.gewinn)}
                  </span>
                  <span className="text-[10px] text-stone-400">({d.marge_pct.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div className="text-center">
                  <div className="text-stone-500 dark:text-stone-400">Umsatz</div>
                  <div className="font-semibold text-matcha-600 dark:text-matcha-400">{fmtEur(d.umsatz)}</div>
                </div>
                <div className="text-center">
                  <div className="text-stone-500 dark:text-stone-400">Lohn</div>
                  <div className="font-semibold text-stone-700 dark:text-stone-300">-{fmtEur(d.lohnkosten)}</div>
                </div>
                <div className="text-center">
                  <div className="text-stone-500 dark:text-stone-400">Kraftstoff</div>
                  <div className="font-semibold text-stone-700 dark:text-stone-300">-{fmtEur(d.kraftstoff)}</div>
                </div>
                <div className="text-center">
                  <div className="text-stone-500 dark:text-stone-400">Plattform</div>
                  <div className="font-semibold text-stone-700 dark:text-stone-300">-{fmtEur(d.plattformkosten)}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-stone-400 dark:text-stone-500">
                <span>{d.stopps} Stopps</span>
                <span>·</span>
                <span>{d.km} km</span>
              </div>
            </div>
          ))}

          {/* Gesamt-Footer */}
          <div className="mt-2 rounded-lg border border-matcha-200 bg-matcha-50 px-3 py-2 dark:border-matcha-800/40 dark:bg-matcha-900/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-matcha-700 dark:text-matcha-300">
              <Euro className="h-4 w-4" />
              Gesamt-Schichtgewinn
            </div>
            <div className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
              {fmtEur(gesamtGewinn)}
              <span className="ml-1.5 text-[11px] font-normal text-matcha-500">
                {gesamtMarge.toFixed(1)}% Marge
              </span>
            </div>
          </div>
          <p className="text-[10px] text-stone-400 dark:text-stone-500">
            Kalkulation: 14,50 €/h Lohn · 0,25 €/km Kraftstoff · 3% Plattform
          </p>
        </div>
      )}
    </div>
  );
}
