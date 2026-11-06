import type { Locator, Page } from "@playwright/test";

import { testIds } from "../../../src/testids";
import { shellContent, shellTitle } from "../shell";

export class AuctionPage {
  readonly shellTitle: Locator;
  readonly content: Locator;
  readonly status: Locator;
  readonly empty: Locator;
  readonly cancel: Locator;

  constructor(page: Page) {
    this.shellTitle = shellTitle(page);
    this.content = shellContent(page);
    this.status = page.getByTestId(testIds.auctionStatus);
    this.empty = page.getByTestId(testIds.emptyState);
    this.cancel = this.status.getByRole("button", { name: "Cancel" });
  }

  clickCancel(): Promise<void> {
    return this.cancel.click();
  }
}
