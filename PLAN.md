# SBC Diffuser: product specification and implementation plan

Authored by Codex (the AI assistant), based on requirements discussed with the
user. The user did not write this plan. Implementation details and defaults beyond
the explicitly agreed requirements are Codex's proposals for review.

## Purpose

Build a generic, browser-only UI for planning RSU sales.
Users import an E*TRADE By Benefit Type workbook, configure a concentration
target, and review or adjust the lots they plan to sell.

The application must derive the stock symbol from the workbook without assuming
a particular employer. All workbook processing and calculations happen locally in the browser;
there is no server, account system, or workbook upload. This is a planning tool;
checkboxes do not execute trades or record completed sales.

## Scope

The initial version supports the existing E*TRADE By Benefit Type XLSX format and
multiple stock symbols per workbook, with a separate manually entered USD price
for each symbol with positive held quantity. Concentration refers to the combined value of
workbook RSUs. Missing symbol information must produce a useful validation error.

Plan sales of held RSUs, including blackout-blocked shares. Exclude options and
unvested RSUs from the sale plan and concentration calculation. Preserve the
existing interpretation of held quantities: use positive sellable quantity,
otherwise positive blocked-share quantity; do not add these alternative values.
Pending-sale quantities are not added to holdings.

Keep workbook data, parameters, and selections in memory for the initial version.
Refreshing the page starts a new session. Persistence, other broker formats,
partial-lot sales, tax calculations, price feeds, and
multi-period schedules are outside the initial scope.

## Screen structure

Use Preact 11 with TypeScript, Pico CSS, and the existing Vite+ tooling.
`index.html` supplies the mount point. Conditionally mount the import form or
planner; no router is needed for this flow.

### Screen 1: import workbook

- Provide a labeled XLSX file input and a clear import action.
- Explain that the supported file is the E*TRADE By Benefit Type workbook and
  that it is processed locally.
- Show progress while reading and validating the file; prevent duplicate imports.
- Adapt the existing parser's normalization, structural validation, and
  cross-record validation. Preserve useful sheet, row, and column diagnostics.
- On failure, stay on the import screen and let the user choose another file.
- On success, show the planner with the stock symbols derived from held lots.

The current parser expects the `Restricted Stock` worksheet and its required
column headers. Release dates are unused and are not required or validated.
Options worksheets are ignored. Preserve this supported format unless
additional real exports establish a need to accept other shapes.

### Screen 2: configure and review

Provide these inputs:

| Input                                         | Meaning                                                        | Validation                        |
| --------------------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| Stock price per symbol                        | Assumed price per share in USD                                 | Finite decimal greater than zero  |
| Desired wealth concentration                  | Target percentage held in workbook RSUs after the planned sale | Finite decimal from 0 through 100 |
| Investable wealth excluding workbook holdings | Non-workbook investable wealth in USD                          | Finite nonnegative decimal        |

Use explicit labels, particularly for wealth, so users do not include workbook
holdings twice. There is no periods input. Do not prefill personal financial
assumptions; calculate when the configuration form is submitted with valid inputs.

Move focus appropriately after import, and expose validation and loading status
accessibly. The planner has no replace-workbook button.

## Recommendation algorithm

Use decimal arithmetic, adapting the existing `BigNumber` calculation model.
Preserve precision throughout calculations and round only for display or export.

1. Normalize held RSU lots using the existing quantity rules above.
2. Resolve each lot's vest date through its grant number and vest period.
3. Require a valid, nonnegative estimated basis per share and a known vest date
   for every held lot used in recommendations. Report missing data rather than
   inventing a basis or grouping unrelated lots under an unknown date.
4. Group all held lots sharing the same vest date, including lots from different
   grants and symbols.
5. Calculate each group's share-weighted average estimated basis:
   `sum(lot shares × lot basis per share) / sum(lot shares)`.
6. Rank groups by descending weighted average basis. Break equal-basis ties by
   ascending vest date for deterministic results.
7. Select entire groups until selected proceeds meet or exceed the minimum sale
   value. Never split a lot in an automatic recommendation.

This intentionally prioritizes selling all lots from a vest date over strict
individual-lot highest-basis ordering. Some lower-basis lots may therefore be
selected before higher-basis lots from another date. Whole-group selection may
take ending concentration below the target.

Let:

- `S` = total held RSU shares;
- `P` = entered stock price;
- `W` = entered non-workbook investable wealth;
- `T` = desired concentration in percentage points;
- `V = S × P` = current workbook stock value;
- `N = W + V` = total modeled investable wealth.

For multiple symbols, sum each lot's shares multiplied by its own symbol's price
for `V` and selected proceeds; the other formulas remain the same.

Then:

- Minimum sale value: `max(0, V − N × T / 100)`.
- Current concentration: `100 × V / N`.
- Selected proceeds: `selected shares × P`.
- Selected basis: `sum(selected lot shares × lot basis per share)`.
- Estimated gain/loss: `selected proceeds − selected basis`.
- Remaining stock value: `V − selected proceeds`.
- Ending concentration: `100 × remaining stock value / N`.

Sale proceeds remain in investable wealth, so the denominator remains `N`.
Taxes and fees are excluded. Report concentration as zero when `N` is zero.
If current concentration is already at or below target, recommend no sales.

## Lot table and interaction rules

Display all held RSU lots, including those not recommended for sale. Sort by
estimated cost basis per share descending. Break equal-basis ties by vest date
ascending, grant number, then numeric-aware vest-period ordering.
Recommendation ranking and table display order are independent.

Each individual lot has its own **Plan to sell** checkbox. There is no vest-date
group checkbox. Initial checked states come from the automatic recommendation.
Users can override individual lots, including selecting only part of a vest-date
group, while still selecting each lot in full.

Suggested columns:

| Column                | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| Plan to sell          | Individual-lot checkbox                                   |
| Vest date             | Primary reference for matching the E*TRADE UI             |
| Grant number          | Grant identifier, preserved as text                       |
| Vest period           | Identifies the lot within its grant                       |
| Shares                | Full held quantity for the lot                            |
| Estimated basis/share | Workbook basis used in ranking                            |
| Proceeds              | Shares multiplied by entered price                        |
| Estimated gain/loss   | Proceeds less estimated basis                             |
| Block status          | Makes blocked holdings visible as planning-only inventory |

Checking or unchecking a lot immediately updates summary statistics. It does not
automatically select another lot to compensate or change any other checkbox.

**Submitting valid parameters recalculates the recommendation and replaces all
manual checkbox selections.** Explain this behavior near the inputs. Editing
fields before submission does not change the current plan. Invalid submissions
use field validation and do not change the current plan.

Use safe text rendering for all workbook-derived values. Give checkboxes
accessible labels that identify their lots, preserve keyboard usability, and
allow the table to scroll horizontally on narrow screens.

## Summary statistics

Show:

- Stock symbol, held shares, and current stock value.
- Non-workbook wealth and total modeled investable wealth.
- Current and desired concentration.
- Minimum required sale value.
- Selected lot count and selected shares.
- Selected proceeds, estimated total basis, and estimated gain/loss.
- Remaining shares and stock value.
- Ending concentration and whether the checked selection meets the target.

Use the actual checkbox selection for selected-sale statistics, including manual
overrides. If the selection does not reach the target, say so without preventing
the user from keeping it. Label basis and gain/loss as estimates, and state that
blocked holdings are included and taxes and fees are excluded.

## Optional follow-up: CSV sale list

The interactive table and summary are required for the first milestone. A CSV
download is a small follow-up if desired, not a blocker for the core experience.

Export only checked lots, in the same order as the displayed table. Include
symbol, vest date, grant number, vest period, shares, assumed sale price, estimated
basis per share, proceeds, estimated total basis, estimated gain/loss, and block
status. Use proper CSV escaping and protect workbook-derived text from spreadsheet
formula interpretation. Disable export when inputs are invalid or no lots are
selected. Generate the download locally without a server.

## Application and view architecture

Use Preact 11 with TSX components and Pico CSS. `Application` owns imported
holdings and the import-to-planner transition. It filters out zero-quantity lots.
`Planner` owns valid planning parameters and selected lot indices, and derives
symbols from its held lots. Components pass data and typed callbacks through props.
Use eager imports: the app is small enough that code-loading states are unnecessary.
Workbook file reading remains asynchronous.

- **WorkbookFormView:** owns asynchronous workbook reading, the duplicate-import
  guard, loading state, accessible errors, and initial input focus.
- **PlannerFormView:** uses uncontrolled inputs and native field validation,
  focuses the first input on mount, and reports valid parameters only when its
  Update plan button submits the form.
- **LotTableView:** memoizes the basis-sorted rows per imported lot list, renders
  keyed rows with controlled checkboxes, and reports checkbox changes.
- **SummaryView:** derives statistics from the current parameters and selection.

Keep parsing, validation, recommendation, and selection calculations independent
of Preact and the DOM. Child views receive props and callbacks and do not reference
one another. `main.tsx` mounts `Application`; `index.html` supplies the mount point.

Failed imports retain the import form. A successful import mounts the planner.
Invalid parameter submissions preserve the current plan, and valid submissions
replace manual selections with a fresh recommendation. Stable imported row
indices serve as keys so sorting and summary updates preserve checkbox identity
and keyboard focus. Parameter edits remain local to the form until submission.

Component and integration tests use `@testing-library/preact` to render TSX and
exercise controls through labels and roles. Domain tests remain framework independent.

## Implementation sequence

1. **Adapt the domain code.** Bring the relevant snapshot types, parser, and
   decimal arithmetic into this repository from the existing CLI project. Adapt XLSX reading
   for browser files and keep parsing independent of the DOM. Add dependencies
   through `./node_modules/.bin/vp add <package>` as required.
2. **Implement grouped planning.** Separate held-lot normalization, vest-date
   grouping and recommendation, and calculations for an arbitrary selection.
   Use stable imported row indices for checkbox state so repeated grant/period
   records remain independently selectable; retain those indices when sorting. Adapt
   Node-specific or unsupported iterator usage for the project's browser target.
3. **Build the import flow.** Render the import and planner screens with `WorkbookFormView` and `Application`. Coordinate import loading,
   duplicate prevention, validation errors, screen visibility, and focus through
   the architecture above.
4. **Build the planner.** Construct `PlannerFormView`, `LotTableView`, and
   `SummaryView`. Connect validated-input and checkbox callbacks to Planner's
   state and domain calculations. Implement automatic replacement of selections,
   in-place table updates, live summaries, and collapsible planner sections.
5. **Polish and verify.** Check empty holdings, invalid inputs, blocked lots,
   keyboard access, narrow layouts, and collapsible sections. Remove unused
   starter assets and counter code as part of replacing the starter experience.
6. **Optionally add CSV export.** Reuse the same selected-lot model and display
   ordering as the planner.

## Validation and acceptance criteria

Adapt useful parser and planner tests to the project's Vite+ test setup. Use
synthetic fixtures rather than committing personal workbook contents.

Cover the behaviors that establish correctness:

- Valid workbook import, malformed input diagnostics, arbitrary symbols,
  and separate pricing for multiple symbols.
- Existing quantity semantics, including blocked/sellable alternatives and empty
  holdings.
- Weighted group ranking, same-date lots across grants, deterministic ties,
  complete-group selection, and target overshoot.
- Missing basis or vest dates, already-at-target portfolios, zero wealth, and
  concentration targets of 0% and 100%.
- Manual individual-lot selection and accurate summary calculations.
- Valid and invalid form submissions, with valid submissions replacing manual
  selections and invalid submissions preserving the current plan.
- Basis-sorted display independent of recommendation ranking.
- Import loading, duplicate prevention, failure recovery, successful screen
  transition.
- View rendering, safe workbook text insertion, accessible validation, and focus
  preservation during table updates and appropriate focus after screen changes.
- Application coordination through rendered components and user interactions.
- CSV contents, escaping, and selection fidelity if export is implemented.

Retain the repository's configured coverage requirements. Run `npm test` after
implementation changes and `npm run build` for the production application.
Perform a browser check of the complete import-to-selection flow, keyboard
interaction, and responsive layout before considering the core milestone done.
