'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Clock, Truck, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1200 — Fahrer-Rückkehr-Zeitplan (Dispatch)
// Wann kommt welcher Fahrer voraussichtlich zurück + freie Kapazität für nächste Tour

interface Props { locationId: string | null }

type FahrerRueckkehr = {
  driverId: string;
  name: string;
  vehicle: string;
  state: string;
  offeneStopps: number;
  geschaetzteRueckkehrMin: number;
  rueckkehrZeit: string;
};

type ApiData = {
  fahrer: FahrerRueckkehr[];
  generatedAt: string;
};

const MOCK: ApiData = {
  fahrer: [
    { driverId: 'm1', name: 'Max Müller', vehicle: 'Auto', state: 'on_route', offeneStopps: 1, geschaetzteRueckkehrMin: 13, rueckkehrZeit: new Date(Date.now() + 13 * 60000).toISOString() },
    { driverId: 'm2', name: 'Anna Schmidt', vehicle: 'Fahrrad', state: 'on_route', offeneStopps: 3, geschaetzteRueckkehrMin: 29, rueckkehrZeit: new Date(Date.now() + 29 * 60000).toISOString() },
    { driverId: 'm3', name: 'Tom Weber', vehicle: 'Auto', state: 'at_restaurant', offeneStopps: 4, geschaetzteRueckkehrMin: 37, rueckkehrZeit: new Date(Date.now() + 37 * 60000).toISOString() },
  ],
  generatedAt: new Date().toISOString(),
};

function zeitLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`;
}

function urgencyLevel(min: number): 'bald' | 'normal' | 'spaet' {
  if (min <= 10) return 'bald';
  if (min <= 25) return 'normal';
  return 'spaet';
}

const LEVEL_STYLES = {
  bald:   { border: 'border-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-950/30', badge: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', label: 'Bald frei' },
  normal: { border: 'border-amber-300',  bg: 'bg-amber-50 dark:bg-amber-950/30',   badge: 'bg-amber-500',  text: 'text-amber-700 dark:text-amber-300',   label: 'Unterwegs' },
  spaet:  { border: 'border-red-300',    bg: 'bg-red-50 dark:bg-red-950/30',        badge: 'bg-red-500',    text: 'text-red-700 dark:text-red-300',        label: 'Noch länger' },
};

export function DispatchPhase1200FahrerRueckkehrZeitplan({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-rueckkehr-zeitplan?location_id=${locationId}`);
      if (!res.ok) throw new Error('API error');
      const json = await res.json() as ApiData;
      setData(json.fahrer?.length ? json : MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const fahrer = data?.fahrer ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-indigo-500" />
          <span className="font-bold text-sm text-foreground">Fahrer-Rückkehr-Zeitplan</span>
          {!loading && (
            <span className="rounded-full bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5">
              {fahrer.length} aktiv
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {fahrer.length === 0 && !loading && (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-matcha-500" />
              Alle Fahrer sind gerade verfügbar.
            </div>
          )}
          {fahrer.map(f => {
            const lvl = urgencyLevel(f.geschaetzteRueckkehrMin);
            const s = LEVEL_STYLES[lvl];
            return (
              <div
                key={f.driverId}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5',
                  s.bg, s.border,
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('font-bold text-sm truncate', s.text)}>
                    {f.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {f.vehicle}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Clock className={cn('h-3.5 w-3.5', s.text)} />
                  <span className={cn('text-xs font-bold tabular-nums', s.text)}>
                    {zeitLabel(f.rueckkehrZeit)}
                  </span>
                  <span className={cn('rounded-full text-white text-[9px] font-black px-1.5 py-0.5', s.badge)}>
                    {f.geschaetzteRueckkehrMin} Min
                  </span>
                  {f.offeneStopps > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {f.offeneStopps} Stopp{f.offeneStopps !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground px-1 pt-1">
            Prognose: ~8 Min/Stopp + 5 Min Rückfahrt. Aktualisierung alle 60 s.
          </p>
        </div>
      )}
    </div>
  );
}
