/** Text of every cell in a table or region, one array per row, header first. */
export function cells(container: HTMLElement): string[][] {
  return [...container.querySelectorAll("tr")].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  );
}

/** The row whose first cell is `name`, keyed by column heading. */
export function rowOf(container: HTMLElement, name: string): Record<string, string | undefined> {
  const [headings = [], ...rows] = cells(container);
  const row = rows.find(([first]) => first === name);
  if (row === undefined) throw new Error(`Missing row ${name}`);
  return Object.fromEntries(headings.map((heading, index) => [heading, row[index]]));
}
