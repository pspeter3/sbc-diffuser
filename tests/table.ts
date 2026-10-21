function rows(container: HTMLElement): Element[][] {
  return [...container.querySelectorAll("tr")].map((row) => [...row.children]);
}

function headings(container: HTMLElement): string[] {
  return (rows(container)[0] ?? []).map((cell) => cell.textContent);
}

/** Text of every cell in a table or region, one array per row, header first. */
export function cells(container: HTMLElement): string[][] {
  return rows(container).map((row) => row.map((cell) => cell.textContent));
}

/** Body and footer cells under the given column heading, top to bottom. */
export function column(container: HTMLElement, heading: string): Element[] {
  const index = headings(container).indexOf(heading);
  if (index === -1) throw new Error(`Missing column ${heading}`);
  return rows(container)
    .slice(1)
    .flatMap((row) => row.slice(index, index + 1));
}

/** The row whose first cell is `name`, keyed by column heading. */
export function rowOf(container: HTMLElement, name: string): Record<string, string | undefined> {
  const row = rows(container).find(([first]) => first?.textContent === name);
  if (row === undefined) throw new Error(`Missing row ${name}`);
  return Object.fromEntries(
    headings(container).map((heading, index) => [heading, row[index]?.textContent]),
  );
}

/** Description list terms mapped to their definitions. */
export function definitions(container: HTMLElement): Record<string, string | undefined> {
  return Object.fromEntries(
    [...container.querySelectorAll("dt")].map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
  );
}
