# QA architecture

```text
Six deterministic fictional JSON fixtures
  |-- Python QA rules and fixture verification -> source-based PASS/FAIL
  |-- Browser replay and inspector -> visual context, not the oracle
  `-- Manual issue export -> JSON + XLSX + two PNG images + text files
```

The fixture pairs preserve original movement telemetry. In the checkpoint and event-order cases, the injected defect changes the event log, not the physical path.

| Rule | Reference | Injected fault |
|---|---|---|
| Movement | Valid timestamps and position changes within a fictional 90 km/h maximum | `POSITION_JUMP` at T+01:05 |
| Checkpoint | `CHECKPOINT_ENTER` within one second after entry | Entry at T+00:58 without the required event |
| Event order | `OBJECTIVE_STARTED` strictly before `OBJECTIVE_COMPLETED` | Completion at T+00:35, start at T+00:45 |

The display does not smooth a flagged movement transition. The online basemap is context only and may rely on an external provider. Only original position records and event logs serve as source evidence.

## Issue bundle

Each export ZIP contains seven files with a shared timestamp: `*_summary.txt`, `*_description.txt`, `*_raw_telemetry.xlsx`, `*_raw_evidence.json`, `*_map_evidence.png`, `*_ui_context.png` and `*_HOW_TO_FILE.txt` (exact scenario prefix varies). The two PNGs are secondary annotated communication artifacts; the JSON and workbook retain the original records. Save As behavior depends on browser capabilities. No issue is posted automatically.

## Validation limits

The package is neither a signed chain of custody nor evidence of an external simulator defect. Python validates deterministic inputs; JavaScript tests cover replay, evidence export and UI contracts. Human Chrome acceptance covered specific UI cases, not every browser and environment.
