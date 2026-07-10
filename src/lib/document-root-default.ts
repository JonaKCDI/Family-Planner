import path from "node:path";

const LOCAL_DOCUMENTS_DIR = ".local-documents";

export function getConfiguredDocumentsDir() {
  const configuredDir = process.env.DOCUMENTS_DIR?.trim();
  if (configuredDir) return configuredDir;
  return process.platform === "win32" ? path.join(process.cwd(), LOCAL_DOCUMENTS_DIR) : "/mnt/documents";
}

export function isLocalDocumentsFallback(basePath: string) {
  if (process.env.DOCUMENTS_DIR?.trim() || process.platform !== "win32") return false;
  return path.resolve(basePath) === path.resolve(process.cwd(), LOCAL_DOCUMENTS_DIR)
    || path.resolve(basePath).startsWith(`${path.resolve(process.cwd(), LOCAL_DOCUMENTS_DIR)}${path.sep}`);
}
