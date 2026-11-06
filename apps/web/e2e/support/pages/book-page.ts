import type { Locator, Page } from "@playwright/test";

import { testIds } from "../../../src/testids";
import { shellContent, shellTitle } from "../shell";

export class BookPage {
  readonly shellTitle: Locator;
  readonly content: Locator;
  readonly book: Locator;
  readonly query: Locator;
  readonly copyQuery: Locator;
  readonly copyViaPage: Locator;

  constructor(page: Page) {
    this.shellTitle = shellTitle(page);
    this.content = shellContent(page);
    this.book = page.getByTestId(testIds.book);
    this.query = this.book.locator("pre");
    this.copyQuery = this.book.getByRole("button", { name: "Copy query" });
    this.copyViaPage = this.book.getByRole("button", { name: "Copy via page" });
  }

  clickCopyQuery(): Promise<void> {
    return this.copyQuery.click();
  }

  clickCopyViaPage(): Promise<void> {
    return this.copyViaPage.click();
  }
}
