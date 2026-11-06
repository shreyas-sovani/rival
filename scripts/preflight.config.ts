export interface PreflightCheck {
  id: string;
  title: string;
  owner: string;
  command: string;
  autoRunnable: boolean;
}

function unimplemented(task: string): string {
  return `node -e "console.error('NOT_IMPLEMENTED(${task}))');process.exit(3)"`;
}

const verifyDeployments = "node --experimental-strip-types scripts/verify-deployments.ts";
const auditEgress = "node --experimental-strip-types scripts/audit-egress.ts";

/** The 19 checks from PRD §9.6, in table order. */
export const preflightChecks: PreflightCheck[] = [
  {
    id: "curl-frontend",
    title: "Anonymous curl -I on frontend",
    owner: "S-020",
    command: unimplemented("S-020"),
    autoRunnable: true,
  },
  {
    id: "runner-health",
    title: "Runner /api/health",
    owner: "M-021",
    command: unimplemented("M-021"),
    autoRunnable: true,
  },
  {
    id: "verify-deployments",
    title: "verify:deployments",
    owner: "S-019",
    command: verifyDeployments,
    autoRunnable: true,
  },
  {
    id: "hook",
    title: "Hook",
    owner: "M-030",
    command: unimplemented("M-030"),
    autoRunnable: true,
  },
  {
    id: "oracle-manipulation",
    title: "Oracle manipulation test script on Sepolia fork",
    owner: "M-025",
    command: unimplemented("M-025"),
    autoRunnable: true,
  },
  {
    id: "synthetic-e2e",
    title: "Synthetic E2E on production with a clean browser",
    owner: "M-027",
    command: unimplemented("M-027"),
    autoRunnable: true,
  },
  {
    id: "vectors",
    title: "Cross-language vectors",
    owner: "M-011",
    command: unimplemented("M-011"),
    autoRunnable: true,
  },
  {
    id: "gate-demos",
    title: "Gate demos",
    owner: "M-030",
    command: unimplemented("M-030"),
    autoRunnable: true,
  },
  {
    id: "ens",
    title: "ENS",
    owner: "M-030",
    command: unimplemented("M-030"),
    autoRunnable: true,
  },
  {
    id: "arkiv",
    title: "Arkiv",
    owner: "M-030",
    command: unimplemented("M-030"),
    autoRunnable: true,
  },
  {
    id: "fuzz-slither",
    title: "Fuzz/invariants/Slither",
    owner: "M-025",
    command: unimplemented("M-025"),
    autoRunnable: true,
  },
  {
    id: "egress",
    title: "Egress audit and CSP",
    owner: "S-019",
    command: auditEgress,
    autoRunnable: true,
  },
  {
    id: "browser-matrix",
    title: "Browser matrix",
    owner: "S-021",
    command: unimplemented("S-021"),
    autoRunnable: false,
  },
  {
    id: "judge-dry-run",
    title: "Judge dry-run by a non-author",
    owner: "H-011",
    command: unimplemented("H-011"),
    autoRunnable: false,
  },
  {
    id: "solver-onboarding",
    title: "Solver onboarding dry-run",
    owner: "H-011",
    command: unimplemented("H-011"),
    autoRunnable: false,
  },
  {
    id: "docs",
    title: "Repo public, MIT, commits, FEEDBACK.md, secrets scan",
    owner: "M-029",
    command: unimplemented("M-029"),
    autoRunnable: true,
  },
  {
    id: "uniswap-feedback",
    title: "Uniswap feedback form submitted",
    owner: "H-012",
    command: unimplemented("H-012"),
    autoRunnable: false,
  },
  {
    id: "video",
    title: "Video 2:00-4:00, at least 720p, real-time, human voice",
    owner: "H-013",
    command: unimplemented("H-013"),
    autoRunnable: false,
  },
  {
    id: "ethglobal-form",
    title: "ETHGlobal form: partners = Uniswap Foundation, ENS, Arkiv",
    owner: "H-013",
    command: unimplemented("H-013"),
    autoRunnable: false,
  },
];
