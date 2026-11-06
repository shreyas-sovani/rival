import type { Locator, Page } from "@playwright/test";

import { testIds } from "../../../src/testids";
import { shellContent, shellTitle } from "../shell";

export class TradePage {
  readonly shellTitle: Locator;
  readonly content: Locator;
  readonly composer: Locator;
  readonly amount: Locator;
  readonly namedLabels: Locator;
  readonly gate: Locator;
  readonly mode: Locator;
  readonly submit: Locator;
  readonly faucet: Locator;

  constructor(private readonly page: Page) {
    this.shellTitle = shellTitle(page);
    this.content = shellContent(page);
    this.composer = page.getByTestId(testIds.intentComposer);
    this.amount = page.getByLabel("Amount");
    this.namedLabels = page.getByLabel("Named labels");
    this.gate = page.getByLabel("Gate");
    this.mode = page.getByLabel("Mode");
    this.submit = page.getByRole("button", { name: "Sign & publish" });
    this.faucet = page.getByRole("button", { name: "Get test tokens" });
  }

  preset(name: string): Locator {
    return this.page.getByRole("radio", { name });
  }

  fillAmount(value: string): Promise<void> {
    return this.amount.fill(value);
  }

  fillNamedLabels(value: string): Promise<void> {
    return this.namedLabels.fill(value);
  }

  async selectGate(value: string): Promise<void> {
    await this.gate.selectOption(value);
  }

  async selectMode(value: string): Promise<void> {
    await this.mode.selectOption(value);
  }

  clickPreset(name: string): Promise<void> {
    return this.preset(name).click();
  }

  clickSubmit(): Promise<void> {
    return this.submit.click();
  }

  clickFaucet(): Promise<void> {
    return this.faucet.click();
  }
}
