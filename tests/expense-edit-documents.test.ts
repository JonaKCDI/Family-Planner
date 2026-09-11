import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(), find: vi.fn(), create: vi.fn(), remove: vi.fn(), change: vi.fn(),
  root: vi.fn(), file: vi.fn()
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSession: vi.fn(async () => ({ family: { id: "family" }, user: { id: "user" }, role: "MEMBER" })) }));
vi.mock("@/lib/db", () => ({ db: {
  expense: { updateMany: mocks.update },
  documentReference: { findFirst: mocks.find, create: mocks.create, deleteMany: mocks.remove, updateMany: mocks.change }
} }));
vi.mock("@/lib/relations", () => ({
  resolveExpenseCategoryId: vi.fn(), resolveExpenseLabelId: vi.fn(), resolveVisibleContractId: vi.fn(),
  resolveReadableDocumentRoot: mocks.root
}));
vi.mock("@/lib/document-files", () => ({ resolveDocumentFile: mocks.file }));
import { updateExpense } from "../src/lib/actions";

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id: "expense", amount: "12,50", date: "2026-09-10", documentId: "existing", paymentMethod: "Custom payment" })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.find.mockResolvedValue({ referenceType: "LOCAL_FILE" });
  mocks.root.mockResolvedValue({ id: "root", basePath: "/documents" });
  mocks.file.mockResolvedValue({ fileName: "receipt.pdf", relativePath: "receipt.pdf", mimeType: "application/pdf", fileSize: 10 });
});
test("editing ordinary fields preserves the existing NAS reference and custom payment method", async () => {
  await updateExpense(form());
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.change).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentMethod: "Custom payment" }) }));
});
test("adding a NAS attachment checks root access and keeps existing references", async () => {
  const data = form(); data.set("documentRootId", "root"); data.set("documentRelativePath", "receipt.pdf");
  await updateExpense(data);
  expect(mocks.root).toHaveBeenCalledWith("family", "user", "MEMBER", "root");
  expect(mocks.file).toHaveBeenCalledWith("/documents", "receipt.pdf");
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ referenceType: "LOCAL_FILE", documentRootId: "root", linkedEntityId: "expense" }) });
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.change).not.toHaveBeenCalled();
});
test("denied NAS access never creates a document reference", async () => {
  mocks.root.mockRejectedValue(new Error("Denied"));
  const data = form(); data.set("documentRootId", "root"); data.set("documentRelativePath", "receipt.pdf");
  await expect(updateExpense(data)).rejects.toThrow("Denied");
  expect(mocks.create).not.toHaveBeenCalled();
});
