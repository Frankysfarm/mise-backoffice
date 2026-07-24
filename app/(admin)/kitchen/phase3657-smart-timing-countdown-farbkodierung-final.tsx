'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, AlertTriangle, ChefHat, CheckCircle2, TrendingUp, Zap } from 'lucide-react';

interface KochBestellung {
  order_id: string;
  bestellnummer: string;
  artikel_kurz: string;
  prep_start_sek: number;
  prep_ziel_sek: number;
  status: 'pending' | 'kochend' | 'fertig';
  fahrer_eta_min: number | null;
  prioritaet: number;
}

interface ApiResponse {
  bestellungen: KochBestellung[];
  on_time_rate: number;
  kochstart_score: number;
  ueberfaellig_count: number;
  updated_at: string;
}

const MOCK: ApiResponse = {
  bestellungen: [
    { order_id: '1', bestellnummer: '#1042', artikel_kurz: 'Döner + Ayran', prep_start_sek: 420, prep_ziel_sek: 600, status: 'kochend', fahrer_eta_min: 4, prioritaet: 1 },
    { order_id: '2', bestellnummer: '#1043', artikel_kurz: 'Pizza Margh.', prep_start_sek: 180, prep_ziel_sek: 780, status: 'kochend', fahrer_eta_min: 8, prioritaet: 2 },
    { order_id: '3', bestellnummer: '#1044', artikel_kurz: 'Burger + Pom.', prep_start_sek: 30, prep_ziel_sek: 540, status: 'pending', fahrer_eta_min: 14, prioritaet: 3 },
    { order_id: '4', bestellnummer: '#1045', artikel_kurz: 'Wrap + Salat', prep_start_sek: 650, prep_ziel_sek: 600, status: 'kochend', fahrer_eta_min: 2, prioritaet: 4 },
    { order_id: '5', bestellnummer: '#1046', artikel_kurz: 'Falafel Box', prep_start_sek: 480, prep_ziel_sek: 480, status: 'fertig', fahrer_eta_min: 1, prioritaet: 5 },
  ],
  on_time_rate: 82,
  kochstart_score: 74,
  ueberfaellig_count: 1,
  updated_at: new Date().toISOString(),
};

function getCountdownInfo(sek: number, ziel: number): { verbleibend: number; pct: number; stufe: 'gruen' | 'gelb' | 'orange' | 'rot' } {
  const verbleibend = Math.max(0, ziel - sek);
  const pct = Math.min(100, (sek / ziel) * 100);
  let stufe: 'gruen' | 'gelb' | 'orange' | 'rot' = 'gruen';
  if (pct >= 100) stufe = 'rot';
  else if (pct >= 85) stufe = 'orange';
  else if (pct >= 65) stufe = 'gelb';
  return { verbleibend, pct, stufe };
}

const STUFE_BAR: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-yellow-400',
  orange: 'bg-orange-500',
  rot: 'bg-red-600',
};
const STUFE_TEXT: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb: 'text-yellow-600 dark:text-yellow-400',
  orange: 'text-orange-600 dark:text-orange-400',
  rot: 'text-red-600 dark:text-red-400',
};
const STUFE_BORDER: Record<string, string> = {
  gruen: 'border-emerald-200 dark:border-emerald-800',
  gelb: 'border-yellow-200 dark:border-yellow-800',
  orange: 'border-orange-200 dark:border-orange-800',
  rot: 'border-red-200 dark:border-red-800',
};
const STUFE_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-950/30',
  gelb: 'bg-yellow-50 dark:bg-yellow-950/30',
  orange: 'bg-orange-50 dark:bg-orange-950/30',
  rot: 'bg-red-50 dark:bg-red-950/30',
};

function fmt(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase3657SmartTimingCountdownFarbkodierungFinal({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [ticks, setTicks] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-countdown?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.bestellungen?.length) setData(d); }
    } catch {}
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTicks(t => t + 1), 1_000); return () => clearInterval(id); }, []);

  const aktive = data.bestellungen.filter(b => b.status !== 'fertig');
  const fertig = data.bestellungen.filter(b => b.status === 'fertig');

  const scoreColor = (s: number) => s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-100 dark:border-amber-900"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-gray-100">
          <ChefHat className="w-4 h-4 text-amber-600" />
          Smart-Timing Countdown · Farbkodierung
          {data.ueberfaellig_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs font-bold">
              {data.ueberfaellig_count} überfällig
            </span>
          )}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className={`font-bold ${scoreColor(data.kochstart_score)}`}>Score {data.kochstart_score}</span>
          <span className="text-gray-500">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">On-Time</div>
              <div className={`text-xl font-black ${scoreColor(data.on_time_rate)}`}>{data.on_time_rate}%</div>
            </div>
            <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">Aktiv</div>
              <div className="text-xl font-black text-amber-600">{aktive.length}</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400">Fertig</div>
              <div className="text-xl font-black text-emerald-600">{fertig.length}</div>
            </div>
          </div>

          {/* Überfällig-Alert */}
          {data.ueberfaellig_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{data.ueberfaellig_count} Bestellung{data.ueberfaellig_count > 1 ? 'en' : ''} überfällig — sofort fertigstellen!</span>
            </div>
          )}

          {/* Legende */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 px-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />pünktlich</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />bald fällig</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />dringend</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" />überfällig</span>
          </div>

          {/* Bestell-Liste */}
          <div className="space-y-2">
            {aktive.map(b => {
              const elapsed = b.prep_start_sek + ticks;
              const { verbleibend, pct, stufe } = getCountdownInfo(elapsed, b.prep_ziel_sek);
              return (
                <div
                  key={b.order_id}
                  className={`border rounded-lg overflow-hidden ${STUFE_BG[stufe]} ${STUFE_BORDER[stufe]}`}
                >
                  <div className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-10">{b.bestellnummer}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{b.artikel_kurz}</span>
                        <span className={`font-black text-sm ml-2 ${STUFE_TEXT[stufe]}`}>
                          {pct >= 100 ? `+${fmt(elapsed - b.prep_ziel_sek)}` : fmt(verbleibend)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${STUFE_BAR[stufe]}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">{b.status === 'kochend' ? '🔥 kochend' : '⏳ wartend'}</span>
                        {b.fahrer_eta_min !== null && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />Fahrer in {b.fahrer_eta_min} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {fertig.map(b => (
              <div key={b.order_id} className="border border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-10">{b.bestellnummer}</span>
                <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate">{b.artikel_kurz}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Fertig</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" />1-Sek-Tick · 15-Sek-Polling</span>
            <span>Mock-Fallback aktiv</span>
          </div>
        </div>
      )}
    </div>
  );
}
