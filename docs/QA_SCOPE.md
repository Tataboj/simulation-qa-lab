# QA scope

Simulation QA Lab uses a controlled, fictional dataset to show how a QA finding is reproduced and handed to development.

**In scope:** deterministic position and event fixtures; reference/fault pairs for three domains; independent Python validation and JavaScript regression tests; PASS/FAIL inspection; raw JSON/XLSX evidence; annotated map and UI screenshots; day/night and online/schematic map views; manual issue handoff.

**Out of scope:** real operations, operational data feeds, external simulator integrations, ML anomaly scoring, physical vehicle performance claims, 3D simulation and automated ticket submission. The replay is illustrative; source data and QA rules determine the result.

Scenario details and accepted thresholds are in [QA architecture](QA_ARCHITECTURE.md). Archived version-specific acceptance records remain in the private development archive rather than this public source repository. As of 2026-10-26, GitHub CI #7 and manual GitHub Pages deployment #4 succeeded for commit `9344071`. Automated CI/deployment evidence and human browser acceptance are distinct: the seven-file ECHO-01 movement-incident export was checked in Chrome/Windows, but exhaustive cross-browser and current-build manual acceptance of all three domains is not claimed.

## Targeted Windows/browser acceptance (2026-10-27)

The RG-03 acceptance campaign inspected all three domain reference/fault pairs in Chrome with the local Windows launcher. Movement, Checkpoint and Event Ordering each displayed the expected PASS/FAIL result; the fault ZIP exports were verified to include seven readable files with original matching JSON/XLSX telemetry and both screenshots. This is specific acceptance of the observed workflows, not a claim about all browsers, network environments, or future version-specific deployments. An official release must be validated against its own commit and build.
