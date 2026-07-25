## ADDED Requirements

### Requirement: Local persistence of Firestore data

The web client SHALL persist Firestore data in a durable local cache (IndexedDB) so that reads succeed from a cold start and while offline. When the app is opened offline or before the server responds, subscriptions SHALL be served from the local cache with the owner's last-known data rather than an empty result. The persistent cache SHALL be configured at Firestore initialization and SHALL coexist with the local emulator wiring used in development.

#### Scenario: Data available on a cold offline start

- **WHEN** the owner has previously loaded their spendings and categories, then opens the app (including the installed PWA) while offline
- **THEN** the client serves their last-known spendings and categories from the local cache instead of showing empty data

#### Scenario: Persistence does not change stored schema

- **WHEN** local persistence is enabled
- **THEN** the shape of documents stored in Firestore is unchanged, and no security-rule change is required

### Requirement: Offline writes are queued and synced on reconnect

Writes made while the client is offline SHALL be accepted and applied to the local cache immediately, queued durably, and synchronised to the server automatically when connectivity is restored, without the owner re-entering them. A queued write SHALL survive an app reload while offline.

#### Scenario: A category added offline syncs later

- **WHEN** the owner adds a category or keyword while offline
- **THEN** the change is reflected locally right away, persists across an offline reload, and is written to the server automatically once the client reconnects

#### Scenario: No lost writes across offline reload

- **WHEN** the owner makes a change offline and closes or reloads the app before reconnecting
- **THEN** the queued write is retained and is still synchronised to the server on the next reconnect
