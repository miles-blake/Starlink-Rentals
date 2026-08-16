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
