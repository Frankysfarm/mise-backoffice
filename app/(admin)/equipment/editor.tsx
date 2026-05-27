'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { dateDE } from '@/lib/utils';

type Eq = {
  id: string; name: string; seriennummer: string | null; kategorie: string | null;
  hersteller: string | null; anschaffungsdatum: string | null; garantie_bis: string | null;
  wartungsintervall_tage: number | null; status: string; location_id: string | null;
};

export function EquipmentEditor({ equipment, locations }: { equipment: Eq[]; locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(equipment);
  const [pending, start] = useTransition();

  function upd(id: string, f: keyof Eq, v: any) { setRows(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r)); }

  async function save(r: Eq) {
    start(async () => {
      await createClient().from('equipment').update({
        name: r.name, seriennummer: r.seriennummer, kategorie: r.kategorie,
        hersteller: r.hersteller, anschaffungsdatum: r.anschaffungsdatum, garantie_bis: r.garantie_bis,
        wartungsintervall_tage: r.wartungsintervall_tage, status: r.status, location_id: r.location_id,
      }).eq('id', r.id);
      router.refresh();
    });
  }
  async function add(fd: FormData) {
    start(async () => {
      await createClient().from('equipment').insert({
        name: fd.get('name'),
        kategorie: fd.get('kategorie') || null,
        hersteller: fd.get('hersteller') || null,
        seriennummer: fd.get('seriennummer') || null,
        wartungsintervall_tage: fd.get('intervall') ? Number(fd.get('intervall')) : 90,
        status: 'aktiv',
        location_id: fd.get('location_id') || null,
      });
      router.refresh();
    });
  }
  async function del(id: string) {
    if (!confirm('Gerät löschen?')) return;
    start(async () => {
      await createClient().from('equipment').delete().eq('id', id);
      setRows(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form action={add} className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2 flex flex-col gap-1.5"><Label>Name</Label><Input name="name" required /></div>
          <div className="flex flex-col gap-1.5"><Label>Kategorie</Label><Input name="kategorie" /></div>
          <div className="flex flex-col gap-1.5"><Label>Hersteller</Label><Input name="hersteller" /></div>
          <div className="flex flex-col gap-1.5"><Label>Wartung (Tage)</Label><Input name="intervall" type="number" defaultValue={90} /></div>
          <div className="flex flex-col gap-1.5"><Label>Standort</Label>
            <select name="location_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Serien-Nr.</Label><Input name="seriennummer" /></div>
          <Button type="submit" disabled={pending} className="md:col-span-6 w-fit"><Plus className="h-4 w-4" /> Gerät anlegen</Button>
        </form>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Hersteller</TableHead>
            <TableHead>Serien-Nr.</TableHead>
            <TableHead className="text-right">Wartung (Tage)</TableHead>
            <TableHead>Garantie bis</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[200px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Input value={r.name} onChange={e => upd(r.id, 'name', e.target.value)} /></TableCell>
                <TableCell><Input className="w-40" value={r.kategorie ?? ''} onChange={e => upd(r.id, 'kategorie', e.target.value)} /></TableCell>
                <TableCell><Input className="w-36" value={r.hersteller ?? ''} onChange={e => upd(r.id, 'hersteller', e.target.value)} /></TableCell>
                <TableCell><Input className="w-32 font-mono text-xs" value={r.seriennummer ?? ''} onChange={e => upd(r.id, 'seriennummer', e.target.value)} /></TableCell>
                <TableCell><Input className="w-24 text-right" type="number" value={r.wartungsintervall_tage ?? ''} onChange={e => upd(r.id, 'wartungsintervall_tage', e.target.value ? +e.target.value : null)} /></TableCell>
                <TableCell className="text-sm">{dateDE(r.garantie_bis)}</TableCell>
                <TableCell><Badge variant={r.status === 'aktiv' ? 'secondary' : 'muted'}>{r.status}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => save(r)} disabled={pending}>Speichern</Button>
                  <Link href={`/equipment/${r.id}`}><Button size="sm" variant="outline">Logs</Button></Link>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)} disabled={pending}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
