'use client';
import * as React from 'react';
import { Bell, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function PlanningControls({ locationId, weekStart, templates, initialStatus, initialDeadline }: { locationId: string | null; weekStart: string; templates: { id: string; name: string }[]; initialStatus?: string | null; initialDeadline?: string | null }) {
  const [busy, setBusy] = React.useState('');
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '');
  const [deadline, setDeadline] = React.useState(initialDeadline?.slice(0, 16) ?? '');
  async function run(action: 'apply' | 'remind' | 'publish') {
    if (!locationId) return;
    setBusy(action);
    const response = await fetch('/api/scheduling/planner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, locationId, weekStart, ...(action === 'apply' ? { templateId, deadline: deadline ? new Date(deadline).toISOString() : null } : {}) }) });
    const result = await response.json().catch(() => null); setBusy('');
    if (!response.ok) return toastError('Aktion fehlgeschlagen', result?.error ?? 'Bitte erneut versuchen.');
    toastSuccess(action === 'apply' ? 'Woche vorbereitet' : action === 'remind' ? 'Erinnerungen eingeplant' : 'Dienstplan veröffentlicht', result?.message ?? (action === 'publish' ? `${result?.notified ?? 0} Schichten wurden mitgeteilt.` : undefined));
    window.location.reload();
  }
  return <Card className="mb-4 p-4"><div className="flex flex-wrap items-end gap-3">
    <div className="min-w-[220px] flex-1"><div className="text-sm font-semibold">Planungsrunde</div><p className="text-xs text-muted-foreground">Vorlage anwenden, Verfügbarkeiten einsammeln und erst danach verbindlich veröffentlichen.</p></div>
    <label className="grid gap-1 text-xs">Vorlage<select className="h-9 rounded-md border bg-background px-2" value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Vorlage wählen</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label className="grid gap-1 text-xs">Eintragungsfrist<input className="h-9 rounded-md border bg-background px-2" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
    <Button variant="outline" disabled={!locationId || !templateId || !!busy} onClick={() => run('apply')}>{busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Vorlage anwenden</Button>
    <Button variant="outline" disabled={!locationId || !initialStatus || !!busy} onClick={() => run('remind')}><Bell className="h-4 w-4" /> Verfügbarkeit anfragen</Button>
    <Button disabled={!locationId || !initialStatus || initialStatus === 'published' || !!busy} onClick={() => run('publish')}><Send className="h-4 w-4" /> {initialStatus === 'published' ? 'Veröffentlicht' : 'Dienstplan veröffentlichen'}</Button>
  </div></Card>;
}
