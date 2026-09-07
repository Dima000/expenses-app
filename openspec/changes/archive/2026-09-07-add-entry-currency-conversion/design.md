## Context

Spendings are stored as **whole positive integers** with no currency field. `roundUpAmount`
(`shared/src/money.ts`) ceilings any fractional amount exactly once, at entry, so month
totals stay exact without minor-unit bookkeeping. Every read path — `SpendingTable`,
`TotalCard`, reports, drilldowns, month/range queries — assumes one unit and sums plain
integers.

Three write paths exist, but only two surfaces:

```
   typed entry ──┐
                 ├──▶  SpendingForm (add mode)  ──▶  dataSource.createSpending
   voice ────────┘         ▲
                           └── voice never writes directly; since
                               `voice-review-before-save` it parses the utterance
                               and opens this same form prefilled for review

   REST ─────────────────▶  functions/recordSpending  (server-side, Admin SDK)
```

`parseAmountFromTranscript` is shared by both client surfaces: the free-text add field
("12 lunch with team") and voice. It already matches an optional leading `€`/`$`/`£`, then
**discards** it — behaviour that was correct with a single currency and is specified as such
in `voice-capture`, but becomes a silent lie the moment a second currency exists.

Constraints that shaped this design:

- The web client is an offline-first PWA with Firestore IndexedDB persistence and a durable
  offline write queue. Entry must work with no network.
- `/demo` is a **public, unauthenticated** route running on a local seeded data source with
  no Firestore and no network.
- Google sign-in is open with no allowlist, so the authenticated population is not fixed.
- `functions/` has no device-side rate cache and the REST endpoint is `invoker: 'private'`.

## Goals / Non-Goals

**Goals:**

- Let the owner enter an amount in EUR, USD or GBP and have it stored correctly in RON.
- Keep every read path, aggregation and stored-document shape working on a single unit.
- Keep a converted record explainable after the fact.
- Work offline, using whatever rates the device already has.
- Add no server-side infrastructure.

**Non-Goals:**

- Multi-currency records. Nothing sums, filters or groups by currency; there is no currency
  field on a record and no currency-aware reporting.
- Historical rates. Conversion uses the rate cached at entry time; no back-dating, no
  per-date rate lookup, no re-conversion of existing records.
- Editing a spending back in its original currency. See D3.
- Currency on the REST path.
- Any change to how amounts are rounded, displayed or aggregated once stored.

## Decisions

### D1 — Convert at write time; store RON only

The alternative is storing `{ amount, currency }` per record and converting on read. That
forces every aggregation to become currency-aware, requires rates at read time (so reports
break offline or drift as rates move), and touches `firestore.rules`, `recordSpending`, the
demo data source and every read component.

Converting once at entry confines the whole feature to the add form plus one new module.
`firestore.rules`, `functions/`, `demoDataSource` and all read paths are untouched.

The cost is accepted deliberately: a stored amount is a snapshot at the entry-day rate and is
never revalued. For a personal expense tracker that is the desired semantic — what you
actually spent, in your own currency, on that day.

### D2 — One free-text caption, not structured provenance

A converted record stores an optional `origAmount?: string` such as `"11 euro @ 5.2584"`.

This mirrors an existing pattern: `autoMatchedTerm` is already a stored field whose only job
is to explain *why a value is what it is*, surfaced as a one-line hint in the edit form and
cleared when the owner overrides it. `origAmount` answers the same question about the amount
that `autoMatchedTerm` answers about the category.

Rejected alternatives:

- **Store nothing.** Cheapest, but not retrofittable — records written before the decision is
  reversed are permanently unexplainable. This is the only decision in the change with that
  asymmetry, which is why it went the other way.
- **Structured `origAmount: number` + `origCurrency: string`.** Enables reconstructing the
  original entry, but invites exactly the multi-currency semantics D1 exists to avoid, and
  the reconstruction is only useful for a feature (D3) we are not building.
- **Append to the comment.** Comments feed auto-categorisation term matching, so writing
  `"€11"` into them has real side effects.

The field is inert by construction: nothing parses it, so it cannot leak into any read path.
Including the rate in the text matters because the preview line deliberately omits the rate
*date* (D6) — the rate number is therefore the only durable record of the conversion.

No `firestore.rules` change is needed: `validSpending` uses `data.keys().hasAll([...])`, not
`hasOnly`, so an additional optional field already passes.

### D3 — No currency control in the edit form

Currency selection is a one-time write-time operation. The edit form shows the stored RON
amount plus the caption read-only; correcting the currency of an existing entry means
deleting and re-creating it.

The alternative — a picker in edit mode, where selecting EUR means "reinterpret this number
as EUR" — would save mental arithmetic when correcting a foreign entry. It was rejected
because it adds a control to a form mostly opened to fix a comment, and because every re-save
of a foreign entry would re-convert at *today's* rate, quietly drifting the amount.

Note this is downstream of D2: because the caption is unparsed text, "edit it in its original
currency" is not merely unbuilt, it is unreachable. That is an accepted consequence.

### D4 — Caption is cleared only when the amount changes

`autoMatchedTerm` is cleared unconditionally on update. The caption cannot be, because it
must still display after an edit that only touched the comment — where it remains true.

```
  stored: amount 58, origAmount "11 euro @ 5.2584"

  edit comment  →  58 is still exactly the converted €11   →  caption TRUE   → keep
  edit amount   →  70 has nothing to do with €11           →  caption LIES   → clear
```

`updateSpending` writes a fixed field list and does not read the existing document. Rather
than adding a read, the form passes the caption through from the `editing` record it already
holds, and `updateSpending` clears it when the amount differs.

### D5 — Convert, then round, exactly once

```
   "11 euro lunch"  +  [EUR]
          │               │
          ▼               ▼
     parseAmount     fx cache: 5.2584 RON per EUR
      raw 11.0 ──────────┘
          │
          ▼   11 × 5.2584 = 57.8424
          ▼   roundUpAmount()   ◀── fires ONCE, here
         58
```

This forces a contract change: `parseAmountFromTranscript` currently rounds internally, so it
must now return the **raw** amount plus a detected currency. Rounding stays where it always
was conceptually — once, at the boundary — but moves downstream of conversion. Rounding
first would double-round (`10.4 EUR → 11 → 55` instead of `52`).

`convertToBase()` lives in `shared/src/money.ts` beside `roundUpAmount`, so the
round-once rule stays legible in one file. The *fetch* lives in `web/src/lib/fx.ts`, keeping
`shared/` free of anything network-shaped (and irrelevant to the server-side REST path).

### D6 — Client-side rate fetch, not a scheduled function

Rates come from `api.frankfurter.dev/v1/latest?base=RON&symbols=EUR,USD,GBP`, fetched
directly from the browser. Verified: no API key, `access-control-allow-origin: *`,
`cache-control: public, max-age=86400`, versioned path, and **native `base=RON` support** —
so no cross-rate arithmetic, which was the main risk with an ECB-backed source.

The considered alternative was a scheduled Cloud Function writing `rates/current` to
Firestore, which would inherit the existing IndexedDB persistence for free and make exactly
one outbound request per day regardless of user count. It was rejected on failure mode: a
dead cron fails **silently and globally** — every user frozen on old rates, with a symptom
("numbers are subtly wrong") that D7's own analysis says nobody would notice. A per-device
fetch fails loudly and locally, and lands in an already-designed state (D8).

The load concern that motivated the alternative does not survive the arithmetic. With a 24h
cache the ceiling is one request per user-device per day, every user requests the
byte-identical URL, and the response is CDN-cached for 24h — so origin sees roughly one fetch
per edge PoP per day, not one per user. Separately, the only *unbounded* population is
anonymous `/demo` traffic, which D9 removes from the picture entirely.

A "first client to see a stale cache writes it to Firestore for everyone" variant was also
rejected: it requires rules permitting any authenticated user to write the shared rate
document, letting any signed-up stranger corrupt every other user's conversions.

Rates are **inverted at cache time** to RON-per-unit (`0.19017 → 5.2584`), because that is
the direction conversion and the caption both need, and `@ 0.19017` would be unreadable in a
caption.

### D7 — No staleness cap, and no date in the UI

`Math.ceil` already injects up to 1.00 RON of deliberate error per entry. Against that:

```
  round-up to whole units (by design)   0 … 1.00 RON   ████████████
  rate 1 day stale                      ~0.01 RON      ▏
  rate 1 week stale                     ~0.05 RON      ▏
  rate 1 month stale (EUR)              ~0.10 RON      ▎
```

RON is quasi-managed against EUR, so a month-old EUR rate is more accurate than the rounding
policy already in force. Staleness is therefore not a correctness branch and gets no cap, no
warning and no blocking.

Two timestamps are still cached for different jobs: `fetchedAt` (our clock) drives the 24h
refresh guard; `ratesDate` (the source's publication date) is retained for debugging. The
preview line shows the **rate but not the date** — partly because staleness does not matter,
and partly because the ECB does not publish on weekends or holidays, so a perfectly healthy
cache routinely carries a date one to three days old. Showing it would cry wolf every Monday.

### D8 — Cold start shows foreign currencies disabled

With no cached table and a failed fetch, EUR/USD/GBP render **visible but disabled** with an
explanation. Rejected alternatives: hiding them (the feature silently vanishes and the owner
learns nothing), or bundling a fallback table into the build (always works, but a PWA
installed today and opened next year would convert at build-time rates with no signal — the
only option that produces a wrong number silently).

This state is unreachable after the first successful fetch unless site data is cleared.

### D9 — Demo mode uses a frozen table and never fetches

`/demo` is public and unauthenticated — the one surface with zero signup friction, therefore
the only place request volume could grow without bound. It uses a compiled-in fixed table.
This also makes demo conversions deterministic, matching how the rest of demo data works.

Note this is *not* solved by a Firestore-backed rate document: demo has no Firestore at all,
so a stub is required either way.

### D10 — Symbols and currency words select the currency

The picker makes symbols redundant, but *discarding* them is what makes the current parser
lie. Minimal honest fix: a leading symbol or a trailing currency word **sets the picker**, so
the control visibly moves and text and picker can never disagree on screen.

The wordlist is bilingual because `useSpeechRecognition` sets
`recognition.lang = navigator.language`, so a `ro-RO` browser transcribes `"zece euro"` /
`"douăzeci de lei"` and never emits symbols. Diacritics are normalised so `liră` matches
`lira`; an unrecognised trailing word is left in the comment untouched.

The highest-value case is not foreign at all: `"10 lei bere"` currently stores the comment
`"lei bere"`, which shows in the table *and* is fed to auto-categorisation term matching.
Stripping the base-currency word is comment hygiene on the most common entry path.

### D11 — Picker resets to RON on every open

Sticky selection would save a tap on consecutive foreign entries, but its failure mode is
severe and silent: forgetting the picker is left on EUR mis-records every subsequent entry
indefinitely. Resetting means the failure mode of forgetting is *a correct entry*. Entry
volume is overwhelmingly RON, so the tap cost falls on the rare path.

A shadcn `Select` is reused rather than a segmented control: four items, no new component,
and a rare-path control does not deserve permanent width beside a free-text field on mobile.

## Risks / Trade-offs

- **The rate provider is a free community service with no SLA** → All access is isolated
  behind `web/src/lib/fx.ts`, so swapping to another provider (or to a Firestore-backed
  table) is a single-file change with no call-site churn. Every failure mode degrades to D8:
  foreign currencies unavailable, RON entry unaffected.

- **A converted amount can never be revalued or explained structurally** (D1 + D2) → Accepted.
  The caption carries the entered amount and the rate as human-readable text, which covers
  the actual need ("why is this 58?") without reintroducing currency semantics.

- **A bad response could poison the cache** → The response shape is validated (a positive
  numeric rate for each of the three currencies) before anything is written; a malformed or
  partial response is discarded and the previous table survives.

- **A second cache mechanism** — localStorage alongside Firestore's IndexedDB persistence →
  Accepted for four numbers: synchronous read at app start means no async gate before the
  form is usable, and the contents are inspectable in devtools at a glance. Both stores carry
  the same eviction exposure on iOS, and eviction lands in the handled D8 state.

- **`parseAmountFromTranscript`'s contract change ripples** (D5) → It is consumed by
  `SpendingForm` and `VoiceButton` only, both in this change's scope. Its existing behaviour
  is covered by unit tests, which are updated alongside.

- **Currency-word stripping could remove a legitimate comment word** — e.g. an entry about
  buying "pounds" of something → The wordlist only matches a word *immediately following the
  number*, and voice entries always land in a review form before being written.

## Migration Plan

No data migration. `origAmount` is optional and absent from every existing record; readers
must treat its absence as the normal case. No `firestore.rules` deploy, no functions deploy —
the change ships as a web build.

Rollback is a redeploy of the previous build. Records written while the feature was live keep
a caption field that older code ignores, and their amounts are already plain RON integers
indistinguishable from any other record.

## Open Questions

- Should the currency wordlist be extended beyond RO/EN if `navigator.language` turns out to
  be something else in practice? Deferred until observed — an unrecognised word is harmless
  and simply stays in the comment.
- Is `ratesDate` worth surfacing anywhere (e.g. a settings or debug view) now that D7 keeps
  it out of the entry form? Cached regardless, so this can be answered later without a
  data change.
