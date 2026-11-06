import { presenceHeartbeat } from "./heartbeat.ts";
import type { ArkivOpenBook, SettlementFacts, VenueQuoter } from "./ports.ts";
import { arb, house, inventory, patient, sprint, type StrategyDecision, type StrategyInput } from "./strategies.ts";
import type { Clock } from "./submit.ts";
import type { Address, Hex, Intent } from "./types.ts";
import { readIntent } from "./verify.ts";
import { verifyWitness } from "./witness.ts";

const STRATEGIES = { sprint, patient, arb, inventory, house } as const;

export type StrategyId = keyof typeof STRATEGIES;

export interface FillPlan {
  intent: Intent;
  signature: Hex;
  quoteOut: bigint;
  strategy: StrategyId;
  reason: string;
}

/** Settlement reads for verification, plus the one place a fill leaves the process. */
export interface SettlementSubmitter extends SettlementFacts {
  submit(plan: FillPlan): Promise<void>;
}

/** Presence extend. The SDK decides the 60s cadence; the port performs the write. */
export interface PresencePort {
  lastExtend(): Promise<bigint>;
  extend(now: bigint): Promise<void>;
}

export interface RunSolverPorts {
  book: ArkivOpenBook;
  quoter: VenueQuoter;
  submitter: SettlementSubmitter;
  clock: Clock;
  presence: PresencePort;
  /** This solver's strategy. One iteration asks it for each open intent. */
  strategy: StrategyId;
  chainId: number;
  settlement: Address;
  permit2: Address;
  /** Solver `tokenOut` balance. `inventory` needs it. */
  balanceOut?: bigint;
  /** True when another solver would fill. `house` needs it. */
  othersPassing?: boolean;
  /** Token-out cost of filling. `arb` compares the venue gap to this. Defaults to 0. */
  costOut?: bigint;
}

export interface RunSolverResult {
  submitted: FillPlan | null;
  presenceExtended: boolean;
}

function decide(strategy: StrategyId, input: StrategyInput): StrategyDecision {
  return STRATEGIES[strategy](input);
}

/**
 * One solver iteration. No network of its own: every read and the fill go through the ports.
 * Reads the open book, checks the Permit2 witness plus balance, nonce, and time, asks the
 * strategy, and submits at most one fill plan.
 */
export async function runSolver(ports: RunSolverPorts): Promise<RunSolverResult> {
  const now = ports.clock.now();
  const lastExtend = await ports.presence.lastExtend();
  let presenceExtended = false;
  if (presenceHeartbeat(lastExtend, now)) {
    await ports.presence.extend(now);
    presenceExtended = true;
  }

  const rows = await ports.book.listOpen(now);
  for (const row of rows) {
    const intent = readIntent(row.intentJson);
    if (!intent) continue;
    const witnessed = await verifyWitness({
      intent,
      signature: row.signature,
      permit2: ports.permit2,
      settlement: ports.settlement,
      chainId: ports.chainId,
    });
    if (!witnessed.accept) continue;
    if (now < BigInt(intent.startTime) || now > BigInt(intent.deadline)) continue;

    const [balance, nonceUsed] = await Promise.all([
      ports.submitter.balanceOf(intent.maker, intent.tokenIn),
      ports.submitter.nonceUsed(intent.maker, intent.nonce),
    ]);
    if (nonceUsed || balance < intent.amountIn) continue;

    const quoteOut = await ports.quoter.quoteExactInput({
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      venue: "hooked",
    });
    const otherQuoteOut =
      ports.strategy === "arb"
        ? await ports.quoter.quoteExactInput({
            tokenIn: intent.tokenIn,
            tokenOut: intent.tokenOut,
            amountIn: intent.amountIn,
            venue: "other",
          })
        : undefined;

    const decision = decide(ports.strategy, {
      elapsed: now - BigInt(intent.startTime),
      decaySecs: BigInt(intent.decaySecs),
      startBps: BigInt(intent.startBps),
      floorBps: BigInt(intent.floorBps),
      quoteOut,
      costOut: ports.costOut ?? 0n,
      hardMinOut: intent.hardMinOut,
      otherQuoteOut,
      balanceOut: ports.balanceOut,
      othersPassing: ports.othersPassing,
    });
    if (!decision.fill) continue;

    const plan: FillPlan = {
      intent,
      signature: row.signature,
      quoteOut,
      strategy: ports.strategy,
      reason: decision.reason,
    };
    await ports.submitter.submit(plan);
    return { submitted: plan, presenceExtended };
  }

  return { submitted: null, presenceExtended };
}
