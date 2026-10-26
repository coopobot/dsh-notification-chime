# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## Unreleased

## 1.0.0 - 2026-10-26

### Added

- In-app completion chime for normal Session turns ending with `completed`,
  `error`, or `max-tokens`.
- In-app attention chime for pending `approval` and `plan-review` interactions.
- Settings row under Settings → General with a test button, audio state, and the
  last real trigger time.
- Silence for subagent turns, user aborts, and duplicate triggers.
- Web Audio tone synthesis with no audio assets, network calls, or child
  processes.
- Manifest, Host-half, and Client detection tests; GitHub Actions CI for Node 20
  and 22.
