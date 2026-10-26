# Issue-tracker handoff

Simulation QA Lab prepares reproducible defect evidence for manual entry into an issue tracker. It does not connect to Jira or submit tickets automatically.

## Reproduction

Select one of the three QA domains, compare **Reference run** (PASS, no finding) with **Injected fault** (FAIL, one finding), and choose the inspection action. The generated report identifies the scenario, affected entity, source timestamp, validation rule, expected result and observed result. Priority and ownership remain with the receiving team.

| Scenario | Injected finding | Source detail |
|---|---|---|
| `ECHO-01` | `POSITION_JUMP` | ECHO-BRAVO movement transition at T+01:05 |
| `ECHO-CP01` | `CHECKPOINT_EVENT_MISSING` | Missing `CHECKPOINT_ENTER` for CP-ALPHA at T+00:58 |
| `ECHO-EV01` | `EVENT_ORDER_VIOLATION` | ECHO-ALPHA completed at 35 s, started at 45 s |

## Evidence package

The exported ZIP contains seven timestamp-matched files: summary TXT, description TXT, original telemetry XLSX, raw evidence JSON, map evidence PNG, UI context PNG and HOW_TO_FILE TXT. The map PNG captures the relevant geographic context and annotation. The UI context PNG records the application panels and timeline. Neither screenshot overrides the original structured records.

Where supported, Chrome offers Save As; other browsers may use an ordinary download. Users manually attach the files and copy the proposed issue text into their own tracker.

## Acceptance

Automated tests exercise the finding text, original evidence preservation, export formats and cancellation behavior. Windows browser testing previously confirmed a seven-file Event Ordering package and both PNGs. This does not imply a ticket was submitted to an external service.
