import { notFound } from 'next/navigation';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeProcedureContent } from '@/lib/ablaeufe/schema';
import { GuidedProcedure } from './guided-procedure';

export const dynamic = 'force-dynamic';
export default async function ExecuteGuide({params}:{params:Promise<{id:string}>}) {
  const actor=await requirePosAccess(); const {id}=await params; const service=createServiceClient();
  if (!actor.location_id) notFound();
  const query=service.from('shift_guides').select('id,titel,inhalt,location_id,aktiv').eq('id',id).eq('tenant_id',actor.tenant_id!).eq('aktiv',true);
  query.eq('location_id',actor.location_id);
  const {data:guide}=await query.maybeSingle(); if(!guide)notFound();
  let content; try{content=normalizeProcedureContent(guide.inhalt);}catch{notFound();}
  return <GuidedProcedure guideId={guide.id} title={guide.titel} content={content}/>;
}
