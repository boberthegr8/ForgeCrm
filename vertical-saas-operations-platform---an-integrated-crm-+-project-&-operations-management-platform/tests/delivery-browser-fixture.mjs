import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// Local-only bundle replaces data boundaries; never loads suite auth or sends requests.
const out = 'tests/.preview';
mkdirSync(out, { recursive: true });
await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {DeliveryBoard} from './components/DeliveryBoard'; createRoot(document.getElementById('root')).render(<DeliveryBoard/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, outfile: `${out}/fixture.js`,
  plugins: [{ name: 'fixture-boundaries', setup(build) {
    build.onResolve({ filter: /^\.\.\/(store|forgeOperations)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('store') ? `export const useForgeStore=()=>({data:{deliveryRequests:[]}});` : `
      window.__fixture = { calls: [], fail: true };
      const delivery = {id:'fixture',deliveryNumber:'FIXTURE ONLY',status:'planned',direction:'outbound',scheduledStart:'2026-11-01T06:30:45.123Z',stopSequence:1,truck:'Fixture truck',driver:'Fixture driver'};
      export const coreAddressText=()=>'';
      export const loadOperationsWorkspace=async()=>({context:{organizationId:'fixture'},projects:[],quotes:[],purchaseOrders:[],deliveries:[delivery]});
      export const createCoreDelivery=async()=>{throw new Error('Creation disabled in fixture')};
      export const updateCoreDelivery=async(id,patch)=>{window.__fixture.calls.push({id,patch}); if(window.__fixture.fail) throw new Error('Synthetic save failure. Retry when ready.'); Object.assign(delivery,patch);};
    ` }));
  }}],
});
writeFileSync(`${out}/style.css`, readFileSync('index.css'));
writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local synthetic Delivery QA</title><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="style.css"><body><p>LOCAL SYNTHETIC FIXTURE — no business writes</p><div id="root"></div><script src="fixture.js"></script></body></html>`);
console.log('Local synthetic harness generated in tests/.preview');
