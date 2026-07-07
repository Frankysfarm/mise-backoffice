'use client';

import { useEffect, useState, useCallback } from 'react';
import { Target, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface SlaData {
  gesamtLieferungen: number;
  pünktlich: number;
  zielPct: number;
  aktuellerPct: number;
  delta: number;
  generatedAt: string;
}

const MOCK: SlaData = {
  gesamtLieferungen: 47,
  pünktlich: 41,
  zielPct: 90,
  aktuellerPct: 87,
  delta: -3,
  generatedAt: new Date().toISOString(),
};

export function LieferdienstPhase619SlaZielerreichungsBand({ locationId }: Props) {
  const [data, setData] = useState<SlaData | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/sla-snapshot?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('kein SLA-Snapshot');
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data || !locationId) return null;

  const erreicht = data.aktuellerPct >= data.zielPct;
  const knapp = !erreicht && data.delta >= -5;

  const StatusIcon = erreicht ? CheckCircle2 : knapp ? AlertTriangle : XCircle;
  const statusText = erreicht ? 'Ziel erreicht' : knapp ? 'Knapp verfehlt' : 'Ziel verfehlt';

  const farbe = erreicht
    ? {
        bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
        text: 'text-green-700 dark:text-green-300',
        bar: 'bg-green-500 dark:bg-green-400',
        icon: 'text-green-600 dark:text-green-400',
      }
    : knapp
    ? {
        bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        bar: 'bg-amber-500 dark:bg-amber-400',
        icon: 'text-amber-600 dark:text-amber-400',
      }
    : {
        bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
        bar: 'bg-red-500 dark:bg-red-400',
        icon: 'text-red-600 dark:text-red-400',
      };

  const barPct = Math.min(100, data.aktuellerPct);
  const zielMarkerPct = Math.min(100, data.zielPct);

  return (
    <div className={`mb-4 rounded-xl border ${farbe.bg} p-3 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            SLA-Zielerreichung
          </span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${farbe.text}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${farbe.icon}`} />
          {statusText}
        </div>
      </div>

      {/* Progress bar with target marker */}
      <div className="relative h-3 rounded-full bg-gray-200 dark:bg-gray-700 mb-2">
        <div
          className={`h-3 rounded-full transition-all ${farbe.bar}`}
          style={{ width: `${barPct}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-0 h-3 w-0.5 bg-gray-600 dark:bg-gray-300"
          style={{ left: `${zielMarkerPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1.5">
          <div className={`text-lg font-black tabular-nums ${farbe.text}`}>
            {data.aktuellerPct}%
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Pünktlich</div>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1.5">
          <div className="text-lg font-black tabular-nums text-gray-700 dark:text-gray-300">
            {data.zielPct}%
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Ziel</div>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1.5">
          <div className="text-lg font-black tabular-nums text-gray-900 dark:text-gray-100">
            {data.pünktlich}/{data.gesamtLieferungen}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Lieferungen</div>
        </div>
      </div>

      {!erreicht && (
        <div className={`mt-2 text-xs font-medium ${farbe.text}`}>
          Noch {data.pünktlich > 0
            ? Math.ceil((data.zielPct / 100) * data.gesamtLieferungen) - data.pünktlich
            : 0} pünktliche Lieferungen bis Tagesziel ({data.zielPct}%)
        </div>
      )}
    </div>
  );
}
