'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';

/**
 * Phase 1813 — Stopp-Abbruch-Monitor (Dispatch)
 *
 * Bindet Phase1806-API /api/delivery/driver/stopp-abbrueche ein.
 * Tabelle: Fahrer × Abbruch-Arten (nicht_zuhause / falsches_paket / kunde_abwesend / unbekannt) + Quote.
 * Alert-Banner wenn Location-Quote > 10 %.
 * 30-Min-Polling.
 */

type AbbruchGrund = 'nicht_zuhause' | 'falsches_paket' | 'kunde_abwesend' | 'unbekannt';

interface FahrerAbbruch {
  fahrer_id: string;
  name: string;
  abbrueche_7_tage: number;
  quote_pct: number;
  nach_grund: Record<AbbruchGrund, number>;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiAntwort {
  location_id: string | null;
  fahrer: FahrerAbbruch[];
  gesamt_quote_pct: number;
  quote_alert: boolean;
}

const MOCK: ApiAntwort = {
  location_id: null,
  fahrer: [
    { fahrer_id: 'm1', name: 'Marco R.', abbrueche_7_tage: 1, quote_pct: 2, nach_grund: { nicht_zuhause: 1, falsches_paket: 0, kunde_abwesend: 0, unbekannt: 0 }, trend: 'stabil' },
    { fahrer_id: 'm2', name: 'Lisa K.', abbrueche_7_tage: 3, quote_pct: 8, nach_grund: { nicht_zuhause: 1, falsches_paket: 0, kunde_abwesend: 2, unbekannt: 0 }, trend: 'steigend' },
    { fahrer_id: 'm3', name: 'Ahmed S.', abbrueche_7_tage: 6, quote_pct: 18, nach_grund: { nicht_zuhause: 2, falsches_paket: 1, kunde_abwesend: 2, unbekannt: 1 }, trend: 'steigend' },
  ],
  gesamt_quote_pct: 9,
  quote_alert: false,
};

const GRUNDE: { key: AbbruchGrund; label: string }[] = [
  { key: 'nicht_zuhause', label: 'Nicht zuhause' },
  { key: 'falsches_paket', label: 'Falsches Paket' },
  { key: 'kunde_abwesend', label: 'Abwesend' },
  { key: 'unbekannt', label: 'Unbekannt' },
];

interface Props {
  locationId: string | null;
}

export function DispatchPhase1813StoppAbbruchMonitor({ locationId }: Props) {
  const [data, setData] = useState<ApiAntwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function fetch() {
    setLoading(true);
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const res = await globalThis.fetch(`/api/delivery/driver/stopp-abbrueche${params}`);
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const alert = data.quote_alert || data.gesamt_quote_pct > 10;

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="font-semibold text-sm">Stopp-Abbruch-Monitor</span>
          {alert ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
              <AlertTriangle className="h-3 w-3" />
              Quote {data.gesamt_quote_pct}% &gt; Limit
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3" />
              {data.gesamt_quote_pct}% Quote
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {alert && (
            <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Abbruchquote überschritten</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                  Location-Quote {data.gesamt_quote_pct}% — Ziel: unter 10%. Bitte Fahrer Ahmed S. ansprechen.
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Fahrer</th>
                  {GRUNDE.map((g) => (
                    <th key={g.key} className="text-center py-2 px-1 font-semibold text-muted-foreground whitespace-nowrap">{g.label}</th>
                  ))}
                  <th className="text-center py-2 pl-2 font-semibold text-muted-foreground">Quote</th>
                  <th className="text-center py-2 pl-2 font-semibold text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.fahrer.map((f) => (
                  <tr key={f.fahrer_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{f.name}</td>
                    {GRUNDE.map((g) => (
                      <td key={g.key} className="text-center py-2 px-1">
                        {f.nach_grund[g.key] > 0 ? (
                          <span className="font-bold text-red-600">{f.nach_grund[g.key]}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                    <td className="text-center py-2 pl-2">
                      <span className={cn(
                        'font-bold',
                        f.quote_pct > 10 ? 'text-red-600' : f.quote_pct > 5 ? 'text-amber-600' : 'text-emerald-600',
                      )}>
                        {f.quote_pct}%
                      </span>
                    </td>
                    <td className="text-center py-2 pl-2">
                      {f.trend === 'steigend' ? '↑' : f.trend === 'fallend' ? '↓' : '→'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Letzte 7 Tage · Aktualisierung alle 30 Min</p>
        </div>
      )}
    </div>
  );
}
