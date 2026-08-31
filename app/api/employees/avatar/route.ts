import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { publicUrl } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const employeeId = String(form?.get('employeeId') ?? '');
  const fileValue = form?.get('file');
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  if (!/^[0-9a-f-]{36}$/i.test(employeeId) || !file) {
    return NextResponse.json({ error: 'Mitarbeiter oder Bild fehlen.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE || !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Erlaubt sind JPG, PNG oder WebP bis 2 MB.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: target } = await service.from('employees')
    .select('id,tenant_id,location_id')
    .eq('id', employeeId)
    .eq('tenant_id', actor.tenant_id)
    .in('status', ['aktiv', 'in_training', 'in_probe'])
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden.' }, { status: 404 });
  }

  const isManager = ['manager', 'backoffice', 'admin'].includes(actor.rolle);
  const isSelf = actor.id === employeeId;
  if (!isSelf && !isManager) {
    return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
  }
  if (isManager && actor.rolle === 'manager' && (!actor.location_id || !target.location_id || actor.location_id !== target.location_id)) {
    return NextResponse.json({ error: 'Standort nicht freigegeben.' }, { status: 403 });
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${actor.tenant_id}/${employeeId}-${randomUUID().slice(0, 8)}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await service.storage.from('avatars').upload(storagePath, arrayBuffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: 'Bild konnte nicht gespeichert werden.' }, { status: 500 });
  }

  const avatarUrl = publicUrl('avatars', storagePath);
  if (!avatarUrl) {
    await service.storage.from('avatars').remove([storagePath]);
    return NextResponse.json({ error: 'Öffentliche URL konnte nicht erzeugt werden.' }, { status: 500 });
  }
  const { error: updateError } = await service.from('employees')
    .update({ avatar_url: avatarUrl })
    .eq('id', employeeId)
    .eq('tenant_id', actor.tenant_id);

  if (updateError) {
    await service.storage.from('avatars').remove([storagePath]);
    return NextResponse.json({ error: 'Profilbild konnte nicht verknüpft werden.' }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl }, { status: 201 });
}
