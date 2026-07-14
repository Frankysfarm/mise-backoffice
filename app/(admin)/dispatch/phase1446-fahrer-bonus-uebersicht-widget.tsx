'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, Banknote, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FahrerBonusEintrag } from '@/app/api/delivery/admin/fahrer-bonus-abrechnung/route';

// Phase 1446 — Fahrer-Bonus-Übersicht-Widget (Dispatch)
// Phase1444-API: Bonus-Rangliste + Monats-Fortschritt + Auszahlungs-Status; 30-Min-Polling

interface ApiResponse {
  fahrer: FahrerBonusEintrag[];
  gesamt_bonus_eur: number;
  monat_label: string;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Max M.', stopps_bonus_eur: 18.60, puenktlichkeits_bonus_eur: 15.00, trinkgeld_summe_eur: 42.50, gesamt_bonus_eur: 76.10, stopps_monat: 62, puenktlichkeits_quote: 92.0, auszahlungs_status: 'ausstehend' },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.', stopps_bonus_eur: 15.30, puenktlichkeits_bonus_eur: 15.00, trinkgeld_summe_eur: 31.00, gesamt_bonus_eur: 61.30, stopps_monat: 51, puenktlichkeits_quote: 88.0, auszahlungs_status: 'genehmigt' },
    { fahrer_id: 'm3', fahrer_name: 'Tim B.', stopps_bonus_eur: 10.50, puenktlichkeits_bonus_eur: 0.00, trinkgeld_summe_eur: 18.20, gesamt_bonus_eur: 28.70, stopps_monat: 35, puenktlichkeits_quote: 71.0, auszahlungs_status: 'ausstehend' },
  ],
  gesamt_bonus_eur: 166.10,
  monat_label: new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

const STATUS_CONFIG: Record<FahrerBonusEintrag['auszahlungs_status'], { cls: string; label: string }> = {
  ausstehend: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'Ausstehend' },
  genehmigt:  { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   label: 'Genehmigt' },
  ausgezahlt: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Ausgezahlt' },
};

function fmtEur(v: number): string {
  return v.toFixed(2).replace('.', ',') + ' €';
}

export function DispatchPhase1446FahrerBonusUebersichtWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetch_ = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-bonus-abrechnung?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => { setData(d); setLastUpdate(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetch_]);

  const maxBonus = Math.max(...data.fahrer.map(f => f.gesamt_bonus_eur), 1);

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
          Bonus-Abrechnung · {data.monat_label}
        </span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        {!loading && lastUpdate && (
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Gesamt-KPI */}
      <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Gesamt-Bonus</span>
        </div>
        <span className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-300">
          {fmtEur(data.gesamt_bonus_eur)}
        </span>
      </div>

      {/* Rangliste */}
      <div className="space-y-3">
        {data.fahrer.map((f, i) => {
          const balken = Math.round((f.gesamt_bonus_eur / maxBonus) * 100);
          const sc = STATUS_CONFIG[f.auszahlungs_status];
          return (
            <div key={f.fahrer_id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tabular-nums text-slate-500 dark:text-slate-400 w-4 shrink-0">
                  {i + 1}.
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">
                  {f.fahrer_name}
                </span>
                <span className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100 shrink-0">
                  {fmtEur(f.gesamt_bonus_eur)}
                </span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', sc.cls)}>
                  {sc.label}
                </span>
              </div>

              {/* Fortschrittsbalken */}
              <div className="ml-6 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 dark:bg-amber-500 transition-all duration-500"
                  style={{ width: `${balken}%` }}
                />
              </div>

              {/* Aufschlüsselung */}
              <div className="ml-6 flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Stopps: <strong>{fmtEur(f.stopps_bonus_eur)}</strong>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Pünktl.: <strong>{fmtEur(f.puenktlichkeits_bonus_eur)}</strong>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Trinkgeld: <strong>{fmtEur(f.trinkgeld_summe_eur)}</strong>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  {f.puenktlichkeits_quote.toFixed(0)}% pünktl.
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!locationId && (
        <p className="text-[10px] text-slate-400 text-center">Demo-Daten — location_id fehlt</p>
      )}
    </Card>
  );
}
