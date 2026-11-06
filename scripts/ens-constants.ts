/**
 * Canonical Sepolia ENSv2 addresses.
 * Verified 2026-11-06 against https://docs.ens.domains/learn/deployments/
 * section "Sepolia (ENSv2)". None of these were guessed.
 */
export const ETH_REGISTRAR = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";
export const ETH_REGISTRY = "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4";
export const ROOT_REGISTRY = "0xb458d6a3a77919449d03e7a6903c26827c1ec43f";
export const USER_REGISTRY_IMPL = "0x9bd8a88719068d09ecee662f36c0e3856708366a";
export const VERIFIABLE_FACTORY = "0xda70306c98e97ece36f997a21368e53298572991";
export const PERMISSIONED_RESOLVER_IMPL = "0x115eb53f0c60696633855f90b138178fb40b2b2c";
export const UNIVERSAL_RESOLVER_V2 = "0x24e1d8e068620b647ca097f961a61055f4f42d72";
export const UNIVERSAL_RESOLVER_PROXY = "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe";
export const MOCK_USDC = "0x240b0316df57887dbbe58b586508b19e633a14aa";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_BYTES32 = `0x${"00".repeat(32)}`;

/** `rival`, then `rivalx`, then `rivalmarket`. */
export const PARENT_LABEL_CANDIDATES = ["rival", "rivalx", "rivalmarket"] as const;

export const ALL_ROLES =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

/** ROLE_REGISTRAR | ROLE_UNREGISTER | ROLE_RENEW. RivalNames root bitmap. */
export const NAMES_ROOT_BITMAP = 0x11001n;

const ROLE_SET_SUBREGISTRY = 1n << 20n;
const ROLE_SET_RESOLVER = 1n << 24n;
const ROLE_SET_TEXT = 1n << 4n;
const ROLE_UPGRADE = 1n << 124n;

/** ETHRegistrar `REGISTRATION_ROLE_BITMAP`: subregistry, resolver, and transfer admin. */
export const PARENT_NAME_ROLES =
  ROLE_SET_SUBREGISTRY |
  (ROLE_SET_SUBREGISTRY << 128n) |
  ROLE_SET_RESOLVER |
  (ROLE_SET_RESOLVER << 128n) |
  ((1n << 28n) << 128n);

/**
 * Resolver root roles for the operator.
 * `ROLE_SET_TEXT_ADMIN` can grant per-key `ROLE_SET_TEXT` and does not itself pass `setText`.
 */
export const RESOLVER_ADMIN_ROLES = (ROLE_SET_TEXT << 128n) | ROLE_UPGRADE | (ROLE_UPGRADE << 128n);

export const AGENT_TEXT_KEYS = [
  "description",
  "url",
  "avatar",
  "agent-context",
  "agent-endpoint[web]",
  "agent-registration[11155111]",
] as const;

export const PROTOCOL_TEXT_KEYS = [
  "com.rival.fills",
  "com.rival.makers",
  "com.rival.avgImprovementBps",
  "com.rival.lastFill",
] as const;

export const SITE_ORIGIN = "https://rival-flame.vercel.app";
