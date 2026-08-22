'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

type Badge = { id: string; name: string; beschreibung: string | null; icon: string | null; farbe: string | null; punkte: number; bedingung: any };

export function BadgesEditor({ badges }: { badges: Badge[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [rows, setRows] = useState(badges);

  function upd(id: string, f: keyof Badge, v: any) { setRows(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r)); }

  async function save(r: Badge) {
    start(async () => {
      let bedingung = r.bedingung;
      if (typeof bedingung === 'string') { try { bedingung = JSON.parse(bedingung); } catch { alert('JSON ungültig'); return; } }
      await createClient().from('badges').update({
        name: r.name, beschreibung: r.beschreibung, icon: r.icon, farbe: r.farbe, punkte: r.punkte, bedingung,
      }).eq('id', r.id);
      router.refresh();
    });
  }

  async function add(fd: FormData) {
    start(async () => {
      let bedingung: any = null;
      const bed = fd.get('bedingung') as string;
      if (bed) { try { bedingung = JSON.parse(bed); } catch { alert('Bedingung JSON ungültig'); return; } }
      await createClient().from('badges').insert({
        name: fd.get('name') as string,
        beschreibung: fd.get('beschreibung') as string || null,
        icon: fd.get('icon') as string || null,
        farbe: fd.get('farbe') as string || '#2d6b45',
        punkte: fd.get('punkte') ? Number(fd.get('punkte')) : 0,
        bedingung,
      });
      router.refresh();
    });
  }

  async function del(id: string) {
    if (!confirm('Badge löschen?')) return;
    start(async () => {
      await createClient().from('badges').delete().eq('id', id);
      setRows(rs => rs.filter(r => r.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form action={add} className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="flex flex-col gap-1.5 md:col-span-1"><Label>Icon</Label><Input name="icon" placeholder="🍵" /></div>
          <div className="flex flex-col gap-1.5 md:col-span-2"><Label>Name</Label><Input name="name" required /></div>
          <div className="flex flex-col gap-1.5 md:col-span-2"><Label>Beschreibung</Label><Input name="beschreibung" /></div>
          <div className="flex flex-col gap-1.5"><Label>Punkte</Label><Input name="punkte" type="number" defaultValue="50" /></div>
          <div className="flex flex-col gap-1.5 md:col-span-5"><Label>Bedingung (JSON)</Label>
            <Textarea name="bedingung" rows={2} placeholder='{"type":"checkup_streak","days":30}' />
          </div>
          <div className="flex flex-col gap-1.5"><Label>&nbsp;</Label><Button type="submit" disabled={isPending}><Plus className="h-4 w-4" /> Anlegen</Button></div>
        </form>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-[60px]">Icon</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Beschreibung</TableHead>
            <TableHead className="w-[80px] text-right">Punkte</TableHead>
            <TableHead>Bedingung</TableHead>
            <TableHead className="w-[140px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Input className="w-16 text-center" value={r.icon ?? ''} onChange={e => upd(r.id, 'icon', e.target.value)} /></TableCell>
                <TableCell><Input value={r.name} onChange={e => upd(r.id, 'name', e.target.value)} /></TableCell>
                <TableCell><Input value={r.beschreibung ?? ''} onChange={e => upd(r.id, 'beschreibung', e.target.value)} /></TableCell>
                <TableCell><Input className="w-20 text-right" type="number" value={r.punkte} onChange={e => upd(r.id, 'punkte', +e.target.value)} /></TableCell>
                <TableCell>
                  <Textarea className="min-h-[60px]" rows={2}
                    value={typeof r.bedingung === 'string' ? r.bedingung : JSON.stringify(r.bedingung)}
                    onChange={e => upd(r.id, 'bedingung', e.target.value)} />
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
