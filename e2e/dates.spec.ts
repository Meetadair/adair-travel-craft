import { expect, test } from "@playwright/test";

/**
 * The calendar must stay on screen until the traveller presses the search
 * button. It used to vanish the moment a range happened to be complete — which
 * included merely switching back to "Return", because that invented a return
 * date two days out. Every case below is that regression.
 */

type Page = import("@playwright/test").Page;

async function openDates(page: Page) {
  await page.goto("/assistant", { waitUntil: "networkidle" });
  const refuse = page.getByRole("button", { name: /refuse/i }).first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  await page.waitForTimeout(2500);
  await page.getByPlaceholder(/e\.g\./i).first().fill("Manhattan");
  await page.getByRole("button", { name: /compose trip/i }).first().click();
  await page.waitForTimeout(6000);
  await expect(calendar(page)).toBeVisible();
}

const calendar = (page: Page) => page.getByText(/September 2026|October 2026/).first();
const searchButton = (page: Page) =>
  page.getByRole("button", { name: /search these dates/i }).first();

test("picking only an outbound day keeps the calendar up", async ({ page }) => {
  await openDates(page);
  await page.getByRole("button", { name: "22", exact: true }).first().click();
  await page.waitForTimeout(1200);
  await expect(calendar(page)).toBeVisible();
  // Half a range is not a trip: the search button must refuse it.
  await expect(searchButton(page)).toBeDisabled();
});

test("switching to Return does not invent a return date or submit", async ({ page }) => {
  await openDates(page);
  await page.getByRole("button", { name: "22", exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Return$/i }).first().click();
  await page.waitForTimeout(1500);
  await expect(calendar(page)).toBeVisible();
  await expect(searchButton(page)).toBeDisabled();
});

test("One way completes the range but still waits to be told to search", async ({ page }) => {
  await openDates(page);
  await page.getByRole("button", { name: "22", exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^One way$/i }).first().click();
  await page.waitForTimeout(1500);
  await expect(calendar(page)).toBeVisible();
  await expect(searchButton(page)).toBeEnabled();
});

test("the flex chip does not close the calendar", async ({ page }) => {
  await openDates(page);
  await page.getByRole("button", { name: "22", exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("checkbox", { name: /3 days/i }).first().click();
  await page.waitForTimeout(1500);
  await expect(calendar(page)).toBeVisible();
});

test("a full round trip searches only when the button is pressed", async ({ page }) => {
  await openDates(page);
  await page.getByRole("button", { name: "22", exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "27", exact: true }).first().click();
  await page.waitForTimeout(1200);
  await expect(calendar(page)).toBeVisible();
  await expect(searchButton(page)).toBeEnabled();
  await searchButton(page).click();
  await page.waitForTimeout(3000);
  await expect(calendar(page)).toBeHidden();
});
