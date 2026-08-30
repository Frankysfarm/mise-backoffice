'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Suggestion = {
  id: string; score: number; reason: string;
  shift: {
    id: string; start_zeit: string; end_zeit: string; position: string | null;
    department: { name: string } | { name: string }[] | null;
  } | null;
  employee: { id: string; vorname: string; nachname: string } | null;
};

export function ScheduleAssistant({ locationId, weekStart }: { locationId: string | null; weekStart: string }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    if (!locationId) { setSuggestions([]); return; }
    const response = await fetch(`/api/operations/schedule-suggestions?locationId=${locationId}&weekStart=${weekStart}`);
    const result = await response.json().catch(() => null);
    if (response.ok) setSuggestions(result?.suggestions ?? []);
  }, [locationId, weekStart]);

  React.useEffect(() => { void load(); }, [load]);

  async function mutate(payload: Record<string, string>) {
    if (!locationId) return;
    setLoading(true); setError('');
    const response = await fetch('/api/operations/schedule-suggestions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, locationId, weekStart }),
    });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) { setError(result?.error ?? 'Vorschläge konnten nicht verarbeitet werden.'); return; }
    setSuggestions(result?.suggestions ?? []);
    router.refresh();
  }

  return <Card className="mb-4 overflow-hidden border-sky-200 bg-gradient-to-r from-sky-50 to-white">
    <div className="flex flex-wrap items-start gap-3 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><Sparkles className="h-5 w-5" /></div>
      <div className="min-w-[220px] flex-1">
        <h2 className="font-semibold text-slate-900">Wochenassistent</h2>
        <p className="mt-0.5 text-xs text-slate-600">Schlägt verfügbare, passende Personen fair vor. Jede Schicht wird erst nach deiner Bestätigung zugewiesen.</p>
      </div>
      <Button size="sm" onClick={() => mutate({ action: 'generate' })} disabled={!locationId || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Vorschläge berechnen
      </Button>
    </div>
    {!locationId && <div className="border-t border-sky-100 px-4 py-3 text-xs text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> Bitte zuerst einen einzelnen Standort auswählen.</div>}
    {error && <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
    {locationId && suggestions.length > 0 && <div className="grid gap-2 border-t border-sky-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {suggestions.map((suggestion) => {
        const department = relationOne(suggestion.shift?.department ?? null);
        return <article key={suggestion.id} className="rounded-lg border bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div><strong className="text-sm text-slate-900">{suggestion.employee ? `${suggestion.employee.vorname} ${suggestion.employee.nachname}` : 'Person nicht mehr verfügbar'}</strong><div className="mt-0.5 text-[11px] text-slate-500">{suggestion.shift ? formatShift(suggestion.shift.start_zeit, suggestion.shift.end_zeit) : 'Schicht nicht mehr verfügbar'}{department?.name ? ` · ${department.name}` : ''}</div></div>
            <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-700">{suggestion.score} P.</span>
          </div>
          <p className="my-2 text-[11px] leading-5 text-slate-600">{suggestion.reason}</p>
          <Button className="w-full" size="sm" variant="secondary" disabled={loading || !suggestion.shift || !suggestion.employee} onClick={() => mutate({ action: 'confirm', suggestionId: suggestion.id })}><Check className="h-4 w-4" /> Schicht bestätigen</Button>
        </article>;
      })}
    </div>}
    {locationId && !loading && suggestions.length === 0 && <div className="border-t border-sky-100 px-4 py-3 text-xs text-slate-500">Noch keine offenen Vorschläge. Der Assistent berücksichtigt nur unbesetzte Schichten dieser Woche.</div>}
  </Card>;
}

function relationOne<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function formatShift(startValue: string, endValue: string) {
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  const start = new Intl.DateTimeFormat('de-DE', options).format(new Date(startValue));
  const end = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(endValue));
  return `${start}–${end}`;
}
