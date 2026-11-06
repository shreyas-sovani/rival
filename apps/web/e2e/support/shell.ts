import type { Locator, Page } from "@playwright/test";

/** Title rendered by every route shell. */
export function shellTitle(page: Page): Locator {
  return page.locator(".auction-tape__title");
}

/** Body rendered by every route shell. */
export function shellContent(page: Page): Locator {
  return page.locator(".page-shell__content");
}
