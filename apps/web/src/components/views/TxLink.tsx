import type { TxLinkVM } from "../../viewmodels/common.ts";
import { testIds } from "../../testids.ts";
import { ExplorerLink } from "../ui/ExplorerLink.tsx";

export function TxLink({ link }: { link: TxLinkVM }) {
  if (link.kind === "entity") {
    return (
      <a data-testid={testIds.txLink} href={link.href} rel="noreferrer">
        {link.label}
      </a>
    );
  }
  return (
    <span data-testid={testIds.txLink}>
      <ExplorerLink chain={link.chain} href={link.href} kind={link.kind} value={link.value} />
    </span>
  );
}
