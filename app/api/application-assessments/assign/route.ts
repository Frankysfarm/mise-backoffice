import { createHash, randomBytes, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { assessmentErrorMessage } from '@/lib/application-assessments/errors';

const schema = z.object({ candidateId: z.string().uuid(), templateId: z.string().uuid() });
export async function POST(request: NextRequest) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Test und Bewerbung auswählen.' }, { status: 400 });
  const token = randomBytes(32).toString('base64url'); const sessionId = randomUUID();
  const hash = createHash('sha256').update(token).digest('hex');
  const { error } = await createServiceClient().rpc('assign_application_assessment', { p_session_id: sessionId, p_tenant_id: actor.tenant_id, p_candidate_id: parsed.data.candidateId, p_template_id: parsed.data.templateId, p_actor_id: actor.id, p_invite_token_hash: hash, p_expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString() });
  if (error) return NextResponse.json({ error: assessmentErrorMessage(error.message) }, { status: 400 });
  return NextResponse.json({ sessionId, link: `${request.nextUrl.origin}/bewerbungstest/${token}` });
}
