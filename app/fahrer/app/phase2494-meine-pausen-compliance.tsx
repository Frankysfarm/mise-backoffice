'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Coffee } from 'lucide-react';

interface FahrerCompliance {
  fahrer_id: string;
  fahrer_name: string;
  compliance_heute: number;
  compliance_vw: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerCompliance[];
  team_avg_compliance: number;
  team_avg_compliance_vw: number;
  alert_count: number;
}

function ampelStyle(pct: number) {
  if (pct >= 100) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (pct >= 80)  return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
}

function ComplianceBar({ pct }: { pct: number }) {
  const max = 120;
  const w = Math.min(100, (pct / max) * 100);
  const color = pct >= 100 ? 'bg-green-500' : pct >= 80 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-500" style={{ left: `${(80 / max) * 100}%` }} title="Alert: 80%" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: `${(100 / max) * 100}%` }} title="Ziel: 100%" />
    </div>
  );
}

function coachingTipp(pct: number): string {
  if (pct >= 100) return `${pct}% Pausen-Compliance — perfekt! Alle Pflichtpausen eingehalten. Weiter so!`;
  if (pct >= 80)  return `${pct}% Compliance — fast da! Eine weitere Pause reicht für 100%. Gönn dir die Auszeit.`;
  return `${pct}% Compliance — Pausenregelung nicht eingehalten! Bitte sofort eine Pause machen und den Dispatcher informieren.`;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', compliance_heute: 100, compliance_vw: 100, trend: 'stabil', trend_delta: 0, ampel: 'gruen', alert: false }],
  team_avg_compliance: 90.0,
  team_avg_compliance_vw: 92.5,
  alert_count: 0,
};

export function FahrerPhase2494MeinePausenCompliance({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-pausen-compliance?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.compliance_heute);
  const tipp = coachingTipp(me.compliance_heute);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Coffee size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine Pausen-Compliance</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.compliance_heute}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.compliance_heute}%
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">Pausen-Compliance heute</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'steigend' ? <TrendingUp size={11} className="text-green-600" /> :
                 me.trend === 'fallend'  ? <TrendingDown size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trend_delta !== 0 ? `${me.trend_delta > 0 ? '+' : ''}${me.trend_delta}% vs. VW` : 'Stabil vs. VW'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <ComplianceBar pct={me.compliance_heute} />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0%</span>
              <span className="text-amber-500 font-bold">Alert 80%</span>
              <span className="text-green-600 font-bold">Ziel 100%</span>
              <span>120%</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Heute',  val: `${me.compliance_heute}%`,                  col: style.val },
              { label: 'VW',     val: `${me.compliance_vw}%`,                     col: 'text-gray-700' },
              { label: 'Ziel',   val: '100%',                                      col: 'text-green-700' },
              { label: 'Team-Ø', val: `${data.team_avg_compliance.toFixed(0)}%`,  col: 'text-blue-700' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-white/60 px-2 py-2 text-center">
                <div className={`text-sm font-black ${k.col}`}>{k.val}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${style.bg} ${style.text}`}>
            💡 {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
