import { type JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import readXlsxFile from "read-excel-file/browser";

import { parseRsuLotList } from "./parser.ts";
import { type RsuLotList } from "./schema.ts";

export function WorkbookFormView({
  onParseRsuLotList,
}: {
  onParseRsuLotList: (lots: RsuLotList) => void;
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    input.current?.focus();
  }, []);
  async function submit(): Promise<void> {
    if (pending.current) return;
    const file = input.current?.files?.[0];
    if (file === undefined) {
      setError("Choose an .xlsx workbook to import.");
      return;
    }
    // oxlint-disable-next-line react/immutability -- The ref synchronously blocks duplicate submits before state updates.
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      onParseRsuLotList(parseRsuLotList(await readXlsxFile(file)));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <form
      aria-label="Workbook import"
      onSubmit={(event) => {
        event.preventDefault();
        submit().catch((cause: unknown): void => {
          setError(
            cause instanceof Error && cause.message.length > 0
              ? cause.message
              : "Could not read this workbook. Choose another .xlsx file.",
          );
        });
      }}
    >
      <label htmlFor="workbook-file">Workbook (.xlsx)</label>
      <input
        ref={input}
        id="workbook-file"
        name="workbook"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? "workbook-help" : "workbook-help workbook-file-error"}
      />
      {error !== null && <small id="workbook-file-error">{error}</small>}
      <small id="workbook-help">E*TRADE By Benefit Type workbook.</small>
      <button type="submit" disabled={loading} aria-busy={loading ? true : undefined}>
        Import workbook
      </button>
    </form>
  );
}
