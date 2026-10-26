import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('geographic WebGL resize cannot expose old fictional terrain from CSS in either theme',()=>{
  const dark=read('app/style.css'), day=read('app/daylight.css');
  const darkBackground=dark.match(/\.map-pane #map\{[^}]*\}/)?.[0];
  const dayBackground=day.match(/html\[data-theme="daylight"\] \.map-pane #map\s*\{[^}]*\}/)?.[0];
  assert.ok(darkBackground, 'map container dark CSS must exist');
  assert.ok(dayBackground, 'map container daylight CSS must exist');
  assert.doesNotMatch(darkBackground,/url\(|background-image\s*:/i);
  assert.doesNotMatch(dayBackground,/url\(|background-image\s*:/i);
  assert.match(darkBackground,/background\s*:\s*#[a-f0-9]+/i);
  assert.match(dayBackground,/background\s*:\s*#[a-f0-9]+/i);
});
test('fictional terrain assets and explicit MapLibre raster fallback remain functional in source',()=>{
  const main=read('app/main.js');
  assert.match(main,/const ONLINE_STYLE = 'https:\/\/tiles\.openfreemap\.org\/styles\/liberty'/);
  for(const file of ['public/terrain.png','public/terrain-daylight.png'])assert.ok(existsSync(new URL('../'+file,import.meta.url)));
  for(const name of ['terrain-night','terrain-day','terrain-night-raster','terrain-day-raster'])assert.ok(main.includes(name),name);
  assert.match(main,/map\.setStyle\(mapMode==='geographic'\?ONLINE_STYLE:SYNTHETIC_STYLE\)/);
  assert.match(main,/initLayout\(\{resizeMap:\(\)=>map\?\.resize\(\)\}\)/);
});
