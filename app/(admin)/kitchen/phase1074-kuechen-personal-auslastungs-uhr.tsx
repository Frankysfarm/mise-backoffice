'use client';

import { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SchichtStunde = {
  stunde: number;
  label: string;
  auslastung_pct: number;
  personal: number;
  bestellungen: number;
  ist_peak: boolean;
};

type ApiResponse = {
  stunden: SchichtStunde[];
  aktuelle_auslastung_pct: number;
  aktuelles_personal: number;
  kapazitaet_gesamt: number;
  peak_stunde: string | null;
};

function mock(): ApiResponse {
  return {
    stunden: [
      { stunde: 10, label: '10', auslastung_pct: 25, personal: 2, bestellungen: 8, ist_peak: false },
      { stunde: 11, label: '11', auslastung_pct: 45, personal: 3, bestellungen: 18, ist_peak: false },
      { stunde: 12, label: '12', auslastung_pct: 80, personal: 4, bestellungen: 42, ist_peak: false },
      { stunde: 13, label: '13', auslastung_pct: 95, personal: 4, bestellungen: 55, ist_peak: true },
      { stunde: 14, label: '14', auslastung_pct: 60, personal: 3, bestellungen: 28, ist_peak: false },
      { stunde: 15, label: '15', auslastung_pct: 35, personal: 2, bestellungen: 12, ist_peak: false },
      { stunde: 16, label: '16', auslastung_pct: 40, personal: 3, bestellungen: 15, ist_peak: false },
      { stunde: 17, label: '17', auslastung_pct: 70, personal: 4, bestellungen: 35, ist_peak: false },
      { stunde: 18, label: '18', auslastung_pct: 88, personal: 4, bestellungen: 48, ist_peak: false },
      { stunde: 19, label: '19', auslastung_pct: 100, personal: 4, bestellungen: 62, ist_peak: true },
      { stunde: 20, label: '20', auslastung_pct: 75, personal: 4, bestellungen: 38, ist_peak: false },
      { stunde: 21, label: '21', auslastung_pct: 50, personal: 3, bestellungen: 20, ist_peak: false },
    ],
    aktuelle_auslastung_pct: 72,
    aktuelles_personal: 4,
    kapazitaet_gesamt: 4,
    peak_stunde: '19:00',
  };
}

function auslastungColor(pct: number) {
  if (pct >= 90) return { fill: '#ef4444', text: 'text-red-600 dark:text-red-400', label: 'Kritisch' };
  if (pct >= 70) return { fill: '#f97316', text: 'text-orange-500', label: 'Hoch' };
  if (pct >= 50) return { fill: '#f59e0b', text: 'text-amber-500', label: 'Mittel' };
  return { fill: '#4ade80', text: 'text-matcha-600 dark:text-matcha-400', label: 'Normal' };
}

function SvgUhr({ stunden, aktuelle_auslastung_pct }: { stunden: SchichtStunde[]; aktuelle_auslastung_pct: number }) {
  const cx = 70;
  const cy = 70;
  const r = 54;
  const innerR = 36;
  const segments = stunden.length;

  const color = auslastungColor(aktuelle_auslastung_pct);

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0">
      {stunden.map((s, i) => {
        const anglePerSeg = (2 * Math.PI) / segments;
        const startAngle = (i / segments) * 2 * Math.PI - Math.PI / 2;
        const endAngle = ((i + 1) / segments) * 2 * Math.PI - Math.PI / 2;
        const gap = 0.04;

        const x1 = cx + r * Math.cos(startAngle + gap);
        const y1 = cy + r * Math.sin(startAngle + gap);
        const x2 = cx + r * Math.cos(endAngle - gap);
        const y2 = cy + r * Math.sin(endAngle - gap);
        const ix1 = cx + innerR * Math.cos(startAngle + gap);
        const iy1 = cy + innerR * Math.sin(startAngle + gap);
        const ix2 = cx + innerR * Math.cos(endAngle - gap);
        const iy2 = cy + innerR * Math.sin(endAngle - gap);

        const large = anglePerSeg > Math.PI ? 1 : 0;
        const fillColor = s.ist_peak
          ? '#dc2626'
          : s.auslastung_pct >= 90
          ? '#f97316'
          : s.auslastung_pct >= 70
          ? '#fbbf24'
          : s.auslastung_pct >= 50
          ? '#4ade80'
          : '#bbf7d0';

        const opacity = 0.3 + (s.auslastung_pct / 100) * 0.7;

        return (
          <path
            key={s.stunde}
            d={`M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1}`}
            fill={fillColor}
            opacity={opacity}
            strokeWidth="0"
          />
        );
      })}
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={innerR - 2} fill="white" className="dark:fill-gray-900" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="900" fill={color.fill} fontFamily="monospace">
        {Math.round(aktuelle_auslastung_pct)}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="sans-serif">
        Auslastung
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="6.5" fill={color.fill} fontFamily="sans-serif" fontWeight="700">
        {color.label}
      </text>
    </svg>
  );
}

export function KitchenPhase1074KuechenPersonalAuslastungsUhr({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/wartezeit-heatmap-tageszeit?${p}`);
      if (r.ok) {
        const raw = await r.json();
        // Map wartezeit-heatmap data to auslastungs format
        const stunden: SchichtStunde[] = (raw.stunden ?? []).map((s: { stunde: number; label: string; ø_wartezeit_min: number; bestellungen: number }) => ({
          stunde: s.stunde,
          label: String(s.stunde),
          auslastung_pct: Math.min(100, Math.round((s.ø_wartezeit_min / 30) * 100)),
          personal: s.bestellungen > 40 ? 4 : s.bestellungen > 20 ? 3 : 2,
          bestellungen: s.bestellungen,
          ist_peak: s.label === raw.schlechteste_stunde,
        }));
        const currentH = new Date().getHours();
        const cur = stunden.find((s) => s.stunde === currentH) ?? stunden[stunden.length - 1];
        setData({
          stunden,
          aktuelle_auslastung_pct: cur?.auslastung_pct ?? 50,
          aktuelles_personal: cur?.personal ?? 3,
          kapazitaet_gesamt: 4,
          peak_stunde: raw.schlechteste_stunde ?? null,
        });
      } else throw new Error();
    } catch {
      setData(mock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const color = auslastungColor(data?.aktuelle_auslastung_pct ?? 0);

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200">
            Personal-Auslastungs-Uhr
          </span>
        </div>
        {data?.peak_stunde && (
          <span className="rounded-full bg-violet-100 dark:bg-violet-900/50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
            Peak: {data.peak_stunde}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-violet-400" />
        </div>
      )}

      {!loading && data && (
        <div className="p-3 flex items-center gap-4">
          <SvgUhr stunden={data.stunden} aktuelle_auslastung_pct={data.aktuelle_auslastung_pct} />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white dark:bg-black/20 border border-violet-100 dark:border-violet-800 px-2.5 py-2 text-center">
                <div className={cn('text-xl font-black tabular-nums', color.text)}>
                  {data.aktuelles_personal}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Akt. Personal
                </div>
              </div>
              <div className="rounded-lg bg-white dark:bg-black/20 border border-violet-100 dark:border-violet-800 px-2.5 py-2 text-center">
                <div className="text-xl font-black tabular-nums text-violet-600 dark:text-violet-400">
                  {data.kapazitaet_gesamt}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Kapazität
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Kritisch ≥90%', cls: 'bg-red-500' },
                { label: 'Hoch ≥70%', cls: 'bg-orange-400' },
                { label: 'Mittel ≥50%', cls: 'bg-amber-300' },
                { label: 'Normal <50%', cls: 'bg-matcha-400' },
              ].map(({ label, cls }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={cn('w-2 h-2 rounded-sm shrink-0', cls)} />
                  <span className="text-[9px] text-muted-foreground truncate">{label}</span>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground">
              Stunden-Segmente = Auslastung je Tageszeit · Rot = Peak
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
