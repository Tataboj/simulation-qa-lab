/** LIC-02: package redistribution notices with every Vite production build, including Pages. */
import {fileURLToPath} from 'node:url';
import {buildLicenseAssets} from './scripts/lic02_license_assets.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
export default {
  plugins:[{
    name:'lic02-distributed-license-notices',
    apply:'build',
    generateBundle(){
      const {assets}=buildLicenseAssets(root);
      for(const asset of assets)this.emitFile({type:'asset',fileName:asset.fileName,source:asset.source});
    }
  }]
};
