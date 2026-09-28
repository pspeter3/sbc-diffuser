import { type JSX } from "preact";
import { useState } from "preact/hooks";

import { Planner } from "./planner-view.tsx";
import { type RsuLotList } from "./schema.ts";
import { WorkbookFormView } from "./workbook-form-view.tsx";

export function Application(): JSX.Element {
  const [lots, setLots] = useState<RsuLotList | null>(null);
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
            }}
          />
        ) : (
          <Planner lots={lots} />
        )}
      </main>
    </>
  );
}
