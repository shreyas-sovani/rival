import type { Locator, Page } from "@playwright/test";

import { testIds } from "../../../src/testids";
import { shellContent, shellTitle } from "../shell";

export class LeaderboardPage {
  readonly shellTitle: Locator;
  readonly content: Locator;
  readonly leaderboard: Locator;
  readonly empty: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    this.shellTitle = shellTitle(page);
    this.content = shellContent(page);
    this.leaderboard = page.getByTestId(testIds.leaderboard);
    this.empty = page.getByTestId(testIds.emptyState);
    this.table = page.getByRole("table", { name: "Leaderboard" });
  }
}
