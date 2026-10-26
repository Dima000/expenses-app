## ADDED Requirements

### Requirement: MDL is selected only from the picker

The parser SHALL NOT detect MDL from a transcript or typed text: MDL has no recognised symbol
and no recognised currency word. Because Moldovan lei and Romanian lei share the words `lei` and
`leu`, those words SHALL continue to select RON. MDL entry SHALL be made by choosing MDL in the
add form's currency control. A detected RON SHALL NOT move the control off an explicit MDL
selection, so typing `lei` under MDL never silently stores the amount as RON.

#### Scenario: "lei" still means RON

- **WHEN** the transcript is "150 lei cafea"
- **THEN** the parser reports amount `150`, currency RON and comment `"cafea"`

#### Scenario: No MDL word is recognised

- **WHEN** the transcript is "150 mdl cafea"
- **THEN** the parser reports no detected currency and leaves `"mdl cafea"` in the comment

#### Scenario: MDL chosen in the picker is kept when no currency is spoken

- **WHEN** the owner selects MDL and types "150 cafea"
- **THEN** the parser reports no currency and the entry is converted from MDL

#### Scenario: "lei" typed under MDL keeps MDL

- **WHEN** the owner selects MDL and types "150 lei cafea"
- **THEN** the currency control stays on MDL and the entry is converted from MDL with comment
  `"cafea"`
