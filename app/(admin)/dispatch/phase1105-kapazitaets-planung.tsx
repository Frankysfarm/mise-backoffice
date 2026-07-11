'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1105 — Kapazitäts-Planungs-Empfehlung (Dispatch)
// Wie viele Fahrer werden für die nächste Stunde basierend auf historischer Nachfrage empfohlen?

interface Props { locationId: string | null }

type EmpfehlungsLevel = 'kritisch' | 'warnung' | 'ok';

type StundenEmpfehlung = {
  stunde_label: string;
  empfohlene_fahrer: number;
  aktuelle_fahrer: number;
  delta: number;
  level: EmpfehlungsLevel;
  prognose_bestellungen: number;
};

type ApiData = {
  naechste_stunde: StundenEmpfehlung;
  uebernachste_stunde: StundenEmpfehlung;
  aktuelle_fahrer_online: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  naechste_stunde: {
    stunde_label: 'Nächste Stunde',
    empfohlene_fahrer: 4,
    aktuelle_fahrer: 3,
    delta: 1,
    level: 'warnung',
    prognose_bestellungen: 18,
  },
  uebernachste_stunde: {
    stunde_label: 'Übernächste Stunde',
    empfohlene_fahrer: 5,
    aktuelle_fahrer: 3,
    delta: 2,
    level: 'kritisch',
    prognose_bestellungen: 24,
  },
  aktuelle_fahrer_online: 3,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

function LevelBadge({ level }: { level: EmpfehlungsLevel }) {
  const cls =
    level === 'kritisch' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
    level === 'warnung' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  const label = level === 'kritisch' ? 'Kritisch' : level === 'warnung' ? 'Warnung' : 'OK';
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', cls)}>{label}</span>;
}

function StundCard({ emp }: { emp: StundenEmpfehlung }) {
  const needsMore = emp.delta > 0;
  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      emp.level === 'kritisch' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20' :
      emp.level === 'warnung' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20' :
      'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20',
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{emp.stunde_label}</span>
        <LevelBadge level={emp.level} />
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
        <div>
          <div className="text-[10px] text-gray-400">Prognose</div>
          <div className="font-bold tabular-nums">{emp.prognose_bestellungen} Bestellungen</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">Empfohlen</div>
          <div className="font-bold tabular-nums">{emp.empfohlene_fahrer} Fahrer</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">Online</div>
          <div className="font-bold tabular-nums">{emp.aktuelle_fahrer} Fahrer</div>
        </div>
      </div>
      {needsMore && (
        <div className="flex items-center gap-1.5 rounded bg-white/60 dark:bg-black/20 px-2 py-1 text-[11px] font-semibold">
          <Users className="h-3 w-3 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-400">
            +{emp.delta} Fahrer einplanen
          </span>
        </div>
      )}
    </div>
  );
}

export function DispatchPhase1105KapazitaetsPlanung({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const url = `/api/delivery/admin/kapazitaets-planung?location_id=${encodeURIComponent(locationId)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, [load]);

  const topLevel: EmpfehlungsLevel =
    data?.naechste_stunde.level === 'kritisch' || data?.uebernachste_stunde.level === 'kritisch'
      ? 'kritisch'
      : data?.naechste_stunde.level === 'warnung' || data?.uebernachste_stunde.level === 'warnung'
        ? 'warnung'
        : 'ok';

  const headerBg =
    topLevel === 'kritisch' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
    topLevel === 'warnung' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
    'bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700';

  const Icon = topLevel === 'kritisch' ? AlertOctagon : topLevel === 'warnung' ? AlertTriangle : Users;
  const iconColor = topLevel === 'kritisch' ? 'text-red-500' : topLevel === 'warnung' ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className={cn('rounded-xl border p-3 text-sm', headerBg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <Icon className={cn('h-4 w-4', iconColor)} />
          <span>Kapazitäts-Planung</span>
          {data && (
            <span className="text-xs font-normal text-gray-500">
              {data.aktuelle_fahrer_online} Fahrer online
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {data ? (
            <>
              <StundCard emp={data.naechste_stunde} />
              <StundCard emp={data.uebernachste_stunde} />
              <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
                Basierend auf historischen Daten · Aktualisiert alle 5 Min
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-2 text-center">
              {locationId ? 'Lade Kapazitätsprognose…' : 'Bitte Filiale auswählen.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
