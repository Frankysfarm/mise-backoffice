'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Flame, Target, Zap } from 'lucide-react';

/**
 * Phase 1851 — Smart Zubereitungs-Ampel-Cockpit
 *
 * Kombiniert Smart-Timing, Live-Countdown und Farbkodierung in einer
 * einheitlichen Übersicht. Zeigt alle aktiven Bestellungen mit:
 * - Echtzeit-Countdown bis zur Zielzeit
 * - Ampel-Farbkodierung (grün/gelb/orange/rot)
 * - Kochstart-Empfehlung basierend auf Fahrer-ETA
 * - Batch-Koordination für gleichzeitige Bestellungen
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min?: number | null;
  items?: { name: string; menge?: number }[] | null;
  driver_eta_minutes?: number | null;
}

interface KitchenTiming {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type Ampel = 'gruen' | 'gelb' | 'orange' | 'rot' | 'fertig';

interface BestellAmpel {
  id: string;
  nummer: string;
  status: string;
  ampel: Ampel;
  countdownSek: number;
  countdownLabel: string;
  kochstartIn: number | null;
  positionen: number;
  empfehlung: string;
}

function useSekundentakt() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  return tick;
}

function berechneAmpeln(orders: Order[], timings: KitchenTiming[], now: number): BestellAmpel[] {
  const aktiv = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
  );

  return aktiv.map((o) => {
    const timing = timings.find((t) => t.order_id === o.id);
    const prepMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15;
    const positionen = o.items?.length ?? 1;

    if (o.status === 'fertig') {
      return {
        id: o.id,
        nummer: o.bestellnummer ?? '—',
        status: 'fertig',
        ampel: 'fertig',
        countdownSek: 0,
        countdownLabel: 'Fertig',
        kochstartIn: null,
        positionen,
        empfehlung: 'Bereit für Übergabe',
      };
    }

    let countdownSek = 0;
    let kochstartIn: number | null = null;

    if (timing?.ready_target) {
      countdownSek = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
    } else if (o.bestellt_am) {
      const etaMin = o.driver_eta_minutes ?? 20;
      const targetMs = new Date(o.bestellt_am).getTime() + etaMin * 60_000;
      countdownSek = Math.floor((targetMs - now) / 1000);
      if (!timing?.cook_start_at) {
        kochstartIn = Math.max(0, Math.floor(countdownSek / 60) - prepMin);
      }
    }

    let ampel: Ampel;
    const minLeft = countdownSek / 60;
    if (countdownSek < 0) ampel = 'rot';
    else if (minLeft < 5) ampel = 'rot';
    else if (minLeft < 10) ampel = 'orange';
    else if (minLeft < 18) ampel = 'gelb';
    else ampel = 'gruen';

    const absMin = Math.abs(Math.floor(countdownSek / 60));
    const absSek = Math.abs(countdownSek % 60);
    const prefix = countdownSek < 0 ? '+' : '';
    const countdownLabel = `${prefix}${absMin}:${String(absSek).padStart(2, '0')}`;

    let empfehlung: string;
    if (ampel === 'rot' && countdownSek < 0) empfehlung = 'Überfällig – sofort fertigstellen!';
    else if (ampel === 'rot') empfehlung = 'Kritisch – sofort starten';
    else if (ampel === 'orange') empfehlung = 'Dringend – jetzt vorbereiten';
    else if (kochstartIn !== null && kochstartIn <= 0) empfehlung = 'Kochstart jetzt';
    else if (kochstartIn !== null) empfehlung = `Kochstart in ${kochstartIn} Min`;
    else empfehlung = 'Im Plan';

    return { id: o.id, nummer: o.bestellnummer ?? '—', status: o.status, ampel, countdownSek, countdownLabel, kochstartIn, positionen, empfehlung };
  }).sort((a, b) => {
    const order: Record<Ampel, number> = { rot: 0, orange: 1, gelb: 2, gruen: 3, fertig: 4 };
    if (order[a.ampel] !== order[b.ampel]) return order[a.ampel] - order[b.ampel];
    return a.countdownSek - b.countdownSek;
  });
}

const AMPEL_STYLES: Record<Ampel, { tile: string; badge: string; pulse: boolean; icon: string }> = {
  rot:    { tile: 'bg-red-50 border-red-300',    badge: 'bg-red-600 text-white',    pulse: true,  icon: '🔴' },
  orange: { tile: 'bg-orange-50 border-orange-300', badge: 'bg-orange-500 text-white', pulse: true,  icon: '🟠' },
  gelb:   { tile: 'bg-amber-50 border-amber-200',  badge: 'bg-amber-400 text-white',  pulse: false, icon: '🟡' },
  gruen:  { tile: 'bg-green-50 border-green-200',  badge: 'bg-green-500 text-white',  pulse: false, icon: '🟢' },
  fertig: { tile: 'bg-matcha-50 border-matcha-300',badge: 'bg-matcha-600 text-white', pulse: false, icon: '✅' },
};

export function KitchenSmartZubereitungsAmpelCockpit({ orders, timings }: Props) {
  const tick = useSekundentakt();
  const now = useMemo(() => Date.now(), [tick]);
  const eintraege = useMemo(() => berechneAmpeln(orders, timings, now), [orders, timings, now]);

  const stats = useMemo(() => ({
    rot:    eintraege.filter((e) => e.ampel === 'rot').length,
    orange: eintraege.filter((e) => e.ampel === 'orange').length,
    gelb:   eintraege.filter((e) => e.ampel === 'gelb').length,
    gruen:  eintraege.filter((e) => e.ampel === 'gruen').length,
    fertig: eintraege.filter((e) => e.ampel === 'fertig').length,
  }), [eintraege]);

  if (eintraege.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
        <ChefHat className="h-6 w-6 mx-auto mb-2 opacity-40" />
        Keine aktiven Bestellungen
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-xs font-bold uppercase tracking-wider">
            Zubereitungs-Ampel
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          {stats.rot > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-600 text-white px-2 py-0.5 animate-pulse">
              {stats.rot} krit.
            </span>
          )}
          {stats.orange > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-orange-500 text-white px-2 py-0.5">
              {stats.orange} dring.
            </span>
          )}
          {stats.fertig > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-matcha-600 text-white px-2 py-0.5">
              {stats.fertig} fertig
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {eintraege.map((e) => {
          const s = AMPEL_STYLES[e.ampel];
          return (
            <div
              key={e.id}
              className={cn(
                'rounded-lg border p-3 transition-all',
                s.tile,
                s.pulse && 'animate-pulse',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{s.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs">#{e.nummer}</span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', s.badge)}>
                        {e.status === 'in_zubereitung' ? 'Kocht' : e.status === 'fertig' ? 'Fertig' : e.status === 'bestätigt' ? 'Bestätigt' : 'Neu'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{e.positionen} Pos.</p>
                  </div>
                </div>
                {/* Countdown */}
                <div className="text-right">
                  {e.ampel !== 'fertig' ? (
                    <>
                      <div className={cn(
                        'font-mono font-black text-lg tabular-nums leading-none',
                        e.countdownSek < 0 ? 'text-red-600' : e.ampel === 'orange' ? 'text-orange-600' : e.ampel === 'gelb' ? 'text-amber-600' : 'text-green-700'
                      )}>
                        {e.countdownLabel}
                      </div>
                      <div className="text-[9px] text-muted-foreground">verbleibend</div>
                    </>
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-matcha-600" />
                  )}
                </div>
              </div>
              {/* Empfehlung */}
              <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold">
                {e.ampel === 'rot' && <Flame className="h-3 w-3 text-red-600 shrink-0" />}
                {e.ampel === 'orange' && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                {e.ampel === 'gelb' && <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                {e.ampel === 'gruen' && <Zap className="h-3 w-3 text-green-600 shrink-0" />}
                {e.ampel === 'fertig' && <CheckCircle2 className="h-3 w-3 text-matcha-600 shrink-0" />}
                <span className={cn(
                  e.ampel === 'rot' ? 'text-red-700' :
                  e.ampel === 'orange' ? 'text-orange-700' :
                  e.ampel === 'gelb' ? 'text-amber-700' :
                  e.ampel === 'fertig' ? 'text-matcha-700' :
                  'text-green-700'
                )}>
                  {e.empfehlung}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 px-4 py-2 border-t text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{'>'} 18 Min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />10–18 Min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />5–10 Min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" />{'<'} 5 Min</span>
      </div>
    </div>
  );
}
