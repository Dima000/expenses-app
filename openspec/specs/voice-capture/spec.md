# voice-capture Specification

## Purpose
TBD - created by archiving change add-expense-tracker. Update Purpose after archive.
## Requirements
### Requirement: In-app voice capture

The web app SHALL provide a mic control that uses the browser's speech recognition (Web Speech API) to transcribe the owner's speech into text for creating a spending, without any external service or AI call.

#### Scenario: Owner captures a spending by voice

- **WHEN** the owner activates the mic control and speaks a phrase like "twelve lunch"
- **THEN** the app transcribes the speech and creates a spending via the client write path

#### Scenario: Mic is hidden where speech recognition is unavailable

- **WHEN** the app runs in a browser that does not support the Web Speech API
- **THEN** the mic control is hidden or disabled and the manual add form remains available

### Requirement: Amount extraction from transcript

The system SHALL extract the spending amount and its currency from the transcribed or typed text using a deterministic "first number wins" parser: the first numeric token (allowing an optional leading currency symbol and an optional decimal part) is the amount, and the remaining text is the comment. Numbers SHALL be taken literally (no decimal guessing). No AI/Claude call is required.

The parser SHALL detect the entry currency from a leading currency symbol (`€`, `$`, `£`) or from a recognised currency word immediately following the number, and SHALL strip the symbol or word from the comment. Recognised words SHALL cover both Romanian and English, since transcription follows the browser locale, and SHALL be matched case-insensitively with diacritics normalised (`liră` matching `lira`). A trailing word that is not a recognised currency SHALL be left in the comment untouched. When no symbol or currency word is present, the parser SHALL report no currency and the caller SHALL use the currency selected in the form.

The parser SHALL return the amount **unrounded**. The whole-unit round-up SHALL be applied downstream, after any currency conversion, so that it is applied exactly once. No AI/Claude call is required in the initial version.

#### Scenario: Amount and comment are separated

- **WHEN** the transcript is "12 lunch"
- **THEN** the parsed amount is `12` with comment `"lunch"` and no detected currency, and the created spending has amount `12` in whole units

#### Scenario: Leading currency symbol selects the currency

- **WHEN** the transcript is "£12.50 lunch"
- **THEN** the parser reports amount `12.5`, currency GBP and comment `"lunch"`, and the symbol is not left in the comment

#### Scenario: Trailing currency word selects the currency and is stripped

- **WHEN** the transcript is "11 euro lunch"
- **THEN** the parser reports amount `11`, currency EUR and comment `"lunch"`, with `"euro"` removed from the comment

#### Scenario: Base-currency word is stripped without conversion

- **WHEN** the transcript is "10 lei bere"
- **THEN** the parser reports amount `10`, currency RON and comment `"bere"`, and no conversion is applied

#### Scenario: Unrecognised trailing word stays in the comment

- **WHEN** the transcript is "10 coffee"
- **THEN** the parser reports amount `10`, no detected currency, and comment `"coffee"`

#### Scenario: Amount is returned unrounded

- **WHEN** the transcript is "12.50 lunch"
- **THEN** the parser returns `12.5`, and the round-up to `13` is applied later by the write path rather than by the parser

#### Scenario: Only the first number is taken as the amount

- **WHEN** the transcript is "1250 rent"
- **THEN** the created spending has amount `1250` (taken literally, not `12.50`) and comment `"rent"`

#### Scenario: No recognizable number is flagged for correction

- **WHEN** the transcript contains no recognizable number (e.g. "coffee")
- **THEN** the app does not invent an amount; it saves the entry with the amount flagged as needing correction and the full raw text as the comment, surfaced for a fix in the list

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

### Requirement: Voice review form carries the detected currency

A voice-captured spending SHALL open the standard add form prefilled with the parsed amount, comment and any currency detected from the utterance, so the currency control reflects what was spoken and the owner can correct it before committing. When no currency was detected, the control SHALL show the RON default.

#### Scenario: Spoken currency preselects the picker

- **WHEN** the owner speaks "11 euro lunch"
- **THEN** the review form opens with the currency control set to EUR, the amount and comment prefilled, and nothing yet written

#### Scenario: No spoken currency leaves the default

- **WHEN** the owner speaks "12 lunch"
- **THEN** the review form opens with the currency control on RON

