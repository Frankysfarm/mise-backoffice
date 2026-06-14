'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarPlus, CheckCircle2, XCircle, RefreshCw, Clock,
  Users, TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface ShiftSuggestion {
  id: string;
  suggestionDate: string;
  startHour: number;
  endHour: number;
  driversNeeded: number;
  driversScheduled: number;
  coverageGap: number;
  expectedOrders: number;
  confidence: number;
  status: 'pending' | 'accepted' | 'ignored' | 'applied';
  generatedBy: string;
  acceptedAt: string | null;
  notes: string | null;
  createdAt: string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function confidenceColor(c: number): string {
  if (c >= 70) return 'text-emerald-600';
  if (c >= 50) return 'text-amber-500';
  return 'text-red-500';
}

function gapColor(gap: number): string {
  if (gap >= 3) return 'text-red-600 bg-red-50';
  if (gap === 2) return 'text-orange-600 bg-orange-50';
  return 'text-yellow-700 bg-yellow-50';
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function ShiftSuggestionsClient({ locationId }: { locationId: string }) {
  const [suggestions, setSuggestions] = useState<ShiftSuggestion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [filter, setFilter]           = useState<'pending' | 'accepted' | 'all'>('pending');
  const [actionId, setActionId]       = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/shift-suggestions?status=${status}`);
      const d   = await res.json();
      setSuggestions((d.suggestions as ShiftSuggestion[]) ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  async function generate() {
    setGenerating(true);
    try {
      await fetch('/api/delivery/admin/shift-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      await load(filter);
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(id: string, status: 'accepted' | 'ignored') {
    setActionId(id);
    try {
      await fetch('/api/delivery/admin/shift-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== id || filter === 'all'));
      await load(filter);
    } finally {
      setActionId(null);
    }
  }

  // Gruppierung nach Datum
  const byDate = suggestions.reduce<Map<string, ShiftSuggestion[]>>((m, s) => {
    const list = m.get(s.suggestionDate) ?? [];
    list.push(s);
    m.set(s.suggestionDate, list);
    return m;
  }, new Map());

  const pendingCount   = suggestions.filter((s) => s.status === 'pending').length;
  const acceptedCount  = suggestions.filter((s) => s.status === 'accepted').length;
  const totalGap       = suggestions.reduce((s, x) => s + x.coverageGap, 0);
  const avgConfidence  = suggestions.length
    ? Math.round(suggestions.reduce((s, x) => s + x.confidence, 0) / suggestions.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Offene Vorschläge</div>
          <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Angenommen</div>
          <div className="text-2xl font-bold text-emerald-600">{acceptedCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Gesamt-Lücke (Fahr.)</div>
          <div className="text-2xl font-bold text-red-600">{totalGap}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 mb-1">Ø Konfidenz</div>
          <div className={cn('text-2xl font-bold', confidenceColor(avgConfidence))}>
            {avgConfidence}%
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden">
          {(['pending', 'accepted', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {f === 'pending' ? 'Offen' : f === 'accepted' ? 'Angenommen' : 'Alle'}
            </button>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
          {generating ? 'Generiere…' : 'Neu generieren'}
        </button>

        <button
          onClick={() => void load(filter)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Aktualisieren
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto bg-blue-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-3 w-3 text-blue-500" />
          Vorschläge werden täglich automatisch um 05:00 UTC generiert
        </div>
      </div>

      {/* Vorschläge-Liste */}
      {loading ? (
        <div className="text-center text-gray-500 py-16">Lade Vorschläge…</div>
      ) : byDate.size === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <CalendarPlus className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Keine Vorschläge vorhanden</p>
          <p className="text-sm text-gray-400 mt-1">
            Klicke auf "Neu generieren" um Vorschläge zu erstellen
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byDate.entries()).map(([date, slots]) => {
            const isExpanded = expandedDate === date || byDate.size === 1;
            const dateGap    = slots.reduce((s, x) => s + x.coverageGap, 0);

            return (
              <div key={date} className="bg-white rounded-xl border overflow-hidden">
                {/* Datums-Header */}
                <button
                  onClick={() => setExpandedDate(isExpanded && byDate.size > 1 ? null : date)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">{fmtDate(date)}</span>
                    <span className="text-xs text-gray-500">{slots.length} Zeitblock{slots.length !== 1 ? 'e' : ''}</span>
                    {dateGap > 0 && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        {dateGap} Fahrer-Lücke{dateGap !== 1 ? 'n' : ''}
                      </span>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-gray-400" />
                    : <ChevronDown className="h-4 w-4 text-gray-400" />
                  }
                </button>

                {/* Slots */}
                {isExpanded && (
                  <div className="border-t divide-y">
                    {slots.map((s) => (
                      <div key={s.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Zeit + Lücke */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-1 text-sm font-mono text-gray-700">
                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                {fmtHour(s.startHour)} – {fmtHour(s.endHour)} Uhr
                              </div>
                              <span className={cn(
                                'text-xs font-semibold px-2 py-0.5 rounded-full',
                                gapColor(s.coverageGap),
                              )}>
                                -{s.coverageGap} Fahrer
                              </span>
                              {s.status !== 'pending' && (
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full font-medium',
                                  s.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                                )}>
                                  {s.status === 'accepted' ? 'Angenommen' : 'Ignoriert'}
                                </span>
                              )}
                            </div>

                            {/* KPIs */}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Benötigt: <strong className="text-gray-700">{s.driversNeeded}</strong>
                                &nbsp;/ Geplant: <strong className="text-gray-700">{s.driversScheduled}</strong>
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                ~{s.expectedOrders} Bestellungen erwartet
                              </span>
                              <span className={cn('font-medium', confidenceColor(s.confidence))}>
                                {s.confidence}% Konfidenz
                              </span>
                            </div>
                          </div>

                          {/* Aktions-Buttons */}
                          {s.status === 'pending' && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => void updateStatus(s.id, 'accepted')}
                                disabled={actionId === s.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Annehmen
                              </button>
                              <button
                                onClick={() => void updateStatus(s.id, 'ignored')}
                                disabled={actionId === s.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Ignorieren
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
