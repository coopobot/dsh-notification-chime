<p align="center">
  <img src="icon.svg" width="96" height="96" alt="Notification Chime icon">
</p>

<h1 align="center">Notification Chime</h1>

<p align="center">
  An in-app notification chime for <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>: one sound when a task finishes, another when a human approval is needed.
</p>

<p align="center">
  English · <a href="README.md">简体中文</a>
</p>

---

## Why

Harness tasks can run for a long time. When you switch to another window, it is easy to miss that:

- a reply has finished, or
- the agent is waiting for you to approve a tool call.

Notification Chime plays a short, distinct sound inside the app and adds a settings row where you can test it at any time.

## Features

| Capability | Behavior |
| --- | --- |
| Completion | Plays the completion phrase when a normal Session's `turn/end` is `completed`, `error`, or `max-tokens` |
| Approval | Plays the attention phrase when an `approval` or `plan-review` interaction appears |
| In-app audio | The Harness page (Electron renderer) plays the sound, so the OS volume mixer lists DeepSeek Harness instead of `powershell.exe` |
| Quiet by default | Subagent completions and user aborts (`aborted` / `interrupted` / `forked`) stay silent |
| Coalescing | Multiple completions within 600 ms, or approvals within 900 ms, produce one sound |
| Testable | Settings → General → Notification chime: Test button, audio status, last trigger |
| No network or assets | Tones are synthesized with Web Audio; nothing is downloaded or uploaded |

## Requirements

- DeepSeek Harness Desktop, or a Web GUI that supports Client plugins.
- Developed and verified against Harness `0.2.1-rc.2`.
- No runtime dependencies.

## Install

This repository is itself a DSH bundle package.

1. Clone it:

   ```bash
   git clone https://github.com/<your-name>/notification-chime.git
   ```

2. Install the local bundle from DSH:
   - use **Plugin Manager → install a local bundle** and point it at the checkout, or
   - ask the agent to call `plugin_manager` `install_bundle` with the absolute checkout path.

3. No restart is required. If the settings row does not appear immediately, refresh the page once.

> The package name `@local/notification-chime` is a local-link placeholder, not a publishable npm scope. See [Publishing](#publishing) before publishing.

## Usage

Open **Settings → General → Notification chime**:

- Press **Test** to play the completion phrase. The first press also unlocks the browser audio context.
- The status line shows whether audio is ready and the time of the last real trigger.
- Automatic chimes continue even when Settings is closed.

### Trigger rules

| Event | Sound |
| --- | --- |
| Normal Session completed | ✅ completion phrase |
| Normal Session errored or hit max tokens | ✅ completion phrase |
| Pending `approval` / `plan-review` | ✅ attention phrase |
| Subagent completed | ❌ |
| User aborted / interrupted / forked | ❌ |
| A standing approval that is already visible | ❌ no repeat |

## How it works

The bundle contains a Client half and an inert Host row:

1. Subscribe to the page's `uiSession.sessionStatus` (per-Session `running`, `pendingInteraction`, `completionUnread`) and `sessions.list` (to recognize subagents).
2. Diff consecutive snapshots: `running: true → false` or a new `completionUnread` means completion; a newly appearing approval-kind `pendingInteraction` means human input is required.
3. Synthesize the chime with Web Audio; unlock the audio context on the first user gesture.
4. Publish the last trigger and audio state to the settings row.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Sound design

| Scene | Notes | Character |
| --- | --- | --- |
| Task complete | C5 → E5 → B5 with a quiet C6 shimmer | Soft rising "done" |
| Approval needed | C6 → G5 → C6 | Shorter, higher triple pulse |

Every tone is a sine/triangle oscillator with an attack/decay envelope; no audio files are involved.

## Troubleshooting

**Test does not produce sound**

- Check the OS volume mixer: it should list **DeepSeek Harness** (or the browser if the GUI runs in a browser) with a level meter while the Test button plays.
- If the meter moves but you hear nothing, inspect the default output device and volume. On a remote desktop, check "Remote audio → Play on this computer".
- Press Test once to unlock Chromium's audio context; automatic chimes become reliable afterwards.

**The settings row is missing**

- Confirm the bundle is enabled in Plugin Manager.
- Refresh the page and search for "chime" in Settings → General.
- Check Harness logs for a Client plugin load failure.

**A finished task does not chime**

- Confirm the turn was not aborted.
- Subagent turns are intentionally silent.
- Open the settings row: if "last trigger" updates but you hear nothing, follow the audio-output steps above.

## Development

No dependencies are required; tests use the Node built-in test runner.

```bash
npm run check   # syntax-check both entry files
npm test        # manifest, Host half, Client detection logic
```

The tests cover:

- bundle manifest, patch, locales, icon, and Client module id consistency;
- the inert Host half;
- completion / approval / subagent / duplicate-approval detection and tone counts.

CI runs on Node 20 and 22 in [.github/workflows/ci.yml](.github/workflows/ci.yml).

Style: 2-space indentation, UTF-8, no new runtime dependencies. Add tests with every behavior change.

## Publishing

### GitHub

```bash
git init
git add .
git commit -m "feat: initial notification-chime plugin"
git branch -M main
git remote add origin https://github.com/<your-name>/notification-chime.git
git push -u origin main
```

Suggested repository name: `notification-chime` or `dsh-notification-chime`.

### npm

`@local/notification-chime` is not publishable. Before publishing:

1. Change `name` in `package.json` to a scope you own, for example `@your-scope/dsh-notification-chime`.
2. Update `name` in `cordis.patch.yml`.
3. Update the module `id` at the top of `client.js` so it exactly matches the package name.
4. Remove `"private": true`.
5. Update the fixed row id in `test/manifest.test.mjs` if you renamed it.
6. Run `npm publish --access public`.

## Compatibility and limitations

- The plugin relies on Harness Client internals: the `uiSession` and `sessions` services and the `settings.general.item` slot. They are not yet a frozen cross-major contract; re-check them after a Harness upgrade.
- Audio follows the system default output device. Remote desktop or virtual audio devices determine whether you can hear it.
- The plugin does not modify the Host process, spawn processes, or use the network.

## License

[MIT](LICENSE)
