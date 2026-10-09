// Isolated browser check for the finance, cockpit and car overview corrections.
// Run after npm run build. The disposable database is always removed.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { once } from "node:events";
import { PrismaClient } from "@prisma/client";
import { chromium, expect } from "@playwright/test";

process.loadEnvFile();
const source = new URL(process.env.DATABASE_URL);
const database = `codex_overview_test_${randomBytes(6).toString("hex")}`;
const testURL = new URL(source);
testURL.pathname = `/${database}`;
const port = 3111;
const baseURL = `http://localhost:${port}`;
const db = new PrismaClient({ datasourceUrl: testURL.toString() });
const today = new Date();
const day = (offset) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
const psql = process.env.PSQL_BINARY || "C:/Program Files/PostgreSQL/17/bin/psql.exe";
let server, browser, created = false;

function sql(name, input) {
  const result = spawnSync(psql, ["-X", "-v", "ON_ERROR_STOP=1", "-h", source.hostname, "-p", source.port || "5432", "-U", decodeURIComponent(source.username), "-d", name], {
    input, encoding: "utf8", windowsHide: true, env: { ...process.env, PGPASSWORD: decodeURIComponent(source.password) }
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
}

try {
  sql(source.pathname.slice(1), `CREATE DATABASE "${database}";`);
  created = true;
  for (const name of (await readdir("prisma/migrations")).sort()) {
    if (/^\d/.test(name)) sql(database, await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  await db.family.create({ data: { id: "family", name: "Überblickstest" } });
  await db.user.create({ data: { id: "user", name: "Überblick Test", passwordHash: "test-only", memberships: { create: { familyId: "family", role: "ADMIN" } } } });
  await db.expenseLabel.createMany({ data: [
    ...["A", "B", "C", "D", "E"].map((id) => ({ id, familyId: "family", ownerUserId: "user", name: `Label ${id}` })),
    { id: "old", familyId: "family", ownerUserId: "user", name: "Altes Budget", budgetCents: 10000 },
    { id: "recent", familyId: "family", ownerUserId: "user", name: "Aktuelles Budget", budgetCents: 10000 }
  ] });
  await db.expense.createMany({ data: [
    ...["A", "B", "C", "D", "E"].map((labelId, index) => ({ familyId: "family", ownerUserId: "user", labelId, date: new Date(`2026-09-${String(10 + index).padStart(2, "0")}T00:00:00Z`), description: labelId, amountCents: 1000, kind: labelId === "E" ? "INCOME" : "EXPENSE" })),
    { familyId: "family", ownerUserId: "user", labelId: "old", date: day(-45), description: "Old", amountCents: 20000 },
    { familyId: "family", ownerUserId: "user", labelId: "recent", date: day(0), description: "Recent", amountCents: 9000 }
  ] });
  await db.car.createMany({ data: [
    { id: "car-a", familyId: "family", name: "Auto A" },
    { id: "car-b", familyId: "family", name: "Auto B" },
    { id: "car-empty", familyId: "family", name: "Auto Leer" }
  ] });
  await db.fuelEntry.createMany({ data: [
    { familyId: "family", carId: "car-a", date: new Date("2026-09-01T00:00:00Z"), odometerKm: 1000, litersMilli: 40000, costCents: 10000 },
    { familyId: "family", carId: "car-a", date: new Date("2026-10-01T00:00:00Z"), odometerKm: 1500, litersMilli: 30000, costCents: 5000 },
    { familyId: "family", carId: "car-b", date: new Date("2026-10-01T00:00:00Z"), odometerKm: 2000, litersMilli: 10000, costCents: 2000 },
    { familyId: "family", carId: "car-b", date: new Date("2026-10-08T00:00:00Z"), odometerKm: 2250, litersMilli: 15000, costCents: 3000 }
  ] });
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { userId: "user", token, expiresAt: new Date(Date.now() + 3600000) } });

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    windowsHide: true, env: { ...process.env, DATABASE_URL: testURL.toString(), APP_URL: baseURL }, stdio: ["ignore", "pipe", "pipe"]
  });
  let serverLog = "";
  server.stdout.on("data", (chunk) => { serverLog += chunk; });
  server.stderr.on("data", (chunk) => { serverLog += chunk; });
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try { if ((await fetch(`${baseURL}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true });
  await mkdir(".next/overview-smoke", { recursive: true });
  for (const [name, viewport] of [["iphone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]]) {
    const context = await browser.newContext({ viewport });
    await context.addCookies([{ name: process.env.SESSION_COOKIE_NAME || "family_app_session", value: token, url: baseURL }]);
    const page = await context.newPage();
    const goto = async (path) => { const response = await page.goto(`${baseURL}${path}`); expect(response.status(), path).toBe(200); };
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await goto("/ausgaben?from=2026-09-01&to=2026-09-30");
    await expect(page.locator(".finance-label-budget-section .finance-budget-row strong").first()).toHaveText("Label E");
    await expect(page.locator(".finance-label-budget-section .finance-budget-row")).toHaveCount(4);
    await noOverflow();
    await page.screenshot({ path: `.next/overview-smoke/finance-${name}.png`, fullPage: true });

    await goto("/dashboard");
    await expect(page.locator(".cockpit-budget-alert")).toHaveCount(1);
    await expect(page.locator(".cockpit-budget-alert")).toContainText("Aktuelles Budget");
    await noOverflow();

    await goto("/kilometer?car=car-a&month=2026-10");
    const allTime = page.locator(".mileage-all-time-section");
    await expect(allTime.locator(".finance-summary-metric")).toHaveCount(4);
    await expect(allTime).toContainText("150,00 €");
    await expect(allTime).toContainText("70,00 l");
    await expect(allTime).toContainText("6,00 l");
    await noOverflow();
    await page.screenshot({ path: `.next/overview-smoke/car-${name}.png`, fullPage: true });

    await goto("/kilometer?car=car-a&month=2026-10&q=not-found");
    await expect(page.locator(".mileage-all-time-section")).toContainText("150,00 €");
    await goto("/kilometer?car=car-b&month=2026-10");
    await expect(page.locator(".mileage-all-time-section")).toContainText("50,00 €");
    await goto("/kilometer?car=car-empty&month=2026-10");
    await expect(page.locator(".mileage-all-time-section")).toContainText("0,00 €");
    await expect(page.locator(".mileage-all-time-section")).toContainText("Nur mit messbarer Strecke");
    await noOverflow();
    await context.close();
  }
  console.log("PASS: finance labels, cockpit alerts, car all-time totals, filters, car switching, empty history, and mobile/desktop overflow.");
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await once(server, "exit"); }
  await db.$disconnect();
  if (created) sql(source.pathname.slice(1), `DROP DATABASE "${database}" WITH (FORCE);`);
}
