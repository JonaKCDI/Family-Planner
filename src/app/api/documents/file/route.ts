import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { DocumentFileError, resolveDocumentFile } from "@/lib/document-files";
import { attachmentDisposition } from "@/lib/file-names";
import { canReadScoped } from "@/lib/permissions";
import { db } from "@/lib/db";
import { resolveReadableDocumentRoot } from "@/lib/relations";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";

  try {
    const file = url.searchParams.get("id")
      ? await resolveFileFromReference(session, url.searchParams.get("id")!)
      : await resolveFileFromRoot(session, url.searchParams.get("rootId") ?? "", url.searchParams.get("path"));

    if (disposition === "inline" && !file.previewable) {
      return NextResponse.json({ message: "Dieser Dateityp kann nur heruntergeladen werden." }, { status: 415 });
    }

    const buffer = await readFile(file.absolutePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": disposition === "attachment" ? attachmentDisposition(file.fileName) : `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const message = error instanceof DocumentFileError || error instanceof Error ? error.message : "Die Datei ist nicht verfügbar.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

async function resolveFileFromRoot(session: Awaited<ReturnType<typeof requireSession>>, rootId: string, relativePath: string | null) {
  const documentRoot = await resolveReadableDocumentRoot(session.family.id, session.user.id, session.role, rootId);
  return resolveDocumentFile(documentRoot.basePath, relativePath);
}

async function resolveFileFromReference(session: Awaited<ReturnType<typeof requireSession>>, id: string) {
  const document = await db.documentReference.findFirst({
    where: { id, familyId: session.family.id },
    include: { documentRoot: true }
  });
  if (!document || !canReadScoped(document.ownerUserId, document.scope, session.user.id) || !document.documentRoot || !document.relativePath) {
    throw new DocumentFileError("Die Datei ist nicht verfügbar.");
  }
  await resolveReadableDocumentRoot(session.family.id, session.user.id, session.role, document.documentRoot.id);
  const file = await resolveDocumentFile(document.documentRoot.basePath, document.relativePath);
  await db.documentReference.update({ where: { id: document.id }, data: { lastSeenAt: new Date(), fileSize: file.fileSize, mimeType: file.mimeType } });
  return file;
}
