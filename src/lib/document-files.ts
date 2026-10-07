import { lstat, open, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type DocumentFileErrorCode =
  | "INVALID_ROOT"
  | "INVALID_RELATIVE_PATH"
  | "NOT_FOUND"
  | "OUTSIDE_ROOT"
  | "SYMLINK_BLOCKED"
  | "EXPECTED_FILE"
  | "EXPECTED_DIRECTORY";

export type DocumentFileKind = "directory" | "file";

export type DocumentFileEntry = {
  name: string;
  relativePath: string;
  kind: DocumentFileKind;
  mimeType: string;
  mime: DocumentMimePolicy;
  fileSize: number;
  updatedAt: Date;
  previewable: boolean;
};

export type ResolvedDocumentFile = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  previewable: boolean;
};

export type DocumentPathKind = "file" | "directory" | "any";
export type DocumentPreviewMode = "pdf" | "image" | "text" | "download";

export type DocumentMimePolicy = {
  mimeType: string;
  previewMode: DocumentPreviewMode;
  contentDisposition: "inline" | "attachment";
};

export type ResolvedDocumentPath = {
  rootPath: string;
  absolutePath: string;
  relativePath: string;
  name: string;
  kind: DocumentFileKind;
  size: number;
  updatedAt: Date;
  mime: DocumentMimePolicy;
};

const MAX_DECODE_PASSES = 10;
const MIME_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp"
};

export class DocumentFileError extends Error {
  public readonly code: DocumentFileErrorCode;

  constructor(codeOrMessage: DocumentFileErrorCode | string = "NOT_FOUND") {
    const code = isDocumentFileErrorCode(codeOrMessage) ? codeOrMessage : "NOT_FOUND";
    super(isDocumentFileErrorCode(codeOrMessage) ? documentFileErrorMessage(codeOrMessage) : codeOrMessage);
    this.code = code;
    this.name = "DocumentFileError";
  }
}

export async function listDocumentDirectory(rootPath: string, relativePath: string | null | undefined = ""): Promise<DocumentFileEntry[]> {
  const directory = await resolveDocumentPath(rootPath, relativePath ?? "", "directory");
  const entries = await readdir(directory.absolutePath, { withFileTypes: true });
  const safeEntries = await Promise.all(entries
    .filter((entry) => !entry.name.startsWith("."))
    .map(async (entry) => {
      try {
        const child = await resolveDocumentPath(rootPath, joinRelative(directory.relativePath, entry.name), "any");
        return {
          name: child.name,
          relativePath: child.relativePath.replaceAll(path.sep, "/"),
          kind: child.kind,
          mimeType: child.kind === "directory" ? "" : child.mime.mimeType,
          mime: child.mime,
          fileSize: child.kind === "directory" ? 0 : child.size,
          updatedAt: child.updatedAt,
          previewable: child.kind === "file" && child.mime.contentDisposition === "inline"
        };
      } catch {
        return null;
      }
    }));

  return safeEntries
    .filter((entry): entry is DocumentFileEntry => Boolean(entry))
    .sort((a, b) => Number(a.kind === "file") - Number(b.kind === "file") || a.name.localeCompare(b.name, "de"));
}

export async function resolveDocumentFile(rootPath: string, relativePath: string | null | undefined): Promise<ResolvedDocumentFile> {
  const resolved = await resolveDocumentPath(rootPath, relativePath ?? "", "file");
  return {
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath.replaceAll(path.sep, "/"),
    fileName: resolved.name,
    mimeType: resolved.mime.mimeType,
    fileSize: resolved.size,
    previewable: resolved.mime.contentDisposition === "inline"
  };
}

export async function resolveDocumentPath(
  rootBasePath: string,
  relativePath: string | null | undefined,
  expectedKind: DocumentPathKind = "any"
): Promise<ResolvedDocumentPath> {
  const rootRealPath = await resolveDocumentRoot(rootBasePath);
  const cleanRelativePath = normalizeRelativeDocumentPath(relativePath ?? "");
  const absolutePath = cleanRelativePath ? path.join(rootRealPath, cleanRelativePath) : rootRealPath;

  await assertNoSymlinkInPath(rootRealPath, cleanRelativePath);

  let targetStat;
  try {
    targetStat = await stat(absolutePath);
  } catch {
    throw new DocumentFileError("NOT_FOUND");
  }

  const kind = targetStat.isDirectory() ? "directory" : targetStat.isFile() ? "file" : null;
  if (!kind) {
    throw new DocumentFileError(expectedKind === "directory" ? "EXPECTED_DIRECTORY" : "EXPECTED_FILE");
  }
  if (expectedKind === "file" && kind !== "file") {
    throw new DocumentFileError("EXPECTED_FILE");
  }
  if (expectedKind === "directory" && kind !== "directory") {
    throw new DocumentFileError("EXPECTED_DIRECTORY");
  }

  const targetRealPath = await realpath(absolutePath);
  assertInsideRoot(rootRealPath, targetRealPath);
  const mime = getDocumentMimePolicy(cleanRelativePath);
  if (kind === "file" && mime.previewMode === "image" && !(await hasExpectedImageSignature(targetRealPath, mime.mimeType))) {
    mime.contentDisposition = "attachment";
    mime.previewMode = "download";
  }

  return {
    rootPath: rootRealPath,
    absolutePath: targetRealPath,
    relativePath: cleanRelativePath,
    name: cleanRelativePath ? path.basename(cleanRelativePath) : "",
    kind,
    size: targetStat.size,
    updatedAt: targetStat.mtime,
    mime
  };
}

export function sanitizeDocumentPath(input: string | null | undefined) {
  return normalizeRelativeDocumentPath(input ?? "").replaceAll(path.sep, "/");
}

export function normalizeRelativeDocumentPath(relativePath: string) {
  const decodedPath = decodePathRepeatedly(relativePath.trim());
  if (decodedPath.includes("\0") || decodedPath.includes(":")) {
    throw new DocumentFileError("INVALID_RELATIVE_PATH");
  }
  if (path.posix.isAbsolute(decodedPath) || path.win32.isAbsolute(decodedPath)) {
    throw new DocumentFileError("INVALID_RELATIVE_PATH");
  }

  const parts = decodedPath
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);

  if (parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
    throw new DocumentFileError("INVALID_RELATIVE_PATH");
  }

  return parts.join(path.sep);
}

export function detectMimeType(fileName: string) {
  return getDocumentMimePolicy(fileName).mimeType;
}

export function isPreviewableMimeType(mimeType: string) {
  const normalizedMimeType = mimeType.split(";")[0]?.trim().toLowerCase();
  return normalizedMimeType === "application/pdf"
    || normalizedMimeType === "text/plain"
    || normalizedMimeType === "text/csv"
    || normalizedMimeType.startsWith("image/");
}

export function getDocumentMimePolicy(fileName: string): DocumentMimePolicy {
  const mimeType = MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
  if (mimeType === "application/pdf") {
    return { mimeType, previewMode: "pdf", contentDisposition: "inline" };
  }
  if (mimeType.startsWith("image/")) {
    return { mimeType, previewMode: "image", contentDisposition: "inline" };
  }
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return { mimeType, previewMode: "text", contentDisposition: "inline" };
  }
  return { mimeType, previewMode: "download", contentDisposition: "attachment" };
}

export function safeDocumentDownloadFileName(fileName: string) {
  const baseName = basenameFromAnySeparator(fileName).normalize("NFKD");
  const safeName = baseName
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/[ .]+$/g, "")
    .slice(0, 120);

  return safeName || "download";
}

async function resolveDocumentRoot(rootBasePath: string) {
  if (!rootBasePath || !path.isAbsolute(rootBasePath)) {
    throw new DocumentFileError("INVALID_ROOT");
  }

  try {
    const rootLinkStat = await lstat(rootBasePath);
    if (rootLinkStat.isSymbolicLink()) {
      throw new DocumentFileError("SYMLINK_BLOCKED");
    }
    if (!rootLinkStat.isDirectory()) {
      throw new DocumentFileError("INVALID_ROOT");
    }
    return await realpath(rootBasePath);
  } catch (error) {
    if (error instanceof DocumentFileError) {
      throw error;
    }
    throw new DocumentFileError("INVALID_ROOT");
  }
}

async function assertNoSymlinkInPath(rootPath: string, relativePath: string) {
  if (!relativePath) {
    return;
  }

  let currentPath = rootPath;
  for (const part of relativePath.split(path.sep)) {
    currentPath = path.join(currentPath, part);
    let linkStat;
    try {
      linkStat = await lstat(currentPath);
    } catch {
      throw new DocumentFileError("NOT_FOUND");
    }
    if (linkStat.isSymbolicLink()) {
      throw new DocumentFileError("SYMLINK_BLOCKED");
    }
  }
}

function assertInsideRoot(rootPath: string, targetPath: string) {
  const relativeToRoot = path.relative(rootPath, targetPath);
  if (relativeToRoot === "") {
    return;
  }
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new DocumentFileError("OUTSIDE_ROOT");
  }
}

function joinRelative(base: string, name: string) {
  return [base, name].filter(Boolean).join("/");
}

function decodePathRepeatedly(value: string) {
  let decoded = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        return decoded;
      }
      decoded = nextDecoded;
    } catch {
      throw new DocumentFileError("INVALID_RELATIVE_PATH");
    }
  }
  if (/%[0-9a-f]{2}/i.test(decoded)) {
    throw new DocumentFileError("INVALID_RELATIVE_PATH");
  }
  return decoded;
}

function basenameFromAnySeparator(value: string) {
  return value.replaceAll("\\", "/").split("/").pop() ?? "";
}

async function hasExpectedImageSignature(filePath: string, mimeType: string) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    if (mimeType === "image/png") {
      return bytes.length >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a;
    }
    if (mimeType === "image/jpeg") {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === "image/gif") {
      const header = bytes.subarray(0, 6).toString("ascii");
      return header === "GIF87a" || header === "GIF89a";
    }
    if (mimeType === "image/webp") {
      return bytes.length >= 12
        && bytes.subarray(0, 4).toString("ascii") === "RIFF"
        && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    }
    if (mimeType === "image/avif") {
      return bytes.length >= 12 && bytes.subarray(4, 12).toString("ascii").startsWith("ftypavif");
    }
    return true;
  } finally {
    await handle.close();
  }
}

function documentFileErrorMessage(code: DocumentFileErrorCode) {
  switch (code) {
    case "INVALID_ROOT":
      return "Dokumentenablage ist nicht verfuegbar.";
    case "INVALID_RELATIVE_PATH":
      return "Ungueltiger Dokumentpfad.";
    case "NOT_FOUND":
      return "Dokument wurde nicht gefunden.";
    case "OUTSIDE_ROOT":
      return "Dokument liegt ausserhalb der freigegebenen Ablage.";
    case "SYMLINK_BLOCKED":
      return "Verknuepfte Dateien oder Ordner sind nicht erlaubt.";
    case "EXPECTED_FILE":
      return "Erwartete Datei wurde nicht gefunden.";
    case "EXPECTED_DIRECTORY":
      return "Erwarteter Ordner wurde nicht gefunden.";
  }
}

function isDocumentFileErrorCode(value: string): value is DocumentFileErrorCode {
  return value === "INVALID_ROOT"
    || value === "INVALID_RELATIVE_PATH"
    || value === "NOT_FOUND"
    || value === "OUTSIDE_ROOT"
    || value === "SYMLINK_BLOCKED"
    || value === "EXPECTED_FILE"
    || value === "EXPECTED_DIRECTORY";
}
