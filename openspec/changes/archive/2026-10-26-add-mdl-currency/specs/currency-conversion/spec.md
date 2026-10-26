## MODIFIED Requirements

### Requirement: Supported currencies and base currency

The system SHALL treat RON as the single base currency in which every spending is stored
and reported. The system SHALL offer exactly five entry currencies: RON, EUR, USD, GBP and MDL.
No currency SHALL be persisted on a spending record; a non-RON amount SHALL be converted to
RON at write time and only the RON amount SHALL be stored.

#### Scenario: Entry currencies offered

- **WHEN** the owner opens the add-spending form
- **THEN** the currency control offers RON, EUR, USD, GBP and MDL and no other currency

#### Scenario: Stored records carry no currency

- **WHEN** a spending is entered in EUR and saved
- **THEN** the persisted record contains a RON amount and no currency field, and every
  total, report and drilldown treats it identically to a natively-entered RON record

#### Scenario: MDL entry is converted and captioned

- **WHEN** the owner enters `150` with MDL selected and the cached rate is `0.2663` RON per MDL
- **THEN** the stored amount is `40` RON (`39.945` rounded up) and the original-entry caption
  reads `150 MDL @ 0.2663`

### Requirement: Exchange rate source

The system SHALL obtain exchange rates from public HTTP endpoints that require no API key and
permit direct browser access, requesting rates based on RON. EUR, USD and GBP SHALL come from
the ECB-backed source (Frankfurter). MDL, which that source does not publish, SHALL come from a
second source (open.er-api.com). Because both sources express rates as base-to-foreign, the
system SHALL invert each rate when caching it so the cached table expresses **RON per one unit
of the foreign currency**. All rate access SHALL be isolated behind a single module so either
provider can be replaced without changing any call site.

#### Scenario: Rates are inverted at cache time

- **WHEN** the ECB source returns `{"base":"RON","rates":{"EUR":0.19017,"GBP":0.16305,"USD":0.22146}}`
- **THEN** the cached table holds approximately `{ EUR: 5.2584, GBP: 6.1331, USD: 4.5155 }`,
  each value meaning "RON per one unit"

#### Scenario: MDL rate is taken from the second source and inverted

- **WHEN** the second source returns `{"base_code":"RON","rates":{"MDL":3.754761, ...}}`
- **THEN** the cached MDL rate is approximately `0.2663` RON per MDL, and no other currency
  from that response is cached

#### Scenario: Each currency comes from exactly one source

- **WHEN** both sources respond successfully
- **THEN** EUR, USD and GBP are taken only from the ECB source and MDL only from the second
  source, even though the second source also publishes EUR, USD and GBP

#### Scenario: Rate access is isolated

- **WHEN** either rate provider is replaced with a different endpoint
- **THEN** only the rate module changes, and no component that converts or displays an
  amount is modified

### Requirement: Once-per-day device rate cache

The system SHALL cache each rate source's table durably on the owner's device, independently
of the other source. Each source's cache SHALL record two independent timestamps: the date the
rates were published by the source, and the time at which the client last fetched them. On
application start the system SHALL refresh a source's cache only when that source's last fetch
is older than 24 hours. A refresh SHALL never block the form: cached tables SHALL be usable
immediately while a refresh runs. The rate table used for conversion SHALL be the union of the
cached tables of both sources.

#### Scenario: Cache is reused within a day

- **WHEN** the app starts and both sources were fetched less than 24 hours ago
- **THEN** the system uses the cached rates and issues no network request

#### Scenario: Cache is refreshed after a day

- **WHEN** the app starts and a source was fetched more than 24 hours ago
- **THEN** the system uses the cached rates immediately and fetches a replacement for that
  source in the background, updating that source's cache on success

#### Scenario: Sources refresh independently

- **WHEN** the app starts with the ECB cache fetched 2 hours ago and the MDL cache fetched
  30 hours ago
- **THEN** only the MDL source is requested

#### Scenario: Failed refresh keeps the existing table

- **WHEN** a background refresh of one source fails
- **THEN** that source's previously cached rates remain in use and remain available on the
  next start, and the other source's cache is unaffected

#### Scenario: Existing caches survive the upgrade

- **WHEN** a device that cached EUR, USD and GBP before MDL existed starts the new version
  offline
- **THEN** EUR, USD and GBP remain selectable from the existing cache, and only MDL is
  unavailable until the device connects

### Requirement: Cold start without any cached rates

The system SHALL always present every foreign currency in the picker, and SHALL render a
foreign currency disabled whenever no rate for it has ever been cached on the device, with an
explanation that rates for the disabled currencies are unavailable until the device connects
once. Availability SHALL be decided per currency, so a currency whose source has been cached
SHALL remain selectable when another source has never succeeded. RON entry SHALL remain fully
available at all times.

#### Scenario: First run offline

- **WHEN** the app is opened for the first time on a device with no network and no cached rates
- **THEN** EUR, USD, GBP and MDL appear disabled with a message explaining that one online
  moment is required, while RON entry works normally

#### Scenario: Only one source has ever succeeded

- **WHEN** the ECB source has been cached but the MDL source has never returned a valid response
- **THEN** EUR, USD and GBP are selectable, MDL appears disabled, and the explanation is shown

#### Scenario: Foreign currencies enable after first successful fetch

- **WHEN** the device connects and a source's rate fetch succeeds
- **THEN** that source's currencies become selectable, and their disabled state is not
  reachable again unless the cache is cleared

### Requirement: Cache integrity

The system SHALL validate the shape of each source's rate response before writing it to that
source's cache, requiring a successful RON-based table and a usable positive numeric rate for
every currency taken from that source (EUR, USD and GBP from the ECB source; MDL from the second
source). A malformed, partial, non-numeric or non-RON-based response SHALL be discarded and SHALL NOT overwrite that source's previously
valid cached table. Cached tables SHALL be re-validated on read with the same rule.

#### Scenario: Malformed response does not poison the cache

- **WHEN** an ECB rate fetch returns a response missing the GBP rate
- **THEN** the response is discarded, the existing ECB cached table is left intact, and
  conversion continues to work

#### Scenario: Missing MDL rate is discarded

- **WHEN** the second source returns a response without a positive numeric `MDL` rate
- **THEN** the response is discarded, the existing MDL cache (if any) is left intact, and
  EUR, USD and GBP are unaffected

### Requirement: Demo mode uses frozen rates and performs no network access

The public demo route SHALL NOT issue any rate request to either source. It SHALL use a fixed
rate table, including MDL, compiled into the application so that demo behaviour is
deterministic and the publicly reachable, unauthenticated surface generates no outbound traffic
to any rate provider.

#### Scenario: Demo route issues no rate request

- **WHEN** the demo route is opened
- **THEN** no request is made to either exchange-rate provider and the currency picker operates
  against the fixed table

#### Scenario: Demo conversions are deterministic

- **WHEN** the same foreign amount is entered twice in demo mode on different days
- **THEN** both conversions produce the same RON amount

#### Scenario: MDL is available in demo mode

- **WHEN** the demo route is opened on a device that has never fetched rates
- **THEN** MDL is selectable and converts using the fixed table
