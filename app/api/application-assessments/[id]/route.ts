import { NextRequest, NextResponse } from 'next/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { assessmentErrorMessage } from '@/lib/application-assessments/errors';

function scopeForManager(query: any, actor: { rolle: string; location_id: string | null }) {
  return actor.rolle === 'manager' ? query.or(`location_id.is.null,location_id.eq.${actor.location_id}`) : query;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireManagerPlus(); const { id } = await params;
  if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const service = createServiceClient();
  const { data: template } = await scopeForManager(service.from('assessment_templates').select('*').eq('id', id).eq('tenant_id', actor.tenant_id), actor).maybeSingle();
  if (!template) return NextResponse.json({ error: 'Test nicht gefunden.' }, { status: 404 });
  const [{ data: version }, { data: targets }] = await Promise.all([
    service.from('assessment_template_versions').select('id,config_json').eq('template_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('assessment_template_targets').select('target_type,department_id,position_type').eq('template_id', id),
  ]);
  const { data: items } = version ? await service.from('assessment_items').select('item_key,candidate_payload_json,server_scoring_config_json').eq('version_id', version.id).order('created_at') : { data: [] };
  return NextResponse.json({ template, config: version?.config_json ?? {}, questions: (items ?? []).map((item: any) => ({ id: item.item_key, question: item.candidate_payload_json.question, options: item.candidate_payload_json.options, correctOptionIds: item.server_scoring_config_json.correctOptionIds, points: item.server_scoring_config_json.points, mustPass: item.server_scoring_config_json.mustPass })), targets: targets ?? [] });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireManagerPlus(); const { id } = await params;
  if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const service = createServiceClient();
  const { data: template } = await scopeForManager(service.from('assessment_templates').select('id').eq('id', id).eq('tenant_id', actor.tenant_id), actor).maybeSingle();
  if (!template) return NextResponse.json({ error: 'Test nicht gefunden.' }, { status: 404 });
  const { count } = await service.from('assessment_sessions').select('id', { count: 'exact', head: true }).eq('template_id', id).eq('tenant_id', actor.tenant_id);
  if (count) {
    const { error } = await service.from('assessment_templates').update({ status: 'RETIRED', updated_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', actor.tenant_id);
    return error ? NextResponse.json({ error: assessmentErrorMessage(error.message) }, { status: 500 }) : NextResponse.json({ archived: true });
  }
  const { error } = await service.from('assessment_templates').delete().eq('id', id).eq('tenant_id', actor.tenant_id).eq('is_system_template', false);
  return error ? NextResponse.json({ error: assessmentErrorMessage(error.message) }, { status: 500 }) : NextResponse.json({ deleted: true });
}
