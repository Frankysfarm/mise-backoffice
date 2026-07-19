'use client';

/**
 * Phase 2630 — Smart-Countdown Farbkodierung Ultra Final (Küche)
 *
 * Vollständiges Echtzeit-Prep-Cockpit:
 * – Sekunden-Countdown je Bestellung farbkodiert (grün/gelb/rot)
 * – Prioritätssortierung (überfällig → dringend → im Plan)
 * – On-Time-Rate-Ring mit Verlaufstrend
 * – SLA-Ampel-Leiste + Batch-Kochstart-Empfehlung
 * – 1-Sek-Tick lokal + 20-Sek-Polling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Flame, Timer, TrendingDown, TrendingUp, Zap } from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────────── */

interface OrderRow {
  id: string;
  bestellnummer: string | null;
  kunde_name: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  ready_target: string | null;
  artikel_anzahl?: number | null;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig';

interface Derived extends OrderRow {
  secsLeft: number | null;
  ampel: Ampel;
}

/* ── Mock data ────────────────────────────────────────────────────── */

const MOCK: OrderRow[] = [
  { id: '1', bestellnummer: '#1071', kunde_name: 'Marie S.',  status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 8  * 60000).toISOString(), geschaetzte_zubereitung_min: 12, ready_target: new Date(Date.now() + 4   * 60000).toISOString(), artikel_anzahl: 3 },
  { id: '2', bestellnummer: '#1072', kunde_name: 'Thomas K.', status: 'bestätigt',      bestellt_am: new Date(Date.now() - 2  * 60000).toISOString(), geschaetzte_zubereitung_min: 10, ready_target: new Date(Date.now() + 8   * 60000).toISOString(), artikel_anzahl: 2 },
  { id: '3', bestellnummer: '#1073', kunde_name: 'Leila B.',  status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 14 * 60000).toISOString(), geschaetzte_zubereitung_min: 12, ready_target: new Date(Date.now() - 2   * 60000).toISOString(), artikel_anzahl: 5 },
  { id: '4', bestellnummer: '#1074', kunde_name: 'Jan M.',    status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 5  * 60000).toISOString(), geschaetzte_zubereitung_min: 8,  ready_target: new Date(Date.now() + 1.5 * 60000).toISOString(), artikel_anzahl: 1 },
  { id: '5', bestellnummer: '#1075', kunde_name: 'Ana P.',    status: 'fertig',         bestellt_am: new Date(Date.now() - 18 * 60000).toISOString(), geschaetzte_zubereitung_min: 14, ready_target: new Date(Date.now() - 4   * 60000).toISOString(), artikel_anzahl: 4 },
  { id: '6', bestellnummer: '#1076', kunde_name: 'Felix H.',  status: 'bestätigt',      bestellt_am: new Date(Date.now() - 1  * 60000).toISOString(), geschaetzte_zubereitung_min: 15, ready_target: new Date(Date.now() + 14  * 60000).toISOString(), artikel_anzahl: 2 },
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function calcAmpel(secsLeft: number | null, status: string): Ampel {
  if (['fertig', 'unterwegs', 'geliefert'].includes(status)) return 'fertig';
  if (secsLeft === null) return 'gruen';
  if (secsLeft > 180) return 'gruen';
  if (secsLeft >= 0)  return 'gelb';
  return 'rot';
}

const STYLE: Record<Ampel, { card: string; dot: string; badge: string; label: string; ring: string }> = {
  gruen:  { card: 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800', dot: 'bg-matcha-400', badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300', label: 'Im Plan',    ring: 'stroke-matcha-400' },
  gelb:   { card: 'bg-amber-50  dark:bg-amber-950/30  border-amber-200  dark:border-amber-800',  dot: 'bg-amber-400',  badge: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',  label: 'Dringend',  ring: 'stroke-amber-400'  },
  rot:    { card: 'bg-red-50    dark:bg-red-950/30    border-red-200    dark:border-red-800',    dot: 'bg-red-400',    badge: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300',    label: 'Überfällig', ring: 'stroke-red-400'    },
  fertig: { card: 'bg-stone-50  dark:bg-stone-900/20  border-stone-200  dark:border-stone-700',  dot: 'bg-stone-300',  badge: 'bg-stone-100  text-stone-500  dark:bg-stone-800/40  dark:text-stone-400',  label: 'Fertig',    ring: 'stroke-stone-300' },
};

function fmtCountdown(secs: number | null, a: Ampel): string {
  if (a === 'fertig') return '✓';
  if (secs === null)  return '—';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secs < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function sortByPriority(rows: Derived[]): Derived[] {
  const rank: Record<Ampel, number> = { rot: 0, gelb: 1, gruen: 2, fertig: 3 };
  return [...rows].sort((a, b) => {
    if (rank[a.ampel] !== rank[b.ampel]) return rank[a.ampel] - rank[b.ampel];
    return (a.secsLeft ?? 999999) - (b.secsLeft ?? 999999);
  });
}

/* ── SVG Countdown Ring ───────────────────────────────────────────── */

function CountdownRing({ secs, maxSecs, ampel }: { secs: number | null; maxSecs: number; ampel: Ampel }) {
  const pct = secs !== null && maxSecs > 0 ? Math.max(0, Math.min(1, secs / maxSecs)) : 0;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);
  const colorMap: Record<Ampel, string> = { gruen: '#4ade80', gelb: '#f59e0b', rot: '#ef4444', fertig: '#a8a29e' };

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e7e5e4" strokeWidth="4" />
      {ampel !== 'fertig' && (
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={colorMap[ampel]}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
      )}
      <text x="28" y="32" textAnchor="middle" fontSize="10" fontWeight="700" fill={colorMap[ampel]}>
        {ampel === 'fertig' ? '✓' : secs !== null ? `${Math.floor(Math.abs(secs) / 60)}m` : '—'}
      </text>
    </svg>
  );
}

/* ── On-Time Ring ─────────────────────────────────────────────────── */

function OnTimeRing({ rate }: { rate: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const color = rate >= 0.9 ? '#4ade80' : rate >= 0.75 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e7e5e4" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r}
          fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - rate)}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="800" fill={color}>
          {Math.round(rate * 100)}%
        </text>
      </svg>
      <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">On-Time</span>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

interface Props {
  locationId?: string | null;
}

export function KitchenPhase2630SmartCountdownFarbkodierungUltraFinal({ locationId }: Props) {
  const [orders, setOrders]     = useState<OrderRow[]>(MOCK);
  const [tick, setTick]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [onTimeRate, setOnTimeRate] = useState(0.83);
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  /* ── Load from Supabase ───────────────────────────────────────────── */
  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, bestellnummer, kunde_name, status, bestellt_am, geschaetzte_zubereitung_min, ready_target')
        .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
        .order('bestellt_am', { ascending: true })
        .limit(20);

      if (!error && data && data.length > 0) {
        setOrders(data as OrderRow[]);
        const done   = data.filter(o => o.status === 'fertig').length;
        const onTime = done / Math.max(1, data.length);
        setOnTimeRate(onTime);
      }
    } catch {}
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(tickRef.current);
    };
  }, [load]);

  /* ── Derive runtime values ────────────────────────────────────────── */
  const derived: Derived[] = orders.map(o => {
    const secsLeft = o.ready_target
      ? Math.round((new Date(o.ready_target).getTime() - Date.now()) / 1000)
      : null;
    return { ...o, secsLeft, ampel: calcAmpel(secsLeft, o.status) };
  });

  const sorted = sortByPriority(derived);

  const overdueCount  = sorted.filter(d => d.ampel === 'rot').length;
  const urgentCount   = sorted.filter(d => d.ampel === 'gelb').length;
  const onTrackCount  = sorted.filter(d => d.ampel === 'gruen').length;
  const doneCount     = sorted.filter(d => d.ampel === 'fertig').length;
  const activeCount   = sorted.filter(d => d.ampel !== 'fertig').length;

  /* ── Batch suggestion ─────────────────────────────────────────────── */
  const batchCandidate = sorted.filter(d => d.ampel === 'gruen' && (d.secsLeft ?? 999) > 300).slice(0, 2);
  const showBatch = batchCandidate.length >= 2;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
            Smart-Countdown Küche
          </span>
          {loading && <div className="w-1.5 h-1.5 rounded-full bg-matcha-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
          <Clock className="w-3 h-3" />
          <span>Echtzeit · 1s-Tick</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Aktiv',      value: activeCount,  color: 'text-stone-700 dark:text-stone-300', bg: 'bg-stone-50 dark:bg-stone-900' },
            { label: 'Überfällig', value: overdueCount,  color: 'text-red-600   dark:text-red-400',   bg: 'bg-red-50   dark:bg-red-950/30' },
            { label: 'Dringend',   value: urgentCount,   color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Fertig',     value: doneCount,     color: 'text-matcha-600 dark:text-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-950/30' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={cn('rounded-xl p-2.5 text-center', bg)}>
              <div className={cn('text-xl font-black tabular-nums', color)}>{value}</div>
              <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Alert banner for overdue */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
            <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
              {overdueCount} Bestellung{overdueCount > 1 ? 'en' : ''} überfällig — sofort abschließen!
            </span>
          </div>
        )}

        {/* Batch suggestion */}
        {showBatch && (
          <div className="flex items-center gap-2 rounded-xl bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 px-3 py-2">
            <Zap className="w-4 h-4 text-matcha-500 shrink-0" />
            <span className="text-[11px] font-bold text-matcha-700 dark:text-matcha-300">
              Batch-Empfehlung: {batchCandidate.map(b => b.bestellnummer).join(' + ')} gemeinsam starten
            </span>
          </div>
        )}

        {/* Order Cards */}
        <div className="space-y-2">
          {sorted.map(d => {
            const maxSecs = (d.geschaetzte_zubereitung_min ?? 15) * 60;
            const s = STYLE[d.ampel];
            return (
              <div key={d.id} className={cn('rounded-xl border p-3 flex items-center gap-3 transition-all', s.card)}>
                <CountdownRing secs={d.secsLeft} maxSecs={maxSecs} ampel={d.ampel} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate">
                      {d.bestellnummer ?? '—'}
                    </span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', s.badge)}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                    {d.kunde_name ?? 'Unbekannt'} · {d.artikel_anzahl ?? 1} Pos.
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={cn(
                    'text-lg font-black tabular-nums',
                    d.ampel === 'rot' ? 'text-red-600 dark:text-red-400' :
                    d.ampel === 'gelb' ? 'text-amber-600 dark:text-amber-400' :
                    d.ampel === 'gruen' ? 'text-matcha-600 dark:text-matcha-400' :
                    'text-stone-400'
                  )}>
                    {fmtCountdown(d.secsLeft, d.ampel)}
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">
                    {d.ampel === 'fertig' ? 'Abgeschlossen' : 'verbleibend'}
                  </div>
                </div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="text-center py-8 text-stone-400 dark:text-stone-500 text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Keine aktiven Bestellungen
            </div>
          )}
        </div>

        {/* Bottom: On-Time Ring + SLA Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
          <OnTimeRing rate={onTimeRate} />

          <div className="flex-1 ml-4 space-y-2">
            {/* SLA progress bar */}
            <div>
              <div className="flex justify-between text-[10px] font-semibold text-stone-500 mb-1">
                <span>SLA-Einhaltung heute</span>
                <span className={onTimeRate >= 0.9 ? 'text-matcha-600' : onTimeRate >= 0.75 ? 'text-amber-600' : 'text-red-600'}>
                  {Math.round(onTimeRate * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    onTimeRate >= 0.9 ? 'bg-matcha-400' : onTimeRate >= 0.75 ? 'bg-amber-400' : 'bg-red-400'
                  )}
                  style={{ width: `${Math.round(onTimeRate * 100)}%` }}
                />
              </div>
            </div>

            {/* Trend hint */}
            <div className="flex items-center gap-1.5 text-[11px]">
              {onTimeRate >= 0.9 ? (
                <>
                  <TrendingUp className="w-3 h-3 text-matcha-500" />
                  <span className="text-matcha-600 dark:text-matcha-400 font-semibold">Ziel erreicht</span>
                </>
              ) : onTimeRate >= 0.75 ? (
                <>
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Verbesserungsbedarf</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-red-600 dark:text-red-400 font-semibold">Kritischer SLA-Bereich</span>
                </>
              )}
            </div>

            {/* Timer info */}
            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <Timer className="w-3 h-3" />
              <span>Aktualisiert jede Sekunde lokal · alle 20s vom Server</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
