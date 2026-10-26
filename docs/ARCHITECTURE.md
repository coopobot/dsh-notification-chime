# Architecture

## Goals

- Tell a person when a long-running Harness task ends, and separately when the agent is waiting for an approval.
- Attribute the sound to the Harness application in the operating system's volume mixer.
- Stay quiet for work the user did not start directly (subagent runs, user aborts) and for repeated status updates.
- Keep the bundle self-contained: no dependencies, no network, no audio assets.

## Bundle layout

| File | Role |
| --- | --- |
| `package.json` | Bundle manifest. `dsh.bundle.patch` inserts the Host row; `dsh.client` declares the web Client half |
| `cordis.patch.yml` | Inserts one Host row (`notification-chime`) |
| `index.js` | Host half. Deliberately inert: the bundle row exists so the Client module can load |
| `client.js` | Client half. Registers the detector, the audio engine, and the settings row |
| `locale/en.json`, `locale/zh.json` | Plugin Manager metadata (`meta.title`, `meta.description`) |
| `icon.svg` | Plugin Manager artwork |
| `test/` | Node built-in test runner suites |

## Why the sound is produced in the Client

An earlier revision played the WAV from the Host by spawning `powershell.exe`.
That worked, but the operating system attributed the audio session to
PowerShell, so per-app volume control was wrong and the sound did not appear
under DeepSeek in the mixer.

The current implementation synthesizes tones with Web Audio in the Harness
page. The renderer belongs to the Harness application, so the mixer groups the
audio under the app (or under the browser when the GUI runs in a browser). It
also removes the child process, the WAV assets, and the platform-specific player
commands.

## Detection

The plugin injects four Client services:

```js
inject: ['sessions', 'uiSession', 'slots', 'locale']
```

`uiSession.sessionStatus` is an observable `Map<SessionId, SessionStatus>`:

```ts
interface SessionStatus {
  running: boolean | undefined
  pendingInteraction: { kind: 'approval' | 'plan-review' | 'question' | string } | undefined
  completionUnread: boolean
}
```

`sessions.list` is an observable `SessionListSnapshot`; only `byId[id].origin`
is used, to recognize `origin === 'subagent'`.

### State machine

The detector keeps the previous status map and diffs it on every publication:

1. **Baseline** — the first snapshot is stored and never chimes. This prevents a
   page load from replaying old completions.
2. **Approval** — an approval-kind `pendingInteraction` that was absent in the
   previous snapshot and is present now. `question` is deliberately excluded;
   only approvals need the attention phrase.
3. **Completion** — for a Session that is present in the session catalog and is
   not a subagent:
   - `previous.running === true && current.running !== true`, or
   - `previous.completionUnread === false && current.completionUnread === true`
     (the background completion reminder).
4. A Session with a standing approval contributes no completion sound; it has
   not fully finished.

Approvals win over completions when both appear in one update. The audio engine
additionally rate-limits completion to 600 ms and approval to 900 ms.

### Why both `running` and `completionUnread`

The live status transition is the primary signal. `completionUnread` is a
fallback for cases where a Session's running state was not observed before it
ended (for example a list baseline that arrives late). Both conditions map to
one boolean, so a normal completion still plays once.

## Audio engine

`createChime(store)` owns one `AudioContext` per page:

- The context is created lazily by `ensure()`. `apply()` calls it once so the
  audio session exists early.
- `pointerdown`, `keydown`, and `touchstart` listeners call `ensure()` in the
  capture phase. Chromium builds that require a user gesture for audio start
  working after the first interaction; the Test button also calls `ensure()`.
- `complete()` and `attention()` schedule oscillator/GainNode pairs with a fixed
  frequency table. No buffer decoding or asset fetch is involved.
- The `statechange` event publishes `ready` / `locked` to the settings row.

The tone tables live in `client.js`:

```js
const COMPLETE_NOTES = [/* C5, E5, B5, C6 shimmer */]
const APPROVAL_NOTES = [/* C6, G5, C6 */]
```

## Settings row

The plugin registers a root-scoped row in `settings.general.item` with the id
`notification-chime` and order `21`. The row draws its own layout because the
slot owner projects no props.

A tiny observable store carries three fields to the row:

- `lastKind`: `complete`, `approval`, or `undefined`
- `lastAt`: epoch milliseconds of the last real trigger
- `audio`: `idle`, `ready`, `locked`, or `unavailable`

The row subscribes with `useState` + `useEffect` and unsubscribes on unmount.
Clicking Test only plays a sound; it does not overwrite `lastKind`, so the row
keeps reporting real events.

## Lifecycle and teardown

- Each `ctx.effect()` owns a registration: the unlock listeners, the two status
  subscriptions, and the locale dictionaries.
- `ctx.slots.inject(...)` is declaration-aware: the row is installed when
  `settings.general.item` exists and removed when it collapses.
- Disposing the Client run closes nothing automatically for the AudioContext;
  the context is page-lifetime state. The plugin is normally active for the
  whole page, and disposing it removes all listeners that could produce sound.

## Compatibility risks

The following are Harness Client internals rather than a frozen public plugin
API:

| Contract | Use |
| --- | --- |
| `uiSession.sessionStatus` | Per-Session running / pending / completion state |
| `sessions.list` | Session catalog and `origin` |
| `settings.general.item` | Settings row seat |

The bundle is verified against Harness `0.2.1-rc.2`. After a Harness upgrade:

1. Load the page and confirm the settings row still renders.
2. Finish a task and check the "last trigger" line.
3. Request an approval and check the attention phrase.

If a contract moved, the detector or row registration must be updated; the
audio engine and manifest do not depend on these internals.

## Testing strategy

The tests are dependency-free and run in a VM:

- `test/manifest.test.mjs` checks bundle metadata consistency (patch, locales,
  icon, module id).
- `test/client.test.mjs` loads the real `client.js` with fake React, AudioContext,
  observables, and slot registry, then drives status snapshots and asserts tone
  counts, frequencies, and silence rules.
- `test/host.test.mjs` keeps the Host half inert.

The tests intentionally do not try to render the settings row; the row is a thin
projection over the store and is verified by the live slot registration during
development.
