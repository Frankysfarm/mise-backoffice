'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, TrendingUp, Users, Clock, RefreshCw, Sparkles,
  AlertTriangle, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ForecastResult, ForecastSlot } from '@/lib/delivery/forecast';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function maxOrders(slots: ForecastSlot[]): number {
  return Math.max(...slots.map((s) => s.peakOrders), 1);
}

// ── SlotBar ───────────────────────────────────────────────────────────────────

function SlotBar({ slot, max }: { slot: ForecastSlot; max: number }) {
  const pctExpected = Math.round((slot.expectedOrders / max) * 100);
  const pctPeak = Math.round((slot.peakOrders / max) * 100);
  const isPeak = slot.expectedOrders >= max * 0.75;
  const isLow = slot.dataPoints < 3;

  return (
    <div className="group relative flex flex-col items-center gap-1">
      <div className="relative flex h-24 w-full flex-col-reverse overflow-hidden rounded-t bg-zinc-100">
        <div
          className={cn(
            'w-full transition-all duration-500',
            isPeak ? 'bg-orange-500' : 'bg-blue-500',
            isLow && 'opacity-50',
          )}
          style={{ height: `${pctExpected}%` }}
        />
        {pctPeak > pctExpected && (
          <div
            className="pointer-events-none absolute w-full border-t-2 border-dashed border-zinc-400"
            style={{ bottom: `${pctPeak}%` }}
          />
        )}
      </div>

      <div className={cn(
        'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium',
        slot.recommendedTargetDrivers >= 3 ? 'bg-orange-100 text-orange-700' :
          slot.recommendedTargetDrivers >= 2 ? 'bg-blue-100 text-blue-700' :
            'bg-zinc-100 text-zinc-500',
      )}>
        <Users size={9} />
        {slot.recommendedTargetDrivers}
      </div>

      <span className="text-[10px] text-zinc-400">{slot.hourLocal}</span>

      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-36 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-2 text-xs shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
        <p className="font-semibold text-zinc-700">{slot.hourLocal} Uhr</p>
        <p className="text-zinc-500">Erwartet: <span className="font-medium text-zinc-700">{slot.expectedOrders}</span></p>
        <p className="text-zinc-500">Peak: <span className="font-medium text-zinc-700">{slot.peakOrders}</span></p>
        <p className="text-zinc-500">Fahrer: <span className="font-medium text-zinc-700">{slot.recommendedMinDrivers}–{slot.recommendedTargetDrivers}</span></p>
        {isLow && <p className="mt-0.5 text-amber-600">⚠ Wenig Verlaufsdaten</p>}
      </div>
    </div>
  );
}

// ── KiInsightsPanel ───────────────────────────────────────────────────────────

function KiInsightsPanel({ locationId }: { locationId: string }) {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const finishedRef = useRef(false);

  const startStream = useCallback(async () => {
    if (streaming) return;
    setText('');
    setError(null);
    setStreaming(true);
    finishedRef.current = false;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/delivery/admin/ai-forecast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { finishedRef.current = true; break; }
          setText((prev) => prev + payload.replace(/\\n/g, '\n'));
        }
        if (finishedRef.current) break;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setStreaming(false);
    }
  }, [locationId, streaming]);

  function renderText(raw: string) {
    return raw.split('\n').map((line, i) => {
      const cleaned = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('##')) {
        return <h3 key={i} className="mt-3 text-sm font-bold text-violet-800" dangerouslySetInnerHTML={{ __html: cleaned.replace(/^##\s*/, '') }} />;
      }
      if (/^\d+\./.test(line)) {
        return <p key={i} className="mt-2 text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: cleaned }} />;
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: cleaned }} />;
    });
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-violet-600" />
          <span className="text-sm font-semibold text-violet-800">KI-Prognose-Analyse</span>
          {streaming && (
            <span className="animate-pulse text-xs text-violet-500">● analysiert…</span>
          )}
        </div>
        <button
          onClick={() => void startStream()}
          disabled={streaming}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            streaming
              ? 'cursor-not-allowed bg-violet-200 text-violet-400'
              : 'bg-violet-600 text-white hover:bg-violet-700',
          )}
        >
          <Sparkles size={12} />
          {streaming ? 'Analysiert…' : text ? 'Neu analysieren' : 'KI analysieren'}
        </button>
      </div>

      {error && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {text ? (
        <div className="max-h-80 overflow-y-auto rounded-lg bg-white p-3 text-sm shadow-inner">
          {renderText(text)}
        </div>
      ) : !streaming ? (
        <p className="text-xs text-violet-400">
          Klicke auf &quot;KI analysieren&quot;, um eine intelligente Prognose-Auswertung zu erhalten.
        </p>
      ) : null}
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-zinc-800">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ── ForecastKiClient ──────────────────────────────────────────────────────────

export function ForecastKiClient({ locationId }: { locationId: string }) {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/delivery/admin/forecast?location_id=${locationId}&hours=12`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ForecastResult;
      setForecast(data);
      setLastUpdate(new Date());
      setCountdown(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void fetchForecast(); }, [fetchForecast]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { void fetchForecast(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [fetchForecast]);

  const peakSlot = forecast?.slots.reduce(
    (best, s) => (s.expectedOrders > best.expectedOrders ? s : best),
    forecast.slots[0],
  );

  const totalExpected = forecast?.summary.totalExpectedOrders ?? 0;
  const maxDrivers = forecast?.summary.recommendedMaxDrivers ?? 0;
  const slotMax = forecast ? maxOrders(forecast.slots) : 1;
  const goodDataCount = forecast?.slots.filter((s) => s.dataPoints >= 4).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="text-xs text-zinc-400">
          {lastUpdate
            ? `Aktualisiert ${lastUpdate.toLocaleTimeString('de-DE')} · nächste in ${countdown}s`
            : 'Laden…'}
        </span>
        <button
          onClick={() => void fetchForecast()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* KPI Summary */}
      {forecast && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<TrendingUp size={12} />}
            label="Erwartete Bestellungen"
            value={totalExpected}
            sub="nächste 12 Stunden"
          />
          <SummaryCard
            icon={<Clock size={12} />}
            label="Peak-Zeit"
            value={peakSlot?.hourLocal ?? '—'}
            sub={peakSlot ? `~${peakSlot.expectedOrders} Bestellungen erwartet` : ''}
          />
          <SummaryCard
            icon={<Users size={12} />}
            label="Max. Fahrer nötig"
            value={maxDrivers}
            sub="gleichzeitig im Peak"
          />
          <SummaryCard
            icon={<ChevronUp size={12} />}
            label="Prognose-Qualität"
            value={`${goodDataCount}/${forecast.slots.length}`}
            sub="Stunden mit ausreichend Daten"
          />
        </div>
      )}

      {/* Hourly Bar Chart */}
      {forecast && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Stundengenaue Prognose</h3>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded bg-blue-500" /> Erwartet
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded bg-orange-500" /> Spitze
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-zinc-400" /> Peak-Linie
              </span>
            </div>
          </div>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${forecast.slots.length}, 1fr)` }}
          >
            {forecast.slots.map((slot) => (
              <SlotBar key={slot.hourUtc} slot={slot} max={slotMax} />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">
            Orange = Spitzenstunde (≥75% des Peaks). Badge = Empfohlene Fahrerzahl.
            Gestrichelt = historisches Maximum.
          </p>
        </div>
      )}

      {/* KI Insights */}
      <KiInsightsPanel locationId={locationId} />

      {/* Detail-Tabelle */}
      {forecast && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="border-b border-zinc-100 bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Uhrzeit</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Erwartet</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">±Konfidenz</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Peak</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Fahrer min</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Fahrer Ziel</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Datenpunkte</th>
              </tr>
            </thead>
            <tbody>
              {forecast.slots.map((s, i) => (
                <tr
                  key={s.hourUtc}
                  className={cn(
                    'border-b border-zinc-50',
                    i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50',
                  )}
                >
                  <td className="px-3 py-1.5 font-medium text-zinc-700">{s.hourLocal}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-600">{s.expectedOrders}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">
                    ±{s.confidenceOrders - s.expectedOrders}
                  </td>
                  <td className="px-3 py-1.5 text-right text-zinc-500">{s.peakOrders}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-500">{s.recommendedMinDrivers}</td>
                  <td
                    className={cn(
                      'px-3 py-1.5 text-right font-medium',
                      s.recommendedTargetDrivers >= 3
                        ? 'text-orange-600'
                        : s.recommendedTargetDrivers >= 2
                          ? 'text-blue-600'
                          : 'text-zinc-500',
                    )}
                  >
                    {s.recommendedTargetDrivers}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1.5 text-right',
                      s.dataPoints < 3 ? 'text-amber-500' : 'text-zinc-400',
                    )}
                  >
                    {s.dataPoints}
                    {s.dataPoints < 3 && ' ⚠'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
