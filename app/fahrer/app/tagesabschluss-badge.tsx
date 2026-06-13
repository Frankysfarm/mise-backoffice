'use client';

/**
 * TagesabschlussBadge — Phase 137
 * Persistente Schicht-Zusammenfassung nach Schichtende.
 * Zeigt sich automatisch wenn der Fahrer offline geht und heute Lieferungen hatte.
 * Gespeichert in localStorage, bleibt bis zum nächsten Online-Gehen sichtbar.
 */

import { useEffect, useState } from 'react';
import { X, Package, Route, Clock, Banknote, Trophy, TrendingUp, Star } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

export interface TagesabschlussData {
  deliveries: number;
  tours: number;
  distKm: number;
  betrag: number;
  onlineMin: number;
  date: string; // ISO date string "YYYY-MM-DD"
}

const STORAGE_KEY = 'mise_tagesabschluss_badge';

function getEffScore(data: TagesabschlussData): number {
  if (data.onlineMin <= 0) return 0;
  return Math.min(100, Math.round((data.deliveries / Math.max(1, data.onlineMin)) * 60 * 20));
}

function getBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: '🏆', label: 'Excellent!', color: 'text-yellow-300' };
  if (score >= 60) return { emoji: '⭐', label: 'Sehr gut!', color: 'text-blue-400' };
  if (score >= 40) return { emoji: '👏', label: 'Gut gemacht!', color: 'text-amber-400' };
  return { emoji: '✓', label: 'Schicht beendet', color: 'text-matcha-300' };
}

interface Props {
  isOnline: boolean;
  driverId: string;
  /** Wird vom Parent gesetzt wenn Schicht-Abschluss-Modal bestätigt wurde */
  shiftData?: TagesabschlussData | null;
  rankData?: { rank: number; total: number } | null;
}

export function TagesabschlussBadge({ isOnline, driverId, shiftData, rankData }: Props) {
  const [data, setData] = useState<TagesabschlussData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Laden aus localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${driverId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TagesabschlussData;
      // Nur heute anzeigen
      const today = new Date().toISOString().slice(0, 10);
      if (parsed.date === today) setData(parsed);
    } catch {
      // ignore
    }
  }, [driverId]);

  // Speichern wenn neue Schicht-Daten kommen
  useEffect(() => {
    if (!shiftData) return;
    const today = new Date().toISOString().slice(0, 10);
    const d: TagesabschlussData = { ...shiftData, date: today };
    setData(d);
    setDismissed(false);
    try {
      localStorage.setItem(`${STORAGE_KEY}:${driverId}`, JSON.stringify(d));
    } catch {
      // ignore
    }
  }, [shiftData, driverId]);

  // Zurücksetzen wenn Fahrer wieder online geht
  useEffect(() => {
    if (isOnline) {
      setData(null);
      setDismissed(false);
      try {
        localStorage.removeItem(`${STORAGE_KEY}:${driverId}`);
      } catch { /* ignore */ }
    }
  }, [isOnline, driverId]);

  if (isOnline || !data || dismissed || data.deliveries === 0) return null;

  const effScore = getEffScore(data);
  const badge = getBadge(effScore);
  const hStr = data.onlineMin >= 60 ? `${Math.floor(data.onlineMin / 60)}h ` : '';
  const mStr = `${data.onlineMin % 60}m`;
  const estEarnings = data.deliveries * 3 + data.distKm * 0.15;

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-matcha-800 border border-white/10 overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/5 transition"
      >
        <span className="text-2xl">{badge.emoji}</span>
        <div className="flex-1 text-left">
          <div className={cn('text-sm font-black', badge.color)}>{badge.label}</div>
          <div className="text-[11px] text-matcha-400">
            {data.deliveries} Lieferungen · {data.distKm > 0 ? `${data.distKm.toFixed(1)} km` : '—'} · {hStr}{mStr}
          </div>
        </div>
        {/* Mini-Stats */}
        <div className="flex items-center gap-1.5 mr-2">
          {effScore > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-accent/15 border border-accent/25 px-2 py-0.5">
              <TrendingUp className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-black text-accent">{effScore}%</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="p-1 rounded-full hover:bg-white/10 transition text-matcha-400 hover:text-matcha-200"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
              <Package className="h-4 w-4 text-accent mx-auto mb-1" />
              <div className="font-display text-lg font-black text-accent leading-none">{data.deliveries}</div>
              <div className="text-[9px] text-matcha-400 mt-0.5">Lieferungen</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
              <Route className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <div className="font-display text-lg font-black text-blue-400 leading-none">{data.tours}</div>
              <div className="text-[9px] text-matcha-400 mt-0.5">Touren</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
              <Clock className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <div className="font-display text-sm font-black text-amber-400 leading-none">{hStr}{mStr}</div>
              <div className="text-[9px] text-matcha-400 mt-0.5">Online</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
              <Banknote className="h-4 w-4 text-matcha-300 mx-auto mb-1" />
              <div className="font-display text-sm font-black text-matcha-200 leading-none">
                {data.distKm > 0 ? `${data.distKm.toFixed(1)}` : '—'}
              </div>
              <div className="text-[9px] text-matcha-400 mt-0.5">km Strecke</div>
            </div>
          </div>

          {/* Effizienz-Bar */}
          {effScore > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-400">Schicht-Effizienz</span>
                <span className="text-[10px] font-black text-accent">{effScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    effScore >= 80 ? 'bg-accent' : effScore >= 60 ? 'bg-blue-400' : 'bg-amber-400',
                  )}
                  style={{ width: `${effScore}%` }}
                />
              </div>
              <div className="mt-1 text-[9px] text-matcha-400 text-right">
                {data.onlineMin > 0
                  ? `${((data.deliveries / Math.max(1, data.onlineMin)) * 60).toFixed(1)} Lief/h`
                  : ''}
              </div>
            </div>
          )}

          {/* Verdienst-Schätzung */}
          {estEarnings > 0 && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 px-3 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-matcha-400">Geschätzter Verdienst</div>
                <div className="font-display text-lg font-black text-accent">{euro(Math.round(estEarnings * 100) / 100)}</div>
              </div>
              <div className="text-right text-[9px] text-matcha-400">
                Ø {euro(Math.round((estEarnings / Math.max(1, data.deliveries)) * 100) / 100)} / Lief.
              </div>
            </div>
          )}

          {/* Wochenrang */}
          {rankData && (
            <div className={cn(
              'rounded-xl border px-3 py-2.5 flex items-center justify-between',
              rankData.rank <= 3 ? 'bg-yellow-500/15 border-yellow-500/30' : 'bg-white/5 border-white/10',
            )}>
              <div className="flex items-center gap-2">
                <Trophy className={cn('h-4 w-4', rankData.rank <= 3 ? 'text-yellow-300' : 'text-matcha-400')} />
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-matcha-400">Wochenrang</div>
                  <div className={cn('font-display text-base font-black', rankData.rank <= 3 ? 'text-yellow-300' : 'text-accent')}>
                    #{rankData.rank}
                  </div>
                </div>
              </div>
              <div className="text-right text-[9px] text-matcha-400">von {rankData.total} Fahrern</div>
            </div>
          )}

          <div className="text-center text-[9px] text-matcha-500 pt-0.5">
            Bis morgen! 👋
          </div>
        </div>
      )}
    </div>
  );
}
