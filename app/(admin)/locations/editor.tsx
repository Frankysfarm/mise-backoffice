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

type Loc = {
  id: string; name: string; adresse: string | null; stadt: string | null; plz: string | null;
  telefon: string | null; lat: number | null; lng: number | null; geofence_radius_m: number | null; aktiv: boolean;
};

export function LocationsEditor({ locations }: { locations: Loc[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [rows, setRows] = useState(locations);
  const [msg, setMsg] = useState<string | null>(null);

  function upd(id: string, field: keyof Loc, val: any) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: val } : r));
  }

  async function save(row: Loc) {
    start(async () => {
      const { error } = await createClient().from('locations').update({
        name: row.name, adresse: row.adresse, stadt: row.stadt, plz: row.plz,
        telefon: row.telefon, lat: row.lat, lng: row.lng, geofence_radius_m: row.geofence_radius_m, aktiv: row.aktiv,
      }).eq('id', row.id);
      setMsg(error ? `Fehler: ${error.message}` : 'Gespeichert ✓');
      router.refresh();
    });
  }

  async function addNew(fd: FormData) {
    start(async () => {
      const { error } = await createClient().from('locations').insert({
        name: fd.get('name') as string,
        stadt: fd.get('stadt') as string || null,
        plz: fd.get('plz') as string || null,
        adresse: fd.get('adresse') as string || null,
        lat: fd.get('lat') ? Number(fd.get('lat')) : null,
        lng: fd.get('lng') ? Number(fd.get('lng')) : null,
        geofence_radius_m: fd.get('radius') ? Number(fd.get('radius')) : 200,
        aktiv: true,
      });
      if (error) setMsg(`Fehler: ${error.message}`);
      else { setMsg('Neuer Standort angelegt ✓'); router.refresh(); }
    });
  }

  async function del(id: string) {
    if (!confirm('Standort wirklich löschen?')) return;
    start(async () => {
      const { error } = await createClient().from('locations').delete().eq('id', id);
      if (error) setMsg(`Fehler: ${error.message}`);
      else { setRows(rs => rs.filter(r => r.id !== id)); router.refresh(); }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-7" action={addNew}>
          <LabeledInput label="Name" name="name" required />
          <LabeledInput label="Stadt" name="stadt" />
          <LabeledInput label="PLZ" name="plz" />
          <LabeledInput label="Adresse" name="adresse" />
          <LabeledInput label="Lat" name="lat" type="number" step="0.000001" />
          <LabeledInput label="Lng" name="lng" type="number" step="0.000001" />
          <div className="flex flex-col gap-1.5">
            <Label>&nbsp;</Label>
            <Button type="submit" disabled={isPending}><Plus className="h-4 w-4" /> Anlegen</Button>
          </div>
        </form>
        {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead className="text-right">Radius (m)</TableHead>
              <TableHead>Aktiv</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Input value={r.name} onChange={e => upd(r.id, 'name', e.target.value)} /></TableCell>
                <TableCell className="space-y-1">
                  <Input placeholder="Straße" value={r.adresse ?? ''} onChange={e => upd(r.id, 'adresse', e.target.value)} />
                  <div className="flex gap-1">
                    <Input className="w-20" placeholder="PLZ" value={r.plz ?? ''} onChange={e => upd(r.id, 'plz', e.target.value)} />
                    <Input placeholder="Stadt" value={r.stadt ?? ''} onChange={e => upd(r.id, 'stadt', e.target.value)} />
                  </div>
                </TableCell>
                <TableCell>
                  <Input className="w-28 mb-1" placeholder="lat" type="number" step="0.000001" value={r.lat ?? ''} onChange={e => upd(r.id, 'lat', e.target.value ? +e.target.value : null)} />
                  <Input className="w-28" placeholder="lng" type="number" step="0.000001" value={r.lng ?? ''} onChange={e => upd(r.id, 'lng', e.target.value ? +e.target.value : null)} />
                </TableCell>
                <TableCell className="text-right">
                  <Input className="w-24" type="number" value={r.geofence_radius_m ?? 200} onChange={e => upd(r.id, 'geofence_radius_m', +e.target.value)} />
                </TableCell>
                <TableCell>
                  <input type="checkbox" checked={r.aktiv} onChange={e => upd(r.id, 'aktiv', e.target.checked)} />
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

function LabeledInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="flex flex-col gap-1.5"><Label>{label}</Label><Input {...props} /></div>;
}
