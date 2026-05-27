'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

type Area = { id: string; name: string; beschreibung: string | null; location_id: string | null; location: any };
type Item = { id: string; area_id: string; name: string; artikelnummer: string | null; einheit: string; soll_bestand: number | null; min_bestand: number | null; lieferant: string | null; preis_pro_einheit: number | null; aktiv: boolean };

export function InventoryEditor({ areas, items, locations }: { areas: Area[]; items: Item[]; locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [localItems, setItems] = useState(items);
  const sb = createClient();

  function upd(id: string, f: keyof Item, v: any) { setItems(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r)); }

  async function saveItem(r: Item) {
    start(async () => {
      await sb.from('inventory_items').update({
        name: r.name, artikelnummer: r.artikelnummer, einheit: r.einheit,
        soll_bestand: r.soll_bestand, min_bestand: r.min_bestand,
        lieferant: r.lieferant, preis_pro_einheit: r.preis_pro_einheit,
      }).eq('id', r.id);
      router.refresh();
    });
  }
  async function addItem(areaId: string, fd: FormData) {
    start(async () => {
      await sb.from('inventory_items').insert({
        area_id: areaId,
        name: fd.get('name'),
        artikelnummer: fd.get('artikelnummer') || null,
        einheit: fd.get('einheit') || 'Stück',
        soll_bestand: fd.get('soll_bestand') ? Number(fd.get('soll_bestand')) : null,
        min_bestand: fd.get('min_bestand') ? Number(fd.get('min_bestand')) : null,
        lieferant: fd.get('lieferant') || null,
        preis_pro_einheit: fd.get('preis') ? Number(fd.get('preis')) : null,
        aktiv: true,
      });
      router.refresh();
    });
  }
  async function delItem(id: string) {
    if (!confirm('Produkt deaktivieren?')) return;
    start(async () => {
      await sb.from('inventory_items').update({ aktiv: false }).eq('id', id);
      setItems(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }
  async function addArea(fd: FormData) {
    start(async () => {
      await sb.from('inventory_areas').insert({
        name: fd.get('name'), beschreibung: fd.get('beschreibung') || null,
        location_id: fd.get('location_id') || null,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-3 font-display font-semibold">Neuen Bereich anlegen</h3>
        <form action={addArea} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1.5"><Label>Name</Label><Input name="name" placeholder="Trockenlager" required /></div>
          <div className="flex flex-col gap-1.5 md:col-span-2"><Label>Beschreibung</Label><Input name="beschreibung" /></div>
          <div className="flex flex-col gap-1.5"><Label>Standort</Label>
            <select name="location_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={pending} className="md:col-span-4 w-fit"><Plus className="h-4 w-4" /> Bereich anlegen</Button>
        </form>
      </Card>

      {areas.map(area => {
        const areaItems = localItems.filter(i => i.area_id === area.id);
        return (
          <Card key={area.id}>
            <CardHeader><CardTitle>{area.name} <span className="text-sm font-normal text-muted-foreground">— {(area.location as any)?.name}</span></CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Art.-Nr.</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">Soll</TableHead>
                  <TableHead className="text-right">Min.</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead className="text-right">Preis €</TableHead>
                  <TableHead className="w-[160px]"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {areaItems.map(r => (
                    <TableRow key={r.id}>
                      <TableCell><Input value={r.name} onChange={e => upd(r.id, 'name', e.target.value)} /></TableCell>
                      <TableCell><Input className="w-28" value={r.artikelnummer ?? ''} onChange={e => upd(r.id, 'artikelnummer', e.target.value)} /></TableCell>
                      <TableCell><Input className="w-24" value={r.einheit} onChange={e => upd(r.id, 'einheit', e.target.value)} /></TableCell>
                      <TableCell><Input className="w-24 text-right" type="number" step="0.01" value={r.soll_bestand ?? ''} onChange={e => upd(r.id, 'soll_bestand', e.target.value ? +e.target.value : null)} /></TableCell>
                      <TableCell><Input className="w-24 text-right" type="number" step="0.01" value={r.min_bestand ?? ''} onChange={e => upd(r.id, 'min_bestand', e.target.value ? +e.target.value : null)} /></TableCell>
                      <TableCell><Input className="w-36" value={r.lieferant ?? ''} onChange={e => upd(r.id, 'lieferant', e.target.value)} /></TableCell>
                      <TableCell><Input className="w-24 text-right" type="number" step="0.01" value={r.preis_pro_einheit ?? ''} onChange={e => upd(r.id, 'preis_pro_einheit', e.target.value ? +e.target.value : null)} /></TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => saveItem(r)} disabled={pending}>Speichern</Button>
                        <Button size="icon" variant="ghost" onClick={() => delItem(r.id)} disabled={pending}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={8}>
                      <form action={(fd) => addItem(area.id, fd)} className="flex flex-wrap items-end gap-2">
                        <Input name="name" placeholder="Neues Produkt" required className="w-56" />
                        <Input name="artikelnummer" placeholder="Art.-Nr." className="w-28" />
                        <Input name="einheit" placeholder="Stück" className="w-24" />
                        <Input name="soll_bestand" placeholder="Soll" type="number" className="w-20" />
                        <Input name="min_bestand" placeholder="Min" type="number" className="w-20" />
                        <Input name="lieferant" placeholder="Lieferant" className="w-36" />
                        <Input name="preis" placeholder="€/Einheit" type="number" step="0.01" className="w-24" />
                        <Button type="submit" size="sm" variant="outline" disabled={pending}><Plus className="h-4 w-4" /> Hinzufügen</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
