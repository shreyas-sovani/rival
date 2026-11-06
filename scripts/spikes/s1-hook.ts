/**
 * Spike S1 — RivalOracleHook flag mask and CREATE2 salt search.
 *
 * Run: node --experimental-strip-types scripts/spikes/s1-hook.ts
 *
 * Does not broadcast. Mining a deployable salt needs the operator key and the
 * compiled init code, which this process does not have.
 */

const AFTER_INITIALIZE_FLAG = 1 << 12;
const BEFORE_SWAP_FLAG = 1 << 7;
const ALL_HOOK_MASK = (1 << 14) - 1;
const FLAG_MASK = (AFTER_INITIALIZE_FLAG | BEFORE_SWAP_FLAG) & ALL_HOOK_MASK;

if (AFTER_INITIALIZE_FLAG !== 0x1000) {
  console.error("afterInitialize flag is not 1<<12");
  process.exit(1);
}
if (BEFORE_SWAP_FLAG !== 0x80) {
  console.error("beforeSwap flag is not 1<<7");
  process.exit(1);
}
if (FLAG_MASK !== 0x1080) {
  console.error(`flag mask 0x${FLAG_MASK.toString(16)} != 0x1080`);
  process.exit(1);
}

const CREATE2_PROXY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

console.log("RivalOracleHook permissions: afterInitialize + beforeSwap");
console.log(`afterInitialize = 1 << 12 = 0x${AFTER_INITIALIZE_FLAG.toString(16)}`);
console.log(`beforeSwap      = 1 << 7  = 0x${BEFORE_SWAP_FLAG.toString(16)}`);
console.log(`flag mask       = 0x${FLAG_MASK.toString(16)} (no delta, no fee override)`);
console.log("salt search:");
console.log("  initcode = creationCode ++ abi.encode(poolManager)");
console.log("  for salt in 0 .. 160443:");
console.log("    address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initcode))[12:]");
console.log(`    accept when (address & 0x${ALL_HOOK_MASK.toString(16)}) == 0x${FLAG_MASK.toString(16)}`);
console.log("    and the address has no code");
console.log("  deploy with CREATE2 using that salt");
console.log(`forge-script CREATE2 deployer proxy: ${CREATE2_PROXY}`);
console.log("unit tests mine with HookMiner.find(address(this), flags, creationCode, abi.encode(manager))");
console.log("broadcast skipped: no operator key in this spike");
