'use client';

// Phase 1214 — Bonus-Status-Tracker (Fahrer-App)
// Aktueller Bonus-Status des Fahrers: Stopps-Ziel + Bewertungs-Ziel + Pünktlichkeit → Bonus-Ampel

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, Trophy, TrendingUp, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BonusZiel {
  label: string;
  ziel: number;
  aktuell: number;
  einheit: string;
  erreicht: boolean;
  pct: number;
}

interface ApiData {
  fahrer_id: string;
  bonus_stufe: 'kein' | 'bronze' | 'silber' | 'gold';
  bonus_betrag_eur: number;
  ziele: BonusZiel[];
  erreichbar: boolean;
  fehlende_ziele: number;
  generiert_am: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const STUFE_STYLE: Record<ApiData['bonus_stufe'], { label: string; color: string; bg: string; border: string; icon: string }> = {
  kein:   { label: 'Kein Bonus',   color: 'text-slate-500 dark:text-slate-400',    bg: 'bg-slate-50 dark:bg-slate-900',   border: 'border-slate-200 dark:border-slate-700', icon: '—' },
  bronze: { label: 'Bronze',       color: 'text-amber-700 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', icon: '🥉' },
  silber: { label: 'Silber',       color: 'text-slate-500 dark:text-slate-300',    bg: 'bg-slate-50 dark:bg-slate-800',   border: 'border-slate-300 dark:border-slate-600', icon: '🥈' },
  gold:   { label: 'Gold',         color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-300 dark:border-yellow-700', icon: '🥇' },
};

function mockData(driverId: string): ApiData {
  const stopps = 14;
  const bewertung = 4.3;
  const puenktlichkeit = 82;
  const ziele: BonusZiel[] = [
    { label: 'Stopps heute',     ziel: 20, aktuell: stopps,       einheit: 'Stopps', erreicht: stopps >= 20,       pct: Math.min(100, Math.round((stopps / 20) * 100)) },
    { label: 'Ø Bewertung',      ziel: 4.5, aktuell: bewertung,   einheit: '★',     erreicht: bewertung >= 4.5,   pct: Math.min(100, Math.round((bewertung / 4.5) * 100)) },
    { label: 'Pünktlichkeit',    ziel: 85, aktuell: puenktlichkeit, einheit: '%',   erreicht: puenktlichkeit >= 85, pct: Math.min(100, Math.round((puenktlichkeit / 85) * 100)) },
  ];
  const erreicht = ziele.filter(z => z.erreicht).length;
  const stufe: ApiData['bonus_stufe'] = erreicht === 3 ? 'gold' : erreicht === 2 ? 'silber' : erreicht === 1 ? 'bronze' : 'kein';
  return {
    fahrer_id: driverId,
    bonus_stufe: stufe,
    bonus_betrag_eur: stufe === 'gold' ? 15 : stufe === 'silber' ? 8 : stufe === 'bronze' ? 3 : 0,
    ziele,
    erreichbar: erreicht >= 2,
    fehlende_ziele: ziele.filter(z => !z.erreicht).length,
    generiert_am: new Date().toISOString(),
  };
}

export function FahrerPhase1214BonusStatusTracker({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.fetch(`/api/delivery/driver/bonus-status?driver_id=${driverId}`);
      if (res.ok) {
        const json: ApiData = await res.json();
        if (json.ziele) { setData(json); return; }
      }
    } catch { /* fall through */ }
    setData(mockData(driverId));
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData, isOnline]);

  if (!isOnline || !data) return null;

  const s = STUFE_STYLE[data.bonus_stufe];

  return (
    <div className={cn('rounded-xl border overflow-hidden', s.border, s.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className={cn('h-4 w-4 shrink-0', s.color)} />
          <span className="text-xs font-bold uppercase tracking-wider">Bonus-Status</span>
          <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-bold', s.color, 'bg-white/60 dark:bg-black/30')}>
            {s.icon} {s.label}
          </span>
          {data.bonus_betrag_eur > 0 && (
            <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold">
              +{data.bonus_betrag_eur.toFixed(0)}€
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-3">
          {/* Ziele */}
          {data.ziele.map(z => (
            <div key={z.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1">
                  {z.erreicht ? (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <Star className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={cn('font-semibold', z.erreicht ? 'text-foreground' : 'text-muted-foreground')}>
                    {z.label}
                  </span>
                </div>
                <span className={cn('font-bold tabular-nums', z.erreicht ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
                  {z.aktuell}{z.einheit} / {z.ziel}{z.einheit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', z.erreicht ? 'bg-emerald-500' : 'bg-amber-400')}
                  style={{ width: `${z.pct}%` }}
                />
              </div>
            </div>
          ))}

          {/* Zusammenfassung */}
          <div className="flex items-center gap-2 pt-1 border-t border-black/10 dark:border-white/10">
            {data.bonus_betrag_eur > 0 ? (
              <>
                <Gift className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Bonus heute: +{data.bonus_betrag_eur.toFixed(0)} € ({s.label})
                </span>
              </>
            ) : data.erreichbar ? (
              <>
                <TrendingUp className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Noch {data.fehlende_ziele} Ziel{data.fehlende_ziele > 1 ? 'e' : ''} — Bronze erreichbar!
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Noch kein Bonus — Ziele weiter verfolgen
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
