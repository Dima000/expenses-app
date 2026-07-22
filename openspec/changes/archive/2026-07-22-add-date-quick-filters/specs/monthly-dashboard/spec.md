## ADDED Requirements

### Requirement: Quick spending filters

The web app SHALL provide quick filter buttons on the dashboard that narrow the
displayed spendings for the selected month. The filters SHALL be **exclusive**:
at most one filter is active at a time, and activating a filter SHALL deactivate
any other active filter. Activating the already-active filter SHALL clear it.
When no filter is active, all of the selected month's spendings SHALL be shown.

The available quick filters SHALL be:

- **Uncategorized** — spendings whose stored category does not resolve to a
  current category (the existing categorize-later filter).
- **Today** — spendings dated on the current day (local time).
- **Yesterday** — spendings dated on the previous day (local time).

The date filters SHALL operate on the already-loaded month; a date filter for a
day that falls outside the selected month therefore contributes no matches.

#### Scenario: No filter active shows all spendings

- **WHEN** no quick filter button is active
- **THEN** the table shows all of the selected month's spendings

#### Scenario: Today filter shows only today's spendings

- **WHEN** the owner activates the **Today** filter and no other filter is active
- **THEN** the table shows only spendings dated on the current day

#### Scenario: Yesterday filter shows only yesterday's spendings

- **WHEN** the owner activates the **Yesterday** filter and no other filter is active
- **THEN** the table shows only spendings dated on the previous day

#### Scenario: Selecting a filter deactivates the previous one

- **WHEN** the **Today** filter is active and the owner activates the **Yesterday** filter
- **THEN** the **Today** filter becomes inactive and the table shows only spendings dated on the previous day

#### Scenario: Toggling the active filter off

- **WHEN** the owner activates the currently active quick filter again
- **THEN** no filter is active and the table shows all of the selected month's spendings

#### Scenario: Date filter outside the selected month

- **WHEN** the selected month is not the current month and the owner activates the **Today** filter
- **THEN** the table shows no spendings for that filter, since the current day is not in the loaded month
