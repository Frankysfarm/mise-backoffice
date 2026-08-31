'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { emptyStep, normalizeProcedureContent, procedureContentSchema, reorder, type ProcedureStep } from '@/lib/ablaeufe/schema';

const TYPES = [['opening','Öffnung'],['closing','Schließung'],['cleaning','Reinigung'],['control','Kontrolle'],['production','Produktion'],['handover','Übergabe'],['hygiene_temperature','Hygiene / Temperatur'],['other','Sonstiges']] as const;
const EVIDENCE = [['none','Kein Nachweis'],['photo','Foto'],['confirmation','Bestätigung'],['value','Messwert']] as const;

export function GuideEditor({ guide, departments, locations }: { guide: any; departments: { id: string; name: string }[]; locations: { id: string; name: string }[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState('');
  const initial = useMemo(() => normalizeProcedureContent(guide.inhalt), [guide.inhalt]);
  const [form, setForm] = useState({ title: guide.titel ?? '', type: guide.ablauf_typ ?? (guide.phase === 'closing' ? 'closing' : 'opening'), position: guide.position_typ ?? '', departmentId: guide.department_id ?? '', locationId: guide.location_id ?? '', shiftHint: guide.shift_hint ?? '', active: guide.aktiv !== false, content: initial });
  const steps = form.content.categories[0]?.steps ?? [];
  const updateSteps = (next: ProcedureStep[]) => setForm(current => ({ ...current, content: { ...current.content, categories: [{ ...current.content.categories[0], steps: next }] } }));
  const patchStep = (index: number, patch: Partial<ProcedureStep>) => updateSteps(steps.map((step, i) => i === index ? { ...step, ...patch } : step));
  async function save(action: 'save' | 'duplicate') {
    setMessage(''); const validation = procedureContentSchema.safeParse(form.content);
    if (!validation.success || !steps.length) { setMessage(validation.error?.issues[0]?.message ?? 'Bitte mindestens einen Schritt anlegen.'); return; }
    startTransition(async () => { const response = await fetch(`/api/ablaeufe/guides/${guide.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, departmentId: form.departmentId || null, locationId: form.locationId || null, action }) }); const result = await response.json(); if (!response.ok) return setMessage(result.error ?? 'Speichern fehlgeschlagen.'); setMessage(action === 'duplicate' ? 'Kopie wurde angelegt.' : 'Ablauf wurde gespeichert.'); if (action === 'duplicate') router.push(`/neo/app/ablaeufe/schichtleitfaeden/${result.id}`); else router.refresh(); });
  }
  return <div className="space-y-5">
    <Card><CardContent className="grid gap-4 p-5 md:grid-cols-3">
      <Field label="Name des Ablaufs"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="z. B. Barista – Öffnung" /></Field>
      <Field label="Art"><Select value={form.type} onChange={value => setForm({ ...form, type: value })} options={TYPES} /></Field>
      <Field label="Standort"><Select value={form.locationId} onChange={value => setForm({ ...form, locationId: value })} options={locations.map(l => [l.id,l.name] as const)} empty="Standort wählen" /></Field>
      <Field label="Bereich"><Select value={form.departmentId} onChange={value => setForm({ ...form, departmentId: value })} options={departments.map(d => [d.id,d.name] as const)} empty="Standortweit" /></Field>
      <Field label="Rolle / Position"><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="z. B. Barista" /></Field>
      <Field label="Schicht"><Input value={form.shiftHint} onChange={e => setForm({ ...form, shiftHint: e.target.value })} placeholder="z. B. Frühschicht" /></Field>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Aktiv und für das Team sichtbar</label>
    </CardContent></Card>
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Arbeitsschritte</h2><p className="text-sm text-muted-foreground">Reihenfolge mit Pfeilen oder per Ziehen verändern.</p></div><Button type="button" onClick={() => updateSteps([...steps, emptyStep()])}><Plus size={16}/> Schritt hinzufügen</Button></div>
    <div className="space-y-3">{steps.map((step, index) => <Card key={step.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(index))} onDragOver={e => e.preventDefault()} onDrop={e => updateSteps(reorder(steps, Number(e.dataTransfer.getData('text/plain')), index))}><CardContent className="space-y-4 p-5">
      <div className="flex items-center gap-2"><GripVertical className="cursor-grab text-muted-foreground" size={18}/><strong className="flex-1">Schritt {index + 1}</strong><Button type="button" variant="ghost" size="icon" aria-label="Nach oben" disabled={!index} onClick={() => updateSteps(reorder(steps,index,index-1))}><ArrowUp size={16}/></Button><Button type="button" variant="ghost" size="icon" aria-label="Nach unten" disabled={index === steps.length-1} onClick={() => updateSteps(reorder(steps,index,index+1))}><ArrowDown size={16}/></Button><Button type="button" variant="ghost" size="icon" aria-label="Schritt löschen" onClick={() => updateSteps(steps.filter((_,i)=>i!==index))}><Trash2 size={16}/></Button></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Titel"><Input value={step.title} onChange={e=>patchStep(index,{title:e.target.value})} placeholder="Was ist zu tun?"/></Field><Field label="Hinweis (optional)"><Textarea value={step.description} onChange={e=>patchStep(index,{description:e.target.value})} placeholder="So gelingt dieser Schritt …"/></Field><Field label="Nachweis"><Select value={step.evidence} onChange={value=>patchStep(index,{evidence:value as ProcedureStep['evidence']})} options={EVIDENCE}/></Field><Field label="Zuständigkeits-Hinweis"><Input value={step.assigneeHint} onChange={e=>patchStep(index,{assigneeHint:e.target.value})} placeholder="z. B. Schichtleitung / Bar"/></Field></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={step.required} onChange={e=>patchStep(index,{required:e.target.checked})}/> Pflichtschritt – Abschluss erst nach Erledigung</label>
      {step.evidence==='confirmation'&&<Field label="Bestätigungssatz"><Input value={step.confirmationText} onChange={e=>patchStep(index,{confirmationText:e.target.value})} placeholder="Ich habe den Bereich geprüft."/></Field>}
      {step.evidence==='value'&&<div className="grid gap-3 sm:grid-cols-3"><Field label="Einheit"><Input value={step.unit} onChange={e=>patchStep(index,{unit:e.target.value})} placeholder="°C"/></Field><Field label="Minimum (optional)"><Input type="number" value={step.min??''} onChange={e=>patchStep(index,{min:e.target.value===''?undefined:Number(e.target.value)})}/></Field><Field label="Maximum (optional)"><Input type="number" value={step.max??''} onChange={e=>patchStep(index,{max:e.target.value===''?undefined:Number(e.target.value)})}/></Field></div>}
    </CardContent></Card>)}</div>
    {!steps.length&&<div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Noch keine Schritte. Lege den ersten verständlichen Arbeitsschritt an.</div>}
    <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg"><Button disabled={pending} onClick={()=>save('save')}>{pending?'Speichert …':'Ablauf speichern'}</Button><Button disabled={pending} variant="outline" onClick={()=>save('duplicate')}><Copy size={16}/> Ablauf kopieren</Button>{message&&<span className="text-sm" role="status">{message}</span>}</div>
  </div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Select({value,onChange,options,empty}:{value:string;onChange:(v:string)=>void;options:readonly (readonly [string,string])[];empty?:string}) { return <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={e=>onChange(e.target.value)}>{empty&&<option value="">{empty}</option>}{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>; }
