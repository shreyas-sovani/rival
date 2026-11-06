import type { Page } from "@playwright/test";

function hostnameOf(host: string): string | null {
  const trimmed = host.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  const withoutPort = trimmed.replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
  return withoutPort.length === 0 ? null : withoutPort.toLowerCase();
}

function hostPattern(hostname: string): RegExp {
  const escaped = hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https?://${escaped}(?::\\d+)?(?:[/?#]|$)`, "i");
}

/**
 * Abort requests to the given hosts via `page.route`.
 * Later Arkiv-blocked drills call this before loading a route.
 */
export async function blockHosts(page: Page, hosts: readonly string[]): Promise<void> {
  for (const host of hosts) {
    const hostname = hostnameOf(host);
    if (!hostname) continue;
    const pattern = hostPattern(hostname);
    await page.route(pattern, (route) => route.abort("blockedbyclient"));
  }
}
