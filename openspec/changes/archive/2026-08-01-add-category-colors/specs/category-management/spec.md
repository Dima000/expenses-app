## ADDED Requirements

### Requirement: Fixed category color palette

The system SHALL define a fixed palette of 16 named colors (Gray, Brown, Red, Orange, Amber, Yellow, Lime, Green, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Pink) held at matched lightness and chroma, so no palette color visually dominates another. Each palette color SHALL render identically in the light and dark themes.

#### Scenario: Palette has sixteen distinct colors

- **WHEN** the category color palette is inspected
- **THEN** it contains exactly 16 named colors, each visually distinguishable from the others

#### Scenario: A palette color does not change with theme

- **WHEN** the app theme switches between light and dark
- **THEN** a given palette color's value is unchanged

### Requirement: Every category has an assigned color

Each category SHALL store a `colorId` referencing one of the 16 palette colors. When the owner adds a new category, the system SHALL automatically assign it a color not already used by another category in the owner's set, falling back to reusing a palette color only once all 16 are in use. The owner SHALL be able to change any category's color at any time, choosing from the same 16-swatch palette, and colors MAY repeat across categories.

#### Scenario: New category is auto-assigned a distinct color

- **WHEN** the owner adds a category and at least one palette color is not yet used by their existing categories
- **THEN** the new category is assigned one of the unused palette colors

#### Scenario: Palette exhausted falls back to reuse

- **WHEN** the owner adds a category and all 16 palette colors are already used by their existing categories
- **THEN** the new category is assigned a palette color already in use, rather than being left without a color

#### Scenario: Owner changes a category's color

- **WHEN** the owner picks a different color for an existing category from the 16-swatch palette
- **THEN** the category's stored color is updated and reflected everywhere the category is shown

#### Scenario: Two categories may share a color

- **WHEN** the owner assigns the same palette color to two different categories
- **THEN** the system allows it; color has no uniqueness constraint

### Requirement: Default categories ship with pre-assigned colors

Each of the 8 seeded default categories (Groceries, Health, Sports, Pet, Relationships, Kid, Utilities, Other) SHALL be seeded with a distinct, pre-assigned palette color rather than relying on the auto-assignment algorithm.

#### Scenario: Seeded defaults have distinct colors

- **WHEN** the default categories are seeded on first run
- **THEN** all 8 have a `colorId` and no two of them share the same color

### Requirement: Pre-existing categories without a stored color resolve to a fallback

A category persisted before color support existed (no stored `colorId`) SHALL still resolve to one of the 16 palette colors when displayed, without requiring a write to backfill the missing field. Once the owner explicitly sets that category's color, the chosen color SHALL be persisted like any other field.

#### Scenario: Category without a stored color still renders with a color

- **WHEN** a category loaded from storage has no `colorId`
- **THEN** the UI displays it with a palette color instead of leaving it colorless, and no write is made to the category document as a result

#### Scenario: Explicitly setting a color on a previously colorless category persists it

- **WHEN** the owner sets a color on a category that previously had no stored `colorId`
- **THEN** the chosen `colorId` is persisted and continues to be used on subsequent loads

### Requirement: Color indicator wherever a category is shown

Every place a category is displayed SHALL show a small color dot next to its name, using its assigned (or fallback) color: the spending table's category badge, the category selection dropdown, and the categories manager row. The badge/row background SHALL remain neutral; only the dot carries the assigned color.

#### Scenario: Spending table shows the category's color

- **WHEN** a spending row's category is resolved
- **THEN** its badge shows a color dot matching the category's assigned color, next to its name

#### Scenario: Category picker shows each option's color

- **WHEN** the category selection dropdown is opened
- **THEN** each listed category shows its color dot next to its name

#### Scenario: Categories manager shows each row's color

- **WHEN** the categories manager list is displayed
- **THEN** each category row shows its color dot next to its name

### Requirement: Alphabetical ordering when picking a category

Wherever categories are offered for picking to create or assign a spending, the system SHALL list them sorted alphabetically by name (case-insensitive), matching the ordering already used by the categories manager.

#### Scenario: Creating an expense lists categories alphabetically

- **WHEN** the owner opens the category picker while adding a new spending
- **THEN** the categories are listed in alphabetical order by name

#### Scenario: Assigning an uncategorized spending lists categories alphabetically

- **WHEN** the owner opens the inline category picker to assign a category to an uncategorized spending
- **THEN** the categories are listed in alphabetical order by name
