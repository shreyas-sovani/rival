import type { Locator, Page } from "@playwright/test";

import { testIds } from "../../../src/testids";
import { shellContent, shellTitle } from "../shell";

export class EvidencePage {
  readonly shellTitle: Locator;
  readonly content: Locator;
  readonly evidence: Locator;
  readonly unlistedFill: Locator;
  readonly forgeRecord: Locator;

  constructor(page: Page) {
    this.shellTitle = shellTitle(page);
    this.content = shellContent(page);
    this.evidence = page.getByTestId(testIds.evidence);
    this.unlistedFill = this.evidence.getByRole("button", { name: "Unlisted solver tries a gated fill" });
    this.forgeRecord = this.evidence.getByRole("button", { name: "Try to forge a track record" });
  }

  clickUnlistedFill(): Promise<void> {
    return this.unlistedFill.click();
  }

  clickForgeRecord(): Promise<void> {
    return this.forgeRecord.click();
  }
}
