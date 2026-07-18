'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Shield, User } from 'lucide-react';

type PausenStatus = 'ok' | 'pause_faellig' | 'ueberzeit';

interface FahrerPause {
  fahrer_id: string;
  fahrer_name: string;
  schicht_dauer_min: number;
  pause_genommen_min: number;
  pause_pflicht_min: number;
  status: PausenStatus;
  pause_faellig_seit_min: number | null;
}

interface PausenData {
  location_id: string;
  fahrer: FahrerPause[];
  compliance_rate_pct: number;
  generiert_am: string;
}

const MOCK: PausenData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', schicht_dauer_min: 290, pause_genommen_min: 0, pause_pflicht_min: 0, status: 'ok', pause_faellig_seit_min: null },
    { fahrer_id: 'f2', fahrer_name: 'Lisa B.', schicht_dauer_min: 420, pause_genommen_min: 0, pause_pflicht_min: 30, status: 'pause_faellig', pause_faellig_seit_min: 60 },
    { fahrer_id: 'f3', fahrer_name: 'Tom K.', schicht_dauer_min: 480, pause_genommen_min: 30, pause_pflicht_min: 30, status: 'ok', pause_faellig_seit_min: null },
    { fahrer_id: 'f4', fahrer_name: 'Jan S.', schicht_dauer_min: 500, pause_genommen_min: 10, pause_pflicht_min: 30, status: 'ueberzeit', pause_faellig_seit_min: 140 },
    { fahrer_id: 'f5', fahrer_name: 'Nina R.', schicht_dauer_min: 200, pause_genommen_min: 0, pause_pflicht_min: 0, status: 'ok', pause_faellig_seit_min: null },
  ],
  compliance_rate_pct: 60,
  generiert_am: new Date().toISOString(),
};

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_STYLE: Record<PausenStatus, { bg: string; text: string; label: string }> = {
  ok:           { bg: 'bg-green-100 dark:bg-green-900/40',  text: 'text-green-700 dark:text-green-300',  label: 'OK' },
  pause_faellig:{ bg: 'bg-yellow-100 dark:bg-yellow-900/40',text: 'text-yellow-700 dark:text-yellow-300', label: 'Pause fällig' },
  ueberzeit:    { bg: 'bg-red-100 dark:bg-red-900/40',      text: 'text-red-700 dark:text-red-300',       label: 'Überzeit' },
};

export function LieferdienstPhase2310PausenUebersicht({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<PausenData | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-pausen-compliance?location_id=${locationId}`);
      if (!r.ok) throw new Error('fetch failed');
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const { risikofahrer, okFahrer, rate } = useMemo(() => {
    if (!data) return { risikofahrer: [], okFahrer: [], rate: 0 };
    const risikofahrer = data.fahrer.filter(f => f.status !== 'ok');
    const okFahrer = data.fahrer.filter(f => f.status === 'ok');
    return { risikofahrer, okFahrer, rate: data.compliance_rate_pct };
  }, [data]);

  if (!data) return null;

  const rateColor = rate >= 80 ? 'text-green-600 dark:text-green-400'
    : rate >= 60 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400';

  const headerBg = risikofahrer.length === 0
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : risikofahrer.some(f => f.status === 'ueberzeit')
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';

  return (
    <div className={`rounded-xl border p-3 mt-2 ${headerBg}`}>
      <button
        className="w-full flex items-center justify-between gap-2 text-sm font-semibold"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-1.5">
          <Shield className="h-4 w-4" />
          Pausen-Compliance
          {risikofahrer.length > 0 && (
            <span className="ml-1 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5">
              {risikofahrer.length} Risiko
            </span>
          )}
        </span>
        <span className={`text-base font-bold ${rateColor}`}>{rate}%</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {risikofahrer.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Risikofahrer
              </p>
              {risikofahrer.map(f => {
                const s = STATUS_STYLE[f.status];
                return (
                  <div key={f.fahrer_id} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${s.bg}`}>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
                      <User className="h-3.5 w-3.5" />
                      {f.fahrer_name}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5 text-slate-600 dark:text-slate-300">
                        <Clock className="h-3 w-3" />
                        {fmtMin(f.schicht_dauer_min)}
                      </span>
                      <span className={`font-semibold rounded px-1.5 py-0.5 ${s.bg} ${s.text}`}>
                        {s.label}
                        {f.pause_faellig_seit_min != null && ` +${fmtMin(f.pause_faellig_seit_min)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {okFahrer.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                Compliant ({okFahrer.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {okFahrer.map(f => (
                  <span
                    key={f.fahrer_id}
                    className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded px-2 py-0.5"
                  >
                    {f.fahrer_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 text-right">
            Aktualisiert: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
