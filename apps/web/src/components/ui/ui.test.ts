// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressText } from "./AddressText.tsx";
import { Banner } from "./Banner.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { ExplorerLink } from "./ExplorerLink.tsx";
import { Tabs } from "./Tabs.tsx";
import { TimeAgo } from "./TimeAgo.tsx";
import { PrimitivesCatalog } from "./catalog.tsx";

afterEach(() => {
  cleanup();
});

describe("primitives", () => {
  it("renders the catalog", () => {
    render(createElement(PrimitivesCatalog));
    expect(screen.getByRole("heading", { name: "Primitives" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Solvers" })).toBeTruthy();
  });

  it("switches tabs from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      createElement(Tabs, {
        label: "Examples",
        tabs: [
          { id: "one", label: "One", panel: "First" },
          { id: "two", label: "Two", panel: "Second" },
        ],
      }),
    );
    expect(screen.getByRole("tab", { name: "One" }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tab", { name: "Two" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("checksums an address and keeps the full value on the title", () => {
    render(createElement(AddressText, { value: "0x52908400098527886e0f7030069857d2e4169ee7" }));
    const node = screen.getByTitle("0x52908400098527886E0F7030069857D2E4169EE7");
    expect(node.textContent).toContain("0x5290");
    expect(node.textContent).toContain("9EE7");
  });

  it("formats a relative time", () => {
    render(createElement(TimeAgo, { now: 10_000, ts: 0 }));
    expect(screen.getByText("10s ago")).toBeTruthy();
  });

  it("does not invent an explorer host", () => {
    render(createElement(ExplorerLink, { chain: "sepolia", kind: "address", value: "0xabc" }));
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("copies the given value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(createElement(CopyButton, { value: "0xabc" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("0xabc");
  });

  it("exposes an alert for an error banner", () => {
    render(
      createElement(Banner, {
        actionLabel: "Retry",
        kind: "error",
        onAction: () => undefined,
        children: "Runner unavailable",
      }),
    );
    expect(screen.getByRole("alert").textContent).toContain("Runner unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
