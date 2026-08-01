# spending-reports Specification

## Purpose
TBD - created by archiving change add-spending-reports. Update Purpose after archive.
## Requirements
### Requirement: Period selection

The Reports screen SHALL support exactly two period units: **Month** and **Year**. The owner SHALL be able to switch between them, and switching SHALL re-render the breakdown for the same anchor date interpreted in the newly selected unit.

#### Scenario: Switching from Month to Year

- **WHEN** the owner switches the period unit from Month to Year while viewing August 2026
- **THEN** the screen shows the breakdown for the year 2026

#### Scenario: No day or week unit

- **WHEN** the owner looks for a day or week period option
- **THEN** none is offered; only Month and Year are available

### Requirement: Period navigation

The Reports screen SHALL provide previous- and next-period controls that move the anchor by one unit (one month or one year) and re-fetch and re-render the breakdown for the new anchor. The next-period control SHALL be disabled whenever the next period's start date is after today, for either unit.

#### Scenario: Moving to the previous period

- **WHEN** the owner activates the previous-period control while viewing August 2026
- **THEN** the screen shows the breakdown for July 2026

#### Scenario: Next control disabled at the current period

- **WHEN** the owner is viewing the period that contains today's date
- **THEN** the next-period control is disabled

#### Scenario: Next control re-enables after moving back

- **WHEN** the owner is viewing the current period (next disabled) and moves to the previous period
- **THEN** the next-period control becomes enabled

### Requirement: Category breakdown rows

The Reports screen SHALL show one row per category for the selected period, each showing the category's colour swatch, name, a proportion bar sized to its share of the period's total, its percentage share, and its total amount. Rows SHALL be sorted by total descending, except **Uncategorised**, which SHALL always appear last regardless of its total.

#### Scenario: Rows sorted by total

- **WHEN** the period contains Groceries (1832), Utilities (915), and Kid (771)
- **THEN** the rows appear in that order: Groceries, Utilities, Kid

#### Scenario: Uncategorised is always last

- **WHEN** Uncategorised has a nonzero total that would otherwise rank above another category
- **THEN** Uncategorised still appears as the last row

### Requirement: Uncategorised is always shown, never hidden

The Uncategorised row SHALL always be shown, including when its total is zero, rendered visually dimmed rather than removed, and occupying the same row height as every other row.

#### Scenario: Uncategorised at zero still appears

- **WHEN** the selected period has no uncategorised spendings
- **THEN** the Uncategorised row still appears, showing 0% and a total of 0, visually dimmed

#### Scenario: Row height is stable whether or not Uncategorised has data

- **WHEN** the owner navigates between a period where Uncategorised is empty and one where it isn't
- **THEN** the Uncategorised row's height does not change

### Requirement: Displayed percentages always sum to 100

Row percentages SHALL be computed with largest-remainder rounding: each category's exact share is floored to an integer percentage, and the remaining points (100 minus the sum of the floors) are distributed one each to the categories with the largest fractional remainders. The displayed percentages SHALL always sum to exactly 100.

#### Scenario: Independent rounding would not sum to 100

- **WHEN** eight categories' exact shares each round independently to values summing to 99 or 101
- **THEN** the displayed percentages instead sum to exactly 100, with the extra or missing point assigned to the category or categories with the largest fractional remainder

### Requirement: Year-view aggregate spend trend

In Year view, the Reports screen SHALL show a bar chart of total spend (across all categories) per month, with a y-axis showing three tick values (the axis maximum, its midpoint, and zero) and matching gridlines. The axis maximum SHALL be rounded up to a clean step above the raw peak month rather than using the raw peak value directly. A month that has not yet occurred SHALL render as no bar at all, not as a zero-height bar.

#### Scenario: Axis maximum is a rounded value

- **WHEN** the highest month's total is 913
- **THEN** the y-axis maximum is a rounded value such as 1,000, not 913

#### Scenario: Future months show no bar

- **WHEN** the selected year is the current year and a later month has not yet occurred
- **THEN** that month's column shows no bar, and hovering it indicates the month hasn't happened yet rather than showing a zero total

#### Scenario: Hovering a past month shows its total

- **WHEN** the owner hovers an elapsed month's bar
- **THEN** a tooltip shows that month's name and total

### Requirement: Category drill-down

Activating a category row SHALL open a drill-down screen for that category and the currently selected period, showing the category's total and entry count for the period.

#### Scenario: Opening a category's drill-down

- **WHEN** the owner activates the Groceries row while viewing August 2026
- **THEN** the drill-down screen opens showing Groceries' total and entry count for August 2026

#### Scenario: Drill-down preserves the selected period

- **WHEN** the owner is viewing Year and opens a category's drill-down
- **THEN** the drill-down shows that category's data for the same year, and switching the period unit from the drill-down updates both the drill-down and the underlying Reports screen to match

### Requirement: Drill-down trend visualization

The category drill-down SHALL show a trend visualization appropriate to the selected period unit: in Year view, a bar per elapsed month of that category's total, following the same rounded-axis and no-bar-for-future-months behavior as the aggregate trend chart; in Month view, a calendar heatmap of that category's daily spend, with weeks starting on Monday, day cells shaded on a single-hue intensity scale (from no-spend to the category's own colour), relative to that period's own peak day, and a legend indicating the low-to-high direction of the scale.

#### Scenario: Year-view drill-down shows monthly bars

- **WHEN** the owner opens a category's drill-down while viewing Year
- **THEN** the trend shows one bar per elapsed month for that category, with no bar for months that haven't occurred

#### Scenario: Month-view drill-down shows a calendar heatmap

- **WHEN** the owner opens a category's drill-down while viewing Month
- **THEN** the trend shows a calendar grid for that month with weeks starting on Monday, each day shaded by that day's spend for the category, and a day with no spend shown as the lightest (empty) shade

#### Scenario: Hovering a day shows its exact amount

- **WHEN** the owner hovers a day cell in the heatmap
- **THEN** a tooltip shows that day's date and exact amount, including 0 for a no-spend day

### Requirement: Drill-down transactions table

The category drill-down SHALL show a table of the category's individual transactions for the selected period, with columns Date, Amount, and Comment, each sortable by activating its column header (activating the active column's header again reverses the sort direction), plus a non-sortable action column that opens the existing edit-spending flow for that transaction.

#### Scenario: Sorting by amount

- **WHEN** the owner activates the Amount column header
- **THEN** the table sorts by amount ascending

#### Scenario: Reversing the active sort

- **WHEN** the owner activates the Amount column header again while it is already the active sort
- **THEN** the table re-sorts by amount descending

#### Scenario: Editing a transaction from the drill-down

- **WHEN** the owner activates the edit action on a row in the drill-down table
- **THEN** the existing edit-spending flow opens for that transaction, and a saved change is reflected in the drill-down and the underlying Reports totals
