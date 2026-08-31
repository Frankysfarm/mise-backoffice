import { NextRequest, NextResponse } from 'next/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { assessmentTemplateSchema } from '@/lib/application-assessments/domain';
import { assessmentErrorMessage } from '@/lib/application-assessments/errors';

export async function GET() {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const service = createServiceClient();
  let query = service.from('assessment_templates')
    .select('id,name,description,status,location_id,updated_at,versions:assessment_template_versions(id,config_json,status,created_at),targets:assessment_template_targets(target_type,department_id,position_type)')
    .eq('tenant_id', actor.tenant_id).eq('category', 'APPLICATION');
  if (actor.rolle === 'manager') query = query.or(`location_id.is.null,location_id.eq.${actor.location_id}`);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: assessmentErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const parsed = assessmentTemplateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bitte Test, Fragen und Antworten vollständig ausfüllen.', details: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  const { data, error } = await createServiceClient().rpc('save_application_assessment_template', {
    p_id: value.id ?? null, p_tenant_id: actor.tenant_id, p_location_id: value.locationId ?? null, p_actor_id: actor.id,
    p_name: value.name, p_description: value.description, p_passing_threshold: value.passingThreshold,
    p_pass_action: value.passAction, p_fail_action: value.failAction, p_pass_message: value.passMessage,
    p_fail_message: value.failMessage, p_questions: value.questions.map((question) => ({ ...question, correctOptionIds: [...question.correctOptionIds].sort() })), p_targets: value.targets, p_active: value.active,
  });
  if (error) return NextResponse.json({ error: assessmentErrorMessage(error.message) }, { status: 400 });
  return NextResponse.json({ id: data });
}
