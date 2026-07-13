'use client';

// Phase 1238 — Schicht-Pause-Optimierer (Dispatch)
// Letzte Pause je Fahrer + Empfehlung (ruhige Zone ≤2 aktive Touren = pausieren)
// 5-Min-Polling · locationId-Prop

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Coffee, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerPause {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  aktive_touren_in_zone: number;
  empfehlung: 'pausieren' | 'weiter' | 'bald';
  empfehlung_grund: string;
}

interface PauseData {
  fahrer: FahrerPause[];
  gesamt_aktive_touren: number;
  ruhige_fahrer_anzahl: number;
}

function mockData(): PauseData {
  const fahrer: FahrerPause[] = [
    {
      fahrer_id: '1', fahrer_name: 'Lars M.',
      letzte_pause_vor_min: 180, aktive_touren_in_zone: 1,
      empfehlung: 'pausieren', empfehlung_grund: 'Keine Pause seit 3h, Zone ruhig',
    },
    {
      fahrer_id: '2', fahrer_name: 'Ying K.',
      letzte_pause_vor_min: 45, aktive_touren_in_zone: 4,
      empfehlung: 'weiter', empfehlung_grund: 'Ausreichend ausgeruht, Zone aktiv',
    },
    {
      fahrer_id: '3', fahrer_name: 'Pavel N.',
      letzte_pause_vor_min: 120, aktive_touren_in_zone: 2,
      empfehlung: 'bald', empfehlung_grund: 'Pause in ~30 Min empfohlen',
    },
    {
      fahrer_id: '4', fahrer_name: 'Mira S.',
      letzte_pause_vor_min: null, aktive_touren_in_zone: 3,
      empfehlung: 'weiter', empfehlung_grund: 'Schicht gerade gestartet',
    },
  ];
  return {
    fahrer,
    gesamt_aktive_touren: fahrer.reduce((s, f) => s + f.aktive_touren_in_zone, 0),
    ruhige_fahrer_anzahl: fahrer.filter((f) => f.empfehlung === 'pausieren').length,
  };
}

const EMP_STYLE = {
  pausieren: { bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', label: 'Jetzt pausieren', icon: Coffee },
  bald: { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', label: 'Bald pausieren', icon: Clock },
  weiter: { bg: 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700', text: 'text-stone-600 dark:text-stone-300', label: 'Weiter fahren', icon: CheckCircle2 },
} as const;

function fmtPause(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `vor ${h}h` : `vor ${h}h ${m}Min`;
}

export function DispatchPhase1238SchichtPauseOptimierer({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PauseData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-pause-optimierer?location_id=${encodeURIComponent(locationId!)}`,
        );
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(mockData());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  if (!locationId) return null;

  const display = data ?? mockData();
  const pauseEmpfohlen = display.fahrer.filter((f) => f.empfehlung === 'pausieren').length;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
          <Coffee className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Schicht-Pause-Optimierer</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">
            {pauseEmpfohlen > 0
              ? `${pauseEmpfohlen} Fahrer sollten jetzt pausieren`
              : 'Alle Fahrer im optimalen Rhythmus'}
          </div>
        </div>
        {pauseEmpfohlen > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
            {pauseEmpfohlen}
          </span>
        )}
        {loading && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800/40 p-3 text-center">
              <div className="text-lg font-black text-stone-800 dark:text-stone-100">{display.gesamt_aktive_touren}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Aktive Touren gesamt</div>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{display.ruhige_fahrer_anzahl}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Pause empfohlen</div>
            </div>
          </div>

          {display.fahrer.map((f) => {
            const style = EMP_STYLE[f.empfehlung];
            const Icon = style.icon;
            return (
              <div
                key={f.fahrer_id}
                className={cn('rounded-xl border p-3', style.bg)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', style.text)} />
                    <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">{f.fahrer_name}</span>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', style.text, 'bg-white/60 dark:bg-black/20')}>
                    {style.label}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] text-stone-500 dark:text-stone-400">
                  <span>Letzte Pause: {fmtPause(f.letzte_pause_vor_min)}</span>
                  <span>·</span>
                  <span>{f.aktive_touren_in_zone} aktive Touren in Zone</span>
                </div>
                <div className={cn('text-[10px] mt-1', style.text)}>{f.empfehlung_grund}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
