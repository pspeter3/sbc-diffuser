import { type JSX } from "preact";
import { useMemo, useRef, useState } from "preact/hooks";

import { LotTableView } from "./lot-table-view.tsx";
import { PlannerFormView } from "./planner-form-view.tsx";
import { type Parameters, recommend, summarize } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";
import { SummaryView } from "./summary-view.tsx";

export function Planner({ lots }: { lots: RsuLotList }): JSX.Element {
  const symbols = useMemo(() => [...new Set(lots.map((lot) => lot.symbol))].sort(), [lots]);
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const section = useRef<HTMLElement>(null);
  const configuration = useRef<HTMLDetailsElement>(null);
  const summary = parameters === null ? null : summarize(lots, parameters, selected);
  return (
    <section ref={section}>
      <details ref={configuration} open>
        <summary>Configuration</summary>
        <PlannerFormView
          symbols={symbols}
          onSubmit={(next) => {
            setParameters(next);
            setSelected(recommend(lots, next));
            // The form can only submit after the section ref has been attached.
            /* v8 ignore next */
            section.current?.querySelectorAll(":scope > details").forEach((details) => {
              details.toggleAttribute("open", details !== configuration.current);
            });
          }}
        />
      </details>
      <details>
        <summary>Portfolio</summary>
        <SummaryView kind="Portfolio" summary={summary} />
      </details>
      <details>
        <summary>Sale</summary>
        <SummaryView kind="Sale" summary={summary} />
      </details>
      <details>
        <summary>Lots</summary>
        <LotTableView
          lots={lots}
          prices={parameters?.prices ?? null}
          selected={selected}
          onSelection={(index, checked) => {
            setSelected((previous) => {
              const next = new Set(previous);
              if (checked) next.add(index);
              else next.delete(index);
              return next;
            });
          }}
        />
      </details>
    </section>
  );
}
