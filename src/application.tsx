import { type JSX } from "preact";
import { useState } from "preact/hooks";

import { LotTableView } from "./lot-table-view.tsx";
import { PlannerFormView } from "./planner-form-view.tsx";
import { type Parameters, recommend } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";
import { SummaryView } from "./summary-view.tsx";
import { WorkbookFormView } from "./workbook-form-view.tsx";

export function Application(): JSX.Element {
  const [lots, setLots] = useState<RsuLotList | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  return (
    <>
      <header>
        <h1>SBC Diffuser</h1>
      </header>
      <main>
        {lots === null ? (
          <WorkbookFormView
            onParseRsuLotList={(imported) => {
              setLots(imported.filter((lot) => lot.quantity.gt(0)));
              setSymbols([...new Set(imported.map((lot) => lot.symbol))].sort());
            }}
          />
        ) : (
          <section id="planner" aria-labelledby="planner-heading">
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
              <section aria-label="Sale plan summary" id="summary" aria-live="polite">
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
        )}
      </main>
    </>
  );
}
