import { beforeEach, expect, test, vi } from "vitest";
import { allowedForecastYear, developerFeaturesEnabled } from "../src/lib/developer-features";
import { forecastReference } from "../src/lib/expense-forecast";

const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSession: mocks.session }));
vi.mock("@/lib/db", () => ({ db: { user: { update: mocks.update } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { setDeveloperFeatures } from "../src/lib/developer-actions";

beforeEach(() => vi.resetAllMocks());

test.each([["ADMIN", true, true], ["ADMIN", false, false], ["MEMBER", true, false], ["MEMBER", false, false]])("role %s preference %s allows test years: %s", (role, developerFeatures, expected) => {
  const session = { role, user: { developerFeatures } };
  expect(developerFeaturesEnabled(session)).toBe(expected);
  const today = new Date("2026-09-14");
  const reference = forecastReference([{ date: "2024-03-01", kind: "EXPENSE", amountCents: 100 }], allowedForecastYear(session, "2024"), today);
  expect(reference.selectedYear).toBe(expected ? 2024 : null);
  if (!expected) expect(reference.date).toEqual(today);
});

test("direct member action is rejected even when the stored preference is enabled", async () => {
  mocks.session.mockResolvedValue({ role: "MEMBER", user: { id: "member", developerFeatures: true } });
  const form = new FormData(); form.set("developerFeatures", "on");
  await expect(setDeveloperFeatures(form)).rejects.toThrow("nur für Admins");
  expect(mocks.update).not.toHaveBeenCalled();
});

test("admin can only change their own setting, including switching it off", async () => {
  mocks.session.mockResolvedValue({ role: "ADMIN", user: { id: "admin" } });
  const form = new FormData(); form.set("userId", "victim"); form.set("developerFeatures", "on");
  await setDeveloperFeatures(form);
  expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: "admin" }, data: { developerFeatures: true } });
  form.delete("developerFeatures"); await setDeveloperFeatures(form);
  expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: "admin" }, data: { developerFeatures: false } });
});
