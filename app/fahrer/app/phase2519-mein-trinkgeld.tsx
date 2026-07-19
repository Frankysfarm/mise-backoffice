'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Gift } from 'lucide-react';

interface FahrerTrinkgeld {
  id: string;
  name: string;
  trinkgeld_gesamt: number;
  trinkgeld_avg: number;
  trinkgeld_avg_vw: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTrinkgeld[];
  team_avg: number;
  team_avg_vw: number;
  alert_count: number;
}

function ampelStyle(avg: number) {
  if (avg >= 0.75) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (avg >= 0.50) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
}

function TrinkgeldBar({ avg }: { avg: number }) {
  const max = 2.0;
  const w = Math.min(100, (avg / max) * 100);
  const color = avg >= 0.75 ? 'bg-green-500' : avg >= 0.50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400" style={{ left: '25%' }} title="Alert: <0,50€" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '37.5%' }} title="Ziel: ≥0,75€" />
    </div>
  );
}

function coachingTipp(avg: number, gesamt: number, touren: number): string {
  if (avg >= 0.75) return `${avg.toFixed(2)}€/Tour — tolles Trinkgeld! Gesamt ${gesamt.toFixed(2)}€ aus ${touren} Touren. Weiter so!`;
  if (avg >= 0.50) return `${avg.toFixed(2)}€/Tour — auf gutem Weg. Noch ${(0.75 - avg).toFixed(2)}€ bis zum Ziel ≥0,75€/Tour.`;
  return `${avg.toFixed(2)}€/Tour — unter Ziel! Pünktlichkeit und freundlicher Kontakt erhöhen das Trinkgeld.`;
}

const MOCK: ApiData = {
  fahrer: [{ id: 'me', name: 'Ich', trinkgeld_gesamt: 18.54, trinkgeld_avg: 1.03, trinkgeld_avg_vw: 0.85, touren: 18, trend: 'up', ampel: 'gruen', alert: false }],
  team_avg: 0.69,
  team_avg_vw: 0.65,
  alert_count: 0,
};

export function FahrerPhase2519MeinTrinkgeld({
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
      fetch(`/api/delivery/admin/fahrer-trinkgeld?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.trinkgeld_avg);
  const tipp = coachingTipp(me.trinkgeld_avg, me.trinkgeld_gesamt, me.touren);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Gift size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Mein Trinkgeld</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.trinkgeld_avg.toFixed(2)}€/Tour
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.trinkgeld_avg.toFixed(2)}<span className="text-lg">€</span>
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">Ø pro Tour</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'up'   ? <TrendingUp size={11} className="text-green-600" /> :
                 me.trend === 'down' ? <TrendingDown size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trinkgeld_avg_vw > 0
                  ? `${(me.trinkgeld_avg - me.trinkgeld_avg_vw) > 0 ? '+' : ''}${(me.trinkgeld_avg - me.trinkgeld_avg_vw).toFixed(2)}€ vs. VW`
                  : 'Kein VW'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <TrinkgeldBar avg={me.trinkgeld_avg} />
            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
              <span>0€</span>
              <span>Alert 0,50€</span>
              <span>Ziel 0,75€</span>
              <span>2,00€</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">VW</div>
              <div className="text-xs font-black tabular-nums text-gray-700">
                {me.trinkgeld_avg_vw > 0 ? `${me.trinkgeld_avg_vw.toFixed(2)}€` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">Gesamt</div>
              <div className="text-xs font-black tabular-nums text-gray-700">{me.trinkgeld_gesamt.toFixed(2)}€</div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">Ziel</div>
              <div className="text-xs font-black tabular-nums text-green-600">0,75€</div>
            </div>
            <div className="rounded-lg bg-white/60 p-2 text-center">
              <div className="text-[9px] text-gray-500">Team-Ø</div>
              <div className="text-xs font-black tabular-nums text-gray-700">{data.team_avg.toFixed(2)}€</div>
            </div>
          </div>

          {/* Coaching Tip */}
          <div className={`rounded-lg px-3 py-2 text-[10px] font-medium ${style.text} bg-white/50`}>
            {tipp}
          </div>

          <div className="text-[8px] text-gray-400 text-right">
            30-Min-Polling · {me.touren} Tour{me.touren !== 1 ? 'en' : ''} heute
          </div>
        </div>
      )}
    </div>
  );
}
