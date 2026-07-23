'use client';
import { useEffect, useState } from 'react';
import { Users, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface FahrerKachel {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  stopps: number;
  umsatz: number;
  avg_lieferzeit_min: number;
  alert_low: boolean;
}

interface ApiData {
  fahrer: FahrerKachel[];
  kpi_touren_heute: number;
  kpi_stopps: number;
  kpi_avg_lieferzeit: number;
  kpi_gesamtumsatz: number;
  kpi_avg_bewertung: number;
  kpi_puenktlichkeit_pct: number;
}

const MOCK: ApiData = {
  kpi_touren_heute: 18,
  kpi_stopps: 74,
  kpi_avg_lieferzeit: 29,
  kpi_gesamtumsatz: 4210,
  kpi_avg_bewertung: 4.5,
  kpi_puenktlichkeit_pct: 82,
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   score: 92, stopps: 22, umsatz: 1340, avg_lieferzeit_min: 25, alert_low: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', score: 85, stopps: 20, umsatz: 1180, avg_lieferzeit_min: 28, alert_low: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  score: 71, stopps: 18, umsatz: 960,  avg_lieferzeit_min: 31, alert_low: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   score: 48, stopps: 14, umsatz: 730,  avg_lieferzeit_min: 38, alert_low: true  },
  ],
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 65 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-6 text-right ${score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 65 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
        {score}
      </span>
    </div>
  );
}

export function LieferdienstPhase2695FahrerSchichtBilanzCockpit({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 2 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const sorted = [...d.fahrer].sort((a, b) => b.score - a.score);
  const alertFahrer = sorted.filter(f => f.alert_low);

  const kpis = [
    { label: 'Touren heute',  value: String(d.kpi_touren_heute),          unit: '' },
    { label: 'Stopps',        value: String(d.kpi_stopps),                 unit: '' },
    { label: 'Ø Lieferzeit',  value: String(d.kpi_avg_lieferzeit),         unit: ' min' },
    { label: 'Gesamtumsatz',  value: d.kpi_gesamtumsatz.toLocaleString('de-DE'), unit: ' €' },
    { label: 'Ø Bewertung',   value: d.kpi_avg_bewertung.toFixed(1),       unit: ' ★' },
    { label: 'Pünktlichkeit', value: String(d.kpi_puenktlichkeit_pct),     unit: '%' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={16} className="text-violet-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Fahrer Schicht-Bilanz Cockpit
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            {d.fahrer.length} Fahrer aktiv
          </span>
          {alertFahrer.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alertFahrer.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              Schwache Performance: {alertFahrer.map(f => f.fahrer_name).join(', ')}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {kpis.map(kpi => (
              <div key={kpi.label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mb-0.5">{kpi.label}</div>
                <div className="font-bold text-sm text-gray-800 dark:text-gray-100 tabular-nums">
                  {kpi.value}{kpi.unit}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {sorted.map((f, idx) => (
              <div key={f.fahrer_id} className={`rounded-lg border p-2.5 ${f.alert_low ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>{idx + 1}</span>
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex-1 truncate">{f.fahrer_name}</span>
                  {f.alert_low && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                </div>
                <ScoreBar score={f.score} />
                <div className="flex gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>{f.stopps} Stopps</span>
                  <span>{f.umsatz.toLocaleString('de-DE')} €</span>
                  <span>Ø {f.avg_lieferzeit_min} min</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-right">
            Aktualisiert alle 2 Min.
          </div>
        </div>
      )}
    </div>
  );
}
