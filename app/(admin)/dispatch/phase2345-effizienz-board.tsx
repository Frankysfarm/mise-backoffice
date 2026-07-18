'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle, Star } from 'lucide-react';

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_pro_stunde: number;
  km_pro_stopp: number;
  wartezeit_min: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
}

function ampelClass(a: string) {
  if (a === 'gruen') return 'text-green-600 bg-green-50';
  if (a === 'gelb') return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return <span className="text-green-600 flex items-center gap-0.5"><TrendingUp size={12} />+{delta}</span>;
  if (trend === 'fallend') return <span className="text-red-600 flex items-center gap-0.5"><TrendingDown size={12} />{delta}</span>;
  return <span className="text-gray-400 flex items-center gap-0.5"><Minus size={12} />0</span>;
}

export function DispatchPhase2345EffizienzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const alerts = data.fahrer.filter((f) => f.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          ⚡ Schicht-Effizienz-Board
          {alerts.length > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {alerts.length} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* KPI */}
          <div className="mb-3 px-3 py-2 rounded-lg bg-gray-50 text-center">
            <p className="text-xs text-gray-500">Team-Ø Effizienz</p>
            <p className={`text-2xl font-bold ${data.team_durchschnitt >= 75 ? 'text-green-600' : data.team_durchschnitt >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.team_durchschnitt}
            </p>
          </div>

          {/* Alert-Banner */}
          {alerts.length > 0 && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>{alerts.map((f) => f.name).join(', ')}</strong> haben Effizienz &lt;50 — Coaching empfohlen.
              </span>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-2">
            {data.fahrer.map((f) => (
              <div key={f.fahrer_id} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {f.rang <= 3 && <span>{['🥇','🥈','🥉'][f.rang-1]}</span>}
                  <span className="font-medium text-gray-800 truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TrendIcon trend={f.trend} delta={f.trend_delta} />
                  <span className={`font-bold text-sm px-2 py-0.5 rounded-full ${ampelClass(f.ampel)}`}>
                    {f.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">30-Min-Polling · Score 0–100</p>
        </div>
      )}
    </div>
  );
}
