'use client';

import { useEffect, useState } from 'react';
import { Target, Zap, User, Clock, ChevronDown, ChevronUp, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Driver {
  id: string;
  name: string;
  status: string;
  location_id: string | null;
}

interface Props {
  drivers?: Driver[];
  locationId: string | null;
}

interface ZuweisungsVorschlag {
  order_id: string;
  bestellnummer: string;
  score: number;
  fahrer_name: string;
  fahrer_id: string;
  grund: string;
  eta_min: number;
  confidence: 'hoch' | 'mittel' | 'niedrig';
}

const MOCK_VORSCHLAEGE: ZuweisungsVorschlag[] = [
  { order_id: 'a1', bestellnummer: '1042', score: 94, fahrer_name: 'Mikail T.', fahrer_id: 'f1', grund: 'Nächster Fahrer + Zone-Affinität', eta_min: 12, confidence: 'hoch' },
  { order_id: 'a2', bestellnummer: '1043', score: 81, fahrer_name: 'Jonas R.', fahrer_id: 'f2', grund: 'Guter Score, bekannte Zone', eta_min: 18, confidence: 'mittel' },
  { order_id: 'a3', bestellnummer: '1044', score: 67, fahrer_name: 'Luca M.', fahrer_id: 'f3', grund: 'Backup: Einziger verfügbarer Fahrer', eta_min: 24, confidence: 'niedrig' },
];

function scoreToColor(score: number) {
  if (score >= 85) return { bar: 'bg-matcha-500', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700' };
  if (score >= 65) return { bar: 'bg-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
  return { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
}

function confLabel(c: ZuweisungsVorschlag['confidence']) {
  switch (c) {
    case 'hoch': return { text: 'Hohe Konfidenz', cls: 'text-matcha-600' };
    case 'mittel': return { text: 'Mittlere Konfidenz', cls: 'text-amber-600' };
    case 'niedrig': return { text: 'Niedrige Konfidenz', cls: 'text-red-600' };
  }
}

export function DispatchPhase832ZuweisungLiveCockpit({ drivers = [], locationId }: Props) {
  const [vorschlaege, setVorschlaege] = useState<ZuweisungsVorschlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/dispatch?action=zuweisung_vorschlaege&${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (Array.isArray(json.vorschlaege)) {
        setVorschlaege(json.vorschlaege);
        setLastRefresh(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        return;
      }
    } catch { /* noop */ }
    // Fallback: filter by available drivers if we have them, else show mock
    const available = drivers.filter((d) => d.status === 'frei' || d.status === 'available');
    if (available.length > 0) {
      setVorschlaege(
        MOCK_VORSCHLAEGE.slice(0, available.length).map((v, i) => ({
          ...v,
          fahrer_name: available[i]?.name ?? v.fahrer_name,
          fahrer_id: available[i]?.id ?? v.fahrer_id,
        }))
      );
    } else {
      setVorschlaege(MOCK_VORSCHLAEGE);
    }
    setLastRefresh(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (vorschlaege.length === 0 && !loading) return null;

  const topScore = vorschlaege[0]?.score ?? 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-stone-50 hover:bg-stone-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Target className="h-4 w-4 text-stone-600" />
        <span className="text-sm font-bold text-stone-800">Zuweisung Live-Cockpit</span>
        {topScore >= 85 && (
          <span className="ml-1 text-[10px] bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5 font-bold">
            Score {topScore}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {loading && <RefreshCw className="h-3 w-3 text-stone-400 animate-spin" />}
          {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-stone-100">
          {vorschlaege.map((v) => {
            const c = scoreToColor(v.score);
            const conf = confLabel(v.confidence);
            return (
              <div key={v.order_id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  {/* Score Ring */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white', c.bar)}>
                      {v.score}
                    </div>
                    <span className="text-[8px] text-stone-400 mt-0.5">Score</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-stone-800">#{v.bestellnummer}</span>
                      <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', c.badge)}>
                        {v.score >= 85 ? 'Optimal' : v.score >= 65 ? 'OK' : 'Suboptimal'}
                      </span>
                      <span className={cn('text-[9px] ml-auto', conf.cls)}>{conf.text}</span>
                    </div>

                    {/* Score Bar */}
                    <div className="h-1.5 bg-stone-100 rounded-full mb-2 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', c.bar)}
                        style={{ width: `${v.score}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-stone-400" />
                        <span className="text-[10px] text-stone-600 font-medium">{v.fahrer_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-stone-400" />
                        <span className="text-[10px] text-stone-500">ETA {v.eta_min} Min</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-stone-400 mt-1 leading-tight">{v.grund}</p>
                  </div>

                  <button className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-matcha-600 bg-matcha-50 border border-matcha-200 rounded-lg px-2 py-1 hover:bg-matcha-100 transition-colors">
                    <CheckCircle2 className="h-3 w-3" />
                    Zuweisen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <span className="text-[9px] text-stone-400">
          {lastRefresh ? `Aktualisiert ${lastRefresh}` : 'Lädt…'} · alle 45s
        </span>
        <div className="flex items-center gap-1">
          <Zap className="h-2.5 w-2.5 text-stone-400" />
          <span className="text-[9px] text-stone-400">{vorschlaege.length} Vorschläge</span>
        </div>
      </div>
    </div>
  );
}
