import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const restricted = ['one'+'arc', 'vbs'+'4', 'candidate'+' engineering'];
const extensions = /\.(md|html|json|js|css|py)$/i;
const skipped = new Set(['node_modules', 'dist', '__pycache__', '.git']);
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    if (skipped.has(name)) return [];
    const f = join(dir,name);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}
test('public source and filenames contain no target-specific labels', () => {
  for (const file of walk(root)) {
    const path = relative(root,file).toLowerCase();
    for (const label of restricted) assert.ok(!path.includes(label), `${path}: prohibited filename label`);
    if (extensions.test(file)) {
      const contents=readFileSync(file,'utf8').toLowerCase();
      for (const label of restricted) assert.ok(!contents.includes(label), `${path}: prohibited public label`);
    }
  }
});
