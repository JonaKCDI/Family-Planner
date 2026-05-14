import { expect, test } from "@playwright/test";

test("login and setup screens keep controls aligned responsively", async ({ page }, testInfo) => {
  await page.goto("/login");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("input:not([type='hidden']), button").first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("login-responsive.png"), fullPage: true, animations: "disabled" });

  await page.goto("/setup");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("input:not([type='hidden']), button").first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("setup-responsive.png"), fullPage: true, animations: "disabled" });
});

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}
