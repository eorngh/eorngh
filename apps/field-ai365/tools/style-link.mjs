import {readFile,writeFile}from'node:fs/promises';
let p='public/index.html',s=await readFile(p,'utf8');s=s.replace('<link rel="stylesheet" href="styles.css">','<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="master.css">');await writeFile(p,s);
p='public/sw.js';s=await readFile(p,'utf8');s=s.replace("'styles.css',","'styles.css','master.css',");await writeFile(p,s);
