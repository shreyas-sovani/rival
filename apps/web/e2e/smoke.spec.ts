import type { Locator } from "@playwright/test";

import { testIds } from "../src/testids";
import { routes, type RouteDef } from "../src/viewmodels/routes";
import { expect, test } from "./support/fixtures";
import { AuctionPage, BookPage, EvidencePage, LeaderboardPage, TradePage } from "./support/pages";
import { shellContent, shellTitle } from "./support/shell";

function pathnameOf(url: string): string {
  const pathname = new URL(url).pathname.replace(/\/$/, "");
  return pathname.length === 0 ? "/" : pathname;
}

test("@smoke app loads, nav reaches every route, and each shell renders its title", async ({ page }) => {
  const trade = new TradePage(page);
  const auction = new AuctionPage(page);
  const leaderboard = new LeaderboardPage(page);
  const book = new BookPage(page);
  const evidence = new EvidencePage(page);
  const titles = {
    "/": trade.shellTitle,
    "/auction": auction.shellTitle,
    "/solvers": leaderboard.shellTitle,
    "/book": book.shellTitle,
    "/solver": shellTitle(page),
    "/evidence": evidence.shellTitle,
  } satisfies Record<RouteDef["path"], Locator>;
  const bodies = {
    "/": trade.content,
    "/auction": auction.content,
    "/solvers": leaderboard.content,
    "/book": book.content,
    "/solver": shellContent(page),
    "/evidence": evidence.content,
  } satisfies Record<RouteDef["path"], Locator>;

  await page.goto("/");
  await expect(page.getByTestId(testIds.header)).toBeVisible();
  await expect(page.getByTestId(testIds.nav)).toBeVisible();

  for (const route of routes) {
    if (route.nav) {
      const link = page.getByTestId(testIds.nav).getByRole("link", { name: route.title, exact: true });
      await expect(link).toHaveAttribute("href", route.path);
      await link.click();
    } else {
      await page.goto(route.path);
    }

    const title = titles[route.path];
    const body = bodies[route.path];
    await expect.poll(() => pathnameOf(page.url())).toBe(route.path);
    await expect(title).toBeVisible();
    await expect(title).toHaveText(route.title);
    await expect(body).toBeVisible();
  }
});
