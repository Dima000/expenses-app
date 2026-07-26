## MODIFIED Requirements

### Requirement: One-time default category seeding

On first run for an owner — when the server authoritatively reports that no categories document exists — the system SHALL seed a default set of categories (Groceries, Health, Sports, Pet, Relationships, Kid, Utilities, Other) with stable slug ids and no terms. Seeding SHALL be triggered ONLY by a server-confirmed absence: a snapshot served from the local cache or observed while offline (i.e. not yet confirmed against the server) SHALL NOT trigger seeding, because an empty or cold cache does not prove the document is absent. The seed write SHALL be non-destructive — it SHALL NOT overwrite a categories document that already exists — so a seed that races a reconnect can never clobber the owner's real category set. The system SHALL NOT re-seed after the document exists, including when the owner has deleted some or all categories.

#### Scenario: Defaults seeded on first run

- **WHEN** an owner uses the app for the first time and the server confirms no categories document exists
- **THEN** the system creates the default categories with stable ids and empty term lists

#### Scenario: No re-seed after deletion

- **WHEN** an owner who already has a categories document deletes categories and reloads the app
- **THEN** the system does not re-create the defaults; the owner's current set is preserved

#### Scenario: Cold or offline start does not re-seed

- **WHEN** the owner opens the app (including the installed PWA) from a cold cache or while offline, so the first categories snapshot is served from cache and reports no document
- **THEN** the system does NOT seed defaults and does NOT queue a seed write, and once the server snapshot arrives the owner's real categories and keywords are shown unchanged

#### Scenario: Seed cannot overwrite existing data

- **WHEN** a seed write is somehow pending while the owner's categories document already exists on the server
- **THEN** the seed write does not overwrite the existing document, and the owner's categories and keywords are preserved
