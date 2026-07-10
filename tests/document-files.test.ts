import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  DocumentFileError,
  getDocumentMimePolicy,
  listDocumentDirectory,
  normalizeRelativeDocumentPath,
  resolveDocumentPath,
  safeDocumentDownloadFileName
} from "../src/lib/document-files";

let tempDir: string;
let rootDir: string;
let outsideDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "family-documents-"));
  rootDir = path.join(tempDir, "root");
  outsideDir = path.join(tempDir, "outside");

  await mkdir(path.join(rootDir, "Finanzen"), { recursive: true });
  await mkdir(outsideDir);
  await writeFile(path.join(rootDir, "Finanzen", "rechnung.pdf"), "pdf");
  await writeFile(path.join(rootDir, "Finanzen", "notiz.txt"), "text");
  await writeFile(path.join(rootDir, "bild.jpg"), "jpg");
  await writeFile(path.join(outsideDir, "secret.txt"), "secret");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("document path resolution", () => {
  test("resolves only root-relative paths", async () => {
    const resolved = await resolveDocumentPath(rootDir, "Finanzen/rechnung.pdf", "file");

    expect(resolved).toMatchObject({
      relativePath: path.join("Finanzen", "rechnung.pdf"),
      name: "rechnung.pdf",
      kind: "file",
      mime: { mimeType: "application/pdf", previewMode: "pdf", contentDisposition: "inline" }
    });
    expect(resolved.absolutePath).toBe(path.join(rootDir, "Finanzen", "rechnung.pdf"));
  });

  test("lists directory entries without exposing host paths", async () => {
    const entries = await listDocumentDirectory(rootDir, "Finanzen");

    expect(entries.map((entry) => [entry.name, entry.kind, entry.mime.previewMode])).toEqual([
      ["notiz.txt", "file", "text"],
      ["rechnung.pdf", "file", "pdf"]
    ]);
    expect(entries.every((entry) => !entry.name.includes(rootDir))).toBe(true);
  });

  test("rejects traversal and absolute path variants before touching the target", async () => {
    const encodedTraversal = encodeURIComponent(encodeURIComponent("../outside/secret.txt"));
    const rejectedPaths = [
      "../outside/secret.txt",
      "..\\outside\\secret.txt",
      `Finanzen/${encodedTraversal}`,
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      "\\\\server\\share\\file.txt"
    ];

    for (const rejectedPath of rejectedPaths) {
      expect(() => normalizeRelativeDocumentPath(rejectedPath)).toThrow(DocumentFileError);
      await expect(resolveDocumentPath(rootDir, rejectedPath, "file")).rejects.toMatchObject({
        code: "INVALID_RELATIVE_PATH"
      });
    }
  });

  test("rejects missing files, directories requested as files, and files requested as directories", async () => {
    await expect(resolveDocumentPath(rootDir, "Finanzen/fehlt.pdf", "file")).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
    await expect(resolveDocumentPath(rootDir, "Finanzen", "file")).rejects.toMatchObject({
      code: "EXPECTED_FILE"
    });
    await expect(resolveDocumentPath(rootDir, "Finanzen/rechnung.pdf", "directory")).rejects.toMatchObject({
      code: "EXPECTED_DIRECTORY"
    });
  });

  test("blocks symlink files and symlink folders", async () => {
    const fileLinkCreated = await tryCreateSymlink(
      path.join(outsideDir, "secret.txt"),
      path.join(rootDir, "secret-link.txt"),
      "file"
    );
    const directoryLinkCreated = await tryCreateSymlink(outsideDir, path.join(rootDir, "outside-link"), "junction");

    if (fileLinkCreated) {
      await expect(resolveDocumentPath(rootDir, "secret-link.txt", "file")).rejects.toMatchObject({
        code: "SYMLINK_BLOCKED"
      });
    }
    if (directoryLinkCreated) {
      await expect(resolveDocumentPath(rootDir, "outside-link/secret.txt", "file")).rejects.toMatchObject({
        code: "SYMLINK_BLOCKED"
      });
    }

    expect(fileLinkCreated || directoryLinkCreated).toBe(true);
  });

  test("does not include real host paths in thrown error messages", async () => {
    await expect(resolveDocumentPath(rootDir, "../outside/secret.txt", "file")).rejects.not.toThrow(rootDir);
    await expect(resolveDocumentPath(rootDir, "Finanzen/fehlt.pdf", "file")).rejects.not.toThrow(tempDir);
  });
});

describe("document preview and download policy", () => {
  test("allows only conservative inline preview types", () => {
    expect(getDocumentMimePolicy("scan.pdf")).toMatchObject({ mimeType: "application/pdf", contentDisposition: "inline" });
    expect(getDocumentMimePolicy("foto.png")).toMatchObject({ mimeType: "image/png", contentDisposition: "inline" });
    expect(getDocumentMimePolicy("notiz.txt")).toMatchObject({ mimeType: "text/plain", contentDisposition: "inline" });
    expect(getDocumentMimePolicy("daten.csv")).toMatchObject({ mimeType: "text/csv", contentDisposition: "inline" });
    expect(getDocumentMimePolicy("vertrag.docx")).toMatchObject({
      mimeType: "application/octet-stream",
      previewMode: "download",
      contentDisposition: "attachment"
    });
  });

  test("sanitizes download filenames without path components", () => {
    expect(safeDocumentDownloadFileName("../Finanzen/Rechnung 2026.pdf")).toBe("Rechnung 2026.pdf");
    expect(safeDocumentDownloadFileName('CON: "bad"?.xlsx')).toBe("CON- -bad-.xlsx");
    expect(safeDocumentDownloadFileName("...")).toBe("download");
  });
});

async function tryCreateSymlink(target: string, linkPath: string, type: "file" | "junction") {
  try {
    await symlink(target, linkPath, type);
    return true;
  } catch (error) {
    if (isSymlinkPermissionError(error)) {
      return false;
    }
    throw error;
  }
}

function isSymlinkPermissionError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "EPERM" || error.code === "EACCES");
}
