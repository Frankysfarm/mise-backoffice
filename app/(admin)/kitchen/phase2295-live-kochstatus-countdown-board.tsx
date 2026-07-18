'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChefHat, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Ampel = 'gruen' | 'gelb' | 'rot';

type KochOrder = {
  order_id: string;
  bestellnummer: string;
  begonnen_am: string;
  ziel_min: number;
  artikel_count: number;
  kategorie: string;
  status: 'kocht' | 'warten' | 'fertig';
};

type LiveData = {
  aktive: KochOrder[];
  fertig_heute: number;
  avg_prep_min: number;
  on_time_pct: number;
  ueberzogen_count: number;
};

function getAmpel(verstrich: number, ziel: number): Ampel {
  const r = verstrich / ziel;
  if (r >= 1.05) return 'rot';
  if (r >= 0.82) return 'gelb';
  return 'gruen';
}

const S: Record<Ampel, { ring: string; bg: string; text: string; bar: string; dot: string }> = {
  gruen: {
    ring: 'ring-green-400',
    bg:   'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    bar:  'bg-green-500',
    dot:  'bg-green-500',
  },
  gelb: {
    ring: 'ring-amber-400',
    bg:   'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    bar:  'bg-amber-400',
    dot:  'bg-amber-400',
  },
  rot: {
    ring: 'ring-red-400',
    bg:   'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    bar:  'bg-red-500',
    dot:  'bg-red-500',
  },
};

function verstrichSek(begonnen_am: string): number {
  return Math.floor((Date.now() - new Date(begonnen_am).getTime()) / 1000);
}

function fmtCountdown(restSek: number): string {
  if (restSek <= 0) return '00:00';
  const m = Math.floor(restSek / 60);
  const s = restSek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function KochCard({ order, tick }: { order: KochOrder; tick: number }) {
  const verstrichSekunden = verstrichSek(order.begonnen_am);
  const zielSek = order.ziel_min * 60;
  const restSek = Math.max(0, zielSek - verstrichSekunden);
  const ampel = getAmpel(verstrichSekunden / 60, order.ziel_min);
  const s = S[ampel];
  const barPct = Math.min(100, (verstrichSekunden / zielSek) * 100);
  const ueberzogen = restSek === 0;

  return (
    <div className={cn('rounded-xl border p-3 transition-all duration-500', s.bg, ueberzogen && 'animate-pulse')}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChefHat className={cn('h-3.5 w-3.5 shrink-0', s.text)} />
          <span className="text-xs font-bold tabular-nums truncate">#{order.bestellnummer}</span>
          <span className="text-[9px] bg-muted/40 rounded px-1 py-0.5 text-muted-foreground truncate">{order.kategorie}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-white', s.dot)}>
            {order.artikel_count}
          </span>
          <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold', s.text, 'bg-current/10')}>
            {ueberzogen ? '⚡ Überzogen' : ampel === 'gelb' ? '⏳ Bald' : '✓ OK'}
          </span>
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn('font-mono text-xl font-black tabular-nums', s.text)}>
          {ueberzogen ? `+${Math.floor((verstrichSekunden - zielSek) / 60)}m` : fmtCountdown(restSek)}
        </span>
        <span className="text-[9px] text-muted-foreground">Ziel: {order.ziel_min} Min</span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', s.bar)}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

function getMock(): LiveData {
  const now = new Date();
  return {
    aktive: [
      { order_id: '1', bestellnummer: '3001', begonnen_am: new Date(now.getTime() - 7.5 * 60000).toISOString(),  ziel_min: 12, artikel_count: 3, kategorie: 'Pizza',   status: 'kocht' },
      { order_id: '2', bestellnummer: '3002', begonnen_am: new Date(now.getTime() - 11.2 * 60000).toISOString(), ziel_min: 10, artikel_count: 1, kategorie: 'Burger',  status: 'kocht' },
      { order_id: '3', bestellnummer: '3003', begonnen_am: new Date(now.getTime() - 2.3 * 60000).toISOString(),  ziel_min: 15, artikel_count: 2, kategorie: 'Salat',   status: 'kocht' },
      { order_id: '4', bestellnummer: '3004', begonnen_am: new Date(now.getTime() - 13.8 * 60000).toISOString(), ziel_min: 13, artikel_count: 4, kategorie: 'Pasta',   status: 'kocht' },
    ],
    fertig_heute: 47,
    avg_prep_min: 11.8,
    on_time_pct: 79,
    ueberzogen_count: 1,
  };
}

export function KitchenPhase2295LiveKochstatusCountdownBoard({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/kitchen-sync?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(getMock());
      }
    } catch {
      setData(getMock());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const dataId = setInterval(load, 20_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      clearInterval(dataId);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [load]);

  const teamAmpel = useMemo<Ampel>(() => {
    if (!data) return 'gruen';
    if (data.on_time_pct < 72) return 'rot';
    if (data.on_time_pct < 87) return 'gelb';
    return 'gruen';
  }, [data]);

  const s = S[teamAmpel];

  if (!locationId) return null;

  return (
    <div className="rounded-xl border bg-card p-4 mb-3 space-y-3">
      <button className="flex w-full items-center justify-between gap-2" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', s.bg.split(' ')[0])}>
            <Flame className={cn('h-4 w-4', s.text)} />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Live-Kochstatus Countdown</p>
            <p className="text-[10px] text-muted-foreground">Sekunden-Countdown · Farbkodierung · Batch</p>
          </div>
          {data && (
            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold ml-1',
              teamAmpel === 'gruen' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
              teamAmpel === 'gelb' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
              'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
            )}>
              {data.on_time_pct}% pünktlich
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* KPI-Leiste */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Aktiv',    value: String(data.aktive.length),                                 s: 'text-foreground' },
                { label: 'Ø Min',    value: data.avg_prep_min.toFixed(1),                               s: s.text },
                { label: 'Fertig',   value: String(data.fertig_heute),                                  s: 'text-matcha-600' },
                { label: 'Im Plan',  value: `${data.on_time_pct}%`,                                     s: s.text },
              ].map(k => (
                <div key={k.label} className="rounded-lg bg-muted/30 p-2 text-center">
                  <p className={cn('text-base font-black tabular-nums', k.s)}>{k.value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Alert */}
          {data && data.ueberzogen_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span><strong>{data.ueberzogen_count} Bestellung{data.ueberzogen_count > 1 ? 'en' : ''}</strong> überzieht die Zubereitungszeit</span>
            </div>
          )}

          {/* Countdown-Kacheln */}
          {data && data.aktive.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Echtzeit-Countdown (Sekunden)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.aktive.map(o => (
                  <KochCard key={o.order_id} order={o} tick={tick} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/20 py-4 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-matcha-500" />
              Keine aktiven Zubereitungen
            </div>
          )}

          {/* Gesamtstatus */}
          {data && (
            <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-[10px]',
              teamAmpel === 'gruen' ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300' :
              teamAmpel === 'gelb' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300' :
              'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300',
            )}>
              <Zap className="h-3 w-3 shrink-0" />
              {teamAmpel === 'gruen'
                ? `Top! Ø ${data.avg_prep_min.toFixed(1)} Min — ${data.fertig_heute} Bestellungen fertig heute.`
                : teamAmpel === 'gelb'
                ? `Achtung: Ø ${data.avg_prep_min.toFixed(1)} Min — ${data.ueberzogen_count} Überzogen. Tempo!`
                : `Kritisch: ${data.ueberzogen_count} überzogen — ${data.on_time_pct}% im Plan. Sofort reagieren!`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
