"use client";

import { PAIR, buildIntentQuery, buildPresenceQuery } from "@rival/arkiv";
import { useEffect, useState } from "react";
import { parentNode, readLiveRoles, simulateForgeRecord, simulateUnlistedFill } from "./simulate.ts";
import { EvidenceView } from "../../components/views/EvidenceView.tsx";
import { KNOWN_LIMIT } from "../../content/evidence-copy.ts";
import { PUBLIC_INTENTS_NOTICE } from "../../content/disclaimers.ts";
import { shortHex } from "../../lib/format.ts";
import type { BannerVM, TxLinkVM } from "../../viewmodels/common.ts";
import type { EvidenceRowVM, EvidenceVM } from "../../viewmodels/evidence.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";
import { publicDeployment as deployment } from "../../data/public-deployment.ts";

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

function isLiveAddress(value: string | undefined): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
}

function addressLink(value: string): TxLinkVM | undefined {
  if (!isLiveAddress(value)) return undefined;
  return {
    chain: "sepolia",
    kind: "address",
    value,
    href: `https://sepolia.etherscan.io/address/${value}`,
    label: shortHex(value),
  };
}

function addressRow(label: string, value: string | undefined): EvidenceRowVM {
  const shown = value && value.length > 0 ? value : "unavailable";
  const link = addressLink(shown);
  return link ? { label, value: shown, link } : { label, value: shown };
}

function textRow(label: string, value: string | undefined): EvidenceRowVM {
  return { label, value: value && value.length > 0 ? value : "unavailable" };
}

function hookFlags(hex: string | undefined): string {
  if (!hex || !/^0x[0-9a-fA-F]+$/.test(hex)) return "unavailable";
  const parsed = Number.parseInt(hex, 16);
  if (!Number.isInteger(parsed)) return hex;
  const names: string[] = [];
  if ((parsed & (1 << 12)) !== 0) names.push("afterInitialize");
  if ((parsed & (1 << 7)) !== 0) names.push("beforeSwap");
  const known = (1 << 12) | (1 << 7);
  const body = names.length > 0 ? names.join(", ") : "no afterInitialize or beforeSwap bit";
  return (parsed & ~known) === 0 ? `${hex} (${body})` : `${hex} (${body}; other bits set)`;
}

function poolRow(label: string, pool: { poolId?: string; fee?: number; tickSpacing?: number } | undefined): EvidenceRowVM {
  if (!pool?.poolId) return { label, value: "unavailable" };
  const fee = pool.fee === undefined ? "fee unavailable" : `fee ${pool.fee}`;
  const tick = pool.tickSpacing === undefined ? "tick unavailable" : `tick ${pool.tickSpacing}`;
  return { label, value: `${pool.poolId} ${fee} ${tick}` };
}

const queries = [
  {
    title: "Open intents",
    query: buildIntentQuery({ status: "open", pair: PAIR, sortDeadlineAsc: true }),
  },
  {
    title: "Size filter",
    query: buildIntentQuery({
      status: "open",
      amountInMin: 10n ** 18n,
      amountInMax: 10n ** 19n,
    }),
  },
  {
    title: "Named-solver intents",
    query: buildIntentQuery({ status: "open", gate: 2 }),
  },
  {
    title: "Solvers online",
    query: buildPresenceQuery(PAIR),
  },
];

const banner: BannerVM = {
  kind: "warn",
  text: "Arkiv queries on this page are not executed. The buttons run Sepolia eth_call simulations and do not send transactions. Name reads use the canonical universal resolver proxy.",
};

export default function EvidencePage() {
  const [unlistedResult, setUnlistedResult] = useState("");
  const [forgeResult, setForgeResult] = useState("");
  const [liveRoles, setLiveRoles] = useState("reading Sepolia roles…");

  useEffect(() => {
    let cancelled = false;
    void readLiveRoles().then((text) => {
      if (!cancelled) setLiveRoles(text);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const solverRows = (deployment.solvers ?? []).map((solver, index) =>
    addressRow(solver.label ? `Solver ${solver.label}` : `Solver ${index + 1}`, solver.address),
  );
  const writerRows = (deployment.arkivWriterAddresses ?? []).map((address, index) =>
    addressRow(`Arkiv writer ${index + 1}`, address),
  );
  const uniswapRows = (deployment.uniswapSolvers ?? []).map((address, index) =>
    addressRow(`Uniswap solver ${index + 1}`, address),
  );

  const vm: EvidenceVM = {
    commit: deployment.commit && deployment.commit.length > 0 ? deployment.commit : "unavailable",
    hookFlags: hookFlags(deployment.hook?.flagBitsHex),
    addresses: [
      addressRow("tWETH", deployment.tokens?.tWETH),
      addressRow("tUSDC", deployment.tokens?.tUSDC),
      addressRow("Hook", deployment.hook?.address),
      addressRow("Settlement", deployment.settlement),
      addressRow("Registry", deployment.registry),
      addressRow("Names", deployment.names),
      addressRow("ETH registrar", deployment.ens?.ethRegistrar),
      addressRow("ETH registry", deployment.ens?.ethRegistry),
      addressRow("Root registry", deployment.ens?.rootRegistry),
      addressRow("User registry implementation", deployment.ens?.userRegistryImpl),
      addressRow("Verifiable factory", deployment.ens?.verifiableFactory),
      addressRow("Permissioned resolver implementation", deployment.ens?.permissionedResolverImpl),
      addressRow("Universal resolver v2", deployment.ens?.universalResolverV2),
      addressRow("Universal resolver proxy", deployment.ens?.universalResolverProxy),
      textRow("rival.eth node", parentNode(deployment.ens?.parentLabel)),
      ...uniswapRows,
      ...solverRows,
      ...writerRows,
    ],
    pools: [poolRow("Pool A", deployment.pools?.A), poolRow("Pool B", deployment.pools?.B)],
    ensRoles: [
      textRow("Parent", deployment.ens?.parentLabel),
      addressRow("Solvers registry", deployment.ens?.solversRegistry),
      textRow("Live roles", liveRoles),
    ],
    queries,
    limitations: [KNOWN_LIMIT, PUBLIC_INTENTS_NOTICE],
    banner,
    unlistedResult,
    forgeResult,
    onUnlistedFill: () => {
      setUnlistedResult("eth_call in flight");
      void simulateUnlistedFill().then(setUnlistedResult, (error: unknown) => {
        setUnlistedResult(error instanceof Error ? error.message : "eth_call failed");
      });
    },
    onForgeRecord: () => {
      setForgeResult("eth_call in flight");
      void simulateForgeRecord().then(setForgeResult, (error: unknown) => {
        setForgeResult(error instanceof Error ? error.message : "eth_call failed");
      });
    },
  };

  return (
    <RouteShell title={routeTitle("/evidence")}>
      <EvidenceView vm={vm} />
    </RouteShell>
  );
}
