import { test } from "@playwright/test";

test("the date question shows the new picker", async ({ page }) => {
  await page.goto("/assistant", { waitUntil: "networkidle" });
  const refuse = page.getByRole("button", { name: /refuse/i }).first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  await page.waitForTimeout(2500);

  const input = page.getByPlaceholder(/e\.g\./i).first();
  if (await input.isVisible().catch(() => false)) {
    await input.fill("Manhattan");
    await page.getByRole("button", { name: /compose trip|show me the trip/i }).first().click();
    await page.waitForTimeout(9000);
  }
  console.log("URL:", page.url());
  const body = (await page.locator("body").innerText()).slice(0, 400);
  console.log("TRESC:", body.replace(/\n+/g, " | ").slice(0, 300));
  await page.screenshot({ path: "e2e/shots/10-dates.png", fullPage: false });
});
