# currency-conversion Specification

## Purpose
TBD - created by archiving change add-entry-currency-conversion. Update Purpose after archive.
## Requirements
### Requirement: Supported currencies and base currency

The system SHALL treat RON as the single base currency in which every spending is stored
and reported. The system SHALL offer exactly four entry currencies: RON, EUR, USD and GBP.
No currency SHALL be persisted on a spending record; a non-RON amount SHALL be converted to
RON at write time and only the RON amount SHALL be stored.

#### Scenario: Entry currencies offered

- **WHEN** the owner opens the add-spending form
- **THEN** the currency control offers RON, EUR, USD and GBP and no other currency

#### Scenario: Stored records carry no currency

- **WHEN** a spending is entered in EUR and saved
- **THEN** the persisted record contains a RON amount and no currency field, and every
  total, report and drilldown treats it identically to a natively-entered RON record

### Requirement: Exchange rate source

The system SHALL obtain exchange rates from a public HTTP endpoint that requires no API key
and permits direct browser access, requesting rates based on RON for the three foreign
currencies. Because the source expresses rates as base-to-foreign, the system SHALL invert
each rate when caching it so the cached table expresses **RON per one unit of the foreign
currency**. All rate access SHALL be isolated behind a single module so the provider can be
replaced without changing any call site.

#### Scenario: Rates are inverted at cache time

- **WHEN** the source returns `{"base":"RON","rates":{"EUR":0.19017,"GBP":0.16305,"USD":0.22146}}`
- **THEN** the cached table holds approximately `{ EUR: 5.2584, GBP: 6.1331, USD: 4.5155 }`,
  each value meaning "RON per one unit"

#### Scenario: Rate access is isolated

- **WHEN** the rate provider is replaced with a different endpoint
- **THEN** only the rate module changes, and no component that converts or displays an
  amount is modified

### Requirement: Once-per-day device rate cache

The system SHALL cache the rate table durably on the owner's device. The cache SHALL record
two independent timestamps: the date the rates were published by the source, and the time at
which the client last fetched them. On application start the system SHALL refresh the cache
only when the last fetch is older than 24 hours. A refresh SHALL never block the form: a
cached table SHALL be usable immediately while a refresh runs.

#### Scenario: Cache is reused within a day

- **WHEN** the app starts and the cached table was fetched less than 24 hours ago
- **THEN** the system uses the cached rates and issues no network request

#### Scenario: Cache is refreshed after a day

- **WHEN** the app starts and the cached table was fetched more than 24 hours ago
- **THEN** the system uses the cached rates immediately and fetches a replacement in the
  background, updating the cache on success

#### Scenario: Failed refresh keeps the existing table

- **WHEN** a background refresh fails
- **THEN** the previously cached rates remain in use and remain available on the next start

### Requirement: Stale rates are used without restriction

The system SHALL NOT impose a maximum age on cached rates and SHALL NOT block or warn on
entry when the cached rates are old. Because amounts are ceilinged to whole RON units at
entry, the error introduced by an old rate is smaller than the error already introduced by
that rounding for all realistic staleness.

#### Scenario: Days-old rates are used normally

- **WHEN** the owner has been offline for several days and enters a EUR amount
- **THEN** the conversion uses the cached rates and the entry is saved without warning or
  obstruction

### Requirement: Cold start without any cached rates

The system SHALL, when no rate table has ever been cached on the device and a fetch cannot
complete, still present the three foreign currencies in the picker but render them disabled
with an explanation that rates are unavailable until the device connects once. RON entry
SHALL remain fully available at all times.

#### Scenario: First run offline

- **WHEN** the app is opened for the first time on a device with no network and no cached rates
- **THEN** EUR, USD and GBP appear disabled with a message explaining that one online moment
  is required, while RON entry works normally

#### Scenario: Foreign currencies enable after first successful fetch

- **WHEN** the device connects and a rate fetch succeeds
- **THEN** the three foreign currencies become selectable, and this disabled state is not
  reachable again unless the cache is cleared

### Requirement: Cache integrity

The system SHALL validate the shape of a rate response before writing it to the cache,
requiring a usable positive numeric rate for each of the three foreign currencies. A
malformed, partial or non-numeric response SHALL be discarded and SHALL NOT overwrite a
previously valid cached table.

#### Scenario: Malformed response does not poison the cache

- **WHEN** a rate fetch returns a response missing the GBP rate
- **THEN** the response is discarded, the existing cached table is left intact, and
  conversion continues to work

### Requirement: Demo mode uses frozen rates and performs no network access

The public demo route SHALL NOT issue any rate request. It SHALL use a fixed rate table
compiled into the application so that demo behaviour is deterministic and the publicly
reachable, unauthenticated surface generates no outbound traffic to the rate provider.

#### Scenario: Demo route issues no rate request

- **WHEN** the demo route is opened
- **THEN** no request is made to the exchange-rate provider and the currency picker operates
  against the fixed table

#### Scenario: Demo conversions are deterministic

- **WHEN** the same foreign amount is entered twice in demo mode on different days
- **THEN** both conversions produce the same RON amount

