## MODIFIED Requirements

### Requirement: Currency selection when adding a spending

The add-spending form SHALL provide a currency control offering the entry currencies defined
by the `currency-conversion` capability. The control SHALL be the device's native picker and
SHALL show each currency by its code alone (for example `RON`, `EUR`), both in the closed
control and in the list of options. The control SHALL default to RON every time the form
is opened and SHALL NOT remember a previously chosen currency, so that failing to change it
always produces a correct RON entry. When a non-RON currency is selected, the form SHALL show
the converted RON amount together with the rate used. When RON is selected, no conversion
preview SHALL be shown.

#### Scenario: Picker defaults to RON on every open

- **WHEN** the owner saves a spending in EUR and then opens the add form again
- **THEN** the currency control shows RON, not EUR

#### Scenario: Currencies are shown by code only

- **WHEN** the owner opens the currency control on the add-spending form
- **THEN** each option is labelled with its currency code only (for example `EUR`), and the
  closed control shows the selected code

#### Scenario: Conversion preview for a foreign currency

- **WHEN** the owner enters `11` with EUR selected and the cached rate is `5.2584` RON per EUR
- **THEN** the form displays a preview reading approximately `≈ 58 RON · rate 5.2584`

#### Scenario: No preview for base currency

- **WHEN** RON is selected
- **THEN** no conversion preview is displayed

## ADDED Requirements

### Requirement: Pickers stay open when the on-screen keyboard is dismissed

A picker opened in the spending form SHALL stay open when the on-screen keyboard is
dismissed or the viewport is resized, and SHALL close only when the owner picks an option,
taps outside it, or presses Escape.

#### Scenario: Opening the category picker while typing

- **WHEN** the owner is typing in the entry field with the on-screen keyboard shown and taps
  the category picker on the Android PWA
- **THEN** the keyboard is dismissed and the category list stays open until the owner picks
  a category or taps outside it

#### Scenario: Opening the currency picker while typing

- **WHEN** the owner is typing in the entry field with the on-screen keyboard shown and taps
  the currency control on the Android PWA
- **THEN** the currency picker stays open until the owner picks a currency or dismisses it
