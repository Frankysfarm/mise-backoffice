'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

interface FahrerUe {
  fahrer_id: string;
  fahrer_name: string;
  ueberstunden_h: number;
  schicht_dauer_h: number;
  soll_dauer_h: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ueberstunden: boolean;
}

interface ApiData {
  fahrer: FahrerUe[];
  team_avg_ueberstunden: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function fmtH(h: number) {
  const sign = h > 0 ? '+' : '';
  return `${sign}${h.toFixed(1)}h`;
}

export function KitchenPhase2435UeberstundenTicker({ locationId }: { locationId?: string | null }) {
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
          Überstunden-Ticker
          {hasAlerts && (
            <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-2">
          {/* Header KPI */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">Team-Ø Überstunden</span>
            <span className={`font-bold text-base ${data.team_avg_ueberstunden > 2 ? 'text-red-600' : data.team_avg_ueberstunden > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {fmtH(data.team_avg_ueberstunden)}
            </span>
          </div>

          {/* Alert Banner */}
          {hasAlerts && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded px-2 py-1 text-xs text-orange-700">
              <AlertTriangle size={11} />
              <span>
                {data.fahrer.filter(f => f.alert_ueberstunden).map(f => f.fahrer_name).join(', ')} — &gt;2h Überstunden
              </span>
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-gray-700">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="w-20 truncate font-medium">{f.fahrer_name}</span>
                <span className={`font-bold w-12 ${f.ueberstunden_h > 2 ? 'text-red-600' : f.ueberstunden_h > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {fmtH(f.ueberstunden_h)}
                </span>
                <span className="text-gray-400">{f.schicht_dauer_h.toFixed(1)}h / {f.soll_dauer_h}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
