import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Load the exact bundled, licensed browser dependency in a Node-only test context.
// This helper is never included in the browser or Android assets.
export async function bundledPdfLib(){const module={exports:{}};const context={module,exports:module.exports,Array,Date,Uint8Array,ArrayBuffer,setTimeout,clearTimeout};vm.runInNewContext(await readFile(new URL('../public/vendor/pdf-lib.min.js',import.meta.url),'utf8'),context,{timeout:5000,filename:'bundled-pdf-lib.cjs'});return module.exports;}
