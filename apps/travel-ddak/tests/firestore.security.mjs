import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';

test('baseline rules retain owner-only access and a default deny',async()=>{
 const rules=await readFile(new URL('../firebase.rules.baseline',import.meta.url),'utf8');
 assert.match(rules,/request\.auth\.uid == uid/);
 assert.match(rules,/match \/\{document=\*\*\}/);
 assert.match(rules,/allow read, write: if false/);
});

test('emulator: unauthenticated and cross-user access is denied', {skip: !process.env.FIRESTORE_EMULATOR_HOST}, async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-travelddak',firestore:{host:'127.0.0.1',port:8185,rules:await readFile(new URL('../firebase.rules.baseline',import.meta.url),'utf8')}});
 try{
  const alice=env.authenticatedContext('qa-alice').firestore(),bob=env.authenticatedContext('qa-bob').firestore(),anon=env.unauthenticatedContext().firestore();
  const path='users/qa-alice/travelDdak/snapshot';
  await assertFails(setDoc(doc(anon,path),{revision:1}));
  await assertSucceeds(setDoc(doc(alice,path),{revision:1,state:{version:1,trips:[],recents:[]}}));
  await assertSucceeds(getDoc(doc(alice,path)));
  await assertFails(getDoc(doc(bob,path)));
  await assertFails(setDoc(doc(bob,path),{revision:2}));
  await assertFails(getDoc(doc(anon,path)));
 }finally{await env.cleanup();}
});
