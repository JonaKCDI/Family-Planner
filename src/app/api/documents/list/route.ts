import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listDocumentDirectory, DocumentFileError } from "@/lib/document-files";
import { resolveReadableDocumentRoot } from "@/lib/relations";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  try {
    const documentRoot = await resolveReadableDocumentRoot(session.family.id, session.user.id, session.role, url.searchParams.get("rootId") ?? "");
    const entries = await listDocumentDirectory(documentRoot.basePath, url.searchParams.get("path"));
    return NextResponse.json({ root: { id: documentRoot.id, name: documentRoot.name }, entries });
  } catch (error) {
    const message = error instanceof DocumentFileError || error instanceof Error ? error.message : "Der Ordner ist nicht verfügbar.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
