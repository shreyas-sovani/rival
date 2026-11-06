import assert from "node:assert/strict";
import test from "node:test";

import { ETH_REGISTRAR, MOCK_USDC, PARENT_LABEL_CANDIDATES } from "./ens-constants.ts";
import { parseCastUint } from "./ens-cast.ts";
import { chooseLabel, dnsEncode } from "./ens-dns.ts";
import { dryRunText } from "./ens-bootstrap.ts";
import { registerPlan } from "./ens-register-parent.ts";

test("dnsEncode matches the ENS wire examples", () => {
  assert.equal(dnsEncode("eth"), "0x0365746800");
  assert.equal(dnsEncode("rival.eth"), "0x05726976616c0365746800");
  assert.equal(dnsEncode(""), "0x00");
});

test("cast uints accept decimal and scientific words", () => {
  assert.equal(parseCastUint("8000000"), 8_000_000n);
  assert.equal(parseCastUint("[8e6]"), 8_000_000n);
  assert.equal(parseCastUint("1.5e6"), 1_500_000n);
  assert.throws(() => parseCastUint("1.5e0"));
});

test("label fallback is rival, then rivalx, then rivalmarket", () => {
  assert.deepEqual(PARENT_LABEL_CANDIDATES, ["rival", "rivalx", "rivalmarket"]);
  assert.equal(chooseLabel(PARENT_LABEL_CANDIDATES, [true, true, true]), "rival");
  assert.equal(chooseLabel(PARENT_LABEL_CANDIDATES, [false, true, false]), "rivalx");
  assert.equal(chooseLabel(PARENT_LABEL_CANDIDATES, [false, false, true]), "rivalmarket");
  assert.equal(chooseLabel(PARENT_LABEL_CANDIDATES, [false, false, false]), null);
});

test("missing keys print the founder command and no private key", () => {
  const plan = registerPlan();
  assert.match(plan, new RegExp(ETH_REGISTRAR));
  assert.match(plan, new RegExp(MOCK_USDC));
  assert.match(plan, /pnpm exec tsx scripts\/ens-register-parent\.ts/);
  assert.match(plan, /BLOCKED/);
  assert.doesNotMatch(plan, /0x[0-9a-fA-F]{64}/);
});

test("bootstrap dry-run tells the founder to broadcast and does not waive the parent", () => {
  const text = dryRunText();
  assert.match(text, /scripts\/ens-register-parent\.ts/);
  assert.match(text, /ENS_BOOTSTRAP_BROADCAST=1/);
  assert.match(text, /pnpm exec tsx scripts\/ens-bootstrap\.ts --broadcast/);
  assert.match(text, /com\.rival\.fills/);
  assert.match(text, /agent-registration\[11155111\]/);
  assert.doesNotMatch(text, /do not buy rival\.eth/i);
  assert.doesNotMatch(text, /0x[0-9a-fA-F]{64}/);
});
