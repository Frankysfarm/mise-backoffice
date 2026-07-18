'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

interface FahrerLieferzeit {
  id: string;
  name: string;
  avg_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerLieferzeit[];
  team_avg_min: number;
  benchmark_min: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function KitchenPhase2372LieferzeitTicker({ locationId }: { locationId?: string | null }) {
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

  const alertFahrer = data.fahrer.filter((f) => f.alert || f.ampel === 'rot');
  const langsamster = data.fahrer.slice().sort((a, b) => b.avg_min - a.avg_min)[0];
  const hasAlert = data.alert_count > 0 || alertFahrer.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Clock size={14} className="inline mr-1 text-blue-500" />
          Lieferzeit-Ticker
          {hasAlert && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {alertFahrer.length} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg flex items-center gap-2">
            <Clock size={16} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Team-Ø Lieferzeit</p>
              <p className={`font-bold text-base ${data.team_avg_min <= 30 ? 'text-green-600' : data.team_avg_min <= 45 ? 'text-yellow-700' : 'text-red-600'}`}>
                {data.team_avg_min.toFixed(1)} Min
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-400">Ziel</p>
              <p className="text-sm font-semibold text-blue-600">{data.benchmark_min} Min</p>
            </div>
          </div>

          {hasAlert && langsamster && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {langsamster.name} Ø {langsamster.avg_min.toFixed(1)} Min — Route oder Beladung prüfen
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {data.fahrer.map((f) => (
              <div key={f.id} className="flex items-center gap-2 py-0.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
                <span className="text-xs font-semibold text-gray-800">{f.avg_min.toFixed(1)} Min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
