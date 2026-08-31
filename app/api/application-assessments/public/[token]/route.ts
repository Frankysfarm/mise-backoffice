import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

const answersSchema = z.object({ answers: z.record(z.array(z.string().min(1)).min(1)) });
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const service = createServiceClient(); const hash = tokenHash(token);
  const { data: session } = await service.from('assessment_sessions').select('id,status,expires_at,completion_percentage,candidate:employees(vorname),template:assessment_templates(name,description)').eq('invite_token_hash', hash).maybeSingle();
  if (!session || new Date(session.expires_at) <= new Date()) return NextResponse.json({ error: 'Dieser Testlink ist nicht mehr gültig.' }, { status: 404 });
  const { data: items } = await service.from('assessment_session_items').select('id,item_order,candidate_payload_json').eq('session_id', session.id).order('item_order');
  if (['COMPLETED', 'AWAITING_REVIEW', 'REVIEWED', 'NEXT_STAGE_APPROVED', 'CLOSED'].includes(session.status)) {
    const { data: result } = await service.from('assessment_results').select('passed,overall_score,outcome_message').eq('session_id', session.id).maybeSingle();
    return NextResponse.json({ session, result, questions: [] });
  }
  await service.rpc('start_application_assessment', { p_session_id: session.id, p_token_hash: hash, p_device_class: request.headers.get('sec-ch-ua-mobile') === '?1' ? 'mobile' : 'desktop' });
  return NextResponse.json({ session: { ...session, status: 'IN_PROGRESS' }, questions: (items ?? []).map((item: any) => ({ id: item.id, order: item.item_order, ...item.candidate_payload_json })) });
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const service = createServiceClient(); const hash = tokenHash(token);
  const body = await _.json().catch(() => null); const parsed = answersSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Bitte jede Frage beantworten.' }, { status: 400 });
  const { data: session } = await service.from('assessment_sessions').select('id').eq('invite_token_hash', hash).maybeSingle();
  if (!session) return NextResponse.json({ error: 'Test nicht gefunden.' }, { status: 404 });
  const { data: items } = await service.from('assessment_session_items').select('id').eq('session_id', session.id);
  if (!items?.length || items.some((item) => !parsed.data.answers[item.id]?.length)) return NextResponse.json({ error: 'Bitte jede Frage beantworten.' }, { status: 400 });
  for (const item of items) {
    const { error } = await service.rpc('submit_application_assessment_response', { p_session_id: session.id, p_session_item_id: item.id, p_response: { optionIds: [...parsed.data.answers[item.id]].sort() } });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { data, error } = await service.rpc('complete_application_assessment', { p_session_id: session.id, p_token_hash: hash });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data?.[0] ?? data });
}
