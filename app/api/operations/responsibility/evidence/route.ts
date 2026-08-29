import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILE_TYPES = new Set(['foto', 'dokument']);
const EVIDENCE_TYPES = new Set(['foto', 'kommentar', 'dokument', 'unterschrift', 'messwert']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const taskId = String(form?.get('taskId') ?? '');
  const evidenceType = String(form?.get('evidenceType') ?? '');
  const comment = String(form?.get('comment') ?? '').trim().slice(0, 3000);
  const fileValue = form?.get('file');
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!/^[0-9a-f-]{36}$/i.test(taskId) || !EVIDENCE_TYPES.has(evidenceType)) {
    return NextResponse.json({ error: 'Nachweis ist ungültig.' }, { status: 400 });
  }
  if (FILE_TYPES.has(evidenceType) && !file) return NextResponse.json({ error: 'Für diesen Nachweis ist eine Datei erforderlich.' }, { status: 400 });
  if (!FILE_TYPES.has(evidenceType) && !comment) return NextResponse.json({ error: 'Bitte den Nachweis eintragen.' }, { status: 400 });
  if (file && (file.size > 10 * 1024 * 1024 || !ALLOWED_MIME.has(file.type))) {
    return NextResponse.json({ error: 'Erlaubt sind JPG, PNG, WebP oder PDF bis 10 MB.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: task } = await service.from('operational_tasks')
    .select('id,tenant_id,location_id,department_id,assigned_to,accountable_employee_id,controller_employee_id,status')
    .eq('id', taskId).eq('tenant_id', actor.tenant_id).maybeSingle();
  if (!task) return NextResponse.json({ error: 'Aufgabe nicht gefunden.' }, { status: 404 });
  const participant = [task.assigned_to, task.accountable_employee_id, task.controller_employee_id].includes(actor.id);
  let departmentLead = false;
  if (task.department_id) {
    const { data } = await service.from('department_responsibility_assignments').select('id')
      .eq('department_id', task.department_id).eq('employee_id', actor.id).eq('aktiv', true).limit(1);
    departmentLead = Boolean(data?.length);
  }
  if (!participant && !departmentLead && !['manager', 'backoffice', 'admin'].includes(actor.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  if (['erledigt', 'nicht_bestanden', 'storniert'].includes(task.status)) {
    return NextResponse.json({ error: 'Die Aufgabe ist bereits abgeschlossen.' }, { status: 409 });
  }

  let storagePath: string | null = null;
  if (file) {
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    storagePath = `${actor.tenant_id}/operations/${task.id}/${randomUUID()}.${extension}`;
    const { error } = await service.storage.from('documents').upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type, upsert: false,
    });
    if (error) return NextResponse.json({ error: 'Datei konnte nicht gespeichert werden.' }, { status: 500 });
  }
  const { data: evidence, error } = await service.from('operational_task_evidence').insert({
    tenant_id: actor.tenant_id, task_id: task.id, evidence_type: evidenceType,
    storage_path: storagePath, content: comment ? { text: comment } : {}, submitted_by: actor.id,
  }).select('id,task_id,evidence_type,storage_path,content,verification_status,submitted_at').single();
  if (error || !evidence) {
    if (storagePath) await service.storage.from('documents').remove([storagePath]);
    return NextResponse.json({ error: 'Nachweis konnte nicht dokumentiert werden.' }, { status: 500 });
  }
  return NextResponse.json({ evidence }, { status: 201 });
}
