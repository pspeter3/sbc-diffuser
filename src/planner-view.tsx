import { type ComponentChildren, type JSX } from "preact";
import { useMemo, useState } from "preact/hooks";

import { LotTableView } from "./lot-table-view.tsx";
import { PlannerFormView } from "./planner-form-view.tsx";
import { availableLots, type Parameters, recommend, summarize } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";
import { PortfolioSummary, SaleSummary } from "./summary-view.tsx";

type Section = "Configuration" | "Portfolio" | "Sale" | "Lots";

function Disclosure({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: Section;
  expanded: ReadonlySet<Section>;
  onToggle: (title: Section, open: boolean) => void;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <details
      open={expanded.has(title)}
      onToggle={(event) => onToggle(title, event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function Planner({ lots }: { lots: RsuLotList }): JSX.Element {
  const symbols = useMemo(() => [...new Set(lots.map((lot) => lot.symbol))].sort(), [lots]);
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // Mirrors the user's toggles so a new recommendation can reopen closed results.
  const [expanded, setExpanded] = useState<ReadonlySet<Section>>(new Set(["Configuration"]));
  const summary = parameters === null ? null : summarize(lots, parameters, selected);
  const available = useMemo(
    () => (parameters === null ? lots : availableLots(lots, parameters.saleDate)),
    [lots, parameters],
  );
  const toggle = (title: Section, open: boolean): void => {
    setExpanded((previous) => {
      if (previous.has(title) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(title);
      else next.delete(title);
      return next;
    });
  };
  return (
    <section>
      <Disclosure title="Configuration" expanded={expanded} onToggle={toggle}>
        <PlannerFormView
          symbols={symbols}
          onSubmit={(next) => {
            setParameters(next);
            setSelected(recommend(lots, next));
            setExpanded(new Set(["Portfolio", "Sale", "Lots"]));
          }}
        />
      </Disclosure>
      {summary !== null && (
        <>
          <Disclosure title="Portfolio" expanded={expanded} onToggle={toggle}>
            <PortfolioSummary summary={summary} />
          </Disclosure>
          <Disclosure title="Sale" expanded={expanded} onToggle={toggle}>
            <SaleSummary summary={summary} />
          </Disclosure>
        </>
      )}
      <Disclosure title="Lots" expanded={expanded} onToggle={toggle}>
        <LotTableView
          lots={available}
          prices={parameters?.prices ?? null}
          selected={selected}
          onSelection={(key, checked) => {
            setSelected((previous) => {
              const next = new Set(previous);
              if (checked) next.add(key);
              else next.delete(key);
              return next;
            });
          }}
        />
      </Disclosure>
    </section>
  );
}
