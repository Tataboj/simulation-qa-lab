/** LIC-02 — reproducible, fail-closed redistribution of installed runtime licences.
 * Build only. This does not contact a remote service or modify source files.
 */
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const LICENSE_FILE=/^(?:LICEN[CS]E|COPYING|COPYRIGHT|NOTICE)(?:[-._].*)?$/i;
const SAFE_NAME=/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;
const sha256=x=>createHash('sha256').update(x).digest('hex');
const htmlEscape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pathEscape=x=>x.split('/').map(encodeURIComponent).join('/');

function fileBytes(path){const value=readFileSync(path);if(!value.length)throw new Error(`LIC02: empty license source ${path}`);return value;}

/** The exact npm release murmurhash-js@1.0.0 distributes the complete MIT
 * license in README.md, not a separate LICENSE file. This narrowly scoped
 * fallback preserves that upstream README verbatim. Other packages still fail
 * closed without a standalone license; mere lockfile metadata is insufficient.
 */
export function approvedMurmurReadme(pkg,source){
  if(pkg.name!=='murmurhash-js'||pkg.version!=='1.0.0'||pkg.license!=='MIT')return false;
  const raw=String(source);
  const text=raw.replace(/\s+/g,' ');
  return /^\s*#{1,6}\s*License\s*\(MIT\)\s*$/im.test(raw)
    && /Copyright\s*\(c\)\s*2011\s+Gary Court/i.test(text)
    && /Permission is hereby granted, free of charge/i.test(text)
    && /The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software/i.test(text)
    && /THE SOFTWARE IS PROVIDED ["“]AS IS["”]/i.test(text)
    && /IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE/i.test(text);
}


export function runtimePackages(lock){
  if(lock.lockfileVersion!==3||!lock.packages||!lock.packages[''])throw new Error('LIC02: invalid package-lock.json');
  return Object.entries(lock.packages)
    .filter(([path,meta])=>path.startsWith('node_modules/')&&!meta.dev)
    .map(([path,meta])=>{
      const name=path.slice('node_modules/'.length);
      if(!SAFE_NAME.test(name)||!meta.version||!meta.license)throw new Error(`LIC02: unknown package identity/license: ${name}`);
      return {name,version:meta.version,license:meta.license};
    }).sort((a,b)=>a.name.localeCompare(b.name,'en'));
}

function licenseIndexHtml(version,rows){
  const trs=rows.map(pkg=>{
    const links=pkg.files.map(file=>`<a href="${pathEscape(file.replace(/^licenses\//,''))}">${htmlEscape(file.split('/').at(-1))}</a>`).join(' · ');
    return `<tr><th scope="row">${htmlEscape(pkg.name)}</th><td>${htmlEscape(pkg.version)}</td><td>${htmlEscape(pkg.license)}</td><td>${links}</td></tr>`;
  }).join('\n');
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Licenses and third-party notices — Simulation QA Lab</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#183340;background:#f6f9fa;max-width:1050px;margin:2rem auto;padding:0 1.25rem}a{color:#076480}a:focus-visible{outline:3px solid #1d8b9e}table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #cbd7dc;padding:.6rem}thead{background:#e2eef1}@media(max-width:650px){table{display:block;overflow-x:auto}}code{overflow-wrap:anywhere}</style></head><body><p><a href="../">← Simulation QA Lab</a></p><h1>Licenses and third-party notices</h1><p>Public release-candidate <code>${htmlEscape(version)}</code>. This application combines original code and independently licensed libraries. The project MIT license does <strong>not</strong> replace any upstream license.</p><p><a href="../LICENSE">Original project: MIT license</a> · <a href="../THIRD_PARTY_NOTICES.md">Third-party notices and map/font/service credits</a></p><h2>Principal bundled libraries</h2><p><a href="MAPLIBRE_GL_JS_6.4.1_LICENSE.txt">MapLibre GL JS v6.4.1 (including embedded upstream notices)</a> · <a href="HTML2CANVAS_MIT.txt">html2canvas v1.4.1 MIT</a></p><h2>Runtime dependency license texts</h2><p>The table includes every package marked as a runtime dependency by the committed <code>package-lock.json</code> (conservative inclusion; some packages may not be incorporated into the minified bundle). License texts and notices are copied verbatim from the corresponding installed packages during the build. Exact-file SHA-256 digests and the list of files are in <a href="manifest.json">manifest.json</a>.</p><table><thead><tr><th scope="col">Package</th><th scope="col">Version</th><th scope="col">License metadata</th><th scope="col">Redistributed license/notice files</th></tr></thead><tbody>${trs}</tbody></table><h2>Hosted map and fonts</h2><p>Basemap: <a href="https://openfreemap.org/tos/">OpenFreeMap</a>, <a href="https://openmaptiles.org/">OpenMapTiles</a> and <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors / ODbL</a>. Google Fonts DM Sans and IBM Plex Mono are requested remotely; no font binaries are shipped by this project.</p><p>For project source and the complete documentation, see <a href="https://github.com/Tataboj/simulation-qa-lab">GitHub source repository</a>.</p></body></html>\n`;
}

/** Returns Vite emitFile assets. Missing upstream license/notice texts fail the build. */
export function buildLicenseAssets(projectRoot){
  const root=resolve(projectRoot);
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
  const release=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  if(lock.packages[''].version!==release.version)throw new Error('LIC02: package-lock and package.json version mismatch');
  const files=[];
  const add=(fileName,bytes)=>{
    if(files.some(x=>x.fileName===fileName))throw new Error(`LIC02: duplicate output: ${fileName}`);
    if(!bytes.length)throw new Error(`LIC02: empty asset: ${fileName}`);
    files.push({fileName,source:bytes});
  };
  for(const path of ['LICENSE','THIRD_PARTY_NOTICES.md','licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt','licenses/HTML2CANVAS_MIT.txt']){
    add(path,fileBytes(join(root,path)));
  }
  const packages=runtimePackages(lock);
  const manifest=[];
  for(const pkg of packages){
    const dir=join(root,'node_modules',...pkg.name.split('/'));
    const meta=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
    if(meta.name!==pkg.name || meta.version!==pkg.version)throw new Error(`LIC02: installed package does not match lockfile: ${pkg.name}`);
    const names=readdirSync(dir).filter(name=>LICENSE_FILE.test(name)).sort();
    const items=[];
    for(const name of names){
      const p=join(dir,name);
      if(!statSync(p).isFile())continue;
      const data=fileBytes(p);
      const dest=`licenses/npm/${pkg.name}/${name}`;
      add(dest,data);items.push({path:dest,sha256:sha256(data),bytes:data.length});
    }
    if(!items.some(x=>/\/LICEN[CS]E(?:[-._]|$)|\/COPYING(?:[-._]|$)/i.test(x.path))){
      // One verified, package-version-specific exception. The npm-shipped README
      // itself contains the full original MIT license and must be redistributed
      // without modification; do not invent or regenerate legal wording.
      let accepted=false;
      if(pkg.name==='murmurhash-js'&&pkg.version==='1.0.0'&&pkg.license==='MIT'){
        for(const name of readdirSync(dir).filter(n=>/^README(?:\.[^.]+)?$/i.test(n)).sort()){
          const path=join(dir,name);
          if(!statSync(path).isFile())continue;
          const data=fileBytes(path);
          if(!approvedMurmurReadme(pkg,data.toString('utf8')))continue;
          const dest=`licenses/npm/${pkg.name}/${name}`;
          add(dest,data);items.push({path:dest,sha256:sha256(data),bytes:data.length});
          accepted=true;break;
        }
      }
      if(!accepted)throw new Error(`LIC02: no distributable license text for ${pkg.name}@${pkg.version}; inspect npm package before publishing`);
    }
    manifest.push({...pkg,files:items.map(x=>x.path),assets:items});
  }
  add('licenses/manifest.json',Buffer.from(JSON.stringify({project_version:release.version,packages:manifest},null,2)+'\n','utf8'));
  add('licenses/index.html',Buffer.from(licenseIndexHtml(release.version,manifest),'utf8'));
  return {assets:files,packageCount:manifest.length};
}
