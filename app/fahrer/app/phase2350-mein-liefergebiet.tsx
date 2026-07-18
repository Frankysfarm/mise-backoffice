'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

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

function ampelClass(a: string) {
  if (a === 'gruen') return 'text-green-600 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function coaching(z: ZoneLiefergebietInfo): string {
  if (z.ampel === 'rot' && z.auslastung_pct >= 90) return 'Deine Zone ist stark ausgelastet — zügig liefern hilft dem Team.';
  if (z.ampel === 'rot' && z.avg_distanz_km > 10) return 'Weite Strecken heute — gute Routenplanung spart Zeit.';
  if (z.ampel === 'gelb') return 'Zone läuft gut — bleib konstant.';
  return 'Perfekte Auslastung — weiter so!';
}

export function FahrerPhase2350MeinLiefergebiet({
  locationId,
  isOnline,
}: {
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-liefergebiet-opt?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  // Show the most-loaded zone as "my" zone (or fallback to B)
  const meineZone = data.zonen.reduce((best, z) =>
    z.auslastung_pct > best.auslastung_pct ? z : best,
    data.zonen[0] ?? { zone: 'B', zone_name: 'Standard-Zone', avg_distanz_km: 0, auslastung_pct: 0, aktive_fahrer: 0, lieferungen_heute: 0, ampel: 'gruen' as const, alert: false }
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <MapPin size={14} className="inline mr-1 text-blue-500" />
          Mein Liefergebiet
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Eigene Zone */}
          <div className={`rounded-lg border p-3 mb-3 ${ampelClass(meineZone.ampel)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">Zone {meineZone.zone}</p>
                <p className="text-xs">{meineZone.zone_name}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{meineZone.auslastung_pct}%</p>
                <p className="text-xs">Auslastung</p>
              </div>
            </div>
            <div className="mt-2 w-full bg-white bg-opacity-50 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${meineZone.ampel === 'gruen' ? 'bg-green-500' : meineZone.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, meineZone.auslastung_pct)}%` }}
              />
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">Ø Distanz</p>
              <p className="font-bold text-sm">{meineZone.avg_distanz_km} km</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">Fahrer</p>
              <p className="font-bold text-sm">{meineZone.aktive_fahrer}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">Lieferungen</p>
              <p className="font-bold text-sm">{meineZone.lieferungen_heute}</p>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800">
            💡 {coaching(meineZone)}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">30-Min-Polling</p>
        </div>
      )}
    </div>
  );
}
