import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
test('모든 웹 로컬 module import가 오프라인 캐시에 포함됨',async()=>{const root=new URL('../public/',import.meta.url);const worker=await readFile(new URL('sw.js',root),'utf8');for(const name of (await readdir(root)).filter(n=>n.endsWith('.mjs'))){const text=await readFile(new URL(name,root),'utf8');for(const m of text.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)){assert(worker.includes("'"+m[1]+"'"),'cache missing '+m[1]);assert((await stat(new URL(m[1],root))).isFile());}}});
