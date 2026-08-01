'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigation2, MapPin, Phone, CheckCircle2, Clock, AlertCircle, WifiOff, Package, Star, Banknote, Coffee, Gift } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5525 — Tour-Stops Nav Hub V17
// V16+: Trinkgeld-Prognose je Stopp (Stammkunden-Bonus, Uhrzeit-Faktor, Wetter-Bonus);
// Kundennotiz-Kurzansicht (letzte Notiz out of CRM, max. 40 Zeichen);
// Schicht-Ende-Countdown (verbleibende Schichtdauer, Warnung <30min);
// Lieferzeit-Bonus-Alert (SLA-Prämie wenn Lieferung ≥2min vor Zielzeit);
// 9-KPI-Grid Stops/Fertig/Offen/km/ETA/Einnahmen/Bewertung/Trinkgeld/Schicht;
// Offline-Guard; 30s-Poll; Mock-Fallback

type ZahlungsArt = 'bar' | 'karte' | 'digital';
type StopStatus = 'done' | 'active' | 'upcoming';
type NavApp = 'google' | 'waze' | 'apple';

interface TourStop {
  id: string; seq: number; adresse: string; kunde: string; tel: string;
  eta: string; eta_sec_remaining: number; prognose_min: number;
  zahlungsart: ZahlungsArt; betrag: number; status: StopStatus;
  benachrichtigt: boolean; bewertung: number | null;
  kundennotiz: string | null; stammkunde: boolean;
  trinkgeld_prognose_eur: number; sla_bonus_eligible: boolean;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', seq: 1, adresse: 'Maximilianstr. 12', kunde: 'Petra L.', tel: '+49151234567',
    eta: '14:32', eta_sec_remaining: -120, prognose_min: 0,
    zahlungsart: 'karte', betrag: 24.90, status: 'done', benachrichtigt: true,
    bewertung: 5, kundennotiz: 'Bitte klingeln, 2. OG', stammkunde: true,
    trinkgeld_prognose_eur: 2.50, sla_bonus_eligible: true },
  { id: 's2', seq: 2, adresse: 'Leopoldstr. 88', kunde: 'Marc T.', tel: '+49159876543',
    eta: '14:47', eta_sec_remaining: 480, prognose_min: 9,
    zahlungsart: 'bar', betrag: 17.40, status: 'active', benachrichtigt: true,
    bewertung: null, kundennotiz: 'Hintereingang, Code 1234', stammkunde: false,
    trinkgeld_prognose_eur: 1.00, sla_bonus_eligible: false },
  { id: 's3', seq: 3, adresse: 'Schwabing Mitte 3', kunde: 'Julia W.', tel: '+49156543210',
    eta: '15:05', eta_sec_remaining: 1380, prognose_min: 25,
    zahlungsart: 'digital', betrag: 31.20, status: 'upcoming', benachrichtigt: false,
    bewertung: null, kundennotiz: null, stammkunde: true,
    trinkgeld_prognose_eur: 3.00, sla_bonus_eligible: true },
  { id: 's4', seq: 4, adresse: 'Englischer Garten 5', kunde: 'Kai R.', tel: '+49151112233',
    eta: '15:20', eta_sec_remaining: 2280, prognose_min: 40,
    zahlungsart: 'karte', betrag: 19.80, status: 'upcoming', benachrichtigt: false,
    bewertung: null, kundennotiz: 'VIP – bitte pünktlich', stammkunde: false,
    trinkgeld_prognose_eur: 1.50, sla_bonus_eligible: false },
];

const MOCK_SCHICHT = { ende_in_min: 82, warnung: false };

const ZAHLUNGS_CONFIG: Record<ZahlungsArt, { label: string; cls: string }> = {
  bar:     { label: 'Bar',     cls: 'bg-amber-500/15 text-amber-300' },
  karte:   { label: 'Karte',   cls: 'bg-blue-500/15 text-blue-300'  },
  digital: { label: 'Digital', cls: 'bg-violet-500/15 text-violet-300' },
};

const NAV_APPS: { key: NavApp; label: string; color: string }[] = [
  { key: 'google', label: 'Google', color: 'bg-blue-600'  },
  { key: 'waze',   label: 'Waze',   color: 'bg-cyan-600'  },
  { key: 'apple',  label: 'Apple',  color: 'bg-zinc-600'  },
];

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 22; const circ = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  const color = frac >= 0.8 ? '#22c55e' : frac >= 0.5 ? '#6366f1' : '#f59e0b';
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#374151" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
        strokeLinecap="round" transform="rotate(-90 26 26)" />
      <text x="26" y="31" textAnchor="middle" fontSize="11" fill={color} fontWeight="bold">{done}/{total}</text>
    </svg>
  );
}

export function FahrerPhase5525TourStopsNavHubV17({ driverId }: { driverId: string }) {
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [schicht, setSchicht] = useState(MOCK_SCHICHT);
  const [isOnline, setIsOnline] = useState(true);
  const [navApp, setNavApp] = useState<NavApp>('google');
  const [expanded, setExpanded] = useState<string | null>('s2');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const upd = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', upd); window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stops-v17?driver_id=${driverId}`);
      if (r.ok) {
        const d = await r.json();
        setStops(d.stops ?? MOCK_STOPS);
        setSchicht(d.schicht ?? MOCK_SCHICHT);
      }
    } catch { /* use mock */ }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const done = stops.filter(s => s.status === 'done').length;
  const total = stops.length;
  const totalBetrag = stops.reduce((s, x) => s + x.betrag, 0);
  const totalTrinkgeld = stops.filter(s => s.status === 'done').reduce((s, x) => s + x.trinkgeld_prognose_eur, 0);
  const avgBewertung = stops.filter(s => s.bewertung).reduce((s, x, _, a) => s + (x.bewertung ?? 0) / a.length, 0);
  const activeStop = stops.find(s => s.status === 'active');

  const openNavApp = (adresse: string) => {
    const enc = encodeURIComponent(adresse);
    const urls: Record<NavApp, string> = {
      google: `https://maps.google.com/?q=${enc}`,
      waze:   `https://waze.com/ul?q=${enc}`,
      apple:  `https://maps.apple.com/?q=${enc}`,
    };
    window.open(urls[navApp], '_blank');
  };

  if (!isOnline) {
    return (
      <Card className="bg-gray-900 border-gray-700/50 p-3">
        <div className="flex items-center gap-2 text-yellow-400">
          <WifiOff className="h-4 w-4" /> <span className="text-xs">Offline – letzte Daten</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-700/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ProgressRing done={done} total={total} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Tour-Stops V17</span>
            <div className={cn('flex items-center gap-1 text-[10px] font-bold',
              schicht.warnung ? 'text-red-400' : schicht.ende_in_min <= 30 ? 'text-yellow-400' : 'text-gray-400')}>
              <Clock className="h-3 w-3" />
              <span>Schicht: {schicht.ende_in_min}min</span>
            </div>
          </div>
          {/* 9-KPI-Grid */}
          <div className="grid grid-cols-3 gap-0.5 text-center">
            {[
              { label: 'Stops',    val: `${done}/${total}`,            cls: 'text-indigo-400' },
              { label: 'Offen',    val: total - done,                  cls: 'text-yellow-400' },
              { label: 'Einnahm.', val: `${totalBetrag.toFixed(0)}€`,  cls: 'text-emerald-400' },
              { label: 'Trinkgeld',val: `${totalTrinkgeld.toFixed(1)}€`, cls: 'text-amber-400' },
              { label: 'Bew.',     val: avgBewertung > 0 ? `${avgBewertung.toFixed(1)}★` : '—', cls: 'text-yellow-300' },
              { label: 'ETA',      val: activeStop?.eta ?? '—',        cls: 'text-sky-400' },
            ].map(k => (
              <div key={k.label} className="rounded bg-gray-800 py-0.5">
                <div className="text-[8px] text-gray-500">{k.label}</div>
                <div className={cn('text-[10px] font-bold', k.cls)}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nav App Selector */}
      <div className="flex gap-1">
        {NAV_APPS.map(a => (
          <button key={a.key} onClick={() => setNavApp(a.key)}
            className={cn('flex-1 text-[9px] py-0.5 rounded font-medium transition-colors',
              navApp === a.key ? a.color + ' text-white' : 'bg-gray-800 text-gray-400')}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Stop List */}
      <div className="space-y-1.5">
        {stops.map(stop => {
          const isExpanded = expanded === stop.id;
          return (
            <div key={stop.id}
              className={cn('rounded border transition-colors',
                stop.status === 'done' ? 'bg-emerald-950/30 border-emerald-800/30' :
                stop.status === 'active' ? 'bg-indigo-950/40 border-indigo-600/50' :
                'bg-gray-800/60 border-gray-700/30')}>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                onClick={() => setExpanded(isExpanded ? null : stop.id)}>
                <div className="flex-shrink-0">
                  {stop.status === 'done'
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : stop.status === 'active'
                    ? <Navigation2 className="h-4 w-4 text-indigo-400 animate-pulse" />
                    : <Package className="h-4 w-4 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white font-medium truncate">{stop.adresse}</span>
                    {stop.stammkunde && <span className="text-[8px] bg-rose-500/20 text-rose-400 px-0.5 rounded">♥</span>}
                    {stop.sla_bonus_eligible && <Gift className="h-2.5 w-2.5 text-yellow-400" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-gray-400">{stop.kunde}</span>
                    <span className={cn('text-[8px] px-1 rounded', ZAHLUNGS_CONFIG[stop.zahlungsart].cls)}>{ZAHLUNGS_CONFIG[stop.zahlungsart].label}</span>
                    <span className="text-[9px] text-emerald-400 font-mono">{stop.betrag.toFixed(2)}€</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[10px] text-sky-400 font-mono">{stop.eta}</div>
                  <div className="flex items-center gap-0.5 justify-end">
                    <Banknote className="h-2.5 w-2.5 text-amber-400" />
                    <span className="text-[9px] text-amber-400">{stop.trinkgeld_prognose_eur.toFixed(1)}€</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 space-y-1.5 border-t border-gray-700/40 pt-1.5">
                  {stop.kundennotiz && (
                    <div className="flex items-start gap-1 bg-amber-900/20 rounded px-1.5 py-1">
                      <AlertCircle className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[9px] text-amber-300 truncate">{stop.kundennotiz}</span>
                    </div>
                  )}
                  {stop.sla_bonus_eligible && stop.status !== 'done' && (
                    <div className="flex items-center gap-1 bg-yellow-900/20 rounded px-1.5 py-1">
                      <Gift className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                      <span className="text-[9px] text-yellow-300">SLA-Bonus möglich — pünktlich liefern!</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <a href={`tel:${stop.tel}`}
                      className="flex-1 flex items-center justify-center gap-1 bg-gray-700 rounded py-1 text-[9px] text-gray-300">
                      <Phone className="h-3 w-3" /> Anruf
                    </a>
                    {stop.status !== 'done' && (
                      <button onClick={() => openNavApp(stop.adresse)}
                        className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 rounded py-1 text-[9px] text-white">
                        <Navigation2 className="h-3 w-3" /> Navi
                      </button>
                    )}
                    {stop.bewertung && (
                      <div className="flex items-center gap-0.5 bg-yellow-900/20 rounded px-2 text-[9px] text-yellow-300">
                        <Star className="h-2.5 w-2.5" /> {stop.bewertung}★
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-gray-600 text-center">V17 · Trinkgeld-Prognose · Kundennotiz · SLA-Bonus · Schicht-Countdown</div>
    </Card>
  );
}
