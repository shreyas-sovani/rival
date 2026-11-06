import type { ReactNode } from "react";

interface RouteShellProps {
  title: string;
  children: ReactNode;
}

export function RouteShell({ title, children }: RouteShellProps) {
  return (
    <>
      <div className="auction-tape">
        <span className="auction-tape__label">Auction tape</span>
        <span className="auction-tape__title">{title}</span>
      </div>
      <main className="page-shell__content">{children}</main>
    </>
  );
}
