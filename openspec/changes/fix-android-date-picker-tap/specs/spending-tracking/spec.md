## ADDED Requirements

### Requirement: Tapping the date field opens the date picker

In the add and edit spending form, a single tap anywhere on the Date field SHALL open the
device's date picker, not only a tap on its calendar icon. Where the browser cannot open the
picker programmatically, the field SHALL keep the browser's default behaviour.

#### Scenario: Tapping the date digits

- **WHEN** the owner taps the day, month or year digits of the Date field on the Android PWA
- **THEN** the date picker opens

#### Scenario: Tapping while the keyboard is up

- **WHEN** the owner is typing in the entry field with the on-screen keyboard shown and taps
  the Date field on the Android PWA
- **THEN** the keyboard is dismissed and the date picker opens

#### Scenario: Picking a date

- **WHEN** the owner picks a date in the opened picker
- **THEN** the Date field shows the picked date and saving the spending stores that date
