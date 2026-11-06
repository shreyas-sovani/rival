import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";

import { routes } from "../src/viewmodels/routes";
import { expect, test } from "./support/fixtures";
import { shellContent, shellTitle } from "./support/shell";

/**
 * S-021 accessibility gate (AT-16).
 *
 * Visits every route in `src/viewmodels/routes.ts` on the static server
 * started by `playwright.config.ts` and fails on axe serious or critical
 * violations. Chromium is enough for this scan; the Firefox and WebKit
 * smoke projects stay in the config and are not removed.
 *
 * The CI job that should run this spec is waiting on S-003.
 * `.github/workflows/ci.yml` is owned by S-003 and blocked on a human,
 * so this change does not append that job.
 */

const blockingImpacts = new Set(["serious", "critical"]);

function formatViolations(violations: readonly Result[]): string {
  if (violations.length === 0) return "no serious or critical axe violations";
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(" | ");
      return `${violation.impact}: ${violation.id} — ${violation.help} [${targets}] (${violation.helpUrl})`;
    })
    .join("\n");
}

test.describe("@a11y", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "axe gate runs on the existing Chromium project");
  });

  for (const route of routes) {
    test(`@a11y ${route.path} ${route.title}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(shellTitle(page)).toHaveText(route.title);
      await expect(shellContent(page)).toBeVisible();
      // `/auction` SSR renders a transient "reading the link" state, then
      // replaces it from the query string. Scan the settled shell.
      await expect(page.getByText("Reading the intent link.")).toHaveCount(0);

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (violation) => violation.impact !== undefined && blockingImpacts.has(violation.impact),
      );

      expect(blocking, formatViolations(blocking)).toEqual([]);
    });
  }
});
