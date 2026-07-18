'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Banknote } from 'lucide-react';

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

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-600 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function fmt(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export function DispatchPhase2364TrinkgeldBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const alertFahrer = data.fahrer.filter((f) => f.alert);
  const top3 = data.fahrer.slice(0, 3);
  const rest = data.fahrer.slice(3);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Banknote size={14} className="inline mr-1 text-emerald-500" />
          Trinkgeld-Board
          {alertFahrer.length > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {alertFahrer.length} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {alertFahrer.length > 0 && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{alertFahrer.length} Fahrer unter {fmt(0.50)}/Tour — Kundenfreundlichkeit fördern</span>
            </div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø heute</p>
              <p className="font-bold text-base text-emerald-600">{fmt(data.team_avg)}/Tour</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Vorwoche</p>
              <p className="font-bold text-base text-gray-700">{fmt(data.team_avg_vw)}/Tour</p>
            </div>
          </div>

          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {top3.map((f, i) => (
                <div key={f.id} className={`rounded-lg border px-2 py-2 text-center ${ampelColor(f.ampel)}`}>
                  <p className="text-lg font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</p>
                  <p className="text-xs font-semibold truncate">{f.name}</p>
                  <p className="text-sm font-bold">{fmt(f.trinkgeld_avg)}</p>
                </div>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="space-y-1.5">
              {rest.map((f) => (
                <div key={f.id} className="flex items-center gap-2 py-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                  <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
                  <span className="text-xs font-semibold text-gray-800">{fmt(f.trinkgeld_avg)}/Tour</span>
                  <TrendIcon trend={f.trend} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
