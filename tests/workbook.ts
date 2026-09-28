export function workbook(): { sheet: string; data: string[][] }[] {
  const headers: string[] = Array.from({ length: 62 }, () => "");
  for (const [index, label] of [
    [0, "Record Type"],
    [1, "Symbol"],
    [11, "Grant Number"],
    [18, "Vest Period"],
    [19, "Vest Date"],
    [30, "Blocked Share Qty."],
    [32, "Sellable Qty."],
    [35, "Est. Cost Basis (per share):"],
    [61, "Release Date"],
  ] as const)
    headers[index] = label;
  const grant: string[] = Array.from({ length: 62 }, () => "");
  grant[0] = "Grant";
  grant[1] = "TEST";
  grant[11] = "grant-1";
  const vest = [...grant];
  vest[0] = "Vest Schedule";
  vest[18] = "1";
  vest[19] = "2026-09-01";
  const lot = [...vest];
  lot[0] = "Sellable Shares";
  lot[32] = "10";
  lot[35] = "25";
  lot[61] = "2026-09-02";
  return [{ sheet: "Restricted Stock", data: [headers, grant, vest, lot] }];
}
