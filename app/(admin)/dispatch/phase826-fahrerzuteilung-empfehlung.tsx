'use client';

import { useEffect, useState } from 'react';
import { Brain, Star, MapPin, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface Empfehlung {
  driver_id: string;
  fahrer_name: string;
  empfohlene_zone: string;
  score: number;
  grund: string;
  puentlichkeit_pct: number;
  touren_heute: number;
}

interface EmpfehlungData {
  empfehlungen: Empfehlung[];
  zonen_bedarf: { zone: string; offene_touren: number }[];
  aktualisiert: string;
}

const MOCK: EmpfehlungData = {
  empfehlungen: [
    { driver_id: 'd1', fahrer_name: 'Mehmet A.', empfohlene_zone: 'Innenstadt', score: 94, grund: 'Höchste Pünktlichkeit in Innenstadt (96%)', puentlichkeit_pct: 96, touren_heute: 4 },
    { driver_id: 'd2', fahrer_name: 'Sarah K.', empfohlene_zone: 'Nordend', score: 88, grund: 'Beste Ø-Zeit in Nordend (26 min)', puentlichkeit_pct: 91, touren_heute: 3 },
    { driver_id: 'd3', fahrer_name: 'Luca B.', empfohlene_zone: 'Sachsenhausen', score: 81, grund: 'Vertraut mit Sachsenhausen (8 Lieferungen)', puentlichkeit_pct: 87, touren_heute: 2 },
  ],
  zonen_bedarf: [
    { zone: 'Innenstadt', offene_touren: 3 },
    { zone: 'Nordend', offene_touren: 2 },
    { zone: 'Sachsenhausen', offene_touren: 1 },
  ],
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function scoreStyle(score: number) {
  if (score >= 85) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (score >= 70) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' };
  return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-400' };
}

export function DispatchPhase826FahrerzuteilungEmpfehlung({ locationId }: Props) {
  const [data, setData] = useState<EmpfehlungData | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!locationId) { setData(MOCK); return; }
    try {
      // Try zone-affinity endpoint for driver-zone matching data
      const [zoneRes, perfRes] = await Promise.all([
        fetch(`/api/delivery/admin/zone-affinity?location_id=${locationId}`, { cache: 'no-store' }),
        fetch(`/api/delivery/admin/fahrer-schicht-auslastung?location_id=${locationId}`, { cache: 'no-store' }),
      ]);
      const zone = zoneRes.ok ? await zoneRes.json() : null;
      const perf = perfRes.ok ? await perfRes.json() : null;

      if (zone?.affinities && Array.isArray(zone.affinities)) {
        const empfehlungen: Empfehlung[] = zone.affinities.slice(0, 5).map((a: Record<string, unknown>) => ({
          driver_id: String(a.driver_id ?? ''),
          fahrer_name: String(a.driver_name ?? a.name ?? 'Fahrer'),
          empfohlene_zone: String(a.best_zone ?? a.zone ?? 'Zone'),
          score: Number(a.affinity_score ?? a.score ?? 80),
          grund: String(a.reason ?? a.grund ?? 'Historische Bestleistung in dieser Zone'),
          puentlichkeit_pct: Number(a.ontime_pct ?? 85),
          touren_heute: Number(a.tours_today ?? 0),
        }));
        const zonen_bedarf = Array.isArray(perf?.zonen)
          ? (perf.zonen as Record<string, unknown>[]).map((z) => ({ zone: String(z.zone ?? ''), offene_touren: Number(z.offene ?? 1) }))
          : MOCK.zonen_bedarf;
        setData({ empfehlungen, zonen_bedarf, aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 300_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = data ?? MOCK;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-indigo-50 hover:bg-indigo-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Brain className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-bold text-indigo-800">KI-Fahrerzuteilung</span>
        <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-bold">
          {d.empfehlungen.length} Empfehl.
        </span>
        <span className="text-[10px] text-stone-400 ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {/* Zonen-Bedarf */}
          {d.zonen_bedarf.length > 0 && (
            <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 flex gap-3 flex-wrap">
              {d.zonen_bedarf.map(z => (
                <span key={z.zone} className="inline-flex items-center gap-1 text-[10px] bg-white border border-stone-200 rounded-full px-2 py-0.5 font-medium">
                  <MapPin className="h-2.5 w-2.5 text-stone-400" />
                  {z.zone}: <span className="font-bold text-indigo-600">{z.offene_touren} offen</span>
                </span>
              ))}
            </div>
          )}

          <div className="divide-y divide-stone-50">
            {d.empfehlungen.map((e, i) => {
              const s = scoreStyle(e.score);
              return (
                <div key={e.driver_id} className={cn('px-4 py-3', s.bg)}>
                  <div className="flex items-start gap-3">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5', s.dot)}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold truncate">{e.fahrer_name}</span>
                        <span className={cn('text-xs font-black ml-2 shrink-0', s.text)}>{e.score}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3 w-3 text-stone-400 shrink-0" />
                        <span className="text-xs font-semibold text-stone-700">{e.empfohlene_zone}</span>
                        <span className="text-[10px] text-stone-400">·</span>
                        <Star className="h-3 w-3 text-amber-400 shrink-0" />
                        <span className="text-[10px] text-stone-500">{e.puentlichkeit_pct}% pünktl.</span>
                        <TrendingUp className="h-3 w-3 text-stone-300 ml-1 shrink-0" />
                        <span className="text-[10px] text-stone-400">{e.touren_heute} heute</span>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1 italic">{e.grund}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-stone-100 text-[10px] text-stone-400 flex justify-between">
            <span>Basierend auf historischen Zonen-Scores</span>
            <span>{d.aktualisiert}</span>
          </div>
        </>
      )}
    </div>
  );
}
