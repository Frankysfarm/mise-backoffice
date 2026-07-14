'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, RefreshCw, ChevronDown, ChevronUp, Activity, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1467 — Kapazitäts-Auslastungs-Widget (Dispatch)
// Phase1465-API: Aktive Fahrer vs. Kapazität + Durchsatz/h + Empfehlung-Banner; 5-Min-Polling; nach Phase1462.

interface AuslastungData {
  aktive_fahrer: number;
  max_fahrer: number;
  auslastungs_prozent: number;
  bestellungen_in_queue: number;
  durchsatz_pro_stunde: number;
  wartezeit_min: number;
  status: 'ausreichend' | 'warnung' | 'kritisch';
  empfehlung: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG: Record<string, { border: string; header: string; badge: string; label: string; bar: string }> = {
  ausreichend: {
    border: 'border-emerald-200 dark:border-emerald-800',
    header: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Ausreichend',
    bar: 'bg-emerald-500',
  },
  warnung: {
    border: 'border-amber-200 dark:border-amber-800',
    header: 'bg-amber-50 dark:bg-amber-950/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Warnung',
    bar: 'bg-amber-500',
  },
  kritisch: {
    border: 'border-rose-200 dark:border-rose-800',
    header: 'bg-rose-50 dark:bg-rose-950/30',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    label: 'Kritisch',
    bar: 'bg-rose-500',
  },
};

function buildMock(): AuslastungData {
  return {
    aktive_fahrer: 3,
    max_fahrer: 5,
    auslastungs_prozent: 60,
    bestellungen_in_queue: 4,
    durchsatz_pro_stunde: 12,
    wartezeit_min: 22,
    status: 'ausreichend',
    empfehlung: 'Kapazität ausreichend. 3 Fahrer aktiv, Betrieb läuft normal.',
  };
}

export function DispatchPhase1467KapazitaetsAuslastungsWidget({ locationId }: Props) {
  const [data, setData] = useState<AuslastungData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/kapazitaets-auslastung?location_id=${locationId}`);
      if (!res.ok) { setData(buildMock()); } else { setData(await res.json()); }
    } catch {
      setData(buildMock());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Kapazität wird geladen…
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const cfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.ausreichend;

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.border)}>
      {/* Header */}
      <button
        className={cn('w-full flex items-center gap-2 px-4 py-3 hover:opacity-90 transition-opacity', cfg.header)}
        onClick={() => setOpen(v => !v)}
      >
        <Users className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Kapazitäts-Auslastung
        </span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.badge)}>
          {cfg.label}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-4 bg-white dark:bg-slate-900">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
              <div className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">
                {data.aktive_fahrer}<span className="text-sm font-normal text-slate-400">/{data.max_fahrer}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Fahrer aktiv</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Activity className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{data.durchsatz_pro_stunde}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Aufträge/h</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{data.wartezeit_min}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ø Wartezeit Min</div>
            </div>
          </div>

          {/* Auslastungs-Balken */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
              <span>Auslastung</span>
              <span className="font-bold">{data.auslastungs_prozent}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                style={{ width: `${Math.min(100, data.auslastungs_prozent)}%` }}
              />
            </div>
          </div>

          {/* Queue */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Bestellungen in Queue</span>
            <span className="font-black tabular-nums text-slate-800 dark:text-slate-100">{data.bestellungen_in_queue}</span>
          </div>

          {/* Empfehlung */}
          <div className={cn('rounded-lg px-3 py-2 text-xs', cfg.header)}>
            <span className="text-slate-700 dark:text-slate-300">{data.empfehlung}</span>
          </div>
        </div>
      )}
    </div>
  );
}
