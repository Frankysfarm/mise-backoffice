'use client';

/**
 * SchichtMargenAnalyse — Phase 440
 * Analysiert die Marge pro Schicht: Kosten je Bestellung (Fahrerlohn + Plattformkosten)
 * vs. Liefergebühr-Einnahmen und Umsatzbeitrag. Zeigt Break-Even-Punkt.
 * Daten aus /api/delivery/admin/schicht-marge (Fallback: Mock).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

interface MargenData {
  schichtStunden: number;
  fahrerAnzahl: number;
  bestellungen: number;
  umsatzGesamt: number;
  liefergebuehrenGesamt: number;
  fahrerLohnGesamt: number;
  plattformKostenGesamt: number;
  nettoMargeGesamt: number;
  kostenProBestellung: number;
  gebuehrenProBestellung: number;
  margeProBestellung: number;
  margePct: number;
  breakEvenBestellungen: number;
  trend: 'up' | 'down' | 'flat';
  vergleichGestern?: {
    margePct: number;
    bestellungen: number;
  } | null;
}

function buildMockData(): MargenData {
  const bestellungen = Math.floor(Math.random() * 80 + 40);
  const umsatzGesamt = bestellungen * (18 + Math.random() * 12);
  const fahrerAnzahl = 3 + Math.floor(Math.random() * 3);
  const schichtStunden = 6 + Math.random() * 2;
  const stundenLohn = 13.5;
  const fahrerLohnGesamt = fahrerAnzahl * schichtStunden * stundenLohn;
  const plattformKostenGesamt = bestellungen * 0.8;
  const liefergebuehrenGesamt = bestellungen * (2.5 + Math.random() * 1.5);
  const nettoMargeGesamt = liefergebuehrenGesamt - fahrerLohnGesamt - plattformKostenGesamt;
  const kostenProBestellung = (fahrerLohnGesamt + plattformKostenGesamt) / bestellungen;
  const gebuehrenProBestellung = liefergebuehrenGesamt / bestellungen;
  const margeProBestellung = nettoMargeGesamt / bestellungen;
  const margePct = liefergebuehrenGesamt > 0 ? nettoMargeGesamt / liefergebuehrenGesamt : 0;
  const breakEvenBestellungen = kostenProBestellung > 0
    ? Math.ceil((fahrerLohnGesamt + plattformKostenGesamt) / gebuehrenProBestellung)
    : 0;
  const gesternMarge = margePct + (Math.random() - 0.5) * 0.15;
  const trend: MargenData['trend'] = margePct - gesternMarge > 0.03 ? 'up'
    : gesternMarge - margePct > 0.03 ? 'down' : 'flat';

  return {
    schichtStunden: Math.round(schichtStunden * 10) / 10,
    fahrerAnzahl,
    bestellungen,
    umsatzGesamt,
    liefergebuehrenGesamt,
    fahrerLohnGesamt,
    plattformKostenGesamt,
    nettoMargeGesamt,
    kostenProBestellung,
    gebuehrenProBestellung,
    margeProBestellung,
    margePct,
    breakEvenBestellungen,
    trend,
    vergleichGestern: { margePct: gesternMarge, bestellungen: Math.floor(bestellungen * (0.8 + Math.random() * 0.4)) },
  };
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtPct(v: number) {
  return (v * 100).toFixed(1) + '%';
}

export function SchichtMargenAnalyse({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<MargenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    setLoading(true);
    const url = locationId
      ? `/api/delivery/admin/schicht-marge?location_id=${locationId}`
      : null;
    if (!url) {
      setTimeout(() => { setData(buildMockData()); setLoading(false); }, 300);
      return;
    }
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? buildMockData()))
      .catch(() => setData(buildMockData()))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  if (!loading && !data) return null;

  const marginColor = data
    ? data.margePct >= 0.2 ? 'text-matcha-700'
    : data.margePct >= 0 ? 'text-amber-700'
    : 'text-red-600'
    : '';

  const TrendIcon = data?.trend === 'up' ? TrendingUp : data?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data?.trend === 'up' ? 'text-matcha-600' : data?.trend === 'down' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Euro className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-bold text-stone-800 flex-1">Schicht-Margen-Analyse</span>
        <button onClick={load} className="p-1 hover:bg-stone-100 rounded transition">
          <RefreshCw className={cn('h-3.5 w-3.5 text-stone-400', loading && 'animate-spin')} />
        </button>
        <button onClick={() => setOpen(v => !v)} className="p-1 hover:bg-stone-100 rounded">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-stone-400" /> : <ChevronDown className="h-3.5 w-3.5 text-stone-400" />}
        </button>
      </div>

      {open && (
        loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-stone-100 rounded-xl animate-pulse" />)}
          </div>
        ) : data ? (
          <div className="p-5 space-y-4">
            {/* Haupt-KPI */}
            <div className="flex items-start gap-4">
              <div>
                <div className={cn('text-4xl font-black tabular-nums leading-none', marginColor)}>
                  {fmtPct(data.margePct)}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
                  <span className={cn('text-xs font-semibold', trendColor)}>
                    {data.trend === 'up' ? 'Besser als gestern' : data.trend === 'down' ? 'Schlechter als gestern' : 'Wie gestern'}
                  </span>
                  {data.vergleichGestern && (
                    <span className="text-xs text-stone-400">
                      (Gestern: {fmtPct(data.vergleichGestern.margePct)})
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className={cn('text-xl font-black tabular-nums', data.nettoMargeGesamt >= 0 ? 'text-matcha-700' : 'text-red-600')}>
                  {fmtEur(data.nettoMargeGesamt)}
                </div>
                <div className="text-[10px] text-stone-400">Netto-Marge</div>
              </div>
            </div>

            {/* Kosten-Einnahmen-Balken */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Einnahmen vs. Kosten</div>
              {[
                { label: 'Liefergebühren', value: data.liefergebuehrenGesamt, color: 'bg-matcha-500', max: data.liefergebuehrenGesamt },
                { label: 'Fahrlohn', value: data.fahrerLohnGesamt, color: 'bg-amber-400', max: data.liefergebuehrenGesamt },
                { label: 'Plattform', value: data.plattformKostenGesamt, color: 'bg-rose-400', max: data.liefergebuehrenGesamt },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-stone-500 w-28 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', item.color)}
                      style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-stone-700 w-20 text-right shrink-0">
                    {fmtEur(item.value)}
                  </span>
                </div>
              ))}
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Kosten/Bestell.', value: fmtEur(data.kostenProBestellung), sub: 'Lohn + Plattform' },
                { label: 'Geb./Bestell.', value: fmtEur(data.gebuehrenProBestellung), sub: 'Ø Liefergebühr' },
                { label: 'Marge/Bestell.', value: fmtEur(data.margeProBestellung), sub: 'Netto je Auftrag', warn: data.margeProBestellung < 0 },
                { label: 'Break-Even', value: `${data.breakEvenBestellungen} Bestell.`, sub: `(${data.bestellungen} erzielt)`, warn: data.bestellungen < data.breakEvenBestellungen },
              ].map(kpi => (
                <div key={kpi.label} className={cn('rounded-xl p-3 text-center', kpi.warn ? 'bg-red-50 border border-red-100' : 'bg-stone-50')}>
                  <div className={cn('text-sm font-black tabular-nums', kpi.warn ? 'text-red-700' : 'text-stone-900')}>
                    {kpi.value}
                  </div>
                  <div className="text-[9px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
                  <div className="text-[8px] text-stone-400">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Shift summary */}
            <div className="flex items-center gap-3 text-[10px] text-stone-400 border-t border-stone-100 pt-3">
              <span>{data.fahrerAnzahl} Fahrer · {data.schichtStunden}h Schicht · {data.bestellungen} Bestellungen</span>
              <span className="ml-auto text-[9px] italic">Mock-Daten falls kein API</span>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
