import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrimitivesCatalog } from "./catalog.tsx";

const html = renderToStaticMarkup(createElement(PrimitivesCatalog));
const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Primitives</title></head><body>${html}</body></html>`);
const { window } = dom;
window.HTMLCanvasElement.prototype.getContext = () => null;
for (const [key, value] of Object.entries({
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
})) {
  Object.defineProperty(globalThis, key, { configurable: true, value });
}
const axe = (await import("axe-core")).default;
const results = await axe.run(window.document, { resultTypes: ["violations"] });
const serious = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
if (serious.length > 0) {
  for (const item of serious) console.error(`${item.impact}: ${item.id} ${item.help}`);
  process.exit(1);
}
console.log(`axe primitives: 0 critical/serious (${results.violations.length} other)`);
