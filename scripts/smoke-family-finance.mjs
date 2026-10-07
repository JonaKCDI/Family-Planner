import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";

process.loadEnvFile();
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/family_finance_test_20260911";
const db = new PrismaClient({datasourceUrl:url.toString()});
const browser = await chromium.launch({headless:true});
const tokens=[];
const failures=[];
const createdExpenseIds=[];
await mkdir(".next/family-smoke",{recursive:true});
try {
  for (const userId of ["a","b","outsider"]) {
    const token=randomBytes(32).toString("hex");tokens.push(token);
    await db.session.create({data:{token,userId,expiresAt:new Date(Date.now()+3600000)}});
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addCookies([{name:process.env.SESSION_COOKIE_NAME||"family_app_session",value:token,url:"http://localhost:3102"}]);
    const page=await context.newPage();
    page.on("pageerror",error=>failures.push(error.message));
    await page.goto("http://localhost:3102/ausgaben?bereich=familie&month=2026-09");
    await expect(page.getByRole("heading",{name:"Finanzen",exact:true})).toBeVisible();
    const json=await (await context.request.get("http://localhost:3102/api/expenses/list?bereich=familie&month=2026-09")).json();
    const payload=JSON.stringify(json);
    if(userId!=="outsider") {
      expect(payload).not.toContain("PRIVAT-NICHT-TEILEN");expect(payload).not.toContain("FREMDE-FAMILIE");
      expect(json.entries.map(e=>e.id).sort()).toEqual(["ea","eb"]);
      expect(json.entries.find(e=>e.id===(userId==="a"?"eb":"ea")).editExpense).toBeUndefined();
    }else {expect(json.entries.map(e=>e.id)).toEqual(["outsider-expense"]);}
    if(userId==="a") {
      for(const route of ["/ausgaben?bereich=familie&month=2026-09","/ausgaben?bereich=familie&month=2026-09&view=categories","/ausgaben?bereich=familie&view=people","/ausgaben/planung?bereich=familie","/ausgaben/setup?bereich=familie","/ausgaben/setup/kategorien?bereich=familie","/ausgaben/setup/zuordnungen?bereich=familie","/ausgaben/setup/serien?bereich=familie","/ausgaben/setup/sicherung?bereich=familie","/ausgaben?bereich=persoenlich&month=2026-09","/dashboard"]) {
        const response=await page.goto(`http://localhost:3102${route}`);
        expect(response.status()).toBe(200);
        expect(await page.locator("body").innerText()).not.toContain("Application error");
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
        expect(overflow,`Overflow: ${route}`).toBe(false);
      }
      await page.goto("http://localhost:3102/ausgaben?bereich=familie&month=2026-09");
      await page.screenshot({path:".next/family-smoke/mobile.png",fullPage:true});
      await page.getByRole("button",{name:"Finanzen filtern",exact:true}).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button",{name:"Schließen",exact:true}).click();
      await page.getByRole("button",{name:"Neu erstellen",exact:true}).click();
      const createForm=page.locator("form.finance-create-form");
      await expect(createForm.locator('[name="sharedWithFamily"]')).toBeChecked();
      await createForm.locator('[name="amount"]').fill("12,34");
      await createForm.locator('[name="date"]').fill("2026-09-14");
      await createForm.locator('[name="description"]').fill("Familien-Smoketest");
      await createForm.getByRole("button",{name:"Buchung speichern",exact:true}).click();
      await expect.poll(async()=>await db.expense.count({where:{ownerUserId:"a",description:"Familien-Smoketest",sharedWithFamily:true}})).toBe(1);
      const created=await db.expense.findFirst({where:{ownerUserId:"a",description:"Familien-Smoketest"}});createdExpenseIds.push(created.id);
      await page.goto("http://localhost:3102/ausgaben?bereich=familie&month=2026-09");
      await page.getByRole("button",{name:/Familien-Smoketest/}).click();
      await page.getByRole("button",{name:"Bearbeiten",exact:true}).click();
      const editForm=page.locator("form.expense-sheet-form");
      await editForm.locator('[name="sharedWithFamily"]').uncheck();
      await editForm.getByRole("button",{name:"Speichern",exact:true}).click();
      await expect.poll(async()=>(await db.expense.findUnique({where:{id:created.id}})).sharedWithFamily).toBe(false);
      const familyAfter=await (await context.request.get("http://localhost:3102/api/expenses/list?bereich=familie&month=2026-09")).json();
      expect(familyAfter.entries.some(e=>e.id===created.id)).toBe(false);
      await db.expense.delete({where:{id:created.id}});
      await page.goto("http://localhost:3102/ausgaben/setup/zuordnungen?bereich=familie");
      const mappingForm=page.locator("form.family-mapping-row").first();
      await mappingForm.locator('select[name="targetId"]').selectOption("");
      await mappingForm.getByRole("button",{name:"Zuordnen"}).click();
      await expect.poll(async()=>db.familyCategoryMapping.count({where:{familyId:"family",userId:"a",personalId:"legacy"}})).toBe(0);
      await mappingForm.locator('select[name="targetId"]').selectOption("shared-food");
      await mappingForm.getByRole("button",{name:"Zuordnen"}).click();
      await expect.poll(async()=>db.familyCategoryMapping.count({where:{familyId:"family",userId:"a",personalId:"legacy",targetId:"shared-food"}})).toBe(1);
      await page.goto("http://localhost:3102/ausgaben?bereich=familie&month=2026-09");

      await page.getByRole("button",{name:/Einkauf Ben/}).click();
      await expect(page.getByRole("button",{name:"Bearbeiten",exact:true})).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.goto("http://localhost:3102/ausgaben?bereich=familie&month=2026-09");
      await page.setViewportSize({width:1440,height:1000});
      await page.screenshot({path:".next/family-smoke/desktop.png",fullPage:true});
      const exportResponse=await context.request.get("http://localhost:3102/api/expenses/export?bereich=familie&year=2026");
      expect(exportResponse.status()).toBe(200);
      expect(exportResponse.headers()["content-disposition"]).toContain("Familienauswertung");
    }
    await context.close();
  }
  expect(failures).toEqual([]);
  console.log("PASS: three-user API isolation, mobile routes, desktop overview, read-only foreign expenses, export and browser errors.");
}finally{
  await browser.close();await db.expense.deleteMany({where:{id:{in:createdExpenseIds}}});await db.session.deleteMany({where:{token:{in:tokens}}});await db.$disconnect();
}
