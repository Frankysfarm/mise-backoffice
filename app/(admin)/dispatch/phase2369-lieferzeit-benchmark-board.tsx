'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerLieferzeit {
  id: string;
  name: string;
  avg_min: number;
  avg_min_vw: number;
  min_min: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerLieferzeit[];
  team_avg_min: number;
  team_avg_min_vw: number;
  benchmark_min: number;
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

function fmtMin(val: number) {
  return `${val.toFixed(1)} Min`;
}

export function DispatchPhase2369LieferzeitBenchmarkBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-benchmark?location_id=${locationId}`);
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
          <Clock size={14} className="inline mr-1 text-blue-500" />
          Lieferzeit-Benchmark
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
              <span>
                {alertFahrer.length} Fahrer über {data.benchmark_min + 15} Min — Route optimieren oder Zuteilung prüfen
              </span>
            </div>
          )}

          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Team-Ø heute</p>
              <p className={`font-bold text-base ${data.team_avg_min <= 30 ? 'text-green-600' : data.team_avg_min <= 45 ? 'text-yellow-700' : 'text-red-600'}`}>
                {fmtMin(data.team_avg_min)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Vorwoche</p>
              <p className="font-bold text-base text-gray-700">{fmtMin(data.team_avg_min_vw)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-600">Ziel</p>
              <p className="font-bold text-base text-blue-700">{fmtMin(data.benchmark_min)}</p>
            </div>
          </div>

          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {top3.map((f, i) => (
                <div key={f.id} className={`rounded-lg border px-2 py-2 text-center ${ampelColor(f.ampel)}`}>
                  <p className="text-lg font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</p>
                  <p className="text-xs font-semibold truncate">{f.name}</p>
                  <p className="text-sm font-bold">{fmtMin(f.avg_min)}</p>
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
                  <span className="text-xs font-semibold text-gray-800">{fmtMin(f.avg_min)}</span>
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
