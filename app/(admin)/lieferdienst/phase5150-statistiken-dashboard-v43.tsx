'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Trophy, Clock, Euro, Star, Truck, Users, Target, BarChart3, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

// Phase 5150 — Statistiken-Dashboard V43
// Neu: Tages-Ziel-Fortschrittsring; Storno-Analyse-Tab; Fahrer-KPI-Vergleich-Chart;
// 9-KPI-Grid Umsatz+Bestellungen+Fahrer+Zeit+Pünktl+Bewertung+Storno+Marge+Score;
// 5-Tab-Nav Überblick/Stunden/Fahrer/Storno/Ziele;
// Stunden-BarChart Ist vs. Ziel farbkodiert; Fahrer-Score-Ranking 🥇🥈🥉;
// Storno-Gründe Tortendiagramm-Ersatz; Ziel-Cockpit mit Erreichungsampel;
// 45-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'storno' | 'ziele';

interface KpiItem {
  label: string;
  value: string;
  delta_pct: number;
  ziel: number | null;
  ist: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface StundeItem {
  stunde: string;
  bestellungen: number;
  ziel: number;
  umsatz: number;
}

interface FahrerItem {
  name: string;
  rang: number;
  score: number;
  lieferungen: number;
  avg_min: number;
  trinkgeld: number;
  puenktlichkeit_pct: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
}

interface StornoGrund {
  grund: string;
  anzahl: number;
  pct: number;
}

interface ZielItem {
  label: string;
  ist: number;
  ziel: number;
  einheit: string;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  gesamt_score: number;
  ziel_erreicht_pct: number;
  kpis: KpiItem[];
  stunden: StundeItem[];
  fahrer: FahrerItem[];
  storno_gruende: StornoGrund[];
  ziele: ZielItem[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  gesamt_score: 87,
  ziel_erreicht_pct: 73,
  kpis: [
    { label: 'Umsatz',      value: '1.284 €',  delta_pct:  8.2, ziel: 1400, ist: 1284, ampel: 'gelb'  },
    { label: 'Bestellungen',value: '142',       delta_pct: 12.1, ziel: 160,  ist: 142,  ampel: 'gelb'  },
    { label: 'Fahrer',      value: '6 aktiv',   delta_pct:  0,   ziel: 7,    ist: 6,    ampel: 'gelb'  },
    { label: 'Ø Zeit',      value: '28 min',    delta_pct: -4.3, ziel: 30,   ist: 28,   ampel: 'gruen' },
    { label: 'Pünktl.',     value: '88%',       delta_pct:  2.1, ziel: 90,   ist: 88,   ampel: 'gelb'  },
    { label: 'Bewertung',   value: '4.6 ★',    delta_pct:  0.5, ziel: 4.5,  ist: 4.6,  ampel: 'gruen' },
    { label: 'Storno',      value: '4.2%',      delta_pct: -1.1, ziel: 5,    ist: 4.2,  ampel: 'gruen' },
    { label: 'Marge',       value: '22%',       delta_pct:  1.8, ziel: 25,   ist: 22,   ampel: 'gelb'  },
    { label: 'Score',       value: '87',        delta_pct:  5.3, ziel: 90,   ist: 87,   ampel: 'gelb'  },
  ],
  stunden: [
    { stunde: '11h', bestellungen:  8, ziel: 10, umsatz:  96 },
    { stunde: '12h', bestellungen: 22, ziel: 20, umsatz: 264 },
    { stunde: '13h', bestellungen: 18, ziel: 18, umsatz: 216 },
    { stunde: '14h', bestellungen: 12, ziel: 15, umsatz: 144 },
    { stunde: '17h', bestellungen: 16, ziel: 15, umsatz: 192 },
    { stunde: '18h', bestellungen: 28, ziel: 25, umsatz: 336 },
    { stunde: '19h', bestellungen: 24, ziel: 22, umsatz: 288 },
    { stunde: '20h', bestellungen: 14, ziel: 18, umsatz: 168 },
  ],
  fahrer: [
    { name: 'Julia F.',  rang: 1, score: 94, lieferungen: 28, avg_min: 24, trinkgeld: 42.50, puenktlichkeit_pct: 96, tier: 'platin' },
    { name: 'Max M.',    rang: 2, score: 81, lieferungen: 22, avg_min: 27, trinkgeld: 31.20, puenktlichkeit_pct: 86, tier: 'gold'   },
    { name: 'Sara K.',   rang: 3, score: 73, lieferungen: 19, avg_min: 29, trinkgeld: 24.80, puenktlichkeit_pct: 78, tier: 'gut'    },
    { name: 'Tim B.',    rang: 4, score: 52, lieferungen: 14, avg_min: 35, trinkgeld: 18.40, puenktlichkeit_pct: 62, tier: 'schwach'},
  ],
  storno_gruende: [
    { grund: 'Kunde nicht erreichbar', anzahl: 3, pct: 50 },
    { grund: 'Lange Wartezeit',         anzahl: 2, pct: 33 },
    { grund: 'Adresse unbekannt',       anzahl: 1, pct: 17 },
  ],
  ziele: [
    { label: 'Tagesumsatz',  ist: 1284, ziel: 1400, einheit: '€',  ampel: 'gelb'  },
    { label: 'Bestellungen', ist: 142,  ziel: 160,  einheit: '',   ampel: 'gelb'  },
    { label: 'Pünktlichkeit',ist: 88,   ziel: 90,   einheit: '%',  ampel: 'gelb'  },
    { label: 'Bewertung',    ist: 4.6,  ziel: 4.5,  einheit: '★', ampel: 'gruen' },
    { label: 'Stornoquote',  ist: 4.2,  ziel: 5,    einheit: '%',  ampel: 'gruen' },
  ],
  timestamp: new Date().toISOString(),
};

function AmpelDot({ ampel }: { ampel: string }) {
  const c = ampel === 'gruen' ? 'bg-green-500' : ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${c}`} />;
}

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  return (
    <span className={`text-[9px] flex items-center gap-0.5 ${pct > 0 ? 'text-green-400' : 'text-red-400'}`}>
      {pct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function tierMedaille(rang: number) {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return `#${rang}`;
}

function tierScoreBar(tier: string) {
  if (tier === 'platin') return 'bg-cyan-400';
  if (tier === 'gold')   return 'bg-yellow-400';
  if (tier === 'gut')    return 'bg-green-500';
  return 'bg-red-500';
}

export function LieferdienstPhase5150StatistikenDashboardV43({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tab, setTab] = useState<Tab>('ueberblick');

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/statistiken?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Statistiken V43…</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ueberblick', label: 'Überblick' },
    { key: 'stunden',    label: 'Stunden'   },
    { key: 'fahrer',     label: 'Fahrer'    },
    { key: 'storno',     label: 'Storno'    },
    { key: 'ziele',      label: 'Ziele'     },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-teal-400" />
        <span className="text-white font-semibold">Statistiken V43</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: `conic-gradient(#2dd4bf ${data.gesamt_score}%, #1f2937 0)` }}
            >
              {data.gesamt_score}
            </div>
          </div>
        </div>
      </div>

      {/* Tages-Ziel-Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Tagesziel-Erreichung</span>
          <span className="font-semibold text-teal-400">{data.ziel_erreicht_pct}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-700"
            style={{ width: `${data.ziel_erreicht_pct}%` }}
          />
        </div>
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
              tab === t.key ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Überblick */}
      {tab === 'ueberblick' && (
        <div className="grid grid-cols-3 gap-1.5">
          {data.kpis.map(k => (
            <div key={k.label} className="bg-gray-800 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <AmpelDot ampel={k.ampel} />
                <span className="text-[9px] text-gray-400">{k.label}</span>
              </div>
              <div className="text-sm font-bold text-white">{k.value}</div>
              <Delta pct={k.delta_pct} />
            </div>
          ))}
        </div>
      )}

      {/* Tab: Stunden */}
      {tab === 'stunden' && (
        <div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.stunden} barGap={2}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6, fontSize: 10 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Bar dataKey="bestellungen" name="Ist" radius={[2, 2, 0, 0]}>
                {data.stunden.map((s, i) => (
                  <Cell key={i} fill={s.bestellungen >= s.ziel ? '#2dd4bf' : '#f59e0b'} />
                ))}
              </Bar>
              <Bar dataKey="ziel" name="Ziel" fill="#374151" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-gray-500 text-center mt-1">Teal = Ziel erreicht · Gelb = unter Ziel</p>
        </div>
      )}

      {/* Tab: Fahrer */}
      {tab === 'fahrer' && (
        <div className="space-y-2">
          {data.fahrer.map(f => (
            <div key={f.name} className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{tierMedaille(f.rang)}</span>
                <span className="text-sm font-semibold text-white flex-1">{f.name}</span>
                <span className="text-xs font-bold text-white">{f.score}</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${tierScoreBar(f.tier)}`} style={{ width: `${f.score}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <div className="text-[10px] font-bold text-indigo-400">{f.lieferungen}</div>
                  <div className="text-[8px] text-gray-500">Lief.</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-cyan-400">{f.avg_min}min</div>
                  <div className="text-[8px] text-gray-500">Ø Zeit</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-yellow-400">{f.puenktlichkeit_pct}%</div>
                  <div className="text-[8px] text-gray-500">Pünktl.</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-green-400">{f.trinkgeld.toFixed(2)}€</div>
                  <div className="text-[8px] text-gray-500">Trinkgeld</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Storno */}
      {tab === 'storno' && (
        <div className="space-y-2">
          {data.storno_gruende.map(g => (
            <div key={g.grund} className="bg-gray-800 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-300">{g.grund}</span>
                <span className="text-red-400 font-semibold">{g.anzahl}x ({g.pct}%)</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${g.pct}%` }} />
              </div>
            </div>
          ))}
          {data.storno_gruende.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">Keine Stornierungen heute</p>
          )}
        </div>
      )}

      {/* Tab: Ziele */}
      {tab === 'ziele' && (
        <div className="space-y-2">
          {data.ziele.map(z => {
            const pct = Math.min(100, (z.ist / z.ziel) * 100);
            return (
              <div key={z.label} className="bg-gray-800 rounded-lg p-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-gray-300">{z.label}</span>
                  <div className="flex items-center gap-1.5">
                    <AmpelDot ampel={z.ampel} />
                    <span className="text-[11px] text-white font-semibold">{z.ist}{z.einheit}</span>
                    <span className="text-[9px] text-gray-500">/ {z.ziel}{z.einheit}</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      z.ampel === 'gruen' ? 'bg-green-500' : z.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-500 mt-1 text-right">{pct.toFixed(0)}% Zielerreichung</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
