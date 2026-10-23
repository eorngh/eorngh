import {createServer,loadEnv} from '../server.mjs';
import {execFile} from 'node:child_process';
await loadEnv();
const port=Number(process.env.PORT||3650);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be between 1024 and 65535');
const server=createServer();
server.once('error',()=>{console.error('서버를 시작하지 못했습니다. 같은 포트에서 실행 중인 창을 확인하세요.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const url='http://127.0.0.1:'+port;console.log('현장AI365: '+url+'\n이 창을 유지하세요. 종료는 Ctrl+C.');if(process.platform==='win32')execFile('cmd',['/c','start','',url],()=>{});});
