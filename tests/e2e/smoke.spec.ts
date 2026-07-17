import { expect, test } from "@playwright/test";

test("la página raíz carga", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});
