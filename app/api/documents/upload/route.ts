import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { z } from 'zod';

const schema = z.object({
  employee_id: z.string().uuid(),
  titel: z.string().min(1),
  kategorie: z.string().optional(),
  ablaufdatum: z.string().optional(),
  storage_path: z.string().min(1),
  dateiname: z.string().min(1),
  mime_type: z.string().optional(),
  größe_bytes: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const me = await requireManagerPlus();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const sb = createServiceClient();
  const { data, error } = await sb.from('documents').insert({
    employee_id: d.employee_id,
    titel: d.titel,
    kategorie: d.kategorie ?? null,
    ablaufdatum: d.ablaufdatum || null,
    storage_path: d.storage_path,
    dateiname: d.dateiname,
    mime_type: d.mime_type ?? null,
    größe_bytes: d.größe_bytes ?? null,
    hochgeladen_von: me.id,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
