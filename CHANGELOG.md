# Changelog

## 1.0.0 — Released (2026-10-27)

- Stable release of the independent fictional simulation QA demo; [official v1.0.0 tag and release](https://github.com/Tataboj/simulation-qa-lab/releases/tag/v1.0.0) published on 2026-10-27.
- Three deterministic QA domains: Movement, Checkpoint triggers, and Event ordering, each with reference PASS and injected-fault FAIL.
- Developer-ready seven-file ZIP handoff including original JSON/XLSX evidence and two annotated PNG screenshots.
- Targeted Chrome/Windows acceptance of all three domains and evidence exports completed on 2026-10-27 (RG-03); not an exhaustive cross-browser matrix.
- LIC-01 map evidence attribution, LIC-02 full distributed runtime license notices, LIC-03 private owner rights attestation.
- Node/npm Windows launcher accepted 2026-10-27 (RG-02). Synthetically generated fixtures and QA logic unchanged by version promotion.
- Verified release commit `2a61aa71362f0f2d051addc79aa4681914caf5d2`: [CI #9](https://github.com/Tataboj/simulation-qa-lab/actions/runs/40468249528), [CI #10](https://github.com/Tataboj/simulation-qa-lab/actions/runs/40472397526), and owner-approved [Pages #5](https://github.com/Tataboj/simulation-qa-lab/actions/runs/40468602865) succeeded. The published v1.0.0 tag is preserved unchanged.

## 1.0.0-rc.1 — Release candidate (2026-10-25)

- Prepared audience-focused English README and streamlined public documentation.
- Made bundled data and schematic background URLs respect Vite's deployment base path.
- Added a simple Windows launcher (Node/npm required).
- Kept the three existing deterministic QA domains and source data unchanged.
- Original development baseline is the separate, preserved v0.8.4 source archive.

### Verified publication and post-candidate fixes (2026-10-26; still 1.0.0-rc.1)

- Published the public GitHub Pages demo. GitHub QA workflow #7 and the owner-triggered Pages deployment #4 passed for commit `9344071` (recorded verification, not a claim about later runs).
- Fixed the seven-file issue evidence ZIP export and verified the ECHO-01 `POSITION_JUMP` archive in Chrome/Windows. Full manual acceptance of every domain/browser is not claimed.
- LIC-01: restored complete OpenFreeMap / OpenMapTiles / OpenStreetMap ODbL attribution in exported geographic map PNGs; verified the resulting PNG visually.
- LIC-02: included project/third-party notices and original runtime dependency license files in the deployable Pages build; verified 28/28 runtime notices and the public license index.
- LIC-03: owner attested rights to original project materials; upstream components retain separate licenses.
- Kept the release candidate at `1.0.0-rc.1`. At that historical stage, the `v1.0.0` tag and GitHub Release had not yet been authorized.
