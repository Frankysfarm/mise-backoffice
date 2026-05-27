'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Plus, Trash2 } from 'lucide-react';

type Supplier = {
  id: string; name: string; kontakt_name: string | null; email: string | null;
  telefon: string | null; mindestbestellwert: number | null; lieferzeit_tage: number | null;
  zahlungsziel_tage: number | null; kundennummer: string | null; aktiv: boolean;
};

export function SuppliersEditor({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(suppliers);

  function upd(id: string, patch: Partial<Supplier>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function save(r: Supplier) {
    start(async () => {
      const { error } = await createClient().from('suppliers').update({
        name: r.name, kontakt_name: r.kontakt_name, email: r.email, telefon: r.telefon,
        mindestbestellwert: r.mindestbestellwert, lieferzeit_tage: r.lieferzeit_tage,
        zahlungsziel_tage: r.zahlungsziel_tage, kundennummer: r.kundennummer, aktiv: r.aktiv,
      } as any).eq('id', r.id);
      if (error) return toastError('Speichern fehlgeschlagen', error.message);
      toastSuccess('Gespeichert', r.name);
      router.refresh();
    });
  }

  async function add(fd: FormData) {
    start(async () => {
      const { error } = await createClient().from('suppliers').insert({
        name: fd.get('name'), email: fd.get('email') || null,
        telefon: fd.get('telefon') || null, kontakt_name: fd.get('kontakt') || null,
        aktiv: true,
      } as any);
      if (error) return toastError('Anlegen fehlgeschlagen', error.message);
      toastSuccess('Lieferant angelegt');
      router.refresh();
    });
  }

  async function del(id: string) {
    if (!confirm('Lieferant löschen?')) return;
    start(async () => {
      await createClient().from('suppliers').delete().eq('id', id);
      setRows(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form action={add} className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2"><Label>Name</Label><Input name="name" required placeholder="Oatly" /></div>
          <div><Label>Kontaktperson</Label><Input name="kontakt" /></div>
          <div><Label>E-Mail</Label><Input name="email" type="email" /></div>
          <div className="flex items-end"><Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> Anlegen</Button></div>
        </form>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead className="text-right">Min.-Bestell. €</TableHead>
            <TableHead className="text-right">Lieferzeit (T)</TableHead>
            <TableHead className="text-right">Zahlungsziel (T)</TableHead>
            <TableHead>Kd.-Nr.</TableHead>
            <TableHead>Aktiv</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Input className="w-40" value={r.name} onChange={e => upd(r.id, { name: e.target.value })} /></TableCell>
                <TableCell><Input className="w-32" value={r.kontakt_name ?? ''} onChange={e => upd(r.id, { kontakt_name: e.target.value })} /></TableCell>
                <TableCell><Input className="w-40" value={r.email ?? ''} onChange={e => upd(r.id, { email: e.target.value })} /></TableCell>
                <TableCell><Input className="w-32" value={r.telefon ?? ''} onChange={e => upd(r.id, { telefon: e.target.value })} /></TableCell>
                <TableCell><Input className="w-24 text-right" type="number" step="0.01" value={r.mindestbestellwert ?? ''} onChange={e => upd(r.id, { mindestbestellwert: e.target.value ? +e.target.value : null })} /></TableCell>
                <TableCell><Input className="w-20 text-right" type="number" value={r.lieferzeit_tage ?? ''} onChange={e => upd(r.id, { lieferzeit_tage: e.target.value ? +e.target.value : null })} /></TableCell>
                <TableCell><Input className="w-20 text-right" type="number" value={r.zahlungsziel_tage ?? ''} onChange={e => upd(r.id, { zahlungsziel_tage: e.target.value ? +e.target.value : null })} /></TableCell>
                <TableCell><Input className="w-28" value={r.kundennummer ?? ''} onChange={e => upd(r.id, { kundennummer: e.target.value })} /></TableCell>
                <TableCell><input type="checkbox" checked={r.aktiv} onChange={e => upd(r.id, { aktiv: e.target.checked })} /></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => save(r)} disabled={pending}>Speichern</Button>
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
