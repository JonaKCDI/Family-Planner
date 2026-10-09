// Runs against a fresh, isolated PostgreSQL database; never migrates app data.
// Run after npm run build. Screenshots remain in .next/analysis-smoke.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { once } from "node:events";
import { PrismaClient } from "@prisma/client";
import { chromium, expect } from "@playwright/test";

process.loadEnvFile();
const source = new URL(process.env.DATABASE_URL);
const database = `codex_analysis_test_${randomBytes(6).toString("hex")}`;
const port = 3103;
const baseURL = `http://localhost:${port}`;
const testURL = new URL(source); testURL.pathname = `/${database}`;
const db = new PrismaClient({ datasourceUrl: testURL.toString() });
const sql = (name, input) => {
  const result = spawnSync(process.env.PSQL_BINARY || "C:/Program Files/PostgreSQL/17/bin/psql.exe", ["-X", "-v", "ON_ERROR_STOP=1", "-h", source.hostname, "-p", source.port || "5432", "-U", decodeURIComponent(source.username), "-d", name], {
    input, encoding: "utf8", windowsHide: true, env: { ...process.env, PGPASSWORD: decodeURIComponent(source.password) }
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
};
let server, browser, created = false;
const errors = [];
try {
  sql(source.pathname.slice(1), `CREATE DATABASE "${database}";`); created = true;
  for (const name of (await readdir("prisma/migrations")).sort()) {
    if (!/^\d/.test(name)) continue;
    sql(database, await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  await db.family.create({ data: { id: "f", name: "Analyse Testfamilie" } });
  await db.family.create({ data: { id: "other", name: "Andere Familie" } });
  for (const [id, role, familyId] of [["admin", "ADMIN", "f"], ["member", "MEMBER", "f"], ["outsider", "ADMIN", "other"]]) {
    const user = await db.user.create({ data: { id, name: `Analyse ${id}`, passwordHash: "test-only-no-login", memberships: { create: { familyId, role } } } });
    expect(user.developerFeatures).toBe(false);
  }
  for (const [id, ownerUserId, familyId] of [["food", "admin", "f"], ["foreign", "member", "f"], ["outside", "outsider", "other"]]) {
    await db.category.create({ data: { id, familyId, ownerUserId, type: "EXPENSE", name: id === "food" ? "Lebensmittel und gemeinsame Einkäufe" : "Private Kategorie", color: "#268577" } });
  }
  await db.expenseLabel.create({ data: { id: "label", familyId: "f", ownerUserId: "admin", name: "Familienurlaub und Erstattungen", color: "#a97a43" } });
  const years = [2022, 2023, 2024, 2025, 2026];
  for (const year of years) for (let month = 1; month <= 9; month++) {
    await db.expense.create({ data: { id: `e-${year}-${month}`, familyId: "f", ownerUserId: "admin", kind: "EXPENSE", amountCents: 12000 + month * 1375, date: new Date(`${year}-${String(month).padStart(2, "0")}-12`), categoryId: "food", labelId: "label", description: "Wocheneinkauf", paymentMethod: "Karte", sharedWithFamily: true } });
  }
  await db.expense.create({ data: { familyId: "f", ownerUserId: "admin", kind: "INCOME", amountCents: 2300, date: new Date("2026-09-13"), categoryId: "food", labelId: "label", description: "Erstattung" } });
  await db.expense.create({ data: { id: "no-category", familyId: "f", ownerUserId: "admin", kind: "EXPENSE", amountCents: 123, date: new Date("2026-09-01"), description: "Ohne Zuordnung", sharedWithFamily: true } });
  await db.expense.create({ data: { id: "private", familyId: "f", ownerUserId: "member", kind: "EXPENSE", amountCents: 999999, date: new Date("2026-09-01"), categoryId: "foreign", description: "PRIVATE-SECRET" } });
  await db.documentReference.create({ data: { familyId: "f", ownerUserId: "admin", referenceType: "EXTERNAL_URL", linkedEntityType: "EXPENSE", linkedEntityId: "e-2026-9", title: "Suchbeleg Einzigartig", url: "https://example.test/beleg", scope: "PRIVATE" } });
  await db.familyFinanceCategory.create({ data: { id: "shared", familyId: "f", name: "Lebensmittel und gemeinsame Einkäufe", color: "#268577" } });
  await db.familyFinanceLabel.create({ data: { id: "shared-label", familyId: "f", name: "Familienurlaub", color: "#a97a43" } });
  await db.familyCategoryMapping.create({ data: { familyId: "f", userId: "admin", personalId: "food", targetId: "shared" } });
  await db.familyLabelMapping.create({ data: { familyId: "f", userId: "admin", personalId: "label", targetId: "shared-label" } });
  await db.car.create({ data: { id: "smoke-car", familyId: "f", name: "Prüfauto" } });
  await db.fuelEntry.createMany({ data: [
    { familyId: "f", carId: "smoke-car", date: new Date("2026-08-01"), odometerKm: 1000, litersMilli: 30000, costCents: 6000 },
    { familyId: "f", carId: "smoke-car", date: new Date("2026-09-01"), odometerKm: 1500, litersMilli: 35000, costCents: 7000 }
  ] });
  console.log("PASS: migrations applied to isolated database; developer preference defaults to false.");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { windowsHide: true, env: { ...process.env, DATABASE_URL: testURL.toString(), APP_URL: baseURL }, stdio: ["ignore", "pipe", "pipe"] });
  let serverLog = "";
  server.stdout.on("data", chunk => { serverLog += chunk; });
  server.stderr.on("data", chunk => { serverLog += chunk; });
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${serverLog}`);
    try { if ((await fetch(`${baseURL}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true });
  await mkdir(".next/analysis-smoke", { recursive: true });
  for (const userId of ["admin", "member", "outsider"]) {
    const token = randomBytes(32).toString("hex");
    await db.session.create({ data: { userId, token, expiresAt: new Date(Date.now() + 3600000) } });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: process.env.SESSION_COOKIE_NAME || "family_app_session", value: token, url: baseURL }]);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
    const goto = async path => { const response = await page.goto(`${baseURL}${path}`); expect(response.status(), path).toBe(200); };
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    await goto("/einstellungen");
    if (userId === "member") {
      await expect(page.getByRole("link", { name: /Entwicklerfunktionen/ })).toHaveCount(0);
      // Even a stale enabled preference cannot grant developer behavior to a member.
      await db.user.update({ where: { id: userId }, data: { developerFeatures: true } });
      await page.goto(`${baseURL}/einstellungen/entwickler`);
      await expect(page.getByRole("switch")).toHaveCount(0);
      await goto("/ausgaben/planung?bereich=familie&year=2025");
      await expect(page.getByText("Testjahr 2025", { exact: false })).toHaveCount(0);
      await expect(page.locator('select[name="year"]')).toHaveCount(0);
      await goto("/ausgaben/planung?year=2025");
      await expect(page.getByText("Datengrundlage", { exact: false })).toHaveCount(0);
      await expect(page.getByText("Testjahr 2025", { exact: false })).toHaveCount(0);
    }
    if (userId !== "admin") {
      await page.goto(`${baseURL}/ausgaben/analyse/kategorie/food?year=2026`);
      await expect(page.getByRole("heading", { name: "Lebensmittel und gemeinsame Einkäufe", exact: true })).toHaveCount(0);
      if (userId === "outsider") {
        await page.goto(`${baseURL}/ausgaben/analyse/kategorie/shared?bereich=familie&year=2026`);
        await expect(page.getByRole("heading", { name: "Lebensmittel und gemeinsame Einkäufe", exact: true })).toHaveCount(0);
      } else {
        await goto("/ausgaben/analyse/kategorie/shared?bereich=familie&year=2026");
        expect(await page.locator("body").innerText()).not.toContain("PRIVATE-SECRET");
      }
      await context.close(); continue;
    }
    for (const path of ["/dashboard", "/aufgaben", "/vertraege", "/dokumente", "/kilometer?car=smoke-car", "/einstellungen", "/ausgaben/setup", "/ausgaben/planung"]) {
      await goto(path);
      await noOverflow();
    }
    await goto("/dashboard");
    await expect(page.getByText("Prüfauto")).toBeVisible();
    console.log("PASS: cockpit, tasks, contracts, documents, car, settings, finance setup and forecast load at mobile width.");
    await goto("/ausgaben/planung?year=2025");
    await expect(page.locator('select[name="year"]')).toHaveCount(0);
    await expect(page.getByText("Testjahr 2025", { exact: false })).toHaveCount(0);
    await goto("/einstellungen/entwickler");
    await expect(page.getByRole("switch")).not.toBeChecked();
    await page.getByRole("switch").check();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Einstellung gespeichert" })).toBeVisible();
    expect((await db.user.findUnique({ where: { id: "admin" } })).developerFeatures).toBe(true);
    await goto("/ausgaben/planung?year=2025");
    await expect(page.locator('select[name="year"]')).toBeVisible();
    await expect(page.getByText(/Testjahr 2025/)).toBeVisible();
    await goto("/ausgaben/planung/kategorie/food?year=2025");
    await expect(page.getByText(/Testansicht/)).toBeVisible();
    await goto("/einstellungen/entwickler");
    await page.getByRole("switch").uncheck();
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Einstellung gespeichert" })).toBeVisible();
    await goto("/ausgaben/planung/kategorie/food?year=2025");
    await expect(page.getByText(/Testansicht/)).toHaveCount(0);
    await goto("/ausgaben?month=2026-09&view=categories&label=label");
    const row = page.locator(".finance-drill-row").first();
    expect(await row.locator("a a").count()).toBe(0);
    for (const link of await row.locator(".finance-analysis-icon").all()) { const box = await link.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    await noOverflow();
    await page.screenshot({ path: ".next/analysis-smoke/categories-mobile.png", fullPage: true });
    await row.getByRole("link", { name: /^Analyse:/ }).click();
    await expect(page.getByRole("heading", { name: "Wochen im Detail" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("label")).toBe("label");
    await noOverflow();
    await page.screenshot({ path: ".next/analysis-smoke/detail-mobile.png", fullPage: true });
    const listHref = await page.getByRole("link", { name: /^Alle Buchungen:/ }).getAttribute("href");
    const listParams = new URL(listHref, baseURL).searchParams;
    const payload = await (await context.request.get(`${baseURL}/api/expenses/list?${listParams}`)).json();
    expect(payload.entries.filter(e => e.kind === "EXPENSE").reduce((sum, e) => sum + e.amountCents, 0)).toBe(24375);
    const backLink = page.getByRole("link", { name: "Zurück zur Analyse", exact: true });
    expect(new URL(await backLink.getAttribute("href"), baseURL).searchParams.get("month")).toBe("2026-09");
    await backLink.click();
    await expect(page).toHaveURL(/\/ausgaben\?month=2026-09/);
    expect(new URL(page.url()).searchParams.get("month")).toBe("2026-09");
    expect(new URL(page.url()).searchParams.get("label")).toBe("label");
    await page.locator(".finance-drill-row").first().getByRole("link", { name: /^Buchungen:/ }).click();
    await expect(page).toHaveURL(/view=entries/);
    expect(new URL(page.url()).searchParams.get("view")).toBe("entries");
    for (const [path, heading] of [
      ["/ausgaben/analyse/kategorie/food?year=2026", "Monate im Detail"],
      ["/ausgaben/analyse/kategorie/food?from=2022-01-01&to=2026-09-30", "Jahre im Detail"],
      ["/ausgaben/analyse/label/label?year=2026", "Monate im Detail"],
      ["/ausgaben/analyse/kategorie/shared?bereich=familie&year=2026", "Monate im Detail"],
      ["/ausgaben/analyse/label/shared-label?bereich=familie&year=2026", "Monate im Detail"],
      ["/ausgaben/analyse/kategorie/unassigned?month=2026-09", "Wochen im Detail"],
      ["/ausgaben/analyse/kategorie/food?year=2026&q=Suchbeleg", "Monate im Detail"]
    ]) { await goto(path); await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible(); await noOverflow(); }
    await goto("/ausgaben/analyse/kategorie/food?year=2026");
    await page.setViewportSize({ width: 1366, height: 900 });
    await noOverflow();
    expect((await page.locator(".finance-detail-chart").boundingBox()).height).toBeLessThan(400);
    await page.screenshot({ path: ".next/analysis-smoke/detail-desktop.png", fullPage: true });
    await goto("/ausgaben/analyse/kategorie/food?year=2020");
    await expect(page.getByText(/Keine Buchungen in diesem Zeitraum/)).toBeVisible();
    console.log("PASS: admin toggle on/off, personal/family/category/label routes, filters, weekly/monthly/yearly views, amounts, empty state, mobile and desktop.");
    await context.close();
  }
  expect(errors).toEqual([]);
  console.log("PASS: member has no developer UI or test-year effects; foreign category and family access denied; no browser errors.");
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await once(server, "exit"); }
  await db.$disconnect();
  if (created) sql(source.pathname.slice(1), `DROP DATABASE "${database}" WITH (FORCE);`);
}
