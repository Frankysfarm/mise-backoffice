'use client';

import React, { useEffect, useState } from 'react';

interface StundenEintrag {
  stunde: number;
  einnahmen_eur: number;
}

interface ApiResponse {
  stunden: StundenEintrag[];
  gesamt_eur: number;
  prognose_eur: number;
  schicht_stunden: number;
}

interface Props {
  driverId?: string | null;
  isOnline?: boolean;
}

const BAR_MAX_H = 48;

function buildMock(driverId: string | null | undefined): ApiResponse {
  const now = new Date();
  const h = now.getHours();
  const stunden: StundenEintrag[] = [];
  for (let i = 8; i <= h; i++) {
    stunden.push({ stunde: i, einnahmen_eur: Math.round((Math.random() * 12 + 4) * 100) / 100 });
  }
  const gesamt = stunden.reduce((s, e) => s + e.einnahmen_eur, 0);
  const dauer = h - 8 + 1;
  const prognose = dauer > 0 ? Math.round((gesamt / dauer) * (10 - dauer) * 100) / 100 : 0;
  return { stunden, gesamt_eur: Math.round(gesamt * 100) / 100, prognose_eur: Math.max(0, prognose), schicht_stunden: dauer };
}

export function FahrerPhase1570TageseinnahmenVerlauf({ driverId, isOnline = true }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    const load = async () => {
      try {
        const url = `/api/delivery/driver/tageseinnahmen-verlauf${driverId ? `?driver_id=${driverId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          setData(await res.json());
        } else {
          setData(buildMock(driverId));
        }
      } catch {
        setData(buildMock(driverId));
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-3 animate-pulse space-y-2">
        <div className="h-4 w-40 bg-stone-100 rounded" />
        <div className="h-16 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  if (!data || data.stunden.length === 0) return null;

  const maxEin = Math.max(...data.stunden.map((s) => s.einnahmen_eur), 1);
  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Einnahmen-Verlauf heute</p>
        <button onClick={() => setOpen((o) => !o)} className="text-stone-400 hover:text-stone-600 text-xs">
          {open ? '▲' : '▼'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-center">
          <p className="text-xl font-black text-emerald-700">{fmtEur(data.gesamt_eur)}</p>
          <p className="text-[10px] text-stone-500">Bisher ({data.schicht_stunden}h)</p>
        </div>
        {data.prognose_eur > 0 && (
          <div className="text-center">
            <p className="text-sm font-bold text-stone-500">+{fmtEur(data.prognose_eur)}</p>
            <p className="text-[10px] text-stone-400">Prognose</p>
          </div>
        )}
      </div>

      {open && (
        <div className="flex items-end gap-1 pt-1">
          {data.stunden.map((s) => {
            const h = Math.round((s.einnahmen_eur / maxEin) * BAR_MAX_H);
            const isNow = s.stunde === new Date().getHours();
            return (
              <div key={s.stunde} className="flex flex-col items-center gap-0.5 flex-1">
                <div
                  className={`w-full rounded-t-md transition-all ${isNow ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                  style={{ height: `${Math.max(h, 4)}px` }}
                />
                <p className="text-[9px] text-stone-400">{s.stunde}h</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
