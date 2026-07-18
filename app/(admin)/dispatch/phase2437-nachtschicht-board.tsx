'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Moon } from 'lucide-react';

interface FahrerNacht {
  fahrer_id: string;
  fahrer_name: string;
  nacht_h: number;
  nacht_h_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_erschoepfung: boolean;
}

interface ApiData {
  fahrer: FahrerNacht[];
  team_avg_nacht_h: number;
  team_avg_nacht_h_vw: number;
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

function NachtBar({ h, max = 8 }: { h: number; max?: number }) {
  const pct = Math.min(100, (h / max) * 100);
  const color = h <= 0 ? 'bg-indigo-300' : h <= 4 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-red-400" style={{ left: `${(4 / max) * 100}%` }} title=">4h Alert" />
    </div>
  );
}

function fmtH(h: number) {
  return `${h.toFixed(1)}h`;
}

export function DispatchPhase2437NachtschichtBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-nachtschicht?location_id=${locationId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const hasAlerts = (data.alert_count ?? 0) > 0;
  const headerColor = hasAlerts ? 'bg-orange-50 border-orange-200' : 'bg-indigo-50 border-indigo-200';
  const headerText = hasAlerts ? 'text-orange-700' : 'text-indigo-700';

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${headerColor}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${headerText}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Moon size={14} />
          Nachtschicht-Board
          {hasAlerts && (
            <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Ø heute', val: fmtH(data.team_avg_nacht_h), color: data.team_avg_nacht_h > 4 ? 'text-red-600' : data.team_avg_nacht_h > 0 ? 'text-amber-600' : 'text-indigo-600' },
              { label: 'Ø Vorwoche', val: fmtH(data.team_avg_nacht_h_vw ?? 0), color: 'text-gray-600' },
              { label: 'Ziel', val: '0h', color: 'text-green-600' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg py-1.5 px-2">
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className={`font-bold text-base ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Alert Banner */}
          {hasAlerts && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong>Erschöpfungsrisiko:</strong>{' '}
                {data.fahrer.filter(f => f.alert_erschoepfung).map(f => f.fahrer_name).join(', ')} — mehr als 4h Nachtschicht!
              </span>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border ${ampelColor(f.ampel)}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="flex-1 font-medium truncate">{f.fahrer_name}</span>
                <NachtBar h={f.nacht_h} />
                <span className="w-9 text-right font-semibold">{fmtH(f.nacht_h)}</span>
                <TrendIcon trend={f.trend} />
              </div>
            ))}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-300" />0h</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />1–4h</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&gt;4h</span>
          </div>
        </div>
      )}
    </div>
  );
}
