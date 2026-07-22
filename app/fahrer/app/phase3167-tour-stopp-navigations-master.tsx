'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation, Package, Phone, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Stopp {
  id: string;
  nr: number;
  adresse: string;
  plz: string | null;
  kunde_name: string;
  kunde_telefon: string | null;
  bestellnummer: string;
  artikel_anzahl: number;
  betrag: number;
  zahlungsart: string;
  status: 'offen' | 'unterwegs' | 'angekommen' | 'geliefert';
  eta_min: number | null;
  notiz: string | null;
}

interface ApiData {
  tour_id: string;
  tour_nr: number;
  stopps: Stopp[];
  geliefert: number;
  gesamt: number;
  eta_rueckkehr_min: number | null;
  aktiver_stopp_id: string | null;
}

const MOCK: ApiData = {
  tour_id: 't1',
  tour_nr: 3,
  stopps: [
    { id: 's1', nr: 1, adresse: 'Hauptstraße 12', plz: '10117', kunde_name: 'Mia Wagner', kunde_telefon: '+49 176 1234567', bestellnummer: '#3001', artikel_anzahl: 3, betrag: 24.90, zahlungsart: 'online', status: 'geliefert', eta_min: null, notiz: null },
    { id: 's2', nr: 2, adresse: 'Bahnhofstraße 5', plz: '10178', kunde_name: 'Leon Müller', kunde_telefon: '+49 172 9876543', bestellnummer: '#3002', artikel_anzahl: 2, betrag: 18.50, zahlungsart: 'bar', status: 'unterwegs', eta_min: 6, notiz: 'Bitte klingeln: Maier' },
    { id: 's3', nr: 3, adresse: 'Gartenweg 8', plz: '10115', kunde_name: 'Sophie Koch', kunde_telefon: null, bestellnummer: '#3003', artikel_anzahl: 4, betrag: 39.80, zahlungsart: 'online', status: 'offen', eta_min: 18, notiz: null },
  ],
  geliefert: 1,
  gesamt: 3,
  eta_rueckkehr_min: 32,
  aktiver_stopp_id: 's2',
};

function statusCls(s: string) {
  if (s === 'geliefert') return { dot: 'bg-green-500', card: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10', text: 'text-green-600 dark:text-green-400' };
  if (s === 'unterwegs' || s === 'angekommen') return { dot: 'bg-blue-500 animate-pulse', card: 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-md', text: 'text-blue-600 dark:text-blue-400' };
  return { dot: 'bg-gray-300 dark:bg-gray-600', card: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900', text: 'text-gray-500' };
}

function stoppLabel(s: string) {
  if (s === 'geliefert') return '✓ Geliefert';
  if (s === 'unterwegs') return '🚴 Unterwegs';
  if (s === 'angekommen') return '📍 Angekommen';
  return 'Ausstehend';
}

function navUrl(adresse: string, plz: string | null) {
  const q = encodeURIComponent(`${adresse}${plz ? ', ' + plz : ''}`);
  return `https://maps.google.com/?q=${q}`;
}

export function FahrerPhase3167TourStoppNavigationsMaster({
  tourId,
  fahrerId,
}: {
  tourId?: string;
  fahrerId?: string;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      if (!tourId) { setData(MOCK); return; }
      fetch(`/api/delivery/fahrer/tour-stopps?tour_id=${tourId}&fahrer_id=${fahrerId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    };
    load();
    const poll = setInterval(load, 15_000);
    return () => clearInterval(poll);
  }, [tourId, fahrerId]);

  const d = data ?? MOCK;
  const fortschritt = d.gesamt > 0 ? Math.round((d.geliefert / d.gesamt) * 100) : 0;

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3 p-3">
      {/* Tour-Header */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">Tour #{d.tour_nr}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{d.geliefert}/{d.gesamt} Stopps</span>
            {d.eta_rueckkehr_min != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />~{d.eta_rueckkehr_min} Min zurück
              </span>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
        <div className="text-[10px] text-gray-400 text-right mt-0.5">{fortschritt}% abgeschlossen</div>
      </div>

      {/* Stopp-Liste */}
      <div className="space-y-2">
        {d.stopps.map(st => {
          const s = statusCls(st.status);
          const isActive = st.id === d.aktiver_stopp_id;
          const isExpanded = expanded.has(st.id);

          return (
            <div key={st.id} className={`rounded-xl border-2 overflow-hidden transition-all ${s.card} ${isActive ? 'ring-2 ring-blue-400/40 dark:ring-blue-500/30' : ''}`}>
              <button
                onClick={() => toggle(st.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
              >
                {/* Stopp-Nummer */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${st.status === 'geliefert' ? 'bg-green-500 text-white' : st.status === 'unterwegs' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                  {st.status === 'geliefert' ? <CheckCircle2 className="h-4 w-4" /> : st.nr}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{st.kunde_name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-current/10 ${s.text}`}>{stoppLabel(st.status)}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{st.adresse}{st.plz ? `, ${st.plz}` : ''}</div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {st.eta_min != null && st.status !== 'geliefert' && (
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{st.eta_min} Min</span>
                  )}
                  <span className={`text-xs font-bold ${st.zahlungsart === 'bar' ? 'text-orange-500' : 'text-gray-400'}`}>
                    {st.zahlungsart === 'bar' ? `${st.betrag.toFixed(2)} € (bar)` : `${st.betrag.toFixed(2)} €`}
                  </span>
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                </div>
              </button>

              {/* Detail-Ansicht */}
              {isExpanded && (
                <div className="border-t border-current/10 px-4 py-3 space-y-2 bg-white/50 dark:bg-black/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">Bestellung:</span>
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{st.bestellnummer}</span>
                    <span className="text-[10px] text-gray-500">·</span>
                    <span className="text-[10px] text-gray-500">{st.artikel_anzahl} Artikel</span>
                  </div>

                  {st.notiz && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                      <span className="text-xs text-amber-700 dark:text-amber-400">📝 {st.notiz}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={navUrl(st.adresse, st.plz)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Navigation
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </a>
                    {st.kunde_telefon && (
                      <a
                        href={`tel:${st.kunde_telefon}`}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Anrufen
                      </a>
                    )}
                  </div>

                  {st.status !== 'geliefert' && (
                    <button className="w-full rounded-lg bg-green-500 px-3 py-2.5 text-sm font-bold text-white hover:bg-green-600 active:bg-green-700 transition-colors flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Als geliefert markieren
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {d.stopps.every(s => s.status === 'geliefert') && (
        <div className="rounded-xl border-2 border-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-5 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <div className="text-base font-bold text-green-700 dark:text-green-400">Tour abgeschlossen!</div>
          <div className="text-xs text-green-600 dark:text-green-500 mt-1">Alle {d.gesamt} Stopps erfolgreich geliefert</div>
        </div>
      )}
    </div>
  );
}
