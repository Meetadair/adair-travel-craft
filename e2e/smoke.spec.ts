import { expect, test } from "@playwright/test";

test("the marketing page loads and offers the search", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Adair/i);
  // The one thing the whole product is about: a box you type a sentence into.
  const input = page.getByPlaceholder(/Milan|Rome|e\.g\./i).first();
  await expect(input).toBeVisible();
});

test("the assistant page answers", async ({ page }) => {
  const response = await page.goto("/assistant");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toBeVisible();
});
