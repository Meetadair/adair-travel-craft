import { expect, test } from "@playwright/test";
type Page = import("@playwright/test").Page;

async function card(page: Page, sentence: string) {
  await page.goto("/assistant", { waitUntil: "networkidle" });
  const refuse = page.getByRole("button", { name: /refuse/i }).first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  await page.waitForTimeout(2500);
  await page
    .getByPlaceholder(/e\.g\./i)
    .first()
    .fill(sentence);
  await page
    .getByRole("button", { name: /compose trip/i })
    .first()
    .click();
  const changeDates = page.getByRole("button", { name: /change dates/i }).first();
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(6000);
    if (await changeDates.isVisible().catch(() => false)) return;
    const soloChip = page.getByRole("button", { name: "1", exact: true }).first();
    if (await soloChip.isVisible().catch(() => false)) {
      await soloChip.click();
      const done = page.getByRole("button", { name: /^done$/i }).first();
      if (await done.isVisible().catch(() => false)) await done.click();
      continue;
    }
    const noCar = page.getByRole("button", { name: /^no car$/i }).first();
    if (await noCar.isVisible().catch(() => false)) await noCar.click();
  }
}

test("one way is on the card, not two clicks inside the calendar", async ({ page }) => {
  // It used to live only inside the date picker, so a traveller looking for it
  // could not find it at all without first opening something else.
  await card(page, "Lisbon from 20 October to 24 October");
  await expect(page.getByRole("button", { name: /^one way$/i }).first()).toBeVisible();
  await page.screenshot({ path: "e2e/shots/oneway-card.png" });
});

test("switching to one way re-searches and offers the way back", async ({ page }) => {
  await card(page, "Lisbon from 20 October to 24 October");
  await page
    .getByRole("button", { name: /^one way$/i })
    .first()
    .click();
  await page.waitForTimeout(12000);
  // Now it offers the return trip instead, and never invents a return date:
  // choosing it opens the calendar rather than guessing a day.
  const back = page.getByRole("button", { name: /^return$/i }).first();
  await expect(back).toBeVisible();
  await back.click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/September 2026|October 2026/).first()).toBeVisible();
});
