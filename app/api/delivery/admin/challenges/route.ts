import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  listChallenges,
  getChallenge,
  createChallenge,
  deleteChallenge,
  type CreateChallengeInput,
  type ChallengeStatus,
} from '@/lib/delivery/challenges';

export const dynamic = 'force-dynamic';

async function resolveAuth(
  req: NextRequest,
): Promise<{ locationId: string; employeeId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const serviceSb = createServiceClient();
  const { data: emp } = await serviceSb
    .from('employees')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.tenant_id) return null;
  return { locationId: emp.tenant_id as string, employeeId: emp.id as string };
}

// GET  — Liste aller Challenges + optionaler Detail-Abruf via ?id=
export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id     = searchParams.get('id');
  const status = searchParams.get('status') as ChallengeStatus | null;

  if (id) {
    const detail = await getChallenge(id, auth.locationId);
    if (!detail) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(detail);
  }

  const challenges = await listChallenges(auth.locationId, status ?? undefined);
  return NextResponse.json({ challenges });
}

// POST — Neue Challenge anlegen
export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;

  if (!body.title || !body.challengeType || !body.targetValue || !body.startsAt || !body.endsAt) {
    return NextResponse.json(
      { error: 'Pflichtfelder: title, challengeType, targetValue, startsAt, endsAt' },
      { status: 400 },
    );
  }

  const input: CreateChallengeInput = {
    locationId:    auth.locationId,
    title:         body.title         as string,
    description:   body.description   as string | undefined,
    challengeType: body.challengeType as CreateChallengeInput['challengeType'],
    targetValue:   Number(body.targetValue),
    rewardEur:     Number(body.rewardEur ?? 0),
    rewardNote:    body.rewardNote    as string | undefined,
    startsAt:      body.startsAt      as string,
    endsAt:        body.endsAt        as string,
    maxWinners:    body.maxWinners != null ? Number(body.maxWinners) : undefined,
    createdBy:     auth.employeeId,
  };

  const challenge = await createChallenge(input);
  return NextResponse.json({ challenge }, { status: 201 });
}

// DELETE — Challenge stornieren (?id=)
export async function DELETE(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });

  await deleteChallenge(id, auth.locationId);
  return NextResponse.json({ ok: true });
}
