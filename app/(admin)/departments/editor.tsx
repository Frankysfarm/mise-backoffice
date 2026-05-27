'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

type Dep = { id: string; name: string; farbe: string | null; location_id: string | null };
type Loc = { id: string; name: string };

export function DepartmentsEditor({ departments, locations }: { departments: Dep[]; locations: Loc[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [rows, setRows] = useState(departments);

  function upd(id: string, field: keyof Dep, val: any) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: val } : r));
  }

  async function save(r: Dep) {
    start(async () => {
      await createClient().from('departments').update({ name: r.name, farbe: r.farbe, location_id: r.location_id }).eq('id', r.id);
      router.refresh();
    });
  }

  async function add(fd: FormData) {
    start(async () => {
      await createClient().from('departments').insert({
        name: fd.get('name') as string,
        farbe: (fd.get('farbe') as string) || '#2d6b45',
        location_id: (fd.get('location_id') as string) || null,
      });
      router.refresh();
    });
  }

  async function del(id: string) {
    if (!confirm('Löschen?')) return;
    start(async () => {
      await createClient().from('departments').delete().eq('id', id);
      setRows(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form action={add} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1.5"><Label>Name</Label><Input name="name" required /></div>
          <div className="flex flex-col gap-1.5"><Label>Farbe</Label><Input name="farbe" type="color" defaultValue="#2d6b45" /></div>
          <div className="flex flex-col gap-1.5">
            <Label>Standort</Label>
            <select name="location_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>&nbsp;</Label>
            <Button type="submit" disabled={isPending}><Plus className="h-4 w-4" /> Anlegen</Button>
          </div>
        </form>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Farbe</TableHead>
            <TableHead>Standort</TableHead>
            <TableHead className="w-[140px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Input value={r.name} onChange={e => upd(r.id, 'name', e.target.value)} /></TableCell>
                <TableCell><input type="color" value={r.farbe ?? '#2d6b45'} onChange={e => upd(r.id, 'farbe', e.target.value)} className="h-10 w-16 rounded border" /></TableCell>
                <TableCell>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={r.location_id ?? ''} onChange={e => upd(r.id, 'location_id', e.target.value || null)}>
                    <option value="">—</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => save(r)} disabled={isPending}>Speichern</Button>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)} disabled={isPending}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
