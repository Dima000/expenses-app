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

The system SHALL extract the spending amount from the transcribed text using a deterministic "first number wins" parser: the first numeric token (allowing an optional leading currency symbol and an optional decimal part) is the amount, rounded up to a whole unit, and the remaining text (symbol and amount token stripped) is the comment. Numbers SHALL be taken literally (no decimal guessing). No AI/Claude call is required in the initial version.

#### Scenario: Amount and comment are separated

- **WHEN** the transcript is "12 lunch"
- **THEN** the created spending has amount `12` (whole units) and comment `"lunch"`

#### Scenario: Currency symbol is ignored and decimal is rounded up

- **WHEN** the transcript is "£12.50 lunch"
- **THEN** the created spending has amount `13` (rounded up) and comment `"lunch"`

#### Scenario: Only the first number is taken as the amount

- **WHEN** the transcript is "1250 rent"
- **THEN** the created spending has amount `1250` (taken literally, not `12.50`) and comment `"rent"`

#### Scenario: No recognizable number is flagged for correction

- **WHEN** the transcript contains no recognizable number (e.g. "coffee")
- **THEN** the app does not invent an amount; it saves the entry with the amount flagged as needing correction and the full raw text as the comment, surfaced for a fix in the list

### Requirement: Fire-and-forget voice save as uncategorized

A voice-captured spending SHALL be saved immediately as `uncategorized` with a brief confirmation toast, without a multi-step confirmation dialog, deferring category assignment to the categorize-later flow. The toast SHALL show the parsed amount and offer Undo and Edit, and SHALL NOT present category choices.

#### Scenario: Voice entry saves without extra steps

- **WHEN** the owner finishes speaking a valid spending
- **THEN** the app saves it as `uncategorized` and shows a brief confirmation toast (e.g. "Logged £13 · uncategorized") offering Undo and Edit, with no category choices in the toast

#### Scenario: Edit from the toast opens the full form

- **WHEN** the owner taps Edit on the confirmation toast
- **THEN** the standard edit form opens with amount, date, category, and comment so the entry can be corrected or categorized immediately

#### Scenario: Undo removes the entry

- **WHEN** the owner taps Undo on the confirmation toast
- **THEN** the just-saved spending is removed

#### Scenario: Voice entry appears in the month view

- **WHEN** a spending is captured by voice for today
- **THEN** it appears in the current-month table and is discoverable via the categorize-later flow

