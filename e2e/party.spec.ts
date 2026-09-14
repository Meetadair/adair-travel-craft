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

test("cabin and passengers can be set on the card, and reach the airline", async ({ page }) => {
  await answerUntilCard(page, "Lisbon from 20 October to 24 October");

  // The control names the current party, the way an airline site does.
  const opener = page.getByRole("button", { name: /1 adult · Economy/i }).first();
  await expect(opener).toBeVisible();
  await opener.click();
  await page.waitForTimeout(600);

  await expect(page.getByText(/16 and over/i).first()).toBeVisible();
  await expect(page.getByText(/12–15/).first()).toBeVisible();
  await expect(page.getByText(/Infants on a lap/i).first()).toBeVisible();

  await page.getByRole("button", { name: /^One more Adults$/i }).click();
  await page.getByRole("button", { name: /^One more Children$/i }).click();
  await page.getByRole("button", { name: /^Business$/ }).first().click();
  await page.waitForTimeout(400);

  const request = page.waitForRequest((r) => r.url().includes("composeTrip") || r.method() === "POST");
  await page.getByRole("button", { name: /^Done$/i }).first().click();
  await request;
  await page.waitForTimeout(12000);

  // The card comes back describing the party we asked for, not the old one.
  await expect(page.getByRole("button", { name: /2 adults, 1 child · Business/i }).first()).toBeVisible();
  await page.screenshot({ path: "e2e/shots/party.png" });
});

test("a lap infant cannot outnumber the adults who would hold it", async ({ page }) => {
  await answerUntilCard(page, "Lisbon from 20 October to 24 October");
  await page.getByRole("button", { name: /1 adult · Economy/i }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^One more Infants on a lap$/i }).click();
  await page.waitForTimeout(300);
  // One adult, one lap infant is fine; a second has no lap to sit on, so the
  // plus is refused rather than producing a booking the airline would reject.
  await expect(page.getByRole("button", { name: /^One more Infants on a lap$/i })).toBeDisabled();
});
