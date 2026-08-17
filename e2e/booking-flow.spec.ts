import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { format } from "date-fns";
import { Client } from "pg";

// Full customer path per the blueprint's testing strategy: quote, reserve,
// sign, pay handoff, mark paid. Hits the real DB, Google Places, Vercel
// Blob, and Resend — not run in the GitHub Actions CI job (which has none
// of those secrets configured), only via `npm run test:e2e` locally.

const TEST_ADDRESS = "1231 S 1440 E, Provo, UT 84606";
const TEST_EMAIL = "e2e-test@example.com";

async function deleteTestReservations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client
    .query('DELETE FROM "Reservation" WHERE "customerEmail" = $1', [TEST_EMAIL])
    .catch(() => {});
  await client.end();
}

function futureDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

async function goToMonth(page: Page, target: Date) {
  const label = format(target, "MMMM yyyy");
  for (let i = 0; i < 8; i++) {
    if (
      await page
        .getByText(label, { exact: true })
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
    await page.getByRole("button", { name: /go to the next month/i }).click();
  }
}

async function clickCalendarDay(page: Page, target: Date) {
  await goToMonth(page, target);
  const dayLabel = format(target, "EEEE, MMMM do, yyyy");
  await page.getByRole("button", { name: new RegExp(dayLabel) }).click();
}

test.beforeEach(async () => {
  // Defensive: a prior run that crashed mid-flow can leave an unpaid hold
  // behind, which would collide with this run's date range.
  await deleteTestReservations();
});

test.afterEach(async () => {
  await deleteTestReservations();
});

test("full booking flow: quote, reserve, sign, pay handoff, mark paid", async ({
  page,
}) => {
  test.slow();

  let publicId: string | undefined;
  page.on("response", async (response) => {
    if (
      response.request().method() === "POST" &&
      response.url().endsWith("/api/reservations") &&
      response.ok()
    ) {
      publicId = (await response.json().catch(() => ({}))).publicId;
    }
  });

  await page.goto("/quote");

  // --- Step 1: quote ---
  await page.getByPlaceholder(/start typing your address/i).click();
  await page.getByPlaceholder(/start typing your address/i).fill(TEST_ADDRESS);
  await expect(
    page.getByRole("button", { name: /provo/i }).first()
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /provo/i }).first().click();

  await page
    .getByRole("button", { name: /select start and end dates/i })
    .click();
  // Far enough out to comfortably clear any near-term blackouts/bookings.
  const startDate = futureDate(45);
  const endDate = futureDate(48);
  await clickCalendarDay(page, startDate);
  await clickCalendarDay(page, endDate);

  await expect(
    page.getByRole("button", { name: /pickup \(free\)/i })
  ).toBeVisible();
  await page.getByRole("button", { name: /pickup \(free\)/i }).click();

  await expect(page.getByRole("button", { name: /^continue$/i })).toBeEnabled({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /^continue$/i }).click();

  // --- Step 2: details ---
  await expect(page.getByText(/your contact info/i)).toBeVisible();
  await page.locator('input[autocomplete="name"]').fill("E2E Test Renter");
  await page.locator('input[autocomplete="email"]').fill(TEST_EMAIL);
  await page.locator('input[autocomplete="tel"]').fill("555-010-0100");

  await page.getByRole("button", { name: /hold these dates/i }).click();

  // --- Step 3: sign ---
  await expect(
    page.getByRole("heading", { name: /rental agreement/i })
  ).toBeVisible({ timeout: 15_000 });
  const scrollBox = page.getByTestId("agreement-scroll-box");
  await scrollBox.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const agreeCheckbox = page.getByRole("checkbox");
  await expect(agreeCheckbox).toBeEnabled();
  await agreeCheckbox.check();
  await expect(page.getByRole("button", { name: /^sign$/i })).toBeEnabled();
  await page.getByRole("button", { name: /^sign$/i }).click();

  // --- Step 4: pay ---
  await expect(page.getByText(/pay via venmo/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /open venmo/i })).toBeVisible();
  await page.getByRole("button", { name: /^i have paid$/i }).click();

  // --- Confirmed ---
  await expect(page.getByText(/payment received/i)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("h2", { hasText: /^SL-/ })).toBeVisible();
  expect(publicId).toMatch(/^SL-/);
});
