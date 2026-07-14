'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface OrderInput {
  id: string;
  status?: string | null;
  created_at?: string | null;
  category?: string | null;
  zubereitung_start?: string | null;
  zubereitung_fertig?: string | null;
  items?: { name?: string }[];
}

interface Props {
  orders: OrderInput[];
  locationId?: string | null;
}

interface KategorieRow {
  kategorie: string;
  avg_min: number;
  ziel_min: number;
  ampel: 'schnell' | 'normal' | 'langsam';
  bestellungen: number;
}

const ZIEL_MIN = 12;

const AMPEL_STYLE = {
  schnell: { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', label: 'Schnell' },
  normal:  { bar: 'bg-amber-400',   badge: 'bg-amber-100  text-amber-700',   label: 'Normal' },
  langsam: { bar: 'bg-rose-500',    badge: 'bg-rose-100   text-rose-700',    label: 'Langsam' },
};

function ampelFor(avg: number, ziel: number): 'schnell' | 'normal' | 'langsam' {
  if (avg <= ziel * 0.92) return 'schnell';
  if (avg <= ziel * 1.08) return 'normal';
  return 'langsam';
}

export function KitchenPhase1593ZubereitungsTempoKarte({ orders, locationId }: Props) {
  const [apiData, setApiData] = useState<KategorieRow[] | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const loc = locationId ?? '';
    const url = `/api/delivery/admin/zubereitungs-tempo-analyse${loc ? `?location_id=${loc}` : ''}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d: KategorieRow[] | null) => { if (Array.isArray(d) && d.length) setApiData(d); })
      .catch(() => null);
  }, [locationId]);

  const localRows = useMemo<KategorieRow[]>(() => {
    const byKat: Record<string, number[]> = {};
    for (const o of orders) {
      if (!o.zubereitung_start || !o.zubereitung_fertig) continue;
      const kat = o.category ?? 'Sonstige';
      const dur = (new Date(o.zubereitung_fertig).getTime() - new Date(o.zubereitung_start).getTime()) / 60_000;
      if (!byKat[kat]) byKat[kat] = [];
      byKat[kat].push(dur);
    }
    return Object.entries(byKat).map(([kat, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      return { kategorie: kat, avg_min: Math.round(avg * 10) / 10, ziel_min: ZIEL_MIN, ampel: ampelFor(avg, ZIEL_MIN), bestellungen: durations.length };
    });
  }, [orders]);

  const rows = apiData ?? localRows;

  const langsam = rows.filter((r) => r.ampel === 'langsam');
  const maxAvg = Math.max(ZIEL_MIN * 1.5, ...rows.map((r) => r.avg_min));

  if (!open) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Zubereitungs-Tempo je Kategorie</span>
        {langsam.length > 0 && (
          <span className="text-xs bg-rose-500 rounded-full px-2 py-0.5 font-bold">
            {langsam.length} zu langsam
          </span>
        )}
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg leading-none">×</button>
      </div>

      {rows.length === 0 ? (
        <div className="p-4 text-sm text-gray-400 text-center">Noch keine abgeschlossenen Bestellungen heute.</div>
      ) : (
        <div className="p-4 space-y-3">
          {rows.map((r) => {
            const style = AMPEL_STYLE[r.ampel];
            const barW = Math.min(100, Math.round((r.avg_min / maxAvg) * 100));
            const zielW = Math.min(100, Math.round((r.ziel_min / maxAvg) * 100));
            return (
              <div key={r.kategorie}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{r.kategorie}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{r.bestellungen} Bestell.</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${style.badge}`}>{style.label}</span>
                    <span className="font-mono text-sm font-black tabular-nums text-gray-800">{r.avg_min} min</span>
                  </div>
                </div>
                <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-visible">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
                    style={{ width: `${Math.max(4, barW)}%` }}
                  />
                  {/* Ziel-Markierung */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                    style={{ left: `${zielW}%` }}
                    title={`Ziel: ${r.ziel_min} min`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 pb-3 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Schnell (&lt;90% Ziel)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />Normal</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-rose-500" />Langsam (&gt;108% Ziel)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-gray-400" />Ziel</span>
      </div>
    </div>
  );
}
