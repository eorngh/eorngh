import{readFile,writeFile}from'node:fs/promises';
const p='public/app.mjs';let s=await readFile(p,'utf8');s=s.replaceAll("cloud.session?.projectId===config.projectId?","cloud.session&&cloud.session.projectId===config.projectId?");s=s.replace("normalizeSite({...r,...values})","normalizeSite({...r,...values,roadAddress:values.address})");await writeFile(p,s);
