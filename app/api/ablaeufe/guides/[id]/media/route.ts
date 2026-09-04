import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const VIDEO_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;

async function requireGuideEditor(guideId: string) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id)
    return {
      error: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
    };
  if (!["manager", "backoffice", "admin"].includes(actor.rolle))
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 },
      ),
    };
  if (!/^[0-9a-f-]{36}$/i.test(guideId))
    return {
      error: NextResponse.json(
        { error: "Die Liste ist ungültig." },
        { status: 400 },
      ),
    };
  const service = createServiceClient();
  const { data: guide } = await service
    .from("shift_guides")
    .select("id,tenant_id,location_id")
    .eq("id", guideId)
    .eq("tenant_id", actor.tenant_id)
    .maybeSingle();
  if (!guide)
    return {
      error: NextResponse.json(
        { error: "Liste nicht gefunden." },
        { status: 404 },
      ),
    };
  if (
    actor.rolle === "manager" &&
    guide.location_id &&
    actor.location_id !== guide.location_id
  )
    return {
      error: NextResponse.json(
        { error: "Standort nicht freigegeben." },
        { status: 403 },
      ),
    };
  return { actor, service };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireGuideEditor(id);
  if ("error" in context) return context.error;
  const { actor, service } = context;

  const form = await request.formData().catch(() => null);
  const fileValue = form?.get("file");
  const file =
    fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!file)
    return NextResponse.json(
      { error: "Bitte eine Datei auswählen." },
      { status: 400 },
    );
  const kind = IMAGE_MIME[file.type]
    ? ("image" as const)
    : VIDEO_MIME[file.type]
      ? ("video" as const)
      : null;
  if (!kind)
    return NextResponse.json(
      { error: "Erlaubt sind JPG, PNG, WebP, MP4 oder WebM." },
      { status: 400 },
    );
  const limit = kind === "image" ? IMAGE_LIMIT : VIDEO_LIMIT;
  if (file.size > limit)
    return NextResponse.json(
      {
        error:
          kind === "image"
            ? "Bilder dürfen höchstens 10 MB groß sein."
            : "Videos dürfen höchstens 50 MB groß sein.",
      },
      { status: 400 },
    );

  const extension = (IMAGE_MIME[file.type] ?? VIDEO_MIME[file.type])!;
  const path = `${actor.tenant_id}/guides/${id}/${randomUUID()}.${extension}`;
  const { error } = await service.storage
    .from("documents")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error)
    return NextResponse.json(
      { error: "Die Datei konnte nicht gespeichert werden." },
      { status: 500 },
    );
  return NextResponse.json({ media: { kind, path } }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireGuideEditor(id);
  if ("error" in context) return context.error;
  const { actor, service } = context;

  const body = (await request.json().catch(() => null)) as {
    path?: unknown;
  } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  const allowed = new RegExp(
    `^${actor.tenant_id}/guides/${id}/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`,
    "i",
  );
  if (!allowed.test(path))
    return NextResponse.json(
      { error: "Der Medienpfad gehört nicht zu dieser Liste." },
      { status: 400 },
    );
  const { error } = await service.storage.from("documents").remove([path]);
  if (error)
    return NextResponse.json(
      { error: "Die Datei konnte nicht gelöscht werden." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
