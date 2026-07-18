'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Activity } from 'lucide-react';

interface FahrerAuslastung {
  id: string;
  name: string;
  rate_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  alert_typ: 'under' | 'over' | null;
}

interface ApiData {
  fahrer: FahrerAuslastung[];
  team_avg_pct: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function KitchenPhase2377AuslastungsTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-auslastung?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className={hasAlert ? 'text-orange-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-blue-800'}`}>
            Fahrer-Auslastung {data ? `— Ø ${data.team_avg_pct}%` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} Alert{data!.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {hasAlert && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    {data.fahrer.filter(f => f.alert_typ === 'over').map(f => f.name).join(', ')}
                    {data.fahrer.filter(f => f.alert_typ === 'over').length > 0 ? ' überlastet. ' : ''}
                    {data.fahrer.filter(f => f.alert_typ === 'under').map(f => f.name).join(', ')}
                    {data.fahrer.filter(f => f.alert_typ === 'under').length > 0 ? ' unterausgelastet.' : ''}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {data.fahrer.map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                      <span className="text-gray-700">{f.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{f.rate_pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
