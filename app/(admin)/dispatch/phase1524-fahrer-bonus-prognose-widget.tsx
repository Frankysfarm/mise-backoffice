'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, CheckCircle2, Clock, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

// Phase 1524 — Fahrer-Bonus-Prognose-Widget (Dispatch)
// Phase1522-API: Status-Kacheln je Fahrer (Bonus-Prognose, Fehlende Stopps, Pünktlichkeits-Gap);
// Farb-Ampel; 10-Min-Polling; nach Phase1519.

type BonusStatus = 'erreicht' | 'auf-kurs' | 'nicht-erreichbar';

interface FahrerEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  stopps_ziel: number;
  fehlende_stopps: number;
  puenktlichkeit_pct: number;
  puenktlichkeit_ziel_pct: number;
  puenktlichkeit_gap_pct: number;
  bonus_status: BonusStatus;
  bonus_betrag_eur: number;
  prognose_erreichbar: boolean;
}

interface ApiData {
  fahrer: FahrerEintrag[];
  bonus_betrag_eur: number;
  stopps_ziel: number;
  puenktlichkeit_ziel_pct: number;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 10 * 60 * 1000;

const STATUS_CONFIG: Record<BonusStatus, {
  icon: React.ReactNode;
  bg: string;
  border: string;
  textColor: string;
  label: string;
}> = {
  erreicht: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    label: 'Bonus erreicht!',
  },
  'auf-kurs': {
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
    label: 'Auf Kurs',
  },
  'nicht-erreichbar': {
    icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-700 dark:text-rose-300',
    label: 'Nicht erreichbar',
  },
};

function buildMock(): ApiData {
  const names = ['Alex M.', 'Ben K.', 'Clara S.', 'David R.', 'Eva L.'];
  const statuses: BonusStatus[] = ['erreicht', 'auf-kurs', 'auf-kurs', 'nicht-erreichbar', 'erreicht'];
  const fahrer: FahrerEintrag[] = names.map((name, i) => {
    const stopps = 15 - i * 2;
    const puenkt = 88 - i * 8;
    const status = statuses[i];
    return {
      fahrer_id: `f${i + 1}`,
      fahrer_name: name,
      stopps_heute: stopps,
      stopps_ziel: 15,
      fehlende_stopps: Math.max(0, 15 - stopps),
      puenktlichkeit_pct: puenkt,
      puenktlichkeit_ziel_pct: 80,
      puenktlichkeit_gap_pct: Math.max(0, 80 - puenkt),
      bonus_status: status,
      bonus_betrag_eur: status === 'erreicht' ? 25 : 0,
      prognose_erreichbar: status !== 'nicht-erreichbar',
    };
  });
  return { fahrer, bonus_betrag_eur: 25, stopps_ziel: 15, puenktlichkeit_ziel_pct: 80, location_id: 'mock', generiert_am: new Date().toISOString() };
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function DispatchPhase1524FahrerBonusPrognoseWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) { setData(buildMock()); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bonus-prognose?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const raw = await res.json() as Partial<ApiData>;
      if (raw.fahrer && Array.isArray(raw.fahrer) && raw.fahrer.length > 0) {
        setData(raw as ApiData);
        setLastUpdate(new Date());
      } else {
        setData(buildMock());
      }
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const erreichtCount = data?.fahrer.filter(f => f.bonus_status === 'erreicht').length ?? 0;
  const total = data?.fahrer.length ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Gift className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Bonus-Prognose
        </span>
        {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin shrink-0" />}
        {lastUpdate && !loading && (
          <span className="text-[10px] text-slate-400 shrink-0">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">
          {erreichtCount}/{total} erreicht
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-2.5">
          {/* Ziele */}
          {data && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
                <div className="text-base font-bold text-slate-700 dark:text-slate-200">{fmtEur(data.bonus_betrag_eur)}</div>
                <div className="text-[9px] text-slate-400">Bonus-Betrag</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
                <div className="text-base font-bold text-slate-700 dark:text-slate-200">{data.stopps_ziel}</div>
                <div className="text-[9px] text-slate-400">Stopps-Ziel</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
                <div className="text-base font-bold text-slate-700 dark:text-slate-200">{data.puenktlichkeit_ziel_pct}%</div>
                <div className="text-[9px] text-slate-400">Pünktl.-Ziel</div>
              </div>
            </div>
          )}

          {/* Fahrer-Kacheln */}
          <div className="space-y-1.5">
            {(data?.fahrer ?? []).map(f => {
              const cfg = STATUS_CONFIG[f.bonus_status];
              const stoppPct = Math.min(100, Math.round((f.stopps_heute / f.stopps_ziel) * 100));
              return (
                <div
                  key={f.fahrer_id}
                  className={cn('rounded-lg border px-3 py-2 space-y-1.5', cfg.bg, cfg.border)}
                >
                  <div className="flex items-center gap-2">
                    {cfg.icon}
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">
                      {f.fahrer_name}
                    </span>
                    <span className={cn('text-[10px] font-bold', cfg.textColor)}>{cfg.label}</span>
                    {f.bonus_status === 'erreicht' && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtEur(f.bonus_betrag_eur)}
                      </span>
                    )}
                  </div>

                  {/* Stopps-Fortschritt */}
                  <div>
                    <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                      <span>Stopps {f.stopps_heute}/{f.stopps_ziel}</span>
                      {f.fehlende_stopps > 0 && (
                        <span className="text-rose-400">−{f.fehlende_stopps} fehlen</span>
                      )}
                    </div>
                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${stoppPct}%`,
                          backgroundColor: f.bonus_status === 'erreicht' ? '#10b981'
                            : f.bonus_status === 'auf-kurs' ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>

                  {/* Pünktlichkeit */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Pünktlichkeit: <strong className={cn(
                      f.puenktlichkeit_pct >= f.puenktlichkeit_ziel_pct ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400'
                    )}>{f.puenktlichkeit_pct}%</strong></span>
                    {f.puenktlichkeit_gap_pct > 0 && (
                      <span className="text-rose-400">−{f.puenktlichkeit_gap_pct}% Gap</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
