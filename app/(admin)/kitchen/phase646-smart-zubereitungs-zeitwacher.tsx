'use client';

import { useEffect, useState, useMemo } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string;
  status?: string | null;
  bestellt_am?: string | null;
  created_at?: string;
  geschaetzte_zubereitung_min?: number | null;
}

interface Props {
  orders: Order[];
}

const ZIEL_MIN = 15;

type Stufe = 'ok' | 'eng' | 'kritisch' | 'ueberfaellig';

function getStufe(restSec: number, zielSec: number): Stufe {
  if (restSec <= 0) return 'ueberfaellig';
  const ratio = restSec / zielSec;
  if (ratio > 0.5) return 'ok';
  if (ratio > 0.2) return 'eng';
  return 'kritisch';
}

const STUFE_CFG: Record<Stufe, { bg: string; border: string; label: string; color: string; pulse: boolean }> = {
  ok:          { bg: 'bg-matcha-50 dark:bg-matcha-950/20',   border: 'border-matcha-200 dark:border-matcha-800',   label: 'Im Zeitrahmen', color: 'text-matcha-700 dark:text-matcha-300',   pulse: false },
  eng:         { bg: 'bg-amber-50 dark:bg-amber-950/20',     border: 'border-amber-200 dark:border-amber-800',     label: 'Zeitdruck',     color: 'text-amber-700 dark:text-amber-300',     pulse: false },
  kritisch:    { bg: 'bg-red-50 dark:bg-red-950/20',         border: 'border-red-200 dark:border-red-800',         label: 'Kritisch',      color: 'text-red-600 dark:text-red-400',         pulse: true  },
  ueberfaellig:{ bg: 'bg-red-100 dark:bg-red-950/40',        border: 'border-red-400 dark:border-red-600',         label: 'ÜBERFÄLLIG',    color: 'text-red-700 dark:text-red-300 font-black', pulse: true  },
};

function fmtMin(sec: number): string {
  if (sec <= 0) return '+' + Math.abs(Math.floor(sec / 60)) + 'm';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase646SmartZubereitungsZeitwacher({ orders }: Props) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = useMemo(() => {
    return orders
      .filter((o) => ['bestätigt', 'in_zubereitung', 'confirmed', 'preparing'].includes(o.status ?? ''))
      .map((o) => {
        const start = o.bestellt_am ?? o.created_at ?? null;
        const zielSec = (o.geschaetzte_zubereitung_min ?? ZIEL_MIN) * 60;
        const vergSec = start ? Math.round((now - new Date(start).getTime()) / 1_000) : 0;
        const restSec = zielSec - vergSec;
        const stufe = getStufe(restSec, zielSec);
        const pct = Math.min(100, Math.round((vergSec / zielSec) * 100));
        return { ...o, zielSec, vergSec, restSec, stufe, pct };
      })
      .sort((a, b) => a.restSec - b.restSec);
  }, [orders, now]);

  const counts = useMemo(() => ({
    ok: aktiv.filter((o) => o.stufe === 'ok').length,
    eng: aktiv.filter((o) => o.stufe === 'eng').length,
    kritisch: aktiv.filter((o) => o.stufe === 'kritisch').length,
    ueberfaellig: aktiv.filter((o) => o.stufe === 'ueberfaellig').length,
  }), [aktiv]);

  if (aktiv.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <Timer className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Smart Zeitwächter · Zubereitung
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {counts.ueberfaellig > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 animate-pulse">
              {counts.ueberfaellig} ÜBERFÄLLIG
            </span>
          )}
          {counts.kritisch > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5">
              {counts.kritisch} kritisch
            </span>
          )}
          {counts.eng > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5">
              {counts.eng} eng
            </span>
          )}
          <span className="rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-bold px-1.5 py-0.5">
            {aktiv.length} aktiv
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {aktiv.slice(0, 8).map((o) => {
          const cfg = STUFE_CFG[o.stufe];
          return (
            <div key={o.id} className={`flex items-center gap-3 px-4 py-2.5 ${cfg.bg}`}>
              <div className={`shrink-0 w-2 h-2 rounded-full ${
                o.stufe === 'ok' ? 'bg-matcha-500' :
                o.stufe === 'eng' ? 'bg-amber-400' :
                'bg-red-500'
              } ${cfg.pulse ? 'animate-pulse' : ''}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate text-foreground">
                    #{o.bestellnummer ?? o.id.slice(-4)}
                  </span>
                  <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      o.stufe === 'ok' ? 'bg-matcha-500' :
                      o.stufe === 'eng' ? 'bg-amber-400' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${o.pct}%` }}
                  />
                </div>
              </div>

              <div className={`shrink-0 font-mono text-sm font-black tabular-nums ${cfg.color}`}>
                {fmtMin(o.restSec)}
              </div>
            </div>
          );
        })}
        {aktiv.length > 8 && (
          <div className="px-4 py-2 text-center text-xs text-muted-foreground">
            +{aktiv.length - 8} weitere Bestellungen
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
        {[
          { label: 'Im Ziel', count: counts.ok, color: 'text-matcha-600 dark:text-matcha-400' },
          { label: 'Zeitdruck', count: counts.eng, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Kritisch', count: counts.kritisch, color: 'text-red-600 dark:text-red-400' },
          { label: 'Überfällig', count: counts.ueberfaellig, color: 'text-red-700 dark:text-red-300' },
        ].map(({ label, count, color }) => (
          <div key={label} className="px-3 py-2 text-center">
            <div className={`text-lg font-black tabular-nums ${color}`}>{count}</div>
            <div className="text-[9px] text-muted-foreground font-medium">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
