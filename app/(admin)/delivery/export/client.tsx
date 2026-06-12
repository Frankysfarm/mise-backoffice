'use client';

import { useState } from 'react';
import { Download, FileArchive, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  locationId: string;
}

type ExportType = 'tours' | 'shifts' | 'payouts' | 'drivers' | 'all';

const TYPE_LABELS: Record<ExportType, string> = {
  all:     'Vollständiger Export (ZIP)',
  tours:   'Touren (CSV)',
  shifts:  'Schichten (CSV)',
  payouts: 'Abrechnung (CSV)',
  drivers: 'Fahrer-Stammdaten (CSV)',
};

const TYPE_ICONS: Record<ExportType, typeof FileArchive> = {
  all:     FileArchive,
  tours:   FileText,
  shifts:  FileText,
  payouts: FileText,
  drivers: FileText,
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ExportClient({ locationId }: Props) {
  const today = isoDate(new Date());
  const thirtyDaysAgo = isoDate(new Date(Date.now() - 30 * 86_400_000));

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState<ExportType | null>(null);

  async function triggerExport(type: ExportType) {
    setLoading(type);
    try {
      const format = type === 'all' ? 'zip' : 'csv';
      const url =
        `/api/delivery/admin/export?location_id=${locationId}` +
        `&type=${type}&from=${from}&to=${to}&format=${format}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        alert('Fehler: ' + (err.error ?? res.statusText));
        return;
      }
      const blob = await res.blob();
      const ext = format === 'zip' ? 'zip' : 'csv';
      const filename = `mise-${type}-${from}-${to}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(null);
    }
  }

  const exportTypes: ExportType[] = ['all', 'tours', 'shifts', 'payouts', 'drivers'];

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-char">Datenexport</h1>
        <p className="text-sm text-steel mt-1">
          CSV und ZIP-Exporte für Touren, Schichten, Abrechnung und Fahrer-Stammdaten.
        </p>
      </div>

      {/* Zeitraum */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-char">Zeitraum</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-steel mb-1">Von</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-steel mb-1">Bis</label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
        <p className="text-xs text-stone-400">
          Zeitraum: {from} bis {to} ·{' '}
          {Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)} Tage
        </p>
      </div>

      {/* Export-Optionen */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-char">Export starten</h2>
        {exportTypes.map((type) => {
          const Icon = TYPE_ICONS[type];
          const isLoading = loading === type;
          const isZip = type === 'all';
          return (
            <button
              key={type}
              onClick={() => triggerExport(type)}
              disabled={loading !== null}
              className={`w-full flex items-center justify-between rounded-xl border px-5 py-4 text-left transition
                ${isZip
                  ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  : 'border-stone-200 bg-white hover:bg-stone-50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isZip ? 'text-emerald-600' : 'text-steel'}`} />
                <div>
                  <div className={`text-sm font-medium ${isZip ? 'text-emerald-800' : 'text-char'}`}>
                    {TYPE_LABELS[type]}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    {type === 'all'
                      ? 'Touren + Schichten + Abrechnung + Fahrer als ZIP-Archiv'
                      : type === 'tours'
                      ? 'Alle Touren mit Fahrer, Distanz, ETA, Status'
                      : type === 'shifts'
                      ? 'Geplante und abgeschlossene Schichten mit Zeiten'
                      : type === 'payouts'
                      ? 'Abrechnungsposten pro Tour und Fahrer in EUR'
                      : 'Fahrer-Stammdaten, Fahrzeug, Bewertung, Zone'}
                  </div>
                </div>
              </div>
              <div className="ml-4 flex-shrink-0">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-steel" />
                ) : (
                  <Download className={`w-4 h-4 ${isZip ? 'text-emerald-600' : 'text-steel'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-stone-400">
        Max. 10 000 Zeilen pro Tabelle · UTF-8 BOM (Excel-kompatibel) · Zeitzone UTC
      </p>
    </div>
  );
}
