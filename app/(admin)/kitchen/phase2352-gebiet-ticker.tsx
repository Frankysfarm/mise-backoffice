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

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function KitchenPhase2352GebietTicker({ locationId }: { locationId?: string | null }) {
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

  const höchstlast = data.zonen.reduce((best, z) =>
    z.auslastung_pct > best.auslastung_pct ? z : best,
    data.zonen[0]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <MapPin size={14} className="inline mr-1 text-blue-500" />
          Gebiet-Ticker
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
          {/* Höchstlast-Zone */}
          {höchstlast && (
            <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Höchste Last</p>
              <p className="font-bold text-sm text-gray-800">
                Zone {höchstlast.zone} — {höchstlast.zone_name}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${höchstlast.ampel === 'rot' ? 'bg-red-100 text-red-700' : höchstlast.ampel === 'gelb' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                  {höchstlast.auslastung_pct}%
                </span>
              </p>
            </div>
          )}

          {/* Rebalancing-Tipp */}
          {data.rebalancing_empfehlung && (
            <div className="mb-3 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{data.rebalancing_empfehlung}</span>
            </div>
          )}

          {/* Zone-Liste */}
          <div className="space-y-1.5">
            {data.zonen.map((z) => (
              <div key={z.zone} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(z.ampel)}`} />
                  <span className="text-gray-700 font-medium">Zone {z.zone}</span>
                  <span className="text-gray-400">{z.zone_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-500">Ø {z.avg_distanz_km} km</span>
                  <span className={`font-semibold ${z.ampel === 'rot' ? 'text-red-600' : z.ampel === 'gelb' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {z.auslastung_pct}%
                  </span>
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
