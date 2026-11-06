import { readFileSync } from "node:fs";
import { decodeFunctionData, encodeErrorResult, namehash, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import {
  decodeSimulationRevert,
  dnsEncode,
  forgeSetTextCall,
  parentNode,
  roleNames,
  unlistedFillCall,
} from "./simulate.ts";

const ETH_NODE = "0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae";

const fillAbi = [
  {
    type: "function",
    name: "fill",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "i",
        type: "tuple",
        components: [
          { name: "maker", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint128" },
          { name: "recipient", type: "address" },
          { name: "mode", type: "uint8" },
          { name: "baseOut", type: "uint128" },
          { name: "oracleWindow", type: "uint32" },
          { name: "startBps", type: "int32" },
          { name: "floorBps", type: "int32" },
          { name: "startTime", type: "uint32" },
          { name: "decaySecs", type: "uint32" },
          { name: "deadline", type: "uint32" },
          { name: "hardMinOut", type: "uint128" },
          { name: "gate", type: "uint8" },
          { name: "allowlistHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
        ],
      },
      { name: "makerSig", type: "bytes" },
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "inputTo", type: "address" },
          { name: "useCallback", type: "bool" },
          { name: "data", type: "bytes" },
          { name: "allowLabels", type: "bytes32[]" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

describe("evidence eth_call drafts", () => {
  it("namehashes rival.eth and dns-encodes eth", () => {
    expect(namehash("eth")).toBe(ETH_NODE);
    expect(parentNode("rival")).toBe(namehash("rival.eth"));
    expect(dnsEncode("eth")).toBe("0x0365746800");
  });

  it("encodes a listed-gate fill from an unlisted address", () => {
    const draft = unlistedFillCall();
    const selector = toFunctionSelector(
      "fill((address,address,address,uint128,address,uint8,uint128,uint32,int32,int32,uint32,uint32,uint32,uint128,uint8,bytes32,uint256),bytes,(address,bool,bytes,bytes32[]))",
    );
    expect(draft.data.startsWith(selector)).toBe(true);
    const decoded = decodeFunctionData({ abi: fillAbi, data: draft.data });
    const intent = decoded.args[0];
    expect(intent.gate).toBe(1);
    expect(draft.from.toLowerCase()).not.toBe(intent.maker.toLowerCase());
    expect(draft.from.toLowerCase()).not.toBe(intent.recipient.toLowerCase());
  });

  it("encodes setText for com.rival.fills", () => {
    const draft = forgeSetTextCall(
      "0x115eb53f0c60696633855f90b138178fb40b2b2c",
      "0x0361746c617306736f6c7665727305726976616c0365746800",
    );
    expect(draft.data.startsWith(toFunctionSelector("setText(bytes,string,string)"))).toBe(true);
    expect(draft.data.includes("636f6d2e726976616c2e66696c6c73")).toBe(true);
  });

  it("decodes NotListed and the resolver access-control error", () => {
    const notListed = encodeErrorResult({
      abi: [{ type: "error", name: "NotListed", inputs: [] }],
      errorName: "NotListed",
    });
    expect(decodeSimulationRevert(notListed)).toBe("NotListed()");
    const denied = encodeErrorResult({
      abi: [
        {
          type: "error",
          name: "EACUnauthorizedAccountRoles",
          inputs: [
            { name: "resource", type: "uint256" },
            { name: "roleBitmap", type: "uint256" },
            { name: "account", type: "address" },
          ],
        },
      ],
      errorName: "EACUnauthorizedAccountRoles",
      args: [1n, 16n, "0x2222222222222222222222222222222222222222"],
    });
    expect(decodeSimulationRevert(denied)).toContain("EACUnauthorizedAccountRoles");
  });

  it("names the three RivalNames root roles in 0x11001", () => {
    expect(roleNames(0x11001n).sort()).toEqual(["ROLE_REGISTRAR", "ROLE_RENEW", "ROLE_UNREGISTER"]);
  });

  it("does not keep the static not-simulated strings", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).not.toContain("not simulated");
    expect(page).toContain("simulateUnlistedFill");
    expect(page).toContain("simulateForgeRecord");
    expect(page).toContain("readLiveRoles");
  });
});
