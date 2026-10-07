// Deterministic, isolated screenshots for checking that desktop work leaves mobile unchanged.
// Usage: node scripts/desktop-visual-smoke.mjs baseline|final
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";

process.loadEnvFile();
const label = process.argv[2];
if (!["baseline", "final", "repro"].includes(label)) throw new Error("Use baseline, repro, or final.");
const source = new URL(process.env.DATABASE_URL);
const database = `codex_desktop_visual_${randomBytes(6).toString("hex")}`;
const url = new URL(source);
url.pathname = `/${database}`;
const port = 3107;
const baseURL = `http://localhost:${port}`;
const db = new PrismaClient({ datasourceUrl: url.toString() });
const psql = process.env.PSQL_BINARY || "C:/Program Files/PostgreSQL/17/bin/psql.exe";
const generatedTypeFiles = await Promise.all(["next-env.d.ts", "tsconfig.json"].map(async (path) => ({ path, contents: await readFile(path) })));
let server;
let browser;
let created = false;
const fixtureDirectory = resolve(`.next/desktop-visual-fixture-${database}`);

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
  const date = new Date();
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const day = new Date(`${month}-12T12:00:00Z`);
  await db.family.create({ data: { id: "family", name: "UI Testfamilie" } });
  await db.user.create({ data: { id: "admin", name: "UI Test", passwordHash: "test-only", memberships: { create: { familyId: "family", role: "ADMIN" } } } });
  await db.category.create({ data: { id: "food", familyId: "family", ownerUserId: "admin", type: "EXPENSE", name: "Lebensmittel", color: "#68a79a", monthlyBudgetCents: 40000 } });
  await db.expenseLabel.create({ data: { id: "house", familyId: "family", ownerUserId: "admin", name: "Haushalt" } });
  await db.expense.create({ data: { id: "expense", familyId: "family", ownerUserId: "admin", date: day, amountCents: 4280, description: "Wocheneinkauf", store: "Markt", categoryId: "food", labelId: "house", sharedWithFamily: true } });
  await db.task.create({ data: { id: "task", familyId: "family", ownerUserId: "admin", assignedToUserId: "admin", title: "Einkauf planen", description: "Liste prüfen", dueDate: day, priority: "HIGH" } });
  await db.contract.create({ data: { id: "contract", familyId: "family", ownerUserId: "admin", provider: "Muster Versicherung", contractType: "Versicherung", costCents: 2400, startDate: day, nextCancellationDate: day } });
  await db.car.create({ data: { id: "car", familyId: "family", name: "Familienauto" } });
  await db.fuelEntry.create({ data: { id: "fuel", familyId: "family", carId: "car", createdByUserId: "admin", date: day, odometerKm: 42000, litersMilli: 38000, costCents: 6800 } });
  await db.documentReference.create({ data: { id: "document", familyId: "family", ownerUserId: "admin", title: "Versicherungspolice", referenceType: "EXTERNAL_URL", url: "https://example.test/police", linkedEntityType: "CONTRACT", linkedEntityId: "contract" } });
  if (label === "repro") {
    await mkdir(fixtureDirectory, { recursive: true });
    await writeFile(resolve(fixtureDirectory, "policy.txt"), "Disposable NAS document for desktop audit.\n");
    await db.documentRoot.create({ data: { id: "root", familyId: "family", name: "NAS Test", basePath: fixtureDirectory, scope: "FAMILY", createdByUserId: "admin" } });
    await db.documentReference.create({ data: { id: "nas-document", familyId: "family", ownerUserId: "admin", title: "NAS Police", referenceType: "LOCAL_FILE", url: "", documentRootId: "root", relativePath: "policy.txt", fileName: "policy.txt", mimeType: "text/plain", linkedEntityType: "CONTRACT", linkedEntityId: "contract" } });
    await db.contract.update({ where: { id: "contract" }, data: { autoCreateExpenses: true, expensePaymentDay: 12, expenseCategoryId: "food", expenseLabelId: "house" } });
    await db.expense.create({ data: { id: "duplicate", familyId: "family", ownerUserId: "admin", date: day, amountCents: 4280, description: "Wocheneinkauf", store: "Markt", categoryId: "food", labelId: "house", sharedWithFamily: true } });
    await db.category.create({ data: { id: "income-cat", familyId: "family", ownerUserId: "admin", type: "EXPENSE", name: "Erstattung", color: "#8b80b8" } });
    await db.expense.create({ data: { id: "income", familyId: "family", ownerUserId: "admin", kind: "INCOME", date: day, amountCents: 5700, description: "Rückzahlung", categoryId: "income-cat" } });
    await db.expense.create({ data: { id: "usd", familyId: "family", ownerUserId: "admin", currency: "USD", date: day, amountCents: 2500, description: "Import in Dollar", categoryId: "food" } });
    await db.category.createMany({ data: Array.from({ length: 9 }, (_, index) => ({ id: `category-${index}`, familyId: "family", ownerUserId: "admin", type: "EXPENSE", name: `Testkategorie ${index + 1}`, color: "#b1bdb8" })) });
    await db.task.createMany({ data: Array.from({ length: 24 }, (_, index) => ({ id: `task-${index}`, familyId: "family", ownerUserId: "admin", assignedToUserId: "admin", title: `Aufgabe ${String(index + 1).padStart(2, "0")}`, dueDate: new Date(day.getTime() + index * 86400000) })) });
    await db.expense.createMany({ data: Array.from({ length: 42 }, (_, index) => ({ id: `expense-${index}`, familyId: "family", ownerUserId: "admin", date: day, amountCents: 1000 + index * 37, description: `Ausgabe ${String(index + 1).padStart(2, "0")}`, categoryId: `category-${index % 9}` })) });
  }
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { userId: "admin", token, expiresAt: new Date(Date.now() + 3600000) } });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
    windowsHide: true, env: { ...process.env, DATABASE_URL: url.toString(), APP_URL: baseURL, DESKTOP_VISUAL_DIST_DIR: ".next/desktop-visual-dev" }, stdio: ["ignore", "pipe", "pipe"]
  });
  let serverLog = "";
  server.stdout.on("data", chunk => { serverLog += chunk; });
  server.stderr.on("data", chunk => { serverLog += chunk; });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try { if ((await fetch(`${baseURL}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true });
  const routes = [
    ["cockpit", "/dashboard"], ["tasks", "/aufgaben"], ["finance", "/ausgaben"],
    ["finance-entries", "/ausgaben?view=entries"], ["finance-analysis", "/ausgaben?view=categories"],
    ["finance-detail", `/ausgaben/analyse/kategorie/food?month=${month}`], ["family-finance", "/ausgaben?bereich=familie"],
    ["forecast", "/ausgaben/planung"], ["finance-setup", "/ausgaben/setup"],
    ["auto", "/kilometer"], ["contracts", "/vertraege"], ["documents", "/dokumente"],
    ["settings", "/einstellungen"]
  ];
  const viewports = [
    ["iphone", { width: 390, height: 844 }],
    ["large-iphone", { width: 430, height: 932 }],
    ["landscape-phone", { width: 844, height: 390 }]
  ];
  for (const [viewportName, viewport] of process.argv.includes("--desktop-only") || label === "repro" ? [] : viewports) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await context.addCookies([{ name: process.env.SESSION_COOKIE_NAME || "family_app_session", value: token, url: baseURL }]);
    const page = await context.newPage();
    const output = `.next/desktop-visual/${label}/${viewportName}`;
    await mkdir(output, { recursive: true });
    for (const [name, path] of routes) {
      const response = await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
      if (response?.status() !== 200) throw new Error(`${viewportName} ${path}: ${response?.status()} ${serverLog.slice(-2000)}`);
      if (name === "finance-analysis") await page.locator(".finance-analysis-list .finance-drill-row").first().waitFor({ state: "visible" });
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: "disabled" });
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error(`Horizontal overflow: ${viewportName} ${path}`);
    }
    await page.goto(`${baseURL}/aufgaben`, { waitUntil: "networkidle" });
    await page.locator(".task-row-trigger").first().click();
    await page.screenshot({ path: `${output}/task-detail.png`, animations: "disabled" });
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });
    await page.locator(".fab-button").click();
    await page.screenshot({ path: `${output}/create.png`, animations: "disabled" });
    await context.close();
  }
  if (label === "final" || label === "repro") {
    const desktops = [
      ["compact", { width: 1024, height: 768 }],
      ["laptop", { width: 1280, height: 720 }],
      ["desktop", { width: 1366, height: 900 }],
      ["wide", { width: 1920, height: 1080 }]
    ];
    for (const [viewportName, viewport] of desktops) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
      await context.addCookies([{ name: process.env.SESSION_COOKIE_NAME || "family_app_session", value: token, url: baseURL }]);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const output = `.next/desktop-visual/${label}/${viewportName}`;
      await mkdir(output, { recursive: true });
      for (const [name, path] of routes) {
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
        if (response?.status() !== 200) throw new Error(`${viewportName} ${path}: ${response?.status()} ${serverLog.slice(-2000)}`);
        if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error(`Horizontal overflow: ${viewportName} ${path}`);
        await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: "disabled" });
      }
      await page.goto(`${baseURL}/aufgaben`, { waitUntil: "networkidle" });
      if (!await page.locator(".desktop-task-workspace").isVisible()) throw new Error(`${viewportName}: task workspace hidden`);
      await page.locator(".desktop-task-workspace .desktop-workspace-row").first().click();
      await page.waitForURL(/selected=/);
      await page.goto(`${baseURL}/ausgaben?view=entries`, { waitUntil: "networkidle" });
      if (!await page.locator(".desktop-finance-workspace .desktop-workspace-detail").isVisible()) throw new Error(`${viewportName}: finance inspector hidden`);
      await page.goto(`${baseURL}/ausgaben/analyse/kategorie/food?month=${month}`, { waitUntil: "networkidle" });
      if (!await page.locator(".desktop-analysis-list").isVisible()) throw new Error(`${viewportName}: category list hidden`);
      await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });
      const sidebarPosition = await page.locator(".app-nav").evaluate(element => getComputedStyle(element).position);
      if (sidebarPosition !== "sticky") throw new Error(`${viewportName}: sidebar position is ${sidebarPosition}`);
      await page.locator(".fab-button").click();
      if (!await page.locator(".modal-panel.create-dialog").isVisible()) throw new Error(`${viewportName}: create dialog hidden`);
      const chooserBounds = await page.locator(".modal-panel.create-dialog").boundingBox();
      if (!chooserBounds || chooserBounds.width > viewport.width - 40 || chooserBounds.x < 20 || chooserBounds.y < 20) throw new Error(`${viewportName}: create chooser is not a centered dialog: ${JSON.stringify(chooserBounds)}`);
      await page.screenshot({ path: `${output}/create.png`, animations: "disabled" });
      await page.locator(".create-type-blue").click();
      const formBounds = await page.locator(".modal-panel.create-dialog").boundingBox();
      if (!formBounds || formBounds.width > viewport.width - 40 || formBounds.x < 20 || formBounds.y < 20) throw new Error(`${viewportName}: create form is not a centered dialog`);
      await page.screenshot({ path: `${output}/create-task.png`, animations: "disabled" });
      if (label === "repro") {
        await page.goto(`${baseURL}/aufgaben`, { waitUntil: "networkidle" });
        if (!await page.locator(".desktop-task-workspace .task-sort-button").isVisible()) throw new Error(`${viewportName}: desktop task sort missing`);
        await page.locator(".desktop-task-workspace .task-sort-button").click();
        await page.locator('#task-sort-form select[name="sort"]').selectOption("date-desc");
        await page.locator('button[form="task-sort-form"]').click();
        await page.waitForURL(/sort=date-desc/);
        await page.screenshot({ path: `${output}/tasks-dense.png`, animations: "disabled" });
        await page.goto(`${baseURL}/ausgaben?view=entries&month=${month}`, { waitUntil: "networkidle" });
        if (!await page.locator(".desktop-finance-workspace .desktop-workspace-head").getByText("31.10.2026", { exact: false }).isVisible()) throw new Error(`${viewportName}: monthly caption does not end on 31 October`);
        if (!await page.locator(".desktop-finance-workspace .expense-sort-control").isVisible()) throw new Error(`${viewportName}: desktop expense sort missing`);
        if (!await page.locator(".desktop-finance-workspace .duplicate-action-button").isVisible()) throw new Error(`${viewportName}: duplicate review missing`);
        await page.screenshot({ path: `${output}/duplicates.png`, animations: "disabled" });
        await page.locator(".desktop-finance-workspace .expense-sort-trigger").click();
        await page.locator('.expense-sort-modal-form select[name="sort"]').selectOption("amount-desc");
        await page.locator(".expense-sort-modal-form button[type=submit]").click();
        await page.waitForURL(/sort=amount-desc/);
        await page.locator(".desktop-finance-workspace .duplicate-action-button").click();
        if (!await page.locator(".duplicate-review").isVisible()) throw new Error(`${viewportName}: duplicate review did not open`);
        await page.screenshot({ path: `${output}/duplicate-dialog.png`, animations: "disabled" });
        await page.goto(`${baseURL}/ausgaben?view=entries&month=${month}`, { waitUntil: "networkidle" });
        await page.locator(".finance-filter-button").click();
        const furtherFilter = page.locator(".finance-more-filters-link");
        if (!await furtherFilter.isVisible()) throw new Error(`${viewportName}: further finance filters hidden`);
        const filterLabel = await furtherFilter.locator("span").boundingBox();
        const filterDescription = await furtherFilter.locator("small").boundingBox();
        const filterChevron = await furtherFilter.locator("svg").boundingBox();
        if (!filterLabel || !filterDescription || !filterChevron || filterDescription.y <= filterLabel.y || filterChevron.x < Math.max(filterLabel.x + filterLabel.width, filterDescription.x + filterDescription.width) - 2) throw new Error(`${viewportName}: further filter text overlaps`);
        await page.screenshot({ path: `${output}/finance-filter.png`, animations: "disabled" });
        await furtherFilter.click();
        if (!await page.getByText("Zahlungsarten", { exact: true }).isVisible()) throw new Error(`${viewportName}: payment filters did not open`);
        await page.locator(".finance-filter-subhead button").click();
        await page.locator('.finance-filter-form input[name="kind"][value="income"]').check({ force: true });
        await page.locator('button[form="finance-filter-form"]').click();
        await page.waitForURL(/kind=income/);
        await page.goto(`${baseURL}/ausgaben?view=entries&month=${month}`, { waitUntil: "networkidle" });
        await page.locator(".desktop-finance-workspace .desktop-expense-edit-trigger").click();
        if (!await page.getByText("Buchung bearbeiten", { exact: true }).isVisible()) throw new Error(`${viewportName}: booking edit dialog missing`);
        await page.screenshot({ path: `${output}/edit-booking.png`, animations: "disabled" });
        await page.goto(`${baseURL}/ausgaben?view=categories&month=${month}`, { waitUntil: "networkidle" });
        if (!await page.locator(".desktop-analysis-inline .finance-detail").isVisible()) throw new Error(`${viewportName}: category detail missing`);
        await page.screenshot({ path: `${output}/income-currencies.png`, animations: "disabled" });
        await page.locator('.desktop-analysis-overview-list a[href*="selected=income-cat"]').click();
        await page.waitForURL(/selected=income-cat/);
        if (!await page.locator(".desktop-analysis-inline .finance-detail").getByText("Erstattung").first().isVisible()) throw new Error(`${viewportName}: income-only category did not select`);
        await page.locator(".desktop-analysis-inline .finance-period-link").first().click();
        await page.waitForURL(/view=entries/);
        if (!page.url().includes("category=income-cat")) throw new Error(`${viewportName}: period link lost selected category`);
        await page.goBack({ waitUntil: "networkidle" });
        if (!page.url().includes("selected=income-cat")) throw new Error(`${viewportName}: return navigation lost category selection`);
        await page.goto(`${baseURL}/dokumente?tab=links`, { waitUntil: "networkidle" });
        if (await page.locator('.desktop-document-workspace .desktop-workspace-row[href*="file%3A"]').count()) throw new Error(`${viewportName}: raw NAS file shown in links tab`);
        await page.screenshot({ path: `${output}/documents-links.png`, animations: "disabled" });
        await page.goto(`${baseURL}/dokumente?tab=linked`, { waitUntil: "networkidle" });
        if (await page.locator('.desktop-document-workspace .desktop-workspace-row[href*="file%3A"]').count()) throw new Error(`${viewportName}: raw NAS file shown in linked tab`);
        await page.goto(`${baseURL}/dokumente?tab=files`, { waitUntil: "networkidle" });
        if (!await page.locator('.desktop-document-workspace .desktop-workspace-row[href*="file%3A"]').count()) throw new Error(`${viewportName}: NAS file missing in files tab`);
        if (!await page.locator(".desktop-document-workspace").getByText("Pfad").first().isVisible()) throw new Error(`${viewportName}: saved NAS path missing`);
        await page.goto(`${baseURL}/vertraege`, { waitUntil: "networkidle" });
        if (!await page.locator('.desktop-contract-workspace a[href="/api/documents/file?id=nas-document&download=1"]').isVisible()) throw new Error(`${viewportName}: NAS contract document link missing`);
        const download = await page.request.get(`${baseURL}/api/documents/file?id=nas-document&download=1`);
        if (download.status() !== 200 || !download.headers()["content-disposition"]?.includes("attachment")) throw new Error(`${viewportName}: linked NAS download failed (${download.status()})`);
        if (!await page.locator(".desktop-contract-workspace").getByText("Kategorie: Lebensmittel").isVisible()) throw new Error(`${viewportName}: contract auto-expense category missing`);
        await page.screenshot({ path: `${output}/contract-nas.png`, animations: "disabled" });
      }
      if (errors.length) throw new Error(`${viewportName} browser errors: ${errors.join(" | ")}`);
      await context.close();
    }
  }
  console.log(`Captured ${label} ${process.argv.includes("--desktop-only") ? "desktop" : "mobile and desktop"} screenshots in .next/desktop-visual/${label}`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) {
    if (server.exitCode === null) {
      server.kill();
      await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    }
  }
  try {
    await db.$disconnect();
    if (created) sql(source.pathname.slice(1), `DROP DATABASE "${database}" WITH (FORCE);`);
    if (label === "repro") await rm(fixtureDirectory, { recursive: true, force: true });
  } finally {
    for (const file of generatedTypeFiles) await writeFile(file.path, file.contents);
  }
}
