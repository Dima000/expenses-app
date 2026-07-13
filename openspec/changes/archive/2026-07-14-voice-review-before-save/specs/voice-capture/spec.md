## MODIFIED Requirements

### Requirement: Review voice capture before saving

A voice-captured spending on the web app SHALL NOT be written on transcription.
Instead the app SHALL parse the transcript and open the standard add/edit form
prefilled with the parsed amount, comment, category (`uncategorized`), and today's
date, so the owner can review and correct the values before committing. The
spending SHALL be created only when the owner submits the form, and SHALL carry
`source: 'voice'` to preserve provenance. Dismissing the form SHALL write nothing.

#### Scenario: Speaking opens a prefilled review form

- **WHEN** the owner activates the mic and speaks a valid phrase like "12 lunch"
- **THEN** no spending is written yet and the add form opens prefilled with amount `12`, comment `"lunch"`, category `uncategorized`, and today's date

#### Scenario: Saving the reviewed form creates the spending

- **WHEN** the owner submits the prefilled review form
- **THEN** the spending is created with the (possibly edited) values and `source: 'voice'`

#### Scenario: Dismissing the review form writes nothing

- **WHEN** the owner cancels or dismisses the prefilled review form
- **THEN** no spending is created and nothing is left behind

#### Scenario: Unparseable transcript opens the form with a blank amount

- **WHEN** the transcript contains no recognizable number (e.g. "coffee")
- **THEN** the app does not invent an amount and opens the review form with a blank amount and the raw text as the comment, so the owner supplies the amount before saving (no flagged row is written from the web voice path)

#### Scenario: PWA "Log by voice" shortcut opens the same review form

- **WHEN** the app is launched via the "Log by voice" shortcut
- **THEN** it starts listening automatically and, on transcription, opens the prefilled review form exactly as a tap would

## ADDED Requirements

### Requirement: Non-interactive ingress persists flagged-for-review entries

Non-interactive server ingress paths SHALL persist a spending directly, without a
review form. These are the canonical `recordSpending` paths (REST now, Telegram
later), which have no owner present. When such a path cannot determine an amount,
it SHALL store the entry with amount `0` and `needsReview: true` rather than reject
it, so the capture is not lost and is surfaced later in the list for correction
(the amber "?"). This flagged-ingress behavior SHALL remain available independently
of the web voice review flow.

#### Scenario: Server ingress without a resolvable amount is flagged, not dropped

- **WHEN** a non-interactive path records a spending whose amount cannot be determined
- **THEN** the entry is persisted with amount `0` and `needsReview: true`, and appears in the list flagged for review

#### Scenario: Flagged entry is corrected later from the list

- **WHEN** the owner opens a flagged (`needsReview`) entry from the list and sets a valid amount
- **THEN** the entry is updated with the amount and the review flag is cleared
