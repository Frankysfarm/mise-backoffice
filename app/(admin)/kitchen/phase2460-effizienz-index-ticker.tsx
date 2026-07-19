'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';

interface FahrerEffizienz {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_avg_score: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2460EffizienzIndexTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-effizienz-index?location_id=${locationId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const hasAlerts = (data.alert_count ?? 0) > 0;
  const headerColor = hasAlerts ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200';
  const headerText = hasAlerts ? 'text-red-700' : 'text-green-700';

  return (
    <div className={`border rounded-xl mb-2 overflow-hidden ${headerColor}`}>
      <button
        className={`w-full flex items-center justify-between px-3 py-1.5 font-semibold text-xs ${headerText}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-1.5">
          <Zap size={12} />
          Effizienz-Index
          <span className="font-bold">{data.team_avg_score.toFixed(1)}</span>
          {hasAlerts && (
            <span className="bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full">{data.alert_count}</span>
          )}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="bg-white px-3 pb-2 pt-1 space-y-2">
          {hasAlerts && (
            <div className="flex items-start gap-1.5 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-700">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>
                <strong>Niedriger Index:</strong>{' '}
                {data.fahrer.filter(f => f.alert_niedrig).map(f => f.fahrer_name).join(', ')} — unter 60
              </span>
            </div>
          )}
          <div className="space-y-1">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-1.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="flex-1 truncate text-gray-700">{f.fahrer_name}</span>
                <span className="font-semibold text-gray-600">{f.effizienz_score.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
