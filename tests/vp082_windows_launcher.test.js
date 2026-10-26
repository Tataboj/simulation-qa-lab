import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const text = (name) => readFileSync(resolve(root, name), 'utf8');
test('RC1 Windows launcher starts npm from its own directory', () => {
 const cmd=text('START_WINDOWS.cmd');
 assert.match(cmd,/cd \/d "%~dp0"/);
 assert.match(cmd,/call npm run dev/);
 assert.match(cmd,/call npm ci/);
 assert.match(cmd,/if not exist "package-lock\.json"/);
 assert.doesNotMatch(cmd,/call npm install/);
});
