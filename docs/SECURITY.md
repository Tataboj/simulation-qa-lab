# Dependency security note

Security advisory: [GHSA-jrc7-96c5-q579](https://github.com/advisories/GHSA-jrc7-96c5-q579), an XSS sanitizer issue affecting `maplibre-gl` through version 6.4.0. The demo pins `maplibre-gl` to version `6.4.1`, with namespace import and explicit bundled Vite worker required for the v6 migration.

During local Windows verification on 2026-10-22 with version 6.4.1, `npm audit` and `npm audit --omit=dev` reported **0 known vulnerabilities**. This observation describes that specific install, not a permanent guarantee or evidence of a security penetration test.

Recommended checks on every installation:

```powershell
npm ci
npm ls maplibre-gl
npm audit
npm audit --omit=dev
npm run build
```

Avoid `npm audit fix --force` without first reviewing proposed breaking version changes. The generated simulation assets and telemetry are local; npm ci and optional Google Fonts require external connectivity.
