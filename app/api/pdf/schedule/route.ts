import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { SchedulePdfDocument } from '@/lib/pdf/schedule-pdf';

function startOfWeekMonday(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - day);
  return r;
}

export async function GET(request: NextRequest) {
  await requireManagerPlus();
  const url = new URL(request.url);
  const weekParam = url.searchParams.get('week');
  const locationId = url.searchParams.get('location');

  const weekStart = startOfWeekMonday(weekParam ? new Date(weekParam) : new Date());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const supabase = await createClient();
  let q = supabase.from('shifts')
    .select('id,start_zeit,end_zeit,pause_minuten,position,employee:employees!shifts_employee_id_fkey(vorname,nachname),department:departments(name,farbe)')
    .gte('start_zeit', weekStart.toISOString())
    .lt('start_zeit', weekEnd.toISOString())
    .order('start_zeit');
  if (locationId) q = q.eq('location_id', locationId);
  const { data: shifts } = await q;

  let locName = 'Alle Standorte';
  if (locationId) {
    const { data: loc } = await supabase.from('locations').select('name').eq('id', locationId).maybeSingle();
    if (loc?.name) locName = loc.name;
  }

  const buffer = await renderToBuffer(
    SchedulePdfDocument({ locationName: locName, weekStart, shifts: (shifts ?? []) as any }) as any,
  );

  const filename = `schichtplan_${weekStart.toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
