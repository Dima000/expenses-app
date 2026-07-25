# Native app vs. PWA: React Native, Flutter, or stay web?

- **Date:** 2026-07-25
- **Status:** Exploration — no decision made
- **Trigger:** iPhone users report the PWA "doesn't work" for them; considering a
  native rewrite in React Native or Flutter.
- **Audience:** under 10 users total — some on desktop web, some iPhone, some Android.

> This is a thinking document, not a proposal. Nothing here is committed to.
> If a direction is chosen, it graduates into an OpenSpec change under
> `openspec/changes/`.

---

## What's actually on the table to move

```
  shared/src        502 lines   TS domain: categories, validation, parseAmount, money, dates
  web/src (app)   1,674 lines   hand-written screens + hooks + firebase/firestore layer
  web/src/ui        563 lines   generated shadcn (free to regenerate, doesn't count)
  functions/src     153 lines   recordSpending core + REST
  firestore.rules   ~80 lines   mirrors shared/ validation
  ────────────────────────────
  ~2,300 lines that would actually be ported
```

Small enough that **the rewrite cost is not the deciding factor** — it's a weekend
or two of work either way. Which means the decision should be made on the things
that are *permanent*: distribution cost, number of codebases, and whether
`@expenses/shared` stays the single source of truth.

---

## Step zero: diagnose before rewriting

The app is voice-first via `webkitSpeechRecognition`
(`web/src/hooks/useSpeechRecognition.ts:24-30`). That API has several distinct
failure modes on iOS that all surface to a non-technical user as
"it doesn't work":

```
   iOS failure modes — all reported identically
   ═══════════════════════════════════════════════════════

   (A) Using Chrome/Firefox on iOS
       └─ webkitSpeechRecognition is NOT exposed outside Safari.
          The `supported` check returns false → mic hidden entirely.
          User sees an app with no voice button and no explanation.

   (B) Installed to Home Screen (standalone mode)
       └─ Mic permission in iOS standalone PWAs has a long history of
          silently failing / not re-prompting. Works in a Safari tab,
          dies once installed.

   (C) Never installed at all
       └─ iOS has no install prompt. It's Share → Add to Home Screen,
          buried, Safari-only. Most people never find it.
          They're using a bookmark and wondering why it's "not an app".

   (D) Actually works, but feels bad
       └─ single-shot, no interim results, requires network,
          re-prompts, cuts off early.
```

**(A) and (C) are not platform problems.** They're a detection fix and a
screenshot. Rewriting in Flutter to fix a browser-detection bug would be a large
cost for nothing.

**Cheapest next action:** have one iPhone user open the site in **Safari
specifically**, tap the mic in a normal tab (not installed), and report what
happens. That one data point may close this entire exploration.

Only (B) and (D) are genuinely unfixable from the web.

---

## The factor that dominates: iOS distribution

More decisive than React-vs-Dart, and easy to overlook until you're committed.

```
                        PWA              Native (RN or Flutter)
  ────────────────────────────────────────────────────────────────
  Get it to a user      send a URL       Apple Developer Program
                                         $99/year, forever

  iOS delivery          —                TestFlight: builds EXPIRE
                                         every 90 days. Re-upload
                                         4x/year or the app stops
                                         opening for everyone.

                                         Ad-hoc: collect each device's
                                         UDID by hand, re-sign yearly,
                                         100-device cap.

                                         App Store: review. A personal
                                         expense tracker risks 4.2
                                         "minimum functionality", and
                                         5.1.1(v) mandates building
                                         account deletion.

  Android delivery      —                Sideload APK (easy) or
                                         Play internal test ($25 once)

  Shipping a fix        git push,        rebuild → upload → wait for
                        live in 60s      processing → users update
  ────────────────────────────────────────────────────────────────
```

For **under 10 users**, native means **$99/year plus a recurring chore every 90
days, indefinitely**, to serve roughly four iPhones. That is the real price tag —
not the port.

---

## What survives each move

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │                    WHAT SURVIVES THE MOVE?                           │
 └──────────────────────────────────────────────────────────────────────┘

  PWA (stay)          RN + Expo              Flutter
  ──────────          ─────────              ───────
  ┌──────────┐        ┌──────────┐           ┌──────────┐
  │ shared/  │  100%  │ shared/  │  100% ✓   │ shared/  │   0%  ✗
  │  502 ln  │───────▶│ same TS  │           │ REWRITE  │  in Dart
  └──────────┘        └──────────┘           └──────────┘
  ┌──────────┐        ┌──────────┐           ┌──────────┐
  │ firebase │  100%  │ logic ok │   ~80% ✓  │ REWRITE  │   0%  ✗
  │  layer   │───────▶│ SDK swap │           │FlutterFire│
  └──────────┘        └──────────┘           └──────────┘
  ┌──────────┐        ┌──────────┐           ┌──────────┐
  │ UI       │  100%  │ REWRITE  │    0% ✗   │ REWRITE  │   0%  ✗
  │ shadcn/  │───────▶│ Radix +  │  but in   │ in Dart, │
  │ Radix/tw │        │ Tailwind │  a known  │ new lang │
  │ 1,674 ln │        │ don't    │  language │          │
  └──────────┘        │ exist in │           └──────────┘
                      │ RN       │
                      └──────────┘
  ┌──────────┐
  │functions │  100% unchanged in ALL THREE — it's just Firestore
  │ rules    │
  └──────────┘
```

**Both native paths are a full UI rewrite.** Radix, Tailwind classes and shadcn
are DOM-only; none of it survives into React Native. The common assumption that
"React Native means my React code works" is false. What RN preserves is the
*language, mental model, and domain package* — not the screens.

---

## Comparison

| | **Stay PWA** | **React Native (Expo)** | **Flutter** |
|---|---|---|---|
| **Voice quality** | ⚠️ Web Speech API. Great on Android/Chrome, flaky-to-broken on iOS, absent in non-Safari iOS browsers | ✅ `@react-native-voice/voice` → native `SFSpeechRecognizer` / Android `SpeechRecognizer`. Reliable, free, on-device on modern iOS | ✅ `speech_to_text` → identical native APIs. Same quality |
| **Reuse `@expenses/shared`** | ✅ as-is | ✅ as-is — same TS package, same `node --test` suite | ❌ port 502 lines to Dart. The "categories live in ONE place" invariant becomes a 3-way mirror (shared.ts + rules + Dart) |
| **Firebase fit** | ✅ native home turf | ✅ `@react-native-firebase` mature; or JS SDK | ✅✅ FlutterFire is Google-built and arguably the best-supported client after web. A genuine Flutter advantage on a 100%-Firebase stack |
| **The web target** | ✅ *is* the product. Fast Vite bundle | ⚠️ react-native-web works but shadcn is lost again; desktop feel compromised | ⚠️ Flutter Web = CanvasKit/WASM, multi-MB cold load, non-native text selection & a11y. Acceptable for a private dashboard, a downgrade from today |
| **Language / workflow** | ✅ TS end-to-end, OpenSpec, existing tests | ✅ TS end-to-end, everything transfers | ❌ Dart. Second language, second test runner, second toolchain. The repo stops being one thing |
| **Build reliability** | — | Fair criticism: more moving parts, native-module churn, prebuild config. Expo has fixed most of this | ✅ Renders through Flutter's own engine → pixel-identical across devices, very few "works on my phone" bugs. Best-in-class hot reload |
| **iOS distribution** | ✅ URL, free, instant updates | ❌ $99/yr + 90-day TestFlight cycle | ❌ same |
| **Unlocks Siri Shortcut / widget / lock-screen capture** | ❌ | ✅ | ✅ |
| **Offline** | ⚠️ exactly what `fix-category-reseed-offline-persistence` addresses | ✅ native SDK persistence, better | ✅ native SDK persistence, better |
| **Codebases to maintain** | **1** | **1** (via RN-Web) or **2** | **2** (Flutter app + keep the Vite web app), or 1 with a worse web |
| **Rough effort** | 0 | ~1–2 weekends | ~2–4 weekends (Dart ramp + `shared/` port) |

---

## Reading the tradeoff

Flutter's reputation for reliability is deserved. For "build one thing that
behaves identically on iOS and Android," it's the more predictable tool, and
FlutterFire suits this backend well. Greenfield and mobile-only, it would be a
defensible pick.

The shape of *this* project cuts against it:

```
  Flutter's strength:   one codebase → many mobile platforms, pixel-perfect
  This situation:       ~4 mobile users, a web-first product,
                        a TypeScript domain package that is the single
                        source of truth mirrored into firestore.rules,
                        and a spec-driven TS repo

  ─────────────────────────────────────────────────────────────────
  Flutter's cost (new language, duplicated domain logic, weaker web)
  buys cross-platform consistency across ~4 phones. The math doesn't land.
```

Between the two native options, **React Native fits this repo better** — not
because it's the better framework in the abstract, but because it keeps
`shared/` as one file, keeps the test suite, and keeps the language the rest of
the stack is written in. Flutter's advantages are real, but they're advantages
for a different project.

---

## The fourth path: Capacitor

Not in the original framing, but likely the best cost/benefit. Wrap the existing
web app in a native shell:

```
  ┌────────────────────────────────────────────────────────┐
  │  Existing Vite + React + shadcn app — UNCHANGED        │
  │  100% of 1,674 lines. Same repo. Same deploy.          │
  └───────────────────────┬────────────────────────────────┘
                          │
          ┌───────────────┼──────────────┐
          ▼               ▼              ▼
    ┌──────────┐   ┌────────────┐  ┌────────────┐
    │   Web    │   │ iOS binary │  │Android APK │
    │ same URL │   │ Capacitor  │  │ Capacitor  │
    │ as today │   │  WKWebView │  │  WebView   │
    └──────────┘   └─────┬──────┘  └─────┬──────┘
                         │               │
                         ▼               ▼
                  ┌──────────────────────────┐
                  │  NATIVE speech plugin    │
                  │  SFSpeechRecognizer      │  ← fixes the actual
                  │  Android SpeechRecognizer│     iPhone problem
                  └──────────────────────────┘
```

- Fixes the one thing genuinely broken (iOS voice) via a native mic/speech plugin.
- Real app icon and real app install — no "Add to Home Screen" ritual.
- Zero rewrite. One codebase. `shared/` untouched. Web unaffected.
- Web-layer fixes can ship without a native rebuild.
- **Still incurs the $99/yr + 90-day TestFlight tax.** Unavoidable on iOS.

---

## Ranked options

1. **Diagnose first** (free) — if it's Chrome-on-iOS or nobody installed it,
   fix the support detection and send install instructions. May end here.
2. **Capacitor** — if iOS voice is genuinely broken in Safari/standalone.
   ~90% of "native" for ~5% of the cost.
3. **React Native** — if the goal is for it to *be* a real app: Siri shortcut,
   widget, lock-screen capture. A genuine upgrade for a voice-first tracker.
4. **Flutter** — only if learning Dart is itself a goal. A legitimate reason,
   but it should be a conscious purchase, not a fix for the iPhone problem.

---

## Open questions

- What do the iPhone users *literally* see — missing mic button, mic that does
  nothing, or "it's just a website"?
- Which browser are they in? If Chrome-on-iOS, that's the whole story.
- Is voice the thing they want on iPhone, or just "a real app"? If the latter,
  this is an onboarding problem, not a platform one.
- Is $99/yr plus re-uploading a TestFlight build 4x/year, forever, acceptable?
  An honest answer eliminates two of the four paths immediately.
- Is learning Dart independently desirable?

---

## Sequencing note

The in-flight change `fix-category-reseed-offline-persistence` (13 tasks) fixes
active data loss on cold/offline launch. That bug is **platform-independent** —
it lives in `web/src/lib/categories.ts`'s seeding logic and would follow the app
into React Native or Flutter. Land it before any platform move, so a known-broken
data layer isn't what gets ported.
