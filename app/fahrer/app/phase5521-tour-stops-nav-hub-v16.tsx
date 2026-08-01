'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigation2, MapPin, Phone, MessageSquare, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle, WifiOff, Package, CloudRain, Banknote, Coffee, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5521 — Tour-Stops Nav Hub V16
// V15+: Wetter-Einfluss auf ETA (Regen-/Fahrzeit-Faktor);
// Stopp-Optimierungs-Vorschlag (neue Reihenfolge KI);
// Einnahmen-Tracker live (Gesamt/Bar/Karte/Digital);
// Pause-Empfehlung nach Schichtdauer mit Countdown;
// 8-KPI-Grid Stops/Fertig/Offen/km/ETA/Einnahmen/Bewertung/Pause;
// Offline-Guard; 30s-Poll; Mock-Fallback

type ZahlungsArt = 'bar' | 'karte' | 'digital';
type StopStatus = 'done' | 'active' | 'upcoming';
type NavApp = 'google' | 'waze' | 'apple';
type Wetter = 'klar' | 'bewolkt' | 'regen' | 'sturm';

interface TourStop {
  id: string; seq: number; adresse: string; kunde: string; tel: string;
  eta: string; eta_sec_remaining: number; prognose_min: number;
  traffic_factor: number; wetter_faktor: number;
  zahlungsart: ZahlungsArt; betrag: number; status: StopStatus;
  benachrichtigt: boolean; bewertung: number | null; notiz: string | null;
  opt_seq: number;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', seq: 1, adresse: 'Maximilianstr. 12', kunde: 'Petra L.', tel: '+49151234567', eta: '14:32', eta_sec_remaining: -120, prognose_min: 0, traffic_factor: 1.0, wetter_faktor: 1.0, zahlungsart: 'karte', betrag: 24.90, status: 'done', benachrichtigt: true, bewertung: 5, notiz: null, opt_seq: 1 },
  { id: 's2', seq: 2, adresse: 'Leopoldstr. 88', kunde: 'Marc T.', tel: '+49159876543', eta: '14:47', eta_sec_remaining: 480, prognose_min: 9, traffic_factor: 1.2, wetter_faktor: 1.3, zahlungsart: 'bar', betrag: 17.40, status: 'active', benachrichtigt: true, notiz: 'Hintereingang', bewertung: null, opt_seq: 3 },
  { id: 's3', seq: 3, adresse: 'Schwabing Mitte 3', kunde: 'Julia W.', tel: '+49156543210', eta: '15:05', eta_sec_remaining: 1380, prognose_min: 25, traffic_factor: 1.4, wetter_faktor: 1.3, zahlungsart: 'digital', betrag: 31.20, status: 'upcoming', benachrichtigt: false, notiz: null, bewertung: null, opt_seq: 2 },
  { id: 's4', seq: 4, adresse: 'Englischer Garten 5', kunde: 'Kai R.', tel: '+49151112233', eta: '15:20', eta_sec_remaining: 2280, prognose_min: 40, traffic_factor: 1.1, wetter_faktor: 1.0, zahlungsart: 'karte', betrag: 19.80, status: 'upcoming', benachrichtigt: false, notiz: null, bewertung: null, opt_seq: 4 },
];

const WETTER: Wetter = 'regen';
const WETTER_CONFIG: Record<Wetter, { label: string; icon: string; factor: number; cls: string }> = {
  klar:    { label: 'Klar',    icon: '☀️', factor: 1.0, cls: 'text-yellow-400' },
  bewolkt: { label: 'Bewölkt', icon: '☁️', factor: 1.1, cls: 'text-zinc-400' },
  regen:   { label: 'Regen',   icon: '🌧️', factor: 1.3, cls: 'text-blue-400' },
  sturm:   { label: 'Sturm',   icon: '⛈️', factor: 1.6, cls: 'text-red-400' },
};

const ZAHLUNGS_CONFIG: Record<ZahlungsArt, { label: string; cls: string }> = {
  bar:     { label: 'Bar',     cls: 'bg-amber-500/15 text-amber-300' },
  karte:   { label: 'Karte',   cls: 'bg-blue-500/15 text-blue-300' },
  digital: { label: 'Digital', cls: 'bg-violet-500/15 text-violet-300' },
};

const NAV_APPS: { key: NavApp; label: string; color: string }[] = [
  { key: 'google', label: 'Google', color: 'bg-blue-600' },
  { key: 'waze',   label: 'Waze',   color: 'bg-cyan-600' },
  { key: 'apple',  label: 'Apple',  color: 'bg-zinc-600' },
];

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 22; const circ = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  const color = frac >= 0.8 ? '#22c55e' : frac >= 0.5 ? '#6366f1' : '#f59e0b';
  return (
    <svg width="56" height="56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="25" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold" fill={color}>{done}/{total}</text>
      <text x="28" y="36" textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#71717a">Stopps</text>
    </svg>
  );
}

interface Props { driverId?: string | null; className?: string }

export function FahrerPhase5521TourStopsNavHubV16({ driverId, className }: Props) {
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [expanded, setExpanded] = useState<string | null>('s2');
  const [isOnline, setIsOnline] = useState(true);
  const [navApp, setNavApp] = useState<NavApp>('google');
  const [showOpt, setShowOpt] = useState(false);
  const [schichtMinuten] = useState(210); // 3.5h in shift
  const pauseEmpfohlen = schichtMinuten >= 240;

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kapazitaet-live?driverId=${driverId}`);
      if (r.ok) { /* merge */ }
    } catch { /* mock */ }
  }, [driverId]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    load(); const id = setInterval(load, 30000);
    return () => { clearInterval(id); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [load]);

  const done = stops.filter(s => s.status === 'done').length;
  const offen = stops.filter(s => s.status !== 'done').length;
  const wetterCfg = WETTER_CONFIG[WETTER];

  const einnahmen = stops.reduce((a, s) => a + (s.status === 'done' ? s.betrag : 0), 0);
  const einnahmenBar = stops.filter(s => s.status === 'done' && s.zahlungsart === 'bar').reduce((a, s) => a + s.betrag, 0);
  const einnahmenKarte = stops.filter(s => s.status === 'done' && s.zahlungsart === 'karte').reduce((a, s) => a + s.betrag, 0);
  const avgBewertung = stops.filter(s => s.bewertung !== null).length > 0
    ? (stops.filter(s => s.bewertung !== null).reduce((a, s) => a + (s.bewertung ?? 0), 0) / stops.filter(s => s.bewertung !== null).length).toFixed(1)
    : '–';

  const KPI = [
    { label: 'Stopps',    val: `${stops.length}`,         cls: 'text-blue-400' },
    { label: 'Fertig',    val: `${done}`,                  cls: 'text-emerald-400' },
    { label: 'Offen',     val: `${offen}`,                 cls: offen > 0 ? 'text-yellow-400' : 'text-zinc-500' },
    { label: 'km',        val: '12.4',                     cls: 'text-indigo-400' },
    { label: 'ETA',       val: stops.find(s => s.status === 'active')?.eta ?? '–', cls: 'text-cyan-400' },
    { label: 'Einnahmen', val: `${einnahmen.toFixed(0)}€`, cls: 'text-yellow-400' },
    { label: 'Ø ★',       val: `${avgBewertung}`,          cls: 'text-amber-400' },
    { label: 'Pause',     val: pauseEmpfohlen ? '!' : 'ok',cls: pauseEmpfohlen ? 'text-orange-400' : 'text-emerald-400' },
  ];

  const sorted = showOpt ? [...stops].sort((a, b) => a.opt_seq - b.opt_seq) : stops;

  return (
    <div className={cn('space-y-3', className)}>
      {!isOnline && (
        <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2">
          <WifiOff className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300 font-medium">Offline — letzte Daten werden angezeigt</span>
        </div>
      )}

      {pauseEmpfohlen && (
        <div className="flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 rounded-xl px-3 py-2">
          <Coffee className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-300">Pause empfohlen — du bist seit {Math.floor(schichtMinuten / 60)}h {schichtMinuten % 60}min im Dienst</span>
        </div>
      )}

      {/* Wetter-Banner */}
      {WETTER !== 'klar' && (
        <div className={cn('flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2')}>
          <span className="text-base">{wetterCfg.icon}</span>
          <span className={cn('text-xs font-medium', wetterCfg.cls)}>{wetterCfg.label}</span>
          <span className="text-xs text-zinc-500">→ ETAs ×{wetterCfg.factor} angepasst</span>
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation2 className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Tour-Stops Nav V16</span>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Phase 5521</span>
        </div>

        {/* KPI 8 */}
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {KPI.map(k => (
            <div key={k.label} className="bg-zinc-800/60 rounded-lg p-2 text-center">
              <div className={cn('text-sm font-bold tabular-nums', k.cls)}>{k.val}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Einnahmen Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-amber-500/10 rounded-lg p-2 text-center">
            <div className="text-xs font-bold text-amber-300">{einnahmenBar.toFixed(0)}€</div>
            <div className="text-[9px] text-zinc-500">Bar</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2 text-center">
            <div className="text-xs font-bold text-blue-300">{einnahmenKarte.toFixed(0)}€</div>
            <div className="text-[9px] text-zinc-500">Karte</div>
          </div>
          <div className="bg-violet-500/10 rounded-lg p-2 text-center">
            <div className="text-xs font-bold text-violet-300">{(einnahmen - einnahmenBar - einnahmenKarte).toFixed(0)}€</div>
            <div className="text-[9px] text-zinc-500">Digital</div>
          </div>
        </div>

        {/* Nav App Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 shrink-0">Navigation:</span>
          <div className="flex gap-1">
            {NAV_APPS.map(a => (
              <button key={a.key} onClick={() => setNavApp(a.key)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  navApp === a.key ? `${a.color} text-white` : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200')}>
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowOpt(v => !v)}
            className={cn('ml-auto px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              showOpt ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200')}>
            {showOpt ? 'KI-Reihenfolge' : 'Original'}
          </button>
        </div>

        {/* Gesamtfortschritt */}
        <div className="flex items-center gap-4">
          <ProgressRing done={done} total={stops.length} />
          <div className="flex-1 space-y-1.5 text-xs text-zinc-400">
            <div>Geliefert: <strong className="text-emerald-400">{einnahmen.toFixed(2)}€</strong></div>
            <div>Wetter: <span className={wetterCfg.cls}>{wetterCfg.icon} {wetterCfg.label}</span></div>
            <div>Ø Bewertung: <strong className="text-amber-400">{avgBewertung}★</strong></div>
          </div>
        </div>

        {/* Stop List */}
        <div className="space-y-2">
          {sorted.map(stop => {
            const isExp = expanded === stop.id;
            const adjMin = Math.round(stop.prognose_min * stop.wetter_faktor);
            return (
              <button key={stop.id} onClick={() => setExpanded(isExp ? null : stop.id)} className="w-full text-left">
                <div className={cn('rounded-xl border transition-all',
                  stop.status === 'done' ? 'bg-zinc-800/30 border-zinc-800' :
                  stop.status === 'active' ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-zinc-900 border-zinc-800')}>
                  <div className="flex items-center gap-3 p-3">
                    <div className={cn('flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0',
                      stop.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                      stop.status === 'active' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500')}>
                      {stop.status === 'done' ? '✓' : showOpt ? stop.opt_seq : stop.seq}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-semibold text-white truncate">{stop.kunde}</span>
                        {stop.bewertung !== null && (
                          <span className="text-xs text-amber-400">{stop.bewertung}★</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{stop.adresse}</span>
                        {stop.notiz && <span className="text-yellow-400">⚠ {stop.notiz}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {stop.status !== 'done' && (
                        <>
                          <div className="text-xs font-bold text-white">{stop.eta}</div>
                          {stop.wetter_faktor > 1.0 && (
                            <div className="text-[9px] text-blue-400">~{adjMin}min 🌧️</div>
                          )}
                        </>
                      )}
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', ZAHLUNGS_CONFIG[stop.zahlungsart].cls)}>{ZAHLUNGS_CONFIG[stop.zahlungsart].label}</span>
                    </div>
                  </div>

                  {isExp && stop.status !== 'done' && (
                    <div className="px-3 pb-3 space-y-2 border-t border-zinc-800 pt-2">
                      <div className="text-xs text-zinc-400">Betrag: <strong className="text-white">{stop.betrag.toFixed(2)}€</strong></div>
                      <div className="grid grid-cols-3 gap-2">
                        <a href={`tel:${stop.tel}`} onClick={e => e.stopPropagation()} className="flex items-center justify-center gap-1 bg-emerald-500/15 text-emerald-400 rounded-lg py-2 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
                          <Phone className="h-3.5 w-3.5" /> Anruf
                        </a>
                        <a href={`https://wa.me/${stop.tel.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 bg-green-500/15 text-green-400 rounded-lg py-2 text-xs font-medium hover:bg-green-500/25 transition-colors">
                          <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                        <a href={navApp === 'google' ? `https://maps.google.com/?q=${encodeURIComponent(stop.adresse)}` : navApp === 'waze' ? `https://waze.com/ul?q=${encodeURIComponent(stop.adresse)}` : `maps://?q=${encodeURIComponent(stop.adresse)}`}
                          onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 bg-blue-500/15 text-blue-400 rounded-lg py-2 text-xs font-medium hover:bg-blue-500/25 transition-colors">
                          <Navigation2 className="h-3.5 w-3.5" /> Navi
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
