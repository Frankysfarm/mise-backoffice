import { notFound } from "next/navigation";
import { requirePosAccess } from "@/lib/auth/requireRole";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeProcedureContent } from "@/lib/ablaeufe/schema";
import { GuidedProcedure } from "./guided-procedure";

export const dynamic = "force-dynamic";

export default async function ExecuteGuide({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ task?: string }> | { task?: string };
}) {
  const actor = await requirePosAccess();
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const initialTaskId = typeof query.task === "string" && /^[0-9a-f-]{36}$/i.test(query.task) ? query.task : undefined;
  const service = createServiceClient();
  if (!actor.location_id) notFound();

  // Pflicht-Checkliste aus der Schicht: den eingefrorenen Stand der Aufgabe ausführen,
  // damit Anzeige und Abschluss-Prüfung dieselben Schritte sehen – auch wenn der Leitfaden inzwischen geändert wurde.
  if (initialTaskId) {
    const { data: task } = await service
      .from("operational_tasks")
      .select("id,title,status,assigned_to,source_id,procedure_content")
      .eq("id", initialTaskId)
      .eq("tenant_id", actor.tenant_id!)
      .eq("location_id", actor.location_id)
      .eq("source_type", "shift_guide")
      .maybeSingle();
    // Ungültige, fremde oder abgeschlossene Aufgabe: sauber 404 statt stillem Rückfall auf den Live-Leitfaden
    if (!task || task.assigned_to !== actor.id || task.source_id?.split(":")[2] !== id || !["offen", "angenommen", "in_arbeit"].includes(task.status)) {
      notFound();
    }
    let taskContent;
    try {
      taskContent = normalizeProcedureContent(task.procedure_content);
    } catch {
      notFound();
    }
    return <GuidedProcedure guideId={id} title={task.title} content={taskContent} initialTaskId={task.id} />;
  }

  const { data: guide } = await service
    .from("shift_guides")
    .select("id,titel,inhalt,location_id,aktiv")
    .eq("id", id)
    .eq("tenant_id", actor.tenant_id!)
    .eq("location_id", actor.location_id)
    .eq("aktiv", true)
    .maybeSingle();
  if (!guide) notFound();

  let content;
  try {
    content = normalizeProcedureContent(guide.inhalt);
  } catch {
    notFound();
  }
  return (
    <GuidedProcedure
      guideId={guide.id}
      title={guide.titel}
      content={content}
      initialTaskId={initialTaskId}
    />
  );
}
