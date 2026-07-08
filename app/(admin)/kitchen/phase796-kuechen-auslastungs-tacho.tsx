'use client';

import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ApiData {
  auslastung_pct: number;
  wartende_bestellungen: number;
  koeche_aktiv: number;
  label: string;
}

const MOCK: ApiData = {
  auslastung_pct: 72,
  wartende_bestellungen: 8,
  koeche_aktiv: 3,
  label: 'Mittel',
};

export function KitchenPhase796KuechenAuslastungsTacho({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      if (json.ok) {
        const pct = Math.min(100, Math.max(0, Math.round((json.aktive_bestellungen ?? 0) / Math.max(1, json.kapazitaet ?? 10) * 100)));
        setData({
          auslastung_pct: pct,
          wartende_bestellungen: json.aktive_bestellungen ?? 0,
          koeche_aktiv: json.koeche_aktiv ?? 0,
          label: pct >= 85 ? 'Überlastet' : pct >= 60 ? 'Hoch' : pct >= 35 ? 'Mittel' : 'Niedrig',
        });
      }
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const pct = data.auslastung_pct;

  // SVG Tachometer parameters
  const radius = 44;
  const cx = 60;
  const cy = 58;
  const startAngle = -210; // degrees
  const endAngle = 30;
  const totalArc = endAngle - startAngle; // 240deg

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(from: number, to: number, r: number) {
    const s = polarToXY(from, r);
    const e = polarToXY(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const fillAngle = startAngle + (totalArc * pct) / 100;

  const trackColor = '#e5e7eb';
  const fillColor = pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981';
  const textColor = pct >= 85 ? 'text-red-600 dark:text-red-400'
    : pct >= 60 ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  // Needle
  const needleAngle = startAngle + (totalArc * pct) / 100;
  const needle = polarToXY(needleAngle, 34);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-16 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold">Küchen-Auslastungs-Tachometer</span>
      </div>

      <div className="flex items-center gap-4">
        {/* SVG Gauge */}
        <svg viewBox="0 0 120 80" className="w-24 h-16 shrink-0">
          {/* Track */}
          <path
            d={arcPath(startAngle, endAngle, radius)}
            fill="none"
            stroke={trackColor}
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Fill */}
          {pct > 0 && (
            <path
              d={arcPath(startAngle, fillAngle, radius)}
              fill="none"
              stroke={fillColor}
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}
          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needle.x}
            y2={needle.y}
            stroke={fillColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="3" fill={fillColor} />
          {/* Labels */}
          <text x="16" y="72" fontSize="7" fill="#9ca3af">0</text>
          <text x="98" y="72" fontSize="7" fill="#9ca3af">100</text>
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tabular-nums ${textColor}`}>{pct}%</span>
            <span className={`text-xs font-semibold ${textColor}`}>{data.label}</span>
          </div>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">
              {data.wartende_bestellungen} Bestell. in Warteschlange
            </p>
            {data.koeche_aktiv > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {data.koeche_aktiv} Köche aktiv
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
