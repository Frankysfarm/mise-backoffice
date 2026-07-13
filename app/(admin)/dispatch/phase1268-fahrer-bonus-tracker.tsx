'use client';

// Phase 1268 — Fahrer-Bonus-Tracker (Dispatch)
// Monats-Rangliste mit Fortschrittsbalken (Bronze ≥50 / Silber ≥100 / Gold ≥150 Stopps)
// Props: locationId · 15-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trophy, Loader2, Medal, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerBonusEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_monat: number;
  stufe: 'gold' | 'silber' | 'bronze' | 'keine';
  naechste_stufe_bei: number | null;
  fortschritt_pct: number;
  on_tour: boolean;
}

interface BonusData {
  fahrer: FahrerBonusEintrag[];
  gold_count: number;
  silber_count: number;
  bronze_count: number;
  location_id: string;
  generiert_am: string;
}

const STUFE_STYLE = {
  gold: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', badge: 'bg-yellow-400 text-yellow-900', bar: 'bg-yellow-400', label: 'Gold' },
  silber: { bg: 'bg-slate-50 dark:bg-slate-900/30', badge: 'bg-slate-400 text-slate-900', bar: 'bg-slate-400', label: 'Silber' },
  bronze: { bg: 'bg-amber-50 dark:bg-amber-950/20', badge: 'bg-amber-600 text-white', bar: 'bg-amber-500', label: 'Bronze' },
  keine: { bg: 'bg-white dark:bg-white/5', badge: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300', bar: 'bg-slate-300', label: 'Kein Bonus' },
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase1268FahrerBonusTracker({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<BonusData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-bonus-tracker?location_id=${locationId}`);
        if (!cancelled && res.ok) setData(await res.json());
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  return (
    <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          <span className="font-semibold text-sm">Fahrer Bonus-Rangliste</span>
          {data && (
            <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              {data.gold_count}🥇 {data.silber_count}🥈 {data.bronze_count}🥉
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {loading && !data && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Lade Bonus-Daten…
            </div>
          )}

          {!locationId && (
            <p className="text-xs text-slate-400">Bitte Filiale auswählen.</p>
          )}

          {data && data.fahrer.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">Keine Fahrer gefunden.</p>
          )}

          {data && data.fahrer.map((f, idx) => {
            const ss = STUFE_STYLE[f.stufe];
            const maxStopps = 150;
            return (
              <div
                key={f.fahrer_id}
                className={cn('rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5', ss.bg)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right shrink-0">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{f.fahrer_name}</span>
                      {f.on_tour && (
                        <span className="rounded-full bg-green-500 text-white text-[9px] px-1.5 py-0.5 font-bold">TOUR</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={cn('rounded-full text-[10px] px-2 py-0.5 font-bold', ss.badge)}>
                        {ss.label}
                      </span>
                      <span className="text-[10px] text-slate-500">{f.stopps_monat} Stopps diesen Monat</span>
                    </div>
                  </div>
                  {f.stufe !== 'keine' && (
                    <Medal className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  {f.stufe === 'gold' && (
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />
                  )}
                </div>

                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', ss.bar)}
                    style={{ width: `${Math.min(100, (f.stopps_monat / maxStopps) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>0</span>
                  {f.naechste_stufe_bei && (
                    <span>Nächste Stufe: {f.naechste_stufe_bei} Stopps ({f.fortschritt_pct}%)</span>
                  )}
                  {!f.naechste_stufe_bei && <span>Gold erreicht 🏆</span>}
                  <span>{maxStopps}</span>
                </div>
              </div>
            );
          })}

          {data && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right tabular-nums">
              Bronze ≥50 · Silber ≥100 · Gold ≥150 · aktualisiert {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
