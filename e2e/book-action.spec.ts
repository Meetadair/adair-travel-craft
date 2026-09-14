import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

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
    for (const label of [/^no car$/i, /^no preference$/i, /^no transfer$/i, /^any time$/i]) {
      const option = page.getByRole("button", { name: label }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        break;
      }
    }
  }
}

test("booking is the action on the card, and saving is the quiet one", async ({ page }) => {
  await answerUntilCard(page, "Lisbon from 20 October to 24 October");

  const book = page.getByRole("button", { name: /book this trip/i }).first();
  const save = page.getByRole("button", { name: /save for later/i }).first();
  await expect(book).toBeVisible();
  await expect(save).toBeVisible();

  // The promise of the product is a booked trip, so booking is the button and
  // saving is a link. If these ever swap back, this test says so.
  const bookWeight = await book.evaluate((el) => getComputedStyle(el).fontWeight);
  const saveWeight = await save.evaluate((el) => getComputedStyle(el).fontWeight);
  expect(Number(bookWeight)).toBeGreaterThan(Number(saveWeight));

  await page.screenshot({ path: "e2e/shots/book-action.png" });
});

test("booking signed out sends you to sign in, keeping your sentence", async ({ page }) => {
  await answerUntilCard(page, "Lisbon from 20 October to 24 October");
  await page.getByRole("button", { name: /book this trip/i }).first().click();
  await page.waitForTimeout(3500);
  // An offer has to be held against somebody, so signing in is required — but
  // the traveller must come back to their sentence, not an empty box.
  await expect(page).toHaveURL(/\/auth/);
  const stashed = await page.evaluate(() =>
    window.localStorage.getItem("adair.assistant-prefill"),
  );
  expect(stashed).toContain("Lisbon");
});
