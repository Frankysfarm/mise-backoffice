'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerDurchsatz {
  fahrer_id: string;
  fahrer_name: string;
  bph: number;
  bph_vorwoche: number | null;
  bestellungen_heute: number;
  stunden_aktiv: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerDurchsatz[];
  team_avg_bph: number;
  alert_count: number;
}

function ampelStyle(bph: number) {
  if (bph >= 3) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (bph >= 2) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
}

function DurchsatzBar({ bph }: { bph: number }) {
  const max = 5;
  const w = Math.min(100, (bph / max) * 100);
  const color = bph >= 3 ? 'bg-green-500' : bph >= 2 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-500" style={{ left: '40%' }} title="Alert: <2/h" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '60%' }} title="Ziel: ≥3/h" />
    </div>
  );
}

function coachingTipp(bph: number, lieferungen: number): string {
  if (bph >= 3) return `${bph.toFixed(1)} Lieferungen/h — starke Leistung! ${lieferungen} Touren heute. Tempo halten!`;
  if (bph >= 2) return `${bph.toFixed(1)} Lieferungen/h — fast am Ziel! Noch etwas schneller für ≥3/h. Wege optimieren!`;
  return `${bph.toFixed(1)} Lieferungen/h — unter Ziel von 2/h! Routen prüfen und Dispatcher informieren.`;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', bph: 4.5, bph_vorwoche: 4.2, bestellungen_heute: 18, stunden_aktiv: 4.0, trend: 'steigend', trend_delta: 0.3, ampel: 'gruen' }],
  team_avg_bph: 3.8,
  alert_count: 0,
};

export function FahrerPhase2504MeinDurchsatz({
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
      fetch(`/api/delivery/admin/fahrer-durchsatz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.bph);
  const tipp = coachingTipp(me.bph, me.bestellungen_heute);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Mein Durchsatz</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.bph.toFixed(1)}/h
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.bph.toFixed(1)}<span className="text-lg">/h</span>
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">Lieferungen/Stunde heute</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'steigend' ? <TrendingUp size={11} className="text-green-600" /> :
                 me.trend === 'fallend'  ? <TrendingDown size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trend_delta !== 0 ? `${me.trend_delta > 0 ? '+' : ''}${me.trend_delta.toFixed(1)} vs. VW` : 'Stabil vs. VW'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <DurchsatzBar bph={me.bph} />
            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
              <span>0</span>
              <span className="text-amber-500">2/h Alert</span>
              <span className="text-green-600">3/h Ziel</span>
              <span>5/h</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'VW', val: me.bph_vorwoche !== null ? `${me.bph_vorwoche.toFixed(1)}/h` : '–' },
              { label: 'Team-Ø', val: `${data.team_avg_bph.toFixed(1)}/h` },
              { label: 'Touren heute', val: `${me.bestellungen_heute}` },
              { label: 'Aktiv (h)', val: `${me.stunden_aktiv.toFixed(1)}h` },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-white/60 px-2 py-1.5 text-center border border-white/80">
                <div className="text-sm font-black text-gray-700">{k.val}</div>
                <div className="text-[9px] text-gray-500">{k.label}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg px-3 py-2 text-[10px] font-medium ${style.bg} ${style.text} border`}>
            {tipp}
          </div>

          <div className="text-[8px] text-gray-400">30-Min-Polling · Ziel: ≥3 Lieferungen/h</div>
        </div>
      )}
    </div>
  );
}
