'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Navigation, Package, CheckCircle2 } from 'lucide-react';

interface Stopp {
  nr: number;
  adresse: string;
  status: 'offen' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  bestellnummer: string;
}

interface Tour {
  fahrer_id: string;
  fahrer_name: string;
  tour_nr: number;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  stopps: Stopp[];
  geliefert: number;
  gesamt: number;
  eta_rueckkehr_min: number | null;
  fortschritt_pct: number;
}

interface ApiData {
  touren: Tour[];
  aktiv: number;
  fertig_heute: number;
}

const MOCK: ApiData = {
  aktiv: 3,
  fertig_heute: 11,
  touren: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.', tour_nr: 1, score: 89, ampel: 'gruen', geliefert: 2, gesamt: 4, eta_rueckkehr_min: 24, fortschritt_pct: 50,
      stopps: [
        { nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, bestellnummer: '#3001' },
        { nr: 2, adresse: 'Bahnhofstr. 5', status: 'geliefert', eta_min: null, bestellnummer: '#3002' },
        { nr: 3, adresse: 'Gartenweg 8', status: 'unterwegs', eta_min: 7, bestellnummer: '#3003' },
        { nr: 4, adresse: 'Lindenstr. 22', status: 'offen', eta_min: 18, bestellnummer: '#3004' },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara K.', tour_nr: 2, score: 63, ampel: 'gelb', geliefert: 0, gesamt: 3, eta_rueckkehr_min: 38, fortschritt_pct: 10,
      stopps: [
        { nr: 1, adresse: 'Ringstr. 3', status: 'unterwegs', eta_min: 11, bestellnummer: '#3005' },
        { nr: 2, adresse: 'Kirchgasse 7', status: 'offen', eta_min: 21, bestellnummer: '#3006' },
        { nr: 3, adresse: 'Bergweg 15', status: 'offen', eta_min: 34, bestellnummer: '#3007' },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.', tour_nr: 3, score: 51, ampel: 'rot', geliefert: 0, gesamt: 2, eta_rueckkehr_min: 55, fortschritt_pct: 5,
      stopps: [
        { nr: 1, adresse: 'Schlossallee 1', status: 'unterwegs', eta_min: 19, bestellnummer: '#3008' },
        { nr: 2, adresse: 'Parkstr. 44', status: 'offen', eta_min: 41, bestellnummer: '#3009' },
      ],
    },
  ],
};

function ampelCls(a: string) {
  if (a === 'rot')  return { card: 'border-red-600/50 bg-red-950/25', score: 'text-red-400', progress: 'bg-red-500', header: 'text-red-400' };
  if (a === 'gelb') return { card: 'border-amber-500/40 bg-amber-950/20', score: 'text-amber-400', progress: 'bg-amber-400', header: 'text-amber-400' };
  return                   { card: 'border-green-600/40 bg-green-950/15', score: 'text-green-400', progress: 'bg-green-500', header: 'text-green-400' };
}

function stoppCls(status: string) {
  if (status === 'geliefert') return { dot: 'bg-green-500', text: 'text-green-400 line-through', eta: '' };
  if (status === 'unterwegs') return { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-300 font-semibold', eta: 'text-blue-400' };
  return                             { dot: 'bg-gray-600', text: 'text-gray-400', eta: 'text-gray-500' };
}

export function DispatchPhase3170TourVisualisierungMaster({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['f1']));
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/aktive-touren?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const d = data ?? MOCK;
  const alertTouren = d.touren.filter(t => t.ampel === 'rot');

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Tour-Visualisierung Master</span>
          {alertTouren.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />{alertTouren.length} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span><span className="text-white font-bold">{d.aktiv}</span> aktiv</span>
          <span><span className="text-green-400 font-bold">{d.fertig_heute}</span> fertig heute</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {d.touren.map(t => {
            const s = ampelCls(t.ampel);
            const isExp = expanded.has(t.fahrer_id);
            return (
              <div key={t.fahrer_id} className={`rounded-lg border overflow-hidden ${s.card}`}>
                <button
                  onClick={() => toggleExpand(t.fahrer_id)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-white">{t.fahrer_name}</span>
                    <span className="text-[9px] text-gray-500">Tour #{t.tour_nr}</span>
                    <span className={`text-[10px] font-black ${s.score}`}>{t.score} Pkt</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-400">{t.geliefert}/{t.gesamt}</span>
                    {t.eta_rueckkehr_min != null && (
                      <span className="text-[10px] text-blue-400">~{t.eta_rueckkehr_min} Min</span>
                    )}
                    {isExp ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                  </div>
                </button>

                {/* Fortschritts-Balken */}
                <div className="px-3 pb-1">
                  <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${s.progress}`} style={{ width: `${t.fortschritt_pct}%` }} />
                  </div>
                </div>

                {/* Stopp-Liste bei Expand */}
                {isExp && (
                  <div className="border-t border-gray-700/50 px-3 py-2 space-y-1">
                    {t.stopps.map(st => {
                      const sc = stoppCls(st.status);
                      return (
                        <div key={st.nr} className="flex items-center gap-2">
                          {/* Connector line */}
                          <div className="flex flex-col items-center gap-0 self-stretch">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${sc.dot}`} />
                            {st.nr < t.stopps.length && <div className="w-px flex-1 bg-gray-700 min-h-[8px]" />}
                          </div>
                          <div className="flex-1 flex items-center justify-between py-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-[10px] truncate ${sc.text}`}>{st.adresse}</span>
                              <span className="text-[9px] text-gray-600 shrink-0">{st.bestellnummer}</span>
                            </div>
                            {st.eta_min != null && (
                              <span className={`text-[10px] shrink-0 ml-2 ${sc.eta}`}>{st.eta_min} Min</span>
                            )}
                            {st.status === 'geliefert' && (
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 ml-1" />
                            )}
                            {st.status === 'unterwegs' && (
                              <Package className="h-3 w-3 text-blue-400 shrink-0 ml-1 animate-bounce" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {d.touren.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">Keine aktiven Touren</div>
          )}
        </div>
      )}
    </div>
  );
}
