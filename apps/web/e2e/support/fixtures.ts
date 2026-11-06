import { test as base, expect } from "@playwright/test";

/**
 * Clean profile: no cookies, localStorage, or sessionStorage.
 * Specs import this `test` so every browser context starts signed out.
 */
export const test = base.extend({
  storageState: [{ cookies: [], origins: [] }, { option: true }],
});

export { expect };
