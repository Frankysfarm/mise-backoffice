'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface UmsatzStunde {
  stunde: string;
  heute: number;
  gestern: number;
}

interface VelocityData {
  aktuelleStunde: number;
  aktuelleVsVortag: number;
  durchschnittProStunde: number;
  prognoseHeute: number;
  stunden: UmsatzStunde[];
  aktualisiert: string;
}

const MOCK: VelocityData = {
  aktuelleStunde: 312,
  aktuelleVsVortag: 18,
  durchschnittProStunde: 247,
  prognoseHeute: 2850,
  stunden: [
    { stunde: '11', heute: 189, gestern: 162 },
    { stunde: '12', heute: 421, gestern: 388 },
    { stunde: '13', heute: 312, gestern: 264 },
    { stunde: '14', heute: 178, gestern: 195 },
    { stunde: '15', heute: 95, gestern: 144 },
  ],
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

export function LieferdienstPhase819UmsatzVelocityCockpit({ locationId }: Props) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/stats?location_id=${locationId}&period=today`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const stunden: UmsatzStunde[] = Array.isArray(json.hourly)
        ? json.hourly.slice(-5).map((h: any) => ({ stunde: String(h.hour ?? ''), heute: h.revenue ?? 0, gestern: h.revenueYesterday ?? 0 }))
        : MOCK.stunden;
      const aktuelle = stunden[stunden.length - 1]?.heute ?? MOCK.aktuelleStunde;
      const gesteAktuelle = stunden[stunden.length - 1]?.gestern ?? 264;
      const diff = gesteAktuelle > 0 ? Math.round(((aktuelle - gesteAktuelle) / gesteAktuelle) * 100) : 0;
      setData({
        aktuelleStunde: aktuelle,
        aktuelleVsVortag: diff,
        durchschnittProStunde: stunden.length > 0 ? Math.round(stunden.reduce((s, h) => s + h.heute, 0) / stunden.length) : MOCK.durchschnittProStunde,
        prognoseHeute: json.prognose ?? MOCK.prognoseHeute,
        stunden,
        aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-400 animate-pulse">Lade Umsatz-Velocity…</div>;
  if (!data) return null;

  const trend = data.aktuelleVsVortag > 0 ? 'up' : data.aktuelleVsVortag < 0 ? 'down' : 'flat';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400';
  const maxVal = Math.max(...data.stunden.flatMap(h => [h.heute, h.gestern]), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-matcha-50">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-700" />
          <span className="text-sm font-bold text-matcha-800">Umsatz-Velocity</span>
        </div>
        <span className="text-[10px] text-stone-400">{data.aktualisiert}</span>
      </div>

      <div className="grid grid-cols-3 gap-0 divide-x divide-stone-100 border-b border-stone-100">
        <div className="p-4 text-center">
          <div className="text-xl font-black tabular-nums text-matcha-700">{data.aktuelleStunde} €</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Aktuelle Stunde</div>
          <div className={`flex items-center justify-center gap-0.5 text-[10px] font-bold mt-1 ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(data.aktuelleVsVortag)}% vs. gestern
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xl font-black tabular-nums text-blue-700">{data.durchschnittProStunde} €</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Ø / Stunde heute</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xl font-black tabular-nums text-amber-700">{data.prognoseHeute.toLocaleString('de-DE')} €</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Prognose gesamt</div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3">Heute vs. Gestern (€/h)</div>
        <div className="flex items-end gap-2 h-20">
          {data.stunden.map((h) => (
            <div key={h.stunde} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex items-end gap-0.5 h-16">
                <div
                  className="flex-1 rounded-t-sm bg-matcha-400 transition-all"
                  style={{ height: `${Math.round((h.heute / maxVal) * 100)}%`, minHeight: '2px' }}
                />
                <div
                  className="flex-1 rounded-t-sm bg-stone-200 transition-all"
                  style={{ height: `${Math.round((h.gestern / maxVal) * 100)}%`, minHeight: '2px' }}
                />
              </div>
              <span className="text-[9px] text-stone-400 tabular-nums">{h.stunde}h</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[9px] text-stone-400">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-matcha-400" />Heute</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-stone-200" />Gestern</span>
        </div>
      </div>
    </div>
  );
}
