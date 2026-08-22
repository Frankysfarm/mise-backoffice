'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const KATEGORIEN = [
  { key: 'punktlichkeit',    label: 'Pünktlichkeit' },
  { key: 'arbeitsqualitaet', label: 'Arbeitsqualität' },
  { key: 'kundenumgang',     label: 'Umgang mit Gästen' },
  { key: 'teamwork',         label: 'Teamwork' },
  { key: 'lernbereitschaft', label: 'Lernbereitschaft' },
] as const;

const DECISIONS = [
  { value: 'einstellen',  label: 'Einstellen ✓', color: 'bg-matcha-700 hover:bg-matcha-800 text-white' },
  { value: 'verlaengern', label: 'Probe verlängern', color: 'bg-gold hover:bg-gold/80 text-white' },
  { value: 'ablehnen',    label: 'Nicht einstellen', color: 'bg-destructive hover:bg-destructive/80 text-white' },
] as const;

type Decision = typeof DECISIONS[number]['value'];

export function ProbeReview({ employeeId, probeShifts, existingReview, employeeStatus = 'in_probe', disabled = false }: {
  employeeId: string;
  probeShifts: { id: string; start_zeit: string; end_zeit: string }[];
  existingReview: any | null;
  employeeStatus?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const k = existingReview?.kategorien ?? {};
    return Object.fromEntries(KATEGORIEN.map(c => [c.key, k[c.key] ?? 0]));
  });
  const [decision, setDecision] = useState<Decision | ''>(existingReview?.kategorien?.entscheidung ?? '');
  const [staerken, setStaerken] = useState(existingReview?.stärken ?? '');
  const [entwicklung, setEntwicklung] = useState(existingReview?.entwicklungsfelder ?? '');
  const [kommentar, setKommentar] = useState(existingReview?.kommentar_mitarbeiter ?? '');

  if (employeeStatus !== 'in_probe') {
    const decision = existingReview?.kategorien?.entscheidung;
    const decisionLabel = decision === 'einstellen' ? 'Eingestellt' : decision === 'ablehnen' ? 'Nicht eingestellt' : 'Abgeschlossen';
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Probearbeit abgeschlossen</div>
          <div className="mt-2 text-lg font-semibold">{decisionLabel}</div>
          <p className="mt-1 text-sm text-muted-foreground">Die abgeschlossene Entscheidung kann im Bewerberbereich eingesehen, aber nicht nachträglich überschrieben werden.</p>
        </CardContent>
      </Card>
    );
  }

  async function save() {
    if (!decision) { toastError('Entscheidung fehlt'); return; }
    if (KATEGORIEN.some((category) => !scores[category.key])) {
      toastError('Bewertung unvollständig', 'Bitte alle fünf Kriterien mit 1 bis 5 Sternen bewerten.');
      return;
    }
    start(async () => {
      const response = await fetch(`/api/applications/${employeeId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores, decision, staerken, entwicklung, kommentar }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toastError('Bewertung konnte nicht gespeichert werden', data?.error ?? `Fehler ${response.status}`);
        return;
      }

      toastSuccess('Bericht gespeichert',
        decision === 'einstellen' ? 'Die Person ist eingestellt und startet die Einarbeitung.'
        : decision === 'ablehnen' ? 'Die Bewerbung wurde ins Archiv verschoben.'
        : 'Die Probearbeit wurde verlängert.');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Probeschichten</div>
          {probeShifts.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Keine Probeschichten geplant. Lege welche unter „Dienstplan" an (Typ: 🎓 Probeschicht).</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {probeShifts.map((s, i) => (
                <li key={s.id} className="flex justify-between rounded border bg-muted/30 px-3 py-1.5">
                  <span>Tag {probeShifts.length - i}: {new Date(s.start_zeit).toLocaleDateString('de-DE')}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.start_zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}–
                    {new Date(s.end_zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bewertung</div>
          <div className="mt-2 space-y-3">
            {KATEGORIEN.map(k => (
              <div key={k.key} className="flex items-center justify-between rounded-md border bg-card p-3">
                <span className="text-sm font-medium">{k.label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setScores({ ...scores, [k.key]: n })}
                      aria-label={`${k.label}: ${n} Sterne`}
                      aria-pressed={n === (scores[k.key] ?? 0)}
                      disabled={disabled}
                      className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                      <Star
                        className={cn('h-6 w-6 transition',
                          n <= (scores[k.key] ?? 0) ? 'fill-gold text-gold' : 'text-muted-foreground hover:text-gold')} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Stärken</Label>
            <Textarea rows={3} className="font-sans" value={staerken} onChange={e => setStaerken(e.target.value)}
              placeholder="Was lief besonders gut?" />
          </div>
          <div><Label>Entwicklungsfelder</Label>
            <Textarea rows={3} className="font-sans" value={entwicklung} onChange={e => setEntwicklung(e.target.value)}
              placeholder="Woran sollte noch gearbeitet werden?" />
          </div>
          <div className="md:col-span-2"><Label>Kommentar vom Mitarbeiter (optional)</Label>
            <Textarea rows={2} className="font-sans" value={kommentar} onChange={e => setKommentar(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entscheidung</div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            {DECISIONS.map(d => (
              <button key={d.value} type="button"
                onClick={() => setDecision(d.value)}
                disabled={disabled}
                className={cn(
                  'rounded-lg border-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  decision === d.value ? d.color + ' border-transparent' : 'bg-card hover:bg-muted border-border',
                )}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={pending || !decision || disabled} size="lg" className="w-full">
          {pending ? 'Speichere…' : 'Bewertung abschließen'}
        </Button>
      </CardContent>
    </Card>
  );
}
