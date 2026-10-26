# Simulation QA Lab

A browser-based QA exercise for deterministic simulation telemetry and event logs. Compare a clean reference run with an injected defect, inspect the source records, and export a developer-ready issue package.

**Version:** `1.0.0-rc.1` (release candidate; not an official `v1.0.0` release). Maintained under [Tataboj](https://github.com/Tataboj).

**Live demo:** [Open Simulation QA Lab](https://tataboj.github.io/simulation-qa-lab/) (public GitHub Pages deployment).

## Try it

**Windows:** extract the project and double-click `START_WINDOWS.cmd`. The launcher installs the locked dependencies and prints a localhost address. Keep the terminal open while using the app.

**Terminal (Node.js 22+):** from the project directory:

```sh
npm ci
npm run dev
```

The interface runs in a modern browser. Python 3.12+ is needed only for the separate QA test suite.

## QA walkthrough

1. Select a **Test Domain** and open the **Reference run**. The expected result is **PASS**, with no findings.
2. Switch to **Injected fault**. The expected result is **FAIL**, with one actionable finding.
3. Inspect the original samples or event log alongside the replay and export the issue evidence.

| Domain | Injected fault | Authoritative evidence |
|---|---|---|
| Movement (`ECHO-01`) | `POSITION_JUMP` at T+01:05 | Original position/timestamp samples; fictional 90 km/h rule |
| Checkpoint (`ECHO-CP01`) | `CHECKPOINT_EVENT_MISSING` at T+00:58 | Checkpoint entry versus recorded `CHECKPOINT_ENTER` event |
| Event ordering (`ECHO-EV01`) | `EVENT_ORDER_VIOLATION` at T+00:35 | Completion at 35 s, start at 45 s in the original event log |

The animation is an explanation, **not the QA oracle**. Validation is based on raw synthetic records. An injected-fixture **FAIL** is the correct expected test outcome.

## Issue evidence

An issue package contains seven files: a summary, a detailed description, original evidence in JSON, an XLSX workbook, map evidence PNG, full-interface context PNG, and filing instructions. Export images provide context; they are not substitutes for the original telemetry or event log. Reports are prepared for manual filing, not sent to Jira or another service.

## Test and build

From the repository root:

```sh
python -m unittest discover -s tests -p 'test*.py' -v
node --test tests/*.test.js
python scripts/VP08_VERIFY_SCENARIOS.py
npm ci
npm audit
npm run build
```

As of 2026-10-26, acceptance evidence includes 16 Python tests, 110 JavaScript tests, all six deterministic scenario fixtures, a clean Windows `npm ci` installation, and a successful `npm run build:pages` production build. GitHub QA workflow #4 passed for commit `d5aa2bf`; the manually triggered Pages deployment #2 for that commit also passed. A real Chrome/Windows ECHO-01 `POSITION_JUMP` issue export produced a readable seven-file ZIP; 242 Excel telemetry records matched the JSON source records. This observed browser acceptance covers that movement-fault export, not an exhaustive cross-browser or all-scenarios matrix. The included lockfile has SHA-256 `50CE46B21D9B62ECE126E4F5A397DFA229E7A21BB907481B908C785D5AFE24FA`.

**GitHub Pages:** the public demo is available at [tataboj.github.io/simulation-qa-lab](https://tataboj.github.io/simulation-qa-lab/). Locally, `npm run build:pages` builds the `/simulation-qa-lab/` base path. The Pages workflow remains **manual-only**; any new deployment requires owner approval.

## Scope and dependencies

All units, routes, events and faults are fictional. The online map uses real geographic labels from OpenFreeMap/OpenStreetMap; it is not a live feed. The alternate schematic background is local artwork. Initial dependency installation requires network access, and online maps / Google Fonts make third-party requests.

This is an independent, privately developed software-testing demo. It does not connect to a live system or represent any organization. See [architecture](docs/QA_ARCHITECTURE.md), [QA scope](docs/QA_SCOPE.md), [issue handoff](docs/ISSUE_TRACKER_HANDOFF.md), and [third-party provenance](docs/THIRD_PARTY_PROVENANCE.md).

**License:** [MIT](LICENSE) for original project code and assets, subject to the rights held by the copyright holder. See [third-party notices](THIRD_PARTY_NOTICES.md) for external software, maps and fonts.

The public repository and GitHub Pages demo are live. The ECHO-01 issue-evidence export was accepted on 2026-10-26. Publishing a `v1.0.0` tag or GitHub Release, or changing the app version from `1.0.0-rc.1` to `1.0.0`, requires separate explicit owner approval.
