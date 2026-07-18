'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerUe {
  fahrer_id: string;
  fahrer_name: string;
  ueberstunden_h: number;
  ueberstunden_h_vw: number;
  schicht_dauer_h: number;
  soll_dauer_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ueberstunden: boolean;
}

interface ApiData {
  fahrer: FahrerUe[];
  team_avg_ueberstunden: number;
  team_avg_ueberstunden_vw: number;
  alert_count: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

function UeBar({ ue, max = 4 }: { ue: number; max?: number }) {
  const clamped = Math.max(0, ue);
  const pct = Math.min(100, (clamped / max) * 100);
  const color = ue <= 0 ? 'bg-green-500' : ue <= 2 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '50%' }} title="+2h" />
    </div>
  );
}

function fmtH(h: number) {
  const sign = h > 0 ? '+' : '';
  return `${sign}${h.toFixed(1)}h`;
}

export function DispatchPhase2432UeberstundenBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-ueberstunden?location_id=${locationId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const hasAlerts = (data.alert_count ?? 0) > 0;
  const headerColor = hasAlerts ? 'bg-orange-50 border-orange-200' : 'bg-cyan-50 border-cyan-200';
  const headerText = hasAlerts ? 'text-orange-700' : 'text-cyan-700';

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${headerColor}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${headerText}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Clock size={14} />
          Fahrer-Überstunden
          {hasAlerts && (
            <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-4 pt-2 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">Ø Heute</div>
              <div className={`text-lg font-bold ${data.team_avg_ueberstunden > 2 ? 'text-red-600' : data.team_avg_ueberstunden > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {fmtH(data.team_avg_ueberstunden)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">Ø Vorwoche</div>
              <div className="text-lg font-bold text-gray-700">{fmtH(data.team_avg_ueberstunden_vw)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">Ziel</div>
              <div className="text-lg font-bold text-green-600">≤ 0h</div>
            </div>
          </div>

          {/* Alert Banner */}
          {hasAlerts && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
              <AlertTriangle size={13} />
              <span>
                {data.fahrer.filter(f => f.alert_ueberstunden).map(f => f.fahrer_name).join(', ')} über +2h Grenze
              </span>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${ampelColor(f.ampel)}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="font-medium w-20 truncate">{f.fahrer_name}</span>
                <span className="font-bold w-12">{fmtH(f.ueberstunden_h)}</span>
                <UeBar ue={f.ueberstunden_h} />
                <span className="text-gray-400 w-14">{f.schicht_dauer_h.toFixed(1)}h / {f.soll_dauer_h}h Soll</span>
                <span className="flex items-center gap-0.5 ml-auto">
                  <TrendIcon trend={f.trend} />
                  <span className="text-gray-500">{f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}h</span>
                </span>
              </div>
            ))}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≤ 0h</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 0–2h</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt; 2h</span>
          </div>
        </div>
      )}
    </div>
  );
}
