'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerUmsatz {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_euro: number;
  umsatz_vorwoche: number | null;
  touren_heute: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerUmsatz[];
  team_total_euro: number;
  team_avg_euro: number;
  alert_count: number;
}

function ampelStyle(euro: number) {
  if (euro >= 200) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (euro >= 100) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
}

function UmsatzBar({ euro }: { euro: number }) {
  const max = 300;
  const w = Math.min(100, (euro / max) * 100);
  const color = euro >= 200 ? 'bg-green-500' : euro >= 100 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-500" style={{ left: '33.3%' }} title="Alert: <100€" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '66.7%' }} title="Ziel: ≥200€" />
    </div>
  );
}

function coachingTipp(euro: number, touren: number): string {
  if (euro >= 200) return `${euro.toFixed(0)}€ heute — starker Umsatz! ${touren} Touren abgeschlossen. Weiter so!`;
  if (euro >= 100) return `${euro.toFixed(0)}€ heute — auf Kurs! Noch ${(200 - euro).toFixed(0)}€ bis zum Tagesziel ≥200€.`;
  return `${euro.toFixed(0)}€ heute — unter Ziel von 100€! Dispatcher ansprechen für mehr Touren.`;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', umsatz_euro: 231.00, umsatz_vorwoche: 210.50, touren_heute: 7, trend: 'steigend', trend_delta: 20, ampel: 'gruen' }],
  team_total_euro: 751.50,
  team_avg_euro: 187.88,
  alert_count: 0,
};

export function FahrerPhase2509MeinUmsatz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-umsatz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.umsatz_euro);
  const tipp = coachingTipp(me.umsatz_euro, me.touren_heute);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Mein Umsatz</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.umsatz_euro.toFixed(0)}€
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.umsatz_euro.toFixed(0)}<span className="text-lg">€</span>
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">Umsatz heute</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'steigend' ? <TrendingUp size={11} className="text-green-600" /> :
                 me.trend === 'fallend'  ? <TrendingDown size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trend_delta !== 0 ? `${me.trend_delta > 0 ? '+' : ''}${me.trend_delta}€ vs. VW` : 'Stabil vs. VW'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <UmsatzBar euro={me.umsatz_euro} />
            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
              <span>0€</span>
              <span>Alert 100€</span>
              <span>Ziel 200€</span>
              <span>300€</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">VW</div>
              <div className="text-xs font-black tabular-nums text-gray-700">
                {me.umsatz_vorwoche !== null ? `${me.umsatz_vorwoche.toFixed(0)}€` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">Trend</div>
              <div className="flex justify-center items-center gap-0.5">
                {me.trend === 'steigend' ? <TrendingUp size={13} className="text-green-600" /> :
                 me.trend === 'fallend'  ? <TrendingDown size={13} className="text-red-500" /> :
                 <Minus size={13} className="text-gray-400" />}
              </div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">Ziel</div>
              <div className="text-xs font-black tabular-nums text-green-600">200€</div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">Team-Ø</div>
              <div className="text-xs font-black tabular-nums text-gray-700">{data.team_avg_euro.toFixed(0)}€</div>
            </div>
          </div>

          {/* Coaching Tip */}
          <div className={`rounded-lg px-3 py-2 text-[10px] font-medium ${style.text} bg-white/50`}>
            {tipp}
          </div>

          <div className="text-[8px] text-gray-400 text-right">30-Min-Polling · {me.touren_heute} Tour{me.touren_heute !== 1 ? 'en' : ''} heute</div>
        </div>
      )}
    </div>
  );
}
