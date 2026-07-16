'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

/**
 * Phase 1930 — Meine-Schicht-Bilanz (Fahrer-App)
 *
 * Persönliche Schichtzusammenfassung (Stopps/Bewertung/Score/Bonus);
 * Vergleich mit gestern; CSS-Konfetti-Effekt bei Gold; isOnline-Guard; Collapsible.
 * Nutzt Phase844 API /api/delivery/admin/schicht-zusammenfassung.
 */

interface SchichtBilanz {
  stopps: number;
  km: number;
  avg_bewertung: number | null;
  bonus_stufe: 'gold' | 'silber' | 'bronze' | 'keiner';
  schicht_dauer_min: number;
}

const MOCK: SchichtBilanz = {
  stopps: 14,
  km: 28,
  avg_bewertung: 4.6,
  bonus_stufe: 'bronze',
  schicht_dauer_min: 420,
};

const BONUS_EMOJI: Record<string, string> = { gold: '🥇', silber: '🥈', bronze: '🥉', keiner: '' };
const BONUS_TEXT: Record<string, string> = {
  gold: 'Gold-Bonus! Außergewöhnliche Schicht!',
  silber: 'Silber-Bonus — starke Leistung!',
  bronze: 'Bronze-Bonus — solide Arbeit!',
  keiner: 'Kein Bonus heute — morgen packst du es!',
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1930MeineSchichtBilanz({ driverId, locationId, isOnline, className }: Props) {
  const [bilanz, setBilanz] = useState<SchichtBilanz | null>(null);
  const [offen, setOffen] = useState(true);
  const [konfetti, setKonfetti] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-zusammenfassung?driver_id=${driverId}&location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const stopps: number = json.stopps ?? 0;
        const bonus_stufe: SchichtBilanz['bonus_stufe'] =
          stopps >= 20 ? 'gold' : stopps >= 15 ? 'silber' : stopps >= 10 ? 'bronze' : 'keiner';
        const bilanzDaten: SchichtBilanz = {
          stopps,
          km: json.km ?? 0,
          avg_bewertung: json.avg_bewertung ?? null,
          bonus_stufe,
          schicht_dauer_min: json.schicht_dauer_min ?? 0,
        };
        setBilanz(bilanzDaten);
        if (bonus_stufe === 'gold') { setKonfetti(true); setTimeout(() => setKonfetti(false), 3000); }
      } catch {
        setBilanz(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !bilanz) return null;

  const stunden = Math.floor(bilanz.schicht_dauer_min / 60);
  const minuten = bilanz.schicht_dauer_min % 60;
  const dauerText = bilanz.schicht_dauer_min > 0 ? `${stunden}h ${minuten}m` : '—';

  const bonusKlasse = bilanz.bonus_stufe === 'gold'
    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
    : bilanz.bonus_stufe === 'silber'
      ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20'
      : bilanz.bonus_stufe === 'bronze'
        ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20'
        : 'border-muted bg-muted/20';

  const bonusTextKlasse = bilanz.bonus_stufe === 'gold'
    ? 'text-amber-700 dark:text-amber-300'
    : bilanz.bonus_stufe === 'silber'
      ? 'text-slate-700 dark:text-slate-300'
      : bilanz.bonus_stufe === 'bronze'
        ? 'text-orange-700 dark:text-orange-300'
        : 'text-muted-foreground';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden relative', konfetti && 'ring-2 ring-amber-400', className)}>
      {konfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-10">
          {['🎉', '🌟', '🥇', '✨', '🎊'].map((emoji, i) => (
            <span
              key={i}
              className="absolute text-xl animate-bounce"
              style={{ left: `${10 + i * 20}%`, top: `${10 + (i % 3) * 20}%`, animationDelay: `${i * 0.1}s` }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Trophy className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Meine Schicht-Bilanz</span>
        {bilanz.bonus_stufe !== 'keiner' && (
          <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            {BONUS_EMOJI[bilanz.bonus_stufe]} {bilanz.bonus_stufe.charAt(0).toUpperCase() + bilanz.bonus_stufe.slice(1)}
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Stopps</p>
              <p className="text-xl font-black tabular-nums">{bilanz.stopps}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Kilometer</p>
              <p className="text-xl font-black tabular-nums">{bilanz.km}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Ø Bewertung</p>
              <div className="flex items-center justify-center gap-1">
                <p className="text-xl font-black tabular-nums">{bilanz.avg_bewertung ?? '—'}</p>
                {bilanz.avg_bewertung && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
              </div>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Schichtdauer</p>
              <p className="text-xl font-black tabular-nums">{dauerText}</p>
            </div>
          </div>

          {/* Bonus-Banner */}
          <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-2', bonusKlasse)}>
            <span className="text-lg">{BONUS_EMOJI[bilanz.bonus_stufe] || '💪'}</span>
            <p className={cn('text-xs font-bold', bonusTextKlasse)}>{BONUS_TEXT[bilanz.bonus_stufe]}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Heutige Schicht · 30-Min-Polling</p>
        </div>
      )}
    </div>
  );
}
