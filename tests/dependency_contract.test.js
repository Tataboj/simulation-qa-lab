import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const appSource = readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
test('MapLibre pin is patched for GHSA-jrc7-96c5-q579', () => {
  assert.equal(packageJson.dependencies['maplibre-gl'], '6.4.1');
});
test('MapLibre v6 uses namespace import and explicit bundled Vite worker', () => {
  assert.match(appSource, /import \* as maplibregl from 'maplibre-gl'/);
  assert.match(appSource, /maplibre-gl-worker\.mjs\?worker&url/);
  assert.match(appSource, /maplibregl\.setWorkerUrl\(maplibreWorkerUrl\)/);
  assert.doesNotMatch(appSource, /import maplibregl from 'maplibre-gl'/);
});

test('production build uses vite build rather than the dev server', () => {
  assert.equal(packageJson.scripts.build, 'vite build');
});

test('release manifest, UI footer, and issue report version stay synchronized', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const issueSource = readFileSync(new URL('../app/issue_report.js', import.meta.url), 'utf8');
  const version = packageJson.version;
  assert.ok(html.includes(`v${version} <i>•</i> SYNTHETIC DATA`), 'UI footer must match package version');
  assert.ok(issueSource.includes(`APP_VERSION='${version}'`), 'exported QA issue metadata must match package version');
});
