// The root `e2e:synthetic` script stays NOT_IMPLEMENTED(M-027).
// This spec does not add a 30-minute synthetic loop.
// Nav across routes is covered by the @smoke spec and is not repeated here.

import { testIds } from "../src/testids";
import { routes, type RouteDef } from "../src/viewmodels/routes";
import { blockHosts } from "./support/block-hosts";
import { expect, test } from "./support/fixtures";
import { BookPage, EvidencePage, TradePage } from "./support/pages";

/** Public Arkiv and Rabdi hosts. No access keys. */
const ARKIV_AND_RABDI_HOSTS = [
  "arkiv.network",
  "hub.arkiv.network",
  "docs.arkiv.network",
  "sourcify.arkiv.network",
  "rpc.rabdi.db-chain.testnet.arkiv.network",
  "indexer.rabdi.db-chain.testnet.arkiv.network",
  "rabdi.explorer.arkiv.network",
] as const;

function routeTitle(path: RouteDef["path"]): string {
  const route = routes.find((entry) => entry.path === path);
  if (!route) throw new Error(`missing route ${path}`);
  return route.title;
}

test.describe("@flows", () => {
  test("trade shows the composer and a curve or a degraded banner", async ({ page }) => {
    const trade = new TradePage(page);
    await page.goto("/");

    await expect(trade.shellTitle).toHaveText(routeTitle("/"));
    await expect(trade.composer).toBeVisible();

    const curve = page.getByTestId(testIds.curveChart);
    const degradedBanner = page.getByTestId(testIds.banner).filter({
      hasText: /degraded|unavailable/i,
    });
    await expect(curve.or(degradedBanner).first()).toBeVisible();
  });

  test("book renders its shell when Arkiv and Rabdi are blocked", async ({ page }) => {
    const thrown: string[] = [];
    page.on("pageerror", (error) => {
      thrown.push(error.message);
    });

    await blockHosts(page, ARKIV_AND_RABDI_HOSTS);

    const book = new BookPage(page);
    await page.goto("/book");
    await expect(book.shellTitle).toBeVisible();
    await expect(book.shellTitle).toHaveText(routeTitle("/book"));
    expect(thrown, thrown.join("\n")).toEqual([]);
  });

  test("evidence renders its title", async ({ page }) => {
    const evidence = new EvidencePage(page);
    await page.goto("/evidence");
    await expect(evidence.shellTitle).toBeVisible();
    await expect(evidence.shellTitle).toHaveText(routeTitle("/evidence"));
  });
});
