## ADDED Requirements

### Requirement: Spending form entry hint behind an info control

The add and edit spending dialogs SHALL keep the rounding rule as a visible subtitle under the
dialog title (its accessible description). The add-spending dialog SHALL NOT display the
first-number hint inline; instead an info control after the "Amount & note" label SHALL, when
tapped or clicked, reveal in a popover that the first number in the text becomes the amount
with the rest saved as the comment, and tapping or clicking again (or outside the popover)
SHALL hide it. The dialog title SHALL be left-aligned and vertically aligned with the dialog's
close button. Record-specific notes (the
original-entry caption and the auto-categorisation note) and messages about the current state
(missing exchange rates, conversion preview, validation errors) are not hints and SHALL remain
inline.

#### Scenario: Entry hint is hidden by default

- **WHEN** the owner opens the add-spending dialog
- **THEN** the rounding subtitle is visible, the first-number hint is not, and an info control appears next to the "Amount & note" label

#### Scenario: Revealing the entry hint

- **WHEN** the owner taps the info control next to "Amount & note"
- **THEN** a popover shows the first-number rule

#### Scenario: Edit mode has no entry hint

- **WHEN** the owner opens the edit-spending dialog
- **THEN** the rounding subtitle is visible and there is no info control

#### Scenario: Record-specific notes stay inline

- **WHEN** the owner edits a spending that carries an original-entry caption
- **THEN** the "Entered as …" note is still shown under the amount field without opening the info popover

### Requirement: Currency picker shares the amount row

In the add-spending dialog, the currency control SHALL sit on the same row as the free-text
amount-and-note input, after it. The input SHALL take the remaining width and the currency
control SHALL be only as wide as its content, with visible spacing between the two. While
closed, the control SHALL show only the currency code; the open list SHALL show the full
currency labels. The currency control SHALL have an accessible name of "Currency". Any
conversion preview or missing-rates message SHALL appear below the row.

#### Scenario: Currency on the same row

- **WHEN** the owner opens the add-spending dialog on a phone-width screen
- **THEN** the amount-and-note input and the currency control are on one row, with the currency control at the end

#### Scenario: Compact closed state

- **WHEN** EUR is selected
- **THEN** the closed currency control reads `EUR`, and opening it lists entries such as `EUR — euro`

### Requirement: Spending dialog sizing and position

The add and edit spending dialogs SHALL size to their content up to a maximum height of 80% of
the dynamic viewport height, on all screen sizes, and SHALL scroll internally when their
content exceeds that height. The dialogs SHALL be anchored 10% of the dynamic viewport height from the top
of the viewport rather than vertically centred, so that their position does not change when an
on-screen keyboard opens or closes. On small devices the keyboard MAY cover the lower part of
the dialog. Other dialogs in the app are not affected.

#### Scenario: Dialog does not move with the keyboard

- **WHEN** the owner opens the add-spending dialog on a phone and the on-screen keyboard appears for the amount field
- **THEN** the dialog's top edge stays where it was

#### Scenario: Content taller than the cap

- **WHEN** the dialog's content is taller than 80% of the viewport height
- **THEN** the dialog is 80% of the viewport height and its content scrolls inside it
