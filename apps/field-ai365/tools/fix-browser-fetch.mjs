import{readFile,writeFile}from'node:fs/promises';
for(const p of ['public/cloud.mjs','public/providers.mjs']){let s=await readFile(p,'utf8');s=s.replaceAll('this.fetcher=fetcher;','this.fetcher=fetcher===globalThis.fetch?fetcher.bind(globalThis):fetcher;');await writeFile(p,s);}
const p='public/app.mjs';let s=await readFile(p,'utf8');s=s.replace("config.apiKey||'','text','required pattern", "config.apiKey||'','password','autocomplete=\"off\" required pattern");await writeFile(p,s);
