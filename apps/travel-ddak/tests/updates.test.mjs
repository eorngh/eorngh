import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupUpdates} from '../dist/updates.js';
function target(){const handlers={};return {handlers,addEventListener(type,fn){handlers[type]=fn;},emit(type){handlers[type]?.();}};}
function fixture({waiting=true,save=()=>{}}={}){
 const sw=target(),button={...target(),hidden:true},worker={...target(),state:'installed',messages:[],postMessage(msg){this.messages.push(msg);}},registration={...target(),waiting:waiting?worker:null,installing:worker,update:async()=>{}};
 let reloads=0;const notices=[];sw.register=async()=>registration;
 return {sw,button,worker,registration,notices,get reloads(){return reloads;},start:()=>setupUpdates({serviceWorker:sw,button,saveNotes:save,reload:()=>reloads++,notify:x=>notices.push(x)})};
}
test('대기 중 업데이트는 자동 적용하지 않고 사용자 선택과 메모 저장 후 적용',async()=>{
 let saves=0;const f=fixture({save:()=>saves++});await f.start();assert.equal(f.button.hidden,false);assert.equal(f.worker.messages.length,0);assert.equal(f.reloads,0);
 f.sw.emit('controllerchange');assert.equal(f.reloads,0);f.button.emit('click');assert.equal(saves,1);assert.deepEqual(f.worker.messages,[{type:'APPLY_UPDATE'}]);f.sw.emit('controllerchange');f.sw.emit('controllerchange');assert.equal(f.reloads,1);
});
test('메모 저장 실패 때 대기 업데이트를 적용하지 않음',async()=>{const f=fixture({save:()=>{throw Error('storage failed');}});await f.start();f.button.emit('click');assert.equal(f.worker.messages.length,0);assert.equal(f.reloads,0);assert(f.notices[0].includes('보류'));});
test('설치 중인 새 서비스워커가 대기 상태가 되면 업데이트 버튼 표시',async()=>{const f=fixture({waiting:false});await f.start();assert.equal(f.button.hidden,true);f.registration.emit('updatefound');f.registration.waiting=f.worker;f.worker.emit('statechange');assert.equal(f.button.hidden,false);assert.equal(f.worker.messages.length,0);});
