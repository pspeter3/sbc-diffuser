/** Require a typed element from the app's own markup. Workbook text is never markup. */
export function element<T extends Element>(
  root: ParentNode,
  selector: string,
  type: { new (): T },
): T {
  const result = root.querySelector(selector);
  if (!(result instanceof type)) throw new Error(`Missing element: ${selector}`);
  return result;
}
