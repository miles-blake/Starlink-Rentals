import { test, expect } from "@playwright/test";

test("home page loads with the placeholder hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /rent a starlink kit/i })
  ).toBeVisible();
});

test("unauthenticated visitors are redirected to admin login", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("heading", { name: /admin sign in/i })
  ).toBeVisible();
});

test("quote page loads with the address and date inputs", async ({ page }) => {
  await page.goto("/quote");
  await expect(
    page.getByPlaceholder(/start typing your address/i)
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /select start and end dates/i })
  ).toBeVisible();
});

test("status page loads with the lookup form", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByPlaceholder(/sl-xxxx/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /check status/i })
  ).toBeVisible();
});
