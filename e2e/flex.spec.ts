import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

/**
 * Adair asks a short chain of questions before it searches — which airport, a
 * car, an arrival time. A test that wants to see the result card has to answer
 * whatever it is asked, exactly as a traveller would.
 */
async function answerUntilCard(page: Page, sentence: string) {
  await page.goto("/assistant", { waitUntil: "networkidle" });
  const refuse = page.getByRole("button", { name: /refuse/i }).first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  await page.waitForTimeout(2500);
  await page.getByPlaceholder(/e\.g\./i).first().fill(sentence);
  await page.getByRole("button", { name: /compose trip/i }).first().click();

  const changeDates = page.getByRole("button", { name: /change dates/i }).first();
  for (let step = 0; step < 6; step += 1) {
    await page.waitForTimeout(6000);
    if (await changeDates.isVisible().catch(() => false)) return;
    // Take the plainest answer to whatever is on screen.
    for (const label of [/^no car$/i, /^no preference$/i, /^no transfer$/i, /^any time$/i]) {
      const option = page.getByRole("button", { name: label }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        break;
      }
    }
  }
}

const flexChip = (page: Page) => page.getByRole("button", { name: /3 days/i }).first();

test("the flex option is reachable while Adair is asking for dates", async ({ page }) => {
  await page.goto("/assistant", { waitUntil: "networkidle" });
  const refuse = page.getByRole("button", { name: /refuse/i }).first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  await page.waitForTimeout(2500);
  await page.getByPlaceholder(/e\.g\./i).first().fill("Lisbon next week");
  await page.getByRole("button", { name: /compose trip/i }).first().click();
  await page.waitForTimeout(8000);
  await expect(flexChip(page)).toBeVisible();
});

test("and on the result card, when the sentence already named the dates", async ({ page }) => {
  // The regression this test exists for: a traveller who wrote their own dates
  // was never shown a date picker, so the flexible-dates option — and any way
  // to change their mind about the dates — did not exist for them at all.
  await answerUntilCard(page, "Lisbon from 20 October to 24 October");
  await expect(flexChip(page)).toBeHidden();
  await page.getByRole("button", { name: /change dates/i }).first().click();
  await page.waitForTimeout(1000);
  await expect(flexChip(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /search these dates/i }).first()).toBeEnabled();
  await page.screenshot({ path: "e2e/shots/flex-on-card.png" });
});
