import type { BannerVM, PresenceVM } from "./common";

export interface RunSolverStepVM {
  n: string;
  title: string;
  body: string;
  command?: string;
}

export interface RunSolverVM {
  steps: RunSolverStepVM[];
  initCommand: string;
  devCommand: string;
  label: string;
  listed: boolean;
  presence: PresenceVM;
  lastFill: string;
  banner?: BannerVM;
}
