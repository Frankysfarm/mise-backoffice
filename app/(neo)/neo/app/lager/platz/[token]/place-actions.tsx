'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export function PlaceActions({item,placeId,locationId,targets}:{item:{id:string;name:string;einheit:string;letzte_inventur:number|null};placeId:string;locationId:string;targets:{id:string;name:string}[]}){
 const router=useRouter();const [pending,start]=useTransition();const [action,setAction]=useState<'book'|'withdraw'|'transfer'|'count'|null>(null);
 function submit(fd:FormData){start(async()=>{const res=await fetch('/api/inventory/warehouse',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({intent:'stock-action',locationId,placeId,itemId:item.id,action,amount:Number(fd.get('amount')),targetPlaceId:fd.get('targetPlaceId')||null})});const body=await res.json();if(!res.ok)return toastError('Buchung fehlgeschlagen',body.error);toastSuccess(action==='count'?'Zählung gespeichert':'Bestand gebucht');setAction(null);router.refresh();});}
 return <div className="space-y-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Button variant="outline" onClick={()=>setAction('book')}>Einbuchen</Button><Button variant="outline" onClick={()=>setAction('withdraw')}>Entnehmen</Button><Button variant="outline" onClick={()=>setAction('transfer')}>Umlagern</Button><Button onClick={()=>setAction('count')}>Zählen</Button></div>{action&&<form action={submit} className="space-y-3 rounded-lg bg-muted p-3"><div><Label>{action==='count'?'Gezählter Ist-Bestand':action==='transfer'?`Gesamten Bestand umlagern (${item.einheit})`:`Menge (${item.einheit})`}</Label><Input name="amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={action==='transfer'?item.letzte_inventur??0:undefined} readOnly={action==='transfer'} required autoFocus/></div>{action==='transfer'&&<div><Label>Ziel-Lagerplatz</Label><select name="targetPlaceId" required className="h-11 w-full rounded-md border bg-background px-3"><option value="">Ziel wählen</option>{targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}<div className="flex gap-2"><Button disabled={pending}>Speichern</Button><Button type="button" variant="ghost" onClick={()=>setAction(null)}>Abbrechen</Button></div></form>}</div>;
}
