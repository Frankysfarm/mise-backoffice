'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { MapPin, TrendingUp, AlertTriangle, Users, Clock, Zap } from 'lucide-react';

interface ZoneAuslastung {
  zone_id: string;
  zone_name: string;
  fahrer_aktiv: number;
  fahrer_gesamt: number;
  avg_lieferzeit_min: number;
  offene_bestellungen: number;
  score: number;
  empfehlung?: 'ok' | 'mehr_fahrer' | 'umleiten' | null;
  umsatz_heute?: number | null;
}

interface Props {
  locationId: string | null;
}

const EMPFEHLUNG_STYLES: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  ok: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Optimal', icon: TrendingUp },
  mehr_fahrer: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Mehr Fahrer', icon: Users },
  umleiten: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Umleiten', icon: MapPin },
};

const MOCK_ZONES: ZoneAuslastung[] = [
  { zone_id: 'z1', zone_name: 'Innenstadt', fahrer_aktiv: 3, fahrer_gesamt: 4, avg_lieferzeit_min: 22, offene_bestellungen: 7, score: 82, empfehlung: 'ok', umsatz_heute: 1240 },
  { zone_id: 'z2', zone_name: 'Nordviertel', fahrer_aktiv: 1, fahrer_gesamt: 2, avg_lieferzeit_min: 31, offene_bestellungen: 4, score: 58, empfehlung: 'mehr_fahrer', umsatz_heute: 520 },
  { zone_id: 'z3', zone_name: 'Süd', fahrer_aktiv: 2, fahrer_gesamt: 2, avg_lieferzeit_min: 19, offene_bestellungen: 2, score: 91, empfehlung: 'umleiten', umsatz_heute: 380 },
  { zone_id: 'z4', zone_name: 'Westend', fahrer_aktiv: 0, fahrer_gesamt: 1, avg_lieferzeit_min: 45, offene_bestellungen: 3, score: 28, empfehlung: 'mehr_fahrer', umsatz_heute: 0 },
];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export function DispatchPhase5076FahrerZonenAuslastungsBoard({ locationId }: Props) {
  const [zones, setZones] = useState<ZoneAuslastung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/dispatch/zones?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setZones(data.zones ?? data ?? MOCK_ZONES);
        } else {
          setZones(MOCK_ZONES);
        }
      } catch {
        setZones(MOCK_ZONES);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const avgScore = zones.length > 0 ? Math.round(zones.reduce((s, z) => s + z.score, 0) / zones.length) : 0;
  const kritisch = zones.filter(z => z.score < 50).length;
  const gesamtOffen = zones.reduce((s, z) => s + z.offene_bestellungen, 0);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <MapPin className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Zonen-Auslastung</p>
            <p className="text-xs text-slate-400">Fahrer · Lieferzonen</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-xl font-bold', avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400')}>
            {avgScore}
          </p>
          <p className="text-xs text-slate-500">Ø Score</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-white">{zones.length}</p>
          <p className="text-xs text-slate-500">Zonen</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className={cn('text-lg font-bold', kritisch > 0 ? 'text-red-400' : 'text-emerald-400')}>{kritisch}</p>
          <p className="text-xs text-slate-500">Kritisch</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-amber-400">{gesamtOffen}</p>
          <p className="text-xs text-slate-500">Offen</p>
        </div>
      </div>

      {/* Zone Cards */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-slate-500 text-sm">Lade Zonen…</div>
        ) : zones.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">Keine Zonendaten</div>
        ) : (
          zones
            .slice()
            .sort((a, b) => a.score - b.score)
            .map(zone => {
              const emp = zone.empfehlung ? EMPFEHLUNG_STYLES[zone.empfehlung] : EMPFEHLUNG_STYLES.ok;
              const EmpIcon = emp.icon;
              return (
                <div key={zone.zone_id} className="rounded-lg bg-slate-800/40 border border-white/5 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{zone.zone_name}</span>
                      <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded', emp.bg, emp.text)}>
                        <EmpIcon className="h-3 w-3" />{emp.label}
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold', zone.score >= 80 ? 'text-emerald-400' : zone.score >= 60 ? 'text-amber-400' : 'text-red-400')}>
                      {zone.score}
                    </span>
                  </div>

                  <ScoreBar score={zone.score} />

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {zone.fahrer_aktiv}/{zone.fahrer_gesamt} Fahrer
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {zone.avg_lieferzeit_min}min Ø
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      {zone.offene_bestellungen} offen
                    </span>
                  </div>

                  {zone.umsatz_heute != null && (
                    <p className="text-xs text-slate-500">Heute: <span className="text-white font-medium">{euro(zone.umsatz_heute)}</span></p>
                  )}
                </div>
              );
            })
        )}
      </div>

      {kritisch > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{kritisch} Zone{kritisch > 1 ? 'n' : ''} mit kritischer Auslastung — Fahrer umleiten</span>
        </div>
      )}
    </div>
  );
}
