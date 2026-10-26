# Contributing

Thanks for helping the DeepSeek Harness plugin ecosystem.

## Scope

This repository ships one bundle: an in-app notification chime for task
completion and approval requests. Good contributions include:

- more reliable detection across Harness Client versions;
- accessibility and settings-row polish;
- additional sound presets or a mute/volume preference;
- tests for edge cases (reconnects, resumed sessions, multiple windows).

Please keep the bundle dependency-free and avoid network access at runtime.

## Development

Requirements: Node 20 or newer. No `npm install` is needed.

```bash
npm run check
npm test
```

If you change `client.js`, add or update a case in `test/client.test.mjs` that
drives the detector with a status snapshot.

## Pull requests

1. Keep the change focused and explain the user-visible behavior.
2. Run `npm run check` and `npm test`.
3. Update `README.md` / `README.en.md` when behavior or installation changes.
4. Add an entry under `Unreleased` in `CHANGELOG.md`.
5. If you rename the package, update all four places: `package.json`, the module
   id at the top of `client.js`, `cordis.patch.yml`, and `test/manifest.test.mjs`.

## Compatibility

Harness Client services used here are internal and may move between major
versions. When adapting to a new Harness release, describe the version you
tested in the pull request.

## License

By contributing, you agree that your contribution is licensed under the MIT
License in this repository.
