'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, MapPin } from 'lucide-react';

interface ZoneLiefergebietInfo {
  zone: string;
  zone_name: string;
  avg_distanz_km: number;
  auslastung_pct: number;
  aktive_fahrer: number;
  lieferungen_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  zonen: ZoneLiefergebietInfo[];
  alert_count: number;
  rebalancing_empfehlung: string | null;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-100 border-green-300 text-green-800';
  if (a === 'gelb') return 'bg-yellow-100 border-yellow-300 text-yellow-800';
  return 'bg-red-100 border-red-300 text-red-800';
}

function ampelBar(pct: number, a: string) {
  const color = a === 'gruen' ? 'bg-green-500' : a === 'gelb' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function DispatchPhase2349LiefergebietHeatmap({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-liefergebiet-opt?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <MapPin size={14} className="inline mr-1 text-blue-500" />
          Liefergebiet-Heatmap
          {data.alert_count > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {data.alert_count} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {data.rebalancing_empfehlung && (
            <div className="mb-3 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{data.rebalancing_empfehlung}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {data.zonen.map((z) => (
              <div key={z.zone} className={`border rounded-lg p-3 ${ampelBg(z.ampel)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{z.zone}</span>
                  <span className="text-xs font-medium">{z.auslastung_pct}%</span>
                </div>
                <p className="text-xs font-medium truncate">{z.zone_name}</p>
                {ampelBar(z.auslastung_pct, z.ampel)}
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  <div>
                    <p className="text-gray-500">Ø Distanz</p>
                    <p className="font-semibold">{z.avg_distanz_km} km</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fahrer</p>
                    <p className="font-semibold">{z.aktive_fahrer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">30-Min-Polling · Zonen A/B/C/D</p>
        </div>
      )}
    </div>
  );
}
