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
for each symbol in the RsuLotList. Concentration refers to the combined value of
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

Use two screen elements declared in `index.html`, with conditional visibility via
the `hidden` attribute. Retain vanilla TypeScript, Pico CSS, and the existing
Vite+ tooling. A router or UI framework is unnecessary for this flow.

### Screen 1: import workbook

- Provide a labeled XLSX file input and a clear import action.
- Explain that the supported file is the E*TRADE By Benefit Type workbook and
  that it is processed locally.
- Show progress while reading and validating the file; prevent duplicate imports.
- Adapt the existing parser's normalization, structural validation, and
  cross-record validation. Preserve useful sheet, row, and column diagnostics.
- On failure, stay on the import screen and let the user choose another file.
- On success, show the planner with the file name and derived stock symbol.

The current parser expects the `Restricted Stock` worksheet and its required
column headers. Options worksheets are ignored. Preserve this supported format unless
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
assumptions; calculate after every stock price, wealth, and concentration input is valid.

Provide a replace-workbook action that returns to the import screen and clears
the current workbook, parameters, and selection. Move focus appropriately when
switching screens, and expose validation and loading status accessibly.

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

Display all held RSU lots, including those not recommended for sale. Sort by vest
date ascending so users can locate the same dates in the E*TRADE UI. Use grant
number and then numeric-aware vest-period ordering to break same-date ties.
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

**Editing any valid parameter recalculates the recommendation and replaces all
manual checkbox selections.** There is no separate Recommend lots button.
Explain this behavior near the inputs. While an input is incomplete or invalid,
show validation, suppress stale calculated results, and disable selection/export;
once the inputs are valid again, apply a fresh automatic recommendation.

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

Use an `Application` class to coordinate app-specific DOM views through explicit
method calls and user-action callbacks. Keep vanilla TypeScript, Pico CSS,
persistent HTML, and in-memory session state; no new architectural dependency is
required. The planner follows this architecture; the existing WorkbookFormView continues
to own asynchronous reading and its duplicate-import guard.

### Responsibilities

- **Application:** owns the workbook, valid planning parameters, selected lot
  identities, and active screen. Orchestrates asynchronous import, domain
  calculations, screen transitions, and session reset.
- **WorkbookFormView:** wraps the import form, reports submitted files, and
  exposes methods for loading, errors, reset, and focus.
- **PlannerFormView:** wraps parameter controls, reads and validates input using
  DOM-independent validation functions, and reports valid parameters or an
  invalid state. Exposes reset and focus methods.
- **LotTableView:** renders held lots, reports lot identity and checked state on
  checkbox changes, and exposes methods to update calculated cells, checked
  states, and selection availability.
- **SummaryView:** displays calculated statistics and clears them when
  parameters are invalid.

Keep parsing, validation, recommendation, and selection calculations independent
of the DOM. Use independent concrete view classes, with no shared base class,
separate ViewModel, generic Form/Table abstraction, or subscription mechanism.
Views do not reference each other or Application; they receive callbacks for
user actions and expose methods that Application calls.

### State and DOM lifecycle

Construct views once around elements declared in `index.html`. Keep startup code
limited to DOM lookup, view construction, and Application initialization.
Application toggles screen roots using `hidden` and invokes the appropriate
view's focus method after switching screens.

Keep raw field values and displayed validation in the form views. Application
stores only valid domain parameters; invalid input clears those parameters,
suppresses calculated results, and disables selection and any implemented export.

WorkbookFormView owns the import-in-progress guard and its loading state. Failed imports retain the import screen and display useful
diagnostics. Successful import stores the workbook, initializes the planner
views, and reveals the planner.

Build date-sorted table rows once per workbook. Update calculated cells and
checkbox states in place to preserve keyboard focus. Valid parameter changes
replace manual selections with a fresh recommendation. Checkbox changes update
Application's selection and summary without changing other selections.

Replacing the workbook clears session state and resets all views before
returning focus to the import form.

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
3. **Build the import flow.** Declare the two persistent screen sections and
   construct `WorkbookFormView` and `Application`. Coordinate import loading,
   duplicate prevention, validation errors, screen visibility, and focus through
   the architecture above.
4. **Build the planner.** Construct `PlannerFormView`, `LotTableView`, and
   `SummaryView`. Connect validated-input and checkbox callbacks to Application's
   state and domain calculations. Implement automatic replacement of selections,
   in-place table updates, live summaries, and complete workbook replacement reset.
5. **Polish and verify.** Check empty holdings, invalid inputs, blocked lots,
   keyboard access, narrow layouts, and workbook replacement. Remove unused
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
- Valid and invalid form callbacks, parameter edits replacing manual selections,
  and invalid-to-valid edits restoring fresh recommendations.
- Date-sorted display independent of recommendation ranking.
- Import loading, duplicate prevention, failure recovery, successful screen
  transition, and replacement clearing session state and resetting every view.
- View rendering, safe workbook text insertion, accessible validation, and focus
  preservation during table updates and appropriate focus after screen changes.
- Application coordination using substitute views and domain dependencies.
- CSV contents, escaping, and selection fidelity if export is implemented.

Retain the repository's configured coverage requirements. Run `npm test` after
implementation changes and `npm run build` for the production application.
Perform a browser check of the complete import-to-selection flow, keyboard
interaction, and responsive layout before considering the core milestone done.
