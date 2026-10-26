import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildLicenseAssets,runtimePackages,approvedMurmurReadme} from '../scripts/lic02_license_assets.mjs';
import {verifyLicenseDistribution} from '../scripts/lic02_verify_dist.mjs';

const root=new URL('..',import.meta.url);
test('LIC-02: the locked runtime dependency inventory has licenses for all 28 packages',()=>{
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
 const deps=runtimePackages(lock);
 assert.equal(deps.length,28);
 assert.ok(deps.some(p=>p.name==='maplibre-gl' && p.version==='6.4.1' && p.license==='BSD-3-Clause'));
 assert.ok(deps.some(p=>p.name==='html2canvas' && p.version==='1.4.1' && p.license==='MIT'));
});

test('LIC-02: Pages and ordinary build both execute notice staging; UI exposes a link',()=>{
 const vite=readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const pages=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 const qa=readFileSync(new URL('../.github/workflows/qa.yml',import.meta.url),'utf8');
 assert.match(vite,/apply:'build'/);assert.match(vite,/generateBundle\(/);
 assert.match(html,/href="%BASE_URL%licenses\/index\.html"/);
 assert.match(pages,/npx vite build/);
 for(const workflow of [pages,qa]) assert.match(workflow,/node scripts\/lic02_verify_dist\.mjs/);
});

test('LIC-02: copies genuine installed license/notice files and verifies deployed output',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lic02-'));
 try{
  const put=(name,text)=>{const full=join(dir,name);mkdirSync(join(full,'..'),{recursive:true});writeFileSync(full,text);};
  put('package.json',JSON.stringify({version:'test-rc'}));
  put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{version:'test-rc'},'node_modules/html2canvas':{version:'1.4.1',license:'MIT'},'node_modules/@mapbox/tiny-sdf':{version:'2.3.0',license:'BSD-2-Clause'}}}));
  for(const [path,text] of [['LICENSE','Copyright original demo MIT license'],['THIRD_PARTY_NOTICES.md','Third party notices with attribution for all deps'],['licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt','Copyright (c) 2023, MapLibre contributors plus full BSD text'],['licenses/HTML2CANVAS_MIT.txt','Copyright (c) 2012 Niklas von Hertzen with full MIT text']])put(path,text.repeat(4));
  put('node_modules/html2canvas/package.json',JSON.stringify({name:'html2canvas',version:'1.4.1'}));
  put('node_modules/html2canvas/LICENSE','Copyright (c) 2012 Niklas von Hertzen - MIT '.repeat(4));
  put('node_modules/@mapbox/tiny-sdf/package.json',JSON.stringify({name:'@mapbox/tiny-sdf',version:'2.3.0'}));
  put('node_modules/@mapbox/tiny-sdf/LICENSE.txt','Copyright (c) author - BSD-2-Clause '.repeat(4));
  put('node_modules/@mapbox/tiny-sdf/NOTICE','Third party copyright notice '.repeat(4));
  const {assets,packageCount}=buildLicenseAssets(dir);
  assert.equal(packageCount,2);
  assert.equal(assets.filter(x=>x.fileName.startsWith('licenses/npm/')).length,3);
  const m=JSON.parse(assets.find(x=>x.fileName==='licenses/manifest.json').source);
  assert.equal(m.packages.length,2);
  assert.ok(assets.some(x=>x.fileName==='licenses/index.html'&&String(x.source).includes('html2canvas')));
  for(const a of assets)put('dist/'+a.fileName,a.source);
  put('dist/index.html','<footer><a aria-label="Licenses and third-party notices" href="/simulation-qa-lab/licenses/index.html">Legal</a></footer>');
  assert.deepEqual(verifyLicenseDistribution(dir),{packages:2,files:3,version:'test-rc'});
  put('dist/licenses/npm/html2canvas/LICENSE','CORRUPTED');
  assert.throws(()=>verifyLicenseDistribution(dir),/corrupt notice/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('LIC-02: refusing a missing upstream license prevents silent metadata-only distribution',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lic02-missing-'));
 try{
  const put=(name,text)=>{const full=join(dir,name);mkdirSync(join(full,'..'),{recursive:true});writeFileSync(full,text);};
  put('package.json',JSON.stringify({version:'test-rc'}));
  put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{version:'test-rc'},'node_modules/bad':{version:'1',license:'MIT'}}}));
  for(const p of ['LICENSE','THIRD_PARTY_NOTICES.md','licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt','licenses/HTML2CANVAS_MIT.txt'])put(p,'nonempty '.repeat(15));
  put('node_modules/bad/package.json',JSON.stringify({name:'bad',version:'1'}));
  assert.throws(()=>buildLicenseAssets(dir),/no distributable license text/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});


const murmurMitReadme = `# MurmurHash.js

## License (MIT)

Copyright (c) 2011 Gary Court

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

test('LIC-02: exact murmurhash-js 1.0.0 full MIT README is redistributed unmodified',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lic02-murmur-'));
 try{
  const put=(name,data)=>{const full=join(dir,name);mkdirSync(join(full,'..'),{recursive:true});writeFileSync(full,data);};
  put('package.json',JSON.stringify({version:'test-rc'}));
  put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{version:'test-rc'},'node_modules/murmurhash-js':{version:'1.0.0',license:'MIT'}}}));
  for(const p of ['LICENSE','THIRD_PARTY_NOTICES.md','licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt','licenses/HTML2CANVAS_MIT.txt']){
    const attribution=p.includes('MAPLIBRE_GL')?'Copyright (c) 2023, MapLibre contributors ':p.includes('HTML2CANVAS')?'Copyright (c) 2012 Niklas von Hertzen ':'Sample project notice ';
    put(p,(attribution+' legal conditions and disclaimer ').repeat(7));
  }
  put('node_modules/murmurhash-js/package.json',JSON.stringify({name:'murmurhash-js',version:'1.0.0'}));
  put('node_modules/murmurhash-js/README.md',murmurMitReadme);
  const {assets,packageCount}=buildLicenseAssets(dir);
  assert.equal(packageCount,1);
  const source=assets.find(a=>a.fileName==='licenses/npm/murmurhash-js/README.md');
  assert.ok(source,'upstream README preserved as a publicly available notice');
  assert.equal(source.source.toString('utf8'),murmurMitReadme);
  for(const a of assets)put('dist/'+a.fileName,a.source);
  put('dist/index.html','<footer><a aria-label="Licenses and third-party notices" href="/simulation-qa-lab/licenses/index.html">Legal</a></footer>');
  assert.deepEqual(verifyLicenseDistribution(dir),{packages:1,files:1,version:'test-rc'});
  assert.match(readFileSync(join(dir,'dist/licenses/index.html'),'utf8'),/murmurhash-js/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('LIC-02: a truncated or wrong-package README does not bypass strict license preflight',()=>{
 const valid={name:'murmurhash-js',version:'1.0.0',license:'MIT'};
 assert.equal(approvedMurmurReadme(valid,murmurMitReadme),true);
 assert.equal(approvedMurmurReadme(valid,murmurMitReadme.replace('THE SOFTWARE IS PROVIDED','THIS IS AN INCOMPLETE LICENSE')),false);
 assert.equal(approvedMurmurReadme({...valid,name:'different-package'},murmurMitReadme),false);
 assert.equal(approvedMurmurReadme({...valid,version:'2.0.0'},murmurMitReadme),false);
 assert.equal(approvedMurmurReadme({...valid,license:'Apache-2.0'},murmurMitReadme),false);
});
