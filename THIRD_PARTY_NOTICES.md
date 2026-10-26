# Third-party notices

Simulation QA Lab's `LICENSE` covers original project materials only. Bundled packages, remote map services and fonts have separate terms.

## Bundled runtime dependencies

- **MapLibre GL JS 6.4.1** — BSD-3-Clause. The complete upstream v6.4.1 `LICENSE.txt`, including notices for embedded Mapbox GL JS, glfx.js and d3-color code, is reproduced in [`licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt`](licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt). [Version-specific upstream license](https://github.com/maplibre/maplibre-gl-js/blob/v6.4.1/LICENSE.txt).
- **html2canvas 1.4.1** — MIT. License text and copyright included in [`licenses/HTML2CANVAS_MIT.txt`](licenses/HTML2CANVAS_MIT.txt). [Upstream](https://github.com/niklasvh/html2canvas/blob/v1.4.1/LICENSE).
- **Other runtime dependencies** — individual licenses are not overridden by this project. Their resolved versions are in `package-lock.json`. If shipping a compiled bundle, retain any required embedded-code notices and copyright statements from the installed dependency packages.

## Build tooling

- **Vite 7.3.7** — MIT; development dependency, not distributed as a source package inside this archive. Build outputs include code from its dependencies; ensure the corresponding notices are retained where required. [Upstream](https://github.com/vitejs/vite).

## Network-hosted services

- **OpenFreeMap Liberty** — hosted map style and tiles; no copy of the service's map tiles ships in the repository. Attribution and service conditions: https://openfreemap.org/tos/
- **OpenStreetMap contributors** — underlying map data and attribution requirements: https://www.openstreetmap.org/copyright
- **OpenMapTiles** — retain attribution displayed by the map style: https://openmaptiles.org/
- **Google Fonts** — DM Sans and IBM Plex Mono are requested remotely; font files are not bundled here. Individual font license conditions remain applicable.

Do not remove map attributions from the browser experience or exported map evidence. The simulated entities, telemetry and rule failures are fictional; the online basemap uses real geography.
