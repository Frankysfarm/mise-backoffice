import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { HaccpPdfDocument, type HaccpData } from '@/lib/pdf/haccp-pdf';

export async function GET(request: NextRequest) {
  await requireManagerPlus();
  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7); // YYYY-MM
  const locationId = url.searchParams.get('location');

  const [y, m] = month.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();

  const supabase = await createClient();

  let locName = 'Alle Standorte';
  if (locationId) {
    const { data: loc } = await supabase.from('locations').select('name').eq('id', locationId).maybeSingle();
    if (loc?.name) locName = loc.name;
  }

  // Equipment + Logs
  let eqQuery = supabase.from('equipment').select('id,name,kategorie,location_id');
  if (locationId) eqQuery = eqQuery.eq('location_id', locationId);
  const { data: equipment } = await eqQuery;

  const eqData = await Promise.all(((equipment ?? []) as any[]).map(async (eq) => {
    const { data: logs } = await supabase.from('equipment_logs')
      .select('created_at,typ,beschreibung,employee:employees!equipment_logs_employee_id_fkey(vorname,nachname)')
      .eq('equipment_id', eq.id)
      .gte('created_at', from).lt('created_at', to)
      .order('created_at');
    return {
      id: eq.id, name: eq.name, kategorie: eq.kategorie,
      logs: (logs ?? []).map((l: any) => ({
        date: l.created_at,
        messung: l.beschreibung ?? l.typ ?? '—',
        ok: l.typ !== 'defekt' && l.typ !== 'reparatur',
        by: l.employee ? `${l.employee.vorname ?? ''} ${l.employee.nachname ?? ''}`.trim() : null,
      })),
    };
  }));

  // Cleaning Completions
  let clQuery = supabase.from('cleaning_completions')
    .select('erledigt_am,employee:employees!cleaning_completions_employee_id_fkey(vorname,nachname),task:cleaning_tasks(titel,zone:cleaning_zones(name,location_id))')
    .gte('erledigt_am', from).lt('erledigt_am', to)
    .order('erledigt_am');
  const { data: cleanings } = await clQuery;
  const cleaningData = ((cleanings ?? []) as any[])
    .filter(c => !locationId || c.task?.zone?.location_id === locationId)
    .map((c: any) => {
      const d = new Date(c.erledigt_am);
      return {
        date: c.erledigt_am,
        time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        zone: c.task?.zone?.name ?? '—',
        task: c.task?.titel ?? '—',
        by: c.employee ? `${c.employee.vorname ?? ''} ${c.employee.nachname ?? ''}`.trim() : '—',
      };
    });

  // Check-up-Sessions
  let ckQuery = supabase.from('checkup_sessions')
    .select('id,datum,template:checkup_templates(titel,fragen),started_by_emp:employees!checkup_sessions_started_by_fkey(vorname,nachname),location_id')
    .gte('datum', month + '-01')
    .lt('datum', `${y}-${String(m + 1).padStart(2, '0')}-01`)
    .order('datum');
  if (locationId) ckQuery = ckQuery.eq('location_id', locationId);
  const { data: sessions } = await ckQuery;
  const checkupData = await Promise.all(((sessions ?? []) as any[]).map(async (s) => {
    const { count: photoCount } = await supabase.from('checkup_completions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', s.id).not('foto_url', 'is', null);
    const { count: doneCount } = await supabase.from('checkup_completions')
      .select('id', { count: 'exact', head: true }).eq('session_id', s.id);
    const tasksTotal = Array.isArray(s.template?.fragen?.tasks) ? s.template.fragen.tasks.length : 0;
    return {
      date: s.datum,
      template: s.template?.titel ?? '—',
      tasksTotal,
      tasksDone: doneCount ?? 0,
      photoCount: photoCount ?? 0,
      by: s.started_by_emp ? `${s.started_by_emp.vorname ?? ''} ${s.started_by_emp.nachname ?? ''}`.trim() : '—',
    };
  }));

  const buffer = await renderToBuffer(
    HaccpPdfDocument({
      locationName: locName, month,
      equipment: eqData, cleaning: cleaningData, checkups: checkupData,
    } as HaccpData) as any,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="haccp_${month}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
