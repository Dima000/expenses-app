## ADDED Requirements

### Requirement: Native controls render in the dark color scheme

The web app SHALL declare `color-scheme: dark` in the base layer of `src/index.css`, so that
browser-drawn controls (date picker icon and dialog, native select lists, scrollbars) render
for the dark theme. The declaration SHALL live outside the CLI-managed token blocks so that
regenerating the theme does not remove it.

#### Scenario: Calendar icon is visible

- **WHEN** the owner opens the add-spending form
- **THEN** the Date field's calendar icon is drawn light on the dark background

#### Scenario: Survives theme regeneration

- **WHEN** the shadcn theme tokens are regenerated
- **THEN** the `color-scheme: dark` declaration is still present
