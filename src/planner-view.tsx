import { type JSX } from "preact";
import { useMemo, useState } from "preact/hooks";

import { LotTableView } from "./lot-table-view.tsx";
import { PlannerFormView } from "./planner-form-view.tsx";
import { type Parameters, recommend } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";
import { SummaryView } from "./summary-view.tsx";

export function Planner({ lots }: { lots: RsuLotList }): JSX.Element {
  const symbols = useMemo(() => [...new Set(lots.map((lot) => lot.symbol))].sort(), [lots]);
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  return (
    <section aria-labelledby="planner-heading">
      <h2 id="planner-heading">Lot viewer</h2>
      <details open>
        <summary>Configuration</summary>
        <PlannerFormView
          symbols={symbols}
          onSubmit={(next) => {
            setParameters(next);
            setSelected(recommend(lots, next));
          }}
        />
      </details>
      <details open>
        <summary>Sale plan summary</summary>
        <section aria-label="Sale plan summary" aria-live="polite">
          <SummaryView lots={lots} parameters={parameters} selected={selected} />
        </section>
      </details>
      <details open>
        <summary>Lot selectors</summary>
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
