import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { canCompleteProcedure, normalizeProcedureContent } from '@/lib/ablaeufe/schema';
import { createServiceClient } from '@/lib/supabase/server';

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), guideId: z.string().uuid() }),
  z.object({ action: z.literal('finish'), taskId: z.string().uuid(), completed: z.record(z.boolean()), evidence: z.record(z.unknown()), values: z.record(z.number()).default({}) }),
]);

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee(); if (!actor?.tenant_id || !actor.location_id) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(()=>null)); if (!parsed.success) return NextResponse.json({ error: 'Eingaben sind ungültig.' }, { status: 400 });
  const service=createServiceClient(); const input=parsed.data;
  if(input.action==='start') {
    const {data:guide}=await service.from('shift_guides').select('id,titel,inhalt,department_id,location_id,tenant_id').eq('id',input.guideId).eq('tenant_id',actor.tenant_id).eq('aktiv',true).maybeSingle();
    if(!guide || guide.location_id!==actor.location_id) return NextResponse.json({error:'Ablauf ist für diesen Standort nicht verfügbar.'},{status:404});
    let content; try { content=normalizeProcedureContent(guide.inhalt); } catch { return NextResponse.json({error:'Dieser Ablauf muss von der Leitung einmal gespeichert werden.'},{status:409}); }
    const requirements=[...new Set(content.categories.flatMap(c=>c.steps).filter(s=>s.required).map(s=>s.evidence==='photo'?'foto':s.evidence==='value'?'messwert':s.evidence==='confirmation'?'unterschrift':null).filter(Boolean))];
    const {data:task,error}=await service.from('operational_tasks').insert({tenant_id:actor.tenant_id,location_id:actor.location_id,department_id:guide.department_id,title:guide.titel,status:'in_arbeit',created_by:actor.id,assigned_to:actor.id,accountable_employee_id:actor.id,controller_employee_id:actor.id,evidence_requirements:requirements,source_type:'shift_guide_execution',source_id:`${guide.id}:${actor.id}:${Date.now()}`,procedure_content:content}).select('id').single();
    if(error||!task)return NextResponse.json({error:'Ablauf konnte nicht gestartet werden.'},{status:500}); return NextResponse.json({taskId:task.id},{status:201});
  }
  const {data:task}=await service.from('operational_tasks').select('id,assigned_to,status,procedure_content').eq('id',input.taskId).eq('tenant_id',actor.tenant_id).eq('location_id',actor.location_id).maybeSingle();
  if(!task||task.assigned_to!==actor.id||task.status!=='in_arbeit')return NextResponse.json({error:'Ausführung nicht gefunden.'},{status:404});
  const content=normalizeProcedureContent(task.procedure_content); const steps=content.categories.flatMap(c=>c.steps);
  if(!canCompleteProcedure(steps,input.completed,input.evidence))return NextResponse.json({error:'Bitte zuerst alle Pflichtschritte und Nachweise erledigen.'},{status:409});
  for(const step of steps.filter(s=>s.evidence==='value'&&input.completed[s.id])) { const value=input.values[step.id]; if(!Number.isFinite(value))return NextResponse.json({error:`Messwert für „${step.title}“ fehlt.`},{status:409}); }
  const {error}=await service.from('operational_tasks').update({status:'erledigt',completed_at:new Date().toISOString(),procedure_results:{completed:input.completed,evidence:input.evidence,values:input.values,completedBy:actor.id}}).eq('id',task.id).eq('assigned_to',actor.id);
  if(error)return NextResponse.json({error:'Abschluss konnte nicht gespeichert werden.'},{status:500}); return NextResponse.json({completedAt:new Date().toISOString(),completedBy:`${actor.vorname} ${actor.nachname}`});
}
