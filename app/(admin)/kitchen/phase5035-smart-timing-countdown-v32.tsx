'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChefHat, CheckCircle2, Flame, Zap, TrendingUp } from 'lucide-react';

// Phase 5035 — Smart Timing Countdown V32
// Bestellungen-Countdown-Wall farbkodiert rot<5min/gelb<10min/grün≥10min;
// Batch-Koordination; Priorisierungsampel; Warnsignal Überschreitung;
// Schicht-Pünktlichkeits-Score; 15-Sek-Polling; Mock-Fallback

type ZeitStatus = 'kritisch' | 'warnung' | 'ok' | 'fertig';

interface BestellungCountdown {
  id: string;
  nr: string;
  artikel: string;
  minuten_verbleibend: number;
  ziel_min: number;
  station: string;
  batch_id: string | null;
  status: ZeitStatus;
  prioritaet: 1 | 2 | 3;
}

interface ApiData {
  bestellungen: BestellungCountdown[];
  schicht_score: number;
  aktive_batches: number;
  kritische_anzahl: number;
  alert: string | null;
}

const MOCK: ApiData = {
  schicht_score: 84,
  aktive_batches: 3,
  kritische_anzahl: 2,
  alert: null,
  bestellungen: [
    { id: '1', nr: '#0041', artikel: 'Pizza Margherita',  minuten_verbleibend: 3,  ziel_min: 12, station: 'Ofen',    batch_id: 'B1', status: 'kritisch', prioritaet: 1 },
    { id: '2', nr: '#0042', artikel: 'Burger Classic',    minuten_verbleibend: 2,  ziel_min: 10, station: 'Grill',   batch_id: null, status: 'kritisch', prioritaet: 1 },
    { id: '3', nr: '#0043', artikel: 'Pasta Carbonara',   minuten_verbleibend: 7,  ziel_min: 14, station: 'Herd',    batch_id: 'B2', status: 'warnung',  prioritaet: 2 },
    { id: '4', nr: '#0044', artikel: 'Salat César',       minuten_verbleibend: 9,  ziel_min: 8,  station: 'Kalt',    batch_id: null, status: 'warnung',  prioritaet: 2 },
    { id: '5', nr: '#0045', artikel: 'Schnitzel Wien.',   minuten_verbleibend: 14, ziel_min: 16, station: 'Grill',   batch_id: 'B1', status: 'ok',       prioritaet: 3 },
    { id: '6', nr: '#0046', artikel: 'Döner Teller',      minuten_verbleibend: 18, ziel_min: 18, station: 'Döner',   batch_id: 'B3', status: 'ok',       prioritaet: 3 },
    { id: '7', nr: '#0047', artikel: 'Gyros Reis',        minuten_verbleibend: 0,  ziel_min: 14, station: 'Grill',   batch_id: 'B3', status: 'fertig',   prioritaet: 1 },
    { id: '8', nr: '#0048', artikel: 'Veggie Wrap',       minuten_verbleibend: 11, ziel_min: 10, station: 'Kalt',    batch_id: 'B2', status: 'ok',       prioritaet: 3 },
  ],
};

const STATUS_STYLES: Record<ZeitStatus, { card: string; timer: string; badge: string; label: string }> = {
  kritisch: { card: 'border-red-400 bg-red-50',     timer: 'text-red-600',     badge: 'bg-red-600 text-white',    label: 'Kritisch' },
  warnung:  { card: 'border-amber-300 bg-amber-50', timer: 'text-amber-600',   badge: 'bg-amber-500 text-white',  label: 'Warnung'  },
  ok:       { card: 'border-emerald-200 bg-white',  timer: 'text-emerald-600', badge: 'bg-emerald-600 text-white',label: 'OK'       },
  fertig:   { card: 'border-slate-200 bg-slate-50', timer: 'text-slate-500',   badge: 'bg-slate-500 text-white',  label: 'Fertig'   },
};

const PRIO_ICON: Record<1 | 2 | 3, React.ReactNode> = {
  1: <Flame className="h-3.5 w-3.5 text-red-500" />,
  2: <Zap    className="h-3.5 w-3.5 text-amber-500" />,
  3: <ChefHat className="h-3.5 w-3.5 text-emerald-500" />,
};

function CountdownMinutes({ minuten, status }: { minuten: number; status: ZeitStatus }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s + 1) % 60), 1000);
    return () => clearInterval(t);
  }, []);

  const anzeige = status === 'fertig' ? '✓' : `${minuten}:${String(59 - secs).padStart(2, '0')}`;
  return <span>{anzeige}</span>;
}

export function KitchenPhase5035SmartTimingCountdownV32({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

  async function fetchData() {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await fetch(`/api/delivery/kitchen/timing${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;
  const sorted = [...d.bestellungen].sort((a, b) => a.prioritaet - b.prioritaet || a.minuten_verbleibend - b.minuten_verbleibend);

  return (
    <div className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-700 text-white">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-300" />
          <span className="font-bold text-sm">Smart Timing V32</span>
        </div>
        <div className="flex items-center gap-3">
          {d.kritische_anzahl > 0 && (
            <div className="flex items-center gap-1 bg-red-600 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs font-bold">{d.kritische_anzahl} kritisch</span>
            </div>
          )}
          <span className="text-xs opacity-80">Schicht {d.schicht_score}%</span>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Schicht-Score + Batch-Info */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className={`text-xl font-black ${d.schicht_score >= 85 ? 'text-emerald-600' : d.schicht_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {d.schicht_score}%
            </div>
            <div className="text-[10px] text-muted-foreground">Schicht-Score</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-xl font-black text-indigo-600">{d.aktive_batches}</div>
            <div className="text-[10px] text-muted-foreground">Aktive Batches</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-xl font-black text-foreground">{d.bestellungen.length}</div>
            <div className="text-[10px] text-muted-foreground">Bestellungen</div>
          </div>
        </div>

        {/* Countdown Wall */}
        <div className="grid grid-cols-2 gap-2">
          {sorted.map((b) => {
            const st = STATUS_STYLES[b.status];
            const fortschritt = b.status === 'fertig' ? 100 : Math.min(100, Math.round(((b.ziel_min - b.minuten_verbleibend) / b.ziel_min) * 100));
            return (
              <div key={b.id} className={`rounded-xl border p-3 ${st.card}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-1">
                      {PRIO_ICON[b.prioritaet]}
                      <span className="text-xs font-bold text-foreground">{b.nr}</span>
                      {b.batch_id && (
                        <span className="rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1">{b.batch_id}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{b.artikel}</div>
                    <div className="text-[9px] text-muted-foreground">{b.station}</div>
                  </div>
                  <div className={`text-xl font-black font-mono tabular-nums ${st.timer}`}>
                    <CountdownMinutes minuten={b.minuten_verbleibend} status={b.status} />
                  </div>
                </div>
                {/* Fortschrittsbalken */}
                <div className="h-1.5 rounded-full bg-muted/40">
                  <div
                    className={`h-1.5 rounded-full transition-all ${b.status === 'fertig' ? 'bg-emerald-500' : b.status === 'kritisch' ? 'bg-red-500' : b.status === 'warnung' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${fortschritt}%` }}
                  />
                </div>
                {b.status === 'fertig' && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-semibold">
                    <CheckCircle2 className="h-3 w-3" />Fertig
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground border-t border-border pt-2">
          <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" />Prio 1</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />Prio 2</span>
          <span className="flex items-center gap-1"><ChefHat className="h-3 w-3 text-emerald-500" />Prio 3</span>
          <span className="ml-auto flex items-center gap-1"><TrendingUp className="h-3 w-3" />15 Sek Polling</span>
        </div>
      </div>
    </div>
  );
}
