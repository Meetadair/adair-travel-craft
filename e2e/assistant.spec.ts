import { expect, test } from "@playwright/test";

/**
 * The sentence a real traveller typed, kept verbatim — typos included.
 *
 * It found a bug no code review caught: the German alias for Rome, "rom",
 * matched inside the word "from", so this trip used to end up in Italy.
 */
const SENTENCE =
  "good morning, next Monday morning i need to fly to San Francisco best bussines class " +
  "from Warsaw, please book taxi in the morning form my house to the airport. 7 nights " +
  "book some good hotel next to antropick office. also in the morning, I need a good " +
  "restaurant every night, make some nice selection and book, for 2 people, second dsay " +
  "for 10 people. order limo from the airport to the hotel. i dont need breakfestst.";

test("a real sentence reaches a real answer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");

  // The consent banner sits over the page and swallows the first click. A real
  // traveller answers it before anything else, so the test does too. Refuse is
  // the honest default: nothing here needs the optional counts.
  const refuse = page.getByRole("button", { name: /refuse|odrzu/i }).first();
  if (await refuse.isVisible().catch(() => false)) {
    await refuse.click();
    await expect(refuse).toBeHidden();
  }

  const input = page.getByPlaceholder(/e\.g\./i).first();
  await expect(input).toBeVisible();
  await input.fill(SENTENCE);
  await page.screenshot({ path: "e2e/shots/01-typed.png", fullPage: false });

  await page
    .getByRole("button", { name: /compose trip|show me the trip/i })
    .first()
    .click();

  // Whatever comes back — a card, a question, an apology — it must arrive.
  await page.waitForTimeout(12_000);
  await page.screenshot({ path: "e2e/shots/02-answer.png", fullPage: true });

  const body = (await page.locator("body").innerText()).toLowerCase();
  console.log("=== CZY W ODPOWIEDZI JEST ===");
  for (const term of ["san francisco", "rome", "warsaw", "business", "sep", "hotel", "sample"]) {
    console.log(`  ${term.padEnd(16)} ${body.includes(term) ? "TAK" : "nie"}`);
  }
  console.log("=== BLEDY KONSOLI ===");
  console.log(errors.length ? errors.slice(0, 5).join("\n") : "  zadnych");

  // The one thing that must never happen again.
  expect(body).not.toContain("rome");
});
