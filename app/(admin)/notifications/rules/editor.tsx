'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Save, Plus, Trash2 } from 'lucide-react';

type Rule = {
  id: string;
  name: string;
  event_type: string;
  bedingung: any;
  empfänger_rollen: string[];
  channels: string[];
  severity: string;
  cooldown_minuten: number;
  aktiv: boolean;
  titel_template: string | null;
  nachricht_template: string | null;
};

const EVENT_TYPES = [
  'cleaning_overdue','checkup_due','checkup_missed',
  'training_expired','training_expiring_soon',
  'document_expiring_30d','document_expiring_14d','document_expiring_3d','document_expired',
  'stamp_missing','shift_unfilled','shift_swap_requested',
  'cash_variance_exceeded','onboarding_incomplete','equipment_maintenance_due',
];
const ROLES = ['mitarbeiter','teamleiter','manager','backoffice','admin'] as const;
const CHANNELS = ['in_app','email','push'] as const;
const SEVERITIES = ['info','warnung','dringend','erfolg'] as const;

export function RulesEditor({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(rules);

  function upd(id: string, patch: Partial<Rule>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function toggleArr<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  }

  async function save(r: Rule) {
    start(async () => {
      let bed = r.bedingung;
      if (typeof bed === 'string') { try { bed = JSON.parse(bed); } catch { toastError('JSON ungültig'); return; } }
      const { error } = await createClient().from('notification_rules').update({
        name: r.name, event_type: r.event_type, bedingung: bed,
        empfänger_rollen: r.empfänger_rollen, channels: r.channels, severity: r.severity,
        cooldown_minuten: r.cooldown_minuten, aktiv: r.aktiv,
        titel_template: r.titel_template, nachricht_template: r.nachricht_template,
      }).eq('id', r.id);
      if (error) { toastError('Speichern fehlgeschlagen', error.message); return; }
      toastSuccess('Regel gespeichert', r.name);
      router.refresh();
    });
  }

  async function addRule(fd: FormData) {
    start(async () => {
      const { error } = await createClient().from('notification_rules').insert({
        name: fd.get('name'), event_type: fd.get('event_type'),
        channels: ['in_app'], severity: 'info', cooldown_minuten: 60,
        empfänger_rollen: ['manager','backoffice','admin'],
      });
      if (error) return toastError('Anlegen fehlgeschlagen', error.message);
      toastSuccess('Regel angelegt');
      router.refresh();
    });
  }

  async function del(id: string) {
    if (!confirm('Regel wirklich löschen?')) return;
    start(async () => {
      await createClient().from('notification_rules').delete().eq('id', id);
      setRows(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form action={addRule} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium">Name</label>
            <Input name="name" placeholder="Neue Regel" required />
          </div>
          <div>
            <label className="text-xs font-medium">Event</label>
            <select name="event_type" required className="h-10 rounded-md border bg-background px-3 text-sm">
              {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> Regel anlegen</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {rows.map(r => (
          <Card key={r.id} className={r.aktiv ? '' : 'opacity-60'}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Input className="w-72 font-semibold" value={r.name} onChange={e => upd(r.id, { name: e.target.value })} />
                  <Badge variant={r.severity === 'dringend' ? 'destructive' : r.severity === 'warnung' ? 'gold' : 'muted'}>
                    {r.severity}
                  </Badge>
                </CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  <select className="h-7 rounded border bg-background px-2 text-xs font-mono"
                    value={r.event_type} onChange={e => upd(r.id, { event_type: e.target.value })}>
                    {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={r.aktiv} onChange={e => upd(r.id, { aktiv: e.target.checked })} />
                    aktiv
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => save(r)} disabled={pending}>
                  <Save className="h-4 w-4" /> Speichern
                </Button>
                <Button size="icon" variant="ghost" onClick={() => del(r.id)} disabled={pending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 pt-0 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold">Empfänger-Rollen</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ROLES.map(role => {
                    const on = r.empfänger_rollen.includes(role);
                    return (
                      <button key={role} type="button"
                        onClick={() => upd(r.id, { empfänger_rollen: toggleArr(r.empfänger_rollen, role) })}
                        className={`rounded-full px-3 py-1 text-xs border ${on ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Channels</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {CHANNELS.map(ch => {
                    const on = r.channels.includes(ch);
                    return (
                      <button key={ch} type="button"
                        onClick={() => upd(r.id, { channels: toggleArr(r.channels, ch) })}
                        className={`rounded-full px-3 py-1 text-xs border ${on ? 'bg-gold text-white border-gold' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Severity</label>
                <select className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={r.severity} onChange={e => upd(r.id, { severity: e.target.value })}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Cooldown (Min.)</label>
                <Input className="mt-1" type="number" value={r.cooldown_minuten}
                  onChange={e => upd(r.id, { cooldown_minuten: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold">Titel-Template</label>
                <Input className="mt-1" value={r.titel_template ?? ''}
                  onChange={e => upd(r.id, { titel_template: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold">Nachricht-Template</label>
                <Input className="mt-1" value={r.nachricht_template ?? ''}
                  onChange={e => upd(r.id, { nachricht_template: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold">Bedingung (JSON)</label>
                <Textarea className="mt-1" rows={2}
                  value={typeof r.bedingung === 'string' ? r.bedingung : JSON.stringify(r.bedingung)}
                  onChange={e => upd(r.id, { bedingung: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
