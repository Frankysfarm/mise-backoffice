'use client';
import { useEffect, useState } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface ZoneRow {
  zone_name: string;
  bestellungen: number;
  umsatz: number;
  avg_lieferzeit_min: number;
  sla_rate: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  zonen: ZoneRow[];
  gesamt_bestellungen: number;
  gesamt_umsatz: number;
  avg_lieferzeit: number;
  sla_gesamt: number;
  alert_zonen: number;
}

const MOCK: ApiData = {
  zonen: [
    { zone_name: 'Mitte',    bestellungen: 48, umsatz: 1240.50, avg_lieferzeit_min: 18, sla_rate: 94, ampel: 'gruen' },
    { zone_name: 'Nord',     bestellungen: 31, umsatz:  820.80, avg_lieferzeit_min: 22, sla_rate: 87, ampel: 'gelb'  },
    { zone_name: 'West',     bestellungen: 19, umsatz:  490.20, avg_lieferzeit_min: 28, sla_rate: 74, ampel: 'rot'   },
    { zone_name: 'Südstadt', bestellungen: 27, umsatz:  710.60, avg_lieferzeit_min: 20, sla_rate: 91, ampel: 'gruen' },
  ],
  gesamt_bestellungen: 125,
  gesamt_umsatz: 3262.10,
  avg_lieferzeit: 22,
  sla_gesamt: 88,
  alert_zonen: 1,
};

function ampelBg(a: string) {
  if (a === 'rot')  return 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800';
  if (a === 'gelb') return 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800';
  return 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800';
}

function ampelText(a: string) {
  if (a === 'rot')  return 'text-red-700 dark:text-red-300';
  if (a === 'gelb') return 'text-amber-700 dark:text-amber-300';
  return 'text-green-700 dark:text-green-300';
}

function slaBar(rate: number) {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 75) return 'bg-amber-400';
  return 'bg-red-500';
}

export function LieferdienstPhase2680StatistikZonenPerformance({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/stats?location_id=${locationId}`);
        if (res.ok && active) {
          const raw = await res.json();
          if (raw?.zonen) setData(raw as ApiData);
          else setData(MOCK);
        }
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 3 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d      = data ?? MOCK;
  const alerts = d.zonen.filter(z => z.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-violet-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Zonen-Performance
          </span>
          {alerts.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alerts.length} Zone
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(z => z.zone_name).join(', ')} — Niedrige SLA-Rate!
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Bestellungen</div>
              <div className="font-bold text-lg text-violet-700 dark:text-violet-400">{d.gesamt_bestellungen}</div>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Umsatz</div>
              <div className="font-bold text-lg text-green-700 dark:text-green-400">{(d.gesamt_umsatz / 1000).toFixed(1)}k€</div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Ø Lieferzeit</div>
              <div className="font-bold text-lg text-blue-700 dark:text-blue-400">{d.avg_lieferzeit}m</div>
            </div>
            <div className={`rounded-lg p-2 ${d.sla_gesamt >= 90 ? 'bg-green-50 dark:bg-green-900/20' : d.sla_gesamt >= 75 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">SLA</div>
              <div className={`font-bold text-lg ${d.sla_gesamt >= 90 ? 'text-green-700 dark:text-green-400' : d.sla_gesamt >= 75 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>
                {d.sla_gesamt}%
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {d.zonen.map(z => (
              <div key={z.zone_name} className={`rounded-lg border p-3 ${ampelBg(z.ampel)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className={ampelText(z.ampel)} />
                    <span className={`text-sm font-semibold ${ampelText(z.ampel)}`}>{z.zone_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">{z.bestellungen} Bestellungen</span>
                    <span className="font-bold text-gray-700 dark:text-gray-200">{z.umsatz.toFixed(0)}€</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Clock size={10} />
                    <span>Ø {z.avg_lieferzeit_min} min</span>
                  </div>
                  <div className={`text-right font-semibold ${z.sla_rate >= 90 ? 'text-green-700 dark:text-green-400' : z.sla_rate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    SLA {z.sla_rate}%
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${slaBar(z.sla_rate)}`} style={{ width: `${z.sla_rate}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>{d.zonen.length} Zonen · heute</span>
            <span>SLA-Ziel ≥90%</span>
          </div>
        </div>
      )}
    </div>
  );
}
