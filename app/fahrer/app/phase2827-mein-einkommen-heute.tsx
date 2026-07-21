'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  einkommen_heute: number;
  basis: number;
  bonus: number;
  trinkgeld: number;
  touren_heute: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  tagesziel: number;
}

const TAGESZIEL = 80;

function calcAmpel(e: number): string {
  const pct = e / TAGESZIEL;
  if (pct >= 1.0) return 'gruen';
  if (pct >= 0.5) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(e: number, ziel: number): string {
  const pct = e / ziel;
  if (pct >= 1.0) return `${e.toFixed(2)} € — Super! Tagesziel erreicht. Jede weitere Tour ist Bonus!`;
  if (pct >= 0.5) return `${e.toFixed(2)} € — Auf Kurs. Noch ${(ziel - e).toFixed(2)} € bis zum Tagesziel von ${ziel} €.`;
  return `${e.toFixed(2)} € — Einkommensziel gefährdet! Tagesziel: ${ziel} €. Mehr Touren übernehmen!`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',    einkommen_heute: 95.40, basis: 60, bonus: 25, trinkgeld: 10, touren_heute: 8, ampel: 'gruen', trend: 'steigend', trend_delta:  12.5, rang: 1 },
    { fahrer_id: 'f2',    fahrer_name: 'Sara K.', einkommen_heute: 72.80, basis: 52, bonus: 15, trinkgeld:  6, touren_heute: 6, ampel: 'gelb',  trend: 'stabil',   trend_delta:   0.0, rang: 3 },
    { fahrer_id: 'f3',    fahrer_name: 'Tim B.',  einkommen_heute: 38.20, basis: 30, bonus:  5, trinkgeld:  3, touren_heute: 3, ampel: 'rot',   trend: 'fallend',  trend_delta: -15.6, rang: 4 },
  ],
  team_durchschnitt: 79.10,
  tagesziel: TAGESZIEL,
};

export function FahrerPhase2827MeinEinkommenHeute({
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
    if (!isOnline || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-einkommens-transparenz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId]);

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const ziel    = data.tagesziel ?? TAGESZIEL;
  const ampel   = me.ampel || calcAmpel(me.einkommen_heute);
  const cls     = ampelCls(ampel);
  const e       = me.einkommen_heute;
  const barPct  = Math.min((e / 150) * 100, 100);
  const zielPct = Math.min((ziel / 150) * 100, 100);
  const tip     = coaching(e, ziel);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';
  const rang = [...data.fahrer].sort((a, b) => b.einkommen_heute - a.einkommen_heute).findIndex(f => f.fahrer_id === me.fahrer_id) + 1;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className="text-green-600" />
          <span className="font-semibold text-sm text-gray-800">Mein Einkommen Heute</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{e.toFixed(2)} €</div>
            <div className="text-xs text-gray-500 mt-1">{me.touren_heute} Touren heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {me.trend_delta > 0 ? '+' : ''}{me.trend_delta.toFixed(2)} € vs. gestern
              </span>
            </div>
          </div>

          {/* Balken 0–150€ mit Ziel-Linie 80€ */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span>
              <span className="text-blue-500">Ziel {ziel} €</span>
              <span>150 €</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',   val: me.trend === 'steigend' ? '↑ Steigend' : me.trend === 'fallend' ? '↓ Fallend' : '→ Stabil' },
              { label: 'Ziel',    val: `${ziel} €` },
              { label: 'Ampel',   val: ampel === 'gruen' ? '🟢 Ziel erreicht' : ampel === 'gelb' ? '🟡 Auf Kurs' : '🔴 Gefährdet' },
              { label: 'Touren',  val: `${me.touren_heute}` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-xs font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Aufschlüsselung */}
          <div className="bg-white rounded-lg border border-gray-100 p-2">
            <div className="text-[10px] text-gray-500 mb-1 font-medium">Aufschlüsselung</div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'Basis',    val: `${me.basis.toFixed(2)} €` },
                { label: 'Bonus',    val: `+${me.bonus.toFixed(2)} €` },
                { label: 'Trinkgeld', val: `+${me.trinkgeld.toFixed(2)} €` },
              ].map(k => (
                <div key={k.label} className="text-center">
                  <div className="text-[10px] text-gray-400">{k.label}</div>
                  <div className="text-xs font-semibold text-gray-700">{k.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Team-Ø + Rang */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Team-Ø</div>
              <div className="text-xs font-bold text-gray-800">{data.team_durchschnitt.toFixed(2)} €</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Rang</div>
              <div className="text-xs font-bold text-gray-800">#{rang} / {data.fahrer.length}</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg p-2 text-xs ${cls.bg} ${cls.text}`}>{tip}</div>
        </div>
      )}
    </div>
  );
}
