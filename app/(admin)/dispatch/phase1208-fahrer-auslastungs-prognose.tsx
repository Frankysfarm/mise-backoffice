'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1208 — Fahrer-Auslastungs-Prognose (Dispatch)
// Wie viele Fahrer werden in der nächsten Stunde benötigt
// basierend auf historischem Auftragsvolumen + aktuelle Queue

interface PrognoseStunde {
  stunde_offset: number;
  stunde_label: string;
  erwartete_bestellungen: number;
  benoetigte_fahrer: number;
  verfuegbare_fahrer: number;
  delta: number;
  status: 'ausreichend' | 'knapp' | 'kritisch';
}

interface ApiData {
  prognose: PrognoseStunde[];
  aktuelle_queue: number;
  aktive_fahrer: number;
  empfehlung: string;
  location_id: string | null;
  generiert_am: string;
}

interface Props { locationId: string | null }

const STATUS_STYLES = {
  ausreichend: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  knapp:       { icon: TrendingUp,  color: 'text-amber-600 dark:text-amber-400',   badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',   bar: 'bg-amber-500' },
  kritisch:    { icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400',   badge: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300',       bar: 'bg-rose-500' },
};

function MOCK(): ApiData {
  return {
    prognose: [
      { stunde_offset: 1, stunde_label: '19:00', erwartete_bestellungen: 18, benoetigte_fahrer: 5, verfuegbare_fahrer: 4, delta: -1, status: 'knapp' },
      { stunde_offset: 2, stunde_label: '20:00', erwartete_bestellungen: 22, benoetigte_fahrer: 6, verfuegbare_fahrer: 4, delta: -2, status: 'kritisch' },
      { stunde_offset: 3, stunde_label: '21:00', erwartete_bestellungen: 15, benoetigte_fahrer: 4, verfuegbare_fahrer: 4, delta: 0, status: 'ausreichend' },
    ],
    aktuelle_queue: 6,
    aktive_fahrer: 4,
    empfehlung: 'In Stunde +2 werden 2 zusätzliche Fahrer benötigt — jetzt einplanen.',
    location_id: null,
    generiert_am: new Date().toISOString(),
  };
}

export function DispatchPhase1208FahrerAuslastungsPrognose({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  const fetch = useCallback(async () => {
    if (!locationId) { setData(MOCK()); return; }
    try {
      const res = await window.fetch(`/api/delivery/admin/fahrer-auslastungs-prognose?location_id=${locationId}`);
      const json = await res.json();
      setData(json.prognose !== undefined ? json : MOCK());
    } catch {
      setData(MOCK());
    }
  }, [locationId]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetch]);

  if (!data) return null;

  const worstStatus = data.prognose.find(p => p.status === 'kritisch')?.status
    ?? data.prognose.find(p => p.status === 'knapp')?.status
    ?? 'ausreichend';
  const headerStyle = STATUS_STYLES[worstStatus];
  const HeaderIcon = headerStyle.icon;

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Fahrer-Auslastungs-Prognose</span>
          <HeaderIcon className={cn('h-4 w-4 shrink-0', headerStyle.color)} />
          <span className={cn('rounded-full text-[10px] font-bold px-2 py-0.5 capitalize', headerStyle.badge)}>
            {worstStatus}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Summary row */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Aktive Fahrer:</span>
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{data.aktive_fahrer}</span>
            <span className="text-muted-foreground">Queue:</span>
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{data.aktuelle_queue} Bestellungen</span>
          </div>

          {/* Prognose rows */}
          <div className="space-y-2">
            {data.prognose.map(p => {
              const s = STATUS_STYLES[p.status];
              const Icon = s.icon;
              const maxBenoetigt = Math.max(...data.prognose.map(x => x.benoetigte_fahrer), 1);
              const barPct = Math.round((p.benoetigte_fahrer / maxBenoetigt) * 100);
              return (
                <div key={p.stunde_offset} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] font-mono text-muted-foreground">+{p.stunde_offset}h</span>
                  <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{p.stunde_label}</span>
                  <div className="flex-1 h-5 rounded bg-black/5 dark:bg-white/5 overflow-hidden">
                    <div className={cn('h-full rounded transition-all', s.bar)} style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-[11px] text-muted-foreground tabular-nums text-right">
                    {p.erwartete_bestellungen} Bst.
                  </span>
                  <span className={cn('w-20 shrink-0 text-right text-[11px] font-bold tabular-nums', s.color)}>
                    {p.benoetigte_fahrer} Fhr. nötig
                  </span>
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', s.color)} />
                </div>
              );
            })}
          </div>

          {/* Empfehlung */}
          <div className={cn('rounded-lg border px-3 py-2 text-xs font-medium', headerStyle.badge)}>
            {data.empfehlung}
          </div>

          <p className="text-[10px] text-muted-foreground">Aktualisiert alle 5 Min.</p>
        </div>
      )}
    </div>
  );
}
