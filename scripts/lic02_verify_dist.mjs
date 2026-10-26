/** LIC-02: independent post-build acceptance check of the actual deployable dist/. */
import {readFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runtimePackages,approvedMurmurReadme} from './lic02_license_assets.mjs';

const sha256=b=>createHash('sha256').update(b).digest('hex');
function ensure(condition,message){if(!condition)throw new Error('LIC02_DIST_FAIL: '+message);}

export function verifyLicenseDistribution(projectRoot,distRoot=join(projectRoot,'dist')){
  const root=resolve(projectRoot),dist=resolve(distRoot);
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
  const expected=runtimePackages(lock);
  const read=x=>readFileSync(join(dist,x));
  const manifest=JSON.parse(read('licenses/manifest.json').toString('utf8'));
  ensure(manifest.project_version===lock.packages[''].version,'release version mismatch');
  ensure(manifest.packages.length===expected.length,'runtime dependency count mismatch');
  const html=read('index.html').toString('utf8');
  ensure(/licenses\/index\.html/.test(html)&&/aria-label="Licenses and third-party notices"/.test(html),'license URL missing from shipped HTML');
  const page=read('licenses/index.html').toString('utf8');
  ensure(page.includes('Third-party') || page.includes('third-party'),'missing human-readable legal index');
  for(const f of ['LICENSE','THIRD_PARTY_NOTICES.md','licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt','licenses/HTML2CANVAS_MIT.txt']){
    ensure(read(f).length>100,`${f} missing or too short`);
    ensure(read(f).equals(readFileSync(join(root,f))),`${f} differs from source`);
  }
  ensure(read('licenses/MAPLIBRE_GL_JS_6.4.1_LICENSE.txt').toString().includes('Copyright (c) 2023, MapLibre contributors'),'MapLibre notice missing');
  ensure(read('licenses/HTML2CANVAS_MIT.txt').toString().includes('Niklas von Hertzen'),'html2canvas notice missing');
  let count=0;
  for(let i=0;i<expected.length;i++){
    const pkg=expected[i],got=manifest.packages[i];
    ensure(got?.name===pkg.name && got?.version===pkg.version && got?.license===pkg.license,`package mismatch at ${pkg.name}`);
    ensure(got.assets?.length>0,`${pkg.name}: missing included license file`);
    const standalone=got.assets.some(f=>/\/LICEN[CS]E(?:[-._]|$)|\/COPYING(?:[-._]|$)/i.test(f.path));
    const approvedReadme=got.assets.some(f=>{
      if(!/\/README(?:\.[^.]+)?$/i.test(f.path))return false;
      return approvedMurmurReadme(pkg,read(f.path).toString('utf8'));
    });
    ensure(standalone||approvedReadme,`${pkg.name}: no verified full license text in dist`);
    for(const file of got.assets){
      ensure(/^licenses\/npm\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+\/[^/]+$/i.test(file.path),`invalid notice path ${file.path}`);
      const data=read(file.path);
      ensure(data.length===file.bytes&&sha256(data)===file.sha256,`corrupt notice ${file.path}`);
      ensure(data.equals(readFileSync(join(root,'node_modules',...pkg.name.split('/'),file.path.split('/').at(-1)))),`upstream notice changed: ${file.path}`);
      ensure(page.includes(encodeURIComponent(file.path.split('/').at(-1))),`license not indexed ${file.path}`);
      count++;
    }
  }
  return {packages:expected.length,files:count,version:manifest.project_version};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const out=verifyLicenseDistribution(resolve(process.cwd()));
    console.log(`LIC02_DIST_LICENSES=PASS packages=${out.packages} notice_files=${out.files} version=${out.version}`);
  }catch(err){console.error(err.stack||err);process.exitCode=1;}
}
