import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.AUDIT_BASE_URL || "http://127.0.0.1:3000";
const OUTPUT_DIR = path.resolve("audit/strap-previews");

const categories = [
  { label: "Leather", testId: "category-leather" },
  { label: "Rubber", testId: "category-rubber" },
  { label: "Fabric", testId: "category-fabric" },
  { label: "Metal", testId: "category-metal" }
];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const screenshotName = (category, strap) =>
  `${slugify(category)}__${slugify(strap)}.png`;

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1800 },
  deviceScaleFactor: 1
});

try {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.locator("[data-testid='preview-canvas']").waitFor({ timeout: 120000 });

  for (const category of categories) {
    await page.locator(`[data-testid='${category.testId}']`).click();
    await page.waitForTimeout(700);

    const strapButtons = page.locator("[data-testid^='strap-']");
    const count = await strapButtons.count();

    for (let index = 0; index < count; index += 1) {
      const strapButton = strapButtons.nth(index);
      const strapName = (await strapButton.textContent())?.split("\n")[0]?.trim() || `strap-${index + 1}`;
      await strapButton.click();
      await page.waitForTimeout(900);

      const target = path.join(OUTPUT_DIR, screenshotName(category.label, strapName));
      await page.locator("[data-testid='preview-canvas']").screenshot({ path: target });
      console.log(`saved ${target}`);
    }
  }
} finally {
  await browser.close();
}
