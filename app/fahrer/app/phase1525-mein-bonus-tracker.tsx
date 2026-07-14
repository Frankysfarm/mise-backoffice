'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, RefreshCw, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react';

// Phase 1525 — Mein-Bonus-Tracker (Fahrer-App)
// Eigene Bonus-Prognose: Stopps-Fortschritt + Pünktlichkeit-Trend + Betrag-Hochrechnung;
// isOnline-Guard; 15-Min-Polling; nach Phase1520.

type BonusStatus = 'erreicht' | 'auf-kurs' | 'nicht-erreichbar';

interface BonusData {
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

interface Props {
  isOnline: boolean;
  fahrerId?: string | null;
  locationId?: string | null;
  className?: string;
}

const POLL_MS = 15 * 60 * 1000;

const STATUS_CONFIG: Record<BonusStatus, {
  icon: React.ReactNode;
  bg: string;
  border: string;
  titleColor: string;
  label: string;
  hint: string;
}> = {
  erreicht: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    titleColor: 'text-emerald-700 dark:text-emerald-300',
    label: 'Bonus erreicht!',
    hint: 'Du hast alle Ziele erfüllt — Bonus wird heute gutgeschrieben.',
  },
  'auf-kurs': {
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    titleColor: 'text-amber-700 dark:text-amber-300',
    label: 'Auf Kurs',
    hint: 'Weiter so — noch ein paar Stopps bis zum Bonus.',
  },
  'nicht-erreichbar': {
    icon: <XCircle className="w-4 h-4 text-rose-500" />,
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-800',
    titleColor: 'text-rose-700 dark:text-rose-300',
    label: 'Bonus knapp',
    hint: 'Heute wird\'s schwer — morgen wieder neu starten.',
  },
};

function buildMock(fahrerId: string): BonusData {
  const seed = fahrerId.charCodeAt(fahrerId.length - 1) % 3;
  const stopps = [12, 15, 8][seed];
  const puenkt = [85, 92, 68][seed];
  const status: BonusStatus = (['auf-kurs', 'erreicht', 'nicht-erreichbar'] as BonusStatus[])[seed];
  return {
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
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
}

export function FahrerPhase1525MeinBonusTracker({ isOnline, fahrerId, locationId, className }: Props) {
  const [data, setData] = useState<BonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!fahrerId && !locationId) {
      setData(buildMock('default'));
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-bonus-prognose?${params.toString()}`);
      if (!res.ok) throw new Error('api');
      const raw = await res.json() as { fahrer?: BonusData[] };
      const myEntry = Array.isArray(raw.fahrer) && fahrerId
        ? raw.fahrer.find((f: { fahrer_id?: string }) => f.fahrer_id === fahrerId)
        : null;
      if (myEntry) {
        setData(myEntry as BonusData);
        setLastUpdate(new Date());
      } else {
        setData(buildMock(fahrerId ?? 'default'));
      }
    } catch {
      setData(buildMock(fahrerId ?? 'default'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, fahrerId, locationId]);

  if (!isOnline) return null;

  const cfg = data ? STATUS_CONFIG[data.bonus_status] : STATUS_CONFIG['auf-kurs'];
  const stoppPct = data ? Math.min(100, Math.round((data.stopps_heute / data.stopps_ziel) * 100)) : 0;
  const hochrechnungBetrag = data?.bonus_status === 'auf-kurs' ? data.bonus_betrag_eur * (stoppPct / 100) : data?.bonus_betrag_eur ?? 0;

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bg, cfg.border, className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">Mein Bonus-Tracker</span>
        {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin shrink-0" />}
        {lastUpdate && !loading && (
          <span className="text-[10px] text-slate-400">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Status-Badge */}
      <div className="flex items-center gap-2">
        {cfg.icon}
        <span className={cn('text-base font-bold', cfg.titleColor)}>{cfg.label}</span>
        {data?.bonus_status === 'erreicht' && (
          <span className="ml-auto text-lg font-black text-emerald-600 dark:text-emerald-400">
            {fmtEur(data.bonus_betrag_eur)}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{cfg.hint}</p>

      {/* Stopps-Fortschritt */}
      {data && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Stopps: <strong className="text-slate-700 dark:text-slate-200">{data.stopps_heute}</strong> / {data.stopps_ziel}</span>
            {data.fehlende_stopps > 0 && (
              <span className="text-rose-400 font-medium">noch {data.fehlende_stopps} fehlen</span>
            )}
          </div>
          <div className="h-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${stoppPct}%`,
                backgroundColor: data.bonus_status === 'erreicht' ? '#10b981'
                  : data.bonus_status === 'auf-kurs' ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

      {/* Pünktlichkeit */}
      {data && (
        <div className="flex items-center gap-3 text-[11px]">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 dark:text-slate-400">Pünktlichkeit:</span>
          <span className={cn('font-bold',
            data.puenktlichkeit_pct >= data.puenktlichkeit_ziel_pct
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-500 dark:text-rose-400'
          )}>
            {data.puenktlichkeit_pct}%
          </span>
          <span className="text-slate-400">/ Ziel {data.puenktlichkeit_ziel_pct}%</span>
          {data.puenktlichkeit_gap_pct > 0 && (
            <span className="text-rose-400 ml-auto">−{data.puenktlichkeit_gap_pct}%</span>
          )}
        </div>
      )}

      {/* Bonus-Hochrechnung für "auf-kurs" */}
      {data?.bonus_status === 'auf-kurs' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Gift className="w-3 h-3 shrink-0" />
          <span>Hochrechnung: ca. <strong>{fmtEur(hochrechnungBetrag)}</strong> wenn Tempo gehalten wird</span>
        </div>
      )}
    </div>
  );
}
