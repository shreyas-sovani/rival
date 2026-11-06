import React from "react";
import { useState, type ReactNode } from "react";
import { testIds } from "../../testids.ts";

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
}

export function Tabs({ label, tabs }: { label: string; tabs: readonly TabItem[] }) {
  const first = tabs[0]?.id ?? "";
  const [active, setActive] = useState(first);
  const selected = tabs.some((tab) => tab.id === active) ? active : first;
  return (
    <div data-testid={testIds.tabs}>
      <div aria-label={label} role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`panel-${tab.id}`}
            aria-selected={tab.id === selected}
            id={`tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActive(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== selected} id={`panel-${tab.id}`} key={tab.id} role="tabpanel">
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
