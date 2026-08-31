'use client';
import * as React from 'react';
import { Bell, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function PlanningControls({ locationId, weekStart, templates, initialStatus, initialDeadline }: { locationId: string | null; weekStart: string; templates: { id: string; name: string }[]; initialStatus?: string | null; initialDeadline?: string | null }) {
  const [busy, setBusy] = React.useState('');
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '');
  const [deadline, setDeadline] = React.useState(() => initialDeadline ? berlinLocalInput(initialDeadline) : '');
  async function run(action: 'open' | 'apply' | 'remind' | 'publish') {
    if (!locationId) return;
    setBusy(action);
    const response = await fetch('/api/scheduling/planner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, locationId, weekStart, ...(['open', 'apply'].includes(action) ? { deadline: deadline ? berlinWallClockToIso(deadline) : null } : {}), ...(action === 'apply' ? { templateId } : {}) }) });
    const result = await response.json().catch(() => null); setBusy('');
    if (!response.ok) return toastError('Aktion fehlgeschlagen', result?.error ?? 'Bitte erneut versuchen.');
    toastSuccess(action === 'open' ? 'Planungsrunde geöffnet' : action === 'apply' ? 'Woche vorbereitet' : action === 'remind' ? 'Erinnerungen eingeplant' : 'Dienstplan veröffentlicht', result?.message ?? (action === 'publish' ? `${result?.notified ?? 0} Personen wurden benachrichtigt.` : undefined));
    window.location.reload();
  }
  return <Card className="mb-4 p-4"><div className="flex flex-wrap items-end gap-3">
    <div className="min-w-[220px] flex-1"><div className="text-sm font-semibold">Planungsrunde</div><p className="text-xs text-muted-foreground">Vorlage anwenden, Verfügbarkeiten einsammeln und erst danach verbindlich veröffentlichen.</p></div>
    <label className="grid gap-1 text-xs">Vorlage<select className="h-9 rounded-md border bg-background px-2" value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Vorlage wählen</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label className="grid gap-1 text-xs">Eintragungsfrist<input className="h-9 rounded-md border bg-background px-2" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
    <Button variant="outline" disabled={!locationId || !deadline || !!busy} onClick={() => run('open')}>{busy === 'open' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Woche manuell öffnen</Button>
    <Button variant="outline" disabled={!locationId || !templateId || !!busy} onClick={() => run('apply')}>{busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Vorlage anwenden</Button>
    <Button variant="outline" disabled={!locationId || !initialStatus || !!busy} onClick={() => run('remind')}><Bell className="h-4 w-4" /> Verfügbarkeit anfragen</Button>
    <Button disabled={!locationId || !initialStatus || initialStatus === 'published' || !!busy} onClick={() => run('publish')}><Send className="h-4 w-4" /> {initialStatus === 'published' ? 'Veröffentlicht' : 'Dienstplan veröffentlichen'}</Button>
  </div></Card>;
}

function berlinLocalInput(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function berlinWallClockToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Ungültige Eintragungsfrist');
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let instant = new Date(desired);
  for (let pass = 0; pass < 2; pass++) {
    const rendered = berlinLocalInput(instant.toISOString());
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(rendered)!;
    const renderedAsUtc = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]));
    instant = new Date(instant.getTime() + desired - renderedAsUtc);
  }
  return instant.toISOString();
}
