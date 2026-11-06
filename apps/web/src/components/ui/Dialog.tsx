import React from "react";
import { useRef, type ReactNode } from "react";
import { testIds } from "../../testids.ts";
import { Button } from "./Button.tsx";

export function Dialog({ title, trigger, children }: { title: string; trigger: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div data-testid={testIds.dialog}>
      <Button onClick={() => ref.current?.showModal()}>{trigger}</Button>
      <dialog ref={ref}>
        <h2>{title}</h2>
        {children}
        <form method="dialog">
          <Button>Close</Button>
        </form>
      </dialog>
    </div>
  );
}
