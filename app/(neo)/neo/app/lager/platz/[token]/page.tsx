import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlaceActions } from './place-actions';

export default async function InventoryPlacePage({params}:{params:Promise<{token:string}>}) {
 const actor=await requirePosAccess(); if(!actor.tenant_id) notFound(); const {token}=await params; const supabase=await createClient();
 const {data:place}=await supabase.from('inventory_shelves').select('id,name,qr_token,last_checked_at,last_checker:employees!inventory_shelves_last_checked_by_fkey(vorname,nachname),area:inventory_areas!inner(id,name,location_id,location:locations!inner(name,tenant_id))').eq('qr_token',token).eq('area.location.tenant_id',actor.tenant_id).eq('place_kind','place').maybeSingle();
 if(!place) notFound(); const area=place.area as any;
 const [{data:items},{data:targets}]=await Promise.all([
  supabase.from('inventory_items').select('id,name,einheit,soll_bestand,min_bestand,letzte_inventur,shelf_id').eq('shelf_id',place.id).eq('aktiv',true).order('name'),
  supabase.from('inventory_shelves').select('id,name,area:inventory_areas!inner(location_id,location:locations!inner(tenant_id))').eq('place_kind','place').eq('area.location_id',area.location_id).eq('area.location.tenant_id',actor.tenant_id).neq('id',place.id).order('name'),
 ]);
 const checker=place.last_checker as any;
 return <div className="mx-auto max-w-2xl space-y-5 pb-24"><PageHeader backHref="/neo/app/lager/plan" title={place.name} description={`${area.name} · ${area.location.name}`}/><Card><CardContent className="p-4 text-sm"><div className="font-medium">Letzte Kontrolle</div><div className="text-muted-foreground">{place.last_checked_at?`${new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(place.last_checked_at))}${checker?` · ${checker.vorname} ${checker.nachname}`:''}`:'Noch keine Kontrolle erfasst'}</div><a className="mt-3 inline-block font-medium text-primary underline" href={`/api/inventory/warehouse/${token}/qr`} target="_blank">QR-Etikett öffnen und drucken</a></CardContent></Card>{!items?.length?<Card><CardContent className="p-6"><p className="font-medium">Dieser Lagerplatz ist noch leer.</p><p className="mt-1 text-sm text-muted-foreground">Produkte können in der Produktverwaltung diesem Platz zugeordnet werden.</p></CardContent></Card>:(items as any[]).map(item=><Card key={item.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{item.name}</h2><p className="text-sm text-muted-foreground">Soll {item.soll_bestand??'—'} · Ist {item.letzte_inventur??0} {item.einheit}</p></div>{(item.letzte_inventur??0)<(item.min_bestand??0)?<Badge variant="destructive">Nachbestellen</Badge>:<Badge variant="secondary">Bestand ok</Badge>}</div><PlaceActions item={item} placeId={place.id} locationId={area.location_id} targets={(targets??[]) as any[]}/></CardContent></Card>)}</div>;
}
