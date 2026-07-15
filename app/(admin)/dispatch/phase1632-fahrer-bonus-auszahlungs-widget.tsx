'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface FahrerBonusRow {
  fahrer_id: string;
  fahrer_name: string;
  touren_diese_woche: number;
  puenktlichkeitsbonus: number;
  tourenbonus: number;
  trinkgeld_rate_bonus: number;
  gesamt_bonus: number;
  auszahlungs_status: 'offen' | 'bereit' | 'ausgezahlt';
}

interface BonusData {
  fahrer: FahrerBonusRow[];
  gesamt_bonus_summe: number;
  woche_start: string;
  woche_ende: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_META: Record<FahrerBonusRow['auszahlungs_status'], { label: string; bg: string; text: string; border: string }> = {
  offen:      { label: 'Offen',      bg: 'bg-stone-100',   text: 'text-stone-600',   border: 'border-stone-300'   },
  bereit:     { label: 'Bereit',     bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300'   },
  ausgezahlt: { label: 'Ausgezahlt', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
};

function fmtEur(val: number): string {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export function DispatchPhase1632FahrerBonusAuszahlungsWidget({ locationId }: Props) {
  const [data, setData] = useState<BonusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-bonus-auszahlung?${params}`, { cache: 'no-store' });
      if (r.ok) {
        setData(await r.json());
        setLastUpdate(new Date());
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60_000); // 60-Min-Polling
    return () => clearInterval(id);
  }, [load]);

  if (loading) return null;
  if (!data || data.fahrer.length === 0) return null;

  const bereit = data.fahrer.filter((f) => f.auszahlungs_status === 'bereit').length;
  const ausgezahlt = data.fahrer.filter((f) => f.auszahlungs_status === 'ausgezahlt').length;

  return (
    <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Fahrer-Bonus · Auszahlungsübersicht
        </span>
        <div className="flex items-center gap-2 text-xs">
          {bereit > 0 && (
            <span className="bg-white/25 rounded-full px-2 py-0.5 font-bold">{bereit} bereit</span>
          )}
          <span className="bg-white/15 rounded-full px-2 py-0.5 tabular-nums">
            {data.woche_start} – {data.woche_ende}
          </span>
        </div>
      </div>

      {/* Gesamt-Summe */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Gesamt Bonussumme diese Woche</div>
          <div className="text-2xl font-black tabular-nums text-amber-800 mt-0.5">
            {fmtEur(data.gesamt_bonus_summe)}
          </div>
        </div>
        <div className="text-right text-xs text-stone-500">
          <div>{data.fahrer.length} Fahrer</div>
          <div>{ausgezahlt} ausgezahlt</div>
          {lastUpdate && <div className="text-[10px]">{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>}
        </div>
      </div>

      {/* Fahrer-Tabelle */}
      <div className="divide-y divide-stone-50">
        {data.fahrer.map((f) => {
          const sm = STATUS_META[f.auszahlungs_status];
          return (
            <div key={f.fahrer_id} className="px-4 py-3 flex items-center gap-3">
              {/* Status-Badge */}
              <div className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${sm.bg} ${sm.text} ${sm.border} min-w-[78px] text-center`}>
                {sm.label}
              </div>

              {/* Name + Metriken */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-stone-800 truncate">{f.fahrer_name}</span>
                  <span className="text-[10px] text-stone-400 tabular-nums">{f.touren_diese_woche} Touren</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-stone-400 tabular-nums">
                  <span>Pünkt. {fmtEur(f.puenktlichkeitsbonus)}</span>
                  <span>Touren {fmtEur(f.tourenbonus)}</span>
                  <span>Trinkgeld {fmtEur(f.trinkgeld_rate_bonus)}</span>
                </div>
              </div>

              {/* Gesamt */}
              <div className="shrink-0 text-right">
                <div className="text-base font-black tabular-nums text-amber-700">{fmtEur(f.gesamt_bonus)}</div>
                <div className="text-[9px] text-stone-400">Gesamt</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
